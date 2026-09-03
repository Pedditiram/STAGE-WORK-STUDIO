/**
 * Stage Production Studio — Seedance 2.5 video prompt compiler.
 * Lean formula: Subject + Action + Scene + Style + Camera + Audio
 * (No full script dumps, bible novels, or psychology essays.)
 */

import { parseSceneAndShotID } from './sceneShotUtils';
import {
  bridgeLine,
  continuityStateLines,
  lookSheetLines,
  videoJobSlots
} from './continuitySpine';
import { loadDirectorPsychology } from './directorPsychologyStorage';
import {
  loadDoPVision,
  loadSoundVision,
  resolveCompilerVisionFields
} from './departmentVisionStorage';
import {
  getStoredWorldEnvironmentAssets,
  getActiveWorldAssetPrompt
} from '../components/WorldEnvironmentConsole';
import { readActiveAssetRegistry, resolveRegistryCharacters, resolveRegistryWorldAssets } from './assetRegistry';
import { getActiveCharacterProfiles } from './projectBibleVault';
import { referenceNameToAssetFilename } from './projectAssetRoots';

const SUBJECT_ROLE_LABELS = [
  'Lead Subject',
  'Co-Artist',
  'Action Ref / Prop',
  'Supporting Ref',
  'Crowd / Army',
  'Scene Environment',
  'Ambience / Haze',
  'Style & Color Ref',
  'VFX & Special FX'
];

function clip(str, max = 160) {
  const t = String(str || '')
    .replace(/\s+/g, ' ')
    .replace(/\[|\]/g, '')
    .trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
}

function cleanTag(str) {
  return String(str || '')
    .replace(/\[|\]|CharID:\s*/gi, '')
    .trim();
}

function sanitizeSubjectNameTag(str) {
  if (!str) return '';
  let cleaned = cleanTag(str).replace(/@/g, '');
  if (cleaned.includes(';')) cleaned = cleaned.split(';')[0].trim();
  if (cleaned.includes('|')) cleaned = cleaned.split('|')[0].trim();
  cleaned = cleaned.replace(
    /\s+(?:standing|riding|whipping|brandishing|fleeing|surviving|looking|moving|walking|running|fighting|holding|seated|watching|overlooking|defeating)\b.*$/i,
    ''
  );
  const words = cleaned.split(/\s+/);
  if (words.length > 4) cleaned = words.slice(0, 4).join(' ');
  return cleaned.trim();
}

function durationToSec(duration) {
  const m = String(duration || '').match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.round(parseFloat(m[1]))) : 4;
}

function resolveDuration(shot, fallbackSec) {
  let duration = fallbackSec ? `${fallbackSec}s` : '4s';
  if (shot.shotDurationAndImages) {
    const match = String(shot.shotDurationAndImages).match(
      /(?:Duration:\s*|Duration\s*=|\b)(\d+(?:\.\d+)?\s*s|\d+\s*sec|\d+\s*seconds?)/i
    );
    if (match) {
      duration = match[1].trim().replace(/\s+/g, '');
      if (!/s$/i.test(duration)) duration = `${duration}s`;
    } else if (typeof shot.shotDurationAndImages === 'string' && shot.shotDurationAndImages.trim()) {
      const firstToken = shot.shotDurationAndImages.trim().split('|')[0].trim();
      duration = firstToken.startsWith('Duration:')
        ? firstToken.replace(/Duration:\s*/i, '').trim()
        : firstToken;
    }
  }
  return duration;
}

function buildSubjectsMap(shot) {
  const subjectsMap = new Map();
  const rawMatrixStr = shot.characterIdMatrix || '';
  const shotTextContext = `
    ${shot.characterIdAssetRef || ''}
    ${shot.coArtistInteraction || ''}
    ${shot.actionEnvContext || ''}
    ${shot.characterDialogue || ''}
    ${shot.characterMovement || ''}
    ${shot.characterExpression || ''}
    ${shot.sceneShotId || ''}
  `.toLowerCase();

  if (rawMatrixStr.includes('Image_')) {
    const parts = rawMatrixStr.split('|').map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => {
      const m = p.match(/Image_(\d+)\s*=\s*(.*)/i);
      if (m) {
        const num = parseInt(m[1], 10);
        const val = m[2].trim();
        if (val && val !== 'Image_') {
          const cleanVal = val.toLowerCase().replace(/\[|\]|charid:\s*|@/g, '').trim();
          const isGenericEnv =
            num === 5 ||
            num === 6 ||
            cleanVal === 'scene' ||
            cleanVal === 'crowd' ||
            cleanVal === 'environment';
          const isMentioned =
            shotTextContext.includes(cleanVal) ||
            cleanVal.split(/\s+/).some((token) => token.length >= 4 && shotTextContext.includes(token));
          if (isMentioned || isGenericEnv) subjectsMap.set(num, val);
        }
      }
    });
  }

  const rawImagesStr = shot.shotDurationAndImages || '';
  for (const match of rawImagesStr.matchAll(/Image_(\d+):\s*(@[A-Za-z0-9_]+)/g)) {
    const imgNum = parseInt(match[1], 10);
    if (!subjectsMap.has(imgNum)) {
      const tag = match[2].replace('@', '').toLowerCase();
      let cleanName = tag.split('_')[0];
      if (cleanName === 'rooster' || cleanName === 'arena') cleanName = tag.replace(/_/g, ' ');
      if (shotTextContext.includes(cleanName) || imgNum >= 5) {
        subjectsMap.set(imgNum, cleanName);
      }
    }
  }

  if (!subjectsMap.has(1) && shot.characterIdAssetRef) {
    subjectsMap.set(1, cleanTag(shot.characterIdAssetRef).split('_')[0]);
  }
  if (!subjectsMap.has(2) && shot.coArtistInteraction) {
    subjectsMap.set(2, cleanTag(shot.coArtistInteraction).split('_')[0]);
  }

  return subjectsMap;
}

/** One-line visual locks for characters actually in the shot (no backstory essays). */
function buildCharacterVisualLocks(shot) {
  const includeChars =
    typeof window === 'undefined' || localStorage.getItem('sps_include_characters_in_prompt') !== 'false';
  if (!includeChars || typeof window === 'undefined') return [];

  try {
    const registry = readActiveAssetRegistry();
    const assetIds = Array.isArray(shot?.charAssetIds) ? shot.charAssetIds : [];
    if (registry && assetIds.length) {
      const charProfiles = getActiveCharacterProfiles();
      return resolveRegistryCharacters(registry, assetIds)
        .slice(0, 3)
        .map((entry) => {
          const full = Array.isArray(charProfiles)
            ? charProfiles.find(
                (c) =>
                  c.assetId === entry.assetId ||
                  c.id === entry.legacyId ||
                  (c.tag && entry.tag && c.tag.toLowerCase() === entry.tag.toLowerCase())
              )
            : null;
          const char = full || entry;
          const bits = [];
          if (char.mannerism) bits.push(clip(char.mannerism, 80));
          if (char.walkingStyle) bits.push(`gait: ${clip(char.walkingStyle, 60)}`);
          if (!bits.length && char.shotPurpose) bits.push(clip(char.shotPurpose, 80));
          const label = char.tag || char.name || entry.assetId || 'Character';
          return bits.length ? `${label} (${entry.assetId}): ${bits.join('; ')}` : `${label} (${entry.assetId})`;
        })
        .filter(Boolean);
    }

    const charProfiles = getActiveCharacterProfiles();
    if (!Array.isArray(charProfiles) || charProfiles.length === 0) return [];

    const refText = `
      ${shot.characterIdAssetRef || ''}
      ${shot.coArtistInteraction || ''}
      ${shot.characterIdMatrix || ''}
      ${shot.shotDurationAndImages || ''}
    `.toLowerCase();

    const matchCharacter = (char) => {
      const tag = (char.tag || '').toLowerCase().replace(/@/g, '').trim();
      const name = (char.name || '').toLowerCase().trim();
      const id = (char.id || '').toLowerCase().trim();
      const assetId = (char.assetId || '').toLowerCase().trim();
      if (assetId && refText.includes(assetId)) return true;
      if (tag && refText.includes(tag)) return true;
      if (name && refText.includes(name)) return true;
      if (id && refText.includes(id)) return true;
      return false;
    };

    return charProfiles
      .filter(matchCharacter)
      .slice(0, 3)
      .map((char) => {
        const bits = [];
        if (char.mannerism) bits.push(clip(char.mannerism, 80));
        if (char.walkingStyle) bits.push(`gait: ${clip(char.walkingStyle, 60)}`);
        if (!bits.length && char.shotPurpose) bits.push(clip(char.shotPurpose, 80));
        const label = char.tag || char.name || 'Character';
        const idSuffix = char.assetId ? ` (${char.assetId})` : '';
        return bits.length ? `${label}${idSuffix}: ${bits.join('; ')}` : '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Short environment lock from World vault (no URLs / plate essays). */
function buildWorldLock(shot) {
  const includeWorld =
    typeof window === 'undefined' || localStorage.getItem('sps_include_world_in_prompt') !== 'false';
  if (!includeWorld) return '';

  try {
    const registry = readActiveAssetRegistry();
    const assetIds = Array.isArray(shot?.worldAssetIds) ? shot.worldAssetIds : [];
    if (registry && assetIds.length) {
      const worldAssets = getStoredWorldEnvironmentAssets().filter((a) => a && a.includeInPrompt !== false);
      const entry = resolveRegistryWorldAssets(registry, assetIds)[0];
      if (entry) {
        const asset =
          worldAssets.find(
            (a) =>
              a.assetId === entry.assetId ||
              a.id === entry.legacyId ||
              (a.tag && entry.tag && a.tag.toLowerCase() === entry.tag.toLowerCase())
          ) || entry;
        const bits = [];
        if (asset.description) bits.push(clip(asset.description, 120));
        if (asset.weather) bits.push(clip(asset.weather, 40));
        if (asset.timeOfDay) bits.push(clip(asset.timeOfDay, 40));
        const plate = getActiveWorldAssetPrompt(asset);
        if (plate && plate.length <= 100) bits.push(clip(plate, 100));
        const label = asset.name || asset.tag || entry.assetId;
        return bits.length ? `${label} (${entry.assetId}): ${bits.join(' · ')}` : `${label} (${entry.assetId})`;
      }
    }

    const worldAssets = getStoredWorldEnvironmentAssets().filter((a) => a && a.includeInPrompt !== false);
    if (!worldAssets.length) return '';

    const envRef =
      `${shot.actionEnvContext || ''} ${shot.timeAndLightingEnv || ''} ${shot.atmosphereVolumetricsTag || ''}`.toLowerCase();
    const matched = worldAssets.filter((asset) => {
      const hay = `${asset.name || ''} ${asset.tag || ''} ${asset.description || ''} ${asset.type || ''}`.toLowerCase();
      if (!envRef.trim()) return true;
      const tokens = hay.split(/[^a-z0-9\u0C00-\u0C7F]+/).filter((t) => t.length >= 4);
      return (
        tokens.some((t) => envRef.includes(t)) ||
        envRef.includes(String(asset.tag || '').replace(/@/g, '').toLowerCase())
      );
    });
    const asset = (matched[0] || worldAssets[0]);
    if (!asset) return '';

    const bits = [];
    if (asset.description) bits.push(clip(asset.description, 120));
    if (asset.weather) bits.push(clip(asset.weather, 40));
    if (asset.timeOfDay) bits.push(clip(asset.timeOfDay, 40));
    // Prefer short active plate line only if tiny
    const plate = getActiveWorldAssetPrompt(asset);
    if (plate && plate.length <= 100) bits.push(clip(plate, 100));
    return bits.length ? `${asset.name || asset.tag}: ${bits.join(' · ')}` : '';
  } catch {
    return '';
  }
}

function buildMoodHint(projectTitle) {
  if (typeof window === 'undefined') return '';
  try {
    const savedPsych = loadDirectorPsychology(projectTitle);
    if (!savedPsych) return '';
    const parsed = JSON.parse(savedPsych);
    if (!parsed) return '';
    const vision = resolveCompilerVisionFields(parsed);
    const mood =
      vision?.emotionalFrequencyTarget ||
      parsed.emotionalFrequencyTarget ||
      vision?.corePhilosophicalIdea ||
      '';
    return clip(mood, 90);
  } catch {
    return '';
  }
}

function includeDoPInPrompt() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('sps_include_dop_in_prompt') !== 'false';
}

function includeSoundInPrompt() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('sps_include_sound_in_prompt') !== 'false';
}

function buildDoPHint(projectTitle) {
  if (!includeDoPInPrompt()) return { camera: '', look: '', lens: '' };
  try {
    const raw = loadDoPVision(projectTitle);
    if (!raw) return { camera: '', look: '', lens: '' };
    const parsed = JSON.parse(raw);
    const v = resolveCompilerVisionFields(parsed);
    if (!v) return { camera: '', look: '', lens: '' };
    return {
      camera: clip(v.cameraMovementEnergy, 90),
      look: clip([v.lightingPhilosophy, v.colorScienceTexture].filter(Boolean).join('; '), 140),
      lens: clip(v.lensAspectRules, 100)
    };
  } catch {
    return { camera: '', look: '', lens: '' };
  }
}

function buildSoundHint(projectTitle) {
  if (!includeSoundInPrompt()) {
    return { score: '', foley: '', rhythm: '', dialogue: '' };
  }
  try {
    const raw = loadSoundVision(projectTitle);
    if (!raw) return { score: '', foley: '', rhythm: '', dialogue: '' };
    const parsed = JSON.parse(raw);
    const v = resolveCompilerVisionFields(parsed);
    if (!v) return { score: '', foley: '', rhythm: '', dialogue: '' };
    return {
      score: clip(v.musicalMotifScore, 90),
      foley: clip(v.foleySoundEnvironment, 90),
      rhythm: clip(v.rhythmTempoSync, 100),
      dialogue: clip(v.vocalDialogueResonance, 70)
    };
  } catch {
    return { score: '', foley: '', rhythm: '', dialogue: '' };
  }
}

function buildPerformanceLine(shot) {
  const parts = [];
  if (shot.characterMovement) parts.push(clip(shot.characterMovement, 140));
  if (shot.characterExpression) {
    parts.push(`expression: ${clip(shot.characterExpression, 80)}`);
  }
  if (shot.characterMannerismAndPosture) {
    parts.push(`posture: ${clip(shot.characterMannerismAndPosture, 80)}`);
  }
  if (shot.characterEyeLooks) parts.push(`gaze: ${clip(shot.characterEyeLooks, 60)}`);
  if (shot.characterPlacement) parts.push(`placement: ${clip(shot.characterPlacement, 60)}`);
  // Emotion → visible performance (Seedance prefers this over abstract labels)
  if (shot.characterPsychologyState && !shot.characterExpression) {
    parts.push(`performance: ${clip(shot.characterPsychologyState, 80)}`);
  }
  return parts.join('. ');
}

function buildAudioBlock(shot, projectTitle = '') {
  const lines = [];
  const sound = buildSoundHint(projectTitle);
  const dialogue = clip(shot.characterDialogue, 200);
  if (sound.foley) lines.push(`<${sound.foley}>`);
  if (dialogue) {
    const looksTelugu = /[\u0C00-\u0C7F]/.test(dialogue);
    lines.push(
      looksTelugu
        ? `Dialogue language: Telugu, natural dramatic delivery`
        : `Dialogue language: match the line, natural cinematic delivery`
    );
    if (sound.dialogue) lines.push(`Delivery: ${sound.dialogue}`);
    lines.push(`{${dialogue.replace(/^["']|["']$/g, '')}}`);
  } else if (sound.dialogue) {
    lines.push(`Delivery: ${sound.dialogue}`);
  }
  if (sound.score) lines.push(`Score motif: ${sound.score}`);
  if (sound.rhythm) lines.push(clip(sound.rhythm, 100));
  const atmo = clip(String(shot.atmosphereVolumetricsTag || '').replace(/\[|\]/g, ''), 100);
  if (atmo) lines.push(`<${atmo}>`);
  return lines.join('\n');
}

function buildSequence(shot, duration, framing, motion, performance) {
  const sec = durationToSec(duration);
  const action = performance || clip(shot.characterMovement, 120) || 'holds presence in frame';
  const cam = clip(motion, 80) || 'locked / subtle move';
  const mid = Math.max(1, Math.floor(sec / 2));

  if (sec <= 5) {
    return [
      `0–${sec}s: ${action}. Camera: ${framing}, ${cam}.`,
      `End state: clear readable pose; subject identity stable; action completed.`
    ].join('\n');
  }

  return [
    `0–${mid}s: establish subject and start action — ${clip(action, 100)}. Camera: ${framing}, ${cam}.`,
    `${mid}–${sec}s: complete the beat; intensify performance / reaction.`,
    `End state: decisive final pose; framing holds; no identity drift.`
  ].join('\n');
}

/**
 * Seedance 2.5–framed video prompt for one Matrix shot.
 */
export function compileMasterCinemaCompilerPrompt(
  shot = {},
  shotIdx = 0,
  {
    projectTitle = 'Project',
    scriptSynopsisSource,
    writerCustomScriptSynopsis,
    durationOverrideSec = null,
    promoContext = null,
    shots = null
  } = {}
) {
  const parsedId = parseSceneAndShotID(shot, shotIdx);
  const scShNumber = parsedId.formattedId;
  const framing = clip(shot.shotComposition || 'Medium Shot', 60);
  const motion = clip(
    String(shot.cameraMotionTag || 'Tracking Shot')
      .replace(/\[Camera:\s*/g, '')
      .replace(/\]/g, ''),
    80
  );
  const lighting = clip(String(shot.subjectLightingTag || '').replace(/\[|\]/g, ''), 70);
  const color = clip(String(shot.subjectColorTag || '').replace(/\[|\]/g, ''), 70);
  const bgLighting = clip(String(shot.backgroundLightingTag || '').replace(/\[|\]/g, ''), 60);
  const bgColor = clip(String(shot.backgroundColorTag || '').replace(/\[|\]/g, ''), 60);
  const env = clip(shot.actionEnvContext || 'Dramatic cinematic environment', 180);
  const timeWeather = clip(shot.timeAndLightingEnv, 100);
  const dirLight = clip(shot.directionalLightingAndHighlight, 100);
  const duration = resolveDuration(shot, durationOverrideSec);

  const subjectsMap = buildSubjectsMap(shot);
  const jobSlots = Array.isArray(shots) ? videoJobSlots(shot, shots, shotIdx) : [];
  const referenceLines = [];
  if (jobSlots.length) {
    jobSlots.forEach((s) => {
      referenceLines.push(`Image_${s.n} (${s.role}): attach ${s.file} — identity / look lock`);
    });
  } else {
    for (let i = 1; i <= 9; i++) {
      const rawVal = subjectsMap.get(i);
      if (!rawVal) continue;
      const name = sanitizeSubjectNameTag(rawVal);
      if (!name) continue;
      const file = referenceNameToAssetFilename(name);
      referenceLines.push(
        `Image_${i} (${SUBJECT_ROLE_LABELS[i - 1]}): ${name} — save as ${file || 'subject.png'}`
      );
    }
  }

  const lead = sanitizeSubjectNameTag(subjectsMap.get(1) || shot.characterIdAssetRef || 'Lead subject');
  const co = sanitizeSubjectNameTag(subjectsMap.get(2) || shot.coArtistInteraction || '');
  const performance = buildPerformanceLine(shot);
  const charLocks = buildCharacterVisualLocks(shot);
  const worldLock = buildWorldLock(shot);
  const mood = buildMoodHint(projectTitle);
  const dop = buildDoPHint(projectTitle);
  const soundHint = buildSoundHint(projectTitle);
  const audio = buildAudioBlock(shot, projectTitle);

  const subjectActionParts = [];
  subjectActionParts.push(lead || 'Lead subject');
  if (co) subjectActionParts.push(`with ${co}`);
  if (performance) subjectActionParts.push(performance);
  else subjectActionParts.push('holds cinematic presence');
  const subjectAction = subjectActionParts.join(' — ');

  const sceneParts = [env];
  if (timeWeather) sceneParts.push(timeWeather);
  if (worldLock) sceneParts.push(worldLock);

  const styleParts = [];
  if (lighting) styleParts.push(`subject light: ${lighting}`);
  if (color) styleParts.push(`grade: ${color}`);
  if (bgLighting) styleParts.push(`bg light: ${bgLighting}`);
  if (bgColor) styleParts.push(`bg grade: ${bgColor}`);
  if (dirLight) styleParts.push(dirLight);
  if (mood) styleParts.push(`mood: ${mood}`);
  if (dop.look) styleParts.push(`DoP look: ${dop.look}`);
  styleParts.push('photoreal cinematic, coherent continuity');

  const sequence = buildSequence(shot, duration, framing, motion, performance);

  const constraintParts = [
    'Keep Image reference identities stable for the full clip',
    'One clear primary action — no montage clutter',
    'No on-screen UI, logos, or burned-in subtitles unless requested'
  ];
  if (promoContext?.vertical) {
    constraintParts.push('Frame 9:16; keep faces and action in the vertical safe area');
    constraintParts.push('Promo pacing — start in motion; land a readable end pose');
  } else if (promoContext) {
    constraintParts.push('Promo beat — one event, theatrical continuity, hard end state');
  }
  if (charLocks.length) constraintParts.unshift(...charLocks.map((l) => `Lock ${l}`));
  const safeShots = Array.isArray(shots) ? shots : [];
  lookSheetLines(shot, safeShots, shotIdx).forEach((line) => constraintParts.unshift(line));
  continuityStateLines(shot, safeShots, shotIdx, { projectTitle }).forEach((line) =>
    constraintParts.unshift(line)
  );
  const bridgedNote = bridgeLine(shot, safeShots, shotIdx);
  if (bridgedNote) constraintParts.unshift(bridgedNote);

  // Compact narrative paragraph (also used as imagePrompt / 3D stage context)
  const mainPrompt = [
    `${subjectAction}.`,
    `Scene: ${sceneParts.join('. ')}.`,
    `Camera: ${framing}; ${motion}.`,
    `Look: ${styleParts.join('; ')}.`,
    audio ? `Audio: ${audio.replace(/\n/g, ' ')}` : ''
  ]
    .filter(Boolean)
    .join(' ');

  const promoLine = promoContext
    ? `${promoContext.kind || 'Promo'} · ${promoContext.segment || 'Beat'}${promoContext.aspect ? ` · ${promoContext.aspect}` : ''}`
    : '';
  const intent = promoContext
    ? `Promo clip — ${promoLine}. One continuous cinematic beat. Prioritize identity lock, clear action, and a hard end pose.`
    : `Generate one continuous cinematic video clip for this shot. Prioritize subject identity, clear action, and camera continuity.`;
  const cameraLine = promoContext?.vertical
    ? `${framing}. Movement: ${motion}${dop.camera ? `; DoP: ${dop.camera}` : ''}. Aspect: 9:16 vertical.`
    : `${framing}. Movement: ${motion}${dop.camera ? `; DoP motion: ${dop.camera}` : ''}${dop.lens ? `. Lens: ${dop.lens}` : ''}.`;

  const master = `VIDEO PROMPT
Shot ${scShNumber} · ${duration} · ${projectTitle}${promoLine ? `\n${promoLine}` : ''}

INTENT
${intent}

${referenceLines.length ? `REFERENCES\n${referenceLines.join('\n')}\n\n` : ''}SUBJECT + ACTION
${subjectAction}

SCENE
${sceneParts.join('\n')}

STYLE
${styleParts.join('; ')}

CAMERA
${cameraLine}

SEQUENCE
${sequence}

${audio ? `AUDIO\n${audio}\n` : ''}CONSTRAINTS
${constraintParts.map((c) => `• ${c}`).join('\n')}
`.trim();

  // Keep lightweight fields for promo / UI compatibility (not dumped into master)
  const sceneSynopsis = clip(
    [env, performance, shot.characterDialogue].filter(Boolean).join(' · '),
    220
  );
  const scriptSynopsis =
    typeof window !== 'undefined' && localStorage.getItem('sps_include_story_in_prompt') === 'false'
      ? ''
      : clip(
          (scriptSynopsisSource === 'writer_custom' && writerCustomScriptSynopsis) ||
            (typeof window !== 'undefined' && localStorage.getItem('sps_extracted_master_story')) ||
            '',
          180
        );

  return {
    masterCinemaPrompt: master,
    scriptSynopsis,
    sceneSynopsis,
    directorPsychologyBlock: mood ? `Mood: ${mood}` : '',
    dopVisionBlock: dop.look ? `DoP: ${dop.look}${dop.camera ? ` · ${dop.camera}` : ''}` : '',
    soundVisionBlock: [soundHint.score, soundHint.foley].filter(Boolean).join(' · '),
    characterBible: charLocks.join('\n'),
    worldBible: worldLock,
    characterIdBlock: referenceLines.join('\n'),
    mainPrompt: mainPrompt.trim(),
    scShNumber,
    duration,
    shortLabel: `Shot ${scShNumber} · ${duration} · ${framing}`
  };
}

/** Merge promo beat edits onto a Matrix shot before compiling. */
export function mergePromoBeatOntoShot(shot, beat = {}) {
  const base = { ...(shot || {}) };
  if (beat.sceneShotId) base.sceneShotId = beat.sceneShotId;
  if (beat.composition) base.shotComposition = beat.composition;
  if (beat.camera) base.cameraMotionTag = beat.camera;
  if (beat.dialogue) base.characterDialogue = beat.dialogue;
  if (beat.action) {
    if (base.actionEnvContext && String(base.actionEnvContext).length > 40) {
      base.characterMovement = beat.action;
    } else {
      base.actionEnvContext = beat.action;
    }
  }
  if (beat.character) base.characterIdAssetRef = beat.character;
  if (beat.durationSec) {
    const existing = String(base.shotDurationAndImages || '');
    if (/Duration:/i.test(existing)) {
      base.shotDurationAndImages = existing.replace(
        /Duration:\s*[\d.]+s?/i,
        `Duration: ${beat.durationSec}s`
      );
    } else {
      base.shotDurationAndImages = `Duration: ${beat.durationSec}s${existing ? ` | ${existing}` : ''}`;
    }
  }
  return base;
}
