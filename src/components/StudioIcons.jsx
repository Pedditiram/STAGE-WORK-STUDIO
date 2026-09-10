/** Cinema marks — distinct silhouettes that read at toolbar size. */
function Mark({ children, size = 16, className = '', title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IconClapper = (p) => (
  <Mark {...p}>
    <rect x="3" y="8" width="18" height="13" />
    <path d="M3 8l4-5h4l-4 5M11 8l4-5h4l-4 5" />
    <path d="M3 13h18" />
  </Mark>
);

/** Stage Work Studio mark — proscenium + slate. */
export const IconStageWorks = (p) => (
  <Mark {...p}>
    <path d="M5 20V8.5L12 3l7 5.5V20" />
    <path d="M5 20h14" />
    <rect x="8" y="10" width="8" height="6" />
    <path d="M8 12.2h8M8 10l1.6-2h4.8L13 10" />
  </Mark>
);

export const IconScript = (p) => (
  <Mark {...p}>
    <path d="M7 3h8l4 4v14H7z" />
    <path d="M15 3v4h4" />
    <path d="M10 12h6M10 16h4" />
  </Mark>
);

export const IconMatrix = (p) => (
  <Mark {...p}>
    <rect x="3" y="4" width="18" height="16" rx="1.2" />
    <path d="M3 8.5h18M9 8.5v11.5M15 8.5v11.5M3 13h18" />
  </Mark>
);

export const IconForm = (p) => (
  <Mark {...p}>
    <rect x="6" y="3" width="12" height="18" rx="1.2" />
    <path d="M9 3.2V2h6v1.2" />
    <circle cx="8.6" cy="9" r="1.1" />
    <path d="M11.2 9h5.2" />
    <circle cx="8.6" cy="13" r="1.1" />
    <path d="M11.2 13h5.2" />
    <circle cx="8.6" cy="17" r="1.1" />
    <path d="M11.2 17h3.6" />
  </Mark>
);

export const IconStage = (p) => (
  <Mark {...p}>
    <path d="M4 19h16" />
    <path d="M6 19V9l6-4 6 4v10" />
    <path d="M12 5v14" />
    <path d="M8 12h8" />
  </Mark>
);

export const IconCast = (p) => (
  <Mark {...p}>
    <circle cx="8" cy="8" r="3.2" />
    <path d="M3 19c.4-3 2.4-5 5-5s4.6 2 5 5" />
    <circle cx="16.5" cy="9" r="2.4" />
    <path d="M13.2 19c.3-2.2 1.7-3.6 3.3-3.6 1.7 0 3.1 1.4 3.5 3.6" />
  </Mark>
);

export const IconWorld = (p) => (
  <Mark {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M4 12h16" />
    <ellipse cx="12" cy="12" rx="3.2" ry="8" />
  </Mark>
);

export const IconLibrary = (p) => (
  <Mark {...p}>
    <rect x="4" y="6" width="16" height="14" />
    <path d="M8 6V4h12v14" />
  </Mark>
);

export const IconCompile = (p) => (
  <Mark {...p}>
    <rect x="3" y="5" width="11" height="14" rx="1" />
    <path d="M14 8h5v12H9" />
    <path d="M6.2 10.2l2 2-2 2" />
  </Mark>
);

export const IconReel = (p) => (
  <Mark {...p}>
    <rect x="3" y="6" width="18" height="12" />
    <path d="M7 6v12M12 6v12M17 6v12M3 10h18M3 14h18" />
  </Mark>
);

export const IconStoryboard = (p) => (
  <Mark {...p}>
    <rect x="2.5" y="7" width="6" height="10" rx="0.8" />
    <rect x="9" y="7" width="6" height="10" rx="0.8" />
    <rect x="15.5" y="7" width="6" height="10" rx="0.8" />
    <path d="M2.5 5h19M2.5 19h19" />
  </Mark>
);

/** Trailer / teaser cuts — not key art. */
export const IconPromo = (p) => (
  <Mark {...p}>
    <path d="M4 9v6h3l6 4V5L7 9H4z" />
    <path d="M16.5 9a3.5 3.5 0 0 1 0 6M19 7.5a6 6 0 0 1 0 9" />
  </Mark>
);

export const IconCampaign = (p) => (
  <Mark {...p}>
    <rect x="5" y="3.5" width="14" height="10" rx="1" />
    <path d="M12 13.5v5.5M8.5 20h7" />
    <path d="M8 7h8M8 10h5" />
  </Mark>
);

export const IconBudget = (p) => (
  <Mark {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.2v9.6" />
    <path d="M9.4 9.4c.7-1 1.8-1.5 3.1-1.5 1.8 0 3 1 3 2.3s-1.1 2.2-3.1 2.2h-1.4c-2 0-3.2 1-3.2 2.4 0 1.4 1.4 2.4 3.3 2.4 1.4 0 2.5-.5 3.2-1.4" />
  </Mark>
);

export const IconUndo = (p) => (
  <Mark {...p}>
    <path d="M8 8H4v4" />
    <path d="M4 10c2-4 6-6 10-6a8 8 0 1 1-1 15.9" />
  </Mark>
);

export const IconRedo = (p) => (
  <Mark {...p}>
    <path d="M16 8h4v4" />
    <path d="M20 10c-2-4-6-6-10-6a8 8 0 1 0 1 15.9" />
  </Mark>
);

/** Studio cloud sync — cloud plus up/down arrows, not a bare cloud. */
export const IconCloud = (p) => (
  <Mark {...p}>
    <path d="M7 17.5h9.8a3.4 3.4 0 0 0 .15-6.8 5.1 5.1 0 0 0-9.8-1.35A3.3 3.3 0 0 0 7 17.5z" />
    <path d="M12 9.6v6.2" />
    <path d="M10 11.4L12 9.4l2 2" />
    <path d="M10 13.8l2 2 2-2" />
  </Mark>
);

/** Google Drive folder — folder + triangle, never a second cloud. */
export const IconDrive = (p) => (
  <Mark {...p}>
    <path d="M3 7.5h6.2l1.8 2.2H21V20H3z" />
    <path d="M12 11.4l2.6 4.5H9.4z" fill="currentColor" stroke="none" />
    <path d="M9.4 15.9L8 18.4h8l-1.4-2.5" />
  </Mark>
);

export const IconDisk = (p) => (
  <Mark {...p}>
    <rect x="4" y="4" width="16" height="16" />
    <rect x="8" y="4" width="8" height="6" />
    <circle cx="12" cy="15" r="2" />
  </Mark>
);

export const IconGear = (p) => (
  <Mark {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Mark>
);

export const IconHelp = (p) => (
  <Mark {...p}>
    <rect x="4" y="4" width="16" height="16" />
    <path d="M9 9.5c0-1.5 1.2-2.5 3-2.5s3 1 3 2.5c0 1.6-3 1.4-3 3.5" />
    <path d="M12 17v.5" />
  </Mark>
);

export const IconChat = (p) => (
  <Mark {...p}>
    <path d="M5 6.2c0-1.2 1-2.2 2.2-2.2h9.6c1.2 0 2.2 1 2.2 2.2v6.2c0 1.2-1 2.2-2.2 2.2H10L6 18.5v-3.9H7.2C6 14.6 5 13.6 5 12.4z" />
  </Mark>
);

export const IconExpand = (p) => (
  <Mark {...p}>
    <path d="M4 10V4h6M20 14v6h-6M14 4h6v6M4 20V14h6" />
  </Mark>
);

export const IconMoon = (p) => (
  <Mark {...p}>
    <path d="M16 4.5A8 8 0 1 0 19.5 16 6.2 6.2 0 0 1 16 4.5z" />
  </Mark>
);

export const IconLock = (p) => (
  <Mark {...p}>
    <rect x="5" y="11" width="14" height="10" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Mark>
);

export const IconDownload = (p) => (
  <Mark {...p}>
    <path d="M12 4v12M7 12l5 5 5-5" />
    <path d="M4 20h16" />
  </Mark>
);

export const IconUpload = (p) => (
  <Mark {...p}>
    <path d="M12 20V8M7 12l5-5 5 5" />
    <path d="M4 20h16" />
  </Mark>
);

export const IconCheck = (p) => (
  <Mark {...p}>
    <path d="M4 13l5 5L20 6" />
  </Mark>
);

export const IconSpark = (p) => (
  <Mark {...p}>
    <path d="M12 3l1.4 6.1L20 12l-6.6 2.9L12 21l-1.4-6.1L4 12l6.6-2.9z" />
  </Mark>
);

export const IconPeople = (p) => (
  <Mark {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19c.5-3.2 2.8-5 6-5s5.5 1.8 6 5" />
    <path d="M16 8h5M18.5 5.5v5" />
  </Mark>
);

export const IconChevronDown = (p) => (
  <Mark {...p}>
    <path d="M6 9l6 6 6-6" />
  </Mark>
);

export const IconChevronUp = (p) => (
  <Mark {...p}>
    <path d="M6 15l6-6 6 6" />
  </Mark>
);

export const IconSync = (p) => (
  <Mark {...p}>
    <path d="M20 8a8 8 0 0 0-14.2-3M4 8V4h4" />
    <path d="M4 16a8 8 0 0 0 14.2 3M20 16v4h-4" />
  </Mark>
);

export const IconBrain = (p) => (
  <Mark {...p}>
    <rect x="5" y="5" width="14" height="14" />
    <path d="M9 9h6M9 12h6M9 15h3" />
  </Mark>
);

export const IconDashboard = (p) => (
  <Mark {...p}>
    <rect x="4" y="4" width="16" height="16" />
    <path d="M4 10h16M10 4v16" />
    <rect x="6" y="12" width="3" height="6" fill="currentColor" stroke="none" />
    <rect x="12" y="8" width="3" height="10" fill="currentColor" stroke="none" />
  </Mark>
);

export const IconNav = (p) => (
  <Mark {...p}>
    <path d="M4 7h16M4 12h16M4 17h11" />
  </Mark>
);
