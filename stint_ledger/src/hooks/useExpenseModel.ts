import { useState, useEffect, useCallback, useRef } from 'react';
import { saveExpenseModel, loadExpenseModel, clearExpenseModel } from '../lib/storage';
import { useDemo, demoRead, demoWrite } from '../lib/demo';
import { buildDemoExpenseModel } from '../lib/demoData';

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

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  muted?: boolean;
}

export interface OneTimeExpense {
  id: string;
  name: string;
  amount: number;
  month: number;
  muted?: boolean;
}

export interface ExpenseModel {
  recurring: RecurringExpense[];
  oneTime: OneTimeExpense[];
  fullYearProjection?: boolean;
  lastUpdated: number | null;
}

const DEFAULT_RECURRING: Omit<RecurringExpense, 'id'>[] = [
  { name: 'Rent', amount: 3500, category: 'housing' },
  { name: 'Health Insurance', amount: 1600, category: 'insurance' },
  { name: 'Utilities', amount: 350, category: 'utilities' },
  { name: 'Food & Groceries', amount: 1200, category: 'food' },
  { name: 'Transport', amount: 400, category: 'transport' },
  { name: 'Subscriptions', amount: 200, category: 'subscriptions' },
  { name: 'Phone & Internet', amount: 250, category: 'utilities' },
  { name: 'Other', amount: 1250, category: 'other' },
];

function makeDefaults(): ExpenseModel {
  return {
    recurring: DEFAULT_RECURRING.map(r => ({ ...r, id: uuid() })),
    oneTime: [],
    lastUpdated: null,
  };
}

function persist(model: ExpenseModel, demo: boolean) {
  if (demo) demoWrite('expense-model', model);
  else saveExpenseModel(model as unknown as Record<string, unknown>);
}

export function useExpenseModel() {
  const demo = useDemo();
  const [model, setModel] = useState<ExpenseModel>(
    () => demo ? demoRead('expense-model', buildDemoExpenseModel) : makeDefaults(),
  );
  const [loaded, setLoaded] = useState(demo);
  const defaultsRef = useRef(demo ? buildDemoExpenseModel : makeDefaults);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadExpenseModel();
        if (!cancelled && saved) {
          const parsed = saved as unknown as Partial<ExpenseModel>;
          setModel(prev => ({
            ...prev,
            recurring: Array.isArray(parsed.recurring) ? parsed.recurring : prev.recurring,
            oneTime: Array.isArray(parsed.oneTime) ? parsed.oneTime : prev.oneTime,
            fullYearProjection: parsed.fullYearProjection ?? prev.fullYearProjection,
            lastUpdated: parsed.lastUpdated ?? prev.lastUpdated,
          }));
        }
      } catch (e) {
        console.error('[expense-model] Failed to load from IDB:', e);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [demo]);

  const addRecurring = useCallback((expense: Omit<RecurringExpense, 'id'>) => {
    setModel(prev => {
      const next = {
        ...prev,
        recurring: [...prev.recurring, { ...expense, id: uuid() }],
        lastUpdated: Date.now(),
      };
      persist(next, demo);
      return next;
    });
  }, [demo]);

  const updateRecurring = useCallback((id: string, updates: Partial<Omit<RecurringExpense, 'id'>>) => {
    setModel(prev => {
      const next = {
        ...prev,
        recurring: prev.recurring.map(r => r.id === id ? { ...r, ...updates } : r),
        lastUpdated: Date.now(),
      };
      persist(next, demo);
      return next;
    });
  }, [demo]);

  const removeRecurring = useCallback((id: string) => {
    setModel(prev => {
      const next = {
        ...prev,
        recurring: prev.recurring.filter(r => r.id !== id),
        lastUpdated: Date.now(),
      };
      persist(next, demo);
      return next;
    });
  }, [demo]);

  const addOneTime = useCallback((expense: Omit<OneTimeExpense, 'id'>) => {
    setModel(prev => {
      const next = {
        ...prev,
        oneTime: [...prev.oneTime, { ...expense, id: uuid() }],
        lastUpdated: Date.now(),
      };
      persist(next, demo);
      return next;
    });
  }, [demo]);

  const updateOneTime = useCallback((id: string, updates: Partial<Omit<OneTimeExpense, 'id'>>) => {
    setModel(prev => {
      const next = {
        ...prev,
        oneTime: prev.oneTime.map(e => e.id === id ? { ...e, ...updates } : e),
        lastUpdated: Date.now(),
      };
      persist(next, demo);
      return next;
    });
  }, [demo]);

  const removeOneTime = useCallback((id: string) => {
    setModel(prev => {
      const next = {
        ...prev,
        oneTime: prev.oneTime.filter(e => e.id !== id),
        lastUpdated: Date.now(),
      };
      persist(next, demo);
      return next;
    });
  }, [demo]);

  const setFullYearProjection = useCallback((on: boolean) => {
    setModel(prev => {
      const next = { ...prev, fullYearProjection: on, lastUpdated: Date.now() };
      persist(next, demo);
      return next;
    });
  }, [demo]);

  const reorderRecurring = useCallback((fromIndex: number, toIndex: number) => {
    setModel(prev => {
      const items = [...prev.recurring];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      const next = { ...prev, recurring: items, lastUpdated: Date.now() };
      persist(next, demo);
      return next;
    });
  }, [demo]);

  const replaceModel = useCallback((newModel: ExpenseModel) => {
    const next = { ...newModel, lastUpdated: Date.now() };
    setModel(next);
    persist(next, demo);
  }, [demo]);

  const reset = useCallback(async () => {
    const defaults = defaultsRef.current();
    setModel(defaults);
    if (demo) demoWrite('expense-model', defaults);
    else await clearExpenseModel();
  }, [demo]);

  return {
    model,
    loaded,
    addRecurring,
    updateRecurring,
    removeRecurring,
    addOneTime,
    updateOneTime,
    removeOneTime,
    reorderRecurring,
    replaceModel,
    setFullYearProjection,
    reset,
  };
}
