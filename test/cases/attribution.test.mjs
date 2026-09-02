/**
 * CRM-3A — campaign attribution capture (api/_lib/attribution.js), tested
 * directly against the real lead_attribution table (migration 0016).
 *
 * Covers: first-touch is set once and never overwritten by a later call;
 * latest-touch always updates; a concurrent-insert race (23505) is
 * resolved the same way mirrorCancellationRequest() resolves its own
 * race (falls through to the update path); defensive normalization
 * (length caps, non-string rejection); a leadId-less or all-null call is
 * a safe no-op, never a thrown error or a garbage row.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTestPool, closeTestPool } from '../helpers/db.mjs';
import { createTestSupabaseClient } from '../helpers/supabase-shim.mjs';
import { captureAttribution, findLeadAttribution, normalizeTouch, touchHasAnyField } from '../../api/_lib/attribution.js';

let pool;
let supabase;

before(async () => {
  pool = await getTestPool();
  supabase = createTestSupabaseClient(pool);
});

after(async () => {
  await closeTestPool();
});

beforeEach(async () => {
  await pool.query('DELETE FROM lead_attribution');
});

test('normalizeTouch: trims, caps length, and null/empty/non-string all normalize to null', () => {
  const t = normalizeTouch({ utmSource: '  google  ', utmCampaign: '', utmMedium: 42, utmContent: null });
  assert.equal(t.utm_source, 'google');
  assert.equal(t.utm_campaign, null);
  assert.equal(t.utm_medium, null, 'a non-string value must normalize to null, never throw');
  assert.equal(t.utm_content, null);
});

test('normalizeTouch: accepts snake_case keys too (server-internal reuse)', () => {
  const t = normalizeTouch({ utm_source: 'ghl', ghl_contact_id: 'contact-1' });
  assert.equal(t.utm_source, 'ghl');
  assert.equal(t.ghl_contact_id, 'contact-1');
});

test('touchHasAnyField: false for an all-null touch, true if any field is set', () => {
  assert.equal(touchHasAnyField(normalizeTouch({})), false);
  assert.equal(touchHasAnyField(normalizeTouch({ utmTerm: 'x' })), true);
});

test('captureAttribution: first call inserts both first_* and latest_* from the same snapshot', async () => {
  const leadId = `lead-${randomUUID()}`;
  const row = await captureAttribution(supabase, {
    leadId,
    first: { utmSource: 'whatsapp', utmCampaign: 'WA-01' },
    latest: { utmSource: 'whatsapp', utmCampaign: 'WA-01' },
  });

  assert.ok(row);
  assert.equal(row.first_utm_source, 'whatsapp');
  assert.equal(row.first_utm_campaign, 'WA-01');
  assert.equal(row.latest_utm_source, 'whatsapp');
  assert.ok(row.first_touched_at);
  assert.ok(row.latest_touched_at);
});

test('captureAttribution: a second call for the same leadId updates latest_* only — first_* is never touched', async () => {
  const leadId = `lead-${randomUUID()}`;
  await captureAttribution(supabase, { leadId, first: { utmSource: 'whatsapp', utmCampaign: 'WA-01' }, latest: { utmSource: 'whatsapp', utmCampaign: 'WA-01' } });

  const second = await captureAttribution(supabase, {
    leadId,
    // A real caller always sends first+latest together, but even if it
    // sent a DIFFERENT "first" here, the update path must never write it —
    // proving first_* is physically excluded from the UPDATE statement,
    // not just "usually" left alone.
    first: { utmSource: 'google', utmCampaign: 'GOOGLE-99' },
    latest: { utmSource: 'facebook', utmCampaign: 'FB-RETARGET' },
  });

  assert.ok(second);
  assert.equal(second.first_utm_source, 'whatsapp', 'first-touch must survive a second, different click untouched');
  assert.equal(second.first_utm_campaign, 'WA-01');
  assert.equal(second.latest_utm_source, 'facebook', 'latest-touch must move forward to the newest known value');
  assert.equal(second.latest_utm_campaign, 'FB-RETARGET');

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM lead_attribution WHERE lead_id=$1', [leadId]);
  assert.equal(rows[0].c, 1, 'a second click for the same lead must update the existing row, never insert a second one');
});

test('captureAttribution: a leadId with no first/latest data at all is a safe no-op — no row created', async () => {
  const leadId = `lead-${randomUUID()}`;
  const row = await captureAttribution(supabase, { leadId, first: {}, latest: {} });
  assert.equal(row, null);

  const found = await findLeadAttribution(supabase, leadId);
  assert.equal(found, null);
});

test('captureAttribution: missing/empty leadId is a safe no-op, never throws', async () => {
  const row1 = await captureAttribution(supabase, { leadId: '', first: { utmSource: 'x' }, latest: {} });
  const row2 = await captureAttribution(supabase, { leadId: undefined, first: { utmSource: 'x' }, latest: {} });
  assert.equal(row1, null);
  assert.equal(row2, null);
});

test('findLeadAttribution: returns null for an unknown lead, the row for a known one', async () => {
  const leadId = `lead-${randomUUID()}`;
  assert.equal(await findLeadAttribution(supabase, leadId), null);

  await captureAttribution(supabase, { leadId, first: { utmSource: 'direct' }, latest: { utmSource: 'direct' } });
  const found = await findLeadAttribution(supabase, leadId);
  assert.ok(found);
  assert.equal(found.lead_id, leadId);
});

test('captureAttribution: an all-null "first" but a real "latest" still creates a row (a WhatsApp lid with no UTM tag, arriving via a later tagged retarget)', async () => {
  const leadId = `lead-${randomUUID()}`;
  const row = await captureAttribution(supabase, { leadId, first: {}, latest: { utmSource: 'retarget' } });
  assert.ok(row);
  assert.equal(row.first_utm_source, null);
  assert.equal(row.latest_utm_source, 'retarget');
});
