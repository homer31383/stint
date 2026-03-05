import React, { useState } from 'react';
import type { ViewId } from './lib/types';
import { useStintData } from './hooks/useStintData';
import { useAccountBalances } from './hooks/useAccountBalances';
import { Navigation } from './components/Navigation';
import { Dashboard } from './views/Dashboard';
import { Utilization } from './views/Utilization';
import { Pipeline } from './views/Pipeline';
import { Invoices } from './views/Invoices';
import { Planner } from './views/Planner';
import { NetWorth } from './views/NetWorth';
import { Retirement } from './views/Retirement';
import { Expenses } from './views/Expenses';

const DEFAULT_MONTHLY_EXPENSES = 8750;

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard');
  const { data, loading, syncing, error, refresh } = useStintData();
  const { balances, detailed, setDetailed, loaded } = useAccountBalances();

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
    <div className="min-h-screen">
      <Navigation
        active={view}
        onNavigate={setView}
        syncing={syncing}
        onRefresh={refresh}
        lastSynced={data.lastSynced}
      />

      {/* Main content area */}
      <main className="md:ml-56 pb-20 md:pb-6 p-4 md:p-6 max-w-5xl">
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
  );
}
