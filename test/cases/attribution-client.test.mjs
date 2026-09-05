/**
 * CRM-3A — src/utils/attribution.ts, client-side capture logic. Same
 * shimming technique as campaign-client.test.mjs (Node's built-in
 * TypeScript type-stripping importing a JSX-free .ts module directly,
 * a hand-rolled localStorage/window shim — no jsdom, no renderer).
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

function makeLocalStorageShim() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

function setLocation(search, pathname = '/') {
  globalThis.window.location.search = search;
  globalThis.window.location.pathname = pathname;
}

let attribution;

before(async () => {
  globalThis.window = { location: { search: '', pathname: '/' } };
  globalThis.localStorage = makeLocalStorageShim();
  attribution = await import('../../src/utils/attribution.ts');
});

beforeEach(() => {
  globalThis.localStorage.clear();
  setLocation('', '/');
});

test('parseTouchFromSearch returns null when no tracked param is present', () => {
  assert.equal(attribution.parseTouchFromSearch('', '/checkout', '2026-09-02T10:00:00.000Z'), null);
  assert.equal(attribution.parseTouchFromSearch('?other=1', '/checkout', '2026-09-02T10:00:00.000Z'), null);
});

test('parseTouchFromSearch reads all five UTM fields plus GHL identifiers when present', () => {
  const touch = attribution.parseTouchFromSearch(
    '?utm_source=whatsapp&utm_medium=chat&utm_campaign=WA-01&utm_content=variant-a&utm_term=trial&ghl_contact_id=c1&ghl_campaign_id=g1',
    '/',
    '2026-09-02T10:00:00.000Z'
  );
  assert.ok(touch);
  assert.equal(touch.utmSource, 'whatsapp');
  assert.equal(touch.utmMedium, 'chat');
  assert.equal(touch.utmCampaign, 'WA-01');
  assert.equal(touch.utmContent, 'variant-a');
  assert.equal(touch.utmTerm, 'trial');
  assert.equal(touch.ghlContactId, 'c1');
  assert.equal(touch.ghlCampaignId, 'g1');
  assert.equal(touch.landingUrl, '/');
});

test('captureAttributionTouch: a plain/untagged URL is a no-op — nothing persisted', () => {
  setLocation('', '/checkout');
  attribution.captureAttributionTouch();
  const snap = attribution.getAttributionSnapshot();
  assert.equal(snap.first, null);
  assert.equal(snap.latest, null);
});

test('captureAttributionTouch: first tagged visit seeds BOTH first-touch and latest-touch', () => {
  setLocation('?utm_source=whatsapp&utm_campaign=WA-01', '/');
  attribution.captureAttributionTouch();
  const snap = attribution.getAttributionSnapshot();
  assert.equal(snap.first?.utmCampaign, 'WA-01');
  assert.equal(snap.latest?.utmCampaign, 'WA-01');
});

test('captureAttributionTouch: a later tagged visit updates latest-touch but never rewrites first-touch', () => {
  setLocation('?utm_source=whatsapp&utm_campaign=WA-01', '/');
  attribution.captureAttributionTouch();

  setLocation('?utm_source=facebook&utm_campaign=FB-99', '/checkout');
  attribution.captureAttributionTouch();

  const snap = attribution.getAttributionSnapshot();
  assert.equal(snap.first?.utmCampaign, 'WA-01', 'first-touch must survive a later, different tagged visit');
  assert.equal(snap.latest?.utmCampaign, 'FB-99', 'latest-touch must move forward');
});

test('captureAttributionTouch: navigating to an untagged page afterward leaves both first and latest exactly as they were ("existing links without UTMs must continue working")', () => {
  setLocation('?utm_source=whatsapp&utm_campaign=WA-01', '/');
  attribution.captureAttributionTouch();

  setLocation('', '/checkout'); // in-app navigation, no query string at all
  attribution.captureAttributionTouch();

  const snap = attribution.getAttributionSnapshot();
  assert.equal(snap.first?.utmCampaign, 'WA-01');
  assert.equal(snap.latest?.utmCampaign, 'WA-01', 'an untagged page must never erase the previously captured latest-touch');
});

test('getAttributionSnapshot: both null when nothing was ever captured — never fabricated', () => {
  const snap = attribution.getAttributionSnapshot();
  assert.equal(snap.first, null);
  assert.equal(snap.latest, null);
});
