-- ============================================================
-- APPLIED TO PRODUCTION — confirmed Sep 1, 2026 (read-only
-- verification: row/visit counts unchanged, campaign_code column
-- present and NOT NULL default 'none', primary key widened to
-- (day, event, campaign_code, country, device_type), exactly one
-- 5-argument increment_site_traffic function exists).
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- Committed here for version-control history; see
-- supabase/migrations/README.md for the authoritative status
-- table. Next pending migration is 0013.
-- ============================================================
--
-- 0012_site_traffic_campaign_attribution.sql
--
-- Catches a real gap flagged in review: without a campaign dimension,
-- site_traffic_daily can tell you "18 people opened the site from the US
-- today" but never "11 of those came from campaign WA-260829-US-01" — so
-- once WhatsApp campaigns exist (Phase 6), the funnel would break in the
-- middle (campaign → click is known, click → website is known, but
-- campaign → website isn't). Fixing this now, while the table is still
-- empty of any campaign_code data, is free; retrofitting it later once
-- real rows exist is not.
--
-- CRM-0B (live production verification, Aug 2026) proved this migration
-- was designed once before but never actually run — production still has
-- the old 4-column primary key and the old 4-argument function. This file
-- also corrects a whitespace-normalization gap found in CRM-1 review:
-- NULL, '', ' ', and '   ' must all collapse to 'none', not just NULL/''.
--
-- Still fully anonymous — campaign_code identifies a BATCH ("everyone we
-- sent WA-260829-US-01 to"), never an individual visitor.

begin;

alter table site_traffic_daily
  add column if not exists campaign_code text not null default 'none';
-- Adding a NOT NULL column with a literal default is a metadata-only
-- change in modern Postgres (11+) — no full table rewrite. All existing
-- rows get campaign_code='none' automatically and instantly; none of the
-- 23 rows / 56 visits confirmed live in CRM-0B are deleted or merged.

alter table site_traffic_daily drop constraint if exists site_traffic_daily_pkey;
alter table site_traffic_daily add constraint site_traffic_daily_pkey
  primary key (day, event, campaign_code, country, device_type);
-- Safe: every existing row now has campaign_code='none', so the new wider
-- key is a superset of the old one — each old (day,event,country,device_type)
-- still maps to exactly one row. No duplicate-key violation is possible.

-- Must drop the old 4-argument version explicitly — "create or replace"
-- with a different parameter list creates a second, overloaded function
-- instead of replacing the first, which makes every future call
-- ambiguous ("function is not unique").
drop function if exists increment_site_traffic(date, text, text, text);

create or replace function increment_site_traffic(
  p_day date, p_event text, p_country text, p_device_type text, p_campaign_code text default 'none'
) returns void as $$
begin
  insert into site_traffic_daily (day, event, campaign_code, country, device_type, visit_count)
  values (
    p_day, p_event,
    coalesce(nullif(btrim(p_campaign_code), ''), 'none'),
    coalesce(nullif(btrim(p_country), ''), 'unknown'),
    coalesce(nullif(btrim(p_device_type), ''), 'unknown'),
    1
  )
  on conflict (day, event, campaign_code, country, device_type)
  do update set visit_count = site_traffic_daily.visit_count + 1;
end;
$$ language plpgsql;

comment on column site_traffic_daily.campaign_code is
  'Which WhatsApp/marketing batch this anonymous count came from (matches campaigns.campaign_code), or ''none'' for organic/direct traffic, blank, or whitespace-only. Still just a count — never tied to an individual visitor.';

commit;
