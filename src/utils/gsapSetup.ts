/**
 * gsapSetup.ts — central GSAP / ScrollTrigger bootstrap.
 *
 * INVESTIGATION (Sep 2026): mobile scroll-jump reported through
 * WhatsApp's in-app browser, via the "See how it works" CTA link.
 *
 * PR #8 removed ScrollStory's own forced CSS/JS scroll-snap (a real
 * bug, correctly fixed) but the jump continued — confirmed on a
 * fresh GHL WhatsApp template with a cache-busting query string,
 * which rules out stale WhatsApp caching. It doesn't reproduce in
 * real Safari/Chrome, and it isn't confined to the cinematic story
 * section — it starts around the ScrollStory/HowItWorks transition
 * and gets worse toward FAQ/FinalCTA/Footer. Re-searching the whole
 * src/ tree found nothing else that calls scrollIntoView, scrollTo,
 * or sets scroll-snap-type anywhere in those later sections.
 *
 * What IS registered on nearly every section is GSAP ScrollTrigger
 * (Hero's parallax, HowItWorks' scrub-linked line/token,
 * EmotionalHook's and FinalCTA's reveals). Reading the installed
 * ScrollTrigger source directly (node_modules/gsap/src/
 * ScrollTrigger.js) rather than assuming: its default behaviour is to
 * auto-refresh() every registered trigger's start/end pixel positions
 * whenever the window fires a "resize" event. It already has some
 * built-in protection for touch devices (_ignoreMobileResize, on by
 * default when Observer.isTouch === 1), but that protection has a
 * hardcoded escape hatch — it still refreshes if the viewport height
 * changes by more than 25% of itself (see _onResize in that file).
 * In-app browsers like WhatsApp's animate their own chrome (a mini
 * address bar, sometimes a bottom bar too) as you scroll — the same
 * mechanism as mobile Safari's dynamic toolbar, evidently swinging
 * further. Every time that swing cleared the 25% threshold,
 * ScrollTrigger recalculated every trigger's start/end against the
 * CURRENT scroll position mid-gesture and snapped every scrub-linked
 * transform to its new value — which would look exactly like the
 * page jumping to a different section, even though window.scrollY
 * itself may not move.
 *
 * IMPORTANT — this mechanism is the leading, well-supported
 * hypothesis, not a confirmed root cause. It explains every reported
 * symptom (why it starts at HowItWorks, why it never reproduces in
 * real Safari/Chrome, why it's independent of WhatsApp's cache) and
 * it's grounded in the actual installed library's source rather than
 * a guess — but only an on-device retest through the real WhatsApp
 * CTA link, after this fix ships, actually confirms it.
 *
 * FIRST ATTEMPT (superseded): unconditionally excluding "resize" from
 * ScrollTrigger's autoRefreshEvents killed refresh-on-resize for every
 * browser and device, including a real user resizing their desktop
 * browser window or genuinely rotating their phone. The correct fix
 * has to single out the height-only-change case on TOUCH devices
 * only — every other case must refresh, debounced, exactly like
 * ScrollTrigger would do by default.
 *
 * Fix: still take "resize" out of ScrollTrigger's own autoRefreshEvents
 * (initial load via DOMContentLoaded/load and visibilitychange are
 * kept), but replace it with our own resize handling that decides,
 * per resize event, whether it's a real layout change or just a touch
 * device's browser chrome animating — see shouldRefreshForResize() in
 * ./scrollRefreshPolicy.ts (split into its own GSAP-free module
 * specifically so that decision logic can be unit tested directly —
 * see test/cases/gsap-scrolltrigger-no-resize-refresh.test.mjs):
 *
 *   - Not a touch-primary device (desktop/laptop, mouse or trackpad):
 *     always refresh, debounced — this is ScrollTrigger's normal
 *     desktop behaviour, untouched.
 *   - Touch-primary device, width changed materially: always refresh,
 *     debounced — a genuine orientation change swings width by
 *     40-80%+, far above that threshold, so it's always caught.
 *   - Touch-primary device, width unchanged/negligible, only height
 *     changed: do NOT refresh — this is the in-app-browser-chrome
 *     case that caused the bug, and it's the only case this fix
 *     changes from ScrollTrigger's default.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { shouldRefreshForResize } from './scrollRefreshPolicy';

gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.config({
  autoRefreshEvents: 'DOMContentLoaded,load,visibilitychange',
});

function isTouchPrimaryDevice(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

if (typeof window !== 'undefined') {
  let prevWidth = window.innerWidth;
  let prevHeight = window.innerHeight;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // "Debounce the legitimate refresh so it runs once after layout
  // stabilises" — restart on every qualifying resize; only the last
  // one in a burst actually calls ScrollTrigger.refresh().
  const scheduleRefresh = (delay: number) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, delay);
  };

  window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    if (shouldRefreshForResize({
      prevWidth, prevHeight, newWidth, newHeight,
      isTouchPrimary: isTouchPrimaryDevice(),
    })) {
      scheduleRefresh(200);
    }

    // Track the latest dimensions for the next comparison regardless
    // of whether we refreshed, so a run of small height-only changes
    // (an in-app browser's chrome animating in several steps) is
    // compared step-by-step and never mistaken for one big change.
    prevWidth = newWidth;
    prevHeight = newHeight;
  }, { passive: true });

  // A real device rotation is also a width change and would already
  // be caught above, but orientationchange fires immediately and
  // unambiguously — a slightly longer settle delay since rotation
  // triggers more layout recalculation than a plain resize.
  window.addEventListener('orientationchange', () => scheduleRefresh(300));
}
