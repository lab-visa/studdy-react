type EventName =
  | 'hero_demo_play'
  | 'full_demo_open'
  | 'interactive_question_selected'
  | 'pricing_view'
  | 'monthly_plan_click'
  | 'annual_plan_click'
  | 'checkout_started'
  | 'checkout_completed'
  | 'dashboard_opened'
  | 'whatsapp_support_click';

export function track(event: EventName, props?: Record<string, unknown>) {
  // Replace with GA4 / Meta Pixel calls when ready
  if (import.meta.env.DEV) {
    console.log('[analytics]', event, props ?? '');
  }
  // window.gtag?.('event', event, props);
  // window.fbq?.('track', event, props);
}
