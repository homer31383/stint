// Shape of Olinda's GET /api/feed/holdings, and a strict picker that copies
// only the agreed fields. Used by api/olinda.ts; the type is shared with
// src/tickers/OlindaTab.tsx.

export interface OlindaHolding {
  ticker: string;
  shares: number;
  cost_basis: number;
  market_value: number | null;
  gain_usd: number | null;
  gain_pct: number | null;
  stop_price: number | null;
  stop_type: 'strikeout' | 'trail' | null;
  stop_pct: number | null;
  thesis_grade: 'on_track' | 'weakening' | 'broken' | null;
}

export interface OlindaFeed {
  as_of: string | null;
  paper: true;
  pot_value: number | null;
  return_since_start_pct: number | null;
  olinda_minus_spy_pts: number | null;
  holdings: OlindaHolding[];
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;

/** Returns the whitelisted feed, or null if the body is not a paper feed. */
export function pickFeed(body: unknown): OlindaFeed | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.paper !== true || !Array.isArray(b.holdings)) return null;
  const holdings: OlindaHolding[] = [];
  for (const raw of b.holdings) {
    if (!raw || typeof raw !== 'object') continue;
    const h = raw as Record<string, unknown>;
    const shares = numOrNull(h.shares);
    const cost = numOrNull(h.cost_basis);
    if (typeof h.ticker !== 'string' || !/^[A-Z0-9.\-]{1,12}$/.test(h.ticker) || shares === null || cost === null) continue;
    holdings.push({
      ticker: h.ticker,
      shares,
      cost_basis: cost,
      market_value: numOrNull(h.market_value),
      gain_usd: numOrNull(h.gain_usd),
      gain_pct: numOrNull(h.gain_pct),
      stop_price: numOrNull(h.stop_price),
      stop_type: oneOf(h.stop_type, ['strikeout', 'trail'] as const),
      stop_pct: numOrNull(h.stop_pct),
      thesis_grade: oneOf(h.thesis_grade, ['on_track', 'weakening', 'broken'] as const),
    });
  }
  return {
    as_of: typeof b.as_of === 'string' ? b.as_of : null,
    paper: true,
    pot_value: numOrNull(b.pot_value),
    return_since_start_pct: numOrNull(b.return_since_start_pct),
    olinda_minus_spy_pts: numOrNull(b.olinda_minus_spy_pts),
    holdings,
  };
}
