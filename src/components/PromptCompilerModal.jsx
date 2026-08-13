import React, { useState, useEffect } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import { createZipArchive } from '../utils/zipUtils';
import { loadDirectorPsychology } from '../utils/directorPsychologyStorage';
import SaveCloseConfirmModal from './SaveCloseConfirmModal';
import { 
  X, Copy, Download, Check, Sparkles, Code, FileSpreadsheet, FileText, 
  Cpu, Image as ImageIcon, Disc, Film, FolderDown, FileCode, CheckCircle2, Grid, Archive, BookOpen,
  Maximize2, Minimize2, ExternalLink
} from 'lucide-react';
import { parseSceneAndShotID, formatShotIdForPrompt, formatShotFilename } from '../utils/sceneShotUtils';
import { compileMasterCinemaCompilerPrompt } from '../utils/compileMasterCinemaPrompt';

export default function PromptCompilerModal({
  isOpen,
  onClose,
  shots,
  onUpdateShot: _onUpdateShot, // retained for API compat; crafts are read-only — edit via Form
  activeTargetModel = "Stage Production Studio",
  projectTitle,
  onOpenWriterSynopsis,
  onEditShotInForm,
}) {
  const [formatMode, setFormatMode] = useState('seedance_tagged'); // Default to SPS Standard Tagged
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'single'
  const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState(null);
  const [editingShotIdx, setEditingShotIdx] = useState(null);
  const [activeCraftKey, setActiveCraftKey] = useState(null);
  const [isEscConfirmOpen, setIsEscConfirmOpen] = useState(false);

  const [scriptSynopsisSource, setScriptSynopsisSource] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_script_synopsis_source') || 'auto_llm';
    }
    return 'auto_llm';
  });

  const [writerCustomScriptSynopsis, setWriterCustomScriptSynopsis] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_writer_custom_script_synopsis') || '';
    }
    return '';
  });

  const [extractedMasterStory, setExtractedMasterStory] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_extracted_master_story') || '';
    }
    return '';
  });

  // Writer Console owns synopsis; refresh read-only status when Compiler opens
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    setScriptSynopsisSource(localStorage.getItem('sps_script_synopsis_source') || 'auto_llm');
    setWriterCustomScriptSynopsis(localStorage.getItem('sps_writer_custom_script_synopsis') || '');
    setExtractedMasterStory(localStorage.getItem('sps_extracted_master_story') || '');
  }, [isOpen]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [splitRatioMode, setSplitRatioMode] = useState('standard'); // 'standard' (35/65) | 'inverse' (65/35) | 'equal' (50/50)

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

  const [focusedShotIdx, setFocusedShotIdx] = useState(0);

  // Listen for Cmd+Enter (Full Screen), Esc (Normal View), Cmd+Down (Next Shot), Cmd+Up (Prev Shot)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreenMode();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          toggleFullscreenMode(false);
        } else {
          setIsEscConfirmOpen(true);
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
        e.preventDefault();
        setFocusedShotIdx((prev) => {
          const nextIdx = Math.min(prev + 1, shots.length - 1);
          const elem = document.getElementById(`compiler-shot-card-${nextIdx}`);
          if (elem) {
            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return nextIdx;
        });
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        setFocusedShotIdx((prev) => {
          const nextIdx = Math.max(prev - 1, 0);
          const elem = document.getElementById(`compiler-shot-card-${nextIdx}`);
          if (elem) {
            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return nextIdx;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, shots]);

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

// ============================================================================
// SMART TYPOGRAPHY PROMPT VIEWER
// Formats prompt headers, keyframe badges, section titles, and key-value pairs
// for maximum visual clarity and rapid scanning across light and dark themes.
// ============================================================================
const SmartFormattedPromptViewer = ({ content }) => {
  if (!content) return null;

  const lines = String(content).split('\n');

  // Strip leading emoji characters to avoid duplicate emoji rendering in badge UI
  const stripLeadingEmoji = (str) => {
    return str
      .replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{200D}\u{FE0F}\u{26A1}\u{2699}\u{2728}\s]+/u, '')
      .trim();
  };

  const renderKeyValueLine = (line) => {
    if (line.includes(' | ')) {
      const parts = line.split(' | ');
      return (
        <div className="flex flex-wrap gap-2 py-1 font-mono text-xs">
          {parts.map((p, pIdx) => {
            const eqIdx = p.indexOf('=');
            if (eqIdx !== -1) {
              const k = p.slice(0, eqIdx).trim();
              const v = p.slice(eqIdx + 1).trim();
              return (
                <span key={pIdx} className="bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700/90 px-2.5 py-1 rounded-lg text-[11px] shadow-sm">
                  <span className="text-cyan-800 dark:text-cyan-300 font-bold">{k}</span>
                  <span className="text-slate-500 dark:text-zinc-400 mx-1.5 font-bold">=</span>
                  <span className="text-amber-800 dark:text-amber-300 font-bold">{v}</span>
                </span>
              );
            }
            return <span key={pIdx} className="text-slate-900 dark:text-zinc-100 font-medium">{p}</span>;
          })}
        </div>
      );
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1 && !line.startsWith('===')) {
      const k = line.slice(0, eqIdx).trim();
      const v = line.slice(eqIdx + 1).trim();
      return (
        <div className="py-1 font-mono text-xs flex flex-wrap items-baseline gap-2 pl-2.5 border-l-2 border-cyan-600 dark:border-cyan-500/50 my-1 bg-cyan-50 dark:bg-cyan-950/40 rounded-r-lg">
          <span className="text-cyan-800 dark:text-cyan-300 font-bold shrink-0">{k}</span>
          <span className="text-slate-500 dark:text-zinc-400 font-bold">=</span>
          <span className="text-slate-900 dark:text-zinc-100 font-semibold">{v}</span>
        </div>
      );
    }

    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
      const trimmed = line.trim().replace(/^[•-]\s*/, '');
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        const k = trimmed.slice(0, colonIdx).trim();
        const v = trimmed.slice(colonIdx + 1).trim();
        return (
          <div className="py-1.5 font-mono text-xs flex items-start gap-2.5 pl-3 border-l-2 border-purple-600 dark:border-purple-500/60 my-1 bg-purple-50 dark:bg-purple-950/50 rounded-r-xl">
            <span className="text-purple-700 dark:text-purple-300 text-sm leading-none shrink-0 mt-0.5">•</span>
            <div>
              <span className="text-purple-900 dark:text-purple-200 font-bold tracking-wide">{k}: </span>
              <span className="text-slate-900 dark:text-zinc-100 leading-relaxed font-semibold">{v}</span>
            </div>
          </div>
        );
      }
      return (
        <div className="py-1 font-mono text-xs flex items-start gap-2 pl-3">
          <span className="text-amber-700 dark:text-amber-400 font-bold">•</span>
          <span className="text-slate-900 dark:text-zinc-100 font-semibold">{trimmed}</span>
        </div>
      );
    }

    const colonMatch = line.match(/^([A-Za-z0-9_\s&\/\-]{2,25}):\s*(.*)$/);
    if (colonMatch && !line.startsWith('http') && !line.startsWith('===') && !line.startsWith('[')) {
      const [, k, v] = colonMatch;
      return (
        <div className="py-0.5 font-mono text-xs leading-relaxed">
          <span className="text-amber-800 dark:text-amber-400 font-bold">{k}: </span>
          <span className="text-slate-900 dark:text-zinc-100 font-semibold">{v}</span>
        </div>
      );
    }

    return <div className="py-0.5 font-mono text-xs text-slate-950 dark:text-zinc-100 font-semibold leading-relaxed select-all">{line}</div>;
  };

  return (
    <div className="space-y-1.5 select-all font-mono bg-white dark:bg-zinc-950 p-4.5 rounded-2xl text-slate-950 dark:text-zinc-100 border border-slate-300 dark:border-zinc-800 shadow-md">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        if (trimmed.startsWith('===')) {
          const cleanTitle = trimmed.replace(/^=+\s*/, '').replace(/\s*=+$/, '');
          return (
            <div 
              key={idx} 
              className="my-4 py-3 px-4 bg-slate-100 dark:bg-gradient-to-r dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 border-l-4 border-cyan-600 dark:border-cyan-400 rounded-r-2xl shadow-md flex items-center justify-between font-sans border-y border-r border-slate-300 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 dark:bg-cyan-400 animate-pulse shadow-sm" />
                <span className="text-cyan-900 dark:text-cyan-300 font-black text-xs sm:text-sm uppercase tracking-wider">
                  {cleanTitle}
                </span>
              </div>
            </div>
          );
        }

        if (trimmed.includes('[FIRST FRAME') || trimmed.includes('[FRAME 0') || trimmed.includes('BEAT 1')) {
          return (
            <div 
              key={idx} 
              className="mt-3.5 mb-2 px-3.5 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/60 text-emerald-900 dark:text-emerald-300 font-sans font-black text-xs flex items-center gap-2.5 shadow-sm"
            >
              <span className="text-base">🖼️</span>
              <span className="tracking-wide text-emerald-950 dark:text-emerald-200">{stripLeadingEmoji(trimmed)}</span>
            </div>
          );
        }

        if (trimmed.includes('[LAST FRAME') || trimmed.includes('[FRAME N') || trimmed.includes('BEAT 3')) {
          return (
            <div 
              key={idx} 
              className="mt-3.5 mb-2 px-3.5 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-500/60 text-amber-900 dark:text-amber-300 font-sans font-black text-xs flex items-center gap-2.5 shadow-sm"
            >
              <span className="text-base">🏁</span>
              <span className="tracking-wide text-amber-950 dark:text-amber-200">{stripLeadingEmoji(trimmed)}</span>
            </div>
          );
        }

        if (trimmed.includes('[DYNAMIC VIDEO GENERATION') || trimmed.includes('[VIDEO GENERATION')) {
          return (
            <div 
              key={idx} 
              className="mt-4 mb-2.5 px-4 py-2.5 rounded-xl bg-cyan-900 dark:bg-gradient-to-r dark:from-cyan-950 dark:via-blue-950 dark:to-indigo-950 border border-cyan-700 dark:border-cyan-400/60 text-white font-sans font-extrabold text-xs flex items-center gap-2.5 shadow-md"
            >
              <span className="text-lg">🎥</span>
              <span className="tracking-wide text-white dark:text-cyan-100">{stripLeadingEmoji(trimmed)}</span>
            </div>
          );
        }

        if (
          trimmed.startsWith('Script Synopsis:') || 
          trimmed.startsWith('Scene Synopsis:') ||
          trimmed.startsWith('Character Bible:') ||
          trimmed.startsWith('CHARACTER BIBLE') ||
          trimmed.startsWith('Extract of Character Bible')
        ) {
          return (
            <div key={idx} className="mt-4 mb-2 px-3.5 py-2.5 rounded-xl bg-purple-100 dark:bg-purple-950 border border-purple-300 dark:border-purple-500/60 text-purple-950 dark:text-purple-200 font-sans font-bold text-xs flex items-center gap-2.5 shadow-sm">
              <span className="text-base">📖</span>
              <span className="tracking-wide text-purple-950 dark:text-purple-100">{stripLeadingEmoji(trimmed)}</span>
            </div>
          );
        }

        if (
          trimmed.includes('MOTION & ACTION PROGRESSION') || 
          trimmed.includes('CAMERA KINEMATICS') || 
          trimmed.includes('ATMOSPHERE & DYNAMICS') || 
          trimmed.includes('CONDITIONING BINDINGS') ||
          trimmed.startsWith('Extract PROMPT') ||
          trimmed.startsWith('Prompt:') ||
          trimmed.startsWith('PROMPT:') ||
          trimmed.startsWith('Character ID:')
        ) {
          return (
            <div key={idx} className="mt-4 mb-1.5 pt-2.5 border-t border-slate-300 dark:border-zinc-800 text-amber-800 dark:text-amber-400 font-sans font-black text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="text-amber-800 dark:text-amber-300">{stripLeadingEmoji(trimmed)}</span>
            </div>
          );
        }

        return <div key={idx}>{renderKeyValueLine(line)}</div>;
      })}
    </div>
  );
};

  if (!isOpen) return null;

  const compileTaggedFormat = (shot) => {
    const muted = shot?.mutedSlots || {};
    return SEEDANCE_SLOTS
      .filter(slot => !muted[slot.key])
      .map(slot => shot[slot.key])
      .filter(Boolean)
      .join(' | ');
  };

  const compileSeedanceDirectFormat = (shot, shotIdx) => {
    const parsedId = parseSceneAndShotID(shot, shotIdx);
    const shotId = parsedId.shortId;
    const framing = shot.shotComposition || 'Medium Shot';
    const motion = (shot.cameraMotionTag || 'Tracking Shot').replace(/\[Camera:\s*/, '').replace(/\]/, '');
    const lighting = (shot.subjectLightingTag || 'Golden Hour').replace(/\[|\]/g, '');
    const color = (shot.subjectColorTag || 'Vibrant Cinema').replace(/\[|\]/g, '');
    const env = shot.actionEnvContext || 'Sankranti fight arena';

    // Parse and resolve Image_1 to Image_9 bindings cleanly
    const rawImagesStr = shot.shotDurationAndImages || '';
    const durationMatch = rawImagesStr.match(/Duration:\s*([\d\.-]+s?)/i);
    const duration = durationMatch ? durationMatch[1] : '5.0s';

    const imagePairs = [];
    const pairMatches = rawImagesStr.matchAll(/Image_(\d+):\s*(@[A-Za-z0-9_]+)/g);
    for (const match of pairMatches) {
      const imgNum = match[1];
      const tag = match[2];
      let desc = tag.replace('@', '').replace(/_/g, ' ');
      imagePairs.push(`  • Image_${imgNum}: ${tag} (${desc})`);
    }

    if (imagePairs.length === 0) {
      if (shot.characterIdAssetRef) imagePairs.push(`  • Image_1: @PrimarySubject (${shot.characterIdAssetRef})`);
      if (shot.coArtistInteraction) imagePairs.push(`  • Image_2: @CoArtist (${shot.coArtistInteraction})`);
      imagePairs.push(`  • Image_3: @Environment (${env})`);
    }

    const resolvedImageHeader = imagePairs.join('\n');

    // Inject character Bible backstory & persona dynamics if tag is present
    let characterBibleNotes = '';
    try {
      const storedCharsStr = localStorage.getItem('sps_character_bible_vault');
      if (storedCharsStr) {
        const charProfiles = JSON.parse(storedCharsStr);
        if (Array.isArray(charProfiles)) {
          charProfiles.forEach(char => {
            if (char.tag && (shot.characterIdAssetRef || '').includes(char.tag)) {
              const traits = [];
              if (char.backstory) traits.push(`Story: ${char.backstory}`);
              if (char.characterConnections) traits.push(`Connections: ${char.characterConnections}`);
              if (char.shotPurpose) traits.push(`Shot Purpose: ${char.shotPurpose}`);
              if (char.mannerism) traits.push(`Mannerism: ${char.mannerism}`);
              if (char.walkingStyle) traits.push(`Gait/Walking: ${char.walkingStyle}`);
              if (char.dialogueDelivery) traits.push(`Delivery: ${char.dialogueDelivery}`);
              if (char.uniqueVoice) traits.push(`Voice: ${char.uniqueVoice}`);
              if (traits.length > 0) {
                characterBibleNotes += ` [${char.tag} Character Persona & Shot Purpose: ${traits.join(' | ')}]`;
              }
            }
          });
        }
      }
    } catch (e) {}

    // Build ultra-clean cinematic Seedance prompt text with explicit @Tag bindings
    let promptNarrative = `A cinematic ${framing.toLowerCase()} (${shotId}). Duration: ${duration}. `;
    if (shot.actionEnvContext) promptNarrative += `Environment: ${shot.actionEnvContext}. `;
    if (characterBibleNotes) promptNarrative += `[Character & Story: ${characterBibleNotes.trim()}]. `;
    if (shot.characterIdAssetRef) promptNarrative += `Featuring ${shot.characterIdAssetRef}. `;
    if (shot.coArtistInteraction) promptNarrative += `Co-artist: ${shot.coArtistInteraction}. `;
    if (motion) promptNarrative += `The camera moves with ${motion}. `;
    if (lighting) promptNarrative += `Lighting styled with ${lighting}. `;
    if (color) promptNarrative += `Color graded in ${color}. `;
    if (shot.atmosphereVolumetricsTag) promptNarrative += `Atmosphere: ${shot.atmosphereVolumetricsTag.replace(/\[|\]/g, '')}. `;
    if (shot.characterMovement) promptNarrative += `Action performance: ${shot.characterMovement}. `;
    if (shot.characterExpression) promptNarrative += `Facial expression: ${shot.characterExpression}. `;
    if (shot.characterDialogue) promptNarrative += `Vocal sync: ${shot.characterDialogue}. `;

    return `[DIRECT CINEMA CONDITIONING PROMPT - SHOT #${shotIdx + 1} (${shotId})]
Shot: ${framing} | Duration: ${duration}
Resolved Image Inputs:
${resolvedImageHeader}

Prompt Text:
${promptNarrative.trim()}`;
  };

  const compileComfyUISeedanceFormat = (shot, shotIdx) => {
    const { masterCinemaPrompt } = compileMasterCinemaCompilerPrompt(shot, shotIdx, {
      projectTitle,
      scriptSynopsisSource,
      writerCustomScriptSynopsis
    });
    return masterCinemaPrompt;
  };

  const compileSoraFormat = (shot) => {
    const parts = [];
    parts.push(`A cinematic ${shot.shotComposition ? shot.shotComposition.toLowerCase() : 'shot'} (${shot.sceneShotId || 'SC01_SH01'}).`);
    if (shot.characterIdAssetRef) parts.push(`Featuring ${shot.characterIdAssetRef}.`);
    if (shot.actionEnvContext) parts.push(`Environment: ${shot.actionEnvContext}.`);
    if (shot.timeAndLightingEnv) parts.push(`Weather & Time Setup: ${shot.timeAndLightingEnv}.`);
    if (shot.directionalLightingAndHighlight) parts.push(`Light Angle & Highlight: ${shot.directionalLightingAndHighlight}.`);
    if (shot.cameraMotionTag) parts.push(`The camera moves with ${shot.cameraMotionTag.replace(/\[|\]/g, '')}.`);
    if (shot.subjectLightingTag) parts.push(`Lighting is styled with ${shot.subjectLightingTag.replace(/\[|\]/g, '')}.`);
    if (shot.subjectColorTag) parts.push(`Color graded in ${shot.subjectColorTag.replace(/\[|\]/g, '')}.`);
    if (shot.atmosphereVolumetricsTag) parts.push(`Atmosphere: ${shot.atmosphereVolumetricsTag.replace(/\[|\]/g, '')}.`);
    if (shot.coArtistInteraction) parts.push(`Interaction: ${shot.coArtistInteraction.replace(/\[|\]/g, '')}.`);
    if (shot.characterMovement) parts.push(`The artist performs by ${shot.characterMovement.toLowerCase()}.`);
    if (shot.characterExpression) parts.push(`Facial expression shows ${shot.characterExpression}.`);
    if (shot.characterDialogue) parts.push(`Vocal sync: ${shot.characterDialogue}.`);
    if (shot.shotDurationAndImages) parts.push(`[Input Assets & Duration: ${shot.shotDurationAndImages}].`);
    return parts.join(' ');
  };

  const compileRunwayFormat = (shot) => {
    const flags = [];
    if (shot.cameraMotionTag) flags.push(`${shot.cameraMotionTag}`);
    if (shot.shotComposition) flags.push(`--shot "${shot.shotComposition}"`);
    if (shot.characterIdAssetRef) flags.push(`--subject "${shot.characterIdAssetRef}"`);
    if (shot.characterMovement) flags.push(`--action "${shot.characterMovement}"`);
    if (shot.coArtistInteraction) flags.push(`--co-artist "${shot.coArtistInteraction}"`);
    if (shot.timeAndLightingEnv) flags.push(`--weather_time "${shot.timeAndLightingEnv}"`);
    if (shot.directionalLightingAndHighlight) flags.push(`--light_direction "${shot.directionalLightingAndHighlight}"`);
    if (shot.subjectLightingTag) flags.push(`--lighting "${shot.subjectLightingTag}"`);
    if (shot.subjectColorTag) flags.push(`--color "${shot.subjectColorTag}"`);
    return flags.join(' ');
  };

  const compileLumaFormat = (shot) => {
    const parts = [];
    if (shot.cameraMotionTag) parts.push(`${shot.cameraMotionTag.replace(/\[Camera:\s*/, '').replace(/\]/, '')} camera motion on`);
    if (shot.characterIdAssetRef) parts.push(shot.characterIdAssetRef);
    if (shot.shotComposition) parts.push(shot.shotComposition);
    if (shot.characterMovement) parts.push(shot.characterMovement);
    if (shot.actionEnvContext) parts.push(`in ${shot.actionEnvContext}`);
    if (shot.subjectLightingTag) parts.push(shot.subjectLightingTag);
    return parts.join(', ');
  };

  const compileKlingFormat = (shot) => {
    const tags = ['Masterpiece', 'cinematic 8k resolution', 'photorealistic'];
    if (shot.sceneShotId) tags.push(shot.sceneShotId);
    if (shot.shotComposition) tags.push(shot.shotComposition);
    if (shot.characterIdAssetRef) tags.push(shot.characterIdAssetRef);
    if (shot.cameraMotionTag) tags.push(shot.cameraMotionTag);
    if (shot.subjectLightingTag) tags.push(shot.subjectLightingTag);
    if (shot.subjectColorTag) tags.push(shot.subjectColorTag);
    if (shot.coArtistInteraction) tags.push(shot.coArtistInteraction);
    if (shot.actionEnvContext) tags.push(shot.actionEnvContext);
    return tags.join(', ');
  };

  const compileMiniMaxFormat = (shot) => {
    const parts = [];
    parts.push(`[MiniMax Engine]`);
    if (shot.cameraMotionTag) parts.push(`Camera Movement: ${shot.cameraMotionTag.replace(/\[|\]/g, '')}.`);
    if (shot.shotComposition) parts.push(`Framing: ${shot.shotComposition}.`);
    if (shot.characterIdAssetRef) parts.push(`Subject: ${shot.characterIdAssetRef}.`);
    if (shot.coArtistInteraction) parts.push(`Co-Artist Reaction: ${shot.coArtistInteraction}.`);
    if (shot.subjectLightingTag) parts.push(`Lighting: ${shot.subjectLightingTag}.`);
    if (shot.actionEnvContext) parts.push(`Scene Environment: ${shot.actionEnvContext}.`);
    return parts.join(' ');
  };

  const compileBytePlusFormat = (shot) => {
    const parts = [];
    parts.push(`[BytePlus Engine]`);
    if (shot.shotComposition) parts.push(`--shot_type "${shot.shotComposition}"`);
    if (shot.cameraMotionTag) parts.push(`--camera_motion "${shot.cameraMotionTag}"`);
    if (shot.characterIdAssetRef) parts.push(`--main_subject "${shot.characterIdAssetRef}"`);
    if (shot.coArtistInteraction) parts.push(`--co_artist_interaction "${shot.coArtistInteraction}"`);
    if (shot.subjectLightingTag) parts.push(`--lighting_style "${shot.subjectLightingTag}"`);
    if (shot.actionEnvContext) parts.push(`--scene_description "${shot.actionEnvContext}"`);
    return parts.join(' ');
  };

  const compileSeeDreamFormat = (shot) => {
    const tags = ['masterpiece epic visual illustration', 'ultra-detailed 8k photorealistic render'];
    if (shot.shotComposition) tags.push(`cinematic ${shot.shotComposition.toLowerCase()}`);
    if (shot.characterIdAssetRef) tags.push(shot.characterIdAssetRef.replace(/\[CharID:\s*/, '').replace(/\]/, ''));
    if (shot.coArtistInteraction) tags.push(shot.coArtistInteraction.replace(/\[Co-Artist:\s*/, '').replace(/\]/, ''));
    if (shot.actionEnvContext) tags.push(shot.actionEnvContext);
    if (shot.subjectLightingTag) tags.push(shot.subjectLightingTag.replace(/\[|\]/g, ''));
    if (shot.subjectColorTag) tags.push(shot.subjectColorTag.replace(/\[|\]/g, ''));
    if (shot.backgroundLightingTag) tags.push(shot.backgroundLightingTag.replace(/\[|\]/g, ''));
    if (shot.backgroundColorTag) tags.push(shot.backgroundColorTag.replace(/\[|\]/g, ''));
    if (shot.characterExpression) tags.push(`expression: ${shot.characterExpression}`);
    if (shot.characterMovement) tags.push(`pose: ${shot.characterMovement}`);
    tags.push('no blur, highly detailed fabric and skin texture, volumetric lighting, 8k resolution');
    return tags.join(', ');
  };

  const compileSeeDreamBeatBreakdown = (shot, shotIdx) => {
    const shotId = parseSceneAndShotID(shot, shotIdx).shortId;
    const artist = (shot.characterIdAssetRef || '@LeadArtist').replace(/\[CharID:\s*/, '').replace(/\]/, '');
    const coArtist = (shot.coArtistInteraction || 'co-artist reacting').replace(/\[Co-Artist:\s*/, '').replace(/\]/, '');
    const framing = shot.shotComposition || 'Medium Shot';
    const motion = (shot.cameraMotionTag || 'Tracking Shot').replace(/\[Camera:\s*/, '').replace(/\]/, '');
    const lighting = (shot.subjectLightingTag || 'Cinematic Lighting').replace(/\[|\]/g, '');
    const color = (shot.subjectColorTag || 'Teal & Orange').replace(/\[|\]/g, '');
    const env = shot.actionEnvContext || 'concert stage';
    const dialogue = shot.characterDialogue && !shot.characterDialogue.includes('Silent') ? shot.characterDialogue : null;

    const beat1 = `masterpiece 8k render, KEYFRAME 1 (BEAT 0.0s - Establishing Stance), ${framing}, ${artist} standing at starting position, ${env}, ${lighting}, ${color}, static establishing keyframe, crisp focus, extreme detail, 8k`;
    const beat2 = `masterpiece 8k render, KEYFRAME 2 (BEAT 1.5s - Motion Peak), ${framing}, ${artist} executing ${shot.characterMovement || 'dynamic performance movement'}, ${motion} vector blur, ${coArtist}, dynamic action pose, intense energy, ${lighting}, 8k`;
    const beat3 = `masterpiece 8k render, KEYFRAME 3 (BEAT 3.5s - Emotional Climax), Extreme Close-Up, ${artist} expression: ${shot.characterExpression || 'intense passion'}, ${dialogue ? `vocal mouth open singing ${dialogue}` : 'eyes locked onto camera'}, ${coArtist} reacting in background, climax keyframe, 8k resolution`;

    return `=== SPS PRODUCTION PROMPT -> BEAT BREAKDOWN (SHOT #${shotIdx + 1} - ${shotId}) ===
⚡ [BEAT 1 @ 0.0s - Establishing Keyframe]:
${beat1}

🔥 [BEAT 2 @ 1.5s - Peak Motion & Co-Artist Reaction Keyframe]:
${beat2}

💥 [BEAT 3 @ 3.5s - Climax & Vocal Sync Keyframe]:
${beat3}`;
  };

  const compileFirstLastFrameFormat = (shot, shotIdx) => {
    const parsedId = parseSceneAndShotID(shot, shotIdx);
    const shotId = parsedId.shortId;
    const scShNumber = parsedId.formattedId;

    const cleanClause = (str) => String(str || '').replace(/\[(?:CharID|Co-Artist|Camera):\s*/gi, '').replace(/\[|\]/g, '').trim().replace(/[.,;]+$/, '').trim();
    const cleanSentence = (str) => {
      let s = String(str || '').trim().replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').replace(/\,\s*\,/g, ',').replace(/\.\s*\,/g, '.').replace(/\,\s*\./g, '.').trim();
      return s;
    };

    const artist = cleanClause(shot.characterIdAssetRef || '@LeadSubject');
    const coArtist = cleanClause(shot.coArtistInteraction);
    const framing = cleanClause(shot.shotComposition || 'Medium Shot');
    const motion = cleanClause(shot.cameraMotionTag || 'Tracking Shot');
    const lighting = cleanClause(shot.subjectLightingTag || 'Cinematic Lighting');
    const color = cleanClause(shot.subjectColorTag || 'Vibrant Cinema');
    const bgLighting = cleanClause(shot.backgroundLightingTag || 'Ambient Fill');
    const bgColor = cleanClause(shot.backgroundColorTag || 'Muted Slate');
    const env = cleanClause(shot.actionEnvContext || 'Dramatic stage environment');
    const atmosphere = cleanClause(shot.atmosphereVolumetricsTag || 'Atmospheric Haze & Depth');
    const action = cleanClause(shot.characterMovement || 'dynamic performance movement');
    const expression = cleanClause(shot.characterExpression || 'intense dramatic focus');
    const dialogue = (shot.characterDialogue && !shot.characterDialogue.includes('N/A')) ? cleanSentence(shot.characterDialogue.replace(/"/g, '')) : '';

    // Duration extraction
    let duration = '4s';
    if (shot.shotDurationAndImages) {
      const match = String(shot.shotDurationAndImages).match(/(?:Duration:\s*|Duration\s*=|\b)(\d+(?:\.\d+)?\s*s|\d+\s*sec|\d+\s*seconds?)/i);
      if (match) {
        duration = match[1].trim();
      } else if (typeof shot.shotDurationAndImages === 'string' && shot.shotDurationAndImages.trim()) {
        const firstToken = shot.shotDurationAndImages.trim().split('|')[0].trim();
        duration = firstToken.startsWith('Duration:') ? firstToken.replace('Duration:', '').trim() : firstToken;
      }
    }

    // 1. FIRST FRAME (IMAGE_1 / STARTING KEYFRAME) PROMPT
    const firstFrame = `[FIRST FRAME - STARTING KEYFRAME (t = 0.0s) - IMAGE_1 PROMPT]:
masterpiece 8k photorealistic render, ${framing} (${scShNumber}), ${artist} positioned at opening starting stance, ${env}, ${lighting}, ${color}, background: ${bgLighting}, ${bgColor}, atmosphere: ${atmosphere}, static establishing initial keyframe, crisp optics, sharp focus, 8k resolution`;

    // 2. LAST FRAME (IMAGE_2 / ENDING KEYFRAME) PROMPT
    const lastFrame = `[LAST FRAME - ENDING KEYFRAME (t = ${duration}) - IMAGE_2 PROMPT]:
masterpiece 8k photorealistic render, ${framing} (${scShNumber}) with terminal camera offset, ${artist} executing ${action}, expression: ${expression} at peak intensity, ${coArtist ? `interacting with ${coArtist}, ` : ''}${env}, resolved lighting: ${lighting}, atmosphere: ${atmosphere}, terminal resolving keyframe, cinematic motion blur, sharp focus, 8k resolution`;

    // 3. DYNAMIC VIDEO GENERATION PROMPT (THE VIDEO CONDITIONING PROMPT)
    const videoPrompt = `[DYNAMIC VIDEO GENERATION PROMPT]:
A fluid, hyper-cinematic ${duration} AI video motion sequence transitioning seamlessly from Image_1 (First Frame) to Image_2 (Last Frame) (${scShNumber}).

🎬 MOTION & ACTION PROGRESSION:
Starting from Image_1 with ${artist} in ${framing}, ${artist} fluidly transitions into ${action}, expressing ${expression}. ${coArtist ? `Simultaneously interacting with ${coArtist}.` : ''} ${dialogue ? `Vocal delivery: "${dialogue}".` : ''}

🎥 CAMERA KINEMATICS & OPTICS:
The camera executes a ${motion} with ${shot.lensAndFocalLength || '35mm Anamorphic Prime optics'}, smooth temporal motion blur, tracking focus on ${artist}.

✨ ATMOSPHERE & DYNAMICS:
${atmosphere}. ${shot.soundFxAndFoley ? `Foley/Sound sync: ${cleanClause(shot.soundFxAndFoley)}.` : ''}

⚙️ VIDEO CONDITIONING BINDINGS:
Image_1 = [First Frame / Starting Keyframe t=0.0s]
Image_2 = [Last Frame / Ending Keyframe t=${duration}]
Image_3 = [${artist} Primary Asset Ref]
${coArtist ? `Image_4 = [${coArtist}]` : `Image_4 = [${env} Scene Ref]`}
Camera_Motion = "${motion}" | Interpolation_Mode = "Keyframe Morph & Motion Arc" | Frame_Rate = 24fps | Duration = ${duration}`;

    return `=== FIRST & LAST FRAME VIDEO SUITE: SHOT #${shotIdx + 1} (${shotId}) ===

${firstFrame}

${lastFrame}

${videoPrompt}`;
  };

  const compileEngineSpecific = (shot, idx) => {
    return compileSeedanceDirectFormat(shot, idx);
  };

  const compileCharacterStoryVaultFormat = (shot, shotIdx) => {
    const shotId = parseSceneAndShotID(shot, shotIdx).shortId;
    const framing = shot.shotComposition || 'Medium Shot';
    
    // Extract duration (default 4s)
    let duration = '4s';
    if (shot.shotDurationAndImages) {
      const match = String(shot.shotDurationAndImages).match(/(?:Duration:\s*|Duration\s*=|\b)(\d+(?:\.\d+)?\s*s|\d+\s*sec|\d+\s*seconds?)/i);
      if (match) {
        duration = match[1].trim();
      } else if (typeof shot.shotDurationAndImages === 'string' && shot.shotDurationAndImages.trim()) {
        const firstToken = shot.shotDurationAndImages.trim().split('|')[0].trim();
        duration = firstToken.startsWith('Duration:') ? firstToken.replace('Duration:', '').trim() : firstToken;
      }
    }

    // 1. OVERALL SCRIPT STORY CONTEXT (Synthesized from script shots for Model Memory & Consistency)
    const overallScriptStoryContext = `OVERALL SCRIPT STORY CONTEXT (GLOBAL CINEMA MEMORY):
Project Title: ${projectTitle || 'STAGE PRODUCTION STUDIO FILM'}
Script Summary: Act 1-3 narrative sequence depicting the epic conflict of ${projectTitle || 'this production'}. Scene beats transition seamlessly across environment: ${shot.actionEnvContext || 'Panchavati forest clearing'}.`;

    // 2. CHARACTER BIBLE (PER PERSONA PROFILE & TRAITS)
    let charBibleBlock = '';
    try {
      const stored = localStorage.getItem('sps_character_bible_vault');
      if (stored) {
        const profiles = JSON.parse(stored);
        if (Array.isArray(profiles)) {
          profiles.forEach(c => {
            if (c.tag && (shot.characterIdAssetRef || '').includes(c.tag)) {
              charBibleBlock += `[CHARACTER BIBLE PROFILE - ${c.name} (${c.tag})]\n`;
              charBibleBlock += `• Character Backstory: ${c.backstory || 'N/A'}\n`;
              charBibleBlock += `• Mannerisms & Body Ticks: ${c.mannerism || 'N/A'}\n`;
              charBibleBlock += `• Walking Style & Gait: ${c.walkingStyle || 'N/A'}\n`;
              charBibleBlock += `• Dialogue Style & Voice: ${c.uniqueVoice || 'N/A'} | ${c.dialogueDelivery || 'N/A'}\n`;
              charBibleBlock += `• Signature Outfit & Props: ${c.outfit || 'N/A'}\n\n`;
            }
          });
        }
      }
    } catch (e) {}

    if (!charBibleBlock) {
      charBibleBlock = `[CHARACTER BIBLE PROFILE]: ${shot.characterIdAssetRef || 'Generic Subject'}\n• Character Backstory: Persona defined in script shot.\n\n`;
    }

    // 3. SCRIPT SCENE & SHOT STORY (SPECIFIC SCENE BEAT & CHARACTER PURPOSE)
    let scriptSceneStoryBlock = `[SCRIPT SCENE & SHOT STORY BEAT]:
• Scene Location & Action Context: ${shot.actionEnvContext || 'N/A'}
• Character Scene Connections: ${shot.coArtistInteraction || 'N/A'}
• Dramatic Shot Presence & Purpose: Character anchors the emotional focus and action beat of Shot #${shotIdx + 1} (${shotId}).
• Artist Performance & Expression: Action: ${shot.characterMovement || 'N/A'} | Expression: ${shot.characterExpression || 'N/A'} | Dialogue: ${shot.characterDialogue || 'N/A'}`;

    const mainPrompt = compileSeedanceDirectFormat(shot, shotIdx);

    return `=== STAGE PRODUCTION STUDIO COMPILER: SHOT #${shotIdx + 1} (${shotId}) ===

${overallScriptStoryContext}

${charBibleBlock.trim()}

${scriptSceneStoryBlock}

CHARACTER ID : ${shot.characterIdAssetRef || 'N/A'}
SHOT DURATION : ${duration}

FINAL VIDEO CONDITIONING PROMPT :
${mainPrompt}`;
  };

  const getShotPromptText = (shot, idx) => {
    if (formatMode === 'character_story_vault') return compileCharacterStoryVaultFormat(shot, idx);
    if (formatMode === 'comfyui_seedance') return compileComfyUISeedanceFormat(shot, idx);
    if (formatMode === 'engine_optimized') return compileComfyUISeedanceFormat(shot, idx);
    if (formatMode === 'first_last_frame') return compileFirstLastFrameFormat(shot, idx);
    if (formatMode === 'seedream_beat_breakdown') return compileSeeDreamBeatBreakdown(shot, idx);
    if (formatMode === 'seedream_image') return compileSeeDreamFormat(shot);
    if (formatMode === 'natural_language') return compileSeedanceDirectFormat(shot, idx);
    if (formatMode === 'json') return JSON.stringify(shot, null, 2);
    return compileComfyUISeedanceFormat(shot, idx);
  };

  // STRICT SHORT FILENAME ONLY (SC01_SH01.txt, SC09_SH28.txt...)
  const getShotFilename = (shot, idx) => {
    const ext = formatMode === 'json' ? 'json' : (formatMode === 'csv' ? 'csv' : 'txt');
    return formatShotFilename(shot, idx, ext);
  };

  let compiledOutput = '';
  if (formatMode === 'character_story_vault') {
    compiledOutput = shots.map((shot, idx) => compileCharacterStoryVaultFormat(shot, idx)).join('\n\n' + '='.repeat(70) + '\n\n');
  } else if (formatMode === 'comfyui_seedance') {
    compiledOutput = shots.map((shot, idx) => compileComfyUISeedanceFormat(shot, idx)).join('\n\n' + '='.repeat(60) + '\n\n');
  } else if (formatMode === 'engine_optimized') {
    compiledOutput = shots.map((shot, idx) => compileComfyUISeedanceFormat(shot, idx)).join('\n\n' + '='.repeat(60) + '\n\n');
  } else if (formatMode === 'first_last_frame') {
    compiledOutput = shots.map((shot, idx) => compileFirstLastFrameFormat(shot, idx)).join('\n\n' + '='.repeat(80) + '\n\n');
  } else if (formatMode === 'seedream_beat_breakdown') {
    compiledOutput = shots.map((shot, idx) => compileSeeDreamBeatBreakdown(shot, idx)).join('\n\n' + '='.repeat(80) + '\n\n');
  } else if (formatMode === 'seedream_image') {
    compiledOutput = shots.map((shot, idx) => 
      `=== HIGH-RES IMAGE GENERATION PROMPT (SHOT #${idx + 1} - ${shot.sceneShotId || 'SC01_SH01'}) ===\n${compileSeeDreamFormat(shot)}`
    ).join('\n\n');
  } else if (formatMode === 'seedance_tagged') {
    compiledOutput = shots.map((shot, idx) => compileSeedanceDirectFormat(shot, idx)).join('\n\n' + '='.repeat(60) + '\n\n');
  } else if (formatMode === 'natural_language') {
    compiledOutput = shots.map((shot, idx) => compileSeedanceDirectFormat(shot, idx)).join('\n\n' + '='.repeat(60) + '\n\n');
  } else if (formatMode === 'json') {
    compiledOutput = JSON.stringify(shots, null, 2);
  } else if (formatMode === 'csv') {
    const headers = SEEDANCE_SLOTS.map(s => `"${s.label.replace(/"/g, '""')}"`).join(',');
    const rows = shots.map(shot => 
      SEEDANCE_SLOTS.map(s => `"${(shot[s.key] || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    compiledOutput = `${headers}\n${rows}`;
  }

  const handleCopyAll = () => {
    navigator.clipboard.writeText(compiledOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySingle = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadSingleTxtFile = (filename, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename; // ALWAYS SHORT: SC01_SH01.txt
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Clean ZIP Package Downloader
  const handleDownloadZipPackage = () => {
    const zipFiles = shots.map((shot, idx) => ({
      name: getShotFilename(shot, idx), // STRICT SHORT NAME: SC01_SH01.txt
      content: getShotPromptText(shot, idx)
    }));

    const rawTitle = projectTitle || (typeof window !== 'undefined' ? localStorage.getItem('sps_project_title') : '') || 'sps_project';
    const cleanTitle = String(rawTitle)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const zipBlob = createZipArchive(zipFiles);
    const zipFilename = `${cleanTitle || 'sps_project'}_prompts.zip`;

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportSuccessMsg(`🟢 Downloaded "${zipFilename}" containing clean short files (SC01_SH01.txt, SC01_SH02.txt...)!`);
    setTimeout(() => setExportSuccessMsg(null), 5000);
  };

  // Individual Shot File Download
  const generateAndSaveSingleShotFile = (shot, idx) => {
    const filename = getShotFilename(shot, idx); // STRICT SHORT NAME: SC01_SH01.txt
    const content = getShotPromptText(shot, idx);
    downloadSingleTxtFile(filename, content);
    setExportSuccessMsg(`🟢 Downloaded "${filename}"!`);
    setTimeout(() => setExportSuccessMsg(null), 3000);
  };

  // Batch Individual Short Files Download (SC01_SH01.txt, SC01_SH02.txt...)
  const handleExportAllIndividualFiles = () => {
    shots.forEach((shot, i) => {
      setTimeout(() => {
        const filename = getShotFilename(shot, i); // STRICT SHORT NAME: SC01_SH01.txt
        const content = getShotPromptText(shot, i);
        downloadSingleTxtFile(filename, content);
      }, i * 350);
    });

    setExportSuccessMsg(`🟢 Downloading ${shots.length} short files (SC01_SH01.txt, SC01_SH02.txt...)!`);
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  const handleDownloadFullDoc = () => {
    const ext = formatMode === 'json' ? 'json' : (formatMode === 'csv' ? 'csv' : 'txt');
    downloadSingleTxtFile(`full_script.${ext}`, compiledOutput);
  };

  const getFormatModeLabel = (mode) => {
    switch (mode) {
      case 'comfyui_seedance': return 'Master Cinema Prompt';
      case 'seedance_tagged': return 'SPS Standard Tagging';
      case 'engine_optimized': return 'Target Syntax';
      case 'first_last_frame': return 'First & Last Frame';
      case 'seedream_beat_breakdown': return 'Beat Breakdown';
      case 'natural_language': return 'Narrative Prose';
      case 'json': return 'JSON';
      case 'csv': return 'CSV';
      default: return 'Master Cinema Prompt';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all ${isFullscreen ? 'p-0 bg-black' : 'p-4 bg-black/75 backdrop-blur-md'}`}>
      <div className={`relative w-full bg-slate-50 dark:bg-zinc-950 text-slate-950 dark:text-white border border-slate-300 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col transition-all ${
        isFullscreen ? 'h-full max-w-none max-h-none rounded-none border-0' : 'max-w-5xl rounded-2xl max-h-[92vh]'
      }`}>
        {/* Modal Header */}
        {isFullscreen ? (
          <div className="p-3 px-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                📖 Focus Reader View
                <span className="text-xs bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded font-mono font-bold">
                  {getFormatModeLabel(formatMode)} • {shots.length} Shots
                </span>
                <span className="text-[11px] bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-mono font-bold hidden sm:inline-flex items-center gap-1" title="Keyboard Shortcut: Press Cmd + Down Arrow to shift to next shot">
                  ⌨️ ⌘+↓ Next Shot
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(compiledOutput);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied All!' : 'Copy All Text'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleFullscreenMode(false)}
                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-amber-700 dark:text-amber-400 border border-slate-300 dark:border-zinc-700 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all"
                title="Exit Fullscreen (ESC)"
              >
                <Minimize2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>ESC - normal view</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close Window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 px-5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-amber-500">
                <Sparkles className="w-5 h-5 text-cyan-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Stage Production Studio Compiler
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Generate individual TXT prompt files or export multi-shot production scripts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleFullscreenMode(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-amber-800 dark:text-amber-300 border border-slate-300 dark:border-zinc-700 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all"
                title="Fullscreen Focus Reader View (⌘ + Enter)"
              >
                <Maximize2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>cmd+enter - full screen</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Success Toast Notification */}
        {exportSuccessMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 p-2.5 px-5 text-emerald-200 text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccessMsg}</span>
          </div>
        )}

        {/* Format Selector Tabs & Toolbars (Hidden in Distraction-Free Fullscreen Reader Mode) */}
        {!isFullscreen && (
          <>
            <div className="p-3 px-4 bg-slate-100/90 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/80 dark:bg-zinc-950 p-1 rounded-xl border border-slate-300 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFormatMode('comfyui_seedance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    formatMode === 'comfyui_seedance'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                      : 'text-emerald-400 hover:text-white bg-emerald-950/40 border border-emerald-500/30'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  🎛️ Master Cinema Prompt
                </button>

                <button
                  type="button"
                  onClick={() => setFormatMode('character_story_vault')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    formatMode === 'character_story_vault'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold shadow-[0_0_15px_rgba(147,51,234,0.5)] border border-purple-400/50'
                      : 'text-purple-300 hover:text-white bg-purple-950/40 border border-purple-500/30'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-purple-300" />
                  🎭 Character & Story
                </button>

                <button
                  type="button"
                  onClick={() => setFormatMode('seedance_tagged')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    formatMode === 'seedance_tagged'
                      ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  SPS Direct Cinema
                </button>

                <button
                  type="button"
                  onClick={() => setFormatMode('first_last_frame')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    formatMode === 'first_last_frame'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg'
                      : 'text-cyan-300 hover:text-white bg-cyan-950/40 border border-cyan-500/30'
                  }`}
                >
                  <Film className="w-3.5 h-3.5 text-cyan-300" />
                  🎬 First & Last Frame
                </button>

                <button
                  type="button"
                  onClick={() => setFormatMode('seedream_beat_breakdown')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    formatMode === 'seedream_beat_breakdown'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-950 font-black shadow-lg'
                      : 'text-amber-300 hover:text-white bg-amber-950/40 border border-amber-500/30'
                  }`}
                >
                  <Disc className="w-3.5 h-3.5 text-amber-950 fill-zinc-950" />
                  🥁 Beat Breakdown
                </button>

                <button
                  type="button"
                  onClick={() => setFormatMode('natural_language')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    formatMode === 'natural_language'
                      ? 'bg-cyan-600 text-white font-bold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Narrative Prose
                </button>
                <button
                  type="button"
                  onClick={() => setFormatMode('json')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    formatMode === 'json'
                      ? 'bg-cyan-600 text-white font-bold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Code className="w-3.5 h-3.5 text-amber-400" />
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => setFormatMode('csv')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    formatMode === 'csv'
                      ? 'bg-cyan-600 text-white font-bold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  CSV
                </button>
              </div>

              {/* Action Bar: View Mode & Direct Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-200 dark:bg-zinc-950 p-1 rounded-xl border border-slate-300 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1 transition-all ${
                        viewMode === 'cards' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-cyan-300 font-bold shadow-sm' : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                      }`}
                      title="View Individual Shot Cards with Local TXT Generator"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>Cards View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode('single')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1 transition-all ${
                        viewMode === 'single' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-cyan-300 font-bold shadow-sm' : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                      }`}
                      title="View Full Single Document Text"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Full Script</span>
                    </button>
                  </div>
                </div>

                {/* DIRECT ACTION BUTTONS */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadZipPackage}
                    className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-900 dark:text-cyan-300 text-xs font-bold font-mono flex items-center gap-1.5 border border-slate-300 dark:border-zinc-700 transition-all cursor-pointer shadow-sm"
                    title={`Download all ${shots.length} prompts in a ZIP folder containing individual TXT files`}
                  >
                    <Archive className="w-4 h-4 text-cyan-400" />
                    <span>📦 Download ZIP Folder</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportAllIndividualFiles}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow-lg border border-emerald-400/40 transition-all cursor-pointer shrink-0"
                    title={`Save all ${shots.length} prompts as short individual TXT files (SC01_SH01.txt, SC01_SH02.txt...)`}
                  >
                    <FolderDown className="w-4 h-4 text-emerald-200" />
                    <span>⚡ Save All TXT Files</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SCRIPT SYNOPSIS STATUS (read-only — Writer Console owns edits) */}
            {(() => {
              const isWriterCustom = scriptSynopsisSource === 'writer_custom';
              const activeSynopsisText = isWriterCustom
                ? (writerCustomScriptSynopsis || '').trim()
                : (extractedMasterStory || '').trim();
              const preview = activeSynopsisText
                ? (activeSynopsisText.length > 120 ? `${activeSynopsisText.slice(0, 120)}…` : activeSynopsisText)
                : 'No synopsis set yet — edit in Writer Console.';
              return (
                <div className="p-3 px-4 bg-slate-50 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                  <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                    <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1.5 shrink-0">
                      <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      Script Synopsis:
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold shrink-0 ${
                        isWriterCustom
                          ? 'bg-purple-600/90 text-white'
                          : 'bg-amber-500/90 text-slate-950'
                      }`}
                    >
                      {isWriterCustom ? '✍️ Writer Custom' : '🤖 LLM Auto-Generated'}
                    </span>
                    <span
                      className="text-slate-600 dark:text-zinc-400 truncate min-w-0 max-w-xl"
                      title={activeSynopsisText || undefined}
                    >
                      {preview}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenWriterSynopsis?.()}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 border border-purple-400/40 transition-all cursor-pointer shrink-0 shadow-sm"
                    title="Edit synopsis in Writer Console"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Edit in Writer Console</span>
                  </button>
                </div>
              );
            })()}
          </>
        )}

        {/* Modal Output Body */}
        <div className="p-5 flex-1 overflow-y-auto bg-slate-100 dark:bg-zinc-950">
          {viewMode === 'cards' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400 pb-1 border-b border-slate-200 dark:border-zinc-800/80">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  Showing {shots.length} Individual Shot Prompts ({getFormatModeLabel(formatMode)} Format)
                </span>
                <span className="text-slate-600 dark:text-zinc-400 font-mono text-[11px]">
                  Filenames: <span className="text-emerald-700 dark:text-emerald-400 font-bold">SC01_SH01.txt, SC01_SH02.txt...</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {shots.map((shot, idx) => {
                  const filename = getShotFilename(shot, idx); // STRICT SHORT FILENAME (e.g. SC01_SH01.txt)
                  const promptText = getShotPromptText(shot, idx);
                  const isCopiedSingle = copiedIndex === idx;

                  return (
                    <div 
                      key={idx}
                      id={`compiler-shot-card-${idx}`}
                      className={`bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm transition-all space-y-3 ${
                        focusedShotIdx === idx ? 'ring-2 ring-cyan-500 border-cyan-500' : 'border-slate-300 dark:border-zinc-800'
                      }`}
                    >
                      {/* Box Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-zinc-950 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2 truncate max-w-xl">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 font-mono text-xs font-bold flex items-center gap-1.5 shrink-0">
                            <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            {filename}
                          </span>
                          <span className="text-slate-900 dark:text-zinc-200 font-extrabold font-mono text-xs shrink-0">
                            Shot #{idx + 1}
                          </span>
                          <span className="text-slate-600 dark:text-zinc-400 text-xs truncate font-sans font-medium">
                            {shot.shotComposition || 'Medium Shot'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingShotIdx(idx)}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/40 text-amber-900 dark:text-amber-300 text-xs font-mono font-bold flex items-center gap-1 transition-all border border-amber-300 dark:border-amber-500/40 cursor-pointer shadow-sm"
                            title={`View crafts for shot #${idx + 1} (${filename}) — edit values in Form`}
                          >
                            <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>View Crafts</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopySingle(promptText, idx)}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-zinc-200 text-xs font-mono font-bold flex items-center gap-1 transition-all border border-slate-300 dark:border-zinc-700"
                          >
                            {isCopiedSingle ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />}
                            <span>{isCopiedSingle ? 'Copied!' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => generateAndSaveSingleShotFile(shot, idx)}
                            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow border border-cyan-400/40 cursor-pointer"
                            title={`Generate & save ${filename}`}
                          >
                            <Download className="w-3.5 h-3.5 text-cyan-100" />
                            <span>⚡ Generate {filename}</span>
                          </button>
                        </div>
                      </div>

                      {/* Prompt Content Box with Smart Typography */}
                      <div className="w-full p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800/90 shadow-sm overflow-x-auto">
                        <SmartFormattedPromptViewer content={promptText} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400">
                <span>Single Document Script View ({shots.length} Shots)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="px-3 py-1 rounded bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-900 dark:text-zinc-200 text-xs font-bold border border-slate-300 dark:border-zinc-700 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />}
                    {copied ? 'Copied All!' : 'Copy All Text'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadFullDoc}
                    className="px-3 py-1 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Full Script
                  </button>
                </div>
              </div>

              <div className="w-full flex-1 p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800/90 shadow-sm overflow-y-auto max-h-[75vh]">
                <SmartFormattedPromptViewer content={compiledOutput} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PINNED 25 CRAFTS BREAKDOWN POPUP WORKSPACE */}
      {editingShotIdx !== null && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 font-mono">
          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-amber-500/50 rounded-2xl w-full max-w-[96vw] h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono text-slate-950 dark:text-white">
            {/* Popup Header Bar */}
            <div className="p-3.5 px-5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                  <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{`Full ${SEEDANCE_SLOTS.length} Crafts Breakdown for Shot #${editingShotIdx + 1}`}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-cyan-800 dark:text-cyan-300 border border-slate-300 dark:border-zinc-700 text-xs font-bold">
                      {getShotFilename(shots[editingShotIdx], editingShotIdx)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium">
                    📌 View crafts here • Edit values in Form view.
                  </p>
                </div>
              </div>

              {/* RATIO & VIEW CONTROLS */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onEditShotInForm?.(editingShotIdx, activeCraftKey);
                    setEditingShotIdx(null);
                    setActiveCraftKey(null);
                    onClose?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow-md border border-cyan-400/40 transition-all cursor-pointer"
                  title="Open this shot in Form view to edit crafts"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Edit in Form</span>
                </button>

                <div className="flex items-center bg-slate-200 dark:bg-zinc-950 p-1 rounded-xl border border-slate-300 dark:border-zinc-800 shrink-0 gap-0.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('standard')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'standard' ? 'bg-cyan-500 text-zinc-950 font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Standard Split: 35% Sidebar List / 65% Detail Focus"
                  >
                    📊 35/65
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('equal')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'equal' ? 'bg-purple-500 text-white font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Equal Split: 50% Sidebar / 50% Detail"
                  >
                    ⚖️ 50/50
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('inverse')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'inverse' ? 'bg-amber-500 text-zinc-950 font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Inverse Split: 65% Crafts Grid / 35% Detail Focus"
                  >
                    🔄 65/35
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('full_left')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'full_left' ? 'bg-emerald-500 text-zinc-950 font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title={`100% Full View: Left ${SEEDANCE_SLOTS.length} Crafts List Only`}
                  >
                    🖥️ 100% Left
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('full_right')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'full_right' ? 'bg-cyan-400 text-zinc-950 font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="100% Full View: Right Active Detail Only"
                  >
                    ⚡ 100% Right
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingShotIdx(null)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-zinc-700 cursor-pointer"
                  title="Close Pinned Workspace"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* DUAL-PANE BODY WORKSPACE */}
            <div className="flex-1 flex overflow-hidden bg-zinc-950">
              {activeCraftKey === null ? (
                /* FULL 25 CRAFTS GRID VIEW (100% WIDTH) */
                <div className="p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 space-y-3 bg-zinc-950">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {SEEDANCE_SLOTS.map((slot, sIdx) => {
                      const currentVal = shots[editingShotIdx]?.[slot.key] || '';
                      const numStr = sIdx + 1 < 10 ? '0' + (sIdx + 1) : String(sIdx + 1);

                      return (
                        <div
                          key={slot.key}
                          onClick={() => setActiveCraftKey(slot.key)}
                          className="p-3 rounded-xl border border-zinc-800/90 bg-zinc-900/80 hover:bg-zinc-900 hover:border-cyan-500/60 transition-all cursor-pointer space-y-1.5 group shadow-sm flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-1 border-b border-zinc-800/60 pb-1.5">
                            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-cyan-400 border border-zinc-800">
                              {numStr}
                            </span>
                            <h4 className="text-[11px] font-bold text-zinc-200 group-hover:text-cyan-300 font-sans truncate flex-1 ml-1">
                              {slot.label}
                            </h4>
                            <BookOpen className="w-3 h-3 text-zinc-500 group-hover:text-cyan-400 shrink-0" />
                          </div>

                          <p className="text-[11px] font-mono text-amber-200/90 bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 line-clamp-2 min-h-[36px] break-words">
                            {currentVal || <span className="text-zinc-600 italic font-sans">Empty slot value...</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* INVERSE DUAL-PANE SPLIT WORKSPACE */
                <div className="flex-1 flex w-full h-full overflow-hidden">
                  {/* LEFT PANEL: Crafts sidebar list */}
                  {splitRatioMode !== 'full_right' && (
                    <div 
                      className={`border-r border-zinc-800 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 bg-zinc-950/90 p-3 space-y-2 shrink-0 transition-all ${
                        splitRatioMode === 'full_left'
                          ? 'w-full'
                          : (splitRatioMode === 'standard' ? 'w-full md:w-[35%]' : (splitRatioMode === 'inverse' ? 'w-full md:w-[65%]' : 'w-full md:w-[50%]'))
                      }`}
                    >
                      <div className="flex items-center justify-between px-1 pb-1">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                          {`${SEEDANCE_SLOTS.length} Crafts List:`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveCraftKey(null)}
                          className="text-[10.5px] text-cyan-400 hover:text-cyan-300 font-mono underline"
                        >
                          Expand All Grid
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {SEEDANCE_SLOTS.map((slot, sIdx) => {
                          const isSelected = activeCraftKey === slot.key;
                          const currentVal = shots[editingShotIdx]?.[slot.key] || '';
                          const numStr = sIdx + 1 < 10 ? '0' + (sIdx + 1) : String(sIdx + 1);

                          return (
                            <div
                              key={slot.key}
                              onClick={() => setActiveCraftKey(slot.key)}
                              className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all space-y-1 ${
                                isSelected
                                  ? 'bg-cyan-950/40 border-cyan-400 text-white font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)] scale-[1.01]'
                                  : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  isSelected ? 'bg-cyan-500 text-zinc-950 font-black' : 'bg-zinc-950 text-cyan-400 border border-zinc-800'
                                }`}>
                                  {numStr}
                                </span>
                                <span className="font-sans text-[11.5px] truncate flex-1 ml-1 font-bold">
                                  {slot.label}
                                </span>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />}
                              </div>

                              <p className="text-[10.5px] font-mono text-zinc-400 truncate bg-zinc-950/80 p-1 px-1.5 rounded border border-zinc-800/60">
                                {currentVal || <span className="text-zinc-600 italic">Empty...</span>}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* RIGHT PANEL: Read-only craft detail + Edit in Form CTA */}
                  {splitRatioMode !== 'full_left' && (
                    <div 
                      className={`flex-1 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 bg-zinc-950 p-2 sm:p-3 transition-all ${
                        splitRatioMode === 'full_right'
                          ? 'w-full'
                          : (splitRatioMode === 'standard' ? 'w-full md:w-[65%]' : (splitRatioMode === 'inverse' ? 'w-full md:w-[35%]' : 'w-full md:w-[50%]'))
                      }`}
                    >
                        {(() => {
                          const slotConfig = SEEDANCE_SLOTS.find(s => s.key === activeCraftKey);
                          if (!slotConfig) return null;
                          const craftValue = shots[editingShotIdx]?.[activeCraftKey] || '';
                          const craftIdx = SEEDANCE_SLOTS.findIndex(s => s.key === activeCraftKey);
                          const numStr = craftIdx + 1 < 10 ? '0' + (craftIdx + 1) : String(craftIdx + 1);

                          return (
                            <div className="h-full flex flex-col gap-3 p-2 sm:p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-cyan-400 border border-zinc-800 shrink-0">
                                    {numStr}
                                  </span>
                                  <h4 className="text-sm font-bold text-white font-sans truncate">
                                    {slotConfig.label}
                                  </h4>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                                    Read-only
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onEditShotInForm?.(editingShotIdx, activeCraftKey);
                                    setEditingShotIdx(null);
                                    setActiveCraftKey(null);
                                    onClose?.();
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow-md border border-cyan-400/40 transition-all cursor-pointer shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Edit in Form</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (craftIdx > 0) setActiveCraftKey(SEEDANCE_SLOTS[craftIdx - 1].key);
                                  }}
                                  disabled={craftIdx <= 0}
                                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  ← Prev craft
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (craftIdx < SEEDANCE_SLOTS.length - 1) setActiveCraftKey(SEEDANCE_SLOTS[craftIdx + 1].key);
                                  }}
                                  disabled={craftIdx >= SEEDANCE_SLOTS.length - 1}
                                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  Next craft →
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveCraftKey(null)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold border border-zinc-700 text-cyan-400 hover:bg-zinc-800 cursor-pointer ml-auto"
                                >
                                  Close detail
                                </button>
                              </div>

                              <textarea
                                readOnly
                                disabled
                                value={craftValue}
                                placeholder="Empty slot value..."
                                className="flex-1 min-h-[220px] w-full resize-none rounded-xl bg-zinc-900/90 text-amber-100/90 border border-zinc-700 px-3 py-3 text-xs font-mono leading-relaxed cursor-default opacity-90"
                              />

                              <p className="text-[11px] text-zinc-500 font-mono">
                                Craft values are edited in Form view — use <span className="text-cyan-400 font-bold">Edit in Form</span> to jump there.
                              </p>
                            </div>
                          );
                        })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div className="p-3 px-5 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-zinc-400 font-mono">
                Shot #{editingShotIdx + 1} • {shots[editingShotIdx]?.shotComposition || 'Medium Shot'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onEditShotInForm?.(editingShotIdx, activeCraftKey);
                    setEditingShotIdx(null);
                    setActiveCraftKey(null);
                    onClose?.();
                  }}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer border border-cyan-400/40"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Edit in Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingShotIdx(null)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done & Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SaveCloseConfirmModal
        isOpen={isEscConfirmOpen}
        title="Save & Exit Prompt Compiler"
        onSaveAndClose={() => {
          setIsEscConfirmOpen(false);
          onClose();
        }}
        onCloseWithoutSave={() => {
          setIsEscConfirmOpen(false);
          onClose();
        }}
        onCancel={() => setIsEscConfirmOpen(false)}
      />
    </div>
  );
}
