export type Region = 'us' | 'uk' | 'uae' | 'india';

export const pricingData: Record<Region, { symbol: string; weekly: string; yearlyWeek: string; yearlyTotal: string; trial: boolean }> = {
  us:    { symbol: '$',    weekly: '9.99',  yearlyWeek: '3.15',  yearlyTotal: '164',   trial: true },
  uk:    { symbol: '£',    weekly: '7.49',  yearlyWeek: '2.36',  yearlyTotal: '123',   trial: true },
  uae:   { symbol: 'AED ', weekly: '35.99', yearlyWeek: '12.11', yearlyTotal: '630',   trial: true },
  india: { symbol: '₹',    weekly: '',      yearlyWeek: '',      yearlyTotal: '1,999', trial: false },
};

export const regions: { key: Region; label: string; flag: string }[] = [
  { key: 'us',    label: 'USA',   flag: '🇺🇸' },
  { key: 'uk',    label: 'UK',    flag: '🇬🇧' },
  { key: 'uae',   label: 'UAE',   flag: '🇦🇪' },
  { key: 'india', label: 'India', flag: '🇮🇳' },
];
