/**
 * GET /api/get-session?session_id=xxx
 * Fetches the customer's data for the dashboard.
 *
 * Primary source: Supabase (the `leads` row the Stripe webhook wrote when
 * this payment completed) — that's where the REAL assigned Studdy account
 * lives, and it stays correct even if their status changes later.
 *
 * Fallback: if Supabase doesn't have this session yet (e.g. the webhook
 * hasn't run yet, which can take a couple of seconds), we ask Stripe
 * directly so the page still shows something instead of an error, using
 * the last-resort shared placeholder credentials.
 */
import Stripe from 'stripe';
import { getSupabase } from './_lib/supabase.js';

const FALLBACK_CREDENTIALS = {
  email: 'class1001@studdyai.org',
  password: 'StuddyLab2024!',
  url: 'https://studdyai.com',
};

const fmtDate = (isoDate) =>
  isoDate
    ? new Date(isoDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  const supabase = getSupabase();

  /* 1. Try Supabase first — this is the real, authoritative record */
  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('stripe_session_id', session_id)
      .maybeSingle();

    if (lead) {
      return res.status(200).json({
        name: lead.parent_name || '',
        email: lead.email || '',
        plan: lead.plan_type || 'Monthly',
        status: lead.status || 'Active',
        amount: lead.currency && lead.amount ? `${lead.currency} ${lead.amount}` : '',
        nextBilling: fmtDate(lead.next_billing_date),
        trialEnds: fmtDate(lead.trial_end_date),
        studdyEmail: lead.studdy_email || '',
        studdyPassword: lead.studdy_password || '',
        studdyUrl: lead.studdy_url || 'https://studdyai.com',
      });
    }
  } catch (err) {
    console.error('get-session Supabase lookup error:', err);
    /* fall through to the Stripe fallback below */
  }

  /* 2. Not in Supabase yet — ask Stripe directly (temporary, until the
   *    webhook catches up) so the customer still sees their dashboard. */
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer'],
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sub = session.subscription;
    const customer = session.customer;

    const fmt = (ts) =>
      ts
        ? new Date(ts * 1000).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '—';

    const trialEnd = sub?.trial_end;
    const currentEnd = sub?.current_period_end;
    const isTrialing = sub?.status === 'trialing';

    return res.status(200).json({
      name: customer?.name ?? '',
      email: customer?.email ?? session.customer_details?.email ?? '',
      plan:
        sub?.items?.data?.[0]?.price?.recurring?.interval === 'year'
          ? 'Yearly'
          : 'Monthly',
      status: sub?.status ?? 'unknown',
      amount:
        sub?.items?.data?.[0]?.price?.currency?.toUpperCase() +
        ' ' +
        ((sub?.items?.data?.[0]?.price?.unit_amount ?? 0) / 100).toFixed(2),
      nextBilling: fmt(isTrialing ? trialEnd : currentEnd),
      trialEnds: fmt(trialEnd),
      studdyEmail: FALLBACK_CREDENTIALS.email,
      studdyPassword: FALLBACK_CREDENTIALS.password,
      studdyUrl: FALLBACK_CREDENTIALS.url,
    });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
