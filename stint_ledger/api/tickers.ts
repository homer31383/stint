// Vercel serverless function: GET /api/tickers?symbols=^GSPC,^DJI,VTI
// Exists because Yahoo Finance sends no CORS headers, so the browser cannot
// call it directly. In local dev the same route is served by the middleware
// in vite.config.ts using the same shared logic from ./_lib/yahoo.js.
//
// req/res are typed loosely on purpose: this file sits outside tsconfig's
// include (src only) and we avoid adding @vercel/node just for two types.

import { fetchTickers, parseSymbols } from './_lib/yahoo.js';

const CACHE_TTL_MS = 60_000;

// In-memory cache per warm function instance, so a burst of refocuses does
// not hammer Yahoo. The s-maxage header below adds CDN-level caching on top.
const cache = new Map<string, { at: number; body: string }>();

export default async function handler(req: any, res: any) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const symbols = parseSymbols(url.searchParams.get('symbols'));

  res.setHeader('Content-Type', 'application/json');
  if (symbols.length === 0) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'symbols query param required, comma separated' }));
    return;
  }

  const key = symbols.join(',');
  const hit = cache.get(key);
  let body: string;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    body = hit.body;
  } else {
    const tickers = await fetchTickers(symbols);
    body = JSON.stringify({ tickers });
    cache.set(key, { at: Date.now(), body });
  }

  res.statusCode = 200;
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.end(body);
}
