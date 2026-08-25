/**
 * GET /api/get-session?session_id=xxx
 * Fetches Stripe session and returns user data for dashboard.
 * In production this also creates/fetches the user from Supabase.
 */
const Stripe = require('stripe');

/* 
 * Studdy credentials pool.
 * In production this comes from Supabase.
 * For now — one account assigned to all users.
 * Replace with real credential assignment logic.
 */
const STUDDY_CREDENTIALS = {
  email:    'class1001@studdyai.org',
  password: 'StuddyLab2024!',
  url:      'https://studdyai.com',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer'],
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sub      = session.subscription;
    const customer = session.customer;

    /* Format dates */
    const fmt = (ts) => ts
      ? new Date(ts * 1000).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
      : '—';

    const trialEnd   = sub?.trial_end;
    const currentEnd = sub?.current_period_end;
    const isTrialing = sub?.status === 'trialing';

    return res.status(200).json({
      name:          customer?.name ?? '',
      email:         customer?.email ?? session.customer_details?.email ?? '',
      plan:          sub?.items?.data?.[0]?.price?.recurring?.interval === 'year'
                       ? 'Yearly' : 'Monthly',
      status:        sub?.status ?? 'unknown',
      amount:        sub?.items?.data?.[0]?.price?.currency?.toUpperCase() + ' ' +
                     ((sub?.items?.data?.[0]?.price?.unit_amount ?? 0) / 100).toFixed(2),
      nextBilling:   fmt(isTrialing ? trialEnd : currentEnd),
      trialEnds:     fmt(trialEnd),
      studdyEmail:   STUDDY_CREDENTIALS.email,
      studdyPassword: STUDDY_CREDENTIALS.password,
      studdyUrl:     STUDDY_CREDENTIALS.url,
    });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
};
