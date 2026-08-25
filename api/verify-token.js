module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(401).json({ error: 'Invalid or expired link. Please log in again.' });
};
