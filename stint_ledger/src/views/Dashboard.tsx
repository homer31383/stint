import React, { useMemo } from 'react';
import type { StintData, AccountBalances } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { StatusTag } from '../components/StatusTag';
import { PageTitle, Note } from '../components/Ink';
import { fmt, fmtPct, fmtCompact, fmtDateShort, currentYear, weekdaysElapsedYTD, monthName } from '../lib/helpers';

interface Props {
  data: StintData;
  balances: AccountBalances;
  monthlyExpenses: number;
}

export function Dashboard({ data, balances, monthlyExpenses }: Props) {
  const year = currentYear();

  const stats = useMemo(() => {
    const yearEntries = data.timeEntries.filter((e) => e.date.startsWith(String(year)));

    // YTD income
    const ytdIncome = yearEntries.reduce((s, e) => s + e.amount, 0);

    // Unique day-rate dates for utilization
    const dayRateDates = new Set(
      yearEntries.filter((e) => e.service_type === 'day_rate').map((e) => e.date)
    );
    const daysWorked = dayRateDates.size;
    const weekdaysElapsed = weekdaysElapsedYTD(year);
    const utilization = weekdaysElapsed > 0 ? daysWorked / weekdaysElapsed : 0;

    // Outstanding invoices
    const outstanding = data.invoices
      .filter((i) => i.status === 'sent' || i.status === 'overdue')
      .reduce((s, i) => s + i.total, 0);

    // Monthly income breakdown
    const monthlyIncome: number[] = Array(12).fill(0);
    yearEntries.forEach((e) => {
      const m = parseInt(e.date.substring(5, 7), 10) - 1;
      monthlyIncome[m] += e.amount;
    });

    // Upcoming bookings
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = data.pencils
      .filter((p) => p.end_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5);

    // Net worth
    const totalNW =
      balances.checking + balances.hys + balances.moneyMarket +
      balances.brokerage + balances.tradIRA + balances.rolloverIRA +
      balances.hsa + balances.ccDebt;

    // Monthly cash flow estimate
    const avgMonthlyIncome = ytdIncome / Math.max(1, new Date().getMonth() + 1);
    const monthlyFlow = avgMonthlyIncome - monthlyExpenses;

    // Runway
    const liquidAssets = balances.checking + balances.hys + balances.moneyMarket;
    const runway = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

    return {
      ytdIncome,
      daysWorked,
      utilization,
      outstanding,
      monthlyIncome,
      upcoming,
      totalNW,
      monthlyFlow,
      runway,
    };
  }, [data, balances, monthlyExpenses, year]);

  const maxMonthly = Math.max(...stats.monthlyIncome, 1);
  // Reference line: average over the months elapsed so far this year
  const avgMonthly = stats.ytdIncome / (new Date().getMonth() + 1);

  // Margin note, data-driven only: the latest complete month is the year's best
  const currentMonth = new Date().getMonth();
  const lastComplete = currentMonth - 1;
  const bestMonthYet =
    lastComplete >= 0 &&
    stats.monthlyIncome[lastComplete] > 0 &&
    stats.monthlyIncome[lastComplete] === Math.max(...stats.monthlyIncome);

  // Resolve client names for pencils
  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    data.clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [data.clients]);

  const projectMap = useMemo(() => {
    const m = new Map<string, { name: string; client_id: string }>();
    data.projects.forEach((p) => m.set(p.id, { name: p.name, client_id: p.client_id }));
    return m;
  }, [data.projects]);

  const priorityLabels = ['Booked', 'Pencil', 'Pencil 2', 'Pencil 3'];

  return (
    <div className="space-y-5">
      <PageTitle>this year so far...</PageTitle>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="YTD Income" value={fmt(stats.ytdIncome)} color="text-positive" />
        <StatCard label="Days Worked" value={String(stats.daysWorked)} sub={`${fmtPct(stats.utilization)} utilization`} />
        <StatCard label="Outstanding" value={fmt(stats.outstanding)} color="text-caution" />
        <StatCard label="Net Worth" value={fmt(stats.totalNW)} />
      </div>

      {/* Financial health */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Est. Monthly Flow" value={fmt(stats.monthlyFlow)} color={stats.monthlyFlow >= 0 ? 'text-positive' : 'text-negative'} />
        <StatCard label="Runway" value={`${Math.floor(stats.runway)} mo`} sub="Liquid assets ÷ expenses" />
      </div>

      {/* Monthly income chart */}
      <Panel title="Monthly Income (YTD)" tape="fern">
        <div className="relative pt-6">
          {bestMonthYet && (
            <Note
              className="absolute -top-1 pr-1"
              style={{ left: `${(lastComplete / 12) * 100}%`, transform: 'translateX(-100%) rotate(-3deg)' }}
            >
              best month yet →
            </Note>
          )}
          <div className="relative flex items-end gap-1.5 h-24 pr-9">
            {avgMonthly > 0 && (
              <div className="ref-line" style={{ bottom: `${Math.min(100, (avgMonthly / maxMonthly) * 100)}%` }}>
                <span className="ref-tag">avg {fmtCompact(avgMonthly)}</span>
              </div>
            )}
            {stats.monthlyIncome.map((v, i) => {
              const pct = (v / maxMonthly) * 100;
              const isBest = bestMonthYet && i === lastComplete;
              const fill = i === currentMonth ? 'bg-forest' : isBest ? 'bg-fern' : 'bg-[#b8ad92]';
              return (
                <div
                  key={i}
                  className="pbar-col relative flex-1 h-full flex flex-col justify-end"
                  style={{ '--b': i } as React.CSSProperties}
                >
                  {v > 0 && (
                    <>
                      <div className={`pbar ${fill}`} style={{ height: `${pct}%`, minHeight: 2 }} />
                      <span className={`bar-label ${isBest ? 'best' : ''}`} style={{ bottom: `calc(${pct}% + 3px)` }}>
                        {fmtCompact(v)}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-1 pr-9">
            {stats.monthlyIncome.map((_, i) => (
              <span key={i} className="flex-1 text-center text-[10px] font-mono text-ink-dim">{monthName(i).charAt(0)}</span>
            ))}
          </div>
        </div>
      </Panel>

      {/* Upcoming bookings */}
      <Panel title="Upcoming Bookings">
        {stats.upcoming.length === 0 ? (
          <p className="text-sm text-ink-dim">No upcoming bookings</p>
        ) : (
          <div>
            {stats.upcoming.map((p) => {
              const proj = p.project_id ? projectMap.get(p.project_id) : null;
              const clientName = proj ? clientMap.get(proj.client_id) : (p.client_id ? clientMap.get(p.client_id) : null);
              return (
                <div key={p.id} className="ledger-row flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="text-ink">{clientName ?? 'Unknown'}</span>
                    {proj && <span className="text-ink-dim ml-2">· {proj.name}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-dim font-mono text-xs">
                      {fmtDateShort(p.start_date)}–{fmtDateShort(p.end_date)}
                    </span>
                    <StatusTag status={priorityLabels[p.priority] ?? 'pencil'} seed={p.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
