/**
 * CRM-3A — guards against search_customer_pipeline(...)'s SQL `stage`
 * CASE expression (migration 0017) drifting out of sync with
 * deriveCustomerLifecycle() in api/_lib/lifecycle.js. The SQL version
 * is a deliberate, necessary duplicate (see the migration's own
 * header comment for why filtering/sorting a derived value at
 * database scale requires the database to compute it) — this test is
 * what makes that duplication safe: it runs the SAME synthetic
 * customer/subscription states through BOTH implementations and
 * asserts identical `stage` output.
 *
 * Both sides observe the SAME real wall-clock "now" (the SQL function
 * always uses Postgres's own now(), with no way to inject a fixed
 * time) — so every "today"-relative case below (trial ending today,
 * payment due today) is built from the actual current time at test
 * run, not a hardcoded date. See test/cases/lifecycle.test.mjs for
 * dedicated, fully-deterministic IST-boundary tests of the JS
 * function alone.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { deriveCustomerLifecycle } from '../../api/_lib/lifecycle.js';

let pool;
let supabase;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  await pool.query('TRUNCATE customers, subscriptions RESTART IDENTITY CASCADE');
});

after(async () => {
  await closeTestPool();
});

const todayIstNoon = () => {
  // A timestamp guaranteed to fall on "today" in Asia/Kolkata
  // regardless of what UTC hour the test happens to run at: IST is
  // UTC+5:30, so UTC noon is always IST evening of the SAME day.
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
};
const farFuture = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);

const CASES = [
  {
    name: 'no subscription synced',
    subscription: null,
    customer: { access_status: 'active' },
  },
  {
    name: 'cancelled, access still active',
    subscription: { status: 'cancelled', cancel_at_period_end: false },
    customer: { access_status: 'active' },
  },
  {
    name: 'cancelled, access ended',
    subscription: { status: 'cancelled', cancel_at_period_end: false },
    customer: { access_status: 'ended' },
  },
  {
    name: 'cancelling at period end',
    subscription: { status: 'active', cancel_at_period_end: true, current_period_end: farFuture() },
    customer: { access_status: 'active' },
  },
  {
    name: 'grace period',
    subscription: { status: 'active', cancel_at_period_end: false },
    customer: { access_status: 'grace' },
  },
  {
    name: 'payment failed',
    subscription: { status: 'past_due', cancel_at_period_end: false },
    customer: { access_status: 'active' },
  },
  {
    name: 'trial ending today',
    subscription: { status: 'trialing', cancel_at_period_end: false, trial_end: todayIstNoon() },
    customer: { access_status: 'active' },
  },
  {
    name: 'trial active (not ending today)',
    subscription: { status: 'trialing', cancel_at_period_end: false, trial_end: farFuture() },
    customer: { access_status: 'active' },
  },
  {
    name: 'payment due today',
    subscription: { status: 'active', cancel_at_period_end: false, current_period_end: todayIstNoon() },
    customer: { access_status: 'active' },
  },
  {
    name: 'active paid',
    subscription: { status: 'active', cancel_at_period_end: false, current_period_end: farFuture() },
    customer: { access_status: 'active' },
  },
  {
    name: 'unmapped stripe status',
    subscription: { status: 'unpaid', cancel_at_period_end: false },
    customer: { access_status: 'active' },
  },
];

test('SQL search_customer_pipeline stage matches JS deriveCustomerLifecycle for every synthetic state', async () => {
  const now = new Date();
  const rowsByEmail = new Map();

  for (const c of CASES) {
    const email = `parity-${randomUUID()}@example.test`;
    const custRes = await pool.query(
      `INSERT INTO customers (stripe_customer_id, email, access_status, lifecycle) VALUES ($1, $2, $3, 'trial') RETURNING id, access_status, lifecycle`,
      [`cus_parity_${randomUUID()}`, email, c.customer.access_status]
    );
    const customerRow = custRes.rows[0];

    let subscriptionRow = null;
    if (c.subscription) {
      const subRes = await pool.query(
        `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status, cancel_at_period_end, trial_end, current_period_end)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          customerRow.id,
          `sub_parity_${randomUUID()}`,
          c.subscription.status,
          c.subscription.cancel_at_period_end,
          c.subscription.trial_end ?? null,
          c.subscription.current_period_end ?? null,
        ]
      );
      subscriptionRow = subRes.rows[0];
    }

    const jsResult = deriveCustomerLifecycle({
      customer: customerRow,
      subscription: subscriptionRow,
      openCancellationRequest: null,
      now,
    });

    rowsByEmail.set(email, { caseName: c.name, expectedStage: jsResult.stage });
  }

  const { data, error } = await supabase.rpc('search_customer_pipeline', {
    p_limit: CASES.length + 5,
    p_offset: 0,
  });
  assert.equal(error, null);

  for (const [email, { caseName, expectedStage }] of rowsByEmail) {
    const row = data.find((r) => r.email === email);
    assert.ok(row, `case "${caseName}": no row returned for ${email}`);
    assert.equal(row.stage, expectedStage, `case "${caseName}": SQL stage "${row.stage}" !== JS stage "${expectedStage}"`);
  }
});
