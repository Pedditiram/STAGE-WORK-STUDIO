/**
 * Character looks are composed by the APP from Matrix + bible evidence.
 * The LLM only fills missing facts (age/station, garments). It does not write
 * “character sheet / turnaround” prompts — those priors make image models
 * invent Western game-art warriors for every person.
 */

const EPIC_WORLD =
  /mahabharat|ramayan|kurukshetra|hastinapur|ayodhya|lanka|dwarka|mytholog|itihasa|puranic/i;

export function storyLooksIndianEpic({ title = '', synopsis = '', genreKey = '' } = {}) {
  if (String(genreKey).toLowerCase() === 'mythological') return true;
  return EPIC_WORLD.test(`${title} ${synopsis}`);
}

export function shotsMentionWeaponForPerson(shots = [], person = {}) {
  const name = String(person?.name || '').toLowerCase();
  if (name.length < 3) return false;
  const blob = (shots || [])
    .filter((s) => {
      const h = `${s?.characterIdAssetRef || ''} ${s?.characterIdMatrix || ''} ${s?.sceneSynopsis || ''} ${s?.actionEnvContext || ''}`.toLowerCase();
      return h.includes(name);
    })
    .map((s) => `${s.characterIdAssetRef || ''} ${s.makeupAndHairStyle || ''}`)
    .join(' ')
    .toLowerCase();
  return /sword|gadha|gada|bow|astra|kavacha|armor|armour|mace|chakra|trident|spear/.test(blob);
}

function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function personShots(shots, person) {
  const name = String(person?.name || '').toLowerCase();
  const tag = String(person?.tag || '').replace(/^@/, '').toLowerCase();
  return (shots || []).filter((s) => {
    const h = `${s?.sceneSynopsis || ''} ${s?.characterIdAssetRef || ''} ${s?.characterIdMatrix || ''} ${s?.characterDialogue || ''} ${s?.actionEnvContext || ''} ${s?.coArtistInteraction || ''} ${s?.makeupAndHairStyle || ''}`.toLowerCase();
    if (name.length > 2 && h.includes(name)) return true;
    if (tag.length > 2 && h.includes(tag)) return true;
    return false;
  });
}

function garmentsFromShots(pool, person) {
  const name = String(person?.name || '').toLowerCase();
  const bits = [];
  pool.forEach((s) => {
    [s.characterIdAssetRef, s.makeupAndHairStyle].forEach((line) => {
      const t = clip(line, 180);
      if (!t) return;
      if (name.length > 2 && t.toLowerCase().includes(name)) bits.push(t);
      else if (!name || t.length < 80) bits.push(t);
    });
  });
  return [...new Set(bits)].slice(0, 3);
}

/** Station from THIS person’s role + clothes + beats — not from a name encyclopedia. */
export function stationFromEvidence({ role = '', outfit = '', beats = '', garments = '' } = {}) {
  const blob = `${role} ${outfit} ${beats} ${garments}`.toLowerCase();
  if (/infant|newborn|baby/.test(blob)) return 'an infant in this story';
  if (/\bchild\b|\bboy\b|\bgirl\b|adolescent/.test(blob)) return 'a child of the age written in this story';
  if (/mother|widow|queen|princess|sari|pallu|veil|wife of/.test(blob)) {
    return 'an adult woman of this court/household, civilian dress of this world';
  }
  if (/king|father|priest|sage|minister|elder|patriarch/.test(blob)) {
    return 'an adult man of this court/household, as this film dresses him';
  }
  if (/soldier|warrior|kshatriya|commander|archer/.test(blob)) {
    return 'an adult combatant only as this film’s wardrobe shows, not a generic knight';
  }
  // Never invent “warrior” from a famous-name prior when wardrobe is civilian.
  return 'the age and station written for this person in this film (civilian unless their wardrobe says otherwise)';
}

export function worldCostumeLock({ title, synopsis, genreKey } = {}) {
  if (storyLooksIndianEpic({ title, synopsis, genreKey })) {
    return 'This film’s world is Indian period epic. Photoreal people of that world. Cloth is silk/cotton and gold of that court. Combat dress appears only on people whose Matrix wardrobe names it.';
  }
  return 'Photoreal cinema of THIS film’s period and place. Costume only as written for this person.';
}

export function composeLookFacts({
  char = {},
  shots = [],
  projectTitle = '',
  synopsis = '',
  genreKey = '',
  llmFacts = null
} = {}) {
  const pool = personShots(shots, char);
  const shotGarments = garmentsFromShots(pool, char);
  const outfit = clip(char.outfit, 200) || clip(llmFacts?.garments, 200) || shotGarments[0] || '';
  const beats = pool
    .map((s) => clip(s.sceneSynopsis || s.actionEnvContext, 140))
    .filter(Boolean)
    .slice(0, 3)
    .join(' / ');
  const armed = shotsMentionWeaponForPerson(shots, char);
  let station =
    clip(llmFacts?.ageStation, 160) ||
    stationFromEvidence({
      role: char.role,
      outfit,
      beats,
      garments: shotGarments.join(' ')
    });
  // Strip encyclopedia warrior priors when Matrix never armed this person.
  if (!armed && /warrior|knight|combatant/i.test(station) && !/soldier|warrior|kshatriya|commander|archer/i.test(`${char.role || ''} ${outfit}`)) {
    station = 'the age and station written for this person in this film (civilian unless their wardrobe says otherwise)';
  }
  return {
    name: char.name || 'this person',
    tag: char.tag || '',
    title: projectTitle || 'this film',
    synopsis: clip(synopsis, 400),
    genreKey,
    station,
    outfit,
    shotGarments,
    beats,
    place: clip(pool[0]?.actionEnvContext || pool[0]?.sceneSynopsis, 160),
    light: clip(pool[0]?.timeAndLightingEnv, 120),
    makeup: clip(pool[0]?.makeupAndHairStyle, 120),
    armed,
    role: char.role || '',
    backstory: clip(char.backstory, 220),
    hitCount: pool.length,
    world: worldCostumeLock({ title: projectTitle, synopsis, genreKey })
  };
}

const FORMAT_LOCK =
  'FORMAT: live-action production stills of one performer in one costume, same face in every panel. Not a video-game character sheet, not concept-art, not a fashion lookbook, not a grey cyclorama. Do not invent another culture’s armor or a teenage warrior unless this person’s wardrobe and station say so. Never default a civilian to a warrior prior.';

export function sheetPromptGuard(facts) {
  const f = facts || {};
  const antiWarrior = f.armed
    ? 'Arms/armor only as named in this person’s Matrix costume lines.'
    : 'Unarmed civilian of this film. FORBIDDEN: warrior, knight, armor harness, sword on hip, game-art hero — unless Matrix wardrobe for THIS person names them.';
  return [
    `PERSON: ${f.name} in "${f.title}" only.`,
    `STATION: ${f.station}`,
    `WORLD: ${f.world}`,
    f.outfit ? `COSTUME FROM THIS FILM: ${f.outfit}` : 'COSTUME: period dress of this world matching station — civilian unless wardrobe names combat gear.',
    antiWarrior,
    f.beats ? `THEIR SCENES: ${f.beats}` : 'Do not borrow another character’s scenes.',
    FORMAT_LOCK
  ].join('\n');
}

export function buildReferenceSheetsFromFacts(facts) {
  const f = facts || {};
  const g = sheetPromptGuard(f);
  const where = f.place || 'a location from their own scenes';
  const clothes = f.outfit || f.shotGarments?.[0] || 'period dress of this world matching their station';
  return {
    turnaround: `${g}\nFour matched live-action stills of ${f.name} (${f.station}): front, three-quarter, profile, back. Same adult face, same costume (${clothes}). Standing in ${where}. Photoreal cinema.`,
    expressions: `${g}\nSix close-ups of ${f.name} (${f.station}), same skull and age. Feelings from their scenes: ${f.beats || f.backstory || 'this plot'}. Photoreal 85mm.`,
    wardrobe: `${g}\nCostume continuity of ${f.name}: ${clothes}. ${f.makeup || ''} Worn in ${where}. Station: ${f.station}.`,
    psychology: `${g}\nPortrait of ${f.name} (${f.station}) in ${where}. Inner life from: ${f.backstory || f.beats || 'this film'}. Photoreal.`,
    mannerisms: `${g}\nFull-body still of ${f.name} (${f.station}) in ${where}, costume ${clothes}. Gait and hands from their scenes. Photoreal.`
  };
}

/** @deprecated name-list hints — keep empty so looks stay evidence-based. */
export function namedIdentityLock() {
  return '';
}
