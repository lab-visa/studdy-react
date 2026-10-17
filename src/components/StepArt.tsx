/**
 * Original drawings for the dashboard's "How to get started" steps.
 * Plain inline SVG: no image files to load, sharp at any size, brand colours.
 * Swap any of these for illustration files later without touching the page.
 */
import type { ReactNode } from 'react';

const INK = '#2A2540';
const PINK = '#EF55B6';
const PURPLE = '#8C79E0';
const BLUE = '#25A8F4';
const SUN = '#FFC94D';
const PAPER = '#F4F1FB';
const FONT = 'Inter, system-ui, sans-serif';

const line = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Frame({ label, children, tint = PURPLE }: { label: string; children: ReactNode; tint?: string }) {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label={label} className="w-full h-auto">
      <path d="M62 38C122 -2 244 12 284 64c36 48 6 136-80 150-94 16-176-12-180-74-3-44 6-78 38-102Z" fill={tint} opacity=".13" />
      <circle cx="282" cy="40" r="20" fill={PINK} opacity=".14" />
      <circle cx="30" cy="196" r="12" fill={BLUE} opacity=".16" />
      {children}
    </svg>
  );
}

/** A friendly little person. (x, y) is the centre of the head. */
function Person({ x, y, shirt, hair = 'short', arm = 'down', s = 1 }: {
  x: number; y: number; shirt: string; hair?: 'short' | 'bun' | 'long'; arm?: 'down' | 'wave' | 'point' | 'up'; s?: number;
}) {
  const skin = '#E9B48E';
  const armPath = {
    down: 'M24 48C30 60 30 70 28 78',
    wave: 'M24 48C40 40 46 22 42 4',
    point: 'M-24 48C-40 46 -54 40 -64 30',
    up: 'M-22 46C-38 34 -44 16 -40 0',
  }[arm];
  const hand = { down: [28, 78], wave: [42, 4], point: [-64, 30], up: [-40, 0] }[arm];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {hair === 'long' && <path d="M-23 -4C-28 26-20 44-12 44h24c8 0 16-18 11-48Z" fill={INK} />}
      <path d="M-31 82C-31 48-20 34 0 34s31 14 31 48Z" fill={shirt} {...line} />
      <path d={armPath} fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
      <path d={armPath} fill="none" stroke={shirt} strokeWidth="7" strokeLinecap="round" />
      <circle cx={hand[0]} cy={hand[1]} r="6" fill={skin} {...line} strokeWidth={2.5} />
      <rect x="-6" y="16" width="12" height="20" rx="4" fill={skin} {...line} />
      <circle r="20" fill={skin} {...line} />
      <path d="M-20-1C-23-21-5-29 8-25c11 3 15 12 12 23-6-8-16-11-26-7-7 2-11 5-14 8Z" fill={INK} />
      {hair === 'bun' && <circle cx="2" cy="-27" r="8" fill={INK} />}
      <circle cx="-7" cy="2" r="2.3" fill={INK} />
      <circle cx="7" cy="2" r="2.3" fill={INK} />
      <path d="M-7 9q7 7 14 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="-13" cy="9" r="3.5" fill={PINK} opacity=".3" />
      <circle cx="13" cy="9" r="3.5" fill={PINK} opacity=".3" />
    </g>
  );
}

function Sparkle({ x, y, c = SUN, r = 7 }: { x: number; y: number; c?: string; r?: number }) {
  return <path d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`} fill={c} />;
}

/* 1 - Open studdyai.com on a laptop (not the phone) */
export function ArtOpen() {
  return (
    <Frame label="A student opening studdyai.com on a laptop, phone set aside">
      <Person x={266} y={104} shirt={BLUE} arm="wave" s={0.92} />
      <rect x="88" y="88" width="136" height="90" rx="8" fill="#fff" {...line} />
      <rect x="96" y="96" width="120" height="14" rx="7" fill={PAPER} />
      <circle cx="104" cy="103" r="2.5" fill={PINK} /><circle cx="112" cy="103" r="2.5" fill={SUN} /><circle cx="120" cy="103" r="2.5" fill={BLUE} />
      <text x="130" y="106.5" fontFamily={FONT} fontSize="9" fontWeight="700" fill={INK}>studdyai.com</text>
      <rect x="100" y="120" width="56" height="7" rx="3.5" fill={PURPLE} opacity=".5" />
      <rect x="100" y="132" width="84" height="6" rx="3" fill={PAPER} />
      <rect x="100" y="142" width="70" height="6" rx="3" fill={PAPER} />
      <rect x="100" y="156" width="44" height="12" rx="6" fill={PINK} />
      <path d="M76 178h160l-10 12H86Z" fill="#fff" {...line} />
      <path d="M186 116l12 26 4-10 10-4Z" fill={INK} />
      <line x1="16" y1="194" x2="304" y2="194" {...line} />
      <g transform="rotate(-8 40 160)">
        <rect x="26" y="134" width="28" height="50" rx="6" fill="#fff" {...line} />
        <line x1="36" y1="140" x2="44" y2="140" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M44 122C50 92 64 82 82 86" fill="none" stroke={PINK} strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />
      <path d="M76 80l8 6-8 5" fill="none" stroke={PINK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Sparkle x={152} y={62} />
      <Sparkle x={236} y={58} c={PURPLE} r={5} />
    </Frame>
  );
}

/* 2 - Sign in with Google, then "Use another account" */
export function ArtGoogle() {
  return (
    <Frame label="Clicking Sign in with Google, then Use another account" tint={BLUE}>
      <rect x="40" y="30" width="196" height="166" rx="14" fill="#fff" {...line} />
      <text x="60" y="60" fontFamily={FONT} fontSize="15" fontWeight="800" fill={INK}>Sign in</text>
      <rect x="58" y="74" width="160" height="30" rx="15" fill="#fff" {...line} strokeWidth={2.5} />
      <g transform="translate(78 89)">
        <path d="M0-8a8 8 0 0 1 7.5 5.2" fill="none" stroke="#EA4335" strokeWidth="3.4" />
        <path d="M-7.5-2.8A8 8 0 0 1 0-8" fill="none" stroke="#FBBC05" strokeWidth="3.4" />
        <path d="M-5.6 5.7A8 8 0 0 1-7.5-2.8" fill="none" stroke="#34A853" strokeWidth="3.4" />
        <path d="M7.9 1.2A8 8 0 0 1-5.6 5.7" fill="none" stroke="#4285F4" strokeWidth="3.4" />
        <path d="M1 0.8h7" stroke="#4285F4" strokeWidth="3.4" />
      </g>
      <text x="94" y="93" fontFamily={FONT} fontSize="10.5" fontWeight="700" fill={INK}>Sign in with Google</text>
      <rect x="58" y="120" width="160" height="30" rx="10" fill={PAPER} stroke={PURPLE} strokeWidth="2.5" />
      <circle cx="76" cy="135" r="8" fill="#fff" stroke={PURPLE} strokeWidth="2" />
      <path d="M72 135h8M76 131v8" stroke={PURPLE} strokeWidth="2" strokeLinecap="round" />
      <text x="92" y="139" fontFamily={FONT} fontSize="10.5" fontWeight="700" fill={INK}>Use another account</text>
      <rect x="58" y="162" width="110" height="8" rx="4" fill={PAPER} />
      <circle cx="232" cy="89" r="11" fill={PINK} /><text x="232" y="93" textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="800" fill="#fff">1</text>
      <circle cx="232" cy="135" r="11" fill={PURPLE} /><text x="232" y="139" textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="800" fill="#fff">2</text>
      <path d="M200 142l12 26 4-10 10-4Z" fill={INK} />
      <Person x={278} y={150} shirt={PINK} hair="long" arm="point" s={0.8} />
      <Sparkle x={258} y={44} c={BLUE} r={6} />
    </Frame>
  );
}

/* 3 - Type the Studdy email and password from the card above */
export function ArtLogin() {
  return (
    <Frame label="Entering the Studdy email and password" tint={PINK}>
      <rect x="64" y="34" width="180" height="168" rx="14" fill="#fff" {...line} />
      <text x="84" y="64" fontFamily={FONT} fontSize="9" fontWeight="800" fill="#8a849a" letterSpacing=".8">EMAIL</text>
      <rect x="84" y="70" width="140" height="28" rx="8" fill={PAPER} stroke={INK} strokeWidth="2" />
      <rect x="94" y="80" width="14" height="10" rx="2" fill="none" stroke={PURPLE} strokeWidth="2" />
      <path d="M94 81l7 5 7-5" fill="none" stroke={PURPLE} strokeWidth="2" strokeLinejoin="round" />
      <rect x="116" y="81" width="80" height="7" rx="3.5" fill={PURPLE} opacity=".45" />
      <text x="84" y="118" fontFamily={FONT} fontSize="9" fontWeight="800" fill="#8a849a" letterSpacing=".8">PASSWORD</text>
      <rect x="84" y="124" width="140" height="28" rx="8" fill={PAPER} stroke={INK} strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <circle key={i} cx={98 + i * 12} cy="138" r="3.4" fill={INK} />)}
      <rect x="164" y="166" width="60" height="24" rx="12" fill={PINK} />
      <text x="194" y="182" textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="800" fill="#fff">Next</text>
      <g transform="translate(268 74) rotate(10)">
        <path d="M-12-6v-8a12 12 0 0 1 24 0v8" fill="none" {...line} strokeWidth={4} />
        <rect x="-19" y="-7" width="38" height="32" rx="8" fill={PURPLE} {...line} />
        <circle cy="7" r="4" fill="#fff" />
        <rect x="-1.5" y="8" width="3" height="8" rx="1.5" fill="#fff" />
      </g>
      <g transform="translate(36 150) rotate(-35)">
        <circle r="11" fill={SUN} {...line} />
        <circle r="3.5" fill="#fff" />
        <path d="M11 0h26M29 0v8M35 0v6" fill="none" {...line} />
      </g>
      <Sparkle x={262} y={150} c={PINK} />
      <Sparkle x={48} y={60} c={BLUE} r={5} />
    </Frame>
  );
}

/* 4 - Ask any doubt: type, speak or share a photo */
export function ArtAsk() {
  return (
    <Frame label="A student asking a question, with a photo of homework">
      <Person x={84} y={110} shirt={PURPLE} hair="bun" arm="up" s={0.95} />
      <path d="M148 28h132a18 18 0 0 1 18 18v52a18 18 0 0 1-18 18h-96l-26 20 6-20h-16a18 18 0 0 1-18-18V46a18 18 0 0 1 18-18Z" fill="#fff" {...line} />
      <text x="146" y="62" fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK}>How do I solve</text>
      <text x="146" y="82" fontFamily={FONT} fontSize="13" fontWeight="800" fill={PINK}>x² − 5x + 6 = 0 ?</text>
      <rect x="146" y="94" width="70" height="6" rx="3" fill={PAPER} />
      <g transform="rotate(7 214 172)">
        <rect x="178" y="138" width="74" height="66" rx="6" fill="#fff" {...line} />
        <rect x="188" y="150" width="42" height="5" rx="2.5" fill={BLUE} opacity=".6" />
        <rect x="188" y="162" width="54" height="5" rx="2.5" fill={PAPER} />
        <rect x="188" y="173" width="48" height="5" rx="2.5" fill={PAPER} />
        <rect x="188" y="184" width="34" height="5" rx="2.5" fill={PAPER} />
      </g>
      <circle cx="262" cy="146" r="14" fill={BLUE} {...line} />
      <rect x="254" y="141" width="16" height="11" rx="2.5" fill="#fff" />
      <circle cx="262" cy="146.5" r="3" fill={BLUE} />
      <g transform="translate(150 176)">
        <circle r="15" fill={PINK} {...line} />
        <rect x="-4" y="-8" width="8" height="12" rx="4" fill="#fff" />
        <path d="M-7 1a7 7 0 0 0 14 0M0 8v4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </g>
      <line x1="16" y1="212" x2="304" y2="212" {...line} />
    </Frame>
  );
}

/* 5 - Learn it on the whiteboard, step by step */
export function ArtBoard() {
  return (
    <Frame label="A happy student learning from a step-by-step whiteboard explanation" tint={BLUE}>
      <rect x="28" y="30" width="200" height="140" rx="10" fill="#fff" {...line} />
      <line x1="40" y1="182" x2="216" y2="182" {...line} />
      <line x1="64" y1="170" x2="56" y2="182" {...line} />
      <line x1="192" y1="170" x2="200" y2="182" {...line} />
      <line x1="48" y1="140" x2="140" y2="140" stroke="#bdb6cf" strokeWidth="2" />
      <line x1="60" y1="60" x2="60" y2="152" stroke="#bdb6cf" strokeWidth="2" />
      <path d="M66 62C82 150 118 150 134 62" fill="none" stroke={BLUE} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="80" cy="140" r="4.5" fill={PINK} />
      <circle cx="120" cy="140" r="4.5" fill={PINK} />
      <text x="152" y="62" fontFamily={FONT} fontSize="10" fontWeight="700" fill={INK}>(x − 2)(x − 3)</text>
      <text x="152" y="84" fontFamily={FONT} fontSize="10" fontWeight="700" fill={INK}>x − 2 = 0</text>
      <text x="152" y="104" fontFamily={FONT} fontSize="10" fontWeight="700" fill={INK}>x − 3 = 0</text>
      <text x="152" y="132" fontFamily={FONT} fontSize="13" fontWeight="800" fill={PINK}>x = 2, 3</text>
      <path d="M156 146l7 7 14-15" fill="none" stroke="#22C55E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Person x={268} y={118} shirt={BLUE} arm="point" s={0.9} />
      <g transform="translate(268 58)">
        <circle r="13" fill={SUN} {...line} />
        <rect x="-6" y="11" width="12" height="7" rx="2" fill="#fff" {...line} strokeWidth={2.5} />
        <path d="M0-24v-6M-19-17l-4-4M19-17l4-4M-25 0h-6M25 0h6" stroke={SUN} strokeWidth="3" strokeLinecap="round" />
      </g>
      <Sparkle x={232} y={24} c={PINK} r={6} />
      <Sparkle x={300} y={96} c={PURPLE} r={5} />
    </Frame>
  );
}
