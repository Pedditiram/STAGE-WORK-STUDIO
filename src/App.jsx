import React, { useState, useEffect } from 'react';
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
import { syncCanvasVaultToCloud, getStoredCanvasVaultImages } from './services/canvasVault';
import { saveProjectToVault, loadProjectsFromVault } from './services/projectDiskVault';
import { subscribeToCloudRoom, publishToCloudRoom } from './services/cloudSync';
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
import { SEEDANCE_SLOTS, getSlotsForGenre, detectScriptGenre, GENRE_PRESET_PROFILES } from './constants/seedancePresets';
import { safeLocalStorageSetItem } from './utils/safeStorage';
import { Download, Upload, Edit3, Check, Copy, Sparkles, Image as ImageIcon, Code, Film, Play, FastForward, RefreshCw } from 'lucide-react';

const INITIAL_SHOTS = [
  {
    sceneShotId: "SC01_SH01",
    shotComposition: "Extreme Close-Up (ECU)",
    cameraMotionTag: "[Camera: Push In / Slow Dolly Zoom]",
    subjectLightingTag: "[Lighting: Cyberpunk Neon Blue & Pink Dual Glow]",
    subjectColorTag: "[Subject Color: High-Saturation Neo-Noir]",
    backgroundLightingTag: "[BG Lighting: Strobing Neon City Reflections]",
    backgroundColorTag: "[BG Color: Deep Midnight Blue & Indigo]",
    characterIdAssetRef: "[CharID: @LeadSinger_Aria - Vocalist, leather jacket]",
    coArtistInteraction: "[Co-Artist: Backing musicians swaying to rhythm, gazing at lead artist]",
    actionEnvContext: "Rain-slicked futuristic concert stage under towering neon city lights, wet reflections, smoke machine haze.",
    characterExpression: "Passionate singing, eyes closed in deep emotion, veins visible on neck",
    characterPlacement: "Foreground center stage, co-artists positioned in midground left & right",
    characterDialogue: '"The grid is failing... turn up the amps!"',
    characterMovement: "Grasping microphone stand with both hands and leaning forward with intense energy",
    characterEyeLooks: "[Eye Look: Direct Eye Contact with Camera Lens]"
  },
  {
    sceneShotId: "SC01_SH02",
    shotComposition: "Medium Shot (MS)",
    cameraMotionTag: "[Camera: Tracking Shot / Steadicam Follow]",
    subjectLightingTag: "[Lighting: High-Contrast Chiaroscuro Noir]",
    subjectColorTag: "[Subject Color: Teal & Orange Cinema Palette]",
    backgroundLightingTag: "[BG Lighting: Cold Industrial Fluorescent Strip]",
    backgroundColorTag: "[BG Color: Muted Concrete Industrial Gray]",
    characterIdAssetRef: "[CharID: @Guitarist_Leo - Lead guitarist, cyber visor]",
    coArtistInteraction: "[Co-Artist: Co-singer stepping up to microphone for harmonized duet reaction]",
    actionEnvContext: "Underground cybernetics music venue, flickering blue neon lights, packed energetic crowd.",
    characterExpression: "Exuberant smile, laughing mid-performance while making eye contact",
    characterPlacement: "Midground center frame rule of thirds, co-performers surrounding in semi-circle",
    characterDialogue: '"We only get one chance at this!"',
    characterMovement: "Striking a powerful guitar bend pose, body angled 45 degrees",
    characterEyeLooks: "[Eye Look: Looking at Co-Artist with intense stage chemistry]"
  }
];

export default function App() {
  const [projectTitle, setProjectTitle] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_current_project_title') || "STAGE PRODUCTION STUDIO";
    }
    return "STAGE PRODUCTION STUDIO";
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitleInput, setTempTitleInput] = useState(projectTitle);
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
      return localStorage.getItem('sps_enable_canvas_tab') === 'true';
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

  // Persistent shots state from localStorage
  const [shots, setShots] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_current_shots');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return INITIAL_SHOTS;
  });

  // Dynamic Script-Aware Preset Engine State
  const [presetProfile, setPresetProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_preset_profile');
      if (saved && GENRE_PRESET_PROFILES[saved]) return saved;
    }
    return 'mythological';
  });

  // Auto-detect script profile when project title or shots update
  useEffect(() => {
    const detected = detectScriptGenre(projectTitle, shots);
    setPresetProfile(detected);
  }, [projectTitle, shots]);

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
      const canShowCanvas = localStorage.getItem('sps_enable_canvas_tab') === 'true';
      return canShowCanvas ? "canvas" : "spreadsheet";
    }
    return "spreadsheet";
  });

  // Enforce canvas tab hiding when showCanvasTab is OFF (false)
  useEffect(() => {
    if (!showCanvasTab && activeView === 'canvas') {
      setActiveView('spreadsheet');
    }
  }, [showCanvasTab, activeView]);

  const [activeShotIndex, setActiveShotIndex] = useState(0);
  const [isCompilerOpen, setIsCompilerOpen] = useState(false);
  const [isProjectConsoleOpen, setIsProjectConsoleOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedSeeDream, setCopiedSeeDream] = useState(false);
  const [copiedFirstFrame, setCopiedFirstFrame] = useState(false);
  const [copiedLastFrame, setCopiedLastFrame] = useState(false);

  // Director Canvas Keyframe Mode Sync ('first_frame' | 'last_frame' | 'transition')
  const [canvasKeyframeMode, setCanvasKeyframeMode] = useState('transition');

  // =========================================================================
  // UNIVERSAL UNDO / REDO HISTORY ENGINE STATE & HANDLERS
  // =========================================================================
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const updateShotsWithHistory = (newShots) => {
    setHistoryStack(prev => [...prev.slice(-50), shots]);
    setRedoStack([]);
    setShots(newShots);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previousShots = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, historyStack.length - 1);
    
    setRedoStack(prev => [shots, ...prev]);
    setHistoryStack(newHistory);
    setShots(previousShots);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextShots = redoStack[0];
    const newRedo = redoStack.slice(1);
    
    setHistoryStack(prev => [...prev, shots]);
    setRedoStack(newRedo);
    setShots(nextShots);
  };

  // Keyboard shortcut listener for Cmd+Z / Ctrl+Z (Undo) and Cmd+Shift+Z / Ctrl+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
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
  }, [historyStack, redoStack, shots]);

  // Cloud & Admin & AI State
  const [roomId, setRoomId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('room') || 'SPS-CLOUD-8821';
    }
    return 'SPS-CLOUD-8821';
  });
  // App Version Mode: 'local' (Default 100% offline & local) vs 'cloud' (Firebase real-time sync)
  const [appVersionMode, setAppVersionMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_app_version_mode') || 'local';
    }
    return 'local';
  });
  const [isAppVersionModalOpen, setIsAppVersionModalOpen] = useState(false);

  const handleSelectAppVersionMode = async (mode) => {
    setAppVersionMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_app_version_mode', mode);
      if (mode === 'cloud') {
        // Auto-upload & sync local vault images to cloud database payload
        await syncCanvasVaultToCloud(roomId, projectTitle);
        const vault = getStoredCanvasVaultImages();
        syncToCloud({ shots, projectGeneratedImages: vault });
      }
    }
  };

  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminModalTab, setAdminModalTab] = useState('all');
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isInvestorDeckOpen, setIsInvestorDeckOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_is_admin_logged_in');
      if (saved !== null) return saved === 'true';
      // Default to true (Unlocked) so studio is never locked out
      localStorage.setItem('sps_is_admin_logged_in', 'true');
      return true;
    }
    return true;
  });

  const handleSetAdminLoggedIn = (val) => {
    setIsAdminLoggedIn(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_is_admin_logged_in', val ? 'true' : 'false');
    }
  };
  const [currentRole, setCurrentRole] = useState('director');
  const [collaborators, setCollaborators] = useState([
    { name: 'Director (You)', role: '🎬 Director' },
    { name: 'DP Lead', role: '🎥 Cinematographer' },
    { name: 'Lighting Tech', role: '💡 Lighting Lead' }
  ]);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const effectiveRoomId = `${roomId}_${(projectTitle || 'default').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const isInitialMount = React.useRef(true);
  const lastSyncedHash = React.useRef('');
  const prevAutoSavedShotsRef = React.useRef('');

  // Local Storage Persistence (Does NOT publish to cloud when in Local Version)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeLocalStorageSetItem('sps_current_shots', JSON.stringify(shots));
    safeLocalStorageSetItem('sps_current_project_title', projectTitle);
    safeLocalStorageSetItem('sps_current_target_model', targetModel);
    safeLocalStorageSetItem('sps_current_aspect_ratio', aspectRatio);
  }, [shots, projectTitle, targetModel, aspectRatio]);

  // Hydrate Latest Projects & Collaborators from Cloud Database on App Mount (Cloud Mode Only)
  useEffect(() => {
    if (appVersionMode !== 'cloud') return;

    fetchProjectLibraryFromCloud().then(projs => {
      let updatedProjs = Array.isArray(projs) 
        ? projs.filter(p => p && p.title && p.title.trim().toUpperCase() !== 'STAGE PRODUCTION STUDIO') 
        : [];
      
      // Self-healing guard: ensure active loaded project is NEVER missing from Projects Library
      const activeTitle = (projectTitle && projectTitle.toUpperCase() !== 'STAGE PRODUCTION STUDIO') ? projectTitle : '001';
      const exists = updatedProjs.some(p => p.title === activeTitle);
      if (!exists && shots && shots.length > 0) {
        updatedProjs.unshift({
          id: `proj_${Date.now()}`,
          title: activeTitle,
          description: `Cinema Production Studio Project with ${shots.length} shots`,
          targetModel: targetModel || 'SPS Direct Cinema 2.0',
          aspectRatio: aspectRatio || '2.39:1 Anamorphic',
          roomId: effectiveRoomId || 'SPS-PROJ-8476',
          lastModified: new Date().toLocaleDateString(),
          shots: shots
        });
      }

      safeLocalStorageSetItem('sps_project_library', JSON.stringify(updatedProjs));
      window.dispatchEvent(new Event('sps_projects_updated'));
      syncProjectLibraryToCloud(updatedProjs);

      const activeProj = updatedProjs.find(p => p.title === projectTitle || p.id === 'proj_default');
      const savedShotsStr = localStorage.getItem('sps_current_shots');
      let localSavedShots = [];
      if (savedShotsStr) {
        try { localSavedShots = JSON.parse(savedShotsStr); } catch (e) {}
      }

      if (activeProj && Array.isArray(activeProj.shots) && activeProj.shots.length > 0) {
        // If local browser has more shots (e.g. newly added script breakdown), keep local shots!
        const targetShots = (Array.isArray(localSavedShots) && localSavedShots.length > activeProj.shots.length)
          ? localSavedShots
          : activeProj.shots;

        const cloudHash = JSON.stringify({ 
          shots: targetShots, 
          projectTitle: activeProj.title || projectTitle, 
          targetModel: activeProj.targetModel || targetModel, 
          aspectRatio: activeProj.aspectRatio || aspectRatio 
        });
        lastSyncedHash.current = cloudHash;
        setShots(targetShots);
        localStorage.setItem('sps_current_shots', JSON.stringify(targetShots));
      } else if (Array.isArray(localSavedShots) && localSavedShots.length > 0) {
        setShots(localSavedShots);
      }
    }).catch(() => {});

    fetchCollaboratorsFromCloud().then(users => {
      if (Array.isArray(users) && users.length > 0) {
        localStorage.setItem('sps_authorized_phone_users', JSON.stringify(users));
        window.dispatchEvent(new Event('sps_collaborators_updated'));
      }
    }).catch(() => {});
  }, [appVersionMode]);

  // Auto-Save Active Project to Physical Hard Drive Folder (/Users/pedditiram/Documents/PROMPT ENGINEERING/projects/)
  useEffect(() => {
    if (!shots || shots.length === 0 || !projectTitle) return;

    const currentShotsHash = JSON.stringify({ projectTitle, targetModel, aspectRatio, shots });
    if (currentShotsHash === prevAutoSavedShotsRef.current) return; // Prevent duplicate infinite re-renders!
    
    prevAutoSavedShotsRef.current = currentShotsHash;

    const activeProj = {
      id: `proj_${projectTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
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

  useEffect(() => {
    if (appVersionMode !== 'cloud') return;
    const unsubscribe = subscribeToCloudRoom(effectiveRoomId, (cloudData) => {
      if (cloudData && cloudData.shots && Array.isArray(cloudData.shots)) {
        const cloudHash = JSON.stringify({ 
          shots: cloudData.shots, 
          projectTitle: cloudData.projectTitle || projectTitle, 
          targetModel: cloudData.targetModel || targetModel, 
          aspectRatio: cloudData.aspectRatio || aspectRatio 
        });

        // Only update local state if cloud data differs from current hash and auto-save ref
        if (cloudHash !== lastSyncedHash.current && cloudHash !== prevAutoSavedShotsRef.current) {
          lastSyncedHash.current = cloudHash;
          prevAutoSavedShotsRef.current = cloudHash;
          setShots(cloudData.shots);
          if (cloudData.targetModel) setTargetModel(cloudData.targetModel);
          if (cloudData.aspectRatio) setAspectRatio(cloudData.aspectRatio);

          localStorage.setItem('sps_current_shots', JSON.stringify(cloudData.shots));
        }
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [effectiveRoomId, projectTitle, appVersionMode]);

  // -------------------------------------------------------------
  // REAL-TIME SLOT PRESENCE BROADCASTING & CONFLICT DETECTION
  // -------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined' || appVersionMode !== 'cloud') return;
    const currentUserEmail = localStorage.getItem('sps_authorized_user_email');
    if (!currentUserEmail) return;
    const activeShot = shots[activeShotIndex];
    if (activeShot && activeShot.sceneShotId) {
      // Passive presence: isEditing = false by default
      broadcastActiveSlotEditing(currentUserEmail, currentUserEmail.split('@')[0], projectTitle, activeShot.sceneShotId, false);
    }
  }, [activeShotIndex, shots, projectTitle]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentUserEmail = localStorage.getItem('sps_authorized_user_email') || 'unauthenticated';
    const unsubPresence = subscribeToActiveEditingSlots(currentUserEmail, (otherActiveUsers) => {
      const activeShot = shots[activeShotIndex];
      if (activeShot && activeShot.sceneShotId) {
        // ONLY trigger popup if collaborator is actively typing/editing a field (isEditing === true)
        const matchingConflict = otherActiveUsers.find(u => u.activeShotId === activeShot.sceneShotId && u.projectTitle === projectTitle && u.isEditing === true);
        if (matchingConflict) {
          setActiveConflict(matchingConflict);
          setIsConflictModalOpen(true);
        }
      }
    });
    return () => {
      if (typeof unsubPresence === 'function') unsubPresence();
    };
  }, [activeShotIndex, shots, projectTitle]);

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
        let library = savedLibStr ? JSON.parse(savedLibStr) : [];
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

    create30MinAutoBackup();
    const THIRTY_MINUTES_MS = 30 * 60 * 1000;
    const backupInterval = setInterval(create30MinAutoBackup, THIRTY_MINUTES_MS);

    return () => clearInterval(backupInterval);
  }, [projectTitle, shots]);

  const [projectGeneratedImages, setProjectGeneratedImages] = useState(() => {
    try {
      const saved = localStorage.getItem('sps_generated_images_map');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const syncToCloud = (updatedState = {}) => {
    setIsCloudSyncing(true);
    const newShots = updatedState?.shots || shots;
    const newTitle = updatedState?.projectTitle || projectTitle;
    const newModel = updatedState?.targetModel || targetModel;
    const newRatio = updatedState?.aspectRatio || aspectRatio;

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
        const updatedProjectData = {
          id: existingIdx !== -1 ? library[existingIdx].id : `proj_${Date.now()}`,
          title: newTitle,
          description: `Cinema Production Studio Project with ${newShots.length} shots`,
          targetModel: newModel,
          aspectRatio: newRatio,
          roomId: roomId,
          lastModified: new Date().toLocaleDateString(),
          shots: newShots,
          projectGeneratedImages: projectGeneratedImages
        };

        if (existingIdx !== -1) {
          library[existingIdx] = { ...library[existingIdx], ...updatedProjectData };
        } else {
          library.unshift(updatedProjectData);
        }

        safeLocalStorageSetItem('sps_project_library', JSON.stringify(library));
        syncProjectLibraryToCloud(library);
      } catch (e) {}
    }

    const targetRoom = `${roomId}_${(newTitle || 'default').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    publishToCloudRoom(targetRoom, {
      projectTitle: newTitle,
      targetModel: newModel,
      aspectRatio: newRatio,
      shots: newShots,
      projectGeneratedImages,
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
      let library = savedLibStr ? JSON.parse(savedLibStr) : [];
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

      const [shotId, keyframeMode] = shotKey.split('_');
      const shotIndex = shots.findIndex(s => (s.sceneShotId === shotId) || (`SH_${shots.indexOf(s) + 1}` === shotId));
      
      let updatedShots = shots;
      if (shotIndex !== -1) {
        updatedShots = [...shots];
        updatedShots[shotIndex] = {
          ...updatedShots[shotIndex],
          embeddedImages: {
            ...(updatedShots[shotIndex].embeddedImages || {}),
            [keyframeMode || 'first_frame']: imageUrl
          }
        };
        setShots(updatedShots);
        localStorage.setItem('sps_current_shots', JSON.stringify(updatedShots));
      }
      
      syncToCloud({ shots: updatedShots, projectGeneratedImages: updated });
      return updated;
    });
  };

  const handleTitleSubmit = () => {
    if (tempTitleInput.trim()) {
      const formatted = tempTitleInput.trim().toUpperCase();
      setProjectTitle(formatted);
      syncToCloud({ projectTitle: formatted });
    }
    setIsEditingTitle(false);
  };

  const handleUpdateShot = (index, updatedShotOrKey, value) => {
    const newShots = [...shots];
    if (typeof updatedShotOrKey === 'string') {
      newShots[index] = { ...newShots[index], [updatedShotOrKey]: value };
    } else {
      newShots[index] = updatedShotOrKey;
    }
    updateShotsWithHistory(newShots);
    syncToCloud({ shots: newShots });
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
    updateShotsWithHistory(newShots);
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

    updateShotsWithHistory(newShots);
    syncToCloud({ shots: newShots });
  };

  const handleRestoreShot = (index) => {
    const newShots = [...shots];
    if (newShots[index]) {
      const { isArchived, archivedAt, ...rest } = newShots[index];
      newShots[index] = rest;
      updateShotsWithHistory(newShots);
      syncToCloud({ shots: newShots });
    }
  };

  const handleToggleMuteShot = (index) => {
    const newShots = [...shots];
    if (newShots[index]) {
      newShots[index] = {
        ...newShots[index],
        isMuted: !newShots[index].isMuted
      };
      updateShotsWithHistory(newShots);
      syncToCloud({ shots: newShots });
    }
  };

  const handleDeleteShot = handleToggleMuteShot;

  const handleCloneShot = (index) => {
    const cloned = { ...shots[index] };
    const newShots = [...shots];
    newShots.splice(index + 1, 0, cloned);
    updateShotsWithHistory(newShots);
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
    updateShotsWithHistory(newShots);
    setActiveShotIndex(targetIdx);
    syncToCloud({ shots: newShots });
  };

  const handleReorderShots = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= shots.length || toIndex >= shots.length) return;
    const newShots = [...shots];
    const [movedShot] = newShots.splice(fromIndex, 1);
    newShots.splice(toIndex, 0, movedShot);
    updateShotsWithHistory(newShots);
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
    existingShots: []
  });

  const executeApplyAIShots = (aiShots, titleToApply, mode, baseShots = []) => {
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
    setProjectTitle(titleToApply);
    setActiveShotIndex(0);
    setActiveView("canvas");

    if (typeof window !== 'undefined') {
      try {
        const savedLibStr = localStorage.getItem('sps_project_library');
        let library = savedLibStr ? JSON.parse(savedLibStr) : [];
        if (!Array.isArray(library)) library = [];

        const existingIdx = library.findIndex(p => p.title === titleToApply);
        const newProj = {
          id: existingIdx !== -1 ? library[existingIdx].id : `proj_${Date.now()}`,
          title: titleToApply,
          description: `Cinema Production Studio Project with ${finalShots.length} shots`,
          targetModel: targetModel || 'SPS Direct Cinema 2.0',
          aspectRatio: aspectRatio || '2.39:1 Anamorphic',
          roomId: roomId || 'SPS-CLOUD-8821',
          lastModified: new Date().toLocaleDateString(),
          shots: finalShots
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

    syncToCloud({ shots: finalShots, projectTitle: titleToApply });
  };

  const handleApplyAIShots = (aiShots, newTitle) => {
    const titleToApply = newTitle || projectTitle;
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

    if (targetExistingShots.length > 0) {
      setMergePromptState({
        isOpen: true,
        projectTitle: titleToApply,
        existingCount: targetExistingShots.length,
        incomingCount: aiShots.length,
        pendingAiShots: aiShots,
        pendingTitle: titleToApply,
        existingShots: targetExistingShots
      });
      return;
    }

    executeApplyAIShots(aiShots, titleToApply, 'overwrite', []);
  };

  const handleLoadTemplate = (template) => {
    setShots(template.shots);
    setProjectTitle(template.title.toUpperCase());
    setAspectRatio(template.aspectRatio);
    setActiveShotIndex(0);
    setActiveView("canvas");
    syncToCloud({
      shots: template.shots,
      projectTitle: template.title.toUpperCase(),
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
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.shots && Array.isArray(json.shots)) {
          setShots(json.shots);
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
    navigator.clipboard.writeText(activeShotPromptText);
    setCanvasKeyframeMode('transition');
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const copyFirstFrame = () => {
    navigator.clipboard.writeText(firstFrameText);
    setCanvasKeyframeMode('first_frame');
    setCopiedFirstFrame(true);
    setTimeout(() => setCopiedFirstFrame(false), 2000);
  };

  const copyLastFrame = () => {
    navigator.clipboard.writeText(lastFrameText);
    setCanvasKeyframeMode('last_frame');
    setCopiedLastFrame(true);
    setTimeout(() => setCopiedLastFrame(false), 2000);
  };

  const copyActiveSeeDreamPrompt = () => {
    navigator.clipboard.writeText(activeShotSeeDreamText);
    setCopiedSeeDream(true);
    setTimeout(() => setCopiedSeeDream(false), 2000);
  };

  return (
    <div className={`h-screen w-full flex flex-col font-sans selection:bg-cyan-500 selection:text-black overflow-hidden transition-colors duration-300 ${
      colorTheme === 'paper' 
        ? 'bg-[#F8FAFC] text-[#0F172A] theme-paper' 
        : 'bg-zinc-950 text-zinc-100 theme-dark'
    }`}>
      {/* Top Header */}
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
        onOpenProjectConsole={() => setIsProjectConsoleOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenInvestorDeck={() => setIsInvestorDeckOpen(true)}
        appVersionMode={appVersionMode}
        onOpenAppVersionModal={() => setIsAppVersionModalOpen(true)}
        roomId={roomId}
        collaboratorCount={collaborators.length}
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
      />

      {/* Main Studio Body View */}
      <main className="flex-1 w-full p-1 sm:p-2 flex flex-col gap-1.5 overflow-hidden min-h-0">
        
        {/* DYNAMICALLY SEGREGATED WORKSPACE VIEW CONTAINER */}
        <div className="flex-1 w-full min-h-0 overflow-hidden flex flex-col">
          
          {/* TAB 1: 🎬 2D/3D DIRECTOR CANVAS VIEW (Full 100% Screen Space for Canvas & Live Prompts) */}
          {showCanvasTab && activeView === 'canvas' && (
            <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-4 h-full overflow-hidden">
              
              {/* LEFT 7 COLUMNS: Interactive 2D/3D Director Canvas */}
              <div className="lg:col-span-7 flex flex-col gap-4 overflow-y-auto pr-1 h-full">
                <DirectorCanvas 
                  shot={currentShotObj} 
                  aspectRatio={aspectRatio}
                  shots={shots}
                  activeShotIndex={activeShotIndex}
                  setActiveShotIndex={setActiveShotIndex}
                  keyframeMode={canvasKeyframeMode}
                  setKeyframeMode={setCanvasKeyframeMode}
                  projectGeneratedImages={projectGeneratedImages}
                  onEmbedImage={handleEmbedImageToProject}
                  onOpenAdminSettings={(tab) => {
                    setAdminModalTab(tab || 'image');
                    setIsAdminModalOpen(true);
                  }}
                />
              </div>

              {/* RIGHT 5 COLUMNS: Live Prompt View Cards */}
              <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto pr-1 h-full">
                
                {/* FIRST FRAME PROMPT CARD */}
                <div 
                  onClick={() => setCanvasKeyframeMode('first_frame')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    canvasKeyframeMode === 'first_frame'
                      ? 'bg-cyan-950/40 border-cyan-500/80 shadow-lg shadow-cyan-950/50'
                      : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold font-mono text-cyan-300 flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-cyan-400" />
                      First Frame Prompt (Frame 0)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyFirstFrame(); }}
                      className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold text-[11px] font-mono flex items-center gap-1 shadow"
                    >
                      {copiedFirstFrame ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedFirstFrame ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 font-mono leading-relaxed p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 select-all">
                    {firstFrameText}
                  </p>
                </div>

                {/* LAST FRAME PROMPT CARD */}
                <div 
                  onClick={() => setCanvasKeyframeMode('last_frame')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    canvasKeyframeMode === 'last_frame'
                      ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-950/50'
                      : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold font-mono text-amber-300 flex items-center gap-1.5">
                      <FastForward className="w-3.5 h-3.5 text-amber-400" />
                      Last Frame Prompt (Frame N)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyLastFrame(); }}
                      className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold text-[11px] font-mono flex items-center gap-1 shadow"
                    >
                      {copiedLastFrame ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedLastFrame ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 font-mono leading-relaxed p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 select-all">
                    {lastFrameText}
                  </p>
                </div>

                {/* STAGE PRODUCTION VIDEO PROMPT CARD */}
                <div 
                  onClick={() => setCanvasKeyframeMode('transition')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    canvasKeyframeMode === 'transition'
                      ? 'bg-pink-950/40 border-pink-500/80 shadow-lg shadow-pink-950/50'
                      : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold font-mono text-cyan-300 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-cyan-400" />
                      Stage Production Video Prompt
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyActivePrompt(); }}
                      className="px-2 py-0.5 rounded bg-cyan-500 text-zinc-950 hover:bg-cyan-400 font-bold text-[11px] font-mono flex items-center gap-1 shadow"
                    >
                      {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedPrompt ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 font-mono leading-relaxed p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 select-all max-h-28 overflow-y-auto">
                    {activeShotPromptText}
                  </p>
                </div>

                {/* SEEDREAM 5.0 IMAGE PROMPT CARD */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-all">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold font-mono text-amber-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      Image Generation Prompt
                    </span>
                    <button
                      type="button"
                      onClick={copyActiveSeeDreamPrompt}
                      className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold text-[11px] font-mono flex items-center gap-1 shadow"
                    >
                      {copiedSeeDream ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedSeeDream ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 font-mono leading-relaxed p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 select-all max-h-28 overflow-y-auto">
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
                onUpdateShotsFromScript={setShots}
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
              />
            </div>
          )}

          {/* TAB 3: 📝 STUDIO FORM VIEW (Full 100% Height for Form Editor) */}
          {activeView === 'form' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <StudioFormView
                slots={activeSlots}
                shots={shots}
                activeShotIndex={activeShotIndex}
                setActiveShotIndex={setActiveShotIndex}
                onUpdateShot={handleUpdateShot}
                onCompilePrompt={() => setIsCompilerOpen(true)}
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
      />



      {/* Admin Settings Modal */}
      <AdminSettingsModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
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
      />

      {/* AI Script Breakdown Modal */}
      <AIScriptModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onApplyShots={handleApplyAIShots}
        setProjectTitle={(val) => { setProjectTitle(val); syncToCloud({ projectTitle: val }); }}
        currentProjectTitle={projectTitle}
      />

      {/* Project Console Modal */}
      <ProjectConsoleModal
        isOpen={isProjectConsoleOpen}
        onClose={() => setIsProjectConsoleOpen(false)}
        currentProjectTitle={projectTitle}
        setProjectTitle={(val) => { setProjectTitle(val); syncToCloud({ projectTitle: val }); }}
        shots={shots}
        setShots={(val) => { setShots(val); syncToCloud({ shots: val }); }}
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
      />

      {/* Investor Pitch Showcase & Slide Presentation Modal */}
      <InvestorDeckModal
        isOpen={isInvestorDeckOpen}
        onClose={() => setIsInvestorDeckOpen(false)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* 2-Factor Phone & OTP Security Guard for Shared Invite Links */}
      <PhoneOtpGuardModal currentRoomId={roomId} />

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
          const { pendingAiShots, pendingTitle } = mergePromptState;
          setMergePromptState(prev => ({ ...prev, isOpen: false }));
          executeApplyAIShots(pendingAiShots, pendingTitle, 'overwrite', []);
        }}
        onMerge={() => {
          const { pendingAiShots, pendingTitle, existingShots } = mergePromptState;
          setMergePromptState(prev => ({ ...prev, isOpen: false }));
          executeApplyAIShots(pendingAiShots, pendingTitle, 'merge', existingShots);
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

      {/* Live Bi-Directional Sync Confirmation Toast Banner */}
      {isProjectSavedToast && (
        <div className="fixed top-16 right-4 z-50 p-3.5 rounded-2xl bg-slate-950/95 border-2 border-cyan-500 text-cyan-200 font-mono text-xs font-bold shadow-[0_10px_40px_rgba(6,182,212,0.4)] flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="p-1.5 rounded-lg bg-cyan-500 text-slate-950">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
          <span>⚡ Bi-Directional Cloud Sync Complete! (Uploaded Local Edits & Pulled Latest Cloud Projects)</span>
        </div>
      )}
    </div>
  );
}
