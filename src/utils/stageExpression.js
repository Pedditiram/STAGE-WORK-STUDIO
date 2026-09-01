/**
 * Expression system (spec §7). Structured face channels for a later rig.
 * Expression is not blocking: smile ≠ walk, look ≠ emotion.
 */

export const EXPR_SIMPLE = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'determined', label: 'Determined' },
  { id: 'smiling', label: 'Smile' }
];

export const EXPR_PRO = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'calm', label: 'Calm' },
  { id: 'determined', label: 'Determined' },
  { id: 'smiling', label: 'Smile' },
  { id: 'suspicious', label: 'Suspect' },
  { id: 'angry', label: 'Angry' },
  { id: 'sad', label: 'Sad' },
  { id: 'shocked', label: 'Shock' },
  { id: 'frightened', label: 'Fear' },
  { id: 'crying', label: 'Cry' }
];

export const EXPR_INTENSITY = [
  { id: 0.4, label: 'Soft' },
  { id: 0.7, label: 'Play' },
  { id: 1, label: 'Full' }
];

const REST_FACE = {
  brow: 0,
  eyeOpen: 1,
  mouthOpen: 0,
  mouthSmile: 0,
  jaw: 0
};

/** Preview-rig targets. Same keys as a future GLB morph map. */
const FACE_BY_ID = {
  neutral: { ...REST_FACE },
  calm: { brow: 0.12, eyeOpen: 0.96, mouthOpen: 0, mouthSmile: 0.12, jaw: 0 },
  determined: { brow: -0.38, eyeOpen: 0.88, mouthOpen: 0.06, mouthSmile: 0, jaw: 0.04 },
  smiling: { brow: 0.18, eyeOpen: 0.94, mouthOpen: 0.08, mouthSmile: 0.88, jaw: 0.06 },
  suspicious: { brow: -0.28, eyeOpen: 0.72, mouthOpen: 0, mouthSmile: -0.18, jaw: 0 },
  angry: { brow: -0.82, eyeOpen: 0.68, mouthOpen: 0.22, mouthSmile: -0.22, jaw: 0.1 },
  sad: { brow: 0.32, eyeOpen: 0.82, mouthOpen: 0.04, mouthSmile: -0.42, jaw: 0.02 },
  shocked: { brow: 0.88, eyeOpen: 1.18, mouthOpen: 0.72, mouthSmile: 0, jaw: 0.28 },
  frightened: { brow: 0.62, eyeOpen: 1.12, mouthOpen: 0.32, mouthSmile: -0.12, jaw: 0.16 },
  crying: { brow: 0.42, eyeOpen: 0.64, mouthOpen: 0.18, mouthSmile: -0.28, jaw: 0.08 }
};

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function defaultExpression() {
  return {
    id: 'neutral',
    intensity: 1,
    rig: 'preview',
    ...REST_FACE,
    inferred: false,
    needsDirection: true
  };
}

export function faceChannelsFor(id, intensity = 1) {
  const target = FACE_BY_ID[id] || FACE_BY_ID.neutral;
  const u = clamp(intensity, 0, 1);
  return {
    brow: lerp(REST_FACE.brow, target.brow, u),
    eyeOpen: lerp(REST_FACE.eyeOpen, target.eyeOpen, u),
    mouthOpen: lerp(REST_FACE.mouthOpen, target.mouthOpen, u),
    mouthSmile: lerp(REST_FACE.mouthSmile, target.mouthSmile, u),
    jaw: lerp(REST_FACE.jaw, target.jaw, u)
  };
}

export function normalizeExpression(expr) {
  const e = expr && typeof expr === 'object' ? expr : {};
  const id = EXPR_PRO.some((x) => x.id === e.id) ? e.id : 'neutral';
  const intensity = clamp(e.intensity ?? 1, 0.15, 1);
  const face = faceChannelsFor(id, intensity);
  return {
    id,
    intensity,
    rig: e.rig === 'glb' ? 'glb' : 'preview',
    brow: e.brow != null ? clamp(e.brow, -1, 1) : face.brow,
    eyeOpen: e.eyeOpen != null ? clamp(e.eyeOpen, 0.35, 1.3) : face.eyeOpen,
    mouthOpen: e.mouthOpen != null ? clamp(e.mouthOpen, 0, 1) : face.mouthOpen,
    mouthSmile: e.mouthSmile != null ? clamp(e.mouthSmile, -0.6, 1) : face.mouthSmile,
    jaw: e.jaw != null ? clamp(e.jaw, 0, 0.4) : face.jaw,
    inferred: !!e.inferred,
    needsDirection: e.needsDirection != null ? !!e.needsDirection : id === 'neutral' && !e.inferred
  };
}

export function applyExpressionType(human, id, extras = {}) {
  const prev = normalizeExpression(human?.expression);
  const nextId = id || prev.id;
  return normalizeExpression({
    ...prev,
    id: nextId,
    intensity: extras.intensity != null ? extras.intensity : prev.intensity,
    inferred: false,
    needsDirection: nextId === 'neutral'
  });
}

function expressionText(shot = {}) {
  return [
    shot.characterExpression,
    shot.characterPsychologyState,
    shot.characterMannerismAndPosture
  ]
    .map((s) => String(s || ''))
    .join(' ')
    .toLowerCase();
}

/**
 * Parse craft expression only. Does not read movement / look language.
 */
export function inferExpression(shot = {}) {
  const text = expressionText(shot);
  if (!text.trim()) return defaultExpression();

  const pick = (id) =>
    normalizeExpression({
      id,
      intensity: 1,
      inferred: true,
      needsDirection: false
    });

  if (/cry|tears|weep|sob/.test(text)) return pick('crying');
  if (/fright|terror|scared|afraid|panic/.test(text)) return pick('frightened');
  if (/shock|gasp|surpris|wide[- ]eyed|startled/.test(text)) return pick('shocked');
  if (/angry|rage|furious|snarl|wrath/.test(text)) return pick('angry');
  if (/sad|sorrow|grief|melanchol|heartbroken/.test(text)) return pick('sad');
  if (/suspicious|wary|narrow[- ]eyed|distrust/.test(text)) return pick('suspicious');
  if (/smil|laugh|joy|happy|grin|warm/.test(text)) return pick('smiling');
  if (/determin|resolve|stoic|fierce|grit/.test(text)) return pick('determined');
  if (/calm|peace|serene|composed/.test(text)) return pick('calm');
  if (/neutral|blank|poker/.test(text)) return pick('neutral');

  return normalizeExpression({
    id: 'neutral',
    inferred: false,
    needsDirection: true
  });
}

export function applyExpressionToPose(pose = {}, expression) {
  const face = normalizeExpression(expression);
  return {
    ...pose,
    brow: face.brow,
    eyeOpen: face.eyeOpen,
    mouthOpen: face.mouthOpen,
    mouthSmile: face.mouthSmile,
    jaw: face.jaw
  };
}

export function applyExpressionToKeyframes(keys = [], human) {
  if (!Array.isArray(keys) || !keys.length) return keys;
  const expr = human?.expression;
  return keys.map((k) => ({
    ...k,
    pose: applyExpressionToPose(k.pose || human?.pose || {}, expr)
  }));
}
