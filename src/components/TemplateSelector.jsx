import React from 'react';
import { PRODUCTION_TEMPLATES } from '../constants/seedancePresets';
import { Clapperboard, Sparkles, ArrowRight } from 'lucide-react';

export default function TemplateSelector({ onLoadTemplate }) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-300 dark:border-zinc-800 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <Clapperboard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Stage Production Cinema Kits
            <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
              Preset Kits
            </span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Load complete shot suites engineered for popular cinema genres.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRODUCTION_TEMPLATES.map((tmpl) => (
          <div
            key={tmpl.id}
            className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-300 dark:border-zinc-800 hover:border-cyan-500 transition-all duration-300 flex flex-col justify-between group hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5 font-mono">
                <span className="text-[10px] text-cyan-800 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-800 font-bold">
                  {tmpl.genre}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold">
                  {tmpl.aspectRatio}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors">
                {tmpl.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                {tmpl.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onLoadTemplate(tmpl)}
              className="mt-4 w-full py-2 rounded-lg bg-white dark:bg-zinc-900 group-hover:bg-cyan-600 text-slate-900 dark:text-zinc-300 group-hover:text-white text-xs font-bold border border-slate-300 dark:border-zinc-800 group-hover:border-cyan-500 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
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
