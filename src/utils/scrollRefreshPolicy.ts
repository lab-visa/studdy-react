/**
 * scrollRefreshPolicy.ts
 *
 * The pure decision logic behind the WhatsApp in-app-browser scroll-
 * jump fix — deliberately split out of gsapSetup.ts, which imports
 * GSAP/ScrollTrigger and therefore requires a real browser environment
 * (ScrollTrigger's core init needs `document`). Keeping this file free
 * of that import means its logic can be unit tested directly in plain
 * Node, with no DOM and no GSAP runtime involved — see
 * test/cases/gsap-scrolltrigger-no-resize-refresh.test.mjs.
 *
 * See gsapSetup.ts's own comment for the full investigation and why
 * this specific rule (touch + height-only change => don't refresh;
 * everything else => refresh, debounced) is what fixes the bug
 * without changing desktop or genuine-orientation-change behaviour.
 */

/** A genuine orientation change swings width by 40-80%+; an in-app
 * browser's chrome collapsing/expanding never moves width at all.
 * 8% sits comfortably above any layout jitter and comfortably below
 * a real orientation swing. */
export const WIDTH_CHANGE_RATIO = 0.08;

export interface ResizeSample {
  prevWidth: number;
  prevHeight: number;
  newWidth: number;
  newHeight: number;
  isTouchPrimary: boolean;
}

export function shouldRefreshForResize({
  prevWidth, prevHeight, newWidth, newHeight, isTouchPrimary,
}: ResizeSample): boolean {
  const widthChangedMaterially =
    prevWidth > 0 && Math.abs(newWidth - prevWidth) > prevWidth * WIDTH_CHANGE_RATIO;

  if (!isTouchPrimary) {
    // Desktop / mouse-or-trackpad-primary: a real person resizing
    // their browser window. Always legitimate, regardless of which
    // dimension changed — matches ScrollTrigger's own default.
    return newWidth !== prevWidth || newHeight !== prevHeight;
  }

  // Touch-primary (phones/tablets, including in-app browsers): only
  // a materially different width counts as a real layout change.
  // A height-only change is almost always the browser's own chrome
  // animating, not a real resize.
  return widthChangedMaterially;
}
