/**
 * SWS Workflow Contract 1.0 — SWS-owned spec, not ComfyUI JSON.
 * PDF sections 4-6, 22-23.
 */

import { parseSceneAndShotID } from './sceneShotUtils';
import { composeModelPrompt } from './comfyPromptComposer';
import { getActiveCharacterProfiles, getActiveWorldAssets } from './projectBibleVault';
import { getSeedanceStillModel, getSeedanceVideoModel } from '../services/seedanceModels';
import { SWS_WORKFLOW_TEMPLATES, isVideoTemplate, isImageTemplate } from './swsComfyTemplates';
import {
  SWS_WORKFLOW_CONTRACT_VERSION,
  SWS_COMFY_PACKAGE_NAME,
  SWS_COMFY_PACKAGE_VERSION,
  SWS_APP_VERSION,
  SWS_PROVIDERS,
  isProviderImplemented
} from './swsComfyConstants';

export {
  SWS_WORKFLOW_CONTRACT_VERSION,
  SWS_COMFY_PACKAGE_NAME,
  SWS_COMFY_PACKAGE_VERSION,
  SWS_APP_VERSION,
  SWS_PROVIDERS,
  isProviderImplemented
};

export function slugWorkflowPart(value, fallback = 'item') {
  const s = String(value || '')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  return s || fallback;
}

export function parseShotDurationSec(shot, fallback = 5) {
  const raw = String(shot?.shotDurationAndImages || shot?.shotDuration || '');
  const m = raw.match(/(\d+(?:\.\d+)?)\s*(s|sec|secs|second)/i) || raw.match(/\b(\d+(?:\.\d+)?)\s*s\b/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return Math.min(12, Math.max(1, Math.round(n)));
  }
  return fallback;
}

function splitIds(raw) {
  return String(raw || '')
    .split(/[,;|/]+/)
    .map((x) => x.replace(/^@/, '').trim())
    .filter(Boolean);
}

function firstLookUrl(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return String(
    entry.lookUrl || entry.imageUrl || entry.portrait || entry.plate || entry.refUrl || entry.url || ''
  ).trim();
}

function pickCharacters(shot) {
  const profiles = typeof window !== 'undefined' ? getActiveCharacterProfiles() : [];
  const ids = [
    ...(Array.isArray(shot?.charAssetIds) ? shot.charAssetIds : []),
    ...splitIds(shot?.characterIdAssetRef)
  ].map((x) => String(x).toLowerCase());
  const matched = profiles.filter((c) => {
    const keys = [c.assetId, c.id, c.tag, c.name].map((x) => String(x || '').toLowerCase());
    return keys.some((k) => k && ids.some((id) => id.includes(k) || k.includes(id)));
  });
  const list = matched.length ? matched : profiles.slice(0, 1);
  return list.map((c) => ({
    characterId: c.assetId || c.id || c.tag || c.name || '',
    characterName: c.name || c.tag || '',
    characterDescription: c.backstory || c.outline || '',
    costume: c.outfit || c.costumeDetails || '',
    appearance: [c.mannerism, c.walkingStyle].filter(Boolean).join('; '),
    continuityData: c.continuityNotes || '',
    characterReference: firstLookUrl(c),
    assetId: c.assetId || ''
  }));
}

function pickLocations(shot) {
  const worlds = typeof window !== 'undefined' ? getActiveWorldAssets() : [];
  const ids = [
    ...(Array.isArray(shot?.worldAssetIds) ? shot.worldAssetIds : []),
    ...splitIds(shot?.actionEnvContext)
  ].map((x) => String(x).toLowerCase());
  const matched = worlds.filter((w) => {
    const keys = [w.assetId, w.id, w.name, w.title, w.location].map((x) => String(x || '').toLowerCase());
    return keys.some((k) => k && ids.some((id) => id.includes(k) || k.includes(id)));
  });
  const list = matched.length ? matched : worlds.filter((w) => w && w.includeInPrompt !== false).slice(0, 1);
  return list.map((w) => ({
    locationId: w.assetId || w.id || w.name || '',
    locationName: w.name || w.title || w.location || '',
    description: w.description || w.prompt || '',
    continuityData: w.continuityNotes || '',
    referenceImages: [firstLookUrl(w)].filter(Boolean),
    assetId: w.assetId || ''
  }));
}

function collectReferences(shot, characters, locations) {
  const refs = [];
  const push = (assetId, url, kind) => {
    const u = String(url || '').trim();
    if (!u) return;
    refs.push({
      assetId: assetId || kind,
      assetUrl: u.startsWith('http') ? u : '',
      localPath: u.startsWith('http') ? '' : u,
      kind
    });
  };
  characters.forEach((c) => push(c.assetId || c.characterId, c.characterReference, 'character'));
  locations.forEach((l) => (l.referenceImages || []).forEach((u) => push(l.assetId || l.locationId, u, 'location')));
  if (shot?.lockedStillUrl) push(shot.sceneShotId, shot.lockedStillUrl, 'keyframe');
  if (shot?.firstFrameUrl) push(String(shot.sceneShotId || '') + '_first', shot.firstFrameUrl, 'first_frame');
  if (shot?.lastFrameUrl) push(String(shot.sceneShotId || '') + '_last', shot.lastFrameUrl, 'last_frame');
  if (shot?.sourceVideoUrl) push(String(shot.sceneShotId || '') + '_src', shot.sourceVideoUrl, 'source_video');
  return refs;
}

export function inferWorkflowTemplate({ mode = 'video', shot } = {}) {
  if (mode === 'still' || mode === 'image') {
    if (shot?.lockedStillUrl || shot?.firstFrameUrl) return 'image_keyframe';
    if ((shot?.charAssetIds || []).length) return 'image_character_consistency';
    if ((shot?.worldAssetIds || []).length) return 'image_environment';
    return 'image_text_to_image';
  }
  // PDF Matrix → ComfyUI: Seedance 2.0 master is the default video path
  return 'video_seedance2_master';
}

export function buildSwsWorkflowContract({
  shot = {},
  shotIndex = 0,
  projectTitle = '',
  sceneId = '',
  workflowType = '',
  provider = SWS_PROVIDERS.BYTEPLUS,
  model = '',
  duration,
  width = 1920,
  height = 1080,
  fps = 24,
  seed = -1,
  negativePrompt = '',
  promptOverride = '',
  systemInstruction = ''
} = {}) {
  const parsed = parseSceneAndShotID(shot, shotIndex);
  const shotId = parsed.shortId || shot.sceneShotId || ('SC01_SH' + String(shotIndex + 1).padStart(2, '0'));
  const scene = sceneId || parsed.sceneStr || ('SC' + String(parsed.sceneNum || 1).padStart(2, '0'));
  const ds = shot.directorStage || {};
  const dsCam = ds.camera || {};
  const composed = composeModelPrompt({
    shot,
    shotIndex,
    projectTitle,
    shots: [shot],
    promptOverride,
    negativePrompt: String(negativePrompt || shot.negativePrompt || '').trim(),
    systemInstruction: String(systemInstruction || shot.systemInstruction || '').trim()
  });
  const prompt = String(composed.prompt || '').trim();
  const neg = String(composed.negativePrompt || '').trim();
  const sys = String(composed.systemInstruction || '').trim();
  const templateId = workflowType || inferWorkflowTemplate({ mode: 'video', shot });
  const template = SWS_WORKFLOW_TEMPLATES[templateId];
  const providerId = isProviderImplemented(provider) ? provider : SWS_PROVIDERS.BYTEPLUS;
  const characters = pickCharacters(shot);
  const locations = pickLocations(shot);
  const references = collectReferences(shot, characters, locations);
  const dur = Number(duration) > 0 ? Number(duration) : parseShotDurationSec(shot, 5);
  const video = isVideoTemplate(templateId);
  const modelId = String(model || '').trim() || (video ? getSeedanceVideoModel() : getSeedanceStillModel());

  return {
    swsWorkflowVersion: SWS_WORKFLOW_CONTRACT_VERSION,
    projectId: String(projectTitle || '').trim() || 'untitled',
    sceneId: scene,
    shotId,
    workflowType: templateId,
    templateVersion: template?.templateVersion || '1.0.0',
    provider: providerId,
    model: modelId,
    prompt,
    negativePrompt: neg,
    promptSource: composed.source || '',
    systemInstruction: sys,
    providerParameters: {
      duration: dur,
      width: Number(width) || 1920,
      height: Number(height) || 1080,
      fps: Number(fps) || 24,
      seed: Number.isFinite(Number(seed)) ? Number(seed) : -1,
      ratio: Number(width) === 1080 && Number(height) === 1920 ? '9:16' : '16:9'
    },
    inputs: {
      prompt,
      negativePrompt: neg,
      systemInstruction: sys,
      referenceImage: references[0]?.assetUrl || references[0]?.localPath || '',
      duration: dur,
      width: Number(width) || 1920,
      height: Number(height) || 1080,
      fps: Number(fps) || 24,
      seed: Number.isFinite(Number(seed)) ? Number(seed) : -1
    },
    shot: {
      shotId,
      sceneId: scene,
      sequenceId: '',
      characterIds: characters.map((c) => c.characterId).filter(Boolean),
      locationId: locations[0]?.locationId || '',
      action: String(shot.characterMovement || shot.actionEnvContext || '').trim(),
      performance: String(shot.characterExpression || '').trim(),
      dialogue: String(shot.characterDialogue || '').trim(),
      shotType: String(shot.shotComposition || '').trim(),
      cameraAngle: String(shot.characterPlacement || '').trim(),
      cameraMovement: String(dsCam.movement?.type || shot.cameraMotionTag || '').replace(/\[|\]/g, '').trim(),
      lens: String(dsCam.focalLength != null ? `${dsCam.focalLength}mm` : shot.lensAndFocalLength || '').trim(),
      focalLength: String(dsCam.focalLength != null ? dsCam.focalLength : shot.lensAndFocalLength || '').trim(),
      composition: String(shot.shotComposition || '').trim(),
      framing: String(shot.shotComposition || '').trim(),
      lighting: String(shot.subjectLightingTag || shot.directionalLightingAndHighlight || '').replace(/\[|\]/g, '').trim(),
      timeOfDay: String(shot.timeAndLightingEnv || '').trim(),
      weather: String(shot.atmosphereVolumetricsTag || '').replace(/\[|\]/g, '').trim(),
      visualStyle: String(shot.colorPaletteSlot || shot.subjectColorTag || '').replace(/\[|\]/g, '').trim(),
      colorStyle: String(shot.subjectColorTag || '').replace(/\[|\]/g, '').trim()
    },
    characters,
    locations,
    references,
    camera: {
      shotType: String(ds.composition?.shotSize || shot.shotComposition || '').trim(),
      cameraAngle: String(shot.characterPlacement || '').trim(),
      lens: String(dsCam.focalLength != null ? `${dsCam.focalLength}mm` : shot.lensAndFocalLength || '').trim(),
      focalLength: String(dsCam.focalLength != null ? dsCam.focalLength : shot.lensAndFocalLength || '').trim(),
      cameraMovement: String(dsCam.movement?.type || shot.cameraMotionTag || '').replace(/\[|\]/g, '').trim(),
      framing: String(ds.composition?.framing || shot.shotComposition || '').trim(),
      composition: String(ds.composition?.framing || shot.shotComposition || '').trim()
    },
    lighting: {
      lighting: String(shot.subjectLightingTag || shot.directionalLightingAndHighlight || '').replace(/\[|\]/g, '').trim(),
      timeOfDay: String(shot.timeAndLightingEnv || '').trim(),
      weather: String(shot.atmosphereVolumetricsTag || '').replace(/\[|\]/g, '').trim(),
      colorTemperature: String(shot.subjectColorTag || '').replace(/\[|\]/g, '').trim(),
      contrast: String(shot.directionalLightingAndHighlight || '').trim()
    },
    directorStage: shot.directorStage || null
  };
}

export { isVideoTemplate, isImageTemplate };
