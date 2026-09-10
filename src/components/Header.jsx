import React, { useState, useEffect } from 'react';
import { readCloudSyncHealth, syncBackendLabel } from '../utils/cloudSyncHealth';
import { managedCreditStatus } from '../utils/saasControl';
import { APP_VERSION_NAME } from '../utils/runtimeEnv';
import StudioProfileControl from './StudioProfileControl';
import HeaderDriveMenu from './HeaderDriveMenu';
import HeaderSaveMenu from './HeaderSaveMenu';
import {
  getAllottedProjectTitles,
  isStudioAdmin,
  isStudioOwner,
  getCurrentUserEmail,
  isGuestSession,
  canCreateOrDeleteProjects,
  filterAllottedTitlesToLiveLibrary,
  getLiveProjectLibrary,
  isStudioModuleEnabled,
  areAllConsolesOff,
  setPresentationMode
} from '../utils/projectPermissions';

function MastTab({ selected = false, onClick, title, label }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={title}
      title={title}
      onClick={onClick}
      className={`sps-quiet-link ${selected ? 'is-current' : 'is-muted'}`}
    >
      {label}
    </button>
  );
}

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
  const [llmBusy, setLlmBusy] = useState('');

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
    const onLlm = (e) => {
      const phase = e?.detail?.phase;
      const ctx = e?.detail?.context || 'LLM';
      if (phase === 'start') setLlmBusy(ctx);
      else setLlmBusy('');
    };
    window.addEventListener('sps_llm_activity', onLlm);
    return () => window.removeEventListener('sps_llm_activity', onLlm);
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

    if (isAdminLoggedIn && isStudioAdmin(getCurrentUserEmail() || 'admin@stageworkstudio.com')) {
      const activeEmail = getCurrentUserEmail() || 'admin@stageworkstudio.com';
      return {
        name: 'Studio Admin',
        designation: 'Studio Admin & Executive Producer',
        email: activeEmail,
        role: 'Admin',
        isStudioAdmin: true,
        allottedProjects: ['All Studio Projects (Full Access)']
      };
    }

    return {
      name: 'Sign in',
      designation: 'Access panel required',
      role: 'Logged out',
      email: 'Click to sign in',
      allottedProjects: []
    };
  };

  const [currentUser, setCurrentUser] = useState(getLoggedInUser);
  const isGuest = isGuestSession();
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

  const withGuestGuard = (label, fn) => () => {
    if (isGuest) {
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

  const userName = currentUser.name || (isAdminLoggedIn ? 'Studio Admin' : 'Collaborator');
  const userDesignation = currentUser.designation || 'Lead Director';
  const userRole = currentUser.role || (isAdminLoggedIn ? 'Admin' : 'Editor');
  const firstLetter = userName.trim().charAt(0).toUpperCase() || 'S';
  const fourLetterName = userName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'STUD';
  const authEmail = currentUser.email || (isAdminLoggedIn ? 'Studio Admin' : 'user@gmail.com');
  // Owner: live library titles only. Collaborators: allotted ∩ live (drops deleted 002, etc.)
  const liveLibrary = getLiveProjectLibrary();
  const allottedProjects = isGuest
    ? []
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
            className="sps-quiet-link is-muted shrink-0"
            title="Navigator (Shift+Space · swipe from left · two-finger tap)"
            aria-label="Open studio navigator"
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                redirectGuest('Projects Console');
                return;
              }
              onOpenProjectConsole?.();
            }}
            className="sps-quiet-link shrink-0"
            title={isGuest ? 'Sign in to open Projects' : 'Projects'}
          >
            Projects
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
          <div className="sps-header-rooms sps-quiet-links" role="tablist" aria-label="Studio rooms">
            {demoMode ? (
              <button
                type="button"
                className="sps-quiet-link"
                title="Turn off presentation mode"
                onClick={() => setPresentationMode(false)}
              >
                Presentation
              </button>
            ) : null}
            {consoleOn('writer') ? (
              <MastTab
                selected={activeView === 'screenplay'}
                title="Writer"
                label="Writer"
                onClick={() => {
                  if (isGuest) {
                    redirectGuest('Writer Console');
                    return;
                  }
                  if (demoMode) setPresentationMode(false);
                  if (typeof onOpenWriterConsole === 'function') onOpenWriterConsole('screenplay');
                  else setActiveView('screenplay');
                }}
              />
            ) : null}
            {consoleOn('matrix') ? (
              <MastTab
                selected={activeView === 'spreadsheet'}
                title="Matrix"
                label="Matrix"
                onClick={() => {
                  if (isGuest) {
                    redirectGuest('Cinema Matrix');
                    return;
                  }
                  if (demoMode) setPresentationMode(false);
                  setActiveView('spreadsheet');
                }}
              />
            ) : null}
            {consoleOn('form') ? (
              <MastTab
                selected={activeView === 'form'}
                title="Form"
                label="Form"
                onClick={() => {
                  if (isGuest) {
                    redirectGuest('Studio Form');
                    return;
                  }
                  if (demoMode) setPresentationMode(false);
                  setActiveView('form');
                }}
              />
            ) : null}
            {consoleOn('stage') ? (
              <MastTab
                selected={activeView === 'canvas'}
                title="3D Stage"
                label="Stage"
                onClick={() => {
                  if (isGuest) {
                    redirectGuest('Director Canvas');
                    return;
                  }
                  if (demoMode) setPresentationMode(false);
                  setActiveView('canvas');
                }}
              />
            ) : null}
            {consoleOn('cast') ? (
              <MastTab selected={activeView === 'cast'} title="Characters" label="Characters" onClick={withGuestGuard('Character Bible', onOpenCharacterBible)} />
            ) : null}
            {consoleOn('world') ? (
              <MastTab selected={activeView === 'world'} title="World" label="World" onClick={withGuestGuard('World & Environment', onOpenWorldEnvironment)} />
            ) : null}
              {consoleOn('storyboard') ? (
                <MastTab selected={activeView === 'storyboard'} title="Storyboard" label="Storyboard" onClick={withGuestGuard('Storyboard', onOpenStoryboard)} />
              ) : null}
              {consoleOn('promo') ? (
                <MastTab selected={activeView === 'promo'} title="Promo Pack" label="Promo" onClick={withGuestGuard('Promo Pack', onOpenPromoPack)} />
              ) : null}
              {consoleOn('campaign') ? (
                <MastTab selected={activeView === 'campaign'} title="Campaign Kit" label="Campaign" onClick={withGuestGuard('Campaign Kit', onOpenCampaignKit)} />
              ) : null}
              {consoleOn('pitch') ? (
                <MastTab selected={activeView === 'pitch'} title="Pitch Deck" label="Pitch" onClick={withGuestGuard('Pitch Deck', onOpenPitchDeck)} />
              ) : null}
              {consoleOn('budget') ? (
                <MastTab selected={activeView === 'budget'} title="Budget" label="Budget" onClick={withGuestGuard('Budget', onOpenBudgetConsole)} />
              ) : null}
              {consoleOn('reel') ? (
                <MastTab selected={activeView === 'reel'} title="Reel" label="Reel" onClick={withGuestGuard('Feature reel', onOpenFeatureReel)} />
              ) : null}
              {consoleOn('compile') ? (
                <MastTab selected={activeView === 'compile'} title="Compile" label="Compile" onClick={withGuestGuard('Prompt Compiler', onOpenCompiler)} />
              ) : null}
              {consoleOn('generate') ? (
                <MastTab selected={activeView === 'generate'} title="Generate" label="Generate" onClick={withGuestGuard('Generate desk', onOpenGenerateDesk)} />
              ) : null}
          </div>
        </div>

        <div className="sps-header-rail">
          <HeaderSaveMenu
            quiet
            lookOnly={isGuest}
            projectTitle={projectTitle}
            autoSaveIntervalId={autoSaveIntervalId}
            onChangeAutoSaveInterval={onChangeAutoSaveInterval}
            onSaveNow={onDurableProjectSave || onSaveProject}
            isSaving={isDurableSaving}
            lastSavedAt={lastDurableSaveAt}
            lastVersionFile={lastVersionFile}
            isSavedToast={isProjectSavedToast}
          />
          <div className="sps-quiet-links sps-header-rail-links">
          <button type="button" onClick={onUndo} disabled={!canUndo} className={`sps-quiet-link ${canUndo ? '' : 'is-muted'}`} title="Undo">
            Undo
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className={`sps-quiet-link ${canRedo ? '' : 'is-muted'}`} title="Redo">
            Redo
          </button>
          <button
            type="button"
            onClick={() => onOpenCollabChat?.()}
            className={`sps-quiet-link ${collabChatOpen ? '' : 'is-muted'}`}
            title="Chat"
          >
            Chat{unreadChatCount > 0 && !collabChatOpen ? ` ${unreadChatCount > 9 ? '9+' : unreadChatCount}` : ''}
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
                  className={`sps-quiet-link ${isActiveUsersOpen ? '' : 'is-muted'}`}
                  title={`${liveCount} online`}
                  aria-label={`Users, ${liveCount} online`}
                  aria-expanded={isActiveUsersOpen}
                >
                  Users
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
          <button
            type="button"
            onClick={onSaveProject}
            disabled={isCloudSyncing || isGuest}
            className={`sps-quiet-link ${isCloudSyncing ? '' : 'is-muted'}`}
            title={
              isCloudSyncing
                ? 'Cloud syncing…'
                : `Cloud sync · ${syncBackendLabel(syncHealth?.backend)}${
                    syncHealth?.kvConfigured ? ' (KV)' : ''
                  }${syncHealth?.failStreak ? ` · ${syncHealth.failStreak} fail(s)` : ''} — click to push & pull now`
            }
            aria-label="Cloud sync"
          >
            {isCloudSyncing ? 'Syncing' : 'Sync'}
          </button>
          {llmBusy ? (
            <span className="sps-quiet-link pointer-events-none" title={`LLM · ${llmBusy}`}>
              LLM
            </span>
          ) : null}
          {creditStatus?.relevant && creditStatus.level !== 'ok' ? (
            <button
              type="button"
              className="sps-quiet-link"
              title={creditStatus.message}
              onClick={() => onOpenAdminModal?.()}
            >
              {creditStatus.level === 'empty' ? 'Credits 0' : `Credits ${creditStatus.credits}`}
            </button>
          ) : null}
          <HeaderDriveMenu
            quiet
            lookOnly={isGuest}
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
            className={`sps-quiet-link ${isAdminLoggedIn ? '' : 'is-muted'}`}
            title={isAdminLoggedIn ? 'Settings' : 'Sign in for settings'}
          >
            {isAdminLoggedIn ? 'Settings' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={onOpenHelpModal}
            className="sps-quiet-link is-muted"
            title="Help and keyboard shortcuts"
          >
            Help
          </button>
          {typeof onOpenAppVersionModal === 'function' ? (
            <button
              type="button"
              onClick={() => onOpenAppVersionModal()}
              className="sps-quiet-link is-muted"
              title={`Build ${APP_VERSION_NAME} · ${appVersionMode === 'cloud' ? 'Cloud' : 'Local'} mode`}
              aria-label={`App build ${APP_VERSION_NAME}, ${appVersionMode} mode`}
            >
              {appVersionMode === 'cloud' ? 'Cloud' : 'Local'}
            </button>
          ) : null}
          {typeof onTogglePinHeader === 'function' ? (
            <button
              type="button"
              className={`sps-quiet-link ${headerPinned ? '' : 'is-muted'}`}
              title={headerPinned ? 'Unpin — hide studio bar until you hover' : 'Pin studio bar'}
              aria-label={headerPinned ? 'Unpin and hide studio bar' : 'Pin studio bar'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePinHeader();
              }}
            >
              {headerPinned ? 'Unpin' : 'Pin'}
            </button>
          ) : null}
          </div>

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
                  className="sps-quiet-link"
                >
                  Presentation
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
