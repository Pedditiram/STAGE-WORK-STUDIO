/**
 * Build context-faithful cinematic image prompts from Stage Production craft slots.
 * Fixes out-of-context generations (wrong subject, ignored OTS framing, metadata soup).
 */

function getCharacterProfiles() {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('sps_character_bible_vault');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

const stripBrackets = (val = '') => String(val).replace(/\[|\]/g, ' ').replace(/\s+/g, ' ').trim();

const stripCraftLabels = (val = '') =>
  stripBrackets(val)
    .replace(
      /^(Lighting|Subject Color|BG Lighting|BG Color|CharID|Eye Look|Camera|Co-Artist|Weather|Timing|Env|Angle|Shadow|Highlight|Mannerism|Mindstate|Makeup|SFX|Score|VFX|Stunt|Palette|Atmosphere|BG Color|BG Lighting)\s*:\s*/gi,
      ''
    )
    .replace(/\s*•\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

/** Remove production-meta noise that confuses image models. */
export function cleanSceneText(raw = '') {
  let s = stripCraftLabels(raw);
  s = s.replace(/^Scene Location & Context:\s*/i, '');
  s = s.replace(/Featuring\s*CharID:?\s*@?[\w_]*/gi, '');
  s = s.replace(/Duration[:\s]*\d+:\d+\s*min/gi, '');
  s = s.replace(/\b\d+\s*MIN\b/gi, '');
  s = s.replace(/Structure\s+\d+\s*Acts?[^.|]*/gi, '');
  s = s.replace(/\d+\s*Scenes?\s*[·•|,]\s*\d+\s*Shots?/gi, '');
  s = s.replace(/ACTION SCRIPT/gi, '');
  s = s.replace(/\bRAMAYANA\b/gi, 'ancient Indian Ramayana epic setting');
  s = s.replace(/Complete shot-by-shot breakdown[^.|]*/gi, '');
  s = s.replace(/Colour-coded by character:[^.|]*/gi, '');
  s = s.replace(/Color-coded by character:[^.|]*/gi, '');
  s = s.replace(/\d+\s*sec\s*[·•]\s*/gi, '');
  s = s.replace(/S\d{2}-[A-Z]\s+\d+:\d+[–-]\d+:\d+/gi, '');
  s = s.replace(/SC\.?\d+\s+\d+:\d+[–-]\d+:\d+/gi, '');
  s = s.replace(/\s*[·|]\s*/g, '. ');
  s = s.replace(/(?:\s*\.\s*)+/g, '. ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/^[.\s,]+|[.\s,]+$/g, '').trim();
  return s;
}

/** Expand composition codes into camera instructions models actually follow. */
export function expandCompositionFraming(composition = '') {
  const c = String(composition).toLowerCase();
  const raw = stripCraftLabels(composition);

  if (c.includes('ots') || c.includes('over-the-shoulder') || c.includes('over the shoulder')) {
    return (
      'STRICT Over-The-Shoulder (OTS) composition: camera placed behind a foreground shoulder and partial back-of-head ' +
      '(soft out-of-focus silhouette occupying the near edge of frame), looking past them toward the main subject in deeper focus; ' +
      'rule-of-thirds subject placement; strong foreground-to-background depth compression; ' +
      'NOT a frontal portrait, NOT both eyes facing camera, NOT a centered talking-head'
    );
  }
  if (c.includes('ecu') || c.includes('extreme close')) {
    return 'Extreme close-up: eyes and facial detail fill the frame, intimate macro focus';
  }
  if (c.includes('mcu') || c.includes('medium close')) {
    return 'Medium close-up: chest-up framing with face dominant';
  }
  if (/\bcu\b/.test(c) || c.includes('close-up') || c.includes('close up')) {
    return 'Tight close-up: face and shoulders, shallow depth of field';
  }
  if (c.includes('ews') || c.includes('extreme wide') || c.includes('aerial')) {
    return 'Extreme wide / aerial establishing shot: vast environment scale, figures small in frame';
  }
  if (/\bws\b/.test(c) || c.includes('wide shot') || c.includes('wide establishing')) {
    return 'Wide shot: full body and surrounding environment clearly readable';
  }
  if (c.includes('low-angle') || c.includes('low angle')) {
    return 'Dramatic low-angle camera looking upward at the subject';
  }
  if (c.includes('high-angle') || c.includes('high angle')) {
    return 'High-angle camera looking down onto the subject';
  }
  if (/\bms\b/.test(c) || c.includes('medium shot')) {
    return 'Medium shot: waist-up framing with readable environment behind the subject';
  }
  return `Cinematic framing per shot card: ${raw || 'Medium Shot'}`;
}

function lookupCharacterBible(charRef = '') {
  const profiles = getCharacterProfiles();
  if (!Array.isArray(profiles) || profiles.length === 0) return null;
  const ref = String(charRef);
  const tagMatch = ref.match(/@[\w]+/);
  const tag = tagMatch ? tagMatch[0] : '';
  return (
    profiles.find((c) => tag && c.tag === tag) ||
    profiles.find((c) => c.tag && ref.includes(c.tag)) ||
    profiles.find((c) => c.name && ref.toLowerCase().includes(String(c.name).toLowerCase())) ||
    null
  );
}

function inferMythicLeadFromContext(contextBlob = '') {
  const blob = contextBlob.toLowerCase();
  if (blob.includes('rama') || blob.includes('ramayana') || blob.includes('dandaka') || blob.includes('janasthana')) {
    return (
      'Lord Rama — adult male Hindu epic prince-warrior, divine blue-hued skin, calm determined masculine face, ' +
      'saffron and golden silk dhoti, sacred tilaka, Kodanda bow with quiver of arrows on his shoulder, ' +
      'ancient Indian mythic hero (never a modern woman, never western clothing, never contemporary fashion)'
    );
  }
  if (blob.includes('sita')) {
    return 'Goddess Sita — graceful Indian epic heroine in traditional silk saree and jewelry, classical features';
  }
  if (blob.includes('hanuman')) {
    return 'Lord Hanuman — powerful vanara warrior devotee, muscular build, traditional mythic depiction';
  }
  if (blob.includes('kara') || blob.includes('dhushan') || blob.includes('demon')) {
    return 'Rakshasa demon warlord in serpent/obsidian armour, terrifying mythic antagonist';
  }
  return '';
}

/** Resolve @CharID tags into a concrete visual subject description. */
export function resolveSubjectDescription(shot = {}, projectTitle = '') {
  const charRef = shot.characterIdAssetRef || '';
  const contextBlob = [
    projectTitle,
    shot.sceneSynopsis,
    shot.actionEnvContext,
    shot.sceneShotId,
    charRef
  ]
    .filter(Boolean)
    .join(' ');

  const bible = lookupCharacterBible(charRef);
  if (bible) {
    const parts = [
      bible.name || '',
      bible.role ? `(${bible.role})` : '',
      bible.outfit || '',
      bible.mannerism ? `mannerism: ${bible.mannerism}` : '',
      bible.backstory ? String(bible.backstory).slice(0, 140) : ''
    ].filter(Boolean);
    if (parts.length) return parts.join(', ');
  }

  const inferred = inferMythicLeadFromContext(contextBlob);
  if (inferred) return inferred;

  let cleaned = stripCraftLabels(charRef).replace(/^CharID:\s*/i, '');
  if (cleaned.startsWith('@')) cleaned = cleaned.replace(/^@/, '').replace(/_/g, ' ');
  if (/^lead\s*protagonist$/i.test(cleaned) || !cleaned) {
    return 'the scene lead protagonist matching the written action and period setting';
  }
  return cleaned;
}

export function pickSceneDescription(shot = {}) {
  const synopsis = cleanSceneText(shot.sceneSynopsis || '');
  const env = cleanSceneText(shot.actionEnvContext || '');
  const envIsMeta =
    /acts?|scenes?|shots?|duration|structure|script|colour-coded|color-coded/i.test(env) &&
    !/(forest|jungle|temple|battlefield|chariot|palace|river|village|courtyard|ridge|horizon)/i.test(env);

  let scene = '';
  if (synopsis && (envIsMeta || synopsis.length >= env.length)) {
    scene = synopsis.slice(0, 320);
  } else {
    scene = (env || synopsis).slice(0, 320);
  }

  // If craft slots are still mostly title/metadata, fall back to a visual setting from context
  const weak =
    !scene ||
    scene.length < 40 ||
    (/ramayana epic setting/i.test(scene) && !/(forest|jungle|demon|battlefield|dhoti|arrow|ridge)/i.test(scene));

  if (weak) {
    const blob = `${shot.sceneSynopsis || ''} ${shot.actionEnvContext || ''}`.toLowerCase();
    if (blob.includes('rama') || blob.includes('ramayana') || blob.includes('janasthana') || blob.includes('dandaka')) {
      return 'Ancient Dandaka forest edge at golden hour, dusty clearing facing a dark horizon of advancing rakshasa demon legion, epic Ramayana battlefield atmosphere';
    }
  }

  return scene || 'Cinematic period environment matching the shot card';
}

/**
 * @returns {{ fullPrompt: string, shortPrompt: string, framing: string, subject: string, scene: string }}
 */
export function buildCinematicImagePrompt(shot = {}, options = {}) {
  const {
    imageSlotMode = 'first_frame',
    aspectRatio = '2.39:1 Anamorphic',
    projectTitle = ''
  } = options;

  const framing = expandCompositionFraming(shot.shotComposition || 'Medium Shot');
  const subject = resolveSubjectDescription(shot, projectTitle);
  const scene = pickSceneDescription(shot);

  const expression = stripCraftLabels(shot.characterExpression || 'focused determination');
  const psych = stripCraftLabels(shot.characterPsychologyState || '');
  const mannerisms = stripCraftLabels(shot.characterMannerismAndPosture || '');
  const movement = stripCraftLabels(
    shot.characterMovement ||
      (imageSlotMode === 'last_frame' ? 'completing the action beat' : 'held starting stance')
  );
  const eyeLook = stripCraftLabels(shot.characterEyeLooks || shot.eyeDirectionLook || '');
  const coArtist = stripCraftLabels(shot.coArtistInteraction || '');
  const lighting = [
    stripCraftLabels(shot.timeAndLightingEnv || ''),
    stripCraftLabels(shot.directionalLightingAndHighlight || ''),
    stripCraftLabels(shot.subjectLightingTag || '')
  ]
    .filter(Boolean)
    .join('; ');
  const color = [
    stripCraftLabels(shot.subjectColorTag || ''),
    stripCraftLabels(shot.colorPaletteSlot || ''),
    stripCraftLabels(shot.atmosphereVolumetricsTag || '')
  ]
    .filter(Boolean)
    .join('; ');
  const lens = stripCraftLabels(shot.lensAndFocalLength || 'anamorphic cinema lens, shallow depth of field');
  const placement = stripCraftLabels(shot.characterPlacement || '');
  const keyframeNote =
    imageSlotMode === 'last_frame'
      ? 'LAST FRAME keyframe: end pose of the beat, action resolved or at climax'
      : 'FIRST FRAME keyframe: initial pose before the motion begins';

  const coArtistLine =
    coArtist && !/^supporting performer$/i.test(coArtist) && !/^co-artist/i.test(coArtist)
      ? `Secondary presence / interaction: ${coArtist}.`
      : '';

  const negative =
    'Avoid: wrong shot size, frontal portrait when OTS is required, modern clothing, contemporary hairstyle, ' +
    'anachronistic props, text overlays, watermarks, illustration, anime, cartoon, 3D clay render, blueprint lines';

  const fullPrompt = [
    `Photorealistic cinematic film still (${aspectRatio}), IMAX-quality movie frame.`,
    `CAMERA / FRAMING: ${framing}.`,
    `KEYFRAME: ${keyframeNote}.`,
    `PRIMARY SUBJECT: ${subject}.`,
    expression ? `Expression: ${expression}.` : '',
    psych ? `Inner state: ${psych}.` : '',
    mannerisms ? `Posture / mannerism: ${mannerisms}.` : '',
    movement ? `Body action: ${movement}.` : '',
    eyeLook ? `Eye line: ${eyeLook}.` : '',
    placement ? `Blocking: ${placement}.` : '',
    coArtistLine,
    `SCENE / LOCATION: ${scene}.`,
    lighting ? `LIGHTING: ${lighting}.` : '',
    color ? `COLOR / ATMOSPHERE: ${color}.` : '',
    `LENS: ${lens}.`,
    'Match the shot composition and character identity exactly. Period-accurate mythic/cinematic wardrobe.',
    negative
  ]
    .filter(Boolean)
    .join(' ');

  // Pollinations / URL engines: keep the highest-signal clauses only
  const shortPrompt = [
    framing,
    subject,
    scene,
    lighting ? `lighting: ${lighting.slice(0, 120)}` : '',
    'photorealistic cinematic film still, anamorphic'
  ]
    .filter(Boolean)
    .join('. ')
    .slice(0, 680);

  return { fullPrompt, shortPrompt, framing, subject, scene };
}
