/**
 * Filled teaching film for a new registered account.
 * Not a guest sandbox — it lives in that user's library like any other title.
 */

export const DEMO_PROJECT_TITLE = 'SWS DESK DEMO';
export const DEMO_PROJECT_ID = 'proj_sws_desk_demo';
export const DEMO_PROJECT_ROOM = 'sps_sws_desk_demo';

export function isDemoProjectTitle(title) {
  return String(title || '').trim().toUpperCase() === DEMO_PROJECT_TITLE;
}

export const DEMO_PROJECT_SHOTS = [
  {
    sceneShotId: 'SC01_SH01',
    shotComposition: 'Extreme Wide Shot (EWS)',
    cameraMotionTag: '[Camera: Slow aerial push over a paper-craft city at dusk]',
    timeAndLightingEnv: '[Weather: Clear] • [Timing: Golden hour] • [Env: Rooftop]',
    directionalLightingAndHighlight: '[Angle: Warm key from west] • [Shadow: Long] • [Highlight: Amber rim]',
    subjectLightingTag: '[Lighting: Soft cinematic dusk]',
    subjectColorTag: '[Subject Color: Saffron and copper]',
    backgroundLightingTag: '[BG Lighting: City glow]',
    backgroundColorTag: '[BG Color: Dust-rose sky]',
    characterIdAssetRef: '[CharID: @Mira - Lead, curious, 20s]',
    coArtistInteraction: '[Co-Artist: @Kiran watching from a lower terrace]',
    actionEnvContext:
      'A miniature rooftop city of cardboard lanes and string lights. This demo film shows how a Stage Work Studio project is built.',
    characterExpression: 'Wonder, slight smile, wind in hair',
    characterPsychologyState: '[Mindstate: First day on a film set that is allowed to be messy]',
    characterMannerismAndPosture: '[Mannerism: Open stance, notebook in hand]',
    characterPlacement: 'Foreground right third, city falling away left',
    characterDialogue: '"Every film in this desk starts as a project card."',
    characterMovement: 'Steps to the parapet and looks out',
    characterEyeLooks: '[Eye Look: Horizon, then down at the lanes]',
    sceneSynopsis:
      'Mira arrives on the demo rooftop. Open Projects → this card. Writer holds the pages. Matrix holds the shots.',
    shotDurationAndImages: 'Duration: 4s',
    lifecycleStatus: 'review'
  },
  {
    sceneShotId: 'SC01_SH02',
    shotComposition: 'Medium Close-Up (MCU)',
    cameraMotionTag: '[Camera: Gentle handheld settle]',
    timeAndLightingEnv: '[Weather: Clear] • [Timing: Dusk] • [Env: Rooftop]',
    directionalLightingAndHighlight: '[Angle: Side key] • [Shadow: Soft cheek] • [Highlight: Eye light]',
    subjectLightingTag: '[Lighting: Portrait dusk]',
    subjectColorTag: '[Subject Color: Warm skin, copper scarf]',
    backgroundLightingTag: '[BG Lighting: Bokeh string lights]',
    backgroundColorTag: '[BG Color: Deep teal night coming on]',
    characterIdAssetRef: '[CharID: @Kiran - Co-lead, dry humor]',
    coArtistInteraction: '[Co-Artist: @Mira just off-frame]',
    actionEnvContext: 'Kiran holds a chalk slate labeled SWS DESK DEMO. Each row in Matrix is one shot.',
    characterExpression: 'Half-smile, raised eyebrow',
    characterPsychologyState: '[Mindstate: Showing a friend around the desk]',
    characterMannerismAndPosture: '[Mannerism: Lean on the slate]',
    characterPlacement: 'Center MCU',
    characterDialogue: '"Click a row. Form is that shot in full. Cast and World lock who and where."',
    characterMovement: 'Taps the slate twice',
    characterEyeLooks: '[Eye Look: Lens, conspiratorial]',
    sceneSynopsis: 'Kiran points at Matrix, Form, Cast, and World — the four rooms that make a film here.',
    shotDurationAndImages: 'Duration: 3s',
    lifecycleStatus: 'review'
  },
  {
    sceneShotId: 'SC02_SH01',
    shotComposition: 'Wide Shot (WS)',
    cameraMotionTag: '[Camera: Lateral tracking along paper streets]',
    timeAndLightingEnv: '[Weather: Night] • [Timing: Blue hour] • [Env: Lane]',
    directionalLightingAndHighlight: '[Angle: Practical lamps] • [Shadow: Graphic] • [Highlight: Specular tape]',
    subjectLightingTag: '[Lighting: Motivated practicals]',
    subjectColorTag: '[Subject Color: Teal jackets]',
    backgroundLightingTag: '[BG Lighting: Window squares]',
    backgroundColorTag: '[BG Color: Indigo cardboard]',
    characterIdAssetRef: '[CharID: @Mira]; [CharID: @Kiran]',
    coArtistInteraction: '[Co-Artist: Walking side by side]',
    actionEnvContext: 'They walk a cardboard lane. A paper moon is stuck to the sky flat. Scene two exists so the grid has more than one block.',
    characterExpression: 'Shared laugh',
    characterPsychologyState: '[Mindstate: Play, not pressure]',
    characterMannerismAndPosture: '[Mannerism: Matching stride]',
    characterPlacement: 'Two-shot walking toward camera',
    characterDialogue: '"Compile turns these crafts into a prompt. Generate makes the take."',
    characterMovement: 'Walk, pause at a paper stall',
    characterEyeLooks: '[Eye Look: Each other, then camera]',
    sceneSynopsis: 'A second scene so you can switch rows, open Form, and compile a prompt.',
    shotDurationAndImages: 'Duration: 5s',
    lifecycleStatus: 'draft'
  },
  {
    sceneShotId: 'SC02_SH02',
    shotComposition: 'Close-Up (CU)',
    cameraMotionTag: '[Camera: Static lock-off]',
    timeAndLightingEnv: '[Weather: Night] • [Timing: Night] • [Env: Stall]',
    directionalLightingAndHighlight: '[Angle: Under-lamp] • [Shadow: Soft] • [Highlight: Catchlight]',
    subjectLightingTag: '[Lighting: Intimate practical]',
    subjectColorTag: '[Subject Color: Gold ticket stub]',
    backgroundLightingTag: '[BG Lighting: Falloff]',
    backgroundColorTag: '[BG Color: Black felt]',
    characterIdAssetRef: '[CharID: @Mira]',
    coArtistInteraction: '[Co-Artist: Off]',
    actionEnvContext: 'A ticket reads ADMIT ONE — YOUR LIBRARY. After this demo, open MY FIRST FILM and write your picture.',
    characterExpression: 'Quiet, pleased',
    characterPsychologyState: '[Mindstate: The tour is enough]',
    characterMannerismAndPosture: '[Mannerism: Ticket between two fingers]',
    characterPlacement: 'CU hands and ticket, face soft above',
    characterDialogue: '"When you know the rooms, start your own title."',
    characterMovement: 'Turns the ticket toward lens',
    characterEyeLooks: '[Eye Look: Ticket, then up]',
    sceneSynopsis: 'End of the tour. Duplicate this film or open MY FIRST FILM to begin original work.',
    shotDurationAndImages: 'Duration: 4s',
    lifecycleStatus: 'draft'
  }
];

export const DEMO_PROJECT_SCREENPLAY = `TITLE: SWS DESK DEMO
A teaching short for a new Stage Work Studio account.

FADE IN:

EXT. PAPER ROOFTOP CITY - DUSK

MIRA (20s) stands at a cardboard parapet. String lights. A paper moon.

                    MIRA
          Every film in this desk
          starts as a project card.

KIRAN holds a chalk slate: SWS DESK DEMO.

                    KIRAN
          Click a row. Form is that shot
          in full. Cast and World lock
          who and where.

EXT. PAPER LANE - NIGHT

They walk. A stall. A gold ticket.

                    MIRA
          Compile turns crafts into a prompt.
          Generate makes the take.
          When you know the rooms,
          start your own title.

FADE OUT.
`;

export const DEMO_PROJECT_CHARACTERS = [
  {
    id: 'demo_mira',
    name: 'Mira',
    tag: '@Mira',
    role: 'Lead',
    age: '20s',
    backstory: 'Walks new filmmakers through the desk. Attached only to this teaching title.',
    motivation: 'Show Writer, Matrix, Form, Cast, and World in one short.',
    conflict: 'The set is cardboard — the craft is real.',
    appearance: 'Copper scarf, notebook, wind in hair',
    castingStatus: 'PROPOSED',
    includeInPrompt: true
  },
  {
    id: 'demo_kiran',
    name: 'Kiran',
    tag: '@Kiran',
    role: 'Co-lead',
    age: '20s',
    backstory: 'Holds the slate. Points at the rooms.',
    motivation: 'Keep the demo clear and harmless.',
    conflict: 'Cannot replace the user’s own first film.',
    appearance: 'Teal jacket, chalk slate',
    castingStatus: 'PROPOSED',
    includeInPrompt: true
  }
];

export const DEMO_PROJECT_WORLD = [
  {
    id: 'demo_rooftop',
    type: 'location',
    name: 'Paper rooftop city',
    title: 'Paper rooftop city',
    tag: '@World_Paper_Rooftop',
    location: 'Cardboard lanes, string lights, paper moon',
    description: 'Golden-hour rooftop miniature used to teach camera, light, and blocking.',
    includeInPrompt: true
  },
  {
    id: 'demo_lane',
    type: 'location',
    name: 'Paper lane',
    title: 'Paper lane',
    tag: '@World_Paper_Lane',
    location: 'Night street of cardboard stalls',
    description: 'Blue-hour lane so the Matrix has a second scene to switch into.',
    includeInPrompt: true
  }
];

export function buildDemoStudioProject({ name = '' } = {}) {
  const who = String(name || '').trim();
  return {
    id: DEMO_PROJECT_ID,
    title: DEMO_PROJECT_TITLE,
    description: who
      ? `${who} — walk Writer, Matrix, Form, Cast, World, then Compile.`
      : 'Walk Writer, Matrix, Form, Cast, World, then Compile. A filled example, not an empty card.',
    targetModel: 'SPS Direct Cinema 2.0',
    aspectRatio: '2.39:1 Anamorphic',
    roomId: DEMO_PROJECT_ROOM,
    lastModified: new Date().toLocaleDateString(),
    lastModifiedIso: new Date().toISOString(),
    genreKey: 'cyberpunk',
    genreLabel: 'Teaching short',
    shots: DEMO_PROJECT_SHOTS.map((s) => ({ ...s })),
    screenplayText: DEMO_PROJECT_SCREENPLAY,
    characterProfiles: DEMO_PROJECT_CHARACTERS.map((c) => ({ ...c })),
    worldAssets: DEMO_PROJECT_WORLD.map((a) => ({ ...a })),
    isDemoProject: true
  };
}
