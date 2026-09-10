import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, Copy, ExternalLink, Link2, Loader2, Upload } from 'lucide-react';
import { getCurrentUserEmail, isGuestSession } from '../utils/projectPermissions';
import {
  clearProjectDriveShare,
  getProjectDriveShare,
  hasProjectDriveShare,
  saveProjectDriveShare,
} from '../utils/projectDriveLinks';
import {
  DEFAULT_ROOT_NAME,
  connectGoogleDrive,
  explainDriveClientIdError,
  getDriveClientId,
  getProjectDrivePath,
  getStudioDriveAccessEmail,
  isDriveConnected,
  pushProjectToDrive,
} from '../services/googleDriveVault';

/**
 * Per-project Google Drive — dedicated folder link + optional OAuth push for this title only.
 */
export default function ProjectDrivePanel({ project, guestLook = false, onPullProject }) {
  const title = project?.title || '';
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [linked, setLinked] = useState(false);
  const [connected, setConnected] = useState(isDriveConnected);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    const rec = getProjectDriveShare(title);
    setUrl(rec.url || '');
    setEmail(getStudioDriveAccessEmail() || rec.email || getCurrentUserEmail() || '');
    setLinked(Boolean(rec.url));
    setConnected(isDriveConnected());
  }, [title]);

  useEffect(() => {
    load();
    const sync = () => load();
    window.addEventListener('sps_google_drive_changed', sync);
    return () => window.removeEventListener('sps_google_drive_changed', sync);
  }, [load]);

  if (!title || guestLook) return null;

  if (!open) {
    return (
      <button type="button" className="sps-quiet-link is-muted self-start" onClick={() => setOpen(true)}>
        Drive{linked || connected ? ' · linked' : ''}
      </button>
    );
  }

  const clientId = getDriveClientId();
  const drivePath = getProjectDrivePath(title);

  const handleSaveLink = () => {
    const accessEmail = getStudioDriveAccessEmail() || email;
    const rec = saveProjectDriveShare(title, { url, email: accessEmail });
    setEmail(accessEmail);
    setLinked(Boolean(rec.url));
    setNotice(rec.url ? `Drive link saved for ${title}.` : 'Connect Drive to create SWS Projects, or paste a folder link.');
    window.setTimeout(() => setNotice(''), 3200);
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Link copied.');
    } catch {
      setNotice(url);
    }
    window.setTimeout(() => setNotice(''), 2600);
  };

  const handleConnect = async () => {
    const idError = explainDriveClientIdError(clientId);
    if (idError) {
      setNotice(idError);
      return;
    }
    setBusy('connect');
    setNotice('');
    try {
      const accessEmail = await connectGoogleDrive(project);
      const rec = getProjectDriveShare(title);
      setUrl(rec.url || '');
      setEmail(accessEmail || getStudioDriveAccessEmail());
      setLinked(Boolean(rec.url));
      setConnected(true);
      setNotice(`Folder ready: ${DEFAULT_ROOT_NAME} / ${accessEmail || 'you'} / ${title}`);
    } catch (err) {
      setNotice(err.message || 'Google Drive sign-in failed.');
    } finally {
      setBusy('');
      window.setTimeout(() => setNotice(''), 4000);
    }
  };

  const handlePush = async () => {
    setBusy('push');
    setNotice('');
    try {
      const file = await pushProjectToDrive(project);
      setNotice(`Pushed to ${drivePath}: ${file.name}`);
    } catch (err) {
      setNotice(err.message || 'Upload failed.');
    } finally {
      setBusy('');
      window.setTimeout(() => setNotice(''), 4000);
    }
  };

  return (
    <div className="sps-project-drive border border-slate-200/90 dark:border-white/[0.07] bg-slate-50/80 dark:bg-black/25 px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500 dark:text-zinc-500 m-0 flex items-center gap-1.5">
          <Cloud className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sps-gold)' }} />
          Google Drive · {title}
        </p>
        <button type="button" className="sps-quiet-link is-muted" onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>

      <p className="text-[9px] text-slate-500 dark:text-zinc-400 m-0 leading-snug hidden sm:block">
        Connect creates <strong>{DEFAULT_ROOT_NAME}</strong> in Google Drive. Access is your signed-in studio email.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block min-w-0">
          <span className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-zinc-500">Drive link</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Created automatically in SWS Projects"
            className="mt-0.5 w-full sps-input-premium bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono px-2 py-1.5"
          />
        </label>
        <div className="block min-w-0">
          <span className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-zinc-500">Access</span>
          <p className="mt-0.5 w-full sps-input-premium bg-white/70 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono px-2 py-1.5 m-0 truncate" title={email || 'Sign in first'}>
            {email || (isGuestSession() ? 'Sign in to use Drive' : '—')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {clientId && !connected ? (
          <button type="button" className="sps-btn sps-btn-primary text-[10px]" onClick={handleConnect} disabled={!!busy}>
            {busy === 'connect' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
            Create SWS Projects
          </button>
        ) : null}
        {clientId && connected ? (
          <button type="button" className="sps-btn sps-btn-primary text-[10px]" onClick={handlePush} disabled={!!busy}>
            {busy === 'push' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Push project
          </button>
        ) : null}
        <button type="button" className="sps-btn text-[10px]" onClick={handleSaveLink}>
          <Link2 className="w-3 h-3" />
          Save link
        </button>
        <button type="button" className="sps-btn text-[10px]" onClick={handleCopy} disabled={!url}>
          <Copy className="w-3 h-3" />
          Copy
        </button>
        {url ? (
          <a className="sps-btn text-[10px]" href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
        ) : null}
        {url ? (
          <button
            type="button"
            className="sps-btn text-[10px]"
            onClick={() => {
              clearProjectDriveShare(title);
              setUrl('');
              setLinked(false);
              setNotice('Link cleared.');
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {notice ? <p className="text-[10px] m-0 text-amber-700 dark:text-amber-300/90 leading-snug">{notice}</p> : null}
    </div>
  );
}
