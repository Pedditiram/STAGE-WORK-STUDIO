import {
  assertCanGenerate,
  consumeManagedCredit,
  getDeviceId,
  resolveApiMode,
  resolveByteplusKey,
  trackUsage,
  upsertLicense,
} from '../utils/saasControl';
import { getSeedanceStillModel, getSeedanceVideoModel } from './seedanceModels';

function sessionEmail() {
  return String(localStorage.getItem('sps_authorized_user_email') || '').trim().toLowerCase();
}

/**
 * Managed: studio env key on /api/generate-image — user key never sent.
 * BYOK: BytePlus key from the account, billed by the provider.
 */
export async function generateStudioImage({ prompt, width = 1280, height = 720, modelId, endpointUrl, signal } = {}) {
  const email = sessionEmail();
  const gate = assertCanGenerate(email, { consumeRate: true });
  if (!gate.ok) {
    const err = new Error(gate.message);
    err.code = 'saas';
    throw err;
  }

  const managed = resolveApiMode(email) === 'managed';
  const body = {
    prompt,
    width,
    height,
    modelId: modelId || getSeedanceStillModel(),
    endpointUrl,
    email,
    managed,
  };
  if (!managed) {
    body.apiKey = resolveByteplusKey();
    if (!body.apiKey) {
      throw new Error('Add a BytePlus key in Settings → API keys, or switch to Stage Work Studio credits.');
    }
  }

  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Generate failed (${res.status})`);
  }

  if (managed) {
    if (typeof data.credits === 'number') upsertLicense(email, { credits: data.credits });
    else consumeManagedCredit(email, 1);
  }
  trackUsage('generate');
  return data;
}

function videoHeaders() {
  return { 'Content-Type': 'application/json' };
}

/**
 * Creates a Seedance (or configured) video task. Poll with pollStudioVideo.
 * Managed video costs 2 credits on create.
 */
export async function generateStudioVideo({
  prompt,
  firstFrameUrl,
  duration = 5,
  ratio = '16:9',
  modelId,
  endpointUrl,
  signal,
} = {}) {
  const email = sessionEmail();
  const gate = assertCanGenerate(email, { consumeRate: true });
  if (!gate.ok) {
    const err = new Error(gate.message);
    err.code = 'saas';
    throw err;
  }

  const managed = resolveApiMode(email) === 'managed';
  const body = {
    action: 'create',
    prompt,
    firstFrameUrl,
    duration,
    ratio,
    modelId: modelId || getSeedanceVideoModel(),
    endpointUrl: endpointUrl || localStorage.getItem('sps_byteplus_endpoint_url') || undefined,
    email,
    managed,
  };
  if (!managed) {
    body.apiKey = resolveByteplusKey();
    if (!body.apiKey) {
      throw new Error('Add a BytePlus key in Settings → API keys, or switch to Stage Work Studio credits.');
    }
  }

  const res = await fetch('/api/generate-video', {
    method: 'POST',
    headers: videoHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Video create failed (${res.status})`);
  }

  if (managed) {
    if (typeof data.credits === 'number') upsertLicense(email, { credits: data.credits });
    else consumeManagedCredit(email, 2);
  }
  trackUsage('generate');
  return data;
}

export async function pollStudioVideo({ taskId, endpointUrl, signal } = {}) {
  const email = sessionEmail();
  const managed = resolveApiMode(email) === 'managed';
  const body = {
    action: 'status',
    taskId,
    endpointUrl: endpointUrl || localStorage.getItem('sps_byteplus_endpoint_url') || undefined,
    email,
    managed,
  };
  if (!managed) {
    body.apiKey = resolveByteplusKey();
  }
  const res = await fetch('/api/generate-video', {
    method: 'POST',
    headers: videoHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Video poll failed (${res.status})`);
  }
  return data;
}

export async function fetchSaasStatus() {
  const res = await fetch('/api/saas');
  return res.json().catch(() => ({}));
}

/** P107 — pull ledger credits now (Stripe return), do not wait for the 60s heartbeat. */
export async function syncManagedCredits(email) {
  const clean = String(email || sessionEmail()).trim().toLowerCase();
  if (!clean) return { ok: false };
  try {
    const res = await fetch('/api/saas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'heartbeat', email: clean, deviceId: getDeviceId() }),
    });
    const data = await res.json().catch(() => ({}));
    if (typeof data?.license?.credits === 'number') {
      upsertLicense(clean, {
        credits: data.license.credits,
        plan: data.license.plan || undefined,
        status: data.license.status,
      });
      return { ok: true, credits: data.license.credits };
    }
    return { ok: false, message: data?.error || 'No credit ledger on this heartbeat.' };
  } catch (e) {
    return { ok: false, message: e?.message || 'Credit sync failed' };
  }
}

export async function checkoutCreditPack(packId) {
  const email = sessionEmail();
  const res = await fetch('/api/saas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'checkout',
      email,
      packId,
      origin: window.location.origin,
    }),
  });
  return res.json();
}

export async function grantCreditPack(targetEmail, packId, actorEmail) {
  const res = await fetch('/api/saas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'grant-credits',
      email: targetEmail,
      packId,
      actor: actorEmail,
    }),
  });
  return res.json();
}
