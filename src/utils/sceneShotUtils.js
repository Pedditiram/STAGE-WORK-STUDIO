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
