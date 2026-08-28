/**
 * Dashboard.tsx — Customer Dashboard
 *
 * Flow (no login, ever — this is the whole point of the design):
 * 1. Customer arrives from Stripe (or from their saved link) with
 *    ?session_id=xxx in the URL.
 * 2. We call /api/get-session to fetch their details.
 * 3. Show their Studdy credentials + subscription info.
 * There is no account, no password to remember, no "log out" — the link
 * itself IS their access. If someone lands here with no session_id, we
 * point them to WhatsApp to get their link resent, not a fake login form.
 */
import { useState, useEffect } from 'react';
import { Check, Copy, ExternalLink, Clock, Laptop, FileText, Globe, Mail, KeyRound, Sparkles } from 'lucide-react';
import { SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../data/config';

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
}

const HERO_GRADIENT = 'linear-gradient(135deg,#fdf4fb,#f0ecff,#eaf6ff)';

/* Copy to clipboard helper */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all"
      style={{ background: copied ? 'rgba(34,197,94,.1)' : 'var(--dim)', color: copied ? '#16a34a' : 'var(--soft)' }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
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
  const s = map[status] ?? { bg: 'var(--dim)', fg: 'var(--soft)', dot: 'var(--soft)', label: status || '—' };
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
  const [step, setStep] = useState<'loading' | 'dashboard' | 'no-link' | 'cancel'>('loading');
  const [user, setUser] = useState<UserData | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelText, setCancelText] = useState('');
  const [cancelSent, setCancelSent] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');

    if (sid) {
      setSessionId(sid);
      fetchSession(sid);
    } else {
      setStep('no-link');
    }
  }, []);

  const fetchSession = async (sid: string) => {
    try {
      const res = await fetch(`/api/get-session?session_id=${sid}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setStep('no-link'); return; }
      setUser(data);
      setStep('dashboard');
    } catch {
      setError('Could not load your dashboard.');
      setStep('no-link');
    }
  };

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

  /* ── No link found — no login form, just point to WhatsApp ── */
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
              Every Studdy Lab customer gets a personal link — the same one you got
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
                  <option value="child_not_interested">Child not interested</option>
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
  const alreadyRequestedCancel = Boolean(user?.cancelRequestedAt);
  const amountLabel = isTrialing ? "You'll be charged" : 'Amount';

  return (
    <div className="min-h-screen" style={{ background: 'var(--dim)' }}>

      {/* Top bar */}
      <header className="bg-white h-16 flex items-center justify-between px-6 sticky top-0 z-50"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-black text-[20px]"><span className="grad-text">studdy</span></div>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
          {user?.email}
        </span>
      </header>

      {/* Hero welcome band — same gradient language as checkout, so this
          doesn't suddenly feel like a different, plainer product the
          moment someone's card is charged. */}
      <div className="px-4 pt-10 pb-8" style={{ background: HERO_GRADIENT }}>
        <div className="max-w-[680px] mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} style={{ color: 'var(--g3)' }} />
            <span className="text-[12px] font-black uppercase tracking-wide" style={{ color: 'var(--g3)' }}>
              You're in
            </span>
          </div>
          <h1 className="font-black text-[28px] mb-1" style={{ color: 'var(--ink)' }}>
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 🎉
          </h1>
          <p className="text-[14px] mb-4" style={{ color: 'var(--soft)' }}>
            This page is your permanent link — save it or keep it in WhatsApp, you can
            come back to it any time.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={user?.status ?? ''} isTrialing={isTrialing} />
            {isTrialing && user?.daysLeftInTrial != null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-white"
                style={{ color: 'var(--ink)', border: '1px solid var(--border)' }}>
                <Clock size={12} style={{ color: 'var(--g4)' }} />
                {user.daysLeftInTrial === 0
                  ? 'Trial ends today'
                  : `${user.daysLeftInTrial} day${user.daysLeftInTrial === 1 ? '' : 's'} left in your trial`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[680px] mx-auto px-4 -mt-2 pb-10">

        {/* Desktop-only notice */}
        <div className="rounded-2xl p-5 mb-5 flex items-center gap-4 bg-white"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--grad)' }}>
            <Laptop size={20} color="#fff" />
          </div>
          <div>
            <div className="font-black text-[14px] mb-0.5" style={{ color: 'var(--ink)' }}>
              Switch to Desktop
            </div>
            <div className="text-[12.5px]" style={{ color: 'var(--soft)' }}>
              The interactive whiteboard works best on a larger screen. Open the link on
              your laptop or desktop for the full experience.
            </div>
          </div>
        </div>

        {alreadyRequestedCancel && (
          <div className="rounded-2xl p-4 mb-5"
            style={{ background: 'rgba(107,114,128,.08)', border: '1px solid rgba(107,114,128,.25)' }}>
            <div className="font-black text-[13px]" style={{ color: 'var(--ink)' }}>
              Cancellation requested
            </div>
            <div className="text-[12px]" style={{ color: 'var(--soft)' }}>
              We'll message you on WhatsApp within 24 hours. Your access stays on until then.
            </div>
          </div>
        )}

        {/* Studdy Access Card */}
        <div className="bg-white rounded-2xl p-6 mb-5 overflow-hidden relative"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--grad)' }} />
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--grad)' }}>
              <span className="text-white font-black text-[14px]">S</span>
            </div>
            <div className="font-black text-[15px]" style={{ color: 'var(--ink)' }}>
              Your Studdy Access
            </div>
          </div>

          {/* Step by step guide */}
          <div className="rounded-xl p-4 mb-5"
            style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
            <div className="font-black text-[12px] uppercase tracking-wide mb-3"
              style={{ color: 'var(--soft)' }}>
              How to get started
            </div>
            {[
              `Open the URL ${user?.studdyUrl ?? 'https://studdyai.com/sign-in'}`,
              'Click "Sign in with Google"',
              'Click "Use another account"',
              'Enter the email and password below',
              'Start asking questions — type or speak anything',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--grad)' }}>
                  <span className="text-white font-black text-[10px]">{i + 1}</span>
                </div>
                <div className="text-[13px]" style={{ color: 'var(--soft)' }}>{step}</div>
              </div>
            ))}
          </div>

          {/* Credentials */}
          <div className="space-y-3">
            {/* URL */}
            <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl"
              style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#fff', border: '1px solid var(--border)' }}>
                  <Globe size={14} style={{ color: 'var(--g3)' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wide mb-0.5"
                    style={{ color: 'var(--soft)' }}>Website</div>
                  <div className="text-[14px] font-bold break-all" style={{ color: 'var(--ink)' }}>
                    {user?.studdyUrl ?? 'studdyai.com'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <CopyButton text={user?.studdyUrl ?? 'studdyai.com'} />
                <a href={user?.studdyUrl ?? 'https://studdyai.com'} target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                  style={{ background: 'var(--grad)', color: '#fff' }}>
                  <ExternalLink size={11} /> Open
                </a>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl"
              style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#fff', border: '1px solid var(--border)' }}>
                  <Mail size={14} style={{ color: 'var(--g3)' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wide mb-0.5"
                    style={{ color: 'var(--soft)' }}>Google Account</div>
                  <div className="text-[14px] font-bold break-all" style={{ color: 'var(--ink)' }}>
                    {user?.studdyEmail ?? '—'}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0"><CopyButton text={user?.studdyEmail ?? ''} /></div>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl"
              style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#fff', border: '1px solid var(--border)' }}>
                  <KeyRound size={14} style={{ color: 'var(--g3)' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wide mb-0.5"
                    style={{ color: 'var(--soft)' }}>Password</div>
                  <div className="text-[14px] font-bold font-mono" style={{ color: 'var(--ink)' }}>
                    {showPwd ? (user?.studdyPassword ?? '—') : '••••••••••'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setShowPwd(v => !v)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                  style={{ background: '#fff', color: 'var(--soft)', border: '1px solid var(--border)' }}>
                  {showPwd ? 'Hide' : 'Show'}
                </button>
                <CopyButton text={user?.studdyPassword ?? ''} />
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="bg-white rounded-2xl p-6 mb-5"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
          <div className="font-black text-[15px] mb-4" style={{ color: 'var(--ink)' }}>
            Subscription
          </div>
          <div className="space-y-3">
            {[
              { label: 'Plan', value: user?.plan ?? '—' },
              { label: 'Status', value: <StatusPill status={user?.status ?? ''} isTrialing={isTrialing} /> },
              { label: amountLabel, value: user?.amount ?? '—' },
              { label: isTrialing ? 'First payment date' : 'Next billing', value: user?.trialEnds && isTrialing ? user.trialEnds : (user?.nextBilling ?? '—') },
              ...(user && user.totalMonthsPaid > 0
                ? [{ label: 'Payments made', value: String(user.totalMonthsPaid) }]
                : []),
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-center py-2"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="text-[13px]" style={{ color: 'var(--soft)' }}>{row.label}</div>
                <div className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>{row.value}</div>
              </div>
            ))}
          </div>

          {user?.latestInvoiceUrl && (
            <a href={user.latestInvoiceUrl} target="_blank" rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: 'var(--dim)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
              <FileText size={14} /> View latest invoice
            </a>
          )}
        </div>

        {/* Support + Cancel */}
        <div className="bg-white rounded-2xl p-6"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
          <div className="font-black text-[15px] mb-4" style={{ color: 'var(--ink)' }}>Need help?</div>
          <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer"
            className="gbtn w-full text-[14px] py-3 flex items-center justify-center gap-2 mb-3">
            💬 WhatsApp Support
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`}
            className="gost w-full text-[14px] py-3 flex items-center justify-center gap-2 mb-3">
            <Mail size={15} /> {SUPPORT_EMAIL}
          </a>
          {!alreadyRequestedCancel && (
            <button
              onClick={() => setStep('cancel')}
              className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all"
              style={{ color: 'var(--soft)', background: 'transparent', border: 'none' }}>
              Request cancellation
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
