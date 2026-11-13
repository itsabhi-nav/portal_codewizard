import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import {
  buildLicensePayload,
  signLicensePayload,
  verifyLicenseToken,
  buildRenewalScreenConfig,
  verifyLicense,
  type LicenseContextData,
} from "@/lib/license";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings";
import type { AmcStatusResult } from "@/lib/amc";
import { cacheClear } from "@/lib/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeContext(overrides: Partial<LicenseContextData> = {}): LicenseContextData {
  const statusResult: AmcStatusResult = {
    status: "suspended",
    daysRemaining: -5,
    daysOverdue: 5,
    isExpired: true,
    isGraceEnded: true,
  };

  return {
    credential: { id: "cred-1", publicId: "cw_test123", websiteId: "site-1" },
    website: { id: "site-1", publicId: "cw_test123", clientId: "client-1", name: "Test Site", status: "live" },
    client: { id: "client-1", name: "Test Client", mobile: "+919876543210", whatsappNumber: null },
    amc: {
      id: "amc-1",
      enabled: true,
      exempt: false,
      originalPricePaise: 300000,
      renewalPricePaise: 300000,
      negotiatedPricePaise: null,
      billingPeriodDays: 365,
      upcomingThresholdDays: 10,
      gracePeriodDays: 3,
      validityStart: "2025-06-01",
      validityEnd: "2026-05-31",
      lastRenewalDate: "2025-06-01",
      nextExpiryDate: "2026-05-31",
      status: "suspended",
      accessStatus: "suspended",
      suspensionReason: "Expired beyond grace period",
      suspendedAt: "2026-06-05T00:00:00.000Z",
    },
    websiteSettings: null,
    quote: null,
    settings: DEFAULT_APP_SETTINGS,
    businessDate: "2026-06-05",
    statusResult,
    amountPaise: 300000,
    accessStatus: "suspended",
    ...overrides,
  };
}

describe("license payload", () => {
  it("builds a payload with authoritative status and amount", () => {
    const payload = buildLicensePayload(makeContext());
    expect(payload.website_id).toBe("site-1");
    expect(payload.status).toBe("suspended");
    expect(payload.access_status).toBe("suspended");
    expect(payload.license_valid).toBe(false);
    expect(payload.renewal_amount_paise).toBe(300000);
    expect(payload.renewal_quote_id).toBeNull();
    expect(payload.suspension).not.toBeNull();
  });

  it("marks active licenses as valid", () => {
    const payload = buildLicensePayload(
      makeContext({
        accessStatus: "active",
        statusResult: { status: "active", daysRemaining: 30, daysOverdue: 0, isExpired: false, isGraceEnded: false },
      })
    );
    expect(payload.license_valid).toBe(true);
    expect(payload.access_status).toBe("active");
  });

  it("applies per-website suspension copy overrides", () => {
    const context = makeContext({
      websiteSettings: { customSuspensionTitle: "Custom Heading", customSuspensionBody: "Custom body" },
    });
    const config = buildRenewalScreenConfig(context);
    expect(config.heading).toBe("Custom Heading");
    expect(config.description).toBe("Custom body");
  });

  it("falls back to global suspension copy", () => {
    const config = buildRenewalScreenConfig(makeContext());
    expect(config.heading).toBe(DEFAULT_APP_SETTINGS.renewalScreen.heading);
    expect(config.description).toBe(DEFAULT_APP_SETTINGS.renewalScreen.description);
  });
});

describe("license token signing", () => {
  it("round-trips a signed payload", () => {
    const payload = buildLicensePayload(makeContext());
    const token = signLicensePayload(payload);
    const result = verifyLicenseToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.website_id).toBe(payload.website_id);
      expect(result.payload.renewal_amount_paise).toBe(payload.renewal_amount_paise);
    }
  });

  it("rejects tampered tokens", () => {
    const payload = buildLicensePayload(makeContext());
    const token = signLicensePayload(payload);
    const [body, signature] = token.split(".");
    const tampered = `${body}.${signature.slice(0, -2)}xx`;
    expect(verifyLicenseToken(tampered).valid).toBe(false);
  });

  it("rejects expired tokens", () => {
    const payload = buildLicensePayload(makeContext());
    payload.expires_at = Math.floor(Date.now() / 1000) - 10;
    const token = signLicensePayload(payload);
    expect(verifyLicenseToken(token).valid).toBe(false);
  });
});

describe("license verification cache", () => {
  it("does not allow a cached valid response to authenticate a different secret", async () => {
    cacheClear();
    const publicId = "cw_cache_test";
    const website = {
      id: "website-1",
      public_id: publicId,
      client_id: null,
      name: "Cache Test Site",
      status: "live",
    };
    const client = {
      from(table: string) {
        const rows: Record<string, unknown> = {
          license_credentials: {
            id: "credential-1",
            website_id: "website-1",
            public_id: publicId,
            secret_hash: bcrypt.hashSync("correct-secret", 4),
            is_active: true,
          },
          websites: website,
        };
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        };
        return query;
      },
    } as unknown as SupabaseClient;

    const valid = await verifyLicense(client, publicId, "correct-secret");
    const invalid = await verifyLicense(client, publicId, "wrong-secret");

    expect(valid.ok).toBe(true);
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toBe("Invalid website credentials");

    website.status = "archived";
    const updated = await verifyLicense(client, publicId, "correct-secret");
    expect(updated.ok).toBe(true);
    expect(updated.payload?.license_valid).toBe(false);
    expect(updated.payload?.access_status).toBe("archived");
    expect(updated.cached).toBe(false);
  });
});
