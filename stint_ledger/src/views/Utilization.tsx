import React, { useMemo, useState } from 'react';
import type { StintData } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { MiniBar } from '../components/MiniBar';
import { PageTitle } from '../components/Ink';
import { fmt, fmtPct, currentYear, weekdaysElapsedYTD, monthName } from '../lib/helpers';

interface Props {
  data: StintData;
}

export function Utilization({ data }: Props) {
  const thisYear = currentYear();
  const [year, setYear] = useState(thisYear);

  const stats = useMemo(() => {
    const yearStr = String(year);
    const entries = data.timeEntries.filter((e) => e.date.startsWith(yearStr));

    const totalIncome = entries.reduce((s, e) => s + e.amount, 0);
    const dayRateDates = new Set(entries.filter((e) => e.service_type === 'day_rate').map((e) => e.date));
    const daysWorked = dayRateDates.size;
    const weekdays = year === thisYear ? weekdaysElapsedYTD(year) : 260;
    const utilization = weekdays > 0 ? daysWorked / weekdays : 0;
    const avgRate = daysWorked > 0 ? entries.filter((e) => e.service_type === 'day_rate').reduce((s, e) => s + e.amount, 0) / daysWorked : 0;

    // Monthly breakdown
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const mStr = String(m + 1).padStart(2, '0');
      const mEntries = entries.filter((e) => e.date.substring(5, 7) === mStr);
      const income = mEntries.reduce((s, e) => s + e.amount, 0);
      const mDayDates = new Set(mEntries.filter((e) => e.service_type === 'day_rate').map((e) => e.date));
      const days = mDayDates.size;
      const weekdaysInMonth = 22; // approximation
      const util = days / weekdaysInMonth;
      return { month: m, income, days, utilization: util };
    });

    // By client
    const projectClientMap = new Map<string, string>();
    data.projects.forEach((p) => projectClientMap.set(p.id, p.client_id));
    const clientNameMap = new Map<string, string>();
    data.clients.forEach((c) => clientNameMap.set(c.id, c.name));

    const byClientMap = new Map<string, { days: number; income: number }>();
    entries.forEach((e) => {
      const clientId = projectClientMap.get(e.project_id) ?? 'unknown';
      const cur = byClientMap.get(clientId) ?? { days: 0, income: 0 };
      cur.income += e.amount;
      if (e.service_type === 'day_rate') cur.days++;
      byClientMap.set(clientId, cur);
    });
    const byClient = Array.from(byClientMap.entries())
      .map(([id, v]) => ({ name: clientNameMap.get(id) ?? 'Unknown', ...v }))
      .sort((a, b) => b.income - a.income);

    // By service type
    const byServiceMap = new Map<string, { count: number; income: number }>();
    entries.forEach((e) => {
      const cur = byServiceMap.get(e.service_type) ?? { count: 0, income: 0 };
      cur.count++;
      cur.income += e.amount;
      byServiceMap.set(e.service_type, cur);
    });
    const byService = Array.from(byServiceMap.entries())
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.income - a.income);

    return { totalIncome, daysWorked, utilization, avgRate, monthly, byClient, byService };
  }, [data, year, thisYear]);

  const maxMonthlyIncome = Math.max(...stats.monthly.map((m) => m.income), 1);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <PageTitle>utilization & income</PageTitle>
        <div className="flex gap-2 pb-1">
          {[thisYear, thisYear - 1].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`btn-stamp on-desk ${year === y ? 'active' : ''}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Income" value={fmt(stats.totalIncome)} color="text-positive" />
        <StatCard label="Utilization" value={fmtPct(stats.utilization)} />
        <StatCard label="Days Worked" value={String(stats.daysWorked)} />
        <StatCard label="Avg Day Rate" value={fmt(stats.avgRate)} />
      </div>

      {/* Monthly breakdown */}
      <Panel title="Monthly Breakdown" dense tape="kraft" tapeSide="right">
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th className="text-left">Month</th>
                <th className="text-right">Income</th>
                <th className="text-right">Days</th>
                <th className="text-right">Util%</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {stats.monthly.filter((m) => m.income > 0 || m.days > 0).map((m) => (
                <tr key={m.month}>
                  <td className="text-ink-2 font-sans">{monthName(m.month)}</td>
                  <td className="text-right text-ink">{fmt(m.income)}</td>
                  <td className="text-right text-ink-3">{m.days}</td>
                  <td className="text-right text-ink-3">{fmtPct(m.utilization)}</td>
                  <td className="pl-3">
                    <MiniBar value={m.income} max={maxMonthlyIncome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* By client */}
      <Panel title="By Client">
        <div>
          {stats.byClient.map((c) => (
            <div key={c.name} className="ledger-row flex items-center justify-between py-2 text-sm">
              <span className="text-ink-2">{c.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-ink-dim font-mono text-xs">{c.days}d</span>
                <span className="font-mono text-ink w-24 text-right">{fmt(c.income)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* By service type */}
      <Panel title="By Service Type">
        <div>
          {stats.byService.map((s) => (
            <div key={s.type} className="ledger-row flex items-center justify-between py-2 text-sm">
              <span className="text-ink-2 capitalize">{s.type.replace('_', ' ')}</span>
              <div className="flex items-center gap-4">
                <span className="text-ink-dim font-mono text-xs">×{s.count}</span>
                <span className="font-mono text-ink w-24 text-right">{fmt(s.income)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
