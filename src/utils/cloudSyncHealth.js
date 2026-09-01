/**
 * P6 — Cloud sync health probe (KV vs JSONBlob vs offline).
 */

import { getNativeSyncUrl } from '../services/cloudSync';

const CACHE_KEY = 'sps_cloud_sync_health';
const FAIL_STREAK_KEY = 'sps_cloud_sync_fail_streak';
const FAIL_ALERT_THRESHOLD = 3;

function readFailStreak() {
  if (typeof window === 'undefined') return 0;
  try {
    return Math.max(0, Number(localStorage.getItem(FAIL_STREAK_KEY)) || 0);
  } catch {
    return 0;
  }
}

function writeFailStreak(n) {
  if (typeof window === 'undefined') return n;
  try {
    localStorage.setItem(FAIL_STREAK_KEY, String(Math.max(0, n)));
  } catch {
    /* ignore */
  }
  return n;
}

function noteProbeResult(ok) {
  if (ok) {
    writeFailStreak(0);
    return 0;
  }
  const streak = writeFailStreak(readFailStreak() + 1);
  if (streak === FAIL_ALERT_THRESHOLD && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('sps_cloud_sync_fail_alert', {
          detail: { streak, message: 'Cloud sync failed 3 times in a row. Check network or Settings → Cloud.' }
        })
      );
    } catch {
      /* ignore */
    }
  }
  return streak;
}

function readCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  if (typeof window === 'undefined') return payload;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('sps_cloud_sync_health_updated', { detail: payload }));
  } catch {
    /* ignore */
  }
  return payload;
}

export function readCloudSyncHealth() {
  const cached = readCache();
  if (cached) return cached;
  return {
    ok: false,
    kvConfigured: false,
    durableOk: false,
    backend: 'unknown',
    checkedAt: null
  };
}

/**
 * Probe /api/sync?type=projects for kvConfigured + durableOk flags.
 */
export async function fetchCloudSyncHealth() {
  if (typeof window === 'undefined') {
    return readCloudSyncHealth();
  }
  try {
    const res = await fetch(`${getNativeSyncUrl()}?type=projects`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const kv = Boolean(data.kvConfigured);
    const durableOk = data.durableOk !== false && !data.durableFailed;
    const backend = kv ? 'upstash_kv' : durableOk ? 'jsonblob' : res.ok ? 'memory' : 'offline';
    const ok = res.ok && durableOk;
    const failStreak = noteProbeResult(ok);
    return writeCache({
      ok,
      kvConfigured: kv,
      durableOk,
      backend,
      failStreak,
      checkedAt: new Date().toISOString()
    });
  } catch {
    const failStreak = noteProbeResult(false);
    return writeCache({
      ok: false,
      kvConfigured: false,
      durableOk: false,
      backend: 'offline',
      failStreak,
      checkedAt: new Date().toISOString()
    });
  }
}

export function syncBackendLabel(backend = '') {
  const b = String(backend || '').toLowerCase();
  if (b === 'upstash_kv') return 'Upstash KV';
  if (b === 'jsonblob') return 'JSONBlob';
  if (b === 'memory') return 'Ephemeral';
  if (b === 'offline') return 'Offline';
  return 'Unknown';
}

export async function fetchKvMigrationStatus() {
  if (typeof window === 'undefined') return { kvConfigured: false, needsMigration: false };
  try {
    const res = await fetch(`${getNativeSyncUrl()}?type=kv_migration`, { cache: 'no-store' });
    return res.json().catch(() => ({}));
  } catch {
    return { kvConfigured: false, needsMigration: false, ok: false };
  }
}

export async function runKvMigration({ force = false } = {}) {
  if (typeof window === 'undefined') return { ok: false, error: 'Unavailable' };
  try {
    const res = await fetch(`${getNativeSyncUrl()}?type=kv_migration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: Boolean(force) })
    });
    return res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  } catch (e) {
    return { ok: false, error: e?.message || 'Migration failed' };
  }
}
