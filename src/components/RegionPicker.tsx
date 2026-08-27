/**
 * RegionPicker.tsx — a single compact dropdown for choosing a
 * country/region, used on both the homepage Pricing section and the
 * Checkout page so they behave identically.
 *
 * Replaces the old "row of pills + a giant list of every country dumped
 * onto the page when you click More" pattern, which looked cluttered
 * and pushed everything below it far down the page.
 */
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { REGION_DATA, REGION_GROUPS, type Region } from '../data/config';

interface Props {
  region: Region;
  onChange: (r: Region) => void;
  detectedRegion?: Region | null;
}

export default function RegionPicker({ region, onChange, detectedRegion }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rd = REGION_DATA[region];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '11px 18px', borderRadius: '14px',
          background: '#fff', border: '1.5px solid var(--border)',
          fontWeight: 700, fontSize: '13.5px', color: 'var(--ink)',
          cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,.05)',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: '17px', lineHeight: 1 }}>{rd.flag}</span>
        <span>{rd.label}</span>
        <ChevronDown size={15} aria-hidden
          style={{ color: 'var(--soft)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose your country"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
            width: 'min(310px, 90vw)', maxHeight: '380px', overflowY: 'auto',
            background: '#fff', border: '1.5px solid var(--border)', borderRadius: '18px',
            boxShadow: '0 24px 60px rgba(0,0,0,.16)', padding: '10px', zIndex: 50,
          }}
        >
          {REGION_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: '4px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '.07em', color: 'var(--soft)', padding: '9px 10px 4px',
              }}>
                {group.label}
              </div>
              {group.regions.map(r => {
                const rc = REGION_DATA[r];
                const selected = r === region;
                const isDetected = r === detectedRegion && r !== region;
                return (
                  <button
                    key={r}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => { onChange(r); setOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '9px 10px', borderRadius: '10px', border: 'none',
                      background: selected ? 'var(--dim)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--dim)'; }}
                    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: '15px', lineHeight: 1 }}>{rc.flag}</span>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{rc.label}</span>
                    {isDetected && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--g2)' }}>Detected</span>
                    )}
                    {selected && <Check size={14} aria-hidden style={{ color: 'var(--g4)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
