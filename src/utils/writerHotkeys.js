/**
 * Writer Console hotkeys — aligned with Final Draft / WriterDuet muscle memory.
 * Refs: Final Draft KB element shortcuts; WriterDuet Ctrl/Cmd+1–7 line types.
 */

export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '')
  ? '⌘'
  : 'Ctrl';

export const WRITER_HOTKEY_GROUPS = [
  {
    id: 'elements',
    title: 'Script elements (Final Draft / WriterDuet standard)',
    items: [
      { keys: 'Tab', action: 'Cycle element type on current line', industry: 'FD / Fade In / WriterDuet' },
      { keys: 'Enter', action: 'Smart next element (Scene→Action→…)', industry: 'FD Return key' },
      { keys: 'Shift + Enter', action: 'Soft line break (plain newline)', industry: 'WriterDuet' },
      { keys: `${MOD} + 1`, action: 'Scene Heading', industry: 'FD / WriterDuet' },
      { keys: `${MOD} + 2`, action: 'Action', industry: 'FD / WriterDuet' },
      { keys: `${MOD} + 3`, action: 'Character', industry: 'FD / WriterDuet' },
      { keys: `${MOD} + 4`, action: 'Parenthetical', industry: 'FD / WriterDuet' },
      { keys: `${MOD} + 5`, action: 'Dialogue', industry: 'FD / WriterDuet' },
      { keys: `${MOD} + 6`, action: 'Transition', industry: 'FD / WriterDuet' },
      { keys: `${MOD} + 7`, action: 'Shot tag', industry: 'FD / WriterDuet' },
      { keys: `${MOD} + 9`, action: 'Insert [[NOTE]]', industry: 'WriterDuet Note' }
    ]
  },
  {
    id: 'navigate',
    title: 'Navigate & edit',
    items: [
      { keys: `${MOD} + F`, action: 'Find / Replace', industry: 'Universal' },
      { keys: `${MOD} + G`, action: 'Jump to next scene', industry: 'Go-to scene (WD)' },
      { keys: `${MOD} + Shift + G`, action: 'Jump to previous scene', industry: 'Scene nav' },
      { keys: `${MOD} + ↑ / ↓`, action: 'Previous / next scene', industry: 'Scene jump' },
      { keys: `${MOD} + S`, action: 'Save quick draft (Versions)', industry: 'Save' },
      { keys: `${MOD} + Shift + S`, action: 'Open Script Archive (milestones)', industry: 'Save As / Backup' },
      { keys: `${MOD} + P`, action: 'Export / Print PDF', industry: 'Print' },
      { keys: `${MOD} + Enter`, action: 'Fullscreen Console → again = draft page (Esc exits)', industry: 'Fullscreen' },
      { keys: 'Esc', action: 'Exit fullscreen · close panels / help', industry: 'Universal' },
      { keys: `${MOD} + Shift + Enter`, action: 'Sync to 25-Craft Matrix', industry: 'SPS exclusive' },
      { keys: `${MOD} + Shift + M`, action: 'Toggle voice to type (Auto / తెలుగు / EN)', industry: 'Dictation' }
    ]
  },
  {
    id: 'studio',
    title: 'Studio power tools (beyond industry apps)',
    items: [
      { keys: `${MOD} + Shift + I`, action: 'Writer Intel panel', industry: 'SPS exclusive' },
      { keys: `${MOD} + Shift + C`, action: 'Toggle Co-Write (scene locks)', industry: 'SPS exclusive' },
      { keys: `${MOD} + Shift + K`, action: 'Toggle color-coded scan', industry: 'SPS exclusive' },
      { keys: `${MOD} + Shift + A`, action: 'AI Co-Writer continue', industry: 'SPS exclusive' },
      { keys: `${MOD} + \\`, action: 'Toggle Focus ↔ Page view', industry: 'Focus mode' },
      { keys: `${MOD} + Shift + \\`, action: 'Cycle Page → Focus → Scenes → Studio', industry: 'View modes' },
      { keys: `${MOD} + /`, action: 'Open Writer Help', industry: 'Help cheat sheet' },
      { keys: 'Esc', action: 'Exit fullscreen · close panels / help / compare', industry: 'Universal' }
    ]
  }
];

/** Map digit key → screenplay element type (Cmd/Ctrl+1…7). */
export const ELEMENT_DIGIT_MAP = {
  '1': 'scene_heading',
  '2': 'action',
  '3': 'character',
  '4': 'parenthetical',
  '5': 'dialogue',
  '6': 'transition',
  '7': 'shot'
};

export function isModKey(e) {
  return e.metaKey || e.ctrlKey;
}

/**
 * Competitive comparison: SPS Writer Console vs industry apps.
 */
export const WRITER_COMPARISON = [
  {
    feature: 'Tab / Enter formatting muscle memory',
    fd: true,
    wd: true,
    fade: true,
    highland: 'partial',
    sps: true
  },
  {
    feature: 'Cmd/Ctrl+1–7 element shortcuts',
    fd: true,
    wd: true,
    fade: true,
    highland: false,
    sps: true
  },
  {
    feature: 'Fountain / FDX / PDF import–export',
    fd: 'fdx',
    wd: true,
    fade: true,
    highland: true,
    sps: true
  },
  {
    feature: 'Live color-coded scan (shot / timing / dialogue)',
    fd: false,
    wd: false,
    fade: false,
    highland: false,
    sps: true
  },
  {
    feature: 'Writer Intel — continuity, pacing, Matrix readiness',
    fd: false,
    wd: false,
    fade: false,
    highland: false,
    sps: true
  },
  {
    feature: 'Scene-locked multi-writer co-write + presence',
    fd: false,
    wd: true,
    fade: 'limited',
    highland: false,
    sps: true
  },
  {
    feature: 'Named revision Archive (Pink / Blue / Studio Lock)',
    fd: 'revisions',
    wd: 'history',
    fade: 'revisions',
    highland: false,
    sps: true
  },
  {
    feature: 'Version compare — changed-only + pop-out window',
    fd: false,
    wd: 'limited',
    fade: false,
    highland: false,
    sps: true
  },
  {
    feature: 'One-click sync → production Matrix (25 crafts)',
    fd: false,
    wd: false,
    fade: false,
    highland: false,
    sps: true
  },
  {
    feature: 'AI Co-Writer + Master Synopsis for prompt packages',
    fd: 'add-on',
    wd: 'add-on',
    fade: false,
    highland: false,
    sps: true
  },
  {
    feature: 'Tied to Character Bible / World / Director Vault',
    fd: false,
    wd: false,
    fade: false,
    highland: false,
    sps: true
  }
];

export const WRITER_HIGHLIGHTS = [
  {
    title: 'Production-native writing',
    body: 'Every draft can Sync into the 25-Craft Matrix — not a dead PDF export. Shots, camera tags, and crafts stay one pipeline.'
  },
  {
    title: 'Intel that Final Draft doesn’t ship',
    body: 'Live Continuity Radar, pacing heatmap, Beat Board, and Matrix Readiness score update as you type — offline and instant.'
  },
  {
    title: 'Co-write without chaos',
    body: 'Scene locks + presence keep multiple writers productive without Google-Docs cursor wars across the whole script.'
  },
  {
    title: 'Industry muscle memory, studio power',
    body: 'Tab / Enter / ⌘1–7 behave like Final Draft & WriterDuet — then go further with color scan, Archive milestones, and diff windows.'
  },
  {
    title: 'Revision discipline',
    body: 'Quick Drafts for experiments; Script Archive for Pink / Blue / Studio Lock milestones with restore + changed-only compare.'
  }
];

/** Curated digest for working writers. */
export const WRITER_RESOURCES = {
  websites: [
    {
      name: 'John August',
      url: 'https://johnaugust.com/',
      blurb: 'Working screenwriter essays, craft notes, and Scriptnotes companion posts.'
    },
    {
      name: 'Go Into The Story (Scott Myers)',
      url: 'https://gointothestory.blcklst.com/',
      blurb: 'Daily craft breakdowns, scene analysis, and Black List–adjacent writing culture.'
    },
    {
      name: 'The Black List',
      url: 'https://blcklst.com/',
      blurb: 'Industry script hosting, evaluations, and discovery for unproduced screenplays.'
    },
    {
      name: 'StudioBinder Blog',
      url: 'https://www.studiobinder.com/blog/',
      blurb: 'Shot lists, formatting refreshers, and production-aware writing explainers.'
    },
    {
      name: 'Script Revolution',
      url: 'https://www.scriptrevolution.com/',
      blurb: 'Free scripts, contests, and community reads — good for studying structure.'
    },
    {
      name: 'Fountain.io',
      url: 'https://fountain.io/',
      blurb: 'Plain-text screenplay standard — the interchange format SPS exports.'
    }
  ],
  blogs: [
    {
      name: 'Scriptnotes transcripts / archive',
      url: 'https://johnaugust.com/scriptnotes',
      blurb: 'John August & Craig Mazin — the gold-standard craft podcast write-ups.'
    },
    {
      name: 'Ken Miyamoto (ScreenCraft)',
      url: 'https://screencraft.org/blog/',
      blurb: 'Structure, loglines, and practical industry navigation.'
    },
    {
      name: 'Save the Cat! Beat Sheet resources',
      url: 'https://savethecat.com/blog',
      blurb: 'Popular commercial beat frameworks (use as tools, not dogma).'
    },
    {
      name: 'No Film School — Screenwriting',
      url: 'https://nofilmschool.com/topics/screenwriting',
      blurb: 'News, craft tips, and format refreshers for working filmmakers.'
    }
  ],
  youtube: [
    {
      name: 'Film Courage',
      url: 'https://www.youtube.com/@filmcourage',
      blurb: 'Long-form interviews with working writers & directors.'
    },
    {
      name: 'Lessons from the Screenplay',
      url: 'https://www.youtube.com/@LessonsfromtheScreenplay',
      blurb: 'Scene-level visual essays — how great scripts engineer emotion.'
    },
    {
      name: 'Script Jungle / Screenwriting channels',
      url: 'https://www.youtube.com/results?search_query=screenwriting+craft+scene+study',
      blurb: 'Search hub for craft deep-dives and scene studies.'
    },
    {
      name: 'StudioBinder YouTube',
      url: 'https://www.youtube.com/@StudioBinder',
      blurb: 'Shot design, camera language, and production storytelling.'
    },
    {
      name: 'Tyler Mowery',
      url: 'https://www.youtube.com/@TylerMowery',
      blurb: 'Story structure, character arcs, and practical writing drills.'
    }
  ]
};

export const WRITER_QUICK_START = [
  'Start in Page view (Final Draft–like cream page). Switch to Focus to hide chrome.',
  'Write sluglines as INT./EXT. LOCATION - TIME (or SC.01 …).',
  'Press Tab to cycle element · Enter for the next logical element.',
  'Use ⌘/Ctrl + 1–7 exactly like Final Draft / WriterDuet.',
  'When ready, open Studio for Colors, Intel, Co-Write, Archive, and Matrix Sync.',
  'Save Draft often; Archive Pink / Blue / Studio Lock before big rewrites.',
  'Compare versions with Changed only + Separate window.',
  'Enable Co-Write and Claim a scene when collaborating in the same room.'
];
