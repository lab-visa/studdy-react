-- test/fixtures/legacy_baseline.sql
--
-- NOT a real migration — never run against production, never listed in
-- supabase/migrations/README.md. This models the two legacy tables
-- (studdy_accounts, leads) that predate this repo's migration history
-- and are NOT created by any file in supabase/migrations/ — confirmed in
-- CRM-0A (absent from any migration) and CRM-0B (their real, live
-- production schema). Local test setup only, so migrations 0001+ (which
-- ALTER these tables) have something to apply against, the same way
-- production already does.
--
-- Column list matches CRM-0B's live-verified production schema for the
-- columns any code in this repo actually reads or writes; omits the
-- ~24 additional legacy/unused columns CRM-0B found (affiliate_name,
-- utm_*, etc.) since no code under test touches them.

create extension if not exists pgcrypto;

create table studdy_accounts (
  id                    uuid primary key default gen_random_uuid(),
  group_name            text not null unique,
  studdy_email          text,
  studdy_password       text,
  studdy_url            text,
  active_customer_count integer not null default 0,
  created_at            timestamptz not null default now()
);

create table leads (
  lead_id                    uuid primary key default gen_random_uuid(),
  email                      text,
  parent_name                text,
  mobile_number              text,
  mobile_number_with_code    text,
  stripe_session_id          text,
  stripe_customer_id         text,
  stripe_subscription_id     text,
  dashboard_url              text,
  platform                   text,
  currency                   text,
  plan_type                  text,
  amount                     numeric,
  trial_start_date           date,
  trial_end_date             date,
  first_payment_date         date,
  next_billing_date          date,
  card_brand                 text,
  card_last4                 text,
  card_expiry                text,
  detected_country           text,
  detected_region            text,
  studdy_email               text,
  studdy_password            text,
  studdy_url                 text,
  group_name                 text,
  stage                      text not null default 'new',
  status                     text not null default 'lead',
  total_months_paid          integer not null default 0,
  latest_invoice_url         text,
  latest_invoice_pdf         text,
  payment_failed_at          timestamptz,
  cancel_reason              text,
  cancel_message             text,
  cancel_requested_at        timestamptz,
  cancelled_at                timestamptz,
  trial_ending_notified_at    timestamptz,
  dispute_outcome              text,
  dispute_closed_at             timestamptz,
  dispute_status                 text,
  refund_amount                   numeric,
  refund_reason                    text,
  refunded_at                       timestamptz,
  source_lead_id                     text,
  opened_at                           timestamptz not null default now(),
  updated_at                           timestamptz not null default now()
);
