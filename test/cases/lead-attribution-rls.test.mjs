/**
 * CRM-3A security correction — proves migration 0016's
 * `alter table lead_attribution enable row level security;` is real, not
 * just present in the SQL text:
 *
 *   1. Catalog-level: `pg_class.relrowsecurity` is true for
 *      `lead_attribution`, and `pg_policies` has ZERO rows for it — no
 *      anon/authenticated (or any other) policy was created, matching the
 *      "backend-only, no policies" requirement in the migration's own
 *      comment.
 *   2. Behavioral: a genuinely non-bypassing Postgres role (NOT a
 *      superuser, NOT BYPASSRLS — the same shape as any real
 *      non-service-role Supabase key) is denied by default even when it
 *      is separately GRANTed table-level SELECT/INSERT — proving RLS
 *      with no policies actually blocks access, not merely that no
 *      policy row happens to exist.
 *
 * The application's own server-side path (api/_lib/supabase.js's
 * SERVICE ROLE key, and this test suite's own `crm_test` superuser
 * connection — see test/helpers/db.mjs) bypasses RLS by Postgres/Supabase
 * design and is therefore unaffected; every other existing test in this
 * suite already proves that path keeps working after this migration
 * (captureAttribution, findLeadAttribution, the today-actions
 * checkout_started query, etc. all still pass as the superuser
 * connection they've always used).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';

const { Pool } = pg;

let pool;
let schemaName;

before(async () => {
  pool = await getTestPool();
  const { rows } = await pool.query('SELECT current_schema() AS schema');
  schemaName = rows[0].schema;
});

after(async () => {
  await closeTestPool();
});

test('lead_attribution has Row Level Security enabled (pg_class.relrowsecurity)', async () => {
  const { rows } = await pool.query(
    `SELECT c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = 'lead_attribution'`,
    [schemaName]
  );
  assert.equal(rows.length, 1, 'lead_attribution table must exist in the test schema');
  assert.equal(rows[0].relrowsecurity, true, 'RLS must be enabled on lead_attribution');
});

test('lead_attribution has ZERO policies — no anon/authenticated (or any other) policy exists', async () => {
  const { rows } = await pool.query(
    `SELECT policyname, roles, cmd FROM pg_policies WHERE schemaname = $1 AND tablename = 'lead_attribution'`,
    [schemaName]
  );
  assert.deepEqual(rows, [], 'lead_attribution must have no policies at all — this table stays backend-only by default-deny, not by a curated allow-list');
});

test('a non-bypassing, non-superuser role is denied ALL access to lead_attribution by default, even when separately GRANTed table-level SELECT/INSERT', async () => {
  const roleName = `rls_probe_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const rolePassword = randomUUID();

  // Seed one real row as the superuser (bypasses RLS), so the low-priv
  // role's SELECT has something to fail to see.
  const leadId = `lead-rls-${randomUUID()}`;
  await pool.query(
    `INSERT INTO lead_attribution (lead_id, first_utm_source, latest_utm_source) VALUES ($1, 'whatsapp', 'whatsapp')`,
    [leadId]
  );

  await pool.query(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${rolePassword}' NOSUPERUSER NOBYPASSRLS`);
  await pool.query(`GRANT CONNECT ON DATABASE crm_test TO "${roleName}"`);
  await pool.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO "${roleName}"`);
  // Deliberately grant table-level SELECT/INSERT — exactly the mistake a
  // future anon/authenticated policy grant could make — to prove RLS
  // with zero policies still denies everything regardless.
  await pool.query(`GRANT SELECT, INSERT ON "${schemaName}".lead_attribution TO "${roleName}"`);

  const { rows: roleCheck } = await pool.query(
    'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
    [roleName]
  );
  assert.equal(roleCheck[0].rolsuper, false, 'probe role must not be a superuser (superusers always bypass RLS)');
  assert.equal(roleCheck[0].rolbypassrls, false, 'probe role must not have BYPASSRLS');

  let lowPrivPool;
  try {
    lowPrivPool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: roleName,
      password: rolePassword,
      database: process.env.PGDATABASE || 'crm_test',
      options: `-c search_path=${schemaName},public`,
    });

    const { rows: selectRows } = await lowPrivPool.query('SELECT * FROM lead_attribution');
    assert.deepEqual(selectRows, [], 'a non-bypassing role must see ZERO rows, even one that genuinely exists and it has table-level SELECT on');

    await assert.rejects(
      () => lowPrivPool.query(
        `INSERT INTO lead_attribution (lead_id, first_utm_source, latest_utm_source) VALUES ($1, 'x', 'x')`,
        [`lead-rls-insert-${randomUUID()}`]
      ),
      /row-level security/i,
      'a non-bypassing role must be denied INSERT by RLS, even one that genuinely has table-level INSERT'
    );
  } finally {
    if (lowPrivPool) await lowPrivPool.end();
    // Clean up: revoke everything before dropping, so DROP ROLE never
    // fails due to lingering ACL entries referencing this role.
    await pool.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schemaName}" FROM "${roleName}"`);
    await pool.query(`REVOKE USAGE ON SCHEMA "${schemaName}" FROM "${roleName}"`);
    await pool.query(`REVOKE CONNECT ON DATABASE crm_test FROM "${roleName}"`);
    await pool.query(`DROP ROLE IF EXISTS "${roleName}"`);
  }
});
