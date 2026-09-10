/**
 * Public-account isolation — a self-serve trial never shares the studio library,
 * Users tab, or production cloud room (MVK stays the owner's film).
 */
import { isOwner, upsertLicense } from './saasControl';
import {
  DEMO_PROJECT_TITLE,
  DEMO_PROJECT_ID,
  DEMO_PROJECT_REVISION,
  DEMO_PROJECT_SCREENPLAY,
  buildDemoStudioProject,
  isDemoProjectTitle
} from './demoStudioProject';
import { saveActiveCharacterProfiles, saveActiveWorldAssets } from './projectBibleVault';

export const SELF_SERVE_ORIGIN = 'self_serve';
export const STUDIO_LIBRARY_KEY = 'sps_project_library';
export const TENANT_FIRST_TITLE = 'MY FIRST FILM';
export { DEMO_PROJECT_TITLE };

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

function titleKey(p) {
  return String(p?.title || '').trim().toUpperCase();
}

function blankFirstFilm(email, name) {
  const clean = normalizeEmail(email);
  return {
    id: `proj_tenant_${Date.now()}`,
    title: TENANT_FIRST_TITLE,
    description: `${name || clean.split('@')[0]} — first film`,
    targetModel: 'SPS Direct Cinema 2.0',
    aspectRatio: '2.39:1 Anamorphic',
    roomId: `sps_${TENANT_FIRST_TITLE.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    lastModified: new Date().toLocaleDateString(),
    lastModifiedIso: new Date().toISOString(),
    shots: starterShots(),
    screenplayText: starterScreenplay(),
    characterProfiles: [],
    worldAssets: [],
    packOrigin: SELF_SERVE_ORIGIN
  };
}

function persistOpenTitle(project) {
  if (!project?.title) return;
  try {
    localStorage.setItem('sps_current_project_title', project.title);
    localStorage.setItem('sps_active_project_title', project.title);
    localStorage.setItem('sps_project_title', project.title);
    localStorage.setItem('sps_current_shots', JSON.stringify(project.shots || []));
    localStorage.setItem('sps_current_room_id', project.roomId || '');
    const slug = String(project.title).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const pages = project.screenplayText || '';
    localStorage.setItem(`sps_open_screenplay_text::${slug}`, pages);
    localStorage.setItem('sps_open_screenplay_text', pages);
  } catch {
    /* ignore */
  }
}

export function seedTenantFirstFilm(email, { name = '' } = {}) {
  if (typeof window === 'undefined') return null;
  const clean = normalizeEmail(email);
  if (!clean || isOwner(clean)) return null;
  const key = projectLibraryStorageKey(clean);
  let library = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    library = Array.isArray(parsed) ? parsed : [];
  } catch {
    library = [];
  }

  let demo = library.find((p) => isDemoProjectTitle(p.title));
  const createdDemo = !demo;
  const staleDemo = Boolean(
    demo &&
      (demo.demoRevision !== DEMO_PROJECT_REVISION || titleKey(demo) !== DEMO_PROJECT_TITLE)
  );
  if (!demo || staleDemo) {
    const next = {
      ...buildDemoStudioProject({ name: name || clean.split('@')[0] }),
      id: demo?.id || DEMO_PROJECT_ID,
      packOrigin: demo?.packOrigin || SELF_SERVE_ORIGIN
    };
    library = library.filter((p) => !isDemoProjectTitle(p.title));
    library.unshift(next);
    demo = next;
    try {
      saveActiveCharacterProfiles(demo.characterProfiles || [], { title: DEMO_PROJECT_TITLE, silent: true });
      saveActiveWorldAssets(demo.worldAssets || [], { title: DEMO_PROJECT_TITLE, silent: true });
    } catch {
      /* ignore */
    }
  }

  let first = library.find((p) => titleKey(p) === TENANT_FIRST_TITLE);
  if (!first) {
    first = blankFirstFilm(clean, name);
    library.push(first);
  }

  if (createdDemo || staleDemo) persistOpenTitle(demo);
  try {
    const slug = String(DEMO_PROJECT_TITLE).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    localStorage.setItem(`sps_open_screenplay_text::${slug}`, demo.screenplayText || DEMO_PROJECT_SCREENPLAY);
    localStorage.setItem('sps_open_screenplay_text::sws_desk_demo', demo.screenplayText || DEMO_PROJECT_SCREENPLAY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(key, JSON.stringify(library));
  } catch {
    /* ignore */
  }
  try {
    const users = readUsers();
    const idx = users.findIndex((u) => normalizeEmail(u?.email) === clean);
    if (idx >= 0) {
      const row = users[idx];
      const titles = [DEMO_PROJECT_TITLE, TENANT_FIRST_TITLE, ...(row.allottedProjects || []), ...(row.packOwnedTitles || [])].map(
        (t) => (isDemoProjectTitle(t) ? DEMO_PROJECT_TITLE : t)
      );
      const uniq = [];
      titles.forEach((t) => {
        const n = String(t || '').trim();
        if (!n) return;
        if (uniq.some((x) => x.toUpperCase() === n.toUpperCase())) return;
        uniq.push(n);
      });
      users[idx] = {
        ...row,
        allottedProjects: uniq,
        packOwnedTitles: uniq
      };
      writeUsers(users);
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('sps_projects_updated', { detail: { source: 'tenant_seed' } }));
    window.dispatchEvent(new CustomEvent('sps_screenplay_updated', { detail: { source: 'tenant_seed' } }));
  } catch {
    /* ignore */
  }
  return demo;
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
    allottedProjects: [DEMO_PROJECT_TITLE, TENANT_FIRST_TITLE],
    packOwnedTitles: [DEMO_PROJECT_TITLE, TENANT_FIRST_TITLE]
  };
  if (idx >= 0) users[idx] = row;
  else users.unshift(row);
  writeUsers(users);
  seedTenantFirstFilm(clean, { name: row.name });
  return row;
}
