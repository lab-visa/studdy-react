/**
 * CRM-3A migration 0019 (Round-5 Codex review) — proves the EXECUTE
 * lockdown on public.rls_auto_enable() is real, not just present in the
 * SQL text.
 *
 * public.rls_auto_enable() is NOT created by any migration in this repo
 * — it (and the `ensure_rls` event trigger that calls it) was created
 * directly against production outside of any tracked migration, which
 * is exactly why Supabase's migration history was reported empty during
 * the Round-5 preflight. It therefore does not exist in this test
 * harness's throwaway databases (see test/helpers/db.mjs — those are
 * built strictly from supabase/migrations/*.sql), and migration 0019's
 * own guard (`to_regprocedure(...) is not null`) is written specifically
 * so applying it there is a safe no-op, not an error — that no-op is
 * exercised for free by every other test file in this suite, since
 * 0019 runs as part of every template build.
 *
 * To prove the REVOKE/GRANT logic itself is correct, this file recreates
 * a stand-in for the real production function (same signature, same
 * SECURITY DEFINER + event_trigger return type + pinned search_path,
 * same wide-open starting ACL the Round-5 preflight actually found: EXECUTE
 * granted to PUBLIC/anon/authenticated/service_role), then re-applies
 * 0019's own SQL file verbatim (read straight off disk — never
 * retyped), then asserts the resulting privilege state.
 *
 * A direct SELECT rls_auto_enable() call is not a usable success/failure
 * signal here: Postgres refuses to invoke ANY function with an
 * event_trigger return type through a normal call, for every role,
 * including superusers and owners ("trigger functions can only be
 * called as triggers") — but only AFTER its EXECUTE-privilege check has
 * already passed. Confirmed by direct experiment: a role denied EXECUTE
 * gets "permission denied for function rls_auto_enable"; a role WITH
 * EXECUTE gets past that straight to "trigger functions can only be
 * called as triggers" instead. That difference in which error surfaces
 * is exactly what this file asserts on — it is the only way to observe
 * the privilege check in isolation for a function of this return type,
 * and it means the grant this migration revokes was never practically
 * exploitable to begin with (Postgres itself was already the backstop)
 * — see 0019's own header comment for why the fix is still correct
 * defense-in-depth regardless.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  join(__dirname, '..', '..', 'supabase', 'migrations', '0019_restrict_rls_auto_enable.sql'),
  'utf8'
);

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

/** Recreates production's exact pre-fix state: the function, with the wide-open ACL the Round-5 preflight found. */
async function recreateProductionStandInWithOpenAcl() {
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.rls_auto_enable()
     RETURNS event_trigger
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path TO 'pg_catalog'
    AS $function$
    BEGIN
    END;
    $function$;
  `);
  await pool.query('GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated, service_role');
}

test('0019 is a documented no-op when public.rls_auto_enable() does not exist (this suite\'s own template build)', async () => {
  const { rows } = await pool.query(
    `SELECT 1 AS present FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'`
  );
  assert.equal(rows.length, 0, 'this test database is built only from supabase/migrations/*.sql — rls_auto_enable must not exist here, proving 0019 already applied as a no-op without error during template setup');
});

test('0019: revokes EXECUTE from PUBLIC/anon/authenticated, keeps it for service_role and the owner', async () => {
  await recreateProductionStandInWithOpenAcl();

  const { rows: before } = await pool.query(
    `SELECT has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') AS anon_before,
            has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') AS authenticated_before,
            has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE') AS service_role_before`
  );
  assert.equal(before[0].anon_before, true, 'sanity check: stand-in must start with the same wide-open grant Round-5 found in production');
  assert.equal(before[0].authenticated_before, true);
  assert.equal(before[0].service_role_before, true);

  // Apply migration 0019 verbatim, twice — proving both the fix itself
  // and its idempotency (re-running must not error and must not change
  // the resulting privilege state).
  await pool.query(migrationSql);
  await pool.query(migrationSql);

  const { rows: acl } = await pool.query(
    `SELECT has_function_privilege('public', 'public.rls_auto_enable()', 'EXECUTE') AS public_can,
            has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') AS anon_can,
            has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') AS authenticated_can,
            has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE') AS service_role_can,
            has_function_privilege('postgres', 'public.rls_auto_enable()', 'EXECUTE') AS owner_can`
  );
  assert.equal(acl[0].public_can, false, 'PUBLIC must have EXECUTE revoked');
  assert.equal(acl[0].anon_can, false, 'anon must have EXECUTE revoked');
  assert.equal(acl[0].authenticated_can, false, 'authenticated must have EXECUTE revoked');
  assert.equal(acl[0].service_role_can, true, 'service_role must keep EXECUTE — this is the "preserve administrative/service-role access" requirement');
  assert.equal(acl[0].owner_can, true, 'the function owner (postgres) always retains implicit EXECUTE regardless of GRANT/REVOKE');

  const { rows: def } = await pool.query(`SELECT prosecdef FROM pg_proc WHERE proname = 'rls_auto_enable'`);
  assert.equal(def[0].prosecdef, true, '0019 must not touch SECURITY DEFINER — only privileges');
});

test('0019: the resulting grant is real, not just catalog metadata — proven via a genuinely non-superuser connection', async () => {
  await recreateProductionStandInWithOpenAcl();
  await pool.query(migrationSql);

  const roleName = `rls_priv_probe_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const rolePassword = randomUUID();

  await pool.query(
    `CREATE ROLE "${roleName}" LOGIN PASSWORD '${rolePassword}' NOSUPERUSER NOBYPASSRLS NOINHERIT IN ROLE anon, authenticated, service_role`
  );
  await pool.query(`GRANT CONNECT ON DATABASE "${dbName}" TO "${roleName}"`);
  // No direct GRANT to roleName itself beyond CONNECT: every assertion
  // below runs under SET ROLE anon/authenticated/service_role, so it's
  // those roles' own schema USAGE (already granted at the template
  // level — see test/helpers/db.mjs) that's checked, not roleName's.
  // A direct GRANT to roleName would also leave a pg_shdepend entry
  // that blocks DROP ROLE in the cleanup below.

  let probePool;
  try {
    probePool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: roleName,
      password: rolePassword,
      database: dbName,
    });

    // anon — denied at the privilege check itself: "permission denied",
    // never reaching the (unrelated) event-trigger-return-type error.
    await probePool.query('SET ROLE anon');
    await assert.rejects(
      () => probePool.query('SELECT public.rls_auto_enable()'),
      /permission denied for function/i,
      'anon must be denied at the EXECUTE-privilege check'
    );

    // authenticated — same.
    await probePool.query('RESET ROLE');
    await probePool.query('SET ROLE authenticated');
    await assert.rejects(
      () => probePool.query('SELECT public.rls_auto_enable()'),
      /permission denied for function/i,
      'authenticated must be denied at the EXECUTE-privilege check'
    );

    // service_role — MUST get past the privilege check. It still can't
    // usefully call an event_trigger-returning function through a plain
    // SELECT (see file header), so the call still errors — but with a
    // DIFFERENT error that only appears once EXECUTE has already been
    // permitted. That distinction is the actual proof this role's grant
    // is intact.
    await probePool.query('RESET ROLE');
    await probePool.query('SET ROLE service_role');
    await assert.rejects(
      () => probePool.query('SELECT public.rls_auto_enable()'),
      /trigger functions can only be called as triggers/i,
      'service_role must pass the EXECUTE-privilege check — reaching the unrelated event-trigger-return-type error, never "permission denied", proves the grant is real'
    );
  } finally {
    if (probePool) await probePool.end();
    await pool.query(`REVOKE CONNECT ON DATABASE "${dbName}" FROM "${roleName}"`);
    await pool.query(`DROP ROLE IF EXISTS "${roleName}"`);
  }
});
