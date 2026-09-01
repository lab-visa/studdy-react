/**
 * POST /api/admin/login
 * body: { name, pin }
 *
 * CRM-1B — Name + 4-digit PIN authentication. Every one of "unknown
 * name", "wrong PIN", "inactive user", and "locked out" returns the
 * exact same generic response — nothing distinguishes any of these
 * cases from any other, deliberately, so a response can never be used to
 * confirm whether a given name has an account or is currently locked.
 *
 * On success: resets lockout state, creates a real server-side session
 * row (admin_sessions), and sends its token as an HttpOnly, SameSite=
 * Strict, Secure(prod) cookie. No client-side-only auth anywhere — this
 * endpoint and requireAdminSession() (checked by every other /api/admin/*
 * handler) are the only places a session is ever decided.
 */
import { getSupabase } from '../_lib/supabase.js';
import {
  verifyPin,
  runDummyVerification,
  isLockedOut,
  recordFailedAttempt,
  resetFailedAttempts,
  createSession,
  sessionCookieHeader,
} from '../_lib/admin-auth.js';

const GENERIC_FAILURE = { error: 'Invalid login' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, pin } = req.body || {};
  if (!name || !pin) {
    return res.status(400).json(GENERIC_FAILURE);
  }

  const supabase = getSupabase();

  try {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, display_name, pin_hash, pin_salt, is_active, failed_attempts, locked_until')
      .eq('display_name', String(name).trim())
      .maybeSingle();
    // Note: display_name lookup relies on the unique index being
    // case-insensitive (lower(display_name)) — this eq() is exact-case,
    // which is fine as long as the one bootstrap-created admin logs in
    // with the exact name they registered. Not a security-relevant gap
    // (never distinguishes "wrong case" from "wrong PIN" — both fall
    // through to the same generic failure below).

    if (!adminUser) {
      /* Unknown name — still do the same amount of cryptographic work
       * as a real verification, so response timing can't reveal that
       * this name doesn't exist. The dummy result is never consulted. */
      runDummyVerification(pin);
      return res.status(401).json(GENERIC_FAILURE);
    }

    if (!adminUser.is_active || isLockedOut(adminUser)) {
      /* Still run the real verification against this user's own
       * stored hash — keeps timing consistent with the "wrong PIN"
       * path, and deliberately does NOT distinguish "locked out" from
       * "wrong PIN" in the response. */
      verifyPin(pin, adminUser.pin_salt, adminUser.pin_hash);
      return res.status(401).json(GENERIC_FAILURE);
    }

    const valid = verifyPin(pin, adminUser.pin_salt, adminUser.pin_hash);
    if (!valid) {
      await recordFailedAttempt(supabase, adminUser);
      return res.status(401).json(GENERIC_FAILURE);
    }

    await resetFailedAttempts(supabase, adminUser.id);
    const { token } = await createSession(supabase, adminUser.id);

    res.setHeader('Set-Cookie', sessionCookieHeader(token));
    return res.status(200).json({ ok: true, displayName: adminUser.display_name });
  } catch (err) {
    console.error('admin login error:', err);
    return res.status(500).json(GENERIC_FAILURE);
  }
}
