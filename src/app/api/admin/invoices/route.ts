import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, conflict, escapeSearch, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { getPagination } from "@/lib/api";
import { invoiceCreateSchema } from "@/lib/validation";
import { mapInvoice, mapInvoiceItem } from "@/lib/mappers";
import { nextInvoiceNumber } from "@/lib/ids";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { getAppSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const searchParams = new URL(request.url).searchParams;
  const pagination = getPagination(searchParams);
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const clientId = searchParams.get("clientId");

  let query = getSupabase()
    .from("invoices")
    .select("*, client:clients(id, name), website:websites(id, name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    const escaped = escapeSearch(search);
    query = query.ilike("invoice_number", `%${escaped}%`);
  }
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("invoice_type", type);
  if (clientId) query = query.eq("client_id", clientId);
  query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

  const { data, error, count } = await query;
  if (error) return badRequest("Failed to load invoices");

  return ok({
    items: (data ?? []).map(mapInvoice),
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await parseJsonBody(request, invoiceCreateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const settings = await getAppSettings(client);
  const invoiceNumber = await nextInvoiceNumber(client, settings.general.invoicePrefix);

  const items = body.data.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const amount = Math.round(quantity * unitPrice);
    return {
      description: item.description,
      quantity,
      unit_price_paise: unitPrice,
      amount_paise: amount,
      tax_rate_percent: item.taxRatePercent ?? 0,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.amount_paise, 0);
  const taxRate = settings.payments.taxEnabled ? body.data.taxRatePercent ?? 0 : 0;
  const tax = Math.round((subtotal * taxRate) / 100);
  const total = subtotal + tax;

  const { data: invoice, error } = await client
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      client_id: body.data.clientId,
      website_id: body.data.websiteId ?? null,
      invoice_type: body.data.invoiceType,
      issue_date: body.data.issueDate,
      due_date: body.data.dueDate ?? null,
      subtotal_paise: subtotal,
      tax_paise: tax,
      total_paise: total,
      amount_paid_paise: 0,
      status: "sent",
      tax_rate_percent: taxRate,
      notes: body.data.notes ?? null,
      created_by: session.username,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[invoices:create]", error);
    return conflict("Failed to create invoice");
  }

  const { data: createdItems, error: itemsError } = await client
    .from("invoice_items")
    .insert(items.map((item, index) => ({ ...item, invoice_id: invoice.id, sort_order: index })))
    .select("*");

  if (itemsError) {
    console.error("[invoices:create] items failed", itemsError);
  }

  await logActivity(client, {
    eventType: ActivityEventTypes.InvoiceCreated,
    clientId: invoice.client_id,
    websiteId: invoice.website_id,
    actor: session.username,
    description: `Invoice ${invoiceNumber} created for ${formatINRFromPaise(total)}`,
    newValue: { invoiceNumber, totalPaise: total, status: "sent" },
  });

  const result = mapInvoice(invoice);
  result.items = (createdItems ?? []).map(mapInvoiceItem);
  return ok(result, { status: 201 });
}

function formatINRFromPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}
