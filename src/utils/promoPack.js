/**
 * Promo Pack engine — build Trailer / Teaser / Reels cut lists from Matrix shots.
 */

import {
  compileMasterCinemaCompilerPrompt,
  mergePromoBeatOntoShot
} from './compileMasterCinemaPrompt';
import { resolveShotSpine, readProductionSpine } from './productionSpine';
import { appendCreativeAudit } from './creativeAuditLog';

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

function livePromoShots(shots) {
  return (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived && !s.isMuted);
}

const APPROVED_PROMO_LIFE = new Set(['approved', 'locked']);

/** P106 — shots skipped from promo because muted/archived or not approved/locked. */
export function collectPromoBeatExclusions(shots = []) {
  return (Array.isArray(shots) ? shots : []).filter(Boolean).map((s) => {
    const reasons = [];
    if (s.isArchived) reasons.push('archived');
    if (s.isMuted) reasons.push('muted');
    const life = String(s.lifecycleStatus || 'draft').toLowerCase();
    if (!APPROVED_PROMO_LIFE.has(life)) reasons.push(`lifecycle:${life || 'draft'}`);
    if (!reasons.length) return null;
    return {
      sceneShotId: String(s.sceneShotId || s.id || '').trim(),
      reasons
    };
  }).filter(Boolean);
}

export function auditPromoBeatExclusions({ shots = [], projectTitle = '', templateId = '' } = {}) {
  const excluded = collectPromoBeatExclusions(shots);
  if (!excluded.length) return excluded;
  const preview = excluded
    .slice(0, 12)
    .map((e) => `${e.sceneShotId || '?'} (${e.reasons.join(',')})`)
    .join('; ');
  appendCreativeAudit({
    projectTitle,
    category: 'export',
    action: 'promo_beats_excluded',
    targetType: 'promo',
    targetId: templateId || 'promo',
    targetLabel: templateId || 'promo pack',
    note: `${excluded.length} muted/unapproved beats skipped: ${preview}`
  });
  return excluded;
}

function scoreShot(shot, want = []) {
  const tags = classifyTags(shot);
  let score = 1;
  want.forEach((w) => {
    if (tags.has(w)) score += 3;
  });
  const life = String(shot?.lifecycleStatus || 'draft').toLowerCase();
  if (life === 'approved' || life === 'locked') score += 2;
  if (life === 'review') score += 0.5;
  if (life === 'draft') score -= 0.25;
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

function pickBeats(shots, structure, targetSec, { projectTitle = '' } = {}) {
  const active = livePromoShots(shots);
  const spine = readProductionSpine(projectTitle) || null;
  const used = new Set();
  const beats = [];
  let t = 0;

  (Array.isArray(structure) ? structure : []).forEach((seg) => {
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
      const spineNode = resolveShotSpine(row.shot, row.idx, active, spine);
      picks.push({
        segmentId: seg.id,
        segmentLabel: seg.label,
        sceneShotId: row.id,
        durationSec: Number(slice.toFixed(1)),
        startSec: t,
        endSec: Number((t + slice).toFixed(1)),
        spineLabel: spineNode?.act
          ? `Act ${spineNode.act} · Seq ${spineNode.sequenceSeq}`
          : '',
        lifecycleStatus: row.shot?.lifecycleStatus || 'draft',
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

function buildPitchLogline(projectTitle, shots) {
  const syn = (shots || [])
    .map((s) => String(s?.sceneSynopsis || s?.scriptSynopsis || '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');
  if (syn) return `${projectTitle}: ${clipLine(syn, 320)}`;
  return `${projectTitle} — a cinematic feature built from ${(shots || []).length} production shots.`;
}

function uniqueLines(values, max = 6) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const t = clipLine(String(raw || ''), 140);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export function buildFilmPitchSlides(projectTitle, shots = []) {
  const live = (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived);
  const title = String(projectTitle || 'Untitled Feature').trim() || 'Untitled Feature';
  const logline = buildPitchLogline(title, live);
  const synopses = uniqueLines(live.map((s) => s.sceneSynopsis || s.scriptSynopsis), 5);
  const worlds = uniqueLines(
    live.map((s) => s.timeAndLightingEnv || s.actionEnvContext || s.shotComposition),
    4
  );
  const cast = uniqueLines(
    live.flatMap((s) => String(s.characterIdAssetRef || '').split(/[,;/|]+/)),
    6
  );
  const conflict = uniqueLines(
    live.map((s) => s.characterPsychologyState || s.characterDialogue || s.actionEnvContext),
    4
  );
  const looks = uniqueLines(live.map((s) => s.shotComposition || s.cameraMotionTag), 4);

  return [
    {
      id: 'cover',
      kind: 'cover',
      kicker: 'Confidential · Feature pitch',
      title,
      subtitle: 'A cinematic presentation for producers, studios, and investors.',
      points: [
        `${live.length} production shots locked in craft`,
        'Look, world, and performance bible in one slate',
        'Stage Work Studio'
      ],
      footer: 'Not a trailer cut — a business pitch book'
    },
    {
      id: 'logline',
      kind: 'page',
      kicker: '01 · The film',
      title: 'Logline',
      subtitle: logline,
      points: synopses.length ? synopses : ['Story spine will fill from Matrix synopses as shots land.'],
      footer: 'One sentence the room can repeat'
    },
    {
      id: 'world',
      kind: 'page',
      kicker: '02 · World',
      title: 'Where it lives',
      subtitle: 'Scale, light, and place — the grammar of the picture.',
      points: worlds.length ? worlds : ['World plates and lighting will pull from Matrix crafts.'],
      footer: 'Taste before plot'
    },
    {
      id: 'cast',
      kind: 'page',
      kicker: '03 · People',
      title: 'Who we follow',
      subtitle: 'Principal figures as they stand in the current bible.',
      points: cast.length ? cast : ['Cast names will appear from Character / Matrix refs.'],
      footer: 'Faces the money can remember'
    },
    {
      id: 'story',
      kind: 'page',
      kicker: '04 · Stakes',
      title: 'Conflict',
      subtitle: 'What breaks if they fail — the engine of the feature.',
      points: conflict.length ? conflict : ['Psychology and dialogue crafts will feed this page.'],
      footer: 'Drama first, spectacle second'
    },
    {
      id: 'look',
      kind: 'page',
      kicker: '05 · Picture',
      title: 'How it looks',
      subtitle: 'Framing and camera language already called on the slate.',
      points: looks.length ? looks : ['Composition and camera tags will fill this page.'],
      footer: 'The look is the deal'
    },
    {
      id: 'business',
      kind: 'page',
      kicker: '06 · Why this, why now',
      title: 'The business case',
      subtitle: 'A locked craft pipeline shortens the path from page to picture.',
      points: [
        `${live.length} shots already broken — not a treatment in search of a plan`,
        'Mythology / period epic audience with global festival and streamer appetite',
        'AI-assisted craft without giving away directorial control',
        'Clear next gates: table read, look-dev stills, finance package'
      ],
      footer: 'Production readiness is the pitch'
    },
    {
      id: 'ask',
      kind: 'close',
      kicker: '07 · The ask',
      title: 'What we need next',
      subtitle: 'Partners who want the film made — not a demo reel.',
      points: [
        'Creative partnership and/or production finance conversation',
        'Look-dev and key-art stills from the locked Matrix',
        'A dated follow-up: table, room, or term sheet',
        'Contact: Studio Admin (see Admin Settings)'
      ],
      footer: `${title} · Pitch book · Stage Work Studio`
    }
  ];
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
 * Seedance 2.5 video prompt — same lean compiler frame as Stage Production Studio.
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

  const aspect = template.vertical ? '9:16 vertical' : aspectRatio || '2.39:1';
  const cinema = compileMasterCinemaCompilerPrompt(merged, beatIndex, {
    projectTitle,
    durationOverrideSec: beat.durationSec || null,
    promoContext: {
      kind: template.label || 'Promo',
      segment: beat.segmentLabel || 'Beat',
      aspect,
      vertical: !!template.vertical
    }
  });

  return {
    masterCinemaPrompt: cinema.masterCinemaPrompt,
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
  const liveShots = livePromoShots(shots);
  const excludedBeats = collectPromoBeatExclusions(shots);

  if (template.kind === 'deck') {
    const slides = buildFilmPitchSlides(projectTitle, liveShots);
    return {
      template,
      projectTitle,
      kind: 'deck',
      slides,
      beats: [],
      captions: [],
      prompts: [],
      musicBrief: '',
      editorNotes: [
        'This is a slide / book pitch for investors and producers — not a video or prompt pack.',
        'Walk the room page by page. Print or export Markdown as a leave-behind.',
        'Swap stills from Generate onto World / Picture pages when you have key art.'
      ],
      pitchLogline: buildPitchLogline(projectTitle, liveShots),
      shotSourceCount: liveShots.length,
      targetSec: 0,
      assembledSec: 0,
      excludedBeats,
      createdAt: new Date().toISOString()
    };
  }
  const { beats, totalSec } = pickBeats(liveShots, template.structure || [], template.durationSec, {
    projectTitle
  });
  const captions = buildCaptions(projectTitle, template, beats);
  const musicBrief = buildMusicBrief(template, beats);
  const prompts = buildPromptPack(projectTitle, template, beats, liveShots, aspectRatio);

  const editorNotes = template.kind === 'deck'
    ? [
        `Pitch Deck for ${projectTitle} — ${beats.length} slides from ${liveShots.length} Matrix shots`,
        'Use as a room pitch: logline → world → cast → conflict → set pieces → ask.',
        'Swap stills from Generate / Reel onto each slide. Keep one idea per slide.',
        'Close with title lockup, runtime ambition, and a clear next step (table read / look-dev / finance).'
      ]
    : [
        `${template.label} target ${formatClock(template.durationSec)} · assembled ${formatClock(totalSec)} from ${liveShots.length} matrix shots`,
        template.vertical
          ? 'Export 1080×1920 (9:16). Safe text top/bottom 120px.'
          : `Export theatrical master; respect ${aspectRatio || '2.39:1'} if finishing for cinema.`,
        'Keep dialogue burns readable; prefer English name cards + original-language dialogue where spoken.',
        'Title card last 2–3s with logo lockup + “Coming Soon” / release URL.',
        'Prompts use Subject + Action + Scene + Style + Camera + Audio.',
        excludedBeats.length
          ? `${excludedBeats.length} muted/unapproved beats omitted from this cut (logged to creative audit on export).`
          : ''
      ].filter(Boolean);

  return {
    template,
    projectTitle,
    targetSec: template.durationSec,
    assembledSec: totalSec,
    shotSourceCount: liveShots.length,
    beats,
    captions: template.kind === 'deck'
      ? [
          buildPitchLogline(projectTitle, liveShots),
          ...captions.slice(0, 4)
        ]
      : captions,
    musicBrief,
    prompts,
    editorNotes,
    pitchLogline: template.kind === 'deck' ? buildPitchLogline(projectTitle, liveShots) : '',
    excludedBeats,
    createdAt: new Date().toISOString()
  };
}

export function formatClock(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Recompute Seedance 2.5 promo prompts from current beats (after manual edits). */
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
if (pack.template?.kind === 'deck' || pack.kind === 'deck') {
    lines.push(`# ${pack.projectTitle} — Pitch Deck`);
    lines.push('');
    lines.push('_Investor & business presentation. Not a trailer or prompt pack._');
    lines.push('');
    (pack.slides || []).forEach((slide, i) => {
      lines.push(`## ${i + 1}. ${slide.kicker || ''} — ${slide.title}`);
      if (slide.subtitle) lines.push('');
      if (slide.subtitle) lines.push(slide.subtitle);
      lines.push('');
      (slide.points || []).forEach((p) => lines.push(`- ${p}`));
      if (slide.footer) {
        lines.push('');
        lines.push(`*${slide.footer}*`);
      }
      lines.push('');
    });
    return lines.join('\n');
  }
  lines.push(`# ${pack.projectTitle} — ${pack.template.label}`);
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
  lines.push('## Video Prompt Pack');
  lines.push('_Subject + Action + Scene + Style + Camera + Audio._');
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

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for promo pack PDF export. */
export function promoPackToPrintHtml(pack, { editMode = false, roomId = '' } = {}) {
  const p = pack || {};
  const title = escapeHtml(p.projectTitle || 'Promo Pack');
  const isDeck = p.template?.kind === 'deck' || p.kind === 'deck';
  let body = '';

  if (isDeck) {
    body = (p.slides || [])
      .map(
        (slide, i) => `
        <section class="block">
          <h2>${i + 1}. ${escapeHtml(slide.kicker || '')} — ${escapeHtml(slide.title || '')}</h2>
          ${slide.subtitle ? `<p class="sub">${escapeHtml(slide.subtitle)}</p>` : ''}
          <ul>${(slide.points || []).map((pt) => `<li>${escapeHtml(pt)}</li>`).join('')}</ul>
          ${slide.footer ? `<p class="foot"><em>${escapeHtml(slide.footer)}</em></p>` : ''}
        </section>`
      )
      .join('');
  } else {
    const beatRows = (p.beats || [])
      .map(
        (b, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${formatClock(b.startSec)}–${formatClock(b.endSec)}</td>
          <td>${escapeHtml(b.segmentLabel || '')}</td>
          <td>${escapeHtml(b.sceneShotId || '')}</td>
          <td>${b.durationSec}s</td>
        </tr>`
      )
      .join('');
    const captions = (p.captions || []).map((c) => `<li>${escapeHtml(c)}</li>`).join('');
    body = `
      <h2>${escapeHtml(p.template?.label || 'Promo cut list')}${editMode ? ' · edited' : ''}</h2>
      <table>
        <thead><tr><th>#</th><th>Time</th><th>Segment</th><th>Shot</th><th>Dur</th></tr></thead>
        <tbody>${beatRows}</tbody>
      </table>
      ${captions ? `<h3>Captions / VO</h3><ul>${captions}</ul>` : ''}
      ${p.musicBrief ? `<h3>Music</h3><p>${escapeHtml(p.musicBrief)}</p>` : ''}
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Promo Pack</title>
  <style>
    @page { size: letter; margin: 0.6in; }
    body { font-family: system-ui, sans-serif; font-size: 10pt; color: #111; margin: 0; padding: 16px; line-height: 1.4; }
    h1 { font-size: 14pt; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.08em; }
    h2 { font-size: 12pt; margin: 0 0 8px; }
    h3 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin: 14px 0 6px; }
    .block { page-break-inside: avoid; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }
    .sub { color: #333; margin: 0 0 8px; }
    .foot { font-size: 9pt; color: #555; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 12px; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
    th { background: #f5f5f5; font-weight: 700; }
    ul { margin: 0; padding-left: 1.2em; }
    @media print { body { padding: 0; } }
      .doc-meta { font-size: 9pt; color: #666; margin: 0 0 12px; }
  </style>
</head>
<body>
  <h1>${title} — Promo Pack</h1>
  <p class="doc-meta">${String(roomId || '').trim() ? `Room ${escapeHtml(String(roomId).trim())} · ` : ''}${escapeHtml(new Date().toISOString())}</p>
  ${body}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

export function promoPackToCsv(pack) {
  const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
if (pack.template?.kind === 'deck' || pack.kind === 'deck') {
    const headers = ['page', 'kicker', 'title', 'subtitle', 'points', 'footer'];
    const rows = (pack.slides || []).map((s, i) =>
      [i + 1, s.kicker, s.title, s.subtitle, (s.points || []).join(' | '), s.footer].map(esc).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }
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

/** ZIP pack: README markdown + cutlist CSV (Campaign/Storyboard ZIP parity). */
export function buildPromoPackZipFiles(pack, { editMode = false, roomId = '' } = {}) {
  const p = pack || {};
  const title = p.projectTitle || 'project';
  const templateId = p.template?.id || 'promo';
  const templateLabel = p.template?.label || 'Promo';
  const isDeck = p.template?.kind === 'deck' || p.kind === 'deck';
  return [
    {
      name: 'README.md',
      content: promoPackToMarkdown(editMode ? { ...p, editMode: true } : p)
    },
    {
      name: isDeck ? 'slides.csv' : 'cutlist.csv',
      content: promoPackToCsv(p)
    },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Template: ${templateLabel} (${templateId})`,
        `Kind: ${isDeck ? 'deck' : 'cutlist'}`,
        `Beats/slides: ${isDeck ? (p.slides || []).length : (p.beats || []).length}`,
        `Edit mode: ${editMode ? 'manual' : 'auto'}`,
        `Room: ${String(roomId || '').trim() || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    }
  ];
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
