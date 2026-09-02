import React, { useCallback, useEffect, useState } from 'react';
import { getCurrentUserEmail } from '../utils/projectPermissions';
import {
  decideDesktopTrial,
  listDesktopTrialRequests,
  setDesktopReleaseUrl,
} from '../services/desktopTrialClient';

export default function DesktopTrialAdminSection() {
  const actor = getCurrentUserEmail();
  const [rows, setRows] = useState([]);
  const [releaseUrl, setReleaseUrl] = useState('');
  const [meta, setMeta] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await listDesktopTrialRequests(actor);
    if (!data?.success) {
      setNote(data?.error || 'Could not load trial requests.');
      return;
    }
    setRows(Array.isArray(data.requests) ? data.requests : []);
    setReleaseUrl(data.releaseUrl || '');
    setMeta(data);
    setNote('');
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (requestId, action) => {
    setBusy(true);
    setNote('');
    try {
      const data = await decideDesktopTrial({ actor, requestId, action });
      setNote(data?.message || data?.error || '');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveUrl = async () => {
    setBusy(true);
    try {
      const data = await setDesktopReleaseUrl({ actor, releaseUrl });
      setNote(data?.error || (data?.success ? 'Release URL saved. Tokenized downloads will 302 here after approve.' : 'Save failed'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status === 'pending');

  return (
    <div className="p-2.5 rounded-lg border border-amber-500/30 bg-zinc-900/80 space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-amber-400 m-0">Desktop trial requests</p>
      <p className="text-[11px] text-zinc-400 m-0 leading-relaxed">
        Email request → you are notified → Approve emails the same address a tokenized download.
        Do not upload the ~500MB .app to Vercel. Host a GitHub Release (or signed HTTPS URL) and paste it below.
        Local <span className="font-mono">release/mac-arm64/</span> is this machine only.
      </p>
      {meta ? (
        <p className="text-[10px] font-mono text-zinc-500 m-0">
          Inbox {meta.adminInbox || 'pedditiram@gmail.com'}
          {meta.mailConfigured ? ' · Resend on' : ' · Resend off (SPS_RESEND_API_KEY)'}
          {meta.kvConfigured ? ' · KV durable' : ' · KV off (queue is local/fs only)'}
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-zinc-500 uppercase">GitHub Release / HTTPS download URL</span>
        <input
          className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-[11px] font-mono rounded-lg px-2 py-1.5"
          value={releaseUrl}
          onChange={(e) => setReleaseUrl(e.target.value)}
          placeholder="https://github.com/ORG/REPO/releases/download/v1.0.0/Stage-Work-Studio-1.0.0-arm64.dmg"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="sps-btn text-[10px]" disabled={busy} onClick={saveUrl}>
          Save release URL
        </button>
        <button type="button" className="sps-btn text-[10px]" disabled={busy} onClick={load}>
          Refresh queue
        </button>
      </div>

      {pending.length === 0 ? (
        <p className="text-[11px] text-zinc-500 m-0">No pending desktop trial requests.</p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {pending.map((r) => (
            <div key={r.id} className="p-2 rounded-md border border-zinc-800 space-y-1">
              <p className="text-[11px] text-zinc-200 m-0 font-medium">
                {r.name} · {r.email}
              </p>
              <p className="text-[10px] text-zinc-500 m-0">
                {r.org || '—'} · {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
              </p>
              {r.why ? <p className="text-[11px] text-zinc-400 m-0 whitespace-pre-wrap">{r.why}</p> : null}
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="sps-btn sps-btn-primary text-[10px]" disabled={busy} onClick={() => act(r.id, 'approve')}>
                  Approve
                </button>
                <button type="button" className="sps-btn text-[10px]" disabled={busy} onClick={() => act(r.id, 'deny')}>
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.filter((r) => r.status !== 'pending').length ? (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {rows
            .filter((r) => r.status !== 'pending')
            .slice(0, 12)
            .map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-mono text-zinc-500 m-0 truncate">
                  {r.status} · {r.email} · dl {r.downloadCount || 0}
                </p>
                {r.status === 'approved' ? (
                  <button type="button" className="sps-btn text-[9px]" disabled={busy} onClick={() => act(r.id, 'resend')}>
                    Resend
                  </button>
                ) : null}
              </div>
            ))}
        </div>
      ) : null}
      {note ? <p className="text-[11px] text-amber-300 m-0">{note}</p> : null}
    </div>
  );
}
