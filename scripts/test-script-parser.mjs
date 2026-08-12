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
  parseRawScriptToShots,
  getLastParseMeta,
  safeParseJsonArray,
  safeParseJsonObject,
  validateAndSanitizeShots,
  normalizeShotTo26Crafts,
  autoEnhanceCraftValue
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
  const shots = await parseRawScriptToShots(SAMPLE);
  const meta = getLastParseMeta();
  assert(shots.length >= 2, `expected >=2 shots, got ${shots.length}`);
  assert(meta.usedFallback === true, 'should use fallback without key');
  assert(meta.error === 'MISSING_API_KEY', 'missing key meta');
  assert(shots.every(s => s.sceneShotId && s.shotComposition), 'shots have core crafts');
  const ids = new Set(shots.map(s => s.sceneShotId));
  assert(ids.size === shots.length, 'unique sceneShotIds');
  console.log(`OK: ${shots.length} shots via ${meta.source}`);

  console.log('\nALL PARSER DRY-RUN CHECKS PASSED');
} finally {
  try { fs.unlinkSync(bundle); } catch (_) {}
}
