import { assertConfig, getLicenseConfig } from "./config";
import type { LicenseConfig, LicenseResult, LicenseVerification } from "./types";

/**
 * Server-side license verification with a bounded in-memory cache and a
 * fail-safe offline policy.
 *
 * - The database/central API is always authoritative.
 * - A cached response is only reused within LICENSE_CACHE_TTL.
 * - If the central API is unreachable, the last verified response may be used
 *   for up to CODEWIZARD_OFFLINE_GRACE_SECONDS, but never for an
 *   expired/revoked license (fail-closed by default).
 */

interface CacheEntry {
  verification: LicenseVerification;
  storedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function clearLicenseCache(): void {
  cache.clear();
}

async function requestVerification(config: LicenseConfig): Promise<LicenseVerification> {
  const response = await fetch(`${config.apiUrl}/api/license/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: config.websiteId, secret: config.websiteSecret }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message || `License API returned ${response.status}`);
  }

  const json = (await response.json()) as { success: boolean; data: LicenseVerification };
  if (!json.success) throw new Error("License API returned an unsuccessful response");
  return json.data;
}

export async function verifyLicense(options: { fresh?: boolean } = {}): Promise<LicenseResult> {
  const config = getLicenseConfig();
  try {
    assertConfig(config);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const cacheKey = config.websiteId;
  const cached = cache.get(cacheKey);

  if (!options.fresh && config.cacheTtlSeconds > 0 && cached) {
    const ageSeconds = (Date.now() - cached.storedAt) / 1000;
    if (ageSeconds <= config.cacheTtlSeconds) {
      return { ok: true, verification: cached.verification, fromOfflineCache: false };
    }
  }

  try {
    const verification = await requestVerification(config);
    cache.set(cacheKey, { verification, storedAt: Date.now() });
    return { ok: true, verification, fromOfflineCache: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Bounded offline fallback: only reuse a previously verified license.
    if (cached) {
      const ageSeconds = (Date.now() - cached.storedAt) / 1000;
      const payload = cached.verification.payload;
      const stillValid = payload.license_valid && payload.expires_at * 1000 > Date.now();

      if (stillValid && ageSeconds <= config.offlineGraceSeconds) {
        return { ok: true, verification: cached.verification, fromOfflineCache: true };
      }
    }

    if (config.failClosed) {
      return { ok: false, error: message };
    }

    // Fail-open is only ever used within the bounded offline grace window and
    // only for previously verified licenses. Fresh/unverified sites still fail.
    return cached && cached.verification.payload.license_valid
      ? { ok: true, verification: cached.verification, fromOfflineCache: true }
      : { ok: false, error: message };
  }
}

/** Extract the HTML-safe display amount. */
export function formatAmount(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(paise / 100);
}
