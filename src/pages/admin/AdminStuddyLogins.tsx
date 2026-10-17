/**
 * /admin/studdy-logins - the Studdy seat pool: each login's used / free
 * seats, who is on it (India + international), expired India customers
 * still holding a seat, low-seat warning, add a login, change seat limit.
 * Passwords are never shown here.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminSession, adminFetch } from '../../components/admin/useAdminSession';

interface Customer { market: 'India' | 'International'; id: string; name: string | null; contact: string | null; plan: string | null; until: string | null; expired: boolean; partner?: string | null; status?: string }
interface Login { id: string; createdAt: string; groupName: string; studdyEmail: string | null; studdyUrl: string | null; capacity: number; used: number; free: number; customers: Customer[]; expiredHoldingSeat: number }
interface Data { rows: Login[]; nextName: string; totals: { logins: number; capacity: number; used: number; free: number }; lowSeats: number }

export default function AdminStuddyLogins() {
  const location = useLocation();
  const { displayName, logout, loggingOut } = useAdminSession();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ groupName: '', studdyEmail: '', studdyPassword: '', studdyUrl: 'https://studdyai.com/sign-in', maxCapacity: '40' });

  const load = useCallback(() => { adminFetch('/api/admin/studdy-logins').then(setData).catch(e => setError(e.message)); }, []);
  useEffect(() => { if (displayName) load(); }, [displayName, load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await adminFetch('/api/admin/studdy-logins', { method: 'POST', body: { ...form, maxCapacity: Number(form.maxCapacity) } });
      setAdding(false);
      setForm({ groupName: '', studdyEmail: '', studdyPassword: '', studdyUrl: 'https://studdyai.com/sign-in', maxCapacity: '40' });
      load();
    } catch (x) { setError(x instanceof Error ? x.message : 'Could not add'); }
  };

  const setCap = async (l: Login) => {
    const v = window.prompt(`Seat limit for ${l.groupName} (now ${l.capacity}, ${l.used} in use):`, String(l.capacity));
    if (v === null) return;
    try { await adminFetch('/api/admin/studdy-logins', { method: 'PATCH', body: { id: l.id, maxCapacity: Number(v) } }); load(); }
    catch (x) { setError(x instanceof Error ? x.message : 'Could not update'); }
  };

  if (!displayName) return null;
  const box = { border: '1px solid var(--border)' };
  const btn = 'text-[12px] font-bold px-3 py-1.5 rounded-lg';
  const input = 'w-full rounded-lg px-3 py-2 text-[13px]';
  const ist = { ...box, background: 'transparent', color: 'var(--ink)' };
  const low = data && data.totals.free < data.lowSeats;

  return (
    <AdminLayout currentPath={location.pathname} pageTitle="Studdy Logins" pageSubtitle="Seats used and free on each login. New customers fill the oldest login first."
      displayName={displayName} onLogout={logout} loggingOut={loggingOut}>
      {error && <div className="rounded-xl p-3 mb-4 text-[13px]" style={{ color: '#dc2626', border: '1px solid rgba(239,68,68,.3)' }}>{error}</div>}
      {low && (
        <div className="rounded-xl p-3.5 mb-4 text-[13.5px] font-bold" style={{ color: '#b45309', border: '1px solid rgba(245,158,11,.45)', background: 'rgba(245,158,11,.07)' }}>
          Only {data!.totals.free} free seat(s) left. Ask Mike for a new Studdy login and add it below, before new customers have to wait.
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 text-[13px]">
          {[['Logins', data.totals.logins], ['Total seats', data.totals.capacity], ['In use', data.totals.used], ['Free', data.totals.free]].map(([l, v]) => (
            <div key={l} className="rounded-xl p-3" style={box}>
              <div style={{ color: 'var(--soft)' }}>{l}</div>
              <div className="font-black text-[22px]" style={{ color: l === 'Free' && low ? '#b45309' : undefined }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        {!adding ? (
          <div className="flex flex-wrap gap-2 items-center">
            <button className={btn} style={{ background: 'var(--ink)', color: 'var(--dim)' }} onClick={() => { setForm(f => ({ ...f, groupName: data?.nextName || f.groupName })); setAdding(true); }}>+ Add a Studdy login</button>
            {data && <span className="text-[12.5px]" style={{ color: 'var(--soft)' }}>Next name: <b style={{ color: 'var(--ink)' }}>{data.nextName}</b> · last added: <b style={{ color: 'var(--ink)' }}>{data.rows[0]?.groupName || '-'}</b></span>}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a customer: name, phone or email"
              className="ml-auto text-[13px] px-3 py-1.5 rounded-lg min-w-[260px]" style={ist} />
          </div>
        ) : (
          <form onSubmit={add} className="rounded-2xl p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" style={box}>
            <label className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>Name<input className={input} style={ist} value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })} placeholder="Group 2" /></label>
            <label className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>Studdy email<input className={input} style={ist} value={form.studdyEmail} onChange={e => setForm({ ...form, studdyEmail: e.target.value })} type="email" autoComplete="off" /></label>
            <label className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>Password<input className={input} style={ist} value={form.studdyPassword} onChange={e => setForm({ ...form, studdyPassword: e.target.value })} type="password" autoComplete="new-password" /></label>
            <label className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>Seats<input className={input} style={ist} value={form.maxCapacity} onChange={e => setForm({ ...form, maxCapacity: e.target.value.replace(/\D/g, '') })} inputMode="numeric" /></label>
            <div className="flex gap-2"><button className={btn} style={{ background: '#16a34a', color: '#fff' }}>Save</button><button type="button" className={btn} style={box} onClick={() => setAdding(false)}>Cancel</button></div>
            <p className="sm:col-span-2 lg:col-span-5 text-[11.5px]" style={{ color: 'var(--soft)' }}>The password is saved securely and only ever shown to customers on their own dashboard, never on admin pages.</p>
          </form>
        )}
      </div>

      {!data ? <p style={{ color: 'var(--soft)' }}>Loading…</p> : (
        <div className="space-y-3">
          {q.trim() && (() => {
            const n = q.trim().toLowerCase();
            const hits = data.rows.flatMap(l => l.customers.filter(c => [c.name, c.contact].some(v => (v || '').toLowerCase().includes(n))).map(c => ({ c, l })));
            return (
              <div className="rounded-2xl p-4" style={{ border: '1.5px solid var(--g3, #8C79E0)' }}>
                <div className="font-black text-[14px] mb-2">{hits.length} customer(s) found</div>
                {hits.map(({ c, l }) => (
                  <div key={c.id} className="text-[13px] py-1" style={{ borderTop: '1px solid var(--border)' }}>
                    <b>{c.name || '-'}</b> · {c.contact} · {c.market} → on <b>{l.groupName}</b> ({l.studdyEmail}){c.expired ? ' · access expired' : ''}
                  </div>
                ))}
              </div>
            );
          })()}
          {data.rows.map(l => {
            const pct = l.capacity ? Math.min(100, (l.used / l.capacity) * 100) : 100;
            const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a';
            return (
              <div key={l.id} className="rounded-2xl p-4" style={box}>
                <div className="flex flex-wrap justify-between gap-3 items-start">
                  <div>
                    <div className="font-black text-[15px]">{l.groupName}</div>
                    <div className="text-[12.5px]" style={{ color: 'var(--soft)' }}>{l.studdyEmail} · added {new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className={btn} style={box} onClick={() => setCap(l)}>Seat limit: {l.capacity}</button>
                    <button className={btn} style={box} onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? 'Hide customers' : `Customers (${l.customers.length})`}</button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="text-[13px] font-bold whitespace-nowrap"><span style={{ color }}>{l.used}</span> / {l.capacity} used · {l.free} free</div>
                </div>
                {l.expiredHoldingSeat > 0 && (
                  <div className="text-[12.5px] mt-2 font-bold" style={{ color: '#b45309' }}>
                    {l.expiredHoldingSeat} India customer(s) here have expired access but still hold a seat. Release them from India Sales.
                  </div>
                )}
                {l.used !== l.customers.length && (
                  <div className="text-[12px] mt-1" style={{ color: 'var(--soft)' }}>Seats in use ({l.used}) and customers listed ({l.customers.length}) differ - usually older test or manual entries.</div>
                )}
                {open === l.id && (
                  <div className="mt-3 overflow-x-auto">
                    {l.customers.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--soft)' }}>No customers on this login yet.</p> : (
                      <table className="w-full text-[12.5px]">
                        <thead><tr className="text-left" style={{ color: 'var(--soft)' }}><th className="py-1 pr-3">Customer</th><th className="py-1 pr-3">Contact</th><th className="py-1 pr-3">Market</th><th className="py-1 pr-3">Plan</th><th className="py-1 pr-3">Until</th><th className="py-1">Partner</th></tr></thead>
                        <tbody>
                          {l.customers.map(c => (
                            <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                              <td className="py-1.5 pr-3 font-bold">{c.name || '-'}</td><td className="py-1.5 pr-3">{c.contact || '-'}</td><td className="py-1.5 pr-3">{c.market}</td>
                              <td className="py-1.5 pr-3">{c.plan || '-'}</td>
                              <td className="py-1.5 pr-3" style={{ color: c.expired ? '#dc2626' : undefined }}>{c.until ? new Date(c.until).toLocaleDateString('en-IN') : '-'}{c.expired ? ' (expired)' : ''}</td>
                              <td className="py-1.5">{c.partner || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
