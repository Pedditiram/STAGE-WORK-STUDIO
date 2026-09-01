import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Download, Plus, Trash2, RefreshCw, Maximize2, Minimize2, Archive
} from 'lucide-react';
import HoverPinBar from './HoverPinBar';
import { IconBudget } from './StudioIcons';
import { exportDownloadText, assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import {
  BUDGET_STATUSES,
  BUDGET_GROUPS,
  budgetToCsv,
  budgetToMarkdown,
  budgetToPrintHtml,
  buildBudgetZipFiles,
  emptyBudget,
  formatMoney,
  loadBudget,
  parseAmount,
  rollupByGroup,
  saveBudget,
  sumBudget
} from '../utils/budgetConsole';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { isLookOnlySession } from '../utils/projectPermissions';

const fieldClass =
  'w-full rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[11px] text-[var(--sps-text)] px-2 py-1.5 focus:outline-none focus:border-[var(--sps-gold)]';

export default function BudgetConsoleModal({
  isOpen,
  onClose,
  asRoom = false,
  projectTitle = 'Untitled Feature',
  shots = [],
  lookOnly = false
}) {
  const [budget, setBudget] = useState(() => emptyBudget(projectTitle));
  const [audience, setAudience] = useState('producer');
  const [fullscreen, setFullscreen] = useState(false);
  const [groupId, setGroupId] = useState('all');
  const readyRef = useRef(false);
  const readOnly = lookOnly || isLookOnlySession();

  useEffect(() => {
    if (!isOpen) {
      readyRef.current = false;
      return;
    }
    const loaded = loadBudget(projectTitle);
    setBudget(loaded);
    setAudience(loaded.audience || 'producer');
    readyRef.current = true;
  }, [isOpen, projectTitle]);

  useEffect(() => {
    if (!isOpen || readOnly || !readyRef.current) return undefined;
    const t = window.setTimeout(() => {
      saveBudget(projectTitle, { ...budget, audience });
    }, 400);
    return () => window.clearTimeout(t);
  }, [budget, audience, isOpen, projectTitle, readOnly]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (fullscreen) {
        setFullscreen(false);
        return;
      }
      if (asRoom) return;
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, fullscreen, onClose]);

  const total = useMemo(() => sumBudget(budget.lines), [budget.lines]);
  const rollup = useMemo(() => rollupByGroup(budget.lines), [budget.lines]);
  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: budgetLifecycleStrict,
    mode: budgetLifecycleMode
  } = useExportLifecyclePref('budget');
  const lifecycleExportBlocked = budgetLifecycleStrict && !exportLife.exportReady;
  const exportBlocked = lifecycleExportBlocked;
  const slug = String(projectTitle || 'budget').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const roomId = resolveCollabRoomId();
  const lifeNote = `${(budget.lines || []).length} lines · ${audience} · ${budget.currency || 'INR'}/${budget.unit || 'Cr'}${roomId ? ` · room:${roomId}` : ''}`;
  const visibleLines = useMemo(
    () =>
      groupId === 'all'
        ? budget.lines || []
        : (budget.lines || []).filter((r) => r.group === groupId),
    [budget.lines, groupId]
  );
  const groupLabel = (id) => BUDGET_GROUPS.find((g) => g.id === id)?.label || id;

  const patch = (fn) => {
    if (readOnly) return;
    setBudget((prev) => fn(prev));
  };

  if (!asRoom && !isOpen) return null;

  const shellClass = asRoom
    ? `flex flex-col h-full min-h-0 overflow-hidden sps-atelier-room ${fullscreen ? 'sps-fs-console' : ''}`
    : 'sps-shell sps-atelier-room';

  const tree = (
      <div className={shellClass}>
        <HoverPinBar
          storageKey="sps_pin_budget_bar"
          defaultPinned
          pinLabel="Budget bar"
          ariaLabel="Show Budget toolbar"
          className="shrink-0 z-20"
          barClassName="px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold tracking-tight flex items-center gap-2 m-0"
              style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}
            >
              <IconBudget className="w-4 h-4" />
              Budget
            </h2>
            <p className="text-[11px] text-[var(--sps-muted)] truncate m-0">
              ~2 hour feature · Seedance · GPT stills · Vercel · people · {projectTitle}
              {readOnly ? ' · look only' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              className="sps-icon-btn"
              onClick={() => setFullscreen((v) => !v)}
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            {!asRoom ? (
            <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            ) : null}
          </div>
        </HoverPinBar>

        <div className="px-3 py-2 border-b border-[var(--sps-border)] flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex gap-1">
            <button
              type="button"
              className={`sps-btn text-[11px] ${audience === 'producer' ? 'sps-btn-primary' : ''}`}
              onClick={() => setAudience('producer')}
            >
              Producer
            </button>
            <button
              type="button"
              className={`sps-btn text-[11px] ${audience === 'investor' ? 'sps-btn-primary' : ''}`}
              onClick={() => setAudience('investor')}
            >
              Investor
            </button>
          </div>
          <label className="text-[10px] uppercase text-[var(--sps-muted)]">
            Currency
            <select
              className={`${fieldClass} mt-1 w-24`}
              value={budget.currency}
              disabled={readOnly}
              onChange={(e) => patch((b) => ({ ...b, currency: e.target.value }))}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="text-[10px] uppercase text-[var(--sps-muted)]">
            Unit
            <select
              className={`${fieldClass} mt-1 w-24`}
              value={budget.unit}
              disabled={readOnly}
              onChange={(e) => patch((b) => ({ ...b, unit: e.target.value }))}
            >
              <option value="Cr">Crore</option>
              <option value="Lakh">Lakh</option>
              <option value="M">Million</option>
            </select>
          </label>
          <label className="text-[10px] uppercase text-[var(--sps-muted)] flex-1 min-w-[10rem]">
            Ask
            <input
              className={`${fieldClass} mt-1`}
              placeholder="Investment ask — leave empty if unknown"
              value={budget.ask || ''}
              disabled={readOnly}
              onChange={(e) => patch((b) => ({ ...b, ask: e.target.value }))}
            />
          </label>
          <p className="text-[13px] font-semibold m-0" style={{ color: 'var(--sps-gold)' }}>
            Total {formatMoney(total, budget.currency, budget.unit)}
          </p>
          <button
            type="button"
            className="sps-btn"
            disabled={readOnly}
            onClick={() => {
              if (!window.confirm('Reset lines to empty defaults?')) return;
              setBudget(emptyBudget(projectTitle));
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            type="button"
            className="sps-btn disabled:opacity-40"
            disabled={exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export budget markdown'}
            onClick={() =>
              exportDownloadText(`${slug}_budget.md`, budgetToMarkdown({ ...budget, audience }), {
                projectTitle,
                auditLabel: 'budget_md',
                auditFormat: 'md',
                mime: 'text/markdown;charset=utf-8',
                lifecycleMode: budgetLifecycleMode,
                shots,
                roomId,
                note: lifeNote
              })
            }
          >
            <Download className="w-3.5 h-3.5" />
            Markdown
          </button>
          <button
            type="button"
            className="sps-btn disabled:opacity-40"
            disabled={exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export budget CSV'}
            onClick={() =>
              exportDownloadText(`${slug}_budget.csv`, budgetToCsv(budget), {
                projectTitle,
                auditLabel: 'budget_csv',
                auditFormat: 'csv',
                mime: 'text/csv;charset=utf-8',
                lifecycleMode: budgetLifecycleMode,
                shots,
                roomId,
                note: lifeNote
              })
            }
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            className="sps-btn disabled:opacity-40"
            disabled={exportBlocked}
            title={exportBlocked ? exportLife.message : 'Print budget PDF'}
            onClick={() => {
              if (exportBlocked) {
                assertExportAllowed({
                  projectTitle,
                  label: 'budget_pdf',
                  format: 'pdf',
                  lifecycleMode: budgetLifecycleMode,
                  shots,
                  roomId,
                  showAlert: true
                });
                return;
              }
              const gate = assertExportAllowed({
                projectTitle,
                label: 'budget_pdf',
                format: 'pdf',
                lifecycleMode: budgetLifecycleMode,
                shots,
                roomId
              });
              if (!gate.ok) return;
              const printWindow = window.open('', '_blank');
              if (!printWindow) {
                window.alert('Please allow popups to export PDF.');
                return;
              }
              printWindow.document.write(budgetToPrintHtml({ ...budget, audience }, { roomId }));
              printWindow.document.close();
              logExportSuccess({
                projectTitle,
                label: 'budget_pdf',
                format: 'pdf',
                filename: `${slug}_budget.pdf`,
                roomId,
                note: lifeNote,
                lifecycleMode: gate.advisory ? `${budgetLifecycleMode}+ok` : budgetLifecycleMode
              });
            }}
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            className="sps-btn disabled:opacity-40"
            disabled={exportBlocked}
            title={exportBlocked ? exportLife.message : 'Download budget ZIP (README + lines CSV)'}
            onClick={async () => {
              if (exportBlocked) {
                assertExportAllowed({
                  projectTitle,
                  label: 'budget_zip',
                  format: 'zip',
                  lifecycleMode: budgetLifecycleMode,
                  shots,
                  roomId,
                  showAlert: true
                });
                return;
              }
              const gate = assertExportAllowed({
                projectTitle,
                label: 'budget_zip',
                format: 'zip',
                lifecycleMode: budgetLifecycleMode,
                shots,
                roomId
              });
              if (!gate.ok) return;
              const files = buildBudgetZipFiles(budget, { audience, roomId });
              const blob = createZipArchive(files);
              await saveExportBlob(blob, `${slug}_budget.zip`, {
                projectTitle,
                shots,
                lifecycleMode: budgetLifecycleMode,
                skipLifecycleCheck: true,
                advisoryAlready: Boolean(gate.advisory),
                auditLabel: 'budget_zip',
                auditFormat: 'zip',
                roomId,
                note: lifeNote,
                showAlert: false
              });
            }}
          >
            <Archive className="w-3.5 h-3.5" />
            ZIP
          </button>
          {lifecycleExportBlocked ? (
            <span className="text-[10px] text-[var(--sps-gold)] max-w-[12rem] leading-snug">
              {exportLife.message}
            </span>
          ) : null}
        </div>

        <div className="px-3 py-1.5 border-b border-[var(--sps-border)] flex flex-wrap gap-1 shrink-0">
          {BUDGET_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`sps-btn text-[10px] ${groupId === g.id ? 'sps-btn-primary' : ''}`}
              onClick={() => setGroupId(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 sps-atelier-pane">
          {audience === 'investor' ? (
            <div className="max-w-3xl mx-auto space-y-3">
              <p className="text-[12px] text-[var(--sps-muted)] m-0">
                Investor view — group roll-up for a ~2 hour picture (Seedance, GPT stills, Vercel, people, finish). Not a box-office forecast.
              </p>
              {rollup.map((row) => {
                const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0;
                return (
                  <div
                    key={row.group}
                    className="flex items-center gap-3 rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-surface)] px-3 py-2"
                  >
                    <span className="flex-1 text-[13px] text-[var(--sps-text)]">{groupLabel(row.group)}</span>
                    <span className="font-mono text-[12px] text-[var(--sps-muted)]">{pct}%</span>
                    <span className="font-mono text-[13px] text-[var(--sps-text)]">
                      {formatMoney(row.amount, budget.currency, budget.unit)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[42rem]">
                <thead>
                  <tr className="text-[10px] uppercase text-[var(--sps-muted)]">
                    <th className="p-2 font-normal">Group</th>
                    <th className="p-2 font-normal">Department</th>
                    <th className="p-2 font-normal">Line</th>
                    <th className="p-2 font-normal w-28">Amount</th>
                    <th className="p-2 font-normal w-36">Status</th>
                    <th className="p-2 font-normal">Notes</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {visibleLines.map((row) => {
                    const i = (budget.lines || []).findIndex((r) => r.id === row.id);
                    return (
                    <tr key={row.id || i} className="border-t border-[var(--sps-border)]">
                      <td className="p-1.5">
                        <select
                          className={fieldClass}
                          value={row.group || 'picture'}
                          disabled={readOnly}
                          onChange={(e) =>
                            patch((b) => ({
                              ...b,
                              lines: b.lines.map((r, idx) => (idx === i ? { ...r, group: e.target.value } : r))
                            }))
                          }
                        >
                          {BUDGET_GROUPS.filter((g) => g.id !== 'all').map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1.5">
                        <input
                          className={fieldClass}
                          value={row.dept || ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            patch((b) => ({
                              ...b,
                              lines: b.lines.map((r, idx) => (idx === i ? { ...r, dept: e.target.value } : r))
                            }))
                          }
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          className={fieldClass}
                          value={row.label || ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            patch((b) => ({
                              ...b,
                              lines: b.lines.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r))
                            }))
                          }
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          className={`${fieldClass} font-mono`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.amount === 0 || row.amount ? row.amount : ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            patch((b) => ({
                              ...b,
                              lines: b.lines.map((r, idx) =>
                                idx === i ? { ...r, amount: parseAmount(e.target.value) } : r
                              )
                            }))
                          }
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          className={fieldClass}
                          value={row.status}
                          disabled={readOnly}
                          onChange={(e) =>
                            patch((b) => ({
                              ...b,
                              lines: b.lines.map((r, idx) => (idx === i ? { ...r, status: e.target.value } : r))
                            }))
                          }
                        >
                          {BUDGET_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1.5">
                        <input
                          className={fieldClass}
                          value={row.notes || ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            patch((b) => ({
                              ...b,
                              lines: b.lines.map((r, idx) => (idx === i ? { ...r, notes: e.target.value } : r))
                            }))
                          }
                        />
                      </td>
                      <td className="p-1.5">
                        <button
                          type="button"
                          className="sps-icon-btn"
                          disabled={readOnly || (budget.lines || []).length <= 1}
                          onClick={() =>
                            patch((b) => ({ ...b, lines: b.lines.filter((_, idx) => idx !== i) }))
                          }
                          title="Remove line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {!readOnly ? (
                <button
                  type="button"
                  className="sps-btn mt-2"
                  onClick={() =>
                    patch((b) => ({
                      ...b,
                      lines: [
                        ...b.lines,
                        {
                          id: `line_${Date.now()}`,
                          group: groupId === 'all' ? 'picture' : groupId,
                          dept: 'Other',
                          label: 'New line',
                          amount: 0,
                          status: 'ASSUMPTION',
                          notes: ''
                        }
                      ]
                    }))
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add line
                </button>
              ) : null}
            </div>
          )}
          <label className="block text-[10px] uppercase text-[var(--sps-muted)] mt-4 max-w-3xl">
            Notes
            <textarea
              className={`${fieldClass} mt-1 min-h-[4rem] resize-y`}
              value={budget.notes || ''}
              disabled={readOnly}
              onChange={(e) => patch((b) => ({ ...b, notes: e.target.value }))}
              rows={3}
            />
          </label>
        </div>
      </div>
  );

  if (asRoom) return tree;
  return (
    <div className={`sps-overlay ${fullscreen ? 'is-full' : ''}`} style={{ zIndex: 88 }}>
      {tree}
    </div>
  );
}
