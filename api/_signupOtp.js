/**
 * Public signup OTP — emailed only. Never returned to the browser.
 * Durable on Upstash KV; local fs for Vite.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KV_KEY = 'sps:signupOtps';
const TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

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

function fsPath() {
  return path.join(process.cwd(), 'storage', 'cloud', 'signup-otps.json');
}

let memory = {};

function hashOtp(email, otp) {
  return crypto.createHash('sha256').update(`${email}:${otp}`).digest('hex');
}

async function kvGet() {
  const url = kvRestUrl();
  const token = kvRestToken();
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', KV_KEY]),
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.result;
    if (!raw) return {};
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function kvSet(map) {
  const url = kvRestUrl();
  const token = kvRestToken();
  if (!url || !token) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', KV_KEY, JSON.stringify(map)]),
      cache: 'no-store'
    });
    return res.ok;
  } catch {
    return false;
  }
}

function fsRead() {
  try {
    if (!fs.existsSync(fsPath())) return null;
    const parsed = JSON.parse(fs.readFileSync(fsPath(), 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return null;
  }
}

function fsWrite(map) {
  try {
    fs.mkdirSync(path.dirname(fsPath()), { recursive: true });
    fs.writeFileSync(fsPath(), JSON.stringify(map, null, 2));
    return true;
  } catch {
    return false;
  }
}

async function loadMap() {
  const kv = await kvGet();
  if (kv && typeof kv === 'object') {
    memory = kv;
    return kv;
  }
  const disk = fsRead();
  if (disk) {
    memory = disk;
    return disk;
  }
  return memory;
}

async function saveMap(map) {
  memory = map;
  const ok = await kvSet(map);
  if (!ok) fsWrite(map);
}

function prune(map) {
  const now = Date.now();
  const next = {};
  for (const [email, row] of Object.entries(map || {})) {
    if (row && Number(row.expiresAt) > now) next[email] = row;
  }
  return next;
}

export function randomOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function issueSignupOtp(email, { name = '' } = {}) {
  const clean = String(email || '').trim().toLowerCase();
  const map = prune(await loadMap());
  const prev = map[clean];
  if (prev && Date.now() - Number(prev.issuedAt || 0) < 60_000) {
    const err = new Error('Wait a minute before requesting another code.');
    err.code = 'RATE';
    throw err;
  }
  const otp = randomOtp();
  map[clean] = {
    hash: hashOtp(clean, otp),
    name: String(name || '').slice(0, 120),
    expiresAt: Date.now() + TTL_MS,
    issuedAt: Date.now(),
    attempts: 0
  };
  await saveMap(map);
  return otp;
}

export async function verifySignupOtp(email, otp) {
  const clean = String(email || '').trim().toLowerCase();
  const code = String(otp || '').trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit code from your email.' };
  const map = prune(await loadMap());
  const row = map[clean];
  if (!row) return { ok: false, error: 'Code expired. Send a new one.' };
  row.attempts = (row.attempts || 0) + 1;
  if (row.attempts > MAX_ATTEMPTS) {
    delete map[clean];
    await saveMap(map);
    return { ok: false, error: 'Too many tries. Send a new code.' };
  }
  const expected = String(row.hash || '');
  const got = hashOtp(clean, code);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(got, 'utf8');
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    await saveMap(map);
    return { ok: false, error: 'That code does not match. Check your email.' };
  }
  delete map[clean];
  await saveMap(map);
  return { ok: true, name: row.name || '' };
}
