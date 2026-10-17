import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AccountBalances, DetailedBalances } from '../lib/types';
import { DEFAULT_DETAILED, toAggregateBalances } from '../lib/types';
import { saveDetailedBalances, loadDetailedBalances } from '../lib/storage';
import { useDemo, demoRead, demoWrite } from '../lib/demo';
import { buildDemoDetailed } from '../lib/demoData';

export function useAccountBalances() {
  const demo = useDemo();
  const [detailed, setDetailed] = useState<DetailedBalances>(
    () => demo ? demoRead('balances', buildDemoDetailed) : DEFAULT_DETAILED,
  );
  const [loaded, setLoaded] = useState(demo);

  useEffect(() => {
    if (demo) return;
    (async () => {
      const saved = await loadDetailedBalances();
      if (saved) setDetailed(saved);
      setLoaded(true);
    })();
  }, [demo]);

  const balances: AccountBalances = useMemo(() => toAggregateBalances(detailed), [detailed]);

  const saveDetailed = useCallback(async (updated: DetailedBalances) => {
    setDetailed(updated);
    if (demo) demoWrite('balances', updated);
    else await saveDetailedBalances(updated);
  }, [demo]);

  return { balances, detailed, setDetailed: saveDetailed, loaded };
}
