/**
 * Test-only Postgres setup helper. Connects to a local Postgres 16
 * instance (started for this test run only — never production, never
 * Supabase) and, for each test file, creates a throwaway schema seeded
 * with:
 *   1. test/fixtures/legacy_baseline.sql — the two legacy tables
 *      (studdy_accounts, leads) that predate this repo's migration
 *      history, modeled on CRM-0B's live-verified production schema.
 *   2. Every file in supabase/migrations/, in order (0001 through the
 *      highest-numbered file present) — the exact same SQL that would
 *      run against real production, proving it applies cleanly and
 *      produces the expected schema.
 *
 * Connection: PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE env vars, with
 * defaults matching the local test role/database set up for this round
 * of testing (see the delivery report for exact setup commands used).
 */
import pg from 'pg';
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

let sharedPool = null;

/** Lazily creates (once per test process) a Pool against a FRESH schema. */
export async function getTestPool() {
  if (sharedPool) return sharedPool;

  const schemaName = `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const bootstrapPool = new Pool(connectionConfig);
  await bootstrapPool.query(`CREATE SCHEMA "${schemaName}"`);
  await bootstrapPool.end();

  sharedPool = new Pool({
    ...connectionConfig,
    options: `-c search_path=${schemaName},public`,
  });

  await applySql(sharedPool, readFileSync(fixturePath, 'utf8'));

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  for (const file of migrationFiles) {
    await applySql(sharedPool, readFileSync(join(migrationsDir, file), 'utf8'));
  }

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
  }
}
