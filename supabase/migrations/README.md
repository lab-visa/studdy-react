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
| 0016 | `campaign_attribution_and_sales_owner.sql` | **APPLIED — confirmed in production Sep 2, 2026** | Verified: `lead_attribution` exists, RLS enabled (`RLS=true`), `policy_count=0` (see the follow-up RLS correction below), the 17 new `customers` attribution/sales-owner columns exist, `lead_attribution` has 0 rows, `customers` row count unchanged (1 row). No further action. (Note: a *different* `0016_crm_contacts_and_leads.sql` exists on the separate, unmerged `crm-3a-sales-import-draft` branch, for a different, not-yet-approved feature. That branch was never merged into `main`, so its `0016` was never actually assigned on the branch this migration shipped from — `crm-3a` here was a fresh branch cut from `origin/main`, which had no `0016` of its own. The two `0016` files are unrelated, on divergent branches, and must never both land in the same history — whichever branch merges into `main` first fixes that filename for real; do not rename either to avoid a collision preemptively.) |
| 0017 | `customer_pipeline_pagination.sql` | **APPLIED — confirmed in production Sep 6, 2026** | Verified via read-only production query: `pg_trgm` extension installed, all 4 GIN trigram indexes on `customers` present, and exactly one `search_customer_pipeline` function exists in `public`. The live Customer & Subscription pipeline endpoint (`api/admin/customers.js`) calls this function unconditionally with no fallback, and is confirmed working in production — this is corroborating evidence the function is genuinely installed, not just present in `pg_proc`. No further action. |
| 0018 | `customer_activity_timeline.sql` | **APPLIED — confirmed in production Sep 6, 2026** | Verified via read-only production query: exactly one `search_customer_activity_timeline` function exists in `public`. The live customer-detail endpoint (`api/admin/customer-detail.js`) calls this function unconditionally with no fallback, and is confirmed working in production (verified directly against Puneet Sharma's live record during the Sep 2026 hotfix smoke test — Activity Timeline correctly showed "Access released — Group 1"). No further action. |
| 0019 | `restrict_rls_auto_enable.sql` | **APPLIED — confirmed in production Sep 6, 2026** | Verified via read-only production query: `public.rls_auto_enable()`'s ACL is now `{postgres=X/postgres,service_role=X/postgres}` — EXECUTE is no longer granted to PUBLIC, `anon`, or `authenticated`, and remains granted to `service_role`/owner exactly as the migration specifies. No further action. |

## Production execution order — migrations 0012–0019 are all applied

`0012 → verify → 0013 → verify → 0014 → verify → 0015 → verify → 0016 → verify → 0017 → verify → 0018 → verify → 0019 → verify`, one file at a time, never batched, never run out of order. **All nine steps in that sequence are now done and independently verified in production** (0012–0016 confirmed Sep 1–2, 2026; 0017–0019 confirmed Sep 6, 2026 — see each row above for the specific evidence).

One important distinction, stated plainly so a future reader doesn't overclaim: this table's "APPLIED" status for 0017–0019 is based on confirming the *effects* of each migration are live in production (the function, indexes, extension, and grants exist and match each file's own SQL exactly) plus, for 0017 and 0018, confirmation that the dependent application code is calling those functions successfully in production with no fallback path. That is strong operational evidence the schema is ready and matches these files. It does not, by itself, prove which person, tool, or process actually ran the SQL, or exactly when — no migration-tracking table exists in this project to record that. If that provenance ever matters, it would need to come from whoever ran it, not from this verification method.

**Nothing further should be run against 0017, 0018, or 0019.** They are not pending, and must not be re-applied "to be safe" — all three are written as safe, additive, idempotent-guarded changes, but re-running is unnecessary now that production state is confirmed to already match them.

`0020` (the `customer_activity_events` audit ledger, renumbered twice — first from 0018, now from 0019, each time because a real unrelated migration claimed the slot first) remains **proposed only** — see `docs/customer-activity-events-ledger-proposal.md` — no migration file exists for it yet.

## Before running any pending migration against production

1. Implementation is complete.
2. Automated tests, `tsc -b`, `oxlint`, and `vite build` all pass, with exact results reported.
3. The delivered SQL has been reviewed (ChatGPT, per this project's process).
4. Exact, one-at-a-time, click/paste instructions have been given for each file — never a batch paste of multiple files.

`0012`, `0013`, `0014`, and `0015` have all been run against production and verified (Sep 1, 2026). The CRM-1B admin auth code and the payment-idempotency webhook code that depend on these migrations have since been deployed to Vercel (PR #1, merge commit `40c069e`) and a real admin account exists and has logged in successfully in production. This documentation correction (this row and the 0015 file's own header, updated in the same tiny, separate, non-behavioral commit) brings both back in sync with actual verified production state — no SQL, no migration behavior, and no application code changed by this correction.
