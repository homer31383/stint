import React from 'react';
import type { ViewId } from '../lib/types';
import { Fleuron } from './Ink';

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
  { id: 'plans', label: 'Plans', icon: '☰' },
  { id: 'export', label: 'Export', icon: '↗' },
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
  onSignOut?: () => void;
}

function fmtTs(iso: string | null | undefined) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function Navigation({
  active, onNavigate, syncing, onRefresh, lastSynced,
  onPush, onPull, pushing, pulling, lastPushed, lastPulled, serverUpdatedAt, syncError, onSignOut,
}: NavigationProps) {
  return (
    <>
      {/* Desktop sidebar: desk-toned, active item is a small paper tab */}
      <nav className="nav-desk hidden md:flex flex-col w-56 h-screen fixed left-0 top-0 z-30">
        <div className="p-5 border-b border-sagelabel/10">
          <h1 className="fj-wordmark text-lg inline-flex items-center gap-1.5">
            Stint Ledger
            <Fleuron className="text-sagelabel/80" />
          </h1>
          <p className="hand fj-desk-dim text-base leading-none mt-0.5">the field journal</p>
        </div>
        <div className="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full text-left px-5 py-2 text-sm flex items-center gap-3 ${
                active === item.id ? 'active' : ''
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-sagelabel/10 space-y-3">
          {/* Settings sync */}
          <div>
            <div className="hand fj-desk-dim text-base leading-none mb-1.5">settings sync</div>
            <div className="flex gap-2">
              <button onClick={onPush} disabled={pushing || pulling} className="btn-tag flex-1">
                {pushing ? 'Pushing' : 'Push ↑'}
              </button>
              <button onClick={onPull} disabled={pushing || pulling} className="btn-tag flex-1">
                {pulling ? 'Pulling' : 'Pull ↓'}
              </button>
            </div>
            <div className="mt-1.5 space-y-0.5 text-[10px] font-mono fj-desk-dim">
              <div>Server: {fmtTs(serverUpdatedAt)}</div>
              <div>Pushed: {fmtTs(lastPushed)}</div>
              <div>Pulled: {fmtTs(lastPulled)}</div>
            </div>
            {syncError && (
              <div className="mt-1 text-[10px] font-mono text-clay break-words">{syncError}</div>
            )}
          </div>

          {/* Refresh data */}
          <div>
            <button onClick={onRefresh} disabled={syncing} className="btn-stamp on-desk w-full">
              {syncing ? 'Syncing' : 'Refresh data'}
            </button>
            {lastSynced && (
              <div className="text-[10px] font-mono fj-desk-dim mt-1">
                Last sync: {new Date(lastSynced).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Sign out */}
          <button onClick={onSignOut} className="btn-link clay w-full text-center">
            Sign out
          </button>
        </div>
      </nav>

      {/* Mobile sync bar */}
      <div className="tabbar md:hidden fixed bottom-[calc(var(--mobile-tab-height,3.5rem)+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 px-3 py-1.5 flex items-center gap-2">
        <button onClick={onPush} disabled={pushing || pulling} className="btn-tag">
          {pushing ? '…' : 'Push ↑'}
        </button>
        <button onClick={onPull} disabled={pushing || pulling} className="btn-tag">
          {pulling ? '…' : 'Pull ↓'}
        </button>
        <span className="text-[10px] font-mono fj-desk-dim ml-auto">Server: {fmtTs(serverUpdatedAt)}</span>
        {syncError && <span className="text-[10px] font-mono text-clay truncate max-w-[120px]">{syncError}</span>}
      </div>

      {/* Mobile bottom tabs */}
      <nav className="tabbar md:hidden fixed bottom-0 left-0 right-0 z-30 safe-area-pb">
        <div className="flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`tab-item flex-1 py-1.5 pt-2 flex flex-col items-center text-[10px] ${
                active === item.id ? 'active' : ''
              }`}
            >
              <span className="tab-pill">
                <span className="text-lg leading-none">{item.icon}</span>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
