import React, { useState, useEffect } from 'react';
import { readCloudSyncHealth, syncBackendLabel } from '../utils/cloudSyncHealth';
import { managedCreditStatus } from '../utils/saasControl';
import {
  IconScript as Scroll,
  IconMatrix as LayoutGrid,
  IconForm as FileText,
  IconStage as Video,
  IconCast as Users,
  IconWorld as Globe2,
  IconLibrary as FolderKanban,
  IconCompile as Sparkles,
  IconPromo as PromoMark,
  IconCampaign as CampaignMark,
  IconStoryboard as StoryboardMark,
  IconBudget as BudgetMark,
  IconClapper as PitchMark,
  IconReel as ReelMark,
  IconSpark as GenerateMark,
  IconUndo as RotateCcw,
  IconRedo as RotateCw,
  IconCloud as Cloud,
  IconGear as Settings,
  IconHelp as HelpCircle,
  IconChat as MessageSquare,
  IconExpand as Maximize2,
  IconMoon as Moon,
  IconLock as Lock,
  IconDownload as Download,
  IconChevronUp as ChevronUp,
  IconSync as RefreshCw,
  IconBrain as Brain,
  IconNav as NavMark
} from './StudioIcons';
import { PinBarButton } from './HoverPinBar';
import StudioProfileControl from './StudioProfileControl';
import HeaderDriveMenu from './HeaderDriveMenu';
import HeaderSaveMenu from './HeaderSaveMenu';
import {
  getAllottedProjectTitles,
  isStudioAdmin,
  isStudioOwner,
  getCurrentUserEmail,
  isGuestSession,
  canGuestBrowseApp,
  canCreateOrDeleteProjects,
  filterAllottedTitlesToLiveLibrary,
  getLiveProjectLibrary,
  isStudioModuleEnabled,
  areAllConsolesOff,
  setPresentationMode
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
  onOpenGenerateDesk,
  onOpenPromoPack,
  onOpenCampaignKit,
  onOpenStoryboard,
  onOpenPitchDeck,
  onOpenBudgetConsole,
  showBudgetConsole = false,
  showPromoConsole = true,
  showPitchConsole = true,
  showReelConsole = true,
  onOpenFeatureReel,
  onOpenAdminModal,
  onOpenProjectConsole,
  onOpenCharacterBible,
  onOpenWorldEnvironment,
  onOpenWriterConsole,
  onOpenHelpModal,
  onOpenNavigatorShortcutHelp,
  onOpenStudioBrain,
  onOpenLoginModal,
  onSwitchAccount,
  onLogout,
  onOpenInvestorDeck,
  appVersionMode = 'local',
  onOpenAppVersionModal,
  roomId,
  collaboratorCount,
  activeRemoteUsers = [],
  isAdminLoggedIn,
  showCanvasTab = false,
  onSaveProject,
  onDurableProjectSave,
  autoSaveIntervalId = '5m',
  onChangeAutoSaveInterval,
  lastDurableSaveAt = null,
  lastVersionFile = '',
  isDurableSaving = false,
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
  onMinimizeHeader,
  headerPinned = false,
  onTogglePinHeader,
  onOpenCollabChat,
  collabChatOpen = false,
  unreadChatCount = 0,
  onOpenNavigator,
  shots = [],
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitleInput, setTempTitleInput] = useState(projectTitle);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isActiveUsersOpen, setIsActiveUsersOpen] = useState(false);
  const [syncHealth, setSyncHealth] = useState(() => readCloudSyncHealth());
  const [creditStatus, setCreditStatus] = useState(() => managedCreditStatus());

  useEffect(() => {
    const refresh = () => setSyncHealth(readCloudSyncHealth());
    refresh();
    window.addEventListener('sps_cloud_sync_health_updated', refresh);
    return () => window.removeEventListener('sps_cloud_sync_health_updated', refresh);
  }, []);

  useEffect(() => {
    const refreshCredits = () => setCreditStatus(managedCreditStatus());
    refreshCredits();
    window.addEventListener('sps_saas_changed', refreshCredits);
    return () => window.removeEventListener('sps_saas_changed', refreshCredits);
  }, []);

  useEffect(() => {
    if (!creditStatus?.relevant || creditStatus.level === 'ok') return undefined;
    const key = `sps_credit_low_toast_${creditStatus.level}_${creditStatus.credits}`;
    try {
      if (sessionStorage.getItem(key)) return undefined;
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    showNotice(creditStatus.message);
    return undefined;
  }, [creditStatus]);

  useEffect(() => {
    const onFail = (e) => {
      showNotice(e?.detail?.message || 'Cloud sync failed 3 times in a row.');
    };
    window.addEventListener('sps_cloud_sync_fail_alert', onFail);
    return () => window.removeEventListener('sps_cloud_sync_fail_alert', onFail);
  }, []);

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
        showNotice('Only the studio admin can rename this project.');
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
          role: isStudioAdmin(cleanAuth) ? 'Admin' : 'Email Authorized Collaborator',
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
        role: 'Admin',
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
  const [guestBrowse, setGuestBrowse] = useState(() => canGuestBrowseApp());
  const lookOnly = isGuest && guestBrowse;
  const [notice, setNotice] = useState('');

  const showNotice = (msg) => {
    setNotice(msg);
    window.clearTimeout(showNotice._t);
    showNotice._t = window.setTimeout(() => setNotice(''), 3200);
  };

  const redirectGuest = (label = 'this studio area') => {
    showNotice(`Sign in to use ${label}.`);
    onOpenLoginModal?.();
  };

  const withGuestGuard = (label, fn, { allowLook } = { allowLook: true }) => () => {
    if (isGuest && !(allowLook && guestBrowse)) {
      redirectGuest(label);
      return;
    }
    fn?.();
  };

  const consoleOn = (id) => (id === 'budget' ? showBudgetConsole : isStudioModuleEnabled(id));
  const demoMode = areAllConsolesOff();

  // Real-time automatic synchronization when collaborator projects or profiles change
  React.useEffect(() => {
    const handleUpdate = () => {
      setCurrentUser(getLoggedInUser());
      setGuestBrowse(canGuestBrowseApp());
    };
    if (isProfileOpen) {
      handleUpdate();
    }
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('sps_collaborators_updated', handleUpdate);
    window.addEventListener('sps_projects_updated', handleUpdate);
    window.addEventListener('sps_guest_browse_changed', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('sps_collaborators_updated', handleUpdate);
      window.removeEventListener('sps_projects_updated', handleUpdate);
      window.removeEventListener('sps_guest_browse_changed', handleUpdate);
    };
  }, [isAdminLoggedIn, projectTitle, isProfileOpen]);

  const userName = currentUser.name || (isAdminLoggedIn ? 'Pedditi Ram' : 'Collaborator');
  const userDesignation = currentUser.designation || 'Lead Director';
  const userRole = currentUser.role || (isAdminLoggedIn ? 'Admin' : 'Editor');
  const firstLetter = userName.trim().charAt(0).toUpperCase() || 'P';
  const fourLetterName = userName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PEDD';
  const authEmail = currentUser.email || (isAdminLoggedIn ? 'Studio Admin' : 'user@gmail.com');
  // Owner: live library titles only. Collaborators: allotted ∩ live (drops deleted 002, etc.)
  const liveLibrary = getLiveProjectLibrary();
  const allottedProjects = isGuest
    ? [projectTitle || 'GUEST PLAYGROUND']
    : isStudioOwner(authEmail)
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

  return (
      <header className={`sticky top-0 z-40 sps-ui-chrome bg-[var(--sps-bg)]/88 backdrop-blur-xl border-b border-[var(--sps-border)] shrink-0 w-full min-w-0 text-xs ${isProfileOpen ? 'is-menu-open' : ''}`}>
      {notice ? (
        <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] z-[70] sps-chip bg-[var(--sps-surface)] text-[var(--sps-text)] shadow-lg max-w-[min(90vw,28rem)] text-center normal-case tracking-normal">
          {notice}
        </div>
      ) : null}

      <div
        className="sps-header-bar w-full min-w-0 relative"
        style={{ paddingLeft: '12px', paddingRight: '12px' }}
      >
        <div className="sps-header-identity">
          <button
            type="button"
            onClick={() => onOpenNavigator?.()}
            className="sps-icon-btn shrink-0"
            title="Navigator (Shift+Space · swipe from left · two-finger tap)"
            aria-label="Open studio navigator"
          >
            <NavMark className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (isGuest && !lookOnly) {
                redirectGuest('Projects Console');
                return;
              }
              onOpenProjectConsole?.();
            }}
            className="sps-icon-btn shrink-0"
            title={isGuest && !lookOnly ? 'Guest: sign in or enable Guest Browse' : 'Projects'}
          >
            <FolderKanban className="w-3.5 h-3.5" />
          </button>

          <div className="min-w-0 flex items-baseline gap-2">
            {isEditingTitle ? (
              <input
                type="text"
                value={tempTitleInput}
                onChange={(e) => setTempTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                onBlur={handleTitleSubmit}
                autoFocus
                className="bg-transparent border-b border-[var(--sps-gold)] px-0 py-0.5 text-xs text-[var(--sps-text)] focus:outline-none max-w-[160px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!isAdminLoggedIn) {
                    showNotice('Only the studio admin can rename this project.');
                    return;
                  }
                  setTempTitleInput(projectTitle);
                  setIsEditingTitle(true);
                }}
                className="font-display italic text-[14px] text-[var(--sps-gold)] truncate text-left min-w-0 max-w-[9rem] lg:max-w-[14rem]"
                title={isAdminLoggedIn ? 'Click to edit project title' : 'Project title (admin rename only)'}
              >
                {projectTitle}
              </button>
            )}
            <span className="text-[10px] text-[var(--sps-muted)] tabular-nums shrink-0">{shotCount}</span>
          </div>
        </div>

        <div className="sps-header-work">
          <div className="sps-tabs sps-tabs-mast" role="tablist" aria-label="Studio rooms">
            {demoMode ? (
              <button
                type="button"
                className="text-[10px] uppercase tracking-[0.14em] px-2 py-1 font-semibold bg-transparent border-0 cursor-pointer"
                style={{ color: 'var(--sps-gold)' }}
                title="Turn off presentation mode"
                onClick={() => setPresentationMode(false)}
              >
                Presentation mode
              </button>
            ) : null}
            {consoleOn('writer') ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'screenplay'}
                onClick={() => {
                  if (isGuest && !lookOnly) {
                    redirectGuest('Writer Console');
                    return;
                  }
                  if (typeof onOpenWriterConsole === 'function') onOpenWriterConsole('screenplay');
                  else setActiveView('screenplay');
                }}
                title="Writer"
              >
                <Scroll className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : null}
            {consoleOn('matrix') ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'spreadsheet'}
                onClick={() => {
                  if (isGuest && !lookOnly) {
                    redirectGuest('Cinema Matrix');
                    return;
                  }
                  setActiveView('spreadsheet');
                }}
                title="Matrix"
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : null}
            {consoleOn('form') ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'form'}
                onClick={() => {
                  if (isGuest && !lookOnly) {
                    redirectGuest('Studio Form');
                    return;
                  }
                  setActiveView('form');
                }}
                title="Form"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : null}
            {consoleOn('stage') ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'canvas'}
                onClick={() => {
                  if (isGuest && !lookOnly) {
                    redirectGuest('Director Canvas');
                    return;
                  }
                  setActiveView('canvas');
                }}
                title="3D Stage"
              >
                <Video className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : null}
            <span className="sps-tabs-split" aria-hidden="true" />
            {consoleOn('cast') ? (
              <button type="button" role="tab" aria-selected={activeView === 'cast'} onClick={withGuestGuard('Character Bible', onOpenCharacterBible)} title="Characters">
                <Users className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : null}
            {consoleOn('world') ? (
              <button type="button" role="tab" aria-selected={false} onClick={withGuestGuard('World & Environment', onOpenWorldEnvironment)} title="World">
                <Globe2 className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : null}
          </div>
          <div className="sps-header-tools">
            <div className="sps-tabs sps-tabs-mast" role="tablist" aria-label="Packs and generate">
              {consoleOn('storyboard') ? (
                <button type="button" role="tab" aria-selected={activeView === 'storyboard'} onClick={withGuestGuard('Storyboard', onOpenStoryboard)} title="Storyboard">
                  <StoryboardMark className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : null}
              {consoleOn('promo') ? (
                <button type="button" role="tab" aria-selected={activeView === 'promo'} onClick={withGuestGuard('Promo Pack', onOpenPromoPack)} title="Promo Pack">
                  <PromoMark className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : null}
              {consoleOn('campaign') ? (
                <button type="button" role="tab" aria-selected={activeView === 'campaign'} onClick={withGuestGuard('Campaign Kit', onOpenCampaignKit)} title="Campaign Kit">
                  <CampaignMark className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : null}
              {consoleOn('pitch') ? (
                <button type="button" role="tab" aria-selected={activeView === 'pitch'} onClick={withGuestGuard('Pitch Deck', onOpenPitchDeck)} title="Pitch Deck">
                  <PitchMark className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : null}
              {consoleOn('budget') ? (
                <button type="button" role="tab" aria-selected={activeView === 'budget'} onClick={withGuestGuard('Budget', onOpenBudgetConsole, { allowLook: false })} title="Budget">
                  <BudgetMark className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : null}
              {consoleOn('reel') ? (
                <button type="button" role="tab" aria-selected={false} onClick={withGuestGuard('Feature reel', onOpenFeatureReel)} title="Reel">
                  <ReelMark className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : null}
              <span className="sps-tabs-split" aria-hidden="true" />
              {consoleOn('compile') ? (
                <button type="button" role="tab" aria-selected={false} onClick={withGuestGuard('Prompt Compiler', onOpenCompiler, { allowLook: false })} title="Compile">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : null}
              {consoleOn('generate') ? (
                <button type="button" role="tab" aria-selected={false} onClick={withGuestGuard('Generate desk', onOpenGenerateDesk, { allowLook: false })} title="Generate">
                  <GenerateMark className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sps-header-rail">
          <button type="button" onClick={onUndo} disabled={!canUndo} className="sps-icon-btn" title="Undo">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className="sps-icon-btn" title="Redo">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenCollabChat?.()}
            className={`sps-icon-btn relative ${collabChatOpen ? 'is-on' : ''}`}
            title="Chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {unreadChatCount > 0 && !collabChatOpen && (
              <span className="absolute -top-1 -right-1 min-w-[0.9rem] h-3.5 px-0.5 bg-[var(--sps-gold)] text-[var(--sps-on-gold)] text-[8px] flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>
          {Boolean(roomId && getCurrentUserEmail()) && (() => {
            const liveCount = activeRemoteUsers.length + 1;
            const AVATAR_COLORS = [
              'from-emerald-500 to-teal-700',
              'from-amber-500 to-orange-600',
              'from-violet-500 to-indigo-700',
              'from-rose-500 to-pink-600',
              'from-sky-500 to-blue-700',
            ];

            return (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsActiveUsersOpen((v) => !v);
                  }}
                  className="sps-icon-btn"
                  title={`${liveCount} online`}
                  aria-label={`Users, ${liveCount} online`}
                  aria-expanded={isActiveUsersOpen}
                >
                  <Users className="w-3.5 h-3.5" />
                </button>

                {isActiveUsersOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[45]"
                      onClick={() => setIsActiveUsersOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="sps-dropdown sps-panel-enter absolute right-0 top-full mt-2 w-[min(100vw-1rem,20rem)] sm:w-80 z-[60]">
                      <div className="sps-dropdown-head flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-semibold tracking-tight">
                            {liveCount} online
                          </p>
                          <p className="text-[10px] mt-0.5 text-[var(--sps-muted)]">
                            <span className="font-semibold text-[var(--sps-text)]">{projectTitle || 'This project'}</span>
                            {roomId ? <> · <span className="font-mono">{roomId}</span></> : null}
                          </p>
                        </div>
                        <span className="sps-chip !text-[var(--sps-on-gold)] !bg-[var(--sps-gold)] !border-[var(--sps-gold)]">
                          Live
                        </span>
                      </div>
                      <ul className="max-h-72 overflow-y-auto py-1">
                        <li className={`px-3 py-2.5 flex items-center gap-2.5 ${colorTheme === 'paper' ? 'bg-emerald-50/80' : 'bg-white/5'}`}>
                          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 text-[10px] font-black text-white flex items-center justify-center shrink-0 ring-2 ring-cyan-300/50">
                            {firstLetter || 'Y'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[12px] font-bold truncate ${colorTheme === 'paper' ? 'text-slate-900' : 'text-white'}`}>
                              {userName || 'You'}
                            </p>
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
                  </>
                )}
              </div>
            );
          })()}

          <HeaderSaveMenu
            lookOnly={lookOnly}
            projectTitle={projectTitle}
            autoSaveIntervalId={autoSaveIntervalId}
            onChangeAutoSaveInterval={onChangeAutoSaveInterval}
            onSaveNow={onDurableProjectSave || onSaveProject}
            isSaving={isDurableSaving}
            lastSavedAt={lastDurableSaveAt}
            lastVersionFile={lastVersionFile}
            isSavedToast={isProjectSavedToast}
          />

          <button
            type="button"
            onClick={onSaveProject}
            disabled={isCloudSyncing || lookOnly}
            className={`sps-icon-btn ${isProjectSavedToast || isCloudSyncing ? 'is-on' : ''}`}
            title={
              isCloudSyncing
                ? 'Cloud syncing…'
                : `Cloud sync · backend ${syncBackendLabel(syncHealth?.backend)}${
                    syncHealth?.kvConfigured ? ' (KV)' : ''
                  }${syncHealth?.failStreak ? ` · ${syncHealth.failStreak} fail(s)` : ''}`
            }
          >
            {isCloudSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
          </button>
          {creditStatus?.relevant && creditStatus.level !== 'ok' ? (
            <button
              type="button"
              className={`sps-chip text-[9px] font-mono ${
                creditStatus.level === 'empty' ? 'text-red-400 border-red-500/50' : 'text-amber-300 border-amber-500/40'
              }`}
              title={creditStatus.message}
              onClick={() => onOpenAdminModal?.()}
            >
              {creditStatus.level === 'empty' ? 'Credits 0' : `Credits ${creditStatus.credits}`}
            </button>
          ) : null}
          <HeaderDriveMenu
            lookOnly={lookOnly}
            project={{
              title: projectTitle,
              shots,
              targetModel,
              aspectRatio,
              roomId,
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                redirectGuest('Admin Settings');
                return;
              }
              if (!isAdminLoggedIn) {
                showNotice('Sign in as studio admin to open Settings.');
                onOpenLoginModal?.();
                return;
              }
              onOpenAdminModal?.();
            }}
            className={`sps-icon-btn ${isAdminLoggedIn ? 'is-on' : ''}`}
            title={isAdminLoggedIn ? 'Settings' : 'Sign in for settings'}
          >
            {isAdminLoggedIn ? <Settings className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onOpenNavigatorShortcutHelp?.()}
            className="sps-icon-btn"
            title="Navigator shortcut (Shift + Space)"
            aria-label="Show navigator keyboard shortcut"
          >
            <kbd style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--sps-font-mono)', lineHeight: 1 }}>⇧␣</kbd>
          </button>
          <button type="button" onClick={onOpenHelpModal} className="sps-icon-btn" title="Help">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          {typeof onTogglePinHeader === 'function' && (
              <PinBarButton
                pinned={headerPinned}
                onToggle={onTogglePinHeader}
                label="studio bar"
              />
          )}
          {typeof onMinimizeHeader === 'function' && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMinimizeHeader();
              }}
              className="sps-icon-btn"
              title="Minimize bar"
              aria-label="Minimize bar"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          {typeof onToggleFullscreen === 'function' && (
            <button type="button" onClick={onToggleFullscreen} className={`sps-icon-btn ${isFullscreen ? 'is-on' : ''}`} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <StudioProfileControl
            className="sps-header-profile"
            onSwitchAccount={onSwitchAccount}
            onLogout={onLogout}
            onOpenLogin={onOpenLoginModal}
            onOpenChange={(open) => {
              setIsProfileOpen(open);
              if (open) {
                setIsActiveUsersOpen(false);
                setCurrentUser(getLoggedInUser());
              }
            }}
            extraMenu={(close) => (
              <div className="px-2 pt-2">
                <button
                  type="button"
                  onClick={() => { close(); if (onOpenInvestorDeck) onOpenInvestorDeck(); }}
                  className="w-full py-2.5 px-3 sps-btn sps-btn-primary text-xs flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Investor Deck & Studio Showcase
                  </span>
                  <span className="text-[10px] font-mono font-bold">{isGuest ? 'Guest OK' : 'Showcase'}</span>
                </button>
                {!isGuest && allottedProjects.length > 0 ? (
                  <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                    {allottedProjects.map((proj, pIdx) => (
                      <div key={pIdx} className="sps-chip text-[10px] w-full justify-between">
                        <span className="truncate">{proj}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          />
        </div>
      </div>
    </header>
  );
}
