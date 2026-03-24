import { useState, useEffect, useCallback } from 'react';
import { saveSavedScenarios, loadSavedScenarios } from '../lib/storage';
import type { PlannerSettings } from './usePlannerSettings';
import type { ExpenseModel } from './useExpenseModel';

export interface SavedScenarioMetrics {
  mode: 'freelance' | 'fulltime';
  dayRate: number;
  salary: number;
  utilization: number;
  grossAnnual: number;
  netAnnual: number;
  monthlyCashFlowIncomeOnly: number;
  monthlyCashFlowFull: number;
  annualSavingsIncomeOnly: number;
  annualSavingsFull: number;
  year5NetWorth: number;
  monthlyExpenses: number;
  monthlyRecurringTotal: number;
  oneTimeAnnualTotal: number;
}

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: number;
  settings: PlannerSettings;
  expenseModel: ExpenseModel;
  metrics: SavedScenarioMetrics;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function persist(scenarios: SavedScenario[]) {
  saveSavedScenarios(scenarios as unknown as Record<string, unknown>[]);
}

export function useSavedScenarios() {
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadSavedScenarios();
        if (!cancelled && saved && Array.isArray(saved)) {
          setScenarios(saved as unknown as SavedScenario[]);
        }
      } catch (e) {
        console.error('[saved-scenarios] Failed to load from IDB:', e);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback((
    name: string,
    settings: PlannerSettings,
    expenseModel: ExpenseModel,
    metrics: SavedScenarioMetrics,
  ) => {
    setScenarios(prev => {
      const next = [...prev, {
        id: uuid(),
        name,
        savedAt: Date.now(),
        settings,
        expenseModel,
        metrics,
      }];
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setScenarios(prev => {
      const next = prev.filter(s => s.id !== id);
      persist(next);
      return next;
    });
  }, []);

  return { scenarios, loaded, save, remove };
}
