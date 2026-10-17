/**
 * geo.ts - shared IP → Region detection.
 *
 * Oct 2026: asks our own /api/geo first (Vercel's built-in country header -
 * fast, no third party, no rate limit), and only falls back to the free
 * ipapi.co lookup if that returns nothing (e.g. local development). If
 * both fail, or the country isn't one we have a mapping for, we default to
 * United States / USD - a locked decision (Vish, Aug 2026), not a guess.
 *
 * The result is cached for the page's lifetime, so every section that asks
 * gets the same answer from a single network call.
 */
import { COUNTRY_TO_REGION, type Region } from '../data/config';

async function lookupCountry(): Promise<string | null> {
  try {
    const res = await fetch('/api/geo');
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.country === 'string') return data.country;
    }
  } catch {
    /* fall through to the third-party lookup */
  }
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return typeof data?.country_code === 'string' ? data.country_code : null;
  } catch {
    return null;
  }
}

let cached: Promise<Region> | null = null;

export function detectRegion(): Promise<Region> {
  if (!cached) {
    cached = lookupCountry().then(code => (code && COUNTRY_TO_REGION[code]) || 'us');
  }
  return cached;
}
