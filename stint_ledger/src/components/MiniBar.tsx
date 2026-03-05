import React from 'react';

interface MiniBarProps {
  value: number;
  max: number;
  color?: string;
  className?: string;
}

export function MiniBar({ value, max, color = 'bg-accent', className = '' }: MiniBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`h-2 bg-surface-3 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
