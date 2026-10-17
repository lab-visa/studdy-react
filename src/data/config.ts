// ── CENTRAL CONFIGURATION ──
// All pricing, Stripe Price IDs and regional data live here.
// To change a price: update amount + stripeMonthlyId / stripeYearlyId.

/* One shared support number for everyone for now (per Vish, Aug 2026).
 * Locked decision was USA number for USA / UK number for everyone else -
 * once the USA number exists, split this by region the same way pricing
 * already is. */
export const SUPPORT_WHATSAPP_NUMBER = '447587357644';
const SUPPORT_WHATSAPP_MESSAGE = "Hi! I'm a Studdy Lab customer and need some help.";
export const SUPPORT_WHATSAPP =
  `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MESSAGE)}`;
/* Oct 2026 (Vish): customer-facing addresses moved to studdyai.org.
 * support@ for customers, hello@ for general enquiries, hr@ for careers. */
export const SUPPORT_EMAIL    = 'support@studdyai.org';
export const HELLO_EMAIL      = 'hello@studdyai.org';
export const HR_EMAIL         = 'hr@studdyai.org';
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

/* Oct 2026 repricing (Vish's table): every region below points at a NEW
 * Stripe price + payment link on the SAME product as the Sep 2026 set.
 * KW/OM/BH and Other are charged in USD at the US price ($30.99/$172.99);
 * JPY/IDR are whole-unit amounts (¥4,799/¥26,799, Rp 524,999/Rp 2,939,999).
 *
 * Earlier note - FIX (Sep 2026 repricing, Vish): full 22-country + Other repricing.
 * Every region below now points at a brand-new Stripe product/price pair
 * (nothing from the pre-Sep-2026 catalog was touched or archived).
 * Kuwait, Oman and Bahrain are priced and charged in USD, NOT their local
 * currency (KWD/OMR/BHD) - this Stripe account can't settle in those three
 * currencies, so per Vish's explicit fallback instruction they use the same
 * $26.99/mo, $129.99/yr as US/Other. symbol/amount/display below reflect the
 * ACTUAL USD charge for those three, not the original local-currency target
 * numbers, so the price shown pre-checkout matches what Stripe actually bills. */
export const REGION_DATA: Record<Region, RegionConfig> = {
  us: {
    label:'United States', flag:'🇺🇸', group:'US & Canada', symbol:'$',
    monthly: { amount:'30.99', display:'$30.99/mo',  stripeId:'price_1URWXJSo2yKs7Rdk0pKl5I7q', paymentLink:'https://buy.stripe.com/6oU9AVgU765Kb5pbZd5J62k' },
    yearly:  { amount:'172.99', display:'$172.99/yr', stripeId:'price_1URWXYSo2yKs7RdkBizWYKL9', paymentLink:'https://buy.stripe.com/cNi8wRdHVdycflF2oD5J62l', yearlyTotal:'$172.99' },
    tutorPrice: 'From $80/hr',
  },
  ca: {
    label:'Canada', flag:'🇨🇦', group:'US & Canada', symbol:'CA$',
    monthly: { amount:'40.99', display:'CA$40.99/mo',  stripeId:'price_1URWXdSo2yKs7RdkDnlhjGvu', paymentLink:'https://buy.stripe.com/bJe5kF33h3XCa1le7l5J62m' },
    yearly:  { amount:'229.99', display:'CA$229.99/yr', stripeId:'price_1URWXhSo2yKs7Rdkcx6t1lyL', paymentLink:'https://buy.stripe.com/9B69AVavJ3XC3CX6ET5J62n', yearlyTotal:'CA$229.99' },
    tutorPrice: 'From CA$75/hr',
  },
  uk: {
    label:'United Kingdom', flag:'🇬🇧', group:'Europe', symbol:'£',
    monthly: { amount:'21.99', display:'£21.99/mo',  stripeId:'price_1URWXnSo2yKs7RdkOuWLe3yw', paymentLink:'https://buy.stripe.com/bJe5kFfQ32Ty1uP0gv5J62o' },
    yearly:  { amount:'121.99', display:'£121.99/yr', stripeId:'price_1URWXrSo2yKs7RdkTFzHxsgp', paymentLink:'https://buy.stripe.com/4gM3cx9rFdyc6P9fbp5J62p', yearlyTotal:'£121.99' },
    tutorPrice: 'From £60/hr',
  },
  eu: {
    label:'European Union', flag:'🇪🇺', group:'Europe', symbol:'€',
    monthly: { amount:'24.99', display:'€24.99/mo',  stripeId:'price_1URWXvSo2yKs7RdkNr8FqJpI', paymentLink:'https://buy.stripe.com/fZu8wR1Zd9hWddx5AP5J62q' },
    yearly:  { amount:'140.99', display:'€140.99/yr', stripeId:'price_1URWXzSo2yKs7Rdk9CAbwXQk', paymentLink:'https://buy.stripe.com/3cIcN77jx0LqehBfbp5J62r', yearlyTotal:'€140.99' },
    tutorPrice: 'From €65/hr',
  },
  uae: {
    label:'UAE', flag:'🇦🇪', group:'Gulf', symbol:'AED',
    monthly: { amount:'116.99', display:'AED 116.99/mo',  stripeId:'price_1URWY3So2yKs7RdkHjzNcpkF', paymentLink:'https://buy.stripe.com/aFa3cxcDR3XC1uP9R55J62s' },
    yearly:  { amount:'657.99', display:'AED 657.99/yr', stripeId:'price_1URWY7So2yKs7RdkyTNiaEa8', paymentLink:'https://buy.stripe.com/28E3cxeLZgKoehB3sH5J62t', yearlyTotal:'AED 657.99' },
    tutorPrice: 'From AED 250/hr',
  },
  sa: {
    label:'Saudi Arabia', flag:'🇸🇦', group:'Gulf', symbol:'SAR',
    monthly: { amount:'116.99', display:'SAR 116.99/mo',  stripeId:'price_1URWYASo2yKs7Rdk7YA4q9T7', paymentLink:'https://buy.stripe.com/28EbJ3gU7dyc3CXbZd5J62u' },
    yearly:  { amount:'657.99', display:'SAR 657.99/yr', stripeId:'price_1URWYESo2yKs7RdknQgKtrqz', paymentLink:'https://buy.stripe.com/eVq28tgU7gKoc9tbZd5J62v', yearlyTotal:'SAR 657.99' },
    tutorPrice: 'From SAR 200/hr',
  },
  kw: {
    /* USD fallback - see file-level note above. */
    label:'Kuwait', flag:'🇰🇼', group:'Gulf', symbol:'$',
    monthly: { amount:'30.99', display:'$30.99/mo',  stripeId:'price_1URWYRSo2yKs7RdkZyrPDgED', paymentLink:'https://buy.stripe.com/6oU28t7jx1Pu2yT8N15J62w' },
    yearly:  { amount:'172.99', display:'$172.99/yr', stripeId:'price_1URWYVSo2yKs7RdkZy0AVWsn', paymentLink:'https://buy.stripe.com/7sY28t33h79O7TdbZd5J62x', yearlyTotal:'$172.99' },
    tutorPrice: 'From KWD 15/hr',
  },
  qa: {
    label:'Qatar', flag:'🇶🇦', group:'Gulf', symbol:'QAR',
    monthly: { amount:'116.99', display:'QAR 116.99/mo',  stripeId:'price_1URWYZSo2yKs7Rdkwq3Pc7au', paymentLink:'https://buy.stripe.com/4gMcN70V9eCg2yTgft5J62y' },
    yearly:  { amount:'657.99', display:'QAR 657.99/yr', stripeId:'price_1URWYeSo2yKs7RdkwIw0RorX', paymentLink:'https://buy.stripe.com/8x228t8nB65K8Xhgft5J62z', yearlyTotal:'QAR 657.99' },
    tutorPrice: 'From QAR 200/hr',
  },
  om: {
    /* USD fallback - see file-level note above. */
    label:'Oman', flag:'🇴🇲', group:'Gulf', symbol:'$',
    monthly: { amount:'30.99', display:'$30.99/mo',  stripeId:'price_1URWYkSo2yKs7RdkmA3qDkoC', paymentLink:'https://buy.stripe.com/5kQdRbgU7am02yTaV95J62A' },
    yearly:  { amount:'172.99', display:'$172.99/yr', stripeId:'price_1URWYqSo2yKs7RdkaDS5xTcM', paymentLink:'https://buy.stripe.com/eVq6oJbzN79O5L58N15J62B', yearlyTotal:'$172.99' },
    tutorPrice: 'From OMR 20/hr',
  },
  bh: {
    /* USD fallback - see file-level note above. */
    label:'Bahrain', flag:'🇧🇭', group:'Gulf', symbol:'$',
    monthly: { amount:'30.99', display:'$30.99/mo',  stripeId:'price_1URWYuSo2yKs7RdkIycvoMpv', paymentLink:'https://buy.stripe.com/14AcN79rFeCg1uPgft5J62C' },
    yearly:  { amount:'172.99', display:'$172.99/yr', stripeId:'price_1URWYySo2yKs7RdkLo8xq9dK', paymentLink:'https://buy.stripe.com/fZu6oJ0V9dyc3CXbZd5J62D', yearlyTotal:'$172.99' },
    tutorPrice: 'From BHD 20/hr',
  },
  au: {
    label:'Australia', flag:'🇦🇺', group:'ANZ', symbol:'A$',
    monthly: { amount:'41.99', display:'A$41.99/mo',  stripeId:'price_1URWZ2So2yKs7RdkXLQN8STU', paymentLink:'https://buy.stripe.com/3cI9AVdHVeCg6P93sH5J62E' },
    yearly:  { amount:'236.99', display:'A$236.99/yr', stripeId:'price_1URWZ6So2yKs7RdkzpoAj5K5', paymentLink:'https://buy.stripe.com/eVqcN7dHVeCga1l0gv5J62F', yearlyTotal:'A$236.99' },
    tutorPrice: 'From A$90/hr',
  },
  nz: {
    label:'New Zealand', flag:'🇳🇿', group:'ANZ', symbol:'NZ$',
    monthly: { amount:'49.99', display:'NZ$49.99/mo',  stripeId:'price_1URWZASo2yKs7Rdk7jvLoN0W', paymentLink:'https://buy.stripe.com/cNiaEZdHVgKo0qL8N15J62G' },
    yearly:  { amount:'280.99', display:'NZ$280.99/yr', stripeId:'price_1URWZFSo2yKs7RdklC06Qd0D', paymentLink:'https://buy.stripe.com/6oU14pfQ3bq4flFbZd5J62H', yearlyTotal:'NZ$280.99' },
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
    monthly: { amount:'38.99', display:'S$38.99/mo',  stripeId:'price_1URWZQSo2yKs7RdkZFGB6aRM', paymentLink:'https://buy.stripe.com/3cI7sN7jx65K6P9aV95J62I' },
    yearly:  { amount:'216.99', display:'S$216.99/yr', stripeId:'price_1URWZUSo2yKs7Rdkbzab99eC', paymentLink:'https://buy.stripe.com/8x26oJbzNcu87TdaV95J62J', yearlyTotal:'S$216.99' },
    tutorPrice: 'From S$80/hr',
  },
  my: {
    label:'Malaysia', flag:'🇲🇾', group:'South East Asia', symbol:'RM',
    monthly: { amount:'121.99', display:'RM 121.99/mo',  stripeId:'price_1URWZYSo2yKs7RdkSzicKgBB', paymentLink:'https://buy.stripe.com/6oUaEZ8nB79OehBgft5J62K' },
    yearly:  { amount:'682.99', display:'RM 682.99/yr', stripeId:'price_1URWZdSo2yKs7RdkAvevxtoc', paymentLink:'https://buy.stripe.com/6oU7sN5bpdyc1uP7IX5J62L', yearlyTotal:'RM 682.99' },
    tutorPrice: 'From RM 150/hr',
  },
  id: {
    label:'Indonesia', flag:'🇮🇩', group:'South East Asia', symbol:'Rp',
    monthly: { amount:'524999', display:'Rp 524,999/mo',  stripeId:'price_1URWZgSo2yKs7RdkdrJjycy2', paymentLink:'https://buy.stripe.com/dRmfZj0V979Oa1ld3h5J62M' },
    yearly:  { amount:'2939999', display:'Rp 2,939,999/yr', stripeId:'price_1URWZmSo2yKs7RdkvOiyscqo', paymentLink:'https://buy.stripe.com/28EcN747l9hW1uP5AP5J62N', yearlyTotal:'Rp 2,939,999' },
    tutorPrice: 'From Rp 500,000/hr',
  },
  ph: {
    label:'Philippines', flag:'🇵🇭', group:'South East Asia', symbol:'₱',
    monthly: { amount:'1765.99', display:'₱1,765/mo',  stripeId:'price_1URWZqSo2yKs7RdkwPeKRjBK', paymentLink:'https://buy.stripe.com/bJe6oJdHVam05L51kz5J62O' },
    yearly:  { amount:'9931.99', display:'₱9,931/yr', stripeId:'price_1URWZvSo2yKs7RdkLpQ7NyG5', paymentLink:'https://buy.stripe.com/eVqcN747l3XCa1l9R55J62P', yearlyTotal:'₱9,931' },
    tutorPrice: 'From ₱2,000/hr',
  },
  th: {
    label:'Thailand', flag:'🇹🇭', group:'South East Asia', symbol:'฿',
    monthly: { amount:'936.99', display:'฿936/mo',  stripeId:'price_1URWa0So2yKs7RdkF3sRJO9y', paymentLink:'https://buy.stripe.com/5kQ7sNcDRfGk2yT8N15J62Q' },
    yearly:  { amount:'5265.99', display:'฿5,265/yr', stripeId:'price_1URWa4So2yKs7Rdkht1GmfpK', paymentLink:'https://buy.stripe.com/fZu8wReLZ9hW6P92oD5J62R', yearlyTotal:'฿5,265' },
    tutorPrice: 'From ฿1,500/hr',
  },
  jp: {
    /* Yen has no decimal subunit - Stripe/JPY amounts below are whole yen
     * (rounded from the target 4194.99 / 20135.99), not truncated .99s. */
    label:'Japan', flag:'🇯🇵', group:'South East Asia', symbol:'¥',
    monthly: { amount:'4799', display:'¥4,799/mo',  stripeId:'price_1URWa7So2yKs7RdkAyG5IxX3', paymentLink:'https://buy.stripe.com/8x228t0V9cu81uP9R55J62S' },
    yearly:  { amount:'26799', display:'¥26,799/yr', stripeId:'price_1URWaCSo2yKs7RdkQL6CcZiw', paymentLink:'https://buy.stripe.com/eVq14p47lcu84H1fbp5J62T', yearlyTotal:'¥26,799' },
    tutorPrice: 'From ¥5,000/hr',
  },
  bd: {
    label:'Bangladesh', flag:'🇧🇩', group:'South Asia', symbol:'৳',
    monthly: { amount:'3555.99', display:'৳3,555/mo',  stripeId:'price_1URWaNSo2yKs7Rdk2GI5tbYJ', paymentLink:'https://buy.stripe.com/eVq8wR47l2Ty3CX1kz5J62U' },
    yearly:  { amount:'19997.99', display:'৳19,997/yr', stripeId:'price_1URWaRSo2yKs7Rdk5nAvjSur', paymentLink:'https://buy.stripe.com/9B66oJfQ351Gb5pbZd5J62V', yearlyTotal:'৳19,997' },
    tutorPrice: 'From ৳3,000/hr',
  },
  za: {
    label:'South Africa', flag:'🇿🇦', group:'Africa', symbol:'R',
    monthly: { amount:'533.99', display:'R533/mo',  stripeId:'price_1URWaVSo2yKs7RdkgfB45tOJ', paymentLink:'https://buy.stripe.com/14A7sN1Zd79O1uPbZd5J62W' },
    yearly:  { amount:'2999.99', display:'R2,999/yr', stripeId:'price_1URWaZSo2yKs7Rdkpg8SPwgn', paymentLink:'https://buy.stripe.com/6oUdRb1Zd51G7Tde7l5J62X', yearlyTotal:'R2,999' },
    tutorPrice: 'From R500/hr',
  },
  ng: {
    label:'Nigeria', flag:'🇳🇬', group:'Africa', symbol:'₦',
    monthly: { amount:'39205.99', display:'₦39,205/mo',  stripeId:'price_1URWadSo2yKs7Rdkzbgkf6Jh', paymentLink:'https://buy.stripe.com/eVqeVfeLZ0LqflFe7l5J62Y' },
    yearly:  { amount:'220500.99', display:'₦220,500/yr', stripeId:'price_1URWahSo2yKs7RdkCCxmruyt', paymentLink:'https://buy.stripe.com/aFa6oJ7jx3XC7Td0gv5J62Z', yearlyTotal:'₦220,500' },
    tutorPrice: 'From ₦40,000/hr',
  },
  other: {
    label:'Other', flag:'🌍', group:'Other', symbol:'$',
    monthly: { amount:'30.99', display:'$30.99/mo',  stripeId:'price_1URWalSo2yKs7RdkNYaKZ3FB', paymentLink:'https://buy.stripe.com/eVq4gB47l51G2yT1kz5J630' },
    yearly:  { amount:'172.99', display:'$172.99/yr', stripeId:'price_1URWapSo2yKs7RdkyxCLH4cU', paymentLink:'https://buy.stripe.com/aFabJ37jx65K8Xh6ET5J631', yearlyTotal:'$172.99' },
    tutorPrice: 'From $80/hr',
  },
};

/* Country code → Region mapping for IP detection.
 * EU_COUNTRIES = the 27 EU member states (minus UK, which is its own region)
 * - every one of them routes to the single 'eu' / Euro pricing region. */
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

/* Stripe publishable key - replace with your real key */
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
      us:    { symbol:'$',    amount:'16.40',  period:'/mo', trialNote:'$196.75/year after 7 days free - save 60%' },
      uk:    { symbol:'£',    amount:'11.60',  period:'/mo', trialNote:'£139.15/year after 7 days free - save 60%' },
      uae:   { symbol:'AED ', amount:'62.80',  period:'/mo', trialNote:'AED 753.55/year after 7 days free - save 60%' },
      india: { symbol:'₹',    amount:'1,440',  period:'/mo', trialNote:'₹17,284/year after 7 days free - save 60%' },
    },
  },
];

export const REGIONS: { key: Region; label: string; flag: string }[] = [
  { key:'us',    label:'USA',   flag:'🇺🇸' },
  { key:'uk',    label:'UK',    flag:'🇬🇧' },
  { key:'uae',   label:'UAE',   flag:'🇦🇪' },
  { key:'in',    label:'India', flag:'🇮🇳' },
];

/** Legal entity that owns and operates Studdy Lab (must match the payment
 * gateway KYC; Cashfree asked for it on the site, Oct 2026). */
export const LEGAL_ENTITY = 'Unischooly';
