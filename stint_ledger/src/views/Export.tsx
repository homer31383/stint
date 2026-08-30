import React, { useState, useCallback, useMemo } from 'react';
import type { StintData, AccountBalances, DetailedBalances } from '../lib/types';
import { Panel } from '../components/Panel';
import { useExportProfile, DEFAULT_PROFILE_TEXT, DEFAULT_QUESTIONS_TEXT } from '../hooks/useExportProfile';
import { useExpenseModel } from '../hooks/useExpenseModel';
import { usePlannerSettings, type PlannerSettings } from '../hooks/usePlannerSettings';
import { useRetirementSettings } from '../hooks/useRetirementSettings';
import { useSavedScenarios } from '../hooks/useSavedScenarios';
import { buildBriefing } from '../lib/exportMarkdown';
import { currentYear, weekdaysElapsedYTD } from '../lib/helpers';
import { CD_DAY_RATE } from '../lib/rates';

interface Props {
  data: StintData;
  balances: AccountBalances;
  detailed: DetailedBalances;
}

const LS_LAST_EXPORTED = 'export-last-exported';

// Mirrors Planner's computedDefaults so usePlannerSettings can resolve.
function makePlannerDefaults(data: StintData): PlannerSettings {
  const year = currentYear();
  const yearStr = String(year);
  const yearEntries = data.timeEntries.filter((e) => e.date.startsWith(yearStr));
  // Floor at the validated CD day rate — Stint settings may lag the rate card
  const settingsRate = Math.max(data.settings?.service_rates?.day_rate ?? 0, CD_DAY_RATE);
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
    monthlyExpensesFreelance: 7150,
    monthlyExpensesFullTime: 7150,
    healthIns: 1600,
    ftHealthIns: 300,
    equityReturn: 0.07,
    rolloverReturn: 0.07,
    cashReturn: 0.04,
    inflationRate: 0.03,
    fullFinancialPicture: true,
    includeBookings: true,
    includePencils: false,
    targetUtil: 0.5,
  };
}

export function Export({ data, balances, detailed }: Props) {
  const { profile, updateProfileText, updateQuestionsText, reset: resetProfile } = useExportProfile();
  const { model: expenseModel } = useExpenseModel();
  const plannerDefaults = useMemo(() => makePlannerDefaults(data), [data]);
  const { settings: planner } = usePlannerSettings(plannerDefaults);
  const { settings: retirement } = useRetirementSettings();
  const { scenarios } = useSavedScenarios();

  const [generated, setGenerated] = useState<string | null>(null);
  const [lastExported, setLastExported] = useState<string | null>(() => localStorage.getItem(LS_LAST_EXPORTED));
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const generate = useCallback(() => {
    const md = buildBriefing({
      data,
      detailed,
      balances,
      expenseModel,
      planner,
      retirement,
      scenarios,
      profileText: profile.profileText,
      questionsText: profile.questionsText,
    });
    setGenerated(md);
    const now = new Date().toISOString();
    localStorage.setItem(LS_LAST_EXPORTED, now);
    setLastExported(now);
  }, [data, detailed, balances, expenseModel, planner, retirement, scenarios, profile]);

  const download = useCallback(() => {
    const md = generated ?? '';
    if (!md) return;
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-briefing-${today}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generated]);

  const copy = useCallback(async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('[export] Copy failed:', e);
    }
  }, [generated]);

  const lastExportedStr = lastExported
    ? new Date(lastExported).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-white">Export for Analysis</h1>
        {lastExportedStr && (
          <span className="text-xs text-gray-500">Last exported: <span className="font-mono">{lastExportedStr}</span></span>
        )}
      </div>

      <p className="text-sm text-gray-400">
        Generate a comprehensive Markdown briefing of your current finances. Upload the file to Claude for interactive analysis.
        Sections 1 and 11 are editable; everything else is auto-generated from live data each time you click <em>Generate</em>.
      </p>

      {/* Section 1: Profile (editable) */}
      <Panel title="1. Profile (editable)">
        <textarea
          value={profile.profileText}
          onChange={(e) => updateProfileText(e.target.value)}
          rows={10}
          className="w-full bg-surface-3 border border-surface-3 rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-accent resize-y"
        />
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <span className="text-gray-600">Free-form Markdown. This section appears at the top of the briefing.</span>
          <button
            onClick={() => updateProfileText(DEFAULT_PROFILE_TEXT)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            Reset profile to default
          </button>
        </div>
      </Panel>

      {/* Section 11: Questions (editable) */}
      <Panel title="11. Questions & Focus Areas (editable)">
        <textarea
          value={profile.questionsText}
          onChange={(e) => updateQuestionsText(e.target.value)}
          rows={8}
          className="w-full bg-surface-3 border border-surface-3 rounded px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-accent resize-y"
        />
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <span className="text-gray-600">One per line. Edit, add, or remove freely.</span>
          <button
            onClick={() => updateQuestionsText(DEFAULT_QUESTIONS_TEXT)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            Reset questions to default
          </button>
        </div>
      </Panel>

      {/* Actions */}
      <Panel title="Actions">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={generate}
            className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent/80 transition-colors"
          >
            Generate Export
          </button>
          <button
            onClick={download}
            disabled={!generated}
            className="px-3 py-1.5 text-sm rounded bg-surface-2 text-gray-200 hover:bg-surface-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Download .md
          </button>
          <button
            onClick={copy}
            disabled={!generated}
            className="px-3 py-1.5 text-sm rounded bg-surface-2 text-gray-200 hover:bg-surface-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={() => {
              if (showResetConfirm) {
                resetProfile();
                setShowResetConfirm(false);
              } else {
                setShowResetConfirm(true);
                setTimeout(() => setShowResetConfirm(false), 3000);
              }
            }}
            className={`ml-auto text-xs transition-colors ${
              showResetConfirm ? 'text-negative' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Reset both editable sections to defaults"
          >
            {showResetConfirm ? 'Confirm reset?' : 'Reset all editable text'}
          </button>
        </div>
      </Panel>

      {/* Preview */}
      <Panel title={generated ? 'Preview' : 'Preview (click Generate to populate)'}>
        {generated ? (
          <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap break-words max-h-[70vh] overflow-auto bg-surface-3 p-3 rounded">
            {generated}
          </pre>
        ) : (
          <p className="text-xs text-gray-500">No preview yet. Click <em>Generate Export</em> above to assemble the document from your current data.</p>
        )}
      </Panel>
    </div>
  );
}
