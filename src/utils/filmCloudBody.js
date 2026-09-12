/**
 * Per-film cloud body — text craft only.
 * Library cards + Writer / Matrix / World / Bible / Compile sync.
 * Generated images, videos, look-sheet binaries, and data-URLs stay on the machine.
 */
import { roomIdForProject, slugProjectTitle } from './projectWorkspace';
import { normalizeStorageMode } from './projectStorageMode';
import { stampFilmClock, filmRevisionOf } from './filmClock';

const FILM_BYTE_BUDGET = 900000;

const DROP_KEYS = new Set([
  'projectgeneratedimages',
  'generatedimages',
  'generatedlooks',
  'canvasimages',
  'posterdataurl',
  'imagedataurl',
  'videodataurl',
  'thumbnaildataurl',
  'lookdataurl',
  'previewdataurl'
]);

export function filmCloudSlug(title) {
  return slugProjectTitle(title);
}

function isHeavyString(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!s) return false;
  if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('idb:')) return true;
  return false;
}

function dropKey(key) {
  return DROP_KEYS.has(String(key || '').toLowerCase());
}

export function stripHeavyMedia(value) {
  if (value == null) return value;
  if (typeof value === 'string') return isHeavyString(value) ? '' : value;
  if (Array.isArray(value)) return value.map((item) => stripHeavyMedia(item));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (dropKey(key)) continue;
    if (isHeavyString(child)) continue;
    out[key] = stripHeavyMedia(child);
  }
  return out;
}

export function compactFilmForCloud(project, { bumpClock = true } = {}) {
  if (!project || typeof project !== 'object') return null;
  const title = String(project.title || '').trim();
  if (!title) return null;
  const shots = Array.isArray(project.shots) ? project.shots : [];
  const posterUrl = String(project.posterUrl || '').trim();
  const slimPoster =
    posterUrl && !isHeavyString(posterUrl) && posterUrl.length < 2048 ? posterUrl : undefined;
  const body = stripHeavyMedia({
    id: project.id || `proj_${filmCloudSlug(title)}`,
    title,
    description: String(project.description || '').slice(0, 240),
    targetModel: project.targetModel,
    aspectRatio: project.aspectRatio,
    roomId: roomIdForProject(title, project.roomId),
    lastModified: project.lastModified,
    lastModifiedIso: project.lastModifiedIso || project.updatedAt || new Date().toISOString(),
    updatedAt: project.updatedAt || project.lastModifiedIso || new Date().toISOString(),
    filmRevision: filmRevisionOf(project),
    shotCount: shots.length,
    storageMode: normalizeStorageMode(project.storageMode),
    shots,
    screenplayText: project.screenplayText || '',
    extractedMasterStory: project.extractedMasterStory || '',
    writerCustomSynopsis: project.writerCustomSynopsis || '',
    characterProfiles: Array.isArray(project.characterProfiles) ? project.characterProfiles : [],
    worldAssets: Array.isArray(project.worldAssets) ? project.worldAssets : [],
    productionSpine: project.productionSpine || undefined,
    storyPackage: project.storyPackage || undefined,
    projectLifecycle: project.projectLifecycle || undefined,
    directorPsychology: project.directorPsychology || undefined,
    dopVision: project.dopVision || undefined,
    soundVision: project.soundVision || undefined,
    assetRegistry: project.assetRegistry || undefined,
    ...(slimPoster ? { posterUrl: slimPoster } : {})
  });
  const stamped = bumpClock ? stampFilmClock(body, { bump: true }) : body;
  let text = JSON.stringify(stamped);
  if (text.length > FILM_BYTE_BUDGET && stamped.storyPackage) {
    delete stamped.storyPackage;
    text = JSON.stringify(stamped);
  }
  if (text.length > FILM_BYTE_BUDGET) {
    delete stamped.productionSpine;
    delete stamped.projectLifecycle;
    delete stamped.assetRegistry;
  }
  return stamped;
}

export function filmHasMatrix(project) {
  return Boolean(project && Array.isArray(project.shots) && project.shots.length > 0);
}
