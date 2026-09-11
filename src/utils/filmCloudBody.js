/**
 * Compact per-film cloud body — one title per KV key.
 * Library index stays metadata-only; this is how web opens the same Matrix as Electron.
 */
import { roomIdForProject, slugProjectTitle } from './projectWorkspace';

const FILM_BYTE_BUDGET = 900000;

export function filmCloudSlug(title) {
  return slugProjectTitle(title);
}

export function compactFilmForCloud(project) {
  if (!project || typeof project !== 'object') return null;
  const title = String(project.title || '').trim();
  if (!title) return null;
  const shots = Array.isArray(project.shots) ? project.shots : [];
  const body = {
    id: project.id || `proj_${filmCloudSlug(title)}`,
    title,
    description: String(project.description || '').slice(0, 240),
    targetModel: project.targetModel,
    aspectRatio: project.aspectRatio,
    roomId: roomIdForProject(title, project.roomId),
    lastModified: project.lastModified,
    lastModifiedIso: project.lastModifiedIso || project.updatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shotCount: shots.length,
    shots,
    screenplayText: project.screenplayText || '',
    extractedMasterStory: project.extractedMasterStory || '',
    writerCustomSynopsis: project.writerCustomSynopsis || '',
    characterProfiles: Array.isArray(project.characterProfiles) ? project.characterProfiles : [],
    worldAssets: Array.isArray(project.worldAssets) ? project.worldAssets : [],
    productionSpine: project.productionSpine || undefined,
    storyPackage: project.storyPackage || undefined,
    projectLifecycle: project.projectLifecycle || undefined
  };
  let text = JSON.stringify(body);
  if (text.length > FILM_BYTE_BUDGET && body.storyPackage) {
    delete body.storyPackage;
    text = JSON.stringify(body);
  }
  if (text.length > FILM_BYTE_BUDGET) {
    delete body.productionSpine;
    delete body.projectLifecycle;
  }
  return body;
}

export function filmHasMatrix(project) {
  return Boolean(project && Array.isArray(project.shots) && project.shots.length > 0);
}
