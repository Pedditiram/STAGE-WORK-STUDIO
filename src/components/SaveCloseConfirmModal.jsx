import React from 'react';
import { Save, LogOut, X, AlertCircle } from 'lucide-react';

export default function SaveCloseConfirmModal({
  isOpen,
  onSaveAndClose,
  onCloseWithoutSave,
  onCancel,
  title = 'Save before closing?'
}) {
  if (!isOpen) return null;

  return (
    <div className="sps-overlay is-full" style={{ zIndex: 100 }} onClick={onCancel}>
      <div
        className="sps-shell sps-shell-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sps-modal-head">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <h3>{title}</h3>
          </div>
          <button type="button" onClick={onCancel} className="sps-icon-btn" aria-label="Cancel">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Save your changes, close without saving, or keep working.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onSaveAndClose}
              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save & close
            </button>
            <button
              type="button"
              onClick={onCloseWithoutSave}
              className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Close without saving
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
