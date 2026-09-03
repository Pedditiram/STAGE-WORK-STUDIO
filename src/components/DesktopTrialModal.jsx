/**
 * Public form: request a desktop trial. Download is issued only after owner approve.
 */
import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, Monitor } from 'lucide-react';
import { LINE, PRODUCT } from '../constants/brand';
import { requestDesktopTrial } from '../services/desktopTrialClient';

export default function DesktopTrialModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [why, setWhy] = useState('I would like a Mac desktop trial of Stage Work Studio.');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    try {
      const data = await requestDesktopTrial({ name, email, org, why });
      if (!data?.success) {
        setError(data?.error || 'Could not queue the request.');
        return;
      }
      setDone(data.message || 'Request queued for the studio admin.');
    } catch {
      setError('Network error. Stay in the app and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 82 }} onClick={onClose}>
      <div
        className="sps-shell sps-modal-panel max-w-md w-full"
        style={{ alignSelf: 'center' }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="sps-modal-head">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] m-0" style={{ color: 'var(--sps-gold)' }}>{PRODUCT}</p>
            <h3 className="text-sm font-semibold m-0 font-display" style={{ color: 'var(--sps-text)' }}>
              Download desktop trial
            </h3>
          </div>
          <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form className="p-4 space-y-3" onSubmit={submit}>
          <p className="text-[12px] m-0" style={{ color: 'var(--sps-muted)' }}>
            Request with your email. The owner is notified, then you get a personal download link after they approve.
            The Mac app is not hosted on this website (~500MB) — the link is issued only after approval.
          </p>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--sps-muted)' }}>Name</span>
            <input
              className="w-full rounded-lg px-2.5 py-2 text-sm bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[var(--sps-text)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--sps-muted)' }}>Email</span>
            <input
              type="email"
              className="w-full rounded-lg px-2.5 py-2 text-sm bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[var(--sps-text)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--sps-muted)' }}>Why / org (optional)</span>
            <input
              className="w-full rounded-lg px-2.5 py-2 text-sm bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[var(--sps-text)]"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="Studio, production company…"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--sps-muted)' }}>Note (optional)</span>
            <textarea
              rows={3}
              className="w-full rounded-lg px-2.5 py-2 text-sm bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[var(--sps-text)]"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
            />
          </label>
          {error ? <p className="text-[12px] m-0 text-red-400">{error}</p> : null}
          {done ? (
            <p className="text-[12px] m-0 flex items-center gap-1.5" style={{ color: 'var(--sps-gold)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> {done}
            </p>
          ) : null}
          <button type="submit" className="sps-btn sps-btn-primary w-full text-xs" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
            {busy ? 'Sending…' : `Request from ${LINE.split('—')[0].trim()}`}
          </button>
        </form>
      </div>
    </div>
  );
}
