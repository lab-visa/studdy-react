/**
 * geo.ts — shared IP → Region detection.
 *
 * Used by both the homepage Pricing section and the Checkout page so the
 * "what country/currency do I show first" logic lives in exactly one
 * place. If the lookup fails, times out, or returns a country we don't
 * have a mapping for, we default to United States / USD — this is a
 * locked decision (Vish, Aug 2026), not a guess.
 */
import { COUNTRY_TO_REGION, type Region } from '../data/config';

export async function detectRegion(): Promise<Region> {
  try {
    const res  = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return COUNTRY_TO_REGION[data?.country_code as string] ?? 'us';
  } catch {
    return 'us';
  }
}
