import React, { useEffect, useState } from 'react';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { IconDrive } from './StudioIcons';
import { getCurrentUserEmail, isGuestSession } from '../utils/projectPermissions';
import {
  clearProjectDriveShare,
  getProjectDriveShare,
  hasProjectDriveShare,
  saveProjectDriveShare,
} from '../utils/projectDriveLinks';
import { DEFAULT_ROOT_NAME, getStudioDriveAccessEmail } from '../services/googleDriveVault';

export default function HeaderDriveMenu({ project, lookOnly = false, quiet = false }) {
  const title = project?.title || '';
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [linked, setLinked] = useState(() => hasProjectDriveShare(title));

  const load = () => {
    const rec = getProjectDriveShare(title);
    setUrl(rec.url || '');
    setEmail(getStudioDriveAccessEmail() || rec.email || getCurrentUserEmail() || '');
    setLinked(Boolean(rec.url));
  };

  useEffect(() => {
    load();
    const sync = () => load();
    window.addEventListener('sps_google_drive_changed', sync);
    return () => window.removeEventListener('sps_google_drive_changed', sync);
  }, [title]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSave = () => {
    const accessEmail = getStudioDriveAccessEmail() || email;
    const rec = saveProjectDriveShare(title, { url, email: accessEmail });
    setEmail(accessEmail);
    setLinked(Boolean(rec.url));
    setNotice(rec.url ? `Saved Drive link for ${accessEmail || 'this project'}.` : 'Connect Drive to create SWS Projects, or paste a folder link.');
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Drive link copied.');
    } catch {
      setNotice(url);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={quiet ? `sps-quiet-link ${linked || open ? '' : 'is-muted'}` : `sps-icon-btn ${linked || open ? 'is-on' : ''}`}
        title={title ? `Google Drive link — ${title}` : 'Google Drive link'}
        aria-label="Google Drive link for this project"
        aria-expanded={open}
        disabled={lookOnly}
        onClick={() => setOpen((v) => !v)}
      >
        {quiet ? 'Drive' : <IconDrive className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[45]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="absolute right-0 top-full mt-2 z-[60] w-[min(100vw-1.5rem,22rem)] rounded-xl border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] p-3 space-y-2 shadow-lg"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <p className="m-0 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--sps-gold)' }}>
              Drive link · {title || 'This project'}
            </p>
            <p className="m-0 text-[11px] leading-relaxed" style={{ color: 'var(--sps-muted)' }}>
              Connect creates <strong>{DEFAULT_ROOT_NAME}</strong> in Google Drive. Access is your signed-in studio email.
            </p>
            <label className="block">
              <span className="text-[10px]" style={{ color: 'var(--sps-muted)' }}>Google Drive link</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Created automatically in SWS Projects"
                className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-mono"
                style={{ borderColor: 'var(--sps-border)', background: 'var(--sps-surface)', color: 'var(--sps-text)' }}
              />
            </label>
            <div className="block">
              <span className="text-[10px]" style={{ color: 'var(--sps-muted)' }}>Access</span>
              <p
                className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-mono m-0 truncate"
                style={{ borderColor: 'var(--sps-border)', background: 'var(--sps-surface)', color: 'var(--sps-text)' }}
                title={email || 'Sign in first'}
              >
                {email || (isGuestSession() ? 'Sign in to use Drive' : '—')}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="sps-btn sps-btn-primary text-[11px]" onClick={handleSave}>
                <Link2 className="w-3.5 h-3.5" />
                Save
              </button>
              <button type="button" className="sps-btn text-[11px]" onClick={handleCopy} disabled={!url}>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
              {url ? (
                <a className="sps-btn text-[11px]" href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </a>
              ) : null}
              {url ? (
                <button type="button" className="sps-btn text-[11px]" onClick={() => { clearProjectDriveShare(title); setUrl(''); setNotice('Link cleared.'); }}>
                  Clear
                </button>
              ) : null}
            </div>
            {notice ? <p className="m-0 text-[11px]" style={{ color: 'var(--sps-gold)' }}>{notice}</p> : null}
          </div>
        </>
      )}
    </div>
  );
}
