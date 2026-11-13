import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";
import { computeAmcStatus } from "@/lib/amc";
import { todayIST } from "@/lib/dates";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

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

  if (contract) {
    const businessDate = todayIST();
    const statusResult = computeAmcStatus({
      enabled: contract.enabled,
      exempt: contract.exempt,
      validityEnd: contract.validity_end,
      businessDate,
      upcomingThresholdDays: contract.upcoming_threshold_days,
      gracePeriodDays: contract.grace_period_days,
    });

    const accessStatus = contract.exempt
      ? "active"
      : statusResult.status === "suspended"
        ? "suspended"
        : "active";

    const { error } = await client
      .from("amc_contracts")
      .update({
        access_status: accessStatus,
        suspension_reason: accessStatus === "suspended" ? "Expired beyond grace period" : null,
        suspended_at: accessStatus === "suspended" ? new Date().toISOString() : null,
        status: statusResult.status,
        updated_by: session.username,
      })
      .eq("id", contract.id)
      .select("*")
      .single();

    if (error) return badRequest("Failed to reactivate website");
  }

  if (website.status === "suspended") {
    await client.from("websites").update({ status: "live" }).eq("id", id);
  }

  invalidateLicenseCache(website.public_id);

  await logActivity(client, {
    eventType: ActivityEventTypes.WebsiteReactivated,
    clientId: website.client_id,
    websiteId: id,
    actor: session.username,
    description: `Website "${website.name}" manually reactivated`,
  });

  return ok({ reactivated: true });
}
