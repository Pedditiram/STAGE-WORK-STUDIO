/**
 * Per-project ComfyUI asset folder roots + render / project save paths.
 * Asset folders feed K Text → Load Image (From Path) for Image_1…Image_9.
 * rendersVideo feeds Save Video (Clean Name) filename_prefix.
 */

import { matchCharactersForShot } from './continuitySpine';
import { getActiveCharacterProfiles } from './projectBibleVault';

export const ASSET_ROOT_KEYS = Object.freeze([
  'subjects',
  'worlds',
  'props',
  'supporting',
  'crowd'
]);

export const ASSET_ROOT_LABELS = Object.freeze({
  subjects: 'Subjects / characters',
  worlds: 'Worlds / environments',
  props: 'Props / action refs',
  supporting: 'Supporting cast',
  crowd: 'Crowd / army'
});

/** Output + project vault paths (same ComfyUI asset folders panel). */
export const PROJECT_PATH_KEYS = Object.freeze([
  'rendersVideo',
  'rendersImage',
  'projectSave',
  'workflows'
]);

export const PROJECT_PATH_LABELS = Object.freeze({
  rendersVideo: 'Video renders (Save Video Clean Name)',
  rendersImage: 'Image renders',
  projectSave: 'Project save location',
  workflows: 'ComfyUI workflows'
});

/** Image_N role label → folder key (matches compileMasterCinemaPrompt SUBJECT_ROLE_LABELS). */
export const IMAGE_SLOT_FOLDER_KEY = Object.freeze({
  1: 'subjects', // Lead Subject
  2: 'subjects', // Co-Artist
  3: 'props', // Action Ref / Prop
  4: 'supporting', // Supporting Ref
  5: 'crowd', // Crowd / Army
  6: 'worlds', // Scene Environment
  7: 'worlds', // Ambience / Haze
  8: 'subjects', // Style ref — prefer subject sheets if present
  9: 'props' // VFX / special
});

export const IMAGE_SLOT_ROLE_LABELS = Object.freeze([
  'Lead Subject',
  'Co-Artist',
  'Action Ref / Prop',
  'Supporting Ref',
  'Crowd / Army',
  'Scene Environment',
  'Ambience / Haze',
  'Style & Color Ref',
  'VFX & Special FX'
]);

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']);

export function emptyAssetRoots() {
  return {
    subjects: '',
    worlds: '',
    props: '',
    supporting: '',
    crowd: '',
    rendersVideo: '',
    rendersImage: '',
    projectSave: '',
    workflows: '',
    versioning: true,
    projectVersion: 1
  };
}

export function normalizeAssetRoots(raw = {}) {
  const out = emptyAssetRoots();
  for (const key of ASSET_ROOT_KEYS) {
    out[key] = String(raw?.[key] || '').trim();
  }
  for (const key of PROJECT_PATH_KEYS) {
    out[key] = String(raw?.[key] || '').trim();
  }
  out.versioning = raw?.versioning !== false && raw?.versioning !== 'false' && raw?.versioning !== 0;
  const ver = Number(raw?.projectVersion);
  out.projectVersion = Number.isFinite(ver) && ver >= 1 ? Math.floor(ver) : 1;
  return out;
}

/** Top-level film folders under …/SWS PROJECTS/{TITLE}/ */
export const FILM_DIR = Object.freeze({
  assets: 'ASSETS',
  renders: 'RENDERS',
  project: 'PROJECT'
});

/** Legacy numbered names (still recognized / migrated). */
export const FILM_DIR_LEGACY = Object.freeze({
  assets: '000-ASSETS',
  renders: '010-RENDERS',
  project: '020-PROJECT'
});

const FILM_DIR_SEGMENT =
  '(?:ASSETS|RENDERS|PROJECT|000-ASSETS|010-RENDERS|020-PROJECT)';

/** Safe single folder segment from project title (e.g. KARA DUSHAN → KARA_DUSHAN). */
export function sanitizeProjectFolderName(projectTitle) {
  return (
    String(projectTitle || 'PROJECT')
      .trim()
      .replace(/[/\\]+/g, '_')
      .replace(/[^a-zA-Z0-9._\- ]+/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'PROJECT'
  );
}

/**
 * Rewrite numbered film folder segments to plain names in a path string.
 * e.g. …/000-ASSETS/Subjects → …/ASSETS/Subjects
 */
export function modernizeFilmPath(pathStr = '') {
  return String(pathStr || '')
    .replace(/\\/g, '/')
    .replace(/\/000-ASSETS(?=\/|$)/gi, `/${FILM_DIR.assets}`)
    .replace(/\/010-RENDERS(?=\/|$)/gi, `/${FILM_DIR.renders}`)
    .replace(/\/020-PROJECT(?=\/|$)/gi, `/${FILM_DIR.project}`);
}

/**
 * Default layout under a studio root.
 * Layout: `{base}/{PROJECT_TITLE}/ASSETS|RENDERS|PROJECT/...`
 * If `base` already ends with the project folder, it is used as the film root (no double nest).
 */
export function defaultAssetRootsUnder(baseDir, projectTitle = '') {
  const studioRoot = String(baseDir || '').trim().replace(/[/\\]+$/, '');
  if (!studioRoot) return emptyAssetRoots();
  const projectFolder = sanitizeProjectFolderName(projectTitle);
  const baseNorm = studioRoot.replace(/\\/g, '/');
  const lastSeg = baseNorm.split('/').filter(Boolean).pop() || '';
  const filmRoot =
    projectFolder && lastSeg.toUpperCase() === projectFolder.toUpperCase()
      ? studioRoot
      : projectFolder
        ? `${studioRoot}/${projectFolder}`
        : studioRoot;
  const join = (...segs) => [filmRoot, ...segs].join('/');
  return normalizeAssetRoots({
    subjects: join(FILM_DIR.assets, 'Subjects'),
    worlds: join(FILM_DIR.assets, 'Worlds'),
    props: join(FILM_DIR.assets, 'Props'),
    supporting: join(FILM_DIR.assets, 'Supporting'),
    crowd: join(FILM_DIR.assets, 'Crowd'),
    rendersVideo: join(FILM_DIR.renders, 'Video'),
    rendersImage: join(FILM_DIR.renders, 'Image'),
    projectSave: join(FILM_DIR.project, 'Versions'),
    workflows: join(FILM_DIR.project, 'Workflows'),
    posters: join(FILM_DIR.project, 'Posters'),
    versioning: true,
    projectVersion: 1
  });
}

/**
 * If paths sit directly under the studio root (…/ASSETS) instead of
 * …/{PROJECT}/ASSETS, rewrite them under the project-name folder.
 * Preserves versioning / projectVersion when present.
 */
export function nestAssetRootsUnderProjectName(rootsInput, projectTitle) {
  const prev = normalizeAssetRoots(rootsInput);
  const folder = sanitizeProjectFolderName(projectTitle);
  if (!folder) return prev;

  const sample =
    prev.subjects ||
    prev.worlds ||
    prev.rendersVideo ||
    prev.projectSave ||
    prev.workflows ||
    '';
  if (!sample) return prev;

  const norm = sample.replace(/\\/g, '/');
  // Already nested: …/KARA_DUSHAN/ASSETS|RENDERS|PROJECT (or legacy numbered)
  if (new RegExp(`/${folder}/${FILM_DIR_SEGMENT}(/|$)`, 'i').test(norm)) {
    const modernized = normalizeAssetRoots({
      subjects: modernizeFilmPath(prev.subjects),
      worlds: modernizeFilmPath(prev.worlds),
      props: modernizeFilmPath(prev.props),
      supporting: modernizeFilmPath(prev.supporting),
      crowd: modernizeFilmPath(prev.crowd),
      rendersVideo: modernizeFilmPath(prev.rendersVideo),
      rendersImage: modernizeFilmPath(prev.rendersImage),
      projectSave: modernizeFilmPath(prev.projectSave),
      workflows: modernizeFilmPath(prev.workflows || resolveWorkflowsDir(prev) || ''),
      versioning: prev.versioning,
      projectVersion: prev.projectVersion
    });
    return modernized;
  }

  const m = norm.match(new RegExp(`^(.*)/${FILM_DIR_SEGMENT}(/|$)`, 'i'));
  if (!m) return prev;
  const studioRoot = m[1];
  const nested = defaultAssetRootsUnder(studioRoot, projectTitle);
  return normalizeAssetRoots({
    ...nested,
    versioning: prev.versioning,
    projectVersion: prev.projectVersion
  });
}

/**
 * Peel studio root from an existing asset path for the Fill prompt default.
 */
export function extractStudioRootFromAssetPath(pathStr, projectTitle = '') {
  const folder = sanitizeProjectFolderName(projectTitle);
  let p = String(pathStr || '')
    .trim()
    .replace(/\\/g, '/');
  if (!p) return '';
  if (folder) {
    p = p.replace(new RegExp(`/${folder}/${FILM_DIR_SEGMENT}/.*$`, 'i'), '');
  }
  p = p.replace(new RegExp(`/${FILM_DIR_SEGMENT}/.*$`, 'i'), '');
  return p.replace(/\/+$/, '');
}

/**
 * Folder for ComfyUI workflow JSON exports.
 * Prefer explicit workflows path; else sibling of projectSave Versions → Workflows.
 */
export function resolveWorkflowsDir(rootsInput = {}) {
  const r = normalizeAssetRoots(rootsInput);
  if (r.workflows) return r.workflows.replace(/[/\\]+$/, '');
  const save = String(r.projectSave || '')
    .trim()
    .replace(/[/\\]+$/, '')
    .replace(/\\/g, '/');
  if (!save) return '';
  if (/\/Versions$/i.test(save)) {
    return save.replace(/\/Versions$/i, '/Workflows');
  }
  const parent = save.replace(/\/[^/]+$/, '');
  return parent ? `${parent}/Workflows` : `${save}/Workflows`;
}

/** Movie poster vault beside Versions / Workflows: …/PROJECT/Posters */
export const FILM_POSTER_DIR = 'Posters';

export function resolvePostersDir(rootsInput = {}) {
  const r = normalizeAssetRoots(rootsInput);
  const save = String(r.projectSave || '')
    .trim()
    .replace(/[/\\]+$/, '')
    .replace(/\\/g, '/');
  if (!save) return '';
  if (/\/Versions$/i.test(save)) {
    return save.replace(/\/Versions$/i, `/${FILM_POSTER_DIR}`);
  }
  const parent = save.replace(/\/[^/]+$/, '');
  return parent ? `${parent}/${FILM_POSTER_DIR}` : `${save}/${FILM_POSTER_DIR}`;
}

export function assetRootsList(roots) {
  const r = normalizeAssetRoots(roots);
  return [...ASSET_ROOT_KEYS, ...PROJECT_PATH_KEYS].map((key) => r[key]).filter(Boolean);
}

/**
 * Save Video (Clean Name) filename_prefix.
 * Prefer absolute video-renders folder + shot stem. ComfyUI only writes there if that
 * path is under its Output Directory (set Output Directory to the film renders parent).
 */
export function buildComfySaveVideoPrefix({
  rendersVideo = '',
  projectId = '',
  sceneId = '',
  shotId = ''
} = {}) {
  const safe = (v) =>
    String(v || 'shot')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'shot';
  const stem = `${safe(projectId)}/${safe(sceneId)}_${safe(shotId)}`;
  const root = String(rendersVideo || '')
    .trim()
    .replace(/[/\\]+$/, '')
    .replace(/\\/g, '/');
  if (root) {
    return `${root}/%date:yyyyMMdd_HHmm%_${stem}`;
  }
  return `%date:MMdd hhmm% SWS/${stem}`;
}

export function nextProjectVersion(roots) {
  const r = normalizeAssetRoots(roots);
  return r.versioning ? r.projectVersion + 1 : r.projectVersion;
}

export function versionedProjectFilename(projectTitle, version) {
  const safe =
    String(projectTitle || 'PROJECT')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'PROJECT';
  const v = Math.max(1, Number(version) || 1);
  return `${safe}_v${String(v).padStart(3, '0')}.json`;
}

export function folderKeyForImageSlot(slot) {
  const n = Number(slot) || 0;
  return IMAGE_SLOT_FOLDER_KEY[n] || 'subjects';
}

export function sanitizeAssetFileStem(name) {
  return String(name || '')
    .replace(/@/g, '')
    .replace(/[^\w.\- +()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

const GENERIC_MATRIX_REF = new Set([
  'scene',
  'environment',
  'env',
  'pov',
  'crowd',
  'image',
  'lead',
  'coartist',
  'supporting',
  'performer',
  'protagonist'
]);

/** Same trimming as compileMasterCinemaPrompt REFERENCES (Infant Karna wearing… → Infant Karna). */
export function extractReferenceSubjectLabel(str) {
  if (!str) return '';
  let cleaned = String(str)
    .replace(/\[|\]|CharID:\s*/gi, '')
    .replace(/@/g, '')
    .trim();
  if (cleaned.includes(';')) cleaned = cleaned.split(';')[0].trim();
  if (cleaned.includes('|')) cleaned = cleaned.split('|')[0].trim();
  cleaned = cleaned.replace(
    /\s+(?:standing|riding|whipping|brandishing|fleeing|surviving|looking|moving|walking|running|fighting|holding|seated|watching|overlooking|defeating|wearing)\b.*$/i,
    ''
  );
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 4) cleaned = words.slice(0, 4).join(' ');
  return sanitizeAssetFileStem(cleaned);
}

export function isGenericImageMatrixRef(name) {
  const norm = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return !norm || GENERIC_MATRIX_REF.has(norm);
}

/**
 * Disk filename from a REFERENCES line subject (e.g. "Infant Karna" → infant karna.png).
 */
export function referenceNameToAssetFilename(name) {
  const label = extractReferenceSubjectLabel(name) || sanitizeAssetFileStem(name);
  if (!label) return '';
  const stem = label
    .replace(/[/\\:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (!stem) return '';
  const lower = stem.toLowerCase();
  return lower.endsWith('.png') ? lower : `${lower}.png`;
}

function extractProminentSubjectsFromShot(shot) {
  const blob = `
    ${shot?.characterIdAssetRef || ''}
    ${shot?.coArtistInteraction || ''}
    ${shot?.actionEnvContext || ''}
    ${shot?.sceneSynopsis || ''}
    ${shot?.characterDialogue || ''}
  `;
  const found = [];
  const seen = new Set();
  const add = (raw) => {
    const label = extractReferenceSubjectLabel(raw) || sanitizeAssetFileStem(raw);
    const key = String(label || '').toLowerCase();
    if (!label || isGenericImageMatrixRef(label) || seen.has(key)) return;
    seen.add(key);
    found.push(label);
  };

  const protagonist = blob.match(/\bProtagonist\s+([A-Za-z][A-Za-z\s]{2,40})/i);
  if (protagonist?.[1]) add(protagonist[1].split(/[—\-|]/)[0]);

  for (const m of blob.matchAll(/\b((?:Lord|Infant|Young|Adult)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g)) {
    add(m[1]);
  }
  for (const m of blob.matchAll(/\b(Surya|Karna|Kara|Dhushan|Rama)\b/g)) {
    add(m[1]);
  }

  return found.slice(0, 4);
}

function enrichImageReferencesFromShot(shot, map) {
  const hay = `
    ${shot?.characterIdAssetRef || ''}
    ${shot?.coArtistInteraction || ''}
    ${shot?.characterIdMatrix || ''}
    ${shot?.actionEnvContext || ''}
    ${shot?.sceneSynopsis || ''}
  `.toLowerCase();

  function usableCharacterName(char) {
    const name = String(char?.name || '').trim();
    if (!name || name.length < 3) return false;
    if (/^(pov|scene|environment|crowd|image|lead|6s|\d+s)$/i.test(name)) return false;
    if (/^@/.test(name)) return false;
    return true;
  }

  function rankedCharacters() {
    const fromMatch = matchCharactersForShot(shot).filter(usableCharacterName);
    if (fromMatch.length) return fromMatch;
    const vault = getActiveCharacterProfiles() || [];
    return vault
      .filter(usableCharacterName)
      .filter((c) => {
        const tag = String(c.tag || '').toLowerCase().replace(/@/g, '').trim();
        const name = String(c.name || '').toLowerCase().trim();
        if (tag && tag.length > 2 && hay.includes(tag)) return true;
        if (name.length > 3 && hay.includes(name)) return true;
        return false;
      })
      .slice(0, 4);
  }

  const chars = rankedCharacters();
  const prominent = extractProminentSubjectsFromShot(shot);
  const slotChar = (i) => prominent[i] || chars[i]?.name || '';

  if (!map.has(1) || isGenericImageMatrixRef(map.get(1)?.name)) {
    const fromRef = extractReferenceSubjectLabel(shot.characterIdAssetRef);
    const name =
      fromRef && !isGenericImageMatrixRef(fromRef) ? fromRef : slotChar(0);
    if (name) {
      map.set(1, { name: sanitizeAssetFileStem(name), roleLabel: IMAGE_SLOT_ROLE_LABELS[0] });
    }
  }
  if (!map.has(2) || isGenericImageMatrixRef(map.get(2)?.name)) {
    const fromCo = extractReferenceSubjectLabel(shot.coArtistInteraction);
    const name =
      fromCo && !isGenericImageMatrixRef(fromCo) ? fromCo : slotChar(1);
    if (name) {
      map.set(2, { name: sanitizeAssetFileStem(name), roleLabel: IMAGE_SLOT_ROLE_LABELS[1] });
    }
  }
  if (!map.has(3) || isGenericImageMatrixRef(map.get(3)?.name)) {
    const name = slotChar(2);
    if (name) {
      map.set(3, { name: sanitizeAssetFileStem(name), roleLabel: IMAGE_SLOT_ROLE_LABELS[2] });
    }
  }
  return map;
}

/**
 * Parse Image_N names from Matrix / prompt reference lines.
 * Returns Map<slotNumber, { name, roleLabel }>
 */
export function parsePromptImageReferences(shot = {}) {
  const map = new Map();
  const matrix = String(shot.characterIdMatrix || '');
  if (matrix.includes('Image_')) {
    matrix.split('|').forEach((part) => {
      const m = String(part).trim().match(/Image_(\d+)\s*=\s*(.+)/i);
      if (!m) return;
      const slot = Number(m[1]);
      const name = sanitizeAssetFileStem(m[2]);
      if (slot >= 1 && slot <= 9 && name) {
        map.set(slot, { name, roleLabel: IMAGE_SLOT_ROLE_LABELS[slot - 1] || '' });
      }
    });
  }
  const imagesField = String(shot.shotDurationAndImages || '');
  for (const match of imagesField.matchAll(/Image_(\d+):\s*(@[A-Za-z0-9_]+|[^\|;]+)/g)) {
    const slot = Number(match[1]);
    const name = sanitizeAssetFileStem(match[2]);
    if (slot >= 1 && slot <= 9 && name && !map.has(slot)) {
      map.set(slot, { name, roleLabel: IMAGE_SLOT_ROLE_LABELS[slot - 1] || '' });
    }
  }
  // Fallbacks for lead / co / env when matrix empty
  if (!map.has(1) && shot.characterIdAssetRef) {
    map.set(1, {
      name: sanitizeAssetFileStem(shot.characterIdAssetRef),
      roleLabel: IMAGE_SLOT_ROLE_LABELS[0]
    });
  }
  if (!map.has(2) && shot.coArtistInteraction) {
    map.set(2, {
      name: sanitizeAssetFileStem(String(shot.coArtistInteraction).split(/[;—|]/)[0]),
      roleLabel: IMAGE_SLOT_ROLE_LABELS[1]
    });
  }
  if (!map.has(6) && shot.actionEnvContext) {
    const envHint = sanitizeAssetFileStem(String(shot.actionEnvContext).split(/[.—|]/)[0]);
    if (envHint) {
      map.set(6, { name: envHint, roleLabel: IMAGE_SLOT_ROLE_LABELS[5] });
    }
  }
  return enrichImageReferencesFromShot(shot, map);
}

/**
 * Prefer worlds folder when the hint looks like an environment plate.
 */
export function resolveFolderKeyForSlot(slot, hintName = '') {
  const base = folderKeyForImageSlot(slot);
  const hay = String(hintName || '').toLowerCase();
  if (
    hay &&
    /(env|world|location|scene|arena|set|plate|landscape|interior|exterior)/i.test(hay) &&
    (slot === 2 || slot === 1)
  ) {
    return 'worlds';
  }
  return base;
}

export function isImageFilename(name) {
  const lower = String(name || '').toLowerCase();
  const i = lower.lastIndexOf('.');
  if (i < 0) return false;
  return IMAGE_EXTS.has(lower.slice(i));
}

/**
 * Pick best matching image filename from a directory listing (names only).
 * Pure — used by Vite/Electron and tests.
 */
export function pickAssetFilename(fileNames = [], hints = []) {
  const images = (fileNames || []).filter((f) => isImageFilename(f));
  if (!images.length) return '';
  const norms = hints
    .map((h) =>
      String(h || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
    )
    .filter(Boolean);
  if (!norms.length) return images[0];

  let best = '';
  let bestScore = -1;
  for (const file of images) {
    const stem = file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    let score = 0;
    for (const n of norms) {
      if (stem === n) score = Math.max(score, 100);
      else if (stem.includes(n) || n.includes(stem)) score = Math.max(score, 60 + Math.min(n.length, stem.length));
    }
    if (score > bestScore) {
      bestScore = score;
      best = file;
    }
  }
  return bestScore > 0 ? best : '';
}

function libraryKey() {
  return 'sps_project_library';
}

export function readAssetRootsFromLibrary(projectTitle) {
  if (typeof window === 'undefined') return emptyAssetRoots();
  const want = String(projectTitle || '').trim().toUpperCase();
  if (!want) return emptyAssetRoots();
  try {
    const raw = localStorage.getItem(libraryKey());
    const list = raw ? JSON.parse(raw) : [];
    const hit = (Array.isArray(list) ? list : []).find(
      (p) => String(p?.title || '').trim().toUpperCase() === want
    );
    return normalizeAssetRoots(hit?.assetRoots);
  } catch {
    return emptyAssetRoots();
  }
}

export function stampAssetRootsIntoLibrary(projectTitle, roots) {
  if (typeof window === 'undefined') return;
  const want = String(projectTitle || '').trim().toUpperCase();
  if (!want) return;
  const nextRoots = normalizeAssetRoots(roots);
  try {
    const raw = localStorage.getItem(libraryKey());
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    const updated = list.map((p) =>
      String(p?.title || '').trim().toUpperCase() === want ? { ...p, assetRoots: nextRoots } : p
    );
    localStorage.setItem(libraryKey(), JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

/**
 * Build resolve requests for Image_1…9 from Matrix refs + assetRoots.
 */
export function buildComfyAssetResolveRequests(shot = {}, assetRoots = {}) {
  const roots = normalizeAssetRoots(assetRoots);
  const refs = parsePromptImageReferences(shot);
  const requests = [];
  for (let slot = 1; slot <= 9; slot += 1) {
    const ref = refs.get(slot);
    if (!ref?.name) continue;
    const folderKey = resolveFolderKeyForSlot(slot, ref.name);
    const folder = String(roots[folderKey] || '').trim();
    if (!folder) continue;
    requests.push({
      slot,
      folderKey,
      folder,
      hints: [
        ref.name,
        referenceNameToAssetFilename(ref.name).replace(/\.png$/i, ''),
        ref.roleLabel,
        IMAGE_SLOT_ROLE_LABELS[slot - 1]
      ].filter(Boolean),
      role: IMAGE_SLOT_ROLE_LABELS[slot - 1] || folderKey,
      assetId: ref.name,
      expectedFilename: referenceNameToAssetFilename(ref.name)
    });
  }
  return requests;
}

/**
 * Expected placeholder files for one shot (REFERENCES subject names, not Image_N).
 */
export function listExpectedShotAssetFiles(shot = {}) {
  const refs = parsePromptImageReferences(shot);
  const files = [];
  for (let slot = 1; slot <= 9; slot += 1) {
    const ref = refs.get(slot);
    if (!ref?.name) continue;
    const filename = referenceNameToAssetFilename(ref.name);
    if (!filename) continue;
    const folderKey = resolveFolderKeyForSlot(slot, ref.name);
    files.push({
      slot,
      folderKey,
      filename,
      label: ref.name,
      roleLabel: ref.roleLabel || IMAGE_SLOT_ROLE_LABELS[slot - 1] || ''
    });
  }
  return files;
}

/**
 * Unique expected asset files across all Matrix shots.
 */
export function listExpectedFilmAssetFiles(shots = []) {
  const seen = new Set();
  const out = [];
  for (const shot of shots || []) {
    for (const f of listExpectedShotAssetFiles(shot)) {
      const key = `${f.folderKey}::${f.filename}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}
