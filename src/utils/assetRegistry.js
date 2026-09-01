/**
 * P0b — Stable asset registry (CHAR_* / WORLD_*).
 * Shots reference IDs; bibles hold the canonical asset records per project title.
 */

import { isUsableProjectTitle, normalizeProjectTitle } from './activeProjectGate';
import { getActiveCharacterProfiles, getActiveWorldAssets } from './projectBibleVault';
import { ensureShotSpecMeta, normalizeShotSpecArray } from './shotSpec';
import { safeLocalStorageSetItem } from './safeStorage';

export const ACTIVE_ASSET_REGISTRY_KEY = 'sps_active_asset_registry';
export const CHAR_ID_PREFIX = 'CHAR_';
export const WORLD_ID_PREFIX = 'WORLD_';

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

function nowIso() {
  return new Date().toISOString();
}

function normTag(tag) {
  const t = String(tag || '').trim();
  if (!t) return '';
  return t.startsWith('@') ? t.toLowerCase() : `@${t.toLowerCase()}`;
}

function normName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isStableCharId(id) {
  return /^CHAR_\d{3,}$/i.test(String(id || '').trim());
}

function isStableWorldId(id) {
  return /^WORLD_\d{3,}$/i.test(String(id || '').trim());
}

export { isStableCharId, isStableWorldId };

function nextCharId(registry) {
  const nums = (registry?.characters || [])
    .map((c) => parseInt(String(c.assetId || '').replace(/^CHAR_/i, ''), 10))
    .filter((n) => Number.isFinite(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${CHAR_ID_PREFIX}${String(n).padStart(3, '0')}`;
}

function nextWorldId(registry) {
  const nums = (registry?.world || [])
    .map((w) => parseInt(String(w.assetId || '').replace(/^WORLD_/i, ''), 10))
    .filter((n) => Number.isFinite(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${WORLD_ID_PREFIX}${String(n).padStart(3, '0')}`;
}

export function assetRegistryKeyForTitle(title) {
  return `sps_asset_registry::${slugProjectTitle(title)}`;
}

export function emptyAssetRegistry(projectTitle = '') {
  return {
    projectTitle: normalizeProjectTitle(projectTitle),
    version: 1,
    updatedAt: nowIso(),
    characters: [],
    world: []
  };
}

export function readAssetRegistryForTitle(title) {
  if (typeof window === 'undefined') return null;
  const t = normalizeProjectTitle(title);
  if (!t) return null;
  try {
    const raw = localStorage.getItem(assetRegistryKeyForTitle(t));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function readActiveAssetRegistry() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_ASSET_REGISTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function stampStoryPackageOntoLibrary(title, registry) {
  if (typeof window === 'undefined' || !isUsableProjectTitle(title)) return;
  try {
    const raw = localStorage.getItem('sps_project_library');
    const library = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(library)) return;
    let changed = false;
    const nextLib = library.map((p) => {
      if (!titlesMatch(p?.title, title)) return p;
      changed = true;
      return { ...p, assetRegistry: registry, lastModifiedIso: nowIso() };
    });
    if (changed) safeLocalStorageSetItem('sps_project_library', JSON.stringify(nextLib));
  } catch {
    /* ignore */
  }
}

export function saveAssetRegistry(registry, { activate = true } = {}) {
  if (typeof window === 'undefined' || !registry) return null;
  const title = normalizeProjectTitle(registry.projectTitle);
  const next = { ...registry, projectTitle: title, updatedAt: nowIso() };
  try {
    if (isUsableProjectTitle(title)) {
      safeLocalStorageSetItem(assetRegistryKeyForTitle(title), JSON.stringify(next));
      stampStoryPackageOntoLibrary(title, next);
    }
    if (activate) safeLocalStorageSetItem(ACTIVE_ASSET_REGISTRY_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('sps_asset_registry_updated', { detail: { title } }));
  } catch {
    /* ignore */
  }
  return next;
}

export function applyOpenAssetRegistry(project) {
  if (typeof window === 'undefined' || !project) return null;
  const title = normalizeProjectTitle(project.title);
  const fromProject =
    project.assetRegistry && typeof project.assetRegistry === 'object' ? project.assetRegistry : null;
  const fromTitle = readAssetRegistryForTitle(title);
  const registry = fromProject || fromTitle;
  if (!registry) {
    try {
      localStorage.removeItem(ACTIVE_ASSET_REGISTRY_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
  const normalized = { ...registry, projectTitle: title || registry.projectTitle };
  saveAssetRegistry(normalized, { activate: true });
  return normalized;
}

export function parkAssetRegistryForTitle(title) {
  const t = normalizeProjectTitle(title);
  const active = readActiveAssetRegistry();
  if (!active || !isUsableProjectTitle(t)) return active;
  if (!titlesMatch(active.projectTitle, t) && isUsableProjectTitle(active.projectTitle)) {
    return saveAssetRegistry(active, { activate: false });
  }
  return saveAssetRegistry({ ...active, projectTitle: t }, { activate: false });
}

function findCharEntry(registry, { assetId, legacyId, tag, name } = {}) {
  const list = registry?.characters || [];
  if (assetId) {
    const hit = list.find((c) => c.assetId === assetId);
    if (hit) return hit;
  }
  if (legacyId) {
    const hit = list.find((c) => c.legacyId === legacyId);
    if (hit) return hit;
  }
  const nt = normTag(tag);
  if (nt) {
    const hit = list.find((c) => normTag(c.tag) === nt);
    if (hit) return hit;
  }
  const nn = normName(name);
  if (nn) {
    const hit = list.find((c) => normName(c.name) === nn);
    if (hit) return hit;
  }
  return null;
}

function findWorldEntry(registry, { assetId, legacyId, tag, name } = {}) {
  const list = registry?.world || [];
  if (assetId) {
    const hit = list.find((w) => w.assetId === assetId);
    if (hit) return hit;
  }
  if (legacyId) {
    const hit = list.find((w) => w.legacyId === legacyId);
    if (hit) return hit;
  }
  const nt = normTag(tag);
  if (nt) {
    const hit = list.find((w) => normTag(w.tag) === nt);
    if (hit) return hit;
  }
  const nn = normName(name);
  if (nn) {
    const hit = list.find((w) => normName(w.name) === nn);
    if (hit) return hit;
  }
  return null;
}

function upsertCharEntry(registry, profile) {
  if (!profile) return registry;
  const existing = findCharEntry(registry, {
    assetId: profile.assetId,
    legacyId: profile.id,
    tag: profile.tag,
    name: profile.name
  });
  const assetId =
    (isStableCharId(profile.assetId) && profile.assetId) ||
    (existing?.assetId && isStableCharId(existing.assetId) ? existing.assetId : nextCharId(registry));
  const entry = {
    assetId,
    legacyId: profile.id || existing?.legacyId || '',
    tag: profile.tag || existing?.tag || '',
    name: profile.name || existing?.name || '',
    role: profile.role || existing?.role || ''
  };
  const chars = [...(registry.characters || [])];
  const idx = chars.findIndex((c) => c.assetId === assetId);
  if (idx >= 0) chars[idx] = { ...chars[idx], ...entry };
  else chars.push(entry);
  return { ...registry, characters: chars };
}

function upsertWorldEntry(registry, asset) {
  if (!asset) return registry;
  const existing = findWorldEntry(registry, {
    assetId: asset.assetId,
    legacyId: asset.id,
    tag: asset.tag,
    name: asset.name
  });
  const assetId =
    (isStableWorldId(asset.assetId) && asset.assetId) ||
    (existing?.assetId && isStableWorldId(existing.assetId) ? existing.assetId : nextWorldId(registry));
  const entry = {
    assetId,
    legacyId: asset.id || existing?.legacyId || '',
    tag: asset.tag || existing?.tag || '',
    name: asset.name || existing?.name || '',
    type: asset.type || existing?.type || 'location'
  };
  const world = [...(registry.world || [])];
  const idx = world.findIndex((w) => w.assetId === assetId);
  if (idx >= 0) world[idx] = { ...world[idx], ...entry };
  else world.push(entry);
  return { ...registry, world };
}

export function buildAssetRegistry(projectTitle, characters = [], worldAssets = [], previous = null) {
  let registry = previous
    ? { ...previous, projectTitle: normalizeProjectTitle(projectTitle) || previous.projectTitle }
    : emptyAssetRegistry(projectTitle);
  (Array.isArray(characters) ? characters : []).forEach((c) => {
    registry = upsertCharEntry(registry, c);
  });
  (Array.isArray(worldAssets) ? worldAssets : []).forEach((w) => {
    registry = upsertWorldEntry(registry, w);
  });
  return registry;
}

export function stampCharacterProfiles(characters = [], registry) {
  return (Array.isArray(characters) ? characters : []).map((c) => {
    const entry = findCharEntry(registry, {
      assetId: c.assetId,
      legacyId: c.id,
      tag: c.tag,
      name: c.name
    });
    const assetId = entry?.assetId || (isStableCharId(c.assetId) ? c.assetId : '');
    return assetId ? { ...c, assetId } : c;
  });
}

export function stampWorldAssets(assets = [], registry) {
  return (Array.isArray(assets) ? assets : []).map((a) => {
    const entry = findWorldEntry(registry, {
      assetId: a.assetId,
      legacyId: a.id,
      tag: a.tag,
      name: a.name
    });
    const assetId = entry?.assetId || (isStableWorldId(a.assetId) ? a.assetId : '');
    return assetId ? { ...a, assetId } : a;
  });
}

function harvestCharHintsFromShot(shot) {
  const hints = [];
  const ref = String(shot?.characterIdAssetRef || '');
  (ref.match(/@([A-Za-z][A-Za-z0-9_]{1,32})/g) || []).forEach((t) => hints.push({ tag: t }));
  const labeled = ref.match(/CharID\s*:\s*@?([A-Za-z][A-Za-z0-9_ ]{1,40})/i);
  if (labeled) hints.push({ name: labeled[1].trim() });
  String(shot?.coArtistInteraction || '')
    .match(/@([A-Za-z][A-Za-z0-9_]{1,32})/g)
    ?.forEach((t) => hints.push({ tag: t }));
  String(shot?.characterIdMatrix || '')
    .split('|')
    .forEach((part) => {
      const rhs = part.includes('=') ? part.split('=').slice(1).join('=') : part;
      (String(rhs).match(/@([A-Za-z][A-Za-z0-9_]{1,32})/g) || []).forEach((t) => hints.push({ tag: t }));
    });
  return hints;
}

function harvestWorldHintsFromShot(shot) {
  const hints = [];
  const hay = `${shot?.actionEnvContext || ''} ${shot?.timeAndLightingEnv || ''} ${shot?.atmosphereVolumetricsTag || ''}`;
  (hay.match(/@World_([A-Za-z0-9_]+)/gi) || []).forEach((t) => hints.push({ tag: t }));
  return hints;
}

export function linkShotToAssetRegistry(shot, registry) {
  const base = ensureShotSpecMeta(shot);
  const charIds = new Set(base.charAssetIds || []);
  const worldIds = new Set(base.worldAssetIds || []);

  harvestCharHintsFromShot(base).forEach((hint) => {
    const entry = findCharEntry(registry, hint);
    if (entry?.assetId) charIds.add(entry.assetId);
  });

  harvestWorldHintsFromShot(base).forEach((hint) => {
    const entry = findWorldEntry(registry, hint);
    if (entry?.assetId) worldIds.add(entry.assetId);
  });

  // Fallback: token overlap for world when no @World tag
  if (!worldIds.size && (registry?.world || []).length) {
    const envRef = `${base.actionEnvContext || ''} ${base.timeAndLightingEnv || ''}`.toLowerCase();
    const matched = (registry.world || []).find((asset) => {
      const hay = `${asset.name || ''} ${asset.tag || ''}`.toLowerCase();
      const tokens = hay.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      return tokens.some((t) => envRef.includes(t));
    });
    if (matched?.assetId) worldIds.add(matched.assetId);
  }

  return {
    ...base,
    charAssetIds: [...charIds],
    worldAssetIds: [...worldIds]
  };
}

export function linkShotsToAssetRegistry(shots = [], registry) {
  return normalizeShotSpecArray(
    (Array.isArray(shots) ? shots : []).map((s) => linkShotToAssetRegistry(s, registry))
  );
}

export function resolveRegistryCharacters(registry, assetIds = []) {
  const ids = Array.isArray(assetIds) ? assetIds : [];
  return ids
    .map((id) => (registry?.characters || []).find((c) => c.assetId === id))
    .filter(Boolean);
}

export function resolveRegistryWorldAssets(registry, assetIds = []) {
  const ids = Array.isArray(assetIds) ? assetIds : [];
  return ids
    .map((id) => (registry?.world || []).find((w) => w.assetId === id))
    .filter(Boolean);
}

export function assetRegistrySummary(registry) {
  if (!registry) return { characters: 0, world: 0, projectTitle: '' };
  return {
    projectTitle: registry.projectTitle || '',
    characters: (registry.characters || []).length,
    world: (registry.world || []).length,
    updatedAt: registry.updatedAt || ''
  };
}

/**
 * Stamp CHAR_/WORLD_ IDs on bibles, link shots, persist registry for this title.
 */
export function applyProductionAssetSpec({
  projectTitle = '',
  shots = [],
  characters = null,
  worldAssets = null
} = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const prev =
    readAssetRegistryForTitle(title) ||
    (readActiveAssetRegistry()?.projectTitle === title ? readActiveAssetRegistry() : null);
  const chars = characters ?? getActiveCharacterProfiles();
  const worlds = worldAssets ?? getActiveWorldAssets();

  let registry = buildAssetRegistry(title, chars, worlds, prev);
  const stampedChars = stampCharacterProfiles(chars, registry);
  const stampedWorld = stampWorldAssets(worlds, registry);

  registry = buildAssetRegistry(title, stampedChars, stampedWorld, registry);
  const stampedShots = linkShotsToAssetRegistry(shots, registry);
  saveAssetRegistry(registry, { activate: true });

  return {
    registry,
    shots: stampedShots,
    characters: stampedChars,
    worldAssets: stampedWorld
  };
}
