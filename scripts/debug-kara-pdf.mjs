import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pdfPath =
  process.argv[2] ||
  '/Users/pedditiram/Downloads/RAMAYAN/Kara_Dhushan_War_Script_and_Prompts.pdf';

const buf = fs.readFileSync(pdfPath);
console.log('PDF:', pdfPath);
console.log('bytes:', buf.length);

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const lib = pdfjs;
console.log('pdfjs version:', lib.version);

if (lib.GlobalWorkerOptions) {
  // main-thread in Node
  lib.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href;
}

const cMapUrl = pathToFileURL(path.join(root, 'public/cmaps') + '/').href;
const standardFontDataUrl = pathToFileURL(
  path.join(root, 'public/standard_fonts') + '/'
).href;

console.log('cMapUrl', cMapUrl);
console.log('cmaps exist', fs.existsSync(path.join(root, 'public/cmaps')));

const loadingTask = lib.getDocument({
  data: new Uint8Array(buf),
  verbosity: 0,
  isEvalSupported: false,
  disableWorker: true,
  cMapUrl,
  cMapPacked: true,
  standardFontDataUrl
});

const pdf = await loadingTask.promise;
console.log('pages:', pdf.numPages);

let totalItems = 0;
let totalChars = 0;
let sample = [];

for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent({ includeMarkedContent: true });
  const items = textContent.items || [];
  let pageChars = 0;
  let pageStr = '';
  for (const item of items) {
    if (item.str) {
      totalItems += 1;
      pageChars += item.str.length;
      pageStr += item.str + ' ';
    } else if (item.type) {
      // marked content
    }
  }
  totalChars += pageChars;
  sample.push({
    page: pageNum,
    items: items.length,
    chars: pageChars,
    preview: pageStr.slice(0, 200).replace(/\s+/g, ' ')
  });
}

console.log(JSON.stringify({ totalItems, totalChars, sample }, null, 2));
