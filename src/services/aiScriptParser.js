import { detectScriptGenre } from '../constants/seedancePresets';

function safeTrim(str) {
  if (str == null) return '';
  return String(str).trim();
}

function getApiKey() {
  if (typeof window === 'undefined') return '';
  return safeTrim(localStorage.getItem('sps_api_key'));
}

function getLlmProvider() {
  if (typeof window === 'undefined') return 'google_gemini';
  return safeTrim(localStorage.getItem('sps_llm_provider')) || 'google_gemini';
}

/** Last parse run metadata for UI (fallback warnings, missing key, etc.) */
let lastParseMeta = {
  source: 'none',
  usedFallback: false,
  warning: null,
  error: null,
  shotCount: 0,
  provider: null,
  hasApiKey: false
};

export function getLastParseMeta() {
  return { ...lastParseMeta };
}

function setParseMeta( partial = {}) {
  lastParseMeta = {
    source: 'none',
    usedFallback: false,
    warning: null,
    error: null,
    shotCount: 0,
    provider: getLlmProvider(),
    hasApiKey: Boolean(getApiKey()),
    ...partial
  };
  return lastParseMeta;
}

const LLM_TIMEOUT_MS = 55000;
const LLM_MAX_RETRIES = 2;

async function fetchWithTimeout(url, options = {}, timeoutMs = LLM_TIMEOUT_MS) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => {
        try { controller.abort(); } catch (_) { /* ignore */ }
      }, timeoutMs)
    : null;
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller ? controller.signal : options.signal
    });
    return res;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithRetry(url, options = {}, { timeoutMs = LLM_TIMEOUT_MS, retries = LLM_MAX_RETRIES } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res && (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429))) {
        return res;
      }
      lastErr = new Error(`HTTP ${res?.status || 'network'}`);
      if (res && (res.status >= 500 || res.status === 429)) {
        // retry server / rate-limit errors
      } else if (!res?.ok) {
        return res;
      }
    } catch (e) {
      lastErr = e;
      if (e?.name === 'AbortError') {
        lastErr = new Error(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
    }
    if (attempt < retries) {
      const backoff = Math.min(4000, 600 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

/** Extract and parse JSON array from LLM text; repair truncated trailing commas / fences. */
export function safeParseJsonArray(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = cleaned.indexOf('[');
  if (start === -1) return null;
  let candidate = cleaned.slice(start);

  const tryParse = (raw) => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  };

  let parsed = tryParse(candidate);
  if (parsed) return parsed;

  // Truncation repair: close open braces/brackets and strip trailing commas
  let repaired = candidate
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/,\s*$/, '');
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces);
  if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets);
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  parsed = tryParse(repaired);
  if (parsed) return parsed;

  // Greedy balanced extract of first complete array
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    parsed = tryParse(match[0]);
    if (parsed) return parsed;
  }
  return null;
}

export function safeParseJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let candidate = cleaned.slice(start);
  const tryParse = (raw) => {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  };
  let parsed = tryParse(candidate);
  if (parsed) return parsed;
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return tryParse(match[0]);
  return null;
}

function formatSceneShotId(sceneNum, shotNum) {
  const sc = Math.max(1, Number(sceneNum) || 1);
  const sh = Math.max(1, Number(shotNum) || 1);
  return `SC${String(sc).padStart(2, '0')}_SH${String(sh).padStart(2, '0')}`;
}

function sanitizeSceneShotId(rawId, index = 0) {
  const id = safeTrim(rawId);
  if (!id) return formatSceneShotId(1, index + 1);
  const scSh = id.match(/(?:SC|SCENE)\.?\s*0*(\d+)[\s_,-]*(?:SH|S|SHOT)?\.?\s*0*(\d+)/i);
  if (scSh) return formatSceneShotId(scSh[1], scSh[2]);
  const sDash = id.match(/^S0*(\d+)[\s_,-]+(?:SH|S)?\.?\s*0*(\d+)$/i);
  if (sDash) return formatSceneShotId(sDash[1], sDash[2]);
  // Keep letter codes like SC01_SHA as-is if already well-formed
  if (/^SC\d{2}_SH[A-Z0-9]+$/i.test(id)) return id.toUpperCase();
  return formatSceneShotId(1, index + 1);
}

/** Validate LLM shot objects, normalize crafts, dedupe IDs, cap at 100. */
export function validateAndSanitizeShots(rawShots, scriptText = '') {
  if (!Array.isArray(rawShots) || rawShots.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (let idx = 0; idx < rawShots.length && out.length < 100; idx++) {
    const raw = rawShots[idx];
    if (!raw || typeof raw !== 'object') continue;
    const normalized = normalizeShotTo26Crafts(
      { ...raw, sceneShotId: sanitizeSceneShotId(raw.sceneShotId, idx) },
      idx,
      scriptText
    );
    let id = normalized.sceneShotId;
    if (seen.has(id)) {
      const sceneMatch = String(id).match(/SC0*(\d+)/i);
      const sceneNum = sceneMatch ? parseInt(sceneMatch[1], 10) : 1;
      let bump = out.length + 1;
      do {
        id = formatSceneShotId(sceneNum, bump);
        bump += 1;
      } while (seen.has(id) && bump < 400);
      normalized.sceneShotId = id;
    }
    seen.add(normalized.sceneShotId);
    out.push(normalized);
  }
  return out;
}

export function missingApiKeyMessage() {
  return 'No LLM API key set. Open Admin Settings → add a Google Gemini / OpenAI / Anthropic / NVIDIA key (stored as sps_api_key). Offline heuristic parse will be used until a key is available.';
}

/** Typed PDF extract failures — UI should surface message; do not feed garbage into the LLM/heuristic. */
export class PdfExtractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PdfExtractError';
    this.code = code;
  }
}

export const PDF_EXTRACT_MESSAGES = Object.freeze({
  NO_TEXT_LAYER:
    'This PDF has no selectable text layer (scanned/image PDF). Built-in OCR is not available — OCR externally, or export a text-based PDF/TXT from Final Draft, WriterDuet, or Google Docs, then paste or re-upload. Existing project was left unchanged.',
  PDF_GARBAGE:
    'Could not read usable screenplay text from this PDF (binary/metadata only). Export as TXT or a text-based PDF and try again. Existing project was left unchanged.',
  PARSE_FAILED:
    'PDF parsing failed. Re-export the screenplay as PDF/TXT from Final Draft, WriterDuet, or Google Docs, then upload again. Existing project was left unchanged.',
  TOO_LARGE:
    'PDF is too large to process in-browser (max ~40 MB). Split it or upload a TXT export instead. Existing project was left unchanged.',
  EMPTY: 'No text could be extracted from that PDF. Existing project was left unchanged.'
});

const PDF_MAX_BYTES = 40 * 1024 * 1024;
let pdfjsLoadPromise = null;

function publicAssetUrl(filename) {
  const base =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  const cleaned = String(filename || '').replace(/^\//, '');
  if (base.endsWith('/')) return `${base}${cleaned}`;
  return `${base}/${cleaned}`;
}

/** Bundled under public/ (see scripts/sync-pdfjs-assets.mjs) — works offline / CSP / Electron file:// */
function localPdfFontOptions() {
  return {
    cMapUrl: publicAssetUrl('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: publicAssetUrl('standard_fonts/')
  };
}

async function loadPdfJsLibrary() {
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = (async () => {
    const rawModule = await import('pdfjs-dist');
    const pdfjsLib = rawModule.getDocument ? rawModule : (rawModule.default || rawModule);
    if (!pdfjsLib || typeof pdfjsLib.getDocument !== 'function') {
      throw new Error('pdfjs-dist getDocument unavailable');
    }

    if (pdfjsLib.GlobalWorkerOptions) {
      let workerSrc = '';
      try {
        // Prefer Vite-resolved same-version worker (dev + prod hashed asset)
        const pdfWorkerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        workerSrc = pdfWorkerModule.default || pdfWorkerModule;
      } catch (workerErr) {
        console.warn('pdf.js Vite worker URL import failed; using /pdf.worker.min.mjs', workerErr);
      }
      if (!workerSrc || typeof workerSrc !== 'string') {
        // Packaged Electron (file://) + Vercel: public copy matches installed pdfjs-dist version
        workerSrc = publicAssetUrl('pdf.worker.min.mjs');
      }
      // Never point at a mismatched CDN worker (e.g. v3 vs v6) — that silently breaks extraction.
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    }
    return pdfjsLib;
  })();
  try {
    return await pdfjsLoadPromise;
  } catch (e) {
    pdfjsLoadPromise = null;
    throw e;
  }
}

/**
 * Extract selectable text from a PDF File/Blob.
 * Throws PdfExtractError on scanned/empty/garbage/parse failure — never returns PDF binary noise.
 */
export async function extractTextFromPDF(file) {
  if (!file) {
    throw new PdfExtractError('EMPTY', PDF_EXTRACT_MESSAGES.EMPTY);
  }

  const originalArrayBuffer = await file.arrayBuffer();
  if (!originalArrayBuffer || originalArrayBuffer.byteLength === 0) {
    throw new PdfExtractError('EMPTY', PDF_EXTRACT_MESSAGES.EMPTY);
  }
  if (originalArrayBuffer.byteLength > PDF_MAX_BYTES) {
    throw new PdfExtractError('TOO_LARGE', PDF_EXTRACT_MESSAGES.TOO_LARGE);
  }

  // Fresh copies per attempt — pdf.js workers transfer/detach ArrayBuffers
  const clonePdfBytes = () => new Uint8Array(originalArrayBuffer.slice(0));

  let pdfjsLib = null;
  try {
    pdfjsLib = await loadPdfJsLibrary();
  } catch (e) {
    console.warn('Could not import pdfjs-dist module:', e);
  }

  let lastPdfjsError = null;
  let sawTrulyEmptyTextLayer = false;
  let sawTextItemsButUnusable = false;
  let bestRawText = '';

  if (pdfjsLib) {
    const fontOpts = localPdfFontOptions();
    // Prefer disableWorker first — most reliable across Electron file://, CSP, and
    // Vercel (worker/cMap fetch quirks). Later attempts are fallbacks only.
    const attempts = [
      {
        label: 'disableWorker+local-cmaps',
        options: {
          data: clonePdfBytes(),
          verbosity: 0,
          isEvalSupported: false,
          disableWorker: true,
          disableFontFace: true,
          ...fontOpts
        }
      },
      {
        label: 'worker+local-cmaps',
        options: {
          data: clonePdfBytes(),
          verbosity: 0,
          isEvalSupported: false,
          ...fontOpts
        }
      },
      {
        label: 'worker+systemFonts',
        options: {
          data: clonePdfBytes(),
          verbosity: 0,
          isEvalSupported: false,
          disableFontFace: false,
          useSystemFonts: true,
          ...fontOpts
        }
      }
    ];

    for (const attempt of attempts) {
      try {
        const loadingTask = pdfjsLib.getDocument(attempt.options);
        const pdf = await loadingTask.promise;
        const result = await extractPagesTextFromPdfObj(pdf);
        if (result.pageCount > 0 && result.totalTextItems === 0) {
          sawTrulyEmptyTextLayer = true;
        }
        if (result.totalTextItems > 0 && result.rawCharCount === 0) {
          // Text operators present but glyph decode failed (missing cMap was classic cause)
          sawTextItemsButUnusable = true;
        }
        const text = safeTrim(result.text);
        if (text && text.length > bestRawText.length) bestRawText = text;
        // Any usable extract wins immediately — do not keep trying or fall through to binary guess
        if (text && looksLikeUsableScriptText(text)) {
          return text;
        }
        if (result.rawCharCount > 0 && (!text || isPdfBinaryGarbage(text) || !looksLikeUsableScriptText(text))) {
          sawTextItemsButUnusable = true;
        }
        // Do NOT throw PDF_GARBAGE here — mark failure and try the next attempt.
        if (text && isPdfBinaryGarbage(text)) {
          sawTextItemsButUnusable = true;
          console.warn(`PDF extraction (${attempt.label}): output looked like binary/metadata; trying next attempt`);
        }
      } catch (err) {
        // Never abort the attempt loop for typed extract failures — only throw after all attempts
        lastPdfjsError = err;
        console.warn(`PDF extraction (${attempt.label}) failed:`, err);
      }
    }
  }

  // Last-ditch: pull literal Tj strings only if they look like real screenplay / title text
  const binaryGuess = safeTrim(parsePdfBinaryAdvanced(originalArrayBuffer.slice(0)));
  if (binaryGuess && looksLikeUsableScriptText(binaryGuess) && !isPdfBinaryGarbage(binaryGuess)) {
    return binaryGuess;
  }

  // Raw glyph strings existed but cleaned/decoded text was unusable — not a scanned PDF
  if (sawTextItemsButUnusable || (bestRawText && !looksLikeUsableScriptText(bestRawText))) {
    throw new PdfExtractError('PDF_GARBAGE', PDF_EXTRACT_MESSAGES.PDF_GARBAGE);
  }
  // Only claim "no text layer" when every successful parse saw zero text items
  if (sawTrulyEmptyTextLayer && !bestRawText && !binaryGuess) {
    throw new PdfExtractError('NO_TEXT_LAYER', PDF_EXTRACT_MESSAGES.NO_TEXT_LAYER);
  }
  if (binaryGuess && isPdfBinaryGarbage(binaryGuess)) {
    throw new PdfExtractError('PDF_GARBAGE', PDF_EXTRACT_MESSAGES.PDF_GARBAGE);
  }
  if (lastPdfjsError || !pdfjsLib) {
    throw new PdfExtractError(
      'PARSE_FAILED',
      `${PDF_EXTRACT_MESSAGES.PARSE_FAILED}${lastPdfjsError?.message ? ` (${lastPdfjsError.message})` : ''}`
    );
  }
  throw new PdfExtractError('EMPTY', PDF_EXTRACT_MESSAGES.EMPTY);
}

export function isPdfMetadataNoise(text) {
  if (!text) return true;
  const str = String(text);
  if (
    str.includes('ReportLab Generated PDF document') ||
    (str.includes('WinAnsiEncoding') && str.includes('BaseFont')) ||
    /^\s*%PDF-/.test(str)
  ) {
    return true;
  }
  const lines = str.split('\n').filter(Boolean);
  if (!lines.length) return true;
  const metadataLines = lines.filter((l) =>
    /^(?:ReportLab|F\d+|BaseFont|Helvetica|WinAnsiEncoding|\d+\s+\d+\s+R|\d+\s+\d+\s+obj)$/i.test(safeTrim(l))
  );
  return metadataLines.length / lines.length > 0.4;
}

/** Detect raw PDF structure / binary markers mistaken for screenplay text. */
export function isPdfBinaryGarbage(text) {
  if (!text) return true;
  const str = String(text);
  if (/^\s*%PDF-/.test(str)) return true;
  if (/\btrailer\b/i.test(str) && /\bstartxref\b/i.test(str)) return true;
  const markers = (
    str.match(/\b(?:endobj|endstream|xref|startxref|\/Type\s*\/|\/Filter\s*\/|\/Length\s+\d+)/gi) || []
  ).length;
  if (markers >= 3) return true;
  if (isPdfMetadataNoise(str)) return true;
  // High control-character / replacement ratio
  const sample = str.slice(0, 4000);
  const bad = (sample.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g) || []).length;
  if (sample.length > 80 && bad / sample.length > 0.08) return true;
  return false;
}

/**
 * Accept any readable extracted prose — screenplay sluglines, title pages,
 * production-bible covers (e.g. "Kara-Dhushan War"), etc. Do NOT require INT/EXT.
 */
export function looksLikeUsableScriptText(text) {
  const t = safeTrim(text);
  if (t.length < 8) return false;
  if (isPdfBinaryGarbage(t)) return false;
  // Latin or Telugu letters present (titles / bibles / scripts)
  if (!/[\u0C00-\u0C7Fa-zA-Z]{3,}/.test(t)) return false;
  return true;
}

/** Whitespace / control cleanup only — keep title words that heavy sanitize may strip. */
export function lightSanitizePdfExtractedText(text) {
  if (!text) return '';
  return safeTrim(
    String(text)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' ')
      .replace(/[\uFFFD]+/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
  );
}

export async function extractPagesTextFromPdfObj(pdf) {
  const extractedPagesText = [];
  let pagesWithText = 0;
  let totalTextItems = 0;
  let rawCharCount = 0;
  const pageCount = pdf?.numPages || 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent({
        includeMarkedContent: true,
        disableCombineTextItems: false
      });

      let pageLines = [];
      let lastY = null;
      let currentLine = '';
      let pageRawChars = 0;
      let pageTextItems = 0;

      for (const item of textContent.items || []) {
        if (!item || typeof item.str !== 'string') continue;
        pageTextItems += 1;
        totalTextItems += 1;
        const str = item.str;
        if (!str) continue;
        pageRawChars += str.length;
        rawCharCount += str.length;
        const y = item.transform ? item.transform[5] : null;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          if (safeTrim(currentLine)) {
            pageLines.push(safeTrim(currentLine));
          }
          currentLine = str;
        } else {
          currentLine += (currentLine ? ' ' : '') + str;
        }
        if (y !== null) lastY = y;
      }

      if (safeTrim(currentLine)) {
        pageLines.push(safeTrim(currentLine));
      }

      if (pageRawChars > 0) pagesWithText += 1;

      const pageText = pageLines.join('\n');
      // Keep raw assembly; only fall back to light clean if heavy sanitize wipes valid chars
      const heavy = sanitizePdfExtractedText(pageText);
      let cleanPageText = heavy;
      if (!safeTrim(heavy) && pageRawChars > 0) {
        cleanPageText = lightSanitizePdfExtractedText(pageText);
      }
      if (safeTrim(cleanPageText)) {
        extractedPagesText.push(cleanPageText);
      } else if (pageTextItems > 0 && pageRawChars === 0) {
        // Counted toward totalTextItems already — decode failure, not empty layer
      }
    } catch (e) {
      console.warn(`Failed extracting PDF page ${pageNum}:`, e);
    }
  }

  return {
    text: extractedPagesText.join('\n\n'),
    pageCount,
    pagesWithText,
    totalTextItems,
    rawCharCount
  };
}

function sanitizePdfExtractedText(text) {
  if (!text) return '';
  return safeTrim(
    String(text)
      .replace(/ReportLab Generated PDF document \(opensource\)/gi, '')
      .replace(/ReportLab/gi, '')
      .replace(/PDF-1\.\d+/gi, '')
      .replace(/\b\d+\s+\d+\s+obj\b/gi, '')
      .replace(/\b\d+\s+\d+\s+R\b/gi, '')
      .replace(/\bendobj\b/gi, '')
      .replace(/\bendstream\b/gi, '')
      .replace(/\/Title\s+.*?(?=\/|>>|$)/gi, '')
      .replace(/\/Producer\s+.*?(?=\/|>>|$)/gi, '')
      .replace(/Google Docs Renderer/gi, '')
      .replace(/Skia PDF/gi, '')
      // Avoid bare words like CONTENTS/PARENT that appear in real titles/bibles
      .replace(/\b(?:ENCODING|SUBTYPE|OBLIQUE|COURIER|HELVETICA|BASEFONT|FONTDESCRIPTOR|FONTBBOX|PROCSET|MEDIABOX|XOBJECT|CHARPROCS|FLATEDECODE|DECODEPARMS|CIDFONT|CROPBOX)\b/gi, '')
      .replace(/\b(?:TTJ:[A-Za-z0-9_-]+|MCQAFUGC\d*|A0ONLY|HVHQQ\d*|WFRGE\d*|FG7GI\d*)\b/gi, '')
      .replace(/Rotate\s+\d+|BaseFont|Helvetica|WinAnsiEncoding|MacRomanEncoding|FontDescriptor|FontBBox|ItalicAngle|StemV|CapHeight|Ascent|Descent|StdVW|ProcSet|XObject/gi, '')
      .replace(/\/Filter\s*\/[A-Za-z0-9]+/gi, '')
      .replace(/ca\s+\d+|CA\s+\d+|LC\s+\d+|LJ\s+\d+|LW\s+[\d\.]+|ML\s+\d+/g, '')
      .replace(/[\uFFFD]+/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
  );
}

function parsePdfBinaryAdvanced(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) return '';
  const bytes = new Uint8Array(arrayBuffer);

  let decodedStr = '';
  try {
    decodedStr = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch (e) {
    for (let i = 0; i < bytes.length; i++) {
      decodedStr += String.fromCharCode(bytes[i]);
    }
  }

  // Refuse whole-file "extracts" that are mostly PDF object/stream scaffolding
  // (e.g. literal "Kara" inside binary plus dozens of endobj markers).
  const structureMarkers = (
    decodedStr.match(/\b(?:endobj|endstream|stream|xref|startxref)\b/gi) || []
  ).length;
  if (structureMarkers >= 8) {
    // Still allow narrow Tj-string harvesting below; skip unicode scrape of the whole file.
  }

  const textBlocks = [];
  const tjPattern = /\(([^()]{3,})\)\s*Tj|\[\(([^()]{3,})\)\]\s*TJ/gi;
  let match;

  while ((match = tjPattern.exec(decodedStr)) !== null) {
    const rawMatch = match[1] || match[2];
    if (!rawMatch) continue;

    const cleanStr = safeTrim(
      rawMatch
        .replace(/\\([0-7]{3}|[()\\n\r\t])/g, '$1')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    );

    const isPdfMetadata = /ReportLab|WinAnsiEncoding|Helvetica|BaseFont|FontDescriptor|PDF-1\.|obj|endobj|stream/i.test(
      cleanStr
    );
    const isPdfTag = /^(?:S\d{3,}|F\d+|R|G|Q|q|cm|Td|Tf|Do|re|W|n|BT|ET|\/[A-Za-z0-9_-]+)$/i.test(cleanStr);

    if (
      cleanStr.length > 2 &&
      !isPdfTag &&
      !isPdfMetadata &&
      !cleanStr.startsWith('/') &&
      /[\u0C00-\u0C7Fa-zA-Z0-9]/.test(cleanStr)
    ) {
      textBlocks.push(cleanStr);
    }
  }

  if (textBlocks.length > 0) {
    const joined = sanitizePdfExtractedText(textBlocks.join('\n'));
    if (joined && !isPdfBinaryGarbage(joined)) return joined;
    return '';
  }

  // High structure-marker density → do not scrape the raw binary for "words"
  if (structureMarkers >= 8) return '';

  const unicodeBlocks = decodedStr.match(/[\u0C00-\u0C7FA-Za-z0-9\s.,;:'"\-!?()]{8,}/g) || [];
  const cleanBlocks = unicodeBlocks
    .map((b) => sanitizePdfExtractedText(b))
    .filter((b) => {
      if (!b || b.length < 5) return false;
      if (/ReportLab|WinAnsiEncoding|Helvetica|BaseFont|FontDescriptor|PDF-1\.|endobj|stream/i.test(b)) return false;
      if (/^\s*F\d+\s+\d+\s+0\s+R/i.test(b)) return false;
      return /[\u0C00-\u0C7Fa-zA-Z]/.test(b);
    });

  const scraped = sanitizePdfExtractedText(cleanBlocks.join('\n'));
  if (scraped && isPdfBinaryGarbage(scraped)) return '';
  return scraped;
}

/**
 * Map Admin Settings `sps_llm_provider` values → real Google Generative Language model IDs.
 * UI labels like "Gemini 3.6 Flash (High)" stay as marketing names; API uses gemini-3.6-flash + thinkingLevel.
 */
export const GEMINI_LLM_FALLBACK_MODELS = Object.freeze([
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash'
]);

export function resolveGeminiLlmConfig(providerKey) {
  const key = safeTrim(providerKey) || 'google_gemini_36_high';
  const table = {
    google_gemini: { modelId: 'gemini-3.6-flash', thinkingLevel: 'high', label: 'Gemini 3.6 Flash (High)' },
    google_gemini_36_high: { modelId: 'gemini-3.6-flash', thinkingLevel: 'high', label: 'Gemini 3.6 Flash (High)' },
    google_gemini_36_med: { modelId: 'gemini-3.6-flash', thinkingLevel: 'medium', label: 'Gemini 3.6 Flash (Medium)' },
    google_gemini_36_low: { modelId: 'gemini-3.6-flash', thinkingLevel: 'low', label: 'Gemini 3.6 Flash (Low)' },
    google_gemini_35_high: { modelId: 'gemini-3.5-flash', thinkingLevel: 'high', label: 'Gemini 3.5 Flash (High)' },
    google_gemini_35_med: { modelId: 'gemini-3.5-flash', thinkingLevel: 'medium', label: 'Gemini 3.5 Flash (Medium)' },
    google_gemini_31_pro: { modelId: 'gemini-3.1-pro-preview', thinkingLevel: 'high', label: 'Gemini 3.1 Pro (High)' },
    google_gemini_31_pro_low: { modelId: 'gemini-3.1-pro-preview', thinkingLevel: 'low', label: 'Gemini 3.1 Pro (Low)' },
    gemini: { modelId: 'gemini-3.6-flash', thinkingLevel: 'high', label: 'Gemini 3.6 Flash (High)' }
  };
  const hit = table[key] || table.google_gemini_36_high;
  const fallbacks = GEMINI_LLM_FALLBACK_MODELS.filter((m) => m !== hit.modelId);
  return { providerKey: key, ...hit, fallbacks };
}

export function getGeminiModelChain(providerKey) {
  const cfg = resolveGeminiLlmConfig(providerKey);
  return [cfg.modelId, ...cfg.fallbacks];
}

function isGemini3Family(modelId) {
  return /^gemini-3(\.|-|$)/.test(safeTrim(modelId));
}

/** Prefer non-thought text parts from Gemini thinking models. */
export function extractGeminiResponseText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || !parts.length) return '';
  const nonThought = parts.filter((p) => p?.text && !p.thought).map((p) => p.text);
  if (nonThought.length) return nonThought.join('');
  // Thought-only payloads are not usable final answers for parse/UI.
  if (parts.some((p) => p?.thought && p?.text)) return '';
  return parts.map((p) => p?.text).filter(Boolean).join('');
}

export function describeGeminiResponseIssue(data) {
  if (!data || typeof data !== 'object') return 'Gemini returned an empty response body.';
  const block = data.promptFeedback?.blockReason || data.promptFeedback?.block_reason;
  if (block) {
    return `Gemini blocked the prompt (safety / policy: ${block}).`;
  }
  const candidates = data.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return 'Gemini returned no candidates (empty or filtered response).';
  }
  const finish = candidates[0]?.finishReason || candidates[0]?.finish_reason;
  if (finish && /SAFETY|RECITATION|BLOCKLIST|PROHIBITED|OTHER/i.test(String(finish))) {
    return `Gemini stopped without usable text (finishReason: ${finish}).`;
  }
  const text = extractGeminiResponseText(data);
  if (!safeTrim(text)) {
    return finish
      ? `Gemini returned no usable text (finishReason: ${finish}).`
      : 'Gemini returned no usable text in candidates.';
  }
  return null;
}

export async function formatGeminiHttpError(res, modelId = '') {
  const status = res?.status || 0;
  let bodyText = '';
  let parsed = null;
  try {
    bodyText = await res.text();
    parsed = bodyText ? JSON.parse(bodyText) : null;
  } catch (_) {
    /* ignore parse errors */
  }
  const apiMsg =
    parsed?.error?.message ||
    parsed?.message ||
    (bodyText && bodyText.length < 400 ? bodyText.trim() : '') ||
    '';
  const blob = `${apiMsg} ${bodyText}`.toUpperCase();
  const modelHint = modelId ? ` (model: ${modelId})` : '';

  if (status === 429 || /RESOURCE_EXHAUSTED|QUOTA|RATE[_\s-]?LIMIT/.test(blob)) {
    return `API quota / rate limit exhausted${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
  }
  if (status === 401 || status === 403 || /API[_ ]?KEY[_ ]?INVALID|PERMISSION_DENIED|UNAUTHENTICATED/.test(blob)) {
    return `Invalid or unauthorized Gemini API key${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
  }
  if (status === 404 || /NOT_FOUND|is not found|not supported for generateContent/i.test(`${apiMsg} ${bodyText}`)) {
    return `Gemini model not found or unavailable${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
  }
  if (status === 400) {
    return `Gemini request rejected (HTTP 400)${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
  }
  return `Gemini API error HTTP ${status || 'network'}${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
}

function buildGeminiGenerationConfig(modelId, thinkingLevel, generationConfig = {}) {
  const src = generationConfig && typeof generationConfig === 'object' ? generationConfig : {};
  const {
    thinkingLevel: overrideLevel,
    thinkingConfig: userThinking,
    temperature,
    topP,
    topK,
    ...rest
  } = src;

  const level = safeTrim(overrideLevel || thinkingLevel || '').toLowerCase();
  const config = { ...rest };

  if (isGemini3Family(modelId) && level) {
    config.thinkingConfig = {
      ...(userThinking && typeof userThinking === 'object' ? userThinking : {}),
      thinkingLevel: level
    };
    // Gemini 3.x deprecates temperature/topP/topK — omit them for 3.x family models.
  } else {
    config.temperature = temperature != null ? temperature : 0.1;
    config.topP = topP != null ? topP : 0.95;
    if (topK != null) config.topK = topK;
    if (userThinking && typeof userThinking === 'object') {
      config.thinkingConfig = userThinking;
    } else if (level && /^gemini-2\.5/.test(modelId)) {
      const budgetMap = { low: 1024, medium: 4096, high: 8192, minimal: 0 };
      if (budgetMap[level] != null) {
        config.thinkingConfig = { thinkingBudget: budgetMap[level] };
      }
    }
  }

  return config;
}

/**
 * Call Gemini generateContent using Admin Settings provider → model mapping.
 * Tries configured model first, then sensible Flash fallbacks.
 * Throws Error with a specific message (quota / key / model / empty) when all attempts fail.
 * @returns {Promise<Response>}
 */
export async function fetchGeminiContent(apiKey, prompt, generationConfig = {}, options = {}) {
  const cleanKey = safeTrim(apiKey);
  if (!cleanKey) {
    const err = new Error('Missing Gemini API key.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const provider = options.provider || getLlmProvider();
  const cfg = resolveGeminiLlmConfig(provider);
  const modelChain = Array.isArray(options.models) && options.models.length
    ? options.models
    : getGeminiModelChain(provider);

  let lastError = null;
  let lastFatal = false;

  for (const modelId of modelChain) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${cleanKey}`;
    const genConfig = buildGeminiGenerationConfig(modelId, cfg.thinkingLevel, generationConfig);
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: genConfig
    });

    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      }, { timeoutMs: options.timeoutMs || LLM_TIMEOUT_MS, retries: options.retries ?? 1 });

      if (res && res.ok) {
        // Clone so callers can still read the body; also detect empty/safety here for better errors.
        const peek = res.clone();
        let data = null;
        try {
          data = await peek.json();
        } catch (_) {
          return res;
        }
        const issue = describeGeminiResponseIssue(data);
        if (issue) {
          lastError = issue;
          // Empty/safety on a live model — try next fallback when available.
          continue;
        }
        return res;
      }

      if (res) {
        const msg = await formatGeminiHttpError(res, modelId);
        lastError = msg;
        // Auth / quota fail the same on every model — stop early with a clear message.
        if (res.status === 401 || res.status === 403 || res.status === 429) {
          lastFatal = true;
          break;
        }
        // 404 / unsupported model → try next fallback
        if (res.status === 404) {
          console.warn(`Gemini model unavailable: ${modelId}`);
          continue;
        }
        // Other 4xx on primary: still try fallbacks (e.g. thinkingLevel unsupported)
        console.warn(`Gemini ${modelId} failed: ${msg}`);
        continue;
      }
    } catch (e) {
      lastError = e?.message || String(e);
      console.warn('Gemini API endpoint attempt failed:', lastError);
      if (/quota|rate limit|RESOURCE_EXHAUSTED/i.test(lastError)) {
        lastFatal = true;
        break;
      }
    }
  }

  const err = new Error(lastError || `Gemini API did not return a usable response for ${cfg.label}.`);
  err.code = lastFatal ? 'GEMINI_FATAL' : 'GEMINI_UNAVAILABLE';
  err.provider = provider;
  err.modelId = cfg.modelId;
  throw err;
}

/**
 * PARSE RAW SCRIPT TO 26 PRODUCTION CRAFTS
 * Uses low temperature (0.1) across all LLM providers for deterministic results.
 * Always returns a shot array (may be empty). Call getLastParseMeta() for warnings.
 */
export async function parseRawScriptToShots(scriptText) {
  const provider = getLlmProvider();
  const apiKey = getApiKey();

  if (!scriptText || typeof scriptText !== 'string' || !safeTrim(scriptText)) {
    setParseMeta({
      source: 'empty',
      usedFallback: false,
      warning: 'Script text is empty. Paste a screenplay or upload a PDF/TXT before parsing.',
      error: 'EMPTY_SCRIPT',
      shotCount: 0,
      provider,
      hasApiKey: Boolean(apiKey)
    });
    return [];
  }

  const trimmed = safeTrim(scriptText);
  if (trimmed.length < 12) {
    setParseMeta({
      source: 'too_short',
      usedFallback: false,
      warning: 'Script text is too short to parse into production shots.',
      error: 'SCRIPT_TOO_SHORT',
      shotCount: 0,
      provider,
      hasApiKey: Boolean(apiKey)
    });
    return [];
  }

  const fullTextToProcess = scriptText.slice(0, 180000);

  const prompt = `You are a Hollywood Technical Director and Master Cinematographer (Pedditi Labs Cinema Intelligence Engine).
Parse the following screenplay script into a complete JSON array of 26-craft stage production shots.

NATIVE TELUGU & MULTILINGUAL SCRIPT DIRECTIVE:
1. The input screenplay text may be written in Telugu Script (Unicode: తెలుగు), Transliterated/Romanized Telugu, English, or a mix of Telugu & English (Tollywood Screenplay Format).
2. Carefully analyze all Telugu scene headings (e.g. సీన్ 1, EXT. PANCHAVATI, INT. ROOM - NIGHT), Telugu character names (e.g. రాముడు, లక్ష్మణుడు, సీత, దుషణుడు), and Telugu dialogue.
3. Preserve authentic character dialogue in 'characterDialogue' (in Telugu Unicode script or transliterated Telugu as written).
4. Translate technical camera, lighting, composition, score, lens, and VFX fields into clean, high-end, professional English Hollywood 26-craft descriptors so AI Image & Video engines can process them seamlessly.
5. In 'characterIdMatrix', use short 1-to-3 word character/asset reference tags (e.g. Image_1 = rama | Image_2 = sita | Image_3 = dushana).

CRITICAL DIRECTIVE: Carefully analyze the screenplay text. Identify every scene and shot explicitly or implicitly defined in the document. Map each shot accurately. Do NOT skip, omit, or invent shots beyond what is in the screenplay.

CRITICAL REQUIREMENT FOR 'sceneShotId': Each shot object MUST specify 'sceneShotId' accurately reflecting its Scene Number and Shot Number formatted strictly as SC<SceneNo>_SH<ShotNo> (e.g. SC01_SH01, SC01_SH02, SC02_SH01). Track Scene numbers and shot numbers sequentially based on the screenplay structure.

Each shot object in the JSON array MUST strictly contain all 26 canonical craft keys:
"sceneShotId", "sceneSynopsis", "shotComposition", "cameraMotionTag", "timeAndLightingEnv", "directionalLightingAndHighlight", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "colorPaletteSlot", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPsychologyState", "characterMannerismAndPosture", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength", "vfxCgiBreakdown", "stuntAndSafetyNotes", "makeupAndHairStyle", "editTransitionCut", "characterIdMatrix".

In "characterIdMatrix", specify the ComfyUI Seedance 2.0 multi-modal reference slots formatted as:
"Image_1 = [char/subject 1] | Image_2 = [char/subject 2] | Image_3 = [char/subject 3] | Image_4 = [char 4] | Image_5 = crowd | Image_6 = scene | Image_7 = | Image_8 = | Image_9 = "

CRITICAL REQUIREMENT FOR 'characterIdMatrix': Use ONLY short, concise 1-to-3 word Character/Asset Names (e.g. 'Lord Rama', 'Dushana', 'John', 'Sarah'). Do NOT put long action descriptions inside 'characterIdMatrix'. Only include characters actually present in this specific shot.

Screenplay text to break down:
${fullTextToProcess}

Return ONLY valid JSON array without markdown code blocks.`;

  const finalizeLlmShots = (parsed, sourceLabel) => {
    const shots = validateAndSanitizeShots(parsed, scriptText);
    if (shots.length === 0) return null;
    setParseMeta({
      source: sourceLabel,
      usedFallback: false,
      warning: null,
      error: null,
      shotCount: shots.length,
      provider,
      hasApiKey: true
    });
    return shots;
  };

  let llmError = null;

  // 1. ROUTE TO ANTHROPIC CLAUDE LLM ENGINE
  if (provider === 'anthropic' && apiKey) {
    try {
      const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 8192,
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (res?.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const parsed = safeParseJsonArray(text);
        if (parsed?.length) {
          const shots = finalizeLlmShots(parsed, 'anthropic');
          if (shots) return shots;
        }
        llmError = 'Anthropic returned invalid or empty shot JSON.';
      } else if (res) {
        llmError = `Anthropic API error HTTP ${res.status}. Check your API key in Admin Settings.`;
      }
    } catch (e) {
      llmError = e?.message || 'Anthropic request failed.';
      console.warn("Anthropic Claude LLM breakdown fallback:", e);
    }
  }

  // 2. ROUTE TO OPENAI LLM ENGINE
  if (provider === 'openai' && apiKey) {
    try {
      const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (res?.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const parsed = safeParseJsonArray(text);
        if (parsed?.length) {
          const shots = finalizeLlmShots(parsed, 'openai');
          if (shots) return shots;
        }
        llmError = 'OpenAI returned invalid or empty shot JSON.';
      } else if (res) {
        llmError = `OpenAI API error HTTP ${res.status}. Check your API key in Admin Settings.`;
      }
    } catch (e) {
      llmError = e?.message || 'OpenAI request failed.';
      console.warn("OpenAI LLM breakdown fallback:", e);
    }
  }

  // 2B. ROUTE TO NVIDIA BUILD / MINIMAX-M3 ENGINE
  const isNvidiaKey = Boolean(apiKey && apiKey.startsWith('nvapi-'));
  if ((provider === 'minimax' || provider === 'nvidia_minimax' || provider === 'minimax_m3' || isNvidiaKey) && apiKey) {
    try {
      const res = await fetchWithRetry('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'minimaxai/minimax-m3',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 4096
        })
      });

      if (res?.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const parsed = safeParseJsonArray(text);
        if (parsed?.length) {
          const shots = finalizeLlmShots(parsed, 'nvidia_minimax');
          if (shots) return shots;
        }
        llmError = 'NVIDIA MiniMax returned invalid or empty shot JSON.';
      } else if (res) {
        llmError = `NVIDIA API error HTTP ${res.status}. Check your nvapi key in Admin Settings.`;
      }
    } catch (e) {
      llmError = e?.message || 'NVIDIA MiniMax request failed.';
      console.warn("NVIDIA MiniMax-M3 breakdown fallback:", e);
    }
  }

  // 3. ROUTE TO GOOGLE GEMINI / PEDDITI LABS ENGINE
  if ((provider.startsWith('google_gemini') || provider === 'gemini' || !provider || (!['anthropic', 'openai', 'minimax', 'nvidia_minimax', 'minimax_m3'].includes(provider) && !isNvidiaKey)) && apiKey) {
    try {
      const geminiCfg = resolveGeminiLlmConfig(provider);
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1, maxOutputTokens: 65536 }, { provider });

      if (response && response.ok) {
        const data = await response.json();
        const issue = describeGeminiResponseIssue(data);
        const responseText = extractGeminiResponseText(data);
        const parsed = safeParseJsonArray(responseText);
        if (parsed?.length) {
          const shots = finalizeLlmShots(parsed, geminiCfg.modelId || 'google_gemini');
          if (shots) return shots;
        }
        llmError = issue || 'Gemini returned invalid or empty shot JSON.';
      } else {
        llmError = llmError || 'Gemini API did not return a usable response.';
      }
    } catch (e) {
      llmError = e?.message || 'Gemini request failed.';
      console.warn('Google Gemini API breakdown fallback:', e);
    }
  }

  // Fallback / Built-In Fast Universal Heuristic Rule Parser
  const fallbackShots = parseRawScriptFallback(scriptText);
  const warningParts = [];
  if (!apiKey) {
    warningParts.push(missingApiKeyMessage());
  } else if (llmError) {
    warningParts.push(`LLM parse failed (${llmError}). Using offline heuristic breakdown.`);
  } else {
    warningParts.push('LLM parse unavailable. Using offline heuristic breakdown.');
  }

  setParseMeta({
    source: 'fallback',
    usedFallback: true,
    warning: warningParts.join(' '),
    error: apiKey ? (llmError ? 'LLM_FAILED' : 'LLM_EMPTY') : 'MISSING_API_KEY',
    shotCount: fallbackShots.length,
    provider,
    hasApiKey: Boolean(apiKey)
  });

  return fallbackShots;
}

export function autoEnhanceCraftValue(craftKey, baseValue) {
  if (!baseValue || typeof baseValue !== 'string') return baseValue || '';
  const val = baseValue.trim();

  // Don't re-enhance if already enhanced
  if (val.includes('Pedditi Labs') || val.includes('Enhanced') || val.includes('—')) {
    return val;
  }

  const enhancements = {
    shotComposition: `${val} — Rule of Thirds Frame Balance, Dynamic Subject Prominence & Background Depth Compression`,
    cameraMotionTag: val.includes('[Camera:') ? `${val} • Kinetic Tracking Vector & Parallax Spatial Motion` : `[Camera: ${val}] • Kinetic Tracking Vector & Parallax Spatial Motion`,
    timeAndLightingEnv: val.includes('[Weather:') ? `${val} • Volumetric Sunlight Falloff & Environmental Rigging` : `[Weather: ${val}] • Volumetric Sunlight Falloff & Environmental Rigging`,
    directionalLightingAndHighlight: val.includes('[Angle:') ? `${val} • Eye Catchlight & Subtle Bounce Fill` : `[Angle: ${val}] • Eye Catchlight & Subtle Bounce Fill`,
    subjectLightingTag: val.includes('[Lighting:') ? `${val} • 45° Rembrandt Key Light & Razor Rim Highlight` : `[Lighting: ${val}] • 45° Rembrandt Key Light & Razor Rim Highlight`,
    subjectColorTag: val.includes('[Subject Color:') ? `${val} • Rich Earthy Ochre & Deep Saffron Vibrancy` : `[Subject Color: ${val}] • Rich Earthy Ochre & Deep Saffron Vibrancy`,
    backgroundLightingTag: val.includes('[BG Lighting:') ? `${val} • Foreground-to-Background Volumetric Separation` : `[BG Lighting: ${val}] • Foreground-to-Background Volumetric Separation`,
    backgroundColorTag: val.includes('[BG Color:') ? `${val} • Harmonized Set Architecture & Deep Palette Contrast` : `[BG Color: ${val}] • Harmonized Set Architecture & Deep Palette Contrast`,
    colorPaletteSlot: val.includes('[Palette:') ? `${val} • Color Graded Master Swatches` : `[Palette: ${val}] • Color Graded Master Swatches`,
    atmosphereVolumetricsTag: val.includes('[Atmosphere:') ? `${val} • 3D Particle Physics & Spatial Light Cones` : `[Atmosphere: ${val}] • 3D Particle Physics & Spatial Light Cones`,
    characterExpression: `${val} — Intense gaze vector, subtle facial muscle tension & emotional presence`,
    characterPsychologyState: val.includes('[Mindstate:') ? `${val} • Subconscious Focus & Internal Drive Baseline` : `[Mindstate: ${val}] • Subconscious Focus & Internal Drive Baseline`,
    characterMannerismAndPosture: val.includes('[Mannerism:') ? `${val} • Distinctive Physical Posture & Habitual Presence` : `[Mannerism: ${val}] • Distinctive Physical Posture & Habitual Presence`,
    characterPlacement: `${val} — Precise Spatial Framing Geometry & Subject Depth Anchor`,
    characterMovement: `${val} — Controlled stride speed, dynamic weight distribution & fluid body language`,
    characterEyeLooks: val.includes('[Eye Look:') ? `${val} • Intentional Focal Target & Direct Gaze Vector` : `[Eye Look: ${val}] • Intentional Focal Target & Direct Gaze Vector`,
    soundFxAndFoley: val.includes('[SFX:') ? `${val} • Sub-Bass Spatial Impact & Acoustic Resonance` : `[SFX: ${val}] • Sub-Bass Spatial Impact & Acoustic Resonance`,
    backgroundScoreMood: val.includes('[Score:') ? `${val} • Orchestral Brass Motif & Driving Percussive Pulse` : `[Score: ${val}] • Orchestral Brass Motif & Driving Percussive Pulse`,
    lensAndFocalLength: val.includes('Prime') || val.includes('mm') ? `${val} — Shallow Depth Bokeh, Anamorphic Optics & Razor Sharp Focus` : `${val} 50mm Master Prime — Shallow Depth Bokeh & Razor Sharp Optics`
  };

  return enhancements[craftKey] || val;
}

export function normalizeShotTo26Crafts(shot, index = 0, defaultText = '') {
  if (!shot || typeof shot !== 'object') shot = {};

  const shotId = shot.sceneShotId || `SC01_SH${(index + 1) < 10 ? '0' + (index + 1) : (index + 1)}`;
  const leadChar = shot.characterIdAssetRef || '[CharID: @Lead_Protagonist]';
  const dialogue = shot.characterDialogue || '[Atmospheric Production Sound & Environmental Foley]';
  const actionContext = shot.actionEnvContext || defaultText || 'Cinematic stage production scene beat.';

  const rawShotComposition = shot.shotComposition || 'Medium Shot (MS)';
  const rawCameraMotionTag = shot.cameraMotionTag || '[Camera: Slow Push-In / Dolly Zoom]';
  const rawTimeAndLightingEnv = shot.timeAndLightingEnv || '[Weather: Sunny Clear Sky] • [Timing: Golden Hour Sunset] • [Env: Outdoor Direct Sun]';
  const rawDirectionalLightingAndHighlight = shot.directionalLightingAndHighlight || '[Angle: 45° Side Key Light] • [Shadow: Subject Canopy Shade] • [Highlight: Eye Catchlight]';
  const rawSubjectLightingTag = shot.subjectLightingTag || '[Lighting: Direct Cinematic Sunbeam & Directional Key]';
  const rawSubjectColorTag = shot.subjectColorTag || '[Subject Color: High-Contrast Cinematic Color Palette]';
  const rawBackgroundLightingTag = shot.backgroundLightingTag || '[BG Lighting: Soft Natural Ambient Falloff & Warm Bokeh]';
  const rawBackgroundColorTag = shot.backgroundColorTag || '[BG Color: Rich Deep Tones & Environmental Contrast]';
  const rawColorPaletteSlot = shot.colorPaletteSlot || '[Palette: Konaseema Golden Hour (#d4af37 Gold | #8b4513 Earth | #228b22 Emerald)]';
  const rawAtmosphereVolumetricsTag = shot.atmosphereVolumetricsTag || '[Atmosphere: Volumetric Rays & Dust Motes in Light Cones]';
  const rawCharacterExpression = shot.characterExpression || 'Focused determination and dramatic presence';
  const rawCharacterPsychologyState = shot.characterPsychologyState || '[Mindstate: Heroic Adrenaline Surge & Unwavering Oath]';
  const rawCharacterMannerismAndPosture = shot.characterMannerismAndPosture || '[Mannerism: Military Straight Spine & Controlled Gestures]';
  const rawCharacterPlacement = shot.characterPlacement || 'Center frame focus, environment & co-artists in background';
  const rawCharacterMovement = shot.characterMovement || 'Dynamic movement focused on action beat';
  const rawCharacterEyeLooks = shot.characterEyeLooks || '[Eye Look: Laser Focus on Scene Target]';
  const rawSoundFxAndFoley = shot.soundFxAndFoley || '[SFX: Environmental Foley & Acoustic Movement]';
  const rawBackgroundScoreMood = shot.backgroundScoreMood || '[Score: Orchestral Cinematic Strings & Driving Percussion]';
  const rawLensAndFocalLength = shot.lensAndFocalLength || '50mm Master Prime (f/1.4) - Shallow Depth Bokeh';

  return {
    sceneShotId: shotId,
    sceneSynopsis: shot.sceneSynopsis || `Scene Location & Context: ${actionContext.substring(0, 120)}. Featuring ${leadChar}.`,
    shotComposition: autoEnhanceCraftValue('shotComposition', rawShotComposition),
    cameraMotionTag: autoEnhanceCraftValue('cameraMotionTag', rawCameraMotionTag),
    timeAndLightingEnv: autoEnhanceCraftValue('timeAndLightingEnv', rawTimeAndLightingEnv),
    directionalLightingAndHighlight: autoEnhanceCraftValue('directionalLightingAndHighlight', rawDirectionalLightingAndHighlight),
    subjectLightingTag: autoEnhanceCraftValue('subjectLightingTag', rawSubjectLightingTag),
    subjectColorTag: autoEnhanceCraftValue('subjectColorTag', rawSubjectColorTag),
    backgroundLightingTag: autoEnhanceCraftValue('backgroundLightingTag', rawBackgroundLightingTag),
    backgroundColorTag: autoEnhanceCraftValue('backgroundColorTag', rawBackgroundColorTag),
    colorPaletteSlot: autoEnhanceCraftValue('colorPaletteSlot', rawColorPaletteSlot),
    atmosphereVolumetricsTag: autoEnhanceCraftValue('atmosphereVolumetricsTag', rawAtmosphereVolumetricsTag),
    characterIdAssetRef: leadChar,
    coArtistInteraction: shot.coArtistInteraction || '[Co-Artist: Supporting Performer & Surrounding Crowd]',
    actionEnvContext: actionContext,
    characterExpression: autoEnhanceCraftValue('characterExpression', rawCharacterExpression),
    characterPsychologyState: autoEnhanceCraftValue('characterPsychologyState', rawCharacterPsychologyState),
    characterMannerismAndPosture: autoEnhanceCraftValue('characterMannerismAndPosture', rawCharacterMannerismAndPosture),
    characterPlacement: autoEnhanceCraftValue('characterPlacement', rawCharacterPlacement),
    characterDialogue: dialogue,
    characterMovement: autoEnhanceCraftValue('characterMovement', rawCharacterMovement),
    characterEyeLooks: autoEnhanceCraftValue('characterEyeLooks', rawCharacterEyeLooks),
    shotDurationAndImages: shot.shotDurationAndImages || 'Duration: 6s | Image_1: @Lead_Protagonist | Image_2: @CoArtist',
    soundFxAndFoley: autoEnhanceCraftValue('soundFxAndFoley', rawSoundFxAndFoley),
    backgroundScoreMood: autoEnhanceCraftValue('backgroundScoreMood', rawBackgroundScoreMood),
    lensAndFocalLength: autoEnhanceCraftValue('lensAndFocalLength', rawLensAndFocalLength),
    // Additional production craft metadata
    vfxCgiBreakdown: shot.vfxCgiBreakdown || '[VFX: Practical Shot - In-Camera Production]',
    stuntAndSafetyNotes: shot.stuntAndSafetyNotes || '[Stunt: Standard Performer Safety Controls]',
    makeupAndHairStyle: shot.makeupAndHairStyle || '[Makeup: Authentic Cinema Grooming & Natural Glow]',
    editTransitionCut: shot.editTransitionCut || 'Hard Cut (Standard Scene Beat)',
    characterIdMatrix: shot.characterIdMatrix || 'Image_1 = lead | Image_2 = coartist | Image_3 = scene'
  };
}

function smartSegmentTextIntoShots(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  const cleanScript = safeTrim(scriptText).replace(/\r\n/g, '\n');

  // Regex splitting by Scene Headers, Shot Headers, or Paragraph Breaks
  const segmentRegex = /(?:\n\s*)+(?=(?:SC\.\s*\d+|SC\s*\d+|SCENE\s*\d+|సీన్\s*\d+|దృశ్యం\s*\d+|BLOCK\s*[-:\s]?\d+|BLOCK\b|PART\s*\d+|1st\s+half|2nd\s+half|INTERMISSION|(?:EXT\.|INT\.)|SHOT\s*\d+|SHOT\b|SH\d+|S\d{1,2}-[A-Z0-9]+|\[SHOT|\[Camera:))/i;

  let rawSegments = cleanScript.split(segmentRegex).map(b => safeTrim(b)).filter(Boolean);

  const finalBlocks = [];

  rawSegments.forEach(seg => {
    // Split sub-lines/paragraphs so every shot or action line gets its own block
    const subLines = seg.split(/\n\s*\n+|(?<=\n)(?=(?:SHOT\s*\d+|SH\d+|S\d{1,2}-[A-Z]|\[SHOT|\[Camera:|(?:EXT\.|INT\.)|[A-Z\u0C00-\u0C7F]{2,20}:))/i);
    subLines.forEach(sub => {
      const trimmed = safeTrim(sub);
      if (trimmed && trimmed.length >= 4) {
        finalBlocks.push(trimmed);
      }
    });
  });

  return finalBlocks.length > 0 ? finalBlocks : [cleanScript];
}

function parseRawScriptFallback(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  const rawBlocks = smartSegmentTextIntoShots(scriptText);
  const parsedShots = [];

  let currentSceneNum = 1;
  let currentSceneStr = "SC01";
  const sceneShotCounters = {};

  rawBlocks.forEach((block) => {
    if (!block || typeof block !== 'string') return;
    const cleanBlock = safeTrim(block);

    // Skip empty or PDF stream noise
    if (cleanBlock.length < 4 || /^\d+$/.test(cleanBlock) || /^(?:PDF-1\.|obj|endobj|stream|endstream|ReportLab|WinAnsiEncoding)/i.test(cleanBlock)) {
      return;
    }

    if (parsedShots.length >= 100) return;

    const textLower = cleanBlock.toLowerCase();

    // Skip metadata / summary counters at top
    if (/^(?:\d+\s*Acts|\d+\s*Scenes|\d+\s*Shots|#[0-9a-f]{6})/i.test(cleanBlock)) {
      return;
    }

    // Detect Scene Header (e.g. SCENE 1, SC 01, EXT. DANDAKA, INT. ROOM, సీన్ 1, 1. EXT., ACT I, ACT II)
    const sceneHeaderMatch = cleanBlock.match(/(?:SC\.\s*(\d+)|SC\s*(\d+)|SCENE\s*(\d+)|సీన్\s*(\d+)|దృశ్యం\s*(\d+)|BLOCK\s*[-:\s]?(\d+)|ACT\s*([I|V|X\d]+)|(?:EXT\.|INT\.)\s*([A-Za-z0-9_\s-]+))/i);

    let isHeaderBlockOnly = false;

    if (sceneHeaderMatch) {
      const parsedNum = parseInt(sceneHeaderMatch[1] || sceneHeaderMatch[2] || sceneHeaderMatch[3] || sceneHeaderMatch[4] || sceneHeaderMatch[5] || sceneHeaderMatch[6], 10);
      if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum < 300) {
        if (parsedNum !== currentSceneNum) {
          currentSceneNum = parsedNum;
          currentSceneStr = `SC${currentSceneNum < 10 ? '0' + currentSceneNum : currentSceneNum}`;
          if (!sceneShotCounters[currentSceneStr]) {
            sceneShotCounters[currentSceneStr] = 0;
          }
        }
      } else if (!textLower.startsWith('shot') && !textLower.startsWith('sh') && !textLower.startsWith('s0') && !textLower.startsWith('s1')) {
        // If a new EXT. or INT. scene header is encountered without explicit scene number
        if (cleanBlock.length < 80 && (textLower.includes('ext.') || textLower.includes('int.'))) {
          currentSceneNum++;
          currentSceneStr = `SC${currentSceneNum < 10 ? '0' + currentSceneNum : currentSceneNum}`;
          if (!sceneShotCounters[currentSceneStr]) {
            sceneShotCounters[currentSceneStr] = 0;
          }
        }
      }

      // If this block is purely a scene slugline header (e.g. "SCENE 1: EXT. DANDAKA FOREST - DAY" or "ACT I: THE DARK HORIZON")
      if (cleanBlock.length < 60 && !cleanBlock.includes('\n') && !textLower.includes('camera') && !textLower.includes('close-up') && !textLower.includes('wide')) {
        isHeaderBlockOnly = true;
      }
    }

    // If it's purely a scene slugline header, don't generate a duplicate shot card
    if (isHeaderBlockOnly) {
      return;
    }

    // Explicit check for scene change in shot tags like S09-A or SC09_SH01
    const shotCodeMatch = cleanBlock.match(/(S(\d{1,2})-(?:[A-Z0-9]+)|SC(\d{1,2})_SH?\d{1,2}|SH\d{1,2}|SHOT\s*[S\d]+)/i);
    if (shotCodeMatch) {
      const detectedSceneNo = parseInt(shotCodeMatch[2] || shotCodeMatch[3], 10);
      if (!isNaN(detectedSceneNo) && detectedSceneNo > 0 && detectedSceneNo < 300) {
        if (detectedSceneNo !== currentSceneNum) {
          currentSceneNum = detectedSceneNo;
          currentSceneStr = `SC${currentSceneNum < 10 ? '0' + currentSceneNum : currentSceneNum}`;
          if (!sceneShotCounters[currentSceneStr]) {
            sceneShotCounters[currentSceneStr] = 0;
          }
        }
      }
    }

    // Increment shot counter for current scene sequentially
    sceneShotCounters[currentSceneStr] = (sceneShotCounters[currentSceneStr] || 0) + 1;
    const currentShotNum = sceneShotCounters[currentSceneStr];
    let shotId = `${currentSceneStr}_SH${currentShotNum < 10 ? '0' + currentShotNum : currentShotNum}`;

    // Universal Dynamic Shot Framing Detection
    let framing = "Medium Shot (MS)";
    if (textLower.includes("aerial") || textLower.includes("god's-eye") || textLower.includes("ews") || textLower.includes("drone")) {
      framing = "Aerial Extreme Wide Shot (EWS)";
    } else if (textLower.includes("low-angle") || textLower.includes("low angle")) {
      framing = "Low-Angle Close-Up (CU)";
    } else if (textLower.includes("extreme close") || textLower.includes("ecu")) {
      framing = "Extreme Close-Up (ECU)";
    } else if (textLower.includes("close-up") || textLower.includes("closeup") || textLower.includes(" cu ") || textLower.endsWith(" cu")) {
      framing = "Close-Up (CU)";
    } else if (textLower.includes("wide shot") || textLower.includes("wide") || textLower.includes("establishing")) {
      framing = "Wide Shot (WS)";
    } else if (textLower.includes("ots") || textLower.includes("over-the-shoulder")) {
      framing = "Over-The-Shoulder (OTS)";
    } else if (textLower.includes("mcu") || textLower.includes("medium close")) {
      framing = "Medium Close-Up (MCU)";
    }

    // Universal Dynamic Camera Motion Detection
    let cameraMotion = "[Camera: Tracking Shot / Steadicam Follow]";
    if (textLower.includes("push-in") || textLower.includes("push in") || textLower.includes("dolly")) {
      cameraMotion = "[Camera: Slow Push-In / Dolly Zoom]";
    } else if (textLower.includes("crane") || textLower.includes("tilt")) {
      cameraMotion = "[Camera: Slow Crane Rise / Vertical Tilt]";
    } else if (textLower.includes("orbit") || textLower.includes("360")) {
      cameraMotion = "[Camera: Hero Orbit 180/360 Deg]";
    } else if (textLower.includes("reveal") || textLower.includes("pan")) {
      cameraMotion = "[Camera: Slow Epic Reveal / Pan Right]";
    } else if (textLower.includes("handheld") || textLower.includes("action") || textLower.includes("fight")) {
      cameraMotion = "[Camera: Dynamic Handheld Action Tracking]";
    }

    // Universal Dynamic Environment & Lighting Detection
    let lighting = "[Lighting: Natural Cinematic Sunbeams & Directional Fill]";
    let subjColor = "[Subject Color: High-Contrast Cinema Color Palette]";
    let bgLighting = "[BG Lighting: Soft Natural Ambient Falloff]";
    let bgColor = "[BG Color: Rich Deep Tones]";

    if (textLower.includes("night") || textLower.includes("dark") || textLower.includes("moon")) {
      lighting = "[Lighting: Moonlight & Deep Shadow Silhouette Fill]";
      subjColor = "[Subject Color: Cool Slate & Silver Highlights]";
      bgLighting = "[BG Lighting: Atmospheric Night Sky & Soft Fog]";
      bgColor = "[BG Color: Deep Midnight Navy & Indigo]";
    } else if (textLower.includes("sunset") || textLower.includes("dusk") || textLower.includes("golden hour")) {
      lighting = "[Lighting: Golden Hour Warm Horizon Glow]";
      subjColor = "[Subject Color: Warm Amber & Saffron Tones]";
      bgLighting = "[BG Lighting: Volumetric Golden Rays]";
      bgColor = "[BG Color: Soft Orange & Violet Gradient]";
    } else if (textLower.includes("neon") || textLower.includes("cyberpunk") || textLower.includes("futuristic")) {
      lighting = "[Lighting: Dual Neon Cyberpunk Glow]";
      subjColor = "[Subject Color: Neo-Noir Vibrant Saturation]";
      bgLighting = "[BG Lighting: Strobing Urban Hologram Glow]";
      bgColor = "[BG Color: Cyan & Magenta Dark Tones]";
    }

    // Universal Dynamic Character Extraction from Text
    const extractedCharNames = [];
    const dialogueSlugMatch = block.match(/([\u0C00-\u0C7FA-Z][\u0C00-\u0C7FA-Z\s]{1,20}):/g);
    if (dialogueSlugMatch) {
      dialogueSlugMatch.forEach(m => {
        const cleanName = safeTrim(m.replace(':', ''));
        if (cleanName && !['EXT', 'INT', 'SCENE', 'SHOT', 'ACT', 'CUT TO'].includes(cleanName)) {
          extractedCharNames.push(`@${cleanName.replace(/\s+/g, '_')}`);
        }
      });
    }

    const atHandleMatches = block.match(/@[A-Za-z0-9_]+/g) || [];
    atHandleMatches.forEach(h => {
      if (!extractedCharNames.includes(h)) extractedCharNames.push(h);
    });

    const leadCharTag = extractedCharNames[0] || "[CharID: @Lead_Protagonist]";
    const secondaryCharTag = extractedCharNames[1] || "[Co-Artist: Supporting Performer]";

    const quoteMatch = block.match(/"([^"]+)"|'([^']+)'/);
    let dialogue = quoteMatch ? `"${quoteMatch[1] || quoteMatch[2]}"` : '[Atmospheric Production Sound & Environmental Foley]';

    let actionContext = safeTrim(block.replace(/\s+/g, ' '));
    if (actionContext.length > 220) actionContext = actionContext.substring(0, 220) + '...';

    const matrixSlots = [];
    for (let slotIdx = 0; slotIdx < 6; slotIdx++) {
      if (extractedCharNames[slotIdx]) {
        matrixSlots.push(`Image_${slotIdx + 1} = ${extractedCharNames[slotIdx].replace('@', '').toLowerCase()}`);
      }
    }
    if (matrixSlots.length < 4) {
      matrixSlots.push(`Image_${matrixSlots.length + 1} = scene`);
      matrixSlots.push(`Image_${matrixSlots.length + 1} = environment`);
    }

    const durationAndImagesStr = `Duration: 6s | ${extractedCharNames.slice(0, 4).map((c, i) => `Image_${i+1}: ${c}`).join(' | ')}`;

    parsedShots.push({
      sceneShotId: shotId,
      sceneSynopsis: `Scene Location & Context: ${actionContext}. Featuring ${leadCharTag}.`,
      shotComposition: framing,
      cameraMotionTag: cameraMotion,
      subjectLightingTag: lighting,
      subjectColorTag: subjColor,
      backgroundLightingTag: bgLighting,
      backgroundColorTag: bgColor,
      atmosphereVolumetricsTag: "[Atmosphere: Haze & Dust Motes in Light Cones]",
      characterIdAssetRef: leadCharTag,
      coArtistInteraction: secondaryCharTag,
      actionEnvContext: actionContext,
      characterExpression: "Focused determination and dramatic presence",
      characterPlacement: "Center frame focus, environment & co-artists in background",
      characterDialogue: dialogue,
      characterMovement: "Dynamic movement focused on action beat",
      characterEyeLooks: "[Eye Look: Laser Focus on Scene Target]",
      shotDurationAndImages: durationAndImagesStr,
      soundFxAndFoley: "[SFX: Environmental Foley & Acoustic Movement]",
      backgroundScoreMood: "[Score: Orchestral Cinematic Strings & Driving Percussion]",
      lensAndFocalLength: "50mm Master Prime (f/1.4) - Shallow Depth Bokeh",
      vfxCgiBreakdown: "[VFX: Practical Shot - In-Camera Production]",
      stuntAndSafetyNotes: "[Stunt: Standard Performer Safety Controls]",
      makeupAndHairStyle: "[Makeup: Authentic Cinema Grooming & Natural Sweat Glow]",
      editTransitionCut: "Hard Cut (Standard Scene Beat)",
      characterIdMatrix: matrixSlots.join(' | ')
    });
  });

  return parsedShots.map((s, idx) => normalizeShotTo26Crafts(s, idx, scriptText));
}

export async function generateScriptFromConcept(conceptPrompt, shotCount = 5) {
  const apiKey = getApiKey();
  const prompt = `Generate exactly ${shotCount} stage production shots as a JSON array for this creative concept: "${conceptPrompt}".
Each shot in the JSON array MUST contain all 26 canonical craft keys:
"sceneShotId", "sceneSynopsis", "shotComposition", "cameraMotionTag", "timeAndLightingEnv", "directionalLightingAndHighlight", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "colorPaletteSlot", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPsychologyState", "characterMannerismAndPosture", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength".

Return ONLY valid JSON array without markdown code blocks.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const parsed = safeParseJsonArray(responseText);
        if (parsed?.length) {
          return validateAndSanitizeShots(parsed, conceptPrompt);
        }
      }
    } catch (e) {
      console.warn("Google Gemini concept generator fallback:", e);
    }
  }

  return generateScriptFromConceptFallback(conceptPrompt, shotCount).map((s, idx) => normalizeShotTo26Crafts(s, idx, conceptPrompt));
}

function generateScriptFromConceptFallback(conceptPrompt, shotCount = 5) {
  const safePrompt = safeTrim(conceptPrompt);
  const shots = [];

  const compositions = [
    "Wide Shot (WS)", "Medium Close-Up (MCU)", "Extreme Close-Up (ECU)", 
    "Over-The-Shoulder (OTS)", "Cowboy Shot (American Shot)", "Dutch Angle Tilt", "Aerial Drone Sweep"
  ];

  const motions = [
    "[Camera: Slow Pan Right]", "[Camera: Push In / Slow Dolly Zoom]", "[Camera: Tracking Shot / Steadicam Follow]",
    "[Camera: Orbiting 360 around subject]", "[Camera: Crash Zoom in on eyes]", "[Camera: Tilt Up slowly]"
  ];

  const reactions = [
    "[Co-Artist: Backing performers reacting to main action]",
    "[Co-Artist: Secondary performer stepping up for dynamic response]",
    "[Co-Artist: Surrounding crowd watching intently]",
    "[Co-Artist: Companion offering supporting reaction in midground]"
  ];

  for (let i = 0; i < shotCount; i++) {
    const num = i + 1;
    const shotId = `SC01_SH${num < 10 ? '0' + num : num}`;

    shots.push({
      sceneShotId: shotId,
      shotComposition: compositions[i % compositions.length],
      cameraMotionTag: motions[i % motions.length],
      subjectLightingTag: i % 2 === 0 ? "[Lighting: Directional High-Contrast Sunbeams]" : "[Lighting: Rembrandt 3-Point Classic]",
      subjectColorTag: i % 2 === 0 ? "[Subject Color: High-Saturation Neo-Noir]" : "[Subject Color: Teal & Orange Cinema Palette]",
      backgroundLightingTag: "[BG Lighting: Soft Ambient Falloff]",
      backgroundColorTag: "[BG Color: Deep Midnight Blue & Indigo]",
      characterIdAssetRef: i % 2 === 0 ? "[CharID: @Lead_Character_A]" : "[CharID: @Lead_Character_B]",
      coArtistInteraction: reactions[i % reactions.length],
      actionEnvContext: `Sequence #${num} for concept: ${safePrompt}. Setting: ${safePrompt}.`,
      characterExpression: i % 2 === 0 ? "Focused intensity with eyes fixed on target" : "Fierce emotion and dramatic presence",
      characterPlacement: "Foreground center stage, co-artists positioned in midground left & right",
      characterDialogue: `"${safePrompt.substring(0, 25)}... Part ${num}"`,
      characterMovement: i % 2 === 0 ? "Stepping forward with purposeful stride" : "Turning sharply 45 degrees toward camera",
      characterEyeLooks: "[Eye Look: Direct Eye Contact with Camera Lens]"
    });
  }

  return shots;
}

export async function enhanceCraftSlotWithLLM(craftKey, currentValue, shotContext = {}) {
  const apiKey = getApiKey();
  const shotDesc = shotContext.actionEnvContext || shotContext.sceneShotId || 'Cinematic Shot';

  if (!apiKey) {
    const fallback = currentValue ? `[Enhanced] ${currentValue}` : `[Pedditi Labs Cinematic Preset for ${craftKey}]`;
    return autoEnhanceCraftValue(craftKey, fallback) || fallback;
  }

  if (apiKey) {
    try {
      const prompt = `You are a legendary Master Director & Cinematographer (Pedditi Labs Cinema Intelligence Engine).
Enhance the following film craft parameter for a cinema production script:
Craft Field: "${craftKey}"
Current Value: "${currentValue || ''}"
Shot Context: "${shotDesc}"

Return ONLY a concise, ultra-cinematic, production-ready descriptor string (max 25 words). Do NOT wrap in quotes or code blocks.`;

      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 });
      if (response && response.ok) {
        const data = await response.json();
        const text = safeTrim(extractGeminiResponseText(data));
        if (text) return text.replace(/^"|"$/g, '');
      }
    } catch (err) {
      console.warn("LLM craft enhancer fallback:", err);
    }
  }

  return currentValue ? `[Enhanced] ${currentValue}` : `[Pedditi Labs Cinematic Preset for ${craftKey}]`;
}

export async function enhanceEntireShotWithLLM(shot) {
  const apiKey = getApiKey();

  if (apiKey && shot) {
    try {
      const prompt = `You are a Master Film Director (Pedditi Labs Cinema Intelligence Engine).
Elevate the following shot into an ultra-cinematic masterpiece by enhancing all craft fields:
Current Shot JSON: ${JSON.stringify(shot)}

Return ONLY a valid JSON object representing the enhanced shot with the same 26 keys:
"sceneShotId", "shotComposition", "cameraMotionTag", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength", "vfxCgiBreakdown", "stuntAndSafetyNotes", "makeupAndHairStyle", "editTransitionCut", "characterIdMatrix".

Do NOT use markdown codeblocks. Return JSON object ONLY.`;

      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const parsed = safeParseJsonObject(responseText);
        if (parsed) {
          const merged = { ...shot, ...parsed, sceneShotId: shot.sceneShotId || parsed.sceneShotId };
          return normalizeShotTo26Crafts(merged, 0, shot.actionEnvContext || '');
        }
      }
    } catch (err) {
      console.warn("LLM shot enhancer fallback:", err);
    }
  }

  return shot ? normalizeShotTo26Crafts(shot, 0, shot.actionEnvContext || '') : shot;
}

export async function composeCharacterPersonaWithLLM(characterName, tag, role, rawNotes = '', shots = [], projectTitle = '') {
  const apiKey = getApiKey();

  const prompt = `You are a Master Screenwriter and Film Narrative Analyst for High-End Cinema.
Extract the COMPLETE story arc for character "${characterName}" from the following film script context ("${projectTitle}"):

Script Shots Context:
${JSON.stringify(shots, null, 2)}

Task: Extract their complete story arc, origins, core motivation, mannerisms, gait, voice texture, narrative connections, and scene presence purpose across this film script.

Return ONLY a valid JSON object with the following exact keys:
{
  "backstory": "An elaborate 4-5 sentence complete story arc detailing their origins, core trauma/oath, pivotal story conflict, and emotional driving force across the script.",
  "characterConnections": "Detailed narrative relationships with other co-performers and characters in the story.",
  "shotPurpose": "Explicit dramatic reason for their presence in scene beats across this project.",
  "mannerism": "Minute physical gestures, hand habits, posture tendencies, eye twitches or quirks.",
  "walkingStyle": "Detailed description of their gait, stride speed, posture balance, and physical presence while moving.",
  "dialogueDelivery": "Unique dialogue cadence, vocal rhythm, dialect accent, emotional inflection, and speaking habits.",
  "uniqueVoice": "Vocal pitch, acoustic texture, timbre, and resonance.",
  "outfit": "Signature costume design, fabrics, color palette, worn props, and visual grooming style."
}

Do NOT output markdown blocks or extra text. Return valid JSON ONLY.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("LLM character composition fallback:", err);
    }
  }

  return {
    backstory: rawNotes || `${characterName} is a complex ${role} with a rich history of sacrifice and unyielding determination in their journey.`,
    characterConnections: `Bound to allies by shared history, standing in opposition to hostile forces in the narrative.`,
    shotPurpose: `Drives the emotional focus and dramatic tension of the scene.`,
    mannerism: `Slow deliberate hand movements, subtle tilt of the chin during moments of high tension, calm dignified eye contact.`,
    walkingStyle: `Measured, heavy stride with commanding posture and unwavering center of gravity.`,
    dialogueDelivery: `Poetic cadence with deliberate pauses between key phrases, speaking with crisp emotional weight.`,
    uniqueVoice: `Resonant baritone with warm acoustic depth and clear articulation.`,
    outfit: `Signature cinematic costume tailored with authentic textures and period-accurate accessories.`
  };
}

export async function extractProjectCharactersWithLLM(shots = [], projectTitle = '') {
  const apiKey = getApiKey();

  const prompt = `You are a Lead Cinema Casting & Screenwriting Analyst.
Analyze the following film project script shots for "${projectTitle}":

Project Shots Data:
${JSON.stringify(shots, null, 2)}

Task: Extract ALL unique characters present in this project's script. Synthesize full, elaborate Character Bible profiles for EACH character found.

Return ONLY a valid JSON array of objects with the following exact keys for each character:
[
  {
    "id": "char_uniqueId",
    "tag": "@CharName_Tag",
    "name": "Full Character Name",
    "role": "Role (e.g., Lead Protagonist, Primary Antagonist, Supporting)",
    "backstory": "An elaborate 3-4 sentence backstory detailing their origins, core trauma/oath, and emotional driving force in the story.",
    "characterConnections": "Detailed narrative relationships with other characters in the story.",
    "shotPurpose": "Explicit dramatic reason for their presence in shots across this scene/project.",
    "mannerism": "Physical gestures, hand habits, posture tendencies, eye twitches or physical quirks.",
    "walkingStyle": "Detailed description of their gait, stride speed, posture balance, and physical presence while moving.",
    "dialogueDelivery": "Unique dialogue cadence, vocal rhythm, dialect accent, emotional inflection, and speaking habits.",
    "uniqueVoice": "Vocal pitch, acoustic texture, timbre, and resonance.",
    "outfit": "Signature costume design, fabrics, color palette, worn props, and visual grooming style."
  }
]

Do NOT output markdown blocks or extra text. Return valid JSON array ONLY.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("LLM character extraction fallback:", err);
    }
  }

  // Fallback local extraction from shots & screenplay text if API key is absent or offline
  const extractedMap = new Map();
  
  const scriptText = typeof window !== 'undefined' ? (localStorage.getItem('sps_live_screenplay_text') || localStorage.getItem('sps_current_screenplay_text') || '') : '';
  const safeScriptText = safeTrim(scriptText);
  const dialogueCharMatches = safeScriptText.match(/^[A-Z][A-Z\s]{2,15}$/gm) || [];
  
  const knownNameMap = new Map();
  dialogueCharMatches.forEach(rawName => {
    const clean = safeTrim(rawName);
    if (clean && !['ACT', 'EXT', 'INT', 'CUT TO', 'SHOT', 'SCENE', 'PART ONE', 'PART TWO'].includes(clean)) {
      const tag = `@${clean.replace(/\s+/g, '_')}`;
      if (!knownNameMap.has(tag)) {
        knownNameMap.set(tag, clean.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
    }
  });

  if (Array.isArray(shots)) {
    shots.forEach((shot) => {
      if (!shot || typeof shot !== 'object') return;
      const rawRef = shot.characterIdAssetRef || '';
      const mat = shot.characterIdMatrix || '';
      const combined = `${rawRef} ${mat}`;
      const tagMatches = combined.match(/@([A-Za-z0-9_]+)/g) || [];
      tagMatches.forEach(tag => {
        const name = tag.replace('@', '').replace(/_/g, ' ');
        if (!knownNameMap.has(tag)) {
          knownNameMap.set(tag, name);
        }
      });
    });
  }

  if (knownNameMap.size === 0) {
    knownNameMap.set('@Lead_Protagonist', 'Lead Protagonist');
    knownNameMap.set('@Primary_Antagonist', 'Primary Antagonist');
  }

  let idx = 0;
  knownNameMap.forEach((name, tag) => {
    const isHero = idx === 0;
    const isVillain = tag.toLowerCase().includes('antagonist') || tag.toLowerCase().includes('villain') || tag.toLowerCase().includes('rival');
    
    extractedMap.set(tag, {
      id: `char_${Date.now()}_${idx}`,
      tag: tag,
      name: name,
      role: isHero ? 'Lead Protagonist' : isVillain ? 'Primary Antagonist' : 'Supporting Character',
      backstory: `${name} is a key figure in the narrative, bound by personal conviction and driven by high-stakes dramatic motivation.`,
      characterConnections: `Interacts closely with lead performers and opposing forces across key scene beats.`,
      shotPurpose: `Anchors the emotional gravitas, dramatic tension, and cinematic focus of key scene beats.`,
      mannerism: `Calm, dignified posture; subtle tilt of the chin during intense focus; serene, unwavering gaze.`,
      walkingStyle: `Measured, rhythmic stride with perfect center of balance and quiet, fluid movements.`,
      dialogueDelivery: `Deep, poetic cadence delivered with steady authority and warm resonant depth.`,
      uniqueVoice: `Resonant baritone with warm acoustic depth.`,
      outfit: `Signature cinematic costume tailored with authentic textures and period-accurate accessories.`
    });
    idx++;
  });

  return Array.from(extractedMap.values());
}

export async function extractMasterScriptSynopsisWithLLM(fullScriptText = '') {
  const apiKey = getApiKey();
  const provider = getLlmProvider();

  const safeScriptText = safeTrim(fullScriptText);
  const scriptSnippet = safeScriptText.length > 30 
    ? safeScriptText.substring(0, 12000) 
    : 'A high-stakes cinematic screenplay.';

  const prompt = `You are a Hollywood Executive Story Editor and Master Script Consultant (Pedditi Labs Cinema Intelligence Engine).

Analyze the screenplay text below and extract an elaborate, production-ready 3-PARAGRAPH MASTER SCRIPT SYNOPSIS.

Screenplay Text:
${scriptSnippet}

REQUIREMENTS FOR PRODUCTION-READY SCRIPT SYNOPSIS:
1. PARAGRAPH 1 (PROLOGUE & PREMISE): Set up the cinematic world, time period, atmospheric setting, core protagonist(s), their emotional/spiritual status, and the initial calm before the storm.
2. PARAGRAPH 2 (RISING CONFLICT & INCITING INCIDENT): Describe the arrival of opposing forces/antagonist, the escalation of tension, high-stakes military or emotional conflict, key battle/drama beats, and the rising stakes facing the hero.
3. PARAGRAPH 3 (CLIMAX & RESOLUTION): Detail the dramatic peak, explosive confrontation, divine or heroic stand, resolution of the scene, and overarching thematic takeaway.

FORMAT RULES:
- Write in rich, vivid, professional Hollywood studio prose.
- Provide a full 3-paragraph executive synopsis (250 to 400 words total).
- Do NOT include markdown titles, headings, bullet points, or metadata prefixes.
- Return ONLY the clean multi-paragraph story text.`;

  if (apiKey) {
    try {
      if (provider === 'google_gemini' || provider === 'gemini') {
        const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 });
        if (response && response.ok) {
          const data = await response.json();
          const text = safeTrim(extractGeminiResponseText(data));
          if (text && text.length > 80) return text;
        }
      }

      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          const text = safeTrim(data.choices?.[0]?.message?.content);
          if (text && text.length > 80) return text;
        }
      }
    } catch (err) {
      console.warn("LLM master synopsis extraction error:", err);
    }
  }

  return synthesizeFallbackScriptSynopsis(scriptSnippet);
}

function synthesizeFallbackScriptSynopsis(scriptText) {
  const safeText = safeTrim(scriptText);
  const scenes = safeText.match(/(?:EXT\.|INT\.|SC\.\d+)[^\n]*/gi) || [];
  const sceneSummary = scenes.length > 0 ? scenes.slice(0, 4).join(' | ') : 'Panchavati Forest Clearing';
  
  return `ACT I: PROLOGUE & PREMISE
Set amidst the serene yet ominous wilderness of ${sceneSummary}, the story opens with an atmosphere of impending foreboding. As twilight settles over the sacred sanctuary, the serene divine presence of the protagonist stands as a beacon of order amidst shifting elemental mist. A quiet vigilance prevails as warning signs ripple across the landscape, foreshadowing an inevitable clash of cosmic powers.

ACT II: RISING CONFLICT & INCITING INCIDENT
The silence is shattered by the thunderous arrival of hostile vanguard forces. Armed with dark obsidian armor and burning war chariots, fourteen thousand formidable adversaries march onto the frontline under a scorching solar glow. Tensions escalate exponentially as battle lines are drawn, testing the protagonist's unyielding oath to protect the innocent against overwhelming demonic hordes.

ACT III: DRAMATIC CLIMAX & THEMATIC RESOLUTION
In an epic display of divine authority and martial mastery, the protagonist steps forward to face the entire invading host single-handedly. Flashing solar radiance and serene martial precision turn the tide of battle, vanquishing the demonic siege and establishing peace across the realm. The resolution reinforces the enduring triumph of righteous dharma over chaos.`;
}

export async function composeDirectorPsychologyWithLLM(projectTitle = '', shots = [], scriptText = '', projectDescription = '') {
  const apiKey = getApiKey();

  // Extract character names & scene context for project-specific prompt intelligence
  const charNamesSet = new Set();
  const sceneLocsSet = new Set();

  (shots || []).forEach(s => {
    const charRef = s.characterIdAssetRef || s.characterPresent || '';
    if (charRef && typeof charRef === 'string') {
      charRef.split(/,|\band\b|&|\|/i).forEach(c => {
        const cleaned = c.replace(/\[|\]|CharID:|@/gi, '').trim();
        if (cleaned && cleaned.length > 2 && !cleaned.toLowerCase().includes('environment') && !cleaned.toLowerCase().includes('shot') && !cleaned.toLowerCase().includes('lead_protagonist')) {
          charNamesSet.add(cleaned.replace(/_/g, ' '));
        }
      });
    }
    const env = s.actionEnvContext || s.environmentContext || s.sceneSynopsis || '';
    if (env) {
      sceneLocsSet.add(String(env).slice(0, 40));
    }
  });

  const charList = Array.from(charNamesSet);
  const charStr = charList.length > 0 ? charList.join(', ') : 'Central Characters';
  const locStr = Array.from(sceneLocsSet).slice(0, 5).join(' | ');

  const prompt = `You are an Acclaimed Feature Film Director, Narrative Theorist, and Master Cinema Strategist.
Analyze the project context for "${projectTitle}":

PROJECT LOGLINE / DESCRIPTION:
${projectDescription || 'N/A'}

SCREENPLAY CHARACTER ROSTER:
${charStr}

SCENE LOCATIONS & ENVIRONMENTS:
${locStr || 'N/A'}

REPRESENTATIVE SHOTS CONTEXT (${shots?.length || 0} Total Shots):
${JSON.stringify((shots || []).slice(0, 10).map(s => ({
  shotId: s.sceneShotId || s.id,
  character: s.characterIdAssetRef || s.characterPresent,
  environment: s.actionEnvContext || s.environmentContext,
  framing: s.shotComposition || s.framing,
  motion: s.cameraMotionTag || s.cameraMotion,
  action: s.actionEnvContext || s.screenplayActionLines,
  expression: s.characterExpression || s.characterExpressions
})), null, 2)}

RAW SCREENPLAY TEXT EXCERPT:
${(scriptText || '').slice(0, 1500)}

TASK: Extract and articulate the Director's Core Idea & Script Psychology Manifesto SPECIFICALLY for "${projectTitle}".
IMPORTANT INSTRUCTIONS:
- You MUST reference the specific project name ("${projectTitle}"), character names (${charStr}), and story beats!
- Do NOT output generic film school statements. Make it deeply unique to this specific movie!

Return ONLY a valid JSON object with these exact keys:
{
  "corePhilosophicalIdea": "Deep statement of the underlying philosophical soul beneath the making of ${projectTitle}, referencing characters (${charStr}) and narrative stakes.",
  "directorBeliefOfSuccess": "Analysis of why the director believes in the commercial & critical success of this script, its emotional hook, and audience dopamine connection.",
  "emotionalFrequencyTarget": "Subconscious emotional frequency, atmospheric color palette, and visceral atmosphere every shot must evoke.",
  "directorialRules": "5 key directorial production rules specifically for camera framing, lighting contrast ratios (chiaroscuro), character mindstates, and sound design."
}

Return valid JSON ONLY.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.15 });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const parsed = safeParseJsonObject(responseText);
        if (parsed && parsed.corePhilosophicalIdea) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn("LLM director psychology error:", err);
    }
  }

  // DYNAMIC PROJECT-SPECIFIC INTELLIGENCE SYNTHESIZER (FALLBACK)
  const title = (projectTitle || 'STAGE PRODUCTION').toUpperCase();
  const mainLead = charList[0] || 'the protagonist';
  const antagonist = charList[1] || 'the opposing forces';
  const fullTextContext = `${title} ${projectDescription} ${charStr} ${locStr} ${JSON.stringify((shots || []).slice(0, 10))}`.toLowerCase();

  let themeCore = '';
  let audienceHook = '';
  let emotionalFreq = '';
  let rules = [];

  if (fullTextContext.includes('ram') || fullTextContext.includes('dushan') || fullTextContext.includes('myth') || fullTextContext.includes('dharma') || fullTextContext.includes('lanka') || fullTextContext.includes('forest') || fullTextContext.includes('divine') || fullTextContext.includes('epic')) {
    themeCore = `At its core, "${title}" explores the psychological confrontation between divine righteousness (Dharma) and destructive hubris. Beneath the mythic spectacle, the film centers on ${mainLead}'s internal moral burden while confronting ${antagonist} amidst atmospheric, high-tension battlefield consequences in ${locStr || 'ancient lands'}.`;
    audienceHook = `The director believes in the explosive success of "${title}" because it fuses rich epic lore with hyper-visceral, modern 4K anamorphic cinema. Audiences are hooked by ${mainLead}'s intense psychological resilience and the mythic stakes of good triumphing over chaos.`;
    emotionalFreq = `Sacred grandeur, high-tension adrenaline, and visceral awe balanced with serene spiritual clarity and golden chiaroscuro radiance.`;
    rules = [
      `1. Light ${mainLead} with golden rim lighting to emphasize mythic stature against dark backgrounds.`,
      `2. Frame confrontation shots with low-angle 24mm anamorphic lenses for hyper-dramatic scale.`,
      `3. Maintain heavy atmospheric dust motes and volumetric ember particles across ${locStr || 'the environment'}.`,
      `4. Direct character performances from internal psychological resolve rather than simple facial reactions.`,
      `5. Align bass-heavy sound drops with slow-motion martial impacts and weapon reveals.`
    ];
  } else if (fullTextContext.includes('cyber') || fullTextContext.includes('sci-fi') || fullTextContext.includes('neon') || fullTextContext.includes('future') || fullTextContext.includes('space') || fullTextContext.includes('ai')) {
    themeCore = `At its core, "${title}" investigates the erosion of human identity in a hyper-technological dystopia. The narrative probes whether ${mainLead} can retain authentic human empathy while navigating systemic betrayal and digital control alongside ${charStr}.`;
    audienceHook = `The director believes in the breakthrough success of "${title}" due to its neon-drenched visual pulse and high-concept psychological tension. It satisfies audience demand for cerebral sci-fi combined with lightning-fast kinetic action.`;
    emotionalFreq = `Dystopian foreboding, neon-soaked melancholy, and pulse-pounding synthetic tension.`;
    rules = [
      `1. Use cyan and magenta dual-tone illumination across reflective rainy surfaces in ${locStr || 'city settings'}.`,
      `2. Capture tight optical close-ups on character eye glances to reflect digital interfaces.`,
      `3. Utilize rapid anamorphic rack focuses to shift tension between ${mainLead} and ${antagonist}.`,
      `4. Emphasize metallic reflections, holographic haze, and dark optical contrast.`,
      `5. Layer synthesizer soundscapes with sharp industrial sound effects.`
    ];
  } else if (fullTextContext.includes('horror') || fullTextContext.includes('dark') || fullTextContext.includes('shadow') || fullTextContext.includes('terror') || fullTextContext.includes('ghost') || fullTextContext.includes('demon')) {
    themeCore = `At its core, "${title}" manifests fear as a physical entity born from guilt, grief, and unexpressed trauma. The story follows ${mainLead}'s harrowing descent into darkness while trying to survive ${antagonist}.`;
    audienceHook = `The director believes in the terrifying success of "${title}" because it operates on deep subconscious dread rather than cheap jump scares. The psychological claustrophobia keeps the audience in relentless suspense.`;
    emotionalFreq = `Suffocating dread, cold psychological isolation, and explosive visceral shock.`;
    rules = [
      `1. Keep shadows pitch-black (underexposed by -2 EV) to force viewer scrutiny into darkness.`,
      `2. Use slow, creeping camera dollies to build unbearable atmospheric tension around ${locStr || 'the interior'}.`,
      `3. Isolate ${mainLead} in wide negative space to evoke vulnerability.`,
      `4. Limit key lighting to flickering single-source lamps or moonlight.`,
      `5. Employ discordant sub-bass drones and sudden eerie silences.`
    ];
  } else {
    themeCore = `At its core, "${title}" explores the raw emotional cost of power, survival, and personal truth. The narrative focuses on ${mainLead}'s pivotal choice when cornered by overwhelming odds alongside ${charStr}.`;
    audienceHook = `The director believes in the strong commercial & critical success of "${title}" because it anchors relatable human stakes within an immersive, visually captivating cinematic scope across ${shots?.length || 0} sequence shots.`;
    emotionalFreq = `High-voltage emotional intensity, raw authenticity, and cathartic dramatic resolution.`;
    rules = [
      `1. Maintain strict 35mm anamorphic depth of field to keep emotional focus sharp on ${mainLead}.`,
      `2. Use naturalistic chiaroscuro key lighting with subtle warm fill.`,
      `3. Drive camera movement organically with character motion and emotional shifts in ${locStr || 'scene'}.`,
      `4. Emphasize micro-expressions, posture mannerisms, and eye contact tension.`,
      `5. Anchor scene transitions with ambient sound design and rhythmic score cues.`
    ];
  }

  return {
    corePhilosophicalIdea: themeCore,
    directorBeliefOfSuccess: audienceHook,
    emotionalFrequencyTarget: emotionalFreq,
    directorialRules: rules.join('\n')
  };
}

export async function composeHybridVisionMergeWithLLM(projectTitle = '', humanVision = {}, aiVision = {}) {
  const apiKey = getApiKey();
  const prompt = `You are a Master Creative Director & Cinema Synthesizer.
Project: "${projectTitle}"

HUMAN DIRECTOR'S VISION NOTES:
- Core Philosophical Idea: ${humanVision?.corePhilosophicalIdea || 'N/A'}
- Director Belief of Success: ${humanVision?.directorBeliefOfSuccess || 'N/A'}
- Emotional Target Frequency: ${humanVision?.emotionalFrequencyTarget || 'N/A'}
- Directorial Rules: ${humanVision?.directorialRules || 'N/A'}

AI SYNTHESIZED INTEL VISION:
- Core Philosophical Idea: ${aiVision?.corePhilosophicalIdea || 'N/A'}
- Director Belief of Success: ${aiVision?.directorBeliefOfSuccess || 'N/A'}
- Emotional Target Frequency: ${aiVision?.emotionalFrequencyTarget || 'N/A'}
- Directorial Rules: ${aiVision?.directorialRules || 'N/A'}

Task: Intelligently merge the Human Director's personal artistic voice with the AI's deep analytical script intelligence to construct the ultimate MASTER HYBRID VISION.

Return ONLY a valid JSON object with these exact keys:
{
  "corePhilosophicalIdea": "Seamlessly synthesized thematic core incorporating the human director's soul with AI narrative subtext.",
  "directorBeliefOfSuccess": "Fused strategic belief of success combining human director passion and AI psychological hook analysis.",
  "emotionalFrequencyTarget": "Master emotional frequency target incorporating human atmospheric intent and AI subconscious tuning.",
  "directorialRules": "Synthesized 5 master directorial production rules combining human style rules and AI technical guidelines."
}
Return valid JSON ONLY.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.15 });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("LLM hybrid vision merge error:", err);
    }
  }

  // Fallback intelligent merge logic
  return {
    corePhilosophicalIdea: `${humanVision?.corePhilosophicalIdea || ''}\n\n[AI SYNTHESIS ENHANCEMENT]: ${aiVision?.corePhilosophicalIdea || ''}`.trim(),
    directorBeliefOfSuccess: `${humanVision?.directorBeliefOfSuccess || ''}\n\n[AI PSYCHOLOGICAL HOOK]: ${aiVision?.directorBeliefOfSuccess || ''}`.trim(),
    emotionalFrequencyTarget: `${humanVision?.emotionalFrequencyTarget || ''} | ${aiVision?.emotionalFrequencyTarget || ''}`.trim(),
    directorialRules: `${humanVision?.directorialRules || ''}\n\n[AI DIRECTORIAL INTEL RULES]:\n${aiVision?.directorialRules || ''}`.trim()
  };
}

// ----------------------------------------------------------------------
// DoP (Cinematography) Vision Vault LLM Synthesis Engine
// ----------------------------------------------------------------------
export async function composeDoPVisionWithLLM(project = {}) {
  const apiKey = getApiKey();
  const { title = 'Stage Production', rawScript = '', shots = [] } = project;

  const prompt = `You are an Academy-Award winning Director of Photography (DoP) & Master Cinematographer.
Project Title: "${title}"
Script Context: ${rawScript ? rawScript.substring(0, 1000) : 'Epic Cinematic Feature'}

Task: Generate an authoritative, high-end Cinematography Vision for the DoP Vault.

Return ONLY a valid JSON object with these 4 keys:
{
  "lightingPhilosophy": "Authoritative lighting & chiaroscuro contrast philosophy tailored specifically for this film.",
  "cameraMovementEnergy": "Camera motion language (e.g. Snorricam tracking, fluid Steadicam, crane rise) suited for the narrative tempo.",
  "colorScienceTexture": "Color grading science, LUT choices, ISO film grain, and saturation palette.",
  "lensAspectRules": "Specific lens profiles (e.g. 24mm anamorphic wide, f/1.4 aperture, T-stop settings) and framing rules."
}
Return valid JSON ONLY.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.2 });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.lightingPhilosophy) return parsed;
        }
      }
    } catch (err) {
      console.warn("LLM DoP vision synthesis error:", err);
    }
  }

  // Dynamic fallback synthesis for DoP
  return {
    lightingPhilosophy: `High-contrast chiaroscuro key lighting with directional tungsten rim beams. Deep negative fill (-2 EV shadow falloff) creating dramatic sculptural depth across character features in "${title}".`,
    cameraMovementEnergy: `Dynamic kinetic tracking shots balanced with stately low-angle crane pushes. Fluid Steadicam motion anchoring character momentum during high-tension beats.`,
    colorScienceTexture: `Custom filmic Kodak 5219 LUT profile with deep sodium amber highlights, rich cyan darks, and subtle 35mm grain texture at ISO 800.`,
    lensAspectRules: `1. Primary glass: 24mm & 35mm anamorphic prime lenses for expansive wide framing.\n2. Shallow depth of field (T1.9) for intimate character close-ups.\n3. Maintain strict 2.39:1 widescreen frame composition.`
  };
}

export async function composeHybridDoPVisionMergeWithLLM(projectTitle = '', humanDoP = {}, aiDoP = {}) {
  return {
    lightingPhilosophy: `${humanDoP?.lightingPhilosophy || ''}\n\n[AI CINEMATOGRAPHY ENHANCEMENT]: ${aiDoP?.lightingPhilosophy || ''}`.trim(),
    cameraMovementEnergy: `${humanDoP?.cameraMovementEnergy || ''}\n\n[AI CAMERA MOTION INTEL]: ${aiDoP?.cameraMovementEnergy || ''}`.trim(),
    colorScienceTexture: `${humanDoP?.colorScienceTexture || ''} | ${aiDoP?.colorScienceTexture || ''}`.trim(),
    lensAspectRules: `${humanDoP?.lensAspectRules || ''}\n\n[AI LENS & FRAMING RULES]:\n${aiDoP?.lensAspectRules || ''}`.trim()
  };
}

// ----------------------------------------------------------------------
// Music Director & Sound Designer Vault LLM Synthesis Engine
// ----------------------------------------------------------------------
export async function composeSoundVisionWithLLM(project = {}) {
  const apiKey = getApiKey();
  const { title = 'Stage Production', rawScript = '' } = project;

  const prompt = `You are a Master Film Composer & Lead Sound Designer.
Project Title: "${title}"
Script Context: ${rawScript ? rawScript.substring(0, 1000) : 'Epic Cinematic Feature'}

Task: Generate a master Musical Motif & Sound Design Vision for the Music & Sound Vault.

Return ONLY a valid JSON object with these 4 keys:
{
  "musicalMotifScore": "Core musical score theme, instrument choices, sonic leitmotifs, and orchestral scale.",
  "foleySoundEnvironment": "Atmospheric soundscape, foley weight, environmental reverberation, and texture.",
  "vocalDialogueResonance": "Dialogue delivery mindstate, vocal frequency EQ, acoustic reverberation, and presence.",
  "rhythmTempoSync": "Rhythmic pacing, score crescendo drops, silence placement, and audio-visual cut synchronization rules."
}
Return valid JSON ONLY.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.2 });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.musicalMotifScore) return parsed;
        }
      }
    } catch (err) {
      console.warn("LLM Sound vision synthesis error:", err);
    }
  }

  // Dynamic fallback synthesis for Sound & Music
  return {
    musicalMotifScore: `Thunderous brass ostinatos layered with haunting ancient vocal chants and sub-bass synthesizer pulses tailored for "${title}".`,
    foleySoundEnvironment: `Visceral, heavy tactile foley—hyper-detailed metallic rain impacts, deep cavernous ambient reverb, and atmospheric wind pressure.`,
    vocalDialogueResonance: `Gravelly low-frequency voice resonance with intimate proximity effect for dialogue, balanced with wide spatial stereo decay.`,
    rhythmTempoSync: `1. Drop musical cues precisely on visual focal cuts.\n2. Utilize sudden sub-bass silences before major action impacts.\n3. Accelerate tempo to 140 BPM during high-intensity sequences.`
  };
}

export async function composeHybridSoundVisionMergeWithLLM(projectTitle = '', humanSound = {}, aiSound = {}) {
  return {
    musicalMotifScore: `${humanSound?.musicalMotifScore || ''}\n\n[AI SCORE MOTIF ENHANCEMENT]: ${aiSound?.musicalMotifScore || ''}`.trim(),
    foleySoundEnvironment: `${humanSound?.foleySoundEnvironment || ''}\n\n[AI AUDITORY ATMOSPHERE]: ${aiSound?.foleySoundEnvironment || ''}`.trim(),
    vocalDialogueResonance: `${humanSound?.vocalDialogueResonance || ''} | ${aiSound?.vocalDialogueResonance || ''}`.trim(),
    rhythmTempoSync: `${humanSound?.rhythmTempoSync || ''}\n\n[AI AUDIO-VISUAL SYNC RULES]:\n${aiSound?.rhythmTempoSync || ''}`.trim()
  };
}

export async function synthesizeFullAppElementsFromScript(scriptText, projectTitle = '', shots = []) {
  if (!shots || shots.length === 0) {
    shots = await parseRawScriptToShots(scriptText);
  }

  const detectedGenre = detectScriptGenre(projectTitle, shots, scriptText);
  
  // 1. Synthesize Character Bibles
  let characters = [];
  try {
    characters = await extractProjectCharactersWithLLM(shots, projectTitle);
  } catch (e) {
    console.warn("Character auto-synthesis error:", e);
  }

  // 2. Synthesize Director's Core Vision & Script Psychology
  let directorPsychology = null;
  try {
    directorPsychology = await composeDirectorPsychologyWithLLM(projectTitle, shots, scriptText);
  } catch (e) {
    console.warn("Director psychology auto-synthesis error:", e);
  }

  // 3. Synthesize DoP Vision Vault
  let dopVision = null;
  try {
    dopVision = await composeDoPVisionWithLLM({ title: projectTitle, shots, scriptText });
  } catch (e) {
    console.warn("DoP vision auto-synthesis error:", e);
  }

  // 4. Synthesize Sound & Music Vision Vault
  let soundVision = null;
  try {
    soundVision = await composeSoundVisionWithLLM({ title: projectTitle, shots, scriptText });
  } catch (e) {
    console.warn("Sound vision auto-synthesis error:", e);
  }

  return {
    shots,
    detectedGenre,
    characters,
    directorPsychology: directorPsychology ? {
      activeVisionTab: 'ai',
      compilerActiveMode: 'AI_LLM',
      human: directorPsychology,
      ai: directorPsychology,
      hybrid: directorPsychology
    } : null,
    dopVision: dopVision ? {
      activeVisionTab: 'ai',
      compilerActiveMode: 'AI_LLM',
      human: dopVision,
      ai: dopVision,
      hybrid: dopVision
    } : null,
    soundVision: soundVision ? {
      activeVisionTab: 'ai',
      compilerActiveMode: 'AI_LLM',
      human: soundVision,
      ai: soundVision,
      hybrid: soundVision
    } : null
  };
}
