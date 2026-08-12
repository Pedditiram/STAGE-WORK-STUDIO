import React, { useState, useEffect } from 'react';
import { 
  X, User, Sparkles, Plus, Trash2, Edit3, Check, BookOpen, Volume2, 
  Activity, MessageSquare, Shield, Save, UserCheck, RefreshCw, AlertCircle,
  Maximize2, Minimize2, Users, Palette, Grid, Copy, Download, Shirt, Smile
} from 'lucide-react';
import { composeCharacterPersonaWithLLM, extractProjectCharactersWithLLM } from '../services/aiScriptParser';

export function getStoredCharacterProfiles() {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('sps_character_bible_vault');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredCharacterProfiles(profiles) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('sps_character_bible_vault', JSON.stringify(profiles));
    window.dispatchEvent(new CustomEvent('sps_character_vault_updated'));
  } catch (e) {}
}

export default function CharacterBibleModal({ isOpen, onClose, shots = [], projectTitle = '', initialTab = 'roster' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'roster' | 'character_sheet' | 'script_story'
  const [characterSheetMode, setCharacterSheetMode] = useState('turnaround'); // 'turnaround' | 'expressions' | 'wardrobe'
  const [copiedSheet, setCopiedSheet] = useState(false);
  const [characters, setCharacters] = useState(() => getStoredCharacterProfiles());
  const [selectedCharId, setSelectedCharId] = useState('');
  const [editingChar, setEditingChar] = useState(null);

  const generateCharacterDesignSheetText = (char, mode = 'turnaround') => {
    if (!char) return 'No character profile selected.';
    
    const charTag = char.tag || '@Character';
    const charName = char.name || 'Character';
    const outfit = char.outfit || 'Signature costume, detailed fabric, tailored fit';
    const mannerisms = char.mannerism || 'Cinematic posture, poise, confident stance';
    const face = char.dialogueDelivery || 'Striking facial features, expressive eyes, defined jawline';

    if (mode === 'turnaround') {
      return `======================================================================
360° CHARACTER DESIGN MODEL SHEET (${charName} - ${charTag})
======================================================================
CHARACTER TAG: ${charTag}
CHARACTER NAME: ${charName} (${char.role || 'Primary Subject'})

MODEL SHEET TYPE: 360° Character Turnaround Matrix (Front View, 3/4 View, Side Profile, Back View)

SYNTHESIZED TURNAROUND PROMPT:
Character reference model turnaround sheet of ${charName} (${charTag}), 4 distinct full-body views arranged horizontally: 
1. FRONT VIEW: Standing facing forward in neutral relaxed pose, full body shot from head to boots.
2. 3/4 VIEW: Three-quarter angle turned 45 degrees, showing depth of costume and torso profile.
3. SIDE PROFILE: Complete 90-degree side profile, showing facial silhouette and posture alignment.
4. BACK VIEW: Standing facing directly away from lens, showing back costume details, cape/jacket structure, and hair flow.

VISUAL ATTRIBUTES & COSTUME:
- Outfit & Wardrobe: ${outfit}
- Mannerisms & Posture: ${mannerisms}
- Facial & Feature Definition: ${face}
- Backstory & Motivation: ${char.backstory || 'Protagonist narrative motivation'}
- Lighting & Background: Clean neutral solid light grey studio backdrop, soft cinematic key light, sharp rim lighting, studio photo grid, high-fashion concept art style.
- Quality Modifiers: 8k resolution, photorealistic character concept turnaround, hyper-detailed fabric weave, skin texture, crisp line definition, consistent character proportions across all 4 views.

MIDJOURNEY --CREF PROMPT FORMAT:
/imagine prompt full body 360 character turnaround model sheet of ${charName}, front view, side view, back view, ${outfit}, neutral grey studio background, photorealistic 8k --cref [IMAGE_URL] --cw 100 --v 6.1
======================================================================`;
    }

    if (mode === 'expressions') {
      return `======================================================================
CHARACTER FACIAL EXPRESSION & EMOTION MATRIX (${charName} - ${charTag})
======================================================================
CHARACTER TAG: ${charTag}
NAME: ${charName}

EXPRESSION SHEET TYPE: 6-Grid Facial Emotion & Vocal Sync Matrix

SYNTHESIZED EXPRESSION PROMPT:
Character expression sheet matrix of ${charName} (${charTag}), 6 close-up portrait grids showing distinct emotional states:
1. NEUTRAL / STOIC: Calm gaze locked onto camera, relaxed mouth, subtle confidence.
2. INTENSE DRAMATIC FOCUS: Furrowed brow, sharp penetrating gaze, serious dramatic tension.
3. JOY / WARM SMILE: Genuine warm smile, eyes crinkling, bright illuminated expression.
4. ANGER / FIERCE DEFIANCE: Gritted teeth, intense glare, dynamic dramatic shadow across brow.
5. EMOTIONAL CLIMAX / SORROW: Tear glistening on cheek, parted lips, vulnerable emotional breakdown.
6. VOCAL SYNC MOUTH SHAPES: Open mouth in vocal delivery, singing/speaking cadence, natural lip movement.

FACIAL SPECS:
- Voice Cadence & Inflection: ${char.uniqueVoice || 'Vocal inflection'}
- Features & Delivery: ${face}
- Lighting: Cinematic portrait lighting, 85mm anamorphic prime lens, shallow depth of field, 8k resolution.
======================================================================`;
    }

    if (mode === 'wardrobe') {
      return `======================================================================
WARDROBE & COSTUME DETAIL SHEET (${charName} - ${charTag})
======================================================================
CHARACTER TAG: ${charTag}
NAME: ${charName}

COSTUME BREAKDOWN:
- Primary Outfit: ${outfit}
- Mannerisms & Accessories: ${mannerisms}
- Color Palette: Custom Swatch, high contrast cinema grading

WARDROBE DESIGN PROMPT:
High-detail costume concept design sheet for ${charName} (${charTag}), featuring 3 detailed panels:
1. FULL OUTFIT STANDING POSE: Full-body fashion concept illustration displaying complete attire.
2. FABRIC & MATERIAL CLOSE-UP: Macro detail of leather/fabric weave, stitching, metallic buckles, and embroidery texture.
3. ACCESSORIES & PROPS GRID: Dissected view of signature props, footwear, belts, rings, and equipment.

STYLE: High-fashion costume concept art, photorealistic 8k render, studio illumination.
======================================================================`;
    }

    if (mode === 'psychology') {
      return `======================================================================
CHARACTER PSYCHOLOGY & COGNITIVE ARCHETYPE MATRIX (${charName} - ${charTag})
======================================================================
CHARACTER TAG: ${charTag}
NAME: ${charName} (${char.role || 'Primary Subject'})

PSYCHOLOGICAL ARCHETYPE & CORE MOTIVATION:
${char.psychologicalArchetype || 'The Resilient Protector • Driven by protective oath, duty, and deep loyalty'}

INTERNAL SUBCONSCIOUS CONFLICT & BASELINE:
${char.internalConflict || 'Duty vs Personal Survival • Quiet stoicism masking deep emotional vulnerability'}

SUBCONSCIOUS BEHAVIORAL TRIGGERS & EYE/GESTURE TICKS:
${char.behavioralTriggers || 'Hyper-vigilant eye scanning under threat, subtle jaw-clench when challenged'}

STRESS REACTION & PRESSURE RESPONSE:
${char.stressReaction || 'Laser-focused adrenaline surge; steady piercing gaze locked onto threat'}

SYNTHESIZED MIDJOURNEY / SORA / RUNWAY PSYCHOLOGICAL PROMPT:
Intense psychological character portrait study of ${charName} (${charTag}), demonstrating cognitive archetype of ${char.psychologicalArchetype || 'Resilient Protector'}, internal conflict of ${char.internalConflict || 'Duty'}, eyes reflecting subconscious trigger of ${char.behavioralTriggers || 'Hyper-vigilance'}, dramatic chiaroscuro lighting, 85mm prime lens, cinematic 8k.
======================================================================`;
    }

    if (mode === 'mannerisms') {
      return `======================================================================
CHARACTER MANNERISMS, GESTURES & POSTURE MATRIX (${charName} - ${charTag})
======================================================================
CHARACTER TAG: ${charTag}
NAME: ${charName} (${char.role || 'Primary Subject'})

SIGNATURE HAND & ARM GESTURES:
${char.handGestures || char.mannerism || 'Rests right hand on sword hilt, subtle finger-tapping on thigh under tension'}

POSTURE ALIGNMENT & SHOULDER STANCE:
${char.postureStance || 'Military straight spine, square shoulders, commanding erect poise'}

FACIAL TWITCHES, HEAD TILTS & EYE BLINK CADENCE:
${char.facialTicks || 'Slow deliberate eye blink cadence, subtle 15-degree head tilt when listening'}

GAIT & PHYSICAL STRIDING RHYTHM:
${char.walkingStyle || 'Heavy rhythmic boots stride, poised balanced footstep cadence'}

SYNTHESIZED MIDJOURNEY / SORA / RUNWAY MANNERISM PROMPT:
Full-body character performance model sheet of ${charName} (${charTag}), displaying signature mannerisms of ${char.handGestures || char.mannerism || 'Rests hand on hilt'}, posture alignment of ${char.postureStance || 'Military straight spine'}, head tilt of ${char.facialTicks || '15-degree tilt'}, gait of ${char.walkingStyle || 'Poised stride'}, photorealistic 8k, cinematic lighting.
======================================================================`;
    }

    return '';
  };

  // Listen for vault updates from anywhere in app
  useEffect(() => {
    if (!isOpen) return;
    const handleVaultUpdate = () => {
      const stored = getStoredCharacterProfiles();
      setCharacters(stored);
      setSelectedCharId(prev => (prev || (stored[0]?.id || '')));
    };
    window.addEventListener('sps_character_vault_updated', handleVaultUpdate);
    return () => window.removeEventListener('sps_character_vault_updated', handleVaultUpdate);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'roster');
      const stored = getStoredCharacterProfiles();
      if (stored && stored.length > 0) {
        setCharacters(stored);
        if (!selectedCharId) setSelectedCharId(stored[0]?.id || '');
      }
    }
  }, [isOpen, initialTab]);
  const [toastMsg, setToastMsg] = useState(null);
  const [isComposingLLM, setIsComposingLLM] = useState(false);
  const [isExtractingLLM, setIsExtractingLLM] = useState(false);
  const [extractedMasterStory, setExtractedMasterStory] = useState('');
  const [isGeneratingStoryLLM, setIsGeneratingStoryLLM] = useState(false);
  const [storySourceMode, setStorySourceMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_selected_story_mode') || 'auto_extracted';
    }
    return 'auto_extracted';
  });
  const [includeStoryInPrompt, setIncludeStoryInPrompt] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_include_story_in_prompt') !== 'false';
    }
    return true;
  });
  const [characterSourceMode, setCharacterSourceMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_selected_character_source') || 'auto_extracted';
    }
    return 'auto_extracted';
  });
  const [includeCharactersInPrompt, setIncludeCharactersInPrompt] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_include_characters_in_prompt') !== 'false';
    }
    return true;
  });
  const [narrativeProseStory, setNarrativeProseStory] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmClosePopup, setShowConfirmClosePopup] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [writerOriginalScript, setWriterOriginalScript] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_current_screenplay_text') || '';
    }
    return '';
  });

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const savedScript = localStorage.getItem('sps_current_screenplay_text');
      if (savedScript) setWriterOriginalScript(savedScript);
      setHasUnsavedChanges(false);
      setShowConfirmClosePopup(false);
    }
  }, [isOpen]);

  // Native Browser Fullscreen Bypass to hide Safari URL bar & tabs completely
  const toggleFullscreenMode = async (enable) => {
    const targetState = typeof enable === 'boolean' ? enable : !isFullscreen;
    setIsFullscreen(targetState);

    try {
      if (targetState) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        }
      } else {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          }
        }
      }
    } catch (e) {}
  };

  // Handle Cmd+Enter (Full Screen View) & ESC (Normal View / Request Close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreenMode();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          toggleFullscreenMode(false);
        } else {
          handleRequestClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, hasUnsavedChanges]);

  // Sync native fullscreen exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (!isNativeFull && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen]);

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirmClosePopup(true);
    } else {
      onClose();
    }
  };



  // Synthesize master story & narrative prose for common man/children
  useEffect(() => {
    if (!isOpen || !shots || shots.length === 0) return;
    const storyBeats = shots.map((s, idx) => {
      const char = s.characterIdAssetRef || '';
      const env = s.actionEnvContext || '';
      const dialogue = s.characterDialogue ? ` (Dialogue: "${s.characterDialogue}")` : '';
      return `• Beat ${idx + 1} (${s.sceneShotId || 'Shot'}): ${env} - ${char}${dialogue}`;
    }).join('\n');

    const fullStorySummary = `=== MASTER SCRIPT STORY & NARRATIVE ARC (${projectTitle || 'STAGE PRODUCTION STUDIO'}) ===\n\n1. SCRIPT SUMMARY & OVERALL PLOT:\nAct I-III Narrative Arc compiled from writer script and shot sequence across ${shots.length} scene beats.\n\n2. EXTRACTED SHOT SEQUENCE BEATS:\n${storyBeats}\n\n3. WRITER & LLM MASTER CHARACTER PROFILE SUMMARY:\n${characters.map(c => `• ${c.name} (${c.tag}): ${c.backstory || 'No backstory defined.'}`).join('\n')}`;

    setExtractedMasterStory(fullStorySummary);

    const charNames = characters.length > 0 ? characters.map(c => c.name).join(', ') : 'our courageous heroes';
    let prose = `📖 SIMPLE NARRATIVE STORY: ${projectTitle || 'THE GREAT TALE'}\n\n`;
    prose += `Once upon a time in "${projectTitle || 'our epic world'}", a grand adventure unfolded starring ${charNames}.\n\n`;
    shots.forEach((s, idx) => {
      const charRef = s.characterIdAssetRef ? s.characterIdAssetRef.replace(/\[|\]/g, '').replace(/CharID:\s*/i, '') : 'our lead character';
      const env = s.actionEnvContext || 'in a vivid setting';
      const dialogue = s.characterDialogue ? ` They declared: "${s.characterDialogue}".` : '';
      prose += `Chapter ${idx + 1} (${s.sceneShotId || 'Scene'}):\nIn this moment, ${env}.\nHere, ${charRef} steps into the scene.${dialogue}\n\n`;
    });
    prose += `And so, step by step, the story of ${projectTitle || 'the realm'} reaches its grand resolution!`;
    setNarrativeProseStory(prose);
  }, [isOpen, shots, characters, projectTitle]);

  const handleExtractCharactersFromShots = async () => {
    setIsExtractingLLM(true);
    const extracted = await extractProjectCharactersWithLLM(shots, projectTitle);
    if (extracted && extracted.length > 0) {
      setCharacters(extracted);
      setSelectedCharId(extracted[0]?.id || '');
      saveStoredCharacterProfiles(extracted);
      setToastMsg(`✨ Auto-Extracted ${extracted.length} Characters for ${projectTitle || 'this project'}!`);
      setTimeout(() => setToastMsg(null), 3000);
    }
    setIsExtractingLLM(false);
  };

  useEffect(() => {
    if (characters.length > 0) {
      saveStoredCharacterProfiles(characters);
    }
  }, [characters]);

  const activeChar = characters.find(c => c.id === selectedCharId) || characters[0];

  useEffect(() => {
    if (activeChar) {
      setEditingChar({ ...activeChar });
    } else {
      setEditingChar(null);
    }
  }, [selectedCharId, characters]);

  if (!isOpen) return null;

  const handleCreateNewChar = () => {
    const newId = `char_${Date.now()}`;
    const newChar = {
      id: newId,
      tag: `@NewCharacter_${characters.length + 1}`,
      name: 'New Character Name',
      role: 'Protagonist / Antagonist / Supporting',
      backstory: 'Describe the character backstory, origins, and core motivation...',
      characterConnections: 'Relationships with co-artists in the project...',
      shotPurpose: 'Dramatic reason for presence in shots...',
      mannerism: 'Physical gestures, nervous ticks, hand placements, posture habits...',
      walkingStyle: 'Striding speed, posture balance, gait rhythm...',
      dialogueDelivery: 'Speaking tempo, emotional inflection, dialect accent...',
      uniqueVoice: 'Vocal pitch, tone texture, timbre...',
      outfit: 'Signature outfit, color palette, props, visual style...'
    };
    const updated = [newChar, ...characters];
    setCharacters(updated);
    setSelectedCharId(newId);
  };

  const handleDeleteChar = (idToDelete) => {
    const updated = characters.filter(c => c.id !== idToDelete);
    setCharacters(updated);
    setSelectedCharId(updated[0]?.id || '');
  };

  const updateField = (field, value) => {
    if (!editingChar) return;
    setEditingChar(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveEditing = () => {
    if (!editingChar) return;
    const updated = characters.map(c => c.id === editingChar.id ? editingChar : c);
    setCharacters(updated);
    setHasUnsavedChanges(false);
    setToastMsg("✓ Character Bible Updated & Saved!");
    setTimeout(() => setToastMsg(null), 2500);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center font-mono transition-all ${isFullscreen ? 'p-0 bg-black' : 'p-4 bg-black/80 backdrop-blur-md'}`}>
      <div 
        className={`bg-zinc-900 border border-purple-500/40 shadow-2xl flex flex-col overflow-hidden transition-all ${
          isFullscreen ? 'w-full h-full max-w-none max-h-none rounded-none border-0' : 'w-full max-w-4xl h-[85vh] max-h-[85vh] rounded-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 bg-zinc-950/80 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800 shrink-0">
              {activeTab === 'script_story' ? <BookOpen className="w-5 h-5 text-amber-400" /> : <Users className="w-5 h-5 text-purple-400" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
                {activeTab === 'script_story' ? '📜 Master Script Story Engine' : '🎭 Character Bible Vault'}
                <span className="text-[10px] bg-purple-950 text-amber-300 border border-purple-700 px-2 py-0.5 rounded font-mono font-bold">
                  {projectTitle || 'Current Project'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {activeTab === 'script_story' 
                  ? 'Total extracted story arc from screenplay & scene beats.' 
                  : 'Manage detailed character backstories, mannerisms, gait & voice for character consistency.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'roster' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCharacterSourceMode('writer_written');
                    localStorage.setItem('sps_selected_character_source', 'writer_written');
                    handleCreateNewChar();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    characterSourceMode === 'writer_written'
                      ? 'bg-emerald-600 text-white shadow border border-emerald-400 font-extrabold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                  title="Writer writes or modifies character details manually"
                >
                  {characterSourceMode === 'writer_written' && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  <Edit3 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>✍️ Writer Written (Manual)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCharacterSourceMode('auto_extracted');
                    localStorage.setItem('sps_selected_character_source', 'auto_extracted');
                    setActiveTab('roster');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    characterSourceMode === 'auto_extracted'
                      ? 'bg-purple-600 text-white shadow border border-purple-400 font-extrabold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                  title="Switch to Auto-Extracted Character Roster View"
                >
                  {characterSourceMode === 'auto_extracted' && <Check className="w-3.5 h-3.5 text-amber-300 stroke-[3]" />}
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>🤖 Extracted Roster</span>
                </button>

                {/* Checkmark Checkbox for Adding Characters to Final Prompt */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !includeCharactersInPrompt;
                    setIncludeCharactersInPrompt(nextVal);
                    localStorage.setItem('sps_include_characters_in_prompt', nextVal ? 'true' : 'false');
                    setToastMsg(nextVal ? "✓ Characters Enabled for Final Prompt!" : "Disabled Characters in Final Prompt");
                    setTimeout(() => setToastMsg(null), 2000);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    includeCharactersInPrompt
                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                  }`}
                  title="Check to include Character Bibles in the compiled final prompt"
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${includeCharactersInPrompt ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-zinc-700'}`}>
                    {includeCharactersInPrompt && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span>Add to Final Prompt</span>
                </button>
              </>
            )}

            {toastMsg && (
              <span className="text-xs text-emerald-400 font-bold bg-emerald-950/90 border border-emerald-700 px-3 py-1 rounded-lg animate-pulse">
                {toastMsg}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleFullscreenMode()}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all"
              title={isFullscreen ? "Exit Normal View (ESC)" : "Full Screen View (⌘ + Enter)"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>ESC - normal view</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>cmd+enter - full screen</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              title="Close window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Master Tab Bar: Character Profiles | 360° Character Design Sheet | Master Script Story */}
        <div className="bg-slate-100 dark:bg-zinc-950 p-2.5 px-4 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2 flex-wrap font-mono text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-purple-600 text-white shadow border border-purple-400 font-extrabold'
                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-zinc-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>🎭 Character Profiles Vault</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('character_sheet')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'character_sheet'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow border border-amber-300'
                : 'bg-white dark:bg-zinc-900 text-amber-800 dark:text-amber-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-zinc-800'
            }`}
          >
            <Palette className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>🎨 360° Character Design Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('script_story')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'script_story'
                ? 'bg-cyan-600 text-white shadow border border-cyan-400 font-extrabold'
                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-zinc-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>📜 Master Script Story Engine</span>
          </button>
        </div>

        {activeTab === 'character_sheet' ? (
          <div className="p-5 flex-1 overflow-y-auto bg-slate-100 dark:bg-zinc-950 text-slate-950 dark:text-zinc-200 font-mono space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm font-sans">
                <Palette className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>🎨 360° CHARACTER DESIGN MODEL SHEET GENERATOR</span>
              </div>

              {/* Mode Selectors: 360 Turnaround | Expression Matrix | Wardrobe Sheet */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-200 dark:bg-zinc-900 p-1 rounded-xl border border-slate-300 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setCharacterSheetMode('turnaround')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      characterSheetMode === 'turnaround'
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>🔄 360° Turnaround Sheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCharacterSheetMode('expressions')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      characterSheetMode === 'expressions'
                        ? 'bg-purple-600 text-white font-black shadow'
                        : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <Smile className="w-3.5 h-3.5" />
                    <span>😃 Expression Matrix</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCharacterSheetMode('wardrobe')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      characterSheetMode === 'wardrobe'
                        ? 'bg-cyan-600 text-white font-black shadow'
                        : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <Shirt className="w-3.5 h-3.5" />
                    <span>👗 Wardrobe Sheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCharacterSheetMode('psychology')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      characterSheetMode === 'psychology'
                        ? 'bg-amber-500 text-zinc-950 font-black shadow'
                        : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>🧠 Psychology Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCharacterSheetMode('mannerisms')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      characterSheetMode === 'mannerisms'
                        ? 'bg-purple-600 text-white font-black shadow'
                        : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-purple-300" />
                    <span>🖐️ Mannerisms & Posture</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const txt = generateCharacterDesignSheetText(activeChar, characterSheetMode);
                    navigator.clipboard.writeText(txt);
                    setCopiedSheet(true);
                    setTimeout(() => setCopiedSheet(false), 2000);
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all"
                >
                  {copiedSheet ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                  <span>{copiedSheet ? 'Copied Prompt!' : 'Copy Design Prompt'}</span>
                </button>
              </div>
            </div>

            {/* Character Selection Pills Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 font-mono text-xs">
              <span className="text-slate-600 dark:text-zinc-400 font-bold shrink-0">Select Character:</span>
              {characters.map((c) => {
                const isSel = c.id === selectedCharId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCharId(c.id)}
                    className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer border ${
                      isSel
                        ? 'bg-purple-600 text-white border-purple-400 shadow'
                        : 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-300 border-slate-300 dark:border-zinc-800 hover:bg-slate-100'
                    }`}
                  >
                    {c.tag} ({c.name})
                  </button>
                );
              })}
            </div>

            {/* Live Character Design Sheet Prompt Display */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-slate-950 dark:text-zinc-100 font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-amber-500/30 shadow-sm font-bold">
              {generateCharacterDesignSheetText(activeChar, characterSheetMode)}
            </div>
          </div>
        ) : activeTab === 'script_story' ? (
          <div className="p-5 flex-1 overflow-y-auto bg-zinc-950 text-zinc-200 font-mono space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <BookOpen className="w-4 h-4" />
                <span>📜 TOTAL SCRIPT STORY & MASTER SYNTHESIS</span>
              </div>

              {/* Sub Toggle: Auto-Extracted LLM Story vs Narrative Prose vs Writer Original Screenplay */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setStorySourceMode('auto_extracted');
                      localStorage.setItem('sps_selected_story_mode', 'auto_extracted');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      storySourceMode === 'auto_extracted'
                        ? 'bg-amber-500 text-zinc-950 font-extrabold shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {storySourceMode === 'auto_extracted' && <Check className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />}
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>🤖 Auto-Extracted LLM Story</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStorySourceMode('narrative_prose');
                      localStorage.setItem('sps_selected_story_mode', 'narrative_prose');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      storySourceMode === 'narrative_prose'
                        ? 'bg-purple-500 text-white font-extrabold shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {storySourceMode === 'narrative_prose' && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>📖 Narrative Prose (Simple Story)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStorySourceMode('writer_original');
                      localStorage.setItem('sps_selected_story_mode', 'writer_original');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      storySourceMode === 'writer_original'
                        ? 'bg-cyan-500 text-zinc-950 font-extrabold shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {storySourceMode === 'writer_original' && <Check className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />}
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>✍️ Writer Original Screenplay</span>
                  </button>
                </div>

                {/* Checkmark Checkbox for Adding Story Memory to Final Prompt */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !includeStoryInPrompt;
                    setIncludeStoryInPrompt(nextVal);
                    localStorage.setItem('sps_include_story_in_prompt', nextVal ? 'true' : 'false');
                    setToastMsg(nextVal ? "✓ Story Memory Enabled for Final Prompt!" : "Disabled Story Memory in Final Prompt");
                    setTimeout(() => setToastMsg(null), 2000);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                    includeStoryInPrompt
                      ? 'bg-amber-950/90 text-amber-300 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                  }`}
                  title="Check to include selected Story Memory in the compiled final prompt"
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${includeStoryInPrompt ? 'bg-amber-500 border-amber-400 text-zinc-950' : 'border-zinc-700'}`}>
                    {includeStoryInPrompt && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span>Add to Final Prompt</span>
                </button>

                <span className="text-xs text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
                  Beats: {shots.length}
                </span>
              </div>
            </div>

            <div className="bg-zinc-900/90 p-5 rounded-2xl border border-amber-500/30 text-xs leading-relaxed font-mono whitespace-pre-wrap selection:bg-amber-500/30 shadow-inner">
              {storySourceMode === 'writer_original' ? (
                writerOriginalScript || "No writer screenplay text available in current project."
              ) : storySourceMode === 'narrative_prose' ? (
                narrativeProseStory
              ) : (
                extractedMasterStory
              )}
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Character List Selector Sidebar */}
          <div className="md:col-span-4 border-r border-zinc-800 p-3 bg-zinc-950/60 overflow-y-auto flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className={`text-xs font-bold flex items-center gap-1 font-mono ${characterSourceMode === 'auto_extracted' ? 'text-amber-300' : 'text-emerald-300'}`}>
                {characterSourceMode === 'auto_extracted' ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Extracted Roster ({characters.length})
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                    Writer Roster ({characters.length})
                  </>
                )}
              </span>

              {characterSourceMode === 'auto_extracted' ? (
                <button
                  type="button"
                  onClick={handleExtractCharactersFromShots}
                  disabled={isExtractingLLM}
                  className="px-2 py-0.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-amber-300 border border-purple-700/80 font-bold text-[11px] font-mono flex items-center gap-1 shadow-sm cursor-pointer"
                  title="Re-run LLM character extraction now"
                >
                  <RefreshCw className={`w-3 h-3 text-amber-300 ${isExtractingLLM ? 'animate-spin' : ''}`} />
                  <span>{isExtractingLLM ? 'Extracting...' : '🔄 Re-Extract Now'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateNewChar}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ New</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-0.5">
              {characters.map((char) => {
                const isSelected = char.id === selectedCharId;
                return (
                  <div
                    key={char.id}
                    onClick={() => setSelectedCharId(char.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-950/80 border-purple-500/80 shadow-md scale-[1.01]'
                        : 'bg-zinc-900/80 border-zinc-800 hover:border-purple-500/40 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400 font-mono truncate">{char.tag}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChar(char.id);
                        }}
                        className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete Character"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <h4 className="text-xs font-bold text-white font-sans mt-0.5 truncate">{char.name}</h4>
                    <p className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">{char.role}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Character Detail Form */}
          {editingChar ? (
            <div className="md:col-span-8 p-4 overflow-y-auto space-y-4 bg-zinc-900/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-300 font-mono block">Character Tag / Identifier (@Tag):</label>
                  <input
                    type="text"
                    value={editingChar.tag || ''}
                    onChange={(e) => updateField('tag', e.target.value)}
                    placeholder="@CharacterTag"
                    className="w-full bg-zinc-900 text-purple-300 border border-purple-800 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-200 font-mono block">Full Name:</label>
                  <input
                    type="text"
                    value={editingChar.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Full Character Name"
                    className="w-full bg-zinc-900 text-white border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Story & Backstory */}
              <div className="space-y-1.5 bg-zinc-950 p-3.5 rounded-xl border border-purple-500/40 shadow-inner">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-purple-300 font-mono flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    Character Deep Story & Core Motivation (Writer Master Story):
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingChar?.name) return;
                      setIsComposingLLM(true);
                      const res = await composeCharacterPersonaWithLLM(editingChar.name, editingChar.tag, editingChar.role, editingChar.backstory, shots, projectTitle);
                      setEditingChar(prev => ({
                        ...prev,
                        backstory: res.backstory || prev.backstory,
                        characterConnections: res.characterConnections || prev.characterConnections,
                        shotPurpose: res.shotPurpose || prev.shotPurpose,
                        mannerism: res.mannerism || prev.mannerism,
                        walkingStyle: res.walkingStyle || prev.walkingStyle,
                        dialogueDelivery: res.dialogueDelivery || prev.dialogueDelivery,
                        uniqueVoice: res.uniqueVoice || prev.uniqueVoice,
                        outfit: res.outfit || prev.outfit
                      }));
                      setHasUnsavedChanges(true);
                      setIsComposingLLM(false);
                      setToastMsg("✨ AI Composed Deep Character Story & Connections!");
                      setTimeout(() => setToastMsg(null), 3000);
                    }}
                    disabled={isComposingLLM}
                    className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-[10px] font-bold flex items-center gap-1.5 shadow-md border border-purple-400/40 transition-all cursor-pointer"
                    title="Let AI Screenwriter research/compose complete character story, mannerisms, gait & voice"
                  >
                    <Sparkles className={`w-3 h-3 text-amber-300 ${isComposingLLM ? 'animate-spin' : ''}`} />
                    <span>{isComposingLLM ? 'Composing Story...' : '⚡ AI Auto-Compose Persona & Story'}</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={editingChar.backstory || ''}
                  onChange={(e) => updateField('backstory', e.target.value)}
                  placeholder="Enter or paste full character backstory, origins, psychological trauma, oaths, and emotional driving force..."
                  className="w-full bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg p-2.5 text-xs font-mono leading-relaxed focus:outline-none focus:border-purple-400 resize-y shadow-inner font-medium"
                />
              </div>

              {/* 🧠 PSYCHOLOGY & SUBCONSCIOUS MINDSTATE VAULT */}
              <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-amber-500/40 shadow-inner">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <label className="text-xs font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    🧠 Character Psychology & Subconscious Mindstate Vault:
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">Drives behavior, dialogue, eye look & performance</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-300 font-mono block">Psychological Archetype & Cognitive Mindset:</label>
                    <input
                      type="text"
                      value={editingChar.psychologicalArchetype || ''}
                      onChange={(e) => updateField('psychologicalArchetype', e.target.value)}
                      placeholder="e.g. Heroic Protector, Trauma-Driven Vigilante, Stoic Sentinel, Volatile Mastermind"
                      className="w-full bg-zinc-900 text-amber-300 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-cyan-300 font-mono block">Internal Subconscious Conflict & Vulnerability:</label>
                    <input
                      type="text"
                      value={editingChar.internalConflict || ''}
                      onChange={(e) => updateField('internalConflict', e.target.value)}
                      placeholder="e.g. Duty vs Survival, Guilt over past failure masked by stoicism"
                      className="w-full bg-zinc-900 text-cyan-300 border border-cyan-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-purple-300 font-mono block">Behavioral Triggers & Stress Eye/Gesture Ticks:</label>
                    <input
                      type="text"
                      value={editingChar.behavioralTriggers || ''}
                      onChange={(e) => updateField('behavioralTriggers', e.target.value)}
                      placeholder="e.g. Hyper-vigilant eye scanning under threat, clenches jaw when challenged"
                      className="w-full bg-zinc-900 text-purple-300 border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-rose-300 font-mono block">Stress Reaction & Pressure Response:</label>
                    <input
                      type="text"
                      value={editingChar.stressReaction || ''}
                      onChange={(e) => updateField('stressReaction', e.target.value)}
                      placeholder="e.g. Laser-focused adrenaline surge, disassociation during betrayal"
                      className="w-full bg-zinc-900 text-rose-300 border border-rose-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-rose-400"
                    />
                  </div>
                </div>
              </div>

              {/* Character Connections & Shot Presence Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <label className="text-[11px] font-bold text-amber-400 font-mono flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    Narrative Connections to Other Characters:
                  </label>
                  <textarea
                    rows={2}
                    value={editingChar.characterConnections || ''}
                    onChange={(e) => updateField('characterConnections', e.target.value)}
                    placeholder="Relationships with co-artists (e.g. Sworn brother, rival, mentor, loyal follower)..."
                    className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg p-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-amber-400 resize-y"
                  />
                </div>

                <div className="space-y-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <label className="text-[11px] font-bold text-purple-300 font-mono flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    Shot Presence & Purpose (Why in the Shot):
                  </label>
                  <textarea
                    rows={2}
                    value={editingChar.shotPurpose || ''}
                    onChange={(e) => updateField('shotPurpose', e.target.value)}
                    placeholder="Dramatic reason for presence (e.g. Protect allies, command authority, anchor emotional beats)..."
                    className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg p-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-purple-400 resize-y"
                  />
                </div>
              </div>

              {/* 🖐️ MANNERISMS, BODY TICKS & POSTURE VAULT */}
              <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-purple-500/40 shadow-inner">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <label className="text-xs font-black font-mono text-purple-300 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    🖐️ Mannerisms, Gestures & Posture Vault:
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">Drives actor posture, gestures, head tilts & eye ticks</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-purple-300 font-mono block">Signature Hand & Arm Gestures:</label>
                    <input
                      type="text"
                      value={editingChar.handGestures || editingChar.mannerism || ''}
                      onChange={(e) => updateField('handGestures', e.target.value)}
                      placeholder="e.g. Rests right hand on sword hilt, finger-tapping on thigh under tension"
                      className="w-full bg-zinc-900 text-purple-300 border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-cyan-300 font-mono block">Posture Alignment & Shoulder Stance:</label>
                    <input
                      type="text"
                      value={editingChar.postureStance || ''}
                      onChange={(e) => updateField('postureStance', e.target.value)}
                      placeholder="e.g. Military straight spine, square shoulders, hunched defensive stance"
                      className="w-full bg-zinc-900 text-cyan-300 border border-cyan-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-300 font-mono block">Facial Twitches, Head Tilts & Eye Blink Cadence:</label>
                    <input
                      type="text"
                      value={editingChar.facialTicks || ''}
                      onChange={(e) => updateField('facialTicks', e.target.value)}
                      placeholder="e.g. Slow deliberate eye blink cadence, 15-degree head tilt when listening"
                      className="w-full bg-zinc-900 text-amber-300 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-300 font-mono block">Gait & Physical Striding Rhythm:</label>
                    <input
                      type="text"
                      value={editingChar.walkingStyle || ''}
                      onChange={(e) => updateField('walkingStyle', e.target.value)}
                      placeholder="e.g. Heavy rhythmic boots stride, silent panther-like footstep cadence"
                      className="w-full bg-zinc-900 text-emerald-300 border border-emerald-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {/* Unique Dialogue Delivery & Voice Texture */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <label className="text-[11px] font-bold text-amber-300 font-mono flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    Unique Dialogue Delivery Style:
                  </label>
                  <input
                    type="text"
                    value={editingChar.dialogueDelivery || ''}
                    onChange={(e) => updateField('dialogueDelivery', e.target.value)}
                    placeholder="Tempo, emotional cadence, dialect accent..."
                    className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <label className="text-[11px] font-bold text-purple-300 font-mono flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                    Unique Voice Texture & Timbre:
                  </label>
                  <input
                    type="text"
                    value={editingChar.uniqueVoice || ''}
                    onChange={(e) => updateField('uniqueVoice', e.target.value)}
                    placeholder="Deep baritone, raspy tenor, vocal acoustic echo..."
                    className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Signature Outfit & Visual Props */}
              <div className="space-y-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <label className="text-[11px] font-bold text-zinc-300 font-mono block">Signature Outfit, Attire & Visual Props:</label>
                <input
                  type="text"
                  value={editingChar.outfit || ''}
                  onChange={(e) => updateField('outfit', e.target.value)}
                  placeholder="Clothing style, color scheme, accessories, props..."
                  className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveEditing}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs font-mono shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Character Profile</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="md:col-span-8 p-8 flex flex-col items-center justify-center text-zinc-500 font-mono">
              <User className="w-12 h-12 stroke-1 text-zinc-700 mb-2" />
              <p className="text-xs">Select or create a character profile to edit story & behavior parameters.</p>
            </div>
          )}
        </div>
        )}

        {/* Modal Bottom Action Footer Bar */}
        <div className="p-3 px-5 border-t border-zinc-800 bg-zinc-950/90 flex items-center justify-between shrink-0 font-mono text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Stage Production Studio · Story & Character Vault</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                handleSaveEditing();
                onClose();
              }}
              className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-amber-500 to-emerald-500 hover:brightness-110 text-zinc-950 font-black shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 fill-zinc-950" />
              <span>Save & Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal Popup */}
      {showConfirmClosePopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
          <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-800">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white font-sans">Unsaved Story & Character Changes</h4>
                <p className="text-xs text-zinc-400">You have unsaved edits in the character bible or story settings.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              Would you like to save your edits before closing, or discard your pending changes?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmClosePopup(false);
                  setHasUnsavedChanges(false);
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition-all cursor-pointer"
              >
                Discard & Close
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSaveEditing();
                  setShowConfirmClosePopup(false);
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-amber-500 to-emerald-500 hover:brightness-110 text-zinc-950 text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 fill-zinc-950" />
                <span>Save & Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
