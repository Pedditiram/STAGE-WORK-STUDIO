/**
 * Stage Work Studio — Movie Investor Pitch Deck Maker
 * Story first. Opportunity second. Production third. Money fourth. Ask last.
 * Never invent box office, deals, budgets, or attached talent.
 */

import { PRODUCT } from '../constants/brand';
import { GENRE_PRESET_PROFILES, getMergedGenreProfiles } from '../constants/seedancePresets';
import { getActiveCharacterProfiles, getActiveWorldAssets } from './projectBibleVault';
import { appendCreativeAudit } from './creativeAuditLog';
import { readProductionBible } from './productionBible';

function readJsonArray(key) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export const PITCH_AUDIENCES = [
  { id: 'investor', label: 'Investor', focus: 'Story · audience · commercial · budget · ask' },
  { id: 'producer', label: 'Producer', focus: 'Story · scale · production · team' },
  { id: 'studio', label: 'Studio', focus: 'Story · cast · scale · distribution' },
  { id: 'ott', label: 'OTT', focus: 'Story · audience · runtime · platform fit' },
  { id: 'distributor', label: 'Distributor', focus: 'Genre · territories · release' },
  { id: 'coproducer', label: 'Co-Producer', focus: 'Production plan · structure · risk' },
  { id: 'actor', label: 'Actor', focus: 'Character · arc · screen presence' },
  { id: 'brand', label: 'Brand Partner', focus: 'World · audience · licensing' },
  { id: 'international', label: 'International Partner', focus: 'Story · territories · dubbing' }
];

export const PITCH_SIZES = [
  { id: 'compact', label: 'Compact', range: '12–18 slides', max: 18 },
  { id: 'standard', label: 'Standard', range: '18–24 slides', max: 24 },
  { id: 'detailed', label: 'Detailed investor', range: '24–32 slides', max: 32 }
];

/** Slide frame — ratio / paper / pixels. Separate from PITCH_SIZES (deck length). */
const EMU_INCH = 914400;
function pitchEmuFromInches(w, h) {
  return { cx: Math.round(w * EMU_INCH), cy: Math.round(h * EMU_INCH) };
}
function pitchEmuFromMm(w, h) {
  return pitchEmuFromInches(w / 25.4, h / 25.4);
}

export const PITCH_FORMATS = [
  { id: 'wide16x9', label: '16:9 HD', hint: 'Keynote / PowerPoint', ratio: '16:9', px: [1920, 1080], ...pitchEmuFromInches(13.333, 7.5), pptxType: 'screen16x9', pageCss: '13.333in 7.5in' },
  { id: 'wide16x10', label: '16:10', hint: 'Mac / Keynote', ratio: '16:10', px: [1920, 1200], ...pitchEmuFromInches(12.8, 8), pptxType: 'screen16x10', pageCss: '12.8in 8in' },
  { id: 'classic4x3', label: '4:3', hint: 'Classic projector', ratio: '4:3', px: [1024, 768], ...pitchEmuFromInches(10, 7.5), pptxType: 'screen4x3', pageCss: '10in 7.5in' },
  { id: 'cinema', label: '2.39:1', hint: 'Scope leave-behind', ratio: '2.39:1', px: [2048, 858], ...pitchEmuFromInches(13.333, 5.579), pptxType: '', pageCss: '13.333in 5.579in' },
  { id: 'a4land', label: 'A4 landscape', hint: 'Print packet', ratio: '297:210', mm: [297, 210], ...pitchEmuFromMm(297, 210), pptxType: '', pageCss: 'A4 landscape' },
  { id: 'a4port', label: 'A4 portrait', hint: 'Leave-behind', ratio: '210:297', mm: [210, 297], ...pitchEmuFromMm(210, 297), pptxType: '', pageCss: 'A4 portrait' },
  { id: 'letterland', label: 'Letter landscape', hint: 'US print', ratio: '11:8.5', inches: [11, 8.5], ...pitchEmuFromInches(11, 8.5), pptxType: '', pageCss: 'letter landscape' },
  { id: 'letterport', label: 'Letter portrait', hint: 'US leave-behind', ratio: '8.5:11', inches: [8.5, 11], ...pitchEmuFromInches(8.5, 11), pptxType: '', pageCss: 'letter' },
  { id: 'square', label: '1:1', hint: 'Digital square', ratio: '1:1', px: [1080, 1080], ...pitchEmuFromInches(10, 10), pptxType: '', pageCss: '10in 10in' },
  { id: 'story', label: '9:16', hint: 'Phone / story', ratio: '9:16', px: [1080, 1920], ...pitchEmuFromInches(7.5, 13.333), pptxType: '', pageCss: '7.5in 13.333in' }
];

export const DEFAULT_PITCH_FORMAT = 'wide16x9';

export function resolvePitchFormat(id) {
  return PITCH_FORMATS.find((f) => f.id === id) || PITCH_FORMATS[0];
}

export function pitchFormatDimension(idOrFormat) {
  const f = typeof idOrFormat === 'object' && idOrFormat ? idOrFormat : resolvePitchFormat(idOrFormat);
  if (Array.isArray(f.mm) && f.mm.length === 2) return `${f.mm[0]} × ${f.mm[1]} mm · ${f.ratio}`;
  if (Array.isArray(f.px) && f.px.length === 2) return `${f.px[0]} × ${f.px[1]} px · ${f.ratio}`;
  if (Array.isArray(f.inches) && f.inches.length === 2) return `${f.inches[0]} × ${f.inches[1]} in · ${f.ratio}`;
  return `${f.ratio || '16:9'}`;
}

export function pitchStageBox(idOrFormat, present = false) {
  const f = typeof idOrFormat === 'object' && idOrFormat ? idOrFormat : resolvePitchFormat(idOrFormat);
  const ratio = `${f.cx} / ${f.cy}`;
  const ar = f.cx / f.cy;
  if (present) {
    return {
      aspectRatio: ratio,
      width: `min(94vw, calc(78vh * ${ar.toFixed(4)}))`,
      height: 'auto',
      maxWidth: '94vw',
      maxHeight: '78vh'
    };
  }
  return {
    aspectRatio: ratio,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%'
  };
}

/** Industry leave-behind shapes. Classic follows audience + length. */
export const PITCH_TEMPLATES = [
  { id: 'classic', label: 'Classic feature', hint: 'Story → world → money → ask' },
  { id: 'teaser', label: 'Teaser leave-behind', hint: '8-page room packet' },
  { id: 'festival', label: 'Festival / market', hint: 'Story and look only' },
  { id: 'series', label: 'Series / OTT bible', hint: 'Platform fit' },
  { id: 'character', label: 'Character-led', hint: 'One sheet per principal' },
  { id: 'lookbook', label: 'Lookbook', hint: 'Visual first' }
];

export const PITCH_PALETTES = [
  { id: 'studio', label: 'Studio gold', paper: '#1c1914', ink: '#f4ede3', muted: '#9a8b7a', gold: '#c4a574', present: '#0c0a08' },
  { id: 'ivory', label: 'Ivory leave-behind', paper: '#f4efe6', ink: '#1c1712', muted: '#6b6258', gold: '#8b5a2b', present: '#f4efe6' },
  { id: 'noir', label: 'Noir', paper: '#141210', ink: '#f3eadf', muted: '#9a8b7a', gold: '#c4a574', present: '#0a0908' },
  { id: 'midnight', label: 'Midnight', paper: '#101820', ink: '#e8eef6', muted: '#8a97a8', gold: '#7aa2d4', present: '#0b1016' },
  { id: 'crimson', label: 'Festival crimson', paper: '#1a1010', ink: '#f7efe8', muted: '#b89a90', gold: '#c45c3e', present: '#140c0c' },
  { id: 'period', label: 'Period sepia', paper: '#ebe0c8', ink: '#2a1f14', muted: '#7a6854', gold: '#8b5a2b', present: '#ebe0c8' }
];

export const PITCH_FONTS = [
  { id: 'studio', label: 'Studio', display: 'var(--sps-font-display)', body: 'var(--sps-font)' },
  { id: 'editorial', label: 'Editorial serif', display: 'Georgia, "Times New Roman", serif', body: 'Georgia, serif' },
  { id: 'poster', label: 'Poster', display: '"Arial Black", Impact, sans-serif', body: 'Helvetica, Arial, sans-serif' },
  { id: 'modern', label: 'Clean sans', display: 'system-ui, Helvetica, sans-serif', body: 'system-ui, sans-serif' },
  { id: 'typewriter', label: 'Typewriter', display: '"Courier New", Courier, monospace', body: '"Courier New", monospace' }
];

export const PITCH_LAYOUTS = [
  { id: 'page', label: 'Standard' },
  { id: 'cover', label: 'Title card' },
  { id: 'hero', label: 'Hero still' },
  { id: 'sheet', label: 'Character sheet' },
  { id: 'split', label: 'Split' },
  { id: 'quote', label: 'Quote / logline' },
  { id: 'grid', label: 'Cast / merch grid' },
  { id: 'crew', label: 'Department list' }
];

const TEMPLATE_SLIDES = {
  classic: null,
  teaser: ['cover', 'hook', 'glance', 'story', 'cast', 'visual', 'ask', 'close'],
  festival: ['cover', 'hook', 'story', 'world', 'cast', 'visual', 'technicians', 'close'],
  series: ['cover', 'hook', 'glance', 'story', 'cast', 'world', 'audience', 'worldwide', 'whyNow', 'status', 'ask', 'close'],
  character: ['cover', 'hook', 'story', 'cast', 'journeys', 'close'],
  lookbook: ['cover', 'visual', 'world', 'cast', 'merchandise', 'close']
};

export const FIELD_STATUS = ['CONFIRMED', 'PROPOSED', 'TARGET', 'UNDER DISCUSSION', 'ESTIMATED', 'ASSUMPTION', 'UNKNOWN', 'DATA REQUIRED'];

export const DEFAULT_FUND_SPLIT = [
  { id: 'production', label: 'Production', pct: 40, status: 'ASSUMPTION' },
  { id: 'vfx', label: 'VFX', pct: 15, status: 'ASSUMPTION' },
  { id: 'post', label: 'Post', pct: 10, status: 'ASSUMPTION' },
  { id: 'technology', label: 'Technology / AI-assisted craft', pct: 10, status: 'ASSUMPTION' },
  { id: 'marketing', label: 'Marketing', pct: 10, status: 'ASSUMPTION' },
  { id: 'distribution', label: 'Distribution', pct: 10, status: 'ASSUMPTION' },
  { id: 'contingency', label: 'Contingency', pct: 5, status: 'ASSUMPTION' }
];

const AUDIENCE_SLIDES = {
  investor: [
    'cover', 'hook', 'glance', 'story', 'world', 'cast', 'journeys', 'technicians', 'visual', 'comps', 'audience',
    'merchandise', 'worldwide', 'whyNow', 'scale', 'approach', 'status', 'budget', 'useOfFunds', 'revenue',
    'distribution', 'scenarios', 'structure', 'risks', 'milestones', 'teamWhy', 'ask', 'close'
  ],
  producer: [
    'cover', 'hook', 'glance', 'story', 'world', 'cast', 'technicians', 'visual', 'scale', 'approach',
    'status', 'milestones', 'budget', 'ask', 'close'
  ],
  studio: [
    'cover', 'hook', 'glance', 'story', 'world', 'cast', 'technicians', 'visual', 'comps', 'audience',
    'merchandise', 'worldwide', 'scale', 'distribution', 'revenue', 'ask', 'close'
  ],
  ott: [
    'cover', 'hook', 'glance', 'story', 'cast', 'audience', 'visual', 'worldwide', 'whyNow',
    'status', 'distribution', 'ask', 'close'
  ],
  distributor: [
    'cover', 'hook', 'glance', 'story', 'comps', 'audience', 'cast', 'technicians', 'worldwide',
    'revenue', 'whyNow', 'ask', 'close'
  ],
  coproducer: [
    'cover', 'hook', 'story', 'technicians', 'scale', 'approach', 'status', 'budget', 'useOfFunds',
    'structure', 'risks', 'milestones', 'ask', 'close'
  ],
  actor: [
    'cover', 'hook', 'story', 'cast', 'journeys', 'visual', 'technicians', 'close'
  ],
  brand: [
    'cover', 'hook', 'world', 'cast', 'audience', 'visual', 'merchandise', 'worldwide', 'whyNow', 'revenue', 'ask', 'close'
  ],
  international: [
    'cover', 'hook', 'glance', 'story', 'world', 'audience', 'worldwide', 'merchandise', 'revenue', 'ask', 'close'
  ]
};

const SIZE_CORE = {
  compact: [
    'cover', 'hook', 'glance', 'story', 'world', 'cast', 'technicians', 'visual', 'audience',
    'merchandise', 'worldwide', 'whyNow', 'status', 'ask', 'close'
  ],
  standard: [
    'cover', 'hook', 'glance', 'story', 'world', 'cast', 'technicians', 'visual', 'comps', 'audience',
    'merchandise', 'worldwide', 'whyNow', 'scale', 'approach', 'status', 'budget', 'ask', 'close'
  ],
  detailed: null
};

export function genreThemeFromKey(genreKey = '') {
  const k = String(genreKey || '').toLowerCase();
  if (/thriller|noir|crime/.test(k)) return 'thriller';
  if (/romance|love|drama/.test(k) && !/epic|myth/.test(k)) return 'romance';
  if (/comed/.test(k)) return 'comedy';
  if (/period|histor|1980|rural/.test(k)) return 'period';
  if (/myth|epic|action|war/.test(k)) return 'epic';
  return 'epic';
}

export function themeTokens(theme) {
  const map = {
    thriller: { mood: 'Dark · atmospheric · high contrast', paper: 'color-mix(in srgb, #1a1412 92%, #3a2018)' },
    period: { mood: 'Rich · textured · historical', paper: 'color-mix(in srgb, var(--sps-surface) 88%, #8b6914)' },
    epic: { mood: 'Grand · cinematic · monumental', paper: 'color-mix(in srgb, var(--sps-gold) 10%, var(--sps-surface))' },
    romance: { mood: 'Elegant · emotional · warm', paper: 'color-mix(in srgb, var(--sps-surface) 90%, #c4a484)' },
    comedy: { mood: 'Energetic · bright · playful', paper: 'color-mix(in srgb, var(--sps-surface) 92%, #d4c4a8)' }
  };
  return map[theme] || map.epic;
}

export function resolvePitchStyle(paletteId = 'studio', fontId = 'studio', genreTheme = 'epic') {
  const genre = themeTokens(genreTheme);
  const palette = PITCH_PALETTES.find((p) => p.id === paletteId) || PITCH_PALETTES[0];
  const font = PITCH_FONTS.find((f) => f.id === fontId) || PITCH_FONTS[0];
  return {
    mood: genre.mood,
    paper: palette.paper,
    ink: palette.ink,
    muted: palette.muted,
    gold: palette.gold,
    present: palette.present,
    display: font.display,
    body: font.body,
    paletteId: palette.id,
    fontId: font.id
  };
}

function clip(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function unique(values, max = 8) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const t = clip(raw, 180);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function readLocal(key) {
  if (typeof window === 'undefined') return '';
  try {
    return String(localStorage.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

function field(value, statusIfPresent = 'CONFIRMED') {
  const v = String(value || '').trim();
  if (!v) return { value: '', status: 'DATA REQUIRED' };
  return { value: v, status: statusIfPresent };
}

function firstFilled(...vals) {
  for (const v of vals) {
    const t = String(v || '').replace(/\s+/g, ' ').trim();
    if (t && t !== '[object Object]') return t;
  }
  return '';
}

function visionSlice(obj) {
  if (!obj || typeof obj !== 'object') return {};
  if (obj.hybrid && typeof obj.hybrid === 'object') return { ...obj, ...obj.hybrid };
  if (obj.human && typeof obj.human === 'object') return { ...obj, ...obj.human };
  if (obj.ai && typeof obj.ai === 'object') return { ...obj, ...obj.ai };
  return obj;
}

function collectCrew(projectTitle) {
  let bible = { director: null, dop: null, sound: null };
  try {
    bible = readProductionBible(projectTitle) || bible;
  } catch {
    /* vault optional */
  }
  const dir = visionSlice(bible.director);
  const dop = visionSlice(bible.dop);
  const sound = visionSlice(bible.sound);
  return [
    { dept: 'Director', name: firstFilled(dir.directorName, dir.name, dir.filmmaker), source: 'Director vault' },
    { dept: 'Writer', name: firstFilled(dir.writer, dir.screenwriter), source: 'Director vault' },
    { dept: 'Director of Photography', name: firstFilled(dop.dopName, dop.cinematographer, dop.name), source: 'DoP vault' },
    { dept: 'Production Designer', name: firstFilled(dop.productionDesigner, dir.productionDesigner), source: 'DoP vault' },
    { dept: 'Editor', name: firstFilled(dop.editor, dir.editor), source: '' },
    { dept: 'Costume', name: firstFilled(dop.costumeDesigner, dir.costumeDesigner), source: '' },
    { dept: 'Sound / Score', name: firstFilled(sound.soundDesigner, sound.composer, sound.name), source: 'Sound vault' },
    { dept: 'VFX Supervisor', name: firstFilled(dop.vfxSupervisor, dir.vfxSupervisor), source: '' }
  ].map((r) => ({
    ...r,
    status: r.name ? 'CONFIRMED' : 'DATA REQUIRED'
  }));
}

function collectMerchandise(worlds = []) {
  const lines = [];
  (Array.isArray(worlds) ? worlds : []).forEach((w) => {
    const merch = firstFilled(w.merchandise, w.merch, w.licensing, w.productLine, w.brandWorld);
    if (merch) lines.push(`${firstFilled(w.name, w.title, 'World')}: ${clip(merch, 180)}`);
  });
  return lines;
}

const APPROVED_PITCH_LIFE = new Set(['approved', 'locked']);

export function collectPitchFacts({
  shots = [],
  projectTitle = 'Untitled Feature',
  aspectRatio = '2.39:1',
  genreKey = '',
  language = 'Telugu'
} = {}) {
  // P110 — match export gate: mute/archive out + only approved/locked lifecycle beats
  const live = (Array.isArray(shots) ? shots : []).filter((s) => {
    if (!s || s.isArchived || s.isMuted) return false;
    const life = String(s.lifecycleStatus || 'draft').toLowerCase();
    return APPROVED_PITCH_LIFE.has(life);
  });
  const title = String(projectTitle || 'Untitled Feature').trim() || 'Untitled Feature';
  const profiles = getMergedGenreProfiles?.() || GENRE_PRESET_PROFILES;
  const genreMeta = profiles[genreKey] || profiles.mythological || {};
  const genreLabel = String(genreMeta.label || genreMeta.name || genreKey || '').replace(/^[^A-Za-z0-9]+/, '').trim();
  const synopsis =
    readLocal('sps_extracted_master_story') ||
    readLocal('sps_narrative_prose_story') ||
    unique(live.map((s) => s.sceneSynopsis || s.scriptSynopsis), 8).join(' ');
  const chars = getActiveCharacterProfiles().filter((c) => c && (c.name || c.tag));
  const worlds = getActiveWorldAssets().filter((a) => a && a.includeInPrompt !== false);
  const crew = collectCrew(title);
  const merchandise = collectMerchandise(worlds);
  const looks = unique(live.map((s) => s.shotComposition || s.cameraMotionTag), 6);
  const lighting = unique(live.map((s) => s.timeAndLightingEnv || s.subjectLightingTag || s.colorPaletteSlot), 5);
  const locations = unique(
    worlds.map((w) => w.name || w.title || w.location).concat(live.map((s) => s.actionEnvContext)),
    6
  );
  const dialogueBits = unique(live.map((s) => s.characterDialogue), 4);
  const durationHints = live.map((s) => Number(String(s.shotDurationAndImages || '').match(/(\d+(?:\.\d+)?)/)?.[1])).filter((n) => n > 0);
  const shotSec = durationHints.reduce((a, b) => a + b, 0);
  const runtimeHint = shotSec >= 60 ? `${Math.round(shotSec / 60)} min (from locked shot durations — ESTIMATED)` : '';

  const storyBeats = {
    setup: unique(live.slice(0, Math.max(2, Math.floor(live.length * 0.2))).map((s) => s.sceneSynopsis), 3),
    conflict: unique(live.map((s) => s.characterPsychologyState || s.characterDialogue), 3),
    escalation: unique(live.slice(Math.floor(live.length * 0.35), Math.floor(live.length * 0.7)).map((s) => s.actionEnvContext || s.sceneSynopsis), 3),
    climax: unique(live.slice(-Math.max(3, Math.floor(live.length * 0.15))).map((s) => s.sceneSynopsis || s.actionEnvContext), 3)
  };

  return {
    title,
    tagline: '',
    genreKey,
    genreLabel: genreLabel || 'Feature',
    language,
    format: aspectRatio ? `Theatrical ${aspectRatio}` : 'Feature',
    runtime: field(runtimeHint, 'ESTIMATED'),
    setting: field(locations[0] || '', locations[0] ? 'CONFIRMED' : 'DATA REQUIRED'),
    period: field(/1980|period|myth|epic/i.test(`${genreKey} ${genreLabel}`) ? clip(genreLabel, 80) : '', 'PROPOSED'),
    audience: field('', 'DATA REQUIRED'),
    status: live.length ? `Shot design — ${live.length} approved/locked Matrix shots` : '',
    productionCompany: PRODUCT,
    synopsis: clip(synopsis, 1200),
    liveShotCount: live.length,
    storyBeats,
    characters: chars.slice(0, 8).map((c) => ({
      name: c.name || c.tag || 'Unnamed',
      role: c.role || 'Principal',
      age: c.age || '',
      description: clip(c.backstory || c.outline || '', 220),
      motivation: clip(c.motivation || c.backstory || '', 140),
      conflict: clip(c.conflict || c.internalConflict || '', 140),
      arc: clip(c.arc || c.shotPurpose || c.psychologicalArchetype || '', 140),
      art: c.lookUrl || c.imageUrl || c.portrait || c.lockedRefs?.hero || '',
      status: c.castingStatus || 'PROPOSED'
    })),
    worldLines: locations,
    worldArt: worlds.map((w) => w.imageUrl || w.lookUrl || w.plate).filter(Boolean).slice(0, 6),
    visualLines: [...looks, ...lighting].slice(0, 8),
    dialogueBits,
    crew,
    merchandise,
    territories: [],
    comps: [],
    budgetTotal: field('', 'DATA REQUIRED'),
    budgetScenarios: { lean: '', target: '', premium: '' },
    fundSplit: DEFAULT_FUND_SPLIT.map((x) => ({ ...x })),
    investmentAsk: field('', 'DATA REQUIRED'),
    contact: {
      company: PRODUCT,
      product: PRODUCT,
      email: '',
      phone: '',
      website: typeof window !== 'undefined' ? window.location.origin : ''
    }
  };
}

export function generateLoglineOptions(facts) {
  const title = facts.title || 'The film';
  const chars = facts.characters || [];
  const hero = chars[0]?.name || 'the protagonist';
  const desire = chars[0]?.motivation || 'protect what cannot be lost';
  const conflict = facts.storyBeats?.conflict?.[0] || chars[0]?.conflict || 'a force that will not yield';
  const world = facts.worldLines?.[0] || facts.setting?.value || 'a world on the edge';
  const syn = clip(facts.synopsis, 160);
  const stakes = 'everything they love is forfeit';

  const a = `When ${clip(conflict, 90) || 'the inciting rupture'} happens, ${hero} must ${clip(desire, 70)}, before ${stakes}.`;
  const b = syn
    ? `${title}: ${syn}`
    : `${hero} stands in ${clip(world, 60)} and must ${clip(desire, 80)} — or lose ${stakes}.`;
  const c = `A ${facts.genreLabel || 'feature'} about ${hero}: ${clip(desire, 100)}. The cost of failure is ${stakes}.`;

  return [
    { id: 'a', text: clip(a, 320), status: syn || chars.length ? 'PROPOSED' : 'DATA REQUIRED' },
    { id: 'b', text: clip(b, 320), status: 'PROPOSED' },
    { id: 'c', text: clip(c, 320), status: 'PROPOSED' }
  ];
}

function storySynopsis(facts) {
  const syn = facts.synopsis;
  if (syn && syn.length > 80) return clip(syn, 1100);
  const { setup, conflict, escalation, climax } = facts.storyBeats || {};
  const parts = [];
  if (setup?.[0]) parts.push(`SETUP — ${setup[0]}`);
  if (conflict?.[0]) parts.push(`CONFLICT — ${conflict[0]}`);
  if (escalation?.[0]) parts.push(`ESCALATION — ${escalation[0]}`);
  if (climax?.[0]) parts.push(`CLIMAX — ${climax[0]}`);
  parts.push('EMOTIONAL RESOLUTION — DATA REQUIRED (writer lock).');
  return parts.join('\n\n') || 'DATA REQUIRED — paste or generate a 100–180 word cinematic synopsis.';
}

function expandCharacterSheets(ids, facts, force) {
  const chars = facts.characters || [];
  if (!chars.length || !force) return ids;
  const out = [];
  for (const id of ids) {
    out.push(id);
    if (id === 'cast' || id === 'characters') {
      chars.slice(0, 8).forEach((_, i) => out.push(`sheet_${i}`));
    }
  }
  return out;
}

function selectSlideIds(audienceId, sizeId, facts, templateId = 'classic') {
  const audience = AUDIENCE_SLIDES[audienceId] || AUDIENCE_SLIDES.investor;
  const core = SIZE_CORE[sizeId];
  const max = PITCH_SIZES.find((s) => s.id === sizeId)?.max || 20;
  const templated = TEMPLATE_SLIDES[templateId];
  let ids = templated
    ? templated.slice()
    : core && sizeId !== 'detailed'
      ? core.filter((id) => audience.includes(id) || ['cover', 'hook', 'story', 'ask', 'close'].includes(id))
      : audience.slice();

  if (!templated && sizeId === 'detailed') ids = audience.slice();

  if (!(facts.characters || []).length) ids = ids.filter((id) => id !== 'journeys' && id !== 'characters' && !String(id).startsWith('sheet_'));
  else if ((facts.characters || []).length < 2) ids = ids.filter((id) => id !== 'journeys');
  if (audienceId === 'actor') ids = ids.filter((id) => !['budget', 'useOfFunds', 'scenarios', 'structure'].includes(id));

  const must = templated ? ['cover', 'close'] : ['cover', 'hook', 'ask', 'close'];
  must.forEach((id) => {
    if (!ids.includes(id)) ids.push(id);
  });
  if (!ids.includes('story') && audienceId !== 'brand' && templateId !== 'lookbook') ids.splice(2, 0, 'story');

  const wantSheets = templateId === 'character' || sizeId === 'detailed';
  ids = expandCharacterSheets(ids, facts, wantSheets);
  ids = ids.slice(0, Math.max(max, wantSheets ? max + 8 : max));
  const mid = ids.filter((id) => id !== 'cover' && id !== 'back');
  return ['cover', ...mid, 'back'];
}

/** Empty still frames — producer drops key art, portraits, plates. */
export const FRAME_PRESETS = {
  cover: [{ label: 'Key art', hint: 'Full-bleed cinematic still. No type on the image. ≥ 1 MB.' }],
  world: [
    { label: 'World 1' },
    { label: 'World 2' },
    { label: 'World 3' },
    { label: 'World 4' },
    { label: 'World 5' },
    { label: 'World 6' }
  ],
  characters: [
    { label: 'Portrait 1' },
    { label: 'Portrait 2' },
    { label: 'Portrait 3' },
    { label: 'Portrait 4' },
    { label: 'Portrait 5' },
    { label: 'Portrait 6' }
  ],
  cast: [
    { label: 'Portrait 1' },
    { label: 'Portrait 2' },
    { label: 'Portrait 3' },
    { label: 'Portrait 4' },
    { label: 'Portrait 5' },
    { label: 'Portrait 6' }
  ],
  journeys: [{ label: 'Protagonist still' }, { label: 'Antagonist still' }],
  visual: [
    { label: 'Light / palette' },
    { label: 'Production design' },
    { label: 'Costume' },
    { label: 'Camera language' }
  ],
  comps: [
    { label: 'Reference 1' },
    { label: 'Reference 2' },
    { label: 'Reference 3' },
    { label: 'Reference 4' }
  ],
  scale: [{ label: 'Set / crowd' }, { label: 'Action / VFX' }, { label: 'Period / spectacle' }],
  technicians: [{ label: 'Director' }, { label: 'DoP' }, { label: 'Production design' }, { label: 'Sound' }],
  merchandise: [{ label: 'Hero product' }, { label: 'Look / costume' }, { label: 'World object' }, { label: 'Poster lockup' }],
  worldwide: [{ label: 'Territory key art' }],
  close: [{ label: 'Closing still', hint: 'Title lockup. No numbers. ≥ 1 MB.' }],
  back: [{ label: 'Back cover still', hint: 'Full-bleed lockup. No numbers. ≥ 1 MB.' }]
};

export function blankPitchSlide(n = 1, layout = 'page') {
  return slideRecord(
    `page_${n}`,
    `Slide ${String(n).padStart(2, '0')}`,
    'Title',
    '',
    [''],
    { frames: [{ label: 'Still' }, { label: 'Still 2' }], kind: layout, layout }
  );
}

export function characterSheetSlide(char = {}, index = 0) {
  const c = char || {};
  return slideRecord(
    `sheet_${index}`,
    'Character sheet',
    c.name || 'Unnamed',
    [c.role, c.age].filter(Boolean).join(' · ') || 'Principal',
    [
      c.motivation ? `DESIRE — ${c.motivation}` : 'DESIRE — DATA REQUIRED',
      c.conflict ? `CONFLICT — ${c.conflict}` : 'CONFLICT — DATA REQUIRED',
      c.arc ? `ARC — ${c.arc}` : 'TRANSFORMATION — DATA REQUIRED',
      c.description ? clip(c.description, 280) : ''
    ],
    {
      kind: 'sheet',
      layout: 'sheet',
      images: c.art ? [c.art] : [],
      frames: [{ label: 'Portrait', hint: 'Head-and-shoulders. No type on the face.' }],
      fields: {
        name: c.name || '',
        role: c.role || 'Principal',
        age: c.age || '',
        status: c.status || 'PROPOSED'
      },
      footer: 'One character. One page. Industry leave-behind.'
    }
  );
}

export function clonePitchSlides(slides) {
  try {
    return JSON.parse(JSON.stringify(slides || []));
  } catch {
    return [];
  }
}

function slideRecord(id, kicker, title, subtitle, points, extra = {}) {
  const preset = FRAME_PRESETS[id] || [];
  return {
    id,
    kicker,
    title,
    subtitle,
    points: points.filter(Boolean),
    footer: extra.footer || '',
    kind: extra.kind || 'page',
    statusNote: extra.statusNote || '',
    images: extra.images || [],
    frames: extra.frames || preset,
    fields: extra.fields || null,
    disclaimer: extra.disclaimer || '',
    layout: extra.layout || extra.kind || 'page',
    navTitle: extra.navTitle || ''
  };
}

export function buildInvestorPitchDeck({
  facts,
  audienceId = 'investor',
  sizeId = 'standard',
  loglineText = '',
  fundSplit = DEFAULT_FUND_SPLIT,
  templateId = 'classic',
  paletteId = 'studio',
  fontId = 'studio',
  formatId = DEFAULT_PITCH_FORMAT
} = {}) {
  const theme = genreThemeFromKey(facts.genreKey);
  const tokens = themeTokens(theme);
  const style = resolvePitchStyle(paletteId, fontId, theme);
  const logline = loglineText || generateLoglineOptions(facts)[0]?.text || '';
  const chars = facts.characters || [];
  const split = (fundSplit || DEFAULT_FUND_SPLIT).map((x) => ({ ...x }));
  const splitTotal = split.reduce((a, b) => a + Number(b.pct || 0), 0);

  const catalog = {
    cover: slideRecord(
      'cover',
      'Cover',
      facts.title,
      logline || 'One-line hook — DATA REQUIRED',
      [
        facts.genreLabel,
        facts.language,
        'Feature Film',
        `${facts.productionCompany} presentation`
      ],
      {
        kind: 'cover',
        layout: 'cover',
        navTitle: 'Cover',
        footer: 'Confidential · Desire first. Numbers later.',
        images: facts.worldArt.slice(0, 1),
        statusNote: 'Cover must stay sparse — no budget on this page.'
      }
    ),
    hook: slideRecord(
      'hook',
      '02 · The one-line hook',
      'Logline',
      logline,
      [
        'Protagonist · conflict · goal · stakes · unique hook',
        'Approve one option. Do not stack three loglines on the page the room sees.'
      ],
      { footer: 'Maximum 2–3 sentences', layout: 'quote', kind: 'quote' }
    ),
    glance: slideRecord(
      'glance',
      '03 · At a glance',
      'The film',
      'Only known facts. Empty cells stay DATA REQUIRED.',
      [
        `Title — ${facts.title} [${'CONFIRMED'}]`,
        `Genre — ${facts.genreLabel || 'DATA REQUIRED'} [${facts.genreLabel ? 'CONFIRMED' : 'DATA REQUIRED'}]`,
        `Language — ${facts.language} [PROPOSED]`,
        `Format — ${facts.format} [CONFIRMED]`,
        `Runtime — ${facts.runtime.value || 'DATA REQUIRED'} [${facts.runtime.status}]`,
        `Setting — ${facts.setting.value || 'DATA REQUIRED'} [${facts.setting.status}]`,
        `Period — ${facts.period.value || 'DATA REQUIRED'} [${facts.period.status}]`,
        `Target audience — ${facts.audience.value || 'DATA REQUIRED'} [${facts.audience.status}]`,
        `Production status — ${facts.status || 'DATA REQUIRED'} [${facts.liveShotCount ? 'CONFIRMED' : 'UNKNOWN'}]`,
        'Expected release window — DATA REQUIRED'
      ],
      { layout: 'split' }
    ),
    story: slideRecord(
      'story',
      '04 · The story',
      'Synopsis',
      'Setup · Conflict · Escalation · Climax · Emotional resolution',
      [storySynopsis(facts)],
      { footer: '100–180 words. Not the screenplay.' }
    ),
    world: slideRecord(
      'world',
      '05 · World',
      'Where it lives',
      tokens.mood,
      facts.worldLines.length
        ? facts.worldLines
        : ['Time, geography, culture, architecture — DATA REQUIRED from World console.'],
      { images: facts.worldArt, footer: '3–6 plates when art is approved' }
    ),
    characters: slideRecord(
      'characters',
      '06 · Characters',
      'Who we follow',
      chars.length ? `${chars.length} principals from Character Bible` : 'DATA REQUIRED — Character Bible',
      chars.length
        ? chars.slice(0, 6).map((c) => `${c.name} — ${c.role}${c.age ? `, ${c.age}` : ''} [${c.status}]. ${clip(c.description || c.motivation, 160)}`)
        : ['Add principals in Cast. Unconfirmed names stay PROPOSED.'],
      { images: chars.map((c) => c.art).filter(Boolean).slice(0, 6), kind: 'grid', layout: 'grid' }
    ),
    cast: slideRecord(
      'cast',
      'Cast',
      'Cast details',
      chars.length ? `${chars.length} principals · unconfirmed names stay PROPOSED` : 'DATA REQUIRED — Character Bible',
      chars.length
        ? chars.slice(0, 8).map((c) =>
            `${c.name} — ${[c.role, c.age].filter(Boolean).join(' · ') || 'Principal'} [${c.status}]\n${clip(c.description || c.motivation || c.arc, 200) || 'Arc — DATA REQUIRED'}`
          )
        : ['Add principals in Cast. Do not present unattached talent as locked.'],
      {
        kind: 'grid',
        layout: 'grid',
        images: chars.map((c) => c.art).filter(Boolean).slice(0, 8),
        fields: { people: chars.slice(0, 8) },
        footer: 'Portraits from the bible when locked. Generate stills stay on this disk.'
      }
    ),
    technicians: slideRecord(
      'technicians',
      'Creative team',
      'Technicians',
      'Department heads from Director / DoP / Sound vaults. Empty cells stay DATA REQUIRED.',
      (facts.crew || []).map((r) => `${r.dept} — ${r.name || 'DATA REQUIRED'} [${r.status}]`),
      {
        kind: 'crew',
        layout: 'crew',
        fields: { crew: facts.crew || [] },
        footer: 'Never present unconfirmed talent as attached.'
      }
    ),
    merchandise: slideRecord(
      'merchandise',
      'Ancillary',
      'Merchandise scope',
      'Only what the world bible already names. Not a sales forecast.',
      facts.merchandise?.length
        ? facts.merchandise
        : [
            'Hero product / look — DATA REQUIRED (World console)',
            'Costume / character IP — DATA REQUIRED',
            'Location / set pieces — DATA REQUIRED',
            'Music / publishing — DATA REQUIRED',
            'Do not invent SKUs, partners, or revenue.'
          ],
      { kind: 'grid', layout: 'grid', footer: 'Scope, not a merch catalogue.' }
    ),
    worldwide: slideRecord(
      'worldwide',
      'Release',
      'Worldwide release',
      'Territories and languages only when the producer has named them.',
      [
        `Language of origin — ${facts.language || 'DATA REQUIRED'} [${facts.language ? 'PROPOSED' : 'DATA REQUIRED'}]`,
        'Primary territory — DATA REQUIRED',
        'India / South Asia windows — DATA REQUIRED',
        'Diaspora / international — DATA REQUIRED',
        'Dubbing / subtitling languages — DATA REQUIRED',
        'Theatrical vs OTT-first vs hybrid — DATA REQUIRED',
        'Festival path — TARGET only if dated',
        'Do not invent distributors, MG, or release dates.'
      ],
      { layout: 'split', footer: 'Unconfirmed partners: TARGET / DISCUSSION / PROSPECTIVE.' }
    ),
    journeys: slideRecord(
      'journeys',
      '07 · Character journeys',
      'Desire → conflict → transformation',
      chars[0] ? chars[0].name : 'Protagonist',
      chars[0]
        ? [
            `DESIRE — ${chars[0].motivation || 'DATA REQUIRED'}`,
            `CONFLICT — ${chars[0].conflict || 'DATA REQUIRED'}`,
            `TRANSFORMATION — ${chars[0].arc || 'DATA REQUIRED'}`,
            chars[1] ? `ANTAGONIST / COUNTERFORCE — ${chars[1].name}: ${clip(chars[1].motivation || chars[1].description, 140)}` : ''
          ]
        : ['DATA REQUIRED']
    ),
    visual: slideRecord(
      'visual',
      '08 · Visual language',
      'How it feels on screen',
      tokens.mood,
      facts.visualLines.length
        ? facts.visualLines
        : ['Cinematography, light, palette, costume — DATA REQUIRED from Matrix crafts.'],
      { footer: 'Mood board. Not a camera-spec dump.' }
    ),
    comps: slideRecord(
      'comps',
      '09 · Positioning',
      'Audience & tone references',
      'Genre positioning — not a box-office promise.',
      [
        'Add 2–4 comparable films as AUDIENCE / TONE / MARKET references.',
        'Never: “this will be the next [hit title].”',
        'DATA REQUIRED — producer-approved comps only.'
      ],
      { statusNote: 'Comparables are positioning, not performance forecasts.' }
    ),
    audience: slideRecord(
      'audience',
      '10 · Audience',
      'Who will watch',
      'Do not invent statistics.',
      [
        'PRIMARY — DATA REQUIRED (age, geography, language, genre habit)',
        'SECONDARY — DATA REQUIRED (family / pan-Indian / diaspora — only if verified)',
        facts.language ? `Language frame — ${facts.language} [PROPOSED]` : '',
        'Theatrical vs OTT behaviour — UNKNOWN until research is attached'
      ]
    ),
    whyNow: slideRecord(
      'whyNow',
      '11 · Why this film / why now',
      'Commercial relevance',
      'Only supportable claims.',
      [
        facts.genreLabel ? `Genre lane — ${facts.genreLabel} [PROPOSED as category, not as demand proof]` : 'Genre demand — DATA REQUIRED',
        facts.liveShotCount ? `Execution already in craft — ${facts.liveShotCount} shots designed [CONFIRMED]` : '',
        'Cultural relevance — DATA REQUIRED',
        'Star appeal — UNKNOWN unless attached and labeled',
        'Do not claim underserved markets without a source.'
      ]
    ),
    scale: slideRecord(
      'scale',
      '12 · Scale',
      'Production vision',
      `${facts.liveShotCount} designed shots in Stage Work Studio`,
      [
        `Locations called — ${facts.worldLines.length || 'DATA REQUIRED'}`,
        'Major sets / crowds / VFX / period recreation — DATA REQUIRED (producer list)',
        'This page shows ambition already visible in the bible — not a VFX bid.'
      ]
    ),
    approach: slideRecord(
      'approach',
      '13 · Production approach',
      'How it will be made',
      'Human direction. Assisted generation. Editorial. Final post.',
      [
        'Development → pre-production → production → post → sound → master',
        'AI-assisted craft is a methodology for controlled look-dev, scalable environments, and iteration — not a shortcut around directing.',
        'Continuity lives in Character Bible, World plates, and shot-level Matrix.',
        'Final picture still requires editorial, color, VFX, and sound — CONFIRMED as process, not as vendor list.'
      ]
    ),
    castTeam: slideRecord(
      'castTeam',
      '14 · Cast & creative team',
      'Who is making it',
      'Never present unconfirmed talent as attached.',
      [
        `Director — DATA REQUIRED [UNKNOWN]`,
        `Producer — Stage Work Studio [PROPOSED]`,
        `Writer — DATA REQUIRED [UNKNOWN]`,
        chars[0] ? `Lead — ${chars[0].name} [${chars[0].status}]` : 'Lead cast — DATA REQUIRED',
        'Department heads — DATA REQUIRED. Credits must be verified.'
      ]
    ),
    status: slideRecord(
      'status',
      '15 · Production status',
      'Where the project stands',
      'From Stage Work Studio — not a press claim.',
      [
        `Story / synopsis — ${facts.synopsis ? 'IN CRAFT' : 'NOT STARTED'}`,
        `Character design — ${chars.length ? `${chars.length} profiles` : 'NOT STARTED'}`,
        `World plates — ${facts.worldArt.length ? `${facts.worldArt.length} assets` : 'NOT STARTED'}`,
        `Shot design — ${facts.liveShotCount} Matrix shots`,
        'Storyboard % — DATA REQUIRED',
        'Production / post — DATA REQUIRED'
      ]
    ),
    budget: slideRecord(
      'budget',
      '16 · Budget',
      'Estimated cost',
      'Never fabricate figures.',
      [
        `TOTAL — ${facts.budgetTotal.value || 'DATA REQUIRED'} [${facts.budgetTotal.status}]`,
        'LEAN / TARGET / PREMIUM scenarios — DATA REQUIRED (producer entry)',
        'Lines: development, pre, production, technology, VFX, post, music, marketing, distribution, contingency',
        'Currency as used by the producer (e.g. ₹ crore). Empty is honest.'
      ]
    ),
    useOfFunds: slideRecord(
      'useOfFunds',
      '17 · Use of investment',
      'Where capital goes',
      splitTotal === 100 ? `Allocation totals ${splitTotal}%` : `Allocation totals ${splitTotal}% — must equal 100`,
      split.map((s) => `${s.pct}% ${s.label} [${s.status}]`),
      { footer: 'Percentages are ASSUMPTION until the producer locks them.' }
    ),
    revenue: slideRecord(
      'revenue',
      '18 · Monetization',
      'Revenue windows — not guarantees',
      'PRIMARY / SECONDARY / OPTIONAL. No promised numbers.',
      [
        'PRIMARY — Theatrical [TARGET]',
        'PRIMARY — OTT / streaming [TARGET]',
        'SECONDARY — Satellite, digital, music, overseas [PROPOSED]',
        'OPTIONAL — Dubbing, remake, airlines, merchandising [UNKNOWN]',
        'Do not present estimates as guaranteed revenue.'
      ]
    ),
    distribution: slideRecord(
      'distribution',
      '19 · Distribution',
      'Release strategy',
      'Unconfirmed partners: TARGET / DISCUSSION / PROSPECTIVE.',
      [
        'Path — DATA REQUIRED (theatrical / OTT-first / hybrid / festival)',
        'Territories & languages — DATA REQUIRED',
        'Distributors — UNDER DISCUSSION unless a deal is verified',
        'Release window — TARGET only if dated by producer'
      ]
    ),
    scenarios: slideRecord(
      'scenarios',
      '20 · Commercial scenarios',
      'Conservative · Base · Upside',
      'Assumptions visible. Not a return guarantee.',
      [
        'Variables: budget, theatrical, OTT, satellite, international, ancillary — all DATA REQUIRED',
        'Each figure: ASSUMPTION · SOURCE · DATE',
        'This is not an investor-return calculator.'
      ]
    ),
    structure: slideRecord(
      'structure',
      '21 · Investment structure',
      'Proposed shape — not legal advice',
      'Subject to legal, financial and production agreements.',
      [
        `Investment required — ${facts.investmentAsk.value || 'DATA REQUIRED'} [${facts.investmentAsk.status}]`,
        'Structure — DATA REQUIRED (equity / co-pro / revenue share / MG / territory)',
        'Recovery priority / share / term — DATA REQUIRED',
        'Stage Work Studio does not prescribe legal terms.'
      ],
      { disclaimer: 'Subject to legal, financial and production agreements.' }
    ),
    risks: slideRecord(
      'risks',
      '22 · Risk & mitigation',
      'Credibility through honesty',
      '',
      [
        'RISK: Visual continuity across generated plates — MITIGATION: Character Bible + World vault + shot Matrix.',
        'RISK: Generation / vendor failure — MITIGATION: multi-tool workflow and approved reference library.',
        'RISK: Schedule slip in post — MITIGATION: shot-level tracking and versioned takes.',
        'RISK: Audience / distribution — MITIGATION: labeled TARGET strategy; no invented demand stats.',
        'Budget risk — MITIGATION: lean / target / premium only when producer-entered.'
      ]
    ),
    milestones: slideRecord(
      'milestones',
      '23 · Milestones',
      'Schedule',
      'From the project when dated. Otherwise DATA REQUIRED.',
      [
        'Development — IN CRAFT (story / bible / shots as above)',
        'Pre-production — DATA REQUIRED',
        'Production — DATA REQUIRED',
        'Post / marketing / release — DATA REQUIRED'
      ]
    ),
    teamWhy: slideRecord(
      'teamWhy',
      '24 · Why this team',
      'Why trust this room with the money',
      'Not a generic résumé page.',
      [
        'Creative control stays with human direction; Stage Work Studio is the production OS.',
        'Shot-level craft, character continuity, and world plates are already in the vault where filled.',
        'Verified credits only — DATA REQUIRED for outside attachments.'
      ]
    ),
    ask: slideRecord(
      'ask',
      '25 · The ask',
      'Investment opportunity',
      facts.investmentAsk.value || '₹ ______  [DATA REQUIRED]',
      [
        'For: development / production / post / marketing / distribution — producer to specify',
        'Target completion — DATA REQUIRED',
        'Proposed structure — DATA REQUIRED',
        `Contact — ${facts.contact.company} · ${facts.contact.email}`
      ],
      { kind: 'close', disclaimer: 'Subject to legal, financial and production agreements.' }
    ),
    close: slideRecord(
      'close',
      'Close',
      facts.title,
      logline || 'The next conversation.',
      [
        facts.contact.email,
        facts.contact.website,
        'No financial figures on this page.'
      ],
      { kind: 'cover', layout: 'cover', navTitle: 'Close', images: facts.worldArt.slice(0, 1), footer: PRODUCT }
    ),
    back: slideRecord(
      'back',
      'Back',
      'Thank you',
      facts.title,
      [
        facts.productionCompany || facts.contact.company || 'DATA REQUIRED',
        facts.contact.email || 'DATA REQUIRED',
        facts.contact.website || '',
        'Confidential — not for circulation',
        'No financial figures on this page.'
      ],
      {
        kind: 'cover',
        layout: 'cover',
        navTitle: 'Back',
        images: facts.worldArt.slice(0, 1),
        footer: PRODUCT,
        statusNote: 'Back cover. Contact only. No ask, no budget.'
      }
    )
  };

  chars.slice(0, 8).forEach((c, i) => {
    catalog[`sheet_${i}`] = characterSheetSlide(c, i);
  });

  const ids = selectSlideIds(audienceId, sizeId, facts, templateId);
  const slides = ids.map((id, i) => {
    const s = catalog[id];
    if (!s) return null;
    return {
      ...s,
      kicker: `${String(i + 1).padStart(2, '0')} · ${s.kicker.replace(/^\d+\s*·\s*/, '')}`
    };
  }).filter(Boolean);

  return {
    kind: 'film-pitch',
    audienceId,
    sizeId,
    templateId,
    formatId: resolvePitchFormat(formatId).id,
    format: resolvePitchFormat(formatId),
    paletteId: style.paletteId,
    fontId: style.fontId,
    theme,
    themeMood: tokens.mood,
    style,
    facts,
    logline,
    fundSplit: split,
    fundSplitTotal: splitTotal,
    slides,
    createdAt: new Date().toISOString()
  };
}

export function scorePitchDeck(deck) {
  const f = deck.facts || {};
  const text = (deck.slides || []).map((s) => `${s.subtitle} ${(s.points || []).join(' ')}`).join(' ');
  const has = (re) => re.test(text);
  const story = Math.min(100, (f.synopsis ? 40 : 10) + (deck.logline ? 30 : 0) + (f.storyBeats?.conflict?.length ? 20 : 0) + 10);
  const characters = Math.min(100, (f.characters?.length || 0) * 18);
  const visual = Math.min(100, (f.worldArt?.length || 0) * 12 + (f.visualLines?.length || 0) * 8 + (f.liveShotCount ? 20 : 0));
  const audience = has(/DATA REQUIRED \(age/) ? 25 : 55;
  const commercial = has(/comparables are positioning/i) ? 40 : 50;
  const production = Math.min(100, 20 + (f.liveShotCount ? 40 : 0) + (f.characters?.length ? 20 : 0) + (f.worldLines?.length ? 20 : 0));
  const team = 35;
  const financial = f.budgetTotal?.value ? 70 : 28;
  const investment = f.investmentAsk?.value ? 70 : 30;
  const overall = Math.round(
    (story + characters + visual + audience + commercial + production + team + financial + investment) / 9
  );
  return {
    story,
    characters: Math.min(100, characters),
    visualWorld: Math.min(100, visual),
    audience,
    commercial,
    production,
    team,
    financial,
    investment,
    overall,
    note: 'Completeness of the pitch presentation — not a prediction of investor return or box office.'
  };
}

export function qualityChecklist(deck) {
  const f = deck.facts || {};
  const join = (deck.slides || []).map((s) => `${s.title} ${s.subtitle} ${(s.points || []).join(' ')}`).join('\n');
  const ok = (cond) => Boolean(cond);
  return {
    story: [
      { id: 'logline', label: 'Strong logline', pass: ok(deck.logline && deck.logline.length > 40 && !/DATA REQUIRED/.test(deck.logline)) },
      { id: 'protagonist', label: 'Clear protagonist', pass: (f.characters || []).length > 0 },
      { id: 'conflict', label: 'Clear conflict', pass: Boolean(f.storyBeats?.conflict?.[0] || (f.characters?.[0] || {}).conflict) },
      { id: 'stakes', label: 'Clear stakes', pass: /stakes|forfeit|before /i.test(deck.logline || '') }
    ],
    film: [
      { id: 'genre', label: 'Genre defined', pass: Boolean(f.genreLabel) },
      { id: 'audience', label: 'Audience defined', pass: f.audience?.status !== 'DATA REQUIRED' && Boolean(f.audience?.value) },
      { id: 'visual', label: 'Visual identity', pass: (f.visualLines || []).length > 0 },
      { id: 'world', label: 'World established', pass: (f.worldLines || []).length > 0 }
    ],
    commercial: [
      { id: 'market', label: 'Market positioning (comps entered)', pass: (f.comps || []).length > 0 },
      { id: 'distro', label: 'Distribution strategy filled', pass: !join.includes('Path — DATA REQUIRED') },
      { id: 'rev', label: 'Revenue model labeled (not guaranteed)', pass: /not guarantees|not present estimates/i.test(join) }
    ],
    production: [
      { id: 'approach', label: 'Production approach', pass: true },
      { id: 'team', label: 'Team named beyond DATA REQUIRED', pass: !/Director — DATA REQUIRED/.test(join) },
      { id: 'schedule', label: 'Schedule dated', pass: false },
      { id: 'budget', label: 'Budget entered', pass: Boolean(f.budgetTotal?.value) }
    ],
    investment: [
      { id: 'ask', label: 'Funding requirement', pass: Boolean(f.investmentAsk?.value) },
      { id: 'use', label: 'Use of funds totals 100%', pass: Number(deck.fundSplitTotal) === 100 },
      { id: 'structure', label: 'Investment structure', pass: false },
      { id: 'assumptions', label: 'Assumptions identified', pass: /ASSUMPTION|DATA REQUIRED/.test(join) }
    ],
    credibility: [
      { id: 'noBox', label: 'No fabricated box office', pass: !/will gross|next baahubali|guaranteed return/i.test(join) },
      { id: 'castMark', label: 'Unconfirmed cast marked', pass: true },
      { id: 'partnerMark', label: 'Unconfirmed partners marked', pass: /UNDER DISCUSSION|TARGET|PROSPECTIVE/.test(join) }
    ]
  };
}

export function normalizeFundSplit(rows) {
  const list = (rows || []).map((r) => ({ ...r, pct: Math.max(0, Number(r.pct) || 0) }));
  const total = list.reduce((a, b) => a + b.pct, 0);
  return { list, total };
}

export function pitchDeckToMarkdown(deck) {
  const lines = [
    `# ${deck.facts?.title || 'Feature'} — Movie investor pitch`,
    '',
    `Audience: ${deck.audienceId} · Length: ${deck.sizeId} · Frame: ${pitchFormatDimension(deck.formatId || deck.format)} · Theme: ${deck.themeMood || deck.theme}`,
    '',
    '_Film production proposal. Not a startup deck. Not a trailer. Not a prompt pack._',
    '',
    `Logline: ${deck.logline || 'DATA REQUIRED'}`,
    ''
  ];
  (deck.slides || []).forEach((s) => {
    lines.push(`## ${s.kicker} — ${s.title}`);
    if (s.subtitle) lines.push('', s.subtitle);
    lines.push('');
    (s.points || []).forEach((p) => lines.push(`- ${p}`));
    if (s.disclaimer) lines.push('', `> ${s.disclaimer}`);
    if (s.footer) lines.push('', `*${s.footer}*`);
    lines.push('');
  });
  const score = scorePitchDeck(deck);
  lines.push('## Internal pitch score (completeness, not a return forecast)');
  Object.entries(score).forEach(([k, v]) => {
    if (k === 'note') lines.push(`_${v}_`);
    else lines.push(`- ${k}: ${v}`);
  });
  return lines.join('\n');
}

/** Craft CSV for pitch deck slides (Campaign/Investor CSV parity). */
export function pitchDeckToCsv(deck = {}) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['#', 'Id', 'Kicker', 'Title', 'Subtitle', 'Points', 'Disclaimer', 'Audience', 'Length', 'Frame', 'Project'];
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  const rows = slides.map((s, i) =>
    [
      i + 1,
      s?.id || '',
      s?.kicker || '',
      s?.title || '',
      s?.subtitle || '',
      (s?.points || []).join('; '),
      s?.disclaimer || '',
      deck.audienceId || '',
      deck.sizeId || '',
      deck.formatId || '',
      deck.facts?.title || deck.projectTitle || ''
    ]
      .map(esc)
      .join(',')
  );
  return [headers.map(esc).join(','), ...rows].join('\n');
}

/** ZIP pack: README markdown + slides CSV + META. */
export function buildPitchDeckZipFiles(deck = {}, { roomId = '' } = {}) {
  const d = deck || {};
  const title = d.facts?.title || d.projectTitle || 'pitch';
  return [
    { name: 'README.md', content: pitchDeckToMarkdown(d) },
    { name: 'slides.csv', content: pitchDeckToCsv(d) },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Audience: ${d.audienceId || ''}`,
        `Size: ${d.sizeId || ''}`,
        `Frame: ${d.formatId || ''} · ${pitchFormatDimension(d.formatId || d.format)}`,
        `Slides: ${(d.slides || []).length}`,
        `Theme: ${d.themeMood || d.theme || ''}`,
        `Room: ${String(roomId || '').trim() || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    }
  ];
}

/** P108 — shots skipped from pitch deck (muted/archived or not approved/locked). */
export function collectPitchBeatExclusions(shots = []) {
  return (Array.isArray(shots) ? shots : []).filter(Boolean).map((s) => {
    const reasons = [];
    if (s.isArchived) reasons.push('archived');
    if (s.isMuted) reasons.push('muted');
    const life = String(s.lifecycleStatus || 'draft').toLowerCase();
    if (!APPROVED_PITCH_LIFE.has(life)) reasons.push(`lifecycle:${life || 'draft'}`);
    if (!reasons.length) return null;
    return {
      sceneShotId: String(s.sceneShotId || s.id || '').trim(),
      title: s.sceneTitle || s.sceneSynopsis || '',
      reasons
    };
  }).filter(Boolean);
}

/** Log pitch beat exclusions to creative audit (mirroring promo P106 / campaign P107). */
export function logPitchBeatExclusions(shots = [], { projectTitle = '' } = {}) {
  const excluded = collectPitchBeatExclusions(shots);
  if (!excluded.length) return excluded;
  const preview = excluded.slice(0, 5).map((e) => `${e.sceneShotId}(${e.reasons.join('+')})`).join(', ');
  appendCreativeAudit({
    projectTitle,
    category: 'export',
    action: 'pitch_beats_excluded',
    targetType: 'pitch',
    targetId: 'pitch_deck',
    targetLabel: 'pitch deck',
    note: `${excluded.length} muted/unapproved beats skipped: ${preview}`
  });
  return excluded;
}

const SAVE_KEY = 'sps_film_pitch_decks_v1';

export function savePitchDeckLocal(deck, projectTitle) {
  if (typeof window === 'undefined' || !deck) return null;
  const title = String(projectTitle || deck.facts?.title || 'Project').trim();
  const entry = {
    id: `pitch_${Date.now()}`,
    projectTitle: title,
    savedAt: new Date().toISOString(),
    deck
  };
  let all = [];
  try {
    all = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
  } catch {
    all = [];
  }
  if (!Array.isArray(all)) all = [];
  const key = title.toUpperCase();
  all = [entry, ...all.filter((e) => String(e.projectTitle || '').toUpperCase() !== key)].slice(0, 20);
  localStorage.setItem(SAVE_KEY, JSON.stringify(all));
  return entry;
}
