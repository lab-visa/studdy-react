import { track } from '../utils/analytics';

export default function FinalCTA() {
  return (
    <section className="grad-bg py-28 px-6 text-center">
      <div className="max-w-[700px] mx-auto">
        {/* Living whiteboard returns */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 mb-10 text-white/90 font-semibold text-[15px] leading-relaxed border border-white/20">
          ✏️ <span className="font-black">One question</span> could change how you feel about learning.
        </div>

        <h2 className="font-black text-white mb-4" style={{ fontSize: 'clamp(26px, 4vw, 46px)', letterSpacing: '-1px', lineHeight: 1.2 }}>
          Give yourself — or your child —<br />the tutor that never runs out of patience.
        </h2>
        <p className="mb-10 text-[16px]" style={{ color: 'rgba(255,255,255,.85)' }}>
          Start completely free. No card required to begin.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            className="bg-white rounded-full font-black text-[16px] px-10 py-4 shadow-[0_12px_40px_rgba(0,0,0,.2)] hover:-translate-y-0.5 transition-transform"
            style={{ color: 'var(--g1)' }}
            onClick={() => { track('checkout_started'); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}
          >
            Start Free Trial →
          </button>
          <a
            href="https://wa.me/441234567890"
            target="_blank"
            rel="noreferrer"
            className="bg-white/15 backdrop-blur-sm border border-white/30 text-white rounded-full font-bold text-[15px] px-8 py-4 hover:bg-white/25 transition-colors inline-flex items-center gap-2"
            onClick={() => track('whatsapp_support_click')}
          >
            💬 Ask Us on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
