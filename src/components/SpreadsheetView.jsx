import React, { useState } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import SlotEditor from './SlotEditor';
import { 
  Plus, Copy, Trash2, ArrowUp, ArrowDown, Sparkles, 
  Check, Layers, Search, Filter
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All 15 Slots', keys: [] },
  { id: 'framing', label: '🎬 Framing & Scene', keys: ['sceneShotId', 'shotComposition', 'cameraMotionTag', 'actionEnvContext'] },
  { id: 'lighting', label: '💡 Lighting & Grade', keys: ['subjectLightingTag', 'subjectColorTag', 'backgroundLightingTag', 'backgroundColorTag'] },
  { id: 'artists', label: '🎭 Artists & Reactions', keys: ['characterIdAssetRef', 'coArtistInteraction', 'characterExpression', 'characterPlacement'] },
  { id: 'kinetics', label: '🎵 Movement & Dialogue', keys: ['characterDialogue', 'characterMovement', 'characterEyeLooks'] }
];

export default function SpreadsheetView({ 
  slots = SEEDANCE_SLOTS,
  shots, 
  onUpdateShot, 
  onAddShot, 
  onDeleteShot, 
  onCloneShot, 
  onMoveShot,
  onReorderShots, 
  activeShotIndex, 
  setActiveShotIndex,
  onCompilePrompt
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  // Drag and drop state for shot reordering
  const [draggedShotIdx, setDraggedShotIdx] = useState(null);
  const [dragOverShotIdx, setDragOverShotIdx] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedShotIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverShotIdx !== index) {
      setDragOverShotIdx(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedShotIdx !== null && draggedShotIdx !== targetIndex && onReorderShots) {
      onReorderShots(draggedShotIdx, targetIndex);
    }
    setDraggedShotIdx(null);
    setDragOverShotIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedShotIdx(null);
    setDragOverShotIdx(null);
  };

  const handleCellChange = (shotIdx, key, newValue) => {
    if (shots && shots[shotIdx] && onUpdateShot) {
      onUpdateShot(shotIdx, { ...shots[shotIdx], [key]: newValue });
    }
  };

  const copyShotPrompt = (shot, idx) => {
    if (!shot) return;
    const compiled = (slots || []).map(slot => shot[slot.key]).filter(Boolean).join(' | ');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(compiled);
    }
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentCategoryObj = CATEGORIES.find(c => c.id === activeCategory);
  const filteredSlots = (slots || []).filter(slot => {
    if (activeCategory === 'all') return true;
    return currentCategoryObj?.keys.includes(slot.key);
  });

  const filteredShots = (shots || []).filter((shot, idx) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return Object.values(shot || {}).some(val => 
      val && String(val).toLowerCase().includes(searchLower)
    ) || `shot ${idx + 1}`.includes(searchLower);
  });

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 rounded-xl border border-zinc-800/80 shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Ultra-Compact Top Action & Filter Toolbar */}
      <div className="p-2 px-3 border-b border-zinc-800/80 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0 font-mono text-xs">
        
        {/* Column Category Focus Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[11px] text-zinc-400 font-bold shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3 text-cyan-400" /> Focus:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-cyan-500 text-zinc-950 font-bold shadow'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Add Shot */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search shots..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg pl-7 pr-2.5 py-1 focus:outline-none focus:border-cyan-500 w-36 sm:w-44 font-mono"
            />
          </div>

          <button
            type="button"
            onClick={onAddShot}
            className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-125 text-white font-bold text-xs transition-all flex items-center gap-1 shadow shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Shot</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950">
        <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
          <thead>
            <tr className="bg-zinc-900 text-zinc-300 font-semibold border-b border-zinc-800 sticky top-0 z-30 backdrop-blur-md">
              <th className="p-2 w-[42px] min-w-[42px] text-center border-r-2 border-zinc-800 bg-zinc-900 sticky left-0 z-40 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
                #
              </th>
              <th className="p-2 w-[90px] min-w-[90px] text-center border-r border-zinc-800 bg-zinc-900">
                Actions
              </th>
              
              {filteredSlots.map((slot) => {
                const isSpecial = slot.key === 'sceneShotId' || slot.key === 'shotComposition' || slot.key === 'coArtistInteraction';
                return (
                  <th key={slot.key} className={`p-2 px-3 border-r border-zinc-800 min-w-[190px] font-mono text-zinc-200 ${
                    isSpecial ? 'bg-zinc-900 border-t-2 border-t-amber-500/80' : 'bg-zinc-900'
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className={`truncate font-bold ${isSpecial ? 'text-amber-300' : 'text-cyan-300'}`}>
                        {slot.label}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800/60 bg-zinc-950 font-sans">
            {filteredShots.map((shot, shotIdx) => {
              const isActive = shotIdx === activeShotIndex;
              const isBeingDragged = draggedShotIdx === shotIdx;
              const isTargetDrop = dragOverShotIdx === shotIdx;

              return (
                <tr 
                  key={shotIdx}
                  onClick={() => setActiveShotIndex(shotIdx)}
                  onDragOver={(e) => handleDragOver(e, shotIdx)}
                  onDrop={(e) => handleDrop(e, shotIdx)}
                  className={`transition-colors group ${
                    isActive ? 'bg-cyan-950/20 border-l-4 border-cyan-500' : 'hover:bg-zinc-900/50'
                  } ${
                    isBeingDragged ? 'opacity-30 bg-amber-950/40' : ''
                  } ${
                    isTargetDrop ? 'border-t-2 border-t-amber-400 bg-cyan-950/50' : ''
                  }`}
                >
                  {/* Row Index - Floating / Sticky on Left - Drag & Drop Handle */}
                  <td 
                    draggable
                    onDragStart={(e) => handleDragStart(e, shotIdx)}
                    onDragOver={(e) => handleDragOver(e, shotIdx)}
                    onDrop={(e) => handleDrop(e, shotIdx)}
                    onDragEnd={handleDragEnd}
                    className="p-1.5 text-center text-zinc-400 font-mono border-r-2 border-zinc-800 bg-zinc-950 sticky left-0 z-20 group-hover:bg-zinc-900 shadow-[4px_0_10px_rgba(0,0,0,0.5)] cursor-grab active:cursor-grabbing hover:bg-amber-950/30 select-none transition-all"
                    title="Click, hold & drag shot number to move up/down"
                  >
                    <div className="flex items-center justify-center gap-1 font-bold">
                      <span className="text-[10px] text-zinc-500 group-hover:text-amber-400 font-mono transition-colors">⋮⋮</span>
                      <span className="text-cyan-400 text-xs">{shotIdx + 1}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                    </div>
                  </td>

                  {/* Row Actions */}
                  <td className="p-1 border-r border-zinc-800 bg-zinc-950 group-hover:bg-zinc-900">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); copyShotPrompt(shot, shotIdx); }}
                        className="p-1 rounded bg-zinc-800 hover:bg-cyan-600 text-zinc-300 hover:text-white transition-colors"
                        title="Copy Shot Prompt"
                      >
                        {copiedIndex === shotIdx ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCloneShot(shotIdx); }}
                        className="p-1 rounded bg-zinc-800 hover:bg-blue-600 text-zinc-300 hover:text-white transition-colors"
                        title="Duplicate Row"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteShot(shotIdx); }}
                        disabled={shots.length <= 1}
                        className="p-1 rounded bg-zinc-800 hover:bg-red-600 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors"
                        title="Delete Shot"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </td>

                  {/* Filtered Slot Cells */}
                  {filteredSlots.map((slot) => (
                    <td key={slot.key} className="p-2 border-r border-zinc-800/80 align-top">
                      <SlotEditor
                        slotConfig={slot}
                        value={shot[slot.key] || ''}
                        onChange={(val) => handleCellChange(shotIdx, slot.key, val)}
                        compact={true}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Spreadsheet Footer Status Bar */}
      <div className="p-3 px-4 sm:px-5 border-t border-zinc-800/80 bg-zinc-900/80 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono">
            Shots: <strong className="text-white">{shots.length}</strong>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-amber-300 font-mono text-[11px] truncate">
            Focus: {currentCategoryObj?.label} ({filteredSlots.length} slots)
          </span>
        </div>

        <button
          type="button"
          onClick={onCompilePrompt}
          className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Compile Prompts
        </button>
      </div>
    </div>
  );
}
