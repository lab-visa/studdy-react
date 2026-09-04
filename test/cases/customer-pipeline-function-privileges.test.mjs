/**
 * CRM-3A migration 0017 security hardening (ChatGPT review round 2) —
 * proves search_customer_pipeline()'s EXECUTE privilege lockdown is
 * REAL, not just present in the SQL text:
 *
 *   1. `anon` and `authenticated` (Supabase's two browser-facing roles)
 *      cannot execute the function at all — PUBLIC's default EXECUTE
 *      grant was explicitly REVOKEd, and neither role was separately
 *      granted it.
 *   2. `service_role` (the role behind this backend's own service-role
 *      Supabase key) CAN execute it — proving the lockdown isn't
 *      accidentally denying the one role that's actually supposed to
 *      use it.
 *   3. A bare NOSUPERUSER NOBYPASSRLS role with no special membership
 *      at all is denied too — the default-deny baseline every other
 *      role (this test suite's own probe included) is judged against.
 *
 * Uses a single LOGIN probe role that is a member of all three
 * standard roles, switching identity mid-session with SET ROLE (the
 * same mechanism PostgREST itself uses per-request in real Supabase —
 * see api/_lib/supabase.js's own header comment on service-role vs.
 * anon/authenticated keys) rather than three separate roles, so this
 * exercises privilege resolution exactly the way production does.
 *
 * The application's own server-side path (api/_lib/supabase.js's
 * SERVICE ROLE key, and this test suite's own `crm_test` superuser
 * connection — see test/helpers/db.mjs) is a superuser locally and
 * therefore bypasses ALL privilege checks, including function EXECUTE
 * — every other test in this suite already proves that path keeps
 * working (customer-pipeline-pagination.test.mjs,
 * customer-pipeline-stage-parity.test.mjs). This file is what proves
 * the REVOKE/GRANT actually matters for a genuinely non-superuser
 * connection, the shape every real anon/authenticated/service_role
 * Supabase key actually has.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';

const { Pool } = pg;

let pool;
let dbName;

before(async () => {
  pool = await getTestPool();
  const { rows } = await pool.query('SELECT current_database() AS db');
  dbName = rows[0].db;
});

after(async () => {
  await closeTestPool();
});

test('search_customer_pipeline: PUBLIC/anon/authenticated denied, service_role allowed, a bare non-privileged role denied', async () => {
  const roleName = `pipeline_priv_probe_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const rolePassword = randomUUID();

  // NOINHERIT is deliberate and load-bearing, not incidental: it means
  // simply being a member of anon/authenticated/service_role does NOT
  // automatically activate those roles' privileges — this role must
  // explicitly SET ROLE into one to use it, exactly like real
  // Supabase's own `authenticator` role (the one PostgREST actually
  // connects as) is configured, and exactly why PostgREST issues a
  // `SET ROLE anon`/`SET ROLE authenticated`/`SET ROLE service_role`
  // per request rather than relying on membership alone.
  await pool.query(
    `CREATE ROLE "${roleName}" LOGIN PASSWORD '${rolePassword}' NOSUPERUSER NOBYPASSRLS NOINHERIT IN ROLE anon, authenticated, service_role`
  );
  await pool.query(`GRANT CONNECT ON DATABASE "${dbName}" TO "${roleName}"`);

  const { rows: roleCheck } = await pool.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1', [roleName]);
  assert.equal(roleCheck[0].rolsuper, false, 'probe role must not be a superuser (superusers always bypass every privilege check)');
  assert.equal(roleCheck[0].rolbypassrls, false, 'probe role must not have BYPASSRLS');

  let probePool;
  try {
    probePool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: roleName,
      password: rolePassword,
      database: dbName,
    });

    // Bare probe role itself — no elevated membership active yet.
    await assert.rejects(
      () => probePool.query('SELECT * FROM search_customer_pipeline()'),
      /permission denied for function|permission denied/i,
      'a bare NOSUPERUSER NOBYPASSRLS role with no service_role membership active must be denied EXECUTE'
    );

    // anon — PostgREST's unauthenticated-request role in real Supabase.
    await probePool.query('SET ROLE anon');
    await assert.rejects(
      () => probePool.query('SELECT * FROM search_customer_pipeline()'),
      /permission denied for function|permission denied/i,
      'anon must be denied EXECUTE — this function returns full customer PII across the whole population'
    );

    // authenticated — PostgREST's logged-in-end-user role in real Supabase.
    await probePool.query('RESET ROLE');
    await probePool.query('SET ROLE authenticated');
    await assert.rejects(
      () => probePool.query('SELECT * FROM search_customer_pipeline()'),
      /permission denied for function|permission denied/i,
      'authenticated must be denied EXECUTE — an end-user session must never call this directly'
    );

    // service_role — the backend's own role. This must SUCCEED: not
    // just "not throw at the EXECUTE check", but actually return the
    // function's real result (SECURITY INVOKER means it also needs
    // real table privileges, which the test DB template grants
    // service_role — see test/helpers/db.mjs).
    await probePool.query('RESET ROLE');
    await probePool.query('SET ROLE service_role');
    const { rows } = await probePool.query('SELECT * FROM search_customer_pipeline()');
    assert.ok(Array.isArray(rows), 'service_role must be able to execute the function and get real rows back (even an empty-table marker row), not a permission error');
  } finally {
    if (probePool) await probePool.end();
    await pool.query(`REVOKE CONNECT ON DATABASE "${dbName}" FROM "${roleName}"`);
    await pool.query(`DROP ROLE IF EXISTS "${roleName}"`);
  }
});

test('search_customer_pipeline: PUBLIC has no EXECUTE grant on the function at all (catalog-level check)', async () => {
  const { rows } = await pool.query(
    `SELECT has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute
     FROM pg_proc p
     WHERE p.proname = 'search_customer_pipeline'`
  );
  assert.equal(rows.length, 1, 'search_customer_pipeline must exist');
  assert.equal(rows[0].public_can_execute, false, 'PUBLIC must not have EXECUTE on search_customer_pipeline');
});

test('search_customer_pipeline: is declared SECURITY INVOKER, not SECURITY DEFINER', async () => {
  const { rows } = await pool.query(
    `SELECT prosecdef FROM pg_proc WHERE proname = 'search_customer_pipeline'`
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].prosecdef, false, 'prosecdef=false means SECURITY INVOKER — this function must never silently become SECURITY DEFINER');
});

test('search_customer_pipeline: search_path is pinned to the exact empty string (ChatGPT review round 3), not merely "some value" and not public,pg_catalog', async () => {
  const { rows } = await pool.query(
    `SELECT proconfig FROM pg_proc WHERE proname = 'search_customer_pipeline'`
  );
  assert.equal(rows.length, 1);
  assert.ok(rows[0].proconfig, 'search_customer_pipeline must pin its own search_path (proconfig), not inherit the caller session\'s');
  // proconfig stores `set search_path = ''` as the literal text
  // 'search_path=""' (empty-string-quoted, confirmed against a live
  // catalog read) — asserting the EXACT entry, not merely that some
  // search_path= prefix exists, is what actually catches a regression
  // back to `public, pg_catalog` (which round 3 found still lists a
  // caller-writable schema ahead of the always-implicitly-searched
  // pg_catalog — see 0017's own header comment for the full rationale).
  assert.ok(
    rows[0].proconfig.includes('search_path=""'),
    `expected proconfig to contain the exact entry 'search_path=""' (empty), got: ${JSON.stringify(rows[0].proconfig)}`
  );
  assert.ok(
    !rows[0].proconfig.some((c) => c === 'search_path=public, pg_catalog' || c === 'search_path=public,pg_catalog'),
    'search_path must no longer list public ahead of (or alongside) pg_catalog'
  );
});
