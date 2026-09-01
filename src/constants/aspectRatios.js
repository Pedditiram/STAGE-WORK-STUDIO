/** Shared frame aspect options for Stage Production Studio / 3D Stage. */
export const ASPECT_RATIO_OPTIONS = [
  { id: '21:9', label: '21:9', subtitle: 'Ultrawide · default', value: '21:9 Ultrawide', numeric: 21 / 9 },
  { id: '2.39:1', label: '2.39:1', subtitle: 'Anamorphic cinema', value: '2.39:1 Anamorphic', numeric: 2.39 },
  { id: '2.35:1', label: '2.35:1', subtitle: 'Scope', value: '2.35:1', numeric: 2.35 },
  { id: '2:1', label: '2:1', subtitle: 'Univisium', value: '2:1', numeric: 2 },
  { id: '16:9', label: '16:9', subtitle: 'HD / broadcast', value: '16:9', numeric: 16 / 9 },
  { id: '4:3', label: '4:3', subtitle: 'Classic TV', value: '4:3', numeric: 4 / 3 },
  { id: '1:1', label: '1:1', subtitle: 'Square', value: '1:1', numeric: 1 },
  { id: '9:16', label: '9:16', subtitle: 'Vertical / Reels', value: '9:16', numeric: 9 / 16 },
];

export const DEFAULT_ASPECT_RATIO = '21:9 Ultrawide';

/** Spec §19 Director Stage frames (plus SWS 21:9 / 2.35 in the full list). */
export const DIRECTOR_STAGE_ASPECT_IDS = ['16:9', '2.39:1', '2:1', '4:3', '1:1', '9:16'];

export function parseAspectNumeric(aspectRatio) {
  const s = String(aspectRatio || '');
  const hit = ASPECT_RATIO_OPTIONS.find(
    (o) => o.value === s || o.id === s || s.startsWith(o.id)
  );
  if (hit) return hit.numeric;
  if (/2\.39|anamorphic/i.test(s)) return 2.39;
  if (/2\.35/.test(s)) return 2.35;
  if (/\b2\s*:\s*1\b/.test(s) && !/21\s*:\s*9/.test(s)) return 2;
  if (/21\s*:\s*9|ultrawide/i.test(s)) return 21 / 9;
  if (/9\s*:\s*16|vertical|portrait|reel/i.test(s)) return 9 / 16;
  if (/1\s*:\s*1|square/i.test(s)) return 1;
  if (/4\s*:\s*3/.test(s)) return 4 / 3;
  if (/3\s*:\s*4/.test(s)) return 3 / 4;
  if (/16\s*:\s*9/.test(s)) return 16 / 9;
  const m = s.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w > 0 && h > 0) return w / h;
  }
  return 21 / 9;
}
