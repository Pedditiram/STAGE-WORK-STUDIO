import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Clapperboard, Download, RefreshCw, Film, Smartphone, Sparkles, Copy, Check,
  Maximize2, Minimize2, Pencil, Wand2, Archive,
} from 'lucide-react';
import HoverPinBar, { PinBarButton } from './HoverPinBar';
import { exportDownloadText, assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import {
  PROMO_TEMPLATES,
  buildPromoPack,
  clonePromoPack,
  formatClock,
  promoPackToMarkdown,
  promoPackToCsv,
  promoPackToPrintHtml,
  buildPromoPackZipFiles,
  rebuildPromoMasterPrompts,
  savePromoPackLocal,
  auditPromoBeatExclusions
} from '../utils/promoPack';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';

function isModKey(e) {
  return e.metaKey || e.ctrlKey;
}

/**
 * Promo Pack — Trailer / Teaser / Reels. Studio room (same pattern as Matrix / Writer).
 */
export default function PromoPackModal({
  isOpen,
  onClose,
  asRoom = false,
  shots = [],
  projectTitle = 'Project',
  aspectRatio = '2.39:1',
  genreKey = '',
  lookOnly = false
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
  const [minimized, setMinimized] = useState(false);
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem('sps_pin_promo_pack') !== 'false';
    } catch {
      return true;
    }
  });
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

  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: promoLifecycleStrict,
    mode: promoLifecycleMode
  } = useExportLifecyclePref('promo');
  const exportBlocked = promoLifecycleStrict && !exportLife.exportReady;

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
    queueMicrotask(() => {
      skipDirtyRef.current = false;
    });
  }, [basePack, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDraft((prev) => (prev ? { ...prev, editMode } : prev));
  }, [editMode]);

  const pack = draft || basePack;
  const isManual = editMode === 'manual';

  const updateSlide = (index, patch) => {
    markDirty();
    setDraft((prev) => {
      if (!prev) return prev;
      const nextSlides = (prev.slides || []).map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...prev, slides: nextSlides };
    });
  };

  const updateSlidePoint = (slideI, pointI, value) => {
    markDirty();
    setDraft((prev) => {
      if (!prev) return prev;
      const nextSlides = (prev.slides || []).map((s, i) => {
        if (i !== slideI) return s;
        const points = [...(s.points || [])];
        points[pointI] = value;
        return { ...s, points };
      });
      return { ...prev, slides: nextSlides };
    });
  };

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
      if (!prev || prev.template?.kind === 'deck') return prev;
      return rebuildPromoMasterPrompts({ ...prev, editMode: 'ai' }, shots, aspectRatio);
    });
    setEditMode('ai');
    setEnhanceMsg('Prompts refreshed');
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

  const persistPack = useCallback(() => {
    const toSave = { ...(draft || basePack), editMode };
    const entry = savePromoPackLocal(toSave, { projectTitle });
    setHasUnsavedChanges(false);
    setSaveMsg(entry ? `Saved ${entry.templateLabel}` : 'Saved');
    setTimeout(() => setSaveMsg(''), 2500);
    return entry;
  }, [draft, basePack, editMode, projectTitle]);

  useEffect(() => {
    if (!isOpen || lookOnly || !hasUnsavedChanges) return undefined;
    const t = window.setTimeout(() => persistPack(), 800);
    return () => window.clearTimeout(t);
  }, [isOpen, lookOnly, hasUnsavedChanges, persistPack]);

  const handleRequestClose = useCallback(async () => {
    persistPack();
    if (fullscreen) {
      await exitFullscreenView();
      return;
    }
    onClose?.();
  }, [persistPack, fullscreen, exitFullscreenView, onClose]);

  useEffect(() => {
    try {
      localStorage.setItem('sps_pin_promo_pack', pinned ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [pinned]);

  useEffect(() => {
    if (!isOpen) {
      setFullscreen(false);
      setMinimized(false);
      setSaveMsg('');
      setEnhanceMsg('');
      setDraft(null);
      setHasUnsavedChanges(false);
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
        if (document.querySelector('.sps-pitch-present')) return;
        e.preventDefault();
        e.stopPropagation();
        if (fullscreen) {
          exitFullscreenView();
          return;
        }
        if (asRoom) return;
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    isOpen,
    fullscreen,
    enterFullscreen,
    exitFullscreenView,
    draft,
    basePack,
    handleRequestClose,
    asRoom
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onFs = () => {
      if (!document.fullscreenElement && fullscreen) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [isOpen, fullscreen]);

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
    .replace(/[^\w-]+/g, '_')
    .slice(0, 40);
  const roomId = resolveCollabRoomId();
  const lifeNote = `${pack.template?.id || 'promo'} · ${isManual ? 'manual' : 'auto'} · ${
    pack.template?.kind === 'deck' ? `${(pack.slides || []).length} slides` : `${(pack.beats || []).length} beats`
  }${roomId ? ` · room ${roomId}` : ''}`;

  const handleExportPdf = useCallback(() => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'promo_pack_pdf',
        format: 'pdf',
        lifecycleMode: promoLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'promo_pack_pdf',
      format: 'pdf',
      lifecycleMode: promoLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(promoPackToPrintHtml({ ...pack, editMode }, { editMode: isManual, roomId }));
    printWindow.document.close();
    logExportSuccess({
      projectTitle,
      label: 'promo_pack_pdf',
      format: 'pdf',
      filename: `${slug}_${pack.template?.id || 'promo'}.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${promoLifecycleMode}+ok` : promoLifecycleMode
    });
  }, [projectTitle, promoLifecycleMode, shots, pack, editMode, isManual, slug, exportBlocked, roomId, lifeNote]);

  const handleExportZip = useCallback(async () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'promo_pack_zip',
        format: 'zip',
        lifecycleMode: promoLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'promo_pack_zip',
      format: 'zip',
      lifecycleMode: promoLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    auditPromoBeatExclusions({
      shots,
      projectTitle,
      templateId: pack?.template?.id || templateId
    });
    const files = buildPromoPackZipFiles(pack, { editMode: isManual, roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_${pack.template?.id || 'promo'}_promo.zip`, {
      projectTitle,
      shots,
      lifecycleMode: promoLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'promo_pack_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
  }, [projectTitle, promoLifecycleMode, shots, pack, isManual, slug, exportBlocked, roomId, lifeNote, templateId]);

  const fieldClass =
    'w-full rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[11px] text-[var(--sps-text)] px-2 py-1.5 focus:outline-none focus:border-[var(--sps-gold)] placeholder:text-[var(--sps-muted)]';

  if (!asRoom && !isOpen) return null;

  if (minimized && !asRoom) {
    return (
      <div className="sps-overlay is-docked" style={{ zIndex: 88 }}>
        <div className="sps-promo-dock">
          <PinBarButton
            pinned={pinned}
            onToggle={() => setPinned((v) => !v)}
            label="Promo Pack"
          />
          <button
            type="button"
            className="sps-btn sps-btn-primary text-[11px]"
            onClick={() => setMinimized(false)}
            title="Restore Promo Pack"
          >
            <Clapperboard className="w-3.5 h-3.5" />
            Promo Pack
          </button>
          <span className="text-[10px] text-[var(--sps-muted)] truncate max-w-[9rem]">
            {projectTitle}
          </span>
          <button
            type="button"
            className="sps-icon-btn"
            onClick={handleRequestClose}
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const roomChrome = (
        <HoverPinBar
          storageKey="sps_pin_promo_bar"
          defaultPinned
          pinLabel="Promo bar"
          ariaLabel="Show Promo toolbar"
          className="shrink-0 z-20"
          barClassName="px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2 m-0" style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}>
              <Clapperboard className="w-4 h-4" />
              Promo Pack
              {fullscreen && (
                <span className="sps-chip text-[9px]">
                  FULLSCREEN · Esc = normal
                </span>
              )}
            </h2>
            <p className="text-[11px] text-[var(--sps-muted)] truncate">
              Trailer · Teaser · Reels · {projectTitle}
              {saveMsg ? ` · ${saveMsg}` : ''}
              {enhanceMsg ? ` · ${enhanceMsg}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => (fullscreen ? exitFullscreenView() : enterFullscreen())}
              className="sps-icon-btn"
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (⌘Enter)'}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            {!asRoom ? (
              <>
            <button
              type="button"
              onClick={() => {
                exitFullscreenView();
                setMinimized(true);
              }}
              className="sps-icon-btn"
              title="Minimize to dock"
              aria-label="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="sps-icon-btn"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
              </>
            ) : null}
          </div>
        </HoverPinBar>
  );

  const inner = (
      <>
        {asRoom ? roomChrome : (
        <div className="px-4 py-3 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2 m-0" style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}>
              <Clapperboard className="w-4 h-4" />
              Promo Pack
            </h2>
          </div>
        </div>
        )}

        <div className="px-3 py-2 border-b border-[var(--sps-border)] flex flex-wrap gap-1.5 shrink-0 bg-[var(--sps-bg)]">
          {PROMO_TEMPLATES.map((t) => {
            const Icon = t.vertical ? Smartphone : Film;
            const active = templateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={`sps-btn text-[11px] ${active ? 'sps-btn-primary' : ''}`}
                title={t.blurb}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                <span className="opacity-70 font-mono">{formatClock(t.durationSec)}</span>
              </button>
            );
          })}
        </div>

        <>
        <div className="px-4 py-2 border-b border-[var(--sps-border)] flex flex-wrap items-center gap-2 shrink-0 bg-[var(--sps-bg-elevated)]">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditMode('manual')}
              className={`sps-btn text-[11px] ${isManual ? 'sps-btn-primary' : ''}`}
              title="Edit cut list, captions, music, and prompts by hand"
            >
              <Pencil className="w-3.5 h-3.5" />
              Manual Edit
            </button>
            <button
              type="button"
              onClick={() => setEditMode('ai')}
              className={`sps-btn text-[11px] ${!isManual ? 'sps-btn-primary' : ''}`}
              title="View video prompts"
            >
              <Wand2 className="w-3.5 h-3.5" />
              AI Enhanced
            </button>
          </div>
          <p className="text-[11px] text-[var(--sps-muted)] flex-1 min-w-[10rem]">
            {pack.template?.blurb}
            {' '}· assembled{' '}
            <strong className="text-[var(--sps-text)]">{formatClock(pack.assembledSec)}</strong> / target{' '}
            <strong className="text-[var(--sps-gold)]">{formatClock(pack.targetSec)}</strong>
          </p>
          <button
            type="button"
            onClick={handleAiEnhance}
            className="sps-btn sps-btn-primary"
            title="Rebuild prompts from Matrix crafts + current beats"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Enhance Prompts
          </button>
          <button type="button" onClick={() => setSeed((n) => n + 1)} className="sps-btn">
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
          <button type="button" onClick={handleCopyCaptions} className="sps-btn">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Captions
          </button>
          <button
            type="button"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export promo cutlist CSV'}
            onClick={() => {
              auditPromoBeatExclusions({
                shots,
                projectTitle,
                templateId: pack?.template?.id || templateId
              });
              exportDownloadText(`${slug}_${pack.template.id}_cutlist.csv`, promoPackToCsv(pack), {
                projectTitle,
                auditLabel: 'promo_cutlist_csv',
                auditFormat: 'csv',
                mime: 'text/csv;charset=utf-8',
                lifecycleMode: promoLifecycleMode,
                shots,
                roomId,
                note: lifeNote
              });
            }}
            className="sps-btn disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export full promo pack'}
            onClick={() =>
              exportDownloadText(
                `${slug}_${pack.template.id}_promo.md`,
                promoPackToMarkdown({ ...pack, editMode }),
                {
                  projectTitle,
                  auditLabel: 'promo_pack_md',
                  auditFormat: 'md',
                  mime: 'text/markdown;charset=utf-8',
                  lifecycleMode: promoLifecycleMode,
                  shots,
                  roomId,
                  note: lifeNote
                }
              )
            }
            className="sps-btn disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Full pack
          </button>
          <button
            type="button"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Print promo pack PDF'}
            onClick={handleExportPdf}
            className="sps-btn disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export promo pack ZIP (README + CSV + META)'}
            onClick={handleExportZip}
            className="sps-btn disabled:opacity-40"
          >
            <Archive className="w-3.5 h-3.5" />
            ZIP
          </button>
          {exportBlocked ? (
            <span className="text-[10px] text-[var(--sps-gold)] max-w-[14rem] leading-snug">
              {exportLife.message}
            </span>
          ) : null}
        </div>

        {liveCount === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center sps-atelier-pane">
            <div className="max-w-md space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-[var(--sps-gold)]" />
              <p className="text-sm font-semibold text-[var(--sps-text)]">No Matrix shots yet</p>
              <p className="text-[12px] text-[var(--sps-muted)] leading-relaxed">
                Add shots in Matrix or Form, then reopen Promo Pack.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid lg:grid-cols-[1.15fr_0.85fr] overflow-hidden">
            <div className="overflow-y-auto border-r border-[var(--sps-border)] p-3 space-y-2 sps-atelier-pane">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] px-1">
                {pack.template?.kind === 'deck' ? 'Pitch slides' : 'Cut list'}{' '}
                {isManual ? '· editable' : ''}
              </p>
              {pack.template?.kind === 'deck' && pack.pitchLogline ? (
                <div className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] bg-[var(--sps-surface)] p-3">
                  <span className="text-[10px] font-bold uppercase text-[var(--sps-gold)]">Logline</span>
                  <p className="text-[12px] leading-relaxed mt-1" style={{ color: 'var(--sps-text)' }}>{pack.pitchLogline}</p>
                </div>
              ) : null}
              {(pack.beats || []).map((b, i) => (
                <div
                  key={`${b.sceneShotId}-${b.segmentId}-${i}`}
                  className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] bg-[var(--sps-surface)] p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase text-[var(--sps-gold)]">
                      {i + 1}. {b.segmentLabel}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--sps-muted)]">
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
                      <p className="text-[12px] font-bold font-mono text-[var(--sps-text)]">{b.sceneShotId}</p>
                      {b.action ? (
                        <p className="text-[11px] text-[var(--sps-muted)] mt-1 leading-snug line-clamp-2">{b.action}</p>
                      ) : null}
                      {b.dialogue ? (
                        <p className="text-[11px] mt-1 italic line-clamp-2 text-[var(--sps-text)]">“{b.dialogue}”</p>
                      ) : null}
                      {b.tags?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {b.tags.slice(0, 5).map((tag) => (
                            <span key={tag} className="sps-chip text-[9px]">
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

            <div className="overflow-y-auto p-3 space-y-3 sps-atelier-pane">
              <section className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] bg-[var(--sps-surface)] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-[10px] font-bold uppercase text-[var(--sps-muted)] m-0">
                    Video prompts ({(pack.prompts || []).length})
                  </h3>
                  <span className="sps-chip text-[9px] uppercase tracking-wide">
                    Video
                  </span>
                </div>
                <p className="text-[10px] text-[var(--sps-muted)] mb-2 leading-snug">
                  Subject + Action + Scene + Style + Camera + Audio.
                </p>
                <div className="space-y-3 max-h-[36rem] overflow-y-auto pr-0.5">
                  {(pack.prompts || []).map((p, i) => (
                    <div
                      key={p.index}
                      className="rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-bg)] p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-[var(--sps-text)] m-0">
                          {p.index}. {p.sceneShotId} · {p.segment}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyPrompt(p.masterCinemaPrompt || p.imagePrompt, p.index)
                          }
                          className="sps-btn text-[10px]"
                        >
                          {copiedPrompt === p.index ? (
                            <Check className="w-3 h-3" />
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
                        <pre className="text-[9px] text-[var(--sps-text)] whitespace-pre-wrap leading-snug max-h-80 overflow-y-auto font-mono m-0">
                          {p.masterCinemaPrompt || p.imagePrompt}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] bg-[var(--sps-surface)] p-3">
                <h3 className="text-[10px] font-bold uppercase text-[var(--sps-muted)] mb-2">
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
                      <li key={c} className="text-[12px] text-[var(--sps-text)] leading-snug">
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] bg-[var(--sps-surface)] p-3">
                <h3 className="text-[10px] font-bold uppercase text-[var(--sps-muted)] mb-2">
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
                  <p className="text-[12px] text-[var(--sps-text)] leading-relaxed">{pack.musicBrief}</p>
                )}
              </section>

              <section className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] bg-[var(--sps-surface)] p-3">
                <h3 className="text-[10px] font-bold uppercase text-[var(--sps-muted)] mb-2">Editor notes</h3>
                <ul className="space-y-1 list-disc list-inside">
                  {(pack.editorNotes || []).map((n) => (
                    <li key={n} className="text-[11px] text-[var(--sps-muted)] leading-snug">
                      {n}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
        </>

        {asRoom ? (
        <div className="py-1.5 px-4 border-t border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center shrink-0 text-xs text-[var(--sps-muted)]">
          <span className={`w-2 h-2 rounded-full shrink-0 mr-2 ${hasUnsavedChanges ? 'bg-[var(--sps-gold)] animate-pulse' : ''}`} style={!hasUnsavedChanges ? { background: '#3d6b4a' } : undefined} />
          {hasUnsavedChanges ? 'Saving…' : saveMsg || 'Saved'}
        </div>
        ) : (
        <div className="py-1.5 px-4 border-t border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 text-[var(--sps-muted)] min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${hasUnsavedChanges ? 'bg-[var(--sps-gold)] animate-pulse' : ''}`} style={!hasUnsavedChanges ? { background: '#3d6b4a' } : undefined} />
            <span className="truncate">{hasUnsavedChanges ? 'Saving…' : saveMsg || 'Saved'}</span>
          </div>
          <button type="button" onClick={handleRequestClose} className="sps-btn">Close</button>
        </div>
        )}
      </>
  );

  if (asRoom) {
    return (
      <div ref={panelRef} className={`flex flex-col h-full min-h-0 overflow-hidden sps-atelier-room ${fullscreen ? 'sps-fs-console' : ''}`}>
        {inner}
      </div>
    );
  }

  return (
    <div className={`sps-overlay ${fullscreen ? 'is-full' : ''}`} style={{ zIndex: 88 }}>
      <div ref={panelRef} className="sps-shell sps-atelier-room">
        {inner}
      </div>
    </div>
  );
}
