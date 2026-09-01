/**
 * P2 — Production hierarchy: Act → Sequence → Scene → Shot.
 * Sequences come from Story Package; scenes/shots from Matrix.
 */

import { isUsableProjectTitle, normalizeProjectTitle } from './activeProjectGate';
import { parseSceneAndShotID } from './sceneShotUtils';
import { normalizeSequences, scenesFromShots, readStoryPackageForTitle } from './storyPackage';
import { safeLocalStorageSetItem } from './safeStorage';

export const ACTIVE_SPINE_KEY = 'sps_active_production_spine';
export const SPINE_VERSION = 1;

const ACT_TITLES = Object.freeze({
  1: 'Act I — Setup',
  2: 'Act II — Confrontation',
  3: 'Act III — Resolution'
});

function slugProjectTitle(title) {
  const s = String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'untitled';
}

function nowIso() {
  return new Date().toISOString();
}

export function spineKeyForTitle(title) {
  return `sps_production_spine::${slugProjectTitle(title)}`;
}

function clip(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function assignAct(seqIndex, total, actCount = 3) {
  if (total <= 0) return 1;
  return Math.min(actCount, Math.floor((seqIndex / total) * actCount) + 1);
}

/** Map scene number → sequence seq (feature expand uses SC##_ ≈ sequence). */
function sequenceForSceneNumber(sceneNumber, sequences = []) {
  const n = Number(sceneNumber) || 1;
  const hit = sequences.find((s) => Number(s.seq) === n);
  if (hit) return hit;
  if (sequences.length) {
    const idx = Math.min(sequences.length - 1, Math.max(0, n - 1));
    return sequences[idx];
  }
  return { seq: n, title: `Sequence ${n}`, synopsis: '' };
}

export function buildProductionSpine({
  projectTitle = '',
  shots = [],
  storyPackage = null
} = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const pkg = storyPackage || (title ? readStoryPackageForTitle(title) : null);
  const sequencesRaw = normalizeSequences(pkg?.sequences || []);
  const sceneRows = scenesFromShots(shots);

  const sequences =
    sequencesRaw.length > 0
      ? sequencesRaw.map((seq, i, arr) => ({
          ...seq,
          act: assignAct(i, arr.length, 3)
        }))
      : sceneRows.map((sc, i, arr) => ({
          seq: sc.sceneNumber,
          title: clip(sc.synopsis || sc.heading || `Sequence ${sc.sceneNumber}`, 80),
          synopsis: clip(sc.synopsis || '', 280),
          act: assignAct(i, arr.length, 3)
        }));

  const scenes = sceneRows.map((sc) => {
    const seq = sequenceForSceneNumber(sc.sceneNumber, sequences);
    return {
      id: sc.id,
      sceneNumber: sc.sceneNumber,
      sequenceSeq: Number(seq.seq) || sc.sceneNumber,
      act: Number(seq.act) || assignAct(sc.sceneNumber - 1, sequences.length, 3),
      heading: clip(sc.heading, 120),
      synopsis: clip(sc.synopsis, 280),
      shotIds: sc.shotIds || []
    };
  });

  const actMap = new Map();
  sequences.forEach((seq) => {
    const act = Number(seq.act) || 1;
    if (!actMap.has(act)) {
      actMap.set(act, { act, title: ACT_TITLES[act] || `Act ${act}`, sequenceSeqs: [] });
    }
    actMap.get(act).sequenceSeqs.push(Number(seq.seq));
  });

  return {
    projectTitle: title,
    version: SPINE_VERSION,
    updatedAt: nowIso(),
    shotCount: Array.isArray(shots) ? shots.length : 0,
    acts: Array.from(actMap.values()).sort((a, b) => a.act - b.act),
    sequences,
    scenes
  };
}

export function readProductionSpine(title) {
  if (typeof window === 'undefined') return null;
  const t = normalizeProjectTitle(title);
  if (!t) return null;
  try {
    const raw = localStorage.getItem(spineKeyForTitle(t));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function readActiveProductionSpine() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SPINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProductionSpine(spine, { active = true } = {}) {
  if (!spine?.projectTitle) return spine;
  const t = normalizeProjectTitle(spine.projectTitle);
  if (!isUsableProjectTitle(t)) return spine;
  const row = { ...spine, projectTitle: t, updatedAt: nowIso() };
  try {
    safeLocalStorageSetItem(spineKeyForTitle(t), JSON.stringify(row));
    if (active) safeLocalStorageSetItem(ACTIVE_SPINE_KEY, JSON.stringify(row));
    window.dispatchEvent(new CustomEvent('sps_production_spine_updated', { detail: { title: t } }));
  } catch {
    /* ignore */
  }
  return row;
}

export function resolveShotSpine(shot, shotIndex = 0, shots = [], spine = null) {
  const parsed = parseSceneAndShotID(shot, shotIndex);
  const s =
    spine ||
    readActiveProductionSpine() ||
    buildProductionSpine({ projectTitle: '', shots });
  const scene =
    (s.scenes || []).find((sc) => sc.sceneNumber === parsed.sceneNum) ||
    (s.scenes || []).find((sc) => (sc.shotIds || []).includes(parsed.shortId));
  const seqNum = scene?.sequenceSeq || parsed.sceneNum;
  const seq = (s.sequences || []).find((q) => Number(q.seq) === Number(seqNum));
  const act = scene?.act || seq?.act || 1;
  const actNode = (s.acts || []).find((a) => Number(a.act) === Number(act));
  return {
    act,
    actTitle: actNode?.title || ACT_TITLES[act] || `Act ${act}`,
    sequenceSeq: seqNum,
    sequenceTitle: seq?.title || `Sequence ${seqNum}`,
    sceneNumber: parsed.sceneNum,
    sceneTag: parsed.sceneTag,
    sceneShotId: parsed.shortId,
    sceneHeading: scene?.heading || '',
    sequenceSynopsis: seq?.synopsis || scene?.synopsis || ''
  };
}

function rebuildActsFromSequences(sequences = [], prevActs = []) {
  const titleByAct = new Map();
  (Array.isArray(prevActs) ? prevActs : []).forEach((a) => {
    if (a && a.act != null && a.title) titleByAct.set(Number(a.act), a.title);
  });
  const actMap = new Map();
  (Array.isArray(sequences) ? sequences : []).forEach((seq) => {
    const act = Number(seq.act) || 1;
    if (!actMap.has(act)) {
      actMap.set(act, {
        act,
        title: titleByAct.get(act) || ACT_TITLES[act] || `Act ${act}`,
        sequenceSeqs: []
      });
    }
    actMap.get(act).sequenceSeqs.push(Number(seq.seq));
  });
  return Array.from(actMap.values()).sort((a, b) => a.act - b.act);
}

function mergeSpineOverrides(nextSpine, prevSpine) {
  if (!prevSpine?.sequences?.length || !nextSpine?.sequences?.length) return nextSpine;
  const sequences = nextSpine.sequences.map((seq) => {
    const old = prevSpine.sequences.find((s) => Number(s.seq) === Number(seq.seq));
    if (!old) return seq;
    return {
      ...seq,
      title: old.title || seq.title,
      synopsis: old.synopsis || seq.synopsis,
      act: Number(old.act) || seq.act
    };
  });
  const acts = rebuildActsFromSequences(sequences, prevSpine.acts);
  const scenes = (nextSpine.scenes || []).map((sc) => {
    const prevScene = (prevSpine.scenes || []).find(
      (p) => p.id === sc.id || Number(p.sceneNumber) === Number(sc.sceneNumber)
    );
    const sequenceSeq = prevScene?.sequenceSeq != null ? prevScene.sequenceSeq : sc.sequenceSeq;
    const seq = sequences.find((s) => Number(s.seq) === Number(sequenceSeq));
    return seq
      ? { ...sc, sequenceSeq: Number(seq.seq), act: seq.act }
      : { ...sc, sequenceSeq };
  });
  return { ...nextSpine, sequences, acts, scenes };
}

export function patchProductionSpineSequence(projectTitle, seqNum, patch = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const spine =
    readProductionSpine(title) ||
    buildProductionSpine({ projectTitle: title, shots: [], storyPackage: readStoryPackageForTitle(title) });
  const n = Number(seqNum);
  const sequences = (spine.sequences || []).map((s) =>
    Number(s.seq) === n ? { ...s, ...patch, seq: n } : s
  );
  const acts = rebuildActsFromSequences(sequences, spine.acts);
  const scenes = (spine.scenes || []).map((sc) => {
    const seq = sequences.find((s) => Number(s.seq) === Number(sc.sequenceSeq));
    return seq ? { ...sc, act: seq.act } : sc;
  });
  return saveProductionSpine({ ...spine, projectTitle: title, sequences, acts, scenes });
}

/** P91 — Edit act title (manual override preserved across rebuilds). */
export function patchProductionSpineAct(projectTitle, actNum, patch = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const spine =
    readProductionSpine(title) ||
    buildProductionSpine({ projectTitle: title, shots: [], storyPackage: readStoryPackageForTitle(title) });
  const n = Number(actNum) || 1;
  let acts = Array.isArray(spine.acts) ? spine.acts.slice() : [];
  const idx = acts.findIndex((a) => Number(a.act) === n);
  const nextAct = {
    act: n,
    title: patch.title != null ? String(patch.title).trim() || (ACT_TITLES[n] || `Act ${n}`) : ACT_TITLES[n] || `Act ${n}`,
    sequenceSeqs: idx >= 0 ? acts[idx].sequenceSeqs || [] : []
  };
  if (idx >= 0) acts[idx] = { ...acts[idx], ...nextAct };
  else acts.push(nextAct);
  acts = acts.sort((a, b) => a.act - b.act);
  return saveProductionSpine({ ...spine, projectTitle: title, acts });
}

/** P90 — Reassign a scene to a different sequence. */
export function patchProductionSpineScene(projectTitle, sceneIdOrNumber, patch = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const spine =
    readProductionSpine(title) ||
    buildProductionSpine({ projectTitle: title, shots: [], storyPackage: readStoryPackageForTitle(title) });
  const scenes = (spine.scenes || []).map((sc) => {
    const match =
      String(sc.id) === String(sceneIdOrNumber) ||
      Number(sc.sceneNumber) === Number(sceneIdOrNumber);
    if (!match) return sc;
    const sequenceSeq =
      patch.sequenceSeq != null ? Number(patch.sequenceSeq) : Number(sc.sequenceSeq);
    const seq = (spine.sequences || []).find((s) => Number(s.seq) === sequenceSeq);
    return {
      ...sc,
      ...patch,
      sequenceSeq,
      act: seq?.act != null ? Number(seq.act) : sc.act
    };
  });
  return saveProductionSpine({ ...spine, projectTitle: title, scenes });
}

export { ACT_TITLES, rebuildActsFromSequences };

export function spineSummary(spine) {
  if (!spine) {
    return { acts: 0, sequences: 0, scenes: 0, shots: 0 };
  }
  return {
    acts: (spine.acts || []).length,
    sequences: (spine.sequences || []).length,
    scenes: (spine.scenes || []).length,
    shots: spine.shotCount || 0
  };
}

export function syncProductionSpine({ projectTitle = '', shots = [], storyPackage = null } = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const prev = readProductionSpine(title);
  const spine = buildProductionSpine({ projectTitle: title, shots, storyPackage });
  const merged = mergeSpineOverrides(spine, prev);
  return saveProductionSpine(merged);
}

/** True when stored spine is missing or out of date vs live Matrix / Story Package. */
export function spineNeedsRebuild(title, shots = [], storyPackage = null) {
  const t = normalizeProjectTitle(title);
  if (!isUsableProjectTitle(t)) return false;
  const stored = readProductionSpine(t);
  const liveCount = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived).length;
  if (!stored) return liveCount > 0;
  if (Number(stored.shotCount) !== liveCount) return true;
  const pkg = storyPackage || readStoryPackageForTitle(t);
  if (pkg?.updatedAt && stored.updatedAt) {
    if (Date.parse(pkg.updatedAt) > Date.parse(stored.updatedAt)) return true;
  }
  return false;
}

/** Rebuild spine when Matrix or Story Package drift; preserves manual sequence edits. */
export function autoSyncProductionSpine({
  projectTitle = '',
  shots = [],
  storyPackage = null,
  force = false
} = {}) {
  const title = normalizeProjectTitle(projectTitle);
  if (!isUsableProjectTitle(title)) return null;
  if (!force && !spineNeedsRebuild(title, shots, storyPackage)) {
    return readProductionSpine(title) || readActiveProductionSpine();
  }
  const pkg = storyPackage || readStoryPackageForTitle(title);
  return syncProductionSpine({ projectTitle: title, shots, storyPackage: pkg });
}

export function applyOpenProductionSpine(project) {
  if (typeof window === 'undefined' || !project?.title) return;
  const stored = project.productionSpine || readProductionSpine(project.title);
  if (stored?.projectTitle) {
    saveProductionSpine(stored, { active: true });
    return;
  }
  if (Array.isArray(project.shots) && project.shots.length) {
    syncProductionSpine({
      projectTitle: project.title,
      shots: project.shots,
      storyPackage: project.storyPackage
    });
  }
}

export function parkProductionSpineForTitle(title) {
  if (typeof window === 'undefined') return;
  const t = normalizeProjectTitle(title);
  if (!t) return;
  const active = readActiveProductionSpine();
  if (active && String(active.projectTitle || '').toLowerCase() === t.toLowerCase()) {
    saveProductionSpine(active, { active: false });
    localStorage.removeItem(ACTIVE_SPINE_KEY);
  }
}
