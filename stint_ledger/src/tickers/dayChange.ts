// The Olinda tab's day change: shares x (price - previous close) for every
// holding plus the IWO cash sweep, from the 1D quotes /api/tickers already
// gets from Yahoo. Cash does not move.
//
// Before the open (and overnight) Yahoo's 1D chart already covers the coming
// session, so its previous close equals the last close and the move reads
// $0. Those rows are detected (sessionStart after the last trade) and priced
// from the last two daily closes instead, so the tab shows the last
// session's move with its day ("Fri: +$X"), never a blank or $0.
//
// Pure functions with type-only imports, so tests run under plain node.

import type { TickerRow } from './change';
import type { OlindaFeed } from '../../api/_lib/olindaFeed';

export interface SessionMove {
  perShare: number; // last price minus the previous close
  prevClose: number;
  date: string; // YYYY-MM-DD, New York date of the session the move belongs to
}

const NY = 'America/New_York';

/** YYYY-MM-DD in New York for an instant. */
export function nyDate(epochMs: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(epochMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** True when the 1D row's session has not opened yet, so its previous close is the last close itself. */
export function needsDaily(row: TickerRow): boolean {
  return row.ok && row.asOf != null && row.sessionStart != null && row.sessionStart > row.asOf;
}

/**
 * The move of the session the 1D row's last trade belongs to.
 * `daily` (closes from a 1M daily chart) is used only when needsDaily(row);
 * without it, or if its closes do not line up with the last price, the
 * result is null rather than a wrong figure.
 */
export function sessionMove(row: TickerRow | undefined, daily?: TickerRow): SessionMove | null {
  if (!row || !row.ok || row.price == null || row.asOf == null) return null;
  const date = nyDate(row.asOf * 1000);
  if (!needsDaily(row)) {
    if (row.prevClose == null || row.prevClose <= 0) return null;
    return { perShare: row.price - row.prevClose, prevClose: row.prevClose, date };
  }
  const closes = daily?.ok ? daily.closes ?? [] : [];
  // The last session's close is the last daily close, or the one before it if
  // Yahoo has already started a bar for the coming day. It must match the 1D price.
  for (let i = closes.length - 1; i >= Math.max(1, closes.length - 2); i--) {
    if (Math.abs(closes[i] - row.price) <= row.price * 0.002) {
      const prev = closes[i - 1];
      if (!(prev > 0)) return null;
      return { perShare: row.price - prev, prevClose: prev, date };
    }
  }
  return null;
}

/** "Today" for today's New York session, the weekday ("Fri") within the past week, otherwise "Oct 23". */
export function sessionLabel(date: string, nowMs: number): string {
  const today = nyDate(nowMs);
  if (date === today) return 'Today';
  const noonUtc = Date.parse(`${date}T12:00:00Z`); // a calendar date, read in UTC so the weekday cannot shift
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - noonUtc) / 86_400_000);
  const opts: Intl.DateTimeFormatOptions = days > 0 && days < 7 ? { weekday: 'short', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' };
  return new Date(noonUtc).toLocaleDateString('en-US', opts);
}

export interface DayTotal {
  change: number; // dollars, holdings plus the sweep
  pctOfPot: number | null; // change over the pot at the previous close (positions at prev close + cash)
  date: string; // the session the total belongs to
  missing: number; // positions left out (no quote, or a quote from an older session)
}

/**
 * Sums the day's move across holdings and the sweep. Only positions priced
 * for the latest session are summed; anything else counts as missing so the
 * total is never silently mixed across days. The sweep counts as missing if
 * the feed has none.
 */
export function dayTotal(feed: Pick<OlindaFeed, 'holdings' | 'sweep' | 'cash_usd'>, moves: Record<string, SessionMove | null | undefined>): DayTotal | null {
  const items: Array<{ ticker: string; shares: number; fallbackValue: number | null }> = feed.holdings.map((h) => ({ ticker: h.ticker, shares: h.shares, fallbackValue: h.market_value }));
  let missing = 0;
  if (feed.sweep) {
    if (feed.sweep.shares > 0) items.push({ ticker: feed.sweep.ticker, shares: feed.sweep.shares, fallbackValue: null });
  } else {
    missing += 1;
  }
  let date: string | null = null;
  for (const it of items) {
    const m = moves[it.ticker];
    if (m && (date === null || m.date > date)) date = m.date;
  }
  if (date === null) return null;
  let change = 0;
  let base = feed.cash_usd ?? 0;
  let baseKnown = feed.cash_usd !== null && feed.sweep !== null;
  for (const it of items) {
    const m = moves[it.ticker];
    if (m && m.date === date) {
      change += it.shares * m.perShare;
      base += it.shares * m.prevClose;
    } else {
      missing += 1;
      if (it.fallbackValue !== null) base += it.fallbackValue;
      else baseKnown = false;
    }
  }
  return { change, pctOfPot: baseKnown && base > 0 ? (change / base) * 100 : null, date, missing };
}
