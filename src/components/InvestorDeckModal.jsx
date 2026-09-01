import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, ChevronLeft, ChevronRight, Play, Pause, Film, Shield, Zap,
  Award, Target, Lock, ArrowRight, CheckCircle2, Cloud, Mail, Clapperboard, Download, Archive
} from 'lucide-react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import StageWorksMark from './StageWorksMark';
import RequestAccessModal from './RequestAccessModal';
import { CATEGORY, LINE, PRODUCT } from '../constants/brand';
import { exportDownloadText, assertExportAllowed, logExportSuccess, EXPORT_LIFECYCLE, resolveCollabRoomId } from '../utils/exportGate';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import {
  investorDeckToMarkdown,
  investorDeckToPrintHtml,
  investorDeckToCsv,
  buildInvestorDeckZipFiles
} from '../utils/investorDeckExport';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';

const OWNER_EMAIL = 'pedditiram@gmail.com';
const CRAFT_COUNT = SEEDANCE_SLOTS.length;

const DECK_SLIDES = [
  {
    id: 'hero',
    kind: 'hero',
    eyebrow: CATEGORY,
    title: PRODUCT,
    subtitle: `${LINE}. Lock the look, call the take, generate the feature.`,
    points: [
      `Script → ${CRAFT_COUNT}-craft shot matrix without the pre-viz tax`,
      'Cloud rooms where Directors, DPs, and Editors co-author in real time',
      'Prompt-ready keyframes for AI video pipelines'
    ],
    highlight: `${LINE} — the set runs here; the film is generated from the take`
  },
  {
    id: 'value',
    kind: 'content',
    badge: 'WHAT THE STUDIO DOES',
    accent: 'cyan',
    title: 'From page to production-ready craft',
    subtitle: 'One workspace that thinks like a director’s table — not a generic AI notepad.',
    points: [
      'AI script breakdown into storyboard-ready shot lists',
      'Genre-aware presets: mythology, sci-fi, action, and signature styles',
      'Dual Prompt Compiler for Frame 0 & Frame 120 keyframes',
      'Writer, Matrix, Form, and Canvas views for every craft lead'
    ],
    highlight: '10× faster path from raw text to camera parameters',
    icon: Clapperboard
  },
  {
    id: 'collab',
    kind: 'content',
    badge: 'COLLABORATION & CLOUD',
    accent: 'amber',
    title: 'Zero-conflict multi-user sync',
    subtitle: 'Enterprise-grade room isolation with shot-level merge and slot lock.',
    points: [
      'Isolated project rooms keep production slates segregated',
      'Active slot lock & typing indicators reduce overwrite chaos',
      'Persistent non-destructive versioning for asset safety',
      'Invite OTP + allotted access for trusted collaborators only'
    ],
    highlight: 'Cloud collaboration without sacrificing directorial control',
    icon: Cloud
  },
  {
    id: 'craft',
    kind: 'content',
    badge: 'CRAFT PIPELINE',
    accent: 'emerald',
    title: `${CRAFT_COUNT} crafts. Full creative autonomy.`,
    subtitle: 'Composition, lighting, camera dynamics, psychology — every slot intentional.',
    points: [
      'Shot composition: ECU to anamorphic wide, tracking low-angle',
      'Lighting & grade: Rembrandt classic to volumetric neon',
      'Camera dynamics: push-in, whip pan, floating steadicam',
      'Character bible, World & Environment console, director psychology, and Writer Console synopsis'
    ],
    highlight: 'Full creative autonomy without technical bottlenecks',
    icon: Target
  },
  {
    id: 'scale',
    kind: 'content',
    badge: 'INVESTMENT & SCALE',
    accent: 'gold',
    title: 'Built for studio efficiency and IP velocity',
    subtitle: 'Cut pre-viz cost, accelerate turnaround, license the pipeline.',
    points: [
      'Eliminate traditional pre-viz overhead by 80%+',
      'Direct path into 4K AI video generation workflows',
      'Multi-tenant studio licensing for global film houses',
      'Export: PDF shot lists, CSV schedules, interactive pitch reels'
    ],
    highlight: 'Investing in the next century of cinematic storytelling',
    icon: Award
  },
  {
    id: 'cta',
    kind: 'cta',
    title: 'Request access. Join the slate.',
    subtitle: 'Prospects see this showcase. Collaborators unlock the full studio.',
    highlight: 'Owner · Pedditi Ram · pedditiram@gmail.com'
  }
];

const ACCENT_STYLES = {
  cyan: {
    badge: 'border text-[10px] font-bold tracking-wider',
    glow: 'rgba(139,90,43,0.18)',
    icon: 'text-[var(--sps-gold)] border-[var(--sps-border)] bg-[var(--sps-surface)]'
  },
  amber: {
    badge: 'border text-[10px] font-bold tracking-wider',
    glow: 'rgba(139,90,43,0.18)',
    icon: 'text-[var(--sps-gold)] border-[var(--sps-border)] bg-[var(--sps-surface)]'
  },
  emerald: {
    badge: 'border text-[10px] font-bold tracking-wider',
    glow: 'rgba(139,90,43,0.18)',
    icon: 'text-[var(--sps-gold)] border-[var(--sps-border)] bg-[var(--sps-surface)]'
  },
  gold: {
    badge: 'border text-[10px] font-bold tracking-wider',
    glow: 'rgba(139,90,43,0.18)',
    icon: 'text-[var(--sps-gold)] border-[var(--sps-border)] bg-[var(--sps-surface)]'
  }
};

export default function InvestorDeckModal({
  isOpen,
  onClose,
  onOpenLogin,
  projectTitle = '',
  shots = []
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [enterKey, setEnterKey] = useState(0);
  const [accessOpen, setAccessOpen] = useState(false);

  const exportLife = useMemo(
    () => lifecycleExportReadiness(shots, projectTitle),
    [shots, projectTitle]
  );
  const {
    strict: investorLifecycleStrict,
    mode: investorLifecycleMode
  } = useExportLifecyclePref('investor');
  const hasFilmContext = Boolean(String(projectTitle || '').trim()) && (shots?.length || 0) > 0;
  const exportBlocked = hasFilmContext && investorLifecycleStrict && !exportLife.exportReady;
  const effectiveLifecycleMode = hasFilmContext ? investorLifecycleMode : EXPORT_LIFECYCLE.NONE;

  useEffect(() => {
    if (!isOpen) return;
    setActiveSlide(0);
    setIsAutoPlaying(true);
    setEnterKey((k) => k + 1);
  }, [isOpen]);

  useEffect(() => {
    let interval;
    if (isAutoPlaying && isOpen) {
      interval = setInterval(() => {
        setActiveSlide((prev) => (prev + 1) % DECK_SLIDES.length);
      }, 6500);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setEnterKey((k) => k + 1);
  }, [activeSlide, isOpen]);

  const handleNext = useCallback(
    () => setActiveSlide((prev) => (prev + 1) % DECK_SLIDES.length),
    []
  );
  const handlePrev = useCallback(
    () => setActiveSlide((prev) => (prev - 1 + DECK_SLIDES.length) % DECK_SLIDES.length),
    []
  );

  if (!isOpen) return null;

  const slide = DECK_SLIDES[activeSlide];
  const SlideIcon = slide.icon || Film;
  const accent = ACCENT_STYLES[slide.accent] || ACCENT_STYLES.cyan;

  const openLogin = () => {
    onClose?.();
    onOpenLogin?.();
  };

  const requestAccess = () => setAccessOpen(true);

  const roomId = resolveCollabRoomId();
  const lifeNote = `${DECK_SLIDES.length} slides${hasFilmContext ? ' · film context' : ' · showcase'}${roomId ? ` · room:${roomId}` : ''}`;
  const exportTitle = projectTitle || PRODUCT;
  const gatedShots = hasFilmContext ? shots : [];

  const exportOutline = () => {
    exportDownloadText('stageworks_investor_deck.md', investorDeckToMarkdown(DECK_SLIDES, { projectTitle }), {
      projectTitle: exportTitle,
      auditLabel: 'investor_deck_outline',
      auditFormat: 'md',
      mime: 'text/markdown;charset=utf-8',
      lifecycleMode: effectiveLifecycleMode,
      shots: gatedShots,
      roomId,
      note: lifeNote
    });
  };

  const exportCsv = () => {
    exportDownloadText('stageworks_investor_deck.csv', investorDeckToCsv(DECK_SLIDES, { projectTitle }), {
      projectTitle: exportTitle,
      auditLabel: 'investor_deck_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: effectiveLifecycleMode,
      shots: gatedShots,
      roomId,
      note: lifeNote
    });
  };

  const exportPdf = () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle: exportTitle,
        label: 'investor_deck_pdf',
        format: 'pdf',
        lifecycleMode: effectiveLifecycleMode,
        shots: gatedShots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle: exportTitle,
      label: 'investor_deck_pdf',
      format: 'pdf',
      lifecycleMode: effectiveLifecycleMode,
      shots: gatedShots,
      roomId
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(investorDeckToPrintHtml(DECK_SLIDES, { projectTitle, roomId }));
    printWindow.document.close();
    logExportSuccess({
      projectTitle: exportTitle,
      label: 'investor_deck_pdf',
      format: 'pdf',
      filename: 'stageworks_investor_deck.pdf',
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${effectiveLifecycleMode}+ok` : effectiveLifecycleMode
    });
  };

  const exportZip = async () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle: exportTitle,
        label: 'investor_deck_zip',
        format: 'zip',
        lifecycleMode: effectiveLifecycleMode,
        shots: gatedShots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle: exportTitle,
      label: 'investor_deck_zip',
      format: 'zip',
      lifecycleMode: effectiveLifecycleMode,
      shots: gatedShots,
      roomId
    });
    if (!gate.ok) return;
    const files = buildInvestorDeckZipFiles(DECK_SLIDES, { projectTitle, roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, 'stageworks_investor_deck.zip', {
      projectTitle: exportTitle,
      shots: gatedShots,
      lifecycleMode: effectiveLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'investor_deck_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 50 }}>
      <div
        className="sps-shell"
        style={{
          width: 'min(56rem, 100%)',
          height: 'min(92dvh, 40rem)',
          alignSelf: 'center',
          fontFamily: 'var(--sps-font)'
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-multiply sps-deck-grain" aria-hidden />

        {/* Header */}
        <div className="sps-modal-head relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/20 shrink-0">
              <StageWorksMark size={36} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--sps-gold)' }}>{PRODUCT}</p>
              <h3 className="text-sm sm:text-base font-semibold tracking-tight truncate font-display" style={{ color: 'var(--sps-text)' }}>
                Investor Deck & Studio Showcase
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {exportBlocked ? (
              <span className="text-[10px] text-[var(--sps-gold)] max-w-[12rem] leading-snug hidden md:inline">
                {exportLife.message}
              </span>
            ) : null}
            <button
              type="button"
              onClick={exportOutline}
              disabled={exportBlocked}
              className="sps-btn text-[11px] disabled:opacity-40"
              title={exportBlocked ? exportLife.message : 'Download product showcase outline (.md)'}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Outline</span>
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={exportBlocked}
              className="sps-btn text-[11px] disabled:opacity-40"
              title={exportBlocked ? exportLife.message : 'Export investor deck CSV'}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={exportBlocked}
              className="sps-btn text-[11px] disabled:opacity-40"
              title={exportBlocked ? exportLife.message : 'Print investor deck PDF'}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              type="button"
              onClick={exportZip}
              disabled={exportBlocked}
              className="sps-btn text-[11px] disabled:opacity-40"
              title={exportBlocked ? exportLife.message : 'Download investor deck ZIP'}
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ZIP</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className={`sps-btn text-[11px] ${isAutoPlaying ? 'sps-btn-primary' : ''}`}
            >
              {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span className="hidden sm:inline">{isAutoPlaying ? 'Pause' : 'Auto-Play'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sps-icon-btn"
              aria-label="Close investor deck"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Slide body */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
          <div key={enterKey} className="sps-deck-enter space-y-6">
            {slide.kind === 'hero' && (
              <div className="min-h-[min(52vh,420px)] flex flex-col justify-center text-center sm:text-left gap-5">
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] font-bold text-[var(--sps-gold)]">
                  {slide.eyebrow}
                </p>
                <h2
                  className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[0.95] tracking-tight font-display text-[var(--sps-text)]"
                >
                  {slide.title}
                </h2>
                <p className="text-base sm:text-lg max-w-2xl mx-auto sm:mx-0 leading-relaxed text-[var(--sps-text)]">
                  {slide.subtitle}
                </p>
                <ul className="grid gap-2.5 max-w-xl mx-auto sm:mx-0 text-left">
                  {slide.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2.5 text-sm text-[var(--sps-text)]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[var(--sps-gold)] shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={requestAccess}
                    className="sps-btn sps-btn-primary text-sm"
                  >
                    Request access <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={openLogin}
                    className="sps-btn text-sm"
                  >
                    <Lock className="w-3.5 h-3.5" /> Login
                  </button>
                </div>
                <p className="text-[11px] font-mono tracking-wide text-[var(--sps-gold)]">{slide.highlight}</p>
              </div>
            )}

            {slide.kind === 'content' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[var(--sps-gold)]`}>
                    {slide.badge}
                  </span>
                  <span className="text-[11px] text-[var(--sps-muted)] font-mono">
                    {activeSlide + 1} / {DECK_SLIDES.length}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div className={`hidden sm:flex p-3 rounded-2xl border shrink-0 ${accent.icon}`}>
                    <SlideIcon className="w-7 h-7" />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight font-display text-[var(--sps-text)]">
                      {slide.title}
                    </h2>
                    <p className="text-sm sm:text-base leading-relaxed text-[var(--sps-muted)]">{slide.subtitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {slide.points.map((point) => (
                    <div
                      key={point}
                      className="p-3.5 rounded-[10px] border border-[var(--sps-border)] bg-[var(--sps-surface)] flex items-start gap-2.5 text-sm text-[var(--sps-text)]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[var(--sps-gold)] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{point}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-[10px] border border-[var(--sps-border)] bg-[var(--sps-surface)] text-center text-[var(--sps-gold)] text-xs sm:text-sm font-semibold tracking-wide">
                  {slide.highlight}
                </div>
              </div>
            )}

            {slide.kind === 'cta' && (
              <div className="min-h-[min(48vh,380px)] flex flex-col items-center justify-center text-center gap-5 px-2">
                <div className="p-3 rounded-2xl border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[var(--sps-gold)]">
                  <Shield className="w-8 h-8" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight max-w-lg leading-tight text-[var(--sps-text)]">
                  {slide.title}
                </h2>
                <p className="text-sm sm:text-base max-w-md leading-relaxed text-[var(--sps-muted)]">{slide.subtitle}</p>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 w-full max-w-lg">
                  <button
                    type="button"
                    onClick={requestAccess}
                    className="sps-btn sps-btn-primary text-sm"
                  >
                    <Mail className="w-4 h-4" /> Request access
                  </button>
                  <button
                    type="button"
                    onClick={openLogin}
                    className="sps-btn sps-btn-primary text-sm"
                  >
                    <Lock className="w-4 h-4" /> Login
                  </button>
                </div>

                <p className="text-[11px] font-mono text-[var(--sps-gold)]">{slide.highlight}</p>
                <div className="flex items-center gap-2 text-[10px] text-[var(--sps-muted)] uppercase tracking-widest">
                  <Zap className="w-3 h-3 text-[var(--sps-gold)]" />
                  Guest · Showcase only · Collaborators unlock the slate
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer nav */}
        <div className="relative z-10 px-4 sm:px-6 py-2.5 bg-[var(--sps-bg-elevated)] border-t border-[var(--sps-border)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            {DECK_SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSlide(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  activeSlide === idx ? 'bg-[var(--sps-gold)] w-7' : 'bg-[var(--sps-border-strong)] hover:bg-[var(--sps-muted)] w-2'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="sps-icon-btn"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="sps-icon-btn"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openLogin}
              className="hidden sm:inline-flex sps-btn sps-btn-primary text-[10px]"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Director Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <RequestAccessModal isOpen={accessOpen} onClose={() => setAccessOpen(false)} />
    </div>
  );
}
