import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, X, Film, Users, MessageCircle } from 'lucide-react';
import {
  subscribeToCollabChat,
  createCollabMessage,
  postCollabMessage,
  filterChatMessages,
  filterShotComments,
} from '../services/collabChat';

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
  activeShotId,
  activeRemoteUsers = [],
  colorTheme = 'dark',
}) {
  const [tab, setTab] = useState('chat'); // 'chat' | 'comments'
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const isPaper = colorTheme === 'paper';
  const effectiveRoom = roomId || 'SPS-CLOUD-8821';

  useEffect(() => {
    if (!isOpen) return undefined;
    const unsub = subscribeToCollabChat(effectiveRoom, setMessages);
    return () => unsub();
  }, [isOpen, effectiveRoom]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen, tab]);

  const chatMessages = useMemo(() => filterChatMessages(messages), [messages]);
  const shotComments = useMemo(
    () => filterShotComments(messages, activeShotId),
    [messages, activeShotId]
  );
  const visible = tab === 'chat' ? chatMessages : shotComments;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [visible.length, tab, isOpen]);

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

  const onlineCount = (activeRemoteUsers?.length || 0) + 1;

  return (
    <div className="sps-chat-panel fixed bottom-4 right-4 z-[80] w-[min(100vw-1.5rem,24rem)]">
      <div
        className={`rounded-2xl border overflow-hidden flex flex-col max-h-[min(70vh,32rem)] ${
          isPaper
            ? 'bg-white/96 backdrop-blur-xl border-slate-200 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.12)]'
            : 'sps-glass-shell text-white border-cyan-500/20'
        }`}
        style={{ fontFamily: 'var(--sps-font)' }}
      >
        {/* Header */}
        <div
          className={`px-3.5 py-3 border-b flex items-start justify-between gap-2 ${
            isPaper ? 'border-slate-200 bg-slate-50/90' : 'border-white/10 bg-cyan-500/[0.08]'
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare className={`w-4 h-4 shrink-0 ${isPaper ? 'text-cyan-700' : 'text-cyan-300'}`} />
              <h3 className="text-sm font-bold tracking-tight truncate" style={{ fontFamily: 'var(--sps-font-display)' }}>Studio Chat</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {onlineCount} online
              </span>
            </div>
            <p className={`text-[10px] mt-1 truncate ${isPaper ? 'text-slate-500' : 'text-zinc-400'}`}>
              {projectTitle || 'Project'} · room {effectiveRoom}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`sps-chrome-btn p-2.5 sm:p-1.5 rounded-lg shrink-0 ${isPaper ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`px-2 pt-2 flex gap-1 border-b ${isPaper ? 'border-slate-200' : 'border-white/10'}`}>
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
            <Users className="w-3.5 h-3.5" />
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

        {/* Composer */}
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
      </div>
    </div>
  );
}
