import React from 'react';
import type { ViewId } from '../lib/types';

interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'utilization', label: 'Utilization', icon: '◧' },
  { id: 'pipeline', label: 'Pipeline', icon: '▤' },
  { id: 'invoices', label: 'Invoices', icon: '⊡' },
  { id: 'planner', label: 'Planner', icon: '⟐' },
  { id: 'expenses', label: 'Expenses', icon: '⊘' },
  { id: 'networth', label: 'Net Worth', icon: '◉' },
  { id: 'retirement', label: 'Retirement', icon: '◇' },
];

interface NavigationProps {
  active: ViewId;
  onNavigate: (id: ViewId) => void;
  syncing?: boolean;
  onRefresh?: () => void;
  lastSynced?: number | null;
}

export function Navigation({ active, onNavigate, syncing, onRefresh, lastSynced }: NavigationProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 bg-surface-1 border-r border-surface-3 h-screen fixed left-0 top-0 z-30">
        <div className="p-5 border-b border-surface-3">
          <h1 className="text-lg font-bold text-white tracking-tight">Stint Ledger</h1>
          <p className="text-xs text-gray-500 mt-0.5">Financial Dashboard</p>
        </div>
        <div className="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full text-left px-5 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                active === item.id
                  ? 'text-accent bg-accent/10 border-r-2 border-accent'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-2'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-surface-3">
          <button
            onClick={onRefresh}
            disabled={syncing}
            className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Refresh data'}
          </button>
          {lastSynced && (
            <div className="text-[10px] text-gray-600 mt-1">
              Last sync: {new Date(lastSynced).toLocaleTimeString()}
            </div>
          )}
        </div>
      </nav>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-surface-3 z-30 safe-area-pb">
        <div className="flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex-1 py-2 pt-2.5 flex flex-col items-center gap-0.5 text-[10px] transition-colors ${
                active === item.id ? 'text-accent' : 'text-gray-500'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
