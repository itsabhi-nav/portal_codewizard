# Security

## 1. Secret management

| Secret | Where it lives | Exposure |
| --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Server env only | Never sent to browser |
| `ADMIN_SESSION_SECRET` | Server env only | Signs session cookies |
| `SUPABASE_SERVICE_ROLE_KEY` | Server env only | Bypasses RLS; never in browser |
| `RAZORPAY_KEY_SECRET` | Server env only | Used for signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | Server env only | Webhook signature verification |
| `LICENSE_SIGNING_SECRET` | Server env only | Signs license responses |
| `CODEWIZARD_WEBSITE_SECRET` | Client website server env only | Integration credential |
| `CRON_SECRET` | Server env + scheduler | Protects the cron endpoint |

Rules:

- No `NEXT_PUBLIC_` prefix for any secret.
- Never log complete secrets, passwords or credentials.
- Rotate secrets by redeploying with new values.
- Supabase anon key is public by design and has no table access (RLS denies all).

---

## 2. Authentication

- Admin credentials come from the environment; there is no public registration.
- Passwords are verified with **bcrypt** (cost 10). The `.env` password is hashed
  at runtime; no plaintext admin credentials are stored in the database.
- Sessions are HMAC-signed, HTTP-only cookies with `SameSite=Lax`, `Secure` in
  production, and a configurable TTL (default 12 hours).
- Login is rate limited per IP (in-memory) and audited durably in
  `login_attempts`.
- Failed attempts, successful logins and logouts are written to the activity
  log.
- Logout deletes the cookie server-side.

## 3. Authorization

- Every `/api/admin/*` route calls `requireAdmin()` independently.
- The edge middleware is a coarse redirect gate only — it is **not** the
  security boundary.
- Server components verify the session before rendering admin data.
- License endpoints authenticate the website with `public_id` + secret.
- The cron endpoint requires `CRON_SECRET`.
- The webhook endpoint requires a valid Razorpay signature.

## 4. Row Level Security

- RLS is enabled on every table.
- There are **no** policies for `anon` or `authenticated` roles, so all direct
  client access is denied by default.
- The admin portal and license engine use the **service role** from server-side
  code only, which bypasses RLS.
- This means database credentials are powerful: the service role key must never
  be exposed to the browser or committed to Git.

## 5. Input validation and output safety

- All request bodies are validated with Zod schemas.
- Amounts are parsed to **integer paise**; floating-point currency arithmetic is
  never used.
- SQL is parameterised through Supabase JS (no string concatenation).
- Errors are returned as structured JSON without leaking stack traces or
  secrets.

## 6. CSRF and request protection

- Mutating admin requests are checked against the `Origin` header when present.
- Session cookies are `SameSite=Lax`.
- The app sets security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, and `X-Powered-By` is disabled.

## 7. Payment security

- Orders are created **server-side** with the authoritative amount.
- Client-submitted amounts are ignored.
- Checkout signatures are verified with HMAC against the Razorpay secret.
- Webhook signatures are verified against the **raw** request body.
- Payments are fetched from Razorpay server-side before activation.
- Duplicate webhook events are ignored via a unique `event_id`.
- The renewal RPC is idempotent: the same payment can never create two periods.
- No card data is stored — Razorpay Checkout handles all card input.

## 8. License response security

- Responses are HMAC-SHA256 signed with `LICENSE_SIGNING_SECRET`.
- Signatures are compared with `crypto.timingSafeEqual`.
- Responses include `issued_at` and `expires_at`; expired responses are
  rejected.
- The signing secret is never included in the payload or sent to browsers.
- License verification requires the bcrypt-hashed website secret.

## 9. Fail-safe behaviour

- A license API outage is **never** interpreted as AMC expiry.
- Previously verified valid licenses may continue for up to
  `LICENSE_OFFLINE_GRACE_SECONDS`.
- Expired or revoked licenses are never granted indefinite access.
- Default is fail-closed for unverified visitors.
- A database failure never produces a false successful payment.

## 10. Audit logging

`activity_logs` records:

- Client/website creation and updates, including development/domain/hosting
  charges and AMC pricing
- Domain changes
- Invoice creation
- Payment success/failure and refunds
- AMC configuration, price changes, negotiated prices, renewals
- Expiry, suspension (automatic and manual), reactivation
- License exemption, credential rotation
- Cron executions and webhook failures
- Settings changes, admin logins/logouts/failures

Financial and security logs are append-only by design (no update/delete API).

## 11. Rate limiting

- Login: 8 attempts per 15 minutes per IP (in-memory) plus durable DB audit.
- The cron endpoint is secret-protected.
- For multi-instance production deployments, move the login limiter behind a
  shared store or edge rate-limit service.

## 12. Secret rotation guide

1. Generate a new secret.
2. Update the environment variable and redeploy.
3. For `LICENSE_SIGNING_SECRET`: all client websites will re-verify on their
   next request; old cached tokens become invalid immediately.
4. For website credentials: rotate from **Website detail → License
   Configuration → Rotate Secret**, then update the client website's
   `CODEWIZARD_WEBSITE_SECRET` and redeploy it.
5. For Razorpay keys: update `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` and
   redeploy. Webhook secrets are updated in the Razorpay dashboard.
6. For Supabase service role: rotate in Supabase → API keys and redeploy.

## 13. Deployment checklist

- [ ] All `.env` files are gitignored.
- [ ] `RAZORPAY_ENABLED` is `false` until go-live.
- [ ] Webhook URL uses HTTPS.
- [ ] `CRON_SECRET` is set and the scheduler is configured.
- [ ] RLS is enabled on all tables.
- [ ] Daily backups are enabled.
- [ ] Admin password is strong and unique.
- [ ] License signing secret is long and random.
- [ ] Client website secrets are never `NEXT_PUBLIC_`.
