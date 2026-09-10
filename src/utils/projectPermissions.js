/**
 * Studio project access permissions.
 *
 * Access levels (single-select):
 * - Owner  → create / delete / duplicate / import + full library
 * - Editor → edit allotted projects; with Independent pack + Own library may create/delete pack titles only
 * - Viewer → read-only allotted projects (no create/delete)
 *
 * Job-title designations (Lead Director, DOP, etc.) never grant create/delete by themselves.
 * Legacy roles Admin / "Director & Owner" map to Owner.
 */

import { canUseSaasConsole } from './saasControl';
import { getStudioShell } from './runtimeEnv';
import { projectLibraryStorageKey } from './tenantScope';

export const DEFAULT_ADMIN_EMAIL = 'admin@stageworkstudio.com';
export const PRIMARY_ADMIN_EMAILS = [
  'admin@stageworkstudio.com',
  'pedditiram@gmail.com'
];

/** Job-title designations only — never imply create/delete rights */
export const STUDIO_DESIGNATIONS = [
  'Lead Director',
  'Writer',
  'Executive Producer',
  'DOP / Cinematographer',
  'Lighting Specialist',
  'Sound Engineer',
  'Lead Editor',
  'Co-Artist & Performer',
  'Production Assistant',
];

/** Room each job title opens on login */
export const DESIGNATION_HOME = {
  'Lead Director': { view: 'spreadsheet' },
  Writer: { view: 'screenplay' },
  'Executive Producer': { view: 'spreadsheet' },
  'DOP / Cinematographer': { view: 'form' },
  'Lighting Specialist': { view: 'form' },
  'Sound Engineer': { view: 'form' },
  'Lead Editor': { view: 'spreadsheet' },
  'Co-Artist & Performer': { view: 'spreadsheet', modal: 'cast' },
  'Production Assistant': { view: 'spreadsheet' },
};

export function getHomeForDesignation(designation) {
  const key = String(designation || '').trim();
  return DESIGNATION_HOME[key] || { view: 'spreadsheet' };
}

export function getDesignationForEmail(email = getCurrentUserEmail()) {
  const clean = normalizeEmail(email);
  if (!clean || typeof window === 'undefined') return '';
  if (PRIMARY_ADMIN_EMAILS.includes(clean)) return 'Lead Director';
  try {
    const users = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
    const hit = (Array.isArray(users) ? users : []).find(
      (u) => normalizeEmail(u?.email) === clean
    );
    return String(hit?.designation || '').trim();
  } catch {
    return '';
  }
}

/** Studio access levels (single-select) */
export const ACCESS_LEVELS = ['Viewer', 'Editor', 'Owner'];

export function getCurrentUserEmail() {
  if (typeof window === 'undefined') return '';
  return normalizeEmail(localStorage.getItem('sps_authorized_user_email') || '');
}

/** Fix common typos so owner session / presence don't fork (e.g. gmai.com). */
export function normalizeEmail(email) {
  let clean = String(email || '').trim().toLowerCase();
  if (!clean) return '';
  clean = clean
    .replace(/@gmai\.com$/i, '@gmail.com')
    .replace(/@gmial\.com$/i, '@gmail.com')
    .replace(/@gmail\.co$/i, '@gmail.com')
    .replace(/@gmal\.com$/i, '@gmail.com');
  return clean;
}

/**
 * Unauthenticated session — no studio library writes, editing, admin, or allotments.
 * Public guest look is removed; visitors sign in or create an account.
 */
export function isGuestSession(email = getCurrentUserEmail()) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return true;
  if (
    clean === 'guest' ||
    clean === 'guest / unauthenticated' ||
    clean === 'click to login' ||
    clean === 'unauthenticated'
  ) {
    return true;
  }
  return false;
}

/** Packaged Electron / file:// download — not localhost Vite in a browser. */
export function isDownloadedStudioApp() {
  if (typeof window === 'undefined') return false;
  try {
    if (getStudioShell() === 'electron') return true;
    if (window.location.protocol === 'file:') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Admin allotted / Owner session — may leave presentation and work. */
export function hasAdminGrantedWorkspace(email = getCurrentUserEmail()) {
  if (isGuestSession(email)) return false;
  if (isStudioOwner(email)) return true;
  const profile = getCurrentUserProfile(email);
  if (!profile) return false;
  if (String(profile.status || '').toLowerCase() === 'suspended') return false;
  return true;
}

/** Downloaded app with no Admin grant: reel only, no editing. */
export function downloadedAppPresentationOnly(email = getCurrentUserEmail()) {
  return isDownloadedStudioApp() && !hasAdminGrantedWorkspace(email);
}

export const STUDIO_MODULE_KEYS = {
  writer: 'sps_writer_console_enabled',
  matrix: 'sps_matrix_console_enabled',
  form: 'sps_form_console_enabled',
  stage: 'sps_enable_canvas_tab',
  cast: 'sps_cast_console_enabled',
  world: 'sps_world_console_enabled',
  compile: 'sps_compile_console_enabled',
  generate: 'sps_generate_console_enabled',
  budget: 'sps_budget_console_enabled',
  promo: 'sps_promo_console_enabled',
  campaign: 'sps_campaign_console_enabled',
  storyboard: 'sps_storyboard_console_enabled',
  pitch: 'sps_pitch_console_enabled',
  reel: 'sps_reel_console_enabled'
};

export const BUDGET_CONSOLE_KEY = STUDIO_MODULE_KEYS.budget;

export const CONSOLE_SWITCH_IDS = Object.keys(STUDIO_MODULE_KEYS);
export const CONSOLE_SWITCH_LABELS = {
  writer: 'Writer',
  matrix: 'Matrix',
  form: 'Form',
  stage: '3D Stage',
  cast: 'Characters',
  world: 'World',
  promo: 'Promo',
  campaign: 'Campaign',
  storyboard: 'Storyboard',
  pitch: 'Pitch',
  budget: 'Budget',
  reel: 'Reel',
  compile: 'Compile',
  generate: 'Generate',
};
const PRESENTATION_MODE_KEY = 'sps_presentation_mode';

function readStudioDefaultModule(id) {
  const key = STUDIO_MODULE_KEYS[id];
  if (!key || typeof window === 'undefined') return id !== 'stage';
  try {
    const v = localStorage.getItem(key);
    if (id === 'stage') {
      if (v == null || v === '') return false;
      return v === 'true';
    }
    return v !== 'false';
  } catch {
    return id !== 'stage';
  }
}

export function getStudioDefaultConsoleMap() {
  return Object.fromEntries(CONSOLE_SWITCH_IDS.map((id) => [id, readStudioDefaultModule(id)]));
}

export function getUserConsoleMap(email = getCurrentUserEmail()) {
  const profile = getCurrentUserProfile(email);
  const custom = profile?.enabledConsoles;
  const defaults = getStudioDefaultConsoleMap();
  if (!custom || typeof custom !== 'object') return defaults;
  const map = { ...defaults };
  CONSOLE_SWITCH_IDS.forEach((id) => {
    if (typeof custom[id] === 'boolean') map[id] = custom[id];
  });
  return map;
}

export function areAllConsolesOff(email = getCurrentUserEmail()) {
  if (isPresentationMode()) return true;
  return CONSOLE_SWITCH_IDS.every((id) => !isStudioModuleEnabled(id, email));
}

export function isPresentationMode() {
  if (typeof window === 'undefined') return true;
  try {
    const raw = sessionStorage.getItem(PRESENTATION_MODE_KEY);
    if (raw === null) {
      // Default to presentation mode on every launch in browser and local app
      return true;
    }
    return raw === 'true';
  } catch {
    return true;
  }
}

export function setPresentationMode(on) {
  if (typeof window === 'undefined') return Boolean(on);
  const lockPresentation = !on && downloadedAppPresentationOnly();
  const next = lockPresentation ? true : Boolean(on);
  try {
    sessionStorage.setItem(PRESENTATION_MODE_KEY, next ? 'true' : 'false');
    localStorage.setItem(PRESENTATION_MODE_KEY, next ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('sps_studio_modules_changed', { detail: { presentation: next } }));
    window.dispatchEvent(new CustomEvent('sps_budget_console_changed', { detail: { presentation: next } }));
  } catch {
    /* ignore */
  }
  return next;
}

/** Real login must leave the presentation reel. */
export function exitPresentationForWorkspace() {
  setPresentationMode(false);
}

export function isStudioModuleEnabled(id, email = getCurrentUserEmail()) {
  if (isPresentationMode()) return false;
  if (email && !canUseSaasConsole(id, email)) return false;
  if (isGuestSession(email)) return readStudioDefaultModule(id);
  const map = getUserConsoleMap(email);
  if (typeof map[id] === 'boolean') return map[id];
  return readStudioDefaultModule(id);
}

let applyingCloudStudioSettings = false;

function scheduleCloudSettingsPush() {
  if (applyingCloudStudioSettings || typeof window === 'undefined') return;
  import('../services/dbService')
    .then((m) => {
      if (typeof m.scheduleStudioSettingsSync === 'function') m.scheduleStudioSettingsSync();
    })
    .catch(() => {});
}

function scheduleCollaboratorsPush() {
  if (applyingCloudStudioSettings || typeof window === 'undefined') return;
  import('../services/dbService')
    .then((m) => {
      if (typeof m.scheduleCollaboratorsCloudSync === 'function') m.scheduleCollaboratorsCloudSync();
    })
    .catch(() => {});
}

export function collectStudioSettings() {
  return {
    studioModules: getStudioDefaultConsoleMap(),
    updatedAt: new Date().toISOString()
  };
}

/** Apply Owner console defaults from cloud. Does not rewrite API keys or the signed-in session. */
export function applyStudioSettings(settings, { notify = true } = {}) {
  if (!settings || typeof settings !== 'object' || typeof window === 'undefined') return false;
  const mods = settings.studioModules && typeof settings.studioModules === 'object'
    ? settings.studioModules
    : {};
  const hasMods = Object.keys(mods).length > 0;
  if (!hasMods) return false;
  applyingCloudStudioSettings = true;
  try {
    Object.entries(mods).forEach(([id, on]) => {
      if (typeof on === 'boolean') setStudioModuleEnabled(id, on, { silent: true });
    });
    if (notify) {
      window.dispatchEvent(new CustomEvent('sps_studio_modules_changed', { detail: { source: 'cloud' } }));
    }
  } finally {
    applyingCloudStudioSettings = false;
  }
  return true;
}

export function setStudioModuleEnabled(id, on, { silent = false } = {}) {
  const key = STUDIO_MODULE_KEYS[id];
  if (!key || typeof window === 'undefined') return false;
  const next = Boolean(on);
  try {
    localStorage.setItem(key, next ? 'true' : 'false');
    if (!silent) {
      window.dispatchEvent(new CustomEvent('sps_studio_modules_changed', { detail: { id, enabled: next } }));
      if (id === 'budget') {
        window.dispatchEvent(new CustomEvent('sps_budget_console_changed', { detail: { enabled: next } }));
      }
      scheduleCloudSettingsPush();
    }
  } catch {
    /* ignore */
  }
  return next;
}

export function setUserConsoleEnabled(email, id, on) {
  if (typeof window === 'undefined' || !STUDIO_MODULE_KEYS[id]) return false;
  const clean = normalizeEmail(email);
  if (!clean) return false;
  const nextVal = Boolean(on);
  try {
    const users = getAuthorizedUsers();
    const nextUsers = users.map((u) => {
      if (normalizeEmail(u?.email) !== clean) return u;
      const map = getUserConsoleMap(clean);
      map[id] = nextVal;
      const patch = { ...u, enabledConsoles: map };
      if (id === 'budget') patch.budgetAccess = nextVal;
      return patch;
    });
    localStorage.setItem('sps_authorized_phone_users', JSON.stringify(nextUsers));
    window.dispatchEvent(new Event('sps_collaborators_updated'));
    window.dispatchEvent(new CustomEvent('sps_studio_modules_changed', { detail: { id, enabled: nextVal, email: clean } }));
    if (id === 'budget') {
      window.dispatchEvent(new CustomEvent('sps_budget_console_changed', { detail: { enabled: nextVal, email: clean } }));
    }
    scheduleCollaboratorsPush();
  } catch {
    /* ignore */
  }
  return nextVal;
}

/** Master switch — default ON so Owner sees Budget next to Promo Pack. */
export function isBudgetConsoleEnabled() {
  return isStudioModuleEnabled('budget');
}

export function setBudgetConsoleEnabled(on) {
  return setStudioModuleEnabled('budget', on);
}

/**
 * Budget console: Settings must be ON, then Owner always, others only if budgetAccess is checked.
 */
export function canAccessBudgetConsole(email = getCurrentUserEmail()) {
  if (!isStudioModuleEnabled('budget', email)) return false;
  if (isGuestSession(email)) return false;
  if (isStudioAdmin(email) || PRIMARY_ADMIN_EMAILS.includes(normalizeEmail(email))) return true;
  const profile = getCurrentUserProfile(email);
  return Boolean(profile?.budgetAccess);
}

/** True when this session must not mutate craft, library, or settings. */
export function isLookOnlySession(email = getCurrentUserEmail()) {
  return isGuestSession(email) || getAccessLevel(email) === 'Viewer';
}

/**
 * Keep isStudioAdmin in sync with access level.
 * Owner → true; Editor/Viewer → false (clears stale Owner flags after demotion).
 * Primary admin email is always Owner. Legacy Owner-only flags (no role) stay Owner.
 */
export function sanitizeAuthorizedUserFlags(user) {
  if (!user || typeof user !== 'object') return user;
  const email = String(user.email || '').trim().toLowerCase();
  if (PRIMARY_ADMIN_EMAILS.includes(email)) {
    return { ...user, role: 'Owner', isStudioAdmin: true };
  }
  const roleRaw = String(user.role || '').trim();
  if (roleRaw) {
    const level = normalizeAccessLevel(roleRaw);
    return {
      ...user,
      role: level,
      isStudioAdmin: level === 'Owner',
    };
  }
  // No explicit role: preserve legacy Owner via flag/designation; otherwise Editor
  if (user.isStudioAdmin === true || designationImpliesOwner(user.designation)) {
    return { ...user, role: 'Owner', isStudioAdmin: true };
  }
  return { ...user, role: 'Editor', isStudioAdmin: false };
}

export function sanitizeAuthorizedUsers(users) {
  return (Array.isArray(users) ? users : []).map(sanitizeAuthorizedUserFlags);
}

export function getAuthorizedUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
    return Array.isArray(parsed) ? sanitizeAuthorizedUsers(parsed) : [];
  } catch (e) {
    return [];
  }
}

export function getCurrentUserProfile(email = getCurrentUserEmail()) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return null;
  return (
    getAuthorizedUsers().find(
      (u) =>
        (u.email && String(u.email).trim().toLowerCase() === clean) ||
        (u.phone && clean.includes(String(u.phone).trim().toLowerCase()))
    ) || null
  );
}

function normalizeRoleLabel(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Map any stored role label → Viewer | Editor | Owner.
 * Legacy: Admin, "Director & Owner" → Owner.
 */
export function normalizeAccessLevel(value) {
  const v = normalizeRoleLabel(value);
  if (!v) return 'Editor';
  if (
    v === 'owner' ||
    v === 'admin' ||
    v === 'director & owner' ||
    v === 'director and owner' ||
    v === 'studio owner' ||
    v === 'primary owner'
  ) {
    return 'Owner';
  }
  if (v === 'viewer' || v === 'read-only' || v === 'readonly' || v === 'read only') {
    return 'Viewer';
  }
  if (v === 'editor' || v === 'collaborator') {
    return 'Editor';
  }
  return 'Editor';
}

/** Legacy Admin / Owner job titles only — craft designations never count. */
function designationImpliesOwner(designation) {
  const d = normalizeRoleLabel(designation);
  return d === 'admin' || d === 'owner' || d === 'studio owner' || d === 'director & owner';
}

/**
 * True when profile has Owner-level studio rights (access role / flag / legacy Admin designation).
 * Job titles like Lead Director / Lead Editor never grant this by themselves.
 * Explicit Editor/Viewer role wins over a stale isStudioAdmin flag (e.g. after demotion).
 */
export function profileHasOwnerAccess(profile) {
  if (!profile) return false;
  const roleRaw = String(profile.role || '').trim();
  if (roleRaw) {
    const level = normalizeAccessLevel(roleRaw);
    // Explicit collaborator access level always beats a leftover Owner flag
    if (level === 'Editor' || level === 'Viewer') return false;
    if (level === 'Owner') return true;
  }
  if (profile.isStudioAdmin === true) return true;
  // Legacy profiles that stored Admin/Owner as designation
  return designationImpliesOwner(profile.designation);
}

/** @deprecated Prefer profileHasOwnerAccess — kept for older call sites */
export function profileHasAdminDesignation(profile) {
  return profileHasOwnerAccess(profile);
}

/**
 * Studio owner = primary owner email OR user with Owner access level.
 * Designations (Lead Director, etc.) alone never make someone an owner.
 */
export function isStudioOwner(email = getCurrentUserEmail()) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return false;
  if (PRIMARY_ADMIN_EMAILS.includes(clean)) return true;

  const profile = getCurrentUserProfile(clean);
  return profileHasOwnerAccess(profile);
}

/** Alias used across App / Header / Login — means Owner-level rights */
export function isStudioAdmin(email = getCurrentUserEmail()) {
  return isStudioOwner(email);
}

export function getAccessLevel(email = getCurrentUserEmail()) {
  if (isStudioOwner(email)) return 'Owner';
  const profile = getCurrentUserProfile(email);
  return normalizeAccessLevel(profile?.role);
}

/** Normalize titles so "KARA DUSHAN" matches "Kara-Dhushan" / "KARA_DUSHAN". */
export function normalizeProjectTitleKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function projectTitlesMatch(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  const na = normalizeProjectTitleKey(left);
  const nb = normalizeProjectTitleKey(right);
  return Boolean(na && nb && na === nb);
}

/** Titles allotted to the current collaborator. Owners get null (= all projects). */
export function getAllottedProjectTitles(email = getCurrentUserEmail()) {
  if (isStudioOwner(email)) return null;

  const profile = getCurrentUserProfile(email);
  const raw = Array.isArray(profile?.allottedProjects) ? profile.allottedProjects : [];
  const titles = raw
    .map((t) => String(t || '').trim())
    .filter((t) => t && !t.toLowerCase().startsWith('all studio projects'));

  // Collaborators with no allotment get an empty list (no project access)
  return titles;
}

export function canAccessProject(projectTitle, email = getCurrentUserEmail()) {
  if (isGuestSession(email)) return false;
  if (isStudioOwner(email)) return true;
  const title = String(projectTitle || '').trim();
  if (!title) return false;
  const allotted = getAllottedProjectTitles(email) || [];
  return allotted.some((t) => projectTitlesMatch(t, title));
}

/**
 * Owner always. Editors with Independent pack + Own library may create/delete
 * titles in their pack library (not studio films they were only allotted).
 */
export function canCreateOrDeleteProjects(email = getCurrentUserEmail()) {
  if (isGuestSession(email)) return false;
  if (downloadedAppPresentationOnly(email)) return false;
  if (isStudioOwner(email)) return true;
  if (getAccessLevel(email) === 'Viewer') return false;
  const profile = getCurrentUserProfile(email);
  return Boolean(profile?.independentPack && profile?.ownLibrary);
}

/** Owner + Editor may edit allotted projects; Viewer is read-only. */
export function canEditProjects(email = getCurrentUserEmail()) {
  if (isGuestSession(email)) return false;
  if (isStudioOwner(email)) return true;
  return getAccessLevel(email) === 'Editor';
}

/** Parse / live screenplay mutate — Viewer and look-only stay off the script. */
export function assertCanWriteScreenplay(projectTitle, email = getCurrentUserEmail()) {
  if (isLookOnlySession(email) && !isGuestSession(email)) {
    return { ok: false, code: 'LOOK_ONLY', message: 'View only — this account cannot parse or edit the screenplay.' };
  }
  if (isGuestSession(email)) {
    return { ok: false, code: 'SIGN_IN', message: 'Sign in to parse or edit the screenplay.' };
  }
  if (!canEditProjects(email)) {
    return { ok: false, code: 'NO_EDIT', message: 'Editor access is required to parse a screenplay.' };
  }
  if (!canAccessProject(projectTitle, email)) {
    return { ok: false, code: 'NO_ACCESS', message: 'This film is not allotted to your account.' };
  }
  return { ok: true };
}

export function isViewerOnly(email = getCurrentUserEmail()) {
  return getAccessLevel(email) === 'Viewer';
}

/** Active production room id — trim only; compare case-insensitively. */
export function normalizeCloudRoomId(roomId) {
  const raw = String(roomId || '').trim();
  return raw || 'sps_local_dev';
}

function cloudRoomIdsMatch(a, b) {
  return normalizeCloudRoomId(a).toLowerCase() === normalizeCloudRoomId(b).toLowerCase();
}

/**
 * Room allow-list on a collaborator.
 * - missing / non-array `cloudRooms` → legacy: in every room
 * - `[]` → in no rooms
 * - `['sps_mvk']` → only those rooms
 */
export function getUserCloudRooms(user) {
  if (!user || typeof user !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(user, 'cloudRooms')) return null;
  const raw = user.cloudRooms;
  if (!Array.isArray(raw)) return null;
  return raw.map((r) => normalizeCloudRoomId(r)).filter(Boolean);
}

function isPermanentRoomMember(user) {
  const email = normalizeEmail(user?.email);
  if (PRIMARY_ADMIN_EMAILS.includes(email)) return true;
  return profileHasOwnerAccess(user);
}

/** True when this person belongs in the production cloud room. */
export function userIsInCloudRoom(user, roomId) {
  if (isPermanentRoomMember(user)) return true;
  const rooms = getUserCloudRooms(user);
  if (rooms === null) return true;
  const rid = normalizeCloudRoomId(roomId);
  return rooms.some((r) => cloudRoomIdsMatch(r, rid));
}

/** Session may subscribe / publish this production room. */
export function canAccessCloudRoom(email = getCurrentUserEmail(), roomId) {
  const clean = normalizeEmail(email);
  if (!clean || isGuestSession(clean)) return false;
  if (PRIMARY_ADMIN_EMAILS.includes(clean)) return true;
  const profile = getCurrentUserProfile(clean);
  if (!profile) return false;
  return userIsInCloudRoom(profile, roomId);
}

function allotTitleToUser(user, title) {
  const t = String(title || '').trim();
  if (!t || !user) return user;
  if (isPermanentRoomMember(user)) return user;
  const current = Array.isArray(user.allottedProjects) ? user.allottedProjects : [];
  const has = current.some(
    (x) =>
      projectTitlesMatch(x, t) || String(x || '').toLowerCase().startsWith('all studio projects')
  );
  if (has) return { ...user, currentProject: user.currentProject || t };
  return { ...user, allottedProjects: [t, ...current], currentProject: t };
}

function mergeUserIntoCloudRoom(user, roomId) {
  const rid = normalizeCloudRoomId(roomId);
  const rooms = getUserCloudRooms(user);
  if (rooms === null) return user;
  if (rooms.some((r) => cloudRoomIdsMatch(r, rid))) return user;
  return { ...user, cloudRooms: [...rooms, rid] };
}

/**
 * Put a studio person in this production room as Editor (allotted) or Viewer (view only).
 * Creates the account if needed. Does not delete anyone from the studio.
 */
export function addUserToCloudRoom(users, email, roomId, opts = {}) {
  const clean = normalizeEmail(email);
  const rid = normalizeCloudRoomId(roomId);
  const list = Array.isArray(users) ? [...users] : [];
  if (!clean) return { users: list, created: false };
  const role = opts.role === 'Viewer' ? 'Viewer' : 'Editor';
  const allotTitle = String(opts.allotTitle || '').trim();
  const name = String(opts.name || '').trim() || clean.split('@')[0] || 'Collaborator';
  const idx = list.findIndex((u) => normalizeEmail(u?.email) === clean);

  if (idx === -1) {
    list.unshift({
      name,
      designation: 'Production Staff',
      email: clean,
      role,
      isStudioAdmin: false,
      allottedProjects: allotTitle ? [allotTitle] : [],
      currentProject: allotTitle || '',
      status: 'Active',
      cloudRooms: [rid],
      verifiedAt: new Date().toISOString()
    });
    return { users: list, created: true };
  }

  let next = mergeUserIntoCloudRoom(list[idx], rid);
  if (!isPermanentRoomMember(next)) {
    next = { ...next, role, isStudioAdmin: false };
    next = allotTitleToUser(next, allotTitle);
  }
  list[idx] = next;
  return { users: list, created: false };
}

/** Take a person out of this room only. Studio account stays on the Users tab. */
export function removeUserFromCloudRoom(users, email, roomId) {
  const clean = normalizeEmail(email);
  const rid = normalizeCloudRoomId(roomId);
  if (!clean || PRIMARY_ADMIN_EMAILS.includes(clean)) {
    return Array.isArray(users) ? users : [];
  }
  return (Array.isArray(users) ? users : []).map((u) => {
    if (normalizeEmail(u?.email) !== clean) return u;
    if (isPermanentRoomMember(u)) return u;
    const rooms = getUserCloudRooms(u);
    if (rooms === null) return { ...u, cloudRooms: [] };
    return { ...u, cloudRooms: rooms.filter((r) => !cloudRoomIdsMatch(r, rid)) };
  });
}

/** Editor allotted vs View only inside a room — never demotes Owner. */
export function setCloudRoomAccessRole(users, email, role, allotTitle = '') {
  const clean = normalizeEmail(email);
  const nextRole = role === 'Viewer' ? 'Viewer' : 'Editor';
  return (Array.isArray(users) ? users : []).map((u) => {
    if (normalizeEmail(u?.email) !== clean) return u;
    if (isPermanentRoomMember(u)) return u;
    return allotTitleToUser({ ...u, role: nextRole, isStudioAdmin: false }, allotTitle);
  });
}

/** Stamp this production room onto a user. Legacy (no cloudRooms) stays in all rooms unless pinIfUnset. */
export function ensureUserCloudRoom(user, roomId, { pinIfUnset = false } = {}) {
  if (!user || typeof user !== 'object') return user;
  const rid = normalizeCloudRoomId(roomId);
  const rooms = getUserCloudRooms(user);
  if (rooms === null) {
    return pinIfUnset ? { ...user, cloudRooms: [rid] } : user;
  }
  if (rooms.some((r) => cloudRoomIdsMatch(r, rid))) return user;
  return { ...user, cloudRooms: [...rooms, rid] };
}

/**
 * Remove a deleted project title from every collaborator's allottedProjects.
 * Preserves "All Studio Projects…" full-access entries.
 */
export function stripTitleFromAllottedProjects(users, deletedTitle) {
  const list = Array.isArray(users) ? users : [];
  const gone = String(deletedTitle || '').trim();
  if (!gone) return list;
  return list.map((u) => {
    if (!u || !Array.isArray(u.allottedProjects)) return u;
    const next = u.allottedProjects.filter((t) => {
      const s = String(t || '').trim();
      if (!s) return false;
      if (s.toLowerCase().startsWith('all studio projects')) return true;
      return !projectTitlesMatch(s, gone);
    });
    if (next.length === u.allottedProjects.length) return u;
    return { ...u, allottedProjects: next };
  });
}

/** Read live project titles from local library (sps_project_library). */
export function getLiveProjectLibrary() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(projectLibraryStorageKey()) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/** Filter a single allotted-title list to titles that still exist (plus All Studio). */
export function filterAllottedTitlesToLiveLibrary(titles, projectLibrary = getLiveProjectLibrary()) {
  const raw = Array.isArray(titles) ? titles : [];
  const live = Array.isArray(projectLibrary) ? projectLibrary : [];
  const liveKeys = new Set(
    live
      .map((p) => normalizeProjectTitleKey(p?.title))
      .filter(Boolean)
  );
  return raw.filter((t) => {
    const s = String(t || '').trim();
    if (!s) return false;
    if (s.toLowerCase().startsWith('all studio projects')) return true;
    const key = normalizeProjectTitleKey(s);
    return Boolean(key && liveKeys.has(key));
  });
}

/** Keep only allotments that still exist in the live project library (plus All Studio). */
export function pruneAllottedProjectsToLibrary(users, projectLibrary = getLiveProjectLibrary()) {
  const list = Array.isArray(users) ? users : [];
  const live = Array.isArray(projectLibrary) ? projectLibrary : [];
  // Avoid wiping valid allotments when the library has not hydrated yet
  const realTitles = live.filter((p) => {
    const t = String(p?.title || '').trim().toUpperCase();
    return t && t !== 'STAGE PRODUCTION STUDIO';
  });
  if (realTitles.length === 0) return list;

  return list.map((u) => {
    if (!u || !Array.isArray(u.allottedProjects)) return u;
    const next = filterAllottedTitlesToLiveLibrary(u.allottedProjects, live);
    if (
      next.length === u.allottedProjects.length &&
      next.every((t, i) => String(t) === String(u.allottedProjects[i]))
    ) {
      return u;
    }
    return { ...u, allottedProjects: next };
  });
}

export function filterAccessibleProjects(projectLibrary, email = getCurrentUserEmail()) {
  if (isGuestSession(email)) return [];
  const list = Array.isArray(projectLibrary) ? projectLibrary : [];
  if (isStudioOwner(email)) return list;
  return list.filter((p) => canAccessProject(p?.title, email));
}

export function markCollaboratorSession(email) {
  if (typeof window === 'undefined') return;
  const prev = getCurrentUserEmail();
  const clean = normalizeEmail(email);
  if (!clean) return;
  localStorage.setItem('sps_authorized_user_email', clean);
  localStorage.setItem('sps_is_admin_logged_in', isStudioOwner(clean) ? 'true' : 'false');
  import('./userSettingsPack')
    .then((m) => m.activatePackForSession(prev, clean))
    .catch(() => {});
}

/** Default Owner/Admin profile for the primary studio email. */
export function getPrimaryAdminProfile() {
  return {
    name: 'Studio Admin',
    designation: 'Studio Admin & Executive Producer',
    email: 'admin@stageworkstudio.com',
    role: 'Owner',
    isStudioAdmin: true,
    status: 'Active',
    allottedProjects: ['All Studio Projects (Full Access)'],
    verifiedAt: 'Primary Admin (default)',
    budgetAccess: true,
    allProjectAccess: true,
  };
}

const WEAK_ADMIN_PASSWORDS = new Set([
  'admin', 'admin123', 'password', 'password123', 'sps2026', 'studio2026', '1234567890', 'qwerty1234'
]);

/** One-shot: strip legacy weak Admin ID/password so production cannot use them. */
export function purgeWeakAdminCredentials() {
  if (typeof window === 'undefined') return false;
  try {
    const pass = String(localStorage.getItem('sps_custom_admin_password') || '');
    if (!pass) return false;
    const weakPass = pass.length < 10 || WEAK_ADMIN_PASSWORDS.has(pass.toLowerCase());
    if (weakPass) {
      localStorage.removeItem('sps_custom_admin_id');
      localStorage.removeItem('sps_custom_admin_password');
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Always keep admin@stageworkstudio.com and pedditiram@gmail.com as Owner/Admin in the collaborators list.
 * Call whenever loading or syncing authorized users in Admin Settings.
 */
export function ensurePrimaryAdminUser(users) {
  let list = Array.isArray(users) ? [...users] : [];

  const requiredAdmins = [
    {
      name: 'Studio Admin',
      designation: 'Studio Admin & Executive Producer',
      email: 'admin@stageworkstudio.com',
      role: 'Owner',
      isStudioAdmin: true,
      status: 'Active',
      allottedProjects: ['All Studio Projects (Full Access)'],
      verifiedAt: 'Primary Admin (default)',
      budgetAccess: true,
      allProjectAccess: true,
    },
    {
      name: 'Studio Owner',
      designation: 'Lead Director & Cinematographer',
      email: 'pedditiram@gmail.com',
      role: 'Owner',
      isStudioAdmin: true,
      status: 'Active',
      allottedProjects: ['All Studio Projects (Full Access)'],
      verifiedAt: 'Studio Admin',
      budgetAccess: true,
      allProjectAccess: true,
    },
  ];

  for (const admin of requiredAdmins) {
    const idx = list.findIndex(
      (u) => String(u?.email || '').trim().toLowerCase() === admin.email
    );
    if (idx === -1) {
      list.push(admin);
    } else {
      list[idx] = {
        ...admin,
        ...list[idx],
        email: admin.email,
        name: list[idx].name || admin.name,
        role: 'Owner',
        isStudioAdmin: true,
        status: 'Active',
        allottedProjects:
          Array.isArray(list[idx].allottedProjects) && list[idx].allottedProjects.length > 0
            ? list[idx].allottedProjects
            : admin.allottedProjects,
        budgetAccess: true,
        allProjectAccess: true,
      };
    }
  }

  // Ensure admin@stageworkstudio.com is first, pedditiram@gmail.com is second
  const adminIdx = list.findIndex(u => String(u?.email || '').trim().toLowerCase() === 'admin@stageworkstudio.com');
  if (adminIdx > 0) {
    const [u] = list.splice(adminIdx, 1);
    list.unshift(u);
  }
  const ramIdx = list.findIndex(u => String(u?.email || '').trim().toLowerCase() === 'pedditiram@gmail.com');
  if (ramIdx > 1) {
    const [u] = list.splice(ramIdx, 1);
    list.splice(1, 0, u);
  }

  // Clear stale isStudioAdmin on Editor/Viewer; keep it only for Owner
  for (let i = 0; i < list.length; i++) {
    const email = String(list[i]?.email || '').trim().toLowerCase();
    if (PRIMARY_ADMIN_EMAILS.includes(email)) continue;
    list[i] = sanitizeAuthorizedUserFlags(list[i]);
  }

  return list;
}
