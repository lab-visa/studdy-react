/**
 * PATCH /api/admin/customer-sales-owner
 * body: { customerId, salesOwner }
 *
 * CRM-3A Sales Owner foundation — the one write endpoint for the new
 * nullable customers.sales_owner column. Deliberately minimal: a single
 * admin manually setting or clearing a free-text owner name. No team
 * accounts, no permissions, no round-robin assignment, no validation
 * against a fixed roster — all explicitly out of this round's scope.
 * `salesOwner: null` (or an empty/whitespace-only string) clears it back
 * to Unassigned.
 *
 * Auth: requireAdminSession, same as every other /api/admin/* handler.
 * CSRF: isSameOriginRequest, matching the existing pattern for the only
 * other state-changing admin endpoint today (api/admin/logout.js) — this
 * is the first admin endpoint that WRITES CRM data, so the same
 * defense-in-depth is applied here from the start.
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession, isSameOriginRequest } from '../_lib/admin-auth.js';

const MAX_SALES_OWNER_LENGTH = 200;

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return;

  const { customerId, salesOwner } = req.body || {};
  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }

  let normalizedOwner = null;
  if (typeof salesOwner === 'string' && salesOwner.trim()) {
    normalizedOwner = salesOwner.trim().slice(0, MAX_SALES_OWNER_LENGTH);
  } else if (salesOwner != null && typeof salesOwner !== 'string') {
    return res.status(400).json({ error: 'salesOwner must be a string or null' });
  }

  try {
    const { data: existing, error: fetchError } = await supabase.from('customers').select('id').eq('id', customerId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const { data, error } = await supabase
      .from('customers')
      .update({ sales_owner: normalizedOwner, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .select('id, sales_owner')
      .single();
    if (error) throw error;

    return res.status(200).json({ ok: true, customer: data });
  } catch (err) {
    console.error('admin/customer-sales-owner error:', err);
    return res.status(500).json({ error: 'Could not update Sales Owner' });
  }
}
