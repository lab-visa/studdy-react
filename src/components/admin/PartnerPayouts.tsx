/**
 * Admin → Sales Partners → Payouts. For a sales month: who to pay, gross,
 * TDS, net and full bank details; download a sheet for the bank; mark each
 * payout paid with the bank's UTR (the partner then sees it in their history).
 */
import { useCallback, useEffect, useState } from 'react';

interface Row {
  partnerId: string; name: string; phone: string; code: string; status: string;
  sales: number; commission: number; bonus: number; gross: number; tds: number; net: number;
  bank: { holder: string | null; account: string | null; ifsc: string | null; bankName: string | null; branch: string | null; upi: string | null; pan: string | null };
  detailsComplete: boolean; detailsChecked: boolean;
  payout: { utr: string; paid_on: string; net: number; tds: number; gross: number } | null;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default function PartnerPayouts() {
  const [month, setMonth] = useState('');
  const [data, setData] = useState<{ month: string; tdsRate: number; payable: boolean; rows: Row[] } | null>(null);
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState<string | null>(null);
  const [utr, setUtr] = useState('');
  const [paidOn, setPaidOn] = useState(todayIST());

  const load = useCallback((m?: string) => {
    fetch(`/api/admin/partner-payouts${m ? `?month=${m}` : ''}`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => { if (d.error) return setError(d.error); setData(d); setMonth(d.month); setRate(String(d.tdsRate)); })
      .catch(() => setError('Could not load payouts'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (method: string, body: Record<string, unknown>) => {
    setError('');
    const r = await fetch('/api/admin/partner-payouts', { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'Something went wrong'); return false; }
    load(month);
    return true;
  };

  const download = () => {
    if (!data) return;
    const ready = data.rows.filter(r => !r.payout && r.detailsComplete && r.net > 0);
    const head = ['Partner', 'Account holder', 'Account number', 'IFSC', 'Bank', 'UPI', 'PAN', 'Sales month', 'Gross', 'TDS', 'Net to pay', 'Phone'];
    const lines = ready.map(r => [r.name, r.bank.holder, r.bank.account, r.bank.ifsc, r.bank.bankName, r.bank.upi, r.bank.pan, data.month, r.gross, r.tds, r.net, r.phone]);
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `partner-payouts-${data.month}.csv`;
    a.click();
  };

  const btn = 'text-[12px] font-bold px-3 py-1.5 rounded-lg';
  const box = { border: '1px solid var(--border)' };
  if (!data) return <p style={{ color: 'var(--soft)' }}>{error || 'Loading…'}</p>;
  const toPay = data.rows.filter(r => !r.payout && r.detailsComplete);
  const held = data.rows.filter(r => !r.payout && !r.detailsComplete);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>Sales month
          <input type="month" value={month} onChange={e => { setMonth(e.target.value); load(e.target.value); }}
            className="block mt-1 rounded-lg px-3 py-1.5 text-[13px]" style={{ ...box, background: 'transparent', color: 'var(--ink)' }} /></label>
        <label className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>TDS %
          <span className="flex gap-1 mt-1">
            <input value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" className="w-16 rounded-lg px-3 py-1.5 text-[13px]" style={{ ...box, background: 'transparent', color: 'var(--ink)' }} />
            <button className={btn} style={box} onClick={() => call('PUT', { tdsRate: Number(rate) })}>Save</button>
          </span></label>
        <button className={`${btn} ml-auto`} style={{ background: 'var(--ink)', color: 'var(--dim)' }} onClick={download} disabled={!toPay.length}>Download payout sheet ({toPay.length})</button>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-4 text-[13px]">
        {[
          ['To pay', inr(toPay.reduce((a, r) => a + r.net, 0)), `${toPay.length} partner(s)`],
          ['TDS to deposit', inr(data.rows.reduce((a, r) => a + (r.payout ? r.payout.tds : r.tds), 0)), `at ${data.tdsRate}%`],
          ['Held (details missing)', inr(held.reduce((a, r) => a + r.net, 0)), `${held.length} partner(s)`],
          ['Already paid', inr(data.rows.filter(r => r.payout).reduce((a, r) => a + (r.payout?.net || 0), 0)), `${data.rows.filter(r => r.payout).length} partner(s)`],
        ].map(([l, v, s]) => (
          <div key={l} className="rounded-xl p-3" style={box}>
            <div style={{ color: 'var(--soft)' }}>{l}</div>
            <div className="font-black text-[18px]">{v}</div>
            <div className="text-[11.5px]" style={{ color: 'var(--soft)' }}>{s}</div>
          </div>
        ))}
      </div>

      {!data.payable && (
        <div className="rounded-xl p-3 mb-4 text-[13px]" style={{ border: '1px solid rgba(245,158,11,.4)', color: '#b45309' }}>
          {monthName(data.month)} sales are still inside the 7-day refund window, so they can't be marked paid yet.
        </div>
      )}
      {error && <div className="rounded-xl p-3 mb-4 text-[13px]" style={{ color: '#dc2626', border: '1px solid rgba(239,68,68,.3)' }}>{error}</div>}

      {data.rows.length === 0 ? <p className="text-[14px]" style={{ color: 'var(--soft)' }}>No partner earnings in {monthName(data.month)}.</p> : (
        <div className="space-y-3">
          {data.rows.map(r => (
            <div key={r.partnerId} className="rounded-2xl p-4" style={box}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-black text-[15px]">{r.name} <span className="text-[12px] font-bold" style={{ color: 'var(--soft)' }}>{r.code} · +91 {r.phone}</span></div>
                  <div className="text-[12.5px]" style={{ color: 'var(--soft)' }}>
                    {r.sales} sales · commission {inr(r.commission)}{r.bonus ? ` + bonus ${inr(r.bonus)}` : ''} = {inr(r.gross)} − TDS {inr(r.tds)} = <b style={{ color: 'var(--ink)' }}>{inr(r.net)}</b>
                  </div>
                  <div className="text-[12.5px] mt-1 font-mono" style={{ color: 'var(--ink)' }}>
                    {r.bank.account ? `${r.bank.holder} · A/c ${r.bank.account} · ${r.bank.ifsc}${r.bank.bankName ? ` · ${r.bank.bankName}` : ''}${r.bank.upi ? ` · UPI ${r.bank.upi}` : ''} · PAN ${r.bank.pan}` : 'No bank details yet'}
                  </div>
                </div>
                <div className="text-right">
                  {r.payout ? (
                    <span className="text-[12px] font-black px-2.5 py-1 rounded-full" style={{ background: 'rgba(22,163,74,.12)', color: '#16a34a' }}>Paid {r.payout.paid_on} · UTR {r.payout.utr}</span>
                  ) : !r.detailsComplete ? (
                    <span className="text-[12px] font-black px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,.12)', color: '#b45309' }}>Held: bank/PAN/photo missing</span>
                  ) : (
                    <div className="flex flex-col items-end gap-1.5">
                      {!r.detailsChecked && <span className="text-[11.5px] font-bold" style={{ color: '#b45309' }}>Check PAN photo first (Partners tab)</span>}
                      {paying === r.partnerId ? (
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          <input value={utr} onChange={e => setUtr(e.target.value)} placeholder="Bank UTR" className="rounded-lg px-2.5 py-1.5 text-[12.5px] w-40" style={{ ...box, background: 'transparent', color: 'var(--ink)' }} />
                          <input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-[12.5px]" style={{ ...box, background: 'transparent', color: 'var(--ink)' }} />
                          <button className={btn} style={{ background: '#16a34a', color: '#fff' }}
                            onClick={async () => { if (await call('POST', { partnerId: r.partnerId, month: data.month, utr, paidOn })) { setPaying(null); setUtr(''); } }}>Save</button>
                          <button className={btn} style={box} onClick={() => setPaying(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className={btn} style={{ background: '#16a34a', color: '#fff', opacity: data.payable ? 1 : 0.5 }} disabled={!data.payable} onClick={() => { setPaying(r.partnerId); setUtr(''); }}>Mark paid</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[12px] mt-4" style={{ color: 'var(--soft)' }}>
        Pay from your bank using the downloaded sheet, then mark each partner paid with the bank's UTR. Deposit the TDS and file it as your CA advises.
      </p>
    </div>
  );
}
