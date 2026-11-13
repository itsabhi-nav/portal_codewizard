import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { z } from "zod";
import { mapAmcContract } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ exempt: z.boolean() });

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, schema);
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
  if (!contract) return notFound("AMC contract not found");

  const { data: updated, error } = await client
    .from("amc_contracts")
    .update({
      exempt: body.data.exempt,
      access_status: body.data.exempt ? "active" : "active",
      status: body.data.exempt ? "exempt" : "active",
      suspension_reason: null,
      suspended_at: null,
      updated_by: session.username,
    })
    .eq("id", contract.id)
    .select("*")
    .single();

  if (error) return badRequest("Failed to update exemption");

  invalidateLicenseCache(website.public_id);

  await logActivity(client, {
    eventType: ActivityEventTypes.LicenseExemptionApplied,
    clientId: website.client_id,
    websiteId: id,
    actor: session.username,
    description: body.data.exempt
      ? `Website "${website.name}" exempted from AMC`
      : `AMC exemption removed for "${website.name}"`,
    newValue: { exempt: body.data.exempt },
  });

  return ok(mapAmcContract(updated));
}
