/**
 * P22/P23 — Collab presence audit (shot focus, peer join/leave, room tag).
 */

import { appendCreativeAudit } from './creativeAuditLog';
import { assertExportAllowed, exportDownloadText, resolveCollabRoomId, EXPORT_LIFECYCLE } from './exportGate';
import { canUseSaasFeature } from './saasControl';
import { getCurrentUserEmail } from './projectPermissions';
import { createZipArchive } from './zipUtils';
import { saveExportBlob } from './saveExportFile';

let lastSelfKey = '';
const knownPeersByRoom = new Map();

export function auditPresenceIfChanged({
  projectTitle = '',
  userEmail = '',
  shotId = '',
  roomId = '',
  isEditing = false
} = {}) {
  const email = String(userEmail || '').trim().toLowerCase();
  const shot = String(shotId || '').trim();
  const room = String(roomId || '').trim();
  if (!email || !shot || !room) return;
  const key = `${room}|${shot}|${isEditing ? 'edit' : 'view'}`;
  if (key === lastSelfKey) return;
  lastSelfKey = key;
  appendCreativeAudit({
    projectTitle,
    category: 'collab',
    action: isEditing ? 'presence_editing' : 'presence_viewing',
    targetType: 'collab',
    targetId: shot,
    targetLabel: email.split('@')[0] || email,
    note: `room:${room} · ${shot}${isEditing ? ' · editing' : ''}`
  });
}

export function auditPresenceConflict({
  projectTitle = '',
  peerEmail = '',
  peerName = '',
  shotId = '',
  roomId = ''
} = {}) {
  const shot = String(shotId || '').trim();
  const room = String(roomId || '').trim();
  if (!shot) return;
  const label = String(peerName || peerEmail || 'collaborator').trim();
  appendCreativeAudit({
    projectTitle,
    category: 'collab',
    action: 'presence_conflict',
    targetType: 'collab',
    targetId: shot,
    targetLabel: label,
    note: `room:${room || '—'} · ${shot} · concurrent edit`
  });
}

/**
 * Diff peer set for a room — logs join / leave once per transition.
 * Returns { joined, left } email lists.
 */
export function auditPeerPresenceDiff({
  projectTitle = '',
  roomId = '',
  peers = []
} = {}) {
  const room = String(roomId || '').trim();
  if (!room) return { joined: [], left: [] };
  const next = new Map();
  (Array.isArray(peers) ? peers : []).forEach((p) => {
    const email = String(p?.userEmail || p?.email || '').trim().toLowerCase();
    if (!email) return;
    next.set(email, {
      email,
      name: String(p?.userName || p?.name || email.split('@')[0] || 'collaborator').trim(),
      shotId: String(p?.activeShotId || '').trim()
    });
  });
  const prev = knownPeersByRoom.get(room) || new Map();
  const joined = [];
  const left = [];
  next.forEach((peer, email) => {
    if (!prev.has(email)) {
      joined.push(email);
      appendCreativeAudit({
        projectTitle,
        category: 'collab',
        action: 'peer_joined',
        targetType: 'collab',
        targetId: peer.shotId || room,
        targetLabel: peer.name,
        note: `room:${room}${peer.shotId ? ` · ${peer.shotId}` : ''}`
      });
    }
  });
  prev.forEach((peer, email) => {
    if (!next.has(email)) {
      left.push(email);
      appendCreativeAudit({
        projectTitle,
        category: 'collab',
        action: 'peer_left',
        targetType: 'collab',
        targetId: peer.shotId || room,
        targetLabel: peer.name,
        note: `room:${room}${peer.shotId ? ` · ${peer.shotId}` : ''}`
      });
    }
  });
  knownPeersByRoom.set(room, next);
  return { joined, left };
}

/** Clear peer cache for a room (e.g. leave room / logout). */
export function resetPeerPresenceRoom(roomId = '') {
  const room = String(roomId || '').trim();
  if (room) knownPeersByRoom.delete(room);
  else knownPeersByRoom.clear();
}

/** Craft CSV for live presence roster (export-gate audited). */
export const PRESENCE_CSV_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'self', label: 'Self' },
  { id: 'peers', label: 'Peers' },
  { id: 'shot', label: 'On shot' }
]);

export function presenceRosterToCsv({
  peers = [],
  selfEmail = '',
  projectTitle = '',
  roomId = '',
  activeShotId = '',
  filter = 'all'
} = {}) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['Role', 'Email', 'Name', 'ShotId', 'Project', 'Room', 'Filter'];
  const room = String(roomId || '').trim();
  const title = String(projectTitle || '').trim();
  const self = String(selfEmail || '').trim().toLowerCase();
  const shot = String(activeShotId || '').trim();
  const f = String(filter || 'all').toLowerCase();
  const rows = [];

  const includeSelf = f === 'all' || f === 'self' || (f === 'shot' && shot);
  const includePeers = f === 'all' || f === 'peers' || f === 'shot';

  if (includeSelf && self && f !== 'peers') {
    if (f !== 'shot' || shot) {
      rows.push(
        ['self', self, self.split('@')[0] || self, shot || '', title, room || '—', f].map(esc).join(',')
      );
    }
  }

  if (includePeers && f !== 'self') {
    (Array.isArray(peers) ? peers : []).forEach((p) => {
      const email = String(p?.userEmail || p?.email || '').trim().toLowerCase();
      if (!email || email === self) return;
      const peerShot = String(p?.activeShotId || p?.shotId || '').trim();
      if (f === 'shot' && (!shot || peerShot !== shot)) return;
      rows.push(
        [
          'peer',
          email,
          String(p?.userName || p?.name || email.split('@')[0] || '').trim(),
          peerShot,
          title,
          room || '—',
          f
        ]
          .map(esc)
          .join(',')
      );
    });
  }

  const meta = [
    `# Presence roster · ${title || 'Untitled'}${room ? ` · room ${room}` : ''}`,
    `# Rows: ${rows.length}`,
    `# Filter: ${f}`,
    `# Room: ${room || '—'}`,
    `# Active shot: ${shot || '—'}`,
    `# Exported: ${new Date().toISOString()}`
  ].join('\n');
  return `${meta}\n${[headers.map(esc).join(','), ...rows].join('\n')}`;
}

/** Craft Markdown for live presence roster (filter-aware). */
export function presenceRosterToMarkdown({
  peers = [],
  selfEmail = '',
  projectTitle = '',
  roomId = '',
  activeShotId = '',
  filter = 'all'
} = {}) {
  const room = String(roomId || '').trim();
  const title = String(projectTitle || 'Untitled').trim() || 'Untitled';
  const self = String(selfEmail || '').trim().toLowerCase();
  const shot = String(activeShotId || '').trim();
  const f = String(filter || 'all').toLowerCase() || 'all';
  const rows = [];

  const includeSelf = f === 'all' || f === 'self' || (f === 'shot' && shot);
  const includePeers = f === 'all' || f === 'peers' || f === 'shot';

  if (includeSelf && self && f !== 'peers') {
    if (f !== 'shot' || shot) {
      rows.push({
        role: 'self',
        email: self,
        name: self.split('@')[0] || self,
        shotId: shot || '—'
      });
    }
  }

  if (includePeers && f !== 'self') {
    (Array.isArray(peers) ? peers : []).forEach((p) => {
      const email = String(p?.userEmail || p?.email || '').trim().toLowerCase();
      if (!email || email === self) return;
      const peerShot = String(p?.activeShotId || p?.shotId || '').trim();
      if (f === 'shot' && (!shot || peerShot !== shot)) return;
      rows.push({
        role: 'peer',
        email,
        name: String(p?.userName || p?.name || email.split('@')[0] || '').trim() || email,
        shotId: peerShot || '—'
      });
    });
  }

  const lines = [
    `# Presence roster — ${title}${f && f !== 'all' ? ` · ${f}` : ''}`,
    '',
    `- Project: ${title}`,
    `- Room: ${room || '—'}`,
    `- Filter: ${f}`,
    `- Active shot: ${shot || '—'}`,
    `- Rows: ${rows.length}`,
    `- Exported: ${new Date().toISOString()}`,
    '',
    '| Role | Name | Email | Shot |',
    '| --- | --- | --- | --- |'
  ];
  rows.forEach((r) => {
    const role = String(r.role || '').replace(/\|/g, '/');
    const name = String(r.name || '').replace(/\|/g, '/');
    const email = String(r.email || '').replace(/\|/g, '/');
    const shotId = String(r.shotId || '—').replace(/\|/g, '/');
    lines.push(`| ${role} | ${name} | ${email} | ${shotId} |`);
  });
  if (!rows.length) {
    lines.push('| — | — | — | No presence rows for this filter. |');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Export presence roster through the export gate (room + life audit tags).
 * Returns { ok, blocked?, filename? }.
 */

export function exportPresenceRoster({
  peers = [],
  selfEmail = '',
  projectTitle = '',
  roomId = '',
  activeShotId = '',
  shots = [],
  lifecycleMode = 'advisory',
  filter = 'all',
  format = 'csv'
} = {}) {
  const room = resolveCollabRoomId(roomId);
  const f = String(filter || 'all').toLowerCase() || 'all';
  const fmt = String(format || 'csv').toLowerCase() === 'md' || String(format || '').toLowerCase() === 'markdown'
    ? 'md'
    : 'csv';
  const slug = String(projectTitle || 'presence').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const filterTag = f === 'all' ? '' : `_${f}`;
  const roomTag = room ? `_${String(room).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';

  if (fmt === 'md') {
    const md = presenceRosterToMarkdown({
      peers,
      selfEmail,
      projectTitle,
      roomId: room,
      activeShotId,
      filter: f
    });
    const rowCount = Math.max(
      0,
      md.split('\n').filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('Role')).length
    );
    return exportDownloadText(`${slug}_presence${filterTag}${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'collab_presence_md',
      auditFormat: 'md',
      mime: 'text/markdown;charset=utf-8',
      lifecycleMode,
      shots,
      roomId: room,
      note: `${rowCount} rows · filter:${f}${room ? ` · room:${room}` : ''} · presence`
    });
  }

  const csv = presenceRosterToCsv({
    peers,
    selfEmail,
    projectTitle,
    roomId: room,
    activeShotId,
    filter: f
  });
  const rowCount = Math.max(
    0,
    csv.split('\n').filter((line) => line && !line.startsWith('#')).length - 1
  );
  return exportDownloadText(`${slug}_presence${filterTag}${roomTag}.csv`, csv, {
    projectTitle,
    auditLabel: 'collab_presence_csv',
    auditFormat: 'csv',
    mime: 'text/csv;charset=utf-8',
    lifecycleMode,
    shots,
    roomId: room,
    note: `${rowCount} rows · filter:${f}${room ? ` · room:${room}` : ''} · presence`
  });
}

/** ZIP pack: presence CSV + MD + META + README. */
export function buildPresenceZipFiles({
  peers = [],
  selfEmail = '',
  projectTitle = '',
  roomId = '',
  activeShotId = '',
  filter = 'all'
} = {}) {
  const room = resolveCollabRoomId(roomId);
  const title = String(projectTitle || 'Untitled').trim() || 'Untitled';
  const csv = presenceRosterToCsv({
    peers,
    selfEmail,
    projectTitle: title,
    roomId: room,
    activeShotId,
    filter
  });
  const md = presenceRosterToMarkdown({
    peers,
    selfEmail,
    projectTitle: title,
    roomId: room,
    activeShotId,
    filter
  });
  const f = String(filter || 'all').toLowerCase() || 'all';
  const filterTag = f === 'all' ? '' : `_${f}`;
  const peerCount = (Array.isArray(peers) ? peers : []).length;
  const total = peerCount + (selfEmail ? 1 : 0);
  return [
    { name: `presence${filterTag}.csv`, content: csv },
    { name: `presence${filterTag}.md`, content: md },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Live: ${total}`,
        `Peers: ${peerCount}`,
        `Active shot: ${activeShotId || '—'}`,
        `Room: ${room || '—'}`,
        `Filter: ${f}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    },
    {
      name: 'README.md',
      content: [
        `# ${title} — Collab presence pack`,
        '',
        `- Roster: \`presence${filterTag}.csv\``,
        `- Markdown: \`presence${filterTag}.md\``,
        `- Live seats: ${total}`,
        `- Filter: ${f}`,
        room ? `- Collab room: ${room}` : '- Collab room: —',
        '',
        'Snapshot of who was in the room at export time.'
      ].join('\n')
    }
  ];
}

/** Export presence roster as ZIP (CSV + META). */
export async function exportPresenceZipPack({
  peers = [],
  selfEmail = '',
  projectTitle = '',
  roomId = '',
  activeShotId = '',
  shots = [],
  email = '',
  lifecycleMode = EXPORT_LIFECYCLE.STRICT,
  filter = 'all'
} = {}) {
  if (typeof window === 'undefined') return { ok: false, error: 'Not in browser' };

  const actor = String(email || selfEmail || getCurrentUserEmail() || '').trim().toLowerCase();
  if (!canUseSaasFeature('collab', actor)) {
    window.alert('Collab export is not enabled on this plan.');
    return { ok: false, error: 'collab_disabled' };
  }

  const collabRoomId = resolveCollabRoomId(roomId);
  const gate = assertExportAllowed({
    email: actor,
    projectTitle,
    label: 'collab_presence_zip',
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
  const f = String(filter || 'all').toLowerCase() || 'all';
  const filterTag = f === 'all' ? '' : `_${f}`;
  const roomTag = collabRoomId
    ? `_${String(collabRoomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}`
    : '';
  const files = buildPresenceZipFiles({
    peers,
    selfEmail,
    projectTitle,
    roomId: collabRoomId,
    activeShotId,
    filter
  });
  const blob = createZipArchive(files);
  const peerCount = (Array.isArray(peers) ? peers : []).length;
  const total = peerCount + (selfEmail ? 1 : 0);
  const filename = `${slug}_presence${filterTag}${roomTag}_pack.zip`;
  const saved = await saveExportBlob(blob, filename, {
    projectTitle,
    shots,
    lifecycleMode,
    skipLifecycleCheck: true,
    advisoryAlready: Boolean(gate.advisory),
    auditLabel: 'collab_presence_zip',
    auditFormat: 'zip',
    roomId: collabRoomId,
    note: `${total} live · filter:${f} · room:${collabRoomId}`,
    showAlert: false
  });
  if (saved?.blocked) return { ok: false, error: saved.error || gate.message };
  return { ok: true, filename, advisory: Boolean(gate.advisory) };
}

