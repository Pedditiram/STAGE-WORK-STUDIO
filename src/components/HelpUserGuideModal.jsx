import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  HelpCircle,
  ChevronRight,
  Search,
  Film,
  FolderOpen,
  LayoutGrid,
  FileText,
  Users,
  Video,
  Cloud,
  Monitor,
  Settings,
  Archive,
  Wand2,
  HardDrive,
  Upload
} from 'lucide-react';
import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import { isStudioAdmin, getCurrentUserEmail } from '../utils/projectPermissions';

const CRAFT_COUNT = SEEDANCE_SLOTS.length;

function Step({ n, title, children }) {
  return (
    <div className="p-3 rounded-lg border border-[var(--sps-border)] bg-[var(--sps-surface)] flex items-start gap-3">
      <span
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
        style={{ background: 'var(--sps-gold)', color: 'var(--sps-bg)' }}
      >
        {n}
      </span>
      <div className="min-w-0 space-y-1">
        <strong className="block text-[12px]" style={{ color: 'var(--sps-text)' }}>
          {title}
        </strong>
        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--sps-muted)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Callout({ title, children }) {
  return (
    <div
      className="p-4 rounded-xl border space-y-2"
      style={{ borderColor: 'var(--sps-border)', background: 'var(--sps-bg-elevated)' }}
    >
      <h4 className="m-0 text-sm font-semibold" style={{ color: 'var(--sps-gold)' }}>
        {title}
      </h4>
      <div className="text-[11px] leading-relaxed space-y-2" style={{ color: 'var(--sps-text)' }}>
        {children}
      </div>
    </div>
  );
}

function buildGuideSections(isAdmin) {
  const sections = [
    {
      id: 'start',
      icon: Film,
      title: '1. First 5 minutes',
      badge: 'START HERE',
      keywords: 'beginner new user welcome start open studio what is',
      content: (
        <div className="space-y-4 text-[11px]">
          <Callout title="What is Stage Work Studio?">
            <p>
              It is a <strong>film production desk on your computer</strong>. You write or upload a screenplay, break it
              into shots, lock character and world looks, then generate images and videos — with your team if you want.
            </p>
            <p>
              Think of it like a digital film office: Projects = films, Matrix = shot list, Writer = script, Cast =
              characters, World = locations, Generate = camera / AI takes.
            </p>
          </Callout>

          <Step n={1} title="Sign in">
            Use the login screen with your studio email. Guests can look around if Guest Browse is on, but cannot save
            films.
          </Step>
          <Step n={2} title="Open Projects">
            Click the <strong>Projects</strong> (folder) button in the top bar. That opens the <strong>Project Console</strong>{' '}
            — your film library.
          </Step>
          <Step n={3} title="Open a film">
            On a project card, click <strong>Open Active Studio</strong> (active film) or <strong>Switch &amp; Open
            Project</strong> (another film). That loads Writer, Matrix, Cast, and everything for that title.
          </Step>
          <Step n={4} title="Save your work">
            Click the <strong>Save</strong> (disk) icon in the top bar. Use the small arrow next to it for auto-save
            every few minutes. Prefer this over only relying on Cloud sync.
          </Step>
          <Step n={5} title="Need a map?">
            Press <strong>Shift+Space</strong> (or swipe from the left on phone) to open the <strong>Navigator</strong> —
            jump to Writer, Matrix, Cast, Generate, and more by name.
          </Step>
        </div>
      )
    },
    {
      id: 'open_save',
      icon: FolderOpen,
      title: '2. Open & save projects',
      badge: 'PROJECTS',
      keywords:
        'open project file import backup restore library switch save version vault disk folder where is open',
      content: (
        <div className="space-y-4 text-[11px]">
          <Callout title="Where is “Open project file”?">
            <p>
              There is no separate menu named only “Open…”. Opening works in two ways:
            </p>
            <ol className="list-decimal pl-4 space-y-2 m-0">
              <li>
                <strong>Open a film already in the library</strong> — Project Console → click{' '}
                <strong>Open Active Studio</strong> or <strong>Switch &amp; Open Project</strong> on a card. This is what
                most people use every day.
              </li>
              <li>
                <strong>Open a project file from disk</strong> — Project Console top bar →{' '}
                <strong>Open Project File</strong> (same as Import Backup). Choose a <code>.sps</code> or{' '}
                <code>.json</code> backup. Studio admins see this button; collaborators open films they were given from
                the library cards.
              </li>
            </ol>
          </Callout>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[var(--sps-border)] space-y-1">
              <strong className="flex items-center gap-2" style={{ color: 'var(--sps-text)' }}>
                <Upload className="w-3.5 h-3.5" /> Open Project File
              </strong>
              <p style={{ color: 'var(--sps-muted)' }}>
                Loads a backup file into the library, then you open the card. Use when someone emailed you a{' '}
                <code>.sps</code> or you restored from Downloads.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-[var(--sps-border)] space-y-1">
              <strong className="flex items-center gap-2" style={{ color: 'var(--sps-text)' }}>
                <Archive className="w-3.5 h-3.5" /> Backup on a card
              </strong>
              <p style={{ color: 'var(--sps-muted)' }}>
                Downloads a <code>.sps</code> copy to your computer. Handy for email or Drive — not the same as folder
                versioning below.
              </p>
            </div>
          </div>

          <Callout title="Save (top bar disk icon)">
            <p>
              Writes the full film to the studio vault on this machine (<code>projects/YourTitle.json</code>). If you set
              a <strong>Project save location</strong> and turned on <strong>Version project saves</strong>, each Save
              also writes <code>TITLE_v001.json</code>, <code>v002</code>, … into that folder.
            </p>
            <p>
              Cloud sync (cloud icon next to Save) shares with teammates — use both: Save for safety on disk, Sync for
              the room.
            </p>
          </Callout>

          <Callout title="How to add a new version">
            <ol className="list-decimal pl-4 space-y-1 m-0">
              <li>Project Console → expand <strong>ComfyUI asset folders</strong> on the film card.</li>
              <li>Set <strong>Project save location</strong> (e.g. Desktop/SWS PROJECTS/KARA_DUSHAN/PROJECT/Versions).</li>
              <li>Leave <strong>Version project saves</strong> checked (shows “next v001”).</li>
              <li>Click top-bar <strong>Save</strong> — a new <code>_v00N.json</code> appears in that folder.</li>
            </ol>
          </Callout>
        </div>
      )
    },
    {
      id: 'rooms',
      icon: LayoutGrid,
      title: '3. Studio rooms (what each button does)',
      badge: 'MAP',
      keywords: 'writer matrix form stage cast world compile generate promo budget pitch header tabs',
      content: (
        <div className="space-y-3 text-[11px]">
          <p style={{ color: 'var(--sps-muted)' }}>
            The top bar is your film office. Each button opens one room for the <strong>active project</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ['Writer', 'Screenplay text — write, paste, or edit the script.'],
              ['Matrix', 'Spreadsheet of every shot and cinema crafts (camera, light, acting…).'],
              ['Form', 'One shot at a time — easier on a laptop than the full grid.'],
              ['Stage', '3D / visual stage for blocking (layout is session — save shots for safety).'],
              ['Cast', 'Character bible — faces, costumes, continuity.'],
              ['World', 'Locations, sets, environments.'],
              ['Compile', 'Builds final image/video prompts from Matrix + bibles.'],
              ['Generate', 'Create stills and video takes (needs keys or managed credits).'],
              ['Projects', 'Film library — open, switch, backup, archive, asset folders.']
            ].map(([name, desc]) => (
              <div key={name} className="p-2.5 rounded-lg border border-[var(--sps-border)]">
                <strong style={{ color: 'var(--sps-gold)' }}>{name}</strong>
                <p className="m-0 mt-1" style={{ color: 'var(--sps-muted)' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'script',
      icon: Wand2,
      title: '4. Script → shot list',
      badge: 'BREAKDOWN',
      content: (
        <div className="space-y-3 text-[11px]">
          <Step n={1} title="Open Project Console">
            Click <strong>Projects</strong>, find your film card.
          </Step>
          <Step n={2} title="AI Script Breakdown">
            Click the tan <strong>AI Script Breakdown</strong> button on the card. Paste text or upload PDF/TXT.
          </Step>
          <Step n={3} title="Build the Matrix">
            Run analyze / build. Scenes become shot rows with camera, action, and craft fields filled as a starting
            point — you can edit everything afterward.
          </Step>
          <Callout title="Tip">
            Set the <strong>Project Genre</strong> on the card first (mythology, thriller, fantasy…). That steers
            references and breakdown taste.
          </Callout>
        </div>
      )
    },
    {
      id: 'matrix',
      icon: FileText,
      title: `5. Matrix (${CRAFT_COUNT} crafts) & Compile`,
      badge: 'SHOTS',
      keywords: 'matrix craft columns compile prompts focus strip',
      content: (
        <div className="space-y-3 text-[11px]">
          <p style={{ color: 'var(--sps-muted)' }}>
            Each row is one shot. Columns are cinema crafts (framing, lens, light, performance, sound, VFX, references…).
          </p>
          <ul className="list-disc pl-4 space-y-1 m-0" style={{ color: 'var(--sps-muted)' }}>
            <li>Edit cells like a spreadsheet, or use <strong>Form</strong> for one shot.</li>
            <li>Use focus filters (Camera, Lighting, Acting…) to hide columns you do not need.</li>
            <li>
              <strong>Compile</strong> turns the row + Cast + World into a ready prompt for image/video engines.
            </li>
            <li>
              <strong>+ Add Shot</strong> at the bottom of Matrix adds a blank row.
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'cast_world',
      icon: Users,
      title: '6. Cast & World',
      badge: 'LOOK LOCK',
      content: (
        <div className="space-y-3 text-[11px]">
          <Callout title="Why this matters">
            AI forgets faces between shots unless you lock them. Cast (characters) and World (places) are the memory of
            your film.
          </Callout>
          <p style={{ color: 'var(--sps-muted)' }}>
            Open <strong>Cast</strong> or <strong>World</strong> from the top bar. Fill look sheets, then reference them
            from Matrix / Compile. On Project Console you can also set <strong>ComfyUI asset folders</strong> so look
            sheets on disk map into Seedance image slots.
          </p>
        </div>
      )
    },
    {
      id: 'generate',
      icon: Video,
      title: '7. Generate images & video',
      badge: 'TAKES',
      content: (
        <div className="space-y-3 text-[11px]">
          <Step n={1} title="Compile or open Generate">
            Use <strong>Compile</strong> for prompts, then <strong>Generate</strong> (or Generate desk) to call the
            model.
          </Step>
          <Step n={2} title="Keys or credits">
            You need either your own API keys (BYOK in Settings — admins) or managed studio credits. Empty credits block
            managed generate.
          </Step>
          <Step n={3} title="ComfyUI (optional)">
            Advanced: send a Seedance master workflow to local ComfyUI. Set asset folders and video render path first so
            Save Video Clean Name lands in your film’s <code>RENDERS/Video</code> folder.
          </Step>
        </div>
      )
    },
    {
      id: 'folders',
      icon: HardDrive,
      title: '8. Film folders on disk',
      badge: 'ASSETS',
      keywords: 'comfyui asset folders renders project save SWS PROJECTS versioning',
      content: (
        <div className="space-y-3 text-[11px]">
          <p style={{ color: 'var(--sps-muted)' }}>
            On each project card, open <strong>ComfyUI asset folders</strong>:
          </p>
          <ol className="list-decimal pl-4 space-y-1 m-0" style={{ color: 'var(--sps-muted)' }}>
            <li>
              <strong>Fill under film root</strong> — pick a studio folder like Desktop/<code>SWS PROJECTS</code>.
            </li>
            <li>
              SWS creates <code>PROJECT_NAME/ASSETS</code>, <code>RENDERS</code>,{' '}
              <code>PROJECT/Versions</code> and <code>PROJECT/Workflows</code>.
            </li>
            <li>
              <strong>Save &amp; create folders</strong> — makes missing folders and can write a version snapshot.
            </li>
            <li>
              ComfyUI <strong>Download</strong> / <strong>Send</strong> also writes workflow JSON into{' '}
              <code>Workflows</code> when that path (or Project save) is set.
            </li>
          </ol>
          <Callout title="ComfyUI tip">
            Point ComfyUI’s Output Directory at your film’s Video renders folder (or its parent) so absolute save paths
            work.
          </Callout>
        </div>
      )
    },
    {
      id: 'collab',
      icon: Cloud,
      title: '9. Team & cloud',
      badge: 'TOGETHER',
      content: (
        <div className="space-y-3 text-[11px]">
          <p style={{ color: 'var(--sps-muted)' }}>
            Each film has its own room. Presence badges show who is editing. Cloud sync (toolbar) pushes/pulls the room;
            disk Save keeps a local copy.
          </p>
          <p style={{ color: 'var(--sps-muted)' }}>
            <strong>Browser vs Electron:</strong> same studio, same account. Electron is better for folder pickers and
            desktop save. Do not think of localhost as a different “remote user.”
          </p>
        </div>
      )
    },
    {
      id: 'system',
      icon: Monitor,
      title: '10. Computer requirements',
      badge: 'SPECS',
      keywords: 'ram browser chrome electron mac windows gpu',
      content: (
        <div className="space-y-3 text-[11px]">
          <Callout title="Simple recommendation">
            Use a laptop or desktop with <strong>16 GB RAM</strong>, latest <strong>Chrome</strong> or the{' '}
            <strong>Stage Work Studio</strong> desktop app, and a stable internet connection for login and generate.
          </Callout>
          <ul className="list-disc pl-4 space-y-1 m-0" style={{ color: 'var(--sps-muted)' }}>
            <li>Minimum: 8 GB RAM, modern Chrome/Edge/Safari, 1280×720 screen.</li>
            <li>Phones can browse; Matrix and Generate are meant for larger screens.</li>
            <li>3D Stage needs a GPU that supports WebGL 2.</li>
          </ul>
        </div>
      )
    }
  ];

  if (isAdmin) {
    sections.push({
      id: 'admin',
      icon: Settings,
      title: '11. Admin Settings (admins only)',
      badge: 'ADMIN',
      keywords: 'admin settings saas byok keys credits collaborators revoke devices stripe',
      content: (
        <div className="space-y-3 text-[11px]">
          <Callout title="Visible only to studio admins">
            Collaborators do not see this chapter. Open the <strong>gear</strong> in the top bar after signing in as
            admin.
          </Callout>
          <ul className="list-disc pl-4 space-y-2 m-0" style={{ color: 'var(--sps-muted)' }}>
            <li>
              <strong>API keys / BYOK</strong> — store provider keys on this account; keys stay local to the account,
              not sent as user secrets to managed generate when using BYOK path.
            </li>
            <li>
              <strong>SaaS</strong> — plans, credits, device revoke, feature flags (generate / export / collab).
            </li>
            <li>
              <strong>Collaborators</strong> — invite emails, allot projects, Admin vs Editor.
            </li>
            <li>
              <strong>Cloud / rooms</strong> — sync health, invite links.
            </li>
            <li>
              The Admin email (set in Admin Settings) is always Enterprise.
            </li>
          </ul>
        </div>
      )
    });
  }

  return sections;
}

export default function HelpUserGuideModal({ isOpen, onClose, isAdminLoggedIn = false }) {
  const [activeSectionId, setActiveSectionId] = useState('start');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = Boolean(isAdminLoggedIn || isStudioAdmin(getCurrentUserEmail()));

  const sections = useMemo(() => buildGuideSections(isAdmin), [isAdmin]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isAdmin && activeSectionId === 'admin') {
      setActiveSectionId('start');
    }
  }, [isOpen, isAdmin, activeSectionId]);

  if (!isOpen) return null;

  const filteredSections = sections.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const hay = `${s.title} ${s.badge} ${s.keywords || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const activeSection =
    filteredSections.find((s) => s.id === activeSectionId) || filteredSections[0] || sections[0];

  return (
    <div className="sps-overlay">
      <div className="sps-shell sps-atelier-room sps-guide-blue">
        <div className="sps-modal-head">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2 rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-surface)]"
              style={{ color: 'var(--sps-gold)' }}
            >
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="flex items-center gap-2">
                Help &amp; App Guide
                <span className="sps-chip text-[10px] font-mono">v3.0</span>
              </h2>
              <p>
                Plain-language guide for filmmakers
                {isAdmin ? ' · includes Admin chapter' : ' · collaborator view'}
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="sps-icon-btn shrink-0" aria-label="Close help">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-[var(--sps-border)] bg-[var(--sps-bg)] flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--sps-muted)' }} />
            <input
              type="text"
              placeholder="Search: open project, save, version, matrix, generate…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[var(--sps-radius-sm)] pl-9 pr-4 py-1.5 text-xs font-semibold focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[500px]">
          <div className="w-full md:w-64 border-r border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] p-3 space-y-1 overflow-y-auto shrink-0">
            {filteredSections.map((sec) => {
              const IconComp = sec.icon;
              const isActive = activeSection?.id === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`sps-guide-nav w-full p-2.5 rounded-[var(--sps-radius-sm)] text-left text-xs flex items-center justify-between cursor-pointer border ${
                    isActive ? 'is-on font-bold' : 'border-transparent hover:bg-[var(--sps-surface)]'
                  }`}
                  style={{ color: isActive ? 'var(--sps-accent)' : 'var(--sps-text)' }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <IconComp className="w-4 h-4 shrink-0" />
                    <span className="truncate">{sec.title}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sps-muted)' }} />
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-6 overflow-y-auto sps-atelier-pane">
            <div className="flex items-center justify-between border-b border-[var(--sps-border)] pb-3 mb-4">
              <h3
                className="text-sm font-semibold m-0"
                style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}
              >
                {activeSection?.title}
              </h3>
              <span className="sps-chip text-[10px] font-mono">{activeSection?.badge}</span>
            </div>
            {activeSection?.content}
          </div>
        </div>

        <div
          className="p-4 border-t border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between text-xs shrink-0"
          style={{ color: 'var(--sps-muted)' }}
        >
          <span className="font-semibold">Stage Work Studio · Guide v3.0</span>
          <button type="button" onClick={onClose} className="sps-btn sps-btn-primary">
            Close guide
          </button>
        </div>
      </div>
    </div>
  );
}
