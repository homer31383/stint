import React, { useState, useCallback } from 'react';
import {
  useReferencePlans, PLAN_SECTIONS, PLAN_STATUS_OPTIONS,
} from '../hooks/useReferencePlans';
import type { PlanCard, PlanSectionId, PlanStatus } from '../hooks/useReferencePlans';

const STATUS_COLORS: Record<PlanStatus, string> = {
  'Not started': 'bg-stone-700/60 text-stone-300',
  'In progress': 'bg-amber-900/50 text-amber-400',
  'Done': 'bg-emerald-900/50 text-emerald-400',
  'Pre-leave item': 'bg-amber-900/50 text-amber-300',
};

function StatusPill({ status }: { status: PlanStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${STATUS_COLORS[status] ?? 'bg-stone-700/60 text-stone-300'}`}>
      {status}
    </span>
  );
}

function daysUntil(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = deadline.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function Deadline({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline);
  const [y, m, d] = deadline.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const tone = days < 0
    ? 'text-negative border-negative/40 bg-negative/10'
    : days <= 30
      ? 'text-caution border-caution/40 bg-caution/10'
      : 'text-gray-400 border-surface-3 bg-surface-3/40';
  const sub = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'due today' : `${days}d left`;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono ${tone}`}>
      {label}
      <span className="opacity-75">· {sub}</span>
    </span>
  );
}

// Render body text preserving line breaks, with "- " lines as bullets
function PlanBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: number) => {
    if (bullets.length > 0) {
      blocks.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 space-y-0.5">
          {bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      );
      bullets = [];
    }
  };
  lines.forEach((line, i) => {
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
    } else {
      flush(i);
      if (line.trim() === '') {
        blocks.push(<div key={i} className="h-2" />);
      } else {
        blocks.push(<p key={i}>{line}</p>);
      }
    }
  });
  flush(lines.length);
  return <div className="text-sm text-gray-300 leading-relaxed space-y-1">{blocks}</div>;
}

export function Plans() {
  const {
    model, addPlan, updatePlan, removePlan, movePlan,
    addChecklistItem, updateChecklistItem, removeChecklistItem,
  } = useReferencePlans();

  const [collapsed, setCollapsed] = useState<Record<PlanSectionId, boolean>>({
    monthly: false, annual: false, conditional: false, checklists: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');

  const toggleSection = useCallback((id: PlanSectionId) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleDelete = useCallback((section: PlanSectionId, plan: PlanCard) => {
    if (!confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
    removePlan(section, plan.id);
    setEditingId(prev => prev === plan.id ? null : prev);
  }, [removePlan]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Reference Plans</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Living reference — review and adjust over time. Everything is editable in place.
        </p>
      </div>

      {PLAN_SECTIONS.map(section => {
        const plans = model.sections[section.id];
        const isCollapsed = collapsed[section.id];
        return (
          <div key={section.id} className="bg-surface-1 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-4 md:px-6 py-3 text-left hover:bg-surface-2/50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                {section.title}
                <span className="ml-2 text-gray-600 font-mono normal-case">({plans.length})</span>
              </span>
              <span className="text-gray-600 text-xs">{isCollapsed ? '▼' : '▲'}</span>
            </button>

            {!isCollapsed && (
              <div className="px-4 md:px-6 pb-4 space-y-3">
                {plans.map((plan, idx) => {
                  const isEditing = editingId === plan.id;
                  const isChecklistSection = section.id === 'checklists';
                  return (
                    <div key={plan.id} className="bg-surface-2 rounded-lg p-4">
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              value={plan.title}
                              onChange={(e) => updatePlan(section.id, plan.id, { title: e.target.value })}
                              className="w-full bg-surface-3 border border-surface-3 rounded px-2 py-1 text-sm font-semibold text-white focus:outline-none focus:border-accent"
                            />
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold text-white">{plan.title}</h3>
                              {plan.status && <StatusPill status={plan.status} />}
                            </div>
                          )}
                          {isChecklistSection && !isEditing && plan.deadline && (
                            <div className="mt-1.5">
                              <Deadline deadline={plan.deadline} />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isEditing && (
                            <>
                              <button
                                onClick={() => movePlan(section.id, plan.id, -1)}
                                disabled={idx === 0}
                                className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 px-1"
                                title="Move up"
                              >↑</button>
                              <button
                                onClick={() => movePlan(section.id, plan.id, 1)}
                                disabled={idx === plans.length - 1}
                                className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 px-1"
                                title="Move down"
                              >↓</button>
                              <button
                                onClick={() => handleDelete(section.id, plan)}
                                className="text-xs text-gray-600 hover:text-negative px-1"
                                title="Delete plan"
                              >Delete</button>
                            </>
                          )}
                          <button
                            onClick={() => { setEditingId(isEditing ? null : plan.id); setNewItemText(''); }}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                              isEditing
                                ? 'border-accent text-accent bg-accent/10'
                                : 'border-surface-3 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                            }`}
                          >
                            {isEditing ? 'Done' : 'Edit'}
                          </button>
                        </div>
                      </div>

                      {/* Edit controls: status + deadline */}
                      {isEditing && (
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <label className="flex items-center gap-1.5 text-xs text-gray-500">
                            Status
                            <select
                              value={plan.status ?? ''}
                              onChange={(e) => updatePlan(section.id, plan.id, {
                                status: (e.target.value || null) as PlanStatus | null,
                              })}
                              className="bg-surface-3 text-gray-300 border border-surface-3 rounded px-2 py-1 text-xs focus:outline-none focus:border-accent"
                            >
                              <option value="">None</option>
                              {PLAN_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </label>
                          {isChecklistSection && (
                            <label className="flex items-center gap-1.5 text-xs text-gray-500">
                              Deadline
                              <input
                                type="date"
                                value={plan.deadline ?? ''}
                                onChange={(e) => updatePlan(section.id, plan.id, { deadline: e.target.value || null })}
                                className="bg-surface-3 text-gray-300 border border-surface-3 rounded px-2 py-1 text-xs focus:outline-none focus:border-accent"
                              />
                            </label>
                          )}
                        </div>
                      )}

                      {/* Body */}
                      {isEditing ? (
                        <textarea
                          value={plan.body}
                          onChange={(e) => updatePlan(section.id, plan.id, { body: e.target.value })}
                          rows={Math.max(4, plan.body.split('\n').length + 1)}
                          placeholder="Plan details — line breaks and “- ” bullets are preserved"
                          className="w-full bg-surface-3 border border-surface-3 rounded px-3 py-2 text-sm text-gray-300 leading-relaxed focus:outline-none focus:border-accent resize-y"
                        />
                      ) : (
                        plan.body.trim() !== '' && <PlanBody body={plan.body} />
                      )}

                      {/* Checklist */}
                      {isChecklistSection && plan.checklist && (
                        <div className={`space-y-1.5 ${plan.body.trim() !== '' || isEditing ? 'mt-3' : ''}`}>
                          {plan.checklist.map(item => (
                            <div key={item.id} className="flex items-start gap-2.5 group">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={(e) => updateChecklistItem(section.id, plan.id, item.id, { done: e.target.checked })}
                                className="mt-0.5 accent-accent flex-shrink-0 cursor-pointer"
                              />
                              {isEditing ? (
                                <>
                                  <input
                                    value={item.text}
                                    onChange={(e) => updateChecklistItem(section.id, plan.id, item.id, { text: e.target.value })}
                                    className="flex-1 bg-surface-3 border border-surface-3 rounded px-2 py-0.5 text-sm text-gray-300 focus:outline-none focus:border-accent"
                                  />
                                  <button
                                    onClick={() => removeChecklistItem(section.id, plan.id, item.id)}
                                    className="text-xs text-gray-600 hover:text-negative flex-shrink-0"
                                    title="Remove item"
                                  >×</button>
                                </>
                              ) : (
                                <span className={`text-sm leading-snug ${item.done ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                                  {item.text}
                                </span>
                              )}
                            </div>
                          ))}
                          {isEditing && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!newItemText.trim()) return;
                                addChecklistItem(section.id, plan.id, newItemText.trim());
                                setNewItemText('');
                              }}
                              className="flex items-center gap-2 pt-1"
                            >
                              <input
                                value={newItemText}
                                onChange={(e) => setNewItemText(e.target.value)}
                                placeholder="New checklist item…"
                                className="flex-1 bg-surface-3 border border-surface-3 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-accent"
                              />
                              <button
                                type="submit"
                                disabled={!newItemText.trim()}
                                className="text-xs text-accent border border-accent/40 rounded px-2 py-1 hover:bg-accent/10 transition-colors disabled:opacity-40"
                              >
                                Add
                              </button>
                            </form>
                          )}
                          {!isEditing && plan.checklist.length > 0 && (
                            <div className="text-[10px] text-gray-600 font-mono pt-1">
                              {plan.checklist.filter(i => i.done).length}/{plan.checklist.length} done
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={() => {
                    const id = addPlan(section.id);
                    setEditingId(id);
                    setNewItemText('');
                  }}
                  className="w-full text-xs text-gray-500 border border-dashed border-surface-3 rounded-lg py-2 hover:text-gray-300 hover:border-gray-600 transition-colors"
                >
                  + Add plan
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
