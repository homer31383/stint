import React, { useMemo, useState } from 'react';
import type { StintData, AccountBalances } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { estimateTaxes, estimateW2Taxes } from '../lib/tax';
import { fmt, fmtPct, currentYear, weekdaysElapsedYTD, weekdaysBetween } from '../lib/helpers';
import { usePlannerSettings } from '../hooks/usePlannerSettings';

interface Props {
  data: StintData;
  balances: AccountBalances;
}

const DEFAULT_HEALTH_INS = 1600;

export function Planner({ data, balances }: Props) {
  const year = currentYear();

  // Calculate actual defaults from data
  const computedDefaults = useMemo(() => {
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

  const { settings: s, update, reset } = usePlannerSettings(computedDefaults);
  const [resetShown, setResetShown] = useState(false);

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
  const monthlyExpenses = s.monthlyExpenses;
  const healthIns = s.healthIns;
  const equityReturn = s.equityReturn;
  const rolloverReturn = s.rolloverReturn;
  const cashReturn = s.cashReturn;
  const inflationRate = s.inflationRate;
  const fullPicture = s.fullFinancialPicture;

  // Real returns (nominal - inflation) — all values expressed in today's dollars
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

    // Interest income (HYS + Money Market) — nominal returns
    const monthlyInterest = (balances.hys * cashReturn + balances.moneyMarket * cashReturn) / 12;

    // Investment returns (taxable brokerage) — nominal returns
    const monthlyInvestmentReturns = balances.brokerage * equityReturn / 12;

    // Adjusted expenses (health insurance adjusts within)
    const healthDelta = healthIns - DEFAULT_HEALTH_INS;
    const adjustedExpenses = monthlyExpenses + healthDelta;

    // Freelance-only cash flow (toggle OFF)
    const freelanceMonthlyCashFlow = taxes.netMonthly - adjustedExpenses;

    // Full cash flow including passive (toggle ON)
    const fullMonthlyCashFlow = taxes.netMonthly + monthlyInterest + monthlyInvestmentReturns - adjustedExpenses;

    // Toggle-aware values for snapshot display
    const monthlyCashFlow = fullPicture ? fullMonthlyCashFlow : freelanceMonthlyCashFlow;
    const annualSavings = monthlyCashFlow * 12;

    // Full annual savings (always includes passive — used by 5-year projection)
    const fullAnnualSavings = fullMonthlyCashFlow * 12;

    // Retirement account growth (tax-deferred) — nominal returns
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
      adjustedExpenses,
      monthlyCashFlow,
      annualSavings,
      fullAnnualSavings,
      monthlyRetirementGrowth,
      annualRetirementGrowth,
      monthlyNWGrowth,
      annualNWGrowth,
    };
  }, [dayRate, utilization, monthlyExpenses, healthIns, equityReturn, rolloverReturn, cashReturn, balances, availableDays, availablePerMonth, fullPicture]);

  // Full-time calculations
  const ftCalc = useMemo(() => {
    if (mode !== 'fulltime') return null;
    const salary = s.ftSalary ?? 180000;
    const contrib401k = s.ftContribution401k ?? 23500;
    const employerMatch = s.ftEmployerMatch ?? 0.04;
    const ftHealthIns = s.ftHealthIns ?? 200;
    const ftOtherBenefits = s.ftOtherBenefits ?? 0;

    const taxes = estimateW2Taxes(salary, contrib401k);
    const employerMatchAnnual = salary * employerMatch;
    const total401kAnnual = contrib401k + employerMatchAnnual;

    // Adjusted expenses (same pattern as freelance)
    const healthDelta = ftHealthIns - DEFAULT_HEALTH_INS;
    const adjustedExpenses = monthlyExpenses + healthDelta;

    // Monthly cash flow (net take-home minus expenses)
    const monthlyInterest = fullPicture ? (balances.hys * cashReturn + balances.moneyMarket * cashReturn) / 12 : 0;
    const monthlyInvestmentReturns = fullPicture ? balances.brokerage * equityReturn / 12 : 0;
    const monthlyCashFlow = taxes.netMonthly + monthlyInterest + monthlyInvestmentReturns - adjustedExpenses;

    // Retirement account growth (same as freelance calc)
    const annualRetirementGrowth =
      balances.tradIRA * equityReturn +
      balances.rolloverIRA * rolloverReturn +
      balances.hsa * equityReturn;
    const monthlyRetirementGrowth = annualRetirementGrowth / 12;

    // Total NW growth
    const freelanceMonthlyCashFlow = taxes.netMonthly - adjustedExpenses;
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
      adjustedExpenses, monthlyCashFlow,
      monthlyInterest, monthlyInvestmentReturns,
      annualSavings: monthlyCashFlow * 12,
      fullAnnualSavings: (taxes.netMonthly + (balances.hys * cashReturn + balances.moneyMarket * cashReturn) / 12 + balances.brokerage * equityReturn / 12 - adjustedExpenses) * 12,
      monthlyRetirementGrowth, annualRetirementGrowth,
      monthlyNWGrowth, annualNWGrowth,
    };
  }, [mode, s, monthlyExpenses, fullPicture, balances, cashReturn, equityReturn, rolloverReturn]);

  // Scenario comparison
  const scenarios = useMemo(() => {
    const configs = [
      { name: '50% · $1,200', rate: 1200, util: 0.5 },
      { name: '55% · $1,200', rate: 1200, util: 0.55 },
      { name: '60% · $1,200', rate: 1200, util: 0.6 },
      { name: '65% · $1,200', rate: 1200, util: 0.65 },
      { name: '70% · $1,200', rate: 1200, util: 0.7 },
      { name: '55% · $1,400', rate: 1400, util: 0.55 },
      { name: '65% · $1,400', rate: 1400, util: 0.65 },
      { name: '60% · $1,600', rate: 1600, util: 0.6 },
    ];

    return configs.map((c) => {
      const gross = c.rate * availableDays * c.util;
      const t = estimateTaxes(gross);
      const daysPerMonth = Math.round(availablePerMonth * c.util);
      const passiveAnnual = fullPicture ? (calc.monthlyInterest + calc.monthlyInvestmentReturns) * 12 : 0;
      const savings = t.netAnnual + passiveAnnual - calc.adjustedExpenses * 12;
      const isCurrent = c.rate === dayRate && c.util === utilization;
      return { ...c, gross, net: t.netAnnual, savings, daysPerMonth, isCurrent };
    });
  }, [dayRate, utilization, calc.adjustedExpenses, calc.monthlyInterest, calc.monthlyInvestmentReturns, fullPicture, availableDays, availablePerMonth]);

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

  // Rollover IRA deployment comparison — uses real returns
  const rolloverComparison = useMemo(() => {
    const nominalRates = [0.04, 0.07, 0.10, 0.12];
    return nominalRates.map((r) => {
      const real = r - inflationRate;
      return {
        rate: r,
        realRate: real,
        values: Array.from({ length: 6 }, (_, y) => balances.rolloverIRA * Math.pow(1 + real, y)),
      };
    });
  }, [balances.rolloverIRA, inflationRate]);

  const projMax = Math.max(...projection.map((p) => p.total), 1);

  const activeCashFlow = mode === 'fulltime' && ftCalc ? ftCalc.monthlyCashFlow : calc.monthlyCashFlow;

  const summaryText = activeCashFlow > 1000
    ? 'Healthy surplus — you\'re saving significantly each month.'
    : activeCashFlow > 0
    ? 'Marginally positive — you\'re roughly breaking even.'
    : 'Cash flow negative — expenses exceed take-home at this utilization.';

  const summaryColor = activeCashFlow > 1000 ? 'text-positive' : activeCashFlow > 0 ? 'text-caution' : 'text-negative';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Financial Planner</h1>

      {/* Employment Mode Toggle */}
      <div className="flex items-center gap-4">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'freelance' ? 'bg-accent text-white' : 'bg-surface-2 text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => update('employmentMode', 'freelance')}
        >
          Freelance
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'fulltime' ? 'bg-accent text-white' : 'bg-surface-2 text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => update('employmentMode', 'fulltime')}
        >
          Full-Time
        </button>
      </div>

      {/* Days to Target — freelance only */}
      {mode === 'freelance' && <Panel title="Days to Target">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">Target Utilization</span>
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
                className="w-14 bg-surface-3 border border-surface-3 rounded px-2 py-0.5 font-mono text-sm text-white text-right focus:outline-none focus:border-accent"
              />
              <span className="text-sm text-gray-500">%</span>
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
        <div className="flex items-center gap-5 mb-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={includeBookings}
                onChange={(e) => update('includeBookings', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-surface-3 rounded-full peer-checked:bg-accent/60 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
            </div>
            <span className="text-sm text-gray-400">
              Bookings
              {daysToTarget.rawBooked > 0 && <span className="font-mono text-gray-500 ml-1">({daysToTarget.rawBooked}d)</span>}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={includePencils}
                onChange={(e) => update('includePencils', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-surface-3 rounded-full peer-checked:bg-accent/60 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
            </div>
            <span className="text-sm text-gray-400">
              Pencils
              {daysToTarget.rawPenciled > 0 && <span className="font-mono text-gray-500 ml-1">({daysToTarget.rawPenciled}d)</span>}
            </span>
          </label>
        </div>

        <div className="space-y-1.5 text-sm mb-4">
          <p className="text-gray-400">
            <span className="font-mono text-white">{daysToTarget.daysWorked}</span> days worked
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
            <p className="text-gray-400">
              That's <span className="font-mono text-white">{targetCalc.newWorkPerMonth.toFixed(1)}</span> days/month of new work across{' '}
              <span className="font-mono text-white">{Math.max(0, targetCalc.uncommittedMonths).toFixed(1)}</span> uncommitted months
            </p>
          )}
        </div>

        {/* 3-segment progress bar */}
        <div className="h-4 bg-surface-3 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-positive"
            style={{ width: `${targetCalc.targetDays > 0 ? (daysToTarget.daysWorked / targetCalc.targetDays) * 100 : 0}%` }}
          />
          {daysToTarget.committedDays > 0 && (
            <div
              className="h-full bg-accent"
              style={{ width: `${targetCalc.targetDays > 0 ? (Math.min(daysToTarget.committedDays, Math.max(0, targetCalc.targetDays - daysToTarget.daysWorked)) / targetCalc.targetDays) * 100 : 0}%` }}
            />
          )}
          {!targetCalc.alreadyMet && (
            <div
              className="h-full bg-caution/30"
              style={{ width: `${targetCalc.targetDays > 0 ? (targetCalc.daysStillNeeded / targetCalc.targetDays) * 100 : 0}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
          <div className="flex gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-positive" />{daysToTarget.daysWorked} worked</span>
            {daysToTarget.committedDays > 0 && (
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" />{daysToTarget.committedDays} committed</span>
            )}
            {!targetCalc.alreadyMet && (
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-caution/50" />{targetCalc.daysStillNeeded} needed</span>
            )}
          </div>
          <span>{targetCalc.targetDays} target</span>
        </div>

        {/* Warning tags */}
        {targetCalc.impossible && (
          <div className="mt-3 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-sm text-negative font-medium">
            Not achievable — would require more than available weekdays ({daysToTarget.weekdaysRemaining} remaining)
          </div>
        )}
        {targetCalc.aggressive && (
          <div className="mt-3 bg-yellow-900/30 border border-yellow-800 rounded-lg px-3 py-2 text-sm text-caution font-medium">
            Aggressive — requires <span className="font-mono">{fmtPct(targetCalc.remainingUtilRequired)}</span> utilization for the rest of the year
          </div>
        )}
      </Panel>}

      {/* Sliders */}
      <Panel
        title="Scenario Inputs"
        action={
          <button
            onClick={async () => {
              await reset();
              setTargetInput(String(Math.round(computedDefaults.targetUtil * 100)));
              setResetShown(true);
              setTimeout(() => setResetShown(false), 1500);
            }}
            className="text-xs text-gray-500 border border-surface-3 rounded px-2 py-1 hover:text-gray-300 hover:border-gray-600 transition-colors"
          >
            {resetShown ? 'Reset \u2713' : 'Reset to defaults'}
          </button>
        }
      >
        {mode === 'fulltime' ? (
          <>
            <Slider label="Salary" value={s.ftSalary ?? 180000} min={100000} max={350000} step={5000} format={fmt} onChange={(v) => update('ftSalary', v)} />
            <Slider label="401k Contribution" value={s.ftContribution401k ?? 23500} min={0} max={23500} step={500} format={fmt} onChange={(v) => update('ftContribution401k', v)} sub="Employee pre-tax (2025 limit $23,500)" />
            <Slider label="Employer Match" value={s.ftEmployerMatch ?? 0.04} min={0} max={0.10} step={0.005} format={(v) => fmtPct(v, 1)} onChange={(v) => update('ftEmployerMatch', v)} sub={`${fmt((s.ftSalary ?? 180000) * (s.ftEmployerMatch ?? 0.04))}/yr employer contribution`} />
            <Slider label="Health Insurance" value={s.ftHealthIns ?? 200} min={0} max={800} step={25} format={fmt} onChange={(v) => update('ftHealthIns', v)} sub="Monthly employee share" />
            <Slider label="Other Benefits" value={s.ftOtherBenefits ?? 0} min={0} max={1000} step={50} format={fmt} onChange={(v) => update('ftOtherBenefits', v)} sub="Dental, vision, etc. (monthly value)" />
          </>
        ) : (
          <>
            <Slider label="Vacation Days" value={vacationDays} min={0} max={40} step={1} format={(v) => `${v}d`} onChange={(v) => update('vacationDays', v)} />
            <Slider label="Holidays" value={holidays} min={0} max={15} step={1} format={(v) => `${v}d`} onChange={(v) => update('holidays', v)} />
            <Slider label="Sick Days" value={sickDays} min={0} max={15} step={1} format={(v) => `${v}d`} onChange={(v) => update('sickDays', v)} />
          </>
        )}

        <Slider label="Monthly Expenses" value={monthlyExpenses} min={6000} max={14000} step={250} format={fmt} onChange={(v) => update('monthlyExpenses', v)} />
        {mode === 'freelance' && (
          <Slider
            label="Health Insurance"
            value={healthIns} min={400} max={2400} step={100}
            format={fmt} onChange={(v) => update('healthIns', v)}
            sub="Adjusts within total expenses"
          />
        )}

        <Slider label="Equity Return Rate" value={equityReturn} min={0} max={0.15} step={0.01} format={(v) => fmtPct(v)} onChange={(v) => update('equityReturn', v)} />
        <Slider
          label="Rollover IRA Return"
          value={rolloverReturn} min={0} max={0.15} step={0.01}
          format={(v) => fmtPct(v)} onChange={(v) => update('rolloverReturn', v)}
          sub="Currently in HYS — slide up to model deploying"
        />
        <Slider label="Cash Return (HYS/MM)" value={cashReturn} min={0} max={0.07} step={0.005} format={(v) => fmtPct(v, 1)} onChange={(v) => update('cashReturn', v)} />

        {mode === 'freelance' && (
          <div className="border-t border-surface-3 pt-4 mt-2">
            <Slider label="Day Rate" value={dayRate} min={800} max={2000} step={50} format={fmt} onChange={(v) => update('dayRate', v)} />
            <Slider
              label="Utilization"
              value={utilization}
              min={0.3} max={0.9} step={0.05}
              format={(v) => fmtPct(v)}
              onChange={(v) => update('utilization', v)}
              sub={`≈ ${calc.weeksOn} weeks on · ${calc.weeksOff} weeks off · ${calc.monthsWorked} months worked`}
            />
            <div className="text-xs text-gray-500 font-mono">
              <span className="text-gray-400">260</span> weekdays
              {' '}<span className="text-negative">−{vacationDays}</span> vacation
              {' '}<span className="text-negative">−{holidays}</span> holidays
              {' '}<span className="text-negative">−{sickDays}</span> sick
              {' '}= <span className="text-white font-medium">{availableDays}</span> available days
            </div>
          </div>
        )}
      </Panel>

      {/* Financial picture toggle */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={fullPicture}
              onChange={(e) => update('fullFinancialPicture', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-surface-3 rounded-full peer-checked:bg-accent/60 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
          </div>
          <span className="text-sm text-gray-400">{fullPicture ? 'Full financial picture' : (mode === 'fulltime' ? 'Salary income only' : 'Freelance income only')}</span>
        </label>
      </div>

      {/* Monthly Snapshot */}
      <Panel title="Monthly Snapshot">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {mode === 'fulltime' && ftCalc ? (
            <>
              <StatCard label="Gross Monthly" value={fmt(ftCalc.salary / 12)} />
              <StatCard label="Est. Taxes" value={fmt(ftCalc.taxes.totalTax / 12)} color="text-negative" sub={fmtPct(ftCalc.taxes.effectiveRate)} />
              <StatCard label="401k Withheld" value={fmt(ftCalc.contrib401k / 12)} color="text-retirement" sub="Pre-tax" />
              <StatCard label="Net Take-Home" value={fmt(ftCalc.taxes.netMonthly)} color="text-positive" />
              <StatCard label="Health Insurance" value={fmt(ftCalc.ftHealthIns)} color="text-negative" sub="Employee share" />
              {fullPicture && (
                <>
                  <StatCard label="Interest Income" value={fmt(ftCalc.monthlyInterest)} color="text-highlight" />
                  <StatCard label="Investment Returns" value={fmt(ftCalc.monthlyInvestmentReturns)} color="text-accent" />
                </>
              )}
              <StatCard label="Expenses" value={fmt(ftCalc.adjustedExpenses)} color="text-negative" />
              <StatCard label="Net Cash Flow" value={fmt(ftCalc.monthlyCashFlow)} color={ftCalc.monthlyCashFlow >= 0 ? 'text-positive' : 'text-negative'} />
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
              <StatCard label="Expenses" value={fmt(calc.adjustedExpenses)} color="text-negative" />
              <StatCard label="Net Cash Flow" value={fmt(calc.monthlyCashFlow)} color={calc.monthlyCashFlow >= 0 ? 'text-positive' : 'text-negative'} />
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
      <div className="flex items-center gap-4">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'freelance' ? 'bg-accent text-white' : 'bg-surface-2 text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => update('employmentMode', 'freelance')}
        >
          Freelance
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'fulltime' ? 'bg-accent text-white' : 'bg-surface-2 text-gray-400 hover:text-gray-200'
          }`}
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
      <div className={`bg-surface-2 rounded-lg p-4 border-l-4 ${activeCashFlow > 1000 ? 'border-positive' : activeCashFlow > 0 ? 'border-caution' : 'border-negative'}`}>
        <p className={`text-sm font-medium ${summaryColor}`}>{summaryText}</p>
      </div>

      {/* Scenario Comparison — freelance only */}
      {mode === 'freelance' && (
        <Panel title="Scenario Comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="text-left py-1">Scenario</th>
                  <th className="text-right py-1">Gross/yr</th>
                  <th className="text-right py-1">Net/yr</th>
                  <th className="text-right py-1">Savings/yr</th>
                  <th className="text-right py-1">Days/mo</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr
                    key={s.name}
                    className={`border-t border-surface-3 ${s.isCurrent ? 'bg-accent/10' : ''}`}
                  >
                    <td className={`py-2 ${s.isCurrent ? 'text-accent font-medium' : 'text-gray-300'}`}>{s.name}</td>
                    <td className="py-2 text-right font-mono text-gray-300">{fmt(s.gross)}</td>
                    <td className="py-2 text-right font-mono text-gray-300">{fmt(s.net)}</td>
                    <td className={`py-2 text-right font-mono ${s.savings >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(s.savings)}</td>
                    <td className="py-2 text-right font-mono text-gray-400">{s.daysPerMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Comparison Panel — FT mode only */}
      {mode === 'fulltime' && ftCalc && (
        <Panel title="Freelance vs Full-Time Comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="text-left py-1">Metric</th>
                  <th className="text-right py-1">Freelance</th>
                  <th className="text-right py-1">Full-Time</th>
                  <th className="text-right py-1">Delta</th>
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
                    <tr key={row.label} className="border-t border-surface-3">
                      <td className="py-2 text-gray-300">{row.label}</td>
                      <td className="py-2 text-right font-mono text-gray-400">
                        {row.isPct ? fmtPct(row.fl) : fmt(row.fl)}
                      </td>
                      <td className="py-2 text-right font-mono text-white">
                        {row.isPct ? fmtPct(row.ft) : fmt(row.ft)}
                      </td>
                      <td className={`py-2 text-right font-mono ${delta >= 0 ? 'text-positive' : 'text-negative'}`}>
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
      <Panel title="5-Year Net Worth Projection">
        <div className="flex items-end gap-2 h-48 mb-4">
          {projection.map((p) => {
            const accPct = (p.accessible / projMax) * 100;
            const retPct = (p.retirement / projMax) * 100;
            return (
              <div key={p.year} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end h-40">
                  <div className="w-full bg-retirement rounded-t" style={{ height: `${retPct}%` }} />
                  <div className="w-full bg-positive" style={{ height: `${accPct}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 font-mono">{p.year}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-xs text-gray-500 mb-4">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-positive rounded" /> Accessible</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-retirement rounded" /> Retirement</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="NW Today" value={fmt(projection[0].total)} />
          <StatCard label={`Projected ${projection[5].year}`} value={fmt(projection[5].total)} color="text-positive" />
          <StatCard label="Total Growth" value={fmt(projection[5].total - projection[0].total)} color="text-positive" />
        </div>
        <div className="border-t border-surface-3 pt-4 mt-4">
          <Slider label="Inflation Rate" value={inflationRate} min={0} max={0.08} step={0.005} format={(v) => fmtPct(v, 1)} onChange={(v) => update('inflationRate', v)} />
          <p className="text-[11px] text-gray-600 -mt-2">Applied to long-term projections only — monthly/annual figures use nominal returns</p>
        </div>
      </Panel>

      {/* Rollover IRA Deployment */}
      <Panel title="Rollover IRA Deployment Comparison">
        <p className="text-xs text-gray-500 mb-3">
          What {fmt(balances.rolloverIRA)} becomes over 5 years at different return rates (real, after {fmtPct(inflationRate, 1)} inflation)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs">
                <th className="text-left py-1">Nominal</th>
                <th className="text-left py-1">Real</th>
                {Array.from({ length: 6 }, (_, i) => (
                  <th key={i} className="text-right py-1">Yr {i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rolloverComparison.map((r) => (
                <tr key={r.rate} className="border-t border-surface-3">
                  <td className="py-2 text-gray-300">{fmtPct(r.rate)}</td>
                  <td className="py-2 text-gray-500">{fmtPct(r.realRate)}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className="py-2 text-right font-mono text-gray-300 text-xs">{fmt(v)}</td>
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
