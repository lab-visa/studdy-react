import { useEffect, useRef } from 'react';

export interface VideoSpec {
  duration: string;
  ratio: string;
  playback: string;
  note?: string;
}

interface Props {
  // Real video props (when file exists)
  src?: string;
  webm?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  // Placeholder props
  label?: string;
  meta?: string;
  spec?: VideoSpec;
  className?: string;
  aspectRatio?: string;
}

// Standard specs for each section's video
export const VIDEO_SPECS = {
  heroMontage: {
    duration: '12–15 sec',
    ratio: '16:9',
    playback: 'Muted autoplay, loops',
    note: 'Place at: public/videos/hero-placeholder.mp4',
  },
  productProof: {
    duration: '25–35 sec',
    ratio: '16:9',
    playback: 'Click to play with sound',
    note: 'Real uninterrupted product session',
  },
  askStuddyResponse: {
    duration: '20–30 sec',
    ratio: '16:9',
    playback: 'Plays after question selected',
    note: 'One response per demo question',
  },
  subjectPreview: {
    duration: '20–30 sec',
    ratio: '4:3',
    playback: 'Click to play',
    note: 'One per subject category',
  },
  outcomeLoop: {
    duration: '4–6 sec',
    ratio: '1:1',
    playback: 'Muted loop, silent',
    note: 'Short looping reaction clip',
  },
  storyScene: {
    duration: '4–6 sec',
    ratio: '16:9 desktop / 9:16 mobile',
    playback: 'GSAP scroll-controlled',
    note: 'Will replace canvas gradient per scene',
  },
  testimonial: {
    duration: '30–90 sec',
    ratio: '9:16 or 16:9',
    playback: 'Click to play with sound',
    note: 'Real parent / student testimony',
  },
} satisfies Record<string, VideoSpec>;

export default function LazyVideo({
  src, webm, poster, autoplay, loop, muted = true,
  label, meta, spec,
  className = '',
  aspectRatio = '16/9',
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !autoplay) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.2 }
    );
    obs.observe(video);
    return () => obs.disconnect();
  }, [autoplay]);

  // Placeholder when no src provided
  if (!src && !webm) {
    return (
      <div
        className={`vid-slot rounded-2xl overflow-hidden ${className}`}
        style={{ aspectRatio, minHeight: '120px' }}
        role="img"
        aria-label={label ?? 'Video placeholder'}
      >
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-black flex-shrink-0"
            style={{ background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)' }}
            aria-hidden="true"
          >
            ▶
          </div>
          {label && <p className="font-bold text-[14px] text-white opacity-90">{label}</p>}
          {spec && (
            <div className="text-[11px] font-mono text-white/40 leading-relaxed">
              <div>{spec.duration} · {spec.ratio}</div>
              <div>{spec.playback}</div>
              {spec.note && <div className="mt-1 text-white/25">{spec.note}</div>}
            </div>
          )}
          {!spec && meta && (
            <p className="text-[11px] font-mono text-white/40 max-w-[240px] leading-relaxed">{meta}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ aspectRatio }}>
      <video
        ref={ref}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline
        poster={poster}
        preload="metadata"
        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
        aria-label={label}
      >
        {webm && <source src={webm} type="video/webm" />}
        {src && <source src={src} type="video/mp4" />}
      </video>
    </div>
  );
}
