// Shared Yahoo Finance chart fetcher, used by two callers:
//   1. api/tickers.ts, the Vercel serverless function (production)
//   2. the dev middleware in vite.config.ts (local dev)
// Files under api/_lib are NOT deployed as functions (underscore prefix).
// Keeping the logic here guarantees dev and prod return the same shape.

export interface TickerRow {
  symbol: string;
  ok: boolean;
  price?: number;
  prevClose?: number;
  closes?: number[];
  name?: string; // Yahoo display name (shortName, falling back to longName)
  marketState?: string; // PRE | REGULAR | POST | CLOSED etc, straight from Yahoo
  asOf?: number; // epoch seconds of the last regular market trade
  error?: string;
}

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
// Covers indices (^GSPC), crypto pairs (BTC-USD), futures (GC=F), share
// classes (BRK-A) and foreign listings (300750.SZ).
const SYMBOL_RE = /^[A-Z0-9^.\-=]{1,14}$/i;
const MAX_SYMBOLS = 60;

export function parseSymbols(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const s = part.trim().toUpperCase();
    if (s && SYMBOL_RE.test(s)) seen.add(s);
    if (seen.size >= MAX_SYMBOLS) break;
  }
  return Array.from(seen);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

async function fetchOne(symbol: string): Promise<TickerRow> {
  try {
    const url = `${YAHOO_BASE}${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    const res = await fetch(url, {
      // Yahoo rejects requests with no browser-like user agent from cloud IPs.
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) return { symbol, ok: false, error: `HTTP ${res.status}` };
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    const prevClose = num(meta?.chartPreviousClose) ?? num(meta?.previousClose);
    if (prevClose == null || prevClose === 0) {
      return { symbol, ok: false, error: 'no previous close in response' };
    }
    const rawCloses = result?.indicators?.quote?.[0]?.close;
    const closes: number[] = Array.isArray(rawCloses)
      ? rawCloses.filter((c: unknown): c is number => num(c) != null)
      : [];
    const price = num(meta?.regularMarketPrice) ?? (closes.length ? closes[closes.length - 1] : null);
    if (price == null) return { symbol, ok: false, error: 'no price in response' };
    const name =
      typeof meta?.shortName === 'string' && meta.shortName
        ? meta.shortName
        : typeof meta?.longName === 'string' && meta.longName
          ? meta.longName
          : undefined;
    return {
      symbol,
      ok: true,
      price,
      prevClose,
      closes,
      name,
      marketState: typeof meta?.marketState === 'string' ? meta.marketState : undefined,
      asOf: num(meta?.regularMarketTime) ?? undefined,
    };
  } catch (e) {
    return { symbol, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// All symbols in parallel. A failed symbol becomes an error row, it never
// rejects the whole batch.
export function fetchTickers(symbols: string[]): Promise<TickerRow[]> {
  return Promise.all(symbols.map(fetchOne));
}
