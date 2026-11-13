import { getSupabaseAdminOrNull } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/api";
import { authenticateLicenseRequest } from "@/lib/license-api-auth";
import { requestMeta, safeIp } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/license/config?public_id=...&secret=...
 * Returns the current license payload plus the renewal/suspension screen config.
 * This endpoint is intentionally reachable while the website is suspended so
 * the client can render the renewal screen.
 */
export async function GET(request: Request) {
  const client = getSupabaseAdminOrNull();
  if (!client) return fail(503, "License service unavailable: database is not configured");
  const auth = await authenticateLicenseRequest(request, client, { allowGet: true });
  if (!auth.ok) return auth.response;

  const meta = requestMeta(request);
  const payload = auth.verification.payload!;

  await client.from("license_events").insert({
    website_id: payload.website_id,
    event_type: "config",
    outcome: "success",
    ip_address: safeIp(meta.ip),
    user_agent: meta.userAgent,
    metadata: { status: payload.status, access_status: payload.access_status },
  });

  return ok({
    token: auth.verification.token,
    payload,
    suspension: payload.suspension,
    renewal_amount_paise: payload.renewal_amount_paise,
    currency: payload.currency,
  });
}
