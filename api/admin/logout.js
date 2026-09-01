/**
 * POST /api/admin/logout
 *
 * Genuine server-side session revocation (admin_sessions.revoked_at),
 * not just a cookie clear — a revoked session is rejected by
 * requireAdminSession() immediately, even if the old cookie value is
 * somehow replayed.
 */
import { getSupabase } from '../_lib/supabase.js';
import { getSessionTokenFromRequest, revokeSession, sessionCookieHeader, isSameOriginRequest } from '../_lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = getSupabase();
  const token = getSessionTokenFromRequest(req);

  try {
    await revokeSession(supabase, token);
  } catch (err) {
    console.error('admin logout error:', err);
    /* Still clear the cookie client-side even if the revoke write
     * failed — never leave the browser holding a cookie it believes is
     * valid without at least attempting server-side revocation, but
     * also never block the user from clearing their own browser state. */
  }

  res.setHeader('Set-Cookie', sessionCookieHeader(null, { clear: true }));
  return res.status(200).json({ ok: true });
}
