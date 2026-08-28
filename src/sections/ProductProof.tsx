/**
 * ProductProof.tsx — Section 2
 *
 * Changes from previous version:
 *  - Eyebrow label: "Product proof" → "See it teach."
 *  - CTA: "Watch the full learning session" → "Watch a full learning session"
 *  - Right-side placeholder replaced with Bunny Stream highlights iframe
 *  - CTA now opens a three-lesson selector modal (not a generic modal)
 *  - No HLS library, no local video files, no downloaded assets
 */
import { useState, useEffect, useId, useRef } from 'react';
import { X, FlaskConical, Calculator, BookOpen, ChevronLeft, Clock } from 'lucide-react';
import SectionHeading from '../components/SectionHeading';
import { track } from '../utils/analytics';

/* ── Bunny Stream URLs ─────────────────────────────────────────────────── */
const PRODUCT_PROOF_HIGHLIGHTS_URL =
  'https://player.mediadelivery.net/embed/712849/5418c7cc-4a8c-4103-89d7-39e87ca74abc?autoplay=false&muted=false&loop=false&preload=false&playsinline=true&rememberPosition=false';

const SCIENCE_SESSION_URL =
  'https://player.mediadelivery.net/embed/712849/5ef5d244-dc99-4bbe-b153-7dc01214b5b6?autoplay=false&muted=false&loop=false&preload=false&playsinline=true&rememberPosition=false';

const MATHS_PRO_SESSION_URL =
  'https://player.mediadelivery.net/embed/712849/4eedcbcc-84e6-4e6d-9db3-96cd6280fce2?autoplay=false&muted=false&loop=false&preload=false&playsinline=true&rememberPosition=false';

const HOMEWORK_HELP_SESSION_URL =
  'https://player.mediadelivery.net/embed/712849/df215341-bec2-484a-b897-458a00cda21a?autoplay=false&muted=false&loop=false&preload=false&playsinline=true&rememberPosition=false';

/* ── Lesson data ────────────────────────────────────────────────────────── */
interface LessonSession {
  id: string;
  title: string;
  duration: string;
  description: string;
  embedUrl: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}

const learningSessions: LessonSession[] = [
  {
    id: 'science',
    title: 'Science',
    duration: '6 min',
    description: 'Visual science learning and follow-up questions.',
    embedUrl: SCIENCE_SESSION_URL,
    Icon: FlaskConical,
  },
  {
    id: 'maths-pro',
    title: 'Maths Pro',
    duration: '4 min',
    description: 'Step-by-step mathematical problem solving.',
    embedUrl: MATHS_PRO_SESSION_URL,
    Icon: Calculator,
  },
  {
    id: 'homework-help',
    title: 'Homework Help',
    duration: '4 min',
    description: 'Studdy helps a learner understand their homework.',
    embedUrl: HOMEWORK_HELP_SESSION_URL,
    Icon: BookOpen,
  },
];

/* ── Three-lesson selector modal ────────────────────────────────────────────
 *
 * SAFETY REQUIREMENTS MET:
 * - Conditionally mounted (not permanently hidden in DOM)
 * - No orientation/resize listeners added
 * - ESC listener registered only while open, removed on cleanup
 * - Body overflow restored via useEffect cleanup — always fires
 * - No pause()/play()/currentTime called on Bunny iframe
 * - Unmounting the selected iframe stops Bunny playback automatically
 * - state update guard via mounted ref prevents post-unmount setState
 * ──────────────────────────────────────────────────────────────────────── */
function LessonModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<LessonSession | null>(null);
  const headingId = useId();
  const mountedRef = useRef(true);

  /* ESC closes modal */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  /* Body scroll lock — cleanup always restores overflow */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* Unmount guard */
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleSelectLesson = (lesson: LessonSession) => {
    /* Unmount previous iframe before mounting next (clears old Bunny session) */
    setSelected(null);
    requestAnimationFrame(() => {
      if (mountedRef.current) setSelected(lesson);
    });
  };

  const handleBack = () => setSelected(null);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        animation: 'pp-fade-in 200ms ease forwards',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <style>{`
        @keyframes pp-fade-in  { from { opacity:0 } to { opacity:1 } }
        @keyframes pp-scale-in { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10,8,20,.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          width: '90vw', maxWidth: '820px',
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: '20px',
          boxShadow: '0 40px 100px rgba(0,0,0,.25)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'pp-scale-in 220ms cubic-bezier(.16,1,.3,1) forwards',
        }}
      >
        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selected && (
              <button
                onClick={handleBack}
                aria-label="Choose another lesson"
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'var(--dim)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '5px 10px',
                  fontSize: '12.5px', fontWeight: 700, color: 'var(--soft)',
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={14} aria-hidden />
                Choose another lesson
              </button>
            )}
            {!selected && (
              <div>
                <div
                  className="eyebrow"
                  style={{ marginBottom: '2px', fontSize: '11px' }}
                >
                  Full learning sessions
                </div>
                <h2
                  id={headingId}
                  className="font-black"
                  style={{ fontSize: '17px', color: 'var(--ink)', letterSpacing: '-0.3px' }}
                >
                  Choose a lesson to watch
                </h2>
              </div>
            )}
            {selected && (
              <div>
                <div className="font-black" style={{ fontSize: '16px', color: 'var(--ink)' }}>
                  {selected.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--soft)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} aria-hidden />
                  {selected.duration}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close lesson selector"
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'var(--dim)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--soft)', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: selected ? '0' : '22px' }}>

          {/* ── Lesson card selector ── */}
          {!selected && (
            <>
              <p style={{ fontSize: '14px', color: 'var(--soft)', marginBottom: '18px' }}>
                Watch a real uninterrupted Studdy learning session.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {learningSessions.map(lesson => (
                  <button
                    key={lesson.id}
                    onClick={() => handleSelectLesson(lesson)}
                    aria-label={`Watch ${lesson.title} — ${lesson.duration}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '16px 18px',
                      background: '#fff',
                      border: '1.5px solid var(--border)',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--g3)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(140,121,224,.1)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                    }}
                    onFocus={e => { (e.currentTarget as HTMLButtonElement).style.outline = '2px solid var(--g4)'; (e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'; }}
                    onBlur={e  => { (e.currentTarget as HTMLButtonElement).style.outline = 'none'; }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: 'var(--grad)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }} aria-hidden="true">
                      <lesson.Icon size={20} strokeWidth={1.8} aria-hidden />
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-black" style={{ fontSize: '15px', color: 'var(--ink)', marginBottom: '2px' }}>
                        {lesson.title}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--soft)', lineHeight: 1.4 }}>
                        {lesson.description}
                      </div>
                    </div>

                    {/* Duration */}
                    <div style={{
                      flexShrink: 0,
                      fontSize: '12px', fontWeight: 700, color: 'var(--soft)',
                      display: 'flex', alignItems: 'center', gap: '3px',
                    }}>
                      <Clock size={12} aria-hidden />
                      {lesson.duration}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Selected lesson iframe ──
           * Only one iframe rendered at a time.
           * Unmounting clears Bunny playback — no pause()/currentTime needed.
           */}
          {selected && (
            <div style={{ aspectRatio: '16/9', width: '100%', background: '#000', flexShrink: 0 }}>
              <iframe
                key={selected.id}          /* key ensures fresh mount on lesson switch */
                src={selected.embedUrl}
                title={`${selected.title} — Studdy learning session`}
                loading="lazy"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ── ProductProof section ─────────────────────────────────────────────── */
export default function ProductProof() {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal  = () => { track('full_demo_open'); setModalOpen(true);  };
  const closeModal = () => setModalOpen(false);

  return (
    <section id="proof" className="py-24 px-6">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* Left — copy and CTA (layout unchanged) */}
          <div>
            <SectionHeading
              eyebrow="See it teach."
              heading="Not another chatbot. A tutor that shows its work."
              sub="Watch Studdy explain one question visually, respond to follow-ups and adapt the explanation."
            />
            <button
              className="gbtn"
              onClick={openModal}
              aria-label="Watch a full learning session"
            >
              Watch a full learning session  {/* B3: CTA wording updated */}
            </button>
          </div>

          {/* Right — B2: Bunny highlights iframe, replaces LazyVideo placeholder */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#111',
              boxShadow: '0 20px 60px rgba(0,0,0,.1)',
            }}
          >
            <iframe
              src={PRODUCT_PROOF_HIGHLIGHTS_URL}
              title="Studdy learning highlights"
              loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
            />
          </div>
        </div>
      </div>

      {/* B4–B6: Lesson selector modal — conditionally mounted */}
      {modalOpen && <LessonModal onClose={closeModal} />}
    </section>
  );
}
