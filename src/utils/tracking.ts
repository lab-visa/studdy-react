/**
 * Lead tracking — talks to /api/track-event.
 *
 * How it works:
 *  - First time anyone lands on the site, we grab any lead/campaign info
 *    from the URL (?lid=, ?utm_source=, ?aff_id=, etc.) and create a row
 *    for them in Supabase. The lead_id that comes back is saved in this
 *    browser's localStorage so every later call (checkout page, clicking
 *    Start Free Trial) can be tied back to the same person.
 *  - If someone arrives with no tracking info at all (typed the URL
 *    directly, organic visit), they still get a lead_id — just with
 *    blank source fields.
 */

const LEAD_ID_KEY = 'sl_lead_id';

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

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    source_lead_id: p.get('lid') ?? p.get('source_lead_id') ?? undefined,
    affiliate_id: p.get('aff_id') ?? undefined,
    affiliate_name: p.get('aff_name') ?? undefined,
    utm_source: p.get('utm_source') ?? undefined,
    utm_medium: p.get('utm_medium') ?? undefined,
    utm_campaign: p.get('utm_campaign') ?? undefined,
    utm_content: p.get('utm_content') ?? undefined,
    utm_term: p.get('utm_term') ?? undefined,
    fmt: p.get('fmt') ?? undefined,
    course_id: p.get('courseId') ?? undefined,
  };
}

export type TrackEventName = 'opened' | 'checkout_viewed' | 'trial_clicked';

export async function trackEvent(event: TrackEventName): Promise<string | null> {
  const existingLeadId = getStoredLeadId();

  try {
    const body = existingLeadId
      ? { event, lead_id: existingLeadId }
      : { event, ...getUrlParams() };

    const res = await fetch('/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data?.lead_id) {
      storeLeadId(data.lead_id);
      return data.lead_id;
    }
  } catch {
    /* tracking must never break the site — fail silently */
  }

  return existingLeadId;
}

export function getLeadId(): string | null {
  return getStoredLeadId();
}
