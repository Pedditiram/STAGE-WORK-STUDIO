import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, RefreshCw, ClipboardCheck,
  FileSpreadsheet, FileText, Pencil, Wand2, Presentation, Plus, Trash2, Maximize2, Minimize2, Download, Archive
} from 'lucide-react';
import HoverPinBar from './HoverPinBar';
import { buildPitchDocx, buildPitchPptx, downloadBinary, pitchDeckToPrintHtml } from '../utils/pitchDeckExport';
import { assertExportAllowed, logExportSuccess, resolveCollabRoomId, exportDownloadText } from '../utils/exportGate';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import {
  PITCH_AUDIENCES,
  PITCH_SIZES,
  blankPitchSlide,
  buildInvestorPitchDeck,
  buildPitchDeckZipFiles,
  clonePitchSlides,
  collectPitchFacts,
  generateLoglineOptions,
  normalizeFundSplit,
  pitchDeckToCsv,
  pitchDeckToMarkdown,
  qualityChecklist,
  savePitchDeckLocal,
  scorePitchDeck,
  themeTokens,
  logPitchBeatExclusions,
  collectPitchBeatExclusions
} from '../utils/pitchDeckMaker';
import { openMatrixLifecycleFilter } from '../utils/productionLifecycle';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const fieldClass =
  'rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[11px] text-[var(--sps-text)] px-2 py-1 focus:outline-none focus:border-[var(--sps-gold)]';
const formFieldClass = `w-full ${fieldClass} py-1.5`;

export default function PitchDeckMaker({
  shots = [],
  projectTitle = 'Untitled Feature',
  aspectRatio = '2.39:1',
  genreKey = '',
  onDirty,
  lookOnly = false,
  onToggleFullscreen,
  fullscreen = false
}) {
  const [audienceId, setAudienceId] = useState('investor');
  const [sizeId, setSizeId] = useState('standard');
  const [loglineId, setLoglineId] = useState('a');
  const [slideIndex, setSlideIndex] = useState(0);
  const [showCheck, setShowCheck] = useState(false);
  const [fundSplit, setFundSplit] = useState(null);
  const [budgetAsk, setBudgetAsk] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [rebuild, setRebuild] = useState(0);
  const [placements, setPlacements] = useState({});
  const [deckMode, setDeckMode] = useState('project');
  const [manualSlides, setManualSlides] = useState([]);
  const [presenting, setPresenting] = useState(false);

  const facts = useMemo(() => {
    void rebuild;
    const base = collectPitchFacts({ shots, projectTitle, aspectRatio, genreKey });
    if (budgetAsk.trim()) {
      base.investmentAsk = { value: budgetAsk.trim(), status: 'ASSUMPTION' };
      base.budgetTotal = { value: budgetAsk.trim(), status: 'ASSUMPTION' };
    }
    return base;
  }, [shots, projectTitle, aspectRatio, genreKey, rebuild, budgetAsk]);

  const excludedBeatCount = useMemo(() => collectPitchBeatExclusions(shots).length, [shots]);

  const loglines = useMemo(() => generateLoglineOptions(facts), [facts]);
  const loglineText = (loglines.find((l) => l.id === loglineId) || loglines[0])?.text || '';

  const deck = useMemo(
    () =>
      buildInvestorPitchDeck({
        facts,
        audienceId,
        sizeId,
        loglineText,
        fundSplit: fundSplit || facts.fundSplit
      }),
    [facts, audienceId, sizeId, loglineText, fundSplit]
  );

  const autoSlides = deck.slides || [];
  const slides = deckMode === 'manual' && manualSlides.length ? manualSlides : autoSlides;
  const current = slides[slideIndex] || slides[0];
  const tokens = themeTokens(deck.theme);
  const scores = useMemo(() => scorePitchDeck({ ...deck, slides }), [deck, slides]);
  const checks = useMemo(() => qualityChecklist({ ...deck, slides }), [deck, slides]);
  const splitNorm = normalizeFundSplit(fundSplit || facts.fundSplit);
  const exportDeck = { ...deck, slides };
  const isManual = deckMode === 'manual';
  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: pitchLifecycleStrict,
    mode: pitchLifecycleMode
  } = useExportLifecyclePref('pitch');
  const exportBlocked = pitchLifecycleStrict && !exportLife.exportReady;

  useEffect(() => {
    setSlideIndex(0);
  }, [audienceId, sizeId]);

  const mark = () => onDirty?.();

  const updatePct = (id, pct) => {
    if (lookOnly) return;
    mark();
    setFundSplit((prev) => {
      const base = (prev || facts.fundSplit).map((r) =>
        r.id === id ? { ...r, pct: Math.max(0, Math.min(100, Number(pct) || 0)) } : r
      );
      return base;
    });
  };

  const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const roomId = resolveCollabRoomId();
  const lifeNote = `${slides.length} slides · ${audienceId}/${sizeId} · ${isManual ? 'manual' : 'auto'}${roomId ? ` · room:${roomId}` : ''}`;

  useEffect(() => {
    if (lookOnly) return undefined;
    const t = window.setTimeout(() => {
      savePitchDeckLocal({ ...deck, slides }, projectTitle);
    }, 500);
    return () => window.clearTimeout(t);
  }, [lookOnly, projectTitle, deck, slides]);

  const placeImage = async (key, file) => {
    if (lookOnly || !file || !file.type.startsWith('image/')) return;
    mark();
    const src = await readImageFile(file);
    setPlacements((prev) => ({ ...prev, [key]: src }));
  };

  const exportKeynote = () => {
    const filename = `${slug}_pitch.keynote.pptx`;
    const gate = assertExportAllowed({
      projectTitle,
      label: 'pitch_deck_keynote',
      format: 'pptx',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const bytes = buildPitchPptx(exportDeck, placements);
    downloadBinary(filename, bytes, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    logExportSuccess({
      projectTitle,
      label: 'pitch_deck_keynote',
      format: 'pptx',
      filename,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${pitchLifecycleMode}+ok` : pitchLifecycleMode
    });
    setSaveMsg('Exported for Keynote (.pptx)');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportPages = () => {
    const filename = `${slug}_pitch.pages.docx`;
    const gate = assertExportAllowed({
      projectTitle,
      label: 'pitch_deck_pages',
      format: 'docx',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const bytes = buildPitchDocx(exportDeck, placements);
    downloadBinary(filename, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    logExportSuccess({
      projectTitle,
      label: 'pitch_deck_pages',
      format: 'docx',
      filename,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${pitchLifecycleMode}+ok` : pitchLifecycleMode
    });
    setSaveMsg('Exported for Pages (.docx)');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportPrintPdf = () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'pitch_deck_pdf',
        format: 'pdf',
        lifecycleMode: pitchLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'pitch_deck_pdf',
      format: 'pdf',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    const audience = PITCH_AUDIENCES.find((a) => a.id === audienceId);
    const size = PITCH_SIZES.find((s) => s.id === sizeId);
    printWindow.document.write(
      pitchDeckToPrintHtml(
        {
          ...exportDeck,
          audienceId,
          audienceLabel: audience?.label || audienceId,
          sizeId,
          sizeLabel: size?.label || sizeId
        },
        { projectTitle, roomId }
      )
    );
    printWindow.document.close();
    logExportSuccess({
      projectTitle,
      label: 'pitch_deck_pdf',
      format: 'pdf',
      filename: `${slug}_pitch.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${pitchLifecycleMode}+ok` : pitchLifecycleMode
    });
    setSaveMsg('Print deck opened — save as PDF');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportMarkdown = () => {
    logPitchBeatExclusions(shots, { projectTitle });
    exportDownloadText(`${slug}_pitch.md`, pitchDeckToMarkdown(exportDeck), {
      projectTitle,
      auditLabel: 'pitch_deck_md',
      auditFormat: 'md',
      mime: 'text/markdown;charset=utf-8',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId,
      note: lifeNote
    });
    setSaveMsg('Markdown outline exported');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportCsv = () => {
    logPitchBeatExclusions(shots, { projectTitle });
    exportDownloadText(`${slug}_pitch.csv`, pitchDeckToCsv(exportDeck), {
      projectTitle,
      auditLabel: 'pitch_deck_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId,
      note: lifeNote
    });
    setSaveMsg('Slide CSV exported');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportZip = async () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'pitch_deck_zip',
        format: 'zip',
        lifecycleMode: pitchLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'pitch_deck_zip',
      format: 'zip',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    logPitchBeatExclusions(shots, { projectTitle });
    const files = buildPitchDeckZipFiles(exportDeck, { roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_pitch.zip`, {
      projectTitle,
      shots,
      lifecycleMode: pitchLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'pitch_deck_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
    setSaveMsg('Pitch ZIP exported');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const enterManual = () => {
    mark();
    setManualSlides(clonePitchSlides(autoSlides.length ? autoSlides : [blankPitchSlide(1)]));
    setDeckMode('manual');
  };

  const patchSlide = (index, patch) => {
    if (lookOnly) return;
    mark();
    setManualSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const patchPoint = (index, pointI, value) => {
    if (lookOnly) return;
    mark();
    setManualSlides((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const points = [...(s.points || [])];
        points[pointI] = value;
        return { ...s, points };
      })
    );
  };

  const addPoint = (index) => {
    if (lookOnly) return;
    mark();
    setManualSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, points: [...(s.points || []), ''] } : s))
    );
  };

  const addSlide = () => {
    if (lookOnly) return;
    mark();
    setManualSlides((prev) => {
      const next = [...prev, blankPitchSlide(prev.length + 1)];
      setSlideIndex(next.length - 1);
      return next;
    });
  };

  const removeSlide = (index) => {
    if (lookOnly || slides.length <= 1) return;
    mark();
    setManualSlides((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setSlideIndex((n) => Math.min(n, next.length - 1));
      return next;
    });
  };

  useEffect(() => {
    if (!presenting) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setPresenting(false);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        setSlideIndex((n) => Math.max(0, n - 1));
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setSlideIndex((n) => Math.min(slides.length - 1, n + 1));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [presenting, slides.length]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <HoverPinBar
        storageKey="sps_pin_pitch_tools_v2"
        defaultPinned={false}
        pinLabel="Pitch tools"
        ariaLabel="Show pitch tools"
        wrap={false}
        className="z-20 shrink-0"
        barClassName="px-1.5 py-0.5 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] gap-0.5"
      >
        <button
          type="button"
          className="sps-icon-btn shrink-0"
          disabled={slideIndex <= 0}
          onClick={() => setSlideIndex((n) => Math.max(0, n - 1))}
          title="Previous slide"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] tabular-nums text-[var(--sps-muted)] whitespace-nowrap shrink-0 w-10 text-center">
          {slides.length ? slideIndex + 1 : 0}/{slides.length}
        </span>
        <button
          type="button"
          className="sps-icon-btn shrink-0"
          disabled={slideIndex >= slides.length - 1}
          onClick={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}
          title="Next slide"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <select
          className={`${fieldClass} w-[6.25rem] shrink-0`}
          value={audienceId}
          disabled={lookOnly}
          title="Who are you presenting to?"
          onChange={(e) => {
            mark();
            setAudienceId(e.target.value);
          }}
        >
          {PITCH_AUDIENCES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} w-[6.5rem] shrink-0`}
          value={sizeId}
          disabled={lookOnly}
          title="Deck length"
          onChange={(e) => {
            mark();
            setSizeId(e.target.value);
          }}
        >
          {PITCH_SIZES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} w-[11rem] shrink-0`}
          value={loglineId}
          disabled={lookOnly}
          title="Approved logline"
          onChange={(e) => {
            mark();
            setLoglineId(e.target.value);
          }}
        >
          {loglines.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.text.slice(0, 72)}{opt.text.length > 72 ? '…' : ''}
            </option>
          ))}
        </select>
        <input
          className={`${fieldClass} w-[5.5rem] shrink-0`}
          placeholder="Ask / ₹"
          title="Ask / budget (assumption)"
          value={budgetAsk}
          disabled={lookOnly}
          onChange={(e) => {
            mark();
            setBudgetAsk(e.target.value);
          }}
        />
        <button
          type="button"
          className={`sps-icon-btn shrink-0 ${!isManual ? 'is-on' : ''}`}
          onClick={() => setDeckMode('project')}
          title="From project"
        >
          <Wand2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className={`sps-icon-btn shrink-0 ${isManual ? 'is-on' : ''}`}
          onClick={enterManual}
          disabled={lookOnly}
          title="Manual slides"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="sps-icon-btn shrink-0" onClick={() => setRebuild((n) => n + 1)} title="Rebuild from project">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        {excludedBeatCount > 0 ? (
          <button
            type="button"
            className="text-[9px] font-mono text-[var(--sps-gold)] whitespace-nowrap shrink-0 px-1.5 hover:underline"
            title="Open Matrix filtered to draft/review shots that need approve"
            onClick={() =>
              openMatrixLifecycleFilter({
                statuses: ['draft', 'review'],
                id: 'needs_approve',
                source: 'pitch_excluded'
              })
            }
          >
            {excludedBeatCount} beat{excludedBeatCount === 1 ? '' : 's'} excluded → Matrix
          </button>
        ) : (
          <span className="text-[9px] font-mono text-[var(--sps-muted)] whitespace-nowrap shrink-0 px-1.5">
            {facts.liveShotCount || 0} approved
          </span>
        )}
        <button
          type="button"
          className="sps-icon-btn is-on shrink-0"
          onClick={() => setPresenting(true)}
          title="Present — arrows, Esc exits"
        >
          <Presentation className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="sps-icon-btn shrink-0" onClick={() => setShowCheck((v) => !v)} title="Quality">
          <ClipboardCheck className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="sps-icon-btn shrink-0 disabled:opacity-40"
          onClick={exportKeynote}
          disabled={lookOnly || exportBlocked}
          title={exportBlocked ? exportLife.message : 'Keynote (.pptx)'}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="sps-icon-btn shrink-0 disabled:opacity-40"
          onClick={exportPages}
          disabled={lookOnly || exportBlocked}
          title={exportBlocked ? exportLife.message : 'Pages (.docx)'}
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="sps-icon-btn shrink-0 disabled:opacity-40"
          onClick={exportPrintPdf}
          disabled={lookOnly || exportBlocked}
          title={exportBlocked ? exportLife.message : 'Print pitch PDF'}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="sps-icon-btn shrink-0 disabled:opacity-40"
          onClick={exportMarkdown}
          disabled={lookOnly || exportBlocked}
          title={exportBlocked ? exportLife.message : 'Export pitch markdown'}
        >
          <FileText className="w-3.5 h-3.5 opacity-70" />
        </button>
        <button
          type="button"
          className="sps-icon-btn shrink-0 disabled:opacity-40"
          onClick={exportCsv}
          disabled={lookOnly || exportBlocked}
          title={exportBlocked ? exportLife.message : 'Export pitch CSV'}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 opacity-70" />
        </button>
        <button
          type="button"
          className="sps-icon-btn shrink-0 disabled:opacity-40"
          onClick={exportZip}
          disabled={lookOnly || exportBlocked}
          title={exportBlocked ? exportLife.message : 'Download pitch ZIP (README + slides CSV)'}
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
        {exportBlocked ? (
          <span className="text-[10px] text-[var(--sps-gold)] max-w-[14rem] leading-snug shrink-0 hidden xl:inline">
            {exportLife.message}
          </span>
        ) : null}
        {typeof onToggleFullscreen === 'function' ? (
          <button type="button" className="sps-icon-btn shrink-0" onClick={onToggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        ) : null}
        {saveMsg ? <span className="text-[10px] text-[var(--sps-gold)] whitespace-nowrap shrink-0">{saveMsg}</span> : null}
      </HoverPinBar>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[12.5rem_1fr_15rem] overflow-hidden">
        <nav className="overflow-y-auto border-r border-[var(--sps-border)] p-2 sps-atelier-pane">
          {slides.map((slide, i) => (
            <button
              key={`${slide.id}-${i}`}
              type="button"
              onClick={() => setSlideIndex(i)}
              className={`w-full text-left rounded-[var(--sps-radius-sm)] px-2 py-2 mb-1 border ${
                i === slideIndex
                  ? 'border-[var(--sps-gold)] bg-[var(--sps-surface)]'
                  : 'border-transparent hover:bg-[var(--sps-surface)]'
              }`}
            >
              <span className="block text-[9px] uppercase tracking-wide text-[var(--sps-gold)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="block text-[12px] font-semibold text-[var(--sps-text)] leading-snug">{slide.title}</span>
            </button>
          ))}
          {isManual && !lookOnly ? (
            <button type="button" className="sps-btn w-full mt-1" onClick={addSlide}>
              <Plus className="w-3.5 h-3.5" />
              Add slide
            </button>
          ) : null}
        </nav>

        <div className="min-h-0 overflow-y-auto p-4 md:p-8 flex flex-col items-center gap-3 sps-atelier-pane">
          {current ? (
            <article
              className="w-full max-w-[46rem] min-h-[30rem] rounded-[4px] border border-[var(--sps-border)] px-8 py-10 md:px-12 md:py-12 flex flex-col"
              style={{
                background:
                  current.kind === 'cover'
                    ? tokens.paper
                    : 'var(--sps-surface)',
                boxShadow: 'var(--sps-shadow-lift)'
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sps-gold)] m-0">
                {isManual ? (
                  <input
                    className={`${formFieldClass} font-bold uppercase tracking-[0.18em]`}
                    value={current.kicker || ''}
                    onChange={(e) => patchSlide(slideIndex, { kicker: e.target.value })}
                  />
                ) : (
                  current.kicker
                )}
              </p>
              {isManual ? (
                <input
                  className={`${formFieldClass} text-[1.4rem] font-semibold mt-4 mb-3`}
                  style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}
                  value={current.title || ''}
                  onChange={(e) => patchSlide(slideIndex, { title: e.target.value })}
                />
              ) : (
                <h3
                  className="text-[1.7rem] md:text-[2rem] leading-tight mt-4 mb-3 font-semibold"
                  style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}
                >
                  {current.title}
                </h3>
              )}
              {isManual ? (
                <textarea
                  className={`${formFieldClass} min-h-[3rem] resize-y`}
                  value={current.subtitle || ''}
                  placeholder="Subtitle / logline"
                  onChange={(e) => patchSlide(slideIndex, { subtitle: e.target.value })}
                  rows={2}
                />
              ) : current.subtitle ? (
                <p className="text-[14px] leading-relaxed text-[var(--sps-text)] m-0 opacity-90 whitespace-pre-wrap">
                  {current.subtitle}
                </p>
              ) : null}
              {(current.frames || []).length ? (
                <div
                  className={`grid gap-2 mt-4 ${
                    (current.frames || []).length === 1
                      ? 'grid-cols-1'
                      : (current.frames || []).length <= 4
                        ? 'grid-cols-2'
                        : 'grid-cols-3'
                  }`}
                >
                  {(current.frames || []).map((fr, fi) => {
                    const key = `${current.id}:${fi}`;
                    const src = placements[key] || current.images?.[fi] || '';
                    return (
                      <label
                        key={key}
                        className="relative block min-h-[6.5rem] rounded-sm border border-dashed border-[var(--sps-gold)]/50 bg-[var(--sps-bg)] overflow-hidden cursor-pointer"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          placeImage(key, e.dataTransfer.files?.[0]);
                        }}
                      >
                        {src ? (
                          <img src={src} alt={fr.label} className="w-full h-28 object-cover" />
                        ) : (
                          <span className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                            <span className="text-[11px] font-semibold text-[var(--sps-gold)]">{fr.label}</span>
                            <span className="text-[10px] text-[var(--sps-muted)] mt-1">
                              {fr.hint || 'Drop still or click to place'}
                            </span>
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={lookOnly}
                          onChange={(e) => {
                            placeImage(key, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              ) : null}
              <ul className="mt-5 space-y-2.5 flex-1">
                {(current.points || []).map((pt, pi) => (
                  <li key={pi} className="text-[13px] leading-relaxed text-[var(--sps-text)] flex gap-2 whitespace-pre-wrap">
                    <span className="text-[var(--sps-gold)] shrink-0">—</span>
                    {isManual ? (
                      <textarea
                        className={`${fieldClass} min-h-[2.5rem] resize-y flex-1`}
                        value={pt}
                        onChange={(e) => patchPoint(slideIndex, pi, e.target.value)}
                        rows={2}
                      />
                    ) : (
                      <span>{pt}</span>
                    )}
                  </li>
                ))}
              </ul>
              {isManual && !lookOnly ? (
                <div className="flex gap-2 mt-3">
                  <button type="button" className="sps-btn" onClick={() => addPoint(slideIndex)}>
                    <Plus className="w-3.5 h-3.5" />
                    Add line
                  </button>
                  <button
                    type="button"
                    className="sps-btn"
                    disabled={slides.length <= 1}
                    onClick={() => removeSlide(slideIndex)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete slide
                  </button>
                </div>
              ) : null}
              {current.id === 'useOfFunds' && (
                <div className="mt-4 space-y-1.5">
                  {(splitNorm.list || []).map((row) => (
                    <div key={row.id} className="flex items-center gap-2 text-[11px]">
                      <span className="w-40 truncate text-[var(--sps-muted)]">{row.label}</span>
                      <input
                        className={`${fieldClass} w-16`}
                        type="number"
                        min={0}
                        max={100}
                        disabled={lookOnly}
                        value={row.pct}
                        onChange={(e) => updatePct(row.id, e.target.value)}
                      />
                      <span className="text-[var(--sps-muted)]">% [{row.status}]</span>
                    </div>
                  ))}
                  <p className={`text-[11px] m-0 ${splitNorm.total === 100 ? 'text-[var(--sps-gold)]' : 'text-[var(--sps-warn)]'}`}>
                    Total {splitNorm.total}% {splitNorm.total === 100 ? '' : '— must equal 100'}
                  </p>
                </div>
              )}
              {current.disclaimer ? (
                <p className="text-[11px] italic text-[var(--sps-muted)] mt-4 m-0">{current.disclaimer}</p>
              ) : null}
              <p className="text-[10px] uppercase tracking-wide text-[var(--sps-muted)] mt-6 pt-4 border-t border-[var(--sps-border)] m-0">
                {current.footer}
              </p>
            </article>
          ) : null}
          <div className="flex items-center gap-3 pb-3">
            <button type="button" className="sps-btn" disabled={slideIndex <= 0} onClick={() => setSlideIndex((n) => Math.max(0, n - 1))}>
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="text-[11px] font-mono text-[var(--sps-muted)]">
              {slides.length ? slideIndex + 1 : 0} / {slides.length}
            </span>
            <button
              type="button"
              className="sps-btn"
              disabled={slideIndex >= slides.length - 1}
              onClick={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <aside className="overflow-y-auto border-l border-[var(--sps-border)] p-3 sps-atelier-pane text-[11px]">
          <p className="text-[10px] font-bold uppercase text-[var(--sps-muted)] m-0 mb-2">Pitch score</p>
          <p className="text-[10px] text-[var(--sps-muted)] leading-snug m-0 mb-2">{scores.note}</p>
          {[
            ['Story', scores.story],
            ['Characters', scores.characters],
            ['Visual world', scores.visualWorld],
            ['Audience', scores.audience],
            ['Commercial', scores.commercial],
            ['Production', scores.production],
            ['Team', scores.team],
            ['Financial', scores.financial],
            ['Investment', scores.investment],
            ['Overall', scores.overall]
          ].map(([label, n]) => (
            <div key={label} className="flex justify-between gap-2 py-0.5 text-[var(--sps-text)]">
              <span>{label}</span>
              <span className="font-mono">{n}</span>
            </div>
          ))}
          {showCheck && (
            <div className="mt-3 space-y-2">
              {Object.entries(checks).map(([group, items]) => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase text-[var(--sps-gold)] m-0 mb-1">{group}</p>
                  <ul className="m-0 pl-0 space-y-0.5">
                    {items.map((it) => (
                      <li key={it.id} className="text-[var(--sps-text)]">
                        {it.pass ? '✓' : '○'} {it.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
      {presenting && current && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="sps-pitch-present fixed inset-0 z-[120] flex flex-col"
              style={{ background: '#0c0a08', color: '#f4ede3' }}
              onClick={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}
            >
              <button
                type="button"
                className="absolute top-4 right-4 sps-icon-btn z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setPresenting(false);
                }}
                title="Exit presentation (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex-1 min-h-0 flex items-center justify-center px-10 md:px-20 py-12 pointer-events-none">
                <article className="w-full max-w-5xl">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] m-0" style={{ color: '#c4a574' }}>
                    {current.kicker}
                  </p>
                  <h2
                    className="text-4xl md:text-5xl leading-tight mt-6 mb-4 font-semibold"
                    style={{ fontFamily: 'var(--sps-font-display)' }}
                  >
                    {current.title}
                  </h2>
                  {current.subtitle ? (
                    <p className="text-xl leading-relaxed opacity-90 whitespace-pre-wrap m-0 mb-6">{current.subtitle}</p>
                  ) : null}
                  {(current.frames || []).length ? (
                    <div
                      className={`grid gap-3 mb-8 pointer-events-auto ${
                        (current.frames || []).length === 1
                          ? 'grid-cols-1'
                          : (current.frames || []).length <= 4
                            ? 'grid-cols-2'
                            : 'grid-cols-3'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(current.frames || []).map((fr, fi) => {
                        const key = `${current.id}:${fi}`;
                        const src = placements[key] || current.images?.[fi] || '';
                        return src ? (
                          <img
                            key={key}
                            src={src}
                            alt={fr.label}
                            className="w-full max-h-56 object-cover rounded-sm"
                          />
                        ) : (
                          <div
                            key={key}
                            className="min-h-[8rem] border border-dashed flex items-center justify-center text-sm"
                            style={{ borderColor: '#6b5344', color: '#9a8b7a' }}
                          >
                            {fr.label}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <ul className="space-y-3 m-0 p-0 list-none">
                    {(current.points || []).filter(Boolean).map((pt, pi) => (
                      <li key={pi} className="text-lg md:text-xl leading-relaxed flex gap-3">
                        <span style={{ color: '#c4a574' }}>—</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
              <div
                className="shrink-0 flex items-center justify-center gap-4 pb-6 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="sps-btn"
                  disabled={slideIndex <= 0}
                  onClick={() => setSlideIndex((n) => Math.max(0, n - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[12px] font-mono" style={{ color: '#9a8b7a' }}>
                  {slideIndex + 1} / {slides.length}
                </span>
                <button
                  type="button"
                  className="sps-btn"
                  disabled={slideIndex >= slides.length - 1}
                  onClick={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
