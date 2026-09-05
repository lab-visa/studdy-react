/**
 * CRM-3A — campaign attribution capture, backend half.
 *
 * The browser owns capturing first-touch (once) and latest-touch
 * (refreshed on every fresh tagged visit) locally — see
 * src/utils/attribution.ts. This file only persists what the browser
 * hands it, at exactly one moment: the "Start Free Trial" click
 * (api/track-attribution.js), never for a mere page visit — matching the
 * existing rule in api/track-event.js.
 *
 * Idempotency / never-overwrite-first-touch design:
 *   - No existing lead_attribution row for this lead_id -> INSERT both
 *     first_* and latest_* from what the browser sent.
 *   - An existing row -> UPDATE latest_* ONLY. first_* columns are never
 *     even included in the UPDATE payload, so they cannot be touched by
 *     this call under any circumstance — not "don't overwrite if
 *     already set", but "physically not part of this SQL statement".
 * A concurrent double-click race (two inserts for the same brand-new
 * lead_id) is resolved by the table's own primary key (lead_id) via a
 * 23505 catch below, re-read, then treated as the "existing row" update
 * path — the same idempotency shape already used by
 * mirrorCancellationRequest() in api/cancel-request.js.
 */

const MAX_UTM_LENGTH = 100;
const MAX_URL_LENGTH = 500;

/** Trims a value to a non-empty string within maxLen, or null. Never throws on a non-string input. */
function normalizeField(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

/**
 * Normalizes one touch snapshot (first or latest) as sent by the browser
 * into the exact column values lead_attribution/customers expect.
 * Accepts either camelCase (utmSource) or already-snake_case (utm_source)
 * keys so the same helper can be reused for request-body parsing and for
 * internal reuse — unknown/extra keys are ignored.
 */
export function normalizeTouch(touch) {
  const t = touch || {};
  const get = (camel, snake) => t[camel] ?? t[snake];
  return {
    utm_source: normalizeField(get('utmSource', 'utm_source'), MAX_UTM_LENGTH),
    utm_medium: normalizeField(get('utmMedium', 'utm_medium'), MAX_UTM_LENGTH),
    utm_campaign: normalizeField(get('utmCampaign', 'utm_campaign'), MAX_UTM_LENGTH),
    utm_content: normalizeField(get('utmContent', 'utm_content'), MAX_UTM_LENGTH),
    utm_term: normalizeField(get('utmTerm', 'utm_term'), MAX_UTM_LENGTH),
    ghl_contact_id: normalizeField(get('ghlContactId', 'ghl_contact_id'), MAX_UTM_LENGTH),
    ghl_campaign_id: normalizeField(get('ghlCampaignId', 'ghl_campaign_id'), MAX_UTM_LENGTH),
    landing_url: normalizeField(get('landingUrl', 'landing_url'), MAX_URL_LENGTH),
  };
}

/** True if a normalized touch object has at least one non-null field — an all-null touch is not worth writing a row for. */
export function touchHasAnyField(normalized) {
  return Object.values(normalized).some((v) => v !== null);
}

function touchColumns(prefix, normalized) {
  return {
    [`${prefix}_utm_source`]: normalized.utm_source,
    [`${prefix}_utm_medium`]: normalized.utm_medium,
    [`${prefix}_utm_campaign`]: normalized.utm_campaign,
    [`${prefix}_utm_content`]: normalized.utm_content,
    [`${prefix}_utm_term`]: normalized.utm_term,
    [`${prefix}_ghl_contact_id`]: normalized.ghl_contact_id,
    [`${prefix}_ghl_campaign_id`]: normalized.ghl_campaign_id,
    [`${prefix}_landing_url`]: normalized.landing_url,
  };
}

const MAX_LEAD_ID_LENGTH = 200;

/**
 * Persists one click's attribution snapshot. `first`/`latest` are raw
 * (unnormalized) touch objects from the request body — normalized here,
 * never trusted from the caller. Returns the resulting row, or null if
 * leadId is missing/invalid or neither touch carries any real data (a
 * no-op, not an error — matches track-event.js's "never break the caller,
 * degrade silently" convention).
 */
export async function captureAttribution(supabase, { leadId, first, latest, now = new Date() }) {
  const normalizedLeadId = normalizeField(leadId, MAX_LEAD_ID_LENGTH);
  if (!normalizedLeadId) return null;

  const normalizedFirst = normalizeTouch(first);
  const normalizedLatest = normalizeTouch(latest);
  if (!touchHasAnyField(normalizedFirst) && !touchHasAnyField(normalizedLatest)) return null;

  const nowIso = now.toISOString();

  const { data: existing, error: selectError } = await supabase
    .from('lead_attribution')
    .select('lead_id')
    .eq('lead_id', normalizedLeadId)
    .maybeSingle();

  if (selectError) {
    console.error('captureAttribution: select error for lead', normalizedLeadId, selectError);
    return null;
  }

  if (existing) {
    return updateLatestTouch(supabase, normalizedLeadId, normalizedLatest, nowIso);
  }

  const insertFields = {
    lead_id: normalizedLeadId,
    ...touchColumns('first', normalizedFirst),
    first_touched_at: nowIso,
    ...touchColumns('latest', normalizedLatest),
    latest_touched_at: nowIso,
    updated_at: nowIso,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('lead_attribution')
    .insert(insertFields)
    .select('*')
    .maybeSingle();

  if (!insertError) return inserted;

  if (insertError.code === '23505') {
    /* Lost a race against a near-simultaneous duplicate click for the
     * same lead_id — an existing row now exists (just not from this
     * call). Correct, expected outcome: fall through to the update path,
     * same shape as mirrorCancellationRequest()'s race handling. */
    return updateLatestTouch(supabase, normalizedLeadId, normalizedLatest, nowIso);
  }

  console.error('captureAttribution: insert error for lead', normalizedLeadId, insertError);
  return null;
}

async function updateLatestTouch(supabase, leadId, normalizedLatest, nowIso) {
  if (!touchHasAnyField(normalizedLatest)) return null; // nothing new to record on this call

  const { data, error } = await supabase
    .from('lead_attribution')
    .update({
      ...touchColumns('latest', normalizedLatest),
      latest_touched_at: nowIso,
      updated_at: nowIso,
    })
    .eq('lead_id', leadId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('captureAttribution: latest-touch update error for lead', leadId, error);
    return null;
  }
  return data;
}

/** Looks up a lead's attribution row, if any — used by sync-customer.js at checkout.session.completed. */
export async function findLeadAttribution(supabase, leadId) {
  const normalizedLeadId = normalizeField(leadId, MAX_LEAD_ID_LENGTH);
  if (!normalizedLeadId) return null;
  const { data, error } = await supabase
    .from('lead_attribution')
    .select('*')
    .eq('lead_id', normalizedLeadId)
    .maybeSingle();
  if (error) {
    console.error('findLeadAttribution: error for lead', normalizedLeadId, error);
    return null;
  }
  return data;
}
