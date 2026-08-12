/**
 * Copy pdfjs-dist worker + cMaps + standard fonts into public/
 * so browser / Electron / Vercel can decode CID / subset fonts offline
 * (no unpkg CDN dependency under CSP or file://).
 *
 * Run: node scripts/sync-pdfjs-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pdfjsRoot = path.join(root, 'node_modules', 'pdfjs-dist');
const publicDir = path.join(root, 'public');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing pdfjs asset dir: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(pdfjsRoot)) {
  console.error('pdfjs-dist not installed — run npm install first');
  process.exit(1);
}

const workerSrc = path.join(pdfjsRoot, 'build', 'pdf.worker.min.mjs');
if (!fs.existsSync(workerSrc)) {
  console.error('Missing', workerSrc);
  process.exit(1);
}

copyFile(workerSrc, path.join(publicDir, 'pdf.worker.min.mjs'));
copyDir(path.join(pdfjsRoot, 'cmaps'), path.join(publicDir, 'cmaps'));
copyDir(path.join(pdfjsRoot, 'standard_fonts'), path.join(publicDir, 'standard_fonts'));

const cmapCount = fs.readdirSync(path.join(publicDir, 'cmaps')).length;
const fontCount = fs.readdirSync(path.join(publicDir, 'standard_fonts')).length;
console.log(
  `[sync-pdfjs-assets] synced worker + ${cmapCount} cmaps + ${fontCount} standard fonts → public/`
);
