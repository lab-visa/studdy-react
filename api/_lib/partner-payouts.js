/**
 * Partner payout + KYC details (bank, UPI, PAN + PAN photo, masked Aadhaar
 * front/back + last 4 digits) and payout maths. The full 12-digit Aadhaar
 * number is never stored. Document photos live in the PRIVATE
 * 'partner-docs' storage bucket and are only shown to the admin through
 * short-lived signed links.
 */
import { istMonth, REFUND_WINDOW_DAYS } from './partners.js';

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.]{1,40}$/;
export const ACCOUNT_RE = /^\d{9,18}$/;
export const DOCS_BUCKET = 'partner-docs';
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const DEFAULT_TDS_RATE = 10;

/** Document photos a partner uploads → the column that holds each one's storage path. */
export const DOC_KINDS = { pan: 'pan_photo_path', aadhaar_front: 'aadhaar_front_path', aadhaar_back: 'aadhaar_back_path' };
export const DOC_LABELS = { pan: 'PAN card', aadhaar_front: 'Aadhaar front', aadhaar_back: 'Aadhaar back' };

const clip = (v, n) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n) : '');

/** Validates the partner's form. Returns { error } or { fields } ready to save. */
export function validatePayoutDetails(b = {}) {
  const holder = clip(b.holder, 100);
  const account = String(b.account ?? '').replace(/\s/g, '');
  const account2 = String(b.account2 ?? '').replace(/\s/g, '');
  const ifsc = String(b.ifsc ?? '').trim().toUpperCase();
  const upi = clip(b.upi, 100).replace(/\s/g, '');
  const pan = String(b.pan ?? '').trim().toUpperCase();
  const aadhaarLast4 = String(b.aadhaarLast4 ?? '').replace(/\D/g, '');

  if (holder.length < 3) return { error: 'Please enter the account holder name exactly as in your bank.' };
  if (!ACCOUNT_RE.test(account)) return { error: 'Account number should be 9 to 18 digits.' };
  if (account !== account2) return { error: 'The two account numbers don’t match.' };
  if (!IFSC_RE.test(ifsc)) return { error: 'IFSC looks wrong. It has 11 characters, like SBIN0001234.' };
  if (upi && !UPI_RE.test(upi)) return { error: 'UPI ID looks wrong. It looks like name@bank.' };
  if (!PAN_RE.test(pan)) return { error: 'PAN looks wrong. It has 10 characters, like ABCDE1234F.' };
  if (!/^\d{4}$/.test(aadhaarLast4)) return { error: 'Enter only the LAST 4 digits of your Aadhaar number.' };
  if (b.aadhaarConsent !== true) return { error: 'Please tick the Aadhaar consent box to continue.' };

  return {
    fields: {
      bank_holder: holder, bank_account: account, bank_ifsc: ifsc,
      bank_name: clip(b.bankName, 100) || null, bank_branch: clip(b.branch, 120) || null,
      payout_upi: upi || null, pan, aadhaar_last4: aadhaarLast4,
    },
  };
}

export const maskAccount = (a) => (a ? `••••${String(a).slice(-4)}` : null);
export const maskPan = (p) => (p ? `${p.slice(0, 2)}•••••${p.slice(7)}` : null);

/** Ready to be paid = bank account + IFSC + PAN + PAN photo + Aadhaar (last 4, consent, front + back). */
export const detailsComplete = (p) => Boolean(
  p.bank_account && p.bank_ifsc && p.bank_holder && p.pan && p.pan_photo_path
  && p.aadhaar_last4 && p.aadhaar_consent_at && p.aadhaar_front_path && p.aadhaar_back_path,
);

/** What the partner sees about their own details (masked). */
export function publicDetails(p) {
  return {
    complete: detailsComplete(p),
    holder: p.bank_holder || null,
    account: maskAccount(p.bank_account),
    ifsc: p.bank_ifsc || null,
    bankName: p.bank_name || null,
    branch: p.bank_branch || null,
    upi: p.payout_upi || null,
    pan: maskPan(p.pan),
    hasPanPhoto: Boolean(p.pan_photo_path),
    aadhaar: p.aadhaar_last4 ? `XXXX XXXX ${p.aadhaar_last4}` : null,
    hasAadhaarFront: Boolean(p.aadhaar_front_path),
    hasAadhaarBack: Boolean(p.aadhaar_back_path),
    updatedAt: p.payout_details_updated_at || null,
  };
}

export function tdsFor(gross, rate) {
  return Math.round((gross * Number(rate)) / 100);
}

/** A sales month can be paid once every sale in it is past the refund window. */
export function monthIsPayable(month, now = new Date()) {
  const [y, m] = month.split('-').map(Number);
  const firstOfNext = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - 5.5 * 3600 * 1000; // 00:00 IST
  return now.getTime() >= firstOfNext + REFUND_WINDOW_DAYS * 86400 * 1000;
}

export function previousMonth(now = new Date()) {
  const [y, m] = istMonth(now).split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export async function getTdsRate(supabase) {
  const { data } = await supabase.from('settings').select('value').eq('key', 'partner_tds_rate').maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : DEFAULT_TDS_RATE;
}

/** Decodes a data: URL image. Returns { buffer, type, ext } or { error }. */
export function decodePhoto(dataUrl) {
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'Please upload a photo (JPG or PNG).' };
  const buffer = Buffer.from(m[3], 'base64');
  if (buffer.length < 2000) return { error: 'That photo looks empty. Please try again.' };
  if (buffer.length > MAX_PHOTO_BYTES) return { error: 'That photo is too large. Please use one under 4 MB.' };
  const sig = buffer.subarray(0, 4).toString('hex');
  const ok = (m[2] === 'jpeg' && sig.startsWith('ffd8')) || (m[2] === 'png' && sig === '89504e47') || (m[2] === 'webp' && buffer.subarray(8, 12).toString() === 'WEBP');
  if (!ok) return { error: 'That file is not a valid photo.' };
  return { buffer, type: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2] };
}

export const storageOf = (supabase, deps = {}) => (deps.storage || supabase.storage).from(DOCS_BUCKET);
