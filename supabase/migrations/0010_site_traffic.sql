-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0010_site_traffic.sql — aggregate, non-identifying visit counters
--
-- This is the "counts only, no rows per person" piece for anyone who
-- hasn't paid or started a trial yet. One row per day+event+country+device
-- combination, with a number that goes up — never a row per visitor, never
-- any name/email/phone. Whoever they are stays completely anonymous until
-- (if ever) they actually start a trial, at which point they show up in
-- `customers` for the first time, with a Paid ID, per the business rule.

create table if not exists site_traffic_daily (
  day           date not null,
  event         text not null,   -- opened | checkout_viewed | trial_clicked
  country       text not null default 'unknown',
  device_type   text not null default 'unknown',
  visit_count   integer not null default 0,
  primary key (day, event, country, device_type)
);
-- country/device_type default to 'unknown' rather than allowing null,
-- because a primary key column can never actually hold null in Postgres.

comment on table site_traffic_daily is
  'Anonymous daily click counters for pre-signup site activity. No individual identity is ever stored here — this table only ever holds numbers going up. A person first gets their own row anywhere in the CRM (in customers) the moment they actually start a trial or pay, not before.';

-- Atomic "create-at-1-or-bump-by-1" used by api/track-event.js. A plain
-- function (not just an upsert from the app) so two visitors landing at
-- the same instant can never race each other and lose a count.
create or replace function increment_site_traffic(
  p_day date, p_event text, p_country text, p_device_type text
) returns void as $$
begin
  insert into site_traffic_daily (day, event, country, device_type, visit_count)
  values (p_day, p_event, coalesce(p_country, 'unknown'), coalesce(p_device_type, 'unknown'), 1)
  on conflict (day, event, country, device_type)
  do update set visit_count = site_traffic_daily.visit_count + 1;
end;
$$ language plpgsql;
