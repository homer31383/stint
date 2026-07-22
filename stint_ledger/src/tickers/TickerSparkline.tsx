// Sparkline with two modes.
//
// 'band' (the 1D view): the y axis is a fixed -band..+band percent and never
// auto-scales, so a 0.1% drift draws nearly flat while a 2% selloff visibly
// fills the frame. Every ticker uses the same band, which makes the charts
// directly comparable. Values outside the band clamp to the edge and a small
// pin marker appears at that edge.
//
// 'auto' (longer timeframes): the y domain fits the period's own min/max
// percent change with a little padding. No clamping, no pin markers. The
// zero line still draws at its true position whenever 0% falls inside the
// domain.

export const BAND = 3; // percent: the default and reset band, y domain -BAND to +BAND

// A full US regular session is 6.5 hours of 5 minute bars. In band mode,
// partial sessions (mid-day, early close) draw only the left portion of the
// frame instead of stretching to full width, so the line grows across the
// day.
const FULL_SESSION_POINTS = 78;

// Color intensity scales with move magnitude relative to a scale value: near
// 0% the line and number sit at neutral gray and blend toward vibrant
// up/down endpoints as the move approaches the scale. On 1D the scale is the
// band; on longer timeframes the page passes the list's biggest mover so the
// most saturated colors always mark the biggest movers. The ramp is eased
// (quadratic) so the last stretch gains saturation much faster than the
// first: small moves stay calm while a move at or past the scale is
// unmistakable. Clamped/pinned values cap at t = 1, maximum vibrancy.
const NEUTRAL_RGB = [107, 114, 128] as const; // gray-500
const UP_RGB = [77, 199, 134] as const; // #4dc786, saturated but not neon
const DOWN_RGB = [222, 112, 104] as const; // #de7068

function easedMagnitude(changePct: number, scale: number): number {
  const t = Math.min(Math.abs(changePct) / scale, 1);
  // Ease-in: at 70% of the scale this yields ~0.5, leaving the other half of
  // the color progression for the final 30%.
  return t * t;
}

// Line and text color for a given percent change.
export function intensityColor(changePct: number, scale: number = BAND): string {
  const e = easedMagnitude(changePct, scale);
  const end = changePct >= 0 ? UP_RGB : DOWN_RGB;
  const mix = NEUTRAL_RGB.map((n, i) => Math.round(n + (end[i] - n) * e));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

// Row background wash on the same eased scale, topping out at 13% opacity.
export function intensityTint(changePct: number, scale: number = BAND): string {
  const e = easedMagnitude(changePct, scale);
  const end = changePct >= 0 ? UP_RGB : DOWN_RGB;
  return `rgba(${end[0]}, ${end[1]}, ${end[2]}, ${(0.13 * e).toFixed(3)})`;
}

// Pin markers always render at full vibrancy in the direction they pinned:
// they exist precisely because the line exceeded the band, even on a day
// whose net change (and therefore line color) ends up small.
const UP_MAX = `rgb(${UP_RGB[0]}, ${UP_RGB[1]}, ${UP_RGB[2]})`;
const DOWN_MAX = `rgb(${DOWN_RGB[0]}, ${DOWN_RGB[1]}, ${DOWN_RGB[2]})`;

const ZERO_LINE_COLOR = '#2e3542';
const EDGE_PAD = 1.5; // keep the stroke inside the viewBox at the domain edges

interface TickerSparklineProps {
  series: number[]; // percent change from the reference price, chronological
  changePct: number; // change over the timeframe, drives color intensity
  mode?: 'band' | 'auto';
  band?: number; // band mode: y domain half width in percent
  colorScale?: number; // color denominator; defaults to band
  width?: number;
  height?: number;
}

export function TickerSparkline({
  series,
  changePct,
  mode = 'band',
  band = BAND,
  colorScale,
  width = 100,
  height = 40,
}: TickerSparklineProps) {
  const lineColor = intensityColor(changePct, colorScale ?? band);

  // Fewer than 2 points: zero line only. This covers pre-market, a fresh
  // session, and mutual funds that price once daily with no intraday series,
  // detected generically by point count rather than by ticker.
  const drawable = series.length >= 2;

  let lo = -band;
  let hi = band;
  let pinnedHigh = false;
  let pinnedLow = false;
  let denom = 1;
  if (mode === 'band') {
    pinnedHigh = series.some((v) => v > band);
    pinnedLow = series.some((v) => v < -band);
    denom = Math.max(series.length, FULL_SESSION_POINTS) - 1;
  } else if (drawable) {
    const mn = Math.min(...series);
    const mx = Math.max(...series);
    const span = mx - mn;
    const pad = span > 0 ? span * 0.08 : Math.max(Math.abs(mn) * 0.05, 0.5);
    lo = mn - pad;
    hi = mx + pad;
    denom = series.length - 1;
  } else {
    // Auto mode with no data: neutral domain so the zero line sits centered.
    lo = -1;
    hi = 1;
  }

  const yFor = (v: number): number => {
    const c = Math.max(lo, Math.min(hi, v));
    return EDGE_PAD + (height - 2 * EDGE_PAD) * (1 - (c - lo) / (hi - lo));
  };

  const points = drawable
    ? series.map((v, i) => `${((i / denom) * width).toFixed(2)},${yFor(v).toFixed(2)}`).join(' ')
    : '';
  const zeroVisible = lo <= 0 && hi >= 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        !drawable
          ? 'No chart data yet'
          : mode === 'band'
            ? `Intraday change, fixed ${band} percent scale`
            : 'Change over the selected period'
      }
      className="shrink-0"
    >
      {/* Zero line: the fixed anchor. In auto mode it draws at its true
          position and disappears only when 0% is outside the domain. */}
      {zeroVisible && (
        <line x1={0} y1={yFor(0)} x2={width} y2={yFor(0)} stroke={ZERO_LINE_COLOR} strokeWidth={1} />
      )}
      {drawable && (
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {/* Pin markers, band mode only: the line is clamped at the band edge. */}
      {mode === 'band' && pinnedHigh && (
        <polygon
          points={`${width - 10},${EDGE_PAD + 4} ${width - 2},${EDGE_PAD + 4} ${width - 6},${EDGE_PAD}`}
          fill={UP_MAX}
        >
          <title>Pinned at +{band}%</title>
        </polygon>
      )}
      {mode === 'band' && pinnedLow && (
        <polygon
          points={`${width - 10},${height - EDGE_PAD - 4} ${width - 2},${height - EDGE_PAD - 4} ${width - 6},${height - EDGE_PAD}`}
          fill={DOWN_MAX}
        >
          <title>Pinned at -{band}%</title>
        </polygon>
      )}
    </svg>
  );
}
