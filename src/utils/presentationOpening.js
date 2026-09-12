import { CATEGORY, PRODUCT } from '../constants/brand';

/**
 * Opening slate for Presentation mode — craft, crew, and the picture.
 * One variant is chosen each time the reel mounts.
 */
export const PRESENTATION_OPENINGS = [
  {
    id: 'welcome',
    kicker: 'Opening slate',
    title: 'Welcome to the creative journey.',
    lede: 'A picture is won on the desk — the page, the matrix, the crew, and a director who can call the same look from the first scene to the end credits.',
    punch: `${PRODUCT} is the ${CATEGORY}: one slate for story, craft, and collaboration.`,
    welcome: 'From the first page to the last frame. The journey starts on this slate.',
    points: [
      { n: 'Page', label: 'Story locked first' },
      { n: 'Craft', label: 'Every shot on the matrix' },
      { n: 'Crew', label: 'One platform worldwide' },
    ],
    beats: [
      'Feature form is a production — not a pile of loose takes.',
      'Traditional discipline, now on one studio desk.',
      'Sit down. The creative journey is the OS.',
    ],
  },
  {
    id: 'desk',
    kicker: 'The production desk',
    title: 'The set lives on the desk.',
    lede: 'Writer, matrix, compile, take, and reel — the same film, the same look, whether the director is on set or across the world.',
    punch: `${PRODUCT} keeps the slate in the director’s hands. ${CATEGORY}.`,
    welcome: 'Welcome to the creative journey.',
    points: [
      { n: 'Lock', label: 'Look before the take' },
      { n: 'Call', label: 'Craft on every shot' },
      { n: 'Share', label: 'Crew on one room' },
    ],
    beats: [
      'Continuity holds when the bible and the matrix travel with the film.',
      'Roles stay clear. Rooms do not overwrite each other.',
      'This is cinema production — built for pictures that hold.',
    ],
  },
];

export function pickPresentationOpening() {
  const list = PRESENTATION_OPENINGS;
  const i = Math.floor(Math.random() * list.length);
  return list[i] || list[0];
}
