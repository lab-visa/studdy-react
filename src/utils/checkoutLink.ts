/**
 * checkoutLink.ts — pure Stripe Payment Link URL construction.
 *
 * Split out of Checkout.tsx (a React/JSX component, which Node's
 * TypeScript type-stripping cannot parse directly) into its own
 * JSX-free module specifically so this logic can be unit-tested
 * directly with the repo's existing node:test runner — no new test
 * framework, no jsdom, no React renderer needed. See
 * test/cases/campaign-client.test.mjs.
 *
 * CODE-REVIEW FIX (round 2, "encode and normalize campaign values"):
 * utm_campaign originates from user-controlled URL input (?utm_campaign=
 * on whatever page the visitor first landed on — see tracking.ts) and was
 * previously appended to the Stripe Payment Link URL unencoded. A value
 * containing `&`, `=`, `#`, or a space could corrupt the query string or
 * inject an additional parameter into the redirect. Both utm_source and
 * utm_campaign are now always run through encodeURIComponent before being
 * appended — exactly like client_reference_id already was.
 * client_reference_id's semantics are unchanged: it is always the lead
 * id, never campaign identity.
 */
export function buildPaymentLinkUrl(
  link: string,
  { utmSource, utmCampaign, leadId }: { utmSource: string; utmCampaign: string; leadId: string | null }
): string {
  const separator = link.includes('?') ? '&' : '?';
  let fullLink = `${link}${separator}utm_source=${encodeURIComponent(utmSource)}&utm_campaign=${encodeURIComponent(utmCampaign)}`;
  if (leadId) {
    fullLink += `&client_reference_id=${encodeURIComponent(leadId)}`;
  }
  return fullLink;
}
