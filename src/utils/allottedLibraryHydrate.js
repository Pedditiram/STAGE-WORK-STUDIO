/**
 * Allotted titles must reach collaborators without owner-only Sync shelves.
 *
 * Strict:
 * - Allotted titles are Cloud-shelf in the shared catalog + film body on cloud.
 * - Collaborator hydrate pulls catalog card and/or film KV even if catalog was empty.
 * - Never overwrite a local Matrix that already has shots.
 */
import {
  getCurrentUserEmail,
  getCurrentUserProfile,
  isStudioOwner,
  projectTitlesMatch
} from './projectPermissions';
import {
  peekRemoteLibraryCatalog,
  fetchFilmFromCloud,
  publishOneLibraryTitle
} from '../services/dbService';
import {
  readLocalProjectLibrary,
  writeLocalProjectLibrary,
  slimProjectForLocalMirror
} from './projectWorkspace';
import { STORAGE_CLOUD, withStorageMode, normalizeStorageMode } from './projectStorageMode';

function allottedTitleList(email) {
  const profile = getCurrentUserProfile(email);
  const raw = Array.isArray(profile?.allottedProjects) ? profile.allottedProjects : [];
  return raw
    .map((t) => String(t || '').trim())
    .filter((t) => t && !t.toLowerCase().startsWith('all studio projects'));
}

function slimCloudCard(title, source = {}) {
  const base = slimProjectForLocalMirror({
    ...source,
    title: String(source?.title || title || '').trim() || title,
    storageMode: STORAGE_CLOUD,
    shots: Array.isArray(source?.shots) ? source.shots : []
  });
  return withStorageMode(base, STORAGE_CLOUD);
}

/**
 * Owner/admin: when allotting, promote title to Cloud shelf, publish catalog card,
 * and push film body so every allotted device can hydrate.
 */
export async function ensureTitlePublishedForAllotment(title) {
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr' };
  const clean = String(title || '').trim();
  if (!clean || clean.toLowerCase().startsWith('all studio projects')) {
    return { ok: false, reason: 'invalid' };
  }

  let card = null;
  const local = readLocalProjectLibrary();
  card = (Array.isArray(local) ? local : []).find((p) => projectTitlesMatch(p?.title, clean)) || null;

  try {
    const { loadProjectFromDiskByTitle } = await import('../services/projectDiskVault');
    const disk = await loadProjectFromDiskByTitle(clean);
    if (disk && typeof disk === 'object') {
      card = card ? { ...card, ...disk, title: clean } : { ...disk, title: clean };
    }
  } catch {
    /* keep library card */
  }

  if (!card) {
    try {
      const film = await fetchFilmFromCloud(clean);
      if (film && typeof film === 'object') card = { ...film, title: clean };
    } catch {
      /* none */
    }
  }

  if (!card) return { ok: false, reason: 'missing_title' };

  const cloudCard = withStorageMode(
    {
      ...card,
      title: clean,
      shots: Array.isArray(card.shots) ? card.shots : []
    },
    STORAGE_CLOUD
  );

  // Persist Cloud shelf on this device (allotted films are never Local-only).
  try {
    const next = (Array.isArray(local) ? local : []).map((p) =>
      projectTitlesMatch(p?.title, clean) ? { ...p, ...cloudCard, storageMode: STORAGE_CLOUD } : p
    );
    if (!next.some((p) => projectTitlesMatch(p?.title, clean))) next.unshift(cloudCard);
    writeLocalProjectLibrary(next);
    try {
      const { saveProjectToVault } = await import('../services/projectDiskVault');
      await saveProjectToVault(cloudCard);
    } catch {
      /* vault optional */
    }
    window.dispatchEvent(
      new CustomEvent('sps_projects_updated', { detail: { source: 'allot_publish', title: clean } })
    );
  } catch {
    /* continue publish */
  }

  const published = await publishOneLibraryTitle(cloudCard);
  return { ok: Boolean(published), title: clean, published };
}

/**
 * Collaborator: ensure each allotted title exists as a Cloud card and hydrate Matrix
 * from film KV when local has no shots. Works even if shared catalog peek is empty.
 */
export async function ensureAllottedTitlesOnThisDevice() {
  if (typeof window === 'undefined') return { pulled: 0, hydrated: 0 };
  const email = getCurrentUserEmail();
  if (!email || isStudioOwner(email)) return { pulled: 0, hydrated: 0 };

  const titles = allottedTitleList(email);
  if (!titles.length) return { pulled: 0, hydrated: 0 };

  let remote = [];
  try {
    remote = await peekRemoteLibraryCatalog();
  } catch {
    remote = [];
  }
  if (!Array.isArray(remote)) remote = [];

  const local = readLocalProjectLibrary();
  const next = Array.isArray(local) ? [...local] : [];
  let pulled = 0;
  let hydrated = 0;

  for (const title of titles) {
    let remoteCard = remote.find((p) => projectTitlesMatch(p?.title, title)) || null;
    let film = null;
    try {
      film = await fetchFilmFromCloud(title);
    } catch {
      film = null;
    }

    // Catalog empty or missing this title — still accept a durable film body.
    if (!remoteCard && film && typeof film === 'object') {
      remoteCard = slimCloudCard(title, film);
    }
    if (!remoteCard && !film) continue;

    const localIdx = next.findIndex((p) => projectTitlesMatch(p?.title, title));
    if (localIdx < 0) {
      const seed = slimCloudCard(title, {
        ...(remoteCard || {}),
        ...(film && Array.isArray(film.shots) && film.shots.length ? film : {})
      });
      next.push(seed);
      pulled += 1;
    } else if (normalizeStorageMode(next[localIdx].storageMode) !== STORAGE_CLOUD) {
      // Allotted titles must sit on Cloud shelf for collab text sync.
      next[localIdx] = withStorageMode(next[localIdx], STORAGE_CLOUD);
    }

    const idx = next.findIndex((p) => projectTitlesMatch(p?.title, title));
    if (idx < 0) continue;
    const localShots = next[idx].shots;
    const hasShots = Array.isArray(localShots) && localShots.length > 0;
    if (hasShots) continue;

    const body = film && Array.isArray(film.shots) && film.shots.length ? film : null;
    if (!body) continue;
    try {
      const { shouldRejectIncomingMatrix } = await import('./matrixSyncGuard');
      if (shouldRejectIncomingMatrix(localShots || [], body.shots)) continue;
      next[idx] = withStorageMode(
        {
          ...next[idx],
          ...body,
          title: next[idx].title || body.title || title,
          shots: body.shots
        },
        STORAGE_CLOUD
      );
      hydrated += 1;
    } catch {
      /* ignore */
    }
  }

  if (pulled || hydrated) {
    writeLocalProjectLibrary(next);
    try {
      window.dispatchEvent(new CustomEvent('sps_projects_updated', { detail: { source: 'allotted_hydrate' } }));
    } catch {
      /* ignore */
    }
  }
  return { pulled, hydrated };
}
