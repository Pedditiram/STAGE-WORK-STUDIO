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
