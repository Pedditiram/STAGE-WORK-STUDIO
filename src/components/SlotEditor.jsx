import React, { useState, useEffect } from 'react';
import { Sparkles, Maximize2, Minimize2, X, Trash2, Star, Plus, Sliders, ChevronLeft, ChevronRight, ChevronDown, Volume2, VolumeX } from 'lucide-react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';

import { enhanceCraftSlotWithLLM } from '../services/aiScriptParser';
import { assertCanMutateContent } from '../utils/productionLifecycle';
import { CMD_TYPES, proposeAndValidate, approveLlmCommand, applyLlmCommand } from '../utils/llmCommandBus';
import SaveCloseConfirmModal from './SaveCloseConfirmModal';
import { parseSceneAndShotID } from '../utils/sceneShotUtils';
import { compileNarrativeProse } from '../utils/narrativeCompiler';
import IntensityScaleSelector from './IntensityScaleSelector';
import CinematicReferencesPanel from './CinematicReferencesPanel';

function SlotEditor({ 
  slotConfig, 
  value, 
  onChange, 
  shot = {},
  compact = false, 
  onSelectSlot,
  isForcePopupOpen,
  onCloseForcePopup,
  onOpenPopup,
  onNavigateNextSlot,
  onNavigatePrevSlot,
  allSlots = [],
  onJumpToSlot,
  onJumpToShot,
  embedded = false,
  totalShotsCount = 0,
  currentShotIndex = 0,
  onNavigateNextShot,
  onNavigatePrevShot,
  scenesList = [],
  currentSceneId = '',
  onNavigateNextScene,
  onNavigatePrevScene,
  onJumpToScene,
  isMuted = false,
  readOnly = false,
  onToggleMute,
  colorTheme = 'paper',
  genreKey = 'mythological',
  projectTitle = '',
  shots = [],
  onOpenLlmCommands,
  onUpdateShot
}) {
  const inputLocked = isMuted || readOnly;
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [newPresetInput, setNewPresetInput] = useState('');
  const [activeConfig, setActiveConfig] = useState(slotConfig);
  const [isEnhancingCraft, setIsEnhancingCraft] = useState(false);
  const [isEscConfirmOpen, setIsEscConfirmOpen] = useState(false);
  const [promptViewFormat, setPromptViewFormat] = useState('crafts'); // 'crafts' | 'prose'
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [promptCopyToast, setPromptCopyToast] = useState(false);

  const renderLiveMasterPromptWithHighlight = (activeKey, currentVal, shotData = {}) => {
    const activeShotData = { ...(shotData || {}), [activeKey]: currentVal };
    const parsedId = parseSceneAndShotID(activeShotData.sceneShotId || '', currentShotIndex);

    const allCrafts = [
      { key: 'sceneShotId', label: 'Shot ID', prefix: 'Shot ID: ' },
      { key: 'sceneSynopsis', label: 'Scene Synopsis', prefix: 'Synopsis: ' },
      { key: 'shotComposition', label: 'Framing', prefix: 'Framing: ' },
      { key: 'cameraMotionTag', label: 'Camera Motion', prefix: 'Camera: ' },
      { key: 'lensAndFocalLength', label: 'Lens & Focal Length', prefix: 'Lens: ' },
      { key: 'timeAndLightingEnv', label: 'Weather & Time Rig', prefix: 'Weather/Time Rig: ' },
      { key: 'directionalLightingAndHighlight', label: 'Light Angle & Highlight Rig', prefix: 'Light Angle/Highlight: ' },
      { key: 'subjectLightingTag', label: 'Subject Lighting', prefix: 'Subject Lighting: ' },
      { key: 'subjectColorTag', label: 'Subject Color', prefix: 'Subject Color: ' },
      { key: 'backgroundLightingTag', label: 'Background Lighting', prefix: 'BG Lighting: ' },
      { key: 'backgroundColorTag', label: 'Background Color', prefix: 'BG Color: ' },
      { key: 'colorPaletteSlot', label: 'Color Palette', prefix: 'Palette: ' },
      { key: 'characterIdAssetRef', label: 'Character ID', prefix: 'Character Ref: ' },
      { key: 'coArtistInteraction', label: 'Co-Artist', prefix: 'Co-Artist: ' },
      { key: 'actionEnvContext', label: 'Environment Context', prefix: 'Environment: ' },
      { key: 'characterExpression', label: 'Expression', prefix: 'Expression: ' },
      { key: 'characterPsychologyState', label: 'Psychology & Mindstate', prefix: 'Mindstate: ' },
      { key: 'characterMannerismAndPosture', label: 'Mannerisms & Posture', prefix: 'Mannerism: ' },
      { key: 'characterPlacement', label: 'Placement', prefix: 'Placement: ' },
      { key: 'characterDialogue', label: 'Dialogue', prefix: 'Dialogue: ' },
      { key: 'characterMovement', label: 'Movement', prefix: 'Action Performance: ' },
      { key: 'characterEyeLooks', label: 'Eye Look', prefix: 'Eye Look: ' },
      { key: 'makeupAndHairStyle', label: 'Makeup & Hair', prefix: 'Makeup/Hair: ' },
      { key: 'stuntAndSafetyNotes', label: 'Stunts & Choreography', prefix: 'Stunts: ' },
      { key: 'atmosphereVolumetricsTag', label: 'Atmosphere', prefix: 'Atmosphere: ' },
      { key: 'vfxCgiBreakdown', label: 'VFX & CGI', prefix: 'VFX/CGI: ' },
      { key: 'soundFxAndFoley', label: 'Sound FX & Foley', prefix: 'Audio/SFX: ' },
      { key: 'backgroundScoreMood', label: 'Score Mood', prefix: 'Score: ' },
      { key: 'editTransitionCut', label: 'Edit Transition', prefix: 'Cut/Transition: ' },
      { key: 'shotDurationAndImages', label: 'Duration & Assets', prefix: 'Duration & Assets: ' }
    ];

    if (promptViewFormat === 'prose') {
      const proseText = compileNarrativeProse(activeShotData) || 'No narrative prose available yet for this shot.';
      return (
        <div className="text-zinc-200 leading-relaxed text-xs font-serif italic p-3 bg-zinc-950/90 rounded-xl border border-zinc-800/80 shadow-inner">
          "{proseText}"
        </div>
      );
    }

    return (
      <div className="leading-relaxed text-[11.5px] flex flex-wrap items-center">
        {allCrafts.map((craft) => {
          const rawVal = activeShotData[craft.key] || '';
          const isActive = craft.key === activeKey;
          
          if (!rawVal && !isActive) return null;

          const displayStr = rawVal || `[Editing ${craft.label}...]`;

          return (
            <React.Fragment key={craft.key}>
              {isActive ? (
                <mark className="bg-[var(--sps-row-active)] text-[var(--sps-text)] font-semibold px-2 py-0.5 rounded border border-[var(--sps-gold)] inline-block mx-0.5 my-0.5 font-mono text-xs">
                  {craft.prefix}{displayStr}
                </mark>
              ) : (
                <span className="text-zinc-200 font-normal mx-0.5 my-0.5 bg-zinc-950/60 px-1.5 py-0.5 rounded border border-zinc-800/80 inline-block">
                  <span className="text-zinc-400 font-semibold">{craft.prefix}</span>
                  <span>{displayStr}.</span>
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof window !== 'undefined') {
      const isNative = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      const isStored = localStorage.getItem('sps_slot_editor_fullscreen') === 'true';
      return isNative || isStored;
    }
    return false;
  });

  // Native Browser Fullscreen Bypass to hide Safari URL bar & tabs completely
  const toggleFullscreenMode = async (enable) => {
    const targetState = typeof enable === 'boolean' ? enable : !isFullscreen;
    setIsFullscreen(targetState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_slot_editor_fullscreen', targetState ? 'true' : 'false');
    }

    try {
      if (targetState) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        }
      } else {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          }
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    setActiveConfig(slotConfig);
  }, [slotConfig]);

  const availableSlotsList = (allSlots && allSlots.length > 0) ? allSlots : SEEDANCE_SLOTS;

  const isModalActive = Boolean(isForcePopupOpen || isPopupOpen);
  const initialValueOnOpenRef = React.useRef(value);
  const valueRef = React.useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (isModalActive) {
      initialValueOnOpenRef.current = value;
    }
  }, [isModalActive, activeConfig.key, currentShotIndex]);

  const handleCloseModal = () => {
    setIsPopupOpen(false);
    setIsEscConfirmOpen(false);
    if (onCloseForcePopup) onCloseForcePopup();
  };

  const isCraftDirty = () => String(valueRef.current ?? '') !== String(initialValueOnOpenRef.current ?? '');

  const requestCloseEditor = () => {
    if (isFullscreen) {
      toggleFullscreenMode(false);
      return;
    }
    if (isCraftDirty()) {
      setIsEscConfirmOpen(true);
      return;
    }
    handleCloseModal();
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

  // Store callbacks in ref to prevent stale closures during rapid keydown navigation
  const callbacksRef = React.useRef({
    onNavigatePrevScene,
    onNavigateNextScene,
    onNavigatePrevShot,
    onNavigateNextShot,
    handlePrevSlot,
    handleNextSlot
  });

  useEffect(() => {
    callbacksRef.current = {
      onNavigatePrevScene,
      onNavigateNextScene,
      onNavigatePrevShot,
      onNavigateNextShot,
      handlePrevSlot,
      handleNextSlot
    };
  });

  // Keyboard navigation: Cmd/Alt/Ctrl + Shift + Up/Down (Scene), Cmd/Alt/Ctrl + Up/Down (Shot), Cmd/Alt/Ctrl + Left/Right (Craft)
  useEffect(() => {
    if (!isModalActive) return;

    const handleKeyDown = (e) => {
      const isModifier = e.metaKey || e.ctrlKey || e.altKey;
      const key = e.key;
      const isUp = key === 'ArrowUp' || key === 'Up';
      const isDown = key === 'ArrowDown' || key === 'Down';
      const isLeft = key === 'ArrowLeft' || key === 'Left';
      const isRight = key === 'ArrowRight' || key === 'Right';

      if ((e.metaKey || e.ctrlKey) && key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreenMode();
        return;
      }

      if (key === 'Escape' || ((e.metaKey || e.ctrlKey) && (e.code === 'Space' || key === ' ' || key === 'Spacebar'))) {
        e.preventDefault();
        e.stopPropagation();
        if (embedded) {
          handleCloseModal();
          return;
        }
        requestCloseEditor();
        return;
      }

      if (!isModifier) return;

      // Cmd / Alt / Ctrl + Shift + Up Arrow (⌘⇧↑ / ⌥⇧↑) -> Previous Scene
      if (e.shiftKey && isUp) {
        e.preventDefault();
        e.stopPropagation();
        if (callbacksRef.current.onNavigatePrevScene) callbacksRef.current.onNavigatePrevScene();
      }
      // Cmd / Alt / Ctrl + Shift + Down Arrow (⌘⇧↓ / ⌥⇧↓) -> Next Scene
      else if (e.shiftKey && isDown) {
        e.preventDefault();
        e.stopPropagation();
        if (callbacksRef.current.onNavigateNextScene) callbacksRef.current.onNavigateNextScene();
      }
      // Cmd / Alt / Ctrl + Down Arrow (⌘↓ / ⌥↓) -> Next Craft Slot (Shift to craft below)
      else if (!e.shiftKey && isDown) {
        e.preventDefault();
        e.stopPropagation();
        if (callbacksRef.current.handleNextSlot) callbacksRef.current.handleNextSlot();
      }
      // Cmd / Alt / Ctrl + Up Arrow (⌘↑ / ⌥↑) -> Previous Craft Slot (Shift to craft above)
      else if (!e.shiftKey && isUp) {
        e.preventDefault();
        e.stopPropagation();
        if (callbacksRef.current.handlePrevSlot) callbacksRef.current.handlePrevSlot();
      }
      // Cmd / Alt / Ctrl + Right Arrow (⌘→ / ⌥→) -> Next Shot
      else if (!e.shiftKey && isRight) {
        e.preventDefault();
        e.stopPropagation();
        if (callbacksRef.current.onNavigateNextShot) callbacksRef.current.onNavigateNextShot();
      }
      // Cmd / Alt / Ctrl + Left Arrow (⌘← / ⌥←) -> Previous Shot
      else if (!e.shiftKey && isLeft) {
        e.preventDefault();
        e.stopPropagation();
        if (callbacksRef.current.onNavigatePrevShot) callbacksRef.current.onNavigatePrevShot();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isModalActive, isFullscreen]);

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
    if (inputLocked) return;
    if (onSelectSlot) onSelectSlot(slotConfig.key);
    onChange(e.target.value);
  };

  const handleFocus = () => {
    if (onSelectSlot) onSelectSlot(slotConfig.key);
  };

  const handleAIEnhanceCraft = async () => {
    if (!assertCanMutateContent(shot).ok) return;
    try {
      setIsEnhancingCraft(true);
      const enhancedStr = await enhanceCraftSlotWithLLM(activeConfig.key, value, {
        ...(shot || {}),
        sceneShotId: currentSceneId || shot?.sceneShotId,
        actionEnvContext: shot?.actionEnvContext || value,
        genreKey,
        projectTitle,
        presetProfile: genreKey
      });
      if (!enhancedStr) return;
      const proposed = proposeAndValidate(
        {
          type: CMD_TYPES.PATCH_SHOT_CRAFT,
          projectTitle,
          payload: { shotIndex: currentShotIndex, craftKey: activeConfig.key, value: enhancedStr },
          source: 'llm_enhance_craft',
          reason: `Slot enhance ${activeConfig.key}`,
          preview: String(enhancedStr).slice(0, 120)
        },
        { shots, projectTitle }
      );
      if (!proposed.ok) {
        window.alert(proposed.error || proposed.errors?.join('; ') || 'Proposal failed');
        return;
      }
      if (onOpenLlmCommands) {
        onOpenLlmCommands();
        return;
      }
      if (window.confirm(`Apply LLM craft patch for ${activeConfig.key}?`)) {
        approveLlmCommand(proposed.command.id, projectTitle);
        applyLlmCommand(proposed.command.id, projectTitle, { shots, projectTitle }, {
          updateShot: (i, s) => onUpdateShot?.(i, s)
        });
        setSavedToast('⚡ Craft patch applied');
        setTimeout(() => setSavedToast(false), 2500);
      }
    } catch (e) {
      console.warn('Craft AI enhance error:', e);
    } finally {
      setIsEnhancingCraft(false);
    }
  };

  // Render Shared Popup Modal Window
  const renderPopupModal = () => {
    if (!isModalActive && !embedded) return null;

    const cardContent = (
      <div 
        className={`sps-matrix-craft space-y-3.5 flex flex-col font-mono transition-all bg-[var(--sps-surface)] text-[var(--sps-text)] border border-[var(--sps-border)] ${
          embedded 
            ? 'h-full max-h-full overflow-y-auto p-3 rounded-[10px]' 
            : isFullscreen
              ? 'h-full w-full max-w-none max-h-none rounded-none border-0 p-6 overflow-hidden'
              : 'w-full max-w-5xl max-h-[92vh] rounded-[10px] p-5 overflow-hidden'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto space-y-3 flex-1 pr-1">

          <div className="w-full space-y-2.5 p-3 rounded-[10px] border border-[var(--sps-border)] bg-[var(--sps-bg)] font-mono text-[var(--sps-text)]">
            <div className="flex items-center justify-between border-b border-[var(--sps-border)] pb-2 gap-2">
              <span className="font-semibold text-[11px] font-sans uppercase tracking-wider text-[var(--sps-text)] min-w-0 truncate">
                Active · {activeConfig.label || activeConfig.key}
              </span>

              <div className="flex items-center gap-1 shrink-0">
                {activeConfig.key === 'sceneSynopsis' && (
                  <button
                    type="button"
                    onClick={() => {
                      const autoVal = shot.sceneSynopsis || `Scene Location & Context: ${shot.actionEnvContext || 'Dramatic environment'}. Featuring ${shot.characterIdAssetRef || 'primary subject'}. Action: ${shot.characterMovement || 'Dynamic performance'}.`;
                      onChange(autoVal);
                    }}
                    className="sps-btn sps-btn-compact"
                    title="Load writer / LLM synopsis"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Synopsis
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAIEnhanceCraft}
                  disabled={isEnhancingCraft}
                  className="sps-btn sps-btn-compact sps-btn-primary"
                  title="Enhance this craft"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isEnhancingCraft ? 'animate-spin' : ''}`} />
                  {isEnhancingCraft ? '…' : 'Enhance'}
                </button>
                <span className="sps-count-pill">{(value || '').length}</span>
                <CinematicReferencesPanel
                  genreKey={genreKey}
                  craftKey={activeConfig.key}
                  projectTitle={projectTitle}
                  onInsert={(item) => {
                    const next = value && String(value).trim() ? `${value.trim()} · ${item}` : item;
                    onChange(next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (onCloseForcePopup) onCloseForcePopup();
                    handleCloseModal();
                  }}
                  className="sps-icon-btn"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 🔥 INTERACTIVE INTENSITY SCALE SELECTOR */}
            <div className="pb-1">
              <IntensityScaleSelector 
                value={value || ''} 
                onChange={(newVal) => onChange && onChange(newVal)} 
                craftKey={activeConfig.key} 
                isPaperTheme={colorTheme === 'paper'} 
              />
            </div>

            {/* Full-width 100% Expanded Chrome Yellow Textarea */}
            <textarea
              rows={4}
              value={value || ''}
              onChange={handleCustomInput}
              onFocus={handleFocus}
              autoFocus
              placeholder={`Enter ${(activeConfig.label || '').toLowerCase()}…`}
              className="w-full rounded-[7px] p-2.5 text-sm font-mono leading-relaxed resize-y font-medium border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[var(--sps-text)] focus:outline-none focus:border-[var(--sps-gold)]"
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
                    Reference image slots:
                  </h4>
                  <span className="text-[10px] text-cyan-400 font-mono">15 Fixed Slots (image_1..9, video_1..3, audio_1..3)</span>
                </div>

                {/* IMAGE SLOTS 1..9 */}
                <div className="space-y-1.5">
                  <span className="text-[10.5px] font-bold text-cyan-300 font-mono block">🖼️ Image Reference Slots (image_1 to image_9):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { num: 1, label: 'Lead Subject' },
                      { num: 2, label: 'Co-Artist' },
                      { num: 3, label: 'Action Ref / Prop' },
                      { num: 4, label: 'Supporting Ref' },
                      { num: 5, label: 'Crowd / Army' },
                      { num: 6, label: 'Scene Environment' },
                      { num: 7, label: 'Ambience / Haze' },
                      { num: 8, label: 'Style & Color Ref' },
                      { num: 9, label: 'VFX & Special FX' }
                    ].map(({ num, label }) => {
                      const k = `image_${num}`;
                      return (
                        <div key={k} className="flex flex-col gap-0.5 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800 focus-within:border-cyan-500">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="font-bold text-amber-400">image_{num}</span>
                            <span className="text-zinc-400 text-[9px] font-semibold">{label}</span>
                          </div>
                          <input
                            type="text"
                            value={currentMap[k] || ''}
                            onChange={(e) => {
                              const updated = { ...currentMap, [k]: e.target.value };
                              onChange(buildMatrixStr(updated));
                            }}
                            placeholder={label}
                            className="w-full bg-zinc-900 text-white border border-zinc-700/80 rounded px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-amber-400 font-bold"
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

          {/* DEDICATED COLOR PALETTE & VISUAL SWATCHES ENGINE */}
          {(activeConfig.key === 'colorPaletteSlot' || activeConfig.key === 'subjectColorTag' || activeConfig.key === 'backgroundColorTag') && (() => {
            const PALETTE_PRESETS = [
              { name: 'Kara & Dhushan (Venom-Green & Ash)', colors: ['#1a1a1a', '#2d6b2d', '#555555', '#d4af37'], label: 'Ash, Venom-Green, Smoke, Gold' },
              { name: 'Konaseema Sunset Festival', colors: ['#d4af37', '#b22222', '#8b4513', '#228b22'], label: 'Temple Gold, Crimson, Clay, Emerald' },
              { name: 'Celestial Saffron & Royal Blue', colors: ['#ff9933', '#1a365d', '#ffd700', '#8b0000'], label: 'Saffron, Royal Blue, Gold, Crimson' },
              { name: 'High-Contrast Noir Silver', colors: ['#000000', '#c0c0c0', '#333333', '#e6e6e6'], label: 'Obsidian, Silver, Charcoal, Pearl' },
              { name: 'Cyberpunk Hot Magenta & Cyan', colors: ['#00ffff', '#ff007f', '#120a2a', '#00ff66'], label: 'Cyan, Hot Pink, Violet, Acid Green' },
              { name: 'Dark Fantasy Emerald & Bronze', colors: ['#0b3b17', '#1c1c1c', '#cd7f32', '#4a2e12'], label: 'Deep Moss, Charcoal, Bronze, Mahogany' }
            ];

            const hexMatches = (value || '').match(/#[0-9a-fA-F]{6}\b/g) || ['#1a1a1a', '#2d6b2d', '#555555', '#d4af37'];
            const sampleImageMatch = (value || '').match(/SampleImage:\s*([^\s\|\]\)]+)/i);
            const currentSampleImageUrl = sampleImageMatch ? sampleImageMatch[1] : '';

            const handleSelectPalettePreset = (preset) => {
              const formattedStr = `[Palette: ${preset.name} (${preset.colors.join(' | ')})]`;
              onChange(formattedStr);
            };

            const handleColorChange = (idx, newColor) => {
              const updatedHexes = [...hexMatches];
              updatedHexes[idx] = newColor;
              const formattedStr = `[Palette: Custom Swatches (${updatedHexes.join(' | ')})]`;
              onChange(formattedStr);
            };

            const handleImageUpload = (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const imgDataUrl = ev.target?.result;
                if (imgDataUrl) {
                  const cleanedValue = (value || '').replace(/\s*\|?\s*SampleImage:[^\s\|\]\)]+/i, '');
                  const updatedVal = `${cleanedValue} | SampleImage:${imgDataUrl}`;
                  onChange(updatedVal);
                }
              };
              reader.readAsDataURL(file);
            };

            return (
              <div className="p-3.5 rounded-xl border border-purple-500/40 bg-zinc-900/90 space-y-3 font-mono shadow-md">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎨</span>
                    <h4 className="text-xs font-bold text-white">Visual Color Grading Swatches & Sample Reference Image</h4>
                  </div>
                  <span className="text-[10px] text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30 font-bold">Interactive Color Engine</span>
                </div>

                {/* CURRENT ACTIVE SWATCHES DISPLAY */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-zinc-300 block">Active Swatch Palette:</span>
                  <div className="flex flex-wrap items-center gap-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                    {hexMatches.slice(0, 5).map((hex, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-700/80">
                        <input
                          type="color"
                          value={hex}
                          onChange={(e) => handleColorChange(idx, e.target.value)}
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <span className="text-[10px] font-bold text-white uppercase">{hex}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PALETTE PRESET CARDS */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-400 block">Cinematic Palette Presets:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PALETTE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPalettePreset(preset)}
                        className="p-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-purple-500 text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-zinc-200 group-hover:text-purple-300">{preset.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {preset.colors.map((c, i) => (
                            <span key={i} className="w-4 h-4 rounded-full border border-black/40 shadow-sm" style={{ backgroundColor: c }} title={c} />
                          ))}
                          <span className="text-[9.5px] text-zinc-400 truncate ml-1">{preset.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SAMPLE IMAGE OPTION & PREVIEW */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-800">
                  <span className="text-[11px] font-bold text-cyan-300 block">🖼️ Sample Color Grading Reference Image Option:</span>
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm">
                      <span>📁 Attach Sample Image Swatch</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    {currentSampleImageUrl && (
                      <div className="flex items-center gap-2 bg-zinc-950 p-1 px-2 rounded-lg border border-purple-500/40">
                        <img src={currentSampleImageUrl} alt="Sample Color Swatch" className="w-8 h-8 rounded object-cover border border-zinc-700" />
                        <span className="text-[10px] text-emerald-300 font-bold">✓ Sample Image Attached</span>
                      </div>
                    )}
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
                    className={`text-[10.5px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all font-bold font-mono shadow-md ${
                      value === preset
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-zinc-950 font-black border-yellow-300 shadow-lg scale-105'
                        : 'bg-[#2A1810] text-[#FFD700] border-[#5A321E] hover:border-[#FFD700] hover:bg-[#3D2314] shadow-sm'
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

                    <span className="truncate max-w-[240px] text-[#FFD700] font-extrabold">{preset}</span>

                    <button
                      type="button"
                      onClick={(e) => handleDeletePreset(preset, e)}
                      className="p-0.5 rounded hover:bg-red-500/20 text-[#FFD700]/70 hover:text-red-400 transition-colors shrink-0"
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
                    className={`text-[10.5px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all font-mono font-bold ${
                      isSelected 
                        ? 'bg-cyan-500 text-zinc-950 font-black border-cyan-300 shadow-md scale-105'
                        : 'bg-zinc-900 text-zinc-100 border-zinc-700 hover:border-cyan-400 font-bold'
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

                    <span className="truncate max-w-[220px] font-bold">
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

        {/* Modal Footer Bar with Compact Single-Line Navigation */}
        <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800 shrink-0 font-mono gap-1.5 overflow-x-auto text-xs">
          {/* Left: Combined Single-Line Navigation Controls */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            {/* SCENE NAV (Compact Purple Pill - BEFORE SHOT NAV) */}
            {((scenesList && scenesList.length > 0) || onJumpToScene || onNavigatePrevScene || onNavigateNextScene) && (
              <div className="flex items-center gap-0.5 bg-zinc-950 p-0.5 px-1 rounded-lg border border-purple-500/40 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigatePrevScene) onNavigatePrevScene();
                  }}
                  className="p-1 rounded hover:bg-purple-600 hover:text-white text-purple-300 transition-colors"
                  title="Previous Scene (Cmd + Shift + Up Arrow | ⌘⇧↑)"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-purple-400" />
                </button>

                <div className="relative flex items-center">
                  <select
                    value={currentSceneId || (scenesList[0]?.sceneId || '')}
                    onChange={(e) => {
                      if (onJumpToScene) onJumpToScene(e.target.value);
                    }}
                    className="bg-transparent text-purple-300 text-[11px] font-bold font-mono py-0.5 pl-1 pr-4 appearance-none cursor-pointer focus:outline-none"
                    title="Jump to Scene (Cmd + Shift + Up / Down)"
                  >
                    {(scenesList || []).map((sc, idx) => (
                      <option key={sc.sceneId || idx} value={sc.sceneId} className="bg-zinc-950 text-white font-mono">
                        {sc.label || sc.sceneId}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-purple-400 absolute right-0 pointer-events-none" />
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigateNextScene) onNavigateNextScene();
                  }}
                  className="p-1 rounded hover:bg-purple-600 hover:text-white text-purple-300 transition-colors"
                  title="Next Scene (Cmd + Shift + Down Arrow | ⌘⇧↓)"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                </button>
              </div>
            )}

            {/* SHOT NAV (Compact Amber Pill) */}
            {((totalShotsCount && totalShotsCount > 1) || onNavigatePrevShot || onNavigateNextShot || onJumpToShot) && (
              <div className="flex items-center gap-0.5 bg-zinc-950 p-0.5 px-1 rounded-lg border border-amber-500/40 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigatePrevShot) onNavigatePrevShot();
                  }}
                  className="p-1 rounded hover:bg-amber-600 hover:text-white text-amber-300 transition-colors"
                  title="Previous Shot (Cmd + Up Arrow | ⌘↑)"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
                </button>

                <div className="relative flex items-center">
                  <select
                    value={currentShotIndex}
                    onChange={(e) => {
                      if (onJumpToShot) onJumpToShot(parseInt(e.target.value, 10));
                    }}
                    className="bg-transparent text-amber-300 text-[11px] font-bold font-mono py-0.5 pl-1 pr-4 appearance-none cursor-pointer focus:outline-none"
                    title="Jump to Shot # (Cmd + Up / Down to navigate)"
                  >
                    {Array.from({ length: totalShotsCount || 1 }).map((_, idx) => (
                      <option key={idx} value={idx} className="bg-zinc-950 text-white font-mono">
                        Shot #{idx + 1}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-amber-400 absolute right-0 pointer-events-none" />
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigateNextShot) onNavigateNextShot();
                  }}
                  className="p-1 rounded hover:bg-amber-600 hover:text-white text-amber-300 transition-colors"
                  title="Next Shot (Cmd + Right Arrow | ⌘→)"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            )}

            {/* CRAFT NAV (Compact Cyan Pill) */}
            <div className="flex items-center gap-0.5 bg-zinc-950 p-0.5 px-1 rounded-lg border border-cyan-500/40 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevSlot();
                }}
                className="p-1 rounded hover:bg-cyan-600 hover:text-white text-cyan-300 transition-colors"
                title="Previous Craft Slot Below (Cmd + Up Arrow | ⌘↑)"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-cyan-400" />
              </button>

              <div className="relative flex items-center max-w-[150px] sm:max-w-[210px]">
                <select
                  value={activeConfig.key}
                  onChange={(e) => handleDirectJump(e.target.value)}
                  className="bg-transparent text-cyan-300 text-[11px] font-bold font-mono py-0.5 pl-1 pr-4 appearance-none cursor-pointer focus:outline-none truncate w-full"
                  title="Jump to Craft Slot (Shift to craft below/above)"
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
                <ChevronDown className="w-3 h-3 text-cyan-400 absolute right-0 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextSlot();
                }}
                className="p-1 rounded hover:bg-cyan-600 hover:text-white text-cyan-300 transition-colors"
                title="Next Craft Slot Below (Cmd + Down Arrow | ⌘↓)"
              >
                <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            </div>
          </div>

          {/* Right: Sleek Done & Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCloseModal();
            }}
            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-1 ml-auto cursor-pointer"
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    );

    if (embedded) return cardContent;

    return (
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center font-mono transition-all ${
          isFullscreen ? 'p-0 bg-black' : 'p-4 bg-black/85 backdrop-blur-md'
        }`}
        onClick={handleCloseModal}
      >
        {cardContent}
      </div>
    );
  };

  const isPaperTheme = colorTheme === 'paper' || colorTheme === 'light';

  if (compact) {
    return (
      <div className={`flex items-center gap-1 w-full min-w-[170px] font-mono transition-opacity ${isMuted ? 'opacity-40' : 'opacity-100'}`}>
        {onToggleMute && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute(slotConfig.key);
            }}
            className={`p-1 rounded-md text-xs shrink-0 transition-colors shadow-sm cursor-pointer border ${
              isMuted
                ? 'bg-red-950/90 text-red-400 border-red-800 hover:bg-red-900'
                : isPaperTheme
                  ? 'bg-amber-100/90 hover:bg-amber-200 text-amber-900 border-amber-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800'
            }`}
            title={isMuted ? `Unmute ${slotConfig.label} (Click to enable slot)` : `Mute ${slotConfig.label} (Click to disable slot)`}
          >
            {isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className={`w-3 h-3 ${isPaperTheme ? 'text-amber-800' : 'text-zinc-400'}`} />}
          </button>
        )}

        <input
          type="text"
          disabled={inputLocked}
          value={value || ''}
          onChange={handleCustomInput}
          onFocus={handleFocus}
          onDoubleClick={handleOpenModal}
          placeholder={isMuted ? `[MUTED] ${slotConfig.label}` : readOnly ? `[LOCKED] ${slotConfig.label}` : `Type ${slotConfig.label}...`}
          title={isMuted ? `[MUTED SLOT] ${slotConfig.label} is currently disabled` : readOnly ? `Locked shot — unlock to edit ${slotConfig.label}` : (value ? `Full Text:\n${value}\n\n(Double-click or click 🔍 to manage favorites & presets)` : `Type ${slotConfig.label}`)}
          className={`w-full border rounded-md px-2 py-1 text-xs focus:outline-none font-mono truncate shadow-inner cursor-pointer ${
            inputLocked 
              ? 'bg-zinc-900 text-zinc-500 border-red-900/40 line-through cursor-not-allowed' 
              : isPaperTheme
                ? 'bg-white text-slate-900 border-amber-300 focus:border-amber-500 font-bold placeholder:text-zinc-400'
                : 'bg-zinc-950 text-amber-200 border-zinc-800 focus:border-amber-500/80'
          }`}
        />

        {renderPopupModal()}
      </div>
    );
  }

  // If embedded or modal is active, return ONLY the main editor card (no outer header or duplicate textarea)
  if (embedded || isModalActive) {
    return (
      <>
        {renderPopupModal()}
        <SaveCloseConfirmModal
          isOpen={isEscConfirmOpen}
          title="Save & Close Craft Editor"
          onSaveAndClose={() => {
            setIsEscConfirmOpen(false);
            handleCloseModal();
          }}
          onCloseWithoutSave={() => {
            setIsEscConfirmOpen(false);
            if (initialValueOnOpenRef.current !== undefined && onChange) {
              onChange(initialValueOnOpenRef.current);
            }
            handleCloseModal();
          }}
          onCancel={() => setIsEscConfirmOpen(false)}
        />
      </>
    );
  }

  // Full Card View for Studio Form View
  return (
    <div 
      onClick={handleFocus}
      className={`p-2.5 rounded-xl border transition-all space-y-2 font-mono ${
        isMuted 
          ? 'bg-zinc-950/60 border-red-900/40 opacity-50' 
          : 'border-zinc-800/90 bg-zinc-900/80 backdrop-blur-md shadow-sm hover:border-cyan-500/50'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className={`p-1 rounded border shrink-0 ${isMuted ? 'bg-red-950/50 text-red-400 border-red-800' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Sparkles className="w-3.5 h-3.5" />}
          </div>
          <h4 className={`text-xs font-bold font-sans leading-tight truncate ${isMuted ? 'text-zinc-400 line-through' : 'text-white'}`}>
            {slotConfig.label}
          </h4>
          {isMuted && <span className="text-[9px] px-1 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-mono font-bold">MUTED</span>}
        </div>
      </div>

      {/* Direct Text Value Box */}
      <textarea
        rows={2}
        value={value || ''}
        onChange={handleCustomInput}
        onFocus={handleFocus}
        onDoubleClick={() => setIsPopupOpen(true)}
        placeholder={`Enter ${slotConfig.label.toLowerCase()} text...`}
        className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800/90 rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500 font-mono leading-relaxed resize-none cursor-pointer font-bold"
      />

      <SaveCloseConfirmModal
        isOpen={isEscConfirmOpen}
        title="Save & Close Craft Editor"
        onSaveAndClose={() => {
          setIsEscConfirmOpen(false);
          handleCloseModal();
        }}
        onCloseWithoutSave={() => {
          setIsEscConfirmOpen(false);
          if (initialValueOnOpenRef.current !== undefined && onChange) {
            onChange(initialValueOnOpenRef.current);
          }
          handleCloseModal();
        }}
        onCancel={() => setIsEscConfirmOpen(false)}
      />
    </div>
  );
}

export default React.memo(SlotEditor);
