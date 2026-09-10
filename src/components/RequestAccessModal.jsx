import React, { useState } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { isValidEmail } from '../utils/emailValidation';

export default function RequestAccessModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('I would like to request access / sign up for Stage Work Studio.');
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');

    if (!isValidEmail(email)) {
      setError('invalid mail id');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, message, autoReply: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const err = String(data?.error || data?.message || '');
        if (err.toLowerCase().includes('invalid mail id') || err.toLowerCase().includes('valid email')) {
          setError('invalid mail id');
        } else {
          setError(err || 'Could not send the request.');
        }
        return;
      }
      let msg = data?.message || 'Request sent.';
      if (msg.includes('validation_error') || msg.includes('statusCode') || msg.includes('Email delivery failed')) {
        msg = 'Request sent.';
      }
      setDone(msg);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 80 }} onClick={onClose}>
      <div className="sps-shell sps-login-shell" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sps-access-title">
        <div className="sps-modal-head">
          <div className="min-w-0">
            <h2 id="sps-access-title">Sign up</h2>
            <p>Name and email. We reply by mail.</p>
          </div>
          <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form className="sps-modal-body sps-login-body" onSubmit={submit}>
          {error ? <p className="sps-login-note is-warn m-0">{error}</p> : null}
          {done ? (
            <p className="sps-login-note m-0">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--sps-gold)' }} />
              <span>{done}</span>
            </p>
          ) : null}
          <div className="sps-login-form">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            {showMore ? (
              <>
                <label>
                  Role
                  <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Optional" />
                </label>
                <label>
                  Note
                  <input value={message} onChange={(e) => setMessage(e.target.value)} />
                </label>
              </>
            ) : (
              <button type="button" className="sps-login-link is-muted" onClick={() => setShowMore(true)}>
                Add a note
              </button>
            )}
            <button type="submit" className="sps-btn sps-btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{busy ? 'Sending…' : 'Send'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
