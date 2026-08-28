/**
 * GET /api/get-session?session_id=xxx
 * Fetches the customer's data for the dashboard.
 *
 * Primary source: Supabase (the `leads` row the Stripe webhook wrote when
 * this payment completed) — that's where the REAL assigned Studdy account
 * lives, and it stays correct even if their status changes later.
 *
 * Studdy login shown is looked up LIVE from studdy_accounts by group_name,
 * not read off the frozen copy on the lead row — so if Vish changes a
 * group's email/password/URL once in studdy_accounts, every customer in
 * that group sees the new value immediately, with no per-customer editing.
 *
 * Fallback: if Supabase doesn't have this session yet (e.g. the webhook
 * hasn't run yet, which can take a couple of seconds), we ask Stripe
 * directly so the page still shows something instead of an error, using
 * the last-resort shared placeholder credentials.
 */
import Stripe from 'stripe';
import { getSupabase } from './_lib/supabase.js';
import { mapStatus, fmtDate, resolveNextBilling, daysUntil } from './_lib/status.js';

const FALLBACK_CREDENTIALS = {
  email: 'class1001@studdyai.org',
  password: 'StuddyLab2024!',
  url: 'https://studdyai.com',
};

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
      /* Live lookup — current credentials for whichever group they're in,
       * not the snapshot taken the day they signed up. */
      let studdyEmail = lead.studdy_email || '';
      let studdyPassword = lead.studdy_password || '';
      let studdyUrl = lead.studdy_url || 'https://studdyai.com';

      if (lead.group_name) {
        const { data: group } = await supabase
          .from('studdy_accounts')
          .select('studdy_email, studdy_password, studdy_url')
          .eq('group_name', lead.group_name)
          .maybeSingle();
        if (group) {
          studdyEmail = group.studdy_email || studdyEmail;
          studdyPassword = group.studdy_password || studdyPassword;
          studdyUrl = group.studdy_url || studdyUrl;
        }
      }

      return res.status(200).json({
        name: lead.parent_name || '',
        email: lead.email || '',
        plan: lead.plan_type || 'Monthly',
        status: lead.status || 'Active',
        amount: lead.currency && lead.amount ? `${lead.currency} ${lead.amount}` : '',
        nextBilling: fmtDate(lead.next_billing_date),
        trialEnds: fmtDate(lead.trial_end_date),
        daysLeftInTrial: daysUntil(lead.trial_end_date),
        studdyEmail,
        studdyPassword,
        studdyUrl,
        totalMonthsPaid: lead.total_months_paid ?? 0,
        latestInvoiceUrl: lead.latest_invoice_url || null,
        cancelRequestedAt: lead.cancel_requested_at || null,
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
    const nextBilling = resolveNextBilling(sub);
    const trialEnd = sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString().slice(0, 10) : null;

    return res.status(200).json({
      name: customer?.name ?? '',
      email: customer?.email ?? session.customer_details?.email ?? '',
      plan: sub?.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'Yearly' : 'Monthly',
      status: mapStatus(sub?.status),
      amount:
        sub?.items?.data?.[0]?.price?.currency?.toUpperCase() +
        ' ' +
        ((sub?.items?.data?.[0]?.price?.unit_amount ?? 0) / 100).toFixed(2),
      nextBilling: fmtDate(nextBilling),
      trialEnds: fmtDate(trialEnd),
      daysLeftInTrial: daysUntil(trialEnd),
      studdyEmail: FALLBACK_CREDENTIALS.email,
      studdyPassword: FALLBACK_CREDENTIALS.password,
      studdyUrl: FALLBACK_CREDENTIALS.url,
      totalMonthsPaid: 0,
      latestInvoiceUrl: null,
      cancelRequestedAt: null,
    });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
