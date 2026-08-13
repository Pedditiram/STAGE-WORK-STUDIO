import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Film, ShieldCheck, Cloud, HardDrive, Sparkles, ArrowRight, Check } from 'lucide-react';

const BOOT_STEPS = [
  { id: 'engine', label: 'Screenplay engine', detail: '25-craft writing matrix' },
  { id: 'vault', label: 'Project vault', detail: 'Local & cloud restore' },
  { id: 'canvas', label: 'Director canvas', detail: 'Pre-viz workspace' },
  { id: 'sync', label: 'Collaboration sync', detail: 'Secure room handshake' },
  { id: 'ready', label: 'Studio ready', detail: 'Your workspace is live' },
];

export default function SplashScreen({ onFinish }) {
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
      sessionStorage.setItem('sps_splash_done', '1');
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
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const remaining = 100 - prev;
        const inc = Math.max(1, Math.min(5, Math.round(remaining * 0.08) + (Math.random() > 0.7 ? 2 : 1)));
        return Math.min(100, prev + inc);
      });
    }, 90);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress < 100) return undefined;
    const fadeTimer = setTimeout(() => setIsFadingOut(true), 700);
    const exitTimer = setTimeout(() => finishOnce(), 1200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(exitTimer);
    };
  }, [progress, finishOnce]);

  const activeStepIdx = Math.min(
    BOOT_STEPS.length - 1,
    progress >= 100 ? BOOT_STEPS.length - 1 : Math.floor((progress / 100) * BOOT_STEPS.length)
  );

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => finishOnce(), 380);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-hidden transition-all duration-700 ease-out ${
        isFadingOut ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{ fontFamily: 'var(--sps-font)' }}
      role="dialog"
      aria-label="Stage Production Studio loading"
    >
      {/* Atmospheric stage backdrop */}
      <div className="absolute inset-0 bg-[#06080e]" />
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 55% at 50% -5%, rgba(34, 211, 238, 0.18), transparent 55%),
            radial-gradient(ellipse 50% 40% at 85% 70%, rgba(245, 158, 11, 0.08), transparent 50%),
            radial-gradient(ellipse 45% 35% at 10% 80%, rgba(56, 189, 248, 0.07), transparent 45%),
            linear-gradient(180deg, #0a1018 0%, #06080e 45%, #04060a 100%)
          `,
        }}
      />

      {/* Soft light sweep */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%)',
          animation: 'spsSplashSweep 6s ease-in-out infinite',
        }}
      />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Letterbox bars */}
      <div className="absolute top-0 inset-x-0 h-10 sm:h-14 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-20" />
      <div className="absolute bottom-0 inset-x-0 h-10 sm:h-14 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-20" />

      <div
        className={`relative z-10 h-full w-full flex flex-col items-center justify-center px-6 transition-all duration-1000 ease-out ${
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Brand mark */}
        <button
          type="button"
          onClick={handleSkip}
          className="group relative mb-8 sm:mb-10 cursor-pointer focus:outline-none"
          title="Enter studio"
          aria-label="Enter Stage Production Studio"
        >
          <div
            className="absolute -inset-8 rounded-full opacity-70 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
            style={{
              background: 'radial-gradient(circle, rgba(34,211,238,0.35) 0%, rgba(245,158,11,0.12) 45%, transparent 70%)',
              animation: 'spsSplashPulse 3.2s ease-in-out infinite',
            }}
          />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-[1.35rem] bg-gradient-to-br from-slate-900 via-slate-950 to-black border border-cyan-400/30 shadow-[0_20px_60px_rgba(0,0,0,0.55)] flex items-center justify-center overflow-hidden">
            <div
              className="absolute inset-[3px] rounded-[1.15rem] border border-dashed border-cyan-400/25"
              style={{ animation: 'spsSplashSpin 18s linear infinite' }}
            />
            <Film className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]" />
            <Sparkles className="absolute top-3 right-3 w-3.5 h-3.5 text-amber-300/90" style={{ animation: 'spsSplashPulse 2s ease-in-out infinite' }} />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent pointer-events-none" />
          </div>
        </button>

        {/* Hero brand — first viewport signal */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <p
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-cyan-300/80 font-semibold"
            style={{ fontFamily: 'var(--sps-font-mono)' }}
          >
            Pedditi Labs
          </p>
          <h1
            className="text-[clamp(1.85rem,5vw,3.35rem)] leading-[1.05] font-extrabold tracking-tight text-white"
            style={{ fontFamily: 'var(--sps-font-display)' }}
          >
            <span className="block">Stage Production</span>
            <span
              className="block bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(100deg, #67e8f9 0%, #e2e8f0 45%, #fbbf24 100%)',
              }}
            >
              Studio
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
            Professional screenplay, shot design, and collaboration — built for directors who ship cinema.
          </p>
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] sm:text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Encrypted session vault
          </span>
          <span className="hidden sm:inline text-slate-700">·</span>
          <span className="inline-flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            Local-first projects
          </span>
          <span className="hidden sm:inline text-slate-700">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            Live cloud rooms
          </span>
        </div>

        {/* Progress panel */}
        <div className="w-full max-w-md mt-10 sm:mt-12">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="text-left min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-1">
                  Preparing workspace
                </p>
                <p className="text-sm text-slate-200 font-medium truncate">
                  {BOOT_STEPS[activeStepIdx]?.label}
                </p>
              </div>
              <span
                className="text-lg font-bold text-cyan-300 tabular-nums shrink-0"
                style={{ fontFamily: 'var(--sps-font-display)' }}
              >
                {progress}%
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-slate-900/90 overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full relative transition-[width] duration-200 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #0e7490, #22d3ee, #fbbf24)',
                  boxShadow: '0 0 20px rgba(34,211,238,0.45)',
                }}
              >
                <div
                  className="absolute inset-0 opacity-60"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
                    animation: 'spsSplashShimmer 1.4s linear infinite',
                  }}
                />
              </div>
            </div>

            {/* Step checklist — builds confidence */}
            <ul className="mt-4 space-y-2">
              {BOOT_STEPS.map((step, idx) => {
                const done = idx < activeStepIdx || progress >= 100;
                const active = idx === activeStepIdx && progress < 100;
                return (
                  <li
                    key={step.id}
                    className={`flex items-center gap-2.5 text-[12px] transition-all duration-300 ${
                      done ? 'text-slate-300' : active ? 'text-cyan-200' : 'text-slate-600'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        done
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                          : active
                            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                            : 'bg-transparent border-slate-700 text-transparent'
                      }`}
                    >
                      {done ? (
                        <Check className="w-3 h-3" strokeWidth={3} />
                      ) : active ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                      ) : null}
                    </span>
                    <span className="font-medium">{step.label}</span>
                    <span className={`ml-auto text-[10px] hidden sm:inline ${done || active ? 'text-slate-500' : 'text-slate-700'}`}>
                      {step.detail}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-bold shadow-[0_12px_40px_rgba(34,211,238,0.35)] transition-all active:scale-[0.98]"
            >
              Enter studio
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <p className="text-[11px] text-slate-500">
              {progress >= 100 ? 'Opening sign-in…' : 'Click mark or Enter to skip'}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spsSplashSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spsSplashPulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes spsSplashSweep {
          0%, 100% { transform: translateX(-8%); opacity: 0.25; }
          50% { transform: translateX(8%); opacity: 0.45; }
        }
        @keyframes spsSplashShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
