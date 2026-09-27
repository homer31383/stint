import React from 'react';

// Rubber stamp colors: PAID / BOOKED forest, SENT / PENCIL amber,
// OVERDUE oxblood (heavier), DRAFT ink-dim.
const STAMP_CLASS: Record<string, string> = {
  draft: 'stamp-dim',
  sent: 'stamp-pencil',
  paid: 'stamp-forest',
  overdue: 'stamp-oxblood',
  active: 'stamp-forest',
  on_hold: 'stamp-pencil',
  complete: 'stamp-dim',
  booked: 'stamp-forest',
  pencil: 'stamp-pencil',
  'pencil 2': 'stamp-clay',
  'pencil 3': 'stamp-dim',
};

// Stable per-instance rotation between -6deg and +3deg from a tiny hash.
export function stampRotation(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return -6 + (h % 91) / 10;
}

interface StatusTagProps {
  status: string;
  className?: string;
  /** Varies the stamp angle per instance (an id works well). Defaults to the status text. */
  seed?: string;
}

export function StatusTag({ status, className = '', seed }: StatusTagProps) {
  const cls = STAMP_CLASS[status.toLowerCase()] ?? 'stamp-dim';
  const rot = stampRotation(seed ?? status);
  return (
    // Keyed on the status so a real status change presses a fresh stamp.
    <span
      key={status}
      className={`stamp ${cls} ${className}`}
      style={{ '--stamp-rot': `${rot.toFixed(1)}deg` } as React.CSSProperties}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
