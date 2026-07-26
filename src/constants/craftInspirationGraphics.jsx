import React from 'react';
import { 
  Clapperboard, Frame, Camera, Sun, Palette, Sparkles, Image, Move, 
  Eye, Wind, CloudRain, Film, Zap, User, Clock, Shirt, Wand2, 
  Volume2, Sliders, ShieldAlert, Building2, Shield, Scissors, Monitor, FolderKanban
} from 'lucide-react';

export const CRAFT_INSPIRATION_DATA = {
  sceneShotId: {
    title: "Cinematic Narrative Anchor",
    quote: "Establish the temporal anchor & scene index for seamless narrative pacing across every take.",
    badges: ["🎬 Slate 01", "⏱️ Timecode Sync", "📍 Scene Anchor"],
    gradient: "from-amber-950/70 via-zinc-900 to-cyan-950/70",
    border: "border-amber-500/40",
    accentColor: "#F59E0B",
    icon: Clapperboard,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <rect x="10" y="10" width="220" height="40" rx="8" fill="#18181B" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 2"/>
        <path d="M20 20L40 20L30 35H10L20 20Z" fill="#F59E0B" opacity="0.8"/>
        <path d="M45 20L65 20L55 35H35L45 20Z" fill="#F59E0B" opacity="0.4"/>
        <path d="M70 20L90 20L80 35H60L70 20Z" fill="#F59E0B" opacity="0.8"/>
        <line x1="10" y1="35" x2="230" y2="35" stroke="#F59E0B" strokeWidth="1.5"/>
        <text x="100" y="46" fill="#FDE68A" fontSize="10" fontFamily="monospace" fontWeight="bold">SCENE 01 | TAKE 04 | 24 FPS</text>
        <circle cx="215" cy="25" r="4" fill="#EF4444"/>
      </svg>
    )
  },

  shotComposition: {
    title: "Framing Geometry & Optics",
    quote: "Sculpt spatial geometry with rule-of-thirds, negative space, headroom & dynamic horizon lines.",
    badges: ["📐 Rule of Thirds", "🔍 Focal Scale", "👁️ Eye-Line Alignment"],
    gradient: "from-cyan-950/70 via-zinc-900 to-blue-950/70",
    border: "border-cyan-500/40",
    accentColor: "#06B6D4",
    icon: Frame,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <rect x="20" y="8" width="200" height="44" rx="6" stroke="#06B6D4" strokeWidth="1.5" fill="#09090B"/>
        <line x1="86.6" y1="8" x2="86.6" y2="52" stroke="#06B6D4" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5"/>
        <line x1="153.3" y1="8" x2="153.3" y2="52" stroke="#06B6D4" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5"/>
        <line x1="20" y1="22.6" x2="220" y2="22.6" stroke="#06B6D4" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5"/>
        <line x1="20" y1="37.3" x2="220" y2="37.3" stroke="#06B6D4" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5"/>
        <circle cx="86.6" cy="22.6" r="3" fill="#67E8F9"/>
        <path d="M120 18C125 18 130 22 130 30C130 38 125 42 120 42C115 42 110 38 110 30C110 22 115 18 120 18Z" fill="#67E8F9" opacity="0.3" stroke="#67E8F9"/>
      </svg>
    )
  },

  cameraMotionTag: {
    title: "Kinetic Camera Dynamics",
    quote: "Guide audience emotion through fluid camera movement, tracking velocity & spatial arcs.",
    badges: ["🎥 Motion Vector", "🚀 Velocity Parallax", "🔄 360° Orbit Arc"],
    gradient: "from-purple-950/70 via-zinc-900 to-indigo-950/70",
    border: "border-purple-500/40",
    accentColor: "#A855F7",
    icon: Camera,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M20 45 Q 70 10, 120 30 T 220 15" stroke="#A855F7" strokeWidth="2.5" fill="none" strokeDasharray="6 3"/>
        <circle cx="120" cy="30" r="6" fill="#C084FC" stroke="#FFFFFF" strokeWidth="1.5"/>
        <polygon points="220,15 210,12 214,22" fill="#A855F7"/>
        <circle cx="70" cy="22" r="3" fill="#A855F7" opacity="0.6"/>
        <circle cx="170" cy="20" r="3" fill="#A855F7" opacity="0.6"/>
      </svg>
    )
  },

  subjectLightingTag: {
    title: "Subject Keylight & Modeling",
    quote: "Illuminate character soul with volumetric keylight, soft ambient fill & razor rim highlights.",
    badges: ["💡 Key & Fill Ratio", "✨ Volumetric Beams", "🌟 Edge Rim Light"],
    gradient: "from-amber-950/80 via-zinc-900 to-yellow-950/60",
    border: "border-yellow-500/40",
    accentColor: "#EAB308",
    icon: Sun,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <polygon points="30,5 60,5 160,55 10,55" fill="url(#sunBeam)" opacity="0.4"/>
        <circle cx="45" cy="10" r="8" fill="#FDE047"/>
        <path d="M120 45 C 110 35, 110 20, 120 15 C 130 20, 130 35, 120 45 Z" fill="#FEF08A" opacity="0.8"/>
        <path d="M123 15 C 133 20, 133 35, 123 45" stroke="#FACC15" strokeWidth="2" fill="none"/>
        <defs>
          <linearGradient id="sunBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FACC15" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#FACC15" stopOpacity="0"/>
          </linearGradient>
        </defs>
      </svg>
    )
  },

  subjectColorTag: {
    title: "Chromatic Palette & HSL Contrast",
    quote: "Harmonize character color tones to evoke visceral emotional resonance & cinematic pop.",
    badges: ["🎨 HSL Harmony", "🔴 Crimson & Ochre", "🌈 Color Contrast"],
    gradient: "from-rose-950/70 via-zinc-900 to-amber-950/70",
    border: "border-rose-500/40",
    accentColor: "#F43F5E",
    icon: Palette,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <circle cx="50" cy="30" r="16" fill="#F43F5E" opacity="0.8"/>
        <circle cx="85" cy="30" r="16" fill="#F59E0B" opacity="0.8"/>
        <circle cx="120" cy="30" r="16" fill="#10B981" opacity="0.8"/>
        <circle cx="155" cy="30" r="16" fill="#06B6D4" opacity="0.8"/>
        <circle cx="190" cy="30" r="16" fill="#8B5CF6" opacity="0.8"/>
      </svg>
    )
  },

  backgroundLightingTag: {
    title: "Environmental Backlight & Bokeh",
    quote: "Craft separation and atmosphere with ambient background glows and soft out-of-focus bokeh.",
    badges: ["🌆 Ambient Glow", "✨ Bokeh Falloff", "🌅 Horizon Fill"],
    gradient: "from-blue-950/70 via-zinc-900 to-cyan-950/70",
    border: "border-blue-500/40",
    accentColor: "#3B82F6",
    icon: Sparkles,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <circle cx="40" cy="20" r="12" fill="#60A5FA" opacity="0.3"/>
        <circle cx="80" cy="38" r="18" fill="#93C5FD" opacity="0.2"/>
        <circle cx="140" cy="18" r="14" fill="#3B82F6" opacity="0.3"/>
        <circle cx="195" cy="35" r="10" fill="#93C5FD" opacity="0.4"/>
        <path d="M0 45 Q 120 30, 240 45 V 60 H 0 Z" fill="#1E3A8A" opacity="0.5"/>
      </svg>
    )
  },

  backgroundColorTag: {
    title: "Backdrop Palette & Mood",
    quote: "Select background environment hues that elevate hero contrast and enrich world texture.",
    badges: ["🖼️ Backdrop Palette", "🌿 Earthy Tones", "🌌 Depth Separation"],
    gradient: "from-emerald-950/70 via-zinc-900 to-teal-950/70",
    border: "border-emerald-500/40",
    accentColor: "#10B981",
    icon: Image,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <rect x="20" y="10" width="200" height="40" rx="6" fill="#064E3B" stroke="#10B981" strokeWidth="1"/>
        <path d="M20 40 L60 20 L100 35 L140 15 L180 40 H20 Z" fill="#047857" opacity="0.6"/>
        <circle cx="180" cy="20" r="6" fill="#34D399" opacity="0.8"/>
      </svg>
    )
  },

  subjectBlockingTag: {
    title: "Spatial Staging & Actor Vectors",
    quote: "Map character positions, physical entry points & dynamic spatial relationships across the set.",
    badges: ["🚶 Actor Path", "📍 Spatial Staging", "🔄 Choreographed Flow"],
    gradient: "from-teal-950/70 via-zinc-900 to-emerald-950/70",
    border: "border-teal-500/40",
    accentColor: "#14B8A6",
    icon: Move,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <circle cx="40" cy="30" r="8" stroke="#14B8A6" strokeWidth="2" fill="#0F766E"/>
        <path d="M48 30 H180" stroke="#14B8A6" strokeWidth="1.5" strokeDasharray="4 2"/>
        <polygon points="185,30 175,25 175,35" fill="#14B8A6"/>
        <circle cx="120" cy="30" r="5" fill="#2DD4BF"/>
        <circle cx="185" cy="30" r="8" stroke="#14B8A6" strokeWidth="2" fill="#0F766E"/>
      </svg>
    )
  },

  lensApertureTag: {
    title: "Optical Field & Bokeh Blur",
    quote: "Fine-tune focal length compression, shallow depth of field & creamy background bokeh.",
    badges: ["📷 35mm Prime", "✨ f/1.4 Aperture", "🔍 Optical Depth"],
    gradient: "from-indigo-950/70 via-zinc-900 to-purple-950/70",
    border: "border-indigo-500/40",
    accentColor: "#6366F1",
    icon: Eye,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <circle cx="120" cy="30" r="22" stroke="#6366F1" strokeWidth="2" fill="#1E1B4B"/>
        <polygon points="120,12 135,22 130,38 110,38 105,22" stroke="#818CF8" strokeWidth="1.5" fill="none"/>
        <circle cx="120" cy="30" r="6" fill="#A5B4FC"/>
      </svg>
    )
  },

  atmosphereVolumetricTag: {
    title: "Volumetric Air & Particulates",
    quote: "Sculpt 3D atmospheric volume using God rays, divine dust motes, haze & smoke physics.",
    badges: ["🌫️ God Rays", "✨ Dust Motes", "💨 Volumetric Haze"],
    gradient: "from-slate-900 via-zinc-950 to-cyan-950/80",
    border: "border-slate-400/40",
    accentColor: "#94A3B8",
    icon: Wind,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M10 10 L 230 50" stroke="#CBD5E1" strokeWidth="15" opacity="0.15"/>
        <path d="M50 5 L 210 55" stroke="#CBD5E1" strokeWidth="8" opacity="0.2"/>
        <circle cx="60" cy="20" r="1.5" fill="#E2E8F0"/>
        <circle cx="110" cy="35" r="2" fill="#E2E8F0"/>
        <circle cx="170" cy="25" r="1" fill="#E2E8F0"/>
        <circle cx="140" cy="45" r="2.5" fill="#E2E8F0"/>
      </svg>
    )
  },

  timeOfDayWeatherTag: {
    title: "Temporal Mood & Weather FX",
    quote: "Set environmental time & weather from golden hour warmth to stormy atmospheric rain.",
    badges: ["🌅 Golden Hour", "🌧️ Monsoon Rain", "🌙 Twilight Glow"],
    gradient: "from-amber-950/80 via-zinc-900 to-sky-950/70",
    border: "border-amber-400/40",
    accentColor: "#F59E0B",
    icon: CloudRain,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M40 30 A15 15 0 0 1 70 30 A12 12 0 0 1 90 35 H30 Z" fill="#38BDF8" opacity="0.6"/>
        <line x1="45" y1="42" x2="40" y2="52" stroke="#38BDF8" strokeWidth="1.5"/>
        <line x1="60" y1="42" x2="55" y2="52" stroke="#38BDF8" strokeWidth="1.5"/>
        <line x1="75" y1="42" x2="70" y2="52" stroke="#38BDF8" strokeWidth="1.5"/>
        <circle cx="170" cy="25" r="14" fill="#F59E0B" opacity="0.8"/>
        <line x1="170" y1="5" x2="170" y2="0" stroke="#FBBF24" strokeWidth="2"/>
        <line x1="190" y1="25" x2="198" y2="25" stroke="#FBBF24" strokeWidth="2"/>
      </svg>
    )
  },

  filmGrainTextureTag: {
    title: "Analog Texture & Shutter Physics",
    quote: "Infuse organic 35mm film grain micro-noise and 180-degree natural shutter motion blur.",
    badges: ["🎞️ Kodak 35mm", "🌀 180° Shutter", "📽️ Vintage Texture"],
    gradient: "from-amber-950/60 via-zinc-900 to-stone-900",
    border: "border-amber-700/40",
    accentColor: "#D97706",
    icon: Film,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <rect x="20" y="10" width="200" height="40" fill="#1C1917" stroke="#D97706" strokeWidth="1.5"/>
        <rect x="25" y="14" width="8" height="6" fill="#F59E0B"/>
        <rect x="25" y="40" width="8" height="6" fill="#F59E0B"/>
        <rect x="65" y="14" width="8" height="6" fill="#F59E0B"/>
        <rect x="65" y="40" width="8" height="6" fill="#F59E0B"/>
        <rect x="105" y="14" width="8" height="6" fill="#F59E0B"/>
        <rect x="105" y="40" width="8" height="6" fill="#F59E0B"/>
        <rect x="145" y="14" width="8" height="6" fill="#F59E0B"/>
        <rect x="145" y="40" width="8" height="6" fill="#F59E0B"/>
        <rect x="185" y="14" width="8" height="6" fill="#F59E0B"/>
        <rect x="185" y="40" width="8" height="6" fill="#F59E0B"/>
      </svg>
    )
  },

  actionEnvContext: {
    title: "High Dynamic Action & Environmental Impact",
    quote: "Inject high-octane visceral energy with physical debris, dust explosions & shockwaves.",
    badges: ["💥 High Impact", "💨 Particle Debris", "🔥 Dynamic Action"],
    gradient: "from-red-950/80 via-zinc-900 to-orange-950/70",
    border: "border-red-500/40",
    accentColor: "#EF4444",
    icon: Zap,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M120 5 L90 32 H125 L105 55 L150 25 H115 L135 5 Z" fill="#EF4444"/>
        <circle cx="50" cy="40" r="3" fill="#F87171"/>
        <circle cx="180" cy="20" r="4" fill="#F87171"/>
        <circle cx="200" cy="45" r="2" fill="#F87171"/>
      </svg>
    )
  },

  characterIdAssetRef: {
    title: "Hero Character & Asset Consistency",
    quote: "Anchor character identity, facial symmetry, costume traits & hero continuity.",
    badges: ["👤 Character Identity", "✨ Hero Model", "🔒 Asset Lock"],
    gradient: "from-cyan-950/80 via-zinc-900 to-blue-950/70",
    border: "border-cyan-400/40",
    accentColor: "#22D3EE",
    icon: User,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <circle cx="120" cy="22" r="12" fill="#22D3EE" opacity="0.8"/>
        <path d="M95 50 C95 38, 145 38, 145 50 Z" fill="#0891B2"/>
        <circle cx="120" cy="30" r="25" stroke="#22D3EE" strokeWidth="1" strokeDasharray="3 3"/>
      </svg>
    )
  },

  shotDurationAndImages: {
    title: "Timing & Multi-Keyframe Reference",
    quote: "Sequence frame duration, multi-image reference slots & precise temporal rhythm.",
    badges: ["⏱️ 5.0s Duration", "🖼️ Keyframe Sync", "📊 Frame Rate"],
    gradient: "from-purple-950/80 via-zinc-900 to-indigo-950/70",
    border: "border-purple-400/40",
    accentColor: "#C084FC",
    icon: Clock,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <rect x="30" y="18" width="180" height="24" rx="12" fill="#18181B" stroke="#C084FC" strokeWidth="1.5"/>
        <circle cx="70" cy="30" r="8" fill="#C084FC"/>
        <line x1="70" y1="30" x2="160" y2="30" stroke="#C084FC" strokeWidth="2"/>
        <circle cx="160" cy="30" r="8" fill="#E9D5FF"/>
      </svg>
    )
  },

  costumeWardrobe: {
    title: "Period Costume & Textile Styling",
    quote: "Detail handloom fabrics, period embroidery, vintage dhotis & authentic character attire.",
    badges: ["👗 Handloom Weave", "🧵 Period Textile", "✨ Authentic Styling"],
    gradient: "from-amber-950/80 via-zinc-900 to-rose-950/70",
    border: "border-amber-500/40",
    accentColor: "#F59E0B",
    icon: Shirt,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M90 15 L120 25 L150 15 L170 25 L155 50 H85 L70 25 Z" fill="#78350F" stroke="#F59E0B" strokeWidth="1.5"/>
        <line x1="120" y1="25" x2="120" y2="50" stroke="#FDE68A" strokeWidth="1.5" strokeDasharray="3 2"/>
      </svg>
    )
  },

  vfxCgiPass: {
    title: "Digital VFX & Particle Pass",
    quote: "Layer CGI particle passes, holographic meshes, elemental magic & optical composites.",
    badges: ["🎆 CGI Particles", "🔮 Optical VFX", "🖥️ Composite Pass"],
    gradient: "from-violet-950/80 via-zinc-900 to-fuchsia-950/70",
    border: "border-violet-400/40",
    accentColor: "#A78BFA",
    icon: Wand2,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <polygon points="120,8 126,22 140,22 128,30 132,44 120,35 108,44 112,30 100,22 114,22" fill="#A78BFA"/>
        <circle cx="60" cy="20" r="3" fill="#DDD6FE"/>
        <circle cx="180" cy="40" r="4" fill="#DDD6FE"/>
      </svg>
    )
  },

  soundAudioStem: {
    title: "Acoustic Landscape & Foley Stems",
    quote: "Compose immersive foley impacts, environmental soundscapes & emotional score stems.",
    badges: ["🎵 Audio Waveform", "🔊 Foley Impact", "🎼 Ambient Stem"],
    gradient: "from-cyan-950/80 via-zinc-900 to-emerald-950/70",
    border: "border-cyan-400/40",
    accentColor: "#22D3EE",
    icon: Volume2,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <line x1="30" y1="30" x2="30" y2="30" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="50" y1="20" x2="50" y2="40" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="70" y1="10" x2="70" y2="50" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="90" y1="22" x2="90" y2="38" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="110" y1="5" x2="110" y2="55" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="130" y1="18" x2="130" y2="42" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="150" y1="8" x2="150" y2="52" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="170" y1="25" x2="170" y2="35" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="190" y1="15" x2="190" y2="45" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
        <line x1="210" y1="28" x2="210" y2="32" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    )
  },

  colorGradeLut: {
    title: "Cinematic Color Grade & LUT",
    quote: "Apply 3D LUT color science, shadow crush & teal-and-orange cinematic tone curves.",
    badges: ["🔴 Teal & Orange", "📊 Tone Curve", "🎨 3D LUT Grade"],
    gradient: "from-rose-950/80 via-zinc-900 to-orange-950/70",
    border: "border-rose-400/40",
    accentColor: "#FB7185",
    icon: Sliders,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M20 50 Q 80 50, 120 30 T 220 10" stroke="#FB7185" strokeWidth="2.5" fill="none"/>
        <circle cx="120" cy="30" r="5" fill="#FDA4AF"/>
        <rect x="20" y="10" width="200" height="40" stroke="#FB7185" strokeWidth="1" strokeDasharray="2 2" fill="none"/>
      </svg>
    )
  },

  stuntChoreography: {
    title: "Combat Vector & Action Rigging",
    quote: "Design martial combat trajectories, wirework stunt rigs & visceral impact timing.",
    badges: ["⚔️ Fight Motion", "🛡️ Stunt Rigging", "💥 Impact Timing"],
    gradient: "from-red-950/80 via-zinc-900 to-amber-950/70",
    border: "border-red-500/40",
    accentColor: "#F87171",
    icon: ShieldAlert,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M80 15 L120 45 L160 15" stroke="#F87171" strokeWidth="3" fill="none"/>
        <circle cx="120" cy="45" r="6" fill="#EF4444"/>
        <line x1="60" y1="30" x2="180" y2="30" stroke="#F87171" strokeWidth="1.5" strokeDasharray="4 2"/>
      </svg>
    )
  },

  setProductionDesign: {
    title: "World Architecture & Set Build",
    quote: "Construct physical environment architecture, rural tile homes & period world builds.",
    badges: ["🏛️ Set Architecture", "📐 Blueprint Build", "🌾 Period World"],
    gradient: "from-amber-950/80 via-zinc-900 to-orange-950/70",
    border: "border-amber-600/40",
    accentColor: "#D97706",
    icon: Building2,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M60 45 V 20 L 120 10 L 180 20 V 45 Z" fill="#78350F" stroke="#F59E0B" strokeWidth="1.5"/>
        <rect x="105" y="30" width="30" height="15" fill="#FEF3C7"/>
      </svg>
    )
  },

  propsKeyObjects: {
    title: "Hero Artifacts & Key Props",
    quote: "Detail hero story objects, polished rooster fight spurs, antique lanterns & key artifacts.",
    badges: ["🗡️ Hero Weapon", "📜 Story Artifact", "🔍 Prop Detail"],
    gradient: "from-yellow-950/80 via-zinc-900 to-amber-950/70",
    border: "border-yellow-500/40",
    accentColor: "#EAB308",
    icon: Shield,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <polygon points="120,10 135,25 120,50 105,25" fill="#EAB308" opacity="0.8"/>
        <line x1="120" y1="50" x2="120" y2="58" stroke="#CA8A04" strokeWidth="3"/>
      </svg>
    )
  },

  makeupHairProsthetics: {
    title: "Character Grooming & Prosthetic FX",
    quote: "Craft sun-tanned skin textures, divine saffron tilak, wound scratches & period hairstyles.",
    badges: ["💄 Prosthetics", "✨ Character SFX", "🪒 Grooming Detail"],
    gradient: "from-rose-950/80 via-zinc-900 to-pink-950/70",
    border: "border-rose-400/40",
    accentColor: "#FB7185",
    icon: Scissors,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <path d="M100 20 Q 120 5, 140 20 Q 150 35, 120 50 Q 90 35, 100 20 Z" fill="#FB7185" opacity="0.7"/>
        <circle cx="120" cy="25" r="4" fill="#FFE4E6"/>
      </svg>
    )
  },

  aspectRatioFormat: {
    title: "Theatrical Scope & Delivery Format",
    quote: "Compose within exact theatrical 2.39:1 anamorphic crop bounds & delivery specs.",
    badges: ["📺 2.39:1 Scope", "🎞️ Anamorphic", "📐 Cinema Format"],
    gradient: "from-cyan-950/80 via-zinc-900 to-slate-900",
    border: "border-cyan-400/40",
    accentColor: "#22D3EE",
    icon: Monitor,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <rect x="20" y="12" width="200" height="36" rx="4" fill="#09090B" stroke="#22D3EE" strokeWidth="1.5"/>
        <line x1="20" y1="18" x2="220" y2="18" stroke="#EF4444" strokeWidth="0.8" strokeDasharray="3 3"/>
        <line x1="20" y1="42" x2="220" y2="42" stroke="#EF4444" strokeWidth="0.8" strokeDasharray="3 3"/>
      </svg>
    )
  },

  multiModalMediaAssets: {
    title: "Multi-Modal Vault & Media Input Slots",
    quote: "Bind reference images, video clips & audio stems to fuel AI multimodal generation.",
    badges: ["📂 Media Vault", "🖼️ Image Inputs", "🎬 Video & Audio"],
    gradient: "from-purple-950/80 via-zinc-900 to-indigo-950/70",
    border: "border-purple-400/40",
    accentColor: "#A855F7",
    icon: FolderKanban,
    renderGraphic: () => (
      <svg className="w-full h-16 opacity-90" viewBox="0 0 240 60" fill="none">
        <rect x="30" y="15" width="45" height="30" rx="4" fill="#581C87" stroke="#A855F7" strokeWidth="1"/>
        <rect x="97.5" y="15" width="45" height="30" rx="4" fill="#581C87" stroke="#A855F7" strokeWidth="1"/>
        <rect x="165" y="15" width="45" height="30" rx="4" fill="#581C87" stroke="#A855F7" strokeWidth="1"/>
        <circle cx="52.5" cy="30" r="6" fill="#C084FC"/>
        <circle cx="120" cy="30" r="6" fill="#C084FC"/>
        <circle cx="187.5" cy="30" r="6" fill="#C084FC"/>
      </svg>
    )
  }
};
