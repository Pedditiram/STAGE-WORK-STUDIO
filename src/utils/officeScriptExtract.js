/**
 * Extract screenplay text from Word .docx / .doc / RTF / encoded TXT.
 */
import { isZipBytes, readZipEntries } from './zipRead.js';

const SCRIPT_MAX_BYTES = 40 * 1024 * 1024;
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export class OfficeExtractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OfficeExtractError';
    this.code = code;
  }
}

export const OFFICE_EXTRACT_MESSAGES = Object.freeze({
  EMPTY: 'No usable screenplay text in that Word file. Existing project was left unchanged.',
  UNSUPPORTED:
    'Could not read this Word .doc. Save as .docx, PDF, or TXT from Word (File → Save As) and upload that. Existing project was left unchanged.',
  TOO_LARGE: 'File is too large to process (max ~40 MB). Split it or export TXT. Existing project was left unchanged.',
  ENCRYPTED: 'Password-protected Word files are not supported. Save an unprotected copy and retry.'
});

export function isOleBytes(bytes) {
  if (!bytes || bytes.length < 8) return false;
  for (let i = 0; i < OLE_MAGIC.length; i++) {
    if (bytes[i] !== OLE_MAGIC[i]) return false;
  }
  return true;
}

export function looksLikeRtf(textOrBytes) {
  if (typeof textOrBytes === 'string') return /^\s*\{\\rtf/i.test(textOrBytes);
  if (!textOrBytes || textOrBytes.length < 5) return false;
  const head = new TextDecoder('latin1').decode(textOrBytes.subarray(0, 16));
  return /^\s*\{\\rtf/i.test(head);
}

export function decodePlainScriptBytes(bytes) {
  if (!bytes || !bytes.length) return '';
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  // UTF-16 LE without BOM: lots of zeros on odd bytes
  if (bytes.length >= 16) {
    let zeros = 0;
    const sample = Math.min(bytes.length, 400);
    for (let i = 1; i < sample; i += 2) if (bytes[i] === 0) zeros += 1;
    if (zeros / Math.floor(sample / 2) > 0.7) {
      return new TextDecoder('utf-16le').decode(bytes);
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function textFromWordXml(xml) {
  const src = String(xml || '');
  let out = '';
  const re = /<\/w:p\b[^>]*>|<w:tab\b[^>]*\/?>|<w:br\b[^>]*\/?>|<w:cr\b[^>]*\/?>|<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const raw = m[0];
    if (/^<\/w:p/i.test(raw)) out += '\n';
    else if (/^<w:tab/i.test(raw)) out += '\t';
    else if (/^<w:br/i.test(raw) || /^<w:cr/i.test(raw)) out += '\n';
    else out += decodeXmlEntities(m[1] || '');
  }
  return out.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractTextFromDocx(arrayBuffer) {
  const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const entries = await readZipEntries(bytes);
  const doc = entries.find((e) => /(^|\/)word\/document\.xml$/i.test(e.name));
  if (!doc) {
    throw new OfficeExtractError('EMPTY', OFFICE_EXTRACT_MESSAGES.EMPTY);
  }
  const xml = new TextDecoder('utf-8', { fatal: false }).decode(doc.data);
  const text = textFromWordXml(xml);
  if (!text || text.length < 8) {
    throw new OfficeExtractError('EMPTY', OFFICE_EXTRACT_MESSAGES.EMPTY);
  }
  return text;
}

function isScriptCodeUnit(c) {
  if (c === 9 || c === 10 || c === 13 || c === 32) return true;
  if (c >= 33 && c <= 126) return true;
  if (c >= 0x0c00 && c <= 0x0c7f) return true; // Telugu
  if (c >= 0x0900 && c <= 0x097f) return true; // Devanagari
  if (c >= 0x2010 && c <= 0x2027) return true; // dashes / quotes
  if (c >= 0x00a0 && c <= 0x00ff) return true;
  return false;
}

function harvestUtf16Le(bytes) {
  const blocks = [];
  let i = 0;
  while (i + 1 < bytes.length) {
    const c = bytes[i] | (bytes[i + 1] << 8);
    if (!isScriptCodeUnit(c) || c === 0) {
      i += 1;
      continue;
    }
    let j = i;
    let s = '';
    while (j + 1 < bytes.length) {
      const ch = bytes[j] | (bytes[j + 1] << 8);
      if (!isScriptCodeUnit(ch)) break;
      s += String.fromCharCode(ch);
      j += 2;
    }
    const cleaned = s.replace(/\u0000/g, '').replace(/[ \t]{2,}/g, ' ').trim();
    if (cleaned.length >= 8 && /[\u0C00-\u0C7Fa-zA-Z]{3,}/.test(cleaned)) {
      blocks.push(cleaned);
    }
    i = Math.max(j, i + 2);
  }
  return blocks.join('\n');
}

function harvestLatin1Prose(bytes) {
  const out = [];
  let buf = '';
  const flush = () => {
    const cleaned = buf.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]+/g, ' ').replace(/ {2,}/g, ' ').trim();
    buf = '';
    if (cleaned.length < 20) return;
    if (/^(Microsoft|Normal|Times New Roman|Calibri|Cambria|Arial|Heading|Title|Subtitle|TOC)/i.test(cleaned)) {
      return;
    }
    if (!/[A-Za-z]{4,}/.test(cleaned)) return;
    out.push(cleaned);
  };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x0d || b === 0x0a || b === 0x09 || (b >= 0x20 && b < 0x7f)) {
      buf += String.fromCharCode(b === 0x0d ? 10 : b);
    } else {
      flush();
    }
  }
  flush();
  return out.join('\n');
}

export function extractTextFromDoc(arrayBuffer) {
  const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  if (!isOleBytes(bytes)) {
    throw new OfficeExtractError('UNSUPPORTED', OFFICE_EXTRACT_MESSAGES.UNSUPPORTED);
  }
  const utf16 = harvestUtf16Le(bytes);
  const latin = harvestLatin1Prose(bytes);
  const pick =
    utf16.length >= latin.length * 0.6 && utf16.length >= 24 ? utf16 : latin.length >= utf16.length ? latin : utf16;
  const text = String(pick || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text || text.length < 12) {
    throw new OfficeExtractError('UNSUPPORTED', OFFICE_EXTRACT_MESSAGES.UNSUPPORTED);
  }
  return text;
}

export function extractTextFromRtf(source) {
  const raw = typeof source === 'string' ? source : decodePlainScriptBytes(source);
  if (!looksLikeRtf(raw)) return '';
  let s = raw.replace(/\r\n/g, '\n');
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/\{\\\*[^{}]*\}/g, '');
  }
  s = s.replace(/\\'[0-9a-fA-F]{2}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)));
  s = s.replace(/\\u(-?\d+)\??/g, (_, n) => {
    const code = Number(n);
    return String.fromCharCode(code < 0 ? 65536 + code : code);
  });
  s = s.replace(/\\pard\b/g, '\n');
  s = s.replace(/\\par\b/g, '\n');
  s = s.replace(/\\line\b/g, '\n');
  s = s.replace(/\\tab\b/g, '\t');
  s = s.replace(/\\[a-zA-Z]+-?\d* ?/g, '');
  s = s.replace(/\\([{}\\])/g, '$1');
  s = s.replace(/[{}]/g, '');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

export function detectOfficeKind(file, bytes) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (name.endsWith('.docx') || name.endsWith('.docm') || type.includes('wordprocessingml')) return 'docx';
  if (name.endsWith('.doc') || type === 'application/msword') return 'doc';
  if (name.endsWith('.rtf') || type.includes('rtf') || looksLikeRtf(bytes)) return 'rtf';
  if (isZipBytes(bytes) && name.endsWith('.zip')) return null;
  if (isZipBytes(bytes)) return 'docx';
  if (isOleBytes(bytes)) return 'doc';
  if (looksLikeRtf(bytes)) return 'rtf';
  return null;
}

export async function extractOfficeScriptText(file, arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new OfficeExtractError('EMPTY', OFFICE_EXTRACT_MESSAGES.EMPTY);
  }
  if (arrayBuffer.byteLength > SCRIPT_MAX_BYTES) {
    throw new OfficeExtractError('TOO_LARGE', OFFICE_EXTRACT_MESSAGES.TOO_LARGE);
  }
  const bytes = new Uint8Array(arrayBuffer);
  const kind = detectOfficeKind(file, bytes);
  try {
    if (kind === 'rtf' || looksLikeRtf(bytes)) {
      const text = extractTextFromRtf(bytes);
      if (!text || text.length < 8) throw new OfficeExtractError('EMPTY', OFFICE_EXTRACT_MESSAGES.EMPTY);
      return { text, format: 'rtf' };
    }
    if (kind === 'doc' || isOleBytes(bytes)) {
      return { text: extractTextFromDoc(bytes), format: 'doc' };
    }
    if (kind === 'docx' || isZipBytes(bytes)) {
      try {
        return { text: await extractTextFromDocx(bytes), format: 'docx' };
      } catch (e) {
        if (kind === 'docx') throw e;
        return null;
      }
    }
  } catch (e) {
    if (e instanceof OfficeExtractError) throw e;
    if (/password/i.test(e?.message || '')) {
      throw new OfficeExtractError('ENCRYPTED', OFFICE_EXTRACT_MESSAGES.ENCRYPTED);
    }
    throw new OfficeExtractError('UNSUPPORTED', e?.message || OFFICE_EXTRACT_MESSAGES.UNSUPPORTED);
  }
  return null;
}
