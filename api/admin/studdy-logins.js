/**
 * /api/admin/studdy-logins   (admin only)  - the Studdy seat pool.
 *
 * GET   → every Studdy login: seats used / capacity / free, and who is on
 *         it (India orders + international subscribers). Passwords are
 *         NEVER returned here - customers see them on their own dashboard.
 * POST  { groupName, studdyEmail, studdyPassword, studdyUrl?, maxCapacity }
 *         adds a new login from Mike (password is write-only).
 * PATCH { id, maxCapacity }  → change a login's seat limit.
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession, isSameOriginRequest } from '../_lib/admin-auth.js';

export const LOW_SEATS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res, deps = {}) {
  const supabase = (deps.getSupabase || getSupabase)();
  if (req.method !== 'GET' && !isSameOriginRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  const admin = await requireAdminSession(req, res, supabase);
  if (!admin) return;
  res.setHeader('Cache-Control', 'private, no-store');
  const now = deps.now || new Date();

  try {
    if (req.method === 'GET') {
      const { data: accounts, error } = await supabase.from('studdy_accounts')
        .select('id, group_name, studdy_email, studdy_url, max_capacity, active_customer_count, created_at').order('group_name');
      if (error) throw error;
      const { data: india, error: iErr } = await supabase.from('india_orders')
        .select('order_id, customer_name, customer_phone, customer_email, plan, access_end, group_name, ref_code').not('group_name', 'is', null);
      if (iErr) throw iErr;
      const { data: intl, error: lErr } = await supabase.from('leads')
        .select('lead_id, parent_name, student_name, email, mobile_number_with_code, plan_type, status, next_billing_date, group_name').not('group_name', 'is', null);
      if (lErr) throw lErr;

      const rows = (accounts || []).map((a) => {
        const customers = [
          ...(india || []).filter((o) => o.group_name === a.group_name).map((o) => ({
            market: 'India', id: o.order_id, name: o.customer_name, contact: o.customer_phone, plan: o.plan,
            until: o.access_end, expired: Boolean(o.access_end && new Date(o.access_end) < now), partner: o.ref_code,
          })),
          ...(intl || []).filter((l) => l.group_name === a.group_name).map((l) => ({
            market: 'International', id: l.lead_id, name: l.parent_name || l.student_name, contact: l.email || l.mobile_number_with_code,
            plan: l.plan_type, until: l.next_billing_date, expired: false, status: l.status,
          })),
        ];
        const used = a.active_customer_count ?? 0;
        return {
          id: a.id, groupName: a.group_name, studdyEmail: a.studdy_email, studdyUrl: a.studdy_url,
          capacity: a.max_capacity, used, free: Math.max(0, (a.max_capacity ?? 0) - used), createdAt: a.created_at,
          customers, expiredHoldingSeat: customers.filter((c) => c.expired).length,
        };
      });
      const capacity = rows.reduce((s, r) => s + (r.capacity || 0), 0);
      const used = rows.reduce((s, r) => s + r.used, 0);
      return res.status(200).json({ rows, totals: { logins: rows.length, capacity, used, free: Math.max(0, capacity - used) }, lowSeats: LOW_SEATS });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const groupName = String(b.groupName || '').trim().slice(0, 60);
      const studdyEmail = String(b.studdyEmail || '').trim().toLowerCase();
      const studdyPassword = String(b.studdyPassword || '');
      const cap = Number(b.maxCapacity);
      if (groupName.length < 2) return res.status(400).json({ error: 'Give the login a name, e.g. "Group 2".' });
      if (!EMAIL_RE.test(studdyEmail)) return res.status(400).json({ error: 'Enter the Studdy login email.' });
      if (studdyPassword.length < 4) return res.status(400).json({ error: 'Enter the Studdy login password.' });
      if (!Number.isInteger(cap) || cap < 1 || cap > 500) return res.status(400).json({ error: 'Seats must be a whole number from 1 to 500.' });
      const { data: dup } = await supabase.from('studdy_accounts').select('id').eq('group_name', groupName).maybeSingle();
      if (dup) return res.status(409).json({ error: 'A login with that name already exists.' });
      const { error } = await supabase.from('studdy_accounts').insert({
        group_name: groupName, studdy_email: studdyEmail, studdy_password: studdyPassword,
        studdy_url: String(b.studdyUrl || '').trim() || 'https://studdyai.com/sign-in', max_capacity: cap, active_customer_count: 0,
      });
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'A login with that name already exists.' });
        throw error;
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const { id, maxCapacity } = req.body || {};
      const cap = Number(maxCapacity);
      if (!Number.isInteger(cap) || cap < 1 || cap > 500) return res.status(400).json({ error: 'Seats must be a whole number from 1 to 500.' });
      const { data: a } = await supabase.from('studdy_accounts').select('active_customer_count').eq('id', id).maybeSingle();
      if (!a) return res.status(404).json({ error: 'Login not found' });
      if (cap < (a.active_customer_count ?? 0)) return res.status(400).json({ error: `${a.active_customer_count} seats are in use, so the limit can't be lower than that.` });
      const { error } = await supabase.from('studdy_accounts').update({ max_capacity: cap }).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/studdy-logins error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
