import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-white px-6 py-10" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-wrap justify-between gap-8 mb-8">
          <div>
            <div className="font-black text-[22px] mb-2" style={{ letterSpacing: '-0.5px' }}>
              <span className="grad-text">studdy</span> lab
            </div>
            <p className="text-[13.5px] max-w-[220px]" style={{ color: 'var(--soft)' }}>AI whiteboard tutor · Available 24/7 for any subject or work task.</p>
          </div>

          <div className="flex flex-wrap gap-12">
            <div>
              <div className="font-black text-[12px] uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Product</div>
              {[['#demo','Experience'],['#subjects','Use Cases'],['#hiw','How It Works'],['#pricing','Pricing']].map(([h, l]) => (
                <a key={l} href={h} className="block text-[13.5px] mb-2 font-semibold hover:text-[var(--ink)]" style={{ color: 'var(--soft)' }}>{l}</a>
              ))}
            </div>
            <div>
              <div className="font-black text-[12px] uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Support</div>
              {[
                ['/contact','Contact Support'],
                ['/privacy','Privacy Policy'],
                ['/terms','Terms of Service'],
                ['/refund','Refund Policy'],
                ['/cancellation','Cancellation Policy'],
              ].map(([path, label]) => (
                <Link key={label} to={path} className="block text-[13.5px] mb-2 font-semibold hover:text-[var(--ink)]" style={{ color: 'var(--soft)' }}>{label}</Link>
              ))}
            </div>
            <div>
              <div className="font-black text-[12px] uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Contact</div>
              <a href="https://wa.me/441234567890" target="_blank" rel="noreferrer" className="block text-[13.5px] mb-2 font-semibold hover:text-[var(--ink)]" style={{ color: 'var(--soft)' }}>💬 WhatsApp Support</a>
              <a href="mailto:hello@studdylab.com" className="block text-[13.5px] mb-2 font-semibold hover:text-[var(--ink)]" style={{ color: 'var(--soft)' }}>✉️ hello@studdylab.com</a>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-4 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-[12.5px]" style={{ color: 'var(--soft)' }}>© 2026 Studdy Lab. All rights reserved.</span>
          <div className="flex gap-5 flex-wrap">
            {[['Privacy','/privacy'],['Terms','/terms'],['Refund','/refund'],['Cancellation','/cancellation']].map(([l, p]) => (
              <Link key={l} to={p} className="text-[12.5px] font-semibold hover:text-[var(--ink)]" style={{ color: 'var(--soft)' }}>{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
