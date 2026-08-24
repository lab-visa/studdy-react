module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  /* TODO: save to Supabase + notify via GHL */
  console.log('Cancellation request:', req.body);
  return res.status(200).json({ ok: true });
};
