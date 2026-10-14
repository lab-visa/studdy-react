/**
 * Sales partner programme — commission rules and calculations.
 *
 * Rules (Oct 2026, Vish):
 *   - Commission per sale: Yearly ₹2,500, Quarterly ₹700.
 *   - Monthly bonus (per calendar month, India time, by payment date):
 *       10+ sales → +₹5,000;  20+ sales → +₹10,000 more (₹15,000 total).
 *   - A sale becomes PAYABLE once its 7-day refund window has passed.
 *     A refunded sale earns nothing.
 *   - Payouts on the 10th of every month, for the previous month's
 *     sales (all of which are past the refund window by then). TDS is
 *     deducted as per law when paying.
 * Change the numbers here and every page and statement follows.
 */
import { randomBytes } from 'node:crypto';

export const COMMISSION = { yearly: 2500, quarterly: 700 };
export const PAYOUT_DAY = 10;
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
        payout_on: payoutDate(o.paid_at),
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

/** Sales of month M are paid on the 10th of month M+1 (India dates). */
export function payoutDate(paidAt) {
  const [y, m] = istMonth(paidAt).split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-${String(PAYOUT_DAY).padStart(2, '0')}`;
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


/* ---------- PIN, bank details, payouts (Oct 2026, round 2) ---------- */

export const PIN_RE = /^[0-9]{6}$/;
export const PIN_LOCK_THRESHOLD = 5;
export const PIN_LOCK_MINUTES = 15;
export const DEFAULT_TDS_PERCENT = 10;

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^[0-9]{9,18}$/;
const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Validates the bank form. Returns { error } or { value } with cleaned
 * fields ready to save. Account number + IFSC + holder name + bank name
 * are required; UPI is optional; PAN is required (needed for TDS).
 */
export function cleanBankDetails(b = {}) {
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const holder = str(b.accountName, 100);
  const number = str(b.accountNumber, 30).replace(/\s/g, '');
  const ifsc = str(b.ifsc, 20).toUpperCase();
  const bank = str(b.bankName, 100);
  const upi = str(b.upi, 100);
  const pan = str(b.pan, 10).toUpperCase();
  if (holder.length < 2) return { error: 'Enter the account holder name as it appears in the bank.' };
  if (!ACCOUNT_RE.test(number)) return { error: 'Account number should be 9 to 18 digits.' };
  if (b.accountNumberConfirm !== undefined && str(b.accountNumberConfirm, 30).replace(/\s/g, '') !== number) {
    return { error: 'The two account numbers do not match.' };
  }
  if (!IFSC_RE.test(ifsc)) return { error: 'IFSC code looks wrong (11 characters, e.g. SBIN0001234).' };
  if (bank.length < 2) return { error: 'Enter your bank name.' };
  if (upi && !UPI_RE.test(upi)) return { error: 'UPI ID looks wrong (e.g. name@okaxis).' };
  if (!PAN_RE.test(pan)) return { error: 'PAN looks wrong (e.g. ABCDE1234F). It is needed for TDS.' };
  return { value: { bank_account_name: holder, bank_account_number: number, bank_ifsc: ifsc, bank_name: bank, payout_upi: upi || null, pan } };
}

export const maskAccount = (n) => (n ? `••••${String(n).slice(-4)}` : null);

/** Gross → TDS (rounded to the rupee) → net. */
export function tdsSplit(gross, tdsPercent = DEFAULT_TDS_PERCENT) {
  const g = Math.max(0, Math.round(Number(gross) || 0));
  const pct = Number(tdsPercent);
  const tds = Math.round((g * pct) / 100);
  return { gross: g, tds_percent: pct, tds, net: g - tds };
}

/** Attach payout rows to the months list (by sales month). */
export function withPayouts(months, payouts = []) {
  const byMonth = new Map(payouts.map((p) => [p.month, p]));
  return months.map((m) => {
    const p = byMonth.get(m.month);
    return p ? { ...m, payout: { gross: p.gross, tds_percent: Number(p.tds_percent), tds: p.tds, net: p.net, paid_on: p.paid_on, reference: p.reference } } : { ...m, payout: null };
  });
}
