import React, { useMemo, useState, useCallback } from 'react';
import type { StintData, AccountBalances } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { HandCheck } from '../components/HandCheck';
import { PageTitle, Note } from '../components/Ink';
import { estimateTaxes, estimateW2Taxes } from '../lib/tax';
import { CD_DAY_RATE, SHOOT_SUP_RATE } from '../lib/rates';
import { fmt, fmtPct, currentYear, weekdaysElapsedYTD, weekdaysBetween } from '../lib/helpers';
import { usePlannerSettings, migrateLegacyExpenses } from '../hooks/usePlannerSettings';
import type { PlannerSettings } from '../hooks/usePlannerSettings';
import { useExpenseModel } from '../hooks/useExpenseModel';
import { useSavedScenarios } from '../hooks/useSavedScenarios';
import type { SavedScenario, SavedScenarioMetrics } from '../hooks/useSavedScenarios';

interface Props {
  data: StintData;
  balances: AccountBalances;
}

const DEFAULT_HEALTH_INS = 1600;
const DEFAULT_FT_HEALTH_INS = 300;
const DEFAULT_MONTHLY_EXPENSES_BASE = 7150;

export function Planner({ data, balances }: Props) {
  const year = currentYear();

  // Calculate actual defaults from data
  const computedDefaults = useMemo(() => {
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
      monthlyExpensesFreelance: DEFAULT_MONTHLY_EXPENSES_BASE,
      monthlyExpensesFullTime: DEFAULT_MONTHLY_EXPENSES_BASE,
      healthIns: DEFAULT_HEALTH_INS,
      ftHealthIns: DEFAULT_FT_HEALTH_INS,
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

  const { settings: s, update, reset } = usePlannerSettings(computedDefaults);
  const [resetShown, setResetShown] = useState(false);

  const { model: expenseModel, replaceModel: replaceExpenseModel } = useExpenseModel();
  const { scenarios: savedScenarios, save: saveScenario, remove: removeScenario } = useSavedScenarios();
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const mode = s.employmentMode ?? 'freelance';

  const vacationDays = s.vacationDays;
  const holidays = s.holidays;
  const sickDays = s.sickDays;
  const includeBookings = s.includeBookings;
  const includePencils = s.includePencils;

  const availableDays = 260 - vacationDays - holidays - sickDays;
  const availablePerMonth = availableDays / 12;

  const daysToTarget = useMemo(() => {
    const yearStr = String(year);
    const dayRateDates = new Set(
      data.timeEntries
        .filter((e) => e.date.startsWith(yearStr) && e.service_type === 'day_rate')
        .map((e) => e.date)
    );
    const daysWorked = dayRateDates.size;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const eoyStr = `${year}-12-31`;
    const weekdaysRemaining = weekdaysBetween(tomorrowStr, eoyStr);

    // Pipeline days from future pencils
    const futurePencils = data.pencils.filter((p) => p.end_date >= todayStr);
    let rawBooked = 0;
    let rawPenciled = 0;
    futurePencils.forEach((p) => {
      const startClamped = p.start_date < todayStr ? todayStr : p.start_date;
      const days = weekdaysBetween(startClamped, p.end_date);
      if (p.priority === 0) rawBooked += days;
      else rawPenciled += days;
    });

    const bookedDays = includeBookings ? rawBooked : 0;
    const penciledDays = includePencils ? rawPenciled : 0;
    const committedDays = bookedDays + penciledDays;

    const weekdaysElapsed = weekdaysElapsedYTD(year);
    const actualUtil = weekdaysElapsed > 0 ? daysWorked / weekdaysElapsed : 0;
    const minTarget = Math.min(0.9, Math.ceil(actualUtil * 20) / 20);

    const monthsRemaining = (new Date(year, 11, 31).getTime() - today.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

    return {
      daysWorked, weekdaysRemaining, minTarget, monthsRemaining,
      rawBooked, rawPenciled, bookedDays, penciledDays, committedDays,
    };
  }, [data.timeEntries, data.pencils, year, includeBookings, includePencils]);

  const targetUtil = s.targetUtil;
  const [targetInput, setTargetInput] = useState(String(Math.round(targetUtil * 100)));

  const targetCalc = useMemo(() => {
    const targetDays = Math.round(availableDays * targetUtil);
    const daysAccountedFor = daysToTarget.daysWorked + daysToTarget.committedDays;
    const daysStillNeeded = Math.max(0, targetDays - daysAccountedFor);

    // Uncommitted time remaining
    const uncommittedDaysRemaining = Math.max(0, daysToTarget.weekdaysRemaining - daysToTarget.committedDays);
    const uncommittedMonths = uncommittedDaysRemaining / 22;
    const newWorkPerMonth = uncommittedMonths > 0 ? daysStillNeeded / uncommittedMonths : 0;

    const remainingUtilRequired = uncommittedDaysRemaining > 0 ? daysStillNeeded / uncommittedDaysRemaining : daysStillNeeded > 0 ? Infinity : 0;
    const impossible = daysStillNeeded > uncommittedDaysRemaining;
    const aggressive = !impossible && remainingUtilRequired > 0.85;
    const alreadyMet = daysStillNeeded <= 0;
    const pipelineCovers = daysStillNeeded <= 0 && daysToTarget.committedDays > 0;

    return { targetDays, daysStillNeeded, newWorkPerMonth, uncommittedMonths, remainingUtilRequired, impossible, aggressive, alreadyMet, pipelineCovers };
  }, [targetUtil, daysToTarget, availableDays]);

  const dayRate = s.dayRate;
  const utilization = s.utilization;
  const monthlyExpensesFreelance = s.monthlyExpensesFreelance;
  const monthlyExpensesFullTime = s.monthlyExpensesFullTime;
  const activeMonthlyExpenses = mode === 'fulltime' ? monthlyExpensesFullTime : monthlyExpensesFreelance;
  const healthIns = s.healthIns;
  const equityReturn = s.equityReturn;
  const rolloverReturn = s.rolloverReturn;
  const cashReturn = s.cashReturn;
  const inflationRate = s.inflationRate;
  const fullPicture = s.fullFinancialPicture;

  // Real returns (nominal - inflation): all values expressed in today's dollars
  const realEquityReturn = equityReturn - inflationRate;
  const realRolloverReturn = rolloverReturn - inflationRate;
  const realCashReturn = cashReturn - inflationRate;

  const calc = useMemo(() => {
    const workingDays = Math.round(availableDays * utilization);
    const weeksOn = Math.round(workingDays / 5);
    const weeksOff = 52 - weeksOn;
    const monthsWorked = Math.round(12 * utilization * 10) / 10;

    const grossMonthly = dayRate * availablePerMonth * utilization;
    const grossAnnual = dayRate * availableDays * utilization;

    const taxes = estimateTaxes(grossAnnual);

    // Interest income (HYS + Money Market): nominal returns
    const monthlyInterest = (balances.hys * cashReturn + balances.moneyMarket * cashReturn) / 12;

    // Investment returns (taxable brokerage): nominal returns
    const monthlyInvestmentReturns = balances.brokerage * equityReturn / 12;

    // Total expenses = freelance base expenses + freelance health insurance
    const totalExpenses = monthlyExpensesFreelance + healthIns;

    // Freelance-only cash flow (toggle OFF)
    const freelanceMonthlyCashFlow = taxes.netMonthly - totalExpenses;

    // Full cash flow including passive (toggle ON)
    const fullMonthlyCashFlow = taxes.netMonthly + monthlyInterest + monthlyInvestmentReturns - totalExpenses;

    // Toggle-aware values for snapshot display
    const monthlyCashFlow = fullPicture ? fullMonthlyCashFlow : freelanceMonthlyCashFlow;
    const annualSavings = monthlyCashFlow * 12;

    // Full annual savings (always includes passive: used by 5-year projection)
    const fullAnnualSavings = fullMonthlyCashFlow * 12;

    // Retirement account growth (tax-deferred): nominal returns
    const annualRetirementGrowth =
      balances.tradIRA * equityReturn +
      balances.rolloverIRA * rolloverReturn +
      balances.hsa * equityReturn;
    const monthlyRetirementGrowth = annualRetirementGrowth / 12;

    // Total NW growth (freelance cash flow + interest + investment returns + retirement growth)
    const monthlyNWGrowth =
      freelanceMonthlyCashFlow +
      monthlyInterest +
      monthlyInvestmentReturns +
      monthlyRetirementGrowth;
    const annualNWGrowth = monthlyNWGrowth * 12;

    return {
      weeksOn, weeksOff, monthsWorked,
      grossMonthly, grossAnnual,
      taxes,
      monthlyInterest,
      monthlyInvestmentReturns,
      monthlyExpensesBase: monthlyExpensesFreelance,
      healthIns,
      totalExpenses,
      monthlyCashFlow,
      annualSavings,
      freelanceMonthlyCashFlow,
      freelanceAnnualSavings: freelanceMonthlyCashFlow * 12,
      fullMonthlyCashFlow,
      fullAnnualSavings,
      monthlyRetirementGrowth,
      annualRetirementGrowth,
      monthlyNWGrowth,
      annualNWGrowth,
    };
  }, [dayRate, utilization, monthlyExpensesFreelance, healthIns, equityReturn, rolloverReturn, cashReturn, balances, availableDays, availablePerMonth, fullPicture]);

  // Full-time calculations
  const ftCalc = useMemo(() => {
    if (mode !== 'fulltime') return null;
    const salary = s.ftSalary ?? 180000;
    const contrib401k = s.ftContribution401k ?? 23500;
    const employerMatch = s.ftEmployerMatch ?? 0.04;
    const ftHealthIns = s.ftHealthIns ?? DEFAULT_FT_HEALTH_INS;
    const ftOtherBenefits = s.ftOtherBenefits ?? 0;

    const taxes = estimateW2Taxes(salary, contrib401k);
    const employerMatchAnnual = salary * employerMatch;
    const total401kAnnual = contrib401k + employerMatchAnnual;

    // Total expenses = FT base expenses + FT health insurance (independent)
    const totalExpenses = monthlyExpensesFullTime + ftHealthIns;

    // Monthly cash flow (net take-home minus expenses)
    const monthlyInterestAlways = (balances.hys * cashReturn + balances.moneyMarket * cashReturn) / 12;
    const monthlyInvestmentReturnsAlways = balances.brokerage * equityReturn / 12;
    const monthlyInterest = fullPicture ? monthlyInterestAlways : 0;
    const monthlyInvestmentReturns = fullPicture ? monthlyInvestmentReturnsAlways : 0;
    const incomeOnlyMonthlyCashFlow = taxes.netMonthly - totalExpenses;
    const fullMonthlyCashFlow = taxes.netMonthly + monthlyInterestAlways + monthlyInvestmentReturnsAlways - totalExpenses;
    const monthlyCashFlow = taxes.netMonthly + monthlyInterest + monthlyInvestmentReturns - totalExpenses;

    // Retirement account growth (same as freelance calc)
    const annualRetirementGrowth =
      balances.tradIRA * equityReturn +
      balances.rolloverIRA * rolloverReturn +
      balances.hsa * equityReturn;
    const monthlyRetirementGrowth = annualRetirementGrowth / 12;

    // Total NW growth
    const freelanceMonthlyCashFlow = taxes.netMonthly - totalExpenses;
    const monthlyNWGrowth =
      freelanceMonthlyCashFlow +
      (balances.hys * cashReturn + balances.moneyMarket * cashReturn) / 12 +
      balances.brokerage * equityReturn / 12 +
      monthlyRetirementGrowth +
      total401kAnnual / 12;
    const annualNWGrowth = monthlyNWGrowth * 12;

    return {
      salary, contrib401k, employerMatchAnnual, total401kAnnual,
      taxes, ftHealthIns, ftOtherBenefits,
      monthlyExpensesBase: monthlyExpensesFullTime,
      totalExpenses, monthlyCashFlow,
      monthlyInterest, monthlyInvestmentReturns,
      incomeOnlyMonthlyCashFlow,
      incomeOnlyAnnualSavings: incomeOnlyMonthlyCashFlow * 12,
      fullMonthlyCashFlow,
      annualSavings: monthlyCashFlow * 12,
      fullAnnualSavings: fullMonthlyCashFlow * 12,
      monthlyRetirementGrowth, annualRetirementGrowth,
      monthlyNWGrowth, annualNWGrowth,
    };
  }, [mode, s, monthlyExpensesFullTime, fullPicture, balances, cashReturn, equityReturn, rolloverReturn]);

  // Scenario comparison
  const scenarios = useMemo(() => {
    const configs = [
      { name: '50% · $1,384', rate: CD_DAY_RATE, util: 0.5 },
      { name: '55% · $1,384', rate: CD_DAY_RATE, util: 0.55 },
      { name: '60% · $1,384', rate: CD_DAY_RATE, util: 0.6 },
      { name: '65% · $1,384', rate: CD_DAY_RATE, util: 0.65 },
      { name: '70% · $1,384', rate: CD_DAY_RATE, util: 0.7 },
      { name: '55% · $1,500', rate: SHOOT_SUP_RATE, util: 0.55 },
      { name: '65% · $1,500', rate: SHOOT_SUP_RATE, util: 0.65 },
      { name: '60% · $1,600', rate: 1600, util: 0.6 },
    ];

    return configs.map((c) => {
      const gross = c.rate * availableDays * c.util;
      const t = estimateTaxes(gross);
      const daysPerMonth = Math.round(availablePerMonth * c.util);
      const passiveAnnual = fullPicture ? (calc.monthlyInterest + calc.monthlyInvestmentReturns) * 12 : 0;
      const savings = t.netAnnual + passiveAnnual - calc.totalExpenses * 12;
      const isCurrent = c.rate === dayRate && c.util === utilization;
      return { ...c, gross, net: t.netAnnual, savings, daysPerMonth, isCurrent };
    });
  }, [dayRate, utilization, calc.totalExpenses, calc.monthlyInterest, calc.monthlyInvestmentReturns, fullPicture, availableDays, availablePerMonth]);

  // 5-year projection
  const projection = useMemo(() => {
    const years: {
      year: number;
      accessible: number;
      retirement: number;
      total: number;
    }[] = [];

    let checking = balances.checking;
    let hys = balances.hys;
    let mm = balances.moneyMarket;
    let brokerage = balances.brokerage;
    let debt = balances.ccDebt;
    let tradIRA = balances.tradIRA;
    let rolloverIRA = balances.rolloverIRA;
    let hsa = balances.hsa;

    for (let y = 0; y <= 5; y++) {
      const accessible = checking + hys + mm + brokerage + debt;
      const retirement = tradIRA + rolloverIRA + hsa;
      years.push({ year: year + y, accessible, retirement, total: accessible + retirement });

      if (y < 5) {
        // Compound real returns (nominal - inflation)
        hys *= (1 + realCashReturn);
        mm *= (1 + realCashReturn);
        brokerage *= (1 + realEquityReturn);
        tradIRA *= (1 + realEquityReturn);
        rolloverIRA *= (1 + realRolloverReturn);
        hsa *= (1 + realEquityReturn);
        // Add annual savings + retirement contributions
        if (mode === 'fulltime' && ftCalc) {
          tradIRA += ftCalc.total401kAnnual;
          checking += ftCalc.fullAnnualSavings;
        } else {
          checking += calc.fullAnnualSavings;
        }
      }
    }

    return years;
  }, [balances, realCashReturn, realEquityReturn, realRolloverReturn, calc.fullAnnualSavings, year, mode, ftCalc]);

  // Rollover IRA growth scenarios: SPY at 7% is current, others shown for context
  const rolloverComparison = useMemo(() => {
    const scenarios: { rate: number; label: string; current: boolean }[] = [
      { rate: 0.04, label: 'Cash / HYS', current: false },
      { rate: 0.07, label: 'SPY (S&P 500)', current: true },
      { rate: 0.10, label: 'Long-term S&P avg', current: false },
      { rate: 0.12, label: 'Aggressive growth', current: false },
    ];
    return scenarios.map((sc) => {
      const real = sc.rate - inflationRate;
      return {
        rate: sc.rate,
        label: sc.label,
        current: sc.current,
        realRate: real,
        values: Array.from({ length: 6 }, (_, y) => balances.rolloverIRA * Math.pow(1 + real, y)),
      };
    });
  }, [balances.rolloverIRA, inflationRate]);

  const projMax = Math.max(...projection.map((p) => p.total), 1);

  const activeCashFlow = mode === 'fulltime' && ftCalc ? ftCalc.monthlyCashFlow : calc.monthlyCashFlow;
  const activeAnnualSavings = mode === 'fulltime' && ftCalc ? ftCalc.annualSavings : calc.annualSavings;

  // Expense totals from the expense model
  const expenseRecurringTotal = useMemo(
    () => expenseModel.recurring.filter(r => !r.muted).reduce((s, r) => s + r.amount, 0),
    [expenseModel.recurring],
  );
  const expenseOneTimeTotal = useMemo(
    () => expenseModel.oneTime.filter(e => !e.muted).reduce((s, e) => s + e.amount, 0),
    [expenseModel.oneTime],
  );

  // Current metrics for save/compare
  const currentMetrics: SavedScenarioMetrics = useMemo(() => ({
    mode: mode as 'freelance' | 'fulltime',
    dayRate: s.dayRate,
    salary: s.ftSalary ?? 180000,
    utilization: s.utilization,
    grossAnnual: mode === 'fulltime' && ftCalc ? ftCalc.salary : calc.grossAnnual,
    netAnnual: mode === 'fulltime' && ftCalc ? ftCalc.taxes.netAnnual : calc.taxes.netAnnual,
    monthlyCashFlowIncomeOnly: mode === 'fulltime' && ftCalc ? ftCalc.incomeOnlyMonthlyCashFlow : calc.freelanceMonthlyCashFlow,
    monthlyCashFlowFull: mode === 'fulltime' && ftCalc ? ftCalc.fullMonthlyCashFlow : calc.fullMonthlyCashFlow,
    annualSavingsIncomeOnly: mode === 'fulltime' && ftCalc ? ftCalc.incomeOnlyAnnualSavings : calc.freelanceAnnualSavings,
    annualSavingsFull: mode === 'fulltime' && ftCalc ? ftCalc.fullAnnualSavings : calc.fullAnnualSavings,
    year5NetWorth: projection[5]?.total ?? 0,
    monthlyExpenses: mode === 'fulltime' && ftCalc ? ftCalc.totalExpenses : calc.totalExpenses,
    monthlyExpensesBase: mode === 'fulltime' && ftCalc ? ftCalc.monthlyExpensesBase : calc.monthlyExpensesBase,
    healthIns: mode === 'fulltime' && ftCalc ? ftCalc.ftHealthIns : calc.healthIns,
    monthlyRecurringTotal: expenseRecurringTotal,
    oneTimeAnnualTotal: expenseOneTimeTotal,
  }), [mode, s, ftCalc, calc, projection, expenseRecurringTotal, expenseOneTimeTotal]);

  const handleSaveScenario = useCallback(() => {
    const name = prompt('Scenario name:');
    if (!name?.trim()) return;
    saveScenario(name.trim(), { ...s }, { ...expenseModel }, currentMetrics);
  }, [s, expenseModel, currentMetrics, saveScenario]);

  const handleLoadScenario = useCallback((scenario: SavedScenario) => {
    if (!confirm('This will replace your current planner settings and expense model. Continue?')) return;
    const migrated = migrateLegacyExpenses(scenario.settings as unknown as Record<string, unknown>) as unknown as PlannerSettings;
    const keys = Object.keys(migrated) as (keyof PlannerSettings)[];
    for (const key of keys) {
      update(key, migrated[key] as never);
    }
    if (scenario.expenseModel) {
      replaceExpenseModel(scenario.expenseModel);
    }
  }, [update, replaceExpenseModel]);

  const toggleCompareId = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }, []);

  // Build comparison data for selected scenarios
  const compareData = useMemo(() => {
    if (!compareMode) return [];
    return compareIds
      .map(id => savedScenarios.find(s => s.id === id))
      .filter((s): s is SavedScenario => !!s);
  }, [compareMode, compareIds, savedScenarios]);

  const summaryText = activeCashFlow > 1000
    ? 'Healthy surplus: you\'re saving significantly each month.'
    : activeCashFlow > 0
    ? 'Marginally positive: you\'re roughly breaking even.'
    : 'Cash flow negative. Expenses exceed take-home at this utilization.';

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <PageTitle>the planner</PageTitle>
        <div className="flex items-center gap-2 pb-1">
          {savedScenarios.length > 0 && (
            <button
              onClick={() => { setCompareMode(!compareMode); if (compareMode) setCompareIds([]); }}
              className={`btn-stamp on-desk ${compareMode ? 'active' : ''}`}
            >
              {compareMode ? 'Exit compare' : 'Compare'}
            </button>
          )}
          <button onClick={handleSaveScenario} className="btn-tag">
            Save scenario
          </button>
        </div>
      </div>

      {/* Days to Target: freelance only */}
      {mode === 'freelance' && <Panel title="Days to Target" tape="fern">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-ink-3">Target Utilization</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={5}
                max={95}
                step={5}
                value={targetInput}
                onChange={(e) => {
                  setTargetInput(e.target.value);
                  const n = Number(e.target.value);
                  if (n >= 5 && n <= 95) update('targetUtil', n / 100);
                }}
                onBlur={() => {
                  const clamped = Math.max(5, Math.min(95, Math.round(targetUtil * 100)));
                  setTargetInput(String(clamped));
                }}
                className="w-14 px-2 py-0.5 text-sm text-right"
              />
              <span className="text-sm text-ink-dim">%</span>
            </div>
          </div>
          <input
            type="range"
            min={5}
            max={95}
            step={5}
            value={Math.round(targetUtil * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              update('targetUtil', v);
              setTargetInput(e.target.value);
            }}
            className="w-full"
          />
        </div>

        {/* Pipeline toggles */}
        <div className="flex items-center gap-6 mb-4">
          <HandCheck
            checked={includeBookings}
            onChange={(v) => update('includeBookings', v)}
            label={
              <span className="text-sm text-ink-3">
                Bookings
                {daysToTarget.rawBooked > 0 && <span className="font-mono text-ink-dim ml-1">({daysToTarget.rawBooked}d)</span>}
              </span>
            }
          />
          <HandCheck
            checked={includePencils}
            onChange={(v) => update('includePencils', v)}
            label={
              <span className="text-sm text-ink-3">
                Pencils
                {daysToTarget.rawPenciled > 0 && <span className="font-mono text-ink-dim ml-1">({daysToTarget.rawPenciled}d)</span>}
              </span>
            }
          />
        </div>

        <div className="space-y-1.5 text-sm mb-4">
          <p className="text-ink-3">
            <span className="font-mono text-ink">{daysToTarget.daysWorked}</span> days worked
            {daysToTarget.committedDays > 0 && (
              <>{' · '}<span className="font-mono text-accent">{daysToTarget.committedDays}</span> days committed</>
            )}
            {targetCalc.alreadyMet
              ? ''
              : <>{' · '}<span className="font-mono text-caution">{targetCalc.daysStillNeeded}</span> more needed to hit target</>
            }
          </p>
          {targetCalc.pipelineCovers ? (
            <p className="text-positive font-medium">Your committed pipeline already covers the target</p>
          ) : targetCalc.alreadyMet ? (
            <p className="text-positive font-medium">Target already met!</p>
          ) : (
            <p className="text-ink-3">
              That's <span className="font-mono text-ink">{targetCalc.newWorkPerMonth.toFixed(1)}</span> days/month of new work across{' '}
              <span className="font-mono text-ink">{Math.max(0, targetCalc.uncommittedMonths).toFixed(1)}</span> uncommitted months
            </p>
          )}
        </div>

        {/* 3-segment cut-paper strip: worked, committed, needed */}
        <div className="strip">
          <div
            className="strip-seg strip-worked"
            style={{ width: `${targetCalc.targetDays > 0 ? (daysToTarget.daysWorked / targetCalc.targetDays) * 100 : 0}%`, '--s': 0 } as React.CSSProperties}
          />
          {daysToTarget.committedDays > 0 && (
            <div
              className="strip-seg strip-committed"
              style={{ width: `${targetCalc.targetDays > 0 ? (Math.min(daysToTarget.committedDays, Math.max(0, targetCalc.targetDays - daysToTarget.daysWorked)) / targetCalc.targetDays) * 100 : 0}%`, '--s': 1 } as React.CSSProperties}
            />
          )}
          {!targetCalc.alreadyMet && (
            <div
              className="strip-seg strip-needed"
              style={{ width: `${targetCalc.targetDays > 0 ? (targetCalc.daysStillNeeded / targetCalc.targetDays) * 100 : 0}%`, '--s': 2 } as React.CSSProperties}
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-ink-dim mt-1.5 font-mono">
          <div className="flex gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-forest" />{daysToTarget.daysWorked} worked</span>
            {daysToTarget.committedDays > 0 && (
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-pencil" />{daysToTarget.committedDays} committed</span>
            )}
            {!targetCalc.alreadyMet && (
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-paper2 border border-rule" />{targetCalc.daysStillNeeded} needed</span>
            )}
          </div>
          <span>{targetCalc.targetDays} target</span>
        </div>

        {/* Warning tags */}
        {targetCalc.impossible && (
          <div className="callout callout-bad mt-3">
            Not achievable: would require more than available weekdays ({daysToTarget.weekdaysRemaining} remaining)
          </div>
        )}
        {targetCalc.aggressive && (
          <div className="callout callout-warn mt-3">
            Aggressive: requires <span className="font-mono not-italic">{fmtPct(targetCalc.remainingUtilRequired)}</span> utilization for the rest of the year
          </div>
        )}
      </Panel>}

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <div className="paper paper-3">
          <button
            onClick={() => setScenariosOpen(!scenariosOpen)}
            className="w-full flex items-center justify-between px-4 md:px-6 py-3 text-sm text-ink-2 hover:text-ink transition-colors"
          >
            <span className="serif font-semibold">Saved Scenarios ({savedScenarios.length})</span>
            <span className="text-ink-dim text-xs">{scenariosOpen ? '▲' : '▼'}</span>
          </button>
          {scenariosOpen && (
            <div className="mx-4 md:mx-6 pb-4 pt-2 space-y-1" style={{ borderTop: '2px solid rgba(46,42,32,0.7)' }}>
              {savedScenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="ledger-row flex items-center gap-3 py-2.5 px-1 group"
                >
                  {compareMode && (
                    <HandCheck
                      checked={compareIds.includes(sc.id)}
                      onChange={() => toggleCompareId(sc.id)}
                      disabled={!compareIds.includes(sc.id) && compareIds.length >= 3}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm serif font-semibold text-ink truncate">{sc.name}</span>
                      <span className="text-[10px] font-mono text-ink-dim flex-shrink-0">
                        {new Date(sc.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[11px] text-ink-dim font-mono mt-0.5">
                      <span>{sc.metrics.mode === 'fulltime' ? 'FT' : 'FL'}</span>
                      <span className={sc.metrics.monthlyCashFlowFull >= 0 ? 'text-positive' : 'text-negative'}>
                        {fmt(sc.metrics.monthlyCashFlowFull)}/mo
                      </span>
                      <span>{fmt(sc.metrics.annualSavingsFull)}/yr</span>
                      <span className="text-ink-dim">{fmt(sc.metrics.monthlyExpenses)}/mo exp</span>
                    </div>
                  </div>
                  {!compareMode && (
                    <button
                      onClick={() => handleLoadScenario(sc)}
                      className="btn-stamp fern opacity-0 group-hover:opacity-100"
                    >
                      Load
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (deleteConfirm === sc.id) {
                        removeScenario(sc.id);
                        setDeleteConfirm(null);
                        setCompareIds(prev => prev.filter(x => x !== sc.id));
                      } else {
                        setDeleteConfirm(sc.id);
                        setTimeout(() => setDeleteConfirm(null), 3000);
                      }
                    }}
                    className={`btn-link opacity-0 group-hover:opacity-100 ${
                      deleteConfirm === sc.id ? 'clay' : ''
                    }`}
                  >
                    {deleteConfirm === sc.id ? 'Confirm?' : '×'}
                  </button>
                </div>
              ))}
              {compareMode && compareIds.length > 0 && (
                <p className="text-[10px] font-mono text-ink-dim pt-2">
                  {compareIds.length}/3 selected. See comparison table below
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compare Table */}
      {compareMode && compareData.length > 0 && (
        <Panel title="Scenario Comparison" dense>
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th className="text-left">Metric</th>
                  <th className="text-right text-fern">Current</th>
                  {compareData.map(sc => (
                    <th key={sc.id} className="text-right">{sc.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Mode', key: 'mode', format: (v: string | number) => v === 'fulltime' ? 'Full-Time' : 'Freelance', noHighlight: true },
                  { label: 'Day Rate', key: 'dayRate', format: (v: string | number) => fmt(v as number), hideIf: (m: SavedScenarioMetrics) => m.mode === 'fulltime' },
                  { label: 'Salary', key: 'salary', format: (v: string | number) => fmt(v as number), hideIf: (m: SavedScenarioMetrics) => m.mode === 'freelance' },
                  { label: 'Utilization', key: 'utilization', format: (v: string | number) => typeof v === 'number' ? fmtPct(v) : String(v), hideIf: (m: SavedScenarioMetrics) => m.mode === 'fulltime' },
                  { label: 'Gross Annual', key: 'grossAnnual', format: (v: string | number) => fmt(v as number) },
                  { label: 'Net Annual', key: 'netAnnual', format: (v: string | number) => fmt(v as number) },
                  { label: 'Monthly Expenses', key: 'monthlyExpensesBase', format: (v: string | number) => typeof v === 'number' ? fmt(v) : '–', invert: true },
                  { label: 'Health Insurance', key: 'healthIns', format: (v: string | number) => typeof v === 'number' ? fmt(v) : '–', invert: true },
                  { label: 'Total Expenses', key: 'monthlyExpenses', format: (v: string | number) => fmt(v as number), invert: true },
                  { label: 'Recurring Expenses', key: 'monthlyRecurringTotal', format: (v: string | number) => fmt(v as number), invert: true },
                  { label: 'One-Time (Annual)', key: 'oneTimeAnnualTotal', format: (v: string | number) => fmt(v as number), invert: true },
                  { label: 'Cash Flow (income only)', key: 'monthlyCashFlowIncomeOnly', format: (v: string | number) => fmt(v as number) },
                  { label: 'Cash Flow (full picture)', key: 'monthlyCashFlowFull', format: (v: string | number) => fmt(v as number) },
                  { label: 'Savings (income only)', key: 'annualSavingsIncomeOnly', format: (v: string | number) => fmt(v as number) },
                  { label: 'Savings (full picture)', key: 'annualSavingsFull', format: (v: string | number) => fmt(v as number) },
                  { label: 'Year-5 Net Worth', key: 'year5NetWorth', format: (v: string | number) => fmt(v as number) },
                ] as {
                  label: string;
                  key: keyof SavedScenarioMetrics;
                  format: (v: string | number) => string;
                  noHighlight?: boolean;
                  hideIf?: (m: SavedScenarioMetrics) => boolean;
                  invert?: boolean;
                }[]).map(row => {
                  const allValues: { value: number; id: string }[] = [];
                  const curVal = currentMetrics[row.key];
                  if (typeof curVal === 'number') allValues.push({ value: curVal, id: '__current' });
                  for (const sc of compareData) {
                    const v = sc.metrics[row.key];
                    if (typeof v === 'number') allValues.push({ value: v, id: sc.id });
                  }
                  const best = row.noHighlight ? null : (row.invert
                    ? allValues.reduce((a, b) => a.value < b.value ? a : b, allValues[0])
                    : allValues.reduce((a, b) => a.value > b.value ? a : b, allValues[0]));
                  const worst = row.noHighlight ? null : (row.invert
                    ? allValues.reduce((a, b) => a.value > b.value ? a : b, allValues[0])
                    : allValues.reduce((a, b) => a.value < b.value ? a : b, allValues[0]));
                  const allSame = allValues.every(v => v.value === allValues[0]?.value);

                  function cellColor(id: string) {
                    if (row.noHighlight || allSame) return 'text-ink-2';
                    if (best?.id === id) return 'text-positive';
                    if (worst?.id === id) return 'text-negative';
                    return 'text-ink-2';
                  }

                  return (
                    <tr key={row.key}>
                      <td className="text-ink-3 text-xs font-sans">{row.label}</td>
                      <td className={`text-right ${cellColor('__current')}`}>
                        {row.hideIf?.(currentMetrics) ? '–' : row.format(curVal)}
                      </td>
                      {compareData.map(sc => (
                        <td key={sc.id} className={`text-right ${cellColor(sc.id)}`}>
                          {row.hideIf?.(sc.metrics) ? '–' : row.format(sc.metrics[row.key])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Sliders */}
      <Panel
        title="Scenario Inputs"
        dense
        action={
          <button
            onClick={async () => {
              await reset();
              setTargetInput(String(Math.round(computedDefaults.targetUtil * 100)));
              setResetShown(true);
              setTimeout(() => setResetShown(false), 1500);
            }}
            className="btn-stamp"
          >
            {resetShown ? 'Reset \u2713' : 'Reset to defaults'}
          </button>
        }
      >
        {mode === 'fulltime' ? (
          <>
            <Slider label="Salary" value={s.ftSalary ?? 180000} min={100000} max={350000} step={5000} format={fmt} onChange={(v) => update('ftSalary', v)} tone="income" />
            <Slider label="401k Contribution" value={s.ftContribution401k ?? 23500} min={0} max={23500} step={500} format={fmt} onChange={(v) => update('ftContribution401k', v)} sub="Employee pre-tax (2025 limit $23,500)" tone="income" />
            <Slider label="Employer Match" value={s.ftEmployerMatch ?? 0.04} min={0} max={0.10} step={0.005} format={(v) => fmtPct(v, 1)} onChange={(v) => update('ftEmployerMatch', v)} sub={`${fmt((s.ftSalary ?? 180000) * (s.ftEmployerMatch ?? 0.04))}/yr employer contribution`} tone="income" />
            <Slider label="Health Insurance" value={s.ftHealthIns ?? DEFAULT_FT_HEALTH_INS} min={0} max={800} step={25} format={fmt} onChange={(v) => update('ftHealthIns', v)} sub={`Employer-subsidized · Total w/ expenses: ${fmt(activeMonthlyExpenses + (s.ftHealthIns ?? DEFAULT_FT_HEALTH_INS))}/mo`} tone="expense" />
            <Slider label="Other Benefits" value={s.ftOtherBenefits ?? 0} min={0} max={1000} step={50} format={fmt} onChange={(v) => update('ftOtherBenefits', v)} sub="Dental, vision, etc. (monthly value)" tone="income" />
          </>
        ) : (
          <>
            <Slider label="Vacation Days" value={vacationDays} min={0} max={40} step={1} format={(v) => `${v}d`} onChange={(v) => update('vacationDays', v)} />
            <Slider label="Holidays" value={holidays} min={0} max={15} step={1} format={(v) => `${v}d`} onChange={(v) => update('holidays', v)} />
            <Slider label="Sick Days" value={sickDays} min={0} max={15} step={1} format={(v) => `${v}d`} onChange={(v) => update('sickDays', v)} />
          </>
        )}

        <Slider
          label="Monthly Expenses"
          value={activeMonthlyExpenses} min={4000} max={12000} step={250}
          format={fmt}
          onChange={(v) => update(
            mode === 'fulltime' ? 'monthlyExpensesFullTime' : 'monthlyExpensesFreelance',
            v,
          )}
          sub={`Excludes health insurance · ${mode === 'fulltime' ? 'Full-Time' : 'Freelance'} only`}
          tone="expense"
        />
        {mode === 'freelance' && (
          <Slider
            label="Health Insurance"
            value={healthIns} min={400} max={2400} step={100}
            format={fmt} onChange={(v) => update('healthIns', v)}
            sub={`Total w/ expenses: ${fmt(activeMonthlyExpenses + healthIns)}/mo`}
            tone="expense"
          />
        )}

        <Slider label="Equity Return Rate" value={equityReturn} min={0} max={0.15} step={0.01} format={(v) => fmtPct(v)} onChange={(v) => update('equityReturn', v)} tone="income" />
        <Slider
          label="Rollover IRA Return"
          value={rolloverReturn} min={0} max={0.15} step={0.01}
          format={(v) => fmtPct(v)} onChange={(v) => update('rolloverReturn', v)}
          sub="Deployed in SPY (S&P 500 ETF). Defaults to equity return"
          tone="income"
        />
        <Slider label="Cash Return (HYS/MM)" value={cashReturn} min={0} max={0.07} step={0.005} format={(v) => fmtPct(v, 1)} onChange={(v) => update('cashReturn', v)} tone="income" />

        {mode === 'freelance' && (
          <div className="ledger-total pt-4 mt-2">
            <div className="flex gap-3 mb-3">
              {[
                { label: 'CD day rate', rate: CD_DAY_RATE },
                { label: 'Shoot supervisor', rate: SHOOT_SUP_RATE },
              ].map((p) => (
                <button
                  key={p.rate}
                  onClick={() => update('dayRate', p.rate)}
                  className={`price-tag ${dayRate === p.rate ? 'active' : ''}`}
                >
                  {p.label} · {fmt(p.rate)}
                </button>
              ))}
            </div>
            <Slider label="Day Rate" value={dayRate} min={800} max={2000} step={50} format={fmt} onChange={(v) => update('dayRate', v)} tone="income" />
            <Slider
              label="Utilization"
              value={utilization}
              min={0.3} max={0.9} step={0.05}
              format={(v) => fmtPct(v)}
              onChange={(v) => update('utilization', v)}
              sub={`≈ ${calc.weeksOn} weeks on · ${calc.weeksOff} weeks off · ${calc.monthsWorked} months worked`}
              tone="income"
            />
            <div className="text-xs text-ink-dim font-mono">
              <span className="text-ink-3">260</span> weekdays
              {' '}<span className="text-negative">−{vacationDays}</span> vacation
              {' '}<span className="text-negative">−{holidays}</span> holidays
              {' '}<span className="text-negative">−{sickDays}</span> sick
              {' '}= <span className="text-ink font-medium">{availableDays}</span> available days
            </div>
          </div>
        )}
      </Panel>

      {/* Financial picture toggle */}
      <div className="flex items-center fj-desk-text">
        <HandCheck
          checked={fullPicture}
          onChange={(v) => update('fullFinancialPicture', v)}
          label={<span className="hand text-xl leading-none">{fullPicture ? 'full financial picture' : (mode === 'fulltime' ? 'salary income only' : 'freelance income only')}</span>}
        />
      </div>

      {/* Monthly Snapshot */}
      <Panel title="Monthly Snapshot" action={activeCashFlow > 0 ? <Note>in the black ✓</Note> : undefined}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {mode === 'fulltime' && ftCalc ? (
            <>
              <StatCard label="Gross Monthly" value={fmt(ftCalc.salary / 12)} />
              <StatCard label="Est. Taxes" value={fmt(ftCalc.taxes.totalTax / 12)} color="text-negative" sub={fmtPct(ftCalc.taxes.effectiveRate)} />
              <StatCard label="401k Withheld" value={fmt(ftCalc.contrib401k / 12)} color="text-retirement" sub="Pre-tax" />
              <StatCard label="Net Take-Home" value={fmt(ftCalc.taxes.netMonthly)} color="text-positive" />
              {fullPicture && (
                <>
                  <StatCard label="Interest Income" value={fmt(ftCalc.monthlyInterest)} color="text-highlight" />
                  <StatCard label="Investment Returns" value={fmt(ftCalc.monthlyInvestmentReturns)} color="text-accent" />
                </>
              )}
              <StatCard label="Expenses" value={fmt(ftCalc.monthlyExpensesBase)} color="text-negative" sub="Excl. health" />
              <StatCard label="Health Insurance" value={fmt(ftCalc.ftHealthIns)} color="text-negative" sub="Employee share" />
              <StatCard label="Total Expenses" value={fmt(ftCalc.totalExpenses)} color="text-negative" />
              <StatCard label="Net Cash Flow" value={fmt(ftCalc.monthlyCashFlow)} color={ftCalc.monthlyCashFlow >= 0 ? 'text-positive' : 'text-negative'} circled={ftCalc.monthlyCashFlow > 0} />
              {fullPicture && (
                <>
                  <StatCard label="Retirement Growth" value={`+${fmt(ftCalc.monthlyRetirementGrowth)}`} color="text-retirement" />
                  <StatCard label="Total NW Growth" value={fmt(ftCalc.monthlyNWGrowth)} color={ftCalc.monthlyNWGrowth >= 0 ? 'text-highlight' : 'text-negative'} />
                </>
              )}
            </>
          ) : (
            <>
              <StatCard label="Gross Monthly" value={fmt(calc.grossMonthly)} />
              <StatCard label="Est. Taxes" value={fmt(calc.taxes.totalTax / 12)} color="text-negative" sub={fmtPct(calc.taxes.effectiveRate)} />
              <StatCard label="Net Take-Home" value={fmt(calc.taxes.netMonthly)} color="text-positive" />
              {fullPicture && (
                <>
                  <StatCard label="Interest Income" value={fmt(calc.monthlyInterest)} color="text-highlight" />
                  <StatCard label="Investment Returns" value={fmt(calc.monthlyInvestmentReturns)} color="text-accent" />
                </>
              )}
              <StatCard label="Expenses" value={fmt(calc.monthlyExpensesBase)} color="text-negative" sub="Excl. health" />
              <StatCard label="Health Insurance" value={fmt(calc.healthIns)} color="text-negative" />
              <StatCard label="Total Expenses" value={fmt(calc.totalExpenses)} color="text-negative" />
              <StatCard label="Net Cash Flow" value={fmt(calc.monthlyCashFlow)} color={calc.monthlyCashFlow >= 0 ? 'text-positive' : 'text-negative'} circled={calc.monthlyCashFlow > 0} />
              {fullPicture && (
                <>
                  <StatCard label="Retirement Growth" value={`+${fmt(calc.monthlyRetirementGrowth)}`} color="text-retirement" />
                  <StatCard label="Total NW Growth" value={fmt(calc.monthlyNWGrowth)} color={calc.monthlyNWGrowth >= 0 ? 'text-highlight' : 'text-negative'} />
                </>
              )}
            </>
          )}
        </div>
      </Panel>

      {/* Employment Mode Toggle (secondary) */}
      <div className="folder-tabs">
        <button
          className={`folder-tab ${mode === 'freelance' ? 'active' : ''}`}
          onClick={() => update('employmentMode', 'freelance')}
        >
          Freelance
        </button>
        <button
          className={`folder-tab ${mode === 'fulltime' ? 'active' : ''}`}
          onClick={() => update('employmentMode', 'fulltime')}
        >
          Full-Time
        </button>
      </div>

      {/* Annual View */}
      <Panel title="Annual View">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {mode === 'fulltime' && ftCalc ? (
            <>
              <StatCard label="Gross Annual" value={fmt(ftCalc.salary)} />
              <StatCard label="Net After Tax" value={fmt(ftCalc.taxes.netAnnual)} color="text-positive" />
              <StatCard label="Total 401k" value={fmt(ftCalc.total401kAnnual)} color="text-retirement" sub="You + employer" />
              <StatCard label="Annual Savings" value={fmt(ftCalc.annualSavings)} color={ftCalc.annualSavings >= 0 ? 'text-positive' : 'text-negative'} />
              {fullPicture && (
                <>
                  <StatCard label="Interest Income" value={fmt(ftCalc.monthlyInterest * 12)} color="text-highlight" />
                  <StatCard label="Investment Returns" value={fmt(ftCalc.monthlyInvestmentReturns * 12)} color="text-accent" />
                  <StatCard label="Retirement Growth" value={`+${fmt(ftCalc.annualRetirementGrowth)}`} color="text-retirement" />
                  <StatCard label="Total NW Growth" value={fmt(ftCalc.annualNWGrowth)} color={ftCalc.annualNWGrowth >= 0 ? 'text-highlight' : 'text-negative'} />
                </>
              )}
            </>
          ) : (
            <>
              <StatCard label="Gross Annual" value={fmt(calc.grossAnnual)} />
              <StatCard label="Net After Tax" value={fmt(calc.taxes.netAnnual)} color="text-positive" />
              <StatCard label="Annual Savings" value={fmt(calc.annualSavings)} color={calc.annualSavings >= 0 ? 'text-positive' : 'text-negative'} />
              {fullPicture && (
                <>
                  <StatCard label="Interest Income" value={fmt(calc.monthlyInterest * 12)} color="text-highlight" />
                  <StatCard label="Investment Returns" value={fmt(calc.monthlyInvestmentReturns * 12)} color="text-accent" />
                  <StatCard label="Retirement Growth" value={`+${fmt(calc.annualRetirementGrowth)}`} color="text-retirement" />
                  <StatCard label="Total NW Growth" value={fmt(calc.annualNWGrowth)} color={calc.annualNWGrowth >= 0 ? 'text-highlight' : 'text-negative'} />
                </>
              )}
            </>
          )}
        </div>
      </Panel>

      {/* Summary callout */}
      <div className={`callout ${activeCashFlow > 1000 ? 'callout-good' : activeCashFlow > 0 ? 'callout-warn' : 'callout-bad'}`}>
        {summaryText}
      </div>

      {/* Scenario Comparison: freelance only */}
      {mode === 'freelance' && (
        <Panel title="Scenario Comparison" dense>
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th className="text-left">Scenario</th>
                  <th className="text-right">Gross/yr</th>
                  <th className="text-right">Net/yr</th>
                  <th className="text-right">Savings/yr</th>
                  <th className="text-right">Days/mo</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr
                    key={s.name}
                    className={s.isCurrent ? 'bg-sage' : ''}
                  >
                    <td className={`pl-1 ${s.isCurrent ? 'text-fern font-semibold' : 'text-ink-2'}`}>{s.name}</td>
                    <td className="text-right text-ink-2">{fmt(s.gross)}</td>
                    <td className="text-right text-ink-2">{fmt(s.net)}</td>
                    <td className={`text-right ${s.savings >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(s.savings)}</td>
                    <td className="text-right text-ink-3 pr-1">{s.daysPerMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Comparison Panel: FT mode only */}
      {mode === 'fulltime' && ftCalc && (
        <Panel title="Freelance vs Full-Time Comparison" dense>
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th className="text-left">Metric</th>
                  <th className="text-right">Freelance</th>
                  <th className="text-right">Full-Time</th>
                  <th className="text-right">Delta</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Gross Income', fl: calc.grossAnnual, ft: ftCalc.salary },
                  { label: 'Tax Rate', fl: calc.taxes.effectiveRate, ft: ftCalc.taxes.effectiveRate, isPct: true },
                  { label: 'Take-Home', fl: calc.taxes.netAnnual, ft: ftCalc.taxes.netAnnual },
                  { label: '401k / Retirement', fl: 0, ft: ftCalc.total401kAnnual },
                  { label: 'Monthly Cash Flow', fl: calc.monthlyCashFlow, ft: ftCalc.monthlyCashFlow },
                  { label: 'Annual Savings', fl: calc.annualSavings, ft: ftCalc.annualSavings },
                ].map((row) => {
                  const delta = row.isPct ? row.ft - row.fl : row.ft - row.fl;
                  return (
                    <tr key={row.label}>
                      <td className="text-ink-2 font-sans">{row.label}</td>
                      <td className="text-right text-ink-3">
                        {row.isPct ? fmtPct(row.fl) : fmt(row.fl)}
                      </td>
                      <td className="text-right text-ink">
                        {row.isPct ? fmtPct(row.ft) : fmt(row.ft)}
                      </td>
                      <td className={`text-right ${delta >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {row.isPct ? (delta >= 0 ? '+' : '') + fmtPct(delta) : (delta >= 0 ? '+' : '') + fmt(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* 5-Year Net Worth Projection */}
      <Panel title="5-Year Net Worth Projection" tape="kraft" tapeSide="right">
        <div className="flex items-end gap-3 h-48 mb-4">
          {projection.map((p, bi) => {
            const accPct = (p.accessible / projMax) * 100;
            const retPct = (p.retirement / projMax) * 100;
            const barVar = { '--b': bi } as React.CSSProperties;
            return (
              <div key={p.year} className="pbar-col flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end h-40">
                  <div className="pbar pbar-stack bg-kraft" style={{ height: `${retPct}%`, ...barVar }} />
                  <div className="pbar pbar-stack bg-forest" style={{ height: `${accPct}%`, ...barVar }} />
                </div>
                <span className="text-[10px] text-ink-dim font-mono">{p.year}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-xs font-mono text-ink-dim mb-4">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-forest rounded-sm" /> Accessible</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-kraft rounded-sm" /> Retirement</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="NW Today" value={fmt(projection[0].total)} />
          <StatCard label={`Projected ${projection[5].year}`} value={fmt(projection[5].total)} color="text-positive" />
          <StatCard label="Total Growth" value={fmt(projection[5].total - projection[0].total)} color="text-positive" />
        </div>
        <div className="ledger-total pt-4 mt-4">
          <Slider label="Inflation Rate" value={inflationRate} min={0} max={0.08} step={0.005} format={(v) => fmtPct(v, 1)} onChange={(v) => update('inflationRate', v)} />
          <p className="text-[11px] font-mono text-ink-dim -mt-2">Applied to long-term projections only. Monthly/annual figures use nominal returns</p>
        </div>
      </Panel>

      {/* Rollover IRA Growth Scenarios */}
      <Panel title="Rollover IRA Growth Scenarios" dense>
        <p className="text-xs text-ink-dim mb-3">
          Current: SPY at 7% nominal. What {fmt(balances.rolloverIRA)} becomes over 5 years vs. alternative return rates (real, after {fmtPct(inflationRate, 1)} inflation).
        </p>
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th className="text-left">Scenario</th>
                <th className="text-left">Nominal</th>
                <th className="text-left">Real</th>
                {Array.from({ length: 6 }, (_, i) => (
                  <th key={i} className="text-right">Yr {i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rolloverComparison.map((r) => (
                <tr key={r.rate} className={r.current ? 'bg-sage' : ''}>
                  <td className={`pl-1 font-sans ${r.current ? 'text-positive font-semibold' : 'text-ink-3'}`}>
                    {r.label}
                    {r.current && <span className="ml-1.5 text-[10px] font-mono uppercase tracking-wider text-positive/80">Current</span>}
                  </td>
                  <td className="text-ink-2">{fmtPct(r.rate)}</td>
                  <td className="text-ink-dim">{fmtPct(r.realRate)}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className={`text-right text-xs pr-1 ${r.current ? 'text-positive' : 'text-ink-2'}`}>{fmt(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
