-- ============================================================
-- 0023_partner_login_bank_payouts.sql — partner programme, round 2
-- PENDING — run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================
--
-- 1. Login: partners sign in with mobile number + 6-digit PIN. Only a
--    salted scrypt hash of the PIN is stored (same scheme as admin PINs),
--    with a lock after 5 wrong tries.
-- 2. Bank details for payouts (account holder, number, IFSC, bank name;
--    UPI and PAN already exist). Server-only table, RLS on.
-- 3. partner_payouts: one row per partner per month that has been paid —
--    gross commission, TDS %, TDS amount, net paid, date and bank UTR.

alter table partners add column if not exists pin_hash text;
alter table partners add column if not exists pin_salt text;
alter table partners add column if not exists pin_failed integer not null default 0;
alter table partners add column if not exists pin_locked_until timestamptz;
alter table partners add column if not exists bank_account_name text;
alter table partners add column if not exists bank_account_number text;
alter table partners add column if not exists bank_ifsc text;
alter table partners add column if not exists bank_name text;
alter table partners add column if not exists bank_updated_at timestamptz;

create table if not exists partner_payouts (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partners(id) on delete cascade,
  month        text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),  -- sales month, e.g. 2026-10
  gross        integer not null check (gross >= 0),                  -- commission + bonus, ₹
  tds_percent  numeric(5,2) not null check (tds_percent >= 0 and tds_percent <= 30),
  tds          integer not null check (tds >= 0),
  net          integer not null check (net >= 0),                    -- amount actually sent
  paid_on      date not null,
  reference    text,                                                 -- bank UTR / UPI ref
  notes        text,
  created_at   timestamptz not null default now(),
  unique (partner_id, month)
);

alter table partner_payouts enable row level security;

comment on table partner_payouts is
  'Commission payouts to sales partners: one row per partner per sales month. Shown on the partner earnings page as paid.';
