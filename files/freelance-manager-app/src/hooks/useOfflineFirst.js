import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// localStorage helpers
const loadLocal = (key, fallback) => {
  try {
    const v = localStorage.getItem(`fm_${key}`);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};

const saveLocal = (key, value) => {
  try { localStorage.setItem(`fm_${key}`, JSON.stringify(value)); } catch {}
};

// Track pending changes for sync
const getPendingChanges = () => loadLocal('_pending', []);
const savePendingChanges = (changes) => saveLocal('_pending', changes);

const addPendingChange = (table, action, data) => {
  const pending = getPendingChanges();
  pending.push({ table, action, data, timestamp: Date.now() });
  savePendingChanges(pending);
};

/**
 * useOfflineFirst hook
 * 
 * - State lives in localStorage (instant, works offline)
 * - Changes queue to Supabase when online
 * - On mount, pulls latest from Supabase and merges
 * 
 * @param {string} key - localStorage key and Supabase table name
 * @param {any} fallback - default value
 * @param {string} tableName - Supabase table name (if different from key)
 */
export function useOfflineFirst(key, fallback, tableName) {
  const table = tableName || key;
  const [data, setDataRaw] = useState(() => loadLocal(key, fallback));
  const syncingRef = useRef(false);
  const lastSyncRef = useRef(0);

  // Save to localStorage whenever data changes
  useEffect(() => {
    saveLocal(key, data);
  }, [key, data]);

  // Wrapped setter that also queues sync
  const setData = useCallback((updater) => {
    setDataRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);

  // Pull from Supabase on mount and periodically
  useEffect(() => {
    if (!isSupabaseConfigured() || typeof fallback !== 'object') return;
    if (!Array.isArray(fallback)) return; // only sync arrays (collections)

    const pullFromSupabase = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const { data: remote, error } = await supabase
          .from(table)
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error && remote) {
          // Merge: remote wins for items that exist, keep local-only items
          const local = loadLocal(key, fallback);
          const remoteIds = new Set(remote.map(r => r.id));
          const localOnly = local.filter(l => !remoteIds.has(l.id));
          
          // Convert snake_case from Supabase to camelCase
          const merged = [...remote.map(snakeToCamel), ...localOnly];
          setDataRaw(merged);
          saveLocal(key, merged);
          lastSyncRef.current = Date.now();
        }
      } catch (err) {
        console.warn(`Sync pull failed for ${table}:`, err);
      }
      syncingRef.current = false;
    };

    pullFromSupabase();
    const interval = setInterval(pullFromSupabase, 60000); // sync every minute
    return () => clearInterval(interval);
  }, [key, table]);

  // Push to Supabase
  const pushToSupabase = useCallback(async (action, item) => {
    if (!isSupabaseConfigured()) return;
    
    try {
      const record = camelToSnake(item);
      if (action === 'upsert') {
        await supabase.from(table).upsert(record, { onConflict: 'id' });
      } else if (action === 'delete') {
        await supabase.from(table).delete().eq('id', item.id);
      }
    } catch (err) {
      console.warn(`Sync push failed for ${table}:`, err);
      addPendingChange(table, action, item);
    }
  }, [table]);

  return [data, setData, pushToSupabase];
}

/**
 * useOfflineSettings - for the single settings object (not a collection)
 */
export function useOfflineSettings(key, fallback) {
  const [data, setDataRaw] = useState(() => loadLocal(key, fallback));

  useEffect(() => {
    saveLocal(key, data);
  }, [key, data]);

  const setData = useCallback((updater) => {
    setDataRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);

  // Sync settings to/from Supabase as a single row
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const pull = async () => {
      try {
        const { data: rows } = await supabase
          .from('settings')
          .select('*')
          .limit(1);
        if (rows && rows.length > 0) {
          const remote = snakeToCamel(rows[0]);
          const local = loadLocal(key, fallback);
          // Local wins for most fields, but merge
          const merged = { ...remote, ...local };
          setDataRaw(merged);
          saveLocal(key, merged);
        }
      } catch {}
    };
    pull();
  }, []);

  return [data, setData];
}

// Flush pending changes (call on reconnect)
export async function flushPendingChanges() {
  if (!isSupabaseConfigured()) return;
  const pending = getPendingChanges();
  if (pending.length === 0) return;

  const failed = [];
  for (const change of pending) {
    try {
      const record = camelToSnake(change.data);
      if (change.action === 'upsert') {
        await supabase.from(change.table).upsert(record, { onConflict: 'id' });
      } else if (change.action === 'delete') {
        await supabase.from(change.table).delete().eq('id', change.data.id);
      }
    } catch {
      failed.push(change);
    }
  }
  savePendingChanges(failed);
}

// Case conversion utilities
function camelToSnake(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = v && typeof v === 'object' && !Array.isArray(v) ? camelToSnake(v) : v;
  }
  return result;
}

function snakeToCamel(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = v && typeof v === 'object' && !Array.isArray(v) ? snakeToCamel(v) : v;
  }
  return result;
}
