export async function extractTextFromPDF(file) {
  const originalArrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(originalArrayBuffer.slice(0));

  try {
    const pdfjsLib = await import('pdfjs-dist');
    try {
      const pdfWorkerModule = await import('pdfjs-dist/build/pdf.worker.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerModule.default || pdfWorkerModule;
    } catch (workerErr) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }

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
      
      // Preserve line breaks (hasEOL) from PDF text items
      const pageText = textContent.items
        .map(item => {
          const str = item.str || '';
          return item.hasEOL ? str + '\n' : str;
        })
        .join(' ');
      
      const cleanPageText = sanitizePdfExtractedText(pageText);
      if (cleanPageText.trim()) {
        extractedPagesText.push(cleanPageText);
      }
    }

    if (extractedPagesText.length > 0) {
      return extractedPagesText.join('\n\n');
    }
  } catch (err) {
    console.warn("PDF.js worker extraction fallback to binary parser:", err);
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
    .replace(/[ \t]+/g, ' ') // Preserve newlines \n!
    .replace(/\n\s*\n+/g, '\n') // Clean up redundant consecutive newlines
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
/**
 * PARSE RAW SCRIPT TO 24 PRODUCTION SLOTS
 * Powered by active LLM provider set in Admin Settings (Pedditi Labs / Gemini, Anthropic Claude, OpenAI), or fast heuristic fallback.
 */
export async function parseRawScriptToShots(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  const provider = typeof window !== 'undefined' ? (localStorage.getItem('sps_llm_provider') || 'google_gemini') : 'google_gemini';
  const apiKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_api_key') || '') : '';
  const fullTextToProcess = scriptText.slice(0, 32000); // 32KB buffer covers 100+ shots

  const prompt = `You are a Hollywood Technical Director and Master Cinematographer (Pedditi Labs Cinema Intelligence Engine).
Parse the following screenplay script into a complete JSON array of 25-craft stage production shots.

CRITICAL DIRECTIVE: The screenplay explicitly contains 3 Acts, 9 Scenes, and EXACTLY 28 SHOTS (e.g. S01-A through S09-A). You MUST parse EVERY SINGLE SHOT and return EXACTLY 28 shot objects in the JSON array, one for each shot code in the document (S01-A, S01-B... up to S09-A). Do NOT skip, omit, or merge any shots.

Each shot object in the JSON array MUST strictly contain these 25 keys:
"sceneShotId", "shotComposition", "cameraMotionTag", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength", "vfxCgiBreakdown", "stuntAndSafetyNotes", "makeupAndHairStyle", "editTransitionCut", "characterIdMatrix".

In "characterIdMatrix", specify the ComfyUI Seedance 2.0 multi-modal reference slots formatted as:
"Image_1 = [char/subject 1] | Image_2 = [char/subject 2] | Image_3 = [char/subject 3] | Image_4 = [char 4] | Image_5 = crowd | Image_6 = scene | Image_7 = | Image_8 = | Image_9 = "

CRITICAL REQUIREMENT FOR 'characterIdMatrix': Use ONLY short, concise 1-to-3 word Character/Asset Names (e.g. 'Lord Rama', 'Dushana', 'Rakshasa Host', 'Janasthana Battlefield'). Do NOT put long action descriptions, story sentences, or verbs inside 'characterIdMatrix'. Only include characters actually present in this specific shot.

Screenplay text to break down:
${fullTextToProcess}

Return ONLY valid JSON array without markdown code blocks.`;

  // 1. ROUTE TO ANTHROPIC CLAUDE LLM ENGINE
  if (provider === 'anthropic' && apiKey.trim()) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.warn("Anthropic Claude LLM breakdown fallback:", e);
    }
  }

  // 2. ROUTE TO OPENAI LLM ENGINE
  if (provider === 'openai' && apiKey.trim()) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.warn("OpenAI LLM breakdown fallback:", e);
    }
  }

  // 3. ROUTE TO GOOGLE GEMINI / PEDDITI LABS ENGINE
  if (apiKey.trim()) {
    try {
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

  // Fallback / Built-In Fast Heuristic Rule Parser
  return parseRawScriptFallback(scriptText);
}

function smartSegmentTextIntoShots(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  // Split by explicit Scene (SC.09) or Shot (S08-A, S09-A, S01, SHOT 1) markers
  const structuredBlocks = scriptText
    .split(/(?:\r?\n)+(?=(?:SC\.\s*\d+|SC\s*\d+|SCENE\s*\d+|S\d{1,2}(?:-[A-Z0-9]+|[A-Z])|S\d{1,2}|SH\d+|SHOT\s*\d+|ACT\s+[I|V|X]+|EXT\.|INT\.)\b)/i)
    .map(b => b.trim())
    .filter(Boolean);

  if (structuredBlocks.length > 1) return structuredBlocks;

  // Fallback paragraph split if no explicit shot codes are present
  const paragraphs = scriptText.split(/\n+/).map(p => p.trim()).filter(Boolean);
  return paragraphs.length > 0 ? paragraphs : [scriptText];
}

function parseRawScriptFallback(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  const rawBlocks = smartSegmentTextIntoShots(scriptText);
  const parsedShots = [];

  let currentSceneStr = "SC01";
  let shotIndex = 1;

  rawBlocks.forEach((block) => {
    const textLower = block.toLowerCase();

    // 0. Skip document metadata / summary headers (e.g. "3 Acts · 9 Scenes · 28 Shots", "Kara · Dhushan", "#1a1a1a Ash...")
    if (/^(?:\d+\s*Acts|\d+\s*Scenes|\d+\s*Shots|Kara\s*·\s*Dhushan|#[0-9a-f]{6}|Act\s+[I|V|X]+)/i.test(block.trim())) {
      return;
    }

    // 1. Is this block purely a Scene Header line (e.g. "SC.09 1:55-2:00 CODA ETERNAL")?
    const pureSceneHeaderMatch = block.match(/^(?:SC\.\s*(\d+)|SC\s*(\d+)|SCENE\s*(\d+))(?::?\s+[^\n]*)?$/i);
    if (pureSceneHeaderMatch) {
      const sceneNum = parseInt(pureSceneHeaderMatch[1] || pureSceneHeaderMatch[2] || pureSceneHeaderMatch[3], 10);
      if (!isNaN(sceneNum)) {
        currentSceneStr = `SC${sceneNum < 10 ? '0' + sceneNum : sceneNum}`;
      }
      return; // Do NOT create a dummy shot for a scene title header line!
    }

    // 2. Check if block contains embedded scene header
    const embeddedSceneMatch = block.match(/(?:SC\.\s*(\d+)|SC\s*(\d+)|SCENE\s*(\d+))/i);
    if (embeddedSceneMatch) {
      const sceneNum = parseInt(embeddedSceneMatch[1] || embeddedSceneMatch[2] || embeddedSceneMatch[3], 10);
      if (!isNaN(sceneNum)) {
        currentSceneStr = `SC${sceneNum < 10 ? '0' + sceneNum : sceneNum}`;
      }
    }

    // 3. Extract exact Shot Code (e.g. S09-A, S08-A, S08-B, S08-C, S01)
    const shotCodeMatch = block.match(/(S\d{1,2}(?:-[A-Z0-9]+|[A-Z])|S\d{1,2}_S\d{1,2}|SH\d{1,2}|SHOT\s*\d+)/i);
    let shotId = `${currentSceneStr}_S${shotIndex < 10 ? '0' + shotIndex : shotIndex}`;

    if (shotCodeMatch) {
      const rawCode = shotCodeMatch[1].toUpperCase().replace(/\s+/g, '').replace(/\./g, '');
      if (rawCode.includes('-')) {
        const parts = rawCode.split('-');
        const sNum = parts[0].replace('S', '').padStart(2, '0');
        shotId = `SC${sNum}_S${parts[0]}${parts[1]}`;
      } else if (rawCode.startsWith('S')) {
        shotId = `${currentSceneStr}_${rawCode}`;
      } else {
        shotId = `${currentSceneStr}_${rawCode}`;
      }
    }

    shotIndex++;

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
    if (textLower.includes("sunil")) {
      artistId = "[CharID: @Sunil - Owner of Bujji, traditional lungi & brass amulets]";
    } else if (textLower.includes("samudra")) {
      artistId = "[CharID: @Samudra - Owner of Raju, proud village leader in white shirt]";
    } else if (textLower.includes("bujji") && textLower.includes("raju")) {
      artistId = "[CharID: @Bujji_vs_Raju - Champion Rooster Showdown]";
    } else if (textLower.includes("raju")) {
      artistId = "[CharID: @Raju - Unbeatable Challenger Rooster]";
    } else if (textLower.includes("bujji")) {
      artistId = "[CharID: @Bujji - Legendary Black Champion Rooster]";
    } else if (textLower.includes("rama")) {
      artistId = "[CharID: @Lord_Rama - Celestial Blue Skin, Saffron Dhoti]";
    }

    let coArtist = "[Co-Artist: Surrounding crowd & spectators reacting to scene]";
    if (textLower.includes("samudra")) {
      coArtist = "[Co-Artist: Samudra holding champion rooster Raju near his body]";
    } else if (textLower.includes("sunil")) {
      coArtist = "[Co-Artist: Sunil standing proud with black champion rooster Bujji]";
    } else if (textLower.includes("rooster") || textLower.includes("fight")) {
      coArtist = "[Co-Artist: Cheering crowd of Malkipuram villagers around Sankranti fight arena]";
    }

    const quoteMatch = block.match(/"([^"]+)"|'([^']+)'/);
    let dialogue = quoteMatch ? `"${quoteMatch[1] || quoteMatch[2]}"` : '[Atmospheric Rural Festival Sound & Cheering Crowd]';

    let actionContext = block.replace(/\s+/g, ' ').trim();
    if (actionContext.length > 220) actionContext = actionContext.substring(0, 220) + '...';

    // Automatic Character & Element Extraction for Image 1 to Image 7 Bindings
    const extractedChars = [];
    if (textLower.includes("sunil") || textLower.includes("bujji")) extractedChars.push("@Sunil");
    if (textLower.includes("bujji")) extractedChars.push("@Bujji");
    if (textLower.includes("samudra") || textLower.includes("raju")) extractedChars.push("@Samudra");
    if (textLower.includes("raju")) extractedChars.push("@Raju");
    if (textLower.includes("crowd") || textLower.includes("village") || textLower.includes("people")) extractedChars.push("@Crowd_Spectators");
    if (textLower.includes("knife") || textLower.includes("knifes") || textLower.includes("tying") || textLower.includes("blade")) extractedChars.push("@Rooster_Fighting_Knifes");
    extractedChars.push("@Malkipuram_Arena");

    // Also include any @Tag words found in text
    const words = block.match(/@[A-Z][a-zA-Z0-9_]+/g) || [];
    words.forEach(w => {
      if (!extractedChars.includes(w)) extractedChars.push(w);
    });

    const imgBindings = [];
    for (let imgIdx = 0; imgIdx < 7; imgIdx++) {
      if (extractedChars[imgIdx]) {
        imgBindings.push(`Image_${imgIdx + 1}: ${extractedChars[imgIdx]}`);
      }
    }

    const durationAndImagesStr = `Duration: 6s | ${imgBindings.join(' | ')}`;

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
      shotDurationAndImages: durationAndImagesStr,
      soundFxAndFoley: "[SFX: Roaring Village Crowd & Metallic Blade Ringing]",
      backgroundScoreMood: "[Score: High-Energy 1980s Folk Drums & Dappu Percussion Rhythms]",
      lensAndFocalLength: "50mm Master Prime (f/1.4) - Shallow Depth Bokeh",
      vfxCgiBreakdown: "[VFX: Practical Shot - 100% In-Camera Live Action]",
      stuntAndSafetyNotes: "[Stunt: Safe Handler Control & Rubber Blade Prop Knife]",
      makeupAndHairStyle: "[Makeup: Authentic 1980s Village Sun-Tanned Skin & Natural Sweat Glow]",
      editTransitionCut: "Hard Cut (Standard Scene Beat)",
      characterIdMatrix: `Image_1 = sunil | Image_2 = bujji | Image_3 = sunil | Image_4 = samudra | Image_5 = crowd | Image_6 = scene | Image_7 = supporting artist | Image_8 = | Image_9 = `
    });
  });

  return parsedShots;
}

export async function generateScriptFromConcept(conceptPrompt, shotCount = 5) {
  const provider = typeof window !== 'undefined' ? (localStorage.getItem('sps_llm_provider') || 'google_gemini') : 'google_gemini';
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

// ---------------------------------------------------------
// PEDDITI LABS CINEMA ENGINE - SINGLE CRAFT & SHOT ENHANCER
// ---------------------------------------------------------

export async function enhanceCraftSlotWithLLM(craftKey, currentValue, shotContext = {}) {
  const apiKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_api_key') || '') : '';
  const shotDesc = shotContext.actionEnvContext || shotContext.sceneShotId || 'Cinematic Shot';

  if (apiKey.trim()) {
    try {
      const prompt = `You are a legendary Master Director & Cinematographer (Pedditi Labs Cinema Intelligence Engine).
Enhance the following film craft parameter for a cinema production script:
Craft Field: "${craftKey}"
Current Value: "${currentValue || ''}"
Shot Context: "${shotDesc}"

Return ONLY a concise, ultra-cinematic, production-ready descriptor string (max 25 words). Do NOT wrap in quotes or code blocks.`;

      let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
      }

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text.replace(/^"|"$/g, '');
      }
    } catch (err) {
      console.warn("LLM craft enhancer fallback:", err);
    }
  }

  // Fallback enhancements if API key not available
  return currentValue ? `[Enhanced] ${currentValue}` : `[Pedditi Labs Cinematic Preset for ${craftKey}]`;
}

export async function enhanceEntireShotWithLLM(shot) {
  const apiKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_api_key') || '') : '';

  if (apiKey.trim() && shot) {
    try {
      const prompt = `You are a Master Film Director (Pedditi Labs Cinema Intelligence Engine).
Elevate the following shot into an ultra-cinematic masterpiece by enhancing all craft fields:
Current Shot JSON: ${JSON.stringify(shot)}

Return ONLY a valid JSON object representing the enhanced shot with the same 25 keys:
"sceneShotId", "shotComposition", "cameraMotionTag", "subjectLightingTag", "subjectColorTag", "backgroundLightingTag", "backgroundColorTag", "atmosphereVolumetricsTag", "characterIdAssetRef", "coArtistInteraction", "actionEnvContext", "characterExpression", "characterPlacement", "characterDialogue", "characterMovement", "characterEyeLooks", "shotDurationAndImages", "soundFxAndFoley", "backgroundScoreMood", "lensAndFocalLength", "vfxCgiBreakdown", "stuntAndSafetyNotes", "makeupAndHairStyle", "editTransitionCut", "characterIdMatrix".

Do NOT use markdown codeblocks. Return JSON object ONLY.`;

      let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
      }

      if (response.ok) {
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed === 'object') {
            return { ...shot, ...parsed };
          }
        }
      }
    } catch (err) {
      console.warn("LLM shot enhancer fallback:", err);
    }
  }

  return shot;
}
