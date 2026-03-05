import React, { Component, useState } from 'react';
import type { ViewId } from './lib/types';
import { useStintData } from './hooks/useStintData';
import { useAccountBalances } from './hooks/useAccountBalances';
import { useSettingsSync } from './hooks/useSettingsSync';
import { Navigation } from './components/Navigation';
import { Dashboard } from './views/Dashboard';
import { Utilization } from './views/Utilization';
import { Pipeline } from './views/Pipeline';
import { Invoices } from './views/Invoices';
import { Planner } from './views/Planner';
import { NetWorth } from './views/NetWorth';
import { Retirement } from './views/Retirement';
import { Expenses } from './views/Expenses';

class ErrorBoundary extends Component<
  { children: React.ReactNode; onReset: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-red-900/30 border border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-red-300 mb-2">Something went wrong</h2>
            <pre className="text-xs text-red-200 bg-black/30 rounded p-3 mb-4 overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => {
                this.setState({ error: null });
                this.props.onReset();
              }}
              className="w-full py-2 bg-surface-2 text-gray-200 rounded hover:bg-surface-3 transition-colors text-sm"
            >
              Go back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_MONTHLY_EXPENSES = 8750;

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard');
  const { data, loading, syncing, error, refresh } = useStintData();
  const { balances, detailed, setDetailed, loaded } = useAccountBalances();
  const sync = useSettingsSync();

  if (loading && !loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-2">Stint Ledger</div>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onReset={() => setView('dashboard')}>
      <div className="min-h-screen">
        <Navigation
          active={view}
          onNavigate={setView}
          syncing={syncing}
          onRefresh={refresh}
          lastSynced={data.lastSynced}
          onPush={sync.push}
          onPull={() => {
            if (confirm('This will replace all local settings with the last pushed version. Continue?'))
              sync.pull();
          }}
          pushing={sync.pushing}
          pulling={sync.pulling}
          lastPushed={sync.lastPushed}
          lastPulled={sync.lastPulled}
          serverUpdatedAt={sync.serverUpdatedAt}
          syncError={sync.error}
        />

        {/* Main content area */}
        <main className="md:ml-56 pb-28 md:pb-6 p-4 md:p-6 max-w-5xl">
          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-300">
              {error}
              <button onClick={refresh} className="ml-2 underline">Retry</button>
            </div>
          )}

          {view === 'dashboard' && (
            <Dashboard data={data} balances={balances} monthlyExpenses={DEFAULT_MONTHLY_EXPENSES} />
          )}
          {view === 'utilization' && <Utilization data={data} />}
          {view === 'pipeline' && <Pipeline data={data} />}
          {view === 'invoices' && <Invoices data={data} />}
          {view === 'planner' && <Planner data={data} balances={balances} />}
          {view === 'expenses' && <Expenses data={data} balances={balances} />}
          {view === 'networth' && (
            <NetWorth detailed={detailed} balances={balances} onSave={setDetailed} monthlyExpenses={DEFAULT_MONTHLY_EXPENSES} />
          )}
          {view === 'retirement' && <Retirement balances={balances} />}
        </main>
      </div>
    </ErrorBoundary>
  );
}
