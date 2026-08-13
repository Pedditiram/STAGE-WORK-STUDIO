/**
 * Industry screenplay formatting helpers (Fountain-aligned).
 * Element cycle matches Final Draft / Fade In muscle memory:
 * Scene → Action → Character → Parenthetical → Dialogue → Transition → Scene…
 */

export const SCREENPLAY_ELEMENTS = [
  'scene_heading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
  'centered',
  'note',
  'blank'
];

export const ELEMENT_LABELS = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot Tag',
  timing: 'Timing',
  centered: 'Centered',
  note: 'Note',
  blank: 'Blank'
};

/** Scan-mode colors (dark paper). */
export const ELEMENT_COLORS = {
  scene_heading: '#fbbf24', // amber — sluglines / SC.08
  action: '#f4f4f5', // near-white — readable on dark paper
  character: '#67e8f9', // cyan — speaker cues
  parenthetical: '#a3a3a3',
  dialogue: '#86efac', // green
  transition: '#c084fc', // purple
  shot: '#f0abfc', // fuchsia — [SHOT] / camera / S07-B
  timing: '#5eead4', // teal — clocks / durations
  centered: '#fcd34d',
  note: '#fde047', // yellow notes
  blank: 'transparent'
};

/** Approx US Letter page units (Courier 12pt ≈ 55 lines/page). */
export const LINES_PER_PAGE = 55;

const SCENE_RE = /^(?:\.(?=[A-Z])|(?:INT|EXT|EST|I\/E|INT\.\/EXT)[.\s])/i;
const TRANSITION_RE = /^(?:CUT TO|FADE (?:IN|OUT)|DISSOLVE TO|SMASH CUT|MATCH CUT|JUMP CUT|WIPE TO|FADE TO BLACK)[:.]?\s*$/i;
const PAREN_RE = /^\(.*\)$/;
const SHOT_RE = /^\[?\s*SHOT\b|^\[SHOT\s/i;
const SHOT_ID_RE = /^S\d{1,3}(?:-[A-Z0-9]+)?\b/i;
const TIMING_RE = /^\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}\b|^\d+(?:\.\d+)?\s*sec(?:onds?)?\b/i;
const CAMERA_LINE_RE = /^(?:Camera|Lighting|Lens|Subject Color|BG (?:Lighting|Color)|Atmosphere)\s*:/i;
const CHARACTER_RE = /^[A-Z0-9][A-Z0-9\s.\-'’]{0,36}$/;

export function classifyScreenplayLine(rawLine, prevType = 'blank') {
  const line = String(rawLine ?? '');
  const trimmed = line.trim();
  if (!trimmed) return 'blank';

  if (trimmed.startsWith('[[') || trimmed.startsWith('/*') || trimmed.startsWith('= ')) return 'note';
  if (TIMING_RE.test(trimmed)) return 'timing';
  if (
    SHOT_RE.test(trimmed) ||
    CAMERA_LINE_RE.test(trimmed) ||
    SHOT_ID_RE.test(trimmed) ||
    /^(?:Aerial|CU|MCU|ECU|WS|EWS|MS|OTS|POV|Low Angle|High Angle|Tracking|Steadicam|Handheld)\b/i.test(trimmed)
  ) {
    return 'shot';
  }
  if (SCENE_RE.test(trimmed) || /^SC\.\s*\d+/i.test(trimmed) || /^ACT\s+/i.test(trimmed)) return 'scene_heading';
  if (TRANSITION_RE.test(trimmed) || (trimmed.endsWith('TO:') && trimmed === trimmed.toUpperCase())) return 'transition';
  if (PAREN_RE.test(trimmed)) return 'parenthetical';

  const upper = trimmed === trimmed.toUpperCase();
  const looksCharacter =
    upper &&
    trimmed.length <= 38 &&
    !trimmed.includes('.') &&
    CHARACTER_RE.test(trimmed) &&
    !/^(THE END|FADE OUT|CUT TO)$/i.test(trimmed) &&
    !SHOT_ID_RE.test(trimmed);

  if (looksCharacter && (prevType === 'action' || prevType === 'blank' || prevType === 'scene_heading' || prevType === 'dialogue' || prevType === 'shot' || prevType === 'timing')) {
    return 'character';
  }
  if (prevType === 'character' || prevType === 'parenthetical') {
    return upper && looksCharacter ? 'character' : 'dialogue';
  }
  if (prevType === 'dialogue' && !upper) return 'dialogue';

  return 'action';
}

export function classifyScreenplayLines(text) {
  const lines = String(text || '').split('\n');
  let prev = 'blank';
  return lines.map((line) => {
    const type = classifyScreenplayLine(line, prev);
    if (type !== 'blank') prev = type;
    return { text: line, type };
  });
}

export function cycleElementType(current) {
  const order = ['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function nextElementAfterEnter(current) {
  switch (current) {
    case 'scene_heading':
      return 'action';
    case 'action':
      return 'action';
    case 'character':
      return 'dialogue';
    case 'parenthetical':
      return 'dialogue';
    case 'dialogue':
      return 'character'; // blank then character often — we insert blank+ready
    case 'transition':
      return 'scene_heading';
    case 'shot':
      return 'action';
    case 'timing':
      return 'shot';
    default:
      return 'action';
  }
}

/** Format a line string for a target element type (Fountain-ish). */
export function formatLineAsElement(text, type) {
  let t = String(text || '').trim();
  switch (type) {
    case 'scene_heading': {
      if (!t) return 'EXT. LOCATION - DAY';
      if (!SCENE_RE.test(t) && !/^SC\./i.test(t) && !/^ACT\s/i.test(t)) {
        t = `EXT. ${t.toUpperCase()}`;
      }
      return t.toUpperCase();
    }
    case 'character':
      return (t || 'CHARACTER').toUpperCase().replace(/^\(+|\)+$/g, '');
    case 'parenthetical':
      if (!t) return '(beat)';
      return PAREN_RE.test(t) ? t : `(${t})`;
    case 'transition':
      if (!t) return 'CUT TO:';
      return t.toUpperCase().endsWith(':') ? t.toUpperCase() : `${t.toUpperCase()}:`;
    case 'shot':
      if (!t) return '[SHOT S01-A]: Medium Shot';
      return t;
    case 'note':
      if (!t) return '[[NOTE: ]]';
      return t.startsWith('[[') ? t : `[[${t}]]`;
    case 'dialogue':
    case 'action':
    default:
      return t;
  }
}

export function applyElementToCurrentLine(fullText, selectionStart, targetType) {
  const text = String(fullText || '');
  const pos = Math.max(0, Math.min(selectionStart ?? 0, text.length));
  const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  let lineEnd = text.indexOf('\n', pos);
  if (lineEnd === -1) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  const classified = classifyScreenplayLines(text);
  const lineIndex = text.slice(0, lineStart).split('\n').length - 1;
  const currentType = classified[lineIndex]?.type || 'action';
  const nextType = targetType || cycleElementType(currentType === 'blank' ? 'action' : currentType);
  const formatted = formatLineAsElement(line, nextType);
  const next = text.slice(0, lineStart) + formatted + text.slice(lineEnd);
  const caret = lineStart + formatted.length;
  return { text: next, caret, elementType: nextType, lineStart, lineEnd: lineStart + formatted.length };
}

export function handleSmartEnter(fullText, selectionStart) {
  const text = String(fullText || '');
  const pos = Math.max(0, Math.min(selectionStart ?? 0, text.length));
  const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  let lineEnd = text.indexOf('\n', pos);
  if (lineEnd === -1) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  const classified = classifyScreenplayLines(text);
  const lineIndex = text.slice(0, lineStart).split('\n').length - 1;
  const currentType = classified[lineIndex]?.type || 'action';
  const nextType = nextElementAfterEnter(currentType);

  let insert = '\n';
  if (currentType === 'dialogue' && nextType === 'character') {
    insert = '\n\n';
  } else if (currentType === 'scene_heading') {
    insert = '\n';
  }

  // If mid-line, split; else append
  const before = text.slice(0, pos);
  const after = text.slice(pos);
  let nextText = `${before}${insert}${after}`;
  let caret = before.length + insert.length;

  // Prefill character/transition templates when empty new line
  if (nextType === 'scene_heading' && !after.trim().startsWith('EXT') && !after.trim().startsWith('INT')) {
    // leave blank for typing
  }
  if (nextType === 'parenthetical') {
    const pre = '()';
    nextText = `${before}${insert}${pre}${after}`;
    caret = before.length + insert.length + 1;
  }

  return { text: nextText, caret, elementType: nextType };
}

export function extractSceneOutline(text) {
  const lines = String(text || '').split('\n');
  const scenes = [];
  let charOffset = 0;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const isScene =
      SCENE_RE.test(trimmed) ||
      /^SC\.\s*\d+/i.test(trimmed) ||
      (/^ACT\s+/i.test(trimmed) && trimmed.length < 80);
    if (isScene) {
      scenes.push({
        index: scenes.length,
        lineIndex: idx,
        offset: charOffset,
        title: trimmed.slice(0, 80),
        type: /^ACT\s+/i.test(trimmed) ? 'act' : 'scene'
      });
    }
    charOffset += line.length + 1;
  });
  return scenes;
}

export function estimatePageCount(text) {
  const classified = classifyScreenplayLines(text);
  let units = 0;
  classified.forEach(({ type, text: line }) => {
    if (type === 'blank') {
      units += 0.5;
      return;
    }
    const len = Math.max(1, Math.ceil(String(line).length / 60));
    if (type === 'scene_heading') units += 2;
    else if (type === 'character') units += 1;
    else if (type === 'parenthetical') units += 1;
    else if (type === 'dialogue') units += len;
    else if (type === 'transition') units += 1.5;
    else units += len;
  });
  return Math.max(1, Math.ceil(units / LINES_PER_PAGE));
}

export function estimateRuntimeMinutes(text) {
  // Industry rule of thumb: 1 page ≈ 1 minute
  return estimatePageCount(text);
}

export function getLineIndexAtOffset(text, offset) {
  const before = String(text || '').slice(0, Math.max(0, offset));
  return before.split('\n').length - 1;
}

export function getElementAtCaret(text, caret) {
  const classified = classifyScreenplayLines(text);
  const idx = getLineIndexAtOffset(text, caret);
  return classified[idx]?.type || 'action';
}

/** Normalize loose script text toward Fountain-friendly newlines. */
export function normalizeToFountain(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim() + '\n';
}

export function findAllMatches(text, query, { caseSensitive = false } = {}) {
  const src = String(text || '');
  const q = String(query || '');
  if (!q) return [];
  const flags = caseSensitive ? 'g' : 'gi';
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, flags);
  const matches = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return matches;
}

export function replaceMatch(text, start, end, replacement) {
  const src = String(text || '');
  return src.slice(0, start) + replacement + src.slice(end);
}

export function replaceAllMatches(text, query, replacement, { caseSensitive = false } = {}) {
  const matches = findAllMatches(text, query, { caseSensitive });
  if (!matches.length) return { text, count: 0 };
  let out = String(text || '');
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const m = matches[i];
    out = replaceMatch(out, m.start, m.end, replacement);
  }
  return { text: out, count: matches.length };
}
