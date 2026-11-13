# Deployment Guide

## 1. Prerequisites

- Node.js 20.9+ (Node 24 recommended)
- A Supabase project (hosted or self-hosted)
- A Razorpay account (test mode is fine to start)
- A scheduler for the daily cron (Supabase Cron, Netlify Cron, Vercel Cron, or
  any external HTTP scheduler)

---

## 2. Environment configuration

Copy `.env.example` to `.env.local` and fill in every value.

```bash
cp .env.example .env.local
```

### Required values

| Variable | Where to obtain |
| --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | You choose these. |
| `ADMIN_SESSION_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (keep secret) |
| `LICENSE_SIGNING_SECRET` | `openssl rand -hex 32` |
| `CRON_SECRET` | `openssl rand -hex 32` |

### Optional values

| Variable | Purpose |
| --- | --- |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Online renewals |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification |
| `RAZORPAY_ENABLED=true` | Turns on payment processing |
| `SUPPORT_EMAIL` / `SUPPORT_PHONE` | Renewal screen support contact |
| `WHATSAPP_BASE_URL` | Defaults to `https://wa.me/` |

> Changing environment credentials requires a redeploy/restart. Credentials are
> read at request time, not baked into the client bundle.

---

## 3. Supabase setup

### Hosted Supabase

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run the migrations in order:
   `0001_init.sql`, `0002_helpers.sql`, `0003_renewal.sql`,
   `0004_simplify.sql`, `0005_payment_categories.sql`.
   (Or run `supabase/setup.sql` once — it contains the full schema + safe seed.)
3. Run `supabase/seed.sql` (safe defaults) if you used the migrations.
4. Copy the URL and keys from **Project Settings → API**.
5. (Optional) Enable point-in-time recovery and daily backups.

### Local Supabase (Docker)

```bash
npm run db:up
# Apply migrations with psql or supabase CLI, then:
psql "postgresql://postgres:super-secret-postgres-password@localhost:54322/postgres" \
  -f supabase/migrations/0001_init.sql
psql "postgresql://postgres:super-secret-postgres-password@localhost:54322/postgres" \
  -f supabase/migrations/0002_helpers.sql
psql "postgresql://postgres:super-secret-postgres-password@localhost:54322/postgres" \
  -f supabase/migrations/0003_renewal.sql
psql "postgresql://postgres:super-secret-postgres-password@localhost:54322/postgres" \
  -f supabase/migrations/0004_simplify.sql
psql "postgresql://postgres:super-secret-postgres-password@localhost:54322/postgres" \
  -f supabase/migrations/0005_payment_categories.sql
psql "postgresql://postgres:super-secret-postgres-password@localhost:54322/postgres" \
  -f supabase/seed.sql
```

Then set `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` and use the anon /
service role keys from Supabase Studio (`http://localhost:54323`).

> The Docker stack is for development only. For production use hosted Supabase
> or a properly backed-up self-managed Postgres.

---

## 4. Razorpay setup

1. Sign in at <https://dashboard.razorpay.com>.
2. **Settings → API Keys** → generate test keys first.
3. Paste `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. **Settings → Webhooks** → add:
   - URL: `https://<your-domain>/api/webhooks/razorpay`
   - Secret: generate and paste into `RAZORPAY_WEBHOOK_SECRET`.
   - Events: `payment.captured`, `payment.failed`, `refund.processed`.
5. Set `RAZORPAY_ENABLED=true`.
6. Test with Razorpay test cards/UPI. Switch to live keys only when ready.

> The webhook must be reachable from the public internet. For local testing use
> a tunnel (ngrok/Cloudflare Tunnel) and point the webhook at the tunnel URL.

---

## 5. Cron configuration

The daily job runs at **1:00 AM Asia/Kolkata** and is idempotent.

### Supabase Cron

```sql
select cron.schedule(
  'codewizard-amc-check',
  '0 1 * * *',
  $$
    select net.http_post(
      url := 'https://<your-domain>/api/cron/amc-check',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

### Netlify Cron / Vercel Cron / external scheduler

Configure an HTTP POST to `/api/cron/amc-check` with header
`Authorization: Bearer <CRON_SECRET>` at `0 1 * * *` in the `Asia/Kolkata`
timezone (cron expressions are evaluated in UTC by most schedulers — adjust
accordingly; 1:00 AM IST = 19:30 UTC previous day).

### Manual run

Settings → System Health → **Run AMC Check Now** (admin only), or:

```bash
curl -X POST https://<your-domain>/api/admin/cron/run \
  -H "Cookie: codewizard_admin_session=<session>"
```

---

## 6. Netlify deployment

1. Push the repository to GitHub.
2. Netlify → **Add new site → Import from Git**.
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Node version: 20+
4. Add all environment variables under **Site settings → Environment**.
5. Deploy.

Netlify supports Next.js server components and route handlers via the Netlify
Next runtime. The in-memory license cache is per-instance; see
[ARCHITECTURE.md](./ARCHITECTURE.md#5-caching-and-performance) for the shared
cache option.

---

## 7. Admin login

1. Open `https://<your-domain>/login`.
2. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
3. Sessions expire after `ADMIN_SESSION_TTL` (default 12 hours).

There is no public registration. To add more admins in the future, extend the
auth module — do not add a public signup page.

---

## 8. Creating a client and website

1. **Clients & Websites → Add Entry** — one dialog creates the client and the
   website together: name/contact details, domain, development cost, optional
   domain charge, combined AMC & hosting charge, and status. The system
   generates a **license credential**; copy the secret shown once.
2. **Website detail → AMC & Validity → Configure AMC** — adjust the annual
   price, validity dates, threshold and grace period if needed.
3. Integrate the client website (next section).

Recording a payment (advance, domain, AMC & hosting, or final completion)
automatically creates the matching paid invoice; no manual invoice step is
required for the normal flow.

---

## 9. Integrating a client website

See [CLIENT-WEBSITE-INTEGRATION.md](./CLIENT-WEBSITE-INTEGRATION.md).

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Login fails | Wrong env credentials | Check `.env.local` and restart |
| Health shows database unreachable | Supabase URL/key wrong or RLS blocking | Verify keys; service role must be used |
| Renewal screen never appears | Client not integrated or license API blocked | Check `CODEWIZARD_*` env vars and middleware |
| Website not suspended after expiry | Cron not running | Schedule `/api/cron/amc-check` |
| Payment not restoring access | Webhook signature mismatch or amount mismatch | Check `RAZORPAY_WEBHOOK_SECRET` and transaction logs |
| License API returns 401 | Wrong `public_id`/secret | Re-copy the credential from the website detail page |

---

## 11. Backup and recovery

See [DATABASE.md](./DATABASE.md#backup-and-recovery). Recommended: daily backups,
PITR enabled, quarterly restore drills, and always back up before migrations.
