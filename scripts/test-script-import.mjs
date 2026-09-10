/**
 * Dry-run: Word / TXT / RTF screenplay import (no extra deps).
 * Run: node scripts/test-script-import.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const bundle = path.join(__dirname, '_screenplayInterop.bundle.mjs');
const esbuild = path.join(root, 'node_modules/.bin/esbuild');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}
function u32(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}
function concat(parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function maybeDeflate(bytes) {
  if (typeof CompressionStream !== 'function') return { data: bytes, method: 0 };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const data = new Uint8Array(await new Response(stream).arrayBuffer());
  return { data, method: 8 };
}

async function makeDocx(scriptLine) {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>EXT. FOREST - DAY</w:t></w:r></w:p>
    <w:p><w:r><w:t>${scriptLine}</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`;
  const files = [
    { name: '[Content_Types].xml', text: contentTypes },
    { name: 'word/document.xml', text: xml }
  ];
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = new TextEncoder().encode(f.name);
    const raw = new TextEncoder().encode(f.text);
    const { data, method } = await maybeDeflate(raw);
    const crc = crc32(raw);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(raw.length),
      u16(name.length),
      u16(0),
      name,
      data
    ]);
    locals.push(local);
    centrals.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(method),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(raw.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name
      ])
    );
    offset += local.length;
  }
  const cd = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(cd.length),
    u32(offset),
    u16(0)
  ]);
  return concat([...locals, cd, eocd]);
}

function makeOleDoc(scriptLine) {
  const header = new Uint8Array(64);
  header.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const utf16 = Buffer.from(`    ${scriptLine}    `, 'utf16le');
  const out = new Uint8Array(header.length + utf16.length);
  out.set(header);
  out.set(utf16, header.length);
  return out;
}

const build = spawnSync(
  esbuild,
  [
    'src/utils/screenplayInterop.js',
    '--bundle',
    '--platform=neutral',
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

const {
  importScreenplayFile,
  SCRIPT_UPLOAD_ACCEPT
} = await import(pathToFileURL(bundle).href);

class FakeFile {
  constructor(name, bytes, type = '') {
    this.name = name;
    this.type = type;
    this._bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  }
  async arrayBuffer() {
    const copy = this._bytes.slice();
    return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
  }
}

try {
  console.log('--- accept list ---');
  assert(SCRIPT_UPLOAD_ACCEPT.includes('.pdf'), 'pdf');
  assert(SCRIPT_UPLOAD_ACCEPT.includes('.docx'), 'docx');
  assert(SCRIPT_UPLOAD_ACCEPT.includes('.doc'), 'doc');
  assert(SCRIPT_UPLOAD_ACCEPT.includes('.txt'), 'txt');
  assert(SCRIPT_UPLOAD_ACCEPT.includes('application/msword'), 'msword mime');
  console.log('OK');

  console.log('--- txt utf-8 / utf-16 ---');
  const scene = 'EXT. FOREST - DAY\n\nRama draws his bow near Sita.';
  const utf8 = await importScreenplayFile(new FakeFile('hey.txt', new TextEncoder().encode(scene)));
  assert(utf8.format === 'txt' && /FOREST/.test(utf8.text), utf8.text);
  const bom = new Uint8Array([0xff, 0xfe, ...Buffer.from(scene, 'utf16le')]);
  const utf16 = await importScreenplayFile(new FakeFile('hey.txt', bom));
  assert(/FOREST/.test(utf16.text), `utf16: ${utf16.text}`);
  console.log('OK txt');

  console.log('--- rtf ---');
  const rtf = `{\\rtf1\\ansi\\pard EXT. FOREST - DAY\\par Rama draws his bow near Sita.\\par}`;
  const rtfOut = await importScreenplayFile(new FakeFile('hey.rtf', new TextEncoder().encode(rtf), 'text/rtf'));
  assert(rtfOut.format === 'rtf' && /FOREST/.test(rtfOut.text) && /Rama/.test(rtfOut.text), rtfOut.text);
  console.log('OK rtf:', rtfOut.text.replace(/\s+/g, ' ').slice(0, 80));

  console.log('--- docx ---');
  const docxBytes = await makeDocx('Rama draws his bow near Sita.');
  const docxOut = await importScreenplayFile(
    new FakeFile('hey.docx', docxBytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  );
  assert(docxOut.format === 'docx', `format ${docxOut.format}`);
  assert(/FOREST/.test(docxOut.text) && /Rama/.test(docxOut.text), docxOut.text);
  console.log('OK docx:', docxOut.text.replace(/\s+/g, ' ').slice(0, 80));

  console.log('--- doc (ole harvest) ---');
  const docBytes = makeOleDoc('EXT. FOREST - DAY Rama draws his bow near Sita.');
  const docOut = await importScreenplayFile(new FakeFile('hey.doc', docBytes, 'application/msword'));
  assert(docOut.format === 'doc', `format ${docOut.format}`);
  assert(/FOREST/.test(docOut.text) && /Rama/.test(docOut.text), docOut.text);
  console.log('OK doc:', docOut.text.replace(/\s+/g, ' ').slice(0, 80));

  console.log('\nALL SCRIPT IMPORT CHECKS PASSED');
} finally {
  try {
    fs.unlinkSync(bundle);
  } catch {
    /* ignore */
  }
}
process.exit(0);
