/**
 * India offer (Oct 2026, Vish): pay first, no free trial, 7-day full refund.
 * Two plans only - Quarterly and Yearly. Prices are GST-inclusive, what the
 * customer actually pays.
 *
 * Every other country is unchanged and still uses REGION_DATA in config.ts
 * (Stripe free trial).
 */
export const INDIA_REFUND_DAYS = 7;
export const INDIA_CTA_LABEL = 'Get Started';

export type IndiaPlan = 'quarterly' | 'yearly';

export const INDIA_PLANS: Record<IndiaPlan, {
  label: string;
  amount: number;          // ₹, GST-inclusive
  display: string;         // e.g. "₹7,999"
  period: string;          // e.g. "for 3 months"
  perMonth: string;        // effective monthly price, for comparison
  months: number;
}> = {
  quarterly: { label: 'Quarterly', amount: 7999,  display: '₹7,999',  period: 'for 3 months',  perMonth: '₹2,666/month', months: 3 },
  yearly:    { label: 'Yearly',    amount: 14999, display: '₹14,999', period: 'for 12 months', perMonth: '₹1,250/month', months: 12 },
};

/* Yearly vs paying quarterly for a full year: 4 × 7,999 = 31,996. */
export const INDIA_YEARLY_SAVING = '₹16,997';
export const INDIA_YEARLY_SAVING_PCT = '53%';

export const INDIA_TUTOR_PRICE = '₹1,500/hr';
