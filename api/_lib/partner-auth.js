/**
 * Sales partner login: WhatsApp number + 6-digit PIN.
 *
 * Reuses the admin PIN derivation (HMAC with ADMIN_PIN_PEPPER, then scrypt
 * with a per-partner salt), so a leaked database alone can't be used to
 * brute-force PINs. Sessions are random tokens in an HttpOnly cookie; the
 * database only stores their SHA-256. 5 wrong PINs → 15-minute lock.
 */
import { randomInt } from 'node:crypto';
import {
  generateSalt, deriveHash, verifyPin, runDummyVerification,
  generateSessionToken, hashSessionToken, LOCKOUT_THRESHOLD, LOCKOUT_MINUTES,
} from './admin-auth.js';

export const PARTNER_COOKIE = 'sl_partner_session';
export const PARTNER_SESSION_DAYS = 30;
export { LOCKOUT_THRESHOLD, LOCKOUT_MINUTES };

/** null if OK, otherwise a message for the partner. */
export function pinProblem(pin) {
  const p = String(pin ?? '');
  if (!/^\d{6}$/.test(p)) return 'Your PIN must be exactly 6 digits.';
  if (/^(\d)\1{5}$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p)) {
    return 'That PIN is too easy to guess. Please choose a different one.';
  }
  return null;
}

export function pinFields(pin, { mustChange = false } = {}) {
  const pin_salt = generateSalt();
  return { pin_salt, pin_hash: deriveHash(String(pin), pin_salt), pin_must_change: mustChange, failed_attempts: 0, locked_until: null };
}

/** A random temporary PIN for admin resets (never an "easy" one). */
export function temporaryPin() {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!pinProblem(pin)) return pin;
  }
}

export function checkPin(partner, pin) {
  if (!partner?.pin_hash || !partner?.pin_salt) { runDummyVerification(String(pin ?? '')); return false; }
  return verifyPin(String(pin ?? ''), partner.pin_salt, partner.pin_hash);
}
export { runDummyVerification };

export const isLocked = (p) => Boolean(p?.locked_until && new Date(p.locked_until).getTime() > Date.now());

export async function recordFailure(supabase, p) {
  const next = (p.failed_attempts ?? 0) + 1;
  const patch = { failed_attempts: next, updated_at: new Date().toISOString() };
  if (next >= LOCKOUT_THRESHOLD) {
    patch.failed_attempts = 0;
    patch.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
  }
  await supabase.from('partners').update(patch).eq('id', p.id);
  return patch.locked_until || null;
}

export async function createPartnerSession(supabase, partnerId) {
  const token = generateSessionToken();
  const { error } = await supabase.from('partner_sessions').insert({
    partner_id: partnerId,
    session_token_hash: hashSessionToken(token),
    expires_at: new Date(Date.now() + PARTNER_SESSION_DAYS * 86400 * 1000).toISOString(),
  });
  if (error) throw error;
  return token;
}

export function partnerCookie(token, { clear = false } = {}) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  if (clear) return `${PARTNER_COOKIE}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
  return `${PARTNER_COOKIE}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${PARTNER_SESSION_DAYS * 86400}`;
}

export function partnerTokenFromRequest(req) {
  for (const part of String(req.headers?.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === PARTNER_COOKIE) return part.slice(i + 1).trim() || null;
  }
  return null;
}

/** The logged-in partner row (approved or paused), or null. */
export async function getLoggedInPartner(req, supabase) {
  const token = partnerTokenFromRequest(req);
  if (!token) return null;
  const { data: s } = await supabase.from('partner_sessions')
    .select('partner_id, expires_at, revoked_at').eq('session_token_hash', hashSessionToken(token)).maybeSingle();
  if (!s || s.revoked_at || new Date(s.expires_at).getTime() <= Date.now()) return null;
  const { data: p } = await supabase.from('partners').select('*').eq('id', s.partner_id).maybeSingle();
  if (!p || (p.status !== 'approved' && p.status !== 'paused')) return null;
  return p;
}

export async function revokePartnerSession(supabase, req) {
  const token = partnerTokenFromRequest(req);
  if (!token) return;
  await supabase.from('partner_sessions').update({ revoked_at: new Date().toISOString() })
    .eq('session_token_hash', hashSessionToken(token)).is('revoked_at', null);
}

export async function revokeAllPartnerSessions(supabase, partnerId) {
  await supabase.from('partner_sessions').update({ revoked_at: new Date().toISOString() })
    .eq('partner_id', partnerId).is('revoked_at', null);
}
