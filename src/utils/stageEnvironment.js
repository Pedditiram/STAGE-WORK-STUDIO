import { parsePromptPracticalKeys, parsePromptPracticalIntensity, parsePromptPracticalKelvin, parsePromptPracticalGel, parsePromptPracticalGobo, parsePromptPracticalBarn, parsePromptPracticalShutter, parsePromptPracticalBounce, parsePromptPracticalBounceColor, parsePromptPracticalBounceAngle, parsePromptPracticalBounceDistance, parsePromptPracticalBounceHeight, parsePromptPracticalBounceTilt, parsePromptPracticalBounceSpread, parsePromptPracticalBounceFeather, parsePromptPracticalBounceSpill } from './stagePromptDirection.js';
import { bounceCardPieceFromPractical } from './stagePracticals.js';

export const STAGE_SET_IDS = [
  { id: 'street', label: 'Street' },
  { id: 'interior', label: 'Interior' },
  { id: 'forest', label: 'Forest' },
  { id: 'courtyard', label: 'Yard' }
];

function shotEnvText(shot = {}) {
  return [
    shot.sceneHeading,
    shot.intExt,
    shot.location,
    shot.locationName,
    shot.world,
    shot.environment,
    shot.setDressing,
    shot.action,
    shot.shotDescription,
    shot.framingNote,
    shot.stageVideoPrompt,
    shot.videoPrompt,
    shot.timeAndLightingEnv,
    shot.subjectLightingTag
  ]
    .map((s) => String(s || ''))
    .join(' ')
    .toLowerCase();
}

function inferTimeOfDay(text) {
  if (/night|moon|midnight|nocturnal/.test(text)) return 'night';
  if (/sunset|dusk|golden hour|evening/.test(text)) return 'sunset';
  if (/dawn|sunrise|morning/.test(text)) return 'dawn';
  if (/day|noon|afternoon|sunlight/.test(text)) return 'day';
  return 'day';
}

function inferSetId(text) {
  if (/forest|jungle|woods|trees|grove/.test(text)) return 'forest';
  if (/interior|int\.|indoor|room|palace|hall|chamber|house interior/.test(text)) return 'interior';
  if (/courtyard|yard|compound|cloister/.test(text)) return 'courtyard';
  if (/village|street|road|bazaar|market|alley|ext\./.test(text)) return 'street';
  return 'street';
}

function paletteForTime(timeOfDay) {
  if (timeOfDay === 'night') {
    return { sky: 0x0b1220, ground: 0x1a2230, fog: 0x152030, fogDensity: 0.045, key: 0xa8c4ff };
  }
  if (timeOfDay === 'sunset') {
    return { sky: 0x2a1810, ground: 0x3a2a22, fog: 0x4a2818, fogDensity: 0.028, key: 0xffc090 };
  }
  if (timeOfDay === 'dawn') {
    return { sky: 0x1c2430, ground: 0x2a322c, fog: 0x3a4450, fogDensity: 0.03, key: 0xffe0c0 };
  }
  return { sky: 0x12110f, ground: 0x323236, fog: 0x1a1816, fogDensity: 0.012, key: 0xfff5e8 };
}

function piecesForSet(setId) {
  if (setId === 'interior') {
    return [
      { kind: 'wall', id: 'wall_back', position: [0, 1.2, -3.2], rotationY: 0, scale: [8, 2.4, 0.12] },
      { kind: 'wall', id: 'wall_l', position: [-4, 1.2, 0], rotationY: Math.PI / 2, scale: [6.4, 2.4, 0.12] },
      { kind: 'wall', id: 'wall_r', position: [4, 1.2, 0], rotationY: Math.PI / 2, scale: [6.4, 2.4, 0.12] },
      { kind: 'furniture', id: 'table', position: [0, 0.4, -0.8], rotationY: 0, scale: [1.4, 0.08, 0.8] }
    ];
  }
  if (setId === 'forest') {
    return [
      { kind: 'tree', id: 'tree_1', position: [-2.4, 0, -2.2], rotationY: 0, scale: [1, 1, 1] },
      { kind: 'tree', id: 'tree_2', position: [2.1, 0, -2.8], rotationY: 0.4, scale: [1.1, 1.2, 1.1] },
      { kind: 'tree', id: 'tree_3', position: [-3.2, 0, 1.4], rotationY: -0.2, scale: [0.85, 0.9, 0.85] },
      { kind: 'tree', id: 'tree_4', position: [3.4, 0, 0.6], rotationY: 0.1, scale: [1, 1.05, 1] },
      { kind: 'rock', id: 'rock_1', position: [0.8, 0.12, -1.4], rotationY: 0.3, scale: [0.5, 0.28, 0.4] }
    ];
  }
  if (setId === 'courtyard') {
    return [
      { kind: 'wall', id: 'low_n', position: [0, 0.45, -3.6], rotationY: 0, scale: [7, 0.9, 0.18] },
      { kind: 'wall', id: 'low_s', position: [0, 0.45, 3.6], rotationY: 0, scale: [7, 0.9, 0.18] },
      { kind: 'building', id: 'gate', position: [0, 1.1, -3.5], rotationY: 0, scale: [1.6, 2.2, 0.4] },
      { kind: 'tree', id: 'tree_c', position: [2.6, 0, 1.8], rotationY: 0, scale: [0.9, 1, 0.9] }
    ];
  }
  return [
    { kind: 'road', id: 'road', position: [0, 0.01, 0], rotationY: 0, scale: [3.2, 0.02, 16] },
    { kind: 'building', id: 'bldg_l', position: [-3.4, 1.4, -1.2], rotationY: 0, scale: [2.2, 2.8, 3.6] },
    { kind: 'building', id: 'bldg_r', position: [3.5, 1.2, 0.4], rotationY: 0.05, scale: [2.0, 2.4, 3.2] },
    { kind: 'tree', id: 'tree_s', position: [-1.6, 0, 2.4], rotationY: 0, scale: [0.7, 0.8, 0.7] }
  ];
}

/**
 * @returns {object} environment block for SHOT DIRECTOR DATA
 */
export function inferStageEnvironment(shot = {}, existing = null) {
  if (existing?.source === 'director' && existing?.setId) return existing;
  const text = shotEnvText(shot);
  const hasText = text.trim().length > 8;
  const setId = inferSetId(text);
  const timeOfDay = inferTimeOfDay(text);
  const pal = paletteForTime(timeOfDay);
  return {
    setId,
    timeOfDay,
    atmosphere: timeOfDay === 'sunset' ? 'warm sunset' : timeOfDay === 'night' ? 'blue night' : 'neutral day',
    groundColor: pal.ground,
    skyColor: pal.sky,
    fogColor: pal.fog,
    fogDensity: pal.fogDensity,
    keyTint: pal.key,
    pieces: [...piecesForSet(setId), ...inferPracticalPieces(shot)],
    worldAssetIds: Array.isArray(shot.worldAssetIds) ? [...shot.worldAssetIds] : [],
    source: hasText ? 'prompt' : 'inferred',
    inferred: true,
    needsDirection: !hasText
  };
}

export function environmentFromSetId(setId, shot = {}, previous = null) {
  const timeOfDay = previous?.timeOfDay || inferTimeOfDay(shotEnvText(shot));
  const pal = paletteForTime(timeOfDay);
  return {
    ...(previous || {}),
    setId,
    timeOfDay,
    atmosphere: previous?.atmosphere || timeOfDay,
    groundColor: pal.ground,
    skyColor: pal.sky,
    fogColor: pal.fog,
    fogDensity: pal.fogDensity,
    keyTint: pal.key,
    pieces: [
      ...piecesForSet(setId),
      ...((previous?.pieces || []).filter((p) => p.practical))
    ],
    source: 'director',
    inferred: false,
    needsDirection: false,
    worldAssetIds: previous?.worldAssetIds || shot.worldAssetIds || []
  };
}

export const STAGE_PRACTICAL_CHIPS = [
  { id: 'lantern', label: 'Lantern' },
  { id: 'torch', label: 'Torch' },
  { id: 'neon', label: 'Neon' },
  { id: 'bulb', label: 'Bulb' }
];

export function practicalPiece(id, index = 0) {
  const slots = [
    [1.15, 0, -0.55],
    [-1.2, 0, -0.4],
    [0.35, 0, -1.5],
    [-0.4, 0, 1.1]
  ];
  const pos = slots[index % slots.length];
  return {
    kind: id,
    id: `practical_${id}_${index}`,
    practical: true,
    position: pos,
    rotationY: 0,
    scale: [1, 1, 1]
  };
}

export function inferPracticalPieces(shot = {}) {
  const t = shotEnvText(shot);
  const ids = [];
  if (/lantern|kerosene|oil lamp|candle/.test(t)) ids.push('lantern');
  if (/torch|fire bowl|bonfire|campfire/.test(t)) ids.push('torch');
  if (/neon/.test(t)) ids.push('neon');
  if (/\bbulb\b|practical lamp|table lamp|bare bulb/.test(t)) ids.push('bulb');
  const keysByKind = parsePromptPracticalKeys(t);
  const intensityByKind = parsePromptPracticalIntensity(t);
  const kelvinByKind = parsePromptPracticalKelvin(t);
  const gelByKind = parsePromptPracticalGel(t);
  const goboByKind = parsePromptPracticalGobo(t);
  const barnByKind = parsePromptPracticalBarn(t);
  const shutterByKind = parsePromptPracticalShutter(t);
  const bounceByKind = parsePromptPracticalBounce(t);
  const bounceColorByKind = parsePromptPracticalBounceColor(t);
  const bounceAngleByKind = parsePromptPracticalBounceAngle(t);
  const bounceDistanceByKind = parsePromptPracticalBounceDistance(t);
  const bounceHeightByKind = parsePromptPracticalBounceHeight(t);
  const bounceTiltByKind = parsePromptPracticalBounceTilt(t);
  const bounceSpreadByKind = parsePromptPracticalBounceSpread(t);
  const bounceFeatherByKind = parsePromptPracticalBounceFeather(t);
  const bounceSpillByKind = parsePromptPracticalBounceSpill(t);
  const pieces = ids.map((id, i) => {
    const piece = practicalPiece(id, i);
    const keyed = keysByKind[id];
    let next = keyed ? { ...piece, ...keyed } : piece;
    if (intensityByKind[id] != null) next = { ...next, intensity: intensityByKind[id] };
    if (kelvinByKind[id] != null) next = { ...next, kelvin: kelvinByKind[id] };
    if (gelByKind[id]) next = { ...next, gel: gelByKind[id] };
    if (goboByKind[id]) next = { ...next, gobo: goboByKind[id] };
    if (barnByKind[id]) next = { ...next, barn: barnByKind[id] };
    if (shutterByKind[id]) next = { ...next, shutter: shutterByKind[id] };
    if (bounceByKind[id]) next = { ...next, bounce: bounceByKind[id] };
    if (bounceColorByKind[id]) next = { ...next, bounceColor: bounceColorByKind[id] };
    if (bounceAngleByKind[id] != null) next = { ...next, bounceAngle: bounceAngleByKind[id] };
    if (bounceDistanceByKind[id] != null) next = { ...next, bounceDistance: bounceDistanceByKind[id] };
    if (bounceHeightByKind[id] != null) next = { ...next, bounceHeight: bounceHeightByKind[id] };
    if (bounceTiltByKind[id] != null) next = { ...next, bounceTilt: bounceTiltByKind[id] };
    if (bounceSpreadByKind[id] != null) next = { ...next, bounceSpread: bounceSpreadByKind[id] };
    if (bounceFeatherByKind[id] != null) next = { ...next, bounceFeather: bounceFeatherByKind[id] };
    if (bounceSpillByKind[id] != null) next = { ...next, bounceSpill: bounceSpillByKind[id] };
    return next;
  });
  const cards = pieces.map((p, i) => bounceCardPieceFromPractical(p, i)).filter(Boolean);
  return [...pieces, ...cards];
}

export const STAGE_PROP_CHIPS = [
  { id: 'crate', label: 'Crate' },
  { id: 'table', label: 'Table' },
  { id: 'plane', label: 'Wall' }
];
