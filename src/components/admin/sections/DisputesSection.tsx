/**
 * CRM-2B — Section: open disputes / attention-needed. Current-state list
 * straight from open_dispute.items — no amount summed across currencies.
 */
import { AlertCircle } from 'lucide-react';
import SectionCard from '../SectionCard';
import { formatCurrencyAmount, formatIstTimestamp } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface DisputesSectionProps {
  metrics: AdminMetrics;
}

export default function DisputesSection({ metrics }: DisputesSectionProps) {
  const items = metrics.open_dispute.items;

  return (
    <SectionCard title="Open disputes" description="Needs attention — live snapshot, not affected by the selected date range">
      {items.length === 0 ? (
        <p className="text-[13px] font-medium" style={{ color: 'var(--soft)' }}>
          No open disputes right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((d) => (
            <li
              key={d.dispute_id ?? d.occurred_at}
              className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
              style={{ background: 'rgba(239,85,182,.06)', border: '1px solid rgba(239,85,182,.2)' }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <AlertCircle size={16} style={{ color: 'var(--g1)' }} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                    Customer {d.customer_id ?? 'unknown'}
                  </span>
                  <span className="block text-[11px] font-medium" style={{ color: 'var(--soft)' }}>
                    Opened {formatIstTimestamp(d.occurred_at)}
                  </span>
                </span>
              </span>
              <span className="font-black text-[14px] shrink-0" style={{ color: 'var(--ink)' }}>
                {d.amount !== null && d.currency ? formatCurrencyAmount(d.amount, d.currency) : 'Not available'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
