import { useState, useEffect, useCallback } from 'react';
import { saveReferencePlans, loadReferencePlans } from '../lib/storage';

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

export type PlanStatus = 'Not started' | 'In progress' | 'Done' | 'Pre-leave item';

export const PLAN_STATUS_OPTIONS: PlanStatus[] = [
  'Not started', 'In progress', 'Done', 'Pre-leave item',
];

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface PlanCard {
  id: string;
  title: string;
  body: string;
  status?: PlanStatus | null;
  // Dated checklists only
  deadline?: string | null; // YYYY-MM-DD
  checklist?: ChecklistItem[];
}

export type PlanSectionId = 'monthly' | 'annual' | 'conditional' | 'checklists';

export const PLAN_SECTIONS: { id: PlanSectionId; title: string }[] = [
  { id: 'monthly', title: 'Monthly Plans' },
  { id: 'annual', title: 'Annual Plans (January "Money Day")' },
  { id: 'conditional', title: 'Conditional Plans' },
  { id: 'checklists', title: 'Dated Checklists' },
];

export interface ReferencePlansModel {
  sections: Record<PlanSectionId, PlanCard[]>;
  lastUpdated: number | null;
}

// Stable seed ids so a push/pull round-trip never duplicates seeded plans.
function makeSeed(): ReferencePlansModel {
  return {
    sections: {
      monthly: [
        {
          id: 'seed-vacation-fund',
          title: 'Vacation Fund',
          status: 'Not started',
          body: [
            'Joint Synchrony HYS account (co-owned with Krista).',
            '$250/mo from me + $250/mo from Krista = $500/mo via recurring internal Synchrony transfers from individual accounts.',
            'Target ~$5-6k/yr for annual travel.',
            'Status: account not yet opened.',
          ].join('\n'),
        },
        {
          id: 'seed-baby-fund',
          title: 'Baby Costs Sinking Fund',
          status: 'Not started',
          body: [
            'Joint Synchrony HYS account (co-owned with Krista).',
            '~$150-250/mo combined, same internal transfer mechanism.',
            'Purpose: unmodeled baby costs only (gear, care surprises) — daycare and baby insurance already in recurring expenses.',
            'Status: account not yet opened.',
          ].join('\n'),
        },
        {
          id: 'seed-cash-routing',
          title: 'Cash Routing Rule',
          body: [
            'Order for incoming income:',
            '- (1) Checking floor',
            '- (2) Santander MM back to ~$10k',
            '- (3) Synchrony HYS buffer',
            'Buffer floor: never below $130k total liquid.',
          ].join('\n'),
        },
      ],
      annual: [
        {
          id: 'seed-college-loop',
          title: 'College Funding Loop',
          body: [
            'Total commitment ~$87k earmarked within Santander brokerage + annual transfers.',
            '',
            'This year (by Dec 31, 2026): open NY 529 Direct Plan, age-based portfolio, contribute $10k from cash (captures ~$685 NY deduction).',
            '',
            'Every January thereafter (years 2-8): sell $10k of HIGHEST-basis brokerage lots (order: DODBX and AEPGX first, ANEFX last) → contribute to 529. Deduction (~$685) roughly offsets cap-gains tax if lot order is followed. Doubles as the gradual American Funds exit.',
            '',
            'Replenishment dial (same January, optional): move $0-10k from HYS into DIVERSIFIED ETFs (not ANEFX) based on conditions:',
            '- Market at highs/CAPE elevated → $0 (net de-risk)',
            '- Market down 25%+ from highs → replenish fully or more (buy low)',
            '- Cash near $130k floor → always $0 regardless',
            '',
            "Projected outcome at kid's age 18: ~$234k today's dollars (~$181k in 529 + flexible brokerage residual).",
          ].join('\n'),
        },
        {
          id: 'seed-retirement-contrib',
          title: 'Retirement Contributions',
          body: 'IRA $7,000 + HSA $4,300, fund in January.',
        },
        {
          id: 'seed-rate-card',
          title: 'Rate Card Review',
          body: [
            'Current: $1,500/day shoot supervisor (validated 3x), $1,384+ CD day rate, protect non-exempt hourly + OT terms on payrolled engagements.',
            'Review each January against actual paid rates.',
          ].join('\n'),
        },
        {
          id: 'seed-insurance-estate',
          title: 'Insurance & Estate Review',
          body: 'Check beneficiaries, term life / LTD coverage vs. income, will accuracy — 15 min each January.',
        },
      ],
      conditional: [
        {
          id: 'seed-market-playbook',
          title: 'Market Move Playbook',
          status: 'Pre-leave item',
          body: [
            'Target allocation within retirement accounts (~$748k tax-free moveable): ~55-60% equity (incl. ~20pts international), 30-35% bonds, 5-10% MM.',
            '- Trigger: market falls 25%+ from highs → rebalance back to target (mechanically buys equities low) + turn college replenishment dial up.',
            '- Trigger: market runs 20%+ above target weights → trim back to target.',
            'Status: initial defensive rebalance NOT yet executed — pre-leave action item.',
          ].join('\n'),
        },
        {
          id: 'seed-pfl-rider',
          title: 'Long-Booking PFL Rider',
          body: [
            'Trigger: any single engagement of 26+ consecutive weeks offered.',
            'Value: NY PFL eligibility activates mid-assignment ≈ up to ~$14k paid bonding leave (12 wks at ~$1,200/wk cap), bonding window open until Oct 2027.',
            'Note: eligibility resets per employer-of-record per engagement (confirmed via new-hire letter Aug 2026); does not accumulate across gigs.',
          ].join('\n'),
        },
        {
          id: 'seed-staff-offer',
          title: 'Staff Offer Framework',
          body: [
            'Below $180k: decline. $180k: role-dependent. $200k+: clear yes.',
            'Remember salary undersells it: healthcare swing ~$24k/yr, 5% match, parental leave/PFL eligibility, contributions into any downturn.',
          ].join('\n'),
        },
        {
          id: 'seed-eth-thesis',
          title: 'ETH Thesis (excluded from all other planning)',
          body: [
            '153 ETH, cost basis ~$327/ETH ($50k), thesis exit window 2028-2030.',
            "Keep tranche/price rules and estate access instructions here as they're defined.",
            'Never counted in retirement projections, FI progress, or cash runway.',
          ].join('\n'),
        },
      ],
      checklists: [
        {
          id: 'seed-preleave',
          title: 'Pre-Leave Checklist',
          body: '',
          deadline: '2026-09-20',
          checklist: [
            { id: 'seed-pl-1', text: 'Term life quotes ($1-2M, 20-yr) + LTD quotes — bind term life', done: false },
            { id: 'seed-pl-2', text: 'Will + guardianship + beneficiaries (incl. ETH access notes)', done: false },
            { id: 'seed-pl-3', text: 'Defensive rebalance in Rollover IRA + Traditional IRA per Market Move Playbook target', done: false },
            { id: 'seed-pl-4', text: 'Open NY 529 + $10k contribution', done: false },
            { id: 'seed-pl-5', text: 'Move Advantage Savings $36.6k (0.4%) → HYS (~4%+)', done: false },
            { id: 'seed-pl-6', text: 'Open 2 joint Synchrony accounts (Vacation, Baby Costs) + set recurring transfers', done: false },
            { id: 'seed-pl-7', text: 'Scope December work now (~15 days at $1,500 target)', done: false },
            { id: 'seed-pl-8', text: 'Config fixes in Stint Ledger (rate defaults, tax model, account rename)', done: false },
          ],
        },
        {
          id: 'seed-q1-reentry',
          title: 'Q1 2027 Re-entry',
          body: 'No hard deadline.',
          deadline: null,
          checklist: [
            { id: 'seed-q1-1', text: 'Pipeline outreach cadence, shoot-supervisor positioning at $1,500/day', done: false },
            { id: 'seed-q1-2', text: 'First January Money Day: college loop year 2 + replenishment dial decision', done: false },
            { id: 'seed-q1-3', text: 'Deploy nothing new into equities at highs; dial governs', done: false },
          ],
        },
      ],
    },
    lastUpdated: null,
  };
}

function persist(model: ReferencePlansModel) {
  saveReferencePlans(model as unknown as Record<string, unknown>);
}

export function useReferencePlans() {
  const [model, setModel] = useState<ReferencePlansModel>(makeSeed);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadReferencePlans();
        if (!cancelled && saved) {
          const parsed = saved as unknown as Partial<ReferencePlansModel>;
          if (parsed.sections && typeof parsed.sections === 'object') {
            setModel(prev => ({
              sections: {
                monthly: Array.isArray(parsed.sections!.monthly) ? parsed.sections!.monthly : prev.sections.monthly,
                annual: Array.isArray(parsed.sections!.annual) ? parsed.sections!.annual : prev.sections.annual,
                conditional: Array.isArray(parsed.sections!.conditional) ? parsed.sections!.conditional : prev.sections.conditional,
                checklists: Array.isArray(parsed.sections!.checklists) ? parsed.sections!.checklists : prev.sections.checklists,
              },
              lastUpdated: parsed.lastUpdated ?? null,
            }));
          }
        }
      } catch (e) {
        console.error('[reference-plans] Failed to load from IDB:', e);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const mutate = useCallback((fn: (prev: ReferencePlansModel) => ReferencePlansModel) => {
    setModel(prev => {
      const next = { ...fn(prev), lastUpdated: Date.now() };
      persist(next);
      return next;
    });
  }, []);

  const mutateSection = useCallback((section: PlanSectionId, fn: (plans: PlanCard[]) => PlanCard[]) => {
    mutate(prev => ({
      ...prev,
      sections: { ...prev.sections, [section]: fn(prev.sections[section]) },
    }));
  }, [mutate]);

  const addPlan = useCallback((section: PlanSectionId) => {
    const plan: PlanCard = {
      id: uuid(),
      title: 'New plan',
      body: '',
      ...(section === 'checklists' ? { deadline: null, checklist: [] } : {}),
    };
    mutateSection(section, plans => [...plans, plan]);
    return plan.id;
  }, [mutateSection]);

  const updatePlan = useCallback((section: PlanSectionId, id: string, updates: Partial<Omit<PlanCard, 'id'>>) => {
    mutateSection(section, plans => plans.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [mutateSection]);

  const removePlan = useCallback((section: PlanSectionId, id: string) => {
    mutateSection(section, plans => plans.filter(p => p.id !== id));
  }, [mutateSection]);

  const movePlan = useCallback((section: PlanSectionId, id: string, dir: -1 | 1) => {
    mutateSection(section, plans => {
      const idx = plans.findIndex(p => p.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= plans.length) return plans;
      const items = [...plans];
      const [moved] = items.splice(idx, 1);
      items.splice(to, 0, moved);
      return items;
    });
  }, [mutateSection]);

  const addChecklistItem = useCallback((section: PlanSectionId, planId: string, text: string) => {
    mutateSection(section, plans => plans.map(p => p.id === planId
      ? { ...p, checklist: [...(p.checklist ?? []), { id: uuid(), text, done: false }] }
      : p));
  }, [mutateSection]);

  const updateChecklistItem = useCallback((section: PlanSectionId, planId: string, itemId: string, updates: Partial<Omit<ChecklistItem, 'id'>>) => {
    mutateSection(section, plans => plans.map(p => p.id === planId
      ? { ...p, checklist: (p.checklist ?? []).map(i => i.id === itemId ? { ...i, ...updates } : i) }
      : p));
  }, [mutateSection]);

  const removeChecklistItem = useCallback((section: PlanSectionId, planId: string, itemId: string) => {
    mutateSection(section, plans => plans.map(p => p.id === planId
      ? { ...p, checklist: (p.checklist ?? []).filter(i => i.id !== itemId) }
      : p));
  }, [mutateSection]);

  return {
    model, loaded,
    addPlan, updatePlan, removePlan, movePlan,
    addChecklistItem, updateChecklistItem, removeChecklistItem,
  };
}
