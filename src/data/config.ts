// ── CENTRAL CONFIGURATION ──
// All pricing, support links and plan data sourced from here.
// Never hardcode values elsewhere.

export const SUPPORT_WHATSAPP = 'https://wa.me/message/PLACEHOLDER'; // Replace with real number
export const SUPPORT_EMAIL    = 'hello@studdylab.com';
export const LEARN_ROUTE      = '/learn'; // Internal placeholder, never direct to studdyai.com

export const TRIAL_DAYS = 7;

export type PlanId = 'monthly' | 'annual';
export type Region = 'us' | 'uk' | 'uae' | 'india';

export interface Plan {
  id: PlanId;
  name: string;
  badge?: string;
  monthly: Record<Region, { symbol: string; amount: string; period: string; trialNote: string }>;
}

export const PLANS: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    monthly: {
      us:    { symbol:'$',    amount:'19.99', period:'/month', trialNote:'Then $19.99/month after 7 days free' },
      uk:    { symbol:'£',    amount:'15.99', period:'/month', trialNote:'Then £15.99/month after 7 days free' },
      uae:   { symbol:'AED ', amount:'74.99', period:'/month', trialNote:'Then AED 74.99/month after 7 days free' },
      india: { symbol:'₹',    amount:'999',   period:'/month', trialNote:'Then ₹999/month after 7 days free' },
    },
  },
  {
    id: 'annual',
    name: 'Annual',
    badge: 'Best Value',
    monthly: {
      us:    { symbol:'$',    amount:'9.99',  period:'/month', trialNote:'$119.99/year after 7 days free — save 50%' },
      uk:    { symbol:'£',    amount:'7.99',  period:'/month', trialNote:'£95.99/year after 7 days free — save 50%' },
      uae:   { symbol:'AED ', amount:'36.99', period:'/month', trialNote:'AED 443.99/year after 7 days free — save 50%' },
      india: { symbol:'₹',    amount:'499',   period:'/month', trialNote:'₹5,999/year after 7 days free — save 50%' },
    },
  },
];

export const REGIONS: { key: Region; label: string; flag: string }[] = [
  { key:'us',    label:'USA',   flag:'🇺🇸' },
  { key:'uk',    label:'UK',    flag:'🇬🇧' },
  { key:'uae',   label:'UAE',   flag:'🇦🇪' },
  { key:'india', label:'India', flag:'🇮🇳' },
];
