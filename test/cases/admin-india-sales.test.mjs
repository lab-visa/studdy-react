/**
 * Admin India Sales + Studdy Logins, and the full Cashfree detail capture:
 * a verified webhook stores amount, UTR, method detail and the raw payload;
 * sales map to the right partner; refund / release seat free the seat and
 * never re-assign it; the logins page never shows a password.
 */
process.env.ADMIN_PIN_PEPPER = 'test-suite-pepper-do-not-use-in-production';
process.env.NODE_ENV = 'test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';
import * as adminAuth from '../../api/_lib/admin-auth.js';
import createOrder from '../../api/cashfree/create-order.js';
import webhook from '../../api/cashfree/webhook.js';
import indiaSession from '../../api/india-session.js';
import indiaSales from '../../api/admin/india-sales.js';
import studdyLogins from '../../api/admin/studdy-logins.js';
import adminPartners from '../../api/admin/partners.js';

const SECRET = 'test_secret_key';
const cfg = () => ({ appId: 'app', secret: SECRET, env: 'sandbox', baseUrl: 'https://sandbox.cashfree.com/pg' });
const fakeFetch = (url, opts) => opts.method === 'POST'
  ? Promise.resolve({ ok: true, status: 200, json: async () => ({ cf_order_id: 77, payment_session_id: 'sess' }) })
  : Promise.resolve({ ok: true, status: 200, json: async () => ({ order_status: 'ACTIVE' }) });

let pool, supabase, deps, admin;
const H = { origin: 'https://studdylab.com', host: 'studdylab.com' };

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  deps = { getSupabase: () => supabase, cashfreeConfig: cfg, fetch: fakeFetch };
  await pool.query(`INSERT INTO studdy_accounts (group_name, studdy_email, studdy_password, studdy_url, max_capacity) VALUES ('Group 1','g1@studdy.test','SECRET-PW-1','https://studdyai.com', 40)`);
  await pool.query(`INSERT INTO partners (name, phone, email, status, code) VALUES ('Ryan D', '9811100001', 'ryan@example.com', 'approved', 'RYAN859')`);
  const salt = adminAuth.generateSalt();
  const r = await pool.query(`INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ('Vish', $1, $2) RETURNING id`, [adminAuth.deriveHash('1234', salt), salt]);
  const { token } = await adminAuth.createSession(supabase, r.rows[0].id);
  admin = { ...H, cookie: `sl_admin_session=${token}` };
});
after(async () => { await closeTestPool(); });

async function newOrder(body) {
  const res = fakeRes();
  await createOrder(fakeReq({ method: 'POST', headers: { host: 'studdylab.com', 'x-forwarded-proto': 'https' }, body: { plan: 'quarterly', name: 'Test Buyer', email: 'b@example.com', phone: '9000012345', ...body } }), res, deps);
  assert.equal(res.statusCode, 200, JSON.stringify(res._json));
  return res._json.orderId;
}

async function sendWebhook(event) {
  const rawBody = Buffer.from(JSON.stringify(event));
  const ts = String(Date.now());
  const sig = createHmac('sha256', SECRET).update(ts + rawBody.toString()).digest('base64');
  const res = fakeRes();
  await webhook(fakeReq({ method: 'POST', headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': sig } }), res, { ...deps, rawBody });
  return res;
}

const upiSuccess = (orderId, amount = 7999, utr = String(Math.floor(Math.random() * 1e12))) => ({
  type: 'PAYMENT_SUCCESS_WEBHOOK',
  data: {
    order: { order_id: orderId, order_amount: amount, order_currency: 'INR' },
    payment: { cf_payment_id: 5551234, payment_status: 'SUCCESS', payment_amount: amount, payment_currency: 'INR', payment_message: 'Transaction successful',
      payment_time: new Date().toISOString(), bank_reference: utr, payment_group: 'upi', payment_method: { upi: { channel: 'collect', upi_id: 'buyer@okaxis' } } },
    customer_details: { customer_name: 'Test Buyer', customer_phone: '9000012345' },
  },
});

let ryanOrder;

test('webhook stores every Cashfree detail; a partner-link sale maps to that partner', async () => {
  ryanOrder = await newOrder({ ref: 'RYAN859' });
  const res = await sendWebhook(upiSuccess(ryanOrder, 7999, '629183746512'));
  assert.equal(res.statusCode, 200);
  const { rows: [o] } = await pool.query('SELECT * FROM india_orders WHERE order_id=$1', [ryanOrder]);
  assert.equal(o.status, 'paid');
  assert.equal(o.ref_code, 'RYAN859');
  assert.equal(o.bank_reference, '629183746512');
  assert.equal(o.payment_detail, 'UPI · buyer@okaxis');
  assert.equal(Number(o.cf_payment_amount), 7999);
  assert.equal(o.payment_message, 'Transaction successful');
  assert.equal(o.cf_payment_raw.data.payment.cf_payment_id, 5551234);
  assert.equal(o.group_name, 'Group 1');
});

test('failed attempts are counted with Cashfree’s reason; a later success still wins', async () => {
  const id = await newOrder({});
  const fail = { type: 'PAYMENT_FAILED_WEBHOOK', data: { order: { order_id: id, order_amount: 7999 }, payment: { payment_status: 'FAILED', payment_message: 'Insufficient balance', payment_group: 'card', payment_method: { card: { card_network: 'VISA', card_number: 'XXXXXXXXXXXX4242', card_bank_name: 'HDFC', card_type: 'debit_card' } } } } };
  await sendWebhook(fail);
  await sendWebhook(fail);
  let { rows: [o] } = await pool.query('SELECT * FROM india_orders WHERE order_id=$1', [id]);
  assert.equal(o.status, 'failed');
  assert.equal(o.failed_attempts, 2);
  assert.equal(o.payment_message, 'Insufficient balance');
  assert.equal(o.payment_detail, 'Card · VISA ••••4242 · HDFC · debit_card');
  await sendWebhook(upiSuccess(id));
  ({ rows: [o] } = await pool.query('SELECT status FROM india_orders WHERE order_id=$1', [id]));
  assert.equal(o.status, 'paid');
});

test('India Sales: needs admin; today totals, partner breakdown and filters', async () => {
  const anon = fakeRes();
  await indiaSales(fakeReq({ method: 'GET', query: {} }), anon, deps);
  assert.equal(anon.statusCode, 401);

  const all = fakeRes();
  await indiaSales(fakeReq({ method: 'GET', headers: admin, query: {} }), all, deps);
  assert.equal(all.statusCode, 200);
  assert.equal(all._json.totals.sales, 2);
  assert.equal(all._json.totals.viaPartners, 1);
  assert.equal(all._json.totals.direct, 1);
  const ryan = all._json.byPartner.find(p => p.code === 'RYAN859');
  assert.equal(ryan.name, 'Ryan D');
  assert.equal(ryan.sales, 1);
  assert.equal(ryan.commission, 700);

  const onlyRyan = fakeRes();
  await indiaSales(fakeReq({ method: 'GET', headers: admin, query: { partner: 'RYAN859' } }), onlyRyan, deps);
  assert.equal(onlyRyan._json.rows.length, 1);
  assert.equal(onlyRyan._json.rows[0].cashfree.bankReference, '629183746512');
  assert.equal(onlyRyan._json.rows[0].commission, 700);

  const search = fakeRes();
  await indiaSales(fakeReq({ method: 'GET', headers: admin, query: { q: '629183746512' } }), search, deps);
  assert.equal(search._json.rows.length, 1);

  const lastYear = fakeRes();
  await indiaSales(fakeReq({ method: 'GET', headers: admin, query: { from: '2025-01-01', to: '2025-01-31' } }), lastYear, deps);
  assert.equal(lastYear._json.totals.sales, 0);
});

test('Studdy Logins: seats used/free and who is on each login; never a password', async () => {
  const r = fakeRes();
  await studdyLogins(fakeReq({ method: 'GET', headers: admin }), r, deps);
  assert.equal(r.statusCode, 200);
  const g1 = r._json.rows.find(x => x.groupName === 'Group 1');
  assert.equal(g1.used, 2);
  assert.equal(g1.free, 38);
  assert.equal(g1.customers.length, 2);
  assert.equal(JSON.stringify(r._json).includes('SECRET-PW-1'), false);
  assert.equal(JSON.stringify(r._json).includes('studdy_password'), false);

  const add = fakeRes();
  await studdyLogins(fakeReq({ method: 'POST', headers: admin, body: { groupName: 'Group 2', studdyEmail: 'g2@studdy.test', studdyPassword: 'pw-2', maxCapacity: 40 } }), add, deps);
  assert.equal(add.statusCode, 200);
  const dup = fakeRes();
  await studdyLogins(fakeReq({ method: 'POST', headers: admin, body: { groupName: 'Group 2', studdyEmail: 'g3@studdy.test', studdyPassword: 'pw-3', maxCapacity: 40 } }), dup, deps);
  assert.equal(dup.statusCode, 409);
  const again = fakeRes();
  await studdyLogins(fakeReq({ method: 'GET', headers: admin }), again, deps);
  assert.equal(again._json.nextName, 'Group 3');
  assert.equal(again._json.rows[0].groupName, 'Group 2'); // newest first

  const low = fakeRes();
  await studdyLogins(fakeReq({ method: 'PATCH', headers: admin, body: { id: g1.id, maxCapacity: 1 } }), low, deps);
  assert.equal(low.statusCode, 400);
});

test('new customers fill the OLDEST login first, not alphabetical ("Group 10" never before "Group 2")', async () => {
  await pool.query(`INSERT INTO studdy_accounts (group_name, studdy_email, studdy_password, max_capacity, created_at) VALUES ('Group 10','g10@studdy.test','pw', 40, now() + interval '1 day')`);
  const id = await newOrder({});
  await sendWebhook(upiSuccess(id));
  const { rows: [o] } = await pool.query('SELECT group_name FROM india_orders WHERE order_id=$1', [id]);
  assert.equal(o.group_name, 'Group 1');
  await pool.query(`UPDATE india_orders SET status='refunded' WHERE order_id=$1`, [id]);
  await pool.query(`UPDATE studdy_accounts SET active_customer_count = active_customer_count - 1 WHERE group_name='Group 1'`);
});

test('Release seat (test clean-up): seat freed, order stays paid, dashboard shows access ended and never re-assigns', async () => {
  const r = fakeRes();
  await indiaSales(fakeReq({ method: 'POST', headers: admin, body: { orderId: ryanOrder, action: 'release_seat' } }), r, deps);
  assert.equal(r.statusCode, 200);
  const { rows: [o] } = await pool.query('SELECT status, group_name, seat_released_at FROM india_orders WHERE order_id=$1', [ryanOrder]);
  assert.equal(o.status, 'paid');
  assert.equal(o.group_name, null);
  assert.ok(o.seat_released_at);
  assert.equal((await pool.query(`SELECT active_customer_count FROM studdy_accounts WHERE group_name='Group 1'`)).rows[0].active_customer_count, 1);

  const dash = fakeRes();
  await indiaSession(fakeReq({ query: { order_id: ryanOrder } }), dash, deps);
  assert.equal(dash._json.accessEnded, true);
  assert.equal(dash._json.accessPending, false);
  assert.equal(dash._json.studdyPassword, '');
  assert.equal((await pool.query('SELECT group_name FROM india_orders WHERE order_id=$1', [ryanOrder])).rows[0].group_name, null);
});

test('Mark refunded: commission drops to 0 in admin and the seat is freed', async () => {
  const id = await newOrder({ ref: 'RYAN859', plan: 'yearly' });
  await sendWebhook(upiSuccess(id, 14999));
  const before = (await pool.query(`SELECT active_customer_count FROM studdy_accounts WHERE group_name='Group 1'`)).rows[0].active_customer_count;
  const r = fakeRes();
  await indiaSales(fakeReq({ method: 'POST', headers: admin, body: { orderId: id, action: 'refund', note: 'Asked within 7 days' } }), r, deps);
  assert.equal(r.statusCode, 200);
  const { rows: [o] } = await pool.query('SELECT status, group_name, refund_note FROM india_orders WHERE order_id=$1', [id]);
  assert.equal(o.status, 'refunded');
  assert.equal(o.group_name, null);
  assert.equal(o.refund_note, 'Asked within 7 days');
  assert.equal((await pool.query(`SELECT active_customer_count FROM studdy_accounts WHERE group_name='Group 1'`)).rows[0].active_customer_count, before - 1);

  const again = fakeRes();
  await indiaSales(fakeReq({ method: 'POST', headers: admin, body: { orderId: id, action: 'refund' } }), again, deps);
  assert.equal(again.statusCode, 400);

  const list = fakeRes();
  await adminPartners(fakeReq({ method: 'GET', headers: admin }), list, deps);
  const ryan = list._json.partners.find(p => p.code === 'RYAN859');
  assert.equal(ryan.totals.sales, 1); // the refunded yearly sale doesn't count
  assert.equal(ryan.kyc_status, 'none');
  assert.equal(ryan.orders.length, 2);
});

/* ---------- customer states (funnel) ---------- */
import { classify } from '../../api/admin/india-sales.js';

test('states: unpaid attempt then paid = ONE sale (retried hidden); never-paid = abandoned after 1 hour; same number paying twice = two sales + double warning', () => {
  const NOW = new Date('2026-10-20T12:00:00Z');
  const at = (h) => new Date(NOW - h * 3600000).toISOString();
  const end = (days) => new Date(NOW.getTime() + days * 86400000).toISOString();
  const orders = [
    { order_id: 'a1', status: 'created', customer_phone: '9000000001', created_at: at(5) },                       // retried
    { order_id: 'a2', status: 'paid', customer_phone: '9000000001', created_at: at(4.9), paid_at: at(4.9), group_name: 'G', access_end: end(90) },
    { order_id: 'b1', status: 'failed', customer_phone: '9000000002', created_at: at(3) },                        // abandoned
    { order_id: 'c1', status: 'created', customer_phone: '9000000003', created_at: at(0.2) },                     // still in checkout
    { order_id: 'd1', status: 'paid', customer_phone: '9000000004', created_at: at(10), paid_at: at(10), group_name: 'G', access_end: end(90) },
    { order_id: 'd2', status: 'paid', customer_phone: '9000000004', created_at: at(9), paid_at: at(9), group_name: 'G', access_end: end(365) },
    { order_id: 'e1', status: 'paid', customer_phone: '9000000005', created_at: at(2000), paid_at: at(2000), group_name: 'G', access_end: end(3) }, // expiring
    { order_id: 'f1', status: 'paid', customer_phone: '9000000006', created_at: at(3000), paid_at: at(3000), group_name: 'G', access_end: end(-1) }, // expired
    { order_id: 'g1', status: 'paid', customer_phone: '9000000007', created_at: at(1), paid_at: at(1), group_name: null, access_end: end(90) },     // waiting
    { order_id: 'h1', status: 'paid', customer_phone: '9000000008', created_at: at(1), paid_at: at(1), group_name: null, seat_released_at: at(0.5), access_end: end(90) },
    { order_id: 'i1', status: 'test', customer_phone: '9000000009', created_at: at(1) },
  ];
  const { state, earlier, doubles } = classify(orders, NOW);
  assert.deepEqual(Object.fromEntries(state), {
    a1: 'retried', a2: 'active', b1: 'abandoned', c1: 'checkout', d1: 'active', d2: 'active',
    e1: 'expiring', f1: 'expired', g1: 'waiting', h1: 'released', i1: 'test',
  });
  assert.equal(earlier.get('a2'), 1);
  assert.deepEqual([...doubles].sort(), ['d1', 'd2']);
});

test('Mark as test order: out of sales, partner commission and seats; customer dashboard shows access ended', async () => {
  const id = await newOrder({ ref: 'RYAN859' });
  await sendWebhook(upiSuccess(id));
  const beforeSeats = (await pool.query(`SELECT active_customer_count FROM studdy_accounts WHERE group_name='Group 1'`)).rows[0].active_customer_count;
  const before = fakeRes();
  await indiaSales(fakeReq({ method: 'GET', headers: admin, query: {} }), before, deps);

  const r = fakeRes();
  await indiaSales(fakeReq({ method: 'POST', headers: admin, body: { orderId: id, action: 'mark_test', note: '₹10 test' } }), r, deps);
  assert.equal(r.statusCode, 200);
  const { rows: [o] } = await pool.query('SELECT status, group_name, marked_test_at FROM india_orders WHERE order_id=$1', [id]);
  assert.equal(o.status, 'test');
  assert.equal(o.group_name, null);
  assert.ok(o.marked_test_at);
  assert.equal((await pool.query(`SELECT active_customer_count FROM studdy_accounts WHERE group_name='Group 1'`)).rows[0].active_customer_count, beforeSeats - 1);

  const after = fakeRes();
  await indiaSales(fakeReq({ method: 'GET', headers: admin, query: {} }), after, deps);
  assert.equal(after._json.totals.sales, before._json.totals.sales - 1);
  assert.equal(after._json.rows.some(x => x.orderId === id), false); // hidden by default
  const tests = fakeRes();
  await indiaSales(fakeReq({ method: 'GET', headers: admin, query: { state: 'test' } }), tests, deps);
  assert.equal(tests._json.rows.some(x => x.orderId === id), true);

  const dash = fakeRes();
  await indiaSession(fakeReq({ query: { order_id: id } }), dash, deps);
  assert.equal(dash._json.accessEnded, true);
  assert.equal(dash._json.studdyPassword, '');

  /* A late duplicate webhook can never turn it back into a sale. */
  await sendWebhook(upiSuccess(id));
  assert.equal((await pool.query('SELECT status FROM india_orders WHERE order_id=$1', [id])).rows[0].status, 'test');
});
