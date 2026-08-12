import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Folder, Plus, Copy, Check, Trash2, Edit3, Share2, History, Layers, 
  RefreshCw, FileText, Download, ExternalLink, ShieldAlert, Sparkles, 
  CheckCircle2, Clock, Globe, ArrowRight, Wand2, Upload, Loader2, FolderKanban, Sliders, Maximize2,
  User, Brain, Camera, Music2, Ratio, KeyRound, Play, AlertTriangle
} from 'lucide-react';
import { 
  parseRawScriptToShots, extractTextFromPDF, 
  composeDirectorPsychologyWithLLM, composeHybridVisionMergeWithLLM,
  composeDoPVisionWithLLM, composeSoundVisionWithLLM,
  composeHybridDoPVisionMergeWithLLM, composeHybridSoundVisionMergeWithLLM,
  synthesizeFullAppElementsFromScript, getLastParseMeta,
  PdfExtractError, isPdfBinaryGarbage, looksLikeUsableScriptText,
  PDF_EXTRACT_MESSAGES
} from '../services/aiScriptParser';
import { GENRE_PRESET_PROFILES, getMergedGenreProfiles, detectScriptGenre, SEEDANCE_SLOTS } from '../constants/seedancePresets';
import {
  syncProjectLibraryToCloud,
  fetchProjectLibraryFromCloud,
  syncCollaboratorsToCloud,
  markProjectTitlesDeleted,
  clearDeletedProjectTitles,
  filterOutDeletedProjects
} from '../services/dbService';
import { 
  saveProjectToVault, loadProjectsFromVault, getAllottedFolderPath, 
  setAllottedFolderPath, exportProjectPackageToFile, importProjectPackageFromFile 
} from '../services/projectDiskVault';
import {
  getCurrentUserEmail,
  getCurrentUserProfile,
  isGuestSession,
  isStudioAdmin,
  canAccessProject,
  canCreateOrDeleteProjects,
  filterAccessibleProjects,
  stripTitleFromAllottedProjects,
  ensurePrimaryAdminUser,
  sanitizeAuthorizedUsers
} from '../utils/projectPermissions';
import { saveStoredCharacterProfiles } from './CharacterBibleModal';

/** Canonical craft count from Seedance slot matrix (not marketing copy). */
const CRAFT_COUNT = SEEDANCE_SLOTS.length;

const SAMPLE_SCRIPTS = [
  {
    title: "Kara-Dhushan War (28 Shots)",
    script: `PART ONE: Action Script - Kara-Dhushan War: Lord Rama vs. Demon Legion of Janasthana
ACT I: The Dark Horizon — Demon Legion Arrives

S01-A Aerial · EWS Slow push-in
Vast Dandaka forest canopy, still and grey. Horizon blackens — fourteen thousand silhouettes crest the ridge. Sky dims to ash, sunlight throttled.

S01-B Low-Angle · WS Crane rise
Kara — obsidian chariot, tusked stallions. Dhushan flanking, serpent armour. War drums pulse green-black light through smoke. Ground shudders.

S01-C MCU Intercut Quick cuts x3
Demon eyes — glowing venom-green. Spears raised. Snarling mouths. Cut rapidly: armour, claws, skull banners flapping in unnatural wind.

S01-D OTS Back · WS Static hold
Over Rama's back — alone at forest's edge in saffron dhoti, divine blue skin. The demon tide approaches. He nocks an arrow — utterly still.`
  },
  {
    title: "Cyberpunk Music Video Climax",
    script: `EXT. NEO-TOKYO CONCERT STAGE - NIGHT

Heavy rain falls through cyan and magenta neon light beams.
ARIA (20s, neon blue hair, metallic jacket) grips the microphone stand with both hands.

ARIA
(singing with intense vocal passion)
"The grid is failing... we turn up the amps tonight!"

Camera pushes in with a slow dolly zoom. In the background, LEO (lead guitarist) leans back-to-back with Aria, striking a fierce guitar solo pose. Steam rises from stage floor vents as the backing crowd cheers in unison.`
  }
];

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
  initialTab = 'library',
  isAdminLoggedIn = false,
  onOpenInvestorDeck,
  onOpenLogin,
  onApplyShots
}) {
  // Guests must never remain in Project Console — redirect to Investor Deck
  useEffect(() => {
    if (!isOpen) return;
    if (!isGuestSession()) return;
    onClose?.();
    if (onOpenInvestorDeck) onOpenInvestorDeck();
    else if (onOpenLogin) onOpenLogin();
  }, [isOpen, onClose, onOpenInvestorDeck, onOpenLogin]);

  const scriptFileInputRef = useRef(null);
  const parseInFlightRef = useRef(false);

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
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
        roomId: roomId || 'SPS-CLOUD-8821',
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

  const [activeTab, setActiveTab] = useState(
    initialTab === 'genre' ? 'library' : (initialTab || 'library')
  ); // 'library' | 'ai_breakdown' | 'director_psychology' | 'create' | 'share'
  const [copiedLink, setCopiedLink] = useState(false);
  const importFileRef = React.useRef(null);
  const posterFileInputRef = React.useRef(null);
  const [targetPosterProjId, setTargetPosterProjId] = useState(null);

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
  const [vaultCategory, setVaultCategory] = useState('director'); // 'director' | 'dop' | 'sound'

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

  // Save updated vault object for target project
  const handleSavePsychologyObj = (updatedObj) => {
    if (!targetPsychologyProj) return;
    setProjectLibrary(prev => {
      const updated = prev.map(p => {
        if (p.id === targetPsychologyProj.id) {
          return { ...p, [activeVaultKey]: updatedObj };
        }
        return p;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('sps_project_library', JSON.stringify(updated));
        localStorage.setItem(`sps_${activeVaultKey}_${targetPsychologyProj.title}`, JSON.stringify(updatedObj));
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
      const rawText = typeof window !== 'undefined' ? (localStorage.getItem('sps_current_screenplay_text') || '') : '';
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

  const handlePosterFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !targetPosterProjId) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      setProjectLibrary(prev => prev.map(p => {
        if (p.id === targetPosterProjId) {
          return { ...p, posterUrl: dataUrl };
        }
        return p;
      }));
    };
    reader.readAsDataURL(file);
  };
  const [allottedFolder, setAllottedFolder] = useState(() => getAllottedFolderPath());

  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [tempFolder, setTempFolder] = useState(allottedFolder);

  const handleSaveAllottedFolder = () => {
    const cleanPath = (tempFolder || '').trim();
    if (cleanPath) {
      setAllottedFolderPath(cleanPath);
      setAllottedFolder(cleanPath);
    }
    setIsEditingFolder(false);
  };

  const handleBackupFileImport = async (e) => {
    if (!canCreateOrDeleteProjects()) {
      alert('🔒 ACCESS RESTRICTED:\nOnly the studio Owner can import projects.');
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
        localStorage.setItem('sps_project_library', JSON.stringify(updated));
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
      localStorage.setItem('sps_project_library', JSON.stringify(updated));
      return updated;
    });
    setEditingProjectId(null);
  };

  // Versioning state for active project
  const [newVersionName, setNewVersionName] = useState('');
  const [versionSuccessMsg, setVersionSuccessMsg] = useState('');

  // AI Script Breakdown State
  const [rawScriptText, setRawScriptText] = useState('');
  const [conceptPrompt, setConceptPrompt] = useState('Cyberpunk music video duet with heavy bass, rain, and neon reflections');
  const [shotCountCount, setShotCountCount] = useState(5);
  const [parsedPreview, setParsedPreview] = useState([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [selectedGenre, setSelectedGenre] = useState(presetProfile || 'mythological');
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStatusBanner, setParseStatusBanner] = useState('');
  const [pdfFailure, setPdfFailure] = useState(null); // { code, message, fileName } | null
  const hasUsableScriptText = Boolean(String(rawScriptText || '').trim());
  const canRunParse = hasUsableScriptText && !isLoadingFile;

  useEffect(() => {
    let timer;
    if (isLoadingFile) {
      setParseProgress(10);
      timer = setInterval(() => {
        setParseProgress((prev) => {
          if (prev >= 92) return 92;
          const step = Math.floor(Math.random() * 12) + 6;
          return Math.min(prev + step, 92);
        });
      }, 140);
    } else {
      // Ensure mid-parse % never sticks after loading ends (esp. PDF failures)
      setParseProgress((prev) => (prev > 0 && prev < 100 ? 0 : prev));
    }
    return () => clearInterval(timer);
  }, [isLoadingFile]);

  const finishParseProgress = (opts = {}) => {
    const { success = true } = opts;
    if (!success) {
      setParseProgress(0);
      return;
    }
    setParseProgress(100);
    setTimeout(() => setParseProgress(0), 700);
  };

  const alertLeavingProjectUnchanged = (message) => {
    const msg = String(message || '').trim();
    if (/Existing project was left unchanged\.?/i.test(msg)) {
      alert(msg);
      return;
    }
    alert(`${msg}\n\nExisting project was left unchanged.`);
  };

  const [customProjectTitle, setCustomProjectTitle] = useState(currentProjectTitle || 'NEW CINEMA PROJECT');

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

  // Sync tab if initialTab updates on open & fetch latest cloud projects
  useEffect(() => {
    if (isOpen && initialTab) {
      // Genre is per-project on cards now — never open a global genre tab
      setActiveTab(initialTab === 'genre' ? 'library' : initialTab);
    }
    if (isOpen) {
      fetchProjectLibraryFromCloud().then(cloudProjs => {
        if (Array.isArray(cloudProjs) && cloudProjs.length > 0) {
          setProjectLibrary(prev => {
            // Cloud is membership SoT — do not re-add local-only deleted titles
            const map = new Map();
            const cloudFiltered = filterOutDeletedProjects(cloudProjs);
            cloudFiltered.forEach((p) => {
              if (p && p.title) map.set(String(p.title).trim().toUpperCase(), p);
            });
            // Overlay local field data for titles that still exist on cloud
            (prev || []).forEach((p) => {
              if (!p?.title) return;
              const key = String(p.title).trim().toUpperCase();
              if (!map.has(key)) return;
              map.set(key, { ...p, ...map.get(key) });
            });

            // Ensure current active project is NEVER missing from the library window
            const activeKey = currentProjectTitle ? String(currentProjectTitle).trim().toUpperCase() : '';
            if (activeKey && activeKey !== 'STAGE PRODUCTION STUDIO' && !map.has(activeKey)) {
              map.set(activeKey, {
                id: `proj_${Date.now()}`,
                title: currentProjectTitle,
                description: `Cinema Production Studio Project`,
                targetModel: 'SPS Direct Cinema 2.0',
                aspectRatio: '2.39:1 Anamorphic',
                roomId: 'SPS-CLOUD-8821',
                lastModified: new Date().toLocaleDateString(),
                shots: []
              });
            }

            let merged = filterOutDeletedProjects(Array.from(map.values()));
            if (currentProjectTitle) {
              merged.sort((a, b) => {
                if (a.title === currentProjectTitle) return -1;
                if (b.title === currentProjectTitle) return 1;
                return 0;
              });
            }
            return sanitizeLibraryTitles(merged);
          });
        }
      }).catch(() => {});
    }
  }, [isOpen, initialTab, currentProjectTitle]);

  // Persist library changes locally & push to Cloud Database
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('sps_project_library', JSON.stringify(projectLibrary));
    // Defer past React commit so AdminSettingsModal listeners don't setState mid-render
    const t = setTimeout(() => {
      window.dispatchEvent(new Event('sps_projects_updated'));
      syncProjectLibraryToCloud(projectLibrary);
    }, 0);
    return () => clearTimeout(t);
  }, [projectLibrary]);

  // Must be declared before any early return — hooks order must stay stable
  const [lastFullElements, setLastFullElements] = useState(null);

  if (!isOpen) return null;
  if (isGuestSession()) return null;

  // EVALUATE CURRENT USER PERMISSIONS & ALLOTTED PROJECTS
  const currentUserEmail = getCurrentUserEmail();
  const currentUserProfile = getCurrentUserProfile(currentUserEmail);
  const isPrimaryOwner = canCreateOrDeleteProjects(currentUserEmail);
  const visibleProjectLibrary = filterAccessibleProjects(projectLibrary, currentUserEmail);
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
  const applyProjectToStudio = (proj, { closeConsole = true } = {}) => {
    if (isGuestSession()) {
      alert(`🔒 GUEST ACCESS\n\nUnauthenticated visitors may only view the Investor Deck & Studio Showcase.\n\nSign in to open '${proj.title}', or request access from pedditiram@gmail.com.`);
      onClose?.();
      if (onOpenInvestorDeck) onOpenInvestorDeck();
      return false;
    }

    if (!checkIsProjectAllotted(proj.title)) {
      alert(`🔒 PROJECT ACCESS RESTRICTED:\n'${proj.title}' has not been allotted to your account (${currentUserEmail}). Please ask the studio Owner (pedditiram@gmail.com) to allot this project to your profile in Admin Settings.`);
      return false;
    }
    if (setProjectTitle) setProjectTitle(proj.title);
    if (setTargetModel) setTargetModel(proj.targetModel);
    if (setAspectRatio) setAspectRatio(proj.aspectRatio);
    if (setShots) setShots(proj.shots);
    if (setRoomId && proj.roomId) setRoomId(proj.roomId);
    const genreKey = resolveProjectGenreKey(proj);
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

  // 2. CREATE NEW PROJECT (PRIMARY ADMIN & OWNER AUTHORIZED RULE)
  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!isPrimaryOwner) {
      alert("🔒 ACCESS RESTRICTED:\nOnly the studio Owner (pedditiram@gmail.com) can create new projects.");
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

  const resetScriptFileInput = () => {
    if (scriptFileInputRef.current) {
      scriptFileInputRef.current.value = '';
    }
  };

  const formatPdfFailureBanner = (code, message) => {
    const label = code || 'extract failed';
    return `⚠️ PDF: ${label} — ${message || PDF_EXTRACT_MESSAGES.PARSE_FAILED}`;
  };

  // 3. AI SCRIPT PARSING HANDLERS
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (parseInFlightRef.current || isLoadingFile) {
      resetScriptFileInput();
      return;
    }

    parseInFlightRef.current = true;
    setIsLoadingFile(true);
    setPdfFailure(null);
    setParseStatusBanner('');
    setUploadedFileName(file.name);
    let parseSucceeded = false;

    try {
      let extractedText = '';
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf) {
        extractedText = await extractTextFromPDF(file);
      } else {
        extractedText = await file.text();
      }

      if (!extractedText || !String(extractedText).trim()) {
        setUploadedFileName('');
        setPdfFailure({
          code: isPdf ? 'EMPTY' : 'EMPTY_FILE',
          message: isPdf ? PDF_EXTRACT_MESSAGES.EMPTY : 'Could not extract text from that file. Existing project was left unchanged.',
          fileName: file.name
        });
        setParseStatusBanner(
          isPdf
            ? formatPdfFailureBanner('EMPTY', PDF_EXTRACT_MESSAGES.EMPTY)
            : '⚠️ No text in file — paste screenplay text or try a sample script. Existing project unchanged.'
        );
        alertLeavingProjectUnchanged(
          isPdf ? PDF_EXTRACT_MESSAGES.EMPTY : 'Could not extract text from that file. Existing project was left unchanged.'
        );
        return;
      }

      if (isPdf && (isPdfBinaryGarbage(extractedText) || !looksLikeUsableScriptText(extractedText))) {
        setUploadedFileName('');
        setPdfFailure({
          code: 'PDF_GARBAGE',
          message: PDF_EXTRACT_MESSAGES.PDF_GARBAGE,
          fileName: file.name
        });
        setParseStatusBanner(formatPdfFailureBanner('PDF_GARBAGE', PDF_EXTRACT_MESSAGES.PDF_GARBAGE));
        alertLeavingProjectUnchanged(PDF_EXTRACT_MESSAGES.PDF_GARBAGE);
        return;
      }

      setRawScriptText(extractedText);
      setPdfFailure(null);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sps_current_screenplay_text', extractedText);
      }
      const parsedShots = await parseRawScriptToShots(extractedText);
      const meta = getLastParseMeta();
      if (!parsedShots.length) {
        alertLeavingProjectUnchanged(meta?.warning || 'Parse produced no shots. Existing project was left unchanged.');
        setParseStatusBanner(meta?.warning || '⚠️ Parse produced no shots. Existing project unchanged.');
        return;
      }
      setParsedPreview(parsedShots);
      setIsGenerated(true);
      if (meta?.warning) {
        console.info('[AI Breakdown]', meta.warning);
      }
      setParseStatusBanner(
        meta?.error === 'MISSING_API_KEY' || meta?.usedFallback
          ? (meta.warning || 'Offline heuristic parse used.')
          : (meta?.shotCount ? `✓ Parsed ${meta.shotCount} shots (${CRAFT_COUNT} crafts)` : '')
      );

      // AUTO-SYNTHESIZE ALL APP ELEMENTS (preview only — do NOT overwrite library shots until Apply)
      let fullElements = null;
      try {
        fullElements = await synthesizeFullAppElementsFromScript(extractedText, file.name || currentProjectTitle || '', parsedShots);
        setLastFullElements(fullElements);
        if (fullElements?.characters && fullElements.characters.length > 0) {
          try { saveStoredCharacterProfiles(fullElements.characters); } catch (e) {}
        }
      } catch (synthErr) {
        console.warn('Post-parse synthesis skipped:', synthErr);
        setLastFullElements({ shots: parsedShots });
      }

      const detected = fullElements?.detectedGenre || detectScriptGenre(file.name || currentProjectTitle || '', parsedShots, extractedText);
      if (detected) {
        if (typeof setSelectedGenre === 'function') setSelectedGenre(detected);
        if (typeof setScriptGenre === 'function') setScriptGenre(detected);
        if (typeof setPresetProfile === 'function') setPresetProfile(detected);
        localStorage.setItem('sps_preset_profile', detected);
        localStorage.setItem('sps_active_genre', detected);
      }
      parseSucceeded = true;
      // Genre/vision preview only — shots applied via Apply button to avoid wiping project mid-preview
    } catch (err) {
      const isPdfErr = err instanceof PdfExtractError || err?.name === 'PdfExtractError';
      const code = err?.code || (isPdfErr ? 'PARSE_FAILED' : 'PARSE_ERROR');
      const message = err?.message || PDF_EXTRACT_MESSAGES.PARSE_FAILED;
      // Do not wipe existing paste text / preview / project shots on failure
      setUploadedFileName('');
      if (isPdfErr) {
        setPdfFailure({ code, message, fileName: file.name });
        setParseStatusBanner(formatPdfFailureBanner(code, message));
      } else {
        setPdfFailure(null);
        setParseStatusBanner(`⚠️ ${message}`);
      }
      alertLeavingProjectUnchanged(message);
    } finally {
      parseInFlightRef.current = false;
      setIsLoadingFile(false);
      finishParseProgress({ success: parseSucceeded });
      resetScriptFileInput();
    }
  };

  const handleParseScript = async () => {
    if (parseInFlightRef.current || isLoadingFile) return;
    if (!rawScriptText.trim()) {
      alert('Paste screenplay text, upload a text-based PDF/TXT, or pick a sample script before parsing.');
      setParseStatusBanner('⚠️ Parse disabled — no usable screenplay text yet.');
      return;
    }
    parseInFlightRef.current = true;
    setIsLoadingFile(true);
    setPdfFailure(null);
    let parseSucceeded = false;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('sps_current_screenplay_text', rawScriptText);
      }
      const parsedShots = await parseRawScriptToShots(rawScriptText);
      const meta = getLastParseMeta();
      if (!parsedShots.length) {
        alertLeavingProjectUnchanged(meta?.warning || 'Parse produced no shots. Existing project was left unchanged.');
        setParseStatusBanner(meta?.warning || '⚠️ Parse produced no shots. Existing project unchanged.');
        return;
      }
      setParsedPreview(parsedShots);
      setIsGenerated(true);
      if (meta?.warning) {
        console.info('[AI Breakdown]', meta.warning);
      }
      if (meta?.error === 'MISSING_API_KEY') {
        setParseStatusBanner(meta.warning);
      } else {
        setParseStatusBanner(
          meta?.usedFallback
            ? meta.warning
            : (meta?.shotCount ? `✓ Parsed ${meta.shotCount} shots (${CRAFT_COUNT} crafts)` : '')
        );
      }

      let fullElements = null;
      try {
        fullElements = await synthesizeFullAppElementsFromScript(rawScriptText, currentProjectTitle || '', parsedShots);
        setLastFullElements(fullElements);
        if (fullElements?.characters && fullElements.characters.length > 0) {
          try { saveStoredCharacterProfiles(fullElements.characters); } catch (e) {}
        }
      } catch (synthErr) {
        console.warn('Post-parse synthesis skipped:', synthErr);
        setLastFullElements({ shots: parsedShots });
      }

      const detected = fullElements?.detectedGenre || detectScriptGenre(currentProjectTitle || '', parsedShots, rawScriptText);
      if (detected) {
        if (typeof setSelectedGenre === 'function') setSelectedGenre(detected);
        if (typeof setScriptGenre === 'function') setScriptGenre(detected);
        if (typeof setPresetProfile === 'function') setPresetProfile(detected);
        localStorage.setItem('sps_preset_profile', detected);
        localStorage.setItem('sps_active_genre', detected);
      }
      parseSucceeded = true;
      // Do not write shots into project library until user clicks Apply
    } catch (err) {
      alertLeavingProjectUnchanged(`Failed to parse script: ${err?.message || err}`);
      setParseStatusBanner(`⚠️ Parse failed: ${err?.message || err}`);
    } finally {
      parseInFlightRef.current = false;
      setIsLoadingFile(false);
      finishParseProgress({ success: parseSucceeded });
    }
  };

  const handleApplyAIShotsToCurrent = () => {
    if (parsedPreview.length > 0) {
      if (typeof onApplyShots === 'function') {
        onApplyShots(parsedPreview, currentProjectTitle, lastFullElements);
      } else if (setShots) {
        setShots(parsedPreview);
      }
      onClose();
    }
  };

  // 4. DUPLICATE PROJECT (admin only — creates a new project)
  const handleDuplicateProject = (proj) => {
    if (!isPrimaryOwner) {
      alert('🔒 ACCESS RESTRICTED:\nOnly the studio Owner can create or duplicate projects.');
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

  // 5. DELETE PROJECT (PRIMARY ADMIN & OWNER AUTHORIZED RULE)
  const handleDeleteProject = (projId) => {
    if (!isPrimaryOwner) {
      alert("🔒 ACCESS RESTRICTED:\nOnly the studio Owner (pedditiram@gmail.com) can delete projects.");
      return;
    }

    if (projectLibrary.length <= 1) {
      alert("Cannot delete the last remaining project. Create a new project first!");
      return;
    }

    const targetProj = projectLibrary.find(p => p.id === projId);
    if (confirm(`⚠️ OWNER CONFIRMATION REQUIRED:\nAre you sure you want to permanently delete project "${targetProj?.title || projId}"?\nThis action cannot be undone.`)) {
      const deletedTitle = targetProj?.title || '';
      const updated = projectLibrary.filter(p => p.id !== projId);

      // Tombstone so cloud hydrate / Admin allot dropdown cannot resurrect this title
      if (deletedTitle) markProjectTitlesDeleted([deletedTitle]);

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
      // Persist + push pruned library to Vercel immediately
      try {
        localStorage.setItem('sps_project_library', JSON.stringify(updated));
        window.dispatchEvent(new Event('sps_projects_updated'));
        syncProjectLibraryToCloud(updated);
      } catch (e) {}

      if (activeProjectId === projId) {
        handleSwitchProject(updated[0]);
      }
    }
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
    : `https://stage-production-studio.vercel.app?room=${roomId}`;

  const copyShareLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareableUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className={`sps-modal-enter fixed inset-0 z-50 flex items-center justify-center selection:bg-amber-400 selection:text-black transition-all ${
      isVaultFullscreen ? 'p-0 bg-black' : 'sps-modal-overlay p-3 sm:p-5 bg-black/80 backdrop-blur-md'
    }`} style={{ fontFamily: 'var(--sps-font)' }}>
      <div className={`relative w-full text-slate-900 dark:text-white overflow-hidden flex flex-col transition-all sps-modal-shell sps-glass-shell ${
        isVaultFullscreen
          ? 'max-w-none w-screen h-screen rounded-none border-none p-0 bg-black'
          : 'max-w-6xl rounded-3xl border border-slate-300/80 dark:border-white/10 h-[90vh] max-h-[94vh] max-md:h-[100dvh] max-md:max-h-[100dvh]'
      }`}>
        
        {/* Single Ultra-Compact Merged Header & Navigation Bar (Hidden in Fullscreen Total Screen View) */}
        {!isVaultFullscreen && (
          <div className="px-3 sm:px-5 py-3 border-b border-white/[0.08] bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 gap-2.5">
          {/* Left Side: Navigation Tabs */}
          <div className="flex items-center gap-2.5 overflow-x-auto sps-header-scroll min-w-0 pb-0.5">
            <div className="hidden sm:flex items-center gap-2 mr-1 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-amber-500/10 border border-cyan-400/30 flex items-center justify-center">
                <FolderKanban className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-bold text-white tracking-tight" style={{ fontFamily: 'var(--sps-font-display)' }}>Project Console</p>
                <p className="text-[9px] text-zinc-500 font-medium">Library · per-project genre</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`sps-chrome-btn px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm shrink-0 ${
                activeTab === 'library'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_6px_20px_rgba(34,211,238,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span className="whitespace-nowrap">Library</span>
            </button>
          </div>

          {/* Right Side: Profile Badge, Import Backup, + New Project, Close */}
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto sps-header-scroll">
            {/* Logged-In User Profile Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-cyan-200 text-xs font-semibold shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <User className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="truncate max-w-[150px]">
                {currentUserProfile?.name || (currentUserEmail ? currentUserEmail.split('@')[0] : 'Pedditi Ram')}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium hidden lg:inline truncate max-w-[160px]">
                {currentUserEmail}
              </span>
            </div>

            {/* Import Backup File — admin only */}
            {isPrimaryOwner && (
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                className="sps-chrome-btn px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer shrink-0 border border-cyan-400/30"
                title="Import & Restore .sps / .json Project Backup File"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import Backup</span>
                <span className="sm:hidden">Import</span>
              </button>
            )}

            {/* + New Project Button — admin only */}
            {isPrimaryOwner ? (
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`sps-chrome-btn px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer shrink-0 border ${
                  activeTab === 'create'
                    ? 'bg-amber-400 text-slate-950 border-amber-200/60 shadow-[0_8px_24px_rgba(245,158,11,0.28)]'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] text-white border-white/15'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">New Project</span>
                <span className="sm:hidden">New</span>
              </button>
            ) : (
              <div className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] text-zinc-400 font-semibold shrink-0">
                Allotted only
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="sps-chrome-btn p-2.5 sm:p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 cursor-pointer shrink-0"
              title="Close Project Console"
              aria-label="Close Project Console"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        )}

        {/* Modal Tab Content Area - Compact & Expanded to Fill Height */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 h-full bg-slate-50/50 dark:bg-zinc-950/60">
          
          {/* TAB 1: PROJECT LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <input 
                type="file" 
                ref={importFileRef} 
                onChange={handleBackupFileImport} 
                accept=".json,.sps" 
                className="hidden" 
              />



              {/* Hidden File Input for Custom Movie Poster Art Upload */}
              <input type="file" ref={posterFileInputRef} onChange={handlePosterFileChange} accept="image/*" className="hidden" />

              {/* Project Cards Grid (Poster Design Layout - Horizontal 2-Column Split inside each card) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 pb-6">
                {!isPrimaryOwner && (
                  <div className="xl:col-span-2 px-4 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-100 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
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
                  <div className="xl:col-span-2 p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-100 text-xs font-mono">
                    No projects are allotted to <strong>{currentUserEmail || 'this account'}</strong>. Ask the studio Owner (pedditiram@gmail.com) to allot a project in Admin Settings.
                  </div>
                )}
                {visibleProjectLibrary.map((proj, projIdx) => {
                  const isActive = currentProjectTitle === proj.title;
                  const isAllotted = checkIsProjectAllotted(proj.title);
                  const poster = getProjectPosterStyle(proj.title);
                  const projectGenreKey = resolveProjectGenreKey(proj);
                  const projectGenreLabel = resolveProjectGenreLabel(proj);

                  return (
                    <div
                      key={proj.id || `proj_${projIdx}`}
                      className={`sps-project-tile relative rounded-3xl border flex flex-col sm:flex-row overflow-hidden group/card ${
                        isActive
                          ? 'is-active border-cyan-400/80 dark:border-cyan-400/70 ring-1 ring-cyan-400/35 bg-white dark:bg-zinc-900'
                          : isAllotted
                            ? 'bg-white dark:bg-zinc-900/90 border-slate-200 dark:border-zinc-800/90 hover:border-cyan-500/40'
                            : 'bg-slate-100/80 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800/60 opacity-85'
                      }`}
                      style={{ animationDelay: `${Math.min(projIdx, 8) * 40}ms` }}
                    >
                      {/* LEFT COLUMN: Dedicated 2:3 Ratio Cinema Poster Box */}
                      <div 
                        className={`relative w-full sm:w-48 h-64 sm:h-full min-h-[260px] bg-gradient-to-b ${poster.gradient} p-3 flex flex-col justify-between overflow-hidden border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-zinc-800 group/poster cursor-pointer shrink-0`}
                        onClick={() => handleTriggerPosterUpload(proj.id)}
                        title="Click to Upload Custom Movie Poster Art"
                      >
                        {proj.posterUrl ? (
                          <img 
                            src={proj.posterUrl} 
                            alt={`${proj.title} Official Movie Poster`} 
                            className="absolute inset-0 w-full h-full object-cover object-center group-hover/poster:scale-105 transition-transform duration-500" 
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center select-none overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-black pointer-events-none" />
                            <div className="text-4xl mb-2 opacity-90 group-hover/poster:scale-110 transition-transform duration-300">
                              {poster.icon}
                            </div>
                            <span className="text-[9px] text-amber-400 tracking-[0.2em] uppercase font-bold" style={{ fontFamily: 'var(--sps-font-mono)' }}>
                              Official poster
                            </span>
                            <h3 className="text-base font-extrabold text-white tracking-tight uppercase max-w-xs drop-shadow-lg leading-tight mt-1 line-clamp-3" style={{ fontFamily: 'var(--sps-font-display)' }}>
                              {proj.title}
                            </h3>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60 pointer-events-none" />

                        <div className="flex items-center justify-between gap-1 z-10">
                          {isActive ? (
                            <span className="text-[10px] bg-cyan-400 text-slate-950 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-slate-950 stroke-[3]" /> Active
                            </span>
                          ) : (
                            <span className="text-[10px] bg-zinc-950/80 text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-700 font-semibold">
                              {proj.shots?.length || 0} shots
                            </span>
                          )}
                        </div>

                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20 backdrop-blur-[2px] p-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerPosterUpload(proj.id);
                            }}
                            className="sps-chrome-btn px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-[11px] shadow-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>{proj.posterUrl ? 'Change' : 'Upload'} Poster</span>
                          </button>
                        </div>

                        <div className="z-10 mt-auto pt-2">
                          <span className="text-[9px] text-zinc-300 tracking-widest uppercase font-bold block drop-shadow" style={{ fontFamily: 'var(--sps-font-mono)' }}>
                            {poster.tagline}
                          </span>
                          <h4 className="text-base font-extrabold text-white tracking-tight truncate drop-shadow-md" style={{ fontFamily: 'var(--sps-font-display)' }}>
                            {proj.title}
                          </h4>
                        </div>
                      </div>

                      {/* RIGHT COLUMN: Project Details & Action Buttons Panel */}
                      <div className="p-4 bg-white dark:bg-zinc-900/90 flex-1 flex flex-col justify-between space-y-3 min-w-0">
                        <div className="space-y-2.5">
                          <div className="flex flex-col gap-1.5 min-w-0 rounded-2xl border border-slate-200/90 dark:border-white/[0.07] bg-slate-50/80 dark:bg-black/25 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 dark:text-zinc-500">
                                Project genre
                              </label>
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300/90 truncate max-w-[55%]" title={projectGenreLabel}>
                                {projectGenreLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[11px] px-2 py-1 rounded-lg font-bold border shrink-0 ${poster.badgeBg}`}>
                                {poster.icon}
                              </span>
                              <select
                                value={projectGenreKey}
                                onChange={(e) => handleUpdateProjectGenre(proj.id, e.target.value)}
                                disabled={!isPrimaryOwner && !checkIsProjectAllotted(proj.title)}
                                className="sps-input-premium flex-1 min-w-0 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-800 dark:text-amber-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate" style={{ fontFamily: 'var(--sps-font-display)' }}>
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

                          <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                            {proj.description || 'Cinema Production Studio Project'}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 font-semibold text-slate-700 dark:text-zinc-300">
                              <Ratio className="w-3 h-3 text-slate-400" /> {proj.aspectRatio}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 font-semibold text-cyan-700 dark:text-cyan-400">
                              <KeyRound className="w-3 h-3" /> {proj.roomId}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              // Soft-switch only — never close console when opening AI Breakdown
                              if (!isActive) {
                                const ok = softSwitchProject(proj);
                                if (!ok) return;
                              }
                              setCustomProjectTitle(proj.title);
                              setPdfFailure(null);
                              setActiveTab('ai_breakdown');
                            }}
                            className="sps-chrome-btn w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-400/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/35 text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                            title={`Run AI Script Breakdown for ${proj.title}`}
                          >
                            <Wand2 className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>AI Script Breakdown</span>
                          </button>

                          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPsychologyProjId(proj.id);
                                setVaultCategory('director');
                                setActiveTab('director_psychology');
                              }}
                              className="sps-chrome-btn py-1.5 px-1.5 rounded-xl bg-amber-950/90 hover:bg-amber-900 text-amber-200 border border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
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
                              className="sps-chrome-btn py-1.5 px-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border border-cyan-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
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
                              className="sps-chrome-btn py-1.5 px-1.5 rounded-xl bg-sky-950/90 hover:bg-sky-900 text-sky-200 border border-sky-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
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
                            className={`sps-chrome-btn w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer ${
                              isActive
                                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_10px_28px_rgba(34,211,238,0.28)] border border-cyan-300/50'
                                : 'bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white border border-white/10'
                            }`}
                          >
                            {isActive ? <Play className="w-4 h-4 fill-current" /> : <ArrowRight className="w-4 h-4 text-cyan-300" />}
                            <span>{isActive ? 'Open Active Studio' : 'Switch & Open Project'}</span>
                          </button>

                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            {isPrimaryOwner ? (
                              <button
                                type="button"
                                onClick={() => handleDuplicateProject(proj)}
                                className="sps-chrome-btn py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                                title="Duplicate Project"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </button>
                            ) : (
                              <div className="py-1.5 px-2 rounded-xl bg-zinc-900/40 text-zinc-500 text-[11px] font-semibold text-center">
                                Edit only
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => exportProjectPackageToFile(proj)}
                              className="sps-chrome-btn py-1.5 px-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                              title="Save Backup File (.sps)"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Backup</span>
                            </button>

                            {isPrimaryOwner ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(proj.id)}
                                className="sps-chrome-btn py-1.5 px-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                                title="Delete Project"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                <span>Delete</span>
                              </button>
                            ) : (
                              <div className="py-1.5 px-2 rounded-xl bg-zinc-900/40 text-zinc-500 text-[11px] font-semibold text-center">
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
            </div>
          )}

          {/* TAB 2: AI SCRIPT BREAKDOWN (50/50 DUAL PANE DASHBOARD) */}
          {activeTab === 'ai_breakdown' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full font-mono">
              {/* LEFT PANE: Script Input & Controls */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between space-y-3 shadow-sm">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Wand2 className="w-4 h-4 text-amber-500" />
                        AI Screenplay Breakdown & Cinema Parser
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5 truncate">
                        Target: {customProjectTitle || currentProjectTitle || 'Active project'}
                      </p>
                    </div>
                    <label className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-md transition-all ${
                      isLoadingFile
                        ? 'bg-slate-400 text-white cursor-not-allowed opacity-60 pointer-events-none'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
                    }`}>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isLoadingFile ? 'Reading…' : 'Upload File'}</span>
                      <input
                        ref={scriptFileInputRef}
                        type="file"
                        accept=".pdf,.txt,.fountain,.fdx"
                        onChange={handleFileUpload}
                        disabled={isLoadingFile}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Sample Scripts Selector */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-bold shrink-0">Sample Scripts:</span>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                      {SAMPLE_SCRIPTS.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setRawScriptText(sample.script);
                            setPdfFailure(null);
                            setParseStatusBanner('');
                            setUploadedFileName('');
                          }}
                          disabled={isLoadingFile}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-cyan-600 dark:text-cyan-300 text-[11px] font-bold shrink-0 hover:border-cyan-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          📄 {sample.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pdfFailure && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-[11px] text-amber-950 dark:text-amber-100">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 min-w-0">
                          <p className="font-black">
                            PDF extract failed{pdfFailure.code ? `: ${pdfFailure.code}` : ''}
                            {pdfFailure.fileName ? ` (${pdfFailure.fileName})` : ''}
                          </p>
                          <p className="leading-relaxed opacity-90">{pdfFailure.message}</p>
                          <ul className="list-disc pl-4 space-y-0.5 text-amber-900/90 dark:text-amber-100/90">
                            <li>Use a <strong>text-based PDF</strong> or <strong>.TXT</strong> export (not a scan).</li>
                            <li>Or <strong>paste</strong> screenplay text into the box below.</li>
                            <li>Or load a <strong>Sample Script</strong> above to verify the parser.</li>
                            <li>Scanned PDFs need <strong>external OCR</strong> first — not built into SPS.</li>
                          </ul>
                          <p className="font-semibold text-amber-800 dark:text-amber-200">
                            Parse stays disabled until usable script text is present. Existing project shots were not changed.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-[11px] text-slate-600 dark:text-zinc-400 font-bold block">Paste Screenplay Text:</label>
                      {uploadedFileName ? (
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono truncate max-w-[50%]" title={uploadedFileName}>
                          📎 {uploadedFileName}
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      rows={8}
                      value={rawScriptText}
                      onChange={(e) => {
                        setRawScriptText(e.target.value);
                        if (e.target.value.trim()) setPdfFailure(null);
                      }}
                      disabled={isLoadingFile}
                      placeholder="Paste scene description, screenplay sluglines (INT/EXT), or shot list… Or upload a text PDF / TXT."
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 leading-relaxed min-h-[160px] max-h-[260px] resize-y shadow-inner font-mono font-medium disabled:opacity-60"
                    />
                    {!hasUsableScriptText && !pdfFailure ? (
                      <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">
                        No script text yet — paste, upload TXT/text-PDF, or pick a sample. Parse stays off until then.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      Engine: <strong className="text-cyan-600 dark:text-cyan-400 font-bold">Pedditi Labs ({CRAFT_COUNT} Crafts)</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleParseScript}
                      disabled={!canRunParse}
                      title={
                        isLoadingFile
                          ? 'Parse in progress…'
                          : (!hasUsableScriptText
                            ? 'Paste or upload usable screenplay text first'
                            : `Parse into ${CRAFT_COUNT}-craft shots`)
                      }
                      className={`px-4 py-2 rounded-xl font-black text-xs shadow-md flex items-center gap-1.5 transition-all ${
                        canRunParse
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-zinc-950 cursor-pointer'
                          : 'bg-slate-300 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 cursor-not-allowed opacity-70 grayscale'
                      }`}
                    >
                      {isLoadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 fill-current" />}
                      <span>{isLoadingFile ? `Parsing (${parseProgress}%)...` : `⚡ Parse ${CRAFT_COUNT} Crafts Shots`}</span>
                    </button>
                  </div>

                  {/* Dynamic Thin Progress Bar Animation with Percentages */}
                  {(isLoadingFile || parseProgress > 0) && (
                    <div className="w-full space-y-1 pt-1 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-500" />
                          Analyzing {CRAFT_COUNT} Crafts...
                        </span>
                        <span className="bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded text-xs font-mono font-black">{parseProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden relative shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400 transition-all duration-200 ease-out rounded-full relative"
                          style={{ width: `${parseProgress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/40 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                  {parseStatusBanner && !isLoadingFile ? (
                    <p className={`text-[10.5px] font-mono leading-relaxed pt-1 ${String(parseStatusBanner).startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {parseStatusBanner}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('library')}
                      className="text-[11px] font-bold text-slate-500 hover:text-cyan-600 dark:text-zinc-400 dark:hover:text-cyan-300 cursor-pointer"
                    >
                      ← Back to Library
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT PANE: Live Craft Generated Breakdown Panel */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between h-full shadow-sm">
                {isGenerated && parsedPreview.length > 0 ? (
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Generated {parsedPreview.length} Shots ({CRAFT_COUNT} Crafts)
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyAIShotsToCurrent}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Check className="w-4 h-4 stroke-[3]" /> Apply to Studio
                      </button>
                    </div>

                    <div className="space-y-2 overflow-y-auto flex-1 max-h-[360px] pr-1">
                      {parsedPreview.map((s, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5 hover:border-cyan-500/50 transition-all">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-1">
                            <span className="font-black text-amber-600 dark:text-amber-300 font-mono">{s.sceneShotId}</span>
                            <span className="text-slate-600 dark:text-zinc-400 font-mono font-medium">{s.shotComposition}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                            <span className="text-cyan-600 dark:text-cyan-400 font-mono truncate">🎥 {s.cameraMotionTag}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono truncate">💡 {s.subjectLightingTag}</span>
                          </div>
                          <p className="text-slate-700 dark:text-zinc-300 text-[11px] leading-snug line-clamp-2">
                            {s.actionEnvContext || s.sceneSynopsis || '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-500">
                      Apply opens Overwrite vs Merge if the project already has real shots. Preview never wipes the library by itself.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 flex-1 my-auto">
                    <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
                      <Wand2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">Live {CRAFT_COUNT}-Craft Breakdown Preview</h5>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-normal">
                        Paste screenplay text on the left, upload a <strong>text-based</strong> PDF/TXT, or select a sample script, then click <strong>⚡ Parse {CRAFT_COUNT} Crafts Shots</strong>.
                      </p>
                      {pdfFailure ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold pt-2">
                          Last upload failed ({pdfFailure.code || 'PDF'}). Recover with paste / TXT / sample — then Parse enables.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                      <option value="Seedance 2.0">Seedance 2.0</option>
                      <option value="SeeDream 1.0">SeeDream 1.0</option>
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
                <p className="font-bold">Project creation is Owner-only.</p>
                <p>Editors and Viewers can only open allotted projects. Only Owner (pedditiram@gmail.com) can create, delete, duplicate, or import projects.</p>
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

        {/* Modal Bottom Footer Strip - Active Project + Storage Path & Edit Path (Hidden in Full Screen Mode) */}
        {!isVaultFullscreen && (
          <div className="p-2.5 px-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 font-mono text-xs">
            {/* Left: Active Project Pill */}
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-bold">Active Project:</span>
              <span className="font-black text-cyan-400 uppercase tracking-wider bg-cyan-950/80 px-2.5 py-0.5 rounded-lg border border-cyan-800/60 shadow-sm">{currentProjectTitle}</span>
            </div>

            {/* Right: Storage Path & Edit Path */}
            <div className="flex items-center gap-2.5 min-w-0 max-w-2xl">
              <span className="text-zinc-400 font-bold shrink-0">Storage Path:</span>
              {isEditingFolder ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempFolder}
                    onChange={(e) => setTempFolder(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveAllottedFolder();
                      if (e.key === 'Escape') setIsEditingFolder(false);
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-black border border-cyan-500/60 text-cyan-300 font-mono text-xs w-64 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveAllottedFolder}
                    className="px-2.5 py-0.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingFolder(false)}
                    className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <span className="bg-black/70 text-cyan-300 font-mono text-[11px] px-2.5 py-1 rounded-lg border border-cyan-500/20 truncate">
                  {allottedFolder}
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setTempFolder(allottedFolder);
                  setIsEditingFolder(!isEditingFolder);
                }}
                className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                title="Change Allotted Storage Directory Path"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingFolder ? 'Cancel' : 'Edit Path'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

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
