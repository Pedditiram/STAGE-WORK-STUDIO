/**
 * Phase 2: optional local ComfyUI HTTP API (PDF §21).
 * Keys never sent in workflow JSON.
 *
 * ComfyUI ≥0.19 origin CSRF returns 403 when SWS (localhost:5173) calls
 * 127.0.0.1:8188 directly. Local Vite proxies /api/comfyui/* → ComfyUI
 * with a matching Origin so Send to ComfyUI works from the browser / Electron-dev.
 */

import { firstComfyOutputRef, pickLatestHistoryEntry, comfyViewUrl } from '../utils/comfyHistoryParse.js';

const DEFAULT_URL_KEY = 'sps_comfyui_base_url';

export function getComfyUiBaseUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8188';
  try {
    return String(localStorage.getItem(DEFAULT_URL_KEY) || 'http://127.0.0.1:8188').replace(/\/$/, '');
  } catch {
    return 'http://127.0.0.1:8188';
  }
}

export function setComfyUiBaseUrl(url) {
  const next = String(url || '').trim().replace(/\/$/, '') || 'http://127.0.0.1:8188';
  try {
    localStorage.setItem(DEFAULT_URL_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

function isLocalStudioPage() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol === 'file:') return false;
    const host = String(window.location.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

/**
 * API base for fetch/probe/load. Prefer same-origin Vite proxy on local studio
 * so ComfyUI does not 403 on Origin mismatch. UI window still opens the real Comfy URL.
 */
export function getComfyUiApiBaseUrl(uiBaseUrl = getComfyUiBaseUrl()) {
  if (typeof window === 'undefined') return uiBaseUrl || 'http://127.0.0.1:8188';
  try {
    const forced = String(localStorage.getItem('sps_comfyui_api_base') || '').trim().replace(/\/$/, '');
    if (forced) return forced;
  } catch {
    /* ignore */
  }
  if (isLocalStudioPage()) {
    return `${window.location.origin}/api/comfyui`;
  }
  // Packaged Electron (file://): main-process proxy avoids Origin CSRF
  try {
    if (window.electronAPI?.comfyFetch) {
      return 'electron-comfy://';
    }
  } catch {
    /* ignore */
  }
  return String(uiBaseUrl || getComfyUiBaseUrl()).replace(/\/$/, '');
}

function joinUrl(base, path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${String(base || '').replace(/\/$/, '')}${p}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function comfyRequest(apiPath, { method = 'GET', body, uiBaseUrl } = {}) {
  const apiBase = getComfyUiApiBaseUrl(uiBaseUrl || getComfyUiBaseUrl());
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;

  if (apiBase === 'electron-comfy://') {
    const api = window.electronAPI;
    const res = await api.comfyFetch({
      baseUrl: uiBaseUrl || getComfyUiBaseUrl(),
      path,
      method,
      body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    });
    return {
      ok: Boolean(res?.ok),
      status: res?.status || 0,
      json: async () => res?.data ?? {},
      text: async () => (typeof res?.text === 'string' ? res.text : JSON.stringify(res?.data ?? {}))
    };
  }

  const url = joinUrl(apiBase, path);
  return fetch(url, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  });
}

function explainComfyHttpError(status, uiBaseUrl) {
  if (status === 403) {
    return (
      `ComfyUI blocked the request (HTTP 403 origin CSRF). ` +
      `SWS should call via the local proxy automatically — keep Vite running, or start ComfyUI with ` +
      `--enable-cors-header "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}". ` +
      `UI stays at ${uiBaseUrl || 'http://127.0.0.1:8188'}.`
    );
  }
  return `ComfyUI HTTP ${status}`;
}

export async function probeComfyUi(uiBaseUrl = getComfyUiBaseUrl()) {
  try {
    const res = await comfyRequest('/system_stats', { method: 'GET', uiBaseUrl });
    if (!res.ok) return { ok: false, message: explainComfyHttpError(res.status, uiBaseUrl), status: res.status };
    const data = await res.json().catch(() => ({}));
    return {
      ok: true,
      stats: data,
      comfyuiVersion: data?.system?.comfyui_version || data?.version || 'unknown',
      apiBase: getComfyUiApiBaseUrl(uiBaseUrl)
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err?.message ||
        `Cannot reach ComfyUI at ${uiBaseUrl}. Start ComfyUI (default http://127.0.0.1:8188) and try again.`
    };
  }
}

export async function fetchComfyObjectInfo(uiBaseUrl = getComfyUiBaseUrl()) {
  const res = await comfyRequest('/object_info', { method: 'GET', uiBaseUrl });
  if (!res.ok) throw new Error(explainComfyHttpError(res.status, uiBaseUrl));
  return res.json();
}

/** Wait until ComfyUI-SWS extension acks pending workflow (canvas actually loaded). */
export async function waitForComfyPendingLoaded({
  id,
  baseUrl = getComfyUiBaseUrl(),
  timeoutMs = 22000
} = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await comfyRequest('/sws/pending_workflow', { method: 'GET', uiBaseUrl: baseUrl });
      const data = await res.json().catch(() => ({}));
      if (data?.loaded) {
        if (!id || data.id === id) return { ok: true, data };
      }
    } catch {
      /* ignore */
    }
    await sleep(450);
  }
  return {
    ok: false,
    message:
      'ComfyUI did not paint the workflow on the canvas. Reload the ComfyUI tab, confirm ComfyUI-SWS is in custom_nodes, then Send again. Check ComfyUI DevTools console for [ComfyUI-SWS] errors.'
  };
}

export function installedComfyClassCount(objectInfo) {
  if (!objectInfo || typeof objectInfo !== 'object') return 0;
  return Object.keys(objectInfo).length;
}

export function missingSwsNodes(objectInfo, requiredClassTypes = []) {
  const installed = new Set(Object.keys(objectInfo || {}));
  return requiredClassTypes.filter((cls) => !installed.has(cls));
}

/** Status-line copy for Send-to-Comfy / film queue when object_info is missing classes. */
export function missingComfyClassStatusLine(objectInfo, requiredClassTypes = [], { host = '' } = {}) {
  const missing = missingSwsNodes(objectInfo, requiredClassTypes);
  const where = host ? ` on ${host}` : '';
  if (!missing.length) {
    return {
      ok: true,
      missing: [],
      status: `All required Seedance / ComfyUI-SWS classes present${where} (${requiredClassTypes.length})`
    };
  }
  return {
    ok: false,
    missing,
    status: `Missing Seedance / ComfyUI-SWS classes${where}: ${missing.join(', ')}`
  };
}

/**
 * Load a frontend workflow JSON onto the running ComfyUI canvas.
 * Uses ComfyUI-SWS PromptServer routes + frontend loadGraphData (not /prompt).
 */
export async function loadWorkflowIntoComfyEditor({
  workflow,
  workflowId,
  workflowName,
  autoQueue = false,
  baseUrl = getComfyUiBaseUrl()
} = {}) {
  try {
    const sws = workflow?.extra?.sws || {};
    const name =
      String(workflowName || '').trim() ||
      String(sws.displayName || '').trim() ||
      [sws.projectId, sws.shotId].filter(Boolean).join(' ') ||
      'SWS Workflow';
    const res = await comfyRequest('/sws/load_workflow', {
      method: 'POST',
      uiBaseUrl: baseUrl,
      body: {
        id: workflowId || '',
        fit: true,
        name,
        autoQueue: Boolean(autoQueue),
        workflow
      }
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      return {
        ok: false,
        code: 'missing_sws_pack',
        message:
          'ComfyUI is running, but ComfyUI-SWS is not loaded. Copy the ComfyUI-SWS folder into ComfyUI/custom_nodes and restart ComfyUI. SWS will not download nodes for you.'
      };
    }
    if (res.status === 403) {
      return {
        ok: false,
        code: 'origin_forbidden',
        message: explainComfyHttpError(403, baseUrl)
      };
    }
    if (!res.ok || data?.ok === false) {
      return {
        ok: false,
        code: 'load_rejected',
        message: data?.error || `ComfyUI refused the editor workflow (HTTP ${res.status}). The canvas was not cleared.`
      };
    }
    return { ok: true, id: data.id || workflowId, name: data.name || name, data };
  } catch (err) {
    const msg = String(err?.message || err);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return {
        ok: false,
        code: 'unreachable',
        message:
          `Cannot complete the editor load at ${baseUrl}. Start ComfyUI if it is not running. If it is running, install ComfyUI-SWS into custom_nodes and restart ComfyUI.`
      };
    }
    return { ok: false, code: 'load_failed', message: msg };
  }
}

export function openComfyUiWindow(baseUrl = getComfyUiBaseUrl()) {
  const url = String(baseUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
  try {
    const opened = window.open(url, 'sws_comfyui');
    if (opened) {
      try {
        opened.focus();
      } catch {
        /* ignore */
      }
    }
    return { ok: true, opened: Boolean(opened) };
  } catch (err) {
    return { ok: false, message: err?.message || 'Could not open the ComfyUI window.' };
  }
}

export async function queueComfyPrompt({ prompt, clientId, baseUrl = getComfyUiBaseUrl() } = {}) {
  if (!prompt || typeof prompt !== 'object') {
    return { ok: false, message: 'No ComfyUI prompt graph to queue.' };
  }
  try {
    const res = await comfyRequest('/prompt', {
      method: 'POST',
      uiBaseUrl: baseUrl,
      body: {
        prompt,
        client_id: clientId || `sws_${Date.now()}`
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message: data?.error?.message || data?.node_errors && JSON.stringify(data.node_errors) || `Queue failed (${res.status})`,
        data
      };
    }
    return { ok: true, promptId: data.prompt_id || data.promptId, number: data.number, data };
  } catch (err) {
    return { ok: false, message: err?.message || 'ComfyUI queue request failed.' };
  }
}

/** Snapshot ComfyUI execution queue. */
export async function fetchComfyQueue(baseUrl = getComfyUiBaseUrl()) {
  try {
    const res = await comfyRequest('/queue', { method: 'GET', uiBaseUrl: baseUrl });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: `Queue status HTTP ${res.status}`, running: 0, pending: 0 };
    }
    const running = Array.isArray(data.queue_running) ? data.queue_running.length : 0;
    const pending = Array.isArray(data.queue_pending) ? data.queue_pending.length : 0;
    return { ok: true, running, pending, busy: running + pending > 0, data };
  } catch (err) {
    return { ok: false, message: err?.message || 'Queue status failed', running: 0, pending: 0 };
  }
}

/**
 * Wait until ComfyUI has no running/pending prompts.
 * If the queue is empty at start, wait briefly for a job to appear (autoQueue lag).
 */
export async function waitForComfyQueueIdle({
  baseUrl = getComfyUiBaseUrl(),
  timeoutMs = 45 * 60 * 1000,
  pollMs = 2000,
  appearTimeoutMs = 45000,
  cancelToken = null
} = {}) {
  const started = Date.now();
  let sawBusy = false;

  while (Date.now() - started < timeoutMs) {
    if (cancelToken?.cancelled) {
      return { ok: false, message: 'Cancelled', cancelled: true };
    }
    const q = await fetchComfyQueue(baseUrl);
    if (!q.ok) {
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    if (q.busy) {
      sawBusy = true;
    } else if (sawBusy) {
      return { ok: true, elapsedMs: Date.now() - started };
    } else if (Date.now() - started > appearTimeoutMs) {
      // Never saw a job — treat as done (manual queue / empty graph / already finished)
      return { ok: true, elapsedMs: Date.now() - started, empty: true };
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return { ok: false, message: 'Timed out waiting for ComfyUI queue idle.' };
}

export async function fetchComfyHistory(promptId = '', baseUrl = getComfyUiBaseUrl()) {
  try {
    const path = promptId ? `/history/${encodeURIComponent(promptId)}` : '/history';
    const res = await comfyRequest(path, { method: 'GET', uiBaseUrl: baseUrl });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: `History HTTP ${res.status}`, history: {} };
    return { ok: true, history: data && typeof data === 'object' ? data : {} };
  } catch (err) {
    return { ok: false, message: err?.message || 'History request failed', history: {} };
  }
}

/**
 * After a generate, read the latest completed Comfy output (view URL).
 * Empty history is not an error — the user may still be rendering.
 */
export async function pullLatestComfyOutput({
  promptId = '',
  baseUrl = getComfyUiBaseUrl()
} = {}) {
  const fetched = await fetchComfyHistory(promptId, baseUrl);
  if (!fetched.ok) return { ok: false, message: fetched.message };
  const slice = promptId && fetched.history?.[promptId]
    ? { promptId, entry: fetched.history[promptId], outputs: fetched.history[promptId]?.outputs || {} }
    : pickLatestHistoryEntry(fetched.history);
  if (!slice) return { ok: false, code: 'empty_history', message: 'ComfyUI history has no completed prompts yet.' };
  const ref = firstComfyOutputRef(slice.outputs);
  if (!ref?.filename) {
    return { ok: false, code: 'no_output', message: 'Latest Comfy prompt finished without a viewable file yet.' };
  }
  const ui = String(baseUrl || getComfyUiBaseUrl()).replace(/\/$/, '');
  return {
    ok: true,
    promptId: slice.promptId,
    filename: ref.filename,
    outputFile: comfyViewUrl(ui, ref),
    ref
  };
}
