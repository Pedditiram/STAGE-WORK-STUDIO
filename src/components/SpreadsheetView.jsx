import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import SlotEditor from './SlotEditor';
import HoverPinBar from './HoverPinBar';
import {
  Plus, Copy, VolumeX, Volume2, Sparkles, 
  Check, Filter, Download
} from 'lucide-react';
import { enhanceEntireShotWithLLM } from '../services/aiScriptParser';
import { parseSceneAndShotID, deriveSceneGroupHeading } from '../utils/sceneShotUtils';
import {
  blockingFlags,
  characterLookUrl,
  continuityFlagsForShot,
  matchCharactersForShot,
  matchWorldForShot,
  worldPlateUrl
} from '../utils/continuitySpine';
import {
  assertCanMutateContent,
  isLifecycleLocked,
  lifecycleExportReadiness,
  MATRIX_LIFECYCLE_FILTER_EVENT,
  MATRIX_LIFECYCLE_FILTER_OPTIONS,
  readMatrixLifecycleFilter,
  setMatrixLifecycleFilter,
  shotMatchesLifecycleFilter,
  bulkAdvanceShotLifecycleFiltered
} from '../utils/productionLifecycle';
import LifecycleControls from './LifecycleControls';
import { buildProductionSpine, resolveShotSpine } from '../utils/productionSpine';
import { CMD_TYPES, proposeAndValidate, approveLlmCommand, applyLlmCommand } from '../utils/llmCommandBus';
import { buildContinuityFixesForShot } from '../utils/continuitySupervisor';
import { applyContinuityPatch } from '../utils/continuityState';
import { exportDownloadText, assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { matrixShotsToCsv, matrixShotsToPrintHtml } from '../utils/matrixExport';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';

const COL_WIDTH_KEY = 'sps_matrix_col_widths';
const COL_DEFAULTS = { index: 44, actions: 120, look: 128 };
const SLOT_DEFAULT_W = 180;
const COL_MIN = { index: 36, actions: 72, look: 72, slot: 88 };
const COL_MAX = { index: 88, actions: 180, look: 320, slot: 560 };

function loadColWidths() {
  try {
    const raw = JSON.parse(localStorage.getItem(COL_WIDTH_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function ColResizeHandle({ colKey, onResizeStart, onReset }) {
  return (
    <span
      className="sps-col-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      title="Drag to resize · double-click to reset"
      onMouseDown={(e) => onResizeStart(colKey, e)}
      onTouchStart={(e) => onResizeStart(colKey, e)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onReset?.(colKey);
      }}
    />
  );
}

const CATEGORIES = [
  { id: 'all', label: 'All', keys: [] },
  { id: 'camera', label: 'Camera', keys: ['sceneShotId', 'sceneSynopsis', 'shotComposition', 'cameraMotionTag', 'lensAndFocalLength'] },
  { id: 'lighting', label: 'Light', keys: ['timeAndLightingEnv', 'directionalLightingAndHighlight', 'subjectLightingTag', 'subjectColorTag', 'backgroundLightingTag', 'backgroundColorTag', 'colorPaletteSlot'] },
  { id: 'vfx', label: 'Atmosphere', keys: ['atmosphereVolumetricsTag'] },
  { id: 'character', label: 'Performance', keys: ['characterIdAssetRef', 'coArtistInteraction', 'actionEnvContext', 'characterExpression', 'characterPsychologyState', 'characterMannerismAndPosture', 'characterPlacement', 'characterDialogue', 'characterMovement', 'characterEyeLooks'] },
  { id: 'audio_optics', label: 'Audio', keys: ['shotDurationAndImages', 'soundFxAndFoley', 'backgroundScoreMood'] }
];

function SpreadsheetView({ 
  slots = SEEDANCE_SLOTS,
  shots, 
  onUpdateShot,
  onUpdateShots,
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
  projectTitle = '',
  onOpenReel,
  onOpenGenerate,
  lookOnly = false,
  onOpenLlmCommands
}) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState(() => readMatrixLifecycleFilter());
  const [lifecycleNote, setLifecycleNote] = useState('');
  const [pitchLifePulse, setPitchLifePulse] = useState('');
  const [focusCatPulse, setFocusCatPulse] = useState('');
  const [activeModalCell, setActiveModalCell] = useState(null); // { shotIdx, slotKey }

  const [draggedShotIdx, setDraggedShotIdx] = useState(null);
  const [dragOverShotIdx, setDragOverShotIdx] = useState(null);
  const [enhancingShotIdx, setEnhancingShotIdx] = useState(null);
  const [collapsedScenes, setCollapsedScenes] = useState({});
  const [colWidths, setColWidths] = useState(loadColWidths);
  const [resizingCol, setResizingCol] = useState(null);

  const exportLife = useMemo(
    () => lifecycleExportReadiness(shots, projectTitle),
    [shots, projectTitle]
  );
  const {
    strict: matrixLifecycleStrict,
    mode: matrixLifecycleMode
  } = useExportLifecyclePref('matrix');
  const exportBlocked = matrixLifecycleStrict && !exportLife.exportReady;
  const roomId = resolveCollabRoomId();
  const liveCount = useMemo(
    () => (Array.isArray(shots) ? shots.filter((s) => s && !s.isArchived) : []).length,
    [shots]
  );
  const matrixLifeNote = `${liveCount} live shots · matrix`;

  const handleExportMatrixCsv = () => {
    if (lookOnly) return;
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    exportDownloadText(`${slug}_matrix.csv`, matrixShotsToCsv(shots, slots), {
      projectTitle,
      auditLabel: 'matrix_shots_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: matrixLifecycleMode,
      shots,
      roomId,
      note: matrixExportLifecycleNote
    });
  };

  const handleExportMatrixPdf = () => {
    if (lookOnly) return;
    const gate = assertExportAllowed({
      projectTitle,
      label: 'matrix_shots_pdf',
      format: 'pdf',
      lifecycleMode: matrixLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(matrixShotsToPrintHtml(shots, slots, projectTitle));
    printWindow.document.close();
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    logExportSuccess({
      projectTitle,
      label: 'matrix_shots_pdf',
      format: 'pdf',
      filename: `${slug}_matrix.pdf`,
      roomId,
      note: matrixExportLifecycleNote,
      lifecycleMode: gate.advisory ? `${matrixLifecycleMode}+ok` : matrixLifecycleMode
    });
  };

  const isPaperTheme = colorTheme === 'paper' || colorTheme === 'light' || !colorTheme;

  useEffect(() => {
    try {
      localStorage.setItem(COL_WIDTH_KEY, JSON.stringify(colWidths));
    } catch (e) {}
  }, [colWidths]);

  useEffect(() => {
    const onFilter = (e) => {
      const detail = e?.detail;
      if (detail && typeof detail === 'object') {
        setLifecycleFilter({
          id: detail.id || 'all',
          statuses: Array.isArray(detail.statuses) && detail.statuses.length ? detail.statuses : null,
          source: detail.source || ''
        });
        // P115/P116 — toast + pulse Life chip when Pitch deep-links into Matrix
        const src = String(detail.source || '');
        if (src.startsWith('pitch') && detail.statuses?.length) {
          const chipId = detail.id || 'needs_approve';
          const label =
            MATRIX_LIFECYCLE_FILTER_OPTIONS.find((o) => o.id === chipId)?.label || 'Life filter';
          setLifecycleNote(`Pitch → Matrix · ${label}`);
          setPitchLifePulse(chipId);
          window.setTimeout(() => setLifecycleNote(''), 3200);
          window.setTimeout(() => setPitchLifePulse(''), 3000);
          try {
            window.dispatchEvent(
              new CustomEvent('sps_toast', {
                detail: { message: `Matrix Life: ${label} (from Pitch)` }
              })
            );
          } catch {
            /* ignore */
          }
        }
      } else {
        setLifecycleFilter(readMatrixLifecycleFilter());
      }
    };
    window.addEventListener(MATRIX_LIFECYCLE_FILTER_EVENT, onFilter);
    return () => window.removeEventListener(MATRIX_LIFECYCLE_FILTER_EVENT, onFilter);
  }, []);

  const colWidthOf = (key) => {
    if (key === 'index' || key === 'actions' || key === 'look') {
      return Number(colWidths[key]) || COL_DEFAULTS[key];
    }
    return Number(colWidths[key]) || SLOT_DEFAULT_W;
  };

  const colStyle = (key) => {
    const w = colWidthOf(key);
    return { width: w, minWidth: w, maxWidth: w };
  };

  const resetColWidth = (key) => {
    setColWidths((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const startColResize = (key, e) => {
    const point = e.touches?.[0] || e;
    if (!point) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = point.clientX;
    const startW = colWidthOf(key);
    const min = COL_MIN[key] || COL_MIN.slot;
    const max = COL_MAX[key] || COL_MAX.slot;
    setResizingCol(key);
    document.body.classList.add('sps-col-resizing');

    const clientX = (ev) => (ev.touches?.[0] || ev.changedTouches?.[0] || ev).clientX;

    const onMove = (ev) => {
      const x = clientX(ev);
      if (typeof x !== 'number') return;
      const next = Math.min(max, Math.max(min, Math.round(startW + (x - startX))));
      setColWidths((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
    };
    const onUp = () => {
      setResizingCol(null);
      document.body.classList.remove('sps-col-resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

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

  // P118/P119/P121 — L / Shift+L cycle Life; Esc clears Life when active (no cell modal)
  React.useEffect(() => {
    if (activeModalCell !== null) return undefined;
    const onLifeKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (!lifecycleFilter?.statuses?.length) return;
        e.preventDefault();
        e.stopPropagation();
        const totalShots = (shots || []).length;
        const next = setMatrixLifecycleFilter({
          id: 'all',
          statuses: null,
          source: 'matrix_esc'
        });
        setLifecycleFilter(next);
        // P122 — ring flash on All life chip after Esc clear
        setPitchLifePulse('all');
        window.setTimeout(() => setPitchLifePulse(''), 3000);
        setLifecycleNote('Life cleared');
        window.setTimeout(() => setLifecycleNote(''), 1400);
        const focusCat = CATEGORIES.find((c) => c.id === activeCategory);
        const focusSuffix =
          activeCategory && activeCategory !== 'all' && focusCat
            ? ` · Focus · ${focusCat.label}`
            : '';
        try {
          window.dispatchEvent(
            new CustomEvent('sps_toast', {
              detail: {
                message: `Matrix Life filter cleared · ${totalShots} shot${
                  totalShots === 1 ? '' : 's'
                }${focusSuffix}`
              }
            })
          );
        } catch {
          /* ignore */
        }
        return;
      }

      if (e.key !== 'l' && e.key !== 'L') return;
      e.preventDefault();
      e.stopPropagation();
      const opts = MATRIX_LIFECYCLE_FILTER_OPTIONS;
      const cur = lifecycleFilter?.id || 'all';
      const idx = Math.max(
        0,
        opts.findIndex((o) => o.id === cur)
      );
      const nextOpt = e.shiftKey
        ? opts[(idx - 1 + opts.length) % opts.length]
        : opts[(idx + 1) % opts.length];
      const next = setMatrixLifecycleFilter({
        id: nextOpt.id,
        statuses: nextOpt.statuses,
        source: 'matrix_hotkey'
      });
      setLifecycleFilter(next);
      // P129 — ring newly selected Life chip on L / ⇧L
      setPitchLifePulse(nextOpt.id);
      window.setTimeout(() => setPitchLifePulse(''), 3000);
      const lifeFilter = {
        id: nextOpt.id,
        statuses: nextOpt.statuses
      };
      const lifeShotCount = nextOpt.statuses?.length
        ? (Array.isArray(shots) ? shots : []).filter((s) =>
            shotMatchesLifecycleFilter(s, lifeFilter)
          ).length
        : (Array.isArray(shots) ? shots : []).length;
      setLifecycleNote(
        `Life · ${nextOpt.label} · ${lifeShotCount} (${e.shiftKey ? '⇧L' : 'L'})`
      );
      window.setTimeout(() => setLifecycleNote(''), 1600);
      // P147/P150 — L / ⇧L toast includes shot count + Focus when ≠ All
      const focusCat = CATEGORIES.find((c) => c.id === activeCategory);
      const focusSuffix =
        activeCategory && activeCategory !== 'all' && focusCat
          ? ` · Focus · ${focusCat.label}`
          : '';
      try {
        window.dispatchEvent(
          new CustomEvent('sps_toast', {
            detail: {
              message: `Life · ${nextOpt.label} · ${lifeShotCount} shot${
                lifeShotCount === 1 ? '' : 's'
              }${focusSuffix}`
            }
          })
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('keydown', onLifeKey, true);
    return () => window.removeEventListener('keydown', onLifeKey, true);
  }, [activeModalCell, lifecycleFilter?.id, lifecycleFilter?.statuses, shots, activeCategory]);

  const toggleMuteFn = onToggleMuteShot || null;

  const currentCategoryObj = CATEGORIES.find(c => c.id === activeCategory);
  const filteredSlots = (slots || []).filter(slot => {
    if (activeCategory === 'all') return true;
    return currentCategoryObj?.keys.includes(slot.key);
  });

  const tableWidth =
    colWidthOf('index') +
    colWidthOf('actions') +
    colWidthOf('look') +
    filteredSlots.reduce((sum, slot) => sum + colWidthOf(slot.key), 0);

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
    if (!assertCanMutateContent(currentShot).ok) return;
    onUpdateShot(shotIndex, { ...currentShot, [slotKey]: value });
  };

  const handleLifecycleChange = (shotIndex, nextEntity) => {
    if (!onUpdateShot || !nextEntity) return;
    onUpdateShot(shotIndex, nextEntity);
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
    if (!assertCanMutateContent(shot).ok) return;
    setEnhancingShotIdx(shotIdx);
    try {
      const updatedShot = await enhanceEntireShotWithLLM(shot);
      const proposed = proposeAndValidate(
        {
          type: CMD_TYPES.REPLACE_SHOT,
          projectTitle,
          payload: { shotIndex: shotIdx, shot: updatedShot },
          source: 'llm_enhance_shot',
          reason: 'Matrix enhance entire shot',
          preview: updatedShot?.sceneShotId || `Shot ${shotIdx + 1}`
        },
        { shots, projectTitle }
      );
      if (!proposed.ok) {
        window.alert(proposed.error || proposed.errors?.join('; ') || 'Proposal failed');
        return;
      }
      if (onOpenLlmCommands) onOpenLlmCommands();
      else if (window.confirm(`LLM proposed a shot replace for ${shot.sceneShotId || `Shot ${shotIdx + 1}`}. Apply now?`)) {
        approveLlmCommand(proposed.command.id, projectTitle);
        applyLlmCommand(proposed.command.id, projectTitle, { shots, projectTitle }, {
          updateShot: (i, s) => onUpdateShot?.(i, s)
        });
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
  const productionSpine = useMemo(
    () => buildProductionSpine({ projectTitle, shots }),
    [projectTitle, shots]
  );

  const sceneGroups = useMemo(() => {
    const groups = [];
    (shots || []).forEach((shot, originalIdx) => {
      if (!shotMatchesLifecycleFilter(shot, lifecycleFilter)) return;
      const parsed = parseSceneAndShotID(shot, originalIdx);
      const sceneTag = parsed.sceneTag || `SCENE ${String(parsed.sceneNum).padStart(2, '0')}`;
      let existingGroup = groups.find(g => g.sceneTag === sceneTag);
      if (!existingGroup) {
        existingGroup = {
          sceneTag,
          sceneNum: parsed.sceneNum,
          heading: '',
          spine: null,
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
      const firstIdx = group.items[0]?.originalIdx ?? 0;
      const firstShot = group.items[0]?.shot;
      group.spine = resolveShotSpine(firstShot, firstIdx, shots, productionSpine);
    });

    return groups;
  }, [shots, productionSpine, lifecycleFilter]);

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

  const flatRows = useMemo(() => {
    const rows = [];
    sceneGroups.forEach((group) => {
      rows.push({ type: 'banner', key: `b-${group.sceneTag}`, group });
      if (!collapsedScenes[group.sceneTag]) {
        group.items.forEach((item) => {
          rows.push({
            type: item.shot?.isMuted ? 'muted' : 'shot',
            key: `s-${item.originalIdx}`,
            group,
            shot: item.shot,
            shotIdx: item.originalIdx
          });
        });
      }
    });
    return rows;
  }, [sceneGroups, collapsedScenes]);

  const visibleLifeCount = useMemo(
    () => sceneGroups.reduce((n, g) => n + g.items.length, 0),
    [sceneGroups]
  );
  const matrixFilterSuffix = useMemo(() => {
    const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
    const lifeLabel = lifeOn
      ? MATRIX_LIFECYCLE_FILTER_OPTIONS.find(
          (o) => o.id === (lifecycleFilter?.id || 'all')
        )?.label ||
        lifecycleFilter?.id ||
        'Life'
      : '';
    const focusCat = CATEGORIES.find((c) => c.id === activeCategory);
    const focusSuffix =
      activeCategory && activeCategory !== 'all' && focusCat
        ? ` · Focus · ${focusCat.label}`
        : '';
    const lifeSuffix = lifeOn && lifeLabel ? ` · Life · ${lifeLabel}` : '';
    return `${lifeSuffix}${focusSuffix}`;
  }, [lifecycleFilter?.id, lifecycleFilter?.statuses, activeCategory]);

  const matrixCountPillTitle = useMemo(() => {
    const total = (shots || []).length;
    const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
    const shotPart = lifeOn
      ? `${visibleLifeCount} / ${total} shots`
      : `${total} shot${total === 1 ? '' : 's'}`;
    return `${sceneGroups.length} scene${
      sceneGroups.length === 1 ? '' : 's'
    } · ${shotPart}${matrixFilterSuffix}`;
  }, [
    sceneGroups.length,
    shots,
    lifecycleFilter?.statuses,
    visibleLifeCount,
    matrixFilterSuffix
  ]);

  const matrixFocusLabelTitle = useMemo(() => {
    const colCount = filteredSlots.length;
    const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
    const focusCat = CATEGORIES.find((c) => c.id === activeCategory);
    const base = 'Filter Matrix columns by craft category';
    if (!lifeOn) {
      if (activeCategory && activeCategory !== 'all' && focusCat) {
        return `${base} · ${colCount} column${colCount === 1 ? '' : 's'}${matrixFilterSuffix}`;
      }
      return base;
    }
    const totalShots = (shots || []).length;
    return `${base} · ${colCount} column${colCount === 1 ? '' : 's'} · ${visibleLifeCount} / ${totalShots} shot${
      totalShots === 1 ? '' : 's'
    }${matrixFilterSuffix}`;
  }, [
    filteredSlots.length,
    lifecycleFilter?.statuses,
    activeCategory,
    shots,
    visibleLifeCount,
    matrixFilterSuffix
  ]);

  const matrixLifeLabelTitle = useMemo(() => {
    const base = 'Cycle Life filter: L forward · Shift+L back · Esc clears';
    const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
    if (!lifeOn) {
      return `${base}${matrixFilterSuffix}`;
    }
    const lifeLabel =
      MATRIX_LIFECYCLE_FILTER_OPTIONS.find(
        (o) => o.id === (lifecycleFilter?.id || 'all')
      )?.label ||
      lifecycleFilter?.id ||
      'Life';
    const totalShots = (shots || []).length;
    const lifeSuffixPart = lifeLabel ? ` · Life · ${lifeLabel}` : '';
    const trailingSuffix =
      lifeSuffixPart && matrixFilterSuffix.startsWith(lifeSuffixPart)
        ? matrixFilterSuffix.slice(lifeSuffixPart.length)
        : matrixFilterSuffix;
    return `${base} · Life · ${lifeLabel} · ${visibleLifeCount} / ${totalShots} shot${
      totalShots === 1 ? '' : 's'
    }${trailingSuffix}`;
  }, [
    lifecycleFilter?.id,
    lifecycleFilter?.statuses,
    shots,
    visibleLifeCount,
    matrixFilterSuffix
  ]);

  const matrixBarPinTitle = useMemo(
    () => `Matrix bar${matrixFilterSuffix}`,
    [matrixFilterSuffix]
  );

  const matrixExportCsvTitle = useMemo(
    () => `Export Matrix craft CSV${matrixFilterSuffix}`,
    [matrixFilterSuffix]
  );

  const matrixExportPdfTitle = useMemo(
    () => `Print Matrix craft PDF${matrixFilterSuffix}`,
    [matrixFilterSuffix]
  );

  const matrixAdvanceVisibleTitle = useMemo(() => {
    if (lookOnly) {
      return `Advance blocked — look-only (no edit permission)${matrixFilterSuffix}`;
    }
    if (typeof onUpdateShots !== 'function') {
      return `Advance blocked — Matrix cannot update shots${matrixFilterSuffix}`;
    }
    if (!visibleLifeCount) {
      return `Advance blocked — no shots in current Life filter${matrixFilterSuffix}`;
    }
    return `Advance each visible filtered shot one lifecycle step (draft→review→approved→locked)${matrixFilterSuffix}`;
  }, [lookOnly, onUpdateShots, visibleLifeCount, matrixFilterSuffix]);

  const matrixExportBlockedTitle = useMemo(
    () => `${exportLife.message}${matrixFilterSuffix}`,
    [exportLife.message, matrixFilterSuffix]
  );

  const matrixExportLifecycleNote = useMemo(
    () => `${matrixLifeNote}${matrixFilterSuffix}`,
    [matrixLifeNote, matrixFilterSuffix]
  );

  const matrixLookOnlyTitle = useMemo(
    () => `Look only — no edit permission${matrixFilterSuffix}`,
    [matrixFilterSuffix]
  );

  const matrixLifecycleNoteTitle = useMemo(() => {
    if (!lifecycleNote) return '';
    const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
    if (!lifeOn) {
      return `${lifecycleNote}${matrixFilterSuffix}`;
    }
    const lifeLabel =
      MATRIX_LIFECYCLE_FILTER_OPTIONS.find(
        (o) => o.id === (lifecycleFilter?.id || 'all')
      )?.label ||
      lifecycleFilter?.id ||
      'Life';
    const lifePart = lifeLabel ? ` · Life · ${lifeLabel}` : '';
    const trailingSuffix =
      lifePart && matrixFilterSuffix.startsWith(lifePart)
        ? matrixFilterSuffix.slice(lifePart.length)
        : matrixFilterSuffix;
    const noteHasLifeContext =
      lifeLabel &&
      (lifecycleNote.includes(lifePart) ||
        lifecycleNote.includes(`Life · ${lifeLabel}`));
    return noteHasLifeContext
      ? `${lifecycleNote}${trailingSuffix}`
      : `${lifecycleNote}${matrixFilterSuffix}`;
  }, [
    lifecycleNote,
    lifecycleFilter?.id,
    lifecycleFilter?.statuses,
    matrixFilterSuffix
  ]);

  const matrixAddShotTitle = useMemo(
    () => `Add shot into the selected scene (after active row)${matrixFilterSuffix}`,
    [matrixFilterSuffix]
  );

  const getMatrixFocusChipTitle = useCallback(
    (cat, slotCount) => {
      const base =
        cat.id === 'all'
          ? `Focus · All · ${slotCount} all columns`
          : `Focus · ${cat.label} · ${slotCount} column${slotCount === 1 ? '' : 's'}`;
      if (cat.id === activeCategory) {
        const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
        if (!lifeOn) return base;
        const lifeLabel =
          MATRIX_LIFECYCLE_FILTER_OPTIONS.find(
            (o) => o.id === (lifecycleFilter?.id || 'all')
          )?.label ||
          lifecycleFilter?.id ||
          'Life';
        const lifePart = lifeLabel ? ` · Life · ${lifeLabel}` : '';
        return `${base}${lifePart}`;
      }
      return `${base}${matrixFilterSuffix}`;
    },
    [activeCategory, lifecycleFilter?.id, lifecycleFilter?.statuses, matrixFilterSuffix]
  );

  const matrixFilterTrailingSuffix = useMemo(() => {
    const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
    if (!lifeOn) return matrixFilterSuffix;
    const lifeLabel =
      MATRIX_LIFECYCLE_FILTER_OPTIONS.find(
        (o) => o.id === (lifecycleFilter?.id || 'all')
      )?.label ||
      lifecycleFilter?.id ||
      'Life';
    const lifePart = lifeLabel ? ` · Life · ${lifeLabel}` : '';
    if (lifePart && matrixFilterSuffix.startsWith(lifePart)) {
      return matrixFilterSuffix.slice(lifePart.length);
    }
    return matrixFilterSuffix;
  }, [lifecycleFilter?.id, lifecycleFilter?.statuses, matrixFilterSuffix]);

  const getMatrixLifeChipTitle = useCallback(
    (opt, lifeShotCount, fromPitch) => {
      const base =
        opt.id === 'all'
          ? fromPitch
            ? `Life filter just cleared · ${lifeShotCount} all shots`
            : `Show all lifecycle shots · ${lifeShotCount} all shots`
          : fromPitch
            ? `Opened from Pitch excluded beats · ${lifeShotCount} shot${
                lifeShotCount === 1 ? '' : 's'
              }`
            : opt.id === 'needs_approve'
              ? `Draft + review shots (pitch excluded beats) · ${lifeShotCount} shot${
                  lifeShotCount === 1 ? '' : 's'
                }`
              : `Show ${opt.label} lifecycle shots · ${lifeShotCount} shot${
                  lifeShotCount === 1 ? '' : 's'
                }`;
      const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
      if (opt.id === 'all') {
        return `${base}${matrixFilterTrailingSuffix}`;
      }
      if (!lifeOn) return base;
      return `${base}${matrixFilterTrailingSuffix}`;
    },
    [lifecycleFilter?.statuses, matrixFilterTrailingSuffix]
  );

  const matrixClearLifeTitle = useMemo(() => {
    const total = (shots || []).length;
    const base = `Clear lifecycle focus — show all ${total} shot${total === 1 ? '' : 's'}`;
    return `${base}${matrixFilterTrailingSuffix}`;
  }, [shots, matrixFilterTrailingSuffix]);

  const getMatrixSceneCountPillTitle = useCallback(
    (itemCount, rangeTag) =>
      `${itemCount} ${itemCount === 1 ? 'shot' : 'shots'} (${rangeTag})${matrixFilterSuffix}`,
    [matrixFilterSuffix]
  );

  const getMatrixSceneBannerTitle = useCallback(
    (sceneTag, heading) => `${sceneTag} · ${heading}${matrixFilterSuffix}`,
    [matrixFilterSuffix]
  );

  const getMatrixSceneCollapseTitle = useCallback(
    (isCollapsed) =>
      isCollapsed
        ? `Expand scene · Alt+click = expand all${matrixFilterSuffix}`
        : `Minimize scene · Alt+click = minimize all${matrixFilterSuffix}`,
    [matrixFilterSuffix]
  );

  const handleAdvanceVisibleLifecycle = () => {
    const lifeLabel =
      MATRIX_LIFECYCLE_FILTER_OPTIONS.find((o) => o.id === (lifecycleFilter?.id || 'all'))
        ?.label || lifecycleFilter?.id || 'Life';
    const focusCat = CATEGORIES.find((c) => c.id === activeCategory);
    const focusSuffix =
      activeCategory && activeCategory !== 'all' && focusCat
        ? ` · Focus · ${focusCat.label}`
        : '';
    if (lookOnly || typeof onUpdateShots !== 'function') {
      // P126/P145/P155 — Advance blocked toast + Life + Focus
      const msg = lookOnly
        ? `Advance blocked — look-only (no edit permission) · Life · ${lifeLabel}${focusSuffix}`
        : `Advance blocked — Matrix cannot update shots · Life · ${lifeLabel}${focusSuffix}`;
      setLifecycleNote(msg);
      window.setTimeout(() => setLifecycleNote(''), 2800);
      try {
        window.dispatchEvent(new CustomEvent('sps_toast', { detail: { message: msg } }));
      } catch {
        /* ignore */
      }
      return;
    }
    const result = bulkAdvanceShotLifecycleFiltered(shots, lifecycleFilter, { projectTitle });
    if (!result.ok) {
      const msg = `${result.message || 'Advance blocked'} · Life · ${lifeLabel}${focusSuffix}`;
      setLifecycleNote(msg);
      window.setTimeout(() => setLifecycleNote(''), 2800);
      try {
        window.dispatchEvent(new CustomEvent('sps_toast', { detail: { message: msg } }));
      } catch {
        /* ignore */
      }
      return;
    }
    if (result.advanced) onUpdateShots(result.shots);
    const nextShots = result.shots || shots;
    const stillVisible =
      lifecycleFilter?.statuses?.length &&
      (Array.isArray(nextShots) ? nextShots : []).some((s) =>
        shotMatchesLifecycleFilter(s, lifecycleFilter)
      );
    if (lifecycleFilter?.statuses?.length && !stillVisible) {
      const cleared = setMatrixLifecycleFilter({ id: 'all', statuses: null, source: 'matrix_advance' });
      setLifecycleFilter(cleared);
      // P124 — ring All life chip after Advance visible clears filter
      setPitchLifePulse('all');
      window.setTimeout(() => setPitchLifePulse(''), 3000);
      setLifecycleNote(
        `${result.message || 'Advanced'} · Life filter cleared (none left in view)${focusSuffix}`
      );
      const totalShots = (Array.isArray(nextShots) ? nextShots : shots || []).length;
      try {
        window.dispatchEvent(
          new CustomEvent('sps_toast', {
            detail: {
              message: `Matrix Life filter cleared · ${totalShots} shot${
                totalShots === 1 ? '' : 's'
              }${focusSuffix}`
            }
          })
        );
      } catch {
        /* ignore */
      }
    } else {
      setLifecycleNote(result.message || '');
      // P125 — toast remaining count when filter stays on
      // P128 — ring current Life chip after Advance keep
      if (lifecycleFilter?.statuses?.length && stillVisible) {
        const chipId = lifecycleFilter?.id || 'all';
        setPitchLifePulse(chipId);
        window.setTimeout(() => setPitchLifePulse(''), 3000);
        const remain = (Array.isArray(nextShots) ? nextShots : []).filter((s) =>
          shotMatchesLifecycleFilter(s, lifecycleFilter)
        ).length;
        const lifeLabel =
          MATRIX_LIFECYCLE_FILTER_OPTIONS.find((o) => o.id === chipId)?.label ||
          chipId;
        const focusCat = CATEGORIES.find((c) => c.id === activeCategory);
        const focusSuffix =
          activeCategory && activeCategory !== 'all' && focusCat
            ? ` · Focus · ${focusCat.label}`
            : '';
        try {
          window.dispatchEvent(
            new CustomEvent('sps_toast', {
              detail: {
                message: `Advanced · ${remain} shot${
                  remain === 1 ? '' : 's'
                } still in Life · ${lifeLabel}${focusSuffix}`
              }
            })
          );
        } catch {
          /* ignore */
        }
      }
    }
    window.setTimeout(() => setLifecycleNote(''), 2800);
  };

  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(640);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => setViewH(el.clientHeight || 640))
      : null;
    ro?.observe(el);
    setViewH(el.clientHeight || 640);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    };
  }, []);

  const BANNER_H = 52;
  const SHOT_H = 92;
  const MUTE_H = 36;
  const rowHeight = (row) => (row.type === 'banner' ? BANNER_H : row.type === 'muted' ? MUTE_H : SHOT_H);

  const { startIdx, endIdx, padTop, padBottom } = useMemo(() => {
    const heights = flatRows.map(rowHeight);
    const offsets = [];
    let acc = 0;
    for (let i = 0; i < heights.length; i += 1) {
      offsets.push(acc);
      acc += heights[i];
    }
    const overscan = 480;
    const y0 = Math.max(0, scrollTop - overscan);
    const y1 = scrollTop + viewH + overscan;
    let start = 0;
    let end = flatRows.length;
    for (let i = 0; i < offsets.length; i += 1) {
      if (offsets[i] + heights[i] >= y0) {
        start = i;
        break;
      }
    }
    for (let i = start; i < offsets.length; i += 1) {
      if (offsets[i] > y1) {
        end = i;
        break;
      }
    }
    const pin = new Set();
    if (typeof activeShotIndex === 'number') pin.add(activeShotIndex);
    if (activeModalCell?.shotIdx >= 0) pin.add(activeModalCell.shotIdx);
    pin.forEach((idx) => {
      const at = flatRows.findIndex((r) => r.shotIdx === idx);
      if (at >= 0) {
        start = Math.min(start, at);
        end = Math.max(end, at + 1);
      }
    });
    const top = offsets[start] || 0;
    const bottom = acc - ((offsets[end] ?? acc));
    return { startIdx: start, endIdx: end, padTop: top, padBottom: Math.max(0, bottom) };
  }, [flatRows, scrollTop, viewH, activeShotIndex, activeModalCell]);

  const visibleRows = flatRows.slice(startIdx, endIdx);
  const colSpan = filteredSlots.length + 3;

  return (
    <div className="sps-matrix flex flex-col h-full w-full select-text overflow-hidden sps-view-enter">
      {/* CRAFT CATEGORY FILTER TABS TOOLBAR — same hover/pin as Writer */}
      <HoverPinBar
        storageKey="sps_pin_matrix_toolbar"
        defaultPinned={true}
        pinLabel="Matrix bar"
        ariaLabel={`Show Matrix toolbar${matrixFilterSuffix}`}
        pinTitle={matrixBarPinTitle}
        className="z-20"
        barClassName="sps-matrix-toolbar px-3 py-1 border-b flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-1 overflow-x-auto sps-header-scroll max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0">
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.14em] flex items-center gap-1 mr-1 shrink-0 text-[var(--sps-muted)]"
            title={matrixFocusLabelTitle}
          >
            <Filter className="w-3 h-3 text-[var(--sps-gold)]" />
            Focus
          </span>
          {CATEGORIES.map((cat) => {
            const isCatActive = activeCategory === cat.id;
            const fromPulse = focusCatPulse === cat.id;
            const slotCount =
              cat.id === 'all'
                ? (slots || []).length
                : Array.isArray(cat.keys)
                  ? cat.keys.length
                  : 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  // P131 — Focus category chip rings itself
                  setFocusCatPulse(cat.id);
                  window.setTimeout(() => setFocusCatPulse(''), 3000);
                  // P132/P135/P148 — Focus toast + Life label when Life filter on
                  const lifeOn = Boolean(lifecycleFilter?.statuses?.length);
                  const lifeLabel = lifeOn
                    ? MATRIX_LIFECYCLE_FILTER_OPTIONS.find(
                        (o) => o.id === (lifecycleFilter?.id || 'all')
                      )?.label || lifecycleFilter?.id
                    : '';
                  const focusPart =
                    cat.id === 'all'
                      ? `Focus · All · ${slotCount} all columns`
                      : `Focus · ${cat.label} · ${slotCount} column${
                          slotCount === 1 ? '' : 's'
                        }`;
                  try {
                    window.dispatchEvent(
                      new CustomEvent('sps_toast', {
                        detail: {
                          message: lifeLabel
                            ? `${focusPart} · Life · ${lifeLabel}`
                            : focusPart
                        }
                      })
                    );
                  } catch {
                    /* ignore */
                  }
                }}
                className={`sps-cat-chip px-2 py-0.5 text-[10px] cursor-pointer shrink-0 ${
                  isCatActive ? 'is-on' : ''
                } ${fromPulse ? 'ring-1 ring-[var(--sps-gold)] animate-pulse' : ''}`}
                title={getMatrixFocusChipTitle(cat, slotCount)}
                aria-label={getMatrixFocusChipTitle(cat, slotCount)}
              >
                {cat.label}
              </button>
            );
          })}
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.14em] flex items-center gap-1 mx-1 shrink-0 text-[var(--sps-muted)]"
            title={matrixLifeLabelTitle}
          >
            Life
            <span className="font-mono normal-case tracking-normal opacity-70">L / ⇧L · Esc</span>
          </span>
          {MATRIX_LIFECYCLE_FILTER_OPTIONS.map((opt) => {
            const isOn = (lifecycleFilter?.id || 'all') === opt.id;
            const fromPitch = pitchLifePulse === opt.id;
            const lifeFilter = {
              id: opt.id,
              statuses: opt.statuses
            };
            const lifeShotCount = opt.statuses?.length
              ? (Array.isArray(shots) ? shots : []).filter((s) =>
                  shotMatchesLifecycleFilter(s, lifeFilter)
                ).length
              : (Array.isArray(shots) ? shots : []).length;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const next = setMatrixLifecycleFilter({
                    id: opt.id,
                    statuses: opt.statuses,
                    source: 'matrix'
                  });
                  setLifecycleFilter(next);
                  // P130 — click Life chip rings itself (confirm selection)
                  setPitchLifePulse(opt.id);
                  window.setTimeout(() => setPitchLifePulse(''), 3000);
                  // P133/P134/P139/P149 — Life toast; Focus label when Focus ≠ All
                  const focusCat = CATEGORIES.find((c) => c.id === activeCategory);
                  const focusSuffix =
                    activeCategory && activeCategory !== 'all' && focusCat
                      ? ` · Focus · ${focusCat.label}`
                      : '';
                  try {
                    window.dispatchEvent(
                      new CustomEvent('sps_toast', {
                        detail: {
                          message:
                            (opt.id === 'all'
                              ? `Life · All · ${lifeShotCount} all shots`
                              : `Life · ${opt.label} · ${lifeShotCount} shot${
                                  lifeShotCount === 1 ? '' : 's'
                                }`) + focusSuffix
                        }
                      })
                    );
                  } catch {
                    /* ignore */
                  }
                }}
                className={`sps-cat-chip px-2 py-0.5 text-[10px] cursor-pointer shrink-0 ${
                  isOn ? 'is-on' : ''
                } ${fromPitch ? 'ring-1 ring-[var(--sps-gold)] animate-pulse' : ''}`}
                title={getMatrixLifeChipTitle(opt, lifeShotCount, fromPitch)}
                aria-label={getMatrixLifeChipTitle(opt, lifeShotCount, fromPitch)}
              >
                {opt.label}
              </button>
            );
          })}
          {lifecycleFilter?.statuses?.length ? (
            <button
              type="button"
              className="sps-cat-chip px-2 py-0.5 text-[10px] cursor-pointer shrink-0 text-[var(--sps-gold)]"
              title={matrixClearLifeTitle}
              aria-label={matrixClearLifeTitle}
              onClick={() => {
                const totalShots = (shots || []).length;
                const next = setMatrixLifecycleFilter({
                  id: 'all',
                  statuses: null,
                  source: 'matrix_clear'
                });
                setLifecycleFilter(next);
                // P123 — ring All life chip (same as Esc)
                setPitchLifePulse('all');
                window.setTimeout(() => setPitchLifePulse(''), 3000);
                setLifecycleNote('Life cleared');
                window.setTimeout(() => setLifecycleNote(''), 1400);
                // P152 — Clear Life toast includes Focus when Focus ≠ All
                const focusCat = CATEGORIES.find((c) => c.id === activeCategory);
                const focusSuffix =
                  activeCategory && activeCategory !== 'all' && focusCat
                    ? ` · Focus · ${focusCat.label}`
                    : '';
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', {
                      detail: {
                        message: `Matrix Life filter cleared · ${totalShots} shot${
                          totalShots === 1 ? '' : 's'
                        }${focusSuffix}`
                      }
                    })
                  );
                } catch {
                  /* ignore */
                }
              }}
            >
              Clear Life
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="sps-count-pill whitespace-nowrap text-[10px]"
            title={matrixCountPillTitle}
            aria-label={matrixCountPillTitle}
          >
            {sceneGroups.length} scenes ·{' '}
            {lifecycleFilter?.statuses?.length
              ? `${visibleLifeCount} / ${(shots || []).length}`
              : (shots || []).length}{' '}
            shots
          </span>
          {lifecycleFilter?.statuses?.length ? (
            <button
              type="button"
              onClick={handleAdvanceVisibleLifecycle}
              disabled={
                lookOnly || typeof onUpdateShots !== 'function' || !visibleLifeCount
              }
              className="sps-btn text-[10px] h-7 px-2 disabled:opacity-40"
              title={matrixAdvanceVisibleTitle}
              aria-label={matrixAdvanceVisibleTitle}
            >
              Advance visible
            </button>
          ) : null}
          {lifecycleNote ? (
            <span
              className="text-[9px] text-[var(--sps-gold)] max-w-[10rem] truncate"
              title={matrixLifecycleNoteTitle}
              aria-label={matrixLifecycleNoteTitle}
            >
              {lifecycleNote}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleExportMatrixCsv}
            disabled={lookOnly || exportBlocked}
            className="sps-btn text-[10px] h-7 px-2 disabled:opacity-40"
            title={
              lookOnly
                ? matrixLookOnlyTitle
                : exportBlocked
                  ? matrixExportBlockedTitle
                  : matrixExportCsvTitle
            }
            aria-label={
              lookOnly
                ? matrixLookOnlyTitle
                : exportBlocked
                  ? matrixExportBlockedTitle
                  : matrixExportCsvTitle
            }
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportMatrixPdf}
            disabled={lookOnly || exportBlocked}
            className="sps-btn text-[10px] h-7 px-2 disabled:opacity-40"
            title={
              lookOnly
                ? matrixLookOnlyTitle
                : exportBlocked
                  ? matrixExportBlockedTitle
                  : matrixExportPdfTitle
            }
            aria-label={
              lookOnly
                ? matrixLookOnlyTitle
                : exportBlocked
                  ? matrixExportBlockedTitle
                  : matrixExportPdfTitle
            }
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          {exportBlocked ? (
            <span
              className="hidden xl:inline text-[9px] text-[var(--sps-gold)] max-w-[9rem] leading-snug truncate"
              title={matrixExportBlockedTitle}
              aria-label={matrixExportBlockedTitle}
            >
              {exportLife.message}
            </span>
          ) : null}
          {lookOnly ? (
            <span
              className="sps-chip text-[10px]"
              title={matrixLookOnlyTitle}
              aria-label={matrixLookOnlyTitle}
            >
              Look only
            </span>
          ) : (
          <button
            type="button"
            onClick={onAddShot}
            className="sps-btn sps-btn-primary text-[10px] h-7 px-2"
            title={matrixAddShotTitle}
            aria-label={matrixAddShotTitle}
          >
            <Plus className="w-3.5 h-3.5" />
            Add shot
          </button>
          )}
        </div>
      </HoverPinBar>

      {/* MATRIX WORKSPACE SPREADSHEET TABLE */}
      <div ref={scrollRef} className="sps-matrix-scroll flex-1 overflow-auto scrollbar-thin relative">
        <table
          className={`text-left border-collapse text-xs ${resizingCol ? 'sps-matrix-resizing' : ''}`}
          style={{ fontFamily: 'var(--sps-font-mono)', tableLayout: 'fixed', width: tableWidth, minWidth: tableWidth }}
        >
          <colgroup>
            <col style={{ width: colWidthOf('index') }} />
            <col style={{ width: colWidthOf('actions') }} />
            <col style={{ width: colWidthOf('look') }} />
            {filteredSlots.map((slot) => (
              <col key={slot.key} style={{ width: colWidthOf(slot.key) }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b sticky top-0 z-30 backdrop-blur-md">
              <th className="p-2 text-center border-r sticky left-0 z-40 relative" style={colStyle('index')}>
                #
                <ColResizeHandle colKey="index" onResizeStart={startColResize} onReset={resetColWidth} />
              </th>
              <th className="p-2 text-center border-r relative" style={colStyle('actions')}>
                Actions
                <ColResizeHandle colKey="actions" onResizeStart={startColResize} onReset={resetColWidth} />
              </th>
              <th className="p-2 text-center border-r relative" style={colStyle('look')}>
                Look
                <ColResizeHandle colKey="look" onResizeStart={startColResize} onReset={resetColWidth} />
              </th>
              {filteredSlots.map((slot) => (
                <th
                  key={slot.key}
                  className="sps-matrix-slot p-2 px-3 border-r relative overflow-hidden"
                  style={colStyle(slot.key)}
                  title={`${slot.label} — drag the right edge to resize`}
                >
                  <span className="block truncate pr-1">{slot.label}</span>
                  <ColResizeHandle colKey={slot.key} onResizeStart={startColResize} onReset={resetColWidth} />
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--sps-border)] bg-[var(--sps-bg)]">
            {padTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: padTop, padding: 0, border: 0 }} />
              </tr>
            )}
            {visibleRows.map((row) => {
              if (row.type === 'banner') {
                const group = row.group;
                const isCollapsed = Boolean(collapsedScenes[group.sceneTag]);
                const firstShot = group.items[0]?.shot;
                const lastShot = group.items[group.items.length - 1]?.shot;
                const rangeTag = `${firstShot?.sceneShotId || `S${group.items[0].originalIdx + 1}`} to ${lastShot?.sceneShotId || `S${group.items[group.items.length - 1].originalIdx + 1}`}`;
                const sceneCountPillLabel = getMatrixSceneCountPillTitle(
                  group.items.length,
                  rangeTag
                );
                const sceneBannerLabel = getMatrixSceneBannerTitle(
                  group.sceneTag,
                  group.heading
                );
                return (
                <React.Fragment key={row.key}>
                  <tr className="sps-scene-banner border-y sticky top-[33px] z-20 select-none">
                    <td
                      colSpan={filteredSlots.length + 3}
                      className="p-2.5 px-4"
                      title={sceneBannerLabel}
                      aria-label={sceneBannerLabel}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div 
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={(e) => toggleSceneCollapse(group.sceneTag, e)}
                        >
                          <button 
                            type="button" 
                            className="w-6 h-6 rounded-[6px] font-semibold flex items-center justify-center text-xs border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[var(--sps-text)]"
                            title={
                              isCollapsed
                                ? getMatrixSceneCollapseTitle(true)
                                : getMatrixSceneCollapseTitle(false)
                            }
                            aria-label={
                              isCollapsed
                                ? getMatrixSceneCollapseTitle(true)
                                : getMatrixSceneCollapseTitle(false)
                            }
                          >
                            {isCollapsed ? '+' : '−'}
                          </button>
                          <span className="sps-scene-tag">
                            {group.sceneTag}
                          </span>
                          {group.spine ? (
                            <span className="text-[10px] font-mono text-[var(--sps-gold)] shrink-0">
                              Act {group.spine.act} · Seq {group.spine.sequenceSeq}
                            </span>
                          ) : null}
                          <h3
                            className="text-sm font-display font-semibold tracking-tight truncate max-w-3xl text-[var(--sps-text)]"
                          >
                            {group.heading}
                          </h3>
                        </div>

                        <div
                          className="flex items-center gap-3"
                          title={sceneCountPillLabel}
                          aria-label={sceneCountPillLabel}
                        >
                          <span className="sps-count-pill">
                            {group.items.length} {group.items.length === 1 ? 'shot' : 'shots'} ({rangeTag})
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
                );
              }

              const shot = row.shot;
              const shotIdx = row.shotIdx;
              if (!shot) return null;
              const isActive = shotIdx === activeShotIndex;
              const isMuted = !!shot?.isMuted;
              const isBeingDragged = draggedShotIdx === shotIdx;
              const isTargetDrop = dragOverShotIdx === shotIdx;

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
                          <td colSpan={filteredSlots.length + 1} className="px-3 py-1 text-red-700 dark:text-red-200 font-mono text-xs">
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
                          isActive ? 'is-active' : ''
                        } ${
                          isBeingDragged ? 'opacity-30' : ''
                        } ${
                          isTargetDrop ? 'border-t-2 border-t-[var(--sps-gold)]' : ''
                        }`}
                      >
                        <td 
                          draggable
                          onDragStart={(e) => handleDragStart(e, shotIdx)}
                          onDragOver={(e) => handleDragOver(e, shotIdx)}
                          onDrop={(e) => handleDrop(e, shotIdx)}
                          onDragEnd={handleDragEnd}
                          className="sps-matrix-index p-1.5 text-center font-mono border-r sticky left-0 z-20 cursor-grab active:cursor-grabbing select-none"
                          style={colStyle('index')}
                        >
                          <div className="flex items-center justify-center gap-1 font-bold">
                            <span className="text-[10px] opacity-60 font-mono">⋮⋮</span>
                            <span className="text-xs font-bold">{shotIdx + 1}</span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sps-gold)]" />
                            )}
                          </div>
                        </td>

                          <td className="p-1 border-r bg-[var(--sps-bg-elevated)] overflow-hidden" style={colStyle('actions')}>
                          <div className="sps-matrix-actions flex flex-col items-center justify-center gap-0.5">
                            <LifecycleControls
                              entity={shot}
                              compact
                              onChange={(next) => handleLifecycleChange(shotIdx, next)}
                            />
                            <div className="flex items-center justify-center gap-1">
                            {!lookOnly && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleAIEnhanceShot(shot, shotIdx); }}
                              disabled={enhancingShotIdx === shotIdx || isLifecycleLocked(shot)}
                              className="p-1"
                              title={isLifecycleLocked(shot) ? 'Unlock to enhance' : 'Enhance this shot'}
                            >
                              <Sparkles className={`w-3 h-3 ${enhancingShotIdx === shotIdx ? 'animate-spin' : ''}`} />
                            </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); copyShotPrompt(shot, shotIdx); }}
                              className="p-1"
                              title="Copy shot prompt"
                            >
                              {copiedIndex === shotIdx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>

                            {!lookOnly && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onCloneShot(shotIdx); }}
                              className="p-1"
                              title="Duplicate row"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (toggleMuteFn) toggleMuteFn(shotIdx);
                              }}
                              className="p-1"
                              title="Mute shot"
                            >
                              <VolumeX className="w-3 h-3" />
                            </button>
                            </div>
                          </div>
                        </td>

                          <td className="p-1 border-r align-middle overflow-hidden" style={colStyle('look')}>
                          {(() => {
                            const chars = matchCharactersForShot(shot);
                            const world = matchWorldForShot(shot);
                            const flags = continuityFlagsForShot(shot, shots, shotIdx);
                            const blocked = blockingFlags(flags);
                            const driftFixes = buildContinuityFixesForShot(shot, shots, shotIdx);
                            return (
                              <div className="flex flex-col items-center gap-0.5 min-w-0">
                                <div className="flex gap-0.5">
                                  {chars.slice(0, 2).map((c) =>
                                    characterLookUrl(c) ? (
                                      <img key={c.id} src={characterLookUrl(c)} alt="" className="w-6 h-6 object-cover" title={c.name} />
                                    ) : (
                                      <span key={c.id} className="w-6 h-6 border border-[var(--sps-border)] text-[8px] flex items-center justify-center" title="No look sheet">
                                        {(c.name || '?')[0]}
                                      </span>
                                    )
                                  )}
                                  {worldPlateUrl(world) ? (
                                    <img src={worldPlateUrl(world)} alt="" className="w-6 h-6 object-cover" title={world.name} />
                                  ) : null}
                                </div>
                                <span
                                  className={`text-[9px] ${blocked.length ? 'text-[var(--sps-gold)]' : flags.length ? 'text-[var(--sps-muted)]' : 'text-[var(--sps-muted)]'}`}
                                  title={flags.map((f) => `${f.block ? 'BLOCK' : 'WARN'} ${f.label}`).join('\n')}
                                >
                                  {blocked.length ? 'Block' : flags.length ? `${flags.length} warn` : 'Ready'}
                                </span>
                                {(shot.charAssetIds || []).length || (shot.worldAssetIds || []).length ? (
                                  <span
                                    className="text-[8px] font-mono text-[var(--sps-muted)] truncate max-w-full"
                                    title={[...(shot.charAssetIds || []), ...(shot.worldAssetIds || [])].join(', ')}
                                  >
                                    {(shot.charAssetIds || []).slice(0, 2).join(' ·')
                                      || (shot.worldAssetIds || []).slice(0, 1).join('')}
                                  </span>
                                ) : null}
                                <div className="flex gap-0.5">
                                  {onOpenGenerate ? (
                                    <button
                                      type="button"
                                      className="text-[8px] uppercase text-[var(--sps-muted)] hover:text-[var(--sps-text)]"
                                      title="Open Generate desk for this shot"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (setActiveShotIndex) setActiveShotIndex(shotIdx);
                                        onOpenGenerate();
                                      }}
                                    >
                                      Gen
                                    </button>
                                  ) : null}
                                  {driftFixes.length && onUpdateShot && !isLifecycleLocked(shot) ? (
                                    <button
                                      type="button"
                                      className="text-[8px] uppercase text-[var(--sps-gold)]"
                                      title="Document continuity drift as explicit patches"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        let next = shot;
                                        driftFixes.forEach((fix) => {
                                          next = applyContinuityPatch(next, fix.charKey, fix.patch, {
                                            projectTitle,
                                            log: true
                                          });
                                        });
                                        onUpdateShot(shotIdx, next);
                                      }}
                                    >
                                      Patch
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {filteredSlots.map((slot) => {
                          const parsedCurr = parseSceneAndShotID(shot, shotIdx);
                          const currentSceneId = parsedCurr.sceneStr || `SC${String(Math.floor(shotIdx / 3) + 1).padStart(2, '0')}`;
                          const currSceneIdx = scenesList.findIndex(sc => sc.sceneId === currentSceneId);

                          return (
                            <td
                              key={slot.key}
                              style={{
                                ...(isPaperTheme ? { borderColor: '#fde68a' } : { borderColor: '#27272a' }),
                                ...colStyle(slot.key)
                              }}
                              className="sps-matrix-slot p-1.5 border-r align-top overflow-hidden"
                            >
                              <SlotEditor
                                slotConfig={slot}
                                value={shot[slot.key] || ''}
                                onChange={(val) => handleCellChange(shotIdx, slot.key, val)}
                                shot={shot}
                                isMuted={Boolean(shot?.mutedSlots?.[slot.key])}
                                readOnly={isLifecycleLocked(shot)}
                                onToggleMute={(slotKey) => {
                                  const currentMuted = shot?.mutedSlots || {};
                                  const updatedMuted = { ...currentMuted, [slotKey]: !currentMuted[slotKey] };
                                  onUpdateShot(shotIdx, { ...shot, mutedSlots: updatedMuted });
                                }}
                                compact={true}
                                colorTheme={colorTheme}
                                genreKey={genreKey}
                                projectTitle={projectTitle}
                                shots={shots}
                                onOpenLlmCommands={onOpenLlmCommands}
                                onUpdateShot={onUpdateShot}
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
            {padBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: padBottom, padding: 0, border: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(SpreadsheetView);
