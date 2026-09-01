/**
 * Interaction (spec §8). Record relationships. Look ≠ walk; talk ≠ approach.
 */

export const INTERACT_SIMPLE = [
  { id: 'none', label: 'None' },
  { id: 'look_at', label: 'Look' },
  { id: 'point', label: 'Point' }
];

export const INTERACT_PRO = [
  { id: 'none', label: 'None' },
  { id: 'look_at', label: 'Look' },
  { id: 'point', label: 'Point' },
  { id: 'touch', label: 'Touch' },
  { id: 'hold_prop', label: 'Hold' },
  { id: 'walk_toward', label: 'Toward' }
];

const ARM_PATCH = {
  point: { upperArmRX: -1.5, upperArmRZ: -0.2, lowerArmR: 0.15, chest: 0.12 },
  touch: { upperArmRX: -0.95, lowerArmR: 0.75, chest: 0.08 },
  hold_prop: { upperArmLX: -0.55, lowerArmL: 1.15, chest: 0.06 }
};

export function defaultInteraction() {
  return {
    type: 'none',
    targetId: '',
    propId: '',
    inferred: false,
    needsDirection: true
  };
}

export function normalizeInteraction(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const type = INTERACT_PRO.some((x) => x.id === r.type) ? r.type : 'none';
  return {
    type,
    targetId: String(r.targetId || ''),
    propId: String(r.propId || ''),
    inferred: !!r.inferred,
    needsDirection: r.needsDirection != null ? !!r.needsDirection : type === 'none'
  };
}

export function applyInteractionType(human, type, extras = {}) {
  const prev = normalizeInteraction(human?.interaction);
  const nextType = type || prev.type;
  return normalizeInteraction({
    ...prev,
    type: nextType,
    targetId: extras.targetId != null ? extras.targetId : prev.targetId,
    propId: extras.propId != null ? extras.propId : prev.propId,
    inferred: false,
    needsDirection: nextType === 'none'
  });
}

function interactText(shot = {}) {
  return [shot.coArtistInteraction, shot.action, shot.actionEnvContext, shot.characterPlacement]
    .map((s) => String(s || ''))
    .join(' ')
    .toLowerCase();
}

function otherId(humans, self) {
  const o = (humans || []).find((h) => h && h.id !== self?.id);
  return o?.id || '';
}

/**
 * Parse interaction language only. Does not invent a walk from a look.
 */
export function inferInteraction(shot = {}, human, humans = []) {
  const text = interactText(shot);
  const targetId = otherId(humans, human);
  if (!text.trim()) return defaultInteraction();

  if (/\b(touch|holds? hands?|embrace|hug|hand on)\b/.test(text)) {
    return normalizeInteraction({ type: 'touch', targetId, inferred: true, needsDirection: false });
  }
  if (/\b(hold|holding|grips?|clutch)\b/.test(text) && /\b(prop|sword|bow|staff|cup|object)\b/.test(text)) {
    return normalizeInteraction({ type: 'hold_prop', inferred: true, needsDirection: false });
  }
  if (/\b(point|points|pointing|indicate)\b/.test(text)) {
    return normalizeInteraction({ type: 'point', targetId, inferred: true, needsDirection: false });
  }
  if (/\b(walk toward|approach|goes to|cross(?:es)? to)\b/.test(text)) {
    return normalizeInteraction({ type: 'walk_toward', targetId, inferred: true, needsDirection: false });
  }
  if (/\b(looks? at|gazes? at|stares? at|watching)\b/.test(text)) {
    return normalizeInteraction({ type: 'look_at', targetId, inferred: true, needsDirection: false });
  }
  return normalizeInteraction({ type: 'none', inferred: false, needsDirection: true });
}

export function applyInteractionToPose(pose = {}, interaction) {
  const type = normalizeInteraction(interaction).type;
  const patch = ARM_PATCH[type];
  if (!patch) return pose;
  return { ...pose, ...patch };
}

export function applyInteractionToKeyframes(keys = [], human) {
  if (!Array.isArray(keys) || !keys.length) return keys;
  return keys.map((k) => ({
    ...k,
    pose: applyInteractionToPose(k.pose || human?.pose || {}, human?.interaction)
  }));
}
