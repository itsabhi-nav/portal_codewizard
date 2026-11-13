/**
 * Server-side environment configuration.
 *
 * IMPORTANT: This module reads server-only secrets. It must NEVER be imported
 * from a Client Component. Only NEXT_PUBLIC_* variables are available in the
 * browser; this file is for the Node.js server runtime.
 */

export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "CodeWizard",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  serverAppUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  timezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  nodeEnv: process.env.NODE_ENV || "development",

  admin: {
    username: process.env.ADMIN_USERNAME || "",
    password: process.env.ADMIN_PASSWORD || "",
    sessionSecret: process.env.ADMIN_SESSION_SECRET || "",
    sessionTtlSeconds: Number(process.env.ADMIN_SESSION_TTL || 43200),
  },

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    enabled: process.env.RAZORPAY_ENABLED === "true",
  },

  cron: {
    secret: process.env.CRON_SECRET || "",
    schedule: process.env.CRON_SCHEDULE || "0 1 * * *",
  },

  license: {
    cacheTtlSeconds: Number(process.env.LICENSE_CACHE_TTL || 0),
    signingSecret: process.env.LICENSE_SIGNING_SECRET || "",
    responseTtlSeconds: Number(process.env.LICENSE_RESPONSE_TTL || 3600),
    offlineGraceSeconds: Number(process.env.LICENSE_OFFLINE_GRACE_SECONDS || 86400),
    failClosed: (process.env.LICENSE_FAIL_CLOSED || "true") !== "false",
  },

  notifications: {
    whatsappBaseUrl: process.env.WHATSAPP_BASE_URL || "https://wa.me/",
    supportEmail: process.env.SUPPORT_EMAIL || "",
    supportPhone: process.env.SUPPORT_PHONE || "",
  },
} as const;

export type AppConfig = typeof config;

/** Returns a list of missing required configuration keys with human guidance. */
export function validateEnvironment(): { valid: boolean; missing: { key: string; message: string }[] } {
  const missing: { key: string; message: string }[] = [];

  if (!config.admin.username) {
    missing.push({ key: "ADMIN_USERNAME", message: "Set the admin login username." });
  }
  if (!config.admin.password) {
    missing.push({ key: "ADMIN_PASSWORD", message: "Set the admin login password." });
  }
  if (!config.admin.sessionSecret || config.admin.sessionSecret.length < 16) {
    missing.push({
      key: "ADMIN_SESSION_SECRET",
      message: "Set a long random string (openssl rand -hex 32) for session signing.",
    });
  }
  if (!config.supabase.url) {
    missing.push({ key: "NEXT_PUBLIC_SUPABASE_URL", message: "Create a Supabase project and paste the project URL." });
  }
  if (!config.supabase.anonKey) {
    missing.push({
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      message: "Paste the Supabase anon public key.",
    });
  }
  if (!config.supabase.serviceRoleKey) {
    missing.push({
      key: "SUPABASE_SERVICE_ROLE_KEY",
      message: "Paste the Supabase service role key (server-side only, keep secret).",
    });
  }
  if (!config.license.signingSecret || config.license.signingSecret.length < 16) {
    missing.push({
      key: "LICENSE_SIGNING_SECRET",
      message: "Set a long random string used to sign license responses.",
    });
  }
  if (!config.cron.secret) {
    missing.push({ key: "CRON_SECRET", message: "Set a random secret to protect the cron endpoint." });
  }

  return { valid: missing.length === 0, missing };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabase.url && config.supabase.serviceRoleKey);
}

export function isRazorpayConfigured(): boolean {
  return Boolean(config.razorpay.keyId && config.razorpay.keySecret);
}

export function isLicenseConfigured(): boolean {
  return Boolean(config.license.signingSecret);
}

export function isProduction(): boolean {
  return config.nodeEnv === "production";
}
