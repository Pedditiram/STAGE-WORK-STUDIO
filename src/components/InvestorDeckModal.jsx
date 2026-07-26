import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Sparkles, Film, Shield, Zap, Award, Target, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

const DECK_SLIDES = [
  {
    id: 1,
    badge: "VISION & ARCHITECTURE",
    badgeColor: "from-cyan-500 to-blue-600",
    title: "Stage Production Studio: Next-Gen AI Cinema",
    subtitle: "Reinventing film pre-visualization and production with autonomous directorial intelligence.",
    content: [
      "Real-time multi-user cloud workspace uniting Directors, DPs, and Editors.",
      "10x faster turnaround from raw script text to 24-craft camera parameters.",
      "Native zero-latency Vercel serverless database with 100% data integrity.",
      "Engineered for high-budget commercial epics, streaming series, and indie visionaries."
    ],
    highlight: "Autonomous Directorial Intelligence • Real-Time Cloud Collaboration",
    icon: Film
  },
  {
    id: 2,
    badge: "DIRECTORIAL PRECISION",
    badgeColor: "from-amber-500 to-orange-600",
    title: "24 Crafts of Cinema Matrix",
    subtitle: "Granular control over every frame, composition tag, and acoustic atmosphere.",
    content: [
      "Shot Composition: Extreme Close-Up, Wide Anamorphic, Tracking Low-Angle.",
      "Lighting & Grade: Rembrandt 3-Point Classic, Volumetric Neon Cyberpunk, Warm Golden Hour.",
      "Camera Dynamics: Push In Rapid Zoom, Whip Pan Left, Floating Steadicam.",
      "Dual Prompt Compiler: Instant Frame 0 & Frame 120 keyframe prompt generation."
    ],
    highlight: "Full Creative Autonomy Without Technical Bottlenecks",
    icon: Sparkles
  },
  {
    id: 3,
    badge: "MULTI-USER SYNC",
    badgeColor: "from-emerald-500 to-teal-600",
    title: "Zero-Conflict Real-Time Collaboration",
    subtitle: "Multiple creative leads co-authoring scenes without overwrites.",
    content: [
      "Shot-level deep merging protects concurrent edits across global studios.",
      "Active Slot Lock & Typing Indicator suppresses unnecessary popups.",
      "Isolated project room channels keep production slates completely segregated.",
      "Persistent non-destructive versioning ensures total asset safety."
    ],
    highlight: "Enterprise-Grade Cloud Room Isolation & Field Locking",
    icon: Zap
  },
  {
    id: 4,
    badge: "AI SCRIPT BREAKDOWN",
    badgeColor: "from-purple-500 to-indigo-600",
    title: "Automated Genre & Scene Presets",
    subtitle: "Instantly parse screenplays into storyboard-ready shot lists.",
    content: [
      "Indian Mythology & Period Epic presets (Mahabharata / Ramayana aesthetic scale).",
      "Sci-Fi Worldbuilding & Dystopian Cyberpunk atmospheric profiles.",
      "High-Octane Action Blockbuster pacing & framing templates.",
      "Custom genre profile builder for signature director styles."
    ],
    highlight: "From Script Page to Storyboard Matrix in Seconds",
    icon: Target
  },
  {
    id: 5,
    badge: "INVESTMENT & SCALABILITY",
    badgeColor: "from-yellow-400 to-amber-500",
    title: "Commercial Roadmap & Studio Growth",
    subtitle: "Unlocking massive studio efficiency and high-return IP creation.",
    content: [
      "Eliminating traditional pre-viz costs by over 80%.",
      "Direct integration with 4K AI video generation pipelines.",
      "Scalable multi-tenant studio licensing model for global film houses.",
      "Designed for multi-format export: PDF Shot lists, CSV schedules, interactive pitch reels."
    ],
    highlight: "Investing in the Next Century of Cinematic Storytelling",
    icon: Award
  }
];

export default function InvestorDeckModal({ isOpen, onClose, onOpenLogin }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  useEffect(() => {
    let interval;
    if (isAutoPlaying && isOpen) {
      interval = setInterval(() => {
        setActiveSlide(prev => (prev + 1) % DECK_SLIDES.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, isOpen]);

  if (!isOpen) return null;

  const currentSlide = DECK_SLIDES[activeSlide];
  const SlideIcon = currentSlide.icon;

  const handleNext = () => setActiveSlide(prev => (prev + 1) % DECK_SLIDES.length);
  const handlePrev = () => setActiveSlide(prev => (prev - 1 + DECK_SLIDES.length) % DECK_SLIDES.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-xl animate-in fade-in">
      <div className="w-full max-w-3xl bg-slate-950 text-white border-2 border-cyan-500/60 rounded-3xl shadow-[0_30px_100px_rgba(6,182,212,0.4)] overflow-hidden font-mono text-xs flex flex-col max-h-[90vh]">
        
        {/* Top Header Bar */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 border-b border-cyan-500/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-black shadow flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white font-sans tracking-tight">STAGE PRODUCTION STUDIO</h3>
              <span className="text-[10px] text-cyan-300 font-bold block">✨ Investor Deck & Executive Showcase</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isAutoPlaying 
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow' 
                  : 'bg-slate-900 text-cyan-300 border-cyan-700 hover:bg-slate-800'
              }`}
            >
              {isAutoPlaying ? <Pause className="w-3 h-3 fill-slate-950" /> : <Play className="w-3 h-3 fill-cyan-300" />}
              <span>{isAutoPlaying ? 'Pause Slideshow' : 'Auto-Play'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer border border-transparent hover:border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Slide Card Area */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6 bg-gradient-to-b from-slate-950 via-slate-900/60 to-slate-950">
          
          {/* Badge & Slide Counter Header */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${currentSlide.badgeColor} text-white font-black text-[10px] font-sans tracking-wider shadow`}>
              {currentSlide.badge}
            </span>

            <span className="text-xs text-slate-400 font-bold font-mono bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
              Slide <span className="text-cyan-400 font-black">{activeSlide + 1}</span> / {DECK_SLIDES.length}
            </span>
          </div>

          {/* Slide Main Content */}
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shrink-0 shadow-lg hidden sm:block">
                <SlideIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white font-sans tracking-tight leading-tight">
                  {currentSlide.title}
                </h2>
                <p className="text-xs sm:text-sm text-cyan-200/90 font-sans font-medium">
                  {currentSlide.subtitle}
                </p>
              </div>
            </div>

            {/* Bullet Points */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {currentSlide.content.map((point, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 flex items-start gap-2.5 text-xs text-slate-200 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="font-sans leading-relaxed">{point}</span>
                </div>
              ))}
            </div>

            {/* Highlight Banner */}
            <div className="p-3.5 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-center font-bold font-mono text-xs shadow-inner">
              ⚡ {currentSlide.highlight}
            </div>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Dot Indicators */}
          <div className="flex items-center gap-1.5">
            {DECK_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlide(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  activeSlide === idx ? 'bg-cyan-400 w-7' : 'bg-slate-700 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>

          {/* Prev / Next Arrows */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* CTA Login Button */}
            <button
              type="button"
              onClick={() => { onClose(); if (onOpenLogin) onOpenLogin(); }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black font-sans text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer ml-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Unlock Director Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
