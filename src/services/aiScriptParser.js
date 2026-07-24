export async function extractTextFromPDF(file) {
  const originalArrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(originalArrayBuffer.slice(0));

  try {
    const pdfjsLib = await import('pdfjs-dist');
    const pdfWorkerModule = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerModule.default || pdfWorkerModule;

    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes,
      verbosity: 0,
      isEvalSupported: false
    });
    
    const pdf = await loadingTask.promise;
    let extractedPagesText = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageItems = textContent.items.map(item => item.str);
      const pageText = pageItems.join(' ');
      if (pageText.trim()) {
        extractedPagesText.push(pageText);
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

function parsePdfBinaryAdvanced(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) return "";
  const bytes = new Uint8Array(arrayBuffer);
  let binaryStr = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryStr += String.fromCharCode(bytes[i]);
  }

  const textBlocks = [];
  const tjPattern = /\(([^()]{2,})\)\s*Tj/g;
  let match;

  while ((match = tjPattern.exec(binaryStr)) !== null) {
    const cleanStr = match[1].replace(/\\([0-7]{3}|[()\\n\r\t])/g, '$1').trim();
    if (cleanStr.length > 1 && !cleanStr.startsWith('/')) {
      textBlocks.push(cleanStr);
    }
  }

  if (textBlocks.length > 0) {
    return textBlocks.join('\n');
  }

  const cleanText = binaryStr
    .replace(/\/Contents\s+\d+\s+\d+\s+R/g, '')
    .replace(/\/MediaBox\s*\[[^\]]+\]/g, '')
    .replace(/\/Parent\s+\d+\s+\d+\s+R/g, '')
    .replace(/\/Resources\s*<<[^>]+>>/g, '')
    .replace(/\/Font\s*<<[^>]+>>/g, '')
    .replace(/\/ProcSet\s*\[[^\]]+\]/g, '');

  const asciiBlocks = cleanText.match(/[A-Z0-9\s.,;:'"\-!]{4,}/gi) || [];
  return asciiBlocks.filter(b => b.trim().length > 3).join('\n');
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

function parseRawScriptFallback(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  const rawBlocks = scriptText
    .split(/\n(?=(?:S\d+|SC\.\d+|SC\d+_SH\d+|SHOT\s+\d+|ACT\s+[I|V|X]+|EXT\.|INT\.))/i)
    .map(b => b.trim())
    .filter(Boolean);

  const blocksToProcess = rawBlocks.length > 0 ? rawBlocks : [scriptText];
  const parsedShots = [];

  blocksToProcess.forEach((block, idx) => {
    const textLower = block.toLowerCase();

    const idMatch = block.match(/(S\d{2}-[A-Z]|SC\.\d+|SC\d+_SH\d+|SHOT\s+\d+)/i);
    const shotId = idMatch ? idMatch[1].toUpperCase().replace(/\s+/g, '_') : `SC01_SH${(idx + 1) < 10 ? '0' + (idx + 1) : (idx + 1)}`;

    let framing = "Medium Shot (MS)";
    if (textLower.includes("aerial") || textLower.includes("god's-eye") || textLower.includes("ews")) framing = "Aerial Extreme Wide Shot (EWS)";
    else if (textLower.includes("low-angle") || textLower.includes("low cu")) framing = "Low-Angle Close-Up (CU)";
    else if (textLower.includes("extreme close") || textLower.includes("ecu")) framing = "Extreme Close-Up (ECU)";
    else if (textLower.includes("close-up") || textLower.includes("cu")) framing = "Close-Up (CU)";
    else if (textLower.includes("wide shot") || textLower.includes("ws")) framing = "Wide Shot (WS)";
    else if (textLower.includes("ots")) framing = "Over-The-Shoulder (OTS)";
    else if (textLower.includes("mcu")) framing = "Medium Close-Up (MCU)";

    let cameraMotion = "[Camera: Tracking Shot / Steadicam Follow]";
    if (textLower.includes("push-in") || textLower.includes("dolly")) cameraMotion = "[Camera: Slow Push-In / Dolly Zoom]";
    else if (textLower.includes("crane") || textLower.includes("tilt")) cameraMotion = "[Camera: Slow Crane Rise / Vertical Tilt]";
    else if (textLower.includes("orbit")) cameraMotion = "[Camera: Hero Orbit 180/360 Deg]";
    else if (textLower.includes("whip-pan")) cameraMotion = "[Camera: Fast Whip-Pan Follow]";

    let lighting = "[Lighting: High-Contrast Chiaroscuro Noir]";
    let subjColor = "[Subject Color: Teal & Orange Cinema Palette]";
    let bgLighting = "[BG Lighting: Mood Soft Ambient Falloff]";
    let bgColor = "[BG Color: Deep Midnight Blue & Indigo]";

    if (textLower.includes("saffron") || textLower.includes("rama") || textLower.includes("gold")) {
      lighting = "[Lighting: Warm Saffron & Celestial Gold-Blue Aura]";
      subjColor = "[Subject Color: Saffron & Celestial Blue]";
      bgLighting = "[BG Lighting: Volumetric God Rays blooming warm gold]";
      bgColor = "[BG Color: Soft Amber & Sunset Ochre Gradient]";
    } else if (textLower.includes("kara") || textLower.includes("demon") || textLower.includes("venom")) {
      lighting = "[Lighting: Venom-Green Bioluminescent Strobe]";
      subjColor = "[Subject Color: Charcoal & Venom-Green]";
      bgLighting = "[BG Lighting: Dark Ash-Smoke & Lightning Flash]";
      bgColor = "[BG Color: Deep Obsidian & Poison Green Void]";
    } else if (textLower.includes("neon") || textLower.includes("cyberpunk")) {
      lighting = "[Lighting: Cyberpunk Neon Blue & Pink Dual Glow]";
      subjColor = "[Subject Color: High-Saturation Neo-Noir]";
      bgLighting = "[BG Lighting: Strobing Neon City Reflections]";
      bgColor = "[BG Color: Sci-Fi Hologram Violet & Cyan]";
    }

    let artistId = "[CharID: @LeadArtist_Main - Vocalist / Lead]";
    if (textLower.includes("rama")) artistId = "[CharID: @Lord_Rama - Celestial Blue Skin, Saffron Dhoti]";
    else if (textLower.includes("dhushan")) artistId = "[CharID: @Dhushan_General - Serpent Armour]";
    else if (textLower.includes("kara")) artistId = "[CharID: @Kara_King - Obsidian Armour, Venomous Crown]";
    else if (textLower.includes("aria")) artistId = "[CharID: @LeadSinger_Aria - Vocalist, leather jacket]";

    let coArtist = "[Co-Artist: Backing performers reacting to lead's presence]";
    if (textLower.includes("demon army") || textLower.includes("demons")) {
      coArtist = "[Co-Artist: 14,000 demon legion ranks flinching back in awe & terror]";
    } else if (textLower.includes("crowd") || textLower.includes("band")) {
      coArtist = "[Co-Artist: Backing musicians swaying to rhythm, gazing at lead artist]";
    }

    const quoteMatch = block.match(/"([^"]+)"|'([^']+)'/);
    let dialogue = quoteMatch ? `"${quoteMatch[1] || quoteMatch[2]}"` : '[Silent / Atmospheric Soundtrack / Battle FX Sync]';

    let actionContext = block.replace(/\s+/g, ' ').trim();
    if (actionContext.length > 200) actionContext = actionContext.substring(0, 200) + '...';

    parsedShots.push({
      sceneShotId: shotId,
      shotComposition: framing,
      cameraMotionTag: cameraMotion,
      subjectLightingTag: lighting,
      subjectColorTag: subjColor,
      backgroundLightingTag: bgLighting,
      backgroundColorTag: bgColor,
      characterIdAssetRef: artistId,
      coArtistInteraction: coArtist,
      actionEnvContext: actionContext,
      characterExpression: "Serene and absolute calm, laser-focused gaze",
      characterPlacement: "Foreground center frame, opposing army arrayed in background",
      characterDialogue: dialogue,
      characterMovement: "Standing firm in full hero stance",
      characterEyeLooks: "[Eye Look: Direct Laser Focus on Target / Camera]"
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
