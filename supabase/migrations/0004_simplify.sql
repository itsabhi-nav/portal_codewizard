-- ============================================================================
-- Simplification migration
-- - Adds charge columns to websites (development/domain/hosting)
-- - Drops the Projects module (per client request)
-- ============================================================================

alter table public.websites
  add column if not exists domain_charge_paise bigint not null default 0
    check (domain_charge_paise >= 0);

alter table public.websites
  add column if not exists hosting_charge_paise bigint not null default 0
    check (hosting_charge_paise >= 0);

alter table public.websites
  add column if not exists domain_charge_frequency text not null default 'annual'
    check (domain_charge_frequency in ('one_time', 'annual'));

alter table public.websites
  add column if not exists hosting_charge_frequency text not null default 'annual'
    check (hosting_charge_frequency in ('one_time', 'annual'));

-- Free invoices/payments from their project FKs, then drop Projects module
alter table public.invoices
  drop constraint if exists invoices_project_id_fkey,
  drop column if exists project_id;

alter table public.payments
  drop constraint if exists payments_project_id_fkey,
  drop column if exists project_id;

drop table if exists public.project_milestones;
drop table if exists public.projects;
