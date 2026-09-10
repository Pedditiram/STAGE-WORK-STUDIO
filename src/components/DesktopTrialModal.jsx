/**
 * Public form: request a desktop trial. Download is issued only after owner approve.
 */
import React, { useState } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { requestDesktopTrial } from '../services/desktopTrialClient';
import { isValidEmail } from '../utils/emailValidation';

export default function DesktopTrialModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [why, setWhy] = useState('I would like to download the Stage Work Studio app.');
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
      const data = await requestDesktopTrial({ name, email, org, why });
      if (!data?.success) {
        const err = String(data?.error || '');
        if (err.toLowerCase().includes('invalid mail id') || err.toLowerCase().includes('valid email')) {
          setError('invalid mail id');
        } else {
          setError(err || 'Could not queue the request.');
        }
        return;
      }
      let msg = data?.message || 'Request received. We will email a download link after review.';
      if (typeof msg === 'string' && (msg.includes('validation_error') || msg.includes('statusCode') || msg.startsWith('{'))) {
        msg = 'Request received. We will email a download link after review.';
      }
      setDone(msg);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 82 }} onClick={onClose}>
      <div className="sps-shell sps-login-shell" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sps-trial-title">
        <div className="sps-modal-head">
          <div className="min-w-0">
            <h2 id="sps-trial-title">Download app</h2>
            <p>We email a link after review.</p>
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
                  Studio
                  <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Optional" />
                </label>
                <label>
                  Note
                  <input value={why} onChange={(e) => setWhy(e.target.value)} />
                </label>
              </>
            ) : (
              <button type="button" className="sps-login-link is-muted" onClick={() => setShowMore(true)}>
                Add a note
              </button>
            )}
            <button type="submit" className="sps-btn sps-btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{busy ? 'Sending…' : 'Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
