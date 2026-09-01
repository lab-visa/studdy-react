-- ============================================================
-- HISTORICAL BASELINE — ALREADY APPLIED TO PRODUCTION.
-- Confirmed live via CRM-0B (read-only Supabase verification,
-- Aug 2026). Committed here for version-control history only.
-- DO NOT RE-RUN THIS FILE AGAINST PRODUCTION.
-- ============================================================
-- 0002_pricing.sql
--
-- New table. Mirrors src/data/config.ts's REGION_DATA exactly as audited
-- (live production values) — this migration does NOT change public
-- pricing or any Stripe Payment Link. The frontend keeps reading
-- config.ts unchanged; this table is the CRM's own copy for reporting
-- and future admin-editable pricing, and is not wired into checkout yet.
--
-- pricing_region is the same code used throughout the CRM as "Pricing
-- Region" (kept deliberately distinct from customers.state_province,
-- which is the raw geo/billing-address field).

create table if not exists pricing (
  pricing_region        text primary key,
  label                  text not null,
  flag                   text,
  group_name             text,
  currency_symbol        text not null,
  monthly_amount         numeric,
  monthly_display        text,
  monthly_stripe_price_id text,
  monthly_payment_link   text,
  yearly_amount          numeric,
  yearly_display         text,
  yearly_stripe_price_id text,
  yearly_payment_link    text,
  tutor_price            text,
  is_live                boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table pricing is
  'CRM copy of the live pricing matrix (source: src/data/config.ts, audited Aug 2026). Reporting only for now — checkout continues to read config.ts directly.';

insert into pricing (pricing_region, label, flag, group_name, currency_symbol,
  monthly_amount, monthly_display, monthly_stripe_price_id, monthly_payment_link,
  yearly_amount, yearly_display, yearly_stripe_price_id, yearly_payment_link,
  tutor_price, is_live)
values
  ('us',  'United States',   '🇺🇸', 'US & Canada', '$',
    40.99,   '$40.99/mo',   'price_1U7wfBSo2yKs7RdkXcud1YvT', 'https://buy.stripe.com/14A5kFavJdycddxbZd5J61h',
    196.75,  '$196.75/yr',  'price_1U7xSPSo2yKs7RdkWvxH30Oy', 'https://buy.stripe.com/eVqdRbgU7gKogpJ5AP5J61i',
    'From $80/hr', true),
  ('ca',  'Canada',          '🇨🇦', 'US & Canada', 'CA$',
    53.99,   'CA$53.99/mo', 'price_1U8lOESo2yKs7Rdk5jKP5WUo', 'https://buy.stripe.com/dRmeVf47lam07TdaV95J61l',
    259.15,  'CA$259.15/yr','price_1U8lOkSo2yKs7RdkHrAjxKdR', 'https://buy.stripe.com/4gMdRbeLZ1PugpJ2oD5J61m',
    'From CA$75/hr', true),
  ('uk',  'United Kingdom',  '🇬🇧', 'Europe', '£',
    28.99,   '£28.99/mo',   'price_1U7xWiSo2yKs7RdkHG7keltc', 'https://buy.stripe.com/5kQ6oJ0V99hWddxfbp5J61j',
    139.15,  '£139.15/yr',  'price_1U7xXXSo2yKs7RdkgbluSKk6', 'https://buy.stripe.com/4gMaEZbzN79OehB5AP5J61k',
    'From £60/hr', true),
  ('eu',  'European Union',  '🇪🇺', 'Europe', '€',
    33.99,   '€33.99/mo',   'price_1U8lRBSo2yKs7Rdk3NdqABsP', 'https://buy.stripe.com/6oUaEZgU7cu82yTe7l5J61n',
    163.15,  '€163.15/yr',  'price_1U8lRgSo2yKs7RdkRBujRf4E', 'https://buy.stripe.com/dRmbJ3gU7am05L51kz5J61o',
    'From €65/hr', true),
  ('uae', 'UAE',             '🇦🇪', 'Gulf', 'AED',
    156.99,  'AED 156.99/mo','price_1U935BSo2yKs7RdkgmBkICye','https://buy.stripe.com/00w3cx9rF3XCc9t2oD5J61p',
    753.55,  'AED 753.55/yr','price_1U9363So2yKs7RdkIyRoeDua','https://buy.stripe.com/bJedRb7jx1Pu3CX8N15J61q',
    'From AED 250/hr', true),
  ('sa',  'Saudi Arabia',    '🇸🇦', 'Gulf', 'SAR',
    156.99,  'SAR 156.99/mo','price_1U937nSo2yKs7RdkFiTCsdN1','https://buy.stripe.com/00w7sNbzN3XC2yT4wL5J61r',
    753.55,  'SAR 753.55/yr','price_1U938ISo2yKs7RdktCUsFQgW','https://buy.stripe.com/14A00ldHV65Kddx8N15J61s',
    'From SAR 200/hr', true),
  ('kw',  'Kuwait',          '🇰🇼', 'Gulf', 'KWD', 12.99,'KWD 12.99/mo',null,null, 62.35,'KWD 62.35/yr',null,null, 'From KWD 15/hr', false),
  ('qa',  'Qatar',           '🇶🇦', 'Gulf', 'QAR', 156.99,'QAR 156.99/mo',null,null, 753.55,'QAR 753.55/yr',null,null, 'From QAR 200/hr', false),
  ('om',  'Oman',            '🇴🇲', 'Gulf', 'OMR', 15.99,'OMR 15.99/mo',null,null, 76.75,'OMR 76.75/yr',null,null, 'From OMR 20/hr', false),
  ('bh',  'Bahrain',         '🇧🇭', 'Gulf', 'BHD', 15.99,'BHD 15.99/mo',null,null, 76.75,'BHD 76.75/yr',null,null, 'From BHD 20/hr', false),
  ('au',  'Australia',       '🇦🇺', 'ANZ', 'A$',
    55.99,   'A$55.99/mo',  'price_1U93ABSo2yKs7RdkGT4nAxHk','https://buy.stripe.com/8x2cN7bzN51Gc9tgft5J61t',
    268.75,  'A$268.75/yr', 'price_1U93AgSo2yKs7RdkBVc3OAhv','https://buy.stripe.com/3cI8wR7jx8dS8Xh6ET5J61u',
    'From A$90/hr', true),
  ('nz',  'New Zealand',     '🇳🇿', 'ANZ', 'NZ$', 66.99,'NZ$66.99/mo',null,null, 321.55,'NZ$321.55/yr',null,null, 'From NZ$80/hr', false),
  ('in',  'India',           '🇮🇳', 'South Asia', '₹',
    3600.99, '₹3,600/mo',   'price_1U93CISo2yKs7Rdk5wlFgay8','https://buy.stripe.com/bJe7sN5bp79O8Xh3sH5J61v',
    17284.75,'₹17,284/yr',  'price_1U93CjSo2yKs7RdkwuQ2ok3C','https://buy.stripe.com/8x28wRbzNbq41uP4wL5J61w',
    'From ₹1,500/hr', true),
  ('sg',  'Singapore',       '🇸🇬', 'South East Asia', 'S$', 50.99,'S$50.99/mo',null,null, 244.75,'S$244.75/yr',null,null, 'From S$80/hr', false),
  ('my',  'Malaysia',        '🇲🇾', 'South East Asia', 'RM', 163.99,'RM 163.99/mo',null,null, 787.15,'RM 787.15/yr',null,null, 'From RM 150/hr', false),
  ('id',  'Indonesia',       '🇮🇩', 'South East Asia', 'Rp', 705882.99,'Rp 705,882/mo',null,null, 3388238.35,'Rp 3,388,238/yr',null,null, 'From Rp 500,000/hr', false),
  ('ph',  'Philippines',     '🇵🇭', 'South East Asia', '₱', 2384.99,'₱2,384/mo',null,null, 11447.95,'₱11,447/yr',null,null, 'From ₱2,000/hr', false),
  ('th',  'Thailand',        '🇹🇭', 'South East Asia', '฿', 1263.99,'฿1,263/mo',null,null, 6067.15,'฿6,067/yr',null,null, 'From ฿1,500/hr', false),
  ('jp',  'Japan',           '🇯🇵', 'South East Asia', '¥', 6428.99,'¥6,428/mo',null,null, 30859.15,'¥30,859/yr',null,null, 'From ¥5,000/hr', false),
  ('bd',  'Bangladesh',      '🇧🇩', 'South Asia', '৳', 4800.99,'৳4,800/mo',null,null, 23044.75,'৳23,044/yr',null,null, 'From ৳3,000/hr', false),
  ('za',  'South Africa',    '🇿🇦', 'Africa', 'R', 720.99,'R720/mo',null,null, 3460.75,'R3,460/yr',null,null, 'From R500/hr', false),
  ('ng',  'Nigeria',         '🇳🇬', 'Africa', '₦', 52941.99,'₦52,941/mo',null,null, 254121.55,'₦254,121/yr',null,null, 'From ₦40,000/hr', false),
  ('other','Other',          '🌍', 'Other', '$',
    40.99,   '$40.99/mo',   'price_1U93LnSo2yKs7RdkHvNq88IG','https://buy.stripe.com/5kQbJ3dHVbq4b5p2oD5J61x',
    196.75,  '$196.75/yr',  'price_1U93MKSo2yKs7Rdk6fHT6xe1','https://buy.stripe.com/14A28t6ft65K0qLe7l5J61y',
    'From $80/hr', true)
on conflict (pricing_region) do nothing;
