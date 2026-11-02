// Vercel serverless function: GET /api/olinda
// Olinda's paper holdings for the /tickers Olinda tab. The caller must be a
// signed-in household member (see ./_lib/household.ts). The Olinda feed
// token lives only in Vercel env OLINDA_FEED_TOKEN (Sensitive) and is sent
// server to server; it never reaches the browser. Olinda's reply is
// re-whitelisted here so only the agreed fields pass through.
//
// OLINDA_FEED_URL is optional and only for testing against an Olinda
// preview; it defaults to production.
//
// req/res are typed loosely on purpose, same as api/tickers.ts.

import { requireHousehold } from './_lib/household.js';
import { pickFeed } from './_lib/olindaFeed.js';

const DEFAULT_FEED_URL = 'https://olinda-one.vercel.app/api/feed/holdings';
const TIMEOUT_MS = 8_000;

function send(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });

  const who = await requireHousehold(req.headers?.authorization);
  if (!who.ok) return send(res, who.status, { error: who.error });

  const token = (process.env.OLINDA_FEED_TOKEN ?? '').trim();
  if (!token) return send(res, 502, { error: 'olinda_unavailable' });

  try {
    const upstream = await fetch(process.env.OLINDA_FEED_URL?.trim() || DEFAULT_FEED_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!upstream.ok) {
      console.error(`olinda feed: upstream status ${upstream.status}`);
      return send(res, 502, { error: 'olinda_unavailable' });
    }
    const feed = pickFeed(await upstream.json());
    if (!feed) {
      console.error('olinda feed: unexpected body shape');
      return send(res, 502, { error: 'olinda_unavailable' });
    }
    return send(res, 200, feed);
  } catch (e) {
    console.error(`olinda feed: ${e instanceof Error ? e.name : 'error'}`);
    return send(res, 502, { error: 'olinda_unavailable' });
  }
}
