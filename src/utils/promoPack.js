/**
 * Promo Pack engine — build Trailer / Teaser / Reels cut lists from Matrix shots.
 */

import {
  compileMasterCinemaCompilerPrompt,
  mergePromoBeatOntoShot
} from './compileMasterCinemaPrompt';

const TELugu_RE = /[\u0C00-\u0C7F]/;

export const PROMO_TEMPLATES = [
  {
    id: 'trailer_90',
    label: 'Trailer',
    durationSec: 90,
    blurb: '1:30 theatrical hook — conflict, stakes, title hit',
    structure: [
      { id: 'hook', label: 'Hook', share: 0.12, want: ['action', 'reveal', 'visual'] },
      { id: 'world', label: 'World', share: 0.15, want: ['establishing', 'atmosphere'] },
      { id: 'character', label: 'Character', share: 0.18, want: ['character', 'dialogue'] },
      { id: 'conflict', label: 'Conflict', share: 0.25, want: ['action', 'tension', 'dialogue'] },
      { id: 'stakes', label: 'Stakes', share: 0.18, want: ['emotion', 'reveal', 'tension'] },
      { id: 'title', label: 'Title hit', share: 0.12, want: ['visual', 'establishing'] }
    ]
  },
  {
    id: 'teaser_150',
    label: 'Teaser',
    durationSec: 150,
    blurb: '2:30 mood piece — world, character, unanswered question',
    structure: [
      { id: 'mood', label: 'Mood open', share: 0.15, want: ['atmosphere', 'establishing', 'visual'] },
      { id: 'world', label: 'World', share: 0.2, want: ['establishing', 'atmosphere'] },
      { id: 'character', label: 'Character', share: 0.22, want: ['character', 'dialogue', 'emotion'] },
      { id: 'tension', label: 'Rising tension', share: 0.23, want: ['tension', 'action', 'reveal'] },
      { id: 'question', label: 'Question / cut out', share: 0.2, want: ['reveal', 'dialogue', 'emotion'] }
    ]
  },
  {
    id: 'reel_30',
    label: 'Reel 30s',
    durationSec: 30,
    blurb: 'Vertical 30s — 4–5 punchy beats + caption',
    vertical: true,
    structure: [
      { id: 'hook', label: 'Hook', share: 0.2, want: ['action', 'visual', 'reveal'] },
      { id: 'beat1', label: 'Beat 1', share: 0.25, want: ['character', 'dialogue'] },
      { id: 'beat2', label: 'Beat 2', share: 0.25, want: ['action', 'tension'] },
      { id: 'punch', label: 'Punch / CTA', share: 0.3, want: ['reveal', 'emotion', 'visual'] }
    ]
  },
  {
    id: 'reel_15',
    label: 'Reel 15s',
    durationSec: 15,
    blurb: 'Vertical 15s — ultra-short hook',
    vertical: true,
    structure: [
      { id: 'hook', label: 'Hook', share: 0.35, want: ['action', 'visual'] },
      { id: 'twist', label: 'Twist', share: 0.35, want: ['reveal', 'dialogue'] },
      { id: 'cta', label: 'Title / CTA', share: 0.3, want: ['visual', 'establishing'] }
    ]
  },
  {
    id: 'reel_45',
    label: 'Reel 45s',
    durationSec: 45,
    blurb: 'Vertical 45s — mini story arc',
    vertical: true,
    structure: [
      { id: 'hook', label: 'Hook', share: 0.15, want: ['visual', 'action'] },
      { id: 'setup', label: 'Setup', share: 0.2, want: ['character', 'world', 'establishing'] },
      { id: 'turn', label: 'Turn', share: 0.25, want: ['tension', 'dialogue'] },
      { id: 'peak', label: 'Peak', share: 0.25, want: ['action', 'reveal'] },
      { id: 'cta', label: 'CTA', share: 0.15, want: ['emotion', 'visual'] }
    ]
  }
];

export function getPromoTemplate(id) {
  return PROMO_TEMPLATES.find((t) => t.id === id) || PROMO_TEMPLATES[0];
}

/** Parse seconds from shotDurationAndImages strings. */
export function parseShotDurationSec(shot, fallback = 4) {
  const raw = String(shot?.shotDurationAndImages || shot?.sceneSynopsis || '');
  const m =
    raw.match(/Duration:\s*(\d+(?:\.\d+)?)\s*s/i) ||
    raw.match(/(\d+(?:\.\d+)?)\s*sec/i) ||
    raw.match(/\b(\d+(?:\.\d+)?)\s*s\b/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 120) return n;
  }
  return fallback;
}

function textOf(shot) {
  return [
    shot?.sceneSynopsis,
    shot?.actionEnvContext,
    shot?.characterDialogue,
    shot?.characterMovement,
    shot?.shotComposition,
    shot?.cameraMotionTag,
    shot?.characterExpression,
    shot?.backgroundScoreMood
  ]
    .map((x) => String(x || ''))
    .join(' ')
    .toLowerCase();
}

function classifyTags(shot) {
  const t = textOf(shot);
  const tags = new Set();
  if (/ews|establishing|wide|aerial|landscape|forest|city|village|horizon/.test(t)) tags.add('establishing');
  if (/atmosphere|haze|fog|mist|volumetric|mood|dusk|dawn|night/.test(t)) tags.add('atmosphere');
  if (/action|fight|chase|battle|strike|run|explosion|arrow|clash|combat/.test(t)) tags.add('action');
  if (/reveal|twist|shock|suddenly|close-up|ecu|eyes/.test(t)) tags.add('reveal');
  if (/fear|tear|grief|love|rage|emotion|cry|smile|hope/.test(t)) tags.add('emotion');
  if (/threat|tension|stare|suspense|omen|dark|danger/.test(t)) tags.add('tension');
  if (String(shot?.characterDialogue || '').trim().length > 8) tags.add('dialogue');
  if (/@|character|rama|sita|hero|villain|protagonist/.test(t) || shot?.characterIdAssetRef) tags.add('character');
  if (/composition|crane|orbit|push|drone|cinematic/.test(t)) tags.add('visual');
  if (TELugu_RE.test(String(shot?.characterDialogue || ''))) tags.add('telugu');
  if (!tags.size) tags.add('visual');
  return tags;
}

function scoreShot(shot, want = []) {
  const tags = classifyTags(shot);
  let score = 1;
  want.forEach((w) => {
    if (tags.has(w)) score += 3;
  });
  const dlg = String(shot?.characterDialogue || '');
  if (dlg.length > 20) score += 1.5;
  if (TELugu_RE.test(dlg)) score += 1;
  if (/action|battle|reveal|ecu|low-angle/i.test(textOf(shot))) score += 1;
  // Prefer shorter clips for reels density
  const dur = parseShotDurationSec(shot, 4);
  if (dur <= 6) score += 0.5;
  if (dur > 12) score -= 0.5;
  return { score, tags, dur };
}

function pickBeats(shots, structure, targetSec) {
  const active = (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived);
  const used = new Set();
  const beats = [];
  let t = 0;

  structure.forEach((seg) => {
    const budget = Math.max(2, Math.round(targetSec * seg.share));
    const ranked = active
      .map((shot, idx) => {
        const id = shot.sceneShotId || `shot_${idx}`;
        const meta = scoreShot(shot, seg.want);
        return { shot, idx, id, ...meta, penalty: used.has(id) ? -8 : 0 };
      })
      .sort((a, b) => b.score + b.penalty - (a.score + a.penalty));

    let filled = 0;
    const picks = [];
    for (const row of ranked) {
      if (filled >= budget) break;
      if (used.has(row.id) && picks.length > 0) continue;
      const slice = Math.min(row.dur, Math.max(2, budget - filled));
      picks.push({
        segmentId: seg.id,
        segmentLabel: seg.label,
        sceneShotId: row.id,
        durationSec: Number(slice.toFixed(1)),
        startSec: t,
        endSec: Number((t + slice).toFixed(1)),
        tags: Array.from(row.tags),
        dialogue: String(row.shot.characterDialogue || '').trim(),
        action: String(row.shot.actionEnvContext || row.shot.sceneSynopsis || '').trim(),
        composition: String(row.shot.shotComposition || '').trim(),
        camera: String(row.shot.cameraMotionTag || '').trim(),
        score: row.shot.backgroundScoreMood || '',
        character: String(row.shot.characterIdAssetRef || '').trim()
      });
      used.add(row.id);
      filled += slice;
      t += slice;
    }

    // If nothing picked, still reserve a placeholder beat
    if (!picks.length && active[0]) {
      const shot = active[Math.min(beats.length, active.length - 1)];
      const slice = Math.min(parseShotDurationSec(shot, 3), budget);
      picks.push({
        segmentId: seg.id,
        segmentLabel: seg.label,
        sceneShotId: shot.sceneShotId || `SC_SH`,
        durationSec: slice,
        startSec: t,
        endSec: Number((t + slice).toFixed(1)),
        tags: Array.from(classifyTags(shot)),
        dialogue: String(shot.characterDialogue || '').trim(),
        action: String(shot.actionEnvContext || shot.sceneSynopsis || '').trim(),
        composition: String(shot.shotComposition || '').trim(),
        camera: String(shot.cameraMotionTag || '').trim(),
        score: shot.backgroundScoreMood || '',
        character: String(shot.characterIdAssetRef || '').trim()
      });
      t += slice;
    }

    beats.push(...picks);
  });

  return { beats, totalSec: Number(t.toFixed(1)) };
}

function buildCaptions(projectTitle, template, beats) {
  const title = String(projectTitle || 'UNTITLED').toUpperCase();
  const dlg = beats.map((b) => b.dialogue).filter((d) => d && d.length > 6 && !/^\[/.test(d));
  const lines = [];
  if (template.id.startsWith('trailer')) {
    lines.push(`${title}`);
    lines.push(dlg[0] ? clipLine(dlg[0], 90) : 'When destiny draws the bow…');
    lines.push(dlg[1] ? clipLine(dlg[1], 90) : '…the world must answer.');
    lines.push('Coming soon');
  } else if (template.id.startsWith('teaser')) {
    lines.push(`${title} — Official Teaser`);
    lines.push(dlg[0] ? clipLine(dlg[0], 100) : 'A world on the edge of myth.');
    lines.push(dlg[1] ? clipLine(dlg[1], 100) : 'One choice. One arrow. One legend.');
    lines.push('Watch for more');
  } else {
    lines.push(dlg[0] ? clipLine(dlg[0], 70) : `${title}`);
    lines.push(dlg[1] ? clipLine(dlg[1], 70) : 'The legend begins');
    lines.push(`#${title.replace(/\s+/g, '')} #Reels #Trailer`);
  }
  return lines;
}

function clipLine(s, max) {
  const t = String(s || '').replace(/^["']|["']$/g, '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildMusicBrief(template, beats) {
  const moods = beats.map((b) => String(b.score || '')).join(' ').toLowerCase();
  if (template.id.startsWith('reel')) {
    return 'Pulse-driven hybrid percussion + short motif sting; loudness-ready for IG/YT Shorts (−14 LUFS). Hard cuts on beats.';
  }
  if (/orchestr|string|epic|choir|drum/.test(moods)) {
    return 'Cinematic orchestral build: low drones → strings swell → percussion hit on title. Leave 1s silence before card.';
  }
  if (template.id.startsWith('teaser')) {
    return 'Sparse ambient + distant percussion; rising unresolved harmony; cut on breath before title card.';
  }
  return 'Trailer arc: pulse intro → mid conflict brass → final title boom with short tail.';
}

function findShotById(shots, sceneShotId) {
  const key = String(sceneShotId || '').trim().toUpperCase();
  if (!key) return null;
  return (Array.isArray(shots) ? shots : []).find(
    (s) => String(s?.sceneShotId || '').trim().toUpperCase() === key
  ) || null;
}

/**
 * Master cinema prompt — same frame as Stage Production Studio Compiler
 * (Script Synopsis → Scene Synopsis → Director Psychology → Bibles → Character ID → Prompt).
 */
export function compileMasterCinemaPromoPrompt({
  shot = null,
  beat = {},
  beatIndex = 0,
  projectTitle = 'Project',
  template = {},
  aspectRatio = '2.39:1'
} = {}) {
  const merged = mergePromoBeatOntoShot(shot, beat);
  if (!merged.sceneShotId && beat.sceneShotId) merged.sceneShotId = beat.sceneShotId;
  if (!merged.shotComposition && beat.composition) merged.shotComposition = beat.composition;
  if (!merged.actionEnvContext && beat.action) merged.actionEnvContext = beat.action;

  const cinema = compileMasterCinemaCompilerPrompt(merged, beatIndex, {
    projectTitle,
    durationOverrideSec: beat.durationSec || null
  });

  const segment = beat.segmentLabel || 'Promo Beat';
  const aspect = template.vertical ? '9:16 vertical' : aspectRatio || '2.39:1';
  const header = `=== STAGE PRODUCTION STUDIO — PROMO PACK · ${template.label || 'Promo'} · ${segment} ===
Project: ${projectTitle} | Aspect: ${aspect} | Beat #${beatIndex + 1}

`;

  return {
    masterCinemaPrompt: `${header}${cinema.masterCinemaPrompt}`,
    imagePrompt: cinema.mainPrompt,
    shortVideoPrompt: cinema.shortLabel,
    scriptSynopsis: cinema.scriptSynopsis,
    sceneSynopsis: cinema.sceneSynopsis,
    mainPrompt: cinema.mainPrompt
  };
}

function buildPromptPack(projectTitle, template, beats, shots = [], aspectRatio = '2.39:1') {
  return beats.slice(0, 12).map((b, i) => {
    const shot = findShotById(shots, b.sceneShotId);
    const cinema = compileMasterCinemaPromoPrompt({
      shot,
      beat: b,
      beatIndex: i,
      projectTitle,
      template,
      aspectRatio
    });
    return {
      index: i + 1,
      sceneShotId: b.sceneShotId,
      segment: b.segmentLabel,
      durationSec: b.durationSec,
      imagePrompt: cinema.imagePrompt,
      videoPrompt: cinema.shortVideoPrompt,
      masterCinemaPrompt: cinema.masterCinemaPrompt
    };
  });
}

/**
 * Build a full promo pack for one template from Matrix shots.
 */
export function buildPromoPack({
  shots = [],
  projectTitle = 'Project',
  templateId = 'trailer_90',
  aspectRatio = '2.39:1'
} = {}) {
  const template = getPromoTemplate(templateId);
  const liveShots = (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived);
  const { beats, totalSec } = pickBeats(liveShots, template.structure, template.durationSec);
  const captions = buildCaptions(projectTitle, template, beats);
  const musicBrief = buildMusicBrief(template, beats);
  const prompts = buildPromptPack(projectTitle, template, beats, liveShots, aspectRatio);

  const editorNotes = [
    `${template.label} target ${formatClock(template.durationSec)} · assembled ${formatClock(totalSec)} from ${liveShots.length} matrix shots`,
    template.vertical
      ? 'Export 1080×1920 (9:16). Safe text top/bottom 120px.'
      : `Export theatrical master; respect ${aspectRatio || '2.39:1'} if finishing for cinema.`,
    'Keep dialogue burns readable; prefer English name cards + original-language dialogue where spoken.',
    'Title card last 2–3s with logo lockup + “Coming Soon” / release URL.',
    'Master Cinema prompts match Stage Production Studio Compiler (Script Synopsis → Bibles → Character ID → Prompt).'
  ];

  return {
    template,
    projectTitle,
    targetSec: template.durationSec,
    assembledSec: totalSec,
    shotSourceCount: liveShots.length,
    beats,
    captions,
    musicBrief,
    prompts,
    editorNotes,
    createdAt: new Date().toISOString()
  };
}

export function formatClock(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Recompute Master Cinema prompts from current beats (after manual edits). */
export function rebuildPromoMasterPrompts(pack, shots = [], aspectRatio = '2.39:1') {
  if (!pack) return pack;
  const template = pack.template || {};
  const prompts = buildPromptPack(
    pack.projectTitle || 'Project',
    template,
    pack.beats || [],
    shots,
    aspectRatio
  );
  return {
    ...pack,
    prompts,
    editMode: pack.editMode || 'ai',
    promptsEnhancedAt: new Date().toISOString()
  };
}

export function clonePromoPack(pack) {
  try {
    return JSON.parse(JSON.stringify(pack));
  } catch {
    return pack;
  }
}

export function promoPackToMarkdown(pack) {
  const lines = [];
  lines.push(`# ${pack.projectTitle} — ${pack.template.label}`);
  lines.push(`Target ${formatClock(pack.targetSec)} · Assembled ${formatClock(pack.assembledSec)}`);
  if (pack.editMode) lines.push(`Edit mode: ${pack.editMode === 'manual' ? 'Manual' : 'AI Enhanced'}`);
  lines.push('');
  lines.push('## Cut list');
  pack.beats.forEach((b, i) => {
    lines.push(
      `${i + 1}. [${formatClock(b.startSec)}–${formatClock(b.endSec)}] ${b.segmentLabel} · ${b.sceneShotId} (${b.durationSec}s)`
    );
    if (b.action) lines.push(`   Action: ${clipLine(b.action, 160)}`);
    if (b.dialogue) lines.push(`   Dialogue: ${clipLine(b.dialogue, 140)}`);
  });
  lines.push('');
  lines.push('## Captions / VO');
  pack.captions.forEach((c) => lines.push(`- ${c}`));
  lines.push('');
  lines.push('## Music');
  lines.push(pack.musicBrief);
  lines.push('');
  lines.push('## Editor notes');
  (pack.editorNotes || []).forEach((n) => lines.push(`- ${n}`));
  lines.push('');
  lines.push('## Master Cinema Prompt Pack');
  lines.push('_Framed like Stage Production Studio Compiler — Script Synopsis · Scene Synopsis · Director Psychology · Character/World Bible · Character ID · Prompt._');
  lines.push('');
  (pack.prompts || []).forEach((p) => {
    lines.push(`### ${p.index}. ${p.sceneShotId} — ${p.segment}`);
    if (p.masterCinemaPrompt) {
      lines.push('');
      lines.push(p.masterCinemaPrompt);
    } else {
      lines.push(`Image: ${p.imagePrompt}`);
      lines.push(`Video: ${p.videoPrompt}`);
    }
    lines.push('');
  });
  return lines.join('\n');
}

export function promoPackToCsv(pack) {
  const headers = [
    'order',
    'start',
    'end',
    'durationSec',
    'segment',
    'sceneShotId',
    'dialogue',
    'action',
    'composition',
    'camera'
  ];
  const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
  const rows = pack.beats.map((b, i) =>
    [
      i + 1,
      formatClock(b.startSec),
      formatClock(b.endSec),
      b.durationSec,
      b.segmentLabel,
      b.sceneShotId,
      b.dialogue,
      b.action,
      b.composition,
      b.camera
    ]
      .map(esc)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

const PROMO_SAVE_KEY = 'sps_promo_packs_v1';

/** Persist current pack for the project (local device). */
export function savePromoPackLocal(pack, { projectTitle } = {}) {
  if (typeof window === 'undefined' || !pack) return null;
  const title = String(projectTitle || pack.projectTitle || 'Project').trim();
  const entry = {
    id: `promo_${Date.now()}`,
    projectTitle: title,
    templateId: pack.template?.id || 'trailer_90',
    templateLabel: pack.template?.label || 'Promo',
    savedAt: new Date().toISOString(),
    savedAtLabel: new Date().toLocaleString(),
    pack
  };
  let all = [];
  try {
    all = JSON.parse(localStorage.getItem(PROMO_SAVE_KEY) || '[]');
  } catch {
    all = [];
  }
  if (!Array.isArray(all)) all = [];
  // Keep latest per project+template at front; cap 40
  const key = `${title.toUpperCase()}::${entry.templateId}`;
  all = [entry, ...all.filter((e) => `${String(e.projectTitle || '').toUpperCase()}::${e.templateId}` !== key)].slice(
    0,
    40
  );
  localStorage.setItem(PROMO_SAVE_KEY, JSON.stringify(all));
  try {
    window.dispatchEvent(new CustomEvent('sps_promo_pack_saved', { detail: entry }));
  } catch {
    /* ignore */
  }
  return entry;
}

export function loadSavedPromoPacks(projectTitle = null) {
  if (typeof window === 'undefined') return [];
  try {
    const all = JSON.parse(localStorage.getItem(PROMO_SAVE_KEY) || '[]');
    if (!Array.isArray(all)) return [];
    if (!projectTitle) return all;
    const key = String(projectTitle).trim().toUpperCase();
    return all.filter((e) => String(e.projectTitle || '').trim().toUpperCase() === key);
  } catch {
    return [];
  }
}
