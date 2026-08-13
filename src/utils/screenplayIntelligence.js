/**
 * Writer Console — beyond-industry screenplay intelligence.
 * Offline, instant analysis: continuity, pacing, cinema DNA, Matrix readiness.
 */
import {
  classifyScreenplayLines,
  extractSceneOutline,
  estimatePageCount,
  getElementAtCaret,
  getLineIndexAtOffset
} from './screenplayFormat.js';

const ACTION_HEAT = /\b(run|chase|explode|crash|slash|fire|battle|charge|strike|shatter|roar|fight|leap|dive|smash|blast|war|attack|kill|fall|scream|thunder|surge|collide)\b/i;
const QUIET_BEAT = /\b(whisper|silence|still|gaze|breathe|pause|soft|gentle|calm|wait|look|think|remember)\b/i;
const INT_RE = /\bINT\.?/i;
const EXT_RE = /\bEXT\.?/i;
const DAY_RE = /\b(DAY|DAWN|MORNING|AFTERNOON|SUNRISE)\b/i;
const NIGHT_RE = /\b(NIGHT|DUSK|EVENING|SUNSET|MIDNIGHT)\b/i;

function normalizeCharName(name) {
  return String(name || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+(V\.?O\.?|O\.?S\.?|CONT'?D)\s*$/i, '')
    .trim()
    .toUpperCase();
}

function isNoiseCharacter(name) {
  const n = normalizeCharName(name);
  return (
    !n ||
    n.length < 2 ||
    n.length > 36 ||
    /^(INT|EXT|EST|FADE|CUT|THE END|ACT|SC\.|SHOT|CAMERA|LIGHTING|TITLE|SUPER)$/i.test(n) ||
    /^\d+$/.test(n)
  );
}

function emotionFromIntensity(score) {
  if (score >= 75) return 'Peak / Conflict';
  if (score >= 55) return 'Rising Tension';
  if (score >= 35) return 'Active Beat';
  if (score >= 20) return 'Quiet Pulse';
  return 'Breath / Setup';
}

function summarizeBeat(title, chars, intensity) {
  const who = chars.slice(0, 3).join(', ') || 'ensemble';
  const place = String(title || 'Scene').replace(/^SC\.\s*\d+\s*/i, '').slice(0, 48);
  return `${emotionFromIntensity(intensity)} — ${who} @ ${place}`;
}

/**
 * Full screenplay intelligence pass.
 * @param {string} text
 * @param {{ caret?: number, shotCountHint?: number }} [opts]
 */
export function analyzeScreenplay(text, opts = {}) {
  const src = String(text || '');
  const classified = classifyScreenplayLines(src);
  const outline = extractSceneOutline(src);
  const pages = estimatePageCount(src);

  const sceneBlocks = [];
  const sceneStarts = outline.filter((o) => o.type === 'scene' || o.type === 'act');
  for (let i = 0; i < sceneStarts.length; i += 1) {
    const start = sceneStarts[i];
    const endLine =
      i + 1 < sceneStarts.length ? sceneStarts[i + 1].lineIndex : classified.length;
    sceneBlocks.push({
      ...start,
      endLine,
      lines: classified.slice(start.lineIndex, endLine)
    });
  }

  const characterMap = new Map();
  let totalDialogueWords = 0;
  let actionLines = 0;
  let dialogueLines = 0;
  let shotTags = 0;
  let intScenes = 0;
  let extScenes = 0;
  let dayScenes = 0;
  let nightScenes = 0;

  let currentSceneIdx = -1;
  const sceneCharSets = sceneBlocks.map(() => new Set());
  const sceneMetrics = sceneBlocks.map((block) => {
    let heat = 12;
    let dlg = 0;
    let act = 0;
    let shots = 0;
    let words = 0;
    block.lines.forEach(({ type, text: line }) => {
      const t = String(line || '');
      words += (t.match(/\b\w+\b/g) || []).length;
      if (type === 'action') {
        act += 1;
        if (ACTION_HEAT.test(t)) heat += 14;
        if (QUIET_BEAT.test(t)) heat -= 4;
        if (t === t.toUpperCase() && t.trim().length > 8) heat += 6;
      } else if (type === 'dialogue') {
        dlg += 1;
        heat += 3;
      } else if (type === 'character') {
        heat += 2;
      } else if (type === 'shot') {
        shots += 1;
        heat += 8;
      } else if (type === 'parenthetical' && /angry|shout|roar|cry|whisper/i.test(t)) {
        heat += 5;
      }
    });
    heat = Math.max(5, Math.min(100, heat + Math.min(20, shots * 4) + Math.min(15, dlg)));
    return { heat, dlg, act, shots, words };
  });

  classified.forEach((row, idx) => {
    const { type, text: line } = row;
    if (type === 'action') actionLines += 1;
    if (type === 'dialogue') {
      dialogueLines += 1;
      totalDialogueWords += (String(line).match(/\b\w+\b/g) || []).length;
    }
    if (type === 'shot') shotTags += 1;

    // Track which scene we're in
    while (
      currentSceneIdx + 1 < sceneBlocks.length &&
      idx >= sceneBlocks[currentSceneIdx + 1].lineIndex
    ) {
      currentSceneIdx += 1;
    }

    if (type === 'character') {
      const name = normalizeCharName(line);
      if (isNoiseCharacter(name)) return;
      if (!characterMap.has(name)) {
        characterMap.set(name, {
          name,
          dialogueLines: 0,
          dialogueWords: 0,
          scenes: new Set(),
          firstLine: idx,
          lastLine: idx
        });
      }
      const rec = characterMap.get(name);
      rec.lastLine = idx;
      if (currentSceneIdx >= 0) {
        rec.scenes.add(currentSceneIdx);
        sceneCharSets[currentSceneIdx].add(name);
      }
    }

    if (type === 'dialogue' && idx > 0) {
      // Attribute to previous character cue
      let j = idx - 1;
      while (j >= 0 && classified[j].type === 'parenthetical') j -= 1;
      if (j >= 0 && classified[j].type === 'character') {
        const name = normalizeCharName(classified[j].text);
        if (!isNoiseCharacter(name) && characterMap.has(name)) {
          const rec = characterMap.get(name);
          rec.dialogueLines += 1;
          rec.dialogueWords += (String(line).match(/\b\w+\b/g) || []).length;
        }
      }
    }
  });

  sceneBlocks.forEach((block, i) => {
    const title = block.title || '';
    if (INT_RE.test(title) && EXT_RE.test(title)) {
      intScenes += 0.5;
      extScenes += 0.5;
    } else if (INT_RE.test(title)) intScenes += 1;
    else if (EXT_RE.test(title)) extScenes += 1;
    if (DAY_RE.test(title)) dayScenes += 1;
    if (NIGHT_RE.test(title)) nightScenes += 1;
  });

  const characters = Array.from(characterMap.values())
    .map((c) => ({
      name: c.name,
      dialogueLines: c.dialogueLines,
      dialogueWords: c.dialogueWords,
      sceneCount: c.scenes.size,
      sceneIndexes: Array.from(c.scenes),
      firstLine: c.firstLine,
      lastLine: c.lastLine,
      sharePct:
        totalDialogueWords > 0
          ? Math.round((c.dialogueWords / totalDialogueWords) * 1000) / 10
          : 0
    }))
    .sort((a, b) => b.dialogueWords - a.dialogueWords || b.sceneCount - a.sceneCount);

  const scenes = sceneBlocks.map((block, i) => {
    const m = sceneMetrics[i];
    const chars = Array.from(sceneCharSets[i] || []);
    return {
      index: i,
      title: block.title,
      offset: block.offset,
      lineIndex: block.lineIndex,
      intensity: m.heat,
      emotion: emotionFromIntensity(m.heat),
      dialogueLines: m.dlg,
      actionLines: m.act,
      shotTags: m.shots,
      words: m.words,
      characters: chars,
      beatSummary: summarizeBeat(block.title, chars, m.heat),
      dialogueRatio: m.dlg + m.act > 0 ? Math.round((m.dlg / (m.dlg + m.act)) * 100) : 0
    };
  });

  const totalSceneLoc = intScenes + extScenes || 1;
  const totalTone = dayScenes + nightScenes || 1;
  const lineUnits = actionLines + dialogueLines || 1;

  const cinemaDNA = {
    intPct: Math.round((intScenes / totalSceneLoc) * 100),
    extPct: Math.round((extScenes / totalSceneLoc) * 100),
    dayPct: Math.round((dayScenes / totalTone) * 100),
    nightPct: Math.round((nightScenes / totalTone) * 100),
    dialoguePct: Math.round((dialogueLines / lineUnits) * 100),
    actionPct: Math.round((actionLines / lineUnits) * 100),
    shotTags,
    pages,
    sceneCount: scenes.filter((s) => !/^ACT\s+/i.test(s.title)).length,
    characterCount: characters.length
  };

  const flags = buildContinuityFlags(classified, characters, scenes, src);
  const readiness = scoreProductionReadiness({
    cinemaDNA,
    characters,
    scenes,
    flags,
    shotCountHint: opts.shotCountHint || shotTags
  });

  const caret = typeof opts.caret === 'number' ? opts.caret : 0;
  const suggestion = predictNextLine(src, caret, characters, classified);

  return {
    characters,
    scenes,
    cinemaDNA,
    flags,
    readiness,
    beats: scenes.map((s) => ({
      title: s.title,
      offset: s.offset,
      emotion: s.emotion,
      intensity: s.intensity,
      summary: s.beatSummary,
      characters: s.characters
    })),
    suggestion
  };
}

function buildContinuityFlags(classified, characters, scenes, src) {
  const flags = [];

  if (!scenes.length) {
    flags.push({
      id: 'no_scenes',
      severity: 'warn',
      message: 'No scene headings detected — add INT./EXT. sluglines for Matrix sync.',
      offset: 0
    });
  }

  characters.forEach((c) => {
    if (c.dialogueLines === 0 && c.sceneCount > 0) {
      flags.push({
        id: `mute_${c.name}`,
        severity: 'info',
        message: `${c.name} appears but never speaks — intentional mute, or missing dialogue?`,
        offset: lineOffset(classified, c.firstLine)
      });
    }
    if (c.sharePct >= 55 && characters.length >= 2) {
      flags.push({
        id: `dominate_${c.name}`,
        severity: 'info',
        message: `${c.name} holds ${c.sharePct}% of dialogue — check ensemble balance.`,
        offset: lineOffset(classified, c.firstLine)
      });
    }
  });

  // Orphan dialogue: dialogue without prior character cue
  classified.forEach((row, idx) => {
    if (row.type !== 'dialogue') return;
    let j = idx - 1;
    while (j >= 0 && classified[j].type === 'blank') j -= 1;
    while (j >= 0 && classified[j].type === 'parenthetical') j -= 1;
    if (j < 0 || classified[j].type !== 'character') {
      flags.push({
        id: `orphan_dlg_${idx}`,
        severity: 'warn',
        message: `Orphan dialogue (no character cue): “${String(row.text).slice(0, 42)}…”`,
        offset: lineOffset(classified, idx)
      });
    }
  });

  // Near-duplicate character names (fuzzy continuity)
  for (let i = 0; i < characters.length; i += 1) {
    for (let j = i + 1; j < characters.length; j += 1) {
      const a = characters[i].name;
      const b = characters[j].name;
      if (a.includes(b) || b.includes(a)) {
        flags.push({
          id: `name_dup_${a}_${b}`,
          severity: 'warn',
          message: `Possible name continuity clash: “${a}” vs “${b}”.`,
          offset: lineOffset(classified, characters[i].firstLine)
        });
      }
    }
  }

  // Long dry stretches (no dialogue for many action lines)
  let dry = 0;
  classified.forEach((row, idx) => {
    if (row.type === 'action') dry += 1;
    else if (row.type === 'dialogue' || row.type === 'character') dry = 0;
    if (dry === 18) {
      flags.push({
        id: `dry_${idx}`,
        severity: 'info',
        message: 'Long action stretch without dialogue — pacing may flatten.',
        offset: lineOffset(classified, idx)
      });
    }
  });

  // Scene with zero characters tagged
  scenes.forEach((s) => {
    if (!/^ACT\s+/i.test(s.title) && s.characters.length === 0 && s.words > 40) {
      flags.push({
        id: `ghost_scene_${s.index}`,
        severity: 'info',
        message: `Scene may lack character cues: ${String(s.title).slice(0, 40)}`,
        offset: s.offset
      });
    }
  });

  // Cap noise
  const priority = { warn: 0, info: 1 };
  return flags
    .sort((a, b) => priority[a.severity] - priority[b.severity])
    .slice(0, 24);
}

function lineOffset(classified, lineIndex) {
  let off = 0;
  for (let i = 0; i < lineIndex && i < classified.length; i += 1) {
    off += String(classified[i].text || '').length + 1;
  }
  return off;
}

function scoreProductionReadiness({ cinemaDNA, characters, scenes, flags, shotCountHint }) {
  const factors = [];
  let score = 0;

  const realScenes = scenes.filter((s) => !/^ACT\s+/i.test(s.title));
  if (realScenes.length >= 3) {
    score += 18;
    factors.push({ ok: true, label: `${realScenes.length} scenes structured` });
  } else {
    factors.push({ ok: false, label: 'Need 3+ scene headings' });
  }

  if (characters.length >= 2) {
    score += 16;
    factors.push({ ok: true, label: `${characters.length} speaking roles tracked` });
  } else {
    factors.push({ ok: false, label: 'Add character cues + dialogue' });
  }

  if (cinemaDNA.dialoguePct >= 15 && cinemaDNA.actionPct >= 15) {
    score += 14;
    factors.push({ ok: true, label: 'Healthy action / dialogue mix' });
  } else {
    factors.push({ ok: false, label: 'Balance action vs dialogue' });
  }

  if (shotCountHint >= 3 || cinemaDNA.shotTags >= 3) {
    score += 18;
    factors.push({ ok: true, label: 'Shot tags → Matrix-ready' });
  } else {
    factors.push({ ok: false, label: 'Add [SHOT …] tags for Matrix sync' });
  }

  if (cinemaDNA.pages >= 2) {
    score += 10;
    factors.push({ ok: true, label: `~${cinemaDNA.pages} page draft` });
  } else {
    factors.push({ ok: false, label: 'Expand draft length' });
  }

  const warns = flags.filter((f) => f.severity === 'warn').length;
  if (warns === 0) {
    score += 14;
    factors.push({ ok: true, label: 'No critical continuity flags' });
  } else {
    score += Math.max(0, 14 - warns * 3);
    factors.push({ ok: false, label: `${warns} continuity warning(s)` });
  }

  // Pacing variety bonus
  if (realScenes.length >= 2) {
    const heats = realScenes.map((s) => s.intensity);
    const spread = Math.max(...heats) - Math.min(...heats);
    if (spread >= 25) {
      score += 10;
      factors.push({ ok: true, label: 'Pacing contrast across scenes' });
    } else {
      factors.push({ ok: false, label: 'Vary scene intensity for arc' });
    }
  }

  score = Math.max(0, Math.min(100, score));
  let grade = 'Draft';
  if (score >= 85) grade = 'Matrix Ready';
  else if (score >= 70) grade = 'Production Strong';
  else if (score >= 50) grade = 'Developing';
  else if (score >= 30) grade = 'Outline';

  return { score, grade, factors };
}

/**
 * Predictive next-line assist — muscle memory beyond Tab/Enter.
 */
export function predictNextLine(text, caret, characters, classifiedMaybe) {
  const classified = classifiedMaybe || classifyScreenplayLines(text);
  const idx = getLineIndexAtOffset(text, caret);
  const current = classified[idx]?.type || getElementAtCaret(text, caret);
  const prev = idx > 0 ? classified[idx - 1]?.type : 'blank';
  const topChars = (characters || []).slice(0, 5).map((c) => c.name);

  if (current === 'scene_heading' || (current === 'blank' && prev === 'scene_heading')) {
    return {
      label: 'Action',
      insert: '',
      hint: 'Describe the visual world — who enters, what moves, atmosphere.'
    };
  }
  if (current === 'character') {
    return {
      label: 'Dialogue / Parenthetical',
      insert: '',
      hint: 'Write spoken line, or (parenthetical) then dialogue.'
    };
  }
  if (current === 'dialogue' || current === 'parenthetical') {
    const nextSpeaker = topChars[0] ? suggestAlternateSpeaker(classified, idx, topChars) : null;
    return {
      label: nextSpeaker ? `Next: ${nextSpeaker}` : 'Action or next character',
      insert: nextSpeaker ? `\n\n${nextSpeaker}\n` : '\n\n',
      hint: nextSpeaker
        ? `Press Apply to cue ${nextSpeaker} — your most-used alternate voice.`
        : 'Continue with action, or cue the next character in ALL CAPS.'
    };
  }
  if (current === 'action') {
    const lead = topChars[0];
    return {
      label: lead ? `Cue ${lead}` : 'Character cue',
      insert: lead ? `\n\n${lead}\n` : '\n\n',
      hint: lead
        ? `Suggest cueing ${lead}, or write another ALL-CAPS character name.`
        : 'Add a CHARACTER name in ALL CAPS to start dialogue.'
    };
  }
  if (current === 'shot') {
    return {
      label: 'Action under shot',
      insert: '\n',
      hint: 'Follow shot tag with action description for Matrix crafts.'
    };
  }
  return {
    label: 'Scene heading',
    insert: '\n\nEXT. LOCATION - DAY\n\n',
    hint: 'Start a new slugline: INT./EXT. LOCATION - TIME'
  };
}

function suggestAlternateSpeaker(classified, idx, topChars) {
  let last = null;
  for (let i = idx; i >= 0; i -= 1) {
    if (classified[i].type === 'character') {
      last = normalizeCharName(classified[i].text);
      break;
    }
  }
  const alt = topChars.find((n) => n !== last);
  return alt || topChars[0] || null;
}

export function intensityColor(score) {
  if (score >= 75) return '#f43f5e';
  if (score >= 55) return '#f59e0b';
  if (score >= 35) return '#22d3ee';
  if (score >= 20) return '#34d399';
  return '#71717a';
}
