import { useState, useEffect, useCallback, useRef } from 'react';
import { saveRetirementSettings, loadRetirementSettings, clearRetirementSettings } from '../lib/storage';
import { useDemo, demoRead, demoWrite } from '../lib/demo';
import { DEMO_RETIREMENT } from '../lib/demoData';

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
  const demo = useDemo();
  const [settings, setSettings] = useState<RetirementSettings>(
    () => demo ? demoRead('retirement-settings', () => DEMO_RETIREMENT) : defaults,
  );
  const [loaded, setLoaded] = useState(demo);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = demo ? DEMO_RETIREMENT : defaults;

  // Load from IndexedDB on mount
  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    (async () => {
      const saved = await loadRetirementSettings();
      if (!cancelled && saved) {
        setSettings(prev => ({ ...prev, ...(saved as Partial<RetirementSettings>) }));
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [demo]);

  // Update a single setting and persist
  const update = useCallback(<K extends keyof RetirementSettings>(key: K, value: RetirementSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      if (demo) demoWrite('retirement-settings', next);
      else saveRetirementSettings(next);
      return next;
    });
  }, [demo]);

  // Reset all settings to defaults and clear storage
  const reset = useCallback(async () => {
    setSettings(defaultsRef.current);
    if (demo) demoWrite('retirement-settings', DEMO_RETIREMENT);
    else await clearRetirementSettings();
  }, [demo]);

  return { settings, update, reset, loaded };
}
