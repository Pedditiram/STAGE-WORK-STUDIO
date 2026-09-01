/**
 * P85 — Production Bible read aggregator.
 * Cast + World + Director / DoP / Sound as one completeness snapshot (no new SoT).
 */

import { isUsableProjectTitle, normalizeProjectTitle } from './activeProjectGate';
import {
  getActiveCharacterProfiles,
  getActiveWorldAssets,
  readTitleCharacterVault,
  readTitleWorldVault,
  readActiveProjectTitle
} from './projectBibleVault';
import { loadDirectorPsychology } from './directorPsychologyStorage';
import { loadDoPVision, loadSoundVision } from './departmentVisionStorage';

function parseJsonLoose(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function visionFilled(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const modes = [obj.human, obj.ai, obj.hybrid, obj];
  return modes.some((slice) => {
    if (!slice || typeof slice !== 'object') return false;
    return Object.keys(slice).some((k) => {
      if (['compilerActiveMode', 'revision', 'updatedAt', 'activeVisionTab'].includes(k)) return false;
      const v = slice[k];
      if (typeof v === 'string') return Boolean(String(v).trim());
      if (v && typeof v === 'object') return Object.keys(v).length > 0;
      return Boolean(v);
    });
  });
}

export function productionBibleCompleteness({
  characters = [],
  world = [],
  director = null,
  dop = null,
  sound = null
} = {}) {
  const checks = {
    cast: Array.isArray(characters) && characters.length > 0,
    world: Array.isArray(world) && world.length > 0,
    director: visionFilled(director),
    dop: visionFilled(dop),
    sound: visionFilled(sound)
  };
  const keys = Object.keys(checks);
  const filled = keys.filter((k) => checks[k]).length;
  const pct = keys.length ? Math.round((filled / keys.length) * 100) : 0;
  return { ...checks, filled, total: keys.length, pct };
}

/**
 * Read-only Production Bible snapshot for the active (or named) title.
 */
export function readProductionBible(projectTitle = '') {
  const title =
    normalizeProjectTitle(projectTitle) ||
    readActiveProjectTitle('') ||
    '';
  const usable = isUsableProjectTitle(title);

  const characters = usable
    ? readTitleCharacterVault(title) || getActiveCharacterProfiles() || []
    : getActiveCharacterProfiles() || [];
  const world = usable
    ? readTitleWorldVault(title) || getActiveWorldAssets() || []
    : getActiveWorldAssets() || [];

  const director = parseJsonLoose(loadDirectorPsychology(title || 'default'));
  const dop = parseJsonLoose(loadDoPVision(title || 'default'));
  const sound = parseJsonLoose(loadSoundVision(title || 'default'));

  const completeness = productionBibleCompleteness({
    characters,
    world,
    director,
    dop,
    sound
  });

  return {
    projectTitle: title,
    generatedAt: new Date().toISOString(),
    characters,
    world,
    director,
    dop,
    sound,
    counts: {
      cast: characters.length,
      world: world.length,
      directorRevision: Number(director?.revision) || 0,
      dopRevision: Number(dop?.revision) || 0,
      soundRevision: Number(sound?.revision) || 0
    },
    completeness
  };
}

export function productionBibleSummary(bible) {
  if (!bible) {
    return { cast: 0, world: 0, pct: 0, filled: 0, total: 5 };
  }
  const c = bible.completeness || productionBibleCompleteness(bible);
  return {
    cast: bible.counts?.cast ?? (bible.characters || []).length,
    world: bible.counts?.world ?? (bible.world || []).length,
    pct: c.pct,
    filled: c.filled,
    total: c.total,
    castOk: c.cast,
    worldOk: c.world,
    directorOk: c.director,
    dopOk: c.dop,
    soundOk: c.sound
  };
}
