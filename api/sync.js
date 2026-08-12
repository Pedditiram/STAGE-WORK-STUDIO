/**
 * Production serverless sync API for Stage Production Studio.
 * Room payloads are keyed by roomId so invite links (?room=SPS-CLOUD-8821)
 * match what hosts publish — rooms never clobber each other on shared hubs.
 *
 * Durable JSONBlob is the cross-instance source of truth (Vercel memory is ephemeral).
 * RESTFUL hubs are best-effort only (strict public rate limits).
 *
 * Optional stronger durable (recommended if JSONBlob rate-limits persist):
 *   SPS_KV_REST_URL  + SPS_KV_REST_TOKEN  → Upstash / Vercel KV REST
 *   (aliases) KV_REST_API_URL / KV_REST_API_TOKEN
 *             UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 * Uses Upstash command-array REST: POST baseUrl with ["GET"|"SET", key, value?]
 * Keys used: sps:rooms | sps:projects | sps:collaborators | sps:chat | sps:presence
 * Without KV env vars the API safely falls back to JSONBlob (+ RESTFUL best-effort).
 */

let memoryRooms = {};
let memoryProjects = [];
let memoryCollaborators = [];
let memoryPresence = {};
let memoryChat = {}; // roomId -> messages[]
let memoryDeletedTitles = []; // uppercase title keys tombstoned across instances
let projectsHydrated = false;
let collaboratorsHydrated = false;
let roomsHydrated = false;
let chatHydrated = false;
let presenceHydrated = false;
let lastProjectsDurableOk = false;
let lastCollaboratorsDurableOk = false;
let lastRoomsDurableOk = false;
let lastChatDurableOk = false;

const RESTFUL_HUB_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92556';
const RESTFUL_PROJECTS_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92555';
/** Durable JSONBlob stores (recreated 2026-08-11 after prior blobs 404'd). */
const JSONBLOB_HUB_URL = 'https://jsonblob.com/api/jsonBlob/019ff13d-43e0-74db-bb8d-6211e85dc74e';
const JSONBLOB_PROJECTS_URL = 'https://jsonblob.com/api/jsonBlob/019ff13d-4075-73fe-8c17-d9e6ccf0f922';
const JSONBLOB_COLLABORATORS_URL = 'https://jsonblob.com/api/jsonBlob/019ff13d-79e0-75d9-9312-53b71c76be18';
const JSONBLOB_CHAT_URL = 'https://jsonblob.com/api/jsonBlob/019ff04a-bc89-7b5a-83a5-0f86446ff799';
/** Dedicated presence blob — must NOT share the rooms hub (size + wipe risk). */
const JSONBLOB_PRESENCE_URL = 'https://jsonblob.com/api/jsonBlob/019ff13d-7ff2-7974-93c5-6c3abaa2cf10';
const MAX_CHAT_MESSAGES = 400;
const PRESENCE_TTL_MS = 120000;
const PRIMARY_ADMIN_EMAIL = 'pedditiram@gmail.com';
const FETCH_TIMEOUT_MS = 12000;
const JSONBLOB_CIRCUIT_MS = 20000;
/** Circuit breaker — stop thrashing JSONBlob PUTs after 429 / hard failures. */
let jsonBlobCircuitOpenUntil = 0;
/** In-flight coalesce (no setTimeout — timers die on Vercel after response). */
const coalescePayloads = new Map();
const coalesceWaiters = new Map();
const coalesceInFlight = new Map();

function kvRestUrl() {
  return (
    process.env.SPS_KV_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ''
  ).replace(/\/$/, '');
}

function kvRestToken() {
  return (
    process.env.SPS_KV_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ''
  );
}

function kvConfigured() {
  return Boolean(kvRestUrl() && kvRestToken());
}

function kvKey(kind) {
  return `sps:${kind}`;
}

function parseKvResult(result) {
  if (result == null) return null;
  if (typeof result === 'object') return result;
  if (typeof result !== 'string') return null;
  try {
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
}

/** Upstash / Vercel KV REST — command array on base URL (safe for large JSON values). */
async function kvCommand(argv) {
  const url = kvRestUrl();
  const token = kvRestToken();
  if (!url || !token) return null;
  const t = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(argv),
      signal: t.signal,
      cache: 'no-store'
    });
    t.clear();
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    t.clear();
    return null;
  }
}

async function kvGet(kind) {
  if (!kvConfigured()) return null;
  try {
    const data = await kvCommand(['GET', kvKey(kind)]);
    if (!data) return null;
    return parseKvResult(data.result);
  } catch (e) {
    return null;
  }
}

async function kvSet(kind, body) {
  if (!kvConfigured()) return false;
  try {
    const data = await kvCommand(['SET', kvKey(kind), JSON.stringify(body)]);
    if (!data) return false;
    // Upstash returns { result: "OK" } on success
    return data.result === 'OK' || data.result === true || typeof data.result === 'string';
  } catch (e) {
    return false;
  }
}

function withTimeout(ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastErr;
  const method = String(options.method || 'GET').toUpperCase();
  for (let attempt = 0; attempt <= retries; attempt++) {
    const t = withTimeout(FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: t.signal, cache: 'no-store' });
      t.clear();
      if (res.status === 429 && attempt < retries) {
        const retryAfter = Number(res.headers?.get?.('retry-after') || 0);
        const wait = retryAfter > 0
          ? Math.min(12000, retryAfter * 1000)
          : Math.min(10000, 900 * Math.pow(2, attempt) + Math.floor(Math.random() * 400));
        // Open circuit on sustained rate limits so we stop thrashing PUTs
        if (method !== 'GET') {
          jsonBlobCircuitOpenUntil = Date.now() + JSONBLOB_CIRCUIT_MS;
        }
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if ((res.status === 502 || res.status === 503) && attempt < retries && method === 'GET') {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      t.clear();
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr || new Error('fetch failed');
}

function mergeChatMessages(localList, remoteList) {
  const map = new Map();
  [...(localList || []), ...(remoteList || [])].forEach((m) => {
    if (!m?.id) return;
    map.set(m.id, m);
  });
  return Array.from(map.values())
    .filter((m) => !m.deleted)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .slice(-MAX_CHAT_MESSAGES);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
}

function revisionOf(payload) {
  const r = typeof payload?.revision === 'number' ? payload.revision : 0;
  if (r) return r;
  return Date.parse(payload?.lastUpdated || '') || 0;
}

function isNewerRevision(incoming, existing) {
  const ir = typeof incoming?.revision === 'number' ? incoming.revision : 0;
  const er = typeof existing?.revision === 'number' ? existing.revision : 0;
  if (!er) return true;
  if (!ir) {
    const it = Date.parse(incoming?.lastUpdated || '') || 0;
    const et = Date.parse(existing?.lastUpdated || '') || 0;
    return !et || it > et;
  }
  if (ir !== er) return ir > er;
  // Equal revision: prefer newer lastUpdated; reject identical/older echoes
  const it = Date.parse(incoming?.lastUpdated || '') || 0;
  const et = Date.parse(existing?.lastUpdated || '') || 0;
  return it > et;
}

function pickNewerRoom(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return revisionOf(b) > revisionOf(a) ? b : a;
}

function mergeShots(existingShots, incomingShots) {
  if (!Array.isArray(incomingShots)) return existingShots;
  if (!Array.isArray(existingShots) || existingShots.length === 0) return incomingShots;
  const existingMap = new Map();
  existingShots.forEach((s) => {
    if (s?.sceneShotId) existingMap.set(s.sceneShotId, s);
  });
  return incomingShots.map((s) => {
    if (!s?.sceneShotId) return s;
    const prev = existingMap.get(s.sceneShotId);
    return prev ? { ...prev, ...s } : s;
  });
}

function titleKey(title) {
  return String(title || '').trim().toUpperCase();
}

function normalizeDeletedTitles(list) {
  const set = new Set();
  (Array.isArray(list) ? list : []).forEach((t) => {
    const k = titleKey(t);
    if (k && k !== 'STAGE PRODUCTION STUDIO') set.add(k);
  });
  return Array.from(set).slice(0, 500);
}

function filterDeletedProjects(projects, deleted = memoryDeletedTitles) {
  const gone = new Set(normalizeDeletedTitles(deleted));
  return (Array.isArray(projects) ? projects : []).filter((p) => {
    const k = titleKey(p?.title);
    return k && k !== 'STAGE PRODUCTION STUDIO' && !gone.has(k);
  });
}

function ensurePrimaryAdmin(users) {
  const list = Array.isArray(users) ? users.map((u) => ({ ...u })) : [];
  const idx = list.findIndex(
    (u) => String(u?.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL
  );
  const defaults = {
    name: 'Pedditi Ram',
    designation: 'Lead Director',
    email: PRIMARY_ADMIN_EMAIL,
    role: 'Owner',
    isStudioAdmin: true,
    status: 'Active',
    allottedProjects: ['All Studio Projects (Full Access)'],
    verifiedAt: 'Primary Admin (default)'
  };
  if (idx === -1) {
    list.unshift(defaults);
  } else {
    list[idx] = {
      ...defaults,
      ...list[idx],
      email: PRIMARY_ADMIN_EMAIL,
      role: 'Owner',
      isStudioAdmin: true,
      status: list[idx].status === 'Suspended' ? 'Active' : list[idx].status || 'Active'
    };
    if (idx !== 0) {
      const [admin] = list.splice(idx, 1);
      list.unshift(admin);
    }
  }
  return list;
}

async function fetchJsonBlob(url) {
  if (Date.now() < jsonBlobCircuitOpenUntil) {
    throw new Error('jsonblob circuit open');
  }
  const res = await fetchWithRetry(`${url}?t=${Date.now()}`);
  if (res.status === 429) {
    jsonBlobCircuitOpenUntil = Date.now() + JSONBLOB_CIRCUIT_MS;
    throw new Error(`jsonblob ${res.status}`);
  }
  if (!res.ok) throw new Error(`jsonblob ${res.status}`);
  return res.json();
}

/** Free JSONBlob rejects bodies over ~10KB — keep durable payloads compact. */
const JSONBLOB_MAX_BYTES = 10000;

function slimShot(s) {
  if (!s || typeof s !== 'object') return s;
  return {
    sceneShotId: s.sceneShotId,
    shotComposition: s.shotComposition,
    cameraMotionTag: s.cameraMotionTag,
    timeAndLightingEnv: s.timeAndLightingEnv,
    subjectLightingTag: s.subjectLightingTag,
    subjectColorTag: s.subjectColorTag,
    characterIdAssetRef: s.characterIdAssetRef,
    coArtistInteraction: s.coArtistInteraction,
    actionEnvContext: String(s.actionEnvContext || '').slice(0, 180),
    characterExpression: s.characterExpression,
    characterPlacement: s.characterPlacement,
    characterDialogue: String(s.characterDialogue || '').slice(0, 120),
    characterMovement: s.characterMovement,
    characterEyeLooks: s.characterEyeLooks
  };
}

/** Slim rooms hub only — never drop entire projects from the library array. */
function fitRoomsHubPayload(body) {
  let payload = body;
  let text = JSON.stringify(payload);
  if (Buffer.byteLength(text) <= JSONBLOB_MAX_BYTES) return payload;

  if (payload && payload.rooms && typeof payload.rooms === 'object') {
    const rooms = {};
    Object.entries(payload.rooms).forEach(([id, room]) => {
      const shots = Array.isArray(room?.shots) ? room.shots.map(slimShot) : room?.shots;
      rooms[id] = { ...room, shots, projectGeneratedImages: undefined };
    });
    payload = { ...payload, rooms };
    text = JSON.stringify(payload);
  }

  if (Buffer.byteLength(text) > JSONBLOB_MAX_BYTES && payload?.rooms) {
    const rooms = {};
    Object.entries(payload.rooms).forEach(([id, room]) => {
      rooms[id] = {
        roomId: room.roomId || id,
        projectTitle: room.projectTitle,
        targetModel: room.targetModel,
        aspectRatio: room.aspectRatio,
        revision: room.revision,
        lastUpdated: room.lastUpdated,
        shotCount: Array.isArray(room.shots) ? room.shots.length : 0,
        shots: Array.isArray(room.shots) ? room.shots.slice(0, 8).map(slimShot) : []
      };
    });
    payload = { ...payload, rooms };
  }

  return payload;
}

/** Metadata-only project stubs — keep ALL titles; drop shot bodies if needed. */
function fitProjectsPayload(body) {
  const deletedTitles = normalizeDeletedTitles(body?.deletedTitles || memoryDeletedTitles);
  let projects = (Array.isArray(body?.projects) ? body.projects : []).map((p) => ({
    id: p.id,
    title: p.title,
    description: String(p.description || '').slice(0, 160),
    targetModel: p.targetModel,
    aspectRatio: p.aspectRatio,
    roomId: p.roomId,
    lastModified: p.lastModified,
    lastUpdated: p.lastUpdated || p.updatedAt || null,
    shotCount: Array.isArray(p.shots) ? p.shots.length : p.shotCount || 0,
    shots: []
  }));

  let payload = {
    projects,
    deletedTitles,
    updatedAt: body?.updatedAt || new Date().toISOString(),
    app: 'stage-production-studio'
  };
  let text = JSON.stringify(payload);

  // Extreme size: drop descriptions first, never drop project membership silently
  if (Buffer.byteLength(text) > JSONBLOB_MAX_BYTES) {
    projects = projects.map((p) => ({ ...p, description: undefined }));
    payload = { ...payload, projects };
    text = JSON.stringify(payload);
  }

  if (Buffer.byteLength(text) > JSONBLOB_MAX_BYTES) {
    // Still over: store titles+ids only (membership intact)
    projects = projects.map((p) => ({
      id: p.id,
      title: p.title,
      roomId: p.roomId,
      shotCount: p.shotCount,
      lastModified: p.lastModified
    }));
    payload = { ...payload, projects };
  }

  return payload;
}

async function putJsonBlob(url, body, { kind = 'generic' } = {}) {
  if (Date.now() < jsonBlobCircuitOpenUntil) {
    throw new Error('jsonblob circuit open');
  }

  let fitted = body;
  if (kind === 'rooms') fitted = fitRoomsHubPayload(body);
  else if (kind === 'projects') fitted = fitProjectsPayload(body);
  else if (kind === 'presence' || kind === 'collaborators' || kind === 'chat') {
    fitted = body;
  }

  const res = await fetchWithRetry(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(fitted)
  }, 2); // fewer PUT retries — avoid thrash under rate limits
  if (res.status === 429) {
    jsonBlobCircuitOpenUntil = Date.now() + JSONBLOB_CIRCUIT_MS;
    throw new Error(`jsonblob put ${res.status}`);
  }
  if (!res.ok) throw new Error(`jsonblob put ${res.status}`);
  return true;
}

/**
 * Coalesce durable writes within a warm instance so burst POSTs share one PUT.
 * Uses in-flight promise chaining (not setTimeout) so Vercel does not drop the write.
 */
async function coalesceDurableWrite(key, payload, flushFn) {
  coalescePayloads.set(key, payload);

  if (coalesceInFlight.get(key)) {
    return new Promise((resolve) => {
      const waiters = coalesceWaiters.get(key) || [];
      waiters.push(resolve);
      coalesceWaiters.set(key, waiters);
    });
  }

  coalesceInFlight.set(key, true);
  let ok = false;
  try {
    while (coalescePayloads.has(key)) {
      const body = coalescePayloads.get(key);
      coalescePayloads.delete(key);
      try {
        ok = await flushFn(body);
      } catch (e) {
        ok = false;
      }
    }
  } finally {
    coalesceInFlight.delete(key);
    const pending = coalesceWaiters.get(key) || [];
    coalesceWaiters.delete(key);
    pending.forEach((r) => r(ok));
  }
  return ok;
}

async function loadHub() {
  // Prefer KV when configured (more reliable than public JSONBlob)
  if (kvConfigured()) {
    try {
      const data = await kvGet('rooms');
      if (data && typeof data === 'object') {
        return {
          rooms: data.rooms || {},
          presence: data.presence || {},
          updatedAt: data.updatedAt || null
        };
      }
    } catch (e) {}
  }

  try {
    const hub = await fetchJsonBlob(JSONBLOB_HUB_URL);
    const data = hub?.data || hub;
    return {
      rooms: data?.rooms || hub?.rooms || {},
      presence: data?.presence || hub?.presence || {},
      updatedAt: data?.updatedAt || hub?.updatedAt || null
    };
  } catch (e) {}

  try {
    const res = await fetchWithRetry(`${RESTFUL_HUB_URL}?t=${Date.now()}`);
    if (res.ok) {
      const hub = await res.json();
      const data = hub?.data || hub;
      return {
        rooms: data?.rooms || {},
        presence: data?.presence || {},
        updatedAt: data?.updatedAt || null
      };
    }
  } catch (e) {}

  return null; // null = hydrate failed (do not treat as empty hub)
}

async function saveHub(hub) {
  // Presence lives in JSONBLOB_PRESENCE_URL — never write it into the rooms hub
  const body = {
    rooms: hub.rooms || {},
    updatedAt: new Date().toISOString(),
    app: 'stage-production-studio'
  };

  // Empty-hub overwrite guard — never wipe durable rooms with {}
  if (!body.rooms || Object.keys(body.rooms).length === 0) {
    return false;
  }

  return coalesceDurableWrite('rooms', body, async (payload) => {
    let ok = false;

    if (kvConfigured()) {
      try {
        ok = (await kvSet('rooms', payload)) || ok;
      } catch (e) {}
    }

    try {
      await putJsonBlob(JSONBLOB_HUB_URL, payload, { kind: 'rooms' });
      ok = true;
    } catch (e) {}

    // RESTFUL best-effort — never block; do not thrash if JSONBlob already failed hard
    fetch(RESTFUL_HUB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SPS Cloud Rooms Hub', data: payload })
    }).catch(() => {});

    return ok;
  });
}

function prunePresence(slots, now = Date.now()) {
  const out = {};
  Object.entries(slots || {}).forEach(([key, val]) => {
    if (val && typeof val === 'object' && now - (val.timestamp || 0) < PRESENCE_TTL_MS) {
      out[key] = val;
    }
  });
  return out;
}

async function loadPresenceStore() {
  if (kvConfigured()) {
    try {
      const data = await kvGet('presence');
      if (data) {
        const slots = data.activeSlots || data.presence || data;
        if (typeof slots === 'object' && slots && !Array.isArray(slots)) return slots;
      }
    } catch (e) {}
  }
  try {
    const data = await fetchJsonBlob(JSONBLOB_PRESENCE_URL);
    const slots = data?.activeSlots || data?.presence || {};
    return typeof slots === 'object' && slots && !Array.isArray(slots) ? slots : {};
  } catch (e) {
    return null;
  }
}

async function savePresenceStore(slots) {
  const activeSlots = prunePresence(slots);
  const body = {
    activeSlots,
    updatedAt: new Date().toISOString(),
    app: 'sps-presence'
  };
  return coalesceDurableWrite('presence', body, async (payload) => {
    let ok = false;
    if (kvConfigured()) {
      try {
        ok = (await kvSet('presence', payload)) || ok;
      } catch (e) {}
    }
    try {
      await putJsonBlob(JSONBLOB_PRESENCE_URL, payload, { kind: 'presence' });
      ok = true;
    } catch (e) {}
    return ok;
  }).then((ok) => (ok ? activeSlots : activeSlots));
}

async function hydratePresenceFromDurable() {
  try {
    const durable = await loadPresenceStore();
    if (durable && typeof durable === 'object') {
      memoryPresence = prunePresence({ ...durable, ...memoryPresence });
      presenceHydrated = true;
    }
  } catch (e) {}
  return memoryPresence;
}

/**
 * @returns {{ projects: array|null, deletedTitles: string[], ok: boolean }}
 * projects null = hydrate failed
 */
async function loadProjectsStore() {
  if (kvConfigured()) {
    try {
      const data = await kvGet('projects');
      if (data && Array.isArray(data.projects)) {
        return {
          projects: data.projects,
          deletedTitles: normalizeDeletedTitles(data.deletedTitles),
          ok: true
        };
      }
    } catch (e) {}
  }

  try {
    const data = await fetchJsonBlob(JSONBLOB_PROJECTS_URL);
    const projects = Array.isArray(data?.projects)
      ? data.projects
      : Array.isArray(data?.data?.projects)
        ? data.data.projects
        : null;
    if (projects) {
      return {
        projects,
        deletedTitles: normalizeDeletedTitles(data?.deletedTitles || data?.data?.deletedTitles),
        ok: true
      };
    }
  } catch (e) {}

  try {
    const res = await fetchWithRetry(`${RESTFUL_PROJECTS_URL}?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      const projects = data?.data?.projects || data?.projects;
      if (Array.isArray(projects)) {
        return {
          projects,
          deletedTitles: normalizeDeletedTitles(data?.data?.deletedTitles || data?.deletedTitles),
          ok: true
        };
      }
    }
  } catch (e) {}

  return { projects: null, deletedTitles: [], ok: false };
}

async function saveProjectsStore(projects, deletedTitles = memoryDeletedTitles) {
  const payload = {
    projects: Array.isArray(projects) ? projects : [],
    deletedTitles: normalizeDeletedTitles(deletedTitles),
    updatedAt: new Date().toISOString(),
    app: 'stage-production-studio'
  };

  // Empty overwrite guard at durable layer
  if (payload.projects.length === 0 && memoryProjects.length > 0) {
    return false;
  }

  return coalesceDurableWrite('projects', payload, async (body) => {
    let ok = false;
    if (kvConfigured()) {
      try {
        ok = (await kvSet('projects', body)) || ok;
      } catch (e) {}
    }
    try {
      await putJsonBlob(JSONBLOB_PROJECTS_URL, body, { kind: 'projects' });
      ok = true;
    } catch (e) {}
    fetch(RESTFUL_PROJECTS_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Stage Production Studio Projects', data: body })
    }).catch(() => {});
    return ok;
  });
}

async function loadChatStore() {
  if (kvConfigured()) {
    try {
      const data = await kvGet('chat');
      const chat = data?.chat || data;
      if (chat && typeof chat === 'object' && !Array.isArray(chat)) {
        return { chat, ok: true };
      }
    } catch (e) {}
  }
  try {
    const data = await fetchJsonBlob(JSONBLOB_CHAT_URL);
    const chat = data?.chat || data?.data?.chat || {};
    if (typeof chat === 'object' && chat) return { chat, ok: true };
  } catch (e) {}
  return { chat: null, ok: false }; // null = hydrate failed — do not treat as empty
}

async function saveChatStore(chatMap) {
  const body = {
    chat: chatMap || {},
    updatedAt: new Date().toISOString(),
    app: 'sps-collab-chat'
  };
  // Refuse empty wipe
  if (!body.chat || Object.keys(body.chat).length === 0) {
    return false;
  }
  return coalesceDurableWrite('chat', body, async (payload) => {
    let ok = false;
    if (kvConfigured()) {
      try {
        ok = (await kvSet('chat', payload)) || ok;
      } catch (e) {}
    }
    try {
      await putJsonBlob(JSONBLOB_CHAT_URL, payload, { kind: 'chat' });
      ok = true;
    } catch (e) {}
    return ok;
  });
}

async function loadCollaboratorsStore() {
  if (kvConfigured()) {
    try {
      const data = await kvGet('collaborators');
      if (Array.isArray(data?.users)) return { users: data.users, ok: true };
    } catch (e) {}
  }
  try {
    const data = await fetchJsonBlob(JSONBLOB_COLLABORATORS_URL);
    if (Array.isArray(data?.users)) return { users: data.users, ok: true };
    if (Array.isArray(data?.data?.users)) return { users: data.data.users, ok: true };
  } catch (e) {}
  return { users: null, ok: false };
}

async function saveCollaboratorsStore(users) {
  const secured = ensurePrimaryAdmin(users);
  const body = {
    users: secured,
    lastSynced: new Date().toISOString(),
    totalCollaborators: secured.length,
    app: 'stage-production-studio'
  };
  if (secured.length === 0) return secured;

  const ok = await coalesceDurableWrite('collaborators', body, async (payload) => {
    let saved = false;
    if (kvConfigured()) {
      try {
        saved = (await kvSet('collaborators', payload)) || saved;
      } catch (e) {}
    }
    try {
      await putJsonBlob(JSONBLOB_COLLABORATORS_URL, payload, { kind: 'collaborators' });
      saved = true;
    } catch (e) {}
    return saved;
  });
  if (!ok) throw new Error('collaborators durable save failed');
  return secured;
}

async function hydrateRoomsFromDurable() {
  try {
    const hub = await loadHub();
    if (!hub) return { ok: false, hub: null };
    const remoteRooms = hub.rooms || {};
    Object.entries(remoteRooms).forEach(([id, room]) => {
      memoryRooms[id] = pickNewerRoom(memoryRooms[id], room);
    });
    roomsHydrated = true;
    lastRoomsDurableOk = true;
    return { ok: true, hub };
  } catch (e) {
    return { ok: false, hub: null };
  }
}

async function hydrateProjectsFromDurable({ force = false } = {}) {
  if (projectsHydrated && !force && memoryProjects.length > 0) {
    return { ok: lastProjectsDurableOk, projects: memoryProjects };
  }
  const result = await loadProjectsStore();
  lastProjectsDurableOk = result.ok;
  if (result.ok && Array.isArray(result.projects)) {
    memoryDeletedTitles = normalizeDeletedTitles([
      ...memoryDeletedTitles,
      ...(result.deletedTitles || [])
    ]);
    memoryProjects = filterDeletedProjects(result.projects, memoryDeletedTitles);
    projectsHydrated = true;
  }
  return { ok: result.ok, projects: memoryProjects };
}

async function hydrateCollaboratorsFromDurable({ force = false } = {}) {
  if (collaboratorsHydrated && !force && memoryCollaborators.length > 0) {
    return { ok: lastCollaboratorsDurableOk, users: memoryCollaborators };
  }
  const result = await loadCollaboratorsStore();
  lastCollaboratorsDurableOk = result.ok;
  if (result.ok && Array.isArray(result.users)) {
    memoryCollaborators = ensurePrimaryAdmin(result.users);
    collaboratorsHydrated = true;
  }
  return { ok: result.ok, users: memoryCollaborators };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type = 'room', roomId = 'SPS-CLOUD-8821' } = req.query || {};
  const safeRoomId = String(roomId || 'SPS-CLOUD-8821');

  if (req.method === 'GET') {
    if (type === 'projects') {
      const { ok } = await hydrateProjectsFromDurable({ force: true });
      if (!ok && memoryProjects.length === 0) {
        return res.status(503).json({
          success: false,
          durableFailed: true,
          projects: null,
          error: 'Projects durable store unreachable'
        });
      }
      const cleanProjs = filterDeletedProjects(memoryProjects, memoryDeletedTitles);
      return res.status(200).json({
        success: true,
        projects: cleanProjs,
        deletedTitles: memoryDeletedTitles,
        durableOk: ok,
        kvConfigured: kvConfigured()
      });
    }

    if (type === 'collaborators') {
      const { ok } = await hydrateCollaboratorsFromDurable({ force: true });
      if (!ok && memoryCollaborators.length === 0) {
        return res.status(503).json({
          success: false,
          durableFailed: true,
          users: null,
          error: 'Collaborators durable store unreachable'
        });
      }
      const users = ensurePrimaryAdmin(memoryCollaborators);
      memoryCollaborators = users;
      return res.status(200).json({ success: true, users, durableOk: ok });
    }

    if (type === 'presence') {
      const now = Date.now();
      await hydratePresenceFromDurable();
      const activeSlots = prunePresence(memoryPresence, now);
      memoryPresence = activeSlots;
      return res.status(200).json({ success: true, activeSlots });
    }

    if (type === 'chat') {
      const loaded = await loadChatStore();
      if (loaded.ok && loaded.chat) {
        memoryChat = { ...memoryChat, ...loaded.chat };
        chatHydrated = true;
        lastChatDurableOk = true;
      }
      const messages = memoryChat[safeRoomId] || [];
      return res.status(200).json({
        success: true,
        messages,
        roomId: safeRoomId,
        durableOk: loaded.ok
      });
    }

    // Room GET — always merge durable hub so other Vercel instances see latest writes
    await hydrateRoomsFromDurable();
    const room = memoryRooms[safeRoomId] || null;
    return res.status(200).json({ success: true, data: room, durableOk: lastRoomsDurableOk });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = req.body || {};

    if (type === 'projects') {
      const incomingProjs = body.projects || body;
      const incomingDeleted = normalizeDeletedTitles(body.deletedTitles);

      await hydrateProjectsFromDurable({ force: !memoryProjects.length });

      if (Array.isArray(incomingProjs)) {
        const cleanedIncoming = incomingProjs.filter((p) => {
          const title = String(p?.title || '').trim();
          return title && title.toUpperCase() !== 'STAGE PRODUCTION STUDIO';
        });

        // Empty overwrite guard — never wipe a non-empty library
        if (cleanedIncoming.length === 0 && memoryProjects.length > 0) {
          return res.status(200).json({
            success: true,
            projects: filterDeletedProjects(memoryProjects),
            deletedTitles: memoryDeletedTitles,
            ignoredEmpty: true
          });
        }

        // Merge tombstones from client
        if (incomingDeleted.length) {
          memoryDeletedTitles = normalizeDeletedTitles([
            ...memoryDeletedTitles,
            ...incomingDeleted
          ]);
        }

        // Titles present in previous library but missing from incoming → tombstone
        if (cleanedIncoming.length > 0 && memoryProjects.length > 0) {
          const incomingKeys = new Set(cleanedIncoming.map((p) => titleKey(p.title)));
          memoryProjects.forEach((p) => {
            const k = titleKey(p?.title);
            if (k && !incomingKeys.has(k)) memoryDeletedTitles.push(k);
          });
          memoryDeletedTitles = normalizeDeletedTitles(memoryDeletedTitles);
        }

        const prevByTitle = new Map();
        memoryProjects.forEach((p) => {
          const title = titleKey(p?.title);
          if (title && title !== 'STAGE PRODUCTION STUDIO') {
            prevByTitle.set(title, p);
          }
        });
        memoryProjects = filterDeletedProjects(
          cleanedIncoming.map((p) => {
            const key = titleKey(p.title);
            const existing = prevByTitle.get(key);
            return existing ? { ...existing, ...p } : p;
          }),
          memoryDeletedTitles
        );
        projectsHydrated = true;

        const durableOk = await saveProjectsStore(memoryProjects, memoryDeletedTitles);
        lastProjectsDurableOk = durableOk;
        return res.status(200).json({
          success: true,
          projects: memoryProjects,
          deletedTitles: memoryDeletedTitles,
          durableOk
        });
      }
      return res.status(200).json({
        success: true,
        projects: filterDeletedProjects(memoryProjects),
        deletedTitles: memoryDeletedTitles
      });
    }

    if (type === 'collaborators') {
      const users = body.users || body;
      const hydrate = await hydrateCollaboratorsFromDurable({ force: !memoryCollaborators.length });

      if (Array.isArray(users)) {
        // Empty overwrite guard
        if (users.length === 0 && memoryCollaborators.length > 0) {
          return res.status(200).json({
            success: true,
            users: ensurePrimaryAdmin(memoryCollaborators),
            ignoredEmpty: true
          });
        }

        // Durable unreachable + empty memory + empty/minimal incoming → refuse wipe/seed
        if (!hydrate.ok && memoryCollaborators.length === 0 && users.length === 0) {
          return res.status(503).json({
            success: false,
            durableFailed: true,
            users: null,
            error: 'Collaborators durable store unreachable; refused empty write'
          });
        }

        memoryCollaborators = ensurePrimaryAdmin(users);
        collaboratorsHydrated = true;
        let durableOk = false;
        try {
          memoryCollaborators = await saveCollaboratorsStore(memoryCollaborators);
          durableOk = true;
        } catch (e) {}
        lastCollaboratorsDurableOk = durableOk;
        return res.status(200).json({
          success: true,
          users: memoryCollaborators,
          durableOk
        });
      }
      return res.status(200).json({
        success: true,
        users: ensurePrimaryAdmin(memoryCollaborators)
      });
    }

    if (type === 'presence') {
      const presenceId =
        body.presenceId || (body.userEmail ? String(body.userEmail).replace(/[^a-zA-Z0-9]/g, '_') : 'anon');
      const beforeKeys = Object.keys(memoryPresence).length;
      await hydratePresenceFromDurable();
      memoryPresence[presenceId] = { ...body, timestamp: Date.now() };
      memoryPresence = prunePresence(memoryPresence);

      // Refuse durable overwrite when hydrate failed and we'd publish a tiny partial map
      const canPersist =
        presenceHydrated ||
        beforeKeys > 0 ||
        Object.keys(memoryPresence).length > 0;

      if (canPersist && presenceHydrated) {
        try {
          await savePresenceStore(memoryPresence);
        } catch (e) {}
      } else if (canPersist && !presenceHydrated) {
        // Memory-only until durable is reachable again — avoid wiping other slots
      }
      return res.status(200).json({
        success: true,
        activeSlots: memoryPresence,
        durableOk: presenceHydrated
      });
    }

    if (type === 'chat') {
      const incoming = Array.isArray(body.messages) ? body.messages : [];
      const loaded = await loadChatStore();
      let store = {};
      if (loaded.ok && loaded.chat) {
        store = loaded.chat;
        memoryChat = { ...memoryChat, ...store };
        chatHydrated = true;
        lastChatDurableOk = true;
      }

      const merged = mergeChatMessages(
        mergeChatMessages(store[safeRoomId] || [], memoryChat[safeRoomId] || []),
        incoming
      );
      memoryChat[safeRoomId] = merged;

      // Only persist when we successfully hydrated — otherwise a cold instance
      // would overwrite the durable chat map with a single room.
      let durableOk = false;
      if (chatHydrated || loaded.ok) {
        const nextStore = { ...store, ...memoryChat, [safeRoomId]: merged };
        try {
          durableOk = await saveChatStore(nextStore);
          if (durableOk) memoryChat = nextStore;
          lastChatDurableOk = durableOk;
        } catch (e) {
          durableOk = false;
        }
      }

      return res.status(200).json({
        success: true,
        messages: merged,
        roomId: safeRoomId,
        durableOk,
        durableSkipped: durableOk ? undefined : 'hydrate_failed_or_rate_limited'
      });
    }

    // Room write — last-write-wins by revision; await durable save so peer GETs see it
    const payload = body.data || body;
    if (payload && typeof payload === 'object') {
      const hydrate = await hydrateRoomsFromDurable();
      const existingRoom = memoryRooms[safeRoomId] || {};
      const stamped = {
        ...payload,
        revision: typeof payload.revision === 'number' ? payload.revision : Date.now(),
        lastUpdated: new Date().toISOString()
      };

      if (existingRoom.lastUpdated && !isNewerRevision(stamped, existingRoom)) {
        return res.status(200).json({ success: true, data: existingRoom, skipped: 'stale' });
      }

      const mergedPayload = {
        ...existingRoom,
        ...stamped,
        roomId: safeRoomId,
        shots: mergeShots(existingRoom.shots, stamped.shots),
        lastUpdated: stamped.lastUpdated,
        revision: stamped.revision
      };

      memoryRooms[safeRoomId] = mergedPayload;

      // CRITICAL: never PUT a partial hub after failed hydrate on a cold instance
      // (would wipe sibling rooms that only exist in durable storage).
      let durableOk = false;
      const safeToPersist = hydrate.ok || roomsHydrated;

      if (safeToPersist) {
        try {
          durableOk = await saveHub({
            rooms: { ...memoryRooms, [safeRoomId]: mergedPayload }
          });
          lastRoomsDurableOk = durableOk;
          if (durableOk) roomsHydrated = true;
        } catch (e) {
          durableOk = false;
        }
      }

      return res.status(200).json({
        success: true,
        data: mergedPayload,
        durableOk,
        durableSkipped: durableOk ? undefined : 'hydrate_failed_guard'
      });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
