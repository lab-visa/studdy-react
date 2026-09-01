-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0003_master_leads.sql
--
-- The historical 10 lakh+ reference database. Importing rows here does
-- NOT create a customer or a CRM entry of any kind — see the audit for
-- why this stays a separate concept from `customers`.
--
-- normalized_phone is deliberately NOT unique (point 9): historical
-- duplicates can legitimately exist across years of re-collected data.
-- It's indexed (not constrained) so attribution lookups at payment time
-- are fast even at this scale.

create extension if not exists pgcrypto;

create table if not exists master_leads (
  id                 uuid primary key default gen_random_uuid(),
  source_lead_id     text,
  name               text,
  phone              text,
  normalized_phone   text,
  country            text,
  state_province     text,
  course_interest    text,
  grade              text,
  acquired_year      integer,
  acquired_month     integer,
  historical_source  text,
  whatsapp_eligible  boolean not null default true,
  suppressed         boolean not null default false,
  suppression_reason text,
  suppressed_at      timestamptz,
  last_contacted_at  timestamptz,
  total_sends        integer not null default 0,
  converted          boolean not null default false,
  customer_id        uuid, -- FK added in 0005 after customers exists
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Unique only among non-null values — a lead's own tracking ID should
-- not collide, but rows without one (rare, historical gaps) are fine.
create unique index if not exists master_leads_source_lead_id_uidx
  on master_leads (source_lead_id) where source_lead_id is not null;

create index if not exists master_leads_normalized_phone_idx on master_leads (normalized_phone);
create index if not exists master_leads_country_idx          on master_leads (country);
create index if not exists master_leads_acquired_year_idx    on master_leads (acquired_year);
create index if not exists master_leads_whatsapp_eligible_idx on master_leads (whatsapp_eligible);
create index if not exists master_leads_suppressed_idx        on master_leads (suppressed);

comment on table master_leads is
  'Historical/reference lead database. NOT a CRM customer table — importing rows here creates zero customer records. See customers (0005) for actual paying/trialing people.';
comment on column master_leads.suppressed is
  'True if this number must never be sent another WhatsApp campaign (STOP reply, DND webhook, invalid number, complaint).';
