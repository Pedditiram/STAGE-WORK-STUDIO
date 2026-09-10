import React, { useEffect, useState } from 'react';

const SEEN_KEY = 'sps_nav_shortcut_chip_seen_v2';
const FORCE_OPEN_EVENT = 'sps_nav_shortcut_help';

function isDesktop() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 768px)').matches;
}

function hasDismissedChip() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markChipDismissed() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
    localStorage.setItem('sps_nav_shortcut_chip_seen', '1');
  } catch {
    /* ignore */
  }
}

/**
 * Desktop first-run chip: Shift+Space opens Navigator.
 * Reopen via window event `sps_nav_shortcut_help` (header / Project Console ⇧␣).
 * Got it always persists — presentation desk must not pin the chip.
 */
export default function NavigatorShortcutChip({
  hidden = false,
  onOpenNavigator,
  roleHint = '',
}) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!isDesktop()) return false;
    return !hasDismissedChip();
  });
  const [forced, setForced] = useState(false);

  useEffect(() => {
    const onForce = () => {
      if (!isDesktop()) return;
      setForced(true);
      setVisible(true);
    };
    window.addEventListener(FORCE_OPEN_EVENT, onForce);
    return () => window.removeEventListener(FORCE_OPEN_EVENT, onForce);
  }, []);

  useEffect(() => {
    if (hidden) return undefined;
    const sync = () => {
      if (!isDesktop()) {
        setVisible(false);
        setForced(false);
        return;
      }
      if (forced) return;
      if (hasDismissedChip()) setVisible(false);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [hidden, forced]);

  const dismiss = () => {
    markChipDismissed();
    setVisible(false);
    setForced(false);
  };

  if (hidden || !visible || !isDesktop()) return null;

  const line =
    roleHint ||
    (forced ? 'Jump to any room or tool' : 'Go to any room or tool');

  return (
    <aside className="sps-nav-shortcut-chip" role="status" aria-live="polite">
      <div className="sps-nav-shortcut-chip-inner">
        <div className="sps-nav-shortcut-keys" aria-hidden>
          <kbd>⇧ Shift</kbd>
          <span className="sps-nav-shortcut-plus">+</span>
          <kbd>Space</kbd>
        </div>
        <p className="sps-nav-shortcut-copy m-0">
          <strong>Navigator</strong>
          <span>{line}</span>
        </p>
        <div className="sps-nav-shortcut-actions">
          <button
            type="button"
            className="sps-btn sps-btn-primary text-[10px] py-1 px-2"
            onClick={() => {
              dismiss();
              onOpenNavigator?.();
            }}
          >
            Open
          </button>
          <button type="button" className="sps-btn text-[10px] py-1 px-2" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </aside>
  );
}

export function openNavigatorShortcutHelp() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FORCE_OPEN_EVENT));
}

export { FORCE_OPEN_EVENT as NAV_SHORTCUT_HELP_EVENT };
