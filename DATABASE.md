# Database

Supabase PostgreSQL is the single source of truth. All monetary values are
`bigint` in **integer paise** (1 INR = 100 paise).

## Migrations

| File | Purpose |
| --- | --- |
| `supabase/migrations/0001_init.sql` | Full schema, indexes, constraints, RLS |
| `supabase/migrations/0002_helpers.sql` | Counter sequences and numbering RPCs |
| `supabase/migrations/0003_renewal.sql` | Atomic, idempotent renewal processing |
| `supabase/migrations/0004_simplify.sql` | Website charge columns; drops the Projects module |
| `supabase/migrations/0005_payment_categories.sql` | Simplified payment purposes |

Apply in order:

```bash
supabase db push
# or
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_helpers.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_renewal.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_simplify.sql
psql "$DATABASE_URL" -f supabase/migrations/0005_payment_categories.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

`supabase/setup.sql` is a one-shot full setup (schema + safe seed) for a fresh
database; `scripts/start-local.sh` skips it when the schema already exists.

## Tables

| Table | Purpose |
| --- | --- |
| `clients` | Client master data (soft-deletable via `archived`) |
| `websites` | Permanent UUID + `public_id`, client FK, status, development/domain/hosting charges |
| `website_domains` | Domain history (never loses old domains) |
| `invoices` / `invoice_items` | Invoice header and line items |
| `payments` | Immutable payment ledger (integer paise, simplified categories) |
| `refunds` | Separate immutable refund transactions |
| `amc_contracts` | Per-website AMC configuration and status |
| `amc_periods` | Historical AMC periods (never overwritten) |
| `renewal_quotes` | Negotiated/default quotes with lifecycle status |
| `license_credentials` | Bcrypt-hashed website integration secrets |
| `license_events` | Verification / order / renewal audit |
| `website_settings` | Per-website overrides (WhatsApp, suspension copy) |
| `notification_templates` | Editable WhatsApp templates |
| `notification_logs` | Reminder history and dedup keys |
| `razorpay_orders` | Razorpay order reconciliation |
| `razorpay_webhook_events` | Idempotent webhook ledger (`event_id` unique) |
| `cron_execution_logs` | Daily job history and counts |
| `activity_logs` | Immutable audit trail |
| `admin_notifications` | In-app admin notification feed |
| `login_attempts` | Durable login rate-limit audit |
| `application_settings` | JSON key/value settings |
| `counters` | Atomic document numbering |

## Key constraints

- Website charges: `development_cost_paise`, `domain_charge_paise`,
  `hosting_charge_paise` are `bigint >= 0`; domain/hosting frequencies are
  `one_time` or `annual`.
- Payment purposes: `advance`, `domain`, `amc_hosting`, `final_completion`
  (legacy values remain accepted for old records).
- Foreign keys with `ON DELETE RESTRICT` for financial masters.
- Check constraints on statuses, amounts (`>= 0`), dates
  (`validity_end >= validity_start`), and unique `(amc_contract_id, start_date)`.
- `payments.razorpay_payment_id` unique — prevents duplicate payment records.
- `razorpay_webhook_events.event_id` unique — idempotent webhook processing.
- `renewal_quotes` lifecycle prevents double-using a quote.

## Row Level Security

RLS is enabled on **every** table. There are deliberately **no** policies for
`anon` or `authenticated` roles — all access is denied by default. The
application uses the **service role** from server-side code only, which bypasses
RLS. This is intentional and documented in [SECURITY.md](./SECURITY.md). The
setup script and final migration grant database privileges to `service_role`
only, revoke direct function execution from `PUBLIC`, `anon`, and
`authenticated`, and therefore work when automatic Data API table exposure is
disabled.

## Numbering

- Invoice: `INV-2026-0001` via `next_invoice_number(prefix, year)`.
- Client: `CLI-00001` via `next_document_number`.
- Payment: `PAY-<random>`, Refund: `RFD-<random>`.
- Website public ID: `cw_<10 unambiguous chars>` (non-secret).

## Backup and recovery

Supabase hosted:

```bash
# Automated daily backups are included on paid plans.
# Manual logical backup:
pg_dump "$DATABASE_URL" --format=custom --file=codewizard-$(date +%F).dump

# Restore:
pg_restore --dbname="$DATABASE_URL" codewizard-2026-01-01.dump
```

Self-hosted / Docker:

```bash
docker exec codewizard-postgres pg_dump -U postgres postgres \
  --format=custom > codewizard-backup.dump
docker exec -i codewizard-postgres pg_restore -U postgres -d postgres \
  < codewizard-backup.dump
```

Recommended: daily automated backups, point-in-time recovery enabled, and a
quarterly restore drill. Always back up before migrating.

## Seed data

- `supabase/seed.sql` — settings + WhatsApp templates only. Safe.
- `supabase/seed-demo.sql` — fake business records. **Never in production.**
