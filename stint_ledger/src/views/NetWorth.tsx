import React, { useState, useCallback, useMemo } from 'react';
import type {
  AccountBalances,
  DetailedBalances,
  CustomAccount,
  CustomAccountType,
  SectionKey,
  FixedAccountKey,
  FundHolding,
  HoldingsAccountKey,
} from '../lib/types';
import {
  HOLDINGS_ENABLED_KEYS,
  holdingMarketValue,
  holdingLabel,
  holdingsTotal,
  mutedHoldingsTotal,
  holdingsCostBasisTotal,
  effectiveBalance,
} from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { MiniBar } from '../components/MiniBar';
import { PageTitle } from '../components/Ink';
import { fmt, fmtPct } from '../lib/helpers';
import { fetchPrices } from '../lib/prices';
import { estimateLtcgTax, LTCG_RATE } from '../lib/tax';

const HOLDINGS_KEY_SET = new Set<FixedAccountKey>(HOLDINGS_ENABLED_KEYS);
function isHoldingsKey(key: FixedAccountKey): key is HoldingsAccountKey {
  return HOLDINGS_KEY_SET.has(key);
}

interface Props {
  detailed: DetailedBalances;
  balances: AccountBalances;
  onSave: (d: DetailedBalances) => void;
  monthlyExpenses: number;
}

type FixedDetailedKey = FixedAccountKey;

const ALL_FIXED_KEYS: FixedDetailedKey[] = [
  'advRelationship', 'santanderChecking', 'advantageSavings',
  'citiDoubleCash',
  'highYieldSavings', 'openbankHYS', 'santanderMM',
  'nonRetirement',
  'traditionalIRA', 'rolloverIRA',
  'hsa',
];

interface AccountEntry {
  key: FixedDetailedKey;
  label: string;
  last4?: string;
}

interface AccountGroup {
  title: string;
  color: string;
  sectionKey: SectionKey;
  defaultType: CustomAccountType;
  accounts: AccountEntry[];
  subtotalKeys: FixedDetailedKey[];
}

const ACCOUNT_TYPE_OPTIONS: { value: CustomAccountType; label: string }[] = [
  { value: 'checking', label: 'Cash (no interest)' },
  { value: 'hys', label: 'High-yield savings' },
  { value: 'moneyMarket', label: 'Money market' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'tradIRA', label: 'Retirement' },
  { value: 'rolloverIRA', label: 'Rollover IRA' },
  { value: 'hsa', label: 'HSA' },
  { value: 'ccDebt', label: 'Debt' },
];

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

const GROUPS: AccountGroup[] = [
  {
    title: 'Cash & Checking',
    color: 'bg-fern',
    sectionKey: 'cashChecking',
    defaultType: 'checking',
    accounts: [
      { key: 'advRelationship', label: 'Adv Relationship Banking', last4: '9296' },
      { key: 'santanderChecking', label: 'Santander Private Client Checking' },
      { key: 'advantageSavings', label: 'Advantage Savings', last4: '9322' },
    ],
    subtotalKeys: ['advRelationship', 'santanderChecking', 'advantageSavings'],
  },
  {
    title: 'Credit',
    color: 'bg-clay',
    sectionKey: 'credit',
    defaultType: 'ccDebt',
    accounts: [
      { key: 'citiDoubleCash', label: 'Citi Double Cash Card' },
    ],
    subtotalKeys: ['citiDoubleCash'],
  },
  {
    title: 'Savings',
    color: 'bg-forest',
    sectionKey: 'savings',
    defaultType: 'hys',
    accounts: [
      { key: 'highYieldSavings', label: 'Synchrony HYS' },
      { key: 'openbankHYS', label: 'Openbank High Yield Savings' },
      { key: 'santanderMM', label: 'Santander Private Client Money Market' },
    ],
    subtotalKeys: ['highYieldSavings', 'openbankHYS', 'santanderMM'],
  },
  {
    title: 'Non-retirement',
    color: 'bg-inkblue',
    sectionKey: 'nonRetirement',
    defaultType: 'brokerage',
    accounts: [
      { key: 'nonRetirement', label: 'Non-retirement Brokerage' },
    ],
    subtotalKeys: ['nonRetirement'],
  },
  {
    title: 'Retirement',
    color: 'bg-umber',
    sectionKey: 'retirement',
    defaultType: 'tradIRA',
    accounts: [
      { key: 'traditionalIRA', label: 'Traditional IRA' },
      { key: 'rolloverIRA', label: 'Rollover IRA' },
    ],
    subtotalKeys: ['traditionalIRA', 'rolloverIRA'],
  },
  {
    title: 'Other Investments',
    color: 'bg-pencil',
    sectionKey: 'otherInvestments',
    defaultType: 'hsa',
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

// Allocation segments for the bar: maps aggregated account types to a display segment
const ALLOC_CONFIG: { label: string; color: string; types: CustomAccountType[]; keys: FixedDetailedKey[] }[] = [
  { label: 'Cash & Checking', color: 'bg-fern', types: ['checking'], keys: ['advRelationship', 'santanderChecking', 'advantageSavings'] },
  { label: 'Savings', color: 'bg-forest', types: ['hys', 'moneyMarket'], keys: ['highYieldSavings', 'openbankHYS', 'santanderMM'] },
  { label: 'Brokerage', color: 'bg-inkblue', types: ['brokerage'], keys: ['nonRetirement'] },
  { label: 'Traditional IRA', color: 'bg-umber', types: ['tradIRA'], keys: ['traditionalIRA'] },
  { label: 'Rollover IRA', color: 'bg-brass', types: ['rolloverIRA'], keys: ['rolloverIRA'] },
  { label: 'HSA', color: 'bg-pencil', types: ['hsa'], keys: ['hsa'] },
];

function fixedValue(d: DetailedBalances, k: FixedAccountKey): number {
  if (k === 'nonRetirement' || k === 'traditionalIRA' || k === 'rolloverIRA') {
    return effectiveBalance(d, k);
  }
  return d[k] as number;
}

function sumKeys(d: DetailedBalances, keys: FixedDetailedKey[], muted: Set<string>): number {
  return keys.reduce((s, k) => muted.has(k) ? s : s + fixedValue(d, k), 0);
}

function sumSectionCustom(d: DetailedBalances, section: SectionKey, muted: Set<string>): number {
  return (d.customAccounts ?? [])
    .filter(a => a.section === section && !muted.has(a.id))
    .reduce((s, a) => s + a.balance, 0);
}

function sumAllCustom(d: DetailedBalances, muted: Set<string>): number {
  return (d.customAccounts ?? [])
    .filter(a => !muted.has(a.id))
    .reduce((s, a) => s + a.balance, 0);
}

function sumCustomAssets(d: DetailedBalances, muted: Set<string>): number {
  return (d.customAccounts ?? [])
    .filter(a => !muted.has(a.id))
    .reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0);
}

function sumCustomByTypes(d: DetailedBalances, types: CustomAccountType[], muted: Set<string>): number {
  return (d.customAccounts ?? [])
    .filter(a => types.includes(a.type) && !muted.has(a.id))
    .reduce((s, a) => s + a.balance, 0);
}

interface NewAccountDraft {
  name: string;
  balance: string;
  type: CustomAccountType;
}

export function NetWorth({ detailed, balances, onSave, monthlyExpenses }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Partial<Record<SectionKey, NewAccountDraft>>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rowRefreshing, setRowRefreshing] = useState<Set<string>>(() => new Set());
  const [priceMsg, setPriceMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const muted = useMemo(
    () => new Set<string>(detailed.mutedAccounts ?? []),
    [detailed.mutedAccounts],
  );

  const toggle = (title: string) => setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));

  const update = useCallback((key: FixedDetailedKey, value: number) => {
    onSave({ ...detailed, [key]: value, lastUpdated: Date.now() });
  }, [detailed, onSave]);

  const toggleMute = useCallback((key: string) => {
    const next = new Set(detailed.mutedAccounts ?? []);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSave({ ...detailed, mutedAccounts: Array.from(next), lastUpdated: Date.now() });
  }, [detailed, onSave]);

  const updateCustom = useCallback((id: string, patch: Partial<Omit<CustomAccount, 'id'>>) => {
    const customAccounts = (detailed.customAccounts ?? []).map(a =>
      a.id === id ? { ...a, ...patch } : a,
    );
    onSave({ ...detailed, customAccounts, lastUpdated: Date.now() });
  }, [detailed, onSave]);

  const deleteCustom = useCallback((id: string) => {
    const customAccounts = (detailed.customAccounts ?? []).filter(a => a.id !== id);
    onSave({ ...detailed, customAccounts, lastUpdated: Date.now() });
  }, [detailed, onSave]);

  const updateHolding = useCallback((accountKey: HoldingsAccountKey, id: string, patch: Partial<Omit<FundHolding, 'id'>>) => {
    const holdings = { ...(detailed.holdings ?? {}) };
    const list = holdings[accountKey] ?? [];
    holdings[accountKey] = list.map(h => h.id === id ? { ...h, ...patch } : h);
    onSave({ ...detailed, holdings, lastUpdated: Date.now() });
  }, [detailed, onSave]);

  const addHolding = useCallback((accountKey: HoldingsAccountKey) => {
    const holdings = { ...(detailed.holdings ?? {}) };
    const list = holdings[accountKey] ?? [];
    const newHolding: FundHolding = { id: uuid(), ticker: '', name: '', shares: 0, price: 0, costBasis: 0 };
    holdings[accountKey] = [...list, newHolding];
    onSave({ ...detailed, holdings, lastUpdated: Date.now() });
  }, [detailed, onSave]);

  const removeHolding = useCallback((accountKey: HoldingsAccountKey, id: string) => {
    const holdings = { ...(detailed.holdings ?? {}) };
    const list = holdings[accountKey] ?? [];
    holdings[accountKey] = list.filter(h => h.id !== id);
    onSave({ ...detailed, holdings, lastUpdated: Date.now() });
  }, [detailed, onSave]);

  const refreshPrices = useCallback(async () => {
    if (refreshing) return;

    const tickerSet = new Set<string>();
    for (const key of HOLDINGS_ENABLED_KEYS) {
      for (const h of detailed.holdings?.[key] ?? []) {
        const t = h.ticker.trim().toUpperCase();
        if (t) tickerSet.add(t);
      }
    }
    const tickers = Array.from(tickerSet);
    if (tickers.length === 0) {
      setPriceMsg({ kind: 'warn', text: 'No tickers to refresh.' });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPriceMsg({ kind: 'warn', text: 'You are offline. Showing the last fetched prices.' });
      return;
    }

    setRefreshing(true);
    setPriceMsg(null);
    try {
      const { prices, failed, skipped } = await fetchPrices(tickers);
      if (Object.keys(prices).length === 0) {
        if (failed.length === 0) {
          setPriceMsg({ kind: 'warn', text: `No fetchable tickers (skipped: ${skipped.join(', ')}).` });
        } else {
          setPriceMsg({ kind: 'err', text: 'Could not fetch any prices. Kept previous values.' });
        }
        return;
      }

      const holdings: NonNullable<DetailedBalances['holdings']> = {};
      for (const key of HOLDINGS_ENABLED_KEYS) {
        const list = detailed.holdings?.[key];
        if (!list) continue;
        holdings[key] = list.map(h => {
          const p = prices[h.ticker.trim().toUpperCase()];
          return p != null ? { ...h, price: p } : h;
        });
      }

      const now = Date.now();
      onSave({ ...detailed, holdings, pricesUpdated: now, lastUpdated: now });

      const updated = Object.keys(prices).length;
      const attempted = updated + failed.length;
      if (failed.length > 0) {
        setPriceMsg({ kind: 'warn', text: `Updated ${updated} of ${attempted}. Could not fetch: ${failed.join(', ')}.` });
      } else {
        setPriceMsg({ kind: 'ok', text: `Updated ${updated} price${updated === 1 ? '' : 's'}.` });
      }
    } catch {
      setPriceMsg({ kind: 'err', text: 'Price refresh failed. Kept previous values.' });
    } finally {
      setRefreshing(false);
    }
  }, [detailed, onSave, refreshing]);

  // Refresh a single ticker and update every holding sharing it (a shared
  // ticker left un-updated would show a stale price next to a fresh one).
  const refreshTicker = useCallback(async (rawTicker: string) => {
    const t = rawTicker.trim().toUpperCase();
    if (!t || rowRefreshing.has(t)) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPriceMsg({ kind: 'warn', text: 'You are offline. Showing the last fetched prices.' });
      return;
    }

    setRowRefreshing(prev => new Set(prev).add(t));
    setPriceMsg(null);
    try {
      const { prices, skipped } = await fetchPrices([t]);
      const p = prices[t];
      if (p == null) {
        if (skipped.includes(t)) {
          setPriceMsg({ kind: 'warn', text: `${t} is not a quotable symbol. Skipped.` });
        } else {
          setPriceMsg({ kind: 'err', text: `Could not fetch ${t}. Kept previous value.` });
        }
        return;
      }

      const holdings: NonNullable<DetailedBalances['holdings']> = {};
      for (const key of HOLDINGS_ENABLED_KEYS) {
        const list = detailed.holdings?.[key];
        if (!list) continue;
        holdings[key] = list.map(h => h.ticker.trim().toUpperCase() === t ? { ...h, price: p } : h);
      }

      const now = Date.now();
      onSave({ ...detailed, holdings, pricesUpdated: now, lastUpdated: now });
      setPriceMsg({ kind: 'ok', text: `${t} updated to $${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` });
    } catch {
      setPriceMsg({ kind: 'err', text: `Could not fetch ${t}. Kept previous value.` });
    } finally {
      setRowRefreshing(prev => {
        const next = new Set(prev);
        next.delete(t);
        return next;
      });
    }
  }, [detailed, onSave, rowRefreshing]);

  const startDraft = useCallback((section: SectionKey, defaultType: CustomAccountType) => {
    setDrafts(prev => ({ ...prev, [section]: { name: '', balance: '', type: defaultType } }));
  }, []);

  const updateDraft = useCallback((section: SectionKey, patch: Partial<NewAccountDraft>) => {
    setDrafts(prev => prev[section] ? { ...prev, [section]: { ...prev[section]!, ...patch } } : prev);
  }, []);

  const cancelDraft = useCallback((section: SectionKey) => {
    setDrafts(prev => {
      const { [section]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const commitDraft = useCallback((section: SectionKey) => {
    const draft = drafts[section];
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    const balance = Number(draft.balance);
    if (!Number.isFinite(balance)) return;
    const newAccount: CustomAccount = {
      id: uuid(),
      name,
      balance,
      type: draft.type,
      section,
    };
    const customAccounts = [...(detailed.customAccounts ?? []), newAccount];
    onSave({ ...detailed, customAccounts, lastUpdated: Date.now() });
    cancelDraft(section);
  }, [drafts, detailed, onSave, cancelDraft]);

  const customTotal = sumAllCustom(detailed, muted);
  const customAssets = sumCustomAssets(detailed, muted);
  const customDebt = (detailed.customAccounts ?? [])
    .filter(a => a.type === 'ccDebt' && a.balance < 0 && !muted.has(a.id))
    .reduce((s, a) => s + Math.abs(a.balance), 0);

  const fixedNW = sumKeys(detailed, ALL_FIXED_KEYS, muted);
  const totalNW = fixedNW + customTotal;

  // balances already excludes muted accounts via toAggregateBalances
  const accessibleNW = balances.checking + balances.hys + balances.moneyMarket + balances.brokerage + balances.ccDebt;
  const retirementNW = balances.tradIRA + balances.rolloverIRA + balances.hsa;

  // After-tax accessible: what the accessible pile is worth once the brokerage
  // account's unrealized gains are taxed at the long-term capital gains rate.
  // Only the taxable brokerage account counts; retirement accounts are excluded.
  // Gains and losses across active holdings net against each other, floored at
  // zero for the tax calc. If the whole account is muted, or has no holdings
  // (manual balance only), there is nothing to tax.
  const brokerageHoldings = muted.has('nonRetirement') ? [] : (detailed.holdings?.nonRetirement ?? []);
  const netUnrealizedGains = holdingsTotal(brokerageHoldings) - holdingsCostBasisTotal(brokerageHoldings);
  const estLtcgTax = estimateLtcgTax(netUnrealizedGains);
  const afterTaxAccessible = accessibleNW - estLtcgTax;

  const fixedAssets = ALL_FIXED_KEYS.reduce((s, k) => {
    if (muted.has(k)) return s;
    const v = fixedValue(detailed, k);
    return s + (v > 0 ? v : 0);
  }, 0);
  const totalAssets = fixedAssets + customAssets;

  const fixedDebt = muted.has('citiDoubleCash') || detailed.citiDoubleCash >= 0
    ? 0
    : Math.abs(detailed.citiDoubleCash);
  const totalDebt = fixedDebt + customDebt;
  const debtToAsset = totalAssets > 0 ? totalDebt / totalAssets : 0;

  // Sum of what is currently muted: shown to the user as context
  const mutedTotal = useMemo(() => {
    let sum = 0;
    for (const key of ALL_FIXED_KEYS) {
      if (muted.has(key)) sum += fixedValue(detailed, key);
    }
    for (const acct of detailed.customAccounts ?? []) {
      if (muted.has(acct.id)) sum += acct.balance;
    }
    return sum;
  }, [detailed, muted]);

  const liquidAssets = balances.checking + balances.hys + balances.moneyMarket;
  const runway = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

  const annualExpenses = monthlyExpenses * 12;
  const fiTarget = annualExpenses * 25;
  const fiProgress = fiTarget > 0 ? totalNW / fiTarget : 0;

  const allocationSegments = ALLOC_CONFIG
    .map((a) => {
      const value = sumKeys(detailed, a.keys, muted) + sumCustomByTypes(detailed, a.types, muted);
      return { label: a.label, value, color: a.color, pct: totalAssets > 0 ? value / totalAssets : 0 };
    })
    .filter((a) => a.value > 0);

  const lastUpdatedStr = detailed.lastUpdated
    ? `Balances last updated: ${new Date(detailed.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null;

  const pricesAsOfStr = detailed.pricesUpdated
    ? `Prices as of ${new Date(detailed.pricesUpdated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    : 'Prices not yet fetched';

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <PageTitle>net worth</PageTitle>
        <div className="flex items-center gap-3 text-xs pb-1">
          {muted.size > 0 && (
            <span className="fj-desk-dim">
              Muted: <span className="font-mono fj-desk-text">{fmt(mutedTotal)}</span>
              <span> ({muted.size} acct{muted.size === 1 ? '' : 's'})</span>
            </span>
          )}
          <div className="flex flex-col items-end leading-tight font-mono text-[10px] fj-desk-dim">
            <span>{pricesAsOfStr}</span>
            {lastUpdatedStr && <span>{lastUpdatedStr}</span>}
          </div>
          <button
            onClick={refreshPrices}
            disabled={refreshing}
            className="btn-tag"
            title="Fetch current fund/ETF prices and recalculate values"
          >
            {refreshing ? 'Refreshing' : '↻ Refresh Prices'}
          </button>
        </div>
      </div>
      {priceMsg && (
        <div
          className={`text-xs font-mono ${
            priceMsg.kind === 'ok' ? 'fj-desk-text' : priceMsg.kind === 'warn' ? 'text-kraft' : 'text-clay'
          }`}
        >
          {priceMsg.text}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total Net Worth" value={fmt(totalNW)} color="text-positive" />
        <StatCard label="Accessible" value={fmt(accessibleNW)} />
        <StatCard
          label="After-Tax Accessible"
          value={fmt(afterTaxAccessible)}
          sub={
            estLtcgTax > 0
              ? `−${fmt(estLtcgTax)} est. tax on ${fmt(netUnrealizedGains)} gains (${Math.round(LTCG_RATE * 100)}% LTCG)`
              : netUnrealizedGains < 0
                ? `No tax: ${fmt(Math.abs(netUnrealizedGains))} net unrealized loss`
                : 'No unrealized brokerage gains'
          }
        />
        <StatCard label="Retirement" value={fmt(retirementNW)} color="text-retirement" />
        <StatCard label="Debt-to-Asset" value={fmtPct(debtToAsset, 1)} color={debtToAsset < 0.05 ? 'text-positive' : 'text-caution'} />
      </div>

      {/* Asset allocation bar */}
      <Panel title="Asset Allocation" tape="kraft">
        <div className="alloc">
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
            <span key={seg.label} className="flex items-center gap-1.5 text-xs font-mono text-ink-3">
              <span className={`w-2 h-2 rounded-full ${seg.color}`} />
              {seg.label} {fmtPct(seg.pct, 1)}
            </span>
          ))}
        </div>
      </Panel>

      {/* Account groups */}
      {SECTIONS.map((section) => (
        <Panel key={section.heading} title={section.heading} dense>
          <div className="space-y-5">
            {section.groups.map((gi) => {
              const group = GROUPS[gi];
              const isCollapsed = collapsed[group.title] ?? false;
              const customForSection = (detailed.customAccounts ?? []).filter(a => a.section === group.sectionKey);
              const subtotal = sumKeys(detailed, group.subtotalKeys, muted) + sumSectionCustom(detailed, group.sectionKey, muted);
              const draft = drafts[group.sectionKey];

              return (
                <div key={group.title}>
                  <button
                    onClick={() => toggle(group.title)}
                    className="w-full flex items-center justify-between mb-2 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${group.color}`} />
                      <span className="serif text-sm font-semibold text-ink">{group.title}</span>
                      <span className="text-[10px] text-ink-dim">{isCollapsed ? '▸' : '▾'}</span>
                    </div>
                    <span className="figure text-sm text-ink-3">{fmt(subtotal)}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-2 pl-4 border-l border-dotted border-ink-dim/50 ml-1">
                      {group.accounts.map((acct) => {
                        const isMuted = muted.has(acct.key);
                        const holdingsKey: HoldingsAccountKey | null = isHoldingsKey(acct.key) ? acct.key : null;
                        const holdingsList = holdingsKey ? (detailed.holdings?.[holdingsKey] ?? []) : [];
                        const hasHoldings = holdingsList.length > 0;
                        const computedTotal = hasHoldings ? holdingsTotal(holdingsList) : 0;
                        return (
                          <div key={acct.key}>
                            <div className={`flex items-center gap-2 ${isMuted ? 'opacity-40' : ''}`}>
                              <label className={`text-xs flex-1 min-w-0 truncate ${isMuted ? 'text-ink-dim line-through' : 'text-ink-3'}`}>
                                {acct.label}
                                {acct.last4 && <span className="text-ink-dim font-mono ml-1">- {acct.last4}</span>}
                              </label>
                              {hasHoldings ? (
                                <div
                                  className="relative w-36 flex-shrink-0 px-3 py-1 font-mono text-sm text-ink text-right bg-paper2/80 border border-dotted border-ink-dim/50 rounded"
                                  title="Computed from holdings (shares × price)"
                                >
                                  {fmt(computedTotal)}
                                </div>
                              ) : (
                                <div className="relative w-36 flex-shrink-0">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim font-mono text-sm">$</span>
                                  <input
                                    type="number"
                                    value={detailed[acct.key] as number}
                                    onChange={(e) => update(acct.key, Number(e.target.value))}
                                    className="w-full px-3 py-1 pl-7 text-sm text-right"
                                  />
                                </div>
                              )}
                              <button
                                onClick={() => toggleMute(acct.key)}
                                className={`text-sm w-7 h-7 flex items-center justify-center rounded transition-colors ${isMuted ? 'text-ink-dim hover:text-ink-3' : 'text-ink-3 hover:text-ink'}`}
                                title={isMuted ? 'Unmute account' : 'Mute (exclude from totals)'}
                              >
                                {isMuted ? '◌' : '◉'}
                              </button>
                            </div>
                            {holdingsKey && (
                              <HoldingsEditor
                                accountKey={holdingsKey}
                                holdings={holdingsList}
                                isMuted={isMuted}
                                onUpdate={(id, patch) => updateHolding(holdingsKey, id, patch)}
                                onAdd={() => addHolding(holdingsKey)}
                                onRemove={(id) => removeHolding(holdingsKey, id)}
                                onRefreshTicker={refreshTicker}
                                refreshingTickers={rowRefreshing}
                              />
                            )}
                          </div>
                        );
                      })}
                      {customForSection.map((acct) => {
                        const isMuted = muted.has(acct.id);
                        return (
                          <div key={acct.id} className={`flex items-center gap-2 ${isMuted ? 'opacity-40' : ''}`}>
                            <input
                              type="text"
                              value={acct.name}
                              onChange={(e) => updateCustom(acct.id, { name: e.target.value })}
                              className={`text-xs flex-1 min-w-0 bg-transparent font-sans px-2 py-1 ${isMuted ? 'text-ink-dim line-through' : 'text-ink-2'}`}
                            />
                            <select
                              value={acct.type}
                              onChange={(e) => updateCustom(acct.id, { type: e.target.value as CustomAccountType })}
                              className="text-[10px] px-1 py-0.5 cursor-pointer"
                              title="Account type determines planner mapping"
                            >
                              {ACCOUNT_TYPE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <div className="relative w-36 flex-shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim font-mono text-sm">$</span>
                              <input
                                type="number"
                                value={acct.balance}
                                onChange={(e) => updateCustom(acct.id, { balance: Number(e.target.value) })}
                                className="w-full px-3 py-1 pl-7 text-sm text-right"
                              />
                            </div>
                            <button
                              onClick={() => toggleMute(acct.id)}
                              className={`text-sm w-7 h-7 flex items-center justify-center rounded transition-colors ${isMuted ? 'text-ink-dim hover:text-ink-3' : 'text-ink-3 hover:text-ink'}`}
                              title={isMuted ? 'Unmute account' : 'Mute (exclude from totals)'}
                            >
                              {isMuted ? '◌' : '◉'}
                            </button>
                            <button
                              onClick={() => {
                                if (deleteConfirm === acct.id) {
                                  deleteCustom(acct.id);
                                  setDeleteConfirm(null);
                                } else {
                                  setDeleteConfirm(acct.id);
                                  setTimeout(() => setDeleteConfirm(null), 3000);
                                }
                              }}
                              className={`text-xs w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                deleteConfirm === acct.id ? 'text-clay' : 'text-ink-dim hover:text-clay'
                              }`}
                              title={deleteConfirm === acct.id ? 'Confirm delete' : 'Delete custom account'}
                            >
                              {deleteConfirm === acct.id ? '✓' : '×'}
                            </button>
                          </div>
                        );
                      })}
                      {draft ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Account name"
                            autoFocus
                            value={draft.name}
                            onChange={(e) => updateDraft(group.sectionKey, { name: e.target.value })}
                            className="text-xs flex-1 min-w-0 px-2 py-1 font-sans"
                          />
                          <select
                            value={draft.type}
                            onChange={(e) => updateDraft(group.sectionKey, { type: e.target.value as CustomAccountType })}
                            className="text-[10px] px-1 py-0.5 cursor-pointer"
                          >
                            {ACCOUNT_TYPE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <div className="relative w-32 flex-shrink-0">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim font-mono text-sm">$</span>
                            <input
                              type="number"
                              placeholder="0"
                              value={draft.balance}
                              onChange={(e) => updateDraft(group.sectionKey, { balance: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitDraft(group.sectionKey);
                                if (e.key === 'Escape') cancelDraft(group.sectionKey);
                              }}
                              className="w-full px-3 py-1 pl-7 text-sm text-right"
                            />
                          </div>
                          <button
                            onClick={() => commitDraft(group.sectionKey)}
                            className="btn-stamp fern"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => cancelDraft(group.sectionKey)}
                            className="btn-link"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startDraft(group.sectionKey, group.defaultType)}
                          className="btn-link fern pt-1"
                        >
                          + Add account
                        </button>
                      )}
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
        <Panel title="Liquid Runway" variant={2}>
          <div className="figure text-3xl mb-1">{Math.floor(runway)} months</div>
          <p className="text-xs font-mono text-ink-dim">Liquid assets ({fmt(liquidAssets)}) ÷ monthly expenses ({fmt(monthlyExpenses)})</p>
        </Panel>

        <Panel title="FI Progress" variant={4} tape="fern" tapeSide="right">
          <div className="flex items-center gap-3 mb-2">
            <div className="figure text-3xl">{fmtPct(Math.min(fiProgress, 1), 1)}</div>
            <div className="text-xs font-mono text-ink-dim">of {fmt(fiTarget)} target<br />(25× annual expenses)</div>
          </div>
          <MiniBar value={Math.min(fiProgress, 1)} max={1} color="bg-forest" />
        </Panel>
      </div>
    </div>
  );
}

interface HoldingsEditorProps {
  accountKey: HoldingsAccountKey;
  holdings: FundHolding[];
  isMuted: boolean;
  onUpdate: (id: string, patch: Partial<Omit<FundHolding, 'id'>>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRefreshTicker: (ticker: string) => void;
  refreshingTickers: Set<string>;
}

function fmtSigned(n: number): string {
  const rounded = Math.round(n);
  const formatted = Math.abs(rounded).toLocaleString('en-US');
  if (rounded > 0) return `+$${formatted}`;
  if (rounded < 0) return `−$${formatted}`;
  return `$0`;
}

function HoldingsEditor({ accountKey, holdings, isMuted, onUpdate, onAdd, onRemove, onRefreshTicker, refreshingTickers }: HoldingsEditorProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Row whose display name / ticker fields are expanded for editing
  const [identityEditId, setIdentityEditId] = useState<string | null>(null);

  if (holdings.length === 0) {
    return (
      <div className="pl-2 mt-1 mb-1">
        <button
          onClick={onAdd}
          className="btn-link fern"
        >
          + Add holding
        </button>
      </div>
    );
  }

  const total = holdingsTotal(holdings);
  const cost = holdingsCostBasisTotal(holdings);
  const gl = total - cost;
  const glPct = cost > 0 ? gl / cost : 0;
  const totalGlColor = gl > 0 ? 'text-positive' : gl < 0 ? 'text-negative' : 'text-ink-3';
  const mutedCount = holdings.filter((h) => h.muted).length;
  const mutedValue = mutedHoldingsTotal(holdings);

  return (
    <div className={`mt-2 mb-3 ${isMuted ? 'opacity-40' : ''}`}>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="ledger text-xs min-w-[560px]">
          <thead>
            <tr>
              <th className="text-left pr-2">Holding</th>
              <th className="text-right px-2">Shares</th>
              <th className="text-right px-2">Price</th>
              <th className="text-right px-2">Mkt Val</th>
              <th className="text-right px-2">Cost Basis</th>
              <th className="text-right px-2">G/L</th>
              <th className="text-right px-2">G/L %</th>
              <th className="pl-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const mv = holdingMarketValue(h);
              const hgl = mv - h.costBasis;
              const hpct = h.costBasis > 0 ? hgl / h.costBasis : 0;
              const glColor = hgl > 0 ? 'text-positive' : hgl < 0 ? 'text-negative' : 'text-ink-3';
              const isConfirm = confirmId === h.id;
              const rowMuted = h.muted === true;
              const rowRefreshBusy = refreshingTickers.has(h.ticker.trim().toUpperCase());
              return (
                <tr key={h.id} className={rowMuted ? 'opacity-40' : ''}>
                  <td className="py-1 pr-2 align-top">
                    {identityEditId === h.id ? (
                      <div className="space-y-1">
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-ink-dim px-1.5">Display name</div>
                          <input
                            type="text"
                            value={h.displayName ?? ''}
                            onChange={(e) => onUpdate(h.id, { displayName: e.target.value })}
                            placeholder="(optional)"
                            autoFocus
                            className="w-28 px-1.5 py-0.5"
                          />
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wide text-ink-dim px-1.5">Ticker (for pricing)</div>
                          <input
                            type="text"
                            value={h.ticker}
                            onChange={(e) => onUpdate(h.id, { ticker: e.target.value.toUpperCase() })}
                            placeholder="TICKER"
                            className="w-28 px-1.5 py-0.5 uppercase"
                          />
                        </div>
                        <button
                          onClick={() => setIdentityEditId(null)}
                          className="btn-link fern px-1.5"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIdentityEditId(h.id)}
                        title={h.displayName?.trim()
                          ? `Prices from ${h.ticker || 'none'}. Click to edit name/ticker`
                          : 'Click to edit name/ticker'}
                        className={`w-20 text-left bg-transparent border border-transparent hover:border-rule rounded px-1.5 py-0.5 truncate ${h.displayName?.trim() ? '' : 'uppercase'} ${holdingLabel(h) ? 'text-ink' : 'text-ink-dim'}`}
                      >
                        {holdingLabel(h) || 'TICKER'}
                      </button>
                    )}
                    <input
                      type="text"
                      value={h.name}
                      onChange={(e) => onUpdate(h.id, { name: e.target.value })}
                      placeholder="Fund name"
                      className="block w-full mt-0.5 bg-transparent px-1.5 py-0.5 text-[10px] text-ink-dim"
                    />
                  </td>
                  <td className="py-1 px-2 align-top">
                    <input
                      type="number"
                      step="0.001"
                      value={h.shares}
                      onChange={(e) => onUpdate(h.id, { shares: Number(e.target.value) })}
                      className="w-24 bg-transparent px-1.5 py-0.5 text-ink text-right"
                    />
                  </td>
                  <td className="py-1 px-2 align-top">
                    <div className="relative">
                      <span className="absolute left-1.5 top-0.5 text-ink-dim">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={h.price}
                        onChange={(e) => onUpdate(h.id, { price: Number(e.target.value) })}
                        className="w-24 bg-transparent pl-4 pr-1.5 py-0.5 text-ink text-right"
                      />
                    </div>
                  </td>
                  <td className="py-1 px-2 align-top text-right text-ink">{fmt(mv)}</td>
                  <td className="py-1 px-2 align-top">
                    <div className="relative">
                      <span className="absolute left-1.5 top-0.5 text-ink-dim">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={h.costBasis}
                        onChange={(e) => onUpdate(h.id, { costBasis: Number(e.target.value) })}
                        className="w-28 bg-transparent pl-4 pr-1.5 py-0.5 text-ink-2 text-right"
                      />
                    </div>
                  </td>
                  <td className={`py-1 px-2 align-top text-right ${glColor}`}>{fmtSigned(hgl)}</td>
                  <td className={`py-1 px-2 align-top text-right ${glColor}`}>
                    {hgl >= 0 ? '+' : '−'}{fmtPct(Math.abs(hpct), 1)}
                  </td>
                  <td className="py-1 pl-2 align-top">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => onRefreshTicker(h.ticker)}
                        disabled={rowRefreshBusy || !h.ticker.trim()}
                        className="w-5 h-5 flex items-center justify-center rounded transition-colors text-ink-dim hover:text-fern disabled:hover:text-ink-dim disabled:opacity-50"
                        title={h.ticker.trim() ? `Refresh ${h.ticker.trim().toUpperCase()} price` : 'Set a ticker to fetch a price'}
                      >
                        <span className={rowRefreshBusy ? 'inline-block animate-spin' : ''}>↻</span>
                      </button>
                      <button
                        onClick={() => onUpdate(h.id, { muted: !rowMuted })}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${rowMuted ? 'text-ink-dim hover:text-ink-3' : 'text-ink-3 hover:text-ink'}`}
                        title={rowMuted ? 'Unmute holding' : 'Mute (exclude from totals)'}
                      >
                        {rowMuted ? '◌' : '◉'}
                      </button>
                      <button
                        onClick={() => {
                          if (isConfirm) {
                            onRemove(h.id);
                            setConfirmId(null);
                          } else {
                            setConfirmId(h.id);
                            setTimeout(() => setConfirmId((prev) => (prev === h.id ? null : prev)), 3000);
                          }
                        }}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${isConfirm ? 'text-clay' : 'text-ink-dim hover:text-clay'}`}
                        title={isConfirm ? 'Confirm delete' : 'Delete holding'}
                      >
                        {isConfirm ? '✓' : '×'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-[11px]">
              <td className="pr-2 text-ink-dim">Total</td>
              <td />
              <td />
              <td className="py-1.5 px-2 text-right text-ink">{fmt(total)}</td>
              <td className="py-1.5 px-2 text-right text-ink-3">{fmt(cost)}</td>
              <td className={`py-1.5 px-2 text-right ${totalGlColor}`}>{fmtSigned(gl)}</td>
              <td className={`py-1.5 px-2 text-right ${totalGlColor}`}>
                {gl >= 0 ? '+' : '−'}{fmtPct(Math.abs(glPct), 1)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="pl-2 mt-1 flex items-center justify-between gap-2">
        <button
          onClick={onAdd}
          className="btn-link fern"
        >
          + Add holding
        </button>
        {mutedCount > 0 && (
          <span className="text-[11px] font-mono text-ink-dim">
            Muted: <span className="text-ink-3">{fmt(mutedValue)}</span>
            {' '}({mutedCount} holding{mutedCount === 1 ? '' : 's'})
          </span>
        )}
      </div>
    </div>
  );
}
