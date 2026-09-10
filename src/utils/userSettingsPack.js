/**
 * Per-collaborator User Settings Pack.
 * Admin switch: independentPack (inherit vs own settings) + ownLibrary (create/delete pack titles).
 * Pack OFF parks settings — never deletes films. Device paths apply on Electron only.
 */

import {
  normalizeEmail,
  getCurrentUserEmail,
  isStudioOwner,
  projectTitlesMatch,
  getLiveProjectLibrary
} from './projectPermissions';
import { hasNativeStudioFs } from './runtimeEnv';
import { scheduleCollaboratorsCloudSync } from '../services/dbService';
import { getByokKeys, byokStorageKey } from './saasControl';
import { createZipArchive } from './zipUtils';
import { saveExportBlob } from './saveExportFile';
import { EXPORT_LIFECYCLE } from './exportGate';

export const STUDIO_SHARED_PACK_KEY = 'sps_studio_shared_settings_pack';
export const ACTIVE_PACK_EMAIL_KEY = 'sps_active_settings_pack_email';

/** Settings that live in a user pack (string localStorage values). */
export const USER_PACK_SETTING_KEYS = [
  'sps_llm_provider',
  'sps_active_llm_engine',
  'sps_image_gen_engine',
  'sps_google_image_model',
  'sps_use_same_model_image_gen',
  'sps_byteplus_model_id',
  'sps_byteplus_video_model_id',
  'sps_byteplus_endpoint_url',
  'sps_model_engine',
  'sps_include_story_in_prompt',
  'sps_include_characters_in_prompt',
  'sps_include_world_in_prompt',
  'sps_include_dop_in_prompt',
  'sps_include_sound_in_prompt',
  'sps_prompt_format',
  'sps_favorite_craft_keys',
  'sps_show_favorites_only',
  'sps_color_theme',
  'sps_auto_save_interval',
  'sps_active_view',
  'sps_matrix_col_widths',
  'sps_pin_writer_chrome',
  'sps_pin_writer_element_bar',
  'sps_writer_voice_lang',
  'sps_slot_editor_fullscreen',
  'sps_export_lifecycle_mode',
  'sps_app_version_mode',
  'sps_preset_profile',
  'sps_custom_genre_profiles'
];

/** Machine-local; stored in pack but applied only on Electron / native FS. */
export const USER_PACK_DEVICE_KEYS = [
  'sps_allotted_settings_folder',
  'sps_allotted_storage_folder',
  'sps_comfyui_base_url',
  'sps_comfy_ui_base_url',
  'sps_last_open_folder'
];

function allPackKeys() {
  return hasNativeStudioFs()
    ? USER_PACK_SETTING_KEYS.concat(USER_PACK_DEVICE_KEYS)
    : USER_PACK_SETTING_KEYS;
}

function readUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sps_authorized_phone_users', JSON.stringify(users));
  window.dispatchEvent(new CustomEvent('sps_collaborators_updated', { detail: { source: 'userSettingsPack' } }));
  scheduleCollaboratorsCloudSync();
}

export function getUserPackFlags(email = getCurrentUserEmail()) {
  const clean = normalizeEmail(email);
  const users = readUsers();
  const u = users.find((row) => normalizeEmail(row?.email) === clean);
  return {
    independentPack: Boolean(u?.independentPack),
    ownLibrary: Boolean(u?.ownLibrary && u?.independentPack)
  };
}

export function patchUserPackFlags(email, patch = {}) {
  const clean = normalizeEmail(email);
  if (!clean || isStudioOwner(clean)) {
    return { ok: false, error: 'Studio Owner always uses the studio settings pack.' };
  }
  const users = readUsers();
  const idx = users.findIndex((row) => normalizeEmail(row?.email) === clean);
  if (idx < 0) return { ok: false, error: 'User not on the studio list.' };
  const next = { ...users[idx], ...patch };
  if (!next.independentPack) next.ownLibrary = false;
  users[idx] = next;
  writeUsers(users);
  const live = getCurrentUserEmail();
  if (live && normalizeEmail(live) === clean) {
    activatePackForSession(clean, clean);
  }
  return { ok: true, flags: getUserPackFlags(clean) };
}

function snapshotLiveSettings() {
  if (typeof window === 'undefined') return {};
  const keys = allPackKeys();
  const out = {};
  keys.forEach((k) => {
    try {
      const v = localStorage.getItem(k);
      if (v !== null && v !== undefined) out[k] = v;
    } catch {
      /* ignore */
    }
  });
  return out;
}

function applySettingsMap(map) {
  if (typeof window === 'undefined' || !map || typeof map !== 'object') return;
  const keys = allPackKeys();
  keys.forEach((k) => {
    try {
      if (map[k] === null || map[k] === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, String(map[k]));
    } catch {
      /* ignore */
    }
  });
}

function readStudioSnapshot() {
  try {
    const raw = localStorage.getItem(STUDIO_SHARED_PACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeStudioSnapshot(map) {
  try {
    localStorage.setItem(STUDIO_SHARED_PACK_KEY, JSON.stringify(map || {}));
  } catch {
    /* ignore */
  }
}

function persistPackOntoUser(email, settings) {
  const clean = normalizeEmail(email);
  if (!clean) return;
  const users = readUsers();
  const idx = users.findIndex((row) => normalizeEmail(row?.email) === clean);
  if (idx < 0) return;
  users[idx] = {
    ...users[idx],
    packSettings: settings && typeof settings === 'object' ? settings : {},
    packUpdatedAt: new Date().toISOString()
  };
  writeUsers(users);
}

function notifyPackApplied(email) {
  try {
    localStorage.setItem(ACTIVE_PACK_EMAIL_KEY, normalizeEmail(email) || '');
    window.dispatchEvent(new CustomEvent('sps_user_pack_changed', { detail: { email: normalizeEmail(email) } }));
    window.dispatchEvent(new CustomEvent('sps_studio_modules_changed', { detail: { source: 'userPack' } }));
    window.dispatchEvent(new CustomEvent('sps_ui_prefs_synced', {
      detail: { autoSaveIntervalId: localStorage.getItem('sps_auto_save_interval') || '5m' }
    }));
  } catch {
    /* ignore */
  }
}

/**
 * Swap live app settings when the signed-in email changes.
 * Independent pack ON → that user's packSettings. OFF / guest / owner → studio snapshot.
 */
export function activatePackForSession(previousEmail, nextEmail) {
  if (typeof window === 'undefined') return;
  const prev = normalizeEmail(previousEmail);
  const next = normalizeEmail(nextEmail);
  const live = snapshotLiveSettings();

  if (prev && getUserPackFlags(prev).independentPack) {
    persistPackOntoUser(prev, live);
  } else if (!readStudioSnapshot() || (prev && isStudioOwner(prev)) || !prev) {
    writeStudioSnapshot(live);
  }

  if (!next) {
    const studio = readStudioSnapshot() || live;
    applySettingsMap(studio);
    notifyPackApplied('');
    return;
  }

  if (isStudioOwner(next) || !getUserPackFlags(next).independentPack) {
    const studio = readStudioSnapshot() || live;
    applySettingsMap(studio);
    notifyPackApplied(next);
    return;
  }

  if (!readStudioSnapshot()) writeStudioSnapshot(live);
  const users = readUsers();
  const row = users.find((u) => normalizeEmail(u?.email) === next);
  const parked = row?.packSettings && typeof row.packSettings === 'object' ? row.packSettings : null;
  if (parked && Object.keys(parked).length) {
    applySettingsMap(parked);
  } else {
    const seed = readStudioSnapshot() || live;
    applySettingsMap(seed);
    persistPackOntoUser(next, seed);
  }
  notifyPackApplied(next);
}

export function listUserPackSettings() {
  return {
    sharedKeys: USER_PACK_SETTING_KEYS.slice(),
    deviceKeys: USER_PACK_DEVICE_KEYS.slice(),
    flags: ['independentPack', 'ownLibrary']
  };
}

export const USER_PACK_SETTING_LABELS = Object.freeze({
  sps_llm_provider: 'LLM provider',
  sps_active_llm_engine: 'Active LLM engine',
  sps_image_gen_engine: 'Image engine',
  sps_google_image_model: 'Google image model',
  sps_use_same_model_image_gen: 'Same model for image gen',
  sps_byteplus_model_id: 'BytePlus image model',
  sps_byteplus_video_model_id: 'BytePlus video model',
  sps_byteplus_endpoint_url: 'BytePlus endpoint',
  sps_model_engine: 'Model engine',
  sps_include_story_in_prompt: 'Include story in prompt',
  sps_include_characters_in_prompt: 'Include characters',
  sps_include_world_in_prompt: 'Include world',
  sps_include_dop_in_prompt: 'Include DOP',
  sps_include_sound_in_prompt: 'Include sound',
  sps_prompt_format: 'Prompt format',
  sps_favorite_craft_keys: 'Favorite craft keys',
  sps_show_favorites_only: 'Favorites only',
  sps_color_theme: 'Color theme',
  sps_auto_save_interval: 'Auto-save interval',
  sps_active_view: 'Active view',
  sps_matrix_col_widths: 'Matrix column widths',
  sps_pin_writer_chrome: 'Pin Writer chrome',
  sps_pin_writer_element_bar: 'Pin Writer element bar',
  sps_writer_voice_lang: 'Writer voice language',
  sps_slot_editor_fullscreen: 'Slot editor fullscreen',
  sps_export_lifecycle_mode: 'Export lifecycle',
  sps_app_version_mode: 'App version mode',
  sps_preset_profile: 'Genre preset',
  sps_custom_genre_profiles: 'Custom genre profiles',
  sps_allotted_settings_folder: 'Settings folder (this device)',
  sps_allotted_storage_folder: 'Storage folder (this device)',
  sps_comfyui_base_url: 'ComfyUI URL (this device)',
  sps_comfy_ui_base_url: 'ComfyUI URL alt (this device)',
  sps_last_open_folder: 'Last open folder (this device)'
});

function findUserIndex(email) {
  const clean = normalizeEmail(email);
  if (!clean) return { clean, users: [], idx: -1 };
  const users = readUsers();
  const idx = users.findIndex((row) => normalizeEmail(row?.email) === clean);
  return { clean, users, idx };
}

function uniqTitles(list = []) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((t) => {
    const s = String(t || '').trim();
    if (!s || s.toLowerCase().startsWith('all studio projects')) return;
    if (out.some((x) => projectTitlesMatch(x, s))) return;
    out.push(s);
  });
  return out;
}

export function getPackOwnedTitles(email = getCurrentUserEmail()) {
  const { users, idx } = findUserIndex(email);
  if (idx < 0) return [];
  return uniqTitles(users[idx]?.packOwnedTitles);
}

export function isPackOwnedTitle(title, email = getCurrentUserEmail()) {
  const needle = String(title || '').trim();
  if (!needle) return false;
  return getPackOwnedTitles(email).some((t) => projectTitlesMatch(t, needle));
}

/** Owner may archive any title. Pack Own library may archive only titles they created. */
export function canArchiveProjectTitle(title, email = getCurrentUserEmail()) {
  const clean = normalizeEmail(email);
  if (!clean || typeof window === 'undefined') return false;
  if (isStudioOwner(clean)) return true;
  if (!getUserPackFlags(clean).ownLibrary) return false;
  return isPackOwnedTitle(title, clean);
}

export function canRenameProjectTitle(title, email = getCurrentUserEmail()) {
  return canArchiveProjectTitle(title, email);
}

export function packLibraryRestrictedMessage(action = 'create or import projects') {
  return `Only the studio Admin, or an Editor with Independent settings pack + Own library, can ${action}. Pack users may archive only titles they created — allotted studio films stay Admin-owned.`;
}

function writeUserRow(email, patchFn) {
  const { clean, users, idx } = findUserIndex(email);
  if (!clean || idx < 0) return false;
  users[idx] = patchFn({ ...users[idx] });
  writeUsers(users);
  return true;
}

/** Mark a newly minted title as this pack user's. Also allots it so it stays visible if pack is later turned off. */
export function rememberPackOwnedTitle(email, title) {
  const clean = normalizeEmail(email);
  const name = String(title || '').trim();
  if (!clean || !name || isStudioOwner(clean)) return false;
  return writeUserRow(clean, (row) => {
    const packOwnedTitles = uniqTitles([...(row.packOwnedTitles || []), name]);
    const allottedProjects = uniqTitles([...(row.allottedProjects || []), name]);
    return { ...row, packOwnedTitles, allottedProjects };
  });
}

export function claimNewLibraryTitleIfPackUser(title, email = getCurrentUserEmail()) {
  const clean = normalizeEmail(email);
  if (!title || !clean || isStudioOwner(clean)) return false;
  if (!getUserPackFlags(clean).ownLibrary) return false;
  return rememberPackOwnedTitle(clean, title);
}

export function renamePackOwnedTitle(email, oldTitle, newTitle) {
  const from = String(oldTitle || '').trim();
  const to = String(newTitle || '').trim();
  if (!from || !to || projectTitlesMatch(from, to)) return false;
  return writeUserRow(email, (row) => {
    const swap = (list) => {
      const next = uniqTitles(list).map((t) => (projectTitlesMatch(t, from) ? to : t));
      return uniqTitles(next);
    };
    return {
      ...row,
      packOwnedTitles: swap(row.packOwnedTitles),
      allottedProjects: (row.allottedProjects || []).map((t) => {
        const s = String(t || '').trim();
        if (s.toLowerCase().startsWith('all studio projects')) return s;
        return projectTitlesMatch(s, from) ? to : s;
      })
    };
  });
}

export function renameTitleAcrossPackOwned(oldTitle, newTitle) {
  const from = String(oldTitle || '').trim();
  const to = String(newTitle || '').trim();
  if (!from || !to || projectTitlesMatch(from, to)) return false;
  const users = readUsers();
  let changed = false;
  const next = users.map((row) => {
    if (!row) return row;
    const packOwnedTitles = uniqTitles(row.packOwnedTitles || []).map((t) => (projectTitlesMatch(t, from) ? to : t));
    const allottedProjects = (row.allottedProjects || []).map((t) => {
      const s = String(t || '').trim();
      if (s.toLowerCase().startsWith('all studio projects')) return s;
      return projectTitlesMatch(s, from) ? to : s;
    });
    const packSame =
      packOwnedTitles.length === uniqTitles(row.packOwnedTitles || []).length &&
      packOwnedTitles.every((t, i) => t === uniqTitles(row.packOwnedTitles || [])[i]);
    const allotSame =
      allottedProjects.length === (row.allottedProjects || []).length &&
      allottedProjects.every((t, i) => t === (row.allottedProjects || [])[i]);
    if (packSame && allotSame) return row;
    changed = true;
    return { ...row, packOwnedTitles: uniqTitles(packOwnedTitles), allottedProjects };
  });
  if (changed) writeUsers(next);
  return changed;
}

export function stripTitleFromPackOwned(users, deletedTitle) {
  const list = Array.isArray(users) ? users : [];
  const gone = String(deletedTitle || '').trim();
  if (!gone) return list;
  return list.map((u) => {
    if (!u || !Array.isArray(u.packOwnedTitles)) return u;
    const next = u.packOwnedTitles.filter((t) => !projectTitlesMatch(t, gone));
    if (next.length === u.packOwnedTitles.length) return u;
    return { ...u, packOwnedTitles: next };
  });
}

/** Write live localStorage into the signed-in user's parked pack (independent pack ON only). */
export function persistLivePackIfActive(email = getCurrentUserEmail()) {
  if (typeof window === 'undefined') return false;
  const clean = normalizeEmail(email);
  if (!clean || isStudioOwner(clean)) return false;
  if (!getUserPackFlags(clean).independentPack) return false;
  persistPackOntoUser(clean, snapshotLiveSettings());
  return true;
}

function slimProjectForPackExport(proj) {
  if (!proj || typeof proj !== 'object') return proj;
  const copy = { ...proj };
  delete copy.posterDataUrl;
  return copy;
}

export function describeUserPack(email = getCurrentUserEmail()) {
  const clean = normalizeEmail(email);
  const flags = getUserPackFlags(clean);
  const owned = getPackOwnedTitles(clean);
  const { users, idx } = findUserIndex(clean);
  const row = idx >= 0 ? users[idx] : null;
  const parked = row?.packSettings && typeof row.packSettings === 'object' ? row.packSettings : {};
  const live = flags.independentPack ? snapshotLiveSettings() : parked;
  const keys = allPackKeys();
  const settings = keys.map((key) => ({
    key,
    label: USER_PACK_SETTING_LABELS[key] || key,
    device: USER_PACK_DEVICE_KEYS.includes(key),
    set: live[key] !== undefined && live[key] !== null && String(live[key]).length > 0,
    preview: String(live[key] ?? '').slice(0, 80)
  }));
  return {
    email: clean,
    independentPack: flags.independentPack,
    ownLibrary: flags.ownLibrary,
    packOwnedTitles: owned,
    packUpdatedAt: row?.packUpdatedAt || '',
    settings,
    byokProviders: Object.keys(getByokKeys(clean) || {}).filter((k) => String((getByokKeys(clean) || {})[k] || '').trim())
  };
}

function packSettingsForExport(email) {
  const clean = normalizeEmail(email);
  if (getUserPackFlags(clean).independentPack) {
    persistPackOntoUser(clean, snapshotLiveSettings());
  }
  const { users, idx } = findUserIndex(clean);
  const row = idx >= 0 ? users[idx] : null;
  return row?.packSettings && typeof row.packSettings === 'object' ? row.packSettings : {};
}

export function buildUserPackExportFiles(email = getCurrentUserEmail()) {
  const clean = normalizeEmail(email);
  const flags = getUserPackFlags(clean);
  const owned = getPackOwnedTitles(clean);
  const library = getLiveProjectLibrary();
  const packProjects = library.filter((p) => owned.some((t) => projectTitlesMatch(t, p?.title)));
  const byok = getByokKeys(clean) || {};
  const packJson = {
    appName: 'STAGE WORK STUDIO',
    kind: 'user_settings_pack',
    exportVersion: '1.0',
    email: clean,
    exportedAt: new Date().toISOString(),
    independentPack: flags.independentPack,
    ownLibrary: flags.ownLibrary,
    packOwnedTitles: owned,
    packSettings: packSettingsForExport(clean),
    byokKeys: byok,
    note: 'BYOK keys stay in this file on your disk. They are not sent to the studio backend.'
  };
  const files = [
    {
      name: 'README.txt',
      content: [
        'Stage Work Studio — User Settings Pack',
        `Email: ${clean}`,
        `Exported: ${packJson.exportedAt}`,
        '',
        'This ZIP is your copy of engines/theme (pack settings), your BYOK keys, and films you created in Own library.',
        'Studio films allotted to you stay with Admin and are not included.',
        'Closing the account removes your login. It does not delete studio titles.'
      ].join('\n')
    },
    { name: 'pack.json', content: JSON.stringify(packJson, null, 2) }
  ];
  packProjects.forEach((proj) => {
    const stem = String(proj.title || 'project').replace(/[^\w.\-]+/g, '_').slice(0, 60) || 'project';
    files.push({
      name: `projects/${stem}.json`,
      content: JSON.stringify(slimProjectForPackExport(proj), null, 2)
    });
  });
  return { files, packProjects, owned, email: clean };
}

function removeCollaboratorRecord(email) {
  const clean = normalizeEmail(email);
  if (!clean || isStudioOwner(clean)) return { ok: false, error: 'Studio Owner cannot close this way.' };
  const users = readUsers().filter((row) => normalizeEmail(row?.email) !== clean);
  writeUsers(users);
  try {
    localStorage.removeItem(byokStorageKey(clean));
  } catch {
    /* ignore */
  }
  return { ok: true };
}

/**
 * Save pack ZIP (settings + pack-owned films + BYOK on disk only), then remove login.
 * Studio library titles are not deleted.
 */
export async function exportUserPackAndCloseAccount(email = getCurrentUserEmail()) {
  const clean = normalizeEmail(email);
  if (!clean) return { ok: false, error: 'No signed-in email.' };
  if (isStudioOwner(clean)) return { ok: false, error: 'Studio Owner keeps the studio pack and cannot close it here.' };
  persistLivePackIfActive(clean);
  const built = buildUserPackExportFiles(clean);
  const blob = createZipArchive(built.files);
  const day = new Date().toISOString().slice(0, 10);
  const stem = String(clean).replace(/[^\w.\-]+/g, '_').slice(0, 40) || 'user';
  const saved = await saveExportBlob(blob, `${stem}_UserSettingsPack_${day}.zip`, {
    projectTitle: built.owned[0] || '',
    shots: [],
    lifecycleMode: EXPORT_LIFECYCLE.NONE,
    skipLifecycleCheck: true,
    personalTakeout: true,
    auditLabel: 'user_pack_takeout',
    auditFormat: 'zip',
    note: 'user settings pack close',
    showAlert: false
  });
  if (saved?.canceled) return { ok: false, canceled: true };
  if (!saved?.success) return { ok: false, error: saved?.error || 'Could not save the pack ZIP.' };
  const removed = removeCollaboratorRecord(clean);
  if (!removed.ok) return removed;
  return {
    ok: true,
    closed: true,
    email: clean,
    projectCount: built.packProjects.length,
    filePath: saved.filePath || ''
  };
}
