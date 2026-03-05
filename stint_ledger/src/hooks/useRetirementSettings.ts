import { useState, useEffect, useCallback, useRef } from 'react';
import { saveRetirementSettings, loadRetirementSettings, clearRetirementSettings } from '../lib/storage';

export interface RetirementSettings {
  currentAge: number;
  retirementAge: number;
  annualIRAContribution: number;
  annualHSAContribution: number;
  preReturnRate: number;
  retReturnRate: number;
  inflationRate: number;
  monthlySpending: number;
  socialSecurity: number;
  includeTaxable: boolean;
}

export const RETIREMENT_DEFAULTS: RetirementSettings = {
  currentAge: 38,
  retirementAge: 60,
  annualIRAContribution: 7000,
  annualHSAContribution: 4300,
  preReturnRate: 0.07,
  retReturnRate: 0.05,
  inflationRate: 0.03,
  monthlySpending: 8750,
  socialSecurity: 0,
  includeTaxable: false,
};

export function useRetirementSettings(defaults: RetirementSettings = RETIREMENT_DEFAULTS) {
  const [settings, setSettings] = useState<RetirementSettings>(defaults);
  const [loaded, setLoaded] = useState(false);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  // Load from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadRetirementSettings();
      if (!cancelled && saved) {
        setSettings(prev => ({ ...prev, ...(saved as Partial<RetirementSettings>) }));
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Update a single setting and persist
  const update = useCallback(<K extends keyof RetirementSettings>(key: K, value: RetirementSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveRetirementSettings(next);
      return next;
    });
  }, []);

  // Reset all settings to defaults and clear storage
  const reset = useCallback(async () => {
    setSettings(defaultsRef.current);
    await clearRetirementSettings();
  }, []);

  return { settings, update, reset, loaded };
}
