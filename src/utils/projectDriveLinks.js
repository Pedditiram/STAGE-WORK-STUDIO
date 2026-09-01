const STORE_KEY = 'sps_project_drive_share_links';

function keyFor(title) {
  return String(title || 'Untitled').trim().toUpperCase() || 'UNTITLED';
}

function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('sps_google_drive_changed'));
  } catch {
    /* ignore */
  }
}

export function normalizeDriveShareUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const match = text.match(/https?:\/\/(?:drive|docs)\.google\.com\/[^\s]+/i);
  return (match ? match[0] : text).replace(/[.,;)]+$/, '');
}

export function getProjectDriveShare(title) {
  return readAll()[keyFor(title)] || { url: '', email: '' };
}

export function hasProjectDriveShare(title) {
  return Boolean(getProjectDriveShare(title).url);
}

export function saveProjectDriveShare(title, { url, email }) {
  const map = readAll();
  map[keyFor(title)] = {
    url: normalizeDriveShareUrl(url),
    email: String(email || '').trim().toLowerCase(),
    updatedAt: Date.now(),
  };
  writeAll(map);
  return map[keyFor(title)];
}

export function clearProjectDriveShare(title) {
  const map = readAll();
  delete map[keyFor(title)];
  writeAll(map);
}
