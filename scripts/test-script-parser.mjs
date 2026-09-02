/**
 * Dry-run: script parse + auto-enhance (offline heuristic path).
 * Run: node scripts/test-script-parser.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const bundle = path.join(__dirname, '_aiScriptParser.bundle.mjs');
const esbuild = path.join(root, 'node_modules/.bin/esbuild');

const build = spawnSync(esbuild, [
  'src/services/aiScriptParser.js',
  '--bundle',
  '--platform=browser',
  '--format=esm',
  `--outfile=${bundle}`,
  '--external:pdfjs-dist',
  '--external:pdfjs-dist/build/pdf.worker.mjs?url'
], { cwd: root, encoding: 'utf8' });
if (build.status !== 0) {
  console.error(build.stderr || build.stdout);
  process.exit(1);
}

globalThis.window = globalThis;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const {
  prepareScriptTextForParse,
  parseRawScriptToShots,
  getLastParseMeta,
  safeParseJsonArray,
  safeParseJsonObject,
  validateAndSanitizeShots,
  normalizeShotTo26Crafts,
  autoEnhanceCraftValue,
  looksLikeScreenplayForParse,
  isPremiseBrief,
  splitScreenplayForLlmParse,
  closeUnterminatedJsonStrings,
  isParseAbortError,
  ensureShotDurationCraft,
  synthesizeFullAppElementsFromScript,
  classifyLlmFailureCode,
  heuristicShotBudget,
  enhanceCraftSlotWithLLM,
  generateScriptFromConcept,
  isFountainCharacterCue,
  scrubScreenplayChrome,
  isPdfBinaryGarbage,
  looksLikeUsableScriptText,
  extractTextFromPDF
} = await import(pathToFileURLSafe(bundle));

function pathToFileURLSafe(p) {
  return 'file://' + p;
}

const SAMPLE = `EXT. PANCHAVATI FOREST - DAY

RAMA stands beneath a banyan tree, bow drawn.

RAMA
The forest will not fall today.

SITA watches from the hermitage steps.

[SHOT S01-A] Wide establishing, slow crane rise.
Demonic dust rises on the horizon.

INT. HERMITAGE - NIGHT

LAKSHMANA
Brother, the watch fires are lit.
`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

try {
  console.log('--- safeParseJsonArray ---');
  assert(Array.isArray(safeParseJsonArray('[{"a":1}]')) && safeParseJsonArray('[{"a":1}]').length === 1, 'simple array');
  assert(Array.isArray(safeParseJsonArray('```json\n[{"a":1}]\n```')), 'fenced array');
  assert(Array.isArray(safeParseJsonArray('[{"a":1},{"b":2')), 'truncated array repair');
  assert(safeParseJsonArray('{"shots":[{"a":1}]}')?.length === 1, 'wrapped shots object');
  assert(safeParseJsonArray('{"data":{"shots":[{"a":1}]}}')?.[0]?.a === 1, 'nested data.shots');
  assert(safeParseJsonArray('{"result":[{"a":1}]}')?.[0]?.a === 1, 'result array wrapper');
  assert(
    Array.isArray(safeParseJsonArray('[{"sceneShotId":"SC01_SH01","sceneSynopsis":"cut off')) &&
      safeParseJsonArray('[{"sceneShotId":"SC01_SH01","sceneSynopsis":"cut off')[0].sceneShotId === 'SC01_SH01',
    'unterminated string repair'
  );
  assert(closeUnterminatedJsonStrings('{"a":"hi').endsWith('"'), 'close string helper');
  assert(safeParseJsonArray('not json') === null, 'invalid returns null');
  assert(safeParseJsonObject('{"x":1}')?.x === 1, 'object parse');
  console.log('OK');

  console.log('--- validateAndSanitizeShots / enhance ---');
  const raw = [
    { sceneShotId: 'SC01_SH01', shotComposition: 'Wide Shot', actionEnvContext: 'Forest dawn' },
    { sceneShotId: 'SC01_SH01', shotComposition: 'CU', actionEnvContext: 'Duplicate id' },
    null,
    'bad'
  ];
  const sanitized = validateAndSanitizeShots(raw, SAMPLE);
  assert(sanitized.length === 2, `expected 2 sanitized got ${sanitized.length}`);
  assert(sanitized[0].sceneShotId !== sanitized[1].sceneShotId, 'duplicate IDs remapped');
  assert(autoEnhanceCraftValue('shotComposition', 'MS').includes('—'), 'craft enhance');
  const norm = normalizeShotTo26Crafts({}, 0, 'beat');
  assert(norm.sceneShotId && norm.characterDialogue && norm.lensAndFocalLength, '26 craft defaults');
  console.log('OK', sanitized.map(s => s.sceneShotId).join(', '));

  console.log('--- empty / short script ---');
  let empty = await parseRawScriptToShots('');
  assert(empty.length === 0 && getLastParseMeta().error === 'EMPTY_SCRIPT', 'empty');
  empty = await parseRawScriptToShots('hi');
  assert(empty.length === 0 && getLastParseMeta().error === 'SCRIPT_TOO_SHORT', 'too short');
  console.log('OK');

  console.log('--- offline fallback parse (no API key) ---');
  store.delete('sps_api_key');
  assert(!isPremiseBrief(SAMPLE), 'finished screenplay is not a director brief');
  const shots = await parseRawScriptToShots(SAMPLE);
  const meta = getLastParseMeta();
  assert(shots.length >= 2, `expected >=2 shots, got ${shots.length}`);
  assert(meta.usedFallback === true, 'should use fallback without key');
  assert(meta.error === 'MISSING_API_KEY', 'missing key meta');
  assert(shots.every(s => s.sceneShotId && s.shotComposition), 'shots have core crafts');
  const ids = new Set(shots.map(s => s.sceneShotId));
  assert(ids.size === shots.length, 'unique sceneShotIds');
  assert(
    shots.some((s) => /RAMA|SITA|banyan|hermitage|forest/i.test(JSON.stringify(s))),
    'screenplay names/locations survive parse'
  );
  const fountain = `The boys—Swami, Mani, and Rajam—escape the oppressive indoor heat and hike out to the local ruined fort.

MANI
(Panting, wiping sweat)
My feet are killing me!

RAJAM
We could have had a picnic in your backyard if you had told me before, wrestler!

SWAMI
The fort is just beyond the next hill.`;
  assert(!isPremiseBrief(fountain), 'Fountain scene is not a feature brief');
  const fountainShots = await parseRawScriptToShots(fountain);
  assert(fountainShots.length >= 3, `expected fountain beats, got ${fountainShots.length}`);
  assert(
    fountainShots.some((s) => /MANI|RAJAM|SWAMI|feet are killing/i.test(JSON.stringify(s))),
    'Fountain speakers land in crafts'
  );
  console.log(`OK: ${shots.length} shots via ${meta.source}; fountain ${fountainShots.length}`);

  console.log('--- FDX / BOM / INT without period ---');
  const bomScript = `\uFEFFINT FOREST - DAY\n\nRAMA draws the bow.\n`;
  assert(looksLikeScreenplayForParse(prepareScriptTextForParse(bomScript)), 'INT without period is a screenplay');
  const fdx = `<?xml version="1.0"?><FinalDraft DocumentType="Script"><Content><Paragraph Type="Scene Heading"><Text>INT. HERMITAGE - NIGHT</Text></Paragraph><Paragraph Type="Action"><Text>Lakshmana lights the watch fire.</Text></Paragraph><Paragraph Type="Character"><Text>LAKSHMANA</Text></Paragraph><Paragraph Type="Dialogue"><Text>Brother, the fires are lit.</Text></Paragraph></Content></FinalDraft>`;
  const preparedFdx = prepareScriptTextForParse(fdx);
  assert(/HERMITAGE/i.test(preparedFdx) && /LAKSHMANA/i.test(preparedFdx), 'FDX extracts scene + speaker');
  const fdxShots = await parseRawScriptToShots(fdx);
  assert(fdxShots.length >= 1, `FDX parse expected shots, got ${fdxShots.length}`);
  assert(fdxShots.some((s) => /Lakshmana|fires are lit|HERMITAGE/i.test(JSON.stringify(s))), 'FDX dialogue lands in crafts');
  console.log(`OK: FDX ${fdxShots.length} shot(s)`);

  console.log('--- chunk + abort ---');
  const long = ['EXT. ONE - DAY\nAction one.\n', 'EXT. TWO - DAY\nAction two.\n', 'EXT. THREE - NIGHT\nAction three.\n']
    .map((s) => s.repeat(40))
    .join('\n');
  const parts = splitScreenplayForLlmParse(long, 200);
  assert(parts.length >= 2, `expected chunks, got ${parts.length}`);
  assert(parts.every((p) => p.length <= 200), 'chunk size cap');
  const ac = new AbortController();
  ac.abort();
  let aborted = false;
  try {
    await parseRawScriptToShots(SAMPLE, { signal: ac.signal });
  } catch (e) {
    aborted = isParseAbortError(e);
  }
  assert(aborted, 'pre-aborted signal stops parse');
  console.log(`OK: ${parts.length} chunks; abort honored`);

  console.log('--- duration + Telugu + synth abort ---');
  const dur = ensureShotDurationCraft('');
  assert(/Duration:\s*6s/i.test(dur), 'empty duration defaults to 6s');
  assert(/Duration:\s*6s/i.test(normalizeShotTo26Crafts({}, 0, 'beat').shotDurationAndImages), 'normalized shot has duration');
  const te = 'సీన్ 1\nరాము డు జయి ంచుట\n';
  const tePrep = prepareScriptTextForParse(te);
  assert(looksLikeScreenplayForParse(tePrep) || looksLikeScreenplayForParse(te), 'Telugu scene heading is screenplay');
  assert(!/జయి ంచుట/.test(tePrep) || /జయించుట/.test(tePrep) || tePrep.includes('రాము'), 'Telugu PDF spacing repaired or preserved');
  const ac2 = new AbortController();
  ac2.abort();
  let synthAborted = false;
  try {
    await synthesizeFullAppElementsFromScript(SAMPLE, 'TEST', [], { signal: ac2.signal });
  } catch (e) {
    synthAborted = isParseAbortError(e);
  }
  assert(synthAborted, 'synthesis honors abort before LLM');
  assert(classifyLlmFailureCode('LLM request timed out after 55s') === 'LLM_TIMEOUT', 'timeout classifies');
  assert(classifyLlmFailureCode({ message: 'bad json' }) === 'LLM_FAILED', 'generic llm fail classifies');
  assert(sanitized.every((s) => s.specVersion === 1 && s.sceneShotId), 'sanitized shots keep Shot Spec meta');
  const miniFountain = `RAMA\nGo.\n\nSITA\nStay.`;
  assert(!isPremiseBrief(miniFountain), 'two Fountain cues are not a feature brief');
  console.log('OK');

  console.log('--- missing keys / flood / no invented steadicam ---');
  const missing = validateAndSanitizeShots([{ sceneSynopsis: 'only synopsis' }], SAMPLE);
  assert(missing.length === 1 && missing[0].sceneShotId && /Duration:\s*6s/i.test(missing[0].shotDurationAndImages), 'missing keys filled');
  assert(/Needs Direction: no spoken line/i.test(missing[0].characterDialogue), 'missing dialogue is Needs Direction');
  const budget = heuristicShotBudget(SAMPLE);
  assert(budget >= 8 && budget <= 400, `sample budget ${budget}`);
  const dump = Array.from({ length: 120 }, (_, i) => `Paragraph ${i} lorem ipsum dolor sit amet consectetur.\n\n`).join('');
  assert(heuristicShotBudget(dump) <= 80, 'prose dump budget <= 80');
  const dumpShots = await parseRawScriptToShots(dump);
  assert(dumpShots.length <= heuristicShotBudget(dump), `dump shots ${dumpShots.length} exceed budget`);
  const actionOnly = `EXT. ROAD - DAY\n\nDust hangs over the empty road.\n`;
  const actionShots = await parseRawScriptToShots(actionOnly);
  assert(actionShots.length >= 1, 'action-only produces a shot');
  const actionBlob = JSON.stringify(actionShots);
  assert(!/Steadicam/i.test(actionBlob), 'do not invent Steadicam on action-only');
  assert(/Needs Direction: no spoken line/i.test(actionBlob), 'action-only dialogue is Needs Direction');
  const wideWord = await parseRawScriptToShots('EXT. FIELD - DAY\n\nThe wide riverbank is quiet.\n');
  assert(!/Wide Shot/i.test(JSON.stringify(wideWord)), 'the word wide in action is not a WS');
  const actionWord = await parseRawScriptToShots('EXT. YARD - DAY\n\nThe action of waiting continues.\n');
  assert(!/Handheld/i.test(JSON.stringify(actionWord)), 'the word action is not a handheld move');
  const ieSlug = `I/E COTTAGE - DAY\n\nRain on the porch.\n`;
  assert(looksLikeScreenplayForParse(ieSlug), 'I/E is a screenplay slug');
  const ieShots = await parseRawScriptToShots(ieSlug);
  assert(ieShots.length >= 1 && ieShots.some((s) => /Rain|COTTAGE|porch/i.test(JSON.stringify(s))), 'I/E slug parses');
  const contd = `RAMA (CONT'D)\nHold.\n`;
  const contdShots = await parseRawScriptToShots(contd);
  assert(contdShots.some((s) => /RAMA|Hold/i.test(JSON.stringify(s))), 'CONT D cue still maps');
  const acConcept = new AbortController();
  acConcept.abort();
  let conceptAborted = false;
  try {
    await generateScriptFromConcept('a forest oath', 3, { signal: acConcept.signal });
  } catch (e) {
    conceptAborted = isParseAbortError(e);
  }
  assert(conceptAborted, 'concept generate honors abort');
  assert(!isFountainCharacterCue('MORE'), 'MORE is not a speaker');
  assert(isFountainCharacterCue("RAMA ^"), 'dual-dialogue caret is still a cue');
  const numbered = `12 INT. HOUSE - DAY\n\nDust on the floor.\n\n14 EXT. ROAD - NIGHT\n\nThe empty road waits.\n`;
  assert(looksLikeScreenplayForParse(numbered), 'numbered INT slug is screenplay');
  const numberedShots = await parseRawScriptToShots(numbered);
  assert(numberedShots.some((s) => /^SC12_/.test(s.sceneShotId)), 'production slug 12 maps to SC12');
  assert(numberedShots.some((s) => /^SC14_/.test(s.sceneShotId)), 'production slug 14 maps to SC14');
  const withCut = `INT. ROOM - DAY\n\nRAMA waits.\n\nCUT TO:\n\nEXT. YARD - DAY\n\nSITA waits.\n`;
  const cutShots = await parseRawScriptToShots(withCut);
  assert(!cutShots.some((s) => /^CUT TO/i.test(String(s.actionEnvContext || ''))), 'CUT TO is not a Matrix shot');
  assert(cutShots.some((s) => /^SC02_/.test(s.sceneShotId)), 'slug after CUT TO is still a new scene');
  const incompleteSlug = `INT.\n\nSomeone waits in the dark.\n`;
  const incompleteShots = await parseRawScriptToShots(incompleteSlug);
  assert(incompleteShots.length >= 1, 'incomplete INT. still yields a shot');
  assert(incompleteShots.every((s) => s.sceneShotId && s.shotDurationAndImages), 'incomplete slug still has id+duration');
  const chrome = `EXT. ROAD - DAY\n\n/* producer note: skip this */\n[[draft note]]\n2.\nThe her-\nmitage door hangs open.\n\n(MORE)\n`;
  const scrubbed = scrubScreenplayChrome(prepareScriptTextForParse(chrome));
  assert(!/producer note/i.test(scrubbed), 'boneyard stripped');
  assert(!/draft note/i.test(scrubbed), 'fountain notes stripped');
  assert(/hermitage/i.test(scrubbed), 'PDF hyphen wrap rejoined');
  const chromeShots = await parseRawScriptToShots(chrome);
  assert(!chromeShots.some((s) => /producer note|draft note|\(MORE\)/i.test(JSON.stringify(s))), 'chrome is not a Matrix shot');
  assert(chromeShots.some((s) => /hermitage/i.test(JSON.stringify(s))), 'hyphen-rejoined action survives');
  const twoInt = `INT FOREST - DAY\nRAMA waits.\n\nINT HERMITAGE - NIGHT\nSITA waits.\n`;
  const twoShots = await parseRawScriptToShots(twoInt);
  assert(twoShots.some((s) => /^SC01_/.test(s.sceneShotId)), 'first INT slug stays SC01');
  assert(twoShots.some((s) => /^SC02_/.test(s.sceneShotId)), 'second INT without period bumps scene');
  const ac3 = new AbortController();
  ac3.abort();
  let craftAborted = false;
  try {
    await enhanceCraftSlotWithLLM('shotComposition', 'MS', { signal: ac3.signal });
  } catch (e) {
    craftAborted = isParseAbortError(e);
  }
  assert(craftAborted, 'craft enhance honors abort');
  const titled = `TITLE: THE FOREST WAR\n\nWritten by Test Writer\n\nEXT. ROAD - DAY\n\nDust hangs over the empty road.\n`;
  const titledShots = await parseRawScriptToShots(titled);
  assert(
    titledShots.every((s) => !/^TITLE:/i.test(String(s.actionEnvContext || '').slice(0, 20))),
    'title page is not a Matrix shot'
  );
  assert(titledShots.some((s) => /Dust|ROAD/i.test(JSON.stringify(s))), 'action after title page still parses');
  const emptyNorm = normalizeShotTo26Crafts({}, 0, 'beat');
  assert(/Needs Direction: hold/i.test(emptyNorm.cameraMotionTag), 'missing camera is hold not a invented push-in');
  assert(/Needs Direction: hold/i.test(emptyNorm.characterMovement), 'missing movement is hold');
  assert(/Needs Direction/i.test(emptyNorm.lensAndFocalLength), 'missing lens is Needs Direction');
  assert(!/Konaseema|Golden Hour Sunset/i.test(JSON.stringify(emptyNorm)), 'do not invent a lighting bible on empty crafts');
  const nightShots = await parseRawScriptToShots('INT CAVE - NIGHT\n\nThe chamber is dark.\n');
  assert(nightShots.some((s) => /Moonlight|Needs Direction: lighting/i.test(s.subjectLightingTag || '')), 'night slug infers light or stays Needs Direction');
  const pdfAbort = new AbortController();
  pdfAbort.abort();
  let pdfAborted = false;
  try {
    await extractTextFromPDF(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { signal: pdfAbort.signal });
  } catch (e) {
    pdfAborted = isParseAbortError(e);
  }
  assert(pdfAborted, 'PDF extract honors abort before work');
  console.log('OK');

  console.log('--- PDF garbage / bilingual / isolation / mocked LLM ---');
  assert(isPdfBinaryGarbage('%PDF-1.4\ntrailer\nstartxref\n'), 'raw PDF bytes are garbage');
  assert(!looksLikeUsableScriptText('%PDF-1.4\ntrailer\nstartxref\nendobj'), 'PDF garbage is not usable script');
  const bilingual = `సీన్ 1 EXT. FOREST - DAY\n\nరాము stands under the tree.\n\nRAMA\nWe hold the line.\n`;
  assert(looksLikeScreenplayForParse(prepareScriptTextForParse(bilingual)), 'Telugu+English slug is screenplay');
  const biShots = await parseRawScriptToShots(bilingual);
  assert(
    biShots.some((s) => /RAMA|రాము|FOREST|We hold the line/i.test(JSON.stringify(s))),
    'bilingual names/dialogue survive'
  );
  store.set('sps_library_shots_sentinel', 'KEEP');
  await parseRawScriptToShots(SAMPLE);
  assert(store.get('sps_library_shots_sentinel') === 'KEEP', 'parse must not write Matrix library keys');
  const brokenFdx = `<?xml version="1.0"?><FinalDraft DocumentType="Script"><Content><Paragraph Type="Action"><Text>Unclosed`;
  assert(/Unclosed/i.test(prepareScriptTextForParse(brokenFdx)), 'broken FDX still yields text');

  const origFetch = globalThis.fetch;
  const geminiBody = (text) => {
    const payload = { candidates: [{ content: { parts: [{ text }] } }] };
    const wrap = () => ({
      ok: true,
      status: 200,
      json: async () => payload
    });
    const res = wrap();
    res.clone = wrap;
    return res;
  };
  store.set('sps_api_key', 'test-not-a-real-key');
  store.set('sps_llm_provider', 'google_gemini');
  globalThis.fetch = async () => geminiBody(
    '[{"sceneShotId":"SC01_SH01","sceneSynopsis":"Mock LLM beat","characterDialogue":"MOCK_LLM_LINE_991"}'
  );
  const llmShots = await parseRawScriptToShots(SAMPLE);
  const llmMeta = getLastParseMeta();
  assert(llmShots.some((s) => /MOCK_LLM_LINE_991/.test(s.characterDialogue)), 'truncated LLM JSON repaired into crafts');
  assert(llmMeta.usedFallback === false, 'successful mock LLM is not fallback');
  assert(llmShots[0].sceneShotId && /Duration:\s*6s/i.test(llmShots[0].shotDurationAndImages), 'LLM shots get ids+duration');

  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({}),
    text: async () => 'bad key',
    clone() { return this; }
  });
  const failShots = await parseRawScriptToShots(SAMPLE);
  const failMeta = getLastParseMeta();
  assert(failShots.length >= 2, 'HTTP 400 still yields heuristic shots');
  assert(failMeta.usedFallback === true, 'HTTP 400 uses fallback');
  assert(failMeta.error && failMeta.error !== 'PARSE_ABORTED', 'HTTP 400 is not abort');
  store.delete('sps_api_key');
  store.delete('sps_llm_provider');
  globalThis.fetch = origFetch;
  console.log('OK');

  console.log('\nALL PARSER DRY-RUN CHECKS PASSED');
} finally {
  try { fs.unlinkSync(bundle); } catch (_) {}
}
