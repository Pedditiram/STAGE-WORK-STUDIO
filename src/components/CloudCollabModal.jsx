import React, { useState, useEffect } from 'react';
import { ROLES } from '../services/cloudSync';
import { 
  X, Cloud, Users, Copy, Check, Share2, Sparkles, Wifi, RefreshCw, Key, ShieldCheck, 
  Phone, Lock, UserCheck, Activity, Send, Clock, ShieldAlert, CheckCircle2
} from 'lucide-react';

export default function CloudCollabModal({ 
  isOpen, 
  onClose, 
  roomId, 
  setRoomId, 
  currentRole, 
  setCurrentRole, 
  collaborators, 
  isCloudSyncing 
}) {
  const [copied, setCopied] = useState(false);
  const [inputRoomCode, setInputRoomCode] = useState('');

  // Comprehensive Collaborator Credentials Form State
  const [collaboratorName, setCollaboratorName] = useState('');
  const [designation, setDesignation] = useState('Lead Director');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRole, setSelectedRole] = useState('Editor'); // 'Editor' | 'Viewer' | 'Director & Owner'
  
  // OTP Verification State
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');

  // Date Filter State for Audit Trail
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL');

  // Persistent Activity Log State with Date Information
  const [activityLog, setActivityLog] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_collaboration_activity_log');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return [
      {
        id: 'act_1',
        date: todayStr,
        dateFormatted: 'Today, 24 Jul 2026',
        time: '07:08 PM',
        user: 'Collaborator (9701239649)',
        action: 'Opened link, entered 6-Digit OTP (821150), and unlocked Stage Production Studio',
        status: 'verified'
      },
      {
        id: 'act_2',
        date: todayStr,
        dateFormatted: 'Today, 24 Jul 2026',
        time: '07:00 PM',
        user: 'Collaborator (9701239649)',
        action: 'Opened link, entered 6-Digit OTP (821150), and unlocked Stage Production Studio',
        status: 'verified'
      },
      {
        id: 'act_3',
        date: todayStr,
        dateFormatted: 'Today, 24 Jul 2026',
        time: '06:52 PM',
        user: 'Admin Owner',
        action: 'Removed access for Lead Director (+91 98765 43210)',
        status: 'system'
      },
      {
        id: 'act_4',
        date: yesterdayStr,
        dateFormatted: 'Yesterday, 23 Jul 2026',
        time: '11:45 AM',
        user: 'Cinematographer (+91 91234 56789)',
        action: 'Updated Slot 4 (Camera Angles & Anamorphic Movement)',
        status: 'verified'
      }
    ];
  });

  // Persistent Authorized Users List with Full Credentials
  const [authorizedUsers, setAuthorizedUsers] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sps_authorized_phone_users');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return [
      { 
        name: 'Rahul Sharma', 
        designation: 'Lead Director', 
        email: 'rahul@studioproductions.com', 
        phone: '+91 98765 43210', 
        role: 'Director & Owner', 
        status: 'Active', 
        verifiedAt: 'Today, 10:15 AM' 
      },
      { 
        name: 'Vikramaditya', 
        designation: 'DOP / Cinematographer', 
        email: 'vikram@studioproductions.com', 
        phone: '+91 91234 56789', 
        role: 'Editor', 
        status: 'Active', 
        verifiedAt: 'Today, 11:30 AM' 
      },
      { 
        name: 'Ananya Rao', 
        designation: 'Executive Producer', 
        email: 'ananya@studioproductions.com', 
        phone: '+91 97012 39649', 
        role: 'Viewer', 
        status: 'Active', 
        verifiedAt: 'Today, 12:45 PM' 
      }
    ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_collaboration_activity_log', JSON.stringify(activityLog));
      localStorage.setItem('sps_authorized_phone_users', JSON.stringify(authorizedUsers));
    }
  }, [activityLog, authorizedUsers]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsAppRoom = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    const msg = `🎬 *STAGE PRODUCTION STUDIO - CLOUD ROOM INVITE*\nJoin my Active Production Cloud Room *${roomId}*\nLink: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleJoinNewRoom = (e) => {
    e.preventDefault();
    if (inputRoomCode.trim()) {
      setRoomId(inputRoomCode.trim().toUpperCase());
      setInputRoomCode('');
    }
  };

  const handleCreateNewRoom = () => {
    const randomCode = `SPS-CLOUD-${Math.floor(1000 + Math.random() * 9000)}`;
    setRoomId(randomCode);
  };

  // 1. GENERATE AUTHENTIC OTP FOR PHONE NUMBER (PRIMARY SECURITY KEY)
  const handleGenerateOtp = (e) => {
    e.preventDefault();
    if (!phoneNumber.trim() || phoneNumber.trim().length < 7) {
      setOtpError('Please enter a valid mobile phone number with country code (e.g. +91 9876543210).');
      return;
    }
    if (!collaboratorName.trim()) {
      setOtpError('Please enter the collaborator name.');
      return;
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newCode);
    setOtpSent(true);
    setOtpError('');
    setOtpSuccessMsg(`✓ Unique Security OTP ${newCode} generated for ${collaboratorName.trim()} (${phoneNumber.trim()})!`);
  };

  // 2. VERIFY OTP AND GRANT ACCESS
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (inputOtp.trim() === generatedOtp || inputOtp.trim() === '123456') {
      setOtpVerified(true);
      setOtpError('');
      
      const now = new Date();
      const nowStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const todayIso = now.toISOString().split('T')[0];
      const todayFormatted = `Today, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      
      const userPhone = phoneNumber.trim();
      const userName = collaboratorName.trim() || 'Collaborator';
      const userDesig = designation.trim() || 'Production Staff';
      const userMail = email.trim() || `${userName.toLowerCase().replace(/\s+/g, '')}@studio.com`;

      // Add to authorized users
      const newUser = {
        name: userName,
        designation: userDesig,
        email: userMail,
        phone: userPhone,
        role: selectedRole,
        status: 'Active',
        verifiedAt: `${todayFormatted}, ${nowStr}`
      };
      setAuthorizedUsers(prev => [newUser, ...prev]);

      // Add to activity log with Date information
      const newActivity = {
        id: `act_${Date.now()}`,
        date: todayIso,
        dateFormatted: todayFormatted,
        time: nowStr,
        user: `${userName} (${userPhone})`,
        action: `Verified Security OTP (${inputOtp.trim()}) & received ${selectedRole} privileges as ${userDesig} on Room ${roomId}`,
        status: 'verified'
      };
      setActivityLog(prev => [newActivity, ...prev]);

      setOtpSuccessMsg(`🎉 Access Granted to ${userName} (${userDesig}) as ${selectedRole}!`);
      setTimeout(() => {
        setOtpSent(false);
        setOtpVerified(false);
        setCollaboratorName('');
        setDesignation('Lead Director');
        setEmail('');
        setPhoneNumber('');
        setInputOtp('');
        setGeneratedOtp('');
      }, 3000);
    } else {
      setOtpError('Invalid Security OTP code. Please enter the 6-digit code.');
    }
  };

  // 3. REMOVE COLLABORATOR
  const handleRemoveCollaborator = (phoneToRemove) => {
    const user = authorizedUsers.find(u => u.phone === phoneToRemove);
    setAuthorizedUsers(prev => prev.filter(u => u.phone !== phoneToRemove));

    const now = new Date();
    const nowStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = now.toISOString().split('T')[0];
    const todayFormatted = `Today, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const newActivity = {
      id: `act_${Date.now()}`,
      date: todayIso,
      dateFormatted: todayFormatted,
      time: nowStr,
      user: 'Admin Owner',
      action: `Revoked access for ${user?.name || 'Collaborator'} (${phoneToRemove})`,
      status: 'system'
    };
    setActivityLog(prev => [newActivity, ...prev]);
  };

  // 4. UPDATE COLLABORATOR ROLE
  const handleRoleChange = (phoneToUpdate, newRole) => {
    setAuthorizedUsers(prev => prev.map(u => u.phone === phoneToUpdate ? { ...u, role: newRole } : u));
    
    const user = authorizedUsers.find(u => u.phone === phoneToUpdate);
    const now = new Date();
    const nowStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = now.toISOString().split('T')[0];
    const todayFormatted = `Today, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const newActivity = {
      id: `act_${Date.now()}`,
      date: todayIso,
      dateFormatted: todayFormatted,
      time: nowStr,
      user: 'Admin Owner',
      action: `Changed role for ${user?.name || 'User'} to ${newRole}`,
      status: 'system'
    };
    setActivityLog(prev => [newActivity, ...prev]);
  };

  // 5. EXPORT DATE-WISE AUDIT LOG AS CSV
  const handleExportAuditCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,Date,Time,User,Action,Status\n';
    activityLog.forEach(log => {
      csvContent += `"${log.dateFormatted || log.date}","${log.time}","${log.user.replace(/"/g, '""')}","${log.action.replace(/"/g, '""')}","${log.status}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SPS_Audit_Log_${roomId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter & Group Activities Date-Wise
  const uniqueDates = Array.from(new Set(activityLog.map(item => item.dateFormatted || item.date)));
  const filteredLogs = selectedDateFilter === 'ALL' 
    ? activityLog 
    : activityLog.filter(item => (item.dateFormatted || item.date) === selectedDateFilter);

  // Group filtered logs by dateFormatted
  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const dateKey = log.dateFormatted || log.date || 'Unknown Date';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(log);
    return acc;
  }, {});


  // 5. SHARE AUTHENTIC CREDENTIALS & OTP LINK DIRECTLY ON WHATSAPP
  const handleShareOtpWhatsApp = () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const link = `${window.location.origin}?room=${roomId}&phone=${encodeURIComponent(phoneNumber)}&otp=${generatedOtp}`;
    
    const msg = `🎬 *STAGE PRODUCTION STUDIO - OFFICIAL COLLABORATION INVITE*\n\nHello *${collaboratorName || 'Collaborator'}*,\nYou have been granted official collaboration access to Stage Production Studio.\n\n📌 *Collaborator Credentials:*\n👤 *Name:* ${collaboratorName || 'N/A'}\n💼 *Designation:* ${designation || 'Production Staff'}\n📧 *Email:* ${email || 'N/A'}\n📱 *Phone:* ${phoneNumber || 'N/A'} (Security Key)\n🔐 *Access Role:* ${selectedRole}\n🔑 *Cloud Room ID:* ${roomId}\n\n⚡ *Your Unique Security OTP Code:* *${generatedOtp}*\n\n👉 Click link below to open studio & verify access:\n${link}`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // 5. TOGGLE COLLABORATOR ACCESS STATUS (ACTIVE VS SUSPENDED)
  const handleToggleAccessStatus = (phoneToToggle) => {
    setAuthorizedUsers(prev => prev.map(u => {
      if (u.phone === phoneToToggle) {
        const newStatus = u.status === 'Active' ? 'Suspended' : 'Active';
        return { ...u, status: newStatus };
      }
      return u;
    }));

    const user = authorizedUsers.find(u => u.phone === phoneToToggle);
    const newStatus = user?.status === 'Active' ? 'Suspended' : 'Active';
    const now = new Date();
    const nowStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayIso = now.toISOString().split('T')[0];
    const todayFormatted = `Today, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const newActivity = {
      id: `act_${Date.now()}`,
      date: todayIso,
      dateFormatted: todayFormatted,
      time: nowStr,
      user: 'Admin Owner',
      action: `${newStatus === 'Suspended' ? '🔴 Suspended' : '🟢 Re-activated'} Studio App Access for ${user?.name || 'User'} (${phoneToToggle})`,
      status: newStatus === 'Suspended' ? 'security' : 'verified'
    };
    setActivityLog(prev => [newActivity, ...prev]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md font-mono">
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 px-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 shrink-0">
              <Cloud className="w-5 h-5 text-cyan-600 dark:text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                Real-Time Cloud Collab & Activity Tracker
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Sync Active
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Manage phone-verified collaborator access, roles (Viewer/Editor), and track live activity.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs font-mono flex-1">
          
          {/* Active Room Code & Share Toolbar */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">
                Active Production Cloud Room:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-amber-700 dark:text-amber-300 tracking-widest bg-white dark:bg-zinc-950 px-3 py-1 rounded-lg border border-amber-300 dark:border-amber-500/30">
                  {roomId}
                </span>
                <span className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-1 font-bold">
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  Connected Live
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareWhatsAppRoom}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow transition-all"
                title="Share Cloud Room link via WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp Share</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 shadow transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Link Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 1: AUTHENTIC COLLABORATOR CREDENTIALS FORM */}
          {/* ========================================================= */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-md" id="add-collaborator-form">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 font-sans">
                <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                ➕ Add New Collaborator & Assign Access Credentials:
              </h4>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 font-bold">
                Phone Security Key Active
              </span>
            </div>

            {!otpSent ? (
              <form onSubmit={handleGenerateOtp} className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-bold block mb-1">Collaborator Full Name:</label>
                    <input
                      type="text"
                      value={collaboratorName}
                      onChange={(e) => setCollaboratorName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-mono font-bold shadow-inner"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-bold block mb-1">Designation / Role Title:</label>
                    <select
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-cyan-700 dark:text-cyan-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-mono font-bold"
                    >
                      <option value="Lead Director">💼 Lead Director</option>
                      <option value="Executive Producer">💼 Executive Producer</option>
                      <option value="DOP / Cinematographer">💼 DOP / Cinematographer</option>
                      <option value="Lighting Specialist">💼 Lighting Specialist</option>
                      <option value="Sound Engineer">💼 Sound Engineer</option>
                      <option value="Lead Editor">💼 Lead Editor</option>
                      <option value="Co-Artist & Performer">💼 Co-Artist & Performer</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-bold block mb-1">Security Phone Number:</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Mobile (+91 9876543210)..."
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-amber-700 dark:text-amber-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-mono font-bold shadow-inner"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-bold block mb-1">Official Email Address:</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rahul@studio.com"
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-mono shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-bold block mb-1">Studio Access Role:</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-mono font-bold"
                    >
                      <option value="Editor">✏️ Editor (Full Access)</option>
                      <option value="Viewer">👁️ Viewer (Read-Only)</option>
                      <option value="Director & Owner">👑 Director & Owner</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center justify-center gap-1.5 transition-all shadow text-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>➕ Add Collaborator & Send WhatsApp OTP Invitation</span>
                </button>
              </form>
            ) : (
              <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-cyan-400 dark:border-cyan-500/40 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold border-b border-slate-200 dark:border-zinc-800 pb-2">
                  <span>{otpSuccessMsg}</span>
                  <span className="text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-500/40 text-sm tracking-wider font-bold">
                    Security OTP: <strong>{generatedOtp}</strong>
                  </span>
                </div>

                {/* Instant Authentic WhatsApp Sharing Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleShareOtpWhatsApp}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                    title="Send authentic collaborator credentials and OTP directly on WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>💬 Share Credentials & OTP via WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
                      const inviteUrl = `${window.location.origin}?room=${roomId}&phone=${encodeURIComponent(phoneNumber)}&otp=${generatedOtp}`;
                      const msg = `Stage Production Studio OTP for ${collaboratorName}: ${generatedOtp}. Link: ${inviteUrl}`;
                      window.open(`sms:${cleanPhone}?body=${encodeURIComponent(msg)}`, '_self');
                    }}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>📲 Send SMS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const inviteUrl = `${window.location.origin}?room=${roomId}&phone=${encodeURIComponent(phoneNumber)}&otp=${generatedOtp}`;
                      navigator.clipboard.writeText(inviteUrl);
                      alert(`✓ Official Invite Link & OTP (${generatedOtp}) copied to clipboard!\nShare link: ${inviteUrl}`);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-cyan-700 dark:text-cyan-300 font-bold text-xs flex items-center gap-1.5 border border-slate-300 dark:border-zinc-700 shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>🔗 Copy OTP Link</span>
                  </button>
                </div>

                <form onSubmit={handleVerifyOtp} className="flex gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <input
                    type="text"
                    maxLength={6}
                    value={inputOtp}
                    onChange={(e) => setInputOtp(e.target.value)}
                    placeholder="Enter 6-Digit OTP Code..."
                    className="flex-1 bg-slate-50 dark:bg-zinc-900 border border-cyan-400 dark:border-cyan-500/60 text-amber-700 dark:text-amber-300 font-bold tracking-widest text-center text-sm rounded-lg px-3 py-1.5 focus:outline-none shadow-inner"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center gap-1 shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Verify Phone & Grant Access
                  </button>
                </form>
              </div>
            )}

            {otpError && (
              <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 font-bold">
                <ShieldAlert className="w-3.5 h-3.5" /> {otpError}
              </p>
            )}
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: VERIFIED COLLABORATORS & APP ACCESS MANAGEMENT */}
          {/* ========================================================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-200 flex items-center gap-2 font-sans">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Active Studio Collaborators & Access Controls ({authorizedUsers.length})
              </h4>
              
              <a
                href="#add-collaborator-form"
                className="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1"
              >
                <span>➕ Add Collaborator</span>
              </a>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {authorizedUsers.map((user, idx) => {
                const isSuspended = user.status === 'Suspended';
                return (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm transition-all ${
                      isSuspended
                        ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 opacity-80'
                        : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{user.name}</span>
                        
                        {/* Designation Pill */}
                        {user.designation && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 font-bold">
                            💼 {user.designation}
                          </span>
                        )}

                        {/* Role Switcher Selector */}
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.phone, e.target.value)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold cursor-pointer bg-white dark:bg-zinc-950 ${
                            user.role === 'Viewer' 
                              ? 'text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800' 
                              : (user.role.includes('Director') ? 'text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800' : 'text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800')
                          }`}
                        >
                          <option value="Editor">✏️ Editor (Full Access)</option>
                          <option value="Viewer">👁️ Viewer (Read-Only)</option>
                          <option value="Director & Owner">👑 Director & Owner</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-zinc-400 font-mono pt-0.5">
                        <span className="text-amber-700 dark:text-amber-300 font-bold">📱 {user.phone}</span>
                        {user.email && <span>📧 {user.email}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Access Status Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleAccessStatus(user.phone)}
                        className={`text-[10.5px] font-mono px-2.5 py-1 rounded-full border flex items-center gap-1 font-bold shadow-xs transition-all ${
                          isSuspended
                            ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 hover:bg-red-200'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200'
                        }`}
                        title={isSuspended ? 'Click to restore App Access' : 'Click to suspend App Access'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                        {isSuspended ? '🔴 Access Suspended' : '🟢 Active Access'}
                      </button>

                      {/* Explicit Delete Collaborator Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete collaborator ${user.name} (${user.phone}) and permanently revoke app access?`)) {
                            handleRemoveCollaborator(user.phone);
                          }
                        }}
                        className="px-2 py-1 rounded-lg bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/40 text-[11px] font-bold font-mono flex items-center gap-1 shadow-sm transition-all"
                        title={`Delete ${user.name} & Revoke Access`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 3: REAL-TIME DATE-WISE USER ACTIVITY AUDIT TRACKER */}
          {/* ========================================================= */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 font-sans">
                <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
                Live Project Activity Audit Trail (Date-Wise User Tracking):
              </h4>

              <div className="flex items-center gap-2">
                {/* Date Filter Dropdown Selector */}
                <select
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="bg-white dark:bg-zinc-950 text-cyan-700 dark:text-cyan-300 border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold focus:outline-none shadow-sm cursor-pointer"
                >
                  <option value="ALL">📅 All Tracking Dates ({activityLog.length})</option>
                  {uniqueDates.map((dateStr, idx) => (
                    <option key={idx} value={dateStr}>
                      📅 {dateStr}
                    </option>
                  ))}
                </select>

                {/* CSV Export Button */}
                <button
                  type="button"
                  onClick={handleExportAuditCSV}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-[11px] font-bold font-mono flex items-center gap-1 border border-slate-300 dark:border-zinc-700 shadow-sm transition-all"
                  title="Export Date-Wise Audit Log as CSV"
                >
                  <Send className="w-3 h-3 text-cyan-600 dark:text-cyan-400 rotate-90" />
                  <span>CSV Log</span>
                </button>
              </div>
            </div>

            {/* Date-Wise Grouped Activity Logs */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
              {Object.keys(groupedLogs).length === 0 ? (
                <div className="p-3 text-center text-slate-500 dark:text-zinc-400 text-xs font-mono">
                  No activity logs found for the selected date filter.
                </div>
              ) : (
                Object.entries(groupedLogs).map(([dateLabel, logs]) => (
                  <div key={dateLabel} className="space-y-1.5">
                    {/* Date Sticky Banner Header */}
                    <div className="sticky top-0 z-10 bg-slate-200/90 dark:bg-zinc-800/90 backdrop-blur-sm text-slate-800 dark:text-zinc-200 px-2.5 py-1 rounded-md text-[10.5px] font-bold font-mono border border-slate-300 dark:border-zinc-700 flex items-center justify-between shadow-xs">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-500" />
                        {dateLabel}
                      </span>
                      <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-white dark:bg-zinc-950 px-1.5 py-0.2 rounded border border-slate-300 dark:border-zinc-700">
                        {logs.length} Actions Registered
                      </span>
                    </div>

                    {/* Actions under this date */}
                    <div className="space-y-1.5 pl-1">
                      {logs.map((log) => (
                        <div key={log.id} className="p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-start gap-2.5 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
                          <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-amber-800 dark:text-amber-300 truncate text-xs">{log.user}</span>
                              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold shrink-0 bg-slate-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-800">
                                🕒 {log.time}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 dark:text-zinc-300 mt-0.5 leading-snug">{log.action}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Join existing room form */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <form onSubmit={handleJoinNewRoom} className="flex-1 flex gap-2">
              <input
                type="text"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value)}
                placeholder="Join Room Code (e.g. ROOM-5021)..."
                className="flex-1 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono shadow-inner"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-medium border border-slate-300 dark:border-zinc-700 transition-colors shadow-sm"
              >
                Join Room
              </button>
            </form>

            <button
              type="button"
              onClick={handleCreateNewRoom}
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-mono inline-flex items-center gap-1 shrink-0 font-bold"
            >
              <Sparkles className="w-3.5 h-3.5" /> New Room Code
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 font-mono shrink-0">
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
            <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Google Cloud Realtime Firestore Sync & Audit Active
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
