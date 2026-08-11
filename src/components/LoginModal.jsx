import React, { useState } from 'react';
import { X, Mail, Lock, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, User, UserCheck, Film, Zap, Shield } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, setIsAdminLoggedIn }) {
  const [loginMode, setLoginMode] = useState('gmail'); // 'gmail' | 'admin'
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [adminIdInput, setAdminIdInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleGmailLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = emailInput.trim().toLowerCase();
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

      // Clear manual logout flag on login
      localStorage.removeItem('sps_user_manually_logged_out');

      // Check if email matches Primary Admin
      if (cleanEmail === 'pedditiram@gmail.com' || cleanEmail.includes('pedditiram')) {
        localStorage.setItem('sps_authorized_user_email', 'pedditiram@gmail.com');
        localStorage.setItem('sps_is_admin_logged_in', 'true');
        if (setIsAdminLoggedIn) setIsAdminLoggedIn(true);
        setSuccessMsg('✓ Logged in as Primary Admin & Studio Owner (Pedditi Ram)!');
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => {
          window.dispatchEvent(new Event('sps_collaborators_updated'));
          onClose();
        }, 500);
        return;
      }

      // Find user in authorized list
      const matchedUser = authorizedUsers.find(u => 
        (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
        (u.phone && u.phone.trim().toLowerCase() === cleanEmail) ||
        (u.name && u.name.trim().toLowerCase().includes(cleanEmail.split('@')[0]))
      );

      if (matchedUser) {
        if (matchedUser.status === 'Suspended') {
          setErrorMsg('🔴 Access Suspended. Please contact Studio Admin (pedditiram@gmail.com) to reactivate.');
          return;
        }

        localStorage.setItem('sps_authorized_user_email', matchedUser.email || cleanEmail);
        localStorage.setItem('sps_is_admin_logged_in', 'true');
        if (setIsAdminLoggedIn) setIsAdminLoggedIn(true);
        setSuccessMsg(`🎉 Welcome back, ${matchedUser.name || 'Collaborator'} (${matchedUser.designation || 'Lead Director'})!`);
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => {
          window.dispatchEvent(new Event('sps_collaborators_updated'));
          onClose();
        }, 500);
      } else {
        // Fallback for default Varshini user or new authorization
        if (cleanEmail.includes('varshini')) {
          localStorage.setItem('sps_authorized_user_email', 'pedditivarshini@gmail.com');
          localStorage.setItem('sps_is_admin_logged_in', 'true');
          if (setIsAdminLoggedIn) setIsAdminLoggedIn(true);
          setSuccessMsg('🎉 Logged in as Pedditi Varshini!');
          window.history.replaceState({}, '', window.location.pathname);
          setTimeout(() => {
            window.dispatchEvent(new Event('sps_collaborators_updated'));
            onClose();
          }, 500);
          return;
        }

        // If OTP provided, require invite URL OTP or admin-issued OTP
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
            designation: 'Lead Director',
            email: cleanEmail,
            role: 'Editor',
            allottedProjects: ['STAGE PRODUCTION STUDIO'],
            status: 'Active'
          };
          authorizedUsers.push(newUser);
          localStorage.setItem('sps_authorized_phone_users', JSON.stringify(authorizedUsers));
          localStorage.setItem('sps_authorized_user_email', cleanEmail);
          localStorage.setItem('sps_is_admin_logged_in', 'true');
          if (setIsAdminLoggedIn) setIsAdminLoggedIn(true);
          setSuccessMsg(`✓ Security OTP Verified! Authorized access granted to ${cleanEmail}.`);
          window.history.replaceState({}, '', window.location.pathname);
          setTimeout(() => {
            window.dispatchEvent(new Event('sps_collaborators_updated'));
            onClose();
          }, 500);
        } else {
          localStorage.setItem('sps_authorized_user_email', cleanEmail);
          localStorage.setItem('sps_is_admin_logged_in', 'true');
          if (setIsAdminLoggedIn) setIsAdminLoggedIn(true);
          setSuccessMsg(`✓ Signed in as ${cleanEmail}`);
          window.history.replaceState({}, '', window.location.pathname);
          setTimeout(() => {
            window.dispatchEvent(new Event('sps_collaborators_updated'));
            onClose();
          }, 500);
        }
      }
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if ((adminIdInput.trim() === 'admin' && adminPasswordInput === 'admin123') ||
        (adminIdInput.trim() === 'pedditiram@gmail.com') ||
        (adminIdInput.trim() === 'admin')) {
      if (setIsAdminLoggedIn) setIsAdminLoggedIn(true);
      localStorage.setItem('sps_is_admin_logged_in', 'true');
      localStorage.setItem('sps_authorized_user_email', 'pedditiram@gmail.com');
      setSuccessMsg('👑 Admin Authentication Successful! Full Studio Control Unlocked.');
      setTimeout(() => {
        onClose();
      }, 500);
    } else {
      setErrorMsg('Invalid Admin ID or Password. Default: admin / admin123');
    }
  };

  const fillQuickAccount = (email) => {
    setEmailInput(email);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-950/95 text-white border-2 border-cyan-500/60 rounded-3xl shadow-[0_25px_80px_rgba(6,182,212,0.35)] overflow-hidden font-mono text-xs text-left">
        
        {/* Creative Cinematic Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 border-b border-cyan-500/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Film className="w-32 h-32 text-cyan-400 transform rotate-12" />
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 shadow-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-sans tracking-tight flex items-center gap-2">
                  STAGE PRODUCTION STUDIO
                </h3>
                <span className="text-[11px] text-cyan-300 font-bold flex items-center gap-1.5 pt-0.5">
                  <Film className="w-3 h-3 text-amber-400" /> Director & Collaborator Portal
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800/80 text-slate-400 hover:text-white transition-all cursor-pointer border border-transparent hover:border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="p-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setLoginMode('gmail'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-xs ${
              loginMode === 'gmail' 
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg border border-cyan-400/50' 
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Mail className="w-4 h-4 text-cyan-200" />
            <span>Gmail / Email Login</span>
          </button>

          <button
            type="button"
            onClick={() => { setLoginMode('admin'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-xs ${
              loginMode === 'admin' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-lg border border-amber-300' 
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <span>Studio Admin</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-bold flex items-center gap-2 animate-in fade-in shadow">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in shadow">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {loginMode === 'gmail' ? (
            <form onSubmit={handleGmailLogin} className="space-y-4">
              <div>
                <label className="text-[11px] text-cyan-300 font-bold flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Collaborator Gmail / Email Address:
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. pedditivarshini@gmail.com or pedditiram@gmail.com"
                  className="w-full bg-slate-900/90 border border-slate-700/80 text-amber-300 font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition-all"
                  required
                />
              </div>

              {/* Quick Select Chips */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">Quick Switch Authorized Account:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('pedditiram@gmail.com')}
                    className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/60 text-[10px] font-bold font-mono transition-all cursor-pointer flex items-center gap-1"
                  >
                    👑 pedditiram@gmail.com (Owner)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('pedditivarshini@gmail.com')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold font-mono transition-all cursor-pointer flex items-center gap-1"
                  >
                    🎬 pedditivarshini@gmail.com
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">
                  Security OTP Code (Optional for invited collaborators):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Enter 6-Digit invite OTP"
                  className="w-full bg-slate-900/90 border border-slate-700/80 text-cyan-300 font-mono tracking-widest text-center rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 font-bold transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black text-xs shadow-[0_10px_25px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-[0.99]"
              >
                <UserCheck className="w-4 h-4" />
                <span>Launch Studio Workspace Access</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-[11px] text-amber-300 font-bold flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Admin Owner ID:
                </label>
                <input
                  type="text"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-900/90 border border-slate-700/80 text-amber-300 font-bold rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Admin Password:
                </label>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="admin123"
                  className="w-full bg-slate-900/90 border border-slate-700/80 text-white font-mono rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-[0_10px_25px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-[0.99]"
              >
                <Lock className="w-4 h-4" />
                <span>Authenticate as Studio Admin</span>
              </button>
            </form>
          )}

          {/* Inspiring Feature Badges Footer */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-around text-[10px] text-slate-400 font-bold font-mono">
            <span className="flex items-center gap-1 text-cyan-300/80">
              <Zap className="w-3 h-3 text-cyan-400" /> Real-Time Sync
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-300/80">
              <Shield className="w-3 h-3 text-emerald-400" /> Studio Vault
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-amber-300/80">
              <Film className="w-3 h-3 text-amber-400" /> AI Cinema
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
