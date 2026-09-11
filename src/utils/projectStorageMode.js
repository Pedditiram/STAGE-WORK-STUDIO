/** Exclusive library membership: a title is Local or Cloud, never both. */

export const STORAGE_LOCAL = 'local';
export const STORAGE_CLOUD = 'cloud';

export function normalizeStorageMode(mode) {
  return String(mode || '').trim().toLowerCase() === STORAGE_CLOUD ? STORAGE_CLOUD : STORAGE_LOCAL;
}

export function isCloudProject(project) {
  return normalizeStorageMode(project?.storageMode) === STORAGE_CLOUD;
}

export function isLocalProject(project) {
  return !isCloudProject(project);
}

export function withStorageMode(project, mode) {
  if (!project || typeof project !== 'object') return project;
  return { ...project, storageMode: normalizeStorageMode(mode) };
}

export function filterLibraryByShelf(library, shelf) {
  const want = normalizeStorageMode(shelf);
  return (Array.isArray(library) ? library : []).filter(
    (p) => normalizeStorageMode(p?.storageMode) === want
  );
}

export function cloudProjectsFromLibrary(library) {
  return filterLibraryByShelf(library, STORAGE_CLOUD);
}

export function localProjectsFromLibrary(library) {
  return filterLibraryByShelf(library, STORAGE_LOCAL);
}

export function localTitlesFromLibrary(library) {
  return localProjectsFromLibrary(library)
    .map((p) => String(p?.title || '').trim())
    .filter(Boolean);
}

export function findTitleOnShelves(title, libraries = []) {
  const want = String(title || '').trim().toUpperCase();
  if (!want) return null;
  for (const list of libraries) {
    const hit = (Array.isArray(list) ? list : []).find(
      (p) => String(p?.title || '').trim().toUpperCase() === want
    );
    if (hit) {
      return {
        title: String(hit.title || title).trim(),
        shelf: normalizeStorageMode(hit.storageMode)
      };
    }
  }
  return null;
}

export function titlesOnShelf(library, shelf) {
  return filterLibraryByShelf(library, shelf)
    .map((p) => String(p?.title || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function compareLibraryShelves(deviceLibrary, sharedLibrary) {
  const deviceLocal = titlesOnShelf(deviceLibrary, STORAGE_LOCAL);
  const deviceCloud = titlesOnShelf(deviceLibrary, STORAGE_CLOUD);
  const sharedLocal = titlesOnShelf(sharedLibrary, STORAGE_LOCAL);
  const sharedCloud = titlesOnShelf(sharedLibrary, STORAGE_CLOUD);
  const deviceSet = new Set([...deviceLocal, ...deviceCloud].map((t) => t.toUpperCase()));
  const sharedSet = new Set([...sharedLocal, ...sharedCloud].map((t) => t.toUpperCase()));
  const shelfOf = (listLocal, listCloud, title) => {
    const key = title.toUpperCase();
    if (listLocal.some((t) => t.toUpperCase() === key)) return 'Local';
    if (listCloud.some((t) => t.toUpperCase() === key)) return 'Cloud';
    return '';
  };
  const titleForKey = (key) =>
    [...deviceLocal, ...deviceCloud, ...sharedLocal, ...sharedCloud].find((t) => t.toUpperCase() === key) || key;
  const onlyHere = [...deviceSet].filter((k) => !sharedSet.has(k)).map(titleForKey);
  const onlyShared = [...sharedSet].filter((k) => !deviceSet.has(k)).map(titleForKey);
  const mismatches = [...deviceSet]
    .filter((k) => sharedSet.has(k))
    .map(titleForKey)
    .filter((title) => shelfOf(deviceLocal, deviceCloud, title) !== shelfOf(sharedLocal, sharedCloud, title))
    .map((title) => {
      const here = shelfOf(deviceLocal, deviceCloud, title);
      const shared = shelfOf(sharedLocal, sharedCloud, title);
      return `${title} (${here} here / ${shared} shared)`;
    });
  return {
    deviceLocal,
    deviceCloud,
    sharedLocal,
    sharedCloud,
    onlyHere,
    onlyShared,
    mismatches,
    inSync: onlyHere.length === 0 && onlyShared.length === 0 && mismatches.length === 0
  };
}

export function titleShelfConflictMessage(title, conflict, intendedShelf) {
  const name = String(conflict?.title || title || '').trim() || 'That title';
  const taken = conflict?.shelf === STORAGE_CLOUD ? 'Cloud' : 'Local';
  const want = normalizeStorageMode(intendedShelf) === STORAGE_CLOUD ? 'Cloud' : 'Local';
  if (taken === want) {
    return `TITLE CONFLICT\n\n"${name}" already exists on the ${taken} shelf.\nChoose a different name.`;
  }
  return `TITLE CONFLICT\n\n"${name}" already exists on the ${taken} shelf.\nYou cannot create the same name on ${want}.\n\nUse a different name, or move the existing film instead.`;
}
