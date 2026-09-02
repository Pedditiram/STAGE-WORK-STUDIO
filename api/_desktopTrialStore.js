/**
 * Durable desktop-trial request queue.
 * Prefer KV (same as guest-access / sync). Local fs for Vite.
 * Never stores the Electron binary — only GitHub/release HTTPS URL + tokens.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KV_KEY = 'sps:desktopTrial';
const MAX_REQUESTS = 400;
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DOWNLOADS = 8;

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

export function kvConfigured() {
  return Boolean(kvRestUrl() && kvRestToken());
}

function fsPath() {
  return path.join(process.cwd(), 'storage', 'cloud', 'desktop-trial.json');
}

function emptyState() {
  return { requests: [], releaseUrl: '', updatedAt: null };
}

let memoryState = emptyState();

async function kvGet() {
  const url = kvRestUrl();
  const token = kvRestToken();
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', KV_KEY]),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.result;
    if (raw == null || raw === '') return emptyState();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return emptyState();
    if (!Array.isArray(parsed.requests)) parsed.requests = [];
    return parsed;
  } catch {
    return null;
  }
}

async function kvSet(state) {
  const url = kvRestUrl();
  const token = kvRestToken();
  if (!url || !token) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', KV_KEY, JSON.stringify(state)]),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

function fsRead() {
  try {
    const p = fsPath();
    if (!fs.existsSync(p)) return null;
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return emptyState();
    if (!Array.isArray(parsed.requests)) parsed.requests = [];
    return parsed;
  } catch {
    return null;
  }
}

function fsWrite(state) {
  try {
    const p = fsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state, null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function readTrialState() {
  const kv = await kvGet();
  if (kv) return { state: kv, backend: 'kv' };
  const disk = fsRead();
  if (disk) {
    memoryState = disk;
    return { state: disk, backend: 'fs' };
  }
  return { state: memoryState, backend: memoryState.requests.length ? 'memory' : 'empty' };
}

export async function writeTrialState(state) {
  const next = {
    requests: (state.requests || []).slice(0, MAX_REQUESTS),
    releaseUrl: String(state.releaseUrl || ''),
    updatedAt: new Date().toISOString(),
  };
  memoryState = next;
  const kvOk = await kvSet(next);
  const fsOk = fsWrite(next);
  return { backend: kvOk ? 'kv' : fsOk ? 'fs' : 'memory', durable: kvOk || fsOk };
}

export function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw || '')).digest('hex');
}

export function mintDownloadToken() {
  const raw = crypto.randomBytes(24).toString('hex');
  return {
    raw,
    hash: hashToken(raw),
    exp: Date.now() + TOKEN_TTL_MS,
  };
}

export function envReleaseUrl() {
  return String(process.env.SPS_DESKTOP_RELEASE_URL || '').trim();
}

export function resolveReleaseUrl(state) {
  return String(state?.releaseUrl || envReleaseUrl() || '').trim();
}

export function isHttpsUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export { TOKEN_TTL_MS, MAX_DOWNLOADS };
