import React, { useState } from 'react';
import { 
  X, BookOpen, ShieldCheck, Lock, Clock, Wand2, Film, Sparkles, 
  LayoutGrid, FileText, Video, Cloud, Key, CheckCircle2, AlertTriangle, 
  HelpCircle, ChevronRight, Search, Layers, RefreshCw, Archive
} from 'lucide-react';

const GUIDE_SECTIONS = [
  {
    id: 'overview',
    icon: Film,
    title: '1. Overview & Core Features',
    badge: 'STAGE PRO 2.0',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-cyan-200 space-y-2">
          <h4 className="font-bold text-sm text-cyan-300 font-sans flex items-center gap-2">
            🎬 Stage Production Studio (SeeDance 2.0 & SeeDream 5.0)
          </h4>
          <p className="leading-relaxed">
            Stage Production Studio is a professional film production prompt matrix, AI screenplay breakdown engine, and real-time collaboration workstation engineered specifically for next-gen cinema generation models including <strong>SeeDance 2.0</strong>, <strong>SeeDream 5.0</strong>, <strong>Sora 2</strong>, <strong>Runway Gen-3</strong>, and <strong>Kling 1.5</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <span className="font-bold text-amber-400 block">📐 15-Slot Cinema Matrix</span>
            <p className="text-zinc-400 leading-snug">Structured 15-slot prompt architecture governing composition, camera motion, lighting, co-artist reactions, kinetics, and facial expressions.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <span className="font-bold text-cyan-400 block">🪄 AI Screenplay Parser</span>
            <p className="text-zinc-400 leading-snug">Upload PDF/TXT scripts to automatically extract scenes, sluglines, and characters into structured shot prompts.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <span className="font-bold text-emerald-400 block">🖼️ 2K Director Keyframe Canvas</span>
            <p className="text-zinc-400 leading-snug">Interactive 3D Clay sculpt, 2D Blueprint, and AI Keyframe rendering with 2K frame generation.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
            <span className="font-bold text-purple-400 block">☁️ Real-Time Cloud Room Sync</span>
            <p className="text-zinc-400 leading-snug">Collaborate live with Director, DP, Lighting, and Audio leads using encrypted room codes and auto-saving project libraries.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'security_rules',
    icon: ShieldCheck,
    title: '2. Security Rules & Admin Governance',
    badge: 'STRICT RULES',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 space-y-2">
          <h4 className="font-bold text-sm text-amber-300 font-sans flex items-center gap-2">
            🔒 Primary Admin Security Governance
          </h4>
          <p className="leading-relaxed">
            Stage Production Studio operates under strict governance rules to prevent unauthorized project modification, accidental data loss, or unvetted scene deletion.
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
            <span className="font-bold text-red-400 flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-400" />
              Rule A: Admin-Only Project Creation & Deletion
            </span>
            <p className="text-zinc-300 leading-relaxed">
              No user or collaborator has permission to create or delete projects. Only the <strong>Authorized Primary App Admin (pedditiram@gmail.com)</strong> logged into Admin Settings is granted creation and deletion rights.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
            <span className="font-bold text-amber-400 flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-400" />
              Rule B: No Scene or Shot Deletion Allowed
            </span>
            <p className="text-zinc-300 leading-relaxed">
              Nobody has the right to remove or destroy a shot or scene. Clicking trash/delete automatically <strong>archives</strong> the shot into the project archive drawer. Shots can only be modified, archived, or restored back to production.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
            <span className="font-bold text-cyan-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Rule C: 30-Minute Automatic Backup Engine
            </span>
            <p className="text-zinc-300 leading-relaxed">
              The workstation automatically creates a new timestamped version snapshot every <strong>30 minutes</strong>, storing up to 50 historical backups for complete disaster recovery.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'shot_archive',
    icon: Archive,
    title: '3. No Shot Deletion & Archiving Guide',
    badge: 'PROTECTION',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 space-y-2">
          <h4 className="font-bold text-sm text-emerald-300 font-sans flex items-center gap-2">
            📦 Shot Archival & Restoration Workflow
          </h4>
          <p className="leading-relaxed">
            To preserve creative iterations and production history, shots are never permanently deleted from the database.
          </p>
        </div>

        <div className="space-y-2 text-zinc-300">
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2">
            <span className="text-amber-400 font-bold">1.</span>
            <p><strong>Archiving a Shot:</strong> Click the amber Archive icon on any shot row. The shot is hidden from active matrix view and assigned an archival timestamp.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2">
            <span className="text-amber-400 font-bold">2.</span>
            <p><strong>Modifying Shots:</strong> Active shots can be edited, updated, or reordered using drag-and-drop handles at any time.</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2">
            <span className="text-amber-400 font-bold">3.</span>
            <p><strong>Restoring Shots:</strong> View the Archive list in project history and click <em>"Restore Shot"</em> to return it to the active production timeline.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'genres',
    icon: Sparkles,
    title: '4. Script Genre Profiles (9 Profiles)',
    badge: 'CINEMA PRESETS',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <p className="text-zinc-300 leading-relaxed">
          Stage Production Studio includes <strong>9 Production Genre Profiles</strong> with curated seed presets for framing, lighting, color, and character choreography:
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
            <strong className="text-blue-300 block mb-0.5">🧙‍♂️ Fantasy & Dark Magic</strong>
            <span>High Sorcery, Rune Staffs, Spellcasting Arcana & Dragons</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-red-300 block mb-0.5">👻 Horror & Supernatural Dread</strong>
            <span>Haunted Mansions, Paranormal Entities, Shadows & Flickering Light</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-pink-300 block mb-0.5">💃 Bollywood & Musical Spectacle</strong>
            <span>Sherwanis, Lehengas, Holi Colors, 50 Dancers & Marigold Petals</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
            <strong className="text-amber-200 block mb-0.5">📜 Historical Drama & Period Romance</strong>
            <span>Victorian Ballrooms, Regency Silk Gowns, Candlelight & Waltzes</span>
          </div>
          <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 col-span-1 md:col-span-2">
            <strong className="text-orange-400 block mb-0.5">🏎️ High-Octane Racing & Supercar Heist</strong>
            <span>Underground Drifts, Carbon Visors, NOS Exhaust Flames & Vault Pursuits</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'collaboration',
    icon: Cloud,
    title: '5. Cloud Sharing & Live Team Rooms',
    badge: 'REAL-TIME',
    content: (
      <div className="space-y-4 text-xs font-mono">
        <p className="text-zinc-300 leading-relaxed">
          Collaborate synchronously across devices with automatic cloud synchronization and role assignment:
        </p>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-cyan-300">Room Code Format:</span>
            <span className="font-bold text-amber-300 bg-zinc-950 px-2 py-0.5 rounded border border-amber-800">SPS-CLOUD-8821</span>
          </div>
          <div className="space-y-1.5 text-zinc-400">
            <p>• Share public room links directly or invite teammates via <strong>WhatsApp Share</strong> in Settings.</p>
            <p>• Assign roles: <strong>🎬 Director</strong>, <strong>🎥 DP</strong>, <strong>💡 Lighting Lead</strong>, <strong>🎵 Audio Sync Lead</strong>.</p>
            <p>• All team edits auto-save straight into the project library in real time.</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <BookOpen className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                Stage Production Studio — Official Help & User Guide
                <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800 font-mono font-bold">
                  v2.0 Production Release
                </span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono">Comprehensive documentation, security governance rules & workflow guide.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 px-6 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search help topics, security rules, genre presets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[500px]">
          
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-64 border-r border-zinc-800/80 bg-zinc-900/40 p-3 space-y-1 overflow-y-auto shrink-0">
            {filteredSections.map((sec) => {
              const IconComp = sec.icon;
              const isActive = activeSectionId === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full p-2.5 rounded-xl text-left font-mono text-xs transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
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
          <span>Authorized Admin: <strong className="text-amber-300">pedditiram@gmail.com</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 font-bold transition-colors shadow-sm"
          >
            Close User Guide
          </button>
        </div>

      </div>
    </div>
  );
}
