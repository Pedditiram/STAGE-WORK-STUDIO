import React, { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import Header from './components/Header';
import SpreadsheetView from './components/SpreadsheetView';
import StudioFormView from './components/StudioFormView';
import DirectorCanvas from './components/DirectorCanvas';
import ScreenplayEditor from './components/ScreenplayEditor';
import TemplateSelector from './components/TemplateSelector';
import PromptCompilerModal from './components/PromptCompilerModal';
import AdminSettingsModal from './components/AdminSettingsModal';
import AIScriptModal from './components/AIScriptModal';
import ProjectConsoleModal from './components/ProjectConsoleModal';
import PhoneOtpGuardModal from './components/PhoneOtpGuardModal';
import HelpUserGuideModal from './components/HelpUserGuideModal';
import LoginModal from './components/LoginModal';
import InvestorDeckModal from './components/InvestorDeckModal';
import ConflictAlertModal from './components/ConflictAlertModal';
import ScriptMergePromptModal from './components/ScriptMergePromptModal';
import AppVersionSelectorModal from './components/AppVersionSelectorModal';
import CharacterBibleModal, { saveStoredCharacterProfiles } from './components/CharacterBibleModal';
import ScriptSynopsisModal from './components/ScriptSynopsisModal';
import CollabChatPanel from './components/CollabChatPanel';
import { subscribeToCollabChat } from './services/collabChat';
import { extractProjectCharactersWithLLM } from './services/aiScriptParser';
import { syncCanvasVaultToCloud, getStoredCanvasVaultImages } from './services/canvasVault';
import { saveProjectToVault, loadProjectsFromVault } from './services/projectDiskVault';
import { autoRestoreAppSettingsFromVault } from './services/appSettingsDiskVault';
import { subscribeToCloudRoom, publishToCloudRoom, enableCloudCollaborationMode } from './services/cloudSync';
import { 
  syncProjectLibraryToCloud, 
  syncCollaboratorsToCloud, 
  subscribeToProjectLibraryUpdates,
  subscribeToCollaboratorUpdates,
  fetchProjectLibraryFromCloud,
  fetchCollaboratorsFromCloud,
  broadcastActiveSlotEditing,
  subscribeToActiveEditingSlots
} from './services/dbService';
import { SEEDANCE_SLOTS, getSlotsForGenre, detectScriptGenre, GENRE_PRESET_PROFILES, getMergedGenreProfiles } from './constants/seedancePresets';
import { safeLocalStorageSetItem } from './utils/safeStorage';
import {
  getCurrentUserEmail,
  isGuestSession,
  isStudioAdmin,
  canAccessProject,
  canCreateOrDeleteProjects,
  canEditProjects,
  filterAccessibleProjects,
  markCollaboratorSession,
  purgeWeakAdminCredentials
} from './utils/projectPermissions';
import { Check, Copy, RefreshCw, Play, FastForward, Code, Image as ImageIcon } from 'lucide-react';

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

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  const [projectTitle, setProjectTitle] = useState(() => {
    if (typeof window !== 'undefined') {
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
      return localStorage.getItem('sps_current_aspect_ratio') || "2.39:1 Anamorphic";
    }
    return "2.39:1 Anamorphic";
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

  const handleSetColorTheme = (theme) => {
    setColorTheme(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_color_theme', theme);
    }
  };

  // Persistent shots state from localStorage with safety bounds check (max 200 shots)
  const [shots, setShots] = useState(() => {
    if (typeof window !== 'undefined') {
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
      if (typeof window !== 'undefined') {
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

  // Auto-extract Character Bibles ONCE on app mount if vault is empty
  useEffect(() => {
    if (typeof window !== 'undefined' && shots && shots.length > 0) {
      try {
        const stored = localStorage.getItem('sps_character_bible_vault');
        if (!stored || JSON.parse(stored).length === 0) {
          extractProjectCharactersWithLLM(shots, projectTitle).then(extracted => {
            if (Array.isArray(extracted) && extracted.length > 0) {
              saveStoredCharacterProfiles(extracted);
            }
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }, []);

  const handleSetPresetProfile = (profileKey) => {
    setPresetProfile(profileKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_preset_profile', profileKey);
    }
  };

  const activeSlots = getSlotsForGenre(presetProfile);

  // Default active view tab: 'canvas' | 'spreadsheet' | 'form'
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedCanvas = localStorage.getItem('sps_enable_canvas_tab');
      const canShowCanvas = savedCanvas === 'true';
      const saved = localStorage.getItem('sps_active_view');
      if (saved && (saved === 'spreadsheet' || saved === 'form' || saved === 'screenplay' || saved === 'templates' || (saved === 'canvas' && canShowCanvas))) {
        return saved;
      }
      return 'spreadsheet';
    }
    return 'spreadsheet';
  });

  // Track if full expanded craft editor view is active (to hide top header bar)
  const [isFullEditorOpen, setIsFullEditorOpen] = useState(false);

  // Enforce canvas tab redirection if disabled
  useEffect(() => {
    if (!showCanvasTab && activeView === 'canvas') {
      setActiveView('spreadsheet');
    }
  }, [showCanvasTab, activeView]);

  const [activeShotIndex, setActiveShotIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_active_shot_index');
      const idx = parseInt(saved, 10);
      return !isNaN(idx) && idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [isCompilerOpen, setIsCompilerOpen] = useState(false);
  const [isProjectConsoleOpen, setIsProjectConsoleOpen] = useState(false);
  const [projectConsoleInitialTab, setProjectConsoleInitialTab] = useState('library');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedSeeDream, setCopiedSeeDream] = useState(false);
  const [copiedFirstFrame, setCopiedFirstFrame] = useState(false);
  const [copiedLastFrame, setCopiedLastFrame] = useState(false);

  // App-Wide 100% Native Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Native Browser Fullscreen Bypass to hide Safari URL bar & tabs completely
  const toggleFullscreenMode = async (enable) => {
    const targetState = typeof enable === 'boolean' ? enable : !isFullscreen;
    setIsFullscreen(targetState);

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

  // Director Canvas Keyframe Mode Sync ('first_frame' | 'last_frame' | 'transition')
  const [canvasKeyframeMode, setCanvasKeyframeMode] = useState('first_frame');

  // =========================================================================
  // UNIVERSAL UNDO / REDO HISTORY ENGINE STATE & HANDLERS
  // =========================================================================
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const updateShotsWithHistory = (newShots) => {
    if (!canEditProjects()) {
      alert('🔒 READ-ONLY ACCESS:\nYour access level is Viewer. You can open allotted projects but cannot edit them. Ask the studio Owner to upgrade you to Editor.');
      return false;
    }
    if (!canAccessProject(projectTitle) && !canCreateOrDeleteProjects()) {
      alert('🔒 ACCESS RESTRICTED:\nThis project is not allotted to your account.');
      return false;
    }
    setHistoryStack(prev => [...prev.slice(-50), shots]);
    setRedoStack([]);
    setShots(newShots);
    return true;
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
        if (isGuestSession()) {
          alert(
            '🔒 GUEST ACCESS\n\nUnauthenticated visitors may only view the Investor Deck & Studio Showcase.\n\nSign in to use Projects Console, or request access from pedditiram@gmail.com.'
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

      // Esc -> Normal View
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
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStack, redoStack, shots, isFullscreen]);

  // Cloud & Admin & AI State
  const [roomId, setRoomId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('room') || 'SPS-CLOUD-8821';
    }
    return 'SPS-CLOUD-8821';
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

  const [isCharacterBibleOpen, setIsCharacterBibleOpen] = useState(false);
  const [characterBibleTab, setCharacterBibleTab] = useState('roster'); // 'roster' | 'script_story'
  const [isScriptSynopsisModalOpen, setIsScriptSynopsisModalOpen] = useState(false);

  const handleOpenCharactersModal = () => {
    setCharacterBibleTab('roster');
    setIsCharacterBibleOpen(true);
  };

  const handleOpenStoryModal = () => {
    setIsScriptSynopsisModalOpen(true);
  };
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminModalTab, setAdminModalTab] = useState('all');
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isInvestorDeckOpen, setIsInvestorDeckOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  // Always start logged-out in UI; LoginModal after splash confirms identity
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      purgeWeakAdminCredentials();
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
        markCollaboratorSession('pedditiram@gmail.com');
      }
    }
    setIsAdminLoggedIn(Boolean(val));
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_is_admin_logged_in', val ? 'true' : 'false');
    }
  };

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
          '🔒 GUEST ACCESS\n\nSettings require a signed-in collaborator or studio owner.\n\nOpen the Investor Deck, request access, or log in.'
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
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isCollabChatOpen, setIsCollabChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Local vault may keep a project-scoped key; cloud collab always uses invite roomId only.
  const effectiveRoomId = roomId || 'SPS-CLOUD-8821';
  const isInitialMount = React.useRef(true);
  const lastSyncedHash = React.useRef('');
  const prevAutoSavedShotsRef = React.useRef('');
  const isReceivingCloudUpdate = React.useRef(false);
  const electronMenuRef = React.useRef({});

  // Electron native menu event listeners (macOS Menu Bar integration)
  useEffect(() => {
    const handlers = {
      'sps_save_project': () => electronMenuRef.current.saveProject?.(),
      'sps_export_project': () => electronMenuRef.current.exportProject?.(),
      'sps_import_project': () => {
        if (!canCreateOrDeleteProjects()) {
          alert('🔒 ACCESS RESTRICTED:\nOnly the studio Owner can import projects.');
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
          alert('🔒 ACCESS RESTRICTED:\nOnly the studio Owner can create projects. Open Project Console to edit an allotted project.');
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
      // 1. Auto-Restore App Settings & API Keys from persistent IndexedDB vault
      await autoRestoreAppSettingsFromVault();

      // 2. Check if current shots or projects are missing/default, and restore from Vault
      const vaultProjects = await loadProjectsFromVault();
      if (Array.isArray(vaultProjects) && vaultProjects.length > 0) {
        const savedLib = localStorage.getItem('sps_project_library');
        let currentLib = [];
        try {
          currentLib = savedLib ? JSON.parse(savedLib) : [];
        } catch (e) {}

        // Ensure project library in localStorage has all vault projects
        const mergedProjects = [...currentLib];
        let hasNewVaultProject = false;

        vaultProjects.forEach(vProj => {
          if (vProj && vProj.id) {
            const idx = mergedProjects.findIndex(p => p.id === vProj.id || p.title === vProj.title);
            if (idx === -1) {
              mergedProjects.push(vProj);
              hasNewVaultProject = true;
            } else if (Array.isArray(vProj.shots) && vProj.shots.length > (mergedProjects[idx].shots?.length || 0)) {
              mergedProjects[idx] = vProj;
              hasNewVaultProject = true;
            }
          }
        });

        if (hasNewVaultProject || currentLib.length === 0) {
          safeLocalStorageSetItem('sps_project_library', JSON.stringify(mergedProjects));
          window.dispatchEvent(new Event('sps_projects_updated'));
        }

        // Auto-load most recently saved project if current shots are empty or default
        const activeProj = mergedProjects[0] || vaultProjects[0];
        const savedShotsStr = localStorage.getItem('sps_current_shots');
        let localShots = [];
        if (savedShotsStr) {
          try { localShots = JSON.parse(savedShotsStr); } catch (e) {}
        }

        // Prefer an accessible project for the current user (collaborators: allotted only)
        const email = getCurrentUserEmail();
        const visible = filterAccessibleProjects(mergedProjects, email);
        const savedTitle = localStorage.getItem('sps_current_project_title') || '';
        const preferred =
          visible.find((p) => String(p?.title || '').toLowerCase() === String(savedTitle).toLowerCase()) ||
          visible[0] ||
          (isStudioAdmin(email) ? activeProj : null);

        if ((!localShots || localShots.length === 0) && preferred && Array.isArray(preferred.shots) && preferred.shots.length > 0) {
          setShots(preferred.shots);
          setProjectTitle(preferred.title || 'STAGE PRODUCTION STUDIO');
          if (preferred.targetModel) setTargetModel(preferred.targetModel);
          if (preferred.aspectRatio) setAspectRatio(preferred.aspectRatio);
          safeLocalStorageSetItem('sps_current_shots', JSON.stringify(preferred.shots));
          safeLocalStorageSetItem('sps_current_project_title', preferred.title || 'STAGE PRODUCTION STUDIO');
        } else if (email && !isStudioAdmin(email)) {
          enforceAccessibleActiveProject(savedTitle);
        }
      }

      // 3. Do NOT auto-login / skip LoginModal when a remembered email exists.
      // Splash onFinish always opens LoginModal so the user can pick Gmail / Admin / collaborator.
      // Remembered email stays in localStorage for LoginModal prefilling only.
      setIsAdminLoggedIn(false);
      localStorage.setItem('sps_is_admin_logged_in', 'false');
    };

    autoRestoreAppVault();
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

  // Local Storage & Library Persistence (Guarantees sps_project_library is always in sync with active project)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeLocalStorageSetItem('sps_current_shots', JSON.stringify(shots));
    safeLocalStorageSetItem('sps_current_project_title', projectTitle);
    safeLocalStorageSetItem('sps_current_target_model', targetModel);
    safeLocalStorageSetItem('sps_current_aspect_ratio', aspectRatio);
    safeLocalStorageSetItem('sps_active_view', activeView);
    safeLocalStorageSetItem('sps_active_shot_index', String(activeShotIndex));

    if (projectTitle && Array.isArray(shots) && shots.length > 0) {
      try {
        // Collaborators may only update allotted projects; never create new library entries
        if (!canAccessProject(projectTitle)) return;
        const savedLibStr = localStorage.getItem('sps_project_library');
        let library = savedLibStr ? JSON.parse(savedLibStr) : [];
        if (!Array.isArray(library)) library = [];

        const existingIdx = library.findIndex(p => p.title === projectTitle);
        if (existingIdx === -1 && !canCreateOrDeleteProjects()) return;

        const updatedProjectData = {
          id: existingIdx !== -1 ? library[existingIdx].id : `proj_${Date.now()}`,
          title: projectTitle,
          description: `Cinema Production Studio Project with ${shots.length} shots`,
          targetModel: targetModel || 'SPS Direct Cinema 2.0',
          aspectRatio: aspectRatio || '2.39:1 Anamorphic',
          roomId: effectiveRoomId || 'SPS-CLOUD-8821',
          lastModified: new Date().toLocaleDateString(),
          shots: shots
        };

        if (existingIdx !== -1) {
          library[existingIdx] = { ...library[existingIdx], ...updatedProjectData };
        } else {
          library.unshift(updatedProjectData);
        }

        safeLocalStorageSetItem('sps_project_library', JSON.stringify(library));
      } catch (e) {}
    }
  }, [shots, projectTitle, targetModel, aspectRatio, activeView, activeShotIndex, effectiveRoomId]);

  // Hydrate projects & collaborators from Vercel cloud (source of truth) on every open.
  // Local disk/localStorage RECEIVES from cloud; do not echo-push stale local back.
  useEffect(() => {
    let cancelled = false;

    fetchProjectLibraryFromCloud().then((projs) => {
      if (cancelled) return;
      let updatedProjs = Array.isArray(projs)
        ? projs.filter((p) => p && p.title && String(p.title).trim().toUpperCase() !== 'STAGE PRODUCTION STUDIO')
        : [];

      // Self-heal active project into library for UI only — do NOT push this back to cloud here
      const activeTitle =
        projectTitle && typeof projectTitle === 'string' && projectTitle.toUpperCase() !== 'STAGE PRODUCTION STUDIO'
          ? projectTitle
          : '';
      if (activeTitle && shots && shots.length > 0) {
        const exists = updatedProjs.some((p) => p.title === activeTitle);
        if (!exists) {
          updatedProjs = [
            {
              id: `proj_${Date.now()}`,
              title: activeTitle,
              description: `Cinema Production Studio Project with ${shots.length} shots`,
              targetModel: targetModel || 'SPS Direct Cinema 2.0',
              aspectRatio: aspectRatio || '2.39:1 Anamorphic',
              roomId: effectiveRoomId || 'SPS-CLOUD-8821',
              lastModified: new Date().toLocaleDateString(),
              shots: shots,
            },
            ...updatedProjs,
          ];
        }
      }

      safeLocalStorageSetItem('sps_project_library', JSON.stringify(updatedProjs));
      window.dispatchEvent(new Event('sps_projects_updated'));

      const activeProj = updatedProjs.find((p) => p.title === projectTitle || p.id === 'proj_default');
      if (activeProj && Array.isArray(activeProj.shots) && activeProj.shots.length > 0) {
        // Cloud wins on reload — apply cloud shots (local must RECEIVE from Vercel)
        const targetShots = activeProj.shots;
        const cloudHash = JSON.stringify({
          shots: targetShots,
          projectTitle: activeProj.title || projectTitle,
          targetModel: activeProj.targetModel || targetModel,
          aspectRatio: activeProj.aspectRatio || aspectRatio,
        });
        lastSyncedHash.current = cloudHash;
        isReceivingCloudUpdate.current = true;
        setShots(targetShots);
        if (activeProj.targetModel) setTargetModel(activeProj.targetModel);
        if (activeProj.aspectRatio) setAspectRatio(activeProj.aspectRatio);
        localStorage.setItem('sps_current_shots', JSON.stringify(targetShots));
        setTimeout(() => {
          isReceivingCloudUpdate.current = false;
        }, 400);
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
    if (!shots || shots.length === 0 || !projectTitle) return;

    const currentShotsHash = JSON.stringify({ projectTitle, targetModel, aspectRatio, shots });
    if (currentShotsHash === prevAutoSavedShotsRef.current) return; // Prevent duplicate infinite re-renders!
    
    prevAutoSavedShotsRef.current = currentShotsHash;

    const safeTitle = (projectTitle == null ? '' : String(projectTitle));
    const activeProj = {
      id: `proj_${safeTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      title: projectTitle,
      description: `Cinema Production Studio Project with ${shots.length} shots`,
      targetModel: targetModel || 'SPS Direct Cinema 2.0',
      aspectRatio: aspectRatio || '2.39:1 Anamorphic',
      roomId: effectiveRoomId,
      lastModified: new Date().toLocaleString(),
      shots: shots
    };
    saveProjectToVault(activeProj);
  }, [shots, projectTitle, targetModel, aspectRatio, effectiveRoomId]);

  // Cloud room sync always on — Local badge is storage preference; Vercel is SoT
  useEffect(() => {
    if (!effectiveRoomId) return;
    const unsubscribe = subscribeToCloudRoom(effectiveRoomId, (cloudData) => {
      if (cloudData && cloudData.shots && Array.isArray(cloudData.shots)) {
        const nextTitle = cloudData.projectTitle || projectTitle;
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
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [effectiveRoomId]);

  // -------------------------------------------------------------
  // REAL-TIME SLOT PRESENCE BROADCASTING & CONFLICT DETECTION
  // -------------------------------------------------------------
  const shotsRef = React.useRef(shots);
  const activeShotIndexRef = React.useRef(activeShotIndex);
  const projectTitleRef = React.useRef(projectTitle);

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
      }
    };

    publishPresence(false);
    const heartbeat = setInterval(() => publishPresence(false), 8000);
    return () => clearInterval(heartbeat);
  }, [activeShotIndex, projectTitle, effectiveRoomId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !effectiveRoomId) {
      setActiveRemoteUsers([]);
      return;
    }
    const currentUserEmail = localStorage.getItem('sps_authorized_user_email') || 'unauthenticated';
    const unsubPresence = subscribeToActiveEditingSlots(currentUserEmail, (otherActiveUsers) => {
      const sameProjectUsers = (otherActiveUsers || []).filter((u) => {
        const sameProject = !u.projectTitle || u.projectTitle === projectTitleRef.current;
        const sameRoom = !u.roomId || !effectiveRoomId || u.roomId === effectiveRoomId;
        return sameProject && sameRoom;
      });
      setActiveRemoteUsers(sameProjectUsers);

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
          setActiveConflict(matchingConflict);
          setIsConflictModalOpen(true);
        }
      }
    });
    return () => {
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
  // AUTOMATIC 30-MINUTE PROJECT BACKUP & VERSION SNAPSHOT ENGINE
  // -------------------------------------------------------------
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
        const targetIdx = library.findIndex(p => p.title === currentTitle || p.id === 'proj_default');

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
    if (isReceivingCloudUpdate.current) return;
    // Viewers / non-allotted users must never publish room or library mutations
    if (!canEditProjects()) return;
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
      localStorage.setItem('sps_current_shots', JSON.stringify(newShots));
      localStorage.setItem('sps_current_project_title', newTitle);

      try {
        const savedLibStr = localStorage.getItem('sps_project_library');
        let library = savedLibStr ? JSON.parse(savedLibStr) : [];
        if (!Array.isArray(library)) library = [];

        const existingIdx = library.findIndex(p => p.title === newTitle);
        // Collaborators cannot create new library titles via sync side-effect
        if (existingIdx === -1 && !canCreateOrDeleteProjects()) {
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

          safeLocalStorageSetItem('sps_project_library', JSON.stringify(library));
          // Always mirror library to Vercel (Local badge does not disable cloud SoT)
          if (library.length > 0) syncProjectLibraryToCloud(library);
        }
      } catch (e) {}
    }

    // Always publish room shots to Vercel — Local mode still receives/sends via getNativeSyncUrl
    setIsCloudSyncing(true);
    publishToCloudRoom(roomId || 'SPS-CLOUD-8821', {
      projectTitle: newTitle,
      targetModel: newModel,
      aspectRatio: newRatio,
      shots: newShots,
      projectGeneratedImages: newImages,
      lastUpdated: new Date().toISOString(),
      ...updatedState
    });
    setTimeout(() => setIsCloudSyncing(false), 400);
  };

  const [isProjectSavedToast, setIsProjectSavedToast] = useState(false);

  const handleSaveProjectToApp = async () => {
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
      
      const existingIdx = library.findIndex(p => p.title === projectTitle || p.id === 'proj_default');
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
          const activeProj = latestCloudLib.find(p => p.title === projectTitle || p.id === 'proj_default');
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

  const handleEmbedImageToProject = (shotKey, imageUrl) => {
    setProjectGeneratedImages(prev => {
      const updated = { ...prev, [shotKey]: imageUrl };
      try {
        localStorage.setItem('sps_generated_images_map', JSON.stringify(updated));
      } catch (e) {}

      // Keys are `${sceneShotId}_${keyframeMode}` and sceneShotId itself contains underscores
      // e.g. "SC01_SH01_first_frame" — parse mode from the known suffixes, not split('_')[0]
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

      const shotIndex = shots.findIndex((s, idx) =>
        (s.sceneShotId && s.sceneShotId === shotId) ||
        (`SH_${idx + 1}` === shotId) ||
        (`SH_${idx + 1}` === shotId.replace(/^SH_/, 'SH_'))
      );
      
      let updatedShots = shots;
      if (shotIndex !== -1) {
        updatedShots = [...shots];
        updatedShots[shotIndex] = {
          ...updatedShots[shotIndex],
          embeddedImages: {
            ...(updatedShots[shotIndex].embeddedImages || {}),
            [keyframeMode]: imageUrl
          }
        };
        setShots(updatedShots);
        try {
          localStorage.setItem('sps_current_shots', JSON.stringify(updatedShots));
        } catch (e) {}
      }
      
      syncToCloud({ shots: updatedShots, projectGeneratedImages: updated });
      return updated;
    });
  };



  const handleUpdateShot = (index, updatedShotOrKey, value) => {
    const newShots = [...shots];
    if (typeof updatedShotOrKey === 'string') {
      newShots[index] = { ...newShots[index], [updatedShotOrKey]: value };
    } else {
      newShots[index] = updatedShotOrKey;
    }
    if (updateShotsWithHistory(newShots)) syncToCloud({ shots: newShots });
  };

  const handleAddShot = () => {
    const nextShotNum = shots.length + 1;
    const newShot = {
      sceneShotId: `SC01_SH${nextShotNum < 10 ? '0' + nextShotNum : nextShotNum}`,
      shotComposition: "Medium Shot (MS)",
      cameraMotionTag: "[Camera: Static Anchor]",
      subjectLightingTag: "[Lighting: Rembrandt 3-Point Classic]",
      subjectColorTag: "[Subject Color: Teal & Orange Cinema Palette]",
      backgroundLightingTag: "[BG Lighting: Mood Soft Ambient Falloff]",
      backgroundColorTag: "[BG Color: Deep Midnight Blue & Indigo]",
      characterIdAssetRef: "[CharID: @LeadSinger_Aria - Vocalist, leather jacket]",
      coArtistInteraction: "[Co-Artist: Secondary dancer mirroring lead performer's choreography in background]",
      actionEnvContext: "Cinematic interior concert venue with soft volumetric light falloff.",
      characterExpression: "Stoic and determined, slight twitch of the jaw",
      characterPlacement: "Foreground center stage, co-artists positioned in midground left & right",
      characterDialogue: '"Standing by for guitar drop."',
      characterMovement: "Turning head slowly to look over shoulder towards camera",
      characterEyeLooks: "[Eye Look: Direct Eye Contact with Camera Lens]"
    };
    const newShots = [...shots, newShot];
    if (!updateShotsWithHistory(newShots)) return;
    setActiveShotIndex(shots.length);
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

  const handleRestoreShot = (index) => {
    const newShots = [...shots];
    if (newShots[index]) {
      const { isArchived, archivedAt, ...rest } = newShots[index];
      newShots[index] = rest;
      if (updateShotsWithHistory(newShots)) syncToCloud({ shots: newShots });
    }
  };

  const handleToggleMuteShot = (index) => {
    const newShots = [...shots];
    if (newShots[index]) {
      newShots[index] = {
        ...newShots[index],
        isMuted: !newShots[index].isMuted
      };
      if (updateShotsWithHistory(newShots)) syncToCloud({ shots: newShots });
    }
  };

  const handleDeleteShot = handleArchiveShot;

  const handleCloneShot = (index) => {
    const cloned = { ...shots[index] };
    const newShots = [...shots];
    newShots.splice(index + 1, 0, cloned);
    if (!updateShotsWithHistory(newShots)) return;
    setActiveShotIndex(index + 1);
    syncToCloud({ shots: newShots });
  };
  const handleDuplicateShot = handleCloneShot;

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
      alert('🔒 READ-ONLY ACCESS:\nViewers cannot apply AI shots. Ask the studio Owner to upgrade you to Editor.');
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
        alert('🔒 ACCESS RESTRICTED:\nYou can only edit projects allotted to your account. Ask the studio Owner to allot a project or create a new one.');
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

    setShots(finalShots);
    setProjectTitle(nextTitle);
    setActiveShotIndex(0);
    setActiveView("spreadsheet");

    if (typeof window !== 'undefined') {
      try {
        const savedLibStr = localStorage.getItem('sps_project_library');
        let library = savedLibStr ? JSON.parse(savedLibStr) : [];
        if (!Array.isArray(library)) library = [];

        const existingIdx = library.findIndex(p => p.title === nextTitle);
        const existingProj = existingIdx !== -1 ? library[existingIdx] : {};

        const newProj = {
          ...existingProj,
          id: existingIdx !== -1 ? library[existingIdx].id : `proj_${Date.now()}`,
          title: nextTitle,
          description: `Cinema Production Studio Project with ${finalShots.length} shots`,
          targetModel: targetModel || 'SPS Direct Cinema 2.0',
          aspectRatio: aspectRatio || '2.39:1 Anamorphic',
          roomId: roomId || 'SPS-CLOUD-8821',
          lastModified: new Date().toLocaleDateString(),
          shots: finalShots,
          directorPsychology: extraElements?.directorPsychology || existingProj.directorPsychology,
          dopVision: extraElements?.dopVision || existingProj.dopVision,
          soundVision: extraElements?.soundVision || existingProj.soundVision,
          characterProfiles: extraElements?.characters || existingProj.characterProfiles,
          scriptGenre: extraElements?.detectedGenre || existingProj.scriptGenre
        };

        if (existingIdx !== -1) {
          library[existingIdx] = newProj;
        } else {
          library.unshift(newProj);
        }

        localStorage.setItem('sps_project_library', JSON.stringify(library));
        window.dispatchEvent(new Event('sps_projects_updated'));
        syncProjectLibraryToCloud(library);
      } catch (e) {}
    }

    syncToCloud({ shots: finalShots, projectTitle: nextTitle });
  };

  const handleApplyAIShots = (aiShots, newTitle, extraElements = null) => {
    const titleToApply = newTitle || projectTitle;

    if (!Array.isArray(aiShots) || aiShots.length === 0) {
      alert('Parse produced no shots. Existing project was left unchanged.');
      return;
    }

    // Detect if current shots are just default sample demo shots
    const isSampleDemoShots = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return true;
      if (arr.length <= 2 && arr[0]?.sceneShotId === 'SC01_SH01') return true;
      return false;
    };

    let targetExistingShots = (shots && shots.length > 0) ? shots : [];

    if (typeof window !== 'undefined') {
      try {
        const savedLibStr = localStorage.getItem('sps_project_library');
        const library = savedLibStr ? JSON.parse(savedLibStr) : [];
        const found = library.find(p => p.title === titleToApply);
        if (found && Array.isArray(found.shots) && found.shots.length > 0) {
          targetExistingShots = found.shots;
        }
      } catch (e) {}
    }

    // Only prompt for merge if existing shots are real custom user shots (not sample demo shots)
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

    executeApplyAIShots(aiShots, titleToApply, 'overwrite', [], extraElements);
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
    downloadAnchor.setAttribute("download", `${projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_sps_project.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importJSONProject = (e) => {
    if (!canCreateOrDeleteProjects()) {
      alert('🔒 ACCESS RESTRICTED:\nOnly the studio Owner can import projects.');
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

  // Active shot compiled prompt strings
  const currentShotObj = shots[activeShotIndex] || shots[0] || {};
  const activeShotPromptText = SEEDANCE_SLOTS.map(slot => currentShotObj[slot?.key]).filter(Boolean).join(' | ');

  const safeStr = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    return String(val).replace(/\[|\]/g, '');
  };

  const firstFrameText = `masterpiece 8k render, ${currentShotObj.shotComposition || 'Medium Shot'}, ${safeStr(currentShotObj.characterIdAssetRef, '@LeadArtist')} at initial starting stance, ${currentShotObj.actionEnvContext || ''}, ${safeStr(currentShotObj.subjectLightingTag)}, static initial keyframe, 8k`;

  const lastFrameText = `masterpiece 8k render, ${currentShotObj.shotComposition || 'Medium Shot'}, ${safeStr(currentShotObj.characterIdAssetRef, '@LeadArtist')} executing ${currentShotObj.characterMovement || 'final climax pose'}, expression: ${currentShotObj.characterExpression || 'intense focus'}, ${safeStr(currentShotObj.coArtistInteraction)}, ending keyframe, 8k`;

  const activeShotSeeDreamText = `masterpiece 8k render, ${currentShotObj.shotComposition || 'Medium Shot'}, ${safeStr(currentShotObj.characterIdAssetRef)}, ${currentShotObj.actionEnvContext || ''}, ${safeStr(currentShotObj.subjectLightingTag)}, ${safeStr(currentShotObj.subjectColorTag)}, expression: ${currentShotObj.characterExpression || 'focused'}, highly detailed 8k`;

  const copyActivePrompt = () => {
    navigator.clipboard.writeText(activeShotPromptText).catch(() => {});
    setCanvasKeyframeMode('transition');
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const copyFirstFrame = () => {
    navigator.clipboard.writeText(firstFrameText).catch(() => {});
    setCanvasKeyframeMode('first_frame');
    setCopiedFirstFrame(true);
    setTimeout(() => setCopiedFirstFrame(false), 2000);
  };

  const copyLastFrame = () => {
    navigator.clipboard.writeText(lastFrameText).catch(() => {});
    setCanvasKeyframeMode('last_frame');
    setCopiedLastFrame(true);
    setTimeout(() => setCopiedLastFrame(false), 2000);
  };

  const copyActiveSeeDreamPrompt = () => {
    navigator.clipboard.writeText(activeShotSeeDreamText).catch(() => {});
    setCopiedSeeDream(true);
    setTimeout(() => setCopiedSeeDream(false), 2000);
  };

  electronMenuRef.current = {
    saveProject: handleSaveProjectToApp,
    exportProject: exportJSONProject,
    importProject: importJSONProject,
    openNewProject: () => {
      if (isGuestSession()) {
        alert(
          '🔒 GUEST ACCESS\n\nUnauthenticated visitors may only view the Investor Deck & Studio Showcase.\n\nSign in to use Projects Console, or request access from pedditiram@gmail.com.'
        );
        setIsInvestorDeckOpen(true);
        return;
      }
      setIsProjectConsoleOpen(true);
    },
  };

  return (
    <div className={`h-screen w-full flex flex-col font-sans selection:bg-cyan-400/40 selection:text-white overflow-hidden transition-colors duration-300 ${
      colorTheme === 'paper' 
        ? 'bg-[#F4F7FB] text-[#0F172A] theme-paper' 
        : 'bg-transparent text-zinc-100 theme-dark'
    }`}>
      {/* Cinematic Studio Splash Launch Screen */}
      {showSplash && (
        <SplashScreen
          onFinish={() => {
            setShowSplash(false);
            setIsProjectConsoleOpen(false);
            setIsLoginModalOpen(true);
          }}
        />
      )}
      {/* Top Header Bar (Always visible in normal view, hidden only in native OS full screen) */}
      {!isFullscreen && (
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
          onOpenCompiler={() => setIsCompilerOpen(true)}
          onOpenCloudModal={() => { setAdminModalTab('cloud_collab'); setIsAdminModalOpen(true); }}
          onOpenAdminModal={() => { setAdminModalTab('all'); setIsAdminModalOpen(true); }}
          onOpenAIModal={() => setIsAIModalOpen(true)}
          onOpenProjectConsole={() => {
            if (isGuestSession()) {
              alert(
                '🔒 GUEST ACCESS\n\nUnauthenticated visitors may only view the Investor Deck & Studio Showcase.\n\nSign in to use Projects Console, or request access from pedditiram@gmail.com.'
              );
              setIsInvestorDeckOpen(true);
              return;
            }
            setProjectConsoleInitialTab('library');
            setIsProjectConsoleOpen(true);
          }}
          onOpenDirectorPsychology={() => {
            if (isGuestSession()) {
              alert(
                '🔒 GUEST ACCESS\n\nUnauthenticated visitors may only view the Investor Deck & Studio Showcase.\n\nSign in to use Director Psychology, or request access from pedditiram@gmail.com.'
              );
              setIsInvestorDeckOpen(true);
              return;
            }
            setProjectConsoleInitialTab('director_psychology');
            setIsProjectConsoleOpen(true);
          }}
          onOpenCharacterBible={handleOpenCharactersModal}
          onOpenStory={handleOpenStoryModal}
          onOpenScriptSynopsisModal={() => setIsScriptSynopsisModalOpen(true)}
          onOpenHelpModal={() => setIsHelpModalOpen(true)}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onOpenInvestorDeck={() => setIsInvestorDeckOpen(true)}
          appVersionMode={appVersionMode}
          onOpenAppVersionModal={() => setIsAppVersionModalOpen(true)}
          roomId={roomId}
          collaboratorCount={Math.max(collaborators.length, activeRemoteUsers.length + 1)}
          activeRemoteUsers={activeRemoteUsers}
          isAdminLoggedIn={isAdminLoggedIn}
          showCanvasTab={showCanvasTab}
          onSaveProject={handleSaveProjectToApp}
          isProjectSavedToast={isProjectSavedToast}
          isCloudSyncing={isCloudSyncing}
          shotCount={shots.length}
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
      )}



      {/* Main Studio Body View */}
      <main className="flex-1 w-full p-1.5 sm:p-3 flex flex-col gap-2 overflow-hidden min-h-0">
        
        {/* DYNAMICALLY SEGREGATED WORKSPACE VIEW CONTAINER */}
        <div key={activeView} className="flex-1 w-full min-h-0 overflow-hidden flex flex-col sps-view-enter">
          
          {/* TAB 1: DIRECTOR CANVAS VIEW */}
          {showCanvasTab && activeView === 'canvas' && (
            <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-hidden">
              
              {/* LEFT 7 COLUMNS: Interactive Director Canvas */}
              <div className="lg:col-span-7 flex flex-col gap-3 overflow-y-auto pr-1 h-full">
                <DirectorCanvas 
                  shot={currentShotObj} 
                  aspectRatio={aspectRatio}
                  shots={shots}
                  activeShotIndex={activeShotIndex}
                  setActiveShotIndex={setActiveShotIndex}
                  keyframeMode={canvasKeyframeMode}
                  setKeyframeMode={setCanvasKeyframeMode}
                  projectGeneratedImages={projectGeneratedImages}
                  projectTitle={projectTitle}
                  onEmbedImage={handleEmbedImageToProject}
                  onOpenAdminSettings={(tab) => {
                    setAdminModalTab(tab || 'all');
                    setIsAdminModalOpen(true);
                  }}
                />
              </div>

              {/* RIGHT 5 COLUMNS: Live Prompt View Cards */}
              <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto pr-1 h-full">
                
                {/* FIRST FRAME PROMPT CARD */}
                <div 
                  onClick={() => setCanvasKeyframeMode('first_frame')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    canvasKeyframeMode === 'first_frame'
                      ? 'bg-cyan-500/10 border-cyan-400/50 shadow-lg shadow-cyan-950/20'
                      : colorTheme === 'paper'
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-cyan-400" />
                      First Frame · Frame 0
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyFirstFrame(); }}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-300 font-semibold text-[11px] flex items-center gap-1 shadow"
                    >
                      {copiedFirstFrame ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedFirstFrame ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className={`text-xs leading-relaxed p-3 rounded-xl border select-all ${
                    colorTheme === 'paper'
                      ? 'text-slate-700 bg-slate-50 border-slate-200'
                      : 'text-zinc-300 bg-black/30 border-white/5'
                  }`}>
                    {firstFrameText}
                  </p>
                </div>

                {/* LAST FRAME PROMPT CARD */}
                <div 
                  onClick={() => setCanvasKeyframeMode('last_frame')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    canvasKeyframeMode === 'last_frame'
                      ? 'bg-amber-500/10 border-amber-400/50 shadow-lg shadow-amber-950/20'
                      : colorTheme === 'paper'
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <FastForward className="w-3.5 h-3.5 text-amber-400" />
                      Last Frame · Frame N
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyLastFrame(); }}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-300 font-semibold text-[11px] flex items-center gap-1 shadow"
                    >
                      {copiedLastFrame ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedLastFrame ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className={`text-xs leading-relaxed p-3 rounded-xl border select-all ${
                    colorTheme === 'paper'
                      ? 'text-slate-700 bg-slate-50 border-slate-200'
                      : 'text-zinc-300 bg-black/30 border-white/5'
                  }`}>
                    {lastFrameText}
                  </p>
                </div>

                {/* STAGE PRODUCTION VIDEO PROMPT CARD */}
                <div 
                  onClick={() => setCanvasKeyframeMode('transition')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    canvasKeyframeMode === 'transition'
                      ? 'bg-pink-500/10 border-pink-400/50 shadow-lg shadow-pink-950/20'
                      : colorTheme === 'paper'
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-pink-300 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-pink-400" />
                      Video prompt · Vector
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyActivePrompt(); }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-400 text-zinc-950 hover:bg-cyan-300 font-semibold text-[11px] flex items-center gap-1 shadow"
                    >
                      {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedPrompt ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className={`text-xs leading-relaxed p-3 rounded-xl border select-all max-h-28 overflow-y-auto ${
                    colorTheme === 'paper'
                      ? 'text-slate-700 bg-slate-50 border-slate-200'
                      : 'text-zinc-300 bg-black/30 border-white/5'
                  }`}>
                    {activeShotPromptText}
                  </p>
                </div>

                {/* IMAGE PROMPT CARD */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  colorTheme === 'paper'
                    ? 'bg-white border-slate-200'
                    : 'bg-white/[0.03] border-white/10'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      Image generation prompt
                    </span>
                    <button
                      type="button"
                      onClick={copyActiveSeeDreamPrompt}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-300 font-semibold text-[11px] flex items-center gap-1 shadow"
                    >
                      {copiedSeeDream ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedSeeDream ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className={`text-xs leading-relaxed p-3 rounded-xl border select-all max-h-28 overflow-y-auto ${
                    colorTheme === 'paper'
                      ? 'text-slate-700 bg-slate-50 border-slate-200'
                      : 'text-zinc-300 bg-black/30 border-white/5'
                  }`}>
                    {activeShotSeeDreamText}
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 0: 📝 SCREENPLAY WRITER STUDIO */}
          {activeView === 'screenplay' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <ScreenplayEditor
                shots={shots}
                onUpdateShotsFromScript={updateShotsWithHistory}
                onNavigateToView={setActiveView}
                projectTitle={projectTitle}
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
                onAddShot={handleAddShot}
                onDeleteShot={handleDeleteShot}
                onToggleMuteShot={handleToggleMuteShot}
                onCloneShot={handleCloneShot}
                onMoveShot={handleMoveShot}
                onReorderShots={handleReorderShots}
                onCompilePrompt={() => setIsCompilerOpen(true)}
                colorTheme={colorTheme}
              />
            </div>
          )}

          {/* TAB 3: 📝 STUDIO FORM VIEW (24-Craft Production Form Editor) */}
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
                onFullEditorOpenChange={setIsFullEditorOpen}
              />
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

      {/* Export Prompt Compiler Modal */}
      <PromptCompilerModal
        isOpen={isCompilerOpen}
        onClose={() => setIsCompilerOpen(false)}
        shots={shots}
        onUpdateShot={handleUpdateShot}
        activeTargetModel={targetModel}
        projectTitle={projectTitle}
        colorTheme={colorTheme}
      />

      {/* Admin Settings Modal */}
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

      {/* AI Script Breakdown Modal */}
      <AIScriptModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onApplyShots={handleApplyAIShots}
        setProjectTitle={(val) => { setProjectTitle(val); syncToCloud({ projectTitle: val }); }}
        currentProjectTitle={projectTitle}
        colorTheme={colorTheme}
      />

      {/* Project Console Modal */}
      <ProjectConsoleModal
        isOpen={isProjectConsoleOpen}
        onClose={() => setIsProjectConsoleOpen(false)}
        initialTab={projectConsoleInitialTab}
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
        setPresetProfile={(val) => { setPresetProfile(val); syncToCloud({ presetProfile: val }); }}
        isAdminLoggedIn={isAdminLoggedIn}
        onOpenInvestorDeck={() => setIsInvestorDeckOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onApplyShots={handleApplyAIShots}
        colorTheme={colorTheme}
      />

      {/* Investor Pitch Showcase & Slide Presentation Modal */}
      <InvestorDeckModal
        isOpen={isInvestorDeckOpen}
        onClose={() => setIsInvestorDeckOpen(false)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

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

      {/* Official Help & User Guide Modal */}
      <HelpUserGuideModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Gmail Login & Account Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        setIsAdminLoggedIn={handleSetAdminLoggedIn}
      />

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
          setMergePromptState(prev => ({ ...prev, isOpen: false }));
          executeApplyAIShots(pendingAiShots, pendingTitle, 'overwrite', [], pendingExtraElements);
        }}
        onMerge={() => {
          const { pendingAiShots, pendingTitle, existingShots, pendingExtraElements } = mergePromptState;
          setMergePromptState(prev => ({ ...prev, isOpen: false }));
          executeApplyAIShots(pendingAiShots, pendingTitle, 'merge', existingShots, pendingExtraElements);
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

      {/* Master Character Bible & Behavior Engine Modal */}
      <CharacterBibleModal
        isOpen={isCharacterBibleOpen}
        onClose={() => setIsCharacterBibleOpen(false)}
        shots={shots}
        projectTitle={projectTitle}
        initialTab={characterBibleTab || 'roster'}
      />

      {/* Master Script Synopsis Modal */}
      <ScriptSynopsisModal
        isOpen={isScriptSynopsisModalOpen}
        onClose={() => setIsScriptSynopsisModalOpen(false)}
      />

      {/* Live Bi-Directional Sync Confirmation Toast Banner */}
      {isProjectSavedToast && (
        <div className="fixed top-16 right-4 z-50 p-3.5 rounded-2xl bg-slate-950/95 border-2 border-cyan-500 text-cyan-200 font-mono text-xs font-bold shadow-[0_10px_40px_rgba(6,182,212,0.4)] flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="p-1.5 rounded-lg bg-cyan-500 text-slate-950">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
          <span>⚡ Bi-Directional Cloud Sync Complete! (Uploaded Local Edits & Pulled Latest Cloud Projects)</span>
        </div>
      )}

      <CollabChatPanel
        isOpen={isCollabChatOpen}
        onClose={() => setIsCollabChatOpen(false)}
        roomId={effectiveRoomId}
        projectTitle={projectTitle}
        activeShotId={currentShotObj?.sceneShotId || ''}
        activeRemoteUsers={activeRemoteUsers}
        colorTheme={colorTheme}
      />
    </div>
  );
}
