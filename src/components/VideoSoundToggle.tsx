/**
 * VideoSoundToggle.tsx
 *
 * Reusable mute/unmute pill for any autoplay video.
 *
 * Props:
 *   videoRef              — ref to the <video> element to control
 *   isMuted               — current muted state (controlled externally)
 *   onToggle              — called when user clicks; parent updates isMuted
 *   top / right / bottom / left — position inside the video container (default top:18px right:18px)
 *   className             — optional extra class
 *   storageKey            — localStorage key for persistence (default 'studdy_muted')
 *
 * Behaviour:
 *   - Before first interaction: pill is always expanded, showing "Click to unmute"
 *   - After first click: collapses to icon-only after 2s; hover re-expands
 *   - Uses Lucide icons (Volume2 / VolumeX) — no emojis
 *   - Smooth 250ms width + opacity transition
 *   - Accessible: aria-label, keyboard-focusable, visible focus ring
 *   - Respects prefers-reduced-motion
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface Props {
  isMuted: boolean;
  onToggle: () => void;
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
  className?: string;
}

export default function VideoSoundToggle({
  isMuted,
  onToggle,
  top = '18px',
  right = '18px',
  bottom,
  left,
  className = '',
}: Props) {
  /*
   * hasInteracted: false until the user clicks for the first time.
   *   false → pill always shows full label (persistent)
   *   true  → pill can collapse; timers are active
   */
  const [hasInteracted, setHasInteracted] = useState(false);
  const [expanded, setExpanded]           = useState(true);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Clear any running timer */
  const clearCollapse = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  /* Schedule collapse — only fires after first interaction */
  const scheduleCollapse = useCallback(() => {
    clearCollapse();
    collapseTimer.current = setTimeout(() => setExpanded(false), 2000);
  }, [clearCollapse]);

  /* Cleanup on unmount */
  useEffect(() => () => clearCollapse(), [clearCollapse]);

  /* Expand on hover — only after first interaction */
  const handleMouseEnter = useCallback(() => {
    if (!hasInteracted) return;
    clearCollapse();
    setExpanded(true);
  }, [hasInteracted, clearCollapse]);

  /* Start collapse on mouse-leave — only after first interaction */
  const handleMouseLeave = useCallback(() => {
    if (!hasInteracted) return;
    scheduleCollapse();
  }, [hasInteracted, scheduleCollapse]);

  /* Click: toggle mute, mark interacted, expand briefly then collapse */
  const handleClick = useCallback(() => {
    onToggle();
    if (!hasInteracted) setHasInteracted(true);
    clearCollapse();
    setExpanded(true);
    scheduleCollapse();
  }, [onToggle, hasInteracted, clearCollapse, scheduleCollapse]);

  /*
   * Always expanded when not yet interacted.
   * After interaction, follows hasInteracted/expanded state.
   */
  const isExpanded = !hasInteracted ? true : expanded;

  const label = isMuted ? 'Click to unmute' : 'Click to mute';
  const ariaLabel = isMuted ? 'Unmute video' : 'Mute video';

  const transitionStyle = prefersReduced
    ? {}
    : {
        transition:
          'max-width 250ms ease, opacity 200ms ease, margin-left 250ms ease, padding 250ms ease',
      };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={ariaLabel}
      aria-pressed={!isMuted}
      className={className}
      style={{
        position: 'absolute',
        top,
        right,
        bottom,
        left,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,.2)',
        borderRadius: '999px',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer',
        padding: isExpanded ? '7px 14px 7px 10px' : '7px 10px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        lineHeight: 1,
        outline: 'none',
        /* Focus ring — keyboard accessible */
        boxShadow: undefined,
        ...transitionStyle,
      }}
      /* Visible focus ring via pseudo-class in global CSS fallback */
      onFocus={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px rgba(37,168,244,.7)'; }}
      onBlur={e  => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
    >
      {/* Lucide icon — no emoji */}
      <span style={{ flexShrink: 0, lineHeight: 0, display: 'flex', alignItems: 'center' }}>
        {isMuted
          ? <VolumeX size={14} aria-hidden="true" />
          : <Volume2 size={14} aria-hidden="true" />
        }
      </span>

      {/* Label — expands/collapses */}
      <span
        aria-hidden="true"   /* screen readers use aria-label on the button */
        style={{
          maxWidth:    isExpanded ? '120px' : '0px',
          opacity:     isExpanded ? 1 : 0,
          marginLeft:  isExpanded ? '6px' : '0px',
          overflow: 'hidden',
          display: 'inline-block',
          fontSize: '12px',
          fontWeight: 700,
          ...(prefersReduced ? {} : {
            transition: 'max-width 250ms ease, opacity 200ms ease, margin-left 250ms ease',
          }),
        }}
      >
        {label}
      </span>
    </button>
  );
}
