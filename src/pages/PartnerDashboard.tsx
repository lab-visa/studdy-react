/**
 * /partner?t=<token> — a sales partner's private earnings page: their
 * link, sales (customer details masked), what's payable now, what's still
 * inside the 7-day refund window, and monthly totals with bonus.
 */
import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '../data/config';

interface Sale { order_id: string; paid_at: string; plan: string; amount: number; customer: string; commission: number; state: 'payable' | 'in_refund_window' | 'refunded'; clears_at: string }
interface Month { month: string; sales: number; refunded: number; commission: number; bonus: number; total: number; payable: number; pending: number }
interface Data { name: string; code: string; status: string; sales: Sale[]; months: Month[]; totals: { sales: number; earned: number; payable: number; pending: number; bonus: number } }

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default function PartnerDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') || '';
    fetch(`/api/partners/me?t=${encodeURIComponent(t)}`)
      .then(r => r.json())
      .then(d => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('Could not load your page.'));
  }, []);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--dim)' }}>
      <div className="bg-white rounded-3xl p-8 max-w-[420px] text-center" style={{ border: '1.5px solid var(--border)' }}>
        <div className="font-black text-[22px] mb-3"><span className="grad-text">studdy</span></div>
        <p className="text-[14px] mb-5" style={{ color: 'var(--soft)' }}>We couldn’t find this partner link. Message us and we’ll resend it.</p>
        <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="gbtn w-full py-3 flex justify-center">WhatsApp us</a>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen" style={{ background: 'var(--dim)' }} />;

  const link = `https://studdylab.com/?ref=${data.code}`;
  const card = 'bg-white rounded-2xl p-5';
  const cardStyle = { border: '1.5px solid var(--border)' };

  return (
    <div className="min-h-screen" style={{ background: 'var(--dim)' }}>
      <header className="bg-white h-16 flex items-center justify-between px-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-black text-[20px]"><span className="grad-text">studdy</span> <span className="text-[13px] font-bold" style={{ color: 'var(--soft)' }}>Partner</span></div>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>{data.name}</span>
      </header>

      <div className="max-w-[760px] mx-auto px-4 py-8">
        {data.status === 'paused' && (
          <div className="rounded-xl p-4 mb-4 text-[13px]" style={{ background: 'rgba(245,158,11,.08)', color: '#92400e', border: '1px solid rgba(245,158,11,.3)' }}>
            Your partner account is paused. Earlier sales are still shown and paid. Message us to reactivate.
          </div>
        )}

        <div className={`${card} mb-4`} style={cardStyle}>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>Your personal link</div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[15px] font-bold break-all flex-1" style={{ color: 'var(--ink)' }}>{link}</code>
            <button className="gbtn text-[13px] px-4 py-2 flex items-center gap-1"
              onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[12.5px] mt-2" style={{ color: 'var(--soft)' }}>Every purchase made through this link is credited to you (code <b>{data.code}</b>).</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            ['Sales', String(data.totals.sales)],
            ['Total earned', inr(data.totals.earned)],
            ['Payable now', inr(data.totals.payable)],
            ['In 7-day window', inr(data.totals.pending)],
          ].map(([l, v]) => (
            <div key={l} className={card} style={cardStyle}>
              <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>{l}</div>
              <div className="font-black text-[22px]" style={{ color: 'var(--ink)' }}>{v}</div>
            </div>
          ))}
        </div>

        <h2 className="font-black text-[17px] mb-3">By month</h2>
        <div className={`${card} mb-6`} style={cardStyle}>
          {data.months.length === 0 ? (
            <p className="text-[14px]" style={{ color: 'var(--soft)' }}>No sales yet. Share your link to get your first one!</p>
          ) : data.months.map(m => (
            <div key={m.month} className="flex justify-between items-center py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="font-bold text-[14px]">{monthName(m.month)}</div>
                <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
                  {m.sales} sale{m.sales === 1 ? '' : 's'}{m.refunded ? ` · ${m.refunded} refunded` : ''}{m.bonus ? ` · bonus ${inr(m.bonus)}` : m.sales < 10 ? ` · ${10 - m.sales} more for ₹5,000 bonus` : ''}
                </div>
              </div>
              <div className="font-black text-[15px]">{inr(m.total)}</div>
            </div>
          ))}
        </div>

        <h2 className="font-black text-[17px] mb-3">Sales</h2>
        <div className={card} style={cardStyle}>
          {data.sales.length === 0 ? (
            <p className="text-[14px]" style={{ color: 'var(--soft)' }}>Your sales will appear here.</p>
          ) : data.sales.map(s => (
            <div key={s.order_id} className="flex justify-between items-center py-2.5 gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <div className="font-bold text-[14px] truncate">{s.customer}</div>
                <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
                  {day(s.paid_at)} · {s.plan === 'yearly' ? 'Yearly' : 'Quarterly'} {inr(s.amount)} ·{' '}
                  {s.state === 'payable' ? 'payable' : s.state === 'refunded' ? 'refunded' : `payable from ${day(s.clears_at)}`}
                </div>
              </div>
              <div className="font-black text-[14px]" style={{ color: s.state === 'refunded' ? 'var(--soft)' : 'var(--ink)' }}>{inr(s.commission)}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-center mt-6" style={{ color: 'var(--soft)' }}>
          Payouts every week for sales past the 7-day refund window. TDS is deducted as per law. Keep this link private.
        </p>
      </div>
    </div>
  );
}
