import { X, Mail, Lock, ShieldCheck, CheckCircle2, AlertCircle, User, UserCheck, UserPlus, Zap, Shield, ArrowRight, Film, Eye, Clapperboard, Sparkles, Monitor, Loader2 } from 'lucide-react';
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
  const [loginMode, setLoginMode] = useState('signin'); // 'signin' | 'signup' | 'guest' | 'admin'
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpRole, setSignUpRole] = useState('');
  const [signUpOtp, setSignUpOtp] = useState('');
  const [isSubmittingSignUp, setIsSubmittingSignUp] = useState(false);
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
    setLoginMode('signin');
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
        completeLogin('pedditiram@gmail.com', 'Logged in as Primary Admin & Studio Admin.');
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
      completeLogin('pedditiram@gmail.com', 'Admin authentication successful. Full studio control unlocked.');
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

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const cleanEmail = normalizeEmail(signUpEmail);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid collaborator email address.');
      return;
    }
    const cleanName = signUpName.trim() || cleanEmail.split('@')[0].toUpperCase();
    const otpVal = signUpOtp.trim();

    // If OTP provided and matches an issued OTP or URL OTP, immediately authenticate
    if (otpVal && /^\d{6}$/.test(otpVal)) {
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
        completeLogin(cleanEmail, `Account verified. Welcome to Stage Work Studio, ${cleanName}!`);
        return;
      }
    }

    setIsSubmittingSignUp(true);
    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          role: signUpRole.trim() || 'Collaborator',
          message: 'Sign-up access request from Stage Work Studio client'
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || data?.success) {
        setSuccessMsg(data?.message || 'Access request sent to Studio Admin. Enter your invite OTP once received.');
      } else {
        setErrorMsg(data?.error || 'Could not send sign-up request. Please try again.');
      }
    } catch {
      setSuccessMsg('Sign-up submitted. Ask the Studio Admin for your 6-digit invite OTP to enter.');
    } finally {
      setIsSubmittingSignUp(false);
    }
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
            aria-selected={loginMode === 'signin'}
            onClick={() => { setLoginMode('signin'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            <Mail className="w-4 h-4 shrink-0" />
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === 'signup'}
            onClick={() => { setLoginMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            Sign Up
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === 'guest'}
            onClick={() => { setLoginMode('guest'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            <Eye className="w-4 h-4 shrink-0" />
            Sign in as Guest
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

          {loginMode === 'signin' ? (
            <form onSubmit={handleGmailLogin} className="space-y-4">
              {rememberedEmail && (
                <div className="p-2.5 rounded-lg border border-[var(--sps-gold)]/40 bg-[var(--sps-gold)]/5">
                  <span className="text-[10px] font-semibold block uppercase tracking-wider mb-2" style={{ color: 'var(--sps-gold)' }}>
                    Recent session
                  </span>
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
                        `Continuing as ${PRIMARY_ADMIN_EMAILS.includes(rememberedEmail) || rememberedEmail === 'pedditiram@gmail.com' ? 'Studio Admin' : rememberedEmail}`
                      );
                    }}
                    className="sps-btn sps-btn-primary w-full flex items-center justify-between"
                    style={{ backgroundColor: 'var(--sps-gold)', color: '#1c1712', WebkitTextFillColor: '#1c1712' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span className="truncate font-semibold text-xs">
                        Sign in as {PRIMARY_ADMIN_EMAILS.includes(rememberedEmail) || rememberedEmail === 'pedditiram@gmail.com' ? 'Studio Admin' : rememberedEmail}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
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

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => { setLoginMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="text-[var(--sps-gold)] hover:underline font-semibold"
                >
                  New collaborator? Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode('guest'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="text-[var(--sps-muted)] hover:underline"
                >
                  Browse as Guest
                </button>
              </div>

              {onOpenDesktopTrial ? (
                <button
                  type="button"
                  className="sps-btn w-full mt-2"
                  onClick={() => onOpenDesktopTrial()}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Download desktop trial</span>
                </button>
              ) : null}
            </form>
          ) : loginMode === 'signup' ? (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <p className="text-[11px] leading-relaxed m-0" style={{ color: 'var(--sps-muted)' }}>
                Request access to Stage Work Studio. If you already received a 6-digit invite code from the Studio Admin, enter it below for instant activation.
              </p>

              <div>
                <label className="text-[11px] font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  <User className="w-3.5 h-3.5" />
                  Full name
                </label>
                <input
                  type="text"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  placeholder="e.g. Christopher Nolan"
                  className="w-full rounded-[7px] px-3.5 py-2.5 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  <Mail className="w-3.5 h-3.5" />
                  Collaborator email
                </label>
                <input
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="collaborator@email.com"
                  className="w-full rounded-[7px] px-3.5 py-2.5 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold block mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  Studio role / Department
                </label>
                <input
                  type="text"
                  value={signUpRole}
                  onChange={(e) => setSignUpRole(e.target.value)}
                  placeholder="Director, Producer, DOP, Lead Editor..."
                  className="w-full rounded-[7px] px-3.5 py-2.5 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold block mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  Invite OTP <span className="font-normal">(optional — instant unlock if provided)</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={signUpOtp}
                  onChange={(e) => setSignUpOtp(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full rounded-[7px] px-3.5 py-2.5 text-xs text-center tracking-[0.35em] font-semibold"
                  style={{ fontFamily: 'var(--sps-font-mono)' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingSignUp}
                className="sps-btn sps-btn-primary w-full"
                style={{ backgroundColor: 'var(--sps-gold)', color: '#1c1712', WebkitTextFillColor: '#1c1712' }}
              >
                {isSubmittingSignUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{isSubmittingSignUp ? 'Submitting request…' : 'Complete Sign Up'}</span>
              </button>

              <div className="text-center text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => { setLoginMode('signin'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="text-[var(--sps-gold)] hover:underline font-semibold"
                >
                  Already have access? Sign In
                </button>
              </div>
            </form>
          ) : loginMode === 'admin' ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--sps-muted)' }}>
                  <Shield className="w-3.5 h-3.5" />
                  Admin ID
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
                  Admin lockout escape: use the Sign In tab with the Admin email.
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
                <span>Sign in as Guest</span>
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
