/**
 * CRM-2B — renders a by_currency object (gross/refund/net revenue) as one
 * line per currency. Never sums across currencies — that would blend
 * USD/GBP/INR/AED into a meaningless number, which api/_lib/metrics.js
 * deliberately never does either.
 */
import { formatCurrencyAmount, sortedCurrencyEntries, hasNoCurrencyData } from '../../utils/metricsFormat';

interface CurrencyBreakdownProps {
  byCurrency: Record<string, number> | null | undefined;
  emptyLabel?: string;
}

export default function CurrencyBreakdown({ byCurrency, emptyLabel = 'No amounts in this period' }: CurrencyBreakdownProps) {
  if (hasNoCurrencyData(byCurrency)) {
    return <div className="text-[13px] font-medium" style={{ color: 'var(--soft)' }}>{emptyLabel}</div>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {sortedCurrencyEntries(byCurrency).map(([currency, amount]) => (
        <li key={currency} className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>
            {currency}
          </span>
          <span className="font-black text-[16px]" style={{ color: 'var(--ink)' }}>
            {formatCurrencyAmount(amount, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}
