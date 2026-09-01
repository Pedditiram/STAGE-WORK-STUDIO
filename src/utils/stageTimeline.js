/**
 * Shot timeline lanes (spec §17): play / pause / stop / scrub + event tracks.
 */

import { speakingLineAt } from './stageDialogue.js';
import { practicalTimelineLanes } from './stagePracticals.js';

export function buildStageTimeline(plan = {}) {
  const dur = Math.max(0.1, Number(plan.durationSec) || 5);
  const lanes = [];
  const cam = plan.cameras?.[0];
  const camType = cam?.animation?.type || 'static';
  lanes.push({
    id: 'cam',
    kind: 'camera',
    label: `Cam ${camType}`,
    start: 0,
    end: camType === 'static' ? Math.min(0.4, dur) : dur,
    color: '#94a3b8'
  });

  (plan.humans || []).forEach((h, i) => {
    const move = h.movement?.type || 'hold';
    if (move !== 'hold') {
      lanes.push({
        id: `move-${i}`,
        kind: 'move',
        label: `${h.id || 'Char'} ${move}`,
        start: 0,
        end: dur,
        color: '#e8b84a'
      });
    }
    const gaze = h.gaze?.eyeTarget || 'hold';
    if (gaze !== 'hold') {
      lanes.push({
        id: `gaze-${i}`,
        kind: 'gaze',
        label: `${h.id || 'Char'} look ${gaze}`,
        start: 0,
        end: dur,
        color: '#38bdf8'
      });
    }
    const expr = h.expression?.id || 'neutral';
    if (expr !== 'neutral' || h.expression?.inferred) {
      lanes.push({
        id: `expr-${i}`,
        kind: 'expr',
        label: `${h.id || 'Char'} ${expr}`,
        start: 0,
        end: dur,
        color: '#f472b6'
      });
    }
    const inter = h.interaction?.type || 'none';
    if (inter !== 'none') {
      lanes.push({
        id: `ix-${i}`,
        kind: 'interact',
        label: `${h.id || 'Char'} ${inter}`,
        start: 0,
        end: dur,
        color: '#a78bfa'
      });
    }
  });

  (plan.dialogue || []).forEach((d, i) => {
    if (!d?.text) return;
    lanes.push({
      id: `dlg-${i}`,
      kind: 'dialogue',
      label: `${d.speakerId || 'Speaker'}: ${String(d.text).slice(0, 28)}`,
      start: d.start ?? 0,
      end: d.end ?? dur,
      color: '#fbbf24'
    });
  });

  const env = plan.environment;
  const light = plan.lighting;
  if (light?.setup || env?.timeOfDay) {
    lanes.push({
      id: 'light',
      kind: 'light',
      label: light?.setup || env.timeOfDay,
      start: 0,
      end: dur,
      color: '#fb923c'
    });
  }

  lanes.push(...practicalTimelineLanes(plan));

  return { durationSec: dur, lanes };
}

export function timelineSpeakerAt(plan, t) {
  const line = speakingLineAt(plan?.dialogue, t);
  return line?.speakerId || '';
}
