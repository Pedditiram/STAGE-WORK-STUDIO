/**
 * Dialogue viseme lip-sync for Stage (spec §9). Look ≠ walk; speech ≠ walk.
 */

/** ARPAbet-style phoneme → viseme. Stress digits stripped. */
export const PHONEME_TO_VISEME = {
  AA: 'AA', AE: 'AA', AH: 'AA', AO: 'O', AW: 'AA', AY: 'AA',
  B: 'M', CH: 'E', D: 'L', DH: 'L', EH: 'E', ER: 'E', EY: 'E',
  F: 'F', G: 'E', HH: 'E', IH: 'E', IY: 'E', JH: 'E',
  K: 'E', L: 'L', M: 'M', N: 'L', NG: 'E', OW: 'O', OY: 'O',
  P: 'M', R: 'L', S: 'E', SH: 'E', T: 'L', TH: 'F',
  UH: 'U', UW: 'U', V: 'F', W: 'U', Y: 'E', Z: 'E', ZH: 'E',
  SIL: 'rest', SP: 'rest', PAU: 'rest'
};

const VISEME = {
  rest: { viseme: 'rest', mouthOpen: 0, mouthWide: 0, jaw: 0 },
  M: { viseme: 'M', mouthOpen: 0.02, mouthWide: 0.1, jaw: 0 },
  F: { viseme: 'F', mouthOpen: 0.12, mouthWide: 0.2, jaw: 0.04 },
  L: { viseme: 'L', mouthOpen: 0.22, mouthWide: 0.35, jaw: 0.08 },
  AA: { viseme: 'AA', mouthOpen: 0.72, mouthWide: 0.45, jaw: 0.22 },
  E: { viseme: 'E', mouthOpen: 0.38, mouthWide: 0.7, jaw: 0.1 },
  O: { viseme: 'O', mouthOpen: 0.55, mouthWide: 0.12, jaw: 0.16 },
  U: { viseme: 'U', mouthOpen: 0.32, mouthWide: 0.05, jaw: 0.1 }
};

export function visemeFromPhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return PHONEME_TO_VISEME[k] || visemeFromChar(k);
}

export function phonemeStress(token = '') {
  const m = String(token || '').toUpperCase().match(/([12])$/);
  return m ? Number(m[1]) : 0;
}

export function speechVisemeUnits(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return [{ id: 'rest', stress: 0 }];
  const parts = raw.split(/\s+/);
  const arpabet = parts.length >= 2 && parts.every((p) => {
    const k = p.toUpperCase().replace(/[0-9]/g, '');
    return Boolean(PHONEME_TO_VISEME[k]);
  });
  if (arpabet) {
    return parts.map((p) => ({
      id: visemeFromPhoneme(p),
      stress: phonemeStress(p),
      nasal: isNasalPhoneme(p),
      lisp: isLispPhoneme(p),
      funnel: isWPhoneme(p),
      bite: isFBitePhoneme(p),
      tongue: isTonguePhoneme(p),
      bunch: isRBunchPhoneme(p),
      dental: isDentalPhoneme(p),
      hush: isHushPhoneme(p),
      velar: isVelarPhoneme(p)
    }));
  }
  const units = [];
  raw.split(/(\s+)/).forEach((w) => {
    if (!w.trim()) return;
    const letters = w.replace(/[^A-Za-z]/g, '');
    const shout = letters.length >= 3 && letters === letters.toUpperCase();
    const s = w.toLowerCase();
    for (let i = 0; i < s.length; ) {
      const two = s.slice(i, i + 2);
      let id;
      let step = 1;
      if (two === 'th') { id = 'F'; step = 2; }
      else if (two === 'sh' || two === 'ch' || two === 'ng') { id = 'E'; step = 2; }
      else if (two === 'ph') { id = 'F'; step = 2; }
      else { id = visemeFromChar(s[i]); }
      const vowel = /[aeiouáàäéèiíóöuú]/.test(s[i]);
      const nasal = two === 'ng' || /[mn]/.test(s[i]);
      const lisp = two === 'sh' || two === 'zh' || /[sz]/.test(s[i]);
      const funnel = two === 'wh' || s[i] === 'w';
      const bite = two === 'ph' || /[fv]/.test(s[i]);
      const tongue = s[i] === 'l';
      const bunch = s[i] === 'r';
      const dental = two === 'th';
      const hush = two === 'ch';
      const velar = two === 'ng';
      units.push({ id, stress: shout && vowel ? 1 : 0, nasal, lisp, funnel, bite, tongue, bunch, dental, hush, velar });
      i += step;
    }
  });
  return units.length ? units : [{ id: 'rest', stress: 0 }];
}

export function speechVisemeSequence(text = '') {
  return speechVisemeUnits(text).map((u) => u.id);
}

export function visemeFromChar(ch) {
  const c = String(ch || '').toLowerCase();
  if (!c || /[\s.,!?;:'"-]/.test(c)) return 'rest';
  if (/[bmp]/.test(c)) return 'M';
  if (/[fv]/.test(c)) return 'F';
  if (/[lnt]/.test(c)) return 'L';
  if (/[aáàä]/.test(c)) return 'AA';
  if (/[eéií]/.test(c)) return 'E';
  if (/[oóö]/.test(c)) return 'O';
  if (/[uúw]/.test(c)) return 'U';
  return 'E';
}

export function isNasalPhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'N' || k === 'NG' || k === 'M' || k === 'NX' || k === 'EN' || k === 'EM';
}

/** Lateral lisp on S/Z/SH/ZH — not every E viseme. Speech ≠ walk. */
export function isLispPhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'S' || k === 'Z' || k === 'SH' || k === 'ZH';
}

/** Rounded /w/ funnel — not every U viseme. Speech ≠ walk. */
export function isWPhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'W' || k === 'WH';
}

/** Labiodental /f/ bite — not TH. Speech ≠ walk. */
export function isFBitePhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'F' || k === 'V';
}

/** /l/ tongue — not N/T/D. Speech ≠ walk. */
export function isTonguePhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'L' || k === 'EL';
}

/** Retroflex /r/ bunch — not L. Speech ≠ walk. */
export function isRBunchPhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'R' || k === 'ER';
}

/** Interdental /th/ — not F/V bite. Speech ≠ walk. */
export function isDentalPhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'TH' || k === 'DH';
}

/** Affricate /ch/ hush — not SH lisp, not every E. Speech ≠ walk. */
export function isHushPhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'CH' || k === 'JH';
}

/** Velar /ng/ — not N/M nasal. Speech ≠ walk. */
export function isVelarPhoneme(token = '') {
  const k = String(token || '').toUpperCase().replace(/[0-9]/g, '');
  return k === 'NG';
}

export const VISEME_HOLD_SEC = 0.07;

export function visemeRuns(seq = []) {
  const runs = [];
  (seq || []).forEach((item) => {
    const id = typeof item === 'string' ? item : item?.id;
    const stress = typeof item === 'string' ? 0 : (Number(item?.stress) || 0);
    const nasal = typeof item === 'string' ? 0 : (item?.nasal ? 1 : 0);
    const lisp = typeof item === 'string' ? 0 : (item?.lisp ? 1 : 0);
    const funnel = typeof item === 'string' ? 0 : (item?.funnel ? 1 : 0);
    const bite = typeof item === 'string' ? 0 : (item?.bite ? 1 : 0);
    const tongue = typeof item === 'string' ? 0 : (item?.tongue ? 1 : 0);
    const bunch = typeof item === 'string' ? 0 : (item?.bunch ? 1 : 0);
    const dental = typeof item === 'string' ? 0 : (item?.dental ? 1 : 0);
    const hush = typeof item === 'string' ? 0 : (item?.hush ? 1 : 0);
    const velar = typeof item === 'string' ? 0 : (item?.velar ? 1 : 0);
    if (!id) return;
    const last = runs[runs.length - 1];
    if (last && last.id === id && (last.lisp || 0) === lisp && (last.nasal || 0) === nasal && (last.funnel || 0) === funnel && (last.bite || 0) === bite && (last.tongue || 0) === tongue && (last.bunch || 0) === bunch && (last.dental || 0) === dental && (last.hush || 0) === hush && (last.velar || 0) === velar) {
      last.n += 1;
      last.stress = Math.max(last.stress || 0, stress);
    } else runs.push({ id, n: 1, stress, nasal, lisp, funnel, bite, tongue, bunch, dental, hush, velar });
  });
  return runs;
}

export function emphasizeVisemeShape(shape, stress = 0) {
  const base = shape && shape.viseme ? shape : VISEME.rest;
  if (!stress) return { ...base };
  const k = stress >= 2 ? 1.28 : 1.14;
  return {
    ...base,
    mouthOpen: Math.min(1, (Number(base.mouthOpen) || 0) * k),
    jaw: Math.min(1, (Number(base.jaw) || 0) * k),
    mouthWide: Math.min(1, (Number(base.mouthWide) || 0) * (stress >= 2 ? 1.08 : 1.04))
  };
}

/** B/P/M release into a vowel — brief mouth pop. Speech ≠ walk. */
export function plosivePopFactor(run, local = 0, nextRun = null) {
  if (!run || run.id !== 'M') return 1;
  if (!nextRun || !/^(AA|E|O|U)$/.test(nextRun.id)) return 1;
  const t = Math.min(1, Math.max(0, Number(local) || 0));
  if (t < 0.88) return 1;
  return 1 + ((t - 0.88) / 0.12) * 2.4;
}

export function applyPlosivePop(shape, run, local = 0, nextRun = null) {
  const f = plosivePopFactor(run, local, nextRun);
  if (f === 1) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    mouthOpen: Math.min(1, (Number(base.mouthOpen) || 0) * f),
    jaw: Math.min(1, (Number(base.jaw) || 0) * (1 + (f - 1) * 0.45))
  };
}

/** Soft inhale on rest at line start or after a pause. Speech ≠ walk. */
export function applyInhaleRest(shape, run, local = 0, prevRun = null, idx = 0) {
  if (!run || run.id !== 'rest') return shape;
  const inhale = idx === 0 || (prevRun && prevRun.id !== 'rest');
  if (!inhale) return shape;
  const t = Math.min(1, Math.max(0, Number(local) || 0));
  if (t > 0.45) return shape;
  const u = 1 - t / 0.45;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    viseme: 'rest',
    mouthOpen: Math.max(Number(base.mouthOpen) || 0, 0.09 * u),
    jaw: Math.max(Number(base.jaw) || 0, 0.045 * u)
  };
}

/** Faint breath on rest at line start. Speech ≠ walk. */
export function breathNoiseAt(run, local = 0, idx = 0) {
  if (!run || run.id !== 'rest' || idx !== 0) return 0;
  const t = Math.min(1, Math.max(0, Number(local) || 0));
  if (t < 0.5) return t * 2 * 0.22;
  return Math.max(0, (1 - (t - 0.5) * 2) * 0.22);
}

export function applyBreathNoise(shape, run, local = 0, idx = 0) {
  const b = breathNoiseAt(run, local, idx);
  if (!b) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    breath: b,
    mouthOpen: Math.max(Number(base.mouthOpen) || 0, b * 0.35),
    mouthWide: Math.max(Number(base.mouthWide) || 0, b * 0.12)
  };
}

/** Nasal hum on N/NG/M — not B/P. Speech ≠ walk. */
export function applyNasalHum(shape, run = null) {
  if (!run?.nasal) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    nasal: 0.7,
    mouthOpen: Math.min(Number(base.mouthOpen) || 0, 0.22),
    mouthWide: Math.min(1, (Number(base.mouthWide) || 0) * 0.7 + 0.1)
  };
}

/** Side-air lisp on S/Z/SH/ZH. Does not lisp every E. Speech ≠ walk. */
export function applyLateralLisp(shape, run = null) {
  if (!run?.lisp) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    lisp: 0.72,
    mouthOpen: Math.min(1, Math.max(Number(base.mouthOpen) || 0, 0.16) * 0.92),
    mouthWide: Math.min(1, (Number(base.mouthWide) || 0) * 1.18 + 0.08),
    jaw: Math.min(1, (Number(base.jaw) || 0) * 0.85)
  };
}

/** Purse /w/ into a funnel. Does not funnel every U. Speech ≠ walk. */
export function applyWFunnel(shape, run = null) {
  if (!run?.funnel) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    funnel: 0.82,
    mouthOpen: Math.min(1, Math.max(Number(base.mouthOpen) || 0, 0.22) * 0.9),
    mouthWide: Math.min(Number(base.mouthWide) || 0, 0.08),
    jaw: Math.min(1, (Number(base.jaw) || 0) * 0.7)
  };
}

/** Teeth-on-lip /f/ bite. Does not bite TH. Speech ≠ walk. */
export function applyFBite(shape, run = null) {
  if (!run?.bite) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    bite: 0.78,
    mouthOpen: Math.min(Number(base.mouthOpen) || 0, 0.1),
    mouthWide: Math.min(1, Math.max(Number(base.mouthWide) || 0, 0.22)),
    jaw: Math.min(Number(base.jaw) || 0, 0.03)
  };
}

/** Tongue-up /l/. Does not tongue N/T. Speech ≠ walk. */
export function applyLTongue(shape, run = null) {
  if (!run?.tongue) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    tongue: 0.8,
    mouthOpen: Math.min(1, Math.max(Number(base.mouthOpen) || 0, 0.18)),
    mouthWide: Math.min(1, (Number(base.mouthWide) || 0) * 0.85 + 0.12),
    jaw: Math.min(1, Math.max(Number(base.jaw) || 0, 0.06))
  };
}

/** Retroflex /r/ bunch. Does not bunch L. Speech ≠ walk. */
export function applyRBunch(shape, run = null) {
  if (!run?.bunch) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    bunch: 0.76,
    mouthOpen: Math.min(1, Math.max(Number(base.mouthOpen) || 0, 0.2) * 0.88),
    mouthWide: Math.min(Number(base.mouthWide) || 0, 0.28),
    jaw: Math.min(1, (Number(base.jaw) || 0) * 0.8 + 0.04)
  };
}

/** Interdental /th/. Does not bite F/V. Speech ≠ walk. */
export function applyThDental(shape, run = null) {
  if (!run?.dental) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    dental: 0.74,
    mouthOpen: Math.min(1, Math.max(Number(base.mouthOpen) || 0, 0.14)),
    mouthWide: Math.min(1, (Number(base.mouthWide) || 0) * 0.9 + 0.06),
    jaw: Math.min(1, Math.max(Number(base.jaw) || 0, 0.05))
  };
}

/** Affricate /ch/ hush. Does not lisp SH or hush every E. Speech ≠ walk. */
export function applyChHush(shape, run = null) {
  if (!run?.hush) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    hush: 0.7,
    mouthOpen: Math.min(Number(base.mouthOpen) || 0, 0.2),
    mouthWide: Math.min(1, (Number(base.mouthWide) || 0) * 0.55 + 0.12),
    jaw: Math.min(Number(base.jaw) || 0, 0.06)
  };
}

/** Velar /ng/. Does not velar N/M. Speech ≠ walk. */
export function applyNgVelar(shape, run = null) {
  if (!run?.velar) return shape;
  const base = shape && shape.viseme ? shape : VISEME.rest;
  return {
    ...base,
    velar: 0.72,
    mouthOpen: Math.min(Number(base.mouthOpen) || 0, 0.16),
    mouthWide: Math.min(1, (Number(base.mouthWide) || 0) * 0.6 + 0.08),
    jaw: Math.min(Number(base.jaw) || 0, 0.05)
  };
}

export function blendVisemeShapes(a, b, u = 0) {
  const t = Math.min(1, Math.max(0, Number(u) || 0));
  const left = a && a.viseme ? a : VISEME.rest;
  const right = b && b.viseme ? b : left;
  return {
    viseme: t < 0.5 ? left.viseme : right.viseme,
    mouthOpen: (Number(left.mouthOpen) || 0) + ((Number(right.mouthOpen) || 0) - (Number(left.mouthOpen) || 0)) * t,
    mouthWide: (Number(left.mouthWide) || 0) + ((Number(right.mouthWide) || 0) - (Number(left.mouthWide) || 0)) * t,
    jaw: (Number(left.jaw) || 0) + ((Number(right.jaw) || 0) - (Number(left.jaw) || 0)) * t,
    breath: (Number(left.breath) || 0) + ((Number(right.breath) || 0) - (Number(left.breath) || 0)) * t,
    nasal: (Number(left.nasal) || 0) + ((Number(right.nasal) || 0) - (Number(left.nasal) || 0)) * t,
    lisp: (Number(left.lisp) || 0) + ((Number(right.lisp) || 0) - (Number(left.lisp) || 0)) * t,
    funnel: (Number(left.funnel) || 0) + ((Number(right.funnel) || 0) - (Number(left.funnel) || 0)) * t,
    bite: (Number(left.bite) || 0) + ((Number(right.bite) || 0) - (Number(left.bite) || 0)) * t,
    tongue: (Number(left.tongue) || 0) + ((Number(right.tongue) || 0) - (Number(left.tongue) || 0)) * t,
    bunch: (Number(left.bunch) || 0) + ((Number(right.bunch) || 0) - (Number(left.bunch) || 0)) * t,
    dental: (Number(left.dental) || 0) + ((Number(right.dental) || 0) - (Number(left.dental) || 0)) * t,
    hush: (Number(left.hush) || 0) + ((Number(right.hush) || 0) - (Number(left.hush) || 0)) * t,
    velar: (Number(left.velar) || 0) + ((Number(right.velar) || 0) - (Number(left.velar) || 0)) * t
  };
}

/**
 * Pick viseme for spoken text at time t within [start, end].
 * Consecutive same visemes hold; each run gets at least VISEME_HOLD_SEC.
 * Last 18% of a run coarticulates into the next shape.
 */
export function visemeAt(text = '', t = 0, start = 0, end = 1) {
  const raw = String(text || '').trim();
  if (!raw) return { ...VISEME.rest };
  const span = Math.max(0.08, Number(end) - Number(start) || 1);
  const seq = speechVisemeUnits(raw);
  const runs = visemeRuns(seq);
  if (!runs.length) return { ...VISEME.rest };
  const elapsed = Math.min(span, Math.max(0, Number(t) - Number(start)));
  const weights = runs.map((r) => Math.max(VISEME_HOLD_SEC, (r.n / Math.max(1, seq.length)) * span));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const scaled = weights.map((w) => (w / sum) * span);
  let acc = 0;
  let idx = runs.length - 1;
  let local = 1;
  for (let i = 0; i < runs.length; i += 1) {
    const nextAcc = acc + scaled[i];
    if (elapsed <= nextAcc) {
      idx = i;
      local = scaled[i] > 0 ? (elapsed - acc) / scaled[i] : 1;
      break;
    }
    acc = nextAcc;
  }
  let cur = emphasizeVisemeShape(VISEME[runs[idx].id] || VISEME.rest, runs[idx].stress);
  cur = applyPlosivePop(cur, runs[idx], local, runs[idx + 1]);
  cur = applyInhaleRest(cur, runs[idx], local, runs[idx - 1], idx);
  cur = applyBreathNoise(cur, runs[idx], local, idx);
  cur = applyNasalHum(cur, runs[idx]);
  cur = applyLateralLisp(cur, runs[idx]);
  cur = applyWFunnel(cur, runs[idx]);
  cur = applyFBite(cur, runs[idx]);
  cur = applyLTongue(cur, runs[idx]);
  cur = applyRBunch(cur, runs[idx]);
  cur = applyThDental(cur, runs[idx]);
  cur = applyChHush(cur, runs[idx]);
  cur = applyNgVelar(cur, runs[idx]);
  if (local < 0.82 || idx >= runs.length - 1) return cur;
  const nxt = emphasizeVisemeShape(VISEME[runs[idx + 1].id] || VISEME.rest, runs[idx + 1].stress);
  return blendVisemeShapes(cur, nxt, (local - 0.82) / 0.18);
}

export function applyLipSyncToPose(pose = {}, line = null, t = 0) {
  if (!line?.text) return pose;
  if (t < line.start || t > line.end) return pose;
  const v = visemeAt(line.text, t, line.start, line.end);
  return {
    ...pose,
    viseme: v.viseme,
    mouthOpen: Math.max(Number(pose.mouthOpen) || 0, v.mouthOpen),
    mouthWide: v.mouthWide,
    jaw: Math.max(Number(pose.jaw) || 0, v.jaw),
    breath: v.breath || 0,
    nasal: v.nasal || 0,
    lisp: v.lisp || 0,
    funnel: v.funnel || 0,
    bite: v.bite || 0,
    tongue: v.tongue || 0,
    bunch: v.bunch || 0,
    dental: v.dental || 0,
    hush: v.hush || 0,
    velar: v.velar || 0
  };
}
