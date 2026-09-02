/**
 * Room-scoped chat + shot comments for Stage Production Studio.
 * Syncs via /api/sync?type=chat&roomId=… with localStorage + BroadcastChannel fallback.
 */

import { getNativeSyncUrl, fetchSyncJson, subscribeToCollabTick } from './cloudSync';
import { safeLocalStorageSetItem } from '../utils/safeStorage';
import { assertExportAllowed, logExportSuccess, resolveCollabRoomId, EXPORT_LIFECYCLE, exportDownloadText } from '../utils/exportGate';
import { canUseSaasFeature } from '../utils/saasControl';
import { getCurrentUserEmail } from '../utils/projectPermissions';
import { downloadTextFile } from '../utils/screenplayInterop';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';

const POLL_MS = 12000;
const MAX_MESSAGES = 400;

function isBrowser() {
  return typeof window !== 'undefined';
}

function storageKey(roomId) {
  return `sps_collab_chat_${String(roomId || 'SPS-CLOUD-8821')}`;
}

function readLocal(roomId) {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(roomId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeLocal(roomId, messages) {
  if (!isBrowser()) return;
  const trimmed = (Array.isArray(messages) ? messages : [])
    .slice()
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .slice(-MAX_MESSAGES);
  safeLocalStorageSetItem(storageKey(roomId), JSON.stringify(trimmed));
  return trimmed;
}

function mergeMessages(localList, remoteList) {
  const map = new Map();
  [...(localList || []), ...(remoteList || [])].forEach((m) => {
    if (!m?.id) return;
    const prev = map.get(m.id);
    if (!prev) {
      map.set(m.id, m);
      return;
    }
    const pt = Date.parse(prev.createdAt || '') || 0;
    const nt = Date.parse(m.createdAt || '') || 0;
    map.set(m.id, nt >= pt ? { ...prev, ...m } : { ...m, ...prev });
  });
  return Array.from(map.values())
    .filter((m) => !m.deleted)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .slice(-MAX_MESSAGES);
}

async function pullRemote(roomId) {
  const base = getNativeSyncUrl();
  const json = await fetchSyncJson(`${base}?type=chat&roomId=${encodeURIComponent(roomId)}`);
  return Array.isArray(json?.messages) ? json.messages : [];
}

async function pushRemote(roomId, messages) {
  const base = getNativeSyncUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${base}?type=chat&roomId=${encodeURIComponent(roomId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`chat push ${res.status}`);
    const json = await res.json();
    return Array.isArray(json?.messages) ? json.messages : messages;
  } finally {
    clearTimeout(timer);
  }
}

function currentUserMeta() {
  if (!isBrowser()) {
    return { userEmail: 'guest', userName: 'Guest' };
  }
  const email = String(localStorage.getItem('sps_authorized_user_email') || '').trim().toLowerCase();
  const users = (() => {
    try {
      return JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
    } catch (e) {
      return [];
    }
  })();
  const profile = Array.isArray(users)
    ? users.find((u) => String(u.email || '').trim().toLowerCase() === email)
    : null;
  const userName =
    profile?.name ||
    (email.includes('@') ? email.split('@')[0] : '') ||
    'Studio User';
  return {
    userEmail: email || 'guest@studio.local',
    userName,
  };
}

export function createCollabMessage({
  roomId,
  projectTitle,
  kind = 'chat',
  shotId = null,
  text,
}) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  const { userEmail, userName } = currentUserMeta();
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: roomId || 'SPS-CLOUD-8821',
    projectTitle: projectTitle || '',
    kind: kind === 'comment' ? 'comment' : 'chat',
    shotId: kind === 'comment' ? shotId || null : null,
    text: clean.slice(0, 2000),
    userEmail,
    userName,
    createdAt: new Date().toISOString(),
  };
}

export async function postCollabMessage(message) {
  if (!message?.id) return readLocal(message?.roomId);
  const roomId = message.roomId || 'SPS-CLOUD-8821';
  const local = mergeMessages(readLocal(roomId), [message]);
  writeLocal(roomId, local);

  if (isBrowser() && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('sps_collab_chat');
      bc.postMessage({ roomId, messages: local });
      bc.close();
    } catch (e) {}
  }

  try {
    const remote = await pushRemote(roomId, local);
    const merged = mergeMessages(local, remote);
    writeLocal(roomId, merged);
    try {
      const { notifyStudioWhatsApp } = await import('./dbService.js');
      notifyStudioWhatsApp({
        event: 'chat',
        userEmail: message.userEmail,
        userName: message.userName,
        projectTitle: message.projectTitle,
        roomId,
        preview: message.text
      });
    } catch (err) {}
    return merged;
  } catch (e) {
    return local;
  }
}

export async function fetchCollabMessages(roomId) {
  const local = readLocal(roomId);
  try {
    const remote = await pullRemote(roomId);
    const merged = mergeMessages(local, remote);
    writeLocal(roomId, merged);
    return merged;
  } catch (e) {
    return local;
  }
}

/**
 * Subscribe to room chat/comments. Callback receives full message list.
 * Returns unsubscribe fn.
 */
export function subscribeToCollabChat(roomId, callback) {
  if (!isBrowser() || typeof callback !== 'function') return () => {};

  let cancelled = false;
  const key = roomId || 'SPS-CLOUD-8821';

  const emit = (list) => {
    if (!cancelled) callback(Array.isArray(list) ? list : []);
  };

  emit(readLocal(key));

  const refresh = async () => {
    if (cancelled) return;
    const list = await fetchCollabMessages(key);
    emit(list);
  };

  refresh();
  const timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    refresh();
  }, POLL_MS);

  let lastChatTick = '';
  const unsubTick = subscribeToCollabTick(key, '', (tick, reason) => {
    if (cancelled || reason === 'init') {
      lastChatTick = `${tick?.chat?.lastId || ''}|${tick?.chat?.count || 0}|${tick?.chat?.revision || 0}`;
      return;
    }
    const sig = `${tick?.chat?.lastId || ''}|${tick?.chat?.count || 0}|${tick?.chat?.revision || 0}`;
    if (sig && sig !== lastChatTick) {
      lastChatTick = sig;
      refresh();
    }
  });

  const onVis = () => {
    if (cancelled) return;
    if (typeof document !== 'undefined' && !document.hidden) refresh();
  };
  if (isBrowser()) {
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
  }

  let bc = null;
  const onBc = (ev) => {
    if (cancelled) return;
    if (ev?.data?.roomId && ev.data.roomId !== key) return;
    if (Array.isArray(ev?.data?.messages)) {
      const merged = mergeMessages(readLocal(key), ev.data.messages);
      writeLocal(key, merged);
      emit(merged);
    }
  };
  if ('BroadcastChannel' in window) {
    bc = new BroadcastChannel('sps_collab_chat');
    bc.addEventListener('message', onBc);
  }

  const onStorage = (e) => {
    if (e.key === storageKey(key)) emit(readLocal(key));
  };
  window.addEventListener('storage', onStorage);

  return () => {
    cancelled = true;
    clearInterval(timer);
    if (typeof unsubTick === 'function') unsubTick();
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onVis);
    if (bc) {
      bc.removeEventListener('message', onBc);
      bc.close();
    }
  };
}

export function filterChatMessages(messages) {
  return (messages || []).filter((m) => m.kind !== 'comment');
}

export function filterShotComments(messages, shotId) {
  const id = String(shotId || '');
  return (messages || []).filter(
    (m) => m.kind === 'comment' && (!id || String(m.shotId || '') === id)
  );
}

/** Shot notes / room chat CSV filters (Presence CSV parity). */
export const CHAT_NOTES_CSV_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'self', label: 'Self' },
  { id: 'peers', label: 'Peers' },
  { id: 'shot', label: 'On shot' }
]);

function applyChatNotesFilter(messages = [], {
  kind = 'comments',
  filter = 'all',
  selfEmail = '',
  activeShotId = ''
} = {}) {
  const base =
    kind === 'comments' ? filterShotComments(messages) : filterChatMessages(messages);
  const f = String(filter || 'all').toLowerCase() || 'all';
  const self = String(selfEmail || '').trim().toLowerCase();
  const shot = String(activeShotId || '').trim();
  return base.filter((m) => {
    const email = String(m?.userEmail || '').trim().toLowerCase();
    const msgShot = String(m?.shotId || '').trim();
    if (f === 'self') return self && email === self;
    if (f === 'peers') return !self || email !== self;
    if (f === 'shot') return Boolean(shot) && msgShot === shot;
    return true;
  });
}

export function formatCollabChatTranscript(messages = [], { roomId = '', projectTitle = '', kind = 'chat', filter = 'all', selfEmail = '', activeShotId = '' } = {}) {
  const filtered = applyChatNotesFilter(messages, {
    kind,
    filter,
    selfEmail,
    activeShotId
  });
  const room = String(roomId || '').trim();
  const lines = [
    `# Stage Work Studio · ${kind === 'comments' ? 'Shot notes' : 'Room chat'}${room ? ` · room ${room}` : ''}`,
    `Project: ${projectTitle || 'Untitled'}`,
    `Room: ${room || '—'}`,
    `Filter: ${String(filter || 'all')}`,
    `Exported: ${new Date().toISOString()}`,
    `Messages: ${filtered.length}`,
    ''
  ];
  filtered.forEach((m) => {
    const who = m.userName || m.userEmail || 'User';
    const when = m.createdAt ? new Date(m.createdAt).toISOString() : '';
    const shot = m.shotId ? ` · ${m.shotId}` : '';
    lines.push(`[${when}] ${who}${shot}: ${String(m.text || '').trim()}`);
  });
  return lines.join('\n');
}

/** Craft Markdown transcript for room chat or shot notes (filter-aware). */
export function collabChatToMarkdown(
  messages = [],
  { roomId = '', projectTitle = '', kind = 'chat', filter = 'all', selfEmail = '', activeShotId = '' } = {}
) {
  const filtered = applyChatNotesFilter(messages, {
    kind,
    filter,
    selfEmail,
    activeShotId
  });
  const title = String(projectTitle || 'Untitled').trim() || 'Untitled';
  const kindLabel = kind === 'comments' ? 'Shot notes' : 'Room chat';
  const f = String(filter || 'all');
  const room = String(roomId || '').trim();
  const lines = [
    `# ${title} — ${kindLabel}${f && f !== 'all' ? ` · ${f}` : ''}`,
    '',
    `- Project: ${title}`,
    `- Room: ${room || '—'}`,
    `- Filter: ${f}`,
    `- Messages: ${filtered.length}`,
    `- Exported: ${new Date().toISOString()}`,
    '',
    '| When | Who | Shot | Message |',
    '| --- | --- | --- | --- |'
  ];
  filtered.forEach((m) => {
    const who = String(m.userName || m.userEmail || 'User').replace(/\|/g, '/');
    const when = m.createdAt ? new Date(m.createdAt).toISOString() : '—';
    const shot = String(m.shotId || '—').replace(/\|/g, '/');
    const text = String(m.text || '')
      .trim()
      .replace(/\|/g, '/')
      .replace(/\n/g, ' ');
    lines.push(`| ${when} | ${who} | ${shot} | ${text || '—'} |`);
  });
  if (!filtered.length) {
    lines.push('| — | — | — | No messages for this filter. |');
  }
  lines.push('');
  return lines.join('\n');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for collab transcript PDF. */
export function collabChatToPrintHtml(messages = [], { roomId = '', projectTitle = '', kind = 'chat', filter = 'all', selfEmail = '', activeShotId = '' } = {}) {
  const filtered = applyChatNotesFilter(messages, {
    kind,
    filter,
    selfEmail,
    activeShotId
  });
  const title = escapeHtml(projectTitle || 'Untitled');
  const kindLabel = kind === 'comments' ? 'Shot notes' : 'Room chat';
  const filterLabel = String(filter || 'all');
  const filterTitle =
    filterLabel && filterLabel !== 'all' ? ` · ${escapeHtml(filterLabel)}` : '';
  const rows = filtered
    .map((m) => {
      const who = escapeHtml(m.userName || m.userEmail || 'User');
      const when = m.createdAt ? escapeHtml(new Date(m.createdAt).toISOString()) : '—';
      const shot = m.shotId ? ` · ${escapeHtml(m.shotId)}` : '';
      const text = escapeHtml(String(m.text || '').trim());
      return `<tr>
        <td class="when">${when}</td>
        <td class="who">${who}${shot}</td>
        <td class="msg">${text}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — ${kindLabel}${filterTitle}</title>
  <style>
    @page { size: letter; margin: 0.6in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 12px; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-size: 8pt; text-transform: uppercase; }
    .when { font-family: ui-monospace, monospace; font-size: 8pt; white-space: nowrap; width: 11rem; }
    .who { font-weight: 600; width: 9rem; }
    .msg { white-space: pre-wrap; word-break: break-word; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — ${kindLabel}${filterTitle}</h1>
  <p class="meta">Room ${escapeHtml(roomId || '—')} · Filter ${escapeHtml(filterLabel)} · ${filtered.length} messages · ${escapeHtml(new Date().toISOString())}</p>
  <table>
    <thead><tr><th>When</th><th>Who</th><th>Message</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3">No messages</td></tr>'}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

/** Export room chat or shot notes — gated by plan export + collab entitlements. */
export function exportCollabChatTranscript(messages = [], opts = {}) {
  const {
    roomId = '',
    projectTitle = '',
    kind = 'chat',
    email = '',
    shots = [],
    lifecycleMode = EXPORT_LIFECYCLE.STRICT,
    format = 'txt',
    filter = 'all',
    selfEmail = '',
    activeShotId = ''
  } = opts;
  if (typeof window === 'undefined') return { ok: false, error: 'Not in browser' };

  const actor = String(email || selfEmail || getCurrentUserEmail() || '').trim().toLowerCase();
  if (!canUseSaasFeature('collab', actor)) {
    window.alert('Collab export is not enabled on this plan.');
    return { ok: false, error: 'collab_disabled' };
  }

  const collabRoomId = resolveCollabRoomId(roomId);
  const f = String(filter || 'all').toLowerCase() || 'all';
  const label = kind === 'comments' ? 'collab_shot_notes' : 'collab_room_chat';
  const fmt = String(format || 'txt').toLowerCase();
  const exportFormat = fmt === 'pdf' ? 'pdf' : fmt === 'md' || fmt === 'markdown' ? 'md' : 'txt';
  const gate = assertExportAllowed({
    email: actor,
    projectTitle,
    label: exportFormat === 'txt' ? label : `${label}_${exportFormat}`,
    format: exportFormat,
    roomId: collabRoomId,
    showAlert: true,
    lifecycleMode,
    shots
  });
  if (!gate.ok) return { ok: false, error: gate.message };

  const slug = String(projectTitle || 'project')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40);
  const filterTag = f === 'all' ? '' : `_${f}`;
  const roomTag = collabRoomId
    ? `_${String(collabRoomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}`
    : '';
  const stem = `${slug}_${kind === 'comments' ? 'shot_notes' : 'room_chat'}${filterTag}${roomTag}`;
  const lifeTag = gate.advisory ? `${lifecycleMode}+ok` : lifecycleMode;
  const msgNote = `${applyChatNotesFilter(messages, { kind, filter: f, selfEmail: actor, activeShotId }).length} msgs · filter:${f} · room:${collabRoomId}`;

  if (exportFormat === 'pdf') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return { ok: false, error: 'popup_blocked' };
    }
    printWindow.document.write(
      collabChatToPrintHtml(messages, { roomId: collabRoomId, projectTitle, kind, filter: f, selfEmail: actor, activeShotId })
    );
    printWindow.document.close();
    logExportSuccess({
      projectTitle,
      label: `${label}_pdf`,
      format: 'pdf',
      filename: `${stem}.pdf`,
      note: msgNote,
      roomId: collabRoomId,
      lifecycleMode: lifeTag
    });
    return { ok: true, filename: `${stem}.pdf`, advisory: Boolean(gate.advisory) };
  }

  if (exportFormat === 'md') {
    const body = collabChatToMarkdown(messages, {
      roomId: collabRoomId,
      projectTitle,
      kind,
      filter: f,
      selfEmail: actor,
      activeShotId
    });
    const filename = `${stem}.md`;
    downloadTextFile(filename, body, 'text/markdown;charset=utf-8');
    logExportSuccess({
      projectTitle,
      label: `${label}_md`,
      format: 'md',
      filename,
      note: msgNote,
      roomId: collabRoomId,
      lifecycleMode: lifeTag
    });
    return { ok: true, filename, advisory: Boolean(gate.advisory) };
  }

  const body = formatCollabChatTranscript(messages, { roomId: collabRoomId, projectTitle, kind, filter: f, selfEmail: actor, activeShotId });
  const filename = `${stem}.txt`;
  downloadTextFile(filename, body, 'text/plain;charset=utf-8');
  logExportSuccess({
    projectTitle,
    label,
    format: 'txt',
    filename,
    note: msgNote,
    roomId: collabRoomId,
    lifecycleMode: lifeTag
  });
  return { ok: true, filename, advisory: Boolean(gate.advisory) };
}

/** ZIP pack: transcript + META + README for room chat or shot notes. */
export function buildCollabChatZipFiles(
  messages = [],
  { roomId = '', projectTitle = '', kind = 'chat', filter = 'all', selfEmail = '', activeShotId = '' } = {}
) {
  const collabRoomId = resolveCollabRoomId(roomId);
  const title = String(projectTitle || 'Untitled').trim() || 'Untitled';
  const isNotes = kind === 'comments';
  const f = String(filter || 'all').toLowerCase() || 'all';
  const filtered = applyChatNotesFilter(messages, {
    kind,
    filter: f,
    selfEmail,
    activeShotId
  });
  const kindLabel = isNotes ? 'shot_notes' : 'room_chat';
  const filterTag = f === 'all' ? '' : `_${f}`;
  const transcript = formatCollabChatTranscript(messages, {
    roomId: collabRoomId,
    projectTitle: title,
    kind,
    filter: f,
    selfEmail,
    activeShotId
  });
  const md = collabChatToMarkdown(messages, {
    roomId: collabRoomId,
    projectTitle: title,
    kind,
    filter: f,
    selfEmail,
    activeShotId
  });
  return [
    { name: `${kindLabel}${filterTag}.txt`, content: transcript },
    { name: `${kindLabel}${filterTag}.md`, content: md },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Kind: ${kindLabel}`,
        `Messages: ${filtered.length}`,
        `Filter: ${f}`,
        `Room: ${collabRoomId || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    },
    {
      name: 'README.md',
      content: [
        `# ${title} — Collab ${isNotes ? 'shot notes' : 'room chat'} pack`,
        '',
        `- Transcript: \`${kindLabel}${filterTag}.txt\``,
        `- Markdown: \`${kindLabel}${filterTag}.md\``,
        `- Messages: ${filtered.length}`,
        `- Filter: ${f}`,
        collabRoomId ? `- Collab room: ${collabRoomId}` : '- Collab room: —',
        '',
        'Re-import is manual — paste or archive for production continuity.'
      ].join('\n')
    }
  ];
}

/** Export collab chat/notes as ZIP (transcript + META). */
export async function exportCollabChatZipPack(messages = [], opts = {}) {
  const {
    roomId = '',
    projectTitle = '',
    kind = 'chat',
    email = '',
    shots = [],
    lifecycleMode = EXPORT_LIFECYCLE.STRICT,
    filter = 'all',
    selfEmail = '',
    activeShotId = ''
  } = opts;
  if (typeof window === 'undefined') return { ok: false, error: 'Not in browser' };

  const actor = String(email || selfEmail || getCurrentUserEmail() || '').trim().toLowerCase();
  if (!canUseSaasFeature('collab', actor)) {
    window.alert('Collab export is not enabled on this plan.');
    return { ok: false, error: 'collab_disabled' };
  }

  const collabRoomId = resolveCollabRoomId(roomId);
  const f = String(filter || 'all').toLowerCase() || 'all';
  const label = kind === 'comments' ? 'collab_shot_notes_zip' : 'collab_room_chat_zip';
  const gate = assertExportAllowed({
    email: actor,
    projectTitle,
    label,
    format: 'zip',
    roomId: collabRoomId,
    showAlert: true,
    lifecycleMode,
    shots
  });
  if (!gate.ok) return { ok: false, error: gate.message };

  const slug = String(projectTitle || 'project')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40);
  const filterTag = f === 'all' ? '' : `_${f}`;
  const roomTag = collabRoomId
    ? `_${String(collabRoomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}`
    : '';
  const stem = `${slug}_${kind === 'comments' ? 'shot_notes' : 'room_chat'}${filterTag}${roomTag}_pack`;
  const files = buildCollabChatZipFiles(messages, {
    roomId: collabRoomId,
    projectTitle,
    kind,
    filter: f,
    selfEmail: actor,
    activeShotId
  });
  const blob = createZipArchive(files);
  const lifeTag = gate.advisory ? `${lifecycleMode}+ok` : lifecycleMode;
  const saved = await saveExportBlob(blob, `${stem}.zip`, {
    projectTitle,
    shots,
    lifecycleMode,
    skipLifecycleCheck: true,
    advisoryAlready: Boolean(gate.advisory),
    auditLabel: label,
    auditFormat: 'zip',
    roomId: collabRoomId,
    note: `${applyChatNotesFilter(messages, { kind, filter: f, selfEmail: actor, activeShotId }).length} msgs · filter:${f} · room:${collabRoomId}`,
    showAlert: false
  });
  if (saved?.blocked) return { ok: false, error: saved.error || gate.message };
  return {
    ok: true,
    filename: `${stem}.zip`,
    advisory: Boolean(gate.advisory),
    lifecycleMode: lifeTag
  };
}

function filteredCount(messages, kind) {
  return kind === 'comments'
    ? filterShotComments(messages).length
    : filterChatMessages(messages).length;
}

/** Craft CSV for room chat or shot notes (Presence CSV parity). */
export function collabNotesToCsv(
  messages = [],
  {
    roomId = '',
    projectTitle = '',
    kind = 'comments',
    filter = 'all',
    selfEmail = '',
    activeShotId = ''
  } = {}
) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['#', 'When', 'Who', 'Email', 'ShotId', 'Kind', 'Text', 'Project', 'Room', 'Filter'];
  const room = resolveCollabRoomId(roomId);
  const title = String(projectTitle || '').trim();
  const f = String(filter || 'all').toLowerCase() || 'all';
  const list = applyChatNotesFilter(messages, {
    kind,
    filter: f,
    selfEmail,
    activeShotId
  });
  const rows = list.map((m, i) =>
    [
      i + 1,
      m?.createdAt ? new Date(m.createdAt).toISOString() : '',
      m?.userName || '',
      m?.userEmail || '',
      m?.shotId || '',
      m?.kind || (kind === 'comments' ? 'comment' : 'chat'),
      String(m?.text || '').trim(),
      title,
      room || '—',
      f
    ]
      .map(esc)
      .join(',')
  );
  const meta = [
    `# Stage Work Studio · ${kind === 'comments' ? 'Shot notes' : 'Room chat'} CSV${room ? ` · room ${room}` : ''}`,
    `# Project: ${title || 'Untitled'}`,
    `# Room: ${room || '—'}`,
    `# Filter: ${f}`,
    `# Messages: ${list.length}`,
    `# Exported: ${new Date().toISOString()}`
  ].join('\n');
  return `${meta}\n${[headers.map(esc).join(','), ...rows].join('\n')}`;
}

/** Export room chat or shot notes as filtered CSV. */
export function exportCollabNotesCsv(messages = [], opts = {}) {
  const {
    roomId = '',
    projectTitle = '',
    kind = 'comments',
    email = '',
    selfEmail = '',
    activeShotId = '',
    shots = [],
    lifecycleMode = EXPORT_LIFECYCLE.STRICT,
    filter = 'all'
  } = opts;
  if (typeof window === 'undefined') return { ok: false, error: 'Not in browser' };

  const actor = String(email || selfEmail || getCurrentUserEmail() || '').trim().toLowerCase();
  if (!canUseSaasFeature('collab', actor)) {
    window.alert('Collab export is not enabled on this plan.');
    return { ok: false, error: 'collab_disabled' };
  }

  const collabRoomId = resolveCollabRoomId(roomId);
  const f = String(filter || 'all').toLowerCase() || 'all';
  const label = kind === 'comments' ? 'collab_shot_notes_csv' : 'collab_room_chat_csv';
  const csv = collabNotesToCsv(messages, {
    roomId: collabRoomId,
    projectTitle,
    kind,
    filter: f,
    selfEmail: actor,
    activeShotId
  });
  const slug = String(projectTitle || 'project')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40);
  const kindTag = kind === 'comments' ? 'shot_notes' : 'room_chat';
  const filterTag = f === 'all' ? '' : `_${f}`;
  const roomTag = collabRoomId
    ? `_${String(collabRoomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}`
    : '';
  const rowCount = Math.max(
    0,
    csv.split('\n').filter((line) => line && !line.startsWith('#')).length - 1
  );
  return exportDownloadText(`${slug}_${kindTag}${filterTag}${roomTag}.csv`, csv, {
    projectTitle,
    auditLabel: label,
    auditFormat: 'csv',
    mime: 'text/csv;charset=utf-8',
    lifecycleMode,
    shots,
    roomId: collabRoomId,
    note: `${rowCount} rows · filter:${f}${collabRoomId ? ` · room:${collabRoomId}` : ''} · ${kindTag}`
  });
}
