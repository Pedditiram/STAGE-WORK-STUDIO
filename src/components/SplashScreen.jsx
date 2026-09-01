import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import StageWorksMark from './StageWorksMark';
import { CATEGORY, LINE, PRODUCT } from '../constants/brand';
import { APP_VERSION, BUILD_YEAR, isLocalStudioHost } from '../utils/runtimeEnv';

const BOOT_STEPS = [
  { id: 'mark', label: 'Brand lockup', detail: 'Stage Work Studio mark' },
  { id: 'type', label: 'Type & theme', detail: 'Fraunces · Figtree · gold stage' },
  { id: 'vault', label: 'Local vault', detail: 'Projects stay on this machine' },
  { id: 'os', label: 'Production OS', detail: 'Writer · Matrix · Generate' },
  { id: 'ready', label: 'Studio ready', detail: 'Opening project library' },
];

export default function SplashScreen({ onFinish }) {
  const local = isLocalStudioHost();
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [entered, setEntered] = useState(false);
  const onFinishRef = useRef(onFinish);
  const finishedRef = useRef(false);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const finishOnce = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      if (!isLocalStudioHost()) sessionStorage.setItem('sps_splash_done', '1');
    } catch {
      /* ignore */
    }
    onFinishRef.current?.();
  }, []);

  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        const remaining = 100 - prev;
        const inc = Math.max(3, Math.min(11, Math.round(remaining * 0.14)));
        return Math.min(100, prev + inc);
      });
    }, 90);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const minMs = local ? 3200 : 2400;
    const hard = setTimeout(() => {
      setProgress(100);
      setIsFadingOut(true);
      setTimeout(() => finishOnce(), 420);
    }, minMs + 1400);
    return () => clearTimeout(hard);
  }, [finishOnce, local]);

  useEffect(() => {
    if (progress < 100) return undefined;
    const fadeTimer = setTimeout(() => setIsFadingOut(true), 400);
    const exitTimer = setTimeout(() => finishOnce(), 780);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(exitTimer);
    };
  }, [progress, finishOnce]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        setIsFadingOut(true);
        setTimeout(() => finishOnce(), 280);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finishOnce]);

  const activeStepIdx = Math.min(
    BOOT_STEPS.length - 1,
    progress >= 100 ? BOOT_STEPS.length - 1 : Math.floor((progress / 100) * BOOT_STEPS.length)
  );

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => finishOnce(), 280);
  };

  const host = typeof window !== 'undefined' ? window.location.host : 'localhost';

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ fontFamily: 'var(--sps-font)', background: 'var(--sps-bg)', color: 'var(--sps-text)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`${LINE} launch`}
    >
      <a
        href="#studio-root"
        className="sps-btn sps-btn-primary"
        style={{ position: 'absolute', left: '-9999px' }}
        onClick={(e) => {
          e.preventDefault();
          handleSkip();
        }}
      >
        Skip intro
      </a>

      <div className="absolute inset-0" style={{ background: 'var(--sps-bg)' }} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 28%, color-mix(in srgb, var(--sps-gold) 14%, transparent), transparent 58%),
            radial-gradient(ellipse 40% 30% at 80% 80%, rgba(244,236,222,0.04), transparent 50%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Cinema letterbox */}
      <div className="absolute top-0 inset-x-0 h-[7vh] min-h-8 z-20" style={{ background: '#050403' }} />
      <div className="absolute bottom-0 inset-x-0 h-[7vh] min-h-8 z-20" style={{ background: '#050403' }} />

      <div
        className={`relative z-10 h-full w-full flex flex-col px-6 sm:px-10 transition-all duration-700 ${
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
        style={{ paddingTop: 'max(7vh, 2rem)', paddingBottom: 'max(7vh, 2rem)' }}
      >
        {/* Top chrome — env + version */}
        <header className="flex flex-wrap items-center justify-between gap-3 pt-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <StageWorksMark size={28} className="w-7 h-7 rounded-[7px] shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold m-0 leading-tight" style={{ fontFamily: 'var(--sps-font-display)' }}>
                {PRODUCT}
              </p>
              <p className="text-[9px] uppercase tracking-[0.18em] m-0" style={{ color: 'var(--sps-muted)', fontFamily: 'var(--sps-font-mono)' }}>
                {CATEGORY}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[9px] uppercase tracking-[0.16em] font-semibold px-2.5 py-1 rounded-full border"
              style={{
                fontFamily: 'var(--sps-font-mono)',
                borderColor: 'var(--sps-gold)',
                color: 'var(--sps-gold)',
                background: 'color-mix(in srgb, var(--sps-gold) 12%, transparent)',
              }}
            >
              {local ? 'Local studio' : 'Live'}
            </span>
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--sps-muted)', fontFamily: 'var(--sps-font-mono)' }}>
              v{APP_VERSION}
            </span>
          </div>
        </header>

        {/* Center lockup */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-6">
          <button
            type="button"
            onClick={handleSkip}
            className="relative mb-8 cursor-pointer focus:outline-none focus-visible:ring-2 rounded-[1.4rem]"
            style={{ outlineColor: 'var(--sps-gold)' }}
            title={`Enter ${PRODUCT}`}
            aria-label={`Enter ${LINE}`}
          >
            <div
              className={`relative w-[5.5rem] h-[5.5rem] sm:w-28 sm:h-28 overflow-hidden rounded-[1.4rem] sps-splash-mark-hero ${
                entered ? 'opacity-100 sps-splash-mark-entered' : 'opacity-0 sps-splash-mark-entering'
              }`}
              style={{
                boxShadow: '0 20px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(201,163,106,0.35)',
              }}
            >
              <StageWorksMark size={112} className="w-full h-full" />
            </div>
          </button>

          <h1
            className="text-[clamp(2.4rem,7vw,4.4rem)] leading-[0.95] font-semibold tracking-tight m-0 text-center"
            style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}
          >
            {PRODUCT}
          </h1>
          <p
            className="mt-3 text-[11px] sm:text-[12px] uppercase tracking-[0.28em] font-semibold m-0 text-center"
            style={{ fontFamily: 'var(--sps-font-mono)', color: 'var(--sps-gold)' }}
          >
            {CATEGORY}
          </p>
          <p className="mt-4 max-w-md text-center text-[13px] leading-relaxed m-0" style={{ color: 'var(--sps-muted)' }}>
            Lock the look. Call the take. Generate the feature.
          </p>

          {/* Progress — determinate, labeled */}
          <div className="w-full max-w-md mt-10">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Studio boot"
              className="h-1 rounded-full overflow-hidden"
              style={{ background: 'var(--sps-surface-2)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-200 ease-out"
                style={{ width: `${progress}%`, background: 'var(--sps-gold)' }}
              />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <p className="text-[12px] m-0" role="status" aria-live="polite" style={{ color: 'var(--sps-text)' }}>
                {BOOT_STEPS[activeStepIdx]?.label}
              </p>
              <p className="text-[12px] tabular-nums m-0 shrink-0" style={{ fontFamily: 'var(--sps-font-mono)', color: 'var(--sps-gold)' }}>
                {progress}%
              </p>
            </div>
            <ul className="mt-4 space-y-1.5 hidden sm:block m-0 p-0 list-none">
              {BOOT_STEPS.map((step, idx) => {
                const done = idx < activeStepIdx || progress >= 100;
                const active = idx === activeStepIdx && progress < 100;
                return (
                  <li
                    key={step.id}
                    className="flex items-center gap-2 text-[11px]"
                    style={{ color: done || active ? 'var(--sps-text)' : 'var(--sps-muted)' }}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 border"
                      style={{
                        borderColor: done || active ? 'var(--sps-gold)' : 'var(--sps-border)',
                        color: 'var(--sps-gold)',
                      }}
                    >
                      {done ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : active ? (
                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--sps-gold)' }} />
                      ) : null}
                    </span>
                    <span>{step.label}</span>
                    <span className="ml-auto" style={{ color: 'var(--sps-muted)', fontFamily: 'var(--sps-font-mono)', fontSize: 10 }}>
                      {step.detail}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
            <button type="button" onClick={handleSkip} className="sps-btn sps-btn-primary">
              Enter studio
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] m-0" style={{ color: 'var(--sps-muted)', fontFamily: 'var(--sps-font-mono)' }}>
              Enter · Space · Esc to continue
            </p>
          </div>
        </div>

        {/* Footer — legal / build */}
        <footer className="shrink-0 pb-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--sps-muted)', fontFamily: 'var(--sps-font-mono)' }}>
          <p className="m-0 text-center sm:text-left">
            © {BUILD_YEAR} {PRODUCT}. All rights reserved.
          </p>
          <p className="m-0 text-center sm:text-right truncate max-w-full">
            {local ? `Local · ${host}` : 'stageworkstudio.com'} · Never controls this computer
          </p>
        </footer>
      </div>

      <style>{`
        @keyframes spsSplashMarkEnter {
          0% { opacity: 0; transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
        .sps-splash-mark-entering {
          animation: spsSplashMarkEnter 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .sps-splash-mark-entered {
          opacity: 1;
          transform: scale(1);
        }
        @media (prefers-reduced-motion: reduce) {
          .sps-splash-mark-entering { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
