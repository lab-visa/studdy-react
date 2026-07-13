import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = [
    { label: 'Experience', href: '#demo' },
    { label: 'Use Cases', href: '#subjects' },
    { label: 'How It Works', href: '#hiw' },
    { label: 'Why Studdy', href: '#compare' },
    { label: 'Reviews', href: '#reviews' },
    { label: 'Pricing', href: '#pricing' },
  ];

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300"
        style={{
          height: scrolled ? '64px' : '72px',
          background: scrolled ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.88)',
          backdropFilter: 'blur(18px)',
          borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'transparent'}`,
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,.06)' : 'none',
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
          <div
            className="font-black text-[22px] cursor-pointer"
            style={{ letterSpacing: '-0.5px' }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <span className="grad-text">studdy</span> lab
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-7 text-[14px] font-semibold" style={{ color: 'var(--soft)' }}>
            {navLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="hover:text-[var(--ink)] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[14px] font-bold px-4 py-2 rounded-full hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--soft)' }}
            >
              Log In
            </button>
            <button className="gbtn text-[13.5px] px-5 py-2.5" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              Start Free Trial
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(o => !o)}>
            <div className="w-5 h-0.5 bg-[var(--ink)] mb-1 transition-all" style={{ transform: menuOpen ? 'rotate(45deg) translateY(5px)' : 'none' }} />
            <div className="w-5 h-0.5 bg-[var(--ink)] mb-1" style={{ opacity: menuOpen ? 0 : 1 }} />
            <div className="w-5 h-0.5 bg-[var(--ink)]" style={{ transform: menuOpen ? 'rotate(-45deg) translateY(-5px)' : 'none' }} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b py-4 px-6" style={{ borderColor: 'var(--border)' }}>
            {navLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="block py-3 font-semibold border-b text-[15px]"
                style={{ borderColor: 'var(--border)', color: 'var(--soft)' }}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* Mobile sticky bottom CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] p-3 bg-white/95 backdrop-blur-md border-t" style={{ borderColor: 'var(--border)' }}>
        <button className="gbtn w-full text-[15px] py-4" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
          Start Free Trial
        </button>
      </div>
    </>
  );
}
