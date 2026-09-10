import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { reloadStudioForUpdate, snoozeStudioUpdate } from '../utils/studioUpdateCheck';

export default function StudioUpdateModal({ isOpen, serverBuildId = '', onSnooze }) {
  if (!isOpen) return null;

  const later = () => {
    snoozeStudioUpdate(serverBuildId);
    onSnooze?.();
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 95 }} role="dialog" aria-modal="true" aria-labelledby="sps-studio-update-title">
      <div
        className="sps-shell sps-shell-md"
        style={{ height: 'auto', maxHeight: 'min(90dvh, 22rem)', alignSelf: 'center' }}
      >
        <div className="sps-modal-head">
          <div>
            <h2 id="sps-studio-update-title">Studio updated</h2>
            <p>A new version of Stage Work Studio is ready on this site.</p>
          </div>
          <button type="button" className="sps-icon-btn" onClick={later} aria-label="Remind me later">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[12px] leading-relaxed m-0" style={{ color: 'var(--sps-muted)' }}>
            Refresh to load it. Your films stay on this computer and in the cloud. Unsaved text in an open field may be lost — save first if you need to.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="sps-btn sps-btn-primary" onClick={reloadStudioForUpdate}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh now
            </button>
            <button type="button" className="sps-btn" onClick={later}>
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
