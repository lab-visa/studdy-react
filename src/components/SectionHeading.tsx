interface Props {
  eyebrow?: string;
  heading: string;
  sub?: string;
  center?: boolean;
  light?: boolean;
}

export default function SectionHeading({ eyebrow, heading, sub, center, light }: Props) {
  return (
    <div className={`mb-11 ${center ? 'text-center' : ''} max-w-2xl ${center ? 'mx-auto' : ''}`}>
      {eyebrow && <div className="eyebrow mb-4">{eyebrow}</div>}
      <h2
        className="font-black tracking-tight leading-[1.1] mb-3"
        style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', letterSpacing: '-0.8px', color: light ? '#fff' : 'var(--ink)' }}
      >
        {heading}
      </h2>
      {sub && <p className="text-[15.5px] leading-relaxed" style={{ color: light ? 'rgba(255,255,255,.55)' : 'var(--soft)' }}>{sub}</p>}
    </div>
  );
}
