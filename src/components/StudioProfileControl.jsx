import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, LogOut, Package, Repeat2, UserRound } from 'lucide-react';
import {
  getCurrentUserEmail,
  getCurrentUserProfile,
  getDesignationForEmail,
  isGuestSession,
  isStudioAdmin,
  isStudioOwner
} from '../utils/projectPermissions';
import { collaboratorHasPassword, isOwnerLoginEmail } from '../utils/collaboratorPassword';
import { getLicense, getPlan } from '../utils/saasControl';
import { getUserPackFlags, getPackOwnedTitles } from '../utils/userSettingsPack';
import {
  STUDIO_SWITCH_ACCOUNT_EVENT,
  STUDIO_LOGOUT_EVENT,
  STUDIO_OPEN_LOGIN_EVENT,
  STUDIO_OPEN_PASSWORD_EVENT,
  STUDIO_OPEN_PACK_EVENT,
  STUDIO_PROFILE_MENU_OPEN_EVENT
} from './studioProfileEvents';

export {
  STUDIO_SWITCH_ACCOUNT_EVENT,
  STUDIO_LOGOUT_EVENT,
  STUDIO_OPEN_LOGIN_EVENT,
  STUDIO_OPEN_PASSWORD_EVENT,
  STUDIO_OPEN_PACK_EVENT,
  STUDIO_PROFILE_MENU_OPEN_EVENT
};

function emit(name) {
  try {
    window.dispatchEvent(new CustomEvent(name));
  } catch {
    /* ignore */
  }
}

function readAccount() {
  const email = getCurrentUserEmail() || '';
  const profile = getCurrentUserProfile(email);
  const guest = isGuestSession(email);
  const name = (
    profile?.name
    || (isStudioAdmin(email) ? 'Studio Admin' : '')
    || (email ? email.split('@')[0] : '')
    || (guest ? 'Sign in' : 'Studio')
  ).trim();
  const designation = getDesignationForEmail(email) || profile?.designation || (isStudioAdmin(email) ? 'Lead Director' : '');
  const role = profile?.role || (isStudioAdmin(email) ? 'Admin' : '');
  let planLabel = '';
  try {
    planLabel = getPlan(getLicense(email)?.plan)?.label || '';
  } catch {
    planLabel = '';
  }
  const initial = (name || email || 'S').charAt(0).toUpperCase();
  const packFlags = guest || isStudioOwner(email) ? { independentPack: false, ownLibrary: false } : getUserPackFlags(email);
  const packTitleCount = guest || isStudioOwner(email) ? 0 : getPackOwnedTitles(email).length;
  return { email, name, designation, role, planLabel, guest, initial, packFlags, packTitleCount };
}

/**
 * Compact account control for console chrome.
 * Menu portals to document.body so it never stacks inside translucent header blur
 * (which ghosted Matrix chrome / a second profile).
 */
export default function StudioProfileControl({
  onSwitchAccount,
  onLogout,
  onOpenLogin,
  onOpenChange,
  extraMenu = null,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(readAccount);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const instanceIdRef = useRef(
    `profile_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
  );

  useEffect(() => {
    const refresh = () => setAccount(readAccount());
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('sps_collaborators_updated', refresh);
    window.addEventListener('sps_saas_changed', refresh);
    window.addEventListener('sps_user_pack_changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('sps_collaborators_updated', refresh);
      window.removeEventListener('sps_saas_changed', refresh);
      window.removeEventListener('sps_user_pack_changed', refresh);
    };
  }, []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    const id = instanceIdRef.current;
    const onPeerOpen = (e) => {
      if (e?.detail?.id && e.detail.id !== id) setOpen(false);
    };
    window.addEventListener(STUDIO_PROFILE_MENU_OPEN_EVENT, onPeerOpen);
    return () => window.removeEventListener(STUDIO_PROFILE_MENU_OPEN_EVENT, onPeerOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    try {
      window.dispatchEvent(
        new CustomEvent(STUDIO_PROFILE_MENU_OPEN_EVENT, { detail: { id: instanceIdRef.current } })
      );
    } catch {
      /* ignore */
    }
    return undefined;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const btn = rootRef.current?.querySelector('[aria-haspopup="menu"]');
      const rect = btn?.getBoundingClientRect?.();
      if (!rect) return;
      const gap = 6;
      const width = Math.min(20 * 16, window.innerWidth - 24);
      let right = Math.max(12, window.innerWidth - rect.right);
      if (right + width > window.innerWidth - 12) {
        right = Math.max(12, window.innerWidth - width - 12);
      }
      setMenuPos({
        top: Math.round(rect.bottom + gap),
        right: Math.round(right)
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  const handleSwitch = () => {
    close();
    if (typeof onSwitchAccount === 'function') onSwitchAccount();
    else emit(STUDIO_SWITCH_ACCOUNT_EVENT);
  };

  const handleLogout = () => {
    close();
    if (typeof onLogout === 'function') onLogout();
    else emit(STUDIO_LOGOUT_EVENT);
  };

  const handleLogin = () => {
    close();
    if (typeof onOpenLogin === 'function') onOpenLogin();
    else emit(STUDIO_OPEN_LOGIN_EVENT);
  };

  const handlePassword = () => {
    close();
    emit(STUDIO_OPEN_PASSWORD_EVENT);
  };

  const handlePack = () => {
    close();
    emit(STUDIO_OPEN_PACK_EVENT);
  };

  const canSetPassword = !account.guest && !isOwnerLoginEmail(account.email) && !isStudioAdmin(account.email);
  const canOpenPack = !account.guest;

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
      <>
        <button
          type="button"
          className="sps-console-profile-dismiss"
          onClick={close}
          tabIndex={-1}
          aria-label="Close profile menu"
        />
        <div
          ref={menuRef}
          className="sps-dropdown sps-console-profile-menu is-ported"
          role="menu"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          <div className="sps-dropdown-head flex items-start gap-2.5">
            <span className="sps-avatar mt-0.5 shrink-0" style={{ width: '1.75rem', height: '1.75rem', fontSize: 12 }}>
              {account.initial}
            </span>
            <div className="min-w-0 leading-snug">
              <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--sps-text)' }}>
                {account.guest ? 'Sign in' : account.name}
              </div>
              {account.email ? (
                <div className="text-[10px] font-mono truncate mt-0.5" style={{ color: 'var(--sps-muted)' }}>
                  {account.email}
                </div>
              ) : null}
              {account.designation || account.role || account.planLabel || account.packFlags?.independentPack ? (
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {account.designation ? (
                    <span className="sps-chip text-[9px] py-0 px-1.5">{account.designation}</span>
                  ) : null}
                  {account.role ? (
                    <span className="sps-chip text-[9px] py-0 px-1.5">{account.role}</span>
                  ) : null}
                  {account.planLabel ? (
                    <span className="sps-chip text-[9px] py-0 px-1.5">{account.planLabel}</span>
                  ) : null}
                  {account.packFlags?.independentPack ? (
                    <span className="sps-chip text-[9px] py-0 px-1.5">
                      Pack{account.packFlags.ownLibrary ? ' · library' : ''}{account.packTitleCount ? ` · ${account.packTitleCount}` : ''}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {typeof extraMenu === 'function' ? extraMenu(close) : extraMenu ? <div className="px-2 pt-2">{extraMenu}</div> : null}
          <div className="p-1.5 flex flex-col gap-1">
            {account.guest ? (
              <button
                type="button"
                role="menuitem"
                className="sps-btn text-[10px] w-full justify-start py-1.5"
                onClick={handleLogin}
              >
                <UserRound className="w-3.5 h-3.5" />
                Sign in
              </button>
            ) : (
              <>
                {canSetPassword ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="sps-btn text-[10px] w-full justify-start py-1.5"
                    onClick={handlePassword}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {collaboratorHasPassword(getCurrentUserProfile(account.email)) ? 'Change password' : 'Create my password'}
                  </button>
                ) : null}
                {canOpenPack ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="sps-btn text-[10px] w-full justify-start py-1.5"
                    onClick={handlePack}
                  >
                    <Package className="w-3.5 h-3.5" />
                    My settings pack
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="sps-btn text-[10px] w-full justify-start py-1.5"
                  onClick={handleSwitch}
                >
                  <Repeat2 className="w-3.5 h-3.5" />
                  Switch
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="sps-btn text-[10px] w-full justify-start py-1.5"
                  onClick={handleLogout}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </>,
      document.body
    )
    : null;

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 sps-console-profile ${open ? 'is-open' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className={`sps-icon-btn ${open ? 'is-on' : ''}`}
        title={account.email || account.name || 'Account'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account profile"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAccount(readAccount());
          setOpen((v) => !v);
        }}
      >
        <span className="sps-avatar">{account.initial}</span>
      </button>
      {menu}
    </div>
  );
}
