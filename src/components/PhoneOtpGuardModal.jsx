import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, CheckCircle2, Key, AlertCircle, Film, Send } from 'lucide-react';
import { markCollaboratorSession, isStudioAdmin, getDesignationForEmail, getHomeForDesignation } from '../utils/projectPermissions';

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
    const savedOtpsRaw = localStorage.getItem('sps_issued_invite_otps');
    let issuedOtps = {};
    try {
      issuedOtps = savedOtpsRaw ? JSON.parse(savedOtpsRaw) : {};
    } catch (e) {
      issuedOtps = {};
    }
    const roomKey = invitedRoom || currentRoomId || 'SPS-CLOUD-8821';
    const issuedForRoom = issuedOtps[roomKey] || issuedOtps[userMail] || issuedOtps[userMail.toLowerCase()] || '';
    const otpOk =
      (expectedOtp && cleanInput === expectedOtp) ||
      (issuedForRoom && cleanInput === String(issuedForRoom));

    if (otpOk && /^\d{6}$/.test(cleanInput)) {
      setIsSuccess(true);
      setOtpError('');

      // Join cloud collaboration room on invite unlock
      try {
        localStorage.setItem('sps_app_version_mode', 'cloud');
        if (roomKey) localStorage.setItem('sps_cloud_room_id', roomKey);
        window.dispatchEvent(new CustomEvent('sps_app_version_mode_changed', { detail: 'cloud' }));
      } catch (e) {}

      // Save authorized email session (collaborator — not studio admin unless primary email)
      try {
        const cleanMail = userMail.trim().toLowerCase();
        markCollaboratorSession(cleanMail);

        // Infer allotted project from invite room when possible
        let allottedFromRoom = [];
        try {
          const library = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
          const matched = Array.isArray(library)
            ? library.find((p) => p && (p.roomId === roomKey || p.id === roomKey))
            : null;
          if (matched?.title) allottedFromRoom = [matched.title];
        } catch (err) {}

        // Add to activity log
        const savedLog = localStorage.getItem('sps_collaboration_activity_log');
        let log = savedLog ? JSON.parse(savedLog) : [];
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        log.unshift({
          id: `act_${Date.now()}`,
          time: nowStr,
          user: `Collaborator (${cleanMail})`,
          action: `Opened link, verified email (${cleanMail}) with OTP (${cleanInput}), and unlocked Stage Work Studio`,
          status: 'verified'
        });
        localStorage.setItem('sps_collaboration_activity_log', JSON.stringify(log));

        // Add / refresh authorized users as collaborators (admin allotment required for project access)
        const savedUsers = localStorage.getItem('sps_authorized_phone_users');
        let users = savedUsers ? JSON.parse(savedUsers) : [];
        const existingIdx = users.findIndex((u) => (u.email || '').trim().toLowerCase() === cleanMail);
        if (existingIdx === -1) {
          users.unshift({
            name: cleanMail.split('@')[0],
            email: cleanMail,
            role: isStudioAdmin(cleanMail) ? 'Owner' : 'Editor',
            isStudioAdmin: isStudioAdmin(cleanMail),
            designation: isStudioAdmin(cleanMail) ? 'Lead Director' : 'Collaborator',
            status: 'Active',
            allottedProjects: allottedFromRoom,
            verifiedAt: `Today, ${nowStr}`
          });
        } else {
          const existingAllotments = Array.isArray(users[existingIdx].allottedProjects)
            ? users[existingIdx].allottedProjects
            : [];
          const mergedAllotments = Array.from(new Set([...existingAllotments, ...allottedFromRoom].filter(Boolean)));
          users[existingIdx] = {
            ...users[existingIdx],
            status: 'Active',
            allottedProjects: mergedAllotments,
            verifiedAt: `Today, ${nowStr}`
          };
        }
        localStorage.setItem('sps_authorized_phone_users', JSON.stringify(users));
        markCollaboratorSession(cleanMail);
        try {
          const home = {
            open: 'projects',
            tab: 'library',
            view: getHomeForDesignation(getDesignationForEmail(cleanMail))?.view || 'spreadsheet'
          };
          sessionStorage.setItem('sps_login_home', JSON.stringify(home));
          window.dispatchEvent(new CustomEvent('sps_login_home', { detail: home }));
        } catch {
          /* ignore */
        }
        window.dispatchEvent(new Event('sps_collaborators_updated'));
      } catch (e) {}

      setTimeout(() => {
        setIsLocked(false);
        if (onUnlock) onUnlock();
      }, 1200);
    } else {
      setOtpError('Invalid OTP code. Please enter the 6-digit Security OTP sent to your email by the Primary Admin.');
    }
  };

  const handleSendAuthorizationRequest = () => {
    const userMail = inputEmail.trim() || invitedEmail.trim() || 'collaborator@studio.com';
    const subject = `🔐 1-Time Studio Access Authorization Request from ${userMail}`;
    const body = `Hello Studio Admin,\n\nI am requesting 1-Time Access Authorization to open and collaborate on Stage Work Studio — AI Cinema Production OS.\n\n📌 My Credentials:\n📧 Email ID: ${userMail}\n🔑 Production Room ID: ${invitedRoom || 'SPS-CLOUD-8821'}\n\nPlease generate and send me my 6-Digit Authorization OTP code.`;
    
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    setRequestSent(true);
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 100 }}>
      <div className="sps-shell sps-shell-md" style={{ height: 'auto', maxHeight: 'min(92dvh, 36rem)', alignSelf: 'center' }}>
        <div className="sps-modal-head">
          <div>
            <h2>{isSuccess ? 'Access granted' : 'Email authorization'}</h2>
            <p>Room {invitedRoom || 'SPS-CLOUD-8821'}</p>
          </div>
        </div>
        <div className="sps-modal-body p-5 space-y-4 text-left">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--sps-muted)' }}>
            Enter your authorized email and 6-digit OTP for this production room.
          </p>

        {!isSuccess ? (
          <form onSubmit={handleVerifyAndUnlock} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--sps-muted)' }}>
                <Mail className="w-3.5 h-3.5" /> Collaborator email
              </label>
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="collaborator@email.com"
                className="w-full rounded-[7px] px-3 py-2 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--sps-muted)' }}>
                <Key className="w-3.5 h-3.5" /> 6-digit OTP
              </label>
              <input
                type="text"
                maxLength={6}
                value={inputOtp}
                onChange={(e) => setInputOtp(e.target.value)}
                placeholder="475926"
                className="w-full rounded-[7px] py-2.5 text-center text-xl tracking-widest font-semibold"
                required
              />
            </div>

            {otpError && (
              <div className="sps-panel p-2 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <button type="submit" className="sps-btn sps-btn-primary w-full">
              <span>Verify email & unlock</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--sps-border)' }}>
              <button
                type="button"
                onClick={handleSendAuthorizationRequest}
                className="sps-btn w-full"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Request OTP from admin</span>
              </button>
              {requestSent && (
                <p className="text-[10px] font-semibold" style={{ color: 'var(--sps-gold)' }}>
                  Email request opened. Admin will send your OTP.
                </p>
              )}
            </div>
          </form>
        ) : (
          <div className="sps-panel p-4 space-y-1">
            <p className="font-semibold text-sm">Email verified</p>
            <p className="text-xs" style={{ color: 'var(--sps-muted)' }}>Session granted for {inputEmail || invitedEmail}. Opening studio…</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
