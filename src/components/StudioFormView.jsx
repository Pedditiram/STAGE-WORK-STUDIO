import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Film, Camera, User, Wand2, 
  Star,
  Volume2,
  VolumeX,
  Crosshair,
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { compileNarrativeProse } from '../utils/narrativeCompiler';
import { parseSceneAndShotID } from '../utils/sceneShotUtils';
import SlotEditor from './SlotEditor';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import { CRAFT_FOCUS_GROUPS, craftInFocusGroup, focusGroupIdForCraft } from '../constants/craftFocusGroups';
import IntensityScaleSelector from './IntensityScaleSelector';
import { enhanceCraftSlotWithLLM, notifyLlmFailure } from '../services/aiScriptParser';
import {
  assertCanMutateContent,
  isLifecycleLocked
} from '../utils/productionLifecycle';
import LifecycleControls from './LifecycleControls';
import { resolveShotSpine } from '../utils/productionSpine';
import { resolveContinuityForShot } from '../utils/continuityState';
import { CMD_TYPES, proposeAndValidate, approveLlmCommand, applyLlmCommand } from '../utils/llmCommandBus';
import {
  readActiveAssetRegistry,
  linkShotToAssetRegistry
} from '../utils/assetRegistry';
import {
  shotSpecSummary,
  toggleShotCharAssetId,
  toggleShotWorldAssetId
} from '../utils/shotSpec';
import { projectScopedStorageKey } from '../utils/projectWorkspace';

// Preset configurations for the 26 Crafts
const CRAFT_PRESETS = {
  shotComposition: ['Extreme Wide Shot (EWS)', 'Wide Shot (WS)', 'Medium Shot (MS)', 'Close-Up (CU)', 'Extreme Close-Up (ECU)', 'Over-the-Shoulder (OTS)', 'Low-Angle Hero Shot', 'High-Angle Bird View'],
  cameraMotionTag: ['Static Lock-off', 'Slow Push-in Dolly', 'Dynamic Tracking Orbit', 'Handheld Kinetic Stunt', 'Crane Up & Tilt Down', 'Whip Pan Transition', 'Zoom & Dolly Counter'],
  lensAndFocalLength: ['35mm Anamorphic Prime f/1.8', '50mm Cinema Prime f/1.4', '85mm Portrait Telephoto f/1.2', '16mm Ultra-Wide Cine', '70mm IMAX Format Prime'],
  timeAndLightingEnv: [
    '[Weather: Sunny Clear Sky] [Timing: Golden Hour Sunset] [Env: Outdoor Direct Sun]',
    '[Weather: Overcast Diffused Sky] [Timing: Afternoon Daylight] [Env: Outdoor Open Meadow]',
    '[Weather: Rainy Monsoon Downpour] [Timing: Dusk Twilight] [Env: Outdoor Wet Asphalt]',
    '[Weather: Dense Rolling Fog] [Timing: Early Morning Dawn] [Env: Pine Forest Solar Rays]',
    '[Weather: Stormy Thundercloud] [Timing: Deep Night] [Env: Coastal Cliff Lightning]',
    '[Weather: Snowy Frost Glisten] [Timing: High Noon Sun] [Env: Mountain White Bounce]',
    '[Weather: Sandstorm Dust Haze] [Timing: Midday Sun] [Env: Desert Heat Shimmer]',
    '[Weather: Clear Interior Night] [Timing: Midnight] [Env: Indoor Practical Tungsten Glow]'
  ],
  directionalLightingAndHighlight: [
    '[Angle: 45° Side Key Light] [Shadow: Under Tree Canopy Shade] [Highlight: Eye Catchlight & Subtle Bounce Fill]',
    '[Angle: 180° Direct Backlight] [Shadow: Silhouetted in Focal Beam] [Highlight: Razor Hair Rim Light]',
    '[Angle: 75° Overhead Downlight] [Shadow: Direct Scorching Sun] [Highlight: High-Contrast Kicker Light]',
    '[Angle: 90° Hard Profile Split Light] [Shadow: Threshold Half-Sun Half-Shadow] [Highlight: Invisible Negative Fill]',
    '[Angle: Low-Angle Footlight Up-Glow] [Shadow: Building Umbra] [Highlight: Eerie Pupil Catchlight]',
    '[Angle: Frontal Softbox Key Light] [Shadow: Controlled Studio Room Shadow] [Highlight: Glamour Soft Fill]'
  ],
  subjectLightingTag: [
    'Direct High-Noon Solar Sunbeam',
    'Dappled Tree Canopy Shade Light',
    'Golden Hour Sunset Backlight & Rim',
    'Morning Sunrise Soft Diffused Key Light',
    'Blue Hour Dusk Ambient Fill',
    'Midnight Silver Moonbeam Rim Highlight',
    'Indoor Sunlit Window Alcove Key Light',
    'Indoor Practical Warm Tungsten Lamp Glow',
    'Cyberpunk Neon Blue & Pink Dual Glow',
    'Venetian Blind Chiaroscuro Window Slats',
    'Fireplace Ember & Torchlight Flicker',
    'Rembrandt Chiaroscuro 3-Point Classic',
    'Volumetric Rim Light with Haze',
    'Soft Diffuse Key Light'
  ],
  subjectColorTag: ['Deep Crimson & Teal', 'Vibrant Warm Amber', 'Monochromatic Noir Gray', 'Emerald Green Glow', 'Saturated Muted Earth Tones'],
  backgroundLightingTag: [
    'Direct Solar Background Exposure & Hard Shadow',
    'Overcast Cloud-Diffused Shadowless Fill',
    'Sunlit Window Interior Light Bounce',
    'Moody Low-Key Shadow with Pin Spotlights',
    'High-Key Bright Outdoor Daylight',
    'Atmospheric Fog Volumetric Backlight',
    'Silhouetted Golden Sun Flare'
  ],
  backgroundColorTag: ['Midnight Obsidian Blue', 'Dusty Desert Ochre', 'Neon Violet Haze', 'Forest Pine Green'],
  colorPaletteSlot: ['Teal & Orange Blockbuster', 'Pastel Film Print', 'High-Contrast Vintage Film', 'Cyber Neon Synthwave'],
  characterExpression: ['Intense Focused Determination', 'Subtle Stoic Suspicion', 'Terrified Wide-Eyed Shock', 'Warm Joyful Smile', 'Melancholy Gaze'],
  characterPlacement: ['Centered Rule-of-Thirds', 'Left Frame Dominance', 'Right Edge Framing', 'Foreground Silhouette Anchor'],
  characterMovement: ['Fast Sprint Action', 'Slow Methodical Walk', 'Sudden Sharp Turn', 'Seated Stationary Stance', 'Evasive Tactical Roll'],
  characterEyeLooks: ['Direct Lens Eye-Contact', 'Off-Camera Left Gaze', 'Off-Camera Right Gaze', 'Looking Downward in Thought', 'Eyes Closed'],
  makeupAndHairStyle: ['Battle-Worn Dust & Sweat', 'Pristine Haute Couture Hair', 'Cybernetic Glow Implants', 'Wet Slick Rain Look'],
  stuntAndSafetyNotes: ['Wirework Flying Rig', 'Practical Pyrotechnic Explosion', 'Precision High-Speed Car Chase', 'Hand-to-Hand Martial Arts'],
  characterPsychologyState: [
    '[Mindstate: Paranoid Suspicion & Hyper-Vigilance]',
    '[Mindstate: Heroic Adrenaline Surge & Protective Oath]',
    '[Mindstate: Traumatized Disassociation & Melancholy]',
    '[Mindstate: Cold Strategic Calculation & Analytical Focus]',
    '[Mindstate: Vulnerable Emotional Breakdown & Heavy Guilt]',
    '[Mindstate: Unhinged Volatile Mania & Unpredictable Intensity]',
    '[Mindstate: Quiet Stoic Resignation & Devout Duty]'
  ],
  characterMannerismAndPosture: [
    '[Mannerism: Military Straight Spine & Hand on Hilt]',
    '[Mannerism: Nervous Fidgeting & Adjusting Collar]',
    '[Mannerism: Head Tilted 15° with Analytical Gaze]',
    '[Mannerism: Relaxed Slouch with Hands in Pockets]',
    '[Mannerism: Involuntary Jaw-Clench & Shoulder Tension]',
    '[Mannerism: Defensive Hunched Posture & Arms Folded]',
    '[Mannerism: Elegant Royal Poise & Graceful Hand Motion]'
  ],
  atmosphereVolumetricsTag: ['Thick Rolling Haze & God Rays', 'Rain-Slicked Asphalt Steam', 'Swirling Desert Dust Storm', 'Clean Crystal Clear Interior'],
  vfxCgiBreakdown: ['Photorealistic CGI Monster', 'Digital Green Screen Replacement', 'Particle Magic Energy Aura', 'Disintegration FX'],
  soundFxAndFoley: ['Heavy Bass Drop & Sub-Boom', 'Rain Patter & Thunder Clap', 'Metallic Sword Clash', 'Cinematic Whoosh Riser'],
  backgroundScoreMood: ['Tense Orchestral Strings', 'Pulsing Synthwave Bassline', 'Ethereal Ambient Choir', 'Triumphant Horn Fanfare'],
  editTransitionCut: ['Hard Match Cut', 'Smooth Dissolve Fade', 'Whip Pan Speed Cut', 'Invisible Match Action Cut']
};

const CRAFT_COLOR_MAP = [
  { key: 'sceneShotId', label: 'Shot ID', accent: '#1d4ed8', category: 'Stage 1: Identity' },
  { key: 'sceneSynopsis', label: 'Synopsis', accent: '#92400e', category: 'Stage 1: Identity' },
  { key: 'shotDurationAndImages', label: 'Duration & Assets', accent: '#1e40af', category: 'Stage 1: Identity' },
  { key: 'shotComposition', label: 'Framing', accent: '#9f1239', category: 'Stage 2: Camera' },
  { key: 'cameraMotionTag', label: 'Camera', accent: '#9a3412', category: 'Stage 2: Camera' },
  { key: 'lensAndFocalLength', label: 'Lens', accent: '#854d0e', category: 'Stage 2: Camera' },
  { key: 'timeAndLightingEnv', label: 'Weather & Time Rig', accent: '#b45309', category: 'Stage 2: Camera' },
  { key: 'directionalLightingAndHighlight', label: 'Light Angle & Highlight Rig', accent: '#a16207', category: 'Stage 2: Camera' },
  { key: 'subjectLightingTag', label: 'Subject Lighting', accent: '#047857', category: 'Stage 2: Camera' },
  { key: 'subjectColorTag', label: 'Subject Color', accent: '#0f766e', category: 'Stage 2: Camera' },
  { key: 'backgroundLightingTag', label: 'BG Lighting', accent: '#0e7490', category: 'Stage 2: Camera' },
  { key: 'backgroundColorTag', label: 'BG Color', accent: '#4338ca', category: 'Stage 2: Camera' },
  { key: 'colorPaletteSlot', label: 'Palette', accent: '#6d28d9', category: 'Stage 2: Camera' },
  { key: 'characterIdAssetRef', label: 'Character Ref', accent: '#be185d', category: 'Stage 3: Performance' },
  { key: 'coArtistInteraction', label: 'Co-Artist', accent: '#a21caf', category: 'Stage 3: Performance' },
  { key: 'actionEnvContext', label: 'Environment', accent: '#1d4ed8', category: 'Stage 3: Performance' },
  { key: 'characterExpression', label: 'Expression', accent: '#e11d48', category: 'Stage 3: Performance' },
  { key: 'characterPsychologyState', label: 'Psychology & Mindstate', accent: '#b45309', category: 'Stage 3: Performance' },
  { key: 'characterMannerismAndPosture', label: 'Mannerisms & Posture', accent: '#7e22ce', category: 'Stage 3: Performance' },
  { key: 'characterPlacement', label: 'Placement', accent: '#6d28d9', category: 'Stage 3: Performance' },
  { key: 'characterDialogue', label: 'Dialogue', accent: '#047857', category: 'Stage 3: Performance' },
  { key: 'characterMovement', label: 'Action Performance', accent: '#0369a1', category: 'Stage 3: Performance' },
  { key: 'characterEyeLooks', label: 'Eye Look', accent: '#7e22ce', category: 'Stage 3: Performance' },
  { key: 'makeupAndHairStyle', label: 'Makeup/Hair', accent: '#be185d', category: 'Stage 3: Performance' },
  { key: 'stuntAndSafetyNotes', label: 'Stunts', accent: '#b91c1c', category: 'Stage 3: Performance' },
  { key: 'atmosphereVolumetricsTag', label: 'Atmosphere', accent: '#0e7490', category: 'Stage 4: Audio & FX' },
  { key: 'vfxCgiBreakdown', label: 'VFX/CGI', accent: '#a21caf', category: 'Stage 4: Audio & FX' },
  { key: 'soundFxAndFoley', label: 'Audio/SFX', accent: '#15803d', category: 'Stage 4: Audio & FX' },
  { key: 'backgroundScoreMood', label: 'Score', accent: '#be123c', category: 'Stage 4: Audio & FX' },
  { key: 'editTransitionCut', label: 'Cut/Transition', accent: '#92400e', category: 'Stage 4: Audio & FX' }
];

/** Sign-in pattern section: one title, one short line, fields — no nested chrome cards. */
const FormSection = ({ title, subtitle, icon: Icon, children }) => (
  <section className="sps-form-section">
    <header className="sps-form-section-head">
      {Icon ? <Icon className="sps-form-section-icon" aria-hidden /> : null}
      <div>
        <h3 className="sps-form-section-title">{title}</h3>
        {subtitle ? <p className="sps-form-section-sub">{subtitle}</p> : null}
      </div>
    </header>
    <div className="sps-form-section-body">{children}</div>
  </section>
);

// Individual Craft Input Field Component (Theme-Adaptive High-Contrast + Permanent Highlight + Star Icon Favorites Filter)
const CraftField = ({
  fieldKey, label, placeholder, rows = 2,
  currentShot, highlightedFieldKey, activeModalSlotKey,
  favoriteCraftKeys, showFavoritesOnly, focusGroupId = 'all',
  isPaperTheme, colorTheme, shots, activeShotIndex,
  onSelectShot, setHighlightedFieldKey, setActiveModalSlotKey,
  toggleFavoriteCraft, handleFieldChange, handleEnhanceField,
  isEnhancingField, onCraftTap
}) => {
  const value = currentShot[fieldKey] || '';
  const presets = CRAFT_PRESETS[fieldKey] || [];
  const isHighlighted = highlightedFieldKey === fieldKey;
  const isExpandedInline = activeModalSlotKey === fieldKey;
  const isFavorite = favoriteCraftKeys.includes(fieldKey);

  const fieldSlotConfig = React.useMemo(() => {
    return SEEDANCE_SLOTS.find(s => s.key === fieldKey) || {
      key: fieldKey,
      label: label,
      presets: presets
    };
  }, [fieldKey, label, presets]);

  if (showFavoritesOnly && !isFavorite) {
    return null;
  }
  if (!craftInFocusGroup(fieldKey, focusGroupId)) {
    return null;
  }

  return (
    <div
      id={`craft_field_${fieldKey}`}
      onClick={() => onCraftTap && onCraftTap(fieldKey, false)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCraftTap && onCraftTap(fieldKey, true);
      }}
      className={`sps-form-field ${isHighlighted ? 'is-on' : ''}`}
    >
      <div className="sps-form-field-top">
        <label className="sps-form-field-label" htmlFor={`craft_input_${fieldKey}`}>
          {label}
        </label>
        <div className="sps-form-field-actions">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteCraft(fieldKey);
            }}
            className={`sps-quiet-link ${isFavorite ? 'is-current' : 'is-muted'}`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
          >
            <Star className={`w-3.5 h-3.5 inline ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHighlightedFieldKey(fieldKey);
              setActiveModalSlotKey(fieldKey);
            }}
            className="sps-quiet-link is-muted"
            title="Expand editor (⌘Space)"
          >
            Expand
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEnhanceField(fieldKey, label); }}
            disabled={isEnhancingField === fieldKey}
            className="sps-quiet-link is-muted disabled:opacity-40"
            title="AI enhance this craft"
          >
            {isEnhancingField === fieldKey ? '…' : 'Enhance'}
          </button>
        </div>
      </div>

      <IntensityScaleSelector
        value={value}
        onChange={(newVal) => handleFieldChange(fieldKey, newVal)}
        craftKey={fieldKey}
        isPaperTheme={isPaperTheme}
      />

      <textarea
        id={`craft_input_${fieldKey}`}
        rows={rows}
        value={value}
        onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}…`}
        className="sps-form-field-input"
      />

      {presets.length > 0 ? (
        <div className="sps-form-presets">
          {presets.slice(0, 6).map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleFieldChange(fieldKey, preset); }}
              className={`sps-form-preset ${value === preset ? 'is-on' : ''}`}
              title={preset}
            >
              {preset.length > 42 ? `${preset.slice(0, 40)}…` : preset}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default function StudioFormView({
  shots = [],
  activeShotIndex = 0,
  onSelectShot,
  onUpdateShot,
  onAddShot,
  colorTheme = 'paper',
  onFullEditorOpenChange,
  genreKey = 'mythological',
  projectTitle = '',
  onOpenLlmCommands
}) {
  const currentShot = shots[activeShotIndex] || shots[0] || {};
  const [promptFormat, setPromptFormat] = useState(() => {
    const saved = localStorage.getItem('sps_prompt_format');
    return (saved === 'crafts' || saved === 'prose') ? saved : 'crafts';
  });
  const [copyToast, setCopyToast] = useState(false);
  const [isEnhancingField, setIsEnhancingField] = useState(null);
  const [highlightedFieldKey, setHighlightedFieldKey] = useState('sceneShotId');
  const [activeModalSlotKey, setActiveModalSlotKey] = useState(null);
  const [shotNumberInput, setShotNumberInput] = useState(String(activeShotIndex + 1));
  const [chromeOpen, setChromeOpen] = useState(() => {
    try {
      return localStorage.getItem('sps_form_chrome_open') !== 'false';
    } catch {
      return true;
    }
  });
  const [livePromptOpen, setLivePromptOpen] = useState(() => {
    try {
      return localStorage.getItem('sps_form_live_prompt') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sps_form_chrome_open', chromeOpen ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [chromeOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('sps_form_live_prompt', livePromptOpen ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [livePromptOpen]);

  // Notify parent App when full editor view is open so top header strip can be hidden
  useEffect(() => {
    if (onFullEditorOpenChange) {
      onFullEditorOpenChange(!!activeModalSlotKey);
    }
    return () => {
      if (onFullEditorOpenChange) onFullEditorOpenChange(false);
    };
  }, [activeModalSlotKey, onFullEditorOpenChange]);

  // Keyboard Shortcut: Shift + Cmd + Enter (or Shift + Ctrl + Enter / Cmd + Space) toggles left-side expanded view of text & presets
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      if ((isCmdOrCtrl && isShift && e.key === 'Enter') || (isCmdOrCtrl && (e.code === 'Space' || e.key === ' '))) {
        e.preventDefault();
        e.stopPropagation();
        const targetKey = highlightedFieldKey || 'sceneShotId';
        setActiveModalSlotKey(prev => prev === targetKey ? null : targetKey);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [highlightedFieldKey]);

  const favoriteCraftStoreKey = projectScopedStorageKey('sps_favorite_craft_keys', projectTitle);
  const [favoriteCraftKeys, setFavoriteCraftKeys] = useState(() => {
    try {
      const saved = localStorage.getItem(projectScopedStorageKey('sps_favorite_craft_keys', projectTitle));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['sceneShotId', 'sceneSynopsis', 'shotComposition', 'cameraMotionTag', 'subjectLightingTag'];
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(favoriteCraftStoreKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setFavoriteCraftKeys(Array.isArray(parsed) && parsed.length
        ? parsed
        : ['sceneShotId', 'sceneSynopsis', 'shotComposition', 'cameraMotionTag', 'subjectLightingTag']);
    } catch {
      setFavoriteCraftKeys(['sceneShotId', 'sceneSynopsis', 'shotComposition', 'cameraMotionTag', 'subjectLightingTag']);
    }
    setShowFavoritesOnly(false);
  }, [favoriteCraftStoreKey]);

  const toggleFavoriteCraft = (fieldKey) => {
    setFavoriteCraftKeys(prev => {
      const next = prev.includes(fieldKey)
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey];
      localStorage.setItem(favoriteCraftStoreKey, JSON.stringify(next));
      return next;
    });
  };

  const handleToggleFavoritesOnly = (val) => {
    const next = typeof val === 'boolean' ? val : !showFavoritesOnly;
    setShowFavoritesOnly(next);
    localStorage.setItem('sps_show_favorites_only', String(next));
  };

  const [focusGroupId, setFocusGroupId] = useState('all');
  const mutedSlots = currentShot?.mutedSlots && typeof currentShot.mutedSlots === 'object'
    ? currentShot.mutedSlots
    : {};

  const toggleMutedCraft = (fieldKey) => {
    if (!fieldKey || !onUpdateShot) return;
    if (!assertCanMutateContent(currentShot).ok) return;
    const prev = currentShot.mutedSlots && typeof currentShot.mutedSlots === 'object'
      ? currentShot.mutedSlots
      : {};
    onUpdateShot(activeShotIndex, {
      ...currentShot,
      mutedSlots: { ...prev, [fieldKey]: !prev[fieldKey] }
    });
  };

  const handleFocusCraft = (fieldKey) => {
    if (!fieldKey) return;
    setHighlightedFieldKey(fieldKey);
    setFocusGroupId(focusGroupIdForCraft(fieldKey));
    requestAnimationFrame(() => {
      const element = document.getElementById(`craft_field_${fieldKey}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const isPaperTheme = colorTheme === 'paper' || colorTheme === 'light' || !colorTheme;

  // Sync shot number input when activeShotIndex changes
  useEffect(() => {
    setShotNumberInput(String(activeShotIndex + 1));
  }, [activeShotIndex]);

  // Lock outer scroll & auto-scroll into view when a craft card is expanded in-place!
  useEffect(() => {
    if (activeModalSlotKey) {
      document.body.style.overflow = 'hidden';
      const el = document.getElementById(`craft_field_${activeModalSlotKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeModalSlotKey]);

  const parsedSceneShot = useMemo(() => {
    return parseSceneAndShotID(currentShot.sceneShotId || `SC01_SH${String(activeShotIndex + 1).padStart(2, '0')}`);
  }, [currentShot.sceneShotId, activeShotIndex]);

  // Direct Shot Number Shift
  const handleShotNumberChange = (val) => {
    setShotNumberInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= shots.length) {
      onSelectShot(num - 1);
    }
  };

  // Global Keyboard Shortcuts:
  // - Cmd/Ctrl + Space: Toggle In-Place Craft Editor Window for highlighted craft
  // - Cmd/Ctrl + Left / Right Arrow: Navigate Shots (Shot 1..N)
  // - Cmd/Ctrl + Up / Down Arrow: Navigate Crafts (Craft 1..24)
  useEffect(() => {
    const handleFormKeyDown = (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey || e.altKey;
      const key = e.key;
      const isSpace = e.code === 'Space' || key === ' ' || key === 'Spacebar';

      // Cmd + Space / Ctrl + Space -> Toggle In-Place Craft Editor Window
      if (isCmdOrCtrl && isSpace) {
        e.preventDefault();
        e.stopPropagation();
        if (activeModalSlotKey) {
          setActiveModalSlotKey(null);
        } else {
          setActiveModalSlotKey(highlightedFieldKey || 'sceneShotId');
        }
        return;
      }

      if (!isCmdOrCtrl) return;

      const isRight = key === 'ArrowRight' || key === 'Right';
      const isLeft = key === 'ArrowLeft' || key === 'Left';
      const isDown = key === 'ArrowDown' || key === 'Down';
      const isUp = key === 'ArrowUp' || key === 'Up';

      // SHOT NAVIGATION (Cmd + Left / Right)
      if (isRight) {
        e.preventDefault();
        const total = (shots || []).length;
        if (total > 0 && onSelectShot) {
          onSelectShot(activeShotIndex < total - 1 ? activeShotIndex + 1 : 0);
        }
      } else if (isLeft) {
        e.preventDefault();
        const total = (shots || []).length;
        if (total > 0 && onSelectShot) {
          onSelectShot(activeShotIndex > 0 ? activeShotIndex - 1 : total - 1);
        }
      } 
      // CRAFT NAVIGATION (Cmd + Up / Down)
      else if (isDown || isUp) {
        e.preventDefault();
        const allKeys = CRAFT_COLOR_MAP.map(c => c.key);
        const currentIndex = allKeys.indexOf(highlightedFieldKey);
        
        let nextIndex = 0;
        if (currentIndex === -1) {
          nextIndex = isDown ? 0 : allKeys.length - 1;
        } else {
          if (isDown) {
            nextIndex = currentIndex < allKeys.length - 1 ? currentIndex + 1 : 0;
          } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : allKeys.length - 1;
          }
        }

        const nextCraftKey = allKeys[nextIndex];
        setHighlightedFieldKey(nextCraftKey);
        if (activeModalSlotKey) {
          setActiveModalSlotKey(nextCraftKey);
        }

        const element = document.getElementById(`craft_field_${nextCraftKey}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    window.addEventListener('keydown', handleFormKeyDown, true);
    return () => window.removeEventListener('keydown', handleFormKeyDown, true);
  }, [activeShotIndex, shots, onSelectShot, highlightedFieldKey, activeModalSlotKey]);

  // Handle updates to a specific field
  const handleFieldChange = (key, val) => {
    if (!onUpdateShot) return;
    if (!assertCanMutateContent(currentShot).ok) return;
    onUpdateShot(activeShotIndex, { ...currentShot, [key]: val });
  };

  const handleLifecycleChange = (nextEntity) => {
    if (!onUpdateShot || !nextEntity) return;
    onUpdateShot(activeShotIndex, nextEntity);
  };

  const clickTimerRef = useRef(null);

  // Single Tap (Click): Highlights field & scrolls into focus. Double Tap (Double Click): Opens full editor window!
  const handleCraftTap = (fieldKey, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      setHighlightedFieldKey(fieldKey);
      setActiveModalSlotKey(fieldKey);
      return;
    }

    setHighlightedFieldKey(fieldKey);
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    clickTimerRef.current = setTimeout(() => {
      const element = document.getElementById(`craft_field_${fieldKey}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
      clickTimerRef.current = null;
    }, 220);
  };

  // Stage Work Studio AI Field Enhancer — proposes via command bus (no silent SoT write)
  const handleEnhanceField = async (key, label) => {
    if (!assertCanMutateContent(currentShot).ok) return;
    setIsEnhancingField(key);
    try {
      const currentVal = currentShot[key] || '';
      const enhancedVal = await enhanceCraftSlotWithLLM(key || label, currentVal, {
        ...(currentShot || {}),
        genreKey,
        projectTitle,
        presetProfile: genreKey
      });
      if (!enhancedVal) return;
      const proposed = proposeAndValidate(
        {
          type: CMD_TYPES.PATCH_SHOT_CRAFT,
          projectTitle,
          payload: { shotIndex: activeShotIndex, craftKey: key, value: enhancedVal },
          source: 'llm_enhance_craft',
          reason: `Form enhance ${key}`,
          preview: String(enhancedVal).slice(0, 120)
        },
        { shots, projectTitle }
      );
      if (!proposed.ok) {
        window.alert(proposed.error || proposed.errors?.join('; ') || 'Proposal failed');
        return;
      }
      if (onOpenLlmCommands) {
        onOpenLlmCommands();
        return;
      }
      if (window.confirm(`Apply LLM craft patch for ${key}?`)) {
        approveLlmCommand(proposed.command.id, projectTitle);
        applyLlmCommand(proposed.command.id, projectTitle, { shots, projectTitle }, {
          updateShot: (i, s) => onUpdateShot?.(i, s)
        });
      }
    } catch (err) {
      notifyLlmFailure(err, 'Form enhance');
    } finally {
      setTimeout(() => setIsEnhancingField(null), 400);
    }
  };

  const scenesList = useMemo(() => {
    return (shots || []).reduce((acc, s, idx) => {
      const parsed = parseSceneAndShotID(s, idx);
      const sceneId = parsed.sceneStr || `SC${String(Math.floor(idx / 3) + 1).padStart(2, '0')}`;
      const sceneLabel = parsed.sceneTag || `SCENE ${String(Math.floor(idx / 3) + 1).padStart(2, '0')}`;
      if (!acc.some(sc => sc.sceneId === sceneId)) {
        acc.push({ sceneId, label: sceneLabel, firstShotIndex: idx });
      }
      return acc;
    }, []);
  }, [shots]);

  const currentSceneId = useMemo(() => {
    const parsed = parseSceneAndShotID(currentShot, activeShotIndex);
    return parsed.sceneStr || scenesList[0]?.sceneId || 'SC01';
  }, [currentShot, activeShotIndex, scenesList]);

  const currSceneIdx = scenesList.findIndex(sc => sc.sceneId === currentSceneId);

  const spineNode = useMemo(
    () => resolveShotSpine(currentShot, activeShotIndex, shots),
    [currentShot, activeShotIndex, shots]
  );

  const continuityBundle = useMemo(
    () =>
      resolveContinuityForShot({
        shot: currentShot,
        shots,
        shotIndex: activeShotIndex,
        projectTitle
      }),
    [currentShot, shots, activeShotIndex, projectTitle]
  );

  const patchContinuityField = (charKey, field, value) => {
    if (!assertCanMutateContent(currentShot).ok) return;
    const prev = currentShot.continuityPatch && typeof currentShot.continuityPatch === 'object'
      ? currentShot.continuityPatch
      : {};
    const charPatch = { ...(prev[charKey] || {}), [field]: value };
    handleFieldChange('continuityPatch', { ...prev, [charKey]: charPatch });
  };

  // Compile full 24-craft master prompt plain string for copying
  const compiledMasterPrompt = useMemo(() => {
    if (promptFormat === 'prose') {
      return compileNarrativeProse(currentShot);
    }

    return CRAFT_COLOR_MAP
      .map(c => {
        if (showFavoritesOnly && !favoriteCraftKeys.includes(c.key)) return null;
        if (currentShot?.mutedSlots?.[c.key]) return null;
        if (!craftInFocusGroup(c.key, focusGroupId)) return null;
        return currentShot[c.key] ? `${c.label}: ${currentShot[c.key]}` : null;
      })
      .filter(Boolean)
      .join('. ');
  }, [currentShot, promptFormat, showFavoritesOnly, favoriteCraftKeys, focusGroupId]);

  const handleCopyPrompt = () => {
    if (compiledMasterPrompt && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(compiledMasterPrompt);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
  };

  const craftProps = {
    currentShot, highlightedFieldKey, activeModalSlotKey,
    favoriteCraftKeys, showFavoritesOnly, focusGroupId,
    isPaperTheme, colorTheme, shots, activeShotIndex,
    onSelectShot, setHighlightedFieldKey, setActiveModalSlotKey,
    toggleFavoriteCraft, handleFieldChange, handleEnhanceField,
    isEnhancingField, onCraftTap: handleCraftTap
  };



  return (
    <div className="sps-form-desk">
      <div className={`sps-form-desk-chrome ${chromeOpen ? '' : 'is-min'}`}>
        <div className="sps-form-desk-chrome-row">
          <span className="sps-form-desk-kicker">Shot lifecycle</span>
          <LifecycleControls entity={currentShot} onChange={handleLifecycleChange} />
          {isLifecycleLocked(currentShot) ? (
            <span className="sps-form-desk-note">Craft frozen — unlock to revise</span>
          ) : null}
          {spineNode ? (
            <span className="sps-form-desk-meta">
              Act {spineNode.act} · Seq {spineNode.sequenceSeq} · {spineNode.sceneTag}
            </span>
          ) : null}
          <div className="sps-quiet-links sps-form-chrome-toggles">
            <button
              type="button"
              className={`sps-quiet-link ${chromeOpen ? 'is-current' : 'is-muted'}`}
              title={chromeOpen ? 'Minimize spec & continuity' : 'Show spec & continuity'}
              onClick={() => setChromeOpen((on) => !on)}
            >
              {chromeOpen ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
              {chromeOpen ? 'Minimize' : 'Details'}
            </button>
            <button
              type="button"
              className={`sps-quiet-link ${livePromptOpen ? 'is-current' : 'is-muted'}`}
              title={livePromptOpen ? 'Hide live prompt' : 'Show live prompt'}
              onClick={() => setLivePromptOpen((on) => !on)}
            >
              {livePromptOpen ? <PanelRightClose className="w-3 h-3 inline" /> : <PanelRightOpen className="w-3 h-3 inline" />}
              Prompt
            </button>
          </div>
        </div>
        {chromeOpen ? (
          <>
        {(() => {
          const registry = readActiveAssetRegistry();
          const chars = registry?.characters || [];
          const worlds = registry?.world || [];
          const locked = isLifecycleLocked(currentShot);
          const spec = shotSpecSummary(currentShot);
          const boundChars = new Set(spec.charAssetIds || []);
          const boundWorld = new Set(spec.worldAssetIds || []);
          if (!chars.length && !worlds.length && !boundChars.size && !boundWorld.size) {
            return (
              <p className="sps-form-desk-hint">
                Asset IDs — open Cast/World, then Relink from Production to mint CHAR_/WORLD_ refs.
              </p>
            );
          }
          return (
            <div className="sps-form-desk-assets">
              <div className="sps-form-desk-chrome-row">
                <span className="sps-form-desk-kicker">
                  Shot Spec · crafts {spec.craftPct}%
                </span>
                <button
                  type="button"
                  className="sps-quiet-link is-muted disabled:opacity-40"
                  disabled={locked || !onUpdateShot}
                  title="Infer CHAR_/WORLD_ from @tags on this shot"
                  onClick={() => {
                    const reg = readActiveAssetRegistry();
                    if (!reg) return;
                    onUpdateShot(activeShotIndex, linkShotToAssetRegistry(currentShot, reg));
                  }}
                >
                  Relink tags
                </button>
              </div>
              <div className="sps-form-chip-row">
                {chars.map((c) => {
                  const on = boundChars.has(c.assetId);
                  return (
                    <button
                      key={c.assetId}
                      type="button"
                      disabled={locked || !onUpdateShot}
                      title={c.name || c.tag || c.assetId}
                      className={`sps-form-chip ${on ? 'is-on' : ''}`}
                      onClick={() =>
                        onUpdateShot(activeShotIndex, toggleShotCharAssetId(currentShot, c.assetId))
                      }
                    >
                      {c.assetId}
                    </button>
                  );
                })}
                {worlds.map((w) => {
                  const on = boundWorld.has(w.assetId);
                  return (
                    <button
                      key={w.assetId}
                      type="button"
                      disabled={locked || !onUpdateShot}
                      title={w.name || w.tag || w.assetId}
                      className={`sps-form-chip is-world ${on ? 'is-on' : ''}`}
                      onClick={() =>
                        onUpdateShot(activeShotIndex, toggleShotWorldAssetId(currentShot, w.assetId))
                      }
                    >
                      {w.assetId}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {continuityBundle.entries.length > 0 ? (
          <div className="sps-form-continuity">
            <span className="sps-form-desk-kicker">Continuity</span>
            {continuityBundle.entries.map((entry) => (
              <div key={entry.key} className="sps-form-continuity-row">
                <span className="sps-form-continuity-tag">{entry.tag || entry.name}</span>
                {['costume', 'injury', 'prop'].map((field) => (
                  <label key={field} className="sps-form-continuity-field">
                    <span>{field}</span>
                    <input
                      type="text"
                      value={entry.patch?.[field] ?? entry.state[field] ?? ''}
                      disabled={isLifecycleLocked(currentShot)}
                      onChange={(e) => patchContinuityField(entry.key, field, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        ) : null}
          </>
        ) : null}
      </div>

      <div className={`sps-form-desk-body ${livePromptOpen ? '' : 'is-prompt-off'}`}>
        <div className="sps-form-pane sps-form-pane-work" data-form-pane="work">
          <div className="sps-form-pane-inner">
            {activeModalSlotKey ? (
              <div className="sps-form-expand-shell">
                <SlotEditor
                  slotConfig={SEEDANCE_SLOTS.find(s => s.key === activeModalSlotKey) || {
                    key: activeModalSlotKey,
                    label: activeModalSlotKey,
                    presets: CRAFT_PRESETS[activeModalSlotKey] || []
                  }}
                  value={currentShot[activeModalSlotKey] || ''}
                  onChange={(val) => handleFieldChange(activeModalSlotKey, val)}
                  shot={currentShot}
                  readOnly={isLifecycleLocked(currentShot)}
                  embedded={true}
                  compact={false}
                  allSlots={SEEDANCE_SLOTS}
                  genreKey={genreKey}
                  projectTitle={projectTitle}
                  shots={shots}
                  onOpenLlmCommands={onOpenLlmCommands}
                  onUpdateShot={onUpdateShot}
                  totalShotsCount={shots.length}
                  currentShotIndex={activeShotIndex}
                  onNavigateNextShot={() => onSelectShot && onSelectShot(activeShotIndex < shots.length - 1 ? activeShotIndex + 1 : 0)}
                  onNavigatePrevShot={() => onSelectShot && onSelectShot(activeShotIndex > 0 ? activeShotIndex - 1 : shots.length - 1)}
                  onJumpToSlot={(key) => {
                    setHighlightedFieldKey(key);
                    setActiveModalSlotKey(key);
                  }}
                  scenesList={scenesList}
                  currentSceneId={currentSceneId}
                  onNavigateNextScene={() => {
                    if (!onSelectShot || scenesList.length === 0) return;
                    const targetIdx = (currSceneIdx !== -1 && currSceneIdx < scenesList.length - 1)
                      ? scenesList[currSceneIdx + 1].firstShotIndex
                      : (scenesList[0]?.firstShotIndex || 0);
                    onSelectShot(targetIdx);
                  }}
                  onNavigatePrevScene={() => {
                    if (!onSelectShot || scenesList.length === 0) return;
                    const targetIdx = currSceneIdx > 0
                      ? scenesList[currSceneIdx - 1].firstShotIndex
                      : (scenesList[scenesList.length - 1]?.firstShotIndex || 0);
                    onSelectShot(targetIdx);
                  }}
                  onJumpToScene={(targetScId) => {
                    const sc = scenesList.find(s => s.sceneId === targetScId);
                    if (sc && onSelectShot) onSelectShot(sc.firstShotIndex);
                  }}
                  onCloseForcePopup={() => setActiveModalSlotKey(null)}
                  colorTheme={colorTheme}
                />
              </div>
            ) : (
              <>
                {craftInFocusGroup('sceneSynopsis', focusGroupId) ? (
                <FormSection title="Identity" subtitle="Shot ID context and scene beat" icon={Film}>
                  <CraftField fieldKey="sceneSynopsis" label="Scene Synopsis" placeholder="Location, atmosphere, narrative goal…" rows={3} {...craftProps} />
                </FormSection>
                ) : null}

                {['shotComposition', 'cameraMotionTag', 'lensAndFocalLength', 'timeAndLightingEnv', 'directionalLightingAndHighlight', 'subjectLightingTag', 'subjectColorTag', 'backgroundLightingTag', 'backgroundColorTag', 'colorPaletteSlot'].some((k) => craftInFocusGroup(k, focusGroupId)) ? (
                <FormSection title="Camera" subtitle="Framing, lens, light, and palette" icon={Camera}>
                  <CraftField fieldKey="shotComposition" label="Shot Composition & Framing" {...craftProps} />
                  <CraftField fieldKey="cameraMotionTag" label="Camera Motion & Rig" {...craftProps} />
                  <CraftField fieldKey="lensAndFocalLength" label="Lens & Focal Length" {...craftProps} />
                  <CraftField fieldKey="timeAndLightingEnv" label="Weather & Time Rig" {...craftProps} />
                  <CraftField fieldKey="directionalLightingAndHighlight" label="Light Direction & Highlight" {...craftProps} />
                  <CraftField fieldKey="subjectLightingTag" label="Subject Lighting" {...craftProps} />
                  <CraftField fieldKey="subjectColorTag" label="Subject Color" {...craftProps} />
                  <CraftField fieldKey="backgroundLightingTag" label="Background Lighting" {...craftProps} />
                  <CraftField fieldKey="backgroundColorTag" label="Background Color" {...craftProps} />
                  <CraftField fieldKey="colorPaletteSlot" label="Color Palette & Grade" {...craftProps} />
                </FormSection>
                ) : null}

                {['characterIdAssetRef', 'coArtistInteraction', 'actionEnvContext', 'characterExpression', 'characterPsychologyState', 'characterMannerismAndPosture', 'characterPlacement', 'characterDialogue', 'characterMovement', 'characterEyeLooks', 'makeupAndHairStyle', 'stuntAndSafetyNotes'].some((k) => craftInFocusGroup(k, focusGroupId)) ? (
                <FormSection title="Performance" subtitle="Cast, expression, dialogue, and action" icon={User}>
                  <CraftField fieldKey="characterIdAssetRef" label="Character Asset Reference" {...craftProps} />
                  <CraftField fieldKey="coArtistInteraction" label="Co-Artist Interaction" {...craftProps} />
                  <CraftField fieldKey="actionEnvContext" label="Environment Context" {...craftProps} />
                  <CraftField fieldKey="characterExpression" label="Expression & Emotion" {...craftProps} />
                  <CraftField fieldKey="characterPsychologyState" label="Psychology & Mindstate" {...craftProps} />
                  <CraftField fieldKey="characterMannerismAndPosture" label="Mannerisms & Posture" {...craftProps} />
                  <CraftField fieldKey="characterPlacement" label="Spatial Placement" {...craftProps} />
                  <CraftField fieldKey="characterDialogue" label="Character Dialogue" {...craftProps} />
                  <CraftField fieldKey="characterMovement" label="Action Performance" {...craftProps} />
                  <CraftField fieldKey="characterEyeLooks" label="Eye Look & Directing" {...craftProps} />
                  <CraftField fieldKey="makeupAndHairStyle" label="Makeup & Hair" {...craftProps} />
                  <CraftField fieldKey="stuntAndSafetyNotes" label="Stunts & Safety" {...craftProps} />
                </FormSection>
                ) : null}

                {['atmosphereVolumetricsTag', 'vfxCgiBreakdown', 'soundFxAndFoley', 'backgroundScoreMood', 'editTransitionCut'].some((k) => craftInFocusGroup(k, focusGroupId)) ? (
                <FormSection title="Post & Sound" subtitle="Atmosphere, VFX, audio, and cut" icon={Wand2}>
                  <CraftField fieldKey="atmosphereVolumetricsTag" label="Atmosphere & Volumetrics" {...craftProps} />
                  <CraftField fieldKey="vfxCgiBreakdown" label="VFX & CGI" {...craftProps} />
                  <CraftField fieldKey="soundFxAndFoley" label="Sound FX & Foley" {...craftProps} />
                  <CraftField fieldKey="backgroundScoreMood" label="Background Score Mood" {...craftProps} />
                  <CraftField fieldKey="editTransitionCut" label="Edit Cut & Transition" {...craftProps} />
                </FormSection>
                ) : null}
              </>
            )}
          </div>
        </div>

        {livePromptOpen ? (
        <aside className="sps-form-pane sps-form-pane-side" data-form-pane="side">
          <div className="sps-form-pane-inner sps-form-side-card">
            <div className="sps-form-side-head">
              <div className="sps-form-side-title">
                <Sparkles className="w-3.5 h-3.5" aria-hidden />
                Live prompt
              </div>
              <div className="sps-quiet-links">
                <button
                  type="button"
                  onClick={() => handleToggleFavoritesOnly()}
                  className={`sps-quiet-link ${showFavoritesOnly ? 'is-current' : 'is-muted'}`}
                  title={showFavoritesOnly ? `Show all ${SEEDANCE_SLOTS.length} crafts` : 'Show favorite crafts only'}
                >
                  <Star className={`w-3 h-3 inline ${showFavoritesOnly ? 'fill-current' : ''}`} />
                  {showFavoritesOnly ? 'All' : 'Favorites'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleMutedCraft(highlightedFieldKey)}
                  className={`sps-quiet-link ${mutedSlots[highlightedFieldKey] ? 'is-current' : 'is-muted'}`}
                  title={mutedSlots[highlightedFieldKey] ? 'Unmute focused craft in compile' : 'Mute focused craft in compile'}
                >
                  {mutedSlots[highlightedFieldKey] ? <VolumeX className="w-3 h-3 inline" /> : <Volume2 className="w-3 h-3 inline" />}
                  {mutedSlots[highlightedFieldKey] ? 'Unmute' : 'Mute'}
                </button>
                <button
                  type="button"
                  onClick={() => setLivePromptOpen(false)}
                  className="sps-quiet-link is-muted"
                  title="Hide live prompt"
                >
                  <PanelRightClose className="w-3 h-3 inline" />
                  Hide
                </button>
              </div>
            </div>

            <div className="sps-form-focus-bar" role="tablist" aria-label="Focus craft group">
              <span className="sps-form-desk-kicker">Focus</span>
              {CRAFT_FOCUS_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={focusGroupId === group.id}
                  onClick={() => setFocusGroupId(group.id)}
                  className={`sps-quiet-link ${focusGroupId === group.id ? 'is-current' : 'is-muted'}`}
                  title={
                    group.id === 'all'
                      ? 'Show every craft'
                      : `Focus ${group.label} crafts`
                  }
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div className="sps-form-side-tools">
              <div className="sps-form-seg">
                <button
                  type="button"
                  onClick={() => { setPromptFormat('crafts'); localStorage.setItem('sps_prompt_format', 'crafts'); }}
                  className={promptFormat === 'crafts' ? 'is-on' : ''}
                >
                  Craft
                </button>
                <button
                  type="button"
                  onClick={() => { setPromptFormat('prose'); localStorage.setItem('sps_prompt_format', 'prose'); }}
                  className={promptFormat === 'prose' ? 'is-on' : ''}
                >
                  Prose
                </button>
              </div>
              <label className="sps-form-shot-jump">
                Shot
                <input
                  type="number"
                  min="1"
                  max={shots.length}
                  value={shotNumberInput}
                  onChange={(e) => handleShotNumberChange(e.target.value)}
                />
                <span>/{shots.length}</span>
              </label>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="sps-btn sps-btn-primary sps-btn-compact"
                title={copyToast ? 'Copied' : 'Copy prompt'}
              >
                {copyToast ? 'Copied' : 'Copy'}
              </button>
              {onAddShot ? (
                <button type="button" onClick={onAddShot} className="sps-quiet-link is-muted" title="Add shot">
                  Add shot
                </button>
              ) : null}
            </div>

            <div className="sps-form-side-preview">
              {promptFormat === 'crafts' ? (
                <div className="sps-live-matrix-list">
                  {CRAFT_COLOR_MAP.map(({ key, label, accent }) => {
                    const val = currentShot[key];
                    const isMutedCraft = Boolean(mutedSlots[key]);
                    const isFavorite = favoriteCraftKeys.includes(key);
                    if (!craftInFocusGroup(key, focusGroupId)) return null;
                    if (!val) return null;
                    if (showFavoritesOnly && !isFavorite) return null;
                    const isSelectedBadge = highlightedFieldKey === key;
                    return (
                      <div
                        key={key}
                        className={`sps-live-matrix-row ${isSelectedBadge ? 'is-on' : ''} ${isMutedCraft ? 'is-muted-craft' : ''}`}
                        style={{ '--row-accent': accent }}
                      >
                        <button
                          type="button"
                          onClick={() => handleCraftTap(key, false)}
                          onDoubleClick={() => handleCraftTap(key, true)}
                          className="sps-live-matrix-main"
                          title={`Click to focus ${label}. Double-click to expand.`}
                        >
                          <span className="sps-live-matrix-k">{label}</span>
                          <span className="sps-live-matrix-v">{val || '—'}</span>
                        </button>
                        <div className="sps-live-matrix-ops">
                          <button
                            type="button"
                            onClick={() => toggleFavoriteCraft(key)}
                            className={`sps-live-op ${isFavorite ? 'is-on' : ''}`}
                            title={isFavorite ? `Remove ${label} from favorites` : `Favorite ${label}`}
                            aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
                          >
                            <Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleMutedCraft(key)}
                            className={`sps-live-op ${isMutedCraft ? 'is-on' : ''}`}
                            title={isMutedCraft ? `Unmute ${label}` : `Mute ${label} from compile`}
                            aria-label={isMutedCraft ? 'Unmute' : 'Mute'}
                          >
                            {isMutedCraft ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFocusCraft(key)}
                            className={`sps-live-op ${focusGroupId !== 'all' && focusGroupIdForCraft(key) === focusGroupId && isSelectedBadge ? 'is-on' : ''}`}
                            title={`Focus ${focusGroupIdForCraft(key) === 'all' ? label : CRAFT_FOCUS_GROUPS.find((g) => g.id === focusGroupIdForCraft(key))?.label || label} group`}
                            aria-label="Focus"
                          >
                            <Crosshair className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="sps-live-matrix-prose">
                  {compiledMasterPrompt || (
                    <span className="italic text-[var(--sps-muted)]">No prompt yet — fill crafts on the left.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
        ) : null}
      </div>
    </div>
  );
}
