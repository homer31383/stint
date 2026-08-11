import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

const TABLE_MAP = {
  clients: "stint_clients",
  projects: "stint_projects",
  time: "stint_time_entries",
  pencils: "stint_pencils",
  invoices: "stint_invoices",
  settings: "stint_settings",
  dayNotes: "stint_day_notes",
};

const loadLocal = (key, fb) => {
  try { const v = localStorage.getItem("stint_" + key); return v ? JSON.parse(v) : fb; }
  catch { return fb; }
};
const saveLocal = (key, val) => {
  try { localStorage.setItem("stint_" + key, JSON.stringify(val)); } catch {}
};

// Keys with digits don't round-trip through the regex conversions
// (lead3d has no uppercase to snake, lead_3d has no _[a-z] to camel)
const SNAKE_OVERRIDES = { lead3d: "lead_3d", lead2d: "lead_2d" };
const CAMEL_OVERRIDES = { lead_3d: "lead3d", lead_2d: "lead2d" };

function camelToSnake(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const r = {};
  for (const [k, v] of Object.entries(obj))
    r[SNAKE_OVERRIDES[k] || k.replace(/[A-Z]/g, m => "_" + m.toLowerCase())] = v && typeof v === "object" && !Array.isArray(v) ? camelToSnake(v) : v;
  return r;
}
function snakeToCamel(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const r = {};
  for (const [k, v] of Object.entries(obj))
    r[CAMEL_OVERRIDES[k] || k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v && typeof v === "object" && !Array.isArray(v) ? snakeToCamel(v) : v;
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
  const pushesInFlight = useRef(0);
  const recentWrites = useRef(new Map());  // id -> ts of last local upsert
  const recentDeletes = useRef(new Map()); // id -> ts of last local delete
  const RECENT_MS = 30000;

  // Mirror to localStorage as offline fallback
  useEffect(() => { saveLocal(key, data); }, [key, data]);

  // Pull: fully replace local state with Supabase (preserve local-only items
  // and items written in the last 30s that the pull may not reflect yet)
  useEffect(() => {
    if (!isSupabaseConfigured() || !Array.isArray(fallback)) return;
    const pull = async () => {
      if (syncRef.current || pushesInFlight.current > 0) return;
      syncRef.current = true;
      try {
        const { data: rem, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
        if (!error && rem) {
          setDataRaw(prev => {
            const now = Date.now();
            for (const [id, ts] of recentWrites.current) if (now - ts > RECENT_MS) recentWrites.current.delete(id);
            for (const [id, ts] of recentDeletes.current) if (now - ts > RECENT_MS) recentDeletes.current.delete(id);

            const local = (prev || []).filter(isLocalOnly);
            const localSynced = (prev || []).filter(i => !isLocalOnly(i));
            if (rem.length === 0 && localSynced.length > 0) {
              console.warn(`[sync] Skipping pull for ${table}: remote returned empty but local has ${localSynced.length} synced item(s) — keeping local`);
              return prev;
            }
            const remote = rem.map(snakeToCamel).filter(i => !recentDeletes.current.has(i.id));
            const remoteIds = new Set(remote.map(i => i.id));
            const pendingLocal = localSynced.filter(i => !remoteIds.has(i.id) && recentWrites.current.has(i.id));
            return [...remote, ...pendingLocal, ...local];
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
            recentWrites.current.set(updated.id, Date.now());
            pushesInFlight.current++;
            supabase.from(table).upsert(camelToSnake(updated), { onConflict: "id" }).then(({ error }) => {
              pushesInFlight.current--;
              if (error) console.warn("Push fail", table, error);
            }, () => { pushesInFlight.current--; });
          }
          return updated;
        }
        return item;
      });

      // Delete removed items from Supabase immediately
      if (isSupabaseConfigured()) {
        for (const [id, item] of prevMap) {
          if (!nextIds.has(id) && !isLocalOnly(item)) {
            recentDeletes.current.set(id, Date.now());
            recentWrites.current.delete(id);
            pushesInFlight.current++;
            supabase.from(table).delete().eq("id", id).then(({ error }) => {
              pushesInFlight.current--;
              if (error) console.warn("Delete fail", table, error);
            }, () => { pushesInFlight.current--; });
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
