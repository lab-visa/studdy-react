-- ============================================================
-- NEW / PENDING — NOT YET APPLIED TO PRODUCTION.
-- Run once, manually, in the Supabase SQL Editor, after 0014 is
-- verified applied. See CRM-1 Objective 3 (Revision 2.1 correction).
-- ============================================================
--
-- 0015_payment_claims.sql
--
-- Closes a concurrency gap found in review of the original Objective 3
-- design: a plain "SELECT payment_events, then decide" check is two
-- separate statements, so two near-simultaneous deliveries of the exact
-- same Stripe invoice.payment_succeeded event can both pass the SELECT
-- before either writes, and both then increment leads.total_months_paid.
--
-- payment_claims is a tiny, dedicated table whose only job is to be the
-- one atomic gate a webhook handler checks BEFORE incrementing the
-- legacy leads.total_months_paid counter. It is deliberately NOT
-- payment_events — payment_events is written by the existing best-effort,
-- try/catch-wrapped new-CRM bookkeeping path (recordPaymentSucceeded),
-- which also does customer/subscription lookups that can legitimately
-- fail or lag. The legacy path's correctness must never depend on that
-- optional bookkeeping succeeding.
--
-- How it's used (api/stripe-webhook.js's claimPaymentEvent()): a single
-- PLAIN insert —
--   insert into payment_claims (stripe_event_id, event_type)
--   values ($1, $2)
-- — with NO "on conflict" clause — is the only gate. Because
-- stripe_event_id is this table's PRIMARY KEY, that plain insert can only
-- ever do one of two things: create exactly one new row (success — this
-- call won the claim), or raise Postgres error code 23505,
-- unique-violation (a genuine duplicate — some request, this process or
-- another, already holds this event's claim; skip the legacy increment).
-- Postgres's own primary-key enforcement is the sole arbiter of which
-- concurrent request wins. Any OTHER error is explicitly NOT treated as
-- a duplicate — claimPaymentEvent() re-throws it, so the webhook handler
-- responds 500 and Stripe retries, rather than silently responding 200
-- for an unresolved claim (verified in the CRM-1 pre-production
-- correction round). This guarantees, genuinely and transactionally,
-- that the legacy increment happens AT MOST ONCE per Stripe event, under
-- concurrent duplicate delivery. It does not by itself guarantee the
-- increment always happens (a crash between the claim and the legacy
-- update is a known, narrow, accepted gap — see the CRM-1 Revision 2.1
-- amendment and api/admin/reconciliation.js's PAYMENT_CLAIM_INCOMPLETE
-- check, which surfaces it for manual review and never auto-repairs it).

create table if not exists payment_claims (
  stripe_event_id  text primary key,
  event_type       text not null,
  claimed_at       timestamptz not null default now()
);

comment on table payment_claims is
  'Atomic at-most-once claim gate for invoice.payment_succeeded, keyed on Stripe''s own event id. A row existing here means some request already won the right to run the legacy total_months_paid increment for that event — it is never deleted, released, or retried automatically. See api/admin/reconciliation.js PAYMENT_CLAIM_INCOMPLETE for the manual-review-only detection of a claim with no matching payment_events row.';
