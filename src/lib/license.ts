import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { computeAmcStatus, computeQuoteAmount, type AmcStatusResult } from "@/lib/amc";
import { todayIST } from "@/lib/dates";
import { cacheGet, cacheDelete, cacheInvalidatePrefix, cacheSet } from "@/lib/cache";
import { getAppSettings, type AppSettings } from "@/lib/settings";
import { signPayload, verifySignedPayload } from "@/lib/signing";
import type { AccessStatus } from "@/lib/amc";

/**
 * Central License Engine.
 *
 * Verifies website credentials server-side, computes AMC status from the
 * authoritative database, and returns HMAC-signed responses that client
 * websites validate on their own servers.
 */

export interface RenewalScreenConfig {
  heading: string;
  description: string;
  buttonText: string;
  supportText: string;
  logoUrl: string;
  background: string;
  textColor: string;
  buttonColor: string;
  showSupport: boolean;
  supportEmail: string;
  supportPhone: string;
}

export interface LicensePayload {
  website_id: string;
  public_id: string;
  client_id: string;
  website_name: string;
  status: string;
  access_status: string;
  license_valid: boolean;
  validity_start: string | null;
  validity_end: string | null;
  renewal_amount_paise: number;
  currency: string;
  renewal_quote_id: string | null;
  suspension: RenewalScreenConfig | null;
  issued_at: number;
  expires_at: number;
}

export interface LicenseContextData {
  credential: {
    id: string;
    publicId: string;
    websiteId: string;
  };
  website: {
    id: string;
    publicId: string;
    clientId: string;
    name: string;
    status: string;
  };
  client: {
    id: string;
    name: string;
    mobile: string | null;
    whatsappNumber: string | null;
  } | null;
  amc: {
    id: string;
    enabled: boolean;
    exempt: boolean;
    originalPricePaise: number;
    renewalPricePaise: number;
    negotiatedPricePaise: number | null;
    billingPeriodDays: number;
    upcomingThresholdDays: number;
    gracePeriodDays: number;
    validityStart: string | null;
    validityEnd: string | null;
    lastRenewalDate: string | null;
    nextExpiryDate: string | null;
    status: string;
    accessStatus: string;
    suspensionReason: string | null;
    suspendedAt: string | null;
  } | null;
  websiteSettings: {
    customSuspensionTitle: string | null;
    customSuspensionBody: string | null;
  } | null;
  quote: {
    id: string;
    amountPaise: number;
    originalAmountPaise: number;
    discountPaise: number;
    quoteExpiryDate: string | null;
    quoteType: string;
  } | null;
  settings: AppSettings;
  businessDate: string;
  statusResult: AmcStatusResult;
  amountPaise: number;
  accessStatus: AccessStatus;
}

type FindResult =
  | { ok: true; data: LicenseContextData }
  | { ok: false; error: string; code: number };

export async function findLicenseContext(
  client: SupabaseClient,
  publicId: string,
  secret: string,
  businessDate: string = todayIST()
): Promise<FindResult> {
  const { data: credentialRow, error } = await client
    .from("license_credentials")
    .select("id, website_id, public_id, secret_hash, is_active")
    .eq("public_id", publicId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "License service unavailable", code: 503 };
  }
  if (!credentialRow) {
    return { ok: false, error: "Invalid website credentials", code: 401 };
  }

  const secretMatches = await bcrypt.compare(secret, credentialRow.secret_hash);
  if (!secretMatches) {
    return { ok: false, error: "Invalid website credentials", code: 401 };
  }

  const { data: website } = await client
    .from("websites")
    .select("id, public_id, client_id, name, status")
    .eq("id", credentialRow.website_id)
    .maybeSingle();

  if (!website) {
    return { ok: false, error: "Website not found", code: 500 };
  }

  const { data: websiteClient } = website.client_id
    ? await client.from("clients").select("id, name, mobile, whatsapp_number").eq("id", website.client_id).maybeSingle()
    : { data: null };

  const [{ data: amcRow }, { data: settingsRow }] = await Promise.all([
    client.from("amc_contracts").select("*").eq("website_id", website.id).maybeSingle(),
    client.from("website_settings").select("*").eq("website_id", website.id).maybeSingle(),
  ]);

  const amc = amcRow ?? null;

  let quote: LicenseContextData["quote"] = null;
  if (amc) {
    const { data: quoteRows } = await client
      .from("renewal_quotes")
      .select("id, amount_paise, original_amount_paise, discount_paise, quote_expiry_date, quote_type")
      .eq("website_id", website.id)
      .eq("status", "active")
      .lte("effective_date", businessDate)
      .order("created_at", { ascending: false })
      .limit(5);

    const validQuote = (quoteRows ?? []).find(
      (q) => !q.quote_expiry_date || q.quote_expiry_date >= businessDate
    );
    if (validQuote) {
      quote = {
        id: validQuote.id,
        amountPaise: Number(validQuote.amount_paise),
        originalAmountPaise: Number(validQuote.original_amount_paise),
        discountPaise: Number(validQuote.discount_paise),
        quoteExpiryDate: validQuote.quote_expiry_date ?? null,
        quoteType: validQuote.quote_type,
      };
    }
  }

  const settings = await getAppSettings(client);

  const statusResult = computeAmcStatus({
    enabled: amc?.enabled ?? false,
    exempt: amc?.exempt ?? false,
    validityEnd: amc?.validity_end ?? null,
    businessDate,
    upcomingThresholdDays: amc?.upcoming_threshold_days ?? settings.amc.upcomingThresholdDays,
    gracePeriodDays: amc?.grace_period_days ?? settings.amc.gracePeriodDays,
  });

  const quoteAmount = computeQuoteAmount({
    renewalPricePaise: amc?.renewal_price_paise ?? 0,
    negotiatedPricePaise: amc?.negotiated_price_paise ?? null,
    negotiatedPriceExpiry: quote?.quoteExpiryDate ?? null,
    businessDate,
  });

  const accessStatus: AccessStatus =
    website.status === "archived"
      ? "archived"
      : amc?.access_status === "manual_suspended"
        ? "manual_suspended"
        : amc?.access_status === "suspended"
          ? "suspended"
          : "active";

  return {
    ok: true,
    data: {
      credential: {
        id: credentialRow.id,
        publicId: credentialRow.public_id,
        websiteId: credentialRow.website_id,
      },
      website: {
        id: website.id,
        publicId: website.public_id,
        clientId: website.client_id,
        name: website.name,
        status: website.status,
      },
      client: websiteClient
        ? {
            id: websiteClient.id,
            name: websiteClient.name,
            mobile: websiteClient.mobile ?? null,
            whatsappNumber: websiteClient.whatsapp_number ?? null,
          }
        : null,
      amc: amc
        ? {
            id: amc.id,
            enabled: amc.enabled,
            exempt: amc.exempt,
            originalPricePaise: Number(amc.original_price_paise),
            renewalPricePaise: Number(amc.renewal_price_paise),
            negotiatedPricePaise:
              amc.negotiated_price_paise === null ? null : Number(amc.negotiated_price_paise),
            billingPeriodDays: amc.billing_period_days,
            upcomingThresholdDays: amc.upcoming_threshold_days,
            gracePeriodDays: amc.grace_period_days,
            validityStart: amc.validity_start,
            validityEnd: amc.validity_end,
            lastRenewalDate: amc.last_renewal_date,
            nextExpiryDate: amc.next_expiry_date,
            status: amc.status,
            accessStatus: amc.access_status,
            suspensionReason: amc.suspension_reason,
            suspendedAt: amc.suspended_at,
          }
        : null,
      websiteSettings: settingsRow
        ? {
            customSuspensionTitle: settingsRow.custom_suspension_title ?? null,
            customSuspensionBody: settingsRow.custom_suspension_body ?? null,
          }
        : null,
      quote,
      settings,
      businessDate,
      statusResult,
      amountPaise: quoteAmount.amountPaise,
      accessStatus,
    },
  };
}

export function buildRenewalScreenConfig(ctx: LicenseContextData): RenewalScreenConfig {
  const base = ctx.settings.renewalScreen;
  return {
    heading: ctx.websiteSettings?.customSuspensionTitle || base.heading,
    description: ctx.websiteSettings?.customSuspensionBody || base.description,
    buttonText: base.buttonText,
    supportText: base.supportText,
    logoUrl: base.logoUrl,
    background: base.background,
    textColor: base.textColor,
    buttonColor: base.buttonColor,
    showSupport: base.showSupport,
    supportEmail: base.supportEmail,
    supportPhone: base.supportPhone,
  };
}

export function buildLicensePayload(ctx: LicenseContextData): LicensePayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    website_id: ctx.website.id,
    public_id: ctx.website.publicId,
    client_id: ctx.website.clientId,
    website_name: ctx.website.name,
    status: ctx.statusResult.status,
    access_status: ctx.accessStatus,
    license_valid: ctx.accessStatus === "active",
    validity_start: ctx.amc?.validityStart ?? null,
    validity_end: ctx.amc?.validityEnd ?? null,
    renewal_amount_paise: ctx.amountPaise,
    currency: ctx.settings.general.currency,
    renewal_quote_id: ctx.quote?.id ?? null,
    suspension: buildRenewalScreenConfig(ctx),
    issued_at: now,
    expires_at: now + config.license.responseTtlSeconds,
  };
}

export function signLicensePayload(payload: LicensePayload): string {
  return signPayload(payload as unknown as Record<string, unknown>, config.license.signingSecret);
}

export function verifyLicenseToken(token: string):
  | { valid: true; payload: LicensePayload }
  | { valid: false; error: string } {
  return verifySignedPayload<LicensePayload>(token, config.license.signingSecret);
}

export interface CachedLicenseResult {
  ok: boolean;
  payload?: LicensePayload;
  token?: string;
  error?: string;
  cached: boolean;
  context?: LicenseContextData;
}

interface CachedLicenseEntry {
  payload: LicensePayload;
  token: string;
}

export async function verifyLicense(
  client: SupabaseClient,
  publicId: string,
  secret: string
): Promise<CachedLicenseResult> {
  const secretFingerprint = createHash("sha256").update(secret).digest("base64url");
  const cacheKey = `license:verify:${publicId}:${secretFingerprint}`;
  const cacheTtlSeconds = config.license.cacheTtlSeconds;
  const cached = cacheTtlSeconds > 0 ? cacheGet<CachedLicenseEntry>(cacheKey) : null;
  if (cached) {
    return { ok: true, payload: cached.payload, token: cached.token, cached: true };
  }

  const context = await findLicenseContext(client, publicId, secret);
  if (!context.ok) {
    return { ok: false, error: context.error, cached: false };
  }

  const payload = buildLicensePayload(context.data);
  const token = signLicensePayload(payload);
  if (cacheTtlSeconds > 0) {
    cacheSet(cacheKey, { payload, token }, cacheTtlSeconds);
  }

  return { ok: true, payload, token, cached: false, context: context.data };
}

export function invalidateLicenseCache(publicId?: string): void {
  if (publicId) {
    cacheDelete(`license:verify:${publicId}`);
  } else {
    cacheInvalidatePrefix("license:verify:");
  }
}

export async function getRenewalScreenConfig(
  client: SupabaseClient,
  websiteId?: string | null
): Promise<RenewalScreenConfig> {
  const settings = await getAppSettings(client);
  const base = settings.renewalScreen;
  if (!websiteId) return base;

  const { data } = await client
    .from("website_settings")
    .select("custom_suspension_title, custom_suspension_body")
    .eq("website_id", websiteId)
    .maybeSingle();

  return {
    ...base,
    heading: data?.custom_suspension_title || base.heading,
    description: data?.custom_suspension_body || base.description,
  };
}

/** Build a short-lived signed token for a verified payment session. */
export function buildPaymentSessionToken(input: {
  websiteId: string;
  quoteId: string | null;
  orderId: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  return signPayload(
    {
      website_id: input.websiteId,
      quote_id: input.quoteId,
      order_id: input.orderId,
      iat: now,
      exp: now + 1800,
      kind: "payment_session",
    },
    config.license.signingSecret
  );
}
