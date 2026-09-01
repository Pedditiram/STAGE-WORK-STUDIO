import React from 'react';
import {
  advanceLifecycle,
  lifecycleMeta,
  normalizeLifecycleStatus,
  stepBackLifecycle,
  unlockLifecycle
} from '../utils/productionLifecycle';

const TONE_CLASS = {
  muted: 'text-[var(--sps-muted)] border-[var(--sps-border)]',
  warn: 'text-amber-600 border-amber-500/50',
  ok: 'text-emerald-600 border-emerald-500/50',
  lock: 'text-[var(--sps-gold)] border-[var(--sps-gold)]/60'
};

/**
 * Compact Draft → Review → Approved → Locked controls for shots / Cast / World.
 */
export default function LifecycleControls({
  entity,
  onChange,
  compact = false,
  disabled = false,
  className = ''
}) {
  if (!entity || !onChange) return null;
  const status = normalizeLifecycleStatus(entity.lifecycleStatus);
  const meta = lifecycleMeta(status);
  const locked = status === 'locked';

  const bump = (result) => {
    if (!result?.ok || !result.entity) return;
    onChange(result.entity);
  };

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span
        className={`inline-flex items-center px-1.5 py-0.5 border text-[9px] font-mono font-bold uppercase tracking-wide ${TONE_CLASS[meta.tone] || TONE_CLASS.muted}`}
        title={`Lifecycle: ${meta.label}`}
      >
        {meta.short}
      </span>
      {!compact && !locked && (
        <button
          type="button"
          disabled={disabled || !meta.prev}
          className="px-1 py-0.5 text-[9px] font-mono border border-[var(--sps-border)] text-[var(--sps-muted)] hover:text-[var(--sps-text)] disabled:opacity-30"
          title="Step back"
          onClick={() => bump(stepBackLifecycle(entity))}
        >
          ←
        </button>
      )}
      {!locked ? (
        <button
          type="button"
          disabled={disabled || !meta.next}
          className="px-1.5 py-0.5 text-[9px] font-mono border border-[var(--sps-border)] text-[var(--sps-text)] hover:border-[var(--sps-gold)] disabled:opacity-30"
          title={meta.next ? `Advance to ${lifecycleMeta(meta.next).label}` : 'Terminal'}
          onClick={() => bump(advanceLifecycle(entity))}
        >
          {compact ? '→' : meta.next ? lifecycleMeta(meta.next).short : '—'}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className="px-1.5 py-0.5 text-[9px] font-mono border border-[var(--sps-gold)]/50 text-[var(--sps-gold)] hover:bg-[var(--sps-gold)]/10 disabled:opacity-30"
          title="Unlock to Approved"
          onClick={() => bump(unlockLifecycle(entity, { to: 'approved' }))}
        >
          Unlock
        </button>
      )}
    </div>
  );
}
