import { useState, useEffect, useCallback, useRef } from 'react';
import { savePlannerSettings, loadPlannerSettings, clearPlannerSettings } from '../lib/storage';

export interface PlannerSettings {
  dayRate: number;
  utilization: number;
  vacationDays: number;
  holidays: number;
  sickDays: number;
  monthlyExpenses: number;
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

export function usePlannerSettings(defaults: PlannerSettings) {
  const [settings, setSettings] = useState<PlannerSettings>(defaults);
  const [loaded, setLoaded] = useState(false);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  // Load from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadPlannerSettings();
      if (!cancelled && saved) {
        setSettings(prev => ({ ...prev, ...(saved as Partial<PlannerSettings>) }));
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
