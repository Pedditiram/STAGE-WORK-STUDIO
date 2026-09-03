import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  X, Folder, Plus, Copy, Check, Trash2, Edit3, Share2, History, Layers, 
  RefreshCw, Download, ExternalLink, ShieldAlert, Sparkles, 
  CheckCircle2, Clock, Globe, ArrowRight, Wand2, Upload, Loader2, FolderKanban, Sliders, Maximize2,
  Brain, Camera, Music2, Ratio, KeyRound, Play, Archive, RotateCcw, ChevronDown,
  LayoutGrid, PanelLeft, Settings, Lock
} from 'lucide-react';
import { 
  composeDirectorPsychologyWithLLM, composeHybridVisionMergeWithLLM,
  composeDoPVisionWithLLM, composeSoundVisionWithLLM,
  composeHybridDoPVisionMergeWithLLM, composeHybridSoundVisionMergeWithLLM
} from '../services/aiScriptParser';
import { GENRE_PRESET_PROFILES, getMergedGenreProfiles } from '../constants/seedancePresets';
import {
  saveDirectorPsychology
} from '../utils/directorPsychologyStorage';
import { saveDoPVision, saveSoundVision } from '../utils/departmentVisionStorage';
import { directorPsychologyToPrintHtml, directorPsychologyToCsv, buildDirectorPsychologyZipFiles } from '../utils/directorPsychologyExport';
import { assertExportAllowed, exportDownloadText, logExportSuccess } from '../utils/exportGate';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import {
  syncProjectLibraryToCloud,
  fetchProjectLibraryFromCloud,
  syncCollaboratorsToCloud,
  clearDeletedProjectTitles,
  filterOutDeletedProjects,
  isProjectTitleDeleted,
  archiveProjectSnapshot,
  getArchivedProjects,
  restoreProjectFromArchive,
  purgeArchivedProject,
  healActiveProjectFromArchive
} from '../services/dbService';
import { 
  saveProjectToVault, loadProjectsFromVault, exportProjectPackageToFile, importProjectPackageFromFile,
  loadProjectFromDiskByTitle, saveActiveWorkspaceToDisk,
  saveProjectPoster, listProjectPostersFromDisk, posterApiUrl, ensureElectronPosterRefs
} from '../services/projectDiskVault';
import {
  ASSET_ROOT_KEYS,
  ASSET_ROOT_LABELS,
  PROJECT_PATH_KEYS,
  PROJECT_PATH_LABELS,
  defaultAssetRootsUnder,
  extractStudioRootFromAssetPath,
  nestAssetRootsUnderProjectName,
  normalizeAssetRoots,
  sanitizeProjectFolderName,
  stampAssetRootsIntoLibrary
} from '../utils/projectAssetRoots';
import {
  pickDirectoryPath,
  pickAndOpenProjectFolder,
  saveProjectAssetRoots
} from '../utils/projectAssetRootsClient';
import { optimizePosterDataUrl } from '../utils/projectPosterImage';
import ProjectDrivePanel from './ProjectDrivePanel';
import AiScriptBreakdownPanel from './AiScriptBreakdownPanel';
import { PinBarButton } from './HoverPinBar';
import StudioProfileControl from './StudioProfileControl';
import {
  getCurrentUserEmail,
  getCurrentUserProfile,
  isGuestSession,
  canGuestBrowseApp,
  canAccessProject,
  canCreateOrDeleteProjects,
  filterAccessibleProjects,
  stripTitleFromAllottedProjects,
  ensurePrimaryAdminUser,
  sanitizeAuthorizedUsers
} from '../utils/projectPermissions';
import { applyOpenWorkspace, roomIdForProject, writeWorkspaceOntoLibrary, migrateLegacyRoomInLibrary, writeLocalProjectLibrary, slimProjectForLocalMirror, mergeLibrarySources, readLocalProjectLibrary, hydrateProjectLibraryFromStores, titlesMatch } from '../utils/projectWorkspace';
import { safeLocalStorageSetItem } from '../utils/safeStorage';
import { putImageDataUrl, resolveImageUrl, isImageRef } from '../utils/imageBlobStore';
import { PRODUCTION_ORIGIN } from '../utils/runtimeEnv';

const LIBRARY_VIEW_KEY = 'sps_project_library_view';
const CONSOLE_TOOLBAR_PIN_KEY = 'sps_pin_project_console_toolbar';

function readLibraryViewMode() {
  try {
    return localStorage.getItem(LIBRARY_VIEW_KEY) === 'gallery' ? 'gallery' : 'detail';
  } catch {
    return 'detail';
  }
}

export default function ProjectConsoleModal({
  isOpen,
  onClose,
  currentProjectTitle,
  setProjectTitle,
  shots,
  setShots,
  targetModel,
  setTargetModel,
  aspectRatio,
  setAspectRatio,
  roomId,
  setRoomId,
  presetProfile = 'mythological',
  setPresetProfile,
  onExportProject,
  onImportProject,
  initialTab,
  initialVaultCategory = 'director',
  isAdminLoggedIn = false,
  onOpenInvestorDeck,
  onOpenLogin,
  onOpenAdminSettings,
  onLogout,
  onSwitchAccount,
  onOpenNavigatorShortcutHelp,
  onApplyShots
}) {
  // Guests must never remain in Project Console — redirect to Investor Deck
  useEffect(() => {
    if (!isOpen) return;
    if (!isGuestSession()) return;
    if (canGuestBrowseApp()) return;
    onClose?.();
    if (onOpenInvestorDeck) onOpenInvestorDeck();
    else if (onOpenLogin) onOpenLogin();
  }, [isOpen, onClose, onOpenInvestorDeck, onOpenLogin]);


  const getProjectPosterStyle = (title = '') => {
    const tUpper = (title || '').toUpperCase();
    if (tUpper.includes('RAM') || tUpper.includes('SRI') || tUpper.includes('MYTHOLOGY')) {
      return {
        gradient: 'from-amber-950 via-zinc-950 to-black',
        borderColor: 'border-amber-500/50',
        textColor: 'text-amber-300',
        badgeBg: 'bg-zinc-950/90 text-amber-300 border-amber-500/60 shadow-md font-black',
        icon: '🔱',
        genre: 'Indian Mythology & Period Epic',
        genreKey: 'mythological',
        tagline: 'DIRECTOR CINEMA SUITE'
      };
    }
    if (tUpper.includes('KARA') || tUpper.includes('WAR') || tUpper.includes('DUSHAN') || tUpper.includes('ACTION')) {
      return {
        gradient: 'from-red-950 via-zinc-950 to-black',
        borderColor: 'border-red-500/50',
        textColor: 'text-red-400',
        badgeBg: 'bg-zinc-950/90 text-red-300 border-red-500/60 shadow-md font-black',
        icon: '⚔️',
        genre: 'High-Octane Action Epic',
        genreKey: 'action',
        tagline: 'PAN-INDIA CINEMA EPIC'
      };
    }
    if (tUpper.includes('CYBER') || tUpper.includes('MUSIC') || tUpper.includes('NEO') || tUpper.includes('NIGHT')) {
      return {
        gradient: 'from-cyan-950 via-purple-950 to-zinc-950',
        borderColor: 'border-cyan-500/50',
        textColor: 'text-cyan-300',
        badgeBg: 'bg-zinc-950/90 text-cyan-300 border-cyan-500/60 shadow-md font-black',
        icon: '🎧',
        genre: 'Neon Cyberpunk Music Video',
        genreKey: 'cyberpunk',
        tagline: 'NEO-NOIR VISUAL SUITE'
      };
    }
    return {
      gradient: 'from-purple-950 via-zinc-950 to-zinc-900',
      borderColor: 'border-purple-500/50',
      textColor: 'text-purple-300',
      badgeBg: 'bg-zinc-950/90 text-purple-300 border-purple-500/60 shadow-md font-black',
      icon: '🎬',
      genre: 'Stage Production Feature',
      genreKey: 'mythological',
      tagline: 'STAGE STUDIO CINEMA'
    };
  };

  const inferGenreKeyFromTitle = (title = '') => getProjectPosterStyle(title).genreKey || 'mythological';

  const resolveProjectGenreKey = (proj) => {
    const profiles = getMergedGenreProfiles();
    const key = proj?.genreKey || proj?.presetProfile;
    if (key && profiles[key]) return key;
    return inferGenreKeyFromTitle(proj?.title);
  };

  const resolveProjectGenreLabel = (proj) => {
    if (proj?.genreLabel) return proj.genreLabel;
    const profiles = getMergedGenreProfiles();
    const key = resolveProjectGenreKey(proj);
    const profile = profiles[key];
    return profile?.label || profile?.name || getProjectPosterStyle(proj?.title).genre;
  };

  // Project Library state stored in localStorage 'sps_project_library'
  const [projectLibrary, setProjectLibrary] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_project_library');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return filterOutDeletedProjects(parsed);
          }
        } catch (e) {}
      }
    }
    return [
      {
        id: 'proj_default',
        title: currentProjectTitle || 'STAGE PRODUCTION STUDIO',
        description: 'Primary stage production master project',
        targetModel: targetModel || 'SPS Direct Cinema 2.0',
        aspectRatio: aspectRatio || '2.39:1 Anamorphic',
        roomId: roomIdForProject(currentProjectTitle || 'STAGE PRODUCTION STUDIO', roomId),
        lastModified: new Date().toLocaleDateString(),
        shots: shots,
        versions: [
          {
            versionId: 'v_1_0',
            versionName: 'v1.0 Initial Shot Sequence',
            createdAt: new Date().toLocaleTimeString() + ' - ' + new Date().toLocaleDateString(),
            shots: shots
          }
        ]
      }
    ];
  });

  const [archivedProjects, setArchivedProjects] = useState(() => getArchivedProjects());
  const [libraryHydrated, setLibraryHydrated] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setProjectLibrary((prev) => {
      const migrated = migrateLegacyRoomInLibrary(prev);
      const changed = migrated.some((p, i) => p?.roomId !== prev[i]?.roomId);
      if (changed) safeLocalStorageSetItem('sps_project_library', JSON.stringify(migrated));
      return changed ? migrated : prev;
    });
  }, [isOpen]);

  const [activeTab, setActiveTab] = useState(
    initialTab === 'genre' ? 'library' : (initialTab || 'library')
  ); // 'library' | 'ai_breakdown' | 'director_psychology' | 'create' | 'share'
  const [copiedLink, setCopiedLink] = useState(false);
  const importFileRef = React.useRef(null);
  const posterFileInputRef = React.useRef(null);
  const posterDblTapRef = React.useRef({ id: null, t: 0 });
  const [targetPosterProjId, setTargetPosterProjId] = useState(null);
  const [assetFoldersProjId, setAssetFoldersProjId] = useState(null);
  const [libraryView, setLibraryView] = useState(readLibraryViewMode);

  const setLibraryViewMode = (mode) => {
    const next = mode === 'gallery' ? 'gallery' : 'detail';
    setLibraryView(next);
    try {
      localStorage.setItem(LIBRARY_VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  };

  // 100% Native & UI Fullscreen Mode State & Browser API sync
  const [isVaultFullscreen, setIsVaultFullscreen] = useState(false);

  const toggleFullscreenMode = async (enable) => {
    const targetState = typeof enable === 'boolean' ? enable : !isVaultFullscreen;
    setIsVaultFullscreen(targetState);
    try {
      if (targetState) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) await elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
      } else {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Native fullscreen toggle error:', err);
    }
  };

  // Keyboard shortcut listener for Cmd+Enter / Ctrl+Enter (Toggle Full Screen)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreenMode();
        return;
      }
      if (e.key === 'Escape') {
        if (isVaultFullscreen) {
          e.preventDefault();
          setIsVaultFullscreen(false);
          return;
        }
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isVaultFullscreen]);

  // Selected project & active vault category ('director' | 'dop' | 'sound')
  const [selectedPsychologyProjId, setSelectedPsychologyProjId] = useState(null);
  const [vaultCategory, setVaultCategory] = useState(initialVaultCategory === 'dop' || initialVaultCategory === 'sound' ? initialVaultCategory : 'director'); // 'director' | 'dop' | 'sound'
  const {
    strict: directorLifecycleStrict,
    mode: directorLifecycleMode
  } = useExportLifecyclePref('director');
  const {
    strict: dopLifecycleStrict,
    mode: dopLifecycleMode
  } = useExportLifecyclePref('dop');
  const {
    strict: soundLifecycleStrict,
    mode: soundLifecycleMode
  } = useExportLifecyclePref('sound');
  const directorExportLife = useMemo(
    () => lifecycleExportReadiness(shots, currentProjectTitle),
    [shots, currentProjectTitle]
  );
  const directorExportBlocked = directorLifecycleStrict && !directorExportLife.exportReady;
  const dopExportBlocked = dopLifecycleStrict && !directorExportLife.exportReady;
  const soundExportBlocked = soundLifecycleStrict && !directorExportLife.exportReady;

  // Resolve current active target project for Vision Vault (allotted projects only for collaborators)
  const vaultVisibleLibrary = filterAccessibleProjects(projectLibrary, getCurrentUserEmail());
  const targetPsychologyProj =
    vaultVisibleLibrary.find((p) => p.id === selectedPsychologyProjId || p.title === currentProjectTitle) ||
    vaultVisibleLibrary[0];

  // Helper to normalize multi-mode Director psychology data
  const normalizePsychologyData = (raw, projTitle = 'Stage Production') => {
    const defaultData = {
      corePhilosophicalIdea: `At its core, "${projTitle}" explores the eternal tension between duty, honor, and sacrifice. Beneath the visual spectacle lies a profound belief in order, resilience, and the triumph of righteous dharma over chaos.`,
      directorBeliefOfSuccess: `The director believes in the undeniable success of this script because it combines an emotionally universal core hook with hyper-real cinematic worldbuilding. The psychological resonance of a hero facing impossible odds creates an unforgettable cinematic experience.`,
      emotionalFrequencyTarget: `Visceral awe, mythic grandeur, and high-tension emotional resonance balanced with serene moments of quiet majesty.`,
      directorialRules: `1. Maintain high-contrast chiaroscuro lighting on character faces.\n2. Anchor wide 24mm anamorphic framing with strong foreground subjects.\n3. Layer volumetric haze and atmospheric dust motes for depth.\n4. Drive character performance from internal psychological mindstate rather than simple expressions.\n5. Align musical score drops with sudden shifts in lighting intensity.`
    };
    if (!raw) return { activeVisionTab: 'human', compilerActiveMode: 'hybrid', human: { ...defaultData }, ai: { ...defaultData }, hybrid: { ...defaultData } };
    if (raw.corePhilosophicalIdea || raw.directorBeliefOfSuccess) {
      const flat = {
        corePhilosophicalIdea: raw.corePhilosophicalIdea || defaultData.corePhilosophicalIdea,
        directorBeliefOfSuccess: raw.directorBeliefOfSuccess || defaultData.directorBeliefOfSuccess,
        emotionalFrequencyTarget: raw.emotionalFrequencyTarget || defaultData.emotionalFrequencyTarget,
        directorialRules: raw.directorialRules || defaultData.directorialRules
      };
      return { activeVisionTab: 'human', compilerActiveMode: 'hybrid', human: { ...flat }, ai: { ...flat }, hybrid: { ...flat } };
    }
    return {
      activeVisionTab: raw.activeVisionTab || 'human',
      compilerActiveMode: raw.compilerActiveMode || 'hybrid',
      human: { ...defaultData, ...(raw.human || {}) },
      ai: { ...defaultData, ...(raw.ai || {}) },
      hybrid: { ...defaultData, ...(raw.hybrid || {}) }
    };
  };

  // Helper to normalize multi-mode DoP Cinematography data
  const normalizeDoPData = (raw, projTitle = 'Stage Production') => {
    const defaultData = {
      lightingPhilosophy: `High-contrast chiaroscuro key lighting with directional tungsten rim beams. Deep negative fill (-2 EV shadow falloff) creating dramatic sculptural depth across character features in "${projTitle}".`,
      cameraMovementEnergy: `Dynamic kinetic tracking shots balanced with stately low-angle crane pushes. Fluid Steadicam motion anchoring character momentum during high-tension beats.`,
      colorScienceTexture: `Custom filmic Kodak 5219 LUT profile with deep sodium amber highlights, rich cyan darks, and subtle 35mm grain texture at ISO 800.`,
      lensAspectRules: `1. Primary glass: 24mm & 35mm anamorphic prime lenses for expansive wide framing.\n2. Shallow depth of field (T1.9) for intimate character close-ups.\n3. Maintain strict 2.39:1 widescreen frame composition.`
    };
    if (!raw) return { activeVisionTab: 'human', compilerActiveMode: 'hybrid', human: { ...defaultData }, ai: { ...defaultData }, hybrid: { ...defaultData } };
    return {
      activeVisionTab: raw.activeVisionTab || 'human',
      compilerActiveMode: raw.compilerActiveMode || 'hybrid',
      human: { ...defaultData, ...(raw.human || {}) },
      ai: { ...defaultData, ...(raw.ai || {}) },
      hybrid: { ...defaultData, ...(raw.hybrid || {}) }
    };
  };

  // Helper to normalize multi-mode Music & Sound Data
  const normalizeSoundData = (raw, projTitle = 'Stage Production') => {
    const defaultData = {
      musicalMotifScore: `Thunderous brass ostinatos layered with haunting ancient vocal chants and sub-bass synthesizer pulses tailored for "${projTitle}".`,
      foleySoundEnvironment: `Visceral, heavy tactile foley—hyper-detailed metallic rain impacts, deep cavernous ambient reverb, and atmospheric wind pressure.`,
      vocalDialogueResonance: `Gravelly low-frequency voice resonance with intimate proximity effect for dialogue, balanced with wide spatial stereo decay.`,
      rhythmTempoSync: `1. Drop musical cues precisely on visual focal cuts.\n2. Utilize sudden sub-bass silences before major action impacts.\n3. Accelerate tempo to 140 BPM during high-intensity sequences.`
    };
    if (!raw) return { activeVisionTab: 'human', compilerActiveMode: 'hybrid', human: { ...defaultData }, ai: { ...defaultData }, hybrid: { ...defaultData } };
    return {
      activeVisionTab: raw.activeVisionTab || 'human',
      compilerActiveMode: raw.compilerActiveMode || 'hybrid',
      human: { ...defaultData, ...(raw.human || {}) },
      ai: { ...defaultData, ...(raw.ai || {}) },
      hybrid: { ...defaultData, ...(raw.hybrid || {}) }
    };
  };

  // Target Key on project object ('directorPsychology' | 'dopVision' | 'soundVision')
  const activeVaultKey = vaultCategory === 'dop' ? 'dopVision' : vaultCategory === 'sound' ? 'soundVision' : 'directorPsychology';

  // Resolve current active vault object
  const currentVaultRaw = targetPsychologyProj ? targetPsychologyProj[activeVaultKey] : null;
  const currentPsychologyObj = vaultCategory === 'dop'
    ? normalizeDoPData(currentVaultRaw, targetPsychologyProj?.title)
    : vaultCategory === 'sound'
      ? normalizeSoundData(currentVaultRaw, targetPsychologyProj?.title)
      : normalizePsychologyData(currentVaultRaw, targetPsychologyProj?.title);

  const activeVisionTab = currentPsychologyObj.activeVisionTab || 'human'; // 'human' | 'ai' | 'hybrid'
  const compilerActiveMode = currentPsychologyObj.compilerActiveMode || 'hybrid'; // 'human' | 'ai' | 'hybrid'

  // Active fields for current visible sub-tab
  const currentVisionFields = currentPsychologyObj[activeVisionTab] || currentPsychologyObj.human;

  const [isSynthesizingPsychology, setIsSynthesizingPsychology] = useState(false);
  const [isMergingHybrid, setIsMergingHybrid] = useState(false);

  const exportVisionCategoryPdf = (category) => {
    if (!targetPsychologyProj) return;
    const title = targetPsychologyProj.title || currentProjectTitle;
    const pref =
      category === 'dop'
        ? { strict: dopLifecycleStrict, mode: dopLifecycleMode, blocked: dopExportBlocked, label: 'dop_vision_pdf' }
        : category === 'sound'
          ? { strict: soundLifecycleStrict, mode: soundLifecycleMode, blocked: soundExportBlocked, label: 'sound_vision_pdf' }
          : {
              strict: directorLifecycleStrict,
              mode: directorLifecycleMode,
              blocked: directorExportBlocked,
              label: 'director_vision_pdf'
            };
    if (pref.blocked) {
      assertExportAllowed({
        projectTitle: title,
        label: pref.label,
        format: 'pdf',
        lifecycleMode: pref.mode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle: title,
      label: pref.label,
      format: 'pdf',
      lifecycleMode: pref.mode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;

    const vaultObj =
      category === 'dop'
        ? normalizeDoPData(targetPsychologyProj.dopVision, title)
        : category === 'sound'
          ? normalizeSoundData(targetPsychologyProj.soundVision, title)
          : normalizePsychologyData(targetPsychologyProj.directorPsychology, title);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(
      directorPsychologyToPrintHtml(vaultObj, {
        projectTitle: title,
        category,
        activeStream: vaultObj.compilerActiveMode || vaultObj.activeVisionTab || 'hybrid',
        roomId
      })
    );
    printWindow.document.close();
    const slug = String(title || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    logExportSuccess({
      projectTitle: title,
      label: pref.label,
      format: 'pdf',
      filename: `${slug}_${category}_vision${roomTag}.pdf`,
      roomId,
      note: roomId ? `room:${roomId}` : '',
      lifecycleMode: gate.advisory ? `${pref.mode}+ok` : pref.mode
    });
  };

  const exportVisionCategoryZip = async (category = 'director') => {
    if (!targetPsychologyProj) return;
    const title = targetPsychologyProj.title || currentProjectTitle;
    const pref =
      category === 'dop'
        ? { strict: dopLifecycleStrict, mode: dopLifecycleMode, blocked: dopExportBlocked, label: 'dop_vision_zip' }
        : category === 'sound'
          ? { strict: soundLifecycleStrict, mode: soundLifecycleMode, blocked: soundExportBlocked, label: 'sound_vision_zip' }
          : {
              strict: directorLifecycleStrict,
              mode: directorLifecycleMode,
              blocked: directorExportBlocked,
              label: 'director_vision_zip'
            };
    if (pref.blocked) {
      assertExportAllowed({
        projectTitle: title,
        label: pref.label,
        format: 'zip',
        lifecycleMode: pref.mode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle: title,
      label: pref.label,
      format: 'zip',
      lifecycleMode: pref.mode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;

    const vaultObj =
      category === 'dop'
        ? normalizeDoPData(targetPsychologyProj.dopVision, title)
        : category === 'sound'
          ? normalizeSoundData(targetPsychologyProj.soundVision, title)
          : normalizePsychologyData(targetPsychologyProj.directorPsychology, title);

    const slug = String(title || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const files = buildDirectorPsychologyZipFiles(vaultObj, {
      projectTitle: title,
      category,
      activeStream: vaultObj.compilerActiveMode || vaultObj.activeVisionTab || 'hybrid',
      roomId
    });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_${category}_vision${roomTag}.zip`, {
      projectTitle: title,
      shots,
      lifecycleMode: pref.mode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: pref.label,
      auditFormat: 'zip',
      roomId,
      note: roomId ? `room:${roomId} · ${category} vision` : `${category} vision`,
      showAlert: false
    });
  };

  const exportVisionCategoryCsv = (category = 'director') => {
    if (!targetPsychologyProj) return;
    const title = targetPsychologyProj.title || currentProjectTitle;
    const pref =
      category === 'dop'
        ? { strict: dopLifecycleStrict, mode: dopLifecycleMode, blocked: dopExportBlocked, label: 'dop_vision_csv' }
        : category === 'sound'
          ? { strict: soundLifecycleStrict, mode: soundLifecycleMode, blocked: soundExportBlocked, label: 'sound_vision_csv' }
          : {
              strict: directorLifecycleStrict,
              mode: directorLifecycleMode,
              blocked: directorExportBlocked,
              label: 'director_vision_csv'
            };
    if (pref.blocked) {
      assertExportAllowed({
        projectTitle: title,
        label: pref.label,
        format: 'csv',
        lifecycleMode: pref.mode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const vaultObj =
      category === 'dop'
        ? normalizeDoPData(targetPsychologyProj.dopVision, title)
        : category === 'sound'
          ? normalizeSoundData(targetPsychologyProj.soundVision, title)
          : normalizePsychologyData(targetPsychologyProj.directorPsychology, title);
    const csv = directorPsychologyToCsv(vaultObj, {
      projectTitle: title,
      category,
      activeStream: vaultObj.compilerActiveMode || vaultObj.activeVisionTab || 'hybrid',
      roomId
    });
    const slug = String(title || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    exportDownloadText(`${slug}_${category}_vision${roomTag}.csv`, csv, {
      projectTitle: title,
      auditLabel: pref.label,
      auditFormat: 'csv',
      lifecycleMode: pref.mode,
      shots,
      roomId,
      note: roomId ? `room:${roomId} · ${category} vision` : `${category} vision`,
      mime: 'text/csv;charset=utf-8'
    });
  };

  // Save updated vault object for target project (P87 revision / conflict)
  const handleSavePsychologyObj = (updatedObj, { force = false } = {}) => {
    if (!targetPsychologyProj) return;
    const expectedRevision =
      updatedObj?.revision != null ? Number(updatedObj.revision) : Number(currentPsychologyObj?.revision) || 0;
    // When editing in-memory object that already has bumped fields, pass prior revision
    const priorRev = Number(currentPsychologyObj?.revision) || 0;
    let saveResult = { ok: true, data: updatedObj };
    if (typeof window !== 'undefined') {
      if (activeVaultKey === 'directorPsychology') {
        saveResult = saveDirectorPsychology(targetPsychologyProj.title, updatedObj, {
          expectedRevision: force ? null : priorRev,
          force
        });
      } else if (activeVaultKey === 'dopVision') {
        saveResult = saveDoPVision(targetPsychologyProj.title, updatedObj, {
          expectedRevision: force ? null : priorRev,
          force
        });
      } else if (activeVaultKey === 'soundVision') {
        saveResult = saveSoundVision(targetPsychologyProj.title, updatedObj, {
          expectedRevision: force ? null : priorRev,
          force
        });
      }
      if (saveResult?.conflict) {
        const overwrite = window.confirm(
          `Department vision conflict (rev ${saveResult.revision}). Another save landed first. Overwrite with your version?`
        );
        if (!overwrite) return;
        return handleSavePsychologyObj(updatedObj, { force: true });
      }
      if (saveResult?.ok === false && !saveResult?.conflict) {
        window.alert(saveResult.error || 'Vision save failed');
        return;
      }
    }
    const persisted = saveResult?.data || updatedObj;
    setProjectLibrary(prev => {
      const updated = prev.map(p => {
        if (p.id === targetPsychologyProj.id) {
          return { ...p, [activeVaultKey]: persisted };
        }
        return p;
      });
      if (typeof window !== 'undefined') {
        safeLocalStorageSetItem('sps_project_library', JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Update specific fields within current active sub-tab (human, ai, or hybrid)
  const handleUpdateCurrentVisionFields = (updatedFields) => {
    const nextObj = {
      ...currentPsychologyObj,
      [activeVisionTab]: {
        ...currentPsychologyObj[activeVisionTab],
        ...updatedFields
      }
    };
    handleSavePsychologyObj(nextObj);
  };

  // Trigger AI Auto-Synthesis for active vault
  const handleAISynthesizeDirectorPsychology = async () => {
    if (!targetPsychologyProj) return;
    setIsSynthesizingPsychology(true);
    let res = null;
    if (vaultCategory === 'dop') {
      res = await composeDoPVisionWithLLM(targetPsychologyProj);
    } else if (vaultCategory === 'sound') {
      res = await composeSoundVisionWithLLM(targetPsychologyProj);
    } else {
      const rawText = typeof window !== 'undefined' ? readOpenScreenplayText() : '';
      res = await composeDirectorPsychologyWithLLM(
        targetPsychologyProj.title, 
        targetPsychologyProj.shots || shots, 
        rawText, 
        targetPsychologyProj.description
      );
    }

    if (res) {
      const nextObj = {
        ...currentPsychologyObj,
        activeVisionTab: 'ai',
        ai: res
      };
      handleSavePsychologyObj(nextObj);
    }
    setIsSynthesizingPsychology(false);
  };

  // Trigger Intelligent Merge of Human & AI into Master Hybrid Vision
  const handleMergeHybridVision = async () => {
    if (!targetPsychologyProj) return;
    setIsMergingHybrid(true);
    let mergedRes = null;
    if (vaultCategory === 'dop') {
      mergedRes = await composeHybridDoPVisionMergeWithLLM(
        targetPsychologyProj.title,
        currentPsychologyObj.human,
        currentPsychologyObj.ai
      );
    } else if (vaultCategory === 'sound') {
      mergedRes = await composeHybridSoundVisionMergeWithLLM(
        targetPsychologyProj.title,
        currentPsychologyObj.human,
        currentPsychologyObj.ai
      );
    } else {
      mergedRes = await composeHybridVisionMergeWithLLM(
        targetPsychologyProj.title,
        currentPsychologyObj.human,
        currentPsychologyObj.ai
      );
    }

    if (mergedRes) {
      const nextObj = {
        ...currentPsychologyObj,
        activeVisionTab: 'hybrid',
        compilerActiveMode: 'hybrid',
        hybrid: mergedRes
      };
      handleSavePsychologyObj(nextObj);
    }
    setIsMergingHybrid(false);
  };

  const handleTriggerPosterUpload = (projId) => {
    setTargetPosterProjId(projId);
    if (posterFileInputRef.current) {
      posterFileInputRef.current.value = '';
      posterFileInputRef.current.click();
    }
  };

  const handlePosterDoubleTap = (proj) => {
    const projId = proj?.id;
    if (!projId) return;
    const now = Date.now();
    const prev = posterDblTapRef.current;
    if (prev.id === projId && now - prev.t < 450) {
      posterDblTapRef.current = { id: null, t: 0 };
      handleTriggerPosterUpload(projId);
    } else {
      posterDblTapRef.current = { id: projId, t: now };
    }
  };

  const handlePosterFileChange = (e) => {
    const file = e.target.files?.[0];
    const projId = targetPosterProjId;
    if (!file || !projId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = String(evt.target?.result || '');
      if (!dataUrl.startsWith('data:image/')) {
        window.alert('Poster must be an image file (PNG, JPG, WebP).');
        return;
      }

      let title = '';
      let matched = null;
      setProjectLibrary((prev) => {
        matched = (Array.isArray(prev) ? prev : []).find((p) => p && p.id === projId) || null;
        title = String(matched?.title || '').trim();
        return prev;
      });
      if (!title) {
        window.alert('Could not find that project to attach a poster.');
        return;
      }

      let optimizedUrl = dataUrl;
      try {
        optimizedUrl = await optimizePosterDataUrl(dataUrl);
      } catch (err) {
        console.warn('Poster optimize failed, saving original', err);
      }

      // 1) Durable disk PNG (Electron-safe — not stuffed into giant project JSON)
      const durableUrl = await saveProjectPoster({ title, id: projId, dataUrl: optimizedUrl });
      if (!durableUrl) {
        window.alert('Poster save failed. Keep Vite running (npm run electron:dev or npm run dev) and try again.');
        return;
      }

      // 2) Local IDB cache for instant paint if API is briefly unavailable
      const blobId = `poster_${String(projId).replace(/[^\w.-]+/g, '_').slice(0, 80)}`;
      try {
        await putImageDataUrl(blobId, optimizedUrl);
      } catch {
        /* optional */
      }

      const stamp = {
        posterUrl: durableUrl,
        posterFile: `${String(title).replace(/[^a-zA-Z0-9_-]/g, '_')}.png`,
        lastModified: new Date().toLocaleDateString(),
        lastModifiedIso: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setProjectLibrary((prev) => {
        const updated = (Array.isArray(prev) ? prev : []).map((p) => {
          if (!p) return p;
          if (p.id === projId || String(p.title || '').trim().toUpperCase() === title.toUpperCase()) {
            return { ...p, ...stamp };
          }
          return p;
        });
        writeLocalProjectLibrary(updated);
        return updated;
      });
    };
    reader.onerror = () => {
      window.alert('Could not read that image file.');
    };
    reader.readAsDataURL(file);
  };

  const patchProjectAssetRoot = (projId, key, value) => {
    setProjectLibrary((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const assetRoots = normalizeAssetRoots({ ...(p.assetRoots || {}), [key]: value });
        return { ...p, assetRoots };
      })
    );
  };

  const handleFillDefaultAssetRoots = async (proj) => {
    let base = '';
    const folderHint = sanitizeProjectFolderName(proj.title);
    const picked = await pickDirectoryPath();
    if (picked.ok && picked.path) {
      base = picked.path;
    } else {
      const hint = extractStudioRootFromAssetPath(
        proj.assetRoots?.subjects || proj.assetRoots?.projectSave || '',
        proj.title
      );
      base = window.prompt(
        `Paste studio root (e.g. Desktop/SWS PROJECTS).\nSWS will create:\n  ${folderHint}/ASSETS\n  ${folderHint}/RENDERS\n  ${folderHint}/PROJECT\nunder that root (not loose at the root).`,
        hint || ''
      );
    }
    if (!base) return;
    // If user accidentally picked …/KARA_DUSHAN already, defaultAssetRootsUnder won't double-nest
    const roots = nestAssetRootsUnderProjectName(defaultAssetRootsUnder(base, proj.title), proj.title);
    setProjectLibrary((prev) =>
      prev.map((p) => (p.id === proj.id ? { ...p, assetRoots: roots } : p))
    );
  };

  const handleSaveProjectAssetRoots = async (proj) => {
    const nested = nestAssetRootsUnderProjectName(proj.assetRoots, proj.title);
    const roots = normalizeAssetRoots(nested);
    try {
      const result = await saveProjectAssetRoots(proj.title, roots, { shots: proj.shots || [] });
      setProjectLibrary((prev) => {
        const updated = prev.map((p) =>
          p.id === proj.id ? { ...p, assetRoots: result.roots, projectVersion: result.roots.projectVersion } : p
        );
        try {
          localStorage.setItem('sps_project_library', JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        return updated;
      });
      const created = result.ensured?.created?.length || 0;
      const folder = sanitizeProjectFolderName(proj.title);
      const verNote = result.versioned?.ok
        ? `\nVersion snapshot: ${result.versioned.filename || result.roots.projectVersion}`
        : '';
      const placeholderNote =
        result.placeholders?.count
          ? `\nPlaceholder PNGs: ${result.placeholders.count} new file(s) named from REFERENCES (overwrite with your art).`
          : '';
      window.alert(
        `${created ? `Folders saved under ${folder}/. Created ${created} missing folder(s).` : `Folders saved under ${folder}/ (existing kept).`}${verNote}${placeholderNote}\n\nLayout:\n  …/${folder}/ASSETS\n  …/${folder}/RENDERS\n  …/${folder}/PROJECT`
      );
      setAssetFoldersProjId(null);
    } catch (err) {
      window.alert(err?.message || 'Could not save asset folders.');
    }
  };

  const registerOpenedProjectFolder = async (importedProj, meta = {}) => {
    const cleanTitle = (importedProj.title || 'IMPORTED PROJECT').trim().toUpperCase();
    clearDeletedProjectTitles([importedProj.title]);
    await saveProjectToVault(importedProj);
    if (importedProj.assetRoots) {
      stampAssetRootsIntoLibrary(importedProj.title, importedProj.assetRoots);
    }
    setProjectLibrary((prev) => {
      const exists = prev.some((p) => p.title.trim().toUpperCase() === cleanTitle);
      const updated = exists
        ? prev.map((p) => (p.title.trim().toUpperCase() === cleanTitle ? { ...p, ...importedProj } : p))
        : [...prev, importedProj];
      writeLocalProjectLibrary(updated);
      return updated;
    });
    window.dispatchEvent(new Event('sps_projects_updated'));
    const shotsN = importedProj.shots?.length || 0;
    const from = meta.sourceFile || meta.filmRoot || importedProj.openedFromFolder || '';
    alert(
      `📂 PROJECT FOLDER OPENED\n\n"${importedProj.title}" — ${shotsN} shot(s)\nAsset roots wired to disk.${from ? `\n\nSource: ${from}` : ''}`
    );
  };

  const handleOpenProjectFolder = async () => {
    if (!canCreateOrDeleteProjects()) {
      alert('🔒 ACCESS RESTRICTED:\nOnly the studio Admin can open project folders.');
      return;
    }

    const result = await pickAndOpenProjectFolder();
    if (result?.canceled) return;

    if (!result?.ok) {
      if (result?.error === 'multiple_projects' && Array.isArray(result.candidates)) {
        const labels = result.candidates.map((c, i) => `${i + 1}. ${c.titleGuess}`).join('\n');
        const pick = window.prompt(`Several film folders found. Type the number to open:\n${labels}`, '1');
        const idx = parseInt(String(pick || '').trim(), 10) - 1;
        const chosen = result.candidates[idx];
        if (!chosen?.filmRoot) return;
        try {
          let retry;
          if (window.electronAPI?.openProjectFolder) {
            retry = await window.electronAPI.openProjectFolder({ folderPath: chosen.filmRoot });
          } else {
            const res = await fetch('/api/open-project-folder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderPath: chosen.filmRoot })
            });
            const data = await res.json().catch(() => ({}));
            retry = res.ok && data?.project ? { ok: true, ...data } : { ok: false, ...data };
          }
          if (!retry?.ok || !retry?.project) {
            alert(`❌ OPEN FOLDER ERROR:\n${retry?.error || retry?.hint || 'Could not open folder'}`);
            return;
          }
          await registerOpenedProjectFolder(retry.project, retry);
        } catch (err) {
          alert(`❌ OPEN FOLDER ERROR:\n${err?.message || err}`);
        }
        return;
      }
      alert(`❌ OPEN FOLDER ERROR:\n${result?.hint || result?.error || 'Could not open folder'}`);
      return;
    }

    if (!result.project) {
      alert('❌ No project JSON in PROJECT/Versions.\nSave the project once, or use Open backup for a .json file.');
      return;
    }

    await registerOpenedProjectFolder(result.project, result);
  };

  const handleBackupFileImport = async (e) => {
    if (!canCreateOrDeleteProjects()) {
      alert('🔒 ACCESS RESTRICTED:\nOnly the studio Admin can import projects.');
      if (e.target) e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedProj = await importProjectPackageFromFile(file);
      setProjectLibrary(prev => {
        const cleanTitle = (importedProj.title || 'IMPORTED PROJECT').trim().toUpperCase();
        const exists = prev.some(p => p.title.trim().toUpperCase() === cleanTitle);
        let updated;
        if (exists) {
          updated = prev.map(p => p.title.trim().toUpperCase() === cleanTitle ? { ...p, ...importedProj } : p);
        } else {
          updated = [...prev, importedProj];
        }
        safeLocalStorageSetItem('sps_project_library', JSON.stringify(updated));
        return updated;
      });
      alert(`📥 PROJECT RESTORED SUCCESSFULLY:\nProject "${importedProj.title}" (${importedProj.shots?.length || 0} shots) imported into studio library & saved to persistent vault!`);
    } catch (err) {
      alert(`❌ IMPORT ERROR:\n${err.message}`);
    }
    if (e.target) e.target.value = '';
  };

  // New Project Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newModel, setNewModel] = useState('SPS Direct Cinema 2.0');
  const [newRatio, setNewRatio] = useState('2.39:1 Anamorphic');
  const [newTemplate, setNewTemplate] = useState('epic_war');
  const [newGenreKey, setNewGenreKey] = useState(presetProfile || 'mythological');

  // Rename Project State
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [renameInput, setRenameInput] = useState('');

  const handleRenameProject = (projId, newName) => {
    const cleanName = newName.trim().toUpperCase();
    if (!cleanName) return;

    // Check if another project already has this exact title
    const isDuplicate = projectLibrary.some(p => p.id !== projId && p.title.trim().toUpperCase() === cleanName);
    if (isDuplicate) {
      alert(`⚠️ DUPLICATE PROJECT TITLE:\nA project named "${cleanName}" already exists in the studio library. Projects cannot have identical names. Please enter a unique title.`);
      return;
    }

    setProjectLibrary(prev => {
      const updated = prev.map(p => {
        if (p.id === projId) {
          if (p.title === currentProjectTitle && setProjectTitle) {
            setProjectTitle(cleanName);
          }
          return { ...p, title: cleanName };
        }
        return p;
      });
      safeLocalStorageSetItem('sps_project_library', JSON.stringify(updated));
      return updated;
    });
    setEditingProjectId(null);
  };

  // Versioning state for active project
  const [newVersionName, setNewVersionName] = useState('');
  const [versionSuccessMsg, setVersionSuccessMsg] = useState('');


  const [customProjectTitle, setCustomProjectTitle] = useState(currentProjectTitle || 'NEW CINEMA PROJECT');

  useEffect(() => {
    const t = String(currentProjectTitle || '').trim();
    if (t) setCustomProjectTitle(t);
  }, [currentProjectTitle]);

  // Custom & Edited Genre Profiles State
  const [customGenreProfiles, setCustomGenreProfiles] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sps_custom_genre_profiles');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const [isGenreEditorOpen, setIsGenreEditorOpen] = useState(false);
  const [editingGenreKey, setEditingGenreKey] = useState(null);
  const [genreForm, setGenreForm] = useState({
    label: '',
    description: '',
    characterIdAssetRef: '',
    coArtistInteraction: '',
    actionEnvContext: '',
    characterExpression: '',
    characterMovement: '',
    characterDialogue: '',
    timeAndLightingEnv: '',
    subjectLightingTag: '',
    subjectColorTag: '',
    backgroundLightingTag: '',
    backgroundColorTag: ''
  });

  const mergedGenreProfiles = { ...GENRE_PRESET_PROFILES, ...customGenreProfiles };

  const handleOpenGenreEditor = (genreKey = null) => {
    if (genreKey && mergedGenreProfiles[genreKey]) {
      const p = mergedGenreProfiles[genreKey];
      setEditingGenreKey(genreKey);
      setGenreForm({
        label: p.label || p.name || '',
        description: p.description || '',
        characterIdAssetRef: (p.presets?.characterIdAssetRef || []).join('\n'),
        coArtistInteraction: (p.presets?.coArtistInteraction || []).join('\n'),
        actionEnvContext: (p.presets?.actionEnvContext || []).join('\n'),
        characterExpression: (p.presets?.characterExpression || []).join('\n'),
        characterMovement: (p.presets?.characterMovement || []).join('\n'),
        characterDialogue: (p.presets?.characterDialogue || []).join('\n'),
        timeAndLightingEnv: (p.presets?.timeAndLightingEnv || []).join('\n'),
        subjectLightingTag: (p.presets?.subjectLightingTag || []).join('\n'),
        subjectColorTag: (p.presets?.subjectColorTag || []).join('\n'),
        backgroundLightingTag: (p.presets?.backgroundLightingTag || []).join('\n'),
        backgroundColorTag: (p.presets?.backgroundColorTag || []).join('\n')
      });
    } else {
      setEditingGenreKey(null);
      setGenreForm({
        label: '',
        description: '',
        characterIdAssetRef: '',
        coArtistInteraction: '',
        actionEnvContext: '',
        characterExpression: '',
        characterMovement: '',
        characterDialogue: '',
        timeAndLightingEnv: '',
        subjectLightingTag: '',
        subjectColorTag: '',
        backgroundLightingTag: '',
        backgroundColorTag: ''
      });
    }
    setIsGenreEditorOpen(true);
  };

  const handleSaveGenreProfile = (e) => {
    e.preventDefault();
    if (!genreForm.label.trim()) {
      alert("Please enter a Genre Name / Label.");
      return;
    }

    const key = editingGenreKey || `custom_genre_${Date.now()}`;
    const parseLines = (text) => (text || '').split('\n').map(l => l.trim()).filter(Boolean);

    const updatedProfile = {
      label: genreForm.label.trim(),
      name: genreForm.label.trim(),
      description: genreForm.description.trim() || 'Custom user production genre profile',
      presets: {
        characterIdAssetRef: parseLines(genreForm.characterIdAssetRef),
        coArtistInteraction: parseLines(genreForm.coArtistInteraction),
        actionEnvContext: parseLines(genreForm.actionEnvContext),
        characterExpression: parseLines(genreForm.characterExpression),
        characterMovement: parseLines(genreForm.characterMovement),
        characterDialogue: parseLines(genreForm.characterDialogue),
        timeAndLightingEnv: parseLines(genreForm.timeAndLightingEnv),
        subjectLightingTag: parseLines(genreForm.subjectLightingTag),
        subjectColorTag: parseLines(genreForm.subjectColorTag),
        backgroundLightingTag: parseLines(genreForm.backgroundLightingTag),
        backgroundColorTag: parseLines(genreForm.backgroundColorTag)
      }
    };

    const newCustoms = {
      ...customGenreProfiles,
      [key]: updatedProfile
    };

    setCustomGenreProfiles(newCustoms);
    localStorage.setItem('sps_custom_genre_profiles', JSON.stringify(newCustoms));

    if (setPresetProfile) {
      setPresetProfile(key);
    }
    setIsGenreEditorOpen(false);
  };

  const handleDeleteCustomGenre = (key, e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete custom genre "${mergedGenreProfiles[key]?.label || key}"?`)) {
      const updated = { ...customGenreProfiles };
      delete updated[key];
      setCustomGenreProfiles(updated);
      localStorage.setItem('sps_custom_genre_profiles', JSON.stringify(updated));
      if (presetProfile === key && setPresetProfile) {
        setPresetProfile('mythological');
      }
    }
  };

  const handleResetGenresToDefault = () => {
    if (confirm("Reset all genre profiles back to studio defaults? Any custom or edited genres will be cleared.")) {
      setCustomGenreProfiles({});
      localStorage.removeItem('sps_custom_genre_profiles');
      if (setPresetProfile) setPresetProfile('mythological');
    }
  };

  // Helper function to cleanse any duplicate project titles in library & purge dummy app-name projects
  const sanitizeLibraryTitles = (library) => {
    if (!Array.isArray(library)) return [];
    const seen = new Set();
    const filtered = library.filter(p => p && p.title && p.title.trim().toUpperCase() !== 'STAGE PRODUCTION STUDIO');
    return filtered.map(p => {
      let clean = p.title.trim().toUpperCase();
      if (seen.has(clean)) {
        let count = 1;
        let altTitle = `${clean} (COPY)`;
        while (seen.has(altTitle)) {
          count++;
          altTitle = `${clean} (COPY ${count})`;
        }
        clean = altTitle;
      }
      seen.add(clean);
      return { ...p, title: clean };
    });
  };

  const mergeLibraryPreservingUnion = useCallback((incoming, prev) => {
    const map = new Map();
    const put = (p) => {
      if (!p?.title) return;
      const key = String(p.title).trim().toUpperCase();
      const old = map.get(key);
      if (!old) {
        map.set(key, p);
        return;
      }
      map.set(key, {
        ...old,
        ...p,
        posterUrl: p.posterUrl || old.posterUrl,
        shots:
          Array.isArray(p.shots) && p.shots.length > 0
            ? p.shots
            : Array.isArray(old.shots)
              ? old.shots
              : []
      });
    };
    (Array.isArray(prev) ? prev : []).forEach(put);
    (Array.isArray(incoming) ? incoming : []).forEach(put);
    return sanitizeLibraryTitles(filterOutDeletedProjects(Array.from(map.values())));
  }, []);

  // Disk vault hydrate — must complete before persisting library (prevents stale overwrite)
  useEffect(() => {
    if (!isOpen) {
      setLibraryHydrated(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const merged = await hydrateProjectLibraryFromStores();
        const withPosters = await ensureElectronPosterRefs(merged);
        if (cancelled) return;
        setProjectLibrary((prev) => mergeLibraryPreservingUnion(withPosters, prev));
        writeLocalProjectLibrary(withPosters);
      } catch (err) {
        console.warn('Project library disk hydrate failed', err);
      } finally {
        if (!cancelled) setLibraryHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, mergeLibraryPreservingUnion]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onProjectsUpdated = () => {
      try {
        const saved = readLocalProjectLibrary();
        if (!Array.isArray(saved) || !saved.length) return;
        setProjectLibrary((prev) => mergeLibraryPreservingUnion(saved, prev));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('sps_projects_updated', onProjectsUpdated);
    return () => window.removeEventListener('sps_projects_updated', onProjectsUpdated);
  }, [isOpen, mergeLibraryPreservingUnion]);

  // Sync tab if initialTab updates on open & fetch latest cloud projects
  useEffect(() => {
    if (isOpen && initialTab) {
      // Genre is per-project on cards now — never open a global genre tab
      setActiveTab(initialTab === 'genre' ? 'library' : initialTab);
    }
    if (isOpen) {
      // Heal: active project must never sit only in Archive due to sync tombstones
      const healed = healActiveProjectFromArchive();
      // Filter tombstoned titles from Library display — never silently re-archive
      setProjectLibrary((prev) => {
        let base = Array.isArray(prev) ? prev : [];
        if (healed?.title) {
          const key = String(healed.title).trim().toUpperCase();
          base = [healed, ...base.filter((p) => String(p?.title || '').trim().toUpperCase() !== key)];
        }
        try {
          const saved = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
          if (Array.isArray(saved) && saved.length) {
            const map = new Map();
            [...saved, ...base].forEach((p) => {
              if (!p?.title) return;
              map.set(String(p.title).trim().toUpperCase(), p);
            });
            base = Array.from(map.values());
          }
        } catch (e) {}
        return sanitizeLibraryTitles(filterOutDeletedProjects(base));
      });
      setArchivedProjects(getArchivedProjects());
      fetchProjectLibraryFromCloud().then(cloudProjs => {
        const healedAfter = healActiveProjectFromArchive();
        if (Array.isArray(cloudProjs) && cloudProjs.length > 0) {
          setProjectLibrary(prev => {
            const map = new Map();
            const cloudFiltered = filterOutDeletedProjects(cloudProjs);
            cloudFiltered.forEach((p) => {
              if (p && p.title) map.set(String(p.title).trim().toUpperCase(), p);
            });
            (prev || []).forEach((p) => {
              if (!p?.title) return;
              const key = String(p.title).trim().toUpperCase();
              const cloud = map.get(key);
              if (!cloud) {
                // Keep local-only projects (e.g. poster just saved, not yet on cloud)
                map.set(key, p);
                return;
              }
              map.set(key, {
                ...p,
                ...cloud,
                // Prefer whichever side still has a poster
                posterUrl: cloud.posterUrl || p.posterUrl,
                shots:
                  Array.isArray(cloud.shots) && cloud.shots.length > 0
                    ? cloud.shots
                    : Array.isArray(p.shots)
                      ? p.shots
                      : []
              });
            });

            const activeKey = currentProjectTitle ? String(currentProjectTitle).trim().toUpperCase() : '';
            if (
              activeKey &&
              activeKey !== 'STAGE PRODUCTION STUDIO' &&
              !map.has(activeKey)
            ) {
              const fromHeal =
                healedAfter && String(healedAfter.title).trim().toUpperCase() === activeKey
                  ? healedAfter
                  : null;
              map.set(
                activeKey,
                fromHeal || {
                  id: `proj_${Date.now()}`,
                  title: currentProjectTitle,
                  description: `Cinema Production Studio Project`,
                  targetModel: 'SPS Direct Cinema 2.0',
                  aspectRatio: '2.39:1 Anamorphic',
                  roomId: roomIdForProject(currentProjectTitle),
                  lastModified: new Date().toLocaleDateString(),
                  shots: []
                }
              );
              clearDeletedProjectTitles([currentProjectTitle]);
            }

            let merged = filterOutDeletedProjects(Array.from(map.values()));
            if (currentProjectTitle) {
              merged.sort((a, b) => {
                if (titlesMatch(a.title, currentProjectTitle)) return -1;
                if (titlesMatch(b.title, currentProjectTitle)) return 1;
                return 0;
              });
            }
            const sanitized = sanitizeLibraryTitles(merged);
            try {
              writeLocalProjectLibrary(sanitized);
            } catch (e) {}
            return sanitized;
          });
        } else if (healedAfter) {
          setProjectLibrary((prev) => {
            const key = String(healedAfter.title).trim().toUpperCase();
            const without = (prev || []).filter(
              (p) => String(p?.title || '').trim().toUpperCase() !== key
            );
            return sanitizeLibraryTitles([healedAfter, ...without]);
          });
        }
        setArchivedProjects(getArchivedProjects());
      }).catch(() => {});
    }
  }, [isOpen, initialTab, currentProjectTitle]);

  // Persist library changes locally & push to Cloud Database
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isGuestSession()) return;
    if (!libraryHydrated) return;
    writeLocalProjectLibrary(projectLibrary);
    // Defer past React commit so AdminSettingsModal listeners don't setState mid-render
    const t = setTimeout(() => {
      window.dispatchEvent(new Event('sps_projects_updated'));
      // Never push huge data: posters to cloud — keep idb/http refs only
      const forCloud = (Array.isArray(projectLibrary) ? projectLibrary : []).map((p) => {
        const slim = slimProjectForLocalMirror(p);
        if (slim?.posterUrl && String(slim.posterUrl).startsWith('idb:')) {
          const rest = { ...slim };
          delete rest.posterUrl;
          return rest;
        }
        return slim;
      });
      syncProjectLibraryToCloud(forCloud);
    }, 0);
    return () => clearTimeout(t);
  }, [projectLibrary, libraryHydrated]);

  // Restore posters from disk SoT whenever the console opens (localStorage index is slim)
  useEffect(() => {
    if (!isOpen || isGuestSession()) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const posterByTitle = new Map();

        const vault = await loadProjectsFromVault();
        if (Array.isArray(vault)) {
          for (const vp of vault) {
            if (!vp?.title || !vp.posterUrl) continue;
            const key = String(vp.title).trim().toUpperCase();
            let posterUrl = vp.posterUrl;
            if (typeof posterUrl === 'string' && posterUrl.startsWith('data:') && posterUrl.length > 800) {
              // Prefer durable API URL if a poster file exists; else cache in IDB
              posterUrl = posterApiUrl(vp.title, Date.now());
            }
            posterByTitle.set(key, posterUrl);
          }
        }

        const listed = await listProjectPostersFromDisk();
        for (const row of listed) {
          const key = String(row?.title || '').trim().toUpperCase();
          if (!key || !row.posterUrl) continue;
          // Disk PNG wins — always refresh cache-busted API URL
          posterByTitle.set(key, `${row.posterUrl}${row.posterUrl.includes('?') ? '&' : '?'}v=${Date.now()}`);
        }

        if (cancelled || posterByTitle.size === 0) return;
        setProjectLibrary((prev) => {
          let changed = false;
          const next = (Array.isArray(prev) ? prev : []).map((p) => {
            if (!p?.title) return p;
            const key = String(p.title).trim().toUpperCase();
            const fromDisk = posterByTitle.get(key);
            if (!fromDisk) return p;
            const cur = typeof p.posterUrl === 'string' ? p.posterUrl : '';
            if (cur.startsWith('/api/project-poster') && cur.includes(encodeURIComponent(String(p.title).trim()).slice(0, 12))) {
              // still refresh to latest file
              changed = true;
              return { ...p, posterUrl: fromDisk };
            }
            if (isImageRef(cur) && resolveImageUrl(cur)) return p;
            if (/^https?:\/\//i.test(cur)) return p;
            if (cur.startsWith('data:') && cur.length > 40) return p;
            changed = true;
            return { ...p, posterUrl: fromDisk };
          });
          if (changed) writeLocalProjectLibrary(next);
          return changed ? next : prev;
        });
      } catch (err) {
        console.warn('Poster hydrate from disk failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // EVALUATE CURRENT USER PERMISSIONS & ALLOTTED PROJECTS
  const currentUserEmail = getCurrentUserEmail();
  const currentUserProfile = getCurrentUserProfile(currentUserEmail);
  const isPrimaryOwner = canCreateOrDeleteProjects(currentUserEmail);
  const guestLook = canGuestBrowseApp();
  const visibleProjectLibrary = filterAccessibleProjects(projectLibrary, currentUserEmail);
  const libraryProjectsForDisplay = useMemo(() => {
    const list = [...visibleProjectLibrary];
    const activeTitle = String(currentProjectTitle || '').trim();
    if (!activeTitle) return list;
    return list.sort((a, b) => {
      const aActive = titlesMatch(a?.title, activeTitle);
      const bActive = titlesMatch(b?.title, activeTitle);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return 0;
    });
  }, [visibleProjectLibrary, currentProjectTitle]);

  const assetFoldersProj = useMemo(
    () => (Array.isArray(projectLibrary) ? projectLibrary : []).find((p) => p?.id === assetFoldersProjId) || null,
    [projectLibrary, assetFoldersProjId]
  );

  const consoleScrollRef = useRef(null);
  const lastConsoleScrollRef = useRef(0);
  const [consoleToolbarHidden, setConsoleToolbarHidden] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [consoleToolbarPinned, setConsoleToolbarPinned] = useState(() => {
    try {
      return localStorage.getItem(CONSOLE_TOOLBAR_PIN_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CONSOLE_TOOLBAR_PIN_KEY, consoleToolbarPinned ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [consoleToolbarPinned]);

  const handleConsoleScroll = useCallback((e) => {
    if (consoleToolbarPinned || profileMenuOpen) return;
    const y = e.currentTarget.scrollTop;
    const delta = y - lastConsoleScrollRef.current;
    if (delta < -4) {
      setConsoleToolbarHidden(false);
    } else if (delta > 4) {
      setConsoleToolbarHidden(true);
    }
    lastConsoleScrollRef.current = y;
  }, [consoleToolbarPinned, profileMenuOpen]);

  useEffect(() => {
    if (!isOpen) {
      setConsoleToolbarHidden(false);
      setProfileMenuOpen(false);
      lastConsoleScrollRef.current = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profileMenuOpen]);

  useEffect(() => {
    const root = consoleScrollRef.current;
    if (!root || !isOpen) return undefined;
    const onWheel = (e) => {
      if (consoleToolbarPinned || profileMenuOpen) return;
      if (e.deltaY < -2) setConsoleToolbarHidden(false);
      else if (e.deltaY > 2) setConsoleToolbarHidden(true);
    };
    root.addEventListener('wheel', onWheel, { passive: true });
    return () => root.removeEventListener('wheel', onWheel);
  }, [isOpen, consoleToolbarPinned, profileMenuOpen]);

  useEffect(() => {
    if (!assetFoldersProjId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAssetFoldersProjId(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [assetFoldersProjId]);
  const allottedTitles = Array.isArray(currentUserProfile?.allottedProjects)
    ? currentUserProfile.allottedProjects.filter((t) => t && !String(t).toLowerCase().startsWith('all studio projects'))
    : [];

  const checkIsProjectAllotted = (projTitle) => canAccessProject(projTitle, currentUserEmail);

  // Active project must come from the visible (allotted) set for collaborators
  const activeProjectId =
    visibleProjectLibrary.find((p) => p.title === currentProjectTitle)?.id ||
    visibleProjectLibrary[0]?.id ||
    null;

  const getDynamicAllottedUsersForProject = (projTitle) => {
    let authorizedUsers = [];
    try {
      const parsedUsers = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
      authorizedUsers = Array.isArray(parsedUsers) ? parsedUsers : [];
    } catch (_) {
      authorizedUsers = [];
    }

    const matchedUsers = authorizedUsers.filter(u => {
      if (u.status === 'Suspended') return false;
      return canAccessProject(projTitle, u.email);
    }).map(u => {
      if (u.email) return u.email.split('@')[0];
      return u.name || u.phone;
    });

    if (matchedUsers.length > 0) {
      return Array.from(new Set(matchedUsers)).join(', ');
    }

    return 'pedditiram';
  };

  // 1. SWITCH PROJECT (WITH ENFORCED GUEST & ALLOTTED PERMISSION GUARD)
  const applyProjectToStudio = async (proj, { closeConsole = true, guestLook = false } = {}) => {
    if (!proj?.title) return false;
    if (isGuestSession() && !canGuestBrowseApp()) {
      alert(`🔒 GUEST ACCESS\n\nUnauthenticated visitors may only view the Investor Deck & Studio Showcase.\n\nSign in to open '${proj.title}', or request access from the studio Admin.`);
      onClose?.();
      if (onOpenInvestorDeck) onOpenInvestorDeck();
      return false;
    }

    if (!guestLook && !checkIsProjectAllotted(proj.title)) {
      alert(`🔒 PROJECT ACCESS RESTRICTED:\n'${proj.title}' has not been allotted to your account (${currentUserEmail}). Please ask the studio Admin to allot this project to your profile in Admin Settings.`);
      return false;
    }
    // Always prefer full disk copy so Electron + browser open the same Matrix
    let openProj = proj;
    try {
      const diskFull = await loadProjectFromDiskByTitle(proj.title);
      if (diskFull && Array.isArray(diskFull.shots) && diskFull.shots.length) {
        openProj = { ...proj, ...diskFull, shots: diskFull.shots };
      }
    } catch {
      /* use in-memory proj */
    }
    try {
      const saved = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
      const parked = writeWorkspaceOntoLibrary(saved, currentProjectTitle);
      safeLocalStorageSetItem('sps_project_library', JSON.stringify(parked));
    } catch {
      /* ignore */
    }
    if (setProjectTitle) setProjectTitle(openProj.title);
    if (setTargetModel) setTargetModel(openProj.targetModel);
    if (setAspectRatio) setAspectRatio(openProj.aspectRatio);
    if (setShots) setShots(Array.isArray(openProj.shots) ? openProj.shots : []);
    if (setRoomId) setRoomId(roomIdForProject(openProj.title, openProj.roomId));
    applyOpenWorkspace(openProj);
    try {
      localStorage.setItem('sps_current_project_title', openProj.title);
      localStorage.setItem('sps_current_shots', JSON.stringify(openProj.shots || []));
      localStorage.setItem('sps_current_room_id', roomIdForProject(openProj.title, openProj.roomId));
    } catch {
      /* ignore */
    }
    saveActiveWorkspaceToDisk({
      title: openProj.title,
      roomId: roomIdForProject(openProj.title, openProj.roomId)
    }).catch(() => {});
    const genreKey = resolveProjectGenreKey(openProj);
    if (setPresetProfile) setPresetProfile(genreKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_preset_profile', genreKey);
      localStorage.setItem('sps_active_genre', genreKey);
    }
    if (closeConsole) onClose?.();
    return true;
  };

  const handleSwitchProject = (proj) => {
    applyProjectToStudio(proj, { closeConsole: true });
  };

  const softSwitchProject = (proj) => {
    return applyProjectToStudio(proj, { closeConsole: false });
  };

  const handleUpdateProjectGenre = (projId, genreKey) => {
    const profiles = getMergedGenreProfiles();
    const profile = profiles[genreKey];
    const genreLabel = profile?.label || profile?.name || genreKey;
    setProjectLibrary((prev) => {
      const next = (prev || []).map((p) =>
        p.id === projId
          ? { ...p, genreKey, genreLabel, presetProfile: genreKey }
          : p
      );
      const updated = next.find((p) => p.id === projId);
      if (updated && updated.title === currentProjectTitle && setPresetProfile) {
        setPresetProfile(genreKey);
        if (typeof window !== 'undefined') {
          localStorage.setItem('sps_preset_profile', genreKey);
          localStorage.setItem('sps_active_genre', genreKey);
        }
      }
      return next;
    });
  };

  // 2. CREATE NEW PROJECT (PRIMARY ADMIN AUTHORIZED RULE)
  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!isPrimaryOwner) {
      alert("🔒 ACCESS RESTRICTED:\nOnly the studio Admin can create new projects.");
      return;
    }
    if (!newTitle.trim()) return;

    const projId = `proj_${Date.now()}`;
    const cleanTitle = newTitle.trim().toUpperCase();

    // Check if a project with this exact title already exists
    const isDuplicate = projectLibrary.some(p => p.title.trim().toUpperCase() === cleanTitle);
    if (isDuplicate) {
      alert(`⚠️ DUPLICATE PROJECT TITLE:\nA project named "${cleanTitle}" already exists. Projects cannot have identical names. Please choose a unique name.`);
      return;
    }

    let initialShots = [...shots];
    if (newTemplate === 'epic_war') {
      initialShots = [
        {
          sceneShotId: 'SC01_SH01',
          shotComposition: 'Extreme Wide Shot (EWS)',
          cameraMotionTag: '[Camera: High-Angle Crane Sweep]',
          subjectLightingTag: '[Lighting: Fiery Sunset & Smoke Flares]',
          subjectColorTag: '[Subject Color: Saffron & Golden Armor]',
          backgroundLightingTag: '[BG Lighting: Atmospheric Dust & Fire Glow]',
          backgroundColorTag: '[BG Color: Deep Crimson & Smoke Black]',
          characterIdAssetRef: '[CharID: @Commander_Hero - Lead Warrior]',
          coArtistInteraction: '[Co-Artist: Thousands of soldiers assembled in phalanx formation]',
          actionEnvContext: 'Ancient battlefield plain under stormy skies, war banners fluttering in wind.',
          characterExpression: 'Fierce determination, shouting battle command',
          characterPlacement: 'Foreground ridge overlooking vast plain',
          characterDialogue: '"Forward into glory!"',
          characterMovement: 'Drawing sword towards sky',
          characterEyeLooks: '[Eye Look: Direct Laser Focus on Enemy Battalions]'
        }
      ];
    }

    const genreProfile = getMergedGenreProfiles()[newGenreKey] || GENRE_PRESET_PROFILES[newGenreKey];
    const newProjObj = {
      id: projId,
      title: cleanTitle,
      description: newDescription.trim() || 'Custom stage production project',
      targetModel: newModel,
      aspectRatio: newRatio,
      genreKey: newGenreKey || 'mythological',
      genreLabel: genreProfile?.label || genreProfile?.name || 'Stage Production Feature',
      presetProfile: newGenreKey || 'mythological',
      roomId: `SPS-${cleanTitle.slice(0, 4)}-${Math.floor(Math.random() * 8999 + 1000)}`,
      lastModified: new Date().toLocaleDateString(),
      shots: initialShots,
      versions: [
        {
          versionId: `v_${Date.now()}`,
          versionName: 'v1.0 Initial Creation',
          createdAt: new Date().toLocaleTimeString() + ' - ' + new Date().toLocaleDateString(),
          shots: initialShots
        }
      ]
    };

    clearDeletedProjectTitles([cleanTitle]);
    setProjectLibrary(prev => [...prev, newProjObj]);
    handleSwitchProject(newProjObj);
  };

  // 4. DUPLICATE PROJECT (admin only — creates a new project)
  const handleDuplicateProject = (proj) => {
    if (!isPrimaryOwner) {
      alert('🔒 ACCESS RESTRICTED:\nOnly the studio Admin can create or duplicate projects.');
      return;
    }
    const dupId = `proj_${Date.now()}`;
    let copyCount = 1;
    let dupTitle = `${proj.title} (COPY)`;
    while (projectLibrary.some(p => p.title.trim().toUpperCase() === dupTitle.toUpperCase())) {
      copyCount++;
      dupTitle = `${proj.title} (COPY ${copyCount})`;
    }
    const dupObj = {
      ...proj,
      id: dupId,
      title: dupTitle,
      lastModified: new Date().toLocaleDateString()
    };
    setProjectLibrary(prev => [...prev, dupObj]);
  };

  // 5. ARCHIVE PROJECT (PRIMARY ADMIN) — remove from library, keep in Archive for restore
  const handleDeleteProject = (projId) => {
    if (!isPrimaryOwner) {
      alert("🔒 ACCESS RESTRICTED:\nOnly the studio Admin can archive projects.");
      return;
    }

    if (projectLibrary.length <= 1) {
      alert("Cannot archive the last remaining project. Create a new project first!");
      return;
    }

    const targetProj = projectLibrary.find(p => p.id === projId);
    if (confirm(`Archive project "${targetProj?.title || projId}"?\n\nIt will leave the Library and move to Archive so you can restore it later.`)) {
      const deletedTitle = targetProj?.title || '';
      if (targetProj) archiveProjectSnapshot(targetProj);
      setArchivedProjects(getArchivedProjects());

      const updated = filterOutDeletedProjects(projectLibrary.filter(p => p.id !== projId));

      // Strip dead title from all collaborators' allotments (local + cloud)
      try {
        const rawUsers = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
        if (Array.isArray(rawUsers) && deletedTitle) {
          const pruned = ensurePrimaryAdminUser(
            sanitizeAuthorizedUsers(stripTitleFromAllottedProjects(rawUsers, deletedTitle))
          );
          localStorage.setItem('sps_authorized_phone_users', JSON.stringify(pruned));
          window.dispatchEvent(new Event('sps_collaborators_updated'));
          syncCollaboratorsToCloud(pruned);
        }
      } catch (e) {}

      setProjectLibrary(updated);
      try {
        safeLocalStorageSetItem('sps_project_library', JSON.stringify(updated));
        window.dispatchEvent(new Event('sps_projects_updated'));
        syncProjectLibraryToCloud(updated);
      } catch (e) {}

      if (activeProjectId === projId) {
        handleSwitchProject(updated[0]);
      }
    }
  };

  const handleRestoreArchivedProject = (archiveId) => {
    if (!isPrimaryOwner) {
      alert('🔒 Only the studio Admin can restore archived projects.');
      return;
    }
    const restored = restoreProjectFromArchive(archiveId);
    if (!restored) {
      alert('Could not restore that archived project.');
      return;
    }
    setArchivedProjects(getArchivedProjects());
    setProjectLibrary((prev) => {
      const key = String(restored.title).trim().toUpperCase();
      const without = (prev || []).filter((p) => String(p?.title || '').trim().toUpperCase() !== key);
      return [restored, ...without];
    });
    try {
      syncProjectLibraryToCloud(
        JSON.parse(localStorage.getItem('sps_project_library') || '[]')
      );
    } catch (e) {}
    setActiveTab('library');
  };

  const handlePurgeArchivedProject = (archiveId, title) => {
    if (!isPrimaryOwner) return;
    if (!confirm(`Permanently delete archived project "${title}"?\nThis cannot be undone.`)) return;
    purgeArchivedProject(archiveId);
    setArchivedProjects(getArchivedProjects());
  };

  // 6. CREATE VERSION SNAPSHOT
  const handleCreateSnapshot = () => {
    if (!newVersionName.trim()) return;
    const snapName = newVersionName.trim();

    setProjectLibrary(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        const newVer = {
          versionId: `v_${Date.now()}`,
          versionName: snapName,
          createdAt: new Date().toLocaleTimeString() + ' - ' + new Date().toLocaleDateString(),
          shots: [...shots]
        };
        return {
          ...p,
          versions: [newVer, ...(p.versions || [])]
        };
      }
      return p;
    }));

    setNewVersionName('');
    setVersionSuccessMsg(`✓ Created version snapshot "${snapName}"`);
    setTimeout(() => setVersionSuccessMsg(''), 3000);
  };

  // 7. RESTORE VERSION
  const handleRestoreVersion = (ver) => {
    if (confirm(`Restore version "${ver.versionName}"? Current unsaved shot edits will be replaced.`)) {
      if (setShots) setShots(ver.shots);
      onClose();
    }
  };

  // 8. SHARE & COPY LINK
  const shareableUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname}?room=${roomId}`
    : `${PRODUCTION_ORIGIN}?room=${roomId}`;

  const copyShareLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareableUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!isOpen) return null;
  if (isGuestSession() && !canGuestBrowseApp()) return null;

  return (
    <div className={`sps-overlay sps-project-console-overlay is-full ${isVaultFullscreen ? 'is-full' : ''}`}>
      <div className={`sps-shell sps-atelier-room sps-project-console-shell ${profileMenuOpen ? 'is-menu-open' : ''}`}>
        
        {!isVaultFullscreen && (
          <>
          <div
            className={`sps-project-console-toolbar sps-modal-head sps-project-console-head flex-row items-center gap-2 ${
              consoleToolbarHidden && !profileMenuOpen ? 'is-minimized' : ''
            } ${profileMenuOpen ? 'is-menu-open' : ''}`}
          >
          <div className="flex items-center gap-1.5 overflow-x-auto sps-header-scroll min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mr-0.5 shrink-0">
              <div className="w-7 h-7 border border-[var(--sps-border)] bg-[var(--sps-surface)] flex items-center justify-center shrink-0">
                <FolderKanban className="w-3.5 h-3.5" style={{ color: 'var(--sps-gold)' }} />
              </div>
              <h2 className="text-[13px] font-semibold tracking-tight m-0 shrink-0" style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}>
                Projects
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`sps-btn text-[10px] shrink-0 py-1 ${activeTab === 'library' ? 'sps-btn-primary' : ''}`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Library</span>
            </button>
            {isPrimaryOwner && (
              <button
                type="button"
                onClick={() => {
                  setArchivedProjects(getArchivedProjects());
                  setActiveTab('archive');
                }}
                className={`sps-btn text-[10px] shrink-0 py-1 ${activeTab === 'archive' ? 'sps-btn-primary' : ''}`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">Archive</span>
                {archivedProjects.length > 0 && (
                  <span className="ml-0.5 px-1 py-0 text-[9px] font-black" style={{ background: 'color-mix(in srgb, var(--sps-text) 8%, transparent)' }}>
                    {archivedProjects.length}
                  </span>
                )}
              </button>
            )}
            {activeTab === 'library' && (
              <div className="flex items-center shrink-0 border border-[var(--sps-border)]">
                <button
                  type="button"
                  onClick={() => setLibraryViewMode('gallery')}
                  className={`sps-btn text-[10px] shrink-0 py-1 ${libraryView === 'gallery' ? 'sps-btn-primary' : ''}`}
                  title="Poster gallery — tap a poster to open"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryViewMode('detail')}
                  className={`sps-btn text-[10px] shrink-0 py-1 ${libraryView === 'detail' ? 'sps-btn-primary' : ''}`}
                  title="Detailed project cards"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">Detail</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 flex-nowrap">
            <button
              type="button"
              onClick={() => onOpenNavigatorShortcutHelp?.()}
              className="sps-icon-btn shrink-0 hidden md:inline-flex"
              title="Navigator shortcut (Shift + Space)"
              aria-label="Show navigator keyboard shortcut"
            >
              <kbd style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--sps-font-mono)', lineHeight: 1 }}>⇧␣</kbd>
            </button>

            {isPrimaryOwner && (
              <>
                <button
                  type="button"
                  onClick={handleOpenProjectFolder}
                  className="sps-btn text-[10px] shrink-0 py-1 px-2"
                  title="Open project folder (ASSETS · PROJECT · RENDERS)"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Open folder</span>
                </button>
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="sps-btn text-[10px] shrink-0 py-1 px-2 hidden xl:flex"
                  title="Open backup file (.sps / .json)"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Open file</span>
                </button>
              </>
            )}

            {isPrimaryOwner ? (
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`sps-btn text-[10px] shrink-0 py-1 px-2 ${activeTab === 'create' ? 'sps-btn-primary' : ''}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">New</span>
              </button>
            ) : null}

            <PinBarButton
              pinned={consoleToolbarPinned}
              onToggle={() => {
                setConsoleToolbarPinned((v) => {
                  const next = !v;
                  if (next) setConsoleToolbarHidden(false);
                  return next;
                });
              }}
              label="Projects bar"
            />

            <button
              type="button"
              onClick={() => {
                if (!isAdminLoggedIn) {
                  onOpenLogin?.();
                  return;
                }
                onOpenAdminSettings?.('all');
              }}
              className={`sps-icon-btn shrink-0 ${isAdminLoggedIn ? 'is-on' : ''}`}
              title={isAdminLoggedIn ? 'Settings' : 'Sign in for settings'}
              aria-label="Settings"
            >
              {isAdminLoggedIn ? <Settings className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            </button>

            <StudioProfileControl
              onSwitchAccount={onSwitchAccount}
              onLogout={onLogout}
              onOpenLogin={onOpenLogin}
              onOpenChange={(open) => {
                setProfileMenuOpen(open);
                if (open) setConsoleToolbarHidden(false);
              }}
            />

            <button
              type="button"
              onClick={onClose}
              className="sps-icon-btn shrink-0"
              title="Close"
              aria-label="Close Project Console"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          </div>
          {consoleToolbarHidden && !consoleToolbarPinned ? (
            <button
              type="button"
              className="sps-project-console-toolbar-peek"
              onClick={() => setConsoleToolbarHidden(false)}
              title="Show toolbar"
              aria-label="Show project console toolbar"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Toolbar</span>
            </button>
          ) : null}
          </>
        )}

        <div
          ref={consoleScrollRef}
          onScroll={handleConsoleScroll}
          className={`sps-project-console-scroll flex-1 min-h-0 overflow-y-auto sps-atelier-pane sps-project-console-pane ${
            activeTab === 'library' && libraryView === 'detail' ? 'sps-project-console-scroll-snap' : ''
          } ${activeTab === 'library' && libraryView === 'gallery' ? 'sps-project-console-scroll-gallery' : ''} ${
            consoleToolbarHidden ? 'is-toolbar-hidden' : ''
          }`}
        >
          
          {/* TAB 1: PROJECT LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-2 sps-project-library">
              <input 
                type="file" 
                ref={importFileRef} 
                onChange={handleBackupFileImport} 
                accept=".json,.sps" 
                className="hidden" 
              />



              {/* Hidden File Input for Custom Movie Poster Art Upload */}
              <input type="file" ref={posterFileInputRef} onChange={handlePosterFileChange} accept="image/*" className="hidden" />

              {!isPrimaryOwner && (
                <div className="sps-project-library-banner w-full px-4 py-2.5 border border-cyan-500/30 bg-cyan-500/10 text-cyan-100 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Showing <strong>{visibleProjectLibrary.length}</strong> allotted project{visibleProjectLibrary.length === 1 ? '' : 's'} for <strong>{currentUserEmail || 'your account'}</strong>
                    {allottedTitles.length > 0 ? (
                      <> — {allottedTitles.join(', ')}</>
                    ) : null}
                  </span>
                  <span className="text-[10px] text-cyan-300/80">Other studio projects are hidden</span>
                </div>
              )}
              {visibleProjectLibrary.length === 0 && (
                <div className="sps-project-library-banner w-full p-6 border border-amber-500/30 bg-amber-500/10 text-amber-100 text-xs font-mono">
                  No projects are allotted to <strong>{currentUserEmail || 'this account'}</strong>. Ask the studio Admin to allot a project in Admin Settings.
                </div>
              )}

              {/* Project cards — gallery (posters) or detail (full cards) */}
              {libraryView === 'gallery' ? (
                <div className="sps-project-gallery-grid w-full">
                  {libraryProjectsForDisplay.map((proj, projIdx) => {
                    const isActive = titlesMatch(currentProjectTitle, proj.title);
                    const poster = getProjectPosterStyle(proj.title);
                    const posterSrc =
                      resolveImageUrl(proj.posterUrl) ||
                      (proj.posterUrl && !String(proj.posterUrl).startsWith('idb:') ? proj.posterUrl : '');
                    const hasPoster = Boolean(posterSrc);

                    return (
                      <button
                        key={proj.id || `gallery_${projIdx}`}
                        type="button"
                        className={`sps-project-gallery-cell ${isActive ? 'is-active' : ''}`}
                        onClick={() => {
                          if (isActive) onClose();
                          else handleSwitchProject(proj);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          handlePosterDoubleTap(proj);
                        }}
                        title={`${proj.title} · ${isActive ? 'Open studio' : 'Switch project'} · double-tap poster to replace`}
                      >
                        {hasPoster ? (
                          <img
                            src={posterSrc}
                            alt=""
                            className="sps-project-gallery-img pointer-events-none"
                            draggable={false}
                            onError={(ev) => {
                              const api = typeof window !== 'undefined' ? window.electronAPI : null;
                              if (!api?.readPosterDataUrl || !proj.title) return;
                              api.readPosterDataUrl(proj.title).then((res) => {
                                if (res?.ok && res.dataUrl && ev?.target) {
                                  ev.target.src = res.dataUrl;
                                }
                              }).catch(() => {});
                            }}
                          />
                        ) : (
                          <div
                            className={`sps-project-gallery-fallback bg-gradient-to-b ${poster.gradient} flex flex-col items-center justify-center ${
                              isActive ? 'pt-7' : ''
                            }`}
                          >
                            <span className="sps-project-gallery-fallback-icon">{poster.icon}</span>
                            <span className="sps-project-gallery-fallback-hint">Double-tap to add poster</span>
                          </div>
                        )}
                        {isActive ? (
                          <span className="sps-project-gallery-active" aria-hidden="true">Active</span>
                        ) : null}
                        <span className="sps-project-gallery-label">{proj.title}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
              <div className="flex flex-col w-full sps-project-library-list">
                {libraryProjectsForDisplay.map((proj, projIdx) => {
                  const isActive = titlesMatch(currentProjectTitle, proj.title);
                  const isAllotted = checkIsProjectAllotted(proj.title);
                  const poster = getProjectPosterStyle(proj.title);
                  const projectGenreKey = resolveProjectGenreKey(proj);
                  const posterSrc =
                    resolveImageUrl(proj.posterUrl) ||
                    (proj.posterUrl && !String(proj.posterUrl).startsWith('idb:') ? proj.posterUrl : '');
                  const hasPoster = Boolean(posterSrc);

                  return (
                    <div
                      key={proj.id || `proj_${projIdx}`}
                      className={`sps-project-tile relative w-full border overflow-hidden group/card ${
                        isActive
                          ? 'is-active'
                          : isAllotted
                            ? ''
                            : 'opacity-85'
                      }`}
                      style={{ animationDelay: `${Math.min(projIdx, 8) * 40}ms` }}
                    >
                      {/* LEFT: full-height 4:5 poster column — double-tap to replace */}
                      <div
                        className={`sps-project-poster relative overflow-hidden border-b sm:border-b-0 sm:border-r border-[var(--sps-border)] cursor-pointer select-none ${
                          hasPoster ? 'bg-[#161412]' : `bg-gradient-to-b ${poster.gradient} p-3 flex flex-col justify-between`
                        }`}
                        onClick={() => handlePosterDoubleTap(proj)}
                        title="Double-tap to replace poster (4:5)"
                      >
                        {hasPoster ? (
                          <img
                            src={posterSrc}
                            alt={`${proj.title} official movie poster`}
                            className="sps-project-poster-img pointer-events-none"
                            draggable={false}
                            onError={(ev) => {
                              const api = typeof window !== 'undefined' ? window.electronAPI : null;
                              if (!api?.readPosterDataUrl || !proj.title) return;
                              api.readPosterDataUrl(proj.title).then((res) => {
                                if (res?.ok && res.dataUrl && ev?.target) {
                                  ev.target.src = res.dataUrl;
                                }
                              }).catch(() => {});
                            }}
                          />
                        ) : (
                          <>
                            <div className="flex flex-col items-center justify-center flex-1 text-center p-2 pointer-events-none">
                              <div className="text-4xl mb-2 opacity-90">
                                {poster.icon}
                              </div>
                              <span className="text-[9px] text-amber-400 tracking-[0.2em] uppercase font-bold" style={{ fontFamily: 'var(--sps-font-mono)' }}>
                                Official poster
                              </span>
                              <h3 className="text-base font-extrabold text-white tracking-tight uppercase max-w-xs drop-shadow-lg leading-tight mt-1 line-clamp-3" style={{ fontFamily: 'var(--sps-font-display)' }}>
                                {proj.title}
                              </h3>
                            </div>
                            <div className="z-10 mt-auto pt-2 pointer-events-none">
                              <span className="text-[9px] text-zinc-300 tracking-widest uppercase font-bold block drop-shadow" style={{ fontFamily: 'var(--sps-font-mono)' }}>
                                {poster.tagline}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* RIGHT: metadata + action grid (poster left / controls right) */}
                      <div className="sps-project-details p-3 sm:p-4 flex-1 flex flex-col justify-between gap-3 min-w-0">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isActive ? (
                              <span className="text-[10px] bg-cyan-400 text-slate-950 px-2 py-0.5 font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-slate-950 stroke-[3]" /> Active
                              </span>
                            ) : (
                              <span className="sps-chip text-[10px] font-semibold">
                                {proj.shots?.length || 0} shots
                              </span>
                            )}
                          </div>
                          <div className="sps-project-genre-box flex flex-col gap-1.5 min-w-0 border border-slate-200/90 dark:border-white/[0.07] bg-slate-50/80 dark:bg-black/25 px-3 py-2.5">
                            <label className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 dark:text-zinc-500">
                              Project genre
                            </label>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[11px] px-2 py-1 font-bold border shrink-0 ${poster.badgeBg}`}>
                                {poster.icon}
                              </span>
                              <select
                                value={projectGenreKey}
                                onChange={(e) => handleUpdateProjectGenre(proj.id, e.target.value)}
                                disabled={guestLook || (!isPrimaryOwner && !checkIsProjectAllotted(proj.title))}
                                className="sps-input-premium flex-1 min-w-0 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-800 dark:text-amber-200 px-2.5 py-1.5 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                title={isPrimaryOwner || checkIsProjectAllotted(proj.title) ? 'Set cinema genre for this project' : 'Genre locked'}
                                aria-label={`Genre for ${proj.title}`}
                              >
                                {Object.entries(mergedGenreProfiles).map(([key, profile]) => (
                                  <option key={key} value={key}>
                                    {profile.label || profile.name || key}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {editingProjectId === proj.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleRenameProject(proj.id, renameInput);
                              }}
                              className="flex items-center gap-1.5 pt-0.5"
                            >
                              <input
                                type="text"
                                value={renameInput}
                                onChange={(e) => setRenameInput(e.target.value)}
                                autoFocus
                                placeholder="ENTER TITLE"
                                className="sps-input-premium bg-slate-950 text-amber-300 font-bold border border-amber-400 rounded-lg px-2.5 py-1 text-xs w-full"
                              />
                              <button type="submit" className="sps-chrome-btn p-1.5 bg-emerald-600 text-white rounded-lg"><Check className="w-4 h-4" /></button>
                              <button type="button" onClick={() => setEditingProjectId(null)} className="sps-chrome-btn p-1.5 bg-slate-800 text-slate-300 rounded-lg"><X className="w-4 h-4" /></button>
                            </form>
                          ) : (
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <h4 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate min-w-0" style={{ fontFamily: 'var(--sps-font-display)' }}>
                                {proj.title}
                              </h4>
                              <button
                                type="button"
                                onClick={() => { setEditingProjectId(proj.id); setRenameInput(proj.title); }}
                                className="sps-chrome-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-amber-500 shrink-0 cursor-pointer"
                                title="Rename Title"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <p className="text-xs sm:text-[13px] text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                            {proj.description || `Cinema Production Studio Project with ${proj.shots?.length || 0} shots`}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-0.5">
                            <span className="sps-chip inline-flex items-center gap-1">
                              <Ratio className="w-3 h-3" /> {proj.aspectRatio}
                            </span>
                            <span className="sps-chip inline-flex items-center gap-1">
                              <KeyRound className="w-3 h-3" /> {proj.roomId}
                            </span>
                          </div>

                          {!guestLook && (isPrimaryOwner || checkIsProjectAllotted(proj.title)) ? (
                            <button
                              type="button"
                              className="sps-btn text-[10px] w-full justify-start gap-1.5"
                              onClick={() => setAssetFoldersProjId(proj.id)}
                              title="ASSETS · RENDERS · PROJECT paths for this film"
                            >
                              <Folder className="w-3 h-3 shrink-0" />
                              <span className="truncate">Asset folders</span>
                            </button>
                          ) : null}

                          <ProjectDrivePanel
                            project={{
                              ...proj,
                              shots: isActive ? shots : proj.shots || [],
                              targetModel: isActive ? targetModel : proj.targetModel,
                              aspectRatio: proj.aspectRatio,
                              roomId: isActive ? roomId : proj.roomId,
                            }}
                            guestLook={guestLook}
                          />
                        </div>

                        <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-2">
                          {!guestLook && (
                          <button
                            type="button"
                            onClick={() => {
                              // Soft-switch only — never close console when opening AI Breakdown
                              if (!isActive) {
                                const ok = softSwitchProject(proj);
                                if (!ok) return;
                              }
                              setCustomProjectTitle(proj.title);
                              setActiveTab('ai_breakdown');
                            }}
                            className="sps-btn sps-btn-primary w-full justify-center"
                            title={`Run AI Script Breakdown for ${proj.title}`}
                          >
                            <Wand2 className="w-4 h-4 shrink-0" />
                            <span>AI Script Breakdown</span>
                          </button>
                          )}

                          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPsychologyProjId(proj.id);
                                setVaultCategory('director');
                                setActiveTab('director_psychology');
                              }}
                              className="sps-btn text-[11px] justify-center"
                              title={`Open Director's Vision Vault for ${proj.title}`}
                            >
                              <Brain className="w-3.5 h-3.5 shrink-0" />
                              <span>Director</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPsychologyProjId(proj.id);
                                setVaultCategory('dop');
                                setActiveTab('director_psychology');
                              }}
                              className="sps-btn text-[11px] justify-center"
                              title={`Open DoP Cinematography Vault for ${proj.title}`}
                            >
                              <Camera className="w-3.5 h-3.5 shrink-0" />
                              <span>DoP</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPsychologyProjId(proj.id);
                                setVaultCategory('sound');
                                setActiveTab('director_psychology');
                              }}
                              className="sps-btn text-[11px] justify-center"
                              title={`Open Music Director & Sound Vault for ${proj.title}`}
                            >
                              <Music2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Sound</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (!isActive) handleSwitchProject(proj);
                              onClose();
                            }}
                            className={`sps-btn w-full justify-center ${isActive ? 'sps-btn-primary' : ''}`}
                          >
                            {isActive ? <Play className="w-4 h-4 fill-current" /> : <ArrowRight className="w-4 h-4" />}
                            <span>{isActive ? 'Open Active Studio' : 'Switch & Open Project'}</span>
                          </button>

                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            {isPrimaryOwner ? (
                              <button
                                type="button"
                                onClick={() => handleDuplicateProject(proj)}
                                className="sps-btn text-[11px] justify-center"
                                title="Duplicate Project"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </button>
                            ) : (
                              <div className="py-1.5 px-2 rounded-[var(--sps-radius-sm)] text-[11px] font-semibold text-center" style={{ color: 'var(--sps-muted)', background: 'var(--sps-surface)' }}>
                                Edit only
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => exportProjectPackageToFile(proj)}
                              className="sps-btn text-[11px] justify-center"
                              title="Download .sps backup file (not the same as Project save folder versioning)"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Backup</span>
                            </button>

                            {isPrimaryOwner ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(proj.id)}
                                className="sps-btn text-[11px] justify-center"
                                title="Move project to Archive (can restore later)"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Archive</span>
                              </button>
                            ) : (
                              <div className="py-1.5 px-2 rounded-[var(--sps-radius-sm)] text-[11px] font-semibold text-center" style={{ color: 'var(--sps-muted)', background: 'var(--sps-surface)' }}>
                                Locked
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* TAB: PROJECT ARCHIVE — restore or permanently purge */}
          {activeTab === 'archive' && isPrimaryOwner && (
            <div className="h-full overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Archive className="w-4 h-4 text-amber-500" />
                    Project Archive
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 max-w-xl">
                    Archived projects are removed from the Library but kept here so you can restore them. They will not reappear in the live library until restored.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setArchivedProjects(getArchivedProjects())}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-bold border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {archivedProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 p-10 text-center text-slate-500 dark:text-zinc-500 text-sm">
                  Archive is empty. Use <strong className="text-slate-700 dark:text-zinc-300">Archive</strong> on a Library card to move a project here.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {archivedProjects.map((proj) => (
                    <div
                      key={proj.archiveId || proj.id}
                      className="rounded-2xl border border-amber-500/25 bg-amber-50/60 dark:bg-zinc-900/80 p-4 flex flex-col gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-black text-slate-900 dark:text-white truncate">{proj.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          {Array.isArray(proj.shots) ? proj.shots.length : (proj.shotCount || 0)} shots
                          {proj.archivedAtLabel ? ` · Archived ${proj.archivedAtLabel}` : ''}
                        </p>
                        {proj.description && (
                          <p className="text-[11px] text-slate-600 dark:text-zinc-500 mt-1 line-clamp-2">{proj.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-auto">
                        <button
                          type="button"
                          onClick={() => handleRestoreArchivedProject(proj.archiveId || proj.id)}
                          className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore to Library
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePurgeArchivedProject(proj.archiveId || proj.id, proj.title)}
                          className="py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Permanently delete from Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Purge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI SCRIPT BREAKDOWN (mirrored in Writer) */}
          {activeTab === 'ai_breakdown' && (
            <AiScriptBreakdownPanel
              projectTitle={String(customProjectTitle || currentProjectTitle || '').trim()}
              shots={shots}
              onApplyShots={onApplyShots}
              setShots={setShots}
              setPresetProfile={setPresetProfile}
              onApplied={onClose}
              showBack
              onBack={() => setActiveTab('library')}
              eventSource="project_console"
              className="h-full min-h-[28rem]"
            />
          )}

          {/* Genre is per-project on library cards — global genre tab removed */}

          {/* TAB 4: CREATE NEW PROJECT (admin only) */}
          {activeTab === 'create' && (
            isPrimaryOwner ? (
            <form onSubmit={handleCreateProject} className="space-y-4 font-mono max-w-2xl mx-auto p-4 bg-white dark:bg-zinc-900/90 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-md">
              <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-500" /> Create New Cinema Production Project
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Initialize a new master project with custom framing, model specs, and initial shot template.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Project Title / Production Code:</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. PROJECT KARA-DHUSHAN"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Production Logline / Description:</label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="e.g. Master epic action sequence set in Dandaka forest"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Target Generative Model:</label>
                    <select
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 font-bold focus:outline-none focus:border-cyan-500"
                    >
                      <option value="SPS Direct Cinema 2.0">SPS Direct Cinema 2.0</option>
                      <option value="SPS High Fidelity 1.0">SPS High Fidelity 1.0</option>
                      <option value="Seedance 2.0">Studio Video</option>
                      <option value="SeeDream 1.0">Studio Image</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Target Aspect Ratio:</label>
                    <select
                      value={newRatio}
                      onChange={(e) => setNewRatio(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 font-bold focus:outline-none focus:border-cyan-500"
                    >
                      <option value="2.39:1 Anamorphic">2.39:1 Anamorphic</option>
                      <option value="16:9 Widescreen">16:9 Widescreen</option>
                      <option value="9:16 Vertical">9:16 Vertical</option>
                      <option value="1:1 Square">1:1 Square</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Project Genre Profile:</label>
                  <select
                    value={newGenreKey}
                    onChange={(e) => setNewGenreKey(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {Object.entries(mergedGenreProfiles).map(([key, profile]) => (
                      <option key={key} value={key}>
                        {profile.label || profile.name || key}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('library')}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Create Project
                </button>
              </div>
            </form>
            ) : (
              <div className="max-w-xl mx-auto p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-100 text-xs font-mono space-y-2">
                <p className="font-bold">Project creation is Admin-only.</p>
                <p>Editors and Viewers can only open allotted projects. Only the studio Admin can create, delete, duplicate, or import projects.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('library')}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-[11px] font-bold"
                >
                  Back to Allotted Projects
                </button>
              </div>
            )
          )}

          {/* TAB 4: DEDICATED CRAFT VISION VAULTS (DIRECTOR, DoP, SOUND & MUSIC) */}
          {activeTab === 'director_psychology' && (
            <div className="space-y-2 animate-in fade-in duration-200 font-mono h-full flex flex-col justify-between">
              {/* Single Ultra-Compact 1-Line Control Bar (32px Total Height) */}
              <div className="p-2 px-3 rounded-xl bg-gradient-to-r from-amber-950/90 via-zinc-900 to-black border border-amber-500/40 shadow-md flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
                {/* Left: Vault Category Switcher + Project Selector + Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Tri-Vault Category Switcher */}
                  <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setVaultCategory('director')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        vaultCategory === 'director' ? 'bg-amber-500 text-zinc-950 shadow-sm font-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      🧠 Director
                    </button>
                    <button
                      type="button"
                      onClick={() => setVaultCategory('dop')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        vaultCategory === 'dop' ? 'bg-cyan-500 text-zinc-950 shadow-sm font-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      🎥 DoP
                    </button>
                    <button
                      type="button"
                      onClick={() => setVaultCategory('sound')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        vaultCategory === 'sound' ? 'bg-purple-600 text-white shadow-sm font-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      🎵 Sound
                    </button>
                  </div>

                  <select
                    value={targetPsychologyProj?.id || ''}
                    onChange={(e) => setSelectedPsychologyProjId(e.target.value)}
                    className="bg-black text-amber-300 font-bold border border-amber-500/60 rounded-lg px-2 py-0.5 text-xs focus:outline-none cursor-pointer shadow-sm"
                  >
                    {vaultVisibleLibrary.length === 0 && (
                      <option value="">No allotted projects</option>
                    )}
                    {vaultVisibleLibrary.map(p => (
                      <option key={p.id} value={p.id}>
                        🎬 {p.title} ({p.shots?.length || 0} Shots) {p.title === currentProjectTitle ? '• [ACTIVE]' : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleAISynthesizeDirectorPsychology}
                    disabled={isSynthesizingPsychology}
                    className="px-2 py-0.5 rounded-lg bg-purple-950/90 hover:bg-purple-900 text-purple-200 border border-purple-500/50 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title={`Generate deep AI ${vaultCategory.toUpperCase()} vision analysis`}
                  >
                    {isSynthesizingPsychology ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 text-purple-400" />}
                    <span>Auto-AI</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMergeHybridVision}
                    disabled={isMergingHybrid}
                    className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 text-[10px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title={`Fuse Human Notes + AI Intel into Master Hybrid ${vaultCategory.toUpperCase()} Vision`}
                  >
                    {isMergingHybrid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>Merge Hybrid</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || directorExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-200 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={
                      directorExportBlocked
                        ? directorExportLife.message
                        : 'Print Director psychology PDF'
                    }
                    onClick={() => exportVisionCategoryPdf('director')}
                  >
                    <Download className="w-3 h-3" />
                    <span>Dir PDF</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || directorExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-200 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={
                      directorExportBlocked
                        ? directorExportLife.message
                        : roomId
                          ? `Download Director vision ZIP · room:${roomId}`
                          : 'Download Director vision ZIP (markdown + META)'
                    }
                    onClick={() => exportVisionCategoryZip('director')}
                  >
                    <Download className="w-3 h-3" />
                    <span>Dir ZIP</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || directorExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-200 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={
                      directorExportBlocked
                        ? directorExportLife.message
                        : roomId
                          ? `Download Director vision CSV · room:${roomId}`
                          : 'Download Director vision CSV (stream × field)'
                    }
                    onClick={() => exportVisionCategoryCsv('director')}
                  >
                    <Download className="w-3 h-3" />
                    <span>Dir CSV</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || dopExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-200 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={dopExportBlocked ? directorExportLife.message : 'Print DoP vision PDF'}
                    onClick={() => exportVisionCategoryPdf('dop')}
                  >
                    <Download className="w-3 h-3" />
                    <span>DoP PDF</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || dopExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-200 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={
                      dopExportBlocked
                        ? directorExportLife.message
                        : roomId
                          ? `Download DoP vision ZIP · room:${roomId}`
                          : 'Download DoP vision ZIP (markdown + META)'
                    }
                    onClick={() => exportVisionCategoryZip('dop')}
                  >
                    <Download className="w-3 h-3" />
                    <span>DoP ZIP</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || dopExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-200 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={
                      dopExportBlocked
                        ? directorExportLife.message
                        : roomId
                          ? `Download DoP vision CSV · room:${roomId}`
                          : 'Download DoP vision CSV (stream × field)'
                    }
                    onClick={() => exportVisionCategoryCsv('dop')}
                  >
                    <Download className="w-3 h-3" />
                    <span>DoP CSV</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || soundExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-purple-200 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={soundExportBlocked ? directorExportLife.message : (roomId ? `Print Sound vision PDF · room:${roomId}` : 'Print Sound vision PDF')}
                    onClick={() => exportVisionCategoryPdf('sound')}
                  >
                    <Download className="w-3 h-3" />
                    <span>Sound PDF</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || soundExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-purple-200 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={
                      soundExportBlocked
                        ? directorExportLife.message
                        : roomId
                          ? `Download Sound vision ZIP · room:${roomId}`
                          : 'Download Sound vision ZIP (markdown + META)'
                    }
                    onClick={() => exportVisionCategoryZip('sound')}
                  >
                    <Download className="w-3 h-3" />
                    <span>Sound ZIP</span>
                  </button>
                  <button
                    type="button"
                    disabled={!targetPsychologyProj || soundExportBlocked}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-purple-200 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title={
                      soundExportBlocked
                        ? directorExportLife.message
                        : roomId
                          ? `Download Sound vision CSV · room:${roomId}`
                          : 'Download Sound vision CSV (stream × field)'
                    }
                    onClick={() => exportVisionCategoryCsv('sound')}
                  >
                    <Download className="w-3 h-3" />
                    <span>Sound CSV</span>
                  </button>
                </div>

                {/* Right: 3 Vision Sub-Tabs (Human, AI, Master Hybrid) */}
                <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 shrink-0">
                  {/* Human Tab */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleSavePsychologyObj({ ...currentPsychologyObj, activeVisionTab: 'human' })}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        activeVisionTab === 'human' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      👤 Human
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSavePsychologyObj({ ...currentPsychologyObj, compilerActiveMode: 'human' })}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                        compilerActiveMode === 'human' ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-black' : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                      title="Set Human Stream as Active Compiler Target"
                    >
                      {compilerActiveMode === 'human' ? '✅ ACTIVE' : '[ USE ]'}
                    </button>
                  </div>

                  {/* AI Tab */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleSavePsychologyObj({ ...currentPsychologyObj, activeVisionTab: 'ai' })}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        activeVisionTab === 'ai' ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      🤖 AI
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSavePsychologyObj({ ...currentPsychologyObj, compilerActiveMode: 'ai' })}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                        compilerActiveMode === 'ai' ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-black' : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                      title="Set AI Stream as Active Compiler Target"
                    >
                      {compilerActiveMode === 'ai' ? '✅ ACTIVE' : '[ USE ]'}
                    </button>
                  </div>

                  {/* Hybrid Tab */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleSavePsychologyObj({ ...currentPsychologyObj, activeVisionTab: 'hybrid' })}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        activeVisionTab === 'hybrid' ? 'bg-gradient-to-r from-amber-400 via-purple-400 to-cyan-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      ⚡ Hybrid
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSavePsychologyObj({ ...currentPsychologyObj, compilerActiveMode: 'hybrid' })}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                        compilerActiveMode === 'hybrid' ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-black' : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                      title="Set Master Hybrid Stream as Active Compiler Target"
                    >
                      {compilerActiveMode === 'hybrid' ? '✅ ACTIVE' : '[ USE ]'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Dynamic Core Vault Cards for Selected Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 h-full min-h-0 overflow-y-auto pt-1">
                {/* Card 1 */}
                <div className="p-4 rounded-2xl bg-zinc-900/95 border border-amber-500/30 shadow-lg flex flex-col justify-between space-y-2 min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      {vaultCategory === 'dop' ? (
                        <><span>💡</span> 1. Lighting & Contrast Philosophy (Chiaroscuro)</>
                      ) : vaultCategory === 'sound' ? (
                        <><span>🎼</span> 1. Core Musical Motif & Score Theme</>
                      ) : (
                        <><span>📜</span> 1. Philosophical Idea & Thematic Soul</>
                      )}
                    </h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                      {vaultCategory} • {activeVisionTab}
                    </span>
                  </div>
                  <textarea
                    value={
                      vaultCategory === 'dop' ? (currentVisionFields?.lightingPhilosophy || '') :
                      vaultCategory === 'sound' ? (currentVisionFields?.musicalMotifScore || '') :
                      (currentVisionFields?.corePhilosophicalIdea || '')
                    }
                    onChange={(e) => {
                      const key = vaultCategory === 'dop' ? 'lightingPhilosophy' : vaultCategory === 'sound' ? 'musicalMotifScore' : 'corePhilosophicalIdea';
                      handleUpdateCurrentVisionFields({ [key]: e.target.value });
                    }}
                    placeholder={
                      vaultCategory === 'dop' ? "Define chiaroscuro lighting, tungsten rim highlights, and shadow EV falloff..." :
                      vaultCategory === 'sound' ? "Define musical score motifs, ancient chants, and sub-bass synthesizer pulses..." :
                      "Articulate the deep philosophical soul beneath this film..."
                    }
                    className="w-full flex-1 min-h-[140px] bg-zinc-950 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-100 font-mono focus:outline-none focus:border-amber-400 leading-relaxed shadow-inner"
                  />
                </div>

                {/* Card 2 */}
                <div className="p-4 rounded-2xl bg-zinc-900/95 border border-amber-500/30 shadow-lg flex flex-col justify-between space-y-2 min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      {vaultCategory === 'dop' ? (
                        <><span>🎥</span> 2. Camera Movement & Framing Energy</>
                      ) : vaultCategory === 'sound' ? (
                        <><span>🔊</span> 2. Foley Environment & Auditory Weight</>
                      ) : (
                        <><span>🎯</span> 2. Belief of Success & Audience Hook</>
                      )}
                    </h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                      {vaultCategory} • {activeVisionTab}
                    </span>
                  </div>
                  <textarea
                    value={
                      vaultCategory === 'dop' ? (currentVisionFields?.cameraMovementEnergy || '') :
                      vaultCategory === 'sound' ? (currentVisionFields?.foleySoundEnvironment || '') :
                      (currentVisionFields?.directorBeliefOfSuccess || '')
                    }
                    onChange={(e) => {
                      const key = vaultCategory === 'dop' ? 'cameraMovementEnergy' : vaultCategory === 'sound' ? 'foleySoundEnvironment' : 'directorBeliefOfSuccess';
                      handleUpdateCurrentVisionFields({ [key]: e.target.value });
                    }}
                    placeholder={
                      vaultCategory === 'dop' ? "Define camera movement language (Snorricam tracking, fluid Steadicam, low-angle crane)..." :
                      vaultCategory === 'sound' ? "Define environmental foley weight, metallic impact echo, and cavernous reverb..." :
                      "Explain why this script's psychological hook connects with global audiences..."
                    }
                    className="w-full flex-1 min-h-[140px] bg-zinc-950 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-100 font-mono focus:outline-none focus:border-amber-400 leading-relaxed shadow-inner"
                  />
                </div>

                {/* Card 3 */}
                <div className="p-4 rounded-2xl bg-zinc-900/95 border border-amber-500/30 shadow-lg flex flex-col justify-between space-y-2 min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      {vaultCategory === 'dop' ? (
                        <><span>🎨</span> 3. Color Science & ISO Grain Texture</>
                      ) : vaultCategory === 'sound' ? (
                        <><span>🎙️</span> 3. Dialogue & Vocal Resonance EQ</>
                      ) : (
                        <><span>⚡</span> 3. Emotional Frequency Target</>
                      )}
                    </h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                      {vaultCategory} • {activeVisionTab}
                    </span>
                  </div>
                  <textarea
                    value={
                      vaultCategory === 'dop' ? (currentVisionFields?.colorScienceTexture || '') :
                      vaultCategory === 'sound' ? (currentVisionFields?.vocalDialogueResonance || '') :
                      (currentVisionFields?.emotionalFrequencyTarget || '')
                    }
                    onChange={(e) => {
                      const key = vaultCategory === 'dop' ? 'colorScienceTexture' : vaultCategory === 'sound' ? 'vocalDialogueResonance' : 'emotionalFrequencyTarget';
                      handleUpdateCurrentVisionFields({ [key]: e.target.value });
                    }}
                    placeholder={
                      vaultCategory === 'dop' ? "Define Kodak LUT profiles, sodium amber saturation, cyan shadows, and 35mm ISO grain..." :
                      vaultCategory === 'sound' ? "Define vocal proximity resonance, low-frequency EQ, and acoustic decay..." :
                      "Define the subconscious emotional frequency..."
                    }
                    className="w-full flex-1 min-h-[140px] bg-zinc-950 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-100 font-mono focus:outline-none focus:border-amber-400 leading-relaxed shadow-inner"
                  />
                </div>

                {/* Card 4 */}
                <div className="p-4 rounded-2xl bg-zinc-900/95 border border-amber-500/30 shadow-lg flex flex-col justify-between space-y-2 min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      {vaultCategory === 'dop' ? (
                        <><span>🔍</span> 4. Lens Profiles & Aspect Ratio Rules</>
                      ) : vaultCategory === 'sound' ? (
                        <><span>⏱️</span> 4. Rhythm, Tempo & Silence Sync</>
                      ) : (
                        <><span>🎥</span> 4. Directorial Production Rules</>
                      )}
                    </h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                      {vaultCategory} • {activeVisionTab}
                    </span>
                  </div>
                  <textarea
                    value={
                      vaultCategory === 'dop' ? (currentVisionFields?.lensAspectRules || '') :
                      vaultCategory === 'sound' ? (currentVisionFields?.rhythmTempoSync || '') :
                      (currentVisionFields?.directorialRules || '')
                    }
                    onChange={(e) => {
                      const key = vaultCategory === 'dop' ? 'lensAspectRules' : vaultCategory === 'sound' ? 'rhythmTempoSync' : 'directorialRules';
                      handleUpdateCurrentVisionFields({ [key]: e.target.value });
                    }}
                    placeholder={
                      vaultCategory === 'dop' ? "1. 24mm anamorphic wide glass\n2. T1.9 shallow depth of field close-ups..." :
                      vaultCategory === 'sound' ? "1. Drop score cues on visual cuts\n2. Sub-bass silence before impact..." :
                      "1. High-contrast chiaroscuro lighting..."
                    }
                    className="w-full flex-1 min-h-[140px] bg-zinc-950 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-100 font-mono focus:outline-none focus:border-amber-400 leading-relaxed shadow-inner"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Asset folders — per-project floating panel */}
      {assetFoldersProj && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`ComfyUI asset folders for ${assetFoldersProj.title}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAssetFoldersProjId(null);
          }}
        >
          <div
            className="sps-asset-folders-popup bg-[var(--sps-bg-elevated)] border border-[var(--sps-border)] shadow-2xl max-w-xl w-full max-h-[min(90vh,720px)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--sps-border)] flex items-center justify-between gap-3 bg-[var(--sps-surface)]">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0 truncate" style={{ fontFamily: 'var(--sps-font-display)' }}>
                  {assetFoldersProj.title}
                </h3>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-zinc-500 m-0 mt-0.5">
                  Asset folders · ASSETS RENDERS PROJECT
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssetFoldersProjId(null)}
                className="sps-chrome-btn p-1.5 shrink-0"
                aria-label="Close asset folders"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-[10px]">
              <p className="m-0 text-[9px] uppercase tracking-widest text-slate-400">Look sheets (Image_1…9)</p>
              {ASSET_ROOT_KEYS.map((key) => (
                <label key={key} className="block text-slate-600 dark:text-zinc-400">
                  {ASSET_ROOT_LABELS[key]}
                  <input
                    type="text"
                    className="sps-input w-full mt-0.5 font-mono text-[11px]"
                    value={String(assetFoldersProj.assetRoots?.[key] || '')}
                    placeholder={`/Volumes/…/ASSETS/${key[0].toUpperCase()}${key.slice(1)}`}
                    onChange={(e) => patchProjectAssetRoot(assetFoldersProj.id, key, e.target.value)}
                  />
                </label>
              ))}
              <p className="m-0 pt-1 text-[9px] uppercase tracking-widest text-slate-400">Renders & project</p>
              {PROJECT_PATH_KEYS.map((key) => (
                <label key={key} className="block text-slate-600 dark:text-zinc-400">
                  {PROJECT_PATH_LABELS[key]}
                  <input
                    type="text"
                    className="sps-input w-full mt-0.5 font-mono text-[11px]"
                    value={String(assetFoldersProj.assetRoots?.[key] || '')}
                    placeholder={
                      key === 'rendersVideo'
                        ? '/Volumes/…/RENDERS/Video'
                        : key === 'rendersImage'
                          ? '/Volumes/…/RENDERS/Image'
                          : key === 'workflows'
                            ? '/Volumes/…/PROJECT/Workflows'
                            : '/Volumes/…/PROJECT/Versions'
                    }
                    onChange={(e) => patchProjectAssetRoot(assetFoldersProj.id, key, e.target.value)}
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 pt-0.5">
                <input
                  type="checkbox"
                  checked={normalizeAssetRoots(assetFoldersProj.assetRoots).versioning}
                  onChange={(e) => patchProjectAssetRoot(assetFoldersProj.id, 'versioning', e.target.checked)}
                />
                Version project saves
                <span className="opacity-70">
                  {normalizeAssetRoots(assetFoldersProj.assetRoots).versioning
                    ? `(next v${String(normalizeAssetRoots(assetFoldersProj.assetRoots).projectVersion).padStart(3, '0')})`
                    : '(off)'}
                </span>
              </label>
              <p className="m-0 text-[9px] text-slate-500 dark:text-zinc-500 leading-snug">
                Pick studio root (e.g. Desktop/SWS PROJECTS). Creates{' '}
                <span className="font-mono">
                  {sanitizeProjectFolderName(assetFoldersProj.title)}/ASSETS · RENDERS · PROJECT
                </span>{' '}
                — not loose folders at the studio root. Save rewrites old root-level paths under the project name.
              </p>
            </div>

            <div className="px-4 py-3 border-t border-[var(--sps-border)] flex flex-wrap gap-2 bg-[var(--sps-surface)]">
              <button
                type="button"
                className="sps-btn text-[10px]"
                onClick={() => handleFillDefaultAssetRoots(assetFoldersProj)}
              >
                Fill under film root
              </button>
              <button
                type="button"
                className="sps-btn sps-btn-primary text-[10px]"
                onClick={() => handleSaveProjectAssetRoots(assetFoldersProj)}
              >
                Save & create folders
              </button>
              <button type="button" className="sps-btn text-[10px] ml-auto" onClick={() => setAssetFoldersProjId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENRE PROFILE CREATOR & EDITOR MODAL */}
      {isGenreEditorOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-amber-500/50 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-slate-100 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {editingGenreKey ? `Edit Genre Profile: ${genreForm.label}` : '+ Add New Custom Genre Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setIsGenreEditorOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveGenreProfile} className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Genre Profile Label / Title (with Emoji):</label>
                  <input
                    type="text"
                    required
                    value={genreForm.label}
                    onChange={(e) => setGenreForm(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g. 🏎️ Action Thriller & High-Speed Car Chase"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Genre Description / Logline:</label>
                  <input
                    type="text"
                    value={genreForm.description}
                    onChange={(e) => setGenreForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Tailored for urban car chases, nitro boosts, drift camera angles & street fights"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-zinc-800 pt-3">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">Preset Matrix Dropdown Values (One Preset Per Line):</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Character Asset Ref Presets:</label>
                    <textarea
                      rows={3}
                      value={genreForm.characterIdAssetRef}
                      onChange={(e) => setGenreForm(prev => ({ ...prev, characterIdAssetRef: e.target.value }))}
                      placeholder="[CharID: @LeadRacer_Alex - Driver in leather jacket]&#10;[CharID: @Challenger_Vince - Rival racer]"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Action & Env Context Presets:</label>
                    <textarea
                      rows={3}
                      value={genreForm.actionEnvContext}
                      onChange={(e) => setGenreForm(prev => ({ ...prev, actionEnvContext: e.target.value }))}
                      placeholder="High-speed highway chase at midnight with nitro sparks&#10;Rain-slick street corner drift past neon signs"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Subject Lighting Tag Presets:</label>
                    <textarea
                      rows={3}
                      value={genreForm.subjectLightingTag}
                      onChange={(e) => setGenreForm(prev => ({ ...prev, subjectLightingTag: e.target.value }))}
                      placeholder="[Lighting: High-Contrast Sodium Headlight Beams]&#10;[Lighting: Strobing Neon Street Light Rim]"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Subject Color Tag Presets:</label>
                    <textarea
                      rows={3}
                      value={genreForm.subjectColorTag}
                      onChange={(e) => setGenreForm(prev => ({ ...prev, subjectColorTag: e.target.value }))}
                      placeholder="[Subject Color: Matte Black & Flame Orange Accent]&#10;[Subject Color: Metallic Silver & Cyan Glow]"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Character Movement Presets:</label>
                    <textarea
                      rows={3}
                      value={genreForm.characterMovement}
                      onChange={(e) => setGenreForm(prev => ({ ...prev, characterMovement: e.target.value }))}
                      placeholder="Shifting gear rapidly and slamming gas pedal down&#10;Leaping over hood of car while unsheathing weapon"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">Character Dialogue Presets:</label>
                    <textarea
                      rows={3}
                      value={genreForm.characterDialogue}
                      onChange={(e) => setGenreForm(prev => ({ ...prev, characterDialogue: e.target.value }))}
                      placeholder='&quot;Fasten your seatbelts... this ends here.&quot;&#10;&quot;Catch me if you can!&quot;'
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGenreEditorOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black font-mono shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" /> Save Genre Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
