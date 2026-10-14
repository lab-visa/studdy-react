/**
 * Sales partner programme — commission rules and calculations.
 *
 * Rules (Oct 2026, Vish):
 *   - Commission per sale: Yearly ₹2,500, Quarterly ₹1,500.
 *   - Monthly bonus (per calendar month, India time, by payment date):
 *       10+ sales → +₹5,000;  20+ sales → +₹10,000 more (₹15,000 total).
 *   - A sale becomes PAYABLE once its 7-day refund window has passed.
 *     A refunded sale earns nothing.
 *   - Payouts weekly; TDS deducted as per law (handled when paying).
 * Change the numbers here and every page and statement follows.
 */
import { randomBytes } from 'node:crypto';

export const COMMISSION = { yearly: 2500, quarterly: 1500 };
export const MONTHLY_BONUS = [
  { sales: 10, amount: 5000 },
  { sales: 20, amount: 10000 },
];
export const REFUND_WINDOW_DAYS = 7;

/** "2026-10" for a date, in India time. */
export function istMonth(date) {
  const d = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 7);
}

export function bonusFor(salesInMonth) {
  return MONTHLY_BONUS.filter((b) => salesInMonth >= b.sales).reduce((s, b) => s + b.amount, 0);
}

/**
 * orders: india_orders rows for ONE partner (status paid or refunded).
 * Returns per-sale lines and a per-month summary. Pure — no database.
 */
export function computeEarnings(orders, now = new Date()) {
  const windowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const sales = orders
    .filter((o) => o.paid_at && (o.status === 'paid' || o.status === 'refunded'))
    .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
    .map((o) => {
      const refunded = o.status === 'refunded';
      const clearsAt = new Date(new Date(o.paid_at).getTime() + windowMs);
      const state = refunded ? 'refunded' : clearsAt <= now ? 'payable' : 'in_refund_window';
      return {
        order_id: o.order_id,
        paid_at: o.paid_at,
        month: istMonth(o.paid_at),
        plan: o.plan,
        amount: Number(o.amount),
        customer: maskCustomer(o.customer_name, o.customer_phone),
        commission: refunded ? 0 : COMMISSION[o.plan] ?? 0,
        state,
        clears_at: clearsAt.toISOString(),
      };
    });

  const byMonth = new Map();
  for (const s of sales) {
    const m = byMonth.get(s.month) || { month: s.month, sales: 0, refunded: 0, commission: 0, payable: 0, pending: 0 };
    if (s.state === 'refunded') m.refunded += 1;
    else {
      m.sales += 1;
      m.commission += s.commission;
      if (s.state === 'payable') m.payable += s.commission;
      else m.pending += s.commission;
    }
    byMonth.set(s.month, m);
  }
  const months = [...byMonth.values()]
    .map((m) => ({ ...m, bonus: bonusFor(m.sales), total: m.commission + bonusFor(m.sales) }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  const totals = months.reduce(
    (t, m) => ({
      sales: t.sales + m.sales,
      earned: t.earned + m.total,
      payable: t.payable + m.payable,
      pending: t.pending + m.pending,
      bonus: t.bonus + m.bonus,
    }),
    { sales: 0, earned: 0, payable: 0, pending: 0, bonus: 0 }
  );
  return { sales, months, totals };
}

/** Partners see who bought, but not full personal details: "Asha P. · ••••3210". */
export function maskCustomer(name, phone) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const label = parts.length ? parts[0] + (parts[1] ? ` ${parts[1][0]}.` : '') : 'Customer';
  const last4 = String(phone || '').slice(-4);
  return last4 ? `${label} · ••••${last4}` : label;
}

/** Referral code from the partner's first name + 3 digits, e.g. "ASHA482". */
export function makePartnerCode(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const base = first.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'PARTNER';
  const digits = String(100 + (randomBytes(2).readUInt16BE(0) % 900));
  return base + digits;
}

export function newDashboardToken() {
  return randomBytes(24).toString('hex'); // 48 hex chars
}
