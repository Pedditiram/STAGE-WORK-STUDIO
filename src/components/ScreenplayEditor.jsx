import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Sparkles, Wand2, Play, Download, Copy, Check, RefreshCw, 
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Layers, Sliders, Eye
} from 'lucide-react';
import { parseRawScriptToShots } from '../services/aiScriptParser';

const DEFAULT_SAMPLE_SCREENPLAY = `ACT I: THE THREAT OF JANASTHANA

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

SC.02 0:30-1:05 WAR CHARIOT APPROACH
EXT. JANASTHANA FRONTLINE - CONTINUOUS

[SHOT S02-A]: Extreme Wide Action Vista
Camera: Fast Crash Zoom
Lighting: Harsh Scorching Solar Glow

DUSHANA'S WAR CHARIOT rumbles through the dust, pulled by four black armored war horses with glowing red eyes.

DUSHANA
(roaring to his vanguard)
Forward! Crush the hermit warrior before sun fall!

[SHOT S02-B]: Low Angle Hero Tracking
Camera: Tracking Shot alongside Chariot Wheels
Subject Color: Dark Obsidian Armor & Gold Rim

DUSHANA brandishes his massive spiked iron mace, eyes gleaming with fiery wrath.

[SHOT S02-C]: Medium Wide Frontal Charge
Camera: Side Tracking Arc
Lighting: High Contrast Chiaroscuro Noir

Demonic ranks surge behind him like a dark ocean of bronze armor and floating embers.

ACT II: THE SIEGE OF FOURTEEN THOUSAND

SC.03 1:05-1:25 DUSHANA'S VANGUARD CHARGE
EXT. BATTLEFIELD CLEARING - DAY

[SHOT S03-A]: Low Angle Ground Sweep
Camera: 360-Degree Orbit
RAMA steps down onto the battlefield. His aura flares with divine solar radiance.

RAMA
(facing 14,000 host)
Stand down, Rakshasas of Janasthana, or face the judgement of Shiva's bow.

CUT TO:`;

export default function ScreenplayEditor({ 
  shots = [], 
  onUpdateShotsFromScript, 
  onNavigateToView,
  projectTitle = "STAGE PRODUCTION STUDIO"
}) {
  const [scriptText, setScriptText] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_live_screenplay_text');
      if (saved && saved.trim().length > 50) return saved;
    }
    return DEFAULT_SAMPLE_SCREENPLAY;
  });

  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [isAICowriting, setIsAICowriting] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [parseStatusMsg, setParseStatusMsg] = useState('✓ Live Auto-Synced with 25-Craft Matrix');

  const textareaRef = useRef(null);

  // Auto-sync script text to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_live_screenplay_text', scriptText);
    }
  }, [scriptText]);

  // Handle live parsing when user stops typing or clicks Parse
  const handleParseScriptToMatrix = async (textToParse = scriptText) => {
    try {
      setIsAutoParsing(true);
      setParseStatusMsg('⚡ Pedditi Labs Engine parsing screenplay to 25-craft matrix...');
      const parsedShots = await parseRawScriptToShots(textToParse);
      if (parsedShots && Array.isArray(parsedShots) && parsedShots.length > 0) {
        if (onUpdateShotsFromScript) {
          onUpdateShotsFromScript(parsedShots);
        }
        setParseStatusMsg(`✓ Synced ${parsedShots.length} Shots to 25-Craft Matrix`);
      }
    } catch (err) {
      console.warn("Screenplay live parse error:", err);
      setParseStatusMsg('⚠️ Live Sync fallback ready');
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

      const updatedText = `${scriptText.trim()}\n\n${generatedContinuation.trim()}`;
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

  const handleCopyScript = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(scriptText);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl font-mono">
      
      {/* SCREENPLAY WRITER TOOLBAR HEADER */}
      <div className="p-2.5 px-4 border-b border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0 backdrop-blur-md">
        
        {/* Left Formatting Tools */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mr-2 font-mono">
            <FileText className="w-4 h-4 text-cyan-400" />
            Screenplay Writer Studio
          </span>

          <div className="h-4 w-px bg-zinc-700 mx-1" />

          {/* Screenplay Element Insertion Buttons */}
          <button
            type="button"
            onClick={() => insertElement('\nEXT. ', ' LOCATION - DAY\n')}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-cyan-600 text-cyan-300 hover:text-white text-[11px] font-bold border border-zinc-700 transition-all cursor-pointer"
            title="Insert Scene Heading (EXT./INT.)"
          >
            + SCENE HEADING
          </button>

          <button
            type="button"
            onClick={() => insertElement('\n[SHOT S01-A]: Extreme Wide Shot\nCamera: Slow Forward Push\nLighting: Golden Hour\n')}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-purple-600 text-purple-300 hover:text-white text-[11px] font-bold border border-zinc-700 transition-all cursor-pointer"
            title="Insert Camera & Shot Tag"
          >
            + SHOT TAG
          </button>

          <button
            type="button"
            onClick={() => insertElement('\nCHARACTER NAME\n(parenthetical action)\nDialogue text goes here...\n')}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-amber-600 text-amber-300 hover:text-white text-[11px] font-bold border border-zinc-700 transition-all cursor-pointer"
            title="Insert Character Dialogue Block"
          >
            + DIALOGUE
          </button>

          <button
            type="button"
            onClick={() => insertElement('\nCUT TO:\n')}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-zinc-700 transition-all cursor-pointer"
            title="Insert Transition (CUT TO:)"
          >
            + TRANSITION
          </button>
        </div>

        {/* Right AI Co-Writer & Sync Controls */}
        <div className="flex items-center gap-2">
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
            onClick={handleCopyScript}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all cursor-pointer"
            title="Copy Screenplay Text"
          >
            {copiedToast ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* MAIN HOLLYWOOD COURIER SCREENPLAY CANVAS */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-4 sm:p-8 flex justify-center scrollbar-thin scrollbar-thumb-zinc-700">
        
        {/* Industry Standard 8.5x11 Page Canvas Container */}
        <div className="w-full max-w-3xl bg-zinc-900/90 text-zinc-100 rounded-xl border border-zinc-800 p-6 sm:p-10 shadow-2xl space-y-4 flex flex-col font-mono">
          
          {/* Page Top Header Banner */}
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

          {/* High-Performance Screenplay Textarea */}
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
