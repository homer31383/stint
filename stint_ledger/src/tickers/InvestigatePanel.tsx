// Slide-up results panel for the Investigate feature: shows the selected
// tickers as pills, then a Claude-written analysis of why they are moving.
// Same biophilic language as the rest of the page: paper-white sheet, 22px
// top radii, stone close pill, moss text. Dismiss via swipe-down on the
// header, the close button, or the backdrop.

import { useEffect, useRef, useState } from 'react';
import {
  CARD_BG,
  CARD_BORDER,
  TEXT,
  TEXT_DIM,
  ACCENT,
  ACCENT_BG,
  STONE,
  ZERO_LINE,
  GAIN_TEXT,
  LOSS_TEXT,
  SEG_ACTIVE_BG,
  SEG_ACTIVE_SHADOW,
} from './theme';

export interface InvestigateAsset {
  symbol: string;
  name?: string;
  pct: number;
  pctLabel: string; // preformatted, e.g. "+2.34%"
}

export type InvestigateStatus = 'loading' | 'done' | 'error';

interface InvestigatePanelProps {
  assets: InvestigateAsset[];
  status: InvestigateStatus;
  text?: string;
  error?: string;
  retryDisabled: boolean;
  onRetry: () => void;
  onClose: () => void;
}

// Rotating loading copy: a search-backed analysis takes 10-30 seconds.
const STATUS_LINES = [
  'Searching recent news...',
  'Reading market coverage...',
  'Connecting the dots...',
];

const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";

function AssetPill({ asset }: { asset: InvestigateAsset }) {
  const up = asset.pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        background: up ? '#e6efd9' : '#f5ded2',
        padding: '3px 10px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
      }}
    >
      <span className="font-mono font-semibold" style={{ color: TEXT, fontSize: 11 }}>
        {asset.symbol}
      </span>
      <span
        className="font-mono font-semibold"
        style={{ color: up ? GAIN_TEXT : LOSS_TEXT, fontSize: 11 }}
      >
        {asset.pctLabel}
      </span>
    </span>
  );
}

export default function InvestigatePanel({
  assets,
  status,
  text,
  error,
  retryDisabled,
  onRetry,
  onClose,
}: InvestigatePanelProps) {
  const [lineIdx, setLineIdx] = useState(0);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'loading') return;
    setLineIdx(0);
    const id = window.setInterval(
      () => setLineIdx((i) => (i + 1) % STATUS_LINES.length),
      2800,
    );
    return () => window.clearInterval(id);
  }, [status]);

  // Lock the page behind the sheet while it is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const endDrag = () => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    if (dragY > 90) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Investigation">
      <style>{`
        @keyframes tickers-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes tickers-spin { to { transform: rotate(360deg); } }
      `}</style>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(42,51,37,0.35)' }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-md flex flex-col"
        style={{
          background: CARD_BG,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: `1px solid ${CARD_BORDER}`,
          borderBottom: 'none',
          boxShadow: '0 -8px 32px rgba(58,68,48,0.25), inset 0 1px 0 rgba(255,255,255,0.9)',
          maxHeight: '78vh',
          transform: `translateY(${dragY}px)`,
          transition: dragStart.current == null ? 'transform 0.2s ease' : 'none',
          animation: 'tickers-sheet-in 0.28s ease',
        }}
      >
        {/* Drag handle + header: the swipe-down zone */}
        <div
          className="shrink-0 touch-none select-none px-5 pt-2.5 pb-3"
          style={{ cursor: 'grab' }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="mx-auto mb-3 rounded-full"
            style={{ width: 36, height: 4, background: ZERO_LINE }}
          />
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18, color: TEXT }}>
                <span aria-hidden="true" style={{ color: ACCENT, fontSize: 14, marginRight: 6 }}>
                  {'❧'}
                </span>
                Why the moves?
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {assets.map((a) => (
                  <AssetPill key={a.symbol} asset={a} />
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 inline-flex items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(180deg, #f0f0e8, #e2e2d6)',
                boxShadow: 'inset 0 1px 2px rgba(90,92,78,0.15), 0 1px 0 rgba(255,255,255,0.6)',
                color: TEXT_DIM,
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 pb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div
                aria-hidden="true"
                className="rounded-full"
                style={{
                  width: 28,
                  height: 28,
                  border: `3px solid ${ACCENT_BG}`,
                  borderTopColor: ACCENT,
                  animation: 'tickers-spin 0.9s linear infinite',
                }}
              />
              <div className="text-sm italic" style={{ color: TEXT_DIM }} aria-live="polite">
                {STATUS_LINES[lineIdx]}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="text-sm" style={{ color: TEXT }}>
                Could not finish the investigation.
              </div>
              {error && (
                <div className="text-xs italic px-4" style={{ color: TEXT_DIM }}>
                  {error}
                </div>
              )}
              <button
                onClick={onRetry}
                disabled={retryDisabled}
                className="rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: SEG_ACTIVE_BG, color: '#ffffff', boxShadow: SEG_ACTIVE_SHADOW }}
              >
                {retryDisabled ? 'One moment...' : 'Try again'}
              </button>
            </div>
          )}

          {status === 'done' && text && (
            <div>
              {text
                .split(/\n+/)
                .filter((p) => p.trim())
                .map((para, i) => (
                  <p
                    key={i}
                    className="mb-3"
                    style={{ color: TEXT, fontSize: 14, lineHeight: 1.65 }}
                  >
                    {para.trim()}
                  </p>
                ))}
            </div>
          )}

          <div className="mt-2 mb-1 text-center" style={{ color: STONE, fontSize: 10 }}>
            Analysis by Claude · uses web search
          </div>
        </div>
      </div>
    </div>
  );
}
