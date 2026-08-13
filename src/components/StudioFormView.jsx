import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Sparkles, Copy, Check, Plus, 
  Film, Camera, User, Wand2, 
  Star, Maximize2
} from 'lucide-react';
import { compileNarrativeProse } from '../utils/narrativeCompiler';
import { parseSceneAndShotID } from '../utils/sceneShotUtils';
import SlotEditor from './SlotEditor';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import IntensityScaleSelector from './IntensityScaleSelector';
import { enhanceCraftSlotWithLLM } from '../services/aiScriptParser';

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

// Unique vibrant color highlight styles for each of the crafts
const CRAFT_COLOR_MAP = [
  { key: 'sceneShotId', label: 'Shot ID', color: 'text-sky-300', bg: 'bg-sky-500/20 border-sky-400/50', category: 'Stage 1: Identity' },
  { key: 'sceneSynopsis', label: 'Synopsis', color: 'text-amber-200', bg: 'bg-amber-500/20 border-amber-400/50', category: 'Stage 1: Identity' },
  { key: 'shotDurationAndImages', label: 'Duration & Assets', color: 'text-blue-200', bg: 'bg-blue-400/20 border-blue-300/50', category: 'Stage 1: Identity' },
  
  { key: 'shotComposition', label: 'Framing', color: 'text-rose-300', bg: 'bg-rose-500/20 border-rose-400/50', category: 'Stage 2: Camera' },
  { key: 'cameraMotionTag', label: 'Camera', color: 'text-orange-300', bg: 'bg-orange-500/20 border-orange-400/50', category: 'Stage 2: Camera' },
  { key: 'lensAndFocalLength', label: 'Lens', color: 'text-yellow-200', bg: 'bg-yellow-500/20 border-yellow-400/50', category: 'Stage 2: Camera' },
  { key: 'timeAndLightingEnv', label: 'Weather & Time Rig', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-400/50', category: 'Stage 2: Camera' },
  { key: 'directionalLightingAndHighlight', label: 'Light Angle & Highlight Rig', color: 'text-yellow-300', bg: 'bg-yellow-500/20 border-yellow-400/50', category: 'Stage 2: Camera' },
  { key: 'subjectLightingTag', label: 'Subject Lighting', color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-400/50', category: 'Stage 2: Camera' },
  { key: 'subjectColorTag', label: 'Subject Color', color: 'text-teal-300', bg: 'bg-teal-500/20 border-teal-400/50', category: 'Stage 2: Camera' },
  { key: 'backgroundLightingTag', label: 'BG Lighting', color: 'text-cyan-300', bg: 'bg-cyan-500/20 border-cyan-400/50', category: 'Stage 2: Camera' },
  { key: 'backgroundColorTag', label: 'BG Color', color: 'text-indigo-300', bg: 'bg-[#6366F1]/20 border-indigo-400/50', category: 'Stage 2: Camera' },
  { key: 'colorPaletteSlot', label: 'Palette', color: 'text-purple-300', bg: 'bg-purple-500/20 border-purple-400/50', category: 'Stage 2: Camera' },
  
  { key: 'characterIdAssetRef', label: 'Character Ref', color: 'text-pink-300', bg: 'bg-pink-500/20 border-pink-400/50', category: 'Stage 3: Performance' },
  { key: 'coArtistInteraction', label: 'Co-Artist', color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/20 border-fuchsia-400/50', category: 'Stage 3: Performance' },
  { key: 'actionEnvContext', label: 'Environment', color: 'text-blue-300', bg: 'bg-blue-500/20 border-blue-400/50', category: 'Stage 3: Performance' },
  { key: 'characterExpression', label: 'Expression', color: 'text-rose-200', bg: 'bg-rose-400/20 border-rose-300/50', category: 'Stage 3: Performance' },
  { key: 'characterPsychologyState', label: 'Psychology & Mindstate', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-400/50', category: 'Stage 3: Performance' },
  { key: 'characterMannerismAndPosture', label: 'Mannerisms & Posture', color: 'text-purple-300', bg: 'bg-purple-500/20 border-purple-400/50', category: 'Stage 3: Performance' },
  { key: 'characterPlacement', label: 'Placement', color: 'text-violet-300', bg: 'bg-violet-500/20 border-violet-400/50', category: 'Stage 3: Performance' },
  { key: 'characterDialogue', label: 'Dialogue', color: 'text-emerald-200', bg: 'bg-emerald-400/20 border-emerald-300/50', category: 'Stage 3: Performance' },
  { key: 'characterMovement', label: 'Action Performance', color: 'text-sky-200', bg: 'bg-sky-400/20 border-sky-300/50', category: 'Stage 3: Performance' },
  { key: 'characterEyeLooks', label: 'Eye Look', color: 'text-purple-200', bg: 'bg-purple-400/20 border-purple-300/50', category: 'Stage 3: Performance' },
  { key: 'makeupAndHairStyle', label: 'Makeup/Hair', color: 'text-pink-200', bg: 'bg-pink-400/20 border-pink-300/50', category: 'Stage 3: Performance' },
  { key: 'stuntAndSafetyNotes', label: 'Stunts', color: 'text-red-300', bg: 'bg-red-500/20 border-red-400/50', category: 'Stage 3: Performance' },
  
  { key: 'atmosphereVolumetricsTag', label: 'Atmosphere', color: 'text-cyan-200', bg: 'bg-cyan-400/20 border-cyan-300/50', category: 'Stage 4: Audio & FX' },
  { key: 'vfxCgiBreakdown', label: 'VFX/CGI', color: 'text-fuchsia-200', bg: 'bg-fuchsia-400/20 border-fuchsia-300/50', category: 'Stage 4: Audio & FX' },
  { key: 'soundFxAndFoley', label: 'Audio/SFX', color: 'text-green-300', bg: 'bg-green-500/20 border-green-400/50', category: 'Stage 4: Audio & FX' },
  { key: 'backgroundScoreMood', label: 'Score', color: 'text-rose-400', bg: 'bg-rose-600/20 border-rose-500/50', category: 'Stage 4: Audio & FX' },
  { key: 'editTransitionCut', label: 'Cut/Transition', color: 'text-amber-300', bg: 'bg-amber-400/20 border-amber-300/50', category: 'Stage 4: Audio & FX' }
];

// Form Section Card Component (Theme-Adaptive)
const FormSection = ({ title, subtitle, icon: Icon, children, isPaperTheme }) => (
  <div 
    style={isPaperTheme ? { backgroundColor: '#ffffff', borderColor: '#fde68a' } : { backgroundColor: '#18181b', borderColor: '#27272a' }}
    className="sps-studio-section rounded-2xl border p-5 shadow-lg space-y-4 font-mono transition-all"
  >
    <div 
      style={isPaperTheme ? { borderColor: '#fef3c7' } : { borderColor: '#27272a' }}
      className="flex items-center justify-between border-b pb-3 flex-wrap gap-2"
    >
      <div className="flex items-center gap-2.5">
        <div 
          style={isPaperTheme ? { backgroundColor: '#fef3c7', borderColor: '#fde68a' } : { backgroundColor: '#09090b', borderColor: '#27272a' }}
          className="p-2 rounded-xl border flex items-center justify-center shadow-sm"
        >
          <Icon className={`w-5 h-5 ${isPaperTheme ? 'text-amber-800' : 'text-amber-400'}`} />
        </div>
        <div>
          <h3 className={`text-sm font-black font-sans uppercase tracking-wider ${isPaperTheme ? 'text-amber-950' : 'text-white'}`}>
            {title}
          </h3>
          {subtitle && <p className={`text-xs font-mono font-medium ${isPaperTheme ? 'text-amber-800/80' : 'text-zinc-400'}`}>{subtitle}</p>}
        </div>
      </div>
    </div>
    <div className="space-y-4 pt-1">{children}</div>
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
      style={
        isHighlighted
          ? isPaperTheme 
            ? { backgroundColor: '#fef08a', borderColor: '#f59e0b', color: '#000000' }
            : { backgroundColor: '#1e1b4b', borderColor: '#818cf8', color: '#ffffff' }
          : isPaperTheme 
            ? { backgroundColor: '#fffdf9', borderColor: '#fde68a' } 
            : { backgroundColor: '#09090b', borderColor: '#27272a' }
      }
      className={`sps-craft-field space-y-2.5 p-4 rounded-xl border transition-all duration-300 shadow-sm cursor-pointer ${
        isHighlighted 
          ? 'ring-4 ring-amber-400 dark:ring-indigo-400 scale-[1.01] shadow-2xl' 
          : 'hover:border-amber-400/60'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Label + Star Favorite Icon */}
        <div className="flex items-center gap-2">
          <label className={`text-xs font-black font-mono flex items-center gap-1.5 uppercase tracking-wide ${
            isHighlighted
              ? 'text-black bg-amber-400 px-2.5 py-1 rounded-lg border border-amber-600 font-extrabold shadow-sm'
              : isPaperTheme 
                ? 'text-amber-950 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300/80' 
                : 'text-amber-400'
          }`}>
            <span className="font-bold text-amber-600 dark:text-amber-400">⚡</span>
            <span>{label}:</span>
          </label>

          {/* ⭐ STAR FAVORITE ICON BUTTON */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteCraft(fieldKey);
            }}
            className={`p-1 rounded-lg border transition-all cursor-pointer shadow-sm hover:scale-110 active:scale-95 ${
              isFavorite 
                ? 'bg-amber-400 text-black border-amber-500 shadow-sm' 
                : isPaperTheme 
                  ? 'bg-amber-100/60 text-amber-800 border-amber-300/60 hover:bg-amber-200' 
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-amber-400'
            }`}
            title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-black stroke-black font-black' : 'stroke-[2]'}`} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { 
              e.stopPropagation(); 
              setHighlightedFieldKey(fieldKey);
              setActiveModalSlotKey(fieldKey); 
            }}
            style={
              isPaperTheme 
                ? { backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#fde68a' } 
                : { backgroundColor: '#18181b', color: '#38bdf8', borderColor: '#0284c750' }
            }
            className="px-2.5 py-1 rounded-xl border text-xs font-bold font-mono flex items-center gap-1 transition-all cursor-pointer shadow-sm hover:scale-105"
            title="Expand Craft Editor Window In-Place (Double-Click or Cmd+Space)"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Expand (⌘Space)</span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEnhanceField(fieldKey, label); }}
            disabled={isEnhancingField === fieldKey}
            style={
              isPaperTheme 
                ? { backgroundColor: '#f59e0b', color: '#ffffff', borderColor: '#d97706' } 
                : { backgroundColor: '#18181b', color: '#f59e0b', borderColor: '#f59e0b50' }
            }
            className="px-3 py-1 rounded-xl border text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:brightness-110"
            title="Enhance field using Pedditi Labs Cinema Intelligence Engine"
          >
            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="font-bold">{isEnhancingField === fieldKey ? 'Enhancing...' : 'AI Enhance'}</span>
          </button>

          <span 
            style={isPaperTheme ? { backgroundColor: '#fef3c7', borderColor: '#fde68a', color: '#78350f' } : { backgroundColor: '#18181b', borderColor: '#27272a', color: '#d4d4d8' }}
            className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl border shadow-sm"
          >
            {value.length} chars
          </span>
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
        style={
          isHighlighted
            ? { backgroundColor: '#ffffff', color: '#000000', fontWeight: '900', borderColor: '#d97706' }
            : isPaperTheme 
              ? { backgroundColor: '#ffffff', color: '#000000', fontWeight: '900', borderColor: '#fcd34d' } 
              : { backgroundColor: '#18181b', color: '#ffffff', fontWeight: '900', borderColor: '#27272a' }
        }
        className="w-full rounded-xl p-3 text-sm font-mono leading-relaxed transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500/80 font-black text-black"
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
  projectTitle = ''
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
    onUpdateShot(activeShotIndex, { ...currentShot, [key]: val });
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

  // Pedditi Labs AI Field Enhancer
  const handleEnhanceField = async (key, label) => {
    setIsEnhancingField(key);
    try {
      const currentVal = currentShot[key] || '';
      const enhancedVal = await enhanceCraftSlotWithLLM(key || label, currentVal, {
        ...(currentShot || {}),
        genreKey,
        projectTitle,
        presetProfile: genreKey
      });
      if (enhancedVal) handleFieldChange(key, enhancedVal);
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
    <div 
      style={isPaperTheme ? { backgroundColor: '#FAF8F5', color: '#0f172a' } : { backgroundColor: '#09090b', color: '#ffffff' }}
      className="sps-studio-form w-full h-full min-h-screen font-mono flex flex-col overflow-y-auto"
    >
      {/* MAIN TWO-COLUMN FORM WORKSPACE */}
      <div className="sps-studio-form-grid flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1920px] mx-auto w-full min-w-0">
        {/* LEFT COLUMN: 24 CRAFT PRODUCTION FORM STAGES OR EXPANDED EDITOR (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeModalSlotKey ? (
            /* FULL TEXT & PRESET MANAGER WINDOW IN LEFT WORKSPACE */
            <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/80 bg-zinc-950 font-mono">
              <SlotEditor
                slotConfig={SEEDANCE_SLOTS.find(s => s.key === activeModalSlotKey) || {
                  key: activeModalSlotKey,
                  label: activeModalSlotKey,
                  presets: CRAFT_PRESETS[activeModalSlotKey] || []
                }}
                value={currentShot[activeModalSlotKey] || ''}
                onChange={(val) => handleFieldChange(activeModalSlotKey, val)}
                shot={currentShot}
                embedded={true}
                compact={false}
                allSlots={SEEDANCE_SLOTS}
                genreKey={genreKey}
                projectTitle={projectTitle}
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
              <FormSection title="Stage 1: Shot Identity & Scene Synopsis" subtitle="Set shot ID, narrative context, and temporal duration" icon={Film} isPaperTheme={isPaperTheme}>
                <CraftField fieldKey="sceneSynopsis" label="Scene Synopsis (LLM Auto vs Writer Manual)" placeholder="Enter complete scene context, location, atmospheric setup, and narrative goal..." rows={3} {...craftProps} />
              </FormSection>

              {/* STAGE 2: CINEMATOGRAPHY & CAMERA CRAFT */}
              <FormSection title="Stage 2: Cinematography & Camera Craft" subtitle="Framing, lens choices, color palettes, and directional lighting" icon={Camera} isPaperTheme={isPaperTheme}>
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
              <FormSection title="Stage 3: Character Performance & Action" subtitle="Character ref, expressions, dialogue, and stunt mechanics" icon={User} isPaperTheme={isPaperTheme}>
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
              <FormSection title="Stage 4: Post-Production, VFX & Audio" subtitle="Volumetrics, CGI breakdown, audio SFX, and score" icon={Wand2} isPaperTheme={isPaperTheme}>
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
          <div className="sticky top-6 space-y-5">
            {/* LIVE MASTER PROMPT CONSOLE CARD */}
            <div 
              style={isPaperTheme ? { backgroundColor: '#ffffff', borderColor: '#fde68a' } : { backgroundColor: '#18181b', borderColor: '#f59e0b60' }}
              className="rounded-2xl border p-4 shadow-xl space-y-3 font-mono overflow-hidden"
            >
              <div 
                style={isPaperTheme ? { borderColor: '#fef3c7' } : { borderColor: '#27272a' }}
                className="border-b pb-2.5 space-y-2"
              >
                {/* Title Left, Favorites Toggle & + Add Shot Button on the Right */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-black text-xs font-sans uppercase tracking-wider flex items-center gap-1.5 ${
                    isPaperTheme ? 'text-amber-950' : 'text-amber-400'
                  }`}>
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Live Master Production Prompt</span>
                  </span>

                  <div className="flex items-center gap-2">
                    {/* ⭐ SMALL STAR BUTTON TO TOGGLE SHOWING ONLY FAVORITES */}
                    <button
                      type="button"
                      onClick={() => handleToggleFavoritesOnly()}
                      style={
                        showFavoritesOnly 
                          ? { backgroundColor: '#f59e0b', color: '#000000', borderColor: '#d97706' } 
                          : isPaperTheme 
                            ? { backgroundColor: '#fef3c7', color: '#451a03', borderColor: '#fde68a' }
                            : { backgroundColor: '#18181b', color: '#f59e0b', borderColor: '#27272a' }
                      }
                      className="px-2.5 py-1 rounded-xl border text-xs font-bold font-mono flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:scale-105"
                      title={showFavoritesOnly ? `Show All ${SEEDANCE_SLOTS.length} Crafts` : "Show Only Favorited Crafts"}
                    >
                      <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-black stroke-black font-black' : 'fill-amber-400 text-amber-500'}`} />
                      <span>{showFavoritesOnly ? 'Favorites Only' : 'Favorites'}</span>
                    </button>

                    {onAddShot && (
                      <button
                        type="button"
                        onClick={onAddShot}
                        style={{ backgroundColor: '#f59e0b', color: '#000000' }}
                        className="px-3 py-1 rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer hover:bg-amber-400 hover:scale-105 uppercase font-sans tracking-wide shrink-0"
                        title="Add New Shot"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Add Shot</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub Row: Format Switcher (Left), Shot Position (Center), Copy Button (Right) */}
                <div className="flex items-center justify-between gap-1.5 pt-1 flex-nowrap w-full">
                  {/* Left: N-Craft | Prose Toggle */}
                  <div 
                    style={isPaperTheme ? { backgroundColor: '#fef3c7', borderColor: '#fde68a' } : { backgroundColor: '#09090b', borderColor: '#27272a' }}
                    className="flex items-center gap-0.5 p-0.5 rounded-lg border shadow-sm shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => { setPromptFormat('crafts'); localStorage.setItem('sps_prompt_format', 'crafts'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        promptFormat === 'crafts' ? 'bg-amber-500 text-black font-black shadow-sm' : isPaperTheme ? 'text-amber-950' : 'text-zinc-400'
                      }`}
                    >
                      {`🎬 ${SEEDANCE_SLOTS.length}-Craft`}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPromptFormat('prose'); localStorage.setItem('sps_prompt_format', 'prose'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        promptFormat === 'prose' ? 'bg-amber-500 text-black font-black shadow-sm' : isPaperTheme ? 'text-amber-950' : 'text-zinc-400'
                      }`}
                    >
                      📜 Prose
                    </button>
                  </div>

                  {/* Center: Shot Position (SHOT [ 11 ] / 28) - NO ARROWS */}
                  <div 
                    style={isPaperTheme ? { backgroundColor: '#ffffff', borderColor: '#fcd34d' } : { backgroundColor: '#09090b', borderColor: '#27272a' }}
                    className="flex items-center gap-1 px-2 py-0.5 border rounded-xl shadow-sm shrink-0"
                    title="Shot Position"
                  >
                    <span className={`text-[10.5px] font-black font-sans uppercase tracking-wide ${isPaperTheme ? 'text-amber-950' : 'text-amber-400'}`}>Shot</span>
                    <input
                      type="number"
                      min="1"
                      max={shots.length}
                      value={shotNumberInput}
                      onChange={(e) => handleShotNumberChange(e.target.value)}
                      style={isPaperTheme ? { backgroundColor: '#fef3c7', color: '#000000', borderColor: '#fcd34d' } : { backgroundColor: '#18181b', color: '#f59e0b', borderColor: '#27272a' }}
                      className="w-8 text-center py-0.5 rounded-md border font-mono font-black text-xs focus:outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                    />
                    <span className={`text-[10.5px] font-mono font-bold opacity-80 ${isPaperTheme ? 'text-amber-900' : 'text-zinc-400'}`}>
                      / {shots.length}
                    </span>
                  </div>

                  {/* Right: Copy Button */}
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    style={{ backgroundColor: '#f59e0b', color: '#000000' }}
                    className="px-2.5 py-1 rounded-lg font-black text-xs font-mono flex items-center gap-1 shadow-md transition-all cursor-pointer hover:bg-amber-400 hover:scale-105 shrink-0"
                    title="Copy Compiled Master Prompt"
                  >
                    {copyToast ? <Check className="w-3.5 h-3.5 text-black stroke-[3]" /> : <Copy className="w-3.5 h-3.5 text-black" />}
                    <span>{copyToast ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Live Compiled Prompt Text with Interactive Auto-Scroll & Permanent Highlight Sync */}
              <div 
                style={{ backgroundColor: '#09090b', borderColor: '#27272a' }}
                className="sps-studio-preview p-3.5 rounded-xl border text-xs leading-relaxed max-h-[calc(100vh-10rem)] min-h-[520px] overflow-y-auto font-mono font-medium selection:bg-amber-400 selection:text-black shadow-inner"
              >
                {promptFormat === 'crafts' ? (
                  <div className="flex flex-wrap gap-2 leading-relaxed">
                    {CRAFT_COLOR_MAP.map(({ key, label, color, bg }) => {
                      const val = currentShot[key];
                      if (!val) return null;

                      // When Favorites toggle is active, show only crafts NOT in favorites in this right console panel!
                      if (showFavoritesOnly && favoriteCraftKeys.includes(key)) return null;

                      const isSelectedBadge = highlightedFieldKey === key;

                      return (
                        <span 
                          key={key}
                          onClick={() => handleCraftTap(key, false)}
                          onDoubleClick={() => handleCraftTap(key, true)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono shadow-sm transition-all cursor-pointer ${
                            isSelectedBadge 
                              ? 'ring-2 ring-amber-400 scale-105 font-black bg-amber-400 text-black border-amber-500 shadow-md' 
                              : `${bg} hover:scale-105 hover:brightness-125`
                          }`}
                          title={`Click to focus & highlight ${label} (Double-click to expand Editor)`}
                        >
                          <span className={`font-black uppercase tracking-wider ${isSelectedBadge ? 'text-black' : color}`}>
                            {label}:
                          </span>
                          <span className={`${isSelectedBadge ? 'text-black font-bold' : 'text-zinc-100 font-medium'}`}>{val}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-amber-200 leading-relaxed font-mono">
                    {compiledMasterPrompt || <span className="text-zinc-600 italic">No prompt parameters entered yet...</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
