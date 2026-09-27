import React, { useMemo, useState } from 'react';
import type { AccountBalances } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { HandCheck } from '../components/HandCheck';
import { PageTitle } from '../components/Ink';
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
  dayRate: 1384, utilization: 0.55, vacationDays: 10, holidays: 10, sickDays: 5,
  monthlyExpensesFreelance: 7150, monthlyExpensesFullTime: 7150,
  healthIns: 1600, ftHealthIns: 300,
  equityReturn: 0.07, rolloverReturn: 0.07,
  cashReturn: 0.04, inflationRate: 0.03, fullFinancialPicture: true,
  includeBookings: true, includePencils: false, targetUtil: 0.5,
};

// Bars past this index grow together so the 60+ bar chart lands within 600ms.
const BAR_STAGGER_CAP = 12;

export function Retirement({ balances }: Props) {
  const { settings: s, update, reset } = useRetirementSettings();
  const [resetShown, setResetShown] = useState(false);

  const { settings: planner } = usePlannerSettings(PLANNER_DEFAULTS);
  const empMode = planner.employmentMode ?? 'freelance';

  const retirementBalance = balances.tradIRA + balances.rolloverIRA + balances.hsa;
  const includeTaxable = s.includeTaxable;

  // Real returns (nominal - inflation): all values in today's dollars
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

  const tooltipClass = 'absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-paper2 border border-rule rounded px-2 py-1 text-xs whitespace-nowrap z-10 pointer-events-none shadow';

  return (
    <div className="space-y-5">
      <PageTitle>the long view...</PageTitle>

      {/* Scenario Inputs */}
      <Panel title="Scenario Inputs" dense tape="fern">
        <Slider label="Current Age" value={s.currentAge} min={20} max={65} step={1} format={(v) => `${v}`} onChange={(v) => update('currentAge', v)} />
        <Slider label="Retirement Age" value={s.retirementAge} min={Math.max(s.currentAge + 1, 45)} max={75} step={1} format={(v) => `${v}`} onChange={(v) => update('retirementAge', v)} />
        <Slider label="Annual IRA Contribution" value={s.annualIRAContribution} min={0} max={30000} step={500} format={fmt} onChange={(v) => update('annualIRAContribution', v)} tone="income" />
        <Slider label="Annual HSA Contribution" value={s.annualHSAContribution} min={0} max={10000} step={100} format={fmt} onChange={(v) => update('annualHSAContribution', v)} tone="income" />
        <Slider label="Pre-Retirement Return" value={s.preReturnRate} min={0} max={0.12} step={0.01} format={(v) => fmtPct(v)} onChange={(v) => update('preReturnRate', v)} tone="income" />
        <Slider label="Retirement Return" value={s.retReturnRate} min={0} max={0.10} step={0.01} format={(v) => fmtPct(v)} onChange={(v) => update('retReturnRate', v)} tone="income" />
        <Slider label="Inflation Rate" value={s.inflationRate} min={0} max={0.08} step={0.005} format={(v) => fmtPct(v, 1)} onChange={(v) => update('inflationRate', v)} />
        <p className="text-[11px] font-mono text-ink-dim -mt-2 mb-4">Applied to long-term projections only. Monthly/annual figures use nominal returns</p>
        <Slider label="Monthly Spending" value={s.monthlySpending} min={3000} max={20000} step={250} format={fmt} onChange={(v) => update('monthlySpending', v)} tone="expense" />
        <Slider label="Monthly Social Security" value={s.socialSecurity} min={0} max={4000} step={100} format={fmt} onChange={(v) => update('socialSecurity', v)} tone="income" />
      </Panel>

      {/* Taxable investments toggle + Reset */}
      <div className="flex items-center justify-between fj-desk-text">
        <HandCheck
          checked={includeTaxable}
          onChange={(v) => update('includeTaxable', v)}
          label={
            <span className="text-sm">
              Include taxable investments
              {includeTaxable && <span className="text-xs font-mono fj-desk-dim ml-1">({fmt(balances.brokerage)} brokerage)</span>}
            </span>
          }
        />
        <button
          onClick={async () => {
            await reset();
            setResetShown(true);
            setTimeout(() => setResetShown(false), 1500);
          }}
          className="btn-stamp on-desk"
        >
          {resetShown ? 'Reset ✓' : 'Reset to defaults'}
        </button>
      </div>
      {includeTaxable && (
        <p className="text-[11px] font-mono fj-desk-dim -mt-2">Taxable investments included. Note that withdrawal tax treatment differs from retirement accounts</p>
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
            color="text-ink-dim"
            sub={includeTaxable ? 'HYS, Money Market, Checking' : 'HYS, Money Market, Checking, Brokerage'}
          />
        </div>
      </Panel>

      {/* Projection Chart */}
      <Panel title="Portfolio Projection" dense>
        <div className="flex items-end gap-px h-56 mb-4">
          {projection.map((y, bi) => {
            const totalPct = (y.balance / maxBalance) * 100;
            const retPct = includeTaxable && y.balance > 0 ? (y.retBalance / maxBalance) * 100 : 0;
            const taxPct = includeTaxable && y.balance > 0 ? (y.taxBalance / maxBalance) * 100 : 0;
            const barVar = { '--b': Math.min(bi, BAR_STAGGER_CAP) } as React.CSSProperties;

            if (!includeTaxable) {
              // Single-color bars (original behavior)
              const bgColor = y.phase === 'accumulation'
                ? 'bg-fern'
                : y.phase === 'distribution'
                ? 'bg-pencil'
                : 'bg-clay';
              return (
                <div key={y.age} className="pbar-col flex-1 flex flex-col justify-end h-full group relative">
                  <div
                    className={`pbar ${bgColor} min-h-[1px]`}
                    style={{ height: `${Math.max(totalPct, y.balance > 0 ? 1 : 0)}%`, ...barVar }}
                  />
                  <div className={tooltipClass}>
                    <div className="text-ink font-mono">Age {y.age}</div>
                    <div className="text-ink-3 font-mono">{fmt(y.balance)}</div>
                  </div>
                </div>
              );
            }

            // Stacked bars: taxable on top, retirement below
            return (
              <div key={y.age} className="pbar-col flex-1 flex flex-col justify-end h-full group relative">
                {y.phase === 'depleted' ? (
                  <div className="pbar bg-clay min-h-[1px]" style={{ height: '1%', ...barVar }} />
                ) : (
                  <>
                    <div className="pbar pbar-stack bg-inkblue" style={{ height: `${taxPct}%`, ...barVar }} />
                    <div className="pbar pbar-stack bg-umber" style={{ height: `${retPct}%`, ...barVar }} />
                  </>
                )}
                <div className={tooltipClass}>
                  <div className="text-ink font-mono">Age {y.age}</div>
                  <div className="text-umber font-mono">{fmt(y.retBalance)}</div>
                  <div className="text-inkblue font-mono">{fmt(y.taxBalance)}</div>
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
                ? <span className="text-[9px] text-ink-dim font-mono">{y.age}</span>
                : null}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs font-mono text-ink-dim">
          {includeTaxable ? (
            <>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-umber rounded-sm" /> Retirement</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-inkblue rounded-sm" /> Taxable</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-clay rounded-sm" /> Depleted</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-fern rounded-sm" /> Accumulation</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-pencil rounded-sm" /> Distribution</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-clay rounded-sm" /> Depleted</span>
            </>
          )}
        </div>
      </Panel>

      {/* Key Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel variant={2} tape="kraft">
          <div className="scrap-label">Balance at Retirement</div>
          <div className="figure text-2xl text-retirement">{fmt(balanceAtRetirement)}</div>
          <p className="text-xs font-mono text-ink-dim mt-1">
            At age {s.retirementAge} with {fmtPct(s.preReturnRate)} annual returns
          </p>
        </Panel>

        <Panel variant={4}>
          <div className="scrap-label">Portfolio Longevity</div>
          <div className={`figure text-2xl ${depletionAge === null ? 'text-positive' : depletionAge >= 85 ? 'text-caution' : 'text-negative'}`}>
            {depletionAge === null ? 'Never depletes' : `Depletes at ${depletionAge}`}
          </div>
          <p className="text-xs font-mono text-ink-dim mt-1">
            {depletionAge === null
              ? `Sustainable at ${fmt(s.monthlySpending * 12)}/yr spending`
              : `${yearsPortfolioLasts} years of retirement income`}
          </p>
        </Panel>
      </div>

      {/* Shortfall warning */}
      {depletionAge !== null && depletionAge < 95 && (
        <div className="callout callout-bad">
          Shortfall warning: portfolio depletes at age {depletionAge}, leaving {95 - depletionAge} unfunded years.
          Consider reducing spending, delaying retirement, or increasing contributions.
        </div>
      )}

      {/* Sustainable scenario message */}
      {depletionAge === null && (
        <div className="callout callout-good">
          Portfolio never depletes. Your projected balance at 95 is {fmt(projection[projection.length - 1].balance)} with a {fmtPct(safeWithdrawalRate, 1)} withdrawal rate.
        </div>
      )}
    </div>
  );
}
