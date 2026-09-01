import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function loadAssetRootsFs() {
  const modPath = require.resolve('./src/utils/projectAssetRootsFs.cjs')
  delete require.cache[modPath]
  return require('./src/utils/projectAssetRootsFs.cjs')
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => { chunks.push(chunk); });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

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
  return String(roomId || 'sps_local_dev').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
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
  const postersDir = path.join(projectsDir, 'posters');
  if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true });

  function posterSafeName(title) {
    return `${String(title || 'UNTITLED').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'UNTITLED'}.png`;
  }

  function writeProjectPoster(title, id, imageDataUrl) {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) throw new Error('title required');
    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      throw new Error('imageDataUrl must be a data:image URL');
    }
    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const fileName = posterSafeName(cleanTitle);
    const filePath = path.join(postersDir, fileName);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);

    const posterUrl = `/api/project-poster?name=${encodeURIComponent(cleanTitle)}&v=${Date.now()}`;
    const projectFile = path.join(projectsDir, posterSafeName(cleanTitle).replace(/\.png$/i, '.json'));
    let existing = {};
    if (fs.existsSync(projectFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(projectFile, 'utf8')) || {};
      } catch {
        existing = {};
      }
    }
    try {
      loadAssetRootsFs().writeFilmProjectPoster?.(cleanTitle, buffer, existing.assetRoots);
    } catch {
      /* film folder mirror is best-effort */
    }
    const stamped = {
      ...existing,
      id: existing.id || id || `proj_${cleanTitle.replace(/[^\w.-]+/g, '_').toLowerCase()}`,
      title: existing.title || cleanTitle,
      posterUrl,
      posterFile: fileName,
      updatedAt: new Date().toISOString(),
      lastModifiedIso: new Date().toISOString(),
      lastModified: new Date().toLocaleDateString()
    };
    if (!Array.isArray(stamped.shots)) stamped.shots = existing.shots || [];
    fs.writeFileSync(projectFile, JSON.stringify(stamped, null, 2), 'utf8');
    return { filePath, fileName, posterUrl, projectFile };
  }

  function openPathInOs(targetPath) {
    const p = String(targetPath || '').trim();
    if (!p) return { ok: false, error: 'path required' };
    if (process.platform === 'darwin') {
      const res = spawnSync('open', [p], { encoding: 'utf8' });
      if (res.status !== 0) return { ok: false, error: res.stderr || 'open failed' };
      return { ok: true, path: p };
    }
    if (process.platform === 'win32') {
      spawnSync('explorer', [p], { encoding: 'utf8' });
      return { ok: true, path: p };
    }
    spawnSync('xdg-open', [p], { encoding: 'utf8' });
    return { ok: true, path: p };
  }
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
        // --- Server PDF extract (Node pdfjs-legacy) — same path as Vercel /api/extract-pdf ---
        if (req.url && req.url.startsWith('/api/extract-pdf')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
            return;
          }
          try {
            const body = req.method === 'POST' || req.method === 'PUT' ? await readJsonBody(req) : {};
            const fakeReq = { method: req.method, body };
            const fakeRes = {
              statusCode: 200,
              setHeader(k, v) {
                res.setHeader(k, v);
                return this;
              },
              status(code) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              json(payload) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-store');
                res.end(JSON.stringify(payload));
                return this;
              },
              end() {
                res.end();
                return this;
              }
            };
            const extractPdfMod = await import('./api/extract-pdf.js');
            const extractPdfHandler = extractPdfMod.default || extractPdfMod;
            await extractPdfHandler(fakeReq, fakeRes);
          } catch (err) {
            return sendJson(res, 500, {
              success: false,
              code: 'PARSE_FAILED',
              error: err?.message || 'PDF extraction failed'
            });
          }
          return;
        }

        if (req.url && req.url.startsWith('/api/request-access')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
            return;
          }
          try {
            const body = req.method === 'POST' ? await readJsonBody(req) : {};
            const fakeReq = { method: req.method, body };
            const fakeRes = {
              statusCode: 200,
              setHeader(k, v) {
                res.setHeader(k, v);
                return this;
              },
              status(code) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              json(payload) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-store');
                res.end(JSON.stringify(payload));
                return this;
              },
              end() {
                res.end();
                return this;
              }
            };
            const accessMod = await import('./api/request-access.js');
            const accessHandler = accessMod.default || accessMod;
            await accessHandler(fakeReq, fakeRes);
          } catch (err) {
            return sendJson(res, 500, { success: false, error: err?.message || 'Access request failed' });
          }
          return;
        }

        if (req.url && req.url.startsWith('/api/saas')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
            return;
          }
          try {
            const body = req.method === 'POST' ? await readJsonBody(req) : {};
            const fakeReq = { method: req.method, body };
            const fakeRes = {
              statusCode: 200,
              setHeader(k, v) {
                res.setHeader(k, v);
                return this;
              },
              status(code) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              json(payload) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-store');
                res.end(JSON.stringify(payload));
                return this;
              },
              end() {
                res.end();
                return this;
              }
            };
            const saasMod = await import('./api/saas.js');
            const saasHandler = saasMod.default || saasMod;
            await saasHandler(fakeReq, fakeRes);
          } catch (err) {
            return sendJson(res, 500, { success: false, error: err?.message || 'SaaS failed' });
          }
          return;
        }

        if (req.url && req.url.startsWith('/api/generate-video')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.end();
            return;
          }
          try {
            const body = req.method === 'POST' ? await readJsonBody(req) : {};
            let query = {};
            try {
              query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
            } catch {}
            const fakeReq = { method: req.method, body, query, url: req.url };
            const fakeRes = {
              statusCode: 200,
              setHeader(k, v) {
                res.setHeader(k, v);
                return this;
              },
              status(code) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              json(payload) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-store');
                res.end(JSON.stringify(payload));
                return this;
              },
              end() {
                res.end();
                return this;
              }
            };
            const vidMod = await import('./api/generate-video.js');
            const vidHandler = vidMod.default || vidMod;
            await vidHandler(fakeReq, fakeRes);
          } catch (err) {
            return sendJson(res, 500, { success: false, error: err?.message || 'Video generate failed' });
          }
          return;
        }

        if (req.url && req.url.startsWith('/api/generate-image')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.end();
            return;
          }
          try {
            const body = req.method === 'POST' ? await readJsonBody(req) : {};
            const fakeReq = { method: req.method, body };
            const fakeRes = {
              statusCode: 200,
              setHeader(k, v) {
                res.setHeader(k, v);
                return this;
              },
              status(code) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              json(payload) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-store');
                res.end(JSON.stringify(payload));
                return this;
              },
              end() {
                res.end();
                return this;
              }
            };
            const genMod = await import('./api/generate-image.js');
            const genHandler = genMod.default || genMod;
            await genHandler(fakeReq, fakeRes);
          } catch (err) {
            return sendJson(res, 500, { success: false, error: err?.message || 'Generate failed' });
          }
          return;
        }

        if (req.url && req.url.startsWith('/api/stripe-webhook')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');
            res.end();
            return;
          }
          try {
            const rawBody = req.method === 'POST' ? await readRawBody(req) : '';
            const fakeReq = {
              method: req.method,
              rawBody,
              headers: req.headers || {},
              body: rawBody,
            };
            const fakeRes = {
              statusCode: 200,
              setHeader(k, v) {
                res.setHeader(k, v);
                return this;
              },
              status(code) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              json(payload) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-store');
                res.end(JSON.stringify(payload));
                return this;
              },
              end() {
                res.end();
                return this;
              }
            };
            const hookMod = await import('./api/stripe-webhook.js');
            const hookHandler = hookMod.default || hookMod;
            await hookHandler(fakeReq, fakeRes);
          } catch (err) {
            return sendJson(res, 500, { success: false, error: err?.message || 'Webhook failed' });
          }
          return;
        }

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
            const roomId = url.searchParams.get('roomId') || 'sps_local_dev';

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

        // 1b. PROJECT POSTER — separate PNG (avoids huge JSON / Electron IPC failures)
        if (req.url?.startsWith('/api/save-project-poster') && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const result = writeProjectPoster(body?.title, body?.id, body?.imageDataUrl);
            return sendJson(res, 200, { ok: true, ...result });
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message });
          }
        }
        if (req.url === '/api/open-poster-folder' && req.method === 'POST') {
          readJsonBody(req)
            .then((body) => {
              const title = String(body?.projectTitle || body?.title || '').trim();
              if (!title) return sendJson(res, 400, { ok: false, error: 'projectTitle required' });
              const resolved = loadAssetRootsFs().resolvePosterFolderForProject(
                title,
                body?.assetRoots,
                postersDir
              );
              if (!resolved.ok || !resolved.path) {
                return sendJson(res, 404, { ok: false, error: resolved.error || 'not found' });
              }
              const opened = openPathInOs(resolved.path);
              return sendJson(res, opened.ok ? 200 : 500, {
                ok: opened.ok,
                path: resolved.path,
                kind: resolved.kind,
                error: opened.error
              });
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
          return;
        }
        if (req.url?.startsWith('/api/project-poster') && req.method === 'GET') {
          try {
            const u = new URL(req.url, 'http://localhost');
            const name = String(u.searchParams.get('name') || '').trim();
            if (!name) return sendJson(res, 400, { ok: false, error: 'name required' });
            const filePath =
              loadAssetRootsFs().readProjectPosterFilePath?.(name, postersDir) ||
              path.join(postersDir, posterSafeName(name));
            if (!filePath || !fs.existsSync(filePath)) {
              res.statusCode = 404;
              res.end('Not found');
              return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(filePath).pipe(res);
            return;
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message });
          }
        }
        if (req.url === '/api/list-project-posters' && req.method === 'GET') {
          try {
            if (!fs.existsSync(postersDir)) return sendJson(res, 200, { ok: true, posters: [] });
            const posters = fs.readdirSync(postersDir)
              .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
              .map((f) => {
                const titleGuess = f.replace(/\.(png|jpe?g|webp)$/i, '').replace(/_/g, ' ');
                return {
                  fileName: f,
                  title: titleGuess,
                  posterUrl: `/api/project-poster?name=${encodeURIComponent(titleGuess)}`
                };
              });
            return sendJson(res, 200, { ok: true, posters });
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message, posters: [] });
          }
        }

        if (req.url === '/api/ensure-asset-dirs' && req.method === 'POST') {
          readJsonBody(req)
            .then((body) => {
              const result = loadAssetRootsFs().ensureDirs(body?.dirs || []);
              return sendJson(res, result.ok ? 200 : 500, result);
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
          return;
        }

        if (req.url === '/api/resolve-comfy-assets' && req.method === 'POST') {
          readJsonBody(req)
            .then((body) => {
              const slots = loadAssetRootsFs().resolveMany(body?.requests || []);
              return sendJson(res, 200, { ok: true, slots });
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: err.message, slots: [] }));
          return;
        }

        if (req.url === '/api/save-project-version' && req.method === 'POST') {
          readJsonBody(req)
            .then((body) => {
              const dir = String(body?.dir || '').trim();
              const filename = String(body?.filename || '').trim();
              const project = body?.project;
              if (!dir || !filename || !project) {
                return sendJson(res, 400, { ok: false, error: 'dir, filename, and project required' });
              }
              const mkdir = loadAssetRootsFs().ensureDirs([dir]);
              if (!mkdir.ok) return sendJson(res, 500, mkdir);
              const filePath = path.join(dir, filename);
              fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf8');
              // Also write/update latest unversioned copy when filename has _vNNN
              const latest = filename.replace(/_v\d+\.json$/i, '.json');
              if (latest !== filename) {
                try {
                  fs.writeFileSync(path.join(dir, latest), JSON.stringify(project, null, 2), 'utf8');
                } catch {
                  /* ignore */
                }
              }
              return sendJson(res, 200, { ok: true, filePath, filename, dir });
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
          return;
        }

        if (req.url === '/api/discover-film-asset-roots' && req.method === 'POST') {
          readJsonBody(req)
            .then((body) => {
              const title = String(body?.projectTitle || body?.title || '').trim();
              if (!title) return sendJson(res, 400, { ok: false, error: 'projectTitle required' });
              const result = loadAssetRootsFs().discoverFilmAssetRoots(title);
              if (body?.ensure) {
                const dirs = [
                  result.roots.subjects,
                  result.roots.worlds,
                  result.roots.props,
                  result.roots.supporting,
                  result.roots.crowd,
                  result.roots.rendersVideo,
                  result.roots.rendersImage,
                  result.roots.projectSave,
                  result.roots.workflows,
                  result.roots.posters
                ];
                const mkdir = loadAssetRootsFs().ensureDirs(dirs);
                return sendJson(res, mkdir.ok ? 200 : 500, { ...result, ensured: mkdir });
              }
              return sendJson(res, 200, result);
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
          return;
        }

        if (req.url === '/api/open-project-folder' && req.method === 'POST') {
          readJsonBody(req)
            .then((body) => {
              const folderPath = String(body?.folderPath || '').trim();
              if (!folderPath) return sendJson(res, 400, { ok: false, error: 'folderPath required' });
              const fsApi = loadAssetRootsFs();
              const expanded = folderPath.replace(/^~(?=$|[/\\])/, process.env.HOME || '').replace(
                /^~\/(.*)$/,
                (_, rest) => path.join(process.env.HOME || '', rest)
              );
              const opened = fsApi.openProjectFolderAtPath(expanded);
              if (!opened?.ok) return sendJson(res, 400, opened);
              const project = opened.project;
              if (project?._posterBufferBase64 && project.title) {
                try {
                  const postersDir = path.join(projectsDir, 'posters');
                  if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true });
                  const fileName = `${String(project.title).trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'UNTITLED'}.png`;
                  fs.writeFileSync(path.join(postersDir, fileName), Buffer.from(project._posterBufferBase64, 'base64'));
                  project.posterUrl = `/api/project-poster?name=${encodeURIComponent(project.title)}&v=${Date.now()}`;
                } catch {
                  /* optional */
                }
                delete project._posterBufferBase64;
                delete project.posterFileHint;
              }
              return sendJson(res, 200, { ...opened, project });
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
          return;
        }

        if (req.url === '/api/ensure-placeholder-pngs' && req.method === 'POST') {
          readJsonBody(req)
            .then((body) => {
              const entries = Array.isArray(body?.entries) ? body.entries : [];
              const result = loadAssetRootsFs().ensurePlaceholderPngs(entries);
              return sendJson(res, result.ok ? 200 : 500, result);
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
          return;
        }

        if (req.url === '/api/save-text-files' && req.method === 'POST') {
          readJsonBody(req)
            .then((body) => {
              const dir = String(body?.dir || '').trim();
              const files = Array.isArray(body?.files) ? body.files : [];
              if (!dir || !files.length) {
                return sendJson(res, 400, { ok: false, error: 'dir and files[] required' });
              }
              const mkdir = loadAssetRootsFs().ensureDirs([dir]);
              if (!mkdir.ok) return sendJson(res, 500, mkdir);
              const written = [];
              for (const f of files) {
                const name = String(f?.name || '')
                  .replace(/[/\\]/g, '_')
                  .trim();
                if (!name) continue;
                const content = typeof f.content === 'string' ? f.content : JSON.stringify(f.content ?? {}, null, 2);
                const filePath = path.join(dir, name);
                fs.writeFileSync(filePath, content, 'utf8');
                written.push({ name, filePath });
              }
              return sendJson(res, 200, { ok: true, dir, written, count: written.length });
            })
            .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
          return;
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
              const stamped = {
                ...project,
                updatedAt: project.updatedAt || new Date().toISOString(),
                lastModifiedIso: new Date().toISOString()
              };

              fs.writeFileSync(filePath, JSON.stringify(stamped, null, 2), 'utf8');

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

        // 5. ACTIVE WORKSPACE POINTER (shared by browser + Electron on same machine)
        if (req.url === '/api/active-workspace-disk' && req.method === 'GET') {
          try {
            const filePath = path.join(settingsDir, 'active_workspace.json');
            if (fs.existsSync(filePath)) {
              const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              return sendJson(res, 200, { ok: true, workspace: parsed });
            }
            return sendJson(res, 200, { ok: true, workspace: null });
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message });
          }
        }
        if (req.url === '/api/active-workspace-disk' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const workspace = {
              title: String(body?.title || '').trim(),
              roomId: String(body?.roomId || '').trim(),
              updatedAt: new Date().toISOString()
            };
            if (!workspace.title) return sendJson(res, 400, { ok: false, error: 'title required' });
            fs.writeFileSync(
              path.join(settingsDir, 'active_workspace.json'),
              JSON.stringify(workspace, null, 2),
              'utf8'
            );
            return sendJson(res, 200, { ok: true, workspace });
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message });
          }
        }

        // 5b. FACTORY RESET — flush app vault / optional settings; never delete film folders
        if (req.url === '/api/factory-reset' && req.method === 'OPTIONS') {
          return sendJson(res, 204, {});
        }
        if (req.url === '/api/factory-reset' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const { runDiskFactoryReset } = require('./src/utils/factoryResetFs.cjs');
            const result = runDiskFactoryReset({
              projectsDir,
              settingsDir,
              flushSettings: Boolean(body?.flushSettings)
            });
            return sendJson(res, result.ok ? 200 : 400, result);
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message });
          }
        }

        // 6. UI PREFS (theme + desk) — shared so Electron mirrors localhost
        if (req.url === '/api/ui-prefs-disk' && req.method === 'GET') {
          try {
            const filePath = path.join(settingsDir, 'ui_prefs.json');
            if (fs.existsSync(filePath)) {
              return sendJson(res, 200, { ok: true, prefs: JSON.parse(fs.readFileSync(filePath, 'utf8')) });
            }
            return sendJson(res, 200, { ok: true, prefs: null });
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message });
          }
        }
        if (req.url === '/api/ui-prefs-disk' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const filePath = path.join(settingsDir, 'ui_prefs.json');
            let prev = {};
            try {
              if (fs.existsSync(filePath)) prev = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
            } catch {
              prev = {};
            }
            const colorTheme =
              body?.colorTheme === 'dark' || body?.colorTheme === 'paper'
                ? body.colorTheme
                : prev.colorTheme;
            const activeView =
              typeof body?.activeView === 'string' && body.activeView.trim()
                ? body.activeView.trim()
                : prev.activeView;
            const merged = {
              ...prev,
              ...body,
              colorTheme,
              activeView,
              updatedAt: new Date().toISOString()
            };
            fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
            return sendJson(res, 200, { ok: true, prefs: merged });
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: err.message });
          }
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
    host: true,
    port: 5173,
    strictPort: true,
    // Allow Cloudflare quick tunnels + LAN hostnames for remote browser collab
    allowedHosts: true,
    // Same-origin proxy — ComfyUI ≥0.19 returns 403 when Origin is Vite and Host is :8188
    proxy: {
      '/api/comfyui': {
        target: 'http://127.0.0.1:8188',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/api\/comfyui/, '') || '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Host', '127.0.0.1:8188');
            proxyReq.setHeader('Origin', 'http://127.0.0.1:8188');
            proxyReq.removeHeader('referer');
          });
        }
      }
    },
    watch: {
      // Electron builds + docs thrash the watcher and force full reloads → splash/login loops
      ignored: [
        '**/projects/**',
        '**/settings/**',
        '**/storage/**',
        '**/storage/cloud/**',
        '**/release/**',
        '**/dist/**',
        '**/docs/**',
        '**/.vercel/**',
        '**/node_modules/**'
      ]
    }
  }
})
