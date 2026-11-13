# Client Website Integration

This guide explains how to connect a client Next.js website to the CodeWizard
license engine. The reusable package lives at
[`packages/codewizard-license`](./packages/codewizard-license).

## Overview

```
Client website (Next.js)
  ├── middleware.ts            → coarse gate, redirects suspended users to /renew
  ├── /renew/page.tsx          → renders <LicenseSuspended />
  ├── /api/codewizard/license/* → local proxies that call CodeWizard server-side
  └── protected routes/APIs    → guarded with withLicenseProtected() / requireLicense()
```

The **secret never reaches the browser**. All verification happens on the
client website's server.

---

## 1. Environment variables

Add to the **client website's** server environment (never `NEXT_PUBLIC_`):

```env
CODEWIZARD_API_URL=https://your-codewizard-app.com
CODEWIZARD_WEBSITE_ID=cw_abc123
CODEWIZARD_WEBSITE_SECRET=cws_••••••••
CODEWIZARD_CACHE_TTL=0
CODEWIZARD_EDGE_CACHE_SECONDS=0
CODEWIZARD_OFFLINE_GRACE_SECONDS=86400
CODEWIZARD_FAIL_CLOSED=true
```

- `CODEWIZARD_WEBSITE_ID` is the **public ID** (not the secret).
- `CODEWIZARD_WEBSITE_SECRET` is server-only. Never expose it with
  `NEXT_PUBLIC_`.
- `CODEWIZARD_FAIL_CLOSED=true` means a license API outage blocks access for
  unverified visitors but never suspends a previously verified license beyond
  the bounded offline grace.

---

## 2. Middleware

```ts
// middleware.ts (or proxy.ts on Next.js 16)
import { createLicenseMiddleware } from "@codewizard/license/middleware";

export const middleware = createLicenseMiddleware({
  renewalPath: "/renew",
  excludedPaths: ["/api/public"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

The middleware is a **fast coarse gate**. It never treats a license API outage
as expiry — if the license service is unreachable, requests pass through and
server-side guards make the authoritative decision.

---

## 3. Local proxy routes (required)

The browser must never call CodeWizard directly with the secret. Create these
routes in the client website:

### `app/api/codewizard/license/route.ts`

```ts
import { NextResponse } from "next/server";
import { verifyLicense } from "@codewizard/license/server";
import { getLicenseConfig } from "@codewizard/license/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await verifyLicense();
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { message: result.error ?? "License unavailable" } },
      { status: 503 }
    );
  }
  const { payload } = result.verification!;
  return NextResponse.json({
    success: true,
    data: {
      payload,
      renewal_amount_paise: payload.renewal_amount_paise,
      currency: payload.currency,
      suspension: payload.suspension,
    },
  });
}
```

### `app/api/codewizard/license/renewal/create-order/route.ts`

```ts
import { NextResponse } from "next/server";
import { getLicenseConfig } from "@codewizard/license/config";

export const dynamic = "force-dynamic";

export async function POST() {
  const config = getLicenseConfig();
  const response = await fetch(`${config.apiUrl}/api/license/renewal/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      public_id: config.websiteId,
      secret: config.websiteSecret,
    }),
    cache: "no-store",
  });
  const json = await response.json();
  return NextResponse.json(json, { status: response.status });
}
```

### `app/api/codewizard/license/renewal/verify/route.ts`

```ts
import { NextResponse } from "next/server";
import { getLicenseConfig } from "@codewizard/license/config";
import { clearLicenseCache } from "@codewizard/license/server";
import { clearLicenseEdgeCache } from "@codewizard/license/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = getLicenseConfig();
  const body = await request.json();
  const response = await fetch(`${config.apiUrl}/api/license/renewal/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      public_id: config.websiteId,
      secret: config.websiteSecret,
      order_id: body.order_id,
      payment_id: body.payment_id,
      signature: body.signature,
    }),
    cache: "no-store",
  });
  const json = await response.json();
  // Payment confirmed — drop local caches so the site opens immediately.
  if (response.ok && json.success) {
    clearLicenseCache();
    clearLicenseEdgeCache();
  }
  return NextResponse.json(json, { status: response.status });
}
```

---

## 4. Renewal screen

```tsx
// app/renew/page.tsx
import { LicenseSuspended } from "@codewizard/license/components";

export const dynamic = "force-dynamic";

export default function RenewPage() {
  return <LicenseSuspended />;
}
```

`LicenseSuspended` is a full-viewport, responsive screen. It fetches the latest
signed config from `/api/codewizard/license`, shows the configured heading,
description, amount and support details, opens Razorpay Checkout, verifies the
payment server-side and reloads on success.

All copy is editable in the CodeWizard admin portal — no redeployment needed.

---

## 5. Protecting routes and APIs

### Server components / route handlers

```ts
import { withLicenseProtected } from "@codewizard/license/server";

export const dynamic = "force-dynamic";

export const GET = withLicenseProtected(async (request, { license }) => {
  // license.payload contains website_id, status, validity, etc.
  return Response.json({ success: true, data: { license } });
});
```

### Server components

```tsx
import { requireLicense } from "@codewizard/license/server";

export default async function ProtectedPage() {
  const license = await requireLicense();
  return <div>Valid until {license.validity_end}</div>;
}
```

### API protection matrix

| Surface | Protection |
| --- | --- |
| Public pages | None (middleware only redirects when suspended) |
| Protected pages | `requireLicense()` in the server component |
| Protected API routes | `withLicenseProtected(handler)` |
| Webhook / payment routes | Excluded from license checks |
| Renewal page | Always accessible |

---

## 6. Renewal flow

1. Suspended visitor hits any protected route.
2. Middleware redirects to `/renew`.
3. `LicenseSuspended` loads the latest config from the local proxy.
4. Visitor clicks **Pay Now**.
5. `create-order` is called on the client's server → CodeWizard creates a
   Razorpay order with the authoritative amount.
6. Razorpay Checkout opens.
7. On success, the handler posts the payment IDs + signature to
   `/api/codewizard/license/renewal/verify`.
8. CodeWizard verifies the signature, fetches the payment, checks the amount and
   atomically creates the AMC period.
9. Enabled local caches are invalidated. With the default zero cache TTLs, the
   next request immediately reads the renewed status.
10. The page reloads and the site is accessible again.

---

## 7. Cache and fail-safe behaviour

Two optional in-memory cache layers are available. Both are disabled by default
so AMC suspensions take effect on the next request, including in serverless
deployments where admin-side invalidation cannot reach every client instance.

| Layer | Where | Default | Controls |
| --- | --- | --- | --- |
| Edge gate (middleware) | `packages/codewizard-license/src/middleware.ts` | Disabled (0) | `CODEWIZARD_EDGE_CACHE_SECONDS` |
| Authoritative verify | `packages/codewizard-license/src/verification.ts` | Disabled (0) | `CODEWIZARD_CACHE_TTL` |

- Set either TTL above zero only if you accept that an instance may continue
  using a previously verified response for up to that TTL after a status change.
  These caches are process-local; admin-side invalidation cannot clear caches
  on separately deployed client websites or other serverless instances.
- The client renewal verification route clears its local caches after payment.
- If CodeWizard is unreachable, a previously verified valid license is used for at most `CODEWIZARD_OFFLINE_GRACE_SECONDS`.
- Expired/revoked licenses are never granted indefinite access.
- `CODEWIZARD_FAIL_CLOSED=true` blocks unverified visitors during an outage.

---

## 8. Environment variables cheat sheet

```env
# Client website
CODEWIZARD_API_URL=https://your-codewizard-app.com
CODEWIZARD_WEBSITE_ID=cw_abc123
CODEWIZARD_WEBSITE_SECRET=cws_••••••••
CODEWIZARD_CACHE_TTL=0
CODEWIZARD_EDGE_CACHE_SECONDS=0
CODEWIZARD_OFFLINE_GRACE_SECONDS=86400
CODEWIZARD_FAIL_CLOSED=true
```

Never prefix `CODEWIZARD_WEBSITE_SECRET` with `NEXT_PUBLIC_`.

---

## 9. Package exports

| Export | Contents |
| --- | --- |
| `@codewizard/license` | Types, config, `verifyLicense` |
| `@codewizard/license/server` | `requireLicense`, `withLicenseProtected`, `validateLicenseToken` |
| `@codewizard/license/middleware` | `createLicenseMiddleware` |
| `@codewizard/license/client` | `useLicenseConfig`, `createRenewalOrder`, `openRazorpayCheckout`, `verifyRenewalPayment` |
| `@codewizard/license/components` | `<LicenseSuspended />` |

See [`packages/codewizard-license/README.md`](./packages/codewizard-license/README.md).
