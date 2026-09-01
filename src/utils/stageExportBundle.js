/**
 * Phase 17 — Director Stage export pack (spec §24–25, §31).
 * Warnings for optional gaps; do not hard-block.
 */

import { createZipArchive } from './zipUtils';
import { saveExportBlob, buildShotExportStem } from './saveExportFile';
import { assertExportAllowed, EXPORT_LIFECYCLE } from './exportGate';
import {
  buildShotDirectorData,
  validateShotDirectorData,
  composeVideoPromptFromDirectorData
} from './stageDirectorData';

export async function exportDirectorStagePack({
  shot,
  plan,
  shotIndex = 0,
  projectTitle = '',
  previewPngBlob = null,
  shots = [],
  lifecycleMode = EXPORT_LIFECYCLE.ADVISORY,
  roomId = '',
  promptSynced = false,
  previousShotId = ''
} = {}) {
  const stem = buildShotExportStem(shot, shotIndex, projectTitle);
  const data = buildShotDirectorData({
    shot,
    plan,
    shotIndex,
    projectTitle,
    previousShotId,
    promptSynced
  });
  const check = validateShotDirectorData(data);
  const videoPrompt = String(shot.stageVideoPrompt || composeVideoPromptFromDirectorData(data) || '');
  const cameraJson = {
    position: data.camera?.position,
    lookAt: data.camera?.lookAt,
    focalLength: data.camera?.focalLength,
    movement: data.camera?.movement,
    aperture: data.camera?.aperture,
    sensor: data.camera?.sensor,
    focusDistance: data.camera?.focusDistance
  };
  const files = [
    { name: `${stem}_DirectorStage.json`, content: JSON.stringify(data, null, 2) },
    { name: `${stem}_VideoPrompt.txt`, content: videoPrompt },
    { name: `${stem}_Camera.json`, content: JSON.stringify(cameraJson, null, 2) },
    { name: `${stem}_ShotData.json`, content: JSON.stringify({ shotId: data.shotId, duration: data.duration, characters: data.characters }, null, 2) }
  ];
  if (previewPngBlob) {
    const buf = new Uint8Array(await previewPngBlob.arrayBuffer());
    files.push({ name: `${stem}_StagePreview.png`, content: buf });
  }
  const gate = assertExportAllowed({
    projectTitle,
    label: 'director_stage_pack',
    format: 'zip',
    showAlert: true,
    lifecycleMode,
    shots,
    roomId
  });
  if (!gate.ok) {
    return { ok: false, blocked: true, error: gate.message, check };
  }
  const blob = createZipArchive(files);
  const saved = await saveExportBlob(blob, `${stem}_DirectorStage.zip`, {
    projectTitle,
    shots,
    lifecycleMode,
    skipLifecycleCheck: true,
    advisoryAlready: Boolean(gate.advisory),
    auditLabel: 'director_stage_pack',
    auditFormat: 'zip',
    roomId,
    note: check.message
  });
  return { ok: saved.success, saved, check, stem, data };
}
