/**
 * Sales-partner referral code (?ref=CODE on any landing URL).
 * Captured once per browser and sent with an India order, so the sale can
 * be credited to the right partner. Letters, digits, '-' and '_' only.
 */
const KEY = 'sl_ref_code';

export function captureRefCode(): void {
  try {
    const raw = new URLSearchParams(window.location.search).get('ref');
    if (raw && /^[A-Za-z0-9_-]{2,40}$/.test(raw)) localStorage.setItem(KEY, raw.toUpperCase());
  } catch {
    /* private browsing etc. - referral capture must never break the site */
  }
}

export function getRefCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
