import { getSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api";
import { mapLicenseCredential } from "@/lib/mappers";
import { rotateLicenseCredential } from "@/lib/license-provision";
import { logActivity, ActivityEventTypes } from "@/lib/activity";
import { invalidateLicenseCache } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const client = getSupabase();
  const { data, error } = await client
    .from("license_credentials")
    .select("id, website_id, public_id, secret_prefix, is_active, last_rotated_at, created_at, updated_at")
    .eq("website_id", id)
    .maybeSingle();

  if (error) return badRequest("Failed to load license credential");
  if (!data) return notFound("No license credential provisioned for this website");

  return ok(mapLicenseCredential(data));
}

export async function POST(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const { id } = await params;

  const client = getSupabase();
  const { data: website } = await client
    .from("websites")
    .select("id, public_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!website) return notFound("Website not found");

  const { data: credential } = await client
    .from("license_credentials")
    .select("id")
    .eq("website_id", id)
    .maybeSingle();
  if (!credential) return notFound("No license credential to rotate");

  const rotated = await rotateLicenseCredential(client, credential.id);
  invalidateLicenseCache(website.public_id);

  await logActivity(client, {
    eventType: ActivityEventTypes.LicenseCredentialRotated,
    websiteId: id,
    actor: session.username,
    description: `License credential rotated for website "${website.name}"`,
    metadata: { prefix: rotated.prefix },
  });

  // The secret is returned exactly once.
  return ok({ secret: rotated.secret, prefix: rotated.prefix }, { status: 201 });
}
