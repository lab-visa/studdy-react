/** Admin page boilerplate: who's logged in (redirects to login if nobody) and logout. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function useAdminSession() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    fetch('/api/admin/whoami', { credentials: 'same-origin' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setDisplayName(d.displayName))
      .catch(() => navigate('/admin/login'));
  }, [navigate]);
  const logout = async () => {
    setLoggingOut(true);
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } finally { navigate('/admin/login'); }
  };
  return { displayName, logout, loggingOut };
}

/** fetch() for admin APIs: JSON in/out, 401 → login page. */
export async function adminFetch(url: string, init?: { method?: string; body?: unknown }) {
  const r = await fetch(url, {
    method: init?.method || 'GET', credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (r.status === 401) { window.location.href = '/admin/login'; throw new Error('Not signed in'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
