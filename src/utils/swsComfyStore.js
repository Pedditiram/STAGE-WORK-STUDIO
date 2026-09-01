/**
 * Persist SWS project → scene → shot → generation → workflow → output (PDF §22).
 * Does not store ComfyUI JSON as the movie database — contract is canonical.
 */

import { safeLocalStorageSetItem } from './safeStorage';
import { normalizeProjectTitle, isUsableProjectTitle } from './activeProjectGate';

function slug(title) {
  return String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'untitled';
}

function storeKey(title) {
  return `sps_sws_comfy_generations::${slug(title)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function newGenerationId() {
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readSwsGenerations(projectTitle) {
  const t = normalizeProjectTitle(projectTitle);
  if (!t || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storeKey(t));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(projectTitle, rows) {
  const t = normalizeProjectTitle(projectTitle);
  if (!isUsableProjectTitle(t)) return rows;
  safeLocalStorageSetItem(storeKey(t), JSON.stringify(rows.slice(0, 200)));
  try {
    window.dispatchEvent(new CustomEvent('sps_sws_comfy_updated', { detail: { title: t } }));
  } catch {
    /* ignore */
  }
  return rows;
}

export function recordSwsGeneration(projectTitle, entry) {
  const rows = readSwsGenerations(projectTitle);
  const row = {
    generationId: entry.generationId || newGenerationId(),
    workflowId: entry.workflowId || '',
    projectId: entry.projectId || projectTitle,
    sceneId: entry.sceneId || '',
    shotId: entry.shotId || '',
    templateId: entry.templateId || '',
    templateVersion: entry.templateVersion || '',
    provider: entry.provider || '',
    model: entry.model || '',
    status: entry.status || 'specified',
    outputFile: entry.outputFile || '',
    comfyPromptId: entry.comfyPromptId || '',
    comfyuiVersion: entry.comfyuiVersion || '',
    error: entry.error || '',
    createdAt: entry.createdAt || nowIso(),
    contract: entry.contract || null,
    manifest: entry.manifest || null
  };
  return persist(projectTitle, [row, ...rows.filter((r) => r.generationId !== row.generationId)]);
}

export function updateSwsGeneration(projectTitle, generationId, patch) {
  const rows = readSwsGenerations(projectTitle).map((r) =>
    r.generationId === generationId ? { ...r, ...patch, updatedAt: nowIso() } : r
  );
  return persist(projectTitle, rows);
}

export function generationsForShot(projectTitle, shotId) {
  return readSwsGenerations(projectTitle).filter((r) => r.shotId === shotId);
}

export function generationForPromptId(projectTitle, comfyPromptId, shotId = '') {
  const id = String(comfyPromptId || '').trim();
  if (!id) return null;
  return (
    readSwsGenerations(projectTitle).find((r) => {
      if (String(r.comfyPromptId || '') !== id) return false;
      if (shotId && r.shotId && r.shotId !== shotId) return false;
      return true;
    }) || null
  );
}

export function awaitingOutputCount(projectTitle) {
  return readSwsGenerations(projectTitle).filter((r) => r.status === 'awaiting_output').length;
}

export function markAwaitingSucceededForShot(projectTitle, shotId, patch = {}) {
  const sid = String(shotId || '').trim();
  if (!sid) return 0;
  let n = 0;
  const rows = readSwsGenerations(projectTitle).map((r) => {
    if (String(r.shotId || '') !== sid || r.status !== 'awaiting_output') return r;
    n += 1;
    return { ...r, ...patch, status: 'succeeded', updatedAt: nowIso() };
  });
  persist(projectTitle, rows);
  return n;
}
