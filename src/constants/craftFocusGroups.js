/** Matrix + Form share the same Focus groups. */
export const CRAFT_FOCUS_GROUPS = [
  { id: 'all', label: 'All', keys: [] },
  { id: 'camera', label: 'Camera', keys: ['sceneShotId', 'sceneSynopsis', 'shotComposition', 'cameraMotionTag', 'lensAndFocalLength'] },
  { id: 'lighting', label: 'Light', keys: ['timeAndLightingEnv', 'directionalLightingAndHighlight', 'subjectLightingTag', 'subjectColorTag', 'backgroundLightingTag', 'backgroundColorTag', 'colorPaletteSlot'] },
  { id: 'vfx', label: 'Atmosphere', keys: ['atmosphereVolumetricsTag'] },
  { id: 'character', label: 'Performance', keys: ['characterIdAssetRef', 'coArtistInteraction', 'actionEnvContext', 'characterExpression', 'characterPsychologyState', 'characterMannerismAndPosture', 'characterPlacement', 'characterDialogue', 'characterMovement', 'characterEyeLooks'] },
  { id: 'audio_optics', label: 'Audio', keys: ['shotDurationAndImages', 'soundFxAndFoley', 'backgroundScoreMood'] }
];

export function craftKeysForFocusGroup(groupId) {
  const group = CRAFT_FOCUS_GROUPS.find((c) => c.id === groupId);
  if (!group || group.id === 'all') return null;
  return new Set(group.keys);
}

export function craftInFocusGroup(fieldKey, groupId) {
  const keys = craftKeysForFocusGroup(groupId);
  if (!keys) return true;
  return keys.has(fieldKey);
}

export function focusGroupIdForCraft(fieldKey) {
  const group = CRAFT_FOCUS_GROUPS.find((c) => c.id !== 'all' && c.keys.includes(fieldKey));
  return group?.id || 'all';
}
