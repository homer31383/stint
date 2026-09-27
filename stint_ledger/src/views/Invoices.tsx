import React, { useMemo } from 'react';
import type { StintData } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { StatusTag } from '../components/StatusTag';
import { PageTitle, Note } from '../components/Ink';
import { fmt, fmtDate } from '../lib/helpers';

interface Props {
  data: StintData;
}

// Days an unpaid invoice is past its due date (presentation only, for the margin note)
function daysPastDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
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
    <div className="space-y-5">
      <PageTitle>invoice health</PageTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Outstanding" value={fmt(stats.outstanding)} color="text-caution" />
        <StatCard label="Overdue" value={fmt(stats.overdue)} color="text-negative" />
        <StatCard label="Awaiting Payment" value={fmt(stats.awaiting)} color="text-highlight" />
        <StatCard label="Total Paid" value={fmt(stats.paid)} color="text-positive" />
      </div>

      {/* Summary by status */}
      <Panel title="By Status" tape="clay" tapeSide="right">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {Array.from(stats.byStatus.entries()).map(([status, { count, total }]) => (
            <div key={status} className="flex items-center gap-2 text-sm">
              <StatusTag status={status} seed={`by-${status}`} />
              <span className="text-ink-dim font-mono text-xs">×{count}</span>
              <span className="figure text-sm">{fmt(total)}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Invoice list */}
      <Panel title="All Invoices" dense>
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-dim">No invoices</p>
        ) : (
          <div>
            {sorted.map((inv) => {
              const unpaid = inv.status === 'sent' || inv.status === 'overdue';
              const stale = unpaid && !!inv.due_date && daysPastDue(inv.due_date) >= 10;
              return (
                <div key={inv.id} className="ledger-row flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-ink-dim text-xs">{inv.number ?? '–'}</span>
                      <span className="text-ink truncate">{inv.client_name ?? 'Unknown'}</span>
                      {stale && <Note tone="clay">getting stale...</Note>}
                    </div>
                    <div className="text-xs text-ink-dim font-mono mt-0.5">
                      {inv.issue_date ? fmtDate(inv.issue_date) : '–'}
                      {inv.due_date && <span className="ml-2">Due: {fmtDate(inv.due_date)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span className="figure text-sm">{fmt(inv.total)}</span>
                    <StatusTag status={inv.status} seed={inv.id} />
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
