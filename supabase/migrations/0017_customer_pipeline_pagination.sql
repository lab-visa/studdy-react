-- ============================================================
-- PENDING — NOT YET APPLIED TO PRODUCTION.
-- Written for CRM-3A (customer/subscription lifecycle round,
-- Sep 2026), branch `crm-3a`, based on `origin/main` with 0001-0016
-- already applied. Additive only: new indexes, one new extension
-- (pg_trgm — read-only text-search acceleration, changes nothing
-- about existing data or behavior), one new SQL function. Nothing
-- existing is dropped, renamed, retyped, or made NOT NULL. Do not
-- run against production until reviewed and approved.
-- ============================================================
--
-- 0017_customer_pipeline_pagination.sql
--
-- Removes the hard-coded PIPELINE_ROW_CAP=2000 ceiling from the
-- Customer & Subscription LIST view (api/admin/customers.js). Before
-- this migration, that endpoint fetched at most 2000 customer rows
-- into Node and filtered/sorted/paginated them in JavaScript — every
-- filter (plan, currency, payment status, cancellation status, group,
-- lifecycle stage) and the total count were therefore silently wrong
-- for any population past 2000 customers, and a customer beyond that
-- cutoff could never appear no matter what page was requested.
--
-- This migration pushes filtering, the derived lifecycle `stage`, an
-- exact total count, and pagination itself into one Postgres function
-- (search_customer_pipeline), called via supabase.rpc(). The customer
-- DETAIL drawer (api/admin/customer-detail.js) and Today's Actions
-- (api/admin/today-actions.js) are UNCHANGED by this migration — both
-- already operate on a single customer or an inherently small "today"
-- cohort, not the full population, so they keep using the existing
-- JS-side join in api/_lib/customer-pipeline.js.
--
-- STAGE LOGIC — deliberately duplicated, not shared:
--
--   The `stage` CASE expression below is a line-for-line SQL port of
--   deriveCustomerLifecycle() in api/_lib/lifecycle.js — same
--   priority order, same IST "today" boundary (via
--   `at time zone 'Asia/Kolkata'`, matching reporting-timezone.js's
--   own Asia/Kolkata bucketing), same "never invent a status" rule.
--   It has to be duplicated because filtering/sorting by a derived
--   value at database scale requires the database to compute that
--   value itself — there is no way to filter 100,000+ rows by a
--   value only JavaScript knows how to compute without either (a)
--   persisting `stage` as a column (rejected: the whole design point
--   of "stored vs. calculated" is that stage is NEVER persisted,
--   always recomputed from real stored facts) or (b) fetching every
--   row into JS regardless of filters (exactly the scalability bug
--   this migration exists to fix). test/cases/customer-pipeline-stage-parity.test.mjs
--   is the guard against the two implementations drifting apart — it
--   runs BOTH deriveCustomerLifecycle() and this SQL function against
--   the same synthetic rows and asserts identical `stage` output for
--   a wide matrix of states. If lifecycle.js's logic ever changes,
--   that test will fail until this function is updated to match.
--
-- TOTAL COUNT ON AN EMPTY PAGE — the "marker row" technique:
--
--   `count(*) over()` (a window function) only attaches to rows that
--   actually come back — if the requested page is empty (either zero
--   matches at all, or a valid total with an out-of-range page
--   number), a naive window-function query returns ZERO rows and the
--   caller has no way to read the total. This function instead computes
--   the total once via a sibling `total` CTE (count(*) FROM filtered,
--   independent of LIMIT/OFFSET) and LEFT JOINs it onto the (possibly
--   empty) page of rows: when the page has 0 rows, exactly ONE row
--   comes back with every customer field NULL and `total_count` set
--   correctly (the caller detects this via `id IS NULL`); when the
--   page has rows, `total_count` is simply repeated on every row.
--   Either way, the caller can always read an accurate total in the
--   same round trip, including for a genuinely empty result and for a
--   page number past the last page.
--
-- PERFORMANCE, HONESTLY:
--
--   An EXACT total count under arbitrary filters fundamentally
--   requires evaluating every matching row at least once — there is
--   no index structure that returns "the exact count of rows matching
--   this ad-hoc predicate" for free. This function keeps that cost as
--   low as real indexes allow: customer-level filters (search, date
--   range, country, sales_owner, access_status, trial/paid,
--   campaign source) run first, using the indexes below, to shrink
--   the candidate set BEFORE the more expensive per-customer LATERAL
--   lookups (latest subscription, open cancellation request, active
--   group) ever run — so a heavily-filtered query only pays the
--   per-customer join cost for the rows that survived the cheap
--   filters, not for the whole table. An unfiltered "show me
--   everyone" query is inherently the expensive case for ANY correct
--   design (there is no filter to shrink the candidate set) — that
--   cost is real and is not hidden by this design, only minimized.
--
-- SEARCH — ILIKE wildcards in user input (% and _) are escaped before
-- being wrapped in %...% (see the `params` CTE), so a search term
-- that happens to contain a literal % or _ is matched literally,
-- never treated as a wildcard the user didn't type.
--
-- CONSISTENCY UNDER CONCURRENT INSERTS — corrected claim (ChatGPT
-- review round 2): OFFSET/LIMIT pagination here is stable for TIES —
-- the `order by created_at desc, id asc` secondary key guarantees two
-- requests for the SAME page, against an UNCHANGED table, always
-- return the same rows in the same order (this is what
-- customer-pipeline-pagination.test.mjs's "no jump/duplicate across
-- pages" tests actually prove). It does NOT, and this comment
-- previously did not claim otherwise, but is now spelled out
-- explicitly to prevent that gap being read as a guarantee: provide a
-- fixed, consistent SNAPSHOT of the table across multiple page
-- requests made while OTHER rows are concurrently being inserted or
-- deleted. A row inserted between the caller reading page 1 and page 2
-- can shift every subsequent row's OFFSET position, which can (depending
-- on where the new row sorts) cause a row to be skipped or, more
-- rarely, repeated across those two requests — the classic, well-known
-- limitation of OFFSET pagination under concurrent writes, not
-- specific to this function. A true point-in-time snapshot would need
-- a keyset/cursor scheme (e.g. paginate strictly by (created_at, id) <
-- the last row seen, not by OFFSET) or a serializable-isolation read —
-- out of scope for this round; flagged here so nobody mistakes today's
-- design for something it is not.
--
-- SECURITY — least-privilege execution (ChatGPT review round 2,
-- search_path corrected in round 3 — see below):
--
--   SECURITY INVOKER is declared explicitly on the function below
--   (Postgres's actual default for a function with no SECURITY clause
--   at all — but written out here so it can never be silently changed
--   to SECURITY DEFINER by a future edit without that change being
--   obvious in review). Every table reference inside the function body
--   is schema-qualified (`public.customers`, not bare `customers`) and
--   the function pins its own `search_path = ''` (empty) for the
--   duration of every call — both are defense against the classic
--   Postgres "mutable search_path" attack, where a malicious or simply
--   differently-configured caller's own search_path could otherwise
--   cause this function to silently resolve `customers`/`subscriptions`/
--   etc. against an attacker-controlled schema/shadow table instead of
--   the real ones.
--
--   CORRECTION (ChatGPT review round 3): this previously pinned
--   `search_path = public, pg_catalog`, which the round-3 review
--   correctly flagged — listing `public` (a schema any role with
--   CREATE on it could add objects to) AHEAD of `pg_catalog` does not
--   actually defend against schema-shadowing the way this comment
--   claimed, and `pg_catalog` is in any case ALWAYS implicitly
--   searched first by Postgres regardless of what search_path says, so
--   there was never a genuine need to list either schema. An empty
--   search_path is the unambiguous fix: every built-in this function
--   calls (now(), coalesce, nullif, lower, greatest/least,
--   jsonb_build_object, array[...], casts, etc.) still resolves via
--   the always-searched pg_catalog; the only names that ever needed
--   schema-qualification were this project's own tables, which were
--   already qualified as `public.*` everywhere below and remain so —
--   nothing about the query logic changed, only the search_path value
--   itself. The pg_trgm GIN indexes below need no qualification change
--   either: index selection is a planner/catalog decision tied to the
--   qualified table reference in the query, not to search_path.
--   test/cases/customer-pipeline-function-privileges.test.mjs's
--   catalog-level search_path test now asserts the exact corrected
--   value, not merely that some search_path is set.
--
--   EXECUTE on the function itself is REVOKEd from
--   PUBLIC and explicitly from `anon`/`authenticated` (Supabase's two
--   browser-facing roles) and GRANTed only to `service_role` — the role
--   behind this backend's own service-role Supabase key (see
--   api/_lib/supabase.js). See the REVOKE/GRANT block after the
--   function body, and
--   test/cases/customer-pipeline-function-privileges.test.mjs, which
--   proves this behaviorally (a real, non-superuser, non-BYPASSRLS
--   Postgres role denied EXECUTE while `service_role` succeeds) rather
--   than merely asserting the SQL text says so.

begin;

-- ---- Indexes: customer-level filters (evaluated first, see above) ----
create index if not exists customers_created_at_idx  on customers (created_at desc);
create index if not exists customers_sales_owner_idx  on customers (sales_owner);
create index if not exists customers_lifecycle_idx     on customers (lifecycle);
-- customers_country_idx / customers_access_status_idx (access_status)
-- already exist (migration 0005) — access_status's is customers_access_status_idx.
create index if not exists customers_country_idx        on customers (country);

-- ---- Indexes: per-customer LATERAL lookups (evaluated only for surviving candidates) ----
create index if not exists subscriptions_customer_created_idx
  on subscriptions (customer_id, created_at desc);
create index if not exists subscriptions_plan_type_idx on subscriptions (plan_type);
create index if not exists subscriptions_currency_idx  on subscriptions (currency);
create index if not exists cancellation_requests_customer_requested_idx
  on cancellation_requests (customer_id, requested_at desc);
-- account_assignments already has a unique partial index on
-- (customer_id) WHERE status='active' (migration 0007) — the active-
-- group LATERAL lookup below is already effectively O(1) against it.

-- ---- Free-text search: name / email / phone / paid_id ----
-- pg_trgm lets a plain ILIKE '%term%' use a GIN index instead of a
-- sequential scan — the standard, Supabase-supported approach for
-- substring search at scale. Search terms under 3 characters fall
-- back to a slower scan for that one query (trigram indexes need at
-- least 3 characters to build a useful trigram) — still correct,
-- just not accelerated; acceptable since short searches are rare and
-- this never affects correctness, only speed.
-- Pinned to `public` explicitly (not "whatever schema happens to be
-- first in search_path right now") — extensions are database-global,
-- but their member objects (gin_trgm_ops etc.) are only visible to a
-- search_path that includes the schema they were actually installed
-- into. `public` is reliably present on every reasonable search_path
-- (including every one this codebase's own migration runner and test
-- harness use — see test/helpers/db.mjs), so pinning it here is what
-- makes this index usable from any schema, not just whichever one
-- happened to run this migration first.
create extension if not exists pg_trgm schema public;

create index if not exists customers_name_trgm_idx  on customers using gin (name gin_trgm_ops);
create index if not exists customers_email_trgm_idx on customers using gin (email gin_trgm_ops);
create index if not exists customers_phone_trgm_idx on customers using gin (phone gin_trgm_ops);
create index if not exists customers_paid_id_trgm_idx on customers using gin (paid_id gin_trgm_ops);

-- ---- The search/paginate function itself ----
create or replace function search_customer_pipeline(
  p_search                  text default null,
  p_from                    timestamptz default null,
  p_to                      timestamptz default null,
  p_country                 text default null,
  p_sales_owner             text default null,
  p_sales_owner_unassigned  boolean default false,
  p_access_status           text default null,
  p_plan                    text default null,
  p_currency                text default null,
  p_campaign_source         text default null,
  p_payment_status          text default null,
  p_trial_or_paid           text default null,
  p_cancellation_status     text default null,
  p_group_name              text default null,
  p_stage                   text default null,
  p_limit                   int default 50,
  p_offset                  int default 0
)
returns table (
  id                        uuid,
  paid_id                   text,
  name                      text,
  email                     text,
  phone                     text,
  country                   text,
  sales_owner               text,
  plan_type                 text,
  currency                  text,
  stripe_customer_id        text,
  stripe_subscription_id    text,
  trial_start               timestamptz,
  trial_end                 timestamptz,
  current_period_end        timestamptz,
  first_utm_source          text,
  first_utm_campaign        text,
  latest_utm_source         text,
  latest_utm_campaign       text,
  group_name                text,
  cancellation_status       text,
  stage                     text,
  lifecycle                 jsonb,
  created_at                timestamptz,
  total_count                bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      nullif(btrim(p_search), '') as search_raw,
      -- Escape literal % and _ (and the escape char itself) before
      -- wrapping in %...% below, so user-typed wildcard characters
      -- are matched literally rather than as ILIKE wildcards.
      case when nullif(btrim(p_search), '') is not null then
        replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_')
      end as search_esc
  ),
  today as (
    select (now() at time zone 'Asia/Kolkata')::date as ist_today
  ),
  customer_base as (
    select c.*
    from public.customers c, params p
    where
      (p.search_esc is null or
        c.name ilike '%' || p.search_esc || '%' escape '\' or
        c.email ilike '%' || p.search_esc || '%' escape '\' or
        c.phone ilike '%' || p.search_esc || '%' escape '\' or
        c.paid_id ilike '%' || p.search_esc || '%' escape '\')
      and (p_from is null or c.created_at >= p_from)
      and (p_to is null or c.created_at < p_to)
      and (p_country is null or c.country = p_country)
      and (
        (p_sales_owner_unassigned and c.sales_owner is null)
        or (not p_sales_owner_unassigned and p_sales_owner is null)
        or (not p_sales_owner_unassigned and c.sales_owner = p_sales_owner)
      )
      and (p_access_status is null or c.access_status = p_access_status)
      and (
        p_trial_or_paid is null
        or (p_trial_or_paid = 'trial' and c.lifecycle = 'trial')
        or (p_trial_or_paid = 'paid' and c.lifecycle in ('converted', 'retained'))
      )
      and (
        p_campaign_source is null
        or lower(c.latest_utm_source) = lower(p_campaign_source)
        or lower(c.first_utm_source) = lower(p_campaign_source)
      )
  ),
  joined as (
    select
      cb.*,
      ls.plan_type, ls.currency, ls.stripe_subscription_id, ls.status as sub_status,
      ls.trial_start, ls.trial_end, ls.current_period_end,
      coalesce(ls.cancel_at_period_end, false) as cancel_at_period_end,
      oc.status as open_cancellation_status,
      ag.group_name
    from customer_base cb
    left join lateral (
      select s.*
      from public.subscriptions s
      where s.customer_id = cb.id
      order by s.created_at desc
      limit 1
    ) ls on true
    left join lateral (
      select cr.status
      from public.cancellation_requests cr
      where cr.customer_id = cb.id
        and cr.status = any (array['pending_discussion', 'approved_for_cancellation', 'cancel_scheduled'])
      order by cr.requested_at desc
      limit 1
    ) oc on true
    left join lateral (
      select sa.group_name
      from public.account_assignments aa
      join public.studdy_accounts sa on sa.id = aa.studdy_account_id
      where aa.customer_id = cb.id and aa.status = 'active'
      limit 1
    ) ag on true
  ),
  staged as (
    select
      j.*,
      -- Line-for-line port of deriveCustomerLifecycle() in
      -- api/_lib/lifecycle.js — see the module-level comment above
      -- for why this is intentionally duplicated, and the parity
      -- test that guards against drift.
      case
        when j.stripe_subscription_id is null then 'No subscription synced'
        when j.sub_status = 'cancelled' then
          (case when j.access_status = 'ended' then 'Access removed' else 'Cancelled' end)
        when j.cancel_at_period_end and j.sub_status <> 'cancelled' then 'Cancelling at period end'
        when j.access_status = 'grace' then 'Retry / grace period'
        when j.sub_status = 'past_due' then 'Payment failed'
        when j.sub_status = 'trialing' and j.trial_end is not null
          and (j.trial_end at time zone 'Asia/Kolkata')::date = (select ist_today from today)
          then 'Trial ending today'
        when j.sub_status = 'trialing' then 'Trial active'
        when j.sub_status in ('active', 'past_due') and j.current_period_end is not null
          and (j.current_period_end at time zone 'Asia/Kolkata')::date = (select ist_today from today)
          then 'Payment due today'
        when j.sub_status = 'active' then 'Active paid'
        when j.sub_status is not null then 'Unmapped (' || j.sub_status || ')'
        else 'Unknown'
      end as computed_stage
    from joined j
  ),
  filtered as (
    select *
    from staged
    where
      (p_plan is null or plan_type = p_plan)
      and (p_currency is null or currency = p_currency)
      and (p_payment_status is null or sub_status = p_payment_status)
      and (
        p_cancellation_status is null
        or (p_cancellation_status = 'requested' and open_cancellation_status is not null)
        or (p_cancellation_status = 'none' and open_cancellation_status is null)
      )
      and (p_group_name is null or group_name = p_group_name)
      and (p_stage is null or computed_stage = p_stage)
  ),
  total as (
    select count(*) as n from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, id asc
    -- Defense in depth (ChatGPT review round 2): api/admin/customers.js
    -- already only ever sends p_limit in {50, 100} and clamps the page
    -- number before computing p_offset (see parsePage()'s MAX_PAGE
    -- there), but this function is itself the actual security/scale
    -- boundary — it must not trust a well-behaved caller to be the
    -- only caller. p_limit is clamped to [1, 100] regardless of what's
    -- passed in, and p_offset to a sane, comfortably-int4-safe upper
    -- bound, so this can never be made to do an unbounded-size fetch
    -- or overflow an int4 OFFSET no matter what calls it directly.
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    offset least(greatest(coalesce(p_offset, 0), 0), 2000000000)
  )
  select
    pg.id, pg.paid_id, pg.name, pg.email, pg.phone, pg.country, pg.sales_owner,
    pg.plan_type, pg.currency, pg.stripe_customer_id, pg.stripe_subscription_id,
    pg.trial_start, pg.trial_end, pg.current_period_end,
    pg.first_utm_source, pg.first_utm_campaign, pg.latest_utm_source, pg.latest_utm_campaign,
    pg.group_name, pg.open_cancellation_status as cancellation_status,
    pg.computed_stage as stage,
    jsonb_build_object(
      'stage', pg.computed_stage,
      'stored', jsonb_build_object(
        'subscription_status', pg.sub_status,
        'access_status', pg.access_status,
        'lifecycle', pg.lifecycle,
        'cancel_at_period_end', pg.cancel_at_period_end
      ),
      'calculated', jsonb_build_object(
        'trial_ending_today', (pg.computed_stage = 'Trial ending today'),
        'payment_due_today', (pg.computed_stage = 'Payment due today'),
        'cancelling_at_period_end', (pg.computed_stage = 'Cancelling at period end')
      ),
      'flags', jsonb_build_object(
        'cancellation_requested', (pg.open_cancellation_status is not null),
        -- Dispute/refund flags are deliberately NOT computed here —
        -- the list view never displays them (only stage/plan/source/
        -- sales owner/group — see CustomerTable in
        -- CustomerSubscriptionPipeline.tsx), and computing a
        -- payment_events correlated EXISTS for every row of an
        -- unfiltered 100,000-row query would add real cost for a
        -- value nothing renders. The customer DETAIL drawer (a
        -- single customer) still computes these accurately via the
        -- unchanged withLifecycle() JS path.
        'disputed', false,
        'refunded', false,
        'access_removal_pending', (pg.access_status = 'ended')
      )
    ) as lifecycle,
    pg.created_at,
    t.n as total_count
  from total t
  left join paged pg on true
  order by pg.created_at desc nulls last, pg.id asc nulls last;
$$;

comment on function search_customer_pipeline is
  'CRM-3A Customer & Subscription pipeline list: filters, derives lifecycle stage, and paginates the FULL customer population server-side (no PIPELINE_ROW_CAP-style ceiling). Returns an exact total_count on every call, including an empty page, via a LEFT JOIN "marker row" (see this migration''s own header comment). stage logic is a deliberate, tested-for-parity duplicate of api/_lib/lifecycle.js''s deriveCustomerLifecycle(). SECURITY INVOKER; search_path pinned to empty (corrected in round 3 from public,pg_catalog — see this migration''s own header comment); EXECUTE restricted to service_role only — see the REVOKE/GRANT statements immediately below.';

-- ---- Least-privilege execution (ChatGPT review round 2) ----
--
-- PUBLIC gets EXECUTE on every newly-created function by default in
-- Postgres — that default is exactly wrong for a function returning
-- full customer PII (name/email/phone/address) across the entire
-- population. Only the backend's own service-role connection
-- (api/_lib/supabase.js) may ever call this. anon/authenticated
-- (Supabase's two browser-facing roles, used by PostgREST for
-- unauthenticated and logged-in end-user requests respectively) are
-- revoked explicitly and separately from PUBLIC below, as defense in
-- depth — belt-and-braces, not merely relying on the PUBLIC revoke
-- alone to cover them.
revoke all on function search_customer_pipeline(
  text, timestamptz, timestamptz, text, text, boolean, text, text, text,
  text, text, text, text, text, text, int, int
) from public;

revoke execute on function search_customer_pipeline(
  text, timestamptz, timestamptz, text, text, boolean, text, text, text,
  text, text, text, text, text, text, int, int
) from anon, authenticated;

grant execute on function search_customer_pipeline(
  text, timestamptz, timestamptz, text, text, boolean, text, text, text,
  text, text, text, text, text, text, int, int
) to service_role;

commit;
