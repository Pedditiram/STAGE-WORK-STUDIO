import React, { useMemo } from 'react';
import { lifecycleSummary } from '../utils/productionLifecycle';

/**
 * Persistent thin progress rail at the bottom of the app.
 * Segments = live shot lifecycle mix (draft → review → approved → locked).
 * Updates as collaborators advance/lock shots.
 */
export default function ProjectProgressRail({
  shots = [],
  projectTitle = '',
  hidden = false
}) {
  const summary = useMemo(() => {
    const live = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived && !s?.isMuted);
    return lifecycleSummary(live);
  }, [shots]);

  if (hidden) return null;

  const total = summary.total || 0;
  const lockedPct = total ? Math.round((summary.locked / total) * 100) : 0;
  const donePct = total
    ? Math.round(((summary.approved + summary.locked) / total) * 100)
    : 0;

  const parts = [
    { key: 'draft', n: summary.draft || 0, color: 'color-mix(in srgb, var(--sps-muted) 55%, var(--sps-border))' },
    { key: 'review', n: summary.review || 0, color: 'color-mix(in srgb, #c4a574 85%, var(--sps-border))' },
    { key: 'approved', n: summary.approved || 0, color: 'var(--sps-success)' },
    { key: 'locked', n: summary.locked || 0, color: 'var(--sps-gold)' }
  ];

  const title = [
    projectTitle || 'Untitled',
    total
      ? `${donePct}% approved+locked · ${lockedPct}% locked · ${total} live`
      : 'No live shots',
    `Draft ${summary.draft || 0}`,
    `Review ${summary.review || 0}`,
    `Approved ${summary.approved || 0}`,
    `Locked ${summary.locked || 0}`
  ].join(' · ');

  return (
    <div
      className="sps-project-progress-rail"
      role="progressbar"
      aria-label="Project shot progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={donePct}
      title={title}
    >
      {total === 0 ? (
        <span className="sps-project-progress-rail__empty" />
      ) : (
        parts.map((p) =>
          p.n > 0 ? (
            <span
              key={p.key}
              className="sps-project-progress-rail__seg"
              style={{
                flexGrow: p.n,
                background: p.color
              }}
            />
          ) : null
        )
      )}
    </div>
  );
}
