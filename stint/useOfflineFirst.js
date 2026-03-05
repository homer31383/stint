import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

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
const getPending = () => loadLocal("_pending", []);
const savePending = (c) => saveLocal("_pending", c);
const queueChange = (tbl, act, d) => {
  const p = getPending(); p.push({ table: tbl, action: act, data: d, ts: Date.now() }); savePending(p);
};

export function useOfflineFirst(key, fallback) {
  const table = TABLE_MAP[key] || "stint_" + key;
  const [data, setDataRaw] = useState(() => loadLocal(key, fallback));
  const syncRef = useRef(false);
  useEffect(() => { saveLocal(key, data); }, [key, data]);
  const setData = useCallback((u) => {
    setDataRaw(prev => typeof u === "function" ? u(prev) : u);
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured() || !Array.isArray(fallback)) return;
    const pull = async () => {
      if (syncRef.current) return; syncRef.current = true;
      try {
        const { data: rem, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
        if (!error && rem) {
          const loc = loadLocal(key, fallback);
          const rIds = new Set(rem.map(r => r.id));
          const locOnly = loc.filter(l => !rIds.has(l.id));
          const merged = [...rem.map(snakeToCamel), ...locOnly];
          setDataRaw(merged); saveLocal(key, merged);
        }
      } catch (e) { console.warn("Pull fail " + table, e); }
      syncRef.current = false;
    };
    pull(); const iv = setInterval(pull, 60000); return () => clearInterval(iv);
  }, [key, table]);
  const push = useCallback(async (act, item) => {
    if (!isSupabaseConfigured()) return;
    try {
      const rec = camelToSnake(item);
      if (act === "upsert") await supabase.from(table).upsert(rec, { onConflict: "id" });
      else if (act === "delete") await supabase.from(table).delete().eq("id", item.id);
    } catch (e) { console.warn("Push fail", e); queueChange(table, act, item); }
  }, [table]);
  return [data, setData, push];
}

export function useOfflineSettings(key, fallback) {
  const table = TABLE_MAP[key] || "stint_" + key;
  const [data, setDataRaw] = useState(() => loadLocal(key, fallback));
  useEffect(() => { saveLocal(key, data); }, [key, data]);
  const setData = useCallback((u) => {
    setDataRaw(prev => typeof u === "function" ? u(prev) : u);
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      try {
        const { data: rows } = await supabase.from(table).select("*").limit(1);
        if (rows && rows.length > 0) {
          const rem = snakeToCamel(rows[0]);
          const loc = loadLocal(key, fallback);
          setDataRaw({ ...rem, ...loc }); saveLocal(key, { ...rem, ...loc });
        }
      } catch {}
    })();
  }, []);
  return [data, setData];
}

export async function flushPending() {
  if (!isSupabaseConfigured()) return;
  const pend = getPending(); if (!pend.length) return;
  const fail = [];
  for (const c of pend) {
    try {
      const rec = camelToSnake(c.data);
      if (c.action === "upsert") await supabase.from(c.table).upsert(rec, { onConflict: "id" });
      else if (c.action === "delete") await supabase.from(c.table).delete().eq("id", c.data.id);
    } catch { fail.push(c); }
  }
  savePending(fail);
}

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
