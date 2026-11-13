import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { amcConfigureSchema } from "@/lib/validation";
import { mapAmcContract, mapAmcPeriod, mapRenewalQuote } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";
import { computeAmcStatus } from "@/lib/amc";
import { addDays, todayIST } from "@/lib/dates";
import { notifyAdmin } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;
  const client = getSupabase();

  const [contractRes, periodsRes, quotesRes] = await Promise.all([
    client.from("amc_contracts").select("*").eq("website_id", id).maybeSingle(),
    client.from("amc_periods").select("*").eq("website_id", id).order("start_date", { ascending: false }),
    client.from("renewal_quotes").select("*").eq("website_id", id).order("created_at", { ascending: false }),
  ]);

  return ok({
    contract: contractRes.data ? mapAmcContract(contractRes.data) : null,
    periods: (periodsRes.data ?? []).map(mapAmcPeriod),
    quotes: (quotesRes.data ?? []).map(mapRenewalQuote),
  });
}

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, amcConfigureSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: website } = await client
    .from("websites")
    .select("id, public_id, name, client_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!website) return notFound("Website not found");

  const businessDate = todayIST();
  const billingPeriodDays = body.data.billingPeriodDays ?? 365;
  const validityStart = body.data.validityStart ?? businessDate;
  const validityEnd =
    body.data.validityEnd ?? addDays(validityStart, billingPeriodDays - 1);

  const enabled = body.data.enabled ?? true;
  const exempt = body.data.exempt ?? false;
  const renewalPrice = Number(body.data.renewalPrice ?? 0);
  const negotiatedPrice = body.data.negotiatedPrice ? Number(body.data.negotiatedPrice) : null;

  const statusResult = computeAmcStatus({
    enabled,
    exempt,
    validityEnd,
    businessDate,
    upcomingThresholdDays: body.data.upcomingThresholdDays ?? 10,
    gracePeriodDays: body.data.gracePeriodDays ?? 3,
  });

  const accessStatus = exempt
    ? "active"
    : statusResult.status === "suspended"
      ? "suspended"
      : "active";

  const { data: contract, error } = await client
    .from("amc_contracts")
    .upsert(
      {
        website_id: id,
        enabled,
        exempt,
        original_price_paise: Number(body.data.originalPrice ?? renewalPrice),
        renewal_price_paise: renewalPrice,
        negotiated_price_paise: negotiatedPrice,
        billing_period_days: billingPeriodDays,
        upcoming_threshold_days: body.data.upcomingThresholdDays ?? 10,
        grace_period_days: body.data.gracePeriodDays ?? 3,
        validity_start: validityStart,
        validity_end: validityEnd,
        next_expiry_date: validityEnd,
        status: statusResult.status,
        access_status: accessStatus,
        suspension_reason: accessStatus === "suspended" ? "Expired beyond grace period" : null,
        suspended_at: accessStatus === "suspended" ? new Date().toISOString() : null,
        auto_renewal: body.data.autoRenewal ?? false,
        updated_by: session.username,
      },
      { onConflict: "website_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[amc:configure]", error);
    return badRequest("Failed to configure AMC");
  }

  // Create a default active quote for the current renewal price.
  const { data: existingQuote } = await client
    .from("renewal_quotes")
    .select("id")
    .eq("website_id", id)
    .eq("status", "active")
    .maybeSingle();

  if (!existingQuote) {
    await client.from("renewal_quotes").insert({
      website_id: id,
      amc_contract_id: contract.id,
      amount_paise: negotiatedPrice ?? renewalPrice,
      original_amount_paise: renewalPrice,
      discount_paise: negotiatedPrice ? Math.max(0, renewalPrice - negotiatedPrice) : 0,
      discount_percent:
        negotiatedPrice && renewalPrice > 0
          ? Math.round(((renewalPrice - negotiatedPrice) / renewalPrice) * 10000) / 100
          : null,
      quote_type: "default",
      effective_date: businessDate,
      status: "active",
      created_by: session.username,
    });
  }

  if (accessStatus === "suspended") {
    await client.from("websites").update({ status: "suspended" }).eq("id", id);
  } else if (website.status === "suspended") {
    await client.from("websites").update({ status: "live" }).eq("id", id);
  }

  invalidateLicenseCache(website.public_id);

  await logActivity(client, {
    eventType: exempt
      ? ActivityEventTypes.LicenseExemptionApplied
      : ActivityEventTypes.AmcConfigured,
    clientId: website.client_id,
    websiteId: id,
    actor: session.username,
    description: exempt
      ? `AMC exemption applied for website "${website.name}"`
      : `AMC configured for website "${website.name}" (renewal ${renewalPrice} paise, validity ${validityStart} to ${validityEnd})`,
    newValue: mapAmcContract(contract),
  });

  await notifyAdmin(client, {
    type: "amc_configured",
    title: exempt ? "AMC exemption applied" : "AMC configured",
    message: `AMC for "${website.name}" is now ${statusResult.status}.`,
    severity: "info",
    relatedWebsiteId: id,
    relatedClientId: website.client_id,
    dedupeKey: `amc_configured:${id}:${businessDate}`,
  });

  return ok(mapAmcContract(contract));
}
