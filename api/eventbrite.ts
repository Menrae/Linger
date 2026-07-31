// Vercel edge function — proxies Eventbrite API to avoid browser CORS restrictions
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams.toString();
  const auth = req.headers.get('Authorization') ?? '';

  const res = await fetch(
    `https://www.eventbriteapi.com/v3/events/search/?${params}`,
    { headers: { Authorization: auth } },
  );

  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
