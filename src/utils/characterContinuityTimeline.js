/**
 * P94 — Character continuity timeline across Matrix shots.
 */

import { getActiveCharacterProfiles } from './projectBibleVault';
import { resolveCharacterKeysForShot, resolveStateAtShot, diffContinuityStates } from './continuityState';
import { parseSceneAndShotID } from './sceneShotUtils';

function charByKey(profiles, key) {
  const k = String(key || '').toLowerCase();
  return (profiles || []).find(
    (c) =>
      String(c?.id || '').toLowerCase() === k ||
      String(c?.tag || '').toLowerCase() === k ||
      String(c?.name || '').toLowerCase() === k
  );
}

/**
 * Build per-character continuity timeline for a project slate.
 * @returns {{ projectTitle, characters: Array<{ key, name, beats: Array }> }}
 */
export function buildCharacterContinuityTimeline({
  projectTitle = '',
  shots = [],
  characters = null
} = {}) {
  const profiles = Array.isArray(characters) ? characters : getActiveCharacterProfiles();
  const live = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived);
  const byKey = new Map();

  live.forEach((shot, shotIndex) => {
    const entries = resolveCharacterKeysForShot(shot, null);
    entries.forEach((entry) => {
      const key = entry?.key || entry;
      const profile = entry?.char || charByKey(profiles, key);
      const state = resolveStateAtShot(key, profile, live, shotIndex);
      const prevState =
        shotIndex > 0 ? resolveStateAtShot(key, profile, live, shotIndex - 1) : null;
      const deltas = prevState ? diffContinuityStates(prevState, state) : [];
      const parsed = parseSceneAndShotID(shot, shotIndex);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          name: profile?.name || profile?.tag || key,
          beats: []
        });
      }
      byKey.get(key).beats.push({
        shotIndex,
        sceneShotId: parsed.shortId || shot.sceneShotId || `SH_${shotIndex + 1}`,
        state,
        deltas,
        hasExplicitPatch: Boolean(shot.continuityPatch?.[key]),
        changed: deltas.length > 0
      });
    });
  });

  return {
    projectTitle,
    generatedAt: new Date().toISOString(),
    characters: Array.from(byKey.values()).sort((a, b) =>
      String(a.name).localeCompare(String(b.name))
    )
  };
}

export function characterContinuityTimelineSummary(timeline) {
  const chars = timeline?.characters || [];
  let beats = 0;
  let drifts = 0;
  chars.forEach((c) => {
    (c.beats || []).forEach((b) => {
      beats += 1;
      if (b.changed && !b.hasExplicitPatch) drifts += 1;
    });
  });
  return { characters: chars.length, beats, drifts };
}
