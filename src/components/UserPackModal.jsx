import React, { useEffect, useState } from 'react';
import { X, Package, Download, LogOut, Loader2 } from 'lucide-react';
import { getCurrentUserEmail, isStudioOwner } from '../utils/projectPermissions';
import {
  describeUserPack,
  persistLivePackIfActive,
  exportUserPackAndCloseAccount
} from '../utils/userSettingsPack';

export default function UserPackModal({ isOpen, onClose, onAccountClosed }) {
  const [pack, setPack] = useState(() => describeUserPack());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    persistLivePackIfActive();
    setPack(describeUserPack());
    setNote('');
    const refresh = () => setPack(describeUserPack());
    window.addEventListener('sps_user_pack_changed', refresh);
    window.addEventListener('sps_collaborators_updated', refresh);
    return () => {
      window.removeEventListener('sps_user_pack_changed', refresh);
      window.removeEventListener('sps_collaborators_updated', refresh);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const email = pack.email || getCurrentUserEmail();
  const owner = isStudioOwner(email);

  const handleCloseAccount = async () => {
    if (owner) return;
    const go = window.confirm(
      'Export pack & close account?\n\nThis saves your pack settings, BYOK keys, and films you created to a ZIP on this computer, then removes your login.\n\nStudio films allotted to you stay with Admin. Nothing in the studio library is deleted.\n\nContinue?'
    );
    if (!go) return;
    setBusy(true);
    setNote('');
    try {
      const result = await exportUserPackAndCloseAccount(email);
      if (result?.canceled) {
        setNote('Save cancelled — your account is still open.');
        return;
      }
      if (!result?.ok) {
        setNote(result?.error || 'Could not export the pack.');
        return;
      }
      onClose?.();
      onAccountClosed?.();
    } catch (err) {
      setNote(err?.message || 'Could not export the pack.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sps-overlay" onClick={onClose}>
      <div
        className="sps-shell sps-shell-md"
        style={{ height: 'auto', maxHeight: 'min(92dvh, 40rem)', alignSelf: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sps-modal-head">
          <div className="flex items-center gap-2.5 min-w-0">
            <Package className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <h2>My settings pack</h2>
              <p className="truncate">{email || 'Not signed in'}</p>
            </div>
          </div>
          <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close settings pack">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'min(72dvh, 32rem)' }}>
          {owner ? (
            <p className="text-[11px] m-0" style={{ color: 'var(--sps-muted)' }}>
              Studio Owner always uses the studio settings pack. Collaborators get an Independent pack only when you turn it on in Admin Settings.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <span className="sps-chip text-[10px] py-0.5 px-1.5">
                  Independent pack {pack.independentPack ? 'ON' : 'OFF'}
                </span>
                <span className="sps-chip text-[10px] py-0.5 px-1.5">
                  Own library {pack.ownLibrary ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed m-0" style={{ color: 'var(--sps-muted)' }}>
                Admin turns the pack on. OFF parks your engines/theme — films are never deleted.
                Own library lets you create titles and archive only those. Allotted studio films stay Admin-owned.
                {pack.independentPack ? ' Same pack on web and desktop for this email. Comfy URL and folders stay on this device.' : ''}
              </p>

              <div>
                <h3 className="text-[11px] font-bold m-0 mb-1" style={{ color: 'var(--sps-text)' }}>Pack titles you created</h3>
                {pack.packOwnedTitles?.length ? (
                  <ul className="list-disc pl-4 m-0 text-[11px]" style={{ color: 'var(--sps-muted)' }}>
                    {pack.packOwnedTitles.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] m-0" style={{ color: 'var(--sps-muted)' }}>
                    None yet. With Own library ON, New in Project Console creates a pack title.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-[11px] font-bold m-0 mb-1" style={{ color: 'var(--sps-text)' }}>
                  Pack settings {pack.packUpdatedAt ? `· saved ${pack.packUpdatedAt.slice(0, 16).replace('T', ' ')}` : ''}
                </h3>
                <div className="rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] divide-y divide-[var(--sps-border)] max-h-40 overflow-y-auto">
                  {(pack.settings || []).map((row) => (
                    <div key={row.key} className="flex items-start justify-between gap-2 px-2 py-1 text-[10px]">
                      <span style={{ color: 'var(--sps-text)' }}>
                        {row.label}
                        {row.device ? ' · device' : ''}
                      </span>
                      <span className="font-mono truncate max-w-[12rem] text-right" style={{ color: 'var(--sps-muted)' }}>
                        {row.set ? row.preview : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                {pack.byokProviders?.length ? (
                  <p className="text-[10px] mt-1.5 mb-0" style={{ color: 'var(--sps-muted)' }}>
                    BYOK on this email: {pack.byokProviders.join(', ')} (exported to your ZIP, never sent to our backend).
                  </p>
                ) : null}
              </div>

              {note ? (
                <p className="text-[11px] m-0" style={{ color: 'var(--sps-gold)' }}>{note}</p>
              ) : null}

              <button
                type="button"
                className="sps-btn w-full justify-center py-2"
                disabled={busy}
                onClick={handleCloseAccount}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <LogOut className="w-3.5 h-3.5" />
                <span>Export pack & close account</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
