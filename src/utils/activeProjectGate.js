/**
 * P0d — Active project write gate.
 * Parse / Apply / Writer→Matrix must never write into an ambiguous film.
 */

import { titlesMatch } from './projectWorkspace';

export function normalizeProjectTitle(title) {
  return String(title || '').trim();
}

export function isUsableProjectTitle(title) {
  const t = normalizeProjectTitle(title);
  if (!t) return false;
  const upper = t.toUpperCase();
  if (upper === 'STAGE PRODUCTION STUDIO') return false;
  if (upper === 'UNTITLED' || upper === 'NEW CINEMA PROJECT') return false;
  return true;
}

/**
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function assertActiveProjectForWrite(activeTitle, { intendedTitle = '' } = {}) {
  const active = normalizeProjectTitle(activeTitle);
  if (!isUsableProjectTitle(active)) {
    return {
      ok: false,
      code: 'NO_ACTIVE_PROJECT',
      message:
        'Open or create a named project in Project Console before writing shots. Untitled / default studio titles are blocked.'
    };
  }
  const intended = normalizeProjectTitle(intendedTitle);
  if (intended && isUsableProjectTitle(intended) && !titlesMatch(active, intended)) {
    return {
      ok: false,
      code: 'TITLE_MISMATCH',
      message: `Target “${intended}” does not match the active project “${active}”. Switch projects or change the target before applying.`
    };
  }
  return { ok: true };
}

/**
 * P100/P102 — Boot / switch health: active title, bible stamp, and room must agree.
 */
export function assertProjectIsolationHealth({
  activeTitle = '',
  bibleTitle = '',
  roomId = '',
  expectedRoomId = ''
} = {}) {
  const active = normalizeProjectTitle(activeTitle);
  if (!isUsableProjectTitle(active)) {
    return {
      ok: false,
      code: 'NO_ACTIVE_PROJECT',
      message: 'No usable active project title — open a named film before writing.'
    };
  }
  const bible = normalizeProjectTitle(bibleTitle);
  if (bible && isUsableProjectTitle(bible) && !titlesMatch(active, bible)) {
    return {
      ok: false,
      code: 'BIBLE_TITLE_MISMATCH',
      message: `Cast/World cache is stamped for “${bible}” but active film is “${active}”. Reloading titled vault.`
    };
  }
  const room = String(roomId || '').trim();
  const expected = String(expectedRoomId || '').trim();
  if (room && expected && room !== expected && room === 'SPS-CLOUD-8821') {
    return {
      ok: false,
      code: 'LEGACY_SHARED_ROOM',
      message: `Collab room is still the legacy shared room; migrate to ${expected}.`
    };
  }
  return { ok: true, code: 'OK', activeTitle: active };
}

export function readIsolationSnapshot() {
  if (typeof window === 'undefined') {
    return { activeTitle: '', bibleTitle: '', roomId: '' };
  }
  try {
    return {
      activeTitle: normalizeProjectTitle(localStorage.getItem('sps_current_project_title')),
      bibleTitle: normalizeProjectTitle(localStorage.getItem('sps_bible_vault_title')),
      roomId: String(localStorage.getItem('sps_current_room_id') || '').trim()
    };
  } catch {
    return { activeTitle: '', bibleTitle: '', roomId: '' };
  }
}

export function buildWriteGateSummary({
  activeTitle,
  intendedTitle = '',
  detectedScriptTitle = '',
  existingCount = 0,
  incomingCount = 0,
  actionLabel = 'Write shots'
} = {}) {
  const active = normalizeProjectTitle(activeTitle) || '(none)';
  const intended = normalizeProjectTitle(intendedTitle);
  const detected = normalizeProjectTitle(detectedScriptTitle);
  const effectiveIntended = intended || detected;
  const mismatch = Boolean(effectiveIntended && !titlesMatch(active, effectiveIntended));
  return {
    activeTitle: active,
    intendedTitle: intended,
    detectedScriptTitle: detected,
    effectiveIntended,
    mismatch,
    existingCount: Number(existingCount) || 0,
    incomingCount: Number(incomingCount) || 0,
    actionLabel
  };
}

/** Structural / slug lines that must never be treated as a film title. */
const SCRIPT_TITLE_SKIP =
  /^(?:INT\.|EXT\.|INT\/EXT|I\/E\.|FADE(?:\s+IN|\s+OUT)?|CUT TO|SMASH CUT|DISSOLVE|TITLE CARD|SUPER:|MONTAGE|CONTINUED|MORE|OMITTED|POV|INSERT|ANGLE ON|CLOSE ON|BACK TO|SERIES OF SHOTS|INTERCUT|FLASHBACK|DREAM SEQUENCE|PART\b|ACT\b|SCENE\b|SC\.?\s*\d+|SEQ\.?\s*\d+|SHOT\s+\d+|END OF|THE END)\b/i;

/**
 * Best-effort title from Fountain / title page only.
 * Never scans past the first scene/structure line — shot labels like
 * "DEMON REVEAL · WIDE" must not block Writer → Sync against the active film.
 */
export function detectScriptTitle(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const titleLine = raw.match(/^Title:\s*(.+)$/im);
  if (titleLine) return normalizeProjectTitle(titleLine[1]);

  const writtenByIdx = raw.search(/^Written by/im);
  if (writtenByIdx > 0) {
    const block = raw.slice(0, writtenByIdx).trim();
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const candidate = lines[lines.length - 1];
    if (
      candidate &&
      candidate.length >= 2 &&
      candidate.length <= 100 &&
      !SCRIPT_TITLE_SKIP.test(candidate)
    ) {
      return normalizeProjectTitle(candidate);
    }
  }

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const titlePage = [];
  for (const line of lines.slice(0, 24)) {
    if (SCRIPT_TITLE_SKIP.test(line) || /^(\d+\.)?\s*(INT\.|EXT\.)/i.test(line)) break;
    titlePage.push(line);
  }
  for (const line of titlePage) {
    // Character cues are usually a short ALL-CAPS name — skip single-token cues.
    if (/^[A-Z0-9 @._-]{2,40}$/.test(line) && !/\s/.test(line)) continue;
    if (line.length >= 3 && line.length <= 80 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
      return normalizeProjectTitle(line);
    }
  }
  return '';
}
