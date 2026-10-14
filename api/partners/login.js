/**
 * POST /api/partners/login   body: { phone, pin }
 *
 * Partner login with mobile number + 6-digit PIN. On success returns the
 * partner's private earnings-page token (the same key their link uses).
 * 5 wrong PINs lock the account for 15 minutes. An unknown number does
 * the same hashing work and gets the same message, so the response does
 * not reveal who is registered.
 */
import { getSupabase } from '../_lib/supabase.js';
import { normalizeIndianPhone } from '../_lib/cashfree.js';
import { verifyPin, runDummyVerification } from '../_lib/admin-auth.js';
import { PIN_RE, PIN_LOCK_THRESHOLD, PIN_LOCK_MINUTES } from '../_lib/partners.js';

const WRONG = 'Mobile number or PIN is wrong.';

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const phone = normalizeIndianPhone(req.body?.phone);
  const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
  if (!phone || !PIN_RE.test(pin)) return res.status(400).json({ error: 'Enter your 10-digit mobile number and 6-digit PIN.' });

  const supabase = (deps.getSupabase || getSupabase)();
  try {
    const { data: p, error } = await supabase.from('partners').select('*').eq('phone', phone).maybeSingle();
    if (error) throw error;

    if (!p || !p.pin_hash || !p.dashboard_token || !['approved', 'paused'].includes(p.status)) {
      runDummyVerification(pin);
      if (p && !p.pin_hash) return res.status(401).json({ error: 'No PIN is set for this number yet. Open your earnings link once to set it, or WhatsApp us.' });
      return res.status(401).json({ error: WRONG });
    }
    if (p.pin_locked_until && new Date(p.pin_locked_until).getTime() > Date.now()) {
      return res.status(429).json({ error: `Too many wrong tries. Try again in ${PIN_LOCK_MINUTES} minutes.` });
    }
    if (!verifyPin(pin, p.pin_salt, p.pin_hash)) {
      const n = (p.pin_failed ?? 0) + 1;
      const patch = n >= PIN_LOCK_THRESHOLD
        ? { pin_failed: 0, pin_locked_until: new Date(Date.now() + PIN_LOCK_MINUTES * 60000).toISOString() }
        : { pin_failed: n };
      await supabase.from('partners').update(patch).eq('id', p.id);
      return res.status(401).json({ error: WRONG });
    }
    if (p.pin_failed || p.pin_locked_until) {
      await supabase.from('partners').update({ pin_failed: 0, pin_locked_until: null }).eq('id', p.id);
    }
    return res.status(200).json({ ok: true, token: p.dashboard_token });
  } catch (err) {
    console.error('partners/login error:', err);
    return res.status(500).json({ error: 'Could not log in. Please try again.' });
  }
}
