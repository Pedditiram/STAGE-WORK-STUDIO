import React from 'react';
import { AlertTriangle, User, ShieldAlert, ArrowDownCircle, GitMerge, CheckCircle, X, Clock, RefreshCw } from 'lucide-react';

export default function ConflictAlertModal({
  isOpen,
  onClose,
  conflictData,
  onPullCloudVersion,
  onMergeShots,
  onKeepLocal
}) {
  if (!isOpen || !conflictData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-950 text-white border-2 border-amber-500/80 rounded-2xl shadow-[0_25px_80px_rgba(245,158,11,0.4)] overflow-hidden font-mono text-xs text-left">
        
        {/* Header Banner */}
        <div className="p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 shadow-md flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-300 font-sans tracking-tight">COLLABORATOR SLOT EDITING CONFLICT</h3>
              <span className="text-[11px] text-amber-200/90 font-bold block">
                Another user is actively editing the same slot!
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conflict Details */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-bold">Active User On This Slot:</span>
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" /> Live Editing Now
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-red-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                {(conflictData.userName || conflictData.userEmail || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-xs truncate">{conflictData.userName || conflictData.userEmail}</h4>
                <p className="text-[11px] text-amber-300 font-mono truncate">{conflictData.userEmail}</p>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800/80 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold">Project Name:</span>
                <span className="text-amber-300 font-mono font-black text-xs bg-amber-950/90 px-2.5 py-1 rounded-lg border border-amber-500/60 shadow flex items-center gap-1.5">
                  📁 {conflictData.projectTitle || 'STAGE PRODUCTION STUDIO'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold">Target Shot / Slot:</span>
                <span className="text-cyan-300 font-mono font-black text-xs bg-cyan-950/90 px-2.5 py-1 rounded-lg border border-cyan-500/60 shadow">
                  {conflictData.activeShotId}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Choose how you would like to handle this conflict to avoid overwriting your collaborator's work:
          </p>

          {/* Action Choice Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onPullCloudVersion}
              className="w-full py-2.5 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-between shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-cyan-200" />
                <span>📥 Pull Cloud Version (Accept {conflictData.userName || 'Collaborator'}'s Shot)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={onMergeShots}
              className="w-full py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-between shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4" />
                <span>⚡ Intelligently Merge Both Shots</span>
              </div>
            </button>

            <button
              type="button"
              onClick={onKeepLocal}
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-between shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-slate-400" />
                <span> Keep My Local Edits</span>
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 text-center font-bold">
            Real-Time Collaboration Guard Active • Stage Production Studio Engine
          </div>

        </div>
      </div>
    </div>
  );
}
