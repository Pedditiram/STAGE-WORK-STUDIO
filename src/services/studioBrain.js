/**
 * Studio Brain — learns your pipeline from live projects.
 * Stores craft presets, characters, genres, and breakdown habits locally
 * (localStorage + IndexedDB) so offline / credit-exhausted modes stay useful.
 */

const LS_KEY = 'sps_studio_brain_v1';
const IDB_NAME = 'sps_studio_brain_db';
const IDB_STORE = 'brain';
const IDB_KEY = 'main';
const MAX_PHRASES_PER_CRAFT = 48;
const MAX_CHARS = 80;
const MAX_EVENTS = 120;

const CRAFT_KEYS = [
  'shotComposition',
  'cameraMotionTag',
  'subjectLightingTag',
  'subjectColorTag',
  'backgroundLightingTag',
  'backgroundColorTag',
  'atmosphereVolumetricsTag',
  'characterExpression',
  'characterPlacement',
  'characterMovement',
  'characterEyeLooks',
  'soundFxAndFoley',
  'backgroundScoreMood',
  'lensAndFocalLength',
  'actionEnvContext'
];

function emptyBrain() {
  return {
    version: 1,
    updatedAt: null,
    projectCount: 0,
    shotCount: 0,
    learnEvents: 0,
    genres: {}, // genreKey -> { count, lastSeen }
    craftBanks: {}, // craftKey -> [{ text, count, lastSeen }]
    characters: {}, // nameUpper -> { name, count, lastSeen, projects: [] }
    dialogueSamples: [], // recent Telugu/English lines
    recentProjects: [], // { title, shots, at }
    notes: 'Studio Brain learns craft presets from your projects for offline pipeline continuity.'
  };
}

function normalizePhrase(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  if (t.length < 8 || t.length > 320) return '';
  // Skip placeholders
  if (/^\[?(Atmospheric|CharID: @Lead|Standard|N\/A)/i.test(t)) return '';
  return t;
}

function upsertCounted(list, text, limit) {
  const clean = normalizePhrase(text);
  if (!clean) return list || [];
  const arr = Array.isArray(list) ? [...list] : [];
  const key = clean.toLowerCase();
  const idx = arr.findIndex((x) => String(x.text || '').toLowerCase() === key);
  const now = new Date().toISOString();
  if (idx >= 0) {
    arr[idx] = {
      ...arr[idx],
      text: clean,
      count: (arr[idx].count || 1) + 1,
      lastSeen: now
    };
  } else {
    arr.unshift({ text: clean, count: 1, lastSeen: now });
  }
  arr.sort((a, b) => (b.count || 0) - (a.count || 0) || String(b.lastSeen).localeCompare(String(a.lastSeen)));
  return arr.slice(0, limit);
}

function readLocal() {
  if (typeof window === 'undefined') return emptyBrain();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return emptyBrain();
    const parsed = JSON.parse(raw);
    return { ...emptyBrain(), ...parsed, craftBanks: parsed.craftBanks || {}, characters: parsed.characters || {}, genres: parsed.genres || {} };
  } catch {
    return emptyBrain();
  }
}

function writeLocal(brain) {
  if (typeof window === 'undefined') return brain;
  const next = { ...brain, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('Studio Brain localStorage write failed', e);
  }
  try {
    window.dispatchEvent(new CustomEvent('sps_studio_brain_updated', { detail: next }));
  } catch {
    /* ignore */
  }
  persistIndexedDB(next);
  return next;
}

let idbPromise = null;
function openBrainDb() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onerror = () => resolve(null);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
    } catch {
      resolve(null);
    }
  });
  return idbPromise;
}

async function persistIndexedDB(brain) {
  try {
    const db = await openBrainDb();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(brain, IDB_KEY);
  } catch (e) {
    console.warn('Studio Brain IndexedDB write failed', e);
  }
}

export async function hydrateStudioBrainFromDisk() {
  try {
    const db = await openBrainDb();
    if (!db) return getStudioBrain();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    const fromIdb = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (fromIdb && typeof fromIdb === 'object') {
      const local = readLocal();
      const idbTime = Date.parse(fromIdb.updatedAt || 0) || 0;
      const localTime = Date.parse(local.updatedAt || 0) || 0;
      if (idbTime >= localTime) return writeLocal({ ...emptyBrain(), ...fromIdb });
    }
  } catch {
    /* ignore */
  }
  return getStudioBrain();
}

export function getStudioBrain() {
  return readLocal();
}

export function getStudioBrainStats() {
  const b = readLocal();
  const craftPhraseCount = Object.values(b.craftBanks || {}).reduce(
    (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
    0
  );
  return {
    updatedAt: b.updatedAt,
    projectCount: b.projectCount || 0,
    shotCount: b.shotCount || 0,
    learnEvents: b.learnEvents || 0,
    genreCount: Object.keys(b.genres || {}).length,
    characterCount: Object.keys(b.characters || {}).length,
    craftPhraseCount,
    readyForOffline: craftPhraseCount >= 12 || (b.shotCount || 0) >= 8
  };
}

/**
 * Learn from a project's shot matrix — call after saves / AI breakdown / sync.
 */
export function learnFromProject({
  projectTitle,
  shots = [],
  genreKey = '',
  aspectRatio = '',
  targetModel = ''
} = {}) {
  if (!Array.isArray(shots) || shots.length === 0) return getStudioBrain();

  const brain = readLocal();
  const title = String(projectTitle || 'Untitled').trim() || 'Untitled';
  const genre = String(genreKey || localStorage.getItem('sps_preset_profile') || 'general').trim();
  const now = new Date().toISOString();

  brain.learnEvents = (brain.learnEvents || 0) + 1;
  brain.shotCount = (brain.shotCount || 0) + shots.length;

  brain.genres[genre] = {
    key: genre,
    count: (brain.genres[genre]?.count || 0) + 1,
    lastSeen: now,
    aspectRatio: aspectRatio || brain.genres[genre]?.aspectRatio || '',
    targetModel: targetModel || brain.genres[genre]?.targetModel || ''
  };

  if (!brain.craftBanks) brain.craftBanks = {};
  CRAFT_KEYS.forEach((key) => {
    shots.forEach((shot) => {
      const val = shot?.[key];
      if (!val) return;
      brain.craftBanks[key] = upsertCounted(brain.craftBanks[key], val, MAX_PHRASES_PER_CRAFT);
    });
  });

  shots.forEach((shot) => {
    const ref = String(shot?.characterIdAssetRef || '');
    const matrix = String(shot?.characterIdMatrix || '');
    const names = new Set();
    const fromRef = ref.match(/@([A-Za-z][A-Za-z0-9_]{1,40})/g) || [];
    fromRef.forEach((m) => names.add(m.replace('@', '').replace(/_/g, ' ')));
    const fromMatrix = matrix.match(/Image_\d+\s*=\s*([^|]+)/gi) || [];
    fromMatrix.forEach((m) => {
      const part = m.split('=')[1];
      if (part) names.add(part.trim());
    });
    names.forEach((name) => {
      const clean = String(name || '').trim();
      if (!clean || clean.length < 2 || /^(crowd|scene|environment|lead)$/i.test(clean)) return;
      const key = clean.toUpperCase();
      const prev = brain.characters[key] || { name: clean, count: 0, projects: [] };
      const projects = Array.isArray(prev.projects) ? prev.projects : [];
      if (!projects.includes(title) && projects.length < 12) projects.push(title);
      brain.characters[key] = {
        name: clean,
        count: (prev.count || 0) + 1,
        lastSeen: now,
        projects
      };
    });

    const dlg = normalizePhrase(shot?.characterDialogue);
    if (dlg && !/^\[Atmospheric/i.test(dlg)) {
      brain.dialogueSamples = [dlg, ...(brain.dialogueSamples || []).filter((d) => d !== dlg)].slice(0, 40);
    }
  });

  // Cap character map
  const charEntries = Object.entries(brain.characters || {}).sort((a, b) => (b[1].count || 0) - (a[1].count || 0));
  brain.characters = Object.fromEntries(charEntries.slice(0, MAX_CHARS));

  brain.recentProjects = [
    { title, shots: shots.length, genre, at: now },
    ...(brain.recentProjects || []).filter((p) => p.title !== title)
  ].slice(0, 20);

  const seenTitles = new Set((brain.recentProjects || []).map((p) => p.title));
  brain.projectCount = Math.max(brain.projectCount || 0, seenTitles.size);

  brain.events = [
    { type: 'learn', title, shots: shots.length, genre, at: now },
    ...(Array.isArray(brain.events) ? brain.events : [])
  ].slice(0, MAX_EVENTS);

  return writeLocal(brain);
}

/** Top phrases for a craft — for offline breakdown / preset boost. */
export function getBrainCraftPresets(craftKey, limit = 12) {
  const bank = getStudioBrain().craftBanks?.[craftKey] || [];
  return bank.slice(0, limit).map((x) => x.text);
}

/** Merge Studio Brain phrases into genre slot presets (brain phrases first). */
export function boostSlotsWithStudioBrain(slots = []) {
  return (Array.isArray(slots) ? slots : []).map((slot) => {
    const learned = getBrainCraftPresets(slot.key, 16);
    if (!learned.length) return slot;
    const base = Array.isArray(slot.presets) ? slot.presets : [];
    const merged = [...learned, ...base.filter((p) => !learned.includes(p))];
    return { ...slot, presets: merged };
  });
}

/** Pick a learned phrase for offline heuristic enrichment. */
export function pickBrainCraft(craftKey, fallback = '') {
  const list = getBrainCraftPresets(craftKey, 8);
  if (!list.length) return fallback;
  return list[Math.floor(Math.random() * Math.min(3, list.length))] || list[0] || fallback;
}

export function exportStudioBrainJson() {
  const brain = getStudioBrain();
  const blob = new Blob([JSON.stringify(brain, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sps-studio-brain-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importStudioBrainJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid brain file');
        const merged = {
          ...emptyBrain(),
          ...parsed,
          craftBanks: { ...(emptyBrain().craftBanks), ...(parsed.craftBanks || {}) },
          characters: { ...(parsed.characters || {}) },
          genres: { ...(parsed.genres || {}) }
        };
        writeLocal(merged);
        resolve(merged);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsText(file);
  });
}

export function resetStudioBrain() {
  return writeLocal(emptyBrain());
}

/** Learn from every project currently in the library (bulk train). */
export function learnFromProjectLibrary(library = []) {
  const list = Array.isArray(library) ? library : [];
  let brain = getStudioBrain();
  list.forEach((proj) => {
    if (!proj?.title || !Array.isArray(proj.shots) || !proj.shots.length) return;
    brain = learnFromProject({
      projectTitle: proj.title,
      shots: proj.shots,
      genreKey: proj.genreKey || '',
      aspectRatio: proj.aspectRatio || '',
      targetModel: proj.targetModel || ''
    });
  });
  return brain;
}
