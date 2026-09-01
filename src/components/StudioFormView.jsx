import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Sparkles, Copy, Check, Plus, 
  Film, Camera, User, Wand2, 
  Star, Maximize2, Download
} from 'lucide-react';
import { compileNarrativeProse } from '../utils/narrativeCompiler';
import { parseSceneAndShotID } from '../utils/sceneShotUtils';
import SlotEditor from './SlotEditor';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import IntensityScaleSelector from './IntensityScaleSelector';
import { enhanceCraftSlotWithLLM } from '../services/aiScriptParser';
import {
  assertCanMutateContent,
  isLifecycleLocked,
  lifecycleExportReadiness
} from '../utils/productionLifecycle';
import LifecycleControls from './LifecycleControls';
import { resolveShotSpine } from '../utils/productionSpine';
import { resolveContinuityForShot } from '../utils/continuityState';
import { CMD_TYPES, proposeAndValidate, approveLlmCommand, applyLlmCommand } from '../utils/llmCommandBus';
import { exportDownloadText, assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { matrixShotsToCsv, matrixShotsToPrintHtml } from '../utils/matrixExport';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import {
  readActiveAssetRegistry,
  linkShotToAssetRegistry
} from '../utils/assetRegistry';
import {
  shotSpecSummary,
  toggleShotCharAssetId,
  toggleShotWorldAssetId
} from '../utils/shotSpec';

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

// Form Section Card Component (Theme-Adaptive)
const FormSection = ({ title, subtitle, icon: Icon, children }) => (
  <div className="sps-studio-section rounded-[10px] border border-[var(--sps-border)] p-3 space-y-3 font-mono bg-[var(--sps-surface)]">
    <div className="flex items-center justify-between border-b border-[var(--sps-border)] pb-1.5 flex-wrap gap-2">
      <div className="flex items-center gap-2.5">
        <div className="sps-icon-btn pointer-events-none">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold font-sans uppercase tracking-wider text-[var(--sps-text)]">
            {title}
          </h3>
          {subtitle && <p className="text-xs font-mono font-medium text-[var(--sps-muted)]">{subtitle}</p>}
        </div>
      </div>
    </div>
    <div className="space-y-3 pt-1">{children}</div>
  </div>
);

// Individual Craft Input Field Component (Theme-Adaptive High-Contrast + Permanent Highlight + Star Icon Favorites Filter)
const CraftField = ({
  fieldKey, label, placeholder, rows = 2,
  currentShot, highlightedFieldKey, activeModalSlotKey,
  favoriteCraftKeys, showFavoritesOnly,
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

  // If Show Favorites Only mode is enabled, hide un-favorited craft fields
  if (showFavoritesOnly && !isFavorite) {
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
      className={`sps-craft-field space-y-2.5 p-3 rounded-[10px] border cursor-pointer ${
        isHighlighted ? 'is-on' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <label className={`text-[10px] font-semibold font-mono uppercase tracking-wide px-2 py-0.5 rounded-[7px] border truncate ${
            isHighlighted
              ? 'text-[var(--sps-on-gold)] bg-[var(--sps-gold)] border-[var(--sps-gold)]'
              : 'text-[var(--sps-muted)] bg-[var(--sps-surface)] border-[var(--sps-border)]'
          }`}>
            <span>{label}</span>
          </label>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteCraft(fieldKey);
            }}
            className={`sps-icon-btn shrink-0 ${isFavorite ? 'is-on' : ''}`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHighlightedFieldKey(fieldKey);
              setActiveModalSlotKey(fieldKey);
            }}
            className="sps-btn sps-btn-compact"
            title="Expand editor (⌘Space)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Expand
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEnhanceField(fieldKey, label); }}
            disabled={isEnhancingField === fieldKey}
            className="sps-btn sps-btn-compact sps-btn-primary"
            title="AI enhance this craft"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isEnhancingField === fieldKey ? '…' : 'Enhance'}
          </button>
          <span className="sps-count-pill">{value.length}</span>
        </div>
      </div>

      {/* 🔥 INTERACTIVE INTENSITY SCALE SELECTOR (25%, 50%, 75%, 100%) */}
      <IntensityScaleSelector 
        value={value} 
        onChange={(newVal) => handleFieldChange(fieldKey, newVal)} 
        craftKey={fieldKey} 
        isPaperTheme={isPaperTheme} 
      />

      <textarea
        rows={rows}
        value={value}
        onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()} text parameter... (Double-click or Cmd+Space to expand)`}
        className="w-full rounded-[7px] p-2.5 text-sm font-mono leading-relaxed focus:outline-none border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[var(--sps-text)]"
      />

      {presets.length > 0 && (
        <div 
          style={isPaperTheme ? { borderColor: '#fef3c7' } : { borderColor: '#18181b' }}
          className="flex items-center gap-1.5 flex-wrap pt-2 border-t"
        >
          <span className={`text-[10px] font-bold uppercase shrink-0 font-sans tracking-wide ${
            isPaperTheme ? 'text-amber-900/70' : 'text-zinc-500'
          }`}>
            Quick Presets:
          </span>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleFieldChange(fieldKey, preset); }}
              style={
                value === preset 
                  ? { backgroundColor: '#f59e0b', color: '#000000', borderColor: '#d97706' } 
                  : isPaperTheme 
                    ? { backgroundColor: '#fef3c7', color: '#451a03', borderColor: '#fde68a' }
                    : { backgroundColor: '#18181b', color: '#e4e4e7', borderColor: '#27272a' }
              }
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all cursor-pointer border shadow-sm hover:border-amber-500 hover:scale-105"
            >
              {preset}
            </button>
          ))}
        </div>
      )}
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

  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: formLifecycleStrict,
    mode: formLifecycleMode
  } = useExportLifecyclePref('form');
  const exportBlocked = formLifecycleStrict && !exportLife.exportReady;
  const roomId = resolveCollabRoomId();
  const liveCount = useMemo(
    () => (Array.isArray(shots) ? shots.filter((s) => s && !s.isArchived) : []).length,
    [shots]
  );
  const formLifeNote = `${liveCount} live shots · form`;

  const handleExportFormCsv = () => {
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    exportDownloadText(`${slug}_form_matrix.csv`, matrixShotsToCsv(shots, SEEDANCE_SLOTS), {
      projectTitle,
      auditLabel: 'form_matrix_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: formLifecycleMode,
      shots,
      roomId,
      note: formLifeNote
    });
  };

  const handleExportFormPdf = () => {
    const gate = assertExportAllowed({
      projectTitle,
      label: 'form_matrix_pdf',
      format: 'pdf',
      lifecycleMode: formLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(matrixShotsToPrintHtml(shots, SEEDANCE_SLOTS, projectTitle));
    printWindow.document.close();
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    logExportSuccess({
      projectTitle,
      label: 'form_matrix_pdf',
      format: 'pdf',
      filename: `${slug}_form_matrix.pdf`,
      roomId,
      note: formLifeNote,
      lifecycleMode: gate.advisory ? `${formLifecycleMode}+ok` : formLifecycleMode
    });
  };

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

  // Favorites & Show Favorites Only Filter State — persisted to localStorage
  const [favoriteCraftKeys, setFavoriteCraftKeys] = useState(() => {
    try {
      const saved = localStorage.getItem('sps_favorite_craft_keys');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['sceneShotId', 'sceneSynopsis', 'shotComposition', 'cameraMotionTag', 'subjectLightingTag'];
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => {
    return localStorage.getItem('sps_show_favorites_only') === 'true';
  });

  const toggleFavoriteCraft = (fieldKey) => {
    setFavoriteCraftKeys(prev => {
      const next = prev.includes(fieldKey)
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey];
      localStorage.setItem('sps_favorite_craft_keys', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleFavoritesOnly = (val) => {
    const next = typeof val === 'boolean' ? val : !showFavoritesOnly;
    setShowFavoritesOnly(next);
    localStorage.setItem('sps_show_favorites_only', String(next));
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
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      console.error('AI Enhancement error:', err);
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
        return currentShot[c.key] ? `${c.label}: ${currentShot[c.key]}` : null;
      })
      .filter(Boolean)
      .join('. ');
  }, [currentShot, promptFormat, showFavoritesOnly, favoriteCraftKeys]);

  const handleCopyPrompt = () => {
    if (compiledMasterPrompt && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(compiledMasterPrompt);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
  };

  const craftProps = {
    currentShot, highlightedFieldKey, activeModalSlotKey,
    favoriteCraftKeys, showFavoritesOnly,
    isPaperTheme, colorTheme, shots, activeShotIndex,
    onSelectShot, setHighlightedFieldKey, setActiveModalSlotKey,
    toggleFavoriteCraft, handleFieldChange, handleEnhanceField,
    isEnhancingField, onCraftTap: handleCraftTap
  };



  return (
    <div className="sps-studio-form w-full h-full min-h-0 flex flex-col overflow-hidden bg-[var(--sps-bg)] text-[var(--sps-text)]">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)]">
        <span className="text-[10px] font-mono text-[var(--sps-muted)] uppercase tracking-wide">
          Shot lifecycle
        </span>
        <LifecycleControls entity={currentShot} onChange={handleLifecycleChange} />
        {isLifecycleLocked(currentShot) ? (
          <span className="text-[10px] text-[var(--sps-gold)] font-mono">Craft frozen — unlock to revise</span>
        ) : null}
        {spineNode ? (
          <span className="text-[10px] font-mono text-[var(--sps-muted)] ml-auto">
            Act {spineNode.act} · Seq {spineNode.sequenceSeq} · {spineNode.sceneTag}
          </span>
        ) : null}
      </div>
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
            <div className="shrink-0 px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-surface)]">
              <p className="text-[10px] text-[var(--sps-muted)] m-0">
                Asset IDs — open Cast/World then Relink from Production dashboard to mint CHAR_/WORLD_ refs.
              </p>
            </div>
          );
        }
        return (
          <div className="shrink-0 px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-surface)] space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] m-0">
                Shot Spec · assets · crafts {spec.craftPct}%
              </p>
              <button
                type="button"
                className="sps-btn sps-btn-compact text-[9px] disabled:opacity-40"
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
            {chars.length ? (
              <div className="flex flex-wrap gap-1">
                {chars.map((c) => {
                  const on = boundChars.has(c.assetId);
                  return (
                    <button
                      key={c.assetId}
                      type="button"
                      disabled={locked || !onUpdateShot}
                      title={c.name || c.tag || c.assetId}
                      className={`text-[9px] font-mono px-1.5 py-0.5 border rounded disabled:opacity-40 ${
                        on
                          ? 'border-[var(--sps-gold)] text-[var(--sps-gold)]'
                          : 'border-[var(--sps-border)] text-[var(--sps-muted)]'
                      }`}
                      onClick={() =>
                        onUpdateShot(activeShotIndex, toggleShotCharAssetId(currentShot, c.assetId))
                      }
                    >
                      {c.assetId}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {worlds.length ? (
              <div className="flex flex-wrap gap-1">
                {worlds.map((w) => {
                  const on = boundWorld.has(w.assetId);
                  return (
                    <button
                      key={w.assetId}
                      type="button"
                      disabled={locked || !onUpdateShot}
                      title={w.name || w.tag || w.assetId}
                      className={`text-[9px] font-mono px-1.5 py-0.5 border rounded disabled:opacity-40 ${
                        on
                          ? 'border-cyan-500/70 text-cyan-400'
                          : 'border-[var(--sps-border)] text-[var(--sps-muted)]'
                      }`}
                      onClick={() =>
                        onUpdateShot(activeShotIndex, toggleShotWorldAssetId(currentShot, w.assetId))
                      }
                    >
                      {w.assetId}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })()}
      {continuityBundle.entries.length > 0 ? (
        <div className="shrink-0 px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-surface)] space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)]">Continuity state</p>
          {continuityBundle.entries.map((entry) => (
            <div key={entry.key} className="border border-[var(--sps-border)] rounded-[6px] p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-mono font-bold text-[var(--sps-gold)]">{entry.tag || entry.name}</span>
                {entry.implicitChange ? (
                  <span className="text-[9px] text-amber-400 font-mono">drift — patch below</span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {['costume', 'injury', 'prop'].map((field) => (
                  <div key={field}>
                    <label className="text-[9px] text-[var(--sps-muted)] uppercase">{field}</label>
                    <input
                      type="text"
                      value={entry.patch?.[field] ?? entry.state[field] ?? ''}
                      disabled={isLifecycleLocked(currentShot)}
                      onChange={(e) => patchContinuityField(entry.key, field, e.target.value)}
                      className="w-full mt-0.5 text-[10px] font-mono border border-[var(--sps-border)] rounded px-1.5 py-1 bg-[var(--sps-bg)] disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {/* MAIN TWO-COLUMN FORM WORKSPACE */}
      <div className="sps-studio-form-grid flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 w-full">
        {/* LEFT COLUMN: 24 CRAFT PRODUCTION FORM STAGES OR EXPANDED EDITOR (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeModalSlotKey ? (
            /* FULL TEXT & PRESET MANAGER WINDOW IN LEFT WORKSPACE */
            <div className="rounded-[10px] overflow-hidden border border-[var(--sps-border)] bg-[var(--sps-surface)] font-mono">
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
              {/* STAGE 1: SHOT IDENTITY & SYNOPSIS */}
              <FormSection title="Stage 1: Shot Identity & Scene Synopsis" subtitle="Set shot ID, narrative context, and temporal duration" icon={Film}>
                <CraftField fieldKey="sceneSynopsis" label="Scene Synopsis (LLM Auto vs Writer Manual)" placeholder="Enter complete scene context, location, atmospheric setup, and narrative goal..." rows={3} {...craftProps} />
              </FormSection>

              {/* STAGE 2: CINEMATOGRAPHY & CAMERA CRAFT */}
              <FormSection title="Stage 2: Cinematography & Camera Craft" subtitle="Framing, lens choices, color palettes, and directional lighting" icon={Camera}>
                <div className="grid grid-cols-1 gap-4">
                  <CraftField fieldKey="shotComposition" label="Shot Composition & Framing" {...craftProps} />
                  <CraftField fieldKey="cameraMotionTag" label="Camera Motion & Rig" {...craftProps} />
                  <CraftField fieldKey="lensAndFocalLength" label="Lens & Focal Length" {...craftProps} />
                  <CraftField fieldKey="timeAndLightingEnv" label="Weather & Time Rig (Weather, Timing, Nature/Indoor Env)" {...craftProps} />
                  <CraftField fieldKey="directionalLightingAndHighlight" label="Light Direction, Shadow Placement & Highlight Rig" {...craftProps} />
                  <CraftField fieldKey="subjectLightingTag" label="Subject Lighting" {...craftProps} />
                  <CraftField fieldKey="subjectColorTag" label="Subject Color" {...craftProps} />
                  <CraftField fieldKey="backgroundLightingTag" label="Background Lighting" {...craftProps} />
                  <CraftField fieldKey="backgroundColorTag" label="Background Color" {...craftProps} />
                  <CraftField fieldKey="colorPaletteSlot" label="Color Palette & Grade" {...craftProps} />
                </div>
              </FormSection>

              {/* STAGE 3: CHARACTER & ACTION PERFORMANCE */}
              <FormSection title="Stage 3: Character Performance & Action" subtitle="Character ref, expressions, dialogue, and stunt mechanics" icon={User}>
                <div className="grid grid-cols-1 gap-4">
                  <CraftField fieldKey="characterIdAssetRef" label="Character Asset Reference" {...craftProps} />
                  <CraftField fieldKey="coArtistInteraction" label="Co-Artist Interaction" {...craftProps} />
                  <CraftField fieldKey="actionEnvContext" label="Environment Context" {...craftProps} />
                  <CraftField fieldKey="characterExpression" label="Expression & Emotion" {...craftProps} />
                  <CraftField fieldKey="characterPsychologyState" label="Psychological State & Subconscious Mindframe" {...craftProps} />
                  <CraftField fieldKey="characterMannerismAndPosture" label="Mannerisms, Body Ticks & Posture Habits" {...craftProps} />
                  <CraftField fieldKey="characterPlacement" label="Spatial Placement" {...craftProps} />
                  <CraftField fieldKey="characterDialogue" label="Character Dialogue" {...craftProps} />
                  <CraftField fieldKey="characterMovement" label="Action Performance" {...craftProps} />
                  <CraftField fieldKey="characterEyeLooks" label="Eye Look & Directing" {...craftProps} />
                  <CraftField fieldKey="makeupAndHairStyle" label="Makeup & Hair Styling" {...craftProps} />
                  <CraftField fieldKey="stuntAndSafetyNotes" label="Stunts & Safety Notes" {...craftProps} />
                </div>
              </FormSection>

              {/* STAGE 4: POST-PRODUCTION & SOUND */}
              <FormSection title="Stage 4: Post-Production, VFX & Audio" subtitle="Volumetrics, CGI breakdown, audio SFX, and score" icon={Wand2}>
                <div className="grid grid-cols-1 gap-4">
                  <CraftField fieldKey="atmosphereVolumetricsTag" label="Atmosphere & Volumetrics" {...craftProps} />
                  <CraftField fieldKey="vfxCgiBreakdown" label="VFX & CGI Breakdown" {...craftProps} />
                  <CraftField fieldKey="soundFxAndFoley" label="Sound FX & Foley" {...craftProps} />
                  <CraftField fieldKey="backgroundScoreMood" label="Background Score Mood" {...craftProps} />
                  <CraftField fieldKey="editTransitionCut" label="Edit Cut & Transition" {...craftProps} />
                </div>
              </FormSection>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: STICKY LIVE COMPILED PROMPT CARD (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
            <div className="sps-live-matrix-card rounded-[10px] border border-[var(--sps-border)] bg-[var(--sps-surface)] p-3 space-y-2 font-mono overflow-hidden">
              <div className="border-b border-[var(--sps-border)] pb-2 space-y-2">
                <div className="sps-compact-toolbar justify-between">
                  <span className="min-w-0 font-black text-[11px] font-sans uppercase tracking-wider flex items-center gap-1.5 text-[var(--sps-text)]">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--sps-gold)] shrink-0" />
                    <span className="truncate">Live prompt</span>
                  </span>
                  <div className="sps-compact-toolbar">
                    <button
                      type="button"
                      onClick={() => handleToggleFavoritesOnly()}
                      className={`sps-icon-btn ${showFavoritesOnly ? 'is-on' : ''}`}
                      title={showFavoritesOnly ? `Show all ${SEEDANCE_SLOTS.length} crafts` : 'Show favorites'}
                    >
                      <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                    </button>
                    {onAddShot ? (
                      <button type="button" onClick={onAddShot} className="sps-icon-btn is-on" title="Add shot">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="sps-compact-toolbar">
                  <div className="flex items-center gap-0.5 p-0.5 rounded-[7px] border border-[var(--sps-border)] bg-[var(--sps-bg)]">
                    <button
                      type="button"
                      onClick={() => { setPromptFormat('crafts'); localStorage.setItem('sps_prompt_format', 'crafts'); }}
                      className={`sps-btn sps-btn-compact ${promptFormat === 'crafts' ? 'sps-btn-primary' : ''}`}
                    >
                      Craft
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPromptFormat('prose'); localStorage.setItem('sps_prompt_format', 'prose'); }}
                      className={`sps-btn sps-btn-compact ${promptFormat === 'prose' ? 'sps-btn-primary' : ''}`}
                    >
                      Prose
                    </button>
                  </div>
                  <div className="flex items-center gap-1 px-1.5 h-7 border border-[var(--sps-border)] rounded-[7px] bg-[var(--sps-bg)]" title="Shot">
                    <span className="text-[10px] font-black uppercase text-[var(--sps-text)]">Shot</span>
                    <input
                      type="number"
                      min="1"
                      max={shots.length}
                      value={shotNumberInput}
                      onChange={(e) => handleShotNumberChange(e.target.value)}
                      className="w-7 text-center py-0 rounded border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[var(--sps-text)] font-mono font-black text-[11px] focus:outline-none focus:border-[var(--sps-gold)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] font-mono font-bold text-[var(--sps-muted)]">/{shots.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="sps-icon-btn is-on"
                    title={copyToast ? 'Copied' : 'Copy prompt'}
                  >
                    {copyToast ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportFormCsv}
                    disabled={exportBlocked}
                    className="sps-icon-btn disabled:opacity-40"
                    title={exportBlocked ? exportLife.message : 'Export Form craft CSV (all shots)'}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleExportFormPdf}
                    disabled={exportBlocked}
                    className="sps-btn text-[9px] h-7 px-2 disabled:opacity-40"
                    title={exportBlocked ? exportLife.message : 'Print Form craft PDF'}
                  >
                    PDF
                  </button>
                </div>
                {exportBlocked ? (
                  <p className="text-[9px] text-[var(--sps-gold)] m-0 leading-snug">
                    {exportLife.message}
                  </p>
                ) : null}
              </div>

              {/* Live Compiled Prompt Text with Interactive Auto-Scroll & Permanent Highlight Sync */}
              <div className="sps-studio-preview sps-live-matrix p-2 rounded-[8px] border border-[var(--sps-border)] bg-[var(--sps-bg)] text-xs leading-relaxed max-h-[calc(100vh-10rem)] min-h-[520px] overflow-y-auto font-mono">
                {promptFormat === 'crafts' ? (
                  <div className="sps-live-matrix-list">
                    {CRAFT_COLOR_MAP.map(({ key, label, accent }) => {
                      const val = currentShot[key];
                      if (!val) return null;
                      if (showFavoritesOnly && favoriteCraftKeys.includes(key)) return null;
                      const isSelectedBadge = highlightedFieldKey === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => handleCraftTap(key, false)}
                          onDoubleClick={() => handleCraftTap(key, true)}
                          className={`sps-live-matrix-row ${isSelectedBadge ? 'is-on' : ''}`}
                          style={{ '--row-accent': accent }}
                          title={`Click to focus ${label}. Double-click to expand editor.`}
                        >
                          <span className="sps-live-matrix-k">{label}</span>
                          <span className="sps-live-matrix-v">{val}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="sps-live-matrix-prose">
                    {compiledMasterPrompt || <span className="italic text-[var(--sps-muted)]">No prompt parameters entered yet…</span>}
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

    </div>
  );
}
