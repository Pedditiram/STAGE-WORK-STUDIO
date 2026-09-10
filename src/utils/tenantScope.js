/**
 * Public-account isolation — a self-serve trial never shares the studio library,
 * Users tab, or production cloud room (MVK stays the owner's film).
 */
import { isOwner, upsertLicense } from './saasControl';

export const SELF_SERVE_ORIGIN = 'self_serve';
export const STUDIO_LIBRARY_KEY = 'sps_project_library';
export const TENANT_FIRST_TITLE = 'MY FIRST FILM';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function slugEmail(email) {
  return normalizeEmail(email).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'anon';
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

function writeUsers(list) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sps_authorized_phone_users', JSON.stringify(list));
  try {
    window.dispatchEvent(new CustomEvent('sps_collaborators_updated', { detail: { source: 'tenant' } }));
  } catch {
    /* ignore */
  }
}

export function isSelfServeProfile(user) {
  if (!user || typeof user !== 'object') return false;
  if (isOwner(user.email)) return false;
  return String(user.packOrigin || '') === SELF_SERVE_ORIGIN;
}

export function isSelfServeSession(email) {
  const clean = normalizeEmail(email || (typeof window !== 'undefined' ? localStorage.getItem('sps_authorized_user_email') : ''));
  if (!clean || isOwner(clean)) return false;
  const row = readUsers().find((u) => normalizeEmail(u?.email) === clean);
  return isSelfServeProfile(row);
}

/** Studio films stay on the shared key. Public accounts get their own library. */
export function projectLibraryStorageKey(email) {
  const clean = normalizeEmail(email || (typeof window !== 'undefined' ? localStorage.getItem('sps_authorized_user_email') : ''));
  if (!clean || isOwner(clean)) return STUDIO_LIBRARY_KEY;
  if (!isSelfServeSession(clean)) return STUDIO_LIBRARY_KEY;
  return `${STUDIO_LIBRARY_KEY}::${slugEmail(clean)}`;
}

export function shouldSkipStudioCloud(email) {
  return isSelfServeSession(email);
}

export function studioCollaboratorsForCloud(users) {
  return (Array.isArray(users) ? users : []).filter((u) => !isSelfServeProfile(u));
}

function starterShots() {
  return [
    {
      sceneShotId: 'SC01_SH01',
      shotComposition: 'Wide Shot (WS)',
      cameraMotionTag: '[Camera: Slow push-in]',
      timeAndLightingEnv: '[Weather: Clear] • [Timing: Day] • [Env: Your set]',
      directionalLightingAndHighlight: '[Angle: Soft key] • [Shadow: Open] • [Highlight: Gentle rim]',
      subjectLightingTag: '[Lighting: Natural]',
      subjectColorTag: '[Subject Color: Warm]',
      backgroundLightingTag: '[BG Lighting: Soft]',
      backgroundColorTag: '[BG Color: Neutral]',
      characterIdAssetRef: '[CharID: @Lead]',
      coArtistInteraction: '[Co-Artist: —]',
      actionEnvContext: 'Opening image. Paste your screenplay in Writer, then Sync to Matrix.',
      characterExpression: 'Present, listening',
      characterPsychologyState: '[Mindstate: First page]',
      characterMannerismAndPosture: '[Mannerism: Still]',
      characterPlacement: 'Center',
      characterDialogue: '',
      characterMovement: 'Hold',
      characterEyeLooks: '[Eye Look: Lens]',
      sceneSynopsis: 'Your first scene. Replace this beat by parsing the script.',
      shotDurationAndImages: 'Duration: 4s',
      lifecycleStatus: 'draft'
    }
  ];
}

export function starterScreenplay() {
  return `FADE IN:

INT. YOUR SET - DAY

A blank page. This film is yours — not a studio title.

LEAD
(quiet)
The picture starts when the script does.

FADE OUT.
`;
}

export function seedTenantFirstFilm(email, { name = '' } = {}) {
  if (typeof window === 'undefined') return null;
  const clean = normalizeEmail(email);
  if (!clean || isOwner(clean)) return null;
  const title = TENANT_FIRST_TITLE;
  const key = projectLibraryStorageKey(clean);
  let library = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    library = Array.isArray(parsed) ? parsed : [];
  } catch {
    library = [];
  }
  const exists = library.some((p) => String(p?.title || '').trim().toUpperCase() === title);
  const project = exists
    ? library.find((p) => String(p?.title || '').trim().toUpperCase() === title)
    : {
        id: `proj_tenant_${Date.now()}`,
        title,
        description: `${name || clean.split('@')[0]} — first film`,
        targetModel: 'SPS Direct Cinema 2.0',
        aspectRatio: '2.39:1 Anamorphic',
        roomId: `sps_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        lastModified: new Date().toLocaleDateString(),
        lastModifiedIso: new Date().toISOString(),
        shots: starterShots(),
        screenplayText: starterScreenplay(),
        packOrigin: SELF_SERVE_ORIGIN
      };
  if (!exists) library.unshift(project);
  try {
    localStorage.setItem(key, JSON.stringify(library));
    localStorage.setItem('sps_current_project_title', title);
    localStorage.setItem('sps_active_project_title', title);
    localStorage.setItem('sps_project_title', title);
    localStorage.setItem('sps_current_shots', JSON.stringify(project.shots || []));
    localStorage.setItem('sps_current_room_id', project.roomId);
    localStorage.setItem('sps_open_screenplay_text::my_first_film', project.screenplayText || starterScreenplay());
    localStorage.setItem('sps_open_screenplay_text', project.screenplayText || starterScreenplay());
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('sps_projects_updated', { detail: { source: 'tenant_seed' } }));
    window.dispatchEvent(new CustomEvent('sps_screenplay_updated', { detail: { source: 'tenant_seed' } }));
  } catch {
    /* ignore */
  }
  return project;
}

/** Create a public trial profile that cannot enter studio rooms or the studio library. */
export function activateSelfServeAccount(email, { name = '', role = 'Writer' } = {}) {
  const clean = normalizeEmail(email);
  if (!clean || isOwner(clean)) return null;
  upsertLicense(clean, {
    plan: 'trial',
    credits: 50,
    apiMode: 'byok',
    status: 'ACTIVE',
    packOrigin: SELF_SERVE_ORIGIN
  });
  const users = readUsers();
  const idx = users.findIndex((u) => normalizeEmail(u?.email) === clean);
  const row = {
    ...(idx >= 0 ? users[idx] : {}),
    name: name || clean.split('@')[0],
    designation: role || 'Writer',
    email: clean,
    role: 'Editor',
    status: 'Active',
    independentPack: true,
    ownLibrary: true,
    packOrigin: SELF_SERVE_ORIGIN,
    cloudRooms: [],
    allottedProjects: [TENANT_FIRST_TITLE],
    packOwnedTitles: [TENANT_FIRST_TITLE]
  };
  if (idx >= 0) users[idx] = row;
  else users.unshift(row);
  writeUsers(users);
  seedTenantFirstFilm(clean, { name: row.name });
  return row;
}
