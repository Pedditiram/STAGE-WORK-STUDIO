/**
 * Server-side PDF text extraction (pdfjs legacy / Node).
 * Browser pdf.js often returns empty glyphs for styled PDFs; this path matches
 * the Node dry-run that successfully reads Kara_Dhushan_War_Script_and_Prompts.pdf.
 *
 * Written as CommonJS so Vercel does not ESM→CJS-compile import.meta / .mjs imports.
 *
 * POST JSON: { pdfBase64: string, fileName?: string }
 * Response: { success, text, pageCount, charCount } | { success:false, code, error }
 */
const path = require('path');
const { pathToFileURL } = require('url');

const MAX_BYTES = 12 * 1024 * 1024;

/** pdfjs legacy expects browser geometry APIs; text extract only needs a stub. */
function ensureDomMatrixPolyfill() {
  if (typeof globalThis.DOMMatrix !== 'undefined') return;
  class DOMMatrixPolyfill {
    constructor(init) {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
      this.m11 = 1;
      this.m12 = 0;
      this.m13 = 0;
      this.m14 = 0;
      this.m21 = 0;
      this.m22 = 1;
      this.m23 = 0;
      this.m24 = 0;
      this.m31 = 0;
      this.m32 = 0;
      this.m33 = 1;
      this.m34 = 0;
      this.m41 = 0;
      this.m42 = 0;
      this.m43 = 0;
      this.m44 = 1;
      this.is2D = true;
      this.isIdentity = true;
      if (typeof init === 'string') {
        const m = init.match(/matrix\(([^)]+)\)/i);
        if (m) {
          const parts = m[1].split(/[, ]+/).map(Number);
          if (parts.length >= 6) {
            [this.a, this.b, this.c, this.d, this.e, this.f] = parts;
            this.m11 = this.a;
            this.m12 = this.b;
            this.m21 = this.c;
            this.m22 = this.d;
            this.m41 = this.e;
            this.m42 = this.f;
            this.isIdentity = false;
          }
        }
      } else if (Array.isArray(init) && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        this.m11 = this.a;
        this.m12 = this.b;
        this.m21 = this.c;
        this.m22 = this.d;
        this.m41 = this.e;
        this.m42 = this.f;
        this.isIdentity = false;
      }
    }
    multiplySelf() {
      return this;
    }
    preMultiplySelf() {
      return this;
    }
    translateSelf() {
      return this;
    }
    scaleSelf() {
      return this;
    }
    rotateSelf() {
      return this;
    }
    invertSelf() {
      return this;
    }
    transformPoint(p) {
      return p || { x: 0, y: 0, z: 0, w: 1 };
    }
    toFloat32Array() {
      return new Float32Array([
        this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44
      ]);
    }
    toString() {
      return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }
  }
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}

ensureDomMatrixPolyfill();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function resolvePdfJsAssetDir(sub) {
  try {
    const pkgRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
    return path.join(pkgRoot, sub);
  } catch (e) {
    return path.join(__dirname, '..', 'public', sub);
  }
}

async function loadPdfJsLegacy() {
  const pdfPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const mod = await import(pathToFileURL(pdfPath).href);
  const lib = mod?.getDocument ? mod : (mod?.default || mod);
  if (!lib || typeof lib.getDocument !== 'function') {
    throw new Error('pdfjs-dist legacy getDocument unavailable');
  }
  if (lib.GlobalWorkerOptions) {
    lib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  }
  return lib;
}

/** Telugu PDF repair (CID fonts insert spaces between every akshara). */
const TE_LETTER = /[\u0C00-\u0C7F]/;
const TE_COMBINING_START =
  /^[\u0C01-\u0C03\u0C3E-\u0C4C\u0C4D\u0C55\u0C56\u0C62-\u0C63]/;

/** Standalone words that must keep a following space (not name/verb fragments). */
const TE_FUNCTION_LEFT = new Set([
  'అని',
  'నుంచి',
  'కాగా',
  'కాని',
  'గనక',
  'అయితే',
  'మరియు',
  'లేదా',
  'కాబట్టి',
  'వల్ల',
  'కోసం',
  'ముందు',
  'వెనక',
  'తర్వాత',
  'ఇంకా',
  'కూడా',
  'మాత్రమే',
  'ఒక',
  'ఏ',
  'ఆ',
  'ఈ',
  'ఆయా',
]);

const AKSHARA_RE =
  /[\u0C15-\u0C39\u0C58-\u0C5A](?:\u0C4D[\u0C15-\u0C39\u0C58-\u0C5A])*[\u0C3E-\u0C4C\u0C01-\u0C03\u0C55\u0C56]*/g;

function countAksharas(s) {
  const m = String(s || '').match(AKSHARA_RE);
  return m ? m.length : 0;
}

/** Clusters that commonly finish a Telugu word before a real space. */
const WORD_FINAL_CLUSTER =
  /(?:న్ని|న్న|మ్మ|ల్ల|డ్డ|చ్చ|ళ్ళ|ఱ్ఱ|ంది|ందు|స్తున్న|స్తున్నది|పైనున్న)$/;

function fixMatraViramaOrder(t) {
  let out = t;
  // vowel_sign + virama + consonant → virama + consonant + vowel_sign
  out = out.replace(
    /([\u0C3E-\u0C4C\u0C55\u0C56])(\u0C4D)([\u0C15-\u0C39\u0C58-\u0C5A])/g,
    '$2$3$1'
  );
  // consonant + matras + virama + consonant → consonant + virama + consonant + matras
  out = out.replace(
    /([\u0C15-\u0C39\u0C58-\u0C5A])([\u0C3E-\u0C4C\u0C55\u0C56]+)(\u0C4D)([\u0C15-\u0C39\u0C58-\u0C5A])/g,
    '$1$3$4$2'
  );
  return out;
}

/** Collapse bogus spaces inside a single PDF text run; fix common matra/virama order. */
function repairTeluguChunk(str) {
  let t = String(str || '')
    .replace(/\u0000/g, '')
    .normalize('NFC');

  // Spaces between Telugu letters inside one glyph run are almost never real word breaks
  t = t.replace(/([\u0C00-\u0C7F])(?:[\t \u00A0\u2000-\u200B]+)+(?=[\u0C00-\u0C7F])/g, '$1');

  t = fixMatraViramaOrder(t);
  return t;
}

/**
 * Full-line / document pass after geometry-aware join.
 * Joins combining marks, fixes matra/virama order, and stitches CID-split syllables.
 */
function repairTeluguPdfText(text) {
  let t = String(text || '')
    .replace(/\u0000/g, '')
    .normalize('NFC');

  // Space before combining Telugu mark → join (జయి ంచుట → జయించుట)
  t = t.replace(
    /([\u0C00-\u0C7F])(?:[\t \u00A0]+)+(?=[\u0C01-\u0C03\u0C3E-\u0C4C\u0C4D\u0C55\u0C56])/g,
    '$1'
  );

  // Virama must not be followed by a space before the next consonant
  t = t.replace(/(\u0C4D)[\t \u00A0]+/g, '$1');

  t = fixMatraViramaOrder(t);

  // Conjunct split: ...క్ష సుల → ...క్షసుల (not word-final clusters like …న్న)
  t = t.replace(
    /((?:[\u0C15-\u0C39\u0C58-\u0C5A]\u0C4D)+[\u0C15-\u0C39\u0C58-\u0C5A])[\t \u00A0]+(?=[\u0C15-\u0C39\u0C58-\u0C5A])/g,
    (full, left) => (WORD_FINAL_CLUSTER.test(left) ? full : left)
  );

  // Common agglutinated suffixes split by CID spacing
  t = t.replace(
    /([\u0C00-\u0C7F])[\t \u00A0]+(కి|లతో|లు|డు|డి|ని|ను|గా|తో|ంగా)(?=[\t \u00A0]|[^\u0C00-\u0C7F]|$)/g,
    '$1$2'
  );

  // Short left fragment + rest of word (విభీ షణుడు, వి రూపాక్షు, మో హరించాడు)
  // Skip known function words so "అని చూస్తున్నాడు" stays split.
  const fragRe = new RegExp(
    `([\\u0C15-\\u0C39\\u0C58-\\u0C5A](?:\\u0C4D[\\u0C15-\\u0C39\\u0C58-\\u0C5A])*[\\u0C3E-\\u0C4C\\u0C01-\\u0C03\\u0C55\\u0C56]*){1,2}` +
      `[\\t \\u00A0]+(?=[\\u0C15-\\u0C39\\u0C58-\\u0C5A])`,
    'g'
  );
  t = t.replace(fragRe, (full, _g1, offset, whole) => {
    const left = full.replace(/[\t \u00A0]+$/, '');
    if (TE_FUNCTION_LEFT.has(left)) return full;
    if (WORD_FINAL_CLUSTER.test(left)) return full;
    const before = whole[offset - 1];
    if (before && TE_LETTER.test(before)) return full;
    if (countAksharas(left) !== 1) return full;
    return left;
  });

  // Second pass after suffix / fragment joins
  t = t.replace(
    /((?:[\u0C15-\u0C39\u0C58-\u0C5A]\u0C4D)+[\u0C15-\u0C39\u0C58-\u0C5A])[\t \u00A0]+(?=[\u0C15-\u0C39\u0C58-\u0C5A])/g,
    (full, left) => (WORD_FINAL_CLUSTER.test(left) ? full : left)
  );
  t = t.replace(
    /([\u0C00-\u0C7F])[\t \u00A0]+(కి|లతో|లు|డు|డి|ని|ను|గా|తో|ంగా)(?=[\t \u00A0]|[^\u0C00-\u0C7F]|$)/g,
    '$1$2'
  );

  // Common CID-split compounds
  t = t.replace(/సైన్యా[\t \u00A0]+ధ్యక్ష/g, 'సైన్యాధ్యక్ష');
  t = t.replace(/పచ్చని[\t \u00A0]+మెదాన/g, 'పచ్చనిమెదాన');
  t = t.replace(/అదృశ్య[\t \u00A0]+గమన/g, 'అదృశ్యగమన');
  t = t.replace(/మొత్తా[\t \u00A0]+న్ని/g, 'మొత్తాన్ని');
  t = t.replace(/నగరా[\t \u00A0]+న్ని/g, 'నగరాన్ని');

  t = t.replace(/[ \t]{2,}/g, ' ');
  return t;
}

/**
 * Decide whether to insert a space between two consecutive PDF text items.
 * Telugu word gaps in these PDFs cluster near ~0.28×fontSize; larger gaps are
 * often CID advance artifacts and should not invent spaces when marks/conjuncts say join.
 */
function shouldInsertSpaceBetweenPdfItems(prev, cur) {
  if (!prev || !cur) return false;
  const prevStr = String(prev.str || '');
  const curStr = String(cur.str || '');
  if (!prevStr || !curStr) return false;
  if (/^\s+$/.test(prevStr) || /^\s+$/.test(curStr)) return false;

  const prevTe = TE_LETTER.test(prevStr.slice(-1));
  const curTe = TE_LETTER.test(curStr[0]);
  if (prevTe && TE_COMBINING_START.test(curStr)) return false;

  const prevRep = repairTeluguChunk(prevStr);
  const curRep = repairTeluguChunk(curStr);
  if (prevTe && curTe && /\u0C4D$/.test(prevRep)) return false;

  const prevX = prev.transform?.[4];
  const curX = cur.transform?.[4];
  const prevW = typeof prev.width === 'number' ? prev.width : 0;
  const fontSize = Math.max(
    Math.abs(prev.transform?.[0] || 0),
    Math.abs(cur.transform?.[0] || 0),
    8
  );

  if (typeof prevX === 'number' && typeof curX === 'number') {
    const gap = curX - (prevX + prevW);
    const ratio = gap / fontSize;

    if (prevTe && curTe) {
      const leftA = countAksharas(prevRep);
      const rightA = countAksharas(curRep);
      const conjunctLeft =
        /(?:[\u0C15-\u0C39\u0C58-\u0C5A]\u0C4D)+[\u0C15-\u0C39\u0C58-\u0C5A]$/.test(prevRep);

      // Overlap / same cluster
      if (ratio <= 0.15) return false;

      // Word-final clusters before a clear gap (పరిపాలిస్తున్న కాంచన, అన్ని లోకాలకు)
      if (WORD_FINAL_CLUSTER.test(prevRep) && ratio > 0.5) return true;

      // Conjunct continuation (రాక్ష సుల) — join on larger CID gaps or short right
      if (conjunctLeft && /^[\u0C15-\u0C39\u0C58-\u0C5A]/.test(curRep)) {
        if (ratio > 0.65 || rightA <= 2) return false;
      }

      // Typical inter-word advance in Telugu CID PDFs
      if (ratio > 0.15 && ratio <= 0.5) return true;
      // Medium gaps are usually real word breaks (లంకా నగరం ≈ 0.56)
      if (ratio > 0.5 && ratio <= 0.7) return true;

      // Large gap: short left fragments (విభీ|షణ, మో|హర) join unless very large + long right
      if (rightA <= 1) return false;
      if (
        leftA > 0 &&
        leftA <= 2 &&
        !TE_FUNCTION_LEFT.has(prevRep) &&
        ratio <= 1.45
      ) {
        return false;
      }
      return true;
    }

    return gap > fontSize * 0.18;
  }

  // No geometry — don't invent spaces between Telugu runs
  if (prevTe && curTe) return false;
  return true;
}

function joinPdfTextItems(items, { yBreak = 3.5 } = {}) {
  let lastY = null;
  let line = '';
  let lastNonSpace = null;
  const lines = [];

  const flush = () => {
    const cleaned = repairTeluguPdfText(line).trim();
    if (cleaned) lines.push(cleaned);
    line = '';
    lastNonSpace = null;
  };

  for (const item of items || []) {
    const raw = item?.str;
    if (typeof raw !== 'string' || raw.length === 0) continue;

    const y = item.transform ? item.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > yBreak) {
      flush();
    }

    const chunk = repairTeluguChunk(raw);
    if (!chunk) {
      if (y !== null) lastY = y;
      continue;
    }

    if (/^\s+$/.test(chunk)) {
      // Between Telugu runs, CID "space" glyphs are unreliable — geometry decides.
      if (!(lastNonSpace && TE_LETTER.test(String(lastNonSpace.str || '').slice(-1)))) {
        if (line && !/\s$/.test(line)) line += ' ';
      }
      if (y !== null) lastY = y;
      continue;
    }

    if (!line) {
      line = chunk;
    } else if (/\s$/.test(line) && TE_COMBINING_START.test(chunk)) {
      line = line.replace(/\s+$/, '') + chunk;
    } else if (
      lastNonSpace &&
      shouldInsertSpaceBetweenPdfItems(lastNonSpace, item) &&
      !/\s$/.test(line)
    ) {
      line += ` ${chunk}`;
    } else {
      line += chunk;
    }

    lastNonSpace = { ...item, str: chunk };
    if (y !== null) lastY = y;
  }
  flush();
  return lines.join('\n');
}

async function extractWithPdfJs(uint8) {
  const lib = await loadPdfJsLegacy();
  const cMapDir = resolvePdfJsAssetDir('cmaps');
  const fontDir = resolvePdfJsAssetDir('standard_fonts');

  const loadingTask = lib.getDocument({
    data: uint8,
    verbosity: 0,
    isEvalSupported: false,
    disableWorker: true,
    disableFontFace: true,
    cMapUrl: pathToFileURL(cMapDir + path.sep).href,
    cMapPacked: true,
    standardFontDataUrl: pathToFileURL(fontDir + path.sep).href
  });

  const pdf = await loadingTask.promise;
  const pages = [];
  let totalItems = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent({ includeMarkedContent: true });
    const items = textContent.items || [];
    totalItems += items.filter((i) => i && typeof i.str === 'string' && i.str.length).length;
    const pageText = joinPdfTextItems(items);
    if (pageText) pages.push(pageText);
  }

  const text = repairTeluguPdfText(pages.join('\n\n')).trim();
  return {
    text,
    pageCount: pdf.numPages,
    textItems: totalItems,
    charCount: text.length
  };
}

function looksUsable(text) {
  const t = String(text || '').trim();
  if (t.length < 12) return false;
  return /[\u0C00-\u0C7Fa-zA-Z]{3,}/.test(t);
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, code: 'METHOD', error: 'POST only' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const b64 = String(body.pdfBase64 || body.data || '').replace(/^data:application\/pdf;base64,/, '');
    if (!b64) {
      return res.status(400).json({ success: false, code: 'EMPTY', error: 'Missing pdfBase64' });
    }

    let buf;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch (e) {
      return res.status(400).json({ success: false, code: 'BAD_BASE64', error: 'Invalid base64 PDF' });
    }

    if (!buf.length) {
      return res.status(400).json({ success: false, code: 'EMPTY', error: 'Empty PDF' });
    }
    if (buf.length > MAX_BYTES) {
      return res.status(413).json({
        success: false,
        code: 'TOO_LARGE',
        error: `PDF too large (max ${Math.round(MAX_BYTES / (1024 * 1024))} MB)`
      });
    }

    const result = await extractWithPdfJs(new Uint8Array(buf));
    if (!result.text || !looksUsable(result.text)) {
      const code = result.textItems === 0 ? 'NO_TEXT_LAYER' : 'PDF_GARBAGE';
      return res.status(422).json({
        success: false,
        code,
        error:
          code === 'NO_TEXT_LAYER'
            ? 'No selectable text layer found in PDF (scanned/image).'
            : 'Could not decode usable screenplay text from PDF.',
        pageCount: result.pageCount,
        textItems: result.textItems
      });
    }

    return res.status(200).json({
      success: true,
      text: result.text,
      pageCount: result.pageCount,
      charCount: result.charCount,
      textItems: result.textItems,
      source: 'server-pdfjs-legacy'
    });
  } catch (e) {
    console.error('[extract-pdf]', e);
    return res.status(500).json({
      success: false,
      code: 'PARSE_FAILED',
      error: e?.message || 'PDF extraction failed'
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb'
    }
  }
};
