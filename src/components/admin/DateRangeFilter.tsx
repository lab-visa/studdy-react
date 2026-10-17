/**
 * Today / Yesterday / This month / Last month / Custom (+ optional All time),
 * in India dates. Reports { from, to } as YYYY-MM-DD.
 */
import { useEffect, useState } from 'react';

export type RangePreset = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'all' | 'custom';
export interface DateRange { preset: RangePreset; from: string; to: string }

export const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const shift = (ymd: string, days: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const monthStart = (ymd: string, offset = 0) => { const [y, m] = ymd.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + offset, 1)); return d.toISOString().slice(0, 10); };
const monthEnd = (ymd: string, offset = 0) => { const [y, m] = ymd.split('-').map(Number); const d = new Date(Date.UTC(y, m + offset, 0)); return d.toISOString().slice(0, 10); };

export function rangeFor(preset: RangePreset, custom?: { from: string; to: string }): DateRange {
  const t = istToday();
  switch (preset) {
    case 'today': return { preset, from: t, to: t };
    case 'yesterday': return { preset, from: shift(t, -1), to: shift(t, -1) };
    case 'this_month': return { preset, from: monthStart(t), to: t };
    case 'last_month': return { preset, from: monthStart(t, -1), to: monthEnd(t, -1) };
    case 'all': return { preset, from: '2026-01-01', to: t };
    default: return { preset: 'custom', from: custom?.from || monthStart(t), to: custom?.to || t };
  }
}

const LABELS: Record<RangePreset, string> = { today: 'Today', yesterday: 'Yesterday', this_month: 'This month', last_month: 'Last month', all: 'All time', custom: 'Custom' };

export default function DateRangeFilter({ value, onChange, allowAll = false }: { value: DateRange; onChange: (r: DateRange) => void; allowAll?: boolean }) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  useEffect(() => { setFrom(value.from); setTo(value.to); }, [value.from, value.to]);
  const presets: RangePreset[] = ['today', 'yesterday', 'this_month', 'last_month', ...(allowAll ? ['all' as const] : []), 'custom'];
  const btn = 'text-[12px] font-bold px-3 py-1.5 rounded-lg';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button key={p} onClick={() => onChange(rangeFor(p, { from, to }))} className={btn}
          style={{ background: value.preset === p ? 'var(--ink)' : 'transparent', color: value.preset === p ? 'var(--dim)' : 'var(--soft)', border: '1px solid var(--border)' }}>
          {LABELS[p]}
        </button>
      ))}
      {value.preset === 'custom' && (
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--soft)' }}>
          <input type="date" value={from} max={to} onChange={e => { setFrom(e.target.value); onChange({ preset: 'custom', from: e.target.value, to }); }}
            className="rounded-lg px-2 py-1" style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink)' }} />
          to
          <input type="date" value={to} min={from} onChange={e => { setTo(e.target.value); onChange({ preset: 'custom', from, to: e.target.value }); }}
            className="rounded-lg px-2 py-1" style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink)' }} />
        </span>
      )}
    </div>
  );
}

export const inRange = (iso: string | null | undefined, r: DateRange) => {
  if (!iso) return false;
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return d >= r.from && d <= r.to;
};
