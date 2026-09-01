/**
 * Stage Work Studio SaaS — plans, license, device, session, BYOK.
 * Backend is the authority. This client never controls the user's machine —
 * only account, license, features, and APIs.
 */

export const SAAS_PLANS = {
  trial: {
    id: 'trial',
    label: 'Free / Trial',
    devices: 1,
    credits: 50,
    features: {
      generate: false,
      export: false,
      collab: false,
      compile: false,
    },
    consoles: ['writer', 'matrix', 'form'],
    rateGeneratePerMin: 2,
  },
  creator: {
    id: 'creator',
    label: 'Creator',
    devices: 1,
    credits: 500,
    features: {
      generate: true,
      export: true,
      collab: false,
      compile: true,
    },
    consoles: ['writer', 'matrix', 'form', 'cast', 'world', 'compile', 'generate', 'reel', 'storyboard', 'promo', 'campaign'],
    rateGeneratePerMin: 6,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    devices: 2,
    credits: 2000,
    features: {
      generate: true,
      export: true,
      collab: true,
      compile: true,
    },
    consoles: ['writer', 'matrix', 'form', 'cast', 'world', 'compile', 'generate', 'reel', 'storyboard', 'promo', 'campaign', 'pitch'],
    rateGeneratePerMin: 12,
  },
  production: {
    id: 'production',
    label: 'Production',
    devices: 3,
    credits: 8000,
    features: {
      generate: true,
      export: true,
      collab: true,
      compile: true,
    },
    consoles: ['writer', 'matrix', 'form', 'stage', 'cast', 'world', 'compile', 'generate', 'reel', 'storyboard', 'promo', 'campaign', 'pitch', 'budget'],
    rateGeneratePerMin: 20,
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    devices: 8,
    credits: 25000,
    features: {
      generate: true,
      export: true,
      collab: true,
      compile: true,
    },
    consoles: ['writer', 'matrix', 'form', 'stage', 'cast', 'world', 'compile', 'generate', 'reel', 'storyboard', 'promo', 'campaign', 'pitch', 'budget'],
    rateGeneratePerMin: 30,
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    devices: 99,
    credits: 999999,
    features: {
      generate: true,
      export: true,
      collab: true,
      compile: true,
    },
    consoles: ['writer', 'matrix', 'form', 'stage', 'cast', 'world', 'compile', 'generate', 'reel', 'storyboard', 'promo', 'campaign', 'pitch', 'budget'],
    rateGeneratePerMin: 60,
  },
};

export const CREDIT_PACKS = [
  { id: 'pack_100', credits: 100, usd: 9, label: '100 credits' },
  { id: 'pack_500', credits: 500, usd: 39, label: '500 credits' },
  { id: 'pack_2000', credits: 2000, usd: 129, label: '2,000 credits' },
];

const RATE_KEY = 'sps_saas_rate';
const OWNER_EMAIL = 'pedditiram@gmail.com';
export { OWNER_EMAIL };

export const BYOK_PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'google', label: 'Google Gemini' },
  { id: 'fal', label: 'fal.ai' },
  { id: 'runpod', label: 'RunPod' },
  { id: 'byteplus', label: 'BytePlus / Seedance' },
  { id: 'replicate', label: 'Replicate' },
  { id: 'anthropic', label: 'Anthropic' },
];

const LICENSES_KEY = 'sps_saas_licenses';
const DEVICE_KEY = 'sps_saas_device_id';
const SESSION_KEY = 'sps_saas_session';
const USAGE_KEY = 'sps_saas_usage';
const FORCE_LOGOUT_KEY = 'sps_saas_force_logout';

function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getDeviceId() {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getAllLicenses() {
  const list = readJson(LICENSES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveAllLicenses(list, { silent = false } = {}) {
  writeJson(LICENSES_KEY, list);
  if (silent) return;
  try {
    window.dispatchEvent(new CustomEvent('sps_saas_changed'));
  } catch {
    /* ignore */
  }
}

function defaultLicense(email) {
  const owner = email === OWNER_EMAIL;
  return {
    email,
    plan: owner ? 'enterprise' : 'studio',
    status: 'ACTIVE',
    apiMode: 'byok',
    credits: owner ? 999999 : 25000,
    devices: [],
    flags: {
      generate: null,
      export: null,
      collab: null,
    },
    lastConnection: null,
    version: '1.0.0',
  };
}

export function getLicense(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return defaultLicense('');
  const all = getAllLicenses();
  return all.find((l) => l.email === clean) || defaultLicense(clean);
}

export function upsertLicense(email, patch, { silent = false } = {}) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return null;
  const all = getAllLicenses();
  const idx = all.findIndex((l) => l.email === clean);
  const prev = idx >= 0 ? all[idx] : defaultLicense(clean);
  const next = { ...prev, ...patch, email: clean };
  try {
    if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
  } catch {
    /* continue */
  }
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  saveAllLicenses(all, { silent });
  return next;
}

export function getPlan(planId) {
  return SAAS_PLANS[planId] || SAAS_PLANS.trial;
}

export function registerThisDevice(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return { ok: false, error: 'No account' };
  const deviceId = getDeviceId();
  const lic = getLicense(clean);
  const plan = getPlan(lic.plan);
  const devices = Array.isArray(lic.devices) ? [...lic.devices] : [];
  let row = devices.find((d) => d.id === deviceId);
  if (!row) {
    const activeCount = devices.filter((d) => d.status !== 'DISABLED').length;
    if (activeCount >= plan.devices && clean !== OWNER_EMAIL) {
      return { ok: false, error: `Device limit reached for ${plan.label} (${plan.devices}).` };
    }
    row = {
      id: deviceId,
      label: typeof navigator !== 'undefined' ? navigator.platform || 'Device' : 'Device',
      status: 'ACTIVE',
      lastSeen: new Date().toISOString(),
    };
    devices.push(row);
  } else {
    if (row.status === 'DISABLED') {
      return { ok: false, error: 'This device was deactivated by the studio owner.' };
    }
    row.lastSeen = new Date().toISOString();
  }
  upsertLicense(clean, { devices, lastConnection: new Date().toISOString(), status: lic.status || 'ACTIVE' }, { silent: true });
  writeJson(SESSION_KEY, {
    email: clean,
    deviceId,
    startedAt: new Date().toISOString(),
  });
  return { ok: true, license: getLicense(clean) };
}

export function heartbeat(email) {
  const clean = String(email || '').trim().toLowerCase();
  const lic = getLicense(clean);
  if (lic.status === 'DISABLED' || lic.status === 'REVOKED') {
    return { ok: false, reason: 'license', message: 'License revoked. Sign in is blocked until the owner restores access.' };
  }
  const deviceId = getDeviceId();
  const dev = (lic.devices || []).find((d) => d.id === deviceId);
  if (dev?.status === 'DISABLED') {
    return { ok: false, reason: 'device', message: 'This device was deactivated.' };
  }
  if (readJson(FORCE_LOGOUT_KEY, {})[clean] === true) {
    const map = readJson(FORCE_LOGOUT_KEY, {});
    delete map[clean];
    writeJson(FORCE_LOGOUT_KEY, map);
    return { ok: false, reason: 'logout', message: 'Owner forced a sign-out.' };
  }
  registerThisDevice(clean);
  return { ok: true, license: getLicense(clean) };
}

export function forceLogout(email) {
  const map = readJson(FORCE_LOGOUT_KEY, {});
  map[String(email || '').toLowerCase()] = true;
  writeJson(FORCE_LOGOUT_KEY, map);
  try {
    window.dispatchEvent(new CustomEvent('sps_saas_changed', { detail: { forceLogout: true } }));
  } catch {
    /* ignore */
  }
}

export function setDeviceStatus(email, deviceId, status) {
  const lic = getLicense(email);
  const devices = (lic.devices || []).map((d) => (d.id === deviceId ? { ...d, status } : d));
  return upsertLicense(email, { devices });
}

export function setLicenseStatus(email, status) {
  return upsertLicense(email, { status });
}

export function setPlan(email, planId) {
  const plan = getPlan(planId);
  return upsertLicense(email, { plan: plan.id, credits: plan.credits });
}

export function setLicenseFlag(email, flag, value) {
  const lic = getLicense(email);
  return upsertLicense(email, { flags: { ...(lic.flags || {}), [flag]: value } });
}

export function getUsage() {
  return readJson(USAGE_KEY, { calls: 0, generate: 0, last: null });
}

function sessionEmail() {
  if (typeof window === 'undefined') return '';
  return String(localStorage.getItem('sps_authorized_user_email') || '').trim().toLowerCase();
}

export function trackUsage(kind = 'calls') {
  const u = getUsage();
  u.calls = (u.calls || 0) + 1;
  if (kind === 'generate') u.generate = (u.generate || 0) + 1;
  u.last = new Date().toISOString();
  writeJson(USAGE_KEY, u);
  return u;
}

export function addCredits(email, amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const lic = getLicense(email);
  return upsertLicense(email, { credits: (lic.credits || 0) + n });
}

export function consumeManagedCredit(email, n = 1) {
  const clean = String(email || sessionEmail()).trim().toLowerCase();
  const cost = Math.max(1, Math.floor(Number(n) || 1));
  if (clean === OWNER_EMAIL) return { ok: true, credits: getLicense(clean).credits, skipped: true };
  const lic = getLicense(clean);
  if (lic.apiMode !== 'managed') return { ok: true, credits: lic.credits, skipped: true };
  if ((lic.credits || 0) < cost) {
    return { ok: false, message: 'No managed credits left. Buy a pack in Settings → SaaS, or switch to BYOK.' };
  }
  const next = Math.max(0, (lic.credits || 0) - cost);
  upsertLicense(clean, { credits: next }, { silent: true });
  return { ok: true, credits: next };
}

export function checkRateLimit(email, kind = 'generate') {
  const clean = String(email || sessionEmail()).trim().toLowerCase();
  if (clean === OWNER_EMAIL) return { ok: true, remaining: 99, max: 99 };
  const plan = getPlan(getLicense(clean).plan);
  const max = kind === 'generate' ? (plan.rateGeneratePerMin || 8) : 30;
  const now = Date.now();
  const windowMap = readJson(RATE_KEY, {});
  const arr = (windowMap[`${clean}:${kind}`] || []).filter((t) => now - t < 60_000);
  if (arr.length >= max) {
    const waitSec = Math.max(1, Math.ceil((arr[0] + 60_000 - now) / 1000));
    return { ok: false, waitSec, max, remaining: 0 };
  }
  arr.push(now);
  windowMap[`${clean}:${kind}`] = arr;
  writeJson(RATE_KEY, windowMap);
  return { ok: true, remaining: max - arr.length, max };
}

/** P106 — warn before managed generate hits zero. */
export const CREDIT_LOW_WATER = 20;

export function managedCreditStatus(email) {
  const clean = String(email || sessionEmail()).trim().toLowerCase();
  const lic = getLicense(clean);
  const mode = resolveApiMode(clean);
  const credits = Number(lic.credits) || 0;
  if (mode !== 'managed' || clean === OWNER_EMAIL) {
    return { relevant: false, credits, level: 'ok', message: '', mode };
  }
  if (credits <= 0) {
    return {
      relevant: true,
      credits,
      level: 'empty',
      message: 'No managed credits left. Buy a pack in Settings → SaaS, or switch to BYOK.',
      mode
    };
  }
  if (credits <= CREDIT_LOW_WATER) {
    return {
      relevant: true,
      credits,
      level: 'low',
      message: `Low credits: ${credits} remaining. Buy a pack in Settings → SaaS, or switch to BYOK.`,
      mode
    };
  }
  return { relevant: true, credits, level: 'ok', message: '', mode };
}

export function assertCanGenerate(email, { consumeRate = false } = {}) {
  const clean = String(email || sessionEmail()).trim().toLowerCase();
  if (!canUseSaasFeature('generate', clean)) {
    return { ok: false, message: 'Generation is off for this license. Owner can enable it in Settings → SaaS.' };
  }
  const lic = getLicense(clean);
  if (resolveApiMode(clean) === 'managed' && clean !== OWNER_EMAIL && (lic.credits || 0) <= 0) {
    return { ok: false, message: 'No managed credits. Buy a pack in Settings → SaaS, or switch to BYOK in API keys.' };
  }
  if (!consumeRate) return { ok: true, credits: lic.credits };
  const rate = checkRateLimit(clean, 'generate');
  if (!rate.ok) {
    return { ok: false, message: `Rate limit: ${rate.max} generates per minute on this plan. Wait ${rate.waitSec}s.` };
  }
  return { ok: true, credits: lic.credits, remaining: rate.remaining };
}

export function assertCanExport(email) {
  const clean = String(email || sessionEmail()).trim().toLowerCase();
  if (canUseSaasFeature('export', clean)) return { ok: true };
  return { ok: false, message: 'Export is not on this plan. Owner can enable it in Settings → SaaS.' };
}

export function resolveLlmApiKey(provider) {
  const email = sessionEmail();
  const byok = getByokKeys(email);
  const p = String(provider || '').toLowerCase();
  if ((p.includes('google') || p.includes('gemini')) && byok.google) return byok.google;
  if (p.includes('openai') && byok.openai) return byok.openai;
  if (p.includes('anthropic') && byok.anthropic) return byok.anthropic;
  if (p.includes('byteplus') && byok.byteplus) return byok.byteplus;
  if (typeof window === 'undefined') return '';
  return String(localStorage.getItem('sps_api_key') || '').trim();
}

export function resolveByteplusKey() {
  const email = sessionEmail();
  const byok = getByokKeys(email);
  if (byok.byteplus) return byok.byteplus;
  if (typeof window === 'undefined') return '';
  return String(localStorage.getItem('sps_byteplus_api_key') || '').trim();
}

export function resolveReplicateKey(email) {
  const clean = String(email || sessionEmail()).trim().toLowerCase();
  const byok = getByokKeys(clean);
  return String(byok.replicate || '').trim();
}

export function byokStorageKey(email) {
  return `sps_byok_${String(email || '').trim().toLowerCase()}`;
}

export function getByokKeys(email) {
  return readJson(byokStorageKey(email), {});
}

export function setByokKey(email, providerId, value) {
  const map = getByokKeys(email);
  const next = { ...map, [providerId]: String(value || '').trim() };
  writeJson(byokStorageKey(email), next);
  return next;
}

export function resolveApiMode(email) {
  const lic = getLicense(email);
  return lic.apiMode === 'managed' ? 'managed' : 'byok';
}

export function setApiMode(email, mode) {
  return upsertLicense(email, { apiMode: mode === 'managed' ? 'managed' : 'byok' });
}

export function canUseSaasFeature(feature, email) {
  const clean = String(email || '').trim().toLowerCase();
  if (clean === OWNER_EMAIL) return true;
  const lic = getLicense(clean);
  if (lic.status === 'DISABLED' || lic.status === 'REVOKED') return false;
  if (lic.flags && lic.flags[feature] === false) return false;
  if (lic.flags && lic.flags[feature] === true) return true;
  const plan = getPlan(lic.plan);
  return Boolean(plan.features[feature]);
}

export function canUseSaasConsole(consoleId, email) {
  const clean = String(email || '').trim().toLowerCase();
  if (clean === OWNER_EMAIL) return true;
  const lic = getLicense(clean);
  if (lic.status === 'DISABLED' || lic.status === 'REVOKED') return false;
  const plan = getPlan(lic.plan);
  return (plan.consoles || []).includes(consoleId);
}

export function saasSummary(email) {
  const lic = getLicense(email);
  const plan = getPlan(lic.plan);
  const deviceId = getDeviceId();
  const activeDevices = (lic.devices || []).filter((d) => d.status !== 'DISABLED').length;
  return {
    user: email || '—',
    license: plan.label,
    plan: plan.id,
    devices: `${activeDevices} / ${plan.devices}`,
    status: lic.status || 'ACTIVE',
    apiMode: lic.apiMode || 'byok',
    credits: lic.credits,
    lastConnection: lic.lastConnection,
    thisDevice: deviceId,
  };
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Local SaaS license ledger → CSV (admin audit export).
 *  @param {object[]} [licenses]
 *  @param {{ expandDevices?: boolean }} [opts] P110 — one row per device with lastSeen when true
 */
export function saasLicensesToCsv(licenses = [], opts = {}) {
  const expandDevices = Boolean(opts?.expandDevices);
  const headers = expandDevices
    ? [
        'Email',
        'Plan',
        'Status',
        'ApiMode',
        'Credits',
        'DeviceId',
        'DeviceLabel',
        'DeviceStatus',
        'DeviceLastSeen',
        'FlagGenerate',
        'FlagExport',
        'FlagCollab',
        'LastConnection'
      ]
    : [
        'Email',
        'Plan',
        'Status',
        'ApiMode',
        'Credits',
        'Devices',
        'ActiveDevices',
        'DeviceLastSeen',
        'FlagGenerate',
        'FlagExport',
        'FlagCollab',
        'LastConnection'
      ];
  const list = Array.isArray(licenses) ? licenses : getAllLicenses();
  const rows = [];
  for (const lic of list) {
    const devices = Array.isArray(lic?.devices) ? lic.devices : [];
    const flags = [
      lic?.flags?.generate === false ? 'off' : 'on',
      lic?.flags?.export === false ? 'off' : 'on',
      lic?.flags?.collab === false ? 'off' : 'on',
      lic?.lastConnection || ''
    ];
    if (!expandDevices) {
      const active = devices.filter((d) => d.status !== 'DISABLED').length;
      const lastDeviceSeen = devices
        .map((d) => d?.lastSeen)
        .filter(Boolean)
        .sort()
        .pop() || '';
      rows.push(
        [
          lic?.email || '',
          lic?.plan || '',
          lic?.status || '',
          lic?.apiMode || 'byok',
          lic?.credits ?? '',
          devices.length,
          active,
          lastDeviceSeen,
          ...flags
        ]
          .map(csvEscape)
          .join(',')
      );
      continue;
    }
    const base = [
      lic?.email || '',
      lic?.plan || '',
      lic?.status || '',
      lic?.apiMode || 'byok',
      lic?.credits ?? ''
    ];
    if (!devices.length) {
      rows.push([...base, '', '', '', '', ...flags].map(csvEscape).join(','));
      continue;
    }
    for (const d of devices) {
      rows.push(
        [
          ...base,
          d?.id || d?.deviceId || '',
          d?.label || d?.name || '',
          d?.status || 'ACTIVE',
          d?.lastSeen || '',
          ...flags
        ]
          .map(csvEscape)
          .join(',')
      );
    }
  }
  return [headers.map(csvEscape).join(','), ...rows].join('\n');
}
