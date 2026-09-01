/**
 * P1 — DoP / Sound vision vault storage (mirrors directorPsychologyStorage pattern).
 * P87 — revision + conflict-aware save; P86 — park onto library title.
 */

function normalizeProjectTitle(title) {
  return String(title || '').trim();
}

function titlesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function parseLoose(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function asObject(data) {
  if (!data) return {};
  if (typeof data === 'string') return parseLoose(data) || {};
  if (typeof data === 'object') return { ...data };
  return {};
}

export function getDoPVisionKey(title) {
  return `sps_dopVision_${normalizeProjectTitle(title) || 'default'}`;
}

export function getSoundVisionKey(title) {
  return `sps_soundVision_${normalizeProjectTitle(title) || 'default'}`;
}

/** Pick human | ai | hybrid slice for compile based on compilerActiveMode. */
export function resolveCompilerVisionFields(vaultObj) {
  if (!vaultObj || typeof vaultObj !== 'object') return null;
  if (vaultObj.emotionalFrequencyTarget || vaultObj.lightingPhilosophy || vaultObj.musicalMotifScore) {
    return vaultObj;
  }
  const mode = vaultObj.compilerActiveMode || 'hybrid';
  return vaultObj[mode] || vaultObj.hybrid || vaultObj.human || vaultObj.ai || null;
}

function readFromLibrary(title, field) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('sps_project_library');
    const library = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(library)) return null;
    const proj = library.find((p) => titlesMatch(p?.title, title));
    return proj?.[field] || null;
  } catch {
    return null;
  }
}

export function loadDoPVision(title) {
  if (typeof window === 'undefined') return null;
  const t = normalizeProjectTitle(title);
  try {
    const fromKey = localStorage.getItem(getDoPVisionKey(t));
    if (fromKey) return fromKey;
    const fromLib = readFromLibrary(t, 'dopVision');
    if (fromLib) {
      const payload = JSON.stringify(fromLib);
      localStorage.setItem(getDoPVisionKey(t), payload);
      return payload;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function loadSoundVision(title) {
  if (typeof window === 'undefined') return null;
  const t = normalizeProjectTitle(title);
  try {
    const fromKey = localStorage.getItem(getSoundVisionKey(t));
    if (fromKey) return fromKey;
    const fromLib = readFromLibrary(t, 'soundVision');
    if (fromLib) {
      const payload = JSON.stringify(fromLib);
      localStorage.setItem(getSoundVisionKey(t), payload);
      return payload;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readDoPVisionObject(title) {
  return parseLoose(loadDoPVision(title));
}

export function readSoundVisionObject(title) {
  return parseLoose(loadSoundVision(title));
}

function saveVisionWithRevision(key, title, vault, data, { expectedRevision = null, force = false } = {}) {
  if (typeof window === 'undefined') return { ok: false, offline: true };
  try {
    const existing = parseLoose(localStorage.getItem(key)) || {};
    const rev = Number(existing.revision) || 0;
    if (expectedRevision != null && !force && Number(expectedRevision) !== rev) {
      return { ok: false, conflict: true, revision: rev, current: existing };
    }
    const next = {
      ...asObject(data),
      revision: rev + 1,
      updatedAt: nowIso()
    };
    localStorage.setItem(key, JSON.stringify(next));
    try {
      window.dispatchEvent(
        new CustomEvent('sps_department_vision_updated', {
          detail: { title, vault, revision: next.revision }
        })
      );
    } catch {
      /* ignore */
    }
    return { ok: true, revision: next.revision, data: next };
  } catch (e) {
    return { ok: false, error: e?.message || 'save failed' };
  }
}

export function saveDoPVision(title, data, opts = {}) {
  return saveVisionWithRevision(getDoPVisionKey(title), title, 'dop', data, opts);
}

export function saveSoundVision(title, data, opts = {}) {
  return saveVisionWithRevision(getSoundVisionKey(title), title, 'sound', data, opts);
}

export function applyOpenDepartmentVisions(project) {
  if (!project) return;
  const title = normalizeProjectTitle(project.title);
  if (!title) return;
  if (project.dopVision) saveDoPVision(title, project.dopVision, { force: true });
  if (project.soundVision) saveSoundVision(title, project.soundVision, { force: true });
}

/** Ensure titled keys hold the active DoP/Sound vaults (workspace park). */
export function parkDepartmentVisionsForTitle(title) {
  if (typeof window === 'undefined') return;
  const t = normalizeProjectTitle(title);
  if (!t) return;
  try {
    const dop = loadDoPVision(t);
    if (dop) localStorage.setItem(getDoPVisionKey(t), dop);
    const sound = loadSoundVision(t);
    if (sound) localStorage.setItem(getSoundVisionKey(t), sound);
  } catch {
    /* ignore */
  }
}
