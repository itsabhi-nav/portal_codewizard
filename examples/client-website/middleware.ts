import { createLicenseMiddleware } from "@codewizard/license/middleware";

/**
 * Coarse edge gate. Suspended visitors are redirected to /renew.
 * Authoritative verification happens on the server (renewal page + APIs).
 */
export const middleware = createLicenseMiddleware({
  renewalPath: "/renew",
  excludedPaths: ["/api/public"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
