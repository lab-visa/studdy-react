// ── CENTRAL CONFIGURATION ──
// All pricing, Stripe Price IDs and regional data live here.
// To change a price: update amount + stripeMonthlyId / stripeYearlyId.

/* One shared support number for everyone for now (per Vish, Aug 2026).
 * Locked decision was USA number for USA / UK number for everyone else —
 * once the USA number exists, split this by region the same way pricing
 * already is. */
const SUPPORT_WHATSAPP_NUMBER  = '447587357644';
const SUPPORT_WHATSAPP_MESSAGE = "Hi! I'm a Studdy Lab customer and need some help.";
export const SUPPORT_WHATSAPP =
  `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MESSAGE)}`;
export const SUPPORT_EMAIL    = 'hello@studdylab.com';
export const TRIAL_DAYS       = 7;

export type Region =
  | 'us' | 'uk' | 'eu' | 'uae' | 'sa' | 'kw' | 'qa' | 'om' | 'bh'
  | 'au' | 'nz' | 'in' | 'sg' | 'bd' | 'za' | 'ng'
  | 'jp' | 'my' | 'id' | 'ph' | 'th' | 'ca' | 'other';

export interface RegionConfig {
  label: string;
  flag: string;
  group: string;
  symbol: string;
  monthly: { amount: string; display: string; stripeId: string; paymentLink: string; };
  yearly:  { amount: string; display: string; stripeId: string; paymentLink: string; yearlyTotal: string; };
  tutorPrice: string;  // human tutor comparison price
}

/* FIX (Sep 2026 repricing, Vish): full 22-country + Other repricing.
 * Every region below now points at a brand-new Stripe product/price pair
 * (nothing from the pre-Sep-2026 catalog was touched or archived).
 * Kuwait, Oman and Bahrain are priced and charged in USD, NOT their local
 * currency (KWD/OMR/BHD) — this Stripe account can't settle in those three
 * currencies, so per Vish's explicit fallback instruction they use the same
 * $26.99/mo, $129.99/yr as US/Other. symbol/amount/display below reflect the
 * ACTUAL USD charge for those three, not the original local-currency target
 * numbers, so the price shown pre-checkout matches what Stripe actually bills. */
export const REGION_DATA: Record<Region, RegionConfig> = {
  us: {
    label:'United States', flag:'🇺🇸', group:'US & Canada', symbol:'$',
    monthly: { amount:'26.99', display:'$26.99/mo',  stripeId:'price_1UCpDjSo2yKs7Rdkt11PUUUc', paymentLink:'https://buy.stripe.com/00w6oJgU7dycgpJe7l5J62e' },
    yearly:  { amount:'129.99', display:'$129.99/yr', stripeId:'price_1UCpDmSo2yKs7Rdkj0XqdfFB', paymentLink:'https://buy.stripe.com/cNi6oJ8nB0Lqc9t2oD5J62f', yearlyTotal:'$129.99' },
    tutorPrice: 'From $80/hr',
  },
  ca: {
    label:'Canada', flag:'🇨🇦', group:'US & Canada', symbol:'CA$',
    monthly: { amount:'35.99', display:'CA$35.99/mo',  stripeId:'price_1UCpDoSo2yKs7Rdk30yMS0Bh', paymentLink:'https://buy.stripe.com/3cI9AVfQ3cu82yT6ET5J62g' },
    yearly:  { amount:'172.99', display:'CA$172.99/yr', stripeId:'price_1UCpDrSo2yKs7Rdk2xYeLYjF', paymentLink:'https://buy.stripe.com/9B6eVf33hgKo1uP4wL5J62h', yearlyTotal:'CA$172.99' },
    tutorPrice: 'From CA$75/hr',
  },
  uk: {
    label:'United Kingdom', flag:'🇬🇧', group:'Europe', symbol:'£',
    monthly: { amount:'18.99', display:'£18.99/mo',  stripeId:'price_1UCpCBSo2yKs7RdkSsZ6qKd6', paymentLink:'https://buy.stripe.com/7sY5kFdHV2Ty6P97IX5J61E' },
    yearly:  { amount:'91.99', display:'£91.99/yr', stripeId:'price_1UCpCESo2yKs7RdknEEd3RRl', paymentLink:'https://buy.stripe.com/6oU5kF8nB0Lq5L5d3h5J61F', yearlyTotal:'£91.99' },
    tutorPrice: 'From £60/hr',
  },
  eu: {
    label:'European Union', flag:'🇪🇺', group:'Europe', symbol:'€',
    monthly: { amount:'21.99', display:'€21.99/mo',  stripeId:'price_1UCpCHSo2yKs7RdkHzHrVaRl', paymentLink:'https://buy.stripe.com/8x214p0V90Lq7TdaV95J61G' },
    yearly:  { amount:'105.99', display:'€105.99/yr', stripeId:'price_1UCpCJSo2yKs7RdkXKk8TeDQ', paymentLink:'https://buy.stripe.com/aFa6oJbzN2Tyc9taV95J61H', yearlyTotal:'€105.99' },
    tutorPrice: 'From €65/hr',
  },
  uae: {
    label:'UAE', flag:'🇦🇪', group:'Gulf', symbol:'AED',
    monthly: { amount:'102.99', display:'AED 102.99/mo',  stripeId:'price_1UCpCMSo2yKs7RdkJyYhAWiS', paymentLink:'https://buy.stripe.com/cNi4gBdHV51Ga1l6ET5J61I' },
    yearly:  { amount:'494.99', display:'AED 494.99/yr', stripeId:'price_1UCpCPSo2yKs7RdkCKPRVKZx', paymentLink:'https://buy.stripe.com/00wbJ3gU7eCgc9tfbp5J61J', yearlyTotal:'AED 494.99' },
    tutorPrice: 'From AED 250/hr',
  },
  sa: {
    label:'Saudi Arabia', flag:'🇸🇦', group:'Gulf', symbol:'SAR',
    monthly: { amount:'102.99', display:'SAR 102.99/mo',  stripeId:'price_1UCpCSSo2yKs7RdksPimDIXd', paymentLink:'https://buy.stripe.com/3cI6oJgU765K5L57IX5J61K' },
    yearly:  { amount:'494.99', display:'SAR 494.99/yr', stripeId:'price_1UCpCVSo2yKs7RdkGND8sk4r', paymentLink:'https://buy.stripe.com/3cI8wRdHV8dS5L5fbp5J61L', yearlyTotal:'SAR 494.99' },
    tutorPrice: 'From SAR 200/hr',
  },
  kw: {
    /* USD fallback — see file-level note above. */
    label:'Kuwait', flag:'🇰🇼', group:'Gulf', symbol:'$',
    monthly: { amount:'26.99', display:'$26.99/mo',  stripeId:'price_1UCpFUSo2yKs7RdkZqtBr00y', paymentLink:'https://buy.stripe.com/4gM3cx1Zd3XCa1lfbp5J61M' },
    yearly:  { amount:'129.99', display:'$129.99/yr', stripeId:'price_1UCpFXSo2yKs7RdkclDRNCK0', paymentLink:'https://buy.stripe.com/cNibJ38nBam0gpJgft5J61N', yearlyTotal:'$129.99' },
    tutorPrice: 'From KWD 15/hr',
  },
  qa: {
    label:'Qatar', flag:'🇶🇦', group:'Gulf', symbol:'QAR',
    monthly: { amount:'102.99', display:'QAR 102.99/mo',  stripeId:'price_1UCpCdSo2yKs7RdkKbjBmq6w', paymentLink:'https://buy.stripe.com/7sY7sN33h3XCflFe7l5J61O' },
    yearly:  { amount:'494.99', display:'QAR 494.99/yr', stripeId:'price_1UCpCgSo2yKs7RdkKuVAfiyZ', paymentLink:'https://buy.stripe.com/7sYeVf7jx3XC2yTd3h5J61P', yearlyTotal:'QAR 494.99' },
    tutorPrice: 'From QAR 200/hr',
  },
  om: {
    /* USD fallback — see file-level note above. */
    label:'Oman', flag:'🇴🇲', group:'Gulf', symbol:'$',
    monthly: { amount:'26.99', display:'$26.99/mo',  stripeId:'price_1UCpFZSo2yKs7RdkVv5EMH3y', paymentLink:'https://buy.stripe.com/5kQ8wR9rF1Pu5L57IX5J61Q' },
    yearly:  { amount:'129.99', display:'$129.99/yr', stripeId:'price_1UCpFcSo2yKs7RdktI7KOgmF', paymentLink:'https://buy.stripe.com/4gM3cx47l9hWehBfbp5J61R', yearlyTotal:'$129.99' },
    tutorPrice: 'From OMR 20/hr',
  },
  bh: {
    /* USD fallback — see file-level note above. */
    label:'Bahrain', flag:'🇧🇭', group:'Gulf', symbol:'$',
    monthly: { amount:'26.99', display:'$26.99/mo',  stripeId:'price_1UCpFeSo2yKs7RdkGzRLnBm9', paymentLink:'https://buy.stripe.com/dRm3cxdHVbq44H1aV95J61S' },
    yearly:  { amount:'129.99', display:'$129.99/yr', stripeId:'price_1UCpFhSo2yKs7RdktliVwXIA', paymentLink:'https://buy.stripe.com/eVqeVfavJfGk6P91kz5J61T', yearlyTotal:'$129.99' },
    tutorPrice: 'From BHD 20/hr',
  },
  au: {
    label:'Australia', flag:'🇦🇺', group:'ANZ', symbol:'A$',
    monthly: { amount:'36.99', display:'A$36.99/mo',  stripeId:'price_1UCpC0So2yKs7RdkqEYYn30s', paymentLink:'https://buy.stripe.com/28E00l8nB3XC0qL2oD5J61A' },
    yearly:  { amount:'177.99', display:'A$177.99/yr', stripeId:'price_1UCpC3So2yKs7RdkCBEX783O', paymentLink:'https://buy.stripe.com/eVq4gB8nBgKo3CXaV95J61B', yearlyTotal:'A$177.99' },
    tutorPrice: 'From A$90/hr',
  },
  nz: {
    label:'New Zealand', flag:'🇳🇿', group:'ANZ', symbol:'NZ$',
    monthly: { amount:'43.99', display:'NZ$43.99/mo',  stripeId:'price_1UCpC5So2yKs7RdkQTY0H2uj', paymentLink:'https://buy.stripe.com/eVqdRb6ft65KgpJ9R55J61C' },
    yearly:  { amount:'211.99', display:'NZ$211.99/yr', stripeId:'price_1UCpC8So2yKs7RdkRH3qF2XV', paymentLink:'https://buy.stripe.com/dRmbJ3fQ351G6P9d3h5J61D', yearlyTotal:'NZ$211.99' },
    tutorPrice: 'From NZ$80/hr',
  },
  in: {
    label:'India', flag:'🇮🇳', group:'South Asia', symbol:'₹',
    monthly: { amount:'2349.99', display:'₹2,349/mo',  stripeId:'price_1UCpCtSo2yKs7RdkjKOY59OC', paymentLink:'https://buy.stripe.com/dRm00l1Zd9hW1uP2oD5J61U' },
    yearly:  { amount:'11279.99', display:'₹11,279/yr', stripeId:'price_1UCpCwSo2yKs7RdkEvzcYU8r', paymentLink:'https://buy.stripe.com/8x28wRgU73XCflF9R55J61V', yearlyTotal:'₹11,279' },
    tutorPrice: 'From ₹1,500/hr',
  },
  sg: {
    label:'Singapore', flag:'🇸🇬', group:'South East Asia', symbol:'S$',
    monthly: { amount:'33.99', display:'S$33.99/mo',  stripeId:'price_1UCpCySo2yKs7RdkjqbNh5ZO', paymentLink:'https://buy.stripe.com/8x2cN7avJ51Gc9t5AP5J61W' },
    yearly:  { amount:'163.99', display:'S$163.99/yr', stripeId:'price_1UCpD1So2yKs7RdkSGyEre6d', paymentLink:'https://buy.stripe.com/bJe6oJ1Zd2Ty4H18N15J61X', yearlyTotal:'S$163.99' },
    tutorPrice: 'From S$80/hr',
  },
  my: {
    label:'Malaysia', flag:'🇲🇾', group:'South East Asia', symbol:'RM',
    monthly: { amount:'106.99', display:'RM 106.99/mo',  stripeId:'price_1UCpDPSo2yKs7RdkRb8vwamn', paymentLink:'https://buy.stripe.com/9B6fZjbzN2Ty6P99R55J626' },
    yearly:  { amount:'513.99', display:'RM 513.99/yr', stripeId:'price_1UCpDRSo2yKs7Rdks33XnWmk', paymentLink:'https://buy.stripe.com/5kQ4gBavJdyc0qL6ET5J627', yearlyTotal:'RM 513.99' },
    tutorPrice: 'From RM 150/hr',
  },
  id: {
    label:'Indonesia', flag:'🇮🇩', group:'South East Asia', symbol:'Rp',
    monthly: { amount:'460588.99', display:'Rp 460,588/mo',  stripeId:'price_1UCpDUSo2yKs7RdkhD2N8Upo', paymentLink:'https://buy.stripe.com/28EcN7dHV8dSb5pbZd5J628' },
    yearly:  { amount:'2210827.99', display:'Rp 2,210,827/yr', stripeId:'price_1UCpDWSo2yKs7RdkhFdOSp3O', paymentLink:'https://buy.stripe.com/14A5kFdHVgKo1uPd3h5J629', yearlyTotal:'Rp 2,210,827' },
    tutorPrice: 'From Rp 500,000/hr',
  },
  ph: {
    label:'Philippines', flag:'🇵🇭', group:'South East Asia', symbol:'₱',
    monthly: { amount:'1555.99', display:'₱1,555/mo',  stripeId:'price_1UCpDZSo2yKs7RdklbaVdQhf', paymentLink:'https://buy.stripe.com/9B6eVfgU73XC0qL5AP5J62a' },
    yearly:  { amount:'7468.99', display:'₱7,468/yr', stripeId:'price_1UCpDbSo2yKs7RdkTAM65RLn', paymentLink:'https://buy.stripe.com/6oUdRbeLZdyc5L5e7l5J62b', yearlyTotal:'₱7,468' },
    tutorPrice: 'From ₱2,000/hr',
  },
  th: {
    label:'Thailand', flag:'🇹🇭', group:'South East Asia', symbol:'฿',
    monthly: { amount:'824.99', display:'฿824/mo',  stripeId:'price_1UCpDeSo2yKs7Rdk44ut0CAS', paymentLink:'https://buy.stripe.com/8x2eVfdHV1Pu3CXaV95J62c' },
    yearly:  { amount:'3959.99', display:'฿3,959/yr', stripeId:'price_1UCpDhSo2yKs7Rdkb7oNhN7p', paymentLink:'https://buy.stripe.com/fZubJ37jxgKo4H1gft5J62d', yearlyTotal:'฿3,959' },
    tutorPrice: 'From ฿1,500/hr',
  },
  jp: {
    /* Yen has no decimal subunit — Stripe/JPY amounts below are whole yen
     * (rounded from the target 4194.99 / 20135.99), not truncated .99s. */
    label:'Japan', flag:'🇯🇵', group:'South East Asia', symbol:'¥',
    monthly: { amount:'4195', display:'¥4,195/mo',  stripeId:'price_1UCpDJSo2yKs7Rdk3G7ME39z', paymentLink:'https://buy.stripe.com/3cIdRb1Zd0Lq2yT9R55J624' },
    yearly:  { amount:'20136', display:'¥20,136/yr', stripeId:'price_1UCpDMSo2yKs7RdkZZ70zvs5', paymentLink:'https://buy.stripe.com/fZu9AV9rF65Kddxgft5J625', yearlyTotal:'¥20,136' },
    tutorPrice: 'From ¥5,000/hr',
  },
  bd: {
    label:'Bangladesh', flag:'🇧🇩', group:'South Asia', symbol:'৳',
    monthly: { amount:'3132.99', display:'৳3,132/mo',  stripeId:'price_1UCpD4So2yKs7RdkIzXCUy8S', paymentLink:'https://buy.stripe.com/fZu5kFbzN3XC3CX4wL5J61Y' },
    yearly:  { amount:'15038.99', display:'৳15,038/yr', stripeId:'price_1UCpD6So2yKs7RdkxPw5Qwb8', paymentLink:'https://buy.stripe.com/3cI9AVdHVbq4b5p7IX5J61Z', yearlyTotal:'৳15,038' },
    tutorPrice: 'From ৳3,000/hr',
  },
  za: {
    label:'South Africa', flag:'🇿🇦', group:'Africa', symbol:'R',
    monthly: { amount:'469.99', display:'R469/mo',  stripeId:'price_1UCpD9So2yKs7RdkhBIakWnb', paymentLink:'https://buy.stripe.com/14AfZj8nB2Ty5L5gft5J620' },
    yearly:  { amount:'2255.99', display:'R2,255/yr', stripeId:'price_1UCpDBSo2yKs7Rdkj8vJBitb', paymentLink:'https://buy.stripe.com/28E3cx9rF51Gddx6ET5J621', yearlyTotal:'R2,255' },
    tutorPrice: 'From R500/hr',
  },
  ng: {
    label:'Nigeria', flag:'🇳🇬', group:'Africa', symbol:'₦',
    monthly: { amount:'34544.99', display:'₦34,544/mo',  stripeId:'price_1UCpDESo2yKs7RdkVS42HO4j', paymentLink:'https://buy.stripe.com/4gMcN733h9hW0qL9R55J622' },
    yearly:  { amount:'165815.99', display:'₦165,815/yr', stripeId:'price_1UCpDGSo2yKs7RdkqR23GEGD', paymentLink:'https://buy.stripe.com/bJe6oJdHVdyc4H1e7l5J623', yearlyTotal:'₦165,815' },
    tutorPrice: 'From ₦40,000/hr',
  },
  other: {
    label:'Other', flag:'🌍', group:'Other', symbol:'$',
    monthly: { amount:'26.99', display:'$26.99/mo',  stripeId:'price_1UCpDuSo2yKs7RdkF7dVbjJU', paymentLink:'https://buy.stripe.com/dRmbJ3bzN8dSa1l5AP5J62i' },
    yearly:  { amount:'129.99', display:'$129.99/yr', stripeId:'price_1UCpDwSo2yKs7RdkRCHF9cR7', paymentLink:'https://buy.stripe.com/bJecN71ZdeCg3CXgft5J62j', yearlyTotal:'$129.99' },
    tutorPrice: 'From $80/hr',
  },
};

/* Country code → Region mapping for IP detection.
 * EU_COUNTRIES = the 27 EU member states (minus UK, which is its own region)
 * — every one of them routes to the single 'eu' / Euro pricing region. */
const EU_COUNTRIES = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
];

export const COUNTRY_TO_REGION: Record<string, Region> = {
  US:'us', CA:'ca', GB:'uk', AU:'au', NZ:'nz',
  AE:'uae', SA:'sa', KW:'kw', QA:'qa', OM:'om', BH:'bh',
  IN:'in', SG:'sg', MY:'my', ID:'id', PH:'ph', TH:'th', JP:'jp',
  BD:'bd', ZA:'za', NG:'ng',
  ...Object.fromEntries(EU_COUNTRIES.map(c => [c, 'eu' as Region])),
};

/* Grouped regions for the selector UI */
export const REGION_GROUPS = [
  { label: 'US & Canada',   regions: ['us','ca'] as Region[] },
  { label: 'Europe',        regions: ['uk','eu'] as Region[] },
  { label: 'Gulf',          regions: ['uae','sa','kw','qa','om','bh'] as Region[] },
  { label: 'ANZ',           regions: ['au','nz'] as Region[] },
  { label: 'South Asia',    regions: ['in','bd'] as Region[] },
  { label: 'South East Asia', regions: ['sg','my','id','ph','th','jp'] as Region[] },
  { label: 'Africa',        regions: ['za','ng'] as Region[] },
  { label: 'Other',         regions: ['other'] as Region[] },
];

/* Stripe publishable key — replace with your real key */
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_REPLACE_WITH_YOUR_KEY';

/* ── Backward compatibility exports ─────────────────────────────
   Legacy pages (Dashboard, Pricing) still import these.
   We keep them until those pages are fully rebuilt.
   ─────────────────────────────────────────────────────────────── */
export const LEARN_ROUTE = '/learn';

export const PLANS: Array<{id:string; name:string; badge:string|undefined; monthly:Record<string,{symbol:string;amount:string;period:string;trialNote:string}>}> = [
  {
    id: 'monthly', name: 'Monthly', badge: undefined,
    monthly: {
      us:    { symbol:'$',    amount:'40.99',  period:'/mo', trialNote:'Then $40.99/mo after 7 days free' },
      uk:    { symbol:'£',    amount:'28.99',  period:'/mo', trialNote:'Then £28.99/mo after 7 days free' },
      uae:   { symbol:'AED ', amount:'156.99', period:'/mo', trialNote:'Then AED 156.99/mo after 7 days free' },
      india: { symbol:'₹',    amount:'3,600',  period:'/mo', trialNote:'Then ₹3,600/mo after 7 days free' },
    },
  },
  {
    id: 'annual', name: 'Annual', badge: 'Save 60%',
    monthly: {
      us:    { symbol:'$',    amount:'16.40',  period:'/mo', trialNote:'$196.75/year after 7 days free — save 60%' },
      uk:    { symbol:'£',    amount:'11.60',  period:'/mo', trialNote:'£139.15/year after 7 days free — save 60%' },
      uae:   { symbol:'AED ', amount:'62.80',  period:'/mo', trialNote:'AED 753.55/year after 7 days free — save 60%' },
      india: { symbol:'₹',    amount:'1,440',  period:'/mo', trialNote:'₹17,284/year after 7 days free — save 60%' },
    },
  },
];

export const REGIONS: { key: Region; label: string; flag: string }[] = [
  { key:'us',    label:'USA',   flag:'🇺🇸' },
  { key:'uk',    label:'UK',    flag:'🇬🇧' },
  { key:'uae',   label:'UAE',   flag:'🇦🇪' },
  { key:'in',    label:'India', flag:'🇮🇳' },
];
