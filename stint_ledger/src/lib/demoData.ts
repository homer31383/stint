// Fictional dataset for demo mode. Nothing here is real: clients, accounts,
// balances, rates and plans are invented. Everything derived (YTD income,
// utilization, cash flow, projections) is computed from these fixtures by the
// normal code paths. Dates are relative to today so the demo never goes stale.

import type {
  StintData, StintClient, StintProject, StintTimeEntry, StintPencil, StintInvoice,
  DetailedBalances, FixedAccountKey,
} from './types';
import { toAggregateBalances } from './types';
import type { PriceResult } from './prices';
import { estimateTaxes } from './tax';
import type { PlannerSettings } from '../hooks/usePlannerSettings';
import type { ExpenseModel } from '../hooks/useExpenseModel';
import type { RetirementSettings } from '../hooks/useRetirementSettings';
import type { SavedScenario, SavedScenarioMetrics } from '../hooks/useSavedScenarios';
import type { ReferencePlansModel } from '../hooks/useReferencePlans';
import type { ExportProfile } from '../hooks/useExportProfile';

export const DEMO_DAY_RATE = 1250;
export const DEMO_RAISED_RATE = 1400;

// ---------- Stint data ----------

const DAY_MS = 86400000;

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWeekday(d: Date): boolean {
  const w = d.getDay();
  return w !== 0 && w !== 6;
}

function shortDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Small seeded PRNG so the demo looks the same on every launch within a year.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLIENTS: StintClient[] = [
  { id: 'demo-c1', name: 'Northlight Studio', email: 'billing@northlight.example', notes: null, service_rates: { day_rate: DEMO_DAY_RATE }, created_at: 0 },
  { id: 'demo-c2', name: 'Parallax Post', email: 'ap@parallaxpost.example', notes: null, service_rates: { day_rate: DEMO_DAY_RATE }, created_at: 0 },
  { id: 'demo-c3', name: 'Golden Hour Films', email: 'accounts@goldenhour.example', notes: null, service_rates: { day_rate: DEMO_DAY_RATE }, created_at: 0 },
];

function project(id: string, clientId: string, name: string, producer: string): StintProject {
  return {
    id, client_id: clientId, name, status: 'active',
    director: null, director_email: null, producer, producer_email: null,
    production_company: null, creative_director: null, lead_3d: null, lead_2d: null,
    my_role: 'Creative Director', due_date: null, notes: null, created_at: 0,
  };
}

const PROJECTS: StintProject[] = [
  project('demo-p1', 'demo-c1', 'Spring Campaign', 'Sam Rivera'),
  project('demo-p2', 'demo-c1', 'Brand Refresh', 'Sam Rivera'),
  project('demo-p3', 'demo-c2', 'Product Launch Spots', 'Jordan Lee'),
  project('demo-p4', 'demo-c3', 'Documentary Titles', 'Alex Morgan'),
  project('demo-p5', 'demo-c3', 'Holiday Promo', 'Alex Morgan'),
];

function clientOf(projectId: string): StintClient {
  const p = PROJECTS.find((x) => x.id === projectId)!;
  return CLIENTS.find((c) => c.id === p.client_id)!;
}

export function buildDemoStint(): StintData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const rand = mulberry32(year * 7919);

  // Every weekday from the first work week of the year through yesterday.
  const weekdays: string[] = [];
  for (let d = new Date(year, 0, 5); d < today; d = addDays(d, 1)) {
    if (isWeekday(d)) weekdays.push(iso(d));
  }
  const target = Math.min(70, Math.round(weekdays.length * 0.36));

  // Gigs of 2-6 days, with the idle days scattered between them so the work
  // spreads across the whole year instead of bunching up in spring.
  const lengths: number[] = [];
  let planned = 0;
  while (planned < target) {
    const len = Math.min(target - planned, 2 + Math.floor(rand() * 5));
    lengths.push(len);
    planned += len;
  }
  const weights = lengths.map(() => 0.4 + rand());
  weights.push(0.05 + rand() * 0.15); // short tail so recent weeks have work
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const idle = weekdays.length - planned;
  const gaps = weights.map((w) => Math.floor((w / weightSum) * idle));

  const timeEntries: StintTimeEntry[] = [];
  const blocks: { projectId: string; dates: string[] }[] = [];
  let cursor = 0;
  lengths.forEach((len, bi) => {
    cursor += gaps[bi];
    const projectId = PROJECTS[Math.floor(rand() * PROJECTS.length)].id;
    const dates = weekdays.slice(cursor, cursor + len);
    cursor += len;
    if (dates.length === 0) return;
    blocks.push({ projectId, dates });
    for (const date of dates) {
      timeEntries.push({
        id: `demo-te-${timeEntries.length + 1}`,
        project_id: projectId,
        date,
        hour: null,
        service_type: 'day_rate',
        hours: 10,
        rate: DEMO_DAY_RATE,
        amount: DEMO_DAY_RATE,
        notes: null,
        created_at: new Date(date + 'T18:00:00').getTime(),
      });
    }
  });

  // Invoices for the six most recent gigs. Due 30 days after issue: paid once
  // past due, except the most recent one 10+ days late, which is overdue.
  const todayStr = iso(today);
  const recent = blocks.slice(-6);
  let overdueAssigned = false;
  const invoiceDrafts = recent.map((b) => {
    const last = b.dates[b.dates.length - 1];
    const issue = addDays(new Date(last + 'T00:00:00'), 2);
    const due = addDays(issue, 30);
    return { b, issue: iso(issue), due: iso(due), daysLate: Math.round((today.getTime() - due.getTime()) / DAY_MS) };
  });
  const statuses = invoiceDrafts.map(() => 'paid');
  for (let i = invoiceDrafts.length - 1; i >= 0; i--) {
    const d = invoiceDrafts[i];
    if (d.due >= todayStr || d.daysLate < 10) statuses[i] = 'sent';
    else if (!overdueAssigned) {
      statuses[i] = 'overdue';
      overdueAssigned = true;
    }
  }
  const firstNumber = 100 + blocks.length - recent.length;
  const invoices: StintInvoice[] = invoiceDrafts.map((d, i) => {
    const client = clientOf(d.b.projectId);
    const entries = timeEntries.filter((e) => e.project_id === d.b.projectId && d.b.dates.includes(e.date));
    const number = `INV-${firstNumber + i}`;
    return {
      id: `demo-inv-${i + 1}`,
      number,
      client_id: client.id,
      client_name: client.name,
      client_email: client.email,
      entry_ids: entries.map((e) => e.id),
      line_items: entries.map((e) => ({ type: 'day_rate', date: e.date, hours: e.hours, amount: e.amount, note: '' })),
      total: entries.reduce((s, e) => s + e.amount, 0),
      status: statuses[i],
      issue_date: d.issue,
      due_date: d.due,
      invoice_code: number,
      notes: null,
      date_range: `${shortDate(d.b.dates[0])} to ${shortDate(d.b.dates[d.b.dates.length - 1])}`,
      dates_worked: d.b.dates,
      created_at: new Date(d.issue + 'T09:00:00').getTime(),
    };
  });

  // One confirmed booking next week, one first-hold pencil three weeks out.
  const nextMonday = addDays(today, ((8 - today.getDay()) % 7) || 7);
  const pencils: StintPencil[] = [
    {
      id: 'demo-pencil-1', client_id: 'demo-c2', project_id: 'demo-p3',
      start_date: iso(nextMonday), end_date: iso(addDays(nextMonday, 4)),
      priority: 0, notes: null, created_at: 0,
    },
    {
      id: 'demo-pencil-2', client_id: 'demo-c3', project_id: 'demo-p5',
      start_date: iso(addDays(nextMonday, 14)), end_date: iso(addDays(nextMonday, 17)),
      priority: 1, notes: null, created_at: 0,
    },
  ];

  return {
    clients: CLIENTS,
    projects: PROJECTS,
    timeEntries,
    pencils,
    invoices,
    settings: {
      id: 'demo',
      business_name: 'Demo Design Co.',
      business_email: null,
      business_phone: null,
      business_address: null,
      bank_name: null,
      routing: null,
      account_number: null,
      invoice_prefix: 'INV',
      next_invoice_number: firstNumber + invoices.length,
      payment_terms: 30,
      hide_dollars: false,
      service_rates: { day_rate: DEMO_DAY_RATE },
    },
    lastSynced: null,
  };
}

// ---------- Net worth ----------

// Demo names for the fixed account slots. Slots not listed are hidden in demo
// mode (their balance is zero).
export const DEMO_ACCOUNT_LABELS: Partial<Record<FixedAccountKey, string>> = {
  advRelationship: 'Everyday Checking',
  citiDoubleCash: 'Rewards Credit Card',
  highYieldSavings: 'High-Yield Savings',
  santanderMM: 'Money Market',
  nonRetirement: 'Brokerage',
  traditionalIRA: 'Traditional IRA',
  rolloverIRA: 'Rollover IRA',
  hsa: 'Health Savings Account',
};

export const DEMO_PRICES: Record<string, number> = {
  VTI: 305.4,
  VXUS: 68.2,
};

export function buildDemoDetailed(): DetailedBalances {
  return {
    advRelationship: 8200,
    santanderChecking: 0,
    advantageSavings: 0,
    citiDoubleCash: -1100,
    highYieldSavings: 64000,
    openbankHYS: 0,
    santanderMM: 15000,
    nonRetirement: 0,
    traditionalIRA: 38000,
    rolloverIRA: 112000,
    hsa: 6500,
    customAccounts: [],
    mutedAccounts: [],
    holdings: {
      nonRetirement: [
        { id: 'demo-vti', ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', shares: 180, price: DEMO_PRICES.VTI, costBasis: 47160 },
        { id: 'demo-vxus', ticker: 'VXUS', name: 'Vanguard Total International Stock ETF', shares: 220, price: DEMO_PRICES.VXUS, costBasis: 13530 },
      ],
      traditionalIRA: [],
      rolloverIRA: [],
    },
    lastUpdated: Date.now(),
    pricesUpdated: Date.now(),
  };
}

// Offline stand-in for fetchPrices: demo holdings always quote the same.
export async function fetchDemoPrices(tickers: string[]): Promise<PriceResult> {
  const prices: Record<string, number> = {};
  const failed: string[] = [];
  for (const t of tickers) {
    const p = DEMO_PRICES[t.toUpperCase()];
    if (p != null) prices[t.toUpperCase()] = p;
    else failed.push(t);
  }
  return { prices, failed, skipped: [], outcomes: [] };
}

// Dashboard / Net Worth runway basis: planner expenses + health insurance.
export const DEMO_MONTHLY_EXPENSES = 5400 + 850;

// ---------- Planner, expenses, retirement ----------

export const DEMO_PLANNER: PlannerSettings = {
  dayRate: DEMO_DAY_RATE,
  utilization: 0.55,
  vacationDays: 10,
  holidays: 10,
  sickDays: 5,
  monthlyExpensesFreelance: 5400,
  monthlyExpensesFullTime: 5400,
  healthIns: 850,
  ftHealthIns: 300,
  equityReturn: 0.07,
  rolloverReturn: 0.07,
  cashReturn: 0.04,
  inflationRate: 0.03,
  fullFinancialPicture: true,
  includeBookings: true,
  includePencils: false,
  targetUtil: 0.5,
  employmentMode: 'freelance',
};

export function buildDemoExpenseModel(): ExpenseModel {
  const nextMonth = Math.min(12, new Date().getMonth() + 2);
  return {
    recurring: [
      { id: 'demo-r1', name: 'Rent', amount: 2000, category: 'housing' },
      { id: 'demo-r2', name: 'Health Insurance', amount: 850, category: 'insurance' },
      { id: 'demo-r3', name: 'Groceries', amount: 700, category: 'food' },
      { id: 'demo-r4', name: 'Dining Out', amount: 400, category: 'food' },
      { id: 'demo-r5', name: 'Subscriptions', amount: 120, category: 'subscriptions' },
      { id: 'demo-r6', name: 'Transport', amount: 200, category: 'transport' },
    ],
    oneTime: [
      { id: 'demo-o1', name: 'New laptop', amount: 2400, month: nextMonth },
      { id: 'demo-o2', name: 'Winter trip', amount: 1800, month: Math.min(12, nextMonth + 1) },
    ],
    fullYearProjection: true,
    lastUpdated: null,
  };
}

export const DEMO_RETIREMENT: RetirementSettings = {
  currentAge: 40,
  retirementAge: 65,
  annualIRAContribution: 6000,
  annualHSAContribution: 2400,
  preReturnRate: 0.07,
  retReturnRate: 0.05,
  inflationRate: 0.03,
  monthlySpending: DEMO_MONTHLY_EXPENSES,
  socialSecurity: 1800,
  includeTaxable: false,
};

// Mirrors the freelance branch of Planner's calc + 5-year projection so the
// saved snapshots match what Planner would have recorded at save time.
function freelanceMetrics(s: PlannerSettings, model: ExpenseModel): SavedScenarioMetrics {
  const b = toAggregateBalances(buildDemoDetailed());
  const availableDays = 260 - s.vacationDays - s.holidays - s.sickDays;
  const grossAnnual = s.dayRate * availableDays * s.utilization;
  const taxes = estimateTaxes(grossAnnual);
  const monthlyPassive = ((b.hys + b.moneyMarket) * s.cashReturn + b.brokerage * s.equityReturn) / 12;
  const totalExpenses = s.monthlyExpensesFreelance + s.healthIns;
  const incomeOnly = taxes.netMonthly - totalExpenses;
  const full = incomeOnly + monthlyPassive;

  const realCash = s.cashReturn - s.inflationRate;
  const realEquity = s.equityReturn - s.inflationRate;
  const realRollover = s.rolloverReturn - s.inflationRate;
  let { checking, hys, moneyMarket: mm, brokerage, tradIRA, rolloverIRA, hsa } = b;
  for (let y = 0; y < 5; y++) {
    hys *= 1 + realCash;
    mm *= 1 + realCash;
    brokerage *= 1 + realEquity;
    tradIRA *= 1 + realEquity;
    rolloverIRA *= 1 + realRollover;
    hsa *= 1 + realEquity;
    checking += full * 12;
  }
  const year5 = checking + hys + mm + brokerage + b.ccDebt + tradIRA + rolloverIRA + hsa;

  return {
    mode: 'freelance',
    dayRate: s.dayRate,
    salary: s.ftSalary ?? 180000,
    utilization: s.utilization,
    grossAnnual,
    netAnnual: taxes.netAnnual,
    monthlyCashFlowIncomeOnly: incomeOnly,
    monthlyCashFlowFull: full,
    annualSavingsIncomeOnly: incomeOnly * 12,
    annualSavingsFull: full * 12,
    year5NetWorth: year5,
    monthlyExpenses: totalExpenses,
    monthlyExpensesBase: s.monthlyExpensesFreelance,
    healthIns: s.healthIns,
    monthlyRecurringTotal: model.recurring.filter((r) => !r.muted).reduce((t, r) => t + r.amount, 0),
    oneTimeAnnualTotal: model.oneTime.filter((e) => !e.muted).reduce((t, e) => t + e.amount, 0),
  };
}

export function buildDemoScenarios(): SavedScenario[] {
  const model = buildDemoExpenseModel();
  const raised: PlannerSettings = { ...DEMO_PLANNER, dayRate: DEMO_RAISED_RATE };
  const savedAt = Date.now() - 12 * DAY_MS;
  return [
    { id: 'demo-s1', name: 'Current pace', savedAt, settings: DEMO_PLANNER, expenseModel: model, metrics: freelanceMetrics(DEMO_PLANNER, model) },
    { id: 'demo-s2', name: 'Raise rate to $1,400', savedAt: savedAt + DAY_MS, settings: raised, expenseModel: model, metrics: freelanceMetrics(raised, model) },
  ];
}

// ---------- Plans and export profile ----------

export function buildDemoPlans(): ReferencePlansModel {
  return {
    sections: {
      monthly: [
        {
          id: 'demo-plan-ef',
          title: 'Emergency Fund Rule',
          status: 'In progress',
          body: [
            'Keep six months of expenses in high-yield savings.',
            'If it dips below the line, the next invoice tops it up before anything else.',
          ].join('\n'),
        },
      ],
      annual: [
        {
          id: 'demo-plan-review',
          title: 'Annual Money Review',
          body: [
            'Every January:',
            '- Review the day rate against the market',
            '- Rebalance investments back to target',
            '- Fund IRA and HSA contributions for the year',
          ].join('\n'),
        },
      ],
      conditional: [],
      checklists: [
        {
          id: 'demo-plan-yearend',
          title: 'Year-End Checklist',
          body: '',
          deadline: `${new Date().getFullYear()}-12-15`,
          checklist: [
            { id: 'demo-ck-1', text: 'Send final invoices for the year', done: false },
            { id: 'demo-ck-2', text: 'Book a planning session with the accountant', done: true },
            { id: 'demo-ck-3', text: 'Make the IRA contribution', done: false },
          ],
        },
      ],
    },
    lastUpdated: null,
  };
}

export const DEMO_PROFILE: ExportProfile = {
  profileText: [
    '**Career:** Freelance designer, NYC. Day-rate work for studios and production companies.',
    '',
    '**Note:** This is a demo profile. All figures in this briefing are fictional.',
  ].join('\n'),
  questionsText: [
    '- Am I on track financially?',
    '- Should I raise my day rate?',
    '- Is my emergency fund the right size?',
  ].join('\n'),
  lastUpdated: null,
};
