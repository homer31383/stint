import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  className?: string;
}

export function StatCard({ label, value, sub, color, className = '' }: StatCardProps) {
  return (
    <div className={`bg-surface-2 rounded-lg p-4 ${className}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-mono text-xl font-semibold ${color ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
