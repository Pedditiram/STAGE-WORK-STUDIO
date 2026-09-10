/**
 * Filled teaching film for a new registered account.
 * Card title is THE LAST LETTER (coastal Andhra, 1986).
 */

export const DEMO_PROJECT_TITLE = 'THE LAST LETTER';
export const LEGACY_DEMO_TITLES = ['SWS DESK DEMO'];
export const DEMO_PROJECT_ID = 'proj_the_last_letter';
export const DEMO_PROJECT_ROOM = 'sps_the_last_letter';
export const DEMO_PROJECT_REVISION = 'the_last_letter';
export const DEMO_PROJECT_GENRE = 'konaseema_anthology';
export const DEMO_PROJECT_POSTER_URL = `${import.meta.env.BASE_URL || '/'}brand/the-last-letter-poster.jpg`;

export function isDemoProjectTitle(title) {
  const t = String(title || '').trim().toUpperCase();
  if (!t) return false;
  if (t === DEMO_PROJECT_TITLE) return true;
  return LEGACY_DEMO_TITLES.some((legacy) => t === String(legacy).trim().toUpperCase());
}

export function demoShotsLookFilled(shots) {
  return (
    Array.isArray(shots) &&
    shots.some((s) => /@Ravi\b/.test(String(s?.characterIdAssetRef || '')))
  );
}

export function demoSynopsisLooksFilled(text) {
  const t = String(text || '');
  return /\bRavi\b/i.test(t) && /\bLakshmi\b/i.test(t);
}

function demoPosterUrl(existing) {
  const cur = String(existing || '').trim();
  if (cur && !cur.startsWith('/api/project-poster') && !cur.startsWith('idb:')) return cur;
  return DEMO_PROJECT_POSTER_URL;
}

const PALETTE =
  '[Palette: Konaseema 1986 (#c4a35a Godavari gold | #8b4513 laterite | #1f4d3a coconut green | #f4e6c3 dust)]';

function shot(row) {
  return {
    colorPaletteSlot: PALETTE,
    atmosphereVolumetricsTag: row.atmosphereVolumetricsTag || '[Atmosphere: Coastal morning mist / river haze]',
    shotDurationAndImages: row.shotDurationAndImages || 'Duration: 5s',
    soundFxAndFoley: row.soundFxAndFoley || '[SFX: Distant crows, bicycle bells, tea stall hiss]',
    backgroundScoreMood: row.backgroundScoreMood || '[Score: Sparse Carnatic drone, restrained strings]',
    lensAndFocalLength: row.lensAndFocalLength || '40mm spherical T2.8',
    vfxCgiBreakdown: '[VFX: In-camera period — no CGI]',
    stuntAndSafetyNotes: '[Stunt: None]',
    makeupAndHairStyle: row.makeupAndHairStyle || '[Makeup: 1986 coastal Andhra, sun, dust, no gloss]',
    editTransitionCut: row.editTransitionCut || 'Hard Cut',
    characterIdMatrix: row.characterIdMatrix || 'Image_1 = character | Image_2 = environment',
    lifecycleStatus: row.lifecycleStatus || 'review',
    ...row
  };
}

export const DEMO_PROJECT_SHOTS = [
  shot({
    sceneShotId: 'SC01_SH01',
    shotComposition: 'Extreme Wide Shot (EWS)',
    cameraMotionTag: '[Camera: Slow locked-off hold, then a breath of tilt down the road]',
    timeAndLightingEnv: '[Weather: Mist] • [Timing: Early morning] • [Env: Village bus stop, coastal Andhra 1986]',
    directionalLightingAndHighlight: '[Angle: Soft east skylight] • [Shadow: Long pale] • [Highlight: Wet road sheen]',
    subjectLightingTag: '[Lighting: Overcast dawn, no sun disc yet]',
    subjectColorTag: '[Subject Color: Dust, laterite, faded khaki]',
    backgroundLightingTag: '[BG Lighting: Coconut silhouettes in haze]',
    backgroundColorTag: '[BG Color: Milk-tea sky]',
    characterIdAssetRef: '[CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: Cyclists passing, no connection]',
    actionEnvContext:
      'A quiet village wakes. Mist hangs over the road. A few bicycles pass. Ravi is a small figure beside a tea stall.',
    characterExpression: 'Waiting, contained',
    characterPsychologyState: '[Mindstate: Hope held very still]',
    characterMannerismAndPosture: '[Mannerism: Bag in one hand, weight on one hip]',
    characterPlacement: 'Far midground right of the stall, road running left-to-right',
    characterDialogue: '',
    characterMovement: 'Almost still — only the mist and bicycles move',
    characterEyeLooks: '[Eye Look: Down the empty road]',
    sceneSynopsis: 'EXT. VILLAGE BUS STOP — EARLY MORNING. The village wakes. Ravi waits.',
    charAssetIds: ['demo_ravi'],
    worldAssetIds: ['demo_bus_stop'],
    shotDurationAndImages: 'Duration: 6s',
    soundFxAndFoley: '[SFX: Bicycle bells, distant rooster, kettle]',
    editTransitionCut: 'Fade in'
  }),
  shot({
    sceneShotId: 'SC01_SH02',
    shotComposition: 'Medium Shot (MS)',
    cameraMotionTag: '[Camera: Gentle push toward Ravi]',
    timeAndLightingEnv: '[Weather: Mist thinning] • [Timing: Early morning] • [Env: Tea stall]',
    directionalLightingAndHighlight: '[Angle: Side key from stall lamp] • [Shadow: Soft cheek] • [Highlight: Envelope paper]',
    subjectLightingTag: '[Lighting: Warm practical vs cool road]',
    subjectColorTag: '[Subject Color: Worn cotton, leather bag]',
    backgroundLightingTag: '[BG Lighting: Road still grey]',
    backgroundColorTag: '[BG Color: Red laterite, whitewashed stall]',
    characterIdAssetRef: '[CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: Off]',
    actionEnvContext: 'RAVI, 24, stands beside the tea stall with a worn leather bag. He checks the address on a folded envelope.',
    characterExpression: 'Faint hope, jaw tight',
    characterPsychologyState: '[Mindstate: She said today]',
    characterMannerismAndPosture: '[Mannerism: Thumb on the envelope crease]',
    characterPlacement: 'Center, stall left, road right',
    characterDialogue: '',
    characterMovement: 'Looks down the road, then at the envelope',
    characterEyeLooks: '[Eye Look: Road, then the handwriting]',
    sceneSynopsis: 'Ravi waits with the envelope. An old red government bus approaches.',
    charAssetIds: ['demo_ravi'],
    worldAssetIds: ['demo_bus_stop'],
    lensAndFocalLength: '50mm T2.0'
  }),
  shot({
    sceneShotId: 'SC01_SH03',
    shotComposition: 'Wide Shot (WS)',
    cameraMotionTag: '[Camera: Pan with the bus as it stops, then hold]',
    timeAndLightingEnv: '[Weather: Mist] • [Timing: Morning] • [Env: Bus stop]',
    directionalLightingAndHighlight: '[Angle: Overcast] • [Shadow: Under the bus] • [Highlight: Red paint, chrome rail]',
    subjectLightingTag: '[Lighting: Flat morning, red bus as the only saturated object]',
    subjectColorTag: '[Subject Color: APSRTC red]',
    backgroundLightingTag: '[BG Lighting: Dust in the stop]',
    backgroundColorTag: '[BG Color: Red bus vs pale road]',
    characterIdAssetRef: '[CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: Passengers stepping down — not the person]',
    actionEnvContext: 'The old red government bus stops. Ravi searches every face. She is not there. The bus leaves.',
    characterExpression: 'Hope, then the drop',
    characterPsychologyState: '[Mindstate: Not today — again]',
    characterMannerismAndPosture: '[Mannerism: Steps forward, then still]',
    characterPlacement: 'Foreground left; bus midground',
    characterDialogue: '',
    characterMovement: 'Steps to the door, scans, does not board',
    characterEyeLooks: '[Eye Look: Each passenger, then the departing bus]',
    sceneSynopsis: 'The bus arrives. The person he waits for is not on it.',
    charAssetIds: ['demo_ravi'],
    worldAssetIds: ['demo_bus_stop'],
    soundFxAndFoley: '[SFX: Diesel idle, air brakes, bus departing]',
    shotDurationAndImages: 'Duration: 7s'
  }),
  shot({
    sceneShotId: 'SC01_SH04',
    shotComposition: 'Over-The-Shoulder (OTS)',
    cameraMotionTag: '[Camera: Static two-shot, slight drift]',
    timeAndLightingEnv: '[Weather: Morning] • [Timing: After the bus] • [Env: Tea stall]',
    directionalLightingAndHighlight: '[Angle: Stall lamp on Subbaiah] • [Shadow: Ravi half in road light] • [Highlight: Steel tumbler]',
    subjectLightingTag: '[Lighting: Warm stall, cool empty road]',
    subjectColorTag: '[Subject Color: Subbaiah’s grey shirt, Ravi’s faded blue]',
    backgroundLightingTag: '[BG Lighting: Empty road]',
    backgroundColorTag: '[BG Color: Dust white]',
    characterIdAssetRef: '[CharID: @Subbaiah]; [CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: SUBBAIAH, 55, tea stall owner, looking at Ravi]',
    actionEnvContext: 'SUBBAIAH: Still waiting? RAVI: She said she’d come today. SUBBAIAH: And if she doesn’t? RAVI: Then I’ll wait tomorrow.',
    characterExpression: 'Ravi: faint smile. Subbaiah: knowing, not unkind.',
    characterPsychologyState: '[Mindstate: Loyalty as a daily habit]',
    characterMannerismAndPosture: '[Mannerism: Ravi looks at the empty road; Subbaiah wipes a glass]',
    characterPlacement: 'Subbaiah foreground left; Ravi midground toward the road',
    characterDialogue: '"Still waiting?" / "She said she’d come today." / "And if she doesn’t?" / "Then I’ll wait tomorrow."',
    characterMovement: 'Ravi turns from Subbaiah to the road',
    characterEyeLooks: '[Eye Look: Subbaiah on Ravi; Ravi on the empty road]',
    sceneSynopsis: 'Subbaiah asks if he is still waiting. Ravi will wait tomorrow.',
    charAssetIds: ['demo_subbaiah', 'demo_ravi'],
    worldAssetIds: ['demo_bus_stop'],
    lensAndFocalLength: '35mm T2.8',
    editTransitionCut: 'Cut to'
  }),
  shot({
    sceneShotId: 'SC02_SH01',
    shotComposition: 'Wide Shot (WS)',
    cameraMotionTag: '[Camera: Slow interior push from the doorway]',
    timeAndLightingEnv: '[Weather: Clear] • [Timing: Afternoon] • [Env: Ravi’s tiled house]',
    directionalLightingAndHighlight: '[Angle: Hard sun through wooden windows] • [Shadow: Lattice on floor] • [Highlight: Dust motes]',
    subjectLightingTag: '[Lighting: Hot interior shafts]',
    subjectColorTag: '[Subject Color: Aged teak, whitewash]',
    backgroundLightingTag: '[BG Lighting: Deep room falloff]',
    backgroundColorTag: '[BG Color: Amber interior, cool window]',
    characterIdAssetRef: '[CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: Off]',
    actionEnvContext: 'A modest old tiled house. Sunlight through wooden windows. Ravi sits at a small desk, envelope still in hand.',
    characterExpression: 'Quiet, inward',
    characterPsychologyState: '[Mindstate: The wait continues indoors]',
    characterMannerismAndPosture: '[Mannerism: Seated, envelope unopened on the blotter]',
    characterPlacement: 'Desk midground, window right',
    characterDialogue: '',
    characterMovement: 'Sits, then reaches for a metal box',
    characterEyeLooks: '[Eye Look: The envelope, then the box]',
    sceneSynopsis: 'INT. RAVI’S HOUSE — AFTERNOON. Lattice light. The envelope is still in his hand.',
    charAssetIds: ['demo_ravi'],
    worldAssetIds: ['demo_house'],
    atmosphereVolumetricsTag: '[Atmosphere: Dust motes in sun shafts]',
    soundFxAndFoley: '[SFX: Ceiling fan, distant afternoon radio]',
    backgroundScoreMood: '[Score: Silence, then a thin flute]',
    lensAndFocalLength: '32mm T2.8'
  }),
  shot({
    sceneShotId: 'SC02_SH02',
    shotComposition: 'Close-Up (CU)',
    cameraMotionTag: '[Camera: Macro tilt through the open box]',
    timeAndLightingEnv: '[Weather: Interior] • [Timing: Afternoon] • [Env: Desk]',
    directionalLightingAndHighlight: '[Angle: Window edge light] • [Shadow: Inside the tin] • [Highlight: Red thread, watch glass]',
    subjectLightingTag: '[Lighting: Specular on metal, soft on paper]',
    subjectColorTag: '[Subject Color: Rust tin, red thread, faded emulsion]',
    backgroundLightingTag: '[BG Lighting: Desk blur]',
    backgroundColorTag: '[BG Color: Dark wood]',
    characterIdAssetRef: '[CharID: @Ravi]; [CharID: @Lakshmi]',
    coArtistInteraction: '[Co-Artist: Lakshmi only in the photograph]',
    actionEnvContext:
      'He opens an old metal box. Photographs, a broken wristwatch, letters tied with red thread. One photograph: RAVI and LAKSHMI, 22, beside a river.',
    characterExpression: 'Hands careful, face unseen',
    characterPsychologyState: '[Mindstate: Memory as an object]',
    characterMannerismAndPosture: '[Mannerism: Thumb on the photograph edge]',
    characterPlacement: 'Hands and box fill the frame',
    characterDialogue: '',
    characterMovement: 'Lifts the photograph',
    characterEyeLooks: '[Eye Look: Implied — on the river photo]',
    sceneSynopsis: 'The box: photographs, a broken watch, letters. Ravi and Lakshmi by the river.',
    charAssetIds: ['demo_ravi', 'demo_lakshmi'],
    worldAssetIds: ['demo_house'],
    lensAndFocalLength: '85mm T2.0',
    makeupAndHairStyle: '[Makeup: Period photograph grain; present-day hands dusty]',
    shotDurationAndImages: 'Duration: 4s'
  }),
  shot({
    sceneShotId: 'SC02_SH03',
    shotComposition: 'Medium Close-Up (MCU)',
    cameraMotionTag: '[Camera: Hold, then a small push as he opens the letter]',
    timeAndLightingEnv: '[Weather: Interior] • [Timing: Afternoon] • [Env: House]',
    directionalLightingAndHighlight: '[Angle: Window] • [Shadow: Meena in the doorway] • [Highlight: Steel tumbler]',
    subjectLightingTag: '[Lighting: Split — Ravi in sun, Meena in shade]',
    subjectColorTag: '[Subject Color: Meena’s cotton sari pallu, steel]',
    backgroundLightingTag: '[BG Lighting: Kitchen dark]',
    backgroundColorTag: '[BG Color: Whitewash and teak]',
    characterIdAssetRef: '[CharID: @Meena]; [CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: MEENA, 18, sister, carrying water]',
    actionEnvContext:
      'MEENA: Anna… why are you still keeping these? Is that from her? RAVI: No. He opens the envelope. One handwritten letter. His expression changes.',
    characterExpression: 'Meena: worried. Ravi: the face that has just read something it cannot undo.',
    characterPsychologyState: '[Mindstate: The letter is not from her — and it is worse]',
    characterMannerismAndPosture: '[Mannerism: Meena holds the tumbler; Ravi unfolds paper]',
    characterPlacement: 'Meena doorway left; Ravi desk right',
    characterDialogue: '"Anna… why are you still keeping these?" / "Is that from her?" / "No."',
    characterMovement: 'Ravi opens the letter and begins to read',
    characterEyeLooks: '[Eye Look: Meena on the envelope; Ravi on the page]',
    sceneSynopsis: 'Meena asks about the envelope. Ravi opens the letter. His face changes.',
    charAssetIds: ['demo_meena', 'demo_ravi'],
    worldAssetIds: ['demo_house'],
    editTransitionCut: 'Cut to flashback'
  }),
  shot({
    sceneShotId: 'SC03_SH01',
    shotComposition: 'Wide Shot (WS)',
    cameraMotionTag: '[Camera: Slow lateral drift along the river]',
    timeAndLightingEnv: '[Weather: Clear] • [Timing: Sunset — FLASHBACK] • [Env: Godavari riverbank]',
    directionalLightingAndHighlight: '[Angle: Golden west] • [Shadow: Long on sand] • [Highlight: Water glitter]',
    subjectLightingTag: '[Lighting: Magic-hour wrap]',
    subjectColorTag: '[Subject Color: Lakshmi’s mustard sari, Ravi’s white shirt]',
    backgroundLightingTag: '[BG Lighting: River as a gold sheet]',
    backgroundColorTag: '[BG Color: Godavari gold, green far bank]',
    characterIdAssetRef: '[CharID: @Ravi]; [CharID: @Lakshmi]',
    coArtistInteraction: '[Co-Artist: Sitting together beneath a large tree]',
    actionEnvContext: 'EXT. GODAVARI RIVERBANK — SUNSET — FLASHBACK. Ravi and Lakshmi sit beneath a large tree. Golden light on the water.',
    characterExpression: 'Young, unguarded',
    characterPsychologyState: '[Mindstate: A promise that still feels easy]',
    characterMannerismAndPosture: '[Mannerism: Shoulders almost touching]',
    characterPlacement: 'Lower third under the tree; river occupying the rest',
    characterDialogue: '',
    characterMovement: 'Breathing with the water',
    characterEyeLooks: '[Eye Look: Each other, then the river]',
    sceneSynopsis: 'Flashback. Godavari sunset. Ravi and Lakshmi under the tree.',
    charAssetIds: ['demo_ravi', 'demo_lakshmi'],
    worldAssetIds: ['demo_godavari'],
    atmosphereVolumetricsTag: '[Atmosphere: River haze, pollen, warm air]',
    soundFxAndFoley: '[SFX: Water, distant temple bell, birds]',
    backgroundScoreMood: '[Score: Warmer, a love motif that will sour]',
    lensAndFocalLength: '40mm T2.2',
    makeupAndHairStyle: '[Makeup: Younger, festival-clean, river light on skin]',
    shotDurationAndImages: 'Duration: 6s'
  }),
  shot({
    sceneShotId: 'SC03_SH02',
    shotComposition: 'Medium Close-Up (MCU)',
    cameraMotionTag: '[Camera: Static, then a tiny push on the watch]',
    timeAndLightingEnv: '[Weather: Clear] • [Timing: Sunset] • [Env: Under the tree]',
    directionalLightingAndHighlight: '[Angle: Warm edge] • [Shadow: Eye sockets soft] • [Highlight: Watch glass]',
    subjectLightingTag: '[Lighting: Face-to-face magic hour]',
    subjectColorTag: '[Subject Color: Skin, brass watch, mustard cloth]',
    backgroundLightingTag: '[BG Lighting: Bokeh river]',
    backgroundColorTag: '[BG Color: Gold bokeh]',
    characterIdAssetRef: '[CharID: @Lakshmi]; [CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: Lakshmi holds Ravi’s broken wristwatch]',
    actionEnvContext:
      'LAKSHMI: When this starts working again, I’ll come back. RAVI (laughs): What if I fix it tomorrow? LAKSHMI: Then I’ll have to come tomorrow.',
    characterExpression: 'Lakshmi serious then smiling; Ravi laughing, then matching her gravity',
    characterPsychologyState: '[Mindstate: A joke that is also a vow]',
    characterMannerismAndPosture: '[Mannerism: Watch in both their hands]',
    characterPlacement: 'Two-shot MCU under the tree',
    characterDialogue:
      '"When this starts working again, I’ll come back." / "What if I fix it tomorrow?" / "Then I’ll have to come tomorrow."',
    characterMovement: 'They smile at each other',
    characterEyeLooks: '[Eye Look: Lock, then the watch]',
    sceneSynopsis: 'The broken watch is the promise. If he fixes it tomorrow, she will come tomorrow.',
    charAssetIds: ['demo_lakshmi', 'demo_ravi'],
    worldAssetIds: ['demo_godavari'],
    lensAndFocalLength: '65mm T2.0'
  }),
  shot({
    sceneShotId: 'SC03_SH03',
    shotComposition: 'Medium Shot (MS)',
    cameraMotionTag: '[Camera: Rise with Lakshmi as she stands, hold on Ravi]',
    timeAndLightingEnv: '[Weather: Clear] • [Timing: Last light] • [Env: Riverbank]',
    directionalLightingAndHighlight: '[Angle: Sun almost gone] • [Shadow: Tree] • [Highlight: Rim on her hair]',
    subjectLightingTag: '[Lighting: Afterglow]',
    subjectColorTag: '[Subject Color: Deep gold, then cooler]',
    backgroundLightingTag: '[BG Lighting: River going copper]',
    backgroundColorTag: '[BG Color: Dusk blue coming]',
    characterIdAssetRef: '[CharID: @Lakshmi]; [CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: She stands; he stays seated]',
    actionEnvContext: 'A distant temple bell. Lakshmi gets up. LAKSHMI: Promise me you’ll wait. RAVI: I promise.',
    characterExpression: 'Tender, already a little afraid',
    characterPsychologyState: '[Mindstate: The last easy yes]',
    characterMannerismAndPosture: '[Mannerism: He nods. She does not look back long.]',
    characterPlacement: 'She rises through frame; he remains under the tree',
    characterDialogue: '"Promise me you’ll wait." / "I promise."',
    characterMovement: 'Lakshmi stands and steps toward the path',
    characterEyeLooks: '[Eye Look: Lakshmi down at Ravi; Ravi up at her]',
    sceneSynopsis: 'Temple bell. She asks him to wait. He promises. MATCH CUT.',
    charAssetIds: ['demo_lakshmi', 'demo_ravi'],
    worldAssetIds: ['demo_godavari'],
    soundFxAndFoley: '[SFX: Temple bell, river]',
    editTransitionCut: 'Match cut — watch',
    shotDurationAndImages: 'Duration: 5s'
  }),
  shot({
    sceneShotId: 'SC04_SH01',
    shotComposition: 'Extreme Close-Up (ECU)',
    cameraMotionTag: '[Camera: Static lock-off on the watch]',
    timeAndLightingEnv: '[Weather: Interior] • [Timing: Night] • [Env: Ravi’s house]',
    directionalLightingAndHighlight: '[Angle: Single oil-lamp / 40W bulb] • [Shadow: Hard on the table] • [Highlight: Cracked glass]',
    subjectLightingTag: '[Lighting: Practical night]',
    subjectColorTag: '[Subject Color: Dead brass, stopped hands]',
    backgroundLightingTag: '[BG Lighting: Table falloff]',
    backgroundColorTag: '[BG Color: Near black]',
    characterIdAssetRef: '[CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: Off]',
    actionEnvContext: 'MATCH CUT. The same broken wristwatch lies on the table. Ravi finishes reading the letter.',
    characterExpression: 'Hands still on the page (edge of frame)',
    characterPsychologyState: '[Mindstate: The promise was kept by the wrong person]',
    characterMannerismAndPosture: '[Mannerism: Watch not worn — it never worked]',
    characterPlacement: 'Watch center; letter edge in frame',
    characterDialogue: '',
    characterMovement: 'None',
    characterEyeLooks: '[Eye Look: Implied on the stopped hands]',
    sceneSynopsis: 'INT. RAVI’S HOUSE — NIGHT. The same broken watch. He finishes the letter.',
    charAssetIds: ['demo_ravi'],
    worldAssetIds: ['demo_house'],
    lensAndFocalLength: '100mm T2.0',
    soundFxAndFoley: '[SFX: Night insects, a clock elsewhere that does work]',
    backgroundScoreMood: '[Score: Drone under the match cut]',
    shotDurationAndImages: 'Duration: 3s',
    atmosphereVolumetricsTag: '[Atmosphere: None — dry night interior]'
  }),
  shot({
    sceneShotId: 'SC04_SH02',
    shotComposition: 'Close-Up (CU)',
    cameraMotionTag: '[Camera: Tilt from faces to the last line of the letter]',
    timeAndLightingEnv: '[Weather: Interior] • [Timing: Night] • [Env: House]',
    directionalLightingAndHighlight: '[Angle: Lamp] • [Shadow: Meena’s face half-lit] • [Highlight: Ink on paper]',
    subjectLightingTag: '[Lighting: Intimate practical]',
    subjectColorTag: '[Subject Color: Paper cream, blue-black ink]',
    backgroundLightingTag: '[BG Lighting: Room dark]',
    backgroundColorTag: '[BG Color: Umber]',
    characterIdAssetRef: '[CharID: @Ravi]; [CharID: @Meena]',
    coArtistInteraction: '[Co-Artist: Meena watches; he turns the letter]',
    actionEnvContext:
      'MEENA: What did she write? RAVI: She waited too. He shows the final line: “I came back three years ago. You were already gone.”',
    characterExpression: 'Ravi shocked. Meena does not yet understand, then does.',
    characterPsychologyState: '[Mindstate: He waited at the bus. She came home. He was already gone.]',
    characterMannerismAndPosture: '[Mannerism: Folds the letter, then turns it for her]',
    characterPlacement: 'MCU two-shot, then CU insert of the line',
    characterDialogue: '"What did she write?" / "She waited too." / "I came back three years ago. You were already gone."',
    characterMovement: 'Turns the page toward Meena, then toward the window',
    characterEyeLooks: '[Eye Look: Ravi on the last line, then the window]',
    sceneSynopsis: 'The last line: she came back three years ago. He was already gone.',
    charAssetIds: ['demo_ravi', 'demo_meena'],
    worldAssetIds: ['demo_house'],
    lensAndFocalLength: '50mm T2.0',
    shotDurationAndImages: 'Duration: 8s'
  }),
  shot({
    sceneShotId: 'SC04_SH03',
    shotComposition: 'Medium Shot (MS)',
    cameraMotionTag: '[Camera: Push to the window, then hold on the empty road]',
    timeAndLightingEnv: '[Weather: Clear night] • [Timing: Night] • [Env: Window to the village road]',
    directionalLightingAndHighlight: '[Angle: Interior lamp vs moon] • [Shadow: Ravi as silhouette] • [Highlight: Empty laterite]',
    subjectLightingTag: '[Lighting: Against the glass]',
    subjectColorTag: '[Subject Color: Cool moonlight on the road]',
    backgroundLightingTag: '[BG Lighting: One distant street lamp]',
    backgroundColorTag: '[BG Color: Blue-black village]',
    characterIdAssetRef: '[CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: Off]',
    actionEnvContext: 'Ravi looks toward the window. Outside, the village road is empty.',
    characterExpression: 'Shock settling into a decision',
    characterPsychologyState: '[Mindstate: Waiting is over]',
    characterMannerismAndPosture: '[Mannerism: One hand on the window frame]',
    characterPlacement: 'Silhouette at the window, road beyond',
    characterDialogue: '',
    characterMovement: 'Turns to the window and does not look back',
    characterEyeLooks: '[Eye Look: The empty road]',
    sceneSynopsis: 'He looks out. The road is empty. CUT TO morning.',
    charAssetIds: ['demo_ravi'],
    worldAssetIds: ['demo_house'],
    soundFxAndFoley: '[SFX: Night insects, a far dog]',
    editTransitionCut: 'Cut to',
    lensAndFocalLength: '35mm T2.8'
  }),
  shot({
    sceneShotId: 'SC05_SH01',
    shotComposition: 'Medium Shot (MS)',
    cameraMotionTag: '[Camera: Same angle as SC01_SH02 — the stall, the road]',
    timeAndLightingEnv: '[Weather: Clear] • [Timing: Next morning] • [Env: Village bus stop]',
    directionalLightingAndHighlight: '[Angle: Cleaner east light, less mist] • [Shadow: Shorter] • [Highlight: Photograph]',
    subjectLightingTag: '[Lighting: Open morning]',
    subjectColorTag: '[Subject Color: Same clothes, photograph instead of envelope]',
    backgroundLightingTag: '[BG Lighting: Road brighter]',
    backgroundColorTag: '[BG Color: Washed laterite]',
    characterIdAssetRef: '[CharID: @Ravi]; [CharID: @Subbaiah]',
    coArtistInteraction: '[Co-Artist: Subbaiah watching]',
    actionEnvContext:
      'The same bus stop. Same tea stall. Ravi holds the old photograph, not the envelope. SUBBAIAH: Waiting again? RAVI: No. I’m going to find her.',
    characterExpression: 'A real smile, small',
    characterPsychologyState: '[Mindstate: Motion instead of vigil]',
    characterMannerismAndPosture: '[Mannerism: Photograph in the same hand that held the envelope]',
    characterPlacement: 'Same mark as Scene 1; Subbaiah at the stall',
    characterDialogue: '"Waiting again?" / "No." / "I’m going to find her."',
    characterMovement: 'Looks at Subbaiah, then at the approaching bus',
    characterEyeLooks: '[Eye Look: Subbaiah, then the road, then the photo]',
    sceneSynopsis: 'EXT. VILLAGE BUS STOP — NEXT MORNING. Same place. He is not waiting.',
    charAssetIds: ['demo_ravi', 'demo_subbaiah'],
    worldAssetIds: ['demo_bus_stop'],
    soundFxAndFoley: '[SFX: Morning kettle, approaching diesel]',
    lensAndFocalLength: '50mm T2.0'
  }),
  shot({
    sceneShotId: 'SC05_SH02',
    shotComposition: 'Wide Shot (WS)',
    cameraMotionTag: '[Camera: Track with Ravi to the bus, then hold as it leaves]',
    timeAndLightingEnv: '[Weather: Clear] • [Timing: Morning] • [Env: Bus stop]',
    directionalLightingAndHighlight: '[Angle: Sun higher] • [Shadow: Short under the bus] • [Highlight: Red departing]',
    subjectLightingTag: '[Lighting: Open day]',
    subjectColorTag: '[Subject Color: Red bus, dust plume]',
    backgroundLightingTag: '[BG Lighting: Village shrinking]',
    backgroundColorTag: '[BG Color: Pale road, coconut line]',
    characterIdAssetRef: '[CharID: @Ravi]',
    coArtistInteraction: '[Co-Artist: Subbaiah watching him go]',
    actionEnvContext:
      'Ravi picks up the leather bag and walks toward the bus. He gets in. The bus slowly moves away. The photograph remains in his hand.',
    characterExpression: 'Forward',
    characterPsychologyState: '[Mindstate: The search begins]',
    characterMannerismAndPosture: '[Mannerism: Bag on the shoulder, photo not put away]',
    characterPlacement: 'Walks from stall to bus; last seen in the window',
    characterDialogue: '',
    characterMovement: 'Walks, boards, sits; bus pulls out',
    characterEyeLooks: '[Eye Look: Down the road he used to watch]',
    sceneSynopsis: 'He boards. The bus leaves. The photograph stays in his hand. FADE OUT.',
    charAssetIds: ['demo_ravi', 'demo_subbaiah'],
    worldAssetIds: ['demo_bus_stop'],
    soundFxAndFoley: '[SFX: Air brakes, gears, the road taking him]',
    backgroundScoreMood: '[Score: The love motif, unresolved, going with him]',
    editTransitionCut: 'Fade out',
    shotDurationAndImages: 'Duration: 8s',
    lensAndFocalLength: '32mm T4'
  })
];

export const DEMO_PROJECT_SCREENPLAY = `THE LAST LETTER

Genre: Emotional Drama
Setting: A small town in coastal Andhra Pradesh, 1986.

FADE IN:

SCENE 1

EXT. VILLAGE BUS STOP – EARLY MORNING

A quiet village wakes up. Mist hangs over the road. A few bicycles pass by.

RAVI, 24, stands beside a small tea stall holding a worn leather bag. He keeps looking down the road.

An old red government bus approaches.

Ravi checks the address written on a folded envelope.

The bus stops.

Ravi looks at the passengers getting down, but the person he is waiting for isn’t there.

The bus leaves.

The tea stall owner, SUBBAIAH, 55, looks at Ravi.

                    SUBBAIAH
          Still waiting?

Ravi smiles faintly.

                    RAVI
          She said she’d come today.

Subbaiah looks at the envelope in Ravi’s hand.

                    SUBBAIAH
          And if she doesn’t?

Ravi looks toward the empty road.

                    RAVI
          Then I’ll wait tomorrow.

CUT TO:

SCENE 2

INT. RAVI’S HOUSE – AFTERNOON

A modest old tiled house.

Sunlight enters through wooden windows.

Ravi sits at a small desk. The envelope is still in his hand.

He opens an old metal box.

Inside are photographs, a broken wristwatch and several letters tied together with a red thread.

Ravi takes out one photograph.

It shows RAVI and LAKSHMI, 22, standing beside a river.

His younger sister MEENA, 18, enters carrying a steel tumbler of water.

                    MEENA
          Anna… why are you still keeping these?

Ravi doesn’t answer.

Meena notices the envelope.

                    MEENA
          Is that from her?

Ravi slowly shakes his head.

                    RAVI
          No.

He opens the envelope.

There is a single handwritten letter inside.

Ravi begins reading.

His expression changes.

CUT TO:

SCENE 3

EXT. GODAVARI RIVERBANK – SUNSET – FLASHBACK

Ravi and Lakshmi sit beneath a large tree beside the river.

The golden evening light reflects on the water.

Lakshmi holds Ravi’s broken wristwatch.

                    LAKSHMI
          When this starts working again,
          I’ll come back.

Ravi laughs.

                    RAVI
          What if I fix it tomorrow?

Lakshmi looks at him seriously.

                    LAKSHMI
          Then I’ll have to come tomorrow.

They smile at each other.

A distant temple bell rings.

Lakshmi gets up.

                    LAKSHMI
          Promise me you’ll wait.

Ravi nods.

                    RAVI
          I promise.

MATCH CUT TO:

SCENE 4

INT. RAVI’S HOUSE – NIGHT

The same broken wristwatch lies on the table.

Ravi finishes reading the letter.

Meena watches him.

                    MEENA
          What did she write?

Ravi folds the letter carefully.

He looks at the old photograph.

                    RAVI
          She waited too.

Meena doesn’t understand.

Ravi turns the letter around and shows her the final line.

“I came back three years ago. You were already gone.”

Ravi looks shocked.

He turns toward the window.

Outside, the village road is empty.

CUT TO:

SCENE 5

EXT. VILLAGE BUS STOP – NEXT MORNING

The same bus stop.

The same tea stall.

Ravi stands beside the road.

But this time he is holding the old photograph instead of the envelope.

Subbaiah watches him.

                    SUBBAIAH
          Waiting again?

Ravi smiles.

                    RAVI
          No.

He looks toward the road.

                    RAVI
          I’m going to find her.

Ravi picks up his leather bag and walks toward the approaching bus.

The bus arrives.

Ravi gets in.

The bus slowly moves away.

The photograph remains in his hand.

FADE OUT.

THE END
`;

export const DEMO_PROJECT_SYNOPSIS = `Coastal Andhra, 1986. At a misted village bus stop, Ravi waits beside Subbaiah’s tea stall with a worn leather bag and a folded envelope. The old red government bus arrives. Lakshmi is not on it. Subbaiah asks if he will keep waiting. Ravi says she promised today — and if she does not come, he will wait tomorrow.

Afternoon at the tiled house: Ravi opens a metal box of photographs, a broken wristwatch, and letters tied with red thread. His sister Meena asks why he still keeps them. The envelope is not a new arrival. It holds the last letter. A Godavari sunset flashback: Lakshmi holds the broken watch and vows she will come back when it works. That night Ravi reads the final line — she came back three years ago, and he was already gone. Next morning at the same bus stop he no longer waits. He takes the river photograph, boards the bus, and goes to find her.`;

export const DEMO_PROJECT_CHARACTERS = [
  {
    id: 'demo_ravi',
    name: 'Ravi',
    tag: '@Ravi',
    role: 'Lead',
    age: '24',
    backstory: 'A young man in a 1986 coastal Andhra town. He waits at the bus stop for Lakshmi, letter in hand.',
    motivation: 'Keep a promise to wait — until the letter tells him she already came back.',
    conflict: 'He waited on the road. She came home. He was already gone.',
    appearance: 'Worn cotton shirt, leather bag, envelope then a river photograph',
    castingStatus: 'PROPOSED',
    includeInPrompt: true
  },
  {
    id: 'demo_lakshmi',
    name: 'Lakshmi',
    tag: '@Lakshmi',
    role: 'Lead (flashback / letter)',
    age: '22',
    backstory: 'The woman who left with a vow tied to a broken wristwatch. She returned three years ago.',
    motivation: 'Come back when the watch works — then come back anyway.',
    conflict: 'The house was empty when she arrived.',
    appearance: 'Mustard sari in the Godavari sunset; present only in photograph and letter',
    castingStatus: 'PROPOSED',
    includeInPrompt: true
  },
  {
    id: 'demo_subbaiah',
    name: 'Subbaiah',
    tag: '@Subbaiah',
    role: 'Supporting',
    age: '55',
    backstory: 'Tea stall owner at the village bus stop. He has watched Ravi wait many mornings.',
    motivation: 'Ask the question Ravi will not ask himself.',
    conflict: 'Kindness without a solution.',
    appearance: 'Grey shirt, steel tumbler, stall lamp',
    castingStatus: 'PROPOSED',
    includeInPrompt: true
  },
  {
    id: 'demo_meena',
    name: 'Meena',
    tag: '@Meena',
    role: 'Supporting',
    age: '18',
    backstory: 'Ravi’s younger sister. She brings water and watches him keep a box of the past.',
    motivation: 'Understand why he will not put the letters down.',
    conflict: 'Loves her brother; cannot read the letter for him.',
    appearance: 'Cotton sari, steel tumbler, doorway light',
    castingStatus: 'PROPOSED',
    includeInPrompt: true
  }
];

export const DEMO_PROJECT_WORLD = [
  {
    id: 'demo_bus_stop',
    type: 'location',
    name: 'Village bus stop',
    title: 'Village bus stop',
    tag: '@World_Bus_Stop',
    location: 'Coastal Andhra village road, tea stall, APSRTC stop, 1986',
    description: 'Misty morning laterite road. Whitewashed stall. Old red government bus. The place Ravi waits — and the place he leaves.',
    includeInPrompt: true
  },
  {
    id: 'demo_house',
    type: 'location',
    name: 'Ravi’s tiled house',
    title: 'Ravi’s tiled house',
    tag: '@World_Ravi_House',
    location: 'Modest old tiled house, wooden windows, small desk',
    description: 'Afternoon lattice sun and night lamp. Metal box of letters. The broken watch on the table.',
    includeInPrompt: true
  },
  {
    id: 'demo_godavari',
    type: 'location',
    name: 'Godavari riverbank',
    title: 'Godavari riverbank',
    tag: '@World_Godavari',
    location: 'Sunset bank under a large tree, coastal Andhra',
    description: 'Flashback. Golden water. Temple bell. The vow that the watch would call her home.',
    includeInPrompt: true
  }
];

export function resolveCurrentDemoProject(project) {
  if (!isDemoProjectTitle(project?.title)) return project;
  const built = buildDemoStudioProject();
  const titleOk = String(project?.title || '').trim().toUpperCase() === DEMO_PROJECT_TITLE;
  const shotsOk = demoShotsLookFilled(project?.shots);
  if (titleOk && project?.demoRevision === DEMO_PROJECT_REVISION && shotsOk) {
    return {
      ...project,
      title: DEMO_PROJECT_TITLE,
      posterUrl: demoPosterUrl(project?.posterUrl),
      extractedMasterStory: demoSynopsisLooksFilled(project?.extractedMasterStory)
        ? project.extractedMasterStory
        : built.extractedMasterStory
    };
  }
  return {
    ...built,
    id: project?.id || DEMO_PROJECT_ID,
    packOrigin: project?.packOrigin,
    posterUrl: demoPosterUrl(project?.posterUrl),
    shots: shotsOk ? project.shots.map((s) => ({ ...s })) : built.shots,
    extractedMasterStory: demoSynopsisLooksFilled(project?.extractedMasterStory)
      ? project.extractedMasterStory
      : built.extractedMasterStory
  };
}

export function buildDemoStudioProject({ name = '' } = {}) {
  const who = String(name || '').trim();
  return {
    id: DEMO_PROJECT_ID,
    title: DEMO_PROJECT_TITLE,
    description: who
      ? `${who} — The Last Letter. Walk Writer, Matrix, Form, Cast, World.`
      : 'The Last Letter — emotional drama, coastal Andhra 1986. Walk Writer, Matrix, Form, Cast, World.',
    targetModel: 'SPS Direct Cinema 2.0',
    aspectRatio: '2.39:1 Anamorphic',
    roomId: DEMO_PROJECT_ROOM,
    lastModified: new Date().toLocaleDateString(),
    lastModifiedIso: new Date().toISOString(),
    genreKey: DEMO_PROJECT_GENRE,
    genreLabel: 'Rural 1980s Konaseema Anthology',
    scriptGenre: 'Emotional Drama',
    shots: DEMO_PROJECT_SHOTS.map((s) => ({ ...s })),
    screenplayText: DEMO_PROJECT_SCREENPLAY,
    extractedMasterStory: DEMO_PROJECT_SYNOPSIS,
    characterProfiles: DEMO_PROJECT_CHARACTERS.map((c) => ({ ...c })),
    worldAssets: DEMO_PROJECT_WORLD.map((a) => ({ ...a })),
    posterUrl: DEMO_PROJECT_POSTER_URL,
    isDemoProject: true,
    demoRevision: DEMO_PROJECT_REVISION
  };
}
