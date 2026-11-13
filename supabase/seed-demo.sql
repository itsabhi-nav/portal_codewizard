-- ============================================================================
-- DEMO DATA - DEVELOPMENT / TESTING ONLY.
-- Never run this against production. It creates fake business records.
-- Run: psql -f supabase/seed-demo.sql
-- ============================================================================

-- Demo client
insert into public.clients (client_code, name, business_name, contact_person, mobile, whatsapp_number, email, city, state, notes, created_by)
values ('CLI-00001', 'Demo Client', 'Demo Retail Pvt Ltd', 'Rahul Sharma', '+919876543210', '+919876543210', 'rahul@example.com', 'Mumbai', 'Maharashtra', 'Demo client for testing', 'seed')
on conflict (client_code) do nothing;

-- Keep the generated client-code counter ahead of any seeded client rows.
insert into public.counters (key, value)
select 'CLI', coalesce(max(substring(client_code from '^CLI-([0-9]+)$')::bigint), 0)
from public.clients
where client_code ~ '^CLI-[0-9]+$'
on conflict (key) do update
  set value = greatest(public.counters.value, excluded.value);

-- Demo website
insert into public.websites (public_id, client_id, name, description, project_start_date, go_live_date, development_cost_paise, status, hosting_provider, notes, created_by)
select 'cw_demo0001', c.id, 'Demo Corporate Site', 'A demo website for testing the AMC flow', current_date - interval '400 days', current_date - interval '365 days', 5000000, 'live', 'Netlify', 'Demo website', 'seed'
from public.clients c where c.client_code = 'CLI-00001'
on conflict (public_id) do nothing;

-- Demo AMC contract (expires in 7 days to trigger upcoming status)
insert into public.amc_contracts (website_id, enabled, exempt, original_price_paise, renewal_price_paise, billing_period_days, upcoming_threshold_days, grace_period_days, validity_start, validity_end, next_expiry_date, status, access_status, updated_by)
select w.id, true, false, 300000, 300000, 365, 10, 3, current_date - interval '358 days', current_date + interval '7 days', current_date + interval '7 days', 'upcoming', 'active', 'seed'
from public.websites w where w.public_id = 'cw_demo0001'
on conflict (website_id) do nothing;

-- Demo renewal quote
insert into public.renewal_quotes (website_id, amc_contract_id, amount_paise, original_amount_paise, discount_paise, quote_type, effective_date, status, created_by)
select w.id, a.id, 250000, 300000, 50000, 'one_time_discount', current_date, 'active', 'seed'
from public.websites w
join public.amc_contracts a on a.website_id = w.id
where w.public_id = 'cw_demo0001';

-- Demo license credential (secret: demo_secret_change_me)
insert into public.license_credentials (website_id, website_uuid, public_id, secret_hash, secret_prefix, is_active)
select w.id, w.id, w.public_id, '$2a$10$replace_with_real_bcrypt_hash', 'demo', true
from public.websites w where w.public_id = 'cw_demo0001'
on conflict (website_id) do nothing;
