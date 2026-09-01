/**
 * Dialogue staging (spec §9). Speaker / listener / timing + viseme lip-sync.
 */

import { applyLipSyncToPose } from './stageLipSync.js';

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

export function defaultDialogueLine() {
  return {
    speakerId: '',
    listenerId: '',
    text: '',
    start: 0,
    end: 0,
    eyeTarget: 'listener',
    bodyOrientation: 'listener',
    expressionId: '',
    gesture: '',
    inferred: false,
    needsDirection: true
  };
}

export function normalizeDialogueLine(raw, durationSec = 5) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const dur = Math.max(1, Number(durationSec) || 5);
  let start = clamp(r.start ?? 0, 0, dur);
  let end = clamp(r.end ?? dur, 0, dur);
  if (end < start) end = start;
  return {
    speakerId: String(r.speakerId || ''),
    listenerId: String(r.listenerId || ''),
    text: String(r.text || '').trim(),
    start,
    end,
    eyeTarget: r.eyeTarget || 'listener',
    bodyOrientation: r.bodyOrientation || 'listener',
    expressionId: String(r.expressionId || ''),
    gesture: String(r.gesture || ''),
    inferred: !!r.inferred,
    needsDirection: r.needsDirection != null ? !!r.needsDirection : !String(r.text || '').trim()
  };
}

function stripDialogueLabel(s) {
  return String(s || '')
    .replace(/\[Dialogue:\s*/i, '')
    .replace(/\]/g, '')
    .trim();
}

function namedHuman(humans, blob) {
  const t = String(blob || '').toLowerCase();
  return (humans || []).find((h) => {
    const id = String(h?.id || '').toLowerCase();
    return id && t.includes(id);
  }) || null;
}

export function inferDialogue(shot = {}, humans = [], durationSec = 5) {
  const raw = stripDialogueLabel(shot.characterDialogue || shot.dialogue || '');
  const dur = Math.max(1, Number(durationSec) || 5);
  if (!raw) {
    return [];
  }
  const speaker = namedHuman(humans, raw) || humans[0];
  const listener = (humans || []).find((h) => h && h.id !== speaker?.id) || null;
  const words = raw.split(/\s+/).filter(Boolean).length;
  const span = clamp(0.45 + words * 0.28, 1.2, Math.max(1.4, dur - 0.4));
  const start = 0.35;
  const end = Math.min(dur - 0.15, start + span);
  return [
    normalizeDialogueLine(
      {
        speakerId: speaker?.id || '',
        listenerId: listener?.id || '',
        text: raw,
        start,
        end,
        eyeTarget: listener ? 'listener' : 'hold',
        bodyOrientation: listener ? 'listener' : 'hold',
        inferred: true,
        needsDirection: false
      },
      dur
    )
  ];
}

export function speakingLineAt(dialogue = [], t = 0) {
  const lines = Array.isArray(dialogue) ? dialogue : [];
  return lines.find((d) => d?.text && t >= d.start && t <= d.end) || null;
}

export function applySpeakMouth(pose = {}, t = 0, isSpeaking = false, line = null) {
  if (!isSpeaking) return pose;
  if (line?.text) return applyLipSyncToPose(pose, line, t);
  const flap = 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(t * 14));
  return {
    ...pose,
    viseme: 'AA',
    mouthOpen: Math.max(pose.mouthOpen || 0, flap),
    jaw: Math.max(pose.jaw || 0, 0.08)
  };
}
