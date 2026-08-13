/**
 * Cinematic references — movies, directors, DoPs, art direction, screenplays —
 * keyed by genre + craft so users can steer LLM intelligence with concrete examples.
 */

export const REFERENCE_CATEGORIES = [
  { id: 'movies', label: 'Movies' },
  { id: 'directors', label: 'Directors' },
  { id: 'dops', label: 'DoP / Camera' },
  { id: 'art', label: 'Art / Production Design' },
  { id: 'screenplays', label: 'Script / Screenplay' }
];

/** Genre-level style DNA (project / preset profile). */
export const GENRE_CINEMATIC_REFERENCES = {
  mythological: {
    label: 'Indian Mythology & Period Epic',
    why: 'Sacred scale, dharma stakes, golden rim light, mass armies, divine optics — fits Ramayana / Kara-Dhushan war epics.',
    movies: [
      'Baahubali: The Beginning / The Conclusion (SS Rajamouli) — mythic scale, mass battles, hero low-angles',
      'RRR (SS Rajamouli) — kinetic action grammar + emotional dharma arcs',
      'Ponniyin Selvan I–II (Mani Ratnam) — court intrigue, regal color, water & temple light',
      'Magadheera (SS Rajamouli) — reincarnation epic staging & war tableaux',
      'The Lord of the Rings trilogy (Peter Jackson) — fellowship scale, battlefield geography',
      'Gladiator (Ridley Scott) — hero solitude vs empire, dust & sun',
      'Hero (Zhang Yimou) — color-coded mythic combat chapters',
      'Kantara (Rishab Shetty) — folk-divine atmosphere, forest ritual energy'
    ],
    directors: [
      'SS Rajamouli — crowd geometry, delayed hero reveal, emotional payoffs',
      'Mani Ratnam — intimate politics inside epic frames',
      'Sanjay Leela Bhansali — ornamental color, slow ceremonial camera',
      'Peter Jackson — multi-army geography & fellowship staging',
      'Zhang Yimou — symbolic color chapters in combat'
    ],
    dops: [
      'KK Senthil Kumar — Baahubali/RRR anamorphic grandeur & golden rim',
      'Ravi Varman — PS1/PS2 liquid light, court palettes',
      'Andrew Lesnie — LOTR soft epic naturalism',
      'John Mathieson — Gladiator hard sun & dust',
      'Santosh Sivan — South-Asian lyrical light & texture'
    ],
    art: [
      'Sabu Cyril — Baahubali kingdoms, armor, monumental sets',
      'Thota Tharani — South-Indian period architecture language',
      'Grant Major / Dan Hennah — Middle-earth world build discipline',
      'Arthur Max — Gladiator Rome / arena material truth'
    ],
    screenplays: [
      'Ramayana (Valmiki) — dharma vs adharma act structure',
      'Baahubali story bible — dual-timeline reveal architecture',
      'The Lord of the Rings (adapted) — fellowship → war → return',
      'Gladiator — revenge / honor spine inside spectacle',
      'Save the Cat / Hero’s Journey — myth beats mapped to shots'
    ]
  },
  action: {
    label: 'Action',
    why: 'Impact clarity, readable geography, punchy coverage.',
    movies: [
      'Mad Max: Fury Road — center-framed chaos clarity',
      'John Wick — spatial gun-fu geography',
      'The Raid — vertical fight architecture',
      'Mission: Impossible – Fallout — practical stunt grammar'
    ],
    directors: ['George Miller', 'Chad Stahelski', 'Gareth Evans', 'Christopher McQuarrie'],
    dops: ['John Seale', 'Jonathan Sela', 'Matt Flannery'],
    art: ['Colin Gibson (Fury Road)', 'Dan Hennah'],
    screenplays: ['Fury Road visual script discipline', 'Wick continuous-space fight writing']
  },
  fantasy: {
    label: 'Fantasy',
    why: 'World rules made visible through light, costume, and scale.',
    movies: ['The Lord of the Rings', 'Pan’s Labyrinth', 'Dune (Villeneuve)', 'Crouching Tiger, Hidden Dragon'],
    directors: ['Peter Jackson', 'Guillermo del Toro', 'Denis Villeneuve', 'Ang Lee'],
    dops: ['Andrew Lesnie', 'Guillermo Navarro', 'Greig Fraser', 'Peter Pau'],
    art: ['Grant Major', 'Patrice Vermette', 'Eugenio Caballero'],
    screenplays: ['Dune adaptation restraint', 'Pan’s Labyrinth fairy-tale darkness']
  },
  historical: {
    label: 'Historical / Period',
    why: 'Material culture, hierarchical blocking, period light sources.',
    movies: ['Ponniyin Selvan', 'Jodhaa Akbar', 'The Last Emperor', 'Barry Lyndon'],
    directors: ['Mani Ratnam', 'Ashutosh Gowariker', 'Bernardo Bertolucci', 'Stanley Kubrick'],
    dops: ['Ravi Varman', 'Vittorio Storaro', 'John Alcott'],
    art: ['Darius Khondji collaborations', 'Ken Adam–era period craft'],
    screenplays: ['Period dialogue economy', 'Court intrigue scene spines']
  },
  bollywood: {
    label: 'Bollywood / Spectacle',
    why: 'Emotion-forward spectacle, song geography, star presence.',
    movies: ['Devdas (Bhansali)', 'Padmaavat', 'Kabhi Khushi Kabhie Gham', 'Dilwale Dulhania Le Jayenge'],
    directors: ['Sanjay Leela Bhansali', 'Karan Johar', 'Aditya Chopra'],
    dops: ['Sudeep Chatterjee', 'Anil Mehta'],
    art: ['Nitin Chandrakant Desai', 'Omung Kumar'],
    screenplays: ['Masala act turns', 'Interval blockbuster structure']
  },
  horror: {
    label: 'Horror',
    why: 'Negative space, sound-led dread, withheld information.',
    movies: ['The Witch', 'Hereditary', 'Tumbbad', 'A Quiet Place'],
    directors: ['Robert Eggers', 'Ari Aster', 'Rahi Anil Barve', 'John Krasinski'],
    dops: ['Jarin Blaschke', 'Pawel Pogorzelski'],
    art: ['Production design as dread character'],
    screenplays: ['Horror information control', 'Quiet set-piece writing']
  },
  noir: {
    label: 'Noir',
    why: 'Moral shadow, hard key, wet streets, voice-over psychology.',
    movies: ['Blade Runner', 'Chinatown', 'Se7en', 'Nightcrawler'],
    directors: ['Ridley Scott', 'Roman Polanski', 'David Fincher'],
    dops: ['Jordan Cronenweth', 'Darius Khondji', 'Jeff Cronenweth'],
    art: ['Neo-noir city as trap'],
    screenplays: ['Chinatown structure', 'Detective moral spiral']
  },
  scifi: {
    label: 'Sci-Fi',
    why: 'Future made tactile; tech subordinated to human stakes.',
    movies: ['Blade Runner 2049', 'Arrival', 'Interstellar', 'The Matrix'],
    directors: ['Denis Villeneuve', 'Christopher Nolan', 'Lana/Lilly Wachowski'],
    dops: ['Roger Deakins', 'Hoyte van Hoytema', 'Bill Pope'],
    art: ['Patrice Vermette', 'Nathan Crowley'],
    screenplays: ['Arrival linguistic reveal', 'Hard-sci-fi emotion first']
  },
  cyberpunk: {
    label: 'Cyberpunk',
    why: 'Neon wet streets, corporate verticality, body/tech tension.',
    movies: ['Blade Runner', 'Ghost in the Shell (1995)', 'The Matrix', 'Alita: Battle Angel'],
    directors: ['Ridley Scott', 'Mamoru Oshii', 'Wachowskis'],
    dops: ['Jordan Cronenweth', 'Bill Pope'],
    art: ['Syd Mead influence', 'Neon megacity layers'],
    screenplays: ['Cyberpunk noir voice', 'Identity vs system']
  },
  western: {
    label: 'Western',
    why: 'Horizon ethics, silence, dust, ritual violence.',
    movies: ['The Good, the Bad and the Ugly', 'Unforgiven', 'True Grit (2010)', 'The Assassination of Jesse James'],
    directors: ['Sergio Leone', 'Clint Eastwood', 'Coen Brothers', 'Andrew Dominik'],
    dops: ['Tonino Delli Colli', 'Roger Deakins', 'Jack N. Green'],
    art: ['Monument Valley grammar', 'Frontier town material truth'],
    screenplays: ['Leone opera of stares', 'Revisionist western morality']
  },
  romance: {
    label: 'Romance',
    why: 'Eye-lines, proximity, weather as emotion.',
    movies: ['In the Mood for Love', 'La La Land', 'The Notebook', 'Dilwale Dulhania Le Jayenge'],
    directors: ['Wong Kar-wai', 'Damien Chazelle', 'Aditya Chopra'],
    dops: ['Christopher Doyle', 'Linus Sandgren'],
    art: ['Color as longing'],
    screenplays: ['Subtext-heavy dialogue', 'Near-miss structure']
  },
  superhero: {
    label: 'Superhero',
    why: 'Iconic silhouettes, power geography, city as playground.',
    movies: ['The Dark Knight', 'Spider-Man: Into the Spider-Verse', 'Black Panther', 'Logan'],
    directors: ['Christopher Nolan', 'Ryan Coogler', 'James Mangold'],
    dops: ['Wally Pfister', 'Rachel Morrison', 'John Mathieson'],
    art: ['City identity as costume'],
    screenplays: ['Origin → responsibility', 'Grounded power cost']
  },
  adventure: {
    label: 'Adventure',
    why: 'Discovery rhythm, map logic, wonder shots.',
    movies: ['Indiana Jones', 'The Goonies', 'Jumanji', 'National Treasure'],
    directors: ['Steven Spielberg', 'Richard Donner'],
    dops: ['Douglas Slocombe', 'Janusz Kamiński'],
    art: ['Set-piece geography'],
    screenplays: ['Quest checklist with character cost']
  },
  samurai: {
    label: 'Samurai / Chanbara',
    why: 'Stillness before cut, honor codes, rain & steel.',
    movies: ['Seven Samurai', 'Yojimbo', '13 Assassins', 'The Last Samurai'],
    directors: ['Akira Kurosawa', 'Takashi Miike'],
    dops: ['Asakazu Nakai', 'Takumi Furuya'],
    art: ['Edo material authenticity'],
    screenplays: ['Kurosawa ensemble honor arcs']
  },
  spy: {
    label: 'Spy / Thriller',
    why: 'Surveillance optics, paranoia blocking, clean tradecraft.',
    movies: ['Tinker Tailor Soldier Spy', 'Casino Royale', 'Mission: Impossible', 'The Bourne Identity'],
    directors: ['Tomas Alfredson', 'Martin Campbell', 'Paul Greengrass'],
    dops: ['Hoyte van Hoytema', 'Phil Meheux', 'Oliver Wood'],
    art: ['Cold institutional spaces'],
    screenplays: ['Need-to-know dialogue', 'Betrayal turns']
  }
};

/**
 * Craft-level references — what masters teach this slot.
 * Keep short; genre block supplies title DNA.
 */
export const CRAFT_CINEMATIC_REFERENCES = {
  sceneSynopsis: {
    movies: ['Children of Men — single-breath scene pressure', '1917 — continuous-scene geography'],
    directors: ['Alfonso Cuarón', 'Sam Mendes'],
    screenplays: ['Scene goal / conflict / turn in one paragraph']
  },
  shotComposition: {
    movies: ['The Grand Budapest Hotel — centered formalism', 'Hero — color chapter frames', 'Baahubali — low-angle hero stature'],
    directors: ['Wes Anderson', 'Zhang Yimou', 'SS Rajamouli'],
    dops: ['Robert Yeoman', 'Christopher Doyle']
  },
  cameraMotionTag: {
    movies: ['1917 — motivated continuous move', 'Goodfellas Copacabana — storytelling Steadicam', 'Fury Road — center-punch tracking'],
    directors: ['Sam Mendes', 'Martin Scorsese', 'George Miller'],
    dops: ['Roger Deakins', 'Emmanuel Lubezki']
  },
  lensAndFocalLength: {
    movies: ['Lawrence of Arabia — deep epic primes', 'Barry Lyndon — candlelit fast lenses', 'Blade Runner 2049 — anamorphic scale'],
    dops: ['Freddie Young', 'John Alcott', 'Roger Deakins']
  },
  timeAndLightingEnv: {
    movies: ['Days of Heaven — magic hour discipline', 'Blade Runner — wet night sources', 'Ponniyin Selvan — temple & water light'],
    dops: ['Néstor Almendros', 'Jordan Cronenweth', 'Ravi Varman']
  },
  directionalLightingAndHighlight: {
    movies: ['The Godfather — overhead practicals', 'Citizen Kane — hard motivated shafts', 'Gladiator — sun as antagonist'],
    dops: ['Gordon Willis', 'Gregg Toland', 'John Mathieson']
  },
  subjectLightingTag: {
    movies: ['Skyfall — silhouette hero keys', 'Baahubali — golden rim on lead', 'Joker — practical face light'],
    dops: ['Roger Deakins', 'KK Senthil Kumar', 'Lawrence Sher']
  },
  subjectColorTag: {
    movies: ['Hero — costume color chapters', 'Amélie — warm subject saturation', 'Mad Max — desaturated flesh vs chrome'],
    directors: ['Zhang Yimou', 'Jean-Pierre Jeunet', 'George Miller']
  },
  backgroundLightingTag: {
    movies: ['Blade Runner 2049 — layered BG luminescence', 'In the Mood for Love — corridor practicals'],
    dops: ['Roger Deakins', 'Christopher Doyle']
  },
  backgroundColorTag: {
    movies: ['Grand Budapest — pastel architecture', 'Tumbbad — earth rot palette'],
    art: ['Adam Stockhausen', 'Production design as mood']
  },
  colorPaletteSlot: {
    movies: ['Hero', 'The Grand Budapest Hotel', 'Blade Runner 2049', 'Baahubali'],
    art: ['Locked swatch discipline per act']
  },
  atmosphereVolumetricsTag: {
    movies: ['Blade Runner — shafts & haze', 'Kantara — forest particulates', 'LOTRs — battlefield dust'],
    dops: ['Jordan Cronenweth', 'Andrew Lesnie']
  },
  characterIdAssetRef: {
    movies: ['Gladiator — Maximus iconography', 'Baahubali — costume as status', 'Black Panther — suit as culture'],
    art: ['Costume bible consistency'],
    screenplays: ['Character introduction image before dialogue']
  },
  coArtistInteraction: {
    movies: ['Heat — diner two-hander', 'The Dark Knight — interrogation blocking', 'Before Sunrise — walk-and-talk intimacy'],
    directors: ['Michael Mann', 'Christopher Nolan', 'Richard Linklater']
  },
  actionEnvContext: {
    movies: ['Fury Road — environment is chase', 'Children of Men — world in every plate', 'Kara-Dhushan war clearing as sacred geography'],
    art: ['Location as story pressure']
  },
  characterExpression: {
    movies: ['There Will Be Blood — micro-expression power', 'Joker — smile as mask', 'Nayak/period epics — regal restraint'],
    directors: ['Paul Thomas Anderson', 'Todd Phillips']
  },
  characterPsychologyState: {
    movies: ['Taxi Driver — interior monologue pressure', 'Whiplash — obsession mindstate', 'Gladiator — honor grief fuel'],
    screenplays: ['Subtext over speech', 'Want vs need']
  },
  characterMannerismAndPosture: {
    movies: ['No Country for Old Men — Chigurh gait', 'Sherlock Holmes (Ritchie) — physical thinking', 'Rajamouli heroes — spine & shoulders as status'],
    directors: ['Coen Brothers', 'Guy Ritchie', 'SS Rajamouli']
  },
  characterPlacement: {
    movies: ['The Godfather — power seating charts', '12 Angry Men — table geography', 'LOTRs fellowship staging'],
    directors: ['Francis Ford Coppola', 'Sidney Lumet', 'Peter Jackson']
  },
  characterDialogue: {
    movies: ['Network — monologue as weapon', 'Pulp Fiction — character voice', 'Court epics — dharma debate'],
    screenplays: ['Aaron Sorkin walk-and-talk', 'Tarantino digressive voice', 'Sanskritized elevated register for myth']
  },
  characterMovement: {
    movies: ['John Wick — readable fight beats', 'Crouching Tiger — weightless martial poetry', 'The Raid — exhaustion geography'],
    directors: ['Chad Stahelski', 'Ang Lee', 'Gareth Evans']
  },
  characterEyeLooks: {
    movies: ['The Good, the Bad and the Ugly — eye-line opera', 'Silence of the Lambs — POV stares', 'Heat — mutual recognition look'],
    directors: ['Sergio Leone', 'Jonathan Demme', 'Michael Mann']
  },
  shotDurationAndImages: {
    movies: ['Baby Driver — cut to rhythm', '1917 — long-take illusion', 'Mad Max — edit velocity'],
    directors: ['Edgar Wright', 'Sam Mendes', 'George Miller']
  },
  soundFxAndFoley: {
    movies: ['A Quiet Place — silence design', 'Dunkirk — Shepard tone pressure', 'The Matrix — bullet Foley myth'],
    directors: ['John Krasinski', 'Christopher Nolan', 'Wachowskis']
  },
  backgroundScoreMood: {
    movies: ['Interstellar — organ scale', 'Gladiator — honor theme', 'Baahubali — war drums & choir'],
    screenplays: ['Temp-score with story function, not wallpaper']
  }
};

/** Section-level references for non-craft surfaces (Writer, Director vault, World, Promo…). */
export const APP_SECTION_REFERENCES = {
  writer: {
    title: 'Writer Console · Script & Screenplay',
    movies: ['Network', 'Chinatown', 'Eternal Sunshine', 'The Social Network', 'Baahubali story architecture'],
    directors: ['Billy Wilder', 'Aaron Sorkin', 'Charlie Kaufman', 'SS Rajamouli (story)'],
    screenplays: [
      'John August / Scriptnotes craft',
      'Save the Cat beat map',
      'Hero’s Journey for myth epics',
      'Court / dharma debate scenes in Ramayana adaptations'
    ],
    why: 'Give the LLM clear act turns, character wants, and dialogue register before Matrix breakdown.'
  },
  director: {
    title: 'Director Psychology Vault',
    movies: ['Persona', 'There Will Be Blood', 'The Tree of Life', 'RRR emotional war'],
    directors: ['Ingmar Bergman', 'Paul Thomas Anderson', 'Terrence Malick', 'SS Rajamouli'],
    screenplays: ['Theme stated as moral question', 'Belief of success = audience hook'],
    why: 'Core idea + emotional frequency steers every Master Cinema compile.'
  },
  dop: {
    title: 'DoP / Camera Vision',
    movies: ['Blade Runner 2049', '1917', 'Baahubali', 'Skyfall'],
    dops: ['Roger Deakins', 'Emmanuel Lubezki', 'KK Senthil Kumar', 'Hoyte van Hoytema'],
    art: ['Light motivated by world sources', 'Anamorphic vs spherical intent'],
    why: 'Lock lens, key direction, and palette rules before craft enhance.'
  },
  art: {
    title: 'World & Art Direction',
    movies: ['Blade Runner', 'Baahubali', 'Dune', 'Hero'],
    art: ['Sabu Cyril', 'Patrice Vermette', 'Syd Mead', 'Grant Major'],
    moviesExtra: ['Empty plates first — no actors — then light'],
    why: 'World Bible plates keep LLM environments consistent across shots.'
  },
  character: {
    title: 'Character Bible',
    movies: ['There Will Be Blood', 'Joker', 'Gladiator', 'Baahubali'],
    screenplays: ['Backstory only as behavior fuel', 'Mannerism + gait + voice triad'],
    why: 'Persona notes prevent generic AI faces and line reads.'
  },
  promo: {
    title: 'Promo Pack · Trailer / Teaser',
    movies: ['Inception trailer grammar', 'Baahubali teaser scale drops', 'Dune mood teasers'],
    directors: ['Trailer editors: emotion before plot'],
    why: 'Reference trailer rhythm so AI Enhanced prompts hit marketing beats.'
  },
  compiler: {
    title: 'Prompt Compiler',
    movies: ['Any locked lookbook film for the project'],
    directors: ['One hero director + one DoP for the whole compile'],
    why: 'One style DNA block across Script Synopsis → Prompt keeps Seedance/SeeDream coherent.'
  }
};

function uniq(list = []) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item || '').trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

function detectGenreFromTitle(projectTitle = '') {
  const t = String(projectTitle || '').toLowerCase();
  if (/ramayan|kara|dhushan|mahabharat|baahubali|myth|ayodhya|janasthana|panchavati/.test(t)) {
    return 'mythological';
  }
  if (/blade runner|cyber|neon/.test(t)) return 'cyberpunk';
  if (/dune|matrix|interstellar|arrival/.test(t)) return 'scifi';
  if (/wick|raid|fury|action/.test(t)) return 'action';
  return null;
}

/**
 * Resolve merged references for UI + LLM.
 */
export function getCinematicReferences({
  genreKey = 'mythological',
  craftKey = null,
  projectTitle = '',
  sectionId = null,
  limitPerCategory = 6
} = {}) {
  const inferred = detectGenreFromTitle(projectTitle);
  const genre = genreKey || inferred || 'mythological';
  const genreBlock = GENRE_CINEMATIC_REFERENCES[genre] || GENRE_CINEMATIC_REFERENCES.mythological;
  const craftBlock = craftKey ? CRAFT_CINEMATIC_REFERENCES[craftKey] || {} : {};
  const sectionBlock = sectionId ? APP_SECTION_REFERENCES[sectionId] || {} : {};

  const mergeCat = (key) =>
    uniq([
      ...(sectionBlock[key] || []),
      ...(craftBlock[key] || []),
      ...(genreBlock[key] || [])
    ]).slice(0, limitPerCategory);

  return {
    genreKey: genre,
    genreLabel: genreBlock.label || genre,
    why: sectionBlock.why || craftBlock.why || genreBlock.why || '',
    sectionTitle: sectionBlock.title || null,
    craftKey: craftKey || null,
    movies: mergeCat('movies'),
    directors: mergeCat('directors'),
    dops: mergeCat('dops'),
    art: mergeCat('art'),
    screenplays: mergeCat('screenplays')
  };
}

/** Compact block for LLM system/user prompts. */
export function formatReferencesForLLM(refs, { maxItems = 4 } = {}) {
  if (!refs) return '';
  const lines = [];
  lines.push(`Cinematic style anchors (${refs.genreLabel || refs.genreKey || 'project'}):`);
  if (refs.why) lines.push(`Intent: ${refs.why}`);
  const push = (label, arr) => {
    const slice = (arr || []).slice(0, maxItems);
    if (slice.length) lines.push(`${label}: ${slice.join(' · ')}`);
  };
  push('Movies', refs.movies);
  push('Directors', refs.directors);
  push('DoP / Camera', refs.dops);
  push('Art / Design', refs.art);
  push('Script / Screenplay craft', refs.screenplays);
  lines.push('Use these as taste/direction only — do not copy plots; match tone, scale, light, and staging grammar.');
  return lines.join('\n');
}

export function hasAnyReferences(refs) {
  if (!refs) return false;
  return ['movies', 'directors', 'dops', 'art', 'screenplays'].some((k) => (refs[k] || []).length > 0);
}
