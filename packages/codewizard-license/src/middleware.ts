import { NextResponse, type NextRequest } from "next/server";
import { isPathExcluded } from "./config";

/**
 * Edge middleware factory.
 *
 * Usage in a client website (Next.js middleware.ts / proxy.ts):
 *
 *   import { createLicenseMiddleware } from "@codewizard/license/middleware";
 *   export const middleware = createLicenseMiddleware({
 *     renewalPath: "/renew",
 *   });
 *   export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
 *
 * The middleware redirects suspended visitors to the renewal path. The
 * renewal page renders <LicenseSuspended /> from this package.
 *
 * The optional verdict cache is process-local and disabled by default so
 * status changes take effect on the next request. The server-side verifier
 * has the same default and may use bounded offline grace during API outages.
 *
 * Note: Edge middleware cannot verify HMAC signatures with Node crypto. The
 * authoritative check happens on the renewal page (server component) and in
 * protected API routes via withLicenseProtected(). Middleware is a fast,
 * coarse gate only.
 */
export interface LicenseMiddlewareOptions {
  renewalPath?: string;
  excludedPaths?: string[];
  /** Optional API token for a lightweight verify call from the edge. */
  apiUrl?: string;
  websiteId?: string;
  websiteSecret?: string;
}

interface VerdictEntry {
  licenseValid: boolean;
  expiresAt: number;
}

/** In-memory verdict cache — bounded by TTL, keyed by website id. */
const verdictCache = new Map<string, VerdictEntry>();

function getEdgeTtlSeconds(): number {
  const value = Number(process.env.CODEWIZARD_EDGE_CACHE_SECONDS ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function cachedVerdict(websiteId: string): boolean | null {
  const hit = verdictCache.get(websiteId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    verdictCache.delete(websiteId);
    return null;
  }
  return hit.licenseValid;
}

function cacheVerdict(websiteId: string, licenseValid: boolean, ttlSeconds: number) {
  if (ttlSeconds <= 0) return;
  verdictCache.set(websiteId, { licenseValid, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function createLicenseMiddleware(options: LicenseMiddlewareOptions = {}) {
  const renewalPath = options.renewalPath ?? "/renew";

  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname === renewalPath || isPathExcluded(pathname, options.excludedPaths)) {
      return NextResponse.next();
    }

    // If credentials are not configured, do not block the site (local dev).
    if (!options.apiUrl || !options.websiteId || !options.websiteSecret) {
      return NextResponse.next();
    }

    // Serve the cached verdict when fresh — no network call at all.
    const cached = cachedVerdict(options.websiteId);
    if (cached !== null) {
      return cached ? NextResponse.next() : withRenewalRedirect(request, renewalPath);
    }

    try {
      const ttlSeconds = getEdgeTtlSeconds();
      const response = await fetch(`${options.apiUrl.replace(/\/$/, "")}/api/license/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: options.websiteId, secret: options.websiteSecret }),
        cache: "no-store",
      });

      if (!response.ok) {
        // License service unavailable: do NOT treat the outage as expiry.
        // Allow the request through; server-side guards handle authority.
        return NextResponse.next();
      }

      const json = (await response.json()) as {
        success: boolean;
        data?: { payload?: { license_valid?: boolean } };
      };

      const licenseValid = Boolean(json.success && json.data?.payload?.license_valid);
      cacheVerdict(options.websiteId, licenseValid, ttlSeconds);

      if (!licenseValid) {
        return withRenewalRedirect(request, renewalPath);
      }
      return NextResponse.next();
    } catch {
      // Network failure must never suspend a live site by itself.
      return NextResponse.next();
    }
  };
}

function withRenewalRedirect(request: NextRequest, renewalPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = renewalPath;
  return NextResponse.redirect(url);
}

/** Test helper: drop all cached verdicts. */
export function clearLicenseEdgeCache() {
  verdictCache.clear();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
