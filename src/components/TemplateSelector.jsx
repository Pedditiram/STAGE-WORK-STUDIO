import React from 'react';
import { PRODUCTION_TEMPLATES } from '../constants/seedancePresets';
import { Clapperboard, Sparkles, ArrowRight } from 'lucide-react';

export default function TemplateSelector({ onLoadTemplate }) {
  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-md shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clapperboard className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Seedance 2.0 Cinema Production Kits
            <span className="text-xs font-mono font-normal text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
              Preset Kits
            </span>
          </h3>
          <p className="text-xs text-zinc-400">Load complete shot suites engineered for popular cinema genres.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRODUCTION_TEMPLATES.map((tmpl) => (
          <div
            key={tmpl.id}
            className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-cyan-500/50 transition-all duration-300 flex flex-col justify-between group hover:shadow-lg hover:shadow-cyan-950/20"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                  {tmpl.genre}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {tmpl.aspectRatio}
                </span>
              </div>
              <h4 className="text-sm font-bold text-zinc-100 group-hover:text-cyan-300 transition-colors">
                {tmpl.title}
              </h4>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                {tmpl.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onLoadTemplate(tmpl)}
              className="mt-4 w-full py-2 rounded-lg bg-zinc-900 group-hover:bg-cyan-600 text-zinc-300 group-hover:text-white text-xs font-medium border border-zinc-800 group-hover:border-cyan-500 transition-all flex items-center justify-center gap-1.5"
            >
              <span>Load Template ({tmpl.shots.length} Shots)</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
