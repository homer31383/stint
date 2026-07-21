// Fixed-band intraday sparkline. The y axis is a fixed -band..+band percent
// and never auto-scales, so a 0.1% drift draws nearly flat while a 2% selloff
// visibly fills the frame. Every ticker uses the same band, which makes the
// charts directly comparable to each other. Values outside the band are
// clamped to the edge and a small pin marker appears at that edge.

export const BAND = 3; // percent: the default and reset band, y domain -BAND to +BAND

// A full US regular session is 6.5 hours of 5 minute bars. Partial sessions
// (mid-day, early close) draw only the left portion of the frame instead of
// stretching to full width, so the line grows across the day.
const FULL_SESSION_POINTS = 78;

// Color intensity scales with move magnitude inside the band: near 0% the
// line and number sit at neutral gray and blend toward vibrant up/down
// endpoints as the move approaches +-band. The ramp is eased (quadratic) so
// the last stretch of the band gains saturation much faster than the first:
// small moves stay calm while a move at or past the edge is unmistakable.
// Clamped/pinned values cap at t = 1, so they always get maximum vibrancy.
const NEUTRAL_RGB = [107, 114, 128] as const; // gray-500
const UP_RGB = [77, 199, 134] as const; // #4dc786, saturated but not neon
const DOWN_RGB = [222, 112, 104] as const; // #de7068

function easedMagnitude(changePct: number, band: number): number {
  const t = Math.min(Math.abs(changePct) / band, 1);
  // Ease-in: at 70% of the band this yields ~0.5, leaving the other half of
  // the color progression for the final 30%.
  return t * t;
}

// Line and text color for a given percent change, scaled to the active band
// so color intensity always matches how full the chart frame is.
export function intensityColor(changePct: number, band: number = BAND): string {
  const e = easedMagnitude(changePct, band);
  const end = changePct >= 0 ? UP_RGB : DOWN_RGB;
  const mix = NEUTRAL_RGB.map((n, i) => Math.round(n + (end[i] - n) * e));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

// Row background wash on the same eased scale, topping out at 13% opacity
// at the band edge.
export function intensityTint(changePct: number, band: number = BAND): string {
  const e = easedMagnitude(changePct, band);
  const end = changePct >= 0 ? UP_RGB : DOWN_RGB;
  return `rgba(${end[0]}, ${end[1]}, ${end[2]}, ${(0.13 * e).toFixed(3)})`;
}

// Pin markers always render at full vibrancy in the direction they pinned:
// they exist precisely because the line exceeded the band, even on a day
// whose net change (and therefore line color) ends up small.
const UP_MAX = `rgb(${UP_RGB[0]}, ${UP_RGB[1]}, ${UP_RGB[2]})`;
const DOWN_MAX = `rgb(${DOWN_RGB[0]}, ${DOWN_RGB[1]}, ${DOWN_RGB[2]})`;

const ZERO_LINE_COLOR = '#2e3542';
const EDGE_PAD = 1.5; // keep the stroke inside the viewBox at the band edges

interface TickerSparklineProps {
  series: number[]; // percent change from previous close, chronological
  changePct: number; // the day's change, drives color intensity
  band?: number; // y domain half width in percent, same for every ticker
  width?: number;
  height?: number;
}

export function TickerSparkline({ series, changePct, band = BAND, width = 100, height = 40 }: TickerSparklineProps) {
  const mid = height / 2;
  const halfSpan = mid - EDGE_PAD;

  const clamped = series.map((v) => Math.max(-band, Math.min(band, v)));
  const pinnedHigh = series.some((v) => v > band);
  const pinnedLow = series.some((v) => v < -band);

  const lineColor = intensityColor(changePct, band);

  // Fewer than 2 points: zero line only. This covers pre-market, a fresh
  // session, and mutual funds that price once daily with no intraday series,
  // detected generically by point count rather than by ticker.
  const drawable = clamped.length >= 2;
  const denom = Math.max(clamped.length, FULL_SESSION_POINTS) - 1;
  const points = drawable
    ? clamped
        .map((v, i) => {
          const x = (i / denom) * width;
          const y = mid - (v / band) * halfSpan;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ')
    : '';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={drawable ? `Intraday change, fixed ${band} percent scale` : 'No intraday data yet'}
      className="shrink-0"
    >
      {/* Zero line: the fixed anchor that makes flat days look flat. */}
      <line x1={0} y1={mid} x2={width} y2={mid} stroke={ZERO_LINE_COLOR} strokeWidth={1} />
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
      {/* Pin markers: the line is clamped at the band edge somewhere. */}
      {pinnedHigh && (
        <polygon
          points={`${width - 10},${EDGE_PAD + 4} ${width - 2},${EDGE_PAD + 4} ${width - 6},${EDGE_PAD}`}
          fill={UP_MAX}
        >
          <title>Pinned at +{band}%</title>
        </polygon>
      )}
      {pinnedLow && (
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
