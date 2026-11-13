import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayIST } from "@/lib/dates";
import { getAppSettings } from "@/lib/settings";
import { computeAmcStatus } from "@/lib/amc";

/**
 * Auto-create the default AMC contract for a website once it goes live.
 *
 * Validity defaults to [go-live date → +365 days] (or today if no go-live date).
 * Idempotent: existing contracts are never overwritten.
 */
export async function ensureAmcContract(
  client: SupabaseClient,
  websiteId: string,
  options: { goLiveDate?: string | null; pricePaiseOverride?: number; createdBy?: string } = {}
): Promise<{ created: boolean; contractId: string | null }> {
  const { data: existing } = await client
    .from("amc_contracts")
    .select("id, validity_end")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (existing) return { created: false, contractId: existing.id };

  const settings = await getAppSettings(client);
  const businessDate = todayIST();
  const startDate = options.goLiveDate || businessDate;
  const price = options.pricePaiseOverride && options.pricePaiseOverride > 0
    ? options.pricePaiseOverride
    : settings.amc.defaultAmountPaise > 0
      ? settings.amc.defaultAmountPaise
      : 300000; // ₹3,000 as a safe default; adjustable on the AMC page

  const period = Math.max(1, Math.round(settings.amc.defaultBillingPeriodDays || 365));
  const validityStart = startDate;
  const validityEnd = addDays(startDate, period - 1);

  const statusResult = computeAmcStatus({
    enabled: true,
    exempt: false,
    validityEnd,
    businessDate,
    upcomingThresholdDays: settings.amc.upcomingThresholdDays,
    gracePeriodDays: settings.amc.gracePeriodDays,
  });

  const { data, error } = await client
    .from("amc_contracts")
    .upsert(
      {
        website_id: websiteId,
        enabled: true,
        exempt: false,
        original_price_paise: price,
        renewal_price_paise: price,
        billing_period_days: period,
        upcoming_threshold_days: settings.amc.upcomingThresholdDays,
        grace_period_days: settings.amc.gracePeriodDays,
        validity_start: validityStart,
        validity_end: validityEnd,
        next_expiry_date: validityEnd,
        status: statusResult.status,
        access_status: "active",
        updated_by: options.createdBy ?? "system",
      },
      { onConflict: "website_id" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("[amc-service] failed to create default AMC contract", error);
    return { created: false, contractId: null };
  }

  return { created: true, contractId: data.id };
}
