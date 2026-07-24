// ==========================================
// DYNAMIC SCRIPT-AWARE PRESET ENGINE
// ==========================================

export const GENRE_PRESET_PROFILES = {
  mythological: {
    label: "🕉️ Indian Mythology & Period Epic",
    name: "🕉️ Indian Mythology & Period Epic",
    description: "Tailored for Ramayana, Mahabharata, Ayodhya, Royal Palaces, Ancient Legends & Historical Epics",
    presets: {
      characterIdAssetRef: [
        "[CharID: @LeadHero_Rama - Prince of Ayodhya, saffron robes, divine bow]",
        "[CharID: @Hero_Lakshmana - Royal warrior brother with quiver & sword]",
        "[CharID: @Princess_Sita - Royal princess with lotus garland & silk saree]",
        "[CharID: @King_Dasharatha - Sovereign monarch seated on golden throne]",
        "[CharID: @Sage_Vashistha - Revered guru with sacred beads & wooden staff]",
        "[CharID: @Hanuman_Devotee - Mighty warrior with golden armor & mace]"
      ],
      coArtistInteraction: [
        "[Co-Artist: Flanked by Lakshmana holding divine weapons in readiness]",
        "[Co-Artist: Princess Sita watching with admiration from the royal dais]",
        "[Co-Artist: Royal court attendants bowing with folded hands]",
        "[Co-Artist: Sage Vashistha raising hand to bestow divine blessings]",
        "[Co-Artist: Citizens of Ayodhya cheering with shower of flower petals]"
      ],
      actionEnvContext: [
        "Grand palace balcony of Ayodhya overlooking decorated courtyards and joyful crowds.",
        "Dense Panchavati forest with sunbeams piercing through ancient banyan trees and river stream.",
        "Standing before the massive iron platform holding the heavy divine bow Pinaka at Shiva altar.",
        "Royal assembly hall with carved stone pillars, burning brass diya lamps, and silk banners.",
        "Sacred hermitage on the banks of river Sarayu during serene morning twilight."
      ],
      characterExpression: [
        "Serene, regal, and deeply compassionate smile with effortless confidence",
        "Reverence mixed with majestic grace and divine focus",
        "Intense warrior determination with steady righteous gaze",
        "Gently smiling with warm humility towards the elder sages",
        "Awe-struck admiration and quiet devotion"
      ],
      characterPlacement: [
        "Center-stage frame right offset before the iron altar",
        "Rule of thirds left, hero positioned prominently in foreground",
        "Standing at royal balcony edge commanding full frame presence",
        "Seated on carved wooden dais surrounded by court ministers"
      ],
      characterDialogue: [
        '"With your blessings, my Master, I shall lift this sacred bow."',
        '"Dharma guides every breath of Ayodhya."',
        '"Truth alone prevails in the court of righteousness."',
        '"I am ready to serve the divine duty bestowed upon me."'
      ],
      characterMovement: [
        "Bows deeply towards sages, then steps forward with measured regal stride to grasp the bow",
        "Lifting heavy divine bow with effortless grace and drawing the bowstring back smoothly",
        "Folding hands in respectful Namaskar greeting to the assembled elders",
        "Unsheathing sword with calm swift motion, holding stance steady",
        "Turning head slowly towards the gathering crowd, arms open in blessing"
      ],
      characterEyeLooks: [
        "[Eye Look: Looking up with reverence towards the divine heavens]",
        "[Eye Look: Direct eye contact with Princess Sita seated at royal dais]",
        "[Eye Look: Focused gaze on the center of the iron bow string]",
        "[Eye Look: Scanning the royal assembly with calm compassionate eyes]"
      ],
      subjectLightingTag: [
        "[Lighting: Volumetric Divine Solar Sunbeams through Temple Columns]",
        "[Lighting: Golden Brass Diya Lamp Warm Ambient Glow]",
        "[Lighting: Royal Sunset Horizon Rim Light on Saffron Robes]",
        "[Lighting: Dramatic Top-Down Spotlight on Bow and Hero]"
      ],
      subjectColorTag: [
        "[Subject Color: Royal Saffron & Imperial Gold Accent]",
        "[Subject Color: Sandalwood Brown & Terracotta Sandstone]",
        "[Subject Color: Deep Emerald Green & Silk Ivory White]",
        "[Subject Color: Muted Earthy Brown and Saffron Robes]"
      ],
      backgroundLightingTag: [
        "[BG Lighting: Silhouetted Royal Crowd under Low Background Light]",
        "[BG Lighting: Warm Oil Lamp Glow in Ancient Stone Corridor]",
        "[BG Lighting: Soft Bokeh Golden Hour Sunlight through Forest Canopy]",
        "[BG Lighting: Deep Shadow Forest with Piercing Sunbeams]"
      ],
      backgroundColorTag: [
        "[BG Color: Dark Violet and Deep Mahogany Wood Tones]",
        "[BG Color: Ancient Sandstone Orange & Temple Gold]",
        "[BG Color: Emerald Green and Mossy Dark Brown]",
        "[BG Color: Deep Midnight Blue & Temple Ochre]"
      ]
    }
  },

  cyberpunk: {
    label: "🎸 Cyberpunk & Stage Performance",
    description: "Tailored for Concerts, Cyberpunk Cities, Music Videos & Rock Shows",
    presets: {
      characterIdAssetRef: [
        "[CharID: @LeadSinger_Aria - Vocalist, leather jacket, neon cybervisor]",
        "[CharID: @Guitarist_Leo - Lead guitarist, body tattoo, holographic guitar]",
        "[CharID: @Drummer_Jax - Percussionist with cybernetic arms]",
        "[CharID: @Bassist_Kira - Bassist in glowing neon trench coat]"
      ],
      coArtistInteraction: [
        "[Co-Artist: Co-singer stepping up to microphone for harmonized duet reaction]",
        "[Co-Artist: Guitarist leaning back-to-back with lead vocalist]",
        "[Co-Artist: Crowd throwing hands in the air under strobing lasers]"
      ],
      actionEnvContext: [
        "Underground cybernetics music venue, flickering blue neon lights, packed energetic crowd.",
        "Rooftop stage overlooking futuristic rain-slick neon megacity skyline at midnight.",
        "Laser-lit arena stage with smoke machines and pyrotechnic spark fountains."
      ],
      characterExpression: [
        "Exuberant smile, laughing mid-performance while making eye contact",
        "Raw passionate vocal exertion with eyes closed in intense emotion",
        "Fierce cyberpunk swagger with confident smirk"
      ],
      characterMovement: [
        "Grasping microphone stand with both hands and leaning forward with intense energy",
        "Spinning around smoothly while raising right hand towards the audience",
        "Jumping down from stage riser onto main floor in sync with drum drop",
        "Striking a powerful guitar bend pose, body angled 45 degrees"
      ],
      subjectLightingTag: [
        "[Lighting: Cyberpunk Neon Blue & Pink Dual Glow]",
        "[Lighting: Strobing Concert Laser Beams]",
        "[Lighting: High-Contrast Chiaroscuro Stage Spotlight]"
      ],
      subjectColorTag: [
        "[Subject Color: High-Saturation Neo-Noir]",
        "[Subject Color: Cyan & Magenta Neon Palette]",
        "[Subject Color: Ultraviolet Glow Accent]"
      ]
    }
  },

  scifi: {
    label: "🚀 Sci-Fi & Space Opera",
    description: "Tailored for Starships, Holograms, Alien Worlds & Advanced Tech",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Captain_Vane - Starship commander, exo-suit]",
        "[CharID: @Pilot_Nova - Ace fighter pilot with HUD visor]",
        "[CharID: @AI_Core - Holographic avatar in glowing blue wireframe]"
      ],
      actionEnvContext: [
        "Starship bridge during warp drive jump, starlight trails flashing past reinforced viewscreen.",
        "Alien planet surface under twin purple moons, crystalline monoliths humming with energy.",
        "Zero-gravity maintenance bay with floating repair tools and glowing plasma conduits."
      ],
      characterMovement: [
        "Operating holographic control interface with rapid precise finger swipes",
        "Floating weightlessly in zero-gravity while reaching for emergency override lever",
        "Stepping out of hyper-sleep pod with vapor cloud dispersing around armor"
      ],
      subjectLightingTag: [
        "[Lighting: Holographic Blue Interface Projection Glow]",
        "[Lighting: Cold Industrial Starlight Fill]",
        "[Lighting: Warning Red Alarm Flashing Strobe]"
      ]
    }
  },

  action: {
    label: "🕵️ Cinematic Action & Thriller",
    description: "Tailored for Gunfights, Car Chases, Martial Arts & Urban Crime",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Agent_Cross - Field agent in tactical suit]",
        "[CharID: @Detective_Vance - Gritty detective in wet trenchcoat]"
      ],
      actionEnvContext: [
        "Rain-slick urban alleyway at midnight, neon signs reflecting in puddles, steam rising from grates.",
        "High-speed highway chase inside blacked-out armored SUV, bullets cracking glass."
      ],
      characterMovement: [
        "Drawing tactical sidearm with lightning reflex and taking low cover behind concrete pillar",
        "Sprinting across wet rooftop, leaping across narrow building gap into roll landing",
        "Executing swift martial arts parry and counter-strike pivot"
      ],
      subjectLightingTag: [
        "[Lighting: High-Contrast Noir Rim Light]",
        "[Lighting: Sodium Vapor Streetlamp Amber Glow]",
        "[Lighting: Harsh Headlight Beams Cutting Rain]"
      ]
    }
  },

  fantasy: {
    label: "🧙‍♂️ Fantasy & Dark Magic",
    description: "Tailored for High Fantasy, Spellcasting, Mythical Beasts, Enchanted Castles & Wand Sorcery",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Archmage_Eldrin - High sorcerer, glowing rune staff, velvet robes]",
        "[CharID: @Shadow_Knight - Cursed paladin in dark obsidian plate armor]",
        "[CharID: @Elven_Archer - Wood elf ranger with ethereal glowing bow]"
      ],
      coArtistInteraction: [
        "[Co-Artist: Mystic dragon soaring past cloud-capped wizard tower]",
        "[Co-Artist: Sorceress casting counter-charm with glowing blue arc]",
        "[Co-Artist: Ancient stone gargoyles coming to life on castle parapet]"
      ],
      actionEnvContext: [
        "Enchanted misty forest under glowing bioluminescent canopy with floating magic orbs.",
        "Grand citadel library with spiraling spellbooks floating in mid-air and arcane circles.",
        "Dark throne room inside obsidian fortress lit by violet sorcery flames."
      ],
      characterMovement: [
        "Chanting incantation while raising glowing rune staff to channel lightning storm",
        "Drawing ethereal bowstring, creating arc of blue starlight arrows",
        "Levitating gracefully 3 feet off stone floor surrounded by swirling mana energy"
      ],
      subjectLightingTag: [
        "[Lighting: Bioluminescent Arcane Magic Aura & Violet Flame Glow]",
        "[Lighting: Celestial Moonbeam Piercing Castle Stained Glass]",
        "[Lighting: Fiery Dragon Breath Rim Light]"
      ],
      subjectColorTag: [
        "[Subject Color: Deep Amethyst Violet & Radiant Gold Arcane]",
        "[Subject Color: Emerald Forest Green & Luminous Silver]",
        "[Subject Color: Crimson Flame & Obsidian Onyx]"
      ]
    }
  },

  horror: {
    label: "👻 Horror & Supernatural Dread",
    description: "Tailored for Haunting, Paranormal Entities, Creepy Mansions, Shadows & Jump Scares",
    presets: {
      characterIdAssetRef: [
        "[CharID: @The_Possessed - Pale figure, fractured iris, stained vintage gown]",
        "[CharID: @Investigator_Noah - Paranormal investigator with flickering flashlight]",
        "[CharID: @Shadow_Entity - Looming spectral silhouette with glowing red eyes]"
      ],
      coArtistInteraction: [
        "[Co-Artist: Shadowy phantom creeping behind unconscious victim]",
        "[Co-Artist: Mirror reflection moving independently with sinister smile]",
        "[Co-Artist: Flock of crows bursting from dilapidated attic window]"
      ],
      actionEnvContext: [
        "Decaying Victorian mansion hallway at 3 AM, wallpaper peeling, flickering chandelier.",
        "Fog-drenched graveyard with moss-covered headstones and twisted oak shadows.",
        "Flooded subterranean basement, cold water rippling, distant metallic scratching."
      ],
      characterMovement: [
        "Turning head unnaturally fast 180 degrees towards camera with unblinking stare",
        "Backing away slowly while trembling, flashlight beam shaking violently",
        "Crawling rapidly along ceiling shadows before dropping silently to floor"
      ],
      subjectLightingTag: [
        "[Lighting: Low-Key Chiaroscuro & Single Flickering Candlelight]",
        "[Lighting: Cold Pale Moonlight through Broken Window Grate]",
        "[Lighting: Distorted Green Night-Vision Flashlight Beam]"
      ],
      subjectColorTag: [
        "[Subject Color: Desaturated Sickly Green & Ashen Grey]",
        "[Subject Color: Blood Crimson & Midnight Obsidian]",
        "[Subject Color: Monochromatic High-Contrast Sepia Night]"
      ]
    }
  },

  bollywood: {
    label: "💃 Bollywood & Musical Spectacle",
    description: "Tailored for Grand Wedding Sequences, High-Energy Dance, Holi Colors & Romantic Melodrama",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Lead_Hero - Dashing groom in embroidered sherwani & turban]",
        "[CharID: @Lead_Heroine - Bride in heavy red-gold lehenga & traditional jewelry]",
        "[CharID: @Choreography_Group - Ensemble dancers in vibrant festive attires]"
      ],
      coArtistInteraction: [
        "[Co-Artist: Hero & Heroine performing synchronized spin in shower of Holi gulal colors]",
        "[Co-Artist: 50 background dancers executing high-energy synchronized hook step]",
        "[Co-Artist: Royal family showering golden marigold petals from grand balcony]"
      ],
      actionEnvContext: [
        "Illuminated palace courtyard decorated with thousands of marigold garlands & fairy lights.",
        "Sunlit Rajasthan sand dunes during festive celebration with colorful umbrellas & dhol drums.",
        "Cinematic rain dance set under warm streetlamps with water splashing in slow motion."
      ],
      characterMovement: [
        "Executing energetic 360-degree waist spin while striking expressive Mudra hand pose",
        "Reaching out with open palm in dramatic romantic gesture, dupatta flowing in wind",
        "Striding forward confidently surrounded by troupe, breaking into synchronized dance step"
      ],
      subjectLightingTag: [
        "[Lighting: Warm Festive Golden Marigold Glow & Fairy Lights]",
        "[Lighting: High-Key Celebration Sunburst with Lens Flares]",
        "[Lighting: Dramatic Stage Spotlight with Colored Powder Smoke]"
      ],
      subjectColorTag: [
        "[Subject Color: Vibrant Gulal Magenta, Royal Saffron & Imperial Gold]",
        "[Subject Color: Deep Crimson Red & Peacock Blue Silk]",
        "[Subject Color: Celebration Emerald Green & Turmeric Yellow]"
      ]
    }
  },

  historical: {
    label: "📜 Historical Drama & Period Romance",
    description: "Tailored for Royal Courts, Victorian Palaces, Candlelight Banquets & Regency Romance",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Duke_Sterling - Noble gentleman in tailored velvet tailcoat & cravat]",
        "[CharID: @Duchess_Victoria - Aristocratic lady in silk ballgown & diamond tiara]",
        "[CharID: @Emperor_Alexander - Monarch in gilded dress uniform with medals]"
      ],
      coArtistInteraction: [
        "[Co-Artist: Couples waltzing in synchronized harmony across marble ballroom floor]",
        "[Co-Artist: Butler presenting silver tray with wax-sealed royal letter]",
        "[Co-Artist: High society guests whispering behind lacquered hand fans]"
      ],
      actionEnvContext: [
        "Opulent palace ballroom lit by crystal chandeliers and hundreds of beeswax candles.",
        "Manicured English estate garden with marble fountains, rose arbors, and horse carriages.",
        "Royal library with floor-to-ceiling mahogany bookshelves and roaring stone fireplace."
      ],
      characterMovement: [
        "Curtsying with elegant poise before extending gloved hand for a formal dance",
        "Removing velvet glove slowly while stepping to balcony overlooking estate garden",
        "Writing impassioned letter with feather quill dipping into brass inkwell"
      ],
      subjectLightingTag: [
        "[Lighting: Soft Candlelight Warm Ambience & Chandelier Sparkle]",
        "[Lighting: Golden Hour Sunbeams through High Arch Windows]",
        "[Lighting: Muted Fireplace Hearth Glow in Dark Mahogany Room]"
      ],
      subjectColorTag: [
        "[Subject Color: Regal Navy Blue, Emerald Velvet & Rose Gold]",
        "[Subject Color: Champagne Ivory, Burgundy & Antique Gold]",
        "[Subject Color: Royal Purple Velvet & Pearl White Silk]"
      ]
    }
  },

  racing: {
    label: "🏎️ High-Octane Racing & Supercar Heist",
    description: "Tailored for Supercar Pursuits, Underground Drifts, Neon Night Speed & Vault Robberies",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Street_Racer_Jax - Driver in carbon-fiber helmet & racing suit]",
        "[CharID: @Heist_Master_Vee - Hacker in tactical hoodie with telemetry tablet]",
        "[CharID: @Pursuit_Captain - Police officer in high-speed interceptor vehicle]"
      ],
      coArtistInteraction: [
        "[Co-Artist: Co-driver shouting telemetry angles while checking GPS map]",
        "[Co-Artist: Rival supercar pulling side-by-side at 150 MPH on highway]",
        "[Co-Artist: Pit crew executing 3-second tire swap in smoke-filled pit lane]"
      ],
      actionEnvContext: [
        "Slick asphalt mountain pass hairpin turn at midnight with tire smoke drifting.",
        "Underground multi-story parking garage racing hub with tuned sports cars & neon underglow.",
        "Downtown expressway tunnel with overhead orange lights blurring in high-speed streaks."
      ],
      characterMovement: [
        "Downshifting gear lever aggressively while yanking hydraulic handbrake into 90-degree drift",
        "Stomping throttle pedal to floor as NOS boost ignites blue flames from exhaust",
        "Putting on carbon-fiber helmet and snapping visor shut with decisive click"
      ],
      subjectLightingTag: [
        "[Lighting: Blurring Tunnel Orange Sodium Lights & Headlight Beams]",
        "[Lighting: Neon Underglow Blue & Purple Asphalt Reflection]",
        "[Lighting: Exhaust Nitrous Flame Flash & Brake Rotor Glow]"
      ],
      subjectColorTag: [
        "[Subject Color: Carbon Black, Metallic Chrome & Flame Orange]",
        "[Subject Color: Electric Cyan, Racing Red & Matte Graphite]",
        "[Subject Color: Speed Yellow & Glossy Midnight Blue]"
      ]
    }
  }
};

// ==========================================
// SCRIPT GENRE AUTO-DETECTION
// ==========================================
export function detectScriptGenre(projectTitle = '', shots = []) {
  const combinedText = (projectTitle + ' ' + JSON.stringify(shots)).toLowerCase();

  if (
    combinedText.includes('sreeram') ||
    combinedText.includes('rama') ||
    combinedText.includes('ayodhya') ||
    combinedText.includes('sita') ||
    combinedText.includes('shiva') ||
    combinedText.includes('bow') ||
    combinedText.includes('myth') ||
    combinedText.includes('palace') ||
    combinedText.includes('king') ||
    combinedText.includes('dharma') ||
    combinedText.includes('epic')
  ) {
    return 'mythological';
  }

  if (
    combinedText.includes('magic') ||
    combinedText.includes('dragon') ||
    combinedText.includes('wizard') ||
    combinedText.includes('spell') ||
    combinedText.includes('sorcery') ||
    combinedText.includes('elf')
  ) {
    return 'fantasy';
  }

  if (
    combinedText.includes('ghost') ||
    combinedText.includes('horror') ||
    combinedText.includes('haunted') ||
    combinedText.includes('mansion') ||
    combinedText.includes('shadow') ||
    combinedText.includes('blood')
  ) {
    return 'horror';
  }

  if (
    combinedText.includes('dance') ||
    combinedText.includes('bollywood') ||
    combinedText.includes('wedding') ||
    combinedText.includes('holi') ||
    combinedText.includes('song') ||
    combinedText.includes('music video')
  ) {
    return 'bollywood';
  }

  if (
    combinedText.includes('race') ||
    combinedText.includes('car') ||
    combinedText.includes('drift') ||
    combinedText.includes('speed') ||
    combinedText.includes('heist')
  ) {
    return 'racing';
  }

  if (
    combinedText.includes('space') ||
    combinedText.includes('starship') ||
    combinedText.includes('alien') ||
    combinedText.includes('holo') ||
    combinedText.includes('scifi') ||
    combinedText.includes('orbit')
  ) {
    return 'scifi';
  }

  if (
    combinedText.includes('action') ||
    combinedText.includes('chase') ||
    combinedText.includes('gun') ||
    combinedText.includes('agent') ||
    combinedText.includes('crime') ||
    combinedText.includes('fight')
  ) {
    return 'action';
  }

  return 'mythological';
}

// ==========================================
// BASE 15-SLOT DEFINITIONS (DYNAMICALLY ENRICHED)
// ==========================================
export const SEEDANCE_SLOTS = [
  {
    key: "sceneShotId",
    label: "Scene & Shot ID",
    icon: "Hash",
    description: "Unique scene and shot sequence tag (e.g. SC01_SH01).",
    tipTitle: "Shot Indexing & Scene Hierarchy",
    tip: "Use Scene & Shot ID (e.g. SC01_SH01) to establish strict chronological ordering for video generation pipelines. This keeps render batches organized across scenes.",
    presets: [
      "SC01_SH01", "SC01_SH02", "SC01_SH03", "SC01_SH04", "SC01_SH05",
      "SC02_SH01", "SC02_SH02", "SC02_SH03", "SC03_SH01", "SC03_SH02"
    ]
  },
  {
    key: "shotComposition",
    label: "Shot Framing & Composition",
    icon: "Maximize",
    description: "Camera shot distance, framing scale, and focal angle.",
    tipTitle: "Framing & Aspect Scale",
    tip: "Specify exact lens distance (Close-Up, Medium, Wide, Low Angle) to dictate subject prominence. Framing guides spatial scale and focal depth in generated keyframes.",
    presets: [
      "Extreme Close-Up (ECU)",
      "Close-Up (CU)",
      "Medium Close-Up (MCU)",
      "Medium Shot (MS)",
      "Cowboy Shot (American Shot)",
      "Full Shot (FS)",
      "Wide Shot (WS)",
      "Extreme Wide Shot (EWS)",
      "Over-The-Shoulder (OTS)",
      "Point of View (POV)",
      "Low Angle Hero Shot",
      "High Angle Bird's Eye",
      "Dutch Angle Tilt",
      "Aerial Drone Sweep"
    ]
  },
  {
    key: "cameraMotionTag",
    label: "Camera Motion Tag",
    icon: "Video",
    description: "Kinetic vector and camera movement dynamics.",
    tipTitle: "Kinetic Camera Dynamics",
    tip: "Define motion vectors (Dolly Push, Whip Pan, Orbit 360, Tracking) to control camera movement speed and direction, maintaining cinematic flow across transitions.",
    presets: [
      "[Camera: Static Anchor]",
      "[Camera: Slow Pan Right]",
      "[Camera: Slow Pan Left]",
      "[Camera: Fast Whip Pan Right]",
      "[Camera: Tilt Up slowly]",
      "[Camera: Tilt Down reveal]",
      "[Camera: Push In / Slow Dolly Zoom]",
      "[Camera: Pull Back / Reveal Shot]",
      "[Camera: Tracking Shot / Steadicam Follow]",
      "[Camera: Orbiting 360 around subject]",
      "[Camera: Handheld Visceral Shake]",
      "[Camera: FPV High-Speed Drone Dive]",
      "[Camera: Crash Zoom in on eyes]",
      "[Camera: Parallax Arc Left to Right]"
    ]
  },
  {
    key: "subjectLightingTag",
    label: "Subject Lighting Tag",
    icon: "Sun",
    description: "Key, fill, and rim lighting setup focused on the primary performing artist.",
    tipTitle: "Subject Key Lighting",
    tip: "Set key, fill, and rim lighting setups (Volumetric Solar, Chiaroscuro, Neon Glow) to isolate the primary artist with high visual contrast and dimensional pop.",
    presets: [
      "[Lighting: Volumetric Divine Solar Sunbeams]",
      "[Lighting: Golden Temple Diya Lamp Warm Glow]",
      "[Lighting: Rembrandt 3-Point Classic]",
      "[Lighting: Soft Diffused Window Light]",
      "[Lighting: High-Contrast Chiaroscuro Noir]",
      "[Lighting: Warm Golden Hour Rim Light]",
      "[Lighting: Cyberpunk Neon Blue & Pink Dual Glow]",
      "[Lighting: Eerie Under-Lighting Silhouette]"
    ]
  },
  {
    key: "subjectColorTag",
    label: "Subject Color Tag",
    icon: "Palette",
    description: "Color palette and tone grade applied to the primary artist.",
    tipTitle: "Subject Color Palette",
    tip: "Apply tailored color grades (Saffron & Gold, Teal & Orange, Neo-Noir) to establish the hero color identity and separate the performer from the background.",
    presets: [
      "[Subject Color: Royal Saffron & Imperial Gold]",
      "[Subject Color: Sandalwood Brown & Terracotta]",
      "[Subject Color: Deep Emerald Green & Silk Ivory]",
      "[Subject Color: Teal & Orange Cinema Palette]",
      "[Subject Color: Monochromatic Charcoal & Silver]",
      "[Subject Color: High-Saturation Neo-Noir]",
      "[Subject Color: Sepia Warm Nostalgia]"
    ]
  },
  {
    key: "backgroundLightingTag",
    label: "Background Lighting Tag",
    icon: "SunDim",
    description: "Atmospheric environment lighting and background depth illumination.",
    tipTitle: "Atmospheric Depth Lighting",
    tip: "Configure environmental and background depth lighting (Bokeh Sunlight, Oil Lamp Glow, Fog Haze) to create rich foreground-to-background separation.",
    presets: [
      "[BG Lighting: Silhouetted Royal Crowd under Low Background Light]",
      "[BG Lighting: Warm Oil Lamp Glow in Ancient Stone Corridor]",
      "[BG Lighting: Soft Bokeh Golden Hour Sunlight through Forest Canopy]",
      "[BG Lighting: Volumetric Sunlight Haze through Columns]",
      "[BG Lighting: Cold Industrial Fluorescent Strip]"
    ]
  },
  {
    key: "backgroundColorTag",
    label: "Background Color Tag",
    icon: "Layers",
    description: "Color palette of the background environment and set design.",
    tipTitle: "Environment Color Tone",
    tip: "Choose complementary background color hues (Midnight Blue, Sandstone Orange, Deep Mahogany) to harmonize set design with the subject's color palette.",
    presets: [
      "[BG Color: Dark Violet and Deep Mahogany Wood Tones]",
      "[BG Color: Ancient Sandstone Orange & Temple Gold]",
      "[BG Color: Emerald Green and Mossy Dark Brown]",
      "[BG Color: Deep Midnight Blue & Temple Ochre]",
      "[BG Color: Terracotta Sandstone and Warm Ivory]"
    ]
  },
  {
    key: "characterIdAssetRef",
    label: "Main Performing Artist ID",
    icon: "User",
    description: "Primary performer identity tag and outfit specification.",
    tipTitle: "Character Continuity & Outfit",
    tip: "Tag primary character IDs (@LeadHero_Rama, @LeadSinger_Aria) along with signature outfits and props. This locks character appearance consistency across all shots.",
    presets: [
      "[CharID: @LeadHero_Rama - Prince of Ayodhya, saffron robes, divine bow]",
      "[CharID: @Hero_Lakshmana - Royal warrior brother with quiver & sword]",
      "[CharID: @Princess_Sita - Royal princess with lotus garland & silk saree]",
      "[CharID: @King_Dasharatha - Sovereign monarch seated on golden throne]",
      "[CharID: @LeadSinger_Aria - Vocalist, leather jacket, cybervisor]"
    ]
  },
  {
    key: "coArtistInteraction",
    label: "Co-Artist Reaction & Interaction",
    icon: "Users",
    description: "Secondary performers, backing artists, or co-stars and their reaction.",
    tipTitle: "Co-Artist Dynamics",
    tip: "Use the Co-Artist Reaction & Interaction slot to define how backing musicians, dancers, or co-stars react to the main performing artist. This maintains AI continuity for stage energy, eye glances, and call-and-response timing.",
    presets: [
      "[Co-Artist: Flanked by Lakshmana holding divine weapons in readiness]",
      "[Co-Artist: Princess Sita watching with admiration from the royal dais]",
      "[Co-Artist: Royal court attendants bowing with folded hands]",
      "[Co-Artist: Citizens of Ayodhya cheering with shower of flower petals]",
      "[Co-Artist: Co-singer stepping up for harmonized reaction]"
    ]
  },
  {
    key: "actionEnvContext",
    label: "Action & Environment Context",
    icon: "Compass",
    description: "Physical set location, stage environment, and background narrative.",
    tipTitle: "Stage & Environment Setting",
    tip: "Describe the physical venue, architectural setting, and environmental conditions (Ayodhya Palace, Cyberpunk Stage, Panchavati Forest) to anchor world consistency.",
    presets: [
      "Grand palace balcony of Ayodhya overlooking decorated courtyards and joyful crowds.",
      "Dense Panchavati forest with sunbeams piercing through ancient banyan trees and river stream.",
      "Standing before the massive iron platform holding the heavy divine bow Pinaka at Shiva altar.",
      "Royal assembly hall with carved stone pillars, burning brass diya lamps, and silk banners.",
      "Underground cybernetics music venue, flickering blue neon lights, packed energetic crowd."
    ]
  },
  {
    key: "characterExpression",
    label: "Main Artist Expression",
    icon: "Smile",
    description: "Facial emotion, micro-expressions, and eye intent.",
    tipTitle: "Emotional Micro-Expressions",
    tip: "Specify nuanced facial expressions (Serene Confidence, Fierce Determination, Joyful Smile) to guide AI model lip-sync and character emotional resonance.",
    presets: [
      "Serene, regal, and deeply compassionate smile with effortless confidence",
      "Reverence mixed with majestic grace and divine focus",
      "Intense warrior determination with steady righteous gaze",
      "Gently smiling with warm humility towards the elder sages",
      "Exuberant smile, laughing mid-performance while making eye contact"
    ]
  },
  {
    key: "characterPlacement",
    label: "Character Placement",
    icon: "Grid",
    description: "Subject position in frame and spatial relation to co-artists.",
    tipTitle: "Spatial Framing & Grid Position",
    tip: "Position the lead artist within the frame grid (Rule of Thirds, Center Stage, Balcony Edge) to balance character geometry with background elements.",
    presets: [
      "Center-stage frame right offset before the iron altar",
      "Rule of thirds left, hero positioned prominently in foreground",
      "Standing at royal balcony edge commanding full frame presence",
      "Seated on carved wooden dais surrounded by court ministers",
      "Foreground center stage, co-artists positioned in midground left & right"
    ]
  },
  {
    key: "characterDialogue",
    label: "Dialogue & Lip Sync",
    icon: "MessageSquare",
    description: "Spoken line, song lyric, or lip-sync articulation.",
    tipTitle: "Dialogue & Audio Lip-Sync",
    tip: "Provide exact spoken dialogue lines or song lyrics to synchronize mouth movements, jaw cadence, and facial articulation with audio tracks.",
    presets: [
      '"With your blessings, my Master, I shall lift this sacred bow."',
      '"Dharma guides every breath of Ayodhya."',
      '"Truth alone prevails in the court of righteousness."',
      '"I am ready to serve the divine duty bestowed upon me."',
      '"The grid is failing... turn up the amps!"'
    ]
  },
  {
    key: "characterMovement",
    label: "Main Artist Movement",
    icon: "Activity",
    description: "Body posture, physical gesture, or choreography.",
    tipTitle: "Choreography & Motion",
    tip: "Detail physical actions, bodily gestures, and movement speed (Bowing, Unsheathing Sword, Micro-Gestures) to generate fluid, continuous character animation.",
    presets: [
      "Bows deeply towards sages, then steps forward with measured regal stride to grasp the bow",
      "Lifting heavy divine bow with effortless grace and drawing the bowstring back smoothly",
      "Folding hands in respectful Namaskar greeting to the assembled elders",
      "Unsheathing sword with calm swift motion, holding stance steady",
      "Turning head slowly towards the gathering crowd, arms open in blessing",
      "Grasping microphone stand with both hands and leaning forward with intense energy"
    ]
  },
  {
    key: "characterEyeLooks",
    label: "Eye Direction & Look",
    icon: "Eye",
    description: "Gaze vector, eye contact target, or glance direction.",
    tipTitle: "Gaze Vector & Eye Contact",
    tip: "Define exact focal targets (Looking up at heavens, Direct eye contact with co-star, Focused on bow) to lock character gaze direction and intent.",
    presets: [
      "[Eye Look: Looking up with reverence towards the divine heavens]",
      "[Eye Look: Direct eye contact with Princess Sita seated at royal dais]",
      "[Eye Look: Focused gaze on the center of the iron bow string]",
      "[Eye Look: Scanning the royal assembly with calm compassionate eyes]",
      "[Eye Look: Direct Eye Contact with Camera Lens]"
    ]
  }
];

// ==========================================
// DYNAMIC PRESET RESOLVER
// ==========================================
export function getSlotsForGenre(genreKey = 'mythological') {
  const profile = GENRE_PRESET_PROFILES[genreKey] || GENRE_PRESET_PROFILES.mythological;

  return SEEDANCE_SLOTS.map((slot) => {
    const customGenrePresets = profile.presets[slot.key];
    if (customGenrePresets && customGenrePresets.length > 0) {
      return {
        ...slot,
        presets: [...customGenrePresets, ...slot.presets.filter(p => !customGenrePresets.includes(p))]
      };
    }
    return slot;
  });
}

// ==========================================
// PRODUCTION TEMPLATES
// ==========================================
export const PRODUCTION_TEMPLATES = [
  {
    id: "mythological_epic",
    title: "🕉️ Jai Sreeram Ramayana Epic Treatment",
    category: "Mythological Epic",
    description: "Ayodhya royal court, divine bow Pinaka altar, sacred Panchavati forest.",
    shots: [
      {
        sceneShotId: "SC01_SH01",
        shotComposition: "Extreme Wide Shot (EWS)",
        cameraMotionTag: "[Camera: Static Anchor]",
        subjectLightingTag: "[Lighting: Volumetric Divine Solar Sunbeams]",
        subjectColorTag: "[Subject Color: Royal Saffron & Imperial Gold]",
        backgroundLightingTag: "[BG Lighting: Volumetric Sunlight Haze through Columns]",
        backgroundColorTag: "[BG Color: Ancient Sandstone Orange & Temple Gold]",
        characterIdAssetRef: "[CharID: @LeadHero_Rama - Prince of Ayodhya, saffron robes, divine bow]",
        coArtistInteraction: "[Co-Artist: Princess Sita watching with admiration from the royal dais]",
        actionEnvContext: "Grand palace balcony of Ayodhya overlooking decorated courtyards and joyful crowds.",
        characterExpression: "Serene, regal, and deeply compassionate smile with effortless confidence",
        characterPlacement: "Center-stage frame right offset before the iron altar",
        characterDialogue: '"Dharma guides every breath of Ayodhya."',
        characterMovement: "Folding hands in respectful Namaskar greeting to the assembled elders",
        characterEyeLooks: "[Eye Look: Direct eye contact with Princess Sita seated at royal dais]"
      }
    ]
  },
  {
    id: "cyberpunk_concert",
    title: "🎸 Neo-Tokyo Cyberpunk Concert",
    category: "Cyberpunk / Music",
    description: "High-octane concert performance in a rain-soaked futuristic mega-city.",
    shots: [
      {
        sceneShotId: "SC01_SH01",
        shotComposition: "Extreme Close-Up (ECU)",
        cameraMotionTag: "[Camera: Push In / Slow Dolly Zoom]",
        subjectLightingTag: "[Lighting: Cyberpunk Neon Blue & Pink Dual Glow]",
        subjectColorTag: "[Subject Color: High-Saturation Neo-Noir]",
        backgroundLightingTag: "[BG Lighting: Strobing Concert Laser Beams]",
        backgroundColorTag: "[BG Color: Deep Midnight Blue & Indigo]",
        characterIdAssetRef: "[CharID: @LeadSinger_Aria - Vocalist, leather jacket, cybervisor]",
        coArtistInteraction: "[Co-Artist: Co-singer stepping up to microphone for harmonized duet reaction]",
        actionEnvContext: "Underground cybernetics music venue, flickering blue neon lights, packed energetic crowd.",
        characterExpression: "Exuberant smile, laughing mid-performance while making eye contact",
        characterPlacement: "Foreground center stage, co-artists positioned in midground left & right",
        characterDialogue: '"The grid is failing... turn up the amps!"',
        characterMovement: "Grasping microphone stand with both hands and leaning forward with intense energy",
        characterEyeLooks: "[Eye Look: Direct Eye Contact with Camera Lens]"
      }
    ]
  }
];
