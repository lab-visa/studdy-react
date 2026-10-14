/**
 * /api/admin/partners  (admin only)
 *
 * GET   → every application/partner, newest first, with sales + earnings.
 * PATCH → body { id, action: 'approve'|'reject'|'pause'|'resume', notes?, pan?, payoutUpi? }
 *         'approve' gives the partner a referral code and a private
 *         dashboard link (both created once and never changed).
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession, isSameOriginRequest } from '../_lib/admin-auth.js';
import { computeEarnings, makePartnerCode, newDashboardToken } from '../_lib/partners.js';

const ACTIONS = { approve: 'approved', reject: 'rejected', pause: 'paused', resume: 'approved' };

export default async function handler(req, res, deps = {}) {
  const supabase = (deps.getSupabase || getSupabase)();

  if (req.method === 'GET') {
    const admin = await requireAdminSession(req, res, supabase);
    if (!admin) return;
    try {
      const { data: partners, error } = await supabase.from('partners').select('*').order('applied_at', { ascending: false });
      if (error) throw error;
      const codes = (partners || []).map((p) => p.code).filter(Boolean);
      let orders = [];
      if (codes.length) {
        const { data, error: oErr } = await supabase
          .from('india_orders').select('*').in('ref_code', codes).in('status', ['paid', 'refunded']);
        if (oErr) throw oErr;
        orders = data || [];
      }
      const now = deps.now || new Date();
      const rows = (partners || []).map((p) => {
        const e = computeEarnings(orders.filter((o) => o.ref_code === p.code), now);
        return {
          id: p.id, name: p.name, phone: p.phone, email: p.email, city: p.city, occupation: p.occupation,
          experience: p.experience, why_join: p.why_join, status: p.status, code: p.code,
          dashboard_token: p.dashboard_token, pan: p.pan, payout_upi: p.payout_upi, notes: p.notes,
          applied_at: p.applied_at, approved_at: p.approved_at,
          totals: e.totals, this_month: e.months[0] || null,
        };
      });
      return res.status(200).json({ partners: rows });
    } catch (err) {
      console.error('admin/partners GET error:', err);
      return res.status(500).json({ error: 'Could not load partners' });
    }
  }

  if (req.method === 'PATCH') {
    if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Forbidden' });
    const admin = await requireAdminSession(req, res, supabase);
    if (!admin) return;

    const { id, action, notes, pan, payoutUpi } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (action && !ACTIONS[action]) return res.status(400).json({ error: 'Unknown action' });

    try {
      const { data: p, error } = await supabase.from('partners').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!p) return res.status(404).json({ error: 'Partner not found' });

      const update = { updated_at: new Date().toISOString() };
      if (typeof notes === 'string') update.notes = notes.trim().slice(0, 2000) || null;
      if (typeof pan === 'string') {
        const clean = pan.trim().toUpperCase();
        if (clean && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) return res.status(400).json({ error: 'PAN format looks wrong (e.g. ABCDE1234F)' });
        update.pan = clean || null;
      }
      if (typeof payoutUpi === 'string') update.payout_upi = payoutUpi.trim().slice(0, 100) || null;
      if (action) update.status = ACTIONS[action];
      if (action === 'approve' || action === 'resume') {
        if (!p.dashboard_token) update.dashboard_token = newDashboardToken();
        if (!p.approved_at) update.approved_at = new Date().toISOString();
      }

      /* Give a code on first approval; retry on the (rare) code collision. */
      for (let attempt = 0; attempt < 5; attempt++) {
        if ((action === 'approve' || action === 'resume') && !p.code) update.code = makePartnerCode(p.name);
        const { data, error: uErr } = await supabase.from('partners').update(update).eq('id', id).select('*').single();
        if (!uErr) return res.status(200).json({ partner: data });
        if (uErr.code !== '23505' || p.code) throw uErr;
      }
      return res.status(500).json({ error: 'Could not create a unique code, please try again' });
    } catch (err) {
      console.error('admin/partners PATCH error:', err);
      return res.status(500).json({ error: 'Could not update partner' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
