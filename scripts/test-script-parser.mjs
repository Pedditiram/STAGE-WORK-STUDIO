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
  classifyLlmFailureCode
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

  console.log('\nALL PARSER DRY-RUN CHECKS PASSED');
} finally {
  try { fs.unlinkSync(bundle); } catch (_) {}
}
