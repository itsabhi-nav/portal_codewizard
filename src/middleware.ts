import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";

/**
 * Edge middleware for coarse admin route protection.
 *
 * The authoritative authentication check happens on the server (layout + every
 * API route). This middleware only redirects to the login page when the admin
 * session cookie is entirely absent, which avoids rendering the admin shell
 * for logged-out visitors.
 *
 * Note: Edge middleware cannot verify the HMAC signature because Node's crypto
 * module is unavailable here. Do not treat this as the security boundary.
 */
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
  // These endpoints authenticate with their own credentials (website secret,
  // Razorpay webhook signature, CRON_SECRET) and must not require an admin
  // session cookie.
  "/api/license",
  "/api/webhooks",
  "/api/cron",
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_PROTECTED_PREFIXES = ["/api/admin", "/api/auth"];

/**
 * CSRF check for browser-facing mutating requests.
 * Public license/webhook/cron endpoints use their own credentials and are
 * intentionally excluded.
 */
function csrfRejected(request: NextRequest): boolean {
  if (!MUTATING_METHODS.has(request.method)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }

  const host = request.headers.get("host");
  if (host && host === originHost) return false;

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      if (new URL(appUrl).host === originHost) return false;
    } catch {
      // ignore invalid configured URL
    }
  }

  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  if (
    CSRF_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    csrfRejected(request)
  ) {
    return NextResponse.json(
      { success: false, error: { message: "Cross-origin request rejected", details: null } },
      { status: 403 }
    );
  }

  const hasSession = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  // API routes return 401 JSON; pages redirect to login.
  if (pathname.startsWith("/api/")) {
    if (!hasSession) {
      return NextResponse.json(
        { success: false, error: { message: "Authentication required", details: null } },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
