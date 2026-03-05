import React, { useMemo } from 'react';
import type { StintData } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { Panel } from '../components/Panel';
import { StatusTag } from '../components/StatusTag';
import { fmt, fmtDateShort, weekdaysBetween } from '../lib/helpers';

const PRIORITY_WEIGHTS = [1.0, 0.7, 0.4, 0.2];
const PRIORITY_LABELS = ['booked', 'pencil', 'pencil 2', 'pencil 3'];

interface Props {
  data: StintData;
}

export function Pipeline({ data }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const defaultDayRate = data.settings?.service_rates?.day_rate ?? 1200;

  const clientMap = useMemo(() => {
    const m = new Map<string, { name: string; dayRate: number }>();
    data.clients.forEach((c) => {
      m.set(c.id, {
        name: c.name,
        dayRate: c.service_rates?.day_rate ?? defaultDayRate,
      });
    });
    return m;
  }, [data.clients, defaultDayRate]);

  const projectMap = useMemo(() => {
    const m = new Map<string, { name: string; client_id: string }>();
    data.projects.forEach((p) => m.set(p.id, { name: p.name, client_id: p.client_id }));
    return m;
  }, [data.projects]);

  const enriched = useMemo(() => {
    return data.pencils.map((p) => {
      const proj = p.project_id ? projectMap.get(p.project_id) : null;
      const clientId = proj?.client_id ?? p.client_id ?? '';
      const client = clientMap.get(clientId);
      const days = weekdaysBetween(p.start_date, p.end_date);
      const rate = client?.dayRate ?? defaultDayRate;
      const value = days * rate;
      const weight = PRIORITY_WEIGHTS[p.priority] ?? 0.2;
      return {
        ...p,
        clientName: client?.name ?? 'Unknown',
        projectName: proj?.name ?? null,
        days,
        rate,
        value,
        weightedValue: value * weight,
        label: PRIORITY_LABELS[p.priority] ?? 'pencil 3',
      };
    });
  }, [data.pencils, clientMap, projectMap, defaultDayRate]);

  const future = enriched.filter((p) => p.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = enriched.filter((p) => p.end_date < today).sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 10);

  const booked = future.filter((p) => p.priority === 0);
  const penciled = future.filter((p) => p.priority > 0);

  const bookedDays = booked.reduce((s, p) => s + p.days, 0);
  const penciledDays = penciled.reduce((s, p) => s + p.days, 0);
  const weightedTotal = future.reduce((s, p) => s + p.weightedValue, 0);
  const confirmedRevenue = booked.reduce((s, p) => s + p.value, 0);

  const renderRow = (p: (typeof enriched)[0]) => (
    <div key={p.id} className="flex items-center justify-between py-2 border-b border-surface-3 last:border-0 text-sm">
      <div className="min-w-0 flex-1">
        <div className="text-gray-200 truncate">
          {p.clientName}
          {p.projectName && <span className="text-gray-500"> · {p.projectName}</span>}
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {fmtDateShort(p.start_date)}–{fmtDateShort(p.end_date)} · {p.days}d
        </div>
      </div>
      <div className="flex items-center gap-3 ml-3">
        <span className="font-mono text-gray-300 text-sm">{fmt(p.value)}</span>
        <StatusTag status={p.label} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Pipeline</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Booked Days" value={String(bookedDays)} color="text-positive" />
        <StatCard label="Penciled Days" value={String(penciledDays)} color="text-caution" />
        <StatCard label="Weighted Pipeline" value={fmt(weightedTotal)} />
        <StatCard label="Confirmed Revenue" value={fmt(confirmedRevenue)} color="text-positive" />
      </div>

      {booked.length > 0 && (
        <Panel title="Booked">
          {booked.map(renderRow)}
        </Panel>
      )}

      {penciled.length > 0 && (
        <Panel title="Penciled">
          {penciled.map(renderRow)}
        </Panel>
      )}

      {past.length > 0 && (
        <Panel title="Recent Past">
          {past.map(renderRow)}
        </Panel>
      )}

      {future.length === 0 && past.length === 0 && (
        <Panel>
          <p className="text-gray-500 text-sm">No pipeline data</p>
        </Panel>
      )}
    </div>
  );
}
