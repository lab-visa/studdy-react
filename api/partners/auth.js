/**
 * POST /api/partners/auth   body: { action, ... }
 *   login       { phone, pin }            → sets the session cookie
 *   logout      {}                        → ends this session
 *   change_pin  { currentPin?, newPin }   → currentPin not needed right
 *                                           after an admin reset
 * Wrong number and wrong PIN give the same answer, so nobody can find out
 * which numbers are registered. 5 wrong PINs lock the account 15 minutes.
 */
import { getSupabase } from '../_lib/supabase.js';
import { normalizeIndianPhone } from '../_lib/cashfree.js';
import { isSameOriginRequest } from '../_lib/admin-auth.js';
import {
  pinProblem, pinFields, checkPin, runDummyVerification, isLocked, recordFailure,
  createPartnerSession, partnerCookie, getLoggedInPartner, revokePartnerSession, LOCKOUT_MINUTES,
} from '../_lib/partner-auth.js';

const WRONG = 'Wrong mobile number or PIN.';
const timeIST = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  res.setHeader('Cache-Control', 'private, no-store');
  const supabase = (deps.getSupabase || getSupabase)();
  const b = req.body || {};

  try {
    if (b.action === 'login') {
      const phone = normalizeIndianPhone(b.phone);
      const { data: p } = phone
        ? await supabase.from('partners').select('*').eq('phone', phone).maybeSingle()
        : { data: null };
      if (!p || (p.status !== 'approved' && p.status !== 'paused')) {
        runDummyVerification(String(b.pin ?? ''));
        return res.status(401).json({ error: WRONG });
      }
      if (isLocked(p)) {
        return res.status(429).json({ error: `Too many wrong tries. Please try again after ${timeIST(p.locked_until)}, or WhatsApp us to reset your PIN.` });
      }
      if (!p.pin_hash) {
        runDummyVerification(String(b.pin ?? ''));
        return res.status(401).json({ error: 'You have not set a PIN yet. Tap "Forgot PIN?" and we will send you one.' });
      }
      if (!checkPin(p, b.pin)) {
        const lockedUntil = await recordFailure(supabase, p);
        return res.status(lockedUntil ? 429 : 401).json({
          error: lockedUntil ? `Too many wrong tries. Your account is locked for ${LOCKOUT_MINUTES} minutes.` : WRONG,
        });
      }
      const now = new Date().toISOString();
      await supabase.from('partners').update({ failed_attempts: 0, locked_until: null, last_login_at: now, updated_at: now }).eq('id', p.id);
      const token = await createPartnerSession(supabase, p.id);
      res.setHeader('Set-Cookie', partnerCookie(token));
      return res.status(200).json({ ok: true, mustChange: Boolean(p.pin_must_change) });
    }

    if (b.action === 'logout') {
      await revokePartnerSession(supabase, req);
      res.setHeader('Set-Cookie', partnerCookie('', { clear: true }));
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'change_pin') {
      const p = await getLoggedInPartner(req, supabase);
      if (!p) return res.status(401).json({ error: 'Please log in again.' });
      if (!p.pin_must_change && !checkPin(p, b.currentPin)) return res.status(400).json({ error: 'Your current PIN is wrong.' });
      const problem = pinProblem(b.newPin);
      if (problem) return res.status(400).json({ error: problem });
      const { error } = await supabase.from('partners')
        .update({ ...pinFields(b.newPin), updated_at: new Date().toISOString() }).eq('id', p.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('partners/auth error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
