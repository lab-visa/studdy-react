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
| 0015 | `payment_claims.sql` | **NEW / PENDING** | Run once, verify, then update this row to "applied" |

## Production execution order for the pending migrations

`0012 → verify → 0013 → verify → 0014 → verify → 0015 → verify`, one file at a time, never batched, never run out of order.

**0012, 0013, and 0014 are done.** `0015` is next, not yet run — it is the last of the four pending migrations.

## Before running any pending migration against production

1. Implementation is complete.
2. Automated tests, `tsc -b`, `oxlint`, and `vite build` all pass, with exact results reported.
3. The delivered SQL has been reviewed (ChatGPT, per this project's process).
4. Exact, one-at-a-time, click/paste instructions have been given for each file — never a batch paste of multiple files.

`0012`, `0013`, and `0014` have been run against production and verified (Sep 1, 2026). `0015` has not — no real admin account exists yet, and no application code (webhook, admin auth, admin UI) has been deployed to Vercel.
