
const steps = [
  { n:'1', icon:'🎙️', title:'Ask', desc:'Voice, text, image or document — any format, any question.' },
  { n:'2', icon:'✏️', title:'Understand', desc:'Visual explanation with tutor voice draws step-by-step on the whiteboard.' },
  { n:'3', icon:'💬', title:'Explore', desc:'Ask follow-up questions. Unlimited. Without feeling embarrassed.' },
  { n:'4', icon:'🎯', title:'Practise', desc:'Try examples, challenges or quizzes. Build real understanding.' },
];

export default function HowItWorks() {
  return (
    <section id="hiw" className="py-24 px-6" style={{ background: '#15131F' }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="eyebrow mb-6" style={{ color: 'rgba(255,255,255,.45)', borderColor: 'rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)' }}>
          How it works
        </div>
        <h2 className="font-black text-white mb-14" style={{ fontSize: 'clamp(26px,3.5vw,40px)', letterSpacing: '-0.8px' }}>
          From question to understanding.
        </h2>

        <div className="grid md:grid-cols-4 gap-0 relative">
          {/* connecting line */}
          <div className="hidden md:block absolute top-6 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,.08)' }} />
          {steps.map((s, i) => (
            <div key={i} className="relative pt-14 px-5">
              <div className="absolute top-0 left-5 w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-[15px]" style={{ background: 'var(--grad)' }}>
                {s.n}
              </div>
              <div className="text-[26px] mb-3">{s.icon}</div>
              <h3 className="font-black text-white text-[17px] mb-2">{s.title}</h3>
              <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,.45)' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
