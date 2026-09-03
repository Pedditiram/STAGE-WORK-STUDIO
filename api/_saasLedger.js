import fs from 'fs';
import path from 'path';

export const OWNER_EMAIL = 'admin@stageworkstudio.com';
export const OWNER_EMAILS = ['admin@stageworkstudio.com', 'pedditiram@gmail.com'];
export function isOwner(email) {
  const clean = String(email || '').trim().toLowerCase();
  return clean === OWNER_EMAIL || clean === 'pedditiram@gmail.com' || OWNER_EMAILS.includes(clean);
}

export const CREDIT_PACKS = [
  { id: 'pack_100', credits: 100, usd: 9, label: '100 credits' },
  { id: 'pack_500', credits: 500, usd: 39, label: '500 credits' },
  { id: 'pack_2000', credits: 2000, usd: 129, label: '2,000 credits' },
];

const PLAN_RATE = {
  trial: 2,
  creator: 6,
  pro: 12,
  production: 20,
  studio: 30,
  enterprise: 60,
};

const rateHits = new Map();

export function ledgerPath() {
  return path.join(process.cwd(), 'storage', 'cloud', 'saas-licenses.json');
}

export function readLedger() {
  try {
    const p = ledgerPath();
    if (!fs.existsSync(p)) return [];
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function writeLedger(list) {
  try {
    const dir = path.dirname(ledgerPath());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ledgerPath(), JSON.stringify(list.slice(0, 500), null, 2));
  } catch {
    /* read-only hosts */
  }
}

export function getOrCreateRow(email) {
  const clean = String(email || '').trim().toLowerCase();
  const list = readLedger();
  const idx = list.findIndex((l) => l.email === clean);
  const row = idx >= 0
    ? list[idx]
    : {
        email: clean,
        plan: isOwner(clean) ? 'enterprise' : 'studio',
        status: 'ACTIVE',
        apiMode: 'byok',
        credits: isOwner(clean) ? 999999 : 25000,
        devices: [],
        heartbeats: [],
      };
  return { list, idx, row, clean };
}

export function saveRow(list, idx, row) {
  if (idx >= 0) list[idx] = row;
  else list.unshift(row);
  writeLedger(list);
  return row;
}

export function checkServerRate(email, planId) {
  const clean = String(email || '').trim().toLowerCase();
  if (isOwner(clean)) return { ok: true };
  const max = PLAN_RATE[planId] || 8;
  const now = Date.now();
  const arr = (rateHits.get(clean) || []).filter((t) => now - t < 60_000);
  if (arr.length >= max) {
    return { ok: false, waitSec: Math.max(1, Math.ceil((arr[0] + 60_000 - now) / 1000)), max };
  }
  arr.push(now);
  rateHits.set(clean, arr);
  return { ok: true, remaining: max - arr.length, max };
}

export function consumeServerCredits(email, n = 1) {
  const { list, idx, row, clean } = getOrCreateRow(email);
  if (isOwner(clean)) return { ok: true, credits: row.credits, skipped: true };
  if (row.apiMode !== 'managed') return { ok: true, credits: row.credits, skipped: true };
  const cost = Math.max(1, Math.floor(Number(n) || 1));
  if ((row.credits || 0) < cost) return { ok: false, error: 'No managed credits' };
  row.credits = Math.max(0, (row.credits || 0) - cost);
  saveRow(list, idx, row);
  return { ok: true, credits: row.credits };
}

export function grantFromStripeSession(session) {
  const email = String(session?.metadata?.email || session?.client_reference_id || '').trim().toLowerCase();
  const packId = String(session?.metadata?.pack || '').trim();
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!email || !pack) return { ok: false, error: 'Missing email or pack on Stripe session' };
  const { list, idx, row } = getOrCreateRow(email);
  const sid = String(session.id || '');
  const seen = Array.isArray(row.stripeSessions) ? row.stripeSessions : [];
  if (sid && seen.includes(sid)) {
    return { ok: true, duplicate: true, credits: row.credits, email, granted: 0 };
  }
  if (sid) row.stripeSessions = [...seen, sid].slice(-80);
  row.credits = (row.credits || 0) + pack.credits;
  row.apiMode = row.apiMode || 'managed';
  saveRow(list, idx, row);
  return { ok: true, credits: row.credits, email, granted: pack.credits, pack: pack.id };
}

/** License a desktop-trial requester without skipping SaaS. Owner stays Enterprise. */
export function activateDesktopTrialLicense(email) {
  const { list, idx, row, clean } = getOrCreateRow(email);
  const isNew = idx < 0;
  if (isOwner(clean)) {
    row.plan = 'enterprise';
    row.status = 'ACTIVE';
    row.desktopTrialApprovedAt = new Date().toISOString();
    saveRow(list, idx, row);
    return row;
  }
  const paid = ['creator', 'pro', 'production', 'studio', 'enterprise'];
  const current = String(row.plan || '').toLowerCase();
  if (isNew || !paid.includes(current) || String(row.status || '').toUpperCase() !== 'ACTIVE') {
    row.plan = 'trial';
    row.credits = 50;
    row.status = 'ACTIVE';
    row.apiMode = row.apiMode || 'byok';
    row.trialStartedAt = row.trialStartedAt || new Date().toISOString();
  }
  row.desktopTrialApprovedAt = new Date().toISOString();
  saveRow(list, idx, row);
  return row;
}

export function grantServerCredits(email, amount) {
  const { list, idx, row } = getOrCreateRow(email);
  row.credits = (row.credits || 0) + Math.max(0, Math.floor(Number(amount) || 0));
  saveRow(list, idx, row);
  return row;
}
