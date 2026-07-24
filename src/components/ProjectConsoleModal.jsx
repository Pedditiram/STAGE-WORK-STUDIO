import React, { useState, useEffect } from 'react';
import { 
  X, Folder, Plus, Copy, Check, Trash2, Edit3, Share2, History, Layers, 
  RefreshCw, FileText, Download, ExternalLink, ShieldAlert, Sparkles, 
  CheckCircle2, Clock, Globe, ArrowRight, Wand2, Upload, Loader2, FolderKanban, Sliders
} from 'lucide-react';
import { parseRawScriptToShots, generateScriptFromConcept, extractTextFromPDF } from '../services/aiScriptParser';
import { GENRE_PRESET_PROFILES } from '../constants/seedancePresets';

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
  initialTab = 'library'
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
        description: 'Primary stage production master project for SeeDance 2.0 & SeeDream 5.0',
        targetModel: targetModel || 'Seedance 2.0',
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

  // New Project Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newModel, setNewModel] = useState('Seedance 2.0');
  const [newRatio, setNewRatio] = useState('2.39:1 Anamorphic');
  const [newTemplate, setNewTemplate] = useState('epic_war');

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
  const [customProjectTitle, setCustomProjectTitle] = useState(currentProjectTitle || 'NEW CINEMA PROJECT');

  // Sync tab if initialTab updates on open
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Persist library changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_project_library', JSON.stringify(projectLibrary));
    }
  }, [projectLibrary]);

  if (!isOpen) return null;

  // Active project ID
  const activeProjectId = projectLibrary.find(p => p.title === currentProjectTitle)?.id || projectLibrary[0]?.id;

  // 1. SWITCH PROJECT
  const handleSwitchProject = (proj) => {
    if (setProjectTitle) setProjectTitle(proj.title);
    if (setTargetModel) setTargetModel(proj.targetModel);
    if (setAspectRatio) setAspectRatio(proj.aspectRatio);
    if (setShots) setShots(proj.shots);
    if (setRoomId && proj.roomId) setRoomId(proj.roomId);
    onClose();
  };

  // 2. CREATE NEW PROJECT
  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const projId = `proj_${Date.now()}`;
    const cleanTitle = newTitle.trim().toUpperCase();

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
    
    const autoTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_]/g, " ").trim().toUpperCase();
    setCustomProjectTitle(autoTitle);

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
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleApplyAIShotsToCurrent = () => {
    if (parsedPreview.length > 0) {
      if (setShots) setShots(parsedPreview);
      if (setProjectTitle && customProjectTitle) setProjectTitle(customProjectTitle);
      onClose();
    }
  };

  // 4. DUPLICATE PROJECT
  const handleDuplicateProject = (proj) => {
    const dupId = `proj_${Date.now()}`;
    const dupTitle = `${proj.title} (COPY)`;
    const dupObj = {
      ...proj,
      id: dupId,
      title: dupTitle,
      lastModified: new Date().toLocaleDateString()
    };
    setProjectLibrary(prev => [...prev, dupObj]);
  };

  // 5. DELETE PROJECT
  const handleDeleteProject = (projId) => {
    if (projectLibrary.length <= 1) {
      alert("Cannot delete the last remaining project. Create a new project first!");
      return;
    }
    if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md font-mono">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
              <FolderKanban className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
                Stage Production Studio Console & AI Intelligence
                <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-300 px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-800 font-mono font-bold">
                  {projectLibrary.length} Projects Saved
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">Unified management for Projects, AI Script Breakdown & Genre Presets.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Unified Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-900/50 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`px-3 py-2 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'library'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>📂 Projects Library</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai_breakdown')}
            className={`px-3 py-2 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'ai_breakdown'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4 text-amber-500" />
            <span>🪄 AI Script Breakdown</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('genre')}
            className={`px-3 py-2 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'genre'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>🎭 Script Genre ({GENRE_PRESET_PROFILES[presetProfile]?.name || presetProfile})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-2 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>➕ Create Project</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`px-3 py-2 text-xs font-bold font-mono border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'share'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>🔗 Cloud Share</span>
          </button>
        </div>

        {/* Modal Tab Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          
          {/* TAB 1: PROJECT LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-zinc-400 font-mono">Select a project to switch, duplicate, or manage:</span>
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
                  return (
                    <div
                      key={proj.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        isActive
                          ? 'bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-400 dark:border-cyan-500/60 shadow-md'
                          : 'bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                            {proj.title}
                            {isActive && (
                              <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-300 dark:border-cyan-800 font-mono font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-cyan-600 dark:text-cyan-400" /> ACTIVE
                              </span>
                            )}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 font-mono">{proj.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-700 dark:text-zinc-300 pt-1">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">🎬 {proj.shots?.length || 0} Shots</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-cyan-700 dark:text-cyan-400">⚙️ {proj.targetModel}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-amber-700 dark:text-amber-400">📐 {proj.aspectRatio}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-emerald-700 dark:text-emerald-400">🔑 {proj.roomId}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
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

                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => handleSwitchProject(proj)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono shadow flex items-center gap-1"
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> Open
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

          {/* TAB 2: AI SCRIPT BREAKDOWN */}
          {activeTab === 'ai_breakdown' && (
            <div className="space-y-4 font-mono">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-cyan-300 dark:border-cyan-500/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-amber-500" />
                      AI Screenplay Breakdown & Cinema Parser:
                    </h4>
                    <span className="text-[11px] bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-300 dark:border-amber-800/80 font-mono font-bold">
                      Target Project: {customProjectTitle || currentProjectTitle}
                    </span>
                  </div>
                  <label className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload PDF / TXT Script</span>
                    <input type="file" accept=".pdf,.txt,.fountain,.fdx" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                {/* Sample Scripts Selector */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-bold shrink-0">Sample Scripts:</span>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none">
                    {SAMPLE_SCRIPTS.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setRawScriptText(sample.script);
                          setCustomProjectTitle(sample.title.toUpperCase());
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-cyan-600 dark:text-cyan-300 text-[11px] font-bold shrink-0 hover:border-cyan-400 shadow-xs"
                      >
                        📄 {sample.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-bold block mb-1">Paste Raw Screenplay or Scene Script:</label>
                  <textarea
                    rows={6}
                    value={rawScriptText}
                    onChange={(e) => setRawScriptText(e.target.value)}
                    placeholder="Paste scene description, screenplay sluglines (INT/EXT), or shot list..."
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg p-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Parser Engine: <strong className="text-cyan-600 dark:text-cyan-400 font-bold">Built-In Cinema Intelligence (15-Slot Matrix Aware)</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleParseScript}
                    disabled={isLoadingFile || !rawScriptText.trim()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-zinc-950 font-black text-xs shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {isLoadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 fill-zinc-950" />}
                    <span>{isLoadingFile ? 'Parsing Script...' : '⚡ Generate 15-Slot Shots Breakdown'}</span>
                  </button>
                </div>
              </div>

              {/* Parsed Preview Results */}
              {isGenerated && parsedPreview.length > 0 && (
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-cyan-400/50 space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Generated {parsedPreview.length} Shot Entries:
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyAIShotsToCurrent}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" /> Apply to Current Project
                    </button>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {parsedPreview.map((s, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-amber-600 dark:text-amber-300 font-mono">{s.sceneShotId}</span>
                        <span className="text-slate-600 dark:text-zinc-300 truncate max-w-[200px]">{s.shotComposition}</span>
                        <span className="text-cyan-600 dark:text-cyan-400 font-mono truncate max-w-[180px]">{s.cameraMotionTag}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono truncate max-w-[180px]">{s.subjectLightingTag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SCRIPT GENRE & PRESETS */}
          {activeTab === 'genre' && (
            <div className="space-y-4 font-mono">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/40 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Script Genre Profile & 15-Slot Matrix Adaptation:
                </h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Select a production genre profile below to auto-adapt shot composition parameters, lighting tags, and character reference fields for your screenplay.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {Object.entries(GENRE_PRESET_PROFILES).map(([key, profile]) => {
                    const isSelected = presetProfile === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPresetProfile && setPresetProfile(key)}
                        className={`p-3.5 rounded-xl border text-left transition-all shadow-sm ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/50'
                            : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-900 dark:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900 dark:text-amber-300">
                            {profile.label || profile.name}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] bg-amber-500 text-zinc-950 font-black px-2 py-0.5 rounded-full">
                              ACTIVE GENRE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">{profile.description}</p>
                      </button>
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
                      <option value="Seedance 2.0">Seedance 2.0 (Direct Cinema Prompting)</option>
                      <option value="Sora 2">Sora 2 (High Fidelity Dynamic Physics)</option>
                      <option value="Runway Gen-3">Runway Gen-3 Alpha (Camera Motion Control)</option>
                      <option value="Kling 1.5">Kling 1.5 Pro (Realistic Asian/Global Faces)</option>
                      <option value="Luma Dream Machine">Luma Dream Machine (Smooth Camera Rotations)</option>
                      <option value="BytePlus Seedream 5.0">BytePlus Seedream 5.0 (2K Keyframe Generation)</option>
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
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 font-mono">
          <span>Active Project: <strong className="text-slate-900 dark:text-white font-bold">{currentProjectTitle}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 font-bold transition-colors shadow-sm"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
}
