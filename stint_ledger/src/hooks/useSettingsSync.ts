import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { gatherAllSettings, applyAllSettings } from '../lib/storage';

const LS_PUSHED = 'settings-sync-last-pushed';
const LS_PULLED = 'settings-sync-last-pulled';

function extractMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

export function useSettingsSync() {
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [lastPushed, setLastPushed] = useState<string | null>(
    () => localStorage.getItem(LS_PUSHED),
  );
  const [lastPulled, setLastPulled] = useState<string | null>(
    () => localStorage.getItem(LS_PULLED),
  );
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch server timestamp on mount
  useEffect(() => {
    supabase
      .from('ledger_sync')
      .select('updated_at')
      .eq('id', 'default')
      .single()
      .then(({ data, error: err }) => {
        if (err) return; // table may not exist yet
        if (data?.updated_at) setServerUpdatedAt(data.updated_at);
      });
  }, []);

  const push = useCallback(async () => {
    setPushing(true);
    setError(null);
    try {
      const blob = await gatherAllSettings();
      const now = new Date().toISOString();
      const resp = await supabase.from('ledger_sync').upsert({
        id: 'default',
        data: blob,
        updated_at: now,
      });
      if (resp.error) throw resp.error;
      localStorage.setItem(LS_PUSHED, now);
      setLastPushed(now);
      setServerUpdatedAt(now);
    } catch (e: unknown) {
      setError(extractMessage(e));
    } finally {
      setPushing(false);
    }
  }, []);

  const pull = useCallback(async () => {
    setPulling(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('ledger_sync')
        .select('data, updated_at')
        .eq('id', 'default')
        .single();
      if (err) throw err;
      if (!data?.data) throw new Error('No settings found on server');
      await applyAllSettings(data.data);
      const now = new Date().toISOString();
      localStorage.setItem(LS_PULLED, now);
      setLastPulled(now);
      if (data.updated_at) setServerUpdatedAt(data.updated_at);
      window.location.reload();
    } catch (e: unknown) {
      setError(extractMessage(e));
      setPulling(false);
    }
  }, []);

  return { pushing, pulling, lastPushed, lastPulled, serverUpdatedAt, error, push, pull };
}
