/**
 * SHOT DIRECTOR DATA (spec §2) + prompt sync (§20) + continuity (§22) + validation (§31).
 */

import { parseSceneAndShotID } from './sceneShotUtils.js';
import { shotPromptBlob, parsePromptCamera } from './stagePromptCamera.js';

export function buildShotDirectorData({
  shot = {},
  plan = {},
  shotIndex = 0,
  projectTitle = '',
  previousShotId = '',
  promptSynced = false
} = {}) {
  const ids = parseSceneAndShotID(shot, shotIndex);
  const cam = plan.cameras?.[0] || {};
  const blob = shotPromptBlob(shot);
  const parsedCam = parsePromptCamera(blob);
  const hasStage = Array.isArray(plan.humans) && plan.humans.length && (cam.position || cam.focalMm || plan.focalMm);
  return {
    shotId: ids.shortId || shot.sceneShotId || `Shot_${shotIndex + 1}`,
    sceneId: ids.sceneStr || '',
    sequenceId: '',
    duration: plan.durationSec || Number(shot.durationSec) || 5,
    environment: plan.environment || {},
    characters: (plan.humans || []).map((h) => ({
      name: h.id,
      charAssetId: h.charAssetId || '',
      figureSource: h.figureSource || 'mannequin',
      glbUrl: h.glbUrl || '',
      position: h.position,
      rotation: h.rotation || [0, h.rotationY || 0, 0],
      scale: h.scale || [1, 1, 1],
      movement: h.movement,
      gaze: h.gaze,
      expression: h.expression,
      interaction: h.interaction,
      eyeTarget: h.gaze?.eyeTarget,
      headDirection: h.gaze?.headDirection,
      bodyDirection: h.gaze?.bodyDirection
    })),
    camera: {
      position: cam.position,
      lookAt: cam.lookAt,
      focalLength: cam.focalMm || plan.focalMm,
      sensor: cam.sensorWidthMm,
      aperture: cam.aperture || plan.aperture,
      focusDistance: cam.focusDistance,
      movement: cam.animation
    },
    composition: {
      shotSize: parsedCam.shotSize,
      framing: plan.framingNote || shot.shotComposition || ''
    },
    lighting: plan.lighting || {},
    props: plan.props || [],
    dialogue: plan.dialogue || [],
    continuity: {
      previousShotId: previousShotId || '',
      matched: !!plan.continuityMatched
    },
    generation: {
      comfyLinked: !!hasStage
    },
    originalVideoPrompt: String(shot.stageVideoPrompt || shot.videoPrompt || blob).slice(0, 4000),
    promptSynced: !!promptSynced,
    planSource: plan.source || 'stage'
  };
}

/** Restore a Stage plan from saved SHOT DIRECTOR DATA (autosave round-trip). */
export function planFromDirectorStage(data, fallbackPlan = {}) {
  if (!data || !Array.isArray(data.characters) || !data.characters.length) return null;
  const cam0 = fallbackPlan.cameras?.[0] || {};
  return {
    ...fallbackPlan,
    durationSec: data.duration || fallbackPlan.durationSec || 5,
    environment: data.environment || fallbackPlan.environment,
    lighting: data.lighting && data.lighting.setup ? data.lighting : fallbackPlan.lighting,
    props: Array.isArray(data.props) && data.props.length ? data.props : fallbackPlan.props,
    dialogue: Array.isArray(data.dialogue) ? data.dialogue : fallbackPlan.dialogue,
    framingNote: data.composition?.framing || fallbackPlan.framingNote,
    humans: data.characters.map((c, i) => {
      const fb = fallbackPlan.humans?.[i] || {};
      return {
        ...fb,
        id: c.name || fb.id || `Human ${i + 1}`,
        charAssetId: c.charAssetId || fb.charAssetId || '',
        figureSource: c.figureSource || fb.figureSource || 'mannequin',
        glbUrl: c.glbUrl || fb.glbUrl || '',
        position: Array.isArray(c.position) ? c.position : fb.position,
        rotation: Array.isArray(c.rotation) ? c.rotation : fb.rotation,
        rotationY: Array.isArray(c.rotation) ? c.rotation[1] : fb.rotationY,
        scale: c.scale || fb.scale,
        movement: c.movement || fb.movement,
        gaze: c.gaze || fb.gaze,
        expression: c.expression || fb.expression,
        interaction: c.interaction || fb.interaction,
        pose: fb.pose,
        keyframes: fb.keyframes
      };
    }),
    cameras: [
      {
        ...cam0,
        position: data.camera?.position || cam0.position,
        lookAt: data.camera?.lookAt || cam0.lookAt,
        focalMm: data.camera?.focalLength || cam0.focalMm,
        sensorWidthMm: data.camera?.sensor || cam0.sensorWidthMm,
        aperture: data.camera?.aperture || cam0.aperture,
        focusDistance: data.camera?.focusDistance || cam0.focusDistance,
        animation: data.camera?.movement || cam0.animation
      }
    ],
    focalMm: data.camera?.focalLength || fallbackPlan.focalMm,
    aperture: data.camera?.aperture || fallbackPlan.aperture,
    source: 'directorStage',
    continuityMatched: !!data.continuity?.matched
  };
}

export function validateShotDirectorData(data = {}) {
  const warnings = [];
  const note = (ok, label) => {
    if (!ok) warnings.push(label);
  };
  note(data.camera && (data.camera.position || data.camera.focalLength), 'Camera defined');
  note(data.camera?.focalLength, 'Lens defined');
  note(data.duration, 'Duration defined');
  note(Array.isArray(data.characters) && data.characters.length, 'Characters staged');
  note(data.lighting && data.lighting.setup, 'Lighting rig defined');
  const moved = (data.characters || []).some((c) => c.movement?.type && c.movement.type !== 'hold');
  const moveNeed = (data.characters || []).some((c) => c.movement?.needsDirection);
  if (!moved && moveNeed) warnings.push('Character movement defined');
  note(data.camera?.movement?.type, 'Camera movement defined');
  const eyes = (data.characters || []).some((c) => c.gaze?.eyeTarget && c.gaze.eyeTarget !== 'hold');
  if (!eyes) warnings.push('Eye direction defined');
  const dlg = (data.dialogue || []).filter((d) => d.text);
  if (!dlg.length) warnings.push('Dialogue timing defined');
  const ix = (data.characters || []).some((c) => c.interaction?.type && c.interaction.type !== 'none');
  if (!ix) warnings.push('Interaction defined');
  if (!data.promptSynced) warnings.push('Prompt synchronized');
  if (!data.generation?.comfyLinked) warnings.push('ComfyUI workflow linked');
  note(data.shotId, 'Project path available');
  return {
    ok: true,
    blocking: [],
    warnings,
    message: warnings.length
      ? `Optional gaps: ${warnings.join('; ')}`
      : 'Stage data ready for export'
  };
}

/** Explicit Update Video Prompt — never applied silently. */
export function composeVideoPromptFromDirectorData(data = {}) {
  const chars = (data.characters || [])
    .map((c) => {
      const bits = [c.name];
      if (c.movement?.type && c.movement.type !== 'hold') bits.push(c.movement.type.replace(/_/g, ' '));
      if (c.gaze?.eyeTarget && c.gaze.eyeTarget !== 'hold') bits.push(`looks ${c.gaze.eyeTarget}`);
      if (c.expression?.id && c.expression.id !== 'neutral') bits.push(c.expression.id);
      if (c.interaction?.type && c.interaction.type !== 'none') bits.push(c.interaction.type.replace(/_/g, ' '));
      return bits.join(', ');
    })
    .filter(Boolean);
  const cam = data.camera || {};
  const move = cam.movement?.type && cam.movement.type !== 'static' ? cam.movement.type.replace(/_/g, ' ') : 'hold';
  const dlg = (data.dialogue || [])
    .filter((d) => d.text)
    .map((d) => `${d.speakerId}: "${d.text}"`)
    .join(' ');
  const env = data.environment?.setId || data.environment?.timeOfDay || '';
  return [
    chars.join('. '),
    env ? `Set: ${env}${data.environment?.timeOfDay ? `, ${data.environment.timeOfDay}` : ''}.` : '',
    `Camera ${cam.focalLength || 35}mm, ${move}.`,
    data.composition?.framing || '',
    dlg
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Copy blocking from previous plan unless the new shot explicitly changes it.
 */
export function matchPreviousStagePlan(prevPlan, nextPlan, nextShot = {}) {
  if (!prevPlan?.humans?.length || !nextPlan) return { ...nextPlan, continuityMatched: false };
  const blob = shotPromptBlob(nextShot).toLowerCase();
  const reloc = /cut to|new location|different set|int\.|ext\./.test(blob);
  const humans = (nextPlan.humans || []).map((h, i) => {
    const prev = prevPlan.humans[i];
    if (!prev) return h;
    if (/walk|approach|cross|turn/.test(blob)) return h;
    return {
      ...h,
      position: [...(prev.position || h.position)],
      rotationY: prev.rotationY ?? h.rotationY,
      rotation: prev.rotation ? [...prev.rotation] : h.rotation
    };
  });
  const environment = reloc ? nextPlan.environment : { ...(prevPlan.environment || {}), ...(nextPlan.environment || {}) };
  return {
    ...nextPlan,
    humans,
    environment,
    continuityMatched: true,
    source: nextPlan.source || 'continuity'
  };
}
