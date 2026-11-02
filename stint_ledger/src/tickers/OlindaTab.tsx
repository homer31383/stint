// The /tickers Olinda tab: Olinda's PAPER holdings, read through
// /api/olinda. This module is lazy loaded by TickersPage only when the tab
// opens, so the Supabase client (needed here only to read the signed-in
// session from this origin's localStorage) never loads on the plain
// Tickers tab. The Olinda feed token stays on the server.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
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
const PILL_SCALE = 25; // color ramp denominator: a 25% move (the strikeout) reads strong

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

function HoldingRow({ h, last }: { h: OlindaHolding; last: boolean }) {
  return (
    <div className="py-2.5" style={{ borderBottom: last ? 'none' : `1px solid ${CARD_BORDER}` }}>
      <div className="flex items-center justify-between gap-3">
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 17, color: TEXT }}>{h.ticker}</span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-sm" style={{ color: TEXT }}>
            {h.market_value === null ? '-' : usd(h.market_value)}
          </span>
          {h.gain_pct !== null && (
            <span className="rounded-full font-mono text-xs font-semibold px-2 py-0.5" style={pillStyle(h.gain_pct, PILL_SCALE, false)}>
              {signedPct(h.gain_pct)}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 font-mono mt-0.5" style={{ fontSize: 11, color: TEXT_DIM }}>
        <span className="min-w-0 truncate">
          {shares(h.shares)} sh · cost {usd(h.cost_basis)}
        </span>
        <span className="shrink-0" style={{ color: signColor(h.gain_usd) }}>
          {h.gain_usd === null ? '' : `${h.gain_usd >= 0 ? '+' : ''}${usd(h.gain_usd)}`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 font-mono mt-1" style={{ fontSize: 11, color: TEXT_DIM }}>
        <span className="min-w-0 truncate">{stopText(h)}</span>
        <GradeChip grade={h.thesis_grade} />
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

export default function OlindaTab() {
  const [state, setState] = useState<State>({ kind: 'loading' });

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
    } catch {
      setState({ kind: 'unavailable' });
    }
  }, []);

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
  const asOf = feed.as_of
    ? new Date(feed.as_of).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="mt-3">
      <div className="flex justify-center mb-3">
        <PaperBadge size="md" />
      </div>

      <div className="px-5 py-4" style={cardStyle}>
        <div className="uppercase" style={{ color: TEXT_DIM, fontSize: 10, letterSpacing: '0.14em' }}>Paper pot value</div>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 34, lineHeight: 1.15, color: TEXT }}>
          {feed.pot_value === null ? '-' : usd(feed.pot_value, 0)}
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
        <PaperBadge />
      </div>
      <div className="px-4" style={cardStyle}>
        {feed.holdings.length === 0 ? (
          <div className="py-5 text-sm italic text-center" style={{ color: TEXT_DIM }}>No open positions.</div>
        ) : (
          feed.holdings.map((h, i) => <HoldingRow key={h.ticker} h={h} last={i === feed.holdings.length - 1} />)
        )}
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
