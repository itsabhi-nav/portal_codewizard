import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { amcSuspendSchema } from "@/lib/validation";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, amcSuspendSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: website } = await client
    .from("websites")
    .select("id, public_id, name, client_id")
    .eq("id", id)
    .maybeSingle();
  if (!website) return notFound("Website not found");

  const { data: contract } = await client
    .from("amc_contracts")
    .select("*")
    .eq("website_id", id)
    .maybeSingle();

  if (contract) {
    const { error } = await client
      .from("amc_contracts")
      .update({
        access_status: "manual_suspended",
        suspension_reason: body.data.reason || "Manually suspended by admin",
        suspended_at: new Date().toISOString(),
        updated_by: session.username,
      })
      .eq("id", contract.id)
      .select("*")
      .single();
    if (error) return badRequest("Failed to suspend website");
  }

  await client.from("websites").update({ status: "suspended" }).eq("id", id);
  invalidateLicenseCache(website.public_id);

  await logActivity(client, {
    eventType: ActivityEventTypes.WebsiteSuspended,
    clientId: website.client_id,
    websiteId: id,
    actor: session.username,
    description: `Website "${website.name}" manually suspended`,
    newValue: { reason: body.data.reason ?? null, mode: "manual" },
  });

  return ok({ suspended: true, reason: body.data.reason ?? null });
}
