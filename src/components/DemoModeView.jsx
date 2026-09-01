import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ScrollText,
  LayoutGrid,
  Sparkles,
  Cloud,
  Clapperboard,
  Film,
  Megaphone,
} from 'lucide-react';
import StageWorksMark from './StageWorksMark';
import RequestAccessModal from './RequestAccessModal';
import StudioTourOverlay from './StudioTourOverlay';
import { LINE, PRODUCT } from '../constants/brand';
import { pickPresentationOpening } from '../utils/presentationOpening';

const OWNER_EMAIL = 'pedditiram@gmail.com';
const SLIDE_MS = 8000;
const OPEN_SLIDE_MS = 14000;

const REST_SLIDES = [
  {
    id: 'page',
    scene: 'STORY DESK',
    kicker: 'Writer · Cast · World',
    title: 'Lock the page before the take',
    punch: 'Synopsis, wardrobe, gait, and locations stay on set — not in a side doc.',
    points: [
      { n: 'Page', label: 'Screenplay + synopsis' },
      { n: 'Cast', label: 'Look, voice, wardrobe' },
      { n: 'World', label: 'Plates & continuity' },
    ],
    beats: [
      'Writer Console holds the pages.',
      'Character bible locks face, walk, and costume.',
      'World console keeps the geography honest.',
    ],
    Icon: ScrollText,
    wash: 'from-violet-800/12 via-transparent to-amber-800/8',
  },
  {
    id: 'slate',
    scene: 'THE SLATE',
    kicker: 'Matrix · Form',
    title: 'Every craft on the shot',
    punch: 'Composition, light, lens, and performance — one row per take.',
    points: [
      { n: 'Grid', label: 'Cinema Matrix' },
      { n: 'Desk', label: 'Single-shot Form' },
      { n: 'Lock', label: 'Slot lock & presence' },
    ],
    beats: [
      'The matrix is the call sheet for AI cinema.',
      'Form dives one shot to the bone.',
      'Rooms do not overwrite each other.',
    ],
    Icon: LayoutGrid,
    wash: 'from-teal-800/12 via-transparent to-emerald-800/8',
  },
  {
    id: 'take',
    scene: 'THE TAKE',
    kicker: 'Compile · Generate · Reel',
    title: 'From craft to the cut',
    punch: 'Frame 0 and Frame 120. Stills that hold the look. A reel you can play.',
    points: [
      { n: '0 / 120', label: 'Keyframe prompts' },
      { n: 'Still', label: 'Look continuity' },
      { n: 'Reel', label: 'Play the takes' },
    ],
    beats: [
      'Compiler writes Seedance-ready prompts.',
      'Generate desk paints the stills.',
      'Promo cuts the trailer. Campaign prints the street. Pitch and Budget walk the boardroom.',
    ],
    Icon: Sparkles,
    wash: 'from-rose-900/10 via-transparent to-amber-800/10',
  },
  {
    id: 'campaign',
    scene: 'THE STREET',
    kicker: 'Campaign Kit',
    title: 'Posters that survive a hoarding',
    punch: 'Same face on a 40×10, a metro pillar, and a 160px YouTube thumb. Research sits next to the kit.',
    points: [
      { n: 'Kit', label: '40+ key-art units' },
      { n: 'Desk', label: 'Markets & calendar' },
      { n: 'Cut', label: 'Trailer stays in Promo' },
    ],
    beats: [
      'Campaign is not a trailer template.',
      'Tone, language, and density change the stills.',
      'Export the full kit when the look is locked.',
    ],
    Icon: Megaphone,
    wash: 'from-amber-900/14 via-transparent to-stone-700/10',
  },
  {
    id: 'crew',
    scene: 'THE CREW',
    kicker: 'Cloud collaboration',
    title: 'One slate. Many chairs.',
    punch: 'Owner, Editor, Viewer. OTP at the door. Presence on every shot.',
    points: [
      { n: 'OTP', label: 'Gate the room' },
      { n: 'Roles', label: 'Owner / Editor / Viewer' },
      { n: 'Sync', label: 'Live merge' },
    ],
    beats: [
      'Directors, DPs, and editors on the same take.',
      'Allotted titles. No guest walk into the vault.',
      'The room remembers who held the slot.',
    ],
    Icon: Cloud,
    wash: 'from-sky-900/10 via-transparent to-amber-800/8',
  },
  {
    id: 'board',
    scene: 'THE BOARDROOM',
    kicker: 'Investors & access',
    title: 'Built for the slate and the raise',
    punch: 'Cut the pre-viz tax. Keep the look. Ship the feature from craft, not chat.',
    points: [
      { n: '80%+', label: 'Pre-viz overhead cut' },
      { n: 'OS', label: 'Not a chatbot' },
      { n: 'Now', label: 'Ask for the room' },
    ],
    beats: [
      'Turn Presentation mode off when the lights come up.',
      `Access and partnership: ${OWNER_EMAIL}`,
      LINE,
    ],
    Icon: Clapperboard,
    wash: 'from-amber-800/16 via-transparent to-stone-700/10',
  },
];

export default function DemoModeView({ onOpenLogin }) {
  const [opening] = useState(() => pickPresentationOpening());
  const slides = useMemo(() => {
    const open = {
      id: 'open',
      scene: 'OPENING TITLE',
      kind: 'thesis',
      Icon: Film,
      wash: 'from-amber-800/18 via-transparent to-stone-600/12',
      ...opening,
    };
    return [open, ...REST_SLIDES];
  }, [opening]);

  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0);
  const [accessOpen, setAccessOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const slide = slides[i];
  const Icon = slide.Icon;
  const dwell = slide.kind === 'thesis' ? OPEN_SLIDE_MS : SLIDE_MS;

  const next = useCallback(() => {
    setI((n) => (n + 1) % slides.length);
    setTick((t) => t + 1);
  }, [slides.length]);
  const prev = useCallback(() => {
    setI((n) => (n - 1 + slides.length) % slides.length);
    setTick((t) => t + 1);
  }, [slides.length]);
  const jump = useCallback((idx) => {
    setI(idx);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!playing || tourOpen) return undefined;
    const t = setInterval(next, dwell);
    return () => clearInterval(t);
  }, [playing, next, tick, tourOpen, dwell]);

  useEffect(() => {
    if (tourOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, tourOpen]);

  return (
    <div className="sps-pres-root flex-1 min-h-0 w-full relative overflow-hidden">
      <div className={`sps-pres-wash absolute inset-0 bg-gradient-to-br ${slide.wash}`} />
      <div className="sps-pres-vignette absolute inset-0 pointer-events-none" />
      <div className="sps-deck-grain absolute inset-0 opacity-[0.07] pointer-events-none mix-blend-overlay" />

      <div
        key={`${slide.id}-${tick}`}
        className="sps-pres-progress absolute top-0 left-0 h-[3px] z-20"
        style={{ animationDuration: `${dwell}ms`, animationPlayState: playing ? 'running' : 'paused' }}
      />

      <div className="relative z-10 h-full min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 sm:py-12 min-h-full flex flex-col gap-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <StageWorksMark size={48} className="w-12 h-12 rounded-xl overflow-hidden border border-amber-400/40 shadow-[0_0_28px_rgba(245,158,11,0.25)]" />
              <div>
                <p className="sps-pres-kicker text-[10px] uppercase tracking-[0.28em] m-0 font-semibold">
                  Presentation mode
                </p>
                <p className="sps-pres-title text-sm m-0 font-display">{PRODUCT}</p>
              </div>
            </div>
            <p className="sps-pres-meta text-[11px] font-mono tracking-widest m-0">
              SCENE {String(i + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
            </p>
          </div>

          <div key={`${slide.id}-${tick}`} className="sps-pres-enter grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-start">
            <div className="space-y-5">
              <p className="sps-pres-kicker text-[11px] uppercase tracking-[0.22em] m-0">{slide.kicker}</p>
              <div className="flex items-start gap-4">
                <span className="sps-pres-icon shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </span>
                <h1 className="sps-pres-title font-display text-3xl sm:text-5xl m-0 leading-[1.05]">
                  {slide.title}
                </h1>
              </div>
              {slide.lede ? (
                <p className="sps-pres-lede text-[15px] sm:text-base m-0 leading-relaxed">
                  {slide.lede}
                </p>
              ) : null}
              <p className="sps-pres-punch text-lg sm:text-xl m-0 leading-relaxed max-w-xl">
                {slide.punch}
              </p>
              {slide.welcome ? (
                <p className="sps-pres-welcome text-sm sm:text-[15px] m-0 leading-relaxed max-w-xl">
                  {slide.welcome}
                </p>
              ) : null}
              <ol className="m-0 p-0 list-none space-y-3">
                {slide.beats.map((beat, idx) => (
                  <li
                    key={`${slide.id}-beat-${idx}`}
                    className="sps-pres-beat flex gap-3 text-sm sm:text-[15px]"
                    style={{ animationDelay: `${120 + idx * 90}ms` }}
                  >
                    <span className="sps-pres-beat-n font-mono tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                    <span>{beat}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid gap-3">
              <p className="sps-pres-meta text-[10px] uppercase tracking-[0.2em] m-0">{slide.scene}</p>
              {slide.kind === 'thesis' ? (
                <div className="grid grid-cols-2 gap-3">
                  {slide.points.slice(0, 2).map((p, idx) => (
                    <div
                      key={p.label}
                      className="sps-pres-card rounded-2xl px-4 py-5"
                      style={{ animationDelay: `${80 + idx * 110}ms` }}
                    >
                      <p className="sps-pres-kicker text-[9px] uppercase tracking-[0.16em] m-0 mb-2">
                        {idx === 0 ? 'Clip' : 'Picture'}
                      </p>
                      <p className="sps-pres-card-n font-display text-2xl m-0">{p.n}</p>
                      <p className="sps-pres-card-l text-sm m-0 mt-1">{p.label}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {(slide.kind === 'thesis' ? slide.points.slice(2) : slide.points).map((p, idx) => (
                <div
                  key={p.label}
                  className="sps-pres-card rounded-2xl px-4 py-4"
                  style={{ animationDelay: `${80 + (idx + 2) * 110}ms` }}
                >
                  <p className="sps-pres-card-n font-display text-2xl m-0">{p.n}</p>
                  <p className="sps-pres-card-l text-sm m-0 mt-1">{p.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-4 pt-2">
            <div className="flex gap-1.5">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={s.title}
                  onClick={() => jump(idx)}
                  className="h-1.5 flex-1 rounded-full border-0 p-0 cursor-pointer min-w-0"
                  style={{
                    background: idx === i ? 'var(--sps-gold)' : 'var(--sps-pres-track)',
                    opacity: 1,
                  }}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="sps-icon-btn" onClick={prev} title="Previous" aria-label="Previous">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" className="sps-icon-btn" onClick={() => setPlaying((p) => !p)} title={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button type="button" className="sps-icon-btn" onClick={next} title="Next" aria-label="Next">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="sps-pres-meta text-[11px] ml-1">← →  ·  space</span>
              <span className="flex-1" />
              <button type="button" className="sps-btn text-xs" onClick={() => onOpenLogin?.()}>
                Login
              </button>
              <button type="button" className="sps-btn text-xs" onClick={() => setAccessOpen(true)}>
                Request access
              </button>
              <button type="button" className="sps-btn text-xs" onClick={() => setTourOpen(true)}>
                Demo mode
              </button>
            </div>
          </div>
        </div>
      </div>
      <RequestAccessModal isOpen={accessOpen} onClose={() => setAccessOpen(false)} />
      <StudioTourOverlay isOpen={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
