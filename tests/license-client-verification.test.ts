import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLicenseCache,
  verifyLicense,
} from "../packages/codewizard-license/src/verification";
import type { LicensePayload } from "../packages/codewizard-license/src/types";

function verificationResponse(licenseValid: boolean): Response {
  const payload: LicensePayload = {
    website_id: "website-1",
    public_id: "cw_test123",
    client_id: "client-1",
    website_name: "Test Website",
    status: licenseValid ? "active" : "suspended",
    access_status: licenseValid ? "active" : "suspended",
    license_valid: licenseValid,
    validity_start: "2026-01-01",
    validity_end: "2026-12-31",
    renewal_amount_paise: 120000,
    currency: "INR",
    renewal_quote_id: null,
    suspension: null,
    issued_at: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };

  return new Response(
    JSON.stringify({ success: true, data: { token: "signed-token", payload, cached: false } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("client website license verification cache", () => {
  afterEach(() => {
    clearLicenseCache();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rechecks the central license service on each request by default", async () => {
    vi.stubEnv("CODEWIZARD_API_URL", "https://codewizard.example");
    vi.stubEnv("CODEWIZARD_WEBSITE_ID", "cw_test123");
    vi.stubEnv("CODEWIZARD_WEBSITE_SECRET", "test-secret");
    vi.stubEnv("CODEWIZARD_CACHE_TTL", "0");
    vi.stubEnv("CODEWIZARD_OFFLINE_GRACE_SECONDS", "0");
    vi.stubEnv("CODEWIZARD_FAIL_CLOSED", "true");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(verificationResponse(true))
      .mockResolvedValueOnce(verificationResponse(false));
    vi.stubGlobal("fetch", fetchMock);

    const active = await verifyLicense();
    const suspended = await verifyLicense();

    expect(active.verification?.payload.license_valid).toBe(true);
    expect(suspended.verification?.payload.license_valid).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
