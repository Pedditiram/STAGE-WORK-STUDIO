import React, { useState } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import { createZipArchive } from '../utils/zipUtils';
import SlotEditor from './SlotEditor';
import { 
  X, Copy, Download, Check, Sparkles, Code, FileSpreadsheet, FileText, 
  Cpu, Image as ImageIcon, Disc, Film, FolderDown, FileCode, CheckCircle2, Grid, Archive, Edit3
} from 'lucide-react';

export default function PromptCompilerModal({ isOpen, onClose, shots, onUpdateShot, activeTargetModel = "Stage Production Studio" }) {
  const [formatMode, setFormatMode] = useState('seedance_tagged'); // Default to SPS Standard Tagged
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'single'
  const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState(null);
  const [editingShotIdx, setEditingShotIdx] = useState(null);
  const [activeCraftKey, setActiveCraftKey] = useState(null);

  const [splitRatioMode, setSplitRatioMode] = useState('standard'); // 'standard' (35/65) | 'inverse' (65/35) | 'equal' (50/50)

  if (!isOpen) return null;

  const compileTaggedFormat = (shot) => {
    return SEEDANCE_SLOTS.map(slot => shot[slot.key]).filter(Boolean).join(' | ');
  };

  const compileSeedanceDirectFormat = (shot, shotIdx) => {
    const shotId = shot.sceneShotId || `SC01_SH${shotIdx + 1 < 10 ? '0' + (shotIdx + 1) : shotIdx + 1}`;
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

    // Build ultra-clean cinematic Seedance prompt text with explicit @Tag bindings
    let promptNarrative = `A cinematic ${framing.toLowerCase()} (${shotId}). Duration: ${duration}. `;
    if (shot.actionEnvContext) promptNarrative += `Environment: ${shot.actionEnvContext}. `;
    if (shot.characterIdAssetRef) promptNarrative += `Featuring ${shot.characterIdAssetRef}. `;
    if (shot.coArtistInteraction) promptNarrative += `Co-artist: ${shot.coArtistInteraction}. `;
    if (motion) promptNarrative += `The camera moves with ${motion}. `;
    if (lighting) promptNarrative += `Lighting styled with ${lighting}. `;
    if (color) promptNarrative += `Color graded in ${color}. `;
    if (shot.atmosphereVolumetricsTag) promptNarrative += `Atmosphere: ${shot.atmosphereVolumetricsTag.replace(/\[|\]/g, '')}. `;
    if (shot.characterMovement) promptNarrative += `Action performance: ${shot.characterMovement}. `;
    if (shot.characterExpression) promptNarrative += `Facial expression: ${shot.characterExpression}. `;
    if (shot.characterDialogue) promptNarrative += `Vocal sync: ${shot.characterDialogue}. `;

    return `[SEEDANCE DIRECT CONDITIONING PROMPT - SHOT #${shotIdx + 1} (${shotId})]
Shot: ${framing} | Duration: ${duration}
Resolved Image Inputs:
${resolvedImageHeader}

Prompt Text:
${promptNarrative.trim()}`;
  };

  const compileComfyUISeedanceFormat = (shot, shotIdx) => {
    const shotId = shot.sceneShotId || `SC01_SH${shotIdx + 1 < 10 ? '0' + (shotIdx + 1) : shotIdx + 1}`;
    const framing = shot.shotComposition || 'Medium Shot';
    const motion = (shot.cameraMotionTag || 'Tracking Shot').replace(/\[Camera:\s*/, '').replace(/\]/, '');
    const lighting = (shot.subjectLightingTag || 'Golden Hour').replace(/\[|\]/g, '');
    const color = (shot.subjectColorTag || 'Vibrant Cinema').replace(/\[|\]/g, '');

    const subjectsMap = new Map();
    const rawMatrixStr = shot.characterIdMatrix || '';
    if (rawMatrixStr.includes('Image_')) {
      const parts = rawMatrixStr.split('|').map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        const m = p.match(/Image_(\d+)\s*=\s*(.*)/i);
        if (m) {
          const num = parseInt(m[1], 10);
          subjectsMap.set(num, m[2].trim());
        }
      });
    }

    const rawImagesStr = shot.shotDurationAndImages || '';
    const pairMatches = Array.from(rawImagesStr.matchAll(/Image_(\d+):\s*(@[A-Za-z0-9_]+)/g));

    if (pairMatches.length > 0) {
      for (const match of pairMatches) {
        const imgNum = parseInt(match[1], 10);
        if (!subjectsMap.has(imgNum)) {
          const tag = match[2].replace('@', '').toLowerCase();
          let cleanName = tag.split('_')[0];
          if (cleanName === 'rooster' || cleanName === 'arena') cleanName = tag.replace(/_/g, ' ');
          subjectsMap.set(imgNum, cleanName);
        }
      }
    }

    // Auto-extract subjects if not mapped in duration field
    const fullText = `${shot.characterIdAssetRef || ''} ${shot.coArtistInteraction || ''} ${shot.actionEnvContext || ''} ${shot.characterMovement || ''}`.toLowerCase();
    
    if (!subjectsMap.has(1)) {
      if (fullText.includes('raju')) subjectsMap.set(1, 'raju');
      else if (shot.characterIdAssetRef) subjectsMap.set(1, shot.characterIdAssetRef.replace(/\[|\]|CharID:\s*|@/g, '').split('_')[0].toLowerCase());
      else subjectsMap.set(1, 'main subject');
    }

    if (!subjectsMap.has(2)) {
      if (fullText.includes('bujji')) subjectsMap.set(2, 'bujji');
      else if (shot.coArtistInteraction) subjectsMap.set(2, 'co-artist');
      else subjectsMap.set(2, 'secondary subject');
    }

    if (!subjectsMap.has(3)) {
      if (fullText.includes('sunil')) subjectsMap.set(3, 'sunil');
      else subjectsMap.set(3, 'sunil');
    }

    if (!subjectsMap.has(4)) {
      if (fullText.includes('samudra')) subjectsMap.set(4, 'samudra');
      else subjectsMap.set(4, 'samudra');
    }

    if (!subjectsMap.has(5)) {
      if (fullText.includes('crowd') || fullText.includes('spectators') || fullText.includes('arena') || fullText.includes('stadium')) subjectsMap.set(5, 'crowd');
      else subjectsMap.set(5, 'crowd');
    }

    if (!subjectsMap.has(6)) {
      subjectsMap.set(6, 'scene');
    }

    if (!subjectsMap.has(7)) {
      subjectsMap.set(7, 'supporting artist');
    }

    const subjectsLines = [];
    for (let i = 1; i <= 9; i++) {
      const val = subjectsMap.get(i) || '';
      subjectsLines.push(`Image_${i} = ${val}`);
    }

    // Extract duration (default 4s)
    let duration = '4s';
    if (shot.shotDurationAndImages) {
      const match = shot.shotDurationAndImages.match(/(?:Duration:\s*|Duration\s*=|\b)(\d+(?:\.\d+)?\s*s|\d+\s*sec|\d+\s*seconds?)/i);
      if (match) {
        duration = match[1].trim();
      } else if (shot.shotDurationAndImages.trim()) {
        const firstToken = shot.shotDurationAndImages.trim().split('|')[0].trim();
        duration = firstToken.startsWith('Duration:') ? firstToken.replace('Duration:', '').trim() : firstToken;
      }
    }

    let promptBody = `A cinematic ${framing.toLowerCase()} (${shotId}). Duration: ${duration}. `;
    if (shot.actionEnvContext) promptBody += `Environment: ${shot.actionEnvContext}. `;
    if (shot.characterIdAssetRef) promptBody += `Featuring ${shot.characterIdAssetRef}. `;
    if (shot.coArtistInteraction) promptBody += `Interaction: ${shot.coArtistInteraction}. `;
    if (motion) promptBody += `Camera moves with ${motion}. `;
    if (lighting) promptBody += `Lighting styled with ${lighting}. `;
    if (color) promptBody += `Color graded in ${color}. `;
    if (shot.atmosphereVolumetricsTag) promptBody += `Atmosphere: ${shot.atmosphereVolumetricsTag.replace(/\[|\]/g, '')}. `;
    if (shot.characterMovement) promptBody += `Action performance: ${shot.characterMovement}. `;
    if (shot.characterExpression) promptBody += `Facial expression: ${shot.characterExpression}. `;

    return `SUBJECTS :
${subjectsLines.join('\n')}

Note: Do not repeat any of these subjects or characters

SHOT DURATION : ${duration}

PROMPT :
${promptBody.trim()}`;
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
    const shotId = shot.sceneShotId || `SC01_SH${shotIdx + 1 < 10 ? '0' + (shotIdx + 1) : shotIdx + 1}`;
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

  const compileEngineSpecific = (shot, idx) => {
    return compileSeedanceDirectFormat(shot, idx);
  };

  const getShotPromptText = (shot, idx) => {
    if (formatMode === 'comfyui_seedance') return compileComfyUISeedanceFormat(shot, idx);
    if (formatMode === 'engine_optimized') return compileComfyUISeedanceFormat(shot, idx);
    if (formatMode === 'first_last_frame') return compileFirstLastFrameFormat(shot, idx);
    if (formatMode === 'seedream_beat_breakdown') return compileSeeDreamBeatBreakdown(shot, idx);
    if (formatMode === 'seedream_image') return compileSeeDreamFormat(shot);
    if (formatMode === 'natural_language') return compileSeedanceDirectFormat(shot, idx);
    if (formatMode === 'json') return JSON.stringify(shot, null, 2);
    return compileComfyUISeedanceFormat(shot, idx);
  };

  // STRICT SHORT FILENAME ONLY (SC01_SH01.txt, SC01_SH02.txt...)
  const getShotFilename = (shot, idx) => {
    const rawId = shot.sceneShotId || `SC01_SH${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`;
    const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = formatMode === 'json' ? 'json' : (formatMode === 'csv' ? 'csv' : 'txt');
    return `${cleanId}.${ext}`;
  };

  let compiledOutput = '';
  if (formatMode === 'comfyui_seedance') {
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

    const zipBlob = createZipArchive(zipFiles);
    const zipFilename = `jai_sri_ram_prompts.zip`;

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
      case 'seedance_tagged': return 'SPS Standard Tagging';
      case 'engine_optimized': return 'Target Syntax';
      case 'first_last_frame': return 'First & Last Frame';
      case 'seedream_beat_breakdown': return 'Beat Breakdown';
      case 'natural_language': return 'Narrative Prose';
      case 'json': return 'JSON';
      case 'csv': return 'CSV';
      default: return 'SPS Standard Tagging';
    }
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
                Generate individual TXT prompt files or export multi-shot production scripts.
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

        {/* Format Selector Tabs */}
        <div className="p-3 px-4 bg-zinc-900/40 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
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
              🎛️ ComfyUI Seedance 2.0
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
              SPS Direct Seedance
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
            </div>

            {/* DIRECT ACTION BUTTONS */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadZipPackage}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-cyan-300 text-xs font-bold font-mono flex items-center gap-1.5 border border-zinc-700 transition-all cursor-pointer"
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

        {/* Modal Output Body */}
        <div className="p-5 flex-1 overflow-y-auto bg-zinc-950">
          {viewMode === 'cards' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-1 border-b border-zinc-800/80">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  Showing {shots.length} Individual Shot Prompts ({getFormatModeLabel(formatMode)} Format)
                </span>
                <span className="text-zinc-400 font-mono text-[11px]">
                  Filenames: <span className="text-emerald-400 font-bold">SC01_SH01.txt, SC01_SH02.txt...</span>
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
                      className="bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/40 rounded-xl p-4 shadow-lg transition-all space-y-3"
                    >
                      {/* Box Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/80 p-2.5 px-3 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-2 truncate max-w-xl">
                          <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold flex items-center gap-1.5 shrink-0">
                            <FileCode className="w-4 h-4 text-emerald-400" />
                            {filename}
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
                            onClick={() => setEditingShotIdx(idx)}
                            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-1 transition-all border border-amber-500/40 cursor-pointer shadow-sm"
                            title={`Edit shot #${idx + 1} (${filename}) - opens all 25 crafts in a pinned popup window`}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Edit Shot</span>
                          </button>

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
                            title={`Generate & save ${filename}`}
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

      {/* PINNED 25 CRAFTS BREAKDOWN POPUP WORKSPACE */}
      {editingShotIdx !== null && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 font-mono">
          <div className="bg-zinc-950 border border-amber-500/50 rounded-2xl w-full max-w-[96vw] h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            {/* Popup Header Bar */}
            <div className="p-3.5 px-5 border-b border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Full 25 Crafts Breakdown for Shot #{editingShotIdx + 1}</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-cyan-300 border border-zinc-700 text-xs font-bold">
                      {getShotFilename(shots[editingShotIdx], editingShotIdx)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    📌 Pinned Dual-Pane Workspace • Click any craft to edit in right panel.
                  </p>
                </div>
              </div>

              {/* RATIO & VIEW CONTROLS */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0 gap-0.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('standard')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'standard' ? 'bg-cyan-500 text-zinc-950 font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Standard Split: 35% Sidebar List / 65% Editor Focus"
                  >
                    📊 35/65
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('equal')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'equal' ? 'bg-purple-500 text-white font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Equal Split: 50% Sidebar / 50% Editor"
                  >
                    ⚖️ 50/50
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('inverse')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'inverse' ? 'bg-amber-500 text-zinc-950 font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Inverse Split: 65% Crafts Grid / 35% Editor Focus"
                  >
                    🔄 65/35
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('full_left')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'full_left' ? 'bg-emerald-500 text-zinc-950 font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="100% Full View: Left 25 Crafts List Only"
                  >
                    🖥️ 100% Left
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitRatioMode('full_right')}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      splitRatioMode === 'full_right' ? 'bg-cyan-400 text-zinc-950 font-black shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="100% Full View: Right Active Editor Only"
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
                            <Edit3 className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 shrink-0" />
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
                  {/* LEFT PANEL: 25 Crafts Sidebar List */}
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
                          25 Crafts List ({SEEDANCE_SLOTS.length}):
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

                  {/* RIGHT PANEL: Embedded Active Craft Editor Workspace */}
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

                          const scenesList = (shots || []).reduce((acc, s, idx) => {
                            const rawId = s.sceneShotId || `SC01_SH${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`;
                            const match = rawId.match(/^(SC\d+)/i);
                            const sceneId = match ? match[1].toUpperCase() : `Scene #${idx + 1}`;
                            if (!acc.some(sc => sc.sceneId === sceneId)) {
                              acc.push({ sceneId, label: sceneId, firstShotIndex: idx });
                            }
                            return acc;
                          }, []);

                          const currShotObj = shots[editingShotIdx];
                          const rawCurrId = currShotObj?.sceneShotId || `SC01_SH${editingShotIdx + 1 < 10 ? '0' + (editingShotIdx + 1) : editingShotIdx + 1}`;
                          const matchCurr = rawCurrId.match(/^(SC\d+)/i);
                          const currentSceneId = matchCurr ? matchCurr[1].toUpperCase() : `Scene #${editingShotIdx + 1}`;

                          const currSceneIdx = scenesList.findIndex(sc => sc.sceneId === currentSceneId);

                          return (
                            <SlotEditor
                              slotConfig={slotConfig}
                              value={shots[editingShotIdx]?.[activeCraftKey] || ''}
                              onChange={(val) => {
                                if (onUpdateShot) {
                                  onUpdateShot(editingShotIdx, activeCraftKey, val);
                                }
                              }}
                              compact={false}
                              allSlots={SEEDANCE_SLOTS}
                              isForcePopupOpen={true}
                              embedded={true}
                              totalShotsCount={shots.length}
                              currentShotIndex={editingShotIdx}
                              onNavigateNextShot={() => {
                                setEditingShotIdx(prev => (prev < shots.length - 1 ? prev + 1 : 0));
                              }}
                              onNavigatePrevShot={() => {
                                setEditingShotIdx(prev => (prev > 0 ? prev - 1 : shots.length - 1));
                              }}
                              onJumpToShot={(targetShotIdx) => setEditingShotIdx(targetShotIdx)}
                              scenesList={scenesList}
                              currentSceneId={currentSceneId}
                              onNavigateNextScene={() => {
                                setEditingShotIdx(prev => {
                                  const currShotObj = shots[prev];
                                  const rawCurrId = currShotObj?.sceneShotId || `SC01_SH${prev + 1 < 10 ? '0' + (prev + 1) : prev + 1}`;
                                  const matchCurr = rawCurrId.match(/^(SC\d+)/i);
                                  const currentSceneId = matchCurr ? matchCurr[1].toUpperCase() : `Scene #${prev + 1}`;
                                  const currSceneIdx = scenesList.findIndex(sc => sc.sceneId === currentSceneId);
                                  if (currSceneIdx !== -1 && currSceneIdx < scenesList.length - 1) {
                                    return scenesList[currSceneIdx + 1].firstShotIndex;
                                  }
                                  return scenesList[0]?.firstShotIndex || 0;
                                });
                              }}
                              onNavigatePrevScene={() => {
                                setEditingShotIdx(prev => {
                                  const currShotObj = shots[prev];
                                  const rawCurrId = currShotObj?.sceneShotId || `SC01_SH${prev + 1 < 10 ? '0' + (prev + 1) : prev + 1}`;
                                  const matchCurr = rawCurrId.match(/^(SC\d+)/i);
                                  const currentSceneId = matchCurr ? matchCurr[1].toUpperCase() : `Scene #${prev + 1}`;
                                  const currSceneIdx = scenesList.findIndex(sc => sc.sceneId === currentSceneId);
                                  if (currSceneIdx > 0) {
                                    return scenesList[currSceneIdx - 1].firstShotIndex;
                                  }
                                  return scenesList[scenesList.length - 1]?.firstShotIndex || 0;
                                });
                              }}
                              onJumpToScene={(targetScId) => {
                                const found = scenesList.find(sc => sc.sceneId === targetScId);
                                if (found) setEditingShotIdx(found.firstShotIndex);
                              }}
                              onCloseForcePopup={() => setActiveCraftKey(null)}
                              onNavigateNextSlot={(currKey) => {
                                const idx = SEEDANCE_SLOTS.findIndex(s => s.key === currKey);
                                if (idx !== -1 && idx < SEEDANCE_SLOTS.length - 1) {
                                  setActiveCraftKey(SEEDANCE_SLOTS[idx + 1].key);
                                }
                              }}
                              onNavigatePrevSlot={(currKey) => {
                                const idx = SEEDANCE_SLOTS.findIndex(s => s.key === currKey);
                                if (idx > 0) {
                                  setActiveCraftKey(SEEDANCE_SLOTS[idx - 1].key);
                                }
                              }}
                              onJumpToSlot={(targetKey) => setActiveCraftKey(targetKey)}
                            />
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
      )}
    </div>
  );
}
