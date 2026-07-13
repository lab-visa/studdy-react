import { Link } from 'react-router-dom';

interface Props {
  title: string;
  sections: { heading: string; body: string }[];
}

function LegalPage({ title, sections }: Props) {
  return (
    <div className="min-h-screen px-6 py-16 max-w-[760px] mx-auto">
      <Link to="/" className="text-[14px] font-bold mb-8 block" style={{ color: 'var(--soft)' }}>← Back to Studdy Lab</Link>
      <h1 className="font-black mb-8" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-1px' }}>{title}</h1>
      <p className="text-[13px] mb-8" style={{ color: 'var(--soft)' }}>Last updated: 1 July 2026</p>
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
    { heading: '1. What we collect', body: 'We collect your name, email address, WhatsApp number and learning session data to operate the service.' },
    { heading: '2. How we use your data', body: 'We use your data to provide the tutor service, send billing reminders via WhatsApp and improve the product. We do not sell your data to third parties.' },
    { heading: '3. Data storage', body: 'Your data is stored on secure servers. Session data is private and not shared with other users.' },
    { heading: '4. Your rights', body: 'You can request a copy of your data, ask us to delete it or correct inaccuracies by contacting us on WhatsApp or by email.' },
    { heading: '5. Contact', body: 'For privacy questions: hello@studdylab.com or WhatsApp support.' },
  ]} />;
}

export function TermsOfService() {
  return <LegalPage title="Terms of Service" sections={[
    { heading: '1. Service', body: 'Studdy Lab provides AI-assisted tutoring. The service is a supplemental learning aid and does not replace qualified human teachers or professional advice.' },
    { heading: '2. Trial and billing', body: 'Trials are 7 days. After the trial, billing begins at the agreed rate. We will notify you by WhatsApp before any charge.' },
    { heading: '3. Cancellation', body: 'You may cancel at any time by messaging "Cancel" on WhatsApp before your next billing date.' },
    { heading: '4. Acceptable use', body: 'You may not use the service for any unlawful purpose or share access with others outside of the agreed account terms.' },
    { heading: '5. Liability', body: 'Studdy Lab is not liable for outcomes resulting from reliance on the service. Content is provided for educational purposes only.' },
  ]} />;
}

export function RefundPolicy() {
  return <LegalPage title="Refund Policy" sections={[
    { heading: '7-day free trial', body: 'Nothing is charged during the 7-day trial. You can cancel before the trial ends with no charge.' },
    { heading: 'Refund eligibility', body: 'If you are charged and have not used the service in the billing period, contact us within 7 days for a refund review.' },
    { heading: 'How to request a refund', body: 'Message us on WhatsApp or email hello@studdylab.com. We aim to resolve all refund requests within 48 hours.' },
    { heading: 'Annual plans', body: 'Annual plan refunds are available within 14 days of payment if the service has not been substantially used.' },
  ]} />;
}

export function CancellationPolicy() {
  return <LegalPage title="Cancellation Policy" sections={[
    { heading: 'How to cancel', body: 'Message "Cancel" on WhatsApp before your next billing date. No calls, no forms required.' },
    { heading: 'When cancellation takes effect', body: 'Cancellation takes effect at the end of your current billing period. You retain access until then.' },
    { heading: 'No penalties', body: 'There are no cancellation fees or penalties. You can cancel at any time.' },
    { heading: 'Reactivation', body: 'You can restart at any time by visiting the pricing page and starting a new trial or plan.' },
  ]} />;
}

export function ContactPage() {
  return (
    <div className="min-h-screen px-6 py-16 max-w-[640px] mx-auto">
      <Link to="/" className="text-[14px] font-bold mb-8 block" style={{ color: 'var(--soft)' }}>← Back to Studdy Lab</Link>
      <h1 className="font-black mb-4" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-1px' }}>Contact & Support</h1>
      <p className="text-[16px] mb-10" style={{ color: 'var(--soft)' }}>The fastest way to reach us is WhatsApp. We reply within minutes during business hours.</p>
      <div className="space-y-4">
        <a href="https://wa.me/441234567890" target="_blank" rel="noreferrer" className="flex items-center gap-4 p-5 rounded-2xl bg-white font-bold" style={{ border: '1.5px solid var(--border)' }}>
          <span className="text-[28px]">💬</span>
          <div><div className="text-[15px]">WhatsApp Support</div><div className="text-[12px] font-normal" style={{ color: 'var(--soft)' }}>Usually replies in minutes</div></div>
        </a>
        <a href="mailto:hello@studdylab.com" className="flex items-center gap-4 p-5 rounded-2xl bg-white font-bold" style={{ border: '1.5px solid var(--border)' }}>
          <span className="text-[28px]">✉️</span>
          <div><div className="text-[15px]">hello@studdylab.com</div><div className="text-[12px] font-normal" style={{ color: 'var(--soft)' }}>For billing and account queries</div></div>
        </a>
      </div>
    </div>
  );
}
