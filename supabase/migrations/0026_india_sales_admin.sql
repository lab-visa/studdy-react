-- ============================================================
-- 0026_india_sales_admin.sql — full Cashfree payment details + admin actions
-- Safe to re-run. Additive only.
-- ============================================================
alter table india_orders add column if not exists cf_payment_amount numeric(10, 2);   -- what Cashfree says was paid
alter table india_orders add column if not exists cf_payment_currency text;
alter table india_orders add column if not exists bank_reference    text;            -- UTR / bank RRN
alter table india_orders add column if not exists payment_detail    text;            -- e.g. "UPI · name@okaxis", "Card · VISA ••••1234 · HDFC"
alter table india_orders add column if not exists payment_message   text;            -- Cashfree's message (incl. failure reason)
alter table india_orders add column if not exists cf_payment_raw    jsonb;           -- last verified webhook payload, as received
alter table india_orders add column if not exists failed_attempts   integer not null default 0;
alter table india_orders add column if not exists seat_released_at  timestamptz;     -- admin released the Studdy seat (refund / test / expiry)
alter table india_orders add column if not exists refund_note       text;
create index if not exists india_orders_paid_at_idx on india_orders (paid_at desc) where paid_at is not null;
