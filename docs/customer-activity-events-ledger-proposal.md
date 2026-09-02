# `customer_activity_events` audit ledger — proposed migration 0018 (NOT implemented)

CRM-3A Activity Timeline audit, ChatGPT review round 2, item 5. Per
this round's explicit instruction ("do not silently create a large
new scope or migration; report the exact migration plan before
implementing it"), this is a **report only** — no migration file has
been created, no table exists, and no application code writes to it.
The plan below is what would ship as `0018_customer_activity_events.sql`
if and when the user approves it.

## The gap this closes

Even after this round's Activity Timeline work, three categories of
real customer/subscription history still have **no authoritative,
timestamped source anywhere in the schema** — not because nobody
wrote the display code, but because nothing has ever recorded these
facts as they happened:

1. **Sales Owner changes.** `customers.sales_owner` is a single
   nullable column with no history — every change silently overwrites
   the previous value. There is no way to know who owned a customer
   last month, or when ownership changed.
2. **Plan/billing changes.** Nothing in this codebase writes a
   plan/billing-change event today. `subscriptions.plan_type`/
   `currency` can change (a customer upgrades/downgrades, or a Stripe
   price change syncs through), but no code path anywhere logs that
   as an event — the row simply reflects whatever it currently is.
3. **Cancellation approved/rejected/reversed/scheduled transitions.**
   `cancellation_requests.status` supports the values
   `approved_for_cancellation`, `retained` (rejected), and
   `cancel_scheduled` in its schema (migration 0013's partial index
   already accounts for them) — but grepping this entire codebase
   confirms no code path ever WRITES any of those three values. Only
   `pending_discussion` (the initial request) is ever actually
   inserted. The workflow those statuses imply (an admin reviewing and
   deciding on a cancellation request) has never been built.

None of these can be reconstructed retroactively — by definition, a
change that was never recorded cannot be recovered later (unlike the
cancellation-timestamp case in the companion backfill-procedure
document, where Stripe itself independently kept the true value).
Going forward, though, every future occurrence of these three event
types CAN be captured, by adding one general-purpose, additive,
backend-only, append-only ledger table.

## Proposed schema

```sql
-- 0018_customer_activity_events.sql (PROPOSED — not created this round)

create table if not exists customer_activity_events (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers(id),
  event_type        text not null,      -- e.g. 'sales_owner_changed', 'plan_changed',
                                         -- 'cancellation_approved', 'cancellation_rejected',
                                         -- 'cancellation_reversed'
  occurred_at       timestamptz not null default now(),
  actor             text,               -- admin_users.display_name (or 'system'/'stripe_webhook')
                                         -- of whoever/whatever caused this — nullable, since a
                                         -- Stripe-driven sync has no human actor
  source            text not null,      -- 'admin_ui' | 'stripe_webhook' | 'system' — where this
                                         -- event actually originated, mirroring the Activity
                                         -- Timeline's existing source-labeling convention
  external_event_id text,               -- Stripe's event.id when source='stripe_webhook' — the
                                         -- SAME idempotency key concept payment_events.stripe_event_id
                                         -- already uses; unique together with event_type below
  before_value       jsonb,             -- e.g. {"sales_owner": "Priya"} — null for a first-ever change
  after_value         jsonb not null,   -- e.g. {"sales_owner": "Rahul"} — always present; this is
                                         -- what actually happened
  created_at            timestamptz not null default now()
);

-- Idempotency: the SAME Stripe event can never be recorded twice for
-- the SAME event_type, mirroring payment_events.stripe_event_id's
-- existing unique-constraint dedup pattern exactly.
create unique index if not exists customer_activity_events_external_event_idx
  on customer_activity_events (event_type, external_event_id)
  where external_event_id is not null;

create index if not exists customer_activity_events_customer_occurred_idx
  on customer_activity_events (customer_id, occurred_at desc);

comment on table customer_activity_events is
  'CRM-3A Activity Timeline audit — append-only ledger for customer/subscription lifecycle events with no other authoritative source (Sales Owner changes, plan/billing changes, cancellation approved/rejected/reversed). Backend-only; RLS enabled with zero policies, same pattern as lead_attribution (migration 0016). Never updated or deleted after insert — a correction is a NEW row, not an edit.';

-- SECURITY — same backend-only, default-deny pattern as lead_attribution
-- (migration 0016): RLS enabled, deliberately zero policies for any role.
-- Only this backend's own service-role connection (which bypasses RLS by
-- design) ever reads or writes this table.
alter table customer_activity_events enable row level security;
```

Additive only: one new table, two new indexes, nothing existing
touched. Matches this codebase's established `stored/calculated/
manual` fact discipline — every row here is a **stored** fact someone
or something actually reported happening, at the moment it happened;
nothing here is ever derived or guessed.

## Why append-only, not "add a history column"

`before_value`/`after_value` as JSONB (rather than one column per
event type) means one table serves all three event categories without
three different narrow history tables, while still being fully
typed/queryable per event (`after_value->>'sales_owner'`, etc.). Never
updating or deleting a row (only ever inserting) is what makes this a
genuine **audit ledger** — the same durability guarantee
`payment_events` already provides for the payment history, extended
to these three categories.

## What would call it (future work, not this round)

- **Sales Owner changes** — `api/admin/customer-sales-owner.js`
  (already exists, already the sole place `sales_owner` is ever
  written) would insert one `sales_owner_changed` row in the same
  request, `before_value`/`after_value` from the old/new owner,
  `actor` from the admin session, `source: 'admin_ui'`.
- **Plan/billing changes** — `syncSubscriptionUpdated()`
  (`api/_lib/sync-customer.js`) would compare the incoming
  `plan_type`/`currency` against the existing row before updating, and
  insert one `plan_changed` row when they genuinely differ, `source:
  'stripe_webhook'`, `external_event_id: event.id` for the same
  redelivery-safe idempotency every other Stripe-sourced table here
  already has.
- **Cancellation approved/rejected/reversed** — would require the
  admin workflow itself to be built first (a UI action that actually
  sets `cancellation_requests.status` to one of the three currently-
  unused values — none of that exists yet either, and is a separate,
  larger scope decision than the ledger table itself). The ledger
  table is a prerequisite for that future workflow's own audit trail,
  not a replacement for building the workflow.

## Explicitly out of scope for this proposal

- No backfill of historical Sales Owner/plan changes — see the
  companion backfill-procedure document's principle: a fact that was
  never recorded cannot be reconstructed. This ledger only ever
  captures events from the moment it exists forward.
- No UI for the cancellation approve/reject/reverse workflow itself —
  that is a distinct, larger feature decision, reported here only so
  it isn't silently bundled into "just add an audit table."
- No change to the existing Activity Timeline entries or their
  sources — this is a new, independent event category, additive to
  `buildActivityTimeline()`, not a replacement for anything currently
  there.

## Status

**Proposed only — no migration file created, no code written.**
Awaiting the user's decision on whether to approve this schema (as
written, or amended) before `0018_customer_activity_events.sql` is
actually created.
