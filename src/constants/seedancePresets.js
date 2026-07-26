// ==========================================
// DYNAMIC SCRIPT-AWARE PRESET ENGINE
// ==========================================

export const GENRE_PRESET_PROFILES = {
  konaseema_anthology: {
    label: "🌾 Rural 1980s Konaseema Anthology (East Godavari & Malkipuram)",
    name: "🌾 Rural 1980s Konaseema Anthology (East Godavari & Malkipuram)",
    description: "Tailored for Andhra Pradesh, East Godavari, Konaseema & Malkipuram Village multi-story narratives from year 1980, rural realism, coconut groves & Godavari backwaters.",
    presets: {
      sceneShotId: [
        "SC01_SH01",
        "SC01_SH02",
        "SC02_SH01",
        "SC02_SH02",
        "SC03_SH01",
        "SC03_SH02"
      ],
      shotComposition: [
        "Extreme Wide Shot (EWS)",
        "Establishing Wide Shot (EWS)",
        "Wide Shot (WS)",
        "Medium Shot (MS)",
        "Medium Close-Up (MCU)",
        "Close-Up (CU)",
        "Extreme Close-Up (ECU)",
        "Over-The-Shoulder (OTS)",
        "Low-Angle Close-Up (CU)"
      ],
      cameraMotionTag: [
        "[Camera: Slow Aerial Drone Pan over 1980s Godavari River]",
        "[Camera: Vintage 1980s Steadicam Tracking Follow along Dirt Path]",
        "[Camera: Slow Tilt Up from Clay Rangoli Floor to Village House]",
        "[Camera: Hero Orbit 180 Deg around Vintage Hero Bicycle]",
        "[Camera: Dynamic Handheld Action Pan across Rooster Fight Arena]",
        "[Camera: Macro Focus Push-In on Rooster Leg Knife]"
      ],
      subjectLightingTag: [
        "[Lighting: 1980s Warm Golden Hour Sunbeams through Konaseema Palms]",
        "[Lighting: Incandescent Kerosene Lantern Glow in Village Courtyard]",
        "[Lighting: Diffuse Monsoon Haze over Godavari Canal Backwaters]",
        "[Lighting: Evening Dusk Tea Stall Tungsten Bulb Light at Malkipuram]",
        "[Lighting: Direct High-Sunlight Fill on Red Soil Pathway]"
      ],
      subjectColorTag: [
        "[Subject Color: 1980s Earthy Terracotta & Lush Konaseema Green]",
        "[Subject Color: Vintage Sun-Bleached Cotton White & Saffron Ochre]",
        "[Subject Color: Traditional Handloom Crimson Saree & Paddy Gold]",
        "[Subject Color: Rustic Clay Brick Red & Godavari Azure Blue]"
      ],
      backgroundLightingTag: [
        "[BG Lighting: Glistening Water Reflections on 1980s Godavari Canal]",
        "[BG Lighting: Soft Vintage Amber Bokeh of Malkipuram Street Lamps]",
        "[BG Lighting: Deep Emerald Shadow under 1980s Coconut Canopy]",
        "[BG Lighting: Low Atmospheric Evening Mist over Coastal Paddy Fields]"
      ],
      backgroundColorTag: [
        "[BG Color: 1980s Vintage Kodak Film Warm Grain Palette]",
        "[BG Color: Vibrant Konaseema Palm Green & Canal Water Blue]",
        "[BG Color: Rustic Clay Tile Red & Thatch Straw Gold]",
        "[BG Color: Monsoon Cloud Gray & Dark Earthy Brown]"
      ],
      atmosphereVolumetricsTag: [
        "[Atmosphere: 1980s Golden Dust Motes & Kerosene Smoke Haze]",
        "[Atmosphere: Warm Humid Godavari River Canal Mist]",
        "[Atmosphere: Tea Stall Woodfire Vapor at Malkipuram Dusk]",
        "[Atmosphere: Fresh Monsoon Rain Haze on Red Dirt Ground]"
      ],
      characterIdAssetRef: [
        "[CharID: @VillageElder_Ramaraju - Respected 1980s Konaseema village elder, white dhoti & kanduva]",
        "[CharID: @YoungProtagonist_Suri - Malkipuram 1980s youth in cotton shirt, vintage Hero bicycle]",
        "[CharID: @RoosterOwner_Sunil - Champion rooster owner in traditional lungi & brass amulets]",
        "[CharID: @Weaver_Lakshmi - 1980s Konaseema handloom weaver in traditional cotton saree]",
        "[CharID: @Ferryman_Appanna - Godavari river ferryman with wooden rowing pole]",
        "[CharID: @RoosterChampion_Bujji - Legendary black rooster champion of Malkipuram]",
        "[CharID: @RoosterChallenger_Raju - Fierce unbeaten challenger rooster with white cloth wrap]"
      ],
      coArtistInteraction: [
        "[Co-Artist: 1980s village elders gathered under ancient banyan tree for Panchayat discussion]",
        "[Co-Artist: Cheering crowd of Malkipuram villagers surrounding Sankranti rooster fight ring]",
        "[Co-Artist: Local youth laughing at 1980s tea stall by Godavari canal edge]",
        "[Co-Artist: Village women drawing water from stone well in Malkipuram lane]",
        "[Co-Artist: Fishermen hauling woven nets along Godavari backwaters at dawn]"
      ],
      actionEnvContext: [
        "Lush green 1980s Konaseema coconut orchard with golden sunbeams filtering through palm fronds and red soil dirt path.",
        "Tranquil Godavari canal in Malkipuram village, wooden ferry boat drifting past banana groves.",
        "Traditional 1980s East Godavari courtyard house (Panchayati Veedhi) with clay-tile roof, carved teak pillars, and lotus rangoli.",
        "Sankranti 1980s festival arena in Malkipuram village square packed with cheering crowds and rooster fight rings.",
        "Bustling 1980s Malkipuram village tea stall at dusk with kerosene lamps and vintage radio playing classic songs."
      ],
      characterExpression: [
        "Warm, authentic 1980s rural Telugu smile with deep nostalgic eyes and wisdom",
        "Intense fierce focus during Sankranti rooster fight showdown",
        "Contemplative village gaze looking out over peaceful Godavari backwaters",
        "Gently laughing with innocent 1980s rural joy amidst village festival celebrations",
        "Determined earthy expression with sweat glinting under tropical Konaseema sun"
      ],
      characterPlacement: [
        "Foreground left, leaning against vintage Hero bicycle under coconut palm canopy",
        "Center frame sitting on carved wooden porch bench (Thinnaye) of 1980s courtyard house",
        "Standing at edge of Godavari canal ferry boat with lush palm backdrop",
        "Center ring in low-angle hero stance surrounded by cheering Malkipuram villagers"
      ],
      characterDialogue: [
        '"Mana 1980s Konaseema pachani polalu chooste manasuki prasanthatha vasthundi."',
        '"Malkipuram Sankranti thirunallalo Bujji thoti kodi pandem veyatam ante maamulu vishayam kaadu!"',
        '"Godavari thalliki mokki polaniki velthunnam thambi."',
        '"Raju poyina saari thirunallalo gelichadu, ee sari Bujji-Raju pothee choodali!"',
        '"Ee 1980s Malkipuram oorilo manushula anubandham entha goppado meeku teliyadu."'
      ],
      characterMovement: [
        "Riding vintage Hero bicycle along narrow red dirt path through 1980s Konaseema coconut groves",
        "Rowing wooden ferry boat smoothly across Godavari canal with steady rhythmic strokes",
        "Tying razor-sharp brass knifes onto rooster legs with steady expert hands",
        "Removing white cloth from champion rooster in slow epic reveal motion",
        "Serving warm tea in small glass to village elders on wooden porch bench"
      ],
      characterEyeLooks: [
        "[Eye Look: Looking out thoughtfully across calm Godavari river backwaters]",
        "[Eye Look: Direct intense eye contact with opponent rooster across fight arena]",
        "[Eye Look: Looking up through swaying coconut tree canopy towards 1980s sunlit sky]",
        "[Eye Look: Focused steady gaze on handloom weaving shuttle movement]"
      ],
      shotDurationAndImages: [
        "Duration: 6s | Image_1: @RoosterChampion_Bujji | Image_2: @RoosterChallenger_Raju | Image_3: @MalkipuramArena",
        "Duration: 5s | Image_1: @VillageElder_Ramaraju | Image_2: @1980sCourtyardHouse | Image_3: @TeaStall",
        "Duration: 5s | Image_1: @YoungProtagonist_Suri | Image_2: @VintageBicycle | Image_3: @KonaseemaPalms",
        "Duration: 7s | Image_1: @RoosterOwner_Sunil | Image_2: @Ferryman_Appanna | Image_3: @GodavariCanal"
      ]
    }
  },
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
  },

  spy: {
    label: "🕵️‍♂️ Spy Espionage & Covert Agent Thriller",
    description: "Tailored for Secret Intelligence, Tactical Recon, High-Tech Gadgets & Infiltration Ops",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Agent_Vanguard - Secret agent in tailored tuxedo & earpiece]",
        "[CharID: @Handler_M - MI6 Director in briefing room with glass screens]"
      ],
      actionEnvContext: [
        "High-security embassy gala in Monte Carlo with glass balconies overlooking Mediterranean.",
        "Underground server vault with blue laser grid sensors and cooling vapor."
      ],
      subjectLightingTag: ["[Lighting: Cold Laser Blue & Discreet Tungsten Key]"],
      subjectColorTag: ["[Subject Color: Midnight Tuxedo Black & Steel Silver]"]
    }
  },

  samurai: {
    label: "⚔️ Samurai, Martial Arts & Wuxia Legends",
    description: "Tailored for Katana Sword Duels, Dojo Battles, Bamboo Forest Showdowns & Honor Epics",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Ronin_Kenshin - Master swordsman in traditional hakama with straw hat]",
        "[CharID: @Ninja_Kage - Shadow assassin in black shinobi outfit]"
      ],
      actionEnvContext: [
        "Swaying green bamboo forest during autumn leaves shower with moonlight filtering through.",
        "Traditional Japanese wooden dojo with tatami mats and paper shoji screens."
      ],
      subjectLightingTag: ["[Lighting: Moonlight Silver Sparkle on Katana Steel]"],
      subjectColorTag: ["[Subject Color: Ink Black, Bamboo Green & Autumn Crimson]"]
    }
  },

  western: {
    label: "🤠 Western Frontier & Outlaw Legend",
    description: "Tailored for Saloon Showdowns, Quick-Draw Gunslingers, Red Rock Canyons & Train Robberies",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Outlaw_Colt - Gunslinger in leather duster coat, Stetson hat & revolver]",
        "[CharID: @Sheriff_Wyatt - Frontier lawman with brass star badge]"
      ],
      actionEnvContext: [
        "Sun-bleached dusty main street of frontier town at high noon, tumbleweed rolling past.",
        "Red rock canyon pass with steam train chugging along iron tracks."
      ],
      subjectLightingTag: ["[Lighting: High-Noon Scorching Sunbeam & Heavy Shadow]"],
      subjectColorTag: ["[Subject Color: Dust Ochre, Leather Brown & Sun-Faded Blue]"]
    }
  },

  romance: {
    label: "💔 Romantic Drama & Emotional Melodrama",
    description: "Tailored for Monsoon Rain Romance, Intimate Relationships, Heartbreak & Nostalgic Encounters",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Lover_Kavya - Young woman in handloom pastel saree under umbrella]",
        "[CharID: @Protagonist_Arjun - Artist in linen shirt with sketchpad]"
      ],
      actionEnvContext: [
        "Cozy coffee shop by rain-streaked window overlooking vintage cobblestone street.",
        "Sunset beach shoreline with gentle waves lapping against wet golden sand."
      ],
      subjectLightingTag: ["[Lighting: Soft Diffused Golden Hour Sunset Glow]"],
      subjectColorTag: ["[Subject Color: Soft Pastel Pink, Coral & Cream Ivory]"]
    }
  },

  noir: {
    label: "🏙️ Neo-Noir & Gritty Crime Syndicate",
    description: "Tailored for Underworld Mafia, Wet Rain Pavements, Venetian Blinds & Detective Investigations",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Detective_Marlowe - Hardboiled investigator in trench coat & fedora]",
        "[CharID: @MobBoss_Don - Syndicate leader in pinstripe suit smoking cigar]"
      ],
      actionEnvContext: [
        "Dimly lit detective office at 2 AM with streetlight casting Venetian blind shadows.",
        "Rain-drenched city alleyway with neon sign reflections on wet asphalt."
      ],
      subjectLightingTag: ["[Lighting: High-Contrast Venetian Blind Chiaroscuro]"],
      subjectColorTag: ["[Subject Color: Monochrome Charcoal, Crimson & Neon Cyan]"]
    }
  },

  superhero: {
    label: "🦸 Superhero & Comic Book VFX Epic",
    description: "Tailored for Superhuman Powers, Skyscraper City Battles, VFX Energy Beams & Heroic Capes",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Hero_Titan - Superhero in armored suit with glowing chest emblem]",
        "[CharID: @Villain_Malakor - Alien warlord in obsidian battle armor]"
      ],
      actionEnvContext: [
        "Skyscraper rooftop looking over metropolis under alien invasion sky portal.",
        "Destroyed city street with levitating concrete debris and electrical arcs."
      ],
      subjectLightingTag: ["[Lighting: Blinding Energy Beam Flare & Volumetric Lightning]"],
      subjectColorTag: ["[Subject Color: Metallic Gold, Heroic Red & Cobalt Blue]"]
    }
  },

  period_history: {
    label: "📜 Period Historical & Royal Dynasty",
    description: "Tailored for Ancient Empires, Royal Court Intrigues, Silk Standards & Historical Battles",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Emperor_Vikram - Sovereign ruler in embroidered royal silk & jewels]",
        "[CharID: @Commander_Rudra - Armored general holding battle standard]"
      ],
      actionEnvContext: [
        "Grand marble throne room of royal palace lined with burning incense braziers.",
        "Vast grassy battle plain with thousands of armored cavalry units in formation."
      ],
      subjectLightingTag: ["[Lighting: Regal Torchlight Ambience & Gold Leaf Sparkle]"],
      subjectColorTag: ["[Subject Color: Royal Maroon, Imperial Gold & Deep Jade]"]
    }
  },

  surrealist: {
    label: "🎨 Surrealist Cinema & Mind-Bender",
    description: "Tailored for Dreamscapes, Floating Geometry, Mind Traps & Abstract Visual Realities",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Dreamer_Orpheus - Wanderer in velvet coat surrounded by floating clocks]"
      ],
      actionEnvContext: [
        "Infinite mirror hall stretching into optical illusion kaleidoscope.",
        "Surreal desert where giant floating hourglasses spill golden sand upwards."
      ],
      subjectLightingTag: ["[Lighting: Iridescent Prism Flare & Ethereal Bioluminescence]"],
      subjectColorTag: ["[Subject Color: Magenta Prism, Electric Violet & Pearl White]"]
    }
  },

  cosmic_horror: {
    label: "🌌 Cosmic Horror & Dark Mystery",
    description: "Tailored for Lovecraftian Monsters, Deep Abyss, Uncanny Ruins & Eldritch Obelisks",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Scholar_Armitage - Occult researcher holding glowing lantern & ancient book]"
      ],
      actionEnvContext: [
        "Ancient submerged stone temple rising from dark abyssal ocean depths.",
        "Fog-shrouded monolith crater emitting unearthly violet bioluminescence."
      ],
      subjectLightingTag: ["[Lighting: Eerie Eldritch Green & Void Shadow]"],
      subjectColorTag: ["[Subject Color: Abyssal Black, Eldritch Green & Bone White]"]
    }
  },

  sports: {
    label: "⚽ Sports Drama & Athletic Triumph",
    description: "Tailored for Stadium Spectacle, Championship Finals, High-Stakes Matches & Athlete Triumph",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Striker_Kabir - Champion athlete in team jersey #10 with sweat-glistening brow]"
      ],
      actionEnvContext: [
        "Packed 80,000 seat stadium under massive floodlights with roaring fans.",
        "Training gym at sunrise with shadowboxing reflections in sweat-fogged mirrors."
      ],
      subjectLightingTag: ["[Lighting: High-Intensity Stadium Floodlight Flare]"],
      subjectColorTag: ["[Subject Color: Athletic Tricolor Jersey, Turf Green & Floodlight White]"]
    }
  },

  adventure: {
    label: "🏝️ Tropical Adventure & Treasure Hunt",
    description: "Tailored for Jungle Expeditions, Ancient Ruins, Secret Traps & Lost Gold Treasures",
    presets: {
      characterIdAssetRef: [
        "[CharID: @Explorer_Drake - Archaeologist in safari shirt, leather holster & compass]"
      ],
      actionEnvContext: [
        "Overgrown jungle temple entrance draped in vines with sun shafts piercing canopy.",
        "Subterranean treasure chamber filled with gold coins, traps and carved idols."
      ],
      subjectLightingTag: ["[Lighting: Flaming Torch Warm Flickering Glow]"],
      subjectColorTag: ["[Subject Color: Jungle Moss Green, Ancient Gold & Earth Khaki]"]
    }
  }
};

// ==========================================
// SCRIPT GENRE AUTO-DETECTION
// ==========================================
export function detectScriptGenre(projectTitle = '', shots = [], rawScriptText = '') {
  const combinedText = (
    (typeof projectTitle === 'string' ? projectTitle : '') + ' ' + 
    (typeof rawScriptText === 'string' ? rawScriptText : '') + ' ' + 
    JSON.stringify(shots)
  ).toLowerCase();

  // 1. Rural 1980s Konaseema & East Godavari Anthology / Rooster Fight (Highest Priority)
  if (
    combinedText.includes('konaseema') || 
    combinedText.includes('malkipuram') || 
    combinedText.includes('godavari') || 
    combinedText.includes('andhra') || 
    combinedText.includes('east godavari') || 
    combinedText.includes('anthology') || 
    combinedText.includes('1980') ||
    combinedText.includes('rooster') ||
    combinedText.includes('bujji') ||
    combinedText.includes('raju') ||
    combinedText.includes('sunil') ||
    combinedText.includes('samudra') ||
    combinedText.includes('sankranti') ||
    combinedText.includes('cockfight') ||
    combinedText.includes('kkrk')
  ) {
    return 'konaseema_anthology';
  }

  // 2. Indian Mythology & Period Epic
  if (
    combinedText.includes('ayodhya') || 
    combinedText.includes('sita') || 
    combinedText.includes('ramayana') || 
    combinedText.includes('mahabharata') || 
    combinedText.includes('kurukshetra') || 
    combinedText.includes('kara-dhushan') ||
    combinedText.includes('mythological')
  ) {
    return 'mythological';
  }

  if (combinedText.includes('ninja') || combinedText.includes('samurai') || combinedText.includes('katana') || combinedText.includes('dojo') || combinedText.includes('wuxia')) {
    return 'samurai';
  }
  if (combinedText.includes('spy') || combinedText.includes('agent') || combinedText.includes('espionage') || combinedText.includes('embassy') || combinedText.includes('intel')) {
    return 'spy';
  }
  if (combinedText.includes('cowboy') || combinedText.includes('western') || combinedText.includes('saloon') || combinedText.includes('sheriff') || combinedText.includes('gunslinger')) {
    return 'western';
  }
  if (combinedText.includes('romance') || combinedText.includes('love') || combinedText.includes('heartbreak') || combinedText.includes('rain romance') || combinedText.includes('romantic')) {
    return 'romance';
  }
  if (combinedText.includes('noir') || combinedText.includes('detective') || combinedText.includes('mafia') || combinedText.includes('underworld') || combinedText.includes('crime')) {
    return 'noir';
  }
  if (combinedText.includes('superhero') || combinedText.includes('powers') || combinedText.includes('cape') || combinedText.includes('vfx hero')) {
    return 'superhero';
  }
  if (combinedText.includes('magic') || combinedText.includes('dragon') || combinedText.includes('wizard') || combinedText.includes('sorcery') || combinedText.includes('fantasy')) {
    return 'fantasy';
  }
  if (combinedText.includes('ghost') || combinedText.includes('horror') || combinedText.includes('haunted') || combinedText.includes('vampire') || combinedText.includes('dread')) {
    return 'horror';
  }
  if (combinedText.includes('dance') || combinedText.includes('bollywood') || combinedText.includes('wedding') || combinedText.includes('holi') || combinedText.includes('sangeet')) {
    return 'bollywood';
  }
  if (combinedText.includes('race') || combinedText.includes('car') || combinedText.includes('drift') || combinedText.includes('speed') || combinedText.includes('supercar')) {
    return 'racing';
  }
  if (combinedText.includes('space') || combinedText.includes('starship') || combinedText.includes('alien') || combinedText.includes('scifi')) {
    return 'scifi';
  }
  if (combinedText.includes('sports') || combinedText.includes('match') || combinedText.includes('stadium') || combinedText.includes('strikers')) {
    return 'sports';
  }
  if (combinedText.includes('jungle') || combinedText.includes('treasure') || combinedText.includes('expedition') || combinedText.includes('adventure')) {
    return 'adventure';
  }
  if (combinedText.includes('cyber') || combinedText.includes('cyberpunk') || combinedText.includes('neon') || combinedText.includes('concert')) {
    return 'cyberpunk';
  }

  return 'action';
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
    key: "atmosphereVolumetricsTag",
    label: "Atmosphere & Volumetric Haze",
    icon: "CloudRain",
    description: "Volumetric light shafts, dust motes, embers, rain, or fog physics.",
    tipTitle: "Volumetrics & Particle Physics",
    tip: "Define environmental particle physics (Divine Dust Motes, Incense Smoke, Neon Rain Mist, Floating Embers) to dictate 3D spatial depth and realistic volume falloff.",
    presets: [
      "[Atmosphere: Golden Incense Smoke & Floating Sacred Dust Motes]",
      "[Atmosphere: Volumetric Divine Solar Ray Shafts & Sparkle Flare]",
      "[Atmosphere: Heavy Monsoon Rain & Wet Pavement Reflection Mist]",
      "[Atmosphere: Cyberpunk Neon Vapor & Ground Steam Vents]",
      "[Atmosphere: Fiery Battlefield Smoke & Floating Burning Embers]",
      "[Atmosphere: Dense Paranormal Fog & Creeping Shadow Mist]",
      "[Atmosphere: Zero-Gravity Cosmic Stardust & Plasma Glow]"
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
  },
  {
    key: "shotDurationAndImages",
    label: "⏱️ Duration & Image References (Image 1-9)",
    icon: "Clock",
    description: "Shot length duration & extracted character image references (Image 1 to Image 9).",
    tipTitle: "Shot Duration & 9 Image Reference Bindings",
    tip: "Specify shot duration (e.g., 5s, 10s) and binding tags for up to 9 character/scene image inputs (Image_1: @LeadHero, Image_2: @CoArtist, etc.) for multi-image conditioning.",
    presets: [
      "Duration: 5s | Image_1: @LeadHero_Rama | Image_2: @Princess_Sita | Image_3: @Lakshmana | Image_4: @RoyalPalace_Ayodhya | Image_5: @DivineBow_Pinaka",
      "Duration: 4s | Image_1: @LeadSinger_Aria | Image_2: @Guitarist_Leo | Image_3: @ConcertStage_Neon | Image_4: @Cybervisor_Prop",
      "Duration: 6s | Image_1: @Captain_Vane | Image_2: @Pilot_Nova | Image_3: @StarshipBridge | Image_4: @HoloHUD",
      "Duration: 8s | Image_1: @Agent_Cross | Image_2: @Detective_Vance | Image_3: @RainAlleyway | Image_4: @TacticalSUV"
    ]
  },
  {
    key: "soundFxAndFoley",
    label: "🎵 Craft #18: Sound Design & Foley FX",
    icon: "Volume2",
    description: "Foley sound effects, ambient environmental audio, impact hits, and acoustic cues.",
    tipTitle: "Sound Design & Foley Acoustics",
    tip: "Define environmental acoustic layers (Roaring Village Crowd, Metallic Knife Blade Ringing, Thunder Crack, Neon Synth Hum) to drive audio generation pipelines.",
    presets: [
      "[SFX: Roaring Village Crowd & Rooster Wing Flap Foley]",
      "[SFX: Metallic Blade Ringing & Razor Knife Slash FX]",
      "[SFX: Volumetric Thunder Crack & Heavy Rain Impact]",
      "[SFX: Laser Blast & Cyberpunk Synth Energy Charge]",
      "[SFX: Heavy Horse Hooves & Ancient War Horn Echo]",
      "[SFX: Whispering Wind through Coconut Palms & Canal Water Ripples]"
    ]
  },
  {
    key: "backgroundScoreMood",
    label: "🎼 Craft #19: Music Composition & Original Score",
    icon: "Music",
    description: "Musical score motif, tempo BPM, orchestral instrumentation, and emotional tone.",
    tipTitle: "Music Score & Emotional Motif",
    tip: "Specify musical genre & rhythm (High-Energy Dappu Percussion, Sacred Sanskrit Chants, Synthwave Bassline, Tense String Tremolo) to guide background score generation.",
    presets: [
      "[Score: High-Energy 1980s Folk Drums & Dappu Percussion Rhythms]",
      "[Score: Epic Celestial Orchestral Brass & Sacred Sanskrit Chants]",
      "[Score: Heavy Industrial Cyberpunk Bassline & Synthwave Arpeggio]",
      "[Score: Tense Suspenseful String Tremolo & Low Sub-Bass Drone]",
      "[Score: Nostalgic Acoustic Flute Melody & Warm Guitar Strums]"
    ]
  },
  {
    key: "lensAndFocalLength",
    label: "📷 Craft #20: Camera Lens & Focal Optics",
    icon: "Camera",
    description: "Focal length in mm, lens prime series, anamorphic squeeze, and aperture f-stop.",
    tipTitle: "Camera Lens Optics & Depth Field",
    tip: "Choose exact optical characteristics (35mm Anamorphic Scope, 50mm Master Prime f/1.4, 100mm Macro f/2.8) to govern perspective compression and background bokeh.",
    presets: [
      "35mm Anamorphic Prime (f/1.8) - Deep Cinema Scope",
      "50mm Master Prime (f/1.4) - Shallow Depth Bokeh",
      "85mm Portrait Prime (f/1.2) - Silky Background Separation",
      "24mm Ultra Wide Angle (f/2.8) - Dynamic Environmental Scale",
      "100mm Macro Lens (f/2.8) - Razor Blade Close-Up Detail",
      "70-200mm Telephoto Zoom (f/2.8) - Compressed Action Tracking"
    ]
  },
  {
    key: "vfxCgiBreakdown",
    label: "✨ Craft #21: Visual Effects & CGI Compositing",
    icon: "Sparkles",
    description: "CGI assets, green screen keying, particle FX, and digital matte painting.",
    tipTitle: "VFX & CGI Asset Layering",
    tip: "Tag digital compositing layers (Green Screen Keying, 3D Particle Destruction, Holographic HUD Overlay, Digital Matte Painting) for post-production VFX teams.",
    presets: [
      "[VFX: Practical Shot - 100% In-Camera Live Action]",
      "[VFX: Digital Environment Matte Painting & Sky Replacement]",
      "[VFX: 3D CGI Particle Destruction & Volumetric Smoke Composite]",
      "[VFX: Green Screen Keying & Cyberpunk Hologram Overlay]",
      "[VFX: Slow-Motion 1000fps High-Speed Impact FX]"
    ]
  },
  {
    key: "stuntAndSafetyNotes",
    label: "🛡️ Craft #22: Stunt Rigging & Action Safety",
    icon: "Shield",
    description: "Stunt harness wirework, prop safety weapons, and controlled impact rigging.",
    tipTitle: "Stunt Choreography & Safety Protocols",
    tip: "Document stunt execution parameters (Wire Harness Jump Landing, Rubber Prop Knife, Precision Car Drift, Certified Pyrotechnic Charge) for action sequences.",
    presets: [
      "[Stunt: Safe Handler Control & Rubber Blade Prop Knife]",
      "[Stunt: High-Wire Harness Rigging for Aerial Jump Landing]",
      "[Stunt: Controlled Precision Car Drift with Trained Stunt Driver]",
      "[Stunt: Martial Arts Choreography with Soft Mat Landing Area]",
      "[Stunt: Certified Pyrotechnic Fire Charge with Safety Marshal]"
    ]
  },
  {
    key: "makeupAndHairStyle",
    label: "💄 Craft #23: Makeup, Hair & Prosthetics",
    icon: "Sparkle",
    description: "Character makeup design, prosthetics, wound FX, facial hair, and period hairstyles.",
    tipTitle: "Character Makeup & Prosthetics",
    tip: "Detail character grooming and FX (Sun-Tanned Rural Skin, Saffron Tilak, Cyberpunk LED Liner, Prosthetic Battle Scratches, 1980s Vintage Hairstyle) to maintain character visual consistency.",
    presets: [
      "[Makeup: Authentic 1980s Village Sun-Tanned Skin & Natural Sweat Glow]",
      "[Makeup: Celestial Divine Saffron Tilak & Royal Gold Powder]",
      "[Makeup: Cyberpunk Metallic Face Tattoo & Neon LED Liner]",
      "[Makeup: Gritty Battle Scratches & Prosthetic Wound FX]",
      "[Makeup: Vintage 1980s Telugu Hairstyle & Traditional Bindi]"
    ]
  },
  {
    key: "editTransitionCut",
    label: "✂️ Craft #24: Film Editing Cut & Transition",
    icon: "Scissors",
    description: "Editing cut style, J-Cut/L-Cut audio transitions, match cuts, and scene pacing.",
    tipTitle: "Film Editing & Transition Pacing",
    tip: "Specify post-production edit cuts (Hard Cut, L-Cut Audio Overlap, Fast Whip Pan Match Cut, Smash Cut) to dictate scene pacing and seamless shot flow.",
    presets: [
      "Hard Cut (Standard Scene Beat)",
      "L-Cut / J-Cut Audio Overlap",
      "Fast Whip Pan Match Cut",
      "Slow Cross-Dissolve Fade (60 Frames)",
      "Smash Cut to High-Action Impact",
      "Invisible Match Cut on Character Motion"
    ]
  },
  {
    key: "characterIdMatrix",
    label: "🎭 Craft #25: Character ID & Multi-Modal Asset Matrix",
    icon: "Users",
    description: "Multi-modal reference bindings: Image_1..9, Video_1..3, Audio_1..3 for Seedance & ComfyUI.",
    tipTitle: "Character ID & Multi-Modal Reference Matrix",
    tip: "Manage resolved character tags, scene reference images, video clips, and audio tracks (Image_1..9, Video_1..3, Audio_1..3) to feed ByteDance Seedance 2.0 & ComfyUI nodes.",
    presets: [
      "Image_1 = sunil | Image_2 = bujji | Image_3 = sunil | Image_4 = samudra | Image_5 = crowd | Image_6 = scene | Image_7 = supporting artist | Image_8 = | Image_9 = ",
      "Image_1 = lord_rama | Image_2 = kara_dhushan | Image_3 = ayodhya_palace | Image_4 = crowd | Image_5 = supporting artist | Video_1 = crane_sweep | Audio_1 = dappu_drums",
      "Image_1 = hero_cyber | Image_2 = aria_singer | Image_3 = warehouse_stage | Image_4 = crowd | Video_1 = camera_orbit | Audio_1 = vocal_track"
    ]
  }
];

// ==========================================
// DYNAMIC PRESET RESOLVER & CUSTOM GENRE MERGER
// ==========================================
export function getMergedGenreProfiles() {
  let customProfiles = {};
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('sps_custom_genre_profiles');
      if (saved) customProfiles = JSON.parse(saved);
    } catch (e) {}
  }
  return { ...GENRE_PRESET_PROFILES, ...customProfiles };
}

export function getSlotsForGenre(genreKey = 'mythological') {
  const allProfiles = getMergedGenreProfiles();
  const profile = allProfiles[genreKey] || allProfiles.mythological || GENRE_PRESET_PROFILES.mythological;

  return SEEDANCE_SLOTS.map((slot) => {
    const customGenrePresets = profile?.presets?.[slot.key];
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
    id: "sankranti_rooster_showdown",
    title: "🐓 Sankranti Rooster Fight Showdown (Raju vs. Bujji)",
    category: "Rural Telugu Action / Anthology",
    description: "Sankranti 1980s rooster fight epic in Malkipuram village: Sunil & black champion Bujji vs. Samudra & challenger champion Raju.",
    shots: [
      {
        sceneShotId: "SC01_SH01",
        shotComposition: "Extreme Wide Shot (EWS)",
        cameraMotionTag: "[Camera: Slow Aerial Drone Pan over Malkipuram Village Arena]",
        subjectLightingTag: "[Lighting: 1980s Warm Golden Hour Sunbeams through Konaseema Palms]",
        subjectColorTag: "[Subject Color: 1980s Earthy Terracotta & Lush Konaseema Green]",
        backgroundLightingTag: "[BG Lighting: Glistening Water Reflections on 1980s Godavari Canal]",
        backgroundColorTag: "[BG Color: 1980s Vintage Kodak Film Warm Grain Palette]",
        characterIdAssetRef: "[CharID: @Sunil - Owner of Bujji, traditional lungi & brass amulets]",
        coArtistInteraction: "[Co-Artist: Cheering crowd of surrounding villagers waving bets around the ring]",
        actionEnvContext: "Sankranti rooster fights in Malkipuram village. Sunil introduces his black rooster Bujji, undefeated champion of surrounding villages.",
        characterExpression: "Proud confident smile as village crowds cheer around the ring",
        characterPlacement: "Center ring in low-angle hero stance surrounded by cheering Malkipuram villagers",
        characterDialogue: '"Sunil\'s black rooster Bujji has defeated everyone in surrounding villages!"',
        characterMovement: "Sunil raising Bujji high in victory after defeating rival roosters",
        characterEyeLooks: "[Eye Look: Direct intense eye contact with opponent rooster across fight arena]",
        shotDurationAndImages: "Duration: 6s | Image_1: @Sunil | Image_2: @Bujji | Image_3: @Samudra | Image_4: @Raju | Image_5: @Crowd_Spectators | Image_6: @Rooster_Fighting_Knifes | Image_7: @Malkipuram_Arena"
      },
      {
        sceneShotId: "SC01_SH02",
        shotComposition: "Medium Shot (MS)",
        cameraMotionTag: "[Camera: Vintage 1980s Steadicam Tracking Follow along Dirt Path]",
        subjectLightingTag: "[Lighting: Incandescent Kerosene Lantern Glow in Village Courtyard]",
        subjectColorTag: "[Subject Color: Vintage Sun-Bleached Cotton White & Saffron Ochre]",
        backgroundLightingTag: "[BG Lighting: Soft Vintage Amber Bokeh of Malkipuram Street Lamps]",
        backgroundColorTag: "[BG Color: Vibrant Konaseema Palm Green & Canal Water Blue]",
        characterIdAssetRef: "[CharID: @Samudra - Owner of Raju, proud village leader in white shirt]",
        coArtistInteraction: "[Co-Artist: Samudra holding Raju near his body covered in white cloth]",
        actionEnvContext: "Samudra makes a grand entrance carrying champion rooster Raju covered in a white cloth held tightly near his body.",
        characterExpression: "Intense fierce focus during grand entrance before the crowd",
        characterPlacement: "Foreground center frame, walking slowly through cheering crowd",
        characterDialogue: '"Here comes Samudra with his famous unbeatable champion Raju!"',
        characterMovement: "Samudra walking forward carrying Raju wrapped tightly in white cloth near his body",
        characterEyeLooks: "[Eye Look: Focused gaze looking straight ahead towards the fight ring]",
        shotDurationAndImages: "Duration: 6s | Image_1: @Samudra | Image_2: @Raju | Image_3: @Sunil | Image_4: @Bujji | Image_5: @Crowd_Spectators | Image_6: @Rooster_Fighting_Knifes | Image_7: @Malkipuram_Arena"
      },
      {
        sceneShotId: "SC01_SH03",
        shotComposition: "Slow Epic Reveal Close-Up (CU)",
        cameraMotionTag: "[Camera: Slow Epic Reveal / Tilt Up]",
        subjectLightingTag: "[Lighting: Direct High-Sunlight Fill on Red Soil Pathway]",
        subjectColorTag: "[Subject Color: Traditional Handloom Crimson Saree & Paddy Gold]",
        backgroundLightingTag: "[BG Lighting: Deep Emerald Shadow under 1980s Coconut Canopy]",
        backgroundColorTag: "[BG Color: Rustic Clay Tile Red & Thatch Straw Gold]",
        characterIdAssetRef: "[CharID: @Raju - Strong famous unbeatable challenger rooster of Samudra]",
        coArtistInteraction: "[Co-Artist: Samudra pulling back the white cloth in slow epic reveal]",
        actionEnvContext: "Grand establishment revealing shot of Raju as Samudra removes the white cloth in epic manner, revealing Raju's fierce stance.",
        characterExpression: "Fierce majestic posture with sharp eyes ready for battle",
        characterPlacement: "Center frame focus, white cloth dropping to reveal Raju",
        characterDialogue: '"Raju is revealed! The ultimate challenger of Malkipuram!"',
        characterMovement: "Removing white cloth from champion rooster in slow epic reveal motion",
        characterEyeLooks: "[Eye Look: Sharp laser-focused gaze locked onto Bujji]",
        shotDurationAndImages: "Duration: 6s | Image_1: @Raju | Image_2: @Samudra | Image_3: @Sunil | Image_4: @Bujji | Image_5: @Crowd_Spectators | Image_6: @Rooster_Fighting_Knifes | Image_7: @Malkipuram_Arena"
      },
      {
        sceneShotId: "SC01_SH04",
        shotComposition: "Macro Extreme Close-Up (ECU)",
        cameraMotionTag: "[Camera: Macro Focus Push-In on Rooster Leg Knife]",
        subjectLightingTag: "[Lighting: Metallic Sun Glint on Razor Blade]",
        subjectColorTag: "[Subject Color: Metallic Silver Blade & Red Twine Binding]",
        backgroundLightingTag: "[BG Lighting: Soft Ambient Ground Shadow]",
        backgroundColorTag: "[BG Color: Terracotta Red Soil Ground]",
        characterIdAssetRef: "[CharID: @Rooster_Fighting_Knifes - Razor-sharp brass foot blades tied with twine]",
        coArtistInteraction: "[Co-Artist: Sunil and Samudra tying sharp knifes onto rooster feet]",
        actionEnvContext: "Closeup shots of tying razor-sharp brass knifes onto the legs of Bujji and Raju with tight twine bindings.",
        characterExpression: "Extreme precision and steady concentration",
        characterPlacement: "Macro extreme close-up of feet and razor blade binding",
        characterDialogue: '"Tie the razor knifes tight... this Sankranti fight will be legendary!"',
        characterMovement: "Tying razor-sharp brass knifes onto rooster legs with steady expert hands",
        characterEyeLooks: "[Eye Look: Macro focused gaze on blade knots]",
        shotDurationAndImages: "Duration: 5s | Image_1: @Rooster_Fighting_Knifes | Image_2: @Sunil | Image_3: @Bujji | Image_4: @Samudra | Image_5: @Raju | Image_6: @Crowd_Spectators | Image_7: @Malkipuram_Arena"
      },
      {
        sceneShotId: "SC01_SH05",
        shotComposition: "Dynamic Action Medium Shot (MS)",
        cameraMotionTag: "[Camera: Dynamic Handheld Action Pan across Rooster Ring]",
        subjectLightingTag: "[Lighting: 1980s Warm Golden Hour Sunbeams through Konaseema Palms]",
        subjectColorTag: "[Subject Color: High Contrast Feathers & Dust Motes]",
        backgroundLightingTag: "[BG Lighting: Glistening Dusty Festival Crowd Haze]",
        backgroundColorTag: "[BG Color: Vibrant Konaseema Palm Green & Water Blue]",
        characterIdAssetRef: "[CharID: @Bujji - Unbeatable black champion rooster of Sunil]",
        coArtistInteraction: "[Co-Artist: Bujji and Raju clashing mid-air with razor knives in furious duel]",
        actionEnvContext: "Bujji and Raju brought together into the ring to start the fight. Multiple shots of Raju and Bujji fighting furiously—sometimes Raju leads, sometimes Bujji leads.",
        characterExpression: "Fierce unstoppable competitive energy",
        characterPlacement: "Center ring collision, feathers and dust rising in air",
        characterDialogue: '"Look at that clash! Raju takes the lead, now Bujji strikes back!"',
        characterMovement: "Roosters leaping into mid-air collision with sharp foot blades flashing in sunlight",
        characterEyeLooks: "[Eye Look: Direct intense eye contact with opponent rooster across fight arena]",
        shotDurationAndImages: "Duration: 6s | Image_1: @Bujji | Image_2: @Raju | Image_3: @Sunil | Image_4: @Samudra | Image_5: @Crowd_Spectators | Image_6: @Rooster_Fighting_Knifes | Image_7: @Malkipuram_Arena"
      },
      {
        sceneShotId: "SC01_SH06",
        shotComposition: "Heroic Wide Shot (WS)",
        cameraMotionTag: "[Camera: Hero Orbit 180 Deg around Winner]",
        subjectLightingTag: "[Lighting: Golden Sunset Flare behind Victorious Champion]",
        subjectColorTag: "[Subject Color: Champion Golden Earth & Crimson Ribbon]",
        backgroundLightingTag: "[BG Lighting: Wildly Cheering Crowd Bokeh in Sunset Light]",
        backgroundColorTag: "[BG Color: 1980s Vintage Kodak Film Warm Grain Palette]",
        characterIdAssetRef: "[CharID: @Raju - Strong famous unbeatable challenger rooster of Samudra]",
        coArtistInteraction: "[Co-Artist: Samudra celebrating as crowd cheers around victorious Raju]",
        actionEnvContext: "Climax: After a long ferocious fight between Raju and Bujji, Raju kills Bujji and stands as the unbeatable CHAMPION in the Sankranti rooster fight!",
        characterExpression: "Triumphant undisputed champion posture",
        characterPlacement: "Center stage hero stance, Samudra and villagers cheering in background",
        characterDialogue: '"Raju stands victorious! The new undisputed champion of Sankranti!"',
        characterMovement: "Raju standing tall on victory mound surrounded by cheering crowds",
        characterEyeLooks: "[Eye Look: Proud gaze looking out over the entire village assembly]",
        shotDurationAndImages: "Duration: 7s | Image_1: @Raju | Image_2: @Samudra | Image_3: @Sunil | Image_4: @Bujji | Image_5: @Crowd_Spectators | Image_6: @Rooster_Fighting_Knifes | Image_7: @Malkipuram_Arena"
      }
    ]
  },
  {
    id: "konaseema_anthology_epic",
    title: "🌾 Konaseema Tales - Malkipuram Village Anthology Treatment",
    category: "Rural Telugu Anthology",
    description: "Multi-story narrative set in Andhra Pradesh, East Godavari district, Konaseema coconut orchards & Malkipuram village backwaters.",
    shots: [
      {
        sceneShotId: "SC01_SH01",
        shotComposition: "Extreme Wide Shot (EWS)",
        cameraMotionTag: "[Camera: Slow Aerial Drone Pan over Godavari River]",
        subjectLightingTag: "[Lighting: Golden Hour Sunbeams through Coconut Palm Canopy]",
        subjectColorTag: "[Subject Color: Lush Konaseema Emerald Green & Terracotta Red]",
        backgroundLightingTag: "[BG Lighting: Glistening Water Reflections on Godavari Canal Surface]",
        backgroundColorTag: "[BG Color: Vibrant Konaseema Palm Green & Water Blue]",
        characterIdAssetRef: "[CharID: @YoungProtagonist_Suri - Malkipuram youth in cotton shirt, vintage bicycle]",
        coArtistInteraction: "[Co-Artist: Village elders gathered under banyan tree for Panchayat discussion]",
        actionEnvContext: "Lush green Konaseema coconut orchard with sunbeams filtering through palm fronds and red soil pathway along Malkipuram village canal.",
        characterExpression: "Warm, authentic rural Telugu smile with deep eyes full of nostalgia and wisdom",
        characterPlacement: "Foreground left, leaning against vintage bicycle under coconut palm frame",
        characterDialogue: '"Mana Konaseema pachani polalu chooste manasuki prasanthatha vasthundi."',
        characterMovement: "Riding vintage bicycle along narrow dirt path through lush Konaseema coconut groves",
        characterEyeLooks: "[Eye Look: Looking out thoughtfully across the calm Godavari river waters]"
      },
      {
        sceneShotId: "SC01_SH02",
        shotComposition: "Medium Shot (MS)",
        cameraMotionTag: "[Camera: Slow Tracking Side Dolly]",
        subjectLightingTag: "[Lighting: Incandescent Yellow Tea Stall Bulb Glow at Malkipuram Dusk]",
        subjectColorTag: "[Subject Color: Sun-Bleached Cotton White & Warm Ochre Earth]",
        backgroundLightingTag: "[BG Lighting: Soft Warm Bokeh of Village Street Lamps at Dusk]",
        backgroundColorTag: "[BG Color: Rustic Clay Brick Red & Straw Gold]",
        characterIdAssetRef: "[CharID: @VillageElder_Ramaraju - Respected Konaseema elder, white dhoti & kanduva]",
        coArtistInteraction: "[Co-Artist: Local youth laughing together at rural tea stall by Godavari canal]",
        actionEnvContext: "Traditional East Godavari courtyard house (Panchayati Veedhi) with clay-tile roof, carved wooden pillars, and flower rangoli.",
        characterExpression: "Contemplative village gaze looking out over Godavari river backwaters",
        characterPlacement: "Center frame sitting on carved wooden porch bench (Thinnaye) of village house",
        characterDialogue: '"Malkipuram urukoliya vinayaka chavithi thirunallu eppudaina choosava?"',
        characterMovement: "Serving warm tea in small glass to village elders seated on wooden bench",
        characterEyeLooks: "[Eye Look: Warm direct eye contact with village neighbor coming down the lane]"
      }
    ]
  },
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
