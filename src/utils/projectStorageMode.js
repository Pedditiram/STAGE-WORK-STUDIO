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

export function titleShelfConflictMessage(title, conflict, intendedShelf) {
  const name = String(conflict?.title || title || '').trim() || 'That title';
  const taken = conflict?.shelf === STORAGE_CLOUD ? 'Cloud' : 'Local';
  const want = normalizeStorageMode(intendedShelf) === STORAGE_CLOUD ? 'Cloud' : 'Local';
  if (taken === want) {
    return `TITLE CONFLICT\n\n"${name}" already exists on the ${taken} shelf.\nChoose a different name.`;
  }
  return `TITLE CONFLICT\n\n"${name}" already exists on the ${taken} shelf.\nYou cannot create the same name on ${want}.\n\nUse a different name, or move the existing film instead.`;
}
