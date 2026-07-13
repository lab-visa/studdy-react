import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analytics';

export default function Checkout() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = () => {
    track('checkout_started');
    setLoading(true);
    setTimeout(() => {
      track('checkout_completed');
      navigate('/checkout-success');
    }, 1800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: 'var(--dim)' }}>
      <div className="w-full max-w-[500px] bg-white rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,.08)]" style={{ border: '1.5px solid var(--border)' }}>
        <div className="text-center mb-6">
          <div className="font-black text-[22px] mb-1"><span className="grad-text">studdy</span> lab</div>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--soft)' }}>Checkout</div>
        </div>

        <div className="rounded-2xl p-5 mb-6" style={{ background: 'linear-gradient(135deg,rgba(239,85,182,.06),rgba(140,121,224,.06))', border: '1px solid rgba(140,121,224,.15)' }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="font-black text-[17px]">7-Day Free Trial</div>
              <div className="text-[13px]" style={{ color: 'var(--soft)' }}>Then $9.99/week after trial</div>
            </div>
            <div className="font-black text-[22px]">$0</div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {['Email address', 'Full name', 'WhatsApp number'].map(f => (
            <div key={f}>
              <label className="block text-[12px] font-black uppercase tracking-wide mb-1.5" style={{ color: 'var(--soft)' }}>{f}</label>
              <input type="text" className="w-full px-4 py-3 rounded-xl text-[14px]" style={{ border: '1.5px solid var(--border)', background: '#fff' }} placeholder={f} />
            </div>
          ))}
        </div>

        <div className="rounded-xl p-4 mb-6 text-[12.5px]" style={{ background: 'var(--dim)', color: 'var(--soft)' }}>
          <div className="font-black mb-1">Payment details will go here</div>
          Stripe or Razorpay integration added here. Card captured for after trial — $0 charged today.
        </div>

        <button
          className="gbtn w-full text-[15px] py-4"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Starting your trial...' : 'Start Free Trial — $0 today →'}
        </button>

        <p className="text-center text-[12px] mt-4" style={{ color: 'var(--soft)' }}>
          We'll WhatsApp you before you're charged. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
