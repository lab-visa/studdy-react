# Migration status

This directory was not previously committed to GitHub (confirmed absent in CRM-0A, Aug 2026), even though migrations `0001`–`0011` were already correctly applied directly against production (confirmed in CRM-0B, live read-only verification, Aug 2026). Committing them now is documentation only — it does not change production.

**Read this table before running anything.** It always reflects real, confirmed production state — update the "Status" column here the moment a migration is actually confirmed applied.

| # | File | Status | Action |
|---|---|---|---|
| 0001 | `studdy_account_capacity.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0002 | `pricing.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0003 | `master_leads.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0004 | `campaigns.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0005 | `customers_and_paid_id.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0006 | `subscriptions_and_billing.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0007 | `account_assignments.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0008 | `ops_tables.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0009 | `backfill_leads_to_customers.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0010 | `site_traffic.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0011 | `seat_allocator.sql` | HISTORICAL BASELINE — already applied | **DO NOT RUN** |
| 0012 | `site_traffic_campaign_attribution.sql` | **APPLIED — confirmed in production Sep 1, 2026** | Verified: row/visit counts consistent, `campaign_code` column present (NOT NULL, default 'none'), primary key widened correctly, exactly one 5-argument `increment_site_traffic` function exists. No further action. |
| 0013 | `cancellation_requests_open_index.sql` | **APPLIED — confirmed in production Sep 1, 2026** | Verified: `cancellation_requests_one_open_per_customer` partial unique index exists on `(customer_id)`, predicate covers exactly `pending_discussion`/`approved_for_cancellation`/`cancel_scheduled`, row counts (this table and `leads`/`customers`/`subscriptions`/`account_assignments`) unchanged. No further action. |
| 0014 | `admin_auth.sql` | **APPLIED — confirmed in production Sep 1, 2026** | Verified: `admin_users` (10 columns) and `admin_sessions` (6 columns) exist with exact expected schema, unique `lower(display_name)` index, `admin_sessions.admin_user_id` FK → `admin_users(id)`, unique `session_token_hash`; both tables have 0 rows (no admin account, PIN, hash, or salt exists yet); unrelated row counts unchanged. No further action. |
| 0015 | `payment_claims.sql` | **APPLIED — confirmed in production Sep 1, 2026** | Verified: `payment_claims` exists with the exact expected schema (`stripe_event_id` primary key, `event_type` not null, `claimed_at` default `now()`), empty at creation, no other table affected. No further action. |
| 0016 | `campaign_attribution_and_sales_owner.sql` | **PENDING — not yet applied.** Written for CRM-3A (Sep 2026), branch `crm-3a`, based on `origin/main` at `37dc3b6` (which has migrations only through `0015`). Additive only: new `lead_attribution` table, new nullable columns on `customers` (`sales_owner`, `first_*`/`latest_*` UTM/GHL attribution fields). | **DO NOT RUN** until reviewed and approved per the process below. (Note: a *different* `0016_crm_contacts_and_leads.sql` exists on the separate, unmerged `crm-3a-sales-import-draft` branch, for a different, not-yet-approved feature. That branch was never merged into `main`, so its `0016` was never actually assigned on the branch this migration ships from — `crm-3a` here is a fresh branch cut from `origin/main`, which has no `0016` of its own. The two `0016` files are unrelated, on divergent branches, and must never both land in the same history — whichever branch merges into `main` first fixes that filename for real; do not rename either to avoid a collision preemptively.) |

## Production execution order for the pending migrations

`0012 → verify → 0013 → verify → 0014 → verify → 0015 → verify`, one file at a time, never batched, never run out of order.

**0012–0015 are done and verified in production.** `0016` is written and awaiting review/approval — see its own header. It is not run against production by anything in this round.

## Before running any pending migration against production

1. Implementation is complete.
2. Automated tests, `tsc -b`, `oxlint`, and `vite build` all pass, with exact results reported.
3. The delivered SQL has been reviewed (ChatGPT, per this project's process).
4. Exact, one-at-a-time, click/paste instructions have been given for each file — never a batch paste of multiple files.

`0012`, `0013`, `0014`, and `0015` have all been run against production and verified (Sep 1, 2026). The CRM-1B admin auth code and the payment-idempotency webhook code that depend on these migrations have since been deployed to Vercel (PR #1, merge commit `40c069e`) and a real admin account exists and has logged in successfully in production. This documentation correction (this row and the 0015 file's own header, updated in the same tiny, separate, non-behavioral commit) brings both back in sync with actual verified production state — no SQL, no migration behavior, and no application code changed by this correction.
