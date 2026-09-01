/**
 * AdminHome.tsx — CRM-1B V1 protected placeholder.
 *
 * Deliberately minimal per CRM-1B scope: no Dashboard, Customers,
 * Payments, Campaigns, Analytics, Settings, or Mr. Snoofy UI yet — that
 * is explicitly out of scope for this round (CRM-2+).
 *
 * Confirms the session server-side via /api/admin/whoami before showing
 * anything — direct navigation to /admin with no/expired/revoked session
 * shows no admin data, only a redirect to /admin/login.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminHome() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

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

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    navigate('/admin/login');
  }

  if (checking || !displayName) return null;

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: 'var(--dim)' }}>
      <div className="max-w-lg mx-auto rounded-2xl p-8" style={{ background: '#fff', border: '1px solid var(--border)' }}>
        <h1 className="font-black text-[22px] mb-1">Studdy Lab CRM</h1>
        <p className="text-[14px] mb-1">Logged in as: <strong>{displayName}</strong></p>
        <p className="text-[13px] mb-6" style={{ color: 'var(--soft)' }}>CRM setup in progress.</p>
        <button className="gost" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}
