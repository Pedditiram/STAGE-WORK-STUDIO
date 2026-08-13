/**
 * Writer Console — Telugu voice → Telugu Unicode only.
 * Web Speech sometimes returns romanized Latin; we prefer Telugu-script
 * alternatives and phonetically convert leftover romanization.
 */

const TE_RANGE = /[\u0C00-\u0C7F]/;
const LATIN_WORD = /[A-Za-z]/;

export function hasTeluguScript(s) {
  return TE_RANGE.test(String(s || ''));
}

export function teluguCharRatio(s) {
  const str = String(s || '');
  if (!str) return 0;
  let te = 0;
  let letters = 0;
  for (const ch of str) {
    if (TE_RANGE.test(ch) || LATIN_WORD.test(ch)) {
      letters += 1;
      if (TE_RANGE.test(ch)) te += 1;
    }
  }
  return letters ? te / letters : 0;
}

/** Among SpeechRecognition alternatives, pick the most Telugu-script result. */
export function pickBestTeluguTranscript(resultListItem) {
  if (!resultListItem || !resultListItem.length) return '';
  let best = '';
  let bestScore = -1;
  const n = Math.min(resultListItem.length, 8);
  for (let i = 0; i < n; i += 1) {
    const t = String(resultListItem[i]?.transcript || '').trim();
    if (!t) continue;
    const score =
      teluguCharRatio(t) * 10 +
      (hasTeluguScript(t) ? 5 : 0) +
      (Number(resultListItem[i].confidence) || 0);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best || String(resultListItem[0]?.transcript || '').trim();
}

/**
 * Phonetic romanized Telugu → తెలుగు (writer / IME style).
 * Speech romanization almost always uses dental త ద న (not retroflex).
 */
const INDEPENDENT_VOWELS = {
  a: 'అ',
  aa: 'ఆ',
  i: 'ఇ',
  ee: 'ఈ',
  ii: 'ఈ',
  u: 'ఉ',
  oo: 'ఊ',
  uu: 'ఊ',
  e: 'ఎ',
  ae: 'ఏ',
  ai: 'ఐ',
  o: 'ఒ',
  au: 'ఔ',
  ru: 'ఋ'
};

const DEPENDENT_VOWELS = {
  a: '',
  aa: 'ా',
  i: 'ి',
  ee: 'ీ',
  ii: 'ీ',
  u: 'ు',
  oo: 'ూ',
  uu: 'ూ',
  e: 'ె',
  ae: 'ే',
  ai: 'ై',
  o: 'ొ',
  au: 'ౌ',
  ru: 'ృ'
};

// Longer keys first. Speech defaults: t/d/n → త/ద/న; T/D/N → ట/డ/ణ via uppercase in source.
const CONSONANTS = [
  ['ksh', 'క్ష'],
  ['chh', 'ఛ'],
  ['shh', 'ష'],
  // Speech often writes sth/ndh as స్త / న్ధ (t/d after cons), not థ/ధ
  ['sth', 'స్త'],
  ['ndh', 'న్ధ'],
  ['kh', 'ఖ'],
  ['gh', 'ఘ'],
  ['ng', 'ఙ'],
  ['ch', 'చ'],
  ['jh', 'ఝ'],
  ['ny', 'ఞ'],
  ['th', 'థ'],
  ['dh', 'ధ'],
  ['ph', 'ఫ'],
  ['bh', 'భ'],
  ['sh', 'శ'],
  ['gn', 'జ్ఞ'],
  ['k', 'క'],
  ['g', 'గ'],
  ['c', 'చ'],
  ['j', 'జ'],
  ['t', 'త'],
  ['d', 'ద'],
  ['n', 'న'],
  ['p', 'ప'],
  ['f', 'ఫ'],
  ['b', 'బ'],
  ['m', 'మ'],
  ['y', 'య'],
  ['r', 'ర'],
  ['l', 'ల'],
  ['v', 'వ'],
  ['w', 'వ'],
  ['s', 'స'],
  ['h', 'హ'],
  ['x', 'క్ష']
];

/** Frequent dictation tokens (roman → script) when ASR returns Latin for te-IN. */
const LEXICON = {
  nenu: 'నేను',
  neenu: 'నేను',
  meeru: 'మీరు',
  miiru: 'మీరు',
  enti: 'ఏంటి',
  emi: 'ఏమి',
  ela: 'ఎలా',
  elaundi: 'ఎలా ఉంది',
  undi: 'ఉంది',
  unnadi: 'ఉన్నది',
  unnaru: 'ఉన్నారు',
  ledu: 'లేదు',
  kaadu: 'కాదు',
  avunu: 'అవును',
  raa: 'రా',
  raandi: 'రాండి',
  cheppu: 'చెప్పు',
  cheyyi: 'చెయ్యి',
  chesthunna: 'చేస్తున్న',
  chesthunnaanu: 'చేస్తున్నాను',
  chesthunnaavu: 'చేస్తున్నావు',
  vastunna: 'వస్తున్న',
  vastunnaanu: 'వస్తున్నాను',
  poyi: 'పోయి',
  namaskaram: 'నమస్కారం',
  namaste: 'నమస్తే',
  dhanyavadalu: 'ధన్యవాదాలు',
  bagundi: 'బాగుంది',
  bagunnara: 'బాగున్నారా',
  entiandi: 'ఏంటండి',
  enduku: 'ఎందుకు',
  eppudu: 'ఎప్పుడు',
  ekkada: 'ఎక్కడ',
  annan: 'అన్నన్',
  anna: 'అన్న',
  annayya: 'అన్నయ్య',
  pinna: 'పిన్న',
  pinnayya: 'పిన్నయ్య',
  kabadi: 'కబడ్డీ',
  kabaddi: 'కబడ్డీ',
  tanuku: 'తణుకు',
  nu: 'ను',
  naa: 'నా',
  nee: 'నీ',
  maa: 'మా',
  mee: 'మీ',
  idi: 'ఇది',
  adi: 'అది',
  ok: 'ఓకే',
  ante: 'అంటే',
  kada: 'కదా',
  ga: 'గా',
  lo: 'లో',
  nundi: 'నుండి',
  varaku: 'వరకు',
  chesina: 'చేసిన',
  chestha: 'చేస్తా',
  chesthanu: 'చేస్తాను',
  unnanu: 'ఉన్నాను',
  unnavu: 'ఉన్నావు',
  unnamu: 'ఉన్నాము',
  vachanu: 'వచ్చాను',
  vellin: 'వెళ్ళిన',
  vellanu: 'వెళ్ళాను'
};

const VOWEL_KEYS = Object.keys(DEPENDENT_VOWELS).sort((a, b) => b.length - a.length);

function takePrefix(s, i, keys) {
  for (const k of keys) {
    if (s.startsWith(k, i)) return k;
  }
  return null;
}

function takeConsonant(s, i) {
  // Retroflex via uppercase T/D/N/L/S in romanization
  const ch = s[i];
  if (ch === 'T') return { key: 'T', letter: 'ట' };
  if (ch === 'D') return { key: 'D', letter: 'డ' };
  if (ch === 'N') return { key: 'N', letter: 'ణ' };
  if (ch === 'L') return { key: 'L', letter: 'ళ' };
  if (ch === 'S') return { key: 'S', letter: 'ష' };
  const slice = s.slice(i).toLowerCase();
  for (const [key, letter] of CONSONANTS) {
    if (slice.startsWith(key)) return { key, letter };
  }
  return null;
}

/** Convert one romanized token (no spaces) to Telugu. */
export function romanTokenToTelugu(token) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  if (hasTeluguScript(raw) && !LATIN_WORD.test(raw)) return raw;

  const lex = LEXICON[raw.toLowerCase()];
  if (lex) return lex;

  let s = raw.replace(/ṁ|ṃ/g, 'm');
  let out = '';
  let i = 0;

  while (i < s.length) {
    if (!/[A-Za-z]/.test(s[i])) {
      out += s[i];
      i += 1;
      continue;
    }

    const cons = takeConsonant(s, i);
    if (cons) {
      i += cons.key.length;
      const v = takePrefix(s.toLowerCase(), i, VOWEL_KEYS);
      if (v) {
        out += cons.letter + DEPENDENT_VOWELS[v];
        i += v.length;
      } else {
        // Half consonant (conjunct / coda) — keep virama
        out += `${cons.letter}్`;
      }
      continue;
    }

    const v = takePrefix(s.toLowerCase(), i, VOWEL_KEYS);
    if (v) {
      out += INDEPENDENT_VOWELS[v] || '';
      i += v.length;
      continue;
    }

    out += s[i];
    i += 1;
  }

  // Spoken words rarely end with explicit virama; open final half-letter
  if (out.endsWith('్')) out = out.slice(0, -1);

  return out || raw;
}

const ENGLISH_STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and', 'or', 'in', 'on', 'for',
  'it', 'this', 'that', 'with', 'from', 'you', 'i', 'we', 'they', 'he', 'she', 'my', 'your',
  'hello', 'okay', 'ok', 'yes', 'no', 'please', 'thanks', 'thank', 'hi', 'hey', 'bye',
  'world', 'what', 'when', 'where', 'why', 'how', 'who', 'which', 'can', 'will', 'would',
  'should', 'could', 'have', 'has', 'had', 'been', 'being', 'do', 'does', 'did', 'not',
  'but', 'if', 'so', 'just', 'like', 'about', 'into', 'over', 'after', 'before', 'then',
  'there', 'here', 'all', 'any', 'some', 'more', 'most', 'other', 'only', 'own', 'same',
  'than', 'too', 'very', 'also', 'now', 'scene', 'shot', 'cut', 'fade', 'action', 'camera'
]);

function isLikelyEnglishOnly(token) {
  const t = String(token).toLowerCase().replace(/[^a-z]/g, '');
  if (!t) return false;
  if (ENGLISH_STOP.has(t)) return true;
  // Strict Telugu mode: Latin without Telugu roman cues is treated as English bleed
  if (!looksLikeRomanTelugu(t) && t.length >= 3) return true;
  return false;
}

function looksLikeRomanTelugu(token) {
  const t = String(token).toLowerCase();
  return (
    /(aa|ee|oo|kh|gh|ch|jh|th|dh|bh|ph|sh|ksh|llu|nna|mma|nt|nd|pr|tr|kr|raa|laa|gaa|naa)/.test(t) ||
    /(namaste|namaskaram|enti|ela|undi|ledu|chesthunna|cheppu|raa|poyi|vastunna|meeru|nenu|miiru)/.test(t)
  );
}

/**
 * Normalize a full voice transcript for Telugu-only insertion.
 */
export function normalizeTeluguVoiceTranscript(text, { forceStrict = true } = {}) {
  const src = String(text || '').trim();
  if (!src) return '';

  const parts = src.split(/(\s+)/);
  const out = parts.map((part) => {
    if (!part || /^\s+$/.test(part)) return part;
    if (hasTeluguScript(part) && !LATIN_WORD.test(part)) return part;
    if (!LATIN_WORD.test(part)) return part;

    const clean = part.replace(/^[.,!?;:]+|[.,!?;:]+$/g, '');
    const punctLead = part.match(/^[.,!?;:]+/)?.[0] || '';
    const punctTrail = part.match(/[.,!?;:]+$/)?.[0] || '';

    if (forceStrict && isLikelyEnglishOnly(clean) && !looksLikeRomanTelugu(clean)) {
      return '';
    }

    return `${punctLead}${romanTokenToTelugu(clean)}${punctTrail}`;
  });

  return out.join('').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Process one SpeechRecognition result index into Telugu-only text.
 */
export function teluguFromSpeechResult(speechResult) {
  const picked = pickBestTeluguTranscript(speechResult);
  if (!picked) return '';
  if (teluguCharRatio(picked) >= 0.55) return picked.trim();
  return normalizeTeluguVoiceTranscript(picked, { forceStrict: true });
}

/** Ensure final insert for te-IN is Telugu script only (strip leftover Latin letters). */
export function enforceTeluguOnly(text) {
  const normalized = normalizeTeluguVoiceTranscript(text, { forceStrict: true });
  // Drop any remaining Latin letters (failed conversion / English bleed)
  return normalized.replace(/[A-Za-z]+/g, '').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Keyboard IME: convert Title-case / ALLCAPS roman as lowercase phonetic
 * so "Nenu" → నేను (not ణెను from capital-N retroflex).
 */
export function romanTokenToTeluguTyping(token) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  if (hasTeluguScript(raw) && !LATIN_WORD.test(raw)) return raw;
  const normalized =
    /^[A-Z][a-z']*$/.test(raw) || /^[A-Z]{2,}$/.test(raw) ? raw.toLowerCase() : raw;
  return romanTokenToTelugu(normalized);
}

/**
 * Commit the Latin word immediately before `caret` to Telugu script.
 * Used when Telugu mode is on and user presses Space / Enter / punctuation.
 * @returns {{ text: string, caret: number } | null}
 */
export function commitRomanWordBeforeCaret(text, caret) {
  const src = String(text || '');
  let end = Math.max(0, Math.min(Number(caret) || 0, src.length));
  let start = end;
  while (start > 0 && /[A-Za-z']/.test(src[start - 1])) start -= 1;
  if (start >= end) return null;

  const word = src.slice(start, end);
  if (!/[A-Za-z]/.test(word)) return null;
  if (hasTeluguScript(word) && !LATIN_WORD.test(word)) return null;

  const converted = romanTokenToTeluguTyping(word);
  if (!converted || converted === word) return null;

  const next = `${src.slice(0, start)}${converted}${src.slice(end)}`;
  return { text: next, caret: start + converted.length, from: word, to: converted };
}
