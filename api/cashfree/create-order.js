/**
 * POST /api/cashfree/create-order
 * body: { plan: 'quarterly'|'yearly', name, email, phone, leadId?, campaign?, ref?, refTyped? }
 *
 * ref = partner code (from their ?ref= link, or typed in "Have a partner code?").
 * Only an active partner's code is kept, and never the buyer's own code
 * (no commission on self-purchase). A wrong TYPED code is reported back.
 *
 * India checkout, step 1. Validates the buyer's details, saves an
 * india_orders row (status 'created'), creates the matching Cashfree
 * order, and returns the payment_session_id the browser needs to open
 * Cashfree's payment page.
 *
 * The AMOUNT comes only from INDIA_PLANS on the server - the browser just
 * names a plan. Nothing here marks anything as paid; that happens only in
 * the webhook / india-session after Cashfree itself confirms it.
 */
import { getSupabase } from '../_lib/supabase.js';
import {
  INDIA_PLANS, cashfreeConfig, createCashfreeOrder, newOrderId, normalizeIndianPhone,
} from '../_lib/cashfree.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : null) || null;

function siteOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan, name, email, phone, leadId, campaign, ref, refTyped } = req.body || {};
  const planCfg = INDIA_PLANS[plan];
  if (!planCfg) return res.status(400).json({ error: 'Please choose a plan.' });

  const cleanName = clip(name, 80);
  if (!cleanName || cleanName.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  const cleanEmail = clip(email, 120)?.toLowerCase() ?? null;
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const cleanPhone = normalizeIndianPhone(phone);
  if (!cleanPhone) return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });

  let cfg;
  try {
    cfg = (deps.cashfreeConfig || cashfreeConfig)();
  } catch (err) {
    console.error('create-order:', err.message);
    return res.status(503).json({ error: 'Online payment is not available right now. Please message us on WhatsApp.' });
  }

  const supabase = (deps.getSupabase || getSupabase)();

  let refCode = null;
  const wanted = typeof ref === 'string' ? ref.trim().toUpperCase() : '';
  if (/^[A-Z0-9_-]{2,40}$/.test(wanted)) {
    const { data: partner } = await supabase.from('partners').select('code, phone, status').eq('code', wanted).maybeSingle();
    if (partner && partner.status === 'approved' && partner.phone !== cleanPhone) refCode = partner.code;
    else if (refTyped) {
      return res.status(400).json({
        error: partner && partner.phone === cleanPhone
          ? 'You can’t use your own partner code for your own purchase. Please remove it to continue.'
          : 'We couldn’t find that partner code. Please check it, or leave it empty.',
      });
    }
  } else if (refTyped && wanted) {
    return res.status(400).json({ error: 'We couldn’t find that partner code. Please check it, or leave it empty.' });
  }

  const orderId = newOrderId();
  const origin = siteOrigin(req);

  const { error: insErr } = await supabase.from('india_orders').insert({
    order_id: orderId,
    plan,
    amount: planCfg.amount,
    months: planCfg.months,
    customer_name: cleanName,
    customer_email: cleanEmail,
    customer_phone: cleanPhone,
    lead_id: clip(leadId, 100),
    campaign_code: clip(campaign, 100),
    ref_code: refCode,
  });
  if (insErr) {
    console.error('create-order: insert failed', insErr);
    return res.status(500).json({ error: 'Could not start payment. Please try again.' });
  }

  try {
    const cf = await createCashfreeOrder(cfg, {
      order_id: orderId,
      order_amount: planCfg.amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: `in_${cleanPhone}`,
        customer_name: cleanName,
        customer_email: cleanEmail,
        customer_phone: cleanPhone,
      },
      order_meta: {
        return_url: `${origin}/dashboard?order_id={order_id}`,
        notify_url: `${origin}/api/cashfree/webhook`,
      },
      order_note: `Studdy Lab ${planCfg.label}`,
      order_tags: { plan, product: 'studdylab_india' },
    }, deps.fetch);

    await supabase.from('india_orders').update({ cf_order_id: cf.cf_order_id ? String(cf.cf_order_id) : null }).eq('order_id', orderId);

    return res.status(200).json({ orderId, paymentSessionId: cf.payment_session_id, mode: cfg.env });
  } catch (err) {
    console.error('create-order: Cashfree error', err.message, err.cashfree ?? '');
    await supabase.from('india_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('order_id', orderId);
    return res.status(502).json({ error: 'Could not start payment. Please try again in a minute.' });
  }
}
