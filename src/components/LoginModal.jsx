import React, { useState, useEffect } from 'react';
import { X, Lock, CheckCircle2, AlertCircle, UserPlus, Shield, Loader2 } from 'lucide-react';
import {
  getCurrentUserEmail,
  isStudioAdmin,
  markCollaboratorSession,
  normalizeEmail,
  getDesignationForEmail,
  getHomeForDesignation,
  exitPresentationForWorkspace
} from '../utils/projectPermissions';
import { registerThisDevice, getDeviceId } from '../utils/saasControl';
import { activateSelfServeAccount, isSelfServeSession, seedTenantFirstFilm } from '../utils/tenantScope';
import { isValidEmail } from '../utils/emailValidation';
import {
  collaboratorHasPassword,
  collaboratorPasswordHint,
  findAuthorizedUser,
  isOwnerLoginEmail,
  isStrongCollaboratorPassword,
  setCollaboratorPassword,
  verifyCollaboratorPassword
} from '../utils/collaboratorPassword';
import StageWorksMark from './StageWorksMark';
import LegalDocModal from './LegalDocModal';
import { PRODUCT } from '../constants/brand';

export default function LoginModal({ isOpen, onClose, setIsAdminLoggedIn, overlayMode = 'default', initialMode = 'signin' }) {
  const [loginMode, setLoginMode] = useState(initialMode || 'signin'); // 'signin' | 'signup' | 'admin' | 'createpass' | 'changepass'
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpRole, setSignUpRole] = useState('');
  const [signUpOtp, setSignUpOtp] = useState('');
  const [isSubmittingSignUp, setIsSubmittingSignUp] = useState(false);
  const [signupAwaitingCode, setSignupAwaitingCode] = useState(false);
  const [signupAgreed, setSignupAgreed] = useState(false);
  const [legalKind, setLegalKind] = useState(null);
  const [adminIdInput, setAdminIdInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  // Prefill last known email when modal opens — still require explicit login choice
  useEffect(() => {
    if (!isOpen) return;
    const remembered = normalizeEmail(getCurrentUserEmail());
    if (remembered) setEmailInput(remembered);
    setErrorMsg('');
    setSuccessMsg('');
    setPasswordInput('');
    setNewPass('');
    setNewPass2('');
    setCurrentPass('');
    setPendingEmail(remembered);
    setPendingMessage('');
    setLoginMode(initialMode === 'guest' ? 'signin' : (initialMode || 'signin'));
    setSignupAwaitingCode(false);
    setSignupAgreed(false);
    setLegalKind(null);
    setSignUpOtp('');
    setShowInvite(false);
    setOtpInput('');
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const completeLogin = (email, message) => {
    const clean = normalizeEmail(email);
    const gate = registerThisDevice(clean);
    if (!gate.ok) {
      setErrorMsg(gate.error || 'License or device blocked.');
      return;
    }
    markCollaboratorSession(clean);
    exitPresentationForWorkspace();
    try {
      if (isSelfServeSession(clean)) seedTenantFirstFilm(clean);
    } catch {
      /* ignore */
    }
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
      if (isSelfServeSession(clean)) {
        window.location.reload();
      }
    }, 500);
  };

  const beginCreatePassword = (email, message) => {
    setPendingEmail(normalizeEmail(email));
    setPendingMessage(message);
    setNewPass('');
    setNewPass2('');
    setErrorMsg('');
    setSuccessMsg('Access granted. Create your own password — you will use it the next time you sign in.');
    setLoginMode('createpass');
  };

  const afterAccessGranted = (email, message, user = findAuthorizedUser(email)) => {
    const clean = normalizeEmail(email);
    if (isOwnerLoginEmail(clean)) {
      completeLogin(clean, message);
      return;
    }
    if (collaboratorHasPassword(user)) {
      completeLogin(clean, message);
      return;
    }
    beginCreatePassword(clean, message);
  };

  const otpMatches = (cleanEmail, otpVal) => {
    if (!otpVal || !/^\d{6}$/.test(otpVal)) return false;
    const urlOtp = new URLSearchParams(window.location.search).get('otp') || '';
    let issuedOtps = {};
    try {
      issuedOtps = JSON.parse(localStorage.getItem('sps_issued_invite_otps') || '{}');
    } catch {
      issuedOtps = {};
    }
    const issued = issuedOtps[cleanEmail] || issuedOtps[localStorage.getItem('sps_cloud_room_id') || ''] || '';
    return otpVal === urlOtp || otpVal === String(issued);
  };

  const handleGmailLogin = async (e, explicitEmail) => {
    if (e?.preventDefault) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = normalizeEmail(explicitEmail || emailInput);
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('invalid mail id');
      return;
    }

    if (typeof window !== 'undefined') {
      const savedUsersStr = localStorage.getItem('sps_authorized_phone_users');
      let authorizedUsers = [];
      if (savedUsersStr) {
        try { authorizedUsers = JSON.parse(savedUsersStr); } catch (err) {}
      }

      localStorage.removeItem('sps_user_manually_logged_out');

      // Admin path: admin@stageworkstudio.com or pedditiram@gmail.com
      if (isOwnerLoginEmail(cleanEmail)) {
        completeLogin(cleanEmail, 'Logged in as Studio Admin (Full studio control unlocked).');
        return;
      }

      const matchedUser = authorizedUsers.find(u =>
        (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
        (u.phone && u.phone.trim().toLowerCase() === cleanEmail) ||
        (u.name && u.name.trim().toLowerCase().includes(cleanEmail.split('@')[0]))
      );
      const otpVal = otpInput.trim();
      const passVal = passwordInput;
      const welcome = (user) =>
        `Welcome back, ${user?.name || 'Collaborator'}. You can edit allotted projects only.`;

      if (matchedUser) {
        if (matchedUser.status === 'Suspended') {
          setErrorMsg('Access Suspended. Contact Studio Admin to reactivate.');
          return;
        }
        const email = normalizeEmail(matchedUser.email || cleanEmail);
        if (collaboratorHasPassword(matchedUser)) {
          if (passVal) {
            const ok = await verifyCollaboratorPassword(matchedUser, passVal);
            if (!ok) {
              setErrorMsg('Wrong password. Try again, or use a fresh invite OTP from Admin.');
              return;
            }
            completeLogin(email, welcome(matchedUser));
            return;
          }
          if (otpMatches(email, otpVal)) {
            afterAccessGranted(email, welcome(matchedUser), matchedUser);
            return;
          }
          setErrorMsg('Enter your password, or a fresh 6-digit invite OTP from Admin.');
          return;
        }
        afterAccessGranted(email, welcome(matchedUser), matchedUser);
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
        afterAccessGranted('pedditivarshini@gmail.com', 'Logged in as Pedditi Varshini (collaborator).');
        return;
      }

      if (otpMatches(cleanEmail, otpVal)) {
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
        afterAccessGranted(cleanEmail, `OTP verified. Ask admin to allot a project to ${cleanEmail}.`, newUser);
        return;
      }

      if (otpVal) {
        setErrorMsg('Invalid OTP. Use the invite OTP from Primary Admin.');
        return;
      }

      setErrorMsg('Email not authorized. Ask the studio Admin for an invite OTP or allotment.');
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
      completeLogin('admin@stageworkstudio.com', 'Admin authentication successful. Full studio control unlocked.');
      return;
    }

    if (!customConfigured) {
      setErrorMsg(
        'No strong Admin password is configured. Sign in via the Admin email (Sign In tab), then set a strong password in Admin Settings.'
      );
      return;
    }

    setErrorMsg('Invalid Admin ID or Password. Admin recovery: use the Sign In tab with the Admin email.');
  };

  const handleCreateMyPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const email = normalizeEmail(pendingEmail || emailInput || getCurrentUserEmail());
    if (!isValidEmail(email) || isOwnerLoginEmail(email)) {
      setErrorMsg('Sign in with your allotted collaborator email first.');
      return;
    }
    if (newPass !== newPass2) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!isStrongCollaboratorPassword(newPass)) {
      setErrorMsg(collaboratorPasswordHint());
      return;
    }
    setIsSavingPass(true);
    try {
      const saved = await setCollaboratorPassword(email, newPass);
      if (!saved.ok) {
        setErrorMsg(saved.error || 'Could not save password.');
        return;
      }
      completeLogin(email, pendingMessage || 'Password saved. Welcome to Stage Work Studio.');
    } catch (err) {
      setErrorMsg(err?.message || 'Could not save password.');
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleChangeMyPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const email = normalizeEmail(getCurrentUserEmail() || emailInput);
    const user = findAuthorizedUser(email);
    if (!isValidEmail(email) || isOwnerLoginEmail(email)) {
      setErrorMsg('Only Editors and collaborators set a password here.');
      return;
    }
    if (collaboratorHasPassword(user)) {
      const ok = await verifyCollaboratorPassword(user, currentPass);
      if (!ok) {
        setErrorMsg('Current password is incorrect. Ask Admin to reset it if you forgot.');
        return;
      }
    }
    if (newPass !== newPass2) {
      setErrorMsg('New passwords do not match.');
      return;
    }
    if (!isStrongCollaboratorPassword(newPass)) {
      setErrorMsg(collaboratorPasswordHint());
      return;
    }
    setIsSavingPass(true);
    try {
      const saved = await setCollaboratorPassword(email, newPass);
      if (!saved.ok) {
        setErrorMsg(saved.error || 'Could not update password.');
        return;
      }
      setSuccessMsg('Password updated. Use it the next time you sign in.');
      setCurrentPass('');
      setNewPass('');
      setNewPass2('');
      setTimeout(() => onClose(), 600);
    } catch (err) {
      setErrorMsg(err?.message || 'Could not update password.');
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!signupAgreed) {
      setErrorMsg('Accept Privacy and Terms to create an account.');
      return;
    }
    const cleanEmail = normalizeEmail(signUpEmail);
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('invalid mail id');
      return;
    }
    const cleanName = signUpName.trim() || cleanEmail.split('@')[0].toUpperCase();
    const otpVal = signUpOtp.trim();

    // If OTP provided and matches an issued OTP or URL OTP, immediately authenticate
    // Studio invite OTP still unlocks a collaborator (Owner issued the code).
    if (otpVal && /^\d{6}$/.test(otpVal) && !signupAwaitingCode) {
      const urlOtp = new URLSearchParams(window.location.search).get('otp') || '';
      let issuedOtps = {};
      try {
        issuedOtps = JSON.parse(localStorage.getItem('sps_issued_invite_otps') || '{}');
      } catch (err) {}
      const issued = issuedOtps[cleanEmail] || issuedOtps[localStorage.getItem('sps_cloud_room_id') || ''] || '';
      if (otpVal === urlOtp || otpVal === String(issued)) {
        let authorizedUsers = [];
        try {
          authorizedUsers = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
        } catch (err) {}
        const newUser = {
          name: cleanName,
          designation: signUpRole.trim() || 'Collaborator',
          email: cleanEmail,
          role: 'Editor',
          allottedProjects: [],
          status: 'Active'
        };
        authorizedUsers.push(newUser);
        localStorage.setItem('sps_authorized_phone_users', JSON.stringify(authorizedUsers));
        afterAccessGranted(cleanEmail, `Account verified. Welcome to Stage Work Studio, ${cleanName}!`, newUser);
        return;
      }
    }

    setIsSubmittingSignUp(true);
    try {
      if (signupAwaitingCode) {
        if (!/^\d{6}$/.test(otpVal)) {
          setErrorMsg('Enter the 6-digit code from your email.');
          return;
        }
        const res = await fetch('/api/saas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify-signup',
            email: cleanEmail,
            otp: otpVal,
            name: cleanName,
            deviceId: getDeviceId()
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          setErrorMsg(data?.error || 'That code did not work. Request a new one.');
          return;
        }
        const user = activateSelfServeAccount(cleanEmail, {
          name: data.name || cleanName,
          role: signUpRole.trim() || 'Writer'
        });
        afterAccessGranted(
          cleanEmail,
          `Your web account is ready — Writer, Matrix, and Form. ${cleanName}, this is your library, not the studio vault.`,
          user
        );
        return;
      }

      const res = await fetch('/api/saas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          email: cleanEmail,
          name: cleanName
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.emailed) {
        setSignupAwaitingCode(true);
        setSignUpOtp('');
        setSuccessMsg(data.message || `We emailed a code to ${cleanEmail}. It is not shown in this window.`);
      } else {
        const err = String(data?.error || '');
        if (err.toLowerCase().includes('invalid mail id') || err.toLowerCase().includes('valid email')) {
          setErrorMsg('invalid mail id');
        } else {
          setErrorMsg(err || 'Could not send a sign-up code. Try again, or request a studio invite.');
        }
      }
    } catch {
      setErrorMsg('Could not reach sign-up. Check your connection.');
    } finally {
      setIsSubmittingSignUp(false);
    }
  };

  const isSwitch = overlayMode === 'switch';
  const goMode = (mode) => {
    setLoginMode(mode);
    setErrorMsg('');
    setSuccessMsg('');
  };
  const heading =
    loginMode === 'createpass' ? 'Create password'
      : loginMode === 'changepass' ? 'Change password'
        : loginMode === 'signup' ? 'Create account'
          : loginMode === 'admin' ? 'Admin'
              : isSwitch ? 'Switch account' : 'Sign in';
  const subheading =
    loginMode === 'createpass' ? (pendingEmail || emailInput || 'Choose a password for this email.')
      : loginMode === 'changepass' ? (getCurrentUserEmail() || emailInput || 'Update your password.')
        : isSwitch ? 'Projects stay open.'
          : loginMode === 'signup' ? 'We email a code. Nothing is shown here.'
            : loginMode === 'admin' ? 'Custom Admin ID lock.'
              : PRODUCT;
  const legalLinks = (
    <p className="sps-login-legal">
      <button type="button" onClick={() => setLegalKind('privacy')}>Privacy</button>
      <span aria-hidden="true"> · </span>
      <button type="button" onClick={() => setLegalKind('terms')}>Terms</button>
    </p>
  );

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
      <div className="sps-shell sps-login-shell" role="dialog" aria-modal="true" aria-labelledby="sps-login-title">
        <div className="sps-modal-head">
          <div className="flex items-center gap-3 min-w-0">
            <div className="sps-mark shrink-0 overflow-hidden p-0">
              <StageWorksMark size={32} className="w-8 h-8 object-cover" />
            </div>
            <div className="min-w-0">
              <h2 id="sps-login-title">{heading}</h2>
              <p>{subheading}</p>
            </div>
          </div>
          <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="sps-modal-body sps-login-body">
          {errorMsg ? (
            <div className="sps-login-note is-warn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : null}
          {successMsg ? (
            <div className="sps-login-note">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--sps-gold)' }} />
              <span>{successMsg}</span>
            </div>
          ) : null}

          {loginMode === 'createpass' ? (
            <form onSubmit={handleCreateMyPassword} className="sps-login-form">
              <label>
                New password
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="At least 10 characters"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirm
                <input
                  type="password"
                  value={newPass2}
                  onChange={(e) => setNewPass2(e.target.value)}
                  placeholder="Type it again"
                  autoComplete="new-password"
                  required
                />
              </label>
              <p className="sps-login-hint">{collaboratorPasswordHint()}</p>
              <button type="submit" disabled={isSavingPass} className="sps-btn sps-btn-primary w-full">
                {isSavingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{isSavingPass ? 'Saving…' : 'Save and open'}</span>
              </button>
              <button type="button" className="sps-login-link" onClick={() => goMode('signin')}>
                Back to Sign in
              </button>
            </form>
          ) : loginMode === 'changepass' ? (
            <form onSubmit={handleChangeMyPassword} className="sps-login-form">
              {collaboratorHasPassword(findAuthorizedUser(getCurrentUserEmail())) ? (
                <label>
                  Current password
                  <input
                    type="password"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="Current password"
                    autoComplete="current-password"
                    required
                  />
                </label>
              ) : null}
              <label>
                New password
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="At least 10 characters"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirm
                <input
                  type="password"
                  value={newPass2}
                  onChange={(e) => setNewPass2(e.target.value)}
                  placeholder="Type it again"
                  autoComplete="new-password"
                  required
                />
              </label>
              <p className="sps-login-hint">{collaboratorPasswordHint()}</p>
              <button type="submit" disabled={isSavingPass} className="sps-btn sps-btn-primary w-full">
                {isSavingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{isSavingPass ? 'Updating…' : 'Update password'}</span>
              </button>
            </form>
          ) : loginMode === 'signin' ? (
            <form onSubmit={handleGmailLogin} className="sps-login-form">
              <label>
                Email
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                />
              </label>
              {showInvite || otpInput ? (
                <label>
                  Invite code
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="6 digits"
                    autoComplete="one-time-code"
                  />
                </label>
              ) : (
                <button type="button" className="sps-login-link" onClick={() => setShowInvite(true)}>
                  Have an invite code?
                </button>
              )}
              <button type="submit" className="sps-btn sps-btn-primary w-full">
                <span>Sign in</span>
              </button>
              <div className="sps-login-links">
                <button type="button" className="sps-login-link" onClick={() => goMode('signup')}>
                  Create account
                </button>
              </div>
              {legalLinks}
              <button type="button" className="sps-login-admin" onClick={() => goMode('admin')}>
                Admin lock
              </button>
            </form>
          ) : loginMode === 'signup' ? (
            <form onSubmit={handleSignUp} className="sps-login-form">
              <label>
                Name
                <input
                  type="text"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  required
                />
              </label>
              {signupAwaitingCode ? (
                <label>
                  Code from email
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={signUpOtp}
                    onChange={(e) => setSignUpOtp(e.target.value)}
                    placeholder="6 digits"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
              ) : null}
              <label className="sps-login-agree">
                <input
                  type="checkbox"
                  checked={signupAgreed}
                  onChange={(e) => setSignupAgreed(e.target.checked)}
                />
                <span>
                  I agree to{' '}
                  <button type="button" onClick={() => setLegalKind('privacy')}>Privacy</button>
                  {' '}and{' '}
                  <button type="button" onClick={() => setLegalKind('terms')}>Terms</button>
                </span>
              </label>
              <button type="submit" disabled={isSubmittingSignUp} className="sps-btn sps-btn-primary w-full">
                {isSubmittingSignUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{isSubmittingSignUp ? 'Working…' : signupAwaitingCode ? 'Create account' : 'Email me a code'}</span>
              </button>
              <button type="button" className="sps-login-link" onClick={() => goMode('signin')}>
                Already have access? Sign in
              </button>
            </form>
          ) : loginMode === 'admin' ? (
            <form onSubmit={handleAdminLogin} className="sps-login-form">
              <label>
                Admin ID
                <input
                  type="text"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  placeholder="Admin ID"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="sps-btn sps-btn-primary w-full">
                <Shield className="w-4 h-4" />
                <span>Sign in</span>
              </button>
              <button type="button" className="sps-login-link" onClick={() => goMode('signin')}>
                Use email instead
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <LegalDocModal kind={legalKind} onClose={() => setLegalKind(null)} />
    </div>
  );
}
