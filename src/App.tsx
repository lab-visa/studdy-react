import { lazy, Suspense, Component, type ReactNode, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Checkout = lazy(() => import('./pages/Checkout'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const LearnPlaceholder = lazy(() => import('./pages/LearnPlaceholder'));
const PrivacyPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.PrivacyPolicy })));
const TermsPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.TermsOfService })));
const RefundPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.RefundPolicy })));
const CancelPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.CancellationPolicy })));
const ContactPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.ContactPage })));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dim)' }}>
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: 'var(--g1)', animationDelay: `${i*0.15}s` }} />
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
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <h1 className="font-black text-[24px] mb-3">Something went wrong.</h1>
          <button className="gbtn mt-4" onClick={() => window.location.reload()}>Refresh page</button>
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
  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout-success" element={<CheckoutSuccess />} />
          <Route path="/learn" element={<LearnPlaceholder />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/cancellation" element={<CancelPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFound />} />
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
