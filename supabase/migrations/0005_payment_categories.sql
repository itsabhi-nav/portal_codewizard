-- Simplified payment purposes: Advance, Domain, AMC & Hosting, Final Completion.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose = ANY (ARRAY['advance'::text, 'domain'::text, 'amc_hosting'::text, 'final_completion'::text,
    'development'::text, 'amc_renewal'::text, 'additional_development'::text, 'hosting'::text, 'other'::text]));

-- The app accesses the database only from the server with the service-role key.
-- Grant it explicitly because automatic Data API table exposure may be disabled.
revoke execute on all functions in schema public from public, anon, authenticated;
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
