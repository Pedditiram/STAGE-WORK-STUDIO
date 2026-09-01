/** Dummy film guests can explore. Never mixed with studio library. */

export const GUEST_PLAY_TITLE = 'GUEST PLAYGROUND';
export const GUEST_PLAY_ROOM = 'GUEST-PLAY';
export const GUEST_PLAY_ID = 'proj_guest_playground';

export function isGuestPlayTitle(title) {
  return String(title || '').trim().toUpperCase() === GUEST_PLAY_TITLE;
}

export const GUEST_PLAY_SHOTS = [
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
    characterIdAssetRef: '[CharID: @Mira - Dummy lead, curious, 20s]',
    coArtistInteraction: '[Co-Artist: @Kiran watching from a lower terrace]',
    actionEnvContext: 'A miniature rooftop city of cardboard lanes and string lights. This is a sandbox film — not a studio title.',
    characterExpression: 'Wonder, slight smile, wind in hair',
    characterPsychologyState: '[Mindstate: First day on a film set that is allowed to be messy]',
    characterMannerismAndPosture: '[Mannerism: Open stance, notebook in hand]',
    characterPlacement: 'Foreground right third, city falling away left',
    characterDialogue: '"If this is only a playground… then we can try anything."',
    characterMovement: 'Steps to the parapet and looks out',
    characterEyeLooks: '[Eye Look: Horizon, then down at the lanes]',
    sceneSynopsis: 'Mira arrives on a dummy rooftop set built so guests can learn Stage Work Studio without touching a real picture.',
    shotDurationAndImages: 'Duration: 4s'
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
    characterIdAssetRef: '[CharID: @Kiran - Dummy co-lead, dry humor]',
    coArtistInteraction: '[Co-Artist: @Mira just off-frame]',
    actionEnvContext: 'Kiran holds a chalk slate labeled GUEST PLAYGROUND. Nothing here is confidential.',
    characterExpression: 'Half-smile, raised eyebrow',
    characterPsychologyState: '[Mindstate: Showing a friend around the desk]',
    characterMannerismAndPosture: '[Mannerism: Lean on the slate]',
    characterPlacement: 'Center MCU',
    characterDialogue: '"Click around. Break the cut. Nobody\'s picture gets hurt."',
    characterMovement: 'Taps the slate twice',
    characterEyeLooks: '[Eye Look: Lens, conspiratorial]',
    sceneSynopsis: 'Kiran invites the guest to treat the Matrix, Form, and Writer as toys.',
    shotDurationAndImages: 'Duration: 3s'
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
    actionEnvContext: 'They walk a cardboard lane. A paper moon is stuck to the sky flat.',
    characterExpression: 'Shared laugh',
    characterPsychologyState: '[Mindstate: Play, not pressure]',
    characterMannerismAndPosture: '[Mannerism: Matching stride]',
    characterPlacement: 'Two-shot walking toward camera',
    characterDialogue: '"Scene two is just so the spreadsheet has more than one row."',
    characterMovement: 'Walk, pause at a paper stall',
    characterEyeLooks: '[Eye Look: Each other, then camera]',
    sceneSynopsis: 'A second scene so guests can switch rows, open Form, and compile a dummy prompt.',
    shotDurationAndImages: 'Duration: 5s'
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
    actionEnvContext: 'A dummy ticket reads ADMIT ONE — LOOK, TRY, DON\'T SAVE TO STUDIO.',
    characterExpression: 'Quiet, pleased',
    characterPsychologyState: '[Mindstate: The tour is enough]',
    characterMannerismAndPosture: '[Mannerism: Ticket between two fingers]',
    characterPlacement: 'CU hands and ticket, face soft above',
    characterDialogue: '"When you log in for real, this playground disappears."',
    characterMovement: 'Turns the ticket toward lens',
    characterEyeLooks: '[Eye Look: Ticket, then up]',
    sceneSynopsis: 'Button on the dummy: guests may play; the studio library stays locked.',
    shotDurationAndImages: 'Duration: 4s'
  }
];

export const GUEST_PLAY_SCREENPLAY = `TITLE: GUEST PLAYGROUND
A dummy short for Stage Work Studio guests. Not a studio picture.

FADE IN:

EXT. PAPER ROOFTOP CITY - DUSK

MIRA (20s) stands at a cardboard parapet. String lights. A paper moon.

                    MIRA
          If this is only a playground…
          then we can try anything.

KIRAN holds a chalk slate: GUEST PLAYGROUND.

                    KIRAN
          Click around. Break the cut.
          Nobody's picture gets hurt.

EXT. PAPER LANE - NIGHT

They walk. A stall. A dummy ticket.

                    MIRA
          When you log in for real,
          this playground disappears.

FADE OUT.
`;

export const GUEST_PLAY_CHARACTERS = [
  {
    id: 'guest_mira',
    name: 'Mira',
    tag: '@Mira',
    role: 'Dummy lead',
    age: '20s',
    backstory: 'A guest-tour guide. Not attached talent.',
    motivation: 'Show how Stage Work Studio rooms work.',
    conflict: 'The set is cardboard — the craft is real.',
    castingStatus: 'PROPOSED'
  },
  {
    id: 'guest_kiran',
    name: 'Kiran',
    tag: '@Kiran',
    role: 'Dummy co-lead',
    age: '20s',
    backstory: 'Holds the slate. Invites play.',
    motivation: 'Keep the sandbox fun and harmless.',
    conflict: 'Cannot open a real production title.',
    castingStatus: 'PROPOSED'
  }
];

export const GUEST_PLAY_WORLD = [
  {
    id: 'guest_rooftop',
    type: 'location',
    name: 'Paper rooftop city',
    title: 'Paper rooftop city',
    location: 'Dummy set — cardboard lanes, string lights',
    includeInPrompt: true
  }
];

export function getGuestPlayProject() {
  return {
    id: GUEST_PLAY_ID,
    title: GUEST_PLAY_TITLE,
    description: 'Sandbox for guests. Play in Matrix, Form, Writer. Nothing saves to the studio library.',
    targetModel: 'SPS Direct Cinema',
    aspectRatio: '2.39:1 Anamorphic',
    roomId: GUEST_PLAY_ROOM,
    lastModified: 'Guest sandbox',
    genreKey: 'cyberpunk',
    genreLabel: 'Dummy sandbox',
    shots: GUEST_PLAY_SHOTS.map((s) => ({ ...s })),
    isGuestPlayground: true
  };
}
