import React, { useState } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import SlotEditor from './SlotEditor';
import { 
  Plus, Copy, VolumeX, Volume2, ArrowUp, ArrowDown, Sparkles, 
  Check, Layers, Search, Filter
} from 'lucide-react';
import { enhanceEntireShotWithLLM } from '../services/aiScriptParser';

const CATEGORIES = [
  { id: 'all', label: 'All 25 Crafts', keys: [] },
  { id: 'camera', label: '🎥 Camera & Rigging (1-3)', keys: ['sceneShotId', 'shotComposition', 'cameraMotionTag'] },
  { id: 'lighting', label: '💡 Lighting & Color (4-7)', keys: ['subjectLightingTag', 'subjectColorTag', 'backgroundLightingTag', 'backgroundColorTag'] },
  { id: 'vfx', label: '✨ Volumetrics & FX (#8, #21)', keys: ['atmosphereVolumetricsTag', 'vfxCgiBreakdown'] },
  { id: 'character', label: '👥 Acting & Characters (9-16, #23, #25)', keys: ['characterIdAssetRef', 'coArtistInteraction', 'actionEnvContext', 'characterExpression', 'characterPlacement', 'characterDialogue', 'characterMovement', 'characterEyeLooks', 'makeupAndHairStyle', 'characterIdMatrix'] },
  { id: 'audio_optics', label: '🎵 Audio, Optics & Edit (17-20, #22, #24)', keys: ['shotDurationAndImages', 'soundFxAndFoley', 'backgroundScoreMood', 'lensAndFocalLength', 'stuntAndSafetyNotes', 'editTransitionCut'] }
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
  activeShotIndex = 0, 
  setActiveShotIndex,
  onCompilePrompt
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeModalCell, setActiveModalCell] = useState(null); // { shotIdx, slotKey }

  const [draggedShotIdx, setDraggedShotIdx] = useState(null);
  const [dragOverShotIdx, setDragOverShotIdx] = useState(null);
  const [enhancingShotIdx, setEnhancingShotIdx] = useState(null);

  // Global keyboard navigation for main matrix view when no cell modal is active
  React.useEffect(() => {
    if (activeModalCell !== null) return;

    const handleGlobalMatrixKeyDown = (e) => {
      const isModifier = e.metaKey || e.ctrlKey || e.altKey;
      const key = e.key;
      const isUp = key === 'ArrowUp' || key === 'Up';
      const isDown = key === 'ArrowDown' || key === 'Down';

      if (!isModifier) return;

      if (!e.shiftKey && isDown) {
        e.preventDefault();
        const total = (shots || []).length;
        if (total > 0 && setActiveShotIndex) {
          setActiveShotIndex(prev => (prev < total - 1 ? prev + 1 : 0));
        }
      } else if (!e.shiftKey && isUp) {
        e.preventDefault();
        const total = (shots || []).length;
        if (total > 0 && setActiveShotIndex) {
          setActiveShotIndex(prev => (prev > 0 ? prev - 1 : total - 1));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalMatrixKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalMatrixKeyDown, true);
  }, [activeModalCell, shots, setActiveShotIndex]);

  const toggleMuteFn = onToggleMuteShot || onDeleteShot;

  const currentCategoryObj = CATEGORIES.find(c => c.id === activeCategory);
  const filteredSlots = (slots || []).filter(slot => {
    if (activeCategory === 'all') return true;
    return currentCategoryObj?.keys.includes(slot.key);
  });

  const handleNavigateNextSlot = React.useCallback((currentShotIdx, currentSlotKey) => {
    const slotKeys = filteredSlots.map(s => s.key);
    const currIdx = slotKeys.indexOf(currentSlotKey);
    if (currIdx !== -1 && currIdx < slotKeys.length - 1) {
      setActiveModalCell({ shotIdx: currentShotIdx, slotKey: slotKeys[currIdx + 1] });
    } else if (currentShotIdx < (shots || []).length - 1) {
      if (setActiveShotIndex) setActiveShotIndex(currentShotIdx + 1);
      setActiveModalCell({ shotIdx: currentShotIdx + 1, slotKey: slotKeys[0] });
    }
  }, [filteredSlots, shots, setActiveShotIndex]);

  const handleNavigatePrevSlot = React.useCallback((currentShotIdx, currentSlotKey) => {
    const slotKeys = filteredSlots.map(s => s.key);
    const currIdx = slotKeys.indexOf(currentSlotKey);
    if (currIdx > 0) {
      setActiveModalCell({ shotIdx: currentShotIdx, slotKey: slotKeys[currIdx - 1] });
    } else if (currentShotIdx > 0) {
      if (setActiveShotIndex) setActiveShotIndex(currentShotIdx - 1);
      setActiveModalCell({ shotIdx: currentShotIdx - 1, slotKey: slotKeys[slotKeys.length - 1] });
    }
  }, [filteredSlots, shots, setActiveShotIndex]);

  const filteredShots = (shots || []).filter((shot, idx) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return Object.values(shot || {}).some(val => 
      val && String(val).toLowerCase().includes(searchLower)
    ) || `shot ${idx + 1}`.includes(searchLower);
  });

  const handleDragStart = React.useCallback((e, index) => {
    setDraggedShotIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = React.useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverShotIdx(prev => (prev !== index ? index : prev));
  }, []);

  const handleDrop = React.useCallback((e, targetIndex) => {
    e.preventDefault();
    if (draggedShotIdx !== null && draggedShotIdx !== targetIndex && onReorderShots) {
      onReorderShots(draggedShotIdx, targetIndex);
    }
    setDraggedShotIdx(null);
    setDragOverShotIdx(null);
  }, [draggedShotIdx, onReorderShots]);

  const handleDragEnd = React.useCallback(() => {
    setDraggedShotIdx(null);
    setDragOverShotIdx(null);
  }, []);

  const handleCellChange = React.useCallback((shotIdx, key, newValue) => {
    if (shots && shots[shotIdx] && onUpdateShot) {
      onUpdateShot(shotIdx, key, newValue);
    }
  }, [shots, onUpdateShot]);

  const copyShotPrompt = (shot, idx) => {
    if (!shot) return;
    const compiled = (slots || []).map(slot => shot[slot.key]).filter(Boolean).join(' | ');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(compiled);
    }
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAIEnhanceShot = async (shot, shotIdx) => {
    try {
      setEnhancingShotIdx(shotIdx);
      const enhancedShot = await enhanceEntireShotWithLLM(shot);
      if (enhancedShot && onUpdateShot) {
        Object.entries(enhancedShot).forEach(([k, v]) => {
          onUpdateShot(shotIdx, k, v);
        });
      }
    } catch (err) {
      console.warn("Error enhancing shot with AI:", err);
    } finally {
      setEnhancingShotIdx(null);
    }
  };

  // -------------------------------------------------------------
  // SCENE GROUPING ENGINE
  // -------------------------------------------------------------
  const [collapsedScenes, setCollapsedScenes] = useState({});

  const toggleSceneCollapse = (sceneTag) => {
    setCollapsedScenes(prev => ({ ...prev, [sceneTag]: !prev[sceneTag] }));
  };

  const getSceneInfo = (shot, idx) => {
    const rawId = shot?.sceneShotId || `SC01_SH${idx + 1}`;
    const match = rawId.match(/(?:SC|S)\.?\s*0*(\d+)/i) || rawId.match(/Scene\s*0*(\d+)/i);
    const sceneNum = match ? parseInt(match[1], 10) : (Math.floor(idx / 3) + 1);
    const sceneTag = `SCENE ${sceneNum < 10 ? '0' + sceneNum : sceneNum}`;

    let heading = 'CINEMATIC LOCATION & ENVIRONMENT';
    if (shot?.sceneHeading) {
      heading = shot.sceneHeading;
    } else if (shot?.actionEnvContext) {
      let clean = shot.actionEnvContext.replace(/\[|\]/g, '').trim();
      if (clean.includes(';')) clean = clean.split(';')[0];
      if (clean.includes('.')) clean = clean.split('.')[0];
      heading = clean.toUpperCase();
    }
    return { sceneTag, sceneNum, heading };
  };

  const sceneGroups = React.useMemo(() => {
    const groups = [];
    let currentGroup = null;

    filteredShots.forEach((shot, originalIdx) => {
      const { sceneTag, heading } = getSceneInfo(shot, originalIdx);
      if (!currentGroup || currentGroup.sceneTag !== sceneTag) {
        currentGroup = {
          sceneTag,
          heading,
          items: []
        };
        groups.push(currentGroup);
      }
      currentGroup.items.push({ shot, originalIdx });
    });

    return groups;
  }, [filteredShots]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl font-mono">
      {/* Category Tab Bar Header */}
      <div className="p-2 px-3 border-b border-zinc-800/80 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
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
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer border ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.4)] scale-105'
                    : 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[10.5px] font-mono text-cyan-300 font-bold bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
          🎬 {sceneGroups.length} Scenes · {filteredShots.length} Shots
        </span>
      </div>

      {/* Main High-Density Spreadsheet Table */}
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950 relative">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-900 text-zinc-300 font-semibold border-b border-zinc-800 sticky top-0 z-30 backdrop-blur-md">
              <th className="p-2 w-[42px] min-w-[42px] text-center border-r-2 border-zinc-800 bg-zinc-900 sticky left-0 z-40 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
                #
              </th>
              <th className="p-2 w-[90px] min-w-[90px] text-center border-r border-zinc-800 bg-zinc-900">
                Actions
              </th>
              {filteredSlots.map((slot) => (
                <th key={slot.key} className="p-2 px-3 border-r border-zinc-800 min-w-[180px] font-mono text-cyan-300">
                  {slot.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800/80 bg-zinc-950 font-sans">
            {sceneGroups.map((group) => {
              const isCollapsed = Boolean(collapsedScenes[group.sceneTag]);
              const firstShot = group.items[0]?.shot;
              const lastShot = group.items[group.items.length - 1]?.shot;
              const rangeTag = `${firstShot?.sceneShotId || `S${group.items[0].originalIdx + 1}`} to ${lastShot?.sceneShotId || `S${group.items[group.items.length - 1].originalIdx + 1}`}`;

              return (
                <React.Fragment key={group.sceneTag}>
                  {/* CINEMATIC SCENE GROUP HEADING BANNER ROW */}
                  <tr className="bg-gradient-to-r from-cyan-950/90 via-zinc-900 to-purple-950/90 border-y-2 border-cyan-500/50 backdrop-blur-md sticky top-[33px] z-20 shadow-md select-none">
                    <td colSpan={filteredSlots.length + 2} className="p-2 px-3">
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-2.5 cursor-pointer"
                          onClick={() => toggleSceneCollapse(group.sceneTag)}
                        >
                          <button 
                            type="button" 
                            className="w-5 h-5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center text-xs border border-cyan-500/40"
                          >
                            {isCollapsed ? '+' : '−'}
                          </button>
                          <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500 text-zinc-950 font-black text-xs font-mono shadow">
                            🎬 {group.sceneTag}
                          </span>
                          <h3 className="text-xs font-bold text-white font-mono tracking-wide uppercase truncate max-w-xl">
                            {group.heading}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[10.5px] font-mono text-cyan-300 font-bold bg-zinc-950/80 px-2.5 py-0.5 rounded-md border border-cyan-500/30">
                            {group.items.length} {group.items.length === 1 ? 'Shot' : 'Shots'} ({rangeTag})
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* SHOT ROWS IN THIS SCENE */}
                  {!isCollapsed && group.items.map(({ shot, originalIdx: shotIdx }) => {
                    const isActive = shotIdx === activeShotIndex;
                    const isMuted = !!shot.isMuted;
                    const isBeingDragged = draggedShotIdx === shotIdx;
                    const isTargetDrop = dragOverShotIdx === shotIdx;

              // MINIMIZED MUTED ROW
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
                      title="Click & drag shot to move"
                    >
                      <div className="flex items-center justify-center gap-1 font-bold">
                        <span className="text-[10px] text-red-400 font-mono">⋮⋮</span>
                        <span className="text-red-300 font-bold text-xs">{shotIdx + 1}</span>
                      </div>
                    </td>
                    <td className="p-1 border-r border-red-500/40 text-center bg-red-950/90">
                      <button
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (toggleMuteFn) toggleMuteFn(shotIdx);
                        }}
                        className="px-2 py-0.5 rounded bg-red-700 hover:bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 transition-all border border-red-400 shadow-sm cursor-pointer mx-auto"
                        title="Unmute Shot"
                      >
                        <Volume2 className="w-3 h-3 text-white" />
                        <span>UNMUTE</span>
                      </button>
                    </td>
                    <td colSpan={filteredSlots.length} className="px-3 py-1 text-red-200 font-mono text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                          <span className="text-red-400 font-bold tracking-wide">MUTED SHOT #{shotIdx + 1}</span>
                          <span className="text-red-300/80 text-[11px] truncate max-w-xl">
                            [{shot.sceneShotId || `SC01_SH${String(shotIdx + 1).padStart(2, '0')}`}] — {shot.shotComposition || 'Medium Shot'}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }

              // SINGLE-LINE STANDARD ROW
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
                        onClick={(e) => { e.stopPropagation(); handleAIEnhanceShot(shot, shotIdx); }}
                        disabled={enhancingShotIdx === shotIdx}
                        className="p-1 rounded bg-zinc-800 hover:bg-purple-600 text-amber-300 hover:text-white transition-all border border-purple-500/30"
                        title="⚡ AI Enhance Full Shot with Pedditi Labs Engine"
                      >
                        <Sparkles className={`w-3 h-3 ${enhancingShotIdx === shotIdx ? 'animate-spin text-purple-400' : 'text-amber-300'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); copyShotPrompt(shot, shotIdx); }}
                        className="p-1 rounded bg-zinc-800 hover:bg-cyan-600 text-zinc-300 hover:text-white transition-colors"
                        title="Copy Shot Prompt"
                      >
                        {copiedIndex === shotIdx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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
                        title="Mute Shot"
                      >
                        <VolumeX className="w-3 h-3 text-red-400 group-hover:text-white" />
                      </button>
                    </div>
                  </td>

                  {filteredSlots.map((slot) => {
                    const scenesList = (shots || []).reduce((acc, s, idx) => {
                      const rawId = s.sceneShotId || `SC01_SH${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`;
                      const match = rawId.match(/^(SC\d+)/i);
                      const sceneId = match ? match[1].toUpperCase() : `Scene #${idx + 1}`;
                      if (!acc.some(sc => sc.sceneId === sceneId)) {
                        acc.push({ sceneId, label: sceneId, firstShotIndex: idx });
                      }
                      return acc;
                    }, []);

                    const rawCurrId = shot.sceneShotId || `SC01_SH${shotIdx + 1 < 10 ? '0' + (shotIdx + 1) : shotIdx + 1}`;
                    const matchCurr = rawCurrId.match(/^(SC\d+)/i);
                    const currentSceneId = matchCurr ? matchCurr[1].toUpperCase() : `Scene #${shotIdx + 1}`;
                    const currSceneIdx = scenesList.findIndex(sc => sc.sceneId === currentSceneId);

                    return (
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
                          totalShotsCount={(shots || []).length}
                          currentShotIndex={shotIdx}
                          onNavigateNextShot={() => {
                            const total = (shots || []).length;
                            const nextShotIdx = (shotIdx + 1) % total;
                            if (setActiveShotIndex) setActiveShotIndex(nextShotIdx);
                            setActiveModalCell({ shotIdx: nextShotIdx, slotKey: slot.key });
                          }}
                          onNavigatePrevShot={() => {
                            const total = (shots || []).length;
                            const prevShotIdx = (shotIdx - 1 + total) % total;
                            if (setActiveShotIndex) setActiveShotIndex(prevShotIdx);
                            setActiveModalCell({ shotIdx: prevShotIdx, slotKey: slot.key });
                          }}
                          scenesList={scenesList}
                          currentSceneId={currentSceneId}
                          onNavigateNextScene={() => {
                            const targetIdx = (currSceneIdx !== -1 && currSceneIdx < scenesList.length - 1)
                              ? scenesList[currSceneIdx + 1].firstShotIndex
                              : (scenesList[0]?.firstShotIndex || 0);
                            if (setActiveShotIndex) setActiveShotIndex(targetIdx);
                            setActiveModalCell({ shotIdx: targetIdx, slotKey: slot.key });
                          }}
                          onNavigatePrevScene={() => {
                            const targetIdx = currSceneIdx > 0
                              ? scenesList[currSceneIdx - 1].firstShotIndex
                              : (scenesList[scenesList.length - 1]?.firstShotIndex || 0);
                            if (setActiveShotIndex) setActiveShotIndex(targetIdx);
                            setActiveModalCell({ shotIdx: targetIdx, slotKey: slot.key });
                          }}
                          onJumpToScene={(targetScId) => {
                            const found = scenesList.find(sc => sc.sceneId === targetScId);
                            if (found) {
                              if (setActiveShotIndex) setActiveShotIndex(found.firstShotIndex);
                              setActiveModalCell({ shotIdx: found.firstShotIndex, slotKey: slot.key });
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </React.Fragment>
        );
      })}
    </tbody>
        </table>
      </div>

      {/* Spreadsheet Footer Status & Control Bar (Utilizing Empty Bottom Space) */}
      <div className="p-2.5 px-4 border-t border-zinc-800/80 bg-zinc-900/90 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2 shrink-0 backdrop-blur-md">
        {/* Left Side Info */}
        <div className="flex items-center gap-2">
          <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 text-zinc-200">
            Shots: <strong className="text-white">{shots.length}</strong>
          </span>
          <span className="text-amber-300 font-mono text-[11px] truncate hidden sm:inline">
            Focus: {currentCategoryObj?.label || 'All 25 Crafts'} ({filteredSlots.length} crafts)
          </span>
        </div>

        {/* Center Section: Search Bar & Add Shot Button occupying bottom empty space */}
        <div className="flex items-center gap-2 flex-1 justify-center max-w-xl">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search shots..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="button"
            onClick={onAddShot}
            className="px-3.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Shot</span>
          </button>
        </div>

        {/* Right Side Trigger */}
        <button
          type="button"
          onClick={onCompilePrompt}
          className="px-3.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Compile Prompts</span>
        </button>
      </div>
    </div>
  );
}
