/** Isolate production projects: one film must never overwrite another on reload or sync. */

import {
  getActiveCharacterProfiles,
  getActiveWorldAssets,
  loadBibleVaultsForProject,
  mergeOpenBibleOntoProject,
  parkBibleVaultsToTitle,
  preferBibleArray
} from './projectBibleVault';
import {
  applyOpenStoryPackage,
  parkStoryPackageForTitle,
  readActiveStoryPackage
} from './storyPackage';
import {
  applyOpenAssetRegistry,
  parkAssetRegistryForTitle,
  readActiveAssetRegistry
} from './assetRegistry';
import { applyOpenGenerationJobs, parkGenerationJobsForTitle } from './generationJobs';
import {
  applyOpenDepartmentVisions,
  loadDoPVision,
  loadSoundVision,
  parkDepartmentVisionsForTitle
} from './departmentVisionStorage';
import {
  loadDirectorPsychology,
  saveDirectorPsychology,
  parkDirectorPsychologyForTitle,
  resolveProjectDirectorPsychology
} from './directorPsychologyStorage';
import {
  applyOpenProductionSpine,
  parkProductionSpineForTitle,
  readActiveProductionSpine,
  syncProductionSpine
} from './productionSpine';
import {
  applyOpenProjectLifecycle,
  parkProjectLifecycleForTitle,
  readActiveProjectLifecycle
} from './productionLifecycle';
import { readOpenScreenplayText, writeOpenScreenplayText } from './screenplayInterop';
import { safeLocalStorageSetItem } from './safeStorage';

export const LEGACY_SHARED_ROOM = 'SPS-CLOUD-8821';

export function slugProjectTitle(title) {
  const s = String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'untitled';
}

export function titlesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export function roomIdForProject(title, existingRoomId = '') {
  const existing = String(existingRoomId || '').trim();
  if (existing && existing !== LEGACY_SHARED_ROOM) return existing;
  return `sps_${slugProjectTitle(title)}`;
}

/** Migrate legacy shared room to per-title room id. */
export function ensureProjectRoomId(project) {
  if (!project || !String(project.title || '').trim()) return project;
  const nextRoom = roomIdForProject(project.title, project.roomId);
  if (project.roomId === nextRoom) return project;
  return { ...project, roomId: nextRoom };
}

export function migrateLegacyRoomInLibrary(library = []) {
  return (Array.isArray(library) ? library : []).map((p) => ensureProjectRoomId(p));
}

/**
 * Pick which film is active on cold boot — local session wins when fresher than disk pointer.
 * Disk active_workspace can lag (e.g. after Open folder import without switching studio).
 */
export function resolveActiveTitleForBoot(diskActive = null) {
  if (typeof window === 'undefined') return '';
  let localTitle = '';
  let localAt = 0;
  let localShots = [];
  try {
    localTitle = String(localStorage.getItem('sps_current_project_title') || '').trim();
    localAt = Date.parse(localStorage.getItem('sps_active_workspace_at') || 0) || 0;
    const raw = localStorage.getItem('sps_current_shots');
    if (raw) localShots = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  if (!Array.isArray(localShots)) localShots = [];

  const diskTitle = String(diskActive?.title || '').trim();
  const diskAt = Date.parse(diskActive?.updatedAt || 0) || 0;
  const localHasWork = localShots.length > 0;

  if (!diskTitle) return localTitle;
  if (!localTitle) return diskTitle;
  if (titlesMatch(diskTitle, localTitle)) return localTitle;

  if (localHasWork && localAt >= diskAt) return localTitle;
  if (diskAt > localAt) return diskTitle;
  return localTitle || diskTitle;
}

function shotCount(p) {
  return Array.isArray(p?.shots) ? p.shots.length : 0;
}

function isoOf(p) {
  return Date.parse(p?.lastModifiedIso || p?.updatedAt || 0) || 0;
}

/** Richness score for multi-store merge — never prefer an empty shell over a full film. */
export function projectContentScore(p) {
  if (!p || typeof p !== 'object') return 0;
  const shots = shotCount(p);
  const chars = Array.isArray(p.characterProfiles) ? p.characterProfiles.length : 0;
  const world = Array.isArray(p.worldAssets) ? p.worldAssets.length : 0;
  const screenplay = String(p.screenplayText || p.rawScriptText || '').length;
  const story = p.storyPackage ? 40 : 0;
  const spine = p.productionSpine ? 20 : 0;
  const vision =
    (p.directorPsychology ? 10 : 0) + (p.dopVision ? 10 : 0) + (p.soundVision ? 10 : 0);
  return shots * 100 + chars * 15 + world * 10 + Math.min(80, Math.floor(screenplay / 500)) + story + spine + vision;
}

function preferObj(primary, secondary) {
  if (primary && typeof primary === 'object' && Object.keys(primary).length) return primary;
  if (secondary && typeof secondary === 'object' && Object.keys(secondary).length) return secondary;
  return primary || secondary;
}

function mergeShotsById(primaryShots, secondaryShots) {
  const a = Array.isArray(primaryShots) ? primaryShots : [];
  const b = Array.isArray(secondaryShots) ? secondaryShots : [];
  if (!a.length) return b;
  if (!b.length) return a;
  if (a.length >= b.length * 1.15) return a;
  if (b.length >= a.length * 1.15) return b;
  const byKey = new Map();
  const keyOf = (s, i) => String(s?.sceneShotId || s?.id || `idx_${i}`).toLowerCase();
  b.forEach((s, i) => byKey.set(keyOf(s, i), s));
  a.forEach((s, i) => {
    const k = keyOf(s, i);
    const prev = byKey.get(k);
    byKey.set(k, prev ? { ...prev, ...s } : s);
  });
  const ordered = [];
  const seen = new Set();
  a.forEach((s, i) => {
    const k = keyOf(s, i);
    if (seen.has(k)) return;
    seen.add(k);
    ordered.push(byKey.get(k));
  });
  b.forEach((s, i) => {
    const k = keyOf(s, i);
    if (seen.has(k)) return;
    seen.add(k);
    ordered.push(byKey.get(k));
  });
  return ordered;
}

function mergeOne(a, b) {
  if (!a) return b;
  if (!b) return a;
  const scoreA = projectContentScore(a);
  const scoreB = projectContentScore(b);
  const useB =
    scoreB > scoreA ||
    (scoreB === scoreA &&
      (shotCount(b) > shotCount(a) ||
        (shotCount(b) === shotCount(a) && isoOf(b) >= isoOf(a))));
  const primary = useB ? b : a;
  const secondary = useB ? a : b;
  return {
    ...secondary,
    ...primary,
    shots: mergeShotsById(primary.shots, secondary.shots),
    characterProfiles: preferBibleArray(primary.characterProfiles, secondary.characterProfiles),
    worldAssets: preferBibleArray(primary.worldAssets, secondary.worldAssets),
    screenplayText: primary.screenplayText || secondary.screenplayText || '',
    extractedMasterStory: primary.extractedMasterStory || secondary.extractedMasterStory || '',
    writerCustomSynopsis: primary.writerCustomSynopsis || secondary.writerCustomSynopsis || '',
    storyPackage: preferObj(primary.storyPackage, secondary.storyPackage),
    assetRegistry: preferObj(primary.assetRegistry, secondary.assetRegistry),
    productionSpine: preferObj(primary.productionSpine, secondary.productionSpine),
    projectLifecycle: preferObj(primary.projectLifecycle, secondary.projectLifecycle),
    directorPsychology: preferObj(primary.directorPsychology, secondary.directorPsychology),
    dopVision: preferObj(primary.dopVision, secondary.dopVision),
    soundVision: preferObj(primary.soundVision, secondary.soundVision),
    roomId: roomIdForProject(primary.title, primary.roomId || secondary.roomId),
    lastModifiedIso:
      isoOf(primary) >= isoOf(secondary)
        ? primary.lastModifiedIso || primary.updatedAt || secondary.lastModifiedIso
        : secondary.lastModifiedIso || secondary.updatedAt || primary.lastModifiedIso
  };
}

/** Merge libraries by title so MVK and JAI SHRI RAM stay separate records. */
export function mergeProjectLibraries(local = [], incoming = []) {
  const byTitle = new Map();
  [...(Array.isArray(local) ? local : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((p) => {
    if (!p || !String(p.title || '').trim()) return;
    const key = String(p.title).trim().toLowerCase();
    byTitle.set(key, mergeOne(byTitle.get(key), p));
  });
  return Array.from(byTitle.values()).map((p) => ensureProjectRoomId(p));
}

/**
 * P104 — Ordered multi-store merge: local → vault → cloud (later layers enrich, never wipe unique titles).
 * Sources may be sparse; empty arrays are skipped.
 */
export function mergeLibrarySources({ local = [], vault = [], cloud = [] } = {}) {
  let merged = mergeProjectLibraries([], Array.isArray(local) ? local : []);
  if (Array.isArray(vault) && vault.length) merged = mergeProjectLibraries(merged, vault);
  if (Array.isArray(cloud) && cloud.length) merged = mergeProjectLibraries(merged, cloud);
  return migrateLegacyRoomInLibrary(merged);
}

export function readLocalProjectLibrary() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('sps_project_library');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Drop heavy blobs so browser + Electron localStorage mirrors stay under quota. Full data lives on disk. */
export function slimPosterForLocalMirror(posterUrl) {
  if (!posterUrl || typeof posterUrl !== 'string') return undefined;
  const url = posterUrl.trim();
  if (!url) return undefined;
  // IndexedDB ref — safe and small
  if (url.startsWith('idb:')) return url;
  // Durable disk poster API (Vite + Electron-dev)
  if (url.startsWith('/api/project-poster')) return url;
  // Remote URL
  if (/^https?:\/\//i.test(url) && url.length < 2048) return url;
  // Never keep huge data-URLs in localStorage (quota); disk poster file holds the image
  if (url.startsWith('data:')) return undefined;
  if (url.length < 512) return url;
  return undefined;
}

export function slimProjectForLocalMirror(project) {
  if (!project || typeof project !== 'object') return project;
  const shotCount = Array.isArray(project.shots) ? project.shots.length : Number(project.shotCount) || 0;
  const posterUrl = slimPosterForLocalMirror(project.posterUrl);
  return {
    id: project.id,
    title: project.title,
    description: String(project.description || '').slice(0, 240),
    targetModel: project.targetModel,
    aspectRatio: project.aspectRatio,
    roomId: project.roomId,
    lastModified: project.lastModified,
    lastModifiedIso: project.lastModifiedIso || project.updatedAt,
    updatedAt: project.updatedAt,
    shotCount,
    ...(posterUrl ? { posterUrl } : {}),
    // Index only — full shots/bibles/screenplay are restored from disk on open
    shots: []
  };
}

export function writeLocalProjectLibrary(library) {
  if (typeof window === 'undefined') return false;
  const slim = (Array.isArray(library) ? library : []).map(slimProjectForLocalMirror);
  return safeLocalStorageSetItem('sps_project_library', JSON.stringify(slim));
}

/** Disk + IDB vault is SoT for membership — cloud must never drop local-only films. */
export async function enrichLibraryWithDiskVault(library) {
  const base = Array.isArray(library) ? library : [];
  try {
    const { loadProjectsFromVault } = await import('../services/projectDiskVault');
    const vault = await loadProjectsFromVault();
    if (!Array.isArray(vault) || vault.length === 0) return base;
    return mergeLibrarySources({ local: base, vault });
  } catch {
    return base;
  }
}

/** Full hydrate: localStorage index + disk vault (+ optional cloud list). */
export async function hydrateProjectLibraryFromStores({ cloud = [] } = {}) {
  const local = readLocalProjectLibrary();
  let merged = mergeLibrarySources({
    local,
    vault: [],
    cloud: Array.isArray(cloud) ? cloud : []
  });
  merged = await enrichLibraryWithDiskVault(merged);
  return migrateLegacyRoomInLibrary(merged);
}

function parseVisionLoose(raw) {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function currentWorkspaceTitle() {
  try {
    return String(localStorage.getItem('sps_current_project_title') || '').trim();
  } catch {
    return '';
  }
}

export function collectOpenWorkspace() {
  if (typeof window === 'undefined') return {};
  try {
    const title = currentWorkspaceTitle();
    return {
      screenplayText: readOpenScreenplayText() || '',
      characterProfiles: getActiveCharacterProfiles(),
      worldAssets: getActiveWorldAssets(),
      extractedMasterStory: localStorage.getItem('sps_extracted_master_story') || '',
      writerCustomSynopsis: localStorage.getItem('sps_writer_custom_script_synopsis') || '',
      storyPackage: readActiveStoryPackage() || undefined,
      assetRegistry: readActiveAssetRegistry() || undefined,
      productionSpine: readActiveProductionSpine() || undefined,
      projectLifecycle: readActiveProjectLifecycle() || undefined,
      directorPsychology: parseVisionLoose(loadDirectorPsychology(title || 'default')) || resolveProjectDirectorPsychology({ title }),
      dopVision: parseVisionLoose(loadDoPVision(title || 'default')),
      soundVision: parseVisionLoose(loadSoundVision(title || 'default'))
    };
  } catch {
    return {};
  }
}

export function applyOpenWorkspace(project) {
  if (typeof window === 'undefined' || !project) return;
  const p = ensureProjectRoomId(project);
  try {
    localStorage.setItem('sps_current_room_id', p.roomId || roomIdForProject(p.title));
  } catch {
    /* ignore */
  }
  try {
    // Fire-and-forget — keeps Electron + browser on the same open title
    import('../services/projectDiskVault')
      .then((m) =>
        m.saveActiveWorkspaceToDisk({
          title: p.title,
          roomId: p.roomId || roomIdForProject(p.title)
        })
      )
      .catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    loadBibleVaultsForProject(p);
    applyOpenStoryPackage(p);
    applyOpenAssetRegistry(p);
    applyOpenGenerationJobs(p);
    if (p.directorPsychology) saveDirectorPsychology(p.title, p.directorPsychology, { force: true });
    applyOpenDepartmentVisions(p);
    applyOpenProductionSpine(p);
    applyOpenProjectLifecycle(p);

    const sp = String(p.screenplayText || p.rawScriptText || '');
    if (sp) {
      writeOpenScreenplayText(sp, { silent: true });
    } else {
      try {
        localStorage.removeItem('sps_open_screenplay_text');
        localStorage.removeItem('sps_current_screenplay_text');
        localStorage.removeItem('sps_live_screenplay_text');
      } catch { /* ignore */ }
    }
    window.dispatchEvent(new CustomEvent('sps_screenplay_updated', { detail: { source: 'project_switch' } }));

    localStorage.setItem('sps_extracted_master_story', String(p.extractedMasterStory || ''));
    if (p.writerCustomSynopsis) {
      localStorage.setItem('sps_writer_custom_script_synopsis', p.writerCustomSynopsis);
    }
  } catch {
    /* ignore */
  }
}

export function attachWorkspaceToProject(project) {
  if (!project) return project;
  const open = collectOpenWorkspace();
  const withBible = mergeOpenBibleOntoProject(project, open);
  const storyPackage =
    open.storyPackage && open.storyPackage.projectTitle
      ? open.storyPackage
      : project.storyPackage || open.storyPackage || undefined;
  const assetRegistry =
    open.assetRegistry && open.assetRegistry.projectTitle
      ? open.assetRegistry
      : project.assetRegistry || open.assetRegistry || undefined;
  const productionSpine =
    open.productionSpine && open.productionSpine.projectTitle
      ? open.productionSpine
      : project.productionSpine || open.productionSpine || undefined;
  const projectLifecycle =
    open.projectLifecycle && open.projectLifecycle.projectTitle
      ? open.projectLifecycle
      : project.projectLifecycle || open.projectLifecycle || undefined;
  return {
    ...withBible,
    screenplayText: open.screenplayText || withBible.screenplayText || '',
    extractedMasterStory: open.extractedMasterStory || withBible.extractedMasterStory || '',
    writerCustomSynopsis: open.writerCustomSynopsis || withBible.writerCustomSynopsis || '',
    storyPackage,
    assetRegistry,
    productionSpine,
    projectLifecycle,
    directorPsychology: resolveProjectDirectorPsychology({ ...withBible, directorPsychology: open.directorPsychology || withBible.directorPsychology }),
    dopVision: open.dopVision || withBible.dopVision,
    soundVision: open.soundVision || withBible.soundVision,
    roomId: roomIdForProject(project.title, project.roomId),
    lastModifiedIso: new Date().toISOString()
  };
}

export function writeWorkspaceOntoLibrary(library, title) {
  const list = Array.isArray(library) ? library : [];
  parkBibleVaultsToTitle(title);
  parkStoryPackageForTitle(title);
  parkAssetRegistryForTitle(title);
  parkGenerationJobsForTitle(title);
  parkProductionSpineForTitle(title);
  parkProjectLifecycleForTitle(title);
  parkDirectorPsychologyForTitle(title);
  parkDepartmentVisionsForTitle(title);
  const extras = collectOpenWorkspace();
  const parkedDirector = resolveProjectDirectorPsychology({ title, directorPsychology: extras.directorPsychology });
  return list.map((p) => {
    if (!titlesMatch(p.title, title)) return p;
    const withBible = mergeOpenBibleOntoProject(p, extras);
    return {
      ...withBible,
      screenplayText: extras.screenplayText || withBible.screenplayText || '',
      extractedMasterStory: extras.extractedMasterStory || withBible.extractedMasterStory || '',
      writerCustomSynopsis: extras.writerCustomSynopsis || withBible.writerCustomSynopsis || '',
      storyPackage: extras.storyPackage || withBible.storyPackage,
      assetRegistry: extras.assetRegistry || withBible.assetRegistry,
      productionSpine: extras.productionSpine || withBible.productionSpine,
      projectLifecycle: extras.projectLifecycle || withBible.projectLifecycle,
      directorPsychology: parkedDirector || resolveProjectDirectorPsychology(withBible),
      dopVision: extras.dopVision || withBible.dopVision,
      soundVision: extras.soundVision || withBible.soundVision,
      lastModifiedIso: new Date().toISOString(),
      roomId: roomIdForProject(p.title, p.roomId)
    };
  });
}
