import React, { useState, useEffect } from 'react';
import { Sparkles, Maximize2, X, Check, Trash2, Star, Plus, Sliders, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';

export default function SlotEditor({ 
  slotConfig, 
  value, 
  onChange, 
  compact = false, 
  onSelectSlot,
  isForcePopupOpen,
  onCloseForcePopup,
  onOpenPopup,
  onNavigateNextSlot,
  onNavigatePrevSlot,
  allSlots = [],
  onJumpToSlot
}) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [newPresetInput, setNewPresetInput] = useState('');
  const [activeConfig, setActiveConfig] = useState(slotConfig);

  useEffect(() => {
    setActiveConfig(slotConfig);
  }, [slotConfig]);

  const availableSlotsList = (allSlots && allSlots.length > 0) ? allSlots : SEEDANCE_SLOTS;

  const isModalActive = Boolean(isForcePopupOpen || isPopupOpen);
  
  const handleCloseModal = () => {
    setIsPopupOpen(false);
    if (onCloseForcePopup) onCloseForcePopup();
  };

  const handleOpenModal = () => {
    setIsPopupOpen(true);
    if (onOpenPopup) onOpenPopup();
  };

  const handlePrevSlot = () => {
    const idx = availableSlotsList.findIndex(s => s.key === activeConfig.key);
    const prevIdx = idx > 0 ? idx - 1 : availableSlotsList.length - 1;
    const targetSlot = availableSlotsList[prevIdx];
    setActiveConfig(targetSlot);
    if (onJumpToSlot) onJumpToSlot(targetSlot.key);
    if (onNavigatePrevSlot) onNavigatePrevSlot(activeConfig.key);
  };

  const handleNextSlot = () => {
    const idx = availableSlotsList.findIndex(s => s.key === activeConfig.key);
    const nextIdx = idx < availableSlotsList.length - 1 ? idx + 1 : 0;
    const targetSlot = availableSlotsList[nextIdx];
    setActiveConfig(targetSlot);
    if (onJumpToSlot) onJumpToSlot(targetSlot.key);
    if (onNavigateNextSlot) onNavigateNextSlot(activeConfig.key);
  };

  const handleDirectJump = (targetKey) => {
    const targetSlot = availableSlotsList.find(s => s.key === targetKey);
    if (targetSlot) {
      setActiveConfig(targetSlot);
      if (onJumpToSlot) onJumpToSlot(targetKey);
    }
  };

  // Keyboard navigation for Cmd + Right Arrow and Cmd + Left Arrow
  useEffect(() => {
    if (!isModalActive) return;

    const handleKeyDown = (e) => {
      // Cmd + Right Arrow (⌘→) or Ctrl + Right Arrow -> Next Slot
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        handleNextSlot();
      }
      // Cmd + Left Arrow (⌘←) or Ctrl + Left Arrow -> Prev Slot
      else if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        handlePrevSlot();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isModalActive, activeConfig.key]);

  // 1. Saved Custom Presets per Slot Key
  const [userPresets, setUserPresets] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`sps_custom_presets_${slotConfig.key}`);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return [];
  });

  // 2. Favorite Presets per Slot Key
  const [favoritePresets, setFavoritePresets] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`sps_favorite_presets_${slotConfig.key}`);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return [];
  });

  // 3. Hidden/Deleted Presets per Slot Key
  const [hiddenPresets, setHiddenPresets] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`sps_hidden_presets_${slotConfig.key}`);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return [];
  });

  const handleAddNewPreset = (textToAdd) => {
    const text = (textToAdd || newPresetInput).trim();
    if (!text) return;

    if (userPresets.includes(text) || slotConfig.presets.includes(text)) {
      setSavedToast('Already in presets!');
      setTimeout(() => setSavedToast(false), 2000);
      return;
    }

    const updated = [text, ...userPresets];
    setUserPresets(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`sps_custom_presets_${slotConfig.key}`, JSON.stringify(updated));
      } catch (e) {}
    }
    setNewPresetInput('');
    setSavedToast('✓ Preset Added!');
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleToggleFavorite = (preset, e) => {
    if (e) e.stopPropagation();
    let updated = [];
    if (favoritePresets.includes(preset)) {
      updated = favoritePresets.filter(p => p !== preset);
    } else {
      updated = [preset, ...favoritePresets];
    }
    setFavoritePresets(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`sps_favorite_presets_${slotConfig.key}`, JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleDeletePreset = (preset, e) => {
    if (e) e.stopPropagation();
    
    if (userPresets.includes(preset)) {
      const updatedUser = userPresets.filter(p => p !== preset);
      setUserPresets(updatedUser);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`sps_custom_presets_${slotConfig.key}`, JSON.stringify(updatedUser));
        } catch (e) {}
      }
    } else {
      const updatedHidden = [...hiddenPresets, preset];
      setHiddenPresets(updatedHidden);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`sps_hidden_presets_${slotConfig.key}`, JSON.stringify(updatedHidden));
        } catch (e) {}
      }
    }

    if (favoritePresets.includes(preset)) {
      const updatedFav = favoritePresets.filter(p => p !== preset);
      setFavoritePresets(updatedFav);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`sps_favorite_presets_${slotConfig.key}`, JSON.stringify(updatedFav));
        } catch (e) {}
      }
    }
  };

  const activeStandardPresets = slotConfig.presets.filter(p => !hiddenPresets.includes(p) && !userPresets.includes(p));
  const allVisiblePresets = [...userPresets, ...activeStandardPresets];
  
  const favoriteItems = allVisiblePresets.filter(p => favoritePresets.includes(p));
  const nonFavoriteItems = allVisiblePresets.filter(p => !favoritePresets.includes(p));

  const handleSelectChange = (e) => {
    if (onSelectSlot) onSelectSlot(slotConfig.key);
    if (e.target.value) {
      onChange(e.target.value);
    }
  };

  const handleCustomInput = (e) => {
    if (onSelectSlot) onSelectSlot(slotConfig.key);
    onChange(e.target.value);
  };

  const handleFocus = () => {
    if (onSelectSlot) onSelectSlot(slotConfig.key);
  };

  // Render Shared Compact Popup Modal Window
  const renderPopupModal = () => {
    if (!isModalActive) return null;
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono"
        onClick={handleCloseModal}
      >
        <div 
          className="bg-zinc-950 border border-zinc-800 text-white rounded-2xl p-5 w-full max-w-2xl shadow-2xl space-y-3.5 max-h-[90vh] flex flex-col font-mono overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800 shrink-0">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-sans">{activeConfig.label}</h3>
                <p className="text-[11px] text-zinc-400 font-mono">{activeConfig.description}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto space-y-3 flex-1 pr-1">
            {/* SLOT TIP CARD INSIDE POPUP MODAL */}
            {activeConfig.tip && (
              <div className="p-3.5 rounded-xl border border-zinc-800/90 bg-zinc-900/90 space-y-2 font-mono shadow-sm">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
                  <h4 className="text-xs font-bold text-white font-sans">
                    {activeConfig.tipTitle || activeConfig.label}
                  </h4>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 font-mono shadow-inner">
                  {activeConfig.tip}
                </p>
              </div>
            )}

            {/* Complete Textarea Box */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-zinc-200 font-bold font-mono">Complete Text Value:</label>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">{value ? value.length : 0} chars</span>
              </div>

              <textarea
                rows={2}
                value={value || ''}
                onChange={handleCustomInput}
                autoFocus
                placeholder={`Enter complete ${(activeConfig.label || '').toLowerCase()} text...`}
                className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500 font-mono leading-relaxed resize-y font-bold shadow-inner"
              />
            </div>

            {/* CRAFT #25: FIXED MULTI-MODAL ASSET SLOTS (image_1..9, video_1..3, audio_1..3) */}
            {activeConfig.key === 'characterIdMatrix' && (() => {
              const parseMatrixMap = (matrixStr = '') => {
                const map = {
                  image_1: '', image_2: '', image_3: '', image_4: '', image_5: '', image_6: '', image_7: '', image_8: '', image_9: '',
                  video_1: '', video_2: '', video_3: '',
                  audio_1: '', audio_2: '', audio_3: ''
                };
                if (!matrixStr) return map;
                const parts = matrixStr.split('|').map(s => s.trim()).filter(Boolean);
                parts.forEach(part => {
                  const match = part.match(/(Image_\d+|Video_\d+|Audio_\d+)\s*=\s*(.*)/i);
                  if (match) {
                    const k = match[1].toLowerCase();
                    if (Object.prototype.hasOwnProperty.call(map, k)) {
                      map[k] = match[2].trim();
                    }
                  }
                });
                return map;
              };

              const buildMatrixStr = (map) => {
                const parts = [];
                for (let i = 1; i <= 9; i++) {
                  const val = map[`image_${i}`];
                  if (val && val.trim()) parts.push(`Image_${i} = ${val.trim()}`);
                }
                for (let i = 1; i <= 3; i++) {
                  const val = map[`video_${i}`];
                  if (val && val.trim()) parts.push(`Video_${i} = ${val.trim()}`);
                }
                for (let i = 1; i <= 3; i++) {
                  const val = map[`audio_${i}`];
                  if (val && val.trim()) parts.push(`Audio_${i} = ${val.trim()}`);
                }
                return parts.join(' | ');
              };

              const currentMap = parseMatrixMap(value);

              return (
                <div className="p-3 rounded-xl border border-cyan-500/40 bg-zinc-900/90 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 font-mono">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      Fixed ComfyUI Seedance 2.0 Multi-Modal Asset Slots:
                    </h4>
                    <span className="text-[10px] text-cyan-400 font-mono">15 Fixed Slots (image_1..9, video_1..3, audio_1..3)</span>
                  </div>

                  {/* IMAGE SLOTS 1..9 */}
                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-bold text-cyan-300 font-mono block">🖼️ Image Reference Slots (image_1 to image_9):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                        const k = `image_${num}`;
                        return (
                          <div key={k} className="flex items-center gap-1 bg-zinc-950 p-1 px-1.5 rounded-lg border border-zinc-800 focus-within:border-cyan-500">
                            <span className="text-[11px] font-bold text-amber-400 font-mono w-14 shrink-0 text-right">image_{num}</span>
                            <input
                              type="text"
                              value={currentMap[k] || ''}
                              onChange={(e) => {
                                const updated = { ...currentMap, [k]: e.target.value };
                                onChange(buildMatrixStr(updated));
                              }}
                              placeholder={`Subject ${num}`}
                              className="w-full bg-zinc-900 text-white border border-zinc-700/80 rounded px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* VIDEO & AUDIO SLOTS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* VIDEO SLOTS */}
                    <div className="space-y-1.5">
                      <span className="text-[10.5px] font-bold text-emerald-300 font-mono block">🎥 Video Clip Slots (video_1 to video_3):</span>
                      <div className="space-y-1">
                        {[1, 2, 3].map((num) => {
                          const k = `video_${num}`;
                          return (
                            <div key={k} className="flex items-center gap-1 bg-zinc-950 p-1 px-1.5 rounded-lg border border-zinc-800 focus-within:border-emerald-500">
                              <span className="text-[11px] font-bold text-emerald-400 font-mono w-14 shrink-0 text-right">video_{num}</span>
                              <input
                                type="text"
                                value={currentMap[k] || ''}
                                onChange={(e) => {
                                  const updated = { ...currentMap, [k]: e.target.value };
                                  onChange(buildMatrixStr(updated));
                                }}
                                placeholder={`Video Ref ${num}`}
                                className="w-full bg-zinc-900 text-white border border-zinc-700/80 rounded px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-emerald-400"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* AUDIO SLOTS */}
                    <div className="space-y-1.5">
                      <span className="text-[10.5px] font-bold text-purple-300 font-mono block">🎵 Audio Reference Slots (audio_1 to audio_3):</span>
                      <div className="space-y-1">
                        {[1, 2, 3].map((num) => {
                          const k = `audio_${num}`;
                          return (
                            <div key={k} className="flex items-center gap-1 bg-zinc-950 p-1 px-1.5 rounded-lg border border-zinc-800 focus-within:border-purple-500">
                              <span className="text-[11px] font-bold text-purple-400 font-mono w-14 shrink-0 text-right">audio_{num}</span>
                              <input
                                type="text"
                                value={currentMap[k] || ''}
                                onChange={(e) => {
                                  const updated = { ...currentMap, [k]: e.target.value };
                                  onChange(buildMatrixStr(updated));
                                }}
                                placeholder={`Audio Track ${num}`}
                                className="w-full bg-zinc-900 text-white border border-zinc-700/80 rounded px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-purple-400"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Add New Custom Preset Input Box */}
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 space-y-1.5">
              <label className="text-[11px] text-amber-400 font-bold flex items-center gap-1 font-mono">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                Add Custom Preset:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newPresetInput}
                  onChange={(e) => setNewPresetInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewPreset()}
                  placeholder="Type custom preset name & press Enter..."
                  className="flex-1 bg-zinc-950 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-[11px] focus:outline-none focus:border-amber-500 font-mono placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddNewPreset()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[11px] shrink-0 shadow-sm"
                >
                  {savedToast || '+ Add'}
                </button>
              </div>
            </div>

            {/* FAVORITES PRESETS SECTION */}
            {favoriteItems.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#FFD700] font-bold flex items-center gap-1 font-mono">
                  <Star className="w-3.5 h-3.5 fill-[#FFD700] text-[#FFD700]" />
                  ⭐ Favorite Presets ({favoriteItems.length}):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {favoriteItems.map((preset, idx) => (
                    <div
                      key={`fav_${idx}`}
                      onClick={() => onChange(preset)}
                      className={`text-[10.5px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all font-bold font-mono shadow-sm ${
                        value === preset
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-zinc-950 font-black border-yellow-300 shadow-md scale-105'
                          : 'bg-zinc-900/90 text-[#FFD700] border-amber-500/80 hover:border-amber-300 shadow-sm'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(preset, e)}
                        className="text-[#FFD700] hover:scale-125 transition-transform shrink-0"
                        title="Remove from favorites"
                      >
                        <Star className="w-3.5 h-3.5 fill-[#FFD700] text-[#FFD700]" />
                      </button>

                      <span className="truncate max-w-[240px] text-[#FFD700]">{preset}</span>

                      <button
                        type="button"
                        onClick={(e) => handleDeletePreset(preset, e)}
                        className="p-0.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors shrink-0"
                        title="Delete preset"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ALL PRESETS LIST SECTION */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-zinc-300 font-bold font-mono">All Presets:</label>
                <span className="text-[9.5px] text-zinc-400 font-mono">
                  Click ⭐ to favorite | Click 🗑️ to delete
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                {nonFavoriteItems.map((preset, idx) => {
                  const isCustom = userPresets.includes(preset);
                  const isSelected = value === preset;
                  return (
                    <div
                      key={`std_${idx}`}
                      onClick={() => onChange(preset)}
                      className={`text-[10.5px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all font-mono ${
                        isSelected 
                          ? 'bg-cyan-500 text-zinc-950 font-black border-cyan-300 shadow-md scale-105'
                          : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-cyan-500/60 font-medium'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(preset, e)}
                        className="text-zinc-400 hover:text-amber-400 hover:scale-125 transition-transform shrink-0"
                        title="Add to favorites"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>

                      <span className="truncate max-w-[220px] font-medium">
                        {isCustom ? `➕ ${preset}` : preset}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleDeletePreset(preset, e)}
                        className="p-0.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors shrink-0"
                        title="Delete preset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer Bar with Navigation & Direct Slot Jump Selector */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-800 shrink-0 font-mono gap-2 flex-wrap sm:flex-nowrap">
            {/* Left / Center Navigation Toolbar */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {/* Previous Slot Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevSlot();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-zinc-700/80 text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="Previous Slot (Cmd + Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4 text-cyan-400" />
                <span>Prev</span>
                <span className="text-[10px] text-zinc-500 font-mono font-normal hidden sm:inline">(⌘←)</span>
              </button>

              {/* Direct Slot Jump Dropdown Pill */}
              <div className="relative flex items-center min-w-0 max-w-[200px] sm:max-w-[260px]">
                <select
                  value={activeConfig.key}
                  onChange={(e) => handleDirectJump(e.target.value)}
                  className="bg-zinc-900 border border-cyan-500/50 text-cyan-300 text-xs font-bold font-mono px-2.5 py-1.5 pr-6 rounded-xl appearance-none cursor-pointer hover:border-cyan-400 focus:outline-none shadow-xs text-left truncate w-full"
                  title="Directly jump to any slot number in matrix"
                >
                  {availableSlotsList.map((s, idx) => {
                    const numStr = idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`;
                    return (
                      <option key={s.key} value={s.key} className="bg-zinc-950 text-white font-mono">
                        {numStr} : {s.label}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-2 pointer-events-none" />
              </div>

              {/* Next Slot Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextSlot();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-zinc-700/80 text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="Next Slot (Cmd + Right Arrow)"
              >
                <span>Next</span>
                <span className="text-[10px] text-zinc-500 font-mono font-normal hidden sm:inline">(⌘→)</span>
                <ChevronRight className="w-4 h-4 text-cyan-400" />
              </button>
            </div>

            {/* Right: Done & Close Button */}
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-1 ml-auto"
            >
              <Check className="w-4 h-4 text-white" />
              <span>Done & Close</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 w-full min-w-[170px] font-mono">
        <input
          type="text"
          value={value || ''}
          onChange={handleCustomInput}
          onFocus={handleFocus}
          onDoubleClick={handleOpenModal}
          placeholder={`Type ${slotConfig.label}...`}
          title={value ? `Full Text:\n${value}\n\n(Double-click or click 🔍 to manage favorites & presets)` : `Type ${slotConfig.label}`}
          className="w-full bg-zinc-950 text-amber-200 border border-zinc-800 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-amber-500/80 font-mono truncate shadow-inner cursor-pointer"
        />

        <button
          type="button"
          onClick={() => {
            handleFocus();
            handleOpenModal();
          }}
          className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-zinc-700/90 text-xs font-mono shrink-0 transition-colors shadow-sm flex items-center gap-0.5"
          title={`View full text, add/delete & favorite presets for ${slotConfig.label}`}
        >
          <Maximize2 className="w-3 h-3" />
          {favoriteItems.length > 0 && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
        </button>

        <div className="relative shrink-0" title={`Select preset for ${slotConfig.label}`}>
          <div className="p-1 px-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-zinc-700/90 text-xs font-mono flex items-center justify-center gap-0.5 cursor-pointer transition-colors shadow-sm">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] opacity-70">▾</span>
          </div>

          <select
            value={allVisiblePresets.includes(value) ? value : ''}
            onChange={handleSelectChange}
            onFocus={handleFocus}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs font-mono"
          >
            <option value="">-- Presets for {slotConfig.label} --</option>
            {favoriteItems.length > 0 && (
              <optgroup label="⭐ Favorite Presets">
                {favoriteItems.map((preset, idx) => (
                  <option key={`fav_${idx}`} value={preset}>
                    ⭐ {preset}
                  </option>
                ))}
              </optgroup>
            )}
            {userPresets.length > 0 && (
              <optgroup label="➕ Custom Presets">
                {userPresets.filter(p => !favoritePresets.includes(p)).map((preset, idx) => (
                  <option key={`usr_${idx}`} value={preset}>
                    ➕ {preset}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="🎬 Studio Presets">
              {activeStandardPresets.filter(p => !favoritePresets.includes(p)).map((preset, idx) => (
                <option key={`std_${idx}`} value={preset}>
                  {preset}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {renderPopupModal()}
      </div>
    );
  }

  // Full Card View for Studio Form View
  return (
    <div 
      onClick={handleFocus}
      className="p-2.5 rounded-xl border border-zinc-800/90 bg-zinc-900/80 backdrop-blur-md shadow-sm space-y-2 font-mono hover:border-cyan-500/50 transition-colors"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="p-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold text-white font-sans leading-tight">
            {slotConfig.label}
          </h4>
        </div>

        <div className="flex items-center gap-1">
          {/* Maximize / Expand Full Text Modal Popup Button in Form View */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleFocus();
              handleOpenModal();
            }}
            className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold shrink-0 transition-colors flex items-center gap-0.5"
            title="Expand full text & preset manager window"
          >
            <Maximize2 className="w-3 h-3 text-amber-400" />
            {favoriteItems.length > 0 && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
          </button>

          {/* Small Icon Preset Selector */}
          <div className="relative shrink-0" title={`Select preset for ${slotConfig.label}`}>
            <div className="px-2 py-0.5 rounded-md bg-zinc-950 hover:bg-zinc-800 text-cyan-300 border border-zinc-700/90 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span className="hidden xs:inline">Presets</span>
              <span className="text-[9px] opacity-70">▾</span>
            </div>

            <select
              value={allVisiblePresets.includes(value) ? value : ''}
              onChange={handleSelectChange}
              onFocus={handleFocus}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs font-mono"
            >
              <option value="">-- Select Preset for {slotConfig.label} --</option>
              {favoriteItems.length > 0 && (
                <optgroup label="⭐ Favorite Presets">
                  {favoriteItems.map((preset, idx) => (
                    <option key={`fav_${idx}`} value={preset}>
                      ⭐ {preset}
                    </option>
                  ))}
                </optgroup>
              )}
              {userPresets.length > 0 && (
                <optgroup label="➕ Custom Presets">
                  {userPresets.filter(p => !favoritePresets.includes(p)).map((preset, idx) => (
                    <option key={`usr_${idx}`} value={preset}>
                      ➕ {preset}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="🎬 Studio Presets">
                {activeStandardPresets.filter(p => !favoritePresets.includes(p)).map((preset, idx) => (
                  <option key={`std_${idx}`} value={preset}>
                    {preset}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* Direct Text Value Box with double-click to expand */}
      <textarea
        rows={2}
        value={value || ''}
        onChange={handleCustomInput}
        onFocus={handleFocus}
        onDoubleClick={() => setIsPopupOpen(true)}
        placeholder={`Enter ${slotConfig.label.toLowerCase()} text... (Double-click to expand)`}
        title="Double-click to expand full text & preset manager window"
        className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800/90 rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500 font-mono leading-relaxed resize-none cursor-pointer"
      />

      {renderPopupModal()}
    </div>
  );
}
