/**
 * Practical light pulse on the Stage timeline. Does not invent blocking.
 */

export function practicalPulse(kind, t = 0) {
  const k = String(kind || '');
  const x = Number(t) || 0;
  if (k === 'torch') return 0.72 + 0.38 * Math.abs(Math.sin(x * 11) * Math.sin(x * 7.1));
  if (k === 'lantern') return 0.86 + 0.14 * Math.sin(x * 3.1);
  if (k === 'neon') return Math.sin(x * 9.5) > 0.88 ? 0.22 : 1;
  if (k === 'bulb') return 0.94 + 0.06 * Math.sin(x * 1.7);
  return 1;
}

/**
 * Keyed on/off (explicit times only). Missing keys = stay on.
 * piece.on / piece.off in seconds, or piece.keys: [{ t, on }].
 */
export function practicalOnFactor(meta = {}, t = 0) {
  const x = Number(t) || 0;
  const keys = meta.practicalKeys || meta.keys || meta.keyframes;
  if (Array.isArray(keys) && keys.length) {
    const sorted = [...keys].sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0));
    let gate = 1;
    for (const k of sorted) {
      if ((Number(k.t) || 0) > x) break;
      if (typeof k.gate === 'number') {
        gate = Math.min(1, Math.max(0, k.gate));
        continue;
      }
      if (k.on === false || k.on === 0 || k.on === 'off') gate = 0;
      else if (k.on === true || k.on === 1 || k.on === 'on') gate = 1;
    }
    return gate;
  }
  const onT = meta.practicalOn ?? meta.on;
  const offT = meta.practicalOff ?? meta.off;
  if (onT == null && offT == null) return 1;
  if (onT != null && x < Number(onT)) return 0;
  if (offT != null && x >= Number(offT)) return 0;
  return 1;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.min(1, Math.max(0, x));
}

/** Interpolated intensity 0–1. Keys with `intensity` win over a static piece.intensity. */
export function practicalIntensityAt(meta = {}, t = 0) {
  const x = Number(t) || 0;
  const baseRaw = meta.practicalIntensity ?? meta.intensity;
  const base = baseRaw == null ? 1 : clamp01(baseRaw);
  const keys = (meta.practicalKeys || meta.keys || meta.keyframes || [])
    .filter((k) => typeof k?.intensity === 'number')
    .sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0));
  if (!keys.length) return base;
  if (x <= (Number(keys[0].t) || 0)) return clamp01(keys[0].intensity);
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    const ta = Number(a.t) || 0;
    const tb = Number(b.t) || 0;
    if (x >= ta && x <= tb) {
      const u = tb === ta ? 1 : (x - ta) / (tb - ta);
      return clamp01((Number(a.intensity) || 0) + ((Number(b.intensity) || 0) - (Number(a.intensity) || 0)) * u);
    }
  }
  return clamp01(keys[keys.length - 1].intensity);
}

export function kelvinToRgb(kelvin = 3200) {
  const k = Math.min(12000, Math.max(1000, Number(kelvin) || 3200));
  const t = k / 100;
  let r;
  let g;
  let b;
  if (t <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(t) - 161.1195681661));
    b = t <= 19 ? 0 : Math.min(255, Math.max(0, 138.5177312231 * Math.log(t - 10) - 305.0447927307));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * (t - 60) ** -0.1332047592));
    g = Math.min(255, Math.max(0, 288.1221695283 * (t - 60) ** -0.0755148492));
    b = 255;
  }
  return { r: r / 255, g: g / 255, b: b / 255, kelvin: k };
}

export function defaultPracticalKelvin(kind = '') {
  if (kind === 'torch') return 1850;
  if (kind === 'lantern') return 2200;
  if (kind === 'bulb') return 2700;
  if (kind === 'neon') return 7000;
  return 3200;
}

export function practicalKelvin(meta = {}) {
  const raw = meta.practicalKelvin ?? meta.kelvin;
  if (raw != null && Number.isFinite(Number(raw))) {
    return Math.min(12000, Math.max(1000, Number(raw)));
  }
  return defaultPracticalKelvin(meta.practicalKind || meta.kind);
}

export const PRACTICAL_GELS = [
  { id: '', label: 'Clear' },
  { id: 'cto', label: 'CTO', rgb: [1, 0.72, 0.42] },
  { id: 'ctb', label: 'CTB', rgb: [0.62, 0.78, 1] },
  { id: 'plus_green', label: '+Green', rgb: [0.55, 1, 0.62] },
  { id: 'red', label: 'Red', rgb: [1, 0.22, 0.18] },
  { id: 'amber', label: 'Amber', rgb: [1, 0.55, 0.18] }
];

export const PRACTICAL_GOBOS = [
  { id: '', label: 'Open' },
  { id: 'window', label: 'Window' },
  { id: 'blinds', label: 'Blinds' },
  { id: 'tree', label: 'Tree' }
];

export const PRACTICAL_BARNS = [
  { id: '', label: 'Open' },
  { id: 'tight', label: 'Tight' },
  { id: 'top', label: 'Top' },
  { id: 'side', label: 'Sides' }
];

export function applyGelToRgb(rgb = { r: 1, g: 1, b: 1 }, gelId = '') {
  const gel = PRACTICAL_GELS.find((g) => g.id && g.id === String(gelId || ''));
  if (!gel?.rgb) return rgb;
  return {
    r: Math.min(1, (rgb.r || 0) * gel.rgb[0]),
    g: Math.min(1, (rgb.g || 0) * gel.rgb[1]),
    b: Math.min(1, (rgb.b || 0) * gel.rgb[2])
  };
}

export function practicalGoboFactor(meta = {}, t = 0) {
  const g = String(meta.practicalGobo || meta.gobo || '');
  const x = Number(t) || 0;
  if (!g || g === 'open' || g === 'none') return 1;
  if (g === 'blinds') return 0.55 + 0.45 * (Math.sin(x * 14) > 0 ? 1 : 0.28);
  if (g === 'window') return 0.78 + 0.22 * Math.abs(Math.sin(x * 1.7));
  if (g === 'tree') return 0.62 + 0.38 * Math.abs(Math.sin(x * 3.4) * Math.sin(x * 1.1));
  return 1;
}

export function practicalBarnFactor(meta = {}) {
  const b = String(meta.practicalBarn || meta.barn || '');
  if (!b || b === 'open' || b === 'none') return 1;
  if (b === 'tight') return 0.42;
  if (b === 'top') return 0.68;
  if (b === 'side' || b === 'sides') return 0.72;
  return 1;
}

export const PRACTICAL_SHUTTERS = [
  { id: '', label: 'Open' },
  { id: 'half', label: 'Half' },
  { id: 'closed', label: 'Closed' }
];

export function practicalShutterFactor(meta = {}) {
  const s = String(meta.practicalShutter || meta.shutter || '');
  if (!s || s === 'open' || s === 'none') return 1;
  if (s === 'closed') return 0.08;
  if (s === 'half') return 0.48;
  return 1;
}

export const PRACTICAL_BOUNCE = [
  { id: '', label: 'None' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'fill', label: 'Fill' },
  { id: 'mix', label: 'Mix' }
];

export function practicalBounceFactor(meta = {}) {
  const b = String(meta.practicalBounce || meta.bounce || '');
  if (!b || b === 'none') return 1;
  if (b === 'bounce') return 1.16;
  if (b === 'fill') return 1.22;
  if (b === 'mix') return 1.28;
  return 1;
}

/** Foam bounce card beside a keyed practical. Does not invent a practical. */
export function bounceCardPieceFromPractical(piece = {}, i = 0) {
  const b = String(piece.bounce || '');
  if (b !== 'bounce' && b !== 'fill' && b !== 'mix') return null;
  const pos = Array.isArray(piece.position) ? piece.position : [0, 0, 0];
  return {
    id: `${piece.id || piece.kind || 'prac'}-bounce-card-${i}`,
    kind: 'bounce_card',
    bounce: b,
    bounceColor: piece.bounceColor || '',
    bounceAngle: piece.bounceAngle,
    bounceDistance: piece.bounceDistance,
    bounceHeight: piece.bounceHeight,
    bounceTilt: piece.bounceTilt,
    bounceSpread: piece.bounceSpread,
    bounceFeather: piece.bounceFeather,
    bounceSpill: piece.bounceSpill,
    practical: false,
    position: bounceCardOffsetPosition(pos, piece.bounceDistance, piece.bounceHeight),
    rotationY: bounceCardAngleRad(piece.bounceAngle),
    rotationX: bounceCardTiltRad(piece.bounceTilt),
    scale: bounceCardScale(piece.bounceSpread)
  };
}

const BOUNCE_CARD_DEFAULT_XZ = { x: 0.55, z: -0.42 };
const BOUNCE_CARD_DEFAULT_M = Math.hypot(BOUNCE_CARD_DEFAULT_XZ.x, BOUNCE_CARD_DEFAULT_XZ.z);

export function bounceCardDistanceM(distanceM) {
  if (distanceM == null || distanceM === '') return BOUNCE_CARD_DEFAULT_M;
  const n = Number(distanceM);
  if (!Number.isFinite(n)) return BOUNCE_CARD_DEFAULT_M;
  return Math.min(2.5, Math.max(0.2, n));
}

export function bounceCardOffsetPosition(pos = [0, 0, 0], distanceM, heightM) {
  const dist = bounceCardDistanceM(distanceM);
  const scale = dist / BOUNCE_CARD_DEFAULT_M;
  return [
    Number(pos[0] || 0) + BOUNCE_CARD_DEFAULT_XZ.x * scale,
    Number(pos[1] || 0) + bounceCardHeightM(heightM),
    Number(pos[2] || 0) + BOUNCE_CARD_DEFAULT_XZ.z * scale
  ];
}

const BOUNCE_CARD_DEFAULT_Y = 0.28;

export function bounceCardHeightM(heightM) {
  if (heightM == null || heightM === '') return BOUNCE_CARD_DEFAULT_Y;
  const n = Number(heightM);
  if (!Number.isFinite(n)) return BOUNCE_CARD_DEFAULT_Y;
  return Math.min(1.8, Math.max(0.05, n));
}

export function parsePracticalHeight(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1.8, Math.max(0.05, n));
}

export function bounceCardTiltRad(tiltDeg) {
  if (tiltDeg == null || tiltDeg === '') return 0;
  const n = Number(tiltDeg);
  if (!Number.isFinite(n)) return 0;
  return (Math.min(45, Math.max(-45, n)) * Math.PI) / 180;
}

export function parsePracticalTilt(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(45, Math.max(-45, n));
}

const BOUNCE_CARD_DEFAULT_SCALE = [0.5, 0.02, 0.34];

export function bounceCardSpread(spread) {
  if (spread == null || spread === '') return 1;
  const n = Number(spread);
  if (!Number.isFinite(n)) return 1;
  return Math.min(2.5, Math.max(0.4, n));
}

export function bounceCardScale(spread) {
  const s = bounceCardSpread(spread);
  return [BOUNCE_CARD_DEFAULT_SCALE[0] * s, BOUNCE_CARD_DEFAULT_SCALE[1], BOUNCE_CARD_DEFAULT_SCALE[2] * s];
}

export function parsePracticalSpread(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(2.5, Math.max(0.4, n));
}

export function bounceCardFeather(feather) {
  if (feather == null || feather === '') return 0.45;
  const n = Number(feather);
  if (!Number.isFinite(n)) return 0.45;
  return Math.min(1, Math.max(0, n));
}

export function bounceCardFeatherRange(feather) {
  return 3 + 4 * bounceCardFeather(feather);
}

export function bounceCardFeatherEmissive(feather) {
  return 0.06 + 0.18 * bounceCardFeather(feather);
}

export function parsePracticalFeather(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n > 1) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n));
}

export function bounceCardSpill(spill) {
  if (spill == null || spill === '') return 0;
  const n = Number(spill);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function bounceCardSpillIntensity(spill, bounce = '') {
  const s = bounceCardSpill(spill);
  if (!s) return 0;
  const base = bounce === 'mix' ? 0.22 : bounce === 'fill' ? 0.18 : 0.12;
  return base * s;
}

export function parsePracticalSpill(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n > 1) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n));
}

export function parsePracticalDistance(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(2.5, Math.max(0.2, n));
}

export const PRACTICAL_BOUNCE_COLORS = [
  { id: '', label: 'White', rgb: [0.96, 0.94, 0.9] },
  { id: 'warm', label: 'Warm', rgb: [1, 0.82, 0.62] },
  { id: 'cool', label: 'Cool', rgb: [0.76, 0.86, 1] },
  { id: 'silver', label: 'Silver', rgb: [0.9, 0.92, 0.95] }
];

export function bounceCardColorRgb(colorId = '') {
  const hit = PRACTICAL_BOUNCE_COLORS.find((c) => c.id && c.id === String(colorId || ''));
  return hit?.rgb || PRACTICAL_BOUNCE_COLORS[0].rgb;
}

export function bounceCardAngleRad(angleDeg) {
  if (angleDeg == null || angleDeg === '') return 0.35;
  const n = Number(angleDeg);
  if (!Number.isFinite(n)) return 0.35;
  return (Math.min(80, Math.max(-80, n)) * Math.PI) / 180;
}

export function parsePracticalAngle(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(80, Math.max(-80, n));
}

export function applyPracticalsAtTime(root, t = 0) {
  if (!root?.traverse) return;
  root.traverse((o) => {
    const kind = o.userData?.practicalKind;
    if (!kind) return;
    const u = practicalPulse(kind, t)
      * practicalOnFactor(o.userData, t)
      * practicalIntensityAt(o.userData, t)
      * practicalGoboFactor(o.userData, t)
      * practicalBarnFactor(o.userData)
      * practicalShutterFactor(o.userData)
      * practicalBounceFactor(o.userData);
    const rgb = applyGelToRgb(kelvinToRgb(practicalKelvin(o.userData)), o.userData.practicalGel || o.userData.gel);
    if (o.isLight) {
      const base = o.userData.practicalBaseIntensity != null ? o.userData.practicalBaseIntensity : o.intensity;
      o.userData.practicalBaseIntensity = base;
      o.intensity = base * u;
      if (o.color?.setRGB) o.color.setRGB(rgb.r, rgb.g, rgb.b);
    }
    const mat = o.material;
    if (mat && mat.emissiveIntensity != null) {
      const baseE = o.userData.practicalBaseEmissive != null ? o.userData.practicalBaseEmissive : mat.emissiveIntensity;
      o.userData.practicalBaseEmissive = baseE;
      mat.emissiveIntensity = baseE * u;
      if (mat.emissive?.setRGB) mat.emissive.setRGB(rgb.r, rgb.g, rgb.b);
    }
  });
}

export function practicalTimelineLanes(plan = {}) {
  const dur = Math.max(0.1, Number(plan.durationSec) || 5);
  const pieces = plan.environment?.pieces || [];
  return pieces
    .filter((p) => p.practical || /lantern|torch|neon|bulb/.test(String(p.kind || '')))
    .map((p, i) => {
      const start = p.on != null ? Number(p.on) : 0;
      const end = p.off != null ? Number(p.off) : dur;
      const keyed = p.on != null || p.off != null || p.intensity != null || (Array.isArray(p.keys) && p.keys.length);
      return {
        id: `prac-${p.id || p.kind}-${i}`,
        kind: 'practical',
        label: keyed ? `${p.kind || 'Practical'} keyed` : p.kind || 'Practical',
        start: Math.max(0, start),
        end: Math.min(dur, Math.max(start + 0.05, end)),
        color: p.kind === 'neon' ? '#22d3ee' : p.kind === 'torch' ? '#fb7185' : '#fbbf24'
      };
    });
}

export function parsePracticalSeconds(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(30, Math.max(0, n));
}

export function parsePracticalIntensity(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n > 1) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n));
}

export function parsePracticalKelvin(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(12000, Math.max(1000, n));
}

export function patchPracticalPiece(pieces = [], pieceId, patch = {}) {
  return (pieces || []).map((p) => {
    if (p.id !== pieceId) return p;
    const next = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v === '' || v === undefined || v === null) delete next[k];
      else next[k] = v;
    });
    return next;
  });
}
