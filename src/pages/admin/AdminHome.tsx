/**
 * AdminHome.tsx — /admin route entry point.
 *
 * CRM-2B: the CRM-1B placeholder ("CRM setup in progress") is replaced by
 * the real Executive Command Center, but the actual security behavior is
 * unchanged from CRM-1B — this still confirms the session server-side via
 * /api/admin/whoami before rendering ANY admin data, and still redirects
 * to /admin/login on no/expired/revoked session. Logout still calls
 * /api/admin/logout, which revokes the server-side session row (not just
 * a cookie clear) — see api/_lib/admin-auth.js's revokeSession().
 *
 * A second 401 while the dashboard is open (CommandCenter's own fetch to
 * /api/admin/metrics, e.g. the session expiring mid-visit) is handled the
 * same way, via the onSessionExpired callback passed down.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import CommandCenter from './CommandCenter';

export default function AdminHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/whoami', { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error('unauthorized');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setDisplayName(data.displayName);
      })
      .catch(() => {
        if (!cancelled) navigate('/admin/login');
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleSessionExpired = useCallback(() => {
    navigate('/admin/login');
  }, [navigate]);

  if (checking || !displayName) return null;

  return (
    <AdminLayout
      currentPath={location.pathname}
      pageTitle="Command Center"
      pageSubtitle="Real-time overview of leads, revenue, and Studdy account capacity"
      displayName={displayName}
      onLogout={handleLogout}
      loggingOut={loggingOut}
    >
      <CommandCenter onSessionExpired={handleSessionExpired} />
    </AdminLayout>
  );
}
