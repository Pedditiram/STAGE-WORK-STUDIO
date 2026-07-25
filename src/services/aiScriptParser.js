export async function extractTextFromPDF(file) {
  const originalArrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(originalArrayBuffer.slice(0));

  try {
    const pdfjsLib = await import('pdfjs-dist');
    const pdfWorkerModule = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerModule.default || pdfWorkerModule;

    // Enable cMaps for full Indic/Telugu/Unicode font decoding support
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes,
      verbosity: 0,
      isEvalSupported: false,
      cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true
    });
    
    const pdf = await loadingTask.promise;
    let extractedPagesText = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageItems = textContent.items.map(item => item.str);
      const pageText = pageItems.join(' ');
      
      // Clean PDF metadata residual headers
      const cleanPageText = sanitizePdfExtractedText(pageText);
      if (cleanPageText.trim()) {
        extractedPagesText.push(cleanPageText);
      }
    }

    if (extractedPagesText.length > 0) {
      return extractedPagesText.join('\n\n');
    }
  } catch (err) {
    console.warn("PDF.js worker extraction fallback:", err);
  }

  return parsePdfBinaryAdvanced(originalArrayBuffer);
}

function sanitizePdfExtractedText(text) {
  if (!text) return "";
  return text
    // Strip PDF object tags & metadata header leaks
    .replace(/PDF-1\.\d+/gi, '')
    .replace(/\b\d+\s+\d+\s+obj\b/gi, '')
    .replace(/\bendobj\b/gi, '')
    .replace(/\bstream\b/gi, '')
    .replace(/\bendstream\b/gi, '')
    .replace(/\/Title\s+.*?(?=\/|>>|$)/gi, '')
    .replace(/\/Producer\s+.*?(?=\/|>>|$)/gi, '')
    .replace(/Google Docs Renderer/gi, '')
    .replace(/Skia PDF/gi, '')
    .replace(/\/Filter\s*\/[A-Za-z0-9]+/gi, '')
    .replace(/ca\s+\d+|CA\s+\d+|LC\s+\d+|LJ\s+\d+|LW\s+[\d\.]+|ML\s+\d+/g, '')
    .replace(/[\uFFFD]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePdfBinaryAdvanced(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) return "";
  const bytes = new Uint8Array(arrayBuffer);
  
  // Use UTF-8 decoder to preserve Telugu (\u0C00-\u0C7F) and Unicode text correctly
  let decodedStr = '';
  try {
    decodedStr = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch (e) {
    for (let i = 0; i < bytes.length; i++) {
      decodedStr += String.fromCharCode(bytes[i]);
    }
  }

  const textBlocks = [];
  // Match text inside parenthesized PDF strings: (Text Here) Tj or TJ
  const tjPattern = /\(([^()]{2,})\)\s*Tj/gi;
  let match;

  while ((match = tjPattern.exec(decodedStr)) !== null) {
    const rawMatch = match[1];
    const cleanStr = rawMatch
      .replace(/\\([0-7]{3}|[()\\n\r\t])/g, '$1')
      .replace(/[\u0000-\u001F\u7F-\u009F]/g, ' ')
      .trim();

    if (cleanStr.length > 1 && !cleanStr.startsWith('/') && !cleanStr.includes('obj') && !cleanStr.includes('PDF-1.')) {
      textBlocks.push(cleanStr);
    }
  }

  if (textBlocks.length > 0) {
    return sanitizePdfExtractedText(textBlocks.join('\n'));
  }

  // Fallback: Extract all printable Unicode text blocks (including Telugu \u0C00-\u0C7F)
  const unicodeBlocks = decodedStr.match(/[\u0C00-\u0C7FA-Za-z0-9\s.,;:'"\-!?()]{4,}/g) || [];
  const cleanBlocks = unicodeBlocks
    .map(b => sanitizePdfExtractedText(b))
    .filter(b => b.length > 3 && !b.includes('endobj') && !b.includes('Normal endobj'));

  return cleanBlocks.join('\n');
}

/**
 * PARSE RAW SCRIPT TO 15 PRODUCTION SLOTS
 * Uses Google Gemini 2.0 API when provider & key configured in Settings, else fast heuristic fallback.
 */
export async function parseRawScriptToShots(scriptText) {
  const provider = typeof window !== 'undefined' ? (localStorage.getItem('sps_llm_provider') || 'built_in') : 'built_in';
  const apiKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_api_key') || '') : '';

  if (provider === 'google_gemini' && apiKey.trim()) {
    try {
      const prompt = `You are a Hollywood Technical Director and Master Cinematographer. Parse the following screenplay script into a JSON array of 15-slot stage production shots.
Each shot in the JSON array MUST strictly contain these 15 keys:
"sceneShotId", "shotComposition", "cameraMotionTag", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks".

Script to breakdown:
${scriptText.slice(0, 4000)}

Return ONLY valid JSON array without markdown formatting.`;

      let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
      }

      if (response.ok) {
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn("Google Gemini API breakdown fallback:", e);
    }
  }

  // Fallback / Built-In Rule Parser
  return parseRawScriptFallback(scriptText);
}

function smartSegmentTextIntoShots(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  // 1. Check if structured by scene/shot markers (S01, EXT., INT., SHOT)
  const structuredBlocks = scriptText
    .split(/\n(?=(?:S\d+|SC\.\d+|SC\d+_SH\d+|SHOT\s+\d+|ACT\s+[I|V|X]+|EXT\.|INT\.))/i)
    .map(b => b.trim())
    .filter(Boolean);

  if (structuredBlocks.length > 1) return structuredBlocks;

  // 2. Check double linebreaks
  const paraBlocks = scriptText.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  if (paraBlocks.length > 1) return paraBlocks;

  // 3. Single paragraph or unformatted narrative prose!
  // Split by sentence boundaries and cinematic visual markers (e.g. "multiple shots", "grand entry", "closeup", "revealing shot", "next", "then")
  const transitionRegex = /(?:\.\s+|\n+|(?:,\s*)(?=(?:multiple shots|grand entry|revealing shot|closeup shots|close up|close-up|next|then|meanwhile|establishing shot|entry of|holding|shots of|versus|vs|fight|fighting|start a fight)\b))/gi;

  const rawSegments = scriptText
    .split(transitionRegex)
    .map(s => s.replace(/^[\.,;\s]+/, '').trim())
    .filter(s => s.length > 8);

  if (rawSegments.length > 1) return rawSegments;

  // 4. Fallback: split by period or semicolon
  const sentenceSegments = scriptText
    .split(/[.;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 6);

  if (sentenceSegments.length > 1) return sentenceSegments;

  return [scriptText];
}

function parseRawScriptFallback(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  const blocksToProcess = smartSegmentTextIntoShots(scriptText);
  const parsedShots = [];

  blocksToProcess.forEach((block, idx) => {
    const textLower = block.toLowerCase();

    const idMatch = block.match(/(S\d{2}-[A-Z]|SC\.\d+|SC\d+_SH\d+|SHOT\s+\d+)/i);
    const shotId = idMatch ? idMatch[1].toUpperCase().replace(/\s+/g, '_') : `SC01_SH${(idx + 1) < 10 ? '0' + (idx + 1) : (idx + 1)}`;

    let framing = "Medium Shot (MS)";
    if (textLower.includes("aerial") || textLower.includes("god's-eye") || textLower.includes("ews") || textLower.includes("surrounding villages")) {
      framing = "Aerial Extreme Wide Shot (EWS)";
    } else if (textLower.includes("low-angle") || textLower.includes("low cu")) {
      framing = "Low-Angle Close-Up (CU)";
    } else if (textLower.includes("extreme close") || textLower.includes("ecu")) {
      framing = "Extreme Close-Up (ECU)";
    } else if (textLower.includes("closeup") || textLower.includes("close-up") || textLower.includes("cu") || textLower.includes("tying")) {
      framing = "Close-Up (CU)";
    } else if (textLower.includes("wide shot") || textLower.includes("ws") || textLower.includes("establishment") || textLower.includes("entry")) {
      framing = "Wide Shot (WS)";
    } else if (textLower.includes("ots")) {
      framing = "Over-The-Shoulder (OTS)";
    } else if (textLower.includes("mcu")) {
      framing = "Medium Close-Up (MCU)";
    }

    let cameraMotion = "[Camera: Tracking Shot / Steadicam Follow]";
    if (textLower.includes("push-in") || textLower.includes("dolly")) {
      cameraMotion = "[Camera: Slow Push-In / Dolly Zoom]";
    } else if (textLower.includes("crane") || textLower.includes("tilt")) {
      cameraMotion = "[Camera: Slow Crane Rise / Vertical Tilt]";
    } else if (textLower.includes("orbit")) {
      cameraMotion = "[Camera: Hero Orbit 180/360 Deg]";
    } else if (textLower.includes("revealing") || textLower.includes("cloth is removed")) {
      cameraMotion = "[Camera: Slow Epic Reveal / Tilt Up]";
    } else if (textLower.includes("fight") || textLower.includes("fighting")) {
      cameraMotion = "[Camera: Dynamic Handheld Action Orbit]";
    }

    let lighting = "[Lighting: Natural Sunlight & High-Contrast Directional Fill]";
    let subjColor = "[Subject Color: Vibrant Cinema Color Palette]";
    let bgLighting = "[BG Lighting: Soft Natural Ambient Falloff]";
    let bgColor = "[BG Color: Rich Deep Tones]";

    if (textLower.includes("sankranti") || textLower.includes("rooster") || textLower.includes("village") || textLower.includes("bujji") || textLower.includes("raju")) {
      lighting = "[Lighting: Golden Hour Konaseema Festival Sunbeams]";
      subjColor = "[Subject Color: Vibrant Festival Crimson & Golden Earth]";
      bgLighting = "[BG Lighting: Glistening Dusty Festival Crowd Haze]";
      bgColor = "[BG Color: Lush Konaseema Emerald Green & Clay Red]";
    } else if (textLower.includes("saffron") || textLower.includes("rama") || textLower.includes("gold")) {
      lighting = "[Lighting: Warm Saffron & Celestial Gold-Blue Aura]";
      subjColor = "[Subject Color: Saffron & Celestial Blue]";
      bgLighting = "[BG Lighting: Volumetric God Rays blooming warm gold]";
      bgColor = "[BG Color: Soft Amber & Sunset Ochre Gradient]";
    } else if (textLower.includes("neon") || textLower.includes("cyberpunk")) {
      lighting = "[Lighting: Cyberpunk Neon Blue & Pink Dual Glow]";
      subjColor = "[Subject Color: High-Saturation Neo-Noir]";
      bgLighting = "[BG Lighting: Strobing Neon City Reflections]";
      bgColor = "[BG Color: Sci-Fi Hologram Violet & Cyan]";
    }

    // Extract Character ID Asset Ref dynamically from text
    let artistId = "[CharID: @MainArtist_Lead]";
    if (textLower.includes("bujji") && textLower.includes("raju")) {
      artistId = "[CharID: @Bujji_vs_Raju - Champion Rooster Showdown]";
    } else if (textLower.includes("raju")) {
      artistId = "[CharID: @Raju_Rooster - Unbeatable Champion Rooster]";
    } else if (textLower.includes("bujji")) {
      artistId = "[CharID: @Bujji_Rooster - Famous Undefeated Champion]";
    } else if (textLower.includes("rama")) {
      artistId = "[CharID: @Lord_Rama - Celestial Blue Skin, Saffron Dhoti]";
    }

    let coArtist = "[Co-Artist: Surrounding crowd & spectators reacting to scene]";
    if (textLower.includes("rooster") || textLower.includes("fight")) {
      coArtist = "[Co-Artist: Excited village crowd cheering around Sankranti fight arena]";
    }

    const quoteMatch = block.match(/"([^"]+)"|'([^']+)'/);
    let dialogue = quoteMatch ? `"${quoteMatch[1] || quoteMatch[2]}"` : '[Atmospheric Rural Festival Sound & Cheering Crowd]';

    let actionContext = block.replace(/\s+/g, ' ').trim();
    if (actionContext.length > 220) actionContext = actionContext.substring(0, 220) + '...';

    // Automatic Character & Element Extraction for 9 Image Inputs
    const extractedChars = [];
    if (artistId) extractedChars.push(artistId.replace(/\[CharID:\s*/, '').replace(/\]/, '').split('-')[0].trim());
    if (coArtist && !coArtist.includes("Backing performers")) {
      extractedChars.push(coArtist.replace(/\[Co-Artist:\s*/, '').replace(/\]/, '').split('reacting')[0].trim());
    }

    const words = block.match(/@[A-Z][a-zA-Z0-9_]+/g) || [];
    words.forEach(w => {
      if (!extractedChars.includes(w)) extractedChars.push(w);
    });

    const imgBindings = [];
    for (let imgIdx = 0; imgIdx < 9; imgIdx++) {
      if (extractedChars[imgIdx]) {
        imgBindings.push(`Image_${imgIdx + 1}: ${extractedChars[imgIdx]}`);
      }
    }
    if (imgBindings.length === 0) {
      imgBindings.push("Image_1: @MainCharacter", "Image_2: @CoArtist", "Image_3: @EnvironmentBackdrop");
    }

    const durationAndImagesStr = `Duration: 5s | ${imgBindings.join(' | ')}`;

    parsedShots.push({
      sceneShotId: shotId,
      shotComposition: framing,
      cameraMotionTag: cameraMotion,
      subjectLightingTag: lighting,
      subjectColorTag: subjColor,
      backgroundLightingTag: bgLighting,
      backgroundColorTag: bgColor,
      atmosphereVolumetricsTag: "[Atmosphere: Warm Festival Haze & Dust Motes]",
      characterIdAssetRef: artistId,
      coArtistInteraction: coArtist,
      actionEnvContext: actionContext,
      characterExpression: "Intense competitive energy and focused determination",
      characterPlacement: "Center frame focus, surrounding crowd in background",
      characterDialogue: dialogue,
      characterMovement: "Dynamic movement focused on action sequence",
      characterEyeLooks: "[Eye Look: Direct Laser Focus on Opponent / Arena Target]",
      shotDurationAndImages: durationAndImagesStr
    });
  });

  return parsedShots;
}

export async function generateScriptFromConcept(conceptPrompt, shotCount = 5) {
  const provider = typeof window !== 'undefined' ? (localStorage.getItem('sps_llm_provider') || 'built_in') : 'built_in';
  const apiKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_api_key') || '') : '';

  if (provider === 'google_gemini' && apiKey.trim()) {
    try {
      const prompt = `Generate exactly ${shotCount} stage production shots as a JSON array for this creative concept: "${conceptPrompt}".
Each shot in the JSON array MUST contain these 15 keys:
"sceneShotId", "shotComposition", "cameraMotionTag", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks".

Return ONLY valid JSON array without markdown codeblocks.`;

      let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
      }

      if (response.ok) {
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn("Google Gemini concept generator fallback:", e);
    }
  }

  return generateScriptFromConceptFallback(conceptPrompt, shotCount);
}

function generateScriptFromConceptFallback(conceptPrompt, shotCount = 5) {
  const conceptLower = conceptPrompt.toLowerCase();
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
    "[Co-Artist: Backing musicians swaying to rhythm, gazing at lead artist]",
    "[Co-Artist: Secondary dancer mirroring lead performer's choreography in background]",
    "[Co-Artist: Co-singer stepping up to microphone for harmonized duet reaction]",
    "[Co-Artist: Surrounding band members exchanging intense smiles with main artist]",
    "[Co-Artist: Shocked co-star stepping backward in awe of lead's solo]"
  ];

  for (let i = 0; i < shotCount; i++) {
    const num = i + 1;
    const shotId = `SC01_SH${num < 10 ? '0' + num : num}`;

    shots.push({
      sceneShotId: shotId,
      shotComposition: compositions[i % compositions.length],
      cameraMotionTag: motions[i % motions.length],
      subjectLightingTag: i % 2 === 0 ? "[Lighting: Cyberpunk Neon Blue & Pink Dual Glow]" : "[Lighting: Rembrandt 3-Point Classic]",
      subjectColorTag: i % 2 === 0 ? "[Subject Color: High-Saturation Neo-Noir]" : "[Subject Color: Teal & Orange Cinema Palette]",
      backgroundLightingTag: "[BG Lighting: Strobing Neon City Reflections]",
      backgroundColorTag: "[BG Color: Deep Midnight Blue & Indigo]",
      characterIdAssetRef: i % 2 === 0 ? "[CharID: @LeadSinger_Aria - Vocalist, leather jacket]" : "[CharID: @Guitarist_Leo - Lead guitarist, cyber visor]",
      coArtistInteraction: reactions[i % reactions.length],
      actionEnvContext: `Sequence #${num} for ${conceptPrompt}. Setting: ${conceptPrompt}.`,
      characterExpression: i % 2 === 0 ? "Passionate singing, eyes closed in deep emotion" : "Fierce vocal power, teeth grit in intense energy",
      characterPlacement: "Foreground center stage, co-artists positioned in midground left & right",
      characterDialogue: `"${conceptPrompt.substring(0, 20)}... Part ${num}"`,
      characterMovement: i % 2 === 0 ? "Grasping microphone stand with both hands leaning forward" : "Striking a powerful guitar bend pose, body angled 45 degrees",
      characterEyeLooks: "[Eye Look: Direct Eye Contact with Camera Lens]"
    });
  }

  return shots;
}
