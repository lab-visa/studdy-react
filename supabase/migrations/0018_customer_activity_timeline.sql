-- ============================================================
-- PENDING — NOT YET APPLIED TO PRODUCTION.
-- Written for CRM-3A (customer/subscription lifecycle round,
-- Sep 2026), branch `crm-3a`, ChatGPT review round 3. Additive
-- only: one new SQL function, two new indexes. Nothing existing
-- is dropped, renamed, retyped, or made NOT NULL. Do not run
-- against production until reviewed and approved.
--
-- NOTE ON NUMBERING: docs/customer-activity-events-ledger-proposal.md
-- (round 2) originally sketched its still-unimplemented, still-
-- proposed-only audit ledger table as "0018_customer_activity_events.sql".
-- That table has NOT been built — this file is a different, real
-- migration that claims the 0018 slot instead, so the migration
-- sequence stays gap-free. The proposal doc has been updated to say
-- 0020 for if/when it is ever approved and built (moved again from its
-- first renumbering to 0019 once migration 0019_restrict_rls_auto_enable.sql
-- — an unrelated Round-5 security fix — claimed that slot in turn).
-- ============================================================
--
-- 0018_customer_activity_timeline.sql
--
-- ChatGPT review round 3, blocker 1 — genuine SERVER-SIDE, CURSOR-
-- PAGINATED Activity Timeline. Round 2 removed the silent
-- TIMELINE_ROW_CAP=500 truncation but still fetched EVERY source row
-- (payment_events, cancellation_requests, account_assignments) into
-- Node on every request and paginated the merged array in memory —
-- correct today, but still vulnerable to Supabase/PostgREST's
-- configured maximum-returned-rows limit (commonly 1,000) the moment
-- any single-customer source table (almost always payment_events)
-- grows past it, since the OLD code fetched that table with no
-- LIMIT/range at all via supabase-js/PostgREST. This migration moves
-- the merge, sort, and pagination itself into Postgres — the API
-- layer (api/admin/customer-detail.js) now asks this ONE function for
-- exactly one bounded page of already-merged, already-sorted events,
-- and never pulls a whole source table into Node again.
--
-- SOURCES MERGED (same set api/admin/customer-detail.js's now-removed
-- buildActivityTimeline() merged in JS — see that file's git history
-- for the line-for-line predecessor of every CASE/branch below):
--   checkout_started        <- lead_attribution.first_touched_at
--   customer_created        <- customers.created_at
--   access_assigned/
--   access_released         <- account_assignments.assigned_at/released_at
--   attribution_recorded/
--   attribution_updated     <- customers.first_attribution_at/latest_attribution_at
--   payment_event           <- payment_events (dedup already guaranteed by its
--                              stripe_event_id unique constraint — see
--                              logPaymentEvent() in sync-customer.js)
--   cancellation_requested/
--   cancellation_discussed/
--   cancellation_resolved   <- cancellation_requests.requested_at/discussed_at/
--                              resolved_at (ChatGPT review round 4 — these three
--                              columns, plus status/resolution, ARE an
--                              authoritative timestamped source and were
--                              previously and incorrectly treated as absent;
--                              see "HONESTLY, WHAT THIS DOES NOT COVER" below
--                              for what is still genuinely missing)
--   subscription_cancelled  <- EVERY genuinely cancelled subscription row for
--                              this customer (not just the most recent one —
--                              see "MULTIPLE SUBSCRIPTIONS PER CUSTOMER"
--                              below), each labeled from its own
--                              cancelled_at/ended_at using the same precedence
--                              this round's cancellation-timestamp fix already
--                              established in sync-customer.js, never
--                              re-derived here
--
-- MULTIPLE SUBSCRIPTIONS PER CUSTOMER (ChatGPT review round 4 — a real
-- correctness bug, not a style nit): the `subscriptions` table has no
-- database constraint limiting a customer to one row — migration 0006
-- only makes `stripe_subscription_id` globally unique, nothing enforces
-- "at most one subscription per customer_id". A customer who cancels
-- one subscription and later starts a second, separate one is entirely
-- possible (and, per real Stripe usage, not even rare — a lapsed
-- customer resubscribing is exactly this shape). The PREVIOUS version
-- of this function picked only the most-recently-CREATED subscription
-- via a `latest_subscription` CTE (`order by created_at desc limit 1`)
-- and would therefore silently drop an earlier cancellation from the
-- timeline the moment a newer subscription existed — a real information
-- loss, not just an edge case. This function now emits ONE entry per
-- QUALIFYING (status='cancelled') subscription row, keyed on that
-- row's own `subscriptions.id` (not the customer's id), so every
-- genuine past cancellation stays visible regardless of how many
-- subscriptions came after it.
--
-- SUBSCRIPTION-CANCELLATION LABELS (ChatGPT review round 4 — now
-- three-way, not a two-way coalesce): each qualifying row's label and
-- `occurred_at` come from THAT row's own fields, not a blended
-- coalesce(cancelled_at, ended_at) that obscured which field actually
-- fired:
--   cancelled_at present                      -> "Subscription cancelled"
--   ended_at present, cancelled_at absent     -> "Subscription ended"
--   status='cancelled', BOTH timestamps null  -> "Cancelled — exact date unavailable"
-- A subscription with a FUTURE-scheduled cancellation (`cancel_at` set,
-- `cancel_at_period_end=true`) is never shown as a completed
-- cancellation — it is gated out entirely by the `status = 'cancelled'`
-- filter below, since Stripe/sync-customer.js never flips `status` to
-- 'cancelled' until the subscription has actually ended; a schedule is
-- not a completed fact (same principle the predecessor JS
-- buildCancellationEntry() already documented, preserved here).
--
-- HONESTLY, WHAT THIS DOES NOT COVER — this function paginates
-- COMPLETELY over every event source actually IMPLEMENTED above; it is
-- NOT a complete audit history of "every activity" and must never be
-- described as one. Specifically still missing, because no
-- authoritative source exists anywhere in the schema for them today
-- (see docs/customer-activity-events-ledger-proposal.md, migration
-- 0020, PROPOSED ONLY, not built): Sales Owner change history (only
-- the current value is stored, with no log of who owned a customer
-- before) and plan/billing changes (nothing in this codebase logs a
-- plan_type/currency change as an event). Separately, and more subtly:
-- the three cancellation_requests entries above surface the three
-- TIMESTAMPS this table actually stores (requested_at/discussed_at/
-- resolved_at) — they do NOT reconstruct every intermediate status
-- transition a request may have gone through (e.g. if a request's
-- `status` column were updated more than once before `resolved_at` was
-- finally set, only the LAST value is visible — cancellation_requests
-- itself is not an append-only ledger, it is a single mutable row per
-- request). A genuine transition-by-transition history for this, like
-- for Sales Owner/plan changes, would need the proposed 0020 ledger.
--
-- STABLE PAGINATION KEY — genuinely unique, not merely "usually
-- unique": every event_key below is built from the real immutable
-- primary key of the row it came from (payment_events.id,
-- cancellation_requests.id, account_assignments.id, subscriptions.id,
-- lead_attribution.lead_id) or, for the handful of entries synthesized
-- directly from a single customers row (customer_created, the two
-- attribution entries), from customers.id plus a fixed suffix that can
-- never collide with another entry for the SAME customer. Ordering is
-- `(sort_at desc, event_key desc)` throughout — two events sharing the
-- exact same instant (a real, tested case — see
-- test/cases/customer-activity-timeline-function.test.mjs) always
-- resolve to the same relative order on every call, and a keyset
-- cursor built from BOTH columns can never skip or repeat a row at a
-- tie boundary, unlike the round-2 JS tie-break (event `type` alone,
-- which is not unique when two same-type events share a timestamp).
--
-- CURSOR (KEYSET) PAGINATION, NOT OFFSET — per this round's explicit
-- preference. The caller passes back the LAST row's (sort_at,
-- event_key) it received as p_cursor_sort_at/p_cursor_event_key; this
-- function returns only rows strictly after that point in the
-- `(sort_at desc, event_key desc)` ordering. Unlike OFFSET pagination
-- (migration 0017's search_customer_pipeline, which explicitly
-- documents this same tradeoff), a row inserted or changed between two
-- page requests can never shift where an UNRELATED row's cursor
-- position falls — keyset pagination is stable under concurrent writes
-- in a way OFFSET fundamentally is not. This function still cannot
-- promise a perfect point-in-time SNAPSHOT across multiple requests (a
-- brand new event landing exactly at the caller's last-seen instant is
-- an inherent, well-known edge case of any live, growing event log,
-- not specific to this design) — flagged honestly, not claimed away.
-- A malformed/partial cursor (exactly one of the two params given, not
-- both) is treated as NO cursor — start over from the newest row —
-- rather than raising, matching this codebase's established
-- "never crash on bad input, degrade gracefully" convention
-- (parsePage/parsePageSize in api/admin/customers.js,
-- parseTimelinePage/PageSize before this round).
--
-- TOTAL COUNT / HAS_MORE ON AN EMPTY PAGE — same "marker row" LEFT
-- JOIN technique migration 0017 already established (see that file's
-- own header comment for the full rationale): a cursor past the last
-- real row still returns exactly one row, all event fields null,
-- total_count/has_more correct, so the caller can always read an
-- accurate total and "is there more" in the same round trip.
--
-- SCOPE, HONESTLY: like search_customer_pipeline's own "not the full
-- population" note, this function is scoped to ONE customer's own
-- event history, not the whole `customers` table — a volume bounded by
-- real subscription/billing/access activity for a single account, not
-- by an attacker-controlled population size. That is what makes
-- merging six different source tables with a plain UNION ALL (no
-- per-source pre-limiting) safe here in a way it would not be at
-- customer-LIST scale.
--
-- SECURITY — same least-privilege pattern as search_customer_pipeline
-- (migration 0017), corrected this round per the review's search_path
-- feedback: SECURITY INVOKER is declared explicitly, every table
-- reference is schema-qualified (`public.customers`, never bare
-- `customers`), and the function pins `search_path = ''` (empty) for
-- the duration of every call — NOT `public, pg_catalog`. An empty
-- search_path cannot be shadowed by ANY caller-writable schema,
-- including one named `public` itself; `pg_catalog` is always
-- implicitly searched first by Postgres regardless of search_path
-- (documented Postgres behavior — "the system catalog schema is always
-- searched, whether it is mentioned in the path or not"), so every
-- built-in this function calls (now(), coalesce, nullif, concat_ws,
-- count, casts, etc.) still resolves correctly with search_path=''; the
-- only names that need explicit schema-qualification are this
-- project's own tables, which are already schema-qualified everywhere
-- below. migration 0017's search_customer_pipeline is corrected to
-- `search_path = ''` in the same spirit, directly in that (still
-- PENDING, never-applied) file — see its own header comment — rather
-- than patched here; the previous `public, pg_catalog` ordering was
-- flagged by this round's review as claiming search_path protection
-- while still listing a caller-writable schema (public) ahead of the
-- always-searched pg_catalog, which is not actually a meaningful
-- defense against a schema-shadowing attack the way a genuinely empty
-- search_path is.
-- EXECUTE is REVOKEd from PUBLIC/anon/authenticated and GRANTed only
-- to service_role, exactly like search_customer_pipeline — see the
-- REVOKE/GRANT block below and
-- test/cases/customer-activity-timeline-function.test.mjs, which
-- proves this behaviorally with a real, non-superuser, non-BYPASSRLS
-- probe role.

begin;

-- ---- Indexes: helps the per-customer UNION ALL sort at real volume ----
-- account_assignments never got a plain customer_id index (0007 only
-- indexed studdy_account_id/status, plus a partial unique index on
-- customer_id WHERE status='active' that does not cover a full
-- assign/release HISTORY scan) — this function is the first query to
-- need one.
create index if not exists account_assignments_customer_idx
  on account_assignments (customer_id);
create index if not exists payment_events_customer_occurred_idx
  on payment_events (customer_id, occurred_at desc);

-- ---- The single-customer activity timeline function itself ----
create or replace function search_customer_activity_timeline(
  p_customer_id       uuid,
  p_page_size         int default 50,
  p_cursor_sort_at    timestamptz default null,
  p_cursor_event_key  text default null
)
returns table (
  event_key    text,
  event_type   text,
  label        text,
  detail       text,
  source       text,
  occurred_at  timestamptz,
  amount       numeric,
  currency     text,
  status       text,
  reason       text,
  sort_at      timestamptz,
  total_count  bigint,
  has_more     boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_page_size int;
  -- A malformed/partial cursor (exactly one of the pair supplied) is
  -- treated as no cursor at all, never an error — see this migration's
  -- header comment.
  v_has_cursor boolean := (p_cursor_sort_at is not null and p_cursor_event_key is not null);
begin
  if p_customer_id is null then
    raise exception 'search_customer_activity_timeline: p_customer_id is required';
  end if;

  if not exists (select 1 from public.customers c where c.id = p_customer_id) then
    raise exception 'search_customer_activity_timeline: customer % not found', p_customer_id
      using errcode = 'P0002';
  end if;

  -- Defense in depth (same reasoning as search_customer_pipeline's
  -- p_limit clamp): the API layer already only ever sends 25/50/100,
  -- but this function is itself the real boundary and must not trust a
  -- well-behaved caller to be the only caller.
  v_page_size := least(greatest(coalesce(p_page_size, 50), 1), 100);

  return query
  with events as (
    select
      'lead_attribution:' || la.lead_id                       as event_key,
      'checkout_started'                                       as event_type,
      'Checkout started'                                        as label,
      null::text                                                 as detail,
      'lead_attribution.first_touched_at'                         as source,
      la.first_touched_at                                          as occurred_at,
      null::numeric                                                 as amount,
      null::text                                                     as currency,
      null::text                                                      as status,
      null::text                                                       as reason,
      la.first_touched_at                                               as sort_at
    from public.customers c
    join public.lead_attribution la on la.lead_id = c.source_lead_id
    where c.id = p_customer_id and la.first_touched_at is not null

    union all

    select
      'customers:' || c.id::text || ':created',
      'customer_created',
      'Trial started / customer created',
      null::text,
      'customers.created_at',
      c.created_at,
      null::numeric, null::text, null::text, null::text,
      c.created_at
    from public.customers c
    where c.id = p_customer_id and c.created_at is not null

    union all

    select
      'account_assignments:' || aa.id::text || ':assigned',
      'access_assigned',
      'Access assigned' || coalesce(' — ' || sa.group_name, ''),
      null::text,
      'account_assignments.assigned_at',
      aa.assigned_at,
      null::numeric, null::text, null::text, null::text,
      aa.assigned_at
    from public.account_assignments aa
    left join public.studdy_accounts sa on sa.id = aa.studdy_account_id
    where aa.customer_id = p_customer_id and aa.assigned_at is not null

    union all

    select
      'account_assignments:' || aa.id::text || ':released',
      'access_released',
      'Access released' || coalesce(' — ' || sa.group_name, ''),
      null::text,
      'account_assignments.released_at',
      aa.released_at,
      null::numeric, null::text, null::text, null::text,
      aa.released_at
    from public.account_assignments aa
    left join public.studdy_accounts sa on sa.id = aa.studdy_account_id
    where aa.customer_id = p_customer_id and aa.released_at is not null

    union all

    select
      'customers:' || c.id::text || ':attribution_first',
      'attribution_recorded',
      'Campaign attribution recorded (first touch)',
      nullif(concat_ws(' / ', nullif(c.first_utm_source, ''), nullif(c.first_utm_campaign, '')), ''),
      'customers.first_attribution_at',
      c.first_attribution_at,
      null::numeric, null::text, null::text, null::text,
      c.first_attribution_at
    from public.customers c
    where c.id = p_customer_id and c.first_attribution_at is not null

    union all

    select
      'customers:' || c.id::text || ':attribution_latest',
      'attribution_updated',
      'Campaign attribution updated (latest touch)',
      nullif(concat_ws(' / ', nullif(c.latest_utm_source, ''), nullif(c.latest_utm_campaign, '')), ''),
      'customers.latest_attribution_at',
      c.latest_attribution_at,
      null::numeric, null::text, null::text, null::text,
      c.latest_attribution_at
    from public.customers c
    where c.id = p_customer_id
      and c.latest_attribution_at is not null
      and c.latest_attribution_at is distinct from c.first_attribution_at

    union all

    select
      'payment_events:' || pe.id::text,
      'payment_event',
      case pe.event_type
        when 'invoice.payment_succeeded' then 'Payment succeeded'
        when 'invoice.payment_failed'    then 'Payment failed'
        when 'refund.created'            then 'Refund issued'
        when 'charge.dispute.created'    then 'Dispute opened'
        when 'charge.dispute.closed'     then 'Dispute closed'
        else pe.event_type
      end,
      null::text,
      'payment_events (' || pe.event_type || ')',
      pe.occurred_at,
      pe.amount, pe.currency, pe.status, null::text,
      pe.occurred_at
    from public.payment_events pe
    where pe.customer_id = p_customer_id

    union all

    select
      'cancellation_requests:' || cr.id::text || ':requested',
      'cancellation_requested',
      'Cancellation requested',
      null::text,
      'cancellation_requests.requested_at',
      cr.requested_at,
      null::numeric, null::text, null::text, cr.reason,
      cr.requested_at
    from public.cancellation_requests cr
    where cr.customer_id = p_customer_id

    union all

    select
      'cancellation_requests:' || cr.id::text || ':discussed',
      'cancellation_discussed',
      'Cancellation discussed',
      null::text,
      'cancellation_requests.discussed_at',
      cr.discussed_at,
      null::numeric, null::text, null::text, null::text,
      cr.discussed_at
    from public.cancellation_requests cr
    where cr.customer_id = p_customer_id and cr.discussed_at is not null

    union all

    select
      'cancellation_requests:' || cr.id::text || ':resolved',
      'cancellation_resolved',
      'Cancellation resolved: ' || cr.status,
      cr.resolution,
      'cancellation_requests.resolved_at',
      cr.resolved_at,
      null::numeric, null::text, null::text, null::text,
      cr.resolved_at
    from public.cancellation_requests cr
    where cr.customer_id = p_customer_id and cr.resolved_at is not null

    union all

    -- ChatGPT review round 4: EVERY qualifying (status='cancelled')
    -- subscription row for this customer, keyed on that row's OWN id —
    -- not just the most-recently-created subscription — so an earlier
    -- cancellation is never dropped just because the customer later
    -- started a second subscription (see "MULTIPLE SUBSCRIPTIONS PER
    -- CUSTOMER" in this file's header comment). Each row's label comes
    -- from its OWN cancelled_at/ended_at, never blended with another
    -- row's. Same precedence sync-customer.js's recordSubscriptionEnded()/
    -- syncSubscriptionUpdated() use when WRITING these columns
    -- (cancelled_at, then ended_at) — never re-derived or guessed here,
    -- only displayed. cancel_at (a FUTURE schedule) is deliberately
    -- never used — see buildCancellationEntry()'s predecessor comment,
    -- preserved in this file's own header.
    select
      'subscriptions:' || s.id::text || ':cancelled',
      'subscription_cancelled',
      case
        when s.cancelled_at is not null then 'Subscription cancelled'
        when s.ended_at is not null then 'Subscription ended'
        else 'Cancelled — exact date unavailable'
      end,
      null::text,
      case
        when s.cancelled_at is not null then 'subscriptions.cancelled_at'
        when s.ended_at is not null then 'subscriptions.ended_at'
        else null
      end,
      case
        when s.cancelled_at is not null then s.cancelled_at
        when s.ended_at is not null then s.ended_at
        else null
      end,
      null::numeric, null::text, null::text, null::text,
      -- Sort position for the "exact date unavailable" case only —
      -- never returned/displayed as the cancellation date itself.
      coalesce(s.cancelled_at, s.ended_at, s.updated_at, s.created_at)
    from public.subscriptions s
    where s.customer_id = p_customer_id and s.status = 'cancelled'
  ),
  candidate as (
    select *
    from events e
    where
      not v_has_cursor
      or (e.sort_at, e.event_key) < (p_cursor_sort_at, p_cursor_event_key)
    order by e.sort_at desc, e.event_key desc
    limit v_page_size + 1
  ),
  page as (
    select * from candidate order by sort_at desc, event_key desc limit v_page_size
  ),
  total as (
    select count(*) as n from events
  ),
  more as (
    select (select count(*) from candidate) > v_page_size as flag
  )
  select
    pg.event_key, pg.event_type, pg.label, pg.detail, pg.source,
    pg.occurred_at, pg.amount, pg.currency, pg.status, pg.reason,
    pg.sort_at,
    t.n as total_count,
    m.flag as has_more
  from total t
  cross join more m
  left join page pg on true
  order by pg.sort_at desc nulls last, pg.event_key desc nulls last;
end;
$$;

comment on function search_customer_activity_timeline is
  'CRM-3A Activity Timeline: paginates COMPLETELY, server-side, over every event source actually IMPLEMENTED for ONE customer (checkout_started, customer_created, access_assigned/released, attribution_recorded/updated, payment_event, cancellation_requested/discussed/resolved, subscription_cancelled — the last emitting one entry per qualifying subscription row, not just the latest) via keyset/cursor (sort_at, event_key), not OFFSET. This is NOT a complete "every activity" audit history: Sales Owner change history and plan/billing changes have no authoritative source in the schema yet, and the three cancellation_requests entries surface the timestamps that table actually stores, not every intermediate status transition — see docs/customer-activity-events-ledger-proposal.md (migration 0020, proposed only) and this migration''s own header comment. Returns an exact total_count and has_more on every call, including a cursor past the last row, via the same LEFT JOIN "marker row" technique search_customer_pipeline uses. Raises if the customer does not exist. SECURITY INVOKER; search_path pinned to empty (not merely public,pg_catalog); EXECUTE restricted to service_role only — see the REVOKE/GRANT statements immediately below.';

-- ---- Least-privilege execution (same pattern as search_customer_pipeline) ----
revoke all on function search_customer_activity_timeline(
  uuid, int, timestamptz, text
) from public;

revoke execute on function search_customer_activity_timeline(
  uuid, int, timestamptz, text
) from anon, authenticated;

grant execute on function search_customer_activity_timeline(
  uuid, int, timestamptz, text
) to service_role;

-- NOTE: migration 0017's search_customer_pipeline is corrected to
-- `search_path = ''` directly IN THAT FILE (0017 is still PENDING —
-- never applied to production — so it is edited in place rather than
-- patched here with a separate ALTER FUNCTION, exactly like every
-- other round-3 correction to still-pending migrations in this repo).
-- See 0017_customer_pipeline_pagination.sql's own header comment for
-- the full rationale.

commit;
