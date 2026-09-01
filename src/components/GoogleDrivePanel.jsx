import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, HardDrive, Loader2, Link2, LogOut, RefreshCw, Share2, Upload } from 'lucide-react';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getDriveAccountEmail,
  getDriveClientId,
  getDrivePathLabel,
  getDriveRootFolderId,
  getDriveRootFolderName,
  getProjectDrivePath,
  isDriveConnected,
  listDriveProjects,
  pullProjectFromDrive,
  pushProjectToDrive,
  explainDriveClientIdError,
  setDriveClientId,
  setDriveRootFolderId,
  setDriveRootFolderName,
  shareDriveFile,
} from '../services/googleDriveVault';

export default function GoogleDrivePanel({
  compact = false,
  currentProject,
  onPullProject,
}) {
  const [clientId, setClientId] = useState(getDriveClientId);
  const [rootName, setRootName] = useState(getDriveRootFolderName);
  const [rootId, setRootId] = useState(getDriveRootFolderId);
  const [pathLabel, setPathLabel] = useState(getDrivePathLabel);
  const [email, setEmail] = useState(getDriveAccountEmail);
  const [connected, setConnected] = useState(isDriveConnected);
  const [busy, setBusy] = useState('');
  const [files, setFiles] = useState([]);
  const [notice, setNotice] = useState('');

  const refreshStatus = useCallback(() => {
    setClientId(getDriveClientId());
    setRootName(getDriveRootFolderName());
    setRootId(getDriveRootFolderId());
    setPathLabel(currentProject?.title ? getProjectDrivePath(currentProject.title) : getDrivePathLabel());
    setEmail(getDriveAccountEmail());
    setConnected(isDriveConnected());
  }, [currentProject?.title]);

  useEffect(() => {
    refreshStatus();
    const onChange = () => refreshStatus();
    window.addEventListener('sps_google_drive_changed', onChange);
    return () => window.removeEventListener('sps_google_drive_changed', onChange);
  }, [refreshStatus]);

  const loadFiles = async () => {
    setBusy('list');
    setNotice('');
    try {
      const list = await listDriveProjects(currentProject || null);
      setFiles(list);
      setConnected(true);
      setEmail(getDriveAccountEmail());
      setPathLabel(currentProject?.title ? getProjectDrivePath(currentProject.title) : getDrivePathLabel());
    } catch (err) {
      setNotice(err.message || 'Could not list Drive files.');
    } finally {
      setBusy('');
    }
  };

  const handleConnect = async () => {
    const idError = explainDriveClientIdError(clientId);
    if (idError) {
      setNotice(idError);
      return;
    }
    setDriveClientId(clientId);
    setDriveRootFolderName(rootName);
    setDriveRootFolderId(rootId);
    setBusy('connect');
    setNotice('');
    try {
      const nextEmail = await connectGoogleDrive(currentProject || null);
      setEmail(nextEmail);
      setConnected(true);
      const path = currentProject?.title ? getProjectDrivePath(currentProject.title) : getDrivePathLabel();
      setPathLabel(path);
      setNotice(`Folder ready: ${path}`);
      await loadFiles();
    } catch (err) {
      setNotice(err.message || 'Google Drive sign-in failed.');
    } finally {
      setBusy('');
    }
  };

  const handlePush = async () => {
    if (!currentProject) {
      setNotice('Open a project in the library first.');
      return;
    }
    setBusy('push');
    setNotice('');
    try {
      const file = await pushProjectToDrive(currentProject);
      setNotice(`Saved to ${currentProject?.title ? getProjectDrivePath(currentProject.title) : getDrivePathLabel()}: ${file.name}`);
      await loadFiles();
    } catch (err) {
      setNotice(err.message || 'Upload failed.');
    } finally {
      setBusy('');
    }
  };

  const handlePull = async (fileId) => {
    setBusy(fileId);
    setNotice('');
    try {
      const project = await pullProjectFromDrive(fileId);
      onPullProject?.(project);
      setNotice(`Loaded “${project.title}” into the local library.`);
    } catch (err) {
      setNotice(err.message || 'Download failed.');
    } finally {
      setBusy('');
    }
  };

  const handleShare = async (fileId) => {
    setBusy(`share-${fileId}`);
    setNotice('');
    try {
      const file = await shareDriveFile(fileId);
      const link = file.webViewLink || '';
      if (link && navigator.clipboard) await navigator.clipboard.writeText(link);
      setNotice(link ? `Share link copied: ${link}` : 'Anyone-with-link access is on.');
      await loadFiles();
    } catch (err) {
      setNotice(err.message || 'Share failed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-zinc-950/80 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-300 m-0 flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5" />
            Google Drive
          </p>
          <p className="text-[11px] text-zinc-400 m-0 mt-1 leading-relaxed">
            OAuth Client ID setup is on hold (task: google credentials). For now, paste a Drive share link on the toolbar cloud icon — one link per project, with the user’s Gmail.
          </p>
        </div>
        {connected ? (
          <span className="text-[10px] font-mono text-emerald-300 shrink-0 text-right max-w-[14rem]">
            {pathLabel || email || 'Connected'}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-zinc-500 shrink-0 flex items-center gap-1">
            <HardDrive className="w-3 h-3" /> Local only
          </span>
        )}
      </div>

      {compact && !clientId ? (
        <p className="text-[11px] text-zinc-400 m-0">
          Add a Google OAuth Client ID in Settings → Cloud, then connect here. Local files stay on this machine.
        </p>
      ) : null}

      {!compact && (
        <div className="space-y-2">
          <label className="block">
            <span className="text-[10px] text-zinc-500 font-mono">OAuth Client ID — not a Gmail address</span>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              onBlur={() => setDriveClientId(clientId)}
              placeholder="123456789-xxxx.apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-200"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block leading-relaxed">
              Google Cloud Console → APIs &amp; Services → Credentials → Create OAuth client → type <strong>Web application</strong>. Copy the Client ID that ends with <span className="text-zinc-300">.apps.googleusercontent.com</span>. Add {typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5173'} under Authorized JavaScript origins.
            </span>
          </label>
          <label className="block">
            <span className="text-[10px] text-zinc-500 font-mono">Drive location folder name</span>
            <input
              type="text"
              value={rootName}
              onChange={(e) => setRootName(e.target.value)}
              onBlur={() => setDriveRootFolderName(rootName)}
              placeholder="Stage Work Studio"
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-200"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-zinc-500 font-mono">Or existing Drive folder ID (optional)</span>
            <input
              type="text"
              value={rootId}
              onChange={(e) => setRootId(e.target.value)}
              onBlur={() => setDriveRootFolderId(rootId)}
              placeholder="Leave blank to auto-create the location in My Drive"
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-200"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block leading-relaxed">
              Connect creates the location, a user folder, then a dedicated folder for the open project. Packs save only in that project folder.
            </span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {!connected ? (
          <button type="button" className="sps-btn sps-btn-primary text-[11px]" onClick={handleConnect} disabled={!!busy}>
            {busy === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Connect Google Drive
          </button>
        ) : (
          <>
            <button type="button" className="sps-btn text-[11px]" onClick={loadFiles} disabled={!!busy}>
              {busy === 'list' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>
            <button type="button" className="sps-btn sps-btn-primary text-[11px]" onClick={handlePush} disabled={!!busy || !currentProject}>
              {busy === 'push' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Push this project
            </button>
            <button type="button" className="sps-btn text-[11px]" onClick={() => { disconnectGoogleDrive(); setFiles([]); refreshStatus(); }}>
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </>
        )}
      </div>

      {notice ? <p className="text-[11px] text-amber-200 m-0 leading-relaxed">{notice}</p> : null}

      {files.length > 0 && (
        <ul className="m-0 p-0 list-none space-y-1.5 max-h-52 overflow-y-auto">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[11px] font-semibold text-zinc-100 truncate">{file.name}</p>
                <p className="m-0 text-[10px] text-zinc-500 font-mono">
                  {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : ''}
                </p>
              </div>
              <button type="button" className="sps-btn text-[10px]" onClick={() => handlePull(file.id)} disabled={!!busy}>
                Open
              </button>
              <button type="button" className="sps-btn text-[10px]" onClick={() => handleShare(file.id)} disabled={!!busy} title="Anyone with the link can view">
                <Share2 className="w-3 h-3" />
              </button>
              {file.webViewLink ? (
                <a className="sps-btn text-[10px]" href={file.webViewLink} target="_blank" rel="noreferrer">
                  Drive
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
