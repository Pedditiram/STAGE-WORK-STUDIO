/**
 * Stage Work Studio — Movie Investor Pitch Deck Maker
 * Story first. Opportunity second. Production third. Money fourth. Ask last.
 * Never invent box office, deals, budgets, or attached talent.
 */

import { PRODUCT } from '../constants/brand';
import { GENRE_PRESET_PROFILES, getMergedGenreProfiles } from '../constants/seedancePresets';
import { getActiveCharacterProfiles, getActiveWorldAssets } from './projectBibleVault';
import { appendCreativeAudit } from './creativeAuditLog';

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
  { id: 'compact', label: 'Compact', range: '12–15 slides', max: 15 },
  { id: 'standard', label: 'Standard', range: '16–20 slides', max: 20 },
  { id: 'detailed', label: 'Detailed investor', range: '20–30 slides', max: 28 }
];

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
    'cover', 'hook', 'glance', 'story', 'world', 'characters', 'journeys', 'visual', 'comps', 'audience',
    'whyNow', 'scale', 'approach', 'status', 'budget', 'useOfFunds', 'revenue', 'distribution',
    'scenarios', 'structure', 'risks', 'milestones', 'teamWhy', 'ask', 'close'
  ],
  producer: [
    'cover', 'hook', 'glance', 'story', 'world', 'characters', 'visual', 'scale', 'approach',
    'castTeam', 'status', 'milestones', 'budget', 'ask', 'close'
  ],
  studio: [
    'cover', 'hook', 'glance', 'story', 'world', 'characters', 'visual', 'comps', 'audience',
    'scale', 'castTeam', 'distribution', 'revenue', 'ask', 'close'
  ],
  ott: [
    'cover', 'hook', 'glance', 'story', 'characters', 'audience', 'visual', 'whyNow',
    'status', 'distribution', 'ask', 'close'
  ],
  distributor: [
    'cover', 'hook', 'glance', 'story', 'comps', 'audience', 'castTeam', 'distribution',
    'revenue', 'whyNow', 'ask', 'close'
  ],
  coproducer: [
    'cover', 'hook', 'story', 'scale', 'approach', 'status', 'budget', 'useOfFunds',
    'structure', 'risks', 'milestones', 'ask', 'close'
  ],
  actor: [
    'cover', 'hook', 'story', 'characters', 'journeys', 'visual', 'castTeam', 'close'
  ],
  brand: [
    'cover', 'hook', 'world', 'audience', 'visual', 'whyNow', 'revenue', 'ask', 'close'
  ],
  international: [
    'cover', 'hook', 'glance', 'story', 'world', 'audience', 'distribution', 'revenue', 'ask', 'close'
  ]
};

const SIZE_CORE = {
  compact: [
    'cover', 'hook', 'glance', 'story', 'world', 'characters', 'visual', 'audience',
    'whyNow', 'status', 'budget', 'ask', 'close'
  ],
  standard: [
    'cover', 'hook', 'glance', 'story', 'world', 'characters', 'visual', 'comps', 'audience',
    'whyNow', 'scale', 'approach', 'status', 'budget', 'useOfFunds', 'revenue', 'ask', 'close'
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
      conflict: clip(c.conflict || '', 140),
      arc: clip(c.arc || '', 140),
      art: c.lookUrl || c.imageUrl || c.portrait || '',
      status: c.castingStatus || 'PROPOSED'
    })),
    worldLines: locations,
    worldArt: worlds.map((w) => w.imageUrl || w.lookUrl || w.plate).filter(Boolean).slice(0, 6),
    visualLines: [...looks, ...lighting].slice(0, 8),
    dialogueBits,
    comps: [],
    budgetTotal: field('', 'DATA REQUIRED'),
    budgetScenarios: { lean: '', target: '', premium: '' },
    fundSplit: DEFAULT_FUND_SPLIT.map((x) => ({ ...x })),
    investmentAsk: field('', 'DATA REQUIRED'),
    contact: {
      company: PRODUCT,
      product: PRODUCT,
      email: 'pedditiram@gmail.com',
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

function selectSlideIds(audienceId, sizeId, facts) {
  const audience = AUDIENCE_SLIDES[audienceId] || AUDIENCE_SLIDES.investor;
  const core = SIZE_CORE[sizeId];
  const max = PITCH_SIZES.find((s) => s.id === sizeId)?.max || 20;
  let ids = core && sizeId !== 'detailed'
    ? core.filter((id) => audience.includes(id) || ['cover', 'hook', 'story', 'ask', 'close'].includes(id))
    : audience.slice();

  if (sizeId === 'detailed') ids = audience.slice();

  if (!(facts.characters || []).length) ids = ids.filter((id) => id !== 'journeys' && id !== 'characters');
  else if ((facts.characters || []).length < 2) ids = ids.filter((id) => id !== 'journeys');
  if (!(facts.worldArt || []).length && !(facts.worldLines || []).length) {
    /* keep world slide with DATA REQUIRED */
  }
  if (audienceId === 'actor') ids = ids.filter((id) => !['budget', 'useOfFunds', 'scenarios', 'structure'].includes(id));

  const must = ['cover', 'hook', 'ask', 'close'];
  must.forEach((id) => {
    if (!ids.includes(id)) ids.push(id);
  });
  if (!ids.includes('story') && audienceId !== 'brand') ids.splice(2, 0, 'story');

  return ids.slice(0, max);
}

/** Empty still frames — producer drops key art, portraits, plates. */
export const FRAME_PRESETS = {
  cover: [{ label: 'Key art', hint: 'One cinematic still. No type on the image.' }],
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
  castTeam: [{ label: 'Director' }, { label: 'Lead' }, { label: 'Key cast' }, { label: 'Department' }],
  close: [{ label: 'Closing still', hint: 'Title lockup. No numbers.' }]
};

export function blankPitchSlide(n = 1) {
  return slideRecord(
    `page_${n}`,
    `Slide ${String(n).padStart(2, '0')}`,
    'Title',
    '',
    [''],
    { frames: [{ label: 'Still' }, { label: 'Still 2' }] }
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
    disclaimer: extra.disclaimer || ''
  };
}

export function buildInvestorPitchDeck({
  facts,
  audienceId = 'investor',
  sizeId = 'standard',
  loglineText = '',
  fundSplit = DEFAULT_FUND_SPLIT
} = {}) {
  const theme = genreThemeFromKey(facts.genreKey);
  const tokens = themeTokens(theme);
  const logline = loglineText || generateLoglineOptions(facts)[0]?.text || '';
  const chars = facts.characters || [];
  const split = (fundSplit || DEFAULT_FUND_SPLIT).map((x) => ({ ...x }));
  const splitTotal = split.reduce((a, b) => a + Number(b.pct || 0), 0);

  const catalog = {
    cover: slideRecord(
      'cover',
      'Confidential · Feature film',
      facts.title,
      logline ? clip(logline, 180) : 'One-line hook — DATA REQUIRED',
      [
        facts.genreLabel,
        facts.language,
        'Feature Film',
        `${facts.productionCompany} presentation`
      ],
      {
        kind: 'cover',
        footer: 'Desire first. Numbers later.',
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
      { footer: 'Maximum 2–3 sentences' }
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
      ]
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
      { images: chars.map((c) => c.art).filter(Boolean).slice(0, 6) }
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
        `Producer — Pedditi Ram [PROPOSED]`,
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
      logline ? clip(logline, 140) : 'The next conversation.',
      [
        facts.contact.email,
        facts.contact.website,
        'No financial figures on this page.'
      ],
      { kind: 'cover', images: facts.worldArt.slice(0, 1), footer: PRODUCT }
    )
  };

  const ids = selectSlideIds(audienceId, sizeId, facts);
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
    theme,
    themeMood: tokens.mood,
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
    `Audience: ${deck.audienceId} · Length: ${deck.sizeId} · Theme: ${deck.themeMood || deck.theme}`,
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
  const headers = ['#', 'Id', 'Kicker', 'Title', 'Subtitle', 'Points', 'Disclaimer', 'Audience', 'Size', 'Project'];
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
