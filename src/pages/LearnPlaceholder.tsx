import { useNavigate } from 'react-router-dom';

export default function LearnPlaceholder() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--dim)' }}>
      <div className="max-w-[480px] bg-white rounded-3xl p-10 shadow-lg" style={{ border: '1.5px solid var(--border)' }}>
        <div className="text-[40px] mb-4">✏️</div>
        <h1 className="font-black text-[26px] mb-3">Tutor launching soon.</h1>
        <p className="mb-6" style={{ color: 'var(--soft)' }}>
          The interactive whiteboard tutor connects here. Your account is active and ready.
        </p>
        <button className="gost w-full mb-3" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        <button className="gbtn w-full" onClick={() => navigate('/')}>Return to Homepage</button>
      </div>
    </div>
  );
}
