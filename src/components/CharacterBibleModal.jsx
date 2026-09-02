import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, User, Sparkles, Plus, Trash2, Check, BookOpen, Volume2, 
  Activity, MessageSquare, Shield, Save, UserCheck, RefreshCw, AlertCircle,
  Maximize2, Minimize2, Users, Palette, Copy, Wand2, Download, Archive
} from 'lucide-react';
import { assertExportAllowed, logExportSuccess, exportDownloadText, resolveCollabRoomId } from '../utils/exportGate';
import {
  characterLookSheetsToPrintHtml,
  characterBibleToCsv,
  buildCharacterBibleZipFiles
} from '../utils/characterBibleExport';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { createZipArchive } from '../utils/zipUtils';
import StudioProfileControl from './StudioProfileControl';
import { saveExportBlob } from '../utils/saveExportFile';
import { composeCharacterPersonaWithLLM, extractProjectCharactersWithLLM, extractCharacterReferenceSheets } from '../services/aiScriptParser';
import { readLockedImageFile } from '../utils/continuitySpine';
import { composeLookFacts, sheetPromptGuard, storyLooksIndianEpic } from '../utils/characterSheetLock';
import CinematicReferencesPanel from './CinematicReferencesPanel';
import { isGuestSession, canGuestBrowseApp } from '../utils/projectPermissions';
import { GUEST_PLAY_CHARACTERS } from '../utils/guestPlayground';
import {
  getActiveCharacterProfiles,
  saveActiveCharacterProfiles
} from '../utils/projectBibleVault';
import {
  assertCanMutateContent,
  ensureLifecycle,
  isLifecycleLocked,
  ASSET_LOCKED_MUTABLE_KEYS
} from '../utils/productionLifecycle';
import LifecycleControls from './LifecycleControls';

export function getStoredCharacterProfiles() {
  if (typeof window === 'undefined') return [];
  try {
    if (isGuestSession() && canGuestBrowseApp()) return GUEST_PLAY_CHARACTERS.map((c) => ({ ...c }));
    return getActiveCharacterProfiles();
  } catch (e) {
    return [];
  }
}

export function saveStoredCharacterProfiles(profiles, { silent = false, title = '' } = {}) {
  if (typeof window === 'undefined') return;
  try {
    const email = String(localStorage.getItem('sps_authorized_user_email') || '').trim().toLowerCase();
    const guest = !email || email === 'guest' || email === 'click to login' || email === 'unauthenticated';
    if (guest) return;
    saveActiveCharacterProfiles(profiles, { silent, title });
  } catch (e) {}
}

function charSource(char) {
  if (char?.source === 'writer_written' || char?.source === 'ai_enhance' || char?.source === 'hybrid') return char.source;
  return 'auto_extracted';
}

function sheetOrigin(char) {
  const s = charSource(char);
  if (s === 'writer_written') return 'manual';
  if (s === 'auto_extracted') return 'ai_extracted';
  return 'hybrid';
}

const CRAFT_SOURCE_TABS = [
  { id: 'all', label: 'All', hint: 'Every profile in the vault' },
  { id: 'writer_written', label: 'Writer', hint: 'You write and lock the bible' },
  { id: 'auto_extracted', label: 'Extract', hint: 'Roster pulled from the script' },
  { id: 'ai_enhance', label: 'Enhance', hint: 'LLM-polished look and persona' },
];

const SHEET_ORIGIN_TABS = [
  { id: 'all', label: 'All' },
  { id: 'manual', label: 'Manual' },
  { id: 'ai_extracted', label: 'AI extracted' },
  { id: 'hybrid', label: 'Hybrid' },
];

const SHEET_TYPES = [
  { id: 'turnaround', label: 'Turnaround' },
  { id: 'expressions', label: 'Face' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'psychology', label: 'Mind' },
  { id: 'mannerisms', label: 'Body' },
];

const SOURCE_SHORT = {
  all: 'All',
  writer_written: 'Manual',
  auto_extracted: 'AI',
  ai_enhance: 'Hybrid',
  hybrid: 'Hybrid',
};

function sameProfiles(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function clipTxt(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function formatCharacterProfileText(char) {
  if (!char) return '';
  const line = (label, value) => {
    const v = String(value || '').trim();
    return v ? `${label}: ${v}` : '';
  };
  return [
    `CHARACTER PROFILE — ${char.name || 'Unnamed'} ${char.tag || ''}`.trim(),
    line('Role', char.role),
    line('Story', char.backstory),
    line('Connections', char.characterConnections),
    line('Shot purpose', char.shotPurpose),
    line('Archetype', char.psychologicalArchetype),
    line('Internal conflict', char.internalConflict),
    line('Mannerism', char.handGestures || char.mannerism),
    line('Walk', char.walkingStyle),
    line('Dialogue', char.dialogueDelivery),
    line('Voice', char.uniqueVoice),
    line('Outfit', char.outfit),
    line('Wardrobe', char.wardrobeElements),
    line('Accessories', char.accessories),
    line('Costume', char.costumeDetails),
    line('Palette', char.colorPalette)
  ]
    .filter(Boolean)
    .join('\n');
}

function readActiveSynopsis() {
  if (typeof window === 'undefined') return '';
  try {
    const src = localStorage.getItem('sps_script_synopsis_source') || 'auto_llm';
    if (src === 'writer_custom') {
      return localStorage.getItem('sps_writer_custom_script_synopsis') || localStorage.getItem('sps_extracted_master_story') || '';
    }
    return localStorage.getItem('sps_extracted_master_story') || localStorage.getItem('sps_writer_custom_script_synopsis') || '';
  } catch {
    return '';
  }
}

function genreKeyFromSettings() {
  try {
    return localStorage.getItem('sps_preset_profile') || localStorage.getItem('sps_active_genre') || '';
  } catch {
    return '';
  }
}

function genreLockLabel(projectTitle = '', synopsis = '') {
  const genre = genreKeyFromSettings();
  if (storyLooksIndianEpic({ title: projectTitle, synopsis, genreKey: genre })) {
    return 'Indian mythological period epic (Mahabharata / Ramayana grammar). Photoreal flesh and cloth, silk and gold, not CGI-fantasy chrome';
  }
  const map = {
    mythological: 'Indian mythological period epic (Mahabharata / Ramayana grammar). Photoreal flesh and cloth, not CGI-fantasy chrome',
    action: 'photoreal cinematic action-thriller',
    cyberpunk: 'neon cyberpunk stage / megacity',
    scifi: 'photoreal science-fiction',
    fantasy: 'grounded high fantasy, tactile costumes',
    horror: 'horror / supernatural, motivated practical light'
  };
  return map[genre] || 'photoreal theatrical feature, story-accurate';
}

function collectStoryLock(shots, char, projectTitle) {
  const synopsis = clipTxt(readActiveSynopsis(), 420);
  const title = projectTitle || 'this feature';
  const facts = composeLookFacts({
    char,
    shots,
    projectTitle: title,
    synopsis,
    genreKey: genreKeyFromSettings()
  });
  return {
    title,
    genre: genreLockLabel(title, synopsis),
    genreKey: genreKeyFromSettings(),
    synopsis,
    beats: facts.beats,
    world: facts.light,
    place: facts.place,
    makeup: facts.makeup,
    outfitFromShots: facts.outfit || (facts.shotGarments || [])[0] || '',
    identity: facts.station,
    facts
  };
}

function storyHeader(lock, char) {
  return [
    `FILM: ${lock.title}`,
    `WORLD / GENRE: ${lock.genre}`,
    lock.identity ? `STATION: ${lock.identity}` : '',
    lock.synopsis ? `STORY: ${lock.synopsis}` : '',
    lock.beats ? `THIS PERSON ON SCREEN: ${lock.beats}` : '',
    lock.place ? `PLACE / ACTION: ${lock.place}` : '',
    lock.world ? `LIGHT / TIME: ${lock.world}` : '',
    `ROLE: ${char.role || 'cast'} · ${char.shotPurpose || ''}`.trim(),
    `BACKSTORY (use as identity, not as extra plot): ${clipTxt(char.backstory, 280) || 'as in the film'}`
  ].filter(Boolean).join('\n');
}

export default function CharacterBibleModal({ isOpen, onClose, shots = [], projectTitle = '', initialTab = 'roster', asRoom = false }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'character_sheet' ? 'character_sheet' : 'roster');
  const [characterSheetMode, setCharacterSheetMode] = useState('turnaround');
  const [sheetOriginMode, setSheetOriginMode] = useState('all');
  const [copiedSheet, setCopiedSheet] = useState(false);
  const [copiedProfileId, setCopiedProfileId] = useState('');
  const [characters, setCharacters] = useState(() => getStoredCharacterProfiles());
  const [selectedCharId, setSelectedCharId] = useState('');
  const [editingChar, setEditingChar] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [isComposingLLM, setIsComposingLLM] = useState(false);
  const [isExtractingLLM, setIsExtractingLLM] = useState(false);
  const [isExtractingSheets, setIsExtractingSheets] = useState(false);
  const [characterSourceMode, setCharacterSourceMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_selected_character_source') || 'all';
    }
    return 'all';
  });
  const [includeCharactersInPrompt, setIncludeCharactersInPrompt] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sps_include_characters_in_prompt') !== 'false';
    }
    return true;
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmClosePopup, setShowConfirmClosePopup] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: characterLifecycleStrict,
    mode: characterLifecycleMode
  } = useExportLifecyclePref('character');
  const characterExportBlocked = characterLifecycleStrict && !exportLife.exportReady;
  const roomId = resolveCollabRoomId();
  const charSlug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const charLifeNote = `${characters.length} cast · ${
    characters.filter((c) => c?.lockedRefs?.face).length
  } face · ${characters.filter((c) => c?.lockedRefs?.body).length} body${roomId ? ` · room:${roomId}` : ''}`;

  const exportCharacterCsv = () => {
    if (!characters.length) {
      setToastMsg('No characters to export.');
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    exportDownloadText(`${charSlug}_cast.csv`, characterBibleToCsv(characters, projectTitle), {
      projectTitle,
      auditLabel: 'character_bible_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: characterLifecycleMode,
      shots,
      roomId,
      note: charLifeNote
    });
  };

  const exportCharacterZip = async () => {
    if (characterExportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'character_bible_zip',
        format: 'zip',
        lifecycleMode: characterLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'character_bible_zip',
      format: 'zip',
      lifecycleMode: characterLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    if (!characters.length) {
      setToastMsg('No characters to export.');
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    const files = buildCharacterBibleZipFiles(characters, projectTitle, { roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${charSlug}_character_bible.zip`, {
      projectTitle,
      shots,
      lifecycleMode: characterLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'character_bible_zip',
      auditFormat: 'zip',
      roomId,
      note: charLifeNote,
      showAlert: false
    });
    setToastMsg('Character bible ZIP saved.');
    setTimeout(() => setToastMsg(null), 3500);
  };

  const generateCharacterDesignSheetText = (char, mode = 'turnaround') => {
    if (!char) return 'No character profile selected.';

    const lock = collectStoryLock(shots, char, projectTitle);
    const charTag = char.tag || '@Character';
    const charName = char.name || 'Character';
    const outfit =
      clipTxt(char.outfit, 220) ||
      clipTxt(lock.outfitFromShots, 220) ||
      `period-accurate costume for ${lock.genre}, as this person wears in ${lock.title}`;
    const elements = clipTxt(char.wardrobeElements, 220) || outfit;
    const accessories = clipTxt(char.accessories, 180) || 'only props this person holds in the story';
    const costumeDetails = clipTxt(char.costumeDetails, 180) || lock.makeup || 'weathering and fabric of this world, not costume-shop shine';
    const palette = clipTxt(char.colorPalette, 140) || 'colors of this film’s world, not fashion-week neutrals';
    const mannerisms = clipTxt(char.handGestures || char.mannerism, 160) || 'body language from their scenes, not a stock hero pose';
    const face = clipTxt(char.uniqueVoice || char.dialogueDelivery, 160);
    const spine = storyHeader(lock, char);
    const guard = sheetPromptGuard(lock.facts || composeLookFacts({
      char,
      shots,
      projectTitle: lock.title,
      synopsis: lock.synopsis,
      genreKey: lock.genreKey
    }));
    const extractedSheet = char.referenceSheets?.[mode];
    if (extractedSheet && String(extractedSheet).trim().length > 40) {
      return `${spine}

${guard}

PRODUCTION STILLS — ${String(mode).toUpperCase()} (${charName} ${charTag})
${String(extractedSheet).trim()}`;
    }

    if (mode === 'turnaround') {
      return `${spine}

${guard}

IMAGE PROMPT — FOUR MATCHED PRODUCTION STILLS (${charName} ${charTag}):
Same adult performer as ${charName} in the film "${lock.title}", one costume, one face. Four panels on one frame: front, three-quarter, profile, back. Live-action cinema stills of a person standing in ${lock.place || 'a location from this story'}, lit as ${lock.world || 'the film’s motivated light'}.
Costume: ${outfit}. Layers: ${elements}. ${costumeDetails}. Palette: ${palette}.
${lock.beats ? `Story beat: ${lock.beats}` : ''}
${lock.genre}. 8k photoreal.`;
    }

    if (mode === 'expressions') {
      return `${spine}

${guard}

IMAGE PROMPT — FACE SHEET (${charName} ${charTag}):
Photoreal facial expression sheet of ${charName} from "${lock.title}" only. Six close-up portraits, same skull, skin, age, scars, hair, jewelry.
Expressions must come from THIS story, not a stock emotion grid:
1. The feeling in: ${lock.beats || lock.synopsis || char.shotPurpose || 'their first scene'}
2. Stoic public face they show other characters
3. Private fear or grief from: ${clipTxt(char.internalConflict || char.backstory, 160)}
4. Anger or oath as ${char.psychologicalArchetype || char.role || 'this role'}
5. Exhaustion after the beat
6. Speaking a line — mouth shape of their voice: ${face || char.dialogueDelivery || 'story-accurate speech'}
Hair/makeup: ${lock.makeup || costumeDetails}. Light: ${lock.world || 'motivated cinema key, 85mm'}. ${lock.genre}.`;
    }

    if (mode === 'wardrobe') {
      return `${spine}

${guard}

IMAGE PROMPT — WARDROBE (${charName} ${charTag}):
Costume continuity for ${charName} in "${lock.title}". Photoreal, worn in ${lock.place || 'the story’s locations'}.
1. Full-body costume as worn on set: ${outfit}
2. Layer breakdown: ${elements}
3. Accessories and held props from the plot: ${accessories}
4. Fabric/weathering: ${costumeDetails}. Palette: ${palette}
Clothing must match ${lock.genre}. Queens and mothers wear sari and jewelry of this court. Do not default to armor.`;
    }

    if (mode === 'psychology') {
      return `${spine}

${guard}

IMAGE PROMPT — MIND / INNER STATE (${charName} ${charTag}):
Still from "${lock.title}": ${charName} alone in ${lock.place || 'a story location'}, face carrying their inner life.
Archetype: ${char.psychologicalArchetype || char.role || 'as written'}.
Conflict: ${char.internalConflict || clipTxt(char.backstory, 180) || 'as in the synopsis'}.
Trigger in the body: ${char.behavioralTriggers || mannerisms}.
Stress: ${char.stressReaction || 'held, story-specific, not generic rage'}.
Camera: 85mm portrait, motivated light (${lock.world || 'scene light'}), photoreal, ${lock.genre}.
Psychology through eyes and posture, not floating symbols.`;
    }

    if (mode === 'mannerisms') {
      return `${spine}

${guard}

IMAGE PROMPT — BODY / GAIT (${charName} ${charTag}):
Full-body performance still of ${charName} in "${lock.title}", in ${lock.place || 'a location from their scenes'}.
Hands: ${char.handGestures || mannerisms}.
Spine/stance: ${char.postureStance || 'posture from their station in this story'}.
Face ticks: ${char.facialTicks || 'micro-expression from their scenes'}.
Walk: ${char.walkingStyle || 'gait that matches age, costume, and terrain of this story'}.
Costume locked: ${outfit}. ${lock.genre}. Photoreal cinema, ${lock.world || 'scene lighting'}.`;
    }

    return '';
  };

  useEffect(() => {
    if (!asRoom && !isOpen) return undefined;
    const handleVaultUpdate = () => {
      const stored = getStoredCharacterProfiles();
      setCharacters((prev) => (sameProfiles(prev, stored) ? prev : stored));
      setSelectedCharId((prev) => prev || stored[0]?.id || '');
    };
    window.addEventListener('sps_character_vault_updated', handleVaultUpdate);
    return () => window.removeEventListener('sps_character_vault_updated', handleVaultUpdate);
  }, [isOpen, asRoom]);

  useEffect(() => {
    if (!asRoom && !isOpen) return;
    setActiveTab(initialTab === 'character_sheet' ? 'character_sheet' : 'roster');
    const stored = getStoredCharacterProfiles();
    setCharacters((prev) => (sameProfiles(prev, stored) ? prev : stored));
    if (stored[0]?.id) setSelectedCharId((prev) => prev || stored[0].id);
  }, [isOpen, asRoom, initialTab, projectTitle]);

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
      if (!asRoom && !isOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreenMode();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          toggleFullscreenMode(false);
        } else if (!asRoom) {
          handleRequestClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, asRoom, isFullscreen, hasUnsavedChanges]);

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

  useEffect(() => {
    if (!asRoom && !isOpen) return;
    setHasUnsavedChanges(false);
    setShowConfirmClosePopup(false);
  }, [isOpen, asRoom]);

  const handleExtractCharactersFromShots = async () => {
    setIsExtractingLLM(true);
    try {
      const extracted = await extractProjectCharactersWithLLM(shots, projectTitle);
      if (!extracted?.length) {
        setToastMsg('No named people in Matrix or Writer yet. Parse a script into shots, then Extract again.');
        setTimeout(() => setToastMsg(null), 4000);
      } else {
        const tagged = extracted.map((c) => ({ ...c, source: 'auto_extracted' }));
        setCharacters((prev) => {
          const keep = prev.filter((c) => charSource(c) !== 'auto_extracted');
          return [...keep, ...tagged];
        });
        setCharacterSourceMode('all');
        localStorage.setItem('sps_selected_character_source', 'all');
        setSelectedCharId(tagged[0]?.id || '');
        setToastMsg(`✨ Auto-Extracted ${tagged.length} Characters for ${projectTitle || 'this project'}!`);
        setTimeout(() => setToastMsg(null), 3000);
      }
    } catch (err) {
      setToastMsg(err?.message || 'Extract failed.');
      setTimeout(() => setToastMsg(null), 3000);
    }
    setIsExtractingLLM(false);
  };

  const handleExtractReferenceSheets = async () => {
    const roster = characters.length ? characters : [];
    if (!roster.length) {
      setToastMsg('Extract people on Profiles first, then extract reference sheets.');
      setTimeout(() => setToastMsg(null), 3500);
      return;
    }
    setIsExtractingSheets(true);
    try {
      const next = await extractCharacterReferenceSheets({
        characters: roster,
        shots,
        projectTitle
      });
      if (next?.length) {
        setCharacters(next);
        setToastMsg(`Character reference sheets ready for ${next.length} people (Turnaround, Face, Wardrobe, Mind, Body).`);
        setTimeout(() => setToastMsg(null), 4000);
      } else {
        setToastMsg('Could not build reference sheets. Check API key and story text.');
        setTimeout(() => setToastMsg(null), 3500);
      }
    } catch (err) {
      setToastMsg(err?.message || 'Reference sheet extract failed.');
      setTimeout(() => setToastMsg(null), 3000);
    }
    setIsExtractingSheets(false);
  };

  useEffect(() => {
    if (!asRoom && !isOpen) return;
    saveStoredCharacterProfiles(characters, { silent: true, title: projectTitle });
  }, [characters, isOpen, asRoom, projectTitle]);

  const visibleCharacters = useMemo(
    () => characters.filter((c) => {
      if (characterSourceMode === 'all') return true;
      const s = charSource(c);
      if (characterSourceMode === 'writer_written') return s === 'writer_written' || s === 'hybrid';
      return s === characterSourceMode;
    }),
    [characters, characterSourceMode]
  );

  const sheetPeople = useMemo(
    () => (sheetOriginMode === 'all' ? characters : characters.filter((c) => sheetOrigin(c) === sheetOriginMode)),
    [characters, sheetOriginMode]
  );

  const sheetCharacters = sheetPeople;
  const listForEdit = activeTab === 'character_sheet' ? sheetCharacters : visibleCharacters;
  const activeChar = listForEdit.find((c) => c.id === selectedCharId) || listForEdit[0] || null;

  useEffect(() => {
    if (activeTab !== 'roster') return;
    if (!visibleCharacters.some((c) => c.id === selectedCharId)) {
      setSelectedCharId(visibleCharacters[0]?.id || '');
    }
  }, [characterSourceMode, visibleCharacters, selectedCharId, activeTab]);

  useEffect(() => {
    if (hasUnsavedChanges && editingChar?.id && editingChar.id === activeChar?.id) return;
    if (activeChar) {
      setEditingChar({ ...activeChar });
    } else {
      setEditingChar(null);
    }
  }, [selectedCharId, activeChar?.id]);

  if (!asRoom && !isOpen) return null;

  const handleCreateNewChar = () => {
    const newId = `char_${Date.now()}`;
    const newChar = ensureLifecycle({
      id: newId,
      source: 'writer_written',
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
      outfit: 'Signature outfit, color palette, props, visual style...',
      wardrobeElements: 'Headwear, outer layer, inner garments, bottoms, footwear, belt, embroidery...',
      accessories: 'Jewelry, weapons, ritual objects, bags, held props...',
      costumeDetails: 'Weathering, fabric, makeup-as-costume, scene costume changes...',
      colorPalette: 'Primary, accent, and metal tones...',
      lifecycleStatus: 'draft'
    });
    const updated = [newChar, ...characters];
    setCharacters(updated);
    setCharacterSourceMode('writer_written');
    localStorage.setItem('sps_selected_character_source', 'writer_written');
    setSelectedCharId(newId);
  };

  const handleDeleteChar = (idToDelete) => {
    const target = characters.find((c) => c.id === idToDelete);
    if (target && isLifecycleLocked(target)) {
      setToastMsg('Unlock before deleting a locked character.');
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    const updated = characters.filter((c) => c.id !== idToDelete);
    setCharacters(updated);
    setSelectedCharId(updated[0]?.id || '');
  };

  const copyCharacterProfile = async (char) => {
    const txt = formatCharacterProfileText(char);
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedProfileId(char.id || 'ok');
      setTimeout(() => setCopiedProfileId(''), 1600);
    } catch {
      setToastMsg('Could not copy profile.');
      setTimeout(() => setToastMsg(null), 2500);
    }
  };

  const updateField = (field, value) => {
    if (!editingChar) return;
    if (ASSET_LOCKED_MUTABLE_KEYS.includes(field)) {
      setEditingChar((prev) => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(true);
      return;
    }
    if (!assertCanMutateContent(editingChar).ok) {
      setToastMsg('Locked — unlock to edit this character.');
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    setEditingChar((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleLifecycleChange = (nextEntity) => {
    if (!nextEntity?.id) return;
    setEditingChar(nextEntity);
    setCharacters((prev) => prev.map((c) => (c.id === nextEntity.id ? nextEntity : c)));
    setHasUnsavedChanges(true);
  };

  const handleSaveEditing = () => {
    if (!editingChar) return;
    let nextSource = editingChar.source || characterSourceMode;
    if (charSource(editingChar) === 'auto_extracted' && characterSourceMode === 'writer_written') {
      nextSource = 'hybrid';
    }
    const saved = ensureLifecycle({ ...editingChar, source: nextSource });
    const updated = characters.map((c) => (c.id === saved.id ? saved : c));
    setCharacters(updated);
    setHasUnsavedChanges(false);
    setToastMsg('✓ Character Bible Updated & Saved!');
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleAiEnhanceSelected = async () => {
    const src = editingChar || visibleCharacters[0] || characters[0];
    if (!src?.name) {
      setToastMsg('Select a character in Writer edited or AI extract first.');
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    if (!assertCanMutateContent(src).ok) {
      setToastMsg('Locked — unlock to enhance this character.');
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    setIsComposingLLM(true);
    const res = await composeCharacterPersonaWithLLM(src.name, src.tag, src.role, src.backstory, shots, projectTitle);
    const enhanced = {
      ...src,
      ...res,
      id: characters.find((c) => charSource(c) === 'ai_enhance' && (c.tag === src.tag || c.name === src.name))?.id || `char_enh_${Date.now()}`,
      source: 'ai_enhance',
    };
    setCharacters((prev) => {
      const exists = prev.some((c) => c.id === enhanced.id);
      return exists ? prev.map((c) => (c.id === enhanced.id ? enhanced : c)) : [enhanced, ...prev];
    });
    setCharacterSourceMode('ai_enhance');
    localStorage.setItem('sps_selected_character_source', 'ai_enhance');
    setSelectedCharId(enhanced.id);
    setHasUnsavedChanges(true);
    setIsComposingLLM(false);
    setToastMsg('✨ AI enhance locked on this character.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className={asRoom ? 'h-full min-h-0 w-full overflow-hidden' : `sps-overlay ${isFullscreen ? 'is-full' : ''}`}>
      <div 
        className={`sps-shell sps-atelier-room ${asRoom ? 'h-full max-h-none rounded-none border-0 shadow-none' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--sps-border)] p-4 bg-[var(--sps-bg-elevated)] shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="sps-mark shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--sps-text)] font-sans flex items-center gap-2 m-0">
                Characters
                <span className="sps-chip text-[10px] normal-case tracking-normal">
                  {projectTitle || 'Current Project'}
                </span>
              </h3>
              <p className="text-xs text-[var(--sps-muted)]">
                {activeTab === 'character_sheet'
                  ? 'Character reference sheets (turnaround, face, wardrobe, mind, body). Extract sheets from the story, then copy the image prompt.'
                  : 'Edit the bible. Extract fills the roster from the script.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'roster' && (
              <button
                type="button"
                onClick={() => {
                  const nextVal = !includeCharactersInPrompt;
                  setIncludeCharactersInPrompt(nextVal);
                  localStorage.setItem('sps_include_characters_in_prompt', nextVal ? 'true' : 'false');
                  setToastMsg(nextVal ? "✓ Characters Enabled for Final Prompt!" : "Disabled Characters in Final Prompt");
                  setTimeout(() => setToastMsg(null), 2000);
                }}
                className={`sps-btn text-xs ${includeCharactersInPrompt ? 'sps-btn-primary' : ''}`}
                title="Check to include Character Bibles in the compiled final prompt"
              >
                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${includeCharactersInPrompt ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-zinc-700'}`}>
                  {includeCharactersInPrompt && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
                <span>Add to Final Prompt</span>
              </button>
            )}

            {toastMsg && (
              <span className="text-xs text-emerald-400 font-bold bg-emerald-950/90 border border-emerald-700 px-3 py-1 rounded-lg animate-pulse">
                {toastMsg}
              </span>
            )}
            <button
              type="button"
              className="sps-btn text-xs"
              disabled={characterExportBlocked}
              title={characterExportBlocked ? exportLife.message : 'Print character look sheets as PDF'}
              onClick={() => {
                if (characterExportBlocked) {
                  assertExportAllowed({
                    projectTitle,
                    label: 'character_look_pdf',
                    format: 'pdf',
                    lifecycleMode: characterLifecycleMode,
                    shots,
                    roomId,
                    showAlert: true
                  });
                  return;
                }
                const gate = assertExportAllowed({
                  projectTitle,
                  label: 'character_look_pdf',
                  format: 'pdf',
                  lifecycleMode: characterLifecycleMode,
                  shots,
                  roomId,
                  showAlert: true
                });
                if (!gate.ok) return;
                if (!characters.length) {
                  setToastMsg('No characters to print.');
                  setTimeout(() => setToastMsg(null), 2500);
                  return;
                }
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                  window.alert('Please allow popups to export PDF.');
                  return;
                }
                printWindow.document.write(characterLookSheetsToPrintHtml(characters, projectTitle, { roomId }));
                printWindow.document.close();
                logExportSuccess({
                  projectTitle,
                  label: 'character_look_pdf',
                  format: 'pdf',
                  filename: `${charSlug}_character_looks.pdf`,
                  roomId,
                  note: charLifeNote,
                  lifecycleMode: gate.advisory ? `${characterLifecycleMode}+ok` : characterLifecycleMode
                });
                setToastMsg('Look-sheet print opened — save as PDF.');
                setTimeout(() => setToastMsg(null), 3500);
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Look PDF
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={characterExportBlocked}
              title={characterExportBlocked ? exportLife.message : 'Export cast CSV'}
              onClick={exportCharacterCsv}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={characterExportBlocked}
              title={characterExportBlocked ? exportLife.message : 'Download character bible ZIP'}
              onClick={exportCharacterZip}
            >
              <Archive className="w-3.5 h-3.5" />
              ZIP
            </button>
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

            <StudioProfileControl />
            {!asRoom ? (
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              title="Close window"
            >
              <X className="w-4 h-4" />
            </button>
            ) : null}
          </div>
        </div>

        {/* Master Tab Bar: Character Profiles | 360° Character Design Sheet | Master Script Story */}
        <div className="bg-[var(--sps-bg-elevated)] p-2 px-3 border-b border-[var(--sps-border)] flex items-center gap-1.5 flex-wrap shrink-0">
          <div className="sps-tabs" role="tablist" aria-label="Character rooms">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'roster'}
              onClick={() => setActiveTab('roster')}
              title="Character profiles"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              Profiles
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'character_sheet'}
              onClick={() => setActiveTab('character_sheet')}
              title="360° character reference sheets"
            >
              <Palette className="w-3.5 h-3.5 shrink-0" />
              Ref sheets
            </button>
          </div>
          <CinematicReferencesPanel
            sectionId="character"
            genreKey={
              (typeof window !== 'undefined' && localStorage.getItem('sps_preset_profile')) ||
              'mythological'
            }
            projectTitle={projectTitle}
            compact
            className="ml-auto"
          />
        </div>

        {activeTab === 'roster' && (
          <div className="px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-surface)] flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-[10px] font-mono text-[var(--sps-muted)] shrink-0">Draft</span>
            <div className="sps-tabs" role="tablist" aria-label="Character source">
              {CRAFT_SOURCE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={characterSourceMode === tab.id}
                  title={tab.hint}
                  onClick={() => {
                    setCharacterSourceMode(tab.id);
                    localStorage.setItem('sps_selected_character_source', tab.id);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {characterSourceMode === 'auto_extracted' || characterSourceMode === 'all' ? (
              <button type="button" className="sps-btn text-[10px]" onClick={handleExtractCharactersFromShots} disabled={isExtractingLLM}>
                <RefreshCw className={`w-3 h-3 ${isExtractingLLM ? 'animate-spin' : ''}`} />
                {isExtractingLLM ? 'Extracting…' : 'Extract from script'}
              </button>
            ) : null}
            {characterSourceMode === 'writer_written' || characterSourceMode === 'all' ? (
              <button type="button" className="sps-btn sps-btn-primary text-[10px]" onClick={handleCreateNewChar}>
                <Plus className="w-3 h-3" />
                New
              </button>
            ) : null}
            {characterSourceMode === 'ai_enhance' ? (
              <button type="button" className="sps-btn sps-btn-primary text-[10px]" onClick={handleAiEnhanceSelected} disabled={isComposingLLM}>
                <Wand2 className={`w-3 h-3 ${isComposingLLM ? 'animate-spin' : ''}`} />
                {isComposingLLM ? 'Enhancing…' : 'Enhance selected'}
              </button>
            ) : null}
          </div>
        )}

        {activeTab === 'character_sheet' ? (
          <div className="p-4 flex-1 overflow-y-auto bg-[var(--sps-bg)] text-[var(--sps-text)] space-y-3">
            {characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <User className="w-10 h-10 text-[var(--sps-muted)] stroke-1" />
                <p className="text-sm text-[var(--sps-muted)]">No people yet. Extract profiles first, then extract character reference sheets.</p>
                <div className="flex gap-2">
                  <button type="button" className="sps-btn sps-btn-primary text-xs" onClick={handleExtractCharactersFromShots} disabled={isExtractingLLM}>
                    <RefreshCw className={`w-3 h-3 ${isExtractingLLM ? 'animate-spin' : ''}`} />
                    {isExtractingLLM ? 'Extracting…' : 'Extract from script'}
                  </button>
                  <button type="button" className="sps-btn text-xs" onClick={handleCreateNewChar}>
                    New character
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-[var(--sps-muted)] shrink-0">Origin</span>
                  <div className="sps-tabs" role="tablist" aria-label="Sheet origin">
                    {SHEET_ORIGIN_TABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={sheetOriginMode === t.id}
                        onClick={() => setSheetOriginMode(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-[var(--sps-muted)] shrink-0">Person</span>
                  <div className="flex items-center gap-1.5 overflow-x-auto flex-1">
                    {sheetPeople.length === 0 ? (
                      <span className="text-[11px] text-[var(--sps-muted)]">No profiles in this origin. Switch Origin or extract in Profiles.</span>
                    ) : null}
                    {sheetPeople.map((c) => {
                      const isSel = c.id === (selectedCharId || sheetPeople[0]?.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCharId(c.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono shrink-0 border ${
                            isSel
                              ? 'bg-[var(--sps-gold)] text-zinc-950 border-[var(--sps-gold)]'
                              : 'bg-[var(--sps-surface)] text-[var(--sps-text)] border-[var(--sps-border)]'
                          }`}
                        >
                          {c.name || c.tag}
                          <span className="ml-1 opacity-60">{SOURCE_SHORT[charSource(c)] || ''}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-[var(--sps-muted)] shrink-0">Reference</span>
                  <div className="sps-tabs" role="tablist" aria-label="Sheet type">
                    {SHEET_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={characterSheetMode === t.id}
                        onClick={() => setCharacterSheetMode(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!activeChar}
                    onClick={() => {
                      const txt = generateCharacterDesignSheetText(activeChar, characterSheetMode);
                      navigator.clipboard.writeText(txt);
                      setCopiedSheet(true);
                      setTimeout(() => setCopiedSheet(false), 2000);
                    }}
                    className="sps-btn sps-btn-primary text-[10px] ml-auto"
                  >
                    {copiedSheet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSheet ? 'Copied' : 'Copy prompt'}
                  </button>
                  <button
                    type="button"
                    className="sps-btn text-[10px]"
                    disabled={isExtractingSheets || !characters.length}
                    onClick={handleExtractReferenceSheets}
                    title="Write turnaround, face, wardrobe, mind, and body reference-sheet prompts from this story"
                  >
                    <RefreshCw className={`w-3 h-3 ${isExtractingSheets ? 'animate-spin' : ''}`} />
                    {isExtractingSheets ? 'Extracting sheets…' : 'Extract reference sheets'}
                  </button>
                </div>
                {activeChar?.referenceSheets?.[characterSheetMode] ? (
                  <p className="text-[10px] font-mono text-[var(--sps-gold)] m-0">Story-extracted character reference sheet (this tab).</p>
                ) : (
                  <p className="text-[10px] font-mono text-[var(--sps-muted)] m-0">Template until you extract reference sheets from the story.</p>
                )}
                <pre className="p-4 rounded-[10px] bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[11px] leading-relaxed whitespace-pre-wrap font-mono overflow-auto min-h-[12rem]">
                  {generateCharacterDesignSheetText(activeChar, characterSheetMode)}
                </pre>
              </>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Character List Selector Sidebar */}
          <div className="md:col-span-4 border-r border-[var(--sps-border)] p-3 bg-[var(--sps-bg)] overflow-y-auto flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--sps-border)]">
              <span className="text-xs font-semibold font-mono text-[var(--sps-muted)]">
                {SOURCE_SHORT[characterSourceMode]} ({visibleCharacters.length})
              </span>
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-0.5">
              {visibleCharacters.length === 0 ? (
                <div className="px-1 space-y-2">
                  <p className="text-[11px] text-[var(--sps-muted)] leading-relaxed">
                    {characterSourceMode === 'writer_written'
                      ? 'Empty. New to write one, or switch to Extract if the script already filled names.'
                      : characterSourceMode === 'ai_enhance'
                        ? 'Empty. Pick a person in Writer or Extract, then Enhance selected.'
                        : 'Empty. Extract from script to fill this list.'}
                  </p>
                  {characterSourceMode === 'writer_written' && characters.some((c) => charSource(c) === 'auto_extracted') ? (
                    <button
                      type="button"
                      className="sps-btn text-[10px]"
                      onClick={() => {
                        setCharacterSourceMode('auto_extracted');
                        localStorage.setItem('sps_selected_character_source', 'auto_extracted');
                      }}
                    >
                      Show extract
                    </button>
                  ) : null}
                </div>
              ) : null}
              {visibleCharacters.map((char) => {
                const isSelected = char.id === selectedCharId;
                return (
                  <div
                    key={char.id}
                    onClick={() => setSelectedCharId(char.id)}
                    className={`p-2.5 rounded-[10px] border cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--sps-row-active)] border-[var(--sps-gold)]'
                        : 'bg-[var(--sps-surface)] border-[var(--sps-border)] hover:border-[var(--sps-gold)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-[var(--sps-gold)] font-mono truncate">{char.tag}</span>
                      <div className="flex items-center shrink-0 gap-0.5">
                        <span className="text-[8px] font-mono uppercase text-[var(--sps-muted)]">
                          {String(char.lifecycleStatus || 'draft').slice(0, 4)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyCharacterProfile(char);
                          }}
                          className="p-1 rounded hover:bg-[var(--sps-gold)]/15 text-zinc-500 hover:text-[var(--sps-gold)] transition-colors"
                          title="Copy profile"
                        >
                          {copiedProfileId === char.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChar(char.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete Character"
                          disabled={isLifecycleLocked(char)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-[var(--sps-text)] font-sans mt-0.5 truncate">{char.name}</h4>
                    <p className="text-[10px] text-[var(--sps-muted)] font-mono truncate mt-0.5">{char.role}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Character Detail Form */}
          {editingChar ? (
            <div className="md:col-span-8 p-4 overflow-y-auto space-y-4 bg-[var(--sps-bg-elevated)]">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <LifecycleControls entity={editingChar} onChange={handleLifecycleChange} />
                {isLifecycleLocked(editingChar) ? (
                  <span className="text-[10px] text-[var(--sps-gold)] font-mono">Bible locked — unlock to revise</span>
                ) : null}
                <button
                  type="button"
                  className="sps-btn sps-btn-primary text-[10px]"
                  onClick={() => copyCharacterProfile(editingChar)}
                >
                  {copiedProfileId && copiedProfileId === editingChar.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedProfileId && copiedProfileId === editingChar.id ? 'Copied' : 'Copy profile'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--sps-surface)] p-3 rounded-[10px] border border-[var(--sps-border)]">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-300 font-mono block">Character Tag / Identifier (@Tag):</label>
                  <input
                    type="text"
                    value={editingChar.tag || ''}
                    onChange={(e) => updateField('tag', e.target.value)}
                    disabled={isLifecycleLocked(editingChar)}
                    placeholder="@CharacterTag"
                    className="w-full bg-zinc-900 text-purple-300 border border-purple-800 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-purple-400 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-200 font-mono block">Full Name:</label>
                  <input
                    type="text"
                    value={editingChar.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                    disabled={isLifecycleLocked(editingChar)}
                    placeholder="Full Character Name"
                    className="w-full bg-zinc-900 text-white border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-purple-400 disabled:opacity-50"
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
                      if (!assertCanMutateContent(editingChar).ok) {
                        setToastMsg('Locked — unlock to compose.');
                        setTimeout(() => setToastMsg(null), 2500);
                        return;
                      }
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
                        outfit: res.outfit || prev.outfit,
                        wardrobeElements: res.wardrobeElements || prev.wardrobeElements,
                        accessories: res.accessories || prev.accessories,
                        costumeDetails: res.costumeDetails || prev.costumeDetails,
                        colorPalette: res.colorPalette || prev.colorPalette
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

              <div className="space-y-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <label className="text-[11px] font-bold text-zinc-300 font-mono block">Locked look sheets (face + body)</label>
                <p className="text-[10px] text-zinc-500">These stills travel into every compile for this person. Generate once, lock, reuse.</p>
                <div className="flex gap-3">
                  {['face', 'body'].map((slot) => (
                    <label key={slot} className="flex-1 cursor-pointer">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-400">{slot}</span>
                      {editingChar.lockedRefs?.[slot] ? (
                        <img src={editingChar.lockedRefs[slot]} alt="" className="mt-1 w-full h-24 object-cover border border-zinc-700" />
                      ) : (
                        <span className="mt-1 flex h-24 items-center justify-center border border-dashed border-zinc-700 text-[10px] text-zinc-500">Add still</span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await readLockedImageFile(file);
                          updateField('lockedRefs', { ...(editingChar.lockedRefs || {}), [slot]: url, locked: true });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Signature Outfit & Visual Props */}
              <div className="space-y-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <label className="text-[11px] font-bold text-zinc-300 font-mono block">Wardrobe bible</label>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Primary outfit / silhouette</span>
                  <input
                    type="text"
                    value={editingChar.outfit || ''}
                    onChange={(e) => updateField('outfit', e.target.value)}
                    placeholder="Silhouette, era, main garments, fabrics, dyes..."
                    className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Elements (head-to-toe pieces)</span>
                  <textarea
                    rows={2}
                    value={editingChar.wardrobeElements || ''}
                    onChange={(e) => updateField('wardrobeElements', e.target.value)}
                    placeholder="Headwear, outer, inner, bottoms, footwear, belt, embroidery, insignia..."
                    className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-cyan-400 resize-y"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Accessories</span>
                  <textarea
                    rows={2}
                    value={editingChar.accessories || ''}
                    onChange={(e) => updateField('accessories', e.target.value)}
                    placeholder="Jewelry, weapons, malas, bags, ritual objects, body placement..."
                    className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-cyan-400 resize-y"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500">Color palette</span>
                    <input
                      type="text"
                      value={editingChar.colorPalette || ''}
                      onChange={(e) => updateField('colorPalette', e.target.value)}
                      placeholder="Saffron, gold zari, charcoal metal..."
                      className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500">Other details</span>
                    <input
                      type="text"
                      value={editingChar.costumeDetails || ''}
                      onChange={(e) => updateField('costumeDetails', e.target.value)}
                      placeholder="Weathering, makeup-as-costume, scene changes..."
                      className="w-full bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
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
        <div className="py-1.5 px-4 border-t border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between shrink-0 font-mono text-xs">
          <div className="text-[var(--sps-muted)]">
            {characters.length} {characters.length === 1 ? 'profile' : 'profiles'}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRequestClose}
              className="sps-btn text-[10px]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                handleSaveEditing();
                onClose();
              }}
              className="sps-btn sps-btn-primary text-[10px]"
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
