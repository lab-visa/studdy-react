/**
 * CRM-2B (visual refinement) — one small gross/refund/net comparison
 * chart PER CURRENCY. Bars are scaled relative to that currency's own
 * gross amount only — never compared against another currency's bars,
 * and never summed into a cross-currency total. Each currency gets its
 * own isolated <CurrencyCompareBars> instance; RevenueOverview renders
 * one per currency present in the response.
 */
import { formatCurrencyAmount } from '../../../utils/metricsFormat';

interface CurrencyCompareBarsProps {
  currency: string;
  gross: number;
  refund: number;
  net: number;
}

export default function CurrencyCompareBars({ currency, gross, refund, net }: CurrencyCompareBarsProps) {
  // Scaled against this currency's own gross figure only — refund/net
  // are fractions of THIS currency's gross, never another currency's.
  const scale = Math.max(gross, net, 1);
  const rows: Array<{ label: string; value: number; tone: 'gradient' | 'neutral' }> = [
    { label: 'Gross', value: gross, tone: 'gradient' },
    { label: 'Refunds', value: refund, tone: 'neutral' },
    { label: 'Net', value: net, tone: 'gradient' },
  ];

  return (
    <div
      role="img"
      aria-label={`${currency} revenue for the selected period: gross ${formatCurrencyAmount(gross, currency)}, refunds ${formatCurrencyAmount(refund, currency)}, net ${formatCurrencyAmount(net, currency)}`}
      className="rounded-xl p-3.5"
      style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}
    >
      <div className="text-[11px] font-black uppercase tracking-wide mb-2.5" style={{ color: 'var(--soft)' }}>
        {currency}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] font-bold" style={{ color: 'var(--ink)' }}>
                {row.label}
              </span>
              <span className="text-[12.5px] font-black" style={{ color: 'var(--ink)' }}>
                {formatCurrencyAmount(row.value, currency)}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(row.value > 0 ? 3 : 0, (Math.abs(row.value) / scale) * 100))}%`,
                  background: row.tone === 'gradient' ? 'var(--grad)' : 'var(--border)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
