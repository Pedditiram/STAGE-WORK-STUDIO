import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, X, Film, Users, MessageCircle, Minimize2, Maximize2, Download } from 'lucide-react';
import { PinBarButton } from './HoverPinBar';
import {
  subscribeToCollabChat,
  createCollabMessage,
  postCollabMessage,
  filterChatMessages,
  filterShotComments,
  exportCollabChatTranscript,
  exportCollabChatZipPack,
  exportCollabNotesCsv,
  CHAT_NOTES_CSV_FILTERS
} from '../services/collabChat';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { exportPresenceRoster, exportPresenceZipPack, PRESENCE_CSV_FILTERS } from '../utils/collabPresenceAudit';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function avatarColor(seed = '') {
  const colors = [
    'from-cyan-500 to-blue-700',
    'from-emerald-500 to-teal-700',
    'from-amber-500 to-orange-600',
    'from-violet-500 to-indigo-700',
    'from-rose-500 to-pink-600',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * 17) % colors.length;
  return colors[hash];
}

export default function CollabChatPanel({
  isOpen,
  onClose,
  roomId,
  projectTitle,
  shots = [],
  activeShotId,
  activeRemoteUsers = [],
  allLiveUsers = [],
  currentUserEmail = '',
  colorTheme = 'dark',
}) {
  const [tab, setTab] = useState('people'); // 'people' | 'chat' | 'comments'
  const [presenceFilter, setPresenceFilter] = useState('all');
  const [notesFilter, setNotesFilter] = useState('all');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const dragRef = useRef(null);

  const [minimized, setMinimized] = useState(() => {
    try { return localStorage.getItem('sps_chat_minimized') === 'true'; } catch { return false; }
  });
  const [posLocked, setPosLocked] = useState(() => {
    try { return localStorage.getItem('sps_chat_pos_locked') === 'true'; } catch { return false; }
  });
  const [pos, setPos] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('sps_chat_pos') || 'null');
      if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) return raw;
    } catch (e) {}
    return null;
  });

  const isPaper = colorTheme === 'paper';
  const effectiveRoom = roomId || 'SPS-CLOUD-8821';

  useEffect(() => {
    try { localStorage.setItem('sps_chat_minimized', minimized ? 'true' : 'false'); } catch (e) {}
  }, [minimized]);
  useEffect(() => {
    try { localStorage.setItem('sps_chat_pos_locked', posLocked ? 'true' : 'false'); } catch (e) {}
  }, [posLocked]);
  useEffect(() => {
    if (!pos) return;
    try { localStorage.setItem('sps_chat_pos', JSON.stringify(pos)); } catch (e) {}
  }, [pos]);

  const clampPos = (x, y, w, h) => {
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return { x: Math.min(maxX, Math.max(8, x)), y: Math.min(maxY, Math.max(8, y)) };
  };

  const onDragPointerDown = (e) => {
    if (posLocked) return;
    if (e.button != null && e.button !== 0) return;
    if (e.target?.closest?.('button, input, a, select, textarea')) return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      w: rect.width,
      h: rect.height
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onDragPointerMove = (e) => {
    if (!dragRef.current) return;
    const { dx, dy, w, h } = dragRef.current;
    setPos(clampPos(e.clientX - dx, e.clientY - dy, w, h));
  };

  const onDragPointerUp = () => {
    dragRef.current = null;
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const unsub = subscribeToCollabChat(effectiveRoom, setMessages);
    return () => unsub();
  }, [isOpen, effectiveRoom]);

  useEffect(() => {
    if (!isOpen || tab === 'people') return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen, tab]);

  const chatMessages = useMemo(() => filterChatMessages(messages), [messages]);
  const shotComments = useMemo(
    () => filterShotComments(messages, activeShotId),
    [messages, activeShotId]
  );
  const visible = tab === 'chat' ? chatMessages : shotComments;

  const myEmail = String(currentUserEmail || '').trim().toLowerCase();
  const peopleByProject = useMemo(() => {
    const self = {
      userEmail: myEmail,
      userName: myEmail ? myEmail.split('@')[0] : 'You',
      projectTitle: projectTitle || 'This project',
      roomId: effectiveRoom,
      activeShotId,
      isSelf: true
    };
    const merged = [self, ...(allLiveUsers || [])];
    const byEmail = new Map();
    merged.forEach((u) => {
      const key = String(u.userEmail || u.userName || Math.random()).toLowerCase();
      const prev = byEmail.get(key);
      if (!prev || u.isSelf) byEmail.set(key, { ...prev, ...u });
    });
    const groups = new Map();
    Array.from(byEmail.values()).forEach((u) => {
      const proj = String(u.projectTitle || '').trim() || 'Using the app';
      if (!groups.has(proj)) groups.set(proj, []);
      groups.get(proj).push(u);
    });
    const entries = Array.from(groups.entries()).sort((a, b) => {
      const aHere = a[0] === (projectTitle || 'This project') ? 0 : 1;
      const bHere = b[0] === (projectTitle || 'This project') ? 0 : 1;
      if (aHere !== bHere) return aHere - bHere;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [allLiveUsers, myEmail, projectTitle, effectiveRoom, activeShotId]);

  const liveCount = 1 + (allLiveUsers?.length || 0);
  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: chatLifecycleStrict,
    mode: chatLifecycleMode
  } = useExportLifecyclePref('collab_chat');
  const exportBlocked = chatLifecycleStrict && !exportLife.exportReady;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [visible.length, tab, isOpen]);

  const handleExport = () => {
    exportCollabChatTranscript(messages, {
      roomId: effectiveRoom,
      projectTitle,
      kind: tab === 'comments' ? 'comments' : 'chat',
      email: myEmail,
      shots,
      lifecycleMode: chatLifecycleMode,
      format: 'txt',
      filter: notesFilter,
      selfEmail: myEmail,
      activeShotId
    });
  };

  const handleExportPdf = () => {
    exportCollabChatTranscript(messages, {
      roomId: effectiveRoom,
      projectTitle,
      kind: tab === 'comments' ? 'comments' : 'chat',
      email: myEmail,
      shots,
      lifecycleMode: chatLifecycleMode,
      format: 'pdf',
      filter: notesFilter,
      selfEmail: myEmail,
      activeShotId
    });
  };

  const handleExportMd = () => {
    exportCollabChatTranscript(messages, {
      roomId: effectiveRoom,
      projectTitle,
      kind: tab === 'comments' ? 'comments' : 'chat',
      email: myEmail,
      shots,
      lifecycleMode: chatLifecycleMode,
      format: 'md',
      filter: notesFilter,
      selfEmail: myEmail,
      activeShotId
    });
  };

  const handleExportPresence = () => {
    exportPresenceRoster({
      peers: allLiveUsers,
      selfEmail: myEmail,
      projectTitle,
      roomId: effectiveRoom,
      activeShotId,
      shots,
      lifecycleMode: chatLifecycleMode,
      filter: presenceFilter
    });
  };

  const handleExportPresenceMd = () => {
    exportPresenceRoster({
      peers: allLiveUsers,
      selfEmail: myEmail,
      projectTitle,
      roomId: effectiveRoom,
      activeShotId,
      shots,
      lifecycleMode: chatLifecycleMode,
      filter: presenceFilter,
      format: 'md'
    });
  };

  const handleExportPresenceZip = () => {
    exportPresenceZipPack({
      peers: allLiveUsers,
      selfEmail: myEmail,
      projectTitle,
      roomId: effectiveRoom,
      activeShotId,
      shots,
      email: myEmail,
      lifecycleMode: chatLifecycleMode,
      filter: presenceFilter
    });
  };

  const handleExportPresenceSelfZip = () => {
    exportPresenceZipPack({
      peers: allLiveUsers,
      selfEmail: myEmail,
      projectTitle,
      roomId: effectiveRoom,
      activeShotId,
      shots,
      email: myEmail,
      lifecycleMode: chatLifecycleMode,
      filter: 'self'
    });
  };


  const handleExportZip = () => {
    exportCollabChatZipPack(messages, {
      roomId: effectiveRoom,
      projectTitle,
      kind: tab === 'comments' ? 'comments' : 'chat',
      email: myEmail,
      shots,
      lifecycleMode: chatLifecycleMode,
      filter: notesFilter,
      selfEmail: myEmail,
      activeShotId
    });
  };

  const handleExportNotesCsv = () => {
    exportCollabNotesCsv(messages, {
      roomId: effectiveRoom,
      projectTitle,
      kind: tab === 'comments' ? 'comments' : 'chat',
      email: myEmail,
      selfEmail: myEmail,
      activeShotId,
      shots,
      lifecycleMode: chatLifecycleMode,
      filter: notesFilter
    });
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const msg = createCollabMessage({
      roomId: effectiveRoom,
      projectTitle,
      kind: tab === 'comments' ? 'comment' : 'chat',
      shotId: activeShotId,
      text,
    });
    setDraft('');
    try {
      const next = await postCollabMessage(msg);
      setMessages(next);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  if (!isOpen) return null;

  const shellClass = isPaper
    ? 'bg-white/96 backdrop-blur-xl border-slate-200 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.12)]'
    : 'sps-glass-shell text-white border-cyan-500/20';

  const posStyle = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 16, bottom: 16, left: 'auto', top: 'auto' };

  if (minimized) {
    return (
      <div
        ref={panelRef}
        className={`sps-chat-panel fixed z-[62] pointer-events-auto ${posLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ ...posStyle, fontFamily: 'var(--sps-font)' }}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        <div className={`rounded-full border pl-3 pr-1.5 py-1.5 flex items-center gap-2 shadow-lg ${shellClass}`}>
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span className="text-[11px] font-bold whitespace-nowrap">Chat</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 border border-emerald-600/30">
            {liveCount}
          </span>
          <PinBarButton pinned={posLocked} onToggle={() => setPosLocked((v) => !v)} label="chat" />
          <button type="button" className="sps-icon-btn" title="Expand" aria-label="Expand chat" onClick={() => setMinimized(false)}>
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="sps-icon-btn" title="Close" aria-label="Close chat" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="sps-chat-panel fixed z-[62] w-[min(100vw-1.5rem,24rem)] pointer-events-auto"
      style={posStyle}
    >
      <div
        className={`rounded-2xl border overflow-hidden flex flex-col max-h-[min(70vh,32rem)] ${shellClass}`}
        style={{ fontFamily: 'var(--sps-font)' }}
      >
        <div
          className={`px-3.5 py-3 border-b flex items-start justify-between gap-2 ${
            isPaper ? 'border-slate-200 bg-slate-50/90' : 'border-white/10 bg-cyan-500/[0.08]'
          } ${posLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare className={`w-4 h-4 shrink-0 ${isPaper ? 'text-cyan-700' : 'text-cyan-300'}`} />
              <h3 className="text-sm font-bold tracking-tight truncate" style={{ fontFamily: 'var(--sps-font-display)' }}>Studio Chat</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 border border-emerald-600/30">
                {liveCount} live
              </span>
            </div>
            <p className={`text-[10px] mt-1 truncate ${isPaper ? 'text-slate-500' : 'text-zinc-400'}`}>
              {projectTitle || 'Project'} · room {effectiveRoom}
              {exportBlocked ? ` · ${exportLife.message}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {tab === 'people' ? (
              <>
                <div
                  className={`hidden sm:flex items-center gap-0.5 p-0.5 rounded-md border ${
                    isPaper ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/20'
                  }`}
                  role="tablist"
                  aria-label="Presence CSV filter"
                >
                  {PRESENCE_CSV_FILTERS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={presenceFilter === opt.id}
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        presenceFilter === opt.id
                          ? isPaper
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-cyan-500/20 text-cyan-200'
                          : isPaper
                            ? 'text-slate-400'
                            : 'text-zinc-500'
                      }`}
                      title={`Presence CSV filter: ${opt.label}`}
                      onClick={() => setPresenceFilter(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExportPresence}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn px-2 py-1.5 rounded-lg text-[9px] font-mono uppercase disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Export presence roster (.csv)'}
                  aria-label="Export presence roster CSV"
                >
                  Presence
                </button>
                <button
                  type="button"
                  onClick={handleExportPresenceMd}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn px-2 py-1.5 rounded-lg text-[9px] font-mono uppercase disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Export presence roster Markdown (filtered)'}
                  aria-label="Export presence roster Markdown"
                >
                  MD
                </button>
                <button
                  type="button"
                  onClick={handleExportPresenceZip}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn px-2 py-1.5 rounded-lg text-[9px] font-mono uppercase disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Export presence pack ZIP (CSV + MD + META)'}
                  aria-label="Export presence pack ZIP"
                >
                  ZIP
                </button>

                <button
                  type="button"
                  onClick={handleExportPresenceSelfZip}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn px-2 py-1.5 rounded-lg text-[9px] font-mono uppercase disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Export self-only presence pack ZIP'}
                  aria-label="Export self-only presence pack ZIP"
                >
                  Self ZIP
                </button>
              </>
            ) : (
              <>
                <div
                  className={`hidden sm:flex items-center gap-0.5 p-0.5 rounded-md border ${
                    isPaper ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/20'
                  }`}
                  role="tablist"
                  aria-label="Chat notes / transcript filter"
                >
                  {CHAT_NOTES_CSV_FILTERS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={notesFilter === opt.id}
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        notesFilter === opt.id
                          ? isPaper
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-cyan-500/20 text-cyan-200'
                          : isPaper
                            ? 'text-slate-400'
                            : 'text-zinc-500'
                      }`}
                      title={`Notes / transcript filter: ${opt.label}`}
                      onClick={() => setNotesFilter(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExportNotesCsv}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn px-2 py-1.5 rounded-lg text-[9px] font-mono uppercase disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Export notes CSV (filtered)'}
                  aria-label="Export chat notes CSV"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn p-2.5 sm:p-1.5 rounded-lg disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Export transcript (.txt)'}
                  aria-label="Export chat transcript"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn px-2 py-1.5 rounded-lg text-[9px] font-mono uppercase disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Print transcript PDF'}
                  aria-label="Export chat transcript PDF"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportMd}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn px-2 py-1.5 rounded-lg text-[9px] font-mono uppercase disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Export transcript Markdown (filtered)'}
                  aria-label="Export chat transcript Markdown"
                >
                  MD
                </button>
                <button
                  type="button"
                  onClick={handleExportZip}
                  disabled={exportBlocked}
                  className={`sps-chrome-btn px-2 py-1.5 rounded-lg text-[9px] font-mono uppercase disabled:opacity-40 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                  title={exportBlocked ? exportLife.message : 'Export chat pack ZIP (transcript + META)'}
                  aria-label="Export chat pack ZIP"
                >
                  ZIP
                </button>
              </>
            )}
            <PinBarButton pinned={posLocked} onToggle={() => setPosLocked((v) => !v)} label="chat" />
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className={`sps-chrome-btn p-2.5 sm:p-1.5 rounded-lg ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
              title="Minimize — keep floating"
              aria-label="Minimize chat"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMinimized(false)}
              className={`sps-chrome-btn p-2.5 sm:p-1.5 rounded-lg ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
              title="Expand"
              aria-label="Expand chat"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`sps-chrome-btn p-2.5 sm:p-1.5 rounded-lg ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`px-2 pt-2 flex gap-1 border-b ${isPaper ? 'border-slate-200' : 'border-white/10'}`}>
          <button
            type="button"
            onClick={() => setTab('people')}
            className={`flex-1 px-2 py-2 text-[11px] font-bold rounded-t-lg flex items-center justify-center gap-1.5 ${
              tab === 'people'
                ? isPaper
                  ? 'bg-white text-cyan-800 border border-b-white border-slate-200'
                  : 'bg-zinc-900 text-cyan-200 border border-b-zinc-900 border-white/10'
                : isPaper
                  ? 'text-slate-500 hover:text-slate-800'
                  : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            People
            <span className="opacity-70">({liveCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`flex-1 px-2 py-2 text-[11px] font-bold rounded-t-lg flex items-center justify-center gap-1.5 ${
              tab === 'chat'
                ? isPaper
                  ? 'bg-white text-cyan-800 border border-b-white border-slate-200'
                  : 'bg-zinc-900 text-cyan-200 border border-b-zinc-900 border-white/10'
                : isPaper
                  ? 'text-slate-500 hover:text-slate-800'
                  : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Room chat
            <span className="opacity-70">({chatMessages.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('comments')}
            className={`flex-1 px-2 py-2 text-[11px] font-bold rounded-t-lg flex items-center justify-center gap-1.5 ${
              tab === 'comments'
                ? isPaper
                  ? 'bg-white text-amber-800 border border-b-white border-slate-200'
                  : 'bg-zinc-900 text-amber-200 border border-b-zinc-900 border-white/10'
                : isPaper
                  ? 'text-slate-500 hover:text-slate-800'
                  : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Shot notes
            <span className="opacity-70">({shotComments.length})</span>
          </button>
        </div>

        {/* People by project / anyone in the app */}
        {tab === 'people' && (
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[14rem]">
            {peopleByProject.length === 0 ? (
              <p className={`text-center text-xs py-8 ${isPaper ? 'text-slate-500' : 'text-zinc-500'}`}>
                No one is live in the app right now.
              </p>
            ) : (
              peopleByProject.map(([proj, users]) => {
                const here = proj === (projectTitle || 'This project');
                return (
                  <div key={proj}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${isPaper ? 'text-slate-500' : 'text-zinc-500'}`}>
                      {here ? 'This project' : 'In the app'} · {proj}
                      <span className="ml-1 opacity-70">({users.length})</span>
                    </p>
                    <ul className="space-y-1.5">
                      {users.map((u) => {
                        const label = u.isSelf ? 'You' : (u.userName || (u.userEmail || '').split('@')[0] || 'Collaborator');
                        const initial = String(label).charAt(0).toUpperCase();
                        return (
                          <li key={u.userEmail || label} className="flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(u.userEmail || label)} text-[11px] font-black text-white flex items-center justify-center shrink-0`}>
                              {initial}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-bold truncate">
                                {label}
                                {u.isSelf ? <span className="ml-1 text-[9px] font-semibold opacity-60">you</span> : null}
                              </p>
                              <p className={`text-[10px] truncate ${isPaper ? 'text-slate-500' : 'text-zinc-500'}`}>
                                {u.activeShotId ? `On ${u.activeShotId}` : u.roomId ? `Room ${u.roomId}` : 'In studio'}
                              </p>
                            </div>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'comments' && (
          <div
            className={`px-3 py-1.5 text-[10px] font-mono border-b ${
              isPaper ? 'bg-amber-50 text-amber-900 border-slate-200' : 'bg-amber-500/10 text-amber-200 border-white/5'
            }`}
          >
            Commenting on shot <strong>{activeShotId || '—'}</strong>
          </div>
        )}

        {/* Messages */}
        {tab !== 'people' && (
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-[14rem]">
          {visible.length === 0 ? (
            <div className={`text-center py-10 px-4 ${isPaper ? 'text-slate-500' : 'text-zinc-500'}`}>
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">
                {tab === 'chat' ? 'No messages yet' : 'No comments on this shot'}
              </p>
              <p className="text-[11px] mt-1 opacity-80">
                {tab === 'chat'
                  ? 'Say hello to collaborators in this room.'
                  : 'Leave a note for the team on the active shot.'}
              </p>
            </div>
          ) : (
            visible.map((m) => {
              const initial = String(m.userName || m.userEmail || '?').charAt(0).toUpperCase();
              return (
                <div key={m.id} className="flex gap-2 items-start">
                  <span
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(m.userEmail || m.userName)} text-[11px] font-black text-white flex items-center justify-center shrink-0`}
                  >
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-bold truncate">{m.userName || 'User'}</span>
                      <span className={`text-[9px] tabular-nums ${isPaper ? 'text-slate-400' : 'text-zinc-500'}`}>
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`sps-msg-bubble text-[12px] leading-relaxed mt-0.5 whitespace-pre-wrap break-words rounded-xl px-2.5 py-1.5 ${
                        isPaper ? 'bg-slate-100 text-slate-800' : 'bg-white/5 text-zinc-100'
                      }`}
                    >
                      {m.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        )}

        {tab !== 'people' && (
        <form
          onSubmit={handleSend}
          className={`p-2.5 border-t flex gap-2 ${isPaper ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/30'}`}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tab === 'chat' ? 'Message the room…' : `Comment on ${activeShotId || 'shot'}…`}
            maxLength={2000}
            className={`flex-1 min-w-0 rounded-xl px-3 py-2.5 sm:py-2 text-xs focus:outline-none border min-h-[2.5rem] sps-input-premium ${
              isPaper
                ? 'bg-white border-slate-300 text-slate-900 focus:border-cyan-500'
                : 'bg-zinc-900 border-white/10 text-white focus:border-cyan-400'
            }`}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="sps-chrome-btn px-3.5 py-2.5 sm:py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0 min-h-[2.5rem]"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
