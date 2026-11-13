# CodeWizard Agency Management & AMC Platform

A production-oriented, single-repository Next.js application for running a web
development agency: clients, websites, development/domain/hosting charges,
invoicing, annual maintenance contracts (AMC), automatic expiry/suspension,
Razorpay renewals and a reusable licensing engine for client websites.

> **One entry, everything.** A client and their website are created together
> with development cost, domain charge and combined AMC & hosting charge. There
> is no separate Projects module.

> **One app, two logical parts.** The admin portal and the license engine live
> in the same Next.js project and share one Supabase PostgreSQL database.

---

## Feature map

| Module | What it does |
| --- | --- |
| Dashboard | Real revenue, outstanding, AMC and status metrics + charts |
| Clients & Websites | One Add Entry flow: client + website + dev/domain/AMC & hosting charges, status |
| Payments & Finance | Integer-paise ledger, categories (advance/domain/AMC & hosting/final), receipts |
| Invoices | Numbered invoices, line items, tax, PDF; auto-generated paid invoice on payment |
| AMC & Renewals | Per-site pricing, negotiated quotes, expiry, grace, suspension |
| Transactions | Razorpay order / payment / webhook reconciliation |
| Activity Logs | Immutable audit trail |
| Settings | Agency, AMC defaults, renewal screen, WhatsApp templates, system health |
| License Engine | Signed license responses, caching, suspension screen, renewal flow |
| Cron | Daily 1:00 AM IST AMC check, idempotent, manual trigger |

The UI is responsive: phones get compact card lists and swipeable action rows
instead of horizontally clipped tables.

---

## Technology stack

- **Next.js 15 (App Router)** + React 19 + TypeScript (strict)
- Tailwind CSS + shadcn-style UI + Recharts + Lucide
- Supabase PostgreSQL (`@supabase/supabase-js`, service role server-side)
- Razorpay Checkout + Orders API + webhooks
- Zod validation, React Hook Form, date-fns, pdfkit
- Vitest for unit/integration tests

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system design.

---

## Quick start

**Option A — fully local (no hosted Supabase, recommended for trying it out):**

```bash
bash scripts/start-local.sh    # Postgres + PostgREST + proxy + Next.js
# open http://localhost:3200 — login: admin / CodeWizard@2026
```

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md).

**Option B — hosted Supabase:**

```bash
cd codewizard
npm install
cp .env.example .env.local     # fill in the values
npm run db:up                  # optional: local Supabase stack (Docker)
npm run dev                    # http://localhost:3000
```

Then open http://localhost:3000 and sign in with `ADMIN_USERNAME` /
`ADMIN_PASSWORD`. See [DEPLOYMENT.md](./DEPLOYMENT.md).

### Minimal `.env.local`

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<a strong password>
ADMIN_SESSION_SECRET=<openssl rand -hex 32>

NEXT_PUBLIC_SUPABASE_URL=<your project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>

LICENSE_SIGNING_SECRET=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 32>

# Optional for online payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_ENABLED=false
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full setup guide.

---

## Database setup

Migrations live in [`supabase/migrations`](./supabase/migrations):

```bash
supabase db push          # hosted Supabase
# or
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_helpers.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_renewal.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_simplify.sql
psql "$DATABASE_URL" -f supabase/migrations/0005_payment_categories.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

Or apply the whole schema in one shot with `supabase/setup.sql`
(`bash scripts/start-local.sh` does this automatically for a fresh local DB).

`supabase/seed.sql` contains safe defaults only (settings + WhatsApp
templates). `supabase/seed-demo.sql` contains fake business records and must
**never** be applied to production.

See [DATABASE.md](./DATABASE.md).

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Start the production server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run Vitest suite |
| `npm run db:up` | Start the local Supabase Docker stack |
| `npm run db:migrate` | Push migrations to a hosted Supabase project |
| `bash scripts/start-local.sh` | Full local stack (Postgres + PostgREST + proxy + Next.js) |
| `bash scripts/stop-local.sh` | Stop the local stack |

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design and data flow
- [DATABASE.md](./DATABASE.md) — schema, RLS, migrations, backup
- [API.md](./API.md) — every endpoint with request/response contracts
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Supabase, Razorpay, cron, Netlify, admin login
- [CLIENT-WEBSITE-INTEGRATION.md](./CLIENT-WEBSITE-INTEGRATION.md) — integrate a client Next.js site
- [PAYMENT-FLOW.md](./PAYMENT-FLOW.md) — renewal payment lifecycle
- [SECURITY.md](./SECURITY.md) — security model and hardening

---

## Status

The application is complete end-to-end: admin portal, database, licensing
engine, cron automation, Razorpay integration, tests and documentation. Payment
activation requires real Razorpay credentials (test mode works out of the box
once keys are supplied and `RAZORPAY_ENABLED=true`).
