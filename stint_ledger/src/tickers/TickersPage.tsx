// Standalone market watch page at /tickers. Deliberately isolated: no
// Supabase, no auth, no imports from the finance views or shared app
// components, and the watchlist persists to localStorage only, never the
// app's IndexedDB or sync layer. See src/main.tsx for the route branch.
//
// Visual language: biophilic (moss, clay, sand) with 3D percent pills. All
// colors and the intensity ramp live in ./theme.ts.
//
// Kept dumb on purpose. TODO if ever wanted: auto refresh interval. Not
// building it now.

import { useCallback, useEffect, useRef, useState } from 'react';
import { TickerSparkline, BAND } from './TickerSparkline';
import {
  PAGE_BG,
  PAGE_GRADIENT,
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
  SEG_BG,
  SEG_SHADOW,
  SEG_ACTIVE_BG,
  SEG_ACTIVE_SHADOW,
  pillStyle,
  cardShadow,
} from './theme';

const DEFAULT_WATCHLIST = [
  '^GSPC', '^DJI', '^IXIC', '^RUT',
  'SPY', 'AEPGX', 'DODBX', 'ANEFX',
  'BTC-USD', 'ETH-USD',
  'DIS', 'NVDA', 'AMZN', 'AAPL', 'TSLA',
  'SPCX', 'BZ=F', 'CL=F', 'OMC', 'TSM', 'EA',
  'QTUM', 'OKLO', 'BOTZ', 'COIN',
  'ARKVX', 'DXYZ', 'SSDLX',
  'BRK-A', 'CRCL', 'GOOG', 'VST',
  '300750.SZ', 'GC=F', 'META', 'DXCM', 'LTBR',
];

const STORAGE_KEY = 'tickers-watchlist';
const BAND_STORAGE_KEY = 'tickers-band';
const BAND_OPTIONS = [1, 2, 3, 5, 10];

function loadBand(): number {
  try {
    const parsed = Number(localStorage.getItem(BAND_STORAGE_KEY));
    if (BAND_OPTIONS.includes(parsed)) return parsed;
  } catch {
    // fall through to default
  }
  return BAND;
}

// Keys are sent to /api/tickers as ?range= and mapped to Yahoo ranges there.
const TIMEFRAMES = ['1D', '1W', '1M', '6M', 'YTD', '1Y', '5Y', 'All'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const PERIOD_LABELS: Record<Timeframe, string | null> = {
  '1D': null, // 1D uses the market open/closed label instead
  '1W': 'Past week',
  '1M': 'Past month',
  '6M': 'Past 6 months',
  YTD: 'Year to date',
  '1Y': 'Past year',
  '5Y': 'Past 5 years',
  All: 'All time',
};

// Change over the selected timeframe. On 1D the reference is the previous
// close; on longer ranges it is the first close in the period, so the
// percent change is (last - first) / first.
function changeFor(row: TickerRow, is1D: boolean): { pct: number; series: number[]; ref: number } | null {
  if (!row.ok || row.price == null) return null;
  const closes = row.closes ?? [];
  const ref = is1D ? row.prevClose : closes.length > 0 ? closes[0] : null;
  if (ref == null || ref <= 0) return null;
  return {
    pct: ((row.price - ref) / ref) * 100,
    series: closes.map((c) => ((c - ref) / ref) * 100),
    ref,
  };
}

interface TickerRow {
  symbol: string;
  ok: boolean;
  price?: number;
  prevClose?: number;
  closes?: number[];
  name?: string;
  marketState?: string;
  asOf?: number;
  afterHoursPrice?: number;
  afterHoursPct?: number;
  error?: string;
}

function isIndexSymbol(s: string): boolean {
  return s.startsWith('^');
}

// Display rule: indexes first, then everything else, each in watchlist order.
function grouped(list: string[]): string[] {
  return [...list.filter(isIndexSymbol), ...list.filter((s) => !isIndexSymbol(s))];
}

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length && parsed.every((s) => typeof s === 'string')) {
        return parsed;
      }
    }
  } catch {
    // fall through to defaults
  }
  return [...DEFAULT_WATCHLIST];
}

function useTickersHead() {
  useEffect(() => {
    // One index.html serves the whole SPA, so this route swaps its own head
    // tags at runtime. Chrome reads whichever manifest link is present when
    // the user taps "Add to Home screen", so installing while on /tickers
    // picks up the Tickers manifest (own name, icon, start_url, scope).
    // Limitation: the install must be initiated from this page; there is no
    // way to expose two manifests from one html file simultaneously.
    document.title = 'Tickers';
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/tickers.webmanifest');
    document.querySelector('link[rel="icon"]')?.setAttribute('href', '/tickers-icon.svg');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f2f3e8');
    // Serif wordmark font, loaded only on this route so the finance app
    // never pays for it.
    if (!document.getElementById('tickers-fraunces')) {
      const link = document.createElement('link');
      link.id = 'tickers-fraunces';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap';
      document.head.appendChild(link);
    }
    // No cleanup: this page never navigates back into the finance app.
  }, []);
}

function fmtPrice(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  // Long timeframes can run past 100%; drop the decimals there to keep the
  // number compact.
  return `${v >= 0 ? '+' : ''}${v.toFixed(Math.abs(v) >= 100 ? 0 : 2)}%`;
}

function signColor(v: number): string {
  if (v > 0) return GAIN_TEXT;
  if (v < 0) return LOSS_TEXT;
  return TEXT_DIM;
}

const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";

// The signature element: percent change as a physical pill. A pin dot marks
// a value clamped at the band edge.
function Pill({ pct, scale, pinned }: { pct: number; scale: number; pinned: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-mono font-semibold"
      style={{ ...pillStyle(pct, scale, pinned), padding: '3px 11px', fontSize: 15, lineHeight: '20px' }}
    >
      {pinned && (
        <span
          aria-label={`Clamped at ${pct >= 0 ? '+' : '-'}${scale}% band edge`}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            boxShadow: '0 0 5px rgba(255,255,255,0.85)',
          }}
        />
      )}
      {fmtPct(pct)}
    </span>
  );
}

// Tiny stone-pill utility: opens a Google News search for the asset in a
// new tab. Searches by display name because raw symbols like ^GSPC or BZ=F
// return poor results. Click and Enter both stop propagating so the button
// never toggles the row's tap-to-expand.
function NewsLink({ name, symbol }: { name?: string; symbol: string }) {
  const query = name?.trim() || symbol;
  return (
    <a
      href={`https://news.google.com/search?q=${encodeURIComponent(query)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`News for ${query}`}
      title={`News for ${query}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center rounded-full shrink-0 select-none"
      style={{
        width: 16,
        height: 16,
        background: 'linear-gradient(180deg, #f0f0e8, #e2e2d6)',
        boxShadow: 'inset 0 1px 2px rgba(90,92,78,0.15), 0 1px 0 rgba(255,255,255,0.6)',
        color: TEXT_DIM,
        fontFamily: SERIF,
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      G
    </a>
  );
}

// Name-first hierarchy: the company or fund name is the primary line, the
// ticker symbol the secondary one. Rows with no name yet (still loading, or
// symbols Yahoo returns nameless) promote the symbol to the top line. The
// news button rides the symbol line in view rows; edit rows omit it.
function RowTitle({ name, symbol, news = false }: { name?: string; symbol: string; news?: boolean }) {
  const newsLink = news ? <NewsLink name={name} symbol={symbol} /> : null;
  if (!name) {
    return (
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-sm font-semibold truncate" style={{ color: TEXT }}>{symbol}</span>
        {newsLink}
      </div>
    );
  }
  return (
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold truncate" style={{ color: TEXT }}>{name}</div>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs" style={{ color: TEXT_DIM }}>{symbol}</span>
        {newsLink}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      className="uppercase mt-4 mb-2 px-1"
      style={{ color: TEXT_DIM, fontSize: 10, letterSpacing: '0.22em', fontWeight: 600 }}
    >
      {children}
    </div>
  );
}

const cardStyle = (shadow: string = CARD_SHADOW): React.CSSProperties => ({
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: CARD_RADIUS,
  boxShadow: shadow,
});

// Expanded detail: a larger sparkline plus the row's numbers in a light grid.
function DetailPanel({ row, change, is1D, band, colorScale }: {
  row: TickerRow;
  change: { pct: number; series: number[]; ref: number };
  is1D: boolean;
  band: number;
  colorScale: number;
}) {
  const { pct, series, ref } = change;
  const closes = row.closes ?? [];
  const stats: Array<{ label: string; value: string; color?: string }> = [
    { label: 'Price', value: fmtPrice(row.price!) },
    { label: is1D ? 'Prev close' : 'Period start', value: fmtPrice(ref) },
    { label: 'Change', value: `${pct >= 0 ? '+' : '-'}${fmtPrice(Math.abs(row.price! - ref))}`, color: signColor(pct) },
  ];
  if (closes.length > 0) {
    stats.push(
      { label: 'High', value: fmtPrice(Math.max(...closes)) },
      { label: 'Low', value: fmtPrice(Math.min(...closes)) },
    );
  }
  if (is1D && row.afterHoursPct != null && row.afterHoursPrice != null) {
    stats.push({
      label: 'After hours',
      value: `☾ ${fmtPrice(row.afterHoursPrice)} (${fmtPct(row.afterHoursPct)})`,
      color: signColor(row.afterHoursPct),
    });
  }
  return (
    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
      <TickerSparkline
        series={series}
        changePct={pct}
        mode={is1D ? 'band' : 'auto'}
        band={band}
        colorScale={colorScale}
        width={320}
        height={84}
        fluid
      />
      <div className="grid grid-cols-3 gap-2 mt-3">
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: 'rgba(231,238,219,0.55)',
              borderRadius: 12,
              padding: '6px 9px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
            }}
          >
            <div className="uppercase" style={{ color: TEXT_DIM, fontSize: 9, letterSpacing: '0.14em' }}>
              {s.label}
            </div>
            <div className="font-mono" style={{ color: s.color ?? TEXT, fontSize: 12, fontWeight: 500 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  symbol: string;
  row: TickerRow | undefined;
  timeframe: Timeframe;
  band: number;
  colorScale: number; // color denominator: band on 1D, biggest mover otherwise
  expanded: boolean;
  onToggle: () => void;
}

function Row({ symbol, row, timeframe, band, colorScale, expanded, onToggle }: RowProps) {
  const is1D = timeframe === '1D';
  const change = row ? changeFor(row, is1D) : null;

  // row undefined means still loading, no usable change means that symbol failed.
  // Loading and error cards share the data card's min height so a timeframe
  // switch (which clears every row) re-renders in place without the list
  // jumping under a scrolled reader.
  if (!row || !change) {
    return (
      <div className="flex items-center gap-3 mb-2.5 px-3.5 py-3" style={{ ...cardStyle(), minHeight: 72 }}>
        <RowTitle name={row?.name} symbol={symbol} news />
        <div className="text-right shrink-0 text-sm italic" style={{ color: row ? LOSS_TEXT : TEXT_DIM }}>
          {row ? 'Unavailable' : '...'}
        </div>
        <TickerSparkline series={[]} changePct={0} mode={is1D ? 'band' : 'auto'} band={band} colorScale={colorScale} />
      </div>
    );
  }

  const { pct, series } = change;
  // Pinned: the day's move is clamped at the band edge. Only meaningful on
  // the fixed-band 1D view; longer timeframes auto-scale and never clamp.
  const pinned = is1D && Math.abs(pct) >= band;

  return (
    <div
      className="mb-2.5 px-3.5 py-3 cursor-pointer select-none"
      style={cardStyle(cardShadow(pinned, pct >= 0))}
      onClick={onToggle}
      role="button"
      aria-expanded={expanded}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="flex items-center gap-3" style={{ minHeight: 48 }}>
        <RowTitle name={row.name} symbol={row.symbol} news />
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          {/* Percent change is the primary number, price is secondary. */}
          <Pill pct={pct} scale={colorScale} pinned={pinned} />
          <div className="font-mono text-xs" style={{ color: TEXT_DIM }}>{fmtPrice(row.price!)}</div>
          {is1D && row.afterHoursPct != null && (
            <div className="font-mono" style={{ color: signColor(row.afterHoursPct), fontSize: 10 }}>
              {'☾'} {fmtPct(row.afterHoursPct)}
            </div>
          )}
        </div>
        <TickerSparkline
          series={series}
          changePct={pct}
          mode={is1D ? 'band' : 'auto'}
          band={band}
          colorScale={colorScale}
        />
      </div>
      {expanded && <DetailPanel row={row} change={change} is1D={is1D} band={band} colorScale={colorScale} />}
    </div>
  );
}

function segStyle(active: boolean): React.CSSProperties {
  return active
    ? { background: SEG_ACTIVE_BG, color: '#ffffff', boxShadow: SEG_ACTIVE_SHADOW }
    : { color: TEXT_DIM };
}

// Compact timeframe selector, same visual language as the band control.
function TimeframeControl({ timeframe, onChange }: { timeframe: Timeframe; onChange: (t: Timeframe) => void }) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full p-0.5"
      role="group"
      aria-label="Timeframe"
      style={{ background: SEG_BG, boxShadow: SEG_SHADOW }}
    >
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          aria-pressed={timeframe === tf}
          className="rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-4"
          style={segStyle(timeframe === tf)}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

// Compact band selector. Selecting a value is immediate; the default BAND
// option carries a small dot so returning to it is the reset affordance.
function BandControl({ band, onChange }: { band: number; onChange: (b: number) => void }) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full p-0.5"
      role="group"
      aria-label="Chart scale, percent band"
      style={{ background: SEG_BG, boxShadow: SEG_SHADOW }}
    >
      {BAND_OPTIONS.map((b) => (
        <button
          key={b}
          onClick={() => onChange(b)}
          aria-pressed={band === b}
          title={b === BAND ? `Scale -${b}% to +${b}% (default)` : `Scale -${b}% to +${b}%`}
          className="flex flex-col items-center rounded-full px-1.5 pt-0.5 pb-1 font-mono text-[10px] leading-4"
          style={segStyle(band === b)}
        >
          <span>{b}%</span>
          <span
            className="h-0.5 w-0.5 rounded-full"
            style={{
              background: b === BAND ? (band === b ? 'rgba(255,255,255,0.85)' : STONE) : 'transparent',
            }}
          />
        </button>
      ))}
    </div>
  );
}

interface EditListProps {
  displayList: string[];
  rowsBySymbol: Record<string, TickerRow>;
  onChange: (next: string[]) => void;
}

function EditList({ displayList, rowsBySymbol, onChange }: EditListProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Pointer based drag so the same code serves mouse and touch. The handle
  // captures the pointer; touch-none on it plus locking body scroll keeps
  // Android from scrolling the page mid drag.
  const startDrag = (i: number) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIdx(i);
    document.body.style.overflow = 'hidden';
  };

  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (dragIdx == null) return;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = under?.closest('[data-row-idx]');
    if (!rowEl) return;
    const over = Number(rowEl.getAttribute('data-row-idx'));
    if (Number.isInteger(over) && over !== dragIdx) {
      const next = [...displayList];
      const [item] = next.splice(dragIdx, 1);
      next.splice(over, 0, item);
      onChange(next);
      setDragIdx(over);
    }
  };

  const endDrag = () => {
    setDragIdx(null);
    document.body.style.overflow = '';
  };

  return (
    <div>
      {displayList.map((symbol, i) => {
        const dragging = dragIdx === i;
        return (
          <div
            key={symbol}
            data-row-idx={i}
            className="flex items-center gap-3 mb-2 px-3 py-2.5"
            style={{
              ...cardStyle(
                dragging
                  ? '0 6px 16px rgba(58,68,48,0.18), 0 16px 32px -10px rgba(58,68,48,0.22), inset 0 1px 0 rgba(255,255,255,0.9)'
                  : CARD_SHADOW,
              ),
              // Dragged card lifts slightly above the list.
              transform: dragging ? 'scale(1.02)' : undefined,
              position: 'relative',
              zIndex: dragging ? 1 : undefined,
            }}
          >
            <span
              className="touch-none cursor-grab select-none px-1"
              style={{ color: STONE }}
              onPointerDown={startDrag(i)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              aria-label={`Reorder ${symbol}`}
            >
              &#8801;
            </span>
            <RowTitle name={rowsBySymbol[symbol]?.name} symbol={symbol} />
            <button
              className="px-2 py-1 text-base"
              style={{ color: LOSS_TEXT }}
              onClick={() => onChange(displayList.filter((s) => s !== symbol))}
              aria-label={`Remove ${symbol}`}
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function TickersPage() {
  useTickersHead();

  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist);
  const [band, setBand] = useState<number>(loadBand);
  // Deliberately not persisted: the app always opens on today (1D); other
  // timeframes are temporary excursions within a session.
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [rowsBySymbol, setRowsBySymbol] = useState<Record<string, TickerRow>>({});
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Drives the sticky header treatment: flush against the page gradient at
  // the top, solid sage with a bottom edge (and a smaller wordmark) once the
  // list has scrolled underneath it.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const updateBand = useCallback((next: number) => {
    setBand(next);
    try {
      localStorage.setItem(BAND_STORAGE_KEY, String(next));
    } catch {
      // storage blocked: the in-memory value still works this session
    }
  }, []);

  const updateWatchlist = useCallback((next: string[]) => {
    setWatchlist(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage full or blocked: the in-memory list still works this session
    }
  }, []);

  const load = useCallback(async (symbols: string[], tf: Timeframe) => {
    if (symbols.length === 0) return;
    try {
      const res = await fetch(
        `/api/tickers?symbols=${encodeURIComponent(symbols.join(','))}&range=${encodeURIComponent(tf)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json?.tickers)) throw new Error('unexpected response shape');
      setRowsBySymbol((prev) => {
        const next = { ...prev };
        for (const t of json.tickers as TickerRow[]) next[t.symbol] = t;
        return next;
      });
      setError(null);
    } catch (e) {
      // Keep the last good rows on screen if we have them.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadedOnce(true);
    }
  }, []);

  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;

  // One fetch per timeframe: this effect runs on mount and again on every
  // switch. Old rows are cleared because their series and reference belong
  // to the previous range. Server and CDN caches make repeat switches cheap.
  useEffect(() => {
    setRowsBySymbol({});
    setLoadedOnce(false);
    load(watchlistRef.current, timeframe);
  }, [timeframe, load]);

  // Refetch on refocus with whatever the list and timeframe are at that
  // moment. The serverless function caches for 60s, so repeated refocusing
  // does not hammer Yahoo. Reordering and removing never refetch.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(watchlistRef.current, timeframeRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const addSymbol = useCallback(async () => {
    const sym = addValue.trim().toUpperCase();
    if (!sym || addBusy) return;
    if (watchlist.includes(sym)) {
      setAddError('Already in the list');
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      // Validate by fetching it at the current timeframe: if Yahoo has no
      // data, it is not addable, and on success the row matches the view.
      const res = await fetch(
        `/api/tickers?symbols=${encodeURIComponent(sym)}&range=${encodeURIComponent(timeframe)}`,
      );
      const json = res.ok ? await res.json() : null;
      const row: TickerRow | undefined = Array.isArray(json?.tickers)
        ? json.tickers.find((t: TickerRow) => t.symbol === sym)
        : undefined;
      if (row?.ok) {
        setRowsBySymbol((prev) => ({ ...prev, [row.symbol]: row }));
        updateWatchlist([...watchlist, row.symbol]);
        setAddValue('');
      } else {
        setAddError('Symbol not found');
      }
    } catch {
      setAddError('Could not reach the price service');
    } finally {
      setAddBusy(false);
    }
  }, [addValue, addBusy, watchlist, updateWatchlist, timeframe]);

  const displayList = grouped(watchlist);
  const indexes = displayList.filter(isIndexSymbol);
  const others = displayList.filter((s) => !isIndexSymbol(s));
  const is1D = timeframe === '1D';

  // Color denominator: the band on 1D; on longer timeframes the list's
  // biggest absolute mover, so the most saturated colors always mark the
  // biggest movers and cross-ticker comparison stays meaningful.
  let colorScale = band;
  if (!is1D) {
    let maxAbs = 0;
    for (const s of displayList) {
      const r = rowsBySymbol[s];
      const c = r ? changeFor(r, false) : null;
      if (c) maxAbs = Math.max(maxAbs, Math.abs(c.pct));
    }
    colorScale = Math.max(maxAbs, 0.01);
  }

  // Header label. On 1D: one session label for the equity rows, taken from
  // the first index; Yahoo's chart meta usually omits marketState, so when
  // it is missing we treat the market as closed once the last trade (asOf)
  // is more than 15 minutes old, and weekends and holidays fall out of that
  // naturally. On longer timeframes: the period name.
  let headerLabel: string | null = PERIOD_LABELS[timeframe];
  if (is1D) {
    const firstOk = displayList.map((s) => rowsBySymbol[s]).find((r) => r?.ok && r.asOf != null);
    const isClosed = firstOk
      ? firstOk.marketState
        ? firstOk.marketState !== 'REGULAR'
        : Date.now() / 1000 - firstOk.asOf! > 15 * 60
      : false;
    headerLabel = isClosed
      ? `Closed · showing ${new Date(firstOk!.asOf! * 1000).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}`
      : null;
  }

  const toggleExpanded = useCallback((symbol: string) => {
    setExpanded((cur) => (cur === symbol ? null : symbol));
  }, []);

  const renderRow = (s: string) => (
    <Row
      key={s}
      symbol={s}
      timeframe={timeframe}
      band={band}
      colorScale={colorScale}
      row={rowsBySymbol[s] ?? (loadedOnce ? { symbol: s, ok: false } : undefined)}
      expanded={expanded === s}
      onToggle={() => toggleExpanded(s)}
    />
  );

  return (
    <div
      className="min-h-screen px-4 pb-6"
      style={{ backgroundColor: PAGE_BG, backgroundImage: PAGE_GRADIENT, color: TEXT }}
    >
      {/* Placeholder color cannot be set inline; tiny route-scoped stylesheet. */}
      <style>{`.tickers-add::placeholder { color: ${STONE}; }`}</style>
      <div className="mx-auto w-full max-w-md">
        {/* Sticky header: the whole control block pins to the viewport top.
            At rest it is transparent (flush with the page gradient); once the
            list scrolls underneath it turns solid sage, grows a soft bottom
            edge, and the wordmark row shrinks so the selectors stay the
            priority on short screens. The negative margins bleed the
            background over the page's side padding. */}
        <div
          className="sticky top-0 z-10 -mx-4 px-4"
          style={{
            paddingTop: scrolled ? 10 : 24,
            paddingBottom: 8,
            backgroundColor: scrolled ? '#f2f3e8' : 'transparent',
            borderBottom: `1px solid ${scrolled ? '#dde3cb' : 'transparent'}`,
            boxShadow: scrolled ? '0 6px 14px -10px rgba(58,68,48,0.14)' : 'none',
            // background-color deliberately not transitioned: fading in from
            // transparent lets rows show through the header for a beat on a
            // fast scroll; the sage is close enough to the gradient top that
            // an instant swap is imperceptible.
            transition: 'padding-top 0.25s ease, border-bottom-color 0.25s ease, box-shadow 0.25s ease',
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: scrolled ? 6 : 12, transition: 'margin-bottom 0.25s ease' }}
          >
            <h1
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: scrolled ? 18 : 26,
                lineHeight: 1.2,
                color: TEXT,
                transition: 'font-size 0.25s ease',
              }}
            >
              <span
                aria-hidden="true"
                style={{ color: ACCENT, fontSize: scrolled ? 14 : 20, marginRight: 8, transition: 'font-size 0.25s ease' }}
              >
                {'❧'}
              </span>
              Tickers
            </h1>
            <button
              className="rounded-full text-xs font-medium"
              style={{
                background: ACCENT_BG,
                color: ACCENT,
                padding: '5px 15px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 3px rgba(58,68,48,0.1)',
              }}
              onClick={() => {
                setEditMode((v) => !v);
                setAddError(null);
              }}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-y-1.5">
            <TimeframeControl timeframe={timeframe} onChange={setTimeframe} />
            {/* The band only applies to the fixed-scale 1D view. */}
            {is1D && <BandControl band={band} onChange={updateBand} />}
          </div>
          {!editMode && headerLabel && (
            <div className="text-xs italic mt-2 px-1" style={{ color: TEXT_DIM }}>{headerLabel}</div>
          )}
        </div>
        {!editMode && error && !loadedOnce && (
          <div className="text-sm italic py-6" style={{ color: LOSS_TEXT }}>
            Could not load prices ({error}). Reopen to retry.
          </div>
        )}

        {editMode ? (
          <div>
            <div className="flex gap-2 py-3">
              <input
                type="text"
                value={addValue}
                onChange={(e) => {
                  setAddValue(e.target.value.toUpperCase());
                  setAddError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSymbol();
                }}
                placeholder="Add symbol (e.g. VTI)"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="tickers-add flex-1 min-w-0 rounded-full px-4 py-1.5 text-sm font-mono outline-none"
                style={{
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  color: TEXT,
                  boxShadow: 'inset 0 1px 3px rgba(58,68,48,0.06)',
                }}
              />
              <button
                className="rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                style={{ background: SEG_ACTIVE_BG, color: '#ffffff', boxShadow: SEG_ACTIVE_SHADOW }}
                onClick={addSymbol}
                disabled={addBusy || !addValue.trim()}
              >
                {addBusy ? 'Checking...' : 'Add'}
              </button>
            </div>
            {addError && <div className="text-xs mb-2 px-1" style={{ color: LOSS_TEXT }}>{addError}</div>}
            <EditList displayList={displayList} rowsBySymbol={rowsBySymbol} onChange={updateWatchlist} />
          </div>
        ) : (
          <div>
            {indexes.length > 0 && <SectionLabel>Indexes</SectionLabel>}
            {indexes.map(renderRow)}
            {others.length > 0 && <SectionLabel>Watchlist</SectionLabel>}
            {others.map(renderRow)}
            {!loadedOnce && (
              <div className="text-xs italic mt-3 px-1" style={{ color: TEXT_DIM }}>Loading prices...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
