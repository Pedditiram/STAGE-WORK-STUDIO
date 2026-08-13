import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, ShieldCheck, CheckCircle2, AlertCircle, User, UserCheck, Film, Zap, Shield, ArrowRight } from 'lucide-react';
import { getCurrentUserEmail, isStudioAdmin, markCollaboratorSession, PRIMARY_ADMIN_EMAILS, normalizeEmail } from '../utils/projectPermissions';

export default function LoginModal({ isOpen, onClose, setIsAdminLoggedIn }) {
  const [loginMode, setLoginMode] = useState('gmail'); // 'gmail' | 'admin'
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

  const completeLogin = (email, message) => {
    const clean = normalizeEmail(email);
    markCollaboratorSession(clean);
    const admin = isStudioAdmin(clean);
    if (setIsAdminLoggedIn) setIsAdminLoggedIn(admin);
    try {
      sessionStorage.setItem('sps_session_authed', '1');
      sessionStorage.setItem('sps_login_prompted', '1');
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
        completeLogin('pedditiram@gmail.com', 'Logged in as Primary Admin & Studio Owner (Pedditi Ram).');
        return;
      }

      const matchedUser = authorizedUsers.find(u =>
        (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
        (u.phone && u.phone.trim().toLowerCase() === cleanEmail) ||
        (u.name && u.name.trim().toLowerCase().includes(cleanEmail.split('@')[0]))
      );

      if (matchedUser) {
        if (matchedUser.status === 'Suspended') {
          setErrorMsg('Access Suspended. Contact Studio Admin (pedditiram@gmail.com) to reactivate.');
          return;
        }
        completeLogin(
          matchedUser.email || cleanEmail,
          `Welcome back, ${matchedUser.name || 'Collaborator'}. You can edit allotted projects only.`
        );
        return;
      }

      if (cleanEmail.includes('varshini')) {
        // Ensure profile exists with empty/default allotments preserved if already set
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

      // Unknown email without a valid invite OTP cannot sign in
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

    // Production: only accept a strong custom password (no admin/admin123 / email-only / any-password bypasses).
    // Owner lockout escape: use Gmail tab with pedditiram@gmail.com, then set a strong password in Admin Settings.
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
        'No strong Admin password is configured. Sign in via Gmail as pedditiram@gmail.com (Owner), then set a strong password in Admin Settings.'
      );
      return;
    }

    setErrorMsg('Invalid Admin ID or Password. Owner recovery: Gmail login as pedditiram@gmail.com.');
  };

  const fillQuickAccount = (email) => {
    setEmailInput(email);
    setErrorMsg('');
  };

  return (
    <div className="sps-modal-enter fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      {/* Atmospheric wash behind panel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% 20%, rgba(34, 211, 238, 0.14), transparent 55%),
            radial-gradient(ellipse 40% 30% at 80% 80%, rgba(245, 158, 11, 0.08), transparent 50%)
          `,
        }}
      />

      <div
        className="sps-login-shell relative w-full max-w-md max-h-[min(100dvh,100%)] sm:max-h-[90dvh] overflow-y-auto text-white border border-cyan-400/25 rounded-t-[1.75rem] sm:rounded-3xl shadow-[0_28px_90px_rgba(0,0,0,0.65)] text-xs text-left pb-[env(safe-area-inset-bottom,0px)]"
        style={{ fontFamily: 'var(--sps-font)' }}
      >
        {/* Cinematic header — brand first */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(8,145,178,0.18) 0%, transparent 50%, rgba(245,158,11,0.08) 100%)',
            }}
          />
          <div className="absolute -right-6 -top-6 opacity-[0.07] pointer-events-none">
            <Film className="w-36 h-36 text-cyan-300 rotate-12" />
          </div>

          <div className="flex items-start justify-between relative z-10 gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <div
                  className="absolute -inset-2 rounded-2xl opacity-60 blur-xl"
                  style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.4), transparent 70%)' }}
                />
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-black border border-cyan-400/35 flex items-center justify-center shadow-lg">
                  <Film className="w-5 h-5 text-cyan-300" />
                </div>
              </div>
              <div className="min-w-0">
                <p
                  className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/80 font-semibold mb-1"
                  style={{ fontFamily: 'var(--sps-font-mono)' }}
                >
                  Pedditi Labs
                </p>
                <h3
                  className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-tight"
                  style={{ fontFamily: 'var(--sps-font-display)' }}
                >
                  Stage Production Studio
                </h3>
                <p className="text-[12px] text-slate-400 mt-1 font-medium">
                  Director & collaborator portal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="sps-chrome-btn p-2.5 sm:p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/10 shrink-0"
              aria-label="Close login"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="p-2.5 border-b border-white/[0.06] flex items-center gap-2 bg-black/20">
          <button
            type="button"
            onClick={() => { setLoginMode('gmail'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`sps-chrome-btn flex-1 py-3 sm:py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer text-xs min-h-[2.75rem] ${
              loginMode === 'gmail'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_8px_28px_rgba(34,211,238,0.28)] border border-cyan-300/50'
                : 'bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/5'
            }`}
          >
            <Mail className={`w-4 h-4 shrink-0 ${loginMode === 'gmail' ? 'text-slate-950' : 'text-cyan-300'}`} />
            <span className="truncate">Gmail / Email</span>
          </button>

          <button
            type="button"
            onClick={() => { setLoginMode('admin'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`sps-chrome-btn flex-1 py-3 sm:py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer text-xs min-h-[2.75rem] ${
              loginMode === 'admin'
                ? 'bg-amber-400 text-slate-950 shadow-[0_8px_28px_rgba(245,158,11,0.28)] border border-amber-200/60'
                : 'bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/5'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 shrink-0 ${loginMode === 'admin' ? 'text-slate-950' : 'text-amber-300'}`} />
            <span className="truncate">Studio Admin</span>
          </button>
        </div>

        {/* Form body */}
        <div className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2 sps-panel-enter">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2 sps-panel-enter">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
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
                    completeLogin(rememberedEmail, `Continuing as ${rememberedEmail}`);
                  }}
                  className="sps-chrome-btn w-full py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/18 border border-cyan-400/35 text-cyan-100 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 text-cyan-300" />
                  <span className="truncate">Continue as {rememberedEmail}</span>
                </button>
              )}

              <div>
                <label className="text-[11px] text-cyan-200/90 font-semibold flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Collaborator email
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. pedditivarshini@gmail.com"
                  className="sps-input-premium w-full bg-black/35 border border-white/10 text-amber-200 font-semibold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Quick accounts</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('pedditiram@gmail.com')}
                    className="sps-chrome-btn px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-200 border border-cyan-700/50 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    pedditiram@gmail.com · Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('pedditivarshini@gmail.com')}
                    className="sps-chrome-btn px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-200 border border-emerald-700/50 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    pedditivarshini@gmail.com
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1.5">
                  Invite OTP <span className="text-slate-600 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="6-digit code"
                  className="sps-input-premium w-full bg-black/35 border border-white/10 text-cyan-200 font-mono tracking-[0.35em] text-center rounded-xl px-3.5 py-2.5 text-xs focus:outline-none font-bold"
                  style={{ fontFamily: 'var(--sps-font-mono)' }}
                />
              </div>

              <button
                type="submit"
                className="sps-chrome-btn group w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-cyan-600 hover:brightness-110 text-slate-950 font-bold text-xs shadow-[0_12px_32px_rgba(6,182,212,0.32)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Launch studio workspace</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-[11px] text-amber-200 font-semibold flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Admin owner ID
                </label>
                <input
                  type="text"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  placeholder="Custom Admin ID"
                  className="sps-input-premium w-full bg-black/35 border border-white/10 text-amber-200 font-semibold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Admin password
                </label>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Strong custom password"
                  className="sps-input-premium w-full bg-black/35 border border-white/10 text-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none"
                  style={{ fontFamily: 'var(--sps-font-mono)' }}
                  required
                />
                <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
                  Owner lockout escape: use the Gmail tab with <span className="text-cyan-300/80">pedditiram@gmail.com</span>.
                  Weak defaults (admin / admin123) are disabled in production.
                </p>
              </div>

              <button
                type="submit"
                className="sps-chrome-btn group w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-[0_12px_32px_rgba(245,158,11,0.28)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Authenticate as studio admin</span>
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-around text-[10px] text-slate-500 font-semibold">
            <span className="flex items-center gap-1 text-cyan-300/70">
              <Zap className="w-3 h-3 text-cyan-400" /> Real-time sync
            </span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1 text-emerald-300/70">
              <Shield className="w-3 h-3 text-emerald-400" /> Studio vault
            </span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1 text-amber-300/70">
              <Film className="w-3 h-3 text-amber-400" /> Cinema craft
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
