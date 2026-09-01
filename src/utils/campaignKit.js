/**
 * Campaign Kit — key art, outdoor, social, and market research from the slate.
 */

import { compileMasterCinemaPromoPrompt } from './promoPack';
import { PRODUCT } from '../constants/brand';
import { appendCreativeAudit } from './creativeAuditLog';

const TELUGU_RE = /[\u0C00-\u0C7F]/;

export const CAMPAIGN_CATEGORIES = [
  { id: 'Print', label: 'Print', note: 'Posters, outdoor flex, press, paper.' },
  { id: 'Digital', label: 'Digital', note: 'Stills for feeds, thumbs, OTT, tickets.' },
  { id: 'Video', label: 'Video', note: 'Motion cuts. Audio and duration allowed.' },
];

export const CAMPAIGN_CHANNELS = CAMPAIGN_CATEGORIES.map((c) => c.id);

export const CAMPAIGN_TONES = [
  { id: 'prestige', label: 'Prestige', note: 'Museum stills. Quiet type. Festival and multiplex cinephile.' },
  { id: 'mass', label: 'Mass theatrical', note: 'Face huge. Title huge. Street and bus first.' },
  { id: 'festival', label: 'Festival / trade', note: 'No spoilers. World and craft. Credit line small.' },
];

export const CAMPAIGN_LANGS = [
  { id: 'auto', label: 'Auto from slate' },
  { id: 'te', label: 'Telugu lead' },
  { id: 'en', label: 'English lead' },
  { id: 'bilingual', label: 'Bilingual lockup' },
];

export const CAMPAIGN_DENSITIES = [
  { id: 'quiet', label: 'Quiet', note: 'Title + one line. Outdoor-safe.' },
  { id: 'loud', label: 'Loud', note: 'Cast names, date, city, CTA on social.' },
];

export const CAMPAIGN_UNITS = [
  { id: 'onesheet', category: 'Print', channel: 'Theatrical', label: 'One-sheet', size: '27×40 in · 2:3', want: ['visual', 'character', 'reveal'], layout: 'Hero face left third. Title lockup bottom third. Credit block 8% from bottom.', aspect: '2:3 poster' },
  { id: 'character', category: 'Print', channel: 'Theatrical', label: 'Character lockup', size: '27×40 in · 2:3', want: ['character', 'emotion'], layout: 'MCU. Eyes on the upper third. Name plate under chin.', aspect: '2:3 poster' },
  { id: 'duo', category: 'Print', channel: 'Theatrical', label: 'Duo / conflict', size: '27×40 in · 2:3', want: ['tension', 'character', 'action'], layout: 'Two figures opposing. Title centered low. Split light.', aspect: '2:3 poster' },
  { id: 'ensemble', category: 'Print', channel: 'Theatrical', label: 'Ensemble / world', size: '27×40 in · 2:3', want: ['establishing', 'visual'], layout: 'Group in depth. Title as architecture, not sticker.', aspect: '2:3 poster' },
  { id: 'imax', category: 'Print', channel: 'Theatrical', label: 'IMAX / large format', size: '1.90:1 / 1.43:1', want: ['establishing', 'visual'], layout: 'Extreme scale. Tiny figure, huge world. Title in a solid bar.', aspect: '1.90:1' },
  { id: 'lobby', category: 'Print', channel: 'Theatrical', label: 'Lobby card', size: '11×14 in', want: ['character', 'visual'], layout: 'Still + title bar. No plot paragraph.', aspect: '11:14' },
  { id: 'standee', category: 'Print', channel: 'Theatrical', label: 'Standee', size: '6×3 ft', want: ['character'], layout: 'Life-size figure. Cutout-safe silhouette. Title at feet.', aspect: '2:1 vertical', vertical: true },
  { id: 'press_kit', category: 'Print', channel: 'Press', label: 'Press kit cover', size: 'A4 · 210×297 mm', want: ['visual', 'character'], layout: 'Quiet, museum. Title small. Still edge-to-edge.', aspect: 'A4' },
  { id: 'press_portrait', category: 'Print', channel: 'Press', label: 'Director / cast portrait', size: '4×5', want: ['character', 'emotion'], layout: 'Even light. Neutral ground. Name plate only.', aspect: '4:5', vertical: true },
  { id: 'festival_onesheet', category: 'Print', channel: 'Festival', label: 'Festival one-sheet', size: '27×40 in · 2:3', want: ['atmosphere', 'visual'], layout: 'No tagline shouting. Official selection bar optional.', aspect: '2:3 poster' },
  { id: 'festival_banner', category: 'Print', channel: 'Festival', label: 'Market banner', size: '3×1 m', want: ['establishing'], layout: 'Title + runtime + sales contact zone right.', aspect: '3:1' },
  { id: 'newspaper', category: 'Print', channel: 'Press', label: 'Newspaper ad', size: 'Quarter / half page', want: ['visual'], layout: 'B&W-safe contrast. Title huge. Date + city.', aspect: 'print' },
  { id: 'magazine', category: 'Print', channel: 'Press', label: 'Magazine DPS', size: 'A4 spread', want: ['establishing', 'atmosphere'], layout: 'Left still, right copy. Prestige paper.', aspect: 'print spread' },
  { id: 'hoarding_16x8', category: 'Print', channel: 'Outdoor', label: 'Hoarding 16×8', size: '16×8 ft', want: ['character', 'visual'], layout: 'Title 6 ft. Readable at 20 m.', aspect: '2:1 hoarding' },
  { id: 'hoarding_20x10', category: 'Print', channel: 'Outdoor', label: 'Hoarding 20×10', size: '20×10 ft', want: ['visual', 'establishing'], layout: 'Type 8 ft. Logo + title only. Readable at 30 m.', aspect: '2:1 hoarding' },
  { id: 'hoarding_30x10', category: 'Print', channel: 'Outdoor', label: 'Hoarding 30×10', size: '30×10 ft', want: ['establishing', 'atmosphere'], layout: 'Panoramic world. Title in a block left or right.', aspect: '3:1 hoarding' },
  { id: 'hoarding_40x10', category: 'Print', channel: 'Outdoor', label: 'Hoarding 40×10', size: '40×10 ft', want: ['establishing', 'visual'], layout: 'Traffic must read in 2 seconds. No tagline paragraphs.', aspect: '4:1 city hoarding' },
  { id: 'bus_back', category: 'Print', channel: 'Outdoor', label: 'Bus back', size: '70×30 in approx', want: ['character', 'reveal'], layout: 'Face + 3-word title. High contrast. Dirt-proof type.', aspect: '7:3' },
  { id: 'bus_side', category: 'Print', channel: 'Outdoor', label: 'Bus side', size: 'Full wrap panel', want: ['establishing', 'visual'], layout: 'Long read at 40 km/h. Title repeats twice.', aspect: '4:1' },
  { id: 'auto', category: 'Print', channel: 'Outdoor', label: 'Auto / cab back', size: 'Small panel', want: ['character'], layout: '3-word title. High contrast. Night-readable.', aspect: '3:2' },
  { id: 'metro', category: 'Print', channel: 'Outdoor', label: 'Metro / pillar', size: '4×6 ft', want: ['character', 'emotion'], layout: 'Vertical. Face. Title. Coming soon.', aspect: '2:3 poster' },
  { id: 'rail', category: 'Print', channel: 'Outdoor', label: 'Railway station', size: '20×10 ft', want: ['character', 'visual'], layout: 'Crowd + dust. Title only. No thin strokes.', aspect: '2:1 hoarding' },
  { id: 'airport', category: 'Print', channel: 'Outdoor', label: 'Airport lightbox', size: 'Backlit 16:9', want: ['atmosphere', 'visual'], layout: 'Prestige grade. Quiet type. Backlight-safe blacks.', aspect: '16:9' },

  { id: 'teaser_still', category: 'Digital', channel: 'Press', label: 'Teaser still', size: '1920×1080 · 16:9', want: ['establishing', 'atmosphere'], layout: 'World first. Right third clean for quote.', aspect: '16:9' },
  { id: 'social_9x16', category: 'Digital', channel: 'Social', label: 'Reels / Shorts cover', size: '1080×1920 · 9:16', want: ['action', 'reveal'], layout: 'Safe type top 250px / bottom 280px. Face in center third.', aspect: '9:16 vertical', vertical: true },
  { id: 'stories', category: 'Digital', channel: 'Social', label: 'Stories still', size: '1080×1920 · 9:16', want: ['character', 'visual'], layout: 'Swipe-up CTA bottom. No type in the top 14%.', aspect: '9:16 vertical', vertical: true },
  { id: 'social_1x1', category: 'Digital', channel: 'Social', label: 'Feed square', size: '1080×1080 · 1:1', want: ['character', 'visual'], layout: 'Centered subject. Title on lower fifth.', aspect: '1:1' },
  { id: 'carousel', category: 'Digital', channel: 'Social', label: 'Carousel card 1', size: '1080×1350 · 4:5', want: ['visual', 'atmosphere'], layout: 'First card must stop the thumb. Type large.', aspect: '4:5', vertical: true },
  { id: 'tiktok', category: 'Digital', channel: 'Social', label: 'TikTok cover', size: '1080×1920 · 9:16', want: ['action', 'reveal'], layout: 'Face + motion freeze. No thin type.', aspect: '9:16 vertical', vertical: true },
  { id: 'pinterest', category: 'Digital', channel: 'Social', label: 'Pinterest pin', size: '1000×1500 · 2:3', want: ['visual', 'atmosphere'], layout: 'Vertical still. Title as craft, not ad.', aspect: '2:3', vertical: true },
  { id: 'fb_cover', category: 'Digital', channel: 'Social', label: 'Facebook cover', size: '820×312', want: ['establishing'], layout: 'Title left. Profile crop will eat the left 180px.', aspect: '2.63:1' },
  { id: 'youtube_16x9', category: 'Digital', channel: 'Social', label: 'YouTube thumbnail', size: '1920×1080 · 16:9', want: ['action', 'character'], layout: 'Face large. Title never over eyes. Readable at 160px.', aspect: '16:9' },
  { id: 'yt_endcard', category: 'Digital', channel: 'Social', label: 'YouTube end card', size: '1920×1080 · 16:9', want: ['visual'], layout: 'Left 60% still. Right 40% subscribe / trailer CTA.', aspect: '16:9' },
  { id: 'x_banner', category: 'Digital', channel: 'Social', label: 'X / LinkedIn banner', size: '1500×500', want: ['establishing'], layout: 'Title left. Face or world right. Avoid dead center crop.', aspect: '3:1' },
  { id: 'whatsapp', category: 'Digital', channel: 'WhatsApp', label: 'WhatsApp status still', size: '1080×1920 · 9:16', want: ['reveal', 'visual'], layout: 'Huge type. 5-word max. High contrast for cheap phones.', aspect: '9:16 vertical', vertical: true },
  { id: 'wa_forward', category: 'Digital', channel: 'WhatsApp', label: 'Forward card', size: '1080×1080 · 1:1', want: ['character', 'visual'], layout: 'Title + date. Compresses well. No fine print.', aspect: '1:1' },
  { id: 'ott_thumb', category: 'Digital', channel: 'OTT', label: 'OTT title card', size: '1920×1080 · 16:9', want: ['atmosphere', 'character'], layout: 'Logo safe. Mood over plot. No credit novel.', aspect: '16:9' },
  { id: 'ott_hero', category: 'Digital', channel: 'OTT', label: 'OTT billboard', size: '3840×2160 · 16:9', want: ['establishing', 'visual'], layout: 'Left third clean for UI metadata. Cinematic grade.', aspect: '16:9' },
  { id: 'ott_vertical', category: 'Digital', channel: 'OTT', label: 'OTT mobile poster', size: '2000×3000 · 2:3', want: ['character', 'visual'], layout: 'Title top or bottom bar. Face uncropped on phones.', aspect: '2:3', vertical: true },
  { id: 'bms', category: 'Digital', channel: 'Ticketing', label: 'BookMyShow / Paytm', size: '1080×1080', want: ['character', 'visual'], layout: 'Title huge. Date + language. No busy background.', aspect: '1:1' },
  { id: 'email_header', category: 'Digital', channel: 'Press', label: 'Email / invite header', size: '1200×600', want: ['visual', 'atmosphere'], layout: 'Title left. Quiet still. Compresses in Gmail.', aspect: '2:1' },
  { id: 'website_hero', category: 'Digital', channel: 'OTT', label: 'Website hero', size: '2560×1440', want: ['establishing', 'visual'], layout: 'Center still. Nav-safe top. Title lower third.', aspect: '16:9' },

  { id: 'teaser_15', category: 'Video', channel: 'Theatrical', label: 'Teaser 15s', size: '15s · 16:9', durationSec: 15, want: ['reveal', 'atmosphere'], layout: 'World, one turn, title sting. No plot dump.', aspect: '16:9' },
  { id: 'spot_30', category: 'Video', channel: 'Theatrical', label: 'TV / cinema spot 30s', size: '30s · 16:9', durationSec: 30, want: ['action', 'character', 'reveal'], layout: 'Hook, face, clash, title. Hard out.', aspect: '16:9' },
  { id: 'cinema_bumper', category: 'Video', channel: 'Theatrical', label: 'Cinema bumper 8s', size: '8s · 1.85:1', durationSec: 8, want: ['visual', 'establishing'], layout: 'Silent-safe. Title last 2s. No busy VO.', aspect: '1.85:1' },
  { id: 'reels_15', category: 'Video', channel: 'Social', label: 'Reels / Shorts 15s', size: '15s · 9:16', durationSec: 15, want: ['action', 'reveal'], layout: 'Start in motion. Face in center third. Title in last 2s.', aspect: '9:16 vertical', vertical: true },
  { id: 'reels_30', category: 'Video', channel: 'Social', label: 'Reels 30s', size: '30s · 9:16', durationSec: 30, want: ['character', 'action', 'emotion'], layout: 'One event. Captions safe. End pose readable.', aspect: '9:16 vertical', vertical: true },
  { id: 'stories_video', category: 'Video', channel: 'Social', label: 'Stories 8s', size: '8s · 9:16', durationSec: 8, want: ['character', 'visual'], layout: 'Top 14% / bottom 18% chrome-safe. One beat.', aspect: '9:16 vertical', vertical: true },
  { id: 'tiktok_clip', category: 'Video', channel: 'Social', label: 'TikTok 12s', size: '12s · 9:16', durationSec: 12, want: ['action', 'reveal'], layout: 'Hook in 1s. No thin type. Native sound bed.', aspect: '9:16 vertical', vertical: true },
  { id: 'yt_bumper', category: 'Video', channel: 'Social', label: 'YouTube bumper 6s', size: '6s · 16:9', durationSec: 6, want: ['visual', 'character'], layout: 'Non-skippable. Face + title. No plot.', aspect: '16:9' },
  { id: 'yt_pre_15', category: 'Video', channel: 'Social', label: 'YouTube pre-roll 15s', size: '15s · 16:9', durationSec: 15, want: ['action', 'character'], layout: 'Skip-safe hook in 5s. Title before skip.', aspect: '16:9' },
  { id: 'wa_status_video', category: 'Video', channel: 'WhatsApp', label: 'WhatsApp status 8s', size: '8s · 9:16', durationSec: 8, want: ['reveal', 'visual'], layout: 'Huge type. Compresses on cheap phones. Loop-safe.', aspect: '9:16 vertical', vertical: true },
  { id: 'mall_led', category: 'Video', channel: 'Outdoor', label: 'Mall LED loop', size: '8s loop · 16:9', durationSec: 8, want: ['action', 'visual'], layout: 'Bright. No thin serifs. Seamless loop. 3-second read.', aspect: '16:9' },
  { id: 'led_truck', category: 'Video', channel: 'Outdoor', label: 'LED truck loop', size: '8s loop · 16:9', durationSec: 8, want: ['action', 'character'], layout: 'High nit. Title + face. No fine credits.', aspect: '16:9' },
  { id: 'ott_loop', category: 'Video', channel: 'OTT', label: 'OTT autoplay loop', size: '15s · 16:9', durationSec: 15, want: ['atmosphere', 'establishing'], layout: 'Muted-safe. UI left third clean. Mood, not plot.', aspect: '16:9' },
];

const METROS = [
  { id: 'hyd', city: 'Hyderabad', tier: 'A', spend: '₹40–90L outdoor', mix: 'ORR + Hitec + Tank Bund hoardings, mall LED, metro.', note: 'Telugu heart. Language-first. Premiere city.' },
  { id: 'vij', city: 'Vijayawada / Guntur', tier: 'A', spend: '₹18–40L outdoor', mix: 'Town hoardings, bus backs, auto panels.', note: 'Core theatrical. Family multiplex + single screens.' },
  { id: 'vzg', city: 'Visakhapatnam', tier: 'B', spend: '₹10–22L outdoor', mix: 'Beach LED, mall, railway.', note: 'Coastal multiplex. Weekend family.' },
  { id: 'tpt', city: 'Tirupati / Nellore', tier: 'B', spend: '₹6–14L outdoor', mix: 'Temple-road hoardings, bus.', note: 'Devotional-adjacent if the slate allows; else keep secular type.' },
  { id: 'wnl', city: 'Warangal / Khammam', tier: 'B', spend: '₹5–12L outdoor', mix: 'Town 20×10, WhatsApp.', note: 'Language-first. Thumbnail + street.' },
  { id: 'chn', city: 'Chennai', tier: 'A', spend: '₹12–28L crossover', mix: 'English + Telugu lockup, multiplex, airport.', note: 'Tamil belt crossover. Do not fake a Tamil film.' },
  { id: 'blr', city: 'Bengaluru', tier: 'A', spend: '₹10–24L', mix: 'English title can lead. Mall + metro.', note: 'Diaspora + multiplex. Quiet prestige stills work.' },
  { id: 'mum', city: 'Mumbai', tier: 'Trade', spend: '₹8–20L trade', mix: 'One-sheets, trade ads, festival rooms.', note: 'Do not buy mass hoardings unless a Hindi plan exists.' },
  { id: 'del', city: 'Delhi NCR', tier: 'Crossover', spend: '₹8–18L', mix: 'Metro pillars. Hindi/English support.', note: 'Festival + multiplex cinephile, not mass Telugu.' },
  { id: 'hyd_nri', city: 'Hyderabad NRI corridor', tier: 'Social', spend: '₹2–6L digital', mix: 'YouTube + WhatsApp only.', note: 'Crew forwards beat paid ads if the still is lockable.' },
  { id: 'usa', city: 'US / UK / Gulf diaspora', tier: 'Diaspora', spend: 'Digital only', mix: 'YouTube thumb, WhatsApp, BookMyShow geo.', note: 'No outdoor. Thumbnail is the poster. Trailer from Promo.' },
  { id: 'fest', city: 'Festival circuit', tier: 'Trade', spend: 'Print + travel', mix: 'Market one-sheet, stills pack, screener.', note: 'Berlin/TIFF/Busan grammar: world, not masala type.' },
];

const COMPS_BY_GENRE = {
  myth: ['Baahubali', 'RRR', 'Ponniyin Selvan', 'Kantara'],
  action: ['War', 'KGF', 'John Wick (tone ref, not clone)', 'Mad Max (scale ref)'],
  romance: ['Sita Ramam', 'La La Land (campaign grammar)', 'The Notebook (still grammar)'],
  cyberpunk: ['Blade Runner 2049 (key art grammar)', 'The Matrix (one-sheet grammar)', 'Altered Carbon'],
  default: ['Dune (world posters)', 'The Batman (character lockups)', 'Oppenheimer (type-led)'],
};

function clip(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function unique(values, max = 8) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const t = clip(raw, 160);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function liveShots(shots) {
  return (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived && !s.isMuted);
}

const APPROVED_CAMPAIGN_LIFE = new Set(['approved', 'locked']);

/** P107 — shots skipped from campaign units (muted/archived or not approved/locked). */
export function collectCampaignBeatExclusions(shots = []) {
  return (Array.isArray(shots) ? shots : []).filter(Boolean).map((s) => {
    const reasons = [];
    if (s.isArchived) reasons.push('archived');
    if (s.isMuted) reasons.push('muted');
    const life = String(s.lifecycleStatus || 'draft').toLowerCase();
    if (!APPROVED_CAMPAIGN_LIFE.has(life)) reasons.push(`lifecycle:${life || 'draft'}`);
    if (!reasons.length) return null;
    return {
      sceneShotId: String(s.sceneShotId || s.id || '').trim(),
      reasons
    };
  }).filter(Boolean);
}

export function auditCampaignBeatExclusions({ shots = [], projectTitle = '', category = '' } = {}) {
  const excluded = collectCampaignBeatExclusions(shots);
  if (!excluded.length) return excluded;
  const preview = excluded
    .slice(0, 12)
    .map((e) => `${e.sceneShotId || '?'} (${e.reasons.join(',')})`)
    .join('; ');
  appendCreativeAudit({
    projectTitle,
    category: 'export',
    action: 'campaign_beats_excluded',
    targetType: 'campaign',
    targetId: category || 'campaign',
    targetLabel: category || 'campaign kit',
    note: `${excluded.length} muted/unapproved beats skipped: ${preview}`
  });
  return excluded;
}

function blob(shot) {
  return [
    shot?.sceneSynopsis,
    shot?.actionEnvContext,
    shot?.characterDialogue,
    shot?.shotComposition,
    shot?.characterExpression,
    shot?.timeAndLightingEnv,
  ]
    .map((x) => String(x || ''))
    .join(' ')
    .toLowerCase();
}

function scoreShot(shot, want = []) {
  const t = blob(shot);
  let score = 1;
  const map = {
    establishing: /ews|establishing|wide|aerial|city|horizon/,
    atmosphere: /haze|fog|dusk|dawn|night|mood|volumetric/,
    action: /action|fight|chase|run|clash|strike/,
    reveal: /reveal|ecu|eyes|twist|shock/,
    emotion: /tear|grief|love|rage|smile|hope|fear/,
    tension: /threat|stare|danger|suspense/,
    character: /@|character|hero|lead/,
    visual: /cinematic|crane|orbit|composition/,
  };
  want.forEach((w) => {
    if (map[w]?.test(t) || (w === 'character' && shot?.characterIdAssetRef)) score += 3;
  });
  if (String(shot?.characterDialogue || '').length > 12) score += 1;
  const life = String(shot?.lifecycleStatus || 'draft').toLowerCase();
  if (life === 'approved' || life === 'locked') score += 2;
  if (life === 'draft') score -= 0.25;
  return score;
}

function pickShot(shots, want) {
  const live = liveShots(shots);
  if (!live.length) return null;
  return [...live].sort((a, b) => scoreShot(b, want) - scoreShot(a, want))[0];
}

function hasTelugu(shots) {
  return liveShots(shots).some((s) => TELUGU_RE.test(String(s.characterDialogue || '')));
}

function compsFor(genreKey) {
  const g = String(genreKey || '').toLowerCase();
  if (/myth|epic|period|folk/.test(g)) return COMPS_BY_GENRE.myth;
  if (/action|war|thriller/.test(g)) return COMPS_BY_GENRE.action;
  if (/romance|love/.test(g)) return COMPS_BY_GENRE.romance;
  if (/cyber|noir|neo/.test(g)) return COMPS_BY_GENRE.cyberpunk;
  return COMPS_BY_GENRE.default;
}

function languageMode(option, telugu) {
  if (option === 'te') return 'te';
  if (option === 'en') return 'en';
  if (option === 'bilingual') return 'bilingual';
  return telugu ? 'te' : 'en';
}

export function extractCampaignSpine(projectTitle, shots = [], genreKey = '', lang = 'auto') {
  const live = liveShots(shots);
  const title = String(projectTitle || 'UNTITLED').trim() || 'UNTITLED';
  const dialogues = unique(
    live.map((s) => s.characterDialogue).filter((d) => d && !/^\[/.test(String(d))),
    8
  );
  const hookLine = dialogues[0] || 'The look is the movie.';
  const tagline = dialogues[1] || dialogues[0] || 'One slate. One picture.';
  const syn = unique(live.map((s) => s.sceneSynopsis || s.scriptSynopsis), 3);
  const logline = syn[0] ? `${title}: ${clip(syn[0], 280)}` : `${title} — a picture built from ${live.length} locked shots.`;
  const telugu = hasTelugu(live);
  const langMode = languageMode(lang, telugu);
  const slug = title.replace(/[^\p{L}\p{N}]+/gu, '');
  return {
    title,
    logline,
    hookLine,
    tagline,
    dialogues,
    telugu,
    langMode,
    genreKey: genreKey || 'feature',
    pillars: [
      { id: 'hook', label: 'Hook', text: clip(hookLine, 140) },
      { id: 'character', label: 'Character', text: unique(live.flatMap((s) => String(s.characterIdAssetRef || '').split(/[,;/|]+/)), 1)[0] || 'Lead from the bible' },
      { id: 'world', label: 'World', text: unique(live.map((s) => s.timeAndLightingEnv || s.actionEnvContext), 1)[0] || 'Light and place from the matrix' },
      { id: 'stakes', label: 'Stakes', text: unique(live.map((s) => s.characterPsychologyState || s.sceneSynopsis), 1)[0] || 'What breaks if they fail' },
      { id: 'title', label: 'Title', text: title.toUpperCase() },
    ],
    hashtags: unique(
      [
        `#${slug}`,
        langMode === 'te' || langMode === 'bilingual' ? '#TeluguCinema' : '#Cinema',
        '#ComingSoon',
        '#OneSheet',
        genreKey ? `#${String(genreKey).replace(/\s+/g, '')}` : '',
        '#StageWorkStudio',
      ],
      8
    ),
    lockups: {
      te: langMode === 'en' ? 'English title lead. Telugu as support line on outdoor only if the market needs it.' : 'Telugu title lead on outdoor. English as a thin support.',
      en: 'English title at thumbnail size first. If it fails at 160px, it fails on YouTube.',
      bilingual: 'Same weight Telugu + English. Never stack three languages on a hoarding.',
    },
  };
}

function stillLine(value, max = 160) {
  const t = clip(
    String(value || '')
      .replace(/\[(?:Camera|Audio|Duration)[^\]]*\]/gi, ' ')
      .replace(/\b(?:0[–-][\d.]+s|Duration:\s*[\d.]+s)\b/gi, ' ')
      .replace(/\b(?:Seedance|video prompt|master cinema|AUDIO|SEQUENCE|whoosh|foley)\b/gi, ' ')
      .replace(/\b(?:tracking shot|dolly in|dolly out|steadicam|handheld move|crane up|orbit 360)\b/gi, 'locked still frame')
      .replace(/\s+/g, ' ')
      .trim(),
    max
  );
  return t;
}

function freezePose(action) {
  const t = stillLine(action, 180);
  if (!t) return 'Subject holds a readable peak pose. Frozen instant, not a clip.';
  return t
    .replace(/\b(starts?|begins?|continues?|keeps?)\s+/gi, '')
    .replace(/\b(running|walking|chasing|flying)\b/gi, 'caught mid-pose')
    .replace(/\s+/g, ' ')
    .trim();
}

function graphicMedium(unit) {
  const category = unit.category || 'Digital';
  if (category === 'Video') {
    return {
      id: 'video',
      label: 'Campaign video',
      job: 'Motion cut with duration and audio. Not a poster still.',
      extra: [
        'One event. Theatrical continuity. Hard end state.',
        'Match character bible. Same wardrobe and light as the matrix.',
        unit.vertical ? 'Frame 9:16. Faces in the vertical safe area.' : 'Keep action readable at platform crop.',
      ],
    };
  }
  if (category === 'Print') {
    return {
      id: 'print',
      label: 'Print still',
      job: 'Single-frame poster, outdoor flex, or press graphic. Not a video shot.',
      extra: [
        'CMYK-safe contrast. Title as designed type, not burned-in subtitles.',
        'Credit block only on theatrical one-sheet.',
        'No camera move, no duration, no audio, no 0–4s sequence.',
      ],
    };
  }
  return {
    id: 'digital',
    label: 'Digital still',
    job: 'Static graphic for feeds, thumbs, OTT, tickets. Not a Reels video prompt.',
    extra: [
      'Safe zones: keep faces and title out of UI chrome (top 14% / bottom 18% on 9:16).',
      'Readable at phone size. High contrast.',
      'No Seedance, no audio block, no clip duration.',
    ],
  };
}

function compileVideoUnitPrompt({ shot, unit, title, tagline, tone, density, langMode }) {
  const medium = graphicMedium(unit);
  const durationSec = unit.durationSec || 8;
  const cinema = compileMasterCinemaPromoPrompt({
    shot,
    beat: {
      sceneShotId: shot?.sceneShotId,
      segmentLabel: unit.label,
      action: shot?.actionEnvContext,
      composition: shot?.shotComposition,
      durationSec,
    },
    beatIndex: 0,
    projectTitle: title,
    template: { label: unit.label, vertical: !!unit.vertical },
    aspectRatio: unit.aspect,
  });
  const header = [
    `CAMPAIGN VIDEO — ${unit.label}`,
    `Category: Video · Placement: ${unit.channel}`,
    `Duration: ${durationSec}s · ${unit.size} · ${unit.aspect}`,
    `Layout: ${unit.layout}`,
    `Headline sting: ${String(title || '').toUpperCase()}`,
    `Tagline (VO optional): ${tagline || '—'}`,
    `Tone: ${tone} · Density: ${density} · Language: ${langMode}`,
    medium.job,
    ...medium.extra,
  ].join('\n');
  return {
    sceneShotId: shot?.sceneShotId || '',
    medium: 'video',
    mediumLabel: medium.label,
    imagePrompt: `${header}\n\n${cinema.masterCinemaPrompt || cinema.imagePrompt || ''}`,
    shortPrompt: cinema.imagePrompt || cinema.shortVideoPrompt || '',
  };
}

function compileStillUnitPrompt({ shot, unit, title, tagline, tone, density, langMode, cta }) {
  const medium = graphicMedium(unit);
  const lead = stillLine(shot?.characterIdAssetRef || shot?.characterName || 'Lead from the bible', 80);
  const wardrobe = stillLine(shot?.characterWardrobeCostume || shot?.wardrobe, 120);
  const light = stillLine(
    [shot?.subjectLightingTag, shot?.directionalLightingAndHighlight, shot?.timeAndLightingEnv].filter(Boolean).join(' · '),
    160
  );
  const grade = stillLine(shot?.subjectColorTag || shot?.backgroundColorTag, 80);
  const env = stillLine(shot?.actionEnvContext, 180);
  const framing = stillLine(shot?.shotComposition, 80) || 'Poster-friendly composition';
  const pose = freezePose(shot?.characterExpression || shot?.characterMovement || shot?.actionEnvContext);
  const world = stillLine(shot?.atmosphereVolumetricsTag, 80);

  const lines = [
    `${unit.category === 'Print' ? 'PRINT STILL' : 'DIGITAL STILL'} — ${medium.label}`,
    `NOT A VIDEO PROMPT. Not Seedance. Not audio. Not duration.`,
    `Job: ${medium.job}`,
    `Category: ${unit.category} · Placement: ${unit.channel} · Unit: ${unit.label}`,
    `Deliverable: ${unit.size} · ${unit.aspect}`,
    `Layout (graphic design): ${unit.layout}`,
    `Headline lockup: ${String(title || '').toUpperCase()}`,
    `Tagline (optional type, not spoken VO): ${tagline || '—'}`,
    density === 'loud' && unit.category !== 'Print' && cta ? `CTA type: ${cta}` : '',
    `Tone: ${tone} · Density: ${density} · Language: ${langMode}`,
    '',
    'FRAME (one still)',
    `Subject: ${lead}`,
    wardrobe ? `Wardrobe: ${wardrobe}` : '',
    `Pose (frozen): ${pose}`,
    `Environment: ${env || 'World from the locked matrix plate'}`,
    light ? `Light: ${light}` : '',
    grade ? `Grade: ${grade}` : '',
    world ? `Atmosphere: ${world}` : '',
    `Composition: ${framing}. Locked camera. No move.`,
    '',
    'GRAPHIC DESIGN',
    ...medium.extra,
    unit.vertical ? 'Vertical crop. Design for the hole, not the full bleed.' : 'Keep title in the designated third.',
    'Photoreal cinematic still. Match character bible. Same face, wardrobe, and grade as the matrix.',
    'No watermark, no extra limbs, no UI chrome unless this is an OTT billboard safe-zone.',
    'Do not write a shot sequence. Do not invent camera choreography.',
  ].filter((line) => line !== false && line != null);

  const shortPrompt = [
    `${medium.label}: ${unit.label} (${unit.size}).`,
    `${String(title || '').toUpperCase()}.`,
    pose,
    env,
    `Static ${unit.aspect}. Title lockup. No video.`,
  ].filter(Boolean).join(' ');

  return {
    sceneShotId: shot?.sceneShotId || '',
    medium: medium.id,
    mediumLabel: medium.label,
    imagePrompt: lines.join('\n'),
    shortPrompt,
  };
}

function compileUnitPrompt(args) {
  if (args.unit?.category === 'Video') return compileVideoUnitPrompt(args);
  return compileStillUnitPrompt(args);
}

export function buildCampaignResearch(projectTitle, shots = [], genreKey = '', opts = {}) {
  const tone = opts.tone || 'prestige';
  const spine = extractCampaignSpine(projectTitle, shots, genreKey, opts.lang);
  const live = liveShots(shots);
  const looks = unique(live.map((s) => s.subjectColorTag || s.subjectLightingTag), 4);
  const density = opts.density || 'quiet';
  const toneCopy = {
    prestige: {
      positioning: 'A locked-look picture, not a clip farm. Sell the two-hour sit, not a 15-second hit.',
      promise: 'You will remember the light.',
    },
    mass: {
      positioning: 'Street-first. Face, title, date. Family multiplex and single-screen walls.',
      promise: 'You will know who this is from 30 metres.',
    },
    festival: {
      positioning: 'Trade and programmers. World and craft. Spoilers stay off the one-sheet.',
      promise: 'A serious picture with a still that can hang in a market booth.',
    },
  }[tone] || {};
  return {
    question: 'Who is this picture for, and where does the first still have to work?',
    tone,
    density,
    positioning: toneCopy.positioning,
    messageHouse: {
      promise: toneCopy.promise,
      proof: 'Matrix crafts + character bible — same wardrobe, same grade, every unit.',
      reason: 'Clip campaigns die on a hoarding. Feature campaigns die in a 160px thumb. Design both.',
      rtb: `${live.length} locked shots on the slate. Promo holds the trailer; this console holds the street.`,
    },
    audience: {
      primary: spine.langMode === 'en'
        ? 'Director-led cinephile multiplex and streamer thumbnail graze.'
        : 'Telugu theatrical + family multiplex; language-first outdoor.',
      secondary: 'Diaspora YouTube / WhatsApp. Festival programmers who read one-sheets, not reels.',
      anti: 'Clip-farm viewers who bounce at 3 minutes. Do not design the campaign for them.',
      occasion: 'Weekend theatrical first. OTT billboard only after the theatrical window is named.',
    },
    insight: 'A 5s–3min AI clip needs a thumbnail. A two-hour picture needs a campaign that can survive a hoarding, a metro pillar, and a 160px YouTube thumb — same face, same light.',
    comps: compsFor(genreKey),
    lookNotes: looks.length ? looks : ['Lock grade from Matrix lighting crafts before printing outdoor.'],
    colorType: [
      density === 'loud' ? 'Social may carry date + city. Outdoor still title-only.' : 'Outdoor: title only. Social: title + one line.',
      'Never put credits on a 40×10.',
      'Test the title in black-and-white newsprint before you book the paper.',
      spine.lockups[spine.langMode === 'bilingual' ? 'bilingual' : spine.langMode === 'te' ? 'te' : 'en'],
    ],
    risks: [
      'Outdoor type smaller than 6 ft will vanish on a 40×10.',
      'Do not invent a new face for posters — use the locked bible.',
      'Credit block only on theatrical one-sheet, never on hoardings.',
      'Social safe zones eat 20% of 9:16. Design for the hole, not the full frame.',
      'Do not launch OTT hero art that contradicts the theatrical one-sheet.',
      spine.langMode === 'en' ? 'Test English title at thumbnail size before you print.' : 'Keep Telugu lockup on outdoor. English can ride as a support line.',
    ],
    platforms: [
      { id: 'ig', name: 'Instagram', use: 'Reels cover + 4:5 carousel. Hook line as caption. Stories for date drops.' },
      { id: 'yt', name: 'YouTube', use: 'Thumbnail + end card. Trailer lives in Promo, not here.' },
      { id: 'x', name: 'X / LinkedIn', use: 'Banner + still. Trade, not mass. No meme type.' },
      { id: 'wa', name: 'WhatsApp', use: 'Status + crew forwards. 5 words. Highest reach in Telugu markets.' },
      { id: 'th', name: 'Theatrical outdoor', use: '20×10 / 40×10 + bus + rail. Title only.' },
      { id: 'ott', name: 'OTT billboard', use: 'After theatrical. Quiet still, UI-safe left third.' },
      { id: 'bms', name: 'Ticketing', use: 'Square still. Language + date. Compresses on 2G.' },
      { id: 'press', name: 'Press', use: 'Teaser still + portrait. Quote-safe right third.' },
    ],
    mediaMix: [
      { bucket: 'Outdoor', share: tone === 'festival' ? '10%' : '45%', note: 'Hyd + coastal first. Kill Delhi mass unless a Hindi plan exists.' },
      { bucket: 'Digital video', share: '25%', note: 'YouTube + Reels. Cut from Promo. Covers from this kit.' },
      { bucket: 'WhatsApp / CRM', share: '15%', note: 'Crew and exhibitor forwards. Cost is design, not media.' },
      { bucket: 'Print / press', share: tone === 'mass' ? '5%' : '10%', note: 'One prestige still. No collage.' },
      { bucket: 'Contingency', share: '5–10%', note: 'Hold for clash week or a rain-killed hoarding reprint.' },
    ],
    spendBands: [
      { label: 'Micro / first feature', range: '₹25–60L', note: 'Hyd outdoor + digital. Skip Delhi/Mumbai mass.' },
      { label: 'Regional theatrical', range: '₹1.2–2.5Cr', note: 'AP/TS street + mall LED + YouTube.' },
      { label: 'Crossover / festival', range: '₹40L–1Cr + travel', note: 'Print, market booth, English one-sheet, no 40×10 wall.' },
    ],
    festivals: [
      { id: 'iffi', name: 'IFFI / Indian panorama', window: 'Nov', fit: 'National visibility. Need a quiet still + screener.' },
      { id: 'busan', name: 'Busan', window: 'Oct', fit: 'Asian market. English one-sheet. No masala type.' },
      { id: 'tiff', name: 'TIFF', window: 'Sep', fit: 'North America trade. Prestige grade.' },
      { id: 'berlin', name: 'Berlinale', window: 'Feb', fit: 'Art-house still. World over plot.' },
      { id: 'cannes_mar', name: 'Cannes Marché', window: 'May', fit: 'Sales banner + stills bible. Contact zone on the right.' },
      { id: 'goa_film', name: 'Hyderabad / regional fests', window: 'Rolling', fit: 'Local press. Telugu lockup allowed.' },
    ],
    calendar: [
      { week: 'W−12', beat: 'Lock face, grade, title treatment. No outdoor until this is signed.' },
      { week: 'W−8', beat: 'Teaser still + logline. No title treatment fight yet.' },
      { week: 'W−6', beat: 'Character lockups. Cast names if cleared.' },
      { week: 'W−5', beat: 'Festival / trade one-sheet if a market date exists.' },
      { week: 'W−4', beat: 'Theatrical one-sheet + YouTube thumb. Trailer cut from Promo.' },
      { week: 'W−3', beat: 'Hoardings, bus, rail. Ticketing square live.' },
      { week: 'W−2', beat: 'Reels covers + WhatsApp status pack. Mall LED.' },
      { week: 'W−1', beat: 'Metro + LED truck. Title locked. No new faces.' },
      { week: 'W0', beat: 'Release week. OTT hero held unless a streaming-day plan exists.' },
      { week: 'W+2', beat: 'Hold a thank-you still. Do not invent a new campaign look.' },
    ],
    tests: [
      { id: 'thumb', name: '160px thumbnail', method: 'Shrink the YouTube still. If the title dies, redesign.' },
      { id: 'night', name: 'Night hoarding', method: 'View the 20×10 on a phone at 5% brightness.' },
      { id: 'bw', name: 'Newsprint', method: 'Desaturate. If face and title vanish, raise contrast.' },
      { id: 'safe', name: '9:16 safe zone', method: 'Crop 14% top and 18% bottom. Face must survive.' },
      { id: 'lang', name: 'Language lockup', method: 'Show Telugu-only vs bilingual to 5 exhibitors, not Twitter.' },
    ],
    kpis: [
      { id: 'recall', name: 'Unaided title recall', target: 'Street intercept in Hyd after W−2.' },
      { id: 'thumb_ctr', name: 'Trailer CTR', target: 'YouTube thumb vs control still.' },
      { id: 'advance', name: 'Advance occupancy', target: 'BMS curve vs last same-genre weekend.' },
      { id: 'wa', name: 'Forward rate', target: 'Crew pack shares in first 48h.' },
    ],
    ctas: unique(
      [
        density === 'loud' ? `${spine.title.toUpperCase()} — in theatres` : 'In theatres',
        'Watch the trailer',
        'Book now',
        spine.langMode === 'te' ? 'థియేటర్స్‌లో' : 'Coming soon',
      ],
      6
    ),
    pressQ: [
      { q: 'What is this, a clip or a picture?', a: 'A two-hour sit. The campaign is built for walls, not only for feeds.' },
      { q: 'Why should exhibitors care?', a: 'Locked look, locked bible, outdoor that reads at 20 m.' },
      { q: 'Is this AI slop?', a: 'Craft is on the matrix. Posters do not invent a new face.' },
    ],
    legal: [
      'Clear likeness and name plates before character lockups print.',
      'Do not put unlicensed brand marks on hoardings.',
      'Festival laurels only after official selection.',
      'Credit block follows billing contract, not the designer.',
    ],
  };
}

export function buildCampaignKit({
  shots = [],
  projectTitle = 'Project',
  genreKey = '',
  channel = 'All',
  category = channel,
  tone = 'prestige',
  lang = 'auto',
  density = 'quiet',
} = {}) {
  const spine = extractCampaignSpine(projectTitle, shots, genreKey, lang);
  const research = buildCampaignResearch(projectTitle, shots, genreKey, { tone, lang, density });
  const unitDefs = category === 'All' ? CAMPAIGN_UNITS : CAMPAIGN_UNITS.filter((u) => u.category === category);
  const units = unitDefs.map((unit) => {
    const shot = pickShot(shots, unit.want);
    const compiled = compileUnitPrompt({
      shot,
      unit,
      title: spine.title,
      tagline: spine.tagline,
      tone,
      density,
      langMode: spine.langMode,
      cta: research.ctas?.[0],
    });
    return {
      ...unit,
      sceneShotId: compiled.sceneShotId,
      medium: compiled.medium,
      mediumLabel: compiled.mediumLabel,
      headline: spine.title.toUpperCase(),
      tagline: spine.tagline,
      credit: `${spine.title.toUpperCase()}  ·  ${PRODUCT}  ·  Coming soon`,
      imagePrompt: compiled.imagePrompt,
      shortPrompt: compiled.shortPrompt,
    };
  });
  return {
    kind: 'campaign',
    projectTitle: spine.title,
    genreKey,
    category,
    channel: category,
    tone,
    lang,
    density,
    spine,
    research,
    markets: METROS,
    units,
    createdAt: new Date().toISOString(),
    shotSourceCount: liveShots(shots).length,
    excludedBeats: collectCampaignBeatExclusions(shots),
  };
}

export function campaignKitToMarkdown(kit) {
  const lines = [`# ${kit.projectTitle} — Campaign kit`, '', kit.research?.insight || '', '', '## Logline', kit.spine?.logline || '', '', '## Pillars'];
  (kit.spine?.pillars || []).forEach((p) => lines.push(`- **${p.label}:** ${p.text}`));
  lines.push('', '## Positioning', kit.research?.positioning || '');
  lines.push('', '## Message house');
  const mh = kit.research?.messageHouse || {};
  lines.push(`Promise: ${mh.promise || ''}`);
  lines.push(`Proof: ${mh.proof || ''}`);
  lines.push(`RTB: ${mh.rtb || ''}`);
  lines.push('', '## Research');
  lines.push(`Primary: ${kit.research?.audience?.primary || ''}`);
  lines.push(`Secondary: ${kit.research?.audience?.secondary || ''}`);
  lines.push(`Avoid: ${kit.research?.audience?.anti || ''}`);
  lines.push('', 'Comps: ' + (kit.research?.comps || []).join(', '));
  lines.push('', '## Markets');
  (kit.markets || []).forEach((m) => lines.push(`- **${m.city}** (${m.tier || ''}, ${m.spend || ''}): ${m.note}`));
  lines.push('', '## Media mix');
  (kit.research?.mediaMix || []).forEach((m) => lines.push(`- **${m.bucket} ${m.share}:** ${m.note}`));
  lines.push('', '## Spend bands');
  (kit.research?.spendBands || []).forEach((s) => lines.push(`- **${s.label}** ${s.range}: ${s.note}`));
  lines.push('', '## Festivals');
  (kit.research?.festivals || []).forEach((f) => lines.push(`- **${f.name}** (${f.window}): ${f.fit}`));
  lines.push('', '## Calendar');
  (kit.research?.calendar || []).forEach((c) => lines.push(`- ${c.week}: ${c.beat}`));
  lines.push('', '## Tests');
  (kit.research?.tests || []).forEach((t) => lines.push(`- **${t.name}:** ${t.method}`));
  lines.push('', '## KPIs');
  (kit.research?.kpis || []).forEach((k) => lines.push(`- **${k.name}:** ${k.target}`));
  lines.push('', '## Press');
  (kit.research?.pressQ || []).forEach((p) => lines.push(`- Q: ${p.q}\n  A: ${p.a}`));
  lines.push('', '## Legal');
  (kit.research?.legal || []).forEach((n) => lines.push(`- ${n}`));
  lines.push('', '## Units');
  (kit.units || []).forEach((u, i) => {
    lines.push(`### ${i + 1}. ${u.category || ''} — ${u.label} (${u.size})`);
    lines.push(`${u.mediumLabel || 'Still'} · ${u.channel || ''} · Shot ${u.sceneShotId || '—'} · ${u.layout}`);
    lines.push('', u.imagePrompt || '', '');
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

/** Print-ready HTML for campaign kit PDF export. */
export function campaignKitToPrintHtml(kit, { roomId = '' } = {}) {
  const k = kit || {};
  const title = escapeHtml(k.projectTitle || 'Campaign Kit');
  const room = String(roomId || '').trim();
  const unitBlocks = (k.units || [])
    .map(
      (u, i) => `
      <section class="unit">
        <h3>${i + 1}. ${escapeHtml(u.category || '')} — ${escapeHtml(u.label || '')} (${escapeHtml(u.size || '')})</h3>
        <p class="meta">${escapeHtml(u.mediumLabel || 'Still')} · ${escapeHtml(u.channel || '')} · Shot ${escapeHtml(u.sceneShotId || '—')} · ${escapeHtml(u.layout || '')}</p>
        ${u.headline ? `<p><strong>Headline:</strong> ${escapeHtml(u.headline)}</p>` : ''}
        ${u.tagline ? `<p><strong>Tagline:</strong> ${escapeHtml(u.tagline)}</p>` : ''}
        ${u.imagePrompt ? `<pre class="prompt">${escapeHtml(u.imagePrompt)}</pre>` : ''}
      </section>`
    )
    .join('');

  const mh = k.research?.messageHouse || {};

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Campaign Kit</title>
  <style>
    @page { size: letter; margin: 0.6in; }
    body { font-family: system-ui, sans-serif; font-size: 10pt; color: #111; margin: 0; padding: 16px; line-height: 1.4; }
    h1 { font-size: 14pt; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.08em; }
    h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin: 16px 0 6px; }
    h3 { font-size: 11pt; margin: 0 0 4px; }
    .lead { color: #333; margin-bottom: 12px; }
    .meta { font-size: 9pt; color: #666; margin: 0 0 6px; }
    .unit { page-break-inside: avoid; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
    ul { margin: 0; padding-left: 1.2em; }
    .prompt { font-family: ui-monospace, monospace; font-size: 8pt; white-space: pre-wrap; background: #fafafa; border: 1px solid #eee; padding: 6px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Campaign Kit</h1>
  <p class="meta">${(k.units || []).length} units · ${escapeHtml(k.tone || '—')}/${escapeHtml(k.density || '—')}/${escapeHtml(k.lang || '—')}${room ? ` · Room ${escapeHtml(room)}` : ''} · ${escapeHtml(new Date().toISOString())}</p>
  <p class="lead">${escapeHtml(k.research?.insight || '')}</p>
  <h2>Logline</h2>
  <p>${escapeHtml(k.spine?.logline || '')}</p>
  <h2>Pillars</h2>
  <ul>${(k.spine?.pillars || []).map((p) => `<li><strong>${escapeHtml(p.label)}:</strong> ${escapeHtml(p.text)}</li>`).join('')}</ul>
  <h2>Positioning</h2>
  <p>${escapeHtml(k.research?.positioning || '')}</p>
  <h2>Message house</h2>
  <p>Promise: ${escapeHtml(mh.promise || '')}</p>
  <p>Proof: ${escapeHtml(mh.proof || '')}</p>
  <p>RTB: ${escapeHtml(mh.rtb || '')}</p>
  <h2>Markets</h2>
  <ul>${(k.markets || []).map((m) => `<li><strong>${escapeHtml(m.city)}</strong> (${escapeHtml(m.tier || '')}, ${escapeHtml(m.spend || '')}): ${escapeHtml(m.note || '')}</li>`).join('')}</ul>
  <h2>Calendar</h2>
  <ul>${(k.research?.calendar || []).map((c) => `<li>${escapeHtml(c.week || '')}: ${escapeHtml(c.beat || '')}</li>`).join('')}</ul>
  <h2>Units</h2>
  ${unitBlocks}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

export function campaignKitToCsv(kit) {
  const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
  const headers = ['order', 'category', 'placement', 'medium', 'label', 'size', 'sceneShotId', 'headline', 'tagline', 'layout', 'prompt'];
  const rows = (kit.units || []).map((u, i) =>
    [i + 1, u.category, u.channel, u.mediumLabel || 'still', u.label, u.size, u.sceneShotId, u.headline, u.tagline, u.layout, u.imagePrompt].map(esc).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/** ZIP pack: README markdown + CSV unit sheet (Storyboard ZIP parity). */
export function buildCampaignKitZipFiles(kit, { roomId = '' } = {}) {
  const title = kit?.projectTitle || 'project';
  return [
    { name: 'README.md', content: campaignKitToMarkdown(kit) },
    { name: 'units.csv', content: campaignKitToCsv(kit) },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Units: ${(kit?.units || []).length}`,
        `Tone: ${kit?.tone || ''}`,
        `Lang: ${kit?.lang || ''}`,
        `Density: ${kit?.density || ''}`,
        `Category: ${kit?.category || ''}`,
        `Room: ${String(roomId || '').trim() || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    }
  ];
}
