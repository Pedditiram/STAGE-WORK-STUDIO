import React, { useState, useMemo } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import SlotEditor from './SlotEditor';
import { 
  Plus, Copy, VolumeX, Volume2, Sparkles, 
  Check, Filter
} from 'lucide-react';
import { enhanceEntireShotWithLLM } from '../services/aiScriptParser';
import { parseSceneAndShotID, deriveSceneGroupHeading } from '../utils/sceneShotUtils';

const CATEGORIES = [
  { id: 'all', label: `All ${SEEDANCE_SLOTS.length} Crafts`, keys: [] },
  { id: 'camera', label: '🎥 Camera & Scene (1-5)', keys: ['sceneShotId', 'sceneSynopsis', 'shotComposition', 'cameraMotionTag', 'lensAndFocalLength'] },
  { id: 'lighting', label: '💡 Lighting & Color (6-12)', keys: ['timeAndLightingEnv', 'directionalLightingAndHighlight', 'subjectLightingTag', 'subjectColorTag', 'backgroundLightingTag', 'backgroundColorTag', 'colorPaletteSlot'] },
  { id: 'vfx', label: '✨ Volumetrics (13)', keys: ['atmosphereVolumetricsTag'] },
  { id: 'character', label: '👥 Acting, Mindstate & Mannerisms (14-23)', keys: ['characterIdAssetRef', 'coArtistInteraction', 'actionEnvContext', 'characterExpression', 'characterPsychologyState', 'characterMannerismAndPosture', 'characterPlacement', 'characterDialogue', 'characterMovement', 'characterEyeLooks'] },
  { id: 'audio_optics', label: '🎵 Audio & Score (24-28)', keys: ['shotDurationAndImages', 'soundFxAndFoley', 'backgroundScoreMood'] }
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
  onCompilePrompt,
  colorTheme = 'paper',
  genreKey = 'mythological',
  projectTitle = ''
}) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeModalCell, setActiveModalCell] = useState(null); // { shotIdx, slotKey }

  const [draggedShotIdx, setDraggedShotIdx] = useState(null);
  const [dragOverShotIdx, setDragOverShotIdx] = useState(null);
  const [enhancingShotIdx, setEnhancingShotIdx] = useState(null);
  const [collapsedScenes, setCollapsedScenes] = useState({});

  const isPaperTheme = colorTheme === 'paper' || colorTheme === 'light' || !colorTheme;

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

  const toggleMuteFn = onToggleMuteShot || null;

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

  const handleCellChange = (shotIndex, slotKey, value) => {
    const currentShot = shots[shotIndex];
    if (!currentShot) return;
    onUpdateShot(shotIndex, { ...currentShot, [slotKey]: value });
  };

  const copyShotPrompt = (shot, index) => {
    const promptParts = slots.map(slot => {
      const val = shot[slot.key];
      return val ? `${slot.label}: ${val}` : null;
    }).filter(Boolean);

    const fullPrompt = promptParts.join(' | ');
    navigator.clipboard.writeText(fullPrompt);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAIEnhanceShot = async (shot, shotIdx) => {
    setEnhancingShotIdx(shotIdx);
    try {
      const updatedShot = await enhanceEntireShotWithLLM(shot);
      if (onUpdateShot) {
        onUpdateShot(shotIdx, updatedShot);
      }
    } catch (err) {
      console.error('Failed to enhance shot:', err);
    } finally {
      setEnhancingShotIdx(null);
    }
  };

  // Drag-and-drop shot reordering
  const handleDragStart = (e, shotIdx) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(shotIdx));
    setDraggedShotIdx(shotIdx);
  };

  const handleDragOver = (e, targetShotIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverShotIdx !== targetShotIdx) {
      setDragOverShotIdx(targetShotIdx);
    }
  };

  const handleDrop = (e, targetShotIdx) => {
    e.preventDefault();
    if (draggedShotIdx === null || draggedShotIdx === targetShotIdx) {
      setDraggedShotIdx(null);
      setDragOverShotIdx(null);
      return;
    }

    if (onReorderShots) {
      onReorderShots(draggedShotIdx, targetShotIdx);
    } else if (onMoveShot) {
      onMoveShot(draggedShotIdx, targetShotIdx < draggedShotIdx ? 'up' : 'down');
    }

    if (setActiveShotIndex) {
      setActiveShotIndex(targetShotIdx);
    }

    setDraggedShotIdx(null);
    setDragOverShotIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedShotIdx(null);
    setDragOverShotIdx(null);
  };

  // Group shots by scene
  const sceneGroups = useMemo(() => {
    const groups = [];
    (shots || []).forEach((shot, originalIdx) => {
      const parsed = parseSceneAndShotID(shot, originalIdx);
      const sceneTag = parsed.sceneTag || `SCENE ${String(parsed.sceneNum).padStart(2, '0')}`;
      let existingGroup = groups.find(g => g.sceneTag === sceneTag);
      if (!existingGroup) {
        existingGroup = {
          sceneTag,
          sceneNum: parsed.sceneNum,
          heading: '',
          items: []
        };
        groups.push(existingGroup);
      }
      existingGroup.items.push({ shot, originalIdx });
    });

    // Derive headings from the full scene (not only the first shot — cover pages often land on SH01)
    groups.forEach((group) => {
      const sceneShots = group.items.map((it) => it.shot);
      group.heading = deriveSceneGroupHeading(sceneShots, group.sceneNum);
    });

    return groups;
  }, [shots]);

  const scenesList = useMemo(() => {
    return (shots || []).reduce((acc, s, idx) => {
      const parsed = parseSceneAndShotID(s, idx);
      const sceneId = parsed.sceneStr || `SC${String(Math.floor(idx / 3) + 1).padStart(2, '0')}`;
      const sceneLabel = parsed.sceneTag || `SCENE ${String(Math.floor(idx / 3) + 1).padStart(2, '0')}`;
      if (!acc.some(sc => sc.sceneId === sceneId)) {
        acc.push({ sceneId, label: sceneLabel, firstShotIndex: idx });
      }
      return acc;
    }, []);
  }, [shots]);

  const toggleSceneCollapse = (sceneTag, e) => {
    if (e?.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const allCollapsed = sceneGroups.every((g) => collapsedScenes[g.sceneTag]);
      if (allCollapsed) {
        // Alt+click again when everything is minimized → expand all
        setCollapsedScenes({});
      } else {
        const next = {};
        sceneGroups.forEach((g) => {
          next[g.sceneTag] = true;
        });
        setCollapsedScenes(next);
      }
      return;
    }
    setCollapsedScenes((prev) => ({ ...prev, [sceneTag]: !prev[sceneTag] }));
  };

  return (
    <div 
      style={isPaperTheme ? { backgroundColor: '#f4f7fb', color: '#0f172a' } : { backgroundColor: '#07090f', color: '#ffffff' }}
      className="flex flex-col h-full w-full select-text overflow-hidden sps-view-enter"
    >
      {/* CRAFT CATEGORY FILTER TABS TOOLBAR */}
      <div 
        style={isPaperTheme ? { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: '#dbe3ee' } : { backgroundColor: 'rgba(20,26,36,0.88)', borderColor: 'rgba(148,163,184,0.14)' }}
        className="sps-matrix-toolbar p-2 sm:p-2.5 px-2 sm:px-4 border-b flex items-center justify-between gap-2 sm:gap-3 flex-wrap z-20"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto sps-header-scroll max-w-full pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 mr-1 shrink-0 ${
            isPaperTheme ? 'text-slate-700' : 'text-zinc-400'
          }`} style={{ fontFamily: 'var(--sps-font)' }}>
            <Filter className={`w-3.5 h-3.5 ${isPaperTheme ? 'text-amber-600' : 'text-amber-500'}`} />
            Focus:
          </span>
          {CATEGORIES.map((cat) => {
            const isCatActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={
                  isCatActive 
                    ? { backgroundColor: '#f59e0b', color: '#000000', borderColor: '#d97706' } 
                    : isPaperTheme 
                      ? { backgroundColor: '#ffffff', color: '#334155', borderColor: '#dbe3ee' } 
                      : { backgroundColor: 'rgba(7,9,15,0.8)', color: '#d4d4d8', borderColor: 'rgba(148,163,184,0.18)' }
                }
                className="sps-cat-chip px-3 py-1.5 sm:py-1 rounded-xl text-xs font-bold border cursor-pointer shadow-sm shrink-0 min-h-[2rem]"
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span 
            style={isPaperTheme ? { backgroundColor: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' } : { backgroundColor: 'rgba(7,9,15,0.85)', borderColor: 'rgba(148,163,184,0.18)', color: '#d4d4d8' }}
            className="text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-xl border shadow-sm whitespace-nowrap"
          >
            {sceneGroups.length} Scenes · {(shots || []).length} Shots
          </span>
        </div>
      </div>

      {/* MATRIX WORKSPACE SPREADSHEET TABLE */}
      <div className="sps-matrix-scroll flex-1 overflow-auto scrollbar-thin relative">
        <table className="w-full text-left border-collapse text-xs" style={{ fontFamily: 'var(--sps-font-mono)' }}>
          <thead>
            <tr 
              style={isPaperTheme ? { backgroundColor: 'rgba(255,255,255,0.96)', color: '#0f172a', borderColor: '#dbe3ee' } : { backgroundColor: 'rgba(20,26,36,0.95)', color: '#d4d4d8', borderColor: 'rgba(148,163,184,0.14)' }}
              className="font-bold border-b sticky top-0 z-30 backdrop-blur-md"
            >
              <th 
                style={isPaperTheme ? { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#dbe3ee' } : { backgroundColor: 'rgba(20,26,36,0.95)', borderColor: 'rgba(148,163,184,0.14)' }}
                className="p-2 w-[40px] min-w-[40px] text-center border-r sticky left-0 z-40 shadow-sm"
              >
                #
              </th>
              <th 
                style={isPaperTheme ? { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#dbe3ee' } : { backgroundColor: 'rgba(20,26,36,0.95)', borderColor: 'rgba(148,163,184,0.14)' }}
                className="p-2 w-[90px] min-w-[90px] text-center border-r"
              >
                Actions
              </th>
              {filteredSlots.map((slot) => (
                <th 
                  key={slot.key} 
                  style={isPaperTheme ? { borderColor: '#dbe3ee' } : { borderColor: 'rgba(148,163,184,0.14)' }}
                  className={`sps-matrix-slot p-2 px-3 border-r min-w-[150px] max-w-[220px] uppercase tracking-wider text-[10px] font-bold ${
                    isPaperTheme ? 'text-slate-700' : 'text-cyan-300/90'
                  }`}
                >
                  {slot.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className={`divide-y ${isPaperTheme ? 'divide-slate-200 bg-[#f4f7fb]' : 'divide-white/[0.06] bg-[#07090f]'}`} style={{ fontFamily: 'var(--sps-font)' }}>
            {sceneGroups.map((group) => {
              const isCollapsed = Boolean(collapsedScenes[group.sceneTag]);
              const firstShot = group.items[0]?.shot;
              const lastShot = group.items[group.items.length - 1]?.shot;
              const rangeTag = `${firstShot?.sceneShotId || `S${group.items[0].originalIdx + 1}`} to ${lastShot?.sceneShotId || `S${group.items[group.items.length - 1].originalIdx + 1}`}`;

              return (
                <React.Fragment key={group.sceneTag}>
                  {/* CINEMATIC SCENE GROUP HEADING BANNER ROW */}
                  <tr 
                    style={
                      isPaperTheme 
                        ? { backgroundColor: '#fef3c7', borderColor: '#fcd34d', color: '#451a03' } 
                        : { backgroundColor: '#18181b', borderColor: '#f59e0b60', color: '#ffffff' }
                    }
                    className="border-y-2 sticky top-[33px] z-20 shadow-md select-none backdrop-blur-md"
                  >
                    <td colSpan={filteredSlots.length + 2} className="p-2.5 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div 
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={(e) => toggleSceneCollapse(group.sceneTag, e)}
                          title={isCollapsed ? 'Click to expand · Alt+click expands all scenes' : 'Click to minimize · Alt+click minimizes all scenes'}
                        >
                          <button 
                            type="button" 
                            style={isPaperTheme ? { backgroundColor: '#f59e0b', color: '#000000' } : { backgroundColor: '#09090b', color: '#f59e0b' }}
                            className="w-5 h-5 rounded-md font-bold flex items-center justify-center text-xs border border-amber-500/40"
                            title={isCollapsed ? 'Expand scene · Alt+click = expand all' : 'Minimize scene · Alt+click = minimize all'}
                            aria-label={isCollapsed ? 'Expand scene' : 'Minimize scene'}
                          >
                            {isCollapsed ? '+' : '−'}
                          </button>
                          <span 
                            style={{ backgroundColor: '#f59e0b', color: '#000000' }}
                            className="px-3 py-1 rounded-lg font-black text-xs font-mono shadow-sm uppercase tracking-wide"
                          >
                            🎬 {group.sceneTag}
                          </span>
                          <h3
                            className={`text-xs sm:text-sm font-bold tracking-tight truncate max-w-3xl ${
                              isPaperTheme ? 'text-amber-950' : 'text-white'
                            }`}
                            style={{ fontFamily: 'var(--sps-font)' }}
                            title={group.heading}
                          >
                            {group.heading}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3">
                          <span 
                            style={isPaperTheme ? { backgroundColor: '#ffffff', borderColor: '#fcd34d', color: '#78350f' } : { backgroundColor: '#09090b', borderColor: '#27272a', color: '#d4d4d8' }}
                            className="text-[11px] font-mono font-bold px-3 py-1 rounded-md border shadow-sm"
                          >
                            {group.items.length} {group.items.length === 1 ? 'Shot' : 'Shots'} ({rangeTag})
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* SHOT ROWS IN THIS SCENE */}
                  {!isCollapsed && group.items.map(({ shot, originalIdx: shotIdx }) => {
                    if (!shot) return null;
                    const isActive = shotIdx === activeShotIndex;
                    const isMuted = !!shot?.isMuted;
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
                          className={`bg-red-500/10 hover:bg-red-500/20 border-y border-red-500/30 transition-all text-xs h-9 ${
                            isBeingDragged ? 'opacity-30' : ''
                          } ${
                            isTargetDrop ? 'border-t-2 border-t-amber-500' : ''
                          }`}
                        >
                          <td 
                            draggable
                            onDragStart={(e) => handleDragStart(e, shotIdx)}
                            onDragOver={(e) => handleDragOver(e, shotIdx)}
                            onDrop={(e) => handleDrop(e, shotIdx)}
                            onDragEnd={handleDragEnd}
                            className="p-1 text-center font-mono border-r border-red-500/30 bg-red-500/20 sticky left-0 z-20 cursor-grab active:cursor-grabbing select-none transition-all"
                            title="Click & drag shot to move"
                          >
                            <div className="flex items-center justify-center gap-1 font-bold">
                              <span className="text-[10px] text-red-500 font-mono">⋮⋮</span>
                              <span className="text-red-700 dark:text-red-300 font-bold text-xs">{shotIdx + 1}</span>
                            </div>
                          </td>
                          <td className="p-1 border-r border-red-500/30 text-center bg-red-500/10">
                            <button
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (toggleMuteFn) toggleMuteFn(shotIdx);
                              }}
                              className="px-2.5 py-0.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all border border-red-400 shadow-sm cursor-pointer mx-auto"
                              title="Unmute Shot"
                            >
                              <Volume2 className="w-3 h-3 text-white" />
                              <span>UNMUTE</span>
                            </button>
                          </td>
                          <td colSpan={filteredSlots.length} className="px-3 py-1 text-red-700 dark:text-red-200 font-mono text-xs">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                                <span className="text-red-600 font-bold tracking-wide">MUTED SHOT #{shotIdx + 1}</span>
                                <span className="text-red-500 text-[11px] truncate max-w-xl">
                                  [{parseSceneAndShotID(shot, shotIdx).shortId}] — {shot.shotComposition || 'Medium Shot'}
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
                        className={`sps-matrix-row transition-all group ${
                          isActive 
                            ? isPaperTheme 
                              ? 'bg-amber-100/90 border-l-4 border-amber-500' 
                              : 'bg-cyan-950/30 border-l-4 border-cyan-500'
                            : isPaperTheme 
                              ? 'hover:bg-amber-50/80 bg-white' 
                              : 'hover:bg-zinc-900/50 bg-zinc-950'
                        } ${
                          isBeingDragged ? 'opacity-30 bg-amber-950/40' : ''
                        } ${
                          isTargetDrop ? 'border-t-2 border-t-amber-400' : ''
                        }`}
                      >
                        <td 
                          draggable
                          onDragStart={(e) => handleDragStart(e, shotIdx)}
                          onDragOver={(e) => handleDragOver(e, shotIdx)}
                          onDrop={(e) => handleDrop(e, shotIdx)}
                          onDragEnd={handleDragEnd}
                          style={
                            isPaperTheme 
                              ? { backgroundColor: '#fef3c7', borderColor: '#fde68a', color: '#451a03' } 
                              : { backgroundColor: '#18181b', borderColor: '#27272a', color: '#d4d4d8' }
                          }
                          className="p-1.5 text-center font-mono border-r sticky left-0 z-20 shadow-sm cursor-grab active:cursor-grabbing hover:bg-amber-400 hover:text-black select-none transition-all"
                        >
                          <div className="flex items-center justify-center gap-1 font-bold">
                            <span className="text-[10px] opacity-60 font-mono">⋮⋮</span>
                            <span className="text-xs font-bold">{shotIdx + 1}</span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            )}
                          </div>
                        </td>

                        <td 
                          style={isPaperTheme ? { backgroundColor: '#ffffff', borderColor: '#fde68a' } : { backgroundColor: '#18181b', borderColor: '#27272a' }}
                          className="p-1 border-r"
                        >
                          <div className="sps-matrix-actions flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleAIEnhanceShot(shot, shotIdx); }}
                              disabled={enhancingShotIdx === shotIdx}
                              style={isPaperTheme ? { backgroundColor: '#fef3c7', borderColor: '#fde68a', color: '#78350f' } : { backgroundColor: '#09090b', borderColor: '#27272a', color: '#f59e0b' }}
                              className="p-1 rounded-lg border hover:bg-amber-400 hover:text-black transition-all cursor-pointer"
                              title="⚡ AI Enhance Full Shot with Pedditi Labs Engine"
                            >
                              <Sparkles className={`w-3 h-3 ${enhancingShotIdx === shotIdx ? 'animate-spin text-amber-500' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); copyShotPrompt(shot, shotIdx); }}
                              style={isPaperTheme ? { backgroundColor: '#fef3c7', borderColor: '#fde68a', color: '#78350f' } : { backgroundColor: '#09090b', borderColor: '#27272a', color: '#d4d4d8' }}
                              className="p-1 rounded-lg border hover:bg-amber-400 hover:text-black transition-all cursor-pointer"
                              title="Copy Shot Prompt"
                            >
                              {copiedIndex === shotIdx ? <Check className="w-3 h-3 text-emerald-600 stroke-[3]" /> : <Copy className="w-3 h-3" />}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onCloneShot(shotIdx); }}
                              style={isPaperTheme ? { backgroundColor: '#fef3c7', borderColor: '#fde68a', color: '#78350f' } : { backgroundColor: '#09090b', borderColor: '#27272a', color: '#d4d4d8' }}
                              className="p-1 rounded-lg border hover:bg-amber-400 hover:text-black transition-all cursor-pointer"
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
                              style={isPaperTheme ? { backgroundColor: '#fef3c7', borderColor: '#fde68a', color: '#dc2626' } : { backgroundColor: '#09090b', borderColor: '#27272a', color: '#ef4444' }}
                              className="p-1 rounded-lg border hover:bg-red-600 hover:text-white transition-all cursor-pointer"
                              title="Mute Shot"
                            >
                              <VolumeX className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        </td>

                        {filteredSlots.map((slot) => {
                          const parsedCurr = parseSceneAndShotID(shot, shotIdx);
                          const currentSceneId = parsedCurr.sceneStr || `SC${String(Math.floor(shotIdx / 3) + 1).padStart(2, '0')}`;
                          const currSceneIdx = scenesList.findIndex(sc => sc.sceneId === currentSceneId);

                          return (
                            <td 
                              key={slot.key} 
                              style={isPaperTheme ? { borderColor: '#fde68a' } : { borderColor: '#27272a' }}
                              className="sps-matrix-slot p-1.5 border-r align-top min-w-[150px] max-w-[220px]"
                            >
                              <SlotEditor
                                slotConfig={slot}
                                value={shot[slot.key] || ''}
                                onChange={(val) => handleCellChange(shotIdx, slot.key, val)}
                                shot={shot}
                                isMuted={Boolean(shot?.mutedSlots?.[slot.key])}
                                onToggleMute={(slotKey) => {
                                  const currentMuted = shot?.mutedSlots || {};
                                  const updatedMuted = { ...currentMuted, [slotKey]: !currentMuted[slotKey] };
                                  onUpdateShot(shotIdx, { ...shot, mutedSlots: updatedMuted });
                                }}
                                compact={true}
                                colorTheme={colorTheme}
                                genreKey={genreKey}
                                projectTitle={projectTitle}
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
                                  const sc = scenesList.find(s => s.sceneId === targetScId);
                                  if (sc && setActiveShotIndex) {
                                    setActiveShotIndex(sc.firstShotIndex);
                                    setActiveModalCell({ shotIdx: sc.firstShotIndex, slotKey: slot.key });
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

      {/* FOOTER TOOLBAR */}
      <div 
        style={isPaperTheme ? { backgroundColor: '#FAF8F5', borderColor: '#fde68a' } : { backgroundColor: '#18181b', borderColor: '#27272a' }}
        className="p-3 border-t flex items-center justify-between gap-3 flex-wrap shadow-md"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold ${isPaperTheme ? 'text-amber-950' : 'text-zinc-400'}`}>
            Focus: <span className="text-amber-600 dark:text-amber-400">{currentCategoryObj?.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddShot}
            style={{ backgroundColor: '#f59e0b', color: '#000000' }}
            className="px-3.5 py-1.5 rounded-xl font-black text-xs font-mono flex items-center gap-1.5 shadow-md hover:bg-amber-400 cursor-pointer transition-all uppercase tracking-wide"
            title="Add shot into the selected scene (after active row)"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Shot</span>
          </button>

          <button
            type="button"
            onClick={onCompilePrompt}
            style={isPaperTheme ? { backgroundColor: '#ffffff', borderColor: '#fcd34d', color: '#451a03' } : { backgroundColor: '#09090b', borderColor: '#27272a', color: '#d4d4d8' }}
            className="px-3.5 py-1.5 rounded-xl font-bold text-xs font-mono border flex items-center gap-1.5 shadow-sm hover:bg-amber-400 hover:text-black cursor-pointer transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Compile Prompts</span>
          </button>
        </div>
      </div>
    </div>
  );
}
