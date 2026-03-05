import React, { useMemo } from 'react';
import type { StintData } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { StatusTag } from '../components/StatusTag';
import { fmt, fmtDate } from '../lib/helpers';

interface Props {
  data: StintData;
}

export function Invoices({ data }: Props) {
  const stats = useMemo(() => {
    const outstanding = data.invoices
      .filter((i) => i.status === 'sent' || i.status === 'overdue')
      .reduce((s, i) => s + i.total, 0);
    const overdue = data.invoices
      .filter((i) => i.status === 'overdue')
      .reduce((s, i) => s + i.total, 0);
    const awaiting = data.invoices
      .filter((i) => i.status === 'sent')
      .reduce((s, i) => s + i.total, 0);
    const paid = data.invoices
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + i.total, 0);

    const byStatus = new Map<string, { count: number; total: number }>();
    data.invoices.forEach((i) => {
      const cur = byStatus.get(i.status) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += i.total;
      byStatus.set(i.status, cur);
    });

    return { outstanding, overdue, awaiting, paid, byStatus };
  }, [data.invoices]);

  const sorted = useMemo(
    () => [...data.invoices].sort((a, b) => (b.issue_date ?? '').localeCompare(a.issue_date ?? '')),
    [data.invoices]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Invoice Health</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Outstanding" value={fmt(stats.outstanding)} color="text-caution" />
        <StatCard label="Overdue" value={fmt(stats.overdue)} color="text-negative" />
        <StatCard label="Awaiting Payment" value={fmt(stats.awaiting)} color="text-accent" />
        <StatCard label="Total Paid" value={fmt(stats.paid)} color="text-positive" />
      </div>

      {/* Summary by status */}
      <Panel title="By Status">
        <div className="flex flex-wrap gap-4">
          {Array.from(stats.byStatus.entries()).map(([status, { count, total }]) => (
            <div key={status} className="flex items-center gap-2 text-sm">
              <StatusTag status={status} />
              <span className="text-gray-400">{count}</span>
              <span className="font-mono text-gray-300">{fmt(total)}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Invoice list */}
      <Panel title="All Invoices">
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-500">No invoices</p>
        ) : (
          <div className="space-y-0">
            {sorted.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 border-b border-surface-3 last:border-0 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-200 text-xs">{inv.number ?? '—'}</span>
                    <span className="text-gray-300 truncate">{inv.client_name ?? 'Unknown'}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {inv.issue_date ? fmtDate(inv.issue_date) : '—'}
                    {inv.due_date && <span className="ml-2">Due: {fmtDate(inv.due_date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="font-mono text-gray-200">{fmt(inv.total)}</span>
                  <StatusTag status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
