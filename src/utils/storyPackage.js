/**
 * P0a — Durable Story Package.
 * INPUT → Story Package (review) → Matrix Apply.
 * SoT lives per project title; never only ephemeral React state.
 */

import { isUsableProjectTitle, normalizeProjectTitle } from './activeProjectGate';
import { safeLocalStorageSetItem } from './safeStorage';
import { assertProjectWriteGate } from './productionLifecycle';
import { isGuestPlayTitle } from './guestPlayground';
import { appendCreativeAudit } from './creativeAuditLog';
import { titlesMatch } from './projectWorkspace';

export const ACTIVE_STORY_PACKAGE_KEY = 'sps_active_story_package';
export const STORY_PACKAGE_STATUS = {
  DRAFT: 'draft',
  READY: 'ready',
  APPLIED: 'applied'
};

function slugProjectTitle(title) {
  const s = String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'untitled';
}

export function storyPackageKeyForTitle(title) {
  return `sps_story_package::${slugProjectTitle(title)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function clip(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function sceneNumFromShotId(id) {
  const m = String(id || '').match(/SC\s*0*(\d+)/i);
  return m ? Number(m[1]) : 0;
}

/** Derive scene list from proposed shots (screenplay / matrix parse). */
export function scenesFromShots(shots = []) {
  const map = new Map();
  (Array.isArray(shots) ? shots : []).forEach((shot, idx) => {
    const n = sceneNumFromShotId(shot?.sceneShotId) || Math.floor(idx / 4) + 1;
    if (!map.has(n)) {
      map.set(n, {
        id: `scene_${String(n).padStart(2, '0')}`,
        sceneNumber: n,
        heading: clip(shot?.timeAndLightingEnv || shot?.actionEnvContext || `Scene ${n}`, 120),
        synopsis: clip(shot?.sceneSynopsis || shot?.actionEnvContext || '', 280),
        shotIds: []
      });
    }
    const row = map.get(n);
    if (shot?.sceneShotId) row.shotIds.push(shot.sceneShotId);
    if (!row.synopsis && shot?.sceneSynopsis) row.synopsis = clip(shot.sceneSynopsis, 280);
  });
  return Array.from(map.values()).sort((a, b) => a.sceneNumber - b.sceneNumber);
}

export function normalizeSequences(raw = []) {
  return (Array.isArray(raw) ? raw : [])
    .filter((s) => s && (s.synopsis || s.title || s.dramaticBeat))
    .map((s, i) => ({
      seq: Number(s.seq) || i + 1,
      title: clip(s.title || `Sequence ${i + 1}`, 80),
      minutes: Number(s.minutes) || null,
      timeOfDay: clip(s.timeOfDay || '', 40),
      locations: Array.isArray(s.locations) ? s.locations.map((l) => clip(l, 60)).filter(Boolean) : [],
      characters: Array.isArray(s.characters) ? s.characters.map((c) => clip(c, 40)).filter(Boolean) : [],
      synopsis: clip(s.synopsis || s.dramaticBeat || '', 400),
      dramaticBeat: clip(s.dramaticBeat || '', 160)
    }));
}

export function buildLogline({ synopsis = '', sequences = [], scenes = [], shots = [], projectTitle = '' } = {}) {
  const fromSyn = clip(synopsis, 220);
  if (fromSyn) return fromSyn;
  const seq0 = sequences[0]?.synopsis || sequences[0]?.dramaticBeat;
  if (seq0) return clip(seq0, 220);
  const sc0 = scenes[0]?.synopsis;
  if (sc0) return clip(sc0, 220);
  const sh0 = shots[0]?.sceneSynopsis || shots[0]?.actionEnvContext;
  if (sh0) return clip(sh0, 220);
  return projectTitle ? `Story package for ${projectTitle}` : '';
}

/**
 * Build a durable Story Package from parse + optional full-elements synthesis.
 */
export function buildStoryPackage({
  projectTitle = '',
  shots = [],
  fullElements = null,
  parseMeta = null,
  sourceText = '',
  previous = null
} = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const meta = parseMeta || {};
  const sequences = normalizeSequences(meta.sequences || previous?.sequences || []);
  const proposedShots = Array.isArray(shots)
    ? shots
    : Array.isArray(fullElements?.shots)
      ? fullElements.shots
      : [];
  const scenes = scenesFromShots(proposedShots);
  const synopsis =
    clip(fullElements?.screenplayText || meta.screenplayText || sourceText, 1200) ||
    clip(previous?.synopsis || '', 1200);
  const logline = buildLogline({
    synopsis: clip(
      (typeof window !== 'undefined' && localStorage.getItem('sps_extracted_master_story')) || synopsis,
      400
    ),
    sequences,
    scenes,
    shots: proposedShots,
    projectTitle: title
  });

  const id =
    previous?.id && titlesLooseMatch(previous.projectTitle, title)
      ? previous.id
      : `story_${slugProjectTitle(title)}_${Date.now()}`;

  return {
    id,
    projectTitle: title,
    status: STORY_PACKAGE_STATUS.READY,
    createdAt: previous?.createdAt || nowIso(),
    updatedAt: nowIso(),
    source: meta.source || previous?.source || 'parse',
    logline,
    synopsis: clip(synopsis, 4000),
    runtimeMinutes: meta.runtimeMinutes || fullElements?.runtimeMinutes || previous?.runtimeMinutes || null,
    detectedGenre: fullElements?.detectedGenre || previous?.detectedGenre || '',
    sequences,
    scenes,
    sequenceCount: sequences.length || meta.sequenceCount || 0,
    sceneCount: scenes.length,
    shotCount: proposedShots.length,
    proposedShots,
    proposedCharacters: Array.isArray(fullElements?.characters) ? fullElements.characters : previous?.proposedCharacters || [],
    proposedWorldAssets: Array.isArray(fullElements?.worldAssets)
      ? fullElements.worldAssets
      : previous?.proposedWorldAssets || [],
    directorPsychology: fullElements?.directorPsychology || previous?.directorPsychology || null,
    dopVision: fullElements?.dopVision || previous?.dopVision || null,
    soundVision: fullElements?.soundVision || previous?.soundVision || null,
    screenplayText: fullElements?.screenplayText || meta.screenplayText || previous?.screenplayText || '',
    parseWarning: meta.warning || null,
    appliedAt: null
  };
}

function titlesLooseMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export function readStoryPackageForTitle(title) {
  if (typeof window === 'undefined') return null;
  const t = normalizeProjectTitle(title);
  if (!t) return null;
  try {
    const raw = localStorage.getItem(storyPackageKeyForTitle(t));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function readActiveStoryPackage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_STORY_PACKAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoryPackage(pkg, { activate = true } = {}) {
  if (typeof window === 'undefined' || !pkg) return null;
  const title = normalizeProjectTitle(pkg.projectTitle);
  const next = {
    ...pkg,
    projectTitle: title,
    updatedAt: nowIso()
  };
  try {
    if (isUsableProjectTitle(title)) {
      safeLocalStorageSetItem(storyPackageKeyForTitle(title), JSON.stringify(next));
    }
    if (activate) {
      safeLocalStorageSetItem(ACTIVE_STORY_PACKAGE_KEY, JSON.stringify(next));
    }
    window.dispatchEvent(new CustomEvent('sps_story_package_updated', { detail: { title, status: next.status } }));
    stampStoryPackageOntoLibrary(title, next);
  } catch {
    /* ignore */
  }
  return next;
}

function stampStoryPackageOntoLibrary(title, pkg) {
  if (typeof window === 'undefined' || !isUsableProjectTitle(title)) return;
  try {
    const raw = localStorage.getItem('sps_project_library');
    const library = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(library)) return;
    let changed = false;
    const nextLib = library.map((p) => {
      if (!titlesLooseMatch(p?.title, title)) return p;
      changed = true;
      return { ...p, storyPackage: pkg, lastModifiedIso: nowIso() };
    });
    if (changed) {
      safeLocalStorageSetItem('sps_project_library', JSON.stringify(nextLib));
    }
  } catch {
    /* ignore */
  }
}

export function applyOpenStoryPackage(project) {
  if (typeof window === 'undefined' || !project) return null;
  const title = normalizeProjectTitle(project.title);
  const fromProject = project.storyPackage && typeof project.storyPackage === 'object' ? project.storyPackage : null;
  const fromTitle = readStoryPackageForTitle(title);
  const pkg = fromProject || fromTitle;
  if (!pkg) {
    try {
      localStorage.removeItem(ACTIVE_STORY_PACKAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
  const normalized = {
    ...pkg,
    projectTitle: title || pkg.projectTitle
  };
  try {
    safeLocalStorageSetItem(ACTIVE_STORY_PACKAGE_KEY, JSON.stringify(normalized));
    if (isUsableProjectTitle(title)) {
      safeLocalStorageSetItem(storyPackageKeyForTitle(title), JSON.stringify(normalized));
    }
    window.dispatchEvent(new CustomEvent('sps_story_package_updated', { detail: { title, status: normalized.status } }));
  } catch {
    /* ignore */
  }
  return normalized;
}

export function parkStoryPackageForTitle(title) {
  const t = normalizeProjectTitle(title);
  const active = readActiveStoryPackage();
  if (!active || !isUsableProjectTitle(t)) return active;
  if (!titlesLooseMatch(active.projectTitle, t) && isUsableProjectTitle(active.projectTitle)) {
    // Active package belongs to another film — park under its own title, not the outgoing switch title
    return saveStoryPackage(active, { activate: false });
  }
  return saveStoryPackage({ ...active, projectTitle: t }, { activate: false });
}

export function markStoryPackageApplied(pkgOrTitle) {
  const pkg =
    typeof pkgOrTitle === 'string'
      ? readStoryPackageForTitle(pkgOrTitle) || readActiveStoryPackage()
      : pkgOrTitle;
  if (!pkg) return null;
  return saveStoryPackage(
    {
      ...pkg,
      status: STORY_PACKAGE_STATUS.APPLIED,
      appliedAt: nowIso()
    },
    { activate: true }
  );
}

/** P96 — Write spine sequence/scene edits back into Story Package. */
export function writeStoryPackageFromSpine(spine, { projectTitle = '' } = {}) {
  if (!spine || typeof spine !== 'object') return null;
  const title = normalizeProjectTitle(projectTitle || spine.projectTitle);
  const prev = readStoryPackageForTitle(title) || readActiveStoryPackage();
  if (!prev && !title) return null;
  const sequences = normalizeSequences(
    (spine.sequences || []).map((s) => ({
      seq: s.seq,
      title: s.title,
      synopsis: s.synopsis,
      act: s.act
    }))
  );
  const scenes = Array.isArray(spine.scenes)
    ? spine.scenes.map((sc) => ({
        id: sc.id,
        sceneNumber: sc.sceneNumber,
        sequenceSeq: sc.sequenceSeq,
        act: sc.act,
        heading: sc.heading,
        synopsis: sc.synopsis,
        shotIds: sc.shotIds || []
      }))
    : prev?.scenes || [];
  const base = prev || {
    id: `story_${slugProjectTitle(title)}_${Date.now()}`,
    projectTitle: title,
    status: STORY_PACKAGE_STATUS.READY,
    createdAt: nowIso(),
    source: 'spine_writeback'
  };
  return saveStoryPackage(
    {
      ...base,
      projectTitle: title,
      sequences,
      scenes,
      sequenceCount: sequences.length,
      sceneCount: scenes.length,
      updatedAt: nowIso(),
      source: base.source || 'spine_writeback'
    },
    { activate: true }
  );
}

export function updateStoryPackageFields(patch = {}) {
  const active = readActiveStoryPackage();
  if (!active) return null;
  return saveStoryPackage({ ...active, ...patch }, { activate: true });
}

/** Payload for Matrix Apply — prefers durable package over ephemeral preview arrays. */
export function getApplyPayloadFromStoryPackage(pkg) {
  if (!pkg) return null;
  const shots = Array.isArray(pkg.proposedShots) ? pkg.proposedShots : [];
  if (!shots.length) return null;
  return {
    shots,
    title: pkg.projectTitle,
    fullElements: {
      shots,
      characters: pkg.proposedCharacters || [],
      worldAssets: pkg.proposedWorldAssets || [],
      directorPsychology: pkg.directorPsychology,
      dopVision: pkg.dopVision,
      soundVision: pkg.soundVision,
      screenplayText: pkg.screenplayText || '',
      detectedGenre: pkg.detectedGenre || '',
      runtimeMinutes: pkg.runtimeMinutes,
      storyPackageId: pkg.id
    }
  };
}

export function storyPackageSummary(pkg) {
  if (!pkg) {
    return { sequences: 0, scenes: 0, shots: 0, cast: 0, world: 0, status: 'none' };
  }
  return {
    sequences: Number(pkg.sequenceCount) || (pkg.sequences || []).length || 0,
    scenes: Number(pkg.sceneCount) || (pkg.scenes || []).length || 0,
    shots: Number(pkg.shotCount) || (pkg.proposedShots || []).length || 0,
    cast: (pkg.proposedCharacters || []).length || 0,
    world: (pkg.proposedWorldAssets || []).length || 0,
    status: pkg.status || STORY_PACKAGE_STATUS.DRAFT,
    logline: pkg.logline || '',
    runtimeMinutes: pkg.runtimeMinutes || null,
    source: pkg.source || 'parse'
  };
}

/**
 * Strict gates before Story Package → Matrix apply (title, package freshness, project lock).
 */
export function assertStoryPackageApplyAllowed({
  activeTitle = '',
  pkg = null,
  intendedTitle = '',
  existingShotCount = 0,
  audit = true,
  auditLabel = 'story_package_apply'
} = {}) {
  const active = normalizeProjectTitle(activeTitle);

  if (isGuestPlayTitle(active)) {
    const message = 'Guest playground — Story Package apply is disabled. Sign in to apply to a real production.';
    if (audit) {
      appendCreativeAudit({
        projectTitle: active,
        category: 'apply',
        action: 'write_blocked',
        targetType: 'story_package',
        targetId: auditLabel,
        targetLabel: 'Story Package apply',
        note: message
      });
    }
    return { ok: false, code: 'GUEST_PLAYGROUND', message };
  }

  if (!pkg || !Array.isArray(pkg.proposedShots) || !pkg.proposedShots.length) {
    const message = 'Story Package has no proposed shots — parse first.';
    if (audit) {
      appendCreativeAudit({
        projectTitle: active,
        category: 'apply',
        action: 'write_blocked',
        targetType: 'story_package',
        targetId: auditLabel,
        targetLabel: 'Story Package apply',
        note: message
      });
    }
    return { ok: false, code: 'NO_PACKAGE', message };
  }

  const pkgTitle = normalizeProjectTitle(pkg.projectTitle);
  if (isUsableProjectTitle(pkgTitle) && !titlesMatch(active, pkgTitle)) {
    const message = `Story Package belongs to “${pkgTitle}”, not active “${active}”. Re-parse or switch projects.`;
    if (audit) {
      appendCreativeAudit({
        projectTitle: active,
        category: 'apply',
        action: 'write_blocked',
        targetType: 'story_package',
        targetId: auditLabel,
        targetLabel: 'Story Package apply',
        note: message
      });
    }
    return { ok: false, code: 'PACKAGE_TITLE_MISMATCH', message };
  }

  // Prefer durable package title over noisy PDF/script title heuristics (ALL-CAPS lines
  // in paste text often false-trip TITLE_MISMATCH and grey out Apply).
  const intendedForWrite = isUsableProjectTitle(pkgTitle) ? pkgTitle : intendedTitle;
  const writeGate = assertProjectWriteGate(active, {
    intendedTitle: intendedForWrite,
    audit,
    auditLabel
  });
  if (!writeGate.ok) return writeGate;

  if (pkg.status === STORY_PACKAGE_STATUS.DRAFT) {
    const message = 'Story Package is still draft — finish parse/review before apply.';
    return { ok: false, code: 'DRAFT_PACKAGE', message };
  }

  let alreadyApplied = false;
  let warning = '';
  if (pkg.status === STORY_PACKAGE_STATUS.APPLIED && pkg.appliedAt) {
    const updated = Date.parse(pkg.updatedAt || 0);
    const applied = Date.parse(pkg.appliedAt || 0);
    if (applied && (!updated || updated <= applied)) {
      // Allow re-apply (matrix may have been cleared) — confirm modal still requires typing the title.
      alreadyApplied = true;
      warning = 'Already applied once — Confirm will write these shots to the Matrix again.';
    }
  }

  return {
    ok: true,
    projectTitle: active,
    incomingCount: pkg.proposedShots.length,
    existingShotCount: Number(existingShotCount) || 0,
    alreadyApplied,
    warning
  };
}

/** Demo/sample rows — merge prompt not required before apply. */
export function isSampleDemoShots(shots = []) {
  const arr = Array.isArray(shots) ? shots : [];
  if (!arr.length) return true;
  if (arr.length <= 2 && arr[0]?.sceneShotId === 'SC01_SH01') return true;
  return false;
}

/**
 * Gates Writer / Console merge vs overwrite apply (Story Package + mode sanity).
 */
export function assertMergeApplyAllowed({
  activeTitle = '',
  pkg = null,
  mode = 'overwrite',
  intendedTitle = '',
  existingShotCount = 0,
  incomingCount = 0,
  audit = true,
  auditLabel = 'merge_apply'
} = {}) {
  const m = mode === 'merge' ? 'merge' : 'overwrite';
  const gate = assertStoryPackageApplyAllowed({
    activeTitle,
    pkg,
    intendedTitle,
    existingShotCount,
    audit,
    auditLabel
  });
  if (!gate.ok) return gate;

  if (m === 'merge' && Number(existingShotCount) <= 0) {
    const message = 'Matrix is empty — use overwrite instead of merge.';
    return { ok: false, code: 'MERGE_EMPTY', message };
  }

  if (m === 'overwrite' && Number(existingShotCount) > 0 && Number(incomingCount) <= 0) {
    const message = 'No incoming shots to apply.';
    return { ok: false, code: 'NO_INCOMING', message };
  }

  return { ...gate, mode: m, incomingCount: Number(incomingCount) || gate.incomingCount };
}
