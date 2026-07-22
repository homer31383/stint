// Biophilic theme for the /tickers page only: moss, clay, sand, living green.
// Every color and the pill/sparkline intensity ramp lives here so the page,
// the pills, and the sparklines stay one system. Nothing in this file is
// imported by the finance app.

import type { CSSProperties } from 'react';

export const PAGE_BG = '#eef0e4';
export const PAGE_GRADIENT = 'linear-gradient(170deg, #f2f3e8 0%, #e9edda 55%, #e2e8d2 100%)';

export const CARD_BG = '#fbfcf5';
export const CARD_BORDER = 'rgba(221,227,203,0.7)';
export const CARD_RADIUS = 22;
export const CARD_SHADOW =
  '0 2px 6px rgba(58,68,48,0.07), 0 8px 20px -8px rgba(58,68,48,0.08), inset 0 1px 0 rgba(255,255,255,0.9)';

export const TEXT = '#2a3325'; // deep moss
export const TEXT_DIM = '#8b9478'; // lichen gray green
export const ACCENT = '#5f7d4f'; // fern
export const ACCENT_BG = '#e7eedb';
export const STONE = '#a9ab97';
export const ZERO_LINE = '#d5dcc0';

export const GAIN_TEXT = '#4a7a45';
export const LOSS_TEXT = '#a5563c'; // clay, never red

// Segmented controls: the active segment is itself a small 3D object.
export const SEG_BG = 'rgba(255,255,255,0.65)';
export const SEG_SHADOW = 'inset 0 1px 3px rgba(58,68,48,0.08)';
export const SEG_ACTIVE_BG = 'linear-gradient(180deg, #6f8d5e, #52703f)';
export const SEG_ACTIVE_SHADOW = '0 2px 4px rgba(58,68,48,0.3), inset 0 1px 0 rgba(255,255,255,0.25)';

// The pill ramp. Each stop is the top/bottom of a subtle vertical gradient
// plus a text color, so the pill reads as a physical object. Interpolation
// runs neutral stone at 0, through mild, to strong as |change| approaches
// the scale; a value clamped at the band edge gets the separate solid
// pinned treatment.
interface RampStop {
  top: string;
  bottom: string;
  text: string;
}

const NEUTRAL: RampStop = { top: '#f0f0e8', bottom: '#e2e2d6', text: '#8f9182' };
const GAIN_MILD: RampStop = { top: '#e9f2e0', bottom: '#d8e8cc', text: '#4a7a45' };
const GAIN_STRONG: RampStop = { top: '#dcefce', bottom: '#c5e3b0', text: '#3d7a3a' };
const LOSS_MILD: RampStop = { top: '#f5ded2', bottom: '#ecc9b6', text: '#a5563c' };
const LOSS_STRONG: RampStop = { top: '#f2d3bd', bottom: '#e6b291', text: '#94492c' };

const GAIN_PINNED: RampStop = { top: '#4a9455', bottom: '#2c6e3c', text: '#effbf0' };
const LOSS_PINNED: RampStop = { top: '#c96a48', bottom: '#a8492c', text: '#fdf3ec' };

// Deepest solid tones, used for the sparkline pin markers.
export const GAIN_MAX = '#3a7d44';
export const LOSS_MAX = '#b0563b';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const m = ra.map((v, i) => Math.round(v + (rb[i] - v) * t));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

function mixStop(a: RampStop, b: RampStop, t: number): RampStop {
  return { top: mixHex(a.top, b.top, t), bottom: mixHex(a.bottom, b.bottom, t), text: mixHex(a.text, b.text, t) };
}

// Ease in: t squared leaves more than half of the color progression for the
// last third of the band, so small moves stay calm and big ones bloom fast.
function eased(changePct: number, scale: number): number {
  const t = Math.min(Math.abs(changePct) / Math.max(scale, 0.01), 1);
  return t * t;
}

function rampStop(changePct: number, scale: number): RampStop {
  const e = eased(changePct, scale);
  const [mild, strong] = changePct >= 0 ? [GAIN_MILD, GAIN_STRONG] : [LOSS_MILD, LOSS_STRONG];
  return e <= 0.5 ? mixStop(NEUTRAL, mild, e / 0.5) : mixStop(mild, strong, (e - 0.5) / 0.5);
}

// Sparkline stroke follows the same moss to forest / sand to clay ramp as
// the pill text.
export function strokeColor(changePct: number, scale: number): string {
  return rampStop(changePct, scale).text;
}

// Full inline style for a percent change pill: vertical gradient, top inner
// highlight, bottom inner shade. Pinned means the value is clamped at the
// band edge, which gets the solid deep forest or fired terracotta object.
export function pillStyle(changePct: number, scale: number, pinned: boolean): CSSProperties {
  if (pinned) {
    const up = changePct >= 0;
    const s = up ? GAIN_PINNED : LOSS_PINNED;
    return {
      background: `linear-gradient(180deg, ${s.top}, ${s.bottom})`,
      color: s.text,
      boxShadow: up
        ? '0 4px 10px rgba(44,110,60,0.5), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 3px rgba(20,60,30,0.4)'
        : '0 4px 10px rgba(168,73,44,0.5), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 3px rgba(90,35,18,0.4)',
    };
  }
  const s = rampStop(changePct, scale);
  const e = eased(changePct, scale);
  const tint = changePct >= 0 ? mixHex('#5a5c4e', '#346036', e) : mixHex('#5a5c4e', '#8c4a30', e);
  const rgb = tint.slice(4, -1); // 'rgb(r, g, b)' -> 'r, g, b'
  return {
    background: `linear-gradient(180deg, ${s.top}, ${s.bottom})`,
    color: s.text,
    boxShadow: `0 1px 3px rgba(${rgb},0.12), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 2px rgba(${rgb},0.08)`,
  };
}

// Card shadow, with a soft ambient glow in the move's color when its pill is
// pinned at the band edge.
export function cardShadow(pinned: boolean, up: boolean): string {
  if (!pinned) return CARD_SHADOW;
  const glow = up ? '0 10px 24px -8px rgba(58,125,68,0.25)' : '0 10px 24px -8px rgba(176,86,59,0.25)';
  return `${CARD_SHADOW}, ${glow}`;
}
