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

export const PRIMARY_ADMIN_EMAILS = ['pedditiram@gmail.com'];

/** Job-title designations only — never imply create/delete rights */
export const STUDIO_DESIGNATIONS = [
  'Lead Director',
  'Executive Producer',
  'DOP / Cinematographer',
  'Lighting Specialist',
  'Sound Engineer',
  'Lead Editor',
  'Co-Artist & Performer',
  'Production Assistant',
];

/** Studio access levels (single-select) */
export const ACCESS_LEVELS = ['Viewer', 'Editor', 'Owner'];

export function getCurrentUserEmail() {
  if (typeof window === 'undefined') return '';
  return String(localStorage.getItem('sps_authorized_user_email') || '').trim().toLowerCase();
}

/**
 * Guest / unauthenticated session — no studio library, editing, admin, or allotments.
 * Guests may only view Investor Deck & Studio Showcase (and login).
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
  return isStudioOwner(email);
}

/** Owner + Editor may edit allotted projects; Viewer is read-only. */
export function canEditProjects(email = getCurrentUserEmail()) {
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
  const list = Array.isArray(projectLibrary) ? projectLibrary : [];
  if (isStudioOwner(email)) return list;
  return list.filter((p) => canAccessProject(p?.title, email));
}

export function markCollaboratorSession(email) {
  if (typeof window === 'undefined') return;
  const clean = String(email || '').trim().toLowerCase();
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
