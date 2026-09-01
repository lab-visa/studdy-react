-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0009_backfill_leads_to_customers.sql — Phase 2B
--
-- Copies existing trial/paid customers OUT of `leads` INTO the new CRM
-- tables (customers, subscriptions, cancellation_requests,
-- account_assignments). Read-only on `leads` — nothing there is changed
-- or deleted, this only adds new rows elsewhere.
--
-- Only rows that actually reached Stripe (have both a stripe_customer_id
-- AND stripe_subscription_id) are copied — pure top-of-funnel rows
-- (opened / checkout_viewed / trial_clicked, never paid or trialed) are
-- deliberately left alone, matching the "no CRM entry before trial/payment"
-- rule.
--
-- Safe to run more than once: customers.stripe_customer_id is unique, so
-- anyone already migrated is skipped automatically on a second run — no
-- duplicates, nothing overwritten.

begin;

with new_customers as (
  insert into customers (
    name, email, phone, normalized_phone, country, state_province,
    stripe_customer_id, stripe_session_id,
    attribution_method, attribution_confidence, source_lead_id,
    lifecycle, access_status, created_at, updated_at
  )
  select
    l.parent_name,
    l.email,
    null,
    null,
    l.detected_country,
    l.detected_region,
    l.stripe_customer_id,
    l.stripe_session_id,
    case when l.source_lead_id is not null then 'tracking_id' else 'none' end,
    case when l.source_lead_id is not null then 'exact' else 'none' end,
    l.source_lead_id,
    case
      when l.status = 'Cancelled' or l.stage = 'cancelled' then 'churned'
      when coalesce(l.total_months_paid, 0) = 0 then 'trial'
      when l.total_months_paid = 1 then 'converted'
      else 'retained'
    end,
    case
      when l.status = 'Cancelled' or l.stage = 'cancelled' then 'ended'
      when l.status = 'Failed' then 'grace'
      when l.status = 'Paused' then 'suspended'
      else 'active'
    end,
    coalesce(l.opened_at, now()),
    coalesce(l.updated_at, now())
  from leads l
  where l.stripe_customer_id is not null
    and l.stripe_subscription_id is not null
  on conflict (stripe_customer_id) do nothing
  returning id, stripe_customer_id
)
insert into subscriptions (
  customer_id, stripe_subscription_id, plan_type, currency, status,
  trial_start, trial_end, current_period_end, cancel_at_period_end,
  cancelled_at, ended_at, created_at, updated_at
)
select
  nc.id,
  l.stripe_subscription_id,
  l.plan_type,
  l.currency,
  case
    when l.status = 'Cancelled' or l.stage = 'cancelled' then 'cancelled'
    when l.status = 'Trialing' then 'trialing'
    when l.status = 'Failed' then 'past_due'
    else 'active'
  end,
  l.trial_start_date,
  l.trial_end_date,
  l.next_billing_date,
  false,
  l.cancelled_at,
  case when l.status = 'Cancelled' or l.stage = 'cancelled' then l.cancelled_at else null end,
  coalesce(l.opened_at, now()),
  coalesce(l.updated_at, now())
from new_customers nc
join leads l on l.stripe_customer_id = nc.stripe_customer_id;

-- Carry over any cancellation request that was logged on the dashboard,
-- so it doesn't just disappear from view once the old table stops being
-- the primary place to look.
insert into cancellation_requests (
  customer_id, source, requested_at, reason, notes, status, created_at, updated_at
)
select
  c.id,
  'dashboard',
  l.cancel_requested_at,
  l.cancel_reason,
  l.cancel_message,
  case when l.status = 'Cancelled' or l.stage = 'cancelled' then 'cancelled' else 'pending_discussion' end,
  coalesce(l.cancel_requested_at, now()),
  now()
from leads l
join customers c on c.stripe_customer_id = l.stripe_customer_id
where l.cancel_requested_at is not null
  and not exists (
    select 1 from cancellation_requests cr
    where cr.customer_id = c.id and cr.requested_at = l.cancel_requested_at
  );

-- Carry over the Studdy AI seat someone is CURRENTLY holding (skips
-- anyone already cancelled — no seat to carry over for them, and we
-- don't want to fabricate a made-up "released" timestamp we don't
-- actually have).
insert into account_assignments (
  studdy_account_id, customer_id, assigned_at, status, created_at, updated_at
)
select
  sa.id,
  c.id,
  coalesce(l.trial_start_date::timestamptz, l.opened_at, now()),
  'active',
  now(),
  now()
from leads l
join customers c on c.stripe_customer_id = l.stripe_customer_id
join studdy_accounts sa on sa.group_name = l.group_name
where l.group_name is not null
  and l.status <> 'Cancelled'
  and l.stage <> 'cancelled'
  and not exists (
    select 1 from account_assignments aa
    where aa.customer_id = c.id and aa.status = 'active'
  );

commit;
