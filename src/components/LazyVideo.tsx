import { useEffect, useRef, useState } from 'react';

interface Props {
  src?: string;
  webm?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  label?: string;
  meta?: string;
  aspectRatio?: string;
}

export default function LazyVideo({ src, webm, poster, autoplay, loop, muted = true, className = '', label, meta, aspectRatio = '16/9' }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loaded) {
          setLoaded(true);
        } else if (!entry.isIntersecting && ref.current) {
          ref.current.pause();
        }
      },
      { threshold: 0.2 }
    );

    if (ref.current) observer.observe(ref.current.parentElement!);
    return () => observer.disconnect();
  }, [loaded]);

  // Placeholder when no src provided
  if (!src && !webm) {
    return (
      <div
        className={`vid-slot rounded-2xl ${className}`}
        style={{ aspectRatio }}
      >
        <div className="flex flex-col items-center gap-3 p-6">
          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-lg font-black" style={{ color: 'var(--g1)' }}>▶</div>
          {label && <p className="font-bold text-[15px]">{label}</p>}
          {meta && <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,.4)' }}>{meta}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ aspectRatio }}>
      <video
        ref={ref}
        autoPlay={autoplay && loaded}
        loop={loop}
        muted={muted}
        playsInline
        poster={poster}
        className="w-full h-full object-cover"
      >
        {loaded && webm && <source src={webm} type="video/webm" />}
        {loaded && src && <source src={src} type="video/mp4" />}
      </video>
    </div>
  );
}
