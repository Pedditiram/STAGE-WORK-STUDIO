import { detectScriptGenre } from '../constants/seedancePresets';
import { getCinematicReferences, formatReferencesForLLM } from '../constants/cinematicReferences';
import {
  joinPdfTextItems,
  repairTeluguPdfText
} from '../utils/repairTeluguPdfText';
import { resolveLlmApiKey } from '../utils/saasControl';
import { composeLookFacts, buildReferenceSheetsFromFacts, shotsMentionWeaponForPerson, storyLooksIndianEpic } from '../utils/characterSheetLock';
import { ensureShotSpecMeta } from '../utils/shotSpec';
import { PRODUCTION_ORIGIN } from '../utils/runtimeEnv';
import { importFdx } from '../utils/screenplayInterop';

function safeTrim(str) {
  if (str == null) return '';
  return String(str).trim();
}

function getApiKey() {
  if (typeof window === 'undefined') return '';
  return safeTrim(resolveLlmApiKey(getLlmProvider()) || localStorage.getItem('sps_api_key'));
}

function getLlmProvider() {
  if (typeof window === 'undefined') return 'google_gemini';
  return safeTrim(localStorage.getItem('sps_llm_provider')) || 'google_gemini';
}

function isBuiltInLlm(provider = getLlmProvider()) {
  const key = safeTrim(provider).toLowerCase();
  return key === 'built_in' || key === 'builtin' || key === 'offline';
}

function isGeminiLlmProvider(provider = getLlmProvider()) {
  const key = safeTrim(provider).toLowerCase();
  if (!key || isBuiltInLlm(key)) return false;
  return key === 'gemini' || key.startsWith('google_gemini');
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

export function isParseAbortError(err) {
  if (!err) return false;
  if (err.code === 'LLM_TIMEOUT' || err.name === 'TimeoutError') return false;
  return Boolean(
    err.name === 'AbortError' ||
      err.code === 'PARSE_ABORTED' ||
      /aborted|The operation was aborted/i.test(String(err.message || ''))
  );
}

export function assertParseNotAborted(signal) {
  if (signal?.aborted) {
    const err = new Error('Parse stopped by user.');
    err.name = 'AbortError';
    err.code = 'PARSE_ABORTED';
    throw err;
  }
}

function makeParseAbortError() {
  const err = new Error('Parse stopped by user.');
  err.name = 'AbortError';
  err.code = 'PARSE_ABORTED';
  return err;
}

function makeLlmTimeoutError(timeoutMs) {
  const err = new Error(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s`);
  err.name = 'TimeoutError';
  err.code = 'LLM_TIMEOUT';
  return err;
}

/** Exported so tests can prove timeout ≠ user abort without a 55s wait. */
export async function fetchWithTimeout(url, options = {}, timeoutMs = LLM_TIMEOUT_MS) {
  const external = options.signal;
  if (external?.aborted) throw makeParseAbortError();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const onExternalAbort = () => {
    try {
      controller?.abort();
    } catch (_) {
      /* ignore */
    }
  };
  if (external && controller) {
    external.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = controller
    ? setTimeout(() => {
        timedOut = true;
        try {
          controller.abort();
        } catch (_) {
          /* ignore */
        }
      }, timeoutMs)
    : null;
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller ? controller.signal : external
    });
    return res;
  } catch (e) {
    if (external?.aborted) throw makeParseAbortError();
    if (timedOut) throw makeLlmTimeoutError(timeoutMs);
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
    if (external && controller) external.removeEventListener('abort', onExternalAbort);
  }
}

export async function fetchWithRetry(url, options = {}, { timeoutMs = LLM_TIMEOUT_MS, retries = LLM_MAX_RETRIES } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      assertParseNotAborted(options.signal);
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
      if (options.signal?.aborted || (isParseAbortError(e) && e?.code === 'PARSE_ABORTED')) {
        throw makeParseAbortError();
      }
      lastErr = e?.code === 'LLM_TIMEOUT' ? e : e;
      if (e?.name === 'AbortError' && e?.code !== 'PARSE_ABORTED') {
        lastErr = makeLlmTimeoutError(timeoutMs);
      }
    }
    if (attempt < retries) {
      const backoff = Math.min(4000, 600 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, backoff));
      assertParseNotAborted(options.signal);
    }
  }
  throw lastErr || new Error('LLM request failed');
}

/** Extract and parse JSON array from LLM text; repair truncated trailing commas / fences. */
function unwrapShotArrayFromObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > 3) return null;
  const bags = [obj.shots, obj.data, obj.result, obj.items, obj.breakdown, obj.payload, obj.response, obj.content];
  for (const inner of bags) {
    if (Array.isArray(inner) && inner.length) return inner;
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      if (Array.isArray(inner.shots) && inner.shots.length) return inner.shots;
      const nested = unwrapShotArrayFromObject(inner, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export function safeParseJsonArray(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = cleaned.indexOf('[');
  const objStart = cleaned.indexOf('{');
  if (objStart !== -1 && (start === -1 || objStart < start)) {
    const wrapped = unwrapShotArrayFromObject(safeParseJsonObject(cleaned));
    if (wrapped) return wrapped;
  }
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

  const closed = closeUnterminatedJsonStrings(candidate);
  parsed = tryParse(closed);
  if (parsed) return parsed;

  // Truncation repair: close open braces/brackets and strip trailing commas
  let repaired = closeUnterminatedJsonStrings(candidate)
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

  if (objStart !== -1 && objStart < start) {
    const wrapped = unwrapShotArrayFromObject(safeParseJsonObject(cleaned));
    if (wrapped) return wrapped;
  }

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

/** Validate LLM shot objects, normalize crafts, dedupe IDs, cap at 600 (feature expand). */
export function validateAndSanitizeShots(rawShots, scriptText = '') {
  if (!Array.isArray(rawShots) || rawShots.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (let idx = 0; idx < rawShots.length && out.length < 600; idx++) {
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
    out.push(ensureShotSpecMeta(normalized));
  }
  return out;
}

export function missingApiKeyMessage() {
  return 'No API key set. Open Settings and add a key. Offline breakdown will be used until a key is available.';
}

export function classifyLlmFailureCode(errOrMessage) {
  const code = errOrMessage && typeof errOrMessage === 'object' ? errOrMessage.code : '';
  if (code === 'LLM_TIMEOUT' || code === 'PARSE_ABORTED') return code;
  const msg = String(errOrMessage?.message || errOrMessage || '');
  if (/timed out/i.test(msg)) return 'LLM_TIMEOUT';
  if (/aborted|stopped by user/i.test(msg)) return 'PARSE_ABORTED';
  if (!msg.trim()) return 'LLM_EMPTY';
  return 'LLM_FAILED';
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
      // One public worker (scripts/sync-pdfjs-assets.mjs) — skip Vite ?url duplicate in dist/assets.
      pdfjsLib.GlobalWorkerOptions.workerSrc = publicAssetUrl('pdf.worker.min.mjs');
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Prefer same-origin /api/extract-pdf (Vercel serverless + Vite local middleware).
 * Electron file:// falls back to the production extract API.
 */
function getPdfExtractApiUrl() {
  if (typeof window === 'undefined') return `${PRODUCTION_ORIGIN}/api/extract-pdf`;
  try {
    const { protocol, origin } = window.location;
    if (protocol === 'http:' || protocol === 'https:') {
      return `${origin}/api/extract-pdf`;
    }
  } catch (e) {}
  return `${PRODUCTION_ORIGIN}/api/extract-pdf`;
}

/**
 * Server-side pdfjs-legacy extract (reliable for styled / CID font PDFs like Kara-Dhushan).
 * Returns text or null if unavailable — never throws for network blips.
 */
async function extractTextFromPDFViaServer(file, originalArrayBuffer, { signal } = {}) {
  assertParseNotAborted(signal);
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  try {
    const pdfBase64 = arrayBufferToBase64(originalArrayBuffer);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const onExternalAbort = () => {
      try { controller?.abort(); } catch { /* ignore */ }
    };
    if (signal && controller) signal.addEventListener('abort', onExternalAbort, { once: true });
    const timer = controller ? setTimeout(() => controller.abort(), 55000) : null;
    const res = await fetch(getPdfExtractApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfBase64,
        fileName: file?.name || 'script.pdf'
      }),
      signal: controller?.signal || signal,
      cache: 'no-store'
    });
    if (timer) clearTimeout(timer);
    if (signal && controller) signal.removeEventListener('abort', onExternalAbort);
    assertParseNotAborted(signal);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success && data?.text && looksLikeUsableScriptText(data.text)) {
      return safeTrim(repairTeluguPdfText(data.text));
    }
    // Propagate definitive server codes so UI can show the right message
    if (data?.code === 'NO_TEXT_LAYER' || data?.code === 'PDF_GARBAGE' || data?.code === 'TOO_LARGE') {
      throw new PdfExtractError(data.code, PDF_EXTRACT_MESSAGES[data.code] || data.error || PDF_EXTRACT_MESSAGES.PARSE_FAILED);
    }
    console.warn('[PDF] Server extract unavailable:', res.status, data?.error || data?.code);
    return null;
  } catch (e) {
    if (e instanceof PdfExtractError) throw e;
    if (isParseAbortError(e) || signal?.aborted) {
      const err = new Error('Parse stopped by user.');
      err.name = 'AbortError';
      err.code = 'PARSE_ABORTED';
      throw err;
    }
    console.warn('[PDF] Server extract failed, will try browser pdf.js:', e?.message || e);
    return null;
  }
}

/**
 * Extract selectable text from a PDF File/Blob.
 * Throws PdfExtractError on scanned/empty/garbage/parse failure — never returns PDF binary noise.
 * Prefer Vercel /api/extract-pdf (Node pdfjs-legacy); fall back to in-browser pdf.js.
 */
export async function extractTextFromPDF(file, options = {}) {
  const signal = options.signal;
  assertParseNotAborted(signal);
  if (!file) {
    throw new PdfExtractError('EMPTY', PDF_EXTRACT_MESSAGES.EMPTY);
  }

  const originalArrayBuffer = await file.arrayBuffer();
  assertParseNotAborted(signal);
  if (!originalArrayBuffer || originalArrayBuffer.byteLength === 0) {
    throw new PdfExtractError('EMPTY', PDF_EXTRACT_MESSAGES.EMPTY);
  }
  if (originalArrayBuffer.byteLength > PDF_MAX_BYTES) {
    throw new PdfExtractError('TOO_LARGE', PDF_EXTRACT_MESSAGES.TOO_LARGE);
  }

  // 0) Server extract first — fixes browser false NO_TEXT_LAYER on text-layer PDFs
  const serverText = await extractTextFromPDFViaServer(file, originalArrayBuffer, { signal });
  if (serverText) return serverText;

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
      assertParseNotAborted(signal);
      try {
        const loadingTask = pdfjsLib.getDocument(attempt.options);
        const pdf = await loadingTask.promise;
        const result = await extractPagesTextFromPdfObj(pdf, { signal });
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

const HEURISTIC_SLUGLINE_RE =
  /(?:^|\n)\s*(?:\d{1,3}[.)]?\s*)?(?:INT\.?|EXT\.?|INT\/EXT|I\/E|EST\.?|సీన్|దృశ్యం|SCENE\s+\d+|SC\.?\s*\d+)/gi;

/**
 * Cap offline heuristic cards so garbage PDFs / bible dumps cannot flood the Matrix preview.
 * Sluglined screenplays scale with scene count; Fountain-only scenes scale with cues; prose dumps stay ≤80.
 */
export function heuristicShotBudget(scriptText) {
  const t = String(scriptText || '');
  if (!safeTrim(t)) return 0;
  const slugs = (t.match(HEURISTIC_SLUGLINE_RE) || []).length;
  const cueLines = t.split('\n').filter((line) => isFountainCharacterCue(line)).length;
  const paras = t.split(/\n\s*\n/).filter((p) => safeTrim(p).length >= 12).length;
  if (slugs >= 1) return Math.min(400, Math.max(8, slugs * 8, cueLines + slugs));
  if (cueLines >= 1) return Math.min(400, Math.max(8, cueLines * 2));
  return Math.min(80, Math.max(4, paras || 4));
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

export async function extractPagesTextFromPdfObj(pdf, { signal } = {}) {
  const extractedPagesText = [];
  let pagesWithText = 0;
  let totalTextItems = 0;
  let rawCharCount = 0;
  const pageCount = pdf?.numPages || 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    assertParseNotAborted(signal);
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent({
        includeMarkedContent: true,
        disableCombineTextItems: false
      });

      const items = textContent.items || [];
      let pageRawChars = 0;
      let pageTextItems = 0;
      for (const item of items) {
        if (!item || typeof item.str !== 'string') continue;
        pageTextItems += 1;
        totalTextItems += 1;
        pageRawChars += item.str.length;
        rawCharCount += item.str.length;
      }

      if (pageRawChars > 0) pagesWithText += 1;

      const pageText = joinPdfTextItems(items);
      let cleanPageText = pageText;
      if (/[\u0C00-\u0C7F]/.test(pageText)) {
        // Geometry join already repaired Telugu — avoid aggressive Latin sanitize wiping script
        cleanPageText = repairTeluguPdfText(pageText);
      } else {
        const heavy = sanitizePdfExtractedText(pageText);
        cleanPageText = safeTrim(heavy) || lightSanitizePdfExtractedText(pageText);
      }
      cleanPageText = scrubScreenplayChrome(cleanPageText);
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
  'gemini-flash-latest'
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
  if (!data || typeof data !== 'object') return 'Parser returned an empty response.';
  const block = data.promptFeedback?.blockReason || data.promptFeedback?.block_reason;
  if (block) {
    return `Prompt blocked (safety / policy: ${block}).`;
  }
  const candidates = data.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return 'Parser returned no candidates (empty or filtered response).';
  }
  const finish = candidates[0]?.finishReason || candidates[0]?.finish_reason;
  if (finish && /SAFETY|RECITATION|BLOCKLIST|PROHIBITED|OTHER/i.test(String(finish))) {
    return `Parser stopped without usable text (finishReason: ${finish}).`;
  }
  const text = extractGeminiResponseText(data);
  if (!safeTrim(text)) {
    return finish
      ? `Parser returned no usable text (finishReason: ${finish}).`
      : 'Parser returned no usable text.';
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
  const modelHint = '';

  if (status === 429 || /RESOURCE_EXHAUSTED|QUOTA|RATE[_\s-]?LIMIT/.test(blob)) {
    return `API quota / rate limit exhausted${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
  }
  if (status === 401 || status === 403 || /API[_ ]?KEY[_ ]?INVALID|PERMISSION_DENIED|UNAUTHENTICATED/.test(blob)) {
    return `Invalid or unauthorized API key${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
  }
  if (status === 404 || /NOT_FOUND|is not found|not supported for generateContent/i.test(`${apiMsg} ${bodyText}`)) {
    return `Model not found or unavailable${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
  }
  if (status === 400) {
    return `Request rejected (HTTP 400)${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
  }
  return `API error HTTP ${status || 'network'}${modelHint}${apiMsg ? `: ${apiMsg}` : ''}`;
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
    const err = new Error('Missing API key.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const provider = options.provider || getLlmProvider();
  if (isBuiltInLlm(provider)) {
    const err = new Error('Built-In engine does not call a cloud LLM.');
    err.code = 'BUILT_IN';
    throw err;
  }
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
        body,
        signal: options.signal
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
      if (isParseAbortError(e) || options.signal?.aborted) throw e;
      lastError = e?.message || String(e);
      if (e?.code === 'LLM_TIMEOUT') lastFatal = false;
      console.warn('Gemini API endpoint attempt failed:', lastError);
      if (/quota|rate limit|RESOURCE_EXHAUSTED/i.test(lastError)) {
        lastFatal = true;
        break;
      }
    }
  }

  const err = new Error(lastError || 'Parser did not return a usable response.');
  err.code = lastFatal ? 'GEMINI_FATAL' : 'GEMINI_UNAVAILABLE';
  err.provider = provider;
  err.modelId = cfg.modelId;
  throw err;
}

/** INT/EXT (optional leading scene number, glued `12.INT` OK) plus Fountain transitions. */
const SLUGLINE_START =
  /^(?:\d{1,3}[.)]?\s*)?(?:INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?|EST\.?|FADE IN|FADE OUT|CUT TO|SMASH CUT|DISSOLVE TO|MATCH CUT)\b/i;
const TRANSITION_ONLY_RE =
  /^(?:FADE (?:IN|OUT|TO BLACK|TO WHITE)|CUT TO(?: BLACK)?|SMASH CUT|DISSOLVE TO(?: BLACK)?|MATCH CUT|WIPE TO|BACK TO(?: SCENE)?)\s*[:.]?\s*$/i;
const NUMBERED_SCENE_SLUG_RE =
  /^\s*(?:SC(?:ENE)?\.?\s*)?(\d{1,3})\s*[.)]?\s*(?:INT|EXT|I\/E|INT\/EXT|EST)\b/i;
const FOUNTAIN_NOT_CUE_RE =
  /^(MORE|CONT'?D|CONTINUED|THE END|END OF|OMITTED|NIGHT|DAY|DAWN|DUSK|LATER|PRESENT|CAST)$/i;

/** Strip BOM / zero-width and convert Final Draft XML to Fountain-like text. */
export function prepareScriptTextForParse(scriptText) {
  let t = String(scriptText ?? '');
  t = t.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/<FinalDraft\b/i.test(t) || (/<Paragraph\b/i.test(t) && /<Text\b/i.test(t))) {
    try {
      t = importFdx(t);
    } catch {
      t = t.replace(/<[^>]+>/g, '\n');
    }
  }
  if (/[\u0C00-\u0C7F]/.test(t)) {
    t = repairTeluguPdfText(t);
  }
  t = scrubScreenplayChrome(t);
  return t.trim();
}

/** Drop Fountain chrome, PDF hyphen wraps, and page-number debris before parse. */
export function scrubScreenplayChrome(text) {
  let s = String(text || '');
  s = s.replace(/\u00AD/g, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '\n');
  s = s.replace(/\[\[[\s\S]*?\]\]/g, '');
  s = s.replace(/([A-Za-z\u0C00-\u0C7F])-\s*\n\s*([A-Za-z\u0C00-\u0C7F])/g, '$1$2');
  s = s.replace(/^[ \t]*={3,}[ \t]*$/gm, '');
  s = s.replace(/^[ \t]*[-–—]?\s*\d{1,3}\s*[-–—][ \t]*$/gm, '');
  s = s.replace(/^[ \t]*\(\s*\d{1,3}\s*\)[ \t]*$/gm, '');
  s = s.replace(/^[ \t]*(?:page\s+)?\d{1,3}(?:\s+of\s+\d{1,3})?[.)]?[ \t]*$/gim, '');
  s = s.replace(/^[ \t]*\(?(?:MORE|CONTINUED)\)?[ \t]*:?[ \t]*$/gim, '');
  return s.replace(/\n{3,}/g, '\n\n');
}

/** Close a truncated JSON string so a cut-off LLM payload can still parse. */
export function closeUnterminatedJsonStrings(raw) {
  const s = String(raw || '');
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    }
  }
  return inStr ? `${s}"` : s;
}

export const LLM_PARSE_CHUNK_CHARS = 28000;
export const LLM_PARSE_MAX_CHUNKS = 8;

/** Split a long screenplay on scene headings so LLM parse stays inside context. */
export function splitScreenplayForLlmParse(scriptText, maxChars = LLM_PARSE_CHUNK_CHARS) {
  const text = String(scriptText || '');
  if (!text) return [];
  if (text.length <= maxChars) return [text];
  const sceneBits = text.split(
    /(?=\n(?:\d{1,3}[.)]?\s*)?(?:INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?|EST\.?|SCENE\s+\d+|SC\.\s*\d+|FADE IN)\b)/i
  );
  const parts = [];
  let buf = '';
  const push = (chunk) => {
    const t = String(chunk || '').trim();
    if (t) parts.push(t);
  };
  for (const bit of sceneBits) {
    if (!bit) continue;
    if (!buf) {
      buf = bit;
      continue;
    }
    if (buf.length + bit.length <= maxChars) {
      buf += bit;
      continue;
    }
    push(buf);
    if (bit.length <= maxChars) {
      buf = bit;
      continue;
    }
    for (let i = 0; i < bit.length && parts.length < LLM_PARSE_MAX_CHUNKS; i += maxChars) {
      push(bit.slice(i, i + maxChars));
    }
    buf = '';
  }
  push(buf);
  if (parts.length <= 1 && text.length > maxChars) {
    const hard = [];
    for (let i = 0; i < text.length && hard.length < LLM_PARSE_MAX_CHUNKS; i += maxChars) {
      hard.push(text.slice(i, i + maxChars));
    }
    return hard;
  }
  return parts.slice(0, LLM_PARSE_MAX_CHUNKS);
}

function buildShotParsePrompt(screenplaySlice, { part = 1, total = 1 } = {}) {
  const partNote =
    total > 1
      ? `\nThis is PART ${part} of ${total} of the screenplay. Parse ONLY this part. Do not invent scenes from other parts. Continue sceneShotId numbering from the headings in this part.\n`
      : '';
  return `You are a Hollywood Technical Director and Master Cinematographer (Stage Work Studio Cinema Intelligence Engine).
Parse the following screenplay script into a complete JSON array of 26-craft stage production shots.
${partNote}
NATIVE TELUGU & MULTILINGUAL SCRIPT DIRECTIVE:
1. The input screenplay text may be written in Telugu Script (Unicode: తెలుగు), Transliterated/Romanized Telugu, English, or a mix of Telugu & English (Tollywood Screenplay Format).
2. Carefully analyze Telugu scene headings, Telugu character names (e.g. రాముడు, లక్ష్మణుడు, సీత, దుషణుడు), and Telugu dialogue — then map them into the 26-craft shot schema.
3. DIALOGUE ONLY IN TELUGU: Preserve authentic spoken lines in 'characterDialogue' exactly as written (Telugu Unicode or transliterated Telugu). Do NOT translate dialogue into English.
4. CHARACTER NAMES ALWAYS IN ENGLISH: In EVERY craft field that names a person/role — especially 'characterIdAssetRef', 'characterIdMatrix', 'coArtistInteraction', 'characterPlacement', 'sceneSynopsis', 'actionEnvContext', and any speaker cue inside dialogue formatting — use standard English spellings (e.g. Rama, Lakshmana, Sita, Dushana, Surpanakha). Never leave Telugu-script names in those fields. Prefer industry-familiar English forms (Lord Rama, not రాముడు).
5. ALL OTHER CRAFT FIELDS IN ENGLISH: Translate camera, lighting, composition, score, lens, VFX, psychology, movement, and synopsis into clean, high-end Hollywood English so AI Image & Video engines can process them seamlessly.
6. In 'characterIdMatrix', use short 1-to-3 word ENGLISH character/asset tags (e.g. Image_1 = Rama | Image_2 = Sita | Image_3 = Dushana).

CRITICAL DIRECTIVE: Carefully analyze the screenplay text. Identify every scene and shot explicitly or implicitly defined in the document. Map each shot accurately. Do NOT skip, omit, or invent shots beyond what is in the screenplay.

CRITICAL REQUIREMENT FOR 'sceneShotId': Each shot object MUST specify 'sceneShotId' accurately reflecting its Scene Number and Shot Number formatted strictly as SC<SceneNo>_SH<ShotNo> (e.g. SC01_SH01, SC01_SH02, SC02_SH01). Track Scene numbers and shot numbers sequentially based on the screenplay structure.

Each shot object in the JSON array MUST strictly contain all 26 canonical craft keys:
"sceneShotId", "sceneSynopsis", "shotComposition", "cameraMotionTag", "timeAndLightingEnv", "directionalLightingAndHighlight", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "colorPaletteSlot", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPsychologyState", "characterMannerismAndPosture", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength", "vfxCgiBreakdown", "stuntAndSafetyNotes", "makeupAndHairStyle", "editTransitionCut", "characterIdMatrix".

In "characterIdMatrix", specify the ComfyUI Seedance 2.0 multi-modal reference slots formatted as:
"Image_1 = [char/subject 1] | Image_2 = [char/subject 2] | Image_3 = [char/subject 3] | Image_4 = [char 4] | Image_5 = crowd | Image_6 = scene | Image_7 = | Image_8 = | Image_9 = "

CRITICAL REQUIREMENT FOR 'characterIdMatrix': Use ONLY short, concise 1-to-3 word ENGLISH Character/Asset Names (e.g. 'Lord Rama', 'Dushana', 'John', 'Sarah'). Never Telugu script. Do NOT put long action descriptions inside 'characterIdMatrix'. Only include characters actually present in this specific shot.

OPTIONAL dialogue format tip: You may prefix Telugu lines with an English speaker cue, e.g. Rama: "నీవు ఎవరు?" — speaker name English, quoted line Telugu.

Screenplay text to break down:
${screenplaySlice}

Return ONLY valid JSON array without markdown code blocks.`;
}

/** Fountain character cue: ALL CAPS name on its own line (no trailing colon required). */
export function isFountainCharacterCue(line) {
  const t = safeTrim(line);
  if (!t || t.length > 40) return false;
  if (SLUGLINE_START.test(t) || TRANSITION_ONLY_RE.test(t)) return false;
  if (/^(ACT\s|SCENE\s|SHOT\s|PART\s|TITLE:|SUPER:|MONTAGE)/i.test(t)) return false;
  const stripped = t
    .replace(/\s*\^$/, '')
    .replace(/\s*\((?:CONT'?D|CONTINUED|V\.O\.|O\.S\.|OS|VO|OFF)\)\s*$/i, '')
    .trim();
  if (FOUNTAIN_NOT_CUE_RE.test(stripped)) return false;
  if (!/^[A-Z][A-Z0-9 .'\-]{1,36}$/.test(stripped)) return false;
  const letters = stripped.replace(/[^A-Z]/g, '');
  if (letters.length < 2 || letters.length > 28) return false;
  if (stripped.split(/\s+/).filter(Boolean).length > 6) return false;
  return true;
}

/** Finished screenplay (sluglines, shot tags, or Fountain speakers) — not a director brief. */
export function looksLikeScreenplayForParse(text) {
  const t = safeTrim(text);
  if (!t) return false;
  if (/^(?:\d{1,3}[.)]?\s*)?(?:INT\.?|EXT\.?|INT\/EXT|I\/E|EST\.?|FADE IN)/im.test(t)) return true;
  if (/^(సీన్|దృశ్యం)\s*\d/m.test(t)) return true;
  if (/\bSC\d{2}_SH|\bSHOT\s*\d+|\[SHOT\s*S/i.test(t)) return true;
  const cues = t.split(/\n/).filter((line) => isFountainCharacterCue(line)).length;
  if (cues >= 2) return true;
  if (cues >= 1 && /\n\([^)]{2,48}\)\n/.test(t)) return true;
  return false;
}

export function isPremiseBrief(text) {
  const t = safeTrim(text);
  if (!t) return false;
  if (looksLikeScreenplayForParse(t)) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  const hasHeadings = /^(?:\d{1,3}[.)]?\s*)?(?:INT\.?|EXT\.?|INT\/EXT|I\/E|EST\.?|FADE IN)/im.test(t);
  const hasShotTags = /\bSC\d{2}_SH|\bSHOT\s*\d+|\[SHOT\s*S/i.test(t);
  if (hasHeadings && t.length > 2800) return false;
  if (hasShotTags && t.length > 1800) return false;
  if (/\b(\d+\s*(?:hour|hr)s?|complete story|birth to death|make (?:a |this )?(?:feature|movie|film)|expand (?:this|into)|full (?:length|feature)|break(?:down)? (?:into|this))\b/i.test(t)) {
    return true;
  }
  return words < 380 || t.length < 2200;
}

export function inferRuntimeMinutes(text) {
  const t = safeTrim(text);
  const hours = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (hours) return Math.round(Math.min(240, Math.max(40, parseFloat(hours[1]) * 60)));
  const mins = t.match(/(\d+)\s*(?:minutes?|mins?)\b/i);
  if (mins) return Math.round(Math.min(240, Math.max(40, parseInt(mins[1], 10))));
  return 150;
}

async function completeLlmText(prompt, { temperature = 0.22, maxOutputTokens = 65536, timeoutMs = 120000, signal } = {}) {
  assertParseNotAborted(signal);
  const apiKey = getApiKey();
  const provider = getLlmProvider();
  if (!apiKey || isBuiltInLlm(provider)) return '';

  if (isGeminiLlmProvider(provider)) {
    const response = await fetchGeminiContent(
      apiKey,
      prompt,
      { temperature, maxOutputTokens },
      { provider, timeoutMs, retries: 1, signal }
    );
    assertParseNotAborted(signal);
    if (!response?.ok) return '';
    const data = await response.json();
    return extractGeminiResponseText(data) || '';
  }

  if (provider === 'anthropic' || provider.startsWith('anthropic')) {
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
        max_tokens: Math.min(8192, maxOutputTokens),
        temperature,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal
    }, { timeoutMs, retries: 1 });
    assertParseNotAborted(signal);
    if (!res?.ok) return '';
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  if (provider === 'openai') {
    const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', temperature, messages: [{ role: 'user', content: prompt }] }),
      signal
    }, { timeoutMs, retries: 1 });
    assertParseNotAborted(signal);
    if (!res?.ok) return '';
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  return '';
}

async function fetchSelectedLlmShotJson(prompt, { provider, apiKey, signal } = {}) {
  assertParseNotAborted(signal);
  if (!apiKey || isBuiltInLlm(provider)) return { parsed: null, error: 'MISSING_API_KEY' };

  const parseBody = (text) => safeParseJsonArray(text);

  if (provider === 'anthropic' || String(provider || '').startsWith('anthropic')) {
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
      }),
      signal
    });
    if (!res?.ok) return { parsed: null, error: `API error HTTP ${res?.status}. Check your API key in Settings.` };
    const data = await res.json();
    const parsed = parseBody(data.content?.[0]?.text || '');
    return parsed?.length
      ? { parsed, error: null }
      : { parsed: null, error: 'Parser returned invalid or empty shot JSON.' };
  }

  if (provider === 'openai') {
    const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal
    });
    if (!res?.ok) return { parsed: null, error: `API error HTTP ${res?.status}. Check your API key in Settings.` };
    const data = await res.json();
    const parsed = parseBody(data.choices?.[0]?.message?.content || '');
    return parsed?.length
      ? { parsed, error: null }
      : { parsed: null, error: 'Parser returned invalid or empty shot JSON.' };
  }

  const isNvidiaKey = Boolean(apiKey && apiKey.startsWith('nvapi-'));
  if (provider === 'minimax' || provider === 'nvidia_minimax' || provider === 'minimax_m3' || isNvidiaKey) {
    const res = await fetchWithRetry('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'minimaxai/minimax-m3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096
      }),
      signal
    });
    if (!res?.ok) return { parsed: null, error: `API error HTTP ${res?.status}. Check your API key in Settings.` };
    const data = await res.json();
    const parsed = parseBody(data.choices?.[0]?.message?.content || '');
    return parsed?.length
      ? { parsed, error: null }
      : { parsed: null, error: 'Script parser returned invalid or empty shot JSON.' };
  }

  if (isGeminiLlmProvider(provider)) {
    const geminiCfg = resolveGeminiLlmConfig(provider);
    const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1, maxOutputTokens: 65536 }, { provider, signal });
    if (!response?.ok) return { parsed: null, error: 'Parser did not return a usable response.' };
    const data = await response.json();
    const issue = describeGeminiResponseIssue(data);
    const parsed = parseBody(extractGeminiResponseText(data));
    return parsed?.length
      ? { parsed, error: null, source: geminiCfg.modelId || 'google_gemini' }
      : { parsed: null, error: issue || 'Parser returned invalid or empty shot JSON.' };
  }

  return { parsed: null, error: 'LLM parse unavailable.' };
}

function sequencesToFountain(title, premise, sequences = []) {
  const lines = [
    `Title: ${title || 'UNTITLED'}`,
    `Credit: expanded from a director brief`,
    '',
    `/* BRIEF */`,
    premise,
    ''
  ];
  sequences.forEach((seq) => {
    const loc = (seq.locations && seq.locations[0]) || seq.title || 'LOCATION';
    const time = seq.timeOfDay || 'DAY';
    const heading = String(loc).toUpperCase().startsWith('INT') || String(loc).toUpperCase().startsWith('EXT')
      ? loc
      : `EXT. ${loc} - ${time}`;
    lines.push(heading);
    lines.push('');
    lines.push(seq.synopsis || seq.dramaticBeat || seq.title || '');
    if (Array.isArray(seq.characters) && seq.characters.length) {
      lines.push('');
      lines.push(`Present: ${seq.characters.join(', ')}`);
    }
    lines.push('');
  });
  return lines.join('\n');
}

function expandPremiseHeuristic(premise) {
  const minutes = inferRuntimeMinutes(premise);
  const seqN = Math.min(24, Math.max(12, Math.round(minutes / 8)));
  const hook = clip(premise, 180);
  const shots = [];
  for (let s = 1; s <= seqN; s++) {
    const per = 4;
    for (let h = 1; h <= per; h++) {
      shots.push({
        sceneShotId: formatSceneShotId(s, h),
        sceneSynopsis: `${hook} — Sequence ${s} of ${seqN}, coverage ${h}.`,
        shotComposition: h === 1 ? 'Extreme Wide Shot (EWS)' : h === 2 ? 'Medium Shot (MS)' : h === 3 ? 'Close-Up (CU)' : 'Over-the-Shoulder (OTS)',
        cameraMotionTag: '[Camera: Slow Dolly / Motivated Track]',
        timeAndLightingEnv: '[Timing: Epic period] • [Env: Mythic landscape]',
        actionEnvContext: `Cinematic world implied by: ${hook}`,
        characterIdAssetRef: '[CharID: @LeadHero]',
        characterDialogue: '',
        characterExpression: 'Held dramatic presence',
        characterMovement: 'Advances through the beat',
        shotDurationAndImages: 'Duration: 6s'
      });
    }
  }
  return validateAndSanitizeShots(shots, premise);
}

async function expandPremiseToFeatureShots(premise, { onProgress, signal } = {}) {
  assertParseNotAborted(signal);
  const minutes = inferRuntimeMinutes(premise);
  const seqTarget = Math.min(24, Math.max(14, Math.round(minutes / 8)));
  const shotsPerSeq = minutes >= 160 ? 10 : minutes >= 120 ? 8 : 6;
  const tick = (percent, message) => {
    try { onProgress?.({ percent, message }); } catch { /* ignore */ }
  };

  tick(8, `Expanding ${minutes}-minute feature into ${seqTarget} sequences…`);

  const seqPrompt = `You are a Hollywood showrunner + Indian epic film writer (Rajamouli / Mani Ratnam grammar, not a chatbot).

DIRECTOR BRIEF (this is NOT a finished screenplay — invent the full picture):
"""
${premise.slice(0, 4000)}
"""

Task: Expand this brief into a COMPLETE ${minutes}-minute theatrical feature.
Return ONLY a JSON array of exactly ${seqTarget} sequence objects. Keys:
"seq" (1..${seqTarget}), "title", "minutes" (integers summing near ${minutes}), "timeOfDay", "locations" (string array), "characters" (English names), "synopsis" (90-140 words), "dramaticBeat".

Cover birth-to-end if the brief asks. No skipped decades. English names. Locations specific. Return JSON array only.`;

  let sequences = [];
  try {
    const seqText = await completeLlmText(seqPrompt, { temperature: 0.35, maxOutputTokens: 16384, signal });
    sequences = safeParseJsonArray(seqText) || [];
  } catch (e) {
    if (isParseAbortError(e)) throw e;
    console.warn('Feature sequence expand failed:', e);
  }
  assertParseNotAborted(signal);
  sequences = (sequences || []).filter((s) => s && (s.synopsis || s.title)).slice(0, seqTarget);
  if (sequences.length < 8) {
    return expandPremiseHeuristic(premise);
  }

  tick(18, `Sequences locked (${sequences.length}). Breaking coverage into 26-craft shots…`);

  const allShots = [];
  const batchSize = 2;
  const batches = [];
  for (let i = 0; i < sequences.length; i += batchSize) batches.push(sequences.slice(i, i + batchSize));

  for (let b = 0; b < batches.length; b++) {
    assertParseNotAborted(signal);
    const batch = batches[b];
    const startSeq = batch[0]?.seq || b * batchSize + 1;
    tick(
      18 + Math.round((b / batches.length) * 72),
      `Coverage ${b + 1}/${batches.length} · sequences ${batch.map((s) => s.seq || s.title).join(', ')}`
    );

    const shotPrompt = `You are a Master Cinematographer filling Stage Work Studio 26-craft shot rows.

FEATURE: ${minutes} minutes from this brief:
"""
${premise.slice(0, 1200)}
"""

SEQUENCES TO COVER NOW (write ${shotsPerSeq} shots PER sequence, chronological, no montage dumping entire life into one shot):
${JSON.stringify(batch, null, 2)}

Each shot MUST include sceneShotId as SC{seq padded 2}_SH{shot padded 2} (e.g. SC07_SH03) matching the sequence "seq" number.
Each shot MUST include ALL keys:
"sceneShotId", "sceneSynopsis", "shotComposition", "cameraMotionTag", "timeAndLightingEnv", "directionalLightingAndHighlight", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "colorPaletteSlot", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPsychologyState", "characterMannerismAndPosture", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength", "vfxCgiBreakdown", "stuntAndSafetyNotes", "makeupAndHairStyle", "editTransitionCut", "characterIdMatrix".

Rules:
- Character names ENGLISH. Dialogue may be Telugu if the brief is Telugu/Indian epic.
- Each craft field: 8-28 words. Photoreal cinema. Period-accurate if epic.
- characterIdMatrix: Image_1 = Name | Image_2 = Name (short English names only).
- Return ONLY a JSON array of shots.`;

    try {
      const shotText = await completeLlmText(shotPrompt, { temperature: 0.2, maxOutputTokens: 65536, timeoutMs: 120000, signal });
      const parsed = safeParseJsonArray(shotText) || [];
      parsed.forEach((raw, i) => {
        allShots.push({
          ...raw,
          sceneShotId: sanitizeSceneShotId(raw?.sceneShotId, allShots.length + i)
        });
      });
    } catch (e) {
      if (isParseAbortError(e)) throw e;
      console.warn(`Feature shot batch ${b + 1} failed:`, e);
    }
  }

  let shots = validateAndSanitizeShots(allShots, premise);
  if (shots.length < 12) shots = expandPremiseHeuristic(premise);

  const fountain = sequencesToFountain('Feature expand', premise, sequences);
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_current_screenplay_text', fountain);
      localStorage.setItem('sps_live_screenplay_text', fountain);
      localStorage.setItem('sps_extracted_master_story', sequences.map((s) => s.synopsis).filter(Boolean).slice(0, 6).join('\n\n'));
      window.dispatchEvent(new CustomEvent('sps_screenplay_updated', { detail: { source: 'feature_expand' } }));
    }
  } catch { /* ignore */ }

  tick(96, `Sanitized ${shots.length} shots. Filling consoles…`);
  setParseMeta({
    source: 'feature_expand',
    usedFallback: false,
    warning: null,
    error: null,
    shotCount: shots.length,
    provider: getLlmProvider(),
    hasApiKey: true,
    runtimeMinutes: minutes,
    sequenceCount: sequences.length,
    sequences: sequences.map((s) => ({ ...s })),
    screenplayText: fountain
  });
  return shots;
}

function clip(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * PARSE RAW SCRIPT TO 26 PRODUCTION CRAFTS
 * Uses low temperature (0.1) across all LLM providers for deterministic results.
 * Always returns a shot array (may be empty). Call getLastParseMeta() for warnings.
 */
export async function parseRawScriptToShots(scriptText, options = {}) {
  try {
    return await parseRawScriptToShotsUnsafe(scriptText, options);
  } catch (err) {
    if (isParseAbortError(err)) throw err;
    const fallbackShots = parseRawScriptFallback(prepareScriptTextForParse(scriptText) || String(scriptText || ''));
    setParseMeta({
      source: 'fallback',
      usedFallback: true,
      warning: `Parser recovered from an internal error (${err?.message || 'unknown'}). Offline heuristic breakdown used.`,
      error: 'PARSE_CRASH',
      shotCount: fallbackShots.length,
      provider: getLlmProvider(),
      hasApiKey: Boolean(getApiKey())
    });
    return fallbackShots;
  }
}

async function parseRawScriptToShotsUnsafe(scriptText, options = {}) {
  const provider = getLlmProvider();
  const apiKey = isBuiltInLlm(provider) ? '' : getApiKey();
  const onProgress = options.onProgress;
  const signal = options.signal;
  assertParseNotAborted(signal);

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

  const trimmed = prepareScriptTextForParse(scriptText);
  if (!trimmed) {
    setParseMeta({
      source: 'empty',
      usedFallback: false,
      warning: 'Script text is empty after import cleanup. Paste a screenplay or upload PDF/TXT/FDX/Fountain.',
      error: 'EMPTY_SCRIPT',
      shotCount: 0,
      provider,
      hasApiKey: Boolean(apiKey)
    });
    return [];
  }
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

  if (isPremiseBrief(trimmed)) {
    if (isBuiltInLlm(provider) || !apiKey) {
      const shots = expandPremiseHeuristic(trimmed);
      setParseMeta({
        source: isBuiltInLlm(provider) ? 'built_in_expand' : 'fallback',
        usedFallback: !isBuiltInLlm(provider),
        warning: apiKey ? null : 'No API key — expanded a skeleton feature. Add Gemini in Settings for a full 3-hour breakdown.',
        error: apiKey ? null : 'MISSING_API_KEY',
        shotCount: shots.length,
        provider,
        hasApiKey: Boolean(apiKey)
      });
      return shots;
    }
    return expandPremiseToFeatureShots(trimmed, { onProgress, signal });
  }

  const fullTextToProcess = trimmed.slice(0, 180000);

  const finalizeLlmShots = (parsed, sourceLabel, extraMeta = {}) => {
    const shots = validateAndSanitizeShots(parsed, trimmed);
    if (shots.length === 0) return null;
    setParseMeta({
      source: sourceLabel,
      usedFallback: false,
      warning: extraMeta.warning || null,
      error: null,
      shotCount: shots.length,
      provider,
      hasApiKey: true,
      parseParts: extraMeta.parseParts || 1
    });
    return shots;
  };

  let llmError = null;

  if (isBuiltInLlm(provider)) {
    const fallbackShots = parseRawScriptFallback(trimmed);
    setParseMeta({
      source: 'built_in',
      usedFallback: false,
      warning: null,
      error: null,
      shotCount: fallbackShots.length,
      provider: 'built_in',
      hasApiKey: false
    });
    return fallbackShots;
  }

  if (apiKey) {
    const chunks = splitScreenplayForLlmParse(fullTextToProcess);
    const merged = [];
    let sourceLabel = provider;
    try {
      for (let i = 0; i < chunks.length; i += 1) {
        assertParseNotAborted(signal);
        try {
          onProgress?.({
            percent: Math.round(((i + 0.15) / chunks.length) * 88),
            message: chunks.length > 1 ? `Parsing screenplay part ${i + 1} of ${chunks.length}…` : 'Parsing screenplay…'
          });
        } catch {
          /* ignore */
        }
        const prompt = buildShotParsePrompt(chunks[i], { part: i + 1, total: chunks.length });
        const result = await fetchSelectedLlmShotJson(prompt, { provider, apiKey, signal });
        if (result.source) sourceLabel = result.source;
        if (result.parsed?.length) merged.push(...result.parsed);
        else llmError = result.error || llmError;
      }
      if (merged.length) {
        const shots = finalizeLlmShots(merged, sourceLabel, {
          parseParts: chunks.length,
          warning: chunks.length > 1 ? `Parsed in ${chunks.length} parts.` : null
        });
        if (shots) return shots;
      }
    } catch (e) {
      if (isParseAbortError(e)) throw e;
      llmError = e?.message || 'Parser request failed.';
      console.warn('LLM breakdown fallback:', e);
    }
  }

  assertParseNotAborted(signal);

  // Fallback / Built-In Fast Universal Heuristic Rule Parser
  const fallbackShots = parseRawScriptFallback(trimmed);
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
    error: apiKey ? classifyLlmFailureCode(llmError) : 'MISSING_API_KEY',
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
  if (val.includes('Pedditi Labs') || val.includes('Stage Work Studio') || val.includes('Enhanced') || val.includes('—')) {
    return val;
  }
  if (/Needs Direction/i.test(val)) return val;

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

export function ensureShotDurationCraft(value) {
  const raw = String(value || '').trim();
  if (/\b\d+(?:\.\d+)?\s*s(ec|ecs|econd)?\b/i.test(raw) || /\bDuration\s*:/i.test(raw)) return raw || 'Duration: 6s';
  if (!raw) return 'Duration: 6s';
  return `Duration: 6s | ${raw}`;
}

export function normalizeShotTo26Crafts(shot, index = 0, defaultText = '') {
  if (!shot || typeof shot !== 'object') shot = {};

  const shotId = shot.sceneShotId || `SC01_SH${(index + 1) < 10 ? '0' + (index + 1) : (index + 1)}`;
  const leadChar = shot.characterIdAssetRef || '[Needs Direction: unnamed subject]';
  const dialogue = shot.characterDialogue || '[Needs Direction: no spoken line]';
  const actionContext = shot.actionEnvContext || defaultText || 'Cinematic stage production scene beat.';

  const rawShotComposition = shot.shotComposition || 'Medium Shot (MS)';
  const rawCameraMotionTag = shot.cameraMotionTag || '[Needs Direction: hold]';
  const rawTimeAndLightingEnv = shot.timeAndLightingEnv || '[Needs Direction]';
  const rawDirectionalLightingAndHighlight = shot.directionalLightingAndHighlight || '[Needs Direction]';
  const rawSubjectLightingTag = shot.subjectLightingTag || '[Needs Direction: lighting]';
  const rawSubjectColorTag = shot.subjectColorTag || '[Needs Direction: subject color]';
  const rawBackgroundLightingTag = shot.backgroundLightingTag || '[Needs Direction: background light]';
  const rawBackgroundColorTag = shot.backgroundColorTag || '[Needs Direction: background color]';
  const rawColorPaletteSlot = shot.colorPaletteSlot || '[Needs Direction: palette]';
  const rawAtmosphereVolumetricsTag = shot.atmosphereVolumetricsTag || '[Needs Direction: atmosphere]';
  const rawCharacterExpression = shot.characterExpression || '[Needs Direction: expression]';
  const rawCharacterPsychologyState = shot.characterPsychologyState || '[Needs Direction: mindstate]';
  const rawCharacterMannerismAndPosture = shot.characterMannerismAndPosture || '[Needs Direction: mannerism]';
  const rawCharacterPlacement = shot.characterPlacement || '[Needs Direction: placement]';
  const rawCharacterMovement = shot.characterMovement || '[Needs Direction: hold]';
  const rawCharacterEyeLooks = shot.characterEyeLooks || '[Needs Direction: eye look]';
  const rawSoundFxAndFoley = shot.soundFxAndFoley || '[Needs Direction: sfx]';
  const rawBackgroundScoreMood = shot.backgroundScoreMood || '[Needs Direction: score]';
  const rawLensAndFocalLength = shot.lensAndFocalLength || '[Needs Direction: lens]';

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
    coArtistInteraction: shot.coArtistInteraction || '[Needs Direction: no co-artist]',
    actionEnvContext: actionContext,
    characterExpression: autoEnhanceCraftValue('characterExpression', rawCharacterExpression),
    characterPsychologyState: autoEnhanceCraftValue('characterPsychologyState', rawCharacterPsychologyState),
    characterMannerismAndPosture: autoEnhanceCraftValue('characterMannerismAndPosture', rawCharacterMannerismAndPosture),
    characterPlacement: autoEnhanceCraftValue('characterPlacement', rawCharacterPlacement),
    characterDialogue: dialogue,
    characterMovement: autoEnhanceCraftValue('characterMovement', rawCharacterMovement),
    characterEyeLooks: autoEnhanceCraftValue('characterEyeLooks', rawCharacterEyeLooks),
    shotDurationAndImages: ensureShotDurationCraft(shot.shotDurationAndImages),
    soundFxAndFoley: autoEnhanceCraftValue('soundFxAndFoley', rawSoundFxAndFoley),
    backgroundScoreMood: autoEnhanceCraftValue('backgroundScoreMood', rawBackgroundScoreMood),
    lensAndFocalLength: autoEnhanceCraftValue('lensAndFocalLength', rawLensAndFocalLength),
    // Additional production craft metadata
    vfxCgiBreakdown: shot.vfxCgiBreakdown || '[Needs Direction: vfx]',
    stuntAndSafetyNotes: shot.stuntAndSafetyNotes || '[Needs Direction: stunt]',
    makeupAndHairStyle: shot.makeupAndHairStyle || '[Needs Direction: makeup]',
    editTransitionCut: shot.editTransitionCut || '[Needs Direction: cut]',
    characterIdMatrix: shot.characterIdMatrix || 'Image_1 = scene | Image_2 = environment'
  };
}

function segmentFountainBeats(scriptText) {
  const lines = safeTrim(scriptText).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let buf = [];
  const flush = () => {
    const t = safeTrim(buf.join('\n'));
    if (t.length >= 4) blocks.push(t);
    buf = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = safeTrim(line);
    if (TRANSITION_ONLY_RE.test(trimmed)) {
      flush();
      continue;
    }
    if (isFountainCharacterCue(line)) {
      flush();
      buf.push(line);
      i += 1;
      while (i < lines.length) {
        const nxt = lines[i];
        if (isFountainCharacterCue(nxt) || SLUGLINE_START.test(safeTrim(nxt))) {
          i -= 1;
          break;
        }
        buf.push(nxt);
        i += 1;
      }
      flush();
      continue;
    }
    if (SLUGLINE_START.test(trimmed) && trimmed.length < 90) {
      flush();
      buf.push(line);
      flush();
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();
  return blocks;
}

function extractFountainFromBlock(block) {
  const lines = String(block || '').split('\n').map((l) => safeTrim(l));
  const names = [];
  const spoken = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!isFountainCharacterCue(lines[i])) continue;
    const name = lines[i]
      .replace(/\s*\^$/, '')
      .replace(/\s*\(.*\)\s*$/, '')
      .trim();
    if (name && !names.includes(name)) names.push(name);
    const parts = [];
    let j = i + 1;
    while (j < lines.length && !isFountainCharacterCue(lines[j]) && !SLUGLINE_START.test(lines[j])) {
      const ln = lines[j];
      if (/^\(.*\)$/.test(ln)) {
        j += 1;
        continue;
      }
      if (ln) parts.push(ln);
      j += 1;
    }
    if (parts.length) spoken.push(`${name}: "${parts.join(' ')}"`);
  }
  return { names, dialogue: spoken.join('\n') };
}

function smartSegmentTextIntoShots(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  const cleanScript = safeTrim(scriptText).replace(/\r\n/g, '\n');
  const fountainCues = cleanScript.split('\n').filter((line) => isFountainCharacterCue(line)).length;
  if (fountainCues >= 2 || (fountainCues >= 1 && /\n\([^)]{2,48}\)\n/.test(cleanScript))) {
    const beats = segmentFountainBeats(cleanScript);
    if (beats.length) return beats;
  }

  // Regex splitting by Scene Headers, Shot Headers, or Paragraph Breaks
  const segmentRegex = /(?:\n\s*)+(?=(?:SC\.\s*\d+|SC\s*\d+|SCENE\s*\d+|సీన్\s*\d+|దృశ్యం\s*\d+|BLOCK\s*[-:\s]?\d+|BLOCK\b|PART\s*\d+|1st\s+half|2nd\s+half|INTERMISSION|(?:\d{1,3}[.)]?\s*)?(?:EXT\.?|INT\.?|INT\/EXT\.?|I\/E\.?|EST\.?)|SHOT\s*\d+|SHOT\b|SH\d+|S\d{1,2}-[A-Z0-9]+|\[SHOT|\[Camera:))/i;

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
  let intExtSlugCount = 0;

  rawBlocks.forEach((block) => {
    if (!block || typeof block !== 'string') return;
    const cleanBlock = safeTrim(block);

    // Skip empty or PDF stream noise
    if (cleanBlock.length < 4 || /^\d+$/.test(cleanBlock) || /^(?:PDF-1\.|obj|endobj|stream|endstream|ReportLab|WinAnsiEncoding)/i.test(cleanBlock)) {
      return;
    }

    if (parsedShots.length >= heuristicShotBudget(scriptText)) return;

    if (TRANSITION_ONLY_RE.test(cleanBlock)) return;
    if (
      /^(?:\d{1,3}\.?|\(?\s*(?:MORE|CONTINUED)\s*\)?|CONTINUED:?)$/i.test(cleanBlock) ||
      /^=+$/.test(cleanBlock)
    ) {
      return;
    }

    const textLower = cleanBlock.toLowerCase();

    // Skip metadata / summary counters at top
    if (/^(?:\d+\s*Acts|\d+\s*Scenes|\d+\s*Shots|#[0-9a-f]{6})/i.test(cleanBlock)) {
      return;
    }
    if (
      cleanBlock.length < 140 &&
      /^(?:title\s*:|written by\b|fade in\s*:|by\s+[A-Z])/i.test(cleanBlock) &&
      !/(?:INT|EXT|సీన్|దృశ్యం)\b/i.test(cleanBlock)
    ) {
      return;
    }

    // Detect Scene Header (e.g. SCENE 1, SC 01, EXT. DANDAKA, INT. ROOM, సీన్ 1, 1. EXT., ACT I, ACT II)
    const sceneHeaderMatch = cleanBlock.match(/(?:SC\.\s*(\d+)|SC\s*(\d+)|SCENE\s*(\d+)|సీన్\s*(\d+)|దృశ్యం\s*(\d+)|BLOCK\s*[-:\s]?(\d+)|ACT\s*([I|V|X\d]+)|(?:EXT\.?|INT\.?|INT\/EXT\.?|I\/E\.?)\s*([A-Za-z0-9_\s-]+))/i);
    const numberedSlugMatch = cleanBlock.match(NUMBERED_SCENE_SLUG_RE);

    let isHeaderBlockOnly = false;

    if (numberedSlugMatch || sceneHeaderMatch) {
      const parsedNum = parseInt(
        (numberedSlugMatch && numberedSlugMatch[1]) ||
          sceneHeaderMatch?.[1] ||
          sceneHeaderMatch?.[2] ||
          sceneHeaderMatch?.[3] ||
          sceneHeaderMatch?.[4] ||
          sceneHeaderMatch?.[5] ||
          sceneHeaderMatch?.[6],
        10
      );
      if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum < 300) {
        if (parsedNum !== currentSceneNum) {
          currentSceneNum = parsedNum;
          currentSceneStr = `SC${currentSceneNum < 10 ? '0' + currentSceneNum : currentSceneNum}`;
          if (!sceneShotCounters[currentSceneStr]) {
            sceneShotCounters[currentSceneStr] = 0;
          }
        }
      } else if (!textLower.startsWith('shot') && !textLower.startsWith('sh') && !textLower.startsWith('s0') && !textLower.startsWith('s1')) {
        // New EXT/INT slug — with or without the conventional period. Do not bump SC on the first slug.
        if (cleanBlock.length < 80 && /(?:^|\n)\s*(?:int|ext|i\/e|int\/ext)\b/i.test(cleanBlock)) {
          intExtSlugCount += 1;
          if (intExtSlugCount > 1) {
            currentSceneNum++;
            currentSceneStr = `SC${currentSceneNum < 10 ? '0' + currentSceneNum : currentSceneNum}`;
            if (!sceneShotCounters[currentSceneStr]) {
              sceneShotCounters[currentSceneStr] = 0;
            }
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
    } else if (textLower.includes("wide shot") || textLower.includes("establishing") || /\b(?:ews|ws)\b/.test(textLower)) {
      framing = "Wide Shot (WS)";
    } else if (textLower.includes("ots") || textLower.includes("over-the-shoulder")) {
      framing = "Over-The-Shoulder (OTS)";
    } else if (textLower.includes("mcu") || textLower.includes("medium close")) {
      framing = "Medium Close-Up (MCU)";
    }

    // Universal Dynamic Camera Motion Detection — hold unless the text names a move
    let cameraMotion = "[Needs Direction: hold]";
    if (textLower.includes("push-in") || textLower.includes("push in") || textLower.includes("dolly")) {
      cameraMotion = "[Camera: Slow Push-In / Dolly Zoom]";
    } else if (textLower.includes("crane") || textLower.includes("tilt")) {
      cameraMotion = "[Camera: Slow Crane Rise / Vertical Tilt]";
    } else if (textLower.includes("orbit") || textLower.includes("360")) {
      cameraMotion = "[Camera: Hero Orbit 180/360 Deg]";
    } else if (textLower.includes("reveal") || textLower.includes("pan")) {
      cameraMotion = "[Camera: Slow Epic Reveal / Pan Right]";
    } else if (textLower.includes("handheld") || /\bfight\b/.test(textLower)) {
      cameraMotion = "[Camera: Dynamic Handheld Action Tracking]";
    }

    // Universal Dynamic Environment & Lighting Detection
    let lighting = "[Needs Direction: lighting]";
    let subjColor = "[Needs Direction: subject color]";
    let bgLighting = "[Needs Direction: background light]";
    let bgColor = "[Needs Direction: background color]";

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
    const fountainBits = extractFountainFromBlock(block);
    fountainBits.names.forEach((name) => {
      extractedCharNames.push(`@${String(name).replace(/\s+/g, '_')}`);
    });
    const dialogueSlugMatch = block.match(/([\u0C00-\u0C7FA-Z][\u0C00-\u0C7FA-Z\s]{1,20}):/g);
    if (dialogueSlugMatch) {
      dialogueSlugMatch.forEach(m => {
        const cleanName = safeTrim(m.replace(':', ''));
        if (cleanName && !['EXT', 'INT', 'SCENE', 'SHOT', 'ACT', 'CUT TO'].includes(cleanName)) {
          const tag = `@${cleanName.replace(/\s+/g, '_')}`;
          if (!extractedCharNames.includes(tag)) extractedCharNames.push(tag);
        }
      });
    }

    const atHandleMatches = block.match(/@[A-Za-z0-9_]+/g) || [];
    atHandleMatches.forEach(h => {
      if (!extractedCharNames.includes(h)) extractedCharNames.push(h);
    });

    const leadCharTag = extractedCharNames[0] || "[Needs Direction: unnamed subject]";
    const secondaryCharTag = extractedCharNames[1] || "[Needs Direction: no co-artist]";

    const quoteMatch = block.match(/"([^"]+)"|'([^']+)'/);
    let dialogue = fountainBits.dialogue
      || (quoteMatch ? `"${quoteMatch[1] || quoteMatch[2]}"` : '[Needs Direction: no spoken line]');
    const hasWalkOrRun = /\b(walks?|walking|runs?|running|sprints?|strides?)\b/i.test(cleanBlock);
    const characterMovement = hasWalkOrRun
      ? 'Movement as written in action (walk/run only — look is not a walk)'
      : '[Needs Direction: hold]';

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
      atmosphereVolumetricsTag: /haze|fog|dust|smoke|mist/i.test(textLower)
        ? "[Atmosphere: Haze & Dust Motes in Light Cones]"
        : "[Needs Direction: atmosphere]",
      characterIdAssetRef: leadCharTag,
      coArtistInteraction: secondaryCharTag,
      actionEnvContext: actionContext,
      characterExpression: "[Needs Direction: expression]",
      characterPlacement: "[Needs Direction: placement]",
      characterDialogue: dialogue,
      characterMovement,
      characterEyeLooks: "[Needs Direction: eye look]",
      shotDurationAndImages: durationAndImagesStr,
      soundFxAndFoley: "[Needs Direction: sfx]",
      backgroundScoreMood: "[Needs Direction: score]",
      lensAndFocalLength: "[Needs Direction: lens]",
      vfxCgiBreakdown: "[Needs Direction: vfx]",
      stuntAndSafetyNotes: "[Needs Direction: stunt]",
      makeupAndHairStyle: "[Needs Direction: makeup]",
      editTransitionCut: "[Needs Direction: cut]",
      characterIdMatrix: matrixSlots.join(' | ')
    });
  });

  return enrichShotsWithStudioBrain(parsedShots).map((s, idx) => normalizeShotTo26Crafts(s, idx, scriptText));
}

/** Prefer Studio Brain learned crafts when offline heuristic uses generic placeholders. */
function enrichShotsWithStudioBrain(shots) {
  if (typeof window === 'undefined' || !Array.isArray(shots) || !shots.length) return shots;
  let pick;
  try {
    const raw = JSON.parse(localStorage.getItem('sps_studio_brain_v1') || '{}');
    const banks = raw.craftBanks || {};
    pick = (key, fallback = '') => {
      const list = Array.isArray(banks[key]) ? banks[key] : [];
      return list[0]?.text || fallback;
    };
  } catch {
    return shots;
  }

  const isGeneric = (val, needles = []) => {
    const s = String(val || '');
    if (!s.trim()) return true;
    return needles.some((n) => s.includes(n));
  };

  return shots.map((shot) => {
    const next = { ...shot };
    if (isGeneric(next.cameraMotionTag, ['Static Locked'])) {
      next.cameraMotionTag = pick('cameraMotionTag', next.cameraMotionTag);
    }
    if (isGeneric(next.subjectLightingTag, ['Natural Soft Ambient'])) {
      next.subjectLightingTag = pick('subjectLightingTag', next.subjectLightingTag);
    }
    if (isGeneric(next.atmosphereVolumetricsTag, ['Haze & Dust Motes'])) {
      next.atmosphereVolumetricsTag = pick('atmosphereVolumetricsTag', next.atmosphereVolumetricsTag);
    }
    if (isGeneric(next.characterExpression, ['Focused determination'])) {
      next.characterExpression = pick('characterExpression', next.characterExpression);
    }
    if (isGeneric(next.characterMovement, ['Dynamic movement focused'])) {
      next.characterMovement = pick('characterMovement', next.characterMovement);
    }
    if (isGeneric(next.backgroundScoreMood, ['Orchestral Cinematic Strings'])) {
      next.backgroundScoreMood = pick('backgroundScoreMood', next.backgroundScoreMood);
    }
    if (isGeneric(next.lensAndFocalLength, ['50mm Master Prime'])) {
      next.lensAndFocalLength = pick('lensAndFocalLength', next.lensAndFocalLength);
    }
    if (isGeneric(next.soundFxAndFoley, ['Environmental Foley'])) {
      next.soundFxAndFoley = pick('soundFxAndFoley', next.soundFxAndFoley);
    }
    return next;
  });
}

export async function generateScriptFromConcept(conceptPrompt, shotCount = 5, options = {}) {
  const apiKey = getApiKey();
  const signal = options.signal;
  assertParseNotAborted(signal);
  const prompt = `Generate exactly ${shotCount} stage production shots as a JSON array for this creative concept: "${conceptPrompt}".
Each shot in the JSON array MUST contain all 26 canonical craft keys:
"sceneShotId", "sceneSynopsis", "shotComposition", "cameraMotionTag", "timeAndLightingEnv", "directionalLightingAndHighlight", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "colorPaletteSlot", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPsychologyState", "characterMannerismAndPosture", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength".

Return ONLY valid JSON array without markdown code blocks.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 }, { signal });
      assertParseNotAborted(signal);
      if (response && response.ok) {
        const data = await response.json();
        assertParseNotAborted(signal);
        const responseText = extractGeminiResponseText(data);
        const parsed = safeParseJsonArray(responseText);
        if (parsed?.length) {
          return validateAndSanitizeShots(parsed, conceptPrompt);
        }
      }
    } catch (e) {
      if (isParseAbortError(e) || signal?.aborted) throw makeParseAbortError();
      console.warn("Google Gemini concept generator fallback:", e);
    }
  }

  assertParseNotAborted(signal);
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
  const signal = shotContext.signal;
  assertParseNotAborted(signal);
  const shotDesc = shotContext.actionEnvContext || shotContext.sceneShotId || 'Cinematic Shot';
  const genreKey = shotContext.genreKey || shotContext.presetProfile || '';
  const projectTitle = shotContext.projectTitle || '';

  let referenceBlock = '';
  try {
    const refs = getCinematicReferences({
      genreKey: genreKey || 'mythological',
      craftKey,
      projectTitle,
      limitPerCategory: 4
    });
    referenceBlock = formatReferencesForLLM(refs, { maxItems: 3 });
  } catch {
    referenceBlock = '';
  }

  if (!apiKey) {
    const fallback = currentValue ? `[Enhanced] ${currentValue}` : `[Stage Work Studio Cinematic Preset for ${craftKey}]`;
    return autoEnhanceCraftValue(craftKey, fallback) || fallback;
  }

  if (apiKey) {
    try {
      const prompt = `You are a legendary Master Director & Cinematographer (Stage Work Studio Cinema Intelligence Engine).
Enhance the following film craft parameter for a cinema production script:
Craft Field: "${craftKey}"
Current Value: "${currentValue || ''}"
Shot Context: "${shotDesc}"
Project: "${projectTitle || 'Untitled'}"

${referenceBlock ? `${referenceBlock}\n` : ''}
Return ONLY a concise, ultra-cinematic, production-ready descriptor string (max 25 words). Do NOT wrap in quotes or code blocks. Do not name movies unless essential to a technical grammar.`;

      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 }, { signal });
      if (response && response.ok) {
        const data = await response.json();
        const text = safeTrim(extractGeminiResponseText(data));
        if (text) return text.replace(/^"|"$/g, '');
      }
    } catch (err) {
      if (isParseAbortError(err)) throw err;
      console.warn("LLM craft enhancer fallback:", err);
    }
  }

  return currentValue ? `[Enhanced] ${currentValue}` : `[Stage Work Studio Cinematic Preset for ${craftKey}]`;
}

export async function enhanceEntireShotWithLLM(shot, options = {}) {
  const apiKey = getApiKey();
  const signal = options.signal;
  assertParseNotAborted(signal);

  if (apiKey && shot) {
    try {
      const prompt = `You are a Master Film Director (Stage Work Studio Cinema Intelligence Engine).
Elevate the following shot into an ultra-cinematic masterpiece by enhancing all craft fields:
Current Shot JSON: ${JSON.stringify(shot)}

Return ONLY a valid JSON object representing the enhanced shot with the same 26 keys:
"sceneShotId", "shotComposition", "cameraMotionTag", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength", "vfxCgiBreakdown", "stuntAndSafetyNotes", "makeupAndHairStyle", "editTransitionCut", "characterIdMatrix".

Do NOT use markdown codeblocks. Return JSON object ONLY.`;

      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 }, { signal });
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
      if (isParseAbortError(err)) throw err;
      console.warn("LLM shot enhancer fallback:", err);
    }
  }

  return shot ? normalizeShotTo26Crafts(shot, 0, shot.actionEnvContext || '') : shot;
}

export async function composeCharacterPersonaWithLLM(characterName, tag, role, rawNotes = '', shots = [], projectTitle = '', options = {}) {
  const apiKey = getApiKey();
  const signal = options.signal;
  assertParseNotAborted(signal);

  const prompt = `You are a Master Screenwriter and Film Narrative Analyst for High-End Cinema.
Extract the COMPLETE story arc for character "${characterName}" from the following film script context ("${projectTitle}"):

Script Shots Context:
${JSON.stringify(shots, null, 2)}

Task: Extract their complete story arc, origins, core motivation, mannerisms, gait, voice texture, narrative connections, scene presence purpose, AND a production wardrobe bible (layers, elements, accessories, missing costume details) from this film script.

Return ONLY a valid JSON object with the following exact keys:
{
  "backstory": "An elaborate 4-5 sentence complete story arc detailing their origins, core trauma/oath, pivotal story conflict, and emotional driving force across the script.",
  "characterConnections": "Detailed narrative relationships with other co-performers and characters in the story.",
  "shotPurpose": "Explicit dramatic reason for their presence in scene beats across this project.",
  "mannerism": "Minute physical gestures, hand habits, posture tendencies, eye twitches or quirks.",
  "walkingStyle": "Detailed description of their gait, stride speed, posture balance, and physical presence while moving.",
  "dialogueDelivery": "Unique dialogue cadence, vocal rhythm, dialect accent, emotional inflection, and speaking habits.",
  "uniqueVoice": "Vocal pitch, acoustic texture, timbre, and resonance.",
  "outfit": "Primary silhouette and garments: silhouette, era, layers from skin to outer, fabrics, dyes, fit, weathering, grooming that reads as costume.",
  "wardrobeElements": "Itemized costume ELEMENTS head-to-toe: headwear, hair ornament, outer layer, inner/torso, bottoms, footwear, armor/drape, belts, pockets, embroidery, insignia, sacred marks. Name each piece; do not collapse into one sentence.",
  "accessories": "Worn ACCESSORIES and held props: jewelry, tilak/bindi, weapons, shields, malas, rings, earrings, armlets, bags, instruments, ritual objects, eyewear. Material, metal, gem, and where on the body.",
  "costumeDetails": "Missing production details: color palette hex-or-named swatches, fabric weave, aging/dirt, makeup that is costume, tattoos, scars that costume reveals, continuity notes if costume changes by scene.",
  "colorPalette": "3-6 named costume colors with where they sit (e.g. saffron dhoti, gold zari border, charcoal armor)."
}

Do NOT output markdown blocks or extra text. Return valid JSON ONLY.`;

  if (apiKey) {
    try {
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 }, { signal });
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
      if (isParseAbortError(err)) throw err;
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
    outfit: `Signature cinematic costume tailored with authentic textures and period-accurate accessories.`,
    wardrobeElements: `Head-to-toe elements: headwear, outer layer, inner garments, bottoms, footwear, belt, embroidery or insignia as the script implies.`,
    accessories: `Worn accessories and held props: jewelry, weapons, ritual objects, bags, and signature handheld pieces.`,
    costumeDetails: `Color, fabric weave, weathering, makeup-as-costume, and any scene-to-scene costume change the script implies.`,
    colorPalette: `Primary, accent, and metal tones pulled from the character's described look.`
  };
}

const GENERIC_CAST_NAMES = /^(lead[_\s-]?protagonist|primary[_\s-]?antagonist|supporting[_\s-]?(performer|character|artist)|co[-_\s]?artist|crowd|scene|lead|extra|background|unnamed|character|new character name)$/i;
const CAST_CUE_STOP = new Set([
  'ACT', 'EXT', 'INT', 'CUT TO', 'FADE IN', 'FADE OUT', 'SHOT', 'SCENE', 'TITLE', 'SUPER',
  'PART ONE', 'PART TWO', 'INTERMISSION', 'DISSOLVE', 'SMASH CUT', 'CONTINUED', 'MORE',
  'THE END', 'MONTAGE', 'FLASHBACK', 'PRESENT', 'LATER', 'NIGHT', 'DAY', 'DAWN', 'DUSK'
]);
const SYNOPSIS_NAME_STOP = new Set([
  'Scene', 'Location', 'Context', 'Featuring', 'Camera', 'Medium', 'Close', 'Wide', 'Shot',
  'The', 'And', 'With', 'From', 'Into', 'After', 'Before', 'During', 'Lord', 'Lady',
  'King', 'Queen', 'Prince', 'Princess', 'Young', 'Old'
]);

function titleCasePerson(raw) {
  return String(raw || '')
    .replace(/[_@]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function tagFromPersonName(name) {
  const slug = String(name || '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug ? `@${slug}` : '';
}

function isGenericCastName(name) {
  const n = String(name || '').replace(/[@_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n || n.length < 2) return true;
  return GENERIC_CAST_NAMES.test(n) || GENERIC_CAST_NAMES.test(n.replace(/\s+/g, '_'));
}

function addHarvestedPerson(map, raw) {
  let name = String(raw || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/CharID\s*:?/gi, ' ')
    .replace(/Co-?Artist\s*:?/gi, ' ')
    .replace(/Image_\d+\s*=?/gi, ' ')
    .replace(/^[@]+/, '')
    .replace(/[_|,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2 || name.length > 42) return;
  if (isGenericCastName(name)) return;
  if (/^\d+$/.test(name)) return;
  if (/^(duration|atmospheric|production|foley|environment)/i.test(name)) return;
  const pretty = titleCasePerson(name);
  if (!pretty || isGenericCastName(pretty)) return;
  const key = pretty.toLowerCase();
  const cur = map.get(key) || { name: pretty, tag: tagFromPersonName(pretty), hits: 0 };
  cur.hits += 1;
  map.set(key, cur);
}

export function harvestCharacterNamesFromProject(shots = [], scriptText = '') {
  const map = new Map();

  (shots || []).forEach((shot) => {
    if (!shot || typeof shot !== 'object') return;
    String(shot.characterIdMatrix || '')
      .split('|')
      .forEach((part) => {
        const rhs = part.includes('=') ? part.split('=').slice(1).join('=') : part;
        addHarvestedPerson(map, rhs);
      });
    const ref = String(shot.characterIdAssetRef || '');
    (ref.match(/@([A-Za-z][A-Za-z0-9_]{1,32})/g) || []).forEach((t) => addHarvestedPerson(map, t));
    const labeled = ref.match(/CharID\s*:\s*@?([A-Za-z][A-Za-z0-9_ ]{1,40})/i);
    if (labeled) addHarvestedPerson(map, labeled[1]);
    (String(shot.coArtistInteraction || '').match(/@([A-Za-z][A-Za-z0-9_]{1,32})/g) || []).forEach((t) => addHarvestedPerson(map, t));
    String(shot.characterDialogue || '').split('\n').forEach((line) => {
      const cue = line.match(/^\s*([A-Z][A-Za-z][A-Za-z .'-]{0,28})\s*[:：]/);
      if (cue) addHarvestedPerson(map, cue[1]);
    });
    String(shot.shotDurationAndImages || '')
      .split('|')
      .forEach((part) => {
        const rhs = part.includes(':') ? part.split(':').slice(1).join(':') : part;
        if (/@|[A-Za-z]/.test(rhs)) addHarvestedPerson(map, rhs);
      });
  });

  const script = safeTrim(scriptText);
  if (script) {
    (script.match(/^[A-Z][A-Z \t.'-]{1,28}$/gm) || []).forEach((line) => {
      const clean = safeTrim(line);
      if (CAST_CUE_STOP.has(clean) || /^(INT|EXT|INT\/EXT)\.?/i.test(clean)) return;
      if (clean.split(/\s+/).length > 4) return;
      addHarvestedPerson(map, clean);
    });
    (script.match(/^Present:\s*(.+)$/gim) || []).forEach((line) => {
      String(line.replace(/^Present:\s*/i, ''))
        .split(/,|;| and /i)
        .forEach((bit) => addHarvestedPerson(map, bit));
    });
  }

  const hay = [
    ...(shots || []).map((s) => `${s.sceneSynopsis || ''} ${s.actionEnvContext || ''}`),
    script
  ].join('\n');
  const freq = new Map();
  (hay.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g) || []).forEach((phrase) => {
    const words = phrase.split(/\s+/);
    if (words.every((w) => SYNOPSIS_NAME_STOP.has(w))) return;
    if (SYNOPSIS_NAME_STOP.has(words[0]) && words.length === 1) return;
    freq.set(phrase, (freq.get(phrase) || 0) + 1);
  });
  freq.forEach((n, phrase) => {
    if (n >= 2) addHarvestedPerson(map, phrase);
  });

  return Array.from(map.values())
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 28);
}

function readMasterStoryForCast() {
  if (typeof window === 'undefined') return '';
  try {
    const src = localStorage.getItem('sps_script_synopsis_source') || 'auto_llm';
    if (src === 'writer_custom') {
      return localStorage.getItem('sps_writer_custom_script_synopsis') || localStorage.getItem('sps_extracted_master_story') || '';
    }
    return localStorage.getItem('sps_extracted_master_story') || localStorage.getItem('sps_writer_custom_script_synopsis') || '';
  } catch {
    return '';
  }
}

function shotMentionsPerson(shot, person) {
  const name = String(person?.name || '').toLowerCase();
  const tag = String(person?.tag || '').replace(/^@/, '').toLowerCase();
  const h = `${shot?.sceneSynopsis || ''} ${shot?.characterIdAssetRef || ''} ${shot?.characterIdMatrix || ''} ${shot?.characterDialogue || ''} ${shot?.actionEnvContext || ''} ${shot?.coArtistInteraction || ''} ${shot?.makeupAndHairStyle || ''}`.toLowerCase();
  if (name.length > 2 && h.includes(name)) return true;
  if (tag.length > 2 && h.includes(tag)) return true;
  return false;
}

function dossierForPerson(shots, person, allPeople = []) {
  const hits = (shots || []).filter((s) => shotMentionsPerson(s, person));
  const pool = hits.length ? hits : [];
  const others = allPeople
    .map((p) => p.name)
    .filter((n) => n && n.toLowerCase() !== String(person.name || '').toLowerCase())
    .slice(0, 8);
  const coFromShots = [];
  pool.forEach((s) => {
    others.forEach((n) => {
      if (`${s.sceneSynopsis || ''} ${s.coArtistInteraction || ''} ${s.characterIdMatrix || ''}`.toLowerCase().includes(n.toLowerCase())) {
        coFromShots.push(n);
      }
    });
  });
  return {
    beats: pool.map((s) => clip(s.sceneSynopsis || s.actionEnvContext, 200)).filter(Boolean).slice(0, 5),
    dialogue: pool
      .map((s) => clip(s.characterDialogue, 140))
      .filter((d) => d && !/atmospheric|foley|production sound/i.test(d))
      .slice(0, 3),
    wardrobe: [
      ...new Set(
        pool
          .flatMap((s) => [clip(s.characterIdAssetRef, 120), clip(s.makeupAndHairStyle, 100)])
          .filter(Boolean)
      )
    ].slice(0, 3),
    world: clip(pool[0]?.timeAndLightingEnv || pool[0]?.actionEnvContext || '', 160),
    movement: clip(pool[0]?.characterMovement || pool[0]?.characterMannerismAndPosture || '', 120),
    co: [...new Set(coFromShots)].slice(0, 6),
    hitCount: pool.length
  };
}

function skeletonBibleFromHarvest(people, shots = [], projectTitle = '', story = '') {
  const title = projectTitle || 'this film';
  const storyBit = clip(story, 320);
  return people.map((p, idx) => {
    const d = dossierForPerson(shots, p, people);
    const villain = /duryodhan|dushan|antagonist|villain|rival|kaurava|shakuni|karna.*enemy/i.test(`${p.name} ${p.tag} ${d.beats.join(' ')}`);
    const beatText = d.beats.join(' ');
    const backstory = [
      storyBit ? `In ${title}: ${storyBit}` : `${p.name} belongs to the story of ${title}.`,
      beatText ? `${p.name} on screen: ${clip(beatText, 360)}` : ''
    ].filter(Boolean).join(' ');
    return {
      id: `char_${Date.now()}_${idx}`,
      source: 'auto_extracted',
      tag: p.tag,
      name: p.name,
      role: idx === 0 ? 'Lead Protagonist' : villain ? 'Primary Antagonist' : idx < 4 ? 'Principal Cast' : 'Supporting',
      backstory,
      characterConnections: d.co.length
        ? `${p.name} shares coverage with ${d.co.join(', ')} in this script.`
        : `Relationships as written in ${title}.`,
      shotPurpose: d.beats[0] || `${p.name} appears in ${d.hitCount || p.hits || 0} listed beats of ${title}.`,
      mannerism: d.movement || '',
      walkingStyle: clip(d.movement, 100),
      dialogueDelivery: d.dialogue[0] || '',
      uniqueVoice: '',
      outfit: d.wardrobe[0] || `Period costume of ${title}'s world, as seen in their scenes.`,
      wardrobeElements: d.wardrobe[1] || d.wardrobe[0] || '',
      accessories: '',
      costumeDetails: d.world || '',
      colorPalette: '',
      psychologicalArchetype: '',
      internalConflict: clip(storyBit, 180)
    };
  });
}

function profilesLookGeneric(list) {
  if (!Array.isArray(list) || !list.length) return true;
  const real = list.filter((c) => c && !isGenericCastName(c.name) && !isGenericCastName(c.tag));
  if (!real.length) return true;
  const hollow = real.filter((c) => /appears throughout|key figure in the narrative|expand with ai auto-compose/i.test(c.backstory || ''));
  return hollow.length === real.length;
}

function bibleLooksStoryLite(c) {
  const b = String(c?.backstory || '');
  return !b || b.length < 80 || /appears throughout|key figure in the narrative|expand with ai auto-compose/i.test(b);
}

function mergeBibleWithDossier(llmChar, people, shots, story, projectTitle) {
  const person = {
    name: llmChar.name,
    tag: llmChar.tag
  };
  const skel = skeletonBibleFromHarvest([person], shots, projectTitle, story)[0] || {};
  const out = { ...skel, ...llmChar, source: 'auto_extracted' };
  if (bibleLooksStoryLite(out) && skel.backstory) out.backstory = skel.backstory;
  if (!clip(out.outfit, 40) || /signature cinematic costume/i.test(out.outfit)) out.outfit = skel.outfit;
  if (!clip(out.shotPurpose, 40)) out.shotPurpose = skel.shotPurpose;
  if (!clip(out.characterConnections, 40) || /co-performers/i.test(out.characterConnections)) {
    out.characterConnections = skel.characterConnections;
  }
  return out;
}

export async function extractProjectCharactersWithLLM(shots = [], projectTitle = '', options = {}) {
  const scriptText =
    typeof window !== 'undefined'
      ? localStorage.getItem('sps_live_screenplay_text') || localStorage.getItem('sps_current_screenplay_text') || ''
      : '';
  const story = readMasterStoryForCast();
  const harvested = harvestCharacterNamesFromProject(shots, `${scriptText}\n${story}`);
  const dossiers = harvested.map((p) => ({
    name: p.name,
    tag: p.tag,
    ...dossierForPerson(shots, p, harvested)
  }));

  const prompt = `You are the casting director + continuity supervisor for the feature "${projectTitle || 'UNTITLED'}".
Fill Character Bible rows that are TRUE to this film only. Do not write generic heroes. Do not use @Lead_Protagonist.

MASTER STORY / SYNOPSIS:
"""
${clip(story || scriptText, 3500)}
"""

PEOPLE FOUND (use these names; add a person only if the story clearly names them):
${dossiers.map((d) => `- ${d.name} (${d.tag})
  Beats: ${d.beats.join(' | ') || '(find in synopsis)'}
  Dialogue: ${d.dialogue.join(' / ') || 'n/a'}
  Wardrobe/makeup crafts: ${d.wardrobe.join(' | ') || 'n/a'}
  World: ${d.world || 'n/a'}
  Shares frames with: ${d.co.join(', ') || 'n/a'}`).join('\n\n') || '(read names from the synopsis)'}

Rules:
- backstory must mention THIS plot (what they do in this story), not "a complex protagonist".
- outfit must match the world of the synopsis (e.g. Mahabharata riverbank ≠ grey hoodie).
- characterConnections must name other people from the list when they share story.
- English names. Tags like @Kunti. Each field 8-28 words.

Return ONLY a JSON array with keys:
"id", "tag", "name", "role", "backstory", "characterConnections", "shotPurpose", "mannerism", "walkingStyle", "dialogueDelivery", "uniqueVoice", "outfit", "wardrobeElements", "accessories", "costumeDetails", "colorPalette", "psychologicalArchetype", "internalConflict".`;

  let parsed = [];
  try {
    const llmText = await completeLlmText(prompt, {
      temperature: 0.12,
      maxOutputTokens: 16384,
      timeoutMs: 90000,
      signal: options.signal
    });
    parsed = safeParseJsonArray(llmText) || [];
  } catch (err) {
    if (isParseAbortError(err)) throw err;
    console.warn('LLM character extraction fallback:', err);
  }

  parsed = (parsed || [])
    .filter((c) => c && (c.name || c.tag) && !isGenericCastName(c.name) && !isGenericCastName(c.tag))
    .map((c, i) => mergeBibleWithDossier(
      {
        ...c,
        id: c.id || `char_${Date.now()}_${i}`,
        tag: c.tag || tagFromPersonName(c.name),
        name: titleCasePerson(c.name || String(c.tag || '').replace(/^@/, ''))
      },
      harvested,
      shots,
      story,
      projectTitle
    ));

  if (!profilesLookGeneric(parsed) && parsed.some((c) => !bibleLooksStoryLite(c))) return parsed;
  const skeleton = skeletonBibleFromHarvest(harvested, shots, projectTitle, story);
  if (skeleton.length) return skeleton;
  return [];
}

function lookFactsForChar(char, shots, projectTitle, story, llmFacts) {
  const genreKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_preset_profile') || '') : '';
  return composeLookFacts({
    char,
    shots,
    projectTitle,
    synopsis: story,
    genreKey,
    llmFacts
  });
}

function fallbackReferenceSheets(char, shots, projectTitle) {
  const story = clip(typeof window !== 'undefined' ? (localStorage.getItem('sps_extracted_master_story') || '') : '', 400);
  return buildReferenceSheetsFromFacts(lookFactsForChar(char, shots, projectTitle, story, null));
}

/**
 * LLM extracts FACTS only. The app writes image prompts so every character
 * (not only famous names) uses Matrix wardrobe + station, not game-art priors.
 */
export async function extractCharacterReferenceSheets({ characters = [], shots = [], projectTitle = '', signal } = {}) {
  const people = (characters || []).filter((c) => c && (c.name || c.tag) && !isGenericCastName(c.name) && !isGenericCastName(c.tag));
  if (!people.length) return [];

  const story = readMasterStoryForCast();
  const outMap = new Map();
  const genreKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_preset_profile') || '') : '';
  const epic = storyLooksIndianEpic({ title: projectTitle, synopsis: story, genreKey });

  const batchSize = 4;
  for (let i = 0; i < people.length; i += batchSize) {
    assertParseNotAborted(signal);
    const batch = people.slice(i, i + batchSize);
    const dossiers = batch.map((p) => {
      const d = dossierForPerson(shots, p, people);
      return {
        id: p.id,
        tag: p.tag,
        name: p.name,
        role: p.role,
        outfitBible: clip(p.outfit, 140),
        beats: d.beats.slice(0, 3),
        garmentsFromShots: d.wardrobe,
        location: d.world,
        armedInShots: shotsMentionWeaponForPerson(shots, p)
      };
    });

    const prompt = `Casting continuity: extract FACTS only. Do not write image prompts or the words "character sheet" or "turnaround".

Film: "${projectTitle || 'UNTITLED'}"
Period: ${epic ? 'Indian period epic as in this synopsis (textiles and court of THAT world).' : 'Only the period/place in the synopsis — never default to medieval Europe.'}
Synopsis:
"""
${clip(story, 1800)}
"""

Evidence per person (use ONLY this; do not copy another person's clothes):
${JSON.stringify(dossiers, null, 2)}

Return a JSON array. Each object:
"id" (copy), "tag", "name",
"ageStation" (one line: age + social station from role + beats + garments; e.g. adult queen/mother, elderly king, young soldier — never invent a girl warrior if evidence is a mother/queen/civilian),
"garments" (one line copied/condensed from garmentsFromShots or outfitBible; if empty, civilian period dress of this film for that station),
"location" (from their shots).

If armedInShots is false, garments must not add weapons. Return JSON array only.`;

    let parsed = [];
    try {
      const text = await completeLlmText(prompt, {
        temperature: 0.08,
        maxOutputTokens: 4096,
        timeoutMs: 90000,
        signal
      });
      parsed = safeParseJsonArray(text) || [];
    } catch (err) {
      if (isParseAbortError(err)) throw err;
      console.warn('Reference sheet fact extract failed:', err);
    }

    batch.forEach((person) => {
      const hit = parsed.find(
        (row) =>
          row &&
          (row.id === person.id ||
            String(row.tag || '').toLowerCase() === String(person.tag || '').toLowerCase() ||
            String(row.name || '').toLowerCase() === String(person.name || '').toLowerCase())
      );
      const facts = lookFactsForChar(person, shots, projectTitle, story, hit || null);
      if (hit?.garments) facts.outfit = clip(hit.garments, 200) || facts.outfit;
      if (hit?.ageStation) facts.station = clip(hit.ageStation, 160) || facts.station;
      outMap.set(person.id, buildReferenceSheetsFromFacts(facts));
    });
  }

  return people.map((p) => ({
    ...p,
    referenceSheets: outMap.get(p.id) || fallbackReferenceSheets(p, shots, projectTitle)
  }));
}

export async function extractMasterScriptSynopsisWithLLM(fullScriptText = '', options = {}) {
  const apiKey = getApiKey();
  const provider = getLlmProvider();
  const signal = options.signal;
  assertParseNotAborted(signal);

  const safeScriptText = safeTrim(fullScriptText);
  const scriptSnippet = safeScriptText.length > 30 
    ? safeScriptText.substring(0, 12000) 
    : 'A high-stakes cinematic screenplay.';

  const prompt = `You are a Hollywood Executive Story Editor and Master Script Consultant (Stage Work Studio Cinema Intelligence Engine).

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

  if (apiKey && !isBuiltInLlm(provider)) {
    try {
      if (isGeminiLlmProvider(provider)) {
        const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.1 }, { signal });
        if (response && response.ok) {
          const data = await response.json();
          const text = safeTrim(extractGeminiResponseText(data));
          if (text && text.length > 80) return text;
        }
      }

      if (provider === 'openai') {
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
          }),
          signal
        });
        if (res.ok) {
          const data = await res.json();
          const text = safeTrim(data.choices?.[0]?.message?.content);
          if (text && text.length > 80) return text;
        }
      }
    } catch (err) {
      if (isParseAbortError(err)) throw err;
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

export async function composeDirectorPsychologyWithLLM(projectTitle = '', shots = [], scriptText = '', projectDescription = '', options = {}) {
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
      assertParseNotAborted(options.signal);
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.15 }, { signal: options.signal });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const parsed = safeParseJsonObject(responseText);
        if (parsed && parsed.corePhilosophicalIdea) {
          return parsed;
        }
      }
    } catch (err) {
      if (isParseAbortError(err)) throw err;
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

export async function composeHybridVisionMergeWithLLM(projectTitle = '', humanVision = {}, aiVision = {}, options = {}) {
  const apiKey = getApiKey();
  const signal = options.signal;
  assertParseNotAborted(signal);
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
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.15 }, { signal });
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
      if (isParseAbortError(err)) throw err;
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
  const { title = 'Stage Production', rawScript = '', shots = [], signal } = project;

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
      assertParseNotAborted(signal);
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.2 }, { signal });
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
      if (isParseAbortError(err)) throw err;
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
  const { title = 'Stage Production', rawScript = '', signal } = project;

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
      assertParseNotAborted(signal);
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.2 }, { signal });
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
      if (isParseAbortError(err)) throw err;
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

export async function synthesizeFullAppElementsFromScript(scriptText, projectTitle = '', shots = [], options = {}) {
  const signal = options.signal;
  assertParseNotAborted(signal);
  if (!shots || shots.length === 0) {
    shots = await parseRawScriptToShots(scriptText, { signal });
  }

  const detectedGenre = detectScriptGenre(projectTitle, shots, scriptText);
  
  // 1. Synthesize Character Bibles
  let characters = [];
  try {
    assertParseNotAborted(signal);
    characters = await extractProjectCharactersWithLLM(shots, projectTitle, { signal });
  } catch (e) {
    if (isParseAbortError(e)) throw e;
    console.warn("Character auto-synthesis error:", e);
  }

  // 2. Synthesize Director's Core Vision & Script Psychology
  let directorPsychology = null;
  try {
    assertParseNotAborted(signal);
    directorPsychology = await composeDirectorPsychologyWithLLM(projectTitle, shots, scriptText, '', { signal });
  } catch (e) {
    if (isParseAbortError(e)) throw e;
    console.warn("Director psychology auto-synthesis error:", e);
  }

  // 3. Synthesize DoP Vision Vault
  let dopVision = null;
  try {
    assertParseNotAborted(signal);
    dopVision = await composeDoPVisionWithLLM({ title: projectTitle, shots, scriptText, signal });
  } catch (e) {
    if (isParseAbortError(e)) throw e;
    console.warn("DoP vision auto-synthesis error:", e);
  }

  // 4. Synthesize Sound & Music Vision Vault
  let soundVision = null;
  try {
    assertParseNotAborted(signal);
    soundVision = await composeSoundVisionWithLLM({ title: projectTitle, shots, scriptText, signal });
  } catch (e) {
    if (isParseAbortError(e)) throw e;
    console.warn("Sound vision auto-synthesis error:", e);
  }

  let worldAssets = [];
  try {
    worldAssets = await extractWorldEnvironmentAssetsWithLLM(shots, projectTitle, { signal });
  } catch (e) {
    if (isParseAbortError(e)) throw e;
    console.warn("World auto-synthesis error:", e);
    worldAssets = heuristicWorldAssetsFromShots(shots, projectTitle);
  }

  const meta = getLastParseMeta();

  return {
    shots,
    detectedGenre,
    characters,
    worldAssets,
    screenplayText: meta?.screenplayText || '',
    runtimeMinutes: meta?.runtimeMinutes || null,
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

const WORLD_ASSET_TYPES = ['location', 'background', 'prop', 'element', 'atmosphere'];

function slugWorldTag(name, type, idx) {
  const base = String(name || type || 'World')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('_') || `Asset_${idx + 1}`;
  return `@World_${base}`;
}

function heuristicWorldAssetsFromShots(shots = [], projectTitle = '') {
  const map = new Map();
  const pushAsset = (partial) => {
    const type = WORLD_ASSET_TYPES.includes(partial.type) ? partial.type : 'location';
    const name = safeTrim(partial.name) || `${type} asset`;
    const key = `${type}:${name.toLowerCase()}`;
    if (map.has(key)) return;
    const idx = map.size;
    const tag = partial.tag || slugWorldTag(name, type, idx);
    const desc = safeTrim(partial.description) || name;
    const promptAuto = safeTrim(partial.promptAuto) ||
      `masterpiece 8k cinematic still, ${type} concept plate for "${projectTitle || 'stage production'}", ${desc}, photoreal environment reference, consistent world bible, no characters in frame unless prop requires hands, ultra-detailed materials, cinematic lighting`;
    map.set(key, {
      id: partial.id || `world_${Date.now()}_${idx}`,
      tag,
      name,
      type,
      description: desc,
      promptAuto,
      promptCustom: '',
      promptSource: 'auto_llm',
      weather: partial.weather || '',
      timeOfDay: partial.timeOfDay || '',
      materials: partial.materials || '',
      lightingNotes: partial.lightingNotes || '',
      referenceImageUrl: '',
      includeInPrompt: true
    });
  };

  (Array.isArray(shots) ? shots : []).forEach((shot) => {
    if (!shot || typeof shot !== 'object') return;
    const env = safeTrim(shot.actionEnvContext || shot.environmentContext || '');
    const weatherBlock = safeTrim(shot.timeAndLightingEnv || '');
    const atmos = safeTrim(shot.atmosphereVolumetricsTag || '');
    const bg = safeTrim(`${shot.backgroundLightingTag || ''} ${shot.backgroundColorTag || ''}`);

    if (env && env.length > 18) {
      const shortName = env.split(/[.—,\n]/)[0].slice(0, 64).trim() || 'Primary Location';
      pushAsset({
        type: 'location',
        name: shortName,
        description: env.slice(0, 320),
        weather: weatherBlock,
        lightingNotes: bg,
        promptAuto: `masterpiece 8k empty establishing plate of ${shortName}. ${env.slice(0, 220)}. Environment-only, no hero characters, cinematic world bible still.`
      });
      pushAsset({
        type: 'background',
        name: `${shortName} Background Plate`,
        description: `Wide background / depth plate for ${shortName}`,
        promptAuto: `masterpiece 8k deep background plate, ${env.slice(0, 180)}, soft focus distant layers, cinematic depth, empty of hero faces`
      });
    }

    if (atmos && atmos.length > 8) {
      pushAsset({
        type: 'atmosphere',
        name: atmos.replace(/[\[\]]/g, '').slice(0, 56) || 'Atmosphere Rig',
        description: atmos,
        promptAuto: `cinematic atmosphere volume plate: ${atmos}, particulate light, environmental haze, no characters`
      });
    }

    if (weatherBlock && /weather|rain|fog|storm|night|dusk|dawn|golden/i.test(weatherBlock)) {
      pushAsset({
        type: 'element',
        name: 'Weather & Time Element',
        description: weatherBlock,
        weather: weatherBlock,
        timeOfDay: weatherBlock,
        promptAuto: `environmental weather/time still: ${weatherBlock}, empty landscape response to climate, cinematic`
      });
    }
  });

  if (map.size === 0) {
    pushAsset({
      type: 'location',
      name: projectTitle ? `${projectTitle} Primary Set` : 'Primary Production Set',
      description: 'Primary cinematic location for the project world bible.',
      promptAuto: `masterpiece 8k cinematic empty location plate for ${projectTitle || 'stage production'}, consistent world bible, photoreal set`
    });
  }

  return Array.from(map.values()).slice(0, 24);
}

/**
 * Extract World & Environment assets (locations, backgrounds, props, elements, atmosphere)
 * for the World Console vault — feeds image→video asset consistency.
 */
export async function extractWorldEnvironmentAssetsWithLLM(shots = [], projectTitle = '', options = {}) {
  const apiKey = getApiKey();
  const prompt = `You are a Production Designer & World-Building Analyst for cinema.
Analyze these shots for "${projectTitle}" and extract a reusable WORLD & ENVIRONMENT ASSET BIBLE.

Shots:
${JSON.stringify((shots || []).slice(0, 80).map((s) => ({
  sceneShotId: s.sceneShotId,
  actionEnvContext: s.actionEnvContext,
  timeAndLightingEnv: s.timeAndLightingEnv,
  atmosphereVolumetricsTag: s.atmosphereVolumetricsTag,
  backgroundLightingTag: s.backgroundLightingTag,
  backgroundColorTag: s.backgroundColorTag,
  sceneSynopsis: s.sceneSynopsis
})), null, 2)}

Return ONLY a JSON array (max 16 objects). Each object keys:
{
  "id": "world_unique",
  "tag": "@World_Short_Tag",
  "name": "Asset display name",
  "type": "location|background|prop|element|atmosphere",
  "description": "2-3 sentence visual bible for consistency",
  "promptAuto": "Single image-gen prompt for an empty reference still (no hero characters unless prop needs hands)",
  "weather": "optional weather notes",
  "timeOfDay": "optional time of day",
  "materials": "optional materials/textures",
  "lightingNotes": "optional lighting for the plate"
}

Focus on locations, background plates, set props, environmental elements, atmosphere. Do NOT output markdown.`;

  if (apiKey) {
    try {
      assertParseNotAborted(options.signal);
      const response = await fetchGeminiContent(apiKey, prompt, { temperature: 0.15 }, { signal: options.signal });
      if (response && response.ok) {
        const data = await response.json();
        const responseText = extractGeminiResponseText(data);
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((raw, idx) => {
              const type = WORLD_ASSET_TYPES.includes(raw?.type) ? raw.type : 'location';
              const name = safeTrim(raw?.name) || `World Asset ${idx + 1}`;
              return {
                id: raw?.id || `world_${Date.now()}_${idx}`,
                tag: raw?.tag || slugWorldTag(name, type, idx),
                name,
                type,
                description: safeTrim(raw?.description) || name,
                promptAuto: safeTrim(raw?.promptAuto) || `masterpiece 8k ${type} plate, ${name}, cinematic world bible`,
                promptCustom: '',
                promptSource: 'auto_llm',
                weather: safeTrim(raw?.weather),
                timeOfDay: safeTrim(raw?.timeOfDay),
                materials: safeTrim(raw?.materials),
                lightingNotes: safeTrim(raw?.lightingNotes),
                referenceImageUrl: '',
                includeInPrompt: true
              };
            });
          }
        }
      }
    } catch (err) {
      if (isParseAbortError(err)) throw err;
      console.warn('LLM world/environment extraction fallback:', err);
    }
  }

  return heuristicWorldAssetsFromShots(shots, projectTitle);
}

