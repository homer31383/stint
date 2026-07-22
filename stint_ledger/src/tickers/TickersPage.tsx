// Standalone market watch page at /tickers. Deliberately isolated: no
// Supabase, no auth, no imports from the finance views or shared app
// components, and the watchlist persists to localStorage only, never the
// app's IndexedDB or sync layer. See src/main.tsx for the route branch.
//
// Kept dumb on purpose. TODO if ever wanted: auto refresh interval, tap for
// a bigger chart, timeframe switcher. Not building these now.

import { useCallback, useEffect, useRef, useState } from 'react';
import { TickerSparkline, BAND, intensityColor, intensityTint } from './TickerSparkline';

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
function changeFor(row: TickerRow, is1D: boolean): { pct: number; series: number[] } | null {
  if (!row.ok || row.price == null) return null;
  const closes = row.closes ?? [];
  const ref = is1D ? row.prevClose : closes.length > 0 ? closes[0] : null;
  if (ref == null || ref <= 0) return null;
  return {
    pct: ((row.price - ref) / ref) * 100,
    series: closes.map((c) => ((c - ref) / ref) * 100),
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

interface RowProps {
  symbol: string;
  row: TickerRow | undefined;
  timeframe: Timeframe;
  band: number;
  colorScale: number; // color denominator: band on 1D, biggest mover otherwise
}

function Row({ symbol, row, timeframe, band, colorScale }: RowProps) {
  const is1D = timeframe === '1D';
  const change = row ? changeFor(row, is1D) : null;

  // row undefined means still loading, no usable change means that symbol failed.
  if (!row || !change) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-surface-2 last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-gray-300">{symbol}</div>
          <div className="text-xs text-gray-500 truncate">{row?.name ?? ''}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm text-gray-500">{row ? 'Unavailable' : '...'}</div>
        </div>
        <TickerSparkline series={[]} changePct={0} mode={is1D ? 'band' : 'auto'} band={band} colorScale={colorScale} />
      </div>
    );
  }

  const { pct, series } = change;

  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-surface-2 last:border-b-0"
      style={{ backgroundColor: intensityTint(pct, colorScale) }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-gray-300">{row.symbol}</div>
        <div className="text-xs text-gray-500 truncate">{row.name ?? ''}</div>
      </div>
      <div className="text-right shrink-0">
        {/* Percent change is the primary number, price is secondary. */}
        <div className="font-mono text-xl font-semibold" style={{ color: intensityColor(pct, colorScale) }}>
          {fmtPct(pct)}
        </div>
        <div className="font-mono text-xs text-gray-500">{fmtPrice(row.price!)}</div>
      </div>
      <TickerSparkline
        series={series}
        changePct={pct}
        mode={is1D ? 'band' : 'auto'}
        band={band}
        colorScale={colorScale}
      />
    </div>
  );
}

// Compact timeframe selector, same visual language as the band control.
function TimeframeControl({ timeframe, onChange }: { timeframe: Timeframe; onChange: (t: Timeframe) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Timeframe">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          aria-pressed={timeframe === tf}
          className={`rounded px-1 py-0.5 font-mono text-[10px] leading-4 ${
            timeframe === tf ? 'bg-surface-2 text-gray-300' : 'text-gray-600'
          }`}
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
    <div className="flex items-center gap-0.5" role="group" aria-label="Chart scale, percent band">
      {BAND_OPTIONS.map((b) => (
        <button
          key={b}
          onClick={() => onChange(b)}
          aria-pressed={band === b}
          title={b === BAND ? `Scale -${b}% to +${b}% (default)` : `Scale -${b}% to +${b}%`}
          className={`flex flex-col items-center rounded px-1.5 pt-0.5 pb-1 font-mono text-[10px] leading-4 ${
            band === b ? 'bg-surface-2 text-gray-300' : 'text-gray-600'
          }`}
        >
          <span>{b}%</span>
          <span
            className={`h-0.5 w-0.5 rounded-full ${b === BAND ? 'bg-gray-500' : 'bg-transparent'}`}
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
      {displayList.map((symbol, i) => (
        <div
          key={symbol}
          data-row-idx={i}
          className={`flex items-center gap-3 py-2.5 border-b border-surface-2 last:border-b-0 ${
            dragIdx === i ? 'bg-surface-2' : ''
          }`}
        >
          <span
            className="touch-none cursor-grab select-none px-1 text-gray-500"
            onPointerDown={startDrag(i)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            aria-label={`Reorder ${symbol}`}
          >
            &#8801;
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm text-gray-300">{symbol}</div>
            <div className="text-xs text-gray-500 truncate">{rowsBySymbol[symbol]?.name ?? ''}</div>
          </div>
          <button
            className="px-2 py-1 text-gray-500 hover:text-gray-300"
            onClick={() => onChange(displayList.filter((s) => s !== symbol))}
            aria-label={`Remove ${symbol}`}
          >
            &times;
          </button>
        </div>
      ))}
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
      ? `Closed, showing ${new Date(firstOk!.asOf! * 1000).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}`
      : null;
  }

  return (
    <div className="min-h-screen bg-surface-0 px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tickers</h1>
          <button
            className="text-xs text-accent"
            onClick={() => {
              setEditMode((v) => !v);
              setAddError(null);
            }}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-y-1 mb-1">
          <TimeframeControl timeframe={timeframe} onChange={setTimeframe} />
          {/* The band only applies to the fixed-scale 1D view. */}
          {is1D && <BandControl band={band} onChange={updateBand} />}
        </div>
        {!editMode && headerLabel && <div className="text-xs text-gray-500 mb-2">{headerLabel}</div>}
        {!editMode && error && !loadedOnce && (
          <div className="text-sm text-gray-500 py-6">Could not load prices ({error}). Reopen to retry.</div>
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
                className="flex-1 min-w-0 rounded bg-surface-2 px-3 py-1.5 text-sm font-mono text-gray-300 placeholder:text-gray-600 outline-none"
              />
              <button
                className="rounded bg-surface-3 px-3 py-1.5 text-sm text-gray-300 disabled:opacity-50"
                onClick={addSymbol}
                disabled={addBusy || !addValue.trim()}
              >
                {addBusy ? 'Checking...' : 'Add'}
              </button>
            </div>
            {addError && <div className="text-xs mb-2" style={{ color: '#b08a86' }}>{addError}</div>}
            <EditList displayList={displayList} rowsBySymbol={rowsBySymbol} onChange={updateWatchlist} />
          </div>
        ) : (
          <div>
            {indexes.map((s) => (
              <Row
                key={s}
                symbol={s}
                timeframe={timeframe}
                band={band}
                colorScale={colorScale}
                row={rowsBySymbol[s] ?? (loadedOnce ? { symbol: s, ok: false } : undefined)}
              />
            ))}
            {indexes.length > 0 && others.length > 0 && <div className="my-2 border-t border-surface-3" />}
            {others.map((s) => (
              <Row
                key={s}
                symbol={s}
                timeframe={timeframe}
                band={band}
                colorScale={colorScale}
                row={rowsBySymbol[s] ?? (loadedOnce ? { symbol: s, ok: false } : undefined)}
              />
            ))}
            {!loadedOnce && <div className="text-xs text-gray-600 mt-3">Loading prices...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
