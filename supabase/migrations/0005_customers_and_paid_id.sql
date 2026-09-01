-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0005_customers_and_paid_id.sql
--
-- PAID ID — per Vish's approved clarification (Aug 2026):
--   * Keeps the human-readable SL-YYMM-NNNN format, e.g. SL-2608-0142.
--   * Generated database-side off a real Postgres sequence — nextval()
--     is atomic under concurrent transactions, so two webhooks firing
--     at the same instant can never receive the same number. No
--     SELECT MAX()+1, no client-side counting.
--   * NNNN is a single global running count (not reset monthly) — the
--     YYMM in the code is a "created around this time" stamp, not a
--     per-month sequence reset. Flagging this choice explicitly since
--     the brief specified the format but not the reset behavior.
--   * Immutable once assigned: the trigger below rejects any UPDATE
--     that changes an existing paid_id.
--   * Paid ID is a reference/display identifier ONLY. It grants no
--     access to anything by itself — the customer dashboard keeps using
--     its existing separate, opaque session-based access mechanism,
--     completely unchanged. There is no /dashboard/<paid_id> route.

create sequence if not exists paid_id_seq start 1;

create or replace function generate_paid_id() returns text as $$
declare
  seq_val bigint;
begin
  seq_val := nextval('paid_id_seq');
  return 'SL-' || to_char(now(), 'YYMM') || '-' || lpad(seq_val::text, 4, '0');
end;
$$ language plpgsql;

create table if not exists customers (
  id                    uuid primary key default gen_random_uuid(),
  paid_id                text not null unique default generate_paid_id(),
  name                    text,
  email                    text,
  phone                    text,
  normalized_phone          text,
  country                   text,
  state_province             text,   -- raw geo/billing field, kept distinct from pricing_region
  pricing_region              text references pricing(pricing_region),
  stripe_customer_id           text unique,
  stripe_session_id             text unique, -- Stripe's own checkout session id, kept for reference/support lookups only
  attribution_method             text,   -- tracking_id | phone_match | email_match | none
  attribution_confidence          text,  -- exact | multiple_match_review | none
  source_lead_id                   text,
  campaign_id                       uuid references campaigns(id),
  master_lead_id                     uuid references master_leads(id),
  lifecycle                           text not null default 'trial', -- trial | converted | retained | churned
  access_status                        text not null default 'pending', -- pending | active | grace | suspended | ended
  created_at                            timestamptz not null default now(),
  updated_at                             timestamptz not null default now()
);

alter table master_leads
  add constraint master_leads_customer_id_fkey
  foreign key (customer_id) references customers(id)
  not valid; -- validated separately so this migration never blocks on existing data

create index if not exists customers_phone_idx               on customers (normalized_phone);
create index if not exists customers_email_idx                on customers (email);
create index if not exists customers_stripe_customer_idx       on customers (stripe_customer_id);
create index if not exists customers_stripe_session_idx         on customers (stripe_session_id);
create index if not exists customers_access_status_idx           on customers (access_status);
create index if not exists customers_paid_id_idx                  on customers (paid_id);

create or replace function prevent_paid_id_change() returns trigger as $$
begin
  if old.paid_id is not null and new.paid_id is distinct from old.paid_id then
    raise exception 'paid_id is immutable once assigned (was %, attempted %)', old.paid_id, new.paid_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists customers_paid_id_immutable on customers;
create trigger customers_paid_id_immutable
  before update on customers
  for each row execute function prevent_paid_id_change();

comment on table customers is
  'A row is created here ONLY once Stripe successfully creates a card-required trial. Identity + current operational snapshot only — subscription lifecycle lives in subscriptions (0006), not here.';
comment on column customers.paid_id is
  'Human-readable reference ID (SL-YYMM-NNNN). Display/search/support use only — never used to authorize dashboard access.';
