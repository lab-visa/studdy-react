/**
 * Vercel Serverless Function
 * POST /api/create-checkout-session
 *
 * Creates a Stripe Embedded Checkout session.
 * Returns clientSecret to the frontend.
 *
 * Body: { priceId, region, utmSource, utmCampaign }
 */
import Stripe from 'stripe';

export default async function handler(req, res) {
  /* CORS headers */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { priceId, region, utmSource, utmCampaign } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'priceId is required' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          region: region ?? 'unknown',
          utm_source: utmSource ?? 'direct',
          utm_campaign: utmCampaign ?? 'none',
        },
      },
      metadata: {
        region: region ?? 'unknown',
        utm_source: utmSource ?? 'direct',
        utm_campaign: utmCampaign ?? 'none',
      },
      return_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    });

    return res.status(200).json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
};
