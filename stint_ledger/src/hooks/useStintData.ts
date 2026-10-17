import { useState, useEffect, useCallback } from 'react';
import type { StintData } from '../lib/types';
import { fetchStintData } from '../lib/supabase';
import { saveStintCache, loadStintCache } from '../lib/storage';
import { useDemo, demoRead } from '../lib/demo';
import { buildDemoStint } from '../lib/demoData';

export function useStintData() {
  const demo = useDemo();
  const [data, setData] = useState<StintData>(() => demo ? demoRead('stint', buildDemoStint) : {
    clients: [],
    projects: [],
    timeEntries: [],
    pencils: [],
    invoices: [],
    settings: null,
    lastSynced: null,
  });
  const [loading, setLoading] = useState(!demo);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached data first, then try to sync
  useEffect(() => {
    if (demo) return;
    let mounted = true;
    (async () => {
      try {
        // Load from cache
        const cached = await loadStintCache();
        if (cached && mounted) {
          setData(cached);
          setLoading(false);
        }
        // Try remote sync
        if (mounted) {
          setSyncing(true);
          const remote = await fetchStintData();
          await saveStintCache(remote);
          if (mounted) {
            setData({ ...remote, lastSynced: Date.now() });
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setSyncing(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [demo]);

  const refresh = useCallback(async () => {
    // Demo Stint data is static
    if (demo) return;
    setSyncing(true);
    setError(null);
    try {
      const remote = await fetchStintData();
      await saveStintCache(remote);
      setData({ ...remote, lastSynced: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [demo]);

  return { data, loading, syncing, error, refresh };
}
