-- ============================================================
-- DRAFT — NOT YET APPLIED TO PRODUCTION.
-- Written Sep 2026 alongside the src/data/config.ts repricing.
-- Do not run this against production until Vish explicitly says so.
-- ============================================================
-- 0020_pricing_repricing_sep2026.sql
--
-- Updates the existing `pricing` CRM mirror table (created in
-- 0002_pricing.sql) to match the new Sep 2026 repricing now live in
-- src/data/config.ts's REGION_DATA. This is a reporting-table update
-- only — it does not touch Stripe and does not change what checkout
-- charges (checkout reads config.ts directly, same as before).
--
-- All 23 rows already exist (pricing_region is the primary key), so
-- this is UPDATE, not INSERT — every region below now has a real
-- Stripe product/price pair, so is_live flips to true across the board
-- (13 regions were `false` before this build; 9 were already `true`).
--
-- Kuwait, Oman and Bahrain: their Stripe product/prices are billed in
-- USD (KWD/OMR/BHD aren't supported presentment currencies on this
-- account), so currency_symbol/amount/display below reflect the actual
-- USD charge ($26.99/$129.99), not the original local-currency target
-- numbers — matching the same fallback applied in config.ts.

update pricing set
  currency_symbol = '$', monthly_amount = 26.99, monthly_display = '$26.99/mo',
  monthly_stripe_price_id = 'price_1UCpDjSo2yKs7Rdkt11PUUUc', monthly_payment_link = 'https://buy.stripe.com/00w6oJgU7dycgpJe7l5J62e',
  yearly_amount = 129.99, yearly_display = '$129.99/yr',
  yearly_stripe_price_id = 'price_1UCpDmSo2yKs7Rdkj0XqdfFB', yearly_payment_link = 'https://buy.stripe.com/cNi6oJ8nB0Lqc9t2oD5J62f',
  is_live = true, updated_at = now()
where pricing_region = 'us';

update pricing set
  currency_symbol = 'CA$', monthly_amount = 35.99, monthly_display = 'CA$35.99/mo',
  monthly_stripe_price_id = 'price_1UCpDoSo2yKs7Rdk30yMS0Bh', monthly_payment_link = 'https://buy.stripe.com/3cI9AVfQ3cu82yT6ET5J62g',
  yearly_amount = 172.99, yearly_display = 'CA$172.99/yr',
  yearly_stripe_price_id = 'price_1UCpDrSo2yKs7Rdk2xYeLYjF', yearly_payment_link = 'https://buy.stripe.com/9B6eVf33hgKo1uP4wL5J62h',
  is_live = true, updated_at = now()
where pricing_region = 'ca';

update pricing set
  currency_symbol = '£', monthly_amount = 18.99, monthly_display = '£18.99/mo',
  monthly_stripe_price_id = 'price_1UCpCBSo2yKs7RdkSsZ6qKd6', monthly_payment_link = 'https://buy.stripe.com/7sY5kFdHV2Ty6P97IX5J61E',
  yearly_amount = 91.99, yearly_display = '£91.99/yr',
  yearly_stripe_price_id = 'price_1UCpCESo2yKs7RdknEEd3RRl', yearly_payment_link = 'https://buy.stripe.com/6oU5kF8nB0Lq5L5d3h5J61F',
  is_live = true, updated_at = now()
where pricing_region = 'uk';

update pricing set
  currency_symbol = '€', monthly_amount = 21.99, monthly_display = '€21.99/mo',
  monthly_stripe_price_id = 'price_1UCpCHSo2yKs7RdkHzHrVaRl', monthly_payment_link = 'https://buy.stripe.com/8x214p0V90Lq7TdaV95J61G',
  yearly_amount = 105.99, yearly_display = '€105.99/yr',
  yearly_stripe_price_id = 'price_1UCpCJSo2yKs7RdkXKk8TeDQ', yearly_payment_link = 'https://buy.stripe.com/aFa6oJbzN2Tyc9taV95J61H',
  is_live = true, updated_at = now()
where pricing_region = 'eu';

update pricing set
  currency_symbol = 'AED', monthly_amount = 102.99, monthly_display = 'AED 102.99/mo',
  monthly_stripe_price_id = 'price_1UCpCMSo2yKs7RdkJyYhAWiS', monthly_payment_link = 'https://buy.stripe.com/cNi4gBdHV51Ga1l6ET5J61I',
  yearly_amount = 494.99, yearly_display = 'AED 494.99/yr',
  yearly_stripe_price_id = 'price_1UCpCPSo2yKs7RdkCKPRVKZx', yearly_payment_link = 'https://buy.stripe.com/00wbJ3gU7eCgc9tfbp5J61J',
  is_live = true, updated_at = now()
where pricing_region = 'uae';

update pricing set
  currency_symbol = 'SAR', monthly_amount = 102.99, monthly_display = 'SAR 102.99/mo',
  monthly_stripe_price_id = 'price_1UCpCSSo2yKs7RdksPimDIXd', monthly_payment_link = 'https://buy.stripe.com/3cI6oJgU765K5L57IX5J61K',
  yearly_amount = 494.99, yearly_display = 'SAR 494.99/yr',
  yearly_stripe_price_id = 'price_1UCpCVSo2yKs7RdkGND8sk4r', yearly_payment_link = 'https://buy.stripe.com/3cI8wRdHV8dS5L5fbp5J61L',
  is_live = true, updated_at = now()
where pricing_region = 'sa';

-- USD fallback (KWD unsupported on this account)
update pricing set
  currency_symbol = '$', monthly_amount = 26.99, monthly_display = '$26.99/mo',
  monthly_stripe_price_id = 'price_1UCpFUSo2yKs7RdkZqtBr00y', monthly_payment_link = 'https://buy.stripe.com/4gM3cx1Zd3XCa1lfbp5J61M',
  yearly_amount = 129.99, yearly_display = '$129.99/yr',
  yearly_stripe_price_id = 'price_1UCpFXSo2yKs7RdkclDRNCK0', yearly_payment_link = 'https://buy.stripe.com/cNibJ38nBam0gpJgft5J61N',
  is_live = true, updated_at = now()
where pricing_region = 'kw';

update pricing set
  currency_symbol = 'QAR', monthly_amount = 102.99, monthly_display = 'QAR 102.99/mo',
  monthly_stripe_price_id = 'price_1UCpCdSo2yKs7RdkKbjBmq6w', monthly_payment_link = 'https://buy.stripe.com/7sY7sN33h3XCflFe7l5J61O',
  yearly_amount = 494.99, yearly_display = 'QAR 494.99/yr',
  yearly_stripe_price_id = 'price_1UCpCgSo2yKs7RdkKuVAfiyZ', yearly_payment_link = 'https://buy.stripe.com/7sYeVf7jx3XC2yTd3h5J61P',
  is_live = true, updated_at = now()
where pricing_region = 'qa';

-- USD fallback (OMR unsupported on this account)
update pricing set
  currency_symbol = '$', monthly_amount = 26.99, monthly_display = '$26.99/mo',
  monthly_stripe_price_id = 'price_1UCpFZSo2yKs7RdkVv5EMH3y', monthly_payment_link = 'https://buy.stripe.com/5kQ8wR9rF1Pu5L57IX5J61Q',
  yearly_amount = 129.99, yearly_display = '$129.99/yr',
  yearly_stripe_price_id = 'price_1UCpFcSo2yKs7RdktI7KOgmF', yearly_payment_link = 'https://buy.stripe.com/4gM3cx47l9hWehBfbp5J61R',
  is_live = true, updated_at = now()
where pricing_region = 'om';

-- USD fallback (BHD unsupported on this account)
update pricing set
  currency_symbol = '$', monthly_amount = 26.99, monthly_display = '$26.99/mo',
  monthly_stripe_price_id = 'price_1UCpFeSo2yKs7RdkGzRLnBm9', monthly_payment_link = 'https://buy.stripe.com/dRm3cxdHVbq44H1aV95J61S',
  yearly_amount = 129.99, yearly_display = '$129.99/yr',
  yearly_stripe_price_id = 'price_1UCpFhSo2yKs7RdktliVwXIA', yearly_payment_link = 'https://buy.stripe.com/eVqeVfavJfGk6P91kz5J61T',
  is_live = true, updated_at = now()
where pricing_region = 'bh';

update pricing set
  currency_symbol = 'A$', monthly_amount = 36.99, monthly_display = 'A$36.99/mo',
  monthly_stripe_price_id = 'price_1UCpC0So2yKs7RdkqEYYn30s', monthly_payment_link = 'https://buy.stripe.com/28E00l8nB3XC0qL2oD5J61A',
  yearly_amount = 177.99, yearly_display = 'A$177.99/yr',
  yearly_stripe_price_id = 'price_1UCpC3So2yKs7RdkCBEX783O', yearly_payment_link = 'https://buy.stripe.com/eVq4gB8nBgKo3CXaV95J61B',
  is_live = true, updated_at = now()
where pricing_region = 'au';

update pricing set
  currency_symbol = 'NZ$', monthly_amount = 43.99, monthly_display = 'NZ$43.99/mo',
  monthly_stripe_price_id = 'price_1UCpC5So2yKs7RdkQTY0H2uj', monthly_payment_link = 'https://buy.stripe.com/eVqdRb6ft65KgpJ9R55J61C',
  yearly_amount = 211.99, yearly_display = 'NZ$211.99/yr',
  yearly_stripe_price_id = 'price_1UCpC8So2yKs7RdkRH3qF2XV', yearly_payment_link = 'https://buy.stripe.com/dRmbJ3fQ351G6P9d3h5J61D',
  is_live = true, updated_at = now()
where pricing_region = 'nz';

update pricing set
  currency_symbol = '₹', monthly_amount = 2349.99, monthly_display = '₹2,349/mo',
  monthly_stripe_price_id = 'price_1UCpCtSo2yKs7RdkjKOY59OC', monthly_payment_link = 'https://buy.stripe.com/dRm00l1Zd9hW1uP2oD5J61U',
  yearly_amount = 11279.99, yearly_display = '₹11,279/yr',
  yearly_stripe_price_id = 'price_1UCpCwSo2yKs7RdkEvzcYU8r', yearly_payment_link = 'https://buy.stripe.com/8x28wRgU73XCflF9R55J61V',
  is_live = true, updated_at = now()
where pricing_region = 'in';

update pricing set
  currency_symbol = 'S$', monthly_amount = 33.99, monthly_display = 'S$33.99/mo',
  monthly_stripe_price_id = 'price_1UCpCySo2yKs7RdkjqbNh5ZO', monthly_payment_link = 'https://buy.stripe.com/8x2cN7avJ51Gc9t5AP5J61W',
  yearly_amount = 163.99, yearly_display = 'S$163.99/yr',
  yearly_stripe_price_id = 'price_1UCpD1So2yKs7RdkSGyEre6d', yearly_payment_link = 'https://buy.stripe.com/bJe6oJ1Zd2Ty4H18N15J61X',
  is_live = true, updated_at = now()
where pricing_region = 'sg';

update pricing set
  currency_symbol = 'RM', monthly_amount = 106.99, monthly_display = 'RM 106.99/mo',
  monthly_stripe_price_id = 'price_1UCpDPSo2yKs7RdkRb8vwamn', monthly_payment_link = 'https://buy.stripe.com/9B6fZjbzN2Ty6P99R55J626',
  yearly_amount = 513.99, yearly_display = 'RM 513.99/yr',
  yearly_stripe_price_id = 'price_1UCpDRSo2yKs7Rdks33XnWmk', yearly_payment_link = 'https://buy.stripe.com/5kQ4gBavJdyc0qL6ET5J627',
  is_live = true, updated_at = now()
where pricing_region = 'my';

update pricing set
  currency_symbol = 'Rp', monthly_amount = 460588.99, monthly_display = 'Rp 460,588/mo',
  monthly_stripe_price_id = 'price_1UCpDUSo2yKs7RdkhD2N8Upo', monthly_payment_link = 'https://buy.stripe.com/28EcN7dHV8dSb5pbZd5J628',
  yearly_amount = 2210827.99, yearly_display = 'Rp 2,210,827/yr',
  yearly_stripe_price_id = 'price_1UCpDWSo2yKs7RdkhFdOSp3O', yearly_payment_link = 'https://buy.stripe.com/14A5kFdHVgKo1uPd3h5J629',
  is_live = true, updated_at = now()
where pricing_region = 'id';

update pricing set
  currency_symbol = '₱', monthly_amount = 1555.99, monthly_display = '₱1,555/mo',
  monthly_stripe_price_id = 'price_1UCpDZSo2yKs7RdklbaVdQhf', monthly_payment_link = 'https://buy.stripe.com/9B6eVfgU73XC0qL5AP5J62a',
  yearly_amount = 7468.99, yearly_display = '₱7,468/yr',
  yearly_stripe_price_id = 'price_1UCpDbSo2yKs7RdkTAM65RLn', yearly_payment_link = 'https://buy.stripe.com/6oUdRbeLZdyc5L5e7l5J62b',
  is_live = true, updated_at = now()
where pricing_region = 'ph';

update pricing set
  currency_symbol = '฿', monthly_amount = 824.99, monthly_display = '฿824/mo',
  monthly_stripe_price_id = 'price_1UCpDeSo2yKs7Rdk44ut0CAS', monthly_payment_link = 'https://buy.stripe.com/8x2eVfdHV1Pu3CXaV95J62c',
  yearly_amount = 3959.99, yearly_display = '฿3,959/yr',
  yearly_stripe_price_id = 'price_1UCpDhSo2yKs7Rdkb7oNhN7p', yearly_payment_link = 'https://buy.stripe.com/fZubJ37jxgKo4H1gft5J62d',
  is_live = true, updated_at = now()
where pricing_region = 'th';

-- Yen has no decimal subunit — amounts are whole yen (rounded from the
-- 4194.99 / 20135.99 target), matching config.ts.
update pricing set
  currency_symbol = '¥', monthly_amount = 4195, monthly_display = '¥4,195/mo',
  monthly_stripe_price_id = 'price_1UCpDJSo2yKs7Rdk3G7ME39z', monthly_payment_link = 'https://buy.stripe.com/3cIdRb1Zd0Lq2yT9R55J624',
  yearly_amount = 20136, yearly_display = '¥20,136/yr',
  yearly_stripe_price_id = 'price_1UCpDMSo2yKs7RdkZZ70zvs5', yearly_payment_link = 'https://buy.stripe.com/fZu9AV9rF65Kddxgft5J625',
  is_live = true, updated_at = now()
where pricing_region = 'jp';

update pricing set
  currency_symbol = '৳', monthly_amount = 3132.99, monthly_display = '৳3,132/mo',
  monthly_stripe_price_id = 'price_1UCpD4So2yKs7RdkIzXCUy8S', monthly_payment_link = 'https://buy.stripe.com/fZu5kFbzN3XC3CX4wL5J61Y',
  yearly_amount = 15038.99, yearly_display = '৳15,038/yr',
  yearly_stripe_price_id = 'price_1UCpD6So2yKs7RdkxPw5Qwb8', yearly_payment_link = 'https://buy.stripe.com/3cI9AVdHVbq4b5p7IX5J61Z',
  is_live = true, updated_at = now()
where pricing_region = 'bd';

update pricing set
  currency_symbol = 'R', monthly_amount = 469.99, monthly_display = 'R469/mo',
  monthly_stripe_price_id = 'price_1UCpD9So2yKs7RdkhBIakWnb', monthly_payment_link = 'https://buy.stripe.com/14AfZj8nB2Ty5L5gft5J620',
  yearly_amount = 2255.99, yearly_display = 'R2,255/yr',
  yearly_stripe_price_id = 'price_1UCpDBSo2yKs7Rdkj8vJBitb', yearly_payment_link = 'https://buy.stripe.com/28E3cx9rF51Gddx6ET5J621',
  is_live = true, updated_at = now()
where pricing_region = 'za';

update pricing set
  currency_symbol = '₦', monthly_amount = 34544.99, monthly_display = '₦34,544/mo',
  monthly_stripe_price_id = 'price_1UCpDESo2yKs7RdkVS42HO4j', monthly_payment_link = 'https://buy.stripe.com/4gMcN733h9hW0qL9R55J622',
  yearly_amount = 165815.99, yearly_display = '₦165,815/yr',
  yearly_stripe_price_id = 'price_1UCpDGSo2yKs7RdkqR23GEGD', yearly_payment_link = 'https://buy.stripe.com/bJe6oJdHVdyc4H1e7l5J623',
  is_live = true, updated_at = now()
where pricing_region = 'ng';

update pricing set
  currency_symbol = '$', monthly_amount = 26.99, monthly_display = '$26.99/mo',
  monthly_stripe_price_id = 'price_1UCpDuSo2yKs7RdkF7dVbjJU', monthly_payment_link = 'https://buy.stripe.com/dRmbJ3bzN8dSa1l5AP5J62i',
  yearly_amount = 129.99, yearly_display = '$129.99/yr',
  yearly_stripe_price_id = 'price_1UCpDwSo2yKs7RdkRCHF9cR7', yearly_payment_link = 'https://buy.stripe.com/bJecN71ZdeCg3CXgft5J62j',
  is_live = true, updated_at = now()
where pricing_region = 'other';
