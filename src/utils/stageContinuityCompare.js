/**
 * Match Prev comparison (spec §22). Reports what copied vs kept.
 */

function dist3(a = [0, 0, 0], b = [0, 0, 0]) {
  const dx = (a[0] || 0) - (b[0] || 0);
  const dy = (a[1] || 0) - (b[1] || 0);
  const dz = (a[2] || 0) - (b[2] || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function fmtPos(p) {
  if (!Array.isArray(p)) return '—';
  return p.map((n) => Number(n || 0).toFixed(2)).join(', ');
}

export function compareStagePlans(prevPlan = {}, nextPlan = {}) {
  const rows = [];
  const prevH = prevPlan.humans || [];
  const nextH = nextPlan.humans || [];
  const n = Math.max(prevH.length, nextH.length);
  for (let i = 0; i < n; i += 1) {
    const a = prevH[i];
    const b = nextH[i];
    if (!a || !b) {
      rows.push({
        id: (b || a)?.id || `char-${i}`,
        kind: 'human',
        changed: true,
        copied: false,
        label: (b || a)?.id || `Character ${i + 1}`,
        detail: !a ? 'New on this shot' : 'Missing on this shot'
      });
      continue;
    }
    const moved = dist3(a.position, b.position) > 0.04;
    const turned = Math.abs((a.rotationY || 0) - (b.rotationY || 0)) > 0.04;
    rows.push({
      id: b.id || a.id,
      kind: 'human',
      changed: moved || turned,
      copied: !moved && !turned,
      label: b.id || a.id,
      detail: moved || turned
        ? `${fmtPos(a.position)} → ${fmtPos(b.position)}`
        : 'Same blocking'
    });
  }
  const prevSet = prevPlan.environment?.setId || '';
  const nextSet = nextPlan.environment?.setId || '';
  if (prevSet || nextSet) {
    rows.push({
      id: 'set',
      kind: 'set',
      changed: prevSet !== nextSet,
      copied: prevSet === nextSet,
      label: 'Set',
      detail: prevSet === nextSet ? prevSet || 'same' : `${prevSet || '—'} → ${nextSet || '—'}`
    });
  }
  return {
    rows,
    copied: rows.filter((r) => r.copied).length,
    changed: rows.filter((r) => r.changed).length
  };
}

export function matchPreviousReport(prevPlan, beforePlan, afterPlan, nextShot = {}) {
  const blob = [
    nextShot.stageVideoPrompt,
    nextShot.videoPrompt,
    nextShot.characterMovement,
    nextShot.cameraMotionTag
  ]
    .map((s) => String(s || ''))
    .join(' ')
    .toLowerCase();
  const walkKept = /walk|approach|cross|turn/.test(blob);
  const reloc = /cut to|new location|different set|int\.|ext\./.test(blob);
  const cmp = compareStagePlans(prevPlan, afterPlan);
  const lines = cmp.rows.map((r) => ({
    ...r,
    copied: walkKept && r.kind === 'human' ? false : r.copied
  }));
  const summary = walkKept
    ? 'Walk/turn in this shot — character blocking not copied'
    : reloc
      ? 'New location language — set not forced from previous'
      : `Copied ${lines.filter((l) => l.copied).length} · changed ${lines.filter((l) => l.changed).length}`;
  return {
    walkKept,
    reloc,
    summary,
    lines,
    beforeCount: beforePlan?.humans?.length || 0,
    afterCount: afterPlan?.humans?.length || 0,
    pending: true
  };
}

/** Apply keeps proposed blocking; reject restores the pre-match plan. */
export function resolveMatchDecision(beforePlan, proposedPlan, action) {
  if (action === 'reject') return beforePlan || proposedPlan;
  return proposedPlan || beforePlan;
}
