/**
 * Dashboard.tsx - Customer Dashboard
 *
 * Flow (no login, ever - this is the whole point of the design):
 * 1. Customer arrives from Stripe (or from their saved link) with
 *    ?session_id=xxx in the URL.
 * 2. We call /api/get-session to fetch their details.
 * 3. Show their Studdy credentials + subscription info.
 * There is no account, no password to remember, no "log out" - the link
 * itself IS their access. If someone lands here with no session_id, we
 * point them to WhatsApp to get their link resent, not a fake login form.
 */
import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, Clock, Laptop, FileText, Globe, Mail, KeyRound, Sparkles, Eye, EyeOff, Bookmark, MessageCircle, ShieldCheck } from 'lucide-react';
import { SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../data/config';
import Confetti from '../components/Confetti';
import { ArtOpen, ArtGoogle, ArtLogin, ArtAsk, ArtBoard } from '../components/StepArt';
import { track } from '../utils/analytics';

const TRY_FIRST = [
  { who: 'School', ask: '“Explain photosynthesis like I’m in Class 7, with an example.”' },
  { who: 'Entrance exams', ask: '“Solve this JEE integration step by step and tell me where students go wrong.”' },
  { who: 'College', ask: '“Help me revise depreciation methods for my B.Com exam.”' },
  { who: 'Work & skills', ask: '“Teach me Excel pivot tables using a sales report example.”' },
];

interface UserData {
  name: string;
  email: string;
  plan: string;
  status: string;
  amount: string;
  currency: string;
  nextBilling: string;
  trialEnds: string;
  daysLeftInTrial: number | null;
  studdyEmail: string;
  studdyPassword: string;
  studdyUrl: string;
  totalMonthsPaid: number;
  latestInvoiceUrl: string | null;
  cancelRequestedAt: string | null;
  /* true when payment is confirmed but the Studdy login hasn't been
   * assigned yet (webhook still running, or no free seat). */
  accessPending?: boolean;
  /* India (Cashfree) orders only */
  market?: 'in';
  paymentStatus?: 'paid' | 'pending' | 'failed';
  paidOn?: string;
  accessUntil?: string;
}

/* How long to keep re-checking for a login that's still being set up. */
const PENDING_RETRY_MS = 5000;
const PENDING_MAX_RETRIES = 12; // ~1 minute

const HERO_GRADIENT = 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)';

/* Copy to clipboard helper */
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all"
      style={{ background: copied ? 'rgba(34,197,94,.1)' : 'var(--dim)', color: copied ? '#16a34a' : 'var(--soft)' }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/* Small colored pill for subscription status, instead of plain text */
function StatusPill({ status, isTrialing }: { status: string; isTrialing: boolean }) {
  const map: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
    Trialing:  { bg: 'rgba(245,158,11,.12)', fg: '#92400e', dot: '#d97706', label: 'Free Trial' },
    Active:    { bg: 'rgba(34,197,94,.12)',  fg: '#166534', dot: '#16a34a', label: 'Active' },
    Failed:    { bg: 'rgba(239,68,68,.12)',  fg: '#991b1b', dot: '#dc2626', label: 'Payment Failed' },
    Paused:    { bg: 'rgba(107,114,128,.12)',fg: '#374151', dot: '#6b7280', label: 'Paused' },
    Cancelled: { bg: 'rgba(107,114,128,.12)',fg: '#374151', dot: '#6b7280', label: 'Cancelled' },
    Disputed:  { bg: 'rgba(239,68,68,.12)',  fg: '#991b1b', dot: '#dc2626', label: 'Disputed' },
    Refunded:  { bg: 'rgba(107,114,128,.12)',fg: '#374151', dot: '#6b7280', label: 'Refunded' },
  };
  const s = map[status] ?? { bg: 'var(--dim)', fg: 'var(--soft)', dot: 'var(--soft)', label: status || '-' };
  const label = isTrialing ? map.Trialing.label : s.label;
  const style = isTrialing ? map.Trialing : s;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
      style={{ background: style.bg, color: style.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
      {label}
    </span>
  );
}

export default function Dashboard() {
  const [step, setStep] = useState<'loading' | 'dashboard' | 'no-link' | 'cancel' | 'confirming' | 'payment-failed'>('loading');
  /* India orders use ?order_id= (Cashfree); everyone else ?session_id= (Stripe). */
  const [orderId, setOrderId] = useState('');
  const [confirmTries, setConfirmTries] = useState(0);
  const [user, setUser] = useState<UserData | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelText, setCancelText] = useState('');
  const [cancelSent, setCancelSent] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [pendingRetries, setPendingRetries] = useState(0);
  /* Confetti only the first time this browser opens this customer's page. */
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (step !== 'dashboard') return;
    const key = `sl_dash_seen_${orderId || sessionId}`;
    try {
      if (!localStorage.getItem(key)) { setCelebrate(true); localStorage.setItem(key, '1'); }
    } catch { /* storage blocked - skip the confetti */ }
    track('dashboard_opened', { market: user?.market === 'in' ? 'in' : 'intl' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* Steps fade in as they scroll into view. */
  useEffect(() => {
    if (step !== 'dashboard') return;
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, [step, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    const oid = params.get('order_id');

    if (oid) {
      setOrderId(oid);
      fetchIndiaOrder(oid);
    } else if (sid) {
      setSessionId(sid);
      fetchSession(sid);
    } else {
      setStep('no-link');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchIndiaOrder = async (oid: string) => {
    try {
      const res = await fetch(`/api/india-session?order_id=${encodeURIComponent(oid)}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setStep('no-link'); return; }
      setUser(data);
      if (data.paymentStatus === 'failed') { setStep('payment-failed'); return; }
      if (data.paymentStatus === 'pending') { setStep('confirming'); setConfirmTries(n => n + 1); return; }
      setStep('dashboard');
      if (data.accessPending) setPendingRetries(n => n + 1);
    } catch {
      setError('Could not load your dashboard.');
      setStep('no-link');
    }
  };

  /* Payment just made, Cashfree confirmation still on its way - re-check
   * every 4s for about a minute. */
  useEffect(() => {
    if (step !== 'confirming' || !orderId || confirmTries > 15) return;
    const t = setTimeout(() => fetchIndiaOrder(orderId), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, confirmTries, orderId]);

  const fetchSession = async (sid: string) => {
    try {
      const res = await fetch(`/api/get-session?session_id=${sid}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setStep('no-link'); return; }
      setUser(data);
      setStep('dashboard');
      if (data.accessPending) setPendingRetries(n => n + 1);
    } catch {
      setError('Could not load your dashboard.');
      setStep('no-link');
    }
  };

  /* Login still being set up - quietly re-check every few seconds for
   * about a minute, so the customer doesn't have to keep refreshing. */
  useEffect(() => {
    if (!user?.accessPending || (!sessionId && !orderId)) return;
    if (pendingRetries > PENDING_MAX_RETRIES) return;
    const t = setTimeout(() => (orderId ? fetchIndiaOrder(orderId) : fetchSession(sessionId)), PENDING_RETRY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.accessPending, pendingRetries, sessionId, orderId]);

  const handleCancelRequest = async () => {
    setCancelSubmitting(true);
    try {
      const res = await fetch('/api/cancel-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          reason: cancelReason,
          message: cancelText,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setCancelSent(true);
    } catch {
      setError('Could not submit request. Please WhatsApp us directly.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: HERO_GRADIENT }}>
        <div className="text-center">
          <div className="font-black text-[22px] mb-2"><span className="grad-text">studdy</span></div>
          <div className="text-[14px]" style={{ color: 'var(--soft)' }}>Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  /* ── India: payment being confirmed / failed ── */
  if (step === 'confirming' || step === 'payment-failed') {
    const failed = step === 'payment-failed';
    const gaveUp = !failed && confirmTries > 15;
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: HERO_GRADIENT }}>
        <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 text-center"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.08)' }}>
          <div className="font-black text-[22px] mb-4"><span className="grad-text">studdy</span></div>
          <div className="text-[16px] font-black mb-2" style={{ color: 'var(--ink)' }}>
            {failed ? "Your payment didn't go through" : gaveUp ? 'Still confirming your payment' : 'Confirming your payment…'}
          </div>
          <div className="text-[13px] mb-6" style={{ color: 'var(--soft)' }}>
            {failed
              ? 'No money was taken for this attempt. You can try again - UPI, card or netbanking.'
              : gaveUp
                ? "If money left your account, don't worry - message us with this page's link and we'll sort it out right away."
                : 'This usually takes a few seconds. Please keep this page open.'}
          </div>
          {failed && (
            <a href="/checkout" className="gbtn w-full text-[14px] py-3 flex items-center justify-center mb-3">Try again</a>
          )}
          {(failed || gaveUp) && (
            <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer"
              className="gost w-full text-[14px] py-3 flex items-center justify-center gap-2">
              💬 WhatsApp Support
            </a>
          )}
        </div>
      </div>
    );
  }

  /* ── No link found - no login form, just point to WhatsApp ── */
  if (step === 'no-link') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: HERO_GRADIENT }}>
        <div className="w-full max-w-[420px]">
          <div className="bg-white rounded-3xl p-8 text-center" style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.08)' }}>
            <div className="font-black text-[22px] mb-4"><span className="grad-text">studdy</span></div>
            {error && (
              <div className="rounded-xl p-3 mb-4 text-[13px] text-left"
                style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,.2)' }}>
                {error}
              </div>
            )}
            <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              We couldn't find your dashboard link
            </div>
            <div className="text-[13px] mb-6" style={{ color: 'var(--soft)' }}>
              Every Studdy Lab customer gets a personal link - the same one you got
              right after signing up. Message us on WhatsApp and we'll resend it to you.
            </div>
            <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer"
              className="gbtn w-full text-[14px] py-3 flex items-center justify-center gap-2 mb-3">
              💬 WhatsApp Support
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`}
              className="gost w-full text-[14px] py-3 flex items-center justify-center gap-2">
              <Mail size={15} /> {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ── Cancellation request ── */
  if (step === 'cancel') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--dim)' }}>
        <div className="w-full max-w-[480px]">
          <button onClick={() => setStep('dashboard')}
            className="text-[13px] font-semibold mb-4 flex items-center gap-1"
            style={{ color: 'var(--soft)' }}>
            ← Back to dashboard
          </button>
          <div className="bg-white rounded-3xl p-8" style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.08)' }}>
            {!cancelSent ? (
              <>
                <div className="font-black text-[18px] mb-1" style={{ color: 'var(--ink)' }}>
                  Request cancellation
                </div>
                <div className="text-[13px] mb-6" style={{ color: 'var(--soft)' }}>
                  We will contact you on WhatsApp within 24 hours to help resolve any
                  issues before cancelling your subscription.
                </div>

                <label className="block text-[11.5px] font-black uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--soft)' }}>
                  Reason for cancellation
                </label>
                <select value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[14px] mb-4"
                  style={{ border: '1.5px solid var(--border)', outline: 'none' }}>
                  <option value="">Select a reason...</option>
                  <option value="too_expensive">Too expensive</option>
                  <option value="not_using">Not using it enough</option>
                  <option value="not_useful">Not useful for me</option>
                  <option value="technical_issues">Technical issues</option>
                  <option value="found_alternative">Found an alternative</option>
                  <option value="other">Other</option>
                </select>

                <label className="block text-[11.5px] font-black uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--soft)' }}>
                  Tell us more (optional)
                </label>
                <textarea value={cancelText} onChange={e => setCancelText(e.target.value)}
                  placeholder="Any feedback helps us improve..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-[14px] mb-6 resize-none"
                  style={{ border: '1.5px solid var(--border)', outline: 'none' }}
                />

                <button className="w-full py-3 rounded-xl text-[14px] font-bold mb-3"
                  style={{ background: 'var(--dim)', color: 'var(--ink)', border: '1.5px solid var(--border)' }}
                  onClick={handleCancelRequest} disabled={!cancelReason || cancelSubmitting}>
                  {cancelSubmitting ? 'Submitting...' : 'Submit cancellation request'}
                </button>
                <p className="text-center text-[12px]" style={{ color: 'var(--soft)' }}>
                  Your subscription remains active until we process this request.
                </p>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-[40px] mb-4">✅</div>
                <div className="font-black text-[18px] mb-2">Request received</div>
                <div className="text-[13px]" style={{ color: 'var(--soft)' }}>
                  We will contact you on WhatsApp within 24 hours.
                  Your access continues until we process this.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Dashboard ── */
  const isTrialing = user?.status === 'Trialing';
  const isIndiaOrder = user?.market === 'in';
  const alreadyRequestedCancel = Boolean(user?.cancelRequestedAt);
  const amountLabel = isTrialing ? "You'll be charged" : 'Amount';
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : '';
  const studdyUrl = user?.studdyUrl || 'https://studdyai.com/sign-in';
  const studdyHost = studdyUrl.replace(/^https?:\/\//, '').split('/')[0];
  const pageLink = typeof window !== 'undefined' ? window.location.href : '';
  const sendText = `My Studdy Lab page (open on a laptop or iPad): ${pageLink}`;
  const mailSelf = `mailto:${user?.email ?? ''}?subject=${encodeURIComponent('My Studdy Lab login page')}&body=${encodeURIComponent(`Open this on your laptop or iPad:\n\n${pageLink}\n\nKeep this link private, it shows your Studdy login.`)}`;
  const card = 'bg-white rounded-3xl';
  const cardStyle = { border: '1.5px solid var(--border)', boxShadow: '0 6px 24px rgba(36,22,80,.06)' };

  const STEPS: { title: string; body: string; art: ReactNode; action?: ReactNode }[] = [
    {
      title: 'Open Studdy on a laptop or iPad',
      body: `Go to ${studdyHost} on a laptop, desktop or iPad. Studdy teaches on a big interactive whiteboard, so it doesn't work on phones.`,
      art: <ArtOpen />,
      action: (
        <a href={studdyUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('dashboard_open_studdy', { from: 'step1' })}
          className="gbtn inline-flex items-center gap-2 text-[14px] px-5 py-2.5"><ExternalLink size={15} /> Open Studdy</a>
      ),
    },
    {
      title: 'Click "Sign in with Google"',
      body: 'Then choose "Use another account". Don\'t pick your own Google account, your Studdy login is a separate one.',
      art: <ArtGoogle />,
    },
    {
      title: 'Enter your Studdy email and password',
      body: 'Copy both from "Your Studdy login" at the top of this page and paste them in. Your browser usually keeps you signed in after the first time.',
      art: <ArtLogin />,
      action: (
        <a href="#login" className="gost inline-flex items-center gap-2 text-[14px] px-5 py-2.5"><KeyRound size={15} /> Show my login</a>
      ),
    },
    {
      title: 'Ask any doubt',
      body: 'Type it, say it, or share a photo of the question. Any subject, any level: school, entrance exams, college, or a new skill for work.',
      art: <ArtAsk />,
    },
    {
      title: 'Learn it on the whiteboard',
      body: 'Studdy explains step by step on the whiteboard, like a personal tutor. Still not clear? Say "explain it simpler" or "give me another example".',
      art: <ArtBoard />,
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--dim)' }}>
      {celebrate && <Confetti />}

      {/* Top bar */}
      <header className="bg-white/90 backdrop-blur h-16 flex items-center justify-between gap-4 px-4 sm:px-6 sticky top-0 z-40"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-black text-[20px]"><span className="grad-text">studdy</span></div>
        <div className="flex items-center gap-3 min-w-0">
          <span className="hidden sm:block text-[13px] font-semibold truncate" style={{ color: 'var(--soft)' }}>{user?.email}</span>
          {!user?.accessPending && (
            <span className="hidden md:block">
              <a href={studdyUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('dashboard_open_studdy', { from: 'header' })}
                className="gbtn inline-flex items-center gap-1.5 text-[13px] px-4 py-2"><ExternalLink size={13} /> Open Studdy</a>
            </span>
          )}
        </div>
      </header>

      {/* Welcome */}
      <section className="relative overflow-hidden px-4 pt-10 pb-24 sm:pt-14" style={{ background: HERO_GRADIENT }}>
        <div aria-hidden="true" className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-40 blur-3xl" style={{ background: 'var(--g1)' }} />
        <div aria-hidden="true" className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--g4)' }} />
        <div className="relative max-w-[1040px] mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/80 rounded-full px-3 py-1 mb-4 dash-pop" style={{ border: '1px solid var(--border)' }}>
            <Sparkles size={14} style={{ color: 'var(--g2)' }} />
            <span className="text-[12px] font-black uppercase tracking-wide" style={{ color: 'var(--g2)' }}>You're in</span>
          </div>
          <h1 className="font-black text-[32px] sm:text-[44px] leading-[1.08] mb-3" style={{ color: 'var(--ink)' }}>
            Welcome{firstName ? `, ${firstName}` : ''}! <span className="inline-block dash-wave">🎉</span>
          </h1>
          <p className="text-[15px] sm:text-[17px] max-w-[620px] mb-5" style={{ color: 'var(--soft)' }}>
            Your personal AI tutor is ready. Any subject, any doubt, any time.
            Follow the 5 quick steps below and ask your first question in about 2 minutes.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={user?.status ?? ''} isTrialing={isTrialing} />
            {user?.plan && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-white" style={{ color: 'var(--ink)', border: '1px solid var(--border)' }}>
                {user.plan}
              </span>
            )}
            {isTrialing && user?.daysLeftInTrial != null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-white"
                style={{ color: 'var(--ink)', border: '1px solid var(--border)' }}>
                <Clock size={12} style={{ color: 'var(--g4)' }} />
                {user.daysLeftInTrial === 0 ? 'Trial ends today' : `${user.daysLeftInTrial} day${user.daysLeftInTrial === 1 ? '' : 's'} left in your free trial`}
              </span>
            )}
            {isIndiaOrder && user?.accessUntil && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-white"
                style={{ color: 'var(--ink)', border: '1px solid var(--border)' }}>
                <Clock size={12} style={{ color: 'var(--g4)' }} /> Access until {user.accessUntil}
              </span>
            )}
          </div>
        </div>
      </section>

      <main className="max-w-[1040px] mx-auto px-4 -mt-16 pb-12 relative">

        {/* Phones: Studdy needs a bigger screen - send this page across */}
        <div className="md:hidden rounded-3xl p-5 mb-5 text-white" style={{ background: 'linear-gradient(135deg,#2A2540,#4B3F86)', boxShadow: '0 10px 30px rgba(42,37,64,.25)' }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--grad)' }}>
              <Laptop size={20} color="#fff" />
            </div>
            <div>
              <div className="font-black text-[16px] leading-tight mb-1">Open this on your laptop or iPad</div>
              <div className="text-[13px] opacity-80">Studdy doesn't work on phones. Send this page to yourself and open it there.</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(sendText)}`} target="_blank" rel="noopener noreferrer"
              onClick={() => track('dashboard_send_to_laptop', { via: 'whatsapp' })}
              className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold bg-white" style={{ color: 'var(--ink)' }}>
              <MessageCircle size={15} /> WhatsApp it
            </a>
            <a href={mailSelf} onClick={() => track('dashboard_send_to_laptop', { via: 'email' })}
              className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold" style={{ background: 'rgba(255,255,255,.14)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}>
              <Mail size={15} /> Email it to me
            </a>
          </div>
        </div>

        {alreadyRequestedCancel && (
          <div className="rounded-2xl p-4 mb-5 bg-white" style={{ border: '1px solid rgba(107,114,128,.25)' }}>
            <div className="font-black text-[13px]" style={{ color: 'var(--ink)' }}>Cancellation requested</div>
            <div className="text-[12px]" style={{ color: 'var(--soft)' }}>We'll message you on WhatsApp within 24 hours. Your access stays on until then.</div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.45fr_1fr] gap-5 items-start">
          {/* Login card */}
          <div id="login" className={`${card} p-6 sm:p-7 overflow-hidden relative scroll-mt-24`} style={cardStyle}>
            <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'var(--grad)' }} />
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--grad)' }}>
                <KeyRound size={18} color="#fff" />
              </div>
              <div>
                <div className="font-black text-[17px]" style={{ color: 'var(--ink)' }}>Your Studdy login</div>
                <div className="text-[12.5px]" style={{ color: 'var(--soft)' }}>Use these on {studdyHost} with "Sign in with Google"</div>
              </div>
            </div>

            {user?.accessPending ? (
              <div className="rounded-2xl p-4 text-[13px]"
                style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', color: '#92400e' }}>
                <div className="font-black mb-1 flex items-center gap-2"><span className="dash-spin inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent" /> Your login is being set up</div>
                {pendingRetries <= PENDING_MAX_RETRIES ? (
                  <div>This usually takes less than a minute. This page will update by itself.</div>
                ) : (
                  <div>
                    It's taking longer than usual. Please message us on{' '}
                    <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="underline font-bold">WhatsApp</a>
                    {' '}or email {SUPPORT_EMAIL} and we'll send your login right away.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  <CredRow icon={<Globe size={15} />} label="Website" value={studdyHost} copy={studdyUrl} />
                  <CredRow icon={<Mail size={15} />} label="Email (Google account)" value={user?.studdyEmail ?? '-'} copy={user?.studdyEmail ?? ''} />
                  <CredRow icon={<KeyRound size={15} />} label="Password" mono
                    value={showPwd ? (user?.studdyPassword ?? '-') : '••••••••••'} copy={user?.studdyPassword ?? ''}
                    extra={
                      <button onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? 'Hide password' : 'Show password'}
                        className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg"
                        style={{ background: '#fff', color: 'var(--soft)', border: '1px solid var(--border)' }}>
                        {showPwd ? <EyeOff size={12} /> : <Eye size={12} />} {showPwd ? 'Hide' : 'Show'}
                      </button>
                    } />
                </div>
                <a href={studdyUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('dashboard_open_studdy', { from: 'login_card' })}
                  className="gbtn w-full text-[15px] py-3.5 flex items-center justify-center gap-2">
                  Open Studdy <ExternalLink size={15} />
                </a>
                <p className="text-[12px] text-center mt-3" style={{ color: 'var(--soft)' }}>
                  Works on laptop, desktop and iPad.
                </p>
              </>
            )}
          </div>

          {/* Plan + save */}
          <div className="space-y-5">
            <div className={`${card} p-6`} style={cardStyle}>
              <div className="font-black text-[15px] mb-3" style={{ color: 'var(--ink)' }}>Your plan</div>
              <div>
                {(isIndiaOrder ? [
                  { label: 'Plan', value: user?.plan ?? '-' },
                  { label: 'Amount paid', value: user?.amount ?? '-' },
                  { label: 'Paid on', value: user?.paidOn ?? '-' },
                  { label: 'Access until', value: user?.accessUntil ?? '-' },
                ] : [
                  { label: 'Plan', value: user?.plan ?? '-' },
                  { label: 'Status', value: <StatusPill status={user?.status ?? ''} isTrialing={isTrialing} /> },
                  { label: amountLabel, value: user?.amount ?? '-' },
                  { label: isTrialing ? 'First payment' : 'Next billing', value: user?.trialEnds && isTrialing ? user.trialEnds : (user?.nextBilling ?? '-') },
                  ...(user && user.totalMonthsPaid > 0 ? [{ label: 'Payments made', value: String(user.totalMonthsPaid) }] : []),
                ]).map((row, i, arr) => (
                  <div key={i} className="flex justify-between items-center gap-3 py-2.5"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div className="text-[13px]" style={{ color: 'var(--soft)' }}>{row.label}</div>
                    <div className="text-[13px] font-bold text-right" style={{ color: 'var(--ink)' }}>{row.value}</div>
                  </div>
                ))}
              </div>
              {isIndiaOrder && (
                <p className="text-[12px] mt-3 rounded-xl p-3" style={{ background: 'var(--dim)', color: 'var(--soft)' }}>
                  No auto-debit, nothing is charged again. Not happy? Ask for a full refund within 7 days of paying.
                </p>
              )}
              {user?.latestInvoiceUrl && (
                <a href={user.latestInvoiceUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-bold"
                  style={{ background: 'var(--dim)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
                  <FileText size={14} /> View latest invoice
                </a>
              )}
            </div>

            <div className={`${card} p-6`} style={cardStyle}>
              <div className="flex items-center gap-2 font-black text-[15px] mb-1" style={{ color: 'var(--ink)' }}>
                <Bookmark size={16} style={{ color: 'var(--g3)' }} /> Save this page
              </div>
              <p className="text-[12.5px] mb-4" style={{ color: 'var(--soft)' }}>
                Your login always lives here.<span className="hidden md:inline"> Press <b>Ctrl + D</b> (or <b>⌘ + D</b> on Mac) to bookmark it.</span> Keep the link private.
              </p>
              <div className="flex gap-2">
                <CopyButton text={pageLink} label="Copy link" />
                <a href={mailSelf} onClick={() => track('dashboard_send_to_laptop', { via: 'email_save' })}
                  className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--dim)', color: 'var(--soft)' }}>
                  <Mail size={12} /> Email it to me
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* How to get started */}
        <section className="mt-14" aria-labelledby="start-title">
          <div className="text-center mb-10">
            <div className="text-[12px] font-black uppercase tracking-[.14em] mb-2" style={{ color: 'var(--g2)' }}>5 steps · about 2 minutes</div>
            <h2 id="start-title" className="font-black text-[28px] sm:text-[36px] leading-tight" style={{ color: 'var(--ink)' }}>How to get started</h2>
          </div>
          <ol className="space-y-6 sm:space-y-8">
            {STEPS.map((st, i) => (
              <li key={st.title} className={`${card} reveal p-5 sm:p-8 grid md:grid-cols-2 gap-5 md:gap-10 items-center`} style={cardStyle}>
                <div className={`rounded-2xl p-2 sm:p-4 ${i % 2 ? 'md:order-2' : ''}`} style={{ background: 'linear-gradient(135deg,#fbf7ff,#f2f8ff)' }}>
                  {st.art}
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 mb-3">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-[15px]" style={{ background: 'var(--grad)' }}>{i + 1}</span>
                    <span className="text-[12px] font-black uppercase tracking-[.12em]" style={{ color: 'var(--soft)' }}>Step {i + 1} of 5</span>
                  </div>
                  <h3 className="font-black text-[21px] sm:text-[26px] leading-tight mb-2" style={{ color: 'var(--ink)' }}>{st.title}</h3>
                  <p className="text-[14.5px] sm:text-[15.5px] leading-relaxed" style={{ color: 'var(--soft)' }}>{st.body}</p>
                  {st.action && <div className="mt-5">{st.action}</div>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Try first + rules */}
        <div className="grid md:grid-cols-2 gap-5 mt-14">
          <div className={`${card} p-6`} style={cardStyle}>
            <div className="flex items-center gap-2 font-black text-[16px] mb-1" style={{ color: 'var(--ink)' }}>
              <Sparkles size={16} style={{ color: 'var(--g2)' }} /> Questions to try first
            </div>
            <p className="text-[12.5px] mb-4" style={{ color: 'var(--soft)' }}>Tap one to copy it, then paste it into Studdy.</p>
            <div className="space-y-2.5">
              {TRY_FIRST.map(t => <TryQuestion key={t.who} who={t.who} ask={t.ask} />)}
            </div>
          </div>

          <div className={`${card} p-6`} style={cardStyle}>
            <div className="flex items-center gap-2 font-black text-[16px] mb-1" style={{ color: 'var(--ink)' }}>
              <ShieldCheck size={16} style={{ color: 'var(--g3)' }} /> Keep your access safe
            </div>
            <p className="text-[12.5px] mb-4" style={{ color: 'var(--soft)' }}>Three simple rules so Studdy keeps working for you.</p>
            <ul className="space-y-3">
              {[
                ['Use it for your home only', 'Sharing this login with people outside your home may end your access without a refund.'],
                ["Don't change the account", "Please don't change the password, name or recovery details of this Google account."],
                ['Google asks for a code?', 'If Google asks you to "verify it\'s you", message us on WhatsApp and we\'ll sort it out.'],
              ].map(([h, b]) => (
                <li key={h} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(140,121,224,.12)' }}>
                    <Check size={13} style={{ color: 'var(--g3)' }} />
                  </span>
                  <div>
                    <div className="font-bold text-[14px]" style={{ color: 'var(--ink)' }}>{h}</div>
                    <div className="text-[13px]" style={{ color: 'var(--soft)' }}>{b}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Help */}
        <div className={`${card} p-6 sm:p-8 mt-5 grid md:grid-cols-[1fr_auto] gap-5 items-center`} style={cardStyle}>
          <div>
            <div className="font-black text-[18px] mb-1" style={{ color: 'var(--ink)' }}>Stuck anywhere? We're here.</div>
            <div className="text-[13.5px]" style={{ color: 'var(--soft)' }}>Message us on WhatsApp or email {SUPPORT_EMAIL}. A real person replies.</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer"
              className="gbtn text-[14px] px-5 py-3 flex items-center justify-center gap-2"><MessageCircle size={15} /> WhatsApp us</a>
            <a href={`mailto:${SUPPORT_EMAIL}`}
              className="gost text-[14px] px-5 py-3 flex items-center justify-center gap-2"><Mail size={15} /> Email</a>
          </div>
        </div>
        {!alreadyRequestedCancel && !isIndiaOrder && (
          <div className="text-center mt-4">
            <button onClick={() => setStep('cancel')} className="text-[12.5px] font-semibold underline" style={{ color: 'var(--soft)' }}>
              Request cancellation
            </button>
          </div>
        )}

        <p className="text-center text-[12px] mt-10" style={{ color: 'var(--soft)' }}>
          Built with ❤️ for learners everywhere. · <Link to="/terms" className="underline">Terms</Link> · <Link to="/contact" className="underline">Contact</Link>
        </p>
      </main>

      <style>{`
        @keyframes dash-pop { 0% { transform: scale(.6); opacity: 0 } 70% { transform: scale(1.05); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes dash-wave { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-14deg) } 75% { transform: rotate(14deg) } }
        @keyframes dash-spin { to { transform: rotate(360deg) } }
        .dash-pop { animation: dash-pop .6s cubic-bezier(.2,.9,.3,1.2) both }
        .dash-wave { animation: dash-wave 1.2s .4s ease-in-out 2; transform-origin: 60% 80% }
        .dash-spin { animation: dash-spin .8s linear infinite }
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease }
        .reveal.in { opacity: 1; transform: none }
        @media (prefers-reduced-motion: reduce) {
          .dash-pop, .dash-wave, .dash-spin { animation: none }
          .reveal { opacity: 1; transform: none; transition: none }
        }
      `}</style>
    </div>
  );
}

/* One row of the login card: icon, label, value, Copy (+ optional extra button). */
function CredRow({ icon, label, value, copy, mono, extra }: {
  icon: ReactNode; label: string; value: string; copy: string; mono?: boolean; extra?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 p-3 rounded-2xl" style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center flex-shrink-0" style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--g3)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wide mb-0.5" style={{ color: 'var(--soft)' }}>{label}</div>
          <div className={`text-[13px] sm:text-[14.5px] font-bold break-all ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--ink)' }}>{value}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">{extra}<CopyButton text={copy} /></div>
    </div>
  );
}

/* A sample question - tap to copy it (without the quote marks). */
function TryQuestion({ who, ask }: { who: string; ask: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button"
      onClick={() => { navigator.clipboard?.writeText(ask.replace(/[“”"]/g, '')); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="w-full text-left rounded-2xl p-3.5 transition-transform hover:-translate-y-0.5"
      style={{ background: 'var(--dim)', border: `1px solid ${copied ? 'rgba(34,197,94,.5)' : 'var(--border)'}` }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: 'var(--soft)' }}>{who}</span>
        <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: copied ? '#16a34a' : 'var(--soft)' }}>
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
        </span>
      </div>
      <div className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>{ask}</div>
    </button>
  );
}
