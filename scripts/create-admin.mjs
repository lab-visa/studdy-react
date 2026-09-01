#!/usr/bin/env node
/**
 * scripts/create-admin.mjs — LOCAL BOOTSTRAP ONLY. Run this on your own
 * machine, never in CI, never on Vercel, never share its output beyond
 * the printed SQL statement.
 *
 * What it does:
 *   1. Reads ADMIN_PIN_PEPPER from your environment (or a local
 *      .env.local file — see below). This must be the exact same value
 *      you've set as the ADMIN_PIN_PEPPER environment variable on
 *      Vercel, so production login and this script derive identical
 *      hashes for the same Name/PIN/salt.
 *   2. Prompts you, in your own terminal, for the admin's display Name
 *      and 4-digit PIN.
 *   3. Computes the salted, peppered hash LOCALLY, using the exact same
 *      deriveHash() function api/_lib/admin-auth.js uses in production
 *      (imported directly from that file — one shared implementation,
 *      never two copies that could drift apart).
 *   4. Prints an `INSERT INTO admin_users (...)` statement containing
 *      the display name, the *hash*, and the *salt* — never the PIN
 *      itself — for you to copy/paste into the Supabase SQL Editor
 *      yourself.
 *
 * Your real PIN:
 *   - is typed only into this script's own local prompt
 *   - is never written to any file
 *   - is never logged, printed, or included in the SQL output
 *   - never enters this chat, ChatGPT, or GitHub at any point
 *
 * .env.local (optional convenience, gitignored — never commit it):
 *   Create a file named `.env.local` in the project root containing:
 *     ADMIN_PIN_PEPPER=<a long random string>
 *   This script reads it automatically if present. You can instead just
 *   export ADMIN_PIN_PEPPER=... in your shell before running this —
 *   either way, whatever value you use here must be set as the
 *   ADMIN_PIN_PEPPER environment variable on Vercel too.
 */
import { createInterface } from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const CODE_ENTER_LF = 10; // line feed
const CODE_ENTER_CR = 13; // carriage return
const CODE_CTRL_C = 3; // ETX — user pressed Ctrl+C, abort
const CODE_BACKSPACE = 8; // backspace
const CODE_DEL = 127; // DEL — what most terminals actually send for Backspace

/* Minimal .env.local loader — no new npm dependency. Only sets a key if
 * it isn't already present in the real environment, so an explicit
 * `export ADMIN_PIN_PEPPER=...` always wins. */
function loadDotEnvLocal() {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

/* One shared readline interface + async line-iterator for the whole
 * script, reused for every plain-text prompt (name, and PIN when stdin
 * isn't a TTY). Deliberately NOT repeated rl.question() calls: on piped/
 * non-TTY stdin, Node can deliver and end the whole input before a
 * second question() ever attaches its listener, silently hanging
 * forever. Pulling from the interface's own async iterator instead
 * buffers correctly regardless of timing. */
let sharedReadline = null;
let sharedLineIterator = null;
function getSharedLineIterator() {
  if (!sharedReadline) {
    sharedReadline = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    sharedLineIterator = sharedReadline[Symbol.asyncIterator]();
  }
  return sharedLineIterator;
}

async function promptPlain(question) {
  process.stdout.write(question);
  const { value, done } = await getSharedLineIterator().next();
  return done ? '' : value;
}

/* Best-effort masked input for the PIN — falls back to promptPlain() if
 * stdin isn't a TTY (e.g. piped input in some environments, including
 * this project's own tests). Compares every incoming byte by numeric
 * char code rather than a string literal, to avoid any ambiguity over
 * which raw control byte a given terminal actually sends for
 * Enter/Backspace/Ctrl+C. */
function promptHidden(question) {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return promptPlain(question);
  }

  // Raw-mode reading conflicts with the shared readline interface's
  // line-buffered ("cooked") mode — release it first.
  if (sharedReadline) {
    sharedReadline.close();
    sharedReadline = null;
    sharedLineIterator = null;
  }

  return new Promise((resolve) => {
    process.stdout.write(question);
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      const code = char.charCodeAt(0);
      if (code === CODE_ENTER_LF || code === CODE_ENTER_CR) {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (code === CODE_CTRL_C) {
        process.stdout.write('\n');
        process.exit(1);
      }
      if (code === CODE_BACKSPACE || code === CODE_DEL) {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    stdin.on('data', onData);
  });
}

async function main() {
  loadDotEnvLocal();

  if (!process.env.ADMIN_PIN_PEPPER) {
    console.error(
      'Missing ADMIN_PIN_PEPPER. Set it in your shell (export ADMIN_PIN_PEPPER=...) or in a local ' +
        '.env.local file before running this script. It must match the ADMIN_PIN_PEPPER environment ' +
        'variable set on Vercel, or production login will never match a hash generated here.'
    );
    process.exit(1);
  }

  const { deriveHash, generateSalt } = await import('../api/_lib/admin-auth.js');

  const name = (await promptPlain('Admin display name: ')).trim();
  if (!name) {
    console.error('Name is required.');
    process.exit(1);
  }

  const pin = await promptHidden('4-digit PIN (input hidden): ');
  if (!/^\d{4}$/.test(pin)) {
    console.error('PIN must be exactly 4 digits.');
    process.exit(1);
  }

  const salt = generateSalt();
  const hash = deriveHash(pin, salt);

  // SQL single-quoted string literal, not a JS/JSON double-quoted one —
  // Postgres treats a double-quoted value as an *identifier*, not a
  // string, which would make this statement fail (or worse, silently
  // mean something else) when pasted into the SQL Editor. Embedded
  // single quotes are escaped by doubling, the standard SQL way.
  const sqlName = `'${name.replace(/'/g, "''")}'`;

  // Never log or print `pin` anywhere below this line.
  console.log('\nRun this in the Supabase SQL Editor (paste as-is):\n');
  console.log(
    `insert into admin_users (display_name, pin_hash, pin_salt) values (${sqlName}, '${hash}', '${salt}');`
  );
  console.log('\nThe PIN itself was never printed, logged, or written to any file.');
  process.exit(0);
}

main().catch((err) => {
  console.error('create-admin failed:', err.message);
  process.exit(1);
});
