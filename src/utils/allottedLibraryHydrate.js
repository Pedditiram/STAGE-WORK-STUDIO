/**
 * Pull allotted cloud titles onto this device so collaborators see films
 * without needing owner-only Sync shelves.
 */
import {
  getCurrentUserEmail,
  getCurrentUserProfile,
  isStudioOwner,
  titlesMatch
} from './projectPermissions';
import { peekRemoteLibraryCatalog, fetchFilmFromCloud } from '../services/dbService';
import { readLocalProjectLibrary, writeLocalProjectLibrary } from './projectWorkspace';
import { STORAGE_CLOUD, withStorageMode } from './projectStorageMode';

function allottedTitleList(email) {
  const profile = getCurrentUserProfile(email);
  const raw = Array.isArray(profile?.allottedProjects) ? profile.allottedProjects : [];
  return raw
    .map((t) => String(t || '').trim())
    .filter((t) => t && !t.toLowerCase().startsWith('all studio projects'));
}

/**
 * Ensure each allotted title exists as a library card on this device (Cloud shelf)
 * and hydrate Matrix text from cloud when the local card has no shots.
 * Does not rewrite Local/Cloud membership for titles already on this device.
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
  if (!Array.isArray(remote) || !remote.length) return { pulled: 0, hydrated: 0 };

  const local = readLocalProjectLibrary();
  const next = Array.isArray(local) ? [...local] : [];
  let pulled = 0;
  let hydrated = 0;

  for (const title of titles) {
    const remoteCard = remote.find((p) => titlesMatch(p?.title, title));
    if (!remoteCard) continue;

    const localIdx = next.findIndex((p) => titlesMatch(p?.title, title));
    if (localIdx < 0) {
      next.push(
        withStorageMode(
          {
            ...remoteCard,
            shots: Array.isArray(remoteCard.shots) ? remoteCard.shots : []
          },
          STORAGE_CLOUD
        )
      );
      pulled += 1;
    }

    const idx = next.findIndex((p) => titlesMatch(p?.title, title));
    if (idx < 0) continue;
    const hasShots = Array.isArray(next[idx].shots) && next[idx].shots.length > 0;
    if (hasShots) continue;
    try {
      const film = await fetchFilmFromCloud(title);
      if (film && Array.isArray(film.shots) && film.shots.length) {
        next[idx] = withStorageMode(
          {
            ...next[idx],
            ...film,
            title: next[idx].title || film.title || title,
            shots: film.shots
          },
          next[idx].storageMode || STORAGE_CLOUD
        );
        hydrated += 1;
      }
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
