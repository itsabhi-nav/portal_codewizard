import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, parseJsonBody, unauthorized } from "@/lib/api";
import { domainUpdateSchema } from "@/lib/validation";
import { mapWebsiteDomain } from "@/lib/mappers";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const body = await parseJsonBody(request, domainUpdateSchema);
  if (!body.success) return body.response;

  const client = getSupabase();
  const { data: website } = await client.from("websites").select("id, public_id, name").eq("id", id).maybeSingle();
  if (!website) return notFound("Website not found");

  const domain = body.data.domain.trim().toLowerCase();

  const { data: existing } = await client
    .from("website_domains")
    .select("*")
    .eq("website_id", id)
    .eq("domain", domain)
    .maybeSingle();

  if (existing) {
    await client.from("website_domains").update({ active: true, is_primary: body.data.isPrimary }).eq("id", existing.id);
  } else {
    if (body.data.isPrimary) {
      await client.from("website_domains").update({ is_primary: false }).eq("website_id", id);
    }
    const { data: created, error } = await client
      .from("website_domains")
      .insert({ website_id: id, domain, is_primary: body.data.isPrimary, active: true })
      .select("*")
      .single();
    if (error) return badRequest("Failed to save domain");
    await logActivity(client, {
      eventType: ActivityEventTypes.DomainChanged,
      clientId: website.id,
      websiteId: id,
      actor: session.username,
      description: `Domain changed to ${domain} for website "${website.name}"`,
      newValue: { domain, isPrimary: body.data.isPrimary, reason: body.data.reason ?? null },
    });
    invalidateLicenseCache(website.public_id);
    return ok(mapWebsiteDomain(created), { status: 201 });
  }

  await logActivity(client, {
    eventType: ActivityEventTypes.DomainChanged,
    clientId: website.id,
    websiteId: id,
    actor: session.username,
    description: `Domain ${domain} reactivated for website "${website.name}"`,
    newValue: { domain, isPrimary: body.data.isPrimary },
  });
  invalidateLicenseCache(website.public_id);
  return ok(mapWebsiteDomain(existing));
}
