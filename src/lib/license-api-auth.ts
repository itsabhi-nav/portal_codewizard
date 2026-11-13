import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { findLicenseContext, verifyLicense, type CachedLicenseResult } from "@/lib/license";

type AuthResult =
  | { ok: true; publicId: string; secret: string; verification: CachedLicenseResult }
  | { ok: false; response: NextResponse };

/**
 * Authenticate a license API request.
 * Credentials may be supplied in the JSON body ({public_id, secret}) or in
 * the Authorization header (Bearer <secret>) with public_id in the body/query.
 */
export async function authenticateLicenseRequest(
  _request: Request,
  client: SupabaseClient,
  options: { allowGet?: boolean; body?: unknown } = {}
): Promise<AuthResult> {
  const authHeader = _request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let publicId: string | null = null;
  let secret: string | null = bearer;

  if (options.allowGet) {
    const url = new URL(_request.url);
    publicId = url.searchParams.get("public_id") || url.searchParams.get("website_id");
    secret = secret || url.searchParams.get("secret");
  } else {
    let body: { public_id?: string; website_id?: string; secret?: string };
    if (options.body !== undefined) {
      body = options.body as { public_id?: string; website_id?: string; secret?: string };
    } else {
      try {
        body = (await _request.json()) as { public_id?: string; website_id?: string; secret?: string };
      } catch {
        return { ok: false, response: fail(400, "Request body must be valid JSON") };
      }
    }
    publicId = body.public_id || body.website_id || null;
    secret = secret || body.secret || null;
  }

  if (!publicId || !secret) {
    return { ok: false, response: fail(401, "Website credentials required") };
  }

  const verification = await verifyLicense(client, publicId, secret);
  if (!verification.ok) {
    return { ok: false, response: fail(401, verification.error ?? "Invalid website credentials") };
  }

  return { ok: true, publicId, secret, verification };
}

/** Re-run context lookup (used when a route needs fresh AMC/quote data). */
export async function freshLicenseContext(
  client: SupabaseClient,
  publicId: string,
  secret: string
): Promise<ReturnType<typeof findLicenseContext>> {
  return findLicenseContext(client, publicId, secret);
}
