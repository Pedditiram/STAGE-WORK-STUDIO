import React, { useState } from 'react';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { LINE, PRODUCT } from '../constants/brand';

export default function RequestAccessModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('I would like to request access / sign up for Stage Work Studio.');
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
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.success) {
        setError(data?.error || 'Could not send the request.');
        return;
      }
      setDone(data?.message || 'Request sent from Stage Work Studio.');
    } catch {
      setError('Network error. Stay in the app and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 80 }} onClick={onClose}>
      <div
        className="sps-shell sps-modal-panel max-w-md w-full"
        style={{ alignSelf: 'center' }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="sps-modal-head">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] m-0" style={{ color: 'var(--sps-gold)' }}>{PRODUCT}</p>
            <h3 className="text-sm font-semibold m-0 font-display" style={{ color: 'var(--sps-text)' }}>Request access</h3>
          </div>
          <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form className="p-4 space-y-3" onSubmit={submit}>
          <p className="text-[12px] m-0" style={{ color: 'var(--sps-muted)' }}>
            Stage Work Studio sends this to the owner. Mail stays inside the app — no external mail client.
          </p>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--sps-muted)' }}>Name</span>
            <input className="w-full rounded-lg px-2.5 py-2 text-sm bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[var(--sps-text)]" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--sps-muted)' }}>Email</span>
            <input type="email" className="w-full rounded-lg px-2.5 py-2 text-sm bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[var(--sps-text)]" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--sps-muted)' }}>Studio / role</span>
            <input className="w-full rounded-lg px-2.5 py-2 text-sm bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[var(--sps-text)]" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Director, producer, investor…" />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--sps-muted)' }}>Message</span>
            <textarea rows={4} className="w-full rounded-lg px-2.5 py-2 text-sm bg-[var(--sps-surface)] border border-[var(--sps-border)] text-[var(--sps-text)]" value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          {error ? <p className="text-[12px] m-0 text-red-400">{error}</p> : null}
          {done ? (
            <p className="text-[12px] m-0 flex items-center gap-1.5" style={{ color: 'var(--sps-gold)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> {done}
            </p>
          ) : null}
          <button type="submit" className="sps-btn sps-btn-primary w-full text-xs" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? 'Sending…' : `Send from ${LINE.split('—')[0].trim()}`}
          </button>
        </form>
      </div>
    </div>
  );
}
