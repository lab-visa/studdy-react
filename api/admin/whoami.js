/**
 * GET /api/admin/whoami
 *
 * Used by the /admin placeholder page to check whether the current
 * cookie represents a currently-valid, server-verified session before
 * showing anything — direct navigation to /admin with no/expired/revoked
 * session yields no admin data, only a 401.
 */
import { getSupabase } from '../_lib/supabase.js';
import { requireAdminSession } from '../_lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  const adminUser = await requireAdminSession(req, res, supabase);
  if (!adminUser) return; // requireAdminSession already sent 401

  return res.status(200).json({ displayName: adminUser.display_name });
}
