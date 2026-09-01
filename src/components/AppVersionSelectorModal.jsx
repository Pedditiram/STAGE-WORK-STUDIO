import React from 'react';
import { HardDrive, Cloud, Sparkles, Check, ShieldCheck, Zap, X } from 'lucide-react';

export default function AppVersionSelectorModal({ isOpen, onClose, currentMode, onSelectMode }) {
  if (!isOpen) return null;

  return (
    <div className="sps-overlay" onClick={onClose}>
      <div 
        className="sps-shell sps-shell-lg"
        style={{ height: 'auto', padding: '1.25rem', alignSelf: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sps-modal-head" style={{ margin: '-1.25rem -1.25rem 1rem' }}>
          <div>
            <h2>Stage Work Studio</h2>
            <p>Local workstation or cloud room</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="sps-icon-btn" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mode Selector Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. LOCAL VERSION CARD */}
          <div 
            onClick={() => onSelectMode('local')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 relative ${
              currentMode === 'local'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/50'
                : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            {currentMode === 'local' && (
              <span className="absolute top-3 right-3 bg-emerald-500 text-zinc-950 font-black text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono uppercase tracking-wider shadow-sm">
                <Check className="w-3 h-3 stroke-[3]" /> Active Mode
              </span>
            )}

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
                  LOCAL VERSION
                </h3>
                <span className="text-[11px] font-bold text-emerald-400 font-mono">
                  ⚡ 100% Offline & Zero Cloud Delay
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                All projects, shots, matrix edits, custom presets, and script breakdowns are stored 100% locally in your browser. Zero cloud polling loss, zero network lag.
              </p>
            </div>

            <div className="pt-2 border-t border-zinc-800/60 flex items-center gap-2 text-[11px] text-emerald-300 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Full Local Production Environment</span>
            </div>
          </div>

          {/* 2. CLOUD VERSION CARD */}
          <div 
            onClick={() => onSelectMode('cloud')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 relative ${
              currentMode === 'cloud'
                ? 'bg-cyan-950/40 border-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/50'
                : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            {currentMode === 'cloud' && (
              <span className="absolute top-3 right-3 bg-cyan-500 text-zinc-950 font-black text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono uppercase tracking-wider shadow-sm">
                <Check className="w-3 h-3 stroke-[3]" /> Active Mode
              </span>
            )}

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 w-fit">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
                  CLOUD VERSION
                </h3>
                <span className="text-[11px] font-bold text-cyan-400 font-mono">
                  ☁️ Firebase Real-time Multi-User Sync
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                Connects to Firebase cloud database for multi-user real-time room collaboration across team members.
              </p>
            </div>

            <div className="pt-2 border-t border-zinc-800/60 flex items-center gap-2 text-[11px] text-cyan-300 font-mono">
              <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Cloud Realtime Multi-User Sync</span>
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${
              currentMode === 'local' || currentMode === 'cloud'
                ? 'bg-zinc-900/60 border-zinc-800'
                : 'bg-zinc-900/60 border-zinc-800'
            }`}
          >
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 w-fit">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans">GOOGLE DRIVE</h3>
                <span className="text-[11px] font-bold text-sky-400 font-mono">
                  Share & manage files with local
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                Keep working locally. Push packs to a Stage Work Studio Drive folder, pull them on another machine, and share a view link with crew.
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800/60 text-[11px] text-sky-300 font-mono">
              Connect in Settings → Cloud, or Projects library.
            </div>
          </div>
        </div>

        {/* Modal Launch & Confirm Button */}
        <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
          <div className="text-[11px] text-zinc-400 font-mono">
            Mode selection can be changed anytime from the top header badge.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-zinc-950 font-black text-xs font-mono shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Launch Studio ({currentMode.toUpperCase()})
          </button>
        </div>
      </div>
    </div>
  );
}
