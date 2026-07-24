import React, { useState } from 'react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import { X, Copy, Download, Check, Sparkles, Code, FileSpreadsheet, FileText, Cpu, Image as ImageIcon, Disc, Film } from 'lucide-react';

export default function PromptCompilerModal({ isOpen, onClose, shots, activeTargetModel = "Seedance 2.0" }) {
  const [formatMode, setFormatMode] = useState('engine_optimized');
  const [copied, setCopied] = useState(false);

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

  // Single shot SeeDream 5.0 compilation
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

  // Beat-by-Beat Multi-Keyframe SeeDream 5.0 Deconstruction Engine
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

  // NEW: FIRST FRAME & LAST FRAME KEYFRAME INTERPOLATION COMPILER
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

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = formatMode === 'json' ? 'json' : (formatMode === 'csv' ? 'csv' : 'txt');
    const blob = new Blob([compiledOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stage_production_studio_prompts.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Stage Production Studio Compiler
              </h3>
              <p className="text-xs text-zinc-400">
                Export shot sheets in standard SPS tagged format, First/Last frame keyframes, beat breakdowns, JSON, or CSV.
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

        {/* Format Selector Tabs */}
        <div className="p-4 bg-zinc-900/40 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
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
              ⚡ Optimized Target Syntax
            </button>

            {/* NEW: FIRST FRAME & LAST FRAME INTERPOLATION TAB */}
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
              🎬 First & Last Frame Prompts
            </button>

            {/* BEAT-BY-BEAT MULTI-KEYFRAME DECONSTRUCTION TAB */}
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

            {/* SINGLE IMAGE GENERATION TAB */}
            <button
              type="button"
              onClick={() => setFormatMode('seedream_image')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                formatMode === 'seedream_image'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
              🖼️ Image Generation
            </button>

            <button
              type="button"
              onClick={() => setFormatMode('seedance_tagged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                formatMode === 'seedance_tagged'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              SPS Standard Tagged
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              {copied ? 'Copied!' : 'Copy Prompt Text'}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-medium flex items-center gap-1.5 shadow transition-all"
            >
              <Download className="w-4 h-4" />
              Download File
            </button>
          </div>
        </div>

        {/* Modal Output Codebox */}
        <div className="p-5 flex-1 overflow-y-auto bg-zinc-950">
          <pre className="w-full h-full p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 font-mono text-xs text-amber-200/90 leading-relaxed shadow-inner overflow-x-auto whitespace-pre-wrap">
            {compiledOutput}
          </pre>
        </div>
      </div>
    </div>
  );
}
