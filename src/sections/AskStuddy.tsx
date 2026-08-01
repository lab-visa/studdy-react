/**
 * AskStuddy.tsx — "Try It Yourself" — Section 3
 *
 * State machine:
 *   idle → typingMain → thinkingMain → playingMain
 *        → followupSelection → typingFollowup → thinkingFollowup
 *        → playingFollowup → complete
 *        → unavailable (topic has no video yet)
 *        → error (video failed to load)
 */
import {
  useState, useRef, useEffect, useCallback, useReducer,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, RotateCcw } from 'lucide-react';
import SectionHeading from '../components/SectionHeading';
import {
  LESSON_CATEGORIES,
  type LessonCategory,
  type LessonTopic,
  type FollowUp,
} from '../data/lessonData';
import { track } from '../utils/analytics';

/* ── State machine ──────────────────────────────────────────────── */
type LessonState =
  | 'idle'
  | 'typingMain'
  | 'thinkingMain'
  | 'playingMain'
  | 'followupSelection'
  | 'typingFollowup'
  | 'thinkingFollowup'
  | 'playingFollowup'
  | 'complete'
  | 'unavailable'
  | 'error';

interface State {
  lessonState: LessonState;
  activeTopic: LessonTopic | null;
  activeFollowUp: FollowUp | null;
  inputVal: string;
  posterVisible: boolean;   // true = freeze last frame overlay
  showFinalFrame: boolean;  // true after video ends, before next action
}

type Action =
  | { type: 'SELECT_TOPIC'; topic: LessonTopic }
  | { type: 'SET_INPUT'; val: string }
  | { type: 'START_THINKING_MAIN' }
  | { type: 'START_PLAYING_MAIN' }
  | { type: 'MAIN_ENDED' }
  | { type: 'SHOW_FOLLOWUPS' }
  | { type: 'SELECT_FOLLOWUP'; fu: FollowUp }
  | { type: 'START_THINKING_FOLLOWUP' }
  | { type: 'START_PLAYING_FOLLOWUP' }
  | { type: 'FOLLOWUP_ENDED' }
  | { type: 'SHOW_COMPLETE' }
  | { type: 'UNAVAILABLE' }
  | { type: 'ERROR' }
  | { type: 'RESET' };

const INITIAL: State = {
  lessonState: 'idle',
  activeTopic: null,
  activeFollowUp: null,
  inputVal: '',
  posterVisible: false,
  showFinalFrame: false,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'SELECT_TOPIC':
      return { ...INITIAL, lessonState: 'typingMain', activeTopic: a.topic };
    case 'SET_INPUT':
      return { ...s, inputVal: a.val };
    case 'START_THINKING_MAIN':
      return { ...s, lessonState: 'thinkingMain' };
    case 'START_PLAYING_MAIN':
      return { ...s, lessonState: 'playingMain', posterVisible: false };
    case 'MAIN_ENDED':
      return { ...s, posterVisible: true, showFinalFrame: true };
    case 'SHOW_FOLLOWUPS':
      return { ...s, lessonState: 'followupSelection', posterVisible: false };
    case 'SELECT_FOLLOWUP':
      return { ...s, lessonState: 'typingFollowup', activeFollowUp: a.fu,
               posterVisible: false, showFinalFrame: false };
    case 'START_THINKING_FOLLOWUP':
      return { ...s, lessonState: 'thinkingFollowup' };
    case 'START_PLAYING_FOLLOWUP':
      return { ...s, lessonState: 'playingFollowup', posterVisible: false };
    case 'FOLLOWUP_ENDED':
      return { ...s, posterVisible: true, showFinalFrame: true };
    case 'SHOW_COMPLETE':
      return { ...s, lessonState: 'complete', posterVisible: false };
    case 'UNAVAILABLE':
      return { ...s, lessonState: 'unavailable' };
    case 'ERROR':
      return { ...s, lessonState: 'error' };
    case 'RESET':
      return INITIAL;
    default:
      return s;
  }
}

/* ── Category context panel ─────────────────────────────────────── */
function ContextPanel({
  cat,
  topic,
  onCta,
}: {
  cat: LessonCategory;
  topic: LessonTopic | null;
  onCta: () => void;
}) {
  const ctx = cat.context;
  const heading = topic ? topic.question : ctx.heading;
  const bullets: [string, string, string] = topic
    ? ['Visual whiteboard explanation', 'Ask follow-up questions', 'Start free — no card needed']
    : ctx.bullets;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #fdf4fb, #f0ecff, #eaf6ff)',
        border: '1.5px solid var(--border)',
        borderRadius: '20px',
        padding: '24px',
        marginTop: '12px',
      }}
    >
      <div className="eyebrow mb-3" style={{ fontSize: '11px' }}>{ctx.label}</div>
      <h3
        className="font-black leading-snug mb-2"
        style={{ fontSize: 'clamp(16px, 1.8vw, 20px)', letterSpacing: '-0.4px', color: 'var(--ink)' }}
      >
        {heading}
      </h3>
      {!topic && (
        <p style={{ fontSize: '13.5px', color: 'var(--soft)', lineHeight: 1.6, marginBottom: '14px' }}>
          {ctx.description}
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {bullets.map(b => (
          <li key={b} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--soft)' }}>
            <Check size={13} style={{ color: 'var(--g4)', flexShrink: 0 }} aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      <button
        className="gbtn"
        style={{ fontSize: '13.5px', padding: '10px 20px' }}
        onClick={onCta}
        aria-label={`Start free trial — ${ctx.cta}`}
      >
        {topic ? 'Start Free Trial' : ctx.cta}
      </button>
    </div>
  );
}

/* ── Topic card ─────────────────────────────────────────────────── */
function TopicCard({
  topic,
  active,
  onClick,
}: {
  topic: LessonTopic;
  active: boolean;
  onClick: () => void;
}) {
  const available = Boolean(topic.mp4Url);
  return (
    <button
      onClick={onClick}
      aria-label={`${available ? 'Watch' : 'Preview coming'}: ${topic.question}`}
      aria-pressed={active}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        padding: '14px',
        background: active ? 'rgba(239,85,182,.05)' : '#fff',
        border: `1.5px solid ${active ? 'var(--g1)' : 'var(--border)'}`,
        borderRadius: '14px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 150ms, background 150ms, box-shadow 150ms',
        boxShadow: active ? '0 0 0 3px rgba(239,85,182,.1)' : 'none',
        fontFamily: 'inherit',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--g3)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(140,121,224,.1)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }
      }}
      onFocus={e => { e.currentTarget.style.outline = '2px solid var(--g4)'; e.currentTarget.style.outlineOffset = '2px'; }}
      onBlur={e  => { e.currentTarget.style.outline = 'none'; }}
    >
      {/* Icon */}
      <div
        style={{
          width: '32px', height: '32px', borderRadius: '9px',
          background: available ? 'var(--grad)' : 'var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <topic.Icon size={15} color={available ? '#fff' : 'var(--soft)'} strokeWidth={1.8} />
      </div>
      {/* Text */}
      <div>
        <div className="font-black" style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.2 }}>
          {topic.title}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--soft)', lineHeight: 1.4, marginTop: '2px' }}>
          {topic.descriptor}
        </div>
      </div>
      {/* Coming soon badge */}
      {!available && (
        <div
          style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'var(--dim)', border: '1px solid var(--border)',
            borderRadius: '999px', padding: '2px 7px',
            fontSize: '10px', fontWeight: 700, color: 'var(--soft)',
          }}
        >
          Soon
        </div>
      )}
    </button>
  );
}

/* ── Suggestion pill ─────────────────────────────────────────────── */
function SuggestionPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Ask follow-up: ${label}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '10px', width: '100%', padding: '12px 16px',
        background: '#fff', border: '1.5px solid var(--border)',
        borderRadius: '999px', fontSize: '13.5px', fontWeight: 600,
        color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 150ms, box-shadow 150ms',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--g3)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(140,121,224,.12)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
      }}
      onFocus={e  => { e.currentTarget.style.outline = '2px solid var(--g4)'; e.currentTarget.style.outlineOffset = '2px'; }}
      onBlur={e   => { e.currentTarget.style.outline = 'none'; }}
    >
      <span>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: 'var(--soft)', flexShrink: 0 }} aria-hidden>
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  );
}

/* ── Thinking dots ───────────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }} aria-hidden>
      {[0,1,2].map(i => (
        <div key={i} className="animate-bounce"
          style={{ width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--g1)', animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

/* ── Native video player ─────────────────────────────────────────── */
interface VideoPlayerProps {
  src: string;
  onEnded: () => void;
  onError: () => void;
  label: string;
}
function VideoPlayer({ src, onEnded, onError, label }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    // Play is triggered by user interaction (topic/followup click), so no autoplay policy issue
    const p = v.play();
    if (p) p.catch(() => { /* reduced autoplay environment — user can press play */ });
    return () => { v.pause(); };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      controls
      playsInline
      preload="auto"
      aria-label={label}
      onEnded={onEnded}
      onError={onError}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        objectFit: 'contain',
        objectPosition: 'center',
        display: 'block',
        background: '#fbfaf5',  /* matches wrapper — no black bars */
      }}
    />
  );
}

/* ── Preload link helper ─────────────────────────────────────────── */
function usePreloadVideos(urls: string[]) {
  const linksRef = useRef<HTMLLinkElement[]>([]);

  useEffect(() => {
    // Respect Save-Data hint
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData;
    if (saveData) return;

    const links = urls.filter(Boolean).map(href => {
      const link = document.createElement('link');
      link.rel      = 'preload';
      link.as       = 'video';
      link.href     = href;
      document.head.appendChild(link);
      return link;
    });
    linksRef.current = links;

    return () => {
      links.forEach(l => l.parentNode?.removeChild(l));
      linksRef.current = [];
    };
  }, [urls.join('|')]);
}

/* ── Main section ────────────────────────────────────────────────── */
export default function AskStuddy() {
  const navigate    = useNavigate();
  const mountedRef  = useRef(true);
  const timerA      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerB      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [catIdx, setCatIdx] = useState(0);
  const [state, dispatch]   = useReducer(reducer, INITIAL);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerA.current) clearTimeout(timerA.current);
      if (timerB.current) clearTimeout(timerB.current);
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (timerA.current) clearTimeout(timerA.current);
    if (timerB.current) clearTimeout(timerB.current);
  }, []);

  /* Preload follow-up videos while main plays */
  const preloadUrls = (state.lessonState === 'playingMain' && state.activeTopic)
    ? state.activeTopic.followUps.map(f => f.mp4Url)
    : [];
  usePreloadVideos(preloadUrls);

  /* Category switch — full reset */
  const handleCatChange = useCallback((idx: number) => {
    clearTimers();
    dispatch({ type: 'RESET' });
    setCatIdx(idx);
  }, [clearTimers]);

  /* Typing animation */
  const typeText = useCallback((text: string, onDone: () => void) => {
    clearTimers();
    if (prefersReduced) {
      dispatch({ type: 'SET_INPUT', val: text });
      onDone();
      return;
    }
    dispatch({ type: 'SET_INPUT', val: '' });
    let i = 0;
    const tick = () => {
      if (!mountedRef.current) return;
      i++;
      dispatch({ type: 'SET_INPUT', val: text.slice(0, i) });
      if (i < text.length) {
        timerA.current = setTimeout(tick, 30);
      } else {
        onDone();
      }
    };
    timerA.current = setTimeout(tick, 30);
  }, [clearTimers, prefersReduced]);

  /* Topic selected */
  const handleTopicSelect = useCallback((topic: LessonTopic) => {
    clearTimers();
    track('interactive_question_selected', { id: topic.id });

    if (!topic.mp4Url) {
      dispatch({ type: 'SELECT_TOPIC', topic });
      dispatch({ type: 'UNAVAILABLE' });
      dispatch({ type: 'SET_INPUT', val: topic.question });
      return;
    }

    dispatch({ type: 'SELECT_TOPIC', topic });
    typeText(topic.question, () => {
      if (!mountedRef.current) return;
      dispatch({ type: 'START_THINKING_MAIN' });
      timerB.current = setTimeout(() => {
        if (!mountedRef.current) return;
        dispatch({ type: 'START_PLAYING_MAIN' });
      }, 800);
    });
  }, [clearTimers, typeText]);

  /* Main video ended */
  const handleMainEnded = useCallback(() => {
    if (!mountedRef.current) return;
    dispatch({ type: 'MAIN_ENDED' });
    timerA.current = setTimeout(() => {
      if (!mountedRef.current) return;
      dispatch({ type: 'SHOW_FOLLOWUPS' });
    }, 600);
  }, []);

  /* Follow-up selected */
  const handleFollowUpSelect = useCallback((fu: FollowUp) => {
    clearTimers();
    dispatch({ type: 'SELECT_FOLLOWUP', fu });
    typeText(fu.label, () => {
      if (!mountedRef.current) return;
      dispatch({ type: 'START_PLAYING_FOLLOWUP' });
    });
  }, [clearTimers, typeText]);

  /* Follow-up video ended */
  const handleFollowUpEnded = useCallback(() => {
    if (!mountedRef.current) return;
    dispatch({ type: 'FOLLOWUP_ENDED' });
    timerA.current = setTimeout(() => {
      if (!mountedRef.current) return;
      dispatch({ type: 'SHOW_COMPLETE' });
    }, 600);
  }, []);

  /* Video error */
  const handleVideoError = useCallback(() => {
    if (mountedRef.current) dispatch({ type: 'ERROR' });
  }, []);

  /* Reset to topic picker */
  const handleReset = useCallback(() => {
    clearTimers();
    dispatch({ type: 'RESET' });
  }, [clearTimers]);

  const cat = LESSON_CATEGORIES[catIdx];
  const { lessonState, activeTopic, activeFollowUp, inputVal } = state;

  /* Which video src to render.
   * During typingFollowup / thinkingFollowup the MAIN video src is kept
   * so the same <video> element stays mounted showing the final frame.
   * Only when START_PLAYING_FOLLOWUP fires does the key change, triggering
   * a clean unmount + remount (with crossfade) to the follow-up video. */
  const activeVideoSrc =
    (lessonState === 'playingMain'
      || lessonState === 'followupSelection'
      || lessonState === 'typingFollowup'
      || lessonState === 'thinkingFollowup')
        ? (activeTopic?.mp4Url ?? '')
    : (lessonState === 'playingFollowup' || lessonState === 'complete')
        ? (activeFollowUp?.mp4Url ?? activeTopic?.mp4Url ?? '')
    : '';

  const showVideo   = lessonState === 'playingMain'
                   || lessonState === 'followupSelection'
                   || lessonState === 'typingFollowup'
                   || lessonState === 'thinkingFollowup'
                   || lessonState === 'playingFollowup'
                   || lessonState === 'complete';
  const showStage   = lessonState !== 'idle';
  const showIdle    = lessonState === 'idle';

  /* Top-bar status */
  const statusLine =
    showIdle                                              ? 'Select a topic to begin' :
    lessonState === 'typingMain'                          ? 'Sending your question...' :
    lessonState === 'thinkingMain'                        ? 'Let me explain that visually...' :
    lessonState === 'playingMain'                         ? 'Studdy is explaining' :
    lessonState === 'followupSelection'                   ? 'What would you like to explore next?' :
    lessonState === 'typingFollowup'                      ? 'Studdy is explaining' :
    lessonState === 'thinkingFollowup'                    ? 'Studdy is explaining' :
    lessonState === 'playingFollowup'                     ? 'Exploring your follow-up' :
    lessonState === 'complete'                            ? 'Lesson complete' :
    lessonState === 'unavailable'                         ? 'Preview being prepared' :
    lessonState === 'error'                               ? 'Something went wrong' : '';

  return (
    <section id="demo" className="py-20 px-5" style={{ background: 'var(--dim)' }}>
      <div style={{ maxWidth: '1160px', margin: '0 auto' }}>

        {/* Section heading */}
        <SectionHeading
          eyebrow="Try it yourself"
          heading="Ask Studdy anything."
          sub="Choose a topic, watch Studdy explain it visually, then ask a follow-up."
          center
        />

        {/* Category tabs */}
        <div
          role="tablist"
          aria-label="Lesson categories"
          style={{
            display: 'flex', gap: '4px', padding: '4px',
            background: '#fff', border: '1.5px solid var(--border)',
            borderRadius: '999px', width: 'fit-content',
            margin: '0 auto 32px', flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {LESSON_CATEGORIES.map((c, idx) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={catIdx === idx}
              onClick={() => handleCatChange(idx)}
              style={{
                padding: '8px 16px', borderRadius: '999px',
                fontSize: 'clamp(12px, 1.5vw, 13.5px)', fontWeight: 700,
                background: catIdx === idx ? 'var(--ink)' : 'transparent',
                color:      catIdx === idx ? '#fff' : 'var(--soft)',
                border: 0, cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)',
          gap: '28px',
          alignItems: 'start',
        }}
          className="as-grid"
        >
          {/* ── LEFT ── */}
          <div>
            {/* 2×2 topic grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              marginBottom: '0',
            }}>
              {cat.topics.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  active={activeTopic?.id === topic.id}
                  onClick={() => handleTopicSelect(topic)}
                />
              ))}
            </div>

            {/* Context / benefit panel */}
            <ContextPanel
              cat={cat}
              topic={activeTopic}
              onCta={() => { track('checkout_started'); navigate('/checkout'); }}
            />
          </div>

          {/* ── RIGHT: lesson stage ── */}
          <div
            style={{
              background: '#fff',
              border: '1.5px solid var(--border)',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,.06)',
            }}
          >
            {/* Top bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              background: '#fdfcff',
            }}>
              <div
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'var(--grad)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 900, fontSize: '13px', flexShrink: 0,
                }}
                aria-hidden
              >S</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--ink)' }}>Studdy</div>
                <div
                  style={{ fontSize: '12px', color: 'var(--soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  aria-live="polite"
                >
                  {statusLine}
                </div>
              </div>
              {lessonState === 'thinkingMain' && (
                <ThinkingDots />
              )}
            </div>

            {/* Input row */}
            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                background: 'var(--dim)', border: '1.5px solid var(--border)',
              }}>
                <input
                  type="text"
                  readOnly
                  value={inputVal}
                  placeholder="Select a topic above..."
                  style={{
                    flex: 1, background: 'transparent', border: 0, outline: 'none',
                    fontSize: '14px', fontWeight: 500, color: 'var(--ink)',
                    fontFamily: 'inherit',
                  }}
                  aria-label="Current question"
                  aria-live="polite"
                />
                {lessonState === 'typingMain' && (
                  <div
                    style={{ width: '2px', height: '16px', background: 'var(--g1)', borderRadius: '1px' }}
                    className="animate-pulse"
                    aria-hidden
                  />
                )}
              </div>
            </div>

            {/* Response body */}
            <div style={{ minHeight: '300px' }}>

              {/* Idle */}
              {showIdle && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', textAlign: 'center', padding: '48px 24px',
                  color: 'var(--soft)',
                }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'var(--dim)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', marginBottom: '14px',
                  }} aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: 1.6, maxWidth: '260px' }}>
                    Choose a topic from the left to watch a real lesson.
                  </p>
                </div>
              )}

              {/* Typing / thinking loading — only for main lesson, never for follow-up */}
              {(lessonState === 'typingMain' || lessonState === 'thinkingMain') && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '52px 24px', gap: '14px',
                }}>
                  <ThinkingDots />
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--soft)' }}>
                    {lessonState.startsWith('thinking') ? 'Studdy is thinking...' : 'Sending...'}
                  </p>
                </div>
              )}

              {/* Unavailable */}
              {lessonState === 'unavailable' && activeTopic && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', textAlign: 'center', padding: '48px 24px',
                  color: 'var(--soft)',
                }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'var(--dim)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', marginBottom: '14px',
                  }} aria-hidden>
                    <activeTopic.Icon size={18} style={{ color: 'var(--soft)' }} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                    {activeTopic.title}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--soft)', maxWidth: '260px', lineHeight: 1.6, marginBottom: '18px' }}>
                    This lesson preview is being prepared. Try another topic below.
                  </p>
                  <button className="gost" style={{ fontSize: '13px', padding: '9px 18px' }} onClick={handleReset}>
                    Choose another topic
                  </button>
                </div>
              )}

              {/* Error */}
              {lessonState === 'error' && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', textAlign: 'center', padding: '48px 24px',
                  color: 'var(--soft)',
                }}>
                  <p style={{ fontSize: '14px', marginBottom: '14px' }}>
                    Something went wrong loading this lesson.
                  </p>
                  <button className="gost" style={{ fontSize: '13px', padding: '9px 18px' }} onClick={handleReset}>
                    Try another topic
                  </button>
                </div>
              )}

              {/* Video stage — visible from first play through completion.
                  Deliberately kept visible during typingFollowup / thinkingFollowup
                  so the main video's final frame remains on screen. */}
              {showStage &&
                lessonState !== 'typingMain' && lessonState !== 'thinkingMain' &&
                lessonState !== 'unavailable' && lessonState !== 'error' && (
                <div>
                  {/* 16:9 player container */}
                  <div style={{
                    position: 'relative', width: '100%',
                    aspectRatio: '16/9',
                    background: '#fbfaf5',   /* warm off-white — blends with whiteboard content */
                    overflow: 'hidden',
                  }}>
                    {/* Video — key changes ONLY when activeVideoSrc changes (main → followup).
                        During typingFollowup/thinkingFollowup the key is still the main src,
                        so the same element stays mounted, paused on its final frame.
                        When START_PLAYING_FOLLOWUP fires, activeVideoSrc becomes the followup URL,
                        the key changes, the element remounts with a 200ms fade transition. */}
                    {showVideo && activeVideoSrc && (
                      <div
                        key={activeVideoSrc}
                        style={{
                          position: 'absolute', inset: 0,
                          animation: 'vs-fadein 200ms ease forwards',
                        }}
                      >
                        <style>{`@keyframes vs-fadein { from { opacity:0 } to { opacity:1 } }`}</style>
                        <VideoPlayer
                          src={activeVideoSrc}
                          label={activeFollowUp && lessonState !== 'typingFollowup' && lessonState !== 'thinkingFollowup'
                            ? activeFollowUp.label
                            : (activeTopic?.question ?? 'Lesson')}
                          onEnded={
                            lessonState === 'playingMain'
                            || lessonState === 'typingFollowup'
                            || lessonState === 'thinkingFollowup'
                            || lessonState === 'followupSelection'
                              ? handleMainEnded
                              : handleFollowUpEnded
                          }
                          onError={handleVideoError}
                        />
                      </div>
                    )}
                  </div>

                  {/* Follow-up suggestions */}
                  {lessonState === 'followupSelection' && activeTopic && (
                    <div
                      style={{ padding: '16px 18px', borderTop: '1px solid var(--border)' }}
                      aria-live="polite"
                    >
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--soft)', marginBottom: '10px' }}>
                        What would you like to explore next?
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {activeTopic.followUps.map(fu => (
                          <SuggestionPill
                            key={fu.id}
                            label={fu.label}
                            onClick={() => handleFollowUpSelect(fu)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lesson complete */}
                  {lessonState === 'complete' && (
                    <div
                      style={{ padding: '18px', borderTop: '1px solid var(--border)', textAlign: 'center' }}
                      aria-live="assertive"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginBottom: '4px' }}>
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: 'var(--g4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }} aria-hidden>
                          <Check size={12} color="#fff" />
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--ink)' }}>
                          Lesson complete
                        </span>
                      </div>
                      <p style={{ fontSize: '12.5px', color: 'var(--soft)', marginBottom: '14px' }}>
                        Explore another topic or continue learning with Studdy.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          className="gost"
                          style={{ fontSize: '13px', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          onClick={handleReset}
                          aria-label="Explore another topic"
                        >
                          <RotateCcw size={12} aria-hidden /> Explore another topic
                        </button>
                        <button
                          className="gbtn"
                          style={{ fontSize: '13px', padding: '9px 16px' }}
                          onClick={() => { track('checkout_started'); navigate('/checkout'); }}
                          aria-label="Start free trial"
                        >
                          Start Free Trial
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive grid override */}
      <style>{`
        @media (max-width: 767px) {
          .as-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 479px) {
          .as-grid .topic-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
