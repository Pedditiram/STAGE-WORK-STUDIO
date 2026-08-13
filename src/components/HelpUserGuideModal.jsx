import React, { useState } from 'react';
import { 
  X, BookOpen, Clock, Wand2, Film, Sparkles, 
  LayoutGrid, FileText, Video, Cloud, Key, CheckCircle2, 
  HelpCircle, ChevronRight, Search, Layers, RefreshCw, Archive, Sliders, Play, Copy
} from 'lucide-react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';

const CRAFT_COUNT = SEEDANCE_SLOTS.length;

const GUIDE_SECTIONS = [
  {
    id: 'overview',
    icon: Film,
    title: '1. Overview & Quick Start',
    badge: 'END USER GUIDE',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-cyan-200 space-y-2">
          <h4 className="font-bold text-sm text-cyan-300 font-sans flex items-center gap-2">
            🎬 Welcome to Stage Production Studio
          </h4>
          <p className="leading-relaxed">
            {`Stage Production Studio is an all-in-one workstation designed for filmmakers, directors, prompt engineers, and creative teams to transform screenplays into professional ${CRAFT_COUNT}-craft production matrices, AI keyframe storyboards, and multi-user live room collaborations.`}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <span className="font-bold text-amber-400 block">{`📐 ${CRAFT_COUNT} Crafts of Cinema Matrix`}</span>
            <p className="text-zinc-400 leading-snug">Fine-tune framing, camera motion, lens optics, lighting, characters, sound design, Foley, VFX, and reference images per shot.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <span className="font-bold text-cyan-400 block">🪄 AI Screenplay Parser</span>
            <p className="text-zinc-400 leading-snug">Upload script files (.pdf, .txt) to automatically extract scenes, sluglines, and characters into a complete shot breakdown.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <span className="font-bold text-emerald-400 block">🖼️ 2K Director Keyframe Canvas</span>
            <p className="text-zinc-400 leading-snug">Visualize scenes in 3D Clay, 2D Blueprint, or AI keyframe image renders at 2K resolution.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <span className="font-bold text-purple-400 block">☁️ Real-Time Cloud Room Sync</span>
            <p className="text-zinc-400 leading-snug">Collaborate live with your team using room invite links to sync edits in real time.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'script_parser',
    icon: Wand2,
    title: '2. Screenplay Breakdown & AI Parser',
    badge: 'AI WORKFLOW',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/40 text-purple-200 space-y-2">
          <h4 className="font-bold text-sm text-purple-300 font-sans flex items-center gap-2">
            🪄 Generating Shot Lists from Screenplays
          </h4>
          <p className="leading-relaxed">
            The AI Screenplay Parser reads your script formatting and automatically creates structured shot lists with composition, camera angles, lighting, and action beats.
          </p>
        </div>

        <div className="space-y-2.5 text-zinc-300">
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-3">
            <span className="p-1.5 rounded-md bg-purple-500/20 text-purple-300 font-bold shrink-0">Step 1</span>
            <div>
              <strong className="text-white block mb-0.5">Open AI Breakdown in Projects Console</strong>
              <p className="text-zinc-400">Open <strong>Projects Console</strong> from the header, then use the <strong>AI Breakdown</strong> workflow there (not a top-toolbar magic button).</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-3">
            <span className="p-1.5 rounded-md bg-purple-500/20 text-purple-300 font-bold shrink-0">Step 2</span>
            <div>
              <strong className="text-white block mb-0.5">Paste or Upload Screenplay</strong>
              <p className="text-zinc-400">Paste your screenplay text or click <strong>"📄 Upload Script PDF/TXT"</strong> to load formatted script pages.</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-3">
            <span className="p-1.5 rounded-md bg-purple-500/20 text-purple-300 font-bold shrink-0">Step 3</span>
            <div>
              <strong className="text-white block mb-0.5">Generate Shot List</strong>
              <p className="text-zinc-400">Click <strong>"⚡ Analyze & Build Production Matrix"</strong> to populate your spreadsheet with scenes and craft breakdowns.</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'craft_matrix',
    icon: Sliders,
    title: `3. ${CRAFT_COUNT} Crafts Matrix & Prompt Compiler`,
    badge: 'PROMPT ENGINE',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 space-y-2">
          <h4 className="font-bold text-sm text-amber-300 font-sans flex items-center gap-2">
            ⚙️ Editing Shot Attributes & Compiling Prompts
          </h4>
          <p className="leading-relaxed">
            {`Each shot row contains ${CRAFT_COUNT} cinema craft columns plus image reference inputs. Customize details per shot and compile production-ready AI image/video prompts.`}
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
            <span className="font-bold text-amber-400 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Category Focus Filters
            </span>
            <p className="text-zinc-300 leading-relaxed">
              Use the top Focus Strip (<strong>Camera</strong>, <strong>Lighting</strong>, <strong>Volumetrics</strong>, <strong>Acting</strong>, <strong>Audio</strong>) to quickly display only the relevant craft columns for your specific role.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
            <span className="font-bold text-cyan-400 flex items-center gap-2">
              <Copy className="w-4 h-4 text-cyan-400" />
              Compiling Production Prompts
            </span>
            <p className="text-zinc-300 leading-relaxed">
              Click <strong>"⚡ Compile Prompts"</strong> to open the Prompt Compiler. You can export complete prompt manifests optimized for Midjourney, Flux, ComfyUI, Runway Gen-3, or Luma Dream Machine.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'shot_management',
    icon: Archive,
    title: '4. Shot Editing, Reordering & Archiving',
    badge: 'TIMELINE CONTROL',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 space-y-2">
          <h4 className="font-bold text-sm text-emerald-300 font-sans flex items-center gap-2">
            📦 Managing & Preserving Shots
          </h4>
          <p className="leading-relaxed">
            Easily reorder, duplicate, mute, or archive shots while keeping your timeline organized.
          </p>
        </div>

        <div className="space-y-2.5 text-zinc-300">
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2">
            <span className="text-emerald-400 font-bold">⋮⋮</span>
            <p><strong>Drag & Drop Reordering:</strong> Click and hold the drag handle (⋮⋮) next to any shot number to move it up or down in the shot sequence.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2">
            <span className="text-blue-400 font-bold">+</span>
            <p><strong>Duplicate Row:</strong> Click the plus icon on any row to clone the shot and all its craft settings.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2">
            <span className="text-red-400 font-bold">🔇</span>
            <p><strong>Mute Shot:</strong> Click the mute icon to temporarily hide a shot without losing its parameters.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2">
            <span className="text-amber-400 font-bold">📦</span>
            <p><strong>Archive Shot:</strong> Click Archive to move a shot into the project vault. You can restore archived shots at any time from the Archive drawer.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'genres',
    icon: Sparkles,
    title: '5. Script Genre Profiles & Cinematic References',
    badge: 'PRESETS + REFS',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <p className="text-zinc-300 leading-relaxed">
          Select a <strong>Production Genre Profile</strong> to pre-fill framing, lighting, color, and choreography.
          Each genre also unlocks <strong>Cinematic References</strong> (movies, directors, DoPs, art direction, screenplays)
          inside Matrix craft popups, Writer Digest, Character Bible, World Console, Promo Pack, and Compiler prompts —
          so LLM enhance follows concrete taste anchors for your script (e.g. mythological → Baahubali / Rajamouli / KK Senthil Kumar).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-300">
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-amber-300 block mb-0.5">🕉️ Indian Mythology & Period Epic</strong>
            <span>Ramayana, Mahabharata, Ayodhya, Royal Palaces & Divine Bows</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-cyan-300 block mb-0.5">🎸 Cyberpunk & Stage Performance</strong>
            <span>Neon Megacities, Concert Lasers, Vocalists & Cybervisors</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-purple-300 block mb-0.5">🚀 Sci-Fi & Space Opera</strong>
            <span>Starships, Warp Drive, Holographic HUD Visors & Alien Worlds</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-emerald-300 block mb-0.5">🕵️ Cinematic Action & Thriller</strong>
            <span>Urban Gunfights, Car Chases, Rain Alleys & Tactical Agents</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-blue-300 block mb-0.5">🧙 Fantasy & Dark Magic</strong>
            <span>High Sorcery, Rune Staffs, Spellcasting Arcana & Dragons</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-red-300 block mb-0.5">👻 Horror & Supernatural Dread</strong>
            <span>Haunted Mansions, Paranormal Entities, Shadows & Flickering Light</span>
          </div>
        </div>
        <p className="text-zinc-500 text-[11px] leading-relaxed">
          Tip: open any Matrix craft → expand → scroll to <em>Cinematic references</em> → click a chip to insert, or Copy for LLM.
        </p>
      </div>
    )
  },
  {
    id: 'collaboration',
    icon: Cloud,
    title: '6. Live Cloud Collaboration & Room Sharing',
    badge: 'TEAMWORK',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <p className="text-zinc-300 leading-relaxed">
          Work live with team members across different devices and locations:
        </p>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-cyan-300">Room Code Format:</span>
            <span className="font-bold text-amber-300 bg-zinc-950 px-2 py-0.5 rounded border border-amber-800">SPS-CLOUD-8821</span>
          </div>
          <div className="space-y-2 text-zinc-400">
            <p>• <strong>Share Live Invite Links:</strong> Open the <strong>"☁️ Collaboration"</strong> modal in the header and click <strong>"📋 Copy Shareable Invite Link"</strong> to send to your team.</p>
            <p>• <strong>Live Synchronized Edits:</strong> Attribute edits, camera movements, and keyframes automatically update live on all connected devices.</p>
            <p>• <strong>Active Member Badges:</strong> See who is online in your room and view active editing badges on shot rows.</p>
          </div>
        </div>
      </div>
    )
  }
];

export default function HelpUserGuideModal({ isOpen, onClose }) {
  const [activeSectionId, setActiveSectionId] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const activeSection = GUIDE_SECTIONS.find(s => s.id === activeSectionId) || GUIDE_SECTIONS[0];

  const filteredSections = GUIDE_SECTIONS.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.badge.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md font-mono">
      <div className="relative w-full max-w-5xl bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-300 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 px-6 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <HelpCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 font-sans">
                Stage Production Studio — User Guide
                <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-300 px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-800 font-mono font-bold">
                  v2.0 Production Release
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 font-mono">Complete documentation & workflow guide for filmmakers & collaborators.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 px-6 bg-slate-100 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800/80 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search help topics, features, genre presets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-zinc-200 font-bold focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[500px]">
          
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-64 border-r border-slate-200 dark:border-zinc-800/80 bg-slate-100/90 dark:bg-zinc-900/40 p-3 space-y-1 overflow-y-auto shrink-0">
            {filteredSections.map((sec) => {
              const IconComp = sec.icon;
              const isActive = activeSectionId === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full p-2.5 rounded-xl text-left font-mono text-xs transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                      : 'text-slate-700 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-zinc-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-zinc-500'}`} />
                    <span className="truncate">{sec.title}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-zinc-600'}`} />
                </button>
              );
            })}
          </div>

          {/* Right Section Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-zinc-950/80">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                {activeSection.title}
              </h3>
              <span className="text-[10px] bg-zinc-900 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold font-mono">
                {activeSection.badge}
              </span>
            </div>

            {activeSection.content}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span className="text-zinc-400 font-bold">Stage Production Studio End User Guide — v2.0</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 font-bold transition-colors shadow-sm cursor-pointer"
          >
            Close User Guide
          </button>
        </div>

      </div>
    </div>
  );
}
