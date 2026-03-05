import React, { useState, useCallback } from 'react';
import type { AccountBalances, DetailedBalances } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { MiniBar } from '../components/MiniBar';
import { fmt, fmtPct } from '../lib/helpers';

interface Props {
  detailed: DetailedBalances;
  balances: AccountBalances;
  onSave: (d: DetailedBalances) => void;
  monthlyExpenses: number;
}

type DetailedKey = keyof Omit<DetailedBalances, 'lastUpdated'>;

interface AccountEntry {
  key: DetailedKey;
  label: string;
  last4?: string;
}

interface AccountGroup {
  title: string;
  color: string;
  accounts: AccountEntry[];
  subtotalKeys: DetailedKey[];
}

const GROUPS: AccountGroup[] = [
  {
    title: 'Cash & Checking',
    color: 'bg-accent',
    accounts: [
      { key: 'advRelationship', label: 'Adv Relationship Banking', last4: '9296' },
      { key: 'santanderChecking', label: 'Santander Private Client Checking' },
      { key: 'advantageSavings', label: 'Advantage Savings', last4: '9322' },
    ],
    subtotalKeys: ['advRelationship', 'santanderChecking', 'advantageSavings'],
  },
  {
    title: 'Credit',
    color: 'bg-negative',
    accounts: [
      { key: 'citiDoubleCash', label: 'Citi Double Cash Card' },
    ],
    subtotalKeys: ['citiDoubleCash'],
  },
  {
    title: 'Savings',
    color: 'bg-positive',
    accounts: [
      { key: 'highYieldSavings', label: 'High Yield Savings' },
      { key: 'openbankHYS', label: 'Openbank High Yield Savings' },
      { key: 'santanderMM', label: 'Santander Private Client Money Market' },
    ],
    subtotalKeys: ['highYieldSavings', 'openbankHYS', 'santanderMM'],
  },
  {
    title: 'Non-retirement',
    color: 'bg-blue-400',
    accounts: [
      { key: 'nonRetirement', label: 'Non-retirement Brokerage' },
    ],
    subtotalKeys: ['nonRetirement'],
  },
  {
    title: 'Retirement',
    color: 'bg-retirement',
    accounts: [
      { key: 'traditionalIRA', label: 'Traditional IRA' },
      { key: 'rolloverIRA', label: 'Rollover IRA' },
    ],
    subtotalKeys: ['traditionalIRA', 'rolloverIRA'],
  },
  {
    title: 'Other Investments',
    color: 'bg-indigo-400',
    accounts: [
      { key: 'hsa', label: 'Health Savings Account' },
    ],
    subtotalKeys: ['hsa'],
  },
];

const SECTIONS: { heading: string; groups: number[] }[] = [
  { heading: 'Banking', groups: [0, 1, 2] },
  { heading: 'Investments', groups: [3, 4, 5] },
];

// Allocation segments for the bar
const ALLOC_CONFIG: { label: string; color: string; keys: DetailedKey[] }[] = [
  { label: 'Cash & Checking', color: 'bg-accent', keys: ['advRelationship', 'santanderChecking', 'advantageSavings'] },
  { label: 'Savings', color: 'bg-positive', keys: ['highYieldSavings', 'openbankHYS', 'santanderMM'] },
  { label: 'Brokerage', color: 'bg-blue-400', keys: ['nonRetirement'] },
  { label: 'Traditional IRA', color: 'bg-retirement', keys: ['traditionalIRA'] },
  { label: 'Rollover IRA', color: 'bg-purple-400', keys: ['rolloverIRA'] },
  { label: 'HSA', color: 'bg-indigo-400', keys: ['hsa'] },
];

function sumKeys(d: DetailedBalances, keys: DetailedKey[]): number {
  return keys.reduce((s, k) => s + (d[k] as number), 0);
}

export function NetWorth({ detailed, balances, onSave, monthlyExpenses }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (title: string) => setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));

  const update = useCallback((key: DetailedKey, value: number) => {
    onSave({ ...detailed, [key]: value, lastUpdated: Date.now() });
  }, [detailed, onSave]);

  const totalNW = Object.entries(detailed).reduce((s, [k, v]) => k === 'lastUpdated' ? s : s + (v as number), 0);
  const accessibleNW = balances.checking + balances.hys + balances.moneyMarket + balances.brokerage + balances.ccDebt;
  const retirementNW = balances.tradIRA + balances.rolloverIRA + balances.hsa;
  const totalAssets = Object.entries(detailed).reduce((s, [k, v]) => k === 'lastUpdated' ? s : s + (typeof v === 'number' && v > 0 ? v : 0), 0);
  const totalDebt = Math.abs(detailed.citiDoubleCash < 0 ? detailed.citiDoubleCash : 0);
  const debtToAsset = totalAssets > 0 ? totalDebt / totalAssets : 0;

  const liquidAssets = balances.checking + balances.hys + balances.moneyMarket;
  const runway = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

  const annualExpenses = monthlyExpenses * 12;
  const fiTarget = annualExpenses * 25;
  const fiProgress = fiTarget > 0 ? totalNW / fiTarget : 0;

  const allocationSegments = ALLOC_CONFIG
    .map((a) => {
      const value = sumKeys(detailed, a.keys);
      return { label: a.label, value, color: a.color, pct: totalAssets > 0 ? value / totalAssets : 0 };
    })
    .filter((a) => a.value > 0);

  const lastUpdatedStr = detailed.lastUpdated
    ? `Balances last updated: ${new Date(detailed.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Net Worth Tracker</h1>
        {lastUpdatedStr && <span className="text-xs text-gray-600">{lastUpdatedStr}</span>}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Net Worth" value={fmt(totalNW)} color="text-positive" />
        <StatCard label="Accessible" value={fmt(accessibleNW)} />
        <StatCard label="Retirement" value={fmt(retirementNW)} color="text-retirement" />
        <StatCard label="Debt-to-Asset" value={fmtPct(debtToAsset, 1)} color={debtToAsset < 0.05 ? 'text-positive' : 'text-caution'} />
      </div>

      {/* Asset allocation bar */}
      <Panel title="Asset Allocation">
        <div className="h-6 rounded-full overflow-hidden flex">
          {allocationSegments.map((seg) => (
            <div
              key={seg.label}
              className={`${seg.color} h-full`}
              style={{ width: `${seg.pct * 100}%` }}
              title={`${seg.label}: ${fmtPct(seg.pct, 1)}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {allocationSegments.map((seg) => (
            <span key={seg.label} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className={`w-2 h-2 rounded-full ${seg.color}`} />
              {seg.label} {fmtPct(seg.pct, 1)}
            </span>
          ))}
        </div>
      </Panel>

      {/* Account groups */}
      {SECTIONS.map((section) => (
        <Panel key={section.heading} title={section.heading}>
          <div className="space-y-5">
            {section.groups.map((gi) => {
              const group = GROUPS[gi];
              const isCollapsed = collapsed[group.title] ?? false;
              const subtotal = sumKeys(detailed, group.subtotalKeys);

              return (
                <div key={group.title}>
                  <button
                    onClick={() => toggle(group.title)}
                    className="w-full flex items-center justify-between mb-2 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${group.color}`} />
                      <span className="text-sm font-medium text-gray-300">{group.title}</span>
                      <span className="text-[10px] text-gray-600">{isCollapsed ? '▸' : '▾'}</span>
                    </div>
                    <span className="font-mono text-sm text-gray-400">{fmt(subtotal)}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-2 pl-4 border-l border-surface-3 ml-1">
                      {group.accounts.map((acct) => (
                        <div key={acct.key} className="flex items-center gap-3">
                          <label className="text-xs text-gray-500 flex-1 min-w-0 truncate">
                            {acct.label}
                            {acct.last4 && <span className="text-gray-600 ml-1">- {acct.last4}</span>}
                          </label>
                          <div className="relative w-36 flex-shrink-0">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
                            <input
                              type="number"
                              value={detailed[acct.key] as number}
                              onChange={(e) => update(acct.key, Number(e.target.value))}
                              className="w-full bg-surface-3 border border-surface-3 rounded px-3 py-1 pl-7 font-mono text-sm text-gray-200 focus:outline-none focus:border-accent text-right"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}

      {/* Runway & FI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Liquid Runway">
          <div className="text-3xl font-mono font-bold text-white mb-1">{Math.floor(runway)} months</div>
          <p className="text-xs text-gray-500">Liquid assets ({fmt(liquidAssets)}) ÷ monthly expenses ({fmt(monthlyExpenses)})</p>
        </Panel>

        <Panel title="FI Progress">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl font-mono font-bold text-white">{fmtPct(Math.min(fiProgress, 1), 1)}</div>
            <div className="text-xs text-gray-500">of {fmt(fiTarget)} target<br />(25× annual expenses)</div>
          </div>
          <MiniBar value={Math.min(fiProgress, 1)} max={1} color="bg-positive" />
        </Panel>
      </div>
    </div>
  );
}
