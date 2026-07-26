import React, { useState, useEffect } from 'react';
import { 
  X, Folder, Plus, Copy, Check, Trash2, Edit3, Share2, History, Layers, 
  RefreshCw, FileText, Download, ExternalLink, ShieldAlert, Sparkles, 
  CheckCircle2, Clock, Globe, ArrowRight, Wand2, Upload, Loader2, FolderKanban, Sliders
} from 'lucide-react';
import { parseRawScriptToShots, generateScriptFromConcept, extractTextFromPDF } from '../services/aiScriptParser';
import { GENRE_PRESET_PROFILES, getMergedGenreProfiles, detectScriptGenre } from '../constants/seedancePresets';
import { syncProjectLibraryToCloud, fetchProjectLibraryFromCloud } from '../services/dbService';
import { 
  saveProjectToVault, loadProjectsFromVault, getAllottedFolderPath, 
  setAllottedFolderPath, exportProjectPackageToFile, importProjectPackageFromFile 
} from '../services/projectDiskVault';

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
        targetModel: targetModel || 'SPS Direct Cinema',
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

  const [activeTab, setActiveTab] = useState(initialTab || 'library'); // 'library' | 'ai_breakdown' | 'genre' | 'create' | 'share'
  const [copiedLink, setCopiedLink] = useState(false);
  const importFileRef = React.useRef(null);
  const [allottedFolder, setAllottedFolder] = useState(() => getAllottedFolderPath());

  const handleEditAllottedFolder = () => {
    const current = getAllottedFolderPath();
    const newPath = prompt("Set Allotted Local Storage Directory Path for Project Backups:", current);
    if (newPath && newPath.trim()) {
      const cleanPath = newPath.trim();
      setAllottedFolderPath(cleanPath);
      setAllottedFolder(cleanPath);
    }
  };

  const handleBackupFileImport = async (e) => {
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
  const [newModel, setNewModel] = useState('Seedance 2.0');
  const [newRatio, setNewRatio] = useState('2.39:1 Anamorphic');
  const [newTemplate, setNewTemplate] = useState('epic_war');

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

  useEffect(() => {
    let timer;
    if (isLoadingFile) {
      setParseProgress(10);
      timer = setInterval(() => {
        setParseProgress((prev) => {
          if (prev >= 94) return 94;
          const step = Math.floor(Math.random() * 12) + 6;
          return Math.min(prev + step, 94);
        });
      }, 140);
    } else if (parseProgress > 0) {
      setParseProgress(100);
      const resetTimer = setTimeout(() => setParseProgress(0), 500);
      return () => clearTimeout(resetTimer);
    }
    return () => clearInterval(timer);
  }, [isLoadingFile]);

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
      setActiveTab(initialTab);
    }
    if (isOpen) {
      fetchProjectLibraryFromCloud().then(cloudProjs => {
        if (Array.isArray(cloudProjs) && cloudProjs.length > 0) {
          setProjectLibrary(prev => {
            const map = new Map();
            (prev || []).forEach(p => { if (p && p.title) map.set(p.title, p); });
            cloudProjs.forEach(p => {
              if (p && p.title) {
                const existing = map.get(p.title);
                map.set(p.title, existing ? { ...existing, ...p } : p);
              }
            });

            // Ensure current active project is NEVER missing from the library window
            if (currentProjectTitle && !map.has(currentProjectTitle)) {
              map.set(currentProjectTitle, {
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

            let merged = Array.from(map.values());
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_project_library', JSON.stringify(projectLibrary));
      window.dispatchEvent(new Event('sps_projects_updated'));
      syncProjectLibraryToCloud(projectLibrary);
    }
  }, [projectLibrary]);

  if (!isOpen) return null;

  // Active project ID
  const activeProjectId = projectLibrary.find(p => p.title === currentProjectTitle)?.id || projectLibrary[0]?.id;

  // EVALUATE CURRENT USER PERMISSIONS & ALLOTTED PROJECTS
  const currentUserEmail = (typeof window !== 'undefined' ? localStorage.getItem('sps_authorized_user_email') : '') || 'pedditiram@gmail.com';
  const authorizedUsers = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]') 
    : [];

  const currentUserProfile = authorizedUsers.find(u => 
    (u.email && u.email.toLowerCase() === currentUserEmail.toLowerCase()) || 
    (u.phone && currentUserEmail.includes(u.phone))
  );

  const isPrimaryOwner = currentUserEmail.toLowerCase() === 'pedditiram@gmail.com' || 
    isAdminLoggedIn === true || 
    (currentUserProfile?.role && (currentUserProfile.role.includes('Owner') || currentUserProfile.role.includes('Director')));

  const allottedProjectsList = Array.isArray(currentUserProfile?.allottedProjects) 
    ? currentUserProfile.allottedProjects 
    : ['STAGE PRODUCTION STUDIO', 'All Studio Projects'];

  const checkIsProjectAllotted = (projTitle) => {
    if (isPrimaryOwner) return true;
    if (allottedProjectsList.includes('All Studio Projects') || allottedProjectsList.includes('All Studio Projects (Full Access)')) return true;
    return allottedProjectsList.includes(projTitle);
  };

  const getDynamicAllottedUsersForProject = (projTitle) => {
    const matchedUsers = authorizedUsers.filter(u => {
      if (u.status === 'Suspended') return false;
      if (projTitle === '002' && (u.email?.includes('varshini') || u.name?.includes('Varshini'))) return true;
      const userAllotments = Array.isArray(u.allottedProjects) ? u.allottedProjects : [];
      return userAllotments.includes(projTitle) || userAllotments.includes('All Studio Projects') || userAllotments.includes('All Studio Projects (Full Access)');
    }).map(u => {
      if (u.email) return u.email.split('@')[0];
      return u.name || u.phone;
    });

    if (matchedUsers.length > 0) {
      const unique = Array.from(new Set(matchedUsers));
      return unique.join(', ');
    }

    if (projTitle === '002') return 'pedditiram, pedditivarshini';
    return 'pedditiram';
  };

  // 1. SWITCH PROJECT (WITH ENFORCED GUEST & ALLOTTED PERMISSION GUARD)
  const handleSwitchProject = (proj) => {
    const savedEmail = typeof window !== 'undefined' ? localStorage.getItem('sps_authorized_user_email') : '';
    const isGuestUser = !savedEmail || savedEmail === 'Guest' || savedEmail === 'Guest / Unauthenticated';
    
    if (isGuestUser) {
      alert(`🔒 GUEST ACCESS RESTRICTED:\nGuest users are strictly prohibited from accessing working studio projects ('${proj.title}'). Please log in with your authorized studio Gmail account or watch our Investor Showcase Slideshow!`);
      if (onOpenInvestorDeck) onOpenInvestorDeck();
      return;
    }

    if (!checkIsProjectAllotted(proj.title)) {
      alert(`🔒 PROJECT ACCESS RESTRICTED:\n'${proj.title}' has not been allotted to your account (${currentUserEmail}). Please ask Primary Admin (pedditiram@gmail.com) to allot this project to your profile in Admin Settings.`);
      return;
    }
    if (setProjectTitle) setProjectTitle(proj.title);
    if (setTargetModel) setTargetModel(proj.targetModel);
    if (setAspectRatio) setAspectRatio(proj.aspectRatio);
    if (setShots) setShots(proj.shots);
    if (setRoomId && proj.roomId) setRoomId(proj.roomId);
    onClose();
  };

  // 2. CREATE NEW PROJECT (PRIMARY ADMIN & OWNER AUTHORIZED RULE)
  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!isPrimaryOwner) {
      alert("🔒 ACCESS RESTRICTED:\nOnly authorized admins or primary project owner (pedditiram@gmail.com) can create new projects.");
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

    const newProjObj = {
      id: projId,
      title: cleanTitle,
      description: newDescription.trim() || 'Custom stage production project',
      targetModel: newModel,
      aspectRatio: newRatio,
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

    setProjectLibrary(prev => [...prev, newProjObj]);
    handleSwitchProject(newProjObj);
  };

  // 3. AI SCRIPT PARSING HANDLERS
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoadingFile(true);
    setUploadedFileName(file.name);

    try {
      let extractedText = '';
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        extractedText = await extractTextFromPDF(file);
      } else {
        extractedText = await file.text();
      }

      setRawScriptText(extractedText);
      const parsedShots = await parseRawScriptToShots(extractedText);
      setParsedPreview(parsedShots);
      setIsGenerated(true);

      // AUTO-DETECT & AUTO-SELECT MATCHING GENRE IMMEDIATELY!
      const detected = detectScriptGenre(file.name || currentProjectTitle || '', parsedShots, extractedText);
      if (detected) {
        if (typeof setSelectedGenre === 'function') setSelectedGenre(detected);
        if (typeof setScriptGenre === 'function') setScriptGenre(detected);
        if (typeof setPresetProfile === 'function') setPresetProfile(detected);
        localStorage.setItem('sps_preset_profile', detected);
        localStorage.setItem('sps_active_genre', detected);
      }
    } catch (err) {
      alert("Failed to parse document: " + err.message);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleParseScript = async () => {
    if (!rawScriptText.trim()) return;
    setIsLoadingFile(true);
    try {
      const parsedShots = await parseRawScriptToShots(rawScriptText);
      setParsedPreview(parsedShots);
      setIsGenerated(true);

      // AUTO-DETECT & AUTO-SELECT MATCHING GENRE IMMEDIATELY!
      const detected = detectScriptGenre(currentProjectTitle || '', parsedShots, rawScriptText);
      if (detected) {
        if (typeof setSelectedGenre === 'function') setSelectedGenre(detected);
        if (typeof setScriptGenre === 'function') setScriptGenre(detected);
        if (typeof setPresetProfile === 'function') setPresetProfile(detected);
        localStorage.setItem('sps_preset_profile', detected);
        localStorage.setItem('sps_active_genre', detected);
      }
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleApplyAIShotsToCurrent = () => {
    if (parsedPreview.length > 0) {
      if (typeof onApplyShots === 'function') {
        onApplyShots(parsedPreview, currentProjectTitle);
      } else if (setShots) {
        setShots(parsedPreview);
      }
      onClose();
    }
  };

  // 4. DUPLICATE PROJECT
  const handleDuplicateProject = (proj) => {
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
      alert("🔒 ACCESS RESTRICTED:\nOnly authorized admins or primary project owner (pedditiram@gmail.com) can delete projects.");
      return;
    }

    if (projectLibrary.length <= 1) {
      alert("Cannot delete the last remaining project. Create a new project first!");
      return;
    }

    const targetProj = projectLibrary.find(p => p.id === projId);
    if (confirm(`⚠️ PRIMARY ADMIN CONFIRMATION REQUIRED:\nAre you sure you want to permanently delete project "${targetProj?.title || projId}"?\nThis action cannot be undone.`)) {
      const updated = projectLibrary.filter(p => p.id !== projId);
      setProjectLibrary(updated);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md font-mono">
      <div className="relative w-full max-w-6xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[96vh]">
        
        {/* Modal Header */}
        <div className="p-3 px-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-100/90 dark:bg-zinc-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
              <FolderKanban className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
                Stage Production Studio Console & AI Intelligence
                <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-300 px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-800 font-mono font-bold">
                  {projectLibrary.length} Projects Saved
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">Unified management for Projects, AI Script Breakdown & Genre Presets.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Logged-In User Profile Badge on Top Right */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-cyan-100 dark:bg-cyan-950/90 border border-cyan-300 dark:border-cyan-700/60 text-cyan-900 dark:text-cyan-300 font-mono text-[11px] font-bold shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
              <span className="truncate max-w-[160px]">
                👤 {currentUserProfile?.name || (currentUserEmail ? currentUserEmail.split('@')[0] : 'Pedditi Ram')}
              </span>
              <span className="text-[10px] text-cyan-700 dark:text-cyan-400/80 font-normal hidden lg:inline">
                ({currentUserEmail})
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Unified Tab Navigation */}
        <div className="flex items-center gap-1.5 px-5 pt-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-900/50 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`px-3 py-1.5 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'library'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>📂 Projects Library</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai_breakdown')}
            className={`px-3 py-1.5 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'ai_breakdown'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>🪄 AI Script Breakdown</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('genre')}
            className={`px-3 py-1.5 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'genre'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>🎭 Script Genre ({GENRE_PRESET_PROFILES[presetProfile]?.name || presetProfile})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>➕ Create Project</span>
          </button>
        </div>

        {/* Modal Tab Content Area - Expanded to Fill Height */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 h-full">
          
          {/* TAB 1: PROJECT LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-3">
              <input 
                type="file" 
                ref={importFileRef} 
                onChange={handleBackupFileImport} 
                accept=".json,.sps" 
                className="hidden" 
              />

              {/* ALLOTTED LOCAL STORAGE VAULT BANNER */}
              <div className="p-3 rounded-xl border border-cyan-500/40 bg-cyan-950/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 shrink-0">
                    <FolderKanban className="w-4 h-4 text-cyan-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white font-sans flex items-center gap-2">
                      <span>📁 Allotted Local Storage Folder Vault</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
                        🔒 Auto-Persisted & Recoverable
                      </span>
                    </h4>
                    <p className="text-[11px] text-cyan-200/80 font-mono truncate max-w-xl">
                      {allottedFolder}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEditAllottedFolder}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-zinc-700 text-xs font-bold flex items-center gap-1 transition-all"
                    title="Change Allotted Storage Directory Path"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Path</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => importFileRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all"
                    title="Import & Restore .sps / .json Project Backup File from Local Folder"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Backup File</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-600 dark:text-zinc-400 font-mono">Select a project to switch, duplicate, backup, or manage:</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono flex items-center gap-1 shadow"
                >
                  <Plus className="w-3.5 h-3.5" /> New Project
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {projectLibrary.map((proj) => {
                  const isActive = currentProjectTitle === proj.title;
                  const isAllotted = checkIsProjectAllotted(proj.title);
                  return (
                    <div
                      key={proj.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        isActive
                          ? 'bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-400 dark:border-cyan-500/60 shadow-md'
                          : isAllotted
                            ? 'bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm'
                            : 'bg-slate-100/60 dark:bg-zinc-950/40 border-slate-200 dark:border-zinc-800/60 opacity-80'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {editingProjectId === proj.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleRenameProject(proj.id, renameInput);
                              }}
                              className="flex items-center gap-1.5"
                            >
                              <input
                                type="text"
                                value={renameInput}
                                onChange={(e) => setRenameInput(e.target.value)}
                                autoFocus
                                placeholder="ENTER PROJECT TITLE"
                                className="bg-slate-950 text-amber-300 font-bold border border-amber-400 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none shadow"
                              />
                              <button
                                type="submit"
                                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                                title="Save New Title"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProjectId(null)}
                                className="p-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          ) : (
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2 flex-wrap">
                              <span>{proj.title}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProjectId(proj.id);
                                  setRenameInput(proj.title);
                                }}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-amber-500 transition-all"
                                title="Rename Project Title"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {isActive && (
                                <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-300 dark:border-cyan-800 font-mono font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-cyan-600 dark:text-cyan-400" /> ACTIVE
                                </span>
                              )}
                              {!isActive && isAllotted && (
                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 font-mono font-bold flex items-center gap-1 shadow-sm" title={`Allotted access granted to ${getDynamicAllottedUsersForProject(proj.title)}`}>
                                  🟢 Allotted ({getDynamicAllottedUsersForProject(proj.title)})
                                </span>
                              )}
                              {isActive && isAllotted && (
                                <span className="text-[10px] bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 font-mono text-[10px] font-bold" title={`Allotted access granted to ${getDynamicAllottedUsersForProject(proj.title)}`}>
                                  👤 Allotted ({getDynamicAllottedUsersForProject(proj.title)})
                                </span>
                              )}
                              {!isAllotted && (
                                <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 font-mono font-bold flex items-center gap-1" title="Not allotted to your collaborator account">
                                  🔒 Locked (Not Allotted)
                                </span>
                              )}
                            </h4>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 font-mono">{proj.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-700 dark:text-zinc-300 pt-1">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">🎬 {proj.shots?.length || 0} Shots</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-cyan-700 dark:text-cyan-400">⚙️ {proj.targetModel ? proj.targetModel.replace(/Seedance/gi, 'SPS Direct Cinema').replace(/SeeDream/gi, 'SPS High Fidelity') : 'SPS Direct Cinema 2.0'}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-amber-700 dark:text-amber-400">📐 {proj.aspectRatio}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-emerald-700 dark:text-emerald-400">🔑 {proj.roomId}</span>
                          <span className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/60" title={`Allotted storage folder: ${allottedFolder}`}>📁 Vault Allotted</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => exportProjectPackageToFile(proj)}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 text-xs flex items-center gap-1 font-bold font-mono shadow"
                          title={`Export & Save ${proj.title} Backup Package (.sps.json) to Local Disk Folder`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save Backup</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isActive) handleSwitchProject(proj);
                            setCustomProjectTitle(proj.title);
                            setActiveTab('ai_breakdown');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-bold font-mono shadow flex items-center gap-1"
                          title={`Run AI Script Breakdown for ${proj.title}`}
                        >
                          <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                          <span>AI Script Breakdown</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingProjectId(proj.id);
                            setRenameInput(proj.title);
                          }}
                          className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs flex items-center gap-1 font-bold font-mono"
                          title="Rename Project Title"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {!isActive && isAllotted && (
                          <button
                            type="button"
                            onClick={() => handleSwitchProject(proj)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono shadow flex items-center gap-1"
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> Open
                          </button>
                        )}

                        {!isActive && !isAllotted && (
                          <button
                            type="button"
                            onClick={() => alert(`🔒 PROJECT ACCESS RESTRICTED:\n'${proj.title}' has not been allotted to your profile (${currentUserEmail}).\n\nPlease ask Primary Admin (pedditiram@gmail.com) to allot this project to your account in Admin Settings.`)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs font-mono shadow flex items-center gap-1 border border-zinc-700/50"
                            title={`🔒 Ask pedditiram@gmail.com to allot ${proj.title} in Admin Settings`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Locked
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDuplicateProject(proj)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs"
                          title="Duplicate Project"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(proj.id)}
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800/40 text-xs"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: AI SCRIPT BREAKDOWN (50/50 DUAL PANE DASHBOARD) */}
          {activeTab === 'ai_breakdown' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full font-mono">
              {/* LEFT PANE: Script Input & Controls */}
              <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between space-y-2.5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                      AI Screenplay Breakdown & Cinema Parser
                    </h4>
                    <label className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow">
                      <Upload className="w-3 h-3" />
                      <span>Upload File</span>
                      <input type="file" accept=".pdf,.txt,.fountain,.fdx" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>

                  {/* Sample Scripts Selector */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10.5px] text-slate-500 dark:text-zinc-400 font-bold shrink-0">Sample Scripts:</span>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                      {SAMPLE_SCRIPTS.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRawScriptText(sample.script)}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-cyan-600 dark:text-cyan-300 text-[10.5px] font-bold shrink-0 hover:border-cyan-400"
                        >
                          📄 {sample.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10.5px] text-slate-600 dark:text-zinc-400 font-bold block mb-1">Paste Screenplay Text:</label>
                    <textarea
                      rows={7}
                      value={rawScriptText}
                      onChange={(e) => setRawScriptText(e.target.value)}
                      placeholder="Paste scene description, screenplay sluglines (INT/EXT), or shot list..."
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-[11.5px] text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 leading-relaxed min-h-[140px] max-h-[240px] resize-y"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-slate-500 dark:text-zinc-400">
                      Engine: <strong className="text-cyan-600 dark:text-cyan-400 font-bold">Gemini 3.6 (25 Crafts)</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleParseScript}
                      disabled={isLoadingFile || !rawScriptText.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-zinc-950 font-black text-xs shadow flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      {isLoadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 fill-zinc-950" />}
                      <span>{isLoadingFile ? `Parsing (${parseProgress}%)...` : '⚡ Parse 25 Crafts Shots'}</span>
                    </button>
                  </div>

                  {/* Dynamic Thin Progress Bar Animation with Percentages */}
                  {(isLoadingFile || parseProgress > 0) && (
                    <div className="w-full space-y-1 pt-1 animate-fadeIn">
                      <div className="flex items-center justify-between text-[10.5px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 animate-spin text-amber-500" />
                          Analyzing 25 Crafts...
                        </span>
                        <span className="bg-cyan-500/10 text-cyan-500 px-1.5 py-0.5 rounded text-[10px]">{parseProgress}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden relative shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400 transition-all duration-200 ease-out rounded-full relative"
                          style={{ width: `${parseProgress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/40 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANE: Live 25-Craft Generated Breakdown Panel */}
              <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between h-full">
                {isGenerated && parsedPreview.length > 0 ? (
                  <div className="space-y-2 flex-1 flex flex-col">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Generated {parsedPreview.length} Shots (25 Crafts)
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyAIShotsToCurrent}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Apply to Studio
                      </button>
                    </div>

                    <div className="space-y-1.5 overflow-y-auto flex-1 max-h-[340px] pr-1">
                      {parsedPreview.map((s, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] space-y-1 hover:border-cyan-500/50 transition-all">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-1">
                            <span className="font-bold text-amber-600 dark:text-amber-300 font-mono text-xs">{s.sceneShotId}</span>
                            <span className="text-slate-500 dark:text-zinc-400 font-mono">{s.shotComposition}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10.5px]">
                            <span className="text-cyan-600 dark:text-cyan-400 font-mono truncate">🎥 {s.cameraMotionTag}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono truncate">💡 {s.subjectLightingTag}</span>
                          </div>
                          {s.characterIdMatrix && (
                            <div className="text-[10px] font-mono text-zinc-400 bg-zinc-900/60 p-1 rounded border border-zinc-800/60 truncate">
                              🎭 {s.characterIdMatrix}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 flex-1 my-auto">
                    <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
                      <Wand2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">Live 25-Craft Breakdown Preview</h5>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">
                        Paste your screenplay text on the left or select a sample script, then click <strong>⚡ Parse 25 Crafts Shots</strong> to preview generated breakdown entries.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SCRIPT GENRE & PRESETS */}
          {activeTab === 'genre' && (
            <div className="space-y-4 font-mono">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Script Genre Profile & 25 Crafts of Cinema Adaptation:
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                      Select, create, or edit production genre profiles below to auto-adapt all 24 crafts matrix slot preset parameters for your screenplay.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenGenreEditor(null)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-4 h-4" /> + Add New Genre
                    </button>
                    {Object.keys(customGenreProfiles).length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetGenresToDefault}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs flex items-center gap-1 transition-all"
                        title="Reset all genres back to studio default factory profiles"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Reset Defaults
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {Object.entries(mergedGenreProfiles).map(([key, profile]) => {
                    const isSelected = presetProfile === key;
                    const isCustom = Boolean(customGenreProfiles[key]);
                    return (
                      <div
                        key={key}
                        onClick={() => setPresetProfile && setPresetProfile(key)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all shadow-sm relative group ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/50'
                            : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-900 dark:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900 dark:text-amber-300">
                            {profile.label || profile.name}
                            {isCustom && (
                              <span className="text-[9px] bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                                Custom
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isSelected && (
                              <span className="text-[10px] bg-amber-500 text-zinc-950 font-black px-2 py-0.5 rounded-full">
                                ACTIVE
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenGenreEditor(key);
                              }}
                              className="p-1.5 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-slate-600 dark:text-zinc-300 hover:text-amber-500 transition-all flex items-center gap-1 text-[11px] font-bold"
                              title="Edit Genre Profile & Matrix Presets"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustomGenre(key, e)}
                                className="p-1.5 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-slate-400 hover:text-rose-500 transition-all"
                                title="Delete Custom Genre"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">{profile.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CREATE NEW PROJECT */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Project Setup Details:
                </h4>

                <div>
                  <label className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 font-bold block mb-1">Project Title:</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. KARA DHUSHAN WAR EPISODE 1..."
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 font-bold block mb-1">Description / Logline:</label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief scene context or film summary..."
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 font-bold block mb-1">Target Engine:</label>
                    <select
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                    >
                      <option value="SPS Direct Cinema">SPS Direct Cinema (Stage Production Studio)</option>
                      <option value="High Fidelity Physics">High Fidelity Dynamic Physics Engine</option>
                      <option value="Camera Motion Control">Camera Motion Control Engine</option>
                      <option value="Ultra Photoreal">Ultra Photoreal Global Cinema Engine</option>
                      <option value="Dynamic Rotations">Smooth Camera Motion Engine</option>
                      <option value="Keyframe 2K">2K High-Res Keyframe Generation Engine</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 font-bold block mb-1">Aspect Ratio:</label>
                    <select
                      value={newRatio}
                      onChange={(e) => setNewRatio(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                    >
                      <option value="2.39:1 Anamorphic">2.39:1 Cinema Anamorphic Widescreen</option>
                      <option value="16:9 Landscape">16:9 HDTV / Streaming Widescreen</option>
                      <option value="9:16 Vertical">9:16 Vertical Reel / Shorts Format</option>
                      <option value="4:3 IMAX Classic">4:3 Classic / IMAX Format</option>
                      <option value="1:1 Square">1:1 Square Format</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 font-bold block mb-1">Initial Shot Sequence Template:</label>
                  <select
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                  >
                    <option value="epic_war">⚔️ Mythological Epic War (Kara-Dhushan Sample)</option>
                    <option value="current">📋 Duplicate Active Project Shots</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono shadow flex items-center justify-center gap-1.5 transition-all mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Create & Launch Project
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: VERSIONING & SNAPSHOTS */}
          {activeTab === 'versions' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-500" />
                  Create Named Version Snapshot for "{currentProjectTitle}":
                </h4>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVersionName}
                    onChange={(e) => setNewVersionName(e.target.value)}
                    placeholder="e.g. v1.2 - Added SeeDream 5.0 2K Keyframes"
                    className="flex-1 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500 font-bold shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSnapshot}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono shadow shrink-0"
                  >
                    Save Snapshot
                  </button>
                </div>

                {versionSuccessMsg && (
                  <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-mono font-bold">
                    {versionSuccessMsg}
                  </div>
                )}
              </div>

              {/* Version History List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-300 font-mono">Version Timeline History:</h4>

                {projectLibrary.find(p => p.title === currentProjectTitle)?.versions?.map((ver, idx) => (
                  <div
                    key={ver.versionId || idx}
                    className="p-3 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs font-mono shadow-sm"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                        {ver.versionName}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">Created: {ver.createdAt} • {ver.shots?.length || 0} Shots</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestoreVersion(ver)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-cyan-700 dark:text-cyan-300 border border-slate-200 dark:border-zinc-700 text-xs font-bold font-mono shadow-sm flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 text-cyan-600 dark:text-cyan-400" /> Restore Snapshot
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SHARE & COLLAB */}
          {activeTab === 'share' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-500/40 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Cloud Sharing & Live Collaboration Room:
                </h4>

                <div>
                  <label className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 font-bold block mb-1">Active Cloud Room Code:</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-mono font-bold shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-700 dark:text-zinc-300 font-bold block mb-1">Public Shareable URL Link:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareableUrl}
                      className="flex-1 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 font-mono select-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono shadow flex items-center gap-1.5 shrink-0"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? 'Copied Link!' : 'Copy Share Link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-2.5 px-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-100/90 dark:bg-zinc-900/90 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 font-mono shrink-0">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Folder className="w-3.5 h-3.5 text-cyan-500" />
            Active Project: <strong className="text-slate-900 dark:text-white font-bold">{currentProjectTitle}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 text-xs font-bold transition-colors shadow-sm"
          >
            Close Console
          </button>
        </div>
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
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400"
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
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black font-mono shadow-md flex items-center gap-1.5"
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
