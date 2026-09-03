import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, ShieldCheck, CheckCircle2, AlertCircle, User, UserCheck, Zap, Shield, ArrowRight, Film, Eye, Clapperboard, Sparkles, Monitor } from 'lucide-react';
import {
  getCurrentUserEmail,
  isStudioAdmin,
  markCollaboratorSession,
  PRIMARY_ADMIN_EMAILS,
  normalizeEmail,
  getDesignationForEmail,
  getHomeForDesignation,
  enterGuestLookSession,
  exitPresentationForWorkspace,
  setPresentationMode
} from '../utils/projectPermissions';
import { registerThisDevice, getDeviceId } from '../utils/saasControl';
import StageWorksMark from './StageWorksMark';
import { CATEGORY, PRODUCT } from '../constants/brand';

export default function LoginModal({ isOpen, onClose, setIsAdminLoggedIn, onOpenAppDemo, onOpenDesktopTrial, overlayMode = 'default' }) {
  const [loginMode, setLoginMode] = useState('gmail'); // 'gmail' | 'admin' | 'guest'
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [adminIdInput, setAdminIdInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [rememberedEmail, setRememberedEmail] = useState('');

  // Prefill last known email when modal opens — still require explicit login choice
  useEffect(() => {
    if (!isOpen) return;
    const remembered = normalizeEmail(getCurrentUserEmail());
    setRememberedEmail(remembered);
    if (remembered) setEmailInput(remembered);
    setErrorMsg('');
    setSuccessMsg('');
    setLoginMode('gmail');
  }, [isOpen]);

  if (!isOpen) return null;

  const finishGuestSession = (message) => {
    if (setIsAdminLoggedIn) setIsAdminLoggedIn(false);
    try {
      sessionStorage.setItem('sps_login_prompted', '1');
    } catch {
      /* ignore */
    }
    setSuccessMsg(message);
    setTimeout(() => onClose(), 350);
  };

  const startGuestLook = () => {
    setErrorMsg('');
    enterGuestLookSession();
    finishGuestSession('Guest look mode — browse only, nothing saves.');
  };

  const startPresentation = () => {
    setErrorMsg('');
    enterGuestLookSession();
    setPresentationMode(true);
    finishGuestSession('Presentation mode — Stage Work Studio reel.');
  };

  const startAppDemo = () => {
    setErrorMsg('');
    enterGuestLookSession();
    setPresentationMode(true);
    finishGuestSession('App demo — guided studio tour.');
    window.setTimeout(() => onOpenAppDemo?.(), 400);
  };

  const completeLogin = (email, message) => {
    const clean = normalizeEmail(email);
    const gate = registerThisDevice(clean);
    if (!gate.ok) {
      setErrorMsg(gate.error || 'License or device blocked.');
      return;
    }
    exitPresentationForWorkspace();
    markCollaboratorSession(clean);
    const admin = isStudioAdmin(clean);
    if (setIsAdminLoggedIn) setIsAdminLoggedIn(admin);
    try {
      sessionStorage.setItem('sps_session_authed', '1');
      sessionStorage.setItem('sps_login_prompted', '1');
      // Always land in Project Console after workspace login
      const home = {
        open: 'projects',
        tab: 'library',
        view: getHomeForDesignation(getDesignationForEmail(clean))?.view || 'spreadsheet'
      };
      sessionStorage.setItem('sps_login_home', JSON.stringify(home));
      window.dispatchEvent(new CustomEvent('sps_login_home', { detail: home }));
      fetch('/api/saas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', email: clean, deviceId: getDeviceId() }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
    setSuccessMsg(message);
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => {
      window.dispatchEvent(new Event('sps_collaborators_updated'));
      onClose();
    }, 500);
  };

  const handleGmailLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = normalizeEmail(emailInput);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid Gmail / Email Address.');
      return;
    }

    if (typeof window !== 'undefined') {
      const savedUsersStr = localStorage.getItem('sps_authorized_phone_users');
      let authorizedUsers = [];
      if (savedUsersStr) {
        try { authorizedUsers = JSON.parse(savedUsersStr); } catch (err) {}
      }

      localStorage.removeItem('sps_user_manually_logged_out');

      // Owner path: pedditiram@gmail.com email session (no weak password bypass required)
      if (PRIMARY_ADMIN_EMAILS.includes(cleanEmail) || cleanEmail === 'pedditiram@gmail.com') {
        completeLogin('pedditiram@gmail.com', 'Logged in as Primary Admin & Studio Owner.');
        return;
      }

      const matchedUser = authorizedUsers.find(u =>
        (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
        (u.phone && u.phone.trim().toLowerCase() === cleanEmail) ||
        (u.name && u.name.trim().toLowerCase().includes(cleanEmail.split('@')[0]))
      );

      if (matchedUser) {
        if (matchedUser.status === 'Suspended') {
          setErrorMsg('Access Suspended. Contact Studio Admin to reactivate.');
          return;
        }
        completeLogin(
          matchedUser.email || cleanEmail,
          `Welcome back, ${matchedUser.name || 'Collaborator'}. You can edit allotted projects only.`
        );
        return;
      }

      if (cleanEmail.includes('varshini')) {
        if (!authorizedUsers.some(u => (u.email || '').toLowerCase().includes('varshini'))) {
          authorizedUsers.unshift({
            name: 'Pedditi Varshini',
            designation: 'Collaborator',
            email: 'pedditivarshini@gmail.com',
            role: 'Editor',
            allottedProjects: ['KARA DUSHAN'],
            status: 'Active'
          });
          localStorage.setItem('sps_authorized_phone_users', JSON.stringify(authorizedUsers));
        }
        completeLogin('pedditivarshini@gmail.com', 'Logged in as Pedditi Varshini (collaborator).');
        return;
      }

      const urlOtp = new URLSearchParams(window.location.search).get('otp') || '';
      let issuedOtps = {};
      try {
        issuedOtps = JSON.parse(localStorage.getItem('sps_issued_invite_otps') || '{}');
      } catch (e) {}
      const issued = issuedOtps[cleanEmail] || issuedOtps[localStorage.getItem('sps_cloud_room_id') || ''] || '';
      const otpVal = otpInput.trim();
      if (otpVal && /^\d{6}$/.test(otpVal) && (otpVal === urlOtp || otpVal === String(issued))) {
        const newUser = {
          name: cleanEmail.split('@')[0].toUpperCase(),
          designation: 'Collaborator',
          email: cleanEmail,
          role: 'Editor',
          allottedProjects: [],
          status: 'Active'
        };
        authorizedUsers.push(newUser);
        localStorage.setItem('sps_authorized_phone_users', JSON.stringify(authorizedUsers));
        completeLogin(cleanEmail, `OTP verified. Ask admin to allot a project to ${cleanEmail}.`);
        return;
      }

      if (otpVal) {
        setErrorMsg('Invalid OTP. Use the invite OTP from Primary Admin.');
        return;
      }

      setErrorMsg('Email not authorized. Ask the studio Owner for an invite OTP or allotment.');
    }
  };

  const isStrongAdminPassword = (pass) => {
    const p = String(pass || '');
    if (p.length < 10) return false;
    const weak = new Set(['admin', 'admin123', 'password', 'password123', 'sps2026', 'studio2026', '1234567890']);
    return !weak.has(p.toLowerCase());
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const idInput = adminIdInput.trim();
    const passInput = adminPasswordInput.trim();
    const storedId = localStorage.getItem('sps_custom_admin_id') || '';
    const storedPass = localStorage.getItem('sps_custom_admin_password') || '';
    const customConfigured = Boolean(storedId && storedPass && isStrongAdminPassword(storedPass));

    if (
      customConfigured &&
      idInput.toLowerCase() === storedId.toLowerCase() &&
      passInput === storedPass
    ) {
      completeLogin('pedditiram@gmail.com', 'Admin authentication successful. Full studio control unlocked.');
      return;
    }

    if (!customConfigured) {
      setErrorMsg(
        'No strong Admin password is configured. Sign in via the Owner email (Email / Gmail tab), then set a strong password in Admin Settings.'
      );
      return;
    }

    setErrorMsg('Invalid Admin ID or Password. Owner recovery: use the Sign In tab with the Owner email.');
  };

  const fillQuickAccount = (email) => {
    setEmailInput(email);
    setErrorMsg('');
  };

  const isSwitch = overlayMode === 'switch';

  return (
    <div
      className={`sps-overlay${isSwitch ? ' is-switch-account' : ''}`}
      style={{
        zIndex: isSwitch ? 80 : 100,
        ...(isSwitch
          ? { background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }
          : null)
      }}
    >
      <div
        className="sps-shell sps-shell-md"
        style={{ height: 'auto', maxHeight: 'min(92dvh, 40rem)', alignSelf: 'center', pointerEvents: 'auto' }}
      >
        <div className="sps-modal-head">
          <div className="flex items-center gap-3 min-w-0">
            <div className="sps-mark shrink-0 overflow-hidden p-0">
              <StageWorksMark size={32} className="w-8 h-8 object-cover" />
            </div>
            <div className="min-w-0">
              <h2>{isSwitch ? 'Switch account' : PRODUCT}</h2>
              <p>{isSwitch ? 'Sign in as another user — Projects stay open.' : CATEGORY}</p>
            </div>
          </div>
          <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close login">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="sps-tabs mx-4 mt-3 flex-wrap" role="tablist" aria-label="Login as">
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === 'gmail'}
            onClick={() => { setLoginMode('gmail'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            <Mail className="w-4 h-4 shrink-0" />
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === 'admin'}
            onClick={() => { setLoginMode('admin'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Studio Admin
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === 'guest'}
            onClick={() => { setLoginMode('guest'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            <Eye className="w-4 h-4 shrink-0" />
            Guest
          </button>
        </div>

        <div className="sps-modal-body p-5 space-y-4">
          {errorMsg && (
            <div className="sps-panel p-3 text-xs font-semibold flex items-center gap-2" style={{ borderColor: 'var(--sps-warn)' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="sps-panel p-3 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--sps-gold)' }} />
              <span>{successMsg}</span>
            </div>
          )}

          {loginMode === 'gmail' ? (
            <form onSubmit={handleGmailLogin} className="space-y-4">
              {rememberedEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setEmailInput(rememberedEmail);
                    setErrorMsg('');
                    setSuccessMsg('');
                    localStorage.removeItem('sps_user_manually_logged_out');
                    completeLogin(
                      rememberedEmail === 'pedditiram@gmail.com' || PRIMARY_ADMIN_EMAILS.includes(rememberedEmail)
                        ? 'pedditiram@gmail.com'
                        : rememberedEmail,
                      `Continuing as ${PRIMARY_ADMIN_EMAILS.includes(rememberedEmail) || rememberedEmail === 'pedditiram@gmail.com' ? 'Studio Owner' : rememberedEmail}`
                    );
                  }}
                  className="sps-btn w-full"
                >
                  <UserCheck className="w-4 h-4" />
                  <span className="truncate">Continue as {PRIMARY_ADMIN_EMAILS.includes(rememberedEmail) || rememberedEmail === 'pedditiram@gmail.com' ? 'Studio Owner' : rememberedEmail}</span>
                </button>
              )}

              <div>
                <label className="text-[11px] font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  <User className="w-3.5 h-3.5" />
                  Collaborator email
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="collaborator@email.com"
                  className="w-full rounded-[7px] px-3.5 py-2.5 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold block mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  Invite OTP <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full rounded-[7px] px-3.5 py-2.5 text-xs text-center tracking-[0.35em] font-semibold"
                  style={{ fontFamily: 'var(--sps-font-mono)' }}
                />
              </div>

              <button
                type="submit"
                className="sps-btn sps-btn-primary w-full"
                style={{ backgroundColor: 'var(--sps-gold)', color: '#1c1712', WebkitTextFillColor: '#1c1712' }}
              >
                <span>Launch studio workspace</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              {onOpenDesktopTrial ? (
                <button
                  type="button"
                  className="sps-btn w-full"
                  onClick={() => onOpenDesktopTrial()}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Download desktop trial</span>
                </button>
              ) : null}
            </form>
          ) : loginMode === 'admin' ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  <Shield className="w-3.5 h-3.5" />
                  Admin owner ID
                </label>
                <input
                  type="text"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  placeholder="Custom Admin ID"
                  className="w-full rounded-[7px] px-3.5 py-2.5 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  <Lock className="w-3.5 h-3.5" />
                  Admin password
                </label>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Strong custom password"
                  className="w-full rounded-[7px] px-3.5 py-2.5 text-xs"
                  style={{ fontFamily: 'var(--sps-font-mono)' }}
                  required
                />
                <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: 'var(--sps-muted)' }}>
                  Owner lockout escape: use the Sign In tab with the Owner email.
                  Weak defaults (admin / admin123) are disabled in production.
                </p>
              </div>

              <button
                type="submit"
                className="sps-btn sps-btn-primary w-full"
              >
                <Lock className="w-4 h-4" />
                <span>Authenticate as studio admin</span>
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] leading-relaxed m-0" style={{ color: 'var(--sps-muted)' }}>
                No account required. Look through the studio, play the presentation reel, or take the guided demo.
                Nothing saves until you sign in with Email or Studio Admin.
              </p>

              <button
                type="button"
                onClick={startGuestLook}
                className="sps-btn sps-btn-primary w-full"
                style={{ backgroundColor: 'var(--sps-gold)', color: '#1c1712', WebkitTextFillColor: '#1c1712' }}
                title="Browse rooms without editing or saving"
              >
                <Eye className="w-4 h-4" />
                <span>Continue as guest</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={startPresentation}
                className="sps-btn w-full"
                title="Park consoles and play the Stage Work Studio reel"
              >
                <Clapperboard className="w-4 h-4" />
                <span>Presentation mode</span>
              </button>

              <button
                type="button"
                onClick={startAppDemo}
                className="sps-btn w-full"
                title="Guided walkthrough of Writer, Matrix, Generate, and more"
              >
                <Sparkles className="w-4 h-4" />
                <span>App demo tour</span>
              </button>
              {onOpenDesktopTrial ? (
                <button
                  type="button"
                  className="sps-btn w-full"
                  onClick={() => onOpenDesktopTrial()}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Download desktop trial</span>
                </button>
              ) : null}
            </div>
          )}

          <div className="pt-3 border-t flex items-center justify-around text-[10px] font-semibold" style={{ borderColor: 'var(--sps-border)', color: 'var(--sps-muted)' }}>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> Real-time sync
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" /> Studio vault
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Film className="w-3 h-3" /> Cinema craft
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
