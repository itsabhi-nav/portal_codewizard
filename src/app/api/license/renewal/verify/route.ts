import { getSupabaseAdminOrNull } from "@/lib/supabase/admin";
import { badRequest, fail, ok } from "@/lib/api";
import { authenticateLicenseRequest } from "@/lib/license-api-auth";
import { verifyPaymentSignature, fetchRazorpayPayment } from "@/lib/razorpay";
import { invalidateLicenseCache } from "@/lib/license";
import { todayIST } from "@/lib/dates";
import { requestMeta, safeIp } from "@/lib/api";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { notifyAdmin } from "@/lib/notifications";
import { createAmcInvoiceForPayment } from "@/lib/invoice-service";
import { formatINR } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/license/renewal/verify
 * Verifies a Razorpay Checkout callback server-side, then processes the
 * renewal atomically. Frontend success callbacks alone never activate a site.
 */
export async function POST(request: Request) {
  let body: { public_id?: string; secret?: string; order_id?: string; payment_id?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const client = getSupabaseAdminOrNull();
  if (!client) return fail(503, "License service unavailable: database is not configured");
  const auth = await authenticateLicenseRequest(request, client, { body });
  if (!auth.ok) return auth.response;

  const orderId = body.order_id;
  const paymentId = body.payment_id;
  const signature = body.signature;

  if (!orderId || !paymentId || !signature) {
    return badRequest("order_id, payment_id and signature are required");
  }

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    await client.from("license_events").insert({
      event_type: "verify_payment",
      outcome: "failure",
      metadata: { order_id: orderId, payment_id: paymentId, reason: "invalid_signature" },
    });
    return fail(400, "Invalid payment signature");
  }

  let razorpayPayment;
  try {
    razorpayPayment = await fetchRazorpayPayment(paymentId);
  } catch (error) {
    console.error("[license:verify] failed to fetch Razorpay payment", error);
    return fail(502, "Unable to verify payment with the payment gateway");
  }

  if (razorpayPayment.status !== "captured") {
    return fail(400, "Payment was not completed");
  }

  const { data: orderRow } = await client
    .from("razorpay_orders")
    .select("*, website:websites(id, public_id, name, client_id)")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!orderRow) {
    return badRequest("Unknown renewal order");
  }
  if (orderRow.website_id !== auth.verification.payload?.website_id) {
    return fail(403, "Order does not belong to this website");
  }
  if (Number(razorpayPayment.amount) !== Number(orderRow.amount_paise)) {
    return fail(400, "Payment amount does not match the order amount");
  }

  const { data: paymentRow } = await client
    .from("payments")
    .select("id")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();
  if (!paymentRow) {
    return badRequest("Payment record not found for this order");
  }

  const { data: contractRow } = await client
    .from("amc_contracts")
    .select("id, billing_period_days")
    .eq("website_id", orderRow.website_id)
    .maybeSingle();

  const businessDate = todayIST();
  const result = await client.rpc("process_renewal_payment", {
    p_website_id: orderRow.website_id,
    p_contract_id: contractRow?.id ?? null,
    p_payment_id: paymentRow.id,
    p_quote_id: orderRow.quote_id ?? null,
    p_order_id: orderId,
    p_razorpay_payment_id: paymentId,
    p_amount_paise: Number(orderRow.amount_paise),
    p_billing_period_days: contractRow?.billing_period_days ?? 365,
    p_business_date: businessDate,
    p_effective_date: businessDate,
    p_actor: "license-api",
  });

  if (result.error) {
    console.error("[license:verify] renewal processing failed", result.error);
    return fail(500, "Failed to process renewal");
  }

  invalidateLicenseCache(orderRow.website?.public_id ?? undefined);

  // Auto-generate a paid invoice for this online AMC renewal.
  await createAmcInvoiceForPayment(client, {
    clientId: orderRow.website?.client_id ?? orderRow.client_id,
    websiteId: orderRow.website_id,
    websiteName: orderRow.website?.name ?? "Website",
    amountPaise: Number(orderRow.amount_paise),
    method: "razorpay",
    createdBy: "license-api",
  });

  const meta = requestMeta(request);
  await client.from("license_events").insert({
    website_id: orderRow.website_id,
    event_type: "verify_payment",
    outcome: "success",
    ip_address: safeIp(meta.ip),
    user_agent: meta.userAgent,
    metadata: { order_id: orderId, payment_id: paymentId, amount_paise: orderRow.amount_paise },
  });

  const validityEnd = (result.data as { end_date?: string } | null)?.end_date ?? null;

  await logActivity(client, {
    eventType: ActivityEventTypes.AmcRenewed,
    clientId: orderRow.website?.client_id ?? null,
    websiteId: orderRow.website_id,
    actor: "license-api",
    description: `AMC renewed online for "${orderRow.website?.name ?? "website"}" via Razorpay payment ${paymentId}`,
    newValue: { orderId, paymentId, amountPaise: orderRow.amount_paise, validityEnd },
  });

  await notifyAdmin(client, {
    type: "renewal_success",
    title: "Renewal payment successful",
    message: `"${orderRow.website?.name ?? "Website"}" renewed for ${formatINR(Number(orderRow.amount_paise))}. Validity extended to ${validityEnd}.`,
    severity: "success",
    relatedClientId: orderRow.website?.client_id ?? null,
    relatedWebsiteId: orderRow.website_id,
    dedupeKey: `renewal_success:${paymentRow.id}`,
  });

  return ok({
    verified: true,
    license_valid: true,
    validity_end: validityEnd,
    payment_id: paymentId,
    order_id: orderId,
  });
}
