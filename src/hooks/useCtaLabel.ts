import { useMarket } from '../context/MarketContext';
import { INDIA_CTA_LABEL } from '../data/india';

/** Main call-to-action wording: "Get Started" for India (pay first,
 *  7-day refund), "Start Free Trial" everywhere else. */
export function useCtaLabel(): string {
  const { isIndia } = useMarket();
  return isIndia ? INDIA_CTA_LABEL : 'Start Free Trial';
}
