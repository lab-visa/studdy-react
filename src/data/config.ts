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
  | 'us' | 'uk' | 'uae' | 'sa' | 'kw' | 'qa' | 'om' | 'bh'
  | 'au' | 'nz' | 'in' | 'sg' | 'bd' | 'za' | 'ng'
  | 'jp' | 'my' | 'id' | 'ph' | 'th' | 'ca' | 'other';

export interface RegionConfig {
  label: string;
  flag: string;
  group: string;
  symbol: string;
  monthly: { amount: string; display: string; stripeId: string; };
  yearly:  { amount: string; display: string; stripeId: string; yearlyTotal: string; };
  tutorPrice: string;  // human tutor comparison price
}

export const REGION_DATA: Record<Region, RegionConfig> = {
  us: {
    label:'United States', flag:'🇺🇸', group:'US & Canada', symbol:'$',
    monthly: { amount:'40.99', display:'$40.99/mo',  stripeId:'price_1U7wfBSo2yKs7RdkXcud1YvT' },
    yearly:  { amount:'196.75', display:'$196.75/yr', stripeId:'price_1U7xSPSo2yKs7RdkWvxH30Oy', yearlyTotal:'$196.75' },
    tutorPrice: 'From $80/hr',
  },
  ca: {
    label:'Canada', flag:'🇨🇦', group:'US & Canada', symbol:'CA$',
    monthly: { amount:'53.99', display:'CA$53.99/mo',  stripeId:'' },
    yearly:  { amount:'259.15', display:'CA$259.15/yr', stripeId:'', yearlyTotal:'CA$259.15' },
    tutorPrice: 'From CA$75/hr',
  },
  uk: {
    label:'United Kingdom', flag:'🇬🇧', group:'Europe', symbol:'£',
    monthly: { amount:'28.99', display:'£28.99/mo',  stripeId:'price_1U7xWiSo2yKs7RdkHG7keltc' },
    yearly:  { amount:'139.15', display:'£139.15/yr', stripeId:'price_1U7xXXSo2yKs7RdkgbluSKk6', yearlyTotal:'£139.15' },
    tutorPrice: 'From £60/hr',
  },
  uae: {
    label:'UAE', flag:'🇦🇪', group:'Gulf', symbol:'AED',
    monthly: { amount:'156.99', display:'AED 156.99/mo',  stripeId:'' },
    yearly:  { amount:'753.55', display:'AED 753.55/yr', stripeId:'', yearlyTotal:'AED 753.55' },
    tutorPrice: 'From AED 250/hr',
  },
  sa: {
    label:'Saudi Arabia', flag:'🇸🇦', group:'Gulf', symbol:'SAR',
    monthly: { amount:'156.99', display:'SAR 156.99/mo',  stripeId:'' },
    yearly:  { amount:'753.55', display:'SAR 753.55/yr', stripeId:'', yearlyTotal:'SAR 753.55' },
    tutorPrice: 'From SAR 200/hr',
  },
  kw: {
    label:'Kuwait', flag:'🇰🇼', group:'Gulf', symbol:'KWD',
    monthly: { amount:'12.99', display:'KWD 12.99/mo',  stripeId:'' },
    yearly:  { amount:'62.35', display:'KWD 62.35/yr', stripeId:'', yearlyTotal:'KWD 62.35' },
    tutorPrice: 'From KWD 15/hr',
  },
  qa: {
    label:'Qatar', flag:'🇶🇦', group:'Gulf', symbol:'QAR',
    monthly: { amount:'156.99', display:'QAR 156.99/mo',  stripeId:'' },
    yearly:  { amount:'753.55', display:'QAR 753.55/yr', stripeId:'', yearlyTotal:'QAR 753.55' },
    tutorPrice: 'From QAR 200/hr',
  },
  om: {
    label:'Oman', flag:'🇴🇲', group:'Gulf', symbol:'OMR',
    monthly: { amount:'15.99', display:'OMR 15.99/mo',  stripeId:'' },
    yearly:  { amount:'76.75', display:'OMR 76.75/yr', stripeId:'', yearlyTotal:'OMR 76.75' },
    tutorPrice: 'From OMR 20/hr',
  },
  bh: {
    label:'Bahrain', flag:'🇧🇭', group:'Gulf', symbol:'BHD',
    monthly: { amount:'15.99', display:'BHD 15.99/mo',  stripeId:'' },
    yearly:  { amount:'76.75', display:'BHD 76.75/yr', stripeId:'', yearlyTotal:'BHD 76.75' },
    tutorPrice: 'From BHD 20/hr',
  },
  au: {
    label:'Australia', flag:'🇦🇺', group:'ANZ', symbol:'A$',
    monthly: { amount:'55.99', display:'A$55.99/mo',  stripeId:'' },
    yearly:  { amount:'268.75', display:'A$268.75/yr', stripeId:'', yearlyTotal:'A$268.75' },
    tutorPrice: 'From A$90/hr',
  },
  nz: {
    label:'New Zealand', flag:'🇳🇿', group:'ANZ', symbol:'NZ$',
    monthly: { amount:'66.99', display:'NZ$66.99/mo',  stripeId:'' },
    yearly:  { amount:'321.55', display:'NZ$321.55/yr', stripeId:'', yearlyTotal:'NZ$321.55' },
    tutorPrice: 'From NZ$80/hr',
  },
  in: {
    label:'India', flag:'🇮🇳', group:'South Asia', symbol:'₹',
    monthly: { amount:'3600.99', display:'₹3,600/mo',  stripeId:'' },
    yearly:  { amount:'17284.75', display:'₹17,284/yr', stripeId:'', yearlyTotal:'₹17,284' },
    tutorPrice: 'From ₹1,500/hr',
  },
  sg: {
    label:'Singapore', flag:'🇸🇬', group:'South East Asia', symbol:'S$',
    monthly: { amount:'50.99', display:'S$50.99/mo',  stripeId:'' },
    yearly:  { amount:'244.75', display:'S$244.75/yr', stripeId:'', yearlyTotal:'S$244.75' },
    tutorPrice: 'From S$80/hr',
  },
  my: {
    label:'Malaysia', flag:'🇲🇾', group:'South East Asia', symbol:'RM',
    monthly: { amount:'163.99', display:'RM 163.99/mo',  stripeId:'' },
    yearly:  { amount:'787.15', display:'RM 787.15/yr', stripeId:'', yearlyTotal:'RM 787.15' },
    tutorPrice: 'From RM 150/hr',
  },
  id: {
    label:'Indonesia', flag:'🇮🇩', group:'South East Asia', symbol:'Rp',
    monthly: { amount:'705882.99', display:'Rp 705,882/mo',  stripeId:'' },
    yearly:  { amount:'3388238.35', display:'Rp 3,388,238/yr', stripeId:'', yearlyTotal:'Rp 3,388,238' },
    tutorPrice: 'From Rp 500,000/hr',
  },
  ph: {
    label:'Philippines', flag:'🇵🇭', group:'South East Asia', symbol:'₱',
    monthly: { amount:'2384.99', display:'₱2,384/mo',  stripeId:'' },
    yearly:  { amount:'11447.95', display:'₱11,447/yr', stripeId:'', yearlyTotal:'₱11,447' },
    tutorPrice: 'From ₱2,000/hr',
  },
  th: {
    label:'Thailand', flag:'🇹🇭', group:'South East Asia', symbol:'฿',
    monthly: { amount:'1263.99', display:'฿1,263/mo',  stripeId:'' },
    yearly:  { amount:'6067.15', display:'฿6,067/yr', stripeId:'', yearlyTotal:'฿6,067' },
    tutorPrice: 'From ฿1,500/hr',
  },
  jp: {
    label:'Japan', flag:'🇯🇵', group:'South East Asia', symbol:'¥',
    monthly: { amount:'6428.99', display:'¥6,428/mo',  stripeId:'' },
    yearly:  { amount:'30859.15', display:'¥30,859/yr', stripeId:'', yearlyTotal:'¥30,859' },
    tutorPrice: 'From ¥5,000/hr',
  },
  bd: {
    label:'Bangladesh', flag:'🇧🇩', group:'South Asia', symbol:'৳',
    monthly: { amount:'4800.99', display:'৳4,800/mo',  stripeId:'' },
    yearly:  { amount:'23044.75', display:'৳23,044/yr', stripeId:'', yearlyTotal:'৳23,044' },
    tutorPrice: 'From ৳3,000/hr',
  },
  za: {
    label:'South Africa', flag:'🇿🇦', group:'Africa', symbol:'R',
    monthly: { amount:'720.99', display:'R720/mo',  stripeId:'' },
    yearly:  { amount:'3460.75', display:'R3,460/yr', stripeId:'', yearlyTotal:'R3,460' },
    tutorPrice: 'From R500/hr',
  },
  ng: {
    label:'Nigeria', flag:'🇳🇬', group:'Africa', symbol:'₦',
    monthly: { amount:'52941.99', display:'₦52,941/mo',  stripeId:'' },
    yearly:  { amount:'254121.55', display:'₦254,121/yr', stripeId:'', yearlyTotal:'₦254,121' },
    tutorPrice: 'From ₦40,000/hr',
  },
  other: {
    label:'Other', flag:'🌍', group:'Other', symbol:'$',
    monthly: { amount:'40.99', display:'$40.99/mo',  stripeId:'price_1U7wfBSo2yKs7RdkXcud1YvT' },
    yearly:  { amount:'196.75', display:'$196.75/yr', stripeId:'price_1U7xSPSo2yKs7RdkWvxH30Oy', yearlyTotal:'$196.75' },
    tutorPrice: 'From $80/hr',
  },
};

/* Country code → Region mapping for IP detection */
export const COUNTRY_TO_REGION: Record<string, Region> = {
  US:'us', CA:'ca', GB:'uk', AU:'au', NZ:'nz',
  AE:'uae', SA:'sa', KW:'kw', QA:'qa', OM:'om', BH:'bh',
  IN:'in', SG:'sg', MY:'my', ID:'id', PH:'ph', TH:'th', JP:'jp',
  BD:'bd', ZA:'za', NG:'ng',
};

/* Grouped regions for the selector UI */
export const REGION_GROUPS = [
  { label: 'US & Canada',   regions: ['us','ca'] as Region[] },
  { label: 'Europe',        regions: ['uk'] as Region[] },
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
