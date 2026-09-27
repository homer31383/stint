import React from 'react';

interface MiniBarProps {
  value: number;
  max: number;
  color?: string;
  className?: string;
  /** Compact value shown above the strip (mono, data only). */
  label?: string;
}

// A thin cut-paper strip that fills left to right.
export function MiniBar({ value, max, color = 'bg-fern', className = '', label }: MiniBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const strip = (
    <div className={`pstrip ${label === undefined ? className : ''}`}>
      <div className={`pstrip-fill ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
  if (label === undefined) return strip;
  return (
    <div className={className}>
      <div className="bar-label-inline">{label}</div>
      {strip}
    </div>
  );
}
