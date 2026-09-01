/**
 * Deeper prompt parse (spec §3). Explicit prompt tokens only.
 * Look ≠ walk. Does not invent blocking or practicals.
 */

import { parsePromptCamera, shotPromptBlob } from './stagePromptCamera.js';
import { inferLightingSetup } from './stageLighting.js';

export function parsePromptDurationSec(text = '') {
  const t = String(text || '');
  const m = t.match(/\b(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.min(30, Math.max(1, n));
}

export function parsePromptPlacement(text = '') {
  const t = String(text || '').toLowerCase();
  let x = null;
  let z = null;
  if (/stage left|frame left|camera right|left of frame/.test(t)) x = -1.05;
  else if (/stage right|frame right|camera left|right of frame/.test(t)) x = 1.05;
  if (/foreground|fg\b|downstage|near camera/.test(t)) z = 0.85;
  else if (/background|bg\b|upstage|deep in/.test(t)) z = -1.25;
  if (x == null && z == null) return null;
  return { x, z, inferred: true };
}

export function parsePromptPracticals(text = '') {
  const t = String(text || '').toLowerCase();
  const ids = [];
  if (/lantern|kerosene|oil lamp/.test(t)) ids.push('lantern');
  if (/torch|fire bowl|bonfire|campfire/.test(t)) ids.push('torch');
  if (/neon/.test(t)) ids.push('neon');
  if (/\bbulb\b|practical lamp|table lamp|bare bulb/.test(t)) ids.push('bulb');
  if (/candle/.test(t) && !ids.includes('lantern')) ids.push('lantern');
  return ids;
}

/** Explicit on/off times only — does not invent a practical that is not named. */
export function parsePromptPracticalKeys(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    const fromTo = t.match(
      new RegExp(`${kind}[^\\n.]{0,56}from\\s+(\\d+(?:\\.\\d+)?)\\s*(?:s|sec|seconds)?\\s*(?:to|-|–)\\s*(\\d+(?:\\.\\d+)?)`, 'i')
    );
    if (fromTo) {
      out[kind] = { on: Number(fromTo[1]), off: Number(fromTo[2]) };
      return;
    }
    const offAt = t.match(
      new RegExp(`(?:${kind}[^\\n.]{0,48}(?:turns?\\s+)?off(?:\\s+at)?\\s+(\\d+(?:\\.\\d+)?)|(?:turns?\\s+)?off(?:\\s+the\\s+)?${kind}[^\\n.]{0,24}(?:at\\s+)?(\\d+(?:\\.\\d+)?))`, 'i')
    );
    const onAt = t.match(new RegExp(`${kind}[^\\n.]{0,48}(?:comes\\s+)?on(?:\\s+at)?\\s+(\\d+(?:\\.\\d+)?)`, 'i'));
    const offN = offAt ? Number(offAt[1] || offAt[2]) : NaN;
    const onN = onAt ? Number(onAt[1]) : NaN;
    if (!Number.isFinite(offN) && !Number.isFinite(onN)) return;
    out[kind] = {};
    if (Number.isFinite(onN)) out[kind].on = onN;
    if (Number.isFinite(offN)) out[kind].off = offN;
  });
  return out;
}

/** Explicit intensity only (0–1 or percent). Does not invent a practical. */
export function parsePromptPracticalIntensity(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    const pct = t.match(new RegExp(`${kind}\\s+(?:at\\s+)?(\\d+(?:\\.\\d+)?)\\s*%`, 'i'));
    const word = t.match(
      new RegExp(`${kind}[^\\n.]{0,40}?\\b(?:intensity|level|dim(?:med)?)\\s+(\\d+(?:\\.\\d+)?)`, 'i')
    );
    const n = pct ? Number(pct[1]) / 100 : word ? Number(word[1]) : NaN;
    if (!Number.isFinite(n)) return;
    out[kind] = n > 1 ? Math.min(1, n / 100) : Math.min(1, Math.max(0, n));
  });
  return out;
}

/** Explicit kelvin / warm / cool only. Does not invent a practical. */
export function parsePromptPracticalKelvin(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    const kMatch = t.match(new RegExp(`${kind}\\s+(\\d{4,5})\\s*k\\b`, 'i'))
      || t.match(new RegExp(`(\\d{4,5})\\s*k\\b[^\\n.]{0,24}${kind}`, 'i'));
    if (kMatch) {
      out[kind] = Math.min(12000, Math.max(1000, Number(kMatch[1])));
      return;
    }
    if (new RegExp(`\\bwarm\\b[^\\n.]{0,24}\\b${kind}\\b|\\b${kind}\\b[^\\n.]{0,24}\\bwarm\\b`).test(t)) {
      out[kind] = 2700;
      return;
    }
    if (new RegExp(`\\bcool\\b[^\\n.]{0,24}\\b${kind}\\b|\\b${kind}\\b[^\\n.]{0,24}\\bcool\\b`).test(t)) {
      out[kind] = 7500;
    }
  });
  return out;
}

export function parsePromptPracticalGel(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (new RegExp(`\\bcto\\b[^\\n.]{0,20}\\b${kind}\\b|\\b${kind}\\b[^\\n.]{0,24}\\bcto\\b`).test(t)) out[kind] = 'cto';
    else if (new RegExp(`\\bctb\\b[^\\n.]{0,20}\\b${kind}\\b|\\b${kind}\\b[^\\n.]{0,24}\\bctb\\b`).test(t)) out[kind] = 'ctb';
    else if (new RegExp(`plus[- ]?green[^\\n.]{0,16}\\b${kind}\\b|\\b${kind}\\b[^\\n.]{0,24}plus[- ]?green`).test(t)) out[kind] = 'plus_green';
    else if (new RegExp(`\\bred gel\\b[^\\n.]{0,16}\\b${kind}\\b|\\b${kind}\\b[^\\n.]{0,20}\\bred gel\\b`).test(t)) out[kind] = 'red';
  });
  return out;
}

export function parsePromptPracticalGobo(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (/\bblinds?\b/.test(t)) out[kind] = 'blinds';
    else if (/\bwindow gobo\b|\bgobo window\b/.test(t)) out[kind] = 'window';
    else if (/\btree gobo\b|\bleaf gobo\b/.test(t)) out[kind] = 'tree';
  });
  return out;
}

export function parsePromptPracticalBarn(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (new RegExp(`\\b${kind}\\b[^\\n.]{0,28}tight barn|tight barn[^\\n.]{0,20}\\b${kind}\\b`).test(t)) out[kind] = 'tight';
    else if (/\bbarn[- ]?doors?\b|\btop barn\b/.test(t) && /top/.test(t)) out[kind] = 'top';
    else if (/\bside barn|\bbarn sides\b/.test(t)) out[kind] = 'side';
    else if (/\bbarn[- ]?doors?\b/.test(t)) out[kind] = 'tight';
  });
  return out;
}

export function parsePromptPracticalShutter(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (new RegExp(`\\b${kind}\\b[^\\n.]{0,28}shutter[^\\n.]{0,12}closed|closed shutter[^\\n.]{0,16}\\b${kind}\\b`).test(t)) {
      out[kind] = 'closed';
    } else if (new RegExp(`\\b${kind}\\b[^\\n.]{0,28}(?:half|½) shutter|(?:half|½) shutter[^\\n.]{0,16}\\b${kind}\\b`).test(t)) {
      out[kind] = 'half';
    } else if (/\bshutter closed\b|\bclosed shutter\b/.test(t)) {
      out[kind] = 'closed';
    } else if (/\bhalf shutter\b|\bshutter half\b/.test(t)) {
      out[kind] = 'half';
    }
  });
  return out;
}

export function parsePromptPracticalBounce(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    const hasFill = new RegExp(`\\b${kind}\\b[^\\n.]{0,24}\\bfill\\b|\\bfill\\b[^\\n.]{0,20}\\b${kind}\\b`).test(t);
    const hasBounce = new RegExp(`\\b${kind}\\b[^\\n.]{0,24}\\bbounce\\b|\\bbounce\\b[^\\n.]{0,20}\\b${kind}\\b`).test(t);
    if (hasFill && hasBounce) out[kind] = 'mix';
    else if (hasFill) out[kind] = 'fill';
    else if (hasBounce) out[kind] = 'bounce';
  });
  return out;
}

export function parsePromptPracticalBounceColor(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (!/\bbounce\b|\bfill\b/.test(t)) return;
    if (/\bwarm bounce\b|\bbounce warm\b|\bwarm card\b/.test(t)) out[kind] = 'warm';
    else if (/\bcool bounce\b|\bbounce cool\b|\bcool card\b/.test(t)) out[kind] = 'cool';
    else if (/\bsilver bounce\b|\bbounce silver\b|\bsilver card\b/.test(t)) out[kind] = 'silver';
  });
  return out;
}

export function parsePromptPracticalBounceAngle(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (!/\bbounce\b|\bfill\b/.test(t)) return;
    const m = t.match(/\bbounce\b(?:\s+at)?\s+(-?\d+(?:\.\d+)?)\s*(deg|degree|°)/i)
      || t.match(/\bat\s+(-?\d+(?:\.\d+)?)\s*(deg|degree|°)/i)
      || t.match(/\bbounce\b(?:\s+at)?\s+(-?\d+)(?!\.\d)(?!\s*(?:m|cm|meter|metres|meters))\b/i);
    if (!m) return;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return;
    out[kind] = Math.min(80, Math.max(-80, n));
  });
  return out;
}

export function parsePromptPracticalBounceDistance(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (!/\bbounce\b|\bfill\b/.test(t)) return;
    const m = t.match(/\bbounce\s+distance\s+(\d+(?:\.\d+)?)\s*(m|cm|meter|metres|meters)?/i)
      || t.match(/\bbounce\b(?:\s+card)?\s+(\d+(?:\.\d+)?)\s*(m|meters?|metres?|cm)\b(?!\s*high)/i);
    if (!m) return;
    let n = Number(m[1]);
    if (!Number.isFinite(n)) return;
    const unit = String(m[2] || 'm').toLowerCase();
    if (unit === 'cm') n /= 100;
    out[kind] = Math.min(2.5, Math.max(0.2, n));
  });
  return out;
}

export function parsePromptPracticalBounceHeight(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (!/\bbounce\b|\bfill\b/.test(t)) return;
    const m = t.match(/\bbounce\s+height\s+(\d+(?:\.\d+)?)\s*(m|cm|meter|metres|meters)?/i)
      || t.match(/\bbounce\b(?:\s+card)?\s+(\d+(?:\.\d+)?)\s*(m|meters?|metres?|cm)?\s*high/i);
    if (!m) return;
    let n = Number(m[1]);
    if (!Number.isFinite(n)) return;
    const unit = String(m[2] || 'm').toLowerCase();
    if (unit === 'cm') n /= 100;
    out[kind] = Math.min(1.8, Math.max(0.05, n));
  });
  return out;
}

export function parsePromptPracticalBounceTilt(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (!/\bbounce\b|\bfill\b/.test(t)) return;
    const m = t.match(/\bbounce\s+tilt\s+(-?\d+(?:\.\d+)?)\s*(deg|degree|°)?/i)
      || t.match(/\btilt\s+(-?\d+(?:\.\d+)?)\s*(deg|degree|°)/i);
    if (!m) return;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return;
    out[kind] = Math.min(45, Math.max(-45, n));
  });
  return out;
}

export function parsePromptPracticalBounceSpread(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (!/\bbounce\b|\bfill\b/.test(t)) return;
    if (/\bwide bounce\b|\bbounce wide\b|\bwide card\b/.test(t)) {
      out[kind] = 1.45;
      return;
    }
    if (/\bnarrow bounce\b|\bbounce narrow\b|\bnarrow card\b/.test(t)) {
      out[kind] = 0.65;
      return;
    }
    const m = t.match(/\bbounce\s+spread\s+(\d+(?:\.\d+)?)/i)
      || t.match(/\bspread\s+(\d+(?:\.\d+)?)\s*(?:x|times)?/i);
    if (!m) return;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return;
    out[kind] = Math.min(2.5, Math.max(0.4, n));
  });
  return out;
}

export function parsePromptPracticalBounceFeather(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (!/\bbounce\b|\bfill\b/.test(t)) return;
    if (/\bsoft bounce\b|\bbounce soft\b|\bsoft card\b|\bfeathered bounce\b/.test(t)) {
      out[kind] = 0.72;
      return;
    }
    if (/\bhard bounce\b|\bbounce hard\b|\bhard card\b/.test(t)) {
      out[kind] = 0.18;
      return;
    }
    const m = t.match(/\bbounce\s+feather\s+(\d+(?:\.\d+)?)/i)
      || t.match(/\bfeather\s+(\d+(?:\.\d+)?)\s*%?/i);
    if (!m) return;
    let n = Number(m[1]);
    if (!Number.isFinite(n)) return;
    if (n > 1) n /= 100;
    out[kind] = Math.min(1, Math.max(0, n));
  });
  return out;
}

export function parsePromptPracticalBounceSpill(text = '') {
  const t = String(text || '').toLowerCase();
  const kinds = ['lantern', 'torch', 'neon', 'bulb'];
  const out = {};
  kinds.forEach((kind) => {
    const named = new RegExp(`\\b${kind}\\b`).test(t) || (kind === 'lantern' && /oil lamp|kerosene/.test(t));
    if (!named) return;
    if (!/\bbounce\b|\bfill\b/.test(t)) return;
    if (/\bbounce wrap|\bwrap(?:s|ping)? bounce\b|\bfloor spill\b|\bspill on (?:the )?floor\b/.test(t)) {
      out[kind] = 0.65;
      return;
    }
    const m = t.match(/\bbounce\s+spill\s+(\d+(?:\.\d+)?)/i)
      || t.match(/\bspill\s+(\d+(?:\.\d+)?)\s*%?/i);
    if (!m) return;
    let n = Number(m[1]);
    if (!Number.isFinite(n)) return;
    if (n > 1) n /= 100;
    out[kind] = Math.min(1, Math.max(0, n));
  });
  return out;
}

export function parseLookVersusWalk(text = '') {
  const t = String(text || '').toLowerCase();
  const look = /looks? at|gazes?|stares?|eye[\s-]?line/.test(t);
  const walk = /walk|approach|stride|run|cross|go(es)? toward|moves toward/.test(t);
  return {
    lookOnly: look && !walk,
    walkExplicit: walk
  };
}

/**
 * One-pass direction from video prompt + craft blob.
 */
export function parsePromptDirection(shotOrText = {}) {
  const blob = typeof shotOrText === 'string' ? shotOrText : shotPromptBlob(shotOrText);
  const camera = parsePromptCamera(blob);
  const lookWalk = parseLookVersusWalk(blob);
  const practicals = parsePromptPracticals(blob);
  const practicalKeys = parsePromptPracticalKeys(blob);
  const practicalIntensity = parsePromptPracticalIntensity(blob);
  const practicalKelvin = parsePromptPracticalKelvin(blob);
  return {
    camera,
    durationSec: parsePromptDurationSec(blob),
    placement: parsePromptPlacement(blob),
    practicals,
    practicalKeys,
    practicalIntensity,
    practicalKelvin,
    practicalGel: parsePromptPracticalGel(blob),
    practicalGobo: parsePromptPracticalGobo(blob),
    practicalBarn: parsePromptPracticalBarn(blob),
    practicalShutter: parsePromptPracticalShutter(blob),
    practicalBounce: parsePromptPracticalBounce(blob),
    practicalBounceColor: parsePromptPracticalBounceColor(blob),
    practicalBounceAngle: parsePromptPracticalBounceAngle(blob),
    practicalBounceDistance: parsePromptPracticalBounceDistance(blob),
    practicalBounceHeight: parsePromptPracticalBounceHeight(blob),
    practicalBounceTilt: parsePromptPracticalBounceTilt(blob),
    practicalBounceSpread: parsePromptPracticalBounceSpread(blob),
    practicalBounceFeather: parsePromptPracticalBounceFeather(blob),
    practicalBounceSpill: parsePromptPracticalBounceSpill(blob),
    lightingSetup: inferLightingSetup(typeof shotOrText === 'string' ? { videoPrompt: blob } : shotOrText, {}),
    lookOnly: lookWalk.lookOnly,
    walkExplicit: lookWalk.walkExplicit,
    highAngle: /high angle|top[- ]down|bird'?s[- ]eye/.test(blob.toLowerCase()),
    lowAngle: /low angle|worm'?s[- ]eye|from below/.test(blob.toLowerCase())
  };
}

export function applyPlacementToHumans(humans = [], placement) {
  if (!placement || !humans.length) return humans;
  return humans.map((h, i) => {
    if (i !== 0) return h;
    const pos = [...(h.position || [0, 0, 0])];
    if (placement.x != null) pos[0] = placement.x;
    if (placement.z != null) pos[2] = placement.z;
    return { ...h, position: pos };
  });
}
