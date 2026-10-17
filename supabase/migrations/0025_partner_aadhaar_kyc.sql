-- ============================================================
-- 0025_partner_aadhaar_kyc.sql — Aadhaar for partner KYC + partnership agreement
-- Safe to re-run.
-- ============================================================
--
-- Asked for by the company's CA (KYC and the partner agreement). Kept to the
-- minimum the Aadhaar Act allows a private company to hold with consent:
--   * only the LAST 4 DIGITS of the Aadhaar number are stored, never all 12;
--   * partners are asked to upload a MASKED Aadhaar (first 8 digits hidden);
--   * photos sit in the PRIVATE 'partner-docs' bucket, viewed by the admin
--     only through 5-minute signed links;
--   * aadhaar_consent_at records the partner's explicit consent and purpose.

alter table partners add column if not exists aadhaar_last4       text check (aadhaar_last4 is null or aadhaar_last4 ~ '^\d{4}$');
alter table partners add column if not exists aadhaar_front_path  text;
alter table partners add column if not exists aadhaar_back_path   text;
alter table partners add column if not exists aadhaar_consent_at  timestamptz;
