import React from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import SlotEditor from './SlotEditor';
import { Sparkles, Copy, Check, ChevronLeft, ChevronRight, Sliders, Film, Wand2 } from 'lucide-react';
import { compileNarrativeProse } from '../utils/narrativeCompiler';

export default function StudioFormView({ 
  slots = SEEDANCE_SLOTS,
  shots, 
  activeShotIndex, 
  setActiveShotIndex, 
  onUpdateShot,
  onCompilePrompt 
}) {
  const activeShot = shots[activeShotIndex] || shots[0];

  const handleSlotChange = (key, val) => {
    onUpdateShot(activeShotIndex, { ...activeShot, [key]: val });
  };

  const compiledPrompt = compileNarrativeProse(activeShot) || slots.map(slot => activeShot[slot.key]).filter(Boolean).join(' | ');

  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(compiledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [selectedSlotKey, setSelectedSlotKey] = React.useState('coArtistInteraction');
  const activeSlotConfig = slots.find(s => s.key === selectedSlotKey) || slots[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full w-full overflow-hidden">
      {/* Left Column: Form Cards for all 15 slots */}
      <div className="lg:col-span-8 flex flex-col gap-3 overflow-y-auto pr-1 h-full">
        {/* Active Shot Selector Banner */}
        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-2.5 px-4 rounded-xl shrink-0 font-mono text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-cyan-400" />
            <span className="text-zinc-400 font-bold">
              Editing Shot #{activeShotIndex + 1} of {shots.length}
            </span>
            <span className="text-amber-900 bg-amber-100 dark:bg-amber-950/80 dark:text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800/80 text-[11px] truncate max-w-[260px]">
              {activeShot.sceneShotId || 'SC01_SH01'} {activeShot.shotComposition ? `- ${activeShot.shotComposition}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveShotIndex(Math.max(0, activeShotIndex - 1))}
              disabled={activeShotIndex === 0}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-30"
              title="Previous Shot"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 text-zinc-400 font-mono text-xs">
              {activeShotIndex + 1} / {shots.length}
            </span>

            <button
              type="button"
              onClick={() => setActiveShotIndex(Math.min(shots.length - 1, activeShotIndex + 1))}
              disabled={activeShotIndex === shots.length - 1}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-30"
              title="Next Shot"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 15 Slot Form Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {slots.map((slot) => (
            <SlotEditor
              key={slot.key}
              slotConfig={slot}
              value={activeShot[slot.key] || ''}
              onChange={(val) => handleSlotChange(slot.key, val)}
              onSelectSlot={setSelectedSlotKey}
              compact={false}
            />
          ))}
        </div>
      </div>

      {/* Right Column: Live Prompt Compiler Box */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Stage Production Studio Compiled Output Box */}
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-white">Stage Production Studio Prompt</h4>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold border border-cyan-400/40 text-xs font-mono flex items-center gap-1.5 transition-all shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  Copy Prompt
                </>
              )}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200 leading-relaxed shadow-inner max-h-72 overflow-y-auto break-words">
            {compiledPrompt || (
              <span className="text-zinc-400 italic">Select dropdown presets or type custom values in slots to construct your prompt...</span>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={onCompilePrompt}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white font-medium text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Wand2 className="w-4 h-4 text-amber-300" />
              Open Full Export Suite & Format Converter
            </button>
          </div>
        </div>

        {/* Dynamic AI Slot Guidance Note at Bottom Right (Compact & Scrollable) */}
        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 space-y-2 shadow-lg font-mono">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <h5 className="font-bold text-white font-sans text-xs truncate max-w-[180px]">
                {activeSlotConfig.tipTitle || activeSlotConfig.label}
              </h5>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 font-bold shrink-0">
              💡 {activeSlotConfig.label}
            </span>
          </div>

          {/* Formatted Scrollable Tip Container */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 leading-relaxed font-mono shadow-inner max-h-28 overflow-y-auto pr-1">
            {activeSlotConfig.tip || activeSlotConfig.description}
          </div>
        </div>
      </div>
    </div>
  );
}
