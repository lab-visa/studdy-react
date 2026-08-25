import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Experience', href: '#demo' },
  { label: 'Use Cases', href: '#subjects' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  // Close menu on resize
  useEffect(() => {
    const h = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300"
        style={{
          height: scrolled ? '60px' : '70px',
          background: scrolled ? 'rgba(255,255,255,.97)' : 'rgba(255,255,255,.9)',
          backdropFilter: 'blur(18px)',
          borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,.05)' : 'none',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
          <button
            className="font-black cursor-pointer"
            style={{ fontSize: 'clamp(21px, 2vw, 24px)', letterSpacing: '-0.5px', background: 'none', border: 'none', padding: 0 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Go to top"
          >
            <span className="grad-text">studdy</span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-7 text-[14px] font-semibold" style={{ color: 'var(--soft)' }}>
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className="hover:text-[var(--ink)] transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[13.5px] font-bold px-4 py-2 rounded-full transition-colors hover:bg-gray-50"
              style={{ color: 'var(--soft)' }}
            >
              Log In
            </button>
            <button
              className="gbtn text-[13.5px] px-5 py-2.5"
              onClick={() => navigate('/checkout')}
            >
              Start Free Trial
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-xl"
            style={{ background: 'var(--dim)' }}
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b py-2 px-6 shadow-lg" style={{ borderColor: 'var(--border)' }}>
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="block py-3.5 font-semibold text-[15px] border-b last:border-0"
                style={{ borderColor: 'var(--border)', color: 'var(--soft)' }}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="py-3 flex gap-3">
              <button className="gost flex-1 text-[14px] py-3" onClick={() => navigate('/dashboard')}>Log In</button>
              <button className="gbtn flex-1 text-[14px] py-3" onClick={() => { navigate('/checkout'); setMenuOpen(false); }}>Start Free Trial</button>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile sticky bottom CTA */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 py-3 bg-white/96 backdrop-blur-md"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button className="gbtn w-full text-[15px] py-4" onClick={() => navigate('/checkout')}>
          Start Free Trial
        </button>
      </div>
    </>
  );
}
