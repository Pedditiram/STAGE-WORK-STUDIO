/**
 * Shot + scene version stacks for Matrix.
 * Versions ride on the shot object and sync with the film body (text).
 */
import { parseSceneAndShotID } from './sceneShotUtils';

function stamp() {
  return new Date().toISOString();
}

function cloneShot(shot) {
  try {
    return JSON.parse(JSON.stringify(shot || {}));
  } catch {
    return { ...(shot || {}) };
  }
}

/** Strip version stacks before nesting a snapshot (avoid recursive bloat). */
export function shotPayloadForVersion(shot) {
  const s = cloneShot(shot);
  delete s._shotVersions;
  delete s._sceneVersions;
  return s;
}

export function listShotVersions(shot) {
  return Array.isArray(shot?._shotVersions) ? shot._shotVersions : [];
}

export function pushShotVersion(shot, label = '') {
  const snap = shotPayloadForVersion(shot);
  const entry = {
    id: `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label: String(label || '').trim() || `Shot v${listShotVersions(shot).length + 1}`,
    at: stamp(),
    shot: snap
  };
  const prev = listShotVersions(shot);
  return {
    ...shot,
    _shotVersions: [entry, ...prev].slice(0, 20)
  };
}

export function restoreShotVersion(shot, versionId) {
  const entry = listShotVersions(shot).find((v) => v.id === versionId);
  if (!entry?.shot) return shot;
  return {
    ...cloneShot(entry.shot),
    _shotVersions: listShotVersions(shot),
    sceneShotId: shot.sceneShotId || entry.shot.sceneShotId
  };
}

export function listSceneVersions(shot) {
  return Array.isArray(shot?._sceneVersions) ? shot._sceneVersions : [];
}

/**
 * Save a scene version on the first shot of the scene (carrier).
 * `sceneShots` = all shots in that scene (current order).
 */
export function pushSceneVersion(carrierShot, sceneShots, label = '') {
  const payload = (Array.isArray(sceneShots) ? sceneShots : []).map(shotPayloadForVersion);
  const entry = {
    id: `scv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label: String(label || '').trim() || `Scene v${listSceneVersions(carrierShot).length + 1}`,
    at: stamp(),
    shots: payload
  };
  const prev = listSceneVersions(carrierShot);
  return {
    ...carrierShot,
    _sceneVersions: [entry, ...prev].slice(0, 12)
  };
}

export function findSceneVersion(carrierShot, versionId) {
  return listSceneVersions(carrierShot).find((v) => v.id === versionId) || null;
}

/**
 * Replace all shots in a scene with a saved scene version payload.
 * Carrier keeps the version stack. Returns a new shots array or the original.
 */
export function restoreSceneVersion(shots, carrierIndex, versionId) {
  if (!Array.isArray(shots) || carrierIndex < 0 || carrierIndex >= shots.length) return shots;
  const carrier = shots[carrierIndex];
  const entry = findSceneVersion(carrier, versionId);
  if (!entry?.shots?.length) return shots;

  const sceneNum = parseSceneAndShotID(carrier?.sceneShotId || '')?.sceneNum;
  if (!sceneNum) return shots;

  const start = shots.findIndex(
    (s) => parseSceneAndShotID(s?.sceneShotId || '')?.sceneNum === sceneNum
  );
  if (start < 0) return shots;
  let end = start;
  while (
    end + 1 < shots.length &&
    parseSceneAndShotID(shots[end + 1]?.sceneShotId || '')?.sceneNum === sceneNum
  ) {
    end += 1;
  }

  const stack = listSceneVersions(carrier);
  const restored = entry.shots.map((s, i) => {
    const base = cloneShot(s);
    if (i === 0) base._sceneVersions = stack;
    return base;
  });
  return [...shots.slice(0, start), ...restored, ...shots.slice(end + 1)];
}

/** Resolve synopsis for craft context — this shot, then any sibling in the same scene. */
export function resolveSceneSynopsis(shot, allShots = []) {
  const own = String(shot?.sceneSynopsis || '').trim();
  if (own) return own;
  const sceneNum = parseSceneAndShotID(shot?.sceneShotId || '')?.sceneNum;
  if (!sceneNum || !Array.isArray(allShots)) return '';
  for (const s of allShots) {
    const t = String(s?.sceneSynopsis || '').trim();
    if (!t) continue;
    const p = parseSceneAndShotID(s?.sceneShotId || '');
    if (p?.sceneNum === sceneNum) return t;
  }
  return '';
}
