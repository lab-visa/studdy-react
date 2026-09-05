/**
 * CRM-3A — client-side campaign-attribution capture.
 *
 * Deliberately separate from tracking.ts's lead-id/campaign-code capture
 * (which feeds the anonymous site_traffic_daily counters and the Stripe
 * Payment Link's own utm_source/utm_campaign params) — this module's job
 * is to build the FULL first-touch/latest-touch attribution snapshot
 * (all five UTM fields + GHL identifiers, once GHL supplies them) that
 * gets sent to /api/track-attribution at the "Start Free Trial" click
 * (see Checkout.tsx), never on a mere page visit.
 *
 * Capture rule, mirroring tracking.ts's existing "capture once, persist
 * forever" pattern for campaign code:
 *   - A URL carrying no utm_* or ghl_* param at all is a no-op — whatever
 *     was already persisted (if anything) is left exactly as-is, so
 *     browsing the site after arriving via a tagged link never erases
 *     captured attribution ("existing links without UTMs must continue
 *     working").
 *   - A URL carrying at least one tracked param ALWAYS refreshes the
 *     persisted "latest touch" (a real, later-arriving campaign context
 *     legitimately supersedes an earlier one).
 *   - "First touch" is seeded from that same snapshot only the very
 *     first time this browser ever sees one, and is never touched again
 *     after that by this module.
 * Nothing here talks to the network — see Checkout.tsx for where the
 * persisted snapshot is actually sent, and only then.
 */

const FIRST_TOUCH_KEY = 'sl_first_touch';
const LATEST_TOUCH_KEY = 'sl_latest_touch';

export interface AttributionTouch {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  ghlContactId: string | null;
  ghlCampaignId: string | null;
  landingUrl: string | null;
  touchedAt: string;
}

function readStoredTouch(key: string): AttributionTouch | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as AttributionTouch) : null;
  } catch {
    return null;
  }
}

function writeStoredTouch(key: string, touch: AttributionTouch) {
  try {
    localStorage.setItem(key, JSON.stringify(touch));
  } catch {
    /* ignore — private browsing etc. */
  }
}

/**
 * Pure: reads utm_* and ghl_* params from a URLSearchParams-compatible search
 * string. Returns null when none of the tracked params are present — a
 * plain/untagged URL carries no attribution signal to capture.
 */
export function parseTouchFromSearch(search: string, pathname: string, touchedAt: string): AttributionTouch | null {
  const p = new URLSearchParams(search);
  const utmSource = p.get('utm_source');
  const utmMedium = p.get('utm_medium');
  const utmCampaign = p.get('utm_campaign');
  const utmContent = p.get('utm_content');
  const utmTerm = p.get('utm_term');
  const ghlContactId = p.get('ghl_contact_id');
  const ghlCampaignId = p.get('ghl_campaign_id');

  const hasAny = [utmSource, utmMedium, utmCampaign, utmContent, utmTerm, ghlContactId, ghlCampaignId].some(
    (v) => v !== null && v !== ''
  );
  if (!hasAny) return null;

  return {
    utmSource: utmSource || null,
    utmMedium: utmMedium || null,
    utmCampaign: utmCampaign || null,
    utmContent: utmContent || null,
    utmTerm: utmTerm || null,
    ghlContactId: ghlContactId || null,
    ghlCampaignId: ghlCampaignId || null,
    landingUrl: pathname || null,
    touchedAt,
  };
}

/**
 * Call once per page load (see App.tsx). Purely local — never touches the
 * network or creates any database row by itself.
 */
export function captureAttributionTouch(now: Date = new Date()): void {
  if (typeof window === 'undefined') return;
  const touch = parseTouchFromSearch(window.location.search, window.location.pathname, now.toISOString());
  if (!touch) return;

  writeStoredTouch(LATEST_TOUCH_KEY, touch);
  if (!readStoredTouch(FIRST_TOUCH_KEY)) {
    writeStoredTouch(FIRST_TOUCH_KEY, touch);
  }
}

/**
 * Whatever has been persisted so far. Both may be null if this visitor
 * has never arrived via a tagged link — the caller (Checkout.tsx) skips
 * sending anything to the backend in that case, exactly like
 * getCampaignCode() returning null degrades to 'none' today.
 */
export function getAttributionSnapshot(): { first: AttributionTouch | null; latest: AttributionTouch | null } {
  return {
    first: readStoredTouch(FIRST_TOUCH_KEY),
    latest: readStoredTouch(LATEST_TOUCH_KEY),
  };
}
