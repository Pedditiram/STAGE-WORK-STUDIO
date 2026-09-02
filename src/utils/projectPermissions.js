/**
 * Studio project access permissions.
 *
 * Access levels (single-select):
 * - Owner  → create / delete / duplicate / import + full library
 * - Editor → edit allotted projects only (no create/delete)
 * - Viewer → read-only allotted projects (no create/delete)
 *
 * Job-title designations (Lead Director, DOP, etc.) never grant create/delete by themselves.
 * Legacy roles Admin / "Director & Owner" map to Owner.
 */

import { isGuestPlayTitle, getGuestPlayProject } from './guestPlayground';
import { canUseSaasConsole } from './saasControl';
import { PRODUCTION_ORIGIN } from './runtimeEnv';

export const PRIMARY_ADMIN_EMAILS = ['pedditiram@gmail.com'];

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
 * Guest / unauthenticated session — no studio library writes, editing, admin, or allotments.
 * When Guest Browse is on (Settings), guests may look through rooms read-only.
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

export const GUEST_BROWSE_KEY = 'sps_guest_browse_enabled';
export const GUEST_URL_KEY = 'sps_guest_url_enabled';
export const GUEST_LOOK_SESSION_KEY = 'sps_guest_look_link';

function guestQueryOn() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search);
    const v = String(q.get('guest') || q.get('look') || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}

/** Shareable look-only URL for this origin. */
export function getGuestLookShareUrl() {
  if (typeof window === 'undefined') return `${PRODUCTION_ORIGIN}/?guest=1`;
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('guest', '1');
  return url.toString();
}

/** Public ?guest=1 switch — default ON. */
export function isGuestUrlEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    const pub = sessionStorage.getItem('sps_guest_url_public');
    if (pub === 'false') return false;
    if (pub === 'true') return true;
    const local = localStorage.getItem(GUEST_URL_KEY);
    if (local === 'false') return false;
    if (local === 'true') return true;
    return true;
  } catch {
    return true;
  }
}

export function setGuestUrlEnabled(on) {
  if (typeof window === 'undefined') return false;
  const next = Boolean(on);
  try {
    localStorage.setItem(GUEST_URL_KEY, next ? 'true' : 'false');
    sessionStorage.setItem('sps_guest_url_public', next ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('sps_guest_browse_changed', { detail: { urlEnabled: next } }));
    fetch('/api/guest-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlEnabled: next })
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  return next;
}

export async function hydrateGuestUrlFromServer() {
  if (typeof window === 'undefined') return isGuestUrlEnabled();
  try {
    const res = await fetch('/api/guest-access', { cache: 'no-store' });
    const data = await res.json();
    if (typeof data?.urlEnabled === 'boolean') {
      sessionStorage.setItem('sps_guest_url_public', data.urlEnabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('sps_guest_browse_changed', { detail: { urlEnabled: data.urlEnabled } }));
    }
  } catch {
    /* ignore */
  }
  return isGuestUrlEnabled();
}

/** If the visitor opened ?guest=1 / ?look=1 and Guest URL is on, pin look-only for this tab. */
export function consumeGuestLookFromUrl() {
  if (typeof window === 'undefined') return false;
  if (!guestQueryOn() || !isGuestUrlEnabled()) return false;
  try {
    sessionStorage.setItem(GUEST_LOOK_SESSION_KEY, '1');
    sessionStorage.setItem('sps_login_prompted', '1');
    sessionStorage.setItem('sps_guest_look_session', '1');
    window.dispatchEvent(new CustomEvent('sps_guest_browse_changed', { detail: { enabled: true } }));
  } catch {
    /* ignore */
  }
  return true;
}

export function enterGuestLookSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(GUEST_LOOK_SESSION_KEY, '1');
    sessionStorage.setItem('sps_login_prompted', '1');
    sessionStorage.setItem('sps_guest_look_session', '1');
    localStorage.removeItem('sps_authorized_user_email');
    window.dispatchEvent(new Event('sps_collaborators_updated'));
    window.dispatchEvent(new CustomEvent('sps_guest_browse_changed', { detail: { enabled: true } }));
  } catch {
    /* ignore */
  }
}

/** Owner Settings switch, share link, or this-tab guest look. */
export function isGuestBrowseEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (guestQueryOn() && isGuestUrlEnabled()) return true;
    if (sessionStorage.getItem(GUEST_LOOK_SESSION_KEY) === '1') return true;
    if (sessionStorage.getItem('sps_guest_look_session') === '1') return true;
    return localStorage.getItem(GUEST_BROWSE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setGuestBrowseEnabled(on) {
  if (typeof window === 'undefined') return false;
  const next = Boolean(on);
  try {
    localStorage.setItem(GUEST_BROWSE_KEY, next ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('sps_guest_browse_changed', { detail: { enabled: next } }));
  } catch {
    /* ignore */
  }
  return next;
}

/** Guest who may walk rooms / open desks in look-only mode. */
export function canGuestBrowseApp(email = getCurrentUserEmail()) {
  return isGuestSession(email) && isGuestBrowseEnabled();
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
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PRESENTATION_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPresentationMode(on) {
  if (typeof window === 'undefined') return Boolean(on);
  try {
    localStorage.setItem(PRESENTATION_MODE_KEY, on ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('sps_studio_modules_changed', { detail: { presentation: Boolean(on) } }));
    window.dispatchEvent(new CustomEvent('sps_budget_console_changed', { detail: { presentation: Boolean(on) } }));
  } catch {
    /* ignore */
  }
  return Boolean(on);
}

/** Real login must leave the reel and guest-look tab. */
export function exitPresentationForWorkspace() {
  try {
    sessionStorage.removeItem(GUEST_LOOK_SESSION_KEY);
    sessionStorage.removeItem('sps_guest_look_session');
    sessionStorage.removeItem('sps_guest_look_link');
  } catch {
    /* ignore */
  }
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
  if (isGuestSession(email)) {
    return canGuestBrowseApp(email) && isGuestPlayTitle(projectTitle);
  }
  if (isStudioOwner(email)) return true;
  const title = String(projectTitle || '').trim();
  if (!title) return false;
  const allotted = getAllottedProjectTitles(email) || [];
  return allotted.some((t) => projectTitlesMatch(t, title));
}

/**
 * Only Owner can create, delete, duplicate, or import projects.
 * Editors / Viewers (and all craft designations) cannot.
 */
export function canCreateOrDeleteProjects(email = getCurrentUserEmail()) {
  if (isGuestSession(email)) return false;
  return isStudioOwner(email);
}

/** Owner + Editor may edit allotted projects; Viewer is read-only. */
export function canEditProjects(email = getCurrentUserEmail()) {
  if (isGuestSession(email)) return canGuestBrowseApp(email);
  if (isStudioOwner(email)) return true;
  return getAccessLevel(email) === 'Editor';
}

export function isViewerOnly(email = getCurrentUserEmail()) {
  return getAccessLevel(email) === 'Viewer';
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
    const parsed = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
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
  if (isGuestSession(email)) {
    return canGuestBrowseApp(email) ? [getGuestPlayProject()] : [];
  }
  const list = Array.isArray(projectLibrary) ? projectLibrary : [];
  if (isStudioOwner(email)) return list;
  return list.filter((p) => canAccessProject(p?.title, email));
}

export function markCollaboratorSession(email) {
  if (typeof window === 'undefined') return;
  const clean = normalizeEmail(email);
  if (!clean) return;
  localStorage.setItem('sps_authorized_user_email', clean);
  localStorage.setItem('sps_is_admin_logged_in', isStudioOwner(clean) ? 'true' : 'false');
}

/** Default Owner/Admin profile for the primary studio email. */
export function getPrimaryAdminProfile() {
  return {
    name: 'Pedditi Ram',
    designation: 'Lead Director',
    email: 'pedditiram@gmail.com',
    role: 'Owner',
    isStudioAdmin: true,
    status: 'Active',
    allottedProjects: ['All Studio Projects (Full Access)'],
    verifiedAt: 'Primary Admin (default)',
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
 * Always keep pedditiram@gmail.com as Owner/Admin in the collaborators list.
 * Call whenever loading or syncing authorized users in Admin Settings.
 */
export function ensurePrimaryAdminUser(users) {
  const list = Array.isArray(users) ? [...users] : [];
  const primary = 'pedditiram@gmail.com';
  const idx = list.findIndex(
    (u) => String(u?.email || '').trim().toLowerCase() === primary
  );
  const defaults = getPrimaryAdminProfile();

  if (idx === -1) {
    list.unshift(defaults);
  } else {
    list[idx] = {
      ...defaults,
      ...list[idx],
      email: primary,
      name: list[idx].name || defaults.name,
      role: 'Owner',
      isStudioAdmin: true,
      status: list[idx].status === 'Suspended' ? 'Active' : (list[idx].status || 'Active'),
      allottedProjects:
        Array.isArray(list[idx].allottedProjects) && list[idx].allottedProjects.length > 0
          ? list[idx].allottedProjects
          : defaults.allottedProjects,
    };

    // Keep primary admin first in Settings
    if (idx !== 0) {
      const [adminUser] = list.splice(idx, 1);
      list.unshift(adminUser);
    }
  }

  // Clear stale isStudioAdmin on Editor/Viewer; keep it only for Owner
  for (let i = 0; i < list.length; i++) {
    const email = String(list[i]?.email || '').trim().toLowerCase();
    if (email === primary) continue;
    list[i] = sanitizeAuthorizedUserFlags(list[i]);
  }

  return list;
}
