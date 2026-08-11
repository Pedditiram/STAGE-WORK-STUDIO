/**
 * Production serverless sync API for Stage Production Studio.
 * Room payloads are keyed by roomId so invite links (?room=SPS-CLOUD-8821)
 * match what hosts publish — rooms never clobber each other on shared hubs.
 */

let memoryRooms = {};
let memoryProjects = [];
let memoryCollaborators = [];
let memoryPresence = {};

const RESTFUL_HUB_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92556';
const JSONBLOB_HUB_URL = 'https://jsonblob.com/api/jsonBlob/019f9748-ab24-7be0-8065-27742b7c70bd';
const RESTFUL_PROJECTS_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92555';
const JSONBLOB_PROJECTS_URL = 'https://jsonblob.com/api/jsonBlob/019f9748-a7fd-7d7b-ac0c-2a2c457fe616';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
}

function isNewerRevision(incoming, existing) {
  const ir = typeof incoming?.revision === 'number' ? incoming.revision : 0;
  const er = typeof existing?.revision === 'number' ? existing.revision : 0;
  // Prefer numeric revisions. If existing has none, accept the write.
  if (!er) return true;
  if (!ir) {
    const it = Date.parse(incoming?.lastUpdated || '') || 0;
    const et = Date.parse(existing?.lastUpdated || '') || 0;
    return !et || it >= et;
  }
  return ir >= er;
}

function mergeShots(existingShots, incomingShots) {
  if (!Array.isArray(incomingShots)) return existingShots;
  if (!Array.isArray(existingShots) || existingShots.length === 0) return incomingShots;
  const existingMap = new Map();
  existingShots.forEach((s) => {
    if (s?.sceneShotId) existingMap.set(s.sceneShotId, s);
  });
  // Winning payload owns membership/order; merge fields from prior revision for same shot ids
  return incomingShots.map((s) => {
    if (!s?.sceneShotId) return s;
    const prev = existingMap.get(s.sceneShotId);
    return prev ? { ...prev, ...s } : s;
  });
}

async function loadHub() {
  try {
    const res = await fetch(`${JSONBLOB_HUB_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const hub = await res.json();
      return {
        rooms: hub?.rooms || hub?.data?.rooms || {},
        presence: hub?.presence || hub?.data?.presence || {},
        updatedAt: hub?.updatedAt || null
      };
    }
  } catch (e) {}

  try {
    const res = await fetch(`${RESTFUL_HUB_URL}?t=${Date.now()}`, { cache: 'no-store' });
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

  return { rooms: {}, presence: {}, updatedAt: null };
}

async function saveHub(hub) {
  const body = {
    ...hub,
    updatedAt: new Date().toISOString(),
    app: 'stage-production-studio'
  };

  await Promise.allSettled([
    fetch(JSONBLOB_HUB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
    fetch(RESTFUL_HUB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SPS Cloud Rooms Hub', data: body })
    })
  ]);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type = 'room', roomId = 'SPS-CLOUD-8821' } = req.query || {};
  const safeRoomId = String(roomId || 'SPS-CLOUD-8821');

  if (req.method === 'GET') {
    if (type === 'projects') {
      if (!memoryProjects.length) {
        try {
          const fetchRes = await fetch(`${JSONBLOB_PROJECTS_URL}?t=${Date.now()}`, { cache: 'no-store' });
          if (fetchRes.ok) {
            const data = await fetchRes.json();
            if (Array.isArray(data?.projects)) memoryProjects = data.projects;
          }
        } catch (e) {}
      }
      const cleanProjs = memoryProjects.filter(
        (p) => p && p.title && String(p.title).trim().toUpperCase() !== 'STAGE PRODUCTION STUDIO'
      );
      return res.status(200).json({ success: true, projects: cleanProjs });
    }

    if (type === 'collaborators') {
      return res.status(200).json({ success: true, users: memoryCollaborators });
    }

    if (type === 'presence') {
      const now = Date.now();
      if (!Object.keys(memoryPresence).length) {
        try {
          const hub = await loadHub();
          memoryPresence = hub.presence || {};
        } catch (e) {}
      }
      const activeSlots = {};
      Object.entries(memoryPresence).forEach(([key, val]) => {
        if (val && now - (val.timestamp || 0) < 120000) activeSlots[key] = val;
      });
      return res.status(200).json({ success: true, activeSlots });
    }

    // Room GET — memory first, then room-keyed hub
    if (memoryRooms[safeRoomId]) {
      return res.status(200).json({ success: true, data: memoryRooms[safeRoomId] });
    }

    try {
      const hub = await loadHub();
      memoryRooms = { ...memoryRooms, ...(hub.rooms || {}) };
      memoryPresence = { ...memoryPresence, ...(hub.presence || {}) };
      if (hub.rooms?.[safeRoomId]) {
        return res.status(200).json({ success: true, data: hub.rooms[safeRoomId] });
      }
    } catch (e) {}

    return res.status(200).json({ success: true, data: null });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = req.body || {};

    if (type === 'projects') {
      const incomingProjs = body.projects || body;
      if (Array.isArray(incomingProjs)) {
        const projMap = new Map();
        memoryProjects.forEach((p) => {
          if (p?.title && String(p.title).trim().toUpperCase() !== 'STAGE PRODUCTION STUDIO') {
            projMap.set(p.title, p);
          }
        });
        incomingProjs.forEach((p) => {
          if (p?.title && String(p.title).trim().toUpperCase() !== 'STAGE PRODUCTION STUDIO') {
            const existing = projMap.get(p.title);
            projMap.set(p.title, existing ? { ...existing, ...p } : p);
          }
        });
        memoryProjects = Array.from(projMap.values());

        const payload = { projects: memoryProjects, updatedAt: new Date().toISOString() };
        Promise.allSettled([
          fetch(RESTFUL_PROJECTS_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Stage Production Studio Projects', data: payload })
          }),
          fetch(JSONBLOB_PROJECTS_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        ]).catch(() => {});
      }
      return res.status(200).json({ success: true, projects: memoryProjects });
    }

    if (type === 'collaborators') {
      const users = body.users || body;
      if (Array.isArray(users)) memoryCollaborators = users;
      return res.status(200).json({ success: true });
    }

    if (type === 'presence') {
      const presenceId =
        body.presenceId || (body.userEmail ? String(body.userEmail).replace(/[^a-zA-Z0-9]/g, '_') : 'anon');
      memoryPresence[presenceId] = { ...body, timestamp: Date.now() };
      // Persist presence under hub without wiping rooms
      loadHub()
        .then((hub) =>
          saveHub({
            rooms: { ...(hub.rooms || {}), ...memoryRooms },
            presence: { ...(hub.presence || {}), ...memoryPresence }
          })
        )
        .catch(() => {});
      return res.status(200).json({ success: true });
    }

    // Room write — last-write-wins by revision (fallback: lastUpdated), keyed by roomId
    const payload = body.data || body;
    if (payload && typeof payload === 'object') {
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

      loadHub()
        .then((hub) =>
          saveHub({
            rooms: { ...(hub.rooms || {}), ...memoryRooms, [safeRoomId]: mergedPayload },
            presence: { ...(hub.presence || {}), ...memoryPresence }
          })
        )
        .catch(() => {});

      return res.status(200).json({ success: true, data: mergedPayload });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
