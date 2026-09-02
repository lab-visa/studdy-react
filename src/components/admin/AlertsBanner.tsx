/**
 * CRM-2B — operational alerts. Every alert here is derived directly from
 * an already-fetched, truthful metric value — nothing is invented, no
 * threshold beyond "this number is non-zero / at its limit".
 */
import { AlertTriangle } from 'lucide-react';
import type { AdminMetrics } from '../../types/adminMetrics';

interface AlertsBannerProps {
  metrics: AdminMetrics;
}

export default function AlertsBanner({ metrics }: AlertsBannerProps) {
  const alerts: string[] = [];

  if (metrics.open_dispute.count > 0) {
    alerts.push(
      `${metrics.open_dispute.count} open payment dispute${metrics.open_dispute.count === 1 ? '' : 's'} need${metrics.open_dispute.count === 1 ? 's' : ''} attention.`
    );
  }
  // total_capacity === 0 means no Studdy account groups exist yet — that's
  // an empty-state, not "full". Only a group with real configured capacity
  // that's actually exhausted counts as an alert.
  if (metrics.allocated_seats.total_capacity > 0) {
    if (metrics.allocated_seats.remaining_capacity <= 0) {
      alerts.push('Studdy account capacity is full — no remaining seats across any group.');
    } else if (metrics.allocated_seats.remaining_capacity / metrics.allocated_seats.total_capacity < 0.1) {
      alerts.push('Studdy account capacity is nearly full (under 10% remaining).');
    }
  }

  if (alerts.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-2xl px-4 py-3 flex flex-col gap-1.5"
      style={{ background: 'rgba(239,85,182,.06)', border: '1px solid rgba(239,85,182,.25)' }}
    >
      {alerts.map((a) => (
        <div key={a} className="flex items-start gap-2 text-[13px] font-semibold" style={{ color: '#c4278c' }}>
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {a}
        </div>
      ))}
    </div>
  );
}
