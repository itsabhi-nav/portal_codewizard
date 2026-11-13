import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Application settings stored in the `application_settings` table as a single
 * JSON document under the key `app_settings`. Secrets never live here.
 */

export interface AppSettings {
  general: {
    agencyName: string;
    logoUrl: string;
    supportEmail: string;
    supportPhone: string;
    websiteUrl: string;
    currency: string;
    timezone: string;
    invoicePrefix: string;
    defaultTheme: "light" | "dark" | "system";
  };
  amc: {
    defaultAmountPaise: number;
    defaultBillingPeriodDays: number;
    upcomingThresholdDays: number;
    gracePeriodDays: number;
    reminderIntervals: number[];
    autoSuspend: boolean;
    autoRemind: boolean;
  };
  renewalScreen: {
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
  };
  whatsapp: {
    defaultCountryCode: string;
    defaultMessage: string;
    reminderIntervals: number[];
  };
  payments: {
    razorpayEnabled: boolean;
    methods: string[];
    taxEnabled: boolean;
    taxRatePercent: number;
    taxLabel: string;
    invoiceNotes: string;
  };
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    agencyName: "CodeWizard",
    logoUrl: "",
    supportEmail: "",
    supportPhone: "",
    websiteUrl: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
    invoicePrefix: "INV",
    defaultTheme: "system",
  },
  amc: {
    defaultAmountPaise: 0,
    defaultBillingPeriodDays: 365,
    upcomingThresholdDays: 10,
    gracePeriodDays: 3,
    reminderIntervals: [30, 15, 7],
    autoSuspend: true,
    autoRemind: true,
  },
  renewalScreen: {
    heading: "Website Temporarily Unavailable",
    description:
      "Your annual website maintenance service has expired. Please complete the renewal payment to restore access.",
    buttonText: "Pay Now",
    supportText: "Please contact your website administrator if you need assistance.",
    logoUrl: "",
    background: "#0b1220",
    textColor: "#ffffff",
    buttonColor: "#2563eb",
    showSupport: true,
    supportEmail: "",
    supportPhone: "",
  },
  whatsapp: {
    defaultCountryCode: "91",
    defaultMessage: "",
    reminderIntervals: [30, 15, 7],
  },
  payments: {
    razorpayEnabled: false,
    methods: ["razorpay", "upi", "bank_transfer", "cash", "other"],
    taxEnabled: false,
    taxRatePercent: 0,
    taxLabel: "",
    invoiceNotes: "",
  },
};

export const APP_SETTINGS_KEY = "app_settings";

function deepMerge<T>(base: T, patch: unknown): T {
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return (patch === undefined ? base : patch) as T;
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const patchObj = (patch ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(patchObj)) {
    const baseValue = result[key];
    const patchValue = patchObj[key];
    if (
      typeof baseValue === "object" &&
      baseValue !== null &&
      !Array.isArray(baseValue) &&
      typeof patchValue === "object" &&
      patchValue !== null &&
      !Array.isArray(patchValue)
    ) {
      result[key] = deepMerge(baseValue, patchValue);
    } else {
      result[key] = patchValue;
    }
  }
  return result as T;
}

export async function getAppSettings(client: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await client
    .from("application_settings")
    .select("value")
    .eq("key", APP_SETTINGS_KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data?.value) return DEFAULT_APP_SETTINGS;
  return deepMerge(DEFAULT_APP_SETTINGS, data.value) as AppSettings;
}

export async function updateAppSettings(
  client: SupabaseClient,
  patch: unknown,
  updatedBy = "admin"
): Promise<AppSettings> {
  const current = await getAppSettings(client);
  const next = deepMerge(current, patch);
  const { error } = await client
    .from("application_settings")
    .upsert(
      { key: APP_SETTINGS_KEY, value: next, updated_at: new Date().toISOString(), updated_by: updatedBy },
      { onConflict: "key" }
    );
  if (error) throw error;
  return next;
}
