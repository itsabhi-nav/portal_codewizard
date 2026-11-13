import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { amcExtendSchema } from "@/lib/validation";
import { mapAmcContract } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";
import { computeAmcStatus } from "@/lib/amc";
import { todayIST } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, amcExtendSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: website } = await client
    .from("websites")
    .select("id, public_id, name, client_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!website) return notFound("Website not found");

  const { data: contract } = await client
    .from("amc_contracts")
    .select("*")
    .eq("website_id", id)
    .maybeSingle();
  if (!contract) return notFound("AMC contract not found");

  const newValidityEnd = body.data.newValidityEnd;
  const businessDate = todayIST();
  const statusResult = computeAmcStatus({
    enabled: contract.enabled,
    exempt: contract.exempt,
    validityEnd: newValidityEnd,
    businessDate,
    upcomingThresholdDays: contract.upcoming_threshold_days,
    gracePeriodDays: contract.grace_period_days,
  });

  const { data: updated, error } = await client
    .from("amc_contracts")
    .update({
      validity_end: newValidityEnd,
      next_expiry_date: newValidityEnd,
      status: statusResult.status,
      access_status: statusResult.status === "suspended" ? "suspended" : "active",
      suspension_reason: statusResult.status === "suspended" ? "Expired beyond grace period" : null,
      updated_by: session.username,
    })
    .eq("id", contract.id)
    .select("*")
    .single();

  if (error) return badRequest("Failed to extend validity");

  const accessStatus = statusResult.status === "suspended" ? "suspended" : "active";
  if (accessStatus === "suspended") {
    await client.from("websites").update({ status: "suspended" }).eq("id", id);
  } else if (website.status === "suspended") {
    await client.from("websites").update({ status: "live" }).eq("id", id);
  }

  invalidateLicenseCache(website.public_id);

  await logActivity(client, {
    eventType: ActivityEventTypes.AmcRenewed,
    clientId: website.client_id,
    websiteId: id,
    actor: session.username,
    description: `AMC validity manually extended to ${newValidityEnd} for "${website.name}"`,
    previousValue: { validity_end: contract.validity_end },
    newValue: { validity_end: newValidityEnd, reason: body.data.reason ?? null },
  });

  return ok(mapAmcContract(updated));
}
