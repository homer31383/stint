import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

const TABLE_MAP = {
  clients: "stint_clients",
  projects: "stint_projects",
  time: "stint_time_entries",
  pencils: "stint_pencils",
  invoices: "stint_invoices",
  settings: "stint_settings",
};

const loadLocal = (key, fb) => {
  try { const v = localStorage.getItem("stint_" + key); return v ? JSON.parse(v) : fb; }
  catch { return fb; }
};
const saveLocal = (key, val) => {
  try { localStorage.setItem("stint_" + key, JSON.stringify(val)); } catch {}
};

function camelToSnake(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const r = {};
  for (const [k, v] of Object.entries(obj))
    r[k.replace(/[A-Z]/g, m => "_" + m.toLowerCase())] = v && typeof v === "object" && !Array.isArray(v) ? camelToSnake(v) : v;
  return r;
}
function snakeToCamel(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const r = {};
  for (const [k, v] of Object.entries(obj))
    r[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v && typeof v === "object" && !Array.isArray(v) ? snakeToCamel(v) : v;
  return r;
}

const isLocalOnly = (item) =>
  String(item.id || "").includes("personal") ||
  String(item.clientId || "").includes("personal");

// ─── Array-based collections (clients, projects, time, pencils, invoices) ───

export function useOfflineFirst(key, fallback) {
  const table = TABLE_MAP[key] || "stint_" + key;
  const [data, setDataRaw] = useState(() => loadLocal(key, fallback));
  const syncRef = useRef(false);

  // Mirror to localStorage as offline fallback
  useEffect(() => { saveLocal(key, data); }, [key, data]);

  // Pull: fully replace local state with Supabase (preserve local-only items)
  useEffect(() => {
    if (!isSupabaseConfigured() || !Array.isArray(fallback)) return;
    const pull = async () => {
      if (syncRef.current) return;
      syncRef.current = true;
      try {
        const { data: rem, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
        if (!error && rem) {
          setDataRaw(prev => {
            const local = (prev || []).filter(isLocalOnly);
            return [...rem.map(snakeToCamel), ...local];
          });
        }
      } catch (e) { console.warn("Pull fail " + table, e); }
      syncRef.current = false;
    };
    pull();
    const iv = setInterval(pull, 10000);
    return () => clearInterval(iv);
  }, [key, table]);

  // Setter: diffs prev/next, pushes creates/updates/deletes to Supabase immediately
  const setData = useCallback((u) => {
    setDataRaw(prev => {
      const next = typeof u === "function" ? u(prev) : u;
      if (!Array.isArray(next)) return next;

      const prevMap = new Map((prev || []).map(i => [i.id, i]));
      const nextIds = new Set(next.map(i => i.id));

      // Stamp updatedAt on new/changed items, upsert to Supabase
      const stamped = next.map(item => {
        const old = prevMap.get(item.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
          const updated = { ...item, updatedAt: Date.now() };
          if (isSupabaseConfigured() && !isLocalOnly(updated)) {
            supabase.from(table).upsert(camelToSnake(updated), { onConflict: "id" }).then(({ error }) => {
              if (error) console.warn("Push fail", table, error);
            });
          }
          return updated;
        }
        return item;
      });

      // Delete removed items from Supabase immediately
      if (isSupabaseConfigured()) {
        for (const [id, item] of prevMap) {
          if (!nextIds.has(id) && !isLocalOnly(item)) {
            supabase.from(table).delete().eq("id", id).then(({ error }) => {
              if (error) console.warn("Delete fail", table, error);
            });
          }
        }
      }

      return stamped;
    });
  }, [table]);

  return [data, setData];
}

// ─── Single-row settings ────────────────────────────────────────────────────

export function useOfflineSettings(key, fallback) {
  const table = TABLE_MAP[key] || "stint_" + key;
  const [data, setDataRaw] = useState(() => loadLocal(key, fallback));

  // Mirror to localStorage as offline fallback
  useEffect(() => { saveLocal(key, data); }, [key, data]);

  // Pull: replace with Supabase on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      try {
        const { data: rows } = await supabase.from(table).select("*").limit(1);
        if (rows && rows.length > 0) {
          setDataRaw(snakeToCamel(rows[0]));
        }
      } catch {}
    })();
  }, []);

  // Setter: push every change to Supabase immediately
  const setData = useCallback((u) => {
    setDataRaw(prev => {
      const next = typeof u === "function" ? u(prev) : u;
      const updated = { ...next, updatedAt: Date.now() };
      if (isSupabaseConfigured()) {
        supabase.from(table).upsert(camelToSnake({ ...updated, id: "default" }), { onConflict: "id" }).then(({ error }) => {
          if (error) console.warn("Settings push fail", error);
        });
      }
      return updated;
    });
  }, [table]);

  return [data, setData];
}

// ─── Compat ─────────────────────────────────────────────────────────────────

export async function flushPending() {}
