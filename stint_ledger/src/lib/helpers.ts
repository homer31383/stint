// Format currency: monospace, comma-separated, no decimals, proper minus sign
export function fmt(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toLocaleString('en-US');
  if (n < 0) return `−$${formatted}`;
  return `$${formatted}`;
}

// Compact figure for chart labels: 840, 1.4k, 8.4k, 12k, 1.9M
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '\u2212' : '';
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e3)}k`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}k`;
  return `${sign}${Math.round(abs)}`;
}

// Format percentage
export function fmtPct(n: number, decimals = 0): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

// Count weekdays between two dates (inclusive)
export function weekdaysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Count weekdays elapsed in year up to date
export function weekdaysElapsedYTD(year: number, upTo?: Date): number {
  const end = upTo ?? new Date();
  const start = new Date(year, 0, 1);
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Get month name
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthName(m: number): string {
  return MONTHS[m] ?? '';
}

// Parse ISO date string to Date
export function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

// Get current year
export function currentYear(): number {
  return new Date().getFullYear();
}

// Format date for display
export function fmtDate(s: string): string {
  if (!s) return '';
  const d = parseDate(s);
  return `${monthName(d.getMonth())} ${d.getDate()}, ${d.getFullYear()}`;
}

// Short date
export function fmtDateShort(s: string): string {
  if (!s) return '';
  const d = parseDate(s);
  return `${monthName(d.getMonth())} ${d.getDate()}`;
}

// Clamp
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
