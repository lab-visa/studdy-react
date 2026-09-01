import { lazy, Suspense, Component, type ReactNode, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import { trackEvent } from './utils/tracking';

const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Checkout       = lazy(() => import('./pages/Checkout'));
const CheckoutSuccess= lazy(() => import('./pages/CheckoutSuccess'));
const LearnPlaceholder=lazy(() => import('./pages/LearnPlaceholder'));
const PrivacyPage    = lazy(() => import('./pages/Legal').then(m => ({ default: m.PrivacyPolicy })));
const TermsPage      = lazy(() => import('./pages/Legal').then(m => ({ default: m.TermsOfService })));
const RefundPage     = lazy(() => import('./pages/Legal').then(m => ({ default: m.RefundPolicy })));
const CancelPage     = lazy(() => import('./pages/Legal').then(m => ({ default: m.CancellationPolicy })));
const ContactPage    = lazy(() => import('./pages/Legal').then(m => ({ default: m.ContactPage })));
const AdminLogin      = lazy(() => import('./pages/admin/AdminLogin'));
const AdminHome       = lazy(() => import('./pages/admin/AdminHome'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dim)' }}>
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
            style={{ background: 'var(--g1)', animationDelay: `${i*0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--dim)' }}>
      <div className="font-black mb-4" style={{ fontSize:'80px', color:'var(--border)' }}>404</div>
      <h1 className="font-black text-[28px] mb-3">Page not found.</h1>
      <p className="mb-6 text-[15px]" style={{ color:'var(--soft)' }}>This page doesn't exist.</p>
      <button className="gbtn" onClick={() => navigate('/')}>Back to Studdy Lab</button>
    </div>
  );
}

interface EBState { hasError: boolean; }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    /*
     * DIAGNOSTIC LOGGING — captures everything needed to identify
     * the exact crash source on any device or OS.
     * Do not remove until the mobile crash is fully confirmed fixed.
     */
    const diagnostics = {
      // Error details
      message:        error?.message ?? '(no message)',
      name:           error?.name    ?? '(no name)',
      stack:          error?.stack   ?? '(no stack)',
      componentStack: info?.componentStack ?? '(no componentStack)',

      // Viewport / screen state at crash time
      windowInnerWidth:  window.innerWidth,
      windowInnerHeight: window.innerHeight,
      screenWidth:       screen.width,
      screenHeight:      screen.height,
      devicePixelRatio:  window.devicePixelRatio,
      // screen.orientation is not available on all iOS Safari versions
      orientationType:   (screen as Screen & { orientation?: { type?: string } })
                           .orientation?.type ?? 'not supported',

      // Fullscreen state
      fullscreenElement:
        document.fullscreenElement?.tagName ??
        (document as Document & { webkitFullscreenElement?: Element })
          .webkitFullscreenElement?.tagName ??
        null,

      // Page context
      url:       window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    console.error('[ErrorBoundary] CRASH CAPTURED:', diagnostics);

    // Also restore body scroll in case a modal was open when the crash occurred
    document.body.style.overflow = '';
  }

  handleReset = () => {
    document.body.style.overflow = '';
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <h1 className="font-black text-[24px] mb-3">Something went wrong.</h1>
          <p className="mb-6 text-[15px]" style={{ color: 'var(--soft)' }}>
            Check the browser console for full diagnostic details.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <button className="gbtn" onClick={this.handleReset}>Try again</button>
            <button className="gost" onClick={() => window.location.reload()}>Refresh page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollRestoration() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AppRoutes() {
  /* Fire once per visit — anonymous counter only, no row created for this
   * visitor unless/until they actually start a trial (Phase 3, Aug 2026).
   * Skipped on /admin — that's Vish opening his own CRM every day, not a
   * marketing visitor, and would otherwise quietly inflate "site opens". */
  useEffect(() => {
    if (!window.location.pathname.startsWith('/admin')) {
      trackEvent('opened');
    }
  }, []);

  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/"                element={<Home />} />
          <Route path="/dashboard"       element={<Dashboard />} />
          <Route path="/checkout"        element={<Checkout />} />
          <Route path="/checkout-success"element={<CheckoutSuccess />} />
          <Route path="/learn"           element={<LearnPlaceholder />} />
          <Route path="/privacy"         element={<PrivacyPage />} />
          <Route path="/terms"           element={<TermsPage />} />
          <Route path="/refund"          element={<RefundPage />} />
          <Route path="/cancellation"    element={<CancelPage />} />
          <Route path="/contact"         element={<ContactPage />} />
          <Route path="/admin/login"     element={<AdminLogin />} />
          <Route path="/admin"           element={<AdminHome />} />
          <Route path="*"               element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
