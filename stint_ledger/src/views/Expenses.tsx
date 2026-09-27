import React, { useMemo, useState, useCallback, useRef } from 'react';
import type { StintData, AccountBalances } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { HandCheck } from '../components/HandCheck';
import { PageTitle } from '../components/Ink';
import { fmt, fmtCompact, currentYear, weekdaysElapsedYTD } from '../lib/helpers';
import { estimateTaxes, estimateW2Taxes } from '../lib/tax';
import { CD_DAY_RATE } from '../lib/rates';
import { useExpenseModel } from '../hooks/useExpenseModel';
import { usePlannerSettings } from '../hooks/usePlannerSettings';
import type { RecurringExpense, OneTimeExpense } from '../hooks/useExpenseModel';

interface Props {
  data: StintData;
  balances: AccountBalances;
}

// Category inks from the Field Journal palette
const CATEGORIES: { id: string; label: string; color: string; dot: string }[] = [
  { id: 'housing', label: 'Housing', color: 'bg-fern', dot: 'bg-fern' },
  { id: 'insurance', label: 'Insurance', color: 'bg-inkblue', dot: 'bg-inkblue' },
  { id: 'utilities', label: 'Utilities', color: 'bg-pencil', dot: 'bg-pencil' },
  { id: 'food', label: 'Food', color: 'bg-forest', dot: 'bg-forest' },
  { id: 'transport', label: 'Transport', color: 'bg-clay', dot: 'bg-clay' },
  { id: 'subscriptions', label: 'Subscriptions', color: 'bg-sagedeep', dot: 'bg-sagedeep' },
  { id: 'health', label: 'Health', color: 'bg-oxblood', dot: 'bg-oxblood' },
  { id: 'other', label: 'Other', color: 'bg-ink-dim', dot: 'bg-ink-dim' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getCategoryConfig(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

const DEFAULT_HEALTH_INS = 1600;

export function Expenses({ data, balances }: Props) {
  const {
    model,
    addRecurring,
    updateRecurring,
    removeRecurring,
    reorderRecurring,
    addOneTime,
    updateOneTime,
    removeOneTime,
    setFullYearProjection,
    reset,
  } = useExpenseModel();

  // --- Drag-to-reorder state ---
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Touch drag state
  const touchState = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    index: number | null;
    startY: number;
    active: boolean;
    clone: HTMLElement | null;
    rowHeight: number;
  }>({ timer: null, index: null, startY: 0, active: false, clone: null, rowHeight: 0 });

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '';
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndex;
    if (fromIndex !== null && fromIndex !== toIndex) {
      reorderRecurring(fromIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, reorderRecurring]);

  // Touch handlers for mobile long-press drag
  const listRef = useRef<HTMLDivElement>(null);

  const cleanupTouch = useCallback(() => {
    const ts = touchState.current;
    if (ts.timer) { clearTimeout(ts.timer); ts.timer = null; }
    if (ts.clone) { ts.clone.remove(); ts.clone = null; }
    ts.active = false;
    ts.index = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    const ts = touchState.current;
    const touch = e.touches[0];
    ts.startY = touch.clientY;
    ts.index = index;
    const row = (e.currentTarget as HTMLElement).closest('[data-drag-row]') as HTMLElement | null;
    ts.rowHeight = row?.offsetHeight ?? 40;

    ts.timer = setTimeout(() => {
      ts.active = true;
      setDragIndex(index);
      // Create floating clone
      if (row) {
        const rect = row.getBoundingClientRect();
        const clone = row.cloneNode(true) as HTMLElement;
        clone.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;z-index:50;opacity:0.9;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);border-radius:8px;background:#f3ecdc;`;
        document.body.appendChild(clone);
        ts.clone = clone;
      }
      // Prevent scroll while dragging
      document.body.style.overflow = 'hidden';
    }, 400);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const ts = touchState.current;
    if (!ts.active) {
      // If moved too much before long-press fires, cancel
      const dy = Math.abs(e.touches[0].clientY - ts.startY);
      if (dy > 10 && ts.timer) { clearTimeout(ts.timer); ts.timer = null; }
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    // Move clone
    if (ts.clone) {
      const rect = ts.clone.getBoundingClientRect();
      ts.clone.style.top = `${touch.clientY - rect.height / 2}px`;
    }
    // Determine which index we're over
    if (listRef.current && ts.index !== null) {
      const listRect = listRef.current.getBoundingClientRect();
      const relativeY = touch.clientY - listRect.top;
      const overIdx = Math.max(0, Math.min(
        model.recurring.length - 1,
        Math.floor(relativeY / ts.rowHeight)
      ));
      setDragOverIndex(overIdx);
    }
  }, [model.recurring.length]);

  const handleTouchEnd = useCallback(() => {
    const ts = touchState.current;
    if (ts.timer) { clearTimeout(ts.timer); ts.timer = null; }
    document.body.style.overflow = '';
    if (ts.active && ts.index !== null && dragOverIndex !== null && ts.index !== dragOverIndex) {
      reorderRecurring(ts.index, dragOverIndex);
    }
    cleanupTouch();
  }, [dragOverIndex, reorderRecurring, cleanupTouch]);

  const fullYear = !!model.fullYearProjection;

  // Pull Planner settings for income/return calculations
  const year = currentYear();
  const plannerDefaults = useMemo(() => {
    // Floor at the validated CD day rate: Stint settings may lag the rate card
    const settingsRate = Math.max(data.settings?.service_rates?.day_rate ?? 0, CD_DAY_RATE);
    const yearEntries = data.timeEntries.filter((e) => e.date.startsWith(String(year)));
    const dayRateDates = new Set(yearEntries.filter((e) => e.service_type === 'day_rate').map((e) => e.date));
    const weekdays = weekdaysElapsedYTD(year);
    const actualUtil = weekdays > 0 ? dayRateDates.size / weekdays : 0.55;
    const roundedUtil = Math.round(actualUtil * 20) / 20;
    return {
      dayRate: settingsRate,
      utilization: Math.max(0.3, Math.min(0.9, roundedUtil)),
      vacationDays: 10,
      holidays: 10,
      sickDays: 5,
      monthlyExpensesFreelance: 7150,
      monthlyExpensesFullTime: 7150,
      healthIns: DEFAULT_HEALTH_INS,
      ftHealthIns: 300,
      equityReturn: 0.07,
      rolloverReturn: 0.07,
      cashReturn: 0.04,
      inflationRate: 0.03,
      fullFinancialPicture: true,
      includeBookings: true,
      includePencils: false,
      targetUtil: 0.5,
    };
  }, [data, year]);
  const { settings: planner } = usePlannerSettings(plannerDefaults);

  const activeRecurring = useMemo(
    () => model.recurring.filter(r => !r.muted),
    [model.recurring],
  );
  const activeOneTime = useMemo(
    () => model.oneTime.filter(e => !e.muted),
    [model.oneTime],
  );

  const totalMonthlyRecurring = useMemo(
    () => activeRecurring.reduce((s, r) => s + r.amount, 0),
    [activeRecurring],
  );

  // Planner's health insurance ($$ from Planner settings): included in summary/simulation
  // unless the user already has a recurring expense named "health insurance" (avoid double-counting)
  const healthInsFromPlanner = (planner.employmentMode ?? 'freelance') === 'fulltime'
    ? (planner.ftHealthIns ?? 300)
    : planner.healthIns;
  const healthInsAlreadyRecurring = useMemo(
    () => activeRecurring.some(r => /health\s*insurance/i.test(r.name)),
    [activeRecurring],
  );
  const effectiveHealthIns = healthInsAlreadyRecurring ? 0 : healthInsFromPlanner;

  const mutedMonthlyRecurring = useMemo(
    () => model.recurring.filter(r => r.muted).reduce((s, r) => s + r.amount, 0),
    [model.recurring],
  );
  const mutedOneTimeTotal = useMemo(
    () => model.oneTime.filter(e => e.muted).reduce((s, e) => s + e.amount, 0),
    [model.oneTime],
  );
  const totalMutedMonthly = mutedMonthlyRecurring + mutedOneTimeTotal / 12;

  const monthlyTimeline = useMemo(() => {
    return MONTH_LABELS.map((label, i) => {
      const month = i + 1;
      const oneTimeTotal = activeOneTime
        .filter(e => e.month === month)
        .reduce((s, e) => s + e.amount, 0);
      return {
        label,
        month,
        recurring: totalMonthlyRecurring,
        oneTime: oneTimeTotal,
        total: totalMonthlyRecurring + oneTimeTotal,
      };
    });
  }, [activeOneTime, totalMonthlyRecurring]);

  const annualTotal = useMemo(
    () => totalMonthlyRecurring * 12 + activeOneTime.reduce((s, e) => s + e.amount, 0),
    [totalMonthlyRecurring, activeOneTime],
  );

  const avgMonthly = annualTotal / 12;

  const highestMonth = useMemo(() => {
    let max = monthlyTimeline[0];
    for (const m of monthlyTimeline) {
      if (m.total > max.total) max = m;
    }
    return max;
  }, [monthlyTimeline]);

  const maxMonthTotal = highestMonth.total;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of activeRecurring) {
      map.set(r.category, (map.get(r.category) ?? 0) + r.amount);
    }
    const total = totalMonthlyRecurring;
    return CATEGORIES
      .map(c => ({ ...c, amount: map.get(c.id) ?? 0, pct: total > 0 ? (map.get(c.id) ?? 0) / total : 0 }))
      .filter(c => c.amount > 0);
  }, [activeRecurring, totalMonthlyRecurring]);

  const sortedOneTime = useMemo(
    () => [...model.oneTime].sort((a, b) => a.month - b.month),
    [model.oneTime],
  );

  // --- Financial Impact simulation ---
  const empMode = planner.employmentMode ?? 'freelance';

  const incomeCalc = useMemo(() => {
    if (empMode === 'fulltime') {
      const salary = planner.ftSalary ?? 180000;
      const contrib401k = planner.ftContribution401k ?? 23500;
      const taxes = estimateW2Taxes(salary, contrib401k);
      return {
        netMonthly: taxes.netMonthly,
        monthlyInterest: (balances.hys * planner.cashReturn + balances.moneyMarket * planner.cashReturn) / 12,
        monthlyInvestmentReturns: balances.brokerage * planner.equityReturn / 12,
        label: 'Full-Time Salary' as const,
      };
    }
    const availableDays = 260 - planner.vacationDays - planner.holidays - planner.sickDays;
    const grossAnnual = planner.dayRate * availableDays * planner.utilization;
    const taxes = estimateTaxes(grossAnnual);
    return {
      netMonthly: taxes.netMonthly,
      monthlyInterest: (balances.hys * planner.cashReturn + balances.moneyMarket * planner.cashReturn) / 12,
      monthlyInvestmentReturns: balances.brokerage * planner.equityReturn / 12,
      label: 'Freelance Income' as const,
    };
  }, [planner, balances, empMode]);

  const simulation = useMemo(() => {
    const curMonth = new Date().getMonth() + 1; // 1-indexed
    const monthsRemaining = 12 - curMonth + 1; // include current month

    // Starting balances
    let checking = balances.checking;
    let hys = balances.hys;
    let mm = balances.moneyMarket;
    let brokerage = balances.brokerage;
    let tradIRA = balances.tradIRA;
    let rolloverIRA = balances.rolloverIRA;
    let hsa = balances.hsa;

    const income = incomeCalc.netMonthly;
    const passive = planner.fullFinancialPicture
      ? incomeCalc.monthlyInterest + incomeCalc.monthlyInvestmentReturns
      : 0;

    const rows: {
      month: number;
      label: string;
      income: number;
      recurring: number;
      oneTime: number;
      net: number;
      hys: number;
      accessible: number;
      totalNW: number;
    }[] = [];

    let depletedAccount: string | null = null;
    let depletedMonth: string | null = null;

    for (let i = 0; i < monthsRemaining; i++) {
      const month = curMonth + i;
      const recurringOut = totalMonthlyRecurring + effectiveHealthIns;
      const oneTimeOut = activeOneTime
        .filter(e => e.month === month)
        .reduce((s, e) => s + e.amount, 0);

      // Regular cash flow (income + passive - recurring)
      const regularNet = income + passive - recurringOut;
      if (regularNet >= 0) {
        checking += regularNet;
      } else {
        // Deficit cascades: HYS → MM → checking
        hys += regularNet; // regularNet is negative
        if (hys < 0) { mm += hys; hys = 0; }
        if (mm < 0) { checking += mm; mm = 0; }
      }

      // One-time expenses pull from HYS separately
      if (oneTimeOut > 0) {
        hys -= oneTimeOut;
        if (hys < 0) { mm += hys; hys = 0; }
        if (mm < 0) { checking += mm; mm = 0; }
      }

      // Track depletion
      if (!depletedAccount) {
        if (checking < 0) { depletedAccount = 'Checking'; depletedMonth = MONTH_LABELS[month - 1]; }
        else if (hys <= 0 && balances.hys > 0) {
          // Only flag if HYS was positive initially and is now gone
          if (mm <= 0 && balances.moneyMarket > 0) {
            depletedAccount = 'Money Market'; depletedMonth = MONTH_LABELS[month - 1];
          }
        }
      }

      // Apply monthly returns
      hys *= (1 + planner.cashReturn / 12);
      mm *= (1 + planner.cashReturn / 12);
      brokerage *= (1 + planner.equityReturn / 12);
      tradIRA *= (1 + planner.equityReturn / 12);
      rolloverIRA *= (1 + planner.rolloverReturn / 12);
      hsa *= (1 + planner.equityReturn / 12);

      const accessible = checking + hys + mm + brokerage + balances.ccDebt;
      const retirement = tradIRA + rolloverIRA + hsa;

      rows.push({
        month,
        label: MONTH_LABELS[month - 1],
        income: income + passive,
        recurring: recurringOut,
        oneTime: oneTimeOut,
        net: income + passive - recurringOut - oneTimeOut,
        hys,
        accessible,
        totalNW: accessible + retirement,
      });
    }

    const last = rows[rows.length - 1];
    const projChecking = checking;
    const projHys = hys;
    const projMM = mm;
    const projBrokerage = brokerage;
    const projAccessible = last?.accessible ?? 0;
    const projRetirement = tradIRA + rolloverIRA + hsa;
    const projNW = last?.totalNW ?? 0;

    const currentAccessible = balances.checking + balances.hys + balances.moneyMarket + balances.brokerage + balances.ccDebt;
    const currentRetirement = balances.tradIRA + balances.rolloverIRA + balances.hsa;
    const currentNW = currentAccessible + currentRetirement;

    const hysDrawdownPct = balances.hys > 0 ? (balances.hys - projHys) / balances.hys : 0;

    return {
      rows,
      projChecking, projHys, projMM, projBrokerage,
      projAccessible, projRetirement, projNW,
      currentAccessible, currentRetirement, currentNW,
      hysDrawdownPct,
      depletedAccount, depletedMonth,
    };
  }, [balances, incomeCalc, planner, totalMonthlyRecurring, activeOneTime, effectiveHealthIns]);

  // Callout status
  const callout = useMemo(() => {
    if (simulation.depletedAccount) {
      return {
        color: 'callout-bad',
        text: `Warning: ${simulation.depletedAccount} depletes in ${simulation.depletedMonth}`,
        textColor: 'text-negative',
      };
    }
    if (simulation.hysDrawdownPct > 0.3) {
      return {
        color: 'callout-warn',
        text: `HYS draws down ${Math.round(simulation.hysDrawdownPct * 100)}% by year end. Consider spreading one-time expenses`,
        textColor: 'text-caution',
      };
    }
    return {
      color: 'callout-good',
      text: 'Your finances comfortably absorb the modeled expenses',
      textColor: 'text-positive',
    };
  }, [simulation]);

  // One-time impact only simulation
  const oneTimeImpact = useMemo(() => {
    const total = activeOneTime.reduce((s, e) => s + e.amount, 0);
    let checking = balances.checking;
    let hys = balances.hys;
    let mm = balances.moneyMarket;

    hys -= total;
    if (hys < 0) { mm += hys; hys = 0; }
    if (mm < 0) { checking += mm; mm = 0; }

    const currentAccessible = balances.checking + balances.hys + balances.moneyMarket + balances.brokerage + balances.ccDebt;
    const currentRetirement = balances.tradIRA + balances.rolloverIRA + balances.hsa;
    const currentNW = currentAccessible + currentRetirement;
    const projAccessible = checking + hys + mm + balances.brokerage + balances.ccDebt;
    const projNW = projAccessible + currentRetirement;

    const hysDrawdownPct = balances.hys > 0 ? (balances.hys - hys) / balances.hys : 0;
    const depleted = checking < 0;

    let calloutColor: string, calloutText: string, calloutTextColor: string;
    if (depleted) {
      calloutColor = 'callout-bad';
      calloutText = `Warning: One-time expenses (${fmt(total)}) exceed all accessible savings`;
      calloutTextColor = 'text-negative';
    } else if (hys <= 0 && balances.hys > 0) {
      calloutColor = 'callout-bad';
      calloutText = `After one-time expenses (${fmt(total)}), HYS fully depleted`;
      calloutTextColor = 'text-negative';
    } else if (hysDrawdownPct > 0.3) {
      calloutColor = 'callout-warn';
      calloutText = `After one-time expenses (${fmt(total)}), HYS would be ${fmt(hys)} (down ${Math.round(hysDrawdownPct * 100)}%)`;
      calloutTextColor = 'text-caution';
    } else {
      calloutColor = 'callout-good';
      calloutText = `After one-time expenses (${fmt(total)}), HYS would be ${fmt(hys)}`;
      calloutTextColor = 'text-positive';
    }

    return {
      total,
      projChecking: checking,
      projHys: hys,
      projMM: mm,
      projBrokerage: balances.brokerage,
      projRetirement: currentRetirement,
      projAccessible,
      projNW,
      currentAccessible,
      currentRetirement,
      currentNW,
      hysDrawdownPct,
      depleted,
      calloutColor,
      calloutText,
      calloutTextColor,
    };
  }, [activeOneTime, balances]);

  // Income summary values
  const monthlyCashFlow = incomeCalc.netMonthly + (planner.fullFinancialPicture ? incomeCalc.monthlyInterest + incomeCalc.monthlyInvestmentReturns : 0) - totalMonthlyRecurring - effectiveHealthIns;
  const activeOneTimeAnnual = activeOneTime.reduce((s, e) => s + e.amount, 0);

  // Pick the active impact data based on toggle
  const impact = fullYear ? {
    projChecking: simulation.projChecking,
    projHys: simulation.projHys,
    projMM: simulation.projMM,
    projBrokerage: simulation.projBrokerage,
    projAccessible: simulation.projAccessible,
    projRetirement: simulation.projRetirement,
    projNW: simulation.projNW,
    currentAccessible: simulation.currentAccessible,
    currentRetirement: simulation.currentRetirement,
    currentNW: simulation.currentNW,
    hysDrawdownPct: simulation.hysDrawdownPct,
    hysWarn: simulation.hysDrawdownPct > 0.3,
    hysDanger: simulation.projHys <= 0,
    calloutColor: callout.color,
    calloutText: callout.text,
    calloutTextColor: callout.textColor,
  } : {
    projChecking: oneTimeImpact.projChecking,
    projHys: oneTimeImpact.projHys,
    projMM: oneTimeImpact.projMM,
    projBrokerage: oneTimeImpact.projBrokerage,
    projAccessible: oneTimeImpact.projAccessible,
    projRetirement: oneTimeImpact.projRetirement,
    projNW: oneTimeImpact.projNW,
    currentAccessible: oneTimeImpact.currentAccessible,
    currentRetirement: oneTimeImpact.currentRetirement,
    currentNW: oneTimeImpact.currentNW,
    hysDrawdownPct: oneTimeImpact.hysDrawdownPct,
    hysWarn: oneTimeImpact.hysDrawdownPct > 0.3,
    hysDanger: oneTimeImpact.projHys <= 0,
    calloutColor: oneTimeImpact.calloutColor,
    calloutText: oneTimeImpact.calloutText,
    calloutTextColor: oneTimeImpact.calloutTextColor,
  };

  return (
    <div className="space-y-5">
      {/* Title row */}
      <div className="flex items-end justify-between gap-3">
        <PageTitle>the expense model</PageTitle>
        <button onClick={reset} className="btn-link on-desk pb-1">
          Reset defaults
        </button>
      </div>

      {/* 1. Income Summary (read-only from Planner) */}
      <Panel title={`Income Summary: ${incomeCalc.label}`} tape="fern">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Net Take-Home" value={fmt(incomeCalc.netMonthly)} color="text-positive" sub="/mo after tax" />
          {planner.fullFinancialPicture && (
            <StatCard label="Passive Income" value={fmt(incomeCalc.monthlyInterest + incomeCalc.monthlyInvestmentReturns)} color="text-highlight" sub="/mo interest + returns" />
          )}
          <StatCard
            label="Total Monthly In"
            value={fmt(incomeCalc.netMonthly + (planner.fullFinancialPicture ? incomeCalc.monthlyInterest + incomeCalc.monthlyInvestmentReturns : 0))}
            sub="from Planner settings"
          />
          <StatCard
            label="Net After Expenses"
            value={fmt(monthlyCashFlow)}
            color={monthlyCashFlow >= 0 ? 'text-positive' : 'text-negative'}
            sub="/mo cash flow"
          />
        </div>
      </Panel>

      {/* 2. Recurring Expenses */}
      <Panel title="Recurring Expenses" dense action={
        <button
          onClick={() => addRecurring({ name: 'New expense', amount: 0, category: 'other' })}
          className="btn-stamp fern"
        >
          + Add expense
        </button>
      }>
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[24px_1fr_1fr_120px_28px_32px] gap-2 mono-label ledger-head pb-1 px-1">
            <span />
            <span>Category</span>
            <span>Name</span>
            <span className="text-right">Monthly</span>
            <span />
            <span />
          </div>

          <div ref={listRef}>
            {model.recurring.map((r, i) => (
              <div
                key={r.id}
                data-drag-row
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                className={`transition-all duration-150 ${
                  dragIndex === i ? 'opacity-40' : ''
                } ${
                  dragOverIndex === i && dragIndex !== i
                    ? 'border-t-2 border-accent'
                    : 'border-t-2 border-transparent'
                }`}
              >
                <RecurringRow
                  expense={r}
                  onUpdate={(updates) => updateRecurring(r.id, updates)}
                  onRemove={() => removeRecurring(r.id)}
                  onTouchStart={(e) => handleTouchStart(e, i)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              </div>
            ))}
          </div>

          {model.recurring.length > 0 && (
            <div className="ledger-total flex justify-between items-center pt-2 px-1">
              <span className="mono-label">Total recurring</span>
              <span className="figure text-sm">{fmt(totalMonthlyRecurring)}/mo</span>
            </div>
          )}
        </div>
      </Panel>

      {/* 3. One-Time Expenses */}
      <Panel title="One-Time Expenses" dense action={
        <button
          onClick={() => addOneTime({ name: 'New expense', amount: 0, month: new Date().getMonth() + 1 })}
          className="btn-stamp fern"
        >
          + Add expense
        </button>
      }>
        {sortedOneTime.length === 0 ? (
          <p className="text-xs text-ink-dim">No one-time expenses yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-[80px_1fr_120px_28px_32px] gap-2 mono-label ledger-head pb-1 px-1">
              <span>Month</span>
              <span>Name</span>
              <span className="text-right">Amount</span>
              <span />
              <span />
            </div>

            {sortedOneTime.map((e) => (
              <OneTimeRow
                key={e.id}
                expense={e}
                onUpdate={(updates) => updateOneTime(e.id, updates)}
                onRemove={() => removeOneTime(e.id)}
              />
            ))}

            <div className="ledger-total flex justify-between items-center pt-2 px-1">
              <span className="mono-label">Total one-time</span>
              <span className="figure text-sm">
                {fmt(activeOneTimeAnnual)}
              </span>
            </div>
          </div>
        )}
      </Panel>

      {/* 4. Expense Summary & Impact */}
      <Panel title="Expense Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Monthly Recurring" value={fmt(totalMonthlyRecurring)} color="text-negative" />
          <StatCard
            label="Health Insurance"
            value={fmt(healthInsFromPlanner)}
            color="text-negative"
            sub={healthInsAlreadyRecurring ? 'In recurring above' : 'From Planner'}
          />
          <StatCard label="Annual Total" value={fmt(annualTotal + effectiveHealthIns * 12)} color="text-negative" />
          <StatCard label="Avg Monthly" value={fmt(Math.round(avgMonthly + effectiveHealthIns))} color="text-caution" sub="incl. one-time" />
          <StatCard label="Highest Month" value={fmt(highestMonth.total + effectiveHealthIns)} color="text-negative" sub={highestMonth.label} />
        </div>
        {totalMutedMonthly > 0 && (
          <div className="text-xs font-mono text-ink-dim mt-3 px-1">
            Muting {fmt(Math.round(totalMutedMonthly))}/mo in expenses
            {mutedMonthlyRecurring > 0 && mutedOneTimeTotal > 0
              ? ` (${fmt(mutedMonthlyRecurring)}/mo recurring + ${fmt(mutedOneTimeTotal)} one-time)`
              : ''}
          </div>
        )}
      </Panel>

      {/* 5. Financial Impact */}
      <Panel
        title={fullYear ? 'Financial Impact: Year-End Projection' : 'Financial Impact: One-Time Expenses'}
        dense
        action={
          <HandCheck
            checked={fullYear}
            onChange={(v) => setFullYearProjection(v)}
            label={<span className="text-xs text-ink-3">{fullYear ? 'Full year projection' : 'One-time impact only'}</span>}
          />
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <BalanceCard label="Checking" current={balances.checking} projected={impact.projChecking} />
          <BalanceCard
            label="HYS"
            current={balances.hys}
            projected={impact.projHys}
            warn={impact.hysWarn}
            danger={impact.hysDanger}
          />
          <BalanceCard label="Money Market" current={balances.moneyMarket} projected={impact.projMM} />
          <BalanceCard label="Brokerage" current={balances.brokerage} projected={impact.projBrokerage} />
          <BalanceCard label="Total Accessible" current={impact.currentAccessible} projected={impact.projAccessible} />
          <BalanceCard label="Total Retirement" current={impact.currentRetirement} projected={impact.projRetirement} color="text-retirement" />
          <BalanceCard label="Total Net Worth" current={impact.currentNW} projected={impact.projNW} color="text-positive" />
        </div>

        {fullYear && (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th className="text-left">Month</th>
                  <th className="text-right">Income</th>
                  <th className="text-right">Recurring</th>
                  <th className="text-right">One-Time</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">HYS</th>
                  <th className="text-right hidden md:table-cell">Accessible</th>
                  <th className="text-right hidden md:table-cell">Total NW</th>
                </tr>
              </thead>
              <tbody>
                {simulation.rows.map((r) => (
                  <tr key={r.month}>
                    <td className="text-ink-2 font-sans">{r.label}</td>
                    <td className="text-right text-ink-3">{fmt(r.income)}</td>
                    <td className="text-right text-negative">{fmt(r.recurring)}</td>
                    <td className={`text-right ${r.oneTime > 0 ? 'text-caution' : 'text-ink-dim'}`}>
                      {r.oneTime > 0 ? fmt(r.oneTime) : '–'}
                    </td>
                    <td className={`text-right font-medium ${r.net >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {fmt(r.net)}
                    </td>
                    <td className={`text-right ${r.hys < balances.hys * 0.5 ? 'text-caution' : 'text-ink-2'}`}>
                      {fmt(r.hys)}
                    </td>
                    <td className="text-right text-ink-3 hidden md:table-cell">{fmt(r.accessible)}</td>
                    <td className="text-right text-ink-2 hidden md:table-cell">{fmt(r.totalNW)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={`callout ${fullYear ? 'mt-4' : ''} ${impact.calloutColor}`}>
          {impact.calloutText}
        </div>
      </Panel>

      {/* 6. Monthly Timeline */}
      <Panel title="Monthly Timeline" tape="clay" tapeSide="right">
        <div className="pt-4">
          <div className="flex items-end gap-1.5 h-40">
            {monthlyTimeline.map((m, bi) => {
              const recurringPct = maxMonthTotal > 0 ? (m.recurring / maxMonthTotal) * 100 : 0;
              const oneTimePct = maxMonthTotal > 0 ? (m.oneTime / maxMonthTotal) * 100 : 0;
              const totalPct = recurringPct + oneTimePct;
              return (
                <div
                  key={m.label}
                  className="pbar-col relative flex-1 h-full flex flex-col justify-end"
                  style={{ '--b': bi } as React.CSSProperties}
                >
                  <div
                    className="w-full flex flex-col justify-end"
                    style={{ height: `${totalPct}%` }}
                    title={`${m.label}: ${fmt(m.total)} (${fmt(m.recurring)} recurring${m.oneTime > 0 ? ` + ${fmt(m.oneTime)} one-time` : ''})`}
                  >
                    {m.oneTime > 0 && (
                      <div
                        className="pbar pbar-stack bg-pencil"
                        style={{ height: `${(oneTimePct / totalPct) * 100}%`, minHeight: '2px' }}
                      />
                    )}
                    <div
                      className="pbar pbar-stack bg-clay"
                      style={{ height: `${(recurringPct / totalPct) * 100}%`, minHeight: '2px' }}
                    />
                  </div>
                  {m.total > 0 && (
                    <span className={`bar-label ${m.oneTime > 0 ? 'best' : ''}`} style={{ bottom: `calc(${totalPct}% + 3px)` }}>
                      {fmtCompact(m.total)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-1">
            {monthlyTimeline.map((m) => (
              <span key={m.label} className="flex-1 text-center text-[10px] font-mono text-ink-dim">{m.label}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-ink-dim">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-clay rounded-sm inline-block" /> Recurring</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-pencil rounded-sm inline-block" /> One-time</span>
        </div>
      </Panel>

      {/* 7. Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <Panel title="Category Breakdown">
          <div className="alloc">
            {categoryBreakdown.map((c) => (
              <div
                key={c.id}
                className={`${c.color} h-full`}
                style={{ width: `${c.pct * 100}%` }}
                title={`${c.label}: ${fmt(c.amount)} (${(c.pct * 100).toFixed(1)}%)`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {categoryBreakdown.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5 text-xs font-mono text-ink-3">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                {c.label} {fmt(c.amount)} ({(c.pct * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ---- Subcomponents ---- */

function BalanceCard({ label, current, projected, color, warn, danger }: {
  label: string;
  current: number;
  projected: number;
  color?: string;
  warn?: boolean;
  danger?: boolean;
}) {
  const delta = projected - current;
  const up = delta >= 0;
  const valueColor = danger ? 'text-negative' : warn ? 'text-caution' : color ?? 'text-ink';
  return (
    <div className="scrap">
      <div className="scrap-label">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xs text-ink-dim">{fmt(current)}</span>
        <span className="text-ink-dim">→</span>
        <span className={`figure text-base ${valueColor}`}>{fmt(projected)}</span>
      </div>
      <div className={`text-xs font-mono mt-0.5 ${up ? 'text-positive' : 'text-negative'}`}>
        {up ? '↑' : '↓'} {fmt(delta)}
      </div>
    </div>
  );
}

/* ---- Row components ---- */

function RecurringRow({ expense, onUpdate, onRemove, onTouchStart, onTouchMove, onTouchEnd }: {
  expense: RecurringExpense;
  onUpdate: (updates: Partial<Omit<RecurringExpense, 'id'>>) => void;
  onRemove: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
}) {
  const cat = getCategoryConfig(expense.category);
  const muted = !!expense.muted;
  return (
    <div className={`grid grid-cols-[24px_1fr_1fr_120px_28px_32px] gap-2 items-center px-1 ${muted ? 'opacity-40' : ''}`}>
      <div
        className="flex items-center justify-center cursor-grab active:cursor-grabbing text-ink-dim hover:text-ink-3 touch-none select-none"
        title="Drag to reorder"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="2" y="2" width="8" height="1.5" rx="0.5" />
          <rect x="2" y="5.25" width="8" height="1.5" rx="0.5" />
          <rect x="2" y="8.5" width="8" height="1.5" rx="0.5" />
        </svg>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cat.dot}`} />
        <select
          value={expense.category}
          onChange={(e) => onUpdate({ category: e.target.value })}
          className="text-xs cursor-pointer truncate w-full py-0.5 px-1 font-sans"
        >
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={expense.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className={`bg-transparent text-sm font-sans px-1 py-0.5 truncate ${muted ? 'text-ink-dim line-through' : 'text-ink'}`}
      />
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-dim font-mono text-sm">$</span>
        <input
          type="number"
          value={expense.amount}
          onChange={(e) => onUpdate({ amount: Number(e.target.value) })}
          className="w-full bg-transparent px-2 py-0.5 pl-6 text-sm text-right"
        />
      </div>
      <button
        onClick={() => onUpdate({ muted: !muted })}
        className={`text-sm transition-colors w-7 h-7 flex items-center justify-center rounded ${muted ? 'text-ink-dim hover:text-ink-3' : 'text-ink-3 hover:text-ink'}`}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '◌' : '◉'}
      </button>
      <button
        onClick={onRemove}
        className="text-ink-dim hover:text-clay text-sm transition-colors w-8 h-8 flex items-center justify-center"
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

function OneTimeRow({ expense, onUpdate, onRemove }: {
  expense: OneTimeExpense;
  onUpdate: (updates: Partial<Omit<OneTimeExpense, 'id'>>) => void;
  onRemove: () => void;
}) {
  const muted = !!expense.muted;
  return (
    <div className={`grid grid-cols-[80px_1fr_120px_28px_32px] gap-2 items-center px-1 ${muted ? 'opacity-40' : ''}`}>
      <select
        value={expense.month}
        onChange={(e) => onUpdate({ month: Number(e.target.value) })}
        className="text-xs cursor-pointer py-0.5 px-1 font-sans"
      >
        {MONTH_LABELS.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
      <input
        type="text"
        value={expense.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className={`bg-transparent text-sm font-sans px-1 py-0.5 truncate ${muted ? 'text-ink-dim line-through' : 'text-ink'}`}
      />
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-dim font-mono text-sm">$</span>
        <input
          type="number"
          value={expense.amount}
          onChange={(e) => onUpdate({ amount: Number(e.target.value) })}
          className="w-full bg-transparent px-2 py-0.5 pl-6 text-sm text-right"
        />
      </div>
      <button
        onClick={() => onUpdate({ muted: !muted })}
        className={`text-sm transition-colors w-7 h-7 flex items-center justify-center rounded ${muted ? 'text-ink-dim hover:text-ink-3' : 'text-ink-3 hover:text-ink'}`}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '◌' : '◉'}
      </button>
      <button
        onClick={onRemove}
        className="text-ink-dim hover:text-clay text-sm transition-colors w-8 h-8 flex items-center justify-center"
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}
