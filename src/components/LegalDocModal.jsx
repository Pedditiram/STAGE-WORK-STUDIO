import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { LEGAL_UPDATED, PRIVACY_SECTIONS, TERMS_SECTIONS } from '../utils/legalDocs';

export default function LegalDocModal({ kind, onClose }) {
  const isPrivacy = kind === 'privacy';
  const title = isPrivacy ? 'Privacy' : 'Terms of use';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  useEffect(() => {
    if (!kind) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kind, onClose]);

  if (!kind || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,7,6,0.72)', pointerEvents: 'auto' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border p-5 space-y-3"
        style={{
          background: 'var(--sps-surface, #141210)',
          borderColor: 'var(--sps-border, #3a342c)',
          color: 'var(--sps-text, #f4ecde)'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="sps-legal-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sps-legal-title" className="text-sm font-bold m-0 font-display">{title}</h2>
            <p className="text-[10px] m-0 mt-1" style={{ color: 'var(--sps-muted)' }}>Updated {LEGAL_UPDATED}</p>
          </div>
          <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {sections.map((s) => (
          <section key={s.title}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider m-0 mb-1" style={{ color: 'var(--sps-gold)' }}>
              {s.title}
            </h3>
            <p className="text-[12px] leading-relaxed m-0" style={{ color: 'var(--sps-muted)' }}>{s.body}</p>
          </section>
        ))}
        <p className="text-[10px] m-0 pt-1">
          Also at{' '}
          <a href={isPrivacy ? '/privacy.html' : '/terms.html'} className="underline" style={{ color: 'var(--sps-gold)' }}>
            {isPrivacy ? 'privacy.html' : 'terms.html'}
          </a>
        </p>
      </div>
    </div>,
    document.body
  );
}
