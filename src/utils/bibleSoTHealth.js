/**
 * P105 — Cast/World/Director bible SoT drift detect + heal.
 * Library fields, titled vault keys, and active cache must agree for the open film.
 */

import { normalizeProjectTitle, isUsableProjectTitle } from './activeProjectGate';
import { titlesMatch } from './projectWorkspace';
import {
  readTitleCharacterVault,
  readTitleWorldVault,
  getActiveCharacterProfiles,
  getActiveWorldAssets,
  preferBibleArray,
  resolveProjectCharacterProfiles,
  resolveProjectWorldAssets,
  writeTitleCharacterVault,
  writeTitleWorldVault
} from './projectBibleVault';
import { readDirectorPsychologyObject, resolveProjectDirectorPsychology } from './directorPsychologyStorage';

function arrayFingerprint(arr) {
  if (!Array.isArray(arr)) return '∅';
  const ids = arr
    .slice(0, 12)
    .map((x) => x?.assetId || x?.id || x?.tag || x?.name || '')
    .join('|');
  return `${arr.length}:${ids}`;
}

function visionFingerprint(obj) {
  if (!obj || typeof obj !== 'object') return '∅';
  const rev = Number(obj.revision) || 0;
  const payloadKeys = Object.keys(obj).filter((k) => !['revision', 'updatedAt'].includes(k)).length;
  return `${rev}:${payloadKeys}`;
}

export function detectBibleSoTDrift({ projectTitle = '', project = null } = {}) {
  const title = normalizeProjectTitle(projectTitle || project?.title);
  if (!isUsableProjectTitle(title)) {
    return { ok: true, drift: false, title, issues: [] };
  }

  const libraryChars = Array.isArray(project?.characterProfiles) ? project.characterProfiles : null;
  const libraryWorld = Array.isArray(project?.worldAssets) ? project.worldAssets : null;
  const vaultChars = readTitleCharacterVault(title) || [];
  const vaultWorld = readTitleWorldVault(title) || [];
  const activeChars = getActiveCharacterProfiles();
  const activeWorld = getActiveWorldAssets();
  const directorStorage = readDirectorPsychologyObject(title);
  const directorProject = project?.directorPsychology;

  const issues = [];

  if (libraryChars && vaultChars.length > 0 && arrayFingerprint(libraryChars) !== arrayFingerprint(vaultChars)) {
    issues.push({
      code: 'CAST_LIBRARY_VAULT',
      message: 'Library characterProfiles differs from titled Cast vault.'
    });
  }
  if (libraryWorld && vaultWorld.length > 0 && arrayFingerprint(libraryWorld) !== arrayFingerprint(vaultWorld)) {
    issues.push({
      code: 'WORLD_LIBRARY_VAULT',
      message: 'Library worldAssets differs from titled World vault.'
    });
  }
  if (
    activeChars.length > 0 &&
    vaultChars.length > 0 &&
    arrayFingerprint(activeChars) !== arrayFingerprint(vaultChars)
  ) {
    issues.push({
      code: 'CAST_ACTIVE_VAULT',
      message: 'Active Cast cache differs from titled vault.'
    });
  }
  if (
    activeWorld.length > 0 &&
    vaultWorld.length > 0 &&
    arrayFingerprint(activeWorld) !== arrayFingerprint(vaultWorld)
  ) {
    issues.push({
      code: 'WORLD_ACTIVE_VAULT',
      message: 'Active World cache differs from titled vault.'
    });
  }
  if (
    directorStorage &&
    Object.keys(directorStorage).length > 1 &&
    directorProject &&
    visionFingerprint(directorStorage) !== visionFingerprint(directorProject)
  ) {
    issues.push({
      code: 'DIRECTOR_LIBRARY_STORAGE',
      message: 'Project directorPsychology differs from Director storage key.'
    });
  }

  return {
    ok: issues.length === 0,
    drift: issues.length > 0,
    title,
    issues,
    counts: {
      libraryCast: libraryChars?.length ?? null,
      vaultCast: vaultChars.length,
      activeCast: activeChars.length,
      libraryWorld: libraryWorld?.length ?? null,
      vaultWorld: vaultWorld.length,
      activeWorld: activeWorld.length
    }
  };
}

/** Prefer active cache → titled vault → library field (never empty-over-rich). */
export function healBibleSoTDrift({ projectTitle = '', project = null } = {}) {
  const title = normalizeProjectTitle(projectTitle || project?.title);
  if (!isUsableProjectTitle(title) || !project) {
    return { ok: false, healed: false, project };
  }

  const characterProfiles = preferBibleArray(
    getActiveCharacterProfiles(),
    preferBibleArray(readTitleCharacterVault(title), resolveProjectCharacterProfiles(project))
  );
  const worldAssets = preferBibleArray(
    getActiveWorldAssets(),
    preferBibleArray(readTitleWorldVault(title), resolveProjectWorldAssets(project))
  );
  const directorPsychology = resolveProjectDirectorPsychology(project);

  writeTitleCharacterVault(title, characterProfiles);
  writeTitleWorldVault(title, worldAssets);

  return {
    ok: true,
    healed: true,
    project: {
      ...project,
      characterProfiles,
      worldAssets,
      directorPsychology,
      lastModifiedIso: new Date().toISOString()
    }
  };
}

export function patchLibraryProjectBibleFields(library, title, fields = {}) {
  const list = Array.isArray(library) ? library : [];
  const t = normalizeProjectTitle(title);
  if (!isUsableProjectTitle(t)) return list;
  return list.map((p) => {
    if (!titlesMatch(p.title, t)) return p;
    return {
      ...p,
      ...fields,
      lastModifiedIso: new Date().toISOString()
    };
  });
}

export function bibleSoTHealthSummary(driftReport) {
  const issues = driftReport?.issues || [];
  return {
    drift: Boolean(driftReport?.drift),
    issueCount: issues.length,
    codes: issues.map((i) => i.code),
    preview: issues.slice(0, 3).map((i) => i.message)
  };
}
