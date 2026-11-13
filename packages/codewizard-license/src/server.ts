import crypto from "node:crypto";
import { verifyLicense } from "./verification";
import type { LicensePayload } from "./types";

/**
 * Server-only helpers: signed response validation and route protection.
 * Import this file only from Node.js server code (never from middleware).
 */

/** Verify the HMAC-SHA256 signature of a license token. */
export function validateLicenseToken(
  token: string,
  signingSecret: string
): { valid: true; payload: LicensePayload } | { valid: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, error: "Malformed token" };

  const [body, signature] = parts;
  const expected = crypto.createHmac("sha256", signingSecret).update(body).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, error: "Invalid signature" };
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LicensePayload;
    if (payload.expires_at && Math.floor(Date.now() / 1000) > payload.expires_at) {
      return { valid: false, error: "License response expired" };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Invalid payload" };
  }
}

/**
 * Wrap a Next.js route handler with license enforcement.
 * Returns 403 when the license is suspended/expired, 503 when the license
 * service is unavailable and fail-closed mode is enabled.
 */
export { clearLicenseCache } from "./verification";

export function withLicenseProtected(
  handler: (request: Request, context: { license: LicensePayload }) => Promise<Response> | Response,
  options: { allowSuspended?: boolean } = {}
) {
  return async (request: Request): Promise<Response> => {
    const result = await verifyLicense();
    if (!result.ok) {
      return new Response(
        JSON.stringify({ success: false, error: { message: "License service unavailable", details: null } }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload = result.verification!.payload;
    if (!options.allowSuspended && !payload.license_valid) {
      return new Response(
        JSON.stringify({ success: false, error: { message: "License suspended", details: payload } }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    return handler(request, { license: payload });
  };
}

/** Convenience guard for server components. Throws when access is denied. */
export async function requireLicense(): Promise<LicensePayload> {
  const result = await verifyLicense();
  if (!result.ok) {
    throw new Error(result.error ?? "License service unavailable");
  }
  if (!result.verification!.payload.license_valid) {
    throw new Error("License suspended");
  }
  return result.verification!.payload;
}
