/**
 * Dry-run: PDF text extraction helpers + pdf.js on a minimal text PDF.
 * Run: node scripts/test-pdf-extract.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const bundle = path.join(__dirname, '_aiScriptParser.bundle.mjs');
const esbuild = path.join(root, 'node_modules/.bin/esbuild');
const fixturesDir = path.join(__dirname, 'fixtures');
const miniPdfPath = path.join(fixturesDir, 'mini-screenplay.pdf');
const titlePdfPath = path.join(fixturesDir, 'mini-title-bible.pdf');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeMinimalPdf(text) {
  const stream = `BT /F1 12 Tf 50 700 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const contentLen = Buffer.byteLength(stream, 'utf8');
  const parts = [];
  const offsets = [0];
  const addObj = (n, body) => {
    offsets[n] = Buffer.byteLength(parts.join(''), 'utf8');
    parts.push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  parts.push('%PDF-1.4\n');
  addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObj(
    3,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'
  );
  addObj(4, `<< /Length ${contentLen} >>\nstream\n${stream}\nendstream`);
  addObj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const xrefPos = Buffer.byteLength(parts.join(''), 'utf8');
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  parts.push(xref);
  parts.push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);
  return Buffer.from(parts.join(''), 'utf8');
}

const sync = spawnSync(process.execPath, [path.join(__dirname, 'sync-pdfjs-assets.mjs')], {
  cwd: root,
  encoding: 'utf8'
});
if (sync.status !== 0) {
  console.error(sync.stderr || sync.stdout);
  process.exit(1);
}

const build = spawnSync(
  esbuild,
  [
    'src/services/aiScriptParser.js',
    '--bundle',
    '--platform=browser',
    '--format=esm',
    `--outfile=${bundle}`,
    '--external:pdfjs-dist'
  ],
  { cwd: root, encoding: 'utf8' }
);
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
globalThis.importMetaEnv = { BASE_URL: '/' };

const {
  isPdfBinaryGarbage,
  looksLikeUsableScriptText,
  isPdfMetadataNoise,
  lightSanitizePdfExtractedText,
  extractPagesTextFromPdfObj,
  parseRawScriptToShots,
  getLastParseMeta
} = await import(pathToFileURL(bundle).href);

try {
  console.log('--- garbage detectors ---');
  assert(isPdfBinaryGarbage('%PDF-1.4\n1 0 obj\nendobj\ntrailer\nstartxref'), 'raw pdf header');
  assert(isPdfBinaryGarbage('endobj stream endstream xref /Type /Page'), 'structure markers');
  assert(!looksLikeUsableScriptText('%PDF-1.4 binary'), 'binary not usable');
  assert(looksLikeUsableScriptText('EXT. FOREST - DAY\n\nRAMA draws his bow.'), 'screenplay usable');
  assert(
    looksLikeUsableScriptText('Kara-Dhushan War\nProduction Bible'),
    'title/bible page must be usable without INT/EXT'
  );
  assert(isPdfMetadataNoise('WinAnsiEncoding\nBaseFont\nHelvetica'), 'metadata noise');
  assert(
    lightSanitizePdfExtractedText('Kara-Dhushan War') === 'Kara-Dhushan War',
    'light sanitize keeps title'
  );
  console.log('OK');

  console.log('--- bundled public pdf.js assets ---');
  const publicWorker = path.join(root, 'public/pdf.worker.min.mjs');
  const publicCmaps = path.join(root, 'public/cmaps');
  const publicFonts = path.join(root, 'public/standard_fonts');
  assert(fs.existsSync(publicWorker), 'public/pdf.worker.min.mjs missing');
  assert(fs.existsSync(publicCmaps), 'public/cmaps missing');
  assert(fs.readdirSync(publicCmaps).length > 50, 'public/cmaps looks empty');
  assert(fs.existsSync(publicFonts), 'public/standard_fonts missing');
  assert(fs.readdirSync(publicFonts).length > 5, 'public/standard_fonts looks empty');
  console.log('OK');

  console.log('--- pdf.js extract minimal PDF (legacy + local cMaps) ---');
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
  const scriptLine = 'EXT. FOREST - DAY Rama draws his bow near Sita.';
  const titleLine = 'Kara-Dhushan War Production Bible';
  const pdfBuf = makeMinimalPdf(scriptLine);
  const titleBuf = makeMinimalPdf(titleLine);
  fs.writeFileSync(miniPdfPath, pdfBuf);
  fs.writeFileSync(titlePdfPath, titleBuf);

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href;

  const localCmapUrl = pathToFileURL(path.join(root, 'public/cmaps')).href + '/';
  const localFontUrl = pathToFileURL(path.join(root, 'public/standard_fonts')).href + '/';

  async function extractViaHelpers(buf) {
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
      cMapUrl: localCmapUrl,
      cMapPacked: true,
      standardFontDataUrl: localFontUrl
    }).promise;
    return extractPagesTextFromPdfObj(doc);
  }

  const screenplayResult = await extractViaHelpers(pdfBuf);
  assert(screenplayResult.pageCount === 1, 'one page');
  assert(screenplayResult.totalTextItems > 0, 'text items present');
  assert(screenplayResult.rawCharCount > 0, 'raw chars present');
  assert(screenplayResult.text.includes('EXT. FOREST'), `expected scene text, got: ${screenplayResult.text}`);
  assert(looksLikeUsableScriptText(screenplayResult.text), 'extracted usable');
  assert(!isPdfBinaryGarbage(screenplayResult.text), 'extracted not garbage');
  console.log('OK screenplay:', screenplayResult.text);

  const titleResult = await extractViaHelpers(titleBuf);
  assert(titleResult.rawCharCount > 0, 'title raw chars');
  assert(titleResult.text.includes('Kara-Dhushan'), `expected title, got: ${titleResult.text}`);
  assert(looksLikeUsableScriptText(titleResult.text), 'title extract usable without sluglines');
  console.log('OK title:', titleResult.text);

  const karaPath =
    process.env.KARA_PDF ||
    '/Users/pedditiram/Downloads/RAMAYAN/Kara_Dhushan_War_Script_and_Prompts.pdf';
  if (fs.existsSync(karaPath)) {
    console.log('--- Kara PDF (disableWorker + local cMaps) ---');
    const karaBuf = fs.readFileSync(karaPath);
    const karaResult = await extractViaHelpers(karaBuf);
    assert(karaResult.pageCount >= 1, `kara pages: ${karaResult.pageCount}`);
    assert(karaResult.rawCharCount > 1000, `kara raw chars too low: ${karaResult.rawCharCount}`);
    assert(looksLikeUsableScriptText(karaResult.text), 'kara extract must be usable');
    assert(!isPdfBinaryGarbage(karaResult.text), 'kara extract must not be garbage');
    assert(
      /Kara|Dhushan|War/i.test(karaResult.text),
      `expected Kara/Dhushan/War in extract, got head: ${karaResult.text.slice(0, 120)}`
    );
    console.log(
      `OK Kara: ${karaResult.pageCount} pages, ${karaResult.rawCharCount} raw chars, usable=${looksLikeUsableScriptText(karaResult.text)}`
    );
    console.log('  head:', karaResult.text.slice(0, 100).replace(/\s+/g, ' '));
  } else {
    console.warn(`SKIP Kara PDF (not found at ${karaPath})`);
  }

  console.log('--- parse extracted text offline ---');
  store.delete('sps_api_key');
  const shots = await parseRawScriptToShots(screenplayResult.text + '\n\nRAMA\nHold the line.');
  const meta = getLastParseMeta();
  assert(shots.length >= 1, `expected shots, got ${shots.length}`);
  assert(meta.error === 'MISSING_API_KEY' || meta.usedFallback, 'fallback path');
  console.log(`OK: ${shots.length} shots via ${meta.source}`);

  console.log('\nALL PDF EXTRACT DRY-RUN CHECKS PASSED');
} finally {
  try {
    fs.unlinkSync(bundle);
  } catch (_) {}
}
