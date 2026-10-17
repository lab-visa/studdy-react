/**
 * Loads Cashfree's checkout script (once) and opens the payment page for
 * a payment_session_id created by /api/cashfree/create-order.
 * https://sdk.cashfree.com/js/v3/cashfree.js - the official v3 web SDK.
 */
type CashfreeInstance = { checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown> };
declare global {
  interface Window { Cashfree?: (opts: { mode: 'sandbox' | 'production' }) => CashfreeInstance }
}

let loading: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error('Could not load the payment page. Check your internet and try again.')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export async function openCashfreeCheckout(paymentSessionId: string, mode: 'sandbox' | 'production') {
  await loadSdk();
  if (!window.Cashfree) throw new Error('Payment page did not load. Please try again.');
  const cf = window.Cashfree({ mode });
  /* _self: Cashfree replaces this page, then sends the customer to our
   * return_url (/dashboard?order_id=...) after payment. */
  await cf.checkout({ paymentSessionId, redirectTarget: '_self' });
}
