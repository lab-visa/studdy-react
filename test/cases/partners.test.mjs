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
import auth from '../../api/partners/auth.js';
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

/* ---------- application form + login ---------- */

const H = { origin: 'https://studdylab.com', host: 'studdylab.com' };
const validApp = { name: 'Priya Nair', phone: '+91 91234 56789', email: 'priya@example.com', city: 'Pune', pin: '482913', consent: true };
const cookieFrom = (res) => (res._headers['Set-Cookie'] || '').split(';')[0];
const post = async (handler, body, headers = {}) => { const r = fakeRes(); await handler(fakeReq({ method: 'POST', headers: { ...H, ...headers }, body }), r, deps); return r; };
const getMe = async (cookie) => { const r = fakeRes(); await me(fakeReq({ headers: cookie ? { cookie } : {} }), r, deps); return r; };

test('apply: validates input, including a 6-digit, not-too-easy PIN', async () => {
  for (const body of [
    { ...validApp, name: '' }, { ...validApp, phone: '123' }, { ...validApp, email: 'x' }, { ...validApp, consent: false },
    { ...validApp, pin: '12345' }, { ...validApp, pin: '111111' }, { ...validApp, pin: '123456' }, { ...validApp, pin: undefined },
  ]) {
    const res = await post(apply, body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
});

test('apply: refuses cross-site requests', async () => {
  const res = await post(apply, validApp, { origin: 'https://evil.example' });
  assert.equal(res.statusCode, 403);
});

let regCode;
let regCookie;

test('register: instantly active, logged in by cookie, PIN stored only as a hash', async () => {
  const r1 = await post(apply, validApp);
  assert.equal(r1.statusCode, 200, JSON.stringify(r1._json));
  assert.match(r1._json.code, /^PRIYA\d{3}$/);
  assert.equal(r1._json.salesLink, `https://studdylab.com/?ref=${r1._json.code}`);
  assert.equal(r1._json.earningsLink, undefined);
  assert.match(r1._headers['Set-Cookie'], /^sl_partner_session=[a-f0-9]{64}; HttpOnly/);
  regCode = r1._json.code;
  regCookie = cookieFrom(r1);

  const { rows } = await pool.query(`SELECT status, code, city, pin_hash, pin_salt FROM partners WHERE phone='9123456789'`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'approved');
  assert.equal(rows[0].city, 'Pune');
  assert.ok(rows[0].pin_hash && rows[0].pin_salt);
  assert.equal(rows[0].pin_hash.includes('482913'), false);

  const page = await getMe(regCookie);
  assert.equal(page.statusCode, 200);
  assert.equal(page._json.code, regCode);
  assert.equal(page._json.mustChangePin, false);
  assert.equal(page._json.rules.payoutDay, 10);
});

test('earnings page needs a valid login', async () => {
  assert.equal((await getMe()).statusCode, 401);
  assert.equal((await getMe(`sl_partner_session=${'a'.repeat(64)}`)).statusCode, 401);
});

test('register: same mobile twice → 409, nothing revealed, no login', async () => {
  const r2 = await post(apply, { ...validApp, email: 'other@example.com' });
  assert.equal(r2.statusCode, 409);
  assert.equal(r2._json.code, undefined);
  assert.equal(r2._headers['Set-Cookie'], undefined);
});

test('login: right number + PIN works; wrong PIN and unknown number give the same answer', async () => {
  const ok = await post(auth, { action: 'login', phone: '91234 56789', pin: '482913' });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok._json.mustChange, false);
  assert.equal((await getMe(cookieFrom(ok))).statusCode, 200);

  const wrong = await post(auth, { action: 'login', phone: '9123456789', pin: '000001' });
  const unknown = await post(auth, { action: 'login', phone: '9000000000', pin: '482913' });
  assert.equal(wrong.statusCode, 401);
  assert.equal(unknown.statusCode, 401);
  assert.equal(wrong._json.error, unknown._json.error);
});

test('login: 5 wrong PINs lock the account, even the right PIN is refused while locked', async () => {
  await pool.query(`UPDATE partners SET failed_attempts=0, locked_until=NULL WHERE phone='9123456789'`);
  let last;
  for (let i = 0; i < 5; i++) last = await post(auth, { action: 'login', phone: '9123456789', pin: '000002' });
  assert.equal(last.statusCode, 429);
  const right = await post(auth, { action: 'login', phone: '9123456789', pin: '482913' });
  assert.equal(right.statusCode, 429);
  await pool.query(`UPDATE partners SET failed_attempts=0, locked_until=NULL WHERE phone='9123456789'`);
});

test('change PIN needs the current PIN; logout ends the session', async () => {
  const login = await post(auth, { action: 'login', phone: '9123456789', pin: '482913' });
  const cookie = cookieFrom(login);
  const bad = await post(auth, { action: 'change_pin', currentPin: '999999', newPin: '271828' }, { cookie });
  assert.equal(bad.statusCode, 400);
  const good = await post(auth, { action: 'change_pin', currentPin: '482913', newPin: '271828' }, { cookie });
  assert.equal(good.statusCode, 200);
  assert.equal((await post(auth, { action: 'login', phone: '9123456789', pin: '482913' })).statusCode, 401);
  assert.equal((await post(auth, { action: 'login', phone: '9123456789', pin: '271828' })).statusCode, 200);

  await post(auth, { action: 'logout' }, { cookie });
  assert.equal((await getMe(cookie)).statusCode, 401);
});

/* ---------- admin ---------- */

async function adminCookie() {
  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash('1234', salt);
  const res = await pool.query(`INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ($1,$2,$3) RETURNING id`, [`Owner_${randomUUID()}`, hash, salt]);
  const { token } = await adminAuth.createSession(supabase, res.rows[0].id);
  return { cookie: `sl_admin_session=${token}`, ...H };
}

test('admin endpoints refuse requests without an admin session', async () => {
  const r1 = fakeRes();
  await adminPartners(fakeReq({ method: 'GET' }), r1, deps);
  assert.equal(r1.statusCode, 401);
  const r2 = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers: H, body: { id: randomUUID(), action: 'reset_pin' } }), r2, deps);
  assert.equal(r2.statusCode, 401);
});

test('admin Reset PIN: temporary PIN shown once, partner logged out everywhere, must choose a new PIN', async () => {
  const headers = await adminCookie();
  const { rows: [p] } = await pool.query(`SELECT id FROM partners WHERE phone='9123456789'`);
  const before = cookieFrom(await post(auth, { action: 'login', phone: '9123456789', pin: '271828' }));

  const r = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, action: 'reset_pin' } }), r, deps);
  assert.equal(r.statusCode, 200);
  assert.match(r._json.tempPin, /^\d{6}$/);
  assert.equal((await getMe(before)).statusCode, 401);

  const login = await post(auth, { action: 'login', phone: '9123456789', pin: r._json.tempPin });
  assert.equal(login.statusCode, 200);
  assert.equal(login._json.mustChange, true);
  const cookie = cookieFrom(login);
  assert.equal((await getMe(cookie))._json.mustChangePin, true);
  const set = await post(auth, { action: 'change_pin', newPin: '582039' }, { cookie });
  assert.equal(set.statusCode, 200);
  assert.equal((await getMe(cookie))._json.mustChangePin, false);

  /* The admin list never exposes PIN material. */
  const list = fakeRes();
  await adminPartners(fakeReq({ method: 'GET', headers }), list, deps);
  const row = list._json.partners.find(x => x.id === p.id);
  assert.equal(row.has_pin, true);
  assert.equal(JSON.stringify(list._json).includes('pin_hash'), false);
});

test('pause/resume never changes the code; partner page shows only their own sales, masked', async () => {
  const headers = await adminCookie();
  const { rows: [p] } = await pool.query(`SELECT id FROM partners WHERE phone='9123456789'`);
  const code = regCode;

  for (const action of ['pause', 'resume']) {
    const r = fakeRes();
    await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, action } }), r, deps);
    assert.equal(r.statusCode, 200, JSON.stringify(r._json));
    assert.equal(r._json.partner.code, code);
    assert.equal(r._json.partner.pin_hash, undefined);
  }

  const ins = (ref, status, daysAgo) => pool.query(
    `INSERT INTO india_orders (order_id, plan, amount, months, customer_name, customer_phone, ref_code, status, paid_at)
     VALUES ($1,'yearly',14999,12,'Ravi Kumar','9988776655',$2,$3, now() - ($4 || ' days')::interval)`,
    [`SLIN_${randomUUID().replace(/-/g, '').slice(0, 30)}`, ref, status, String(daysAgo)]);
  await ins(code, 'paid', 10);
  await ins(code, 'paid', 1);
  await ins('SOMEONEELSE1', 'paid', 10);
  await ins(code, 'created', 0);

  const cookie = cookieFrom(await post(auth, { action: 'login', phone: '9123456789', pin: '582039' }));
  const page = await getMe(cookie);
  assert.equal(page.statusCode, 200);
  assert.equal(page._json.totals.sales, 2);
  assert.equal(page._json.totals.payable, 2500);
  assert.equal(page._json.totals.pending, 2500);
  assert.equal(page._json.sales[0].customer, 'Ravi K. · ••••6655');
  assert.equal(JSON.stringify(page._json).includes('9988776655'), false);

  const list = fakeRes();
  await adminPartners(fakeReq({ method: 'GET', headers }), list, deps);
  const row = list._json.partners.find(x => x.id === p.id);
  assert.equal(row.totals.sales, 2);
  assert.equal(row.sales_ever, 2);
});

test('admin Delete: refused for a partner with sales, works for one without', async () => {
  const headers = await adminCookie();
  const { rows: [withSales] } = await pool.query(`SELECT id FROM partners WHERE phone='9123456789'`);
  const r1 = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: withSales.id, action: 'delete' } }), r1, deps);
  assert.equal(r1.statusCode, 400);

  const fresh = await post(apply, { ...validApp, name: 'Kiran Rao', phone: '9812345670', email: 'kiran@example.com' });
  const { rows: [k] } = await pool.query(`SELECT id FROM partners WHERE phone='9812345670'`);
  const r2 = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: k.id, action: 'delete' } }), r2, deps);
  assert.equal(r2.statusCode, 200);
  assert.equal((await pool.query(`SELECT 1 FROM partners WHERE phone='9812345670'`)).rowCount, 0);
  assert.equal((await getMe(cookieFrom(fresh))).statusCode, 401);
});

test('rejected partner cannot log in', async () => {
  const headers = await adminCookie();
  const { rows: [p] } = await pool.query(`SELECT id FROM partners WHERE phone='9123456789'`);
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, action: 'reject' } }), fakeRes(), deps);
  assert.equal((await post(auth, { action: 'login', phone: '9123456789', pin: '582039' })).statusCode, 401);
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, action: 'resume' } }), fakeRes(), deps);
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

/* ---------- payout details, PAN photo, payouts ---------- */

import payoutDetails from '../../api/partners/payout-details.js';
import adminPayouts from '../../api/admin/partner-payouts.js';

const uploads = [];
const fakeStorage = { from: () => ({
  upload: async (path) => { uploads.push(path); return { error: null }; },
  remove: async () => ({ error: null }),
  createSignedUrl: async (path, secs) => ({ data: { signedUrl: `https://signed.example/${path}?e=${secs}` }, error: null }),
}) };
const sdeps = () => ({ ...deps, storage: fakeStorage });
const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from('ffd8ffe0', 'hex'), Buffer.alloc(3000, 7)]).toString('base64');
const goodDetails = { action: 'save', holder: 'Priya Nair', account: '123456789012', account2: '123456789012', ifsc: 'sbin0001234', bankName: 'State Bank of India', upi: 'priya@okaxis', pan: 'abcde1234f', aadhaarLast4: '4321', aadhaarConsent: true };

async function priyaCookie() {
  return cookieFrom(await post(auth, { action: 'login', phone: '9123456789', pin: '582039' }));
}
async function postDetails(body, cookie) {
  const r = fakeRes();
  await payoutDetails(fakeReq({ method: 'POST', headers: { ...H, cookie }, body }), r, sdeps());
  return r;
}

test('payout details: validated, saved, only shown back masked; only the last 4 Aadhaar digits are ever stored', async () => {
  const cookie = await priyaCookie();
  for (const bad of [
    { ...goodDetails, account2: '123456789013' }, { ...goodDetails, ifsc: 'SBIN1234' },
    { ...goodDetails, pan: '1234' }, { ...goodDetails, upi: 'nope' }, { ...goodDetails, holder: 'P' },
    { ...goodDetails, aadhaarLast4: '1234 5678 9012' }, { ...goodDetails, aadhaarLast4: '12' }, { ...goodDetails, aadhaarConsent: false },
  ]) assert.equal((await postDetails(bad, cookie)).statusCode, 400, JSON.stringify(bad));

  const ok = await postDetails(goodDetails, cookie);
  assert.equal(ok.statusCode, 200, JSON.stringify(ok._json));
  assert.equal(ok._json.details.account, '••••9012');
  assert.equal(ok._json.details.pan, 'AB•••••34F');
  assert.equal(ok._json.details.ifsc, 'SBIN0001234');
  assert.equal(ok._json.details.aadhaar, 'XXXX XXXX 4321');
  assert.equal(ok._json.details.complete, false); // photos still missing
  assert.equal(JSON.stringify(ok._json).includes('123456789012'), false);
  assert.equal(JSON.stringify(ok._json).includes('ABCDE1234F'), false);

  const { rows: [row] } = await pool.query(`SELECT aadhaar_last4, aadhaar_consent_at FROM partners WHERE phone='9123456789'`);
  assert.equal(row.aadhaar_last4, '4321');
  assert.ok(row.aadhaar_consent_at);
  await assert.rejects(pool.query(`UPDATE partners SET aadhaar_last4='123456789012' WHERE phone='9123456789'`)); // DB refuses a full number
});

test('KYC photos (PAN, Aadhaar front/back): only real images; private; complete only when all three are in; admin gets 5-minute links', async () => {
  const cookie = await priyaCookie();
  assert.equal((await postDetails({ action: 'photo', kind: 'pan', photo: 'data:image/jpeg;base64,AAAA' }, cookie)).statusCode, 400);
  assert.equal((await postDetails({ action: 'photo', kind: 'pan', photo: 'data:application/pdf;base64,' + Buffer.alloc(3000).toString('base64') }, cookie)).statusCode, 400);
  const fake = 'data:image/jpeg;base64,' + Buffer.alloc(3000, 1).toString('base64'); // wrong magic bytes
  assert.equal((await postDetails({ action: 'photo', kind: 'pan', photo: fake }, cookie)).statusCode, 400);
  assert.equal((await postDetails({ action: 'photo', kind: 'voter_id', photo: jpeg }, cookie)).statusCode, 400);

  const ok = await postDetails({ action: 'photo', kind: 'pan', photo: jpeg }, cookie);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok._json.details.complete, false); // Aadhaar photos still missing
  assert.match(uploads.at(-1), /^pan\/[0-9a-f-]+\/\d+\.jpg$/);
  await postDetails({ action: 'photo', kind: 'aadhaar_front', photo: jpeg }, cookie);
  const done = await postDetails({ action: 'photo', kind: 'aadhaar_back', photo: jpeg }, cookie);
  assert.equal(done._json.details.complete, true);
  assert.match(uploads.at(-1), /^aadhaar_back\//);

  const page = await getMe(cookie);
  assert.equal(page._json.payoutDetails.complete, true);
  assert.equal(page._json.payoutDetails.hasPanPhoto, true);
  assert.equal(page._json.payoutDetails.hasAadhaarFront, true);

  const headers = await adminCookie();
  const { rows: [p] } = await pool.query(`SELECT id, payout_details_checked_at FROM partners WHERE phone='9123456789'`);
  assert.equal(p.payout_details_checked_at, null);
  const link = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, action: 'doc_url', kind: 'aadhaar_front' } }), link, sdeps());
  assert.match(link._json.url, /aadhaar_front\/.*e=300$/);
  const chk = fakeRes();
  await adminPartners(fakeReq({ method: 'PATCH', headers, body: { id: p.id, action: 'details_checked' } }), chk, sdeps());
  assert.equal(chk.statusCode, 200);

  /* Changing the bank account clears the admin's "checked" mark. */
  await postDetails({ ...goodDetails, account: '999988887777', account2: '999988887777' }, cookie);
  const { rows: [after] } = await pool.query(`SELECT payout_details_checked_at FROM partners WHERE id=$1`, [p.id]);
  assert.equal(after.payout_details_checked_at, null);
});

test('payouts: list for a month with TDS, refuse an unfinished month, mark paid once, partner sees it', async () => {
  const headers = await adminCookie();
  const NOW2 = new Date('2026-10-20T06:00:00Z');
  const pdeps = { ...sdeps(), now: NOW2 };
  const { rows: [p] } = await pool.query(`SELECT id, code FROM partners WHERE phone='9123456789'`);
  const ins = (paidAt, plan = 'yearly') => pool.query(
    `INSERT INTO india_orders (order_id, plan, amount, months, customer_name, customer_phone, ref_code, status, paid_at)
     VALUES ($1,$2,14999,12,'Meera S','9000011111',$3,'paid',$4)`,
    [`SLIN_${randomUUID().replace(/-/g, '').slice(0, 30)}`, plan, p.code, paidAt]);
  await ins('2026-09-05T06:00:00Z');
  await ins('2026-09-18T06:00:00Z', 'quarterly');

  const setRate = fakeRes();
  await adminPayouts(fakeReq({ method: 'PUT', headers, body: { tdsRate: 2 } }), setRate, pdeps);
  assert.equal(setRate.statusCode, 200);

  const list = fakeRes();
  await adminPayouts(fakeReq({ method: 'GET', headers, query: {} }), list, pdeps);
  assert.equal(list._json.month, '2026-09');
  assert.equal(list._json.payable, true);
  const row = list._json.rows.find(r => r.partnerId === p.id);
  assert.equal(row.gross, 3200);
  assert.equal(row.tds, 64);
  assert.equal(row.net, 3136);
  assert.equal(row.bank.account, '999988887777'); // admin sees full details to pay

  const early = fakeRes();
  await adminPayouts(fakeReq({ method: 'POST', headers, body: { partnerId: p.id, month: '2026-10', utr: 'UTR123456', paidOn: '2026-10-20' } }), early, pdeps);
  assert.equal(early.statusCode, 400);

  const pay = fakeRes();
  await adminPayouts(fakeReq({ method: 'POST', headers, body: { partnerId: p.id, month: '2026-09', utr: 'axis123456789', paidOn: '2026-10-10' } }), pay, pdeps);
  assert.equal(pay.statusCode, 200, JSON.stringify(pay._json));
  assert.equal(pay._json.payout.net, 3136);
  assert.equal(pay._json.payout.utr, 'AXIS123456789');

  const again = fakeRes();
  await adminPayouts(fakeReq({ method: 'POST', headers, body: { partnerId: p.id, month: '2026-09', utr: 'AXIS999999', paidOn: '2026-10-10' } }), again, pdeps);
  assert.equal(again.statusCode, 409);

  const page = await getMe(await priyaCookie());
  const hist = page._json.payouts.find(x => x.month === '2026-09');
  assert.equal(hist.net, 3136);
  assert.equal(hist.utr, 'AXIS123456789');
  assert.equal(page._json.tdsRate, 2);
});

test('payouts: held when bank details or PAN photo are missing', async () => {
  const headers = await adminCookie();
  const fresh = await post(apply, { ...validApp, name: 'Neha Joshi', phone: '9822334455', email: 'neha@example.com' });
  assert.equal(fresh.statusCode, 200);
  const { rows: [n] } = await pool.query(`SELECT id, code FROM partners WHERE phone='9822334455'`);
  await pool.query(
    `INSERT INTO india_orders (order_id, plan, amount, months, customer_name, customer_phone, ref_code, status, paid_at)
     VALUES ($1,'yearly',14999,12,'Om K','9000022222',$2,'paid','2026-09-09T06:00:00Z')`,
    [`SLIN_${randomUUID().replace(/-/g, '').slice(0, 30)}`, n.code]);
  const pay = fakeRes();
  await adminPayouts(fakeReq({ method: 'POST', headers, body: { partnerId: n.id, month: '2026-09', utr: 'UTR7654321', paidOn: '2026-10-10' } }), pay, { ...sdeps(), now: new Date('2026-10-20T06:00:00Z') });
  assert.equal(pay.statusCode, 400);
  assert.match(pay._json.error, /missing/);
});
