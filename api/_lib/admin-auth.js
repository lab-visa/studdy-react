/**
 * CRM-1B — Admin Access Foundation.
 *
 * Fresh design (NOT a reuse of the old local-only single-shared-password
 * HMAC-cookie pattern) — real per-user rows in `admin_users`, real
 * server-side sessions in `admin_sessions` (migration 0014). Single
 * admin, Name + 4-digit PIN, for V1.
 *
 * PIN hashing, per CRM-1 Revision 2.1's required correction: a 4-digit
 * PIN has only 10,000 possible values, so salt+scrypt alone is not
 * enough protection if `admin_users` is ever leaked — a server-side
 * pepper (ADMIN_PIN_PEPPER, a Vercel-only environment variable, never
 * stored in Supabase, never committed, never logged, never returned to
 * the browser) is required in addition:
 *
 *   prehash  = HMAC-SHA256(key = ADMIN_PIN_PEPPER, message = pin)
 *   pin_hash = scrypt(password = prehash, salt = pin_salt)
 *
 * This exact function is imported by BOTH this file (production,
 * verification) and scripts/create-admin.mjs (local bootstrap, hash
 * generation) — one shared implementation, so the two can never derive
 * differently for the same Name/PIN/pepper/salt.
 *
 * The real PIN is never stored, logged, or returned anywhere — not in
 * `admin_users`, not in `activity_log`, not in any API response, not in
 * this file.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';

export const SESSION_COOKIE_NAME = 'sl_admin_session';
export const SESSION_HOURS = 12;
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MINUTES = 15;

const SCRYPT_KEYLEN = 64;

function getPepper() {
  const pepper = process.env.ADMIN_PIN_PEPPER;
  if (!pepper) {
    throw new Error('Missing ADMIN_PIN_PEPPER environment variable — admin auth cannot run without it.');
  }
  return pepper;
}

/** Random per-user salt, hex-encoded. */
export function generateSalt() {
  return randomBytes(16).toString('hex');
}

/**
 * The one shared derivation function — HMAC-with-pepper, then
 * scrypt-with-per-user-salt. Used identically by production login
 * verification and by the local bootstrap script.
 */
export function deriveHash(pin, salt) {
  const pepper = getPepper();
  const prehash = createHmac('sha256', pepper).update(String(pin)).digest();
  return scryptSync(prehash, salt, SCRYPT_KEYLEN).toString('hex');
}

/** Constant-time comparison of two hex-encoded hashes. */
function hashesEqual(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* Dummy salt/hash pair, computed once per process (lazily, on first use)
 * against a fixed non-secret placeholder PIN — never tied to any real
 * admin account. Used ONLY to keep the "unknown name" login path doing
 * the same amount of cryptographic work as the "known name, wrong PIN"
 * path, so the two are not distinguishable by response time. Its result
 * is never used to decide success — an unknown name always fails,
 * regardless of what this comparison returns. */
let dummyCredential = null;
function getDummyCredential() {
  if (!dummyCredential) {
    const salt = generateSalt();
    const hash = deriveHash('0000', salt);
    dummyCredential = { salt, hash };
  }
  return dummyCredential;
}

/**
 * Verifies a login attempt's PIN against a known admin_users row.
 * Always runs the real derivation — never short-circuits.
 */
export function verifyPin(pin, salt, storedHash) {
  const computed = deriveHash(pin, salt);
  return hashesEqual(computed, storedHash);
}

/**
 * Runs the identical cost (HMAC + scrypt + constant-time compare) for an
 * unknown display name, so response timing cannot reveal whether a name
 * exists. The return value is intentionally ignored by callers — this
 * function's only job is to burn the same amount of time.
 */
export function runDummyVerification(pin) {
  const { salt, hash } = getDummyCredential();
  const computed = deriveHash(pin, salt);
  hashesEqual(computed, hash);
}

/** Opaque random session token (returned to the browser as the cookie value). */
export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

/** SHA-256 of the session token — this, never the raw token, is what's stored in admin_sessions. */
export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionCookieHeader(token, { clear = false } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd ? '; Secure' : '';
  if (clear) {
    return `${SESSION_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`;
  }
  const maxAge = SESSION_HOURS * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

export function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

/**
 * Creates a new server-side session row for an admin user and returns the
 * raw token to send as the cookie (never stored anywhere raw).
 */
export async function createSession(supabase, adminUserId) {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('admin_sessions').insert({
    admin_user_id: adminUserId,
    session_token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return { token, expiresAt };
}

/**
 * Verifies a session token server-side: hashes it, looks it up among
 * unexpired/unrevoked sessions, joined to an active admin_users row.
 * Returns the admin user row, or null if the session is invalid/expired/
 * revoked/the user is inactive.
 */
export async function verifySession(supabase, token) {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);

  const { data: session, error } = await supabase
    .from('admin_sessions')
    .select('id, admin_user_id, expires_at, revoked_at')
    .eq('session_token_hash', tokenHash)
    .maybeSingle();

  if (error || !session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  const { data: adminUser, error: userError } = await supabase
    .from('admin_users')
    .select('id, display_name, is_active')
    .eq('id', session.admin_user_id)
    .maybeSingle();

  if (userError || !adminUser || !adminUser.is_active) return null;

  return adminUser;
}

/** Revokes a session server-side (true logout — not just a cookie clear). */
export async function revokeSession(supabase, token) {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  await supabase
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('session_token_hash', tokenHash)
    .is('revoked_at', null);
}

/**
 * Call at the top of every /api/admin/* handler (except login). Sends 401
 * and returns null if the request isn't authenticated — caller should
 * `return` immediately when this returns null. No client-side-only
 * gating anywhere: this is the actual, only enforcement point.
 */
export async function requireAdminSession(req, res, supabase) {
  const token = getSessionTokenFromRequest(req);
  const adminUser = await verifySession(supabase, token);
  if (!adminUser) {
    res.status(401).json({ error: 'Not signed in' });
    return null;
  }
  return adminUser;
}

/** True if this admin_users row is currently locked out. */
export function isLockedOut(adminUser) {
  return Boolean(adminUser.locked_until && new Date(adminUser.locked_until).getTime() > Date.now());
}

/**
 * Records one failed login attempt. Once failed_attempts reaches
 * LOCKOUT_THRESHOLD, sets locked_until LOCKOUT_MINUTES into the future
 * and resets the counter, so a subsequent burst after the lock expires
 * requires another full LOCKOUT_THRESHOLD attempts, not just one more.
 */
export async function recordFailedAttempt(supabase, adminUser) {
  const nextCount = (adminUser.failed_attempts ?? 0) + 1;
  const patch = { failed_attempts: nextCount, updated_at: new Date().toISOString() };
  if (nextCount >= LOCKOUT_THRESHOLD) {
    patch.failed_attempts = 0;
    patch.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
  }
  await supabase.from('admin_users').update(patch).eq('id', adminUser.id);
}

/** Resets lockout state on a successful login. */
export async function resetFailedAttempts(supabase, adminUserId) {
  await supabase
    .from('admin_users')
    .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
    .eq('id', adminUserId);
}

/**
 * CSRF defense-in-depth on top of SameSite=Strict: verifies a
 * state-changing request's Origin/Referer (whichever is present) matches
 * this deployment's own origin. Login is intentionally exempt (call site
 * decides) since it has no session yet to protect.
 */
export function isSameOriginRequest(req) {
  const origin = req.headers.origin || null;
  const referer = req.headers.referer || req.headers.referrer || null;
  const host = req.headers.host;
  if (!host) return false;

  const check = (value) => {
    if (!value) return null;
    try {
      return new URL(value).host === host;
    } catch {
      return false;
    }
  };

  const originOk = check(origin);
  if (originOk !== null) return originOk;
  const refererOk = check(referer);
  if (refererOk !== null) return refererOk;
  /* Neither header present — some legitimate same-site requests omit
   * both (e.g. certain browser privacy modes). SameSite=Strict already
   * carries the primary defense here, so we don't hard-fail on absence
   * alone. */
  return true;
}
