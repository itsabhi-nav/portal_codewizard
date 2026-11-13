import { getSupabaseAdminOrNull } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/api";
import { authenticateLicenseRequest } from "@/lib/license-api-auth";
import { requestMeta, safeIp } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/license/verify
 * Body: { public_id, secret }  (or Authorization: Bearer <secret>)
 * Returns a signed, time-limited license payload for server-side validation.
 */
export async function POST(request: Request) {
  const client = getSupabaseAdminOrNull();
  if (!client) return fail(503, "License service unavailable: database is not configured");
  const auth = await authenticateLicenseRequest(request, client);
  if (!auth.ok) return auth.response;

  const meta = requestMeta(request);
  const payload = auth.verification.payload!;
  const token = auth.verification.token!;

  await client.from("license_events").insert({
    website_id: payload.website_id,
    event_type: "verify",
    outcome: payload.license_valid ? "success" : "denied",
    ip_address: safeIp(meta.ip),
    user_agent: meta.userAgent,
    metadata: { cached: auth.verification.cached, status: payload.status },
  });

  return ok({
    token,
    payload,
    cached: auth.verification.cached,
  });
}
