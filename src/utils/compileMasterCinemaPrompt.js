/**
 * Stage Production Studio — Master Cinema Compiler prompt
 * (Script Synopsis → Scene Synopsis → Director Psychology → Character/World Bible → Character ID → Prompt)
 * Shared by Prompt Compiler and Promo Pack.
 */

import { parseSceneAndShotID } from './sceneShotUtils';
import { loadDirectorPsychology } from './directorPsychologyStorage';
import {
  getStoredWorldEnvironmentAssets,
  getActiveWorldAssetPrompt
} from '../components/WorldEnvironmentConsole';
import {
  getCinematicReferences,
  formatReferencesForLLM
} from '../constants/cinematicReferences';

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

function sanitizeSubjectNameTag(str) {
  if (!str) return '';
  let cleaned = str.replace(/\[|\]|CharID:\s*|@/gi, '').trim();
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

function resolveScriptSynopsis({
  scriptSynopsisSource = 'auto_llm',
  writerCustomScriptSynopsis = ''
} = {}) {
  const includeStory =
    typeof window === 'undefined' || localStorage.getItem('sps_include_story_in_prompt') !== 'false';
  if (!includeStory) return '[Excluded by User Checkmark Toggle]';

  if (scriptSynopsisSource === 'writer_custom' && String(writerCustomScriptSynopsis || '').trim()) {
    return String(writerCustomScriptSynopsis).trim();
  }

  if (typeof window !== 'undefined') {
    const source =
      scriptSynopsisSource || localStorage.getItem('sps_script_synopsis_source') || 'auto_llm';
    const writerCustom =
      writerCustomScriptSynopsis || localStorage.getItem('sps_writer_custom_script_synopsis') || '';

    if (source === 'writer_custom' && writerCustom.trim()) {
      return writerCustom.trim();
    }

    const fullScriptCandidates = [
      localStorage.getItem('sps_extracted_master_story'),
      localStorage.getItem('sps_master_script_story'),
      localStorage.getItem('sps_current_screenplay_text'),
      localStorage.getItem('sps_narrative_prose_story'),
      localStorage.getItem('sps_extracted_script_story')
    ];

    for (const cand of fullScriptCandidates) {
      if (cand && cand.trim() && !cand.startsWith('Complete master script story arc and thematic overview')) {
        return cand.trim();
      }
    }

    try {
      const projLib = localStorage.getItem('sps_project_library');
      if (projLib) {
        const projects = JSON.parse(projLib);
        if (Array.isArray(projects) && projects[0]) {
          const p = projects[0];
          const fromProj = p.scriptText || p.masterStory || p.narrativeProse || p.description || '';
          if (fromProj.trim()) return fromProj.trim();
        }
      }
    } catch {
      /* ignore */
    }
  }

  return `Master Script Synopsis: The narrative arc follows the central protagonists through high-stakes dramatic conflicts, emotional character transformations, and pivotal turning points as events unfold in the story world.`;
}

function resolveSceneSynopsis(shot, shotIdx, shotId, env) {
  const includeStory =
    typeof window === 'undefined' || localStorage.getItem('sps_include_story_in_prompt') !== 'false';
  if (!includeStory) return '[Excluded by User Checkmark Toggle]';

  if (shot.sceneSynopsis && String(shot.sceneSynopsis).trim()) {
    return String(shot.sceneSynopsis).trim();
  }

  const sceneParts = [];
  sceneParts.push(`Scene Location & Context: ${env}`);
  if (shot.characterIdAssetRef) {
    sceneParts.push(`Featured Subject: ${String(shot.characterIdAssetRef).replace(/\[|\]/g, '')}`);
  }
  if (shot.characterMovement) {
    sceneParts.push(`Action Performance: ${shot.characterMovement}`);
  }
  if (shot.characterExpression) {
    sceneParts.push(`Facial Expression: ${shot.characterExpression}`);
  }
  if (shot.coArtistInteraction) {
    sceneParts.push(`Co-Artist Interaction: ${String(shot.coArtistInteraction).replace(/\[|\]/g, '')}`);
  }
  if (shot.characterDialogue) {
    sceneParts.push(`Dialogue Sync: "${String(shot.characterDialogue).replace(/"/g, '')}"`);
  }
  return `Shot #${shotIdx + 1} (${shotId}) Beat — ${sceneParts.join(' | ')}`;
}

function buildCharacterBible(shot) {
  const includeChars =
    typeof window === 'undefined' || localStorage.getItem('sps_include_characters_in_prompt') !== 'false';
  if (!includeChars) {
    return {
      block: `[Character Bible Vault Excluded by User Checkmark Toggle]`,
      storyNote: ''
    };
  }

  let characterBibleVaultBlock = '';
  let characterStoryNote = '';
  try {
    const storedCharsStr = localStorage.getItem('sps_character_bible_vault');
    if (storedCharsStr) {
      const charProfiles = JSON.parse(storedCharsStr);
      if (Array.isArray(charProfiles) && charProfiles.length > 0) {
        const matchCharacter = (char, refText) => {
          if (!refText) return false;
          const refLower = refText.toLowerCase();
          const tagLower = (char.tag || '').toLowerCase().replace(/@/g, '').trim();
          const nameLower = (char.name || '').toLowerCase().trim();
          const idLower = (char.id || '').toLowerCase().trim();
          if (tagLower && refLower.includes(tagLower)) return true;
          if (nameLower && refLower.includes(nameLower)) return true;
          if (idLower && refLower.includes(idLower)) return true;
          const tokens = [
            ...nameLower.split(/\s+/),
            ...tagLower.split(/\s+/),
            ...idLower.split(/[\s_]+/)
          ].filter((t) => t.length >= 3 && t !== 'hero' && t !== 'asset' && t !== 'char');
          return tokens.some((t) => refLower.includes(t));
        };

        const refText = `
          ${shot.characterIdAssetRef || ''}
          ${shot.coArtistInteraction || ''}
          ${shot.characterIdMatrix || ''}
          ${shot.shotDurationAndImages || ''}
        `;

        const matchingChars = charProfiles.filter((char) => matchCharacter(char, refText));
        const targetChars = matchingChars.length > 0 ? matchingChars : charProfiles;

        targetChars.forEach((char) => {
          const traits = [];
          if (char.backstory) traits.push(`Story: ${char.backstory}`);
          if (char.characterConnections) traits.push(`Connections: ${char.characterConnections}`);
          if (char.shotPurpose) traits.push(`Purpose: ${char.shotPurpose}`);
          if (char.mannerism) traits.push(`Mannerism: ${char.mannerism}`);
          if (char.walkingStyle) traits.push(`Gait: ${char.walkingStyle}`);
          if (traits.length > 0) {
            characterStoryNote += `[${char.name || char.tag} Persona & Purpose: ${traits.join(' | ')}] `;
          }

          characterBibleVaultBlock += `CHARACTER BIBLE PROFILE — ${char.name || char.tag} (${char.tag || '@CharID'}) :\n`;
          if (char.backstory) characterBibleVaultBlock += `  • Deep Backstory & Motivation: ${char.backstory}\n`;
          if (char.characterConnections) {
            characterBibleVaultBlock += `  • Character Connections: ${char.characterConnections}\n`;
          }
          if (char.shotPurpose) characterBibleVaultBlock += `  • Shot Presence Purpose: ${char.shotPurpose}\n`;
          if (char.mannerism) characterBibleVaultBlock += `  • Mannerisms & Gesture: ${char.mannerism}\n`;
          if (char.walkingStyle) characterBibleVaultBlock += `  • Gait / Movement Style: ${char.walkingStyle}\n`;
          if (char.uniqueVoice) {
            characterBibleVaultBlock += `  • Voice Cadence & Delivery: ${char.uniqueVoice} | ${char.dialogueDelivery || ''}\n\n`;
          }
        });
      }
    }
  } catch {
    /* ignore */
  }

  if (!characterBibleVaultBlock.trim()) {
    characterBibleVaultBlock =
      `[No Character Bible profiles extracted in vault yet. Open Character Vault tab to add profiles.]`;
  }

  return { block: characterBibleVaultBlock, storyNote: characterStoryNote };
}

function buildWorldBible(shot) {
  const includeWorld =
    typeof window === 'undefined' || localStorage.getItem('sps_include_world_in_prompt') !== 'false';
  if (!includeWorld) {
    return `[World & Environment Bible Excluded by User Checkmark Toggle]`;
  }

  let worldEnvironmentVaultBlock = '';
  try {
    const worldAssets = getStoredWorldEnvironmentAssets().filter((a) => a && a.includeInPrompt !== false);
    if (worldAssets.length > 0) {
      const envRef =
        `${shot.actionEnvContext || ''} ${shot.timeAndLightingEnv || ''} ${shot.atmosphereVolumetricsTag || ''}`.toLowerCase();
      const matched = worldAssets.filter((asset) => {
        const hay = `${asset.name || ''} ${asset.tag || ''} ${asset.description || ''} ${asset.type || ''}`.toLowerCase();
        if (!envRef.trim()) return true;
        const tokens = hay.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
        return (
          tokens.some((t) => envRef.includes(t)) ||
          envRef.includes(String(asset.tag || '').replace(/@/g, '').toLowerCase())
        );
      });
      const targets = matched.length > 0 ? matched : worldAssets.slice(0, 8);
      targets.forEach((asset) => {
        const platePrompt = getActiveWorldAssetPrompt(asset);
        worldEnvironmentVaultBlock += `WORLD ASSET — ${asset.name || asset.tag} (${asset.tag || '@World'}) [${asset.type || 'location'}] :\n`;
        if (asset.description) worldEnvironmentVaultBlock += `  • Visual Bible: ${asset.description}\n`;
        if (asset.weather) worldEnvironmentVaultBlock += `  • Weather: ${asset.weather}\n`;
        if (asset.timeOfDay) worldEnvironmentVaultBlock += `  • Time of Day: ${asset.timeOfDay}\n`;
        if (asset.materials) worldEnvironmentVaultBlock += `  • Materials: ${asset.materials}\n`;
        if (asset.lightingNotes) worldEnvironmentVaultBlock += `  • Plate Lighting: ${asset.lightingNotes}\n`;
        if (platePrompt) {
          worldEnvironmentVaultBlock += `  • Asset Image Prompt (${asset.promptSource === 'writer_custom' ? 'Writer' : 'AI'}): ${platePrompt}\n`;
        }
        if (asset.referenceImageUrl) {
          worldEnvironmentVaultBlock += `  • Reference Plate URL: ${asset.referenceImageUrl}\n`;
        }
        worldEnvironmentVaultBlock += '\n';
      });
    }
  } catch {
    /* ignore */
  }

  if (!worldEnvironmentVaultBlock.trim()) {
    return `[No World & Environment assets in vault yet. Open World Console (globe) to extract or add plates.]`;
  }
  return worldEnvironmentVaultBlock;
}

function buildDirectorPsychology(projectTitle) {
  if (typeof window === 'undefined') return '';
  try {
    const savedPsych = loadDirectorPsychology(projectTitle);
    if (!savedPsych) return '';
    const parsedPsych = JSON.parse(savedPsych);
    if (!parsedPsych) return '';
    const activeStreamKey = parsedPsych.compilerActiveMode || 'hybrid';
    let targetVision = parsedPsych[activeStreamKey] || parsedPsych.hybrid || parsedPsych.human || parsedPsych;
    if (!targetVision?.corePhilosophicalIdea && parsedPsych.corePhilosophicalIdea) {
      targetVision = parsedPsych;
    }
    if (!targetVision?.corePhilosophicalIdea) return '';
    return `DIRECTOR'S CORE SCRIPT PSYCHOLOGY & THEMATIC VISION [${activeStreamKey.toUpperCase()} STREAM] :
  • Underlying Core Idea & Soul: ${targetVision.corePhilosophicalIdea}
  • Director's Belief of Success: ${targetVision.directorBeliefOfSuccess || 'N/A'}
  • Subconscious Emotional Frequency: ${targetVision.emotionalFrequencyTarget || 'N/A'}
  • Directorial Production Rules: ${targetVision.directorialRules || 'N/A'}`;
  } catch {
    return '';
  }
}

function buildSubjectsLines(shot) {
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
            cleanVal === 'environment' ||
            cleanVal === 'forest trail';
          const isMentionedInShot =
            shotTextContext.includes(cleanVal) ||
            cleanVal.split(/\s+/).some((token) => token.length >= 4 && shotTextContext.includes(token));
          if (isMentionedInShot || isGenericEnv) {
            subjectsMap.set(num, val);
          }
        }
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
        if (shotTextContext.includes(cleanName) || imgNum >= 5) {
          subjectsMap.set(imgNum, cleanName);
        }
      }
    }
  }

  if (!subjectsMap.has(1) && shot.characterIdAssetRef) {
    const cleanRef = String(shot.characterIdAssetRef)
      .replace(/\[|\]|CharID:\s*|@/g, '')
      .trim()
      .split('_')[0];
    if (cleanRef) subjectsMap.set(1, cleanRef);
  }

  if (!subjectsMap.has(2) && shot.coArtistInteraction) {
    const cleanCo = String(shot.coArtistInteraction)
      .replace(/\[|\]|CharID:\s*|@/g, '')
      .trim()
      .split('_')[0];
    if (cleanCo) subjectsMap.set(2, cleanCo);
  }

  const subjectsLines = [];
  for (let i = 1; i <= 9; i++) {
    const rawVal = subjectsMap.get(i) || '';
    const cleanVal = sanitizeSubjectNameTag(rawVal);
    const role = SUBJECT_ROLE_LABELS[i - 1];
    subjectsLines.push(`Image_${i} (${role}) = ${cleanVal}`);
  }
  return subjectsLines;
}

function resolveDuration(shot, fallbackSec) {
  let duration = fallbackSec ? `${fallbackSec}s` : '4s';
  if (shot.shotDurationAndImages) {
    const match = String(shot.shotDurationAndImages).match(
      /(?:Duration:\s*|Duration\s*=|\b)(\d+(?:\.\d+)?\s*s|\d+\s*sec|\d+\s*seconds?)/i
    );
    if (match) {
      duration = match[1].trim();
    } else if (typeof shot.shotDurationAndImages === 'string' && shot.shotDurationAndImages.trim()) {
      const firstToken = shot.shotDurationAndImages.trim().split('|')[0].trim();
      duration = firstToken.startsWith('Duration:')
        ? firstToken.replace('Duration:', '').trim()
        : firstToken;
    }
  }
  return duration;
}

/**
 * Full Compiler-framed Master Cinema prompt for one Matrix shot.
 */
export function compileMasterCinemaCompilerPrompt(
  shot = {},
  shotIdx = 0,
  {
    projectTitle = 'Project',
    scriptSynopsisSource,
    writerCustomScriptSynopsis,
    durationOverrideSec = null
  } = {}
) {
  const parsedId = parseSceneAndShotID(shot, shotIdx);
  const shotId = parsedId.shortId;
  const scShNumber = parsedId.formattedId;
  const framing = shot.shotComposition || 'Medium Shot';
  const motion = String(shot.cameraMotionTag || 'Tracking Shot')
    .replace(/\[Camera:\s*/g, '')
    .replace(/\]/g, '');
  const lighting = String(shot.subjectLightingTag || 'Golden Hour').replace(/\[|\]/g, '');
  const color = String(shot.subjectColorTag || 'Vibrant Cinema').replace(/\[|\]/g, '');
  const env = shot.actionEnvContext || 'Dramatic stage environment';
  const bgLighting = String(shot.backgroundLightingTag || 'Ambient Fill').replace(/\[|\]/g, '');
  const bgColor = String(shot.backgroundColorTag || 'Muted Slate').replace(/\[|\]/g, '');

  const duration = resolveDuration(shot, durationOverrideSec);
  const scriptSynopsis = resolveScriptSynopsis({ scriptSynopsisSource, writerCustomScriptSynopsis });
  const sceneSynopsis = resolveSceneSynopsis(shot, shotIdx, shotId, env);
  const { block: characterBibleVaultBlock, storyNote: characterStoryNote } = buildCharacterBible(shot);
  const worldEnvironmentVaultBlock = buildWorldBible(shot);
  const directorPsychologyBlock = buildDirectorPsychology(projectTitle);
  const subjectsLines = buildSubjectsLines(shot);

  let cinematicReferencesBlock = '';
  try {
    const refs = getCinematicReferences({
      genreKey:
        (typeof window !== 'undefined' && localStorage.getItem('sps_preset_profile')) ||
        'mythological',
      projectTitle,
      sectionId: 'compiler',
      limitPerCategory: 4
    });
    const formatted = formatReferencesForLLM(refs, { maxItems: 3 });
    if (formatted) {
      cinematicReferencesBlock = `CINEMATIC REFERENCES (STYLE DNA — TASTE ANCHORS ONLY) :
${formatted}`;
    }
  } catch {
    cinematicReferencesBlock = '';
  }

  let mainPrompt = `A cinematic ${framing.toLowerCase()} (${scShNumber}). Duration: ${duration}. `;
  if (env) mainPrompt += `Environment: ${env}. `;
  if (shot.timeAndLightingEnv) mainPrompt += `Weather & Time Setup: ${shot.timeAndLightingEnv}. `;
  if (shot.directionalLightingAndHighlight) {
    mainPrompt += `Directional Light & Highlight Rig: ${shot.directionalLightingAndHighlight}. `;
  }
  if (characterStoryNote) mainPrompt += `${characterStoryNote.trim()}. `;
  if (shot.characterIdAssetRef) mainPrompt += `Featuring ${shot.characterIdAssetRef}. `;
  if (shot.coArtistInteraction) mainPrompt += `Co-artist interaction: ${shot.coArtistInteraction}. `;
  if (motion) mainPrompt += `Camera moves with ${motion}. `;
  if (lighting) mainPrompt += `Subject lighting: ${lighting}. `;
  if (color) mainPrompt += `Subject color grading: ${color}. `;
  if (bgLighting) mainPrompt += `Background lighting: ${bgLighting}. `;
  if (bgColor) mainPrompt += `Background color grading: ${bgColor}. `;
  if (shot.atmosphereVolumetricsTag) {
    mainPrompt += `Atmosphere: ${String(shot.atmosphereVolumetricsTag).replace(/\[|\]/g, '')}. `;
  }
  if (shot.characterMovement) mainPrompt += `Action performance: ${shot.characterMovement}. `;
  if (shot.characterPsychologyState) mainPrompt += `Psychological Mindstate: ${shot.characterPsychologyState}. `;
  if (shot.characterMannerismAndPosture) {
    mainPrompt += `Mannerisms & Posture: ${shot.characterMannerismAndPosture}. `;
  }
  if (shot.characterExpression) mainPrompt += `Facial expression: ${shot.characterExpression}. `;
  if (shot.characterPlacement) mainPrompt += `Placement: ${shot.characterPlacement}. `;
  if (shot.characterEyeLooks) mainPrompt += `Eye gaze: ${shot.characterEyeLooks}. `;
  if (shot.characterDialogue) mainPrompt += `Vocal sync: ${shot.characterDialogue}. `;

  const master = `======================================================================
Script Synopsis:
${scriptSynopsis.trim()}

Scene Synopsis:
${sceneSynopsis.trim()}

${directorPsychologyBlock ? directorPsychologyBlock.trim() + '\n\n' : ''}${cinematicReferencesBlock ? cinematicReferencesBlock.trim() + '\n\n' : ''}Character Bible:
${characterBibleVaultBlock.trim()}

World & Environment Bible:
${worldEnvironmentVaultBlock.trim()}

Character ID:
${subjectsLines.join('\n')}

Prompt:
SHOT NUMBER: ${scShNumber} | DURATION: ${duration}

${mainPrompt.trim()}
======================================================================`;

  return {
    masterCinemaPrompt: master,
    scriptSynopsis,
    sceneSynopsis,
    directorPsychologyBlock,
    characterBible: characterBibleVaultBlock,
    worldBible: worldEnvironmentVaultBlock,
    characterIdBlock: subjectsLines.join('\n'),
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
    // Prefer as movement if env already rich; else env context
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
