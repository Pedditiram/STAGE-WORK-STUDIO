/**
 * P0b — Canonical typed Shot Spec.
 * All Matrix consoles read/write the same craft keys + stable asset ID refs.
 */

import { ensureLifecycle, normalizeLifecycleStatus } from './productionLifecycle';

export const SHOT_SPEC_VERSION = 1;

/** 26 production crafts (+ sceneShotId) — mirrors normalizeShotTo26Crafts output. */
export const SHOT_SPEC_CRAFT_KEYS = Object.freeze([
  'sceneShotId',
  'sceneSynopsis',
  'shotComposition',
  'cameraMotionTag',
  'timeAndLightingEnv',
  'directionalLightingAndHighlight',
  'subjectLightingTag',
  'subjectColorTag',
  'backgroundLightingTag',
  'backgroundColorTag',
  'colorPaletteSlot',
  'atmosphereVolumetricsTag',
  'characterIdAssetRef',
  'coArtistInteraction',
  'actionEnvContext',
  'characterExpression',
  'characterPsychologyState',
  'characterMannerismAndPosture',
  'characterPlacement',
  'characterDialogue',
  'characterMovement',
  'characterEyeLooks',
  'shotDurationAndImages',
  'soundFxAndFoley',
  'backgroundScoreMood',
  'lensAndFocalLength',
  'vfxCgiBreakdown',
  'stuntAndSafetyNotes',
  'makeupAndHairStyle',
  'editTransitionCut',
  'characterIdMatrix'
]);

/** Stable cross-console references — not re-described prose. */
export const SHOT_SPEC_REF_KEYS = Object.freeze(['charAssetIds', 'worldAssetIds', 'specVersion']);

export function isShotSpecCraftKey(key) {
  return SHOT_SPEC_CRAFT_KEYS.includes(key);
}

export function ensureShotSpecMeta(shot) {
  if (!shot || typeof shot !== 'object') return shot;
  return ensureLifecycle({
    ...shot,
    specVersion: Number(shot.specVersion) || SHOT_SPEC_VERSION,
    charAssetIds: Array.isArray(shot.charAssetIds)
      ? [...new Set(shot.charAssetIds.filter(Boolean))]
      : [],
    worldAssetIds: Array.isArray(shot.worldAssetIds)
      ? [...new Set(shot.worldAssetIds.filter(Boolean))]
      : [],
    lifecycleStatus: normalizeLifecycleStatus(shot.lifecycleStatus)
  });
}

export function normalizeShotSpecArray(shots = []) {
  return (Array.isArray(shots) ? shots : []).map((s) => ensureShotSpecMeta(s));
}

export function shotSpecSummary(shot) {
  const s = ensureShotSpecMeta(shot);
  const filledCrafts = SHOT_SPEC_CRAFT_KEYS.filter((k) => String(s[k] || '').trim()).length;
  const craftTotal = SHOT_SPEC_CRAFT_KEYS.length;
  const craftPct = craftTotal ? Math.round((filledCrafts / craftTotal) * 100) : 0;
  return {
    sceneShotId: s.sceneShotId || '',
    specVersion: s.specVersion,
    craftFieldsFilled: filledCrafts,
    craftFieldsTotal: craftTotal,
    craftPct,
    charAssetIds: s.charAssetIds,
    worldAssetIds: s.worldAssetIds,
    hasCharRefs: (s.charAssetIds || []).length > 0,
    hasWorldRefs: (s.worldAssetIds || []).length > 0
  };
}

/** P97 — Slate-wide Shot Spec completeness (crafts + stable asset refs). */
export function shotSpecSlateSummary(shots = []) {
  const live = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived);
  if (!live.length) {
    return {
      shots: 0,
      avgCraftPct: 0,
      withCharRefs: 0,
      withWorldRefs: 0,
      fullySpecced: 0
    };
  }
  let craftSum = 0;
  let withChar = 0;
  let withWorld = 0;
  let full = 0;
  live.forEach((shot) => {
    const sum = shotSpecSummary(shot);
    craftSum += sum.craftPct;
    if (sum.hasCharRefs) withChar += 1;
    if (sum.hasWorldRefs) withWorld += 1;
    if (sum.craftPct >= 60 && sum.hasCharRefs) full += 1;
  });
  return {
    shots: live.length,
    avgCraftPct: Math.round(craftSum / live.length),
    withCharRefs: withChar,
    withWorldRefs: withWorld,
    fullySpecced: full
  };
}

export function toggleShotCharAssetId(shot, assetId, { on = null } = {}) {
  const s = ensureShotSpecMeta(shot);
  const id = String(assetId || '').trim();
  if (!id) return s;
  const set = new Set(s.charAssetIds || []);
  const shouldOn = on == null ? !set.has(id) : Boolean(on);
  if (shouldOn) set.add(id);
  else set.delete(id);
  return { ...s, charAssetIds: [...set] };
}

export function toggleShotWorldAssetId(shot, assetId, { on = null } = {}) {
  const s = ensureShotSpecMeta(shot);
  const id = String(assetId || '').trim();
  if (!id) return s;
  const set = new Set(s.worldAssetIds || []);
  const shouldOn = on == null ? !set.has(id) : Boolean(on);
  if (shouldOn) set.add(id);
  else set.delete(id);
  return { ...s, worldAssetIds: [...set] };
}
