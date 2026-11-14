import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, conflict, escapeSearch, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { getPagination } from "@/lib/api";
import { paymentCreateSchema } from "@/lib/validation";
import { mapPayment } from "@/lib/mappers";
import { generatePaymentCode } from "@/lib/ids";
import { createAmcInvoiceForPayment, createInvoiceWithItems, recalculateInvoice, recordPayment } from "@/lib/invoice-service";
import { PURPOSE_INVOICE } from "@/lib/payment-categories";
import { todayIST } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const searchParams = new URL(request.url).searchParams;
  const pagination = getPagination(searchParams);
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const purpose = searchParams.get("purpose");
  const method = searchParams.get("method");
  const clientId = searchParams.get("clientId");
  const websiteId = searchParams.get("websiteId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  let query = getSupabase()
    .from("payments")
    .select("*, client:clients(id, name), website:websites(id, name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    const escaped = escapeSearch(search);
    query = query.or(
      `payment_code.ilike.%${escaped}%,transaction_ref.ilike.%${escaped}%,razorpay_payment_id.ilike.%${escaped}%,razorpay_order_id.ilike.%${escaped}%`
    );
  }
  if (status) query = query.eq("status", status);
  if (purpose) query = query.eq("purpose", purpose);
  if (method) query = query.eq("method", method);
  if (clientId) query = query.eq("client_id", clientId);
  if (websiteId) query = query.eq("website_id", websiteId);
  if (dateFrom) query = query.gte("payment_date", dateFrom);
  if (dateTo) query = query.lte("payment_date", `${dateTo}T23:59:59.999Z`);
  query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

  const { data, error, count } = await query;
  if (error) return badRequest("Failed to load payments");

  return ok({
    items: (data ?? []).map(mapPayment),
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await parseJsonBody(request, paymentCreateSchema);
  if (!body.success) return body.response;

  const amount = Number(body.data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return badRequest("Amount must be greater than zero");
  }

  const client = getSupabase();
  const paymentCode = generatePaymentCode();

  const { data, error } = await client
    .from("payments")
    .insert({
      payment_code: paymentCode,
      client_id: body.data.clientId,
      website_id: body.data.websiteId ?? null,
      invoice_id: body.data.invoiceId ?? null,
      amount_paise: amount,
      currency: "INR",
      method: body.data.method,
      purpose: body.data.purpose,
      status: body.data.status ?? "successful",
      transaction_ref: body.data.transactionRef ?? null,
      payment_date: body.data.paymentDate ?? new Date().toISOString(),
      notes: body.data.notes ?? null,
      created_by: session.username,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[payments:create]", error);
    return conflict("Failed to record payment");
  }

  await recordPayment(client, {
    paymentId: paymentCode,
    clientId: body.data.clientId,
    websiteId: body.data.websiteId ?? null,
    invoiceId: body.data.invoiceId ?? null,
    amountPaise: amount,
    method: body.data.method,
    purpose: body.data.purpose,
    status: body.data.status ?? "successful",
    transactionRef: body.data.transactionRef ?? null,
    paymentDate: body.data.paymentDate ?? new Date().toISOString(),
    createdBy: session.username,
  });

  if ((body.data.status ?? "successful") === "successful" && body.data.purpose !== "amc_renewal") {
    const websiteId = body.data.websiteId ?? null;

    // 1. If there is an open development invoice (the package bill created when
    //    the website/entry was added), apply this payment to it so its paid/pending
    //    status always reflects reality.
    let openInvoice: { id: string } | null = null;
    {
      let q = client
        .from("invoices")
        .select("id, website_id")
        .eq("client_id", body.data.clientId)
        .eq("invoice_type", "development")
        .in("status", ["sent", "partially_paid", "overdue"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (websiteId) q = q.eq("website_id", websiteId);
      const { data: open } = await q.maybeSingle();
      openInvoice = open ?? null;
    }

    if (openInvoice) {
      await client.from("payments").update({ invoice_id: openInvoice.id }).eq("id", data.id);
      await recalculateInvoice(client, openInvoice.id);
    } else {
      // 2. Otherwise create a PAID receipt invoice with the category label.
      const cat = PURPOSE_INVOICE[body.data.purpose ?? "advance"] ?? PURPOSE_INVOICE.other;
      let label = cat.label;
      if (websiteId) {
        const { data: w } = await client.from("websites").select("name").eq("id", websiteId).maybeSingle();
        if (w?.name) label = `${cat.label} — ${w.name}`;
      } else {
        const { data: c } = await client.from("clients").select("name").eq("id", body.data.clientId).maybeSingle();
        if (c?.name) label = `${cat.label} — ${c.name}`;
      }
      const receipt = await createInvoiceWithItems(client, {
        clientId: body.data.clientId,
        websiteId,
        invoiceType: cat.type,
        issueDate: todayIST(),
        items: [{ description: label, quantity: 1, unitPricePaise: amount }],
        status: "paid",
        notes: `Auto-generated for payment ${paymentCode}`,
        createdBy: session.username,
        paymentId: data.id,
      });
      if (receipt?.invoiceId) {
        await client.from("payments").update({ invoice_id: receipt.invoiceId }).eq("id", data.id);
        await recalculateInvoice(client, receipt.invoiceId);
      }
    }
  }

  // Auto-generate a paid AMC invoice when an AMC renewal is recorded manually
  if (body.data.purpose === "amc_renewal" && (body.data.status ?? "successful") === "successful" && body.data.websiteId) {
    const { data: websiteRow } = await client
      .from("websites")
      .select("name")
      .eq("id", body.data.websiteId)
      .maybeSingle();
    await createAmcInvoiceForPayment(client, {
      clientId: body.data.clientId,
      websiteId: body.data.websiteId,
      websiteName: websiteRow?.name ?? "Website",
      amountPaise: amount,
      method: body.data.method,
      createdBy: session.username,
    });
  }

  return ok(mapPayment(data), { status: 201 });
}
