-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0007_account_assignments.sql
--
-- The entitlement ledger for shared Studdy AI seats. Table only in this
-- migration — the atomic, concurrency-safe allocation FUNCTION (the
-- piece that actually decides "which account, which seat" without a
-- race condition) is Phase 4 work, built and tested together with the
-- webhook that calls it, not shipped untested here.
--
-- The partial unique index below is a real safety net on its own,
-- though: it makes it impossible for a customer to ever end up with two
-- simultaneously-active seat assignments, regardless of how the
-- allocation logic that inserts rows here is written.

create table if not exists account_assignments (
  id                 uuid primary key default gen_random_uuid(),
  studdy_account_id    uuid not null references studdy_accounts(id),
  customer_id            uuid not null references customers(id),
  assigned_at              timestamptz not null default now(),
  entitlement_end            timestamptz,
  released_at                  timestamptz,
  status                        text not null default 'active', -- active | reserved | released
  created_at                     timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create unique index if not exists account_assignments_one_active_per_customer
  on account_assignments (customer_id) where status = 'active';

create index if not exists account_assignments_account_idx on account_assignments (studdy_account_id);
create index if not exists account_assignments_status_idx  on account_assignments (status);

comment on table account_assignments is
  'Entitlement history. Real seat capacity = max_capacity minus count of active/reserved rows here per account (Phase 4) — active_customer_count on studdy_accounts stays for compatibility only, it is not authoritative going forward.';
