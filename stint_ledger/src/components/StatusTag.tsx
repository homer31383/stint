import React from 'react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-700 text-gray-300',
  sent: 'bg-blue-900/50 text-blue-400',
  paid: 'bg-emerald-900/50 text-emerald-400',
  overdue: 'bg-red-900/50 text-red-400',
  active: 'bg-emerald-900/50 text-emerald-400',
  on_hold: 'bg-yellow-900/50 text-yellow-400',
  complete: 'bg-gray-700 text-gray-300',
  booked: 'bg-emerald-900/50 text-emerald-400',
  pencil: 'bg-yellow-900/50 text-yellow-400',
  'pencil 2': 'bg-orange-900/50 text-orange-400',
  'pencil 3': 'bg-gray-700 text-gray-400',
};

interface StatusTagProps {
  status: string;
  className?: string;
}

export function StatusTag({ status, className = '' }: StatusTagProps) {
  const colors = STATUS_COLORS[status] ?? 'bg-gray-700 text-gray-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${colors} ${className}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
