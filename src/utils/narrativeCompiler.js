/**
 * Converts a 15-slot shot object into natural narrative cinema prose description.
 */
import { getActiveCharacterProfiles } from './projectBibleVault';

export function compileNarrativeProse(shot) {
  if (!shot) return '';
  const muted = shot.mutedSlots || {};
  const parts = [];

  // Shot framing & scene ID intro
  if (!muted.shotComposition && (shot.shotComposition || shot.sceneShotId)) {
    const compositionText = shot.shotComposition ? shot.shotComposition.toLowerCase() : 'cinematic shot';
    const sceneText = (!muted.sceneShotId && shot.sceneShotId) ? ` (${shot.sceneShotId})` : '';
    parts.push(`A ${compositionText}${sceneText}.`);
  }

  // Camera Motion Dynamics
  if (!muted.cameraMotionTag && shot.cameraMotionTag) {
    const cleanCamera = shot.cameraMotionTag.replace(/\[|\]/g, '').replace(/Camera:\s*/i, '');
    parts.push(`The camera glides with ${cleanCamera}.`);
  }

  // Subject ID & Placement with Character & Story lookup BEFORE character ID
  let characterStoryNote = '';
  try {
    const charProfiles = getActiveCharacterProfiles();
    if (Array.isArray(charProfiles)) {
      charProfiles.forEach(c => {
        if (c.tag && (shot.characterIdAssetRef || '').includes(c.tag)) {
          const traits = [];
          if (c.backstory) traits.push(`Story: ${c.backstory}`);
          if (c.characterConnections) traits.push(`Connections: ${c.characterConnections}`);
          if (c.shotPurpose) traits.push(`Purpose: ${c.shotPurpose}`);
          if (c.mannerism) traits.push(`Mannerism: ${c.mannerism}`);
          if (c.walkingStyle) traits.push(`Gait: ${c.walkingStyle}`);
          if (traits.length > 0) {
            characterStoryNote += `[Character & Story: ${traits.join(' | ')}] `;
          }
        }
      });
    }
  } catch (e) {}

  if (characterStoryNote) {
    parts.push(characterStoryNote.trim());
  }

  if (!muted.characterIdAssetRef && shot.characterIdAssetRef) {
    const cleanChar = shot.characterIdAssetRef.replace(/\[|\]/g, '').replace(/CharID:\s*/i, '');
    const placementText = (!muted.characterPlacement && shot.characterPlacement) ? `, positioned ${shot.characterPlacement.toLowerCase()}` : '';
    parts.push(`Featuring ${cleanChar}${placementText}.`);
  } else if (!muted.characterPlacement && shot.characterPlacement) {
    parts.push(`Positioned ${shot.characterPlacement.toLowerCase()}.`);
  }

  // Artist Movement, Expression & Dialogue
  if (!muted.characterMovement && shot.characterMovement) {
    parts.push(`The performing artist ${shot.characterMovement.toLowerCase()}.`);
  }
  if (!muted.characterExpression && shot.characterExpression) {
    parts.push(`Exhibiting a ${shot.characterExpression.toLowerCase()} expression.`);
  }
  if (!muted.characterDialogue && shot.characterDialogue) {
    parts.push(`Delivering lines: "${shot.characterDialogue.replace(/^"|"$/g, '')}".`);
  }

  // Co-Artist Interaction
  if (!muted.coArtistInteraction && shot.coArtistInteraction) {
    const cleanCo = shot.coArtistInteraction.replace(/\[|\]/g, '').replace(/Co-Artist:\s*/i, '');
    parts.push(`Alongside co-performers ${cleanCo.toLowerCase()}.`);
  }

  // Environment & Action Context
  if (!muted.actionEnvContext && shot.actionEnvContext) {
    parts.push(`Set against ${shot.actionEnvContext.toLowerCase()}.`);
  }

  // Lighting (Subject & Background)
  const lightingParts = [];
  if (!muted.subjectLightingTag && shot.subjectLightingTag) lightingParts.push(shot.subjectLightingTag.replace(/\[|\]/g, '').replace(/Lighting:\s*/i, ''));
  if (!muted.backgroundLightingTag && shot.backgroundLightingTag) lightingParts.push(shot.backgroundLightingTag.replace(/\[|\]/g, '').replace(/BgLighting:\s*/i, ''));
  if (lightingParts.length > 0) {
    parts.push(`Illuminated by ${lightingParts.join(' and ').toLowerCase()}.`);
  }

  // Color Palette (Subject & Background)
  const colorParts = [];
  if (!muted.subjectColorTag && shot.subjectColorTag) colorParts.push(shot.subjectColorTag.replace(/\[|\]/g, '').replace(/Subject Color:\s*/i, ''));
  if (!muted.backgroundColorTag && shot.backgroundColorTag) colorParts.push(shot.backgroundColorTag.replace(/\[|\]/g, '').replace(/BgColor:\s*/i, ''));
  if (colorParts.length > 0) {
    parts.push(`Graded in rich tones of ${colorParts.join(' with ').toLowerCase()}.`);
  }

  // Eye gaze direction
  if (!muted.characterEyeLooks && shot.characterEyeLooks) {
    parts.push(`Gaze directed ${shot.characterEyeLooks.replace(/\[|\]/g, '').replace(/Eye Look:\s*/i, '').toLowerCase()}.`);
  }

  return parts.join(' ');
}
