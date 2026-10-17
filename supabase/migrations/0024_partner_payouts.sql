-- ============================================================
-- 0024_partner_payouts.sql — partner bank details, PAN photo, payouts, TDS rate
-- Safe to re-run. No Aadhaar is ever collected.
-- ============================================================

alter table partners add column if not exists bank_holder               text;
alter table partners add column if not exists bank_account              text;
alter table partners add column if not exists bank_ifsc                 text;
alter table partners add column if not exists bank_name                 text;
alter table partners add column if not exists bank_branch               text;
alter table partners add column if not exists pan_photo_path            text;  -- object path in the private 'partner-docs' bucket
alter table partners add column if not exists payout_details_updated_at timestamptz;
alter table partners add column if not exists payout_details_checked_at timestamptz; -- admin checked PAN photo vs bank name

-- One row per partner per sales month, written when the admin marks it paid.
-- Amounts are a snapshot at payment time (statement for the partner).
create table if not exists partner_payouts (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partners(id) on delete restrict,
  month       text not null check (month ~ '^\d{4}-\d{2}$'),   -- sales month, e.g. 2026-10
  sales       integer not null default 0,
  commission  integer not null default 0,
  bonus       integer not null default 0,
  gross       integer not null,
  tds_rate    numeric(5,2) not null,
  tds         integer not null,
  net         integer not null,
  utr         text not null,
  paid_on     date not null,
  paid_by     text,
  created_at  timestamptz not null default now(),
  unique (partner_id, month)
);
create index if not exists partner_payouts_month_idx on partner_payouts (month);
alter table partner_payouts enable row level security;

insert into settings (key, value) values ('partner_tds_rate', '10') on conflict (key) do nothing;

-- Private bucket for PAN card photos (server-only; viewed by admin via short-lived signed links).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('partner-docs', 'partner-docs', false, 5242880, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;

comment on table partner_payouts is 'Partner payouts actually made (one per partner per sales month), with TDS and bank UTR.';
