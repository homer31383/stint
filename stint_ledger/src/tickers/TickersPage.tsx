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
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function Row({ symbol, row, band }: { symbol: string; row: TickerRow | undefined; band: number }) {
  // row undefined means still loading, row.ok false means that symbol failed.
  if (!row || !row.ok || row.price == null || row.prevClose == null) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-surface-2 last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-gray-300">{symbol}</div>
          <div className="text-xs text-gray-500 truncate">{row?.name ?? ''}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm text-gray-500">{row ? 'Unavailable' : '...'}</div>
        </div>
        <TickerSparkline series={[]} changePct={0} band={band} />
      </div>
    );
  }

  const pct = ((row.price - row.prevClose) / row.prevClose) * 100;
  const series = (row.closes ?? []).map((c) => ((c - row.prevClose!) / row.prevClose!) * 100);

  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-surface-2 last:border-b-0"
      style={{ backgroundColor: intensityTint(pct, band) }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-gray-300">{row.symbol}</div>
        <div className="text-xs text-gray-500 truncate">{row.name ?? ''}</div>
      </div>
      <div className="text-right shrink-0">
        {/* Percent change is the primary number, price is secondary. */}
        <div className="font-mono text-xl font-semibold" style={{ color: intensityColor(pct, band) }}>
          {fmtPct(pct)}
        </div>
        <div className="font-mono text-xs text-gray-500">{fmtPrice(row.price)}</div>
      </div>
      <TickerSparkline series={series} changePct={pct} band={band} />
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

  const load = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    try {
      const res = await fetch(`/api/tickers?symbols=${encodeURIComponent(symbols.join(','))}`);
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

  // Refetch on mount and on refocus with whatever the list is at that
  // moment. The serverless function caches for 60s, so repeated refocusing
  // does not hammer Yahoo. Reordering and removing never refetch.
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  useEffect(() => {
    load(watchlistRef.current);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(watchlistRef.current);
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
      // Validate by fetching it: if Yahoo has no data, it is not addable.
      const res = await fetch(`/api/tickers?symbols=${encodeURIComponent(sym)}`);
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
  }, [addValue, addBusy, watchlist, updateWatchlist]);

  const displayList = grouped(watchlist);
  const indexes = displayList.filter(isIndexSymbol);
  const others = displayList.filter((s) => !isIndexSymbol(s));

  // One session label for the equity rows, taken from the first index. See
  // the comment below on the staleness fallback; weekends and holidays fall
  // out of it naturally because the last trade is the prior session's close.
  const firstOk = displayList.map((s) => rowsBySymbol[s]).find((r) => r?.ok && r.asOf != null);
  const isClosed = firstOk
    ? firstOk.marketState
      ? firstOk.marketState !== 'REGULAR'
      : Date.now() / 1000 - firstOk.asOf! > 15 * 60
    : false;
  const closedLabel = isClosed
    ? `Closed, showing ${new Date(firstOk!.asOf! * 1000).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })}`
    : null;

  return (
    <div className="min-h-screen bg-surface-0 px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tickers</h1>
          <div className="flex items-center gap-3">
            <BandControl band={band} onChange={updateBand} />
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
        </div>
        {!editMode && closedLabel && <div className="text-xs text-gray-500 mb-2">{closedLabel}</div>}
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
              <Row key={s} symbol={s} band={band} row={rowsBySymbol[s] ?? (loadedOnce ? { symbol: s, ok: false } : undefined)} />
            ))}
            {indexes.length > 0 && others.length > 0 && <div className="my-2 border-t border-surface-3" />}
            {others.map((s) => (
              <Row key={s} symbol={s} band={band} row={rowsBySymbol[s] ?? (loadedOnce ? { symbol: s, ok: false } : undefined)} />
            ))}
            {!loadedOnce && <div className="text-xs text-gray-600 mt-3">Loading prices...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
