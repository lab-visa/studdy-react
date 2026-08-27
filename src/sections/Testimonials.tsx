/**
 * Testimonials.tsx — Section 7
 *
 * Layout:
 * 1. Section heading
 * 2. Stats bar (real Studdy AI numbers)
 * 3. Real testimonial video (16:9, autoplay muted loop)
 * 4. Two pull quotes (real, from studdyai.com)
 * 5. Auto-scrolling real student reviews ticker
 */
import { useEffect, useRef } from 'react';
import SectionHeading from '../components/SectionHeading';

/* ── Real Studdy AI stats ─────────────────────────────────────── */
const STATS = [
  { value: '4.8★', label: 'Student rating' },
  { value: '500K+', label: 'Students helped' },
  { value: '10M+', label: 'Problems explained' },
  { value: '24/7', label: 'Always available' },
];

/* ── Real student reviews ────────────────────────────────────── */
const REVIEWS = [
  {
    name: 'Silver',
    date: 'Oct 2023',
    title: 'The perfect AI tutor',
    body: 'It helped me with my ADHD and I didn\'t need to cheat anymore. This really helped me understand my homework because my teacher told me I have to do it but this app helped me so much.',
    stars: 5,
  },
  {
    name: 'Dogs 1o1',
    date: 'Nov 2023',
    title: 'AMAZING!',
    body: 'My grades were 4 Fs and 1 D - now thanks to Studdy my grades are all A+. It explains everything step by step on a visual whiteboard. If you struggle with any subject, try Studdy.',
    stars: 5,
  },
  {
    name: 'charlie24681012',
    date: 'Sep 2023',
    title: 'amazing get IT RN!',
    body: 'I am a middle school student expected to get all A\'s and B\'s. This app helps so much with work I have trouble understanding. It walks you through the steps so you really understand how it works.',
    stars: 5,
  },
  {
    name: 'Shelly808s',
    date: 'Nov 2024',
    title: 'Amazing because wow!!',
    body: 'Studdy helped me finally understand the new unit in my chemistry class because I was seriously behind. It focuses on exactly the concept you need help with and explains it clearly.',
    stars: 5,
  },
  {
    name: 'Charhatesmath',
    date: 'Oct 2023',
    title: 'This saved my life',
    body: 'I\'m in 8th grade and am currently struggling in math and science but this app not only gives you the answers, it gives you the option to have a self tutor to help you understand it better.',
    stars: 5,
  },
  {
    name: 'apple_user_1234567890',
    date: 'Dec 2024',
    title: 'I love you Studdy',
    body: 'I love Studdy so much - it\'s so helpful and actually makes me understand math. Thank you for helping me in my math class, I finally get it!',
    stars: 5,
  },
  {
    name: 'Chelsea Z.A',
    date: 'Sep 2024',
    title: '5/5',
    body: 'You just ask Studdy your question and it breaks it down step by step on a visual whiteboard. If you still don\'t get it, ask for more help and it explains in even simpler steps.',
    stars: 5,
  },
  {
    name: 'Weirdo Art',
    date: 'Dec 2024',
    title: 'Best AI tutor ever',
    body: 'I don\'t usually write reviews but I had to for Studdy. It is such a great AI whiteboard tutor for homework. Social Studies is the hardest but Studdy explains it visually and makes it so much easier.',
    stars: 5,
  },
];

/* Duplicate for seamless loop */
const TICKER = [...REVIEWS, ...REVIEWS];

/* ── Pull quotes ──────────────────────────────────────────────── */
const PULL_QUOTES = [
  {
    quote: '"I love Studdy. I use it every day for my homework - every time when I\'m struggling."',
    name: 'Janelle',
    role: 'First-Year College Student, NC',
  },
  {
    quote: '"Studdy is amazing. It helps me understand my calculus homework better than when my teacher explains things to me."',
    name: 'Dilan',
    role: '12th Grade, New Jersey',
  },
];

/* ── Star renderer ─────────────────────────────────────────────── */
function Stars({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {Array(n).fill(0).map((_, i) => (
        <span key={i} style={{ color: '#f59e0b', fontSize: '12px' }}>★</span>
      ))}
    </div>
  );
}

/* ── Review card ───────────────────────────────────────────────── */
function ReviewCard({ r }: { r: typeof REVIEWS[0] }) {
  return (
    <div style={{
      flexShrink: 0,
      width: '280px',
      background: '#fff',
      border: '1.5px solid var(--border)',
      borderRadius: '16px',
      padding: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <Stars n={r.stars} />
      <div style={{
        fontWeight: 800, fontSize: '13.5px',
        color: 'var(--ink)', lineHeight: 1.3,
      }}>
        {r.title}
      </div>
      <p style={{
        fontSize: '13px', color: 'var(--soft)',
        lineHeight: 1.6, flex: 1,
      }}>
        {r.body}
      </p>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginTop: '4px',
      }}>
        <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--ink)' }}>
          {r.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--soft)' }}>{r.date}</div>
      </div>
    </div>
  );
}

/* ── Auto-scrolling ticker ─────────────────────────────────────── */
function ReviewTicker() {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let x = 0;
    const SPEED = 0.6; // px per frame
    let raf: number;

    const tick = () => {
      if (!pausedRef.current) {
        x += SPEED;
        /* Reset when first half scrolled - seamless loop */
        const halfW = track.scrollWidth / 2;
        if (x >= halfW) x = 0;
        track.style.transform = `translateX(-${x}px)`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const pause  = () => { pausedRef.current = true;  };
    const resume = () => { pausedRef.current = false; };
    track.addEventListener('mouseenter', pause);
    track.addEventListener('mouseleave', resume);
    track.addEventListener('touchstart', pause, { passive: true });
    track.addEventListener('touchend',   resume);

    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener('mouseenter', pause);
      track.removeEventListener('mouseleave', resume);
      track.removeEventListener('touchstart', pause);
      track.removeEventListener('touchend',   resume);
    };
  }, []);

  return (
    <div style={{ overflow: 'hidden', width: '100%', padding: '8px 0' }}>
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          gap: '16px',
          willChange: 'transform',
        }}
      >
        {TICKER.map((r, i) => <ReviewCard key={i} r={r} />)}
      </div>
    </div>
  );
}

/* ── Main section ──────────────────────────────────────────────── */
export default function Testimonials() {
  const BUNNY_LIB = '712849';
  const VIDEO_ID  = '1a2c0484-f73a-474b-a2ea-d35487f524f5';
  /* Vish's call: don't force the video to loop in the background — let it
   * sit there like a real video and only play if a visitor chooses to. */
  const embedUrl  =
    `https://player.mediadelivery.net/embed/${BUNNY_LIB}/${VIDEO_ID}` +
    `?autoplay=false&muted=false&loop=false&controls=true&preload=false`;

  return (
    <section id="reviews" className="py-24 px-6" style={{ background: 'var(--dim)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        <SectionHeading
          eyebrow="Real learners"
          heading="Students who finally get it."
          sub="Real students. Real results. Real moments of understanding."
          center
        />

        {/* ── Stats bar ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '48px',
        }}
          className="sm:grid-cols-4"
        >
          {STATS.map(s => (
            <div key={s.label} style={{
              background: '#fff',
              border: '1.5px solid var(--border)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 'clamp(24px, 3vw, 32px)',
                fontWeight: 900,
                letterSpacing: '-0.5px',
                background: 'var(--grad)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '4px',
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--soft)', fontWeight: 600 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Testimonial video + pull quotes ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '24px',
          marginBottom: '48px',
        }}
          className="md:grid-cols-[1.2fr_1fr]"
        >
          {/* Video */}
          <div style={{
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1.5px solid var(--border)',
            background: '#0d0b15',
            aspectRatio: '16/9',
            position: 'relative',
          }}>
            <iframe
              src={embedUrl}
              title="Student testimonial - Studdy AI"
              allow="autoplay; encrypted-media; picture-in-picture"
              loading="eager"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                border: 0,
              }}
            />
          </div>

          {/* Pull quotes */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            justifyContent: 'center',
          }}>
            {PULL_QUOTES.map((q, i) => (
              <div key={i} style={{
                background: '#fff',
                border: '1.5px solid var(--border)',
                borderRadius: '20px',
                padding: '24px',
                position: 'relative',
              }}>
                {/* Quote mark */}
                <div style={{
                  position: 'absolute', top: '16px', right: '20px',
                  fontSize: '48px', lineHeight: 1,
                  background: 'var(--grad)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontFamily: 'Georgia, serif',
                  opacity: 0.3,
                }} aria-hidden>❝</div>

                <Stars n={5} />
                <p style={{
                  fontSize: 'clamp(14px, 1.3vw, 16px)',
                  color: 'var(--ink)',
                  lineHeight: 1.65,
                  fontStyle: 'italic',
                  margin: '12px 0 16px',
                }}>
                  {q.quote}
                </p>
                <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--ink)' }}>
                  {q.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--soft)', marginTop: '2px' }}>
                  {q.role}
                </div>
              </div>
            ))}

            {/* Rating badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 18px',
              background: '#fff',
              border: '1.5px solid var(--border)',
              borderRadius: '14px',
            }}>
              <div style={{ fontSize: '28px' }}>⭐</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--ink)' }}>
                  4.8 average student rating
                </div>
                <div style={{ fontSize: '12px', color: 'var(--soft)' }}>
                  Verified student reviews - 500K+ learners helped
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Auto-scrolling reviews ticker ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '12px', fontWeight: 700,
            color: 'var(--soft)', marginBottom: '16px',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            What students are saying
          </div>
          <ReviewTicker />
        </div>

      </div>
    </section>
  );
}
