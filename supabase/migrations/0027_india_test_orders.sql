-- ============================================================
-- 0027_india_test_orders.sql — "Mark as test order"
-- Safe to re-run. Additive only.
-- ============================================================
-- A test order gets status 'test' (instead of paid/refunded), so it is
-- left out of sales totals, partner commission, payouts and seats
-- everywhere automatically. marked_test_at records when it was marked.
alter table india_orders add column if not exists marked_test_at timestamptz;
