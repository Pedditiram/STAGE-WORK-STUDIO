import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, Play, Pause, Film, Shield, Zap,
  Award, Target, Lock, ArrowRight, CheckCircle2, Cloud, Mail, Clapperboard
} from 'lucide-react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';

const OWNER_EMAIL = 'pedditiram@gmail.com';
const CRAFT_COUNT = SEEDANCE_SLOTS.length;

const DECK_SLIDES = [
  {
    id: 'hero',
    kind: 'hero',
    eyebrow: 'Pedditi Labs',
    title: 'Stage Production Studio',
    subtitle: 'Cinema craft intelligence for directors who refuse to compromise the frame.',
    points: [
      `Script → ${CRAFT_COUNT}-craft shot matrix without the pre-viz tax`,
      'Cloud rooms where Directors, DPs, and Editors co-author in real time',
      'Prompt-ready keyframes for AI video pipelines'
    ],
    highlight: 'The operating system for modern cinematic pre-production'
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
    badge: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
    glow: 'rgba(34,211,238,0.25)',
    icon: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/60'
  },
  amber: {
    badge: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    glow: 'rgba(245,158,11,0.22)',
    icon: 'text-amber-300 border-amber-500/40 bg-amber-950/50'
  },
  emerald: {
    badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
    glow: 'rgba(52,211,153,0.2)',
    icon: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/50'
  },
  gold: {
    badge: 'bg-yellow-500/15 text-amber-100 border-amber-300/35',
    glow: 'rgba(251,191,36,0.18)',
    icon: 'text-amber-200 border-amber-400/35 bg-amber-950/40'
  }
};

export default function InvestorDeckModal({ isOpen, onClose, onOpenLogin }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [enterKey, setEnterKey] = useState(0);

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

  const requestAccess = () => {
    const subject = encodeURIComponent('Stage Production Studio — Access Request');
    const body = encodeURIComponent(
      'Hi Pedditi,\n\nI viewed the Investor Deck & Studio Showcase and would like collaborator access to Stage Production Studio.\n\nName:\nStudio / Role:\nEmail:\n\nThanks.'
    );
    window.open(`mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/92 backdrop-blur-xl">
      <div
        className="relative w-full sm:max-w-4xl max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col border-0 sm:border border-cyan-500/35 sm:rounded-3xl shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
        style={{
          background:
            'radial-gradient(900px 480px at 12% -8%, rgba(34,211,238,0.14), transparent 55%), radial-gradient(700px 420px at 92% 8%, rgba(245,158,11,0.1), transparent 50%), radial-gradient(600px 400px at 50% 110%, rgba(56,189,248,0.08), transparent 55%), #07090f',
          fontFamily: 'var(--sps-font)'
        }}
      >
        {/* Atmospheric scan line */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay sps-deck-grain" aria-hidden />
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[120%] h-48 bg-gradient-to-b from-cyan-400/10 to-transparent sps-deck-aurora" aria-hidden />

        {/* Header */}
        <div className="relative z-10 px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0 bg-black/25 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 ring-1 ring-white/20 shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/90 font-semibold">Pedditi Labs</p>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate font-display">
                Investor Deck & Studio Showcase
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isAutoPlaying
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                  : 'bg-white/5 text-cyan-200 border-cyan-700/50 hover:bg-white/10'
              }`}
            >
              {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span className="hidden sm:inline">{isAutoPlaying ? 'Pause' : 'Auto-Play'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/15"
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
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] text-amber-300/90 font-bold">
                  {slide.eyebrow}
                </p>
                <h2
                  className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[0.95] tracking-tight font-display sps-deck-title-glow"
                >
                  {slide.title}
                </h2>
                <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto sm:mx-0 leading-relaxed">
                  {slide.subtitle}
                </p>
                <ul className="grid gap-2.5 max-w-xl mx-auto sm:mx-0 text-left">
                  {slide.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2.5 text-sm text-slate-200/95"
                    >
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={requestAccess}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 hover:brightness-110 transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    Request access <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={openLogin}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white font-semibold text-sm hover:bg-white/10 transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" /> Login
                  </button>
                </div>
                <p className="text-[11px] text-cyan-300/80 font-mono tracking-wide">{slide.highlight}</p>
              </div>
            )}

            {slide.kind === 'content' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-wider ${accent.badge}`}>
                    {slide.badge}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {activeSlide + 1} / {DECK_SLIDES.length}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div className={`hidden sm:flex p-3 rounded-2xl border shrink-0 shadow-lg ${accent.icon}`}>
                    <SlideIcon className="w-7 h-7" />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight font-display">
                      {slide.title}
                    </h2>
                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{slide.subtitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {slide.points.map((point) => (
                    <div
                      key={point}
                      className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-2.5 text-sm text-slate-200"
                      style={{ boxShadow: `inset 0 0 0 1px ${accent.glow}` }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{point}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-950/40 text-center text-cyan-200 text-xs sm:text-sm font-semibold tracking-wide">
                  {slide.highlight}
                </div>
              </div>
            )}

            {slide.kind === 'cta' && (
              <div className="min-h-[min(48vh,380px)] flex flex-col items-center justify-center text-center gap-5 px-2">
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/35 text-amber-200">
                  <Shield className="w-8 h-8" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight max-w-lg leading-tight">
                  {slide.title}
                </h2>
                <p className="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed">{slide.subtitle}</p>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 w-full max-w-lg">
                  <button
                    type="button"
                    onClick={requestAccess}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold text-sm shadow-lg hover:brightness-110 transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" /> Request access
                  </button>
                  <button
                    type="button"
                    onClick={openLogin}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 font-bold text-sm shadow-lg hover:brightness-110 transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" /> Login
                  </button>
                  <a
                    href={`mailto:${OWNER_EMAIL}`}
                    className="px-5 py-3 rounded-xl bg-white/5 border border-white/15 text-white font-semibold text-sm hover:bg-white/10 transition-all inline-flex items-center justify-center gap-2"
                  >
                    Contact Owner
                  </a>
                </div>

                <p className="text-[11px] text-amber-200/90 font-mono">{slide.highlight}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  Guest · Showcase only · Collaborators unlock the slate
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer nav */}
        <div className="relative z-10 px-4 sm:px-6 py-3.5 bg-black/40 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            {DECK_SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSlide(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  activeSlide === idx ? 'bg-cyan-400 w-7' : 'bg-slate-700 hover:bg-slate-500 w-2'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openLogin}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold text-xs shadow hover:brightness-110 transition-all cursor-pointer items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Director Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
