/**
 * CRM-3A — the four new Customer & Subscription pipeline endpoints
 * (api/admin/customers.js, customer-detail.js, today-actions.js,
 * customer-sales-owner.js) and api/track-attribution.js, called
 * end-to-end (real handler code, real Postgres-backed test client),
 * exactly matching auth.test.mjs's own established pattern
 * (mock.module on api/_lib/supabase.js + fakeReq/fakeRes).
 *
 * Covers: authorization (401 with no/invalid session on every admin
 * endpoint), CSRF (403 on a cross-origin PATCH), the Sales Owner write
 * path, and that track-attribution creates ONLY a lead_attribution row —
 * never a customers or leads row, matching the "no row for a mere click
 * that hasn't converted" rule stated in migration 0016's own comment.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';

process.env.ADMIN_PIN_PEPPER = 'test-suite-pepper-do-not-use-in-production';
process.env.NODE_ENV = 'test';

const repoRoot = join(new URL('.', import.meta.url).pathname, '..', '..');
const supabaseModUrl = pathToFileURL(join(repoRoot, 'api/_lib/supabase.js')).href;

let pool;
let supabase;
let customersHandler;
let customerDetailHandler;
let todayActionsHandler;
let salesOwnerHandler;
let trackAttributionHandler;
let adminAuth;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  mock.module(supabaseModUrl, { namedExports: { getSupabase: () => supabase } });

  ({ default: customersHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/customers.js')).href));
  ({ default: customerDetailHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/customer-detail.js')).href));
  ({ default: todayActionsHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/today-actions.js')).href));
  ({ default: salesOwnerHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/customer-sales-owner.js')).href));
  ({ default: trackAttributionHandler } = await import(pathToFileURL(join(repoRoot, 'api/track-attribution.js')).href));

  adminAuth = await import(pathToFileURL(join(repoRoot, 'api/_lib/admin-auth.js')).href);
});

after(async () => {
  await closeTestPool();
});

beforeEach(async () => {
  await pool.query('TRUNCATE customers, subscriptions, lead_attribution RESTART IDENTITY CASCADE');
});

async function seedAdminSession() {
  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash('1234', salt);
  const res = await pool.query(
    `INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ($1, $2, $3) RETURNING id`,
    [`Owner_${randomUUID()}`, hash, salt]
  );
  const { token } = await adminAuth.createSession(supabase, res.rows[0].id);
  return token;
}

async function seedCustomer(overrides = {}) {
  const stripeCustomerId = `cus_${randomUUID()}`;
  const res = await pool.query(
    `INSERT INTO customers (stripe_customer_id, name, email, country, access_status, lifecycle)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      stripeCustomerId,
      overrides.name ?? 'Test Parent',
      overrides.email ?? 'parent@example.test',
      overrides.country ?? 'US',
      overrides.access_status ?? 'active',
      overrides.lifecycle ?? 'trial',
    ]
  );
  return { customerId: res.rows[0].id, stripeCustomerId };
}

/* ─────────────────────────── authorization ─────────────────────────── */

test('every new admin endpoint returns 401 with no session', async () => {
  const r1 = fakeRes();
  await customersHandler(fakeReq({ method: 'GET', headers: {} }), r1);
  assert.equal(r1.statusCode, 401);

  const r2 = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers: {}, query: { id: randomUUID() } }), r2);
  assert.equal(r2.statusCode, 401);

  const r3 = fakeRes();
  await todayActionsHandler(fakeReq({ method: 'GET', headers: {} }), r3);
  assert.equal(r3.statusCode, 401);

  const r4 = fakeRes();
  await salesOwnerHandler(
    fakeReq({ method: 'PATCH', headers: { origin: 'https://studdylab.com', host: 'studdylab.com' }, body: { customerId: randomUUID(), salesOwner: 'Vish' } }),
    r4
  );
  assert.equal(r4.statusCode, 401);
});

/* ───────────────────────────── CSRF (sales owner) ───────────────────────────── */

test('customer-sales-owner: a cross-origin PATCH is rejected 403 even with a valid session, before any DB write', async () => {
  const token = await seedAdminSession();
  const { customerId } = await seedCustomer();

  const res = fakeRes();
  await salesOwnerHandler(
    fakeReq({
      method: 'PATCH',
      headers: { cookie: `sl_admin_session=${token}`, origin: 'https://evil.example', host: 'studdylab.com' },
      body: { customerId, salesOwner: 'Vish' },
    }),
    res
  );
  assert.equal(res.statusCode, 403);

  const { rows } = await pool.query('SELECT sales_owner FROM customers WHERE id=$1', [customerId]);
  assert.equal(rows[0].sales_owner, null, 'a rejected cross-origin request must never write to the database');
});

test('customer-sales-owner: a same-origin PATCH with a valid session sets, then clears, the owner', async () => {
  const token = await seedAdminSession();
  const { customerId } = await seedCustomer();
  const headers = { cookie: `sl_admin_session=${token}`, origin: 'https://studdylab.com', host: 'studdylab.com' };

  const setRes = fakeRes();
  await salesOwnerHandler(fakeReq({ method: 'PATCH', headers, body: { customerId, salesOwner: '  Vish Gupta  ' } }), setRes);
  assert.equal(setRes.statusCode, 200);
  assert.equal(setRes._json.customer.sales_owner, 'Vish Gupta', 'must be trimmed');

  const clearRes = fakeRes();
  await salesOwnerHandler(fakeReq({ method: 'PATCH', headers, body: { customerId, salesOwner: null } }), clearRes);
  assert.equal(clearRes.statusCode, 200);
  assert.equal(clearRes._json.customer.sales_owner, null, 'null clears back to Unassigned');
});

test('customer-sales-owner: 404 for an unknown customerId, 400 for a non-string non-null salesOwner', async () => {
  const token = await seedAdminSession();
  const headers = { cookie: `sl_admin_session=${token}`, origin: 'https://studdylab.com', host: 'studdylab.com' };

  const notFound = fakeRes();
  await salesOwnerHandler(fakeReq({ method: 'PATCH', headers, body: { customerId: randomUUID(), salesOwner: 'Vish' } }), notFound);
  assert.equal(notFound.statusCode, 404);

  const { customerId } = await seedCustomer();
  const badInput = fakeRes();
  await salesOwnerHandler(fakeReq({ method: 'PATCH', headers, body: { customerId, salesOwner: 42 } }), badInput);
  assert.equal(badInput.statusCode, 400);
});

/* ───────────────────────────── customers list ───────────────────────────── */

test('admin/customers: a logged-in admin sees the seeded customer with a derived lifecycle stage', async () => {
  const token = await seedAdminSession();
  const { customerId, stripeCustomerId } = await seedCustomer({ country: 'IN' });
  await pool.query(
    `INSERT INTO subscriptions (customer_id, stripe_subscription_id, status, plan_type, currency) VALUES ($1,$2,'trialing','Monthly','INR')`,
    [customerId, `sub_${stripeCustomerId}`]
  );

  const res = fakeRes();
  await customersHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: {} }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.customers.length, 1);
  assert.equal(res._json.customers[0].lifecycle.stage, 'Trial active');
});

test('admin/customers: country filter narrows results', async () => {
  const token = await seedAdminSession();
  await seedCustomer({ country: 'US' });
  await seedCustomer({ country: 'IN' });

  const res = fakeRes();
  await customersHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` }, query: { country: 'IN' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.customers.length, 1);
  assert.equal(res._json.customers[0].country, 'IN');
});

/* ───────────────────────────── customer detail ───────────────────────────── */

test('admin/customer-detail: 404 for an unknown id, 200 with full shape for a known one', async () => {
  const token = await seedAdminSession();
  const headers = { cookie: `sl_admin_session=${token}` };

  const missing = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers, query: { id: randomUUID() } }), missing);
  assert.equal(missing.statusCode, 404);

  const { customerId } = await seedCustomer();
  const found = fakeRes();
  await customerDetailHandler(fakeReq({ method: 'GET', headers, query: { id: customerId } }), found);
  assert.equal(found.statusCode, 200);
  assert.equal(found._json.customer.id, customerId);
  assert.ok('activity_timeline' in found._json);
  assert.ok(Array.isArray(found._json.activity_timeline));
  assert.ok(found._json.activity_timeline.length >= 1, 'must include at least the customer-created entry');
});

/* ───────────────────────────── today's actions ───────────────────────────── */

test('admin/today-actions: 200, reports today_ist and every required section', async () => {
  const token = await seedAdminSession();
  const res = fakeRes();
  await todayActionsHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` } }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res._json.today_ist, /^\d{4}-\d{2}-\d{2}$/);
  for (const key of ['trials_ending_today', 'payments_expected_today', 'failed_payments', 'cancellation_requests', 'access_removal_pending', 'password_change_tasks', 'overdue', 'checkout_started']) {
    assert.ok(key in res._json, `expected section ${key}`);
  }
  assert.deepEqual(res._json.password_change_tasks.items, [], 'foundation-only section must always be empty, never fabricated');
});

/* ───────────────────────────── track-attribution ───────────────────────────── */

test('track-attribution: creates a lead_attribution row and NEVER a customers/leads row', async () => {
  const leadId = `lead-${randomUUID()}`;
  const customersBefore = (await pool.query('SELECT count(*)::int AS c FROM customers')).rows[0].c;
  const leadsBefore = (await pool.query('SELECT count(*)::int AS c FROM leads')).rows[0].c;

  const res = fakeRes();
  await trackAttributionHandler(
    fakeReq({
      method: 'POST',
      headers: {},
      body: { leadId, first: { utmSource: 'whatsapp', utmCampaign: 'WA-01' }, latest: { utmSource: 'whatsapp', utmCampaign: 'WA-01' } },
    }),
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.ok, true);

  const { rows } = await pool.query('SELECT * FROM lead_attribution WHERE lead_id=$1', [leadId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].first_utm_source, 'whatsapp');

  const customersAfter = (await pool.query('SELECT count(*)::int AS c FROM customers')).rows[0].c;
  const leadsAfter = (await pool.query('SELECT count(*)::int AS c FROM leads')).rows[0].c;
  assert.equal(customersAfter, customersBefore);
  assert.equal(leadsAfter, leadsBefore);
});

test('track-attribution: missing leadId returns 400, never writes a row', async () => {
  const res = fakeRes();
  await trackAttributionHandler(fakeReq({ method: 'POST', headers: {}, body: { first: {}, latest: {} } }), res);
  assert.equal(res.statusCode, 400);
});

test('track-attribution: an over-length leadId is rejected 400, never silently truncated into the database', async () => {
  const res = fakeRes();
  await trackAttributionHandler(
    fakeReq({ method: 'POST', headers: {}, body: { leadId: 'x'.repeat(500), first: { utmSource: 'a' }, latest: {} } }),
    res
  );
  assert.equal(res.statusCode, 400);
});
