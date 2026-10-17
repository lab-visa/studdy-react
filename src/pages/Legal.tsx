import { Link } from 'react-router-dom';
import { SUPPORT_WHATSAPP, SUPPORT_EMAIL, LEGAL_ENTITY } from '../data/config';

interface Props {
  title: string;
  sections: { heading: string; body: string }[];
}

function LegalPage({ title, sections }: Props) {
  return (
    <div className="min-h-screen px-6 py-16 max-w-[760px] mx-auto">
      <Link to="/" className="text-[14px] font-bold mb-8 block" style={{ color: 'var(--soft)' }}>← Back to Studdy Lab</Link>
      <h1 className="font-black mb-8" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-1px' }}>{title}</h1>
      <p className="text-[13px] mb-8" style={{ color: 'var(--soft)' }}>Last updated: 14 October 2026</p>
      <p className="text-[15px] leading-relaxed mb-8" style={{ color: 'var(--soft)' }}>
        Studdy Lab (studdylab.com) is owned and operated by {LEGAL_ENTITY}. In this policy, “we”, “us” and “Studdy Lab” mean {LEGAL_ENTITY}.
      </p>
      {sections.map((s, i) => (
        <div key={i} className="mb-8">
          <h2 className="font-black text-[18px] mb-3">{s.heading}</h2>
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--soft)' }}>{s.body}</p>
        </div>
      ))}
    </div>
  );
}

export function PrivacyPolicy() {
  return <LegalPage title="Privacy Policy" sections={[
    { heading: '1. What we collect', body: 'We collect your name, email address, WhatsApp number, billing address (via our payment processor), and learning session data to operate the service. We also collect your approximate location (from your IP address) to show pricing in your local currency, and basic device/browser information for troubleshooting.' },
    { heading: '2. How we use your data', body: 'We use your data to provide the tutor service, process payments, send billing and trial reminders via WhatsApp, detect the correct pricing region for you, and improve the product. We do not sell your data to third parties.' },
    { heading: '3. Who we share it with', body: 'We share the minimum data needed with the third parties that help us run Studdy Lab: our payment processor (to handle your card and subscription), our database provider (to securely store your account and session data), and the underlying Studdy AI tutoring platform (whose AI tutor you access through a Studdy Lab-managed account). None of these providers may use your data for their own marketing.' },
    { heading: '4. Data storage and retention', body: 'Your data is stored on secure servers and kept for as long as your account is active, plus a reasonable period afterward for accounting, tax and dispute-resolution purposes. Session data is private and not shared with other users, including others on the same shared Studdy account.' },
    { heading: '5. International customers', body: 'Studdy Lab is based in India and serves customers worldwide, including the United States, United Kingdom, European Union, UAE, Saudi Arabia, Australia, Canada and India. This means your data may be processed or stored outside your home country. If you are in the EU/UK, you have rights under GDPR (access, correction, deletion, portability, objection) in addition to the rights below.' },
    { heading: '6. Age requirement', body: 'Studdy Lab is intended for users aged 13 and older, consistent with the underlying tutoring platform’s own requirement. If you are under 18, a parent or guardian should review and agree to these terms on your behalf before you subscribe.' },
    { heading: '7. Your rights', body: 'You can request a copy of your data, ask us to delete it, or correct inaccuracies by contacting us on WhatsApp or by email at any time.' },
    { heading: '8. Changes to this policy', body: 'We may update this policy as the service evolves. Material changes will be reflected by an updated "last updated" date on this page.' },
    { heading: '9. Contact', body: 'For privacy questions: hello@studdyai.org or WhatsApp support.' },
  ]} />;
}

export function TermsOfService() {
  return <LegalPage title="Terms of Service" sections={[
    { heading: '1. Service', body: 'Studdy Lab gives you access to the Studdy AI tutoring platform (a third-party product) through an account we set up and manage for you. The service is a supplemental learning aid and does not replace qualified human teachers or professional advice. Responses are AI-generated and may occasionally be incomplete or inaccurate, so use judgment before relying on them for graded or professional work.' },
    { heading: '2. Eligibility', body: 'You must be at least 13 years old to use Studdy Lab. If you are under 18, a parent or guardian must agree to these terms and is responsible for your use of the service.' },
    { heading: '3. Trial and billing', body: 'Trials are 7 days and require a card on file, but nothing is charged during the trial. After the trial, billing begins automatically at the agreed rate unless you cancel first. We will message you on WhatsApp before any charge.' },
    { heading: '4. Account access', body: 'Your access is provided through an account managed by Studdy Lab, which may be shared with a small number of other Studdy Lab customers as part of how we operate the service. Please do not change the shared password or share your access with anyone outside your own household. Sharing your login details with anyone outside your household may lead to your access being terminated without a refund.' },
    { heading: '5. Cancellation', body: 'You may request cancellation at any time by messaging us on WhatsApp or email, before your next billing date. We will contact you on WhatsApp within 24 hours to confirm and help resolve any issues before your subscription is cancelled. Your subscription remains active and billable until we have processed the cancellation - see our Cancellation Policy for full details.' },
    { heading: '6. Acceptable use', body: 'You may not use the service for any unlawful purpose, attempt to disrupt or reverse-engineer it, or share access with others outside the agreed account terms above.' },
    { heading: '7. No warranty', body: 'The service is provided "as is." We do not guarantee that it will be uninterrupted, error-free, or that AI-generated explanations will always be correct.' },
    { heading: '8. Liability', body: 'To the extent permitted by law, Studdy Lab is not liable for outcomes resulting from reliance on the service. Content is provided for educational purposes only.' },
    { heading: '9. Governing law', body: 'These terms are governed by the laws of India. This does not remove any non-waivable consumer-protection rights you may have under the law of your own country.' },
    { heading: '10. Changes to these terms', body: 'We may update these terms as the service evolves. Continued use of Studdy Lab after an update means you accept the revised terms.' },
    { heading: '11. Contact', body: 'Questions about these terms: hello@studdyai.org or WhatsApp support.' },
  ]} />;
}

export function RefundPolicy() {
  return <LegalPage title="Refund Policy" sections={[
    { heading: 'Customers in India', body: 'Plans in India are paid upfront (Quarterly or Yearly) with no free trial and no auto-debit. If you are not happy, ask for a refund within 7 days of your payment and we will refund the full amount to your original payment method. To request it, message us on WhatsApp or email support@studdyai.org.' },
    { heading: '7-day free trial (outside India)', body: 'Nothing is charged during the 7-day trial. You can cancel before the trial ends with no charge.' },
    { heading: 'Refund eligibility', body: 'If you are charged and have not used the service in that billing period, contact us within 7 days for a refund review.' },
    { heading: 'How to request a refund', body: 'Message us on WhatsApp or email support@studdyai.org. We aim to respond to all refund requests within 48 hours. Contacting us directly is always faster than disputing the charge with your bank.' },
    { heading: 'Annual plans', body: 'Annual plan refunds are available within 14 days of payment if the service has not been substantially used.' },
  ]} />;
}

export function CancellationPolicy() {
  return <LegalPage title="Cancellation Policy" sections={[
    { heading: 'How to cancel', body: 'Message us on WhatsApp, or use the Cancel option on your dashboard, any time before your next billing date. No calls, no forms required.' },
    { heading: 'What happens after you request it', body: 'Cancellation is not instant. We will contact you on WhatsApp within 24 hours of your request to confirm and help resolve any issues before finalizing it. Your subscription remains active and billable until we have actually processed the cancellation on our end.' },
    { heading: 'No penalties', body: 'There are no cancellation fees or penalties. You can request cancellation at any time.' },
    { heading: 'Reactivation', body: 'You can restart at any time by visiting the pricing page and starting a new trial or plan.' },
  ]} />;
}

export function ContactPage() {
  return (
    <div className="min-h-screen px-6 py-16 max-w-[640px] mx-auto">
      <Link to="/" className="text-[14px] font-bold mb-8 block" style={{ color: 'var(--soft)' }}>← Back to Studdy Lab</Link>
      <h1 className="font-black mb-4" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-1px' }}>Contact & Support</h1>
      <p className="text-[16px] mb-4" style={{ color: 'var(--soft)' }}>The fastest way to reach us is WhatsApp. We reply within minutes during business hours.</p>
      <p className="text-[15px] mb-10" style={{ color: 'var(--soft)' }}>Studdy Lab is owned and operated by {LEGAL_ENTITY}.</p>
      <div className="space-y-4">
        <a href={SUPPORT_WHATSAPP} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-5 rounded-2xl bg-white font-bold" style={{ border: '1.5px solid var(--border)' }}>
          <span className="text-[28px]">💬</span>
          <div><div className="text-[15px]">WhatsApp Support</div><div className="text-[12px] font-normal" style={{ color: 'var(--soft)' }}>Usually replies in minutes</div></div>
        </a>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-4 p-5 rounded-2xl bg-white font-bold" style={{ border: '1.5px solid var(--border)' }}>
          <span className="text-[28px]">✉️</span>
          <div><div className="text-[15px]">{SUPPORT_EMAIL}</div><div className="text-[12px] font-normal" style={{ color: 'var(--soft)' }}>For billing and account queries</div></div>
        </a>
      </div>
    </div>
  );
}

export function PartnerTerms() {
  return <LegalPage title="Partner Terms" sections={[
    { heading: '1. What this is', body: 'The Studdy Lab Partner Programme lets you recommend Studdy Lab plans sold in India and earn a commission on each purchase made through your personal link or partner code. You take part as an independent partner. This is not a job, employment, franchise or agency, and you are not authorised to make any promise, sign anything or collect money on behalf of Studdy Lab.' },
    { heading: '2. Joining', body: 'Joining is free. Studdy Lab never asks partners for a fee or deposit. You must be 18 or older and give us your correct name, WhatsApp number and email. One account per person. You log in with your WhatsApp number and a PIN you choose; keep your PIN private.' },
    { heading: '3. Commission', body: 'You earn ₹2,500 for every Yearly plan and ₹700 for every Quarterly plan bought through your personal link or partner code and paid in full. A sale is credited to the partner whose link or code was used for that purchase. If more than one partner is involved, the link or code used at payment decides.' },
    { heading: '4. Monthly bonus', body: 'If you make 10 or more sales in a calendar month (India time, by payment date), you get an extra ₹5,000 for that month. If you make 20 or more, you get a further ₹10,000 (₹15,000 bonus in total). Refunded sales do not count. The count starts again on the 1st of every month.' },
    { heading: '5. Refunds', body: 'Customers can ask for a full refund within 7 days of paying. No commission or bonus is earned on a refunded sale. If a sale is refunded or reversed after it was paid out, we may deduct that amount from your next payout.' },
    { heading: '6. Payouts', body: 'We pay on the 10th of every month for the previous month’s sales, by bank transfer to the account you add in your dashboard. If the 10th is a bank holiday, we pay on the next working day. If your bank details or PAN are missing or wrong, the payout is held and paid in the next payout after you correct them.' },
    { heading: '7. Tax', body: 'TDS is deducted from payouts as required by Indian tax law, and every payout statement shows the amount, the TDS and the net amount paid. You must give us a valid PAN before your first payout. You are responsible for any other taxes on your earnings.' },
    { heading: '8. No self-purchase', body: 'You cannot earn commission on a plan bought for yourself or your own household through your own link or code, including renewals. Such sales will not earn a commission.' },
    { heading: '9. How you may promote Studdy Lab', body: 'Be honest. Do not make false claims (for example guaranteed marks, ranks or results), do not offer discounts or cashback that Studdy Lab has not announced, do not pretend to be Studdy Lab staff, do not use Studdy Lab or Studdy names in ads, domains or social media handles without our written permission, and do not spam people, add them to groups without permission, or buy contact lists. Sales that break these rules earn no commission.' },
    { heading: '10. Customer details', body: 'You see your customers only in masked form (first name, initial and last 4 digits of their number). Any customer information you learn while selling must be kept private and used only to help that customer.' },
    { heading: '11. Pausing or ending', body: 'You can stop at any time by messaging us. We may pause or end your partner account if you break these terms or act in a way that harms customers or Studdy Lab. Commission already earned on genuine, non-refunded sales will still be paid, except where the sale broke these terms.' },
    { heading: '12. Changes', body: 'We may change commission amounts, bonuses or these terms. Changes apply only to sales made after the change, and we will tell you on WhatsApp or email before they apply.' },
    { heading: '13. Contact', body: 'For any question about the partner programme, message us on WhatsApp or email hr@studdyai.org.' },
  ]} />;
}
