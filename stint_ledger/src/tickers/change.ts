// Price rows from /api/tickers and the timeframe change math, shared by the
// Tickers tab and the Olinda tab so both compute "% over the range" the
// same way.

export interface TickerRow {
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
  sessionStart?: number;
  error?: string;
}

// Change over the selected timeframe. On 1D the reference is the previous
// close; on longer ranges it is the first close in the period, so the
// percent change is (last - first) / first.
export function changeFor(row: TickerRow, is1D: boolean): { pct: number; series: number[]; ref: number } | null {
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
