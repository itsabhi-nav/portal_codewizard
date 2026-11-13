# Example client website integration

A minimal Next.js client website wired to the CodeWizard license engine.

## Files

```
middleware.ts                                         # coarse gate → /renew
app/renew/page.tsx                                   # <LicenseSuspended />
app/api/codewizard/license/route.ts                  # config proxy
app/api/codewizard/license/renewal/create-order/route.ts
app/api/codewizard/license/renewal/verify/route.ts
.env.example
```

## Setup

1. Copy `@codewizard/license` into this project (or link it as a workspace
   package) and install its peer dependencies (`next`, `react`).
2. Copy `.env.example` to `.env.local` and fill in the credentials from the
   CodeWizard admin portal (Website detail → License Configuration).
3. Add your own protected pages/routes and guard them with `requireLicense()`
   or `withLicenseProtected()` from `@codewizard/license/server`.
4. Run `npm run dev` and open a protected route. When the website is suspended
   you will be redirected to `/renew`.

The secret is only read on the server. The browser never sees it.
