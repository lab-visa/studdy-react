/** Admin home: India at a glance - sales and money today, free Studdy seats, partner KYC waiting for a check. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { istToday } from './DateRangeFilter';

export default function IndiaTodayBox() {
  const [d, setD] = useState<{ sales: number; revenue: number; waiting: number; free: number | null; toCheck: number } | null>(null);
  useEffect(() => {
    const t = istToday();
    Promise.all([
      fetch(`/api/admin/india-sales?from=${t}&to=${t}`, { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/admin/studdy-logins', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/admin/partners', { credentials: 'same-origin' }).then(r => r.json()),
    ]).then(([s, l, p]) => setD({
      sales: s.totals?.sales ?? 0, revenue: s.totals?.revenue ?? 0, waiting: s.totals?.waitingForSeat ?? 0,
      free: l.totals?.free ?? null,
      toCheck: (p.partners || []).filter((x: { kyc_status: string }) => x.kyc_status === 'to_check').length,
    })).catch(() => {});
  }, []);
  if (!d) return null;
  const box = { border: '1px solid var(--border)' };
  const tiles: [string, string, string, string | undefined][] = [
    ['India sales today', String(d.sales), '/admin/india-sales', undefined],
    ['Collected today', `₹${Math.round(d.revenue).toLocaleString('en-IN')}`, '/admin/india-sales', undefined],
    ['Free Studdy seats', d.free == null ? '-' : String(d.free), '/admin/studdy-logins', d.free != null && d.free < 10 ? '#b45309' : undefined],
    ['Partner KYC to check', String(d.toCheck), '/admin/partners', d.toCheck ? '#dc2626' : undefined],
  ];
  return (
    <div className="mb-6">
      {d.waiting > 0 && (
        <Link to="/admin/india-sales" className="block rounded-xl p-3 mb-3 text-[13px] font-bold" style={{ color: '#dc2626', border: '1px solid rgba(239,68,68,.35)' }}>
          {d.waiting} paid India customer(s) are waiting for a Studdy login →
        </Link>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
        {tiles.map(([l, v, to, c]) => (
          <Link key={l} to={to} className="rounded-xl p-3 block" style={box}>
            <div style={{ color: 'var(--soft)' }}>{l}</div>
            <div className="font-black text-[22px]" style={{ color: c }}>{v}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
