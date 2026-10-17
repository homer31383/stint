import { createContext, useContext } from 'react';

// Demo mode swaps every data hook onto the fictional fixtures in demoData.ts.
// The app shell remounts on toggle (keyed on the flag), so a hook can treat
// the flag as fixed for its lifetime. While demo is on, hooks never touch
// IndexedDB or Supabase; edits land in the in-memory store below, shared
// across views and discarded whenever the mode changes.

const SS_KEY = 'stint-ledger-demo';

export interface DemoState {
  demo: boolean;
  setDemo: (on: boolean) => void;
}

export const DemoContext = createContext<DemoState>({ demo: false, setDemo: () => {} });

export function useDemo(): boolean {
  return useContext(DemoContext).demo;
}

export function useDemoToggle(): DemoState {
  return useContext(DemoContext);
}

// sessionStorage, never the synced settings: a fresh launch always opens on
// real data.
export function readDemoFlag(): boolean {
  try {
    return sessionStorage.getItem(SS_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeDemoFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(SS_KEY, '1');
    else sessionStorage.removeItem(SS_KEY);
  } catch {
    // Private mode: the flag just won't survive a reload.
  }
}

const memory = new Map<string, unknown>();

export function demoRead<T>(key: string, seed: () => T): T {
  if (!memory.has(key)) memory.set(key, seed());
  return memory.get(key) as T;
}

export function demoWrite<T>(key: string, value: T) {
  memory.set(key, value);
}

export function clearDemoMemory() {
  memory.clear();
}
