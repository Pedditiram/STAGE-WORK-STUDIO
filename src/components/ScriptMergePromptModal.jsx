import React from 'react';
import { Layers, Replace, PlusCircle, X, Sparkles } from 'lucide-react';

export default function ScriptMergePromptModal({
  isOpen,
  projectTitle,
  existingCount,
  incomingCount,
  onOverwrite,
  onMerge,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-amber-500/50 text-white rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                Apply AI Script Breakdown
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Target Project: <span className="text-amber-400 font-bold">{projectTitle}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Shots Warning Info Box */}
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-1 font-mono">
          <p className="font-bold flex items-center gap-1.5 text-amber-300">
            <Layers className="w-4 h-4 text-amber-400" />
            Existing Shots Detected ({existingCount} shots)
          </p>
          <p className="text-[11.5px] text-amber-200/80 leading-relaxed">
            Project '<strong className="text-white">{projectTitle}</strong>' already contains <strong>{existingCount}</strong> shot(s). You are adding <strong>{incomingCount}</strong> new AI breakdown shot(s).
          </p>
        </div>

        {/* Action Choice Buttons */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={onOverwrite}
            className="w-full p-3.5 rounded-xl bg-zinc-900 hover:bg-rose-950/40 border border-rose-500/40 hover:border-rose-400 text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 group-hover:bg-rose-500 group-hover:text-zinc-950 transition-colors">
                <Replace className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-rose-300 group-hover:text-rose-200 block font-mono">
                  🔄 Overwrite & Replace Existing Shots
                </span>
                <span className="text-[10.5px] text-zinc-400 block font-mono">
                  Erase current {existingCount} shots and replace with {incomingCount} new breakdown shots.
                </span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onMerge}
            className="w-full p-3.5 rounded-xl bg-zinc-900 hover:bg-emerald-950/40 border border-emerald-500/40 hover:border-emerald-400 text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200 block font-mono">
                  ➕ Merge & Append to Existing Shots
                </span>
                <span className="text-[10.5px] text-zinc-400 block font-mono">
                  Keep existing {existingCount} shots and append {incomingCount} new shots ({existingCount + incomingCount} total).
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Cancel Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold font-mono transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
