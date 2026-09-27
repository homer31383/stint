import React, { useState, useCallback } from 'react';
import {
  useReferencePlans, PLAN_SECTIONS, PLAN_STATUS_OPTIONS,
} from '../hooks/useReferencePlans';
import type { PlanCard, PlanSectionId, PlanStatus } from '../hooks/useReferencePlans';
import { HandCheck } from '../components/HandCheck';
import { PageTitle } from '../components/Ink';
import { stampRotation } from '../components/StatusTag';

const STATUS_STAMP: Record<PlanStatus, string> = {
  'Not started': 'stamp-dim',
  'In progress': 'stamp-pencil',
  'Done': 'stamp-forest',
  'Pre-leave item': 'stamp-clay',
};

function StatusPill({ status, seed }: { status: PlanStatus; seed: string }) {
  return (
    <span
      key={status}
      className={`stamp ${STATUS_STAMP[status] ?? 'stamp-dim'}`}
      style={{ '--stamp-rot': `${stampRotation(seed).toFixed(1)}deg` } as React.CSSProperties}
    >
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

// Paper flag pinned at the card's top-right: kraft by default, amber within
// 30 days, clay when past due.
function Deadline({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline);
  const [y, m, d] = deadline.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const tone = days < 0 ? 'flag-clay' : days <= 30 ? 'flag-amber' : '';
  const sub = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'due today' : `${days}d left`;
  return (
    <span className={`flag ${tone}`}>
      {label}
      <span className="opacity-80"> · {sub}</span>
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
  return <div className="text-sm text-ink-2 leading-relaxed space-y-1">{blocks}</div>;
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
    <div className="space-y-5">
      <div>
        <PageTitle>reference plans</PageTitle>
        <p className="text-xs fj-desk-dim mt-1">
          Living reference: review and adjust over time. Everything is editable in place.
        </p>
      </div>

      {PLAN_SECTIONS.map((section, si) => {
        const plans = model.sections[section.id];
        const isCollapsed = collapsed[section.id];
        const variant = ((si % 4) + 1) as 1 | 2 | 3 | 4;
        return (
          <div key={section.id} className={`paper paper-${variant} paper-flat`}>
            {si === 0 && <div className="washi washi-kraft washi-r" />}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-4 md:px-6 py-3 text-left"
            >
              <span className="paper-title border-0 pb-0 flex-none">
                {section.title}
                <span className="ml-2 text-ink-dim font-mono text-xs font-normal">({plans.length})</span>
              </span>
              <span className="text-ink-dim text-xs">{isCollapsed ? '▼' : '▲'}</span>
            </button>

            {!isCollapsed && (
              <div className="px-4 md:px-6 pb-5 space-y-5 pt-1">
                {plans.map((plan, idx) => {
                  const isEditing = editingId === plan.id;
                  const isChecklistSection = section.id === 'checklists';
                  return (
                    <div key={plan.id} className={`relative bg-paper2/70 rounded-sm p-4 ${isChecklistSection && !isEditing && plan.deadline ? 'pt-7' : ''}`} style={{ borderTop: '2px solid rgba(46,42,32,0.55)' }}>
                      {isChecklistSection && !isEditing && plan.deadline && (
                        <Deadline deadline={plan.deadline} />
                      )}
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              value={plan.title}
                              onChange={(e) => updatePlan(section.id, plan.id, { title: e.target.value })}
                              className="w-full px-2 py-1 text-sm font-semibold"
                            />
                          ) : (
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="serif text-base font-semibold text-ink">{plan.title}</h3>
                              {plan.status && <StatusPill status={plan.status} seed={plan.id} />}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isEditing && (
                            <>
                              <button
                                onClick={() => movePlan(section.id, plan.id, -1)}
                                disabled={idx === 0}
                                className="text-xs text-ink-dim hover:text-ink disabled:opacity-30 px-1"
                                title="Move up"
                              >↑</button>
                              <button
                                onClick={() => movePlan(section.id, plan.id, 1)}
                                disabled={idx === plans.length - 1}
                                className="text-xs text-ink-dim hover:text-ink disabled:opacity-30 px-1"
                                title="Move down"
                              >↓</button>
                              <button
                                onClick={() => handleDelete(section.id, plan)}
                                className="btn-link clay px-1"
                                title="Delete plan"
                              >Delete</button>
                            </>
                          )}
                          <button
                            onClick={() => { setEditingId(isEditing ? null : plan.id); setNewItemText(''); }}
                            className={`btn-stamp ${isEditing ? 'active' : ''}`}
                          >
                            {isEditing ? 'Done' : 'Edit'}
                          </button>
                        </div>
                      </div>

                      {/* Edit controls: status + deadline */}
                      {isEditing && (
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <label className="flex items-center gap-1.5 text-xs text-ink-dim">
                            Status
                            <select
                              value={plan.status ?? ''}
                              onChange={(e) => updatePlan(section.id, plan.id, {
                                status: (e.target.value || null) as PlanStatus | null,
                              })}
                              className="px-2 py-1 text-xs"
                            >
                              <option value="">None</option>
                              {PLAN_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </label>
                          {isChecklistSection && (
                            <label className="flex items-center gap-1.5 text-xs text-ink-dim">
                              Deadline
                              <input
                                type="date"
                                value={plan.deadline ?? ''}
                                onChange={(e) => updatePlan(section.id, plan.id, { deadline: e.target.value || null })}
                                className="px-2 py-1 text-xs"
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
                          placeholder='Plan details. Line breaks and "- " bullets are preserved'
                          className="w-full px-3 py-2 text-sm leading-relaxed resize-y font-sans"
                        />
                      ) : (
                        plan.body.trim() !== '' && <PlanBody body={plan.body} />
                      )}

                      {/* Checklist */}
                      {isChecklistSection && plan.checklist && (
                        <div className={`space-y-2 ${plan.body.trim() !== '' || isEditing ? 'mt-3' : ''}`}>
                          {plan.checklist.map(item => (
                            <div key={item.id} className="flex items-start gap-2.5 group">
                              <HandCheck
                                checked={item.done}
                                onChange={(done) => updateChecklistItem(section.id, plan.id, item.id, { done })}
                                className="mt-0.5"
                              />
                              {isEditing ? (
                                <>
                                  <input
                                    value={item.text}
                                    onChange={(e) => updateChecklistItem(section.id, plan.id, item.id, { text: e.target.value })}
                                    className="flex-1 px-2 py-0.5 text-sm font-sans"
                                  />
                                  <button
                                    onClick={() => removeChecklistItem(section.id, plan.id, item.id)}
                                    className="text-sm text-ink-dim hover:text-clay flex-shrink-0"
                                    title="Remove item"
                                  >×</button>
                                </>
                              ) : (
                                <span className={`text-sm leading-snug ${item.done ? 'done-text text-ink-2' : 'text-ink-2'}`}>
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
                                placeholder="New checklist item"
                                className="flex-1 px-2 py-1 text-sm font-sans"
                              />
                              <button
                                type="submit"
                                disabled={!newItemText.trim()}
                                className="btn-stamp fern"
                              >
                                Add
                              </button>
                            </form>
                          )}
                          {!isEditing && plan.checklist.length > 0 && (
                            <div className="text-[10px] text-ink-dim font-mono pt-1">
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
                  className="w-full text-xs font-mono text-ink-dim border border-dashed border-ink-dim/50 rounded py-2 hover:text-ink hover:border-ink transition-colors"
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
