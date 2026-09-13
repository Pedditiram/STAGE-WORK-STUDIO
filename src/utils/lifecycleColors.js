/**
 * Shared lifecycle colors — real-world traffic palette for clear reading.
 * Draft = grey · Review = red · Approved = green · Locked = blue
 */

export const LIFECYCLE_COLORS = Object.freeze({
  draft: '#6b7280',
  review: '#dc2626',
  approved: '#16a34a',
  locked: '#2563eb'
});

export const LIFECYCLE_PART_DEFS = Object.freeze([
  { key: 'draft', label: 'Draft', color: LIFECYCLE_COLORS.draft },
  { key: 'review', label: 'Review', color: LIFECYCLE_COLORS.review },
  { key: 'approved', label: 'Approved', color: LIFECYCLE_COLORS.approved },
  { key: 'locked', label: 'Locked', color: LIFECYCLE_COLORS.locked }
]);

export function lifecycleColor(status) {
  const s = String(status || 'draft').toLowerCase();
  return LIFECYCLE_COLORS[s] || LIFECYCLE_COLORS.draft;
}
