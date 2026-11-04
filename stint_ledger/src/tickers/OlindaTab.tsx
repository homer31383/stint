// The /tickers Olinda tab: Olinda's PAPER holdings, read through
// /api/olinda. This module is lazy loaded by TickersPage only when the tab
// opens, so the Supabase client (needed here only to read the signed-in
// session from this origin's localStorage) never loads on the plain
// Tickers tab. The Olinda feed token stays on the server.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { changeFor, type TickerRow } from './change';
import { dayTotal, needsDaily, sessionLabel, sessionMove, type SessionMove } from './dayChange';
import type { OlindaFeed, OlindaHolding } from '../../api/_lib/olindaFeed';
import {
  CARD_BG,
  CARD_BORDER,
  CARD_RADIUS,
  CARD_SHADOW,
  TEXT,
  TEXT_DIM,
  ACCENT,
  ACCENT_BG,
  STONE,
  GAIN_TEXT,
  LOSS_TEXT,
  SEG_ACTIVE_BG,
  SEG_ACTIVE_SHADOW,
  PAPER_BADGE_BG,
  PAPER_BADGE_TEXT,
  PAPER_BADGE_BORDER,
  pillStyle,
} from './theme';

const OLINDA_URL = 'https://olinda-one.vercel.app';
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const PILL_SCALE = 25; // since-start pill: a 25% move (the strikeout) reads strong

// Olinda tickers use a dot for share classes (BRK.B); Yahoo uses a dash.
const yahooSymbol = (ticker: string) => ticker.replace(/\./g, '-');

type State =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' }
  | { kind: 'ok'; feed: OlindaFeed };

const usd = (v: number, digits = 2) =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const signedPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const signedPts = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`;
const signColor = (v: number | null) => (v === null || v === 0 ? TEXT_DIM : v > 0 ? GAIN_TEXT : LOSS_TEXT);
const signedUsd = (v: number, digits = 2) => `${v >= 0 ? '+' : '-'}${usd(Math.abs(v), digits)}`;

// A position's day move: undefined = still loading, null = no figure.
type DayMove = SessionMove | null | undefined;

async function fetchRows(symbols: string[], range: string): Promise<Map<string, TickerRow>> {
  const res = await fetch(`/api/tickers?symbols=${encodeURIComponent(symbols.join(','))}&range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { tickers?: TickerRow[] };
  return new Map((json.tickers ?? []).map((r) => [r.symbol, r]));
}

function DayFigure({ move, shares, now }: { move: DayMove; shares: number; now: number }) {
  if (move === undefined) return <span style={{ color: STONE }}>today ...</span>;
  if (move === null) return <span style={{ color: STONE }}>today -</span>;
  const v = shares * move.perShare;
  const label = sessionLabel(move.date, now);
  return (
    <span style={{ color: signColor(v) }} title={`Move since the previous close, session of ${move.date}`}>
      {label === 'Today' ? 'today' : label} {signedUsd(v)}
    </span>
  );
}
const shares = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 4 });

const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: CARD_RADIUS,
  boxShadow: CARD_SHADOW,
};

function PaperBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className="inline-flex items-center rounded-full font-semibold uppercase"
      style={{
        background: PAPER_BADGE_BG,
        color: PAPER_BADGE_TEXT,
        border: `1px solid ${PAPER_BADGE_BORDER}`,
        fontSize: size === 'sm' ? 8.5 : 10.5,
        letterSpacing: '0.12em',
        padding: size === 'sm' ? '0 5px' : '3px 10px',
        lineHeight: size === 'sm' ? '14px' : '16px',
      }}
    >
      {size === 'sm' ? 'Paper' : 'Paper trading, not real money'}
    </span>
  );
}

const GRADE_LABEL: Record<NonNullable<OlindaHolding['thesis_grade']>, string> = {
  on_track: 'On track',
  weakening: 'Weakening',
  broken: 'Broken',
};

function GradeChip({ grade }: { grade: OlindaHolding['thesis_grade'] }) {
  const style =
    grade === 'on_track'
      ? { background: ACCENT_BG, color: GAIN_TEXT }
      : grade === 'weakening'
        ? { background: PAPER_BADGE_BG, color: PAPER_BADGE_TEXT }
        : grade === 'broken'
          ? { background: '#f5ded2', color: LOSS_TEXT }
          : { background: 'rgba(255,255,255,0.7)', color: STONE };
  return (
    <span
      className="shrink-0 rounded-full uppercase font-semibold"
      style={{ ...style, fontSize: 9, letterSpacing: '0.1em', padding: '1px 7px' }}
    >
      {grade ? GRADE_LABEL[grade] : 'Ungraded'}
    </span>
  );
}

function stopText(h: OlindaHolding): string {
  if (h.stop_price === null) return 'no stop recorded';
  const rule = h.stop_type && h.stop_pct !== null ? ` (${h.stop_pct}% ${h.stop_type})` : '';
  return `stop ${usd(h.stop_price)}${rule}`;
}

function HoldingRow({ h, range, scale, last, day, now }: { h: OlindaHolding; range: number | null | undefined; scale: number; last: boolean; day: DayMove; now: number }) {
  return (
    <div className="py-2.5" style={{ borderBottom: last ? 'none' : `1px solid ${CARD_BORDER}` }}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 min-w-0">
          <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 17, color: TEXT }}>{h.ticker}</span>
          <GradeChip grade={h.thesis_grade} />
        </span>
        {/* Primary number, like the Tickers tab: % over the selected range. */}
        {range === undefined ? (
          <span className="font-mono text-xs" style={{ color: STONE }}>...</span>
        ) : range === null ? (
          <span className="font-mono text-xs" style={{ color: STONE }}>-</span>
        ) : (
          <span className="shrink-0 rounded-full font-mono text-xs font-semibold px-2 py-0.5" style={pillStyle(range, scale, false)}>
            {signedPct(range)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 font-mono mt-0.5" style={{ fontSize: 11, color: TEXT_DIM }}>
        <span className="min-w-0 truncate">
          {shares(h.shares)} sh · cost {usd(h.cost_basis)}
        </span>
        <span className="shrink-0">
          <DayFigure move={day} shares={h.shares} now={now} />
          <span style={{ color: TEXT }}> · {h.market_value === null ? '-' : usd(h.market_value)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 font-mono mt-0.5" style={{ fontSize: 11, color: TEXT_DIM }}>
        <span className="min-w-0 truncate">{stopText(h)}</span>
        {h.gain_pct !== null && (
          <span className="shrink-0" style={{ color: signColor(h.gain_pct) }}>
            {signedPct(h.gain_pct)}
            {h.gain_usd !== null ? ` (${h.gain_usd >= 0 ? '+' : ''}${usd(h.gain_usd)})` : ''} entry
          </span>
        )}
      </div>
    </div>
  );
}

function Message({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-6 mt-3 text-center" style={cardStyle}>
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18, color: TEXT }}>{title}</div>
      <div className="text-sm mt-1.5" style={{ color: TEXT_DIM }}>{body}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const primaryButton: React.CSSProperties = { background: SEG_ACTIVE_BG, color: '#ffffff', boxShadow: SEG_ACTIVE_SHADOW };

interface OlindaTabProps {
  timeframe: string; // a TickersPage timeframe key, sent to /api/tickers as ?range=
  periodLabel: string; // e.g. "Past week"
  band: number; // the 1D color band, shared with the Tickers tab
}

export default function OlindaTab({ timeframe, periodLabel, band }: OlindaTabProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Range prices from /api/tickers (Yahoo), keyed by Olinda ticker. Holdings
  // with no entry yet render a placeholder; a failed fetch renders "-".
  const [prices, setPrices] = useState<{ key: string; rows: Record<string, TickerRow> } | null>(null);
  const [pricesFailed, setPricesFailed] = useState(false);
  const tickers = state.kind === 'ok' ? state.feed.holdings.map((h) => h.ticker) : [];
  const tickersKey = tickers.join(',');
  // Day change: 1D quotes for the holdings plus the sweep, whatever the
  // timeframe (a longer range's reference is the period start, not the
  // previous close). Refetched on every feed load so it follows the day.
  const [feedLoads, setFeedLoads] = useState(0);
  const sweepTicker = state.kind === 'ok' && state.feed.sweep && state.feed.sweep.shares > 0 ? state.feed.sweep.ticker : null;
  const dayKey = [...tickers, ...(sweepTicker ? [sweepTicker] : [])].join(',');
  const [day, setDay] = useState<{ key: string; moves: Record<string, SessionMove | null> } | null>(null);
  const [dayFailed, setDayFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setState({ kind: 'signed_out' });
        return;
      }
      const res = await fetch('/api/olinda', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (res.status === 401) return setState({ kind: 'signed_out' });
      if (res.status === 403) return setState({ kind: 'forbidden' });
      if (!res.ok) return setState({ kind: 'unavailable' });
      const feed = (await res.json()) as OlindaFeed;
      if (feed?.paper !== true || !Array.isArray(feed.holdings)) return setState({ kind: 'unavailable' });
      setState({ kind: 'ok', feed });
      setFeedLoads((n) => n + 1);
    } catch {
      setState({ kind: 'unavailable' });
    }
  }, []);

  // Range prices: refetched when the holdings or the timeframe change.
  // /api/tickers caches for 60s, so tab switching stays cheap.
  useEffect(() => {
    if (!tickersKey) return;
    const key = `${timeframe}|${tickersKey}`;
    let cancelled = false;
    setPricesFailed(false);
    const symbols = tickersKey.split(',').map(yahooSymbol).join(',');
    fetch(`/api/tickers?symbols=${encodeURIComponent(symbols)}&range=${encodeURIComponent(timeframe)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: { tickers?: TickerRow[] }) => {
        if (cancelled) return;
        const bySymbol = new Map((json.tickers ?? []).map((r) => [r.symbol, r]));
        const rows: Record<string, TickerRow> = {};
        for (const t of tickersKey.split(',')) {
          const r = bySymbol.get(yahooSymbol(t));
          if (r) rows[t] = r;
        }
        setPrices({ key, rows });
      })
      .catch(() => {
        if (!cancelled) setPricesFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [timeframe, tickersKey]);

  // Day moves. Rows whose session has not opened yet (before the open,
  // overnight, weekends) are priced from daily closes so they show the last
  // session's move instead of $0.
  useEffect(() => {
    if (!dayKey) return;
    let cancelled = false;
    setDayFailed(false);
    const olinda = dayKey.split(',');
    (async () => {
      const rows = await fetchRows(olinda.map(yahooSymbol), '1D');
      const stale = olinda.filter((t) => {
        const r = rows.get(yahooSymbol(t));
        return r ? needsDaily(r) : false;
      });
      const daily = stale.length ? await fetchRows(stale.map(yahooSymbol), '1M').catch(() => new Map<string, TickerRow>()) : new Map<string, TickerRow>();
      const moves: Record<string, SessionMove | null> = {};
      for (const t of olinda) moves[t] = sessionMove(rows.get(yahooSymbol(t)), daily.get(yahooSymbol(t)));
      if (!cancelled) setDay({ key: dayKey, moves });
    })().catch(() => {
      if (!cancelled) setDayFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [dayKey, feedLoads]);

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  if (state.kind === 'loading') {
    return <div className="text-xs italic mt-3 px-1" style={{ color: TEXT_DIM }}>Loading Olinda...</div>;
  }
  if (state.kind === 'signed_out') {
    return (
      <Message
        title="Sign in to see Olinda"
        body="The Olinda tab needs your Stint Ledger sign in. Sign in there, then come back to /tickers."
        action={
          <a href="/" className="inline-block rounded-full px-5 py-2 text-sm font-semibold" style={primaryButton}>
            Sign in
          </a>
        }
      />
    );
  }
  if (state.kind === 'forbidden') {
    return <Message title="Not available" body="This account cannot view Olinda." />;
  }
  if (state.kind === 'unavailable') {
    return (
      <Message
        title="Olinda unavailable"
        body="Olinda did not answer just now. Your tickers are unaffected."
        action={
          <button onClick={() => { setState({ kind: 'loading' }); load(); }} className="rounded-full px-5 py-2 text-sm font-semibold" style={primaryButton}>
            Try again
          </button>
        }
      />
    );
  }

  const { feed } = state;
  const is1D = timeframe === '1D';
  const current = prices && prices.key === `${timeframe}|${tickersKey}` ? prices.rows : null;
  // undefined = still loading, null = no figure for this holding.
  const rangeFor = (ticker: string): number | null | undefined => {
    if (pricesFailed) return null;
    if (!current) return undefined;
    const r = current[ticker];
    return r ? changeFor(r, is1D)?.pct ?? null : null;
  };
  // Same color rule as the Tickers tab: the band on 1D, the biggest mover otherwise.
  let rangeScale = band;
  if (!is1D && current) {
    let maxAbs = 0;
    for (const t of tickers) {
      const v = rangeFor(t);
      if (typeof v === 'number') maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    rangeScale = Math.max(maxAbs, 0.01);
  }
  const asOf = feed.as_of
    ? new Date(feed.as_of).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  const now = Date.now();
  const dayMoves = day && day.key === dayKey ? day.moves : null;
  const dayFor = (ticker: string): DayMove => (dayFailed ? null : dayMoves ? dayMoves[ticker] ?? null : undefined);
  const total = dayMoves ? dayTotal(feed, dayMoves) : null;
  const totalLabel = total ? sessionLabel(total.date, now) : 'Today';
  const sweepMove = sweepTicker ? dayFor(sweepTicker) : null;

  return (
    <div className="mt-3">
      <div className="flex justify-center mb-3">
        <PaperBadge size="md" />
      </div>

      <div className="px-5 py-4" style={cardStyle}>
        <div className="uppercase" style={{ color: TEXT_DIM, fontSize: 10, letterSpacing: '0.14em' }}>Paper pot value</div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 34, lineHeight: 1.15, color: TEXT }}>
            {feed.pot_value === null ? '-' : usd(feed.pot_value, 0)}
          </span>
          {/* The day's move of the whole pot: holdings plus the IWO sweep; cash does not move. */}
          {dayFailed || (dayMoves && !total) ? (
            <span className="font-mono text-sm" style={{ color: STONE }}>Today: unavailable</span>
          ) : !total ? (
            <span className="font-mono text-sm" style={{ color: STONE }}>{dayKey ? 'Today: ...' : 'Today: no positions'}</span>
          ) : (
            <span className="font-mono text-sm font-semibold" style={{ color: signColor(total.change) }} title={`Session of ${total.date}`}>
              {totalLabel}: {signedUsd(total.change, 0)}
              {total.pctOfPot !== null ? ` (${signedPct(total.pctOfPot)} of pot)` : ''}
              {total.missing > 0 ? <span className="font-normal" style={{ color: STONE }}> · {total.missing} not priced</span> : null}
            </span>
          )}
        </div>
        <div className="font-mono mt-0.5" style={{ fontSize: 11, color: TEXT_DIM }}>
          {feed.sweep ? (
            <>
              {feed.sweep.ticker} cash sweep {shares(feed.sweep.shares)} sh
              {sweepTicker ? (
                <>
                  {' · '}
                  <DayFigure move={sweepMove} shares={feed.sweep.shares} now={now} />
                </>
              ) : null}
            </>
          ) : (
            'Cash sweep not reported'
          )}
          {feed.cash_usd !== null ? ` · cash ${usd(feed.cash_usd)}` : ''}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {feed.return_since_start_pct !== null && (
            <span className="rounded-full font-mono text-xs font-semibold px-2 py-0.5" style={pillStyle(feed.return_since_start_pct, PILL_SCALE, false)}>
              {signedPct(feed.return_since_start_pct)} since start
            </span>
          )}
          {feed.olinda_minus_spy_pts !== null && (
            <span className="font-mono text-xs" style={{ color: signColor(feed.olinda_minus_spy_pts) }}>
              {signedPts(feed.olinda_minus_spy_pts)} vs SPY
            </span>
          )}
        </div>
        {asOf && <div className="text-xs italic mt-2" style={{ color: TEXT_DIM }}>As of {asOf}</div>}
      </div>

      <div className="flex items-center justify-between mt-5 mb-1.5 px-1">
        <span className="uppercase" style={{ color: TEXT_DIM, fontSize: 10, letterSpacing: '0.14em' }}>
          Paper holdings · {feed.holdings.length}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs italic" style={{ color: TEXT_DIM }}>{periodLabel}</span>
          <PaperBadge />
        </span>
      </div>
      <div className="px-4" style={cardStyle}>
        {feed.holdings.length === 0 ? (
          <div className="py-5 text-sm italic text-center" style={{ color: TEXT_DIM }}>No open positions.</div>
        ) : (
          feed.holdings.map((h, i) => (
            <HoldingRow key={h.ticker} h={h} range={rangeFor(h.ticker)} scale={rangeScale} last={i === feed.holdings.length - 1} day={dayFor(h.ticker)} now={now} />
          ))
        )}
      </div>

      <div className="text-xs italic mt-2 px-1" style={{ color: TEXT_DIM }}>
        Pill: {periodLabel}, the stock&apos;s own move (Yahoo prices{pricesFailed ? ', unavailable right now' : ''}).
        Today: dollars made or lost since the previous close (shares x price move); before the open and on weekends, the last session, labelled with its day.
        Entry: Olinda&apos;s gain since it bought.
      </div>

      <div className="text-center mt-4">
        <a
          href={OLINDA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium underline underline-offset-4"
          style={{ color: ACCENT }}
        >
          Open Olinda for detail
        </a>
      </div>
    </div>
  );
}
