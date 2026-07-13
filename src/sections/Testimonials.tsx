import LazyVideo from '../components/LazyVideo';
import SectionHeading from '../components/SectionHeading';

const placeholders = [
  { name:'Parent testimonial', location:'Parent · Grade 5', quote:'"My child finally understood without waiting for a tutor."', large:true },
  { name:'Student reaction', location:'Student · Age 14', quote:'"I actually wanted to do more questions."' },
  { name:'College student', location:'Engineering · Year 2', quote:'"Explained the concept three different ways until it clicked."' },
  { name:'Professional', location:'Marketing manager', quote:'"Built my Excel model in a session I would have spent two hours on."' },
];

export default function Testimonials() {
  return (
    <section id="reviews" className="py-24 px-6" style={{ background: 'var(--dim)' }}>
      <div className="max-w-[1100px] mx-auto">
        <SectionHeading eyebrow="Real moments" heading="Real learners. Real moments of understanding." />
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollSnapType: 'x mandatory' }}>
          {placeholders.map((p, i) => (
            <div
              key={i}
              className="flex-none rounded-2xl overflow-hidden bg-white"
              style={{ width: p.large ? '420px' : '300px', scrollSnapAlign: 'start', border: '1.5px solid var(--border)' }}
            >
              <LazyVideo
                label={p.name}
                meta="Replace with real video testimonial"
                aspectRatio={p.large ? '16/10' : '4/3'}
                className="w-full"
              />
              <div className="p-5">
                <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: 'var(--soft)' }}>{p.quote}</p>
                <div className="font-black text-[13px]">{p.name}</div>
                <div className="text-[12px]" style={{ color: 'var(--soft)' }}>{p.location}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
