/**
 * Writer Console view modes — on-ramp from Final Draft / WriterDuet / Fade In / Highland
 * into the full SPS Studio surface.
 */

export const WRITER_VIEW_STORAGE_KEY = 'sps_writer_view_mode';
export const WRITER_VIEW_TIP_KEY = 'sps_writer_view_tip_seen';

/** Colors for classic cream page (readable on light paper). */
export const ELEMENT_COLORS_PAPER = {
  scene_heading: '#b45309',
  action: '#18181b',
  character: '#0e7490',
  parenthetical: '#52525b',
  dialogue: '#166534',
  transition: '#7e22ce',
  shot: '#a21caf',
  timing: '#0f766e',
  centered: '#a16207',
  note: '#a16207',
  blank: 'transparent'
};

/**
 * @typedef {'classic' | 'focus' | 'outline' | 'studio'} WriterViewMode
 */

export const WRITER_VIEW_MODES = [
  {
    id: 'classic',
    label: 'Page',
    short: 'Page',
    industry: 'Final Draft · Fade In',
    blurb: 'Familiar page + scene list. Studio tools tucked away so you can just write.',
    showSceneNav: true,
    sceneNavWide: false,
    showElementBar: true,
    showAssist: false,
    showStudioChrome: false,
    showColorsToggle: false,
    paper: 'cream',
    colorsDefault: false
  },
  {
    id: 'focus',
    label: 'Focus',
    short: 'Focus',
    industry: 'WriterDuet · Highland',
    blurb: 'Distraction-free page. Only Save, Help, and View — escape hatch to Studio anytime.',
    showSceneNav: false,
    sceneNavWide: false,
    showElementBar: false,
    showAssist: false,
    showStudioChrome: false,
    showColorsToggle: false,
    paper: 'cream',
    colorsDefault: false
  },
  {
    id: 'outline',
    label: 'Scenes',
    short: 'Scenes',
    industry: 'Final Draft Navigator',
    blurb: 'Wide scene navigator beside the script — jump, claim, and structure first.',
    showSceneNav: true,
    sceneNavWide: true,
    showElementBar: true,
    showAssist: false,
    showStudioChrome: false,
    showColorsToggle: false,
    paper: 'cream',
    colorsDefault: false
  },
  {
    id: 'studio',
    label: 'Studio',
    short: 'Studio',
    industry: 'SPS native',
    blurb: 'Full Writer Console — Intel, Co-Write, Colors, Archive, Sync, AI.',
    showSceneNav: true,
    sceneNavWide: false,
    showElementBar: true,
    showAssist: true,
    showStudioChrome: true,
    showColorsToggle: true,
    paper: 'dark',
    colorsDefault: true
  }
];

export function getWriterViewMode(id) {
  return WRITER_VIEW_MODES.find((m) => m.id === id) || WRITER_VIEW_MODES[0];
}

export function loadWriterViewMode() {
  try {
    const raw = localStorage.getItem(WRITER_VIEW_STORAGE_KEY);
    if (WRITER_VIEW_MODES.some((m) => m.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'classic';
}

export function saveWriterViewMode(id) {
  try {
    localStorage.setItem(WRITER_VIEW_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function cycleWriterViewMode(current) {
  const idx = WRITER_VIEW_MODES.findIndex((m) => m.id === current);
  const next = WRITER_VIEW_MODES[(idx + 1) % WRITER_VIEW_MODES.length];
  return next.id;
}

export const WRITER_VIEW_INTIMIDATION = {
  verdict:
    'Yes — the full Studio surface can feel intimidating to Final Draft / WriterDuet writers at first.',
  why: [
    'Too many top-bar actions at once (Intel, Co-Write, Archive, Sync, AI) that pure writing apps hide.',
    'Dark “console” chrome reads as production software, not a page you type on.',
    'Color scan + predictive assist are powerful but unfamiliar next to a plain FD page.',
    'Matrix Sync and craft language are SPS-native — great later, noisy on day one.'
  ],
  remedy:
    'Start in Page (Final Draft–like) or Focus (WriterDuet/Highland). Grow into Scenes, then Studio when ready.'
};
