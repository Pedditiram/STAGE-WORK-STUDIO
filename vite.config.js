import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function safeRoomFileName(roomId) {
  return String(roomId || 'SPS-CLOUD-8821').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
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

function localDiskVaultPlugin() {
  const baseDir = path.resolve(__dirname);
  const projectsDir = path.join(baseDir, 'projects');
  const settingsDir = path.join(baseDir, 'settings');
  const storageDir = path.join(baseDir, 'storage');
  const cloudDir = path.join(storageDir, 'cloud');
  const cloudRoomsDir = path.join(cloudDir, 'rooms');

  // Ensure directories exist on server start
  [projectsDir, settingsDir, storageDir, cloudDir, cloudRoomsDir].forEach(d => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });

  const presencePath = path.join(cloudDir, 'presence.json');
  const collaboratorsPath = path.join(cloudDir, 'collaborators.json');
  const cloudProjectsPath = path.join(cloudDir, 'projects.json');
  const cloudChatDir = path.join(cloudDir, 'chat');
  if (!fs.existsSync(cloudChatDir)) {
    fs.mkdirSync(cloudChatDir, { recursive: true });
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
      .slice(-400);
  }

  function readJsonFile(filePath, fallback) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {}
    return fallback;
  }

  function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  return {
    name: 'sps-local-disk-vault',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // --- Multi-user cloud sync (durable on disk for local + LAN browser collab) ---
        if (req.url && req.url.startsWith('/api/sync')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.end();
            return;
          }

          try {
            const url = new URL(req.url, 'http://localhost');
            const type = url.searchParams.get('type') || 'room';
            const roomId = url.searchParams.get('roomId') || 'SPS-CLOUD-8821';

            if (req.method === 'GET') {
              if (type === 'projects') {
                const data = readJsonFile(cloudProjectsPath, { projects: [] });
                return sendJson(res, 200, { success: true, projects: data.projects || [] });
              }
              if (type === 'collaborators') {
                const data = readJsonFile(collaboratorsPath, { users: [] });
                return sendJson(res, 200, { success: true, users: data.users || [] });
              }
              if (type === 'presence') {
                const data = readJsonFile(presencePath, {});
                const now = Date.now();
                const activeSlots = {};
                Object.entries(data).forEach(([key, val]) => {
                  if (val && now - (val.timestamp || 0) < 120000) activeSlots[key] = val;
                });
                return sendJson(res, 200, { success: true, activeSlots });
              }
              if (type === 'chat') {
                const chatPath = path.join(cloudChatDir, `${safeRoomFileName(roomId)}.json`);
                const data = readJsonFile(chatPath, { messages: [] });
                return sendJson(res, 200, {
                  success: true,
                  messages: Array.isArray(data.messages) ? data.messages : [],
                  roomId,
                });
              }

              const roomPath = path.join(cloudRoomsDir, safeRoomFileName(roomId));
              const roomData = readJsonFile(roomPath, null);
              return sendJson(res, 200, { success: true, data: roomData });
            }

            if (req.method === 'POST' || req.method === 'PUT') {
              const body = await readJsonBody(req);

              if (type === 'projects') {
                const incoming = Array.isArray(body.projects) ? body.projects : (Array.isArray(body) ? body : []);
                const cleanedIncoming = (incoming || []).filter((p) => {
                  const title = String(p?.title || '').trim();
                  return title && title.toUpperCase() !== 'STAGE PRODUCTION STUDIO';
                });
                const existing = readJsonFile(cloudProjectsPath, { projects: [] });
                if (cleanedIncoming.length === 0 && (existing.projects || []).length > 0) {
                  return sendJson(res, 200, { success: true, projects: existing.projects || [], ignoredEmpty: true });
                }
                const prevByTitle = new Map();
                (existing.projects || []).forEach((p) => {
                  const title = String(p?.title || '').trim().toUpperCase();
                  if (title) prevByTitle.set(title, p);
                });
                // Incoming owns membership (deletes stick); merge fields for same titles
                const projects = cleanedIncoming.map((p) => {
                  const key = String(p.title).trim().toUpperCase();
                  const prev = prevByTitle.get(key);
                  return prev ? { ...prev, ...p } : p;
                });
                writeJsonFile(cloudProjectsPath, { projects, updatedAt: new Date().toISOString() });
                return sendJson(res, 200, { success: true, projects });
              }

              if (type === 'collaborators') {
                const users = Array.isArray(body.users) ? body.users : (Array.isArray(body) ? body : []);
                const existing = readJsonFile(collaboratorsPath, { users: [] });
                if (users.length === 0 && (existing.users || []).length > 0) {
                  return sendJson(res, 200, {
                    success: true,
                    users: existing.users || [],
                    ignoredEmpty: true
                  });
                }
                writeJsonFile(collaboratorsPath, { users, updatedAt: new Date().toISOString() });
                return sendJson(res, 200, { success: true, users });
              }

              if (type === 'presence') {
                const presenceId =
                  body.presenceId ||
                  (body.userEmail ? String(body.userEmail).replace(/[^a-zA-Z0-9]/g, '_') : 'anon');
                const existing = readJsonFile(presencePath, {});
                existing[presenceId] = { ...body, timestamp: Date.now() };
                writeJsonFile(presencePath, existing);
                return sendJson(res, 200, { success: true });
              }

              if (type === 'chat') {
                const chatPath = path.join(cloudChatDir, `${safeRoomFileName(roomId)}.json`);
                const existing = readJsonFile(chatPath, { messages: [] });
                const incoming = Array.isArray(body.messages) ? body.messages : [];
                const messages = mergeChatMessages(existing.messages || [], incoming);
                writeJsonFile(chatPath, { messages, roomId, updatedAt: new Date().toISOString() });
                return sendJson(res, 200, { success: true, messages, roomId });
              }

              const payload = body.data || body;
              const roomPath = path.join(cloudRoomsDir, safeRoomFileName(roomId));
              const existingRoom = readJsonFile(roomPath, {});
              const stamped = {
                ...payload,
                revision: typeof payload.revision === 'number' ? payload.revision : Date.now(),
                lastUpdated: new Date().toISOString()
              };
              const existingRev = typeof existingRoom?.revision === 'number' ? existingRoom.revision : 0;
              if (existingRev && stamped.revision < existingRev) {
                return sendJson(res, 200, { success: true, data: existingRoom, skipped: 'stale' });
              }

              const merged = {
                ...existingRoom,
                ...stamped,
                roomId,
                shots: mergeShots(existingRoom?.shots, stamped?.shots),
                lastUpdated: stamped.lastUpdated,
                revision: stamped.revision
              };
              writeJsonFile(roomPath, merged);
              return sendJson(res, 200, { success: true, data: merged });
            }

            return sendJson(res, 405, { error: 'Method not allowed' });
          } catch (err) {
            return sendJson(res, 500, { error: err.message || 'Sync failed' });
          }
        }

        // 1. SAVE PROJECT TO PHYSICAL DISK: POST /api/save-project-disk
        if (req.url === '/api/save-project-disk' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const project = JSON.parse(body);
              const title = project.title || 'UNTITLED_PROJECT';
              const safeFilename = title.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
              const filePath = path.join(projectsDir, safeFilename);

              fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf8');

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, filePath, filename: safeFilename }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 2. SAVE SETTINGS TO PHYSICAL DISK: POST /api/save-settings-disk
        if (req.url === '/api/save-settings-disk' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const settingsPkg = JSON.parse(body);
              const filePath = path.join(settingsDir, 'master_app_settings.json');

              fs.writeFileSync(filePath, JSON.stringify(settingsPkg, null, 2), 'utf8');

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, filePath }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // LOAD SETTINGS FROM PHYSICAL DISK: GET /api/load-settings-disk
        if (req.url === '/api/load-settings-disk' && req.method === 'GET') {
          try {
            const filePath = path.join(settingsDir, 'master_app_settings.json');
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf8');
              const parsed = JSON.parse(content);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ settings: parsed.settings || parsed }));
              return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ settings: {} }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 3. SAVE IMAGE TO PHYSICAL DISK: POST /api/save-image-disk
        if (req.url === '/api/save-image-disk' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { key, imageUrl } = JSON.parse(body);
              const safeKey = (key || 'render').replace(/[^a-zA-Z0-9_-]/g, '_');

              if (imageUrl && imageUrl.startsWith('data:image/')) {
                const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
                const filePath = path.join(storageDir, `${safeKey}.png`);
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, filePath }));
                return;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, note: 'non-base64 url cached' }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 4. LIST ALL PROJECTS FROM PHYSICAL DISK: GET /api/list-projects-disk
        if (req.url === '/api/list-projects-disk' && req.method === 'GET') {
          try {
            const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.json'));
            const projects = [];
            for (const f of files) {
              try {
                const content = fs.readFileSync(path.join(projectsDir, f), 'utf8');
                const parsed = JSON.parse(content);
                projects.push(parsed);
              } catch (e) {}
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ projects }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
const isElectronBuild = process.env.ELECTRON_BUILD === 'true';

export default defineConfig({
  // Use './' base for Electron (file:// protocol) or '/' for web server
  base: isElectronBuild ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
    localDiskVaultPlugin()
  ],
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  worker: {
    format: 'es'
  },
  server: {
    host: true, // Exposes app on local intranet (Wi-Fi / LAN)
    port: 5173,
    // Allow Cloudflare quick tunnels + LAN hostnames for remote browser collab
    allowedHosts: true,
    watch: {
      ignored: ['**/projects/**', '**/settings/**', '**/storage/**', '**/storage/cloud/**']
    }
  }
})
