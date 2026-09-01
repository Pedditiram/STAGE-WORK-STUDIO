import React, { useEffect, useState, useRef } from 'react';
import { X, Brain, Download, Upload, RefreshCw, Trash2, HardDrive, Sparkles } from 'lucide-react';
import {
  getStudioBrain,
  getStudioBrainStats,
  learnFromProjectLibrary,
  exportStudioBrainJson,
  importStudioBrainJson,
  resetStudioBrain,
  hydrateStudioBrainFromDisk
} from '../services/studioBrain';
import { exportCreativeAuditCsv, resolveActiveProjectTitle } from '../utils/creativeAuditLog';
import { resolveCollabRoomId } from '../utils/exportGate';

/**
 * Studio Brain panel — local pipeline intelligence that grows with projects.
 */
export default function StudioBrainModal({ isOpen, onClose }) {
  const [brain, setBrain] = useState(() => getStudioBrain());
  const [stats, setStats] = useState(() => getStudioBrainStats());
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const refresh = () => {
    setBrain(getStudioBrain());
    setStats(getStudioBrainStats());
  };

  useEffect(() => {
    if (!isOpen) return;
    hydrateStudioBrainFromDisk().then(() => refresh());
    const onUp = () => refresh();
    window.addEventListener('sps_studio_brain_updated', onUp);
    return () => window.removeEventListener('sps_studio_brain_updated', onUp);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const topCrafts = Object.entries(brain.craftBanks || {})
    .map(([key, arr]) => ({ key, n: Array.isArray(arr) ? arr.length : 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  const topChars = Object.values(brain.characters || {})
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 8);

  const flash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2800);
  };

  const handleTrainFromLibrary = () => {
    try {
      const lib = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
      learnFromProjectLibrary(Array.isArray(lib) ? lib : []);
      refresh();
      flash('Trained from project library → local Studio Brain updated');
    } catch (e) {
      flash(e?.message || 'Train failed');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await importStudioBrainJson(file);
      refresh();
      flash(`Imported “${file.name}”`);
    } catch (err) {
      flash(err?.message || 'Import failed');
    }
  };

  const handleReset = () => {
    if (!confirm('Reset Studio Brain? Local learned presets will be cleared (projects stay safe).')) return;
    resetStudioBrain();
    refresh();
    flash('Studio Brain reset');
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 90 }}>
      <div
        className="sps-shell sps-shell-md"
      >
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/95 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2" style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}>
              <Brain className="w-4 h-4" />
              Studio Brain
            </h2>
            <p className="text-[11px] text-zinc-300 truncate">
              AI Cinema Production OS · learns your pipeline · saved on this device
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-3 text-[12px] text-zinc-300 leading-relaxed">
            Studio Brain accumulates craft phrases, characters, and genre habits from your projects into a local store
            (browser + IndexedDB). When cloud LLM credits run out, offline breakdown and presets can still draw from
            this refined pipeline memory.
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Shots learned', stats.shotCount],
              ['Craft phrases', stats.craftPhraseCount],
              ['Characters', stats.characterCount],
              ['Genres', stats.genreCount]
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center">
                <p className="text-lg font-black text-amber-300">{val || 0}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase px-2 py-1 rounded-full border ${
                stats.readyForOffline
                  ? 'border-emerald-600/50 text-emerald-300 bg-emerald-950/30'
                  : 'border-zinc-700 text-zinc-500'
              }`}
            >
              {stats.readyForOffline ? 'Offline-ready' : 'Keep working projects to strengthen Brain'}
            </span>
            {stats.updatedAt && (
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                Updated {new Date(stats.updatedAt).toLocaleString()}
              </span>
            )}
            {msg && <span className="text-[11px] text-amber-300 font-bold">{msg}</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTrainFromLibrary}
              className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Train from Library
            </button>
            <button
              type="button"
              onClick={() => {
                exportStudioBrainJson();
                flash('Downloaded Studio Brain JSON');
              }}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Save to disk
            </button>

            <button
              type="button"
              className="sps-btn text-xs inline-flex items-center gap-1.5"
              title="Download creative audit CSV for the active project"
              onClick={() => {
                const title = resolveActiveProjectTitle();
                const ok = exportCreativeAuditCsv(title, { roomId: resolveCollabRoomId() });
                flash(ok ? 'Downloaded creative audit CSV' : 'Audit CSV blocked');
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Audit CSV
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
            <button
              type="button"
              onClick={refresh}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-rose-950 text-rose-300 text-xs font-bold border border-rose-900/50 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-900 text-[10px] font-black uppercase text-zinc-400">Top craft banks</div>
              <ul className="divide-y divide-zinc-800/80 max-h-40 overflow-y-auto">
                {topCrafts.length === 0 && (
                  <li className="px-3 py-2 text-[11px] text-zinc-400">No phrases yet — train from library or keep editing shots.</li>
                )}
                {topCrafts.map((c) => (
                  <li key={c.key} className="px-3 py-1.5 text-[11px] flex justify-between gap-2">
                    <span className="text-zinc-300 truncate font-mono">{c.key}</span>
                    <span className="text-amber-300 font-bold shrink-0">{c.n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-900 text-[10px] font-black uppercase text-zinc-400">Characters remembered</div>
              <ul className="divide-y divide-zinc-800/80 max-h-40 overflow-y-auto">
                {topChars.length === 0 && (
                  <li className="px-3 py-2 text-[11px] text-zinc-400">Characters appear here after Matrix shots include them.</li>
                )}
                {topChars.map((c) => (
                  <li key={c.name} className="px-3 py-1.5 text-[11px] flex justify-between gap-2">
                    <span className="text-cyan-300 truncate">{c.name}</span>
                    <span className="text-zinc-400 shrink-0">×{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {(brain.recentProjects || []).length > 0 && (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-900 text-[10px] font-black uppercase text-zinc-500">Recent learn events</div>
              <ul className="divide-y divide-zinc-800/80">
                {(brain.recentProjects || []).slice(0, 6).map((p) => (
                  <li key={`${p.title}-${p.at}`} className="px-3 py-2 text-[11px] text-zinc-400 flex justify-between gap-2">
                    <span className="text-zinc-200 font-bold truncate">{p.title}</span>
                    <span className="shrink-0">{p.shots} shots · {p.genre || 'genre'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
