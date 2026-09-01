import React, { useEffect, useState } from 'react';

const SEEN_KEY = 'sps_nav_shortcut_chip_seen';
const FORCE_OPEN_EVENT = 'sps_nav_shortcut_help';

function isDesktop() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 768px)').matches;
}

/**
 * Desktop first-run chip: Shift+Space opens Navigator.
 * Reopen via window event `sps_nav_shortcut_help` (header / Project Console ⇧␣).
 */
export default function NavigatorShortcutChip({
  hidden = false,
  onOpenNavigator,
  roleHint = ''
}) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (!isDesktop()) return false;
      return localStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return isDesktop();
    }
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
    const onResize = () => {
      if (!isDesktop()) {
        setVisible(false);
        setForced(false);
      } else if (localStorage.getItem(SEEN_KEY) !== '1') {
        setVisible(true);
      }
    };
    window.addEventListener('resize', onResize);
    // After login / Project Console open, re-check once (chip was hidden under Login)
    try {
      if (isDesktop() && localStorage.getItem(SEEN_KEY) !== '1') {
        setVisible(true);
      }
    } catch {
      /* ignore */
    }
    return () => window.removeEventListener('resize', onResize);
  }, [hidden]);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
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
