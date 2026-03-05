import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AccountBalances, DetailedBalances } from '../lib/types';
import { DEFAULT_DETAILED, toAggregateBalances } from '../lib/types';
import { saveDetailedBalances, loadDetailedBalances } from '../lib/storage';

export function useAccountBalances() {
  const [detailed, setDetailed] = useState<DetailedBalances>(DEFAULT_DETAILED);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadDetailedBalances();
      if (saved) setDetailed(saved);
      setLoaded(true);
    })();
  }, []);

  const balances: AccountBalances = useMemo(() => toAggregateBalances(detailed), [detailed]);

  const saveDetailed = useCallback(async (updated: DetailedBalances) => {
    setDetailed(updated);
    await saveDetailedBalances(updated);
  }, []);

  return { balances, detailed, setDetailed: saveDetailed, loaded };
}
