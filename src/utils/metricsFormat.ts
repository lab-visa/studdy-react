/**
 * CRM-2B — pure, JSX-free formatting helpers for the Command Center.
 *
 * Kept dependency-free and side-effect-free on purpose so it can be
 * exercised directly by node:test (see test/cases/admin-dashboard-logic.test.mjs),
 * the same pattern test/cases/campaign-client.test.mjs already established
 * for src/utils/checkoutLink.ts.
 */

/** Deterministic integer formatting — no locale surprises across renders. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return 'Not available';
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * Formats one currency's amount. Never blends currencies — always called
 * once per currency code, by the caller iterating a by_currency object.
 * Falls back to a plain "<amount> <CODE>" rendering for a currency code
 * Intl doesn't recognize (e.g. the metrics layer's own 'unknown' fallback
 * for a null/legacy currency value) rather than throwing.
 */
export function formatCurrencyAmount(amount: number, currencyCode: string): string {
  const code = (currencyCode || '').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)} ${code || 'UNKNOWN'}`;
  }
}

/** Sorted [currencyCode, amount] pairs — deterministic render order, not insertion order. */
export function sortedCurrencyEntries(byCurrency: Record<string, number> | null | undefined): Array<[string, number]> {
  if (!byCurrency) return [];
  return Object.entries(byCurrency).sort(([a], [b]) => a.localeCompare(b));
}

/** True when a by_currency object has no entries at all — the honest "no revenue in this period" case. */
export function hasNoCurrencyData(byCurrency: Record<string, number> | null | undefined): boolean {
  return sortedCurrencyEntries(byCurrency).length === 0;
}

/**
 * Every currency code appearing in ANY of gross/refund/net (sorted) —
 * used to render one per-currency comparison chart each. A currency
 * missing from one of the three objects means a real, literal 0 for
 * that metric in that currency (matching sumAmountByCurrency's own
 * semantics) — never fabricated, never silently dropped from the union.
 */
export function unionCurrencyCodes(...byCurrencyObjs: Array<Record<string, number> | null | undefined>): string[] {
  const codes = new Set<string>();
  for (const obj of byCurrencyObjs) {
    for (const code of Object.keys(obj ?? {})) codes.add(code);
  }
  return [...codes].sort((a, b) => a.localeCompare(b));
}

/**
 * A whole percentage with one decimal, or the honest "Not available"
 * placeholder — NEVER computed client-side from two counts (that would
 * fabricate a rate the backend deliberately does not calculate, e.g.
 * churn_rate). Only ever called on a value the API already computed
 * (trial_to_paid_14d.conversion_pct).
 */
export function formatPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'Not available';
  return `${pct.toFixed(1)}%`;
}

/** Formats an ISO instant as an IST wall-clock time, for "data as of" displays. */
export function formatIstTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Not available';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not available';
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d) + ' IST'
  );
}
