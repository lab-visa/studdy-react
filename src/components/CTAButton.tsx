import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analytics';

interface Props {
  variant?: 'primary' | 'ghost' | 'white';
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  trackEvent?: Parameters<typeof track>[0];
}

export default function CTAButton({ variant = 'primary', to, onClick, children, className = '', fullWidth, trackEvent }: Props) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (trackEvent) track(trackEvent);
    if (to) navigate(to);
    onClick?.();
  };

  const base = 'font-bold rounded-full transition-all duration-150 inline-flex items-center justify-center gap-2 border-0 cursor-pointer text-[15px]';
  const variants = {
    primary: 'gbtn',
    ghost: 'gost',
    white: 'bg-white text-[var(--g1)] font-black rounded-full px-9 py-4 shadow-[0_12px_40px_rgba(0,0,0,.2)] hover:-translate-y-0.5',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
