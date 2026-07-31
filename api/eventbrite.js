export default async function handler(req, res) {
  const params = new URLSearchParams(req.query).toString();
  const auth = req.headers['authorization'] ?? '';

  try {
    const response = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?${params}`,
      { headers: { Authorization: auth } },
    );
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(response.status).json(data);
  } catch {
    res.status(500).json({ error: 'proxy error' });
  }
}
