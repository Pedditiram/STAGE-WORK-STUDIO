/**
 * Collaborator / Editor studio password (after Admin grant).
 * Hash + salt live on the collaborator record and sync with the cloud list.
 * Never store plaintext. Owner emails keep the existing Admin / email login.
 */

import { normalizeEmail, PRIMARY_ADMIN_EMAILS } from './projectPermissions';
import { scheduleCollaboratorsCloudSync } from '../services/dbService';

export const COLLAB_PASSWORD_MIN = 10;
export const COLLAB_PASSWORD_ALGO = 'sha256-v1';

const WEAK = new Set([
  'admin', 'admin123', 'password', 'password123', 'sps2026', 'studio2026',
  '1234567890', 'qwerty1234', 'collaborator', 'editor1234'
]);

export function isOwnerLoginEmail(email) {
  const clean = normalizeEmail(email);
  return PRIMARY_ADMIN_EMAILS.includes(clean);
}

export function isStrongCollaboratorPassword(pass) {
  const p = String(pass || '');
  if (p.length < COLLAB_PASSWORD_MIN) return false;
  return !WEAK.has(p.toLowerCase());
}

export function collaboratorPasswordHint() {
  return `At least ${COLLAB_PASSWORD_MIN} characters. Do not use admin, password, sps2026, or similar defaults.`;
}

export function collaboratorHasPassword(user) {
  if (!user || typeof user !== 'object') return false;
  return Boolean(String(user.passwordHash || '').trim() && String(user.passwordSalt || '').trim());
}

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSaltHex() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return toHex(bytes);
}

async function sha256Hex(text) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Secure hashing is not available in this browser.');
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(new Uint8Array(buf));
}

export async function hashCollaboratorPassword(password, salt = randomSaltHex()) {
  const hash = await sha256Hex(`${COLLAB_PASSWORD_ALGO}:${salt}:${String(password || '')}`);
  return { salt, hash, algo: COLLAB_PASSWORD_ALGO };
}

export async function verifyCollaboratorPassword(user, password) {
  if (!collaboratorHasPassword(user)) return false;
  const salt = String(user.passwordSalt || '');
  const algo = String(user.passwordAlgo || COLLAB_PASSWORD_ALGO);
  const expected = String(user.passwordHash || '');
  const hash = await sha256Hex(`${algo}:${salt}:${String(password || '')}`);
  return hash === expected;
}

function readUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sps_authorized_phone_users', JSON.stringify(users));
  window.dispatchEvent(new CustomEvent('sps_collaborators_updated', { detail: { source: 'collaboratorPassword' } }));
  scheduleCollaboratorsCloudSync();
}

export function findAuthorizedUser(email) {
  const clean = normalizeEmail(email);
  if (!clean) return null;
  return readUsers().find((u) => normalizeEmail(u?.email) === clean) || null;
}

export async function setCollaboratorPassword(email, password) {
  const clean = normalizeEmail(email);
  if (!clean) return { ok: false, error: 'Email is required.' };
  if (isOwnerLoginEmail(clean)) {
    return { ok: false, error: 'Studio Admin uses Admin Settings for the Admin password.' };
  }
  if (!isStrongCollaboratorPassword(password)) {
    return { ok: false, error: collaboratorPasswordHint() };
  }
  const minted = await hashCollaboratorPassword(password);
  const users = readUsers();
  const idx = users.findIndex((u) => normalizeEmail(u?.email) === clean);
  if (idx < 0) {
    return { ok: false, error: 'Email is not on the studio list. Ask Admin for an invite first.' };
  }
  users[idx] = {
    ...users[idx],
    passwordHash: minted.hash,
    passwordSalt: minted.salt,
    passwordAlgo: minted.algo,
    passwordSetAt: new Date().toISOString()
  };
  delete users[idx].password;
  writeUsers(users);
  return { ok: true };
}

export function clearCollaboratorPassword(email) {
  const clean = normalizeEmail(email);
  if (!clean || isOwnerLoginEmail(clean)) return { ok: false, error: 'Cannot reset this account here.' };
  const users = readUsers();
  const idx = users.findIndex((u) => normalizeEmail(u?.email) === clean);
  if (idx < 0) return { ok: false, error: 'User not found.' };
  const next = { ...users[idx] };
  delete next.passwordHash;
  delete next.passwordSalt;
  delete next.passwordAlgo;
  delete next.passwordSetAt;
  delete next.password;
  users[idx] = next;
  writeUsers(users);
  return { ok: true };
}
