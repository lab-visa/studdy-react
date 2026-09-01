/**
 * AdminLogin.tsx — CRM-1B V1 admin login.
 *
 * Name + 4-digit PIN only. No client-side-only gating: this page never
 * decides access by itself — it just calls /api/admin/login, which is
 * the only place a session is actually granted (server-side, cookie-
 * based). On success, redirects to /admin, which itself re-verifies the
 * session server-side via /api/admin/whoami before showing anything.
 *
 * Deliberately new — not a reuse of the old local-only admin UI, which
 * was never pushed to GitHub and used a different (shared-password)
 * auth design entirely.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, pin }),
      });
      if (!res.ok) {
        // Deliberately generic — the server already returns the same
        // message for unknown name / wrong PIN / locked out / inactive.
        setError('Invalid login');
        return;
      }
      navigate('/admin');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--dim)' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl p-8" style={{ background: '#fff', border: '1px solid var(--border)' }}>
        <h1 className="font-black text-[22px] mb-1">Studdy Lab CRM</h1>
        <p className="text-[13px] mb-6" style={{ color: 'var(--soft)' }}>Admin sign in</p>

        <label className="block text-[12px] font-bold mb-1" style={{ color: 'var(--soft)' }}>Name</label>
        <input
          type="text"
          autoComplete="username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg text-[15px]"
          style={{ border: '1px solid var(--border)' }}
          required
        />

        <label className="block text-[12px] font-bold mb-1" style={{ color: 'var(--soft)' }}>PIN</label>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="w-full mb-4 px-3 py-2 rounded-lg text-[15px] tracking-[6px]"
          style={{ border: '1px solid var(--border)' }}
          required
        />

        {error && (
          <p className="text-[13px] mb-4" style={{ color: '#dc2626' }}>{error}</p>
        )}

        <button type="submit" disabled={submitting} className="gbtn w-full justify-center">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
