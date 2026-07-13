import { useState } from 'react';
import PricingCard from '../components/PricingCard';
import SectionHeading from '../components/SectionHeading';
import { pricingData, regions, type Region } from '../data/pricing';
import { track } from '../utils/analytics';
import { useEffect } from 'react';

export default function Pricing() {
  const [region, setRegion] = useState<Region>('us');

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) track('pricing_view'); },
      { threshold: 0.3 }
    );
    const el = document.getElementById('pricing');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const p = pricingData[region];

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-[1000px] mx-auto">
        <SectionHeading
          eyebrow="Pricing"
          heading="Start today. $0 due right now."
          sub="7 days completely free. We'll WhatsApp you before anything is charged."
          center
        />

        {/* Region toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--dim)', border: '1.5px solid var(--border)' }}>
            {regions.map(r => (
              <button
                key={r.key}
                onClick={() => setRegion(r.key)}
                className="px-5 py-2 rounded-full text-[13px] font-bold transition-all"
                style={{
                  background: region === r.key ? '#fff' : 'transparent',
                  color: region === r.key ? 'var(--ink)' : 'var(--soft)',
                  boxShadow: region === r.key ? '0 2px 8px rgba(0,0,0,.08)' : 'none',
                }}
              >
                {r.flag} {r.label}
              </button>
            ))}
          </div>
        </div>

        {p.trial ? (
          <div className="grid md:grid-cols-3 gap-5">
            <PricingCard
              name="Monthly"
              price={`${p.symbol}0`}
              priceNote={`Then ${p.symbol}${p.weekly}/week after 7 days free`}
              afterNote={`First charge: ${p.symbol}${p.weekly} on day 8`}
              features={['Full tutor access','All subjects & work tasks','Unlimited questions','WhatsApp support','Cancel anytime']}
              ctaLabel="Start Free Trial"
              trackEvent="monthly_plan_click"
            />
            <PricingCard
              name="Annual"
              price={`${p.symbol}0`}
              priceNote={`Then ${p.symbol}${p.yearlyWeek}/week · ${p.symbol}${p.yearlyTotal}/year`}
              afterNote={`First charge: ${p.symbol}${p.yearlyTotal} on day 8`}
              features={['Everything in Monthly','Save 68% vs monthly','WhatsApp reminder before billing','Priority support']}
              badge="Most Families Choose This"
              featured
              ctaLabel="Start Free Trial"
              trackEvent="annual_plan_click"
            />
            <PricingCard
              name="Human Tutor"
              price="$180+"
              priceNote="Typical hourly rate"
              afterNote="Availability varies"
              features={['Fixed schedule only','One explanation style','Wait for next session','Hourly cost adds up']}
              dimmed
              ctaLabel="Comparison only"
            />
          </div>
        ) : (
          <div className="max-w-[420px] mx-auto">
            <PricingCard
              name="Annual"
              price={`${p.symbol}${p.yearlyTotal}`}
              priceNote="One-time payment — no recurring card charges"
              afterNote="Pay once, use all year"
              features={['Full tutor access','All subjects & work tasks','Unlimited questions','WhatsApp support']}
              badge="Best Value"
              featured
              ctaLabel="Get Started"
            />
          </div>
        )}

        <p className="text-center text-[13.5px] mt-6 font-semibold" style={{ color: 'var(--soft)' }}>
          🛡️ $0 due today · WhatsApp reminder before billing · Cancel anytime, no calls or forms
        </p>
      </div>
    </section>
  );
}
