-- ============================================================================
-- Helper sequences / counters for human-friendly numbering
-- ============================================================================

create table if not exists public.counters (
  key   text primary key,
  value bigint not null default 0
);

-- Defence in depth: counters are only modified through server-side RPCs using
-- the service role. No anon/authenticated access.
alter table public.counters enable row level security;

-- Atomically increment a counter and return the new value.
create or replace function public.next_counter(p_key text)
returns bigint
language plpgsql
as $$
declare
  v bigint;
begin
  insert into public.counters (key, value)
  values (p_key, 1)
  on conflict (key) do update
    set value = counters.value + 1
  returning value into v;
  return v;
end;
$$;

-- Convenience: next invoice number for a given year/prefix.
create or replace function public.next_invoice_number(p_prefix text, p_year text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := public.next_counter('invoice_' || p_prefix || '_' || p_year);
  return p_prefix || '-' || p_year || '-' || lpad(n::text, 4, '0');
end;
$$;

-- Convenience: next generic document number.
create or replace function public.next_document_number(p_prefix text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := public.next_counter(p_prefix);
  return p_prefix || '-' || lpad(n::text, 5, '0');
end;
$$;
