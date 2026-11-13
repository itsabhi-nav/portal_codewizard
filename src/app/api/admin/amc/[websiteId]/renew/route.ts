import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { manualRenewSchema } from "@/lib/validation";
import { mapAmcContract, mapAmcPeriod, mapPayment } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";
import { computeAmcStatus, computeRenewalPeriod } from "@/lib/amc";
import { todayIST } from "@/lib/dates";
import { generatePaymentCode } from "@/lib/ids";
import { createAmcInvoiceForPayment } from "@/lib/invoice-service";
import { notifyAdmin } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ websiteId: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { websiteId } = await params;

  const body = await parseJsonBody(request, manualRenewSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: website } = await client
    .from("websites")
    .select("id, public_id, name, client_id, status")
    .eq("id", websiteId)
    .maybeSingle();
  if (!website) return notFound("Website not found");

  const { data: contract } = await client
    .from("amc_contracts")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();
  if (!contract) return notFound("AMC contract not found");

  const businessDate = todayIST();
  const amount = Number(body.data.amount ?? 0);
  const effectiveDate = body.data.effectiveDate ?? businessDate;

  const period = computeRenewalPeriod({
    currentValidityEnd: contract.validity_end,
    businessDate,
    effectiveDate,
    billingPeriodDays: contract.billing_period_days,
  });

  const statusResult = computeAmcStatus({
    enabled: contract.enabled,
    exempt: contract.exempt,
    validityEnd: period.endDate,
    businessDate,
    upcomingThresholdDays: contract.upcoming_threshold_days,
    gracePeriodDays: contract.grace_period_days,
  });

  const paymentCode = generatePaymentCode();
  const { data: payment, error: paymentError } = await client
    .from("payments")
    .insert({
      payment_code: paymentCode,
      client_id: website.client_id,
      website_id: websiteId,
      amount_paise: amount,
      currency: "INR",
      method: body.data.paymentMethod ?? "other",
      purpose: "amc_renewal",
      status: "successful",
      transaction_ref: body.data.transactionRef ?? null,
      payment_date: new Date().toISOString(),
      notes: body.data.notes ?? "Manual AMC renewal",
      created_by: session.username,
    })
    .select("*")
    .single();

  if (paymentError) {
    console.error("[amc:renew] payment failed", paymentError);
    return badRequest("Failed to record renewal payment");
  }

  const { data: amcPeriod, error: periodError } = await client
    .from("amc_periods")
    .insert({
      amc_contract_id: contract.id,
      website_id: websiteId,
      start_date: period.startDate,
      end_date: period.endDate,
      price_paise: amount,
      payment_id: payment.id,
      status: "active",
      notes: "Manual renewal",
    })
    .select("*")
    .single();

  if (periodError) {
    console.error("[amc:renew] period failed", periodError);
    return badRequest("Failed to create AMC period");
  }

  const { data: updatedContract } = await client
    .from("amc_contracts")
    .update({
      validity_start: period.startDate,
      validity_end: period.endDate,
      next_expiry_date: period.endDate,
      last_renewal_date: businessDate,
      status: statusResult.status,
      access_status: statusResult.status === "suspended" ? "suspended" : "active",
      suspended_at: null,
      suspension_reason: null,
      updated_by: session.username,
    })
    .eq("id", contract.id)
    .select("*")
    .single();

  await client.from("websites").update({ status: "live" }).eq("id", websiteId);
  invalidateLicenseCache(website.public_id);

  // Auto-generate a paid invoice for this AMC renewal.
  await createAmcInvoiceForPayment(client, {
    clientId: website.client_id,
    websiteId,
    websiteName: website.name,
    amountPaise: amount,
    method: body.data.paymentMethod ?? "other",
    createdBy: session.username,
  });

  await logActivity(client, {
    eventType: ActivityEventTypes.AmcRenewed,
    clientId: website.client_id,
    websiteId,
    actor: session.username,
    description: `AMC renewed manually for "${website.name}" (${period.startDate} to ${period.endDate})`,
    newValue: { paymentId: payment.id, period: mapAmcPeriod(amcPeriod), amountPaise: amount },
  });

  await notifyAdmin(client, {
    type: "renewal_success",
    title: "AMC renewed",
    message: `Manual renewal recorded for "${website.name}". New validity ends ${period.endDate}.`,
    severity: "success",
    relatedClientId: website.client_id,
    relatedWebsiteId: websiteId,
    dedupeKey: `renewal_success:${payment.id}`,
  });

  return ok(
    {
      payment: mapPayment(payment),
      period: mapAmcPeriod(amcPeriod),
      contract: mapAmcContract(updatedContract),
    },
    { status: 201 }
  );
}
