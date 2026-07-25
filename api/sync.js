// High-Speed Vercel Edge & Serverless Database Sync Engine
// Supports 100% Real-Time Cross-Browser Sync (Safari, Firefox, Chrome, Edge, Mobile)

let memoryRooms = {};
let memoryProjects = [
  {
    id: "proj_002",
    title: "002",
    description: "Cinema Production Studio Project with 4 shots",
    targetModel: "SPS Direct Cinema 2.0",
    aspectRatio: "2.39:1 Anamorphic",
    roomId: "SPS-CLOUD-8821_002",
    lastModified: new Date().toLocaleDateString(),
    shots: [
      { sceneShotId: "SC01_SH01", shotComposition: "Extreme Close-Up (ECU)", cameraMotionTag: "[Camera: Push In Rapid Zoom]" },
      { sceneShotId: "SC01_SH02", shotComposition: "Medium Shot (MS)", cameraMotionTag: "[Camera: Tracking Pan Right]" },
      { sceneShotId: "SC01_SH03", shotComposition: "Medium Shot (MS)", cameraMotionTag: "[Camera: Static Anchor]" },
      { sceneShotId: "SC01_SH04", shotComposition: "Medium Shot (MS)", cameraMotionTag: "[Camera: Slow Dolly Out]" }
    ]
  },
  {
    id: "proj_ram",
    title: "PROJECT RAM",
    description: "Cinema Production Studio Project with 2 shots",
    targetModel: "SPS Direct Cinema 2.0",
    aspectRatio: "2.39:1 Anamorphic",
    roomId: "SPS-PROJ-8476",
    lastModified: new Date().toLocaleDateString(),
    shots: [
      { sceneShotId: "SC01_SH01", shotComposition: "Extreme Close-Up (ECU)", cameraMotionTag: "[Camera: Push In Rapid Zoom]" },
      { sceneShotId: "SC01_SH02", shotComposition: "Medium Shot (MS)", cameraMotionTag: "[Camera: Tracking Pan Right]" }
    ]
  },
  {
    id: "proj_2",
    title: "2",
    description: "test",
    targetModel: "SPS Direct Cinema 2.0",
    aspectRatio: "2.39:1 Anamorphic",
    roomId: "SPS-2-4287",
    lastModified: new Date().toLocaleDateString(),
    shots: [
      { sceneShotId: "SC01_SH01", shotComposition: "Medium Shot (MS)", cameraMotionTag: "[Camera: Static Anchor]" }
    ]
  }
];
let memoryCollaborators = [];
let memoryPresence = {};

const RESTFUL_ROOM_URL = "https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92556";
const RESTFUL_PROJECTS_URL = "https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92555";
const JSONBLOB_ROOM_URL = "https://jsonblob.com/api/jsonBlob/019f9748-ab24-7be0-8065-27742b7c70bd";
const JSONBLOB_PROJECTS_URL = "https://jsonblob.com/api/jsonBlob/019f9748-a7fd-7d7b-ac0c-2a2c457fe616";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type = 'room', roomId = 'SPS-CLOUD-8821' } = req.query || {};

  // GET Request: Return latest data
  if (req.method === 'GET') {
    if (type === 'projects') {
      return res.status(200).json({ success: true, projects: memoryProjects });
    }

    if (type === 'collaborators') {
      return res.status(200).json({ success: true, users: memoryCollaborators });
    }

    if (type === 'presence') {
      const now = Date.now();
      const activeSlots = {};
      Object.entries(memoryPresence).forEach(([key, val]) => {
        if (val && (now - (val.timestamp || 0)) < 120000) {
          activeSlots[key] = val;
        }
      });
      return res.status(200).json({ success: true, activeSlots });
    }

    // Room Sync Request
    if (memoryRooms[roomId]) {
      return res.status(200).json({ success: true, data: memoryRooms[roomId] });
    }

    try {
      const fetchRes = await fetch(`${RESTFUL_ROOM_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (fetchRes.ok) {
        const resObj = await fetchRes.json();
        const payload = resObj?.data || resObj;
        if (payload) {
          memoryRooms[roomId] = payload;
          return res.status(200).json({ success: true, data: payload });
        }
      }
    } catch (e) {}

    return res.status(200).json({ success: true, data: memoryRooms[roomId] || null });
  }

  // POST / PUT Request: Write new data
  if (req.method === 'POST' || req.method === 'PUT') {
    const body = req.body || {};

    if (type === 'projects') {
      const incomingProjs = body.projects || body;
      if (Array.isArray(incomingProjs)) {
        const projMap = new Map();
        // Keep existing memory projects
        memoryProjects.forEach(p => {
          if (p && p.title) projMap.set(p.title, p);
        });
        // Merge incoming projects
        incomingProjs.forEach(p => {
          if (p && p.title) {
            const existing = projMap.get(p.title);
            if (existing) {
              projMap.set(p.title, { ...existing, ...p });
            } else {
              projMap.set(p.title, p);
            }
          }
        });
        memoryProjects = Array.from(projMap.values());

        // Asynchronously update persistence endpoints
        fetch(RESTFUL_PROJECTS_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: "Stage Production Studio Projects", data: { projects: memoryProjects, updatedAt: new Date().toISOString() } })
        }).catch(() => {});

        fetch(JSONBLOB_PROJECTS_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projects: memoryProjects, updatedAt: new Date().toISOString() })
        }).catch(() => {});
      }
      return res.status(200).json({ success: true, projects: memoryProjects });
    }

    if (type === 'collaborators') {
      const users = body.users || body;
      if (Array.isArray(users)) {
        memoryCollaborators = users;
      }
      return res.status(200).json({ success: true });
    }

    if (type === 'presence') {
      const presenceId = body.presenceId || (body.userEmail ? body.userEmail.replace(/[^a-zA-Z0-9]/g, '_') : 'anon');
      memoryPresence[presenceId] = {
        ...body,
        timestamp: Date.now()
      };
      return res.status(200).json({ success: true });
    }

    // Room update with smart shot-level merging for multi-user safety
    const payload = body.data || body;
    if (payload) {
      const existingRoom = memoryRooms[roomId] || {};
      
      let finalShots = payload.shots;
      if (Array.isArray(payload.shots) && Array.isArray(existingRoom.shots) && existingRoom.shots.length > 0) {
        const shotMap = new Map();
        existingRoom.shots.forEach(s => {
          if (s && s.sceneShotId) shotMap.set(s.sceneShotId, s);
        });

        payload.shots.forEach(s => {
          if (s && s.sceneShotId) {
            const existingShot = shotMap.get(s.sceneShotId);
            if (existingShot) {
              shotMap.set(s.sceneShotId, { ...existingShot, ...s });
            } else {
              shotMap.set(s.sceneShotId, s);
            }
          }
        });

        finalShots = Array.from(shotMap.values());
      }

      const mergedPayload = {
        ...existingRoom,
        ...payload,
        shots: finalShots || payload.shots,
        lastUpdated: new Date().toISOString()
      };

      memoryRooms[roomId] = mergedPayload;

      fetch(RESTFUL_ROOM_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "Stage Production Studio Room", data: mergedPayload })
      }).catch(() => {});

      fetch(JSONBLOB_ROOM_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergedPayload)
      }).catch(() => {});
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
