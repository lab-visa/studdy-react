-- ============================================================
-- 0023_partner_login.sql — partner login with WhatsApp number + 6-digit PIN
-- Safe to re-run.
-- ============================================================
--
-- PIN is never stored: pin_hash = scrypt(HMAC(ADMIN_PIN_PEPPER, pin), pin_salt),
-- the same derivation as admin login. Admin can only RESET a PIN (a
-- temporary one the partner must change on next login), never read it.
-- 5 wrong PINs lock the account for 15 minutes.
-- Sessions: random token in an HttpOnly cookie; only its SHA-256 is stored.

alter table partners add column if not exists pin_salt        text;
alter table partners add column if not exists pin_hash        text;
alter table partners add column if not exists pin_must_change boolean not null default false;
alter table partners add column if not exists failed_attempts integer not null default 0;
alter table partners add column if not exists locked_until    timestamptz;
alter table partners add column if not exists last_login_at   timestamptz;

create table if not exists partner_sessions (
  id                  uuid primary key default gen_random_uuid(),
  partner_id          uuid not null references partners(id) on delete cascade,
  session_token_hash  text not null unique,
  expires_at          timestamptz not null,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists partner_sessions_partner_idx on partner_sessions (partner_id);
alter table partner_sessions enable row level security;

comment on table partner_sessions is 'Logged-in sales partner sessions (cookie sl_partner_session). Stores only the SHA-256 of the token.';
