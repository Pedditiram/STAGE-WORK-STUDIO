import { CATEGORY, PRODUCT } from '../constants/brand';

/**
 * Opening thesis for Presentation mode.
 * One variant is chosen each time the reel mounts (app start / presentation on).
 */
export const PRESENTATION_OPENINGS = [
  {
    id: 'clip-vs-picture',
    kicker: 'The thesis',
    title: 'A clip is easy. A picture is not.',
    lede: 'Five seconds to three minutes of AI video is now a parlor trick. A two-hour professional movie is still a production — continuity, performance, light, and a director who can call the same look on shot four hundred as on shot one.',
    punch: 'Even when someone “finishes” a long AI cut, it rarely feels like traditional filmmaking. The director cannot hold the frame the way a slate, a crew, and a locked look allow.',
    welcome: `That gap is why ${PRODUCT} exists — an AI-powered production OS. Welcome to the creative journey.`,
    points: [
      { n: '5s–3m', label: 'Easy to generate a clip' },
      { n: '2 hrs', label: 'A professional picture is not' },
      { n: 'OS', label: 'Craft, not a chatbot' },
    ],
    beats: [
      'Short AI video is cheap, fast, and forgettable without a bible.',
      'Feature length needs a matrix: every craft on every shot.',
      'The director must get traditional-grade control — or the movie will not hold.',
    ],
  },
  {
    id: 'control',
    kicker: 'The director’s problem',
    title: 'Length was never the hard part.',
    lede: 'Anyone can prompt a pretty thirty seconds. The hard part is two hours that still look like one film — same faces, same world, same light, same intention from scene one to the end credits.',
    punch: 'A generated feature without a production OS leaves the director outside the take: they can ask, they cannot call.',
    welcome: `${PRODUCT} puts the slate back in their hands. ${CATEGORY}. Welcome to the creative journey.`,
    points: [
      { n: 'Clip', label: 'Prompt and hope' },
      { n: 'Feature', label: 'Lock look, then generate' },
      { n: 'You', label: 'Director on the desk' },
    ],
    beats: [
      'Traditional movies are won on continuity and craft, not a lucky seed.',
      'AI can paint frames. It cannot run a set unless you give it one.',
      'We built the set: page, matrix, compile, generate — one OS.',
    ],
  },
  {
    id: 'gap',
    kicker: 'The missing hours',
    title: 'Between the viral clip and the movie.',
    lede: 'The industry learned that a five-second to three-minute AI piece can look finished. A two-hour professional movie still collapses without a call sheet, a bible, and a director who can repeat the look.',
    punch: 'If someone forces a long cut anyway, it will not match traditional movie-making. The gap is the production — not the model.',
    welcome: `${PRODUCT} is the AI-powered production OS that fills that gap. Welcome to the creative journey.`,
    points: [
      { n: 'Easy', label: 'Short AI video' },
      { n: 'Hard', label: 'Two-hour cinema' },
      { n: 'Fill', label: 'Production OS in between' },
    ],
    beats: [
      'Clips do not need a crew. Pictures do.',
      'Models do not remember the last take unless the OS does.',
      'This desk is how directors get traditional results with AI labor.',
    ],
  },
  {
    id: 'welcome',
    kicker: 'Opening slate',
    title: 'Welcome to the creative journey.',
    lede: 'Generating a five-second to three-minute AI video is easy. Generating a two-hour professional movie is not. Even a completed long cut will not give a director the same results as traditional filmmaking — unless the craft is locked first.',
    punch: `${PRODUCT} comes in as the AI-powered production OS: the set, the matrix, and the take — so the picture can hold.`,
    welcome: 'From the first page to the last frame. The journey starts on this slate.',
    points: [
      { n: 'Easy', label: '5 seconds to 3 minutes' },
      { n: 'Not easy', label: 'A 2-hour picture' },
      { n: 'Here', label: `${PRODUCT}` },
    ],
    beats: [
      'Short form is a demo. Feature form is a production.',
      'Traditional results need traditional discipline — now on software.',
      'Sit down. The creative journey is the OS, not the prompt box.',
    ],
  },
  {
    id: 'set',
    kicker: 'Cinema, not a clip farm',
    title: 'The model is not the movie.',
    lede: 'A three-minute AI piece can dazzle. A two-hour professional movie has to survive wardrobe, weather, eyelines, and the director’s taste — take after take.',
    punch: 'Without a production OS, the director cannot get traditional movie-making results, no matter how strong the generator is.',
    welcome: `${PRODUCT} is that OS. Welcome to the creative journey.`,
    points: [
      { n: '3 min', label: 'A clip can fake a film' },
      { n: '120 min', label: 'A film cannot fake a set' },
      { n: 'Desk', label: 'Page → matrix → generate' },
    ],
    beats: [
      'Easy video is not the same as a picture you can release.',
      'Directors need a slate, not another chat window.',
      'We run the production so the AI can run the labor.',
    ],
  },
];

export function pickPresentationOpening() {
  const list = PRESENTATION_OPENINGS;
  const i = Math.floor(Math.random() * list.length);
  return list[i] || list[0];
}
