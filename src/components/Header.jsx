import React, { useState } from 'react';
import { 
  Film, Folder, Wand2, Cloud, Settings, Lock, Sparkles, LayoutGrid, FileText, Save, FolderKanban, Zap, CheckCircle2, Video, Download, Upload, Check, Edit3, Moon, Sun, Scroll, HelpCircle, ChevronDown, RefreshCw
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
  onOpenLoginModal,
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
      let authEmail = localStorage.getItem('sps_authorized_user_email');
      
      // Auto-detect email from URL query parameter if not yet in localStorage
      if (!authEmail) {
        const urlParams = new URLSearchParams(window.location.search);
        authEmail = urlParams.get('email') || urlParams.get('phone');
        if (authEmail) {
          localStorage.setItem('sps_authorized_user_email', authEmail);
        }
      }

      const savedUsers = localStorage.getItem('sps_authorized_phone_users');
      if (savedUsers) {
        try {
          const users = JSON.parse(savedUsers);
          if (authEmail) {
            const cleanAuth = authEmail.trim().toLowerCase();
            const found = users.find(u => 
              (u.email && u.email.trim().toLowerCase() === cleanAuth) || 
              (u.phone && u.phone.trim().toLowerCase() === cleanAuth)
            );
            if (found) return found;
          }
          // Default fallback matching for Varshini if non-admin user
          if (!isAdminLoggedIn) {
            const varshini = users.find(u => u.email && u.email.toLowerCase().includes('varshini'));
            if (varshini) return varshini;
          }
          if (users.length > 0) return users[0];
        } catch (e) {}
      }
    }
    return {
      name: isAdminLoggedIn ? 'Pedditi Ram' : 'Pedditi Varshini',
      designation: 'Lead Director',
      role: isAdminLoggedIn ? 'Director & Owner' : 'Email Authorized Collaborator',
      email: isAdminLoggedIn ? 'pedditiram@gmail.com' : 'pedditivarshini@gmail.com',
      allottedProjects: [projectTitle || 'STAGE PRODUCTION STUDIO']
    };
  };

  const [currentUser, setCurrentUser] = useState(getLoggedInUser);

  // Real-time automatic synchronization when collaborator projects or profiles change
  React.useEffect(() => {
    const handleUpdate = () => {
      setCurrentUser(getLoggedInUser());
    };
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('sps_collaborators_updated', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('sps_collaborators_updated', handleUpdate);
    };
  }, [isAdminLoggedIn, projectTitle]);

  const userName = currentUser.name || (isAdminLoggedIn ? 'Pedditi Ram' : 'Collaborator');
  const userDesignation = currentUser.designation || 'Lead Director';
  const userRole = currentUser.role || (isAdminLoggedIn ? 'Director & Owner' : 'Editor');
  const firstLetter = userName.trim().charAt(0).toUpperCase() || 'P';
  const fourLetterName = userName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PEDD';
  const authEmail = currentUser.email || (isAdminLoggedIn ? 'pedditiram@gmail.com' : 'user@gmail.com');
  const allottedProjects = currentUser.allottedProjects || [projectTitle || 'Active Stage Production Project'];

  // Generate unique color gradient for each user based on name hash
  const USER_GRADIENTS = [
    'from-cyan-500 via-blue-600 to-indigo-600',       // Cyan Blue
    'from-emerald-400 via-teal-600 to-cyan-600',      // Emerald Teal
    'from-purple-500 via-violet-600 to-indigo-600',   // Purple Violet
    'from-amber-400 via-orange-500 to-rose-600',      // Warm Sunset
    'from-fuchsia-500 via-pink-600 to-rose-600',      // Pink Rose
    'from-sky-400 via-indigo-600 to-blue-700',        // Sky Blue
    'from-lime-400 via-emerald-600 to-teal-700',      // Fresh Lime
    'from-rose-500 via-red-600 to-amber-600',         // Crimson Flame
  ];

  const getUserGradient = (name = '') => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % USER_GRADIENTS.length;
    return USER_GRADIENTS[idx];
  };

  const userColorGradient = getUserGradient(userName);

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/90 shadow-xl px-3 sm:px-4 py-2 shrink-0 w-full font-mono text-xs">
      {/* Click outside backdrop when profile dropdown is open */}
      {isProfileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" 
          onClick={() => setIsProfileOpen(false)} 
        />
      )}

      <div className="w-full flex items-center justify-between gap-3 relative">
        
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
          
          {/* Sync All Projects & Data to Cloud Database Button */}
          <button
            type="button"
            onClick={onSaveProject}
            className={`p-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all border shadow shrink-0 ${
              isProjectSavedToast
                ? 'bg-emerald-500 text-zinc-950 border-emerald-400 scale-105'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40'
            }`}
            title={isProjectSavedToast ? "✓ All Data Synced to Cloud DB!" : "⚡ Sync All Projects, Shots & Collaborator Data to Cloud Database"}
          >
            <RefreshCw className={`w-4 h-4 ${isProjectSavedToast ? 'animate-spin' : ''}`} />
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

          {/* EXTREME TOP RIGHT: Logged-In User Profile (Round Circle Icon with Unique User Color + 4-Letter Name) */}
          <div className="shrink-0 relative">
            <button
              type="button"
              onClick={() => {
                setCurrentUser(getLoggedInUser());
                setIsProfileOpen(!isProfileOpen);
              }}
              className="flex items-center gap-2 p-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 transition-all cursor-pointer shadow shrink-0"
              title="Click to view logged-in profile, designation & allotted projects"
            >
              {/* Round Circle Avatar Icon with User-Unique Gradient Color */}
              <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${userColorGradient} text-white font-black text-xs font-mono flex items-center justify-center shadow shrink-0 ring-1 ring-white/20`}>
                {firstLetter}
              </div>

              {/* 4-Letter Name Display */}
              <span className="font-bold text-white text-xs tracking-wide whitespace-nowrap block">{fourLetterName}</span>

              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isProfileOpen ? 'rotate-180 text-amber-400' : ''}`} />
            </button>

            {/* Profile & Designation Fixed High Z-Index Dropdown Menu (Theme Adaptive: Paper Light & Dark Cyber Modes) */}
            {isProfileOpen && (
              <div className={`fixed top-12 right-2 sm:right-4 w-80 rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 font-mono text-xs text-left animate-in fade-in zoom-in-95 border-2 ${
                colorTheme === 'paper' 
                  ? 'bg-white text-slate-900 border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.15)]' 
                  : 'bg-slate-950 text-white border-cyan-500/50 shadow-[0_25px_70px_rgba(0,0,0,0.95)]'
              }`}>
                
                {/* User Info & Designation Header */}
                <div className={`flex items-center gap-3 pb-3 border-b ${colorTheme === 'paper' ? 'border-slate-200' : 'border-slate-800'}`}>
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${userColorGradient} flex items-center justify-center text-white font-black text-base shadow-lg shrink-0 tracking-wider ring-2 ring-white/40`}>
                    {firstLetter}
                  </div>
                  <div className="flex flex-col min-w-0 leading-snug">
                    <span className={`font-black text-base truncate font-sans block tracking-tight ${colorTheme === 'paper' ? 'text-slate-900' : 'text-white'}`}>{userName}</span>
                    <span className={`text-xs font-bold block mt-0.5 ${colorTheme === 'paper' ? 'text-cyan-700' : 'text-cyan-300'}`}>💼 {userDesignation}</span>
                    <span className={`text-[11px] font-bold block mt-0.5 ${colorTheme === 'paper' ? 'text-amber-700' : 'text-amber-300'}`}>👑 {userRole}</span>
                    <span className={`text-[10.5px] truncate block mt-0.5 ${colorTheme === 'paper' ? 'text-slate-600' : 'text-slate-300'}`}>📧 {authEmail}</span>
                  </div>
                </div>

                {/* Projects Shared / Allotted Section */}
                <div className="space-y-1.5">
                  <span className={`text-xs font-bold block flex items-center gap-1.5 font-sans ${colorTheme === 'paper' ? 'text-slate-800' : 'text-slate-200'}`}>
                    <FolderKanban className="w-3.5 h-3.5 text-amber-500" />
                    Projects Shared & Allotted ({allottedProjects.length}):
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {allottedProjects.map((proj, pIdx) => (
                      <div key={pIdx} className={`p-2 rounded-xl border flex items-center justify-between text-[11px] shadow-sm ${
                        colorTheme === 'paper' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
                      }`}>
                        <span className="font-bold truncate max-w-[160px] font-sans">{proj}</span>
                        <span className="text-[9.5px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold shrink-0 shadow-xs">
                          🟢 Access Allotted
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Action & Login / Logout Controls */}
                <div className={`space-y-2 pt-2 border-t ${colorTheme === 'paper' ? 'border-slate-200' : 'border-slate-800'}`}>
                  <button
                    type="button"
                    onClick={() => { setIsProfileOpen(false); if (onOpenAdminModal) onOpenAdminModal(); }}
                    className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center justify-between transition-all border text-xs shadow-sm ${
                      colorTheme === 'paper' 
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300' 
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2"><Settings className="w-4 h-4 text-amber-500" /> Admin & Project Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setIsProfileOpen(false); if (onOpenHelpModal) onOpenHelpModal(); }}
                    className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center justify-between transition-all border text-xs shadow-sm ${
                      colorTheme === 'paper' 
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300' 
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2"><HelpCircle className="w-4 h-4 text-cyan-600" /> Help & User Guide</span>
                  </button>

                  {/* Gmail Login / Logout Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('sps_authorized_user_email');
                        localStorage.removeItem('sps_is_admin_logged_in');
                        window.history.replaceState({}, '', window.location.pathname);
                        window.dispatchEvent(new Event('sps_collaborators_updated'));
                        if (onOpenLoginModal) {
                          onOpenLoginModal();
                        } else {
                          window.location.reload();
                        }
                      }
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black flex items-center justify-between transition-all border border-red-400 text-xs shadow-md cursor-pointer"
                  >
                    <span className="flex items-center gap-2">🔑 Logout / Switch Gmail Account</span>
                  </button>
                </div>

                <div className={`pt-2 border-t text-[10px] text-center font-bold ${colorTheme === 'paper' ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
                  Gmail Authorization • Cloud Room <strong className="text-amber-600 font-mono">{roomId || 'SPS-CLOUD-8821'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
