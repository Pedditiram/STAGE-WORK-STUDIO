/**
 * Keep a real Matrix from being replaced by the boot placeholder or a tiny
 * different film that shares the same title (e.g. HEY 150 vs 2 concert shots).
 */

const PLACEHOLDER_MARKERS = [
  'Rain-slicked futuristic concert stage',
  'Your first scene. Replace this beat',
  'Paste your screenplay in Writer',
  'A blank page. This film is yours'
];

export function matrixLooksLikePlaceholder(shots) {
  if (!Array.isArray(shots) || !shots.length) return true;
  if (shots.length > 6) return false;
  const blob = shots
    .slice(0, 4)
    .map((s) => `${s?.actionEnvContext || ''} ${s?.sceneSynopsis || ''} ${s?.characterDialogue || ''}`)
    .join(' ');
  return PLACEHOLDER_MARKERS.some((m) => blob.includes(m));
}

function headIds(shots) {
  return (Array.isArray(shots) ? shots : [])
    .slice(0, 6)
    .map((s) => String(s?.sceneShotId || '').trim())
    .join('|');
}

function headText(shots) {
  const s = Array.isArray(shots) ? shots[0] : null;
  return String(s?.sceneSynopsis || s?.actionEnvContext || '')
    .trim()
    .slice(0, 56)
    .toLowerCase();
}

/**
 * True when incoming shots would wipe a real open Matrix.
 * Same-film edits (mute flags, cell text) with similar length are allowed.
 */
export function shouldRejectIncomingMatrix(localShots, incomingShots) {
  const localN = Array.isArray(localShots) ? localShots.length : 0;
  const remoteN = Array.isArray(incomingShots) ? incomingShots.length : 0;
  if (!remoteN) return true;
  if (matrixLooksLikePlaceholder(incomingShots) && localN >= 2 && !matrixLooksLikePlaceholder(localShots)) {
    return true;
  }
  if (localN < 8) return false;
  if (remoteN >= localN * 0.8 && headText(localShots) === headText(incomingShots)) return false;
  if (headIds(localShots) === headIds(incomingShots) && remoteN >= localN * 0.5) return false;
  const localHead = headText(localShots);
  const remoteHead = headText(incomingShots);
  if (localN >= 8 && remoteN >= 8 && localHead && remoteHead && localHead !== remoteHead) {
    return true;
  }
  if (remoteN <= Math.max(4, Math.floor(localN * 0.2))) return true;
  if (localHead && remoteHead && localHead !== remoteHead && remoteN < localN * 0.5) return true;
  return false;
}
