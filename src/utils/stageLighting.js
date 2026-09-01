/**
 * 3-point lighting rig for Director Stage (spec lighting).
 * Inferred from craft lighting language. Does not invent blocking.
 */

export const LIGHT_SIMPLE = [
  { id: 'rembrandt', label: 'Rembrandt' },
  { id: 'flat', label: 'Flat' },
  { id: 'rim', label: 'Rim' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'night', label: 'Night' }
];

export const LIGHT_PRO = [
  ...LIGHT_SIMPLE,
  { id: 'noir', label: 'Noir' },
  { id: 'practical', label: 'Practical' }
];

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

function lightingBlob(shot = {}, environment = {}) {
  return [
    shot.subjectLightingTag,
    shot.directionalLightingAndHighlight,
    shot.timeAndLightingEnv,
    shot.backgroundLightingTag,
    shot.atmosphereVolumetricsTag,
    environment.timeOfDay,
    environment.atmosphere
  ]
    .map((s) => String(s || ''))
    .join(' ')
    .toLowerCase();
}

export function inferLightingSetup(shot = {}, environment = {}) {
  const t = lightingBlob(shot, environment);
  if (/night|moon|nocturnal|blue hour/.test(t) && !/sunset|golden/.test(t)) return 'night';
  if (/sunset|golden hour|dusk|warm tungsten|kerosene/.test(t)) return 'sunset';
  if (/noir|chiaroscuro|venetian|hard shadow/.test(t)) return 'noir';
  if (/rim|backlight|silhouette|hair light/.test(t)) return 'rim';
  if (/flat|high[- ]key|softbox|overcast|soft diffused/.test(t)) return 'flat';
  if (/practical|lantern|bulb|torch|motivated/.test(t)) return 'practical';
  if (/rembrandt|3[- ]point|classic|key/.test(t)) return 'rembrandt';
  if (environment.timeOfDay === 'night') return 'night';
  if (environment.timeOfDay === 'sunset') return 'sunset';
  return 'rembrandt';
}

export function lightingRigForSetup(setup = 'rembrandt') {
  const id = LIGHT_PRO.some((s) => s.id === setup) ? setup : 'rembrandt';
  const rigs = {
    rembrandt: {
      keyAzimuth: 40,
      keyElevation: 48,
      keyIntensity: 1.35,
      keyColor: 0xfff2dc,
      fillIntensity: 0.28,
      fillColor: 0xb8c8e8,
      rimIntensity: 0.42,
      rimColor: 0xffe8c8,
      hemiIntensity: 0.45
    },
    flat: {
      keyAzimuth: 15,
      keyElevation: 62,
      keyIntensity: 1.05,
      keyColor: 0xfff8f0,
      fillIntensity: 0.72,
      fillColor: 0xe8eef8,
      rimIntensity: 0.12,
      rimColor: 0xffffff,
      hemiIntensity: 0.85
    },
    rim: {
      keyAzimuth: 25,
      keyElevation: 40,
      keyIntensity: 0.55,
      keyColor: 0xffe8d0,
      fillIntensity: 0.18,
      fillColor: 0x8899bb,
      rimIntensity: 1.15,
      rimColor: 0xfff4e0,
      hemiIntensity: 0.28
    },
    sunset: {
      keyAzimuth: 70,
      keyElevation: 18,
      keyIntensity: 1.45,
      keyColor: 0xffb070,
      fillIntensity: 0.32,
      fillColor: 0x6a80c0,
      rimIntensity: 0.55,
      rimColor: 0xffd0a0,
      hemiIntensity: 0.38
    },
    night: {
      keyAzimuth: -30,
      keyElevation: 55,
      keyIntensity: 0.72,
      keyColor: 0xc8dcff,
      fillIntensity: 0.22,
      fillColor: 0x4a6090,
      rimIntensity: 0.35,
      rimColor: 0xa8c4ff,
      hemiIntensity: 0.22
    },
    noir: {
      keyAzimuth: 55,
      keyElevation: 38,
      keyIntensity: 1.6,
      keyColor: 0xffe8d4,
      fillIntensity: 0.08,
      fillColor: 0x334466,
      rimIntensity: 0.7,
      rimColor: 0xffffff,
      hemiIntensity: 0.12
    },
    practical: {
      keyAzimuth: 20,
      keyElevation: 28,
      keyIntensity: 1.1,
      keyColor: 0xffc878,
      fillIntensity: 0.24,
      fillColor: 0x8899aa,
      rimIntensity: 0.2,
      rimColor: 0xffe0b0,
      hemiIntensity: 0.4
    }
  };
  return { setup: id, ...rigs[id] };
}

export function normalizeStageLighting(raw = {}, shot = {}, environment = {}) {
  const inferredSetup = inferLightingSetup(shot, environment);
  const setup = raw.setup || inferredSetup;
  const base = lightingRigForSetup(setup);
  const hasCraft = lightingBlob(shot, environment).trim().length > 6;
  return {
    ...base,
    setup,
    keyAzimuth: raw.keyAzimuth != null ? clamp(raw.keyAzimuth, -180, 180) : base.keyAzimuth,
    keyElevation: raw.keyElevation != null ? clamp(raw.keyElevation, 5, 85) : base.keyElevation,
    keyIntensity: raw.keyIntensity != null ? clamp(raw.keyIntensity, 0.1, 3) : base.keyIntensity,
    fillIntensity: raw.fillIntensity != null ? clamp(raw.fillIntensity, 0, 2) : base.fillIntensity,
    rimIntensity: raw.rimIntensity != null ? clamp(raw.rimIntensity, 0, 2) : base.rimIntensity,
    source: raw.source || (hasCraft ? 'prompt' : 'inferred'),
    inferred: raw.inferred != null ? !!raw.inferred : !raw.setup,
    needsDirection: raw.needsDirection != null ? !!raw.needsDirection : !hasCraft
  };
}

export function inferStageLighting(shot = {}, environment = {}) {
  return normalizeStageLighting({ setup: inferLightingSetup(shot, environment) }, shot, environment);
}

function polarToPos(azimuthDeg, elevationDeg, radius = 12) {
  const az = (Number(azimuthDeg) * Math.PI) / 180;
  const el = (Number(elevationDeg) * Math.PI) / 180;
  return [
    Math.cos(el) * Math.sin(az) * radius,
    Math.sin(el) * radius,
    Math.cos(el) * Math.cos(az) * radius
  ];
}

export function applyStageLightingRig(
  { keyLight, fillLight, rimLight, hemiLight } = {},
  lighting = {},
  environment = {}
) {
  const L = { ...lightingRigForSetup(lighting.setup), ...lighting };
  const keyTint = environment.keyTint != null ? environment.keyTint : L.keyColor;
  if (keyLight) {
    const p = polarToPos(L.keyAzimuth, L.keyElevation, 12);
    keyLight.position.set(p[0], p[1], p[2]);
    keyLight.intensity = L.keyIntensity;
    if (keyLight.color?.setHex) keyLight.color.setHex(keyTint);
  }
  if (fillLight) {
    const p = polarToPos(L.keyAzimuth + 140, Math.max(12, L.keyElevation - 10), 10);
    fillLight.position.set(p[0], p[1], p[2]);
    fillLight.intensity = L.fillIntensity;
    if (fillLight.color?.setHex) fillLight.color.setHex(L.fillColor);
  }
  if (rimLight) {
    const p = polarToPos(L.keyAzimuth + 180, 25, 9);
    rimLight.position.set(p[0], Math.max(2.2, p[1]), p[2]);
    rimLight.intensity = L.rimIntensity;
    if (rimLight.color?.setHex) rimLight.color.setHex(L.rimColor);
  }
  if (hemiLight) {
    hemiLight.intensity = L.hemiIntensity;
  }
}
