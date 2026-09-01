import React, { useCallback, useEffect, useState } from 'react';
import { X, Check, Ban, RefreshCw, Sparkles } from 'lucide-react';
import {
  CMD_STATUS,
  CMD_TYPES,
  applyLlmCommand,
  approveLlmCommand,
  batchApplyLlmCommands,
  batchApproveLlmCommands,
  commandSummary,
  describeApplyShotsCommand,
  patchLlmCommandPayload,
  readLlmCommands,
  rejectLlmCommand,
  validateAndMarkCommand,
  LLM_SOURCE_FILTER_OPTIONS,
  LLM_SOURCE_FILTER_ALL,
  filterLlmCommandsBySource
} from '../utils/llmCommandBus';

function ApplyShotsReview({ cmd, ctx, onSwitchMode }) {
  const info = describeApplyShotsCommand(cmd, ctx);
  const isMerge = info.mode === 'merge';
  return (
    <div className="rounded-[6px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] p-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
            isMerge
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
          }`}
        >
          {info.mode}
        </span>
        <span className="text-[10px] font-mono text-[var(--sps-muted)]">{info.label}</span>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          className="sps-btn text-[9px] disabled:opacity-40"
          disabled={!isMerge}
          onClick={() => onSwitchMode(cmd.id, 'overwrite')}
        >
          Switch to overwrite
        </button>
        <button
          type="button"
          className="sps-btn text-[9px] disabled:opacity-40"
          disabled={isMerge}
          onClick={() => onSwitchMode(cmd.id, 'merge')}
        >
          Switch to merge
        </button>
      </div>
    </div>
  );
}

export default function LlmCommandReviewModal({
  isOpen,
  onClose,
  projectTitle = '',
  shots = [],
  onUpdateShot,
  onApplyShots
}) {
  const [rows, setRows] = useState([]);
  const [sourceFilter, setSourceFilter] = useState(LLM_SOURCE_FILTER_ALL);

  const refresh = useCallback(() => {
    setRows(readLlmCommands(projectTitle).slice(0, 48));
  }, [projectTitle]);

  useEffect(() => {
    if (!isOpen) return undefined;
    refresh();
    const onUp = () => refresh();
    window.addEventListener('sps_llm_commands_updated', onUp);
    return () => window.removeEventListener('sps_llm_commands_updated', onUp);
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredRows = filterLlmCommandsBySource(rows, sourceFilter);
  const pending = filteredRows.filter((c) =>
    [CMD_STATUS.PROPOSED, CMD_STATUS.VALIDATED, CMD_STATUS.APPROVED].includes(c.status)
  );
  const recent = filteredRows.filter((c) =>
    [CMD_STATUS.APPLIED, CMD_STATUS.REJECTED, CMD_STATUS.FAILED].includes(c.status)
  );
  const allPending = rows.filter((c) =>
    [CMD_STATUS.PROPOSED, CMD_STATUS.VALIDATED, CMD_STATUS.APPROVED].includes(c.status)
  );

  const mutators = {
    updateShot: (index, shot) => onUpdateShot?.(index, shot),
    applyShots: (nextShots, mode, extras) => onApplyShots?.(nextShots, mode, extras)
  };
  const ctx = { shots, projectTitle };

  const validate = (id) => {
    validateAndMarkCommand(id, projectTitle, ctx);
    refresh();
  };

  const approve = (id) => {
    approveLlmCommand(id, projectTitle);
    refresh();
  };

  const reject = (id) => {
    rejectLlmCommand(id, projectTitle, 'Rejected in review');
    refresh();
  };

  const apply = (id) => {
    const result = applyLlmCommand(id, projectTitle, ctx, mutators);
    if (!result.ok) {
      window.alert(result.error || 'Apply failed');
    }
    refresh();
  };

  const approveAndApply = (id) => {
    approveLlmCommand(id, projectTitle);
    apply(id);
  };

  const switchApplyMode = (cmdId, mode) => {
    patchLlmCommandPayload(cmdId, projectTitle, { mode });
    validateAndMarkCommand(cmdId, projectTitle, ctx);
    refresh();
  };

  const batchApprove = () => {
    const result = batchApproveLlmCommands(projectTitle, {
      cmdIds: pending.map((c) => c.id)
    });
    refresh();
    if (result.approved) {
      window.alert(`Approved ${result.approved} command${result.approved === 1 ? '' : 's'}.`);
    }
  };

  const batchApply = () => {
    const risky = pending.filter(
      (c) => c.type === CMD_TYPES.APPLY_SHOTS || c.type === CMD_TYPES.REPLACE_SHOT
    );
    if (
      risky.length &&
      !window.confirm(
        `Includes ${risky.length} matrix overwrite/replace command${risky.length === 1 ? '' : 's'}. Apply all ${pending.length}?`
      )
    ) {
      return;
    }
    const result = batchApplyLlmCommands(projectTitle, ctx, mutators, {
      cmdIds: pending.map((c) => c.id),
      types: null
    });
    refresh();
    if (result.failed) {
      window.alert(
        `Applied ${result.applied}, failed ${result.failed}.\n${(result.errors || []).slice(0, 4).join('\n')}`
      );
      return;
    }
    if (result.applied) {
      window.alert(`Applied ${result.applied} command${result.applied === 1 ? '' : 's'}.`);
    }
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 93 }}>
      <div className="sps-shell sps-shell-md flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold tracking-tight flex items-center gap-2"
              style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}
            >
              <Sparkles className="w-4 h-4 text-[var(--sps-gold)]" />
              LLM command review
            </h2>
            <p className="text-[11px] text-[var(--sps-muted)] truncate">
              Propose → validate → approve → mutate · {projectTitle || 'Untitled'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="sps-icon-btn" title="Refresh" onClick={refresh}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-wrap gap-1">
            {LLM_SOURCE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                  sourceFilter === opt.id
                    ? 'border-[var(--sps-gold)]/60 text-[var(--sps-gold)]'
                    : 'border-[var(--sps-border)] text-[var(--sps-muted)]'
                }`}
                onClick={() => setSourceFilter(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)]">
                Pending ({pending.length}
                {sourceFilter !== LLM_SOURCE_FILTER_ALL ? ` / ${allPending.length}` : ''})
              </h3>
              {pending.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="sps-btn text-[10px]" onClick={batchApprove}>
                    Approve all
                  </button>
                  <button type="button" className="sps-btn sps-btn-primary text-[10px]" onClick={batchApply}>
                    Apply all
                  </button>
                </div>
              ) : null}
            </div>
            {pending.length === 0 ? (
              <p className="text-[11px] text-[var(--sps-muted)]">
                {sourceFilter === LLM_SOURCE_FILTER_ALL
                  ? 'No open proposals. Matrix / Form enhance enqueues commands here instead of writing SoT directly.'
                  : 'No pending commands for this source filter.'}
              </p>
            ) : (
              pending.map((cmd) => (
                <div
                  key={cmd.id}
                  className="border border-[var(--sps-border)] rounded-[8px] p-3 bg-[var(--sps-surface)] space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono font-bold text-[var(--sps-gold)]">{cmd.type}</p>
                      <p className="text-[10px] font-mono text-[var(--sps-muted)]">{cmd.source || 'unknown'}</p>
                      <p className="text-[11px] text-[var(--sps-text)] mt-0.5">{commandSummary(cmd)}</p>
                      {cmd.reason ? (
                        <p className="text-[10px] text-[var(--sps-muted)] mt-1">{cmd.reason}</p>
                      ) : null}
                      {cmd.errors?.length ? (
                        <p className="text-[10px] text-rose-400 mt-1">{cmd.errors.join(' · ')}</p>
                      ) : null}
                      {cmd.type === CMD_TYPES.APPLY_SHOTS ? (
                        <ApplyShotsReview cmd={cmd} ctx={ctx} onSwitchMode={switchApplyMode} />
                      ) : null}
                    </div>
                    <span className="text-[9px] font-mono text-[var(--sps-muted)] shrink-0">{cmd.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className="sps-btn text-[10px]" onClick={() => validate(cmd.id)}>
                      Validate
                    </button>
                    <button type="button" className="sps-btn text-[10px]" onClick={() => approve(cmd.id)}>
                      Approve
                    </button>
                    <button
                      type="button"
                      className="sps-btn sps-btn-primary text-[10px]"
                      onClick={() => approveAndApply(cmd.id)}
                    >
                      <Check className="w-3 h-3" />
                      Apply
                    </button>
                    <button type="button" className="sps-btn text-[10px]" onClick={() => reject(cmd.id)}>
                      <Ban className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          {recent.length > 0 ? (
            <section className="space-y-1.5">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)]">Recent</h3>
              {recent.slice(0, 8).map((cmd) => (
                <div
                  key={cmd.id}
                  className="flex items-center justify-between gap-2 text-[10px] font-mono border border-[var(--sps-border)] rounded px-2 py-1.5"
                >
                  <span className="truncate">
                    {cmd.type} · {commandSummary(cmd)}
                  </span>
                  <span className="text-[var(--sps-muted)] shrink-0">{cmd.status}</span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
