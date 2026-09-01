import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Shield, X } from 'lucide-react';
import { isUsableProjectTitle, normalizeProjectTitle } from '../utils/activeProjectGate';
import { titlesMatch } from '../utils/projectWorkspace';

/**
 * Confirms the ACTIVE project before Parse/Apply/Writer→Matrix writes.
 * User must type the active title to unlock Confirm.
 */
export default function ActiveProjectConfirmModal({
  isOpen,
  activeTitle = '',
  intendedTitle = '',
  existingCount = 0,
  incomingCount = null,
  actionLabel = 'Write shots into this project',
  onConfirm,
  onCancel
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!isOpen) setTyped('');
  }, [isOpen, activeTitle]);

  if (!isOpen) return null;

  const active = normalizeProjectTitle(activeTitle);
  const intended = normalizeProjectTitle(intendedTitle);
  const mismatch = Boolean(intended && isUsableProjectTitle(intended) && !titlesMatch(active, intended));
  const titleOk = isUsableProjectTitle(active) && titlesMatch(typed, active);
  const canConfirm = titleOk && !mismatch;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono">
      <div
        className="relative w-full max-w-lg bg-zinc-950 border border-amber-500/50 text-white rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sps-active-project-gate-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 id="sps-active-project-gate-title" className="text-sm font-bold text-white">
                Confirm active project
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                {actionLabel}. Shots write only into the film shown below — not another card in the library.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Active project</p>
          <p className="text-base font-bold text-amber-300 break-words">{active || '(none — blocked)'}</p>
          <p className="text-[11px] text-zinc-400">
            {incomingCount == null || Number.isNaN(Number(incomingCount)) ? (
              <>Shot count appears after you confirm and parse.</>
            ) : (
              <>
                Incoming: <strong className="text-white">{incomingCount}</strong> shot
                {incomingCount === 1 ? '' : 's'}
              </>
            )}
            {existingCount > 0 ? (
              <>
                {' '}
                · Existing on this title: <strong className="text-white">{existingCount}</strong>
              </>
            ) : null}
          </p>
        </div>

        {mismatch ? (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-100 text-[11px] flex gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p>
              Target <strong className="text-white">“{intended}”</strong> does not match active{' '}
              <strong className="text-white">“{active}”</strong>. Switch to the correct project in the
              Library, or clear the mismatched target, then try again.
            </p>
          </div>
        ) : intended && isUsableProjectTitle(intended) && titlesMatch(active, intended) ? (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-100 text-[11px]">
            Script title <strong className="text-white">“{intended}”</strong> matches the active project.
          </div>
        ) : null}

        {!isUsableProjectTitle(active) ? (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-100 text-[11px] flex gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p>
              No usable project title is open. Create or open a named film in Project Console first
              (not the default studio placeholder).
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block">
              Type the active project title to unlock
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={active}
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="sps-btn flex-1 text-xs">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm?.()}
            className="sps-btn sps-btn-primary flex-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            Confirm write
          </button>
        </div>
      </div>
    </div>
  );
}
