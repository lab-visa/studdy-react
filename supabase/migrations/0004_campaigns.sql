-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0004_campaigns.sql
--
-- One row per WhatsApp batch (e.g. WA-260829-US-01) — never one row per
-- recipient. campaign_recipients is the lightweight send ledger (point 7):
-- it exists purely so we know who's already been sent what, can avoid
-- duplicate sends, and can attribute a later conversion back to the
-- right campaign — it is explicitly NOT a customer/CRM record.

create table if not exists campaigns (
  id                uuid primary key default gen_random_uuid(),
  campaign_code     text not null unique, -- e.g. WA-260829-US-01
  channel           text not null default 'whatsapp',
  country            text,
  pricing_region     text references pricing(pricing_region),
  template_name      text,
  template_id        text,
  ghl_number         text,
  planned_send_at    timestamptz,
  actual_send_at     timestamptz,
  audience_filter    jsonb,       -- the filter criteria used to build the recipient list
  selected_count     integer not null default 0,
  sent_count         integer not null default 0,
  cost_per_message    numeric,
  spend               numeric,
  utm_source          text,
  utm_medium          text,
  utm_campaign         text,
  utm_content          text,
  utm_term             text,
  status               text not null default 'draft',
  -- draft | audience_created | exported | sent | results_imported | completed
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists campaigns_status_idx  on campaigns (status);
create index if not exists campaigns_country_idx on campaigns (country);

create table if not exists campaign_recipients (
  id                uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references campaigns(id),
  master_lead_id      uuid not null references master_leads(id),
  source_lead_id       text,
  phone                 text,
  normalized_phone      text,
  selected_at            timestamptz not null default now(),
  exported_at             timestamptz,
  sent_at                  timestamptz,
  status                   text not null default 'selected',
  -- selected | exported | sent | delivered | read | failed | skipped | replied
  delivered_at              timestamptz,
  read_at                   timestamptz,
  failed_at                 timestamptz,
  skipped_at                timestamptz,
  replied_at                timestamptz,
  ghl_contact_id             text,
  ghl_message_id              text,
  last_status_at               timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- The idempotency rule from point 7: a given lead can only be selected
-- into a given campaign once.
create unique index if not exists campaign_recipients_campaign_lead_uidx
  on campaign_recipients (campaign_id, master_lead_id);

create index if not exists campaign_recipients_campaign_idx  on campaign_recipients (campaign_id);
create index if not exists campaign_recipients_lead_idx      on campaign_recipients (master_lead_id);
create index if not exists campaign_recipients_phone_idx     on campaign_recipients (normalized_phone);
create index if not exists campaign_recipients_status_idx    on campaign_recipients (status);

comment on table campaign_recipients is
  'Per-lead send ledger for one campaign. Not a customer record — exists for dedupe, contact-frequency, suppression, and later attribution only.';
