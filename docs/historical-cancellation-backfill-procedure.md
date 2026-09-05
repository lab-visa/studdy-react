# Historical cancellation backfill — proposed procedure (NOT executed)

CRM-3A Activity Timeline audit, ChatGPT review round 2, item 3. This
document describes a **safe, one-time, read-mostly Stripe resync**
that COULD recover `subscriptions.cancelled_at`/`ended_at` for
existing cancelled subscriptions where both columns are currently
`null` — the "Cancelled — exact date unavailable" case
`buildCancellationEntry()` (`api/admin/customer-detail.js`) already
handles honestly today.

**This procedure has not been run.** No code in this round calls it,
no migration performs it, and it must not be run against production
without explicit separate approval — this document is the report
required before any such backfill is implemented, per this round's
instructions ("do not claim the exact historical date is available
until verified from Stripe").

## Why this is possible at all

`recordSubscriptionEnded()` (`api/_lib/sync-customer.js`) writes
`cancelled_at`/`ended_at` from Stripe's own Subscription-object fields
(`canceled_at`/`ended_at`), falling back to the webhook event's own
`created` time only if neither is present on the object — see this
round's "cancellation timestamp precedence" fix. Any row with both
columns `null` was written by an EARLIER code path (before that
column existed, or before this precedence fix), not by a genuine
absence of the fact in Stripe. Stripe itself keeps a Subscription
object's `canceled_at`/`ended_at` **permanently**, even long after
cancellation — so for any subscription that still exists in Stripe
(has not been fully deleted from Stripe's own records, which Stripe
does not do), a direct `GET /v1/subscriptions/:id` (or, if the
subscription was truly deleted from Stripe's list — rare, Stripe
generally keeps cancelled subscriptions retrievable indefinitely —
`GET /v1/events?type=customer.subscription.deleted&...` to find the
original webhook delivery) can recover the genuine timestamp.

## Candidate population (read-only query, safe to run any time)

```sql
select s.id, s.customer_id, s.stripe_subscription_id, c.paid_id, c.email
from subscriptions s
join customers c on c.id = s.customer_id
where s.status = 'cancelled'
  and s.cancelled_at is null
  and s.ended_at is null;
```

This is a plain `SELECT` — safe to run against production at any time,
including right now, to get an exact count and see exactly which
customers would be affected before deciding whether to proceed.

## Proposed procedure (for future approval — NOT run this round)

1. **Read-only discovery.** Run the query above against production.
   Report the exact row count and customer list back for review.
   Zero writes.
2. **Stripe lookup, one row at a time, read-only.** For each
   `stripe_subscription_id` in that list, call Stripe's
   `GET /v1/subscriptions/:id` (or, for a subscription Stripe no
   longer returns directly, its cancellation-event history via
   `GET /v1/events?type=customer.subscription.deleted&...` filtered to
   that subscription). Record, per row: whether Stripe still has a
   genuine `canceled_at`/`ended_at`, and what value. Still zero writes
   to `subscriptions`.
3. **Report the findings before writing anything.** Not every row is
   guaranteed to be recoverable — Stripe API access is rate-limited,
   a subscription's Stripe object could theoretically be permanently
   gone (Stripe does not document any retention limit on subscription
   objects, but this procedure must not assume 100% recoverability).
   The report from step 2 states exactly how many of the candidate
   rows have a genuine, Stripe-confirmed timestamp available, and
   exactly how many do not — those that don't stay
   "exact date unavailable" forever; this backfill must never invent a
   value for them.
4. **A single, reviewed, additive UPDATE — only after explicit
   approval of the exact row list from step 3.** For example:
   ```sql
   -- Illustrative only — the real statement would be generated from
   -- step 2/3's actual verified Stripe data, one batch, reviewed
   -- before running, following this project's existing "read this
   -- migration/README before running anything" process:
   update subscriptions
   set cancelled_at = $verified_canceled_at,
       ended_at = coalesce($verified_ended_at, $verified_canceled_at)
   where id = $subscription_id
     and cancelled_at is null
     and ended_at is null; -- re-checked immediately before writing, so
                            -- this can never overwrite a value some
                            -- OTHER process wrote in the meantime
   ```
   Runs only against the exact, individually-verified row list from
   step 3 — never a blanket `UPDATE ... WHERE status='cancelled'`
   guess. Each write is idempotent and safely re-runnable (the
   `cancelled_at is null and ended_at is null` guard means re-running
   it after a partial failure only touches rows still genuinely
   unbackfilled).
5. **No `updated_at` bump, no side effects.** This backfill only ever
   touches `cancelled_at`/`ended_at` on rows that already have
   `status = 'cancelled'` — it changes no other column, sends no
   notification, and does not re-trigger `mirrorLegacyAllocation()`,
   seat release, or any other side effect (those already ran, for
   real, when the subscription was originally cancelled — this
   procedure only recovers a display timestamp for the Activity
   Timeline, it does not replay the cancellation itself).

## What this explicitly does NOT do

- It does not touch any row whose `status` is not `cancelled`.
- It does not touch any row that already has a genuine
  `cancelled_at`/`ended_at` (the `is null` guards in both the
  discovery query and the proposed `UPDATE`).
- It never derives a date from `updated_at`, `created_at`, or any
  other non-Stripe-verified source — a row Stripe genuinely cannot
  confirm a timestamp for keeps showing
  "Cancelled — exact date unavailable" permanently, exactly as
  `buildCancellationEntry()` already renders it today.
- It is not scheduled, not automated, and not wired into any webhook
  or cron path — it would be a manual, one-time, explicitly-approved
  operation if the user ever wants it run.

## Status

**Proposed only.** Awaiting the user's decision on whether to proceed
with step 1 (the read-only discovery query) at all.
