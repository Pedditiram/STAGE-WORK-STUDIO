/**
 * Public guest look-URL flag. GET is open. POST is owner toggle from Settings.
 * Durable when KV is configured; otherwise in-memory (default ON).
 */

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

let memoryUrlEnabled = true;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function kvGetFlag() {
  const url = kvRestUrl();
  const token = kvRestToken();
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', 'sps:guestUrl']),
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.result;
    if (raw == null) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (typeof parsed?.urlEnabled === 'boolean') return parsed.urlEnabled;
    return null;
  } catch {
    return null;
  }
}

async function kvSetFlag(urlEnabled) {
  const url = kvRestUrl();
  const token = kvRestToken();
  if (!url || !token) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'sps:guestUrl', JSON.stringify({ urlEnabled })]),
      cache: 'no-store'
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const kv = await kvGetFlag();
    const urlEnabled = typeof kv === 'boolean' ? kv : memoryUrlEnabled;
    res.status(200).json({ urlEnabled, sharePath: '/?guest=1' });
    return;
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const urlEnabled = Boolean(body.urlEnabled);
    memoryUrlEnabled = urlEnabled;
    await kvSetFlag(urlEnabled);
    res.status(200).json({ urlEnabled, sharePath: '/?guest=1' });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
