import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { paymentUpdateSchema, refundCreateSchema } from "@/lib/validation";
import { mapPayment, mapRefund } from "@/lib/mappers";
import { recalculateInvoice } from "@/lib/invoice-service";
import { generateRefundCode } from "@/lib/ids";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { createRazorpayRefund } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const client = getSupabase();
  const [{ data, error }, { data: refunds }] = await Promise.all([
    client.from("payments").select("*, client:clients(*), website:websites(*)").eq("id", id).maybeSingle(),
    client.from("refunds").select("*").eq("payment_id", id),
  ]);
  if (error) return badRequest("Failed to load payment");
  if (!data) return notFound("Payment not found");

  return ok({ payment: mapPayment(data), refunds: (refunds ?? []).map(mapRefund) });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, paymentUpdateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: previous } = await client.from("payments").select("*").eq("id", id).maybeSingle();
  if (!previous) return notFound("Payment not found");

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.data)) {
    if (value !== undefined) patch[key] = value;
  }

  const { data, error } = await client.from("payments").update(patch).eq("id", id).select("*").single();
  if (error) return badRequest("Failed to update payment");

  if (previous.invoice_id) await recalculateInvoice(client, previous.invoice_id);

  await logActivity(client, {
    eventType: ActivityEventTypes.PaymentReceived,
    clientId: data.client_id,
    websiteId: data.website_id,
    actor: session.username,
    description: `Payment ${data.payment_code} updated`,
    previousValue: mapPayment(previous),
    newValue: mapPayment(data),
  });

  return ok(mapPayment(data));
}

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, refundCreateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: payment } = await client.from("payments").select("*").eq("id", id).maybeSingle();
  if (!payment) return notFound("Payment not found");

  const amount = Number(body.data.amount);
  if (amount <= 0 || amount > Number(payment.amount_paise)) {
    return badRequest("Refund amount must be greater than zero and not exceed the payment amount");
  }

  let razorpayRefundId: string | null = null;
  if (body.data.processViaRazorpay && payment.razorpay_payment_id) {
    try {
      const refund = (await createRazorpayRefund(payment.razorpay_payment_id, amount)) as { id?: string };
      razorpayRefundId = refund.id ?? null;
    } catch (error) {
      console.error("[payments:refund] Razorpay refund failed", error);
      return badRequest("Razorpay refund failed. Record the refund manually after resolving with Razorpay.");
    }
  }

  const refundCode = generateRefundCode();
  const { data: refund, error } = await client
    .from("refunds")
    .insert({
      refund_code: refundCode,
      payment_id: id,
      invoice_id: payment.invoice_id ?? null,
      amount_paise: amount,
      reason: body.data.reason ?? null,
      status: "successful",
      razorpay_refund_id: razorpayRefundId,
      created_by: session.username,
    })
    .select("*")
    .single();

  if (error) return badRequest("Failed to record refund");

  // Update payment status based on total refunded.
  const { data: refunds } = await client
    .from("refunds")
    .select("amount_paise, status")
    .eq("payment_id", id)
    .eq("status", "successful");
  const totalRefunded = (refunds ?? []).reduce((sum, r) => sum + Number(r.amount_paise), 0);
  const newStatus =
    totalRefunded >= Number(payment.amount_paise) ? "refunded" : "partially_refunded";

  const { data: updatedPayment } = await client
    .from("payments")
    .update({ status: newStatus })
    .eq("id", id)
    .select("*")
    .single();

  if (payment.invoice_id) await recalculateInvoice(client, payment.invoice_id);

  await logActivity(client, {
    eventType: ActivityEventTypes.RefundProcessed,
    clientId: payment.client_id,
    websiteId: payment.website_id,
    actor: session.username,
    description: `Refund ${refundCode} recorded for payment ${payment.payment_code}`,
    newValue: { amountPaise: amount, razorpayRefundId, status: newStatus },
  });

  return ok({ refund: mapRefund(refund), payment: mapPayment(updatedPayment) }, { status: 201 });
}
