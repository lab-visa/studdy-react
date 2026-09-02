/**
 * CRM-2B — a single KPI stat tile. Deliberately plain: one number, one
 * label, one small "what kind of number is this" badge — no decorative
 * numbers without business meaning, no fake sparkline.
 */
import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** 'event_period' shows the active date-range badge; 'current_state' shows "Live". */
  kind: 'event_period' | 'current_state' | 'cohort';
  hint?: string;
  tone?: 'default' | 'warning';
}

export default function KpiCard({ label, value, kind, hint, tone = 'default' }: KpiCardProps) {
  const badge =
    kind === 'current_state' ? 'Live' : kind === 'cohort' ? 'Cohort' : 'Selected period';

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{
        background: '#fff',
        border: tone === 'warning' ? '1.5px solid rgba(239,85,182,.35)' : '1px solid var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-bold" style={{ color: 'var(--soft)' }}>
          {label}
        </span>
        <span
          className="text-[9.5px] font-black uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0"
          style={{ background: 'var(--dim)', color: 'var(--soft)', border: '1px solid var(--border)' }}
        >
          {badge}
        </span>
      </div>
      <div className="font-black text-[26px] leading-none" style={{ color: 'var(--ink)' }}>
        {value}
      </div>
      {hint && (
        <div className="text-[11.5px] font-medium" style={{ color: 'var(--soft)' }}>
          {hint}
        </div>
      )}
    </div>
  );
}
