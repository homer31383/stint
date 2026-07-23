// Vercel serverless function: POST /api/investigate
// Body: { tickers: [{ symbol, name, changePercent, timeframe }] } (max 4).
// Returns { analysis: string } from Claude Haiku with web search enabled.
// Searches take 10-30s, so vercel.json raises this function's maxDuration.
//
// This is the tickers feature's first server-side secret: ANTHROPIC_API_KEY
// lives only in the Vercel env (vercel env add ANTHROPIC_API_KEY production).
// The client stays auth-free.
//
// req/res are typed loosely on purpose, same as api/tickers.ts: this file
// sits outside tsconfig's include and we avoid adding @vercel/node.

import {
  parseInvestigateBody,
  runInvestigation,
  extractErrorMessage,
} from './_lib/investigate.js';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

// Light per-IP rate limit. In-memory per warm function instance, so it is
// best-effort rather than exact, which is fine for a single-user app.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'POST only' }));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }));
    return;
  }

  const ip =
    String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (rateLimited(ip)) {
    res.statusCode = 429;
    res.end(JSON.stringify({ error: 'Too many investigations, wait a minute' }));
    return;
  }

  // Vercel parses JSON bodies into req.body; accept a raw string too.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const tickers = parseInvestigateBody(body);
  if (!tickers) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'body must be { tickers: [...] } with 1-4 entries' }));
    return;
  }

  try {
    const analysis = await runInvestigation(tickers, apiKey);
    res.statusCode = 200;
    // No caching: every investigation is fresh.
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ analysis }));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: extractErrorMessage(e) }));
  }
}
