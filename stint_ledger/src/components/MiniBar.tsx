import React from 'react';

interface MiniBarProps {
  value: number;
  max: number;
  color?: string;
  className?: string;
}

// A thin cut-paper strip that fills left to right.
export function MiniBar({ value, max, color = 'bg-fern', className = '' }: MiniBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`pstrip ${className}`}>
      <div className={`pstrip-fill ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
