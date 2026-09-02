/**
 * CRM-2B — Section 3: payment & revenue overview, always by ORIGINAL
 * currency — gross, refunds and net are three separate CurrencyBreakdown
 * blocks, never summed into one number. Visual refinement: one small
 * gross/refund/net comparison chart PER CURRENCY (CurrencyCompareBars) —
 * never a pie chart, and never a cross-currency total, per the CRM-2B
 * visual-refinement brief.
 */
import SectionCard from '../SectionCard';
import CurrencyBreakdown from '../CurrencyBreakdown';
import CurrencyCompareBars from '../charts/CurrencyCompareBars';
import { unionCurrencyCodes } from '../../../utils/metricsFormat';
import type { AdminMetrics } from '../../../types/adminMetrics';

interface RevenueOverviewProps {
  metrics: AdminMetrics;
}

export default function RevenueOverview({ metrics }: RevenueOverviewProps) {
  const gross = metrics.gross_revenue.by_currency;
  const refund = metrics.refund_amount.by_currency;
  const net = metrics.net_revenue.by_currency;
  const currencies = unionCurrencyCodes(gross, refund, net);

  return (
    <SectionCard
      title="Payments & revenue"
      description="By original transaction currency for the selected period — currencies are never combined"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>
            Gross revenue
          </div>
          <CurrencyBreakdown byCurrency={gross} />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>
            Refunds
          </div>
          <CurrencyBreakdown byCurrency={refund} emptyLabel="No refunds in this period" />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: 'var(--soft)' }}>
            Net revenue
          </div>
          <CurrencyBreakdown byCurrency={net} />
        </div>
      </div>

      {currencies.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currencies.map((code) => (
            <CurrencyCompareBars
              key={code}
              currency={code}
              gross={gross?.[code] ?? 0}
              refund={refund?.[code] ?? 0}
              net={net?.[code] ?? 0}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
