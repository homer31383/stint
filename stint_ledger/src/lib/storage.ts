import { openDB, type IDBPDatabase } from 'idb';
import type { AccountBalances, DetailedBalances, StintData } from './types';
import { DEFAULT_DETAILED, DEFAULT_HOLDINGS } from './types';

const DB_NAME = 'stint-ledger';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('stint')) {
          db.createObjectStore('stint');
        }
        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveStintCache(data: Omit<StintData, 'lastSynced'>) {
  const db = await getDB();
  const tx = db.transaction('stint', 'readwrite');
  const store = tx.objectStore('stint');
  await store.put(data.clients, 'clients');
  await store.put(data.projects, 'projects');
  await store.put(data.timeEntries, 'timeEntries');
  await store.put(data.pencils, 'pencils');
  await store.put(data.invoices, 'invoices');
  await store.put(data.settings, 'settings');
  await store.put(Date.now(), 'lastSynced');
  await tx.done;
}

export async function loadStintCache(): Promise<StintData | null> {
  const db = await getDB();
  const tx = db.transaction('stint', 'readonly');
  const store = tx.objectStore('stint');
  const clients = await store.get('clients');
  if (!clients) return null;
  return {
    clients,
    projects: await store.get('projects') ?? [],
    timeEntries: await store.get('timeEntries') ?? [],
    pencils: await store.get('pencils') ?? [],
    invoices: await store.get('invoices') ?? [],
    settings: await store.get('settings') ?? null,
    lastSynced: await store.get('lastSynced') ?? null,
  };
}

export async function saveDetailedBalances(balances: DetailedBalances) {
  const db = await getDB();
  await db.put('accounts', balances, 'balances');
}

export async function loadDetailedBalances(): Promise<DetailedBalances | null> {
  const db = await getDB();
  const saved = await db.get('accounts', 'balances');
  if (!saved) return null;

  // Migration: old AccountBalances format → DetailedBalances
  if ('checking' in saved && !('advRelationship' in saved)) {
    const old = saved as AccountBalances;
    const migrated: DetailedBalances = {
      ...DEFAULT_DETAILED,
      advRelationship: 0,
      santanderChecking: old.checking,
      advantageSavings: 0,
      citiDoubleCash: old.ccDebt,
      highYieldSavings: old.hys,
      openbankHYS: 0,
      santanderMM: old.moneyMarket,
      nonRetirement: old.brokerage,
      traditionalIRA: old.tradIRA,
      rolloverIRA: old.rolloverIRA,
      hsa: old.hsa,
      lastUpdated: null,
    };
    await db.put('accounts', migrated, 'balances');
    return migrated;
  }

  const result = saved as DetailedBalances;

  // Migration: seed default fund holdings for any holdings-enabled key that
  // has never been populated. An explicitly empty array (user cleared it) is
  // preserved — only `undefined` triggers a seed.
  const existing = result.holdings ?? {};
  let mutated = result.holdings === undefined;
  const merged = { ...existing };
  for (const key of ['nonRetirement', 'traditionalIRA', 'rolloverIRA'] as const) {
    if (merged[key] === undefined) {
      merged[key] = DEFAULT_HOLDINGS[key];
      mutated = true;
    }
  }
  if (mutated) {
    result.holdings = merged;
    await db.put('accounts', result, 'balances');
  }

  return result;
}

export async function savePlannerSettings(settings: Record<string, unknown>) {
  const db = await getDB();
  await db.put('stint', settings, 'planner-settings');
}

export async function loadPlannerSettings(): Promise<Record<string, unknown> | null> {
  const db = await getDB();
  return (await db.get('stint', 'planner-settings')) ?? null;
}

export async function clearPlannerSettings() {
  const db = await getDB();
  await db.delete('stint', 'planner-settings');
}

export async function saveRetirementSettings(settings: Record<string, unknown>) {
  const db = await getDB();
  await db.put('stint', settings, 'retirement-settings');
}

export async function loadRetirementSettings(): Promise<Record<string, unknown> | null> {
  const db = await getDB();
  return (await db.get('stint', 'retirement-settings')) ?? null;
}

export async function clearRetirementSettings() {
  const db = await getDB();
  await db.delete('stint', 'retirement-settings');
}

export async function saveExpenseModel(model: Record<string, unknown>) {
  const db = await getDB();
  await db.put('stint', model, 'expense-model');
}

export async function loadExpenseModel(): Promise<Record<string, unknown> | null> {
  const db = await getDB();
  return (await db.get('stint', 'expense-model')) ?? null;
}

export async function clearExpenseModel() {
  const db = await getDB();
  await db.delete('stint', 'expense-model');
}

export async function saveSavedScenarios(scenarios: Record<string, unknown>[]) {
  const db = await getDB();
  await db.put('stint', scenarios, 'saved-scenarios');
}

export async function loadSavedScenarios(): Promise<Record<string, unknown>[] | null> {
  const db = await getDB();
  return (await db.get('stint', 'saved-scenarios')) ?? null;
}

export async function saveExportProfile(profile: Record<string, unknown>) {
  const db = await getDB();
  await db.put('stint', profile, 'export-profile');
}

export async function loadExportProfile(): Promise<Record<string, unknown> | null> {
  const db = await getDB();
  return (await db.get('stint', 'export-profile')) ?? null;
}

export interface SettingsBlob {
  plannerSettings: Record<string, unknown> | null;
  retirementSettings: Record<string, unknown> | null;
  expenseModel: Record<string, unknown> | null;
  detailedBalances: DetailedBalances | null;
  savedScenarios?: Record<string, unknown>[] | null;
  exportProfile?: Record<string, unknown> | null;
}

export async function gatherAllSettings(): Promise<SettingsBlob> {
  const db = await getDB();
  return {
    plannerSettings: (await db.get('stint', 'planner-settings')) ?? null,
    retirementSettings: (await db.get('stint', 'retirement-settings')) ?? null,
    expenseModel: (await db.get('stint', 'expense-model')) ?? null,
    detailedBalances: (await db.get('accounts', 'balances')) ?? null,
    savedScenarios: (await db.get('stint', 'saved-scenarios')) ?? null,
    exportProfile: (await db.get('stint', 'export-profile')) ?? null,
  };
}

export async function applyAllSettings(blob: SettingsBlob) {
  const db = await getDB();
  const tx = db.transaction(['stint', 'accounts'], 'readwrite');
  const stint = tx.objectStore('stint');
  const accounts = tx.objectStore('accounts');

  if (blob.plannerSettings != null) {
    await stint.put(blob.plannerSettings, 'planner-settings');
  }
  if (blob.retirementSettings != null) {
    await stint.put(blob.retirementSettings, 'retirement-settings');
  }
  if (blob.expenseModel != null) {
    await stint.put(blob.expenseModel, 'expense-model');
  }
  if (blob.detailedBalances != null) {
    await accounts.put(blob.detailedBalances, 'balances');
  }
  if (blob.savedScenarios != null) {
    await stint.put(blob.savedScenarios, 'saved-scenarios');
  }
  if (blob.exportProfile != null) {
    await stint.put(blob.exportProfile, 'export-profile');
  }

  await tx.done;
}
