import React, { useMemo, useState } from 'react';
import type { AccountBalances } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { fmt, fmtPct } from '../lib/helpers';
import { useRetirementSettings, RETIREMENT_DEFAULTS } from '../hooks/useRetirementSettings';
import { usePlannerSettings } from '../hooks/usePlannerSettings';

interface Props {
  balances: AccountBalances;
}

interface ProjectionYear {
  age: number;
  retBalance: number;
  taxBalance: number;
  balance: number;
  phase: 'accumulation' | 'distribution' | 'depleted';
}

const PLANNER_DEFAULTS = {
  dayRate: 1200, utilization: 0.55, vacationDays: 10, holidays: 10, sickDays: 5,
  monthlyExpenses: 8750, healthIns: 1600, equityReturn: 0.07, rolloverReturn: 0.04,
  cashReturn: 0.04, inflationRate: 0.03, fullFinancialPicture: true,
  includeBookings: true, includePencils: false, targetUtil: 0.5,
};

export function Retirement({ balances }: Props) {
  const { settings: s, update, reset } = useRetirementSettings();
  const [resetShown, setResetShown] = useState(false);

  const { settings: planner } = usePlannerSettings(PLANNER_DEFAULTS);
  const empMode = planner.employmentMode ?? 'freelance';

  const retirementBalance = balances.tradIRA + balances.rolloverIRA + balances.hsa;
  const includeTaxable = s.includeTaxable;

  // Real returns (nominal - inflation) — all values in today's dollars
  const realPreReturn = s.preReturnRate - s.inflationRate;
  const realRetReturn = s.retReturnRate - s.inflationRate;

  const projection = useMemo(() => {
    const years: ProjectionYear[] = [];
    let retBal = retirementBalance;
    let taxBal = includeTaxable ? balances.brokerage : 0;
    const annualWithdrawal = (s.monthlySpending * 12) - (s.socialSecurity * 12);

    for (let age = s.currentAge; age <= 95; age++) {
      const total = retBal + taxBal;
      if (total <= 0 && age > s.currentAge) {
        years.push({ age, retBalance: 0, taxBalance: 0, balance: 0, phase: 'depleted' });
        continue;
      }

      if (age < s.retirementAge) {
        years.push({ age, retBalance: retBal, taxBalance: taxBal, balance: total, phase: 'accumulation' });
        const annual401k = empMode === 'fulltime'
          ? (planner.ftContribution401k ?? 23500) + (planner.ftSalary ?? 180000) * (planner.ftEmployerMatch ?? 0.04)
          : 0;
        retBal = retBal * (1 + realPreReturn) + s.annualIRAContribution + s.annualHSAContribution + annual401k;
        taxBal = taxBal * (1 + realPreReturn);
      } else {
        years.push({ age, retBalance: retBal, taxBalance: taxBal, balance: total, phase: total > 0 ? 'distribution' : 'depleted' });
        // Grow both pools, then withdraw proportionally
        const retGrown = retBal * (1 + realRetReturn);
        const taxGrown = taxBal * (1 + realRetReturn);
        const totalGrown = retGrown + taxGrown;
        const afterWithdraw = totalGrown - annualWithdrawal;
        if (afterWithdraw <= 0) {
          retBal = 0;
          taxBal = 0;
        } else {
          const ratio = afterWithdraw / totalGrown;
          retBal = retGrown * ratio;
          taxBal = taxGrown * ratio;
        }
      }
    }

    return years;
  }, [retirementBalance, balances.brokerage, includeTaxable, s, realPreReturn, realRetReturn, empMode, planner]);

  const balanceAtRetirement = useMemo(() => {
    return projection.find(y => y.age === s.retirementAge)?.balance ?? 0;
  }, [projection, s.retirementAge]);

  const depletionAge = useMemo(() => {
    const first = projection.find(y => y.phase === 'depleted');
    return first?.age ?? null;
  }, [projection]);

  const yearsUntilRetirement = s.retirementAge - s.currentAge;
  const annualRetirementIncome = (s.monthlySpending * 12);
  const totalBalanceToday = retirementBalance + (includeTaxable ? balances.brokerage : 0);
  const yearsPortfolioLasts = depletionAge !== null
    ? depletionAge - s.retirementAge
    : 95 - s.retirementAge;

  const safeWithdrawalRate = balanceAtRetirement > 0
    ? ((s.monthlySpending * 12) - (s.socialSecurity * 12)) / balanceAtRetirement
    : 0;

  const notIncluded = balances.checking + balances.hys + balances.moneyMarket + balances.ccDebt
    + (includeTaxable ? 0 : balances.brokerage);

  const maxBalance = Math.max(...projection.map(y => y.balance), 1);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Retirement Projections</h1>

      {/* Scenario Inputs */}
      <Panel title="Scenario Inputs">
        <Slider label="Current Age" value={s.currentAge} min={20} max={65} step={1} format={(v) => `${v}`} onChange={(v) => update('currentAge', v)} />
        <Slider label="Retirement Age" value={s.retirementAge} min={Math.max(s.currentAge + 1, 45)} max={75} step={1} format={(v) => `${v}`} onChange={(v) => update('retirementAge', v)} />
        <Slider label="Annual IRA Contribution" value={s.annualIRAContribution} min={0} max={30000} step={500} format={fmt} onChange={(v) => update('annualIRAContribution', v)} />
        <Slider label="Annual HSA Contribution" value={s.annualHSAContribution} min={0} max={10000} step={100} format={fmt} onChange={(v) => update('annualHSAContribution', v)} />
        <Slider label="Pre-Retirement Return" value={s.preReturnRate} min={0} max={0.12} step={0.01} format={(v) => fmtPct(v)} onChange={(v) => update('preReturnRate', v)} />
        <Slider label="Retirement Return" value={s.retReturnRate} min={0} max={0.10} step={0.01} format={(v) => fmtPct(v)} onChange={(v) => update('retReturnRate', v)} />
        <Slider label="Inflation Rate" value={s.inflationRate} min={0} max={0.08} step={0.005} format={(v) => fmtPct(v, 1)} onChange={(v) => update('inflationRate', v)} />
        <p className="text-[11px] text-gray-600 -mt-2 mb-4">Applied to long-term projections only — monthly/annual figures use nominal returns</p>
        <Slider label="Monthly Spending" value={s.monthlySpending} min={3000} max={20000} step={250} format={fmt} onChange={(v) => update('monthlySpending', v)} />
        <Slider label="Monthly Social Security" value={s.socialSecurity} min={0} max={4000} step={100} format={fmt} onChange={(v) => update('socialSecurity', v)} />
      </Panel>

      {/* Taxable investments toggle + Reset */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={includeTaxable}
              onChange={(e) => update('includeTaxable', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-surface-3 rounded-full peer-checked:bg-accent/60 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
          </div>
          <span className="text-sm text-gray-400">Include taxable investments</span>
          {includeTaxable && <span className="text-xs text-gray-600 ml-1">({fmt(balances.brokerage)} brokerage)</span>}
        </label>
        <button
          onClick={async () => {
            await reset();
            setResetShown(true);
            setTimeout(() => setResetShown(false), 1500);
          }}
          className="text-xs text-gray-500 border border-surface-3 rounded px-2 py-1 hover:text-gray-300 hover:border-gray-600 transition-colors"
        >
          {resetShown ? 'Reset \u2713' : 'Reset to defaults'}
        </button>
      </div>
      {includeTaxable && (
        <p className="text-[11px] text-gray-600 -mt-2">Taxable investments included — note that withdrawal tax treatment differs from retirement accounts</p>
      )}

      {/* Summary cards */}
      <Panel title="Summary">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label="Years to Retirement"
            value={`${yearsUntilRetirement}`}
            sub={`Age ${s.retirementAge}`}
          />
          <StatCard
            label="Balance Today"
            value={fmt(totalBalanceToday)}
            color="text-retirement"
            sub={includeTaxable ? `${fmt(retirementBalance)} ret + ${fmt(balances.brokerage)} tax` : undefined}
          />
          <StatCard
            label="Projected at Retirement"
            value={fmt(balanceAtRetirement)}
            color="text-positive"
          />
          <StatCard
            label="Annual Retirement Income"
            value={fmt(annualRetirementIncome)}
            sub={s.socialSecurity > 0 ? `incl. ${fmt(s.socialSecurity * 12)} SS` : undefined}
          />
          <StatCard
            label="Portfolio Lasts"
            value={depletionAge === null ? '30+ years' : `${yearsPortfolioLasts} years`}
            color={depletionAge === null || depletionAge >= 90 ? 'text-positive' : depletionAge >= 80 ? 'text-caution' : 'text-negative'}
            sub={depletionAge !== null ? `Depletes at age ${depletionAge}` : 'Never depletes by 95'}
          />
          <StatCard
            label="Safe Withdrawal Rate"
            value={fmtPct(safeWithdrawalRate, 1)}
            color={safeWithdrawalRate <= 0.04 ? 'text-positive' : safeWithdrawalRate <= 0.06 ? 'text-caution' : 'text-negative'}
            sub={safeWithdrawalRate <= 0.04 ? 'Within 4% rule' : 'Above 4% rule'}
          />
          <StatCard
            label="Not Included"
            value={fmt(notIncluded)}
            color="text-gray-500"
            sub={includeTaxable ? 'HYS, Money Market, Checking' : 'HYS, Money Market, Checking, Brokerage'}
          />
        </div>
      </Panel>

      {/* Projection Chart */}
      <Panel title="Portfolio Projection">
        <div className="flex items-end gap-px h-56 mb-4">
          {projection.map((y) => {
            const totalPct = (y.balance / maxBalance) * 100;
            const retPct = includeTaxable && y.balance > 0 ? (y.retBalance / maxBalance) * 100 : 0;
            const taxPct = includeTaxable && y.balance > 0 ? (y.taxBalance / maxBalance) * 100 : 0;

            if (!includeTaxable) {
              // Single-color bars (original behavior)
              const bgColor = y.phase === 'accumulation'
                ? 'bg-positive'
                : y.phase === 'distribution'
                ? 'bg-retirement'
                : 'bg-negative';
              return (
                <div key={y.age} className="flex-1 flex flex-col justify-end h-full group relative">
                  <div
                    className={`w-full ${bgColor} rounded-t-sm min-h-[1px]`}
                    style={{ height: `${Math.max(totalPct, y.balance > 0 ? 1 : 0)}%` }}
                  />
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface-2 border border-surface-3 rounded px-2 py-1 text-xs whitespace-nowrap z-10 pointer-events-none">
                    <div className="text-white font-mono">Age {y.age}</div>
                    <div className="text-gray-400 font-mono">{fmt(y.balance)}</div>
                  </div>
                </div>
              );
            }

            // Stacked bars: taxable (blue) on top, retirement (purple) below
            return (
              <div key={y.age} className="flex-1 flex flex-col justify-end h-full group relative">
                {y.phase === 'depleted' ? (
                  <div className="w-full bg-negative rounded-t-sm min-h-[1px]" style={{ height: '1%' }} />
                ) : (
                  <>
                    <div className="w-full bg-accent rounded-t-sm" style={{ height: `${taxPct}%` }} />
                    <div className="w-full bg-retirement" style={{ height: `${retPct}%` }} />
                  </>
                )}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface-2 border border-surface-3 rounded px-2 py-1 text-xs whitespace-nowrap z-10 pointer-events-none">
                  <div className="text-white font-mono">Age {y.age}</div>
                  <div className="text-retirement font-mono">{fmt(y.retBalance)}</div>
                  <div className="text-accent font-mono">{fmt(y.taxBalance)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex gap-px mb-3">
          {projection.map((y) => (
            <div key={y.age} className="flex-1 text-center">
              {(y.age === s.currentAge || y.age === s.retirementAge || y.age === 95 || y.age % 10 === 0)
                ? <span className="text-[9px] text-gray-500 font-mono">{y.age}</span>
                : null}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-gray-500">
          {includeTaxable ? (
            <>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-retirement rounded" /> Retirement</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-accent rounded" /> Taxable</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-negative rounded" /> Depleted</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-positive rounded" /> Accumulation</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-retirement rounded" /> Distribution</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-negative rounded" /> Depleted</span>
            </>
          )}
        </div>
      </Panel>

      {/* Key Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-purple-900/30 border border-purple-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Balance at Retirement</div>
          <div className="font-mono text-2xl font-bold text-retirement">{fmt(balanceAtRetirement)}</div>
          <p className="text-xs text-gray-500 mt-1">
            At age {s.retirementAge} with {fmtPct(s.preReturnRate)} annual returns
          </p>
        </div>

        <div className="bg-purple-900/30 border border-purple-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Portfolio Longevity</div>
          <div className={`font-mono text-2xl font-bold ${depletionAge === null ? 'text-positive' : depletionAge >= 85 ? 'text-caution' : 'text-negative'}`}>
            {depletionAge === null ? 'Never depletes' : `Depletes at ${depletionAge}`}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {depletionAge === null
              ? `Sustainable at ${fmt(s.monthlySpending * 12)}/yr spending`
              : `${yearsPortfolioLasts} years of retirement income`}
          </p>
        </div>
      </div>

      {/* Shortfall warning */}
      {depletionAge !== null && depletionAge < 95 && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3">
          <p className="text-sm text-negative font-medium">
            Shortfall Warning — Portfolio depletes at age {depletionAge}, leaving {95 - depletionAge} unfunded years.
            Consider reducing spending, delaying retirement, or increasing contributions.
          </p>
        </div>
      )}

      {/* Sustainable scenario message */}
      {depletionAge === null && (
        <div className={`bg-surface-2 rounded-lg p-4 border-l-4 border-positive`}>
          <p className="text-sm font-medium text-positive">
            Portfolio never depletes — your projected balance at 95 is {fmt(projection[projection.length - 1].balance)} with a {fmtPct(safeWithdrawalRate, 1)} withdrawal rate.
          </p>
        </div>
      )}
    </div>
  );
}
