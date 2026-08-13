import React from 'react';
import { Save, LogOut, X, AlertCircle } from 'lucide-react';

export default function SaveCloseConfirmModal({ isOpen, onSaveAndClose, onCloseWithoutSave, onCancel, title = "Save & Exit Confirmation" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-950 text-white border-2 border-amber-500/60 rounded-2xl shadow-[0_25px_70px_rgba(245,158,11,0.3)] overflow-hidden font-mono text-xs text-left">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 border-b border-amber-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-black text-white font-sans tracking-tight">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 font-bold leading-relaxed">
            You pressed <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-300 font-black">⌘ + Space</span> or <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-300 font-black">ESC</span> to close window. Would you like to save your craft changes before closing?
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onSaveAndClose}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>💾 Save & Close</span>
            </button>

            <button
              type="button"
              onClick={onCloseWithoutSave}
              className="flex-1 py-2.5 px-3 rounded-xl bg-red-950/80 hover:bg-red-900/90 text-red-300 border border-red-700/60 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>🚪 Close Without Save</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
