export default async function handler(req, res) {
  // Allow calls from any origin (your Vercel app)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Build GAS URL with all query params forwarded
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbyR7-kebPeQ-DOaXXBSiTmwj1-j3mBBEXz38PBb2TGLFqLoo34LX05yz089WjneaAXY/exec';
  const queryString = req.url.split('?')[1] || '';
  const url     = `${GAS_URL}?${queryString}`;

  try {
    const gasRes = await fetch(url, { redirect: 'follow' });
    const text   = await gasRes.text();

    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { error: 'Invalid JSON from server', raw: text.slice(0, 200) }; }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
