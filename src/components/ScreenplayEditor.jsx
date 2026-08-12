import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Sparkles, Wand2, Play, Download, Copy, Check, RefreshCw, 
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Layers, Sliders, Eye,
  Scroll, BookOpen, Save, Edit3, Cpu, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { parseRawScriptToShots, extractMasterScriptSynopsisWithLLM, getLastParseMeta } from '../services/aiScriptParser';

const DEFAULT_SAMPLE_SCREENPLAY = `ACT I: THE THREAT OF JANASTHANA — DEMON LEGION ARRIVES

SC.01 0:00-0:30 OMINOUS DUSK FOREBODING
EXT. PANCHAVATI FOREST CLEARING - DUSK

Dappled sunlight pierces through dense canopy as ancient banyan trees sway gently in the evening breeze. Soft forest mist settles over golden sands.

[SHOT S01-A]: Extreme Wide Panorama High Angle Vista
Camera: Slow Forward Dolly Push
Lighting: Dappled Sunlight through Dense Canopy
Subject Color: Deep Emerald Green & Silk Ivory

LORD RAMA stands on a moss-covered boulder, gazing toward the dark horizon with serene confidence. KODANDA BOW rests in his left hand.

LAKSHMANA
(whispering, vigilant)
Brother... the air turns heavy. The birds have fled the eastern ridge.

RAMA
(calm, steady)
The forest senses what comes, Lakshmana. Keep Sita within the inner sanctuary.

[SHOT S01-B]: Medium Close-Up Portrait
Camera: Static Anchor with Subtle Zoom
Lighting: Chiaroscuro Rim Light
LAKSHMANA nods solemnly, drawing his sword halfway from its scabbard.

[SHOT S01-C]: MCU Intercut Quick Cuts
Camera: Rapid Motion Whip Cut
Snarling demon legion silhouettes crest the eastern ridge under venom-green smoke.

[SHOT S01-D]: OTS Back Wide Hold
Camera: Static Anchor
Over Rama's shoulder — alone at forest's edge in saffron dhoti, divine blue skin. He nocks an arrow.

SC.02 0:30-1:05 WAR CHARIOT APPROACH & DIVINE AWAKENING
EXT. JANASTHANA FRONTLINE - CONTINUOUS

[SHOT S02-A]: Extreme Wide Action Vista
Camera: Fast Crash Zoom
Lighting: Harsh Scorching Solar Glow

DUSHANA'S WAR CHARIOT rumbles through the dust, pulled by four black armored war horses with glowing red eyes.

DUSHANA
(roaring to his vanguard)
Forward! Crush the hermit warrior before sunfall!

[SHOT S02-B]: Low Angle Hero Tracking
Camera: Tracking Shot alongside Chariot Wheels
Subject Color: Dark Obsidian Armor & Gold Rim

DUSHANA brandishes his massive spiked iron mace, eyes gleaming with fiery wrath.

[SHOT S02-C]: Medium Wide Frontal Charge
Camera: Side Tracking Arc
Lighting: High Contrast Chiaroscuro Noir

Demonic ranks surge behind him like a dark ocean of bronze armor and floating embers.

ACT II: BOW OF THE UNIVERSE — THE SLAYING BEGINS

SC.03 1:05-1:25 DUSHANA'S VANGUARD CHARGE
EXT. BATTLEFIELD CLEARING - DAY

[SHOT S03-A]: Low Angle Ground Sweep
Camera: 360-Degree Orbit
RAMA steps down onto the battlefield. His aura flares with divine solar radiance.

RAMA
(facing 14,000 host)
Stand down, Rakshasas of Janasthana, or face the judgement of Shiva's bow.

[SHOT S03-B]: Wide Trailing Whip Pan
Camera: Tracking Whip Pan
Arrows arc in golden trails — each splits into cascades mid-flight. Demon front rank vaporises.

[SHOT S03-C]: Medium Side Intercut
Camera: Steadicam Orbit
Demon commanders roar and rally as wave after wave charges from grey mist.

[SHOT S03-D]: Low Dutch Steadicam Orbit
Camera: Low Dutch Steadicam
Celestial blue aura deflects every projectile. Rama draws again.

SC.04 1:25-1:50 DHUSHAN'S CHARGE · GENERAL'S WRATH
EXT. JANASTHANA BATTLEGROUND - CONTINUOUS

[SHOT S04-A]: Low Wide Push Forward Fast
Camera: Fast Push
DHUSHAN — towering, veins of poison-green electricity across armor. Charges on war elephant.

[SHOT S04-B]: POV Charge Shaky-Cam Rush
Camera: Shaky-Cam POV
Dhushan's POV: Rama a lone saffron flame in the grey world ahead.

[SHOT S04-C]: ECU Intercut Match Cut
Camera: ECU Match Cut
Rama selects the Vayavya astra. Arrow glows blue-white. Wind stops, then erupts.

SC.05 1:50-2:15 DIVINE ASTRA · DHUSHAN FALLS
EXT. BATTLEFIELD CLEARING - CONTINUOUS

[SHOT S05-A]: Aerial EWS God's-Eye Pullback
Camera: God's-Eye Aerial Pullback
Vayavya astra releases — comet of gold-blue scorches grey battlefield. Wind vortex sweeps five hundred skyward.

[SHOT S05-B]: Slow-Mo Medium Shot 250 FPS
Camera: 250 FPS Slow Motion
Dhushan chariot disintegrates in slow motion through saffron-lit air.

[SHOT S05-C]: Ground CU Static
Camera: Static Ground Impact
Dhushan crashes. Green light fades from armor — grey, then still.

ACT III: THE GOD REVEALED — KARA AND TOTAL ANNIHILATION

SC.06 2:15-2:40 KARA ADVANCES · DEMON KING'S PRIDE
EXT. BATTLEFIELD RIDGE - CONTINUOUS

[SHOT S06-A]: Low-Angle Wide Slow Push-In
Camera: Low Angle Push-In
KARA descends from chariot. Towering, dark as storm-clouds, obsidian crown.

[SHOT S06-B]: Tight OTS Match Push
Camera: Match Push
Over Kara's massive shoulder: Kara hurls Shakti spear, green-black and howling.

[SHOT S06-C]: Front CU Whip-Pan Dodge
Camera: Whip Pan Dodge
Rama sidesteps — single fluid motion. Spear tears past. Rama turns back with a serene smile.

SC.07 2:40-3:05 DIVINE RADIANCE · RAMA'S TRUE FORM
EXT. PANCHAVATI VALLEY - CONTINUOUS

[SHOT S07-A]: Wide Hero Slow-Rise Crane
Camera: Slow-Rise Crane
Rama's aura expands — saffron crown-light, oceanic blue along limbs, gold at bow.

[SHOT S07-B]: Aerial Pull Extreme Pullback
Camera: Extreme Aerial Pullback
Rama a single saffron star in sea of demon-grey. Radiance pushes outward.

[SHOT S07-C]: CU Front Rack to Deep Focus
Camera: Deep Focus Rack
Rama strings Brahmastra. Arrow radiates pulsing blue-gold. Silence drops over battlefield.

SC.08 3:05-3:30 KARA SLAIN · CLIMAX
EXT. BATTLEFIELD CENTER - CONTINUOUS

[SHOT S08-A]: Front Wide Speed-Ramp Release
Camera: Speed-Ramp Release
Brahmastra tears sky, parting grey clouds, revealing actual sun. Arrow strikes Kara at chest.

[SHOT S08-B]: ECU Slow-Mo 500 FPS
Camera: 500 FPS Slow Motion
Kara's face — green light dies in eyes. Obsidian armor fractures in slow splendor.

[SHOT S08-C]: Aerial EWS God's-Eye Static
Camera: God's-Eye Static
Entire demon army dissolves into grey smoke simultaneously. One saffron-blue figure stands.

SC.09 3:30-4:00 CODA · ETERNAL DHARMA RESTORED
EXT. PANCHAVATI FOREST - DAWN

[SHOT S09-A]: Slow Aerial Drift Skyward
Camera: Slow Aerial Drift
Camera drifts up from Rama — sky cracks to actual blue, actual sun. Saffron and celestial warm the forest canopy.`;

export default function ScreenplayEditor({ 
  shots = [], 
  onUpdateShotsFromScript, 
  onNavigateToView,
  projectTitle = "STAGE PRODUCTION STUDIO"
}) {
  const [activeConsoleTab, setActiveConsoleTab] = useState('screenplay'); // 'screenplay' | 'synopsis'
  
  // Script Synopsis State
  const [scriptSynopsisSource, setScriptSynopsisSource] = useState('auto_llm');
  const [llmAutoSynopsis, setLlmAutoSynopsis] = useState('');
  const [writerCustomSynopsis, setWriterCustomSynopsis] = useState('');
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false);
  const [synopsisSaveMsg, setSynopsisSaveMsg] = useState(false);

  const [scriptText, setScriptText] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_live_screenplay_text') || localStorage.getItem('sps_current_screenplay_text');
      if (saved && saved.trim()) return saved;
    }
    return DEFAULT_SAMPLE_SCREENPLAY;
  });

  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [isAICowriting, setIsAICowriting] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [parseStatusMsg, setParseStatusMsg] = useState('✓ Live Auto-Synced with 25-Craft Matrix');

  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const updatePageCounts = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const pageHeight = (clientHeight * 0.85) || 1;
      const calcTotal = Math.max(1, Math.ceil((scrollHeight || 1000) / pageHeight));
      const calcCurrent = Math.min(calcTotal, Math.max(1, Math.floor(scrollTop / pageHeight) + 1));
      setTotalPages(calcTotal);
      setCurrentPage(calcCurrent);
    }
  };

  useEffect(() => {
    updatePageCounts();
  }, [scriptText]);

  const handleScroll = () => {
    updatePageCounts();
  };

  const handlePageUp = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: -scrollContainerRef.current.clientHeight * 0.85, behavior: 'smooth' });
    }
  };

  const handlePageDown = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: scrollContainerRef.current.clientHeight * 0.85, behavior: 'smooth' });
    }
  };

  const handleFirstPage = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLastPage = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  // Keyboard shortcut listener for PageUp, PageDown, Alt+Up, Alt+Down
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowUp')) {
        e.preventDefault();
        handlePageUp();
      } else if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault();
        handlePageDown();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Persist screenplay text only — do not reload synopsis on every keystroke
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_live_screenplay_text', scriptText);
      localStorage.setItem('sps_current_screenplay_text', scriptText);
    }
  }, [scriptText]);

  // Load synopsis state once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedSource = localStorage.getItem('sps_script_synopsis_source') || 'auto_llm';
    setScriptSynopsisSource(savedSource);

    const autoCand = localStorage.getItem('sps_extracted_master_story') ||
                     localStorage.getItem('sps_master_script_story') ||
                     localStorage.getItem('sps_narrative_prose_story') || '';
    setLlmAutoSynopsis(autoCand);

    const customCand = localStorage.getItem('sps_writer_custom_script_synopsis') || '';
    setWriterCustomSynopsis(customCand);
  }, []);

  // Handle saving synopsis
  const handleSaveSynopsis = () => {
    localStorage.setItem('sps_script_synopsis_source', scriptSynopsisSource);
    localStorage.setItem('sps_writer_custom_script_synopsis', writerCustomSynopsis);
    if (llmAutoSynopsis) {
      localStorage.setItem('sps_extracted_master_story', llmAutoSynopsis);
    }
    setSynopsisSaveMsg(true);
    setTimeout(() => setSynopsisSaveMsg(false), 2000);
  };

  // AI Re-Extract Master Synopsis
  const handleAIExtractSynopsis = async () => {
    try {
      setIsGeneratingSynopsis(true);
      const aiResult = await extractMasterScriptSynopsisWithLLM(scriptText);
      if (aiResult && aiResult.trim()) {
        const cleanRes = aiResult.trim();
        setLlmAutoSynopsis(cleanRes);
        localStorage.setItem('sps_extracted_master_story', cleanRes);
      }
    } catch (err) {
      console.warn("Error auto-generating Script Synopsis:", err);
    } finally {
      setIsGeneratingSynopsis(false);
    }
  };

  // Handle live parsing when user stops typing or clicks Parse
  const handleParseScriptToMatrix = async (textToParse = scriptText) => {
    try {
      if (!textToParse || !String(textToParse).trim()) {
        setParseStatusMsg('⚠️ Paste screenplay text before syncing to matrix.');
        return;
      }
      setIsAutoParsing(true);
      setParseStatusMsg('⚡ Pedditi Labs Engine parsing screenplay to 26-craft matrix...');
      const parsedShots = await parseRawScriptToShots(textToParse);
      const meta = getLastParseMeta();
      if (parsedShots && Array.isArray(parsedShots) && parsedShots.length > 0) {
        if (onUpdateShotsFromScript) {
          onUpdateShotsFromScript(parsedShots);
        }
        if (meta?.usedFallback) {
          setParseStatusMsg(`✓ Synced ${parsedShots.length} shots (offline heuristic)${meta.hasApiKey ? '' : ' — add API key in Admin Settings for LLM parse'}`);
        } else {
          setParseStatusMsg(`✓ Synced ${parsedShots.length} Shots to 26-Craft Matrix`);
        }
      } else {
        setParseStatusMsg(meta?.warning || '⚠️ No shots produced — existing matrix left unchanged');
      }
    } catch (err) {
      console.warn("Screenplay live parse error:", err);
      setParseStatusMsg(`⚠️ Sync failed: ${err?.message || 'error'} — existing matrix left unchanged`);
    } finally {
      setIsAutoParsing(false);
    }
  };

  // Quick insertion helpers for standard screenplay elements
  const insertElement = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selectedText = currentText.substring(start, end);

    const replacement = `${prefix}${selectedText || ''}${suffix}`;
    const newText = currentText.substring(0, start) + replacement + currentText.substring(end);

    setScriptText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  // AI Co-Writer Actions
  const handleAICowriteNextScene = async () => {
    setIsAICowriting(true);
    try {
      const apiKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_api_key') || '') : '';
      const provider = typeof window !== 'undefined' ? (localStorage.getItem('sps_llm_provider') || 'google_gemini') : 'google_gemini';

      const promptText = `You are a Hollywood Master Screenwriter (Pedditi Labs Cinema Intelligence Engine).
Continue the following screenplay by writing the next dramatic 1-2 shots/scenes in standard Fountain screenplay format. Include [SHOT SXX-X] camera tags, dialogue, and vivid stage directions.

Current Screenplay:
${scriptText.slice(-2000)}

Write ONLY the continuation in clean screenplay format:`;

      let generatedContinuation = '';

      if (apiKey.trim() && provider === 'google_gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          generatedContinuation = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }

      if (!generatedContinuation) {
        generatedContinuation = `\n\n[SHOT S04-A]: Low Angle Hero Track\nCamera: Slow Dolly Push In\nLighting: Golden Temple Solar Sunbeams\n\nRAMA raises his bow high. The arrows ignite with sacred blue plasma flare.\n\nRAMA\n(voice echoing over the valley)\nFor righteousness, the forest shall stand!`;
      }

      const updatedText = `${(scriptText || '').trim()}\n\n${(generatedContinuation || '').trim()}`;
      setScriptText(updatedText);
      handleParseScriptToMatrix(updatedText);
    } catch (e) {
      console.warn("AI Cowriter error:", e);
    } finally {
      setIsAICowriting(false);
    }
  };

  // Stats calculation
  const wordCount = (scriptText.match(/\b\w+\b/g) || []).length;
  const sceneCount = (scriptText.match(/(?:EXT\.|INT\.|SC\.\d+)/g) || []).length || 1;
  const shotCount = (scriptText.match(/\[SHOT\s+S\d+-\w+\]/gi) || []).length || (shots.length || 28);
  const estRuntimeMinutes = Math.max(1, Math.round(wordCount / 180));

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF.');
      return;
    }

    const scriptTextToExport = scriptText || `KARA DUSHAN • MASTER SCREENPLAY DRAFT\n\nACT I: THE THREAT OF JANASTHANA\n\nSC.01 0:00-0:30 OMINOUS DUSK FOREBODING\nEXT. PANCHAVATI FOREST CLEARING - DUSK\n\nDappled sunlight pierces through dense canopy as ancient banyan trees sway gently in the evening breeze.`;

    const formattedHtml = scriptTextToExport
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<div class="space"></div>';
        if (trimmed.startsWith('EXT.') || trimmed.startsWith('INT.') || trimmed.startsWith('SC.') || trimmed.startsWith('ACT ')) {
          return `<div class="scene-heading">${line}</div>`;
        }
        if (trimmed.startsWith('[SHOT') || trimmed.startsWith('Camera:') || trimmed.startsWith('Lighting:')) {
          return `<div class="shot-tag">${line}</div>`;
        }
        if (trimmed === trimmed.toUpperCase() && trimmed.length < 35 && !trimmed.includes(':')) {
          return `<div class="character">${line}</div>`;
        }
        return `<div class="action">${line}</div>`;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${projectTitle || 'Master_Screenplay_Draft'} - Screenplay PDF</title>
          <style>
            @page {
              size: letter;
              margin: 1in;
            }
            body {
              font-family: "Courier New", Courier, monospace;
              font-size: 12pt;
              line-height: 1.4;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 24px;
            }
            .header {
              text-align: center;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 24px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              font-size: 11pt;
            }
            .scene-heading {
              font-weight: bold;
              text-transform: uppercase;
              margin-top: 20px;
              margin-bottom: 10px;
            }
            .shot-tag {
              font-weight: bold;
              color: #1e3a8a;
              margin-top: 6px;
              margin-bottom: 6px;
            }
            .character {
              text-align: center;
              margin-top: 16px;
              margin-bottom: 4px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .action {
              margin-bottom: 10px;
            }
            .space {
              height: 10px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${projectTitle || 'STAGE PRODUCTION STUDIO'} • MASTER SCREENPLAY DRAFT
          </div>
          ${formattedHtml}
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyScript = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(scriptText);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    }
  };

  const handleLoadAll9Scenes = () => {
    setScriptText(DEFAULT_SAMPLE_SCREENPLAY);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_live_screenplay_text', DEFAULT_SAMPLE_SCREENPLAY);
    }
    handleParseScriptToMatrix(DEFAULT_SAMPLE_SCREENPLAY);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl font-mono">
      
      {/* WRITER CONSOLE TOP SUB-NAVIGATION TAB BAR */}
      <div className="p-2.5 px-4 border-b border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0 backdrop-blur-md">
        
        {/* Sub-Nav Tabs: Screenplay vs Synopsis */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 mr-2 font-mono uppercase tracking-wider">
            <Scroll className="w-4 h-4 text-amber-400" />
            Writer Console:
          </span>

          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveConsoleTab('screenplay')}
              className={`px-3.5 py-1 rounded-lg text-xs font-mono font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeConsoleTab === 'screenplay'
                  ? 'bg-amber-400 text-zinc-950 shadow-md font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Scroll className="w-3.5 h-3.5" />
              <span>📜 Screenplay</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveConsoleTab('synopsis')}
              className={`px-3.5 py-1 rounded-lg text-xs font-mono font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeConsoleTab === 'synopsis'
                  ? 'bg-amber-400 text-zinc-950 shadow-md font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>📖 Synopsis</span>
            </button>
          </div>
        </div>

        {/* Action Controls for Screenplay Tab */}
        {activeConsoleTab === 'screenplay' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Visual Page Navigation Controls */}
            <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-xl border border-zinc-800 font-mono text-xs shadow-inner">
              <button
                type="button"
                onClick={handleFirstPage}
                className="px-1.5 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-bold cursor-pointer"
                title="First Page"
              >
                ⏮
              </button>

              <button
                type="button"
                onClick={handlePageUp}
                className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 font-bold flex items-center gap-1 border border-zinc-800 transition-all cursor-pointer"
                title="Page Up (Hotkey: PageUp / Alt+Up)"
              >
                <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Page Up</span>
              </button>

              <span className="px-2 text-[11px] text-zinc-200 font-black">
                Page {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={handlePageDown}
                className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 font-bold flex items-center gap-1 border border-zinc-800 transition-all cursor-pointer"
                title="Page Down / Next Page (Hotkey: PageDown / Alt+Down)"
              >
                <span>Page Down</span>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <button
                type="button"
                onClick={handleLastPage}
                className="px-1.5 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-bold cursor-pointer"
                title="Last Page"
              >
                ⏭
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadAll9Scenes}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer border border-amber-300 font-mono"
              title="Load Complete Master Screenplay (All 9 Scenes & 28 Shots)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-950" />
              <span>Load All 9 Scenes (28 Shots)</span>
            </button>

            <button
              type="button"
              onClick={handleAICowriteNextScene}
              disabled={isAICowriting}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer border border-purple-400/40"
              title="Auto-continue screenplay with Pedditi Labs AI Co-Writer"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isAICowriting ? 'animate-spin' : ''}`} />
              <span>{isAICowriting ? 'Co-Writing...' : '⚡ Pedditi Labs AI Co-Writer'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleParseScriptToMatrix()}
              disabled={isAutoParsing}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer border border-cyan-400/40"
              title="Sync screenplay shots into 25-Craft Matrix"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAutoParsing ? 'animate-spin' : ''}`} />
              <span>{isAutoParsing ? 'Syncing...' : 'Sync to Matrix'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer border border-emerald-400/40"
              title="Export Screenplay to PDF Document"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopyScript}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all cursor-pointer"
              title="Copy Screenplay Text"
            >
              {copiedToast ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Action Controls for Synopsis Tab */}
        {activeConsoleTab === 'synopsis' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAIExtractSynopsis}
              disabled={isGeneratingSynopsis}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer border border-purple-400/40"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isGeneratingSynopsis ? 'animate-spin' : ''}`} />
              <span>{isGeneratingSynopsis ? 'Extracting...' : '⚡ Re-Extract Synopsis'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSynopsis}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer border border-emerald-400/40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{synopsisSaveMsg ? 'Saved ✓' : 'Save Synopsis'}</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: 📜 SCREENPLAY EDITOR VIEW */}
      {activeConsoleTab === 'screenplay' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Screenplay Formatting Sub-Toolbar */}
          <div className="p-2 px-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-2 flex-wrap shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => insertElement('\nEXT. ', ' LOCATION - DAY\n')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-cyan-600 text-cyan-300 hover:text-white text-[11px] font-bold border border-zinc-800 transition-all cursor-pointer"
                title="Insert Scene Heading (EXT./INT.)"
              >
                + SCENE HEADING
              </button>

              <button
                type="button"
                onClick={() => insertElement('\n[SHOT S01-A]: Extreme Wide Shot\nCamera: Slow Forward Push\nLighting: Golden Hour\n')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-purple-600 text-purple-300 hover:text-white text-[11px] font-bold border border-zinc-800 transition-all cursor-pointer"
                title="Insert Camera & Shot Tag"
              >
                + SHOT TAG
              </button>

              <button
                type="button"
                onClick={() => insertElement('\nCHARACTER NAME\n(parenthetical action)\nDialogue text goes here...\n')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-amber-600 text-amber-300 hover:text-white text-[11px] font-bold border border-zinc-800 transition-all cursor-pointer"
                title="Insert Character Dialogue Block"
              >
                + DIALOGUE
              </button>

              <button
                type="button"
                onClick={() => insertElement('\nCUT TO:\n')}
                className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-zinc-800 transition-all cursor-pointer"
                title="Insert Transition (CUT TO:)"
              >
                + TRANSITION
              </button>
            </div>
          </div>

          {/* MAIN HOLLYWOOD COURIER SCREENPLAY CANVAS */}
          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-auto bg-zinc-950 p-4 sm:p-8 flex justify-center scrollbar-thin scrollbar-thumb-zinc-700">
            <div className="w-full max-w-3xl bg-zinc-900/90 text-zinc-100 rounded-xl border border-zinc-800 p-6 sm:p-10 shadow-2xl space-y-4 flex flex-col font-mono">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-xs text-zinc-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-cyan-400 uppercase">{projectTitle}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-amber-300">MASTER SCREENPLAY DRAFT</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300">
                    {parseStatusMsg}
                  </span>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Write screenplay here (e.g. EXT. LOCATION - DAY)..."
                rows={22}
                className="w-full flex-1 bg-transparent text-zinc-100 font-mono text-sm leading-relaxed focus:outline-none resize-none p-2 selection:bg-cyan-500/30 selection:text-white"
                style={{
                  fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
                  letterSpacing: '0.02em',
                  tabSize: 4
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 📖 SCRIPT SYNOPSIS VIEW */}
      {activeConsoleTab === 'synopsis' && (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-zinc-950 flex flex-col gap-5">
          
          {/* Source Selection Card */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                  Master Script Synopsis Mode
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select which version of the Master Story Synopsis will be compiled into prompt packages.
                </p>
              </div>
            </div>

            {/* Mode Selector Radio Pills */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setScriptSynopsisSource('auto_llm')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scriptSynopsisSource === 'auto_llm'
                    ? 'bg-amber-400 text-zinc-950 shadow font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>🤖 LLM Auto-Generated</span>
              </button>

              <button
                type="button"
                onClick={() => setScriptSynopsisSource('writer_custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scriptSynopsisSource === 'writer_custom'
                    ? 'bg-amber-400 text-zinc-950 shadow font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>✍️ Writer Custom</span>
              </button>
            </div>
          </div>

          {/* Main Synopsis Content Editors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
            
            {/* Left Box: LLM Auto-Generated Master Story */}
            <div className={`p-5 rounded-xl border transition-all flex flex-col ${
              scriptSynopsisSource === 'auto_llm'
                ? 'bg-amber-950/20 border-amber-500/60 shadow-xl shadow-amber-950/30'
                : 'bg-zinc-900/50 border-zinc-800 opacity-70'
            }`}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                <span className="text-xs font-black text-amber-300 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  🤖 LLM Auto-Generated Script Synopsis
                </span>
                {scriptSynopsisSource === 'auto_llm' && (
                  <span className="text-[10px] bg-amber-400 text-zinc-950 font-black px-2 py-0.5 rounded-full uppercase">
                    Active in Prompts
                  </span>
                )}
              </div>

              <div className="flex-1 bg-zinc-950/80 rounded-lg p-4 border border-zinc-800 text-xs text-zinc-200 leading-relaxed font-sans overflow-y-auto whitespace-pre-wrap">
                {llmAutoSynopsis ? (
                  llmAutoSynopsis
                ) : (
                  <span className="text-zinc-500 italic">
                    No LLM synopsis generated yet. Click "⚡ Re-Extract Synopsis" above to automatically generate a master synopsis from the screenplay!
                  </span>
                )}
              </div>
            </div>

            {/* Right Box: Writer Custom Script Synopsis Editor (Bright Yellow High Contrast) */}
            <div className={`p-5 rounded-xl border transition-all flex flex-col ${
              scriptSynopsisSource === 'writer_custom'
                ? 'bg-amber-950/30 border-amber-400 shadow-xl shadow-amber-950/40 ring-1 ring-amber-400/50'
                : 'bg-zinc-900/50 border-zinc-800 opacity-70'
            }`}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                <span className="text-xs font-black text-amber-300 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  ✍️ Writer Custom Script Synopsis (Editable)
                </span>
                {scriptSynopsisSource === 'writer_custom' && (
                  <span className="text-[10px] bg-amber-400 text-zinc-950 font-black px-2 py-0.5 rounded-full uppercase">
                    Active in Prompts
                  </span>
                )}
              </div>

              <textarea
                value={writerCustomSynopsis}
                onChange={(e) => setWriterCustomSynopsis(e.target.value)}
                placeholder="Type your custom Master Script Synopsis here... (This version will be included in the compiled prompt when Writer Custom is selected above)"
                rows={12}
                className="w-full flex-1 bg-zinc-950 border border-amber-500/60 rounded-lg p-4 text-xs font-sans font-bold leading-relaxed focus:outline-none focus:border-amber-400 resize-none selection:bg-amber-500 selection:text-zinc-950"
                style={{ color: '#FFEE00' }}
              />
            </div>

          </div>
        </div>
      )}

      {/* BOTTOM SCREENPLAY STATS & MATRIX QUICK NAV BAR */}
      <div className="p-2.5 px-4 border-t border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2 shrink-0 backdrop-blur-md font-mono">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-cyan-300 font-bold bg-zinc-950 px-2.5 py-0.5 rounded border border-zinc-800">
            📜 {sceneCount} Scenes · {shotCount} Shots
          </span>
          <span className="text-zinc-300">
            Words: <strong className="text-white">{wordCount}</strong>
          </span>
          <span className="text-zinc-300">
            Est. Runtime: <strong className="text-amber-300">~{estRuntimeMinutes}m</strong>
          </span>
        </div>

        {/* Quick Navigation to 25-Craft Matrix View */}
        {onNavigateToView && (
          <button
            type="button"
            onClick={() => onNavigateToView('spreadsheet')}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-cyan-600 text-zinc-200 hover:text-white text-xs font-bold border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open 25-Craft Matrix Spreadsheet →</span>
          </button>
        )}
      </div>
    </div>
  );
}
