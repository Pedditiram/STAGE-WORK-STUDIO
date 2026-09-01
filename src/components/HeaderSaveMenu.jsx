import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, HardDrive, Save } from 'lucide-react';
import { AUTO_SAVE_INTERVALS } from '../utils/autoSaveIntervals';

/**
 * Disk save + auto-save interval (next to cloud sync).
 * Saves full project vault (+ versioned snapshot when Project save location is set).
 */
export default function HeaderSaveMenu({
  lookOnly = false,
  projectTitle = '',
  autoSaveIntervalId = '5m',
  onChangeAutoSaveInterval,
  onSaveNow,
  isSaving = false,
  lastSavedAt = null,
  lastVersionFile = '',
  isSavedToast = false
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const intervalLabel =
    AUTO_SAVE_INTERVALS.find((x) => x.id === autoSaveIntervalId)?.label || 'Auto-save';

  const lastLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const handleSave = async () => {
    if (lookOnly || isSaving) return;
    await onSaveNow?.({ source: 'manual' });
  };

  return (
    <div className="relative shrink-0 flex items-center">
      <button
        type="button"
        className={`sps-icon-btn rounded-r-none ${isSavedToast || isSaving ? 'is-on' : ''}`}
        title={
          isSaving
            ? 'Saving project…'
            : `Save project to disk${projectTitle ? ` · ${projectTitle}` : ''}`
        }
        aria-label="Save project"
        disabled={lookOnly || isSaving}
        onClick={handleSave}
      >
        {isSaving ? (
          <HardDrive className="w-3.5 h-3.5 animate-pulse" />
        ) : isSavedToast ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        type="button"
        className={`sps-icon-btn rounded-l-none border-l-0 px-1.5 ${open ? 'is-on' : ''}`}
        title={`Auto-save · ${intervalLabel}`}
        aria-label="Auto-save options"
        aria-expanded={open}
        disabled={lookOnly}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[45]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="absolute right-0 top-full mt-2 z-[60] w-[min(100vw-1.5rem,18rem)] rounded-xl border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] p-3 space-y-2 shadow-lg"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <p className="m-0 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--sps-gold)' }}>
              Project save · {projectTitle || 'Untitled'}
            </p>
            <p className="m-0 text-[10px]" style={{ color: 'var(--sps-muted)' }}>
              Last saved {lastLabel}
              {lastVersionFile ? ` · ${lastVersionFile}` : ''}
            </p>
            <button
              type="button"
              className="sps-btn sps-btn-primary w-full text-[11px] justify-center"
              disabled={lookOnly || isSaving}
              onClick={async () => {
                await handleSave();
                setOpen(false);
              }}
            >
              <Save className="w-3.5 h-3.5" />
              Save now (disk + version)
            </button>
            <p className="m-0 pt-1 text-[9px] uppercase tracking-widest" style={{ color: 'var(--sps-muted)' }}>
              Auto-save
            </p>
            <ul className="m-0 p-0 list-none space-y-0.5">
              {AUTO_SAVE_INTERVALS.map((opt) => {
                const active = opt.id === autoSaveIntervalId;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                        active ? 'is-on' : ''
                      }`}
                      style={{
                        background: active ? 'var(--sps-surface)' : 'transparent',
                        color: active ? 'var(--sps-gold)' : 'var(--sps-text)'
                      }}
                      onClick={() => {
                        onChangeAutoSaveInterval?.(opt.id);
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="m-0 text-[9px] leading-snug" style={{ color: 'var(--sps-muted)' }}>
              Writes vault + Project save folder when set. Console “Backup” only downloads a .sps file — not the
              same as versioning.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
