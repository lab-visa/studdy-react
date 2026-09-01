-- ============================================================
-- APPLIED TO PRODUCTION — confirmed Sep 1, 2026 (read-only
-- verification: cancellation_requests_one_open_per_customer
-- partial unique index exists, predicate covers exactly the
-- three open statuses, no row counts changed anywhere).
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- Committed here for version-control history; see
-- supabase/migrations/README.md for the authoritative status
-- table. Next pending migration is 0014.
-- ============================================================
--
-- 0013_cancellation_requests_open_index.sql
--
-- Protects "at most one OPEN cancellation workflow per customer" —
-- deliberately not "at most one pending_discussion row", which would
-- incorrectly permit a second request once an existing one had already
-- moved on to approved_for_cancellation or cancel_scheduled.
--
-- Valid cancellation_requests.status values, per migration 0006's own
-- column comment (verified directly against that file, not assumed):
--   pending_discussion | retained | approved_for_cancellation |
--   cancel_scheduled | cancelled
-- The three OPEN (non-terminal) states are pending_discussion,
-- approved_for_cancellation, and cancel_scheduled. retained and
-- cancelled are the two resolved/terminal states and must NOT
-- permanently block a legitimate future cancellation request.
--
-- The application code in api/cancel-request.js uses this exact same
-- three-value definition for its own pre-check, so the database
-- constraint and the app-level idempotency check can never disagree.

create unique index if not exists cancellation_requests_one_open_per_customer
  on cancellation_requests (customer_id)
  where status in ('pending_discussion', 'approved_for_cancellation', 'cancel_scheduled');

comment on index cancellation_requests_one_open_per_customer is
  'At most one OPEN cancellation workflow per customer (pending_discussion / approved_for_cancellation / cancel_scheduled). retained/cancelled are resolved states and do not count against this — a customer can always start a new cancellation request after either.';
