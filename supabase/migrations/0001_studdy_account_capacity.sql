-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0001_studdy_account_capacity.sql
--
-- Closes the "capacity hard-coded to 7" gap found in the audit
-- (sync-checkout-session.js currently does `active_customer_count < 7`).
--
-- Additive only. Every existing row gets max_capacity = 7, which is
-- exactly today's real, live behavior — nothing changes for existing
-- accounts or customers when this runs.
--
-- active_customer_count is left in place for now (existing code still
-- reads/writes it) — Phase 4 replaces it with a real count derived from
-- account_assignments and this column becomes informational only.

alter table studdy_accounts
  add column if not exists max_capacity integer not null default 7;

comment on column studdy_accounts.max_capacity is
  'Configurable seat limit for this account. Default 7 matches current hard-coded behavior. Not yet the source of truth for allocation — see account_assignments (Phase 4).';
