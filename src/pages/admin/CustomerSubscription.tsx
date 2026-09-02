/**
 * CustomerSubscription.tsx — /admin/subscriptions route entry point.
 *
 * CRM-3A: activates the "Customer & Subscription" sidebar item. Mirrors
 * AdminHome.tsx's own session-verification shape exactly (confirm via
 * /api/admin/whoami before rendering any admin data, redirect to
 * /admin/login on no/expired/revoked session) — this is a second,
 * independent page under the same admin shell, not a variant of Command
 * Center.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import CustomerSubscriptionPipeline from '../../components/admin/CustomerSubscriptionPipeline';

export default function CustomerSubscription() {
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
      pageTitle="Customer & Subscription"
      pageSubtitle="Lifecycle pipeline for customers who started a trial through Stripe checkout"
      displayName={displayName}
      onLogout={handleLogout}
      loggingOut={loggingOut}
    >
      <CustomerSubscriptionPipeline onSessionExpired={handleSessionExpired} />
    </AdminLayout>
  );
}
