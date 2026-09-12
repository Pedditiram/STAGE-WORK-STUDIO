/**
 * Keep a real Matrix from being replaced by boot seed, empty shells,
 * or a different film that shares the same title (e.g. old 100-shot HEY
 * vs live 2-shot concert HEY).
 *
 * CRITICAL: The rain-slicked concert seed is a valid production starting
 * Matrix for titles like HEY — it must NOT be treated as disposable.
 */

/** True blank / first-run shells only — never production concert language. */
const BLANK_MARKERS = [
  'Your first scene. Replace this beat',
  'Paste your screenplay in Writer',
  'A blank page. This film is yours'
];

const VIRGIN_BOOT_DIALOGUE = 'The grid is failing... turn up the amps!';
const VIRGIN_BOOT_ACTION = 'Rain-slicked futuristic concert stage';
const VIRGIN_BOOT_CHAR = '@LeadSinger_Aria';

export function matrixLooksLikePlaceholder(shots) {
  if (!Array.isArray(shots) || !shots.length) return true;
  const blob = shots
    .slice(0, 4)
    .map((s) => `${s?.actionEnvContext || ''} ${s?.sceneSynopsis || ''} ${s?.characterDialogue || ''}`)
    .join(' ');
  return BLANK_MARKERS.some((m) => blob.includes(m));
}

/**
 * Untouched App INITIAL_SHOTS fingerprint — used only to block clobber,
 * never to skip saving a titled film.
 */
export function matrixLooksLikeVirginBootSeed(shots) {
  if (!Array.isArray(shots) || shots.length < 1 || shots.length > 2) return false;
  const s0 = shots[0] || {};
  const dialogue = String(s0.characterDialogue || '');
  const action = String(s0.actionEnvContext || '');
  const char = String(s0.characterIdAssetRef || '');
  if (!dialogue.includes(VIRGIN_BOOT_DIALOGUE.slice(0, 24))) return false;
  if (!action.includes(VIRGIN_BOOT_ACTION)) return false;
  if (!char.includes(VIRGIN_BOOT_CHAR)) return false;
  if (shots.length === 2) {
    const id0 = String(s0.sceneShotId || '').trim();
    const id1 = String(shots[1]?.sceneShotId || '').trim();
    if (id0 && id1 && !(id0 === 'SC01_SH01' && id1 === 'SC01_SH02')) return false;
  }
  return true;
}

/** Prefer a real Matrix (vault shots or Story Package proposed shots) over an empty shell. */
export function recoverShotsFromProject(project) {
  if (!project || typeof project !== 'object') return null;
  const shots = project.shots;
  if (Array.isArray(shots) && shots.length && !matrixLooksLikePlaceholder(shots)) {
    return shots;
  }
  const proposed = project.storyPackage?.proposedShots;
  if (Array.isArray(proposed) && proposed.length >= 8 && !matrixLooksLikePlaceholder(proposed)) {
    return proposed;
  }
  return null;
}

function headIds(shots) {
  return (Array.isArray(shots) ? shots : [])
    .slice(0, 6)
    .map((s) => String(s?.sceneShotId || '').trim())
    .join('|');
}

export function matrixHeadText(shots) {
  const s = Array.isArray(shots) ? shots[0] : null;
  return String(s?.sceneSynopsis || s?.actionEnvContext || '')
    .trim()
    .slice(0, 56)
    .toLowerCase();
}

function craftFillScore(shots) {
  if (!Array.isArray(shots) || !shots.length) return 0;
  let filled = 0;
  const keys = [
    'sceneSynopsis',
    'actionEnvContext',
    'characterIdAssetRef',
    'characterDialogue',
    'characterExpression',
    'characterPsychologyState',
    'shotComposition',
    'cameraMotionTag'
  ];
  const n = Math.min(shots.length, 12);
  for (let i = 0; i < n; i += 1) {
    const s = shots[i] || {};
    for (const k of keys) {
      if (String(s[k] || '').trim()) filled += 1;
    }
  }
  return filled;
}

/**
 * True when incoming shots would wipe a real open Matrix.
 * Same-film edits (mute flags, cell text) with similar length are allowed.
 * Different opening beat / different film under the same title is rejected.
 */
export function shouldRejectIncomingMatrix(localShots, incomingShots) {
  const localN = Array.isArray(localShots) ? localShots.length : 0;
  const remoteN = Array.isArray(incomingShots) ? incomingShots.length : 0;
  if (!remoteN) return true;

  if (matrixLooksLikePlaceholder(incomingShots) && localN >= 1 && !matrixLooksLikePlaceholder(localShots)) {
    return true;
  }

  if (
    matrixLooksLikeVirginBootSeed(incomingShots) &&
    localN >= 1 &&
    !matrixLooksLikeVirginBootSeed(localShots)
  ) {
    return true;
  }

  const localHead = matrixHeadText(localShots);
  const remoteHead = matrixHeadText(incomingShots);
  const sameIds = headIds(localShots) === headIds(incomingShots);
  const differentStory =
    Boolean(localHead && remoteHead && localHead !== remoteHead && !sameIds);

  // Old archive (many shots, different beat) must not replace a smaller live Matrix.
  if (
    differentStory &&
    localN >= 1 &&
    remoteN >= Math.max(localN * 2, 8)
  ) {
    return true;
  }

  // Tiny / blank remote must not wipe a large Matrix.
  if (localN >= 8 && remoteN <= Math.max(4, Math.floor(localN * 0.2))) return true;
  if (differentStory && localN >= 8 && remoteN < localN * 0.5) return true;

  if (localN < 8) {
    // Protect craft-rich small films from leaner alien remote wipe.
    if (
      differentStory &&
      craftFillScore(localShots) >= 8 &&
      craftFillScore(incomingShots) < craftFillScore(localShots) * 0.5
    ) {
      return true;
    }
    return false;
  }

  if (remoteN >= localN * 0.8 && localHead === remoteHead) return false;
  if (sameIds && remoteN >= localN * 0.5) return false;
  if (localN >= 8 && remoteN >= 8 && differentStory) return true;
  return false;
}
