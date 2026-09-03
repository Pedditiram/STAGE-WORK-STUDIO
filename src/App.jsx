import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import SplashScreen from './components/SplashScreen';
import { isLocalStudioHost } from './utils/runtimeEnv';
import Header from './components/Header';
import {
  STUDIO_SWITCH_ACCOUNT_EVENT,
  STUDIO_LOGOUT_EVENT,
  STUDIO_OPEN_LOGIN_EVENT
} from './components/StudioProfileControl';
import SpreadsheetView from './components/SpreadsheetView';
import StudioFormView from './components/StudioFormView';
import DirectorCanvas from './components/DirectorCanvas';
import ScreenplayEditor from './components/ScreenplayEditor';
import TemplateSelector from './components/TemplateSelector';
import PhoneOtpGuardModal from './components/PhoneOtpGuardModal';
import LoginModal from './components/LoginModal';
import DesktopTrialModal from './components/DesktopTrialModal';
import ConflictAlertModal from './components/ConflictAlertModal';
import ScriptMergePromptModal from './components/ScriptMergePromptModal';
import AppVersionSelectorModal from './components/AppVersionSelectorModal';
import { saveStoredCharacterProfiles, getStoredCharacterProfiles } from './components/CharacterBibleModal';
import { saveStoredWorldEnvironmentAssets } from './components/WorldEnvironmentConsole';
import CollabChatPanel from './components/CollabChatPanel';
import { subscribeToCollabChat } from './services/collabChat';
import { syncCanvasVaultToCloud, getStoredCanvasVaultImages } from './services/canvasVault';
import { hydrateImageBlobStore, offloadShotMedia } from './utils/imageBlobStore';
import {
  attachWorkspaceToProject,
  applyOpenWorkspace,
  collectOpenWorkspace,
  mergeLibrarySources,
  readLocalProjectLibrary,
  writeLocalProjectLibrary,
  roomIdForProject,
  titlesMatch,
  resolveActiveTitleForBoot,
  LEGACY_SHARED_ROOM
} from './utils/projectWorkspace';
import { assertProjectWriteGate } from './utils/productionLifecycle';
import {
  isUsableProjectTitle,
  assertProjectIsolationHealth,
  readIsolationSnapshot
} from './utils/activeProjectGate';
import { proposeApplyShotsCommand } from './utils/llmCommandBus';
import {
  readTitleCharacterVault,
  saveActiveCharacterProfiles,
  reconcileActiveBibleToCurrentTitle
} from './utils/projectBibleVault';
import {
  detectBibleSoTDrift,
  healBibleSoTDrift,
  patchLibraryProjectBibleFields
} from './utils/bibleSoTHealth';
import { markStoryPackageApplied, assertStoryPackageApplyAllowed, assertMergeApplyAllowed, isSampleDemoShots, readStoryPackageForTitle } from './utils/storyPackage';
import { applyProductionAssetSpec } from './utils/assetRegistry';
import {
  appendStillTake,
  appendVideoTake,
  updateVideoTake,
  ensureShotTakes,
  getActiveStillUrl,
  getActiveVideoTake
} from './utils/shotTakes';
import { resumePendingGenerationJobs } from './utils/generationJobs';
import { fetchCloudSyncHealth } from './utils/cloudSyncHealth';
import { saveDoPVision, saveSoundVision } from './utils/departmentVisionStorage';
import { saveDirectorPsychology } from './utils/directorPsychologyStorage';
import {
  ensureLifecycle,
  mergeRespectingLifecycleLock,
  STUDIO_NAVIGATE_EVENT
} from './utils/productionLifecycle';
import { appendCreativeAudit } from './utils/creativeAuditLog';
import { auditPresenceIfChanged, auditPresenceConflict, auditPeerPresenceDiff, resetPeerPresenceRoom } from './utils/collabPresenceAudit';
import { syncProductionSpine, autoSyncProductionSpine } from './utils/productionSpine';
import { saveProjectToVault, loadProjectsFromVault, loadActiveWorkspaceFromDisk, saveActiveWorkspaceToDisk, loadProjectFromDiskByTitle, loadUiPrefsFromDisk, saveUiPrefsToDisk } from './services/projectDiskVault';
import { autoRestoreAppSettingsFromVault } from './services/appSettingsDiskVault';
import { subscribeToCloudRoom, publishToCloudRoom, enableCloudCollaborationMode } from './services/cloudSync';
import {
  normalizeAssetRoots,
  readAssetRootsFromLibrary,
  stampAssetRootsIntoLibrary,
  versionedProjectFilename
} from './utils/projectAssetRoots';
import { saveVersionedProjectSnapshot } from './utils/projectAssetRootsClient';
import { autoSaveIntervalMs } from './utils/autoSaveIntervals';
import { appShotHistoryShouldHandleUndo } from './utils/stageHotkeys';
import { Check } from 'lucide-react';
import { 
  syncProjectLibraryToCloud, 
  syncCollaboratorsToCloud, 
  subscribeToProjectLibraryUpdates,
  subscribeToCollaboratorUpdates,
  fetchProjectLibraryFromCloud,
  fetchCollaboratorsFromCloud,
  broadcastActiveSlotEditing,
  subscribeToActiveEditingSlots,
  notifyStudioOnlineWhatsApp,
  filterOutDeletedProjects,
  isProjectTitleDeleted,
  healActiveProjectFromArchive,
  clearDeletedProjectTitles
} from './services/dbService';
import {
  learnFromProject,
  boostSlotsWithStudioBrain,
  hydrateStudioBrainFromDisk
} from './services/studioBrain';
import { getSlotsForGenre, detectScriptGenre, GENRE_PRESET_PROFILES, getMergedGenreProfiles } from './constants/seedancePresets';
import { safeLocalStorageSetItem } from './utils/safeStorage';
import { writeOpenScreenplayText, migrateOpenScreenplayToSoT } from './utils/screenplayInterop';
import { parseSceneAndShotID } from './utils/sceneShotUtils';
import { bindLastFrameToNext, persistBridges } from './utils/continuitySpine';
import {
  getCurrentUserEmail,
  isGuestSession,
  isGuestBrowseEnabled,
  canGuestBrowseApp,
  consumeGuestLookFromUrl,
  hydrateGuestUrlFromServer,
  enterGuestLookSession,
  isStudioAdmin,
  canAccessProject,
  canCreateOrDeleteProjects,
  canEditProjects,
  filterAccessibleProjects,
  markCollaboratorSession,
  canAccessBudgetConsole,
  isLookOnlySession,
  isStudioModuleEnabled,
  areAllConsolesOff,
  setPresentationMode,
  isPresentationMode,
  purgeWeakAdminCredentials
} from './utils/projectPermissions';
import { heartbeat, getDeviceId, canUseSaasFeature, assertCanGenerate, upsertLicense } from './utils/saasControl';
import { assertExportAllowed, logExportSuccess, EXPORT_LIFECYCLE } from './utils/exportGate';
import DemoModeView from './components/DemoModeView';
import StudioTourOverlay from './components/StudioTourOverlay';
import {
  GUEST_PLAY_TITLE,
  GUEST_PLAY_ROOM,
  GUEST_PLAY_SHOTS,
  getGuestPlayProject
} from './utils/guestPlayground';
import StudioNavigator, { NAV_ICONS } from './components/StudioNavigator';
import MobileGestureHelp from './components/MobileGestureHelp';
import NavigatorShortcutChip, { openNavigatorShortcutHelp } from './components/NavigatorShortcutChip';
import ProjectConsoleModal from './components/ProjectConsoleModal';
import AdminSettingsModal from './components/AdminSettingsModal';

const PromptCompilerModal = lazy(() => import('./components/PromptCompilerModal'));
const HelpUserGuideModal = lazy(() => import('./components/HelpUserGuideModal'));
const InvestorDeckModal = lazy(() => import('./components/InvestorDeckModal'));
const CharacterBibleModal = lazy(() => import('./components/CharacterBibleModal'));
const WorldEnvironmentConsole = lazy(() => import('./components/WorldEnvironmentConsole'));
const StudioBrainModal = lazy(() => import('./components/StudioBrainModal'));
const ProductionDashboardModal = lazy(() => import('./components/ProductionDashboardModal'));
const LlmCommandReviewModal = lazy(() => import('./components/LlmCommandReviewModal'));
const PromoPackModal = lazy(() => import('./components/PromoPackModal'));
const CampaignKitModal = lazy(() => import('./components/CampaignKitModal'));
const StoryboardModal = lazy(() => import('./components/StoryboardModal'));
const PitchDeckModal = lazy(() => import('./components/PitchDeckModal'));
const BudgetConsoleModal = lazy(() => import('./components/BudgetConsoleModal'));
const FeatureReelModal = lazy(() => import('./components/FeatureReelModal'));
const GenerateDeskModal = lazy(() => import('./components/GenerateDeskModal'));

const INITIAL_SHOTS = [
  {
    sceneShotId: "SC01_SH01",
    shotComposition: "Extreme Close-Up (ECU)",
    cameraMotionTag: "[Camera: Push In / Slow Dolly Zoom]",
    timeAndLightingEnv: "[Weather: Rainy Monsoon] • [Timing: Cyberpunk Night] • [Env: Outdoor Stage]",
    directionalLightingAndHighlight: "[Angle: 45° Side Key] • [Shadow: Wet Shadow Depth] • [Highlight: Eye Catchlight & Razor Rim]",
    subjectLightingTag: "[Lighting: Cyberpunk Neon Blue & Pink Dual Glow]",
    subjectColorTag: "[Subject Color: High-Saturation Neo-Noir]",
    backgroundLightingTag: "[BG Lighting: Strobing Neon City Reflections]",
    backgroundColorTag: "[BG Color: Deep Midnight Blue & Indigo]",
    characterIdAssetRef: "[CharID: @LeadSinger_Aria - Vocalist, leather jacket]",
    coArtistInteraction: "[Co-Artist: Backing musicians swaying to rhythm, gazing at lead artist]",
    actionEnvContext: "Rain-slicked futuristic concert stage under towering neon city lights, wet reflections, smoke machine haze.",
    characterExpression: "Passionate singing, eyes closed in deep emotion, veins visible on neck",
    characterPsychologyState: "[Mindstate: Vulnerable Emotional Breakdown & High Adrenaline]",
    characterMannerismAndPosture: "[Mannerism: Nervous Fidgeting & Adjusting Collar under Pressure]",
    characterPlacement: "Foreground center stage, co-artists positioned in midground left & right",
    characterDialogue: '"The grid is failing... turn up the amps!"',
    characterMovement: "Grasping microphone stand with both hands and leaning forward with intense energy",
    characterEyeLooks: "[Eye Look: Direct Eye Contact with Camera Lens]"
  },
  {
    sceneShotId: "SC01_SH02",
    shotComposition: "Medium Shot (MS)",
    cameraMotionTag: "[Camera: Tracking Shot / Steadicam Follow]",
    timeAndLightingEnv: "[Weather: Clear Interior Night] • [Timing: Midnight] • [Env: Indoor Venue]",
    directionalLightingAndHighlight: "[Angle: 180° Direct Backlight] • [Shadow: Controlled Studio Shadow] • [Highlight: White Bounce Fill]",
    subjectLightingTag: "[Lighting: High-Contrast Chiaroscuro Noir]",
    subjectColorTag: "[Subject Color: Teal & Orange Cinema Palette]",
    backgroundLightingTag: "[BG Lighting: Cold Industrial Fluorescent Strip]",
    backgroundColorTag: "[BG Color: Muted Concrete Industrial Gray]",
    characterIdAssetRef: "[CharID: @Guitarist_Leo - Lead guitarist, cyber visor]",
    coArtistInteraction: "[Co-Artist: Co-singer stepping up to microphone for harmonized duet reaction]",
    actionEnvContext: "Underground cybernetics music venue, flickering blue neon lights, packed energetic crowd.",
    characterExpression: "Exuberant smile, laughing mid-performance while making eye contact",
    characterPsychologyState: "[Mindstate: Heroic Euphoria & Unwavering Stage Chemistry]",
    characterMannerismAndPosture: "[Mannerism: Military Straight Spine & Hand Resting on Hilt]",
    characterPlacement: "Midground center frame rule of thirds, co-performers surrounding in semi-circle",
    characterDialogue: '"We only get one chance at this!"',
    characterMovement: "Striking a powerful guitar bend pose, body angled 45 degrees",
    characterEyeLooks: "[Eye Look: Looking at Co-Artist with intense stage chemistry]"
  }
];

function shouldBootWithSplash() {
  if (typeof window === 'undefined') return false;
  try {
    // When entering the URL unauthenticated, start immediately with presentation mode
    if (sessionStorage.getItem('sps_session_authed') !== '1') {
      return false;
    }
    if (isLocalStudioHost()) return true;
    return sessionStorage.getItem('sps_splash_done') !== '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldBootWithSplash);

  const [projectTitle, setProjectTitle] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const q = new URLSearchParams(window.location.search);
        const g = String(q.get('guest') || q.get('look') || '').toLowerCase();
        if (g === '1' || g === 'true' || g === 'yes') return GUEST_PLAY_TITLE;
      } catch {
        /* ignore */
      }
      return localStorage.getItem('sps_current_project_title') || "STAGE PRODUCTION STUDIO";
    }
    return "STAGE PRODUCTION STUDIO";
  });

  const [targetModel, setTargetModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_current_target_model') || "SPS Direct Cinema";
    }
    return "SPS Direct Cinema";
  });
  const [aspectRatio, setAspectRatio] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_current_aspect_ratio') || '21:9 Ultrawide';
    }
    return '21:9 Ultrawide';
  });

  const [showCanvasTab, setShowCanvasTab] = useState(() => {
    if (typeof window !== 'undefined') {
      // One-time migration: canvas was previously default-ON; hide for all users by default
      if (localStorage.getItem('sps_canvas_default_hidden_v1') !== '1') {
        localStorage.setItem('sps_enable_canvas_tab', 'false');
        localStorage.setItem('sps_canvas_default_hidden_v1', '1');
      }
      const saved = localStorage.getItem('sps_enable_canvas_tab');
      if (saved === null || saved === undefined || saved === '') {
        localStorage.setItem('sps_enable_canvas_tab', 'false');
        return false;
      }
      return saved === 'true';
    }
    return false;
  });

  const [colorTheme, setColorTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_color_theme');
      if (saved && (saved === 'paper' || saved === 'dark')) {
        return saved;
      }
      localStorage.setItem('sps_color_theme', 'paper');
    }
    return 'paper';
  });

  // Hydrate theme (+ shared desk prefs) from disk so Electron mirrors localhost
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await loadUiPrefsFromDisk();
      if (cancelled) return;
      const diskTheme = prefs?.colorTheme;
      if (diskTheme === 'paper' || diskTheme === 'dark') {
        setColorTheme(diskTheme);
        try {
          localStorage.setItem('sps_color_theme', diskTheme);
        } catch {
          /* ignore */
        }
      } else {
        // Seed disk from this shell so the other shell can catch up
        const local = typeof window !== 'undefined' ? localStorage.getItem('sps_color_theme') : null;
        const seed = local === 'dark' || local === 'paper' ? local : colorTheme;
        saveUiPrefsToDisk({ colorTheme: seed === 'dark' ? 'dark' : 'paper' }).catch(() => {});
      }
      const diskView = typeof prefs?.activeView === 'string' ? prefs.activeView.trim() : '';
      if (diskView && diskView !== 'demo') {
        try {
          localStorage.setItem('sps_active_view', diskView);
        } catch {
          /* ignore */
        }
      }
    })();
    const onFocus = () => {
      loadUiPrefsFromDisk().then((prefs) => {
        if (!prefs) return;
        if (prefs.colorTheme === 'paper' || prefs.colorTheme === 'dark') {
          setColorTheme(prefs.colorTheme);
          try {
            localStorage.setItem('sps_color_theme', prefs.colorTheme);
          } catch {
            /* ignore */
          }
        }
        const id = prefs.autoSaveIntervalId;
        if (id && ['off', '2m', '5m', '15m', '30m'].includes(id)) {
          try {
            localStorage.setItem('sps_auto_save_interval', id);
          } catch {
            /* ignore */
          }
          window.dispatchEvent(
            new CustomEvent('sps_ui_prefs_synced', { detail: { autoSaveIntervalId: id } })
          );
        }
      });
    };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleSetColorTheme = (theme) => {
    const next = theme === 'dark' ? 'dark' : 'paper';
    setColorTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_color_theme', next);
    }
    saveUiPrefsToDisk({ colorTheme: next }).catch(() => {});
  };
  // Persistent shots state from localStorage with safety bounds check (max 200 shots)
  const [shots, setShots] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const q = new URLSearchParams(window.location.search);
        const g = String(q.get('guest') || q.get('look') || '').toLowerCase();
        if (g === '1' || g === 'true' || g === 'yes') return GUEST_PLAY_SHOTS.map((s) => ({ ...s }));
      } catch {
        /* ignore */
      }
      const saved = localStorage.getItem('sps_current_shots');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.length > 150 ? parsed.slice(0, 150) : parsed;
          }
        } catch (e) {}
      }
    }
    return INITIAL_SHOTS;
  });

  // Safety guard: sanitize oversized shots array (e.g. 7000+ PDF binary stream items) to max 150
  useEffect(() => {
    if (shots && shots.length > 150) {
      console.warn("Sanitizing oversized shots array:", shots.length);
      const sanitized = shots.slice(0, 150);
      setShots(sanitized);
      if (typeof window !== 'undefined' && !isGuestSession()) {
        safeLocalStorageSetItem('sps_current_shots', JSON.stringify(sanitized));
      }
    }
  }, [shots]);

  // Dynamic Script-Aware Preset Engine State
  const [presetProfile, setPresetProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_preset_profile');
      if (saved && GENRE_PRESET_PROFILES[saved]) return saved;
    }
    return 'mythological';
  });

  // Prefer per-project genre from library; fall back to script auto-detect
  useEffect(() => {
    if (isGuestSession()) return;
    try {
      const library = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
      const proj = Array.isArray(library)
        ? library.find((p) => String(p?.title || '').trim() === String(projectTitle || '').trim())
        : null;
      if (proj?.genreKey) {
        const profiles = getMergedGenreProfiles();
        if (profiles[proj.genreKey]) {
          setPresetProfile((prev) => (prev === proj.genreKey ? prev : proj.genreKey));
          localStorage.setItem('sps_preset_profile', proj.genreKey);
          return;
        }
      }
    } catch (e) {}
    const detected = detectScriptGenre(projectTitle, shots);
    setPresetProfile((prev) => (prev === detected ? prev : detected));
  }, [projectTitle, shots]);

  // Auto-extract Character Bibles ONCE on app mount only when this film's cast is empty
  useEffect(() => {
    if (typeof window === 'undefined' || !shots || shots.length === 0) return;
    if (isGuestSession()) return;
    const title = String(projectTitle || localStorage.getItem('sps_current_project_title') || '').trim();
    if (!isUsableProjectTitle(title)) return;
    const titled = readTitleCharacterVault(title);
    if (Array.isArray(titled) && titled.length > 0) return;
    if (getStoredCharacterProfiles().length > 0) return;
    import('./services/aiScriptParser')
      .then(({ extractProjectCharactersWithLLM }) => extractProjectCharactersWithLLM(shots, title))
      .then((extracted) => {
        if (Array.isArray(extracted) && extracted.length > 0) {
          saveActiveCharacterProfiles(extracted, { title });
        }
      })
      .catch(() => {});
  }, []);

  const handleSetPresetProfile = (profileKey) => {
    setPresetProfile(profileKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_preset_profile', profileKey);
    }
  };

  const activeSlots = useMemo(
    () => boostSlotsWithStudioBrain(getSlotsForGenre(presetProfile)),
    [presetProfile]
  );

  // Default active view tab: 'canvas' | 'spreadsheet' | 'form'
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const authed = sessionStorage.getItem('sps_session_authed') === '1';
      if (!authed || isPresentationMode() || areAllConsolesOff()) return 'demo';
      const savedCanvas = localStorage.getItem('sps_enable_canvas_tab');
      const canShowCanvas = savedCanvas === 'true';
      const saved = localStorage.getItem('sps_active_view');
      if (saved && (saved === 'spreadsheet' || saved === 'form' || saved === 'screenplay' || saved === 'templates' || saved === 'promo' || saved === 'campaign' || saved === 'storyboard' || saved === 'pitch' || saved === 'budget' || saved === 'demo' || (saved === 'canvas' && canShowCanvas))) {
        if (saved === 'budget' && typeof window !== 'undefined') {
          try {
            if (localStorage.getItem('sps_budget_console_enabled') === 'false') return 'spreadsheet';
          } catch { /* ignore */ }
        }
        if (saved === 'demo') return 'spreadsheet';
        return saved;
      }
      return 'spreadsheet';
    }
    return 'demo';
  });

  // Mirror desk tab across localhost ↔ Electron via shared disk prefs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await loadUiPrefsFromDisk();
      if (cancelled || !prefs?.activeView) return;
      const v = String(prefs.activeView).trim();
      if (!v || v === 'demo') return;
      setActiveView((cur) => (cur === v ? cur : v));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeView || activeView === 'demo') return;
    saveUiPrefsToDisk({ activeView }).catch(() => {});
  }, [activeView]);

  const [activeShotIndex, setActiveShotIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_active_shot_index');
      const idx = parseInt(saved, 10);
      return !isNaN(idx) && idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [isCompilerOpen, setIsCompilerOpen] = useState(false);
  const [budgetAccessTick, setBudgetAccessTick] = useState(0);

  useEffect(() => {
    const sync = () => setBudgetAccessTick((n) => n + 1);
    window.addEventListener('sps_budget_console_changed', sync);
    window.addEventListener('sps_studio_modules_changed', sync);
    window.addEventListener('sps_collaborators_updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sps_budget_console_changed', sync);
      window.removeEventListener('sps_studio_modules_changed', sync);
      window.removeEventListener('sps_collaborators_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (areAllConsolesOff()) {
      if (activeView !== 'demo') setActiveView('demo');
      return;
    }
    if (activeView === 'demo') {
      const fallback = ['spreadsheet', 'form', 'screenplay'].find((v) => {
        const m = { spreadsheet: 'matrix', form: 'form', screenplay: 'writer' }[v];
        return isStudioModuleEnabled(m);
      }) || 'spreadsheet';
      setActiveView(fallback);
      return;
    }
    const viewModule = {
      screenplay: 'writer',
      spreadsheet: 'matrix',
      form: 'form',
      canvas: 'stage',
      promo: 'promo',
      campaign: 'campaign',
      storyboard: 'storyboard',
      pitch: 'pitch',
      budget: 'budget',
    }[activeView];
    if (viewModule && !isStudioModuleEnabled(viewModule)) {
      const fallback = ['spreadsheet', 'form', 'screenplay'].find((v) => {
        const m = { spreadsheet: 'matrix', form: 'form', screenplay: 'writer' }[v];
        return isStudioModuleEnabled(m);
      }) || 'demo';
      setActiveView(areAllConsolesOff() ? 'demo' : fallback);
    }
    if (activeView === 'budget' && !canAccessBudgetConsole()) {
      setActiveView(isStudioModuleEnabled('matrix') ? 'spreadsheet' : 'demo');
    }
  }, [activeView, budgetAccessTick]);

  const [isFeatureReelOpen, setIsFeatureReelOpen] = useState(false);
  const [isGenerateDeskOpen, setIsGenerateDeskOpen] = useState(false);
  const [isStudioTourOpen, setIsStudioTourOpen] = useState(false);
  const [isProjectConsoleOpen, setIsProjectConsoleOpen] = useState(shouldBootWithSplash);
  const [projectConsoleInitialTab, setProjectConsoleInitialTab] = useState('library');
  const [projectConsoleInitialVault, setProjectConsoleInitialVault] = useState('director');

  // App-Wide 100% Native Fullscreen State — starts in full screen at launch
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [headerMinimized, setHeaderMinimized] = useState(() => {
    try {
      if (localStorage.getItem('sps_pin_app_header') !== 'false') return false;
      return localStorage.getItem('sps_header_minimized') === 'true';
    } catch { return false; }
  });
  const [headerPinned, setHeaderPinned] = useState(() => {
    try {
      return localStorage.getItem('sps_pin_app_header') !== 'false';
    } catch { return true; }
  });
  /** Expand collapsed studio bar on hover (JS — CSS :hover/:focus-within re-opens right after Minimize click). */
  const [headerHoverOpen, setHeaderHoverOpen] = useState(false);
  /** After Minimize, ignore hover-expand until the pointer leaves the chrome. */
  const [headerMinimizeArmed, setHeaderMinimizeArmed] = useState(false);
  const headerLeaveRef = React.useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('sps_pin_app_header', headerPinned ? 'true' : 'false');
      localStorage.setItem('sps_header_minimized', headerMinimized && !headerPinned ? 'true' : 'false');
    } catch (e) {}
  }, [headerPinned, headerMinimized]);

  useEffect(() => () => {
    if (headerLeaveRef.current) clearTimeout(headerLeaveRef.current);
  }, []);

  const collapseStudioHeader = () => {
    setHeaderPinned(false);
    setHeaderMinimized(true);
    setHeaderHoverOpen(false);
    setHeaderMinimizeArmed(true);
    try {
      if (typeof document !== 'undefined' && document.activeElement?.blur) {
        document.activeElement.blur();
      }
    } catch {
      /* ignore */
    }
  };

  const expandStudioHeader = ({ pin = false } = {}) => {
    setHeaderMinimizeArmed(false);
    setHeaderHoverOpen(true);
    setHeaderMinimized(false);
    if (pin) setHeaderPinned(true);
  };

  // Native Browser Fullscreen Bypass to hide Safari URL bar & tabs completely
  const toggleFullscreenMode = async (enable) => {
    const targetState = typeof enable === 'boolean' ? enable : !isFullscreen;
    setIsFullscreen(targetState);

    // Sync native window fullscreen if running in desktop Electron app
    if (window.electronAPI?.setFullScreen) {
      try {
        await window.electronAPI.setFullScreen(targetState);
      } catch (err) {}
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

  // Automatically trigger Cmd+Enter full screen at launch (desktop app + webapp)
  useEffect(() => {
    // 1. Electron Desktop App native window fullscreen
    if (window.electronAPI?.setFullScreen) {
      window.electronAPI.setFullScreen(true).catch(() => {});
    }

    // 2. Web browser: attempt native fullscreen immediately
    const triggerNativeFullscreen = async () => {
      try {
        const elem = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          if (elem.requestFullscreen) {
            await elem.requestFullscreen();
          } else if (elem.webkitRequestFullscreen) {
            await elem.webkitRequestFullscreen();
          }
        }
      } catch (err) {
        // Browser requires a user gesture on initial page load
      }
    };

    triggerNativeFullscreen();

    // 3. Fallback to trigger native browser fullscreen on first user interaction
    const onFirstUserInteraction = () => {
      triggerNativeFullscreen();
    };

    window.addEventListener('click', onFirstUserInteraction, { once: true });
    window.addEventListener('keydown', onFirstUserInteraction, { once: true });
    window.addEventListener('pointerdown', onFirstUserInteraction, { once: true });

    return () => {
      window.removeEventListener('click', onFirstUserInteraction);
      window.removeEventListener('keydown', onFirstUserInteraction);
      window.removeEventListener('pointerdown', onFirstUserInteraction);
    };
  }, []);

  // Sync native fullscreen exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (!isNativeFull && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen]);

  // =========================================================================
  // UNIVERSAL UNDO / REDO HISTORY ENGINE STATE & HANDLERS
  // =========================================================================
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const updateShotsWithHistory = (newShots) => {
    if (isGuestSession() && !canGuestBrowseApp()) return false;
    if (!canEditProjects()) {
      alert('🔒 READ-ONLY ACCESS:\nYour access level is Viewer. You can open allotted projects but cannot edit them. Ask the studio Admin to upgrade you to Editor.');
      return false;
    }
    if (!canAccessProject(projectTitle) && !canCreateOrDeleteProjects()) {
      alert('🔒 ACCESS RESTRICTED:\nThis project is not allotted to your account.');
      return false;
    }
    setHistoryStack(prev => [...prev.slice(-50), shots]);
    setRedoStack([]);
    setShots(newShots);
    try {
      autoSyncProductionSpine({ projectTitle, shots: newShots });
    } catch {
      /* ignore */
    }
    return true;
  };

  const handleUpdateShotsFromScript = (newShots) => {
    const { shots: stamped } = applyProductionAssetSpec({
      projectTitle,
      shots: newShots
    });
    if (updateShotsWithHistory(stamped)) syncToCloud({ shots: stamped, projectTitle });
  };

  const handleUndo = () => {
    if (!canEditProjects()) return;
    if (historyStack.length === 0) return;
    const previousShots = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, historyStack.length - 1);
    
    setRedoStack(prev => [shots, ...prev]);
    setHistoryStack(newHistory);
    setShots(previousShots);
    syncToCloud({ shots: previousShots });
  };

  const handleRedo = () => {
    if (!canEditProjects()) return;
    if (redoStack.length === 0) return;
    const nextShots = redoStack[0];
    const newRedo = redoStack.slice(1);
    
    setHistoryStack(prev => [...prev, shots]);
    setRedoStack(newRedo);
    setShots(nextShots);
    syncToCloud({ shots: nextShots });
  };

  // Keyboard shortcut listener for Cmd+Z (Undo), Cmd+Shift+Z (Redo), Cmd+O (Open Projects), Cmd+Enter (Fullscreen), Esc (Normal View)
  // Note: Cmd/Ctrl+K (Studio Settings) lives in a separate effect near admin state below.
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+O / Ctrl+O -> Open Projects Library Console
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        if (isGuestSession() && !canGuestBrowseApp()) {
          alert(
            '🔒 GUEST ACCESS\n\nSign in to use Projects Console, or turn on Guest Browse in Settings.\n\nRequest access from the studio Admin.'
          );
          setIsProjectConsoleOpen(false);
          setIsInvestorDeckOpen(true);
          return;
        }
        setIsProjectConsoleOpen(true);
        return;
      }

      // Cmd+Enter -> Full Screen View
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreenMode();
        return;
      }

      // Esc -> Normal View (overlays handled in a later effect)
      if (e.key === 'Escape') {
        if (isFullscreen) {
          e.preventDefault();
          toggleFullscreenMode(false);
          return;
        }
      }

      // Cmd+Down Arrow -> Next Shot | Cmd+Up Arrow -> Previous Shot
      if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
        e.preventDefault();
        setActiveShotIndex(prev => Math.min(prev + 1, shots.length - 1));
        return;
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        setActiveShotIndex(prev => Math.max(prev - 1, 0));
        return;
      }

      const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if ((targetTag === 'input' || targetTag === 'textarea') && !e.ctrlKey && !e.metaKey) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (!appShotHistoryShouldHandleUndo(e, activeView)) return;
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (!appShotHistoryShouldHandleUndo(e, activeView)) return;
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStack, redoStack, shots, isFullscreen, activeView]);

  // Cloud & Admin & AI State
  const [roomId, setRoomId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const g = String(params.get('guest') || params.get('look') || '').toLowerCase();
      if (g === '1' || g === 'true' || g === 'yes') return GUEST_PLAY_ROOM;
      const invite = params.get('room');
      if (invite) return invite;
      const savedRoom = localStorage.getItem('sps_current_room_id');
      const title = localStorage.getItem('sps_current_project_title') || '';
      return savedRoom && savedRoom !== LEGACY_SHARED_ROOM
        ? savedRoom
        : roomIdForProject(title, savedRoom);
    }
    return roomIdForProject('untitled');
  });
  // App Version Mode: 'local' (offline) vs 'cloud' (multi-user web sync). Invite ?room= auto-enables cloud.
  const [appVersionMode, setAppVersionMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room')) {
        localStorage.setItem('sps_app_version_mode', 'cloud');
        return 'cloud';
      }
      return localStorage.getItem('sps_app_version_mode') || 'local';
    }
    return 'local';
  });
  const [isAppVersionModalOpen, setIsAppVersionModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !projectTitle) return;
    try {
      if (new URLSearchParams(window.location.search).get('room')) return;
    } catch {
      /* ignore */
    }
    if (roomId && roomId !== LEGACY_SHARED_ROOM) return;
    const next = roomIdForProject(projectTitle);
    setRoomId(next);
    try {
      localStorage.setItem('sps_current_room_id', next);
    } catch {
      /* ignore */
    }
  }, [projectTitle]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onModeChanged = (e) => {
      const mode = e?.detail || localStorage.getItem('sps_app_version_mode') || 'local';
      setAppVersionMode(mode);
    };
    window.addEventListener('sps_app_version_mode_changed', onModeChanged);
    return () => window.removeEventListener('sps_app_version_mode_changed', onModeChanged);
  }, []);

  const handleSelectAppVersionMode = async (mode) => {
    setAppVersionMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_app_version_mode', mode);
      window.dispatchEvent(new CustomEvent('sps_app_version_mode_changed', { detail: mode }));
      if (mode === 'cloud') {
        // Auto-upload & sync local vault images to cloud database payload
        await syncCanvasVaultToCloud(roomId, projectTitle);
        const vault = getStoredCanvasVaultImages();
        syncToCloud({ shots, projectGeneratedImages: vault });
      }
    }
  };

  const [characterBibleTab, setCharacterBibleTab] = useState('roster'); // 'roster' | 'character_sheet'
  const [isWorldEnvironmentOpen, setIsWorldEnvironmentOpen] = useState(false);
  const [writerConsoleTab, setWriterConsoleTab] = useState('screenplay'); // 'screenplay' | 'synopsis' | 'breakdown'

  const handleOpenCharactersModal = (tab = 'roster') => {
    const next = tab === 'character_sheet' ? 'character_sheet' : 'roster';
    setCharacterBibleTab(next);
    setHeaderMinimized(false);
    setActiveView('cast');
  };

  const handleOpenWorldEnvironment = () => {
    setIsWorldEnvironmentOpen(true);
  };

  const openWriterConsole = (tab = 'screenplay') => {
    const next =
      tab === 'synopsis' ? 'synopsis' : tab === 'breakdown' ? 'breakdown' : 'screenplay';
    setWriterConsoleTab(next);
    setActiveView('screenplay');
  };

  useEffect(() => {
    const applyHome = (home) => {
      if (!home || typeof home !== 'object') return;
      setHeaderMinimized(false);
      if (home.open === 'projects' || home.modal === 'projects') {
        setProjectConsoleInitialTab(home.tab || 'library');
        setIsInvestorDeckOpen(false);
        setIsProjectConsoleOpen(true);
        // Project Console hides the header — always surface Shift+Space tip after login
        window.setTimeout(() => openNavigatorShortcutHelp(), 650);
      }
      let view = home.view || 'spreadsheet';
      if (view === 'canvas' && !showCanvasTab) view = 'spreadsheet';
      if (view === 'screenplay') {
        openWriterConsole('screenplay');
      } else if (view === 'spreadsheet' || view === 'form' || view === 'canvas') {
        setActiveView(view);
      }
      if (home.modal === 'cast') handleOpenCharactersModal();
      if (home.modal === 'world') handleOpenWorldEnvironment();
    };

    const onLoginHome = (e) => applyHome(e.detail);
    window.addEventListener('sps_login_home', onLoginHome);
    try {
      const raw = sessionStorage.getItem('sps_login_home');
      if (raw) {
        sessionStorage.removeItem('sps_login_home');
        applyHome(JSON.parse(raw));
      }
    } catch {
      /* ignore */
    }
    return () => window.removeEventListener('sps_login_home', onLoginHome);
  }, [showCanvasTab]);

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminModalTab, setAdminModalTab] = useState('all');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isStudioBrainOpen, setIsStudioBrainOpen] = useState(false);
  const [isProductionDashboardOpen, setIsProductionDashboardOpen] = useState(false);
  const [isLlmCommandReviewOpen, setIsLlmCommandReviewOpen] = useState(false);
  const [isInvestorDeckOpen, setIsInvestorDeckOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginInitialMode, setLoginInitialMode] = useState('signin');
  const [isDesktopTrialOpen, setIsDesktopTrialOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const trial = String(params.get('trial') || params.get('download') || '').toLowerCase();
    if (trial === '1' || trial === 'true' || trial === 'desktop') {
      setIsDesktopTrialOpen(true);
    }
  }, []);
  const [loginOverlayMode, setLoginOverlayMode] = useState('default');
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (isNavigatorOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsNavigatorOpen(false);
        return;
      }
      if (isCompilerOpen || isAdminModalOpen || isHelpModalOpen || isLoginModalOpen) return;
      if (isGenerateDeskOpen) {
        e.preventDefault();
        setIsGenerateDeskOpen(false);
        return;
      }
      if (isFeatureReelOpen) {
        e.preventDefault();
        setIsFeatureReelOpen(false);
        return;
      }
      if (isStudioBrainOpen) {
        e.preventDefault();
        setIsStudioBrainOpen(false);
        return;
      }
      if (isProductionDashboardOpen) {
        e.preventDefault();
        setIsProductionDashboardOpen(false);
        return;
      }
      if (isLlmCommandReviewOpen) {
        e.preventDefault();
        setIsLlmCommandReviewOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [
    isNavigatorOpen,
    isCompilerOpen,
    isAdminModalOpen,
    isHelpModalOpen,
    isLoginModalOpen,
    isGenerateDeskOpen,
    isFeatureReelOpen,
    isStudioBrainOpen,
    isProductionDashboardOpen,
    isLlmCommandReviewOpen
  ]);

  const [activeConflict, setActiveConflict] = useState(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  // Always start logged-out in UI unless this browser tab already completed login (HMR-safe)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      purgeWeakAdminCredentials();
      try {
        if (
          sessionStorage.getItem('sps_session_authed') === '1' &&
          localStorage.getItem('sps_user_manually_logged_out') !== 'true'
        ) {
          const email = getCurrentUserEmail();
          if (email && isStudioAdmin(email)) {
            localStorage.setItem('sps_is_admin_logged_in', 'true');
            return true;
          }
        }
      } catch {
        /* ignore */
      }
      localStorage.setItem('sps_is_admin_logged_in', 'false');
    }
    return false;
  });

  const handleSetAdminLoggedIn = (val) => {
    if (typeof window !== 'undefined' && val) {
      const email = getCurrentUserEmail();
      // Only primary studio admin sessions may hold the admin flag
      if (email && !isStudioAdmin(email)) {
        setIsAdminLoggedIn(false);
        localStorage.setItem('sps_is_admin_logged_in', 'false');
        return;
      }
      if (!email) {
        markCollaboratorSession('admin@stageworkstudio.com');
      }
      try {
        sessionStorage.setItem('sps_session_authed', '1');
      } catch {
        /* ignore */
      }
    }
    setIsAdminLoggedIn(Boolean(val));
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_is_admin_logged_in', val ? 'true' : 'false');
      if (!val) {
        try {
          sessionStorage.removeItem('sps_session_authed');
        } catch {
          /* ignore */
        }
      }
    }
  };

  useEffect(() => {
    let applying = false;
    const applyPlay = () => {
      if (applying) return;
      if (!canGuestBrowseApp()) return;
      applying = true;
      try {
        const play = getGuestPlayProject();
        let nextShots = play.shots;
        try {
          const saved = JSON.parse(sessionStorage.getItem('sps_guest_play_shots') || 'null');
          if (Array.isArray(saved) && saved.length) nextShots = saved;
        } catch {
          /* ignore */
        }
        setProjectTitle(play.title);
        setShots(nextShots);
        setTargetModel(play.targetModel);
        setAspectRatio(play.aspectRatio);
        setRoomId(GUEST_PLAY_ROOM);
        setActiveShotIndex(0);
        if (play.genreKey) setPresetProfile(play.genreKey);
      } finally {
        applying = false;
      }
    };
    applyPlay();
    window.addEventListener('sps_guest_browse_changed', applyPlay);
    return () => window.removeEventListener('sps_guest_browse_changed', applyPlay);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateGuestUrlFromServer();
      if (cancelled) return;
      if (!consumeGuestLookFromUrl()) return;
      setIsLoginModalOpen(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If splash was skipped (same tab / HMR), restore remembered session — don't re-trap user in login
  useEffect(() => {
    if (showSplash) return;
    try {
      if (sessionStorage.getItem('sps_login_prompted') === '1') return;
      sessionStorage.setItem('sps_login_prompted', '1');
      if (consumeGuestLookFromUrl() || canGuestBrowseApp()) {
        enterGuestLookSession();
        setIsLoginModalOpen(false);
        return;
      }
      if (sessionStorage.getItem('sps_session_authed') === '1') return;
      if (localStorage.getItem('sps_user_manually_logged_out') === 'true') {
        setIsLoginModalOpen(true);
        return;
      }
      const email = getCurrentUserEmail();
      if (email) {
        sessionStorage.setItem('sps_session_authed', '1');
        if (isStudioAdmin(email)) {
          setIsAdminLoggedIn(true);
          localStorage.setItem('sps_is_admin_logged_in', 'true');
        }
        return;
      }
    } catch {
      /* ignore */
    }
    setIsLoginModalOpen(true);
  }, [showSplash]);

  useEffect(() => {
    const email = getCurrentUserEmail();
    if (!email || isGuestSession()) return undefined;
    const tick = () => {
      const gate = heartbeat(email);
      if (!gate.ok) {
        try {
          sessionStorage.removeItem('sps_session_authed');
          localStorage.setItem('sps_user_manually_logged_out', 'true');
        } catch {
          /* ignore */
        }
        setIsLoginModalOpen(true);
        return;
      }
      fetch('/api/saas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat', email, deviceId: getDeviceId() }),
      }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (data?.license?.apiMode === 'managed' && typeof data.license.credits === 'number') {
          upsertLicense(email, {
            credits: data.license.credits,
            plan: data.license.plan || undefined,
            status: data.license.status,
          }, { silent: true });
        }
      }).catch(() => {});
    };
    tick();
    const t = setInterval(tick, 60000);
    const onSaas = (e) => {
      if (e?.detail?.forceLogout || e?.detail?.creditRefresh) tick();
    };
    window.addEventListener('sps_saas_changed', onSaas);
    return () => {
      clearInterval(t);
      window.removeEventListener('sps_saas_changed', onSaas);
    };
  }, []);

  useEffect(() => {
    const onStoryPackage = () => {
      try {
        autoSyncProductionSpine({ projectTitle, shots, force: true });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('sps_story_package_updated', onStoryPackage);
    return () => window.removeEventListener('sps_story_package_updated', onStoryPackage);
  }, [projectTitle, shots]);

  // Cmd+K / Ctrl+K → Studio Settings (AdminSettingsModal, All Settings tab)
  // Same access rules as the Header Settings gear (alert + login if not admin).
  useEffect(() => {
    let lastOpenAt = 0;
    const openStudioSettings = () => {
      const now = Date.now();
      if (now - lastOpenAt < 400) return;
      lastOpenAt = now;
      if (isGuestSession()) {
        alert(
          '🔒 GUEST ACCESS\n\nSettings require a signed-in collaborator or studio admin.\n\nOpen the Investor Deck, request access, or log in.'
        );
        setIsAdminModalOpen(false);
        setIsInvestorDeckOpen(true);
        return;
      }
      if (!isAdminLoggedIn) {
        alert('🔒 ACCESS RESTRICTED:\nOnly the studio admin can open Admin Settings (create users, allot projects, delete projects).');
        setIsLoginModalOpen(true);
        return;
      }
      setAdminModalTab('all');
      setIsAdminModalOpen(true);
    };

    const handleKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k' || e.altKey || e.shiftKey) return;
      if (e.defaultPrevented) return;
      e.preventDefault();
      openStudioSettings();
    };

    const onMenuOpen = () => openStudioSettings();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('sps_open_studio_settings', onMenuOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('sps_open_studio_settings', onMenuOpen);
    };
  }, [isAdminLoggedIn]);

  useEffect(() => {
    const onNavKey = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      setIsNavigatorOpen((open) => !open);
    };
    window.addEventListener('keydown', onNavKey, true);
    return () => window.removeEventListener('keydown', onNavKey, true);
  }, []);

  useEffect(() => {
    const isTypingTarget = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return Boolean(el.closest?.('[contenteditable="true"]'));
    };
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    let edge = null;
    let two = null;

    const onStart = (e) => {
      if (!e.touches?.length) return;
      if (e.touches.length === 2) {
        edge = null;
        two = {
          t: Date.now(),
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          span: dist(e.touches[0], e.touches[1]),
        };
        return;
      }
      two = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const fromLeft = t.clientX <= 28 + (window.visualViewport?.offsetLeft || 0);
      if (!fromLeft || isTypingTarget(e.target)) {
        edge = null;
        return;
      }
      edge = { x: t.clientX, y: t.clientY, fired: false };
    };

    const onMove = (e) => {
      if (two && e.touches.length === 2) {
        const span = dist(e.touches[0], e.touches[1]);
        if (Math.abs(span - two.span) > 36) two = null;
        return;
      }
      if (!edge || edge.fired || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - edge.x;
      const dy = t.clientY - edge.y;
      if (dx > 56 && Math.abs(dy) < 72 && dx > Math.abs(dy) * 1.15) {
        edge.fired = true;
        setIsNavigatorOpen(true);
      }
    };

    const onEnd = (e) => {
      if (two && e.touches.length === 0) {
        const elapsed = Date.now() - two.t;
        if (elapsed < 420) {
          const last = e.changedTouches?.[0];
          const moved = last
            ? Math.hypot(last.clientX - two.x, last.clientY - two.y)
            : 0;
          if (moved < 90) setIsNavigatorOpen((open) => !open);
        }
      }
      if (edge && !edge.fired && e.changedTouches?.[0]) {
        const t = e.changedTouches[0];
        const dx = t.clientX - edge.x;
        const dy = t.clientY - edge.y;
        if (dx < -48 && Math.abs(dy) < 80) setIsNavigatorOpen(false);
      }
      if (!e.touches?.length) {
        edge = null;
        two = null;
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const enforceAccessibleActiveProject = (preferredTitle = '') => {
    if (typeof window === 'undefined') return;
    const email = getCurrentUserEmail();
    if (!email || isStudioAdmin(email)) return;

    let library = [];
    try {
      library = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
    } catch (e) {
      library = [];
    }
    if (!Array.isArray(library)) library = [];

    const visible = filterAccessibleProjects(library, email);
    const want = String(preferredTitle || projectTitle || localStorage.getItem('sps_current_project_title') || '').trim();
    const match =
      visible.find((p) => String(p?.title || '').toLowerCase() === want.toLowerCase()) ||
      visible[0] ||
      null;

    if (!match) {
      setProjectTitle('');
      setShots([]);
      safeLocalStorageSetItem('sps_current_project_title', '');
      safeLocalStorageSetItem('sps_current_shots', '[]');
      return;
    }

    if (String(match.title) !== String(projectTitle)) {
      setProjectTitle(match.title);
      if (Array.isArray(match.shots)) setShots(match.shots);
      if (match.targetModel) setTargetModel(match.targetModel);
      if (match.aspectRatio) setAspectRatio(match.aspectRatio);
      if (match.roomId) setRoomId(match.roomId);
      safeLocalStorageSetItem('sps_current_project_title', match.title);
      if (Array.isArray(match.shots)) {
        safeLocalStorageSetItem('sps_current_shots', JSON.stringify(match.shots));
      }
    }
  };
  const [currentRole, setCurrentRole] = useState('director');
  const [collaborators, setCollaborators] = useState([
    { name: 'Director (You)', role: '🎬 Director' },
    { name: 'DP Lead', role: '🎥 Cinematographer' },
    { name: 'Lighting Tech', role: '💡 Lighting Lead' }
  ]);
  const [activeRemoteUsers, setActiveRemoteUsers] = useState([]);
  const [allLiveUsers, setAllLiveUsers] = useState([]);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isCollabChatOpen, setIsCollabChatOpen] = useState(() => {
    try {
      return localStorage.getItem('sps_collab_chat_open') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem('sps_collab_chat_open', isCollabChatOpen ? 'true' : 'false');
    } catch (e) {}
  }, [isCollabChatOpen]);

  // Local vault may keep a project-scoped key; cloud collab always uses invite roomId only.
  // One collab room per film — never dump every project into SPS-CLOUD-8821
  const effectiveRoomId = roomIdForProject(projectTitle, roomId);
  const lastSyncedHash = React.useRef('');
  const prevAutoSavedShotsRef = React.useRef('');
  const isReceivingCloudUpdate = React.useRef(false);
  const electronMenuRef = React.useRef({});
  const shotsRef = React.useRef(shots);
  const activeShotIndexRef = React.useRef(activeShotIndex);
  const projectTitleRef = React.useRef(projectTitle);

  // Electron native menu event listeners (macOS Menu Bar integration)
  useEffect(() => {
    const handlers = {
      'sps_save_project': () => electronMenuRef.current.saveProject?.(),
      'sps_export_project': () => electronMenuRef.current.exportProject?.(),
      'sps_import_project': () => {
        if (!canCreateOrDeleteProjects()) {
          alert('🔒 ACCESS RESTRICTED:\nOnly the studio Admin can import projects.');
          return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => electronMenuRef.current.importProject?.(e);
        input.click();
      },
      'sps_new_project': () => {
        if (!canCreateOrDeleteProjects()) {
          alert('🔒 ACCESS RESTRICTED:\nOnly the studio Admin can create projects. Open Project Console to edit an allotted project.');
          return;
        }
        electronMenuRef.current.openNewProject?.();
      },
      'sps_open_help': () => setIsHelpModalOpen(true),
      'sps_set_view': (e) => {
        const view = e.detail;
        if (view && typeof view === 'string') setActiveView(view);
      },
    };

    Object.entries(handlers).forEach(([evt, fn]) => window.addEventListener(evt, fn));
    return () => {
      Object.entries(handlers).forEach(([evt, fn]) => window.removeEventListener(evt, fn));
    };
  }, []);

  // Automatic Vault & Projects Restoration on App Mount (Local & Cloud Modes)
  useEffect(() => {
    const autoRestoreAppVault = async () => {
      // 0. Hydrate Studio Brain from IndexedDB
      try {
        await hydrateStudioBrainFromDisk();
      } catch (e) {}

      // 0b. P103 — migrate dual screenplay keys → SoT
      try {
        migrateOpenScreenplayToSoT();
      } catch (e) {}

      // 0c. Image blob cache for idb: poster refs
      try {
        await hydrateImageBlobStore();
      } catch (e) {}

      // 1. Auto-Restore App Settings & API Keys from persistent IndexedDB vault
      await autoRestoreAppSettingsFromVault();

      // 2. Check if current shots or projects are missing/default, and restore from Vault
      const vaultProjects = await loadProjectsFromVault();
      const diskActive = await loadActiveWorkspaceFromDisk();
      if (Array.isArray(vaultProjects) && vaultProjects.length > 0) {
        const currentLib = readLocalProjectLibrary();
        const cleanedMerged = filterOutDeletedProjects(
          mergeLibrarySources({ local: currentLib, vault: vaultProjects })
        );
        // Always write merged library so Electron + browser stay aligned via disk SoT
        writeLocalProjectLibrary(cleanedMerged);
        window.dispatchEvent(new Event('sps_projects_updated'));

        // Restore the last OPEN film only — never fall back to another title
        const savedShotsStr = localStorage.getItem('sps_current_shots');
        let localShots = [];
        if (savedShotsStr) {
          try { localShots = JSON.parse(savedShotsStr); } catch (e) {}
        }

        // Prefer an accessible project for the current user (collaborators: allotted only)
        const email = getCurrentUserEmail();
        const visible = filterAccessibleProjects(cleanedMerged, email);
        // Freshest active pointer — local session beats stale disk after folder import
        const savedTitle =
          resolveActiveTitleForBoot(diskActive) ||
          localStorage.getItem('sps_current_project_title') ||
          '';
        const preferred =
          visible.find((p) => titlesMatch(p?.title, savedTitle)) ||
          (isStudioAdmin(email) && savedTitle
            ? cleanedMerged.find((p) => titlesMatch(p?.title, savedTitle))
            : null);

        if (preferred) {
          const localIsSameFilm = titlesMatch(savedTitle, preferred.title);
          const localEmpty = !localShots || localShots.length === 0;
          const diskForcesSwitch =
            diskActive?.title && titlesMatch(diskActive.title, preferred.title) && !localIsSameFilm;
          let openProj = preferred;
          if (!openProj.shots?.length) {
            const fullDisk = await loadProjectFromDiskByTitle(preferred.title);
            if (fullDisk?.shots?.length) openProj = fullDisk;
          }
          if (openProj?.shots?.length && (localEmpty || !localIsSameFilm || diskForcesSwitch)) {
            setShots(openProj.shots);
            setProjectTitle(openProj.title);
            if (openProj.targetModel) setTargetModel(openProj.targetModel);
            if (openProj.aspectRatio) setAspectRatio(openProj.aspectRatio);
            if (openProj.roomId) setRoomId(roomIdForProject(openProj.title, openProj.roomId));
            applyOpenWorkspace(openProj);
            safeLocalStorageSetItem('sps_current_shots', JSON.stringify(openProj.shots));
            safeLocalStorageSetItem('sps_current_project_title', openProj.title);
            safeLocalStorageSetItem('sps_current_room_id', roomIdForProject(openProj.title, openProj.roomId));
          }
          if (openProj?.title) {
            saveActiveWorkspaceToDisk({
              title: openProj.title,
              roomId: roomIdForProject(openProj.title, openProj.roomId)
            }).catch(() => {});
          }
        } else if (email && !isStudioAdmin(email)) {
          enforceAccessibleActiveProject(savedTitle);
        }
      }

      // 3. Do NOT auto-login / skip LoginModal when a remembered email exists.
      // Splash onFinish always opens LoginModal so the user can pick Email / Admin / Guest.
      // Remembered email stays in localStorage for LoginModal prefilling only.
      setIsAdminLoggedIn(false);
      localStorage.setItem('sps_is_admin_logged_in', 'false');
    };

    autoRestoreAppVault();
  }, []);

  // Re-sync library + active film from shared disk when window gains focus
  // (browser localhost and Electron use separate Chromium storage partitions)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let busy = false;
    const syncFromDisk = async () => {
      if (busy || isGuestSession()) return;
      busy = true;
      try {
        const vaultProjects = await loadProjectsFromVault();
        const diskActive = await loadActiveWorkspaceFromDisk();
        if (!Array.isArray(vaultProjects) || !vaultProjects.length) return;
        const currentLib = readLocalProjectLibrary();
        const cleanedMerged = filterOutDeletedProjects(
          mergeLibrarySources({ local: currentLib, vault: vaultProjects })
        );
        writeLocalProjectLibrary(cleanedMerged);
        window.dispatchEvent(new Event('sps_projects_updated'));

        const wantTitle = String(diskActive?.title || '').trim();
        if (!wantTitle) return;
        const openTitle = projectTitleRef.current || localStorage.getItem('sps_current_project_title') || '';
        if (titlesMatch(wantTitle, openTitle)) return;
        const localAt = Date.parse(localStorage.getItem('sps_active_workspace_at') || 0) || 0;
        const diskAt = Date.parse(diskActive?.updatedAt || 0) || 0;
        if (localAt && diskAt && diskAt < localAt) return;
        const preferred = cleanedMerged.find((p) => titlesMatch(p?.title, wantTitle));
        if (!preferred) return;
        let openProj = preferred;
        if (!openProj.shots?.length) {
          const fullDisk = await loadProjectFromDiskByTitle(wantTitle);
          if (fullDisk?.shots?.length) openProj = fullDisk;
        }
        if (!openProj?.shots?.length) return;
        setShots(openProj.shots);
        setProjectTitle(openProj.title);
        if (openProj.targetModel) setTargetModel(openProj.targetModel);
        if (openProj.aspectRatio) setAspectRatio(openProj.aspectRatio);
        if (openProj.roomId) setRoomId(roomIdForProject(openProj.title, openProj.roomId));
        applyOpenWorkspace(openProj);
        safeLocalStorageSetItem('sps_current_shots', JSON.stringify(openProj.shots));
        safeLocalStorageSetItem('sps_current_project_title', openProj.title);
        safeLocalStorageSetItem('sps_current_room_id', roomIdForProject(openProj.title, openProj.roomId));
      } catch {
        /* ignore */
      } finally {
        busy = false;
      }
    };
    const onFocus = () => {
      syncFromDisk();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncFromDisk();
    });
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Keep admin flag + active project aligned when profiles/allotments change
  useEffect(() => {
    const syncSessionRights = () => {
      const email = getCurrentUserEmail();
      if (!email) {
        setIsAdminLoggedIn(false);
        return;
      }
      markCollaboratorSession(email);
      setIsAdminLoggedIn(isStudioAdmin(email));
      if (!isStudioAdmin(email)) enforceAccessibleActiveProject();
    };
    window.addEventListener('sps_collaborators_updated', syncSessionRights);
    window.addEventListener('storage', syncSessionRights);
    return () => {
      window.removeEventListener('sps_collaborators_updated', syncSessionRights);
      window.removeEventListener('storage', syncSessionRights);
    };
  }, []);

  useEffect(() => {
    hydrateImageBlobStore();
  }, []);

  // Local Storage & Library Persistence — debounced so Matrix typing does not rewrite the library every key.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const timer = setTimeout(async () => {
      if (isGuestSession()) {
        try {
          sessionStorage.setItem('sps_guest_play_shots', JSON.stringify(shots));
          sessionStorage.setItem('sps_guest_play_title', projectTitle);
        } catch {
          /* ignore */
        }
        return;
      }
      const persistableShots = await offloadShotMedia(shots);
      safeLocalStorageSetItem('sps_current_shots', JSON.stringify(persistableShots));
      safeLocalStorageSetItem('sps_current_project_title', projectTitle);
      safeLocalStorageSetItem('sps_current_target_model', targetModel);
      safeLocalStorageSetItem('sps_current_aspect_ratio', aspectRatio);
      safeLocalStorageSetItem('sps_active_view', activeView);
      safeLocalStorageSetItem('sps_active_shot_index', String(activeShotIndex));

      if (projectTitle && Array.isArray(persistableShots) && persistableShots.length > 0) {
        try {
          if (isProjectTitleDeleted(projectTitle)) {
            clearDeletedProjectTitles([projectTitle]);
          }
          if (!canAccessProject(projectTitle)) return;
          const savedLibStr = localStorage.getItem('sps_project_library');
          let library = savedLibStr ? JSON.parse(savedLibStr) : [];
          if (!Array.isArray(library)) library = [];
          library = filterOutDeletedProjects(library);

          const existingIdx = library.findIndex(p => p.title === projectTitle);
          if (existingIdx === -1 && !canCreateOrDeleteProjects()) return;

          const extras = collectOpenWorkspace();
          const updatedProjectData = {
            id: existingIdx !== -1 ? library[existingIdx].id : `proj_${Date.now()}`,
            title: projectTitle,
            description: `Cinema Production Studio Project with ${persistableShots.length} shots`,
            targetModel: targetModel || 'SPS Direct Cinema 2.0',
            aspectRatio: aspectRatio || '2.39:1 Anamorphic',
            roomId: roomIdForProject(projectTitle, effectiveRoomId),
            lastModified: new Date().toLocaleDateString(),
            lastModifiedIso: new Date().toISOString(),
            shots: persistableShots,
            ...extras
          };
          safeLocalStorageSetItem('sps_current_room_id', updatedProjectData.roomId);

          if (existingIdx !== -1) {
            library[existingIdx] = { ...library[existingIdx], ...updatedProjectData };
          } else {
            library.unshift(updatedProjectData);
          }

          safeLocalStorageSetItem('sps_project_library', JSON.stringify(filterOutDeletedProjects(library)));
          learnFromProject({
            projectTitle,
            shots: persistableShots,
            genreKey: presetProfile,
            aspectRatio,
            targetModel
          });
        } catch (e) {}
      }
    }, 420);
    return () => clearTimeout(timer);
  }, [shots, projectTitle, targetModel, aspectRatio, activeView, activeShotIndex, effectiveRoomId, presetProfile]);

  // Hydrate projects & collaborators from Vercel cloud (source of truth) on every open.
  // Local disk/localStorage RECEIVES from cloud; do not echo-push stale local back.
  useEffect(() => {
    let cancelled = false;

    fetchProjectLibraryFromCloud().then(async (projs) => {
      if (cancelled) return;
      if (isGuestSession()) return;
      // Undo false archive/tombstone for the project currently open
      const healed = healActiveProjectFromArchive();
      let updatedProjs = Array.isArray(projs)
        ? projs.filter((p) => p && p.title && String(p.title).trim().toUpperCase() !== 'STAGE PRODUCTION STUDIO')
        : [];
      updatedProjs = filterOutDeletedProjects(updatedProjs);

      if (healed?.title) {
        const key = String(healed.title).trim().toUpperCase();
        updatedProjs = [
          healed,
          ...updatedProjs.filter((p) => String(p?.title || '').trim().toUpperCase() !== key)
        ];
      }

      // Self-heal active project into library for UI — clear stale tombstone if needed
      const activeTitle =
        projectTitle && typeof projectTitle === 'string' && projectTitle.toUpperCase() !== 'STAGE PRODUCTION STUDIO'
          ? projectTitle
          : '';
      if (activeTitle && shots && shots.length > 0) {
        if (isProjectTitleDeleted(activeTitle)) clearDeletedProjectTitles([activeTitle]);
        const exists = updatedProjs.some((p) => p.title === activeTitle);
        if (!exists) {
          updatedProjs = [
            {
              id: `proj_${Date.now()}`,
              title: activeTitle,
              description: `Cinema Production Studio Project with ${shots.length} shots`,
              targetModel: targetModel || 'SPS Direct Cinema 2.0',
              aspectRatio: aspectRatio || '2.39:1 Anamorphic',
              roomId: roomIdForProject(activeTitle, effectiveRoomId),
              lastModified: new Date().toLocaleDateString(),
              shots: shots,
            },
            ...updatedProjs,
          ];
        }
      }

      const localLib = (() => {
        try {
          return JSON.parse(localStorage.getItem('sps_project_library') || '[]');
        } catch {
          return [];
        }
      })();
      let mergedCloud = mergeLibrarySources({ local: localLib, cloud: updatedProjs });
      try {
        const { enrichLibraryWithDiskVault } = await import('./utils/projectWorkspace');
        mergedCloud = filterOutDeletedProjects(await enrichLibraryWithDiskVault(mergedCloud));
      } catch {
        mergedCloud = filterOutDeletedProjects(mergedCloud);
      }
      writeLocalProjectLibrary(mergedCloud);
      window.dispatchEvent(new Event('sps_projects_updated'));
      if (healed || (activeTitle && mergedCloud.some((p) => titlesMatch(p.title, activeTitle)))) {
        syncProjectLibraryToCloud(mergedCloud);
      }

      const openTitle = projectTitle;
      const activeProj = mergedCloud.find((p) => titlesMatch(p.title, openTitle));
      if (activeProj && Array.isArray(activeProj.shots) && activeProj.shots.length > 0) {
        const localN = Array.isArray(shots) ? shots.length : 0;
        const cloudN = activeProj.shots.length;
        if (cloudN >= localN) {
          const cloudHash = JSON.stringify({
            shots: activeProj.shots,
            projectTitle: activeProj.title,
            targetModel: activeProj.targetModel || targetModel,
            aspectRatio: activeProj.aspectRatio || aspectRatio,
          });
          lastSyncedHash.current = cloudHash;
          isReceivingCloudUpdate.current = true;
          setShots(activeProj.shots);
          applyOpenWorkspace(activeProj);
          if (activeProj.targetModel) setTargetModel(activeProj.targetModel);
          if (activeProj.aspectRatio) setAspectRatio(activeProj.aspectRatio);
          localStorage.setItem('sps_current_shots', JSON.stringify(activeProj.shots));
          setTimeout(() => {
            isReceivingCloudUpdate.current = false;
          }, 400);
        }
      }
    }).catch(() => {});

    fetchCollaboratorsFromCloud()
      .then(() => {
        if (!cancelled) window.dispatchEvent(new Event('sps_collaborators_updated'));
      })
      .catch(() => {});

    // Live cloud polls — keep library / allotments fresh without full reload
    const unsubLib = subscribeToProjectLibraryUpdates(() => {
      if (!cancelled) window.dispatchEvent(new Event('sps_projects_updated'));
    });
    const unsubCollab = subscribeToCollaboratorUpdates(() => {
      if (!cancelled) window.dispatchEvent(new Event('sps_collaborators_updated'));
    });

    return () => {
      cancelled = true;
      unsubLib();
      unsubCollab();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / mode change hydrate only
  }, [appVersionMode]);

  // Auto-Save Active Project to Physical Hard Drive Folder (/Users/pedditiram/Documents/PROMPT ENGINEERING/projects/)
  useEffect(() => {
    if (isGuestSession()) return;
    if (!shots || shots.length === 0 || !projectTitle) return;

    const currentShotsHash = JSON.stringify({ projectTitle, targetModel, aspectRatio, shots });
    if (currentShotsHash === prevAutoSavedShotsRef.current) return; // Prevent duplicate infinite re-renders!
    
    prevAutoSavedShotsRef.current = currentShotsHash;

    const safeTitle = (projectTitle == null ? '' : String(projectTitle));
    const roots = normalizeAssetRoots(readAssetRootsFromLibrary(projectTitle));
    const activeProj = attachWorkspaceToProject({
      id: `proj_${safeTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      title: projectTitle,
      description: `Cinema Production Studio Project with ${shots.length} shots`,
      targetModel: targetModel || 'SPS Direct Cinema 2.0',
      aspectRatio: aspectRatio || '2.39:1 Anamorphic',
      roomId: roomIdForProject(projectTitle, effectiveRoomId),
      lastModified: new Date().toLocaleString(),
      shots: shots,
      assetRoots: roots,
      projectVersion: roots.projectVersion
    });
    saveProjectToVault(activeProj);
    saveActiveWorkspaceToDisk({
      title: projectTitle,
      roomId: roomIdForProject(projectTitle, effectiveRoomId)
    }).catch(() => {});
  }, [shots, projectTitle, targetModel, aspectRatio, effectiveRoomId]);

  // Cloud room sync always on — Local badge is storage preference; Vercel is SoT
  useEffect(() => {
    if (isGuestSession()) return undefined;
    if (!effectiveRoomId) return;
    const unsubscribe = subscribeToCloudRoom(
      effectiveRoomId,
      (cloudData) => {
      if (cloudData && cloudData.shots && Array.isArray(cloudData.shots)) {
        const openTitle = projectTitleRef.current;
        if (cloudData.projectTitle && openTitle && !titlesMatch(cloudData.projectTitle, openTitle)) {
          return;
        }
        const nextTitle = cloudData.projectTitle || openTitle;
        const cloudHash = JSON.stringify({ 
          shots: cloudData.shots, 
          projectTitle: nextTitle, 
          targetModel: cloudData.targetModel || targetModel, 
          aspectRatio: cloudData.aspectRatio || aspectRatio 
        });

        // Only update local state if cloud data differs from what we last applied/published
        if (cloudHash !== lastSyncedHash.current) {
          isReceivingCloudUpdate.current = true;
          lastSyncedHash.current = cloudHash;
          prevAutoSavedShotsRef.current = cloudHash;
          setShots(cloudData.shots);
          if (cloudData.projectTitle) {
            setProjectTitle(cloudData.projectTitle);
            localStorage.setItem('sps_current_project_title', cloudData.projectTitle);
          }
          if (cloudData.targetModel) setTargetModel(cloudData.targetModel);
          if (cloudData.aspectRatio) setAspectRatio(cloudData.aspectRatio);
          if (cloudData.projectGeneratedImages && typeof cloudData.projectGeneratedImages === 'object') {
            safeLocalStorageSetItem('sps_generated_images_map', JSON.stringify(cloudData.projectGeneratedImages));
            window.dispatchEvent(new CustomEvent('sps_cloud_images_updated', { detail: cloudData.projectGeneratedImages }));
          }
          localStorage.setItem('sps_current_shots', JSON.stringify(cloudData.shots));
          setTimeout(() => { isReceivingCloudUpdate.current = false; }, 500);
        }
      }
    },
      projectTitleRef.current
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [effectiveRoomId]);

  // -------------------------------------------------------------
  // REAL-TIME SLOT PRESENCE BROADCASTING & CONFLICT DETECTION
  // -------------------------------------------------------------
  useEffect(() => {
    shotsRef.current = shots;
    activeShotIndexRef.current = activeShotIndex;
    projectTitleRef.current = projectTitle;
  });

  // Presence always publishes when logged in + room (works in Local UI mode too)
  useEffect(() => {
    if (typeof window === 'undefined' || !effectiveRoomId) return;
    const currentUserEmail = localStorage.getItem('sps_authorized_user_email');
    if (!currentUserEmail) return;

    const publishPresence = (isEditing = false) => {
      const activeShot = shotsRef.current[activeShotIndexRef.current];
      if (activeShot && activeShot.sceneShotId) {
        broadcastActiveSlotEditing(
          currentUserEmail,
          currentUserEmail.split('@')[0],
          projectTitleRef.current,
          activeShot.sceneShotId,
          isEditing,
          effectiveRoomId
        );
        auditPresenceIfChanged({
          projectTitle: projectTitleRef.current,
          userEmail: currentUserEmail,
          shotId: activeShot.sceneShotId,
          roomId: effectiveRoomId,
          isEditing
        });
      }
    };

    publishPresence(false);
    notifyStudioOnlineWhatsApp({
      userEmail: currentUserEmail,
      userName: currentUserEmail.split('@')[0],
      projectTitle: projectTitleRef.current,
      roomId: effectiveRoomId
    });
    const heartbeat = setInterval(() => publishPresence(false), 20000);
    return () => clearInterval(heartbeat);
  }, [activeShotIndex, projectTitle, effectiveRoomId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !effectiveRoomId) {
      setActiveRemoteUsers([]);
      return;
    }
    const currentUserEmail = localStorage.getItem('sps_authorized_user_email') || 'unauthenticated';
    const unsubPresence = subscribeToActiveEditingSlots(currentUserEmail, (otherActiveUsers) => {
      const everyone = otherActiveUsers || [];
      setAllLiveUsers(everyone);
      const sameProjectUsers = everyone.filter((u) => {
        const sameProject = !u.projectTitle || u.projectTitle === projectTitleRef.current;
        const sameRoom = !u.roomId || !effectiveRoomId || u.roomId === effectiveRoomId;
        return sameProject && sameRoom;
      });
      setActiveRemoteUsers(sameProjectUsers);
      auditPeerPresenceDiff({
        projectTitle: projectTitleRef.current,
        roomId: effectiveRoomId,
        peers: sameProjectUsers
      });

      // Keep collaborator chip list in sync with live presence
      setCollaborators((prev) => {
        const locals = prev.filter((c) => !c.isRemote);
        const remotes = sameProjectUsers.map((u) => {
          const name = u.userName || (u.userEmail || '').split('@')[0] || 'Collaborator';
          return {
            name,
            email: u.userEmail,
            role: u.isEditing ? `Editing ${u.activeShotId}` : `On ${u.activeShotId || 'project'}`,
            isRemote: true,
            activeShotId: u.activeShotId
          };
        });
        return [...locals, ...remotes];
      });

      const activeShot = shotsRef.current[activeShotIndexRef.current];
      if (activeShot && activeShot.sceneShotId) {
        // ONLY trigger popup if collaborator is actively typing/editing a field (isEditing === true)
        const matchingConflict = sameProjectUsers.find(u => u.activeShotId === activeShot.sceneShotId && u.isEditing === true);
        if (matchingConflict) {
          auditPresenceConflict({
            projectTitle: projectTitleRef.current,
            peerEmail: matchingConflict.userEmail,
            peerName: matchingConflict.userName,
            shotId: activeShot.sceneShotId,
            roomId: effectiveRoomId
          });
          setActiveConflict(matchingConflict);
          setIsConflictModalOpen(true);
        }
      }
    });
    return () => {
      resetPeerPresenceRoom(effectiveRoomId);
      if (typeof unsubPresence === 'function') unsubPresence();
    };
  }, [effectiveRoomId]);

  // Room chat / shot comments — unread badge while panel closed
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const key = effectiveRoomId;
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(`sps_chat_last_seen_${key}`) || 0) || 0;
    } catch (e) {}

    const unsub = subscribeToCollabChat(key, (list) => {
      if (isCollabChatOpen) {
        setUnreadChatCount(0);
        try {
          localStorage.setItem(`sps_chat_last_seen_${key}`, String(Date.now()));
        } catch (e) {}
        return;
      }
      const myEmail = String(localStorage.getItem('sps_authorized_user_email') || '').toLowerCase();
      const unread = (list || []).filter((m) => {
        const t = Date.parse(m.createdAt || '') || 0;
        const fromOther = String(m.userEmail || '').toLowerCase() !== myEmail;
        return fromOther && t > lastSeen;
      }).length;
      setUnreadChatCount(unread);
    });
    return () => unsub();
  }, [effectiveRoomId, isCollabChatOpen]);

  // -------------------------------------------------------------
  // Timed durable auto-save (vault + optional projectSave version)
  // -------------------------------------------------------------
  const [isProjectSavedToast, setIsProjectSavedToast] = useState(false);
  const [studioToast, setStudioToast] = useState('');
  useEffect(() => {
    const onToast = (e) => {
      const msg = String(e?.detail?.message || '').trim();
      if (!msg) return;
      setStudioToast(msg);
      window.setTimeout(() => setStudioToast(''), 3200);
    };
    window.addEventListener('sps_toast', onToast);
    return () => window.removeEventListener('sps_toast', onToast);
  }, []);
  const [autoSaveIntervalId, setAutoSaveIntervalId] = useState(() => {
    try {
      const saved = localStorage.getItem('sps_auto_save_interval');
      if (saved && ['off', '2m', '5m', '15m', '30m'].includes(saved)) return saved;
    } catch {
      /* ignore */
    }
    return '5m';
  });
  const [isDurableSaving, setIsDurableSaving] = useState(false);
  const [lastDurableSaveAt, setLastDurableSaveAt] = useState(null);
  const [lastVersionFile, setLastVersionFile] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadUiPrefsFromDisk().then((prefs) => {
      if (cancelled) return;
      const id = prefs?.autoSaveIntervalId;
      if (id && ['off', '2m', '5m', '15m', '30m'].includes(id)) {
        setAutoSaveIntervalId(id);
        try {
          localStorage.setItem('sps_auto_save_interval', id);
        } catch {
          /* ignore */
        }
      }
    });
    const onPrefs = (e) => {
      const id = e?.detail?.autoSaveIntervalId;
      if (id && ['off', '2m', '5m', '15m', '30m'].includes(id)) {
        setAutoSaveIntervalId(id);
      }
    };
    window.addEventListener('sps_ui_prefs_synced', onPrefs);
    return () => {
      cancelled = true;
      window.removeEventListener('sps_ui_prefs_synced', onPrefs);
    };
  }, []);

  const handleChangeAutoSaveInterval = (id) => {
    const next = ['off', '2m', '5m', '15m', '30m'].includes(id) ? id : '5m';
    setAutoSaveIntervalId(next);
    try {
      localStorage.setItem('sps_auto_save_interval', next);
    } catch {
      /* ignore */
    }
    saveUiPrefsToDisk({ autoSaveIntervalId: next }).catch(() => {});
  };

  const handleDurableProjectSave = async ({ source = 'manual' } = {}) => {
    if (isGuestSession()) return { ok: false, error: 'guest' };
    if (!canEditProjects()) return { ok: false, error: 'read_only' };
    if (!projectTitle || !shots?.length) return { ok: false, error: 'empty' };
    try {
      setIsDurableSaving(true);
      const roots = normalizeAssetRoots(readAssetRootsFromLibrary(projectTitle));
      let nextRoots = { ...roots };
      const nowStr =
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' - ' +
        new Date().toLocaleDateString();
      const safeTitle = String(projectTitle);
      const vaultImages = getStoredCanvasVaultImages();
      const mergedImages = { ...projectGeneratedImages, ...vaultImages };

      let projectPayload = attachWorkspaceToProject({
        id: `proj_${safeTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        title: projectTitle,
        description: `Cinema Production Studio Project with ${shots.length} shots`,
        targetModel: targetModel || 'SPS Direct Cinema 2.0',
        aspectRatio: aspectRatio || '2.39:1 Anamorphic',
        roomId: roomIdForProject(projectTitle, effectiveRoomId),
        lastModified: nowStr,
        shots,
        projectGeneratedImages: mergedImages,
        assetRoots: nextRoots,
        projectVersion: nextRoots.projectVersion,
        saveSource: source,
        savedAt: new Date().toISOString()
      });

      let versioned = null;
      if (nextRoots.projectSave) {
        versioned = await saveVersionedProjectSnapshot(projectPayload, nextRoots);
        if (nextRoots.versioning && versioned?.ok !== false) {
          nextRoots = { ...nextRoots, projectVersion: nextRoots.projectVersion + 1 };
          stampAssetRootsIntoLibrary(projectTitle, nextRoots);
          projectPayload = {
            ...projectPayload,
            assetRoots: nextRoots,
            projectVersion: nextRoots.projectVersion
          };
        }
      }

      await saveProjectToVault(projectPayload);
      await saveActiveWorkspaceToDisk({
        title: projectTitle,
        roomId: roomIdForProject(projectTitle, effectiveRoomId)
      });

      setLastDurableSaveAt(Date.now());
      setLastVersionFile(
        versioned?.filename ||
          (nextRoots.projectSave && nextRoots.versioning
            ? versionedProjectFilename(projectTitle, Math.max(1, nextRoots.projectVersion - 1))
            : '')
      );
      setIsProjectSavedToast(true);
      setTimeout(() => setIsProjectSavedToast(false), 2500);
      return { ok: true, versioned };
    } catch (err) {
      console.warn('Durable project save failed:', err);
      return { ok: false, error: err?.message || String(err) };
    } finally {
      setIsDurableSaving(false);
    }
  };

  const durableSaveRef = React.useRef(handleDurableProjectSave);
  durableSaveRef.current = handleDurableProjectSave;

  useEffect(() => {
    const ms = autoSaveIntervalMs(autoSaveIntervalId);
    if (!ms || isGuestSession()) return undefined;
    const id = setInterval(() => {
      durableSaveRef.current?.({ source: 'auto' });
    }, ms);
    return () => clearInterval(id);
  }, [autoSaveIntervalId]);

  // Legacy 30-min localStorage-only snapshot (kept light; durable save is the real versioning)
  useEffect(() => {
    const create30MinAutoBackup = () => {
      try {
        if (typeof window === 'undefined') return;
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString();
        const backupName = `Auto-Backup 30m - ${timeStr} - ${dateStr}`;

        const savedLibStr = localStorage.getItem('sps_project_library');
        let library = [];
        try {
          library = savedLibStr ? JSON.parse(savedLibStr) : [];
        } catch (_) {
          library = [];
        }
        if (!Array.isArray(library) || library.length === 0) return;

        const currentTitle = localStorage.getItem('sps_current_project_title') || projectTitle;
        const targetIdx = library.findIndex(p => titlesMatch(p.title, currentTitle));

        if (targetIdx !== -1) {
          const activeProj = library[targetIdx];
          const newSnapshot = {
            versionId: `autobackup_${Date.now()}`,
            versionName: backupName,
            createdAt: `${timeStr} - ${dateStr}`,
            shots: [...shots],
            isAutoBackup: true
          };

          const existingVersions = activeProj.versions || [];
          const updatedVersions = [newSnapshot, ...existingVersions].slice(0, 3);

          library[targetIdx] = {
            ...activeProj,
            shots: [...shots],
            lastModified: dateStr,
            versions: updatedVersions
          };

          safeLocalStorageSetItem('sps_project_library', JSON.stringify(library));

          const globalBackupsStr = localStorage.getItem('sps_global_project_backups');
          let globalBackups = globalBackupsStr ? JSON.parse(globalBackupsStr) : [];
          if (!Array.isArray(globalBackups)) globalBackups = [];

          globalBackups.unshift({
            id: `bak_${Date.now()}`,
            projectTitle: currentTitle,
            backupName: backupName,
            timestamp: now.toISOString(),
            shots: [...shots]
          });

          safeLocalStorageSetItem('sps_global_project_backups', JSON.stringify(globalBackups.slice(0, 10)));
        }
      } catch (err) {
        console.warn("Auto-backup error:", err);
      }
    };

    const THIRTY_MINUTES_MS = 30 * 60 * 1000;
    const backupInterval = setInterval(create30MinAutoBackup, THIRTY_MINUTES_MS);

    return () => clearInterval(backupInterval);
  }, [projectTitle]);

  const [projectGeneratedImages, setProjectGeneratedImages] = useState(() => {
    try {
      const saved = localStorage.getItem('sps_generated_images_map');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    const onCloudImages = (e) => {
      if (e?.detail && typeof e.detail === 'object') {
        setProjectGeneratedImages(e.detail);
      }
    };
    window.addEventListener('sps_cloud_images_updated', onCloudImages);
    return () => window.removeEventListener('sps_cloud_images_updated', onCloudImages);
  }, []);

  const syncToCloud = (updatedState = {}) => {
    if (isGuestSession()) return;
    if (isReceivingCloudUpdate.current) return;
    if (!canEditProjects()) return;
    try {
    const nextTitle = updatedState?.projectTitle || projectTitle;
    if (!canCreateOrDeleteProjects() && !canAccessProject(nextTitle)) return;

    const newShots = updatedState?.shots || shots;
    const newTitle = nextTitle;
    const newModel = updatedState?.targetModel || targetModel;
    const newRatio = updatedState?.aspectRatio || aspectRatio;
    const newImages = updatedState?.projectGeneratedImages || projectGeneratedImages;

    const newHash = JSON.stringify({ shots: newShots, projectTitle: newTitle, targetModel: newModel, aspectRatio: newRatio });
    lastSyncedHash.current = newHash;

    if (typeof window !== 'undefined') {
      safeLocalStorageSetItem('sps_current_shots', JSON.stringify(newShots));
      safeLocalStorageSetItem('sps_current_project_title', newTitle);
      try {
        syncProductionSpine({ projectTitle: newTitle, shots: newShots });
      } catch {
        /* ignore */
      }

      try {
        const savedLibStr = localStorage.getItem('sps_project_library');
        let library = savedLibStr ? JSON.parse(savedLibStr) : [];
        if (!Array.isArray(library)) library = [];

        const existingIdx = library.findIndex(p => p.title === newTitle);
        // Never resurrect archived/deleted titles via cloud room sync
        if (isProjectTitleDeleted(newTitle)) {
          // skip library write
        } else if (existingIdx === -1 && !canCreateOrDeleteProjects()) {
          // Still publish room shots for allotted open sessions without minting library rows
        } else {
          const updatedProjectData = {
            id: existingIdx !== -1 ? library[existingIdx].id : `proj_${Date.now()}`,
            title: newTitle,
            description: `Cinema Production Studio Project with ${newShots.length} shots`,
            targetModel: newModel,
            aspectRatio: newRatio,
            roomId: roomId,
            lastModified: new Date().toLocaleDateString(),
            shots: newShots,
            projectGeneratedImages: newImages
          };

          if (existingIdx !== -1) {
            library[existingIdx] = { ...library[existingIdx], ...updatedProjectData };
          } else if (canCreateOrDeleteProjects()) {
            library.unshift(updatedProjectData);
          }

          library = filterOutDeletedProjects(library);
          safeLocalStorageSetItem('sps_project_library', JSON.stringify(library));
          // Always mirror library to Vercel (Local badge does not disable cloud SoT)
          if (library.length > 0) syncProjectLibraryToCloud(library);
        }
      } catch (e) {}
    }

    // Always publish room shots to Vercel — Local mode still receives/sends via getNativeSyncUrl
    setIsCloudSyncing(true);
    publishToCloudRoom(effectiveRoomId, {
      projectTitle: newTitle,
      targetModel: newModel,
      aspectRatio: newRatio,
      shots: newShots,
      projectGeneratedImages: newImages,
      lastUpdated: new Date().toISOString(),
      ...updatedState
    });
    setTimeout(() => setIsCloudSyncing(false), 400);
    } catch (err) {
      console.warn('syncToCloud skipped:', err);
    }
  };

  const handleSaveProjectToApp = async () => {
    if (isGuestSession()) return;
    if (!canEditProjects()) return;
    try {
      setIsCloudSyncing(true);
      
      // Auto-bundle local vault images for cloud database sync
      await syncCanvasVaultToCloud(roomId, projectTitle);
      const vaultImages = getStoredCanvasVaultImages();
      const mergedImages = { ...projectGeneratedImages, ...vaultImages };
      setProjectGeneratedImages(mergedImages);

      const savedLibStr = localStorage.getItem('sps_project_library');
      let library = [];
      try {
        library = savedLibStr ? JSON.parse(savedLibStr) : [];
      } catch (_) {
        library = [];
      }
      if (!Array.isArray(library)) library = [];

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString();
      
      const existingIdx = library.findIndex(p => titlesMatch(p.title, projectTitle));
      if (!isProjectTitleDeleted(projectTitle)) {
      const updatedProjectData = {
        id: existingIdx !== -1 ? library[existingIdx].id : `proj_${Date.now()}`,
        title: projectTitle,
        description: `Cinema Production Studio Project with ${shots.length} shots`,
        targetModel: targetModel,
        aspectRatio: aspectRatio,
        roomId: roomId,
        lastModified: nowStr,
        shots: shots,
        projectGeneratedImages: mergedImages
      };

      if (existingIdx !== -1) {
        library[existingIdx] = {
          ...library[existingIdx],
          ...updatedProjectData
        };
      } else {
        library.unshift(updatedProjectData);
      }
      }

      library = filterOutDeletedProjects(library);
      safeLocalStorageSetItem('sps_project_library', JSON.stringify(library));
      safeLocalStorageSetItem('sps_current_project_title', projectTitle);
      safeLocalStorageSetItem('sps_current_shots', JSON.stringify(shots));
      safeLocalStorageSetItem('sps_generated_images_map', JSON.stringify(projectGeneratedImages));
      
      // 1. UPLOAD LOCAL EDITS TO CLOUD
      await syncToCloud({ shots, projectGeneratedImages, projectTitle, library });
      await syncProjectLibraryToCloud(library);

      const savedUsersStr = localStorage.getItem('sps_authorized_phone_users');
      if (savedUsersStr) {
        try {
          const authUsers = JSON.parse(savedUsersStr);
          await syncCollaboratorsToCloud(authUsers);
        } catch (err) {}
      }

      // 2. PULL LATEST DATA FROM CLOUD DATABASE
      try {
        const latestCloudLib = await fetchProjectLibraryFromCloud();
        await fetchCollaboratorsFromCloud();
        if (Array.isArray(latestCloudLib) && latestCloudLib.length > 0) {
          const activeProj = latestCloudLib.find(p => titlesMatch(p.title, projectTitle));
          if (activeProj && Array.isArray(activeProj.shots) && activeProj.shots.length > 0) {
            isReceivingCloudUpdate.current = true;
            setShots(activeProj.shots);
            localStorage.setItem('sps_current_shots', JSON.stringify(activeProj.shots));
          }
        }
      } catch (err) {}
      
      setIsProjectSavedToast(true);
      setTimeout(() => setIsProjectSavedToast(false), 3500);
      setTimeout(() => setIsCloudSyncing(false), 500);
    } catch (e) {
      console.warn("Failed to sync project data to cloud database:", e);
      setIsCloudSyncing(false);
    }
  };

  const handleEmbedImageToProject = (shotKey, imageUrl, { jobId = '' } = {}) => {
    const KEYFRAME_MODES = ['first_frame', 'last_frame', 'transition'];
    let keyframeMode = 'first_frame';
    let shotId = shotKey || '';
    for (const mode of KEYFRAME_MODES) {
      const suffix = `_${mode}`;
      if (shotKey && shotKey.endsWith(suffix)) {
        keyframeMode = mode;
        shotId = shotKey.slice(0, -suffix.length);
        break;
      }
    }

    setProjectGeneratedImages((prev) => {
      const updated = { ...prev, [shotKey]: imageUrl };
      try {
        localStorage.setItem('sps_generated_images_map', JSON.stringify(updated));
      } catch (e) {}

      setShots((current) => {
        const shotIndex = current.findIndex(
          (s, idx) =>
            (s.sceneShotId && s.sceneShotId === shotId) ||
            `SH_${idx + 1}` === shotId
        );
        if (shotIndex === -1) return current;

        let shot = appendStillTake(current[shotIndex], {
          slot: keyframeMode,
          url: imageUrl,
          jobId
        });
        let next = current.map((s, i) => (i !== shotIndex ? s : shot));

        if (keyframeMode === 'last_frame') {
          next = bindLastFrameToNext(next, shotIndex, getActiveStillUrl(shot, 'last_frame'));
        }

        try {
          localStorage.setItem('sps_current_shots', JSON.stringify(next));
        } catch (e) {}
        syncToCloud({ shots: next, projectGeneratedImages: updated });
        return next;
      });

      return updated;
    });
  };

  const handleEmbedVideoToProject = (shotKey, video, { jobId = '' } = {}) => {
    const shotId = String(shotKey || '').replace(/_video$/, '');
    const payload = typeof video === 'string' ? { url: video } : video || {};
    setShots((current) => {
      const shotIndex = current.findIndex(
        (s, idx) =>
          (s.sceneShotId && s.sceneShotId === shotId) ||
          `SH_${idx + 1}` === shotId
      );
      if (shotIndex === -1) return current;
      let shot = ensureShotTakes(current[shotIndex]);
      if (payload.url && payload.taskId) {
        shot = updateVideoTake(shot, payload.taskId, {
          url: payload.url,
          status: payload.status || 'succeeded',
          jobId
        });
      } else if (payload.taskId && !payload.url) {
        shot = appendVideoTake(shot, {
          taskId: payload.taskId,
          status: payload.status || 'queued',
          jobId,
          setActive: true
        });
      } else if (payload.url) {
        shot = appendVideoTake(shot, {
          url: payload.url,
          status: payload.status || 'succeeded',
          jobId,
          setActive: true
        });
      }
      const next = current.map((s, i) => (i !== shotIndex ? s : shot));
      try {
        localStorage.setItem('sps_current_shots', JSON.stringify(next));
      } catch (e) {}
      syncToCloud({ shots: next });
      return next;
    });
  };

  const applyGenerationJobResult = (job, { imageUrl, videoPayload } = {}) => {
    if (!job?.sceneShotId) return;
    setShots((current) => {
      const shotId = job.sceneShotId;
      const shotIndex = current.findIndex(
        (s, idx) =>
          (s.sceneShotId && s.sceneShotId === shotId) ||
          `SH_${idx + 1}` === shotId
      );
      if (shotIndex === -1) return current;
      let shot = ensureShotTakes(current[shotIndex]);
      if (imageUrl) {
        shot = appendStillTake(shot, {
          slot: job.takeSlot || 'last_frame',
          url: imageUrl,
          jobId: job.id
        });
      }
      if (videoPayload) {
        if (videoPayload.taskId && videoPayload.url) {
          shot = updateVideoTake(shot, videoPayload.taskId, {
            ...videoPayload,
            jobId: job.id
          });
        } else {
          shot = appendVideoTake(shot, { ...videoPayload, jobId: job.id, setActive: true });
        }
      }
      let next = current.map((s, i) => (i === shotIndex ? shot : s));
      if (imageUrl && (job.takeSlot || 'last_frame') === 'last_frame') {
        next = bindLastFrameToNext(next, shotIndex, getActiveStillUrl(shot, 'last_frame'));
      }
      try {
        localStorage.setItem('sps_current_shots', JSON.stringify(next));
      } catch (e) {}
      syncToCloud({ shots: next, projectTitle: job.projectTitle || projectTitle });
      return next;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined' || isGuestSession()) return undefined;
    fetchCloudSyncHealth();
    const timer = setInterval(() => fetchCloudSyncHealth(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || isGuestSession()) return undefined;
    if (!isUsableProjectTitle(projectTitle)) return undefined;
    const handlers = {
      onTaskCreated: (job) => {
        if (job?.type !== 'video' || !job.taskId) return;
        applyGenerationJobResult(job, {
          videoPayload: { taskId: job.taskId, status: 'queued' }
        });
      },
      onComplete: (job, url) => {
        if (job.type === 'still') {
          applyGenerationJobResult(job, { imageUrl: url });
        } else if (job.type === 'video') {
          applyGenerationJobResult(job, {
            videoPayload: { url, taskId: job.taskId, status: 'succeeded' }
          });
        }
      }
    };
    const kick = () => resumePendingGenerationJobs(projectTitle, handlers);
    const onKick = (e) => {
      const t = e?.detail?.title;
      if (t && String(t).trim().toLowerCase() !== String(projectTitle).trim().toLowerCase()) return;
      kick();
    };
    kick();
    const timer = setInterval(kick, 8000);
    window.addEventListener('sps_generation_job_kick', onKick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('sps_generation_job_kick', onKick);
    };
  }, [projectTitle]);

  // P100/P102 — keep Cast/World cache stamped to the open film after restart / hydrate
  useEffect(() => {
    if (!isUsableProjectTitle(projectTitle)) return undefined;
    reconcileActiveBibleToCurrentTitle();
    assertProjectIsolationHealth({
      activeTitle: projectTitle,
      bibleTitle: readIsolationSnapshot().bibleTitle,
      roomId: roomId || readIsolationSnapshot().roomId,
      expectedRoomId: roomIdForProject(projectTitle, roomId)
    });
    // P105 — auto-heal library ↔ vault ↔ active cache drift on project switch
    try {
      const library = readLocalProjectLibrary();
      const projectRecord =
        library.find((p) => titlesMatch(p?.title, projectTitle)) || { title: projectTitle, shots };
      const drift = detectBibleSoTDrift({ projectTitle, project: projectRecord });
      if (drift.drift) {
        const healed = healBibleSoTDrift({ projectTitle, project: projectRecord });
        if (healed.ok && healed.project) {
          writeLocalProjectLibrary(
            patchLibraryProjectBibleFields(library, projectTitle, {
              characterProfiles: healed.project.characterProfiles,
              worldAssets: healed.project.worldAssets,
              directorPsychology: healed.project.directorPsychology
            })
          );
        }
      }
    } catch {
      /* ignore heal errors on boot */
    }
    return undefined;
  }, [projectTitle, roomId]);

  const openGenerateDesk = () => {
    const gate = assertCanGenerate(getCurrentUserEmail());
    if (!gate.ok) {
      alert(gate.message);
      return;
    }
    setShots((current) => persistBridges(current));
    setIsGenerateDeskOpen(true);
  };

  const openCompiler = () => {
    if (!canUseSaasFeature('compile', getCurrentUserEmail())) {
      alert('Compile is not on this plan.');
      return;
    }
    setShots((current) => persistBridges(current));
    setIsCompilerOpen(true);
  };

  const guestBlock = (label) => {
    alert(
      `🔒 GUEST ACCESS\n\nSign in to open ${label}.\n\nRequest access from the studio Admin.`
    );
    setIsInvestorDeckOpen(true);
  };

  const guestMayLook = (label) => {
    if (!isGuestSession()) return true;
    if (canGuestBrowseApp()) return true;
    guestBlock(label);
    return false;
  };

  const goStudioRoom = (view) => {
    if (view === 'budget' && !canAccessBudgetConsole()) return;
    setHeaderMinimized(false);
    setActiveView(view);
  };

  useEffect(() => {
    const onNav = (e) => {
      const view = String(e?.detail?.view || '').trim();
      if (!view) return;
      if (view === 'spreadsheet' || view === 'matrix') {
        if (!guestMayLook('Matrix')) return;
        setHeaderMinimized(false);
        setActiveView('spreadsheet');
        return;
      }
      goStudioRoom(view);
    };
    window.addEventListener(STUDIO_NAVIGATE_EVENT, onNav);
    return () => window.removeEventListener(STUDIO_NAVIGATE_EVENT, onNav);
  }, []);

  const openBudgetConsole = () => {
    if (isGuestSession()) return guestBlock('Budget');
    if (!canAccessBudgetConsole()) {
      alert('Budget console is off, or this account is not granted access.\n\nAdmin: Settings → Budget console on, then check Budget console on the user.');
      return;
    }
    goStudioRoom('budget');
  };

  const goWriter = (tab) => {
    if (!guestMayLook('Writer')) return;
    setHeaderMinimized(false);
    openWriterConsole(tab);
  };

  const openCast = (tab = 'roster') => {
    if (!guestMayLook('Cast')) return;
    handleOpenCharactersModal(tab);
  };

  const openStage = () => {
    if (!guestMayLook('Stage')) return;
    setShowCanvasTab(true);
    try { localStorage.setItem('sps_enable_canvas_tab', 'true'); } catch { /* ignore */ }
    setHeaderMinimized(false);
    setActiveView('canvas');
  };

  const openSettingsTab = (tab = 'all') => {
    if (isGuestSession()) return guestBlock('Settings');
    if (!isAdminLoggedIn) { setIsLoginModalOpen(true); return; }
    setAdminModalTab(tab);
    setIsAdminModalOpen(true);
  };

  const handleStudioLogout = () => {
    try {
      localStorage.setItem('sps_user_manually_logged_out', 'true');
      localStorage.removeItem('sps_authorized_user_email');
      localStorage.setItem('sps_is_admin_logged_in', 'false');
      sessionStorage.removeItem('sps_session_authed');
      // Re-offer Shift+Space tip on next login (Project Console hides the header)
      localStorage.removeItem('sps_nav_shortcut_chip_seen');
    } catch {
      /* ignore */
    }
    setIsAdminLoggedIn(false);
    setIsAdminModalOpen(false);
    setIsProjectConsoleOpen(false);
    try {
      window.history.replaceState({}, '', window.location.pathname);
      window.dispatchEvent(new Event('sps_collaborators_updated'));
    } catch {
      /* ignore */
    }
    setLoginOverlayMode('default');
    setIsLoginModalOpen(true);
  };

  const handleStudioSwitchAccount = () => {
    setLoginOverlayMode('switch');
    setIsLoginModalOpen(true);
  };

  useEffect(() => {
    const onSwitch = () => handleStudioSwitchAccount();
    const onLogout = () => handleStudioLogout();
    const onLogin = () => {
      setLoginOverlayMode('default');
      setIsLoginModalOpen(true);
    };
    window.addEventListener(STUDIO_SWITCH_ACCOUNT_EVENT, onSwitch);
    window.addEventListener(STUDIO_LOGOUT_EVENT, onLogout);
    window.addEventListener(STUDIO_OPEN_LOGIN_EVENT, onLogin);
    return () => {
      window.removeEventListener(STUDIO_SWITCH_ACCOUNT_EVENT, onSwitch);
      window.removeEventListener(STUDIO_LOGOUT_EVENT, onLogout);
      window.removeEventListener(STUDIO_OPEN_LOGIN_EVENT, onLogin);
    };
  }, []);

  const openProjectsTab = (tab = 'library') => {
    if (!guestMayLook('Projects')) return;
    if (isGuestSession() && tab !== 'library') return guestBlock('Projects');
    setProjectConsoleInitialTab(tab);
    setIsProjectConsoleOpen(true);
  };

  const navigatorItems = [
    {
      id: 'writer',
      group: 'Rooms',
      label: 'Writer',
      hint: 'Console',
      keywords: ['script', 'page', 'synopsis', 'breakdown', 'parse'],
      icon: NAV_ICONS.writer,
      enabled: isStudioModuleEnabled('writer'),
      run: () => goWriter('screenplay'),
      children: [
        { id: 'writer-screenplay', label: 'Screenplay', hint: 'Pages', run: () => goWriter('screenplay') },
        { id: 'writer-synopsis', label: 'Synopsis', hint: 'Master story', run: () => goWriter('synopsis') },
        { id: 'writer-breakdown', label: 'AI Breakdown', hint: 'Parse → Matrix', run: () => goWriter('breakdown') },
        { id: 'writer-cast', label: 'Character console', hint: 'Bible', run: () => openCast('roster') },
      ],
    },
    {
      id: 'matrix',
      group: 'Rooms',
      label: 'Matrix',
      hint: 'Shots',
      keywords: ['spreadsheet', 'grid', 'cinema'],
      icon: NAV_ICONS.matrix,
      enabled: isStudioModuleEnabled('matrix'),
      run: () => { if (!guestMayLook('Matrix')) return; setHeaderMinimized(false); setActiveView('spreadsheet'); },
      children: [
        { id: 'matrix-grid', label: 'Shot grid', hint: 'Spreadsheet', run: () => { if (!guestMayLook('Matrix')) return; setHeaderMinimized(false); setActiveView('spreadsheet'); } },
        { id: 'matrix-form', label: 'Form desk', hint: 'Single shot', run: () => { if (!guestMayLook('Form')) return; setHeaderMinimized(false); setActiveView('form'); } },
      ],
    },
    {
      id: 'form',
      group: 'Rooms',
      label: 'Form',
      hint: 'Craft desk',
      keywords: ['studio form', 'shot editor'],
      icon: NAV_ICONS.form,
      enabled: isStudioModuleEnabled('form'),
      run: () => { if (!guestMayLook('Form')) return; setHeaderMinimized(false); setActiveView('form'); },
      children: [
        { id: 'form-desk', label: 'Craft desk', run: () => { if (!guestMayLook('Form')) return; setHeaderMinimized(false); setActiveView('form'); } },
        { id: 'form-matrix', label: 'Back to Matrix', run: () => { if (!guestMayLook('Matrix')) return; setHeaderMinimized(false); setActiveView('spreadsheet'); } },
      ],
    },
    {
      id: 'stage',
      group: 'Rooms',
      label: '3D Stage',
      hint: 'Canvas',
      keywords: ['maya', 'previs', 'camera', 'stage'],
      icon: NAV_ICONS.stage,
      enabled: isStudioModuleEnabled('stage'),
      run: openStage,
      children: [
        { id: 'stage-canvas', label: 'Open canvas', run: openStage },
      ],
    },
    {
      id: 'cast',
      group: 'Rooms',
      label: 'Character',
      hint: 'Console',
      keywords: ['cast', 'bible', 'roster', 'look', 'profiles', 'sheet'],
      icon: NAV_ICONS.cast,
      enabled: isStudioModuleEnabled('cast'),
      run: () => openCast('roster'),
      children: [
        { id: 'cast-profiles', label: 'Profiles', hint: 'Roster', run: () => openCast('roster') },
        { id: 'cast-sheet', label: 'Design sheet', hint: '360°', run: () => openCast('character_sheet') },
      ],
    },
    {
      id: 'world',
      group: 'Rooms',
      label: 'World',
      hint: 'Console',
      keywords: ['environment', 'plates', 'set', 'location', 'prop'],
      icon: NAV_ICONS.world,
      enabled: isStudioModuleEnabled('world'),
      run: () => { if (!guestMayLook('World')) return; handleOpenWorldEnvironment(); },
      children: [
        { id: 'world-env', label: 'Locations & assets', run: () => { if (!guestMayLook('World')) return; handleOpenWorldEnvironment(); } },
      ],
    },
    {
      id: 'generate',
      group: 'Tools',
      label: 'Generate',
      hint: 'Desk',
      keywords: ['take', 'image', 'video'],
      icon: NAV_ICONS.generate,
      enabled: isStudioModuleEnabled('generate'),
      run: () => { if (isGuestSession()) return guestBlock('Generate'); openGenerateDesk(); },
      children: [
        { id: 'generate-desk', label: 'Generate desk', run: () => { if (isGuestSession()) return guestBlock('Generate'); openGenerateDesk(); } },
      ],
    },
    {
      id: 'compile',
      group: 'Tools',
      label: 'Compile',
      hint: 'Prompts',
      keywords: ['seedance', 'keyframe'],
      icon: NAV_ICONS.compile,
      enabled: isStudioModuleEnabled('compile'),
      run: () => { if (isGuestSession()) return guestBlock('Compile'); openCompiler(); },
      children: [
        { id: 'compile-prompts', label: 'Prompt compiler', run: () => { if (isGuestSession()) return guestBlock('Compile'); openCompiler(); } },
      ],
    },
    {
      id: 'storyboard',
      group: 'Tools',
      label: 'Storyboard',
      hint: 'Frames',
      keywords: ['board', 'panel', 'still', 'prompt', 'keyframe'],
      icon: NAV_ICONS.storyboard,
      enabled: isStudioModuleEnabled('storyboard'),
      run: () => { if (!guestMayLook('Storyboard')) return; goStudioRoom('storyboard'); },
      children: [
        { id: 'storyboard-open', label: 'Open storyboard', run: () => { if (!guestMayLook('Storyboard')) return; goStudioRoom('storyboard'); } },
      ],
    },
    {
      id: 'promo',
      group: 'Tools',
      label: 'Promo Pack',
      hint: 'Cuts',
      keywords: ['trailer', 'teaser', 'social'],
      icon: NAV_ICONS.promo,
      enabled: isStudioModuleEnabled('promo'),
      run: () => { if (!guestMayLook('Promo')) return; goStudioRoom('promo'); },
      children: [
        { id: 'promo-open', label: 'Open promo pack', run: () => { if (!guestMayLook('Promo')) return; goStudioRoom('promo'); } },
      ],
    },
    {
      id: 'campaign',
      group: 'Tools',
      label: 'Campaign Kit',
      hint: 'Key art',
      keywords: ['poster', 'hoarding', 'research', 'outdoor', 'one-sheet', 'marketing'],
      icon: NAV_ICONS.campaign,
      enabled: isStudioModuleEnabled('campaign'),
      run: () => { if (!guestMayLook('Campaign')) return; goStudioRoom('campaign'); },
      children: [
        { id: 'campaign-open', label: 'Open campaign kit', run: () => { if (!guestMayLook('Campaign')) return; goStudioRoom('campaign'); } },
        { id: 'campaign-research', label: 'Research desk', run: () => { if (!guestMayLook('Campaign')) return; goStudioRoom('campaign'); } },
      ],
    },
    {
      id: 'pitch',
      group: 'Tools',
      label: 'Pitch Deck',
      hint: 'Slides',
      keywords: ['investor', 'slides', 'deck'],
      icon: NAV_ICONS.pitch,
      enabled: isStudioModuleEnabled('pitch'),
      run: () => { if (!guestMayLook('Pitch')) return; goStudioRoom('pitch'); },
      children: [
        { id: 'pitch-open', label: 'Open pitch deck', run: () => { if (!guestMayLook('Pitch')) return; goStudioRoom('pitch'); } },
      ],
    },
    {
      id: 'budget',
      group: 'Tools',
      label: 'Budget',
      hint: 'Console',
      keywords: ['investor', 'producer', 'funds', 'ask'],
      icon: NAV_ICONS.budget,
      enabled: isStudioModuleEnabled('budget') && canAccessBudgetConsole(),
      run: () => openBudgetConsole(),
      children: [
        { id: 'budget-open', label: 'Open budget console', run: () => openBudgetConsole() },
      ],
    },
    {
      id: 'reel',
      group: 'Tools',
      label: 'Feature Reel',
      hint: 'Takes',
      keywords: ['playback', 'takes'],
      icon: NAV_ICONS.reel,
      enabled: isStudioModuleEnabled('reel'),
      run: () => { if (!guestMayLook('Reel')) return; setIsFeatureReelOpen(true); },
      children: [
        { id: 'reel-open', label: 'Open reel', run: () => { if (!guestMayLook('Reel')) return; setIsFeatureReelOpen(true); } },
      ],
    },
    {
      id: 'projects',
      group: 'Studio',
      label: 'Projects',
      hint: 'Console',
      keywords: ['library', 'vault', 'breakdown', 'archive', 'drive', 'google'],
      icon: NAV_ICONS.library,
      run: () => openProjectsTab('library'),
      children: [
        { id: 'projects-library', label: 'Library', run: () => openProjectsTab('library') },
        { id: 'projects-create', label: 'New project', run: () => openProjectsTab('create') },
        { id: 'projects-ai', label: 'AI Breakdown', run: () => openProjectsTab('ai_breakdown') },
        { id: 'projects-director', label: 'Director notes', run: () => openProjectsTab('director_psychology') },
        { id: 'projects-archive', label: 'Archive', run: () => openProjectsTab('archive') },
        { id: 'projects-drive', label: 'Google Drive', hint: 'Share files', run: () => openProjectsTab('library') },
      ],
    },
    {
      id: 'settings',
      group: 'Studio',
      label: 'Settings',
      hint: 'Admin',
      keywords: ['admin', 'models', 'cloud', 'keys', 'drive', 'google'],
      icon: NAV_ICONS.settings,
      run: () => openSettingsTab('all'),
      children: [
        { id: 'settings-all', label: 'All settings', run: () => openSettingsTab('all') },
        { id: 'settings-cloud', label: 'Cloud & collab', run: () => openSettingsTab('cloud_collab') },
        { id: 'settings-drive', label: 'Google Drive', run: () => openSettingsTab('cloud_collab') },
        { id: 'settings-image', label: 'Image models', run: () => openSettingsTab('image') },
        { id: 'settings-video', label: 'Video models', run: () => openSettingsTab('video') },
        { id: 'settings-llm', label: 'LLM', run: () => openSettingsTab('llm') },
        { id: 'settings-tokens', label: 'Tokens', run: () => openSettingsTab('tokens') },
        { id: 'settings-security', label: 'Security', run: () => openSettingsTab('security') },
        { id: 'settings-consoles', label: 'Console Switcher', run: () => openSettingsTab('console_switcher') },
      ],
    },
    {
      id: 'dashboard',
      group: 'Studio',
      label: 'Production',
      hint: 'Dashboard',
      keywords: ['runtime', 'takes', 'jobs', 'audit', 'approvals', 'control'],
      icon: NAV_ICONS.dashboard,
      run: () => setIsProductionDashboardOpen(true),
      children: [
        { id: 'dashboard-open', label: 'Open dashboard', run: () => setIsProductionDashboardOpen(true) },
        { id: 'llm-commands', label: 'LLM command review', run: () => setIsLlmCommandReviewOpen(true) },
      ],
    },
    {
      id: 'brain',
      group: 'Studio',
      label: 'Studio Brain',
      hint: 'Notes',
      keywords: ['memory', 'continuity'],
      icon: NAV_ICONS.brain,
      run: () => setIsStudioBrainOpen(true),
      children: [
        { id: 'brain-open', label: 'Open brain', run: () => setIsStudioBrainOpen(true) },
      ],
    },
    {
      id: 'presentation',
      group: 'Studio',
      label: 'Presentation',
      hint: isPresentationMode() ? 'On · exit reel' : 'Guest reel',
      keywords: ['presentation', 'guest', 'demo mode', 'reel', 'showcase', 'investor'],
      icon: NAV_ICONS.deck,
      run: () => {
        if (isPresentationMode()) setPresentationMode(false);
        else setPresentationMode(true);
      },
      children: [
        {
          id: 'presentation-start',
          label: 'Start presentation',
          hint: 'Park consoles · play reel',
          run: () => setPresentationMode(true)
        },
        {
          id: 'presentation-exit',
          label: 'Exit presentation',
          hint: 'Restore consoles',
          run: () => setPresentationMode(false)
        },
        {
          id: 'presentation-guest',
          label: 'Guest look mode',
          hint: 'Browse without saving',
          run: () => {
            enterGuestLookSession();
            setIsInvestorDeckOpen(true);
          }
        },
      ],
    },
    {
      id: 'app-demo',
      group: 'Studio',
      label: 'App demo',
      hint: 'Guided tour',
      keywords: ['tour', 'walkthrough', 'tutorial', 'demo', 'onboarding'],
      icon: NAV_ICONS.generate,
      run: () => setIsStudioTourOpen(true),
      children: [
        { id: 'app-demo-tour', label: 'Start studio tour', run: () => setIsStudioTourOpen(true) },
        {
          id: 'app-demo-presentation',
          label: 'Presentation + tour',
          hint: 'Reel then walkthrough',
          run: () => {
            setPresentationMode(true);
            setIsStudioTourOpen(true);
          }
        },
      ],
    },
    {
      id: 'help',
      group: 'Studio',
      label: 'Help',
      keywords: ['guide', 'manual'],
      icon: NAV_ICONS.help,
      run: () => setIsHelpModalOpen(true),
      children: [
        { id: 'help-guide', label: 'User guide', run: () => setIsHelpModalOpen(true) },
        { id: 'help-deck', label: 'Investor deck', run: () => setIsInvestorDeckOpen(true) },
      ],
    },
    {
      id: 'chat',
      group: 'Studio',
      label: 'Chat',
      keywords: ['collab', 'comments'],
      icon: NAV_ICONS.chat,
      run: () => { setIsCollabChatOpen(true); setUnreadChatCount(0); },
      children: [
        { id: 'chat-open', label: 'Open chat', run: () => { setIsCollabChatOpen(true); setUnreadChatCount(0); } },
      ],
    },
    {
      id: 'deck',
      group: 'Studio',
      label: 'Investor Deck',
      keywords: ['showcase', 'guest'],
      icon: NAV_ICONS.deck,
      run: () => setIsInvestorDeckOpen(true),
      children: [
        { id: 'deck-open', label: 'Open showcase', run: () => setIsInvestorDeckOpen(true) },
      ],
    },
    {
      id: 'versions',
      group: 'Studio',
      label: 'App version',
      hint: 'Local / cloud',
      keywords: ['mode', 'offline'],
      icon: NAV_ICONS.versions,
      run: () => setIsAppVersionModalOpen(true),
      children: [
        { id: 'versions-open', label: 'Choose version', run: () => setIsAppVersionModalOpen(true) },
      ],
    },
  ];
  // Re-read console switches when Settings toggles fire (budgetAccessTick).
  void budgetAccessTick;

  const handleUpdateShot = (index, updatedShotOrKey, value) => {
    const prev = shots[index];
    if (!prev) return;
    let next;
    if (typeof updatedShotOrKey === 'string') {
      next = { ...prev, [updatedShotOrKey]: value };
    } else {
      next = updatedShotOrKey;
    }
    const gated = mergeRespectingLifecycleLock(prev, next);
    if (gated.stripped) {
      appendCreativeAudit({
        projectTitle,
        category: 'shot',
        action: 'edit_blocked',
        targetType: 'shot',
        targetId: prev.sceneShotId || `shot_${index + 1}`,
        targetLabel: prev.sceneShotId || `Shot ${index + 1}`,
        note: gated.message || 'Locked craft edit ignored'
      });
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('sps_toast', {
              detail: { message: gated.message || 'Shot is locked — unlock to edit craft.' }
            })
          );
        } catch {
          /* ignore */
        }
      }
    }
    const newShots = [...shots];
    newShots[index] = gated.entity;
    if (updateShotsWithHistory(newShots)) syncToCloud({ shots: newShots });
  };

  const handleAddShot = () => {
    const anchorIdx =
      shots.length === 0 ? -1 : Math.max(0, Math.min(Number(activeShotIndex) || 0, shots.length - 1));
    const anchor = anchorIdx >= 0 ? shots[anchorIdx] : {};
    const { sceneNum } = parseSceneAndShotID(anchor || {}, Math.max(0, anchorIdx));
    const targetScene = Number.isFinite(sceneNum) && sceneNum > 0 ? sceneNum : 1;

    let maxShotInScene = 0;
    let lastIdxInScene = anchorIdx;
    shots.forEach((s, i) => {
      const p = parseSceneAndShotID(s, i);
      if (p.sceneNum === targetScene) {
        if (Number(p.shotNum) > maxShotInScene) maxShotInScene = Number(p.shotNum);
        lastIdxInScene = i;
      }
    });

    const insertAfter =
      anchorIdx >= 0 && parseSceneAndShotID(shots[anchorIdx], anchorIdx).sceneNum === targetScene
        ? anchorIdx
        : Math.max(lastIdxInScene, -1);

    const nextShotNum = Math.max(1, maxShotInScene + 1);
    const sceneStr = `SC${String(targetScene).padStart(2, '0')}`;
    const shotStr = `SH${String(nextShotNum).padStart(2, '0')}`;

    const newShot = {
      sceneShotId: `${sceneStr}_${shotStr}`,
      sceneSynopsis: anchor?.sceneSynopsis || '',
      sceneHeading: anchor?.sceneHeading || '',
      shotComposition: 'Medium Shot (MS)',
      cameraMotionTag: '[Camera: Static Anchor]',
      subjectLightingTag: '[Lighting: Rembrandt 3-Point Classic]',
      subjectColorTag: '[Subject Color: Teal & Orange Cinema Palette]',
      backgroundLightingTag: '[BG Lighting: Mood Soft Ambient Falloff]',
      backgroundColorTag: '[BG Color: Deep Midnight Blue & Indigo]',
      characterIdAssetRef: '[CharID: @LeadSinger_Aria - Vocalist, leather jacket]',
      coArtistInteraction:
        "[Co-Artist: Secondary dancer mirroring lead performer's choreography in background]",
      actionEnvContext:
        anchor?.actionEnvContext ||
        'Cinematic interior concert venue with soft volumetric light falloff.',
      characterExpression: 'Stoic and determined, slight twitch of the jaw',
      characterPlacement: 'Foreground center stage, co-artists positioned in midground left & right',
      characterDialogue: '"Standing by for guitar drop."',
      characterMovement: 'Turning head slowly to look over shoulder towards camera',
      characterEyeLooks: '[Eye Look: Direct Eye Contact with Camera Lens]',
      lifecycleStatus: 'draft'
    };

    const newShots = [...shots];
    newShots.splice(insertAfter + 1, 0, ensureLifecycle(newShot));
    if (!updateShotsWithHistory(newShots)) return;
    setActiveShotIndex(insertAfter + 1);
    syncToCloud({ shots: newShots });
  };

  // -------------------------------------------------------------
  // SHOT ARCHIVE ENGINE (RULE: NOBODY CAN DELETE SHOTS/SCENES)
  // -------------------------------------------------------------
  const handleArchiveShot = (index) => {
    const activeShots = shots.filter(s => !s.isArchived);
    if (activeShots.length <= 1) {
      alert("🔒 RULE ENFORCEMENT:\nScenes and shots cannot be deleted. At least 1 active shot must remain in production sequence. You can modify this shot instead.");
      return;
    }

    const newShots = [...shots];
    newShots[index] = {
      ...newShots[index],
      isArchived: true,
      archivedAt: new Date().toLocaleTimeString() + ' - ' + new Date().toLocaleDateString()
    };

    if (updateShotsWithHistory(newShots)) syncToCloud({ shots: newShots });
  };

  const handleToggleMuteShot = (index) => {
    const newShots = [...shots];
    if (newShots[index]) {
      newShots[index] = {
        ...newShots[index],
        isMuted: !newShots[index]?.isMuted
      };
      if (updateShotsWithHistory(newShots)) syncToCloud({ shots: newShots });
    }
  };

  const handleDeleteShot = handleArchiveShot;

  const handleCloneShot = (index) => {
    const cloned = ensureLifecycle({
      ...shots[index],
      lifecycleStatus: 'draft',
      lifecycleUpdatedAt: null,
      lifecycleNote: 'Cloned from locked or prior row'
    });
    const newShots = [...shots];
    newShots.splice(index + 1, 0, cloned);
    if (!updateShotsWithHistory(newShots)) return;
    setActiveShotIndex(index + 1);
    syncToCloud({ shots: newShots });
  };

  const handleMoveShot = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === shots.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newShots = [...shots];
    const temp = newShots[index];
    newShots[index] = newShots[targetIdx];
    newShots[targetIdx] = temp;
    if (!updateShotsWithHistory(newShots)) return;
    setActiveShotIndex(targetIdx);
    syncToCloud({ shots: newShots });
  };

  const handleReorderShots = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= shots.length || toIndex >= shots.length) return;
    const newShots = [...shots];
    const [movedShot] = newShots.splice(fromIndex, 1);
    newShots.splice(toIndex, 0, movedShot);
    if (!updateShotsWithHistory(newShots)) return;
    setActiveShotIndex(toIndex);
    syncToCloud({ shots: newShots });
  };

  const [mergePromptState, setMergePromptState] = useState({
    isOpen: false,
    projectTitle: '',
    existingCount: 0,
    incomingCount: 0,
    pendingAiShots: [],
    pendingTitle: '',
    existingShots: [],
    pendingExtraElements: null
  });

  const executeApplyAIShots = (aiShots, titleToApply, mode, baseShots = [], extraElements = null) => {
    const nextTitle = titleToApply || projectTitle;
    if (!canEditProjects()) {
      alert('🔒 READ-ONLY ACCESS:\nViewers cannot apply AI shots. Ask the studio Admin to upgrade you to Editor.');
      return;
    }
    if (!Array.isArray(aiShots) || aiShots.length === 0) {
      alert('Parse produced no shots. Existing project was left unchanged.');
      return;
    }
    // Collaborators may only write into allotted projects; creating a new title is admin-only
    if (!canCreateOrDeleteProjects()) {
      let library = [];
      try {
        library = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
      } catch (e) {}
      const exists = Array.isArray(library) && library.some((p) => String(p?.title || '').toLowerCase() === String(nextTitle || '').toLowerCase());
      if (!exists || !canAccessProject(nextTitle)) {
        alert('🔒 ACCESS RESTRICTED:\nYou can only edit projects allotted to your account. Ask the studio Admin to allot a project or create a new one.');
        return;
      }
    }

    let finalShots = aiShots;
    if (mode === 'merge' && baseShots.length > 0) {
      const startNum = baseShots.length + 1;
      const renumbered = aiShots.map((s, idx) => ({
        ...s,
        sceneShotId: `SC01_SH${String(startNum + idx).padStart(2, '0')}`
      }));
      finalShots = [...baseShots, ...renumbered];
    }

    const assetPass = applyProductionAssetSpec({
      projectTitle: nextTitle,
      shots: finalShots,
      characters: extraElements?.characters?.length ? extraElements.characters : null,
      worldAssets: extraElements?.worldAssets?.length ? extraElements.worldAssets : null
    });
    finalShots = assetPass.shots;

    setShots(finalShots);
    setProjectTitle(nextTitle);
    setRoomId(roomIdForProject(nextTitle, roomId));
    setActiveShotIndex(0);
    setActiveView("spreadsheet");

    if (assetPass.characters?.length) {
      try { saveStoredCharacterProfiles(assetPass.characters, { title: nextTitle }); } catch { /* ignore */ }
    }
    if (assetPass.worldAssets?.length) {
      try { saveStoredWorldEnvironmentAssets(assetPass.worldAssets, { title: nextTitle }); } catch { /* ignore */ }
    }
    if (extraElements?.screenplayText && typeof window !== 'undefined') {
      try {
        writeOpenScreenplayText(extraElements.screenplayText, { silent: true });
        window.dispatchEvent(new CustomEvent('sps_screenplay_updated', { detail: { source: 'apply_expand' } }));
      } catch { /* ignore */ }
    }
    if (extraElements?.directorPsychology) {
      try { saveDirectorPsychology(nextTitle, extraElements.directorPsychology, { force: true }); } catch { /* ignore */ }
    }
    if (extraElements?.dopVision) {
      try { saveDoPVision(nextTitle, extraElements.dopVision, { force: true }); } catch { /* ignore */ }
    }
    if (extraElements?.soundVision) {
      try { saveSoundVision(nextTitle, extraElements.soundVision, { force: true }); } catch { /* ignore */ }
    }

    if (typeof window !== 'undefined') {
      try {
        const savedLibStr = localStorage.getItem('sps_project_library');
        let library = savedLibStr ? JSON.parse(savedLibStr) : [];
        if (!Array.isArray(library)) library = [];

        const existingIdx = library.findIndex(p => p.title === nextTitle);
        if (isProjectTitleDeleted(nextTitle)) {
          // Archived title — do not re-mint into live library from AI apply
        } else {
        const existingProj = existingIdx !== -1 ? library[existingIdx] : {};

        const newProj = {
          ...existingProj,
          id: existingIdx !== -1 ? library[existingIdx].id : `proj_${Date.now()}`,
          title: nextTitle,
          description: `Cinema Production Studio Project with ${finalShots.length} shots`,
          targetModel: targetModel || 'SPS Direct Cinema 2.0',
          aspectRatio: aspectRatio || '2.39:1 Anamorphic',
          roomId: roomIdForProject(nextTitle, roomId),
          lastModified: new Date().toLocaleDateString(),
          lastModifiedIso: new Date().toISOString(),
          shots: finalShots,
          directorPsychology: extraElements?.directorPsychology || existingProj.directorPsychology,
          dopVision: extraElements?.dopVision || existingProj.dopVision,
          soundVision: extraElements?.soundVision || existingProj.soundVision,
          characterProfiles: extraElements?.characters || existingProj.characterProfiles,
          worldAssets: extraElements?.worldAssets || existingProj.worldAssets,
          scriptGenre: extraElements?.detectedGenre || existingProj.scriptGenre,
          screenplayText: extraElements?.screenplayText || existingProj.screenplayText,
          ...collectOpenWorkspace()
        };

        if (existingIdx !== -1) {
          library[existingIdx] = newProj;
        } else {
          library.unshift(newProj);
        }

        library = filterOutDeletedProjects(library);
        localStorage.setItem('sps_project_library', JSON.stringify(library));
        window.dispatchEvent(new Event('sps_projects_updated'));
        syncProjectLibraryToCloud(library);
        }
      } catch (e) {}
    }

    syncToCloud({ shots: finalShots, projectTitle: nextTitle });
    try {
      autoSyncProductionSpine({
        projectTitle: nextTitle,
        shots: finalShots,
        force: true
      });
    } catch {
      /* ignore */
    }
    try {
      if (extraElements?.markStoryPackage !== false) {
        markStoryPackageApplied(nextTitle);
      }
    } catch {
      /* ignore */
    }
    if (extraElements?.learnFromParse) {
      try {
        learnFromProject({ projectTitle: nextTitle, shots: finalShots });
      } catch {
        /* ignore */
      }
    }
  };

  const proposeApplyShotsAndReview = (aiShots, titleToApply, mode = 'overwrite', extraElements = null, source = 'console_apply') => {
    const extras = extraElements
      ? { ...extraElements, markStoryPackage: extraElements.markStoryPackage !== false }
      : { markStoryPackage: true };
    const proposed = proposeApplyShotsCommand(
      {
        projectTitle: titleToApply,
        shots: aiShots,
        mode,
        extras,
        source,
        reason: `Apply ${aiShots.length} shots (${mode})`
      },
      { shots, projectTitle: titleToApply }
    );
    if (!proposed.ok) {
      alert(proposed.error || proposed.errors?.join('; ') || 'Apply proposal failed');
      return false;
    }
    setIsLlmCommandReviewOpen(true);
    return true;
  };

  const handleApplyAIShots = (aiShots, newTitle, extraElements = null) => {
    const titleToApply = newTitle || projectTitle;

    if (extraElements?.storyPackageId || extraElements?.markStoryPackage !== false) {
      const pkg = readStoryPackageForTitle(titleToApply) || readStoryPackageForTitle(projectTitle);
      const pkgGate = assertStoryPackageApplyAllowed({
        activeTitle: projectTitle,
        pkg: pkg?.proposedShots?.length
          ? pkg
          : {
              projectTitle: titleToApply,
              status: 'ready',
              proposedShots: aiShots,
              updatedAt: new Date().toISOString()
            },
        intendedTitle: titleToApply,
        existingShotCount: shots?.length || 0,
        auditLabel: 'console_apply_shots'
      });
      if (!pkgGate.ok) {
        alert(pkgGate.message);
        return;
      }
    } else {
      const gate = assertProjectWriteGate(projectTitle, {
        intendedTitle: titleToApply,
        auditLabel: 'console_apply_shots'
      });
      if (!gate.ok) {
        alert(gate.message);
        return;
      }
    }

    if (!Array.isArray(aiShots) || aiShots.length === 0) {
      alert('Parse produced no shots. Existing project was left unchanged.');
      return;
    }

    let targetExistingShots = shots && shots.length > 0 ? shots : [];

    if (typeof window !== 'undefined') {
      try {
        const savedLibStr = localStorage.getItem('sps_project_library');
        const library = savedLibStr ? JSON.parse(savedLibStr) : [];
        const found = library.find((p) => p.title === titleToApply);
        if (found && Array.isArray(found.shots) && found.shots.length > 0) {
          targetExistingShots = found.shots;
        }
      } catch (e) {
        /* ignore */
      }
    }

    if (targetExistingShots.length > 0 && !isSampleDemoShots(targetExistingShots)) {
      setMergePromptState({
        isOpen: true,
        projectTitle: titleToApply,
        existingCount: targetExistingShots.length,
        incomingCount: aiShots.length,
        pendingAiShots: aiShots,
        pendingTitle: titleToApply,
        existingShots: targetExistingShots,
        pendingExtraElements: extraElements
      });
      return;
    }

    proposeApplyShotsAndReview(aiShots, titleToApply, 'overwrite', extraElements);
  };

  const handleLoadTemplate = (template) => {
    const nextTitle = String(template?.title || '').toUpperCase();
    if (!canEditProjects()) {
      alert('🔒 READ-ONLY ACCESS:\nViewers cannot load templates into the active project.');
      return;
    }
    if (!canCreateOrDeleteProjects() && !canAccessProject(nextTitle)) {
      alert('🔒 ACCESS RESTRICTED:\nOnly the studio admin can create projects. Collaborators can open allotted projects only.');
      return;
    }
    setShots(template.shots);
    setProjectTitle(nextTitle);
    setAspectRatio(template.aspectRatio);
    setActiveShotIndex(0);
    setActiveView("spreadsheet");
    syncToCloud({
      shots: template.shots,
      projectTitle: nextTitle,
      aspectRatio: template.aspectRatio
    });
  };

  const exportJSONProject = () => {
    const filename = `${projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_sps_project.json`;
    const gate = assertExportAllowed({
      email: getCurrentUserEmail(),
      projectTitle,
      label: 'project_json',
      format: 'json',
      lifecycleMode: EXPORT_LIFECYCLE.ADVISORY,
      shots
    });
    if (!gate.ok) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      appName: "STAGE PRODUCTION STUDIO",
      exportVersion: "2.0",
      projectTitle,
      targetModel,
      aspectRatio,
      shots,
      projectGeneratedImages
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    logExportSuccess({ projectTitle, label: 'project_json', format: 'json', filename });
  };

  const importJSONProject = (e) => {
    if (!canCreateOrDeleteProjects()) {
      alert('🔒 ACCESS RESTRICTED:\nOnly the studio Admin can import projects.');
      if (e?.target) e.target.value = '';
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.shots && Array.isArray(json.shots)) {
          updateShotsWithHistory(json.shots);
          if (json.projectTitle) setProjectTitle(json.projectTitle);
          if (json.targetModel) setTargetModel(json.targetModel);
          if (json.aspectRatio) setAspectRatio(json.aspectRatio);
          if (json.projectGeneratedImages) {
            setProjectGeneratedImages(json.projectGeneratedImages);
            try {
              localStorage.setItem('sps_generated_images_map', JSON.stringify(json.projectGeneratedImages));
            } catch (e) {}
          }
          setActiveShotIndex(0);
          syncToCloud({
            shots: json.shots,
            projectTitle: json.projectTitle,
            targetModel: json.targetModel,
            aspectRatio: json.aspectRatio,
            projectGeneratedImages: json.projectGeneratedImages || {}
          });
        }
      } catch (err) {
        alert("Invalid project JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const currentShotObj = shots[activeShotIndex] || shots[0] || {};

  electronMenuRef.current = {
    saveProject: handleSaveProjectToApp,
    exportProject: exportJSONProject,
    importProject: importJSONProject,
    openNewProject: () => {
      if (isGuestSession() && !canGuestBrowseApp()) {
        alert(
          '🔒 GUEST ACCESS\n\nSign in to use Projects Console, or turn on Guest Browse in Settings.\n\nRequest access from the studio Admin.'
        );
        setIsInvestorDeckOpen(true);
        return;
      }
      setIsProjectConsoleOpen(true);
    },
  };

  const studioShellHidden = showSplash || isProjectConsoleOpen;

  return (
    <div className={`h-screen w-full flex flex-col selection:bg-[var(--sps-gold)]/30 overflow-hidden transition-colors duration-300 ${
      activeView === 'canvas'
        ? 'bg-black text-[var(--sps-text)] theme-dark'
        : colorTheme === 'paper' 
          ? 'theme-paper text-[var(--sps-text)]' 
          : 'bg-transparent text-[var(--sps-text)] theme-dark'
    }`} style={{ fontFamily: 'var(--sps-font)' }}>
      {showSplash && (
        <SplashScreen
          onFinish={() => {
            setShowSplash(false);
            (async () => {
              try {
                await hydrateGuestUrlFromServer();
                if (consumeGuestLookFromUrl() || canGuestBrowseApp()) {
                  enterGuestLookSession();
                  setIsLoginModalOpen(false);
                  return;
                }
                const email = getCurrentUserEmail();
                const loggedOut = localStorage.getItem('sps_user_manually_logged_out') === 'true';
                if (email && !loggedOut) {
                  sessionStorage.setItem('sps_session_authed', '1');
                  sessionStorage.setItem('sps_login_prompted', '1');
                  setIsLoginModalOpen(false);
                  setProjectConsoleInitialTab('library');
                  setIsProjectConsoleOpen(true);
                  return;
                }
              } catch {
                /* ignore */
              }
              // Start with presentation mode for visitors
              setPresentationMode(true);
              setIsLoginModalOpen(true);
            })();
          }}
        />
      )}
      {/* Top Header Bar — visible & pinned by default even in fullscreen */}
      {!studioShellHidden && (
        <div
          className={`sps-hover-chrome sps-app-hover-chrome ${
            headerMinimized && !headerPinned ? 'is-collapsed' : 'is-pinned'
          }${!headerPinned && headerMinimized && headerHoverOpen && !headerMinimizeArmed ? ' is-hover-open' : ''}${
            headerMinimizeArmed ? ' is-minimize-armed' : ''
          }`}
          onMouseEnter={() => {
            if (headerLeaveRef.current) clearTimeout(headerLeaveRef.current);
            if (headerMinimizeArmed) return;
            if (headerMinimized && !headerPinned) setHeaderHoverOpen(true);
          }}
          onMouseLeave={() => {
            if (headerLeaveRef.current) clearTimeout(headerLeaveRef.current);
            headerLeaveRef.current = setTimeout(() => {
              setHeaderMinimizeArmed(false);
              setHeaderHoverOpen(false);
            }, 160);
          }}
        >
        <button
          type="button"
          className="sps-chrome-reveal"
          aria-label="Show toolbar"
          title="Show toolbar"
          onClick={() => expandStudioHeader({ pin: true })}
        />
        <Header
          projectTitle={projectTitle}
          setProjectTitle={(val) => { setProjectTitle(val); syncToCloud({ projectTitle: val }); }}
          targetModel={targetModel}
          setTargetModel={(val) => { setTargetModel(val); syncToCloud({ targetModel: val }); }}
          aspectRatio={aspectRatio}
          setAspectRatio={(val) => { setAspectRatio(val); syncToCloud({ aspectRatio: val }); }}
          activeView={activeView}
          setActiveView={setActiveView}
          onExportProject={exportJSONProject}
          onImportProject={importJSONProject}
          onOpenCompiler={openCompiler}
          onOpenGenerateDesk={openGenerateDesk}
          onOpenPromoPack={() => { if (!guestMayLook('Promo')) return; goStudioRoom('promo'); }}
          onOpenCampaignKit={() => { if (!guestMayLook('Campaign')) return; goStudioRoom('campaign'); }}
          onOpenStoryboard={() => { if (!guestMayLook('Storyboard')) return; goStudioRoom('storyboard'); }}
          onOpenPitchDeck={() => { if (!guestMayLook('Pitch')) return; goStudioRoom('pitch'); }}
          onOpenBudgetConsole={openBudgetConsole}
          showBudgetConsole={canAccessBudgetConsole()}
          showPromoConsole={isStudioModuleEnabled('promo')}
          showPitchConsole={isStudioModuleEnabled('pitch')}
          showReelConsole={isStudioModuleEnabled('reel')}
          onOpenFeatureReel={() => {
            if (!isStudioModuleEnabled('reel')) return;
            if (!guestMayLook('Reel')) return;
            setIsFeatureReelOpen(true);
          }}
          onOpenCloudModal={() => { setAdminModalTab('cloud_collab'); setIsAdminModalOpen(true); }}
          onOpenAdminModal={() => { setAdminModalTab('all'); setIsAdminModalOpen(true); }}
          onOpenProjectConsole={() => {
            if (isGuestSession() && !canGuestBrowseApp()) {
              alert(
                '🔒 GUEST ACCESS\n\nSign in to use Projects Console, or turn on Guest Browse in Settings.\n\nRequest access from the studio Admin.'
              );
              setIsInvestorDeckOpen(true);
              return;
            }
            setProjectConsoleInitialTab('library');
            setIsProjectConsoleOpen(true);
          }}
          onOpenCharacterBible={handleOpenCharactersModal}
          onOpenWorldEnvironment={handleOpenWorldEnvironment}
          onOpenWriterConsole={openWriterConsole}
          onOpenHelpModal={() => setIsHelpModalOpen(true)}
          onOpenStudioBrain={() => setIsStudioBrainOpen(true)}
          onOpenNavigator={() => setIsNavigatorOpen((open) => !open)}
          onOpenNavigatorShortcutHelp={() => openNavigatorShortcutHelp()}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onSwitchAccount={handleStudioSwitchAccount}
          onLogout={handleStudioLogout}
          onOpenInvestorDeck={() => setIsInvestorDeckOpen(true)}
          appVersionMode={appVersionMode}
          onOpenAppVersionModal={() => setIsAppVersionModalOpen(true)}
          roomId={roomId}
          collaboratorCount={Math.max(collaborators.length, activeRemoteUsers.length + 1)}
          activeRemoteUsers={activeRemoteUsers}
          isAdminLoggedIn={isAdminLoggedIn}
          showCanvasTab={isStudioModuleEnabled('stage')}
          onSaveProject={handleSaveProjectToApp}
          onDurableProjectSave={handleDurableProjectSave}
          autoSaveIntervalId={autoSaveIntervalId}
          onChangeAutoSaveInterval={handleChangeAutoSaveInterval}
          lastDurableSaveAt={lastDurableSaveAt}
          lastVersionFile={lastVersionFile}
          isDurableSaving={isDurableSaving}
          isProjectSavedToast={isProjectSavedToast}
          isCloudSyncing={isCloudSyncing}
          shotCount={shots.length}
          shots={shots}
          colorTheme={colorTheme}
          onChangeColorTheme={handleSetColorTheme}
          presetProfile={presetProfile}
          onChangePresetProfile={handleSetPresetProfile}
          canUndo={historyStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          undoCount={historyStack.length}
          redoCount={redoStack.length}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => toggleFullscreenMode()}
          onMinimizeHeader={collapseStudioHeader}
          headerPinned={headerPinned}
          onTogglePinHeader={() => {
            if (headerPinned) {
              collapseStudioHeader();
              return;
            }
            setHeaderPinned(true);
            setHeaderMinimized(false);
            setHeaderMinimizeArmed(false);
            setHeaderHoverOpen(false);
          }}
          onOpenCollabChat={() => {
            setIsCollabChatOpen((v) => !v);
            setUnreadChatCount(0);
            try {
              localStorage.setItem(`sps_chat_last_seen_${effectiveRoomId}`, String(Date.now()));
            } catch (e) {}
          }}
          collabChatOpen={isCollabChatOpen}
          unreadChatCount={unreadChatCount}
        />
        </div>
      )}

      {isGuestSession() && canGuestBrowseApp() && !studioShellHidden && (
        <div className="shrink-0 px-3 py-1.5 text-[11px] text-center border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)]" style={{ color: 'var(--sps-muted)' }}>
          Guest playground — dummy film only. Play in the rooms. Studio titles stay locked. Sign in for the real library.
        </div>
      )}

      {/* Main Studio Body View — keep off-screen during splash / project console */}
      <main
        className="flex-1 w-full flex flex-col overflow-hidden min-h-0 sps-workspace is-flush"
        hidden={studioShellHidden}
        aria-hidden={studioShellHidden}
      >
        
        {/* DYNAMICALLY SEGREGATED WORKSPACE VIEW CONTAINER */}
        <div key={activeView} className="flex-1 w-full min-h-0 overflow-hidden flex flex-col sps-view-enter">

          {activeView === 'demo' && (
            <DemoModeView
              onOpenLogin={(mode = 'signin') => {
                setLoginInitialMode(mode);
                setIsLoginModalOpen(true);
              }}
            />
          )}
          
          {/* TAB 1: 3D STAGE (Director Canvas) — edge-to-edge */}
          {isStudioModuleEnabled('stage') && activeView === 'canvas' && (
            <div className="flex-1 w-full h-full overflow-hidden min-h-0 m-0 p-0">
              <DirectorCanvas
                shot={currentShotObj}
                aspectRatio={aspectRatio}
                shots={shots}
                activeShotIndex={activeShotIndex}
                setActiveShotIndex={setActiveShotIndex}
                setAspectRatio={(val) => { setAspectRatio(val); syncToCloud({ aspectRatio: val }); }}
                projectTitle={projectTitle}
                isFullscreen={isFullscreen}
                onMinimizeHeader={collapseStudioHeader}
                onUpdateShot={handleUpdateShot}
                autoSaveIntervalId={autoSaveIntervalId}
                onOpenAdminSettings={(tab) => {
                  setAdminModalTab(tab || 'all');
                  setIsAdminModalOpen(true);
                }}
              />
            </div>
          )}

          {/* TAB 0: 📝 SCREENPLAY WRITER STUDIO */}
          {activeView === 'screenplay' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <ScreenplayEditor
                shots={shots}
                onUpdateShotsFromScript={handleUpdateShotsFromScript}
                onNavigateToView={setActiveView}
                onOpenLlmCommands={() => setIsLlmCommandReviewOpen(true)}
                onApplyShots={handleApplyAIShots}
                setPresetProfile={handleSetPresetProfile}
                projectTitle={projectTitle}
                initialConsoleTab={writerConsoleTab}
                onOpenCharacters={handleOpenCharactersModal}
                roomId={effectiveRoomId}
              />
            </div>
          )}

          {/* TAB 2: 📊 FULL STAGE MATRIX (24-CRAFTS) SPREADSHEET VIEW (Full 100% Height for 24 Crafts Table) */}
          {activeView === 'spreadsheet' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <SpreadsheetView
                slots={activeSlots}
                shots={shots}
                activeShotIndex={activeShotIndex}
                setActiveShotIndex={setActiveShotIndex}
                onUpdateShot={handleUpdateShot}
                onUpdateShots={(next) => {
                  updateShotsWithHistory(next);
                  syncToCloud({ shots: next, projectTitle });
                }}
                onAddShot={handleAddShot}
                onDeleteShot={handleDeleteShot}
                onToggleMuteShot={handleToggleMuteShot}
                onCloneShot={handleCloneShot}
                onMoveShot={handleMoveShot}
                onReorderShots={handleReorderShots}
                onCompilePrompt={openCompiler}
                onOpenReel={() => setIsFeatureReelOpen(true)}
                onOpenGenerate={openGenerateDesk}
                colorTheme={colorTheme}
                genreKey={presetProfile}
                lookOnly={isGuestSession() && !canGuestBrowseApp()}
                projectTitle={projectTitle}
                onOpenLlmCommands={() => setIsLlmCommandReviewOpen(true)}
              />
            </div>
          )}

          {/* TAB 3: STUDIO FORM VIEW */}
          {activeView === 'form' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <StudioFormView
                shots={shots}
                activeShotIndex={activeShotIndex}
                onSelectShot={setActiveShotIndex}
                onUpdateShot={handleUpdateShot}
                onAddShot={handleAddShot}
                allShotsList={shots}
                colorTheme={colorTheme}
                genreKey={presetProfile}
                projectTitle={projectTitle}
                onOpenLlmCommands={() => setIsLlmCommandReviewOpen(true)}
              />
            </div>
          )}

          {activeView === 'cast' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <Suspense fallback={null}>
              <CharacterBibleModal
                asRoom
                isOpen
                shots={shots}
                projectTitle={projectTitle}
                initialTab={characterBibleTab || 'roster'}
                onClose={() => setActiveView('spreadsheet')}
              />
              </Suspense>
            </div>
          )}

          {activeView === 'promo' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <Suspense fallback={null}>
              <PromoPackModal
                asRoom
                isOpen
                shots={shots}
                projectTitle={projectTitle}
                aspectRatio={aspectRatio}
                genreKey={presetProfile}
                lookOnly={isGuestSession() && !canGuestBrowseApp()}
              />
              </Suspense>
            </div>
          )}

          {activeView === 'campaign' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <Suspense fallback={null}>
              <CampaignKitModal
                asRoom
                isOpen
                shots={shots}
                projectTitle={projectTitle}
                genreKey={presetProfile}
                lookOnly={isGuestSession() && !canGuestBrowseApp()}
              />
              </Suspense>
            </div>
          )}

          {activeView === 'storyboard' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <Suspense fallback={null}>
              <StoryboardModal
                asRoom
                isOpen
                shots={shots}
                projectTitle={projectTitle}
                aspectRatio={aspectRatio}
                generatedMap={projectGeneratedImages}
                lookOnly={isGuestSession() && !canGuestBrowseApp()}
                onOpenShot={(idx) => {
                  setActiveShotIndex(idx);
                  goStudioRoom('form');
                }}
              />
              </Suspense>
            </div>
          )}

          {activeView === 'pitch' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <Suspense fallback={null}>
              <PitchDeckModal
                asRoom
                isOpen
                shots={shots}
                projectTitle={projectTitle}
                aspectRatio={aspectRatio}
                genreKey={presetProfile}
                lookOnly={isGuestSession() && !canGuestBrowseApp()}
              />
              </Suspense>
            </div>
          )}

          {activeView === 'budget' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <Suspense fallback={null}>
              <BudgetConsoleModal
                asRoom
                isOpen
                projectTitle={projectTitle}
                shots={shots}
                lookOnly={isLookOnlySession()}
              />
              </Suspense>
            </div>
          )}

          {/* TEMPLATES TAB */}
          {activeView === 'templates' && (
            <div className="flex-1 w-full h-full overflow-y-auto pr-1">
              <TemplateSelector onLoadTemplate={handleLoadTemplate} />
            </div>
          )}

        </div>
      </main>

      <Suspense fallback={null}>
      {isCompilerOpen && (
      <PromptCompilerModal
        isOpen={isCompilerOpen}
        onClose={() => setIsCompilerOpen(false)}
        shots={shots}
        onUpdateShot={handleUpdateShot}
        activeTargetModel={targetModel}
        projectTitle={projectTitle}
        colorTheme={colorTheme}
        onOpenWriterSynopsis={() => {
          setIsCompilerOpen(false);
          openWriterConsole('synopsis');
        }}
        onEditShotInForm={(shotIdx) => {
          setIsCompilerOpen(false);
          setActiveShotIndex(shotIdx);
          setActiveView('form');
        }}
      />
      )}

      {isGenerateDeskOpen && (
      <GenerateDeskModal
        isOpen={isGenerateDeskOpen}
        onClose={() => setIsGenerateDeskOpen(false)}
        shots={shots}
        activeShotIndex={activeShotIndex}
        setActiveShotIndex={setActiveShotIndex}
        projectTitle={projectTitle}
        onSaveTake={handleEmbedImageToProject}
        onSaveVideo={handleEmbedVideoToProject}
        onOpenCompiler={openCompiler}
        onOpenReel={() => setIsFeatureReelOpen(true)}
        onOpenStage={isStudioModuleEnabled('stage') ? () => setActiveView('canvas') : undefined}
        onUpdateShot={handleUpdateShot}
      />
      )}

      {isFeatureReelOpen && (
      <FeatureReelModal
        isOpen={isFeatureReelOpen}
        onClose={() => setIsFeatureReelOpen(false)}
        shots={shots}
        projectTitle={projectTitle}
        activeShotIndex={activeShotIndex}
        setActiveShotIndex={setActiveShotIndex}
        onOpenShot={(idx) => {
          setActiveShotIndex(idx);
          setIsFeatureReelOpen(false);
          setActiveView('spreadsheet');
        }}
      />
      )}

      {isAdminModalOpen && (
      <AdminSettingsModal
        isOpen={isAdminModalOpen}
        onClose={() => {
          setIsAdminModalOpen(false);
          setAdminModalTab('all'); // prevent cloud_collab (or any deep-link) sticking for next open
        }}
        targetModel={targetModel}
        setTargetModel={(val) => { setTargetModel(val); syncToCloud({ targetModel: val }); }}
        isAdminLoggedIn={isAdminLoggedIn}
        setIsAdminLoggedIn={handleSetAdminLoggedIn}
        onToggleCanvasTab={(enabled) => {
          setShowCanvasTab(enabled);
          if (!enabled && activeView === 'canvas') {
            setActiveView('spreadsheet');
          }
        }}
        roomId={roomId}
        setRoomId={setRoomId}
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        collaborators={collaborators}
        isCloudSyncing={isCloudSyncing}
        initialCategoryTab={adminModalTab}
        colorTheme={colorTheme}
      />
      )}

      {isProjectConsoleOpen && (
      <ProjectConsoleModal
        isOpen={isProjectConsoleOpen}
        onClose={() => setIsProjectConsoleOpen(false)}
        initialTab={projectConsoleInitialTab}
        initialVaultCategory={projectConsoleInitialVault}
        currentProjectTitle={projectTitle}
        setProjectTitle={(val) => { setProjectTitle(val); syncToCloud({ projectTitle: val }); }}
        shots={shots}
        setShots={(val) => { if (updateShotsWithHistory(val)) syncToCloud({ shots: val }); }}
        targetModel={targetModel}
        setTargetModel={(val) => { setTargetModel(val); syncToCloud({ targetModel: val }); }}
        aspectRatio={aspectRatio}
        setAspectRatio={(val) => { setAspectRatio(val); syncToCloud({ aspectRatio: val }); }}
        roomId={roomId}
        setRoomId={setRoomId}
        presetProfile={presetProfile}
        setPresetProfile={handleSetPresetProfile}
        isAdminLoggedIn={isAdminLoggedIn}
        onOpenInvestorDeck={() => setIsInvestorDeckOpen(true)}
        onOpenLogin={() => {
          setLoginOverlayMode('switch');
          setIsLoginModalOpen(true);
        }}
        onSwitchAccount={handleStudioSwitchAccount}
        onLogout={handleStudioLogout}
        onOpenNavigatorShortcutHelp={() => openNavigatorShortcutHelp()}
        onOpenAdminSettings={(tab) => {
          setAdminModalTab(tab || 'all');
          setIsAdminModalOpen(true);
        }}
        onApplyShots={handleApplyAIShots}
        colorTheme={colorTheme}
      />
      )}

      {isInvestorDeckOpen && (
      <InvestorDeckModal
        isOpen={isInvestorDeckOpen}
        onClose={() => setIsInvestorDeckOpen(false)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        projectTitle={projectTitle}
        shots={shots}
      />
      )}

      {/* 2-Factor Phone & OTP Security Guard for Shared Invite Links */}
      <PhoneOtpGuardModal
        currentRoomId={roomId}
        onUnlock={() => {
          enableCloudCollaborationMode();
          setAppVersionMode('cloud');
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const roomParam = params.get('room');
            if (roomParam) setRoomId(roomParam);
          }
        }}
      />

      {isHelpModalOpen && (
      <HelpUserGuideModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        isAdminLoggedIn={isAdminLoggedIn}
      />
      )}
      {isStudioBrainOpen && (
      <StudioBrainModal
        isOpen={isStudioBrainOpen}
        onClose={() => setIsStudioBrainOpen(false)}
      />
      )}
      {isProductionDashboardOpen && (
      <ProductionDashboardModal
        isOpen={isProductionDashboardOpen}
        onClose={() => setIsProductionDashboardOpen(false)}
        projectTitle={projectTitle}
        shots={shots}
        onOpenLlmCommands={() => setIsLlmCommandReviewOpen(true)}
        onUpdateShots={(next) => {
          updateShotsWithHistory(next);
          syncToCloud({ shots: next, projectTitle });
        }}
        onUpdateShot={handleUpdateShot}
        onOpenCharacterBible={handleOpenCharactersModal}
        onOpenWorld={handleOpenWorldEnvironment}
        onOpenDirectorVault={() => {
          setProjectConsoleInitialVault('director');
          setProjectConsoleInitialTab('director_psychology');
          setIsProjectConsoleOpen(true);
          setIsProductionDashboardOpen(false);
        }}
        onOpenDopVault={() => {
          setProjectConsoleInitialVault('dop');
          setProjectConsoleInitialTab('director_psychology');
          setIsProjectConsoleOpen(true);
          setIsProductionDashboardOpen(false);
        }}
        onOpenSoundVault={() => {
          setProjectConsoleInitialVault('sound');
          setProjectConsoleInitialTab('director_psychology');
          setIsProjectConsoleOpen(true);
          setIsProductionDashboardOpen(false);
        }}
      />
      )}
      {isLlmCommandReviewOpen && (
      <LlmCommandReviewModal
        isOpen={isLlmCommandReviewOpen}
        onClose={() => setIsLlmCommandReviewOpen(false)}
        projectTitle={projectTitle}
        shots={shots}
        onUpdateShot={handleUpdateShot}
        onApplyShots={(nextShots, mode, extras) =>
          executeApplyAIShots(nextShots, projectTitle, mode || 'overwrite', mode === 'merge' ? shots : [], extras)
        }
      />
      )}

      {/* Gmail Login & Account Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        overlayMode={loginOverlayMode}
        initialMode={loginInitialMode}
        onClose={() => {
          setIsLoginModalOpen(false);
          setLoginOverlayMode('default');
          setLoginInitialMode('signin');
        }}
        setIsAdminLoggedIn={handleSetAdminLoggedIn}
        onOpenAppDemo={() => setIsStudioTourOpen(true)}
        onOpenDesktopTrial={() => {
          setIsLoginModalOpen(false);
          setLoginOverlayMode('default');
          setLoginInitialMode('signin');
          setIsDesktopTrialOpen(true);
        }}
      />
      <DesktopTrialModal isOpen={isDesktopTrialOpen} onClose={() => setIsDesktopTrialOpen(false)} />

      {/* Real-Time Active User Slot Conflict Alert Modal */}
      <ConflictAlertModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        conflictData={activeConflict}
        onPullCloudVersion={async () => {
          setIsConflictModalOpen(false);
          const cloudProjects = await fetchProjectLibraryFromCloud();
          if (Array.isArray(cloudProjects)) {
            const matchProj = cloudProjects.find(p => p.title === projectTitle);
            if (matchProj && Array.isArray(matchProj.shots)) setShots(matchProj.shots);
          }
        }}
        onMergeShots={() => {
          setIsConflictModalOpen(false);
          handleSaveProjectToApp();
        }}
        onKeepLocal={() => {
          setIsConflictModalOpen(false);
        }}
      />

      {/* Interactive Script Breakdown Overwrite vs Merge Choice Modal */}
      <ScriptMergePromptModal
        isOpen={mergePromptState.isOpen}
        projectTitle={mergePromptState.projectTitle}
        existingCount={mergePromptState.existingCount}
        incomingCount={mergePromptState.incomingCount}
        onOverwrite={() => {
          const { pendingAiShots, pendingTitle, pendingExtraElements } = mergePromptState;
          const pkg = readStoryPackageForTitle(pendingTitle);
          const gate = assertMergeApplyAllowed({
            activeTitle: projectTitle,
            pkg: pkg?.proposedShots?.length
              ? pkg
              : {
                  projectTitle: pendingTitle,
                  status: 'ready',
                  proposedShots: pendingAiShots,
                  updatedAt: new Date().toISOString()
                },
            mode: 'overwrite',
            intendedTitle: pendingTitle,
            existingShotCount: mergePromptState.existingCount,
            incomingCount: pendingAiShots.length,
            auditLabel: 'console_merge_overwrite'
          });
          if (!gate.ok) {
            alert(gate.message);
            return;
          }
          setMergePromptState((prev) => ({ ...prev, isOpen: false }));
          proposeApplyShotsAndReview(
            pendingAiShots,
            pendingTitle,
            'overwrite',
            pendingExtraElements,
            'console_apply_merge'
          );
        }}
        onMerge={() => {
          const { pendingAiShots, pendingTitle, pendingExtraElements } = mergePromptState;
          const pkg = readStoryPackageForTitle(pendingTitle);
          const gate = assertMergeApplyAllowed({
            activeTitle: projectTitle,
            pkg: pkg?.proposedShots?.length
              ? pkg
              : {
                  projectTitle: pendingTitle,
                  status: 'ready',
                  proposedShots: pendingAiShots,
                  updatedAt: new Date().toISOString()
                },
            mode: 'merge',
            intendedTitle: pendingTitle,
            existingShotCount: mergePromptState.existingCount,
            incomingCount: pendingAiShots.length,
            auditLabel: 'console_merge_append'
          });
          if (!gate.ok) {
            alert(gate.message);
            return;
          }
          setMergePromptState((prev) => ({ ...prev, isOpen: false }));
          proposeApplyShotsAndReview(
            pendingAiShots,
            pendingTitle,
            'merge',
            pendingExtraElements,
            'console_apply_merge'
          );
        }}
        onCancel={() => {
          setMergePromptState(prev => ({ ...prev, isOpen: false }));
        }}
      />

      {/* App Version Mode Selection Modal (Local Version vs Cloud Version) */}
      <AppVersionSelectorModal
        isOpen={isAppVersionModalOpen}
        onClose={() => setIsAppVersionModalOpen(false)}
        currentMode={appVersionMode}
        onSelectMode={handleSelectAppVersionMode}
      />

      {isWorldEnvironmentOpen && (
      <WorldEnvironmentConsole
        isOpen={isWorldEnvironmentOpen}
        onClose={() => setIsWorldEnvironmentOpen(false)}
        shots={shots}
        projectTitle={projectTitle}
      />
      )}
      </Suspense>

      {/* Project save confirmation toast */}
      {isProjectSavedToast && (
        <div className="fixed top-16 right-4 z-50 p-3.5 rounded-2xl bg-slate-950/95 border-2 border-cyan-500 text-cyan-200 font-mono text-xs font-bold shadow-[0_10px_40px_rgba(6,182,212,0.4)] flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="p-1.5 rounded-lg bg-cyan-500 text-slate-950">
            <Check className="w-4 h-4" />
          </div>
          <span>
            {lastVersionFile
              ? `Project saved · ${lastVersionFile}`
              : 'Project saved to disk vault'}
          </span>
        </div>
      )}
      {studioToast ? (
        <div className="fixed top-16 right-4 z-[60] max-w-sm p-3 rounded-lg border border-[var(--sps-gold)]/50 bg-[var(--sps-bg-elevated)] text-[var(--sps-gold)] font-mono text-[11px] shadow-lg">
          {studioToast}
        </div>
      ) : null}

      {!isNavigatorOpen && (
        <button
          type="button"
          className="sps-nav-edge-hit"
          aria-label="Open navigator. On phone: swipe in from the left edge, or two-finger tap."
          title="Navigator"
          onClick={() => setIsNavigatorOpen(true)}
        />
      )}

      <MobileGestureHelp
        hidden={showSplash || isNavigatorOpen}
        onOpenNavigator={() => setIsNavigatorOpen(true)}
      />

      <NavigatorShortcutChip
        hidden={showSplash || isNavigatorOpen || isLoginModalOpen}
        onOpenNavigator={() => setIsNavigatorOpen(true)}
        roleHint={
          isGuestSession()
            ? 'Browse rooms — Shift + Space'
            : 'Jump rooms & tools — Shift + Space'
        }
      />

      <StudioTourOverlay
        isOpen={isStudioTourOpen}
        onClose={() => setIsStudioTourOpen(false)}
      />

      <StudioNavigator
        isOpen={isNavigatorOpen}
        onClose={() => setIsNavigatorOpen(false)}
        items={navigatorItems}
      />

      <CollabChatPanel
        isOpen={isCollabChatOpen}
        onClose={() => setIsCollabChatOpen(false)}
        roomId={effectiveRoomId}
        projectTitle={projectTitle}
        shots={shots}
        activeShotId={currentShotObj?.sceneShotId || ''}
        activeRemoteUsers={activeRemoteUsers}
        allLiveUsers={allLiveUsers}
        currentUserEmail={typeof window !== 'undefined' ? (localStorage.getItem('sps_authorized_user_email') || '') : ''}
        colorTheme={colorTheme}
      />
    </div>
  );
}
