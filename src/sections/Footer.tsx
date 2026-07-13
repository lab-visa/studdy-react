import { Link } from 'react-router-dom';
import { SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../data/config';
import { track } from '../utils/analytics';

const PRODUCT_LINKS = [['Experience','#demo'],['Use Cases','#subjects'],['Pricing','#pricing'],['FAQ','#faq']];
const LEGAL_LINKS = [['Privacy Policy','/privacy'],['Terms of Service','/terms'],['Refund Policy','/refund'],['Cancellation','/cancellation']];

export default function Footer() {
  return (
    <footer className="bg-white px-6 py-10" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-wrap justify-between gap-10 mb-8">
          <div>
            <div className="font-black text-[21px] mb-2" style={{ letterSpacing: '-0.5px' }}>
              <span className="grad-text">studdy</span> lab
            </div>
            <p className="text-[13.5px] max-w-[200px] leading-relaxed" style={{ color: 'var(--soft)' }}>
              AI tutor for school, college and work — available 24/7.
            </p>
          </div>
          <div className="flex flex-wrap gap-12">
            <div>
              <div className="font-black text-[11px] uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Product</div>
              {PRODUCT_LINKS.map(([l,h]) => (
                <a key={l} href={h} className="block text-[13.5px] mb-2 font-semibold hover:text-[var(--ink)] transition-colors" style={{ color: 'var(--soft)' }}>{l}</a>
              ))}
            </div>
            <div>
              <div className="font-black text-[11px] uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Legal</div>
              {LEGAL_LINKS.map(([l,p]) => (
                <Link key={l} to={p} className="block text-[13.5px] mb-2 font-semibold hover:text-[var(--ink)] transition-colors" style={{ color: 'var(--soft)' }}>{l}</Link>
              ))}
            </div>
            <div>
              <div className="font-black text-[11px] uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>Support</div>
              <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="block text-[13.5px] mb-2 font-semibold hover:text-[var(--ink)] transition-colors" style={{ color: 'var(--soft)' }} onClick={() => track('whatsapp_support_click')}>
                WhatsApp Support
              </a>
              <Link to="/contact" className="block text-[13.5px] mb-2 font-semibold hover:text-[var(--ink)] transition-colors" style={{ color: 'var(--soft)' }}>Contact Us</Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="block text-[13.5px] font-semibold hover:text-[var(--ink)] transition-colors" style={{ color: 'var(--soft)' }}>{SUPPORT_EMAIL}</a>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-[12px]" style={{ color: 'var(--soft)' }}>© 2026 Studdy Lab. All rights reserved.</span>
          <span className="text-[12px]" style={{ color: 'var(--soft)' }}>Built for learners everywhere.</span>
        </div>
      </div>
    </footer>
  );
}
