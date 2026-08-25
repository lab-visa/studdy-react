import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analytics';

interface Props {
  name: string;
  price: string;
  priceNote: string;
  afterNote: string;
  features: string[];
  badge?: string;
  featured?: boolean;
  dimmed?: boolean;
  ctaLabel: string;
  trackEvent?: Parameters<typeof track>[0];
}

export default function PricingCard({ name, price, priceNote, afterNote, features, badge, featured, dimmed, ctaLabel, trackEvent }: Props) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (trackEvent) track(trackEvent);
    navigate('/checkout');
  };

  return (
    <div
      className={`rounded-2xl p-8 relative flex flex-col ${dimmed ? 'opacity-55' : ''}`}
      style={{
        border: featured ? '2px solid transparent' : '1.5px solid var(--border)',
        background: featured ? 'linear-gradient(#fff,#fff) padding-box, var(--grad) border-box' : '#fff',
        boxShadow: featured ? '0 20px 60px rgba(140,121,224,.15)' : 'none',
      }}
    >
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] font-black px-4 py-1.5 rounded-full whitespace-nowrap" style={{ background: 'var(--grad)' }}>
          {badge}
        </div>
      )}
      <div className="text-[12.5px] font-black uppercase tracking-wide mb-3" style={{ color: 'var(--soft)' }}>{name}</div>
      <div className="text-[40px] font-black tracking-tight mb-1" style={{ letterSpacing: '-1.5px' }}>
        {price} <span className="text-[14px] font-medium" style={{ color: 'var(--soft)' }}>today</span>
      </div>
      <p className="text-[13px] mb-5 leading-snug" style={{ color: 'var(--soft)' }}>{priceNote}</p>
      <p className="text-[12px] mb-5 italic" style={{ color: 'var(--soft)' }}>{afterNote}</p>
      <ul className="flex-1 mb-6 space-y-2">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-[13.5px]" style={{ color: 'var(--soft)' }}>
            <span className="font-black" style={{ color: 'var(--g4)' }}>✓</span> {f}
          </li>
        ))}
      </ul>
      {!dimmed ? (
        <button
          onClick={handleClick}
          className="gbtn w-full justify-center text-[14px]"
        >
          {ctaLabel}
        </button>
      ) : (
        <button className="gost w-full justify-center text-[14px] opacity-60" disabled>{ctaLabel}</button>
      )}
    </div>
  );
}
