import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Clapperboard, Download, RefreshCw, Film, Smartphone, Sparkles, Copy, Check,
  Maximize2, Minimize2, Save, Pencil, Wand2, AlertCircle
} from 'lucide-react';
import {
  PROMO_TEMPLATES,
  buildPromoPack,
  clonePromoPack,
  formatClock,
  promoPackToMarkdown,
  promoPackToCsv,
  rebuildPromoMasterPrompts,
  savePromoPackLocal
} from '../utils/promoPack';
import { downloadTextFile } from '../utils/screenplayInterop';
import CinematicReferencesPanel from './CinematicReferencesPanel';

function isModKey(e) {
  return e.metaKey || e.ctrlKey;
}

/**
 * Promo Pack — Trailer / Teaser / Reels cut lists from Matrix shots.
 * Save & Close matches Character Bible vault (footer + unsaved confirm).
 * ⌘Enter = fullscreen · Esc = exit fullscreen · Esc again = request close
 */
export default function PromoPackModal({
  isOpen,
  onClose,
  shots = [],
  projectTitle = 'Project',
  aspectRatio = '2.39:1'
}) {
  const [templateId, setTemplateId] = useState('trailer_90');
  const [seed, setSeed] = useState(0);
  const [editMode, setEditMode] = useState('ai'); // 'manual' | 'ai'
  const [draft, setDraft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [enhanceMsg, setEnhanceMsg] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmClosePopup, setShowConfirmClosePopup] = useState(false);
  const panelRef = useRef(null);
  const skipDirtyRef = useRef(false);

  const markDirty = useCallback(() => {
    if (skipDirtyRef.current) return;
    setHasUnsavedChanges(true);
  }, []);

  const liveCount = useMemo(
    () => (Array.isArray(shots) ? shots.filter((s) => s && !s.isArchived) : []).length,
    [shots]
  );

  const basePack = useMemo(() => {
    void seed;
    return buildPromoPack({
      shots,
      projectTitle,
      templateId,
      aspectRatio
    });
  }, [shots, projectTitle, templateId, aspectRatio, seed]);

  // Sync editable draft when regenerated / template changes
  useEffect(() => {
    if (!isOpen) return;
    skipDirtyRef.current = true;
    const next = clonePromoPack(basePack);
    next.editMode = editMode;
    setDraft(next);
    setHasUnsavedChanges(false);
    setShowConfirmClosePopup(false);
    queueMicrotask(() => {
      skipDirtyRef.current = false;
    });
  }, [basePack, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDraft((prev) => (prev ? { ...prev, editMode } : prev));
  }, [editMode]);

  const pack = draft || basePack;
  const isManual = editMode === 'manual';

  const updateBeat = (index, patch) => {
    markDirty();
    setDraft((prev) => {
      if (!prev) return prev;
      const beats = (prev.beats || []).map((b, i) => (i === index ? { ...b, ...patch } : b));
      return { ...prev, beats };
    });
  };

  const updateCaption = (index, value) => {
    markDirty();
    setDraft((prev) => {
      if (!prev) return prev;
      const captions = [...(prev.captions || [])];
      captions[index] = value;
      return { ...prev, captions };
    });
  };

  const updatePromptField = (index, field, value) => {
    markDirty();
    setDraft((prev) => {
      if (!prev) return prev;
      const prompts = (prev.prompts || []).map((p, i) => (i === index ? { ...p, [field]: value } : p));
      return { ...prev, prompts };
    });
  };

  const handleAiEnhance = useCallback(() => {
    markDirty();
    setDraft((prev) => {
      if (!prev) return prev;
      return rebuildPromoMasterPrompts({ ...prev, editMode: 'ai' }, shots, aspectRatio);
    });
    setEditMode('ai');
    setEnhanceMsg('Master Cinema prompts refreshed');
    setTimeout(() => setEnhanceMsg(''), 2200);
  }, [shots, aspectRatio, markDirty]);

  const requestBrowserFullscreen = async () => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      if (!document.fullscreenElement) await req.call(el);
    } catch {
      /* ignore */
    }
  };

  const exitBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  };

  const enterFullscreen = useCallback(async () => {
    setFullscreen(true);
    await requestBrowserFullscreen();
  }, []);

  const exitFullscreenView = useCallback(async () => {
    setFullscreen(false);
    await exitBrowserFullscreen();
  }, []);

  const handleSave = useCallback(() => {
    const toSave = { ...(draft || basePack), editMode };
    const entry = savePromoPackLocal(toSave, { projectTitle });
    try {
      const slug = String(projectTitle || 'project')
        .replace(/[^\w\-]+/g, '_')
        .slice(0, 40);
      downloadTextFile(
        `${slug}_${toSave.template?.id || 'promo'}_saved.md`,
        promoPackToMarkdown(toSave),
        'text/markdown;charset=utf-8'
      );
    } catch {
      /* ignore */
    }
    setHasUnsavedChanges(false);
    setSaveMsg(entry ? `Saved ${entry.templateLabel} · ${entry.savedAtLabel}` : 'Saved');
    setTimeout(() => setSaveMsg(''), 2500);
    return entry;
  }, [draft, basePack, editMode, projectTitle]);

  const handleSaveAndClose = useCallback(async () => {
    handleSave();
    setShowConfirmClosePopup(false);
    await exitFullscreenView();
    onClose?.();
  }, [handleSave, exitFullscreenView, onClose]);

  const handleRequestClose = useCallback(async () => {
    if (fullscreen) {
      await exitFullscreenView();
      return;
    }
    if (hasUnsavedChanges) {
      setShowConfirmClosePopup(true);
      return;
    }
    onClose?.();
  }, [fullscreen, exitFullscreenView, hasUnsavedChanges, onClose]);

  const handleDiscardAndClose = useCallback(async () => {
    setShowConfirmClosePopup(false);
    setHasUnsavedChanges(false);
    await exitFullscreenView();
    onClose?.();
  }, [exitFullscreenView, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setFullscreen(false);
      setSaveMsg('');
      setEnhanceMsg('');
      setDraft(null);
      setHasUnsavedChanges(false);
      setShowConfirmClosePopup(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (isModKey(e) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (fullscreen) return;
        enterFullscreen();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showConfirmClosePopup) {
          setShowConfirmClosePopup(false);
          return;
        }
        if (fullscreen) {
          exitFullscreenView();
          return;
        }
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    isOpen,
    fullscreen,
    showConfirmClosePopup,
    enterFullscreen,
    exitFullscreenView,
    handleRequestClose
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onFs = () => {
      if (!document.fullscreenElement && fullscreen) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [isOpen, fullscreen]);

  if (!isOpen) return null;

  const handleCopyCaptions = async () => {
    const text = (pack.captions || []).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleCopyPrompt = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopiedPrompt(key);
      setTimeout(() => setCopiedPrompt(null), 1800);
    } catch {
      /* ignore */
    }
  };

  const slug = String(projectTitle || 'project')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40);

  const fieldClass =
    'w-full rounded-lg bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 px-2 py-1.5 focus:outline-none focus:border-amber-500/60 placeholder:text-zinc-600';

  const saveCloseBtnClass =
    'px-5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-amber-500 to-emerald-500 hover:brightness-110 text-zinc-950 text-xs font-black shadow-lg transition-all flex items-center gap-1.5 cursor-pointer border border-amber-300/40';

  return (
    <div
      className={`sps-promo-shell fixed inset-0 z-[88] flex items-center justify-center bg-black/80 backdrop-blur-sm ${
        fullscreen ? 'sps-promo-fs p-0' : 'p-3 sm:p-5'
      }`}
    >
      <div
        ref={panelRef}
        className={`sps-promo-panel force-dark bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden shadow-2xl border border-zinc-700 ${
          fullscreen
            ? 'sps-promo-fs w-screen h-screen max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-5xl h-[90vh] max-h-[920px] rounded-2xl'
        }`}
        data-force-dark="true"
      >
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/95 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-black uppercase tracking-wide text-amber-300 flex items-center gap-2">
              <Clapperboard className="w-4 h-4" />
              Promo Pack
              {fullscreen && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-400">
                  FULLSCREEN · Esc = normal
                </span>
              )}
            </h2>
            <p className="text-[11px] text-zinc-500 truncate">
              {projectTitle} · Trailer · Teaser · Reels from {liveCount} Matrix shots
              {saveMsg ? ` · ${saveMsg}` : ''}
              {enhanceMsg ? ` · ${enhanceMsg}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => (fullscreen ? exitFullscreenView() : enterFullscreen())}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 cursor-pointer"
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (⌘Enter)'}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className={saveCloseBtnClass}
              title="Save pack locally + download Markdown, then close"
            >
              <Save className="w-3.5 h-3.5 fill-zinc-950" />
              <span>Save & Close</span>
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              aria-label="Close"
              title={hasUnsavedChanges ? 'Close (asks to save if unsaved)' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-zinc-800 flex flex-wrap gap-1.5 shrink-0">
          {PROMO_TEMPLATES.map((t) => {
            const Icon = t.vertical ? Smartphone : Film;
            const active = templateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-zinc-950 border-amber-300'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                }`}
                title={t.blurb}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                <span className="opacity-70 font-mono">{formatClock(t.durationSec)}</span>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 border-b border-zinc-800 flex flex-wrap items-center gap-2 shrink-0 bg-zinc-950/80">
          <div className="flex items-center rounded-lg border border-zinc-700 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setEditMode('manual')}
              className={`px-2.5 py-1.5 text-[11px] font-black flex items-center gap-1.5 cursor-pointer ${
                isManual ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Edit cut list, captions, music, and Master Cinema prompts by hand"
            >
              <Pencil className="w-3.5 h-3.5" />
              Manual Edit
            </button>
            <button
              type="button"
              onClick={() => setEditMode('ai')}
              className={`px-2.5 py-1.5 text-[11px] font-black flex items-center gap-1.5 cursor-pointer border-l border-zinc-700 ${
                !isManual ? 'bg-violet-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
              title="View Compiler-style Master Cinema prompts (Script Synopsis → Prompt)"
            >
              <Wand2 className="w-3.5 h-3.5" />
              AI Enhanced
            </button>
          </div>
          <p className="text-[11px] text-zinc-400 flex-1 min-w-[10rem]">
            {pack.template?.blurb} · assembled{' '}
            <strong className="text-zinc-200">{formatClock(pack.assembledSec)}</strong> / target{' '}
            <strong className="text-amber-300">{formatClock(pack.targetSec)}</strong>
          </p>
          <button
            type="button"
            onClick={handleAiEnhance}
            className="px-2.5 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-xs font-bold border border-violet-400/40 flex items-center gap-1.5 cursor-pointer"
              title="Rebuild Compiler-framed Master Cinema prompts from Matrix crafts + current beats"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Enhance Prompts
          </button>
          <button
            type="button"
            onClick={() => setSeed((n) => n + 1)}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleCopyCaptions}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Captions
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                `${slug}_${pack.template.id}_cutlist.csv`,
                promoPackToCsv(pack),
                'text/csv;charset=utf-8'
              )
            }
            className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold border border-emerald-500/40 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                `${slug}_${pack.template.id}_promo.md`,
                promoPackToMarkdown({ ...pack, editMode }),
                'text/markdown;charset=utf-8'
              )
            }
            className="px-2.5 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold border border-cyan-500/40 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Full pack
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-200 text-xs font-bold border border-amber-800/50 flex items-center gap-1.5 cursor-pointer"
            title="Save to this device (keep Promo Pack open)"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>

        {liveCount === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-2">
              <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-black text-zinc-200">No Matrix shots yet</p>
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Sync the screenplay to the 25-Craft Matrix (or load a project with shots), then reopen Promo Pack to
                assemble Trailer / Teaser / Reels.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid lg:grid-cols-[1.15fr_0.85fr] overflow-hidden">
            <div className="overflow-y-auto border-r border-zinc-800 p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500 px-1">
                Cut list {isManual ? '· editable' : ''}
              </p>
              {(pack.beats || []).map((b, i) => (
                <div
                  key={`${b.sceneShotId}-${b.segmentId}-${i}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase text-amber-300">
                      {i + 1}. {b.segmentLabel}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {formatClock(b.startSec)}–{formatClock(b.endSec)} · {b.durationSec}s
                    </span>
                  </div>
                  {isManual ? (
                    <div className="space-y-1.5 mt-1">
                      <input
                        className={fieldClass}
                        value={b.sceneShotId || ''}
                        onChange={(e) => updateBeat(i, { sceneShotId: e.target.value })}
                        placeholder="Scene / Shot ID"
                      />
                      <textarea
                        className={`${fieldClass} min-h-[52px] resize-y`}
                        value={b.action || ''}
                        onChange={(e) => updateBeat(i, { action: e.target.value })}
                        placeholder="Action / environment"
                        rows={2}
                      />
                      <textarea
                        className={`${fieldClass} min-h-[40px] resize-y`}
                        value={b.dialogue || ''}
                        onChange={(e) => updateBeat(i, { dialogue: e.target.value })}
                        placeholder="Dialogue / VO"
                        rows={2}
                      />
                      <div className="flex gap-1.5">
                        <input
                          className={fieldClass}
                          value={b.composition || ''}
                          onChange={(e) => updateBeat(i, { composition: e.target.value })}
                          placeholder="Composition"
                        />
                        <input
                          className={fieldClass}
                          value={b.camera || ''}
                          onChange={(e) => updateBeat(i, { camera: e.target.value })}
                          placeholder="Camera"
                        />
                        <input
                          className={`${fieldClass} w-16 shrink-0`}
                          type="number"
                          min={1}
                          max={30}
                          value={b.durationSec || 4}
                          onChange={(e) =>
                            updateBeat(i, { durationSec: Math.max(1, Number(e.target.value) || 1) })
                          }
                          title="Duration (sec)"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[12px] font-bold text-cyan-300 font-mono">{b.sceneShotId}</p>
                      {b.action ? (
                        <p className="text-[11px] text-zinc-400 mt-1 leading-snug line-clamp-2">{b.action}</p>
                      ) : null}
                      {b.dialogue ? (
                        <p className="text-[11px] text-emerald-300/90 mt-1 italic line-clamp-2">“{b.dialogue}”</p>
                      ) : null}
                      {b.tags?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {b.tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="overflow-y-auto p-3 space-y-3">
              <CinematicReferencesPanel
                sectionId="promo"
                genreKey={
                  (typeof window !== 'undefined' && localStorage.getItem('sps_preset_profile')) ||
                  'mythological'
                }
                projectTitle={projectTitle}
                compact
              />

              <section className="rounded-xl border border-violet-500/50 bg-violet-950/30 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-[10px] font-black uppercase text-violet-300">
                    Master Cinema prompts ({(pack.prompts || []).length})
                  </h3>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-600/40 border border-violet-400/40 text-violet-100 uppercase tracking-wide">
                    Compiler format
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mb-2 leading-snug">
                  Script Synopsis · Scene Synopsis · Director Psychology · Character/World Bible · Character ID · Prompt — same frame as Stage Production Studio Compiler.
                </p>
                <div className="space-y-3 max-h-[36rem] overflow-y-auto pr-0.5">
                  {(pack.prompts || []).map((p, i) => (
                    <div
                      key={p.index}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-cyan-300">
                          {p.index}. {p.sceneShotId} · {p.segment}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyPrompt(p.masterCinemaPrompt || p.imagePrompt, p.index)
                          }
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPrompt === p.index ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copy
                        </button>
                      </div>
                      {isManual ? (
                        <textarea
                          className={`${fieldClass} min-h-[220px] font-mono text-[10px] leading-snug resize-y`}
                          value={p.masterCinemaPrompt || ''}
                          onChange={(e) => updatePromptField(i, 'masterCinemaPrompt', e.target.value)}
                          rows={14}
                        />
                      ) : (
                        <pre className="text-[9px] text-zinc-300 whitespace-pre-wrap leading-snug max-h-80 overflow-y-auto font-mono">
                          {p.masterCinemaPrompt || p.imagePrompt}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-2">
                  Captions / VO {isManual ? '· editable' : ''}
                </h3>
                {isManual ? (
                  <div className="space-y-1.5">
                    {(pack.captions || []).map((c, i) => (
                      <input
                        key={`cap-${i}`}
                        className={fieldClass}
                        value={c}
                        onChange={(e) => updateCaption(i, e.target.value)}
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {(pack.captions || []).map((c) => (
                      <li key={c} className="text-[12px] text-zinc-200 leading-snug">
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-2">
                  Music brief {isManual ? '· editable' : ''}
                </h3>
                {isManual ? (
                  <textarea
                    className={`${fieldClass} min-h-[72px] resize-y`}
                    value={pack.musicBrief || ''}
                    onChange={(e) => {
                      markDirty();
                      setDraft((prev) => (prev ? { ...prev, musicBrief: e.target.value } : prev));
                    }}
                    rows={3}
                  />
                ) : (
                  <p className="text-[12px] text-zinc-300 leading-relaxed">{pack.musicBrief}</p>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-2">Editor notes</h3>
                <ul className="space-y-1 list-disc list-inside">
                  {(pack.editorNotes || []).map((n) => (
                    <li key={n} className="text-[11px] text-zinc-400 leading-snug">
                      {n}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}

        {/* Bottom footer — same Save & Close pattern as Character Bible */}
        <div className="p-3 px-5 border-t border-zinc-800 bg-zinc-950/90 flex items-center justify-between shrink-0 font-mono text-xs">
          <div className="flex items-center gap-2 text-zinc-400 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                hasUnsavedChanges ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="truncate">
              Stage Production Studio · Promo Pack
              {hasUnsavedChanges ? ' · unsaved edits' : saveMsg ? ` · ${saveMsg}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold transition-all cursor-pointer"
            >
              Close
            </button>
            <button type="button" onClick={handleSaveAndClose} className={saveCloseBtnClass}>
              <Save className="w-3.5 h-3.5 fill-zinc-950" />
              <span>Save & Close</span>
            </button>
          </div>
        </div>
      </div>

      {showConfirmClosePopup && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
          <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-800">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white font-sans">Unsaved Promo Pack Changes</h4>
                <p className="text-xs text-zinc-400">You have unsaved cut-list, caption, or prompt edits.</p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              Save your Promo Pack locally (and download Markdown) before closing, or discard pending changes?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleDiscardAndClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition-all cursor-pointer"
              >
                Discard & Close
              </button>
              <button type="button" onClick={handleSaveAndClose} className={`w-full sm:w-auto ${saveCloseBtnClass}`}>
                <Save className="w-3.5 h-3.5 fill-zinc-950" />
                <span>Save & Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
