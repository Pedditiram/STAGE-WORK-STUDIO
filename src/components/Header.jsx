import React, { useState } from 'react';
import { 
  Film, Folder, Wand2, Cloud, Settings, Lock, Sparkles, LayoutGrid, FileText, Save, FolderKanban, Zap, CheckCircle2, Video, Download, Upload, Check, Edit3, Moon, Sun, Scroll, HelpCircle, ChevronDown
} from 'lucide-react';

export default function Header({ 
  projectTitle, 
  setProjectTitle, 
  targetModel, 
  aspectRatio, 
  setAspectRatio, 
  activeView, 
  setActiveView,
  onExportProject,
  onImportProject,
  onOpenCompiler,
  onOpenAdminModal,
  onOpenAIModal,
  onOpenProjectConsole,
  onOpenHelpModal,
  roomId,
  collaboratorCount,
  isAdminLoggedIn,
  showCanvasTab = false,
  onSaveProject,
  isProjectSavedToast = false,
  shotCount = 0,
  colorTheme = 'dark',
  onChangeColorTheme,
  presetProfile = 'mythological',
  onChangePresetProfile
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitleInput, setTempTitleInput] = useState(projectTitle);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleTitleSubmit = () => {
    if (tempTitleInput.trim()) {
      setProjectTitle(tempTitleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const getLoggedInUser = () => {
    if (typeof window !== 'undefined') {
      const authEmail = localStorage.getItem('sps_authorized_user_email');
      const savedUsers = localStorage.getItem('sps_authorized_phone_users');
      if (savedUsers) {
        try {
          const users = JSON.parse(savedUsers);
          if (authEmail) {
            const found = users.find(u => u.email === authEmail || u.phone === authEmail);
            if (found) return found;
          }
          if (users.length > 0) return users[0];
        } catch (e) {}
      }
    }
    return {
      name: isAdminLoggedIn ? 'Pedditi Ram' : 'Pedditi Varshini',
      designation: 'Lead Director',
      role: isAdminLoggedIn ? 'Director & Owner' : 'Editor'
    };
  };

  const currentUser = getLoggedInUser();
  const userName = currentUser.name || (isAdminLoggedIn ? 'Pedditi Ram' : 'Collaborator');
  const userDesignation = currentUser.designation || 'Lead Director';
  const userRole = currentUser.role || (isAdminLoggedIn ? 'Director & Owner' : 'Editor');
  const fourLetterName = userName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PEDD';
  const authEmail = currentUser.email || (isAdminLoggedIn ? 'pedditiram@gmail.com' : 'user@gmail.com');
  const allottedProjects = currentUser.allottedProjects || [projectTitle || 'Active Stage Production Project'];

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/90 shadow-xl px-3 sm:px-4 py-2 shrink-0 w-full font-mono text-xs">
      <div className="w-full flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
        
        {/* LEFT: App Brand + Active Project Editable Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 text-white shadow flex items-center justify-center shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-black text-white tracking-wide font-sans hidden xl:block shrink-0">
              STAGE PRODUCTION STUDIO
            </h1>
          </div>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block shrink-0" />

          {/* Active Project Title Inline Editor */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800/90 px-2.5 py-1 rounded-lg shrink-0">
            <FolderKanban className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {isEditingTitle ? (
              <input
                type="text"
                value={tempTitleInput}
                onChange={(e) => setTempTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                onBlur={handleTitleSubmit}
                autoFocus
                className="bg-zinc-950 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-amber-300 font-bold focus:outline-none max-w-[180px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => { setTempTitleInput(projectTitle); setIsEditingTitle(true); }}
                className="text-amber-300 font-bold hover:underline max-w-[140px] sm:max-w-[200px] truncate text-left"
                title="Click to edit project title"
              >
                {projectTitle}
              </button>
            )}
            <span className="text-[10px] text-cyan-300 font-mono font-bold bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800/80 shrink-0">
              {shotCount} Shots
            </span>
          </div>
        </div>

        {/* CENTER: Studio View Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shrink-0">
          {showCanvasTab && (
            <button
              type="button"
              onClick={() => setActiveView("canvas")}
              className={`p-1.5 rounded-lg transition-all shrink-0 ${
                activeView === "canvas"
                  ? "bg-cyan-500 text-zinc-950 shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Canvas View"
            >
              <Video className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveView("spreadsheet")}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${
              activeView === "spreadsheet"
                ? "bg-cyan-500 text-zinc-950 shadow"
                : "text-zinc-400 hover:text-white"
            }`}
            title="17-Slot Matrix View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveView("form")}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${
              activeView === "form"
                ? "bg-cyan-500 text-zinc-950 shadow"
                : "text-zinc-400 hover:text-white"
            }`}
            title="Form View"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>

        {/* RIGHT: Quick Action Tools + EXTREME TOP RIGHT User Profile Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Quick Save Project Button */}
          <button
            type="button"
            onClick={onSaveProject}
            className={`p-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all border shadow shrink-0 ${
              isProjectSavedToast
                ? 'bg-emerald-500 text-zinc-950 border-emerald-400 scale-105'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40'
            }`}
            title={isProjectSavedToast ? "✓ Saved!" : "Save Project"}
          >
            {isProjectSavedToast ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          </button>

          {/* Unified Projects, AI Script Breakdown & Genre Console */}
          <button
            type="button"
            onClick={onOpenProjectConsole}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center gap-1 shadow shrink-0"
            title="Open Projects, AI Script Breakdown & Genre Presets Console"
          >
            <FolderKanban className="w-4 h-4 text-cyan-400" />
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
          </button>

          {/* Export JSON Button */}
          <button
            type="button"
            onClick={onExportProject}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0"
            title="Export .JSON Project File"
          >
            <Download className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Import JSON Button */}
          <label className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer shrink-0" title="Import .JSON Project File">
            <Upload className="w-4 h-4 text-amber-400" />
            <input type="file" accept=".json" onChange={onImportProject} className="hidden" />
          </label>

          {/* Admin Settings Trigger */}
          <button
            type="button"
            onClick={onOpenAdminModal}
            className={`p-1.5 rounded-lg border text-xs font-mono transition-all shrink-0 ${
              isAdminLoggedIn
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="Admin Settings"
          >
            {isAdminLoggedIn ? <Settings className="w-4 h-4 text-amber-400 animate-spin-slow" /> : <Lock className="w-4 h-4 text-zinc-400" />}
          </button>

          {/* Help & User Guide Trigger */}
          <button
            type="button"
            onClick={onOpenHelpModal}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-700 shrink-0"
            title="Open Help & User Guide"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Color Theme Selector Pill (Small Icons Only) */}
          <div className="flex items-center gap-0.5 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 shrink-0" title="Switch App Color Theme">
            <button
              type="button"
              onClick={() => onChangeColorTheme && onChangeColorTheme('dark')}
              className={`p-1.5 rounded transition-all ${
                colorTheme === 'dark' ? 'bg-zinc-800 text-amber-300 shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Cyber Dark Mode"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeColorTheme && onChangeColorTheme('paper')}
              className={`p-1.5 rounded transition-all ${
                colorTheme === 'paper' ? 'bg-amber-100 text-amber-950 shadow border border-amber-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Light Paper Mode"
            >
              <Scroll className="w-3.5 h-3.5 text-amber-800" />
            </button>
          </div>

          {/* Master Prompt Compiler Trigger */}
          <button
            type="button"
            onClick={onOpenCompiler}
            className="p-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-zinc-950 font-black text-xs font-mono flex items-center justify-center shadow border border-amber-300/40 shrink-0"
            title="Open Master Prompt Compiler"
          >
            <Sparkles className="w-4 h-4 fill-zinc-950" />
          </button>

          {/* EXTREME TOP RIGHT: Logged-In User Profile (4-Letter Name Only, Designation Removed From Pill) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 p-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 transition-all cursor-pointer shadow shrink-0"
              title="Click to view logged-in profile, designation & allotted projects"
            >
              {/* 4-Letter Icon Badge */}
              <div className="px-2 py-0.5 rounded-lg bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 text-white font-black text-xs font-mono tracking-widest shadow shrink-0">
                {fourLetterName}
              </div>

              {/* 4-Letter Name Display (Designation Removed From Pill) */}
              <span className="font-bold text-white text-xs tracking-wide whitespace-nowrap block">{fourLetterName}</span>

              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isProfileOpen ? 'rotate-180 text-amber-400' : ''}`} />
            </button>

            {/* Profile & Designation Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3 font-mono text-xs text-left animate-in fade-in zoom-in-95">
                
                {/* User Info & Designation Header */}
                <div className="flex items-start gap-3 pb-3 border-b border-zinc-800">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow shrink-0 tracking-wider">
                    {fourLetterName}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white text-sm truncate font-sans">{userName}</span>
                    <span className="text-[11px] text-cyan-300 font-bold">💼 {userDesignation}</span>
                    <span className="text-[10.5px] text-amber-400 font-bold mt-0.5">👑 {userRole}</span>
                    <span className="text-[10px] text-zinc-400 truncate mt-0.5">📧 {authEmail}</span>
                  </div>
                </div>

                {/* Projects Shared / Allotted Section */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-zinc-300 block flex items-center gap-1.5 font-sans">
                    <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
                    Projects Shared & Allotted ({allottedProjects.length}):
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {allottedProjects.map((proj, pIdx) => (
                      <div key={pIdx} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-zinc-200 font-bold truncate max-w-[170px]">{proj}</span>
                        <span className="text-[9.5px] bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-1.5 py-0.5 rounded font-bold">
                          🟢 Access Allotted
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Action & Login / Logout Controls */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => { setIsProfileOpen(false); if (onOpenAdminModal) onOpenAdminModal(); }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-bold flex items-center justify-between transition-all border border-zinc-800"
                  >
                    <span className="flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-amber-400" /> Admin & Project Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setIsProfileOpen(false); if (onOpenHelpModal) onOpenHelpModal(); }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-bold flex items-center justify-between transition-all border border-zinc-800"
                  >
                    <span className="flex items-center gap-2"><HelpCircle className="w-3.5 h-3.5 text-cyan-400" /> Help & User Guide</span>
                  </button>

                  {/* Gmail Login / Logout Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('sps_authorized_user_email');
                        window.location.reload();
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 text-red-300 font-bold flex items-center justify-between transition-all border border-red-900/40 text-[11px]"
                  >
                    <span className="flex items-center gap-2">🔑 Logout / Switch Gmail Account</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400 text-center">
                  Gmail Authorization • Cloud Room <strong className="text-amber-400">{roomId || 'SPS-CLOUD-8821'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
