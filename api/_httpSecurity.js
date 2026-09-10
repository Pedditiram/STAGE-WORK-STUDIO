/**
 * Shared HTTP guards for public APIs.
 * CORS is origin-reflect only. Admin mutations need SPS_ADMIN_SECRET on Vercel.
 */
import crypto from 'crypto';
import { isOwner } from './_saasLedger.js';

export const STUDIO_ORIGINS = [
  'https://www.stageworkstudio.com',
  'https://stageworkstudio.com',
];

const BYTEPLUS_HOSTS = new Set([
  'ark.ap-southeast.bytepluses.com',
  'ark.cn-beijing.volces.com',
  'ark.ap-southeast.volces.com',
  'ark.ap-southeast-1.bytepluses.com',
]);

const rateHits = new Map();

export function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function clientIp(req) {
  const fwd = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return fwd || String(req.socket?.remoteAddress || req.headers?.['x-real-ip'] || 'unknown');
}

export function requestOrigin(req) {
  return String(req.headers?.origin || '').trim();
}

export function isLocalDevHost(host) {
  const h = String(host || '').toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.startsWith('localhost:') ||
    h.startsWith('127.0.0.1:')
  );
}

export function isAllowedOrigin(origin) {
  const o = String(origin || '').trim();
  if (!o) return false;
  if (o === 'null') return true;
  if (STUDIO_ORIGINS.includes(o)) return true;
  try {
    const u = new URL(o);
    if (u.protocol === 'http:' && isLocalDevHost(u.host)) return true;
    if (u.protocol === 'https:' && (u.hostname === 'stageworkstudio.com' || u.hostname.endsWith('.stageworkstudio.com'))) {
      return true;
    }
    if (u.protocol === 'https:' && u.hostname.endsWith('.vercel.app')) return true;
    if (u.protocol === 'app:' || u.protocol === 'file:') return true;
  } catch {
    return false;
  }
  return false;
}

export function allowlistedCheckoutOrigin(raw) {
  const origin = String(raw || '').replace(/\/$/, '');
  if (isAllowedOrigin(origin) && origin !== 'null') return origin;
  return 'https://www.stageworkstudio.com';
}

export function applyCors(req, res, { methods = 'GET, POST, OPTIONS' } = {}) {
  const origin = requestOrigin(req);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-SPS-Admin, If-None-Match, If-Modified-Since, X-Requested-With, Cache-Control, Pragma, Stripe-Signature'
  );
  res.setHeader('Access-Control-Expose-Headers', 'ETag');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
  if (!origin) return false;
  if (!isAllowedOrigin(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  return true;
}

export function rateLimit(key, max, windowMs = 60_000) {
  const k = String(key || 'anon');
  const now = Date.now();
  const arr = (rateHits.get(k) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    const waitSec = Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000));
    return { ok: false, waitSec, max };
  }
  arr.push(now);
  rateHits.set(k, arr);
  return { ok: true, remaining: max - arr.length, max };
}

export function adminSecretConfigured() {
  return Boolean(String(process.env.SPS_ADMIN_SECRET || '').trim());
}

function providedAdminSecret(req, body = {}) {
  return String(req.headers?.['x-sps-admin'] || body.adminSecret || '').trim();
}

/**
 * Owner mutations. On Vercel, SPS_ADMIN_SECRET is required (spoofed actor email is not enough).
 * Local Vite without the env still accepts an owner actor so the desk keeps working.
 */
export function requireStudioAdmin(req, body = {}) {
  const actor = String(body.actor || body.email || '').trim().toLowerCase();
  const secret = String(process.env.SPS_ADMIN_SECRET || '').trim();
  const provided = providedAdminSecret(req, body);
  if (secret) {
    if (!provided || !timingSafeEqualStr(secret, provided)) {
      return { ok: false, status: 403, error: 'Studio admin key required.' };
    }
    return { ok: true, actor: isOwner(actor) ? actor : 'admin' };
  }
  if (process.env.VERCEL) {
    return {
      ok: false,
      status: 503,
      error: 'SPS_ADMIN_SECRET is not configured on the server.',
    };
  }
  if (!isOwner(actor)) {
    return { ok: false, status: 403, error: 'Only the studio admin can do this.' };
  }
  return { ok: true, actor };
}

export function assertByteplusEndpoint(endpointUrl, fallback = 'https://ark.ap-southeast.bytepluses.com/api/v3') {
  const raw = String(endpointUrl || fallback || '').trim() || fallback;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid generation endpoint.' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Generation endpoint must be https.' };
  }
  if (!BYTEPLUS_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { ok: false, error: 'Generation endpoint is not an allowed BytePlus host.' };
  }
  return { ok: true, hostBase: `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '') };
}
