/**
 * Screenplay interchange: Fountain + Final Draft FDX (+ TXT).
 */
import { normalizeToFountain, classifyScreenplayLines } from './screenplayFormat.js';

const VERSIONS_KEY = 'sps_screenplay_versions';
const ARCHIVE_KEY = 'sps_screenplay_archive';
const MAX_VERSIONS = 25;
const MAX_ARCHIVED_SCRIPTS = 50;

/** Industry revision colors / studio milestones writers actually use. */
export const SCREENPLAY_MILESTONE_PRESETS = [
  'White Draft',
  'Blue Draft',
  'Pink Draft',
  'Yellow Draft',
  'Green Draft',
  'Goldenrod Draft',
  'Buff Draft',
  'Salmon Draft',
  'Cherry Draft',
  'Studio Lock',
  'Pre-Matrix Sync',
  'AI Rewrite Backup',
  'Co-Write Checkpoint'
];

export function downloadTextFile(filename, contents, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportFountain(scriptText, meta = {}) {
  const title = meta.title || 'Untitled Screenplay';
  const body = normalizeToFountain(scriptText);
  const room = String(meta.roomId || '').trim();
  const header = [
    `Title: ${title}`,
    meta.author ? `Author: ${meta.author}` : null,
    meta.draft ? `Draft date: ${meta.draft}` : `Draft date: ${new Date().toISOString().slice(0, 10)}`,
    room ? `Room: ${room}` : null,
    `Contact: Stage Work Studio — AI Cinema Production OS`,
    '',
    ''
  ]
    .filter((x) => x !== null)
    .join('\n');
  return `${header}${body}`;
}

export function exportPlainTxt(scriptText) {
  return normalizeToFountain(scriptText);
}

/**
 * Minimal Final Draft FDX 1.0 export (Paragraph Type attributes).
 */
export function exportFdx(scriptText, meta = {}) {
  const title = escapeXml(meta.title || 'Untitled Screenplay');
  const lines = classifyScreenplayLines(scriptText);
  const paragraphs = lines
    .map(({ text, type }) => {
      const fdxType = toFdxType(type);
      const content = escapeXml(String(text || ''));
      return `    <Paragraph Type="${fdxType}"><Text>${content}</Text></Paragraph>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
${paragraphs}
  </Content>
  <TitlePage>
    <Content>
      <Paragraph Type="Title"><Text>${title}</Text></Paragraph>
      <Paragraph Type="Center"><Text>Stage Work Studio — AI Cinema Production OS</Text></Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>
`;
}

/**
 * Writer merge pack ZIP — Fountain + TXT + FDX + META for overwrite/merge handoff.
 */
export function buildWriterMergeZipFiles(
  scriptText = '',
  {
    projectTitle = 'screenplay',
    roomId = '',
    liveShotCount = 0,
    mergeMode = 'pack'
  } = {}
) {
  const title = String(projectTitle || 'screenplay').trim() || 'screenplay';
  const stem = title.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'screenplay';
  const fountain = exportFountain(scriptText, { title, roomId });
  const txt = exportPlainTxt(scriptText);
  const fdx = exportFdx(scriptText, { title });
  const lines = String(scriptText || '').split('\n').length;
  return [
    { name: `${stem}.fountain`, content: fountain },
    { name: `${stem}.txt`, content: txt },
    { name: `${stem}.fdx`, content: fdx },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Mode: ${mergeMode}`,
        `Lines: ${lines}`,
        `Live matrix shots: ${liveShotCount}`,
        `Room: ${roomId || '—'}`,
        `Exported: ${new Date().toISOString()}`,
        '',
        'Use Fountain/TXT/FDX for Writer re-import or merge apply review.'
      ].join('\n')
    },
    {
      name: 'README.md',
      content: [
        `# ${title} — Writer merge pack`,
        '',
        `- Fountain: \`${stem}.fountain\``,
        `- Plain text: \`${stem}.txt\``,
        `- Final Draft: \`${stem}.fdx\``,
        `- Live Matrix shots at export: ${liveShotCount}`,
        roomId ? `- Collab room: ${roomId}` : '- Collab room: —',
        '',
        'Re-import into Writer, then choose overwrite or merge when applying to Matrix.'
      ].join('\n')
    }
  ];
}

function toFdxType(type) {
  switch (type) {
    case 'scene_heading':
      return 'Scene Heading';
    case 'action':
      return 'Action';
    case 'character':
      return 'Character';
    case 'parenthetical':
      return 'Parenthetical';
    case 'dialogue':
      return 'Dialogue';
    case 'transition':
      return 'Transition';
    case 'shot':
      return 'Shot';
    case 'note':
      return 'Action';
    default:
      return 'Action';
  }
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Parse Final Draft .fdx XML into plain screenplay text.
 * Handles Paragraph Type + Text nodes; strips unknown markup.
 */
export function importFdx(xmlText) {
  const raw = String(xmlText || '');
  if (!raw.includes('<FinalDraft') && !raw.includes('<Paragraph')) {
    // Not FDX — return as plain text cleanup
    return normalizeToFountain(raw);
  }

  const paragraphs = [];
  const paraRe = /<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi;
  let match;
  while ((match = paraRe.exec(raw)) !== null) {
    const attrs = match[1] || '';
    const inner = match[2] || '';
    const typeMatch = attrs.match(/\bType="([^"]+)"/i);
    const type = (typeMatch?.[1] || 'Action').toLowerCase();
    const textBits = [];
    const textRe = /<Text\b[^>]*>([\s\S]*?)<\/Text>/gi;
    let tm;
    while ((tm = textRe.exec(inner)) !== null) {
      textBits.push(decodeXml(tm[1].replace(/<[^>]+>/g, '')));
    }
    if (!textBits.length) {
      const stripped = decodeXml(inner.replace(/<[^>]+>/g, '')).trim();
      if (stripped) textBits.push(stripped);
    }
    const line = textBits.join('').trimEnd();
    if (!line && type.includes('general')) continue;

    if (type.includes('scene')) paragraphs.push(line.toUpperCase());
    else if (type.includes('character')) paragraphs.push(line.toUpperCase());
    else if (type.includes('parenthetical')) {
      paragraphs.push(line.startsWith('(') ? line : `(${line})`);
    } else if (type.includes('transition')) {
      paragraphs.push(line.toUpperCase());
    } else if (type.includes('shot')) {
      paragraphs.push(line);
    } else {
      paragraphs.push(line);
    }
  }

  if (!paragraphs.length) {
    // Fallback: strip tags
    return normalizeToFountain(decodeXml(raw.replace(/<[^>]+>/g, '\n')));
  }
  return normalizeToFountain(paragraphs.join('\n'));
}

export function importFountainOrTxt(text) {
  return normalizeToFountain(text);
}

/**
 * Detect + import by filename / mime / content.
 */
export async function importScreenplayFile(file, { extractPdf } = {}) {
  if (!file) throw new Error('No file');
  const name = String(file.name || '').toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isFdx = name.endsWith('.fdx') || name.endsWith('.xml');
  const isFountain = name.endsWith('.fountain') || name.endsWith('.spmd');

  if (isPdf) {
    if (typeof extractPdf !== 'function') {
      throw new Error('PDF extract unavailable');
    }
    const text = await extractPdf(file);
    return { text: importFountainOrTxt(text), format: 'pdf' };
  }

  const raw = await file.text();
  if (isFdx || raw.includes('<FinalDraft')) {
    return { text: importFdx(raw), format: 'fdx' };
  }
  if (isFountain) {
    return { text: importFountainOrTxt(raw), format: 'fountain' };
  }
  return { text: importFountainOrTxt(raw), format: 'txt' };
}

export function loadScreenplayVersions() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VERSIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function saveScreenplayVersion(entry) {
  if (typeof window === 'undefined') return [];
  const list = loadScreenplayVersions();
  const next = [
    {
      id: `draft_${Date.now()}`,
      name: entry?.name || `Draft ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      text: String(entry?.text || ''),
      projectTitle: entry?.projectTitle || ''
    },
    ...list
  ].slice(0, MAX_VERSIONS);
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(next));
  return next;
}

export function deleteScreenplayVersion(id) {
  const next = loadScreenplayVersions().filter((v) => v.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(next));
  }
  return next;
}

export function loadScreenplayArchive(projectTitle = null) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const all = Array.isArray(list) ? list : [];
    if (!projectTitle) return all;
    const key = String(projectTitle).trim().toUpperCase();
    return all.filter((a) => {
      const t = String(a?.projectTitle || '').trim().toUpperCase();
      return !t || t === key;
    });
  } catch (e) {
    return [];
  }
}

function writeArchive(list) {
  if (typeof window === 'undefined') return list;
  const next = (Array.isArray(list) ? list : []).slice(0, MAX_ARCHIVED_SCRIPTS);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  try {
    window.dispatchEvent(new Event('sps_screenplay_archive_updated'));
  } catch (e) {}
  return next;
}

/**
 * Archive a named milestone (long-lived). Unlike quick drafts, these are kept
 * for production revision history (Pink / Blue / Studio Lock, etc.).
 */
export function archiveScreenplayMilestone(entry) {
  if (typeof window === 'undefined') return [];
  const name = String(entry?.name || '').trim() || `Archive ${new Date().toLocaleString()}`;
  const text = String(entry?.text || '');
  if (!text.trim()) return loadScreenplayArchive();

  const item = {
    id: `arch_script_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    label: name,
    createdAt: new Date().toISOString(),
    archivedAt: new Date().toISOString(),
    archivedAtLabel: new Date().toLocaleString(),
    text,
    projectTitle: entry?.projectTitle || '',
    pageEstimate: entry?.pageEstimate || null,
    wordCount: entry?.wordCount || (text.match(/\b\w+\b/g) || []).length,
    note: String(entry?.note || '').slice(0, 240),
    source: entry?.source || 'manual' // manual | promoted_version
  };

  const prev = loadScreenplayArchive();
  return writeArchive([item, ...prev]);
}

/** Promote a quick draft version into long-term Script Archive. */
export function promoteVersionToArchive(version, { name, projectTitle, note } = {}) {
  if (!version?.text) return loadScreenplayArchive();
  return archiveScreenplayMilestone({
    name: name || version.name || 'Promoted Draft',
    text: version.text,
    projectTitle: projectTitle || version.projectTitle || '',
    note: note || `Promoted from Versions · ${version.name || version.id}`,
    source: 'promoted_version'
  });
}

export function restoreScreenplayArchiveEntry(id) {
  const all = loadScreenplayArchive();
  return all.find((a) => a.id === id) || null;
}

export function renameScreenplayArchiveEntry(id, name) {
  const clean = String(name || '').trim();
  if (!clean) return loadScreenplayArchive();
  const next = loadScreenplayArchive().map((a) =>
    a.id === id ? { ...a, name: clean, label: clean } : a
  );
  return writeArchive(next);
}

export function purgeScreenplayArchiveEntry(id) {
  return writeArchive(loadScreenplayArchive().filter((a) => a.id !== id));
}

export function persistLiveScreenplay(text) {
  if (typeof window === 'undefined') return;
  try {
    const email = String(localStorage.getItem('sps_authorized_user_email') || '').trim();
    if (!email) {
      sessionStorage.setItem('sps_guest_play_screenplay', text);
      return;
    }
  } catch {
    /* ignore */
  }
  writeOpenScreenplayText(text, { silent: true });
}

/** P103 — Canonical open-screenplay SoT (legacy live/current are write-through mirrors). */
export const OPEN_SCREENPLAY_SOT_KEY = 'sps_open_screenplay_text';
export const LEGACY_LIVE_SCREENPLAY_KEY = 'sps_live_screenplay_text';
export const LEGACY_CURRENT_SCREENPLAY_KEY = 'sps_current_screenplay_text';

function readLegacyScreenplayPair() {
  try {
    const live = String(localStorage.getItem(LEGACY_LIVE_SCREENPLAY_KEY) || '');
    const current = String(localStorage.getItem(LEGACY_CURRENT_SCREENPLAY_KEY) || '');
    if (live && current && live !== current) {
      return live.length >= current.length ? live : current;
    }
    return live || current || '';
  } catch {
    return '';
  }
}

/** Prefer SoT key; migrate from live/current once if needed. */
export function readOpenScreenplayText() {
  if (typeof window === 'undefined') return '';
  try {
    const sot = String(localStorage.getItem(OPEN_SCREENPLAY_SOT_KEY) || '');
    if (sot) return sot;
    const legacy = readLegacyScreenplayPair();
    if (legacy) {
      writeOpenScreenplayText(legacy, { silent: true });
      return legacy;
    }
    return '';
  } catch {
    return '';
  }
}

/** Write SoT + keep legacy mirrors in sync for older readers. */
export function writeOpenScreenplayText(text, { silent = false } = {}) {
  if (typeof window === 'undefined') return;
  const payload = String(text || '');
  try {
    localStorage.setItem(OPEN_SCREENPLAY_SOT_KEY, payload);
    localStorage.setItem(LEGACY_LIVE_SCREENPLAY_KEY, payload);
    localStorage.setItem(LEGACY_CURRENT_SCREENPLAY_KEY, payload);
    if (!silent) {
      window.dispatchEvent(
        new CustomEvent('sps_screenplay_updated', { detail: { source: 'open_screenplay_write' } })
      );
    }
  } catch {
    /* ignore */
  }
}

/** Migrate dual keys → SoT; safe on every boot. */
export function syncOpenScreenplayStores() {
  return readOpenScreenplayText();
}

/** True when SoT exists (or was just migrated). */
export function migrateOpenScreenplayToSoT() {
  if (typeof window === 'undefined') return { ok: false, migrated: false };
  try {
    const before = String(localStorage.getItem(OPEN_SCREENPLAY_SOT_KEY) || '');
    const text = readOpenScreenplayText();
    return { ok: true, migrated: !before && Boolean(text), length: text.length };
  } catch {
    return { ok: false, migrated: false };
  }
}
