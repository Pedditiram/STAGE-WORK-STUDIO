import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FileText, Sparkles, RefreshCw, Download, Copy, Check, Save, Edit3, Cpu,
  Layers, Scroll, BookOpen, Search, Upload, History, ChevronDown, PanelRightOpen,
  PanelRightClose, StickyNote, Radar, Activity, Gauge, AlertTriangle, Zap,
  Users, Lock, Unlock, Archive, Palette, CircleHelp, Focus, ListTree, LayoutTemplate, MoreHorizontal, Maximize2, Minimize2, Mic, MicOff, Wand2
} from 'lucide-react';
import { PinBarButton } from './HoverPinBar';
import { resolveLlmApiKey } from '../utils/saasControl';
import { assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import {
  parseRawScriptToShots,
  extractMasterScriptSynopsisWithLLM,
  getLastParseMeta,
  extractTextFromPDF
} from '../services/aiScriptParser';
import {
  applyElementToCurrentLine,
  handleSmartEnter,
  extractSceneOutline,
  estimatePageCount,
  estimateRuntimeMinutes,
  getElementAtCaret,
  ELEMENT_LABELS,
  ELEMENT_COLORS,
  classifyScreenplayLines,
  findAllMatches,
  replaceMatch,
  replaceAllMatches,
  getLineIndexAtOffset
} from '../utils/screenplayFormat';
import { readOpenScreenplayText, writeOpenScreenplayText, 
  importScreenplayFile,
  exportFountain,
  exportPlainTxt,
  exportFdx,
  downloadTextFile,
  buildWriterMergeZipFiles,
  saveScreenplayVersion,
  loadScreenplayVersions,
  deleteScreenplayVersion,
  persistLiveScreenplay,
  loadScreenplayArchive,
  archiveScreenplayMilestone,
  promoteVersionToArchive,
  purgeScreenplayArchiveEntry,
  renameScreenplayArchiveEntry,
  SCREENPLAY_MILESTONE_PRESETS
} from '../utils/screenplayInterop';
import { analyzeScreenplay, intensityColor } from '../utils/screenplayIntelligence';
import ScreenplayDiffModal from './ScreenplayDiffModal';
import WriterHelpModal from './WriterHelpModal';
import ActiveProjectConfirmModal from './ActiveProjectConfirmModal';
import ScriptMergePromptModal from './ScriptMergePromptModal';
import AiScriptBreakdownPanel from './AiScriptBreakdownPanel';
import { detectScriptTitle } from '../utils/activeProjectGate';
import { assertProjectWriteGate, isProjectLifecycleLocked } from '../utils/productionLifecycle';
import { proposeApplyShotsCommand } from '../utils/llmCommandBus';
import {
  assertMergeApplyAllowed,
  buildStoryPackage,
  isSampleDemoShots,
  saveStoryPackage
} from '../utils/storyPackage';
import { isModKey, ELEMENT_DIGIT_MAP } from '../utils/writerHotkeys';
import {
  WRITER_VIEW_MODES,
  WRITER_VIEW_TIP_KEY,
  ELEMENT_COLORS_PAPER,
  getWriterViewMode,
  loadWriterViewMode,
  saveWriterViewMode,
  cycleWriterViewMode
} from '../utils/writerViews';
import {
  subscribeToScreenplayCollab,
  publishScreenplayCollab,
  currentWriterMeta,
  splitScreenplayScenes,
  sceneKeyAtCaret,
  isSceneLockedByOther,
  getSceneLock
} from '../services/screenplayCollab';
import {
  teluguFromSpeechResult,
  enforceTeluguOnly,
  hasTeluguScript,
  commitRomanWordBeforeCaret
} from '../utils/teluguVoiceText';
import { isGuestSession, canGuestBrowseApp } from '../utils/projectPermissions';
import { GUEST_PLAY_SCREENPLAY } from '../utils/guestPlayground';

const DEFAULT_SAMPLE_SCREENPLAY = `ACT I: THE THREAT OF JANASTHANA — DEMON LEGION ARRIVES

SC.01 0:00-0:30 OMINOUS DUSK FOREBODING
EXT. PANCHAVATI FOREST CLEARING - DUSK

Dappled sunlight pierces through dense canopy as ancient banyan trees sway gently in the evening breeze. Soft forest mist settles over golden sands.

[SHOT S01-A]: Extreme Wide Panorama High Angle Vista
Camera: Slow Forward Dolly Push
Lighting: Dappled Sunlight through Dense Canopy
Subject Color: Deep Emerald Green & Silk Ivory

LORD RAMA stands on a moss-covered boulder, gazing toward the dark horizon with serene confidence. KODANDA BOW rests in his left hand.

LAKSHMANA
(whispering, vigilant)
Brother... the air turns heavy. The birds have fled the eastern ridge.

RAMA
(calm, steady)
The forest senses what comes, Lakshmana. Keep Sita within the inner sanctuary.

[SHOT S01-B]: Medium Close-Up Portrait
Camera: Static Anchor with Subtle Zoom
Lighting: Chiaroscuro Rim Light
LAKSHMANA nods solemnly, drawing his sword halfway from its scabbard.

[SHOT S01-C]: MCU Intercut Quick Cuts
Camera: Rapid Motion Whip Cut
Snarling demon legion silhouettes crest the eastern ridge under venom-green smoke.

[SHOT S01-D]: OTS Back Wide Hold
Camera: Static Anchor
Over Rama's shoulder — alone at forest's edge in saffron dhoti, divine blue skin. He nocks an arrow.

SC.02 0:30-1:05 WAR CHARIOT APPROACH & DIVINE AWAKENING
EXT. JANASTHANA FRONTLINE - CONTINUOUS

[SHOT S02-A]: Extreme Wide Action Vista
Camera: Fast Crash Zoom
Lighting: Harsh Scorching Solar Glow

DUSHANA'S WAR CHARIOT rumbles through the dust, pulled by four black armored war horses with glowing red eyes.

DUSHANA
(roaring to his vanguard)
Forward! Crush the hermit warrior before sunfall!

[SHOT S02-B]: Low Angle Hero Tracking
Camera: Tracking Shot alongside Chariot Wheels
Subject Color: Dark Obsidian Armor & Gold Rim

DUSHANA brandishes his massive spiked iron mace, eyes gleaming with fiery wrath.

[SHOT S02-C]: Medium Wide Frontal Charge
Camera: Side Tracking Arc
Lighting: High Contrast Chiaroscuro Noir

Demonic ranks surge behind him like a dark ocean of bronze armor and floating embers.

ACT II: BOW OF THE UNIVERSE — THE SLAYING BEGINS

SC.03 1:05-1:25 DUSHANA'S VANGUARD CHARGE
EXT. BATTLEFIELD CLEARING - DAY

[SHOT S03-A]: Low Angle Ground Sweep
Camera: 360-Degree Orbit
RAMA steps down onto the battlefield. His aura flares with divine solar radiance.

RAMA
(facing 14,000 host)
Stand down, Rakshasas of Janasthana, or face the judgement of Shiva's bow.

[SHOT S03-B]: Wide Trailing Whip Pan
Camera: Tracking Whip Pan
Arrows arc in golden trails — each splits into cascades mid-flight. Demon front rank vaporises.

[SHOT S03-C]: Medium Side Intercut
Camera: Steadicam Orbit
Demon commanders roar and rally as wave after wave charges from grey mist.

[SHOT S03-D]: Low Dutch Steadicam Orbit
Camera: Low Dutch Steadicam
Celestial blue aura deflects every projectile. Rama draws again.

SC.04 1:25-1:50 DHUSHAN'S CHARGE · GENERAL'S WRATH
EXT. JANASTHANA BATTLEGROUND - CONTINUOUS

[SHOT S04-A]: Low Wide Push Forward Fast
Camera: Fast Push
DHUSHAN — towering, veins of poison-green electricity across armor. Charges on war elephant.

[SHOT S04-B]: POV Charge Shaky-Cam Rush
Camera: Shaky-Cam POV
Dhushan's POV: Rama a lone saffron flame in the grey world ahead.

[SHOT S04-C]: ECU Intercut Match Cut
Camera: ECU Match Cut
Rama selects the Vayavya astra. Arrow glows blue-white. Wind stops, then erupts.

SC.05 1:50-2:15 DIVINE ASTRA · DHUSHAN FALLS
EXT. BATTLEFIELD CLEARING - CONTINUOUS

[SHOT S05-A]: Aerial EWS God's-Eye Pullback
Camera: God's-Eye Aerial Pullback
Vayavya astra releases — comet of gold-blue scorches grey battlefield. Wind vortex sweeps five hundred skyward.

[SHOT S05-B]: Slow-Mo Medium Shot 250 FPS
Camera: 250 FPS Slow Motion
Dhushan chariot disintegrates in slow motion through saffron-lit air.

[SHOT S05-C]: Ground CU Static
Camera: Static Ground Impact
Dhushan crashes. Green light fades from armor — grey, then still.

ACT III: THE GOD REVEALED — KARA AND TOTAL ANNIHILATION

SC.06 2:15-2:40 KARA ADVANCES · DEMON KING'S PRIDE
EXT. BATTLEFIELD RIDGE - CONTINUOUS

[SHOT S06-A]: Low-Angle Wide Slow Push-In
Camera: Low Angle Push-In
KARA descends from chariot. Towering, dark as storm-clouds, obsidian crown.

[SHOT S06-B]: Tight OTS Match Push
Camera: Match Push
Over Kara's massive shoulder: Kara hurls Shakti spear, green-black and howling.

[SHOT S06-C]: Front CU Whip-Pan Dodge
Camera: Whip Pan Dodge
Rama sidesteps — single fluid motion. Spear tears past. Rama turns back with a serene smile.

SC.07 2:40-3:05 DIVINE RADIANCE · RAMA'S TRUE FORM
EXT. PANCHAVATI VALLEY - CONTINUOUS

[SHOT S07-A]: Wide Hero Slow-Rise Crane
Camera: Slow-Rise Crane
Rama's aura expands — saffron crown-light, oceanic blue along limbs, gold at bow.

[SHOT S07-B]: Aerial Pull Extreme Pullback
Camera: Extreme Aerial Pullback
Rama a single saffron star in sea of demon-grey. Radiance pushes outward.

[SHOT S07-C]: CU Front Rack to Deep Focus
Camera: Deep Focus Rack
Rama strings Brahmastra. Arrow radiates pulsing blue-gold. Silence drops over battlefield.

SC.08 3:05-3:30 KARA SLAIN · CLIMAX
EXT. BATTLEFIELD CENTER - CONTINUOUS

[SHOT S08-A]: Front Wide Speed-Ramp Release
Camera: Speed-Ramp Release
Brahmastra tears sky, parting grey clouds, revealing actual sun. Arrow strikes Kara at chest.

[SHOT S08-B]: ECU Slow-Mo 500 FPS
Camera: 500 FPS Slow Motion
Kara's face — green light dies in eyes. Obsidian armor fractures in slow splendor.

[SHOT S08-C]: Aerial EWS God's-Eye Static
Camera: God's-Eye Static
Entire demon army dissolves into grey smoke simultaneously. One saffron-blue figure stands.

SC.09 3:30-4:00 CODA · ETERNAL DHARMA RESTORED
EXT. PANCHAVATI FOREST - DAWN

[SHOT S09-A]: Slow Aerial Drift Skyward
Camera: Slow Aerial Drift
Camera drifts up from Rama — sky cracks to actual blue, actual sun. Saffron and celestial warm the forest canopy.`;

function readStoredScreenplay() {
  if (typeof window === 'undefined') return DEFAULT_SAMPLE_SCREENPLAY;
  try {
    if (isGuestSession() && canGuestBrowseApp()) {
      return sessionStorage.getItem('sps_guest_play_screenplay') || GUEST_PLAY_SCREENPLAY;
    }
  } catch {
    /* ignore */
  }
  const saved = readOpenScreenplayText();
  return saved && saved.trim() ? saved : DEFAULT_SAMPLE_SCREENPLAY;
}

export default function ScreenplayEditor({
  shots = [],
  onUpdateShotsFromScript,
  onNavigateToView,
  onOpenCharacters,
  onOpenLlmCommands,
  onApplyShots,
  setPresetProfile,
  projectTitle = 'STAGE PRODUCTION STUDIO',
  initialConsoleTab = 'screenplay',
  roomId = ''
}) {
  const [activeConsoleTab, setActiveConsoleTab] = useState(() => {
    if (initialConsoleTab === 'synopsis') return 'synopsis';
    if (initialConsoleTab === 'breakdown') return 'breakdown';
    return 'screenplay';
  });

  useEffect(() => {
    if (initialConsoleTab === 'synopsis' || initialConsoleTab === 'screenplay' || initialConsoleTab === 'breakdown') {
      setActiveConsoleTab(initialConsoleTab);
    }
  }, [initialConsoleTab]);

  const [scriptSynopsisSource, setScriptSynopsisSource] = useState('auto_llm');
  const [llmAutoSynopsis, setLlmAutoSynopsis] = useState('');
  const [writerCustomSynopsis, setWriterCustomSynopsis] = useState('');
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false);

  const [scriptText, setScriptText] = useState(readStoredScreenplay);
  const [writerChromePinned, setWriterChromePinned] = useState(() => {
    try {
      const v = localStorage.getItem('sps_pin_writer_chrome');
      if (v === 'false') return false;
      return true;
    } catch { return true; }
  });
  const [elementBarPinned, setElementBarPinned] = useState(() => {
    try {
      const v = localStorage.getItem('sps_pin_writer_element_bar');
      return v === null ? true : v === 'true';
    } catch { return true; }
  });
  const [writerChromeHoverOpen, setWriterChromeHoverOpen] = useState(false);
  const [elementBarHoverOpen, setElementBarHoverOpen] = useState(false);
  const writerChromeLeaveRef = useRef(null);
  const elementBarLeaveRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('sps_pin_writer_chrome', writerChromePinned ? 'true' : 'false');
      localStorage.setItem('sps_pin_writer_element_bar', elementBarPinned ? 'true' : 'false');
    } catch (e) {}
  }, [writerChromePinned, elementBarPinned]);

  useEffect(() => () => {
    if (writerChromeLeaveRef.current) clearTimeout(writerChromeLeaveRef.current);
    if (elementBarLeaveRef.current) clearTimeout(elementBarLeaveRef.current);
  }, []);
  const [caretPos, setCaretPos] = useState(0);
  const [rightDrawer, setRightDrawer] = useState(null); // 'find' | 'versions' | 'intel' | null
  const [versionsSubTab, setVersionsSubTab] = useState('drafts'); // 'drafts' | 'archive'
  const [intelSubTab, setIntelSubTab] = useState('radar'); // 'radar' | 'pacing' | 'beats' | 'flags'
  const [exportOpen, setExportOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const [versions, setVersions] = useState(() => loadScreenplayVersions());
  const [scriptArchive, setScriptArchive] = useState(() => loadScreenplayArchive());
  const [archiveName, setArchiveName] = useState('Pink Draft');
  const [archiveNote, setArchiveNote] = useState('');
  const [archiveMsg, setArchiveMsg] = useState('');
  const [colorCodeEnabled, setColorCodeEnabled] = useState(() =>
    !!getWriterViewMode(loadWriterViewMode()).colorsDefault
  );
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLeft, setDiffLeft] = useState({ text: '', label: 'Version' });
  const [helpOpen, setHelpOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => loadWriterViewMode());
  const projectLocked = useMemo(() => isProjectLifecycleLocked(projectTitle), [projectTitle]);
  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: writerLifecycleStrict,
    mode: writerLifecycleMode
  } = useExportLifecyclePref('writer');
  const exportBlocked = writerLifecycleStrict && !exportLife.exportReady;
  const writerLiveCount = useMemo(
    () => (Array.isArray(shots) ? shots.filter((s) => s && !s.isArchived).length : 0),
    [shots]
  );
  const writerLifeNote = `${writerLiveCount} live shots · writer${roomId ? ` · room:${roomId}` : ''}`;

  const [viewTipDismissed, setViewTipDismissed] = useState(() => {
    try {
      return localStorage.getItem(WRITER_VIEW_TIP_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [studioMoreOpen, setStudioMoreOpen] = useState(false);
  const studioMoreRef = useRef(null);
  const highlightRef = useRef(null);
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [isAICowriting, setIsAICowriting] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [copiedSynopsis, setCopiedSynopsis] = useState('');
  const [parseStatusMsg, setParseStatusMsg] = useState('✓ Live Auto-Synced with 25-Craft Matrix');
  const [importMsg, setImportMsg] = useState('');
  const [parseGateOpen, setParseGateOpen] = useState(false);
  const [pendingParseText, setPendingParseText] = useState('');
  const [mergePromptOpen, setMergePromptOpen] = useState(false);
  const [mergeApplyState, setMergeApplyState] = useState({
    parsedShots: [],
    textToParse: '',
    existingCount: 0,
    incomingCount: 0
  });
  const [pendingDetectedTitle, setPendingDetectedTitle] = useState('');
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [collabDoc, setCollabDoc] = useState(null);
  const [claimedSceneKey, setClaimedSceneKey] = useState(null);
  const [collabStatus, setCollabStatus] = useState('');
  const writerMeta = useMemo(() => currentWriterMeta(), []);
  const applyingRemoteRef = useRef(false);
  const collabPublishTimer = useRef(null);
  const collabDocRef = useRef(null);
  const scriptTextRef = useRef(scriptText);
  scriptTextRef.current = scriptText;
  collabDocRef.current = collabDoc;

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const exportMenuRef = useRef(null);
  const writerRootRef = useRef(null);
  const draftPaperRef = useRef(null);
  const [fullscreenLevel, setFullscreenLevel] = useState(0); // 0 normal · 1 writer console · 2 draft page
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceLangMode, setVoiceLangMode] = useState(() => {
    try {
      const saved = localStorage.getItem('sps_writer_voice_lang');
      if (saved === 'te-IN' || saved === 'en-IN' || saved === 'auto') return saved;
    } catch {
      /* ignore */
    }
    return 'auto';
  });
  const [voiceStatus, setVoiceStatus] = useState('');
  const recognitionRef = useRef(null);
  const voiceBaseRef = useRef({ text: '', caret: 0 });
  const voiceInterimRef = useRef('');
  const voiceLangRef = useRef('en-IN');

  const scriptHasTelugu = useMemo(
    () => /[\u0C00-\u0C7F]/.test(String(scriptText || '')),
    [scriptText]
  );

  const resolvedVoiceLang = useMemo(() => {
    if (voiceLangMode === 'te-IN' || voiceLangMode === 'en-IN') return voiceLangMode;
    // Auto: Telugu script in draft → dictate Telugu; otherwise English (India)
    return scriptHasTelugu ? 'te-IN' : 'en-IN';
  }, [voiceLangMode, scriptHasTelugu]);

  useEffect(() => {
    voiceLangRef.current = resolvedVoiceLang;
  }, [resolvedVoiceLang]);

  const persistVoiceLangMode = useCallback((mode) => {
    setVoiceLangMode(mode);
    try {
      localStorage.setItem('sps_writer_voice_lang', mode);
    } catch {
      /* ignore */
    }
  }, []);

  const applyScriptText = useCallback((next, opts = {}) => {
    setScriptText(next);
    persistLiveScreenplay(next);
    if (typeof opts.caret === 'number' && textareaRef.current) {
      const c = opts.caret;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(c, c);
        setCaretPos(c);
      });
    }
  }, []);

  const reloadFromStorage = useCallback(() => {
    const next = readStoredScreenplay();
    setScriptText(next);
  }, []);

  useEffect(() => {
    if (activeConsoleTab === 'screenplay') {
      reloadFromStorage();
    }
  }, [activeConsoleTab, reloadFromStorage]);

  useEffect(() => {
    const onStorage = (e) => {
      if (
        e.key === 'sps_current_screenplay_text' ||
        e.key === 'sps_live_screenplay_text' ||
        e.key === null
      ) {
        reloadFromStorage();
      }
    };
    const onCustom = () => reloadFromStorage();
    window.addEventListener('storage', onStorage);
    window.addEventListener('sps_screenplay_updated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('sps_screenplay_updated', onCustom);
    };
  }, [reloadFromStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedSource = localStorage.getItem('sps_script_synopsis_source') || 'auto_llm';
    setScriptSynopsisSource(savedSource);
    const autoCand =
      localStorage.getItem('sps_extracted_master_story') ||
      localStorage.getItem('sps_master_script_story') ||
      localStorage.getItem('sps_narrative_prose_story') ||
      '';
    setLlmAutoSynopsis(autoCand);
    setWriterCustomSynopsis(localStorage.getItem('sps_writer_custom_script_synopsis') || '');
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportOpen(false);
      }
      if (studioMoreRef.current && !studioMoreRef.current.contains(e.target)) {
        setStudioMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const viewCfg = useMemo(() => getWriterViewMode(viewMode), [viewMode]);
  const paperCream = viewCfg.paper === 'cream';
  const palette = paperCream ? ELEMENT_COLORS_PAPER : ELEMENT_COLORS;

  const applyViewMode = useCallback((id) => {
    const cfg = getWriterViewMode(id);
    setViewMode(id);
    saveWriterViewMode(id);
    setColorCodeEnabled(!!cfg.colorsDefault);
    setStudioMoreOpen(false);
    if (!cfg.showStudioChrome) setRightDrawer(null);
  }, []);

  const dismissViewTip = () => {
    setViewTipDismissed(true);
    try {
      localStorage.setItem(WRITER_VIEW_TIP_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const clearImmersiveClasses = useCallback(() => {
    try {
      document.documentElement.classList.remove('sps-fs-active');
      writerRootRef.current?.classList.remove('sps-fs-console');
      draftPaperRef.current?.classList.remove('sps-fs-draft');
    } catch {
      /* ignore */
    }
  }, []);

  const recoverWriterLayout = useCallback(() => {
    clearImmersiveClasses();
    setFullscreenLevel(0);
    // Safari blank-page recovery after fullscreen / app-switch
    try {
      const root = document.getElementById('root');
      if (root) {
        root.style.minHeight = '100vh';
        root.style.display = '';
        root.style.visibility = 'visible';
        root.style.opacity = '1';
      }
      document.body.style.minHeight = '100vh';
      document.body.style.background = '';
      // Force reflow
      void document.body.offsetHeight;
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
      }
    });
  }, [clearImmersiveClasses]);

  const requestBrowserFullscreen = async () => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req) return false;
    try {
      if (!document.fullscreenElement) await req.call(el);
      return true;
    } catch (err) {
      console.warn('Browser fullscreen failed:', err);
      return false;
    }
  };

  /** ⌘Enter: 1) Console immersive (+ browser FS) → 2) Draft page immersive. Esc exits. */
  const exitWriterFullscreen = useCallback(async () => {
    clearImmersiveClasses();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
    recoverWriterLayout();
  }, [clearImmersiveClasses, recoverWriterLayout]);

  const cycleWriterFullscreen = useCallback(async () => {
    if (fullscreenLevel === 0) {
      setFullscreenLevel(1);
      document.documentElement.classList.add('sps-fs-active');
      await requestBrowserFullscreen();
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (fullscreenLevel === 1) {
      setFullscreenLevel(2);
      document.documentElement.classList.add('sps-fs-active');
      if (!document.fullscreenElement) await requestBrowserFullscreen();
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    // Level 2: stay; Esc exits
  }, [fullscreenLevel]);

  useEffect(() => {
    if (fullscreenLevel === 0) {
      document.documentElement.classList.remove('sps-fs-active');
    } else {
      document.documentElement.classList.add('sps-fs-active');
    }
  }, [fullscreenLevel]);

  useEffect(() => {
    const onFs = () => {
      // Native Esc / app-switch can drop browser fullscreen — restore layout safely
      if (!document.fullscreenElement && fullscreenLevel > 0) {
        recoverWriterLayout();
      }
    };
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const root = document.getElementById('root');
        if (root) {
          root.style.visibility = 'visible';
          root.style.opacity = '1';
          root.style.display = '';
          root.style.minHeight = '100vh';
        }
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
      } catch {
        /* ignore */
      }
      if (!document.fullscreenElement && fullscreenLevel > 0) {
        recoverWriterLayout();
      }
    };
    const onPageShow = (ev) => {
      if (ev.persisted || !document.fullscreenElement) {
        try {
          const root = document.getElementById('root');
          if (root) {
            root.style.visibility = 'visible';
            root.style.opacity = '1';
            root.style.display = '';
          }
        } catch {
          /* ignore */
        }
        if (!document.fullscreenElement) {
          clearImmersiveClasses();
          setFullscreenLevel(0);
        }
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [fullscreenLevel, recoverWriterLayout, clearImmersiveClasses]);

  const stopVoiceToType = useCallback(() => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    voiceInterimRef.current = '';
    setVoiceListening(false);
  }, []);

  const insertVoiceText = useCallback(
    (spoken, { interim = false } = {}) => {
      const base = voiceBaseRef.current;
      const start = base.caret;
      const before = base.text.slice(0, start);
      const after = base.text.slice(start);
      const needsSpace =
        spoken &&
        before &&
        !/\s$/.test(before) &&
        !/^[.,!?;:\n)]/.test(spoken);
      const chunk = `${needsSpace ? ' ' : ''}${spoken}`;
      const next = `${before}${chunk}${after}`;
      const caret = before.length + chunk.length;
      applyScriptText(next, { caret });
      if (!interim) {
        voiceBaseRef.current = { text: next, caret };
        voiceInterimRef.current = '';
      }
    },
    [applyScriptText]
  );

  const startVoiceToType = useCallback((langOverride = null) => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setVoiceStatus('Voice typing needs Chrome/Edge/Safari with speech support');
      return;
    }
    const lang = langOverride || voiceLangRef.current || resolvedVoiceLang;
    stopVoiceToType();
    const el = textareaRef.current;
    const caret = el ? el.selectionStart : caretPos;
    voiceBaseRef.current = { text: scriptText, caret };
    voiceInterimRef.current = '';

    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    // More alternatives help when Chrome returns romanized Latin for te-IN
    rec.maxAlternatives = lang === 'te-IN' ? 5 : 1;

    rec.onstart = () => {
      setVoiceListening(true);
      setVoiceStatus(
        lang === 'te-IN'
          ? 'తెలుగు వినడం… (Telugu script only)'
          : 'Listening (English)…'
      );
    };
    rec.onerror = (ev) => {
      const code = ev?.error || 'error';
      if (code === 'not-allowed') setVoiceStatus('Microphone blocked — allow mic access');
      else if (code === 'no-speech') setVoiceStatus('No speech heard — try again');
      else if (code === 'language-not-supported') {
        setVoiceStatus('Telugu not supported in this browser — try Chrome');
      } else setVoiceStatus(`Voice error: ${code}`);
      setVoiceListening(false);
    };
    rec.onend = () => {
      // Keep listening if user didn't stop (browser may auto-end)
      if (recognitionRef.current === rec) {
        try {
          rec.lang = voiceLangRef.current || lang;
          rec.start();
        } catch {
          setVoiceListening(false);
          setVoiceStatus('');
          recognitionRef.current = null;
        }
      }
    };
    rec.onresult = (event) => {
      const teMode = (voiceLangRef.current || lang) === 'te-IN';
      let finalChunk = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        if (r.isFinal) {
          const piece = teMode ? teluguFromSpeechResult(r) : String(r?.[0]?.transcript || '');
          finalChunk += piece;
        } else {
          const raw = String(r?.[0]?.transcript || '');
          interim += teMode ? enforceTeluguOnly(raw) : raw;
        }
      }
      if (finalChunk) {
        const spoken = teMode ? enforceTeluguOnly(finalChunk) : finalChunk.trim();
        if (spoken) {
          insertVoiceText(spoken, { interim: false });
          setVoiceStatus(teMode ? 'తెలుగు లిపి typed · keep speaking' : 'Captured · keep speaking');
        } else if (teMode) {
          setVoiceStatus('తెలుగులో మాట్లాడండి — English skipped');
        }
      } else if (interim) {
        const preview = interim.trim();
        // Telugu mode: never show Latin interim in the script
        if (teMode && preview && !hasTeluguScript(preview)) {
          setVoiceStatus('తెలుగు వినడం… converting…');
          return;
        }
        if (preview && preview !== voiceInterimRef.current) {
          voiceInterimRef.current = preview;
          const base = voiceBaseRef.current;
          const before = base.text.slice(0, base.caret);
          const after = base.text.slice(base.caret);
          const needsSpace =
            preview && before && !/\s$/.test(before) && !/[\u0C00-\u0C7F]$/.test(before);
          const next = `${before}${needsSpace ? ' ' : ''}${preview}${after}`;
          applyScriptText(next, {
            caret: before.length + (needsSpace ? 1 : 0) + preview.length
          });
        }
      }
    };

    try {
      rec.start();
    } catch (err) {
      setVoiceStatus(err?.message || 'Could not start microphone');
      setVoiceListening(false);
    }
  }, [resolvedVoiceLang, scriptText, caretPos, stopVoiceToType, insertVoiceText, applyScriptText]);

  const toggleVoiceToType = useCallback(() => {
    if (voiceListening) {
      stopVoiceToType();
      setVoiceStatus('Voice typing off');
      return;
    }
    startVoiceToType();
  }, [voiceListening, stopVoiceToType, startVoiceToType]);

  const startVoiceInLang = useCallback(
    (mode) => {
      persistVoiceLangMode(mode === 'auto' ? 'auto' : mode);
      const lang = mode === 'auto' ? (scriptHasTelugu ? 'te-IN' : 'en-IN') : mode;
      voiceLangRef.current = lang;
      startVoiceToType(lang);
    },
    [persistVoiceLangMode, scriptHasTelugu, startVoiceToType]
  );

  // If language mode changes while listening, restart recognizer with new lang
  useEffect(() => {
    if (!voiceListening) return;
    const rec = recognitionRef.current;
    if (!rec) return;
    if (rec.lang === resolvedVoiceLang) return;
    startVoiceToType(resolvedVoiceLang);
  }, [resolvedVoiceLang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopVoiceToType(), [stopVoiceToType]);

  const sceneOutline = useMemo(() => extractSceneOutline(scriptText), [scriptText]);
  const totalPages = useMemo(() => estimatePageCount(scriptText), [scriptText]);
  const runtimeMin = useMemo(() => estimateRuntimeMinutes(scriptText), [scriptText]);
  const intel = useMemo(
    () =>
      analyzeScreenplay(scriptText, {
        caret: caretPos,
        shotCountHint: (scriptText.match(/\[SHOT\s+S\d+-\w+\]/gi) || []).length
      }),
    [scriptText, caretPos]
  );
  const sceneSegments = useMemo(() => splitScreenplayScenes(scriptText), [scriptText]);
  const caretSceneKey = useMemo(
    () => sceneKeyAtCaret(scriptText, caretPos),
    [scriptText, caretPos]
  );
  const activeSceneLock = useMemo(
    () => (collabEnabled ? getSceneLock(collabDoc, caretSceneKey) : null),
    [collabEnabled, collabDoc, caretSceneKey]
  );
  const editingLockedByOther = useMemo(
    () =>
      collabEnabled &&
      caretSceneKey &&
      isSceneLockedByOther(collabDoc, caretSceneKey, writerMeta.userEmail),
    [collabEnabled, collabDoc, caretSceneKey, writerMeta.userEmail]
  );
  const onlineWriters = useMemo(() => {
    const list = Array.isArray(collabDoc?.presence) ? collabDoc.presence : [];
    return list.filter((p) => p?.userEmail);
  }, [collabDoc]);

  useEffect(() => {
    if (!collabEnabled) {
      setCollabDoc(null);
      setClaimedSceneKey(null);
      setCollabStatus('');
      return undefined;
    }
    setCollabStatus('Connecting co-write room…');
    const unsub = subscribeToScreenplayCollab(roomId, projectTitle, (doc) => {
      setCollabDoc(doc);
      collabDocRef.current = doc;
      setCollabStatus(
        `${(doc?.presence || []).length || 1} writer(s) · room ${roomId}`
      );
      if (!doc?.text) return;
      if (applyingRemoteRef.current) return;
      const remoteText = String(doc.text || '');
      if (remoteText && remoteText !== scriptTextRef.current) {
        applyingRemoteRef.current = true;
        setScriptText(remoteText);
        persistLiveScreenplay(remoteText);
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 80);
      }
    });
    publishScreenplayCollab(roomId, projectTitle, scriptTextRef.current, {
      claimedSceneKey: null
    }).catch(() => {});
    return () => unsub();
  }, [collabEnabled, roomId, projectTitle]);

  useEffect(() => {
    if (!collabEnabled || applyingRemoteRef.current) return undefined;
    if (collabPublishTimer.current) clearTimeout(collabPublishTimer.current);
    collabPublishTimer.current = setTimeout(() => {
      publishScreenplayCollab(roomId, projectTitle, scriptText, {
        claimedSceneKey,
        baseDoc: collabDocRef.current
      })
        .then((doc) => {
          setCollabDoc(doc);
          collabDocRef.current = doc;
        })
        .catch(() => {});
    }, 900);
    return () => {
      if (collabPublishTimer.current) clearTimeout(collabPublishTimer.current);
    };
  }, [scriptText, collabEnabled, claimedSceneKey, roomId, projectTitle]);

  const handleClaimScene = async (sceneKey) => {
    if (!collabEnabled || !sceneKey) return;
    if (isSceneLockedByOther(collabDocRef.current, sceneKey, writerMeta.userEmail)) {
      const lock = getSceneLock(collabDocRef.current, sceneKey);
      alert(`Scene locked by ${lock?.userName || lock?.userEmail || 'another writer'}.`);
      return;
    }
    setClaimedSceneKey(sceneKey);
    const doc = await publishScreenplayCollab(roomId, projectTitle, scriptTextRef.current, {
      claimedSceneKey: sceneKey,
      baseDoc: collabDocRef.current
    });
    setCollabDoc(doc);
    collabDocRef.current = doc;
    const seg = splitScreenplayScenes(scriptTextRef.current).find((s) => s.key === sceneKey);
    const el = textareaRef.current;
    if (seg && el) {
      const pos = Math.max(0, Math.min(seg.offset, scriptTextRef.current.length));
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaretPos(pos);
      const lineIdx = getLineIndexAtOffset(scriptTextRef.current, pos);
      el.scrollTop = Math.max(0, lineIdx * 22 - el.clientHeight / 3);
    }
  };

  const handleReleaseScene = async () => {
    setClaimedSceneKey(null);
    const doc = await publishScreenplayCollab(roomId, projectTitle, scriptTextRef.current, {
      claimedSceneKey: null,
      baseDoc: collabDocRef.current
    });
    setCollabDoc(doc);
    collabDocRef.current = doc;
  };

  const currentElement = useMemo(
    () => getElementAtCaret(scriptText, caretPos),
    [scriptText, caretPos]
  );
  const findMatches = useMemo(
    () => findAllMatches(scriptText, findQuery),
    [scriptText, findQuery]
  );

  const currentPage = useMemo(() => {
    const lines = String(scriptText || '').split('\n');
    const totalLines = Math.max(1, lines.length);
    const lineIdx = getLineIndexAtOffset(scriptText, caretPos);
    const ratio = lineIdx / totalLines;
    return Math.min(totalPages, Math.max(1, Math.floor(ratio * totalPages) + 1));
  }, [scriptText, caretPos, totalPages]);

  const wordCount = useMemo(
    () => (scriptText.match(/\b\w+\b/g) || []).length,
    [scriptText]
  );
  const shotCount = useMemo(
    () => (scriptText.match(/\[SHOT\s+S\d+-\w+\]/gi) || []).length || shots.length || 0,
    [scriptText, shots.length]
  );

  const syncCaretFromTextarea = () => {
    const el = textareaRef.current;
    if (el) setCaretPos(el.selectionStart || 0);
  };

  const jumpToOffset = (offset) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = Math.max(0, Math.min(offset, scriptText.length));
    el.focus();
    el.setSelectionRange(pos, pos);
    setCaretPos(pos);
    // Approximate scroll: set selection then scrollIntoView via a temp range
    const lineHeight = 22;
    const lineIdx = getLineIndexAtOffset(scriptText, pos);
    el.scrollTop = Math.max(0, lineIdx * lineHeight - el.clientHeight / 3);
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem('sps_script_synopsis_source', scriptSynopsisSource);
      localStorage.setItem('sps_writer_custom_script_synopsis', writerCustomSynopsis);
      if (llmAutoSynopsis) {
        localStorage.setItem('sps_extracted_master_story', llmAutoSynopsis);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [scriptSynopsisSource, writerCustomSynopsis, llmAutoSynopsis]);

  const handleAIExtractSynopsis = async () => {
    try {
      setIsGeneratingSynopsis(true);
      const aiResult = await extractMasterScriptSynopsisWithLLM(scriptText);
      if (aiResult && aiResult.trim()) {
        const cleanRes = aiResult.trim();
        setLlmAutoSynopsis(cleanRes);
        localStorage.setItem('sps_extracted_master_story', cleanRes);
      }
    } catch (err) {
      console.warn('Error auto-generating Script Synopsis:', err);
    } finally {
      setIsGeneratingSynopsis(false);
    }
  };

  const handleParseScriptToMatrix = async (textToParse = scriptText) => {
    if (!textToParse || !String(textToParse).trim()) {
      setParseStatusMsg('⚠️ Paste screenplay text before syncing to matrix.');
      return;
    }
    const writeGate = assertProjectWriteGate(projectTitle, { auditLabel: 'writer_parse_start' });
    if (!writeGate.ok) {
      setParseStatusMsg(`⚠️ ${writeGate.message}`);
      alert(writeGate.message);
      return;
    }
    const detected = detectScriptTitle(textToParse);
    setPendingDetectedTitle(detected);
    setPendingParseText(String(textToParse));
    setParseGateOpen(true);
  };

  const proposeParsedShotsToReview = (parsedShots, textToParse, mode = 'overwrite') => {
    const pkg = buildStoryPackage({
      projectTitle,
      shots: parsedShots,
      fullElements: { shots: parsedShots },
      sourceText: textToParse
    });
    const liveCount = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived).length;
    const gate = assertMergeApplyAllowed({
      activeTitle: projectTitle,
      pkg,
      mode,
      intendedTitle: detectScriptTitle(textToParse) || projectTitle,
      existingShotCount: liveCount,
      incomingCount: parsedShots.length,
      auditLabel: mode === 'merge' ? 'writer_merge_apply' : 'writer_overwrite_apply'
    });
    if (!gate.ok) {
      setParseStatusMsg(`⚠️ ${gate.message}`);
      alert(gate.message);
      return;
    }
    const proposed = proposeApplyShotsCommand(
      {
        projectTitle,
        shots: parsedShots,
        mode,
        extras: {
          screenplayText: textToParse,
          markStoryPackage: true,
          learnFromParse: true
        },
        source: mode === 'merge' ? 'writer_merge' : 'writer_parse',
        reason: `Writer screenplay → Matrix (${mode})`
      },
      { shots, projectTitle }
    );
    if (!proposed.ok) {
      setParseStatusMsg(`⚠️ ${proposed.error || proposed.errors?.join('; ') || 'Proposal blocked'}`);
      alert(proposed.error || proposed.errors?.join('; ') || 'Parse proposal failed');
      return;
    }
    if (onOpenLlmCommands) {
      onOpenLlmCommands();
      setParseStatusMsg(
        `✓ ${parsedShots.length} shots queued (${mode}) — approve in LLM command review`
      );
    } else {
      setParseStatusMsg(
        `✓ Parsed ${parsedShots.length} shots (${mode}) — open Production → LLM command review to apply`
      );
    }
  };

  const confirmParseScriptToMatrix = async () => {
    setParseGateOpen(false);
    const textToParse = pendingParseText || scriptText;
    setPendingParseText('');
    const detected = pendingDetectedTitle || detectScriptTitle(textToParse);
    setPendingDetectedTitle('');
    const gate = assertProjectWriteGate(projectTitle, {
      intendedTitle: detected || projectTitle,
      auditLabel: 'writer_parse_confirm'
    });
    if (!gate.ok) {
      setParseStatusMsg(`⚠️ ${gate.message}`);
      alert(gate.message);
      return;
    }
    try {
      if (!textToParse || !String(textToParse).trim()) {
        setParseStatusMsg('⚠️ Paste screenplay text before syncing to matrix.');
        return;
      }
      setIsAutoParsing(true);
      setParseStatusMsg('⚡ Stage Work Studio Engine parsing screenplay to 26-craft matrix...');
      const parsedShots = await parseRawScriptToShots(textToParse);
      const meta = getLastParseMeta();
      if (parsedShots && Array.isArray(parsedShots) && parsedShots.length > 0) {
        saveStoryPackage(
          buildStoryPackage({
            projectTitle,
            shots: parsedShots,
            fullElements: { shots: parsedShots },
            parseMeta: meta,
            sourceText: textToParse
          })
        );
        const liveCount = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived).length;
        if (liveCount > 0 && !isSampleDemoShots(shots)) {
          setMergeApplyState({
            parsedShots,
            textToParse,
            existingCount: liveCount,
            incomingCount: parsedShots.length
          });
          setMergePromptOpen(true);
          setParseStatusMsg(
            `✓ Parsed ${parsedShots.length} shots — choose overwrite or merge (${liveCount} live rows)`
          );
          return;
        }
        proposeParsedShotsToReview(parsedShots, textToParse, 'overwrite');
      } else {
        setParseStatusMsg(meta?.warning || '⚠️ No shots produced — existing matrix left unchanged');
      }
    } catch (err) {
      console.warn('Screenplay live parse error:', err);
      setParseStatusMsg(`⚠️ Sync failed: ${err?.message || 'error'} — existing matrix left unchanged`);
    } finally {
      setIsAutoParsing(false);
    }
  };

  const insertFormattedElement = (type) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : caretPos;
    const result = applyElementToCurrentLine(scriptText, start, type);
    // If line was empty-ish, use formatLineAsElement blank templates via apply
    applyScriptText(result.text, { caret: result.caret });
  };

  const insertNote = () => {
    const el = textareaRef.current;
    if (!el) {
      applyScriptText(`${scriptText}\n[[NOTE: ]]`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const note = '[[NOTE: ]]';
    const next = scriptText.slice(0, start) + note + scriptText.slice(end);
    applyScriptText(next, { caret: start + '[[NOTE: '.length });
  };

  const jumpToAdjacentScene = (dir) => {
    const scenes = sceneOutline.filter((s) => s.type === 'scene' || s.type === 'act');
    if (!scenes.length) return;
    const lineIdx = getLineIndexAtOffset(scriptText, caretPos);
    let current = 0;
    for (let i = 0; i < scenes.length; i += 1) {
      if (scenes[i].lineIndex <= lineIdx) current = i;
    }
    const next = Math.max(0, Math.min(scenes.length - 1, current + dir));
    jumpToOffset(scenes[next].offset);
  };

  const handleKeyDown = (e) => {
    const mod = isModKey(e);

    // Esc — close overlays, then exit fullscreen
    if (e.key === 'Escape') {
      if (helpOpen) {
        e.preventDefault();
        setHelpOpen(false);
        return;
      }
      if (diffOpen) {
        e.preventDefault();
        setDiffOpen(false);
        return;
      }
      if (document.fullscreenElement) {
        e.preventDefault();
        exitWriterFullscreen();
        return;
      }
      if (rightDrawer) {
        e.preventDefault();
        setRightDrawer(null);
        return;
      }
    }

    // Help: Cmd+/ 
    if (mod && e.key === '/') {
      e.preventDefault();
      setHelpOpen(true);
      return;
    }

    if (mod && e.shiftKey && (e.key === '\\' || e.key === '|')) {
      e.preventDefault();
      applyViewMode(cycleWriterViewMode(viewMode));
      return;
    }

    if (mod && !e.shiftKey && (e.key === '\\' || e.code === 'Backslash')) {
      e.preventDefault();
      applyViewMode(viewMode === 'focus' ? 'classic' : 'focus');
      return;
    }

    if (mod && ELEMENT_DIGIT_MAP[e.key]) {
      e.preventDefault();
      insertFormattedElement(ELEMENT_DIGIT_MAP[e.key]);
      return;
    }

    if (mod && e.key === '9') {
      e.preventDefault();
      insertNote();
      return;
    }

    if (mod && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      setRightDrawer('find');
      return;
    }

    if (mod && e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      refreshScriptArchive();
      setVersionsSubTab('archive');
      setRightDrawer('versions');
      return;
    }

    if (mod && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      handleSaveDraft();
      return;
    }

    if (mod && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      handleExportPDF();
      return;
    }

    if (mod && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      handleParseScriptToMatrix();
      return;
    }

    if (mod && !e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      cycleWriterFullscreen();
      return;
    }

    if (mod && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      toggleVoiceToType();
      return;
    }

    if (mod && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      setIntelSubTab('radar');
      setRightDrawer('intel');
      return;
    }

    if (mod && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      setCollabEnabled((v) => !v);
      return;
    }

    if (mod && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      setColorCodeEnabled((v) => !v);
      return;
    }

    if (mod && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      handleAICowriteNextScene();
      return;
    }

    if (mod && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      jumpToAdjacentScene(-1);
      return;
    }

    if (mod && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      jumpToAdjacentScene(1);
      return;
    }

    if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      jumpToAdjacentScene(e.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    // Telugu keyboard IME: type roman (nenu…) → convert to తెలుగు on Space / Enter / punct
    const teTypingOn =
      voiceLangMode === 'te-IN' ||
      (voiceLangMode === 'auto' && resolvedVoiceLang === 'te-IN');
    const teCommitKey =
      e.key === ' ' ||
      e.key === 'Enter' ||
      e.key === 'Tab' ||
      e.key === '.' ||
      e.key === ',' ||
      e.key === '!' ||
      e.key === '?' ||
      e.key === ';' ||
      e.key === ':' ||
      e.key === ')' ||
      e.key === ']';
    if (teTypingOn && teCommitKey && !mod && !e.altKey) {
      const caret = e.target?.selectionStart ?? caretPos;
      const committed = commitRomanWordBeforeCaret(scriptText, caret);
      if (committed) {
        if (e.key === ' ') {
          e.preventDefault();
          applyScriptText(
            `${committed.text.slice(0, committed.caret)} ${committed.text.slice(committed.caret)}`,
            { caret: committed.caret + 1 }
          );
          setVoiceStatus(`తె ${committed.from} → ${committed.to}`);
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const after = handleSmartEnter(committed.text, committed.caret);
          applyScriptText(after.text, { caret: after.caret });
          setVoiceStatus(`తె ${committed.from} → ${committed.to}`);
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          const result = applyElementToCurrentLine(committed.text, committed.caret);
          applyScriptText(result.text, { caret: result.caret });
          setVoiceStatus(`తె ${committed.from} → ${committed.to}`);
          return;
        }
        // punctuation
        e.preventDefault();
        applyScriptText(
          `${committed.text.slice(0, committed.caret)}${e.key}${committed.text.slice(committed.caret)}`,
          { caret: committed.caret + e.key.length }
        );
        setVoiceStatus(`తె ${committed.from} → ${committed.to}`);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const result = applyElementToCurrentLine(scriptText, start);
      applyScriptText(result.text, { caret: result.caret });
      return;
    }

    if (e.key === 'Enter' && e.shiftKey) {
      // Soft return — allow default newline
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const start = e.target.selectionStart;
      const result = handleSmartEnter(scriptText, start);
      e.preventDefault();
      applyScriptText(result.text, { caret: result.caret });
    }
  };

  // Global help / esc / fullscreen when focus isn't in textarea
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (diffOpen) {
          setDiffOpen(false);
          return;
        }
        if (document.fullscreenElement) {
          e.preventDefault();
          exitWriterFullscreen();
          return;
        }
        return;
      }
      if (isModKey(e) && e.key === '/') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (isModKey(e) && e.key === 'Enter') {
        if (e.target?.closest?.('textarea, input, [contenteditable="true"]')) return;
        e.preventDefault();
        if (e.shiftKey) handleParseScriptToMatrix();
        else cycleWriterFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, diffOpen, cycleWriterFullscreen, exitWriterFullscreen]);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImportMsg('Importing…');
      const { text, format } = await importScreenplayFile(file, {
        extractPdf: extractTextFromPDF
      });
      applyScriptText(text);
      setImportMsg(`Imported ${format.toUpperCase()}`);
      setTimeout(() => setImportMsg(''), 2500);
    } catch (err) {
      console.warn('Import failed:', err);
      setImportMsg(err?.message || 'Import failed');
      setTimeout(() => setImportMsg(''), 3500);
    }
  };

  const handleExportPDF = () => {
    const gate = assertExportAllowed({
      projectTitle,
      label: 'screenplay_pdf',
      format: 'pdf',
      lifecycleMode: writerLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    setExportOpen(false);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF.');
      return;
    }

    const scriptTextToExport = scriptText || DEFAULT_SAMPLE_SCREENPLAY;
    const formattedHtml = scriptTextToExport
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '<div class="space"></div>';
        if (
          trimmed.startsWith('EXT.') ||
          trimmed.startsWith('INT.') ||
          trimmed.startsWith('SC.') ||
          trimmed.startsWith('ACT ')
        ) {
          return `<div class="scene-heading">${line}</div>`;
        }
        if (trimmed.startsWith('[SHOT') || trimmed.startsWith('Camera:') || trimmed.startsWith('Lighting:')) {
          return `<div class="shot-tag">${line}</div>`;
        }
        if (trimmed === trimmed.toUpperCase() && trimmed.length < 35 && !trimmed.includes(':')) {
          return `<div class="character">${line}</div>`;
        }
        return `<div class="action">${line}</div>`;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${projectTitle || 'Master_Screenplay_Draft'} - Screenplay PDF</title>
          <style>
            @page { size: letter; margin: 1in; }
            body {
              font-family: "Courier New", Courier, monospace;
              font-size: 12pt; line-height: 1.4; color: #000; background: #fff;
              margin: 0; padding: 24px;
            }
            .header {
              text-align: center; font-weight: bold; text-transform: uppercase;
              letter-spacing: 1px; margin-bottom: 24px; border-bottom: 2px solid #000;
              padding-bottom: 10px; font-size: 11pt;
            }
            .scene-heading { font-weight: bold; text-transform: uppercase; margin-top: 20px; margin-bottom: 10px; }
            .shot-tag { font-weight: bold; color: #1e3a8a; margin-top: 6px; margin-bottom: 6px; }
            .character { text-align: center; margin-top: 16px; margin-bottom: 4px; font-weight: bold; text-transform: uppercase; }
            .action { margin-bottom: 10px; }
            .space { height: 10px; }
            @media print { body { padding: 0; } }
            .doc-meta { font-size: 10pt; color: #555; margin: 0 0 12px; }
  </style>
        </head>
        <body>
  <p class="doc-meta">${roomId ? `Collab room: ${roomId}` : 'Collab room: —'} · ${new Date().toISOString()}</p>
          <div class="header">${projectTitle || 'STAGE PRODUCTION STUDIO'} • MASTER SCREENPLAY DRAFT</div>
          ${formattedHtml}
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
    const slug = String(projectTitle || 'screenplay').replace(/[^\w\-]+/g, '_').slice(0, 40);
    logExportSuccess({
      projectTitle,
      label: 'screenplay_pdf',
      format: 'pdf',
      filename: `${slug}_screenplay.pdf`,
      roomId,
      note: writerLifeNote,
      lifecycleMode: gate.advisory ? `${writerLifecycleMode}+ok` : writerLifecycleMode
    });
  };

  const handleExportFountain = () => {
    const gate = assertExportAllowed({
      projectTitle,
      label: 'screenplay_fountain',
      format: 'fountain',
      lifecycleMode: writerLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    setExportOpen(false);
    const body = exportFountain(scriptText, { title: projectTitle, roomId });
    const filename = `${(projectTitle || 'screenplay').replace(/\s+/g, '_')}.fountain`;
    downloadTextFile(filename, body);
    logExportSuccess({
      projectTitle,
      label: 'screenplay_fountain',
      format: 'fountain',
      filename,
      roomId,
      note: writerLifeNote,
      lifecycleMode: gate.advisory ? `${writerLifecycleMode}+ok` : writerLifecycleMode
    });
  };

  const handleExportTxt = () => {
    const gate = assertExportAllowed({
      projectTitle,
      label: 'screenplay_txt',
      format: 'txt',
      lifecycleMode: writerLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    setExportOpen(false);
    const filename = `${(projectTitle || 'screenplay').replace(/\s+/g, '_')}.txt`;
    downloadTextFile(filename, exportPlainTxt(scriptText));
    logExportSuccess({
      projectTitle,
      label: 'screenplay_txt',
      format: 'txt',
      filename,
      roomId,
      note: writerLifeNote,
      lifecycleMode: gate.advisory ? `${writerLifecycleMode}+ok` : writerLifecycleMode
    });
  };

  const handleExportFdx = () => {
    const gate = assertExportAllowed({
      projectTitle,
      label: 'screenplay_fdx',
      format: 'fdx',
      lifecycleMode: writerLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    setExportOpen(false);
    const filename = `${(projectTitle || 'screenplay').replace(/\s+/g, '_')}.fdx`;
    downloadTextFile(filename, exportFdx(scriptText, { title: projectTitle }), 'application/xml');
    logExportSuccess({
      projectTitle,
      label: 'screenplay_fdx',
      format: 'fdx',
      filename,
      roomId,
      note: writerLifeNote,
      lifecycleMode: gate.advisory ? `${writerLifecycleMode}+ok` : writerLifecycleMode
    });
  };

  const handleExportMergeZip = async () => {
    const collabRoom = resolveCollabRoomId(roomId);
    const liveShotCount = (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived).length;
    const lifeNote = `${liveShotCount} live shots · writer merge pack`;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'screenplay_merge_zip',
        format: 'zip',
        lifecycleMode: writerLifecycleMode,
        shots,
        roomId: collabRoom,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'screenplay_merge_zip',
      format: 'zip',
      lifecycleMode: writerLifecycleMode,
      shots,
      roomId: collabRoom
    });
    if (!gate.ok) return;
    setExportOpen(false);
    const slug = String(projectTitle || 'screenplay').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const files = buildWriterMergeZipFiles(scriptText, {
      projectTitle,
      roomId: collabRoom,
      liveShotCount,
      mergeMode: 'merge_pack'
    });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_writer_merge.zip`, {
      projectTitle,
      shots,
      lifecycleMode: writerLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'screenplay_merge_zip',
      auditFormat: 'zip',
      roomId: collabRoom,
      note: lifeNote,
      showAlert: false
    });
  };

  const handleCopyScript = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(scriptText);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    }
  };

  const handleCopySynopsis = async (text, which) => {
    const body = String(text || '').trim();
    if (!body || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopiedSynopsis(which);
      setTimeout(() => setCopiedSynopsis(''), 1800);
    } catch {
      /* ignore */
    }
  };

  const handleLoadAll9Scenes = () => {
    applyScriptText(DEFAULT_SAMPLE_SCREENPLAY);
    handleParseScriptToMatrix(DEFAULT_SAMPLE_SCREENPLAY);
  };

  const handleAICowriteNextScene = async () => {
    setIsAICowriting(true);
    try {
      const apiKey = resolveLlmApiKey(provider) || (typeof window !== 'undefined' ? localStorage.getItem('sps_api_key') || '' : '');
      const provider =
        typeof window !== 'undefined' ? localStorage.getItem('sps_llm_provider') || 'google_gemini' : 'google_gemini';

      const promptText = `You are a Hollywood Master Screenwriter (Stage Work Studio Cinema Intelligence Engine).
Continue the following screenplay by writing the next dramatic 1-2 shots/scenes in standard Fountain screenplay format. Include [SHOT SXX-X] camera tags, dialogue, and vivid stage directions.

Current Screenplay:
${scriptText.slice(-2000)}

Write ONLY the continuation in clean screenplay format:`;

      let generatedContinuation = '';

      if (apiKey.trim() && provider === 'google_gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
          }
        );
        if (res.ok) {
          const data = await res.json();
          generatedContinuation = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }

      if (!generatedContinuation) {
        generatedContinuation = `\n\n[SHOT S04-A]: Low Angle Hero Track\nCamera: Slow Dolly Push In\nLighting: Golden Temple Solar Sunbeams\n\nRAMA raises his bow high. The arrows ignite with sacred blue plasma flare.\n\nRAMA\n(voice echoing over the valley)\nFor righteousness, the forest shall stand!`;
      }

      const updatedText = `${(scriptText || '').trim()}\n\n${(generatedContinuation || '').trim()}`;
      applyScriptText(updatedText);
      handleParseScriptToMatrix(updatedText);
    } catch (e) {
      console.warn('AI Cowriter error:', e);
    } finally {
      setIsAICowriting(false);
    }
  };

  const handleFindNext = () => {
    if (!findMatches.length) return;
    const nextIdx = (findIndex + 1) % findMatches.length;
    setFindIndex(nextIdx);
    const m = findMatches[nextIdx];
    const el = textareaRef.current;
    if (el && m) {
      el.focus();
      el.setSelectionRange(m.start, m.end);
      setCaretPos(m.start);
      const lineIdx = getLineIndexAtOffset(scriptText, m.start);
      el.scrollTop = Math.max(0, lineIdx * 22 - el.clientHeight / 3);
    }
  };

  const handleReplaceOne = () => {
    if (!findMatches.length) return;
    const idx = Math.min(findIndex, findMatches.length - 1);
    const m = findMatches[idx];
    const next = replaceMatch(scriptText, m.start, m.end, replaceQuery);
    applyScriptText(next, { caret: m.start + replaceQuery.length });
    setFindIndex(0);
  };

  const handleReplaceAll = () => {
    const { text, count } = replaceAllMatches(scriptText, findQuery, replaceQuery);
    if (count > 0) applyScriptText(text);
    setFindIndex(0);
  };

  const handleSaveDraft = () => {
    const list = saveScreenplayVersion({
      text: scriptText,
      projectTitle,
      name: `Draft ${new Date().toLocaleString()}`
    });
    setVersions(list);
    setVersionsSubTab('drafts');
    setRightDrawer('versions');
  };

  const refreshScriptArchive = () => {
    setScriptArchive(loadScreenplayArchive(projectTitle));
  };

  const handleArchiveMilestone = () => {
    if (!String(scriptText || '').trim()) {
      setArchiveMsg('Nothing to archive — script is empty.');
      setTimeout(() => setArchiveMsg(''), 2500);
      return;
    }
    const list = archiveScreenplayMilestone({
      name: archiveName || `Archive ${new Date().toLocaleString()}`,
      text: scriptText,
      projectTitle,
      note: archiveNote,
      pageEstimate: totalPages,
      wordCount
    });
    setScriptArchive(list.filter((a) => {
      const t = String(a?.projectTitle || '').trim().toUpperCase();
      const key = String(projectTitle || '').trim().toUpperCase();
      return !t || !key || t === key;
    }));
    setArchiveNote('');
    setArchiveMsg(`Archived “${archiveName || 'milestone'}”`);
    setVersionsSubTab('archive');
    setRightDrawer('versions');
    setTimeout(() => setArchiveMsg(''), 2500);
  };

  const handlePromoteVersion = (v) => {
    if (!v?.text) return;
    const name = window.prompt('Archive milestone name:', v.name || 'Promoted Draft');
    if (name === null) return;
    promoteVersionToArchive(v, { name: name.trim() || v.name, projectTitle, note: `From Versions` });
    refreshScriptArchive();
    setVersionsSubTab('archive');
    setArchiveMsg('Draft promoted to Script Archive');
    setTimeout(() => setArchiveMsg(''), 2500);
  };

  const handleRestoreArchive = (entry) => {
    if (!entry?.text) return;
    if (!confirm(`Restore archived script “${entry.name}”?\nCurrent editor text will be replaced (Save Draft first if needed).`)) {
      return;
    }
    // Auto-save current as quick draft before restore
    if (String(scriptText || '').trim()) {
      setVersions(
        saveScreenplayVersion({
          text: scriptText,
          projectTitle,
          name: `Pre-restore ${new Date().toLocaleString()}`
        })
      );
    }
    applyScriptText(entry.text);
    setArchiveMsg(`Restored “${entry.name}”`);
    setTimeout(() => setArchiveMsg(''), 2500);
  };

  const handleRenameArchive = (entry) => {
    const name = window.prompt('Rename archive milestone:', entry.name || '');
    if (name === null || !String(name).trim()) return;
    renameScreenplayArchiveEntry(entry.id, name.trim());
    refreshScriptArchive();
  };

  const handlePurgeArchive = (id, name) => {
    if (!confirm(`Permanently delete archived “${name}”? This cannot be undone.`)) return;
    purgeScreenplayArchiveEntry(id);
    refreshScriptArchive();
  };

  const handleRestoreVersion = (v) => {
    if (!v?.text) return;
    applyScriptText(v.text);
  };

  const handleDeleteVersion = (id) => {
    setVersions(deleteScreenplayVersion(id));
  };

  useEffect(() => {
    refreshScriptArchive();
  }, [projectTitle]);

  const toggleDrawer = (id) => {
    setRightDrawer((prev) => (prev === id ? null : id));
  };

  const applyPrediction = () => {
    const sug = intel?.suggestion;
    if (!sug?.insert) return;
    const start = textareaRef.current?.selectionStart ?? caretPos;
    const next = scriptText.slice(0, start) + sug.insert + scriptText.slice(start);
    applyScriptText(next, { caret: start + sug.insert.length });
  };

  const classifiedLines = useMemo(
    () => (colorCodeEnabled ? classifyScreenplayLines(scriptText) : []),
    [scriptText, colorCodeEnabled]
  );

  const openVersionCompare = (entry, label) => {
    if (!entry?.text) return;
    setDiffLeft({
      text: entry.text,
      label: label || entry.name || 'Version'
    });
    setDiffOpen(true);
  };

  const syncHighlightScroll = () => {
    const el = textareaRef.current;
    const hi = highlightRef.current;
    if (el && hi) {
      hi.scrollTop = el.scrollTop;
      hi.scrollLeft = el.scrollLeft;
    }
  };

  return (
    <div
      ref={writerRootRef}
      className={`sps-writer-console sps-atelier-room flex flex-col h-full overflow-hidden ${
        fullscreenLevel === 1 ? 'sps-fs-console' : ''
      }`}
      style={{ background: 'var(--sps-bg)', color: 'var(--sps-text)', fontFamily: 'var(--sps-font)' }}
    >
      {/* TOP SUB-NAV — hover to reveal, pin to keep */}
      <div
        className={`sps-hover-chrome sps-writer-top-chrome shrink-0 ${writerChromePinned ? 'is-pinned' : 'is-collapsed'}${!writerChromePinned && writerChromeHoverOpen ? ' is-hover-open' : ''}`}
        onMouseEnter={() => {
          if (writerChromeLeaveRef.current) clearTimeout(writerChromeLeaveRef.current);
          if (!writerChromePinned) setWriterChromeHoverOpen(true);
        }}
        onMouseLeave={() => {
          if (writerChromeLeaveRef.current) clearTimeout(writerChromeLeaveRef.current);
          writerChromeLeaveRef.current = setTimeout(() => setWriterChromeHoverOpen(false), 160);
        }}
      >
      <button
        type="button"
        className="sps-chrome-reveal"
        aria-label="Show writer toolbar"
        tabIndex={-1}
        onClick={() => {
          setWriterChromeHoverOpen(true);
          setWriterChromePinned(true);
        }}
      />
      <div className="sps-hover-chrome-bar py-1 px-2 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex flex-wrap items-center gap-1 min-w-0 max-w-full">
        <div className="flex items-center gap-1 min-w-0">
          <div className="sps-tabs sps-tabs-writer" role="tablist" aria-label="Writer console">
            <button
              type="button"
              role="tab"
              aria-selected={activeConsoleTab === 'screenplay'}
              onClick={() => setActiveConsoleTab('screenplay')}
            >
              <Scroll className="w-3.5 h-3.5 shrink-0" />
              Screenplay
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeConsoleTab === 'synopsis'}
              onClick={() => setActiveConsoleTab('synopsis')}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              Synopsis
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeConsoleTab === 'breakdown'}
              onClick={() => setActiveConsoleTab('breakdown')}
              title="AI Script Breakdown (same flow as Project Console)"
            >
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              Breakdown
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={() => onOpenCharacters?.()}
              title="Character bible"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              Characters
            </button>
          </div>
        </div>

        {activeConsoleTab === 'screenplay' && (
          <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
            <div
              className="sps-tabs sps-tabs-views"
              role="tablist"
              aria-label="Writer view mode"
              title="Page = Final Draft · Focus = WriterDuet/Highland · Scenes = Navigator · Studio = full SPS"
            >
              {WRITER_VIEW_MODES.map((m) => {
                const Icon =
                  m.id === 'classic'
                    ? LayoutTemplate
                    : m.id === 'focus'
                      ? Focus
                      : m.id === 'outline'
                        ? ListTree
                        : Layers;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={viewMode === m.id}
                    onClick={() => applyViewMode(m.id)}
                    title={`${m.label} — ${m.industry}`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{m.short}</span>
                  </button>
                );
              })}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".fountain,.fdx,.txt,.pdf,.xml"
              className="hidden"
              onChange={handleImportFile}
            />

            <div className={`sps-toolbar-slot ${viewMode === 'focus' ? 'invisible pointer-events-none' : ''}`}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="sps-btn text-[10px]"
                  aria-label="Import screenplay file"
                  title="Import Fountain, FDX, TXT, or PDF"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Import</span>
                </button>

                <div className="relative" ref={exportMenuRef}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (exportBlocked) return;
                        setExportOpen((o) => !o);
                      }}
                      disabled={exportBlocked}
                      className="sps-btn sps-btn-primary text-[10px] disabled:opacity-40"
                      aria-label="Export screenplay"
                      aria-expanded={exportOpen}
                      title={exportBlocked ? exportLife.message : 'Export PDF, Fountain, TXT, or FDX'}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Export</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  {exportBlocked ? (
                    <span className="hidden lg:inline text-[9px] text-[var(--sps-gold)] max-w-[10rem] leading-snug ml-1">
                      {exportLife.message}
                    </span>
                  ) : null}
                  {exportOpen && !exportBlocked && viewMode !== 'focus' && (
                    <div className="sps-dropdown absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1">
                      <button type="button" onClick={handleExportPDF} className="w-full text-left px-3 py-1.5 text-xs cursor-pointer">
                        PDF (Print)
                      </button>
                      <button type="button" onClick={handleExportFountain} className="w-full text-left px-3 py-1.5 text-xs cursor-pointer">
                        Fountain (.fountain)
                      </button>
                      <button type="button" onClick={handleExportTxt} className="w-full text-left px-3 py-1.5 text-xs cursor-pointer">
                        Plain Text (.txt)
                      </button>
                      <button type="button" onClick={handleExportFdx} className="w-full text-left px-3 py-1.5 text-xs cursor-pointer">
                        Final Draft (.fdx)
                      </button>
                      <button type="button" onClick={handleExportMergeZip} className="w-full text-left px-3 py-1.5 text-xs cursor-pointer">
                        Merge pack (.zip)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleDrawer('find')}
                  className={`sps-btn text-[10px] ${rightDrawer === 'find' ? 'sps-btn-primary' : ''}`}
                  aria-label="Find and replace"
                  title="Find / Replace"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Find</span>
                </button>
            </div>

            {/* Studio-native tools — full row in Studio; More menu in Page/Scenes */}
            {viewCfg.showStudioChrome ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setVersionsSubTab('drafts');
                    toggleDrawer('versions');
                  }}
                  className={`sps-btn text-[10px] ${rightDrawer === 'versions' && versionsSubTab === 'drafts' ? 'sps-btn-primary' : ''}`}
                  title="Quick draft versions"
                >
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Versions</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    refreshScriptArchive();
                    setVersionsSubTab('archive');
                    setRightDrawer('versions');
                  }}
                  className={`sps-btn text-[10px] ${rightDrawer === 'versions' && versionsSubTab === 'archive' ? 'sps-btn-primary' : ''}`}
                  title="Script Archive milestones"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Archive</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIntelSubTab('radar');
                    toggleDrawer('intel');
                  }}
                  className={`sps-btn text-[10px] ${rightDrawer === 'intel' ? 'sps-btn-primary' : ''}`}
                  title="Writer Intel"
                >
                  <Radar className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Intel</span>
                  <span className="text-[9px] font-black opacity-90">{intel.readiness?.score ?? 0}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCollabEnabled((v) => !v)}
                  className={`sps-btn text-[10px] ${collabEnabled ? 'sps-btn-primary' : ''}`}
                  title="Co-Write"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Co-Write</span>
                </button>
                <button
                  type="button"
                  onClick={handleAICowriteNextScene}
                  disabled={isAICowriting}
                  className="sps-btn sps-btn-primary text-[10px]"
                  title="AI Co-Writer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAICowriting ? 'animate-spin' : ''}`} />
                  {isAICowriting ? '…' : 'AI'}
                </button>
                <button
                  type="button"
                  onClick={() => handleParseScriptToMatrix()}
                  disabled={isAutoParsing || projectLocked}
                  className="sps-btn sps-btn-primary text-[10px]"
                  title={projectLocked ? 'Project locked — unlock in Production dashboard' : 'Sync to Matrix (⌘⇧Enter)'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAutoParsing ? 'animate-spin' : ''}`} />
                  Sync
                </button>
              </>
            ) : viewMode !== 'focus' ? (
              <div className="relative" ref={studioMoreRef}>
                <button
                  type="button"
                  onClick={() => setStudioMoreOpen((o) => !o)}
                  className="sps-btn text-[10px]"
                  title="Studio tools when you’re ready"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  Studio tools
                </button>
                {studioMoreOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1">
                    <p className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-zinc-500">
                      Grow into SPS when ready
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        applyViewMode('studio');
                        setStudioMoreOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 cursor-pointer text-amber-300 font-bold"
                    >
                      Open full Studio view →
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVersionsSubTab('drafts');
                        setRightDrawer('versions');
                        setStudioMoreOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 cursor-pointer"
                    >
                      Versions
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        refreshScriptArchive();
                        setVersionsSubTab('archive');
                        setRightDrawer('versions');
                        setStudioMoreOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 cursor-pointer"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntelSubTab('radar');
                        setRightDrawer('intel');
                        setStudioMoreOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 cursor-pointer"
                    >
                      Writer Intel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCollabEnabled(true);
                        setStudioMoreOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 cursor-pointer"
                    >
                      Enable Co-Write
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleParseScriptToMatrix();
                        setStudioMoreOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 cursor-pointer"
                    >
                      Sync to Matrix
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="sps-btn text-[10px]"
              title="Writer Help (⌘/)"
            >
              <CircleHelp className="w-3.5 h-3.5" />
              Help
            </button>

            {viewMode !== 'focus' && (
              <>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="sps-icon-btn"
                  title="Copy screenplay text"
                >
                  {copiedToast ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setRightDrawer((d) => (d ? null : 'find'))}
                  className={`sps-icon-btn ${rightDrawer ? 'is-on' : ''}`}
                  title={rightDrawer ? 'Close panel' : 'Open panel'}
                >
                  {rightDrawer ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
        )}

        {activeConsoleTab === 'synopsis' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAIExtractSynopsis}
              disabled={isGeneratingSynopsis}
              className="sps-btn sps-btn-primary text-[10px]"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingSynopsis ? 'animate-spin' : ''}`} />
              {isGeneratingSynopsis ? 'Extracting…' : 'Re-Extract Synopsis'}
            </button>
          </div>
        )}
        <span className="ml-auto shrink-0">
          <PinBarButton
            pinned={writerChromePinned}
            onToggle={() => {
              setWriterChromePinned((v) => {
                const next = !v;
                if (!next) setWriterChromeHoverOpen(false);
                return next;
              });
            }}
            label="writer bar"
          />
        </span>
      </div>
      </div>

      {/* SCREENPLAY TAB */}
      {activeConsoleTab === 'screenplay' && (
        <div className="relative flex-1 flex overflow-hidden min-h-0">
          {!viewTipDismissed && (
            <div className="absolute z-40 left-1/2 -translate-x-1/2 top-16 max-w-lg w-[min(92%,28rem)] px-3">
              <div className="rounded-xl border border-amber-500/40 bg-zinc-950/95 shadow-2xl p-3 text-[11px] text-zinc-300 leading-relaxed">
                <p className="font-black text-amber-300 uppercase tracking-wide mb-1">Coming from Final Draft?</p>
                <p>
                  Full Studio can feel busy. You’re in <strong className="text-zinc-100">{viewCfg.label}</strong> (
                  {viewCfg.industry}). Stay here to write like you’re used to — switch to{' '}
                  <button type="button" className="text-cyan-300 font-bold underline cursor-pointer" onClick={() => applyViewMode('studio')}>
                    Studio
                  </button>{' '}
                  when you want Intel, Co-Write, Colors, and Matrix Sync.
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={dismissViewTip}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold cursor-pointer"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scene Navigator */}
          {viewCfg.showSceneNav && (
          <aside
            className={`${
              viewCfg.sceneNavWide ? 'w-72' : 'w-52'
            } shrink-0 border-r border-zinc-800 bg-zinc-950/80 overflow-y-auto hidden sm:flex flex-col`}
          >
            <div className="px-2.5 py-2 border-b border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center justify-between gap-1">
              <span>Scenes · {sceneOutline.length}</span>
              {collabEnabled && <Users className="w-3 h-3 text-emerald-400" />}
            </div>
            {collabEnabled && (
              <div className="px-2 py-2 border-b border-zinc-800 space-y-1.5 bg-emerald-950/20">
                <div className="flex items-center gap-1 flex-wrap">
                  {onlineWriters.map((p) => (
                    <span
                      key={p.userEmail}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-zinc-950"
                      style={{ background: p.color || '#22d3ee' }}
                      title={p.userEmail}
                    >
                      {(p.userName || p.userEmail || '?').slice(0, 10)}
                    </span>
                  ))}
                  {onlineWriters.length === 0 && (
                    <span className="text-[9px] text-zinc-500">Waiting for peers…</span>
                  )}
                </div>
                <p className="text-[9px] text-emerald-400/90 leading-snug">{collabStatus || 'Co-write on'}</p>
                {claimedSceneKey ? (
                  <button
                    type="button"
                    onClick={handleReleaseScene}
                    className="w-full px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Unlock className="w-3 h-3" />
                    Release my scene
                  </button>
                ) : (
                  <p className="text-[9px] text-zinc-500">Claim a scene to lock it for editing.</p>
                )}
              </div>
            )}
            <nav className="flex-1 overflow-y-auto py-1" aria-label="Scene navigator">
              {sceneOutline.length === 0 && (
                <p className="px-2.5 py-2 text-[11px] text-zinc-500">No scene headings yet</p>
              )}
              {sceneOutline.map((sc, idx) => {
                const key = sceneSegments[idx]?.key || `sc_${idx}`;
                const lock = collabEnabled ? getSceneLock(collabDoc, key) : null;
                const mine =
                  lock &&
                  String(lock.userEmail || '').toLowerCase() ===
                    String(writerMeta.userEmail || '').toLowerCase();
                const others = lock && !mine;
                return (
                  <div
                    key={`${sc.offset}-${sc.lineIndex}`}
                    className={`border-l-2 ${
                      sc.type === 'act'
                        ? 'border-amber-500'
                        : claimedSceneKey === key
                          ? 'border-emerald-400'
                          : others
                            ? 'border-rose-500'
                            : 'border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => jumpToOffset(sc.offset)}
                      className="w-full text-left px-2.5 py-1.5 text-[11px] leading-snug hover:bg-zinc-900 cursor-pointer truncate text-zinc-400 hover:text-zinc-100"
                      title={sc.title}
                    >
                      {sc.title}
                    </button>
                    {collabEnabled && sc.type !== 'act' && (
                      <div className="px-2 pb-1.5 flex items-center gap-1">
                        {others ? (
                          <span
                            className="text-[9px] font-bold truncate flex items-center gap-1"
                            style={{ color: lock.color || '#f43f5e' }}
                          >
                            <Lock className="w-2.5 h-2.5" />
                            {lock.userName || 'Writer'}
                          </span>
                        ) : mine || claimedSceneKey === key ? (
                          <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            You
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleClaimScene(key)}
                            className="text-[9px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                          >
                            Claim
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div className="p-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleLoadAll9Scenes}
                className="w-full px-2 py-1.5 rounded bg-amber-500/90 hover:bg-amber-400 text-zinc-950 text-[10px] font-black cursor-pointer"
                title="Load sample master screenplay"
              >
                Load Sample (9 Scenes)
              </button>
            </div>
          </aside>
          )}

          {/* Main editor column */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Element toolbar */}
            {viewCfg.showElementBar && (
            <div
              className={`sps-hover-chrome sps-writer-format-chrome shrink-0 ${elementBarPinned ? 'is-pinned' : 'is-collapsed'}${!elementBarPinned && elementBarHoverOpen ? ' is-hover-open' : ''}`}
              onMouseEnter={() => {
                if (elementBarLeaveRef.current) clearTimeout(elementBarLeaveRef.current);
                if (!elementBarPinned) setElementBarHoverOpen(true);
              }}
              onMouseLeave={() => {
                if (elementBarLeaveRef.current) clearTimeout(elementBarLeaveRef.current);
                elementBarLeaveRef.current = setTimeout(() => setElementBarHoverOpen(false), 160);
              }}
            >
            <button
              type="button"
              className="sps-chrome-reveal"
              aria-label="Show format bar"
              tabIndex={-1}
              onClick={() => {
                setElementBarHoverOpen(true);
                setElementBarPinned(true);
              }}
            />
            <div className="sps-hover-chrome-bar px-3 py-1.5 bg-[var(--sps-bg-elevated)] border-b border-[var(--sps-border)] flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { type: 'scene_heading', label: 'Scene', title: 'Insert / format Scene Heading' },
                  { type: 'character', label: 'Character', title: 'Insert Character' },
                  { type: 'dialogue', label: 'Dialogue', title: 'Format as Dialogue' },
                  { type: 'transition', label: 'Transition', title: 'Insert Transition' },
                  { type: 'shot', label: 'Shot', title: 'Insert Shot Tag' }
                ].map((btn) => (
                  <button
                    key={btn.type}
                    type="button"
                    onClick={() => insertFormattedElement(btn.type)}
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-bold border border-zinc-800 cursor-pointer"
                    title={btn.title}
                    aria-label={btn.title}
                  >
                    {btn.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={insertNote}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 text-[10px] font-bold border border-zinc-800 flex items-center gap-1 cursor-pointer"
                  title="Insert [[NOTE: ]]"
                  aria-label="Insert comment note"
                >
                  <StickyNote className="w-3 h-3" />
                  Note
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {viewCfg.showColorsToggle && (
                <button
                  type="button"
                  onClick={() => setColorCodeEnabled((v) => !v)}
                  className={`px-2 py-1 rounded text-[10px] font-black border flex items-center gap-1 cursor-pointer ${
                    colorCodeEnabled
                      ? 'bg-zinc-900 border-cyan-600/50 text-cyan-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                  title="Color-code script sections for scanning"
                >
                  <Palette className="w-3 h-3" />
                  {colorCodeEnabled ? 'Colors On' : 'Colors Off'}
                </button>
                )}
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700/50 text-cyan-300 font-bold"
                  title="Current element at caret"
                >
                  {ELEMENT_LABELS[currentElement] || currentElement}
                </span>
                <span
                  className="text-[10px] text-zinc-500 hidden md:inline"
                  title="Tab = cycle element · Enter = smart next"
                >
                  Tab = cycle · Enter = smart next
                </span>
                <PinBarButton
                  pinned={elementBarPinned}
                  onToggle={() => {
                    setElementBarPinned((v) => {
                      const next = !v;
                      if (!next) setElementBarHoverOpen(false);
                      return next;
                    });
                  }}
                  label="format bar"
                />
              </div>
            </div>
            </div>
            )}

            {/* Predictive assist — studio / optional */}
            {viewCfg.showAssist && intel.suggestion && (
              <div className="px-3 py-1.5 bg-[var(--sps-bg-elevated)] border-b border-[var(--sps-border)] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-fuchsia-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-amber-800 dark:text-fuchsia-300 uppercase tracking-wide truncate">
                      Predictive Assist · {intel.suggestion.label}
                    </p>
                    <p className="text-[10px] text-[var(--sps-muted)] truncate">{intel.suggestion.hint}</p>
                  </div>
                </div>
                {intel.suggestion.insert ? (
                  <button
                    type="button"
                    onClick={applyPrediction}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 dark:bg-fuchsia-600/90 dark:hover:bg-fuchsia-500 text-white text-[10px] font-black cursor-pointer"
                  >
                    Apply
                  </button>
                ) : null}
              </div>
            )}

            {collabEnabled && editingLockedByOther && (
              <div className="px-3 py-1.5 bg-rose-950/50 border-b border-rose-700/40 flex items-center gap-2 shrink-0 text-[11px] text-rose-200">
                <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>
                  This scene is locked by{' '}
                  <strong style={{ color: activeSceneLock?.color || '#fb7185' }}>
                    {activeSceneLock?.userName || activeSceneLock?.userEmail || 'another writer'}
                  </strong>
                  . Jump to an unlocked scene or wait for release — your edits here won’t overwrite theirs.
                </span>
              </div>
            )}

            {collabEnabled && claimedSceneKey && !editingLockedByOther && (
              <div className="px-3 py-1.5 bg-emerald-950/40 border-b border-emerald-700/40 flex items-center justify-between gap-2 shrink-0 text-[11px] text-emerald-200">
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  You own this scene lock — peers see your live updates.
                </span>
                <button
                  type="button"
                  onClick={handleReleaseScene}
                  className="shrink-0 text-[10px] font-black text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  Release
                </button>
              </div>
            )}

            {/* Paper canvas */}
            <div
              className={`flex-1 overflow-hidden p-3 sm:p-5 flex justify-center min-h-0 ${
                paperCream ? 'bg-zinc-800/80' : 'bg-zinc-950'
              }`}
            >
              <div
                ref={draftPaperRef}
                className={`sps-draft-paper w-full max-w-3xl rounded-lg shadow-2xl flex flex-col overflow-hidden border ${
                  fullscreenLevel === 2 ? 'sps-fs-draft' : ''
                } ${
                  paperCream
                    ? 'bg-[#f7f4ef] text-zinc-900 border-zinc-400/40'
                    : 'bg-[#1a1a1a] text-zinc-100 border-zinc-800'
                }`}
              >
                <div
                  className={`flex items-center justify-between px-4 py-2 text-[11px] shrink-0 border-b ${
                    paperCream ? 'border-zinc-300/80 text-zinc-600' : 'border-zinc-800 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${paperCream ? 'text-amber-700' : 'text-cyan-400'}`} />
                    <span className={`font-bold uppercase truncate ${paperCream ? 'text-amber-800' : 'text-cyan-400'}`}>
                      {projectTitle}
                    </span>
                    <span className={paperCream ? 'text-zinc-400' : 'text-zinc-600'}>·</span>
                    <span className={`shrink-0 ${paperCream ? 'text-zinc-700' : 'text-amber-300'}`}>
                      {viewMode === 'focus' ? 'FOCUS' : 'MASTER DRAFT'}
                    </span>
                    <span className={`hidden sm:inline text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      paperCream ? 'bg-white/70 text-zinc-500' : 'bg-zinc-900 text-zinc-500'
                    }`}>
                      {viewCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 max-w-[65%]">
                    <span
                      className={`px-2 py-0.5 rounded border truncate text-[10px] ${
                        paperCream
                          ? 'bg-white/80 border-zinc-300 text-zinc-600'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {voiceListening
                        ? voiceStatus || 'Listening…'
                        : voiceStatus && voiceStatus.startsWith('తె ')
                          ? voiceStatus
                          : voiceLangMode === 'te-IN' ||
                              (voiceLangMode === 'auto' && resolvedVoiceLang === 'te-IN')
                            ? 'తెలుగు typing · Space converts roman → తె'
                            : importMsg || parseStatusMsg}
                    </span>
                    <div
                      className={`shrink-0 flex items-center p-0.5 rounded-lg border ${
                        paperCream ? 'bg-white/80 border-zinc-300' : 'bg-zinc-900 border-zinc-700'
                      }`}
                      role="group"
                      aria-label="Voice language"
                    >
                      <button
                        type="button"
                        onClick={() => (voiceListening ? startVoiceInLang('te-IN') : persistVoiceLangMode('te-IN'))}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer ${
                          voiceLangMode === 'te-IN' || (voiceLangMode === 'auto' && resolvedVoiceLang === 'te-IN')
                            ? 'bg-amber-400 text-zinc-950'
                            : paperCream
                              ? 'text-zinc-600'
                              : 'text-zinc-400'
                        }`}
                        title="Telugu: roman + Space → తెలుగు"
                      >
                        తె
                      </button>
                      <button
                        type="button"
                        onClick={() => (voiceListening ? startVoiceInLang('en-IN') : persistVoiceLangMode('en-IN'))}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer ${
                          voiceLangMode === 'en-IN' || (voiceLangMode === 'auto' && resolvedVoiceLang === 'en-IN')
                            ? 'bg-emerald-600 text-white'
                            : paperCream
                              ? 'text-zinc-600'
                              : 'text-zinc-400'
                        }`}
                        title="English type & dictate"
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => (voiceListening ? startVoiceInLang('auto') : persistVoiceLangMode('auto'))}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer ${
                          voiceLangMode === 'auto'
                            ? 'bg-cyan-600 text-white'
                            : paperCream
                              ? 'text-zinc-600'
                              : 'text-zinc-400'
                        }`}
                        title="Auto language from script"
                      >
                        A
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => (voiceListening ? toggleVoiceToType() : startVoiceInLang(voiceLangMode))}
                      className={`shrink-0 p-1 rounded border cursor-pointer ${
                        voiceListening
                          ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                          : resolvedVoiceLang === 'te-IN'
                            ? paperCream
                              ? 'bg-amber-100 border-amber-400 text-amber-900'
                              : 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                            : paperCream
                              ? 'bg-white/80 border-zinc-300 text-zinc-700 hover:bg-white'
                              : 'bg-zinc-900 border-zinc-700 text-emerald-300 hover:bg-zinc-800'
                      }`}
                      title={
                        voiceListening
                          ? 'Stop voice typing'
                          : resolvedVoiceLang === 'te-IN'
                            ? 'Speak Telugu — inserts తెలుగు script only'
                            : 'Speak English'
                      }
                      aria-label="Voice to type"
                      aria-pressed={voiceListening}
                    >
                      {voiceListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fullscreenLevel > 0) exitWriterFullscreen();
                        else cycleWriterFullscreen();
                      }}
                      className={`shrink-0 p-1 rounded border cursor-pointer ${
                        paperCream
                          ? 'bg-white/80 border-zinc-300 text-zinc-700 hover:bg-white'
                          : 'bg-zinc-900 border-zinc-700 text-cyan-300 hover:bg-zinc-800'
                      }`}
                      title={
                        fullscreenLevel === 0
                          ? 'Fullscreen Writer Console (⌘Enter)'
                          : fullscreenLevel === 1
                            ? 'Fullscreen this draft page (⌘Enter again)'
                            : 'Exit fullscreen (Esc)'
                      }
                      aria-label={fullscreenLevel > 0 ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                      {fullscreenLevel > 0 ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div
                  className={`relative flex-1 min-h-0 ${paperCream ? 'bg-[#f7f4ef]' : 'bg-[#1a1a1a]'}`}
                >
                  {colorCodeEnabled && (
                    <pre
                      ref={highlightRef}
                      aria-hidden
                      className={`absolute inset-0 z-0 overflow-auto pointer-events-none p-4 sm:p-6 m-0 whitespace-pre-wrap break-words ${
                        paperCream ? 'text-zinc-900' : 'text-zinc-100'
                      }`}
                      style={{
                        fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
                        fontSize: '12pt',
                        lineHeight: '1.4',
                        letterSpacing: '0.01em',
                        tabSize: 4
                      }}
                    >
                      {classifiedLines.map((row, idx) => (
                        <div
                          key={`hl-${idx}`}
                          style={{
                            color:
                              row.type === 'blank'
                                ? 'transparent'
                                : palette[row.type] || palette.action
                          }}
                        >
                          {row.text || '\u00a0'}
                        </div>
                      ))}
                      <div>{'\n'}</div>
                    </pre>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={scriptText}
                    onChange={(e) => {
                      const v = e.target.value;
                      setScriptText(v);
                      persistLiveScreenplay(v);
                      setCaretPos(e.target.selectionStart || 0);
                    }}
                    onScroll={syncHighlightScroll}
                    onSelect={syncCaretFromTextarea}
                    onClick={syncCaretFromTextarea}
                    onKeyUp={syncCaretFromTextarea}
                    onKeyDown={handleKeyDown}
                    placeholder="Write screenplay here (e.g. EXT. LOCATION - DAY)…"
                    spellCheck={false}
                    className={`sps-screenplay-textarea absolute inset-0 z-10 w-full h-full focus:outline-none resize-none p-4 sm:p-6 selection:bg-cyan-500/30 overflow-auto ${
                      colorCodeEnabled
                        ? 'bg-transparent text-transparent caret-cyan-600 selection:text-white'
                        : paperCream
                          ? 'bg-transparent text-zinc-900 selection:text-zinc-900'
                          : 'bg-transparent text-zinc-100 selection:text-white'
                    }`}
                    style={{
                      fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
                      fontSize: '12pt',
                      lineHeight: '1.4',
                      letterSpacing: '0.01em',
                      tabSize: 4,
                      backgroundColor: 'transparent',
                      WebkitTextFillColor: colorCodeEnabled
                        ? 'transparent'
                        : paperCream
                          ? '#18181b'
                          : '#f4f4f5',
                      caretColor: paperCream ? '#0e7490' : '#67e8f9',
                      color: colorCodeEnabled ? 'transparent' : paperCream ? '#18181b' : '#f4f4f5'
                    }}
                    aria-label="Screenplay editor"
                    title="Tab = cycle element · Enter = smart next"
                  />
                </div>
                {colorCodeEnabled && (
                  <div
                    className={`px-3 py-1.5 border-t flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] font-bold shrink-0 ${
                      paperCream
                        ? 'border-zinc-300 bg-white/70'
                        : 'border-zinc-800 bg-zinc-950/80'
                    }`}
                  >
                    {[
                      ['scene_heading', 'Scene'],
                      ['shot', 'Shot / Cam'],
                      ['timing', 'Timing'],
                      ['character', 'Character'],
                      ['dialogue', 'Dialogue'],
                      ['action', 'Action'],
                      ['note', 'Note']
                    ].map(([k, label]) => (
                      <span key={k} style={{ color: palette[k] }}>
                        ■ {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right drawer: Find / Versions / Intel */}
          {rightDrawer && (
            <aside
              className={`shrink-0 border-l border-zinc-800 bg-zinc-900/95 flex flex-col overflow-hidden ${
                rightDrawer === 'intel' ? 'w-80' : 'w-64'
              }`}
            >
              {rightDrawer === 'find' && (
                <>
                  <div className="px-3 py-2 border-b border-zinc-800 text-xs font-black uppercase text-zinc-400 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5" />
                    Find / Replace
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Find</label>
                    <input
                      type="text"
                      value={findQuery}
                      onChange={(e) => {
                        setFindQuery(e.target.value);
                        setFindIndex(0);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleFindNext()}
                      className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-cyan-600"
                      placeholder="Search…"
                      aria-label="Find query"
                    />
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Replace</label>
                    <input
                      type="text"
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-cyan-600"
                      placeholder="Replace with…"
                      aria-label="Replace with"
                    />
                    <p className="text-[10px] text-zinc-500">
                      {findQuery ? `${findMatches.length} match${findMatches.length === 1 ? '' : 'es'}` : 'Enter a query'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={handleFindNext}
                        disabled={!findMatches.length}
                        className="px-2 py-1 rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-[10px] font-bold cursor-pointer"
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        onClick={handleReplaceOne}
                        disabled={!findMatches.length}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-[10px] font-bold cursor-pointer"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={handleReplaceAll}
                        disabled={!findMatches.length}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-[10px] font-bold cursor-pointer"
                      >
                        Replace All
                      </button>
                    </div>
                  </div>
                </>
              )}

              {rightDrawer === 'versions' && (
                <>
                  <div className="px-3 py-2 border-b border-zinc-800 text-xs font-black uppercase text-zinc-400 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      {versionsSubTab === 'archive' ? (
                        <Archive className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <History className="w-3.5 h-3.5" />
                      )}
                      {versionsSubTab === 'archive' ? 'Script Archive' : 'Versions'}
                    </span>
                    {versionsSubTab === 'drafts' ? (
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="text-[10px] text-amber-300 hover:text-amber-200 font-bold cursor-pointer"
                      >
                        + Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={refreshScriptArchive}
                        className="text-[10px] text-amber-300 hover:text-amber-200 font-bold cursor-pointer"
                      >
                        Refresh
                      </button>
                    )}
                  </div>

                  <div className="flex border-b border-zinc-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setVersionsSubTab('drafts')}
                      className={`flex-1 py-1.5 text-[10px] font-black cursor-pointer ${
                        versionsSubTab === 'drafts'
                          ? 'text-cyan-300 border-b-2 border-cyan-500 bg-cyan-950/30'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Quick Drafts
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        refreshScriptArchive();
                        setVersionsSubTab('archive');
                      }}
                      className={`flex-1 py-1.5 text-[10px] font-black cursor-pointer ${
                        versionsSubTab === 'archive'
                          ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-950/30'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Archive ({scriptArchive.length})
                    </button>
                  </div>

                  {archiveMsg && (
                    <div className="px-3 py-1.5 text-[10px] font-bold text-emerald-400 border-b border-zinc-800 bg-emerald-950/20">
                      {archiveMsg}
                    </div>
                  )}

                  {versionsSubTab === 'drafts' && (
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                      <p className="text-[9px] text-zinc-500 px-1 leading-snug">
                        Quick snapshots (max 25). Promote important ones to Archive.
                      </p>
                      {versions.length === 0 && (
                        <p className="text-[11px] text-zinc-500 px-1 py-2">No drafts saved yet.</p>
                      )}
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 flex flex-col gap-1.5"
                        >
                          <div className="text-[11px] font-bold text-zinc-200 truncate">{v.name}</div>
                          <div className="text-[10px] text-zinc-500">
                            {v.createdAt ? new Date(v.createdAt).toLocaleString() : ''}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => handleRestoreVersion(v)}
                              className="flex-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-700 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => openVersionCompare(v, v.name)}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-fuchsia-300 text-[10px] font-bold cursor-pointer"
                              title="Compare in window — show only changed parts"
                            >
                              Compare
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromoteVersion(v)}
                              className="px-2 py-1 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-[10px] font-bold cursor-pointer"
                              title="Promote to Script Archive"
                            >
                              Archive
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVersion(v.id)}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 text-[10px] font-bold cursor-pointer"
                              aria-label={`Delete ${v.name}`}
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {versionsSubTab === 'archive' && (
                    <div className="flex-1 overflow-y-auto p-2 space-y-3">
                      <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-2.5 space-y-2">
                        <p className="text-[10px] font-black uppercase text-amber-300">Archive current script</p>
                        <label className="text-[9px] text-zinc-500 uppercase font-bold">Milestone</label>
                        <select
                          value={
                            SCREENPLAY_MILESTONE_PRESETS.includes(archiveName)
                              ? archiveName
                              : '__custom__'
                          }
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setArchiveName('');
                              return;
                            }
                            setArchiveName(e.target.value);
                          }}
                          className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-100 focus:outline-none focus:border-amber-600"
                        >
                          {SCREENPLAY_MILESTONE_PRESETS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                          <option value="__custom__">Custom name…</option>
                        </select>
                        <input
                          type="text"
                          value={archiveName}
                          onChange={(e) => setArchiveName(e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-100 focus:outline-none focus:border-amber-600"
                          placeholder="Milestone label (editable)"
                        />
                        <input
                          type="text"
                          value={archiveNote}
                          onChange={(e) => setArchiveNote(e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-100 focus:outline-none focus:border-amber-600"
                          placeholder="Optional note (why this lock)…"
                        />
                        <button
                          type="button"
                          onClick={handleArchiveMilestone}
                          className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Archive as “{archiveName || 'Milestone'}”
                        </button>
                      </div>

                      <p className="text-[9px] text-zinc-500 px-0.5 leading-snug">
                        Long-lived revision history (up to 50). Restore replaces the editor — a pre-restore draft is auto-saved.
                      </p>

                      {scriptArchive.length === 0 && (
                        <p className="text-[11px] text-zinc-500 py-2">Archive empty — lock a Pink / Blue / Studio Lock milestone.</p>
                      )}
                      {scriptArchive.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-lg border border-amber-800/40 bg-zinc-950/80 p-2 flex flex-col gap-1.5"
                        >
                          <div className="text-[11px] font-black text-amber-200 truncate">{a.name}</div>
                          <div className="text-[10px] text-zinc-500">
                            {a.archivedAtLabel ||
                              (a.archivedAt ? new Date(a.archivedAt).toLocaleString() : '')}
                            {a.wordCount ? ` · ${a.wordCount} words` : ''}
                            {a.pageEstimate ? ` · ~${a.pageEstimate}p` : ''}
                          </div>
                          {a.note && (
                            <p className="text-[9px] text-zinc-500 leading-snug line-clamp-2">{a.note}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => handleRestoreArchive(a)}
                              className="flex-1 px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => openVersionCompare(a, a.name)}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-fuchsia-300 text-[10px] font-bold cursor-pointer"
                              title="Open compare window — changed parts only"
                            >
                              Compare
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRenameArchive(a)}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold cursor-pointer"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePurgeArchive(a.id, a.name)}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 text-[10px] font-bold cursor-pointer"
                            >
                              Purge
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {rightDrawer === 'intel' && (
                <>
                  <div className="px-3 py-2 border-b border-fuchsia-900/50 bg-gradient-to-r from-fuchsia-950/40 to-zinc-950 text-xs font-black uppercase text-fuchsia-200 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Radar className="w-3.5 h-3.5" />
                      Writer Intel
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-950 border border-fuchsia-700/50 text-fuchsia-300 font-black normal-case tracking-normal">
                      {intel.readiness?.score ?? 0} · {intel.readiness?.grade || 'Draft'}
                    </span>
                  </div>

                  <div className="flex border-b border-zinc-800 shrink-0">
                    {[
                      { id: 'radar', label: 'Radar', icon: Radar },
                      { id: 'pacing', label: 'Pace', icon: Activity },
                      { id: 'beats', label: 'Beats', icon: Layers },
                      { id: 'flags', label: 'Flags', icon: AlertTriangle }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setIntelSubTab(t.id)}
                        className={`flex-1 py-1.5 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer ${
                          intelSubTab === t.id
                            ? 'text-fuchsia-300 border-b-2 border-fuchsia-500 bg-fuchsia-950/30'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <t.icon className="w-3 h-3" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[10px] font-black uppercase text-zinc-400">Matrix Readiness</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${intel.readiness?.score || 0}%`,
                            background:
                              (intel.readiness?.score || 0) >= 70
                                ? 'linear-gradient(90deg,#22d3ee,#a855f7)'
                                : 'linear-gradient(90deg,#f59e0b,#f43f5e)'
                          }}
                        />
                      </div>
                      <ul className="space-y-1">
                        {(intel.readiness?.factors || []).slice(0, 5).map((f) => (
                          <li
                            key={f.label}
                            className={`text-[10px] flex items-start gap-1.5 ${
                              f.ok ? 'text-emerald-400' : 'text-zinc-500'
                            }`}
                          >
                            <span className="shrink-0">{f.ok ? '✓' : '○'}</span>
                            <span>{f.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {intelSubTab === 'radar' && (
                      <>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5">
                          <p className="text-[10px] font-black uppercase text-zinc-500 mb-2">Cinema DNA</p>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <div className="rounded-lg bg-zinc-900 px-2 py-1.5 border border-zinc-800">
                              <span className="text-zinc-500">INT</span>{' '}
                              <span className="font-black text-cyan-300">{intel.cinemaDNA?.intPct ?? 0}%</span>
                            </div>
                            <div className="rounded-lg bg-zinc-900 px-2 py-1.5 border border-zinc-800">
                              <span className="text-zinc-500">EXT</span>{' '}
                              <span className="font-black text-amber-300">{intel.cinemaDNA?.extPct ?? 0}%</span>
                            </div>
                            <div className="rounded-lg bg-zinc-900 px-2 py-1.5 border border-zinc-800">
                              <span className="text-zinc-500">Day</span>{' '}
                              <span className="font-black text-zinc-200">{intel.cinemaDNA?.dayPct ?? 0}%</span>
                            </div>
                            <div className="rounded-lg bg-zinc-900 px-2 py-1.5 border border-zinc-800">
                              <span className="text-zinc-500">Night</span>{' '}
                              <span className="font-black text-indigo-300">{intel.cinemaDNA?.nightPct ?? 0}%</span>
                            </div>
                            <div className="rounded-lg bg-zinc-900 px-2 py-1.5 border border-zinc-800 col-span-2">
                              Dialogue {intel.cinemaDNA?.dialoguePct ?? 0}% · Action {intel.cinemaDNA?.actionPct ?? 0}% · Shots{' '}
                              {intel.cinemaDNA?.shotTags ?? 0}
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase text-zinc-500 mb-2">Character Continuity Radar</p>
                          <div className="space-y-1.5">
                            {(intel.characters || []).length === 0 && (
                              <p className="text-[11px] text-zinc-500">Add ALL-CAPS character cues to track voice share.</p>
                            )}
                            {(intel.characters || []).slice(0, 12).map((c) => (
                              <div
                                key={c.name}
                                className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1.5"
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[11px] font-black text-zinc-100 truncate">{c.name}</span>
                                  <span className="text-[10px] text-fuchsia-300 font-bold shrink-0">{c.sharePct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-cyan-400"
                                    style={{ width: `${Math.min(100, Math.max(4, c.sharePct))}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-zinc-500 mt-1">
                                  {c.dialogueLines} lines · {c.sceneCount} scenes
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {intelSubTab === 'pacing' && (
                      <div>
                        <p className="text-[10px] font-black uppercase text-zinc-500 mb-2">Emotional / Action Heatmap</p>
                        <div className="flex items-end gap-1 h-28 px-1">
                          {(intel.scenes || []).filter((s) => !/^ACT\s+/i.test(s.title)).map((s) => (
                            <button
                              key={`heat-${s.index}`}
                              type="button"
                              onClick={() => jumpToOffset(s.offset)}
                              className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1 group cursor-pointer"
                              title={`${s.title}\n${s.emotion} · ${s.intensity}`}
                            >
                              <div
                                className="w-full rounded-t-md transition-all group-hover:brightness-125"
                                style={{
                                  height: `${Math.max(8, s.intensity)}%`,
                                  background: intensityColor(s.intensity),
                                  boxShadow: `0 0 12px ${intensityColor(s.intensity)}55`
                                }}
                              />
                              <span className="text-[8px] text-zinc-600 truncate w-full text-center">
                                {s.index + 1}
                              </span>
                            </button>
                          ))}
                          {(intel.scenes || []).filter((s) => !/^ACT\s+/i.test(s.title)).length === 0 && (
                            <p className="text-[11px] text-zinc-500 p-2">Add scene headings to see pacing arc.</p>
                          )}
                        </div>
                        <ul className="mt-3 space-y-1.5">
                          {(intel.scenes || [])
                            .filter((s) => !/^ACT\s+/i.test(s.title))
                            .map((s) => (
                              <button
                                key={`pace-row-${s.index}`}
                                type="button"
                                onClick={() => jumpToOffset(s.offset)}
                                className="w-full text-left rounded-lg border border-zinc-800 px-2 py-1.5 hover:bg-zinc-950 cursor-pointer"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] text-zinc-300 truncate font-bold">{s.title}</span>
                                  <span
                                    className="text-[9px] font-black shrink-0 px-1.5 py-0.5 rounded"
                                    style={{ color: intensityColor(s.intensity), background: '#18181b' }}
                                  >
                                    {s.intensity}
                                  </span>
                                </div>
                                <p className="text-[9px] text-zinc-500">{s.emotion} · {s.dialogueRatio}% dialogue</p>
                              </button>
                            ))}
                        </ul>
                      </div>
                    )}

                    {intelSubTab === 'beats' && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-zinc-500">Live Beat Board</p>
                        <p className="text-[10px] text-zinc-500 leading-snug">
                          Auto-generated scene cards — click to jump. No corkboard app required.
                        </p>
                        {(intel.beats || []).filter((b) => !/^ACT\s+/i.test(b.title)).map((b, i) => (
                          <button
                            key={`beat-${i}-${b.offset}`}
                            type="button"
                            onClick={() => jumpToOffset(b.offset)}
                            className="w-full text-left rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900 p-2.5 hover:border-fuchsia-600/50 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span
                                className="text-[9px] font-black uppercase tracking-wide"
                                style={{ color: intensityColor(b.intensity) }}
                              >
                                {b.emotion}
                              </span>
                              <span className="text-[9px] text-zinc-600">SC {i + 1}</span>
                            </div>
                            <p className="text-[11px] font-bold text-zinc-100 leading-snug">{b.summary}</p>
                            {b.characters?.length > 0 && (
                              <p className="text-[9px] text-zinc-500 mt-1 truncate">{b.characters.join(' · ')}</p>
                            )}
                          </button>
                        ))}
                        {(intel.beats || []).filter((b) => !/^ACT\s+/i.test(b.title)).length === 0 && (
                          <p className="text-[11px] text-zinc-500">Write scene headings to populate the beat board.</p>
                        )}
                      </div>
                    )}

                    {intelSubTab === 'flags' && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-zinc-500">Live Continuity Flags</p>
                        {(intel.flags || []).length === 0 && (
                          <p className="text-[11px] text-emerald-400">Clean — no continuity flags right now.</p>
                        )}
                        {(intel.flags || []).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => typeof f.offset === 'number' && jumpToOffset(f.offset)}
                            className={`w-full text-left rounded-lg border px-2.5 py-2 cursor-pointer ${
                              f.severity === 'warn'
                                ? 'border-amber-600/40 bg-amber-950/30 text-amber-100'
                                : 'border-zinc-800 bg-zinc-950/80 text-zinc-300'
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle
                                className={`w-3 h-3 shrink-0 mt-0.5 ${
                                  f.severity === 'warn' ? 'text-amber-400' : 'text-zinc-500'
                                }`}
                              />
                              <span className="text-[10px] leading-snug">{f.message}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      )}

      {/* SYNOPSIS TAB */}
      {activeConsoleTab === 'synopsis' && (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-zinc-950 flex flex-col gap-5">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                  Master Script Synopsis Mode
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select which version of the Master Story Synopsis will be compiled into prompt packages.
                </p>
              </div>
            </div>
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setScriptSynopsisSource('auto_llm')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scriptSynopsisSource === 'auto_llm'
                    ? 'bg-amber-400 text-zinc-950 shadow font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                LLM Auto-Generated
              </button>
              <button
                type="button"
                onClick={() => setScriptSynopsisSource('writer_custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scriptSynopsisSource === 'writer_custom'
                    ? 'bg-amber-400 text-zinc-950 shadow font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Writer Custom
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
            <div
              className={`p-5 rounded-xl border transition-all flex flex-col ${
                scriptSynopsisSource === 'auto_llm'
                  ? 'bg-amber-950/20 border-amber-500/60 shadow-xl'
                  : 'bg-zinc-900/50 border-zinc-800 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800 gap-2">
                <span className="text-xs font-black text-amber-300 flex items-center gap-2 min-w-0">
                  <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
                  LLM Auto-Generated Script Synopsis
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {scriptSynopsisSource === 'auto_llm' && (
                    <span className="text-[10px] bg-amber-400 text-zinc-950 font-black px-2 py-0.5 rounded-full uppercase">
                      Active in Prompts
                    </span>
                  )}
                  <button
                    type="button"
                    className="sps-btn text-[10px]"
                    disabled={!String(llmAutoSynopsis || '').trim()}
                    onClick={() => handleCopySynopsis(llmAutoSynopsis, 'llm')}
                    title="Copy LLM synopsis"
                  >
                    {copiedSynopsis === 'llm' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSynopsis === 'llm' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-zinc-950/80 rounded-lg p-4 border border-zinc-800 text-xs text-zinc-200 leading-relaxed font-sans overflow-y-auto whitespace-pre-wrap">
                {llmAutoSynopsis || (
                  <span className="text-zinc-500 italic">
                    No LLM synopsis yet. Click Re-Extract Synopsis to generate from the screenplay.
                  </span>
                )}
              </div>
            </div>

            <div
              className={`p-5 rounded-xl border transition-all flex flex-col ${
                scriptSynopsisSource === 'writer_custom'
                  ? 'bg-amber-950/30 border-amber-400 shadow-xl ring-1 ring-amber-400/50'
                  : 'bg-zinc-900/50 border-zinc-800 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800 gap-2">
                <span className="text-xs font-black text-amber-300 flex items-center gap-2 min-w-0">
                  <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
                  Writer Custom Script Synopsis
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {scriptSynopsisSource === 'writer_custom' && (
                    <span className="text-[10px] bg-amber-400 text-zinc-950 font-black px-2 py-0.5 rounded-full uppercase">
                      Active in Prompts
                    </span>
                  )}
                  <button
                    type="button"
                    className="sps-btn text-[10px]"
                    disabled={!String(writerCustomSynopsis || '').trim()}
                    onClick={() => handleCopySynopsis(writerCustomSynopsis, 'writer')}
                    title="Copy writer synopsis"
                  >
                    {copiedSynopsis === 'writer' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSynopsis === 'writer' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <textarea
                value={writerCustomSynopsis}
                onChange={(e) => setWriterCustomSynopsis(e.target.value)}
                placeholder="Type your custom Master Script Synopsis here…"
                rows={12}
                className="w-full flex-1 bg-zinc-950 border border-amber-500/60 rounded-lg p-4 text-xs font-sans font-bold leading-relaxed focus:outline-none focus:border-amber-400 resize-none selection:bg-amber-500 selection:text-zinc-950"
                style={{ color: '#FFEE00' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* BREAKDOWN TAB — mirrored Project Console AI Script Breakdown */}
      {activeConsoleTab === 'breakdown' && (
        <div className="flex-1 min-h-0 overflow-hidden p-3 sm:p-4 bg-[var(--sps-bg)] flex flex-col">
          <AiScriptBreakdownPanel
            projectTitle={projectTitle}
            shots={shots}
            onApplyShots={onApplyShots}
            setPresetProfile={setPresetProfile}
            initialScriptText={scriptText}
            eventSource="writer"
            onApplied={() => onNavigateToView?.('spreadsheet')}
            className="flex-1 min-h-0 h-full"
          />
        </div>
      )}

      {/* FOOTER — hide on breakdown so Story Package / Parse aren't cramped */}
      {activeConsoleTab !== 'breakdown' ? (
      <div className="px-3 py-1 border-t border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex flex-wrap items-center justify-between text-[11px] gap-2 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="sps-count-pill font-semibold">
            Page {currentPage} / {totalPages} · ~{runtimeMin} min
          </span>
          <button
            type="button"
            onClick={() => {
              setIntelSubTab('radar');
              setRightDrawer('intel');
            }}
            className="sps-btn text-[10px]"
            title="Open Writer Intel"
          >
            Intel {intel.readiness?.score ?? 0} · {intel.readiness?.grade || 'Draft'}
          </button>
          <span className="text-[var(--sps-muted)]">
            {sceneOutline.filter((s) => s.type === 'scene').length} scenes · {shotCount} shots · {wordCount} words
            {(intel.flags || []).length > 0 ? ` · ${intel.flags.length} flags` : ''}
          </span>
          <span className="text-[10px] text-zinc-600 hidden lg:inline" title="Tab = cycle element · Enter = smart next">
            Tab = cycle · Enter = smart next · Intel = beyond FD
          </span>
        </div>
        {onNavigateToView && (
          <button
            type="button"
            onClick={() => onNavigateToView('spreadsheet')}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-cyan-600 text-zinc-200 hover:text-white text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Open 25-Craft Matrix →
          </button>
        )}
      </div>
      ) : null}

      <ScreenplayDiffModal
        isOpen={diffOpen}
        onClose={() => setDiffOpen(false)}
        leftText={diffLeft.text}
        rightText={scriptText}
        leftLabel={diffLeft.label}
        rightLabel="Current Editor"
        title="Script Version Compare"
        onRestoreLeft={() => {
          if (!diffLeft.text) return;
          if (!confirm(`Restore “${diffLeft.label}” into the editor?`)) return;
          if (String(scriptText || '').trim()) {
            setVersions(
              saveScreenplayVersion({
                text: scriptText,
                projectTitle,
                name: `Pre-restore ${new Date().toLocaleString()}`
              })
            );
          }
          applyScriptText(diffLeft.text);
          setDiffOpen(false);
        }}
      />

      <WriterHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      <ActiveProjectConfirmModal
        isOpen={parseGateOpen}
        activeTitle={projectTitle}
        intendedTitle={pendingDetectedTitle || projectTitle}
        existingCount={Array.isArray(shots) ? shots.length : 0}
        incomingCount={null}
        actionLabel="Parse screenplay into the Matrix for this film"
        onCancel={() => {
          setParseGateOpen(false);
          setPendingParseText('');
          setPendingDetectedTitle('');
          setParseStatusMsg('Parse cancelled — matrix left unchanged');
        }}
        onConfirm={confirmParseScriptToMatrix}
      />

      <ScriptMergePromptModal
        isOpen={mergePromptOpen}
        projectTitle={projectTitle}
        existingCount={mergeApplyState.existingCount}
        incomingCount={mergeApplyState.incomingCount}
        onOverwrite={() => {
          const { parsedShots, textToParse } = mergeApplyState;
          setMergePromptOpen(false);
          proposeParsedShotsToReview(parsedShots, textToParse, 'overwrite');
        }}
        onMerge={() => {
          const { parsedShots, textToParse } = mergeApplyState;
          setMergePromptOpen(false);
          proposeParsedShotsToReview(parsedShots, textToParse, 'merge');
        }}
        onCancel={() => {
          setMergePromptOpen(false);
          setParseStatusMsg('Apply cancelled — story package saved; matrix unchanged until LLM review');
        }}
      />
    </div>
  );
}
