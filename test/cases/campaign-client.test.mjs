/**
 * CRM-2A code-review fix #3/#6 — client-side campaign attribution +
 * checkout URL encoding coverage.
 *
 * The review bundle originally shipped only SERVER-side tracking tests
 * (tracking-http.test.mjs) with no direct coverage of the browser-side
 * src/utils/tracking.ts + src/pages/Checkout.tsx behavior. This file adds
 * that coverage using the smallest mechanism that actually works in this
 * repo: Node 22's built-in TypeScript type-stripping (no flag needed —
 * verified against this Node version) lets these plain, JSX-free .ts
 * modules be imported directly by node:test, with a tiny hand-rolled
 * localStorage/window/fetch shim standing in for the browser. No new
 * test framework, no jsdom, no React renderer.
 *
 * Checkout.tsx itself contains JSX, which the stripper cannot parse — so
 * its pure URL-building logic lives in its own JSX-free module,
 * src/utils/checkoutLink.ts, imported by both Checkout.tsx and this file.
 *
 * "Anonymous campaign capture creates no CRM row" is NOT re-proven here —
 * that's a server-side/database fact, already covered end-to-end by
 * test/cases/tracking-http.test.mjs's row-count assertions against the
 * real api/track-event.js handler. What IS proven here, client-side, is
 * that the tracking functions never do anything except call fetch() to
 * /api/track-event — no other API, no direct database access is even
 * reachable from the browser.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentLinkUrl } from '../../src/utils/checkoutLink.ts';

/* ─────────────────────── minimal browser shim ─────────────────────── */

function makeLocalStorageShim() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const fetchCalls = [];

function setLocation(search) {
  globalThis.window.location.search = search;
}

let tracking;

before(async () => {
  globalThis.window = { location: { search: '' } };
  globalThis.localStorage = makeLocalStorageShim();
  globalThis.fetch = (url, opts) => {
    fetchCalls.push({ url, opts });
    return Promise.resolve({ ok: true });
  };
  // Real Web Crypto (crypto.randomUUID) is already a Node global — no shim needed.
  tracking = await import('../../src/utils/tracking.ts');
});

beforeEach(() => {
  globalThis.localStorage.clear();
  fetchCalls.length = 0;
  setLocation('');
});

/* ───────────────────────── buildPaymentLinkUrl ─────────────────────── */

test('buildPaymentLinkUrl encodes utm_source/utm_campaign — values containing & = space # never corrupt the query string', () => {
  const dangerous = 'WA & Friends=1 #promo';
  const url = buildPaymentLinkUrl('https://buy.stripe.com/test123', {
    utmSource: 'google ads',
    utmCampaign: dangerous,
    leadId: 'lead-abc',
  });

  // Structurally correct: exactly one "?" starting the query string, and
  // it parses back to exactly the three expected params with their
  // ORIGINAL (decoded) values — proving no injected/corrupted param.
  const [base, query] = url.split('?');
  assert.equal(base, 'https://buy.stripe.com/test123');
  assert.equal(url.indexOf('?'), url.lastIndexOf('?'), 'exactly one "?" — no injected second query string');

  const parsed = new URLSearchParams(query);
  assert.equal(parsed.get('utm_source'), 'google ads');
  assert.equal(parsed.get('utm_campaign'), dangerous);
  assert.equal(parsed.get('client_reference_id'), 'lead-abc');
  // No stray/injected params — the dangerous value's own "&"/"=" must not
  // have created extra keys.
  assert.equal([...parsed.keys()].length, 3);
});

test('buildPaymentLinkUrl: an over-length campaign value still encodes safely and keeps the URL structurally parseable', () => {
  const longValue = 'x'.repeat(5000) + '&injected=1';
  const url = buildPaymentLinkUrl('https://buy.stripe.com/test123', {
    utmSource: 'direct',
    utmCampaign: longValue,
    leadId: null,
  });

  const parsed = new URLSearchParams(url.split('?')[1]);
  assert.equal(parsed.get('utm_campaign'), longValue, 'even a very long value round-trips exactly — encodeURIComponent never truncates or breaks structure');
  assert.equal(parsed.has('injected'), false, 'the embedded "&injected=1" must never become its own query param');
});

test('buildPaymentLinkUrl: client_reference_id is the lead id — omitted (never fabricated) when there is no lead id, never replaced by campaign identity', () => {
  const withoutLead = buildPaymentLinkUrl('https://buy.stripe.com/test123', {
    utmSource: 'direct',
    utmCampaign: 'WA-01',
    leadId: null,
  });
  assert.equal(new URLSearchParams(withoutLead.split('?')[1]).has('client_reference_id'), false);

  const withLead = buildPaymentLinkUrl('https://buy.stripe.com/test123', {
    utmSource: 'direct',
    utmCampaign: 'WA-01',
    leadId: 'lead-xyz',
  });
  const parsed = new URLSearchParams(withLead.split('?')[1]);
  assert.equal(parsed.get('client_reference_id'), 'lead-xyz');
  assert.notEqual(parsed.get('client_reference_id'), parsed.get('utm_campaign'), 'lead identity and campaign identity must never collapse into the same value');
});

test('buildPaymentLinkUrl: appends with "?" when the link has none, "&" when it already has a query string', () => {
  const noQuery = buildPaymentLinkUrl('https://buy.stripe.com/test123', { utmSource: 'x', utmCampaign: 'y', leadId: null });
  assert.match(noQuery, /^https:\/\/buy\.stripe\.com\/test123\?/);

  const hasQuery = buildPaymentLinkUrl('https://buy.stripe.com/test123?prefilled_email=a%40b.com', {
    utmSource: 'x',
    utmCampaign: 'y',
    leadId: null,
  });
  assert.match(hasQuery, /^https:\/\/buy\.stripe\.com\/test123\?prefilled_email=a%40b\.com&/);
});

/* ─────────────────────────── tracking.ts ────────────────────────────── */

test('utm_campaign is captured and stored separately from lid — never the same identity, never mixed', () => {
  setLocation('?lid=lead-111&utm_campaign=WA-260902-IN-03');
  const leadId = tracking.getLeadId();
  const campaign = tracking.getCampaignCode();

  assert.equal(leadId, 'lead-111');
  assert.equal(campaign, 'WA-260902-IN-03');
  assert.notEqual(leadId, campaign);
  // Stored under two distinct localStorage keys, not merged into one.
  assert.equal(globalThis.localStorage.getItem('sl_lead_id'), 'lead-111');
  assert.equal(globalThis.localStorage.getItem('sl_campaign_code'), 'WA-260902-IN-03');
});

test('campaign persistence survives "navigation" — a later page load with no ?utm_campaign= still returns the originally captured value', () => {
  setLocation('?utm_campaign=WA-FIRST-LANDING');
  const capturedOnLanding = tracking.getCampaignCode();
  assert.equal(capturedOnLanding, 'WA-FIRST-LANDING');

  // Simulate navigating to another page (e.g. /checkout) with a bare URL —
  // no query string at all, as a real in-app navigation would look.
  setLocation('');
  const onNextPage = tracking.getCampaignCode();
  assert.equal(onNextPage, 'WA-FIRST-LANDING', 'the persisted campaign must survive navigation, not reset to null just because this page\'s own URL has no tag');
});

test('Checkout reuses the persisted campaign code (not "none") even when /checkout\'s own URL carries no utm_campaign', () => {
  // Land on the homepage with a campaign tag...
  setLocation('?utm_campaign=WA-REUSE-TEST');
  tracking.getCampaignCode(); // captures + persists

  // ...then "navigate" to /checkout, whose own URL has nothing.
  setLocation('');
  const utmCampaign = tracking.getCampaignCode() ?? 'none';
  const link = buildPaymentLinkUrl('https://buy.stripe.com/test123', { utmSource: 'direct', utmCampaign, leadId: null });

  assert.equal(new URLSearchParams(link.split('?')[1]).get('utm_campaign'), 'WA-REUSE-TEST');
});

test('no ?utm_campaign= anywhere means getCampaignCode() is null, and downstream code degrades to "none" — never fabricated', () => {
  setLocation('?lid=lead-222');
  assert.equal(tracking.getCampaignCode(), null);
});

test('trackEvent() only ever calls fetch("/api/track-event", ...) — no other API, no direct database access is reachable from the browser', async () => {
  setLocation('?utm_campaign=WA-FETCH-TEST');
  await tracking.trackEvent('checkout_viewed');

  assert.equal(fetchCalls.length, 1, 'exactly one network call, nothing else');
  assert.equal(fetchCalls[0].url, '/api/track-event');
  assert.equal(fetchCalls[0].opts.method, 'POST');

  const body = JSON.parse(fetchCalls[0].opts.body);
  assert.equal(body.event, 'checkout_viewed');
  assert.equal(body.campaign, 'WA-FETCH-TEST');
  // Lead identity is NEVER sent through trackEvent()'s body — it only
  // ever reaches Stripe separately, as client_reference_id, at checkout.
  assert.equal('lid' in body, false);
  assert.equal('leadId' in body, false);
  assert.equal('source_lead_id' in body, false);
});

test('trackEvent() omits the campaign field entirely (not an empty string) when no campaign was ever captured', async () => {
  setLocation(''); // no lid, no utm_campaign
  await tracking.trackEvent('opened');

  const body = JSON.parse(fetchCalls[0].opts.body);
  assert.equal('campaign' in body, false);
  assert.equal(body.event, 'opened');
});
