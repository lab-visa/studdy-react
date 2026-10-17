/**
 * POST /api/partners/payout-details   (logged-in partner)
 *   { action: 'save', holder, account, account2, ifsc, bankName?, branch?, upi?, pan, aadhaarLast4, aadhaarConsent: true }
 *   { action: 'photo', kind: 'pan'|'aadhaar_front'|'aadhaar_back', photo: 'data:image/jpeg;base64,...' }
 * Only the last 4 Aadhaar digits are ever accepted/stored. Changing bank
 * details, PAN, Aadhaar or any photo clears the admin's "checked" mark, so
 * the admin re-checks before the next payout.
 */
import { getSupabase } from '../_lib/supabase.js';
import { isSameOriginRequest } from '../_lib/admin-auth.js';
import { getLoggedInPartner } from '../_lib/partner-auth.js';
import { validatePayoutDetails, publicDetails, decodePhoto, storageOf, DOC_KINDS } from '../_lib/partner-payouts.js';

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  res.setHeader('Cache-Control', 'private, no-store');
  const supabase = (deps.getSupabase || getSupabase)();
  try {
    const p = await getLoggedInPartner(req, supabase);
    if (!p) return res.status(401).json({ error: 'Please log in again.' });
    const b = req.body || {};
    const now = new Date().toISOString();

    if (b.action === 'save') {
      const v = validatePayoutDetails(b);
      if (v.error) return res.status(400).json({ error: v.error });
      const changed = ['bank_holder', 'bank_account', 'bank_ifsc', 'pan', 'aadhaar_last4'].some((k) => (p[k] || null) !== v.fields[k]);
      const update = { ...v.fields, aadhaar_consent_at: now, payout_details_updated_at: now, updated_at: now };
      if (changed) update.payout_details_checked_at = null;
      const { data, error } = await supabase.from('partners').update(update).eq('id', p.id).select('*').single();
      if (error) throw error;
      return res.status(200).json({ ok: true, details: publicDetails(data) });
    }

    if (b.action === 'photo') {
      const col = DOC_KINDS[b.kind];
      if (!col) return res.status(400).json({ error: 'Unknown document.' });
      const photo = decodePhoto(b.photo);
      if (photo.error) return res.status(400).json({ error: photo.error });
      const path = `${b.kind}/${p.id}/${Date.now()}.${photo.ext}`;
      const store = storageOf(supabase, deps);
      const { error: upErr } = await store.upload(path, photo.buffer, { contentType: photo.type, upsert: false });
      if (upErr) throw upErr;
      const { data, error } = await supabase.from('partners')
        .update({ [col]: path, payout_details_checked_at: null, payout_details_updated_at: now, updated_at: now })
        .eq('id', p.id).select('*').single();
      if (error) throw error;
      if (p[col] && p[col] !== path) await store.remove([p[col]]).catch(() => {});
      return res.status(200).json({ ok: true, details: publicDetails(data) });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('partners/payout-details error:', err);
    return res.status(500).json({ error: 'Could not save. Please try again.' });
  }
}
