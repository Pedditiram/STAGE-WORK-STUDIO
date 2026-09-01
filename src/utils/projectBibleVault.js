/**
 * P0c — Project-scoped Character / World stores.
 * Library + per-title vault keys are SoT; global vault keys are the active-film cache only.
 */

import { isUsableProjectTitle, normalizeProjectTitle } from './activeProjectGate';
import { safeLocalStorageSetItem } from './safeStorage';

export const ACTIVE_CHARACTER_VAULT_KEY = 'sps_character_bible_vault';
export const ACTIVE_WORLD_VAULT_KEY = 'sps_world_environment_vault';
export const BIBLE_ACTIVE_TITLE_KEY = 'sps_bible_vault_title';

function slugProjectTitle(title) {
  const s = String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'untitled';
}

function titlesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export function characterVaultKeyForTitle(title) {
  return `sps_char_bible::${slugProjectTitle(title)}`;
}

export function worldVaultKeyForTitle(title) {
  return `sps_world_env::${slugProjectTitle(title)}`;
}

export function readActiveProjectTitle(fallback = '') {
  if (typeof window === 'undefined') return normalizeProjectTitle(fallback);
  try {
    return (
      normalizeProjectTitle(fallback) ||
      normalizeProjectTitle(localStorage.getItem('sps_current_project_title')) ||
      normalizeProjectTitle(localStorage.getItem(BIBLE_ACTIVE_TITLE_KEY))
    );
  } catch {
    return normalizeProjectTitle(fallback);
  }
}

function parseArray(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readActiveArray(key) {
  if (typeof window === 'undefined') return [];
  try {
    return parseArray(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

export function readTitleCharacterVault(title) {
  if (typeof window === 'undefined' || !isUsableProjectTitle(title)) return null;
  try {
    return parseArray(localStorage.getItem(characterVaultKeyForTitle(title)));
  } catch {
    return null;
  }
}

export function readTitleWorldVault(title) {
  if (typeof window === 'undefined' || !isUsableProjectTitle(title)) return null;
  try {
    return parseArray(localStorage.getItem(worldVaultKeyForTitle(title)));
  } catch {
    return null;
  }
}

export function writeTitleCharacterVault(title, profiles) {
  if (typeof window === 'undefined' || !isUsableProjectTitle(title)) return;
  try {
    safeLocalStorageSetItem(characterVaultKeyForTitle(title), JSON.stringify(Array.isArray(profiles) ? profiles : []));
  } catch {
    /* ignore */
  }
}

export function writeTitleWorldVault(title, assets) {
  if (typeof window === 'undefined' || !isUsableProjectTitle(title)) return;
  try {
    safeLocalStorageSetItem(worldVaultKeyForTitle(title), JSON.stringify(Array.isArray(assets) ? assets : []));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve Cast for a project without reading another film's active cache.
 * Prefer explicit project field (incl. []) → title vault → [].
 */
export function resolveProjectCharacterProfiles(project) {
  const title = normalizeProjectTitle(project?.title);
  if (Array.isArray(project?.characterProfiles)) {
    return project.characterProfiles;
  }
  const titled = readTitleCharacterVault(title);
  if (titled) return titled;
  return [];
}

export function resolveProjectWorldAssets(project) {
  const title = normalizeProjectTitle(project?.title);
  if (Array.isArray(project?.worldAssets)) {
    return project.worldAssets;
  }
  const titled = readTitleWorldVault(title);
  if (titled) return titled;
  return [];
}

/** Prefer non-empty bible data so empty active cache cannot wipe a richer project record. */
export function preferBibleArray(preferred, fallback) {
  if (Array.isArray(preferred) && preferred.length > 0) return preferred;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  if (Array.isArray(preferred)) return preferred;
  if (Array.isArray(fallback)) return fallback;
  return [];
}

export function parkBibleVaultsToTitle(title) {
  const t = normalizeProjectTitle(title);
  if (!isUsableProjectTitle(t) || typeof window === 'undefined') {
    return {
      characterProfiles: readActiveArray(ACTIVE_CHARACTER_VAULT_KEY),
      worldAssets: readActiveArray(ACTIVE_WORLD_VAULT_KEY)
    };
  }
  const characterProfiles = readActiveArray(ACTIVE_CHARACTER_VAULT_KEY);
  const worldAssets = readActiveArray(ACTIVE_WORLD_VAULT_KEY);
  writeTitleCharacterVault(t, characterProfiles);
  writeTitleWorldVault(t, worldAssets);
  try {
    localStorage.setItem(BIBLE_ACTIVE_TITLE_KEY, t);
  } catch {
    /* ignore */
  }
  return { characterProfiles, worldAssets };
}

export function loadBibleVaultsForProject(project) {
  if (typeof window === 'undefined' || !project) {
    return { characterProfiles: [], worldAssets: [] };
  }
  const title = normalizeProjectTitle(project.title);
  const characterProfiles = resolveProjectCharacterProfiles(project);
  const worldAssets = resolveProjectWorldAssets(project);

  try {
    safeLocalStorageSetItem(ACTIVE_CHARACTER_VAULT_KEY, JSON.stringify(characterProfiles));
    safeLocalStorageSetItem(ACTIVE_WORLD_VAULT_KEY, JSON.stringify(worldAssets));
    if (isUsableProjectTitle(title)) {
      writeTitleCharacterVault(title, characterProfiles);
      writeTitleWorldVault(title, worldAssets);
      localStorage.setItem(BIBLE_ACTIVE_TITLE_KEY, title);
    }
    window.dispatchEvent(new CustomEvent('sps_character_vault_updated'));
    window.dispatchEvent(new CustomEvent('sps_world_vault_updated'));
  } catch {
    /* ignore */
  }

  return { characterProfiles, worldAssets };
}

export function saveActiveCharacterProfiles(profiles, { title = '', silent = false } = {}) {
  if (typeof window === 'undefined') return;
  const next = Array.isArray(profiles) ? profiles : [];
  try {
    safeLocalStorageSetItem(ACTIVE_CHARACTER_VAULT_KEY, JSON.stringify(next));
    const t = readActiveProjectTitle(title);
    if (isUsableProjectTitle(t)) {
      writeTitleCharacterVault(t, next);
      localStorage.setItem(BIBLE_ACTIVE_TITLE_KEY, t);
    }
    if (!silent) window.dispatchEvent(new CustomEvent('sps_character_vault_updated'));
  } catch {
    /* ignore */
  }
}

export function saveActiveWorldAssets(assets, { title = '', silent = false } = {}) {
  if (typeof window === 'undefined') return;
  const next = Array.isArray(assets) ? assets : [];
  try {
    safeLocalStorageSetItem(ACTIVE_WORLD_VAULT_KEY, JSON.stringify(next));
    const t = readActiveProjectTitle(title);
    if (isUsableProjectTitle(t)) {
      writeTitleWorldVault(t, next);
      localStorage.setItem(BIBLE_ACTIVE_TITLE_KEY, t);
    }
    if (!silent) window.dispatchEvent(new CustomEvent('sps_world_vault_updated'));
  } catch {
    /* ignore */
  }
}

export function getActiveCharacterProfiles() {
  reconcileActiveBibleToCurrentTitle();
  return readActiveArray(ACTIVE_CHARACTER_VAULT_KEY);
}

export function getActiveWorldAssets() {
  reconcileActiveBibleToCurrentTitle();
  return readActiveArray(ACTIVE_WORLD_VAULT_KEY);
}

/**
 * P102 — If the active cache is stamped for another film, reload that film’s titled vault
 * (or clear) so Cast/World never bleed across projects after restart.
 */
export function reconcileActiveBibleToCurrentTitle() {
  if (typeof window === 'undefined') return { ok: true, reconciled: false };
  try {
    const current = normalizeProjectTitle(localStorage.getItem('sps_current_project_title'));
    if (!isUsableProjectTitle(current)) return { ok: true, reconciled: false };
    const marked = normalizeProjectTitle(localStorage.getItem(BIBLE_ACTIVE_TITLE_KEY));
    if (marked && titlesMatch(marked, current)) return { ok: true, reconciled: false };

    const chars = readTitleCharacterVault(current) || [];
    const world = readTitleWorldVault(current) || [];
    safeLocalStorageSetItem(ACTIVE_CHARACTER_VAULT_KEY, JSON.stringify(chars));
    safeLocalStorageSetItem(ACTIVE_WORLD_VAULT_KEY, JSON.stringify(world));
    localStorage.setItem(BIBLE_ACTIVE_TITLE_KEY, current);
    window.dispatchEvent(
      new CustomEvent('sps_bible_vault_reconciled', {
        detail: { title: current, from: marked || '', cast: chars.length, world: world.length }
      })
    );
    return { ok: true, reconciled: true, title: current, from: marked };
  } catch {
    return { ok: false, reconciled: false };
  }
}

/** Stamp Cast/World onto a project without empty active cache clobbering richer stored data. */
export function mergeOpenBibleOntoProject(project, openExtras = {}) {
  if (!project) return project;
  const title = normalizeProjectTitle(project.title);
  const fromOpenChars = openExtras.characterProfiles;
  const fromOpenWorld = openExtras.worldAssets;
  const characterProfiles = preferBibleArray(fromOpenChars, project.characterProfiles);
  const worldAssets = preferBibleArray(fromOpenWorld, project.worldAssets);
  if (isUsableProjectTitle(title)) {
    if (Array.isArray(characterProfiles)) writeTitleCharacterVault(title, characterProfiles);
    if (Array.isArray(worldAssets)) writeTitleWorldVault(title, worldAssets);
  }
  return {
    ...project,
    characterProfiles,
    worldAssets
  };
}

/** True when active cache still belongs to another film (should not auto-seed into it). */
export function activeBibleBelongsToTitle(title) {
  if (typeof window === 'undefined') return false;
  try {
    const marked = normalizeProjectTitle(localStorage.getItem(BIBLE_ACTIVE_TITLE_KEY));
    const current = normalizeProjectTitle(title);
    if (!isUsableProjectTitle(current)) return false;
    if (marked) return titlesMatch(marked, current);
    return titlesMatch(localStorage.getItem('sps_current_project_title'), current);
  } catch {
    return false;
  }
}
