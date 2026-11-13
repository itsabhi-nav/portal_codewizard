-- ============================================================================
-- CodeWizard Agency Management & AMC Platform - Initial Schema
-- Supabase PostgreSQL (Postgres 15+)
-- All monetary amounts are stored as BIGINT in integer paise (1 INR = 100 paise).
-- ============================================================================

create extension if not exists pg_trgm;
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- 1. CLIENTS
-- ===========================================================================
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  client_code     text unique not null,
  name            text not null,
  business_name   text,
  contact_person  text,
  mobile          text,                       -- normalized E.164, e.g. +919876543210
  whatsapp_number text,                       -- optional separate WhatsApp number
  email           text,
  address         text,
  city            text,
  state           text,
  pin_code        text,
  notes           text,
  archived        boolean not null default false,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      text
);

create index idx_clients_name on public.clients (name);
create index idx_clients_mobile on public.clients (mobile);
create index idx_clients_business_name on public.clients (business_name);
create index idx_clients_archived on public.clients (archived);
create index idx_clients_name_trgm on public.clients using gin (name gin_trgm_ops);
create index idx_clients_business_name_trgm on public.clients using gin (business_name gin_trgm_ops);

create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 2. WEBSITES
-- ===========================================================================
create table public.websites (
  id                  uuid primary key default gen_random_uuid(),  -- permanent UUID
  public_id           text unique not null,                       -- non-secret public identifier
  client_id           uuid not null references public.clients(id) on delete restrict,
  name                text not null,
  description         text,
  project_start_date  date,
  go_live_date        date,
  development_cost_paise bigint not null default 0 check (development_cost_paise >= 0),
  status              text not null default 'development'
                        check (status in ('development','testing','live','suspended','archived')),
  hosting_provider    text,
  notes               text,
  archived            boolean not null default false,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          text
);

create index idx_websites_client_id on public.websites (client_id);
create index idx_websites_status on public.websites (status);
create index idx_websites_public_id on public.websites (public_id);
create index idx_websites_name_trgm on public.websites using gin (name gin_trgm_ops);

create trigger websites_set_updated_at before update on public.websites
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 3. WEBSITE DOMAINS (history preserved)
-- ===========================================================================
create table public.website_domains (
  id          uuid primary key default gen_random_uuid(),
  website_id  uuid not null references public.websites(id) on delete cascade,
  domain      text not null,
  is_primary  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (website_id, domain)
);

create index idx_website_domains_website_id on public.website_domains (website_id);
create index idx_website_domains_domain on public.website_domains (domain);
create index idx_website_domains_domain_trgm on public.website_domains using gin (domain gin_trgm_ops);

create trigger website_domains_set_updated_at before update on public.website_domains
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 4. PROJECTS
-- ===========================================================================
create table public.projects (
  id                        uuid primary key default gen_random_uuid(),
  project_code              text unique not null,
  client_id                 uuid not null references public.clients(id) on delete restrict,
  website_id                uuid references public.websites(id) on delete set null,
  name                      text not null,
  description               text,
  agreed_cost_paise         bigint not null default 0 check (agreed_cost_paise >= 0),
  advance_paise             bigint not null default 0 check (advance_paise >= 0),
  start_date                date,
  expected_completion_date  date,
  actual_delivery_date      date,
  go_live_date              date,
  status                    text not null default 'not_started'
                              check (status in ('not_started','in_progress','testing','delivered','completed','cancelled')),
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                text
);

create index idx_projects_client_id on public.projects (client_id);
create index idx_projects_website_id on public.projects (website_id);
create index idx_projects_status on public.projects (status);

create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 5. PROJECT MILESTONES
-- ===========================================================================
create table public.project_milestones (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null,
  description  text,
  due_date     date,
  completed_at timestamptz,
  status       text not null default 'pending' check (status in ('pending','in_progress','completed')),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_project_milestones_project_id on public.project_milestones (project_id);

create trigger project_milestones_set_updated_at before update on public.project_milestones
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 6. APPLICATION SETTINGS (key/value JSON)
-- ===========================================================================
create table public.application_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create trigger application_settings_set_updated_at before update on public.application_settings
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 7. INVOICES
-- ===========================================================================
create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  invoice_number      text unique not null,
  client_id           uuid not null references public.clients(id) on delete restrict,
  website_id          uuid references public.websites(id) on delete set null,
  project_id          uuid references public.projects(id) on delete set null,
  invoice_type        text not null default 'development'
                        check (invoice_type in ('development','amc','additional_service','hosting','other')),
  issue_date          date not null,
  due_date            date,
  subtotal_paise      bigint not null default 0 check (subtotal_paise >= 0),
  tax_paise           bigint not null default 0 check (tax_paise >= 0),
  total_paise         bigint not null default 0 check (total_paise >= 0),
  amount_paid_paise   bigint not null default 0 check (amount_paid_paise >= 0),
  status              text not null default 'draft'
                        check (status in ('draft','sent','paid','partially_paid','overdue','cancelled')),
  tax_rate_percent    numeric(5,2) not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          text
);

create index idx_invoices_client_id on public.invoices (client_id);
create index idx_invoices_website_id on public.invoices (website_id);
create index idx_invoices_status on public.invoices (status);
create index idx_invoices_issue_date on public.invoices (issue_date desc);

create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

create table public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.invoices(id) on delete cascade,
  description      text not null,
  quantity         numeric(12,2) not null default 1 check (quantity > 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  amount_paise     bigint not null check (amount_paise >= 0),
  tax_rate_percent numeric(5,2) not null default 0,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create index idx_invoice_items_invoice_id on public.invoice_items (invoice_id);

-- ===========================================================================
-- 8. PAYMENTS
-- ===========================================================================
create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  payment_code          text unique not null,
  client_id             uuid not null references public.clients(id) on delete restrict,
  website_id            uuid references public.websites(id) on delete set null,
  invoice_id            uuid references public.invoices(id) on delete set null,
  project_id            uuid references public.projects(id) on delete set null,
  amount_paise          bigint not null check (amount_paise > 0),
  currency              text not null default 'INR',
  method                text not null default 'other'
                          check (method in ('razorpay','upi','bank_transfer','cash','other')),
  purpose               text not null default 'development'
                          check (purpose in ('development','amc_renewal','additional_development','hosting','other')),
  status                text not null default 'created'
                          check (status in ('created','pending','successful','failed','refunded','partially_refunded')),
  transaction_ref       text,
  razorpay_order_id     text,
  razorpay_payment_id   text unique,
  payment_date          timestamptz,
  notes                 text,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            text
);

create index idx_payments_client_id on public.payments (client_id);
create index idx_payments_website_id on public.payments (website_id);
create index idx_payments_invoice_id on public.payments (invoice_id);
create index idx_payments_status on public.payments (status);
create index idx_payments_payment_date on public.payments (payment_date desc);
create index idx_payments_razorpay_order on public.payments (razorpay_order_id);

create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 9. REFUNDS (immutable separate transactions)
-- ===========================================================================
create table public.refunds (
  id                uuid primary key default gen_random_uuid(),
  refund_code       text unique not null,
  payment_id        uuid not null references public.payments(id) on delete restrict,
  invoice_id        uuid references public.invoices(id) on delete set null,
  amount_paise      bigint not null check (amount_paise > 0),
  reason            text,
  status            text not null default 'successful'
                      check (status in ('pending','successful','failed')),
  razorpay_refund_id text unique,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        text
);

create index idx_refunds_payment_id on public.refunds (payment_id);

create trigger refunds_set_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 10. AMC CONTRACTS
-- ===========================================================================
create table public.amc_contracts (
  id                     uuid primary key default gen_random_uuid(),
  website_id             uuid unique not null references public.websites(id) on delete cascade,
  enabled                boolean not null default true,
  exempt                 boolean not null default false,
  original_price_paise   bigint not null default 0 check (original_price_paise >= 0),
  renewal_price_paise    bigint not null default 0 check (renewal_price_paise >= 0),
  negotiated_price_paise bigint check (negotiated_price_paise is null or negotiated_price_paise >= 0),
  billing_period_days    integer not null default 365 check (billing_period_days > 0),
  upcoming_threshold_days integer not null default 10 check (upcoming_threshold_days >= 0),
  grace_period_days      integer not null default 3 check (grace_period_days >= 0),
  validity_start         date,
  validity_end           date,
  last_renewal_date       date,
  next_expiry_date        date,
  status                 text not null default 'disabled'
                           check (status in ('active','upcoming','expired','overdue','suspended','exempt','disabled')),
  access_status          text not null default 'active'
                           check (access_status in ('active','suspended','manual_suspended','archived')),
  suspension_reason      text,
  suspended_at           timestamptz,
  auto_renewal           boolean not null default false,
  razorpay_subscription_id text,
  subscription_status    text,
  mandate_status         text,
  next_billing_date      date,
  cancellation_date      date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  updated_by             text,
  check (validity_end is null or validity_start is null or validity_end >= validity_start)
);

create index idx_amc_contracts_website_id on public.amc_contracts (website_id);
create index idx_amc_contracts_status on public.amc_contracts (status);
create index idx_amc_contracts_access_status on public.amc_contracts (access_status);
create index idx_amc_contracts_next_expiry on public.amc_contracts (next_expiry_date);
create index idx_amc_contracts_enabled on public.amc_contracts (enabled);

create trigger amc_contracts_set_updated_at before update on public.amc_contracts
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 11. AMC PERIODS (historical, never overwritten)
-- ===========================================================================
create table public.amc_periods (
  id                 uuid primary key default gen_random_uuid(),
  amc_contract_id    uuid not null references public.amc_contracts(id) on delete cascade,
  website_id         uuid not null references public.websites(id) on delete cascade,
  start_date         date not null,
  end_date           date not null,
  price_paise        bigint not null check (price_paise >= 0),
  payment_id         uuid references public.payments(id) on delete set null,
  status             text not null default 'active'
                       check (status in ('active','expired','renewed','cancelled')),
  notes              text,
  created_at         timestamptz not null default now(),
  unique (amc_contract_id, start_date),
  check (end_date >= start_date)
);

create index idx_amc_periods_contract_id on public.amc_periods (amc_contract_id);
create index idx_amc_periods_website_id on public.amc_periods (website_id);
create index idx_amc_periods_end_date on public.amc_periods (end_date desc);

-- ===========================================================================
-- 12. RENEWAL QUOTES (negotiable pricing)
-- ===========================================================================
create table public.renewal_quotes (
  id                   uuid primary key default gen_random_uuid(),
  website_id           uuid not null references public.websites(id) on delete cascade,
  amc_contract_id      uuid not null references public.amc_contracts(id) on delete cascade,
  amount_paise         bigint not null check (amount_paise >= 0),
  original_amount_paise bigint not null check (original_amount_paise >= 0),
  discount_paise       bigint not null default 0 check (discount_paise >= 0),
  discount_percent     numeric(5,2),
  quote_type           text not null default 'default'
                         check (quote_type in ('default','one_time_discount','permanent_price_change','manual')),
  reason               text,
  admin_notes          text,
  effective_date       date not null default current_date,
  quote_expiry_date    date,
  status               text not null default 'active'
                         check (status in ('active','expired','superseded','used','cancelled')),
  razorpay_order_id    text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           text
);

create index idx_renewal_quotes_website_id on public.renewal_quotes (website_id);
create index idx_renewal_quotes_status on public.renewal_quotes (status);
create index idx_renewal_quotes_effective on public.renewal_quotes (effective_date desc);

create trigger renewal_quotes_set_updated_at before update on public.renewal_quotes
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 13. LICENSE CREDENTIALS
-- ===========================================================================
create table public.license_credentials (
  id              uuid primary key default gen_random_uuid(),
  website_id      uuid unique not null references public.websites(id) on delete cascade,
  website_uuid    uuid not null,
  public_id       text not null,
  secret_hash     text not null,               -- bcrypt hash of the integration secret
  secret_prefix   text,                        -- last 4 characters, for display only
  is_active       boolean not null default true,
  last_rotated_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_license_credentials_public_id on public.license_credentials (public_id);

create trigger license_credentials_set_updated_at before update on public.license_credentials
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 14. LICENSE EVENTS (verification / order / renewal / errors)
-- ===========================================================================
create table public.license_events (
  id          uuid primary key default gen_random_uuid(),
  website_id  uuid references public.websites(id) on delete set null,
  event_type  text not null,   -- verify | config | create_order | verify_payment | error
  outcome     text not null,   -- success | failure | denied
  ip_address  inet,
  user_agent  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index idx_license_events_website_id on public.license_events (website_id);
create index idx_license_events_created_at on public.license_events (created_at desc);

-- ===========================================================================
-- 15. WEBSITE SETTINGS (per-website preferences)
-- ===========================================================================
create table public.website_settings (
  id                       uuid primary key default gen_random_uuid(),
  website_id               uuid unique not null references public.websites(id) on delete cascade,
  whatsapp_number_override text,
  reminders_enabled        boolean not null default true,
  reminder_intervals       integer[] not null default '{30,15,7}',
  custom_suspension_title  text,
  custom_suspension_body   text,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger website_settings_set_updated_at before update on public.website_settings
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 16. NOTIFICATION TEMPLATES
-- ===========================================================================
create table public.notification_templates (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  subject     text,
  body        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger notification_templates_set_updated_at before update on public.notification_templates
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 17. NOTIFICATION LOGS (reminder dedup / history)
-- ===========================================================================
create table public.notification_logs (
  id                uuid primary key default gen_random_uuid(),
  template_key      text not null,
  website_id        uuid references public.websites(id) on delete set null,
  client_id         uuid references public.clients(id) on delete set null,
  channel           text not null default 'whatsapp',
  recipient         text,
  message           text,
  status            text not null default 'sent' check (status in ('sent','failed','skipped')),
  error             text,
  reminder_interval integer,
  period_key        text,             -- e.g. '2026-04' used for one-per-interval dedup
  created_at        timestamptz not null default now()
);

create index idx_notification_logs_website on public.notification_logs (website_id);
create index idx_notification_logs_dedup on public.notification_logs (website_id, template_key, reminder_interval, period_key);

-- ===========================================================================
-- 18. RAZORPAY ORDERS
-- ===========================================================================
create table public.razorpay_orders (
  id                  uuid primary key default gen_random_uuid(),
  order_id            text unique not null,        -- Razorpay order id
  internal_order_ref  text unique not null,        -- our internal reference
  website_id          uuid references public.websites(id) on delete set null,
  client_id           uuid references public.clients(id) on delete set null,
  payment_id          uuid references public.payments(id) on delete set null,
  quote_id            uuid references public.renewal_quotes(id) on delete set null,
  amount_paise        bigint not null check (amount_paise > 0),
  currency            text not null default 'INR',
  status              text not null default 'created'
                        check (status in ('created','paid','failed','refunded','cancelled')),
  receipt             text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_razorpay_orders_website on public.razorpay_orders (website_id);
create index idx_razorpay_orders_payment on public.razorpay_orders (payment_id);

create trigger razorpay_orders_set_updated_at before update on public.razorpay_orders
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 19. RAZORPAY WEBHOOK EVENTS (idempotency)
-- ===========================================================================
create table public.razorpay_webhook_events (
  id           uuid primary key default gen_random_uuid(),
  event_id     text unique not null,
  event_name   text not null,
  payload      jsonb not null,
  payment_id   text,
  order_id     text,
  status       text not null default 'received'
                 check (status in ('received','processed','ignored','failed')),
  error        text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_razorpay_webhook_events_event on public.razorpay_webhook_events (event_id);
create index idx_razorpay_webhook_events_created on public.razorpay_webhook_events (created_at desc);

-- ===========================================================================
-- 20. CRON EXECUTION LOGS
-- ===========================================================================
create table public.cron_execution_logs (
  id                  uuid primary key default gen_random_uuid(),
  run_id              text unique not null,
  trigger             text not null default 'scheduled' check (trigger in ('scheduled','manual')),
  status              text not null default 'running'
                        check (status in ('running','success','failed','partial')),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  websites_processed  integer not null default 0,
  upcoming_count      integer not null default 0,
  expired_count       integer not null default 0,
  overdue_count       integer not null default 0,
  newly_suspended     integer not null default 0,
  errors              jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);

create index idx_cron_logs_created on public.cron_execution_logs (created_at desc);

-- ===========================================================================
-- 21. ACTIVITY LOGS (audit trail)
-- ===========================================================================
create table public.activity_logs (
  id             uuid primary key default gen_random_uuid(),
  event_type     text not null,
  client_id      uuid references public.clients(id) on delete set null,
  website_id     uuid references public.websites(id) on delete set null,
  actor          text not null default 'system',
  description    text not null,
  previous_value jsonb,
  new_value      jsonb,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index idx_activity_logs_created on public.activity_logs (created_at desc);
create index idx_activity_logs_event on public.activity_logs (event_type);
create index idx_activity_logs_client on public.activity_logs (client_id);
create index idx_activity_logs_website on public.activity_logs (website_id);

-- ===========================================================================
-- 22. ADMIN NOTIFICATIONS
-- ===========================================================================
create table public.admin_notifications (
  id                uuid primary key default gen_random_uuid(),
  type              text not null,
  title             text not null,
  message           text not null,
  severity          text not null default 'info'
                      check (severity in ('info','warning','error','success')),
  related_client_id uuid references public.clients(id) on delete set null,
  related_website_id uuid references public.websites(id) on delete set null,
  is_read           boolean not null default false,
  dedupe_key        text unique,
  created_at        timestamptz not null default now()
);

create index idx_admin_notifications_read on public.admin_notifications (is_read, created_at desc);

-- ===========================================================================
-- 23. LOGIN ATTEMPTS (rate limiting)
-- ===========================================================================
create table public.login_attempts (
  id           uuid primary key default gen_random_uuid(),
  username     text,
  ip_address   text,
  successful   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index idx_login_attempts_created on public.login_attempts (created_at desc);
create index idx_login_attempts_ip on public.login_attempts (ip_address, created_at desc);

-- ===========================================================================
-- ROW LEVEL SECURITY
-- The admin portal and license engine run server-side with the Supabase
-- service role key, which bypasses RLS. No anon/authenticated access is
-- granted to business data. Enable RLS on every table as defence in depth.
-- ===========================================================================
alter table public.clients enable row level security;
alter table public.websites enable row level security;
alter table public.website_domains enable row level security;
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.amc_contracts enable row level security;
alter table public.amc_periods enable row level security;
alter table public.renewal_quotes enable row level security;
alter table public.license_credentials enable row level security;
alter table public.license_events enable row level security;
alter table public.website_settings enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_logs enable row level security;
alter table public.razorpay_orders enable row level security;
alter table public.razorpay_webhook_events enable row level security;
alter table public.cron_execution_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.login_attempts enable row level security;
alter table public.application_settings enable row level security;

-- Explicit deny-by-default: no policies for anon/authenticated.
-- The service role bypasses RLS. Document this in SECURITY.md.

-- ===========================================================================
-- HELPER: human readable money (paise -> INR) for reporting queries
-- ===========================================================================
create or replace function public.inr(paise bigint)
returns numeric
language sql
immutable
as $$
  select (paise::numeric / 100.0);
$$;

-- ===========================================================================
-- HELPER: days between two dates in the Asia/Kolkata business calendar
-- ===========================================================================
create or replace function public.days_remaining(validity_end date, business_date date)
returns integer
language sql
immutable
as $$
  select (validity_end - business_date)::integer;
$$;
