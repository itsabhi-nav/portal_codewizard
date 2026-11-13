# Architecture

## 1. High-level shape

```
                    ┌──────────────────────────────────────────────┐
                    │            CodeWizard (one Next.js app)       │
                    │                                              │
  Admin browser ──► │  Admin Portal (server components + APIs)     │
                    │        │                                     │
  Client website ──►│  License Engine (public APIs + middleware)  │
        │           │        │                                     │
        │           └────────┼─────────────────────────────────────┘
        │                    │ service role (server-side only)
        │                    ▼
        │            ┌──────────────────┐        ┌──────────────────┐
        └──────────► │  Supabase Postgres│◄──────►│  Razorpay        │
                     │  (single source   │        │  (Checkout,      │
                     │   of truth)       │        │   Orders,        │
                     └──────────────────┘        │   Webhooks)      │
                                ▲               └──────────────────┘
                                │                        ▲
                         Daily cron (1:00 AM IST)       │ webhook
                                │                        │
                                └────────────────────────┘
```

There is **one repository and one Next.js application**. The admin portal and
license engine are logical modules separated by route namespace
(`/admin/*` vs `/api/license/*`), not separate deployments.

---

## 2. Request flows

### 2.1 Admin request

1. Browser requests `/admin/...`.
2. Edge middleware redirects to `/login` when the session cookie is absent
   (coarse gate only).
3. `src/app/admin/layout.tsx` verifies the HMAC-signed session server-side and
   redirects to `/login` when invalid or expired.
4. Every `/api/admin/*` route independently calls `requireAdmin()` — the
   middleware is never the security boundary.
5. Server components query Supabase directly with the service role; client
   components call admin APIs for mutations.

### 2.2 License verification (client website)

1. Client website server calls `POST /api/license/verify` with
   `{ public_id, secret }` (or `Authorization: Bearer <secret>`).
2. The license engine:
   - looks up the credential by `public_id`,
   - verifies the bcrypt secret hash,
   - loads the website, client, AMC contract, settings and active quote,
   - computes the AMC business status from the Asia/Kolkata business date,
   - signs a time-limited payload with `LICENSE_SIGNING_SECRET`.
3. The client website validates the signature and either serves the protected
   experience or routes to the renewal screen.
4. Responses are not cached by default. `LICENSE_CACHE_TTL` can enable a
   process-local cache, but it may remain stale on other serverless instances;
   use `0` for immediate status enforcement.

### 2.3 Renewal payment

See [PAYMENT-FLOW.md](./PAYMENT-FLOW.md). Short version:

`create-order → Razorpay Checkout → verify signature → fetch payment →
atomic renewal RPC → invalidate cache → website live`.

---

## 3. Module map

```
src/
  app/
    admin/                 # Admin portal pages (server components)
    api/
      admin/               # Admin CRUD + dashboard + settings APIs
      auth/                # Login / logout / me
      license/             # Public license engine endpoints
      webhooks/razorpay    # Razorpay webhook receiver
      cron/amc-check       # Scheduled AMC job (CRON_SECRET)
      health               # Public health probe
  components/
    ui/                    # shadcn-style primitives
    layout/                # Sidebar, topbar, admin shell
    clients|websites|...   # Feature components
  lib/
    supabase/              # Server/browser clients
    amc.ts                 # Pure AMC business logic (unit tested)
    license.ts             # License context, signing, caching
    cron/amc-check.ts      # Daily automation
    razorpay.ts            # Order/refund/signature helpers
    invoice-service.ts     # Invoice reconciliation
    ...
packages/codewizard-license/  # Reusable integration for client websites
supabase/migrations/          # Versioned SQL schema
```

---

## 4. State model

### 4.1 Business status vs access status

AMC has two independent states:

| State | Values | Meaning |
| --- | --- | --- |
| `amc_contracts.status` | active, upcoming, expired, overdue, suspended, exempt, disabled | Business lifecycle computed from validity dates |
| `amc_contracts.access_status` | active, suspended, manual_suspended, archived | Enforcement state used by the license engine |

Manual suspension sets `access_status = manual_suspended` and is always
distinguishable from automatic AMC suspension (`suspended`).

### 4.2 Validity boundary

- `validity_start` is inclusive.
- `validity_end` is the **final valid date**.
- Expiry begins on the following calendar date.
- `days_remaining = validity_end - business_date`.
  - `>= 0` → valid (`upcoming` when `<= threshold`, else `active`)
  - `< 0` → expired; `overdue` within grace, `suspended` after grace.

### 4.3 Renewal period

- Renew on or before `validity_end`: new start = `validity_end + 1 day`.
- Renew after expiry: new start = agreed effective date.
- New end = start + billing period − 1 day (both inclusive).

---

## 5. Caching and performance

- License response caching is disabled by default (`LICENSE_CACHE_TTL=0`).
- If enabled, the cache is per instance and bound to the credential secret;
  changes may remain stale on other instances until their TTL expires.
- Cache is **never** authoritative — the database is.
- Cache invalidation on an instance is attempted for price/status/config
  changes, payment success, credential rotation and website archive. This
  cannot invalidate a separate serverless instance.
- For multi-instance deployments, leave caching disabled or replace
  `src/lib/cache.ts` with a shared store (Upstash Redis, Netlify Blobs) behind
  the same interface.

### Fail-safe policy

- License API unreachable → the client integration uses the last verified
  response for at most `LICENSE_OFFLINE_GRACE_SECONDS`, and only if the
  license was still valid at that time.
- Expired/revoked licenses are never granted indefinite access.
- Default is fail-closed (`LICENSE_FAIL_CLOSED=true`).
- A license API outage is never interpreted as AMC expiry.

---

## 6. Security architecture

- Admin credentials are environment-configured; passwords verified with bcrypt.
- Sessions are HMAC-signed, HTTP-only, SameSite=Lax cookies with TTL.
- CSRF: `Origin` checked on mutating admin requests.
- Rate limiting: per-IP login limiter + durable `login_attempts` audit.
- RLS enabled on every table; no anon/authenticated policies. The service role
  (server-only) bypasses RLS by design.
- Secrets never reach the browser: no `NEXT_PUBLIC_` prefix for service role,
  Razorpay secret, license signing secret or website integration secret.
- Signed license responses use HMAC-SHA256 with timing-safe comparison.

See [SECURITY.md](./SECURITY.md).

---

## 7. Testing strategy

- `tests/amc.test.ts` — AMC status, renewal periods, quote pricing (leap year,
  month boundary, IST, early/late renewal, manual extension).
- `tests/money.test.ts` — integer-paise arithmetic and INR formatting.
- `tests/signing.test.ts` — HMAC signing, tamper rejection, expiry.
- `tests/whatsapp.test.ts` — number normalization, link building, templates.
- `tests/auth.test.ts` — login success/failure, rate limiting, session cookies.
- `tests/license.test.ts` — payload building, overrides, signed tokens.

Run with `npm test`.
