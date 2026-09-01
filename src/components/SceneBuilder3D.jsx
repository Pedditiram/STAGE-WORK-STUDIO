import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';
import {
  Box, Camera, Move, RotateCw, Scaling, Hand, ZoomIn, ZoomOut,
  Grid3x3, Play, Pause, Sparkles, Loader2, User, Target, Plus,
  MessageSquare, Image as ImageIcon, Film, Download, RotateCcw,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings2, Crosshair, Diamond, Trash2, Maximize2,
  Pin, PinOff, GripHorizontal, Eye, Clapperboard, HelpCircle
} from 'lucide-react';
import {
  compose3DStageFromMasterCinema,
  heuristicStagePlanFromShot,
  normalizeStagePlan
} from '../services/compose3DStageWithLLM';
import { parseSceneAndShotID } from '../utils/sceneShotUtils';
import { ensureMp4Blob, pickRecorderMimePreferMp4 } from '../utils/exportStageMp4';
import { ASPECT_RATIO_OPTIONS } from '../constants/aspectRatios';
import DirectorStageFrameOverlay, {
  DEFAULT_STAGE_GUIDES,
  GUIDE_KEYS
} from './DirectorStageFrameOverlay';
import { buildShotExportStem, saveExportBlob } from '../utils/saveExportFile';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { canUseSaasFeature } from '../utils/saasControl';
import { getCurrentUserEmail } from '../utils/projectPermissions';
import { bakeDepthMotionFromVideo } from '../utils/depthMapDrive';
import {
  BODY_TYPES,
  HAND_PRESETS,
  STUDIO_POSE_PRESETS,
  PROP_PRESETS,
  mirrorPose,
  transferPose,
  applyHandPreset,
  applyBodyType
} from '../utils/poseStudioLib';
import {
  exportPassBundle,
  exportMannequinsObj,
  renderPassPackForPrint,
  stagePassesToPrintHtml
} from '../utils/exportStagePasses';
import { assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import {
  makeStudioMannequin,
  applyStudioMannequinPose
} from '../utils/makeStudioMannequin';
import { makeStageEnvironmentGroup, applyStageAtmosphere, makeStagePropMesh } from '../utils/makeStageEnvironment';
import { STAGE_SET_IDS, STAGE_PROP_CHIPS, STAGE_PRACTICAL_CHIPS, environmentFromSetId, practicalPiece } from '../utils/stageEnvironment';
import {
  STAGE_FOCAL_PRESETS,
  STAGE_SENSOR_PRESETS,
  STAGE_APERTURE_PRESETS,
  focalMmToFov,
  estimateShotSize,
  distance3
} from '../utils/stageLens';
import {
  CAMERA_MOVE_SIMPLE,
  CAMERA_MOVE_PRO,
  cameraMoveEasingOptions,
  applyCameraMoveType,
  evalCameraMove,
  normalizeMoveType
} from '../utils/stageCameraMove';
import {
  CHAR_MOVE_SIMPLE,
  CHAR_MOVE_PRO,
  CHAR_PATH_SHAPES,
  applyCharacterMoveType,
  bakeCharacterMove
} from '../utils/stageCharacterMove';
import {
  EYE_TARGET_SIMPLE,
  EYE_TARGET_PRO,
  HEAD_DIRECTION_PRO,
  BODY_DIRECTION_PRO,
  applyEyeHeadType
} from '../utils/stageEyeHead';
import {
  EXPR_SIMPLE,
  EXPR_PRO,
  EXPR_INTENSITY,
  applyExpressionType
} from '../utils/stageExpression';
import {
  INTERACT_SIMPLE,
  INTERACT_PRO,
  applyInteractionType
} from '../utils/stageInteraction';
import { applySpeakMouth, speakingLineAt } from '../utils/stageDialogue';
import { buildStageTimeline, timelineSpeakerAt } from '../utils/stageTimeline';
import {
  LIGHT_SIMPLE,
  LIGHT_PRO,
  lightingRigForSetup,
  applyStageLightingRig
} from '../utils/stageLighting';
import {
  fitGlbIntoWrapper,
  applyLipSyncMorphs,
  attachGlbIdleMixer,
  updateGlbMixers,
  playGlbClipIntent,
  glbClipIntentFromHuman
} from '../utils/stageFigure';
import {
  buildShotDirectorData,
  composeVideoPromptFromDirectorData,
  matchPreviousStagePlan,
  planFromDirectorStage
} from '../utils/stageDirectorData';
import { matchPreviousReport, resolveMatchDecision } from '../utils/stageContinuityCompare';
import { autoSaveIntervalMs, autoSaveIntervalLabel, readAutoSaveIntervalId } from '../utils/autoSaveIntervals';
import { sendDirectorStageToComfy } from '../utils/stageComfySend';
import { applyPracticalsAtTime, patchPracticalPiece, parsePracticalSeconds, parsePracticalIntensity, parsePracticalKelvin, parsePracticalAngle, parsePracticalDistance, parsePracticalHeight, parsePracticalTilt, parsePracticalSpread, parsePracticalFeather, parsePracticalSpill, PRACTICAL_GELS, PRACTICAL_GOBOS, PRACTICAL_BARNS, PRACTICAL_SHUTTERS, PRACTICAL_BOUNCE, PRACTICAL_BOUNCE_COLORS } from '../utils/stagePracticals';
import { stageHotkeysClaimEvent } from '../utils/stageHotkeys';
import { exportDirectorStagePack } from '../utils/stageExportBundle';
import {
  createStagePlanHistory,
  pushStagePlan,
  undoStagePlan,
  redoStagePlan,
  cloneStagePlan
} from '../utils/stagePlanHistory';
import {
  POSE_JOINT_META,
  POSE_PRESETS,
  MANNEQUIN_ANIM_PRESETS,
  bakeMannequinAnimation,
  bakeCameraKeyframes,
  defaultPose,
  normalizePose,
  inferPoseNameFromShot
} from '../utils/mannequinPose';

const COMPONENT_LIBRARY = [
  { id: 'human', label: 'Human', icon: User, color: '#e8b84a' },
  { id: 'camera', label: 'Camera', icon: Camera, color: '#94a3b8' },
  { id: 'target', label: 'Aim', icon: Target, color: '#f97316' },
  { id: 'cube', label: 'Cube', icon: Box, color: '#38bdf8' },
];

const CLIP_NEAR_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
const CLIP_FAR_PRESETS = [50, 100, 200, 500, 1000];
const DURATION_PRESETS = [3, 5, 8];
const LOOK_PRESETS = [
  { id: 'wide', label: 'Wide', mm: 24 },
  { id: 'medium', label: 'Medium', mm: 35 },
  { id: 'close', label: 'Close', mm: 85 }
];
const MOVE_PRESETS = CAMERA_MOVE_SIMPLE;
function lookFromMm(mm) {
  const n = Number(mm) || 35;
  if (n >= 65) return 'close';
  if (n <= 28) return 'wide';
  return 'medium';
}

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

function makeMannequin(human) {
  return makeStudioMannequin(human?.color, human?.pose, {
    name: human?.id,
    charAssetId: human?.charAssetId,
    figureSource: human?.figureSource || 'mannequin',
    glbUrl: human?.glbUrl || ''
  });
}

function loadGlbForHuman(group, human) {
  const url = String(human?.glbUrl || '').trim();
  if (!group || !url) return;
  const gen = (group.userData.figureGen || 0) + 1;
  group.userData.figureGen = gen;
  import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          if (group.userData.figureGen !== gen) return;
          fitGlbIntoWrapper(group, gltf.scene, THREE);
          attachGlbIdleMixer(group, gltf, THREE, human);
        },
        undefined,
        () => {
          if (group.userData.figureGen !== gen) return;
          group.userData.figureSource = 'mannequin';
        }
      );
    })
    .catch(() => {});
}

function applyMannequinPose(group, poseIn) {
  applyStudioMannequinPose(group, poseIn);
}

function sortKeyframes(keys = []) {
  return [...keys].sort((a, b) => a.t - b.t);
}

function lerp3(a, b, s) {
  return [
    a[0] + (b[0] - a[0]) * s,
    a[1] + (b[1] - a[1]) * s,
    a[2] + (b[2] - a[2]) * s
  ];
}

/** Sample keyframe track at time t (seconds). */
function evalKeyframeTrack(keys, t) {
  if (!keys?.length) return null;
  const sorted = sortKeyframes(keys);
  if (t <= sorted[0].t) {
    return {
      ...sorted[0],
      position: [...sorted[0].position],
      rotation: [...(sorted[0].rotation || [0, 0, 0])]
    };
  }
  if (t >= sorted[sorted.length - 1].t) {
    const k = sorted[sorted.length - 1];
    return { ...k, position: [...k.position], rotation: [...(k.rotation || [0, 0, 0])] };
  }
  let a = sorted[0];
  let b = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].t && t <= sorted[i + 1].t) {
      a = sorted[i];
      b = sorted[i + 1];
      break;
    }
  }
  const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
  const s = u * u * (3 - 2 * u);
  const pose = {
    position: lerp3(a.position, b.position, s),
    rotation: lerp3(a.rotation || [0, 0, 0], b.rotation || [0, 0, 0], s)
  };
  if (a.lookAt && b.lookAt) pose.lookAt = lerp3(a.lookAt, b.lookAt, s);
  else pose.lookAt = b.lookAt || a.lookAt || null;
  if (a.pose || b.pose) {
    const pa = normalizePose(a.pose);
    const pb = normalizePose(b.pose);
    const out = {};
    Object.keys(pa).forEach((k) => {
      out[k] = pa[k] + (pb[k] - pa[k]) * s;
    });
    pose.pose = out;
  }
  return pose;
}

function makeMotionPath(points, colorHex = '#22d3ee') {
  if (!points || points.length < 2) return null;
  const vecs = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(vecs, false, 'catmullrom', 0.35);
  const sampled = curve.getPoints(Math.max(32, points.length * 20));
  const geo = new THREE.BufferGeometry().setFromPoints(sampled);
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.9
  });
  const line = new THREE.Line(geo, mat);
  line.userData.isPath = true;
  line.userData.skipPick = true;

  const markers = new THREE.Group();
  markers.userData.isPath = true;
  markers.userData.skipPick = true;
  const markerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) });
  points.forEach((p) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), markerMat);
    m.position.set(p[0], p[1], p[2]);
    m.userData.skipPick = true;
    markers.add(m);
  });

  const root = new THREE.Group();
  root.userData.isPath = true;
  root.userData.skipPick = true;
  root.add(line, markers);
  return root;
}

function captureKeyframeFromObject(obj, t) {
  const key = {
    t: Math.round(t * 1000) / 1000,
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z]
  };
  if (obj.userData.kind === 'camera') {
    const dir = new THREE.Vector3();
    obj.getWorldDirection(dir);
    const look = obj.position.clone().add(dir.multiplyScalar(4));
    key.lookAt = [look.x, look.y, look.z];
  }
  if (obj.userData.kind === 'human') {
    key.pose = normalizePose(obj.userData.pose || defaultPose());
  }
  return key;
}

function upsertKeyframe(keys = [], key) {
  const next = sortKeyframes(keys.filter((k) => Math.abs(k.t - key.t) > 0.04));
  next.push(key);
  return sortKeyframes(next);
}

function makeFilmCamera() {
  const group = new THREE.Group();
  group.userData.kind = 'camera';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.3, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.45, roughness: 0.35 })
  );
  body.castShadow = true;
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.26, 20),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.55, roughness: 0.25 })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.36;
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.26, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x020617 })
  );
  grip.position.set(0.26, -0.1, -0.04);
  group.add(body, lens, grip);
  return group;
}

/** Aim / look-at dummy — drag to control Camera 1 target (+ FOV when selected). */
function makeCameraTarget() {
  const group = new THREE.Group();
  group.userData.kind = 'aim';
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0x9a3412,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.15
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), mat);
  core.castShadow = true;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.018, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.35, metalness: 0.2 })
  );
  ring.rotation.x = Math.PI / 2;
  const mkAxis = (axis, color) => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(axis[0], axis[1], axis[2])
    ]);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  };
  group.add(
    core,
    ring,
    mkAxis([0.35, 0, 0], 0xf87171),
    mkAxis([0, 0.35, 0], 0x4ade80),
    mkAxis([0, 0, 0.35], 0x60a5fa)
  );
  return group;
}

function makeFrustumHelper(focalMm = 35, aspect = 16 / 9, sensorWidthMm = 36) {
  const fov = focalMmToFov(focalMm, sensorWidthMm);
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.35, 4.5);
  const helper = new THREE.CameraHelper(cam);
  helper.material.opacity = 0.85;
  helper.material.transparent = true;
  if (helper.geometry?.attributes?.color) {
    const colors = helper.geometry.attributes.color;
    for (let i = 0; i < colors.count; i++) {
      colors.setXYZ(i, 0.2, 0.95, 0.45);
    }
    colors.needsUpdate = true;
  }
  return { helper, cam };
}

function evalCameraPose(camPlan, t, durationSec) {
  const pose = evalCameraMove(camPlan, t, durationSec);
  return {
    position: new THREE.Vector3(...(pose.position || [0, 1, 3])),
    lookAt: new THREE.Vector3(...(pose.lookAt || [0, 1.2, 0]))
  };
}

function ScrubNumber({ value, onChange, step = 0.01, precision = 3 }) {
  const startRef = useRef(null);
  const display = Number.isFinite(value) ? Number(value.toFixed(precision)) : 0;
  return (
    <input
      type="number"
      step={step}
      value={display}
      title="Click and drag left/right to scrub · Shift fine · Alt coarse"
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        startRef.current = { x: e.clientX, v: Number(value) || 0, dragged: false };
      }}
      onPointerMove={(e) => {
        if (!startRef.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - startRef.current.x;
        if (Math.abs(dx) < 2 && !startRef.current.dragged) return;
        startRef.current.dragged = true;
        e.preventDefault();
        const sens = e.shiftKey ? step * 0.1 : e.altKey ? step * 10 : step;
        onChange(startRef.current.v + dx * sens);
      }}
      onPointerUp={(e) => {
        startRef.current = null;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }}
      className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-0.5 text-[11px] text-zinc-100 font-mono outline-none focus:border-cyan-500/60 cursor-ew-resize select-none"
    />
  );
}

function numField(value, onChange, step = 0.01) {
  return <ScrubNumber value={value} onChange={onChange} step={step} />;
}

/**
 * 3D Stage — camera-crew friendly blocking, framing, keys, and export.
 */
export default function SceneBuilder3D({
  shot = null,
  aspectRatio = '21:9 Ultrawide',
  aspectNumeric = 21 / 9,
  activeShotIndex = 0,
  projectTitle = '',
  shots = [],
  setActiveShotIndex,
  setAspectRatio,
  isFullscreen = false,
  onMinimizeHeader,
  onUpdateShot,
  autoSaveIntervalId: autoSaveIntervalIdProp,
}) {
  const mountRef = useRef(null);
  const previewMountRef = useRef(null);
  const rendererRef = useRef(null);
  const previewRendererRef = useRef(null);
  const sceneRef = useRef(null);
  const viewCamRef = useRef(null);
  const orthoCamRef = useRef(null);
  const activeViewCamRef = useRef(null);
  const lensCamRef = useRef(null);
  const controlsRef = useRef(null);
  const transformRef = useRef(null);
  const viewHelperRef = useRef(null);
  const humansRef = useRef([]);
  const filmCamsRef = useRef([]);
  const aimTargetRef = useRef(null);
  const aimLineRef = useRef(null);
  const keyLightRef = useRef(null);
  const fillLightRef = useRef(null);
  const rimLightRef = useRef(null);
  const hemiLightRef = useRef(null);
  const gridHelperRef = useRef(null);
  const groundMeshRef = useRef(null);
  const envGroupRef = useRef(null);
  const stageRootRef = useRef(null);
  const propsRef = useRef([]);
  const imagePlaneRef = useRef(null);
  const frustumRef = useRef(null);
  const pathGroupRef = useRef(null);
  const ghostGroupRef = useRef(null);
  const previousPlanRef = useRef(null);
  const ghostOnRef = useRef(false);
  const planRef = useRef(null);
  const playRef = useRef({ playing: false, t: 0, last: 0 });
  const rafRef = useRef(0);
  const modeRef = useRef('compose');
  const exportLensOnlyRef = useRef(false);
  const isOrthoRef = useRef(false);
  const selectedRef = useRef(null);
  const draggingTransformRef = useRef(false);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const syncPlanFromObjectRef = useRef(() => {});
  const persistDirectorToShotRef = useRef(() => {});
  const historyRef = useRef(createStagePlanHistory());
  const lastSavedPlanRef = useRef('');
  const matchBeforeRef = useRef(null);
  const matchPendingRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [matchReport, setMatchReport] = useState(null);
  const [comfyBusy, setComfyBusy] = useState(false);
  const [stageSavedAt, setStageSavedAt] = useState(0);
  const [stageAutoSaveId, setStageAutoSaveId] = useState(
    () => autoSaveIntervalIdProp || readAutoSaveIntervalId()
  );

  const [mode, setMode] = useState('compose');
  const [plan, setPlan] = useState(() => heuristicStagePlanFromShot(shot, activeShotIndex));
  const [playing, setPlaying] = useState(false);
  const [timeSec, setTimeSec] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [isComposing, setIsComposing] = useState(false);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [status, setStatus] = useState('3D Stage ready');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCameraView, setShowCameraView] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCrewTips, setShowCrewTips] = useState(false);
  const [ghostPrevious, setGhostPrevious] = useState(false);
  const [promptSynced, setPromptSynced] = useState(!!shot?.stageVideoPrompt);
  const [transformMode, setTransformMode] = useState('translate');
  const [navTool, setNavTool] = useState('orbit');
  const [isOrtho, setIsOrtho] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [autoKey, setAutoKey] = useState(true);
  const [pipPinned, setPipPinned] = useState(false);
  const [pipPos, setPipPos] = useState({ x: 24, y: 24 }); // from bottom-left of viewport area
  const [poseVersion, setPoseVersion] = useState(0);
  const [showCurves, setShowCurves] = useState(false);
  const [curveChannel, setCurveChannel] = useState('posX');
  const [depthInvert, setDepthInvert] = useState(false);
  const [depthStrength, setDepthStrength] = useState(1.2);
  const [depthBusy, setDepthBusy] = useState(false);
  const depthFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const [stageGuides, setStageGuides] = useState(DEFAULT_STAGE_GUIDES);
  const [showGuidePanel, setShowGuidePanel] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showGround, setShowGround] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [cameraBookmarks, setCameraBookmarks] = useState([]);
  const [poseClipboard, setPoseClipboard] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
  const {
    strict: stageLifecycleStrict,
    mode: stageLifecycleMode
  } = useExportLifecyclePref('stage');
  const stageExportOpts = useMemo(() => {
    const roomId = resolveCollabRoomId();
    const live = (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived).length;
    const shotId =
      parseSceneAndShotID(shot, activeShotIndex).formattedId ||
      shot?.sceneShotId ||
      `Shot ${activeShotIndex + 1}`;
    return {
      projectTitle,
      shots,
      lifecycleMode: stageLifecycleMode,
      auditLabel: 'stage_export',
      roomId,
      note: `${shotId} · ${live} live · stage3d`
    };
  }, [projectTitle, shots, stageLifecycleMode, shot, activeShotIndex]);
  const exportLife = useMemo(
    () => lifecycleExportReadiness(shots, projectTitle),
    [shots, projectTitle]
  );
  const saasExportBlocked = !canUseSaasFeature('export', getCurrentUserEmail());
  const lifecycleExportBlocked = stageLifecycleStrict && !exportLife.exportReady;
  const exportDisabled = saasExportBlocked || lifecycleExportBlocked || exportBusy || isExportingVideo;

  const pipDragRef = useRef(null);
  const [propsDraft, setPropsDraft] = useState({
    loc: [0, 0, 0],
    rot: [0, 0, 0],
    scl: [1, 1, 1],
    label: ''
  });
  const mediaRecorderRef = useRef(null);

  const autoKeyRef = useRef(true);
  autoKeyRef.current = autoKey;
  const aspectNumericRef = useRef(aspectNumeric);
  aspectNumericRef.current = aspectNumeric;
  modeRef.current = mode;
  planRef.current = plan;
  playRef.current.playing = playing;
  isOrthoRef.current = isOrtho;
  ghostOnRef.current = ghostPrevious;

  const shotLabel = useMemo(() => {
    const id = parseSceneAndShotID(shot, activeShotIndex).shortId;
    return `${id} · ${plan.framingNote || shot?.shotComposition || 'Shot'}`;
  }, [shot, activeShotIndex, plan.framingNote, shot?.shotComposition]);

  const readObjectProps = useCallback((obj) => {
    if (!obj) {
      setPropsDraft({ loc: [0, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1], label: '' });
      return;
    }
    setPropsDraft({
      loc: [obj.position.x, obj.position.y, obj.position.z],
      rot: [obj.rotation.x * DEG, obj.rotation.y * DEG, obj.rotation.z * DEG],
      scl: [obj.scale.x, obj.scale.y, obj.scale.z],
      label: obj.userData.label || obj.userData.kind || 'Object'
    });
  }, []);

  const rebuildMotionPaths = useCallback((nextPlan) => {
    const scene = sceneRef.current;
    if (!scene || !nextPlan) return;
    if (pathGroupRef.current) {
      scene.remove(pathGroupRef.current);
      pathGroupRef.current.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      pathGroupRef.current = null;
    }
    const root = new THREE.Group();
    root.userData.skipPick = true;
    root.userData.isPath = true;
    const sel = selectedRef.current;
    (nextPlan.humans || []).forEach((h, idx) => {
      const keys = sortKeyframes(h.keyframes || []);
      if (keys.length < 2) return;
      const isSel = sel?.userData?.kind === 'human' && sel?.userData?.planIndex === idx;
      const path = makeMotionPath(keys.map((k) => k.position), isSel ? '#f472b6' : '#eab308');
      if (path) root.add(path);
    });
    (nextPlan.cameras || []).forEach((c, idx) => {
      const keys = sortKeyframes(c.keyframes || []);
      if (keys.length < 2) return;
      const isSel = sel?.userData?.kind === 'camera' && sel?.userData?.planIndex === idx;
      const path = makeMotionPath(keys.map((k) => k.position), isSel ? '#22d3ee' : '#64748b');
      if (path) root.add(path);
    });
    scene.add(root);
    pathGroupRef.current = root;
  }, []);

  const syncPlanFromObject = useCallback((obj, { writeKey = false } = {}) => {
    if (!obj || !planRef.current) return;
    const next = {
      ...planRef.current,
      humans: [...(planRef.current.humans || [])],
      cameras: [...(planRef.current.cameras || [])],
      props: [...(planRef.current.props || [])]
    };
    const t = playRef.current.t || 0;
    if (obj.userData.kind === 'human') {
      const idx = obj.userData.planIndex ?? humansRef.current.indexOf(obj);
      if (idx >= 0 && next.humans[idx]) {
        let keys = [...(next.humans[idx].keyframes || [])];
        if (writeKey) keys = upsertKeyframe(keys, captureKeyframeFromObject(obj, t));
        next.humans[idx] = {
          ...next.humans[idx],
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotationY: obj.rotation.y,
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
          pose: normalizePose(obj.userData.pose || next.humans[idx].pose),
          locked: !!obj.userData.locked,
          hidden: obj.visible === false,
          movement: next.humans[idx].movement,
          keyframes: keys
        };
      }
    } else if (obj.userData.kind === 'prop') {
      const idx = obj.userData.planIndex ?? propsRef.current.indexOf(obj);
      if (idx >= 0 && next.props[idx]) {
        next.props[idx] = {
          ...next.props[idx],
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z]
        };
      }
    } else if (obj.userData.kind === 'camera') {
      const idx = obj.userData.planIndex ?? filmCamsRef.current.indexOf(obj);
      if (idx >= 0 && next.cameras[idx]) {
        const aim = aimTargetRef.current;
        const lookAt = aim
          ? [aim.position.x, aim.position.y, aim.position.z]
          : (() => {
            const dir = new THREE.Vector3();
            obj.getWorldDirection(dir);
            const p = obj.position.clone().add(dir.multiplyScalar(4));
            return [p.x, p.y, p.z];
          })();
        if (aim) obj.lookAt(aim.position);
        let keys = [...(next.cameras[idx].keyframes || [])];
        if (writeKey) keys = upsertKeyframe(keys, captureKeyframeFromObject(obj, t));
        next.cameras[idx] = {
          ...next.cameras[idx],
          position: [obj.position.x, obj.position.y, obj.position.z],
          lookAt,
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
          focusDistance: distance3(
            [obj.position.x, obj.position.y, obj.position.z],
            lookAt
          ),
          keyframes: keys
        };
        if (idx === 0 && frustumRef.current) {
          frustumRef.current.cam.position.copy(obj.position);
          frustumRef.current.cam.quaternion.copy(obj.quaternion);
          frustumRef.current.cam.updateMatrixWorld();
          frustumRef.current.helper.update();
          frustumRef.current.lookAt = lookAt;
        }
      }
    } else if (obj.userData.kind === 'aim') {
      const lookAt = [obj.position.x, obj.position.y, obj.position.z];
      if (next.cameras[0]) {
        next.cameras[0] = { ...next.cameras[0], lookAt };
        const cam0 = filmCamsRef.current[0];
        if (cam0) cam0.lookAt(obj.position);
        if (frustumRef.current) {
          frustumRef.current.lookAt = lookAt;
          if (cam0) {
            frustumRef.current.cam.position.copy(cam0.position);
            frustumRef.current.cam.lookAt(obj.position);
            frustumRef.current.cam.updateMatrixWorld();
            frustumRef.current.helper.update();
          }
        }
      }
    }
    planRef.current = next;
    setPlan(next);
    readObjectProps(obj);
    rebuildMotionPaths(next);
  }, [readObjectProps, rebuildMotionPaths]);

  syncPlanFromObjectRef.current = syncPlanFromObject;

  const attachSelection = useCallback((obj) => {
    selectedRef.current = obj;
    const tc = transformRef.current;
    if (tc) {
      if (obj && modeRef.current === 'compose' && !obj.userData.locked) {
        tc.attach(obj);
        tc.enabled = true;
        tc.visible = true;
      } else {
        tc.detach();
        tc.enabled = true;
        tc.visible = false;
      }
    }
      if (obj) {
      setSelectedKey(`${obj.userData.kind}:${obj.userData.planIndex ?? 0}`);
      readObjectProps(obj);
      setPoseVersion((v) => v + 1);
    } else {
      setSelectedKey(null);
      readObjectProps(null);
    }
    if (planRef.current) rebuildMotionPaths(planRef.current);
  }, [readObjectProps, rebuildMotionPaths]);

  const applyPlanToScene = useCallback((nextPlan, opts = {}) => {
    const scene = sceneRef.current;
    if (!scene || !nextPlan) return;
    if (opts.history !== false && planRef.current && nextPlan !== planRef.current) {
      pushStagePlan(historyRef.current, planRef.current);
      setHistoryTick((n) => n + 1);
    }

    if (transformRef.current) {
      transformRef.current.detach();
    }
    selectedRef.current = null;
    setSelectedKey(null);

    humansRef.current.forEach((g) => scene.remove(g));
    if (ghostGroupRef.current) {
      scene.remove(ghostGroupRef.current);
      ghostGroupRef.current = null;
    }
    filmCamsRef.current.forEach((g) => scene.remove(g));
    if (aimTargetRef.current) {
      scene.remove(aimTargetRef.current);
      aimTargetRef.current = null;
    }
    if (aimLineRef.current) {
      scene.remove(aimLineRef.current);
      aimLineRef.current = null;
    }
    if (frustumRef.current) {
      scene.remove(frustumRef.current.helper);
      frustumRef.current = null;
    }
    if (pathGroupRef.current) {
      scene.remove(pathGroupRef.current);
      pathGroupRef.current = null;
    }
    humansRef.current = [];
    filmCamsRef.current = [];
    if (envGroupRef.current) {
      scene.remove(envGroupRef.current);
      envGroupRef.current = null;
    }
    (propsRef.current || []).forEach((g) => scene.remove(g));
    propsRef.current = [];

    (nextPlan.humans || []).forEach((h, idx) => {
      const m = makeMannequin(h);
      const y = h.position[1] != null ? h.position[1] : 0;
      m.position.set(h.position[0], y, h.position[2]);
      if (h.rotation) m.rotation.set(h.rotation[0] || 0, h.rotation[1] || h.rotationY || 0, h.rotation[2] || 0);
      else m.rotation.y = h.rotationY || 0;
      if (h.scale) m.scale.set(h.scale[0] || 1, h.scale[1] || 1, h.scale[2] || 1);
      m.userData.label = h.id;
      m.userData.planIndex = idx;
      m.userData.pose = normalizePose(h.pose);
      m.userData.locked = !!h.locked;
      m.visible = !h.hidden;
      scene.add(m);
      humansRef.current.push(m);
      loadGlbForHuman(m, h);
    });

    if (ghostOnRef.current && previousPlanRef.current?.humans?.length) {
      const ghost = new THREE.Group();
      ghost.name = 'continuityGhost';
      previousPlanRef.current.humans.forEach((h) => {
        const g = makeMannequin(h);
        g.position.set(h.position?.[0] || 0, h.position?.[1] || 0, h.position?.[2] || 0);
        g.rotation.y = h.rotationY || 0;
        g.traverse((o) => {
          if (o.material) {
            const list = Array.isArray(o.material) ? o.material : [o.material];
            const cloned = list.map((mat) => {
              const next = mat.clone();
              next.transparent = true;
              next.opacity = 0.28;
              next.depthWrite = false;
              return next;
            });
            o.material = Array.isArray(o.material) ? cloned : cloned[0];
          }
        });
        g.userData.kind = 'ghost';
        ghost.add(g);
      });
      scene.add(ghost);
      ghostGroupRef.current = ghost;
    }

    const envGroup = makeStageEnvironmentGroup(nextPlan.environment || {});
    scene.add(envGroup);
    envGroupRef.current = envGroup;
    applyStageAtmosphere(scene, nextPlan.environment || {}, {
      ground: groundMeshRef.current,
      keyLight: keyLightRef.current
    });
    applyStageLightingRig(
      {
        keyLight: keyLightRef.current,
        fillLight: fillLightRef.current,
        rimLight: rimLightRef.current,
        hemiLight: hemiLightRef.current
      },
      nextPlan.lighting || {},
      nextPlan.environment || {}
    );

    (nextPlan.props || []).forEach((prop, idx) => {
      const mesh = makeStagePropMesh({ ...prop, planIndex: idx });
      scene.add(mesh);
      propsRef.current.push(mesh);
    });

    (nextPlan.cameras || []).forEach((c, idx) => {
      const cam = makeFilmCamera();
      cam.position.set(c.position[0], c.position[1], c.position[2]);
      if (c.lookAt) cam.lookAt(c.lookAt[0], c.lookAt[1], c.lookAt[2]);
      if (c.scale) cam.scale.set(c.scale[0] || 1, c.scale[1] || 1, c.scale[2] || 1);
      cam.userData.camPlan = c;
      cam.userData.label = c.id || `Camera ${idx + 1}`;
      cam.userData.planIndex = idx;
      scene.add(cam);
      filmCamsRef.current.push(cam);

      if (idx === 0) {
        const { helper, cam: helperCam } = makeFrustumHelper(
          c.focalMm || nextPlan.focalMm,
          aspectNumeric,
          c.sensorWidthMm || 36
        );
        helperCam.position.copy(cam.position);
        helperCam.quaternion.copy(cam.quaternion);
        helperCam.updateProjectionMatrix();
        helper.update();
        scene.add(helper);
        frustumRef.current = { helper, cam: helperCam, lookAt: c.lookAt };

        const look = c.lookAt || [0, 1.2, 0];
        const aim = makeCameraTarget();
        aim.position.set(look[0], look[1], look[2]);
        aim.userData.label = 'Camera target';
        aim.userData.planIndex = 0;
        scene.add(aim);
        aimTargetRef.current = aim;

        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          cam.position.clone(),
          aim.position.clone()
        ]);
        const line = new THREE.Line(
          lineGeo,
          new THREE.LineDashedMaterial({ color: 0xf97316, dashSize: 0.12, gapSize: 0.08, opacity: 0.85, transparent: true })
        );
        line.computeLineDistances();
        line.userData.skipPick = true;
        scene.add(line);
        aimLineRef.current = line;
      }
    });

    planRef.current = nextPlan;
    setPlan(nextPlan);
    setTimeSec(0);
    playRef.current.t = 0;
    rebuildMotionPaths(nextPlan);

    // Camera-crew default: select Camera 1 so Move tools work immediately
    requestAnimationFrame(() => {
      const cam0 = filmCamsRef.current[0];
      if (cam0) {
        selectedRef.current = cam0;
        setSelectedKey('camera:0');
        readObjectProps(cam0);
        const tc = transformRef.current;
        if (tc && modeRef.current === 'compose') {
          tc.attach(cam0);
          tc.visible = true;
        }
      }
    });
  }, [aspectNumeric, rebuildMotionPaths, readObjectProps]);

  const undoStage = useCallback(() => {
    const prev = undoStagePlan(historyRef.current, planRef.current);
    if (!prev) {
      setStatus('Nothing to undo');
      return;
    }
    applyPlanToScene(prev, { history: false });
    persistDirectorToShotRef.current(false, prev);
    setHistoryTick((n) => n + 1);
    setStatus('Undo');
  }, [applyPlanToScene]);

  const redoStage = useCallback(() => {
    const next = redoStagePlan(historyRef.current, planRef.current);
    if (!next) {
      setStatus('Nothing to redo');
      return;
    }
    applyPlanToScene(next, { history: false });
    persistDirectorToShotRef.current(false, next);
    setHistoryTick((n) => n + 1);
    setStatus('Redo');
  }, [applyPlanToScene]);

  useEffect(() => {
    const onKey = (e) => {
      if (!stageHotkeysClaimEvent(e, stageRootRef.current)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = String(e.key).toLowerCase();
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redoStage();
        return;
      }
      if (key === 'z') {
        e.preventDefault();
        undoStage();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoStage, redoStage]);

  // Init WebGL once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = Math.max(320, mount.clientWidth || 960);
    const height = Math.max(220, mount.clientHeight || Math.round(width / Math.max(0.5, aspectNumeric)));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12110f);
    scene.fog = new THREE.Fog(0x12110f, 22, 48);
    sceneRef.current = scene;

    const viewCam = new THREE.PerspectiveCamera(48, width / height, 0.1, 200);
    viewCam.position.set(3.8, 2.4, 5.2);
    viewCamRef.current = viewCam;

    const frustumSize = 8;
    const orthoCam = new THREE.OrthographicCamera(
      (frustumSize * width) / height / -2,
      (frustumSize * width) / height / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      200
    );
    orthoCam.position.copy(viewCam.position);
    orthoCamRef.current = orthoCam;
    activeViewCamRef.current = viewCam;

    const lensCam = new THREE.PerspectiveCamera(54, aspectNumeric, 0.05, 200);
    lensCam.position.set(-2.2, 1.35, 3.2);
    lensCamRef.current = lensCam;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.autoClear = false;
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    let previewRenderer = null;
    const syncPreviewSize = () => {
      const previewMount = previewMountRef.current;
      const pr = previewRendererRef.current || previewRenderer;
      if (!previewMount || !pr) return;
      const ar = Math.max(0.4, aspectNumericRef.current || 21 / 9);
      const rect = previewMount.getBoundingClientRect();
      const pw = Math.max(2, Math.round(rect.width || previewMount.clientWidth || 280));
      const ph = Math.max(2, Math.round(rect.height || previewMount.clientHeight || Math.round(pw / ar)));
      pr.setSize(pw, ph, false);
      pr.domElement.style.width = '100%';
      pr.domElement.style.height = '100%';
      pr.domElement.style.display = 'block';
      if (lensCamRef.current) {
        lensCamRef.current.aspect = ar;
        lensCamRef.current.updateProjectionMatrix();
      }
    };
    const bootPreview = () => {
      const previewMount = previewMountRef.current;
      if (!previewMount || previewRendererRef.current) {
        syncPreviewSize();
        return;
      }
      previewRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      previewMount.innerHTML = '';
      previewMount.appendChild(previewRenderer.domElement);
      previewRendererRef.current = previewRenderer;
      syncPreviewSize();
    };
    requestAnimationFrame(bootPreview);
    setTimeout(bootPreview, 80);
    setTimeout(syncPreviewSize, 200);

    const hemi = new THREE.HemisphereLight(0xe8e8f0, 0x3a3a40, 0.75);
    scene.add(hemi);
    hemiLightRef.current = hemi;
    const key = new THREE.DirectionalLight(0xfff5e8, 1.25);
    key.position.set(4, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.0002;
    scene.add(key);
    keyLightRef.current = key;
    const fill = new THREE.DirectionalLight(0xc8d4ff, 0.35);
    fill.position.set(-6, 4, -2);
    scene.add(fill);
    fillLightRef.current = fill;
    const rim = new THREE.DirectionalLight(0xffffff, 0.2);
    rim.position.set(0, 3, -8);
    scene.add(rim);
    rimLightRef.current = rim;

    const grid = new THREE.GridHelper(24, 24, 0x6a6a6e, 0x404044);
    grid.position.y = 0.001;
    scene.add(grid);
    gridHelperRef.current = grid;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x323236, roughness: 0.92, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    ground.userData.skipPick = true;
    scene.add(ground);
    groundMeshRef.current = ground;

    const controls = new OrbitControls(viewCam, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.1, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 1.2;
    controls.maxDistance = 22;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controlsRef.current = controls;

    const transform = new TransformControls(viewCam, renderer.domElement);
    transform.setMode('translate');
    transform.setSize(0.85);
    transform.addEventListener('dragging-changed', (event) => {
      draggingTransformRef.current = !!event.value;
      controls.enabled = !event.value && modeRef.current === 'compose';
      if (event.value) {
        playRef.current.playing = false;
        setPlaying(false);
        if (planRef.current) {
          pushStagePlan(historyRef.current, planRef.current);
          setHistoryTick((n) => n + 1);
        }
      }
      if (!event.value && selectedRef.current) {
        syncPlanFromObjectRef.current(selectedRef.current, { writeKey: !!autoKeyRef.current });
        persistDirectorToShotRef.current(false);
      }
    });
    transform.addEventListener('objectChange', () => {
      if (selectedRef.current) readObjectProps(selectedRef.current);
    });
    transform.visible = false;
    scene.add(transform.getHelper());
    transformRef.current = transform;

    const viewHelper = new ViewHelper(viewCam, renderer.domElement);
    viewHelper.center = controls.target;
    viewHelperRef.current = viewHelper;

    applyPlanToScene(planRef.current || heuristicStagePlanFromShot(shot, activeShotIndex), { history: false });

    const pickables = () => [
      ...humansRef.current,
      ...filmCamsRef.current,
      ...(propsRef.current || []),
      ...(aimTargetRef.current ? [aimTargetRef.current] : [])
    ];

    const onPointerDown = (event) => {
      if (event.button !== 0 || draggingTransformRef.current) return;
      if (modeRef.current !== 'compose') return;
      if (viewHelperRef.current?.handleClick?.(event)) {
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const cam = activeViewCamRef.current || viewCam;
      raycasterRef.current.setFromCamera(pointerRef.current, cam);
      const hits = raycasterRef.current.intersectObjects(pickables(), true);
      if (!hits.length) {
        attachSelection(null);
        return;
      }
      let obj = hits[0].object;
      while (obj && !obj.userData?.kind) obj = obj.parent;
      if (obj?.userData?.kind) attachSelection(obj);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const onResize = () => {
      if (!mount || !rendererRef.current || !viewCamRef.current) return;
      const w = Math.max(320, mount.clientWidth || 960);
      const h = Math.max(220, mount.clientHeight || 400);
      viewCamRef.current.aspect = w / h;
      viewCamRef.current.updateProjectionMatrix();
      if (orthoCamRef.current) {
        const fs = 8;
        orthoCamRef.current.left = (fs * w) / h / -2;
        orthoCamRef.current.right = (fs * w) / h / 2;
        orthoCamRef.current.top = fs / 2;
        orthoCamRef.current.bottom = fs / -2;
        orthoCamRef.current.updateProjectionMatrix();
      }
      rendererRef.current.setSize(w, h, false);
      if (previewRendererRef.current && previewMountRef.current) {
        const previewMount = previewMountRef.current;
        const ar = Math.max(0.4, aspectNumericRef.current || 21 / 9);
        const rect = previewMount.getBoundingClientRect();
        const pw = Math.max(2, Math.round(rect.width || previewMount.clientWidth || 280));
        const ph = Math.max(2, Math.round(rect.height || previewMount.clientHeight || Math.round(pw / ar)));
        previewRendererRef.current.setSize(pw, ph, false);
        previewRendererRef.current.domElement.style.width = '100%';
        previewRendererRef.current.domElement.style.height = '100%';
        if (lensCamRef.current) {
          lensCamRef.current.aspect = ar;
          lensCamRef.current.updateProjectionMatrix();
        }
      }
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(mount);
    if (previewMountRef.current) ro?.observe(previewMountRef.current);
    window.addEventListener('resize', onResize);

    let helperLast = performance.now();
    const tick = (now) => {
      rafRef.current = requestAnimationFrame(tick);
      const p = planRef.current;
      const play = playRef.current;
      const helperDt = Math.min(0.05, (now - helperLast) / 1000);
      helperLast = now;
      if (play.playing && p) {
        const dt = play.last ? (now - play.last) / 1000 : 0;
        play.last = now;
        play.t = (play.t + dt) % (p.durationSec || 5);
        setTimeSec(play.t);
      } else {
        play.last = now;
      }

      updateGlbMixers(humansRef.current, helperDt);

      const camPlan = p?.cameras?.[0];
      const tNow = play.t;
      const skipDrag = draggingTransformRef.current;

      const applyPoseToObject = (obj, pose, isCamera) => {
        if (!obj || !pose) return;
        obj.position.set(pose.position[0], pose.position[1], pose.position[2]);
        if (isCamera && pose.lookAt) {
          obj.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
        } else if (pose.rotation) {
          obj.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
        }
        if (!isCamera && pose.pose) {
          applyMannequinPose(obj, pose.pose);
        }
      };

      const speakLine = speakingLineAt(p?.dialogue, tNow);
      const speakerId = speakLine?.speakerId || timelineSpeakerAt(p, tNow);

      // Humans — keyframe tracks (path + body pose)
      (p?.humans || []).forEach((h, idx) => {
        const obj = humansRef.current[idx];
        if (!obj) return;
        if (h.locked || obj.userData.locked) return;
        if (skipDrag && selectedRef.current === obj) return;
        const keyed = evalKeyframeTrack(h.keyframes, tNow);
        const basePose = keyed?.pose || h.pose;
        const speaking = speakerId && h.id === speakerId;
        const facePose = applySpeakMouth(basePose, tNow, speaking, speakLine);
        if (keyed) {
          applyPoseToObject(obj, { ...keyed, pose: facePose }, false);
        } else if (facePose) {
          applyMannequinPose(obj, facePose);
        }
        applyLipSyncMorphs(obj, facePose);
        playGlbClipIntent(obj, glbClipIntentFromHuman(h));
      });

      // Cameras — keyframes (from prompt bake) win over procedural animation
      (p?.cameras || []).forEach((c, idx) => {
        const obj = filmCamsRef.current[idx];
        if (!obj) return;
        if (skipDrag && selectedRef.current === obj) return;
        const keyed = evalKeyframeTrack(c.keyframes, tNow);
        if (keyed) {
          applyPoseToObject(obj, keyed, true);
          if (idx === 0 && frustumRef.current) {
            frustumRef.current.cam.position.copy(obj.position);
            frustumRef.current.cam.quaternion.copy(obj.quaternion);
            frustumRef.current.cam.updateMatrixWorld();
            frustumRef.current.helper.update();
          }
          return;
        }
        if (idx === 0 && camPlan && (play.playing || tNow > 0.001)) {
          const pose = evalCameraPose(camPlan, tNow, p.durationSec || 5);
          obj.position.copy(pose.position);
          obj.lookAt(pose.lookAt);
          if (frustumRef.current) {
            frustumRef.current.cam.position.copy(pose.position);
            frustumRef.current.cam.lookAt(pose.lookAt);
            frustumRef.current.cam.updateMatrixWorld();
            frustumRef.current.helper.update();
          }
        }
      });

      // Keep aim dummy + dashed line in sync with Camera 1 lookAt
      if (aimTargetRef.current && camPlan) {
        const keyedLook = evalKeyframeTrack(camPlan.keyframes, tNow)?.lookAt;
        const look = keyedLook || camPlan.lookAt || [0, 1.2, 0];
        if (!(skipDrag && selectedRef.current === aimTargetRef.current)) {
          aimTargetRef.current.position.set(look[0], look[1], look[2]);
        } else {
          // while dragging aim, push lookAt live into plan + cameras
          const a = aimTargetRef.current.position;
          camPlan.lookAt = [a.x, a.y, a.z];
          const cam0 = filmCamsRef.current[0];
          if (cam0) cam0.lookAt(a);
        }
        if (aimLineRef.current && filmCamsRef.current[0]) {
          const pts = aimLineRef.current.geometry.attributes.position;
          const camPos = filmCamsRef.current[0].position;
          const aimPos = aimTargetRef.current.position;
          pts.setXYZ(0, camPos.x, camPos.y, camPos.z);
          pts.setXYZ(1, aimPos.x, aimPos.y, aimPos.z);
          pts.needsUpdate = true;
          aimLineRef.current.computeLineDistances();
        }
      }

      if (camPlan && lensCamRef.current) {
        const keyed = evalKeyframeTrack(camPlan.keyframes, tNow);
        const aimPos = aimTargetRef.current?.position;
        if (keyed) {
          lensCamRef.current.position.set(keyed.position[0], keyed.position[1], keyed.position[2]);
          if (keyed.lookAt) lensCamRef.current.lookAt(keyed.lookAt[0], keyed.lookAt[1], keyed.lookAt[2]);
          else if (aimPos) lensCamRef.current.lookAt(aimPos);
          else lensCamRef.current.rotation.set(keyed.rotation[0], keyed.rotation[1], keyed.rotation[2]);
        } else if (aimPos && !(play.playing || tNow > 0.001)) {
          const cam0 = filmCamsRef.current[0];
          if (cam0) {
            lensCamRef.current.position.copy(cam0.position);
            lensCamRef.current.lookAt(aimPos);
          } else {
            const pose = evalCameraPose(camPlan, tNow, p.durationSec || 5);
            lensCamRef.current.position.copy(pose.position);
            lensCamRef.current.lookAt(aimPos);
          }
        } else {
          const pose = evalCameraPose(camPlan, tNow, p.durationSec || 5);
          lensCamRef.current.position.copy(pose.position);
          lensCamRef.current.lookAt(aimPos || pose.lookAt);
        }
        const fov = focalMmToFov(camPlan.focalMm || p.focalMm || 35, camPlan.sensorWidthMm || 36);
        lensCamRef.current.fov = fov;
        lensCamRef.current.aspect = Math.max(0.4, aspectNumericRef.current || 21 / 9);
        lensCamRef.current.near = p.clipNear || 0.05;
        lensCamRef.current.far = p.clipFar || 200;
        lensCamRef.current.updateProjectionMatrix();
      }

      const setGizmosVisible = (visible) => {
        filmCamsRef.current.forEach((g) => { g.visible = visible; });
        if (aimTargetRef.current) aimTargetRef.current.visible = visible;
        if (aimLineRef.current) aimLineRef.current.visible = visible;
        if (frustumRef.current?.helper) frustumRef.current.helper.visible = visible;
        if (pathGroupRef.current) pathGroupRef.current.visible = visible;
        if (transformRef.current) transformRef.current.visible = visible && !!selectedRef.current && modeRef.current === 'compose';
      };

      const activeCam = isOrthoRef.current && orthoCamRef.current ? orthoCamRef.current : viewCamRef.current;
      activeViewCamRef.current = activeCam;

      if (isOrthoRef.current && orthoCamRef.current && viewCamRef.current) {
        orthoCamRef.current.position.copy(viewCamRef.current.position);
        orthoCamRef.current.quaternion.copy(viewCamRef.current.quaternion);
      }

      const lensOnly = exportLensOnlyRef.current || modeRef.current === 'shoot';
      if (lensOnly && camPlan && viewCamRef.current && lensCamRef.current) {
        viewCamRef.current.fov = lensCamRef.current.fov;
        viewCamRef.current.aspect = lensCamRef.current.aspect;
        viewCamRef.current.position.copy(lensCamRef.current.position);
        viewCamRef.current.quaternion.copy(lensCamRef.current.quaternion);
        viewCamRef.current.updateProjectionMatrix();
        if (controlsRef.current) controlsRef.current.enabled = false;
        if (transformRef.current) transformRef.current.visible = false;
        setGizmosVisible(false);
      } else if (controlsRef.current && viewCamRef.current) {
        if (!draggingTransformRef.current) controlsRef.current.enabled = true;
        controlsRef.current.update();
        if (!isOrthoRef.current && Math.abs(viewCamRef.current.fov - 50) > 0.05) {
          viewCamRef.current.fov = 50;
          viewCamRef.current.updateProjectionMatrix();
        }
        setGizmosVisible(true);
      }

      if (envGroupRef.current) applyPracticalsAtTime(envGroupRef.current, tNow);

      if (viewHelperRef.current?.animating) {
        viewHelperRef.current.update(helperDt);
      }

      renderer.clear();
      renderer.render(scene, lensOnly ? viewCamRef.current : activeCam);

      if (viewHelperRef.current && !lensOnly) {
        viewHelper.center.copy(controls.target);
        viewHelper.render(renderer);
      }

      if (previewRendererRef.current && lensCamRef.current) {
        const needRestore = !lensOnly;
        if (needRestore) setGizmosVisible(false);
        previewRendererRef.current.render(scene, lensCamRef.current);
        if (needRestore) setGizmosVisible(true);
      }
    };
    tick(performance.now());

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      ro?.disconnect();
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      transform.dispose();
      viewHelper.dispose?.();
      controls.dispose();
      renderer.dispose();
      if (previewRendererRef.current) {
        try {
          previewRendererRef.current.dispose();
          const el = previewRendererRef.current.domElement;
          if (el?.parentNode) el.parentNode.removeChild(el);
        } catch {
          /* ignore */
        }
      }
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      if (renderer.domElement?.parentNode === mount) mount.removeChild(renderer.domElement);
      rendererRef.current = null;
      previewRendererRef.current = null;
      sceneRef.current = null;
      lensCamRef.current = null;
      transformRef.current = null;
      viewHelperRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const heuristic = heuristicStagePlanFromShot(shot, activeShotIndex);
    const restored = planFromDirectorStage(shot?.directorStage, heuristic);
    applyPlanToScene(normalizeStagePlan(restored || heuristic, shot), { history: false });
    setMatchReport(null);
    setStatus(
      restored
        ? `Restored Stage for ${parseSceneAndShotID(shot, activeShotIndex).shortId}`
        : `Loaded craft blocking for ${parseSceneAndShotID(shot, activeShotIndex).shortId}`
    );
  }, [shot?.sceneShotId, activeShotIndex, applyPlanToScene]);

  useEffect(() => {
    const tc = transformRef.current;
    if (!tc) return;
    tc.setMode(transformMode);
  }, [transformMode]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (navTool === 'pan') {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
      };
    } else if (navTool === 'zoom') {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.DOLLY,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
    } else {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
    }
  }, [navTool]);

  useEffect(() => {
    const tc = transformRef.current;
    if (!tc) return;
    if (mode === 'compose' && selectedRef.current && !selectedRef.current.userData.locked) {
      tc.attach(selectedRef.current);
      tc.visible = true;
    } else {
      tc.detach();
      tc.visible = false;
    }
  }, [mode]);

  const zoomBy = useCallback((factor) => {
    const cam = viewCamRef.current;
    const controls = controlsRef.current;
    if (!cam || !controls) return;
    const offset = cam.position.clone().sub(controls.target);
    offset.multiplyScalar(factor);
    const next = controls.target.clone().add(offset);
    const dist = next.distanceTo(controls.target);
    if (dist < controls.minDistance || dist > controls.maxDistance) return;
    cam.position.copy(next);
    if (orthoCamRef.current) {
      orthoCamRef.current.position.copy(next);
      const zoom = orthoCamRef.current.zoom * (factor < 1 ? 1.15 : 1 / 1.15);
      orthoCamRef.current.zoom = Math.min(8, Math.max(0.25, zoom));
      orthoCamRef.current.updateProjectionMatrix();
    }
    controls.update();
  }, []);

  const fitToScreen = useCallback(() => {
    const controls = controlsRef.current;
    const cam = viewCamRef.current;
    if (!controls || !cam) return;

    const box = new THREE.Box3();
    const focus = selectedRef.current
      ? [selectedRef.current]
      : [...humansRef.current, ...filmCamsRef.current];

    focus.forEach((obj) => {
      if (obj) box.expandByObject(obj);
    });

    if (box.isEmpty()) {
      controls.target.set(0, 1.1, 0);
      cam.position.set(5.2, 3.2, 6.2);
      controls.update();
      setStatus('Fit to screen (empty stage)');
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.8);
    const fov = (cam.fov || 50) * (Math.PI / 180);
    let dist = (maxDim * 0.55) / Math.tan(fov / 2);
    dist = Math.max(controls.minDistance + 0.4, Math.min(controls.maxDistance - 0.4, dist * 1.55));

    let dir = cam.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(1.2, 0.7, 1.4);
    dir.normalize();

    controls.target.copy(center);
    cam.position.copy(center).addScaledVector(dir, dist);
    if (orthoCamRef.current) {
      orthoCamRef.current.position.copy(cam.position);
      orthoCamRef.current.zoom = Math.min(5, Math.max(0.35, 7 / maxDim));
      orthoCamRef.current.updateProjectionMatrix();
    }
    controls.update();
    setStatus(selectedRef.current ? 'Fit selection to screen' : 'Fit stage to screen');
  }, []);

  const snapSelectedToGround = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || (obj.userData.kind !== 'human' && obj.userData.kind !== 'aim')) {
      setStatus('Select a character first');
      return;
    }
    if (obj.userData.locked) {
      setStatus('Unlock to snap');
      return;
    }
    obj.position.y = 0;
    syncPlanFromObject(obj, { writeKey: !!autoKeyRef.current });
    setStatus(`Snapped ${obj.userData.label || 'selection'} to ground`);
  }, [syncPlanFromObject]);

  const frameSelected = useCallback(() => {
    if (!selectedRef.current) {
      setStatus('Select a character first');
      return;
    }
    fitToScreen();
  }, [fitToScreen]);

  const duplicateSelected = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) {
      setStatus('Select a character to duplicate');
      return;
    }
    const src = planRef.current.humans[obj.userData.planIndex];
    if (!src) return;
    const next = { ...planRef.current, humans: [...planRef.current.humans] };
    next.humans.push({
      ...src,
      id: `${src.id} copy`,
      figureSource: src.figureSource || 'mannequin',
      glbUrl: src.glbUrl || '',
      position: [(src.position?.[0] || 0) + 0.55, src.position?.[1] || 0, src.position?.[2] || 0]
    });
    applyPlanToScene(next);
    requestAnimationFrame(() => {
      const last = humansRef.current[humansRef.current.length - 1];
      if (last) attachSelection(last);
    });
    setStatus(`Duplicated ${src.id}`);
  }, [applyPlanToScene, attachSelection]);

  const resetSelectedTransform = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human') {
      setStatus('Select a character to reset');
      return;
    }
    if (obj.userData.locked) {
      setStatus('Unlock to reset');
      return;
    }
    const idx = obj.userData.planIndex ?? 0;
    obj.position.set(idx === 0 ? -0.45 : 0.55 + (idx - 1) * 0.5, 0, 0);
    obj.rotation.set(0, idx === 0 ? 0.25 : -0.35, 0);
    obj.scale.set(1, 1, 1);
    syncPlanFromObject(obj);
    setStatus(`Reset ${obj.userData.label || 'character'} place / turn`);
  }, [syncPlanFromObject]);

  const focusSelected = useCallback(() => {
    const obj = selectedRef.current;
    const controls = controlsRef.current;
    if (!obj || !controls) {
      setStatus('Select a character first');
      return;
    }
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) {
      controls.target.copy(obj.position);
    } else {
      controls.target.copy(box.getCenter(new THREE.Vector3()));
    }
    controls.update();
    setStatus(`Focus ${obj.userData.label || 'selection'}`);
  }, []);

  const toggleLockSelected = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human') {
      setStatus('Select a character to lock');
      return;
    }
    obj.userData.locked = !obj.userData.locked;
    const tc = transformRef.current;
    if (tc) {
      if (obj.userData.locked || modeRef.current !== 'compose') {
        tc.detach();
        tc.visible = false;
      } else {
        tc.attach(obj);
        tc.visible = true;
      }
    }
    syncPlanFromObject(obj);
    setStatus(obj.userData.locked
      ? `Locked ${obj.userData.label || 'character'}`
      : `Unlocked ${obj.userData.label || 'character'}`);
  }, [syncPlanFromObject]);

  const hideSelected = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human') {
      setStatus('Select a character to hide');
      return;
    }
    const label = obj.userData.label || 'character';
    obj.visible = false;
    syncPlanFromObject(obj);
    attachSelection(null);
    setStatus(`Hidden ${label} — Show to restore`);
  }, [syncPlanFromObject, attachSelection]);

  const showHiddenCharacters = useCallback(() => {
    const planNow = planRef.current;
    if (!planNow?.humans?.length) return;
    let n = 0;
    const humans = planNow.humans.map((h, i) => {
      const obj = humansRef.current[i];
      if (obj && !obj.visible) n += 1;
      if (obj) obj.visible = true;
      return h.hidden ? { ...h, hidden: false } : h;
    });
    const next = { ...planNow, humans };
    planRef.current = next;
    setPlan(next);
    setStatus(n ? `Showed ${n} character(s)` : 'No hidden characters');
  }, []);

  const startPipDrag = useCallback((e) => {
    if (pipPinned || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...pipPos };
    pipDragRef.current = { startX, startY, origin };
    const onMove = (ev) => {
      if (!pipDragRef.current) return;
      const dx = ev.clientX - pipDragRef.current.startX;
      const dy = pipDragRef.current.startY - ev.clientY; // y measured from bottom
      setPipPos({
        x: Math.max(8, pipDragRef.current.origin.x + dx),
        y: Math.max(72, pipDragRef.current.origin.y + dy)
      });
    };
    const onUp = () => {
      pipDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [pipPinned, pipPos]);

  const dismissCrewTips = useCallback(() => {
    setShowCrewTips(false);
    try {
      localStorage.setItem('sps_3d_crew_tips_dismissed', '1');
    } catch {
      /* ignore */
    }
  }, []);

  const selectPrimaryCamera = useCallback(() => {
    const cam0 = filmCamsRef.current[0];
    if (!cam0) return;
    attachSelection(cam0);
    setMode('compose');
    setStatus('Camera 1 selected — Move / Turn to frame');
  }, [attachSelection]);

  const toggleOrtho = useCallback(() => {
    setIsOrtho((v) => {
      const next = !v;
      isOrthoRef.current = next;
      const controls = controlsRef.current;
      const viewCam = viewCamRef.current;
      const ortho = orthoCamRef.current;
      if (controls && viewCam && ortho) {
        if (next) {
          ortho.position.copy(viewCam.position);
          ortho.quaternion.copy(viewCam.quaternion);
          controls.object = ortho;
          activeViewCamRef.current = ortho;
          if (transformRef.current) transformRef.current.camera = ortho;
          if (viewHelperRef.current) viewHelperRef.current.userData = viewHelperRef.current.userData;
        } else {
          viewCam.position.copy(ortho.position);
          viewCam.quaternion.copy(ortho.quaternion);
          controls.object = viewCam;
          activeViewCamRef.current = viewCam;
          if (transformRef.current) transformRef.current.camera = viewCam;
        }
        controls.update();
      }
      setStatus(next ? 'Orthographic view' : 'Perspective view');
      return next;
    });
  }, []);

  const goToCameraView = useCallback(() => {
    setMode((m) => (m === 'shoot' ? 'compose' : 'shoot'));
  }, []);

  const applyPropsDraft = useCallback((nextDraft) => {
    const obj = selectedRef.current;
    if (!obj) return;
    if (obj.userData.locked) {
      setStatus('Unlock to edit position');
      return;
    }
    const d = nextDraft || propsDraft;
    obj.position.set(d.loc[0], d.loc[1], d.loc[2]);
    obj.rotation.set(d.rot[0] * RAD, d.rot[1] * RAD, d.rot[2] * RAD);
    obj.scale.set(
      Math.max(0.05, d.scl[0]),
      Math.max(0.05, d.scl[1]),
      Math.max(0.05, d.scl[2])
    );
    syncPlanFromObject(obj);
  }, [propsDraft, syncPlanFromObject]);

  const patchSelectedLoc = useCallback((axis, raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || !selectedRef.current) return;
    const loc = [...propsDraft.loc];
    loc[axis] = n;
    const next = { ...propsDraft, loc };
    setPropsDraft(next);
    applyPropsDraft(next);
  }, [propsDraft, applyPropsDraft]);

  const updateCameraSettings = useCallback((patch) => {
    const next = { ...plan, cameras: [...(plan.cameras || [])] };
    Object.assign(next, patch);
    if (patch.focalMm != null && next.cameras[0]) {
      next.cameras[0] = { ...next.cameras[0], focalMm: patch.focalMm };
      next.focalMm = patch.focalMm;
    }
    if (patch.sensorWidthMm != null && next.cameras[0]) {
      next.cameras[0] = { ...next.cameras[0], sensorWidthMm: patch.sensorWidthMm };
    }
    if (patch.aperture != null) {
      next.aperture = patch.aperture;
      if (next.cameras[0]) next.cameras[0] = { ...next.cameras[0], aperture: patch.aperture };
    }
    if (patch.animationType && next.cameras[0]) {
      const dur = next.durationSec || 5;
      next.cameras[0] = {
        ...next.cameras[0],
        animation: applyCameraMoveType(next.cameras[0], patch.animationType, dur),
        keyframes: []
      };
      next.cameras[0].keyframes = bakeCameraKeyframes(
        next.cameras[0],
        dur,
        8
      );
    }
    if (patch.easing && next.cameras[0]) {
      next.cameras[0] = {
        ...next.cameras[0],
        animation: {
          ...(next.cameras[0].animation || {}),
          easing: patch.easing
        },
        keyframes: []
      };
      next.cameras[0].keyframes = bakeCameraKeyframes(
        next.cameras[0],
        next.durationSec || 5,
        8
      );
    }
    if (patch.durationSec != null && next.cameras[0]) {
      const anim = {
        ...(next.cameras[0].animation || {}),
        duration: patch.durationSec
      };
      next.cameras[0] = {
        ...next.cameras[0],
        animation: anim,
        keyframes: bakeCameraKeyframes(
          { ...next.cameras[0], animation: anim },
          patch.durationSec,
          8
        )
      };
    }
    applyPlanToScene(next);
    const mm = next.cameras?.[0]?.focalMm || next.focalMm;
    setStatus(
      patch.animationType
        ? `${normalizeMoveType(patch.animationType)} · ${mm}mm`
        : `${mm}mm · ${focalMmToFov(mm, next.cameras?.[0]?.sensorWidthMm || 36).toFixed(0)}°`
    );
  }, [plan, applyPlanToScene]);

  const applyMannequinAnimPreset = useCallback((animId) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) {
      setStatus('Select a mannequin first');
      return;
    }
    const idx = obj.userData.planIndex;
    const next = {
      ...planRef.current,
      humans: [...(planRef.current.humans || [])],
      cameras: [...(planRef.current.cameras || [])]
    };
    const human = next.humans[idx];
    if (!human) return;
    const keys = bakeMannequinAnimation(human, animId, next.durationSec || 5);
    next.humans[idx] = { ...human, keyframes: keys, pose: keys[0]?.pose || human.pose };
    if (keys[0]?.pose) applyMannequinPose(obj, keys[0].pose);
    planRef.current = next;
    setPlan(next);
    rebuildMotionPaths(next);
    setPlaying(true);
    setStatus(`Mannequin anim: ${animId}`);
  }, [rebuildMotionPaths]);

  const applySelectedCharacterMove = useCallback((patch) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) {
      setStatus('Select a character first');
      return;
    }
    if (obj.userData.locked) {
      setStatus('Unlock to change movement');
      return;
    }
    const idx = obj.userData.planIndex;
    const next = {
      ...planRef.current,
      humans: [...(planRef.current.humans || [])]
    };
    const human = next.humans[idx];
    if (!human) return;
    const movement = applyCharacterMoveType(human, patch.type || human.movement?.type, patch);
    next.humans[idx] = {
      ...human,
      movement,
      keyframes: []
    };
    next.humans[idx].keyframes = bakeCharacterMove(
      next.humans[idx],
      next.humans,
      next.durationSec || 5,
      shot,
      { cameras: next.cameras, props: next.props }
    );
    applyPlanToScene(next);
    requestAnimationFrame(() => {
      const restored = humansRef.current[idx];
      if (restored) attachSelection(restored);
    });
    const tag = movement.inferred ? 'INFERRED' : movement.type;
    setStatus(`${human.id || 'Character'} · ${tag}${movement.needsDirection ? ' · Needs Direction' : ''}`);
  }, [applyPlanToScene, attachSelection, shot]);

  const applySelectedGaze = useCallback((patch) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) {
      setStatus('Select a character first');
      return;
    }
    if (obj.userData.locked) {
      setStatus('Unlock to change look');
      return;
    }
    const idx = obj.userData.planIndex;
    const next = {
      ...planRef.current,
      humans: [...(planRef.current.humans || [])]
    };
    const human = next.humans[idx];
    if (!human) return;
    const gaze = applyEyeHeadType(human, patch.eyeTarget || human.gaze?.eyeTarget, patch);
    next.humans[idx] = { ...human, gaze, keyframes: [] };
    next.humans[idx].keyframes = bakeCharacterMove(
      next.humans[idx],
      next.humans,
      next.durationSec || 5,
      shot,
      { cameras: next.cameras, props: next.props }
    );
    applyPlanToScene(next);
    requestAnimationFrame(() => {
      const restored = humansRef.current[idx];
      if (restored) attachSelection(restored);
    });
    const tag = gaze.inferred ? 'INFERRED' : gaze.eyeTarget;
    setStatus(`${human.id || 'Character'} · look ${tag}${gaze.needsDirection ? ' · Needs Direction' : ''}`);
  }, [applyPlanToScene, attachSelection, shot]);

  const rebakeSelectedHuman = (next, idx) => {
    next.humans[idx].keyframes = bakeCharacterMove(
      next.humans[idx],
      next.humans,
      next.durationSec || 5,
      shot,
      { cameras: next.cameras, props: next.props }
    );
  };

  const applySelectedExpression = useCallback((patch) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) {
      setStatus('Select a character first');
      return;
    }
    if (obj.userData.locked) {
      setStatus('Unlock to change expression');
      return;
    }
    const idx = obj.userData.planIndex;
    const next = { ...planRef.current, humans: [...(planRef.current.humans || [])] };
    const human = next.humans[idx];
    if (!human) return;
    const expression = applyExpressionType(human, patch.id || human.expression?.id, patch);
    next.humans[idx] = { ...human, expression, keyframes: [] };
    rebakeSelectedHuman(next, idx);
    applyPlanToScene(next);
    requestAnimationFrame(() => {
      const restored = humansRef.current[idx];
      if (restored) attachSelection(restored);
    });
    const tag = expression.inferred ? 'INFERRED' : expression.id;
    setStatus(`${human.id || 'Character'} · ${tag}${expression.needsDirection ? ' · Needs Direction' : ''}`);
  }, [applyPlanToScene, attachSelection, shot]);

  const applySelectedInteraction = useCallback((patch) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) {
      setStatus('Select a character first');
      return;
    }
    if (obj.userData.locked) {
      setStatus('Unlock to change interaction');
      return;
    }
    const idx = obj.userData.planIndex;
    const next = { ...planRef.current, humans: [...(planRef.current.humans || [])] };
    const human = next.humans[idx];
    if (!human) return;
    const other = next.humans.find((h) => h && h.id !== human.id);
    const interaction = applyInteractionType(human, patch.type || human.interaction?.type, {
      ...patch,
      targetId: patch.targetId || human.interaction?.targetId || other?.id || ''
    });
    let gaze = human.gaze;
    if (interaction.type === 'look_at') {
      gaze = applyEyeHeadType(human, 'costar', { eyeTargetId: interaction.targetId });
    }
    next.humans[idx] = { ...human, interaction, gaze, keyframes: [] };
    if (interaction.type === 'walk_toward') {
      next.humans[idx].movement = applyCharacterMoveType(next.humans[idx], 'walk_toward');
    }
    rebakeSelectedHuman(next, idx);
    applyPlanToScene(next);
    requestAnimationFrame(() => {
      const restored = humansRef.current[idx];
      if (restored) attachSelection(restored);
    });
    const tag = interaction.inferred ? 'INFERRED' : interaction.type;
    setStatus(`${human.id || 'Character'} · ${tag}${interaction.needsDirection ? ' · Needs Direction' : ''}`);
  }, [applyPlanToScene, attachSelection, shot]);

  const updateSelectedHumanPose = useCallback((posePatch, presetName) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) return;
    const idx = obj.userData.planIndex;
    const next = {
      ...planRef.current,
      humans: [...(planRef.current.humans || [])],
      cameras: [...(planRef.current.cameras || [])]
    };
    if (!next.humans[idx]) return;
    let pose = normalizePose({ ...(obj.userData.pose || next.humans[idx].pose || defaultPose()), ...posePatch });
    if (presetName && (STUDIO_POSE_PRESETS[presetName] || POSE_PRESETS[presetName])) {
      const fn = STUDIO_POSE_PRESETS[presetName] || POSE_PRESETS[presetName];
      pose = normalizePose(fn());
    }
    applyMannequinPose(obj, pose);
    next.humans[idx] = {
      ...next.humans[idx],
      pose,
      poseName: presetName || next.humans[idx].poseName
    };
    // Keep current key in sync when AutoKey is on
    if (autoKeyRef.current) {
      const t = playRef.current.t || 0;
      next.humans[idx].keyframes = upsertKeyframe(
        next.humans[idx].keyframes || [],
        captureKeyframeFromObject(obj, t)
      );
    }
    planRef.current = next;
    setPlan(next);
    rebuildMotionPaths(next);
    setPoseVersion((v) => v + 1);
    setStatus(presetName ? `Pose: ${presetName}` : 'Pose updated');
  }, [rebuildMotionPaths]);

  const runCompose = async (userInstruction = '') => {
    setIsComposing(true);
    setStatus('Composing stage from active shot…');
    try {
      const result = await compose3DStageFromMasterCinema(shot || {}, activeShotIndex, {
        projectTitle: projectTitle || 'Project',
        userInstruction
      });
      applyPlanToScene(result.plan);
      setChatLog((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `${result.message}\n${result.plan.framingNote} · ${result.plan.motionNote} · ${result.plan.focalMm}mm · ${result.plan.durationSec}s`
        }
      ]);
      setStatus(result.message);
      setPlaying(true);
    } finally {
      setIsComposing(false);
    }
  };

  const addComponent = (type) => {
    const next = { ...plan, humans: [...(plan.humans || [])], cameras: [...(plan.cameras || [])] };
    if (type === 'human') {
      const n = next.humans.length + 1;
      next.humans.push({
        id: `Human ${n}`,
        position: [n * 0.55 - 0.8, 0, 0.1 * n],
        rotationY: 0,
        color: n % 2 ? '#e8b84a' : '#e0a830',
        figureSource: 'mannequin',
        charAssetId: ''
      });
    } else if (type === 'camera') {
      const n = next.cameras.length + 1;
      next.cameras.push({
        id: `Camera ${n}`,
        position: [-2 + n, 1.4, 3.2],
        lookAt: [0, 1.2, 0],
        focalMm: plan.focalMm || 35,
        animation: { type: 'static', radius: 3, height: 1.4, revolutions: 0 }
      });
    } else if (type === 'target') {
      const look = next.cameras[0]?.lookAt || [0, 1.2, 0];
      if (next.cameras[0]) next.cameras[0] = { ...next.cameras[0], lookAt: [...look] };
      applyPlanToScene(next);
      requestAnimationFrame(() => {
        if (aimTargetRef.current) attachSelection(aimTargetRef.current);
      });
      setStatus('Camera target dummy ready — Move it to aim Camera 1');
      return;
    } else if (type === 'cube') {
      const n = next.humans.length + 1;
      next.humans.push({
        id: `Prop ${n}`,
        position: [0.8, 0, -0.6],
        rotationY: 0,
        color: '#38bdf8'
      });
    }
    applyPlanToScene(next);
    setStatus(`Added ${type}`);
  };

  const insertKeyframeAtPlayhead = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || !planRef.current) {
      setStatus('Select a camera or mannequin, then insert a keyframe');
      return;
    }
    if (obj.userData.kind === 'aim') {
      // Key on aim = lookAt key on Camera 1
      const cam = filmCamsRef.current[0];
      if (cam) {
        syncPlanFromObject(obj, { writeKey: false });
        const next = {
          ...planRef.current,
          cameras: [...(planRef.current.cameras || [])]
        };
        if (!next.cameras[0]) return;
        const t = playRef.current.t || 0;
        const lookAt = [obj.position.x, obj.position.y, obj.position.z];
        let keys = [...(next.cameras[0].keyframes || [])];
        const pos = next.cameras[0].position || [cam.position.x, cam.position.y, cam.position.z];
        keys = upsertKeyframe(keys, {
          t,
          position: [...pos],
          rotation: [cam.rotation.x, cam.rotation.y, cam.rotation.z],
          lookAt
        });
        next.cameras[0] = { ...next.cameras[0], lookAt, keyframes: keys };
        planRef.current = next;
        setPlan(next);
        rebuildMotionPaths(next);
        setStatus(`Aim key at ${t.toFixed(2)}s · Camera 1 look-at`);
      }
      return;
    }
    setPlaying(false);
    const t = playRef.current.t || 0;
    const next = {
      ...planRef.current,
      humans: [...(planRef.current.humans || [])],
      cameras: [...(planRef.current.cameras || [])]
    };
    const kind = obj.userData.kind;
    const idx = obj.userData.planIndex;
    const entry = kind === 'human' ? next.humans[idx] : next.cameras[idx];
    if (!entry) return;

    let keys = [...(entry.keyframes || [])];
    if (!keys.length && t > 0.05) {
      const basePos = entry.position || [obj.position.x, obj.position.y, obj.position.z];
      const baseRot = entry.rotation || [0, entry.rotationY || 0, 0];
      const seed = {
        t: 0,
        position: [basePos[0], basePos[1] ?? 0, basePos[2]],
        rotation: [...baseRot]
      };
      if (kind === 'camera' && entry.lookAt) seed.lookAt = [...entry.lookAt];
      keys.push(seed);
    }
    keys = upsertKeyframe(keys, captureKeyframeFromObject(obj, t));
    if (kind === 'human') next.humans[idx] = { ...entry, keyframes: keys };
    else next.cameras[idx] = { ...entry, keyframes: keys };

    planRef.current = next;
    setPlan(next);
    rebuildMotionPaths(next);
    setStatus(`Keyframe at ${t.toFixed(2)}s · ${keys.length} keys on ${entry.id || kind}`);
  }, [rebuildMotionPaths, syncPlanFromObject]);

  const deleteKeyframeAtPlayhead = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || !planRef.current) return;
    const t = playRef.current.t || 0;
    const next = {
      ...planRef.current,
      humans: [...(planRef.current.humans || [])],
      cameras: [...(planRef.current.cameras || [])]
    };
    const kind = obj.userData.kind;
    const idx = obj.userData.planIndex;
    const entry = kind === 'human' ? next.humans[idx] : next.cameras[idx];
    if (!entry?.keyframes?.length) return;
    const keys = sortKeyframes(entry.keyframes).filter((k) => Math.abs(k.t - t) > 0.08);
    if (kind === 'human') next.humans[idx] = { ...entry, keyframes: keys };
    else next.cameras[idx] = { ...entry, keyframes: keys };
    planRef.current = next;
    setPlan(next);
    rebuildMotionPaths(next);
    setStatus(keys.length ? `Deleted key near ${t.toFixed(2)}s` : 'All keyframes cleared for selection');
  }, [rebuildMotionPaths]);

  const clearSelectedKeyframes = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || !planRef.current) return;
    const next = {
      ...planRef.current,
      humans: [...(planRef.current.humans || [])],
      cameras: [...(planRef.current.cameras || [])]
    };
    const kind = obj.userData.kind;
    const idx = obj.userData.planIndex;
    if (kind === 'human' && next.humans[idx]) next.humans[idx] = { ...next.humans[idx], keyframes: [] };
    if (kind === 'camera' && next.cameras[idx]) next.cameras[idx] = { ...next.cameras[idx], keyframes: [] };
    planRef.current = next;
    setPlan(next);
    rebuildMotionPaths(next);
    setStatus('Cleared motion path / keyframes');
  }, [rebuildMotionPaths]);

  const applyDepthVideoToMannequin = useCallback(async (file) => {
    if (!file) return;
    const humanIdx = selectedKey?.startsWith('human:')
      ? Number(selectedKey.split(':')[1])
      : 0;
    const human = planRef.current?.humans?.[humanIdx];
    if (!human) {
      setStatus('Add / select a mannequin first');
      return;
    }
    setDepthBusy(true);
    setStatus(`Reading local depth video (stays on disk)…`);
    try {
      const keys = await bakeDepthMotionFromVideo(file, human, {
        durationSec: planRef.current?.durationSec || 5,
        samples: 28,
        invert: depthInvert,
        strength: depthStrength,
        axis: 'z',
        onProgress: (p) => setStatus(`Depth sample ${Math.round(p * 100)}% (local only)`)
      });
      const next = {
        ...planRef.current,
        humans: [...(planRef.current.humans || [])]
      };
      next.humans[humanIdx] = {
        ...next.humans[humanIdx],
        keyframes: keys.map(({ t, position, rotation, pose }) => ({ t, position, rotation, pose }))
      };
      planRef.current = next;
      setPlan(next);
      rebuildMotionPaths(next);
      const obj = humansRef.current[humanIdx];
      if (obj && keys[0]) {
        obj.position.set(keys[0].position[0], keys[0].position[1], keys[0].position[2]);
        applyMannequinPose(obj, keys[0].pose);
      }
      setStatus(`Depth → mannequin keys (${keys.length}) from ${file.name} · not uploaded`);
      setPlaying(true);
    } catch (err) {
      setStatus(`Depth drive failed: ${err?.message || 'unknown'}`);
    } finally {
      setDepthBusy(false);
    }
  }, [selectedKey, depthInvert, depthStrength, rebuildMotionPaths]);

  // 3-point lighting rig + stage visibility
  useEffect(() => {
    applyStageLightingRig(
      {
        keyLight: keyLightRef.current,
        fillLight: fillLightRef.current,
        rimLight: rimLightRef.current,
        hemiLight: hemiLightRef.current
      },
      plan.lighting || {},
      plan.environment || {}
    );
    if (keyLightRef.current) keyLightRef.current.castShadow = showShadows;
    if (rendererRef.current) rendererRef.current.shadowMap.enabled = showShadows;
    if (gridHelperRef.current) gridHelperRef.current.visible = showGrid;
    if (groundMeshRef.current) groundMeshRef.current.visible = showGround;
  }, [plan.lighting, plan.environment, showGrid, showGround, showShadows]);

  const applyStudioPose = useCallback((name) => {
    updateSelectedHumanPose({}, name);
  }, [updateSelectedHumanPose]);

  const applyHandToSelection = useCallback((handId) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) return;
    const idx = obj.userData.planIndex;
    const next = { ...planRef.current, humans: [...planRef.current.humans] };
    const pose = applyHandPreset(next.humans[idx]?.pose, handId, 'both');
    next.humans[idx] = { ...next.humans[idx], pose };
    applyMannequinPose(obj, pose);
    obj.userData.pose = pose;
    planRef.current = next;
    setPlan(next);
    setPoseVersion((v) => v + 1);
    setStatus(`Hand preset: ${handId}`);
  }, []);

  const mirrorSelectedPose = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) return;
    const idx = obj.userData.planIndex;
    const next = { ...planRef.current, humans: [...planRef.current.humans] };
    const pose = mirrorPose(next.humans[idx]?.pose);
    next.humans[idx] = { ...next.humans[idx], pose };
    applyMannequinPose(obj, pose);
    obj.userData.pose = pose;
    planRef.current = next;
    setPlan(next);
    setPoseVersion((v) => v + 1);
    setStatus('Mirrored limbs L↔R');
  }, []);

  const copyPoseClipboard = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) return;
    const h = planRef.current.humans[obj.userData.planIndex];
    setPoseClipboard(normalizePose(h?.pose || obj.userData.pose));
    setStatus('Pose copied — select another mannequin & Paste');
  }, []);

  const pastePoseClipboard = useCallback(() => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !poseClipboard || !planRef.current) return;
    const idx = obj.userData.planIndex;
    const next = { ...planRef.current, humans: [...planRef.current.humans] };
    next.humans[idx] = transferPose({ pose: poseClipboard }, next.humans[idx]);
    applyMannequinPose(obj, next.humans[idx].pose);
    obj.userData.pose = next.humans[idx].pose;
    planRef.current = next;
    setPlan(next);
    setPoseVersion((v) => v + 1);
    setStatus('Pose pasted (character swap)');
  }, [poseClipboard]);

  const applyBodyTypeToSelection = useCallback((bodyId) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current) return;
    const idx = obj.userData.planIndex;
    const next = { ...planRef.current, humans: [...planRef.current.humans] };
    next.humans[idx] = applyBodyType(next.humans[idx], bodyId);
    const bt = BODY_TYPES.find((b) => b.id === bodyId);
    if (bt) {
      obj.scale.set(bt.scale[0], bt.scale[1], bt.scale[2]);
      obj.traverse((child) => {
        if (!child.isMesh || !child.material?.color) return;
        const c = child.material.color;
        // Keep purple joint materials — only recolor yellow shell
        if (c.b > c.r && c.b > c.g * 0.85) return;
        try { child.material.color.set(bt.color); } catch { /* ignore */ }
      });
    }
    planRef.current = next;
    setPlan(next);
    readObjectProps(obj);
    setStatus(`Body type: ${bodyId}`);
  }, [readObjectProps]);

  const saveCameraBookmark = useCallback(() => {
    const cam = viewCamRef.current;
    const controls = controlsRef.current;
    if (!cam || !controls) return;
    const entry = {
      id: `cam_${Date.now()}`,
      label: `View ${cameraBookmarks.length + 1}`,
      position: cam.position.toArray(),
      target: controls.target.toArray(),
      fov: cam.fov
    };
    setCameraBookmarks((prev) => [...prev, entry].slice(-12));
    setStatus(`Saved camera ${entry.label}`);
  }, [cameraBookmarks.length]);

  const recallCameraBookmark = useCallback((bm) => {
    const cam = viewCamRef.current;
    const controls = controlsRef.current;
    if (!cam || !controls || !bm) return;
    cam.position.fromArray(bm.position);
    controls.target.fromArray(bm.target);
    if (bm.fov) {
      cam.fov = bm.fov;
      cam.updateProjectionMatrix();
    }
    controls.update();
    setStatus(`Recalled ${bm.label}`);
  }, []);

  const loadReferenceImagePlane = useCallback(async (file) => {
    if (!file || !sceneRef.current) return;
    const url = URL.createObjectURL(file);
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (imagePlaneRef.current) {
        sceneRef.current.remove(imagePlaneRef.current);
        imagePlaneRef.current.geometry?.dispose();
        imagePlaneRef.current.material?.dispose();
      }
      const aspect = (tex.image?.width || 16) / (tex.image?.height || 9);
      const h = 3.2;
      const w = h * aspect;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true })
      );
      mesh.position.set(0, h / 2, -3.5);
      mesh.userData.kind = 'imagePlane';
      mesh.userData.label = file.name;
      mesh.userData.skipPick = false;
      sceneRef.current.add(mesh);
      imagePlaneRef.current = mesh;
      setStatus(`Reference image plane: ${file.name} (local only)`);
    });
  }, []);

  const exportAiPasses = useCallback(async (modes) => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const lens = lensCamRef.current;
    if (!renderer || !scene || !lens) {
      setStatus('Camera not ready');
      return;
    }
    const stem = buildShotExportStem(shot, activeShotIndex, projectTitle);
    setExportBusy(true);
    try {
      const prev = exportLensOnlyRef.current;
      exportLensOnlyRef.current = true;
      renderer.render(scene, lens);
      const results = await exportPassBundle({
        renderer,
        scene,
        camera: lens,
        humans: humansRef.current,
        fileStem: stem,
        modes,
        saveOpts: stageExportOpts
      });
      exportLensOnlyRef.current = prev;
      const ok = results.filter((r) => r.saved?.success);
      const blocked = results.filter((r) => r.saved?.blocked);
      if (blocked.length) {
        setStatus(blocked[0]?.saved?.error || exportLife.message || 'Export blocked');
      } else {
        setStatus(`Exported ${ok.length} pass(es): ${ok.map((r) => r.mode).join(', ')}`);
      }
    } catch (err) {
      setStatus(`Export failed: ${err?.message || 'unknown'}`);
    } finally {
      setExportBusy(false);
    }
  }, [shot, activeShotIndex, projectTitle, stageExportOpts, exportLife.message]);

  const exportPassPdfPack = useCallback(async () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const lens = lensCamRef.current;
    if (!renderer || !scene || !lens) {
      setStatus('Camera not ready');
      return;
    }
    if (saasExportBlocked) {
      setStatus('Export off for this license');
      return;
    }
    if (lifecycleExportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'stage_pass_pdf',
        format: 'pdf',
        lifecycleMode: stageLifecycleMode,
        shots,
        roomId: stageExportOpts.roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'stage_pass_pdf',
      format: 'pdf',
      lifecycleMode: stageLifecycleMode,
      shots,
      roomId: stageExportOpts.roomId,
      showAlert: true
    });
    if (!gate.ok) return;

    const stem = buildShotExportStem(shot, activeShotIndex, projectTitle);
    const shotId =
      parseSceneAndShotID(shot, activeShotIndex).formattedId ||
      shot?.sceneShotId ||
      `Shot ${activeShotIndex + 1}`;
    setExportBusy(true);
    try {
      const prev = exportLensOnlyRef.current;
      exportLensOnlyRef.current = true;
      renderer.render(scene, lens);
      const passes = await renderPassPackForPrint({
        renderer,
        scene,
        camera: lens,
        humans: humansRef.current,
        fileStem: stem,
        modes: ['color', 'depth', 'normals', 'canny', 'openpose']
      });
      exportLensOnlyRef.current = prev;
      if (!passes.length) {
        setStatus('No passes rendered');
        return;
      }
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        window.alert('Please allow popups to export PDF.');
        return;
      }
      printWindow.document.write(
        stagePassesToPrintHtml({
          projectTitle,
          shotId,
          fileStem: stem,
          passes
        })
      );
      printWindow.document.close();
      logExportSuccess({
        projectTitle,
        label: 'stage_pass_pdf',
        format: 'pdf',
        filename: `${stem}_passes.pdf`,
        roomId: stageExportOpts.roomId,
        note: `${stageExportOpts.note || 'stage3d'} · ${passes.length} passes`,
        lifecycleMode: gate.advisory ? `${stageLifecycleMode}+ok` : stageLifecycleMode
      });
      setStatus(`Pass PDF pack opened · ${passes.length} passes`);
    } catch (err) {
      setStatus(`Pass PDF failed: ${err?.message || 'unknown'}`);
    } finally {
      setExportBusy(false);
    }
  }, [
    shot,
    activeShotIndex,
    projectTitle,
    shots,
    stageLifecycleMode,
    saasExportBlocked,
    lifecycleExportBlocked,
    stageExportOpts
  ]);

  const exportObjBase = useCallback(async () => {
    const stem = buildShotExportStem(shot, activeShotIndex, projectTitle);
    const blob = exportMannequinsObj(humansRef.current);
    const saved = await saveExportBlob(blob, `${stem}_mannequins.obj`, {
      ...stageExportOpts,
      auditLabel: 'stage_obj',
      auditFormat: 'obj'
    });
    if (!saved.canceled && !saved.blocked) setStatus(`OBJ base saved: ${saved.filePath || `${stem}_mannequins.obj`}`);
    else if (saved.blocked) setStatus(saved.error || exportLife.message || 'Export blocked');
  }, [shot, activeShotIndex, projectTitle, stageExportOpts, exportLife.message]);

  const applyStageSet = useCallback((setId) => {
    if (!planRef.current) return;
    const next = {
      ...planRef.current,
      environment: environmentFromSetId(setId, shot, planRef.current.environment)
    };
    applyPlanToScene(next);
    const tag = next.environment.needsDirection ? 'Needs Direction' : next.environment.inferred ? 'INFERRED' : 'Set';
    setStatus(`${tag} · ${setId} · ${next.environment.timeOfDay}`);
  }, [applyPlanToScene, shot]);

  const applyStageLight = useCallback((setupId) => {
    if (!planRef.current) return;
    const lighting = {
      ...lightingRigForSetup(setupId),
      source: 'director',
      inferred: false,
      needsDirection: false
    };
    const next = { ...planRef.current, lighting };
    applyPlanToScene(next);
    persistDirectorToShotRef.current(false, next);
    setStatus(`Light · ${setupId}`);
  }, [applyPlanToScene]);

  const handleSelectedGlb = useCallback((file) => {
    const obj = selectedRef.current;
    if (!obj || obj.userData.kind !== 'human' || !planRef.current || !file) {
      setStatus('Select a character, then load a GLB');
      return;
    }
    const idx = obj.userData.planIndex;
    const url = URL.createObjectURL(file);
    const next = { ...planRef.current, humans: [...planRef.current.humans] };
    next.humans[idx] = {
      ...next.humans[idx],
      figureSource: 'glb',
      glbUrl: url
    };
    applyPlanToScene(next);
    persistDirectorToShotRef.current(false, next);
    setStatus(`GLB figure · ${file.name} — Mixamo/idle clip plays if the file includes one`);
  }, [applyPlanToScene]);

  const addPropPreset = useCallback((propId) => {
    const prop = PROP_PRESETS.find((p) => p.id === propId);
    if (!prop || !planRef.current) return;
    const next = { ...planRef.current, props: [...(planRef.current.props || [])] };
    next.props.push({
      presetId: propId,
      label: prop.label,
      geo: prop.geo,
      size: prop.size,
      color: prop.color,
      position: [
        (Math.random() - 0.5) * 1.2,
        prop.y ?? (prop.size[1] ? prop.size[1] / 2 : 0.3),
        -0.5 + Math.random() * 0.4
      ]
    });
    applyPlanToScene(next);
    setStatus(`Prop: ${prop.label}`);
  }, [applyPlanToScene]);

  const addPractical = useCallback((id) => {
    if (!planRef.current) return;
    const env = planRef.current.environment || {};
    const count = (env.pieces || []).filter((p) => p.practical).length;
    const next = {
      ...planRef.current,
      environment: {
        ...env,
        pieces: [...(env.pieces || []), practicalPiece(id, count)]
      }
    };
    applyPlanToScene(next);
    setStatus(`Practical · ${id}`);
  }, [applyPlanToScene]);

  const patchPracticalTiming = useCallback((pieceId, field, raw) => {
    if (!planRef.current) return;
    const env = planRef.current.environment || {};
    const stringFields = new Set(['gel', 'gobo', 'barn', 'shutter', 'bounce', 'bounceColor']);
    const parsed = field === 'intensity'
      ? parsePracticalIntensity(raw)
      : field === 'kelvin'
        ? parsePracticalKelvin(raw)
        : field === 'bounceAngle'
          ? parsePracticalAngle(raw)
          : field === 'bounceDistance'
            ? parsePracticalDistance(raw)
            : field === 'bounceHeight'
              ? parsePracticalHeight(raw)
              : field === 'bounceTilt'
                ? parsePracticalTilt(raw)
                : field === 'bounceSpread'
                  ? parsePracticalSpread(raw)
                  : field === 'bounceFeather'
                    ? parsePracticalFeather(raw)
                    : field === 'bounceSpill'
                      ? parsePracticalSpill(raw)
                      : stringFields.has(field)
            ? (raw || undefined)
            : parsePracticalSeconds(raw);
    const next = {
      ...planRef.current,
      environment: {
        ...env,
        pieces: patchPracticalPiece(env.pieces || [], pieceId, { [field]: parsed })
      }
    };
    applyPlanToScene(next);
    persistDirectorToShotRef.current(false, next);
    const shown = parsed == null
      ? 'open'
      : field === 'intensity'
        ? `${Math.round(parsed * 100)}%`
        : field === 'kelvin'
          ? `${parsed}K`
          : field === 'bounceAngle'
            ? `${parsed}°`
            : field === 'bounceDistance'
              ? `${parsed}m`
              : field === 'bounceHeight'
                ? `${parsed}m ↑`
                : field === 'bounceTilt'
                  ? `${parsed}° tilt`
                  : field === 'bounceSpread'
                    ? `${parsed}×`
                    : field === 'bounceFeather'
                      ? `${Math.round(parsed * 100)}%`
                      : field === 'bounceSpill'
                        ? `${Math.round(parsed * 100)}% spill`
                        : stringFields.has(field)
              ? String(parsed)
              : `${parsed}s`;
    setStatus(`Practical ${field} · ${shown}`);
  }, [applyPlanToScene]);

  const fileStem = useMemo(
    () => buildShotExportStem(shot, activeShotIndex, projectTitle),
    [shot, activeShotIndex, projectTitle]
  );

  const downloadStillImage = useCallback(async () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const lens = lensCamRef.current;
    if (!renderer || !scene || !lens) {
      setStatus('Camera view not ready for image export');
      return;
    }
    const prevExport = exportLensOnlyRef.current;
    exportLensOnlyRef.current = true;
    filmCamsRef.current.forEach((g) => { g.visible = false; });
    if (aimTargetRef.current) aimTargetRef.current.visible = false;
    if (aimLineRef.current) aimLineRef.current.visible = false;
    if (frustumRef.current?.helper) frustumRef.current.helper.visible = false;
    if (transformRef.current) transformRef.current.visible = false;
    renderer.clear();
    renderer.render(scene, lens);
    try {
      const dataUrl = renderer.domElement.toDataURL('image/png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filename = `${fileStem}.png`;
      const saved = await saveExportBlob(blob, filename, {
        ...stageExportOpts,
        auditLabel: 'stage_still_png',
        auditFormat: 'png'
      });
      if (saved.blocked) {
        setStatus(saved.error || exportLife.message || 'Export blocked');
        return;
      }
      if (saved.canceled) setStatus('PNG save canceled');
      else if (saved.method === 'download') setStatus(`PNG → Downloads as ${filename}`);
      else setStatus(`PNG saved: ${saved.filePath || filename}`);
    } catch (err) {
      setStatus(`Image export failed: ${err?.message || 'unknown'}`);
    } finally {
      exportLensOnlyRef.current = prevExport;
      if (modeRef.current !== 'shoot' && !prevExport) {
        filmCamsRef.current.forEach((g) => { g.visible = true; });
        if (aimTargetRef.current) aimTargetRef.current.visible = true;
        if (aimLineRef.current) aimLineRef.current.visible = true;
        if (frustumRef.current?.helper) frustumRef.current.helper.visible = true;
      }
    }
  }, [fileStem, stageExportOpts, exportLife.message]);

  const captureLensPngBlob = useCallback(async () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const lens = lensCamRef.current;
    if (!renderer || !scene || !lens) return null;
    const prevExport = exportLensOnlyRef.current;
    exportLensOnlyRef.current = true;
    filmCamsRef.current.forEach((g) => { g.visible = false; });
    if (aimTargetRef.current) aimTargetRef.current.visible = false;
    if (aimLineRef.current) aimLineRef.current.visible = false;
    if (frustumRef.current?.helper) frustumRef.current.helper.visible = false;
    if (transformRef.current) transformRef.current.visible = false;
    if (ghostGroupRef.current) ghostGroupRef.current.visible = false;
    renderer.clear();
    renderer.render(scene, lens);
    try {
      const dataUrl = renderer.domElement.toDataURL('image/png');
      const res = await fetch(dataUrl);
      return await res.blob();
    } finally {
      exportLensOnlyRef.current = prevExport;
      if (ghostGroupRef.current) ghostGroupRef.current.visible = true;
      if (modeRef.current !== 'shoot' && !prevExport) {
        filmCamsRef.current.forEach((g) => { g.visible = true; });
        if (aimTargetRef.current) aimTargetRef.current.visible = true;
        if (aimLineRef.current) aimLineRef.current.visible = true;
        if (frustumRef.current?.helper) frustumRef.current.helper.visible = true;
      }
    }
  }, []);

  const persistDirectorToShot = useCallback((synced, planOverride) => {
    if (!onUpdateShot || !shot) return null;
    const prevId = shots[activeShotIndex - 1]
      ? parseSceneAndShotID(shots[activeShotIndex - 1], activeShotIndex - 1).shortId
      : '';
    const data = buildShotDirectorData({
      shot,
      plan: planOverride || planRef.current,
      shotIndex: activeShotIndex,
      projectTitle,
      previousShotId: prevId,
      promptSynced: synced
    });
    onUpdateShot(activeShotIndex, {
      ...shot,
      directorStage: data,
      ...(synced ? { stageVideoPrompt: composeVideoPromptFromDirectorData(data) } : {})
    });
    return data;
  }, [onUpdateShot, shot, shots, activeShotIndex, projectTitle]);
  persistDirectorToShotRef.current = persistDirectorToShot;

  useEffect(() => {
    if (autoSaveIntervalIdProp) setStageAutoSaveId(autoSaveIntervalIdProp);
  }, [autoSaveIntervalIdProp]);

  useEffect(() => {
    const onPrefs = (e) => {
      const id = e?.detail?.autoSaveIntervalId;
      if (id) setStageAutoSaveId(id);
    };
    window.addEventListener('sps_ui_prefs_synced', onPrefs);
    return () => window.removeEventListener('sps_ui_prefs_synced', onPrefs);
  }, []);

  useEffect(() => {
    const persistIfDirty = () => {
      if (matchPendingRef.current) return;
      const planNow = planRef.current;
      if (!planNow || !onUpdateShot) return;
      let key = '';
      try {
        key = JSON.stringify({
          humans: planNow.humans,
          cameras: planNow.cameras,
          lighting: planNow.lighting,
          environment: planNow.environment,
          durationSec: planNow.durationSec
        });
      } catch {
        key = String(Date.now());
      }
      if (key === lastSavedPlanRef.current) return;
      lastSavedPlanRef.current = key;
      persistDirectorToShotRef.current(false, planNow);
      setStageSavedAt(Date.now());
    };
    const ms = autoSaveIntervalMs(stageAutoSaveId);
    const id = ms > 0 ? setInterval(persistIfDirty, ms) : 0;
    const onHide = () => {
      if (document.visibilityState === 'hidden') persistIfDirty();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      persistIfDirty();
    };
  }, [activeShotIndex, shot?.sceneShotId, onUpdateShot, stageAutoSaveId]);

  const handleUpdateVideoPrompt = useCallback(() => {
    const data = persistDirectorToShot(true);
    if (!data) {
      setStatus('Cannot write prompt — no shot hook');
      return;
    }
    setPromptSynced(true);
    setStatus('Video prompt updated from Stage (explicit)');
  }, [persistDirectorToShot]);

  const handleMatchPrevious = useCallback(() => {
    const prevShot = shots[activeShotIndex - 1];
    if (!prevShot || !planRef.current) {
      setStatus('No previous shot to match');
      return;
    }
    const prevPlan = heuristicStagePlanFromShot(prevShot, activeShotIndex - 1);
    previousPlanRef.current = prevPlan;
    const before = cloneStagePlan(planRef.current);
    matchBeforeRef.current = before;
    matchPendingRef.current = true;
    const next = matchPreviousStagePlan(prevPlan, before, shot);
    applyPlanToScene(next);
    ghostOnRef.current = true;
    setGhostPrevious(true);
    setMatchReport({ ...matchPreviousReport(prevPlan, before, next, shot), pending: true });
    setStatus('Match Prev preview — Apply to keep, Reject to restore. Video prompt unchanged');
  }, [shots, activeShotIndex, shot, applyPlanToScene]);

  const handleMatchApply = useCallback(() => {
    matchPendingRef.current = false;
    persistDirectorToShot(false, planRef.current);
    setMatchReport((r) => (r ? { ...r, pending: false } : r));
    setStatus('Match Prev applied — video prompt unchanged');
  }, [persistDirectorToShot]);

  const handleMatchReject = useCallback(() => {
    const restored = resolveMatchDecision(matchBeforeRef.current, planRef.current, 'reject');
    matchPendingRef.current = false;
    matchBeforeRef.current = null;
    ghostOnRef.current = false;
    setGhostPrevious(false);
    if (restored) applyPlanToScene(restored, { history: false });
    setMatchReport(null);
    setStatus('Match Prev rejected — restored this shot’s blocking');
  }, [applyPlanToScene]);

  const handleToggleGhost = useCallback(() => {
    const prevShot = shots[activeShotIndex - 1];
    if (prevShot && !previousPlanRef.current) {
      previousPlanRef.current = heuristicStagePlanFromShot(prevShot, activeShotIndex - 1);
    }
    setGhostPrevious((g) => {
      const next = !g;
      ghostOnRef.current = next;
      requestAnimationFrame(() => applyPlanToScene(planRef.current));
      setStatus(next ? 'Previous-shot ghost on' : 'Ghost off');
      return next;
    });
  }, [shots, activeShotIndex, applyPlanToScene]);

  const handleExportDirectorPack = useCallback(async () => {
    setExportBusy(true);
    try {
      setMode('shoot');
      setShowCameraView(true);
      await new Promise((r) => requestAnimationFrame(() => r()));
      const preview = await captureLensPngBlob();
      const result = await exportDirectorStagePack({
        shot,
        plan: planRef.current,
        shotIndex: activeShotIndex,
        projectTitle,
        previewPngBlob: preview,
        shots,
        lifecycleMode: stageLifecycleMode,
        roomId: stageExportOpts.roomId,
        promptSynced,
        previousShotId: shots[activeShotIndex - 1]
          ? parseSceneAndShotID(shots[activeShotIndex - 1], activeShotIndex - 1).shortId
          : ''
      });
      persistDirectorToShot(promptSynced);
      if (result.blocked) setStatus(result.error || 'Export blocked');
      else if (result.saved?.canceled) setStatus('Export canceled');
      else setStatus(`${result.check?.message || 'Exported'} · ${result.stem}_DirectorStage.zip`);
    } catch (err) {
      setStatus(`Stage export failed: ${err?.message || 'unknown'}`);
    } finally {
      setExportBusy(false);
    }
  }, [
    captureLensPngBlob,
    shot,
    activeShotIndex,
    projectTitle,
    shots,
    stageLifecycleMode,
    stageExportOpts.roomId,
    promptSynced,
    persistDirectorToShot
  ]);

  const handleSendComfy = useCallback(async () => {
    if (!shot) {
      setStatus('No shot to send');
      return;
    }
    setComfyBusy(true);
    try {
      persistDirectorToShot(false);
      const prevId = shots[activeShotIndex - 1]
        ? parseSceneAndShotID(shots[activeShotIndex - 1], activeShotIndex - 1).shortId
        : '';
      const result = await sendDirectorStageToComfy({
        shot,
        plan: planRef.current,
        shotIndex: activeShotIndex,
        projectTitle,
        previousShotId: prevId
      });
      setStatus(result.message || (result.ok ? 'Sent to ComfyUI' : 'Comfy send failed'));
    } catch (err) {
      setStatus(`Comfy send failed: ${err?.message || 'unknown'}`);
    } finally {
      setComfyBusy(false);
    }
  }, [shot, shots, activeShotIndex, projectTitle, persistDirectorToShot]);

  const downloadTimelineVideo = useCallback(async () => {
    const renderer = rendererRef.current;
    if (!renderer?.domElement || !lensCamRef.current) {
      setStatus('Camera view not ready for video export');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setStatus('Video export not supported in this browser');
      return;
    }
    if (isExportingVideo) return;

    const mimeType = pickRecorderMimePreferMp4();
    if (!mimeType) {
      setStatus('No supported video codec (try Chrome / Edge / Safari)');
      return;
    }

    const durationSec = Math.max(1, plan.durationSec || 5);
    const canvas = renderer.domElement;
    let stream;
    try {
      stream = canvas.captureStream(30);
    } catch (err) {
      setStatus(`captureStream failed: ${err?.message || 'unknown'}`);
      return;
    }

    const chunks = [];
    let recorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6_000_000
      });
    } catch (err) {
      setStatus(`MediaRecorder failed: ${err?.message || 'unknown'}`);
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    mediaRecorderRef.current = recorder;
    setIsExportingVideo(true);
    setStatus(`Recording Camera 1 → MP4 (${durationSec.toFixed(1)}s)…`);

    const prevMode = modeRef.current;
    const prevExport = exportLensOnlyRef.current;
    exportLensOnlyRef.current = true;
    setMode('shoot');
    playRef.current.t = 0;
    setTimeSec(0);
    setPlaying(true);

    const finished = new Promise((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => resolve();
      recorder.onerror = () => resolve();
    });

    try {
      recorder.start(200);
      await new Promise((r) => setTimeout(r, Math.ceil(durationSec * 1000) + 350));
      if (recorder.state !== 'inactive') recorder.stop();
      await finished;

      const recorded = new Blob(chunks, {
        type: mimeType.includes('mp4') ? 'video/mp4' : 'video/webm'
      });
      let mp4Blob = recorded;
      if (!String(recorded.type || mimeType).toLowerCase().includes('mp4')) {
        setStatus('Converting Camera 1 take to MP4…');
        mp4Blob = await ensureMp4Blob(recorded, mimeType, (p) => {
          setStatus(`Converting to MP4… ${Math.round(p * 100)}%`);
        });
      }
      const filename = `${fileStem}.mp4`;
      const saved = await saveExportBlob(mp4Blob, filename, {
        ...stageExportOpts,
        auditLabel: 'stage_video_mp4',
        auditFormat: 'mp4'
      });
      if (saved.blocked) {
        setStatus(saved.error || exportLife.message || 'Export blocked');
        return;
      }
      if (saved.canceled) setStatus('MP4 save canceled');
      else if (saved.method === 'download') setStatus(`MP4 → Downloads as ${filename}`);
      else setStatus(`MP4 saved: ${saved.filePath || filename} (${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
      setStatus(`MP4 export failed: ${err?.message || 'unknown'}`);
    } finally {
      exportLensOnlyRef.current = prevExport;
      setPlaying(false);
      setMode(prevMode === 'shoot' ? 'shoot' : 'compose');
      setIsExportingVideo(false);
      mediaRecorderRef.current = null;
      stream.getTracks().forEach((t) => t.stop());
    }
  }, [fileStem, isExportingVideo, plan.durationSec, stageExportOpts, exportLife.message]);

  const duration = plan.durationSec || 5;
  const canUndoStage = historyTick >= 0 && historyRef.current.past.length > 0;
  const canRedoStage = historyTick >= 0 && historyRef.current.future.length > 0;
  const animLabel = plan.cameras?.[0]?.animation?.type || 'orbit';
  const selectedHumanIdx = selectedKey && String(selectedKey).startsWith('human:')
    ? Number(String(selectedKey).split(':')[1])
    : 0;
  const selectedHuman = plan.humans?.[selectedHumanIdx];
  const selectedGaze = selectedHuman?.gaze || { eyeTarget: 'hold', headDirection: 'follow_eyes', bodyDirection: 'hold' };
  const selectedExpr = selectedHuman?.expression || { id: 'neutral', intensity: 1 };
  const selectedIx = selectedHuman?.interaction || { type: 'none' };
  const timeline = buildStageTimeline(plan);
  const speakNow = speakingLineAt(plan.dialogue, timeSec);
  const frame = Math.max(1, Math.round(timeSec * 24) + 1);
  const endFrame = Math.max(1, Math.round(duration * 24));

  const pipFrame = useMemo(() => {
    const ar = Math.max(0.45, Number(aspectNumeric) || 21 / 9);
    // Prefer width for landscape, height-capped for portrait
    const maxW = 360;
    const maxH = 220;
    let w;
    let h;
    if (ar >= 1) {
      w = maxW;
      h = Math.max(64, Math.round(w / ar));
      if (h > maxH) {
        h = maxH;
        w = Math.round(h * ar);
      }
    } else {
      h = maxH;
      w = Math.max(72, Math.round(h * ar));
      if (w > maxW) {
        w = maxW;
        h = Math.round(w / ar);
      }
    }
    return { w, h, ar, padPct: 100 / ar };
  }, [aspectNumeric]);

  // Keep Camera monitor WebGL buffer matched to the visible frame ratio
  useEffect(() => {
    const sync = () => {
      const el = previewMountRef.current;
      const pr = previewRendererRef.current;
      if (!el || !pr) return;
      const ar = Math.max(0.4, aspectNumericRef.current || pipFrame.ar || 21 / 9);
      const rect = el.getBoundingClientRect();
      const pw = Math.max(2, Math.round(rect.width || pipFrame.w));
      const ph = Math.max(2, Math.round(rect.height || pipFrame.h));
      pr.setSize(pw, ph, false);
      pr.domElement.style.width = '100%';
      pr.domElement.style.height = '100%';
      pr.domElement.style.display = 'block';
      if (lensCamRef.current) {
        lensCamRef.current.aspect = ar;
        lensCamRef.current.updateProjectionMatrix();
      }
    };
    const id = requestAnimationFrame(sync);
    const t1 = setTimeout(sync, 30);
    const t2 = setTimeout(sync, 120);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [showCameraView, mode, aspectNumeric, pipFrame.w, pipFrame.h, pipFrame.ar]);

  const selectedKeyframes = useMemo(() => {
    if (!selectedKey) return [];
    const [kind, idxStr] = selectedKey.split(':');
    const idx = Number(idxStr);
    if (kind === 'human') return sortKeyframes(plan.humans?.[idx]?.keyframes || []);
    if (kind === 'camera') return sortKeyframes(plan.cameras?.[idx]?.keyframes || []);
    return [];
  }, [selectedKey, plan]);

  const curvePoints = useMemo(() => {
    const keys = selectedKeyframes;
    if (keys.length < 1) return [];
    const vals = keys.map((k) => {
      if (curveChannel === 'posX') return k.position?.[0] ?? 0;
      if (curveChannel === 'posY') return k.position?.[1] ?? 0;
      if (curveChannel === 'posZ') return k.position?.[2] ?? 0;
      if (curveChannel === 'rotY') return (k.rotation?.[1] ?? 0) * DEG;
      return k.position?.[0] ?? 0;
    });
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const span = Math.max(0.001, maxV - minV);
    return keys.map((k, i) => ({
      t: k.t,
      x: duration > 0 ? (k.t / duration) * 100 : 0,
      y: 100 - ((vals[i] - minV) / span) * 80 - 10,
      v: vals[i]
    }));
  }, [selectedKeyframes, curveChannel, duration]);

  const jumpToAdjacentKey = useCallback((dir) => {
    const keys = selectedKeyframes;
    if (!keys.length) return;
    const t = playRef.current.t || 0;
    let target = null;
    if (dir < 0) {
      for (let i = keys.length - 1; i >= 0; i--) {
        if (keys[i].t < t - 0.02) { target = keys[i].t; break; }
      }
      if (target == null) target = keys[0].t;
    } else {
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].t > t + 0.02) { target = keys[i].t; break; }
      }
      if (target == null) target = keys[keys.length - 1].t;
    }
    playRef.current.t = target;
    setTimeSec(target);
    setPlaying(false);
  }, [selectedKeyframes]);


  const filmCam = plan.cameras?.[0];
  const activeFocal = filmCam?.focalMm || plan.focalMm || 35;
  const activeSensor = filmCam?.sensorWidthMm || 36;
  const lookId = lookFromMm(activeFocal);
  const derivedShotSize = (() => {
    const subj = plan.humans?.[0];
    const camPos = filmCam?.position || [-2.2, 1.35, 3.2];
    const dist = subj
      ? distance3(camPos, [subj.position?.[0] || 0, 1.1, subj.position?.[2] || 0])
      : distance3(camPos, filmCam?.lookAt || [0, 1.2, 0]);
    return estimateShotSize({
      distanceM: dist,
      focalMm: activeFocal,
      sensorWidthMm: activeSensor
    });
  })();
  const moveId = normalizeMoveType(animLabel);
  const activeAspectOpt =
    ASPECT_RATIO_OPTIONS.find(
      (o) => o.value === aspectRatio || o.id === aspectRatio || String(aspectRatio || '').startsWith(o.id)
    ) || ASPECT_RATIO_OPTIONS[0];
  const directorSlate = [
    parseSceneAndShotID(shot, activeShotIndex).shortId || `SH${activeShotIndex + 1}`,
    `${activeFocal}mm`,
    derivedShotSize,
    String(plan.cameras?.[0]?.animation?.type || animLabel || 'static'),
    `${Math.round(Number(duration) || 5)}s`,
    activeAspectOpt.label
  ].join(' · ');

  return (
    <div
      ref={stageRootRef}
      data-stage-root
      tabIndex={-1}
      className="relative w-full h-full min-h-0 flex bg-[#12110f] overflow-hidden select-none text-[var(--sps-text)]"
    >
      <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-3 px-3 py-2 border-b border-[var(--sps-border)] bg-[#0c0b0a]/92 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight truncate" style={{ fontFamily: 'var(--sps-font-display)' }}>{shotLabel}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--sps-muted)] truncate">{status}</p>
          {stageSavedAt ? (
            <p className="text-[9px] text-[var(--sps-muted)] truncate m-0 mt-0.5">
              Stage {autoSaveIntervalLabel(stageAutoSaveId)}
              {stageAutoSaveId === 'off' ? ' · saves when you leave' : ''}
              {' · '}
              last {new Date(stageSavedAt).toLocaleTimeString()} · prompt unchanged
            </p>
          ) : (
            <p className="text-[9px] text-[var(--sps-muted)] truncate m-0 mt-0.5">
              Stage follows Header Save · {autoSaveIntervalLabel(stageAutoSaveId)} · prompt unchanged
            </p>
          )}
          {saasExportBlocked ? (
            <p className="text-[9px] text-rose-400 truncate m-0 mt-0.5">Export off for this license</p>
          ) : lifecycleExportBlocked ? (
            <p className="text-[9px] text-[var(--sps-gold)] truncate m-0 mt-0.5" title={exportLife.message}>
              {exportLife.message}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="sps-tabs sps-tabs-compact shrink-0" role="tablist" aria-label="Stage desk">
            <button type="button" role="tab" aria-selected={!showAdvanced} onClick={() => setShowAdvanced(false)}>Simple</button>
            <button type="button" role="tab" aria-selected={showAdvanced} onClick={() => setShowAdvanced(true)}>Pro</button>
          </div>
          <div className="sps-tabs shrink-0" role="tablist" aria-label="Stage view">
            <button type="button" role="tab" aria-selected={mode === 'compose'} onClick={() => { setMode('compose'); setPlaying(false); }}>Stage</button>
            <button type="button" role="tab" aria-selected={mode === 'shoot'} onClick={() => { setMode('shoot'); setShowCameraView(true); }}>Lens</button>
          </div>
        </div>
      </div>

      <div className="absolute left-3 top-16 z-30 flex flex-col gap-2 pointer-events-none max-w-[18rem]">
        <div className="sps-tabs sps-tabs-compact pointer-events-auto" role="tablist" aria-label="Look">
          {LOOK_PRESETS.map((l) => (
            <button key={l.id} type="button" role="tab" aria-selected={lookId === l.id} onClick={() => updateCameraSettings({ focalMm: l.mm })}>
              {l.label}
            </button>
          ))}
        </div>
        {showAdvanced ? (
          <div className="pointer-events-auto flex flex-col gap-1 max-w-[18rem]">
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Lens mm
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={String(activeFocal)}
                onChange={(e) => updateCameraSettings({ focalMm: Number(e.target.value) })}
                aria-label="Focal length"
              >
                {[
                  ...STAGE_FOCAL_PRESETS,
                  ...(STAGE_FOCAL_PRESETS.includes(Number(activeFocal)) ? [] : [Number(activeFocal)])
                ].map((mm) => (
                  <option key={mm} value={mm}>{mm}mm</option>
                ))}
              </select>
            </label>
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Sensor
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={String(activeSensor)}
                onChange={(e) => updateCameraSettings({ sensorWidthMm: Number(e.target.value) })}
                aria-label="Sensor width"
              >
                {STAGE_SENSOR_PRESETS.map((s) => (
                  <option key={s.id} value={s.widthMm}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Aperture
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={String(filmCam?.aperture || plan.aperture || 2.8)}
                onChange={(e) => updateCameraSettings({ aperture: Number(e.target.value) })}
                aria-label="Aperture"
              >
                {STAGE_APERTURE_PRESETS.map((f) => (
                  <option key={f} value={f}>f/{f}</option>
                ))}
              </select>
            </label>
            <p className="text-[9px] text-[var(--sps-muted)] m-0">
              {focalMmToFov(activeFocal, activeSensor).toFixed(0)}° FOV · focus {(filmCam?.focusDistance || 0).toFixed(1)}m · {derivedShotSize}
            </p>
          </div>
        ) : (
          <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0 pointer-events-none">
            {derivedShotSize}
          </p>
        )}
        <div className="sps-tabs sps-tabs-compact pointer-events-auto" role="tablist" aria-label="Camera move">
          {MOVE_PRESETS.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={moveId === m.id} onClick={() => updateCameraSettings({ animationType: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
        {showAdvanced ? (
          <div className="pointer-events-auto flex flex-col gap-1 max-w-[18rem]">
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Move
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={moveId}
                onChange={(e) => updateCameraSettings({ animationType: e.target.value })}
                aria-label="Camera move type"
              >
                {CAMERA_MOVE_PRO.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Ease
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={filmCam?.animation?.easing || 'easeInOut'}
                onChange={(e) => updateCameraSettings({ easing: e.target.value })}
                aria-label="Camera easing"
              >
                {cameraMoveEasingOptions().map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="sps-tabs sps-tabs-compact pointer-events-auto flex-wrap max-w-[18rem]" role="tablist" aria-label="Character move">
          {CHAR_MOVE_SIMPLE.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={(plan.humans?.[selectedKey && String(selectedKey).startsWith('human:') ? Number(String(selectedKey).split(':')[1]) : 0]?.movement?.type || 'hold') === m.id}
              onClick={() => applySelectedCharacterMove({ type: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        {showAdvanced ? (
          <div className="pointer-events-auto flex flex-col gap-1 max-w-[18rem]">
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Blocking
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={plan.humans?.[selectedKey && String(selectedKey).startsWith('human:') ? Number(String(selectedKey).split(':')[1]) : 0]?.movement?.type || 'hold'}
                onChange={(e) => applySelectedCharacterMove({ type: e.target.value })}
                aria-label="Character move type"
              >
                {CHAR_MOVE_PRO.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Path
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={plan.humans?.[selectedKey && String(selectedKey).startsWith('human:') ? Number(String(selectedKey).split(':')[1]) : 0]?.movement?.path || 'straight'}
                onChange={(e) => applySelectedCharacterMove({ path: e.target.value })}
                aria-label="Character path shape"
              >
                {CHAR_PATH_SHAPES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Ease
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={plan.humans?.[selectedKey && String(selectedKey).startsWith('human:') ? Number(String(selectedKey).split(':')[1]) : 0]?.movement?.easing || 'easeInOut'}
                onChange={(e) => applySelectedCharacterMove({ easing: e.target.value })}
                aria-label="Character move easing"
              >
                {cameraMoveEasingOptions().map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="sps-tabs sps-tabs-compact pointer-events-auto flex-wrap max-w-[18rem]" role="tablist" aria-label="Eye look">
          {EYE_TARGET_SIMPLE.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={selectedGaze.eyeTarget === m.id}
              onClick={() => applySelectedGaze({ eyeTarget: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0 pointer-events-none">
          {selectedGaze.needsDirection
            ? 'Needs Direction · look'
            : selectedGaze.inferred
              ? `INFERRED · look ${selectedGaze.eyeTarget}`
              : `Look ${selectedGaze.eyeTarget}`}
        </p>
        {showAdvanced ? (
          <div className="pointer-events-auto flex flex-col gap-1 max-w-[18rem]">
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Eye target
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={selectedGaze.eyeTarget || 'hold'}
                onChange={(e) => applySelectedGaze({ eyeTarget: e.target.value })}
                aria-label="Eye target"
              >
                {EYE_TARGET_PRO.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Head
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={selectedGaze.headDirection || 'follow_eyes'}
                onChange={(e) => applySelectedGaze({ headDirection: e.target.value })}
                aria-label="Head direction"
              >
                {HEAD_DIRECTION_PRO.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Body
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={selectedGaze.bodyDirection || 'hold'}
                onChange={(e) => applySelectedGaze({ bodyDirection: e.target.value })}
                aria-label="Body direction"
              >
                {BODY_DIRECTION_PRO.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="sps-tabs sps-tabs-compact pointer-events-auto flex-wrap max-w-[18rem]" role="tablist" aria-label="Expression">
          {EXPR_SIMPLE.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={selectedExpr.id === m.id}
              onClick={() => applySelectedExpression({ id: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0 pointer-events-none">
          {selectedExpr.needsDirection
            ? 'Needs Direction · face'
            : selectedExpr.inferred
              ? `INFERRED · ${selectedExpr.id}`
              : selectedExpr.id}
        </p>
        {showAdvanced ? (
          <div className="pointer-events-auto flex flex-col gap-1 max-w-[18rem]">
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Face
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={selectedExpr.id || 'neutral'}
                onChange={(e) => applySelectedExpression({ id: e.target.value })}
                aria-label="Expression"
              >
                {EXPR_PRO.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)]">
              Intensity
              <select
                className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
                value={String(selectedExpr.intensity ?? 1)}
                onChange={(e) => applySelectedExpression({ intensity: Number(e.target.value) })}
                aria-label="Expression intensity"
              >
                {EXPR_INTENSITY.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="sps-tabs sps-tabs-compact pointer-events-auto flex-wrap max-w-[18rem]" role="tablist" aria-label="Interaction">
          {INTERACT_SIMPLE.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={selectedIx.type === m.id}
              onClick={() => applySelectedInteraction({ type: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        {showAdvanced ? (
          <label className="pointer-events-auto text-[9px] uppercase tracking-widest text-[var(--sps-muted)] max-w-[18rem]">
            Interact
            <select
              className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
              value={selectedIx.type || 'none'}
              onChange={(e) => applySelectedInteraction({ type: e.target.value })}
              aria-label="Interaction type"
            >
              {INTERACT_PRO.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        {speakNow?.text ? (
          <p className="text-[10px] text-[var(--sps-text)] m-0 max-w-[18rem] pointer-events-none">
            <span className="uppercase tracking-widest text-[var(--sps-muted)]">{speakNow.speakerId || 'Speaker'} · </span>
            {speakNow.text}
          </p>
        ) : plan.dialogue?.[0]?.text ? (
          <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0 pointer-events-none truncate max-w-[18rem]">
            Dialogue · {plan.dialogue[0].speakerId || 'line'}
          </p>
        ) : (
          <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0 pointer-events-none">Needs Direction · dialogue</p>
        )}
        <div className="flex gap-1 pointer-events-auto">
          <button type="button" className={`sps-btn text-[10px] min-w-[4.2rem] ${transformMode === 'translate' ? 'sps-btn-primary' : ''}`} onClick={() => { setTransformMode('translate'); setMode('compose'); }}>Move</button>
          <button type="button" className={`sps-btn text-[10px] min-w-[4.2rem] ${transformMode === 'rotate' ? 'sps-btn-primary' : ''}`} onClick={() => { setTransformMode('rotate'); setMode('compose'); }}>Turn</button>
        </div>
        <div className="flex flex-wrap gap-1 pointer-events-auto max-w-[18rem]">
          <button type="button" className="sps-btn text-[10px]" onClick={snapSelectedToGround}>Snap</button>
          <button type="button" className="sps-btn text-[10px]" onClick={frameSelected}>Frame</button>
          <button type="button" className="sps-btn text-[10px]" onClick={focusSelected}>Focus</button>
          <button type="button" className="sps-btn text-[10px]" onClick={duplicateSelected}>Dup</button>
          <button type="button" className="sps-btn text-[10px]" onClick={resetSelectedTransform}>Reset</button>
          <button type="button" className="sps-btn text-[10px]" onClick={toggleLockSelected}>
            {selectedKey && String(selectedKey).startsWith('human:') && plan.humans?.[Number(String(selectedKey).split(':')[1])]?.locked
              ? 'Unlock'
              : 'Lock'}
          </button>
          <button type="button" className="sps-btn text-[10px]" onClick={hideSelected}>Hide</button>
          <button type="button" className="sps-btn text-[10px]" onClick={showHiddenCharacters}>Show</button>
        </div>
        {selectedKey ? (
          <div className="pointer-events-auto border border-[var(--sps-border)] bg-[#0c0b0a]/85 px-2 py-1.5 max-w-[18rem]">
            <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] truncate m-0 mb-1">{propsDraft.label || 'Selected'}</p>
            <div className="flex gap-1">
              {['X', 'Y', 'Z'].map((axis, i) => (
                <label key={axis} className="flex-1 min-w-0 text-[9px] text-[var(--sps-muted)]">
                  {axis}
                  <input
                    type="number"
                    step="0.05"
                    value={Number(propsDraft.loc[i] ?? 0).toFixed(2)}
                    onChange={(e) => patchSelectedLoc(i, e.target.value)}
                    className="w-full bg-transparent border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] tabular-nums px-1 py-0.5"
                    aria-label={`Position ${axis}`}
                    disabled={!!(selectedKey && String(selectedKey).startsWith('human:') && plan.humans?.[Number(String(selectedKey).split(':')[1])]?.locked)}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <div className="sps-tabs sps-tabs-compact pointer-events-auto flex-wrap max-w-[18rem]" role="tablist" aria-label="Set">
          {STAGE_SET_IDS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={plan.environment?.setId === s.id}
              onClick={() => applyStageSet(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0 pointer-events-none">
          {plan.environment?.needsDirection
            ? 'Needs Direction'
            : plan.environment?.inferred
              ? `INFERRED · ${plan.environment?.timeOfDay || ''}`
              : plan.environment?.timeOfDay || ''}
        </p>
        <div className="flex flex-wrap gap-1 pointer-events-auto max-w-[18rem]">
          {STAGE_PROP_CHIPS.map((p) => (
            <button key={p.id} type="button" className="sps-btn text-[10px]" onClick={() => addPropPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 pointer-events-auto max-w-[18rem]" role="group" aria-label="Practicals">
          {STAGE_PRACTICAL_CHIPS.map((p) => (
            <button key={p.id} type="button" className="sps-btn text-[10px]" onClick={() => addPractical(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {showAdvanced ? (
          <div className="pointer-events-auto max-w-[18rem] flex flex-col gap-1" aria-label="Practical keys">
            <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0">Practical on / off / level / K</p>
            {(plan.environment?.pieces || []).filter((p) => p.practical).length === 0 ? (
              <p className="text-[10px] text-[var(--sps-muted)] m-0">Add a practical, then key it</p>
            ) : (
              (plan.environment?.pieces || []).filter((p) => p.practical).map((p) => (
                <label key={p.id} className="flex items-center gap-1 text-[10px] text-[var(--sps-text)]">
                  <span className="w-12 truncate">{p.kind}</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    placeholder="on"
                    aria-label={`${p.kind} on seconds`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-1 py-0.5"
                    value={p.on ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'on', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    placeholder="off"
                    aria-label={`${p.kind} off seconds`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-1 py-0.5"
                    value={p.off ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'off', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    placeholder="lvl"
                    aria-label={`${p.kind} intensity`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-1 py-0.5"
                    value={p.intensity ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'intensity', e.target.value)}
                  />
                  <input
                    type="number"
                    min="1000"
                    max="12000"
                    step="100"
                    placeholder="K"
                    aria-label={`${p.kind} kelvin`}
                    className="w-14 bg-[#141210] border border-[var(--sps-border)] px-1 py-0.5"
                    value={p.kelvin ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'kelvin', e.target.value)}
                  />
                  <select
                    aria-label={`${p.kind} gel`}
                    className="w-[4.2rem] bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    value={p.gel || ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'gel', e.target.value)}
                  >
                    {PRACTICAL_GELS.map((g) => (
                      <option key={g.id || 'clear'} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`${p.kind} gobo`}
                    className="w-[4.2rem] bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    value={p.gobo || ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'gobo', e.target.value)}
                  >
                    {PRACTICAL_GOBOS.map((g) => (
                      <option key={g.id || 'open'} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`${p.kind} barn doors`}
                    className="w-[4.2rem] bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    value={p.barn || ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'barn', e.target.value)}
                  >
                    {PRACTICAL_BARNS.map((g) => (
                      <option key={g.id || 'open'} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`${p.kind} shutter`}
                    className="w-[4.2rem] bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    value={p.shutter || ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'shutter', e.target.value)}
                  >
                    {PRACTICAL_SHUTTERS.map((g) => (
                      <option key={g.id || 'open'} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`${p.kind} bounce`}
                    className="w-[4.2rem] bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    value={p.bounce || ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounce', e.target.value)}
                  >
                    {PRACTICAL_BOUNCE.map((g) => (
                      <option key={g.id || 'none'} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`${p.kind} bounce color`}
                    className="w-[4.2rem] bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    value={p.bounceColor || ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounceColor', e.target.value)}
                  >
                    {PRACTICAL_BOUNCE_COLORS.map((g) => (
                      <option key={g.id || 'white'} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={-80}
                    max={80}
                    step={5}
                    aria-label={`${p.kind} bounce angle`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    placeholder="°"
                    value={p.bounceAngle ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounceAngle', e.target.value)}
                  />
                  <input
                    type="number"
                    min={0.2}
                    max={2.5}
                    step={0.1}
                    aria-label={`${p.kind} bounce distance`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    placeholder="m"
                    value={p.bounceDistance ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounceDistance', e.target.value)}
                  />
                  <input
                    type="number"
                    min={0.05}
                    max={1.8}
                    step={0.05}
                    aria-label={`${p.kind} bounce height`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    placeholder="h"
                    value={p.bounceHeight ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounceHeight', e.target.value)}
                  />
                  <input
                    type="number"
                    min={-45}
                    max={45}
                    step={5}
                    aria-label={`${p.kind} bounce tilt`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    placeholder="tilt"
                    value={p.bounceTilt ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounceTilt', e.target.value)}
                  />
                  <input
                    type="number"
                    min={0.4}
                    max={2.5}
                    step={0.1}
                    aria-label={`${p.kind} bounce spread`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    placeholder="×"
                    value={p.bounceSpread ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounceSpread', e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    aria-label={`${p.kind} bounce feather`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    placeholder="fe"
                    value={p.bounceFeather ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounceFeather', e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    aria-label={`${p.kind} bounce spill`}
                    className="w-12 bg-[#141210] border border-[var(--sps-border)] px-0.5 py-0.5 text-[9px]"
                    placeholder="sp"
                    value={p.bounceSpill ?? ''}
                    onChange={(e) => patchPracticalTiming(p.id, 'bounceSpill', e.target.value)}
                  />
                </label>
              ))
            )}
          </div>
        ) : null}
        <div className="sps-tabs sps-tabs-compact pointer-events-auto flex-wrap max-w-[18rem]" role="tablist" aria-label="Light">
          {LIGHT_SIMPLE.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={plan.lighting?.setup === s.id}
              onClick={() => applyStageLight(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0 pointer-events-none">
          {plan.lighting?.needsDirection
            ? 'Needs Direction · light'
            : plan.lighting?.inferred
              ? `INFERRED · ${plan.lighting?.setup || ''}`
              : plan.lighting?.setup || ''}
        </p>
        {showAdvanced ? (
          <label className="pointer-events-auto text-[9px] uppercase tracking-widest text-[var(--sps-muted)] max-w-[18rem]">
            Light
            <select
              className="w-full bg-[#141210] border border-[var(--sps-border)] text-[11px] text-[var(--sps-text)] px-1 py-0.5"
              value={plan.lighting?.setup || 'rembrandt'}
              onChange={(e) => applyStageLight(e.target.value)}
              aria-label="Lighting setup"
            >
              {LIGHT_PRO.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        {showAdvanced ? (
          <label className="pointer-events-auto text-[9px] uppercase tracking-widest text-[var(--sps-muted)] max-w-[18rem]">
            GLB figure
            <span className="block normal-case tracking-normal text-[9px] text-[var(--sps-muted)] font-normal">
              Mixamo idle / walk / run from movement — look ≠ walk
            </span>
            <input
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              className="block w-full text-[10px] text-[var(--sps-text)]"
              aria-label="Load GLB for selected character"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSelectedGlb(file);
                e.target.value = '';
              }}
            />
          </label>
        ) : null}
        <label className="pointer-events-auto text-[10px] uppercase tracking-widest text-[var(--sps-muted)] flex flex-col gap-0.5">
          Frame
          <select
            aria-label="Frame aspect"
            className="bg-[#141210] border border-[var(--sps-border)] text-[var(--sps-text)] text-[11px] px-1.5 py-1 max-w-[10rem]"
            value={activeAspectOpt.value}
            onChange={(e) => typeof setAspectRatio === 'function' && setAspectRatio(e.target.value)}
          >
            {ASPECT_RATIO_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        {showAdvanced ? (
          <>
            <button
              type="button"
              className={`sps-btn text-[10px] pointer-events-auto ${showGuidePanel ? 'sps-btn-primary' : ''}`}
              onClick={() => setShowGuidePanel((v) => !v)}
            >
              Guides
            </button>
            {showGuidePanel ? (
              <div className="pointer-events-auto flex flex-wrap gap-1 max-w-[18rem]">
                {GUIDE_KEYS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`sps-btn text-[9px] ${stageGuides[g.id] ? 'sps-btn-primary' : ''}`}
                    onClick={() => setStageGuides((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="absolute right-3 top-16 z-30 flex flex-col items-end gap-1 pointer-events-none">
        <div className="sps-tabs sps-tabs-compact pointer-events-auto" role="tablist" aria-label="Beat length">
          {DURATION_PRESETS.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={Number(duration) === s} onClick={() => updateCameraSettings({ durationSec: s })}>
              {s}s
            </button>
          ))}
        </div>
        <div className="flex gap-1 pointer-events-auto">
          <button
            type="button"
            className="sps-btn text-[10px]"
            disabled={!canUndoStage}
            onClick={undoStage}
          >
            Undo
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            disabled={!canRedoStage}
            onClick={redoStage}
          >
            Redo
          </button>
        </div>
        <button
          type="button"
          className="sps-btn text-[10px] pointer-events-auto"
          onClick={() => {
            const next = heuristicStagePlanFromShot(shot, activeShotIndex);
            applyPlanToScene(next);
            persistDirectorToShot(false, next);
            setPromptSynced(false);
            setStatus('Parsed prompt into Stage — video prompt unchanged');
          }}
        >
          Parse prompt
        </button>
        <button type="button" className="sps-btn text-[10px] pointer-events-auto" onClick={handleUpdateVideoPrompt}>Update Video Prompt</button>
        <button type="button" className="sps-btn text-[10px] pointer-events-auto" onClick={handleMatchPrevious}>Match Prev</button>
        <button type="button" className={`sps-btn text-[10px] pointer-events-auto ${ghostPrevious ? 'sps-btn-primary' : ''}`} onClick={handleToggleGhost}>Ghost</button>
        <button type="button" className="sps-btn text-[10px] pointer-events-auto" disabled={comfyBusy} onClick={handleSendComfy}>{comfyBusy ? 'Sending…' : 'Send Comfy'}</button>
        <button type="button" className="sps-btn text-[10px] pointer-events-auto" disabled={exportDisabled} onClick={handleExportDirectorPack}>Export Stage</button>
        {showAdvanced ? (
          <button type="button" className="sps-btn text-[10px] pointer-events-auto" onClick={selectPrimaryCamera}>Pick camera</button>
        ) : null}
        <button type="button" className="sps-btn text-[10px] pointer-events-auto" onClick={fitToScreen}>Fit</button>
        <button type="button" className="sps-btn text-[10px] pointer-events-auto" onClick={() => setShowChat((v) => !v)}>{showChat ? 'Hide ask' : 'Ask'}</button>
      </div>

      {matchReport ? (
        <div className="absolute right-3 top-52 z-30 max-w-[16rem] pointer-events-auto border border-[var(--sps-border)] bg-[#0c0b0a]/92 px-2 py-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[9px] uppercase tracking-widest text-[var(--sps-muted)] m-0">Match Prev</p>
            <button type="button" className="sps-btn text-[9px]" onClick={() => {
              if (matchReport.pending) handleMatchReject();
              else setMatchReport(null);
            }}>{matchReport.pending ? 'Reject' : 'Close'}</button>
          </div>
          <p className="text-[11px] text-[var(--sps-text)] m-0 mt-1">{matchReport.summary}</p>
          <ul className="m-0 mt-1 pl-3 text-[10px] text-[var(--sps-muted)]">
            {(matchReport.lines || []).slice(0, 6).map((line) => (
              <li key={line.id}>
                {line.copied ? 'Copied' : 'Kept'} · {line.label}: {line.detail}
              </li>
            ))}
          </ul>
          {matchReport.pending ? (
            <div className="flex gap-1 mt-1.5">
              <button type="button" className="sps-btn sps-btn-primary text-[9px]" onClick={handleMatchApply}>Apply</button>
              <button type="button" className="sps-btn text-[9px]" onClick={handleMatchReject}>Reject</button>
            </div>
          ) : (
            <p className="text-[9px] text-[var(--sps-muted)] m-0 mt-1">Applied</p>
          )}
        </div>
      ) : null}

      <div ref={mountRef} className="flex-1 min-w-0 min-h-0" />

      {(mode === 'shoot' || isExportingVideo) && (
        <div className="pointer-events-none absolute inset-16 z-10 border border-white/25">
          <DirectorStageFrameOverlay guides={stageGuides} slate={directorSlate} />
        </div>
      )}

      {showCameraView && mode === 'compose' && (
        <div
          className="absolute z-20 border border-[var(--sps-border)] bg-black overflow-hidden"
          style={{ left: 12, bottom: 88, width: Math.min(pipFrame.w, 280) }}
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-[var(--sps-muted)] border-b border-[var(--sps-border)]">What the camera sees</div>
          <div className="relative bg-black" style={{ width: '100%', height: Math.min(pipFrame.h, 158) }}>
            <div ref={previewMountRef} className="absolute inset-0" />
            <DirectorStageFrameOverlay guides={stageGuides} slate={directorSlate} compact />
          </div>
        </div>
      )}

      {showChat && (
        <div className="absolute right-3 top-40 bottom-24 z-30 w-64 flex flex-col border border-[var(--sps-border)] bg-[#141210]/95">
          <div className="px-3 py-2 border-b border-[var(--sps-border)] text-[11px] uppercase tracking-widest text-[var(--sps-gold)]">Ask the stage</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-[12px]">
            {chatLog.map((m, i) => (
              <div key={i} className="leading-relaxed text-[var(--sps-text)] opacity-90">{m.text}</div>
            ))}
          </div>
          <div className="p-2 border-t border-[var(--sps-border)] flex gap-1">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatInput.trim()) {
                  const msg = chatInput.trim();
                  setChatLog((p) => [...p, { role: 'user', text: msg }]);
                  setChatInput('');
                  runCompose(msg);
                }
              }}
              placeholder="Wider, closer, slower…"
              className="flex-1 min-w-0 bg-transparent border border-[var(--sps-border)] px-2 py-1 text-[12px] outline-none"
            />
            <button type="button" className="sps-btn sps-btn-primary text-[10px]" disabled={isComposing} onClick={() => {
              if (chatInput.trim()) {
                const msg = chatInput.trim();
                setChatLog((p) => [...p, { role: 'user', text: msg }]);
                setChatInput('');
                runCompose(msg);
              } else runCompose('');
            }}>{isComposing ? '…' : 'Go'}</button>
          </div>
        </div>
      )}

      <div className="absolute left-0 right-0 bottom-0 z-30 border-t border-[var(--sps-border)] bg-[#0c0b0a]/95 px-3 py-1 flex flex-col gap-1">
        <div className="flex flex-col gap-0.5 px-14">
          {(showAdvanced ? timeline.lanes : timeline.lanes.slice(0, 4)).map((lane) => {
            const left = Math.max(0, (lane.start / duration) * 100);
            const width = Math.max(1.5, ((lane.end - lane.start) / duration) * 100);
            return (
              <div key={lane.id} className="relative h-1 bg-[#1a1816] overflow-hidden" title={lane.label}>
                <div
                  className="absolute inset-y-0 opacity-80"
                  style={{ left: `${left}%`, width: `${width}%`, background: lane.color }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
        <button type="button" className="sps-btn text-[10px] min-w-[3.5rem]" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
        <button
          type="button"
          className="sps-btn text-[10px]"
          onClick={() => {
            setPlaying(false);
            playRef.current.t = 0;
            playRef.current.last = 0;
            setTimeSec(0);
          }}
        >
          Stop
        </button>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.05}
          value={Math.min(timeSec, duration)}
          onChange={(e) => {
            const v = Number(e.target.value);
            playRef.current.t = v;
            setTimeSec(v);
            setPlaying(false);
          }}
          className="flex-1 accent-[#d4b483]"
        />
        <span className="text-[11px] tabular-nums text-[var(--sps-muted)] w-16">{timeSec.toFixed(1)}s</span>
        {showAdvanced ? (
          <>
            <button type="button" className="sps-btn text-[10px]" onClick={insertKeyframeAtPlayhead}>Mark</button>
            <button
              type="button"
              className="sps-btn text-[10px] disabled:opacity-40"
              disabled={exportDisabled}
              title={
                saasExportBlocked
                  ? 'Export off for this license'
                  : lifecycleExportBlocked
                    ? exportLife.message
                    : 'Depth pass PNG'
              }
              onClick={() => exportAiPasses(['depth'])}
            >
              Depth
            </button>
            <button
              type="button"
              className="sps-btn text-[10px] disabled:opacity-40"
              disabled={exportDisabled}
              title={
                saasExportBlocked
                  ? 'Export off for this license'
                  : lifecycleExportBlocked
                    ? exportLife.message
                    : 'OpenPose pass PNG'
              }
              onClick={() => exportAiPasses(['openpose'])}
            >
              Pose
            </button>
            <button
              type="button"
              className="sps-btn text-[10px] disabled:opacity-40"
              disabled={exportDisabled}
              title={
                saasExportBlocked
                  ? 'Export off for this license'
                  : lifecycleExportBlocked
                    ? exportLife.message
                    : 'Print all AI passes as PDF pack'
              }
              onClick={exportPassPdfPack}
            >
              Pass PDF
            </button>
            <button
              type="button"
              className="sps-btn text-[10px] disabled:opacity-40"
              disabled={exportDisabled}
              title={
                saasExportBlocked
                  ? 'Export off for this license'
                  : lifecycleExportBlocked
                    ? exportLife.message
                    : 'Mannequin OBJ base'
              }
              onClick={exportObjBase}
            >
              OBJ
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="sps-btn text-[10px] disabled:opacity-40"
          disabled={exportDisabled}
          title={
            saasExportBlocked
              ? 'Export off for this license'
              : lifecycleExportBlocked
                ? exportLife.message
                : 'Lens still PNG'
          }
          onClick={downloadStillImage}
        >
          Preview
        </button>
        <button
          type="button"
          className="sps-btn sps-btn-primary text-[10px] disabled:opacity-40"
          onClick={downloadTimelineVideo}
          disabled={exportDisabled}
          title={
            saasExportBlocked
              ? 'Export off for this license'
              : lifecycleExportBlocked
                ? exportLife.message
                : 'Timeline MP4 clip'
          }
        >
          {isExportingVideo ? 'Saving…' : 'Clip'}
        </button>
        </div>
      </div>
    </div>
  );
}
