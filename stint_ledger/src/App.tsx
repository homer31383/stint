import React, { Component, useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ViewId } from './lib/types';
import { supabase } from './lib/supabase';
import { useStintData } from './hooks/useStintData';
import { useAccountBalances } from './hooks/useAccountBalances';
import { useSettingsSync } from './hooks/useSettingsSync';
import { Navigation } from './components/Navigation';
import { Login } from './components/Login';
import { Fleuron } from './components/Ink';
import { Dashboard } from './views/Dashboard';
import { Utilization } from './views/Utilization';
import { Pipeline } from './views/Pipeline';
import { Invoices } from './views/Invoices';
import { Planner } from './views/Planner';
import { NetWorth } from './views/NetWorth';
import { Retirement } from './views/Retirement';
import { Expenses } from './views/Expenses';
import { Plans } from './views/Plans';
import { Export } from './views/Export';

// Field Journal theme hooks into the document. The body class scopes every
// themed rule in index.css and the theme color matches the desk. main.tsx
// only loads this module on the main app route, so /tickers is untouched.
document.body.classList.add('fj');
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#17211a');

// Papers settle one by one on view entry, 50ms apart. Cards past the cap
// land together so long views do not take forever. Cut to 6 if view entry
// feels sluggish on Android Chrome over LAN.
const SETTLE_STAGGER_CAP = 10;

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
          <div className="paper paper-3 paper-pad max-w-md w-full">
            <div className="washi washi-clay" />
            <h2 className="serif text-lg font-semibold text-oxblood mb-2">Something went wrong</h2>
            <pre className="text-xs text-ink-2 bg-paper3 rounded p-3 mb-4 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => {
                this.setState({ error: null });
                this.props.onReset();
              }}
              className="btn-tag w-full"
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

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="fj-wordmark text-2xl inline-flex items-center gap-2 mb-1">
          Stint Ledger
          <Fleuron className="text-sagelabel/80" />
        </div>
        <div className="hand fj-desk-dim text-xl">loading...</div>
      </div>
    </div>
  );
}

const DEFAULT_MONTHLY_EXPENSES = 8750;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<ViewId>('dashboard');
  const { data, loading, syncing, error, refresh } = useStintData();
  const { balances, detailed, setDetailed, loaded } = useAccountBalances();
  const sync = useSettingsSync();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Assign each paper scrap its settle order before first paint of a view.
  // Cards added later by state changes have no index and land immediately.
  useLayoutEffect(() => {
    const root = mainRef.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>('.paper, .scrap');
    cards.forEach((el, i) => el.style.setProperty('--i', String(Math.min(i, SETTLE_STAGGER_CAP))));
  }, [view, session, authLoading, loading, loaded]);

  if (authLoading) return <LoadingScreen />;

  if (!session) return <Login />;

  if (loading && !loaded) return <LoadingScreen />;

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
          onSignOut={() => supabase.auth.signOut()}
        />

        {/* Main content area */}
        <main ref={mainRef} className="fj-main md:ml-56 pb-28 md:pb-6 p-4 md:p-6 max-w-5xl">
          {error && (
            <div className="callout callout-bad mb-4 text-sm">
              {error}
              <button onClick={refresh} className="btn-link clay ml-2">Retry</button>
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
          {view === 'plans' && <Plans />}
          {view === 'export' && <Export data={data} balances={balances} detailed={detailed} />}
        </main>
      </div>
    </ErrorBoundary>
  );
}
