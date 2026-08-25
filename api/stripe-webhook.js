/**
 * POST /api/stripe-webhook
 *
 * Stripe calls this URL directly (not the browser) the instant something
 * happens on a payment — right now we handle the moment checkout finishes:
 *
 *   checkout.session.completed
 *     -> look up the lead by client_reference_id (the lead ID we attached
 *        to the Payment Link in Checkout.tsx)
 *     -> assign them a Studdy account (fills the first group with a free
 *        seat, out of the studdy_accounts table)
 *     -> save their real Stripe session ID, subscription details, trial
 *        dates, and a ready-to-share dashboard URL
 *
 * Monthly payment tracking, failed payments, and cancellations are the
 * next piece — not handled here yet, on purpose, one step at a time.
 *
 * SECURITY: every request here is verified against Stripe's signature
 * (STRIPE_WEBHOOK_SECRET) so nobody but Stripe itself can trigger this.
 */
import Stripe from 'stripe';
import { getSupabase } from './_lib/supabase.js';

/* Vercel must NOT parse the body — Stripe's signature check needs the
 * exact raw bytes Stripe sent, not a re-serialized JSON object. */
export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function mapStatus(subStatus) {
  switch (subStatus) {
    case 'trialing':
    case 'active':
      return 'Active';
    case 'past_due':
    case 'unpaid':
      return 'Failed';
    case 'canceled':
      return 'Cancelled';
    case 'paused':
      return 'Paused';
    default:
      return 'Active';
  }
}

const toDate = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null);

/* Finds a Studdy account/group with a free seat (fewer than 7 active
 * customers) and claims one seat. If every existing group is full, returns
 * null — Vish needs to add a new group/account manually in that case. */
async function assignStuddyAccount(supabase) {
  const { data: groups, error } = await supabase
    .from('studdy_accounts')
    .select('*')
    .order('group_name', { ascending: true });

  if (error) throw error;

  const open = (groups || []).find((g) => (g.active_customer_count ?? 0) < 7);
  if (!open) return null;

  await supabase
    .from('studdy_accounts')
    .update({ active_customer_count: (open.active_customer_count ?? 0) + 1 })
    .eq('id', open.id);

  return open;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabase = getSupabase();

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionSummary = event.data.object;

      /* Re-fetch with full subscription + customer details expanded */
      const session = await stripe.checkout.sessions.retrieve(sessionSummary.id, {
        expand: ['subscription', 'customer'],
      });

      const sub = session.subscription;
      const customer = session.customer;
      const leadId = session.client_reference_id || null;

      const priceItem = sub?.items?.data?.[0];
      const planType =
        priceItem?.price?.recurring?.interval === 'year' ? 'Yearly' : 'Monthly';
      const currency = priceItem?.price?.currency?.toUpperCase() || null;
      const amount = priceItem?.price?.unit_amount
        ? priceItem.price.unit_amount / 100
        : null;

      const trialStart = toDate(sub?.trial_start);
      const trialEnd = toDate(sub?.trial_end);
      const nextBilling = toDate(sub?.current_period_end);

      const dashboardUrl = `https://studdylab.com/dashboard?session_id=${session.id}`;
      const account = await assignStuddyAccount(supabase);

      const record = {
        email: customer?.email || session.customer_details?.email || null,
        parent_name: customer?.name || session.customer_details?.name || null,
        stripe_session_id: session.id,
        stripe_customer_id:
          typeof customer === 'string' ? customer : customer?.id || null,
        stripe_subscription_id: typeof sub === 'string' ? sub : sub?.id || null,
        dashboard_url: dashboardUrl,
        platform: 'stripe',
        currency,
        plan_type: planType,
        amount,
        trial_start_date: trialStart,
        trial_end_date: trialEnd,
        first_payment_date: trialEnd,
        next_billing_date: nextBilling,
        studdy_email: account?.studdy_email || null,
        studdy_password: account?.studdy_password || null,
        studdy_url: account?.studdy_url || 'https://studdyai.com',
        group_name: account?.group_name || null,
        stage: 'paid',
        status: mapStatus(sub?.status),
        updated_at: new Date().toISOString(),
      };

      if (leadId) {
        const { data: existing } = await supabase
          .from('leads')
          .select('lead_id')
          .eq('lead_id', leadId)
          .maybeSingle();

        if (existing) {
          await supabase.from('leads').update(record).eq('lead_id', leadId);
        } else {
          await supabase
            .from('leads')
            .insert({ lead_id: leadId, ...record, opened_at: new Date().toISOString() });
        }
      } else {
        /* No lead ID at all — someone paid without ever being tracked on
         * the site (e.g. a raw Stripe link shared somewhere). Still record
         * the real customer so nothing is lost. */
        await supabase
          .from('leads')
          .insert({ ...record, opened_at: new Date().toISOString() });
      }

      if (!account) {
        console.error(
          `No free Studdy account slot for session ${session.id} — add a new group in studdy_accounts.`
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
