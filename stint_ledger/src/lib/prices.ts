// Fetches current per-share prices for fund/ETF tickers. Mutual funds (AEPGX,
// ANEFX, DODBX) and ETFs (SPY) are all supported. None of these endpoints send
// CORS headers to browser origins, so every request is also attempted through a
// public CORS proxy. Each ticker is tried against several endpoints in order
// until one returns a usable price; every failed attempt is logged to the
// console with its HTTP status / error so problems can be diagnosed.

export interface PriceFetchOutcome {
  ticker: string;
  price: number | null;
  source: string | null; // label of the strategy that succeeded
  errors: string[]; // per-attempt diagnostics (only populated on failures)
}

export interface PriceResult {
  prices: Record<string, number>; // ticker (upper) -> price
  failed: string[]; // tickers that could not be resolved
  skipped: string[]; // non-ticker holdings (CASH etc.) that were not fetched
  outcomes: PriceFetchOutcome[];
}

const FETCH_TIMEOUT_MS = 6000;
const DELAY_BETWEEN_FETCHES_MS = 2500;
const RETRY_DELAY_MS = 2000;

// Generic cash-like labels people type into the ticker column that are not
// quotable symbols. These are silently skipped (not reported as failures).
const SKIP_TICKERS = new Set(['CASH', 'MONEY MARKET', 'MM', 'HYS', 'SAVINGS', 'CHECKING', 'CD']);

// Real fund/ETF symbols: letters (optionally with . or -), no spaces, max 10 chars.
function isFetchable(ticker: string): boolean {
  return !SKIP_TICKERS.has(ticker) && /^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round2(n: unknown): number | null {
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
    return Math.round(n * 100) / 100;
  }
  return null;
}

// US mutual funds: 5-letter symbols ending in X (AEPGX, ANEFX, DODBX). Used to
// decide whether the Google Finance :MUTF fallback applies.
function isMutualFund(ticker: string): boolean {
  return /^[A-Z]{5}$/.test(ticker) && ticker.endsWith('X');
}

type Parser = (text: string) => number | null;

function parseYahooChart(text: string): number | null {
  const json = JSON.parse(text);
  const result = json?.chart?.result?.[0];
  const direct = round2(result?.meta?.regularMarketPrice);
  if (direct != null) return direct;
  // Fallback: last non-null close in the timeseries (mutual funds price once a
  // day, so regularMarketPrice can lag until the NAV posts after close).
  const closes = result?.indicators?.quote?.[0]?.close;
  if (Array.isArray(closes)) {
    for (let i = closes.length - 1; i >= 0; i--) {
      const c = round2(closes[i]);
      if (c != null) return c;
    }
  }
  return null;
}

function parseYahooQuote(text: string): number | null {
  const json = JSON.parse(text);
  const r = json?.quoteResponse?.result?.[0];
  return round2(r?.regularMarketPrice);
}

function parseGoogle(text: string): number | null {
  // Price renders in <div class="YMlKec fxKbKc">$83.64</div>.
  const m = text.match(/class="YMlKec fxKbKc">[^0-9-]*([\d,]+\.\d+)/);
  if (m) return round2(Number(m[1].replace(/,/g, '')));
  return null;
}

// Some funds are listed on Yahoo under a symbol different from the one held.
// Map a held ticker to the symbol(s) to query, tried in order. Only list
// symbols for the SAME fund AND share class — a different share class has a
// different NAV and would silently report a wrong price.
const SYMBOL_ALIASES: Record<string, string[]> = {
  // ANEFX (American Funds The New Economy Fund Class A) is a valid Yahoo symbol,
  // so no alias is needed. NEWFX is a *different* fund (New World Fund) — do not
  // add it here. If Yahoo ever drops ANEFX, add the confirmed replacement.
};

function symbolsToTry(ticker: string): string[] {
  return SYMBOL_ALIASES[ticker] ?? [ticker];
}

interface Endpoint {
  label: string;
  target: string;
  parser: Parser;
}

function endpointsFor(ticker: string): Endpoint[] {
  const enc = encodeURIComponent(ticker);
  const eps: Endpoint[] = [
    {
      label: 'yahoo-chart-q1',
      target: `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?range=5d&interval=1d`,
      parser: parseYahooChart,
    },
    {
      label: 'yahoo-chart-q2',
      target: `https://query2.finance.yahoo.com/v8/finance/chart/${enc}?range=5d&interval=1d`,
      parser: parseYahooChart,
    },
    {
      label: 'yahoo-quote-v7',
      target: `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${enc}`,
      parser: parseYahooQuote,
    },
  ];
  if (isMutualFund(ticker)) {
    eps.push({
      label: 'google-mutf',
      target: `https://www.google.com/finance/quote/${enc}:MUTF`,
      parser: parseGoogle,
    });
  }
  return eps;
}

// Each target URL is attempted directly (fast CORS rejection if disallowed) and
// then through CORS proxies that relay the request from their own origin.
function withProxies(target: string): { url: string; via: string }[] {
  return [
    { url: target, via: 'direct' },
    { url: `https://corsproxy.io/?url=${encodeURIComponent(target)}`, via: 'corsproxy' },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`, via: 'allorigins' },
  ];
}

async function tryUrl(url: string, parser: Parser, label: string, errors: string[]): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      let body = '';
      try { body = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      errors.push(`${label} [${url}]: HTTP ${res.status} ${res.statusText} — ${body}`);
      return null;
    }
    const text = await res.text();
    let price: number | null;
    try {
      price = parser(text);
    } catch (e) {
      errors.push(`${label} [${url}]: parse error (${e instanceof Error ? e.message : String(e)}) — ${text.slice(0, 200)}`);
      return null;
    }
    if (price == null) {
      errors.push(`${label} [${url}]: no price in response — ${text.slice(0, 200)}`);
      return null;
    }
    return price;
  } catch (e) {
    // A CORS rejection surfaces here as a TypeError ("Failed to fetch").
    const reason = e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : `${e.name}: ${e.message}`) : String(e);
    errors.push(`${label} [${url}]: ${reason}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function attemptAll(ticker: string, errors: string[]): Promise<PriceFetchOutcome | null> {
  for (const symbol of symbolsToTry(ticker)) {
    for (const ep of endpointsFor(symbol)) {
      for (const { url, via } of withProxies(ep.target)) {
        const label = `${ep.label}/${via}${symbol !== ticker ? ` (as ${symbol})` : ''}`;
        const price = await tryUrl(url, ep.parser, label, errors);
        if (price != null) {
          console.debug(`[prices] ${ticker} = ${price} via ${label} ${url}`);
          return { ticker, price, source: label, errors };
        }
      }
    }
  }
  return null;
}

async function fetchOne(ticker: string): Promise<PriceFetchOutcome> {
  const errors: string[] = [];
  const first = await attemptAll(ticker, errors);
  if (first) return first;
  // Proxy rate limiting is intermittent — one retry after a pause usually works.
  errors.push(`retrying ${ticker} after ${RETRY_DELAY_MS}ms`);
  await sleep(RETRY_DELAY_MS);
  const second = await attemptAll(ticker, errors);
  if (second) return second;
  console.warn(`[prices] could not fetch ${ticker} — ${errors.length} attempts:\n${errors.join('\n')}`);
  return { ticker, price: null, source: null, errors };
}

export async function fetchPrices(tickers: string[]): Promise<PriceResult> {
  const unique = Array.from(
    new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  );
  const skipped = unique.filter((t) => !isFetchable(t));
  const fetchable = unique.filter(isFetchable);
  if (skipped.length) console.debug(`[prices] skipping non-ticker holdings: ${skipped.join(', ')}`);
  // Sequential with a pause between each ticker: the public CORS proxies
  // rate-limit even back-to-back requests, which surfaces as one (rotating)
  // ticker failing while the others succeed. The delay keeps us under the limit.
  const outcomes: PriceFetchOutcome[] = [];
  for (let i = 0; i < fetchable.length; i++) {
    if (i > 0) await sleep(DELAY_BETWEEN_FETCHES_MS);
    outcomes.push(await fetchOne(fetchable[i]));
  }
  const prices: Record<string, number> = {};
  const failed: string[] = [];
  for (const o of outcomes) {
    if (o.price != null) prices[o.ticker] = o.price;
    else failed.push(o.ticker);
  }
  return { prices, failed, skipped, outcomes };
}
