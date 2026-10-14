/**
 * Sales partner programme: commission maths, application form, partner
 * earnings page, and admin approve flow — against a real test Postgres
 * (migrations incl. 0021 india_orders + 0022 partners) via the shim.
 */
process.env.ADMIN_PIN_PEPPER = 'test-suite-pepper-do-not-use-in-production';
process.env.NODE_ENV = 'test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { fakeReq, fakeRes } from '../helpers/fake-http.mjs';
import apply from '../../api/partners/apply.js';
import me from '../../api/partners/me.js';
import adminPartners from '../../api/admin/partners.js';
import * as adminAuth from '../../api/_lib/admin-auth.js';
import { computeEarnings, bonusFor, maskCustomer, makePartnerCode, istMonth, payoutDate } from '../../api/_lib/partners.js';

let pool;
let supabase;
let deps;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
  deps = { getSupabase: () => supabase };
});
after(async () => { await closeTestPool(); });

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-20T12:00:00Z');
const order = (o) => ({ order_id: randomUUID(), plan: 'yearly', amount: 14999, status: 'paid', customer_name: 'Asha Patil', customer_phone: '9876543210', ...o });

/* ---------- pure commission maths ---------- */

test('bonus: 0 below 10, ₹5,000 at 10, ₹15,000 at 20', () => {
  assert.equal(bonusFor(9), 0);
  assert.equal(bonusFor(10), 5000);
  assert.equal(bonusFor(19), 5000);
  assert.equal(bonusFor(20), 15000);
});

test('commission: yearly 2,500, quarterly 700, refunded 0; 7-day window decides payable vs pending', () => {
  const e = computeEarnings([
    order({ paid_at: new Date(NOW - 10 * DAY).toISOString() }),                       // payable
    order({ plan: 'quarterly', amount: 7999, paid_at: new Date(NOW - 2 * DAY).toISOString() }), // in window
    order({ status: 'refunded', paid_at: new Date(NOW - 9 * DAY).toISOString() }),   // refunded
  ], NOW);
  assert.equal(e.totals.sales, 2);
  assert.equal(e.totals.payable, 2500);
  assert.equal(e.totals.pending, 700);
  assert.equal(e.totals.earned, 3200);
  assert.deepEqual(e.sales.map(s => s.state).sort(), ['in_refund_window', 'payable', 'refunded']);
});

test('ten yearly sales in one month earn 10 × 2,500 + 5,000 bonus', () => {
  const orders = Array.from({ length: 10 }, (_, i) => order({ paid_at: new Date(Date.UTC(2026, 9, 1 + i, 6)).toISOString() }));
  const e = computeEarnings(orders, NOW);
  assert.equal(e.months.length, 1);
  assert.equal(e.months[0].bonus, 5000);
  assert.equal(e.months[0].total, 30000);
});

test('month is decided in India time (31 Oct 23:00 IST counts as October)', () => {
  assert.equal(istMonth('2026-10-31T17:30:00Z'), '2026-10'); // 23:00 IST
  assert.equal(istMonth('2026-10-31T18:45:00Z'), '2026-11'); // 00:15 IST, 1 Nov
});

test('payout is the 10th of the following month (India dates, Dec → Jan)', () => {
  assert.equal(payoutDate('2026-10-05T06:00:00Z'), '2026-11-10');
  assert.equal(payoutDate('2026-10-31T17:30:00Z'), '2026-11-10'); // 23:00 IST 31 Oct
  assert.equal(payoutDate('2026-12-20T06:00:00Z'), '2027-01-10');
});

test('partners only ever see masked customer details', () => {
  assert.equal(maskCustomer('Asha Patil', '9876543210'), 'Asha P. · ••••3210');
  assert.equal(maskCustomer('', ''), 'Customer');
});

test('partner codes are first name + 3 digits', () => {
  assert.match(makePartnerCode('Rahul Sharma'), /^RAHUL\d{3}$/);
  assert.match(makePartnerCode('राहुल'), /^PARTNER\d{3}$/);
});

/* ---------- application form ---------- */

const validApp = { name: 'Priya Nair', phone: '+91 91234 56789', email: 'priya@example.com', consent: true };

test('apply: validates input', async () => {
  for (const body of [{ ...validApp, name: '' }, { ...validApp, phone: '123' }, { ...validApp, email: 'x' }, { ...validApp, consent: false }]) {
    const res = fakeRes();
    await apply(fakeReq({ method: 'POST', body }), res, deps);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
});

let regCode;
let regToken;

test('register: instantly active, returns a unique sales link + private earnings link', async () => {
  const r1 = fakeRes();
  await apply(fakeReq({ method: 'POST', body: validApp }), r1, deps);
  assert.equal(r1.statusCode, 200, JSON.stringify(r1._json));
  assert.match(r1._json.code, /^PRIYA\d{3}$/);
  assert.equal(r1._json.salesLink, `https://studdylab.com/?ref=${r1._json.code}`);
  assert.match(r1._json.earningsLink, /^https:\/\/studdylab\.com\/partner\?t=[a-f0-9]{48}$/);
  regCode = r1._json.code;
  regToken = r1._json.earningsLink.split('t=')[1];

  const { rows } = await pool.query(`SELECT status, code, dashboard_token FROM partners WHERE phone='9123456789'`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'approved');
  assert.equal(rows[0].code, regCode);
  assert.equal(rows[0].dashboard_token, regToken);

  /* Earnings page works immediately. */
  const page = fakeRes();
  await me(fakeReq({ query: { t: regToken } }), page, deps);
  assert.equal(page.statusCode, 200);
  assert.equal(page._json.rules.payoutDay, 10);
  assert.equal(page._json.rules.commission.quarterly, 700);
});

test('register: same mobile twice → 409 and the existing links are NOT revealed', async () => {
  const r2 = fakeRes();
  await apply(fakeReq({ method: 'POST', body: { ...validApp, email: 'other@example.com' } }), r2, deps);
  assert.equal(r2.statusCode, 409);
  assert.equal(JSON.stringify(r2._json).includes(regToken), false);
  assert.equal(r2._json.code, undefined);
});

/* ---------- admin approve + partner page ---------- */

async function adminCookie() {
  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash('1234', salt);
  const res = await pool.query(`INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ($1,$2,$3) RETURNING id`, [`Owner_${randomUUID()}`, hash, salt]);
  const { token } = await adminAuth.createSession(supabase, res.rows[0].id);
  return { cookie: `sl_admin_session=${token}`, origin: 'https://studdylab.com', host: 'studdylab.com' };
}

test('admin endpoints refuse requests without an admin session', async () => {
  const r1 = fakeRes();
  await adminPartners(fakeReq({ method: 'GET' }), r1, deps);
  assert.equal(r1.statusCode, 401);
  const r2 = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers: { origin: 'https://studdylab.com', host: 'studdylab.com' }, body: { id: randomUUID(), action: 'approve' } }), r2, deps);
  assert.equal(r2.statusCode, 401);
});

test('pause/resume never changes the code or link; partner page shows only their own sales, masked', async () => {
  const headers = await adminCookie();
  const { rows: [p] } = await pool.query(`SELECT id FROM partners WHERE phone='9123456789'`);
  const code = regCode;
  const token = regToken;

  for (const action of ['pause', 'resume']) {
    const r = fakeRes();
    await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, action } }), r, deps);
    assert.equal(r.statusCode, 200, JSON.stringify(r._json));
    assert.equal(r._json.partner.code, code);
    assert.equal(r._json.partner.dashboard_token, token);
  }

  /* Two paid sales for this partner, one for someone else, one unpaid. */
  const ins = (ref, status, daysAgo) => pool.query(
    `INSERT INTO india_orders (order_id, plan, amount, months, customer_name, customer_phone, ref_code, status, paid_at)
     VALUES ($1,'yearly',14999,12,'Ravi Kumar','9988776655',$2,$3, now() - ($4 || ' days')::interval)`,
    [`SLIN_${randomUUID().replace(/-/g, '').slice(0, 30)}`, ref, status, String(daysAgo)]);
  await ins(code, 'paid', 10);
  await ins(code, 'paid', 1);
  await ins('SOMEONEELSE1', 'paid', 10);
  await ins(code, 'created', 0);

  const page = fakeRes();
  await me(fakeReq({ query: { t: token } }), page, deps);
  assert.equal(page.statusCode, 200);
  assert.equal(page._json.code, code);
  assert.equal(page._json.totals.sales, 2);
  assert.equal(page._json.totals.payable, 2500);
  assert.equal(page._json.totals.pending, 2500);
  assert.equal(page._json.sales[0].customer, 'Ravi K. · ••••6655');
  assert.equal(JSON.stringify(page._json).includes('9988776655'), false);

  /* Admin list shows the same totals. */
  const list = fakeRes();
  await adminPartners(fakeReq({ method: 'GET', headers }), list, deps);
  const row = list._json.partners.find(x => x.id === p.id);
  assert.equal(row.totals.sales, 2);
});

test('partner page: bad or unknown token → 404; rejected partner → 404', async () => {
  for (const t of ['nope', 'a'.repeat(48)]) {
    const res = fakeRes();
    await me(fakeReq({ query: { t } }), res, deps);
    assert.equal(res.statusCode, 404);
  }
  const headers = await adminCookie();
  const { rows: [p] } = await pool.query(`SELECT id, dashboard_token FROM partners WHERE phone='9123456789'`);
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, action: 'reject' } }), fakeRes(), deps);
  const res = fakeRes();
  await me(fakeReq({ query: { t: p.dashboard_token } }), res, deps);
  assert.equal(res.statusCode, 404);
});

test('admin PAN check rejects a malformed PAN and saves a valid one', async () => {
  const headers = await adminCookie();
  const { rows: [p] } = await pool.query(`SELECT id FROM partners WHERE phone='9123456789'`);
  const bad = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, pan: '1234' } }), bad, deps);
  assert.equal(bad.statusCode, 400);
  const good = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, pan: 'abcde1234f', payoutUpi: 'priya@upi' } }), good, deps);
  assert.equal(good._json.partner.pan, 'ABCDE1234F');
  assert.equal(good._json.partner.payout_upi, 'priya@upi');
});
