import type { LicenseConfig } from "./types";

/**
 * Reads client-website configuration from server-side environment variables.
 * Never prefix CODEWIZARD_WEBSITE_SECRET with NEXT_PUBLIC_.
 */
export function getLicenseConfig(): LicenseConfig {
  const apiUrl = process.env.CODEWIZARD_API_URL || "";
  const websiteId = process.env.CODEWIZARD_WEBSITE_ID || "";
  const websiteSecret = process.env.CODEWIZARD_WEBSITE_SECRET || "";

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    websiteId,
    websiteSecret,
    cacheTtlSeconds: Number(process.env.CODEWIZARD_CACHE_TTL || 0),
    offlineGraceSeconds: Number(process.env.CODEWIZARD_OFFLINE_GRACE_SECONDS || 86400),
    failClosed: process.env.CODEWIZARD_FAIL_CLOSED !== "false",
  };
}

export function assertConfig(config: LicenseConfig): void {
  if (!config.apiUrl) throw new Error("CODEWIZARD_API_URL is required");
  if (!config.websiteId) throw new Error("CODEWIZARD_WEBSITE_ID is required");
  if (!config.websiteSecret) throw new Error("CODEWIZARD_WEBSITE_SECRET is required");
}

/** Paths that must remain accessible while a website is suspended. */
export const DEFAULT_EXCLUDED_PATHS = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/renew",
  "/api/license",
  "/api/webhooks",
  "/health",
];

export function isPathExcluded(pathname: string, extra: string[] = []): boolean {
  const all = [...DEFAULT_EXCLUDED_PATHS, ...extra];
  return all.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
