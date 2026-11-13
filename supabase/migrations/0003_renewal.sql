-- ============================================================================
-- Atomic renewal payment processing.
-- Called after Razorpay payment verification. Idempotent: if the payment is
-- already marked successful, the existing AMC period is returned unchanged.
-- ============================================================================

create or replace function public.process_renewal_payment(
  p_website_id uuid,
  p_contract_id uuid,
  p_payment_id uuid,
  p_quote_id uuid,
  p_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise bigint,
  p_billing_period_days integer,
  p_business_date date,
  p_effective_date date,
  p_actor text
)
returns jsonb
language plpgsql
as $$
declare
  v_contract record;
  v_period_start date;
  v_period_end date;
  v_extended boolean := false;
  v_existing public.amc_periods%ROWTYPE;
begin
  select * into v_contract
  from public.amc_contracts
  where id = p_contract_id
  for update;

  if not found then
    raise exception 'AMC contract not found';
  end if;

  -- Idempotency guard: payment already processed.
  if exists (select 1 from public.payments where id = p_payment_id and status = 'successful') then
    select * into v_existing from public.amc_periods where payment_id = p_payment_id order by created_at desc limit 1;
    return jsonb_build_object(
      'already_processed', true,
      'start_date', v_existing.start_date,
      'end_date', v_existing.end_date
    );
  end if;

  -- Renewal period calculation.
  if v_contract.validity_end is not null and p_business_date <= v_contract.validity_end then
    v_period_start := v_contract.validity_end + interval '1 day';
    v_extended := true;
  else
    v_period_start := p_effective_date;
    v_extended := false;
  end if;
  v_period_end := v_period_start + ((p_billing_period_days - 1) * interval '1 day');

  -- Mark the payment successful (immutable audit trail preserved).
  update public.payments
  set status = 'successful',
      razorpay_payment_id = p_razorpay_payment_id,
      payment_date = now(),
      updated_at = now()
  where id = p_payment_id;

  -- Mark the Razorpay order paid.
  update public.razorpay_orders
  set status = 'paid', payment_id = p_payment_id, updated_at = now()
  where order_id = p_order_id;

  -- Create the new AMC period (historical periods are never overwritten).
  insert into public.amc_periods (amc_contract_id, website_id, start_date, end_date, price_paise, payment_id, status, notes)
  values (p_contract_id, p_website_id, v_period_start, v_period_end, p_amount_paise, p_payment_id, 'active', 'Online renewal');

  -- Extend the contract validity.
  update public.amc_contracts
  set validity_start = v_period_start,
      validity_end = v_period_end,
      next_expiry_date = v_period_end,
      last_renewal_date = p_business_date,
      status = 'active',
      access_status = 'active',
      suspended_at = null,
      suspension_reason = null,
      updated_by = p_actor,
      updated_at = now()
  where id = p_contract_id;

  -- Restore the website.
  update public.websites
  set status = 'live', updated_at = now()
  where id = p_website_id and status = 'suspended';

  -- Mark the quote as used.
  if p_quote_id is not null then
    update public.renewal_quotes set status = 'used', updated_at = now() where id = p_quote_id;
  end if;

  return jsonb_build_object(
    'already_processed', false,
    'start_date', v_period_start,
    'end_date', v_period_end,
    'extended_existing', v_extended
  );
end;
$$;
