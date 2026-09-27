import React from 'react';
import { InkCircle } from './Ink';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  className?: string;
  /** Draw a hand-drawn ink circle around the value (data-driven only). */
  circled?: boolean;
}

// A small paper scrap. Tone and tilt alternate by position via .scrap:nth-child.
export function StatCard({ label, value, sub, color, className = '', circled }: StatCardProps) {
  return (
    <div className={`scrap ${className}`}>
      <div className="scrap-label">{label}</div>
      <div className={`scrap-value ${color ?? ''}`}>{circled ? <InkCircle>{value}</InkCircle> : value}</div>
      {sub && <div className="scrap-sub">{sub}</div>}
    </div>
  );
}
