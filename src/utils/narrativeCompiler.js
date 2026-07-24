/**
 * Converts a 15-slot shot object into natural narrative cinema prose description.
 */
export function compileNarrativeProse(shot) {
  if (!shot) return '';
  const parts = [];

  // Shot framing & scene ID intro
  if (shot.shotComposition || shot.sceneShotId) {
    const compositionText = shot.shotComposition ? shot.shotComposition.toLowerCase() : 'cinematic shot';
    const sceneText = shot.sceneShotId ? ` (${shot.sceneShotId})` : '';
    parts.push(`A ${compositionText}${sceneText}.`);
  }

  // Camera Motion Dynamics
  if (shot.cameraMotionTag) {
    const cleanCamera = shot.cameraMotionTag.replace(/\[|\]/g, '').replace(/Camera:\s*/i, '');
    parts.push(`The camera glides with ${cleanCamera}.`);
  }

  // Subject ID & Placement
  if (shot.characterIdAssetRef) {
    const cleanChar = shot.characterIdAssetRef.replace(/\[|\]/g, '').replace(/CharID:\s*/i, '');
    const placementText = shot.characterPlacement ? `, positioned ${shot.characterPlacement.toLowerCase()}` : '';
    parts.push(`Featuring ${cleanChar}${placementText}.`);
  } else if (shot.characterPlacement) {
    parts.push(`Positioned ${shot.characterPlacement.toLowerCase()}.`);
  }

  // Artist Movement, Expression & Dialogue
  if (shot.characterMovement) {
    parts.push(`The performing artist ${shot.characterMovement.toLowerCase()}.`);
  }
  if (shot.characterExpression) {
    parts.push(`Exhibiting a ${shot.characterExpression.toLowerCase()} expression.`);
  }
  if (shot.characterDialogue) {
    parts.push(`Delivering lines: "${shot.characterDialogue.replace(/^"|"$/g, '')}".`);
  }

  // Co-Artist Interaction
  if (shot.coArtistInteraction) {
    const cleanCo = shot.coArtistInteraction.replace(/\[|\]/g, '').replace(/Co-Artist:\s*/i, '');
    parts.push(`Alongside co-performers ${cleanCo.toLowerCase()}.`);
  }

  // Environment & Action Context
  if (shot.actionEnvContext) {
    parts.push(`Set against ${shot.actionEnvContext.toLowerCase()}.`);
  }

  // Lighting (Subject & Background)
  const lightingParts = [];
  if (shot.subjectLightingTag) lightingParts.push(shot.subjectLightingTag.replace(/\[|\]/g, '').replace(/Lighting:\s*/i, ''));
  if (shot.backgroundLightingTag) lightingParts.push(shot.backgroundLightingTag.replace(/\[|\]/g, '').replace(/BgLighting:\s*/i, ''));
  if (lightingParts.length > 0) {
    parts.push(`Illuminated by ${lightingParts.join(' and ').toLowerCase()}.`);
  }

  // Color Palette (Subject & Background)
  const colorParts = [];
  if (shot.subjectColorTag) colorParts.push(shot.subjectColorTag.replace(/\[|\]/g, '').replace(/Subject Color:\s*/i, ''));
  if (shot.backgroundColorTag) colorParts.push(shot.backgroundColorTag.replace(/\[|\]/g, '').replace(/BgColor:\s*/i, ''));
  if (colorParts.length > 0) {
    parts.push(`Graded in rich tones of ${colorParts.join(' with ').toLowerCase()}.`);
  }

  // Eye gaze direction
  if (shot.eyeDirectionLook) {
    parts.push(`Gaze directed ${shot.eyeDirectionLook.toLowerCase()}.`);
  }

  return parts.join(' ');
}
