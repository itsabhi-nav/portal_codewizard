import { getSupabaseAdminOrNull } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { config } from "@/lib/config";
import { todayIST } from "@/lib/dates";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { notifyAdmin } from "@/lib/notifications";
import { generateRefundCode } from "@/lib/ids";
import { invalidateLicenseCache } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay webhook receiver. Signature is verified against the RAW request
 * body. Events are idempotent: duplicate event IDs are ignored.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  if (!config.razorpay.webhookSecret || !verifyWebhookSignature(rawBody, signature)) {
    return fail(401, "Invalid webhook signature");
  }

  let payload: {
    id?: string;
    event?: string;
    payload?: {
      payment?: { entity?: Record<string, unknown> };
      refund?: { entity?: Record<string, unknown> };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail(400, "Invalid webhook payload");
  }

  const eventId = payload.id ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const eventName = payload.event ?? "unknown";
  const client = getSupabaseAdminOrNull();
  if (!client) return fail(503, "Webhook service unavailable: database is not configured");

  const { error: insertError } = await client.from("razorpay_webhook_events").insert({
    event_id: eventId,
    event_name: eventName,
    payload,
    payment_id: (payload.payload?.payment?.entity?.id as string) ?? null,
    order_id: (payload.payload?.payment?.entity?.order_id as string) ?? null,
    status: "received",
  });

  if (insertError) {
    // Duplicate event -> idempotent success.
    return ok({ received: true, duplicate: true });
  }

  try {
    if (eventName === "payment.captured") {
      await handlePaymentCaptured(client, payload);
    } else if (eventName === "payment.failed") {
      await handlePaymentFailed(client, payload);
    } else if (eventName === "refund.processed") {
      await handleRefundProcessed(client, payload);
    }

    await client
      .from("razorpay_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return ok({ received: true, processed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client
      .from("razorpay_webhook_events")
      .update({ status: "failed", error: message, processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    await notifyAdmin(client, {
      type: "webhook_failed",
      title: "Razorpay webhook failed",
      message: `Event ${eventName} (${eventId}) could not be processed: ${message}`,
      severity: "error",
      dedupeKey: `webhook_failed:${eventId}`,
    });

    // Return 200 so Razorpay does not retry indefinitely; the failure is logged.
    return ok({ received: true, processed: false, error: message });
  }
}

async function handlePaymentCaptured(client: SupabaseClient, payload: unknown) {
  const entity = (payload as {
    payload?: { payment?: { entity?: Record<string, unknown> } };
  }).payload?.payment?.entity;
  if (!entity) throw new Error("payment.captured payload missing payment entity");

  const razorpayPaymentId = String(entity.id);
  const orderId = String(entity.order_id ?? "");
  const amount = Number(entity.amount);

  const { data: orderRow } = await client
    .from("razorpay_orders")
    .select("*, website:websites(id, public_id, name, client_id)")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!orderRow) {
    throw new Error(`Unknown Razorpay order ${orderId}`);
  }
  if (amount !== Number(orderRow.amount_paise)) {
    throw new Error(`Amount mismatch for order ${orderId}: ${amount} != ${orderRow.amount_paise}`);
  }

  const { data: paymentRow } = await client
    .from("payments")
    .select("id")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();
  if (!paymentRow) throw new Error(`Payment record not found for order ${orderId}`);

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
    p_razorpay_payment_id: razorpayPaymentId,
    p_amount_paise: Number(orderRow.amount_paise),
    p_billing_period_days: contractRow?.billing_period_days ?? 365,
    p_business_date: businessDate,
    p_effective_date: businessDate,
    p_actor: "webhook",
  });

  if (result.error) throw new Error(result.error.message);

  invalidateLicenseCache(orderRow.website?.public_id ?? undefined);

  await logActivity(client, {
    eventType: ActivityEventTypes.AmcRenewed,
    clientId: orderRow.website?.client_id ?? null,
    websiteId: orderRow.website_id,
    actor: "webhook",
    description: `AMC renewed via webhook for "${orderRow.website?.name ?? "website"}"`,
    newValue: { orderId, razorpayPaymentId, amountPaise: amount },
  });
}

async function handlePaymentFailed(client: SupabaseClient, payload: unknown) {
  const entity = (payload as {
    payload?: { payment?: { entity?: Record<string, unknown> } };
  }).payload?.payment?.entity;
  const orderId = String(entity?.order_id ?? "");
  if (!orderId) return;

  await client.from("razorpay_orders").update({ status: "failed" }).eq("order_id", orderId);
  await client.from("payments").update({ status: "failed" }).eq("razorpay_order_id", orderId);

  await logActivity(client, {
    eventType: ActivityEventTypes.PaymentFailed,
    actor: "webhook",
    description: `Razorpay payment failed for order ${orderId}`,
    newValue: { orderId, razorpayPaymentId: entity?.id ?? null },
  });
}

async function handleRefundProcessed(client: SupabaseClient, payload: unknown) {
  const entity = (payload as {
    payload?: { refund?: { entity?: Record<string, unknown> } };
  }).payload?.refund?.entity;
  if (!entity) throw new Error("refund.processed payload missing refund entity");

  const razorpayPaymentId = String(entity.payment_id ?? "");
  const amount = Number(entity.amount);
  const razorpayRefundId = String(entity.id ?? "");

  const { data: paymentRow } = await client
    .from("payments")
    .select("id, client_id, website_id, amount_paise, status")
    .eq("razorpay_payment_id", razorpayPaymentId)
    .maybeSingle();

  if (!paymentRow) throw new Error(`Payment not found for refund ${razorpayRefundId}`);

  await client.from("refunds").insert({
    refund_code: generateRefundCode(),
    payment_id: paymentRow.id,
    amount_paise: amount,
    status: "successful",
    razorpay_refund_id: razorpayRefundId,
    reason: "Razorpay webhook refund",
    created_by: "webhook",
  });

  const { data: refunds } = await client
    .from("refunds")
    .select("amount_paise")
    .eq("payment_id", paymentRow.id)
    .eq("status", "successful");
  const totalRefunded = (refunds ?? []).reduce(
    (sum: number, r: { amount_paise: number }) => sum + Number(r.amount_paise),
    0
  );
  const newStatus =
    totalRefunded >= Number(paymentRow.amount_paise) ? "refunded" : "partially_refunded";

  await client.from("payments").update({ status: newStatus }).eq("id", paymentRow.id);

  await logActivity(client, {
    eventType: ActivityEventTypes.RefundProcessed,
    clientId: paymentRow.client_id,
    websiteId: paymentRow.website_id,
    actor: "webhook",
    description: `Refund ${razorpayRefundId} processed for payment ${razorpayPaymentId}`,
    newValue: { amountPaise: amount, status: newStatus },
  });
}
