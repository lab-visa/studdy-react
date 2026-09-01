-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0006_subscriptions_and_billing.sql
--
-- Per Vish's correction: subscriptions is a real, required table, not an
-- optional add-on — this is the canonical home for Stripe subscription
-- lifecycle. customers keeps only a light current-state snapshot;
-- everything about trial/renewal/cancellation timing lives here so this
-- table doesn't turn into another mega-table under a new name.

create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  customer_id             uuid not null references customers(id),
  stripe_subscription_id   text not null unique,
  stripe_price_id           text,
  plan_type                  text, -- Monthly | Yearly
  currency                    text,
  status                       text not null, -- trialing | active | past_due | cancel_scheduled | cancelled | unpaid | incomplete
  trial_start                   timestamptz,
  trial_end                      timestamptz,
  current_period_start            timestamptz,
  current_period_end               timestamptz,
  cancel_at                         timestamptz,
  cancel_at_period_end                boolean not null default false,
  cancelled_at                         timestamptz,
  ended_at                              timestamptz,
  created_at                            timestamptz not null default now(),
  updated_at                             timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on subscriptions (customer_id);
create index if not exists subscriptions_status_idx   on subscriptions (status);
create index if not exists subscriptions_stripe_sub_idx on subscriptions (stripe_subscription_id);

create table if not exists payment_events (
  id                  uuid primary key default gen_random_uuid(),
  stripe_event_id       text not null unique, -- uniqueness guard against Stripe's duplicate-delivery retries
  event_type              text not null,
  customer_id               uuid references customers(id),
  subscription_id            uuid references subscriptions(id),
  invoice_id                  text,
  payment_intent_id            text,
  amount                        numeric,
  currency                      text,
  status                         text,
  occurred_at                     timestamptz not null default now(),
  raw_metadata                     jsonb
);

create index if not exists payment_events_customer_idx     on payment_events (customer_id);
create index if not exists payment_events_subscription_idx on payment_events (subscription_id);
create index if not exists payment_events_type_idx         on payment_events (event_type);

create table if not exists cancellation_requests (
  id              uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers(id),
  source              text not null, -- dashboard | whatsapp | manual
  requested_at          timestamptz not null default now(),
  reason                  text,
  notes                    text,
  status                    text not null default 'pending_discussion',
  -- pending_discussion | retained | approved_for_cancellation | cancel_scheduled | cancelled
  discussed_at               timestamptz,
  resolved_at                  timestamptz,
  resolution                    text,
  created_at                     timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists cancellation_requests_customer_idx on cancellation_requests (customer_id);
create index if not exists cancellation_requests_status_idx   on cancellation_requests (status);

comment on table subscriptions is
  'Canonical home for Stripe subscription lifecycle. customers.access_status/lifecycle are a snapshot derived from here, not the other way around.';
comment on table cancellation_requests is
  'The dashboard/WhatsApp cancellation workflow. This table is never the thing that cancels Stripe — Stripe is only ever cancelled manually by an admin after a conversation, exactly as today.';
