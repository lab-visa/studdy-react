/**
 * Test-only Postgres setup helper. Connects to a local Postgres 16
 * instance (started for this test run only — never production, never
 * Supabase) and, for each test file, creates a throwaway DATABASE
 * (not merely a schema — see "WHY A WHOLE DATABASE" below) seeded with:
 *   1. test/fixtures/legacy_baseline.sql — the two legacy tables
 *      (studdy_accounts, leads) that predate this repo's migration
 *      history, modeled on CRM-0B's live-verified production schema.
 *   2. Every file in supabase/migrations/, in order (0001 through the
 *      highest-numbered file present) — the exact same SQL that would
 *      run against real production, proving it applies cleanly and
 *      produces the expected schema.
 *
 * WHY A WHOLE DATABASE, NOT JUST A SCHEMA (ChatGPT review round 2):
 *
 *   This test harness used to give each test file its own uniquely-
 *   named SCHEMA inside one shared `crm_test` database, listed first in
 *   that connection's search_path. That worked fine until migration
 *   0017's security hardening added `set search_path = public, pg_catalog`
 *   and explicit `public.customers`/`public.subscriptions`/etc.
 *   qualification to search_customer_pipeline() — both of which assume
 *   the referenced tables genuinely live in the literal `public` schema,
 *   exactly like they do in real production (every Supabase project's
 *   tables live in `public`). A per-file SCHEMA named `test_169...`
 *   breaks that assumption — `public.customers` would simply not exist
 *   there. Rather than water down the production migration's real
 *   hardening (or fake it by testing against unqualified, unpinned SQL
 *   that isn't what actually ships), each test file now gets its own
 *   throwaway DATABASE instead, whose default search_path genuinely
 *   resolves to `public` — so `public.customers` means exactly the same
 *   thing in a test as it does in production, and the same migration
 *   SQL is verified byte-for-byte in both places.
 *
 *   Creating N throwaway databases from scratch (each re-running every
 *   migration file) would be slower than the old per-schema approach.
 *   To avoid that, migrations are applied ONCE to a cached TEMPLATE
 *   database (name includes a content hash of every migration file, so
 *   any SQL change automatically gets a fresh template — never a stale
 *   one), and each test file's database is then a fast
 *   `CREATE DATABASE ... TEMPLATE ...` filesystem-level clone, already
 *   carrying every table, index, and the service_role/anon/authenticated
 *   grants set up on the template (a full clone duplicates ACLs too, so
 *   those grants only need to be applied once, not once per test file).
 *   A Postgres advisory lock serializes template creation across
 *   concurrently-running test file processes, so a second file racing
 *   the first always waits for the template to finish migrating rather
 *   than cloning a half-built one.
 *
 * Connection: PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE env vars, with
 * defaults matching the local test role/database set up for this round
 * of testing (see the delivery report for exact setup commands used).
 * PGDATABASE here names only the ADMIN connection used to create/drop
 * the per-file and template databases — no test ever runs its actual
 * queries against it directly.
 */
import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');
const fixturePath = join(repoRoot, 'test', 'fixtures', 'legacy_baseline.sql');

const connectionConfig = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'crm_test',
  password: process.env.PGPASSWORD || 'crm_test_pw',
  database: process.env.PGDATABASE || 'crm_test',
};

// Arbitrary fixed key, scoped to this repo's test harness only (grepped
// the codebase — nothing else here uses pg_advisory_lock) — serializes
// concurrent test-file processes racing to build the same template.
const TEMPLATE_LOCK_KEY = 847362910123;

function migrationsFingerprint() {
  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  const hash = createHash('sha256');
  hash.update(readFileSync(fixturePath, 'utf8'));
  for (const f of files) hash.update(readFileSync(join(migrationsDir, f), 'utf8'));
  return hash.digest('hex').slice(0, 16);
}

// Any change to a migration file or the legacy fixture changes this
// name, so a template built from stale SQL can never be reused by
// accident — no manual invalidation needed. Old templates from earlier
// SQL just sit unused (same "never auto-cleaned" tradeoff already
// accepted for per-test-file databases below — acceptable in this
// throwaway local sandbox, never production).
const TEMPLATE_DB = `crm_test_tmpl_${migrationsFingerprint()}`;

let sharedPool = null;
let currentDbName = null;

/**
 * CRM-3A migration 0017 security hardening (ChatGPT review round 2)
 * REVOKEs/GRANTs EXECUTE on search_customer_pipeline() against three
 * standard Postgres roles every real Supabase project provisions
 * automatically outside of any migration file: `anon`, `authenticated`
 * (PostgREST's two browser-facing roles), and `service_role` (the role
 * behind this backend's own service-role key — see
 * api/_lib/supabase.js). A bare local Postgres instance has none of
 * these, so migration 0017 would fail to even apply here without this
 * bootstrap — this mirrors what Supabase already does for every real
 * project, it is NOT something any migration file should create itself
 * (creating them in a migration would collide with Supabase's own
 * bootstrap in real production). Roles are cluster-wide (not
 * per-database), so this only ever needs to run once per Postgres
 * instance — idempotent and guarded, never an error to call again.
 */
async function ensureSupabaseStandardRoles(pool) {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
      END IF;
    END $$;
  `);
}

/** Builds (or, if another concurrent test file already did, waits for and reuses) the migrated template database. */
async function ensureTemplateDatabase(adminPool) {
  await adminPool.query('SELECT pg_advisory_lock($1)', [TEMPLATE_LOCK_KEY]);
  try {
    const { rows } = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEMPLATE_DB]);
    if (rows.length > 0) return; // another process already built this exact (fingerprinted) template

    await ensureSupabaseStandardRoles(adminPool);
    await adminPool.query(`CREATE DATABASE "${TEMPLATE_DB}"`);

    const templatePool = new Pool({ ...connectionConfig, database: TEMPLATE_DB });
    try {
      await applySql(templatePool, readFileSync(fixturePath, 'utf8'));
      const migrationFiles = readdirSync(migrationsDir)
        .filter((f) => /^\d{4}_.*\.sql$/.test(f))
        .sort();
      for (const file of migrationFiles) {
        await applySql(templatePool, readFileSync(join(migrationsDir, file), 'utf8'));
      }

      /* Mirrors real Supabase's own platform-level bootstrap (not
       * anything a migration file does, in real Supabase or here):
       * grants service_role real access to `public`'s tables, so a
       * SECURITY INVOKER function (search_customer_pipeline) actually
       * works when invoked AS service_role in tests, exactly like it
       * does in production. Applied ONCE here, on the template — every
       * per-test-file database is a full clone of this one, so the
       * grants come along automatically, no need to repeat them per
       * file. anon/authenticated deliberately get NOTHING beyond
       * schema USAGE (needed merely to attempt calling anything, and
       * to make the EXECUTE-privilege test fail for the right reason —
       * a REVOKEd EXECUTE — rather than an earlier, less specific "no
       * schema access" error). */
      await templatePool.query('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role');
      await templatePool.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role');
      await templatePool.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role');
    } finally {
      await templatePool.end();
    }
  } finally {
    await adminPool.query('SELECT pg_advisory_unlock($1)', [TEMPLATE_LOCK_KEY]);
  }
}

/** Lazily creates (once per test process) a Pool against a FRESH throwaway database, cloned from the migrated template. */
export async function getTestPool() {
  if (sharedPool) return sharedPool;

  const adminPool = new Pool(connectionConfig);
  try {
    await ensureTemplateDatabase(adminPool);

    currentDbName = `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await adminPool.query(`CREATE DATABASE "${currentDbName}" TEMPLATE "${TEMPLATE_DB}"`);
  } finally {
    await adminPool.end();
  }

  sharedPool = new Pool({ ...connectionConfig, database: currentDbName });
  return sharedPool;
}

async function applySql(pool, sql) {
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

export async function closeTestPool() {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;

    // Best-effort cleanup — never lets a drop failure fail the test
    // run itself. WITH (FORCE) (Postgres 13+) disconnects any
    // lingering session on this throwaway database first, so this
    // always succeeds even if something else briefly held it open.
    if (currentDbName) {
      const admin = new Pool(connectionConfig);
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${currentDbName}" WITH (FORCE)`);
      } catch (err) {
        console.error(`closeTestPool: could not drop ${currentDbName} (non-fatal, leftover throwaway test DB):`, err.message);
      } finally {
        await admin.end();
      }
    }
    currentDbName = null;
  }
}
