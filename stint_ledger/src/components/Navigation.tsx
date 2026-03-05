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
  onPush?: () => void;
  onPull?: () => void;
  pushing?: boolean;
  pulling?: boolean;
  lastPushed?: string | null;
  lastPulled?: string | null;
  serverUpdatedAt?: string | null;
  syncError?: string | null;
}

function fmtTs(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function Navigation({
  active, onNavigate, syncing, onRefresh, lastSynced,
  onPush, onPull, pushing, pulling, lastPushed, lastPulled, serverUpdatedAt, syncError,
}: NavigationProps) {
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
        <div className="p-4 border-t border-surface-3 space-y-3">
          {/* Settings sync */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Settings Sync</div>
            <div className="flex gap-2">
              <button
                onClick={onPush}
                disabled={pushing || pulling}
                className="flex-1 text-[11px] px-2 py-1 rounded bg-surface-2 text-gray-400 hover:text-gray-200 hover:bg-surface-3 transition-colors disabled:opacity-50"
              >
                {pushing ? 'Pushing…' : 'Push ↑'}
              </button>
              <button
                onClick={onPull}
                disabled={pushing || pulling}
                className="flex-1 text-[11px] px-2 py-1 rounded bg-surface-2 text-gray-400 hover:text-gray-200 hover:bg-surface-3 transition-colors disabled:opacity-50"
              >
                {pulling ? 'Pulling…' : 'Pull ↓'}
              </button>
            </div>
            <div className="mt-1 space-y-0.5 text-[10px] text-gray-600">
              <div>Server: {fmtTs(serverUpdatedAt)}</div>
              <div>Pushed: {fmtTs(lastPushed)}</div>
              <div>Pulled: {fmtTs(lastPulled)}</div>
            </div>
            {syncError && (
              <div className="mt-1 text-[10px] text-red-400 break-words">{syncError}</div>
            )}
          </div>

          {/* Refresh data */}
          <div>
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
        </div>
      </nav>

      {/* Mobile sync bar */}
      <div className="md:hidden fixed bottom-[calc(var(--mobile-tab-height,3.5rem)+env(safe-area-inset-bottom,0px))] left-0 right-0 bg-surface-1 border-t border-surface-3 z-30 px-3 py-1.5 flex items-center gap-2">
        <button
          onClick={onPush}
          disabled={pushing || pulling}
          className="text-[11px] px-2.5 py-1 rounded bg-surface-2 text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          {pushing ? '…' : 'Push ↑'}
        </button>
        <button
          onClick={onPull}
          disabled={pushing || pulling}
          className="text-[11px] px-2.5 py-1 rounded bg-surface-2 text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          {pulling ? '…' : 'Pull ↓'}
        </button>
        <span className="text-[10px] text-gray-600 ml-auto">Server: {fmtTs(serverUpdatedAt)}</span>
        {syncError && <span className="text-[10px] text-red-400 truncate max-w-[120px]">{syncError}</span>}
      </div>

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
