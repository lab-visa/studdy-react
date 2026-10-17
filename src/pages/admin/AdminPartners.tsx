/**
 * /admin/partners - sales partners. Partners self-register on /partners
 * and are active immediately; they log in with WhatsApp number + PIN.
 * Here you see their sales, reset a forgotten PIN (shown once, to send
 * on WhatsApp), add PAN/UPI, pause anyone, or delete someone with no sales.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';

interface Partner {
  id: string; name: string; phone: string; email: string; city: string | null; occupation: string | null;
  experience: string | null; why_join: string | null; status: string; code: string | null;
  has_pin: boolean; pin_must_change: boolean; locked: boolean; last_login_at: string | null; sales_ever: number;
  pan: string | null; payout_upi: string | null; notes: string | null; applied_at: string; approved_at: string | null;
  totals: { sales: number; earned: number; payable: number; pending: number; bonus: number };
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const STATUS_COLORS: Record<string, string> = { applied: '#d97706', approved: '#16a34a', rejected: '#6b7280', paused: '#6b7280' };

export default function AdminPartners() {
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'applied' | 'approved'>('approved');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [tempPin, setTempPin] = useState<{ id: string; name: string; phone: string; pin: string } | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/partners', { credentials: 'same-origin' })
      .then(r => { if (r.status === 401) { navigate('/admin/login'); throw new Error('unauthorized'); } return r.json(); })
      .then(d => (d.error ? setError(d.error) : setPartners(d.partners)))
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    fetch('/api/admin/whoami', { credentials: 'same-origin' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setDisplayName(d.displayName); load(); })
      .catch(() => navigate('/admin/login'));
  }, [navigate, load]);

  const act = async (id: string, body: Record<string, unknown>) => {
    setError('');
    const r = await fetch('/api/admin/partners', {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || 'Could not update');
    load();
    return r.ok ? d : null;
  };

  const resetPin = async (p: Partner) => {
    if (!window.confirm(`Reset the PIN for ${p.name}? They will be logged out and must choose a new PIN after logging in with the temporary one.`)) return;
    const d = await act(p.id, { action: 'reset_pin' });
    if (d?.tempPin) setTempPin({ id: p.id, name: p.name, phone: p.phone, pin: d.tempPin });
  };

  const copy = (key: string, text: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); };

  const logout = async () => { setLoggingOut(true); try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } finally { navigate('/admin/login'); } };

  if (!displayName) return null;
  const needle = q.trim().toLowerCase();
  const shown = (partners || [])
    .filter(p => filter === 'all' || p.status === filter || (filter === 'approved' && p.status === 'paused'))
    .filter(p => !needle || [p.name, p.phone, p.email, p.code, p.city].some(v => (v || '').toLowerCase().includes(needle)));
  const btn = 'text-[12px] font-bold px-3 py-1.5 rounded-lg';

  return (
    <AdminLayout currentPath={location.pathname} pageTitle="Sales Partners"
      pageSubtitle="Applications, referral links and commissions (India)"
      displayName={displayName} onLogout={logout} loggingOut={loggingOut}>
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['applied', 'approved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={btn}
            style={{ background: filter === f ? 'var(--ink)' : 'transparent', color: filter === f ? 'var(--dim)' : 'var(--soft)', border: '1px solid var(--border)' }}>
            {f === 'applied' ? 'Awaiting approval' : f === 'approved' ? 'Partners' : 'All'}
            {' '}({(partners || []).filter(p => f === 'all' || p.status === f || (f === 'approved' && p.status === 'paused')).length})
          </button>
        ))}
        <a href="/partners" target="_blank" rel="noopener noreferrer" className={btn} style={{ color: 'var(--soft)', border: '1px solid var(--border)' }}>Open public page ↗</a>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone, email, code, city"
          className="ml-auto text-[13px] px-3 py-1.5 rounded-lg min-w-[240px]" style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink)' }} />
      </div>
      {tempPin && (
        <div className="rounded-2xl p-5 mb-4" style={{ border: '2px solid #16a34a', background: 'rgba(22,163,74,.06)' }}>
          <div className="font-black text-[15px] mb-1">Temporary PIN for {tempPin.name}: <span className="font-mono text-[22px] tracking-[.25em] ml-1">{tempPin.pin}</span></div>
          <div className="text-[13px] mb-3" style={{ color: 'var(--soft)' }}>Shown only now. Send it on WhatsApp; they'll choose their own PIN after logging in.</div>
          <div className="flex gap-2 flex-wrap">
            <a className={btn} style={{ background: '#25D366', color: '#fff' }} target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/91${tempPin.phone}?text=${encodeURIComponent(`Hi ${tempPin.name.split(' ')[0]}, your temporary Studdy Lab partner PIN is ${tempPin.pin}. Log in at https://studdylab.com/partner/login with your WhatsApp number and this PIN, then choose your own PIN.`)}`}>Send on WhatsApp</a>
            <button className={btn} style={{ border: '1px solid var(--border)' }} onClick={() => setTempPin(null)}>Done</button>
          </div>
        </div>
      )}
      {error && <div className="rounded-xl p-3 mb-4 text-[13px]" style={{ color: '#dc2626', border: '1px solid rgba(239,68,68,.3)' }}>{error}</div>}
      {!partners ? <p style={{ color: 'var(--soft)' }}>Loading…</p> : shown.length === 0 ? (
        <p className="text-[14px]" style={{ color: 'var(--soft)' }}>Nothing here yet.</p>
      ) : (
        <div className="space-y-3">
          {shown.map(p => {
            const link = p.code ? `https://studdylab.com/?ref=${p.code}` : '';
            return (
              <div key={p.id} className="rounded-2xl p-5" style={{ border: '1px solid var(--border)', background: 'var(--card, transparent)' }}>
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <div className="font-black text-[16px]">{p.name} <span className="text-[11px] font-black uppercase ml-1" style={{ color: STATUS_COLORS[p.status] }}>{p.status}</span></div>
                    <div className="text-[13px]" style={{ color: 'var(--soft)' }}>
                      <a className="underline" href={`https://wa.me/91${p.phone}`} target="_blank" rel="noopener noreferrer">+91 {p.phone}</a> · {p.email}{p.city ? ` · ${p.city}` : ''}{p.occupation ? ` · ${p.occupation}` : ''}
                    </div>
                    <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
                      Joined {new Date(p.applied_at).toLocaleDateString('en-IN')}
                      {' · '}{p.last_login_at ? `last login ${new Date(p.last_login_at).toLocaleDateString('en-IN')}` : 'never logged in'}
                      {!p.has_pin && <b style={{ color: '#d97706' }}> · no PIN yet</b>}
                      {p.pin_must_change && <b style={{ color: '#d97706' }}> · temporary PIN</b>}
                      {p.locked && <b style={{ color: '#dc2626' }}> · locked (wrong PINs)</b>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {p.status === 'applied' && <>
                      <button className={btn} style={{ background: '#16a34a', color: '#fff' }} onClick={() => act(p.id, { action: 'approve' })}>Approve</button>
                      <button className={btn} style={{ border: '1px solid var(--border)', color: 'var(--soft)' }} onClick={() => act(p.id, { action: 'reject' })}>Reject</button>
                    </>}
                    {p.status === 'approved' && <button className={btn} style={{ border: '1px solid var(--border)', color: 'var(--soft)' }} onClick={() => act(p.id, { action: 'pause' })}>Pause</button>}
                    {(p.status === 'paused' || p.status === 'rejected') && <button className={btn} style={{ border: '1px solid var(--border)', color: 'var(--soft)' }} onClick={() => act(p.id, { action: 'resume' })}>{p.status === 'rejected' ? 'Approve' : 'Resume'}</button>}
                  </div>
                </div>
                {(p.experience || p.why_join) && (
                  <div className="text-[13px] mt-2" style={{ color: 'var(--soft)' }}>
                    {p.experience && <div><b>Experience:</b> {p.experience}</div>}
                    {p.why_join && <div><b>Could share with:</b> {p.why_join}</div>}
                  </div>
                )}
                {p.code && (
                  <div className="mt-3 grid sm:grid-cols-4 gap-2 text-[13px]">
                    <div><div style={{ color: 'var(--soft)' }}>Sales</div><b>{p.totals.sales}</b></div>
                    <div><div style={{ color: 'var(--soft)' }}>Earned</div><b>{inr(p.totals.earned)}</b></div>
                    <div><div style={{ color: 'var(--soft)' }}>Payable now</div><b>{inr(p.totals.payable)}</b></div>
                    <div><div style={{ color: 'var(--soft)' }}>In 7-day window</div><b>{inr(p.totals.pending)}</b></div>
                  </div>
                )}
                {p.code && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button className={btn} style={{ border: '1px solid var(--border)' }} onClick={() => copy(p.id + 'l', link)}>{copied === p.id + 'l' ? 'Copied ✓' : `Copy sales link (${p.code})`}</button>
                    <button className={btn} style={{ border: '1px solid var(--border)' }} onClick={() => resetPin(p)}>Reset PIN</button>
                    <button className={btn} style={{ border: '1px solid var(--border)' }} onClick={() => {
                      const pan = window.prompt('PAN (for TDS)', p.pan || '');
                      if (pan === null) return;
                      const upi = window.prompt('UPI ID for payouts', p.payout_upi || '');
                      if (upi === null) return;
                      act(p.id, { pan, payoutUpi: upi });
                    }}>PAN & UPI {p.pan ? '✓' : ''}</button>
                    {p.sales_ever === 0 && (
                      <button className={btn} style={{ border: '1px solid rgba(239,68,68,.35)', color: '#dc2626' }} onClick={() => {
                        if (window.confirm(`Delete ${p.name} permanently? This cannot be undone.`)) act(p.id, { action: 'delete' });
                      }}>Delete</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
