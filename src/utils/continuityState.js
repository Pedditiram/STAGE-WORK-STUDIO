/**
 * P2 — Character continuity state machine (costume / injury / prop over story time).
 * Shots may carry explicit continuityPatch per CHAR_* id; otherwise bible base state rolls forward.
 */

import { readActiveAssetRegistry, resolveRegistryCharacters } from './assetRegistry';
import { getActiveCharacterProfiles } from './projectBibleVault';
import { resolveShotSpine, readActiveProductionSpine } from './productionSpine';
import { appendCreativeAudit } from './creativeAuditLog';
import { isLifecycleLocked } from './productionLifecycle';

function shotHaystack(shot) {
  return `
    ${shot?.characterIdAssetRef || ''}
    ${shot?.coArtistInteraction || ''}
    ${shot?.characterIdMatrix || ''}
    ${shot?.actionEnvContext || ''}
    ${shot?.sceneSynopsis || ''}
  `.toLowerCase();
}

function matchCharactersLocal(shot, list = getActiveCharacterProfiles()) {
  const hay = shotHaystack(shot);
  if (!hay.trim()) return [];
  return (list || []).filter((char) => {
    const tag = String(char.tag || '').toLowerCase().replace(/@/g, '').trim();
    const name = String(char.name || '').toLowerCase().trim();
    if (tag && hay.includes(tag)) return true;
    if (name && name.length > 2 && hay.includes(name)) return true;
    return false;
  });
}

export const CONTINUITY_FIELDS = Object.freeze(['costume', 'injury', 'prop', 'hair', 'emotion']);

const FIELD_LABELS = Object.freeze({
  costume: 'Costume',
  injury: 'Injury',
  prop: 'Prop',
  hair: 'Hair / makeup',
  emotion: 'Emotion'
});

function clip(s, max = 120) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function emptyContinuityState() {
  return { costume: '', injury: '', prop: '', hair: '', emotion: '' };
}

export function baseStateFromCharacter(char) {
  if (!char) return emptyContinuityState();
  return {
    costume: clip(char.outfit || char.wardrobeElements || '', 160),
    injury: '',
    prop: clip(char.accessories || char.props || '', 120),
    hair: clip(char.makeupAndHairStyle || char.costumeDetails || '', 120),
    emotion: clip(char.psychologicalArchetype || char.characterPsychologyState || '', 80)
  };
}

export function getPatchFromShot(shot, charKey) {
  const patch =
    shot?.continuityPatch?.[charKey] ||
    shot?.continuityStates?.[charKey] ||
    null;
  return patch && typeof patch === 'object' ? patch : null;
}

export function resolveCharacterKeysForShot(shot, registry = null) {
  const reg = registry || readActiveAssetRegistry();
  const assetIds = Array.isArray(shot?.charAssetIds) ? shot.charAssetIds.filter(Boolean) : [];
  if (assetIds.length && reg) {
    return resolveRegistryCharacters(reg, assetIds).map((c) => ({
      key: c.assetId || c.id || c.tag,
      char: c
    }));
  }
  return matchCharactersLocal(shot).map((c) => ({
    key: c.assetId || c.id || c.tag || c.name,
    char: c
  }));
}

export function resolveStateAtShot(charKey, charProfile, shots, shotIndex) {
  let state = baseStateFromCharacter(charProfile);
  for (let i = 0; i <= shotIndex; i++) {
    const patch = getPatchFromShot(shots[i], charKey);
    if (patch) {
      CONTINUITY_FIELDS.forEach((field) => {
        if (patch[field] != null && String(patch[field]).trim()) {
          state[field] = clip(patch[field], 160);
        }
      });
    }
  }
  return state;
}

export function diffContinuityStates(prev, next) {
  return CONTINUITY_FIELDS.filter(
    (field) => clip(prev?.[field]) !== clip(next?.[field]) && clip(next?.[field])
  );
}

export function resolveContinuityForShot({
  shot,
  shots = [],
  shotIndex = 0,
  projectTitle = '',
  spine = null
} = {}) {
  const spineNode = resolveShotSpine(shot, shotIndex, shots, spine || readActiveProductionSpine());
  const entries = resolveCharacterKeysForShot(shot).map(({ key, char }) => {
    const prevState =
      shotIndex > 0
        ? resolveStateAtShot(key, char, shots, shotIndex - 1)
        : baseStateFromCharacter(char);
    const state = resolveStateAtShot(key, char, shots, shotIndex);
    const patch = getPatchFromShot(shot, key);
    const deltas = diffContinuityStates(prevState, state);
    const implicitChange = deltas.length > 0 && !patch;
    return {
      key,
      name: char.name || char.tag || key,
      tag: char.tag || '',
      prevState,
      state,
      patch,
      deltas,
      implicitChange
    };
  });
  return { spineNode, entries };
}

export function continuityStateFlagsForShot(shot, shots, index) {
  const { entries } = resolveContinuityForShot({ shot, shots, shotIndex: index });
  const flags = [];
  entries.forEach((entry) => {
    if (!entry.implicitChange) return;
    flags.push({
      id: `cont_${entry.key}`,
      label: `${entry.name}: ${entry.deltas.map((d) => FIELD_LABELS[d] || d).join(', ')} changed without patch`,
      block: false
    });
  });
  if (index > 0 && entries.some((e) => e.deltas.includes('costume') && !e.patch)) {
    const names = entries.filter((e) => e.deltas.includes('costume') && !e.patch).map((e) => e.name);
    if (names.length) {
      flags.push({
        id: 'cont_costume',
        label: `Costume drift: ${names.join(', ')} — add continuity patch`,
        block: false
      });
    }
  }
  return flags;
}

export function continuityStateLines(shot, shots, index, { projectTitle = '' } = {}) {
  const { spineNode, entries } = resolveContinuityForShot({
    shot,
    shots,
    shotIndex: index,
    projectTitle
  });
  const lines = [];
  if (spineNode?.act) {
    lines.push(
      `SPINE: ${spineNode.actTitle || `Act ${spineNode.act}`} · Seq ${spineNode.sequenceSeq}${spineNode.sequenceTitle ? ` (${spineNode.sequenceTitle})` : ''} · ${spineNode.sceneTag}`
    );
  }
  entries.forEach((entry) => {
    const parts = CONTINUITY_FIELDS.map((field) => {
      const val = clip(entry.state[field]);
      return val ? `${FIELD_LABELS[field]}: ${val}` : '';
    }).filter(Boolean);
    if (parts.length) {
      lines.push(`CONTINUITY ${entry.tag || entry.name}: ${parts.join(' · ')}`);
    }
  });
  return lines;
}

export function applyContinuityPatch(shot, charKey, patch = {}, { projectTitle = '', log = true } = {}) {
  if (!shot || !charKey) return shot;
  if (isLifecycleLocked(shot)) return shot;
  const prev = shot.continuityPatch && typeof shot.continuityPatch === 'object' ? shot.continuityPatch : {};
  const nextPatch = { ...(prev[charKey] || {}), ...patch };
  const continuityPatch = { ...prev, [charKey]: nextPatch };
  if (log) {
    appendCreativeAudit({
      projectTitle,
      category: 'shot',
      action: 'continuity_patch',
      targetType: 'shot',
      targetId: shot.sceneShotId || charKey,
      targetLabel: shot.sceneShotId || charKey,
      note: Object.keys(patch).join(', ')
    });
  }
  return { ...shot, continuityPatch };
}
