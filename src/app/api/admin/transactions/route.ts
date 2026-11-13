import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, escapeSearch, ok, unauthorized } from "@/lib/api";
import { getPagination } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unified transaction view for payment reconciliation.
 * Joins Razorpay orders, payments and webhook events.
 */
export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const searchParams = new URL(request.url).searchParams;
  const pagination = getPagination(searchParams, 50);
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const websiteId = searchParams.get("websiteId");
  const clientId = searchParams.get("clientId");

  let query = getSupabase()
    .from("razorpay_orders")
    .select(
      "*, payment:payments(*), website:websites(id, name), client:clients(id, name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    const escaped = escapeSearch(search);
    query = query.or(
      `order_id.ilike.%${escaped}%,internal_order_ref.ilike.%${escaped}%,payment.payment_code.ilike.%${escaped}%,payment.razorpay_payment_id.ilike.%${escaped}%`
    );
  }
  if (status) query = query.eq("status", status);
  if (websiteId) query = query.eq("website_id", websiteId);
  if (clientId) query = query.eq("client_id", clientId);
  query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[transactions:list]", error);
    return badRequest("Failed to load transactions");
  }

  const webhookCounts: Record<string, number> = {};
  const orderIds = (data ?? []).map((row) => row.order_id).filter(Boolean);
  if (orderIds.length > 0) {
    const { data: events } = await getSupabase()
      .from("razorpay_webhook_events")
      .select("order_id, event_name, status")
      .in("order_id", orderIds);
    for (const event of events ?? []) {
      if (event.order_id) {
        webhookCounts[event.order_id] = (webhookCounts[event.order_id] ?? 0) + 1;
      }
    }
  }

  return ok({
    items: (data ?? []).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      internalOrderRef: row.internal_order_ref,
      amountPaise: Number(row.amount_paise),
      currency: row.currency,
      status: row.status,
      receipt: row.receipt,
      websiteId: row.website_id,
      websiteName: row.website?.name ?? null,
      clientId: row.client_id,
      clientName: row.client?.name ?? null,
      payment: row.payment
        ? {
            id: row.payment.id,
            paymentCode: row.payment.payment_code,
            status: row.payment.status,
            amountPaise: Number(row.payment.amount_paise),
            method: row.payment.method,
            razorpayPaymentId: row.payment.razorpay_payment_id,
            transactionRef: row.payment.transaction_ref,
            paymentDate: row.payment.payment_date,
          }
        : null,
      webhookEventCount: webhookCounts[row.order_id] ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    total: count ?? 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
}
