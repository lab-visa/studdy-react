import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { track } from '../utils/analytics';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    track('checkout_completed');
    const t = setTimeout(() => navigate('/dashboard', { state: location.state }), 3000);
    return () => clearTimeout(t);
  }, [navigate, location.state]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--dim)' }}>
      <div className="text-center max-w-[440px]">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[28px] mx-auto mb-6" style={{ background: 'var(--grad)' }}>✓</div>
        <h1 className="font-black mb-3" style={{ fontSize:'clamp(26px,4vw,36px)', letterSpacing:'-1px' }}>
          Trial started. Welcome! 🎉
        </h1>
        <p className="text-[15px] mb-6" style={{ color:'var(--soft)' }}>
          Taking you to your dashboard now...
        </p>
        <button className="gbtn" onClick={() => navigate('/dashboard', { state: location.state })}>
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}
