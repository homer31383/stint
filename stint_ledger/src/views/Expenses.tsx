import React, { useMemo } from 'react';
import type { StintData, AccountBalances } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { fmt, currentYear, weekdaysElapsedYTD } from '../lib/helpers';
import { estimateTaxes, estimateW2Taxes } from '../lib/tax';
import { useExpenseModel } from '../hooks/useExpenseModel';
import { usePlannerSettings } from '../hooks/usePlannerSettings';
import type { RecurringExpense, OneTimeExpense } from '../hooks/useExpenseModel';

interface Props {
  data: StintData;
  balances: AccountBalances;
}

const CATEGORIES: { id: string; label: string; color: string; dot: string }[] = [
  { id: 'housing', label: 'Housing', color: 'bg-accent', dot: 'bg-accent' },
  { id: 'insurance', label: 'Insurance', color: 'bg-purple-400', dot: 'bg-purple-400' },
  { id: 'utilities', label: 'Utilities', color: 'bg-yellow-400', dot: 'bg-yellow-400' },
  { id: 'food', label: 'Food', color: 'bg-positive', dot: 'bg-positive' },
  { id: 'transport', label: 'Transport', color: 'bg-orange-400', dot: 'bg-orange-400' },
  { id: 'subscriptions', label: 'Subscriptions', color: 'bg-highlight', dot: 'bg-highlight' },
  { id: 'health', label: 'Health', color: 'bg-red-400', dot: 'bg-red-400' },
  { id: 'other', label: 'Other', color: 'bg-gray-400', dot: 'bg-gray-400' },
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
    addOneTime,
    updateOneTime,
    removeOneTime,
    setFullYearProjection,
    reset,
  } = useExpenseModel();

  const fullYear = !!model.fullYearProjection;

  // Pull Planner settings for income/return calculations
  const year = currentYear();
  const plannerDefaults = useMemo(() => {
    const settingsRate = data.settings?.service_rates?.day_rate ?? 1200;
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
      monthlyExpenses: 8750,
      healthIns: DEFAULT_HEALTH_INS,
      equityReturn: 0.07,
      rolloverReturn: 0.04,
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
      const recurringOut = totalMonthlyRecurring;
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
  }, [balances, incomeCalc, planner, totalMonthlyRecurring, activeOneTime]);

  // Callout status
  const callout = useMemo(() => {
    if (simulation.depletedAccount) {
      return {
        color: 'border-negative bg-red-900/30',
        text: `Warning: ${simulation.depletedAccount} depletes in ${simulation.depletedMonth}`,
        textColor: 'text-negative',
      };
    }
    if (simulation.hysDrawdownPct > 0.3) {
      return {
        color: 'border-caution bg-yellow-900/30',
        text: `HYS draws down ${Math.round(simulation.hysDrawdownPct * 100)}% by year end — consider spreading one-time expenses`,
        textColor: 'text-caution',
      };
    }
    return {
      color: 'border-positive bg-emerald-900/30',
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
      calloutColor = 'border-negative bg-red-900/30';
      calloutText = `Warning: One-time expenses (${fmt(total)}) exceed all accessible savings`;
      calloutTextColor = 'text-negative';
    } else if (hys <= 0 && balances.hys > 0) {
      calloutColor = 'border-negative bg-red-900/30';
      calloutText = `After one-time expenses (${fmt(total)}), HYS fully depleted`;
      calloutTextColor = 'text-negative';
    } else if (hysDrawdownPct > 0.3) {
      calloutColor = 'border-caution bg-yellow-900/30';
      calloutText = `After one-time expenses (${fmt(total)}), HYS would be ${fmt(hys)} (down ${Math.round(hysDrawdownPct * 100)}%)`;
      calloutTextColor = 'text-caution';
    } else {
      calloutColor = 'border-positive bg-emerald-900/30';
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
  const monthlyCashFlow = incomeCalc.netMonthly + (planner.fullFinancialPicture ? incomeCalc.monthlyInterest + incomeCalc.monthlyInvestmentReturns : 0) - totalMonthlyRecurring;
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
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Expense Model</h1>
        <button
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Reset defaults
        </button>
      </div>

      {/* 1. Income Summary (read-only from Planner) */}
      <Panel title={`Income Summary — ${incomeCalc.label}`}>
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
      <Panel title="Recurring Expenses" action={
        <button
          onClick={() => addRecurring({ name: 'New expense', amount: 0, category: 'other' })}
          className="text-xs text-accent hover:text-accent/80 transition-colors"
        >
          + Add expense
        </button>
      }>
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[1fr_1fr_120px_28px_32px] gap-2 text-[10px] text-gray-600 uppercase tracking-wide px-1">
            <span>Category</span>
            <span>Name</span>
            <span className="text-right">Monthly</span>
            <span />
            <span />
          </div>

          {model.recurring.map((r) => (
            <RecurringRow
              key={r.id}
              expense={r}
              onUpdate={(updates) => updateRecurring(r.id, updates)}
              onRemove={() => removeRecurring(r.id)}
            />
          ))}

          {model.recurring.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-surface-3 px-1">
              <span className="text-xs text-gray-500">Total recurring</span>
              <span className="font-mono text-sm font-semibold text-white">{fmt(totalMonthlyRecurring)}/mo</span>
            </div>
          )}
        </div>
      </Panel>

      {/* 3. One-Time Expenses */}
      <Panel title="One-Time Expenses" action={
        <button
          onClick={() => addOneTime({ name: 'New expense', amount: 0, month: new Date().getMonth() + 1 })}
          className="text-xs text-accent hover:text-accent/80 transition-colors"
        >
          + Add expense
        </button>
      }>
        {sortedOneTime.length === 0 ? (
          <p className="text-xs text-gray-600">No one-time expenses yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-[80px_1fr_120px_28px_32px] gap-2 text-[10px] text-gray-600 uppercase tracking-wide px-1">
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

            <div className="flex justify-between items-center pt-2 border-t border-surface-3 px-1">
              <span className="text-xs text-gray-500">Total one-time</span>
              <span className="font-mono text-sm font-semibold text-white">
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
          <StatCard label="Annual Total" value={fmt(annualTotal)} color="text-negative" />
          <StatCard label="Avg Monthly" value={fmt(Math.round(avgMonthly))} color="text-caution" sub="incl. one-time" />
          <StatCard label="Highest Month" value={fmt(highestMonth.total)} color="text-negative" sub={highestMonth.label} />
        </div>
        {totalMutedMonthly > 0 && (
          <div className="text-xs text-gray-600 mt-3 px-1">
            Muting {fmt(Math.round(totalMutedMonthly))}/mo in expenses
            {mutedMonthlyRecurring > 0 && mutedOneTimeTotal > 0
              ? ` (${fmt(mutedMonthlyRecurring)}/mo recurring + ${fmt(mutedOneTimeTotal)} one-time)`
              : ''}
          </div>
        )}
      </Panel>

      {/* 5. Financial Impact */}
      <Panel
        title={fullYear ? 'Financial Impact — Year-End Projection' : 'Financial Impact — One-Time Expenses'}
        action={
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={fullYear}
                onChange={(e) => setFullYearProjection(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-surface-3 rounded-full peer-checked:bg-accent/60 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
            </div>
            <span className="text-xs text-gray-400">{fullYear ? 'Full year projection' : 'One-time impact only'}</span>
          </label>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-[10px] uppercase tracking-wide">
                  <th className="text-left py-1">Month</th>
                  <th className="text-right py-1">Income</th>
                  <th className="text-right py-1">Recurring</th>
                  <th className="text-right py-1">One-Time</th>
                  <th className="text-right py-1">Net</th>
                  <th className="text-right py-1">HYS</th>
                  <th className="text-right py-1 hidden md:table-cell">Accessible</th>
                  <th className="text-right py-1 hidden md:table-cell">Total NW</th>
                </tr>
              </thead>
              <tbody>
                {simulation.rows.map((r) => (
                  <tr key={r.month} className="border-t border-surface-3">
                    <td className="py-1.5 text-gray-300">{r.label}</td>
                    <td className="py-1.5 text-right font-mono text-gray-400">{fmt(r.income)}</td>
                    <td className="py-1.5 text-right font-mono text-negative">{fmt(r.recurring)}</td>
                    <td className={`py-1.5 text-right font-mono ${r.oneTime > 0 ? 'text-caution' : 'text-gray-600'}`}>
                      {r.oneTime > 0 ? fmt(r.oneTime) : '—'}
                    </td>
                    <td className={`py-1.5 text-right font-mono font-medium ${r.net >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {fmt(r.net)}
                    </td>
                    <td className={`py-1.5 text-right font-mono ${r.hys < balances.hys * 0.5 ? 'text-caution' : 'text-gray-300'}`}>
                      {fmt(r.hys)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-gray-400 hidden md:table-cell">{fmt(r.accessible)}</td>
                    <td className="py-1.5 text-right font-mono text-gray-300 hidden md:table-cell">{fmt(r.totalNW)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={`${fullYear ? 'mt-4' : ''} rounded-lg p-3 border-l-4 ${impact.calloutColor}`}>
          <p className={`text-sm font-medium ${impact.calloutTextColor}`}>{impact.calloutText}</p>
        </div>
      </Panel>

      {/* 6. Monthly Timeline */}
      <Panel title="Monthly Timeline">
        <div className="flex items-end gap-1 h-40">
          {monthlyTimeline.map((m) => {
            const recurringPct = maxMonthTotal > 0 ? (m.recurring / maxMonthTotal) * 100 : 0;
            const oneTimePct = maxMonthTotal > 0 ? (m.oneTime / maxMonthTotal) * 100 : 0;
            return (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className="w-full flex flex-col justify-end"
                  style={{ height: `${recurringPct + oneTimePct}%` }}
                  title={`${m.label}: ${fmt(m.total)} (${fmt(m.recurring)} recurring${m.oneTime > 0 ? ` + ${fmt(m.oneTime)} one-time` : ''})`}
                >
                  {m.oneTime > 0 && (
                    <div
                      className="w-full bg-caution/60 rounded-t"
                      style={{ height: `${(oneTimePct / (recurringPct + oneTimePct)) * 100}%`, minHeight: '2px' }}
                    />
                  )}
                  <div
                    className={`w-full bg-negative ${m.oneTime > 0 ? '' : 'rounded-t'} rounded-b`}
                    style={{ height: `${(recurringPct / (recurringPct + oneTimePct)) * 100}%`, minHeight: '2px' }}
                  />
                </div>
                <span className="text-[10px] text-gray-600">{m.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-negative rounded-sm inline-block" /> Recurring</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-caution/60 rounded-sm inline-block" /> One-time</span>
        </div>
      </Panel>

      {/* 7. Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <Panel title="Category Breakdown">
          <div className="h-6 rounded-full overflow-hidden flex">
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
              <span key={c.id} className="flex items-center gap-1.5 text-xs text-gray-400">
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
  const valueColor = danger ? 'text-negative' : warn ? 'text-caution' : color ?? 'text-white';
  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xs text-gray-500">{fmt(current)}</span>
        <span className="text-gray-600">→</span>
        <span className={`font-mono text-sm font-semibold ${valueColor}`}>{fmt(projected)}</span>
      </div>
      <div className={`text-xs font-mono mt-0.5 ${up ? 'text-positive' : 'text-negative'}`}>
        {up ? '↑' : '↓'} {fmt(delta)}
      </div>
    </div>
  );
}

/* ---- Row components ---- */

function RecurringRow({ expense, onUpdate, onRemove }: {
  expense: RecurringExpense;
  onUpdate: (updates: Partial<Omit<RecurringExpense, 'id'>>) => void;
  onRemove: () => void;
}) {
  const cat = getCategoryConfig(expense.category);
  const muted = !!expense.muted;
  return (
    <div className={`grid grid-cols-[1fr_1fr_120px_28px_32px] gap-2 items-center px-1 ${muted ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cat.dot}`} />
        <select
          value={expense.category}
          onChange={(e) => onUpdate({ category: e.target.value })}
          className="bg-surface-2 text-xs text-gray-300 border border-surface-3 rounded focus:outline-none focus:border-accent cursor-pointer truncate w-full py-0.5"
        >
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id} className="bg-surface-2 text-gray-200">{c.label}</option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={expense.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className={`bg-transparent text-sm focus:outline-none focus:bg-surface-3 rounded px-1 py-0.5 truncate ${muted ? 'text-gray-500 line-through' : 'text-gray-200'}`}
      />
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
        <input
          type="number"
          value={expense.amount}
          onChange={(e) => onUpdate({ amount: Number(e.target.value) })}
          className="w-full bg-transparent border border-transparent focus:border-surface-3 focus:bg-surface-3 rounded px-2 py-0.5 pl-6 font-mono text-sm text-gray-200 text-right focus:outline-none"
        />
      </div>
      <button
        onClick={() => onUpdate({ muted: !muted })}
        className={`text-sm transition-colors w-7 h-7 flex items-center justify-center rounded ${muted ? 'text-gray-600 hover:text-gray-400' : 'text-gray-500 hover:text-gray-300'}`}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '◌' : '◉'}
      </button>
      <button
        onClick={onRemove}
        className="text-gray-600 hover:text-negative text-sm transition-colors w-8 h-8 flex items-center justify-center"
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
        className="bg-surface-2 text-xs text-gray-300 border border-surface-3 rounded focus:outline-none focus:border-accent cursor-pointer py-0.5"
      >
        {MONTH_LABELS.map((label, i) => (
          <option key={i + 1} value={i + 1} className="bg-surface-2 text-gray-200">{label}</option>
        ))}
      </select>
      <input
        type="text"
        value={expense.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className={`bg-transparent text-sm focus:outline-none focus:bg-surface-3 rounded px-1 py-0.5 truncate ${muted ? 'text-gray-500 line-through' : 'text-gray-200'}`}
      />
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
        <input
          type="number"
          value={expense.amount}
          onChange={(e) => onUpdate({ amount: Number(e.target.value) })}
          className="w-full bg-transparent border border-transparent focus:border-surface-3 focus:bg-surface-3 rounded px-2 py-0.5 pl-6 font-mono text-sm text-gray-200 text-right focus:outline-none"
        />
      </div>
      <button
        onClick={() => onUpdate({ muted: !muted })}
        className={`text-sm transition-colors w-7 h-7 flex items-center justify-center rounded ${muted ? 'text-gray-600 hover:text-gray-400' : 'text-gray-500 hover:text-gray-300'}`}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '◌' : '◉'}
      </button>
      <button
        onClick={onRemove}
        className="text-gray-600 hover:text-negative text-sm transition-colors w-8 h-8 flex items-center justify-center"
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}
