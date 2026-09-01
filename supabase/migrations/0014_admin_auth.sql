-- ============================================================
-- APPLIED TO PRODUCTION — confirmed Sep 1, 2026 (read-only
-- verification: admin_users and admin_sessions exist with the
-- exact expected schema, indexes, and foreign key; both tables
-- have 0 rows — no admin account, PIN, hash, or salt exists).
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- Committed here for version-control history; see
-- supabase/migrations/README.md for the authoritative status
-- table. Next (and last) pending migration is 0015.
-- ============================================================
--
-- 0014_admin_auth.sql
--
-- This migration only creates two empty tables. It never contains, and
-- must never be edited to contain, a real admin PIN, hash, or salt — the
-- one and only admin_users row is inserted separately, later, by Vish,
-- from the printed output of the local scripts/create-admin.mjs bootstrap
-- script (see that script's own header). Nothing here writes any row.
--
-- Fresh design, not a reuse of the old local-only single-shared-password
-- HMAC-cookie pattern (which had no server-side session record at all,
-- so "logout" could never truly revoke a live cookie). A real
-- admin_sessions table gives genuine server-side logout, a natural path
-- to multiple users/roles later with zero rewrite, and per-session
-- auditability, while still being just two small tables.

create table if not exists admin_users (
  id               uuid primary key default gen_random_uuid(),
  display_name     text not null,
  pin_hash         text not null,
  pin_salt         text not null,
  is_active        boolean not null default true,
  role             text not null default 'owner',  -- unused in CRM-1B, future-compatible only
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists admin_users_display_name_uidx
  on admin_users (lower(display_name));

create table if not exists admin_sessions (
  id                   uuid primary key default gen_random_uuid(),
  admin_user_id        uuid not null references admin_users(id),
  session_token_hash   text not null unique,  -- SHA-256 of the opaque cookie value; never the raw token itself
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null,
  revoked_at           timestamptz
);

create index if not exists admin_sessions_admin_user_idx on admin_sessions (admin_user_id);

comment on table admin_users is
  'Single-admin (V1) authentication for /admin. PIN is never stored in plain text: pin_hash = scrypt(HMAC-SHA256(ADMIN_PIN_PEPPER, pin), pin_salt). ADMIN_PIN_PEPPER is a Vercel-only environment variable, never stored in this table, never in this migration file, never in GitHub.';
comment on table admin_sessions is
  'Server-side session ledger. session_token_hash lets a leaked database export never yield a directly usable session cookie. Logout sets revoked_at — a true, immediate, server-enforced invalidation, not just a client-side cookie clear.';
