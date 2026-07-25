import React, { useState } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import { 
  X, Copy, Download, Check, Sparkles, Code, FileSpreadsheet, FileText, 
  Cpu, Image as ImageIcon, Disc, Film, FolderDown, FileCode, CheckCircle2, Grid, Folder, FolderPlus, HardDrive, Info, AlertTriangle, PackageCheck
} from 'lucide-react';

export default function PromptCompilerModal({ isOpen, onClose, shots, activeTargetModel = "Seedance 2.0" }) {
  const [formatMode, setFormatMode] = useState('seedance_tagged'); // Default to SPS Standard Tagged
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'single'
  const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState(null);

  // Active Native Folder Handle & Custom Path State
  const [folderHandle, setFolderHandle] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [customFolderPath, setCustomFolderPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_custom_export_folder') || "/Users/pedditiram/Desktop/jai sri ram prompts";
    }
    return "/Users/pedditiram/Desktop/jai sri ram prompts";
  });

  const handleCustomFolderPathChange = (val) => {
    setCustomFolderPath(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_custom_export_folder', val);
    }
  };

  // Synchronous User Gesture Native Folder Picker
  const handleSelectTargetFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'desktop'
        });
        setFolderHandle(handle);
        setFolderName(handle.name);
        handleCustomFolderPathChange(`Desktop/${handle.name}`);
        setExportSuccessMsg(`🟢 Target Folder Locked: "${handle.name}". All files will now be written directly here!`);
        setTimeout(() => setExportSuccessMsg(null), 5000);
        return handle;
      } catch (err) {
        if (err.name === 'AbortError') return null;
        console.warn("Directory picker error:", err);
      }
    }
    return null;
  };

  if (!isOpen) return null;

  const compileTaggedFormat = (shot) => {
    return SEEDANCE_SLOTS.map(slot => shot[slot.key]).filter(Boolean).join(' | ');
  };

  const compileSoraFormat = (shot) => {
    const parts = [];
    parts.push(`A cinematic ${shot.shotComposition ? shot.shotComposition.toLowerCase() : 'shot'} (${shot.sceneShotId || 'SC01_SH01'}).`);
    if (shot.characterIdAssetRef) parts.push(`Featuring ${shot.characterIdAssetRef}.`);
    if (shot.actionEnvContext) parts.push(`Environment: ${shot.actionEnvContext}.`);
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
    if (shot.subjectLightingTag) flags.push(`--lighting "${shot.subjectLightingTag}"`);
    if (shot.subjectColorTag) flags.push(`--color "${shot.subjectColorTag}"`);
    if (shot.actionEnvContext) flags.push(`--env "${shot.actionEnvContext}"`);
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
    parts.push(`[MiniMax Video-01 Engine]`);
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
    parts.push(`[BytePlus Seaweed Engine]`);
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
    const shotId = shot.sceneShotId || `SC01_SH${shotIdx + 1 < 10 ? '0' + (shotIdx + 1) : shotIdx + 1}`;
    const artist = (shot.characterIdAssetRef || '@LeadArtist').replace(/\[CharID:\s*/, '').replace(/\]/, '');
    const coArtist = (shot.coArtistInteraction || 'co-artist reacting').replace(/\[Co-Artist:\s*/, '').replace(/\]/, '');
    const framing = shot.shotComposition || 'Medium Shot';
    const motion = (shot.cameraMotionTag || 'Tracking Shot').replace(/\[Camera:\s*/, '').replace(/\]/, '');
    const lighting = (shot.subjectLightingTag || 'Cinematic Lighting').replace(/\[|\]/g, '');
    const color = (shot.subjectColorTag || 'Teal & Orange').replace(/\[|\]/g, '');
    const env = shot.actionEnvContext || 'concert stage';
    const dialogue = shot.characterDialogue && !shot.characterDialogue.includes('Silent') ? shot.characterDialogue : null;

    const beat1 = `masterpiece 8k render, SEEDREAM 5.0 KEYFRAME 1 (BEAT 0.0s - Establishing Stance), ${framing}, ${artist} standing at starting position, ${env}, ${lighting}, ${color}, static establishing keyframe, crisp focus, extreme detail, 8k`;
    const beat2 = `masterpiece 8k render, SEEDREAM 5.0 KEYFRAME 2 (BEAT 1.5s - Motion Peak), ${framing}, ${artist} executing ${shot.characterMovement || 'dynamic performance movement'}, ${motion} vector blur, ${coArtist}, dynamic action pose, intense energy, ${lighting}, 8k`;
    const beat3 = `masterpiece 8k render, SEEDREAM 5.0 KEYFRAME 3 (BEAT 3.5s - Emotional Climax), Extreme Close-Up, ${artist} expression: ${shot.characterExpression || 'intense passion'}, ${dialogue ? `vocal mouth open singing ${dialogue}` : 'eyes locked onto camera'}, ${coArtist} reacting in background, climax keyframe, 8k resolution`;

    return `=== SEEDANCE 2.0 VIDEO PROMPT -> SEEDREAM 5.0 BEAT BREAKDOWN (SHOT #${shotIdx + 1} - ${shotId}) ===
⚡ [BEAT 1 @ 0.0s - Establishing Keyframe]:
${beat1}

🔥 [BEAT 2 @ 1.5s - Peak Motion & Co-Artist Reaction Keyframe]:
${beat2}

💥 [BEAT 3 @ 3.5s - Climax & Vocal Sync Keyframe]:
${beat3}`;
  };

  const compileFirstLastFrameFormat = (shot, shotIdx) => {
    const shotId = shot.sceneShotId || `SC01_SH${shotIdx + 1 < 10 ? '0' + (shotIdx + 1) : shotIdx + 1}`;
    const artist = (shot.characterIdAssetRef || '@LeadArtist').replace(/\[CharID:\s*/, '').replace(/\]/, '');
    const coArtist = (shot.coArtistInteraction || '').replace(/\[Co-Artist:\s*/, '').replace(/\]/, '');
    const framing = shot.shotComposition || 'Medium Shot';
    const motion = (shot.cameraMotionTag || 'Tracking Shot').replace(/\[Camera:\s*/, '').replace(/\]/, '');
    const lighting = (shot.subjectLightingTag || 'Cinematic Lighting').replace(/\[|\]/g, '');
    const color = (shot.subjectColorTag || 'Teal & Orange').replace(/\[|\]/g, '');
    const env = shot.actionEnvContext || 'stage';

    const firstFrame = `[FRAME 0 - STARTING KEYFRAME IMAGE PROMPT]:
masterpiece 8k render, ${framing}, ${artist} at initial starting stance, ${env}, ${lighting}, ${color}, static initial frame, sharp focus, 8k`;

    const lastFrame = `[FRAME N - ENDING KEYFRAME IMAGE PROMPT]:
masterpiece 8k render, ${framing}, ${artist} executing ${shot.characterMovement || 'final pose'}, expression: ${shot.characterExpression || 'climax intensity'}, ${coArtist ? coArtist : ''}, ${env}, shifted ${lighting}, ending keyframe, 8k`;

    const videoCommand = `[VIDEO GENERATION INTERPOLATION COMMAND]:
--start_frame "${firstFrame.replace(/\n/g, ' ')}"
--end_frame "${lastFrame.replace(/\n/g, ' ')}"
--camera_motion "${motion}"
--smooth_transition true --fps 24`;

    return `=== KEYFRAME INTERPOLATION: SHOT #${shotIdx + 1} (${shotId}) ===
🖼️ ${firstFrame}

🏁 ${lastFrame}

🎥 ${videoCommand}`;
  };

  const compileEngineSpecific = (shot) => {
    if (activeTargetModel === 'OpenAI Sora') return compileSoraFormat(shot);
    if (activeTargetModel === 'Runway Gen-3') return compileRunwayFormat(shot);
    if (activeTargetModel === 'Luma Dream Machine') return compileLumaFormat(shot);
    if (activeTargetModel === 'Kling AI 1.5') return compileKlingFormat(shot);
    if (activeTargetModel === 'MiniMax Video-01') return compileMiniMaxFormat(shot);
    if (activeTargetModel === 'BytePlus Seaweed') return compileBytePlusFormat(shot);
    return compileTaggedFormat(shot);
  };

  const getShotPromptText = (shot, idx) => {
    if (formatMode === 'engine_optimized') return compileEngineSpecific(shot);
    if (formatMode === 'first_last_frame') return compileFirstLastFrameFormat(shot, idx);
    if (formatMode === 'seedream_beat_breakdown') return compileSeeDreamBeatBreakdown(shot, idx);
    if (formatMode === 'seedream_image') return compileSeeDreamFormat(shot);
    if (formatMode === 'natural_language') return compileSoraFormat(shot);
    if (formatMode === 'json') return JSON.stringify(shot, null, 2);
    return compileTaggedFormat(shot);
  };

  const getShotFilename = (shot, idx) => {
    const rawId = shot.sceneShotId || `SC01_SH${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`;
    const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = formatMode === 'json' ? 'json' : (formatMode === 'csv' ? 'csv' : 'txt');
    return `${cleanId}.${ext}`;
  };

  let compiledOutput = '';
  if (formatMode === 'engine_optimized') {
    compiledOutput = shots.map((shot, idx) => 
      `=== OPTIMIZED STAGE PRODUCTION PROMPT (SHOT #${idx + 1} - ${shot.sceneShotId || 'SC01_SH01'}) ===\n${compileEngineSpecific(shot)}`
    ).join('\n\n');
  } else if (formatMode === 'first_last_frame') {
    compiledOutput = shots.map((shot, idx) => compileFirstLastFrameFormat(shot, idx)).join('\n\n' + '='.repeat(80) + '\n\n');
  } else if (formatMode === 'seedream_beat_breakdown') {
    compiledOutput = shots.map((shot, idx) => compileSeeDreamBeatBreakdown(shot, idx)).join('\n\n' + '='.repeat(80) + '\n\n');
  } else if (formatMode === 'seedream_image') {
    compiledOutput = shots.map((shot, idx) => 
      `=== HIGH-RES IMAGE GENERATION PROMPT (SHOT #${idx + 1} - ${shot.sceneShotId || 'SC01_SH01'}) ===\n${compileSeeDreamFormat(shot)}`
    ).join('\n\n');
  } else if (formatMode === 'seedance_tagged') {
    compiledOutput = shots.map((shot, idx) => `=== SPS STAGE PRODUCTION SHOT #${idx + 1} (${shot.sceneShotId || 'SC01_SH01'}) ===\n${compileTaggedFormat(shot)}`).join('\n\n');
  } else if (formatMode === 'natural_language') {
    compiledOutput = shots.map((shot, idx) => `--- SHOT ${idx + 1} (${shot.sceneShotId || 'SC01_SH01'} - ${shot.shotComposition || 'Medium Shot'}) ---\n${compileSoraFormat(shot)}`).join('\n\n');
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
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Direct Write to Active Locked Target Directory
  const generateAndSaveSingleShotFile = async (shot, idx) => {
    const filename = getShotFilename(shot, idx);
    const content = getShotPromptText(shot, idx);

    let activeHandle = folderHandle;

    // Trigger directory picker IMMEDIATELY inside user click gesture if handle is null
    if (!activeHandle && typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      activeHandle = await handleSelectTargetFolder();
    }

    if (activeHandle) {
      try {
        const fileHandle = await activeHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        setExportSuccessMsg(`🟢 Direct Saved "${filename}" into folder "${activeHandle.name}" on disk!`);
        setTimeout(() => setExportSuccessMsg(null), 4000);
        return;
      } catch (err) {
        console.error("Direct folder save error:", err);
        setExportSuccessMsg(`❌ Folder save error: ${err.message}`);
        setTimeout(() => setExportSuccessMsg(null), 4000);
        return;
      }
    }

    // Standard download fallback
    downloadSingleTxtFile(filename, content);
  };

  // Batch Export to Locked Directory or Prompt Directory Picker
  const handleExportAllIndividualFiles = async () => {
    let targetDir = folderHandle;

    // Trigger directory picker IMMEDIATELY inside user click gesture if handle is null
    if (!targetDir && typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      targetDir = await handleSelectTargetFolder();
    }

    if (targetDir) {
      try {
        let count = 0;
        for (let i = 0; i < shots.length; i++) {
          const shot = shots[i];
          const filename = getShotFilename(shot, i);
          const content = getShotPromptText(shot, i);
          const fileHandle = await targetDir.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          count++;
        }

        setExportSuccessMsg(`🟢 Successfully saved ${count} prompt files directly inside folder "${targetDir.name}"!`);
        setTimeout(() => setExportSuccessMsg(null), 5000);
        return;
      } catch (err) {
        console.error("Folder export error:", err);
        setExportSuccessMsg(`❌ Folder export error: ${err.message}`);
        setTimeout(() => setExportSuccessMsg(null), 4000);
        return;
      }
    }

    // Browser Fallback Download
    const prefix = (folderName || customFolderPath || 'Seedance_Prompts').replace(/[^a-zA-Z0-9_-]/g, '_');
    shots.forEach((shot, i) => {
      setTimeout(() => {
        const filename = `${prefix}_${getShotFilename(shot, i)}`;
        const content = getShotPromptText(shot, i);
        downloadSingleTxtFile(filename, content);
      }, i * 350);
    });

    setExportSuccessMsg(`🟢 Downloading ${shots.length} files to browser downloads!`);
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  const handleDownloadFullDoc = () => {
    const ext = formatMode === 'json' ? 'json' : (formatMode === 'csv' ? 'csv' : 'txt');
    const prefix = (folderName || customFolderPath || 'Seedance_Prompts').replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadSingleTxtFile(`${prefix}_full_script.${ext}`, compiledOutput);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 px-5 border-b border-zinc-800 bg-zinc-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Stage Production Studio Compiler
              </h3>
              <p className="text-xs text-zinc-400">
                Generate individual TXT prompt files for Seedance 2.0 or export multi-shot scripts into local folders.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Toast Notification */}
        {exportSuccessMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 p-2.5 px-5 text-emerald-200 text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccessMsg}</span>
          </div>
        )}

        {/* STEP-BY-STEP STEPPER INSTRUCTION BANNER */}
        <div className="bg-amber-950/90 border-b border-amber-500/50 p-3 px-5 text-amber-100 text-xs font-mono flex flex-wrap items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center gap-2 text-xs">
                <span>📁 DIRECT FOLDER SAVE INSTRUCTIONS:</span>
                <span className="text-amber-300 font-extrabold underline">STEP 1 OF 2</span>
              </div>
              <p className="text-[11px] text-amber-200/90">
                Click <strong className="text-white underline">"STEP 1: Pick 'jai sri ram prompts' Folder"</strong> below to select your Desktop folder once!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSelectTargetFolder}
            className={`px-4 py-1.5 rounded-xl font-mono text-xs font-black flex items-center gap-2 shadow-xl border cursor-pointer transition-all ${
              folderHandle
                ? 'bg-emerald-500 text-zinc-950 border-emerald-300 hover:bg-emerald-400 ring-2 ring-emerald-400/50'
                : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 border-amber-300 animate-pulse'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-zinc-950" />
            <span>{folderName ? `🟢 Folder Locked: ${folderName}` : '👉 STEP 1: Pick "jai sri ram prompts" Folder'}</span>
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="p-3 px-4 bg-zinc-900/40 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
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
              SPS Standard Tagged
            </button>

            <button
              type="button"
              onClick={() => setFormatMode('engine_optimized')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                formatMode === 'engine_optimized'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              ⚡ Target Syntax
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

          {/* Action Bar: View Mode, Folder Picker, Folder Path Input & Save Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1 transition-all ${
                    viewMode === 'cards' ? 'bg-zinc-800 text-cyan-300 font-bold' : 'text-zinc-400 hover:text-white'
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
                    viewMode === 'single' ? 'bg-zinc-800 text-cyan-300 font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                  title="View Full Single Document Text"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Full Script</span>
                </button>
              </div>

              {/* STEP 1: INTERACTIVE TARGET FOLDER PICKER BUTTON */}
              <button
                type="button"
                onClick={handleSelectTargetFolder}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all border shadow-sm cursor-pointer ${
                  folderHandle
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900 ring-2 ring-emerald-500/40'
                    : 'bg-amber-500 text-zinc-950 border-amber-400 hover:bg-amber-400 font-extrabold shadow-lg animate-pulse'
                }`}
                title="Click to visually pick your desktop target folder"
              >
                <FolderPlus className="w-4 h-4 text-zinc-950" />
                <span>{folderName ? `🟢 Locked: ${folderName}` : '👉 STEP 1: Pick Folder'}</span>
              </button>

              {/* FOLDER PATH DISPLAY / INPUT FIELD */}
              <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800 focus-within:border-cyan-500 transition-all">
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap hidden lg:inline">Path:</span>
                <input
                  type="text"
                  value={customFolderPath}
                  onChange={(e) => handleCustomFolderPathChange(e.target.value)}
                  placeholder="/Users/pedditiram/Desktop/jai sri ram prompts"
                  className="bg-transparent text-xs font-mono text-cyan-300 font-bold focus:outline-none w-48 lg:w-64 truncate"
                  title="Specify target folder path on your computer"
                />
              </div>
            </div>

            {/* STEP 2: BATCH EXPORT BUTTON */}
            <button
              type="button"
              onClick={handleExportAllIndividualFiles}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow-lg border border-emerald-400/40 transition-all cursor-pointer shrink-0"
              title={`Save all ${shots.length} prompts as individual TXT files into target location`}
            >
              <FolderDown className="w-4 h-4 text-emerald-200" />
              <span>⚡ STEP 2: Save All TXT Files to Folder</span>
            </button>
          </div>
        </div>

        {/* Modal Output Body */}
        <div className="p-5 flex-1 overflow-y-auto bg-zinc-950">
          {viewMode === 'cards' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-1 border-b border-zinc-800/80">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  Showing {shots.length} Individual Shot Prompts ({formatMode.toUpperCase()} Format)
                </span>
                <span className="text-amber-300/90 font-mono text-[11px] truncate max-w-lg hidden md:inline">
                  Target Save Location: <span className="text-white font-bold">{folderName ? `[LOCKED: Desktop/${folderName}]` : (customFolderPath || 'Downloads')}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {shots.map((shot, idx) => {
                  const filename = getShotFilename(shot, idx);
                  const promptText = getShotPromptText(shot, idx);
                  const isCopiedSingle = copiedIndex === idx;
                  const displayPath = folderName ? `Desktop/${folderName}/${filename}` : `${customFolderPath}/${filename}`;

                  return (
                    <div 
                      key={idx}
                      className="bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/40 rounded-xl p-4 shadow-lg transition-all space-y-3"
                    >
                      {/* Box Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/80 p-2.5 px-3 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-2 truncate max-w-xl">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-mono text-xs font-bold flex items-center gap-1 shrink-0">
                            <FileCode className="w-3.5 h-3.5 text-emerald-300" />
                            {displayPath}
                          </span>
                          <span className="text-zinc-300 font-bold font-mono text-xs shrink-0">
                            Shot #{idx + 1}
                          </span>
                          <span className="text-zinc-400 text-xs truncate font-sans">
                            {shot.shotComposition || 'Medium Shot'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopySingle(promptText, idx)}
                            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono flex items-center gap-1 transition-all border border-zinc-700"
                          >
                            {isCopiedSingle ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                            <span>{isCopiedSingle ? 'Copied!' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => generateAndSaveSingleShotFile(shot, idx)}
                            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow border border-cyan-400/40 cursor-pointer"
                            title={`Generate & save ${filename} directly into target folder`}
                          >
                            <Download className="w-3.5 h-3.5 text-cyan-100" />
                            <span>⚡ Generate {filename}</span>
                          </button>
                        </div>
                      </div>

                      {/* Prompt Content Box */}
                      <pre className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800/90 font-mono text-xs text-amber-200/90 leading-relaxed overflow-x-auto whitespace-pre-wrap select-all">
                        {promptText}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Single Document Script View ({shots.length} Shots)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                    {copied ? 'Copied All!' : 'Copy All Text'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadFullDoc}
                    className="px-3 py-1 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-medium flex items-center gap-1.5 shadow transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Full Script
                  </button>
                </div>
              </div>

              <pre className="w-full flex-1 p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 font-mono text-xs text-amber-200/90 leading-relaxed shadow-inner overflow-x-auto whitespace-pre-wrap">
                {compiledOutput}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
