-- ============================================================
-- PENDING — NOT YET APPLIED TO PRODUCTION.
-- Written for CRM-3A (customer/subscription lifecycle round,
-- Sep 2026). Additive and backward-compatible only: new table,
-- new nullable columns. Nothing existing is dropped, renamed,
-- retyped, or made NOT NULL. Do not run against production
-- until reviewed and approved per this directory's README.
--
-- SECURITY CORRECTION (same day, before production application):
-- lead_attribution now enables Row Level Security with no policies —
-- see the comment directly above that statement below for the full
-- rationale. Backend-only table; the app's existing service-role
-- connection is unaffected.
-- ============================================================
--
-- 0016_campaign_attribution_and_sales_owner.sql
--
-- CRM-3A build items 1 (campaign attribution) and 5 (Sales Owner
-- foundation).
--
-- ATTRIBUTION DESIGN — why a separate ledger AND columns on customers:
--
--   `lead_attribution` is the raw, pre-purchase capture ledger. It is
--   written by the browser exactly once per visitor per lead_id — at the
--   moment they click "Start Free Trial" (api/track-attribution.js),
--   never merely for visiting the site, matching the existing rule in
--   api/track-event.js ("nobody gets a row anywhere in the CRM just for
--   visiting"). Its primary key is the SAME lead_id already sent to
--   Stripe as client_reference_id (src/utils/tracking.ts's getLeadId()),
--   so it is also, incidentally, the first real per-lead evidence of
--   "checkout started" — a signal that did not exist before this
--   migration (site_traffic_daily only ever counted anonymous
--   aggregates, never individual leads).
--
--   The `customers.first_*`/`latest_*` columns are the durable,
--   queryable snapshot copied onto the customer record once Stripe
--   actually creates them (api/_lib/sync-customer.js), by the SAME
--   existing?.field || value pattern already used for
--   attribution_method/source_lead_id in migration 0005 — so a first-
--   touch value, once set, is never silently overwritten, while the
--   latest-touch columns are free to move forward on a later resync.
--   This mirrors the existing payment_events-ledger + customers-snapshot
--   split already established by migration 0006.
--
-- SALES OWNER — per Vish's approved scope: nullable now, no team
-- accounts, no permissions, no round-robin. NULL means "no owner set"
-- and is displayed as "Unassigned"/"Self-service" by the application,
-- never enforced at the database level (no CHECK, no default string) so
-- a future real sales-attribution feature is not constrained by a
-- guessed set of values today.

begin;

create table if not exists lead_attribution (
  lead_id                text primary key,
  -- First-touch: captured once, by the browser, the first time a
  -- tracked UTM/GHL parameter is ever seen for this lead_id — persisted
  -- client-side (src/utils/tracking.ts) and never re-captured after that,
  -- exactly like the existing sl_campaign_code first-capture pattern.
  first_utm_source        text,
  first_utm_medium         text,
  first_utm_campaign        text,
  first_utm_content          text,
  first_utm_term               text,
  first_ghl_contact_id           text,
  first_ghl_campaign_id            text,
  first_landing_url                  text,
  first_touched_at                     timestamptz,
  -- Latest-touch: overwritten every time a fresh visit carries a new
  -- tracked parameter — the campaign context of the most recent tagged
  -- visit, which may differ from the first (e.g. a second WhatsApp
  -- campaign months later, same visitor).
  latest_utm_source        text,
  latest_utm_medium         text,
  latest_utm_campaign        text,
  latest_utm_content          text,
  latest_utm_term               text,
  latest_ghl_contact_id           text,
  latest_ghl_campaign_id            text,
  latest_landing_url                  text,
  latest_touched_at                     timestamptz,
  created_at                              timestamptz not null default now(),
  updated_at                                timestamptz not null default now()
);

comment on table lead_attribution is
  'Per-lead campaign-attribution capture, keyed by the same lead_id sent to Stripe as client_reference_id. Written once a visitor clicks Start Free Trial (api/track-attribution.js) — never for a mere site visit. Also the first real per-lead "checkout started" signal, since site_traffic_daily only ever counts anonymous aggregates.';

-- SECURITY — backend-only table, no anon/authenticated access of any kind.
--
-- Every read and write against this table already goes through server-side
-- code only (api/track-attribution.js's write path; every read in
-- api/_lib/attribution.js and the admin endpoints under api/admin/), all
-- using getSupabase()'s SERVICE ROLE key (see api/_lib/supabase.js's own
-- header comment) — a key which bypasses Row Level Security by design, so
-- this table's real access path is unaffected by the statement below.
--
-- RLS is enabled anyway, defensively: if an anon or authenticated
-- (browser-facing) Supabase key were ever pointed at this table by mistake
-- — directly, or through a future PostgREST/client-side integration nobody
-- has written yet — it must see and write NOTHING. Deliberately no policy
-- is created for any role. With RLS enabled and zero policies, every
-- non-bypassing role is denied by default; only a service-role (or
-- superuser) connection can read or write this table, which matches how
-- the application already uses it.
alter table lead_attribution enable row level security;

alter table customers
  add column if not exists sales_owner            text,
  add column if not exists first_utm_source         text,
  add column if not exists first_utm_medium          text,
  add column if not exists first_utm_campaign          text,
  add column if not exists first_utm_content            text,
  add column if not exists first_utm_term                 text,
  add column if not exists first_ghl_contact_id              text,
  add column if not exists first_ghl_campaign_id               text,
  add column if not exists first_attribution_at                 timestamptz,
  add column if not exists latest_utm_source                      text,
  add column if not exists latest_utm_medium                       text,
  add column if not exists latest_utm_campaign                      text,
  add column if not exists latest_utm_content                        text,
  add column if not exists latest_utm_term                             text,
  add column if not exists latest_ghl_contact_id                         text,
  add column if not exists latest_ghl_campaign_id                          text,
  add column if not exists latest_attribution_at                            timestamptz;

comment on column customers.sales_owner is
  'Nullable/optional. NULL = no owner assigned (displayed as Unassigned/Self-service). No team accounts, permissions, or round-robin logic exist yet — this is a foundation field only, per CRM-3A scope.';
comment on column customers.first_utm_source is
  'First-touch acquisition source, copied once from lead_attribution at checkout.session.completed and never overwritten thereafter (existing?.field || value pattern, matching attribution_method/source_lead_id in migration 0005).';
comment on column customers.latest_utm_source is
  'Latest-touch acquisition source — may update on a later resync, unlike the first_* columns.';

commit;
