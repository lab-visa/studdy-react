/**
 * GET /api/geo
 *
 * Returns the visitor's country as Vercel sees it (x-vercel-ip-country),
 * so the site can decide India vs international pricing without relying
 * on a free third-party IP lookup (which can rate-limit or fail and would
 * then show an Indian visitor US prices).
 *
 * Returns { country: "IN" } style two-letter codes, or { country: null }
 * when the header is missing (e.g. local development). Never stores
 * anything.
 */
export default function handler(req, res) {
  const raw = req.headers['x-vercel-ip-country'];
  const country = typeof raw === 'string' && /^[A-Z]{2}$/.test(raw) ? raw : null;
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({ country });
}
