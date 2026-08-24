/**
 * Dashboard.tsx — User Dashboard
 *
 * Flow:
 * 1. User arrives from Stripe with ?session_id=xxx
 * 2. We call /api/get-session to fetch their details
 * 3. Show their Studdy credentials + subscription info
 * 4. Returning users enter email → get magic link
 */
import { useState, useEffect } from 'react';
import { Check, Copy, ExternalLink, LogOut, AlertCircle } from 'lucide-react';

interface UserData {
  name: string;
  email: string;
  plan: string;
  status: string;
  amount: string;
  currency: string;
  nextBilling: string;
  trialEnds: string;
  studdyEmail: string;
  studdyPassword: string;
  studdyUrl: string;
}

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

export default function Dashboard() {
  const [step,    setStep]    = useState<'loading' | 'dashboard' | 'login' | 'cancel'>('loading');
  const [user,    setUser]    = useState<UserData | null>(null);
  const [email,   setEmail]   = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelText,   setCancelText]   = useState('');
  const [cancelSent,   setCancelSent]   = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const token     = params.get('token');

    if (sessionId) {
      /* Coming from Stripe — fetch session details */
      fetchSession(sessionId);
    } else if (token) {
      /* Coming from magic link */
      fetchByToken(token);
    } else {
      /* Returning user — show login */
      setStep('login');
    }
  }, []);

  const fetchSession = async (sessionId: string) => {
    try {
      const res  = await fetch(`/api/get-session?session_id=${sessionId}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setStep('login'); return; }
      setUser(data);
      setStep('dashboard');
    } catch {
      setError('Could not load your dashboard. Please log in.');
      setStep('login');
    }
  };

  const fetchByToken = async (token: string) => {
    try {
      const res  = await fetch(`/api/verify-token?token=${token}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setStep('login'); return; }
      setUser(data);
      setStep('dashboard');
    } catch {
      setError('Link expired. Please log in again.');
      setStep('login');
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setSending(true);
    try {
      await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError('Could not send login link. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCancelRequest = async () => {
    try {
      await fetch('/api/cancel-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          reason: cancelReason,
          message: cancelText,
        }),
      });
      setCancelSent(true);
    } catch {
      setError('Could not submit request. Please WhatsApp us directly.');
    }
  };

  /* ── Loading ── */
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dim)' }}>
        <div className="text-center">
          <div className="font-black text-[22px] mb-2"><span className="grad-text">studdy</span></div>
          <div className="text-[14px]" style={{ color: 'var(--soft)' }}>Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  /* ── Login ── */
  if (step === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--dim)' }}>
        <div className="w-full max-w-[420px]">
          <div className="bg-white rounded-3xl p-8" style={{ border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.08)' }}>
            <div className="text-center mb-6">
              <div className="font-black text-[22px] mb-1"><span className="grad-text">studdy</span></div>
              <div className="text-[14px] font-semibold" style={{ color: 'var(--soft)' }}>
                Access your dashboard
              </div>
            </div>

            {error && (
              <div className="rounded-xl p-3 mb-4 text-[13px]"
                style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,.2)' }}>
                {error}
              </div>
            )}

            {!sent ? (
              <>
                <label className="block text-[11.5px] font-black uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--soft)' }}>
                  Email address you used to sign up
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
                  placeholder="parent@gmail.com"
                  className="w-full px-4 py-3 rounded-xl text-[14px] mb-4"
                  style={{ border: '1.5px solid var(--border)', outline: 'none' }}
                />
                <button className="gbtn w-full text-[14px] py-3"
                  onClick={handleMagicLink} disabled={sending || !email}>
                  {sending ? 'Sending...' : 'Send me a login link'}
                </button>
                <p className="text-center text-[12px] mt-3" style={{ color: 'var(--soft)' }}>
                  We will email you a secure link. No password needed.
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-[32px] mb-3">📧</div>
                <div className="font-black text-[16px] mb-2" style={{ color: 'var(--ink)' }}>
                  Check your email
                </div>
                <div className="text-[13px]" style={{ color: 'var(--soft)' }}>
                  We sent a login link to <strong>{email}</strong>.
                  Click the link to access your dashboard.
                </div>
              </div>
            )}
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
          <div className="bg-white rounded-3xl p-8" style={{ border: '1.5px solid var(--border)' }}>
            {!cancelSent ? (
              <>
                <div className="font-black text-[18px] mb-1" style={{ color: 'var(--ink)' }}>
                  Request cancellation
                </div>
                <div className="text-[13px] mb-6" style={{ color: 'var(--soft)' }}>
                  We will contact you within 24 hours to help resolve any issues
                  before cancelling your subscription.
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
                  onClick={handleCancelRequest} disabled={!cancelReason}>
                  Submit cancellation request
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
  const isTrialing = user?.status === 'trialing';
  const isActive   = user?.status === 'active';

  return (
    <div className="min-h-screen" style={{ background: 'var(--dim)' }}>

      {/* Top bar */}
      <header className="bg-white h-16 flex items-center justify-between px-6 sticky top-0 z-50"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-black text-[20px]"><span className="grad-text">studdy</span></div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>
            {user?.email}
          </span>
          <button onClick={() => setStep('login')} title="Log out"
            className="p-2 rounded-xl" style={{ color: 'var(--soft)' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="max-w-[680px] mx-auto px-4 py-10">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="font-black text-[24px]" style={{ color: 'var(--ink)' }}>
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--soft)' }}>
            Your Studdy access is ready below.
          </p>
        </div>

        {/* Status banner */}
        {isTrialing && (
          <div className="rounded-2xl p-4 mb-6 flex items-center gap-3"
            style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)' }}>
            <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <div className="font-black text-[13px]" style={{ color: '#92400e' }}>
                Free trial active — ends {user?.trialEnds}
              </div>
              <div className="text-[12px]" style={{ color: '#92400e' }}>
                Your card will be charged {user?.amount} on {user?.trialEnds}. Cancel anytime before then.
              </div>
            </div>
          </div>
        )}

        {/* Studdy Access Card */}
        <div className="bg-white rounded-2xl p-6 mb-4"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
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
              'Go to studdyai.com and click Sign In',
              'Click "Sign in with Google"',
              'Use the email and password below',
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
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide mb-0.5"
                  style={{ color: 'var(--soft)' }}>Website</div>
                <div className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
                  {user?.studdyUrl ?? 'studdyai.com'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={user?.studdyUrl ?? 'studdyai.com'} />
                <a href={user?.studdyUrl ?? 'https://studdyai.com'} target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--grad)', color: '#fff' }}>
                  <ExternalLink size={11} /> Open
                </a>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide mb-0.5"
                  style={{ color: 'var(--soft)' }}>Google Account</div>
                <div className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
                  {user?.studdyEmail ?? '—'}
                </div>
              </div>
              <CopyButton text={user?.studdyEmail ?? ''} />
            </div>

            {/* Password */}
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'var(--dim)', border: '1px solid var(--border)' }}>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide mb-0.5"
                  style={{ color: 'var(--soft)' }}>Password</div>
                <div className="text-[14px] font-bold font-mono" style={{ color: 'var(--ink)' }}>
                  {showPwd ? (user?.studdyPassword ?? '—') : '••••••••••'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPwd(v => !v)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--dim)', color: 'var(--soft)', border: '1px solid var(--border)' }}>
                  {showPwd ? 'Hide' : 'Show'}
                </button>
                <CopyButton text={user?.studdyPassword ?? ''} />
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="bg-white rounded-2xl p-6 mb-4"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
          <div className="font-black text-[15px] mb-4" style={{ color: 'var(--ink)' }}>
            Subscription
          </div>
          <div className="space-y-3">
            {[
              { label: 'Plan', value: user?.plan ?? '—' },
              { label: 'Status', value: isTrialing ? '🟡 Trial' : isActive ? '🟢 Active' : user?.status ?? '—' },
              { label: 'Amount', value: user?.amount ?? '—' },
              { label: 'Next billing', value: user?.nextBilling ?? '—' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-2"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="text-[13px]" style={{ color: 'var(--soft)' }}>{row.label}</div>
                <div className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Support + Cancel */}
        <div className="bg-white rounded-2xl p-6 mb-4"
          style={{ border: '1.5px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.06)' }}>
          <div className="font-black text-[15px] mb-4" style={{ color: 'var(--ink)' }}>Need help?</div>
          <a href="https://wa.me/message/PLACEHOLDER" target="_blank" rel="noopener noreferrer"
            className="gbtn w-full text-[14px] py-3 flex items-center justify-center gap-2 mb-3">
            💬 WhatsApp Support
          </a>
          <button
            onClick={() => setStep('cancel')}
            className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all"
            style={{ color: 'var(--soft)', background: 'transparent', border: 'none' }}>
            Request cancellation
          </button>
        </div>

      </div>
    </div>
  );
}
