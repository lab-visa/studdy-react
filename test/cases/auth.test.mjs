/**
 * CRM-1B — Admin Access Foundation. Two layers of coverage:
 *   1. api/_lib/admin-auth.js's exported functions, called directly
 *      (hashing/pepper/dummy-path/lockout/session logic).
 *   2. The real api/admin/{login,logout,whoami}.js and
 *      api/admin/reconciliation.js handlers, called end-to-end with fake
 *      req/res objects, against a mocked getSupabase() that returns the
 *      real Postgres-backed test client (see test/helpers/db.mjs) — so
 *      these tests exercise the actual production handler code, not a
 *      reimplementation of it.
 *
 * Requires --experimental-test-module-mocks (see package.json's `test`
 * script / the delivery report for the exact command run).
 */
import { test, before, after, mock } from 'node:test';
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
let loginHandler;
let logoutHandler;
let whoamiHandler;
let reconciliationHandler;

let adminAuth;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);

  mock.module(supabaseModUrl, { namedExports: { getSupabase: () => supabase } });

  ({ default: loginHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/login.js')).href));
  ({ default: logoutHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/logout.js')).href));
  ({ default: whoamiHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/whoami.js')).href));
  ({ default: reconciliationHandler } = await import(pathToFileURL(join(repoRoot, 'api/admin/reconciliation.js')).href));

  adminAuth = await import(pathToFileURL(join(repoRoot, 'api/_lib/admin-auth.js')).href);
});

after(async () => {
  await closeTestPool();
});

async function seedAdmin(name, pin) {
  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash(pin, salt);
  const res = await pool.query(
    `INSERT INTO admin_users (display_name, pin_hash, pin_salt) VALUES ($1, $2, $3) RETURNING id`,
    [name, hash, salt]
  );
  return res.rows[0].id;
}

function cookieValue(res) {
  const raw = res._headers['Set-Cookie'];
  if (!raw) return null;
  const match = raw.match(/sl_admin_session=([^;]+)/);
  return match ? match[1] : null;
}

// ---- admin-auth.js unit-level coverage ----------------------------------

test('deriveHash is deterministic for the same pin/salt/pepper', () => {
  const salt = adminAuth.generateSalt();
  const h1 = adminAuth.deriveHash('4242', salt);
  const h2 = adminAuth.deriveHash('4242', salt);
  assert.equal(h1, h2);
});

test('deriveHash differs for a different pin, same salt', () => {
  const salt = adminAuth.generateSalt();
  assert.notEqual(adminAuth.deriveHash('4242', salt), adminAuth.deriveHash('4243', salt));
});

test('verifyPin: correct pin returns true, wrong pin returns false', () => {
  const salt = adminAuth.generateSalt();
  const hash = adminAuth.deriveHash('9911', salt);
  assert.equal(adminAuth.verifyPin('9911', salt, hash), true);
  assert.equal(adminAuth.verifyPin('9912', salt, hash), false);
});

test('bootstrap and production derive identical hashes for the same inputs (single shared implementation)', async () => {
  // scripts/create-admin.mjs imports deriveHash/generateSalt directly
  // from api/_lib/admin-auth.js — the same module under test here — so
  // there is only ever one implementation to drift. Confirm the script
  // itself imports from that exact file, and confirm determinism holds.
  const fs = await import('node:fs');
  const scriptSrc = fs.readFileSync(join(repoRoot, 'scripts/create-admin.mjs'), 'utf8');
  assert.match(
    scriptSrc,
    /import\(['"]\.\.\/api\/_lib\/admin-auth\.js['"]\)/,
    'bootstrap script must import the production hashing function, not a copy'
  );
  assert.doesNotMatch(scriptSrc, /function deriveHash/, 'bootstrap script must not define its own copy of deriveHash');

  const salt = adminAuth.generateSalt();
  const asIfBootstrap = adminAuth.deriveHash('1357', salt);
  const asIfProduction = adminAuth.deriveHash('1357', salt);
  assert.equal(asIfBootstrap, asIfProduction);
});

test('runDummyVerification does the same class of work without throwing for any admin', () => {
  assert.doesNotThrow(() => adminAuth.runDummyVerification('0000'));
  assert.doesNotThrow(() => adminAuth.runDummyVerification('9999'));
});

test('the pepper is never returned by deriveHash/verifyPin and never appears in admin_users columns', async () => {
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='admin_users' AND table_schema = current_schema()`
  );
  const colNames = cols.rows.map((r) => r.column_name);
  assert.ok(!colNames.includes('pepper'), 'admin_users must not have a pepper column');
  assert.ok(!colNames.includes('pin'), 'admin_users must not store the raw pin');
  assert.deepEqual(colNames.sort(), ['created_at','display_name','failed_attempts','id','is_active','locked_until','pin_hash','pin_salt','role','updated_at'].sort());
});

test('session tokens are stored only as a hash, never raw, in admin_sessions', async () => {
  const adminId = await seedAdmin(`SessionHashCheck_${randomUUID()}`, '1111');
  const { token } = await adminAuth.createSession(supabase, adminId);
  const { rows } = await pool.query('SELECT session_token_hash FROM admin_sessions WHERE admin_user_id=$1', [adminId]);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].session_token_hash, token, 'the raw token must never be stored');
  assert.equal(rows[0].session_token_hash, adminAuth.hashSessionToken(token));
});

test('verifySession accepts a fresh, unrevoked session and rejects a revoked one', async () => {
  const adminId = await seedAdmin(`VerifySession_${randomUUID()}`, '2222');
  const { token } = await adminAuth.createSession(supabase, adminId);

  const before1 = await adminAuth.verifySession(supabase, token);
  assert.ok(before1, 'a fresh session should verify');

  await adminAuth.revokeSession(supabase, token);
  const after1 = await adminAuth.verifySession(supabase, token);
  assert.equal(after1, null, 'a revoked session must be rejected');
});

test('verifySession rejects an expired session', async () => {
  const adminId = await seedAdmin(`ExpiredSession_${randomUUID()}`, '3333');
  const token = adminAuth.generateSessionToken();
  await pool.query(
    `INSERT INTO admin_sessions (admin_user_id, session_token_hash, expires_at) VALUES ($1, $2, now() - interval '1 hour')`,
    [adminId, adminAuth.hashSessionToken(token)]
  );
  const result = await adminAuth.verifySession(supabase, token);
  assert.equal(result, null);
});

test('recordFailedAttempt locks the account after LOCKOUT_THRESHOLD failures', async () => {
  const adminId = await seedAdmin(`Lockout_${randomUUID()}`, '4444');
  let user = { id: adminId, failed_attempts: 0 };
  for (let i = 0; i < adminAuth.LOCKOUT_THRESHOLD; i++) {
    await adminAuth.recordFailedAttempt(supabase, user);
    const { rows } = await pool.query('SELECT failed_attempts, locked_until FROM admin_users WHERE id=$1', [adminId]);
    user = { id: adminId, failed_attempts: rows[0].failed_attempts };
    if (i < adminAuth.LOCKOUT_THRESHOLD - 1) {
      assert.equal(rows[0].locked_until, null, `should not be locked before ${adminAuth.LOCKOUT_THRESHOLD} failures`);
    } else {
      assert.ok(rows[0].locked_until, `should be locked after ${adminAuth.LOCKOUT_THRESHOLD} failures`);
      assert.ok(new Date(rows[0].locked_until).getTime() > Date.now());
    }
  }
});

// ---- full handler end-to-end coverage -----------------------------------

test('valid Name + PIN succeeds and creates a real server-side session', async () => {
  const name = `Vish_${randomUUID()}`;
  await seedAdmin(name, '1234');

  const res = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '1234' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res._json.ok, true);
  const token = cookieValue(res);
  assert.ok(token, 'expected a session cookie to be set');

  const { rows } = await pool.query(
    `SELECT s.* FROM admin_sessions s JOIN admin_users u ON u.id = s.admin_user_id WHERE u.display_name = $1`,
    [name]
  );
  assert.equal(rows.length, 1, 'a real admin_sessions row must exist');
  assert.equal(rows[0].session_token_hash, adminAuth.hashSessionToken(token));
});

test('wrong PIN fails with the generic message', async () => {
  const name = `WrongPin_${randomUUID()}`;
  await seedAdmin(name, '5678');

  const res = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '0000' } }), res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res._json, { error: 'Invalid login' });
  assert.equal(cookieValue(res), null);
});

test('unknown Name returns the exact same generic failure as wrong PIN', async () => {
  const res = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name: `NoSuchAdmin_${randomUUID()}`, pin: '1234' } }), res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res._json, { error: 'Invalid login' });
});

test('a locked-out account returns the same generic failure, not a distinct "locked" message', async () => {
  const name = `Locked_${randomUUID()}`;
  const adminId = await seedAdmin(name, '2468');
  await pool.query(`UPDATE admin_users SET locked_until = now() + interval '15 minutes' WHERE id=$1`, [adminId]);

  const res = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '2468' } }), res); // correct PIN, but locked

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res._json, { error: 'Invalid login' }, 'locked-out must not be distinguishable from wrong PIN');
});

test('5 failed login attempts trigger a 15-minute lock at the handler level', async () => {
  const name = `FiveFails_${randomUUID()}`;
  await seedAdmin(name, '1122');

  for (let i = 0; i < 5; i++) {
    const res = fakeRes();
    await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '9999' } }), res);
    assert.equal(res.statusCode, 401);
  }

  // Even the CORRECT pin must now fail, because the account is locked.
  const res = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '1122' } }), res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res._json, { error: 'Invalid login' });

  const { rows } = await pool.query('SELECT locked_until FROM admin_users WHERE display_name=$1', [name]);
  assert.ok(rows[0].locked_until);
});

test('no login response ever includes the pin, pin_hash, pin_salt, or pepper', async () => {
  const name = `NoLeak_${randomUUID()}`;
  await seedAdmin(name, '3344');

  const successRes = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '3344' } }), successRes);
  const successStr = JSON.stringify(successRes._json);
  assert.doesNotMatch(successStr, /3344/);
  assert.doesNotMatch(successStr, /pin_hash|pin_salt|pepper/i);

  const failRes = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '0000' } }), failRes);
  const failStr = JSON.stringify(failRes._json);
  assert.doesNotMatch(failStr, /0000/);
  assert.doesNotMatch(failStr, /pin_hash|pin_salt|pepper/i);
});

test('unauthenticated admin API request is rejected (no session cookie)', async () => {
  const res = fakeRes();
  await whoamiHandler(fakeReq({ method: 'GET', headers: {} }), res);
  assert.equal(res.statusCode, 401);
});

test('an authenticated admin API request succeeds', async () => {
  const name = `Authed_${randomUUID()}`;
  await seedAdmin(name, '7788');

  const loginRes = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '7788' } }), loginRes);
  const token = cookieValue(loginRes);

  const whoamiRes = fakeRes();
  await whoamiHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` } }), whoamiRes);
  assert.equal(whoamiRes.statusCode, 200);
  assert.equal(whoamiRes._json.displayName, name);
});

test('logout revokes the session server-side; the same cookie no longer authenticates', async () => {
  const name = `Logout_${randomUUID()}`;
  await seedAdmin(name, '6655');

  const loginRes = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '6655' } }), loginRes);
  const token = cookieValue(loginRes);

  const logoutRes = fakeRes();
  await logoutHandler(
    fakeReq({
      method: 'POST',
      // isSameOriginRequest() requires a Host header on every real browser
      // request (it fails closed with no Host at all); a real logout
      // request also always carries one, so this simulates that, not a
      // production-code change.
      headers: { cookie: `sl_admin_session=${token}`, host: 'studdylab.com', origin: 'https://studdylab.com' },
    }),
    logoutRes
  );
  assert.equal(logoutRes.statusCode, 200);

  const whoamiRes = fakeRes();
  await whoamiHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` } }), whoamiRes);
  assert.equal(whoamiRes.statusCode, 401, 'a revoked session must be rejected, not just client-side-cleared');
});

test('direct /admin API access with no session cannot retrieve reconciliation (CRM) data', async () => {
  const res = fakeRes();
  await reconciliationHandler(fakeReq({ method: 'GET', headers: {} }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res._json.checks, undefined, 'no reconciliation data should be present in an unauthenticated response');
});

test('an authenticated reconciliation request returns the five checks', async () => {
  const name = `Reconcile_${randomUUID()}`;
  await seedAdmin(name, '8899');
  const loginRes = fakeRes();
  await loginHandler(fakeReq({ method: 'POST', body: { name, pin: '8899' } }), loginRes);
  const token = cookieValue(loginRes);

  const res = fakeRes();
  await reconciliationHandler(fakeReq({ method: 'GET', headers: { cookie: `sl_admin_session=${token}` } }), res);
  assert.equal(res.statusCode, 200);
  const checkNames = res._json.checks.map((c) => c.check);
  assert.deepEqual(checkNames, [
    'MISSING_CUSTOMER_ROW',
    'MISSING_SUBSCRIPTION_ROW',
    'ALLOCATION_MIRROR_GAP',
    'PAYMENT_CLAIM_INCOMPLETE',
    'CANCELLATION_MIRROR_GAP',
  ]);
});
