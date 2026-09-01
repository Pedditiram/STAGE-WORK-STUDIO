/**
 * Google Drive project vault — works alongside local library.
 * Uses Google Identity Services + Drive API v3 (drive.file scope).
 */

import { buildProjectPackage } from './projectDiskVault';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID_KEY = 'sps_google_drive_client_id';
const ROOT_ID_KEY = 'sps_google_drive_root_id';
const ROOT_NAME_KEY = 'sps_google_drive_root_name';
const USER_FOLDER_ID_KEY = 'sps_google_drive_user_folder_id';
const USER_FOLDER_NAME_KEY = 'sps_google_drive_user_folder_name';
const PROJECT_FOLDERS_KEY = 'sps_google_drive_project_folders';
const TOKEN_KEY = 'sps_google_drive_token';
const EMAIL_KEY = 'sps_google_drive_email';
const DEFAULT_ROOT_NAME = 'Stage Work Studio';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export function getDriveClientId() {
  try {
    return String(localStorage.getItem(CLIENT_ID_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function isValidDriveClientId(id) {
  const v = String(id || '').trim();
  if (!v) return false;
  if (v.includes('@')) return false;
  return /\.apps\.googleusercontent\.com$/i.test(v);
}

export function explainDriveClientIdError(id) {
  const v = String(id || '').trim();
  if (!v) return 'Paste the OAuth Client ID from Google Cloud (ends with .apps.googleusercontent.com). A Gmail address will not work.';
  if (v.includes('@')) {
    return 'That is a Gmail address, not a Client ID. In Google Cloud Console create a Web application OAuth client, then paste the ID that ends with .apps.googleusercontent.com.';
  }
  if (!/\.apps\.googleusercontent\.com$/i.test(v)) {
    return 'Client ID must end with .apps.googleusercontent.com. Google error 401 invalid_client means this value is not a real OAuth client.';
  }
  return '';
}

export function setDriveClientId(id) {
  try {
    localStorage.setItem(CLIENT_ID_KEY, String(id || '').trim());
  } catch {
    /* ignore */
  }
}

export function getDriveAccountEmail() {
  try {
    return String(localStorage.getItem(EMAIL_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function isDriveConnected() {
  return Boolean(readCachedToken() && getDriveClientId());
}

export function getDriveRootFolderId() {
  try {
    return String(localStorage.getItem(ROOT_ID_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setDriveRootFolderId(id) {
  try {
    localStorage.setItem(ROOT_ID_KEY, String(id || '').trim());
    localStorage.removeItem(USER_FOLDER_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function getDriveRootFolderName() {
  try {
    return String(localStorage.getItem(ROOT_NAME_KEY) || DEFAULT_ROOT_NAME).trim() || DEFAULT_ROOT_NAME;
  } catch {
    return DEFAULT_ROOT_NAME;
  }
}

export function setDriveRootFolderName(name) {
  try {
    const next = String(name || DEFAULT_ROOT_NAME).trim() || DEFAULT_ROOT_NAME;
    localStorage.setItem(ROOT_NAME_KEY, next);
    localStorage.removeItem(USER_FOLDER_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function getDriveUserFolderName() {
  try {
    return String(localStorage.getItem(USER_FOLDER_NAME_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function getDrivePathLabel() {
  const root = getDriveRootFolderName();
  const user = getDriveUserFolderName();
  return user ? `${root} / ${user}` : root;
}

function escapeDriveQuery(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function resolveUserFolderName(driveEmail = '') {
  let studioEmail = '';
  let displayName = '';
  try {
    studioEmail = String(localStorage.getItem('sps_authorized_user_email') || '').trim();
    const users = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
    const hit = Array.isArray(users)
      ? users.find((u) => String(u?.email || '').trim().toLowerCase() === studioEmail.toLowerCase())
      : null;
    displayName = String(hit?.name || '').trim();
  } catch {
    /* ignore */
  }
  const email = studioEmail || driveEmail || 'studio';
  const base = displayName || email.split('@')[0] || 'user';
  return base.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
}

function readCachedToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token || Date.now() >= Number(parsed.exp || 0)) return '';
    return parsed.access_token;
  } catch {
    return '';
  }
}

function writeCachedToken(accessToken, expiresIn) {
  const exp = Date.now() + Math.max(60, Number(expiresIn) || 3600) * 1000 - 30_000;
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: accessToken, exp }));
}

function loadGis() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Drive needs a browser.'));
      return;
    }
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(script);
  });
}

async function requestToken(interactive = true) {
  const clientId = getDriveClientId();
  const idError = explainDriveClientIdError(clientId);
  if (idError) throw new Error(idError);
  await loadGis();
  return new Promise((resolve, reject) => {
    const fail = (raw) => {
      const text = String(raw || '');
      if (/invalid_client|missing a project id|401/i.test(text)) {
        reject(new Error(explainDriveClientIdError(clientId) || 'Google rejected this Client ID (401 invalid_client).'));
        return;
      }
      if (/popup_closed|Popup window closed/i.test(text)) {
        reject(new Error('Google window closed before sign-in finished. Check the Client ID, then try Connect again.'));
        return;
      }
      reject(new Error(text || 'Google Drive sign-in failed.'));
    };
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp?.error || !resp?.access_token) {
          fail(resp?.error_description || resp?.error);
          return;
        }
        writeCachedToken(resp.access_token, resp.expires_in);
        resolve(resp.access_token);
      },
      error_callback: (err) => fail(err?.message || err?.type),
    });
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

async function getToken(interactive = true) {
  const cached = readCachedToken();
  if (cached) return cached;
  return requestToken(interactive);
}

async function driveFetch(url, options = {}, { retry = true } = {}) {
  const token = await getToken(!retry);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && retry) {
    sessionStorage.removeItem(TOKEN_KEY);
    const fresh = await requestToken(true);
    const again = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${fresh}`,
        ...(options.headers || {}),
      },
    });
    if (!again.ok) {
      const text = await again.text();
      throw new Error(text.slice(0, 280) || `Drive error ${again.status}`);
    }
    return again;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 280) || `Drive error ${res.status}`);
  }
  return res;
}

async function readAboutEmail() {
  const res = await driveFetch(`${DRIVE}/about?fields=user(emailAddress,displayName)`);
  const json = await res.json();
  const email = json?.user?.emailAddress || '';
  try {
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* ignore */
  }
  return email;
}

async function findOrCreateFolder(name, parentId) {
  const safe = escapeDriveQuery(name);
  const parent = parentId || 'root';
  const q = encodeURIComponent(
    `name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parent}' in parents`
  );
  const list = await driveFetch(`${DRIVE}/files?q=${q}&spaces=drive&fields=files(id,name)`);
  const found = (await list.json()).files?.[0];
  if (found?.id) return found.id;
  const created = await driveFetch(`${DRIVE}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parent],
    }),
  });
  const json = await created.json();
  return json.id;
}

async function ensureRootFolder() {
  const givenId = getDriveRootFolderId();
  if (givenId) {
    try {
      const res = await driveFetch(`${DRIVE}/files/${givenId}?fields=id,name,mimeType,trashed`);
      const meta = await res.json();
      if (meta?.id && !meta.trashed) {
        try {
          localStorage.setItem(ROOT_NAME_KEY, meta.name || getDriveRootFolderName());
        } catch {
          /* ignore */
        }
        return meta.id;
      }
    } catch {
      /* fall through and create named location */
    }
  }
  const rootName = getDriveRootFolderName();
  const id = await findOrCreateFolder(rootName, 'root');
  try {
    localStorage.setItem(ROOT_ID_KEY, id);
    localStorage.setItem(ROOT_NAME_KEY, rootName);
  } catch {
    /* ignore */
  }
  return id;
}

async function ensureUserFolder(driveEmail = '') {
  try {
    const saved = localStorage.getItem(USER_FOLDER_ID_KEY);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  const rootId = await ensureRootFolder();
  const userName = resolveUserFolderName(driveEmail || getDriveAccountEmail());
  const userId = await findOrCreateFolder(userName, rootId);
  try {
    localStorage.setItem(USER_FOLDER_ID_KEY, userId);
    localStorage.setItem(USER_FOLDER_NAME_KEY, userName);
  } catch {
    /* ignore */
  }
  return userId;
}

export function projectDriveKey(title) {
  return String(title || 'Untitled').trim().toUpperCase() || 'UNTITLED';
}

export function projectFolderName(title) {
  return (String(title || 'Untitled').trim() || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
}

function readProjectFolderMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECT_FOLDERS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeProjectFolderMap(map) {
  try {
    localStorage.setItem(PROJECT_FOLDERS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getProjectDriveRecord(title) {
  return readProjectFolderMap()[projectDriveKey(title)] || null;
}

export function getProjectDrivePath(title) {
  const rec = getProjectDriveRecord(title);
  const root = getDriveRootFolderName();
  const user = getDriveUserFolderName() || 'user';
  const folder = rec?.name || projectFolderName(title);
  return `${root} / ${user} / ${folder}`;
}

export async function ensureProjectFolder(project) {
  const title = project?.title || 'Untitled';
  const key = projectDriveKey(title);
  const map = readProjectFolderMap();
  if (map[key]?.id) return map[key];
  const userId = await ensureUserFolder();
  const name = projectFolderName(title);
  const id = await findOrCreateFolder(name, userId);
  const meta = await driveFetch(`${DRIVE}/files/${id}?fields=id,name,webViewLink`);
  const json = await meta.json();
  const rec = {
    id: json.id,
    name: json.name || name,
    webViewLink: json.webViewLink || '',
    updatedAt: Date.now(),
  };
  map[key] = rec;
  writeProjectFolderMap(map);
  window.dispatchEvent(new Event('sps_google_drive_changed'));
  return rec;
}

export async function connectGoogleDrive(project = null) {
  await getToken(true);
  const email = await readAboutEmail();
  await ensureUserFolder(email);
  if (project?.title) await ensureProjectFolder(project);
  window.dispatchEvent(new Event('sps_google_drive_changed'));
  return email;
}

export function disconnectGoogleDrive() {
  const token = readCachedToken();
  if (token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch {
      /* ignore */
    }
  }
  sessionStorage.removeItem(TOKEN_KEY);
  try {
    localStorage.removeItem(USER_FOLDER_ID_KEY);
    localStorage.removeItem(USER_FOLDER_NAME_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('sps_google_drive_changed'));
}

export async function listDriveProjects(project = null) {
  const folderId = project?.title
    ? (await ensureProjectFolder(project)).id
    : await ensureUserFolder();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await driveFetch(
    `${DRIVE}/files?q=${q}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,modifiedTime,webViewLink,iconLink,size)`
  );
  const json = await res.json();
  return Array.isArray(json.files) ? json.files : [];
}

export async function pushProjectToDrive(project) {
  if (!project) throw new Error('No project to upload.');
  const { packageData, driveName } = buildProjectPackage(project);
  const folderId = (await ensureProjectFolder(project)).id;
  const body = JSON.stringify(packageData, null, 2);
  const q = encodeURIComponent(`name='${driveName}' and '${folderId}' in parents and trashed=false`);
  const existingRes = await driveFetch(`${DRIVE}/files?q=${q}&fields=files(id)`);
  const existing = (await existingRes.json()).files?.[0];
  const metadata = {
    name: driveName,
    mimeType: 'application/json',
    parents: existing ? undefined : [folderId],
    appProperties: { sps: '1', title: String(project.title || '') },
  };
  const boundary = `sps_${Date.now()}`;
  const multipart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(existing ? { name: driveName, mimeType: 'application/json', appProperties: metadata.appProperties } : metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    body,
    `--${boundary}--`,
  ].join('\r\n');
  const url = existing
    ? `${UPLOAD}/${existing.id}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`
    : `${UPLOAD}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`;
  const res = await driveFetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  return res.json();
}

export async function pullProjectFromDrive(fileId) {
  const res = await driveFetch(`${DRIVE}/files/${fileId}?alt=media`);
  const parsed = await res.json();
  const project = parsed.project || parsed;
  if (!project || !Array.isArray(project.shots)) {
    throw new Error('That Drive file is not a Stage Work Studio project pack.');
  }
  return project;
}

export async function shareProjectFolder(project) {
  const rec = await ensureProjectFolder(project);
  return shareDriveFile(rec.id);
}

export async function shareDriveFile(fileId) {
  await driveFetch(`${DRIVE}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
  });
  const meta = await driveFetch(`${DRIVE}/files/${fileId}?fields=id,name,webViewLink`);
  return meta.json();
}
