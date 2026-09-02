import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Send, CheckCircle2, AlertTriangle, ListOrdered, FolderDown, Clapperboard } from 'lucide-react';
import { buildSwsWorkflowContract, inferWorkflowTemplate, SWS_PROVIDERS } from '../utils/swsWorkflowContract';
import { listWorkflowTemplates, requiredCustomNodes, SWS_WORKFLOW_TEMPLATES } from '../utils/swsComfyTemplates';
import { assembleValidatedWorkflow, buildComfyExportBundle, buildWorkflowId } from '../utils/swsComfyJson';
import { formatValidationMessage, validateAgainstInstalledNodes, validateSwsWorkflow } from '../utils/swsWorkflowValidator';
import { formatFrontendValidationMessage, isComfyFrontendWorkflow, validateComfyFrontendWorkflow } from '../utils/swsComfyFrontend';
import { generationsForShot, newGenerationId, recordSwsGeneration, updateSwsGeneration, generationForPromptId, awaitingOutputCount, markAwaitingSucceededForShot } from '../utils/swsComfyStore';
import {
  fetchComfyObjectInfo,
  getComfyUiBaseUrl,
  loadWorkflowIntoComfyEditor,
  waitForComfyPendingLoaded,
  openComfyUiWindow,
  pullLatestComfyOutput,
  probeComfyUi,
  setComfyUiBaseUrl,
  missingComfyClassStatusLine,
  installedComfyClassCount
} from '../services/comfyuiClient';
import {
  getSeedanceStillModel,
  getSeedanceVideoModel,
  SEEDANCE_STILL_MODELS,
  SEEDANCE_VIDEO_MODELS
} from '../services/seedanceModels';
import { SEEDANCE2_COMFY_MODELS } from '../utils/comfyParameterMapper';
import { assembleMatrixSeedanceWorkflow, assembleMatrixSeedanceWorkflowAsync, isSeedanceMasterTemplate } from '../utils/assembleMatrixSeedanceWorkflow';
import { listFilmQueueShots, runComfyFilmQueue, validateMasterNodesInstalled } from '../utils/comfyFilmQueue';
import { SEEDANCE_MASTER_REQUIRED_NODES } from '../utils/seedanceMasterWorkflow';
import { appendVideoTake, isActiveVideoTakeUrl } from '../utils/shotTakes';
import { filenameFromComfyViewUrl } from '../utils/comfyHistoryParse';
import {
  discoverFilmAssetRoots,
  ensureProjectAssetFolders,
  loadProjectAssetRoots,
  resolveComfyAssetSlots,
  saveComfyWorkflowFilesToProject
} from '../utils/projectAssetRootsClient';
import { assetRootsList, emptyAssetRoots, resolveWorkflowsDir } from '../utils/projectAssetRoots';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { runSwsComfySelfTests } from '../utils/swsComfySelfTest';
import {
  buildClapboard,
  buildResolvePackFiles,
  clapboardSidecarJson
} from '../utils/shotClapboard';

function validateFrontendNodesInstalled(workflow, objectInfo) {
  return validateMasterNodesInstalled(workflow, objectInfo);
}

export default function SwsComfyWorkflowModal({
  isOpen,
  onClose,
  shot = {},
  shotIndex = 0,
  shots = [],
  projectTitle = '',
  deskMode = 'video',
  onUpdateShot
}) {
  const { mode: lifecycleMode } = useExportLifecyclePref('generate');
  const [templateId, setTemplateId] = useState('');
  const [provider, setProvider] = useState(SWS_PROVIDERS.BYTEPLUS);
  const [model, setModel] = useState('');
  const [duration, setDuration] = useState(5);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState(24);
  const [seed, setSeed] = useState(-1);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [promptOverride, setPromptOverride] = useState('');
  const [firstFrameUrl, setFirstFrameUrl] = useState('');
  const [lastFrameUrl, setLastFrameUrl] = useState('');
  const [sourceVideoUrl, setSourceVideoUrl] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [editedPromptJson, setEditedPromptJson] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [comfyUrl, setComfyUrl] = useState(() => getComfyUiBaseUrl());
  const [outputUrl, setOutputUrl] = useState('');
  const [lastGenerationId, setLastGenerationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [testNote, setTestNote] = useState('');
  const [comfyProbeNote, setComfyProbeNote] = useState('');
  const [filmProgress, setFilmProgress] = useState('');
  const [comfyUiVersion, setComfyUiVersion] = useState('');
  const [installedClassCount, setInstalledClassCount] = useState(0);
  const [offerPullLatest, setOfferPullLatest] = useState(null);
  const filmCancelRef = useRef({ cancelled: false });
  const [assetRoots, setAssetRoots] = useState(() => emptyAssetRoots());
  const [diskAssetSlots, setDiskAssetSlots] = useState([]);

  const family = deskMode === 'still' ? 'image' : 'video';
  const templates = useMemo(() => listWorkflowTemplates(family), [family]);
  const seedanceMaster = isSeedanceMasterTemplate(templateId);
  const filmShotCount = useMemo(() => listFilmQueueShots(shots).length, [shots]);

  useEffect(() => {
    if (!isOpen) return;
    setTemplateId(inferWorkflowTemplate({ mode: family, shot }));
    setProvider(SWS_PROVIDERS.BYTEPLUS);
    setModel(
      family === 'video'
        ? SEEDANCE2_COMFY_MODELS[0].id
        : getSeedanceStillModel()
    );
    setPromptOverride('');
    setNegativePrompt(String(shot.negativePrompt || ''));
    setFirstFrameUrl(String(shot.lockedStillUrl || shot.firstFrameUrl || ''));
    setLastFrameUrl(String(shot.lastFrameUrl || ''));
    setSourceVideoUrl(String(shot.sourceVideoUrl || ''));
    setEditedPromptJson('');
    setStatus('');
    setError('');
    setTestNote('');
    setComfyProbeNote('');
    setOfferPullLatest(null);
    setInstalledClassCount(0);
    setComfyUrl(getComfyUiBaseUrl());
  }, [isOpen, family, shot, shotIndex]);

  // When switching away from Seedance master, restore API video model default
  useEffect(() => {
    if (!isOpen || family !== 'video') return;
    if (seedanceMaster) {
      if (!SEEDANCE2_COMFY_MODELS.some((m) => m.id === model)) {
        setModel(SEEDANCE2_COMFY_MODELS[0].id);
      }
    } else if (SEEDANCE2_COMFY_MODELS.some((m) => m.id === model)) {
      setModel(getSeedanceVideoModel());
    }
  }, [isOpen, family, seedanceMaster, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shotForContract = useMemo(
    () => ({
      ...shot,
      firstFrameUrl,
      lastFrameUrl,
      sourceVideoUrl,
      lockedStillUrl: firstFrameUrl || shot.lockedStillUrl
    }),
    [shot, firstFrameUrl, lastFrameUrl, sourceVideoUrl]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        let roots = await loadProjectAssetRoots(projectTitle);
        if (!assetRootsList(roots).length && projectTitle) {
          const discovered = await discoverFilmAssetRoots(projectTitle, { ensure: true });
          if (discovered.ok) roots = discovered.roots;
        }
        if (cancelled) return;
        setAssetRoots(roots);
        if (assetRootsList(roots).length) {
          await ensureProjectAssetFolders(roots);
        }
        if (seedanceMaster) {
          const resolved = await resolveComfyAssetSlots(shotForContract, roots);
          if (!cancelled) setDiskAssetSlots(resolved.slots || []);
        } else if (!cancelled) {
          setDiskAssetSlots([]);
        }
      } catch {
        if (!cancelled) setDiskAssetSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, seedanceMaster, projectTitle, shotForContract]);

  const seedanceBundle = useMemo(() => {
    if (!seedanceMaster) return null;
    return assembleMatrixSeedanceWorkflow({
      shot: shotForContract,
      shotIndex,
      shots,
      projectTitle,
      promptOverride,
      negativePrompt,
      duration,
      width,
      height,
      seed,
      model,
      diskAssetSlots,
      assetRoots
    });
  }, [
    seedanceMaster,
    shotForContract,
    shotIndex,
    shots,
    projectTitle,
    promptOverride,
    negativePrompt,
    duration,
    width,
    height,
    seed,
    model,
    diskAssetSlots,
    assetRoots
  ]);

  const contract = useMemo(
    () =>
      buildSwsWorkflowContract({
        shot: shotForContract,
        shotIndex,
        projectTitle,
        workflowType: templateId || 'video_text_to_video',
        provider,
        model: seedanceMaster ? model : model,
        duration,
        width,
        height,
        fps,
        seed,
        negativePrompt,
        promptOverride: seedanceMaster && seedanceBundle?.composed?.prompt
          ? seedanceBundle.composed.prompt
          : promptOverride
      }),
    [
      shotForContract,
      shotIndex,
      projectTitle,
      templateId,
      provider,
      model,
      duration,
      width,
      height,
      fps,
      seed,
      negativePrompt,
      promptOverride,
      seedanceMaster,
      seedanceBundle
    ]
  );

  const clap = useMemo(
    () =>
      buildClapboard({
        shot: shotForContract,
        projectTitle,
        shotIndex,
        durationSec: duration
      }),
    [shotForContract, projectTitle, shotIndex, duration]
  );

  const bundle = useMemo(() => {
    if (seedanceMaster && seedanceBundle?.workflow) {
      const wf = seedanceBundle.workflow;
      const withClap =
        wf && typeof wf === 'object'
          ? {
              ...wf,
              extra: {
                ...(wf.extra || {}),
                sws: {
                  ...((wf.extra && wf.extra.sws) || {}),
                  projectId: clap.projectId,
                  sceneId: clap.sceneId,
                  shotId: clap.shotId,
                  displayName: clap.displayName,
                  clapboard: clap.label,
                  fileStem: clap.fileStem,
                  videoFilename: clap.videoFilename,
                  durationSec: clap.durationSec
                }
              }
            }
          : wf;
      return {
        ok: seedanceBundle.ok,
        prompt: {},
        frontend: withClap,
        manifest: seedanceBundle.manifest,
        workflowId: `sws_${contract.projectId}_${contract.shotId}_seedance2_v1.0.0`.replace(/\s+/g, '_'),
        errors: seedanceBundle.ok ? [] : [{ message: seedanceBundle.error }],
        clapboard: clap
      };
    }
    return assembleValidatedWorkflow(contract, validateSwsWorkflow);
  }, [seedanceMaster, seedanceBundle, contract, clap]);

  const promptGraph = bundle.prompt;
  const liveValidation = useMemo(() => {
    if (seedanceMaster) {
      return {
        ok: Boolean(seedanceBundle?.ok),
        errors: seedanceBundle?.ok
          ? []
          : [{ message: seedanceBundle?.error || 'Seedance master workflow invalid' }],
        requiredCustomNodes: [...SEEDANCE_MASTER_REQUIRED_NODES]
      };
    }
    return validateSwsWorkflow({ contract, prompt: promptGraph });
  }, [seedanceMaster, seedanceBundle, contract, promptGraph]);

  const history = isOpen ? generationsForShot(projectTitle, contract.shotId) : [];
  const models = seedanceMaster
    ? SEEDANCE2_COMFY_MODELS
    : family === 'video'
      ? SEEDANCE_VIDEO_MODELS
      : SEEDANCE_STILL_MODELS;

  const displayPrompt =
    promptOverride ||
    (seedanceMaster ? seedanceBundle?.composed?.prompt : '') ||
    contract.prompt ||
    '';

  if (!isOpen) return null;

  const persistGeneration = (patch) => {
    const generationId = patch.generationId || lastGenerationId || newGenerationId();
    recordSwsGeneration(projectTitle, {
      generationId,
      workflowId: bundle.workflowId,
      projectId: contract.projectId,
      sceneId: contract.sceneId,
      shotId: contract.shotId,
      templateId: contract.workflowType,
      templateVersion: contract.templateVersion || SWS_WORKFLOW_TEMPLATES[templateId]?.templateVersion,
      provider: contract.provider,
      model: contract.model,
      contract,
      manifest: bundle.manifest,
      debug: seedanceBundle?.debug || null,
      status: 'specified',
      ...patch,
      comfyuiVersion: patch.comfyuiVersion || comfyUiVersion || 'unknown'
    });
    setLastGenerationId(generationId);
    return generationId;
  };

  const buildWorkflowExportFiles = () => {
    const stem = clap.fileStem ? `${clap.fileStem}_WORKFLOW` : `${String(contract.shotId || 'SHOT').replace(/[^\w.-]+/g, '_')}_WORKFLOW`;
    const manifest = {
      ...bundle.manifest,
      workflow_id: bundle.workflowId || buildWorkflowId(contract),
      clapboard: clap.label,
      fileStem: clap.fileStem,
      videoFilename: clap.videoFilename,
      validation: { ok: liveValidation.ok, errors: liveValidation.errors }
    };
    const files = [
      { name: `${stem}.json`, content: JSON.stringify(bundle.frontend || promptGraph, null, 2) },
      { name: `${stem.replace(/WORKFLOW$/, 'MANIFEST')}.json`, content: JSON.stringify(manifest, null, 2) },
      { name: `${stem.replace(/WORKFLOW$/, 'CONTRACT')}.json`, content: JSON.stringify(contract, null, 2) },
      {
        name: `sidecars/${clap.sidecarFilename}`,
        content: JSON.stringify(clapboardSidecarJson(clap, { workflowId: bundle.workflowId }), null, 2)
      }
    ];
    if (seedanceMaster && seedanceBundle?.debug) {
      files.push({
        name: `${stem.replace(/WORKFLOW$/, 'DEBUG')}.json`,
        content: JSON.stringify(seedanceBundle.debug, null, 2)
      });
    } else if (!seedanceMaster) {
      files.splice(1, 0, {
        name: `${stem}_API.json`,
        content: JSON.stringify(promptGraph, null, 2)
      });
    }
    return { stem, files };
  };

  const workflowsDirHint = resolveWorkflowsDir(assetRoots) || '';

  const saveAllWorkflowsToFolder = async () => {
    setError('');
    setStatus('');
    const gate = assertExportAllowed({
      projectTitle,
      label: 'comfy_workflows_folder',
      format: 'json',
      lifecycleMode,
      shots,
      roomId: resolveCollabRoomId()
    });
    if (!gate.ok) {
      setError(gate.message || 'Export blocked.');
      return;
    }

    setBusy(true);
    try {
      let roots = assetRoots;
      let dir = resolveWorkflowsDir(roots);
      if (!dir && projectTitle) {
        setFilmProgress('Finding film Workflows folder…');
        const discovered = await discoverFilmAssetRoots(projectTitle, { ensure: true });
        if (discovered.ok) {
          roots = discovered.roots;
          setAssetRoots(roots);
          dir = resolveWorkflowsDir(roots);
        }
      }
      if (!dir) {
        setError(
          'Could not find a film folder. Set Project save / ComfyUI workflows in Project Console → Fill under film root → Save & create folders.'
        );
        return;
      }

      await ensureProjectAssetFolders(roots);
      const files = [];
      let okCount = 0;
      let failCount = 0;

      if (seedanceMaster) {
        const list = listFilmQueueShots(shots);
        const targets = list.length
          ? list
          : [{ shot: shotForContract, index: shotIndex }];
        setFilmProgress(`Saving ${targets.length} workflow(s) to disk…`);
        for (let i = 0; i < targets.length; i += 1) {
          const { shot: s, index } = targets[i];
          const label = String(s?.sceneShotId || s?.shotId || `shot_${index + 1}`).replace(/[^\w.-]+/g, '_');
          setFilmProgress(`Saving ${i + 1}/${targets.length}: ${label}`);
          try {
            const assembled = await assembleMatrixSeedanceWorkflowAsync({
              shot: s,
              shotIndex: index,
              shots,
              projectTitle,
              promptOverride: targets.length === 1 ? promptOverride : '',
              negativePrompt,
              duration,
              width,
              height,
              seed,
              model,
              assetRoots: roots
            });
            if (!assembled.ok || !assembled.workflow) {
              failCount += 1;
              continue;
            }
            files.push({
              name: `${label}_WORKFLOW.json`,
              content: JSON.stringify(assembled.workflow, null, 2)
            });
            if (assembled.debug) {
              files.push({
                name: `${label}_DEBUG.json`,
                content: JSON.stringify(assembled.debug, null, 2)
              });
            }
            okCount += 1;
          } catch {
            failCount += 1;
          }
        }
      } else {
        if (!liveValidation.ok) {
          setError(formatValidationMessage(liveValidation));
          return;
        }
        const { files: one } = buildWorkflowExportFiles();
        files.push(...one);
        okCount = 1;
      }

      if (!files.length) {
        setError('No workflows to save.');
        return;
      }

      setFilmProgress(`Writing ${files.length} file(s) to Workflows…`);
      const diskSave = await saveComfyWorkflowFilesToProject(projectTitle, files, roots);
      if (!diskSave?.ok) {
        setError(diskSave?.error || 'Could not write workflows folder.');
        return;
      }
      if (diskSave.roots) setAssetRoots(diskSave.roots);
      logExportSuccess({
        projectTitle,
        label: 'comfy_workflows_folder',
        format: 'json',
        filename: `${files.length}_files`,
        roomId: resolveCollabRoomId(),
        lifecycleMode
      });
      setStatus(
        `Saved ${diskSave.count || files.length} file(s) (${okCount} shot workflow${okCount === 1 ? '' : 's'}${
          failCount ? `, ${failCount} failed` : ''
        }) → ${diskSave.dir}`
      );
    } finally {
      setBusy(false);
      setFilmProgress('');
    }
  };

  const downloadZip = async () => {
    setError('');
    if (!liveValidation.ok) {
      setError(formatValidationMessage(liveValidation));
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'comfy_workflow',
      format: 'zip',
      lifecycleMode,
      shots,
      roomId: resolveCollabRoomId()
    });
    if (!gate.ok) {
      setError(gate.message || 'Export blocked.');
      return;
    }
    const { stem, files } = buildWorkflowExportFiles();
    const diskSave = await saveComfyWorkflowFilesToProject(projectTitle, files, assetRoots);
    const blob = createZipArchive(files);
    const saved = await saveExportBlob(blob, `${stem}.zip`, {
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      projectTitle,
      auditLabel: 'comfy_workflow',
      auditFormat: 'zip',
      shots,
      roomId: resolveCollabRoomId(),
      lifecycleMode
    });
    if (saved?.blocked) {
      setError(saved.error || 'Could not save workflow ZIP.');
      return;
    }
    persistGeneration({ status: 'exported' });
    logExportSuccess({
      projectTitle,
      label: 'comfy_workflow',
      format: 'zip',
      filename: `${stem}.zip`,
      roomId: resolveCollabRoomId(),
      lifecycleMode
    });
    const diskNote = diskSave?.ok
      ? ` Also saved ${diskSave.count || files.length} file(s) to ${diskSave.dir}.`
      : diskSave?.error
        ? ` (Project folder skip: ${diskSave.error})`
        : '';
    setStatus(
      (seedanceMaster
        ? 'Downloaded Seedance master workflow JSON. Install ComfyUI-Seedance2 into custom_nodes before importing.'
        : 'Downloaded workflow JSON + manifest. Copy ComfyUI-SWS into custom_nodes before importing.') + diskNote
    );
  };

  const sendToComfy = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    setComfyProbeNote('');
    try {
      if (!shot || (!contract.shotId && !seedanceBundle?.normalized?.shotId)) {
        setError('No selected shot — select a Matrix shot first.');
        return;
      }
      if (!liveValidation.ok) {
        setError(formatValidationMessage(liveValidation));
        persistGeneration({ status: 'failed', error: formatValidationMessage(liveValidation) });
        return;
      }
      setComfyUiBaseUrl(comfyUrl);
      // Open / focus ComfyUI first so the SWS web extension is listening
      openComfyUiWindow(comfyUrl);
      await new Promise((r) => setTimeout(r, 1400));
      const probe = await probeComfyUi(comfyUrl);
      if (probe.ok) setComfyUiVersion(probe.comfyuiVersion || 'unknown');
      const probeNote = probe.ok
        ? `Connected · ComfyUI ${probe.comfyuiVersion || 'unknown'}${probe.apiBase ? ` · API ${probe.apiBase}` : ''}`
        : probe.message;
      setComfyProbeNote(probeNote);
      if (!probe.ok) {
        const message =
          probe.status === 403
            ? probe.message
            : `ComfyUI is not reachable at ${comfyUrl} (API via local proxy). Start ComfyUI on that port and keep Vite running, then try Send again.`;
        setError(message);
        persistGeneration({ status: 'failed', error: message });
        return;
      }
      let objectInfo;
      try {
        objectInfo = await fetchComfyObjectInfo(comfyUrl);
      } catch (err) {
        setError(err.message || 'Could not read ComfyUI object_info.');
        return;
      }

      const classCount = installedComfyClassCount(objectInfo);
      setInstalledClassCount(classCount);

      const requiredClasses = seedanceMaster
        ? [...SEEDANCE_MASTER_REQUIRED_NODES]
        : requiredCustomNodes();
      const classReport = missingComfyClassStatusLine(objectInfo, requiredClasses, { host: comfyUrl });
      setStatus(classReport.status);
      setComfyProbeNote([probeNote, classReport.status].filter(Boolean).join(' · '));
      if (!classReport.ok) {
        setError(classReport.status);
        persistGeneration({ status: 'failed', error: classReport.status });
        return;
      }

      let frontend;
      let workflowId = bundle.workflowId;

      if (seedanceMaster) {
        frontend = seedanceBundle.workflow;
        const installed = validateFrontendNodesInstalled(frontend, objectInfo);
        if (!installed.ok) {
          setError(installed.message);
          persistGeneration({ status: 'failed', error: installed.message });
          return;
        }
      } else {
        const installed = validateAgainstInstalledNodes(promptGraph, objectInfo);
        if (!installed.ok) {
          setError(installed.message);
          persistGeneration({ status: 'failed', error: installed.message });
          return;
        }
        const converted = buildComfyExportBundle(contract, { objectInfo });
        frontend = converted.frontend;
        workflowId = converted.workflowId;
      }

      if (editedPromptJson.trim()) {
        try {
          const parsed = JSON.parse(editedPromptJson);
          if (isComfyFrontendWorkflow(parsed)) frontend = parsed;
        } catch {
          /* keep converted */
        }
      }
      const frontCheck = validateComfyFrontendWorkflow(frontend);
      if (!frontCheck.ok) {
        setError(formatFrontendValidationMessage(frontCheck));
        persistGeneration({ status: 'failed', error: formatFrontendValidationMessage(frontCheck) });
        return;
      }
      if (!frontend?.nodes?.length) {
        setError('Invalid workflow — empty canvas was blocked before send.');
        persistGeneration({ status: 'failed', error: 'empty workflow' });
        return;
      }

      const loaded = await loadWorkflowIntoComfyEditor({
        workflow: frontend,
        workflowId,
        workflowName:
          frontend?.extra?.sws?.displayName ||
          [seedanceBundle?.normalized?.projectId || projectTitle, seedanceBundle?.normalized?.shotId || contract.shotId || shot?.sceneShotId]
            .map((x) => String(x || '').trim())
            .filter(Boolean)
            .join(' ') ||
          'SWS Workflow',
        baseUrl: comfyUrl
      });
      if (!loaded.ok) {
        setError(loaded.message);
        persistGeneration({ status: 'failed', error: loaded.message });
        return;
      }

      let applied = await waitForComfyPendingLoaded({ id: loaded.id, baseUrl: comfyUrl });
      if (!applied.ok) {
        openComfyUiWindow(comfyUrl);
        await new Promise((r) => setTimeout(r, 800));
        const retry = await loadWorkflowIntoComfyEditor({
          workflow: frontend,
          workflowId,
          workflowName: loaded.name,
          baseUrl: comfyUrl
        });
        if (retry.ok) {
          applied = await waitForComfyPendingLoaded({ id: retry.id || loaded.id, baseUrl: comfyUrl, timeoutMs: 15000 });
        }
      }
      if (!applied.ok) {
        setError(applied.message);
        persistGeneration({ status: 'failed', error: applied.message });
        return;
      }
      // Focus again after load — pending graph also applies if the tab just finished booting
      openComfyUiWindow(comfyUrl);
      persistGeneration({ status: 'opened_editor', comfyPromptId: loaded.id || '', comfyuiVersion: probe.comfyuiVersion || 'unknown' });
      let diskNote = '';
      try {
        if (liveValidation.ok && (bundle.frontend || promptGraph)) {
          const { files } = buildWorkflowExportFiles();
          const diskSave = await saveComfyWorkflowFilesToProject(projectTitle, files, assetRoots);
          if (diskSave?.ok) {
            diskNote = ` Saved ${diskSave.count || files.length} file(s) → ${diskSave.dir}.`;
          }
        }
      } catch {
        /* non-fatal */
      }
      let pullOffer = '';
      setOfferPullLatest(null);
      try {
        const peek = await pullLatestComfyOutput({ baseUrl: comfyUrl });
        if (peek.ok && peek.filename) {
          setOfferPullLatest({ filename: peek.filename, outputFile: peek.outputFile || '' });
          pullOffer = ` History already has a viewable output (${peek.filename}) — Pull latest to attach it.`;
        }
      } catch {
        /* offer is optional */
      }
      setStatus(
        `Loaded “${loaded.name || 'workflow'}” (${frontend.nodes.length} nodes) onto ComfyUI at ${comfyUrl}.${diskNote} ${classReport.status} ComfyUI ${probe.comfyuiVersion || 'unknown'} · ${classCount} installed class${classCount === 1 ? '' : 'es'}.${pullOffer} Tab title should show the shot name — if it still says Unsaved Workflow, restart ComfyUI once so ComfyUI-SWS reloads.`
      );
    } finally {
      setBusy(false);
    }
  };

  const queueAllShots = async () => {
    if (!seedanceMaster) {
      setError('Film queue requires the Seedance master template.');
      return;
    }
    filmCancelRef.current = { cancelled: false };
    setBusy(true);
    setError('');
    setStatus('');
    setFilmProgress(`Preparing ${filmShotCount} shot(s)…`);
    setComfyUiBaseUrl(comfyUrl);
    try {
      const result = await runComfyFilmQueue({
        shots,
        projectTitle,
        comfyUrl,
        duration,
        width,
        height,
        seed,
        model,
        generateAudio: true,
        autoQueue: true,
        cancelToken: filmCancelRef.current,
        onProgress: ({ index, total, shotId, status: st, error: err, filename, outputFile, composedSource }) => {
          const linked = filename || filenameFromComfyViewUrl(outputFile);
          const src = composedSource ? ` · ${composedSource}` : '';
          setFilmProgress(
            `${index + 1}/${total} · ${shotId} · ${st}${src}${err ? ` — ${err}` : ''}${linked ? ` · ${linked}` : ''}`
          );
        }
      });
      const rows = result.results || [];
      if (result.comfyuiVersion) setComfyUiVersion(result.comfyuiVersion);
      let linked = 0;
      let pullNotes = 0;
      rows.forEach((r) => {
        const idx = Number.isFinite(r.shotIndex) ? r.shotIndex : r.index;
        const row = shots[idx];
        const ver = r.comfyuiVersion || result.comfyuiVersion || comfyUiVersion || 'unknown';
        if (r.status === 'succeeded' && r.outputFile) {
          linked += 1;
          const existing = r.comfyPromptId
            ? generationForPromptId(projectTitle, r.comfyPromptId, r.shotId)
            : null;
          if (existing?.generationId) {
            updateSwsGeneration(projectTitle, existing.generationId, {
              status: 'succeeded',
              outputFile: r.outputFile,
              comfyuiVersion: ver
            });
          } else {
            recordSwsGeneration(projectTitle, {
              generationId: newGenerationId(),
              shotId: r.shotId,
              status: 'succeeded',
              outputFile: r.outputFile,
              comfyPromptId: r.comfyPromptId || '',
              comfyuiVersion: ver,
              templateId: 'video_seedance2_master',
              provider: 'byteplus'
            });
          }
          if (onUpdateShot && row && !isActiveVideoTakeUrl(row, r.outputFile)) {
            onUpdateShot(
              idx,
              appendVideoTake(row, {
                url: r.outputFile,
                jobId: r.comfyPromptId || '',
                status: 'succeeded',
                setActive: true
              })
            );
          }
          markAwaitingSucceededForShot(projectTitle, r.shotId, {
            outputFile: r.outputFile,
            comfyuiVersion: ver
          });
          return;
        }
        if (r.status === 'succeeded' && !r.outputFile) {
          pullNotes += 1;
          const note = r.outputNote || 'Comfy history had no viewable file after queue idle.';
          recordSwsGeneration(projectTitle, {
            generationId: newGenerationId(),
            shotId: r.shotId,
            status: 'awaiting_output',
            outputFile: '',
            error: note,
            comfyPromptId: r.comfyPromptId || '',
            comfyuiVersion: ver,
            templateId: 'video_seedance2_master',
            provider: 'byteplus'
          });
          if (onUpdateShot && row) {
            onUpdateShot(
              idx,
              appendVideoTake(row, {
                url: '',
                jobId: r.comfyPromptId || '',
                status: 'queued',
                setActive: false
              })
            );
          }
        }
      });
      if (result.ok) {
        setStatus(
          linked
            ? `Film queue finished — ${result.total} shot(s); ${linked} output(s) linked from Comfy history.`
            : pullNotes
              ? `Film queue finished — ${result.total} shot(s) sent; ${pullNotes} waiting on Comfy history (Pull latest).`
              : `Film queue finished — ${result.total} shot(s) sent to ComfyUI with auto-queue.`
        );
        setFilmProgress('');
      } else {
        setError(result.error || 'Film queue stopped.');
        setStatus(
          rows.length
            ? `Stopped after ${rows.length}/${result.total || filmShotCount} shot(s).${pullNotes ? ` ${pullNotes} awaiting history pull.` : ''}`
            : ''
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelFilmQueue = () => {
    filmCancelRef.current.cancelled = true;
    setFilmProgress('Cancelling after current shot…');
  };

  const attachOutput = () => {
    const url = String(outputUrl || '').trim();
    if (!url) {
      setError('Paste an output URL or local path first, or Pull latest from ComfyUI.');
      return;
    }
    if (onUpdateShot && shot && isActiveVideoTakeUrl(shot, url)) {
      setStatus('Already the active video take — no duplicate appended.');
      return;
    }
    const id = persistGeneration({
      status: 'succeeded',
      outputFile: url,
      clapboard: clap.label,
      fileStem: clap.fileStem,
      videoFilename: clap.videoFilename,
      suggestedSaveAs: clap.videoFilename
    });
    updateSwsGeneration(projectTitle, id, {
      status: 'succeeded',
      outputFile: url,
      clapboard: clap.label,
      fileStem: clap.fileStem,
      videoFilename: clap.videoFilename,
      comfyuiVersion: comfyUiVersion || 'unknown'
    });
    if (onUpdateShot && shot && !isActiveVideoTakeUrl(shot, url)) {
      onUpdateShot(
        shotIndex,
        appendVideoTake(shot, { url, status: 'succeeded', setActive: true })
      );
    }
    setStatus(
      `Output linked · save / rename render as ${clap.videoFilename} (${clap.label}) for DaVinci Resolve.`
    );
  };

  const pullComfyOutput = async () => {
    setError('');
    setStatus('');
    setBusy(true);
    try {
      const pulled = await pullLatestComfyOutput({ baseUrl: comfyUrl });
      if (!pulled.ok) {
        setError(pulled.message || 'Could not read ComfyUI history.');
        return;
      }
      setOfferPullLatest(null);
      const probe = await probeComfyUi(comfyUrl);
      const ver = probe.ok ? probe.comfyuiVersion || 'unknown' : comfyUiVersion || 'unknown';
      if (probe.ok) setComfyUiVersion(ver);
      setOutputUrl(pulled.outputFile);
      const shotId = contract.shotId;
      const dup = pulled.promptId
        ? generationForPromptId(projectTitle, pulled.promptId, shotId)
        : null;
      markAwaitingSucceededForShot(projectTitle, shotId, {
        outputFile: pulled.outputFile,
        comfyPromptId: pulled.promptId || '',
        comfyuiVersion: ver
      });
      if (dup) {
        if (dup.generationId) {
          updateSwsGeneration(projectTitle, dup.generationId, {
            status: 'succeeded',
            outputFile: pulled.outputFile,
            comfyuiVersion: ver
          });
        }
        if (onUpdateShot && shot && !isActiveVideoTakeUrl(shot, pulled.outputFile)) {
          onUpdateShot(
            shotIndex,
            appendVideoTake(shot, {
              url: pulled.outputFile,
              jobId: pulled.promptId || '',
              status: 'succeeded',
              setActive: true
            })
          );
        }
        setStatus(
          isActiveVideoTakeUrl(shot, pulled.outputFile)
            ? `Already the active video take · ${pulled.filename}${ver && ver !== 'unknown' ? ` · ComfyUI ${ver}` : ''}`
            : `Pulled Comfy output · ${pulled.filename} (same prompt id, generation row reused)${ver && ver !== 'unknown' ? ` · ComfyUI ${ver}` : ''}`
        );
        return;
      }
      persistGeneration({
        status: 'succeeded',
        outputFile: pulled.outputFile,
        comfyPromptId: pulled.promptId || '',
        comfyuiVersion: ver,
        clapboard: clap.label,
        fileStem: clap.fileStem,
        videoFilename: clap.videoFilename,
        suggestedSaveAs: clap.videoFilename
      });
      if (onUpdateShot && shot && !isActiveVideoTakeUrl(shot, pulled.outputFile)) {
        onUpdateShot(
          shotIndex,
          appendVideoTake(shot, {
            url: pulled.outputFile,
            jobId: pulled.promptId || '',
            status: 'succeeded',
            setActive: true
          })
        );
      }
      setStatus(
        `Pulled Comfy output · ${pulled.filename}${ver && ver !== 'unknown' ? ` · ComfyUI ${ver}` : ''}`
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadResolvePack = async () => {
    setError('');
    setStatus('');
    const list = listFilmQueueShots(shots);
    const targets = list.length ? list : [{ shot: shotForContract, index: shotIndex }];
    const gate = assertExportAllowed({
      projectTitle,
      label: 'resolve_pack',
      format: 'zip',
      lifecycleMode,
      shots,
      roomId: resolveCollabRoomId()
    });
    if (!gate.ok) {
      setError(gate.message || 'Export blocked.');
      return;
    }
    const { files, slug } = buildResolvePackFiles({
      projectTitle,
      shots: targets.map((t) => t.shot),
      getDurationSec: (s, i) => {
        if (s === shotForContract || (s?.sceneShotId && s.sceneShotId === shotForContract?.sceneShotId)) {
          return duration;
        }
        return Number(s?.durationSec || s?.duration || duration) || duration;
      },
      getSourcePath: (s, i, c) => {
        const gens = generationsForShot(projectTitle, s?.sceneShotId || c.shotId);
        const hit = (gens || []).find((g) => g.outputFile);
        return hit?.outputFile || c.videoFilename;
      },
      fps
    });
    // Include current shot workflow JSON for Continuity
    try {
      const { files: wfFiles } = buildWorkflowExportFiles();
      wfFiles.forEach((f) => {
        files.push({ name: `workflows/${f.name.replace(/^sidecars\//, 'sidecars/')}`, content: f.content });
      });
    } catch {
      /* ignore */
    }
    const blob = createZipArchive(files);
    const filename = `${slug}_RESOLVE_PACK.zip`;
    const saved = await saveExportBlob(blob, filename, {
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      projectTitle,
      auditLabel: 'resolve_pack',
      auditFormat: 'zip',
      shots,
      roomId: resolveCollabRoomId(),
      lifecycleMode
    });
    if (saved?.blocked) {
      setError(saved.error || 'Could not save Resolve pack.');
      return;
    }
    logExportSuccess({
      projectTitle,
      label: 'resolve_pack',
      format: 'zip',
      filename,
      roomId: resolveCollabRoomId(),
      lifecycleMode
    });
    setStatus(
      `Resolve pack saved (${targets.length} clip${targets.length === 1 ? '' : 's'}). Import CSV/EDL in DaVinci; name MP4s like ${clap.videoFilename}.`
    );
  };

  const debugPayload = seedanceBundle?.debug || null;
  const debugPanel = {
    composedSource:
      seedanceBundle?.composed?.source ||
      seedanceBundle?.debug?.composedSource ||
      contract.promptSource ||
      '',
    systemInstruction: contract.systemInstruction || seedanceBundle?.composed?.systemInstruction || '',
    ...(debugPayload || {
      note: 'Select Matrix → Seedance 2.0 master for structured debug.',
      shotId: contract.shotId,
      templateId,
      requiredNodes: seedanceMaster ? SEEDANCE_MASTER_REQUIRED_NODES : requiredCustomNodes()
    }),
    comfyuiVersion: comfyUiVersion || 'unknown',
    installedClassCount,
    awaitingOutputCount: awaitingOutputCount(projectTitle),
    generations: (history || []).slice(0, 6).map((row) => ({
      generationId: row.generationId,
      status: row.status,
      comfyuiVersion: row.comfyuiVersion || '',
      outputFile: row.outputFile || '',
      error: row.error || ''
    }))
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 80 }} onClick={onClose}>
      <div
        className="sps-shell sps-shell-md"
        style={{ height: 'auto', maxHeight: 'min(92dvh, 46rem)', alignSelf: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sps-modal-head">
          <div>
            <h2>ComfyUI workflow</h2>
            <p>
              {clap.label} · {contract.workflowType} · {contract.provider}
            </p>
          </div>
          <button type="button" className="sps-icon-btn" onClick={onClose} title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="sps-modal-body p-4 space-y-3 overflow-y-auto">
          <p className="m-0 text-[11px] text-[color:var(--sps-muted)]">
            {seedanceMaster
              ? 'Matrix → normalized shot → Prompt Composer + Reference Router + Parameter Mapper → Seedance 2.0 master canvas.'
              : 'Production controls only. Node graphs stay hidden unless you open Advanced. SWS does not install custom nodes.'}
          </p>
          <label className="block text-[11px]">
            Template
            <select className="sps-input w-full mt-1" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px]">
              Provider
              <select className="sps-input w-full mt-1" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value={SWS_PROVIDERS.BYTEPLUS}>BytePlus</option>
                <option value={SWS_PROVIDERS.LOCAL_COMFY}>Local ComfyUI host</option>
              </select>
            </label>
            <label className="block text-[11px]">
              Model
              <select className="sps-input w-full mt-1" value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {family === 'video' ? (
              <>
                <label className="block text-[11px]">
                  Seconds
                  <input className="sps-input w-full mt-1" type="number" min={1} max={15} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 5)} />
                </label>
                <label className="block text-[11px]">
                  FPS
                  <input className="sps-input w-full mt-1" type="number" min={1} max={60} value={fps} onChange={(e) => setFps(Number(e.target.value) || 24)} />
                </label>
              </>
            ) : null}
            <label className="block text-[11px]">
              Width
              <input className="sps-input w-full mt-1" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value) || 1920)} />
            </label>
            <label className="block text-[11px]">
              Height
              <input className="sps-input w-full mt-1" type="number" value={height} onChange={(e) => setHeight(Number(e.target.value) || 1080)} />
            </label>
          </div>
          <label className="block text-[11px]">
            Seed (−1 random)
            <input className="sps-input w-full mt-1" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </label>
          <label className="block text-[11px]">
            Reference / first frame URL
            <input className="sps-input w-full mt-1" value={firstFrameUrl} onChange={(e) => setFirstFrameUrl(e.target.value)} />
          </label>
          {templateId === 'video_first_last_frame' ? (
            <label className="block text-[11px]">
              Last frame URL
              <input className="sps-input w-full mt-1" value={lastFrameUrl} onChange={(e) => setLastFrameUrl(e.target.value)} />
            </label>
          ) : null}
          {templateId === 'video_shot_continuation' || templateId === 'video_upscale' ? (
            <label className="block text-[11px]">
              Source video URL
              <input className="sps-input w-full mt-1" value={sourceVideoUrl} onChange={(e) => setSourceVideoUrl(e.target.value)} />
            </label>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[11px] px-2 py-1.5 rounded border border-[color:var(--sps-border)] bg-[color:var(--sps-surface-2,transparent)]">
            <Clapperboard className="w-3.5 h-3.5 shrink-0 text-[color:var(--sps-muted)]" aria-hidden />
            <span className="font-medium">{clap.label}</span>
            <span className="text-[color:var(--sps-muted)] font-mono text-[10px] truncate" title={clap.videoFilename}>
              → {clap.videoFilename}
            </span>
          </div>
          {seedanceMaster && debugPayload ? (
            <div className="text-[10px] text-[color:var(--sps-muted)] border border-[color:var(--sps-border)] rounded px-2 py-1.5">
              Refs assigned: {debugPayload.referenceAssigned}/9
              {debugPayload.diskAssigned != null ? ` · disk ${debugPayload.diskAssigned}` : ''}
              {' '}· duration {debugPayload.params?.duration} ·{' '}
              {debugPayload.params?.resolution} · {debugPayload.params?.ratio} · prompt via {debugPayload.promptSource}
            </div>
          ) : null}
          <label className="block text-[11px]">
            Prompt (Prompt Composer)
            <textarea
              className="sps-input w-full mt-1 min-h-[4.5rem]"
              value={displayPrompt}
              onChange={(e) => setPromptOverride(e.target.value)}
            />
          </label>
          <label className="block text-[11px]">
            Negative prompt
            <input className="sps-input w-full mt-1" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
          </label>
          <div
            className={`text-[11px] px-2 py-1.5 rounded border ${
              liveValidation.ok ? 'border-emerald-500/30 text-emerald-200' : 'border-red-500/40 text-red-300'
            }`}
          >
            {liveValidation.ok ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                {seedanceMaster ? 'Valid Seedance master canvas' : 'Valid ComfyUI-SWS graph'}
              </span>
            ) : (
              <span className="inline-flex items-start gap-1 whitespace-pre-wrap">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {formatValidationMessage(liveValidation)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="sps-btn sps-btn-primary text-xs" onClick={downloadZip}>
              <Download className="w-3.5 h-3.5" />
              Generate workflow
            </button>
            <button
              type="button"
              className="sps-btn text-xs"
              disabled={busy}
              onClick={saveAllWorkflowsToFolder}
              title={
                workflowsDirHint
                  ? `Write all Matrix shot workflows to ${workflowsDirHint}`
                  : 'Auto-find Desktop/SWS PROJECTS film Workflows folder, then write all shot JSON files'
              }
            >
              <FolderDown className="w-3.5 h-3.5" />
              {busy && filmProgress?.startsWith('Saving')
                ? 'Saving…'
                : seedanceMaster
                  ? `Save all to Workflows (${filmShotCount || 1})`
                  : 'Save to Workflows'}
            </button>
            <button type="button" className="sps-btn text-xs" disabled={busy} onClick={sendToComfy}>
              <Send className="w-3.5 h-3.5" />
              {busy && !filmProgress ? 'Sending…' : 'Send to ComfyUI'}
            </button>
            {seedanceMaster ? (
              <>
                <button
                  type="button"
                  className="sps-btn text-xs"
                  disabled={busy || filmShotCount < 1}
                  onClick={queueAllShots}
                  title="Load each Matrix shot onto ComfyUI and auto-queue generation in order"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  {busy && filmProgress && !filmProgress.startsWith('Saving')
                    ? 'Queuing…'
                    : `Queue all shots (${filmShotCount})`}
                </button>
                {busy && filmProgress && !filmProgress.startsWith('Saving') ? (
                  <button type="button" className="sps-btn text-xs" onClick={cancelFilmQueue}>
                    Cancel queue
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className="sps-btn text-xs"
              onClick={downloadResolvePack}
              title="CSV + EDL + clapboard sidecars for DaVinci Resolve Media Pool / timeline"
            >
              <Clapperboard className="w-3.5 h-3.5" />
              Export Resolve pack
            </button>
            <button
              type="button"
              className="sps-btn text-xs"
              onClick={() => {
                const result = runSwsComfySelfTests();
                setTestNote(result.ok ? `Self-test passed (${result.passed} checks).` : result.message);
                if (!result.ok) setError(result.message);
              }}
            >
              Self-test
            </button>
          </div>
          {workflowsDirHint ? (
            <p className="m-0 text-[10px] text-[color:var(--sps-muted)] font-mono truncate" title={workflowsDirHint}>
              Workflows folder: {workflowsDirHint}
            </p>
          ) : (
            <p className="m-0 text-[10px] text-amber-600/90">
              No workflows path yet — Save all will auto-find Desktop/SWS PROJECTS/{'{PROJECT}'}/PROJECT/Workflows.
            </p>
          )}
          {filmProgress ? (
            <p className="m-0 text-[11px] text-[color:var(--sps-muted)]">{filmProgress}</p>
          ) : null}
          <label className="block text-[11px]">
            ComfyUI URL
            <input className="sps-input w-full mt-1" value={comfyUrl} onChange={(e) => setComfyUrl(e.target.value)} placeholder="http://127.0.0.1:8188" />
          </label>
          {comfyProbeNote ? <p className="m-0 text-[10px] text-[color:var(--sps-muted)]">{comfyProbeNote}</p> : null}
          <div className="flex gap-2 items-end">
            <label className="block text-[11px] flex-1">
              Attach output URL
              <input className="sps-input w-full mt-1" value={outputUrl} onChange={(e) => setOutputUrl(e.target.value)} />
            </label>
            <button type="button" className="sps-btn text-xs" onClick={attachOutput}>
              Link to shot
            </button>
            <button type="button" className="sps-btn text-xs" onClick={pullComfyOutput} disabled={busy}>
              Pull latest from ComfyUI
            </button>
          </div>
          {offerPullLatest?.filename ? (
            <p className="m-0 text-[11px] text-[color:var(--sps-muted)]">
              After Send: history already has a viewable output ({offerPullLatest.filename}).{' '}
              <button
                type="button"
                className="sps-btn text-xs"
                onClick={pullComfyOutput}
                disabled={busy}
              >
                Pull latest
              </button>
            </p>
          ) : null}
          {status ? <p className="m-0 text-[11px] text-[color:var(--sps-success)]">{status}</p> : null}
          {error ? <p className="m-0 text-[11px] text-red-300 whitespace-pre-wrap">{error}</p> : null}
          {testNote ? <p className="m-0 text-[11px] text-[color:var(--sps-muted)]">{testNote}</p> : null}

          <details open={showDebug} onToggle={(e) => setShowDebug(e.currentTarget.open)}>
            <summary className="text-[11px] cursor-pointer">Debug panel (Matrix → workflow)</summary>
            <pre className="sps-input w-full mt-1 max-h-48 overflow-auto text-[10px] font-mono whitespace-pre-wrap">
              {JSON.stringify(debugPanel, null, 2)}
            </pre>
          </details>

          <details open={advanced} onToggle={(e) => setAdvanced(e.currentTarget.open)}>
            <summary className="text-[11px] cursor-pointer">Advanced — inspect ComfyUI JSON</summary>
            <p className="text-[10px] text-[color:var(--sps-muted)]">
              Required nodes:{' '}
              {(seedanceMaster ? SEEDANCE_MASTER_REQUIRED_NODES : requiredCustomNodes()).join(', ')}
            </p>
            <textarea
              className="sps-input w-full mt-1 min-h-[10rem] font-mono text-[10px]"
              value={editedPromptJson || JSON.stringify(bundle.frontend || bundle.prompt, null, 2)}
              onChange={(e) => setEditedPromptJson(e.target.value)}
            />
          </details>
          {awaitingOutputCount(projectTitle) > 0 ? (
            <p className="m-0 text-[10px] text-[color:var(--sps-muted)]">
              Film queue awaiting Comfy history: {awaitingOutputCount(projectTitle)}
            </p>
          ) : null}
          {history.length ? (
            <div className="text-[10px] text-[color:var(--sps-muted)]">
              <p className="m-0 mb-1">Recent generations for this shot</p>
              <ul className="m-0 pl-4">
                {history.slice(0, 6).map((row) => (
                  <li key={row.generationId}>
                    {row.status} · {row.templateId} · {row.workflowId}
                    {row.comfyuiVersion ? ` · ComfyUI ${row.comfyuiVersion}` : ''}
                    {row.clapboard ? ` · ${row.clapboard}` : ''}
                    {row.videoFilename ? ` · ${row.videoFilename}` : ''}
                    {row.outputFile ? ` · ${row.outputFile}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
