import { getSupabaseAdminOrNull } from "@/lib/supabase/admin";
import { badRequest, fail, ok } from "@/lib/api";
import { authenticateLicenseRequest, freshLicenseContext } from "@/lib/license-api-auth";
import { config } from "@/lib/config";
import { isRazorpayAvailable, createRazorpayOrder } from "@/lib/razorpay";
import { generateOrderRef, generatePaymentCode } from "@/lib/ids";
import { todayIST } from "@/lib/dates";
import { requestMeta, safeIp } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/license/renewal/create-order
 * Creates a Razorpay order using the authoritative amount from the database.
 * The amount is locked to this order; client-submitted amounts are ignored.
 */
export async function POST(request: Request) {
  const client = getSupabaseAdminOrNull();
  if (!client) return fail(503, "License service unavailable: database is not configured");
  const auth = await authenticateLicenseRequest(request, client);
  if (!auth.ok) return auth.response;

  if (!isRazorpayAvailable()) {
    return fail(503, "Online payments are not configured. Add Razorpay credentials to enable renewals.");
  }

  const context = await freshLicenseContext(client, auth.publicId, auth.secret);
  if (!context.ok) return fail(401, context.error);

  const { website, quote, amountPaise, settings } = context.data;
  if (amountPaise <= 0) {
    return badRequest("No renewal amount is configured for this website.");
  }
  if (website.status === "archived") {
    return badRequest("This website is archived.");
  }

  const receipt = `renew_${website.id.slice(0, 8)}_${Date.now()}`;
  const internalRef = generateOrderRef();

  let order;
  try {
    order = await createRazorpayOrder({
      amountPaise,
      currency: settings.general.currency,
      receipt,
      notes: {
        website_id: website.id,
        public_id: website.publicId,
        quote_id: quote?.id ?? "",
        internal_ref: internalRef,
      },
    });
  } catch (error) {
    console.error("[license:create-order] Razorpay order failed", error);
    return fail(502, "Payment gateway unavailable. Please try again later.");
  }

  const paymentCode = generatePaymentCode();
  const { error: paymentError } = await client.from("payments").insert({
    payment_code: paymentCode,
    client_id: website.clientId,
    website_id: website.id,
    amount_paise: amountPaise,
    currency: settings.general.currency,
    method: "razorpay",
    purpose: "amc_renewal",
    status: "created",
    razorpay_order_id: order.id,
    notes: "AMC renewal order",
    created_by: "license-api",
  });

  if (paymentError) {
    console.error("[license:create-order] payment record failed", paymentError);
    return fail(500, "Failed to create payment record");
  }

  const { data: paymentRow } = await client
    .from("payments")
    .select("id")
    .eq("razorpay_order_id", order.id)
    .maybeSingle();

  await client.from("razorpay_orders").insert({
    order_id: order.id,
    internal_order_ref: internalRef,
    website_id: website.id,
    client_id: website.clientId,
    payment_id: paymentRow?.id ?? null,
    quote_id: quote?.id ?? null,
    amount_paise: amountPaise,
    currency: settings.general.currency,
    status: "created",
    receipt,
    notes: "AMC renewal",
  });

  if (quote?.id) {
    await client.from("renewal_quotes").update({ razorpay_order_id: order.id }).eq("id", quote.id);
  }

  const meta = requestMeta(request);
  await client.from("license_events").insert({
    website_id: website.id,
    event_type: "create_order",
    outcome: "success",
    ip_address: safeIp(meta.ip),
    user_agent: meta.userAgent,
    metadata: { order_id: order.id, amount_paise: amountPaise, quote_id: quote?.id ?? null },
  });

  await logActivity(client, {
    eventType: "license.order_created",
    clientId: website.clientId,
    websiteId: website.id,
    actor: "license-api",
    description: `Renewal order ${order.id} created for "${website.name}"`,
    newValue: { orderId: order.id, amountPaise, quoteId: quote?.id ?? null },
  });

  return ok({
    order_id: order.id,
    internal_order_ref: internalRef,
    amount_paise: amountPaise,
    currency: settings.general.currency,
    razorpay_key_id: config.razorpay.keyId,
    receipt,
    quote_id: quote?.id ?? null,
    website_name: website.name,
    business_date: todayIST(),
  });
}
