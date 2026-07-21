import { useState, useEffect, useCallback } from 'react';
import { saveExportProfile, loadExportProfile } from '../lib/storage';

export interface ExportProfile {
  profileText: string;
  questionsText: string;
  lastUpdated: number | null;
}

export const DEFAULT_PROFILE_TEXT = `**Name:** Chris Bernier
**Age:** 42
**Location:** Brooklyn, NY

**Career:** Freelance Creative Director, advertising post-production. 15+ years experience.

**Household:** Partner Krista. Baby expected October 2026.

**Housing:** Rent-stabilized apartment in Brooklyn, $2,300/month.`;

export const DEFAULT_QUESTIONS_TEXT = `- Am I on track financially?
- What are my biggest risks?
- Should I raise my freelance rate?
- How does the baby impact my financial plan?
- What should I do with my investment allocation?
- Am I saving enough for retirement?`;

const DEFAULTS: ExportProfile = {
  profileText: DEFAULT_PROFILE_TEXT,
  questionsText: DEFAULT_QUESTIONS_TEXT,
  lastUpdated: null,
};

export function useExportProfile() {
  const [profile, setProfile] = useState<ExportProfile>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadExportProfile();
        if (!cancelled && saved) {
          const parsed = saved as unknown as Partial<ExportProfile>;
          setProfile({
            profileText: typeof parsed.profileText === 'string' ? parsed.profileText : DEFAULT_PROFILE_TEXT,
            questionsText: typeof parsed.questionsText === 'string' ? parsed.questionsText : DEFAULT_QUESTIONS_TEXT,
            lastUpdated: parsed.lastUpdated ?? null,
          });
        }
      } catch (e) {
        console.error('[export-profile] Failed to load from IDB:', e);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const updateProfileText = useCallback((text: string) => {
    setProfile(prev => {
      const next = { ...prev, profileText: text, lastUpdated: Date.now() };
      saveExportProfile(next as unknown as Record<string, unknown>);
      return next;
    });
  }, []);

  const updateQuestionsText = useCallback((text: string) => {
    setProfile(prev => {
      const next = { ...prev, questionsText: text, lastUpdated: Date.now() };
      saveExportProfile(next as unknown as Record<string, unknown>);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = { ...DEFAULTS, lastUpdated: Date.now() };
    setProfile(next);
    saveExportProfile(next as unknown as Record<string, unknown>);
  }, []);

  return { profile, loaded, updateProfileText, updateQuestionsText, reset };
}
