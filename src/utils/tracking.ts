/**
 * Lead tracking — talks to /api/track-event.
 *
 * As of Phase 3 (Aug 2026): /api/track-event no longer creates any
 * database row for a visitor — it only bumps an anonymous daily counter.
 * So the browser now owns its own tracking id from the very first moment,
 * instead of asking the server for one:
 *
 *  - If the link they arrived on has a WhatsApp/campaign tag (?lid= or
 *    ?source_lead_id=), that exact value becomes their tracking id — this
 *    is what lets a real conversion later be matched back to the right
 *    campaign, with zero database row needed before that happens.
 *  - Otherwise (organic/direct visit), the browser makes up a random id
 *    itself. Nothing about that id is ever sent anywhere or stored in the
 *    database unless and until they actually start a trial.
 *
 * Either way, this id is saved in this browser's localStorage and reused
 * for every later step (checkout page, "Start Free Trial" click), then
 * sent to Stripe as client_reference_id — exactly like before. The only
 * thing that changed is WHEN a database row appears: previously it was
 * the instant someone landed on the site; now it's the instant they
 * actually start a trial (handled by the Stripe webhook).
 *
 * CRM-2A addition — campaign IDENTITY, kept strictly separate from lead
 * IDENTITY above:
 *
 *  - `utm_campaign` (the canonical campaign tag StuddyLab already uses —
 *    see Checkout.tsx's pre-existing getUTM(), which previously only read
 *    it from the checkout page's own URL) is now ALSO captured at first
 *    landing, alongside the lead id, and persisted in its OWN localStorage
 *    key (sl_campaign_code) — never mixed into sl_lead_id.
 *  - This persisted value survives navigation the same way the lead id
 *    does, so it's no longer lost if a visitor lands on the home page
 *    with ?utm_campaign=... and then navigates to /checkout via an
 *    in-app link (the previous same-page-URL-only read in Checkout.tsx
 *    would have missed that).
 *  - Sent to /api/track-event as a `campaign` field on every trackEvent()
 *    call, forwarded from there into site_traffic_daily.campaign_code.
 *  - Absence of ?utm_campaign= anywhere still means 'none', identically
 *    to today — this is purely additive.
 *  - This does NOT create any CRM customer row, and does NOT touch
 *    ?lid=/?source_lead_id= or client_reference_id in any way.
 */

const LEAD_ID_KEY = 'sl_lead_id';
const CAMPAIGN_CODE_KEY = 'sl_campaign_code';

function getStoredLeadId(): string | null {
  try {
    return localStorage.getItem(LEAD_ID_KEY);
  } catch {
    return null;
  }
}

function storeLeadId(id: string) {
  try {
    localStorage.setItem(LEAD_ID_KEY, id);
  } catch {
    /* ignore — private browsing etc. */
  }
}

function getStoredCampaignCode(): string | null {
  try {
    return localStorage.getItem(CAMPAIGN_CODE_KEY);
  } catch {
    return null;
  }
}

function storeCampaignCode(code: string) {
  try {
    localStorage.setItem(CAMPAIGN_CODE_KEY, code);
  } catch {
    /* ignore — private browsing etc. */
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the manual fallback below */
  }
  // Fallback for older browsers without crypto.randomUUID
  return `sl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getUrlSourceLeadId(): string | undefined {
  const p = new URLSearchParams(window.location.search);
  return p.get('lid') ?? p.get('source_lead_id') ?? undefined;
}

/** Campaign IDENTITY only — deliberately a distinct URL param from lid/source_lead_id. */
function getUrlCampaignCode(): string | undefined {
  const p = new URLSearchParams(window.location.search);
  return p.get('utm_campaign') ?? undefined;
}

/**
 * Returns this browser's tracking id, creating one the first time it's
 * called: the WhatsApp/campaign tag from the URL if present, otherwise a
 * fresh random id. Purely local — never touches the database by itself.
 */
function ensureLeadId(): string {
  const existing = getStoredLeadId();
  if (existing) return existing;

  const id = getUrlSourceLeadId() || randomId();
  storeLeadId(id);
  return id;
}

/**
 * Returns this browser's persisted campaign code, capturing it from
 * ?utm_campaign= the first time it's called (mirrors ensureLeadId()'s
 * capture-once-persist-forever pattern, but in its own storage key, and
 * with no fallback random value — absence just means no campaign tag was
 * ever present, which is a real, valid, distinct case from "tagged but
 * unknown"). Never creates a database row by itself.
 */
function ensureCampaignCode(): string | null {
  const existing = getStoredCampaignCode();
  if (existing) return existing;

  const fromUrl = getUrlCampaignCode();
  if (fromUrl) {
    storeCampaignCode(fromUrl);
    return fromUrl;
  }
  return null;
}

export type TrackEventName = 'opened' | 'checkout_viewed' | 'trial_clicked';

export function trackEvent(event: TrackEventName): Promise<string | null> {
  ensureLeadId(); // make sure a tracking id exists locally before Stripe needs it
  const campaign = ensureCampaignCode(); // separate identity — see module comment above

  /* Fire-and-forget — this only feeds an anonymous count on the backend,
   * so nothing on the page should ever wait on it or break if it fails. */
  fetch('/api/track-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campaign ? { event, campaign } : { event }),
  }).catch(() => {
    /* tracking must never break the site — fail silently */
  });

  return Promise.resolve(getStoredLeadId());
}

export function getLeadId(): string | null {
  return ensureLeadId();
}

/** The visitor's persisted campaign code (utm_campaign), or null if none was ever captured. */
export function getCampaignCode(): string | null {
  return ensureCampaignCode();
}
