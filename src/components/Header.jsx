import React, { useState, useEffect } from 'react';
import { 
  Film, Cloud, HardDrive, Settings, Lock, Sparkles, LayoutGrid, FileText, FolderKanban, Video, Download, Upload, Check, Moon, Scroll, HelpCircle, ChevronDown, RefreshCw, RotateCcw, RotateCw, BookOpen, Users, MessageSquare
} from 'lucide-react';
import {
  getAllottedProjectTitles,
  isStudioAdmin,
  isStudioOwner,
  getCurrentUserEmail,
  isGuestSession,
  canCreateOrDeleteProjects,
  filterAllottedTitlesToLiveLibrary,
  getLiveProjectLibrary
} from '../utils/projectPermissions';

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
  onOpenDirectorPsychology,
  onOpenCharacterBible,
  onOpenStory,
  onOpenScriptSynopsisModal,
  onOpenHelpModal,
  onOpenLoginModal,
  onOpenInvestorDeck,
  appVersionMode = 'local',
  onOpenAppVersionModal,
  roomId,
  collaboratorCount,
  activeRemoteUsers = [],
  isAdminLoggedIn,
  showCanvasTab = false,
  onSaveProject,
  isProjectSavedToast = false,
  isCloudSyncing = false,
  shotCount = 0,
  colorTheme = 'dark',
  onChangeColorTheme,
  presetProfile = 'mythological',
  onChangePresetProfile,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  undoCount = 0,
  redoCount = 0,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenCollabChat,
  collabChatOpen = false,
  unreadChatCount = 0,
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitleInput, setTempTitleInput] = useState(projectTitle);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isActiveUsersOpen, setIsActiveUsersOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
        setIsActiveUsersOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTitleSubmit = () => {
    if (tempTitleInput.trim()) {
      if (!isAdminLoggedIn) {
        alert('🔒 ACCESS RESTRICTED:\nOnly the studio admin can rename projects.');
        setTempTitleInput(projectTitle);
        setIsEditingTitle(false);
        return;
      }
      setProjectTitle(tempTitleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const getLoggedInUser = () => {
    if (typeof window !== 'undefined') {
      let authEmail = localStorage.getItem('sps_authorized_user_email');
      
      // Invite URL may hint email for prefill only — never auto-grant a session
      if (!authEmail) {
        const urlParams = new URLSearchParams(window.location.search);
        authEmail = urlParams.get('email') || urlParams.get('phone') || '';
      }

      if (authEmail) {
        const cleanAuth = authEmail.trim().toLowerCase();
        const savedUsers = localStorage.getItem('sps_authorized_phone_users');
        if (savedUsers) {
          try {
            const users = JSON.parse(savedUsers);
            const found = users.find(u => 
              (u.email && u.email.trim().toLowerCase() === cleanAuth) || 
              (u.phone && u.phone.trim().toLowerCase() === cleanAuth)
            );
            if (found) return found;
          } catch (e) {}
        }
        const allotted = getAllottedProjectTitles(cleanAuth);
        return {
          name: cleanAuth.split('@')[0],
          designation: 'Collaborator',
          role: isStudioAdmin(cleanAuth) ? 'Owner' : 'Email Authorized Collaborator',
          email: cleanAuth,
          allottedProjects: allotted === null ? ['All Studio Projects (Full Access)'] : allotted
        };
      }
    }

    if (isAdminLoggedIn && isStudioAdmin(getCurrentUserEmail() || 'pedditiram@gmail.com')) {
      return {
        name: 'Pedditi Ram',
        designation: 'Lead Director',
        email: 'pedditiram@gmail.com',
        role: 'Owner',
        isStudioAdmin: true,
        allottedProjects: ['All Studio Projects (Full Access)']
      };
    }

    return {
      name: 'Guest / Unauthenticated',
      designation: 'Access Panel Required',
      role: 'Logged Out',
      email: 'Click to Login',
      allottedProjects: []
    };
  };

  const [currentUser, setCurrentUser] = useState(getLoggedInUser);
  const isGuest = isGuestSession();

  const redirectGuest = (label = 'this studio area') => {
    alert(
      `🔒 GUEST ACCESS\n\nUnauthenticated visitors may only view Investor Deck & Studio Showcase.\n\nSign in to use ${label}, or contact pedditiram@gmail.com for access.`
    );
    if (onOpenInvestorDeck) onOpenInvestorDeck();
  };

  const withGuestGuard = (label, fn) => () => {
    if (isGuest) {
      redirectGuest(label);
      return;
    }
    fn?.();
  };

  // Real-time automatic synchronization when collaborator projects or profiles change
  React.useEffect(() => {
    const handleUpdate = () => {
      setCurrentUser(getLoggedInUser());
    };
    if (isProfileOpen) {
      handleUpdate();
    }
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('sps_collaborators_updated', handleUpdate);
    window.addEventListener('sps_projects_updated', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('sps_collaborators_updated', handleUpdate);
      window.removeEventListener('sps_projects_updated', handleUpdate);
    };
  }, [isAdminLoggedIn, projectTitle, isProfileOpen]);

  const userName = currentUser.name || (isAdminLoggedIn ? 'Pedditi Ram' : 'Collaborator');
  const userDesignation = currentUser.designation || 'Lead Director';
  const userRole = currentUser.role || (isAdminLoggedIn ? 'Owner' : 'Editor');
  const firstLetter = userName.trim().charAt(0).toUpperCase() || 'P';
  const fourLetterName = userName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PEDD';
  const authEmail = currentUser.email || (isAdminLoggedIn ? 'pedditiram@gmail.com' : 'user@gmail.com');
  // Owner: live library titles only. Collaborators: allotted ∩ live (drops deleted 002, etc.)
  const liveLibrary = getLiveProjectLibrary();
  const allottedProjects = isStudioOwner(authEmail)
    ? liveLibrary
        .map((p) => String(p?.title || '').trim())
        .filter((t) => t && t.toUpperCase() !== 'STAGE PRODUCTION STUDIO')
    : filterAllottedTitlesToLiveLibrary(
        Array.isArray(currentUser.allottedProjects) && currentUser.allottedProjects.length > 0
          ? currentUser.allottedProjects
          : (projectTitle ? [projectTitle] : []),
        liveLibrary
      );

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

  // Detect Electron for traffic-light padding
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  return (
    <header className="sticky top-0 z-40 sps-ui-chrome bg-zinc-950/78 backdrop-blur-2xl border-b border-white/[0.09] shadow-[0_8px_32px_rgba(0,0,0,0.28)] shrink-0 w-full min-w-0 overflow-x-clip text-xs">
      {/* Click outside backdrop when profile dropdown is open */}
      {isProfileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px]" 
          onClick={() => setIsProfileOpen(false)} 
        />
      )}

      {/* macOS traffic-light drag strip — sits above content, lets user drag the window */}
      {isElectron && (
        <div
          style={{ WebkitAppRegion: 'drag', height: '4px', width: '100%' }}
          className="absolute top-0 left-0 right-0"
        />
      )}

      <div
        className="sps-header-bar w-full min-w-0 flex items-center gap-1.5 relative flex-nowrap overflow-hidden py-1.5"
        style={isElectron ? { paddingLeft: '82px', paddingRight: '8px' } : { paddingLeft: '10px', paddingRight: '8px' }}
      >
        
        {/* ========================================================================= */}
        {/* LEFT SECTION: BRAND, PROJECTS CONSOLE & ACTIVE PROJECT TITLE */}
        {/* ========================================================================= */}
        <div className="sps-header-left flex items-center gap-1.5 min-w-0 shrink">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="relative p-1.5 rounded-xl bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center shrink-0 ring-1 ring-white/20">
              <Film className="w-3.5 h-3.5" />
            </div>
            <div className="hidden 2xl:flex flex-col leading-tight min-w-0">
              <h1 className="text-[11px] font-bold text-white tracking-wide font-display truncate">
                Stage Production Studio
              </h1>
              <span className="text-[9px] text-zinc-500 font-medium tracking-wide">Pedditi Labs · Cinema craft</span>
            </div>
          </div>

          <div className="h-5 w-px bg-white/10 hidden md:block shrink-0" />

          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                redirectGuest('Projects Console');
                return;
              }
              onOpenProjectConsole?.();
            }}
            className="sps-chrome-btn inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-semibold shadow-sm shrink-0 cursor-pointer"
            title={isGuest ? 'Guest: open Investor Deck instead' : 'Projects & AI Script Breakdown Console'}
          >
            <FolderKanban className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden xl:inline text-[11px]">Projects</span>
          </button>

          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 px-2 py-1 rounded-xl min-w-0 shrink">
            {isEditingTitle ? (
              <input
                type="text"
                value={tempTitleInput}
                onChange={(e) => setTempTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                onBlur={handleTitleSubmit}
                autoFocus
                className="bg-zinc-950 border border-amber-500/60 rounded-lg px-2 py-0.5 text-xs text-amber-200 font-semibold focus:outline-none max-w-[88px] sm:max-w-[140px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!isAdminLoggedIn) {
                    alert('🔒 ACCESS RESTRICTED:\nOnly the studio admin can rename projects.');
                    return;
                  }
                  setTempTitleInput(projectTitle);
                  setIsEditingTitle(true);
                }}
                className="text-amber-200 font-semibold hover:text-amber-100 max-w-[64px] sm:max-w-[110px] lg:max-w-[140px] truncate text-left text-xs min-w-0"
                title={isAdminLoggedIn ? 'Click to edit project title' : 'Project title (admin rename only)'}
              >
                {projectTitle}
              </button>
            )}
            <span className="text-[10px] text-cyan-200 font-semibold bg-cyan-500/10 px-1.5 py-0.5 rounded-full border border-cyan-400/25 shrink-0" title={`${shotCount} shots`}>
              <span className="sm:hidden">{shotCount}</span>
              <span className="hidden sm:inline">{shotCount} shots</span>
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTER SECTION: STUDIO WORKSPACES */}
        {/* ========================================================================= */}
        <div className={`sps-header-center flex items-center gap-0.5 p-0.5 sm:p-1 rounded-2xl border min-w-0 shrink overflow-x-auto sps-header-scroll ${
          colorTheme === 'paper'
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-black/35 border-white/10 shadow-inner'
        }`}>
          {/* 1. Writer Console */}
          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                redirectGuest('Writer Console');
                return;
              }
              setActiveView("screenplay");
            }}
            className={`sps-chrome-btn relative px-1.5 sm:px-2 py-1.5 rounded-xl flex items-center gap-1 shrink-0 ${
              activeView === "screenplay"
                ? "bg-amber-400 text-zinc-950 shadow-[0_4px_16px_rgba(245,158,11,0.35)] font-semibold"
                : colorTheme === 'paper'
                  ? "text-slate-600 hover:text-amber-800 hover:bg-amber-50"
                  : "text-zinc-400 hover:text-amber-200 hover:bg-white/5"
            }`}
            title="Writer Console — Screenplay Editor & Script Synopsis"
          >
            <Scroll className="w-4 h-4 shrink-0" />
            <span className="hidden 2xl:inline text-[11px]">Writer</span>
          </button>

          {/* 2. Matrix View */}
          <button
            type="button"
            onClick={withGuestGuard('Cinema Matrix', () => setActiveView("spreadsheet"))}
            className={`sps-chrome-btn relative px-1.5 sm:px-2 py-1.5 rounded-xl flex items-center gap-1 shrink-0 ${
              activeView === "spreadsheet"
                ? "bg-cyan-400 text-zinc-950 shadow-[0_4px_16px_rgba(34,211,238,0.35)] font-semibold"
                : colorTheme === 'paper'
                  ? "text-slate-600 hover:text-cyan-800 hover:bg-cyan-50"
                  : "text-zinc-400 hover:text-cyan-200 hover:bg-white/5"
            }`}
            title="24-Craft Cinema Matrix Spreadsheet View"
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            <span className="hidden 2xl:inline text-[11px]">Matrix</span>
          </button>

          {/* 3. Studio Form */}
          <button
            type="button"
            onClick={withGuestGuard('Studio Form', () => setActiveView("form"))}
            className={`sps-chrome-btn relative px-1.5 sm:px-2 py-1.5 rounded-xl flex items-center gap-1 shrink-0 ${
              activeView === "form"
                ? "bg-emerald-400 text-zinc-950 shadow-[0_4px_16px_rgba(52,211,153,0.3)] font-semibold"
                : colorTheme === 'paper'
                  ? "text-slate-600 hover:text-emerald-800 hover:bg-emerald-50"
                  : "text-zinc-400 hover:text-emerald-200 hover:bg-white/5"
            }`}
            title="Studio Form — 24-Craft Production Form Editor"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="hidden 2xl:inline text-[11px]">Form</span>
          </button>

          {/* 4. Director Canvas */}
          {showCanvasTab && (
            <button
              type="button"
              onClick={withGuestGuard('Director Canvas', () => setActiveView("canvas"))}
              className={`sps-chrome-btn relative px-1.5 sm:px-2 py-1.5 rounded-xl flex items-center gap-1 shrink-0 ${
                activeView === "canvas"
                  ? "bg-sky-500 text-white shadow-[0_4px_16px_rgba(14,165,233,0.35)] font-semibold"
                  : colorTheme === 'paper'
                    ? "text-sky-700 hover:text-sky-900 hover:bg-sky-50"
                    : "text-zinc-400 hover:text-sky-200 hover:bg-white/5"
              }`}
              title="Director Visual Canvas View"
            >
              <Video className="w-4 h-4 shrink-0" />
              <span className="hidden 2xl:inline text-[11px]">Canvas</span>
            </button>
          )}

          <div className={`h-4 w-px my-auto shrink-0 ${colorTheme === 'paper' ? 'bg-slate-200' : 'bg-white/10'}`} />

          {/* 5. Master Character Bible Vault */}
          <button
            type="button"
            onClick={withGuestGuard('Character Bible', onOpenCharacterBible)}
            className={`sps-chrome-btn relative px-1.5 py-1.5 rounded-xl shrink-0 ${
              colorTheme === 'paper'
                ? 'text-violet-700 hover:bg-violet-50 hover:text-violet-900'
                : 'text-zinc-400 hover:bg-white/5 hover:text-violet-200'
            }`}
            title="Master Character Bible Vault"
          >
            <Users className="w-4 h-4" />
          </button>

          {/* 5b. Script Synopsis Vault */}
          <button
            type="button"
            onClick={withGuestGuard('Script Synopsis', () => {
              if (onOpenScriptSynopsisModal) onOpenScriptSynopsisModal();
              else if (onOpenStory) onOpenStory();
            })}
            className={`sps-chrome-btn relative px-1.5 py-1.5 rounded-xl shrink-0 ${
              colorTheme === 'paper'
                ? 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900'
                : 'text-zinc-400 hover:bg-white/5 hover:text-emerald-200'
            }`}
            title="Master Script Synopsis"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          {/* 6. Dedicated Director's Vision Vault */}
          <button
            type="button"
            onClick={withGuestGuard("Director's Vision", onOpenDirectorPsychology)}
            className={`sps-chrome-btn relative px-1.5 py-1.5 rounded-xl shrink-0 ${
              colorTheme === 'paper'
                ? 'text-amber-700 hover:bg-amber-50 hover:text-amber-900'
                : 'text-zinc-400 hover:bg-white/5 hover:text-amber-200'
            }`}
            title="Director's Core Vision & Script Psychology Vault"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT SECTION: SYSTEM TOOLS, SYNC, ADMIN */}
        {/* ========================================================================= */}
        <div className="sps-header-actions flex items-center gap-1 min-w-0 shrink justify-end overflow-x-auto">

          {/* UNDO & REDO BUTTONS */}
          <div className="flex items-center gap-0.5 bg-white/[0.03] p-0.5 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                canUndo
                  ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 active:scale-95"
                  : "text-zinc-600 border border-transparent cursor-not-allowed opacity-40"
              }`}
              title="Undo last edit (Cmd+Z / Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {canUndo && (
                <span className="text-[9px] bg-amber-400 text-zinc-950 px-1 rounded-full font-bold">
                  {undoCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                canRedo
                  ? "bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/30 active:scale-95"
                  : "text-zinc-600 border border-transparent cursor-not-allowed opacity-40"
              }`}
              title="Redo last undone edit (Cmd+Shift+Z / Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              {canRedo && (
                <span className="text-[9px] bg-cyan-400 text-zinc-950 px-1 rounded-full font-bold">
                  {redoCount}
                </span>
              )}
            </button>
          </div>

          {/* App Version Mode Badge (Local / Cloud) */}
          <button
            type="button"
            onClick={onOpenAppVersionModal}
            className={`py-1.5 px-2 rounded-xl border font-semibold text-[11px] flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 ${
              appVersionMode === 'local'
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border-cyan-400/30'
            }`}
            title="Click to switch App Version Mode (Local Version vs Cloud Version)"
          >
            {appVersionMode === 'local' ? (
              <>
                <HardDrive className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              </>
            )}
          </button>

          {/* Studio chat & shot comments */}
          <button
            type="button"
            onClick={() => onOpenCollabChat?.()}
            className={`sps-chrome-btn relative py-1.5 px-2 rounded-xl border font-semibold text-[11px] flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 ${
              collabChatOpen
                ? colorTheme === 'paper'
                  ? 'bg-cyan-600 text-white border-cyan-700'
                  : 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_4px_14px_rgba(34,211,238,0.3)]'
                : colorTheme === 'paper'
                  ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300'
                  : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-100 border-cyan-400/40'
            }`}
            title="Open studio chat & shot comments"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden 2xl:inline font-black">Chat</span>
            {unreadChatCount > 0 && !collabChatOpen && (
              <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>

          {/* Active users — shown whenever room collab is on (not gated by Local/Cloud badge) */}
          {Boolean(roomId && getCurrentUserEmail()) && (() => {
            const liveCount = activeRemoteUsers.length + 1;
            const hasOthers = activeRemoteUsers.length > 0;
            const AVATAR_COLORS = [
              'from-emerald-500 to-teal-700',
              'from-amber-500 to-orange-600',
              'from-violet-500 to-indigo-700',
              'from-rose-500 to-pink-600',
              'from-sky-500 to-blue-700',
            ];
            const previewUsers = activeRemoteUsers.slice(0, 3).map((u, idx) => {
              const label = u.userName || (u.userEmail || '').split('@')[0] || 'User';
              return {
                key: u.presenceId || u.userEmail || `u-${idx}`,
                initial: String(label).charAt(0).toUpperCase(),
                label,
                color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
              };
            });

            return (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsActiveUsersOpen((v) => !v)}
                  className={`sps-chrome-btn h-8 pl-1.5 pr-1.5 xl:pr-2.5 rounded-full border flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    hasOthers
                      ? colorTheme === 'paper'
                        ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-800 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-zinc-950'
                      : colorTheme === 'paper'
                        ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-100'
                  }`}
                  title={`${liveCount} online on this project`}
                  aria-label={`${liveCount} active users`}
                >
                  {/* Overlapping avatar stack */}
                  <span className="flex items-center -space-x-1.5 shrink-0">
                    <span className="relative z-10 w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 text-[8px] font-black text-white flex items-center justify-center ring-2 ring-white/90 shadow-sm">
                      Y
                    </span>
                    {previewUsers.map((p, i) => (
                      <span
                        key={p.key}
                        className={`relative w-5 h-5 rounded-full bg-gradient-to-br ${p.color} text-[8px] font-black text-white flex items-center justify-center ring-2 ring-white/90 shadow-sm`}
                        style={{ zIndex: 9 - i }}
                        title={p.label}
                      >
                        {p.initial}
                      </span>
                    ))}
                    {activeRemoteUsers.length > 3 && (
                      <span className="relative z-0 w-5 h-5 rounded-full bg-zinc-800 text-[8px] font-black text-white flex items-center justify-center ring-2 ring-white/90">
                        +{activeRemoteUsers.length - 3}
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={`hidden xl:inline text-[11px] font-black tracking-wide uppercase whitespace-nowrap ${
                      hasOthers
                        ? ''
                        : colorTheme === 'paper' ? 'text-emerald-900' : 'text-emerald-50'
                    }`}>
                      {liveCount} online
                    </span>
                    <span className={`xl:hidden text-[10px] font-black tabular-nums ${
                      hasOthers
                        ? ''
                        : colorTheme === 'paper' ? 'text-emerald-900' : 'text-emerald-50'
                    }`}>
                      {liveCount}
                    </span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      hasOthers ? 'bg-lime-300 animate-pulse' : 'bg-emerald-400'
                    }`} />
                  </span>
                </button>

                {isActiveUsersOpen && (
                  <div className={`sps-panel-enter absolute right-0 top-full mt-2 w-[min(100vw-1rem,20rem)] sm:w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden ${
                    colorTheme === 'paper'
                      ? 'bg-white/95 backdrop-blur-xl border-emerald-200'
                      : 'bg-zinc-950/92 backdrop-blur-xl border-emerald-500/30'
                  }`}>
                    <div className={`px-3 py-2.5 border-b flex items-center justify-between gap-2 ${
                      colorTheme === 'paper' ? 'border-emerald-100 bg-emerald-50' : 'border-white/10 bg-emerald-500/10'
                    }`}>
                      <div>
                        <p className={`text-[12px] font-black tracking-wide ${colorTheme === 'paper' ? 'text-emerald-950' : 'text-white'}`}>
                          {liveCount} online now
                        </p>
                        <p className={`text-[10px] mt-0.5 ${colorTheme === 'paper' ? 'text-emerald-800/70' : 'text-zinc-400'}`}>
                          <span className="font-semibold">{projectTitle || 'This project'}</span>
                          {roomId ? <> · <span className="font-mono">{roomId}</span></> : null}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-lime-300 animate-pulse" />
                        LIVE
                      </span>
                    </div>
                    <ul className="max-h-72 overflow-y-auto py-1">
                      <li className={`px-3 py-2.5 flex items-center gap-2.5 ${colorTheme === 'paper' ? 'bg-emerald-50/80' : 'bg-white/5'}`}>
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 text-[10px] font-black text-white flex items-center justify-center shrink-0 ring-2 ring-cyan-300/50">
                          YOU
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[12px] font-bold truncate ${colorTheme === 'paper' ? 'text-slate-900' : 'text-white'}`}>You</p>
                          <p className={`text-[10px] truncate ${colorTheme === 'paper' ? 'text-slate-500' : 'text-zinc-400'}`}>Working here now</p>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">You</span>
                      </li>
                      {activeRemoteUsers.length === 0 ? (
                        <li className={`px-3 py-4 text-[11px] ${colorTheme === 'paper' ? 'text-slate-500' : 'text-zinc-500'}`}>
                          No other remote users on this project right now.
                        </li>
                      ) : (
                        activeRemoteUsers.map((u, idx) => {
                          const label = u.userName || (u.userEmail || '').split('@')[0] || 'Collaborator';
                          const initial = String(label).charAt(0).toUpperCase();
                          const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                          return (
                            <li
                              key={u.presenceId || u.userEmail}
                              className={`px-3 py-2.5 flex items-center gap-2.5 ${
                                colorTheme === 'paper' ? 'hover:bg-emerald-50' : 'hover:bg-white/5'
                              }`}
                            >
                              <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} text-[12px] font-black text-white flex items-center justify-center shrink-0`}>
                                {initial}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[12px] font-bold truncate ${colorTheme === 'paper' ? 'text-slate-900' : 'text-white'}`}>{label}</p>
                                <p className={`text-[10px] truncate ${colorTheme === 'paper' ? 'text-slate-500' : 'text-zinc-400'}`}>
                                  {u.isEditing ? 'Editing' : 'Viewing'} {u.activeShotId || 'project'}
                                  {u.userEmail ? ` · ${u.userEmail}` : ''}
                                </p>
                              </div>
                              <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md shrink-0 ${
                                u.isEditing
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {u.isEditing ? 'Edit' : 'Live'}
                              </span>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
          
          {/* Cloud Sync Button */}
          <button
            type="button"
            onClick={onSaveProject}
            disabled={isCloudSyncing}
            className={`sps-chrome-btn py-1.5 px-2 rounded-xl duration-300 flex items-center gap-1 shadow-md shrink-0 cursor-pointer border ${
              isProjectSavedToast
                ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 font-bold border-emerald-300"
                : isCloudSyncing
                  ? "bg-amber-500 text-slate-950 font-bold border-amber-400 cursor-wait animate-pulse"
                  : colorTheme === 'paper'
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white font-semibold border-cyan-700 shadow-sm"
                    : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border-cyan-400/30"
            }`}
            title="Sync All Projects & Data to Cloud Database"
          >
            {isCloudSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-slate-950 animate-spin shrink-0" />
            ) : isProjectSavedToast ? (
              <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3.5] animate-in zoom-in spin-in-12 duration-300 shrink-0" />
            ) : (
              <RefreshCw className={`w-3.5 h-3.5 hover:rotate-180 transition-all duration-500 shrink-0 ${
                colorTheme === 'paper' ? 'text-white' : 'text-cyan-300'
              }`} />
            )}
          </button>

          {/* Export JSON Button — desktop/tablet; profile covers overflow on phones */}
          <button
            type="button"
            onClick={onExportProject}
            className="sps-chrome-btn hidden sm:inline-flex p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-zinc-300 border border-white/10 shrink-0"
            title="Export .JSON Project File"
          >
            <Download className="w-3.5 h-3.5 text-cyan-300" />
          </button>

          {/* Import JSON Button — Owner only */}
          {canCreateOrDeleteProjects() && (
            <label className="sps-chrome-btn hidden sm:inline-flex sps-touch p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-zinc-300 border border-white/10 cursor-pointer shrink-0" title="Import .JSON Project File (Owner only)">
              <Upload className="w-3.5 h-3.5 text-amber-300" />
              <input type="file" accept=".json" onChange={onImportProject} className="hidden" />
            </label>
          )}

          {/* Admin Settings Trigger */}
          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                redirectGuest('Admin Settings');
                return;
              }
              if (!isAdminLoggedIn) {
                alert('🔒 ACCESS RESTRICTED:\nOnly the studio admin can open Admin Settings (create users, allot projects, delete projects).');
                if (onOpenLoginModal) onOpenLoginModal();
                return;
              }
              if (onOpenAdminModal) onOpenAdminModal();
            }}
            className={`sps-chrome-btn p-1.5 rounded-xl border text-xs shrink-0 ${
              isAdminLoggedIn
                ? 'bg-amber-500/15 text-amber-200 border-amber-400/30 hover:bg-amber-500/25'
                : 'bg-white/[0.03] text-zinc-400 border-white/10 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title={isGuest ? 'Guest: open Investor Deck' : (isAdminLoggedIn ? 'Studio Settings (⌘K / Ctrl+K)' : 'Admin only (⌘K / Ctrl+K)')}
          >
            {isAdminLoggedIn ? <Settings className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" /> : <Lock className="w-3.5 h-3.5 text-zinc-400" />}
          </button>

          {/* Help & User Guide Trigger */}
          <button
            type="button"
            onClick={onOpenHelpModal}
            className="sps-chrome-btn hidden sm:inline-flex p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-cyan-300 border border-white/10 shrink-0"
            title="Open Help & User Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-300" />
          </button>

          {/* Color Theme Selector Pill */}
          <div className="hidden sm:flex items-center gap-0.5 bg-white/[0.03] p-0.5 rounded-xl border border-white/10 shrink-0" title="Switch App Color Theme">
            <button
              type="button"
              onClick={() => onChangeColorTheme && onChangeColorTheme('dark')}
              className={`p-1.5 rounded-lg transition-all ${
                colorTheme === 'dark' ? 'bg-zinc-800 text-amber-200 shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Cyber Dark Mode"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeColorTheme && onChangeColorTheme('paper')}
              className={`p-1.5 rounded-lg transition-all ${
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
            onClick={withGuestGuard('Prompt Compiler', onOpenCompiler)}
            className="p-1.5 px-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1 shadow border border-amber-300/40 shrink-0"
            title="Open Master Prompt Compiler"
          >
            <Sparkles className="w-3.5 h-3.5 fill-zinc-950" />
            <span className="hidden 2xl:inline">Compile</span>
          </button>
        </div>

          {/* EXTREME TOP RIGHT: Logged-In User Profile */}
          <div className="sps-header-profile shrink-0 relative">
            <button
              type="button"
              onClick={() => {
                setCurrentUser(getLoggedInUser());
                setIsProfileOpen(!isProfileOpen);
              }}
              className="sps-chrome-btn flex items-center gap-1.5 p-1 pr-1.5 xl:pr-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-cyan-400/45 cursor-pointer shadow shrink-0"
              title="Click to view logged-in profile, designation & allotted projects"
            >
              {/* Round Circle Avatar Icon with User-Unique Gradient Color */}
              <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${userColorGradient} text-white font-black text-xs font-mono flex items-center justify-center shadow shrink-0 ring-1 ring-white/20`}>
                {firstLetter}
              </div>

              {/* 4-Letter Name Display — hide on laptop widths to free toolbar space */}
              <span className="hidden 2xl:block font-bold text-white text-xs tracking-wide whitespace-nowrap">{fourLetterName}</span>

              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isProfileOpen ? 'rotate-180 text-amber-400' : ''}`} />
            </button>

            {/* Profile & Designation Fixed High Z-Index Dropdown Menu (Theme Adaptive: Paper Light & Dark Cyber Modes) */}
            {isProfileOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30" 
                  onClick={() => setIsProfileOpen(false)} 
                />
                <div className={`sps-panel-enter fixed top-12 right-2 sm:right-4 w-[min(100vw-1rem,20rem)] sm:w-80 max-h-[min(85dvh,40rem)] overflow-y-auto rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 text-xs text-left border ${
                  colorTheme === 'paper' 
                    ? 'bg-white/95 backdrop-blur-xl text-slate-900 border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.12)]' 
                    : 'bg-slate-950/92 backdrop-blur-xl text-white border-cyan-500/35 shadow-[0_25px_70px_rgba(0,0,0,0.75)]'
                }`} style={{ fontFamily: 'var(--sps-font)' }}>
                
                {/* User Info & Designation Header */}
                <div className={`flex items-center gap-3 pb-3 border-b ${colorTheme === 'paper' ? 'border-slate-200' : 'border-white/10'}`}>
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${userColorGradient} flex items-center justify-center text-white font-black text-base shadow-lg shrink-0 tracking-wider ring-2 ring-white/30`}>
                    {firstLetter}
                  </div>
                  <div className="flex flex-col min-w-0 leading-snug">
                    <span className={`font-bold text-base truncate block tracking-tight ${colorTheme === 'paper' ? 'text-slate-900' : 'text-white'}`} style={{ fontFamily: 'var(--sps-font-display)' }}>{userName}</span>
                    <span className={`text-xs font-semibold block mt-0.5 ${colorTheme === 'paper' ? 'text-cyan-700' : 'text-cyan-300'}`}>{userDesignation}</span>
                    <span className={`text-[11px] font-semibold block mt-0.5 ${colorTheme === 'paper' ? 'text-amber-700' : 'text-amber-300'}`}>{userRole}</span>
                    <span className={`text-[10.5px] truncate block mt-0.5 ${colorTheme === 'paper' ? 'text-slate-600' : 'text-slate-400'}`}>{authEmail}</span>
                  </div>
                </div>

                {/* Investor Presentation Slideshow Showcase Button */}
                <button
                  type="button"
                  onClick={() => { setIsProfileOpen(false); if (onOpenInvestorDeck) onOpenInvestorDeck(); }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs font-sans shadow-md flex items-center justify-between transition-all border border-amber-300/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
                    Investor Deck & Studio Showcase
                  </span>
                  <span className="text-[10px] bg-slate-950 text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold">
                    {isGuest ? 'Guest OK' : 'Showcase'}
                  </span>
                </button>

                {/* Projects Shared / Allotted Section — collaborators only */}
                {!isGuest && (
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
                        <span className="text-[9.5px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold shrink-0 shadow-sm">
                          Access
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {isGuest && (
                  <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
                    colorTheme === 'paper' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900/80 border-cyan-500/25 text-slate-300'
                  }`}>
                    Guest view is limited to the Investor Deck. Request access from{' '}
                    <a href="mailto:pedditiram@gmail.com" className="text-cyan-500 font-semibold underline-offset-2 hover:underline">
                      pedditiram@gmail.com
                    </a>
                    {' '}or log in below.
                  </div>
                )}

                {/* Quick Action & Login / Logout Controls */}
                <div className={`space-y-2 pt-2 border-t ${colorTheme === 'paper' ? 'border-slate-200' : 'border-slate-800'}`}>
                  {/* Mobile-only quick tools (hidden from dense header) */}
                  {!isGuest && (
                  <div className="sm:hidden grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsProfileOpen(false); onExportProject?.(); }}
                      className={`px-3 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 border text-xs ${
                        colorTheme === 'paper'
                          ? 'bg-slate-100 text-slate-900 border-slate-300'
                          : 'bg-slate-900 text-slate-100 border-slate-800'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-500" /> Export
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onChangeColorTheme?.(colorTheme === 'paper' ? 'dark' : 'paper');
                      }}
                      className={`px-3 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 border text-xs ${
                        colorTheme === 'paper'
                          ? 'bg-slate-100 text-slate-900 border-slate-300'
                          : 'bg-slate-900 text-slate-100 border-slate-800'
                      }`}
                    >
                      {colorTheme === 'paper' ? <Moon className="w-3.5 h-3.5" /> : <Scroll className="w-3.5 h-3.5 text-amber-600" />}
                      Theme
                    </button>
                  </div>
                  )}

                  {!isGuest && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      if (!isAdminLoggedIn) {
                        alert('🔒 ACCESS RESTRICTED:\nOnly the studio admin can open Admin Settings.');
                        if (onOpenLoginModal) onOpenLoginModal();
                        return;
                      }
                      if (onOpenAdminModal) onOpenAdminModal();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center justify-between transition-all border text-xs shadow-sm ${
                      colorTheme === 'paper' 
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300' 
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2"><Settings className="w-4 h-4 text-amber-500" /> Admin & Project Settings</span>
                  </button>
                  )}

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
                      if (isGuest) {
                        if (onOpenLoginModal) onOpenLoginModal();
                        return;
                      }
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('sps_user_manually_logged_out', 'true');
                        localStorage.removeItem('sps_authorized_user_email');
                        localStorage.setItem('sps_is_admin_logged_in', 'false');
                        window.history.replaceState({}, '', window.location.pathname);
                        window.dispatchEvent(new Event('sps_collaborators_updated'));
                        if (onOpenLoginModal) {
                          onOpenLoginModal();
                        } else {
                          window.location.reload();
                        }
                      }
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl font-black flex items-center justify-between transition-all border text-xs shadow-md cursor-pointer ${
                      isGuest
                        ? 'bg-gradient-to-r from-cyan-500 to-sky-500 hover:brightness-110 text-slate-950 border-cyan-300'
                        : 'bg-red-600 hover:bg-red-500 text-white border-red-400'
                    }`}
                  >
                    <span className="flex items-center gap-2">{isGuest ? 'Login / Request Access' : 'Logout / Switch account'}</span>
                  </button>
                </div>

                <div className={`pt-2 border-t text-[10px] text-center font-bold ${colorTheme === 'paper' ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
                  Gmail Authorization • Cloud Room <strong className="text-amber-600 font-mono">{roomId || 'SPS-CLOUD-8821'}</strong>
                </div>
              </div>
            </>
          )}
          </div>
      </div>
    </header>
  );
}
