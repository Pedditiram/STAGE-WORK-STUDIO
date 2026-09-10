/**
 * Studio admin key for server mutations (grant credits, guest URL, OTP email).
 * Stored only on this device. Never synced to the cloud library.
 */

const KEY = 'sps_admin_secret';

export function getStudioAdminSecret() {
  if (typeof window === 'undefined') return '';
  try {
    return String(localStorage.getItem(KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setStudioAdminSecret(value) {
  if (typeof window === 'undefined') return '';
  const next = String(value || '').trim();
  try {
    if (next) localStorage.setItem(KEY, next);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return next;
}

export function saasAdminHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const secret = getStudioAdminSecret();
  if (secret) headers['X-SPS-Admin'] = secret;
  return headers;
}

export function withSaasAdminBody(body = {}) {
  const secret = getStudioAdminSecret();
  if (!secret) return { ...body };
  return { ...body, adminSecret: secret };
}
