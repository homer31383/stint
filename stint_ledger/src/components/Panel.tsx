import React from 'react';

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function Panel({ title, children, className = '', action }: PanelProps) {
  return (
    <div className={`bg-surface-1 rounded-xl p-4 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
