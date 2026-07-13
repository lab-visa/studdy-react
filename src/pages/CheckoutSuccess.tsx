import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analytics';

export default function CheckoutSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    track('checkout_completed');
    const t = setTimeout(() => navigate('/dashboard'), 3000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--dim)' }}>
      <div className="text-center max-w-[480px]">
        <div className="text-[64px] mb-6 animate-bounce">🎉</div>
        <h1 className="font-black mb-4" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-1px' }}>
          You're in! Trial started.
        </h1>
        <p className="text-[16px] mb-6" style={{ color: 'var(--soft)' }}>
          Taking you to your dashboard now... Your login details are waiting there.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="gbtn" onClick={() => navigate('/dashboard')}>Go to Dashboard →</button>
        </div>
      </div>
    </div>
  );
}
