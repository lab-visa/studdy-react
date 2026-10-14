-- ============================================================
-- 0021_india_orders.sql — India (Cashfree) one-time orders
-- PENDING — run once in Supabase SQL Editor before the India
-- Cashfree checkout goes live. Safe to re-run (idempotent).
-- ============================================================
--
-- India offer (Oct 2026): pay first, Quarterly (3 months) or Yearly
-- (12 months), 7-day full refund, no free trial, no auto-debit. Payment is
-- a one-time Cashfree order, not a Stripe subscription, so it gets its own
-- table rather than being forced into the Stripe-shaped leads/customers/
-- subscriptions tables.
--
-- One row per Cashfree order. A row is created when the visitor clicks
-- "Pay" (status 'created'); it becomes 'paid' only after Cashfree confirms
-- the payment (webhook or a server-side status check — never the browser's
-- word). The Studdy seat is assigned once, on the paid row, and its
-- group_name is the link to studdy_accounts (same seat pool and same
-- capacity counter as Stripe customers).
--
-- order_id is long and random and doubles as the customer's permanent
-- dashboard link (studdylab.com/dashboard?order_id=...), the same design
-- as the Stripe session id link.

create table if not exists india_orders (
  order_id               text primary key,
  plan                   text not null check (plan in ('quarterly', 'yearly')),
  amount                 numeric(10, 2) not null,
  currency               text not null default 'INR',
  months                 integer not null,

  customer_name          text,
  customer_email         text,
  customer_phone         text,

  -- attribution (where the buyer came from)
  lead_id                text,
  campaign_code          text,
  ref_code               text,     -- sales partner code, for commissions (next phase)

  status                 text not null default 'created', -- created | paid | failed | refunded
  cf_order_id            text,
  cf_payment_id          text,
  payment_method         text,
  paid_at                timestamptz,
  access_start           timestamptz,
  access_end             timestamptz,

  group_name             text,     -- assigned studdy_accounts.group_name
  fulfilment_claimed_at  timestamptz, -- concurrency guard for seat assignment

  refund_requested_at    timestamptz,
  refunded_at            timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists india_orders_status_idx     on india_orders (status);
create index if not exists india_orders_phone_idx      on india_orders (customer_phone);
create index if not exists india_orders_created_idx    on india_orders (created_at desc);
create index if not exists india_orders_access_end_idx on india_orders (access_end) where status = 'paid';
create index if not exists india_orders_ref_code_idx   on india_orders (ref_code) where ref_code is not null;

-- Server-only table: no browser/anon access. (The project's ensure_rls
-- event trigger also enables this automatically; stated explicitly here.)
alter table india_orders enable row level security;

comment on table india_orders is
  'India one-time Cashfree orders (Quarterly/Yearly, 7-day refund, no trial). status becomes paid only from a verified Cashfree webhook or server-side order lookup. order_id is the customer''s dashboard link.';
