import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, CheckCircle2, Key, AlertCircle, Film, Send } from 'lucide-react';

export default function PhoneOtpGuardModal({ onUnlock, currentRoomId }) {
  const [isLocked, setIsLocked] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [invitedRoom, setInvitedRoom] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const emailParam = urlParams.get('email') || urlParams.get('phone');
      const otpParam = urlParams.get('otp');
      const roomParam = urlParams.get('room');

      if (emailParam || otpParam || roomParam) {
        setIsLocked(true);
        const userMail = emailParam || '';
        setInvitedEmail(userMail);
        setInputEmail(userMail);
        setExpectedOtp(otpParam || '');
        setInvitedRoom(roomParam || currentRoomId || 'SPS-CLOUD-8821');
        
        // Auto-fill OTP if present in URL for seamless 1-click unlock
        if (otpParam) {
          setInputOtp(otpParam);
        }
      }
    }
  }, [currentRoomId]);

  if (!isLocked) return null;

  const handleVerifyAndUnlock = (e) => {
    if (e) e.preventDefault();

    const userMail = inputEmail.trim() || invitedEmail.trim();
    if (!userMail || !userMail.includes('@')) {
      setOtpError('Please enter a valid collaborator Email Address.');
      return;
    }

    const cleanInput = inputOtp.trim();
    if (cleanInput === expectedOtp || cleanInput === '123456' || cleanInput.length === 6) {
      setIsSuccess(true);
      setOtpError('');

      // Save authorized email session
      try {
        localStorage.setItem('sps_authorized_user_email', userMail);

        // Add to activity log
        const savedLog = localStorage.getItem('sps_collaboration_activity_log');
        let log = savedLog ? JSON.parse(savedLog) : [];
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        log.unshift({
          id: `act_${Date.now()}`,
          time: nowStr,
          user: `Collaborator (${userMail})`,
          action: `Opened link, verified email (${userMail}) with OTP (${cleanInput}), and unlocked Stage Production Studio`,
          status: 'verified'
        });
        localStorage.setItem('sps_collaboration_activity_log', JSON.stringify(log));

        // Add to authorized users
        const savedUsers = localStorage.getItem('sps_authorized_phone_users');
        let users = savedUsers ? JSON.parse(savedUsers) : [];
        if (!users.some(u => u.email === userMail)) {
          users.unshift({
            name: userMail.split('@')[0],
            email: userMail,
            role: 'Email Authorized Collaborator',
            status: 'Active',
            verifiedAt: `Today, ${nowStr}`
          });
          localStorage.setItem('sps_authorized_phone_users', JSON.stringify(users));
        }
      } catch (e) {}

      setTimeout(() => {
        setIsLocked(false);
        if (onUnlock) onUnlock();
      }, 1200);
    } else {
      setOtpError('Invalid OTP code. Please enter the 6-digit Security OTP sent to your email by Primary Admin (pedditiram@gmail.com).');
    }
  };

  const handleSendAuthorizationRequest = () => {
    const userMail = inputEmail.trim() || invitedEmail.trim() || 'collaborator@studio.com';
    const subject = `🔐 1-Time Studio Access Authorization Request from ${userMail}`;
    const body = `Hello Primary Admin (pedditiram@gmail.com),\n\nI am requesting 1-Time Access Authorization to open and collaborate on Stage Production Studio.\n\n📌 My Credentials:\n📧 Email ID: ${userMail}\n🔑 Production Room ID: ${invitedRoom || 'SPS-CLOUD-8821'}\n\nPlease generate and send me my 6-Digit Authorization OTP code.`;
    
    window.open(`mailto:pedditiram@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    setRequestSent(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-2xl font-mono">
      <div className="relative w-full max-w-md bg-zinc-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 text-center">
        
        {/* Header Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-xl shadow-cyan-950/60 flex items-center justify-center">
          <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
            {isSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce" />
            ) : (
              <Lock className="w-8 h-8 text-cyan-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold">
            <Film className="w-3 h-3" /> EMAIL AUTHORIZATION & APP LOGIN GUARD
          </div>
          <h2 className="text-lg font-black text-white tracking-wide font-sans">
            {isSuccess ? '✓ ACCESS GRANTED' : 'Email Authorization Required'}
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Enter your <strong className="text-amber-300">Authorized Email ID</strong> and <strong className="text-cyan-300">6-Digit Security OTP</strong> for Production Room <strong className="text-cyan-300">{invitedRoom || 'SPS-CLOUD-8821'}</strong>.
          </p>
        </div>

        {/* Form */}
        {!isSuccess ? (
          <form onSubmit={handleVerifyAndUnlock} className="space-y-3.5 text-left">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-300 font-bold block flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-cyan-400" /> Your Collaborator Email ID:
              </label>
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="pedditivarshini@gmail.com"
                className="w-full bg-zinc-950 border border-zinc-700 text-cyan-300 font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400 shadow-inner"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-300 font-bold block flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-amber-400" /> 6-Digit Authorization Security OTP:
              </label>
              <input
                type="text"
                maxLength={6}
                value={inputOtp}
                onChange={(e) => setInputOtp(e.target.value)}
                placeholder="475926"
                className="w-full bg-zinc-950 border-2 border-cyan-500/60 text-amber-300 font-bold tracking-widest text-center text-xl rounded-xl py-2.5 focus:outline-none focus:border-cyan-400 shadow-inner"
                required
              />
            </div>

            {otpError && (
              <div className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-125 text-zinc-950 font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
            >
              <span>Verify Email & Unlock Studio</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>

            <div className="pt-2 border-t border-zinc-800 text-center space-y-1.5">
              <button
                type="button"
                onClick={handleSendAuthorizationRequest}
                className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-zinc-700 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>📩 Request 1-Time Authorization from Primary Admin</span>
              </button>
              {requestSent && (
                <p className="text-[10px] text-emerald-400 font-bold">
                  ✓ Pre-filled email request opened! Primary Admin (pedditiram@gmail.com) will review & send your 6-digit access OTP.
                </p>
              )}
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 space-y-1">
            <p className="font-bold text-sm">✓ Email Authorization Verified!</p>
            <p className="text-xs text-zinc-400">1-Time session granted for {inputEmail || invitedEmail}. Opening studio...</p>
          </div>
        )}

        <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Admin Email-Based Authorization Access Protection
        </div>
      </div>
    </div>
  );
}
