# @codewizard/license

Reusable license integration for CodeWizard client websites built with Next.js.

It provides:

- Server-side license verification with signed responses
- Bounded caching and a fail-safe offline policy
- Edge middleware that redirects suspended visitors to a renewal screen
- A full-page, configurable suspension / renewal UI
- Razorpay Checkout renewal flow with server-side verification
- Server-side API route protection helpers

> The website secret is **server-side only**. Never expose it with
> `NEXT_PUBLIC_`.

---

## Installation

Copy this folder into the client website (or link it as a workspace package):

```bash
cp -r packages/codewizard-license ../client-website/packages/
```

Then import from `@codewizard/license/*` or a relative path.

---

## Environment variables

```env
CODEWIZARD_API_URL=https://your-codewizard-app.com
CODEWIZARD_WEBSITE_ID=cw_abc123
CODEWIZARD_WEBSITE_SECRET=cws_••••••••
CODEWIZARD_CACHE_TTL=0
CODEWIZARD_EDGE_CACHE_SECONDS=0
CODEWIZARD_OFFLINE_GRACE_SECONDS=86400
CODEWIZARD_FAIL_CLOSED=true
```

---

## Quick integration (5 steps)

### 1. Add the middleware

```ts
// middleware.ts
import { createLicenseMiddleware } from "@codewizard/license/middleware";

export const middleware = createLicenseMiddleware({ renewalPath: "/renew" });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 2. Create the renewal page

```tsx
// app/renew/page.tsx
import { LicenseSuspended } from "@codewizard/license/components";

export const dynamic = "force-dynamic";

export default function RenewPage() {
  return <LicenseSuspended />;
}
```

### 3. Add the local proxy routes

Create `app/api/codewizard/license/route.ts`,
`app/api/codewizard/license/renewal/create-order/route.ts` and
`app/api/codewizard/license/renewal/verify/route.ts`. Full code is in
[CLIENT-WEBSITE-INTEGRATION.md](../../CLIENT-WEBSITE-INTEGRATION.md).

### 4. Protect API routes

```ts
import { withLicenseProtected } from "@codewizard/license/server";

export const GET = withLicenseProtected(async (request, { license }) => {
  return Response.json({ success: true, data: { license } });
});
```

### 5. Protect server components

```tsx
import { requireLicense } from "@codewizard/license/server";

export default async function Page() {
  const license = await requireLicense();
  return <div>Valid until {license.validity_end}</div>;
}
```

---

## API

| Export | Description |
| --- | --- |
| `verifyLicense(options?)` | Fetch and validate the signed license response (optional cache) |
| `clearLicenseCache()` | Clear the in-memory cache |
| `requireLicense()` | Server guard — throws when unverified/suspended |
| `withLicenseProtected(handler)` | Wrap a route handler with license enforcement |
| `validateLicenseToken(token, secret)` | Verify an HMAC-signed license token |
| `createLicenseMiddleware(options)` | Edge middleware factory |
| `useLicenseConfig()` | Client hook for the renewal screen |
| `createRenewalOrder()` | Create a Razorpay renewal order |
| `openRazorpayCheckout(options)` | Open Razorpay Checkout |
| `verifyRenewalPayment(params)` | Verify a completed payment |
| `<LicenseSuspended />` | Full-page renewal screen |

---

## Renewal screen customization

All copy, colors, logo and support details are configured in the CodeWizard
admin portal under **Settings → Renewal Screen** and are fetched dynamically.
No redeployment of the client website is required.

---

## Fail-safe policy

- Edge middleware and server-side verification caches are disabled by default
  (`CODEWIZARD_EDGE_CACHE_SECONDS=0` and `CODEWIZARD_CACHE_TTL=0`) so status
  changes take effect on the next request.
- Setting either cache TTL above zero trades faster requests for potentially
  stale license status on that instance. These in-memory caches cannot be
  invalidated across separate deployments or serverless instances.
- License API unreachable → previously verified valid licenses continue for up
  to `CODEWIZARD_OFFLINE_GRACE_SECONDS`.
- Expired/revoked licenses are never granted indefinite access.
- `CODEWIZARD_FAIL_CLOSED=true` blocks unverified visitors during an outage.
- `clearLicenseCache()` (server) and `clearLicenseEdgeCache()` (middleware) are
  called by the renewal verify proxy after payment.
- The cache is never the source of truth — the CodeWizard database is.

---

## Security notes

- Never expose `CODEWIZARD_WEBSITE_SECRET` to the browser.
- Never trust a client-submitted amount.
- Never activate a license from a frontend callback alone — always verify
  server-side.
- Keep the middleware exclusion list tight: payment, webhook, health and
  renewal routes only.
