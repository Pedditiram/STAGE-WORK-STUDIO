import React, { useState } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import SlotEditor from './SlotEditor';
import { 
  Plus, Copy, VolumeX, Volume2, ArrowUp, ArrowDown, Sparkles, 
  Check, Layers, Search, Filter
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All 24 Crafts', keys: [] },
  { id: 'framing', label: '🎬 Framing, Optics & 9-Image Inputs', keys: ['sceneShotId', 'shotComposition', 'cameraMotionTag', 'actionEnvContext', 'lensAndFocalLength', 'shotDurationAndImages'] },
  { id: 'lighting', label: '💡 Lighting, Color & Atmosphere SFX', keys: ['subjectLightingTag', 'subjectColorTag', 'backgroundLightingTag', 'backgroundColorTag', 'atmosphereVolumetricsTag', 'vfxCgiBreakdown'] },
  { id: 'artists', label: '🎭 Artists, Makeup & Stunt Safety', keys: ['characterIdAssetRef', 'coArtistInteraction', 'characterExpression', 'characterPlacement', 'makeupAndHairStyle', 'stuntAndSafetyNotes'] },
  { id: 'audio_post', label: '🎵 Sound, Music Score & Edit Cuts', keys: ['characterDialogue', 'characterMovement', 'characterEyeLooks', 'soundFxAndFoley', 'backgroundScoreMood', 'editTransitionCut'] }
];

export default function SpreadsheetView({ 
  slots = SEEDANCE_SLOTS,
  shots, 
  onUpdateShot, 
  onAddShot, 
  onDeleteShot, 
  onToggleMuteShot,
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
  const [activeModalCell, setActiveModalCell] = useState(null); // { shotIdx, slotKey }

  const [draggedShotIdx, setDraggedShotIdx] = useState(null);
  const [dragOverShotIdx, setDragOverShotIdx] = useState(null);

  const toggleMuteFn = onToggleMuteShot || onDeleteShot;

  const currentCategoryObj = CATEGORIES.find(c => c.id === activeCategory);
  const filteredSlots = (slots || []).filter(slot => {
    if (activeCategory === 'all') return true;
    return currentCategoryObj?.keys.includes(slot.key);
  });

  const handleNavigateNextSlot = (currentShotIdx, currentSlotKey) => {
    const slotKeys = filteredSlots.map(s => s.key);
    const currIdx = slotKeys.indexOf(currentSlotKey);
    if (currIdx !== -1 && currIdx < slotKeys.length - 1) {
      setActiveModalCell({ shotIdx: currentShotIdx, slotKey: slotKeys[currIdx + 1] });
    } else if (currentShotIdx < (shots || []).length - 1) {
      if (setActiveShotIndex) setActiveShotIndex(currentShotIdx + 1);
      setActiveModalCell({ shotIdx: currentShotIdx + 1, slotKey: slotKeys[0] });
    }
  };

  const handleNavigatePrevSlot = (currentShotIdx, currentSlotKey) => {
    const slotKeys = filteredSlots.map(s => s.key);
    const currIdx = slotKeys.indexOf(currentSlotKey);
    if (currIdx > 0) {
      setActiveModalCell({ shotIdx: currentShotIdx, slotKey: slotKeys[currIdx - 1] });
    } else if (currentShotIdx > 0) {
      if (setActiveShotIndex) setActiveShotIndex(currentShotIdx - 1);
      setActiveModalCell({ shotIdx: currentShotIdx - 1, slotKey: slotKeys[slotKeys.length - 1] });
    }
  };

  const filteredShots = (shots || []).filter((shot, idx) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return Object.values(shot || {}).some(val => 
      val && String(val).toLowerCase().includes(searchLower)
    ) || `shot ${idx + 1}`.includes(searchLower);
  });

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
      onUpdateShot(shotIdx, key, newValue);
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

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
      {/* Category Tab Bar & Quick Search Controls */}
      <div className="p-2.5 px-3 border-b border-zinc-800/80 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-[11px] text-zinc-400 font-bold shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3 text-cyan-400" /> Focus:
          </span>
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.4)] scale-105'
                    : 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700 hover:text-white hover:border-zinc-500'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar & Action Trigger */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search shots..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500 w-36 sm:w-48"
            />
          </div>

          <button
            type="button"
            onClick={onAddShot}
            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Shot</span>
          </button>
        </div>
      </div>

      {/* Main High-Density Spreadsheet Table */}
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950 relative">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-900 text-zinc-300 font-semibold border-b border-zinc-800 sticky top-0 z-30 backdrop-blur-md">
              <th className="p-2 w-[42px] min-w-[42px] text-center border-r-2 border-zinc-800 bg-zinc-900 sticky left-0 z-40 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
                #
              </th>
              <th className="p-2 w-[95px] min-w-[95px] text-center border-r border-zinc-800 bg-zinc-900">
                Actions
              </th>
              {filteredSlots.map((slot) => (
                <th key={slot.key} className="p-2 px-3 border-r border-zinc-800 min-w-[190px] font-mono text-cyan-300">
                  {slot.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800/60 bg-zinc-950 font-sans">
            {filteredShots.map((shot, shotIdx) => {
              const isActive = shotIdx === activeShotIndex;
              const isMuted = !!shot.isMuted;
              const isBeingDragged = draggedShotIdx === shotIdx;
              const isTargetDrop = dragOverShotIdx === shotIdx;

              // MINIMIZED MUTED ROW (MODERATE THIN RED LINE)
              if (isMuted) {
                return (
                  <tr 
                    key={shotIdx}
                    onClick={() => setActiveShotIndex(shotIdx)}
                    onDragOver={(e) => handleDragOver(e, shotIdx)}
                    onDrop={(e) => handleDrop(e, shotIdx)}
                    className={`bg-red-950/40 hover:bg-red-900/60 border-y border-red-500/50 transition-all text-xs h-8 ${
                      isBeingDragged ? 'opacity-30' : ''
                    } ${
                      isTargetDrop ? 'border-t-2 border-t-amber-400 bg-red-900/80' : ''
                    }`}
                  >
                    <td 
                      draggable
                      onDragStart={(e) => handleDragStart(e, shotIdx)}
                      onDragOver={(e) => handleDragOver(e, shotIdx)}
                      onDrop={(e) => handleDrop(e, shotIdx)}
                      onDragEnd={handleDragEnd}
                      className="p-1 text-center font-mono border-r border-red-500/40 bg-red-950/90 sticky left-0 z-20 shadow-[4px_0_10px_rgba(0,0,0,0.5)] cursor-grab active:cursor-grabbing hover:bg-red-900 select-none transition-all"
                      title="Click, hold & drag shot number to move up/down"
                    >
                      <div className="flex items-center justify-center gap-1 font-bold">
                        <span className="text-[10px] text-red-400 font-mono">⋮⋮</span>
                        <span className="text-red-300 font-bold text-xs">{shotIdx + 1}</span>
                      </div>
                    </td>
                    <td className="p-1 border-r border-red-500/40 text-center bg-red-950/90">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (toggleMuteFn) toggleMuteFn(shotIdx);
                          }}
                          className="px-2 py-0.5 rounded bg-red-700 hover:bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 transition-all border border-red-400 shadow-sm cursor-pointer"
                          title="Unmute Shot & Restore Full Row View"
                        >
                          <Volume2 className="w-3 h-3 text-white" />
                          <span>UNMUTE</span>
                        </button>
                      </div>
                    </td>
                    <td colSpan={filteredSlots.length} className="px-3 py-1 text-red-200 font-mono text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                          <span className="text-red-400 font-bold tracking-wide">MUTED SHOT #{shotIdx + 1}</span>
                          <span className="text-red-300/80 text-[11px] truncate max-w-xl">
                            [{shot.sceneShotId || `SC01_SH${String(shotIdx + 1).padStart(2, '0')}`}] — {shot.shotComposition || 'Medium Shot (MS)'}
                          </span>
                        </div>
                        <span className="text-[10px] text-red-400/90 italic font-sans hidden md:inline shrink-0">
                          (Shot Muted & Minimized — Click UNMUTE to expand)
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }

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
                  <td 
                    draggable
                    onDragStart={(e) => handleDragStart(e, shotIdx)}
                    onDragOver={(e) => handleDragOver(e, shotIdx)}
                    onDrop={(e) => handleDrop(e, shotIdx)}
                    onDragEnd={handleDragEnd}
                    className="p-1.5 text-center text-zinc-400 font-mono border-r-2 border-zinc-800 bg-zinc-950 sticky left-0 z-20 group-hover:bg-zinc-900 shadow-[4px_0_10px_rgba(0,0,0,0.5)] cursor-grab active:cursor-grabbing hover:bg-amber-950/30 select-none transition-all"
                  >
                    <div className="flex items-center justify-center gap-1 font-bold">
                      <span className="text-[10px] text-zinc-500 group-hover:text-amber-400 font-mono transition-colors">⋮⋮</span>
                      <span className="text-cyan-400 text-xs">{shotIdx + 1}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                    </div>
                  </td>

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
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (toggleMuteFn) toggleMuteFn(shotIdx);
                        }}
                        className="p-1 rounded bg-zinc-800 hover:bg-red-600 text-zinc-300 hover:text-white transition-colors"
                        title="Mute Shot (Minimise as Thin Red Line)"
                      >
                        <VolumeX className="w-3 h-3 text-red-400 group-hover:text-white" />
                      </button>
                    </div>
                  </td>

                  {filteredSlots.map((slot) => (
                    <td key={slot.key} className="p-2 border-r border-zinc-800/80 align-top">
                      <SlotEditor
                        slotConfig={slot}
                        value={shot[slot.key] || ''}
                        onChange={(val) => handleCellChange(shotIdx, slot.key, val)}
                        compact={true}
                        allSlots={filteredSlots}
                        isForcePopupOpen={activeModalCell?.shotIdx === shotIdx && activeModalCell?.slotKey === slot.key}
                        onOpenPopup={() => setActiveModalCell({ shotIdx, slotKey: slot.key })}
                        onCloseForcePopup={() => setActiveModalCell(null)}
                        onNavigateNextSlot={(slotKey) => handleNavigateNextSlot(shotIdx, slotKey)}
                        onNavigatePrevSlot={(slotKey) => handleNavigatePrevSlot(shotIdx, slotKey)}
                        onJumpToSlot={(targetSlotKey) => setActiveModalCell({ shotIdx, slotKey: targetSlotKey })}
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
            Focus: {currentCategoryObj?.label || 'All 24 Crafts'} ({filteredSlots.length} crafts)
          </span>
        </div>

        <button
          type="button"
          onClick={onCompilePrompt}
          className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Compile Prompts</span>
        </button>
      </div>
    </div>
  );
}
