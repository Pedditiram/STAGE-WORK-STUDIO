/**
 * Canonical localStorage keys for Director Psychology / Vision Vault.
 * Snake: sps_director_psychology_${title} (+ fallback sps_global_director_psychology)
 * Legacy camel: sps_directorPsychology_${title} — migrated on read.
 * P87 — revision + conflict-aware save.
 */

export function getDirectorPsychologyKey(title) {
  return 'sps_director_psychology_' + (title || 'default');
}

function getLegacyCamelKey(title) {
  return 'sps_directorPsychology_' + (title || 'default');
}

export const GLOBAL_DIRECTOR_PSYCHOLOGY_KEY = 'sps_global_director_psychology';

function nowIso() {
  return new Date().toISOString();
}

function parseLoose(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function asObject(data) {
  if (!data) return {};
  if (typeof data === 'string') return parseLoose(data) || {};
  if (typeof data === 'object') return { ...data };
  return {};
}

/**
 * Load director psychology JSON string (or null).
 * Tries snake → camel (migrates to snake) → global.
 */
export function loadDirectorPsychology(title) {
  if (typeof window === 'undefined') return null;
  try {
    const snakeKey = getDirectorPsychologyKey(title);
    const snake = localStorage.getItem(snakeKey);
    if (snake) return snake;

    const camelKey = getLegacyCamelKey(title);
    const camel = localStorage.getItem(camelKey);
    if (camel) {
      try {
        localStorage.setItem(snakeKey, camel);
        localStorage.removeItem(camelKey);
      } catch (e) {}
      return camel;
    }

    return localStorage.getItem(GLOBAL_DIRECTOR_PSYCHOLOGY_KEY);
  } catch (e) {
    return null;
  }
}

export function readDirectorPsychologyObject(title) {
  return parseLoose(loadDirectorPsychology(title));
}

function visionRichness(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  return Object.keys(obj).filter((k) => !['revision', 'updatedAt'].includes(k)).length;
}

/** Prefer storage key revision over stale project.directorPsychology field. */
export function resolveProjectDirectorPsychology(project) {
  if (!project) return null;
  const title = String(project.title || '').trim();
  const fromStorage = readDirectorPsychologyObject(title);
  const fromProject = project.directorPsychology;
  if (fromStorage && visionRichness(fromStorage) > 0) {
    const projRev = Number(fromProject?.revision) || 0;
    const storeRev = Number(fromStorage.revision) || 0;
    if (!fromProject || storeRev >= projRev || visionRichness(fromProject) === 0) {
      return fromStorage;
    }
  }
  if (fromProject && typeof fromProject === 'object') return fromProject;
  return fromStorage || null;
}

/**
 * Persist director psychology. Writes snake key only; removes legacy camel duplicate.
 * @returns {{ ok: true, revision, data } | { ok: false, conflict: true, revision, current }}
 */
export function saveDirectorPsychology(title, data, { expectedRevision = null, force = false } = {}) {
  if (typeof window === 'undefined') return { ok: false, offline: true };
  try {
    const existing = readDirectorPsychologyObject(title) || {};
    const rev = Number(existing.revision) || 0;
    if (expectedRevision != null && !force && Number(expectedRevision) !== rev) {
      return { ok: false, conflict: true, revision: rev, current: existing };
    }
    const next = {
      ...asObject(data),
      revision: rev + 1,
      updatedAt: nowIso()
    };
    const snakeKey = getDirectorPsychologyKey(title);
    localStorage.setItem(snakeKey, JSON.stringify(next));
    try {
      localStorage.removeItem(getLegacyCamelKey(title));
    } catch (e) {}
    try {
      window.dispatchEvent(
        new CustomEvent('sps_department_vision_updated', {
          detail: { title, vault: 'director', revision: next.revision }
        })
      );
    } catch (e) {}
    return { ok: true, revision: next.revision, data: next };
  } catch (e) {
    return { ok: false, error: e?.message || 'save failed' };
  }
}

/** Snapshot active director psychology onto the titled key (workspace park). */
export function parkDirectorPsychologyForTitle(title) {
  if (typeof window === 'undefined') return null;
  const t = String(title || '').trim();
  if (!t) return null;
  const raw = loadDirectorPsychology(t);
  if (!raw) return null;
  try {
    localStorage.setItem(getDirectorPsychologyKey(t), raw);
  } catch (e) {}
  return readDirectorPsychologyObject(t);
}
