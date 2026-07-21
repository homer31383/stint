import { useState, useEffect, useCallback, useRef } from 'react';
import { savePlannerSettings, loadPlannerSettings, clearPlannerSettings } from '../lib/storage';

export interface PlannerSettings {
  dayRate: number;
  utilization: number;
  vacationDays: number;
  holidays: number;
  sickDays: number;
  monthlyExpensesFreelance: number;
  monthlyExpensesFullTime: number;
  healthIns: number;
  equityReturn: number;
  rolloverReturn: number;
  cashReturn: number;
  inflationRate: number;
  fullFinancialPicture: boolean;
  includeBookings: boolean;
  includePencils: boolean;
  targetUtil: number;
  employmentMode?: 'freelance' | 'fulltime';
  ftSalary?: number;
  ftContribution401k?: number;
  ftEmployerMatch?: number;
  ftHealthIns?: number;
  ftOtherBenefits?: number;
}

/**
 * Migrate legacy settings records that have the old `monthlyExpenses` field
 * but not the new mode-specific fields. Returns a shallow-copied object.
 */
export function migrateLegacyExpenses(raw: Record<string, unknown>): Record<string, unknown> {
  const legacy = raw.monthlyExpenses;
  if (typeof legacy === 'number'
    && raw.monthlyExpensesFreelance === undefined
    && raw.monthlyExpensesFullTime === undefined) {
    const { monthlyExpenses: _removed, ...rest } = raw;
    return {
      ...rest,
      monthlyExpensesFreelance: legacy,
      monthlyExpensesFullTime: legacy,
    };
  }
  return raw;
}

export function usePlannerSettings(defaults: PlannerSettings) {
  const [settings, setSettings] = useState<PlannerSettings>(defaults);
  const [loaded, setLoaded] = useState(false);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  // Load from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadPlannerSettings();
        if (!cancelled && saved) {
          const migrated = migrateLegacyExpenses(saved);
          setSettings(prev => ({ ...prev, ...(migrated as Partial<PlannerSettings>) }));
        }
      } catch (e) {
        console.error('[planner-settings] Failed to load from IDB:', e);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Update a single setting and persist
  const update = useCallback(<K extends keyof PlannerSettings>(key: K, value: PlannerSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      savePlannerSettings(next);
      return next;
    });
  }, []);

  // Reset all settings to defaults and clear storage
  const reset = useCallback(async () => {
    setSettings(defaultsRef.current);
    await clearPlannerSettings();
  }, []);

  return { settings, update, reset, loaded };
}
