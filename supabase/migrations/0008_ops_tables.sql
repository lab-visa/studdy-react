-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0008_ops_tables.sql — expenses (P&L), settings, activity_log

create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  date            date not null,
  category          text not null, -- whatsapp | stripe_fees | studdy_ai | bunny | vercel | software | contractor | advertising | other
  description         text,
  amount                numeric not null,
  currency                text not null,
  campaign_id               uuid references campaigns(id),
  vendor                     text,
  notes                        text,
  created_at                    timestamptz not null default now()
);

create index if not exists expenses_date_idx     on expenses (date);
create index if not exists expenses_category_idx on expenses (category);

create table if not exists settings (
  key           text primary key,
  value           jsonb not null,
  updated_at        timestamptz not null default now()
);

insert into settings (key, value) values
  ('trial_days',                   '7'),
  ('failed_payment_grace_days',    '3'),
  ('default_studdy_capacity',      '7'),
  ('whatsapp_cost_per_message_inr','5')
on conflict (key) do nothing;

create table if not exists activity_log (
  id            uuid primary key default gen_random_uuid(),
  event_type      text not null,
  entity_type       text not null,
  entity_id           text,
  actor                 text not null, -- system | admin | stripe | ghl
  occurred_at             timestamptz not null default now(),
  metadata                  jsonb
);

create index if not exists activity_log_entity_idx    on activity_log (entity_type, entity_id);
create index if not exists activity_log_occurred_idx  on activity_log (occurred_at);

comment on table settings is
  'Business-rule values the brief called out as "must be configurable, not hard-coded" (trial length, grace days, default seat capacity, per-message cost). Seeded to match today''s real, already-decided values — changing a row here does not yet change app behavior until the relevant Phase 3/4/6 code reads from it instead of its current hard-coded constant.';
