/**
 * SCENE & SHOT IDENTIFIER UTILITY
 * Production-ready parser & formatter for Scene/Shot IDs across all screenplay formats (SC09_SH28, S09-C, S09-28, SC.09, SHOT 28).
 */

export function parseSceneAndShotID(shotOrId, idx = 0) {
  let rawId = '';
  let shotObj = {};

  if (typeof shotOrId === 'string') {
    rawId = shotOrId.trim();
  } else if (shotOrId && typeof shotOrId === 'object') {
    shotObj = shotOrId;
    rawId = (shotOrId.sceneShotId || '').trim();
  }

  const shotNumFallback = idx + 1;
  const shotNumPaddedFallback = String(shotNumFallback).padStart(2, '0');

  let sceneNum = null;
  let shotNum = null;
  let shotLetterCode = '';

  if (rawId) {
    // 1. Match patterns like: SC09_SH28, SC9_SH28, SC.09_SH28, SC09-SH28, SC09_S28
    const scShMatch = rawId.match(/(?:SC|SCENE)\.?\s*0*(\d+)[\s_,-]*(?:SH|S|SHOT)?\.?\s*0*(\d+|[A-Z]+)/i);
    if (scShMatch) {
      sceneNum = parseInt(scShMatch[1], 10);
      const secondPart = scShMatch[2];
      if (/^\d+$/.test(secondPart)) {
        shotNum = parseInt(secondPart, 10);
      } else {
        shotLetterCode = secondPart.toUpperCase();
      }
    } else {
      // 2. Match patterns like: S09-C, S09-A, S09-28, S9-28, S09_C
      const sDashMatch = rawId.match(/^S0*(\d+)[\s_,-]+(?:SH|S|SHOT)?\.?\s*0*(\d+|[A-Z]+)$/i);
      if (sDashMatch) {
        sceneNum = parseInt(sDashMatch[1], 10);
        const secondPart = sDashMatch[2];
        if (/^\d+$/.test(secondPart)) {
          shotNum = parseInt(secondPart, 10);
        } else {
          shotLetterCode = secondPart.toUpperCase();
        }
      } else {
        // 3. Extract scene number from string if present (e.g. SC09, SC.09, S09)
        const sceneMatch = rawId.match(/(?:SC|SCENE|S)\.?\s*0*(\d+)/i);
        if (sceneMatch) {
          sceneNum = parseInt(sceneMatch[1], 10);
        }

        // 4. Extract shot number from string if present (e.g. SH28, SHOT 28, _28)
        const shotMatch = rawId.match(/(?:SH|SHOT)[\s_,-]*0*(\d+)/i) || rawId.match(/[\s_-]0*(\d+)$/);
        if (shotMatch) {
          shotNum = parseInt(shotMatch[1], 10);
        }
      }
    }
  }

  // Fallback: If sceneNum is missing, try extracting from shot object fields (actionEnvContext, sceneSynopsis, sceneHeading)
  if (sceneNum === null && shotObj) {
    const envStr = `${shotObj.actionEnvContext || ''} ${shotObj.sceneSynopsis || ''} ${shotObj.sceneHeading || ''}`;
    const envSceneMatch = envStr.match(/(?:SCENE|SC)\.?\s*0*(\d+)/i);
    if (envSceneMatch) {
      sceneNum = parseInt(envSceneMatch[1], 10);
    }
  }

  // Final fallback values
  if (sceneNum === null || isNaN(sceneNum)) {
    sceneNum = Math.floor(idx / 3) + 1; // Logical scene grouping fallback
  }

  if (shotNum === null || isNaN(shotNum)) {
    shotNum = shotNumFallback;
  }

  const sceneTag = `SCENE ${String(sceneNum).padStart(2, '0')}`;
  const sceneNumber = sceneNum;
  const sceneStr = `SC${String(sceneNum).padStart(2, '0')}`;
  const shotStr = shotLetterCode ? `SH${shotLetterCode}` : `SH${String(shotNum).padStart(2, '0')}`;
  const formattedId = `${sceneStr}, ${shotStr}`;
  const shortId = `${sceneStr}_${shotStr}`;

  return {
    sceneNum,
    sceneNumber,
    sceneStr,
    sceneTag,
    shotNum,
    shotStr,
    shotLetterCode,
    formattedId,
    shortId,
    rawId: rawId || shortId
  };
}

/**
 * Returns formatted shot string for prompts: "SC09, SH28"
 */
export function formatShotIdForPrompt(shotOrId, idx = 0) {
  return parseSceneAndShotID(shotOrId, idx).formattedId;
}

/**
 * Returns clean short filename for exports: "SC09_SH28.txt"
 */
export function formatShotFilename(shotOrId, idx = 0, ext = 'txt') {
  const parsed = parseSceneAndShotID(shotOrId, idx);
  return `${parsed.shortId}.${ext}`;
}

/**
 * Build a readable scene-group banner heading from shot craft fields.
 * Prefer production-bible titles like:
 *   "DEMON REVEAL · WIDE APPROACH — The Black Storm — Kara's Army Descends"
 * over raw synopsis dumps (title pages, timecodes, "Featuring …").
 */
export function deriveSceneGroupHeading(shotsOrTexts, sceneNum) {
  const n = Number(sceneNum);
  const pad = Number.isFinite(n) && n > 0 ? String(n).padStart(2, '0') : '01';
  const fallback = `SCENE ${pad} PRODUCTION SEQUENCE`;

  const texts = (Array.isArray(shotsOrTexts) ? shotsOrTexts : [])
    .flatMap((item) => {
      if (typeof item === 'string') return [item];
      if (!item || typeof item !== 'object') return [];
      return [item.sceneSynopsis, item.actionEnvContext, item.sceneHeading, item.shotComposition];
    })
    .map((t) => String(t || '').replace(/^Scene Location & Context:\s*/i, '').trim())
    .filter(Boolean);

  if (!texts.length) return fallback;

  const normalizeSpaces = (s) => String(s || '').replace(/[\u00A0\s]+/g, ' ').trim();

  for (const raw of texts) {
    const t = normalizeSpaces(raw);
    if (!t) continue;
    // Skip cover / prompt dumps
    if (/RAMAYANA\s*·\s*ACTION SCRIPT|IMAGE PROMPT|PART ONE|Complete shot-by-shot/i.test(t) && !/SC\.?\s*0*\d+/i.test(t)) {
      continue;
    }

    const mm = t.match(
      new RegExp(
        String.raw`SC\.?\s*0*${n}\s+\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}:\d{2}\s+(.+?)\s+(\d{1,3})\s*sec`,
        'i'
      )
    );
    if (!mm) continue;

    const body = normalizeSpaces(mm[1]);
    // ALL-CAPS tag with middle dot, then mixed-case poetic title
    const parts = body.match(/^((?:[A-Z0-9/'’]+|·|\s)+?)\s+([A-Z][a-z].*)$/);
    if (parts) {
      const tag = normalizeSpaces(parts[1]).replace(/\s*·\s*/g, ' · ');
      const poetic = normalizeSpaces(parts[2])
        .replace(/\s*Featuring\b.*$/i, '')
        .replace(/\s*Kara-Dhushan War\s*·\s*\d+\s*\/\s*\d+\s*$/i, '')
        .trim();
      if (tag.includes('·') && poetic) return `${tag} — ${poetic}`;
      if (tag.includes('·')) return tag;
    }

    if (/^[A-Z0-9/'’\s·]+$/.test(body) && body.includes('·')) {
      return normalizeSpaces(body).replace(/\s*·\s*/g, ' · ');
    }
  }

  // Fallback: first clean TITLE · SUBTITLE (not cover page)
  for (const raw of texts) {
    const t = normalizeSpaces(raw);
    const mid = t.match(/\b([A-Z][A-Z0-9/'’ ]{1,40}·\s*[A-Z][A-Z0-9/'’ ]{1,40})\b/);
    if (mid && !/ACTION SCRIPT|RAMAYANA/i.test(mid[1])) {
      return normalizeSpaces(mid[1]).replace(/\s*·\s*/g, ' · ');
    }
  }

  // Last resort: short cleaned synopsis without noise
  for (const raw of texts) {
    let t = normalizeSpaces(raw)
      .replace(/\bFeaturing\b.*/i, '')
      .replace(/\bPNO:[A-Z0-9:]+\b/gi, '')
      .replace(/-(?:BOLD|OBLIQUE|REGULAR|ITALIC)/gi, '')
      .trim();
    if (!t || t.length < 8) continue;
    if (/RAMAYANA\s*·\s*ACTION SCRIPT|IMAGE PROMPT|PAGEMODE/i.test(t)) continue;
    if (/^[A-Z0-9_:\-!?\s]{40,}$/.test(t)) continue;
    if (t.length > 90) t = `${t.slice(0, 90).trim()}…`;
    return t;
  }

  return fallback;
}

