-- ============================================================
-- 0022_partners.sql — sales partner programme (India)
-- PENDING — run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================
--
-- One row per person who applies at studdylab.com/partners. When the
-- admin approves them they get:
--   code            — their referral code (studdylab.com/?ref=CODE); every
--                     India order bought through that link stores it in
--                     india_orders.ref_code, which is how sales and
--                     commission are credited.
--   dashboard_token — long random secret for their private earnings page
--                     (studdylab.com/partner?t=...). No password to forget.
--
-- PAN and payout details are collected at approval time (needed for TDS
-- and payouts) — never Aadhaar.

create table if not exists partners (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text not null,          -- 10-digit Indian mobile, normalised
  email            text not null,
  city             text,
  occupation       text,                   -- tutor / teacher / student / homemaker / sales / other
  experience       text,                   -- free text from the form
  why_join         text,

  status           text not null default 'applied', -- applied | approved | rejected | paused
  code             text unique,
  dashboard_token  text unique,

  pan              text,
  payout_upi       text,
  notes            text,                   -- admin's own notes

  applied_at       timestamptz not null default now(),
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists partners_phone_uidx on partners (phone);
create index if not exists partners_status_idx on partners (status);

alter table partners enable row level security;

comment on table partners is
  'Sales partner applications and approved partners. code = referral code stored on india_orders.ref_code; dashboard_token = private earnings-page link.';
