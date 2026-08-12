import React, { useState, useRef } from 'react';
import { parseRawScriptToShots, generateScriptFromConcept, extractTextFromPDF, extractProjectCharactersWithLLM, enhanceCraftSlotWithLLM, synthesizeFullAppElementsFromScript, extractMasterScriptSynopsisWithLLM, getLastParseMeta, PdfExtractError, isPdfBinaryGarbage, looksLikeUsableScriptText } from '../services/aiScriptParser';
import { saveStoredCharacterProfiles } from './CharacterBibleModal';
import { X, Wand2, FileText, Sparkles, Check, Upload, Loader2, Edit3 } from 'lucide-react';

const SAMPLE_SCRIPTS = [
  {
    title: "Kara-Dhushan War (28 Shots)",
    script: `PART ONE: Action Script - Kara-Dhushan War: Lord Rama vs. Demon Legion of Janasthana
ACT I: The Dark Horizon — Demon Legion Arrives

S01-A Aerial · EWS Slow push-in
Vast Dandaka forest canopy, still and grey. Horizon blackens — fourteen thousand silhouettes crest the ridge. Sky dims to ash, sunlight throttled.

S01-B Low-Angle · WS Crane rise
Kara — obsidian chariot, tusked stallions. Dhushan flanking, serpent armour. War drums pulse green-black light through smoke. Ground shudders.

S01-C MCU Intercut Quick cuts x3
Demon eyes — glowing venom-green. Spears raised. Snarling mouths. Cut rapidly: armour, claws, skull banners flapping in unnatural wind.

S01-D OTS Back · WS Static hold
Over Rama's back — alone at forest's edge in saffron dhoti, divine blue skin. The demon tide approaches. He nocks an arrow — utterly still.

SC.02 RAMA AWAKENS · DIVINE STANCE: Sun in Darkness — The Warrior God Rises

S02-A Low CU · Tilt Up
Tilt from bare feet on earth — rising past saffron cloth to broad shoulders, face calm as deep water. Irises lit in warm amber.

S02-B Wide · Hero Orbit 180 deg
Camera orbits. Rama's aura ignites — soft gold-blue radiance blooms from skin. Greyness of forest yields; immediate zone glows saffron.

S02-C ECU Rack focus
Hands grip Kodanda bow — knuckles tighten. Bowstring hums with golden resonance. Demon army blurs in background. Focus snaps to arrowhead.

ACT II: Bow of the Universe — The Slaying Begins
S03-A Front CU Snap zoom out
Rama draws. Time stretches. Arrow tip blazes saffron-white. Full draw — bowstring at cheek, jaw set. He releases fourteen arrows simultaneously.

S03-B WS · Trailing Whip pan follow
Arrows arc in golden trails — each splits into cascades mid-flight. Demon front rank vaporises in flashes of grey ash-smoke and green dissolution.

S03-C MS Intercut Rapid cuts x5
Demon commanders roar, rally. Maces, spears hurled. Wave after wave charges from grey mist. Sheer scale — screen fills with darkness and green-smoke chaos.

S03-D Low Dutch · MS Steadicam orbit
Camera orbits Rama — arrows rain inward from all sides, he does not move. Celestial blue aura deflects every projectile. He draws again.

SC.04 DHUSHAN'S CHARGE · DARK POWER: Dhushan Unleashed — General's Wrath

S04-A Low Wide Push forward fast
Dhushan — towering, veins of poison-green electricity across armour. Mounts war-elephant wreathed in black smoke. Charges with a thousand at his back.

S04-B POV Charge Shaky-cam rush
Dhushan's POV: Rama a lone saffron flame in the grey world ahead. Scale contrast absolute. Then Rama's eyes lock onto camera.

S04-C ECU Intercut Match cut
Match cut — Rama's hand selects the Vayavya astra. Arrow glows blue-white. He speaks a single silent syllable. Wind stops. Then erupts.

SC.05 DIVINE ASTRA · COSMIC RELEASE: Dhushan Falls — The Vayavya Arrow

S05-A Aerial EWS God's-eye pullback
Aerial pull-back: Vayavya astra releases — comet of gold-blue scorches grey battlefield. Wind-tunnel vortex sweeps five hundred demons skyward.

S05-B Slow-Mo · MS 250 fps
Dhushan chariot disintegrates — spokes, panels spiralling in slow motion through saffron-lit air. Dhushan suspended, armour cracking.

S05-C Ground CU Static
Dhushan crashes. Ground fissures. Green light fades from armour — grey, then still. Silence for one beat. Then remaining legion's roar floods back.

ACT III: The God Revealed — Kara and Total Annihilation
SC.06 KARA ADVANCES · DEMON KING'S PRIDE

S06-A Low-Angle · WS Slow push-in
Kara descends from chariot. Towering, dark as storm-clouds, obsidian crown. Sky behind him swirls black and venomous green.

S06-B Tight OTS Match push
Over Kara's massive shoulder: Rama ahead, flame-bright. Kara's arm raises — hurls Shakti spear, green-black and howling.

S06-C Front CU Whip-pan dodge
Rama sidesteps — single fluid motion. Spear tears past, scorches earth black. He turns back to Kara — no fury, no fear. A slight, terrible smile.

SC.07 DIVINE RADIANCE · TOTAL POWER: The God Unfolds — Rama's True Form Blazes

S07-A Wide · Hero Slow-rise crane
Rama's aura expands — saffron crown-light, oceanic blue along limbs, gold at bow. Grey forest transforms: leaves catch fire in amber.

S07-B Aerial · Pull Extreme pullback
Extreme aerial: Rama a single saffron star in sea of demon-grey. Radiance pushes outward — darkness of fourteen thousand flinches back.

S07-C CU · Front Rack to deep focus
Rama strings Brahmastra. Arrow radiates pulsing blue-gold. Absolute silence drops over battlefield. Even Kara pauses — awe cracks his face.

SC.08 KARA SLAIN · CLIMAX: Kara Meets the Sun — The Last Arrow

S08-A Front Wide Speed-ramp release
Speed-ramp: slow as Rama releases — Brahmastra tears sky, parting grey clouds, revealing actual sun. Arrow strikes Kara at chest.

S08-B ECU · Slow-Mo 500 fps
Kara's face — green-light dies in eyes. Obsidian armour fractures in slow splendour. His form unmakes. Silence.

S08-C Aerial · EWS God's-eye static
God's-eye: entire demon army dissolves into grey smoke simultaneously. Forest floor — strewn grey and silent. One saffron-blue figure stands.

SC.09 CODA · ETERNAL: The Forest Breathes Again — Dharma Restored
S09-A Slow Aerial Drift skyward
Camera drifts up from Rama — grey battlefield below, but above him sky cracks to actual blue, actual sun. Saffron and celestial warm the forest canopy.`
  },
  {
    title: "Cyberpunk Music Video Climax",
    script: `EXT. NEO-TOKYO CONCERT STAGE - NIGHT

Heavy rain falls through cyan and magenta neon light beams.
ARIA (20s, neon blue hair, metallic jacket) grips the microphone stand with both hands.

ARIA
(singing with intense vocal passion)
"The grid is failing... we turn up the amps tonight!"

Camera pushes in with a slow dolly zoom. In the background, LEO (lead guitarist) leans back-to-back with Aria, striking a fierce guitar solo pose. Steam rises from stage floor vents as the backing crowd cheers in unison.`
  }
];

export default function AIScriptModal({ isOpen, onClose, onApplyShots, setProjectTitle, currentProjectTitle }) {
  const [activeTab, setActiveTab] = useState('parse');
  const [rawScriptText, setRawScriptText] = useState('');
  const [conceptPrompt, setConceptPrompt] = useState('Cyberpunk music video duet with heavy bass, rain, and neon reflections');
  const [shotCount, setShotCount] = useState(5);
  const [parsedPreview, setParsedPreview] = useState([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [customProjectTitle, setCustomProjectTitle] = useState(currentProjectTitle || 'NEW CINEMA PROJECT');
  const [lastFullElements, setLastFullElements] = useState(null);
  const [parseStatusMsg, setParseStatusMsg] = useState('');
  const parseRunRef = useRef(0);

  if (!isOpen) return null;

  const cleanFileNameToTitle = (fileName) => {
    return fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  };

  const activeLlmProvider = typeof window !== 'undefined' ? (localStorage.getItem('sps_llm_provider') || 'google_gemini') : 'google_gemini';
  const hasApiKey = typeof window !== 'undefined' ? Boolean(localStorage.getItem('sps_api_key')) : false;
  const isGeminiActive = activeLlmProvider === 'google_gemini' && hasApiKey;

  const applyParseMetaMessage = () => {
    const meta = getLastParseMeta();
    if (meta?.warning) {
      setParseStatusMsg(meta.warning);
    } else if (meta?.shotCount) {
      setParseStatusMsg(`✓ Parsed ${meta.shotCount} shots via ${meta.source || 'engine'}`);
    } else {
      setParseStatusMsg('');
    }
    return meta;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const runId = ++parseRunRef.current;
    setIsLoadingFile(true);
    setUploadedFileName(file.name);
    setParseStatusMsg('Parsing uploaded script…');
    
    const autoTitle = cleanFileNameToTitle(file.name);
    setCustomProjectTitle(autoTitle);

    try {
      let extractedText = '';
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf) {
        extractedText = await extractTextFromPDF(file);
      } else {
        extractedText = await file.text();
      }

      if (runId !== parseRunRef.current) return;

      if (!extractedText || !String(extractedText).trim()) {
        alert('Could not extract text from that file. Existing project was left unchanged.');
        setParseStatusMsg('⚠️ Empty extract — project unchanged');
        return;
      }

      if (isPdf && (isPdfBinaryGarbage(extractedText) || !looksLikeUsableScriptText(extractedText))) {
        alert('Could not read usable screenplay text from this PDF (binary/metadata only). Export as TXT or a text-based PDF and try again.\n\nExisting project was left unchanged.');
        setParseStatusMsg('⚠️ PDF text unusable — project unchanged');
        return;
      }

      setRawScriptText(extractedText);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sps_current_screenplay_text', extractedText);
      }
      const shots = await parseRawScriptToShots(extractedText);
      if (runId !== parseRunRef.current) return;
      const meta = applyParseMetaMessage();
      if (!shots.length) {
        alert(meta?.warning || 'Parse produced no shots. Existing project was left unchanged.');
        return;
      }
      setParsedPreview(shots);
      setIsGenerated(true);

      // Auto-synthesize ALL app elements (Characters, Director Psychology, DoP & Sound Visions)
      try {
        const fullElements = await synthesizeFullAppElementsFromScript(extractedText, autoTitle, shots);
        if (runId !== parseRunRef.current) return;
        setLastFullElements(fullElements);
        if (fullElements.characters && fullElements.characters.length > 0) {
          saveStoredCharacterProfiles(fullElements.characters);
        }
      } catch (e) {
        console.warn('Post-parse synthesis skipped:', e);
      }
    } catch (err) {
      const isPdfErr = err instanceof PdfExtractError || err?.name === 'PdfExtractError';
      const prefix = isPdfErr ? '' : 'Failed to parse document: ';
      alert(`${prefix}${err?.message || err}\n\nExisting project was left unchanged.`);
      setParseStatusMsg(
        isPdfErr
          ? `⚠️ PDF: ${err?.code || 'extract failed'} — project unchanged`
          : '⚠️ Parse failed — project unchanged'
      );
    } finally {
      if (runId === parseRunRef.current) setIsLoadingFile(false);
    }
  };

  const handleParseScript = async () => {
    if (!rawScriptText || typeof rawScriptText !== 'string' || !rawScriptText.trim()) {
      alert('Paste screenplay text before parsing.');
      return;
    }
    const runId = ++parseRunRef.current;
    setIsLoadingFile(true);
    setParseStatusMsg('Parsing screenplay…');
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('sps_current_screenplay_text', rawScriptText);
      }
      const shots = await parseRawScriptToShots(rawScriptText);
      if (runId !== parseRunRef.current) return;
      const meta = applyParseMetaMessage();
      if (!shots.length) {
        alert(meta?.warning || 'Parse produced no shots. Existing project was left unchanged.');
        return;
      }
      setParsedPreview(shots);
      setIsGenerated(true);
      const title = (!customProjectTitle || customProjectTitle === 'NEW CINEMA PROJECT') ? 'PARSED SCRIPT PROJECT' : customProjectTitle;
      if (!customProjectTitle || customProjectTitle === 'NEW CINEMA PROJECT') {
        setCustomProjectTitle(title);
      }

      try {
        const fullElements = await synthesizeFullAppElementsFromScript(rawScriptText, title, shots);
        if (runId !== parseRunRef.current) return;
        setLastFullElements(fullElements);
        if (fullElements.characters && fullElements.characters.length > 0) {
          saveStoredCharacterProfiles(fullElements.characters);
        }
      } catch (e) {
        console.warn('Post-parse synthesis skipped:', e);
      }
    } catch (err) {
      alert("Failed to parse script: " + (err?.message || err) + "\n\nExisting project was left unchanged.");
      setParseStatusMsg('⚠️ Parse failed — project unchanged');
    } finally {
      if (runId === parseRunRef.current) setIsLoadingFile(false);
    }
  };

  const handleGenerateConcept = async () => {
    if (!conceptPrompt || typeof conceptPrompt !== 'string' || !conceptPrompt.trim()) return;
    const runId = ++parseRunRef.current;
    setIsLoadingFile(true);
    setParseStatusMsg('Generating concept shots…');
    try {
      const shots = await generateScriptFromConcept(conceptPrompt, shotCount);
      if (runId !== parseRunRef.current) return;
      if (!shots.length) {
        alert('Concept generator produced no shots. Existing project was left unchanged.');
        return;
      }
      setParsedPreview(shots);
      setIsGenerated(true);
      const title = String(conceptPrompt).substring(0, 30).toUpperCase();
      setCustomProjectTitle(title);
      setParseStatusMsg(`✓ Generated ${shots.length} concept shots`);

      try {
        const extractedChars = await extractProjectCharactersWithLLM(shots, title);
        if (runId !== parseRunRef.current) return;
        if (extractedChars && extractedChars.length > 0) {
          saveStoredCharacterProfiles(extractedChars);
        }
      } catch (e) {}
    } catch (err) {
      alert("Concept generation failed: " + (err?.message || err));
    } finally {
      if (runId === parseRunRef.current) setIsLoadingFile(false);
    }
  };

  const handleApplyToStudio = async () => {
    if (parsedPreview.length > 0) {
      const titleToApply = (customProjectTitle && typeof customProjectTitle === 'string' && customProjectTitle.trim()) ? customProjectTitle.trim().toUpperCase() : currentProjectTitle;
      
      // Auto-save live screenplay text for Writer Console
      if (rawScriptText && typeof rawScriptText === 'string' && rawScriptText.trim()) {
        localStorage.setItem('sps_live_screenplay_text', rawScriptText);
        localStorage.setItem('sps_current_screenplay_text', rawScriptText);
      }

      // Ensure character bibles are extracted & saved to vault
      try {
        const existingVault = localStorage.getItem('sps_character_bible_vault');
        if (!existingVault || JSON.parse(existingVault).length === 0) {
          const extracted = await extractProjectCharactersWithLLM(parsedPreview, titleToApply);
          if (extracted && extracted.length > 0) {
            saveStoredCharacterProfiles(extracted);
          }
        }
      } catch (e) {}

      onApplyShots(parsedPreview, titleToApply, lastFullElements);

      // Extract Master Script Synopsis in background (imported + safe)
      try {
        if (rawScriptText && rawScriptText.trim()) {
          extractMasterScriptSynopsisWithLLM(rawScriptText).then(synopsisRes => {
            if (synopsisRes && synopsisRes.trim()) {
              localStorage.setItem('sps_extracted_master_story', synopsisRes.trim());
            }
          }).catch(() => {});
        }
      } catch (e) {}

      onClose();
    }
  };

  const handleLoadSample = async (sample) => {
    setUploadedFileName('');
    setCustomProjectTitle(sample.title.toUpperCase());
    setRawScriptText(sample.script);
    const runId = ++parseRunRef.current;
    setIsLoadingFile(true);
    setParseStatusMsg('Parsing sample…');
    try {
      const shots = await parseRawScriptToShots(sample.script);
      if (runId !== parseRunRef.current) return;
      applyParseMetaMessage();
      if (!shots.length) {
        alert('Sample parse produced no shots.');
        return;
      }
      setParsedPreview(shots);
      setIsGenerated(true);
    } catch (err) {
      alert("Sample parse failed: " + (err?.message || err));
    } finally {
      if (runId === parseRunRef.current) setIsLoadingFile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-md font-mono">
      <div className="relative w-full max-w-3xl bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-300 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* Modal Header */}
        <div className="p-3.5 px-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
              <Wand2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                AI Script Breakdown & Project Naming
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400">Upload PDF/screenplay files or type concepts to generate 15-slot matrixes.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Intelligence Tab Switcher */}
        <div className="p-2.5 px-4 bg-slate-100 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setActiveTab('parse'); setIsGenerated(false); }}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                activeTab === 'parse'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-zinc-200 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              1. Upload & Parse Script
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('concept'); setIsGenerated(false); }}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                activeTab === 'concept'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-zinc-200 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              2. AI Story Generator
            </button>
          </div>

          {/* Document Upload Button */}
          {activeTab === 'parse' && (
            <label className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow flex items-center gap-1.5 transition-all">
              {isLoadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 fill-slate-950" />}
              <span>Upload PDF / Text</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.fountain,.fdx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50 dark:bg-zinc-950">
          
          {/* Project Name Popup Bar */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-300 font-mono shrink-0">Project Name:</span>
              <input
                type="text"
                value={customProjectTitle}
                onChange={(e) => setCustomProjectTitle(e.target.value)}
                placeholder="Enter Project Title (e.g. Kara Dhushan War)..."
                className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-amber-950 dark:text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            {uploadedFileName && (
              <span className="text-[10.5px] font-mono text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-bold">
                📄 File: {uploadedFileName}
              </span>
            )}
          </div>

          {activeTab === 'parse' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-900 dark:text-zinc-200 font-mono">
                  Script Document Text:
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] text-zinc-400 font-mono">Quick Samples:</span>
                  {SAMPLE_SCRIPTS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleLoadSample(sample)}
                      className="text-[10.5px] font-mono text-cyan-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 font-bold transition-colors"
                    >
                      {sample.title}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={4}
                value={rawScriptText}
                onChange={(e) => setRawScriptText(e.target.value)}
                placeholder="Paste screenplay text here, or click 'Upload PDF / Text' above..."
                className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-950 dark:text-zinc-100 font-mono font-bold focus:outline-none focus:border-cyan-500 leading-relaxed shadow-inner"
              />

              <button
                type="button"
                onClick={handleParseScript}
                disabled={isLoadingFile || !rawScriptText.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold shadow flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoadingFile ? <Loader2 className="w-4 h-4 animate-spin text-amber-300" /> : <Wand2 className="w-4 h-4 text-amber-300" />}
                {isLoadingFile ? 'Parsing & Auto-Enhancing…' : 'Analyze & Auto-Parse Script into 26 Production Crafts'}
              </button>
              {parseStatusMsg ? (
                <p className={`text-[10.5px] font-mono leading-relaxed ${parseStatusMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {parseStatusMsg}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-900 dark:text-zinc-200 font-mono block mb-1">
                  Describe Movie Concept or Music Video Scene:
                </label>
                <input
                  type="text"
                  value={conceptPrompt}
                  onChange={(e) => setConceptPrompt(e.target.value)}
                  placeholder="e.g. High-energy acoustic guitar duet in a dimly lit industrial warehouse..."
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-950 dark:text-white font-mono font-bold focus:outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-mono text-slate-600 dark:text-zinc-400">Number of Shots to Generate:</label>
                <select
                  value={shotCount}
                  onChange={(e) => setShotCount(Number(e.target.value))}
                  className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-200 rounded-lg px-2.5 py-1 font-mono font-bold focus:outline-none"
                >
                  <option value={3}>3 Shots (Short Sequence)</option>
                  <option value={5}>5 Shots (Standard Scene)</option>
                  <option value={8}>8 Shots (Full Climax Suite)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateConcept}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                Generate Complete {shotCount}-Shot Production Suite
              </button>
            </div>
          )}

          {/* AI Output Preview */}
          {isGenerated && parsedPreview.length > 0 && (
            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-cyan-500/40 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Parsed Breakdown Preview ({parsedPreview.length} Shots Ready)
                </h4>
                <button
                  type="button"
                  onClick={handleApplyToStudio}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Apply {parsedPreview.length} Shots to "{customProjectTitle}"
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {parsedPreview.map((shot, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between text-cyan-800 dark:text-cyan-300 font-bold">
                      <span>{shot.sceneShotId} - {shot.shotComposition}</span>
                      <span className="text-[10px] text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 font-bold">
                        {shot.cameraMotionTag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-zinc-400 truncate"><strong className="text-slate-950 dark:text-zinc-200 font-bold">Artist:</strong> {shot.characterIdAssetRef}</p>
                    <p className="text-[11px] text-amber-900 dark:text-amber-200/90 truncate"><strong className="text-slate-950 dark:text-zinc-200 font-bold">Co-Artist Reaction:</strong> {shot.coArtistInteraction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400 font-mono shrink-0">
          <span>Supported: PDF, TXT, MD, Fountain, FinalDraft</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-zinc-200 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
