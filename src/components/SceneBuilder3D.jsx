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
  heuristicStagePlanFromShot
} from '../services/compose3DStageWithLLM';
import { parseSceneAndShotID } from '../utils/sceneShotUtils';
import { ensureMp4Blob, pickRecorderMimePreferMp4 } from '../utils/exportStageMp4';
import { ASPECT_RATIO_OPTIONS } from '../constants/aspectRatios';
import { buildShotExportStem, saveExportBlob } from '../utils/saveExportFile';
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
  exportMannequinsObj
} from '../utils/exportStagePasses';
import {
  makeStudioMannequin,
  applyStudioMannequinPose
} from '../utils/makeStudioMannequin';
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

const FOCAL_PRESETS = [14, 18, 24, 28, 35, 40, 50, 70, 85, 100, 135, 200];
const APERTURE_PRESETS = [1.4, 1.8, 2.0, 2.8, 4.0, 5.6, 8.0, 11, 16, 22];
const CLIP_NEAR_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
const CLIP_FAR_PRESETS = [50, 100, 200, 500, 1000];
const DURATION_PRESETS = [2, 3, 5, 8, 10, 15, 20, 30];

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

function makeMannequin(colorHex, poseIn) {
  return makeStudioMannequin(colorHex, poseIn, { build: 'muscular' });
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

function clampNum(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function focalMmToFov(focalMm) {
  return (2 * Math.atan(36 / (2 * Math.max(12, focalMm))) * 180) / Math.PI;
}

function fovToFocalMm(fovDeg) {
  const fov = clampNum(Number(fovDeg) || 50, 5, 120);
  const rad = (fov * Math.PI) / 180;
  return clampNum(36 / (2 * Math.tan(rad / 2)), 12, 300);
}

function makeFrustumHelper(focalMm = 35, aspect = 16 / 9) {
  const fov = (2 * Math.atan(36 / (2 * Math.max(12, focalMm))) * 180) / Math.PI;
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
  const u = durationSec > 0 ? Math.min(1, Math.max(0, t / durationSec)) : 0;
  const anim = camPlan.animation || { type: 'static' };
  const look = new THREE.Vector3(...(camPlan.lookAt || [0, 1.2, 0]));
  const base = camPlan.position || [-2, 1.4, 3];

  if (anim.type === 'orbit') {
    const radius = anim.radius ?? (Math.hypot(base[0], base[2]) || 3.4);
    const height = anim.height ?? base[1];
    const revs = anim.revolutions ?? 0.35;
    const startAng = Math.atan2(base[2], base[0]);
    const ang = startAng + revs * Math.PI * 2 * u;
    return {
      position: new THREE.Vector3(Math.cos(ang) * radius, height, Math.sin(ang) * radius),
      lookAt: look
    };
  }

  if (anim.type === 'dolly' || anim.type === 'crane' || anim.type === 'pan') {
    const from = anim.from || base;
    const to = anim.to || base;
    const position = new THREE.Vector3(
      from[0] + (to[0] - from[0]) * u,
      from[1] + (to[1] - from[1]) * u,
      from[2] + (to[2] - from[2]) * u
    );
    return { position, lookAt: look };
  }

  return {
    position: new THREE.Vector3(...base),
    lookAt: look
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
  const gridHelperRef = useRef(null);
  const groundMeshRef = useRef(null);
  const imagePlaneRef = useRef(null);
  const frustumRef = useRef(null);
  const pathGroupRef = useRef(null);
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
  const [showCrewTips, setShowCrewTips] = useState(() => {
    try {
      return localStorage.getItem('sps_3d_crew_tips_dismissed') !== '1';
    } catch {
      return true;
    }
  });
  const [transformMode, setTransformMode] = useState('translate');
  const [navTool, setNavTool] = useState('orbit');
  const [isOrtho, setIsOrtho] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [autoKey, setAutoKey] = useState(true);
  const [pipPinned, setPipPinned] = useState(false);
  const [pipPos, setPipPos] = useState({ x: 24, y: 24 }); // from bottom-left of viewport area
  const [poseVersion, setPoseVersion] = useState(0);
  const [showCurves, setShowCurves] = useState(true);
  const [curveChannel, setCurveChannel] = useState('posX');
  const [depthInvert, setDepthInvert] = useState(false);
  const [depthStrength, setDepthStrength] = useState(1.2);
  const [depthBusy, setDepthBusy] = useState(false);
  const depthFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const [lightAzimuth, setLightAzimuth] = useState(35);
  const [lightElevation, setLightElevation] = useState(55);
  const [lightIntensity, setLightIntensity] = useState(1.15);
  const [showGrid, setShowGrid] = useState(true);
  const [showGround, setShowGround] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [cameraBookmarks, setCameraBookmarks] = useState([]);
  const [poseClipboard, setPoseClipboard] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
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
      cameras: [...(planRef.current.cameras || [])]
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
          keyframes: keys
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
      if (obj && modeRef.current === 'compose') {
        tc.attach(obj);
        tc.visible = true;
      } else {
        tc.detach();
        tc.visible = false;
      }
    }
      if (obj) {
      setSelectedKey(`${obj.userData.kind}:${obj.userData.planIndex ?? 0}`);
      readObjectProps(obj);
      setShowSidebar(true);
      setPoseVersion((v) => v + 1);
    } else {
      setSelectedKey(null);
      readObjectProps(null);
    }
    if (planRef.current) rebuildMotionPaths(planRef.current);
  }, [readObjectProps, rebuildMotionPaths]);

  const applyPlanToScene = useCallback((nextPlan) => {
    const scene = sceneRef.current;
    if (!scene || !nextPlan) return;

    if (transformRef.current) {
      transformRef.current.detach();
    }
    selectedRef.current = null;
    setSelectedKey(null);

    humansRef.current.forEach((g) => scene.remove(g));
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

    (nextPlan.humans || []).forEach((h, idx) => {
      const m = makeMannequin(h.color, h.pose);
      const y = h.position[1] != null ? h.position[1] : 0;
      m.position.set(h.position[0], y, h.position[2]);
      if (h.rotation) m.rotation.set(h.rotation[0] || 0, h.rotation[1] || h.rotationY || 0, h.rotation[2] || 0);
      else m.rotation.y = h.rotationY || 0;
      if (h.scale) m.scale.set(h.scale[0] || 1, h.scale[1] || 1, h.scale[2] || 1);
      m.userData.label = h.id;
      m.userData.planIndex = idx;
      m.userData.pose = normalizePose(h.pose);
      scene.add(m);
      humansRef.current.push(m);
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
        const { helper, cam: helperCam } = makeFrustumHelper(c.focalMm || nextPlan.focalMm, aspectNumeric);
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

  // Init WebGL once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = Math.max(320, mount.clientWidth || 960);
    const height = Math.max(220, mount.clientHeight || Math.round(width / Math.max(0.5, aspectNumeric)));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2c2c2e);
    scene.fog = new THREE.Fog(0x2c2c2e, 22, 48);
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

    scene.add(new THREE.HemisphereLight(0xe8e8f0, 0x3a3a40, 0.75));
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
    const rim = new THREE.DirectionalLight(0xffffff, 0.2);
    rim.position.set(0, 3, -8);
    scene.add(rim);

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
      }
      if (!event.value && selectedRef.current) {
        syncPlanFromObjectRef.current(selectedRef.current, { writeKey: !!autoKeyRef.current });
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

    applyPlanToScene(planRef.current || heuristicStagePlanFromShot(shot, activeShotIndex));

    const pickables = () => [
      ...humansRef.current,
      ...filmCamsRef.current,
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

      // Humans — keyframe tracks (path + body pose)
      (p?.humans || []).forEach((h, idx) => {
        const obj = humansRef.current[idx];
        if (!obj) return;
        if (skipDrag && selectedRef.current === obj) return;
        const keyed = evalKeyframeTrack(h.keyframes, tNow);
        if (keyed) {
          applyPoseToObject(obj, keyed, false);
        } else if (h.pose) {
          applyMannequinPose(obj, h.pose);
        }
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
        const fov = (2 * Math.atan(36 / (2 * Math.max(12, camPlan.focalMm || p.focalMm || 35))) * 180) / Math.PI;
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
    const next = heuristicStagePlanFromShot(shot, activeShotIndex);
    applyPlanToScene(next);
    setStatus(`Loaded craft blocking for ${parseSceneAndShotID(shot, activeShotIndex).shortId}`);
  }, [shot?.sceneShotId, activeShotIndex, applyPlanToScene, shot]);

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
    if (mode === 'compose' && selectedRef.current) {
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
    const d = nextDraft || propsDraft;
    obj.position.set(d.loc[0], obj.userData.kind === 'human' ? 0 : d.loc[1], d.loc[2]);
    obj.rotation.set(d.rot[0] * RAD, d.rot[1] * RAD, d.rot[2] * RAD);
    obj.scale.set(
      Math.max(0.05, d.scl[0]),
      Math.max(0.05, d.scl[1]),
      Math.max(0.05, d.scl[2])
    );
    syncPlanFromObject(obj);
  }, [propsDraft, syncPlanFromObject]);

  const updateCameraSettings = useCallback((patch) => {
    const next = { ...plan, cameras: [...(plan.cameras || [])] };
    Object.assign(next, patch);
    if (patch.focalMm != null && next.cameras[0]) {
      next.cameras[0] = { ...next.cameras[0], focalMm: patch.focalMm };
    }
    if (patch.animationType && next.cameras[0]) {
      next.cameras[0] = {
        ...next.cameras[0],
        animation: {
          ...(next.cameras[0].animation || {}),
          type: patch.animationType
        },
        keyframes: []
      };
      next.cameras[0].keyframes = bakeCameraKeyframes(
        next.cameras[0],
        next.durationSec || 5,
        6
      );
    }
    if (patch.durationSec != null && next.cameras[0]?.animation) {
      next.cameras[0] = {
        ...next.cameras[0],
        keyframes: bakeCameraKeyframes(next.cameras[0], patch.durationSec, 6)
      };
    }
    applyPlanToScene(next);
    setStatus('Camera settings updated');
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
        color: n % 2 ? '#e8b84a' : '#e0a830'
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

  // Directional light + stage visibility (PoseMy-class lighting / settings)
  useEffect(() => {
    const light = keyLightRef.current;
    if (light) {
      const az = (lightAzimuth * Math.PI) / 180;
      const el = (lightElevation * Math.PI) / 180;
      const r = 12;
      light.position.set(
        Math.cos(el) * Math.sin(az) * r,
        Math.sin(el) * r,
        Math.cos(el) * Math.cos(az) * r
      );
      light.intensity = lightIntensity;
      light.castShadow = showShadows;
    }
    if (rendererRef.current) rendererRef.current.shadowMap.enabled = showShadows;
    if (gridHelperRef.current) gridHelperRef.current.visible = showGrid;
    if (groundMeshRef.current) groundMeshRef.current.visible = showGround;
  }, [lightAzimuth, lightElevation, lightIntensity, showGrid, showGround, showShadows]);

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
        modes
      });
      exportLensOnlyRef.current = prev;
      setStatus(`Exported ${results.length} pass(es): ${results.map((r) => r.mode).join(', ')}`);
    } catch (err) {
      setStatus(`Export failed: ${err?.message || 'unknown'}`);
    } finally {
      setExportBusy(false);
    }
  }, [shot, activeShotIndex, projectTitle]);

  const exportObjBase = useCallback(async () => {
    const stem = buildShotExportStem(shot, activeShotIndex, projectTitle);
    const blob = exportMannequinsObj(humansRef.current);
    const saved = await saveExportBlob(blob, `${stem}_mannequins.obj`);
    if (!saved.canceled) setStatus(`OBJ base saved: ${saved.filePath || `${stem}_mannequins.obj`}`);
  }, [shot, activeShotIndex, projectTitle]);

  const addPropPreset = useCallback((propId) => {
    const prop = PROP_PRESETS.find((p) => p.id === propId);
    if (!prop || !sceneRef.current) return;
    let geo;
    if (prop.geo === 'cylinder') geo = new THREE.CylinderGeometry(prop.size[0], prop.size[0], prop.size[1], 20);
    else if (prop.geo === 'sphere') geo = new THREE.SphereGeometry(prop.size[0], 20, 16);
    else if (prop.geo === 'plane') geo = new THREE.PlaneGeometry(prop.size[0], prop.size[1]);
    else geo = new THREE.BoxGeometry(prop.size[0], prop.size[1], prop.size[2]);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.55, metalness: 0.08 })
    );
    mesh.position.set((Math.random() - 0.5) * 1.5, prop.y ?? (prop.size[1] ? prop.size[1] / 2 : 0.3), -0.4 + Math.random());
    if (prop.geo === 'plane') mesh.position.y = prop.size[1] / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'prop';
    mesh.userData.label = prop.label;
    mesh.userData.planIndex = Date.now();
    sceneRef.current.add(mesh);
    setStatus(`Added prop: ${prop.label}`);
  }, []);

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
      const saved = await saveExportBlob(blob, filename);
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
  }, [fileStem]);

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
      const saved = await saveExportBlob(mp4Blob, filename);
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
  }, [fileStem, isExportingVideo, plan.durationSec]);

  const duration = plan.durationSec || 5;
  const animLabel = plan.cameras?.[0]?.animation?.type || 'orbit';
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

  const toolBtn = (active, onClick, title, children) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`min-w-8 min-h-8 px-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-md border transition-colors ${
        active
          ? 'bg-[#4772b3] border-[#6a9adf] text-white'
          : 'bg-[#2c2c2c] border-[#3d3d3d] text-zinc-300 hover:bg-[#383838] hover:text-white'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="relative w-full h-full min-h-0 flex bg-[#2c2c2e] overflow-hidden rounded-none border-0 select-none">
      {/* Production toolbar */}
      <div className="absolute left-2 right-2 top-2 z-30 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-0.5 p-0.5 rounded-lg bg-[#1c1c1e]/95 border border-white/10 shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => { setMode('compose'); setPlaying(false); }}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${mode === 'compose' && !playing ? 'bg-[#3a3a3c] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <Clapperboard className="w-3.5 h-3.5" /> Stage
          </button>
          <button
            type="button"
            onClick={() => { setMode('shoot'); setShowCameraView(true); }}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${mode === 'shoot' ? 'bg-cyan-500/90 text-zinc-950' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Lens
          </button>
          <button
            type="button"
            onClick={() => { setMode('compose'); setPlaying(true); }}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${playing ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} Play
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg bg-[#1c1c1e]/95 border border-white/10 shadow-xl backdrop-blur-md">
          <span className="text-[10px] font-semibold text-zinc-500 px-1 shrink-0">Frame</span>
          <select
            value={ASPECT_RATIO_OPTIONS.find((o) => String(aspectRatio).startsWith(o.id) || aspectRatio === o.value)?.value || aspectRatio}
            onChange={(e) => setAspectRatio?.(e.target.value)}
            className="bg-transparent border-0 rounded-md px-1.5 py-1 text-[11px] font-semibold text-zinc-100 outline-none max-w-[10.5rem] cursor-pointer"
          >
            {ASPECT_RATIO_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.value} className="bg-[#1c1c1e]">{opt.label} · {opt.subtitle}</option>
            ))}
          </select>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={selectPrimaryCamera}
            className="px-2.5 py-1.5 rounded-lg bg-[#1c1c1e]/95 border border-white/10 text-[10px] font-semibold text-cyan-200 hover:bg-[#2a2a2c]"
          >
            Cam 1
          </button>
          <button
            type="button"
            onClick={fitToScreen}
            className="px-2.5 py-1.5 rounded-lg bg-[#1c1c1e]/95 border border-white/10 text-[10px] font-semibold text-zinc-200 hover:bg-[#2a2a2c] flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3" /> Fit
          </button>
          {typeof onMinimizeHeader === 'function' && (
            <button type="button" onClick={onMinimizeHeader} className="p-1.5 rounded-lg bg-[#1c1c1e]/95 border border-white/10 text-zinc-300 hover:bg-[#2a2a2c]" title="Minimize app header">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setShowSidebar((v) => !v)} className="p-1.5 rounded-lg bg-[#1c1c1e]/95 border border-white/10 text-zinc-300 hover:bg-[#2a2a2c]" title="Settings">
            {showSidebar ? <ChevronRight className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={() => setShowAdvanced((v) => !v)} className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold ${showAdvanced ? 'bg-white/10 text-white border-white/20' : 'bg-[#1c1c1e]/95 text-zinc-400 border-white/10'}`}>
            Tools
          </button>
        </div>
      </div>

      {showCrewTips && (
        <div className="absolute left-2 right-2 top-14 z-30 pointer-events-auto flex items-start gap-2 px-3 py-2 rounded-xl bg-cyan-950/90 border border-cyan-500/30 text-[11px] text-cyan-50 shadow-xl max-w-3xl">
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-cyan-300" />
          <div className="min-w-0 flex-1 leading-relaxed">
            <strong className="text-white">Camera crew quick path:</strong>{' '}
            1) Select Cam 1 → 2) Use <em>Move / Turn</em> to frame → 3) Hit <em>Key</em> on the timeline → 4) Scrub & add more keys → 5) <em>Play move</em> → 6) Export PNG / MP4.
            Drag the floating <em>Camera monitor</em>; pin it when placed. Use <em>Through lens</em> for full Camera 1 view.
          </div>
          <button type="button" className="text-[10px] text-cyan-300 hover:text-white shrink-0" onClick={dismissCrewTips}>Got it</button>
        </div>
      )}

      {/* Left: Move / Turn / Size */}
      <div className="absolute left-2 top-[7.5rem] z-30 flex flex-col gap-0.5 p-0.5 rounded-lg bg-[#1c1c1e]/95 border border-white/10 shadow-xl backdrop-blur-md">
        {toolBtn(transformMode === 'translate', () => { setTransformMode('translate'); setMode('compose'); }, 'Move', <><Move className="w-4 h-4" /><span className="text-[8px] font-bold">Move</span></>)}
        {toolBtn(transformMode === 'rotate', () => { setTransformMode('rotate'); setMode('compose'); }, 'Turn', <><RotateCw className="w-4 h-4" /><span className="text-[8px] font-bold">Turn</span></>)}
        {toolBtn(transformMode === 'scale', () => { setTransformMode('scale'); setMode('compose'); }, 'Size', <><Scaling className="w-4 h-4" /><span className="text-[8px] font-bold">Size</span></>)}
        <div className="h-px bg-white/10 my-0.5" />
        {toolBtn(false, downloadStillImage, 'PNG still', <ImageIcon className="w-4 h-4" />)}
        {toolBtn(isExportingVideo, downloadTimelineVideo, 'MP4 take', isExportingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />)}
      </div>

      {/* Advanced / Blender nav — optional */}
      {showAdvanced && (
        <div className={`absolute top-14 z-30 flex flex-col items-end gap-2 ${showSidebar ? 'right-[16.25rem]' : 'right-3'}`}>
          <div className="flex flex-col gap-1 p-1 rounded-lg bg-[#242424]/95 border border-[#3d3d3d]">
            {toolBtn(false, fitToScreen, 'Fit to screen', <Maximize2 className="w-4 h-4" />)}
            {toolBtn(navTool === 'zoom', () => setNavTool((t) => (t === 'zoom' ? 'orbit' : 'zoom')), 'Zoom drag', <ZoomIn className="w-4 h-4" />)}
            {toolBtn(navTool === 'pan', () => setNavTool((t) => (t === 'pan' ? 'orbit' : 'pan')), 'Pan drag', <Hand className="w-4 h-4" />)}
            {toolBtn(isOrtho, toggleOrtho, 'Ortho / Perspective', <Grid3x3 className="w-4 h-4" />)}
            {toolBtn(false, () => zoomBy(0.82), 'Zoom in', <ZoomIn className="w-3.5 h-3.5" />)}
            {toolBtn(false, () => zoomBy(1.22), 'Zoom out', <ZoomOut className="w-3.5 h-3.5" />)}
            {toolBtn(false, () => applyPlanToScene(heuristicStagePlanFromShot(shot, activeShotIndex)), 'Reset blocking', <RotateCcw className="w-4 h-4" />)}
            {toolBtn(showLibrary, () => setShowLibrary((v) => !v), 'Add props', <Plus className="w-4 h-4" />)}
            {toolBtn(showChat, () => setShowChat((v) => !v), 'AI stage director', <MessageSquare className="w-4 h-4" />)}
          </div>
        </div>
      )}

      {/* Viewport */}
      <div ref={mountRef} className="flex-1 min-w-0 min-h-0" />

      {(mode === 'shoot' || isExportingVideo) && (
        <div className="pointer-events-none absolute inset-12 border border-white/25 z-10 rounded-sm">
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/10" />)}
          </div>
          <span className="absolute bottom-2 right-2 text-[10px] font-mono text-white/80 bg-black/50 px-2 py-0.5 rounded">CAMERA 1 · LENS</span>
        </div>
      )}

      {/* Right sidebar — Transform + Camera */}
      {showSidebar ? (
        <div className="absolute right-0 top-0 bottom-[4.75rem] z-20 w-[15.5rem] flex flex-col bg-[#1c1c1e]/95 border-l border-white/10 backdrop-blur-md overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-2.5 py-2 border-b border-[#3d3d3d]">
            <span className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              Settings
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-white/5 text-zinc-400 hover:text-white"
              onClick={() => setShowSidebar(false)}
              title="Minimize side panel"
            >
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Selection</p>
              <p className="text-[12px] font-semibold text-zinc-100 truncate">
                {selectedKey ? propsDraft.label : 'Nothing selected'}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{shotLabel}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Location</p>
              {['X', 'Y', 'Z'].map((axis, i) => (
                <div key={`loc-${axis}`} className="grid grid-cols-[1.2rem_1fr] gap-1 items-center">
                  <span className="text-[10px] font-bold text-zinc-400">{axis}</span>
                  {numField(propsDraft.loc[i], (v) => {
                    const loc = [...propsDraft.loc];
                    loc[i] = v;
                    const next = { ...propsDraft, loc };
                    setPropsDraft(next);
                    applyPropsDraft(next);
                  })}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Rotation (°)</p>
              {['X', 'Y', 'Z'].map((axis, i) => (
                <div key={`rot-${axis}`} className="grid grid-cols-[1.2rem_1fr] gap-1 items-center">
                  <span className="text-[10px] font-bold text-zinc-400">{axis}</span>
                  {numField(propsDraft.rot[i], (v) => {
                    const rot = [...propsDraft.rot];
                    rot[i] = v;
                    const next = { ...propsDraft, rot };
                    setPropsDraft(next);
                    applyPropsDraft(next);
                  }, 0.1)}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Scale</p>
              {['X', 'Y', 'Z'].map((axis, i) => (
                <div key={`scl-${axis}`} className="grid grid-cols-[1.2rem_1fr] gap-1 items-center">
                  <span className="text-[10px] font-bold text-zinc-400">{axis}</span>
                  {numField(propsDraft.scl[i], (v) => {
                    const scl = [...propsDraft.scl];
                    scl[i] = v;
                    const next = { ...propsDraft, scl };
                    setPropsDraft(next);
                    applyPropsDraft(next);
                  }, 0.01)}
                </div>
              ))}
            </div>

            {(selectedKey?.startsWith('aim:') || selectedKey?.startsWith('camera:')) && (
              <div className="space-y-1.5 rounded-md border border-orange-500/25 bg-orange-500/5 p-2">
                <p className="text-[10px] uppercase tracking-wide text-orange-200/90 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Camera target / FOV
                </p>
                <p className="text-[9px] text-zinc-500 leading-snug">
                  Orange aim dummy = look-at. Drag with Move. FOV updates Camera 1 lens.
                </p>
                <label className="block text-[10px] text-zinc-400">Focal length</label>
                <select
                  value={FOCAL_PRESETS.includes(Number(plan.focalMm)) ? Number(plan.focalMm) : 35}
                  onChange={(e) => updateCameraSettings({ focalMm: Number(e.target.value) })}
                  className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-1 text-[11px] text-zinc-100 outline-none"
                >
                  {FOCAL_PRESETS.map((mm) => <option key={mm} value={mm}>{mm}mm · {focalMmToFov(mm).toFixed(1)}° FOV</option>)}
                </select>
                <label className="block text-[10px] text-zinc-400 mt-1">FOV (°)</label>
                {numField(focalMmToFov(plan.focalMm || 35), (v) => {
                  updateCameraSettings({ focalMm: Math.round(fovToFocalMm(v)) });
                }, 0.5)}
                {aimTargetRef.current && (
                  <button
                    type="button"
                    className="mt-1 w-full text-[10px] font-bold px-2 py-1 rounded bg-orange-500/20 text-orange-100 border border-orange-400/30"
                    onClick={() => attachSelection(aimTargetRef.current)}
                  >
                    Select aim dummy
                  </button>
                )}
              </div>
            )}

            {selectedKey?.startsWith('human:') && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Pose studio</p>
                <p className="text-[9px] text-zinc-500">Body type</p>
                <div className="flex flex-wrap gap-1">
                  {BODY_TYPES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => applyBodyTypeToSelection(b.id)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 hover:bg-sky-500/20 text-zinc-300 border border-[#3d3d3d]"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-500 mt-1">Poses</p>
                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                  {Object.keys(STUDIO_POSE_PRESETS).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => applyStudioPose(name)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 hover:bg-fuchsia-500/20 text-zinc-300 border border-[#3d3d3d] capitalize"
                    >
                      {name.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-500 mt-1">Hands</p>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(HAND_PRESETS).map((hid) => (
                    <button
                      key={hid}
                      type="button"
                      onClick={() => applyHandToSelection(hid)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/10 hover:bg-violet-500/25 text-violet-100 border border-violet-400/30 capitalize"
                    >
                      {hid.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <button type="button" onClick={mirrorSelectedPose} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-zinc-200 border border-[#3d3d3d]">Mirror L↔R</button>
                  <button type="button" onClick={copyPoseClipboard} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-zinc-200 border border-[#3d3d3d]">Copy pose</button>
                  <button type="button" onClick={pastePoseClipboard} disabled={!poseClipboard} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-zinc-200 border border-[#3d3d3d] disabled:opacity-40">Paste pose</button>
                </div>
                <p className="text-[9px] text-zinc-500 mt-1">Animations (keys + path)</p>
                <div className="flex flex-wrap gap-1">
                  {MANNEQUIN_ANIM_PRESETS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => applyMannequinAnimPreset(a.id)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 hover:bg-amber-500/25 text-amber-100 border border-amber-400/30"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 space-y-1 rounded border border-emerald-500/20 bg-emerald-500/5 p-1.5">
                  <p className="text-[9px] font-bold text-emerald-200">Local depth-map video</p>
                  <p className="text-[8px] text-zinc-500 leading-snug">
                    Pick a depth MP4/WebM from disk. Stays local — never uploaded. Bakes Z motion + pose keys.
                  </p>
                  <label className="flex items-center gap-1 text-[9px] text-zinc-400">
                    <input type="checkbox" checked={depthInvert} onChange={(e) => setDepthInvert(e.target.checked)} className="accent-emerald-500" />
                    Invert (white = far)
                  </label>
                  <label className="block text-[9px] text-zinc-400">
                    Strength {depthStrength.toFixed(1)}
                    <input
                      type="range"
                      min={0.2}
                      max={3}
                      step={0.1}
                      value={depthStrength}
                      onChange={(e) => setDepthStrength(Number(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                  </label>
                  <input
                    ref={depthFileInputRef}
                    type="file"
                    accept="video/*,.mp4,.webm,.mov"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) applyDepthVideoToMannequin(f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={depthBusy}
                    onClick={() => depthFileInputRef.current?.click()}
                    className="w-full px-1.5 py-1 rounded text-[9px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 disabled:opacity-50"
                  >
                    {depthBusy ? 'Sampling…' : 'Load depth video (local)'}
                  </button>
                </div>
                <p className="text-[9px] text-zinc-500">
                  From prompt: {inferPoseNameFromShot(shot || {})}
                </p>
                {POSE_JOINT_META.map(({ key, label, min, max }) => {
                  void poseVersion;
                  const pose = normalizePose(
                    selectedRef.current?.userData?.pose
                    || plan.humans?.[Number(selectedKey.split(':')[1])]?.pose
                  );
                  return (
                    <label key={key} className="block">
                      <span className="text-[9px] text-zinc-500 flex justify-between">
                        <span>{label}</span>
                        <span className="font-mono">{Number(pose[key] || 0).toFixed(2)}</span>
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.02}
                        value={pose[key] ?? 0}
                        onChange={(e) => updateSelectedHumanPose({ [key]: Number(e.target.value) })}
                        className="w-full accent-fuchsia-400"
                      />
                    </label>
                  );
                })}
              </div>
            )}

            <div className="h-px bg-[#3d3d3d]" />

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Light & stage</p>
              <label className="block text-[9px] text-zinc-400">Azimuth {lightAzimuth}°</label>
              <input type="range" min={0} max={360} value={lightAzimuth} onChange={(e) => setLightAzimuth(Number(e.target.value))} className="w-full accent-amber-400" />
              <label className="block text-[9px] text-zinc-400">Elevation {lightElevation}°</label>
              <input type="range" min={5} max={89} value={lightElevation} onChange={(e) => setLightElevation(Number(e.target.value))} className="w-full accent-amber-400" />
              <label className="block text-[9px] text-zinc-400">Intensity {lightIntensity.toFixed(2)}</label>
              <input type="range" min={0.1} max={2.5} step={0.05} value={lightIntensity} onChange={(e) => setLightIntensity(Number(e.target.value))} className="w-full accent-amber-400" />
              <div className="flex flex-wrap gap-2 text-[9px] text-zinc-400">
                <label className="flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="accent-cyan-500" /> Grid</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={showGround} onChange={(e) => setShowGround(e.target.checked)} className="accent-cyan-500" /> Ground</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={showShadows} onChange={(e) => setShowShadows(e.target.checked)} className="accent-cyan-500" /> Shadows</label>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Camera bookmarks</p>
              <button type="button" onClick={saveCameraBookmark} className="w-full px-1.5 py-1 rounded text-[9px] font-bold bg-sky-500/15 text-sky-100 border border-sky-400/30">Save view</button>
              <div className="flex flex-wrap gap-1">
                {cameraBookmarks.map((bm) => (
                  <button key={bm.id} type="button" onClick={() => recallCameraBookmark(bm)} className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-zinc-300 border border-[#3d3d3d]">{bm.label}</button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Props & image plane</p>
              <div className="flex flex-wrap gap-1">
                {PROP_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => addPropPreset(p.id)} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-zinc-300 border border-[#3d3d3d]">{p.label}</button>
                ))}
              </div>
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) loadReferenceImagePlane(f);
                }}
              />
              <button type="button" onClick={() => imageFileInputRef.current?.click()} className="w-full px-1.5 py-1 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-100 border border-indigo-400/30">
                Add reference image (local)
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">AI / draw exports</p>
              <p className="text-[8px] text-zinc-500">Named {fileStem}_*.png · Depth · Normals · Canny · OpenPose · OBJ</p>
              <div className="grid grid-cols-2 gap-1">
                <button type="button" disabled={exportBusy} onClick={() => exportAiPasses(['color'])} className="px-1 py-1 rounded text-[9px] font-bold bg-white/5 border border-[#3d3d3d] text-zinc-200 disabled:opacity-50">RGB</button>
                <button type="button" disabled={exportBusy} onClick={() => exportAiPasses(['depth'])} className="px-1 py-1 rounded text-[9px] font-bold bg-white/5 border border-[#3d3d3d] text-zinc-200 disabled:opacity-50">Depth</button>
                <button type="button" disabled={exportBusy} onClick={() => exportAiPasses(['normals'])} className="px-1 py-1 rounded text-[9px] font-bold bg-white/5 border border-[#3d3d3d] text-zinc-200 disabled:opacity-50">Normals</button>
                <button type="button" disabled={exportBusy} onClick={() => exportAiPasses(['canny'])} className="px-1 py-1 rounded text-[9px] font-bold bg-white/5 border border-[#3d3d3d] text-zinc-200 disabled:opacity-50">Canny</button>
                <button type="button" disabled={exportBusy} onClick={() => exportAiPasses(['openpose'])} className="px-1 py-1 rounded text-[9px] font-bold bg-white/5 border border-[#3d3d3d] text-zinc-200 disabled:opacity-50">OpenPose</button>
                <button type="button" disabled={exportBusy} onClick={exportObjBase} className="px-1 py-1 rounded text-[9px] font-bold bg-white/5 border border-[#3d3d3d] text-zinc-200 disabled:opacity-50">OBJ</button>
              </div>
              <button
                type="button"
                disabled={exportBusy}
                onClick={() => exportAiPasses(['color', 'depth', 'normals', 'canny', 'openpose'])}
                className="w-full px-1.5 py-1 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-100 border border-emerald-400/30 disabled:opacity-50"
              >
                {exportBusy ? 'Exporting…' : 'Export all passes'}
              </button>
            </div>

            <div className="h-px bg-[#3d3d3d]" />

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
                <Camera className="w-3 h-3" /> Camera settings
              </p>
              <label className="block text-[10px] text-zinc-400">Aspect ratio</label>
              <select
                value={ASPECT_RATIO_OPTIONS.find((o) => String(aspectRatio).startsWith(o.id) || aspectRatio === o.value)?.value || aspectRatio}
                onChange={(e) => setAspectRatio?.(e.target.value)}
                className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-1 text-[11px] text-zinc-100 outline-none"
              >
                {ASPECT_RATIO_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.value}>{opt.label} — {opt.subtitle}</option>
                ))}
              </select>
              <label className="block text-[10px] text-zinc-400 mt-1">Focal length</label>
              <select
                value={FOCAL_PRESETS.includes(Number(plan.focalMm)) ? Number(plan.focalMm) : 35}
                onChange={(e) => updateCameraSettings({ focalMm: Number(e.target.value) })}
                className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-1 text-[11px] text-zinc-100 outline-none"
              >
                {FOCAL_PRESETS.map((mm) => <option key={mm} value={mm}>{mm}mm</option>)}
              </select>
              <label className="block text-[10px] text-zinc-400 mt-1">Aperture</label>
              <select
                value={APERTURE_PRESETS.includes(Number(plan.aperture)) ? Number(plan.aperture) : 2.8}
                onChange={(e) => updateCameraSettings({ aperture: Number(e.target.value) })}
                className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-1 text-[11px] text-zinc-100 outline-none"
              >
                {APERTURE_PRESETS.map((f) => <option key={f} value={f}>f/{f}</option>)}
              </select>
              <label className="block text-[10px] text-zinc-400 mt-1">Clip start</label>
              <select
                value={CLIP_NEAR_PRESETS.includes(Number(plan.clipNear)) ? Number(plan.clipNear) : 0.05}
                onChange={(e) => updateCameraSettings({ clipNear: Number(e.target.value) })}
                className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-1 text-[11px] text-zinc-100 outline-none"
              >
                {CLIP_NEAR_PRESETS.map((v) => <option key={v} value={v}>{v}m</option>)}
              </select>
              <label className="block text-[10px] text-zinc-400 mt-1">Clip end</label>
              <select
                value={CLIP_FAR_PRESETS.includes(Number(plan.clipFar)) ? Number(plan.clipFar) : 200}
                onChange={(e) => updateCameraSettings({ clipFar: Number(e.target.value) })}
                className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-1 text-[11px] text-zinc-100 outline-none"
              >
                {CLIP_FAR_PRESETS.map((v) => <option key={v} value={v}>{v}m</option>)}
              </select>
              <label className="block text-[10px] text-zinc-400 mt-1">Camera 1 animation</label>
              <select
                value={animLabel}
                onChange={(e) => updateCameraSettings({ animationType: e.target.value })}
                className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-1 text-[11px] text-zinc-100 outline-none"
              >
                {['static', 'orbit', 'dolly', 'crane', 'pan'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="block text-[10px] text-zinc-400 mt-1">Duration</label>
              <select
                value={DURATION_PRESETS.includes(Number(duration)) ? Number(duration) : 5}
                onChange={(e) => updateCameraSettings({ durationSec: Number(e.target.value) })}
                className="w-full bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1.5 py-1 text-[11px] text-zinc-100 outline-none"
              >
                {DURATION_PRESETS.map((s) => <option key={s} value={s}>{s}s</option>)}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowSidebar(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center gap-1 w-6 py-3 rounded-l-md bg-[#2c2c2c] border border-[#3d3d3d] border-r-0 text-zinc-400 hover:text-white hover:bg-[#383838]"
          title="Show side panel"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="text-[8px] font-bold writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>Item</span>
        </button>
      )}

      {/* Floating Camera monitor — explicit width×height matching frame ratio */}
      <div
        className={`absolute z-40 rounded-lg overflow-hidden border shadow-2xl bg-[#0a0a0a]/98 ${
          pipPinned ? 'border-amber-400/50' : 'border-cyan-400/40'
        } ${
          showCameraView && mode === 'compose' ? '' : 'invisible pointer-events-none opacity-0'
        }`}
        style={
          showCameraView && mode === 'compose'
            ? { left: pipPos.x, bottom: pipPos.y, width: pipFrame.w }
            : { width: pipFrame.w, left: -9999, bottom: 0 }
        }
      >
        <div
          className={`flex items-center justify-between px-2 py-1 border-b border-[#3d3d3d] ${pipPinned ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          onPointerDown={startPipDrag}
        >
          <span className="text-[10px] font-bold text-cyan-200 flex items-center gap-1">
            {!pipPinned && <GripHorizontal className="w-3 h-3 text-zinc-500" />}
            <Camera className="w-3 h-3" />
            Camera monitor
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPipPinned((v) => !v); }}
              className={`p-1 rounded ${pipPinned ? 'text-amber-300 bg-amber-500/15' : 'text-zinc-400 hover:text-white'}`}
              title={pipPinned ? 'Unpin monitor' : 'Pin monitor here'}
            >
              {pipPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMode('shoot'); }}
              className="text-[9px] font-bold text-zinc-300 hover:text-white px-1.5 py-0.5 rounded bg-white/5"
            >
              Expand
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowCameraView(false); }}
              className="text-[9px] text-zinc-500 hover:text-white px-1"
            >
              Hide
            </button>
          </div>
        </div>
        <div
          className="relative bg-black overflow-hidden"
          style={{ width: pipFrame.w, height: pipFrame.h, aspectRatio: `${pipFrame.ar}` }}
        >
          <div
            ref={previewMountRef}
            className="absolute inset-0 overflow-hidden"
          />
          <div className="pointer-events-none absolute inset-0 border border-white/10" />
          <span className="pointer-events-none absolute bottom-1 right-1 text-[8px] font-mono text-white/70 bg-black/55 px-1 rounded">
            {pipFrame.ar.toFixed(2)}:1
          </span>
        </div>
        <div className="px-2 py-1 text-[9px] font-mono text-zinc-500 border-t border-[#3d3d3d] flex justify-between gap-2">
          <span className="truncate">{aspectRatio}</span>
          <span className="shrink-0">{pipFrame.w}×{pipFrame.h} · PNG/MP4</span>
        </div>
      </div>
      {!showCameraView && mode === 'compose' && (
        <button
          type="button"
          onClick={() => setShowCameraView(true)}
          className="absolute left-6 bottom-28 z-30 px-2.5 py-1.5 rounded-xl bg-zinc-950/90 border border-cyan-400/40 text-[10px] font-bold text-cyan-200 flex items-center gap-1"
        >
          <Camera className="w-3 h-3" /> Show camera monitor
        </button>
      )}

      {showLibrary && (
        <div className={`absolute ${showSidebar ? 'right-[16rem]' : 'right-8'} top-14 z-20 w-40 flex flex-col rounded-lg bg-[#242424]/95 border border-[#3d3d3d] overflow-hidden`}>
          <div className="px-2 py-1.5 border-b border-[#3d3d3d] flex items-center justify-between">
            <span className="text-[11px] font-bold text-white">Add</span>
            <button type="button" className="text-zinc-500 text-[10px]" onClick={() => setShowLibrary(false)}>Hide</button>
          </div>
          <div className="p-1.5 grid grid-cols-2 gap-1">
            {COMPONENT_LIBRARY.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addComponent(c.id)}
                  className="flex flex-col items-center gap-1 p-1.5 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-[#3d3d3d] text-zinc-300"
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                  <span className="text-[9px] font-semibold">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showChat && (
        <div className={`absolute ${showSidebar ? 'right-[16rem]' : 'right-8'} top-14 bottom-[5.25rem] z-20 w-[min(100%,17rem)] flex flex-col rounded-lg bg-[#242424]/95 border border-[#3d3d3d] overflow-hidden shadow-xl ${showLibrary ? 'mt-36' : ''}`}>
          <div className="px-2.5 py-2 border-b border-[#3d3d3d] flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-white flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-300" />
              Stage Director
            </p>
            <button type="button" className="text-zinc-500 text-[10px]" onClick={() => setShowChat(false)}>Hide</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-[11px]">
            {chatLog.map((m, i) => (
              <div key={i} className={`p-2 rounded border leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-white/5 border-[#3d3d3d] text-zinc-200' : 'bg-emerald-500/10 border-emerald-400/20 text-emerald-100'
              }`}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-[#3d3d3d] flex gap-1.5">
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
              placeholder="Stage with chat…"
              className="flex-1 min-w-0 bg-[#1d1d1d] border border-[#3d3d3d] rounded px-2 py-1 text-[11px] text-white outline-none"
            />
            <button
              type="button"
              disabled={isComposing}
              onClick={() => {
                if (chatInput.trim()) {
                  const msg = chatInput.trim();
                  setChatLog((p) => [...p, { role: 'user', text: msg }]);
                  setChatInput('');
                  runCompose(msg);
                } else runCompose('');
              }}
              className="px-2 py-1 rounded bg-amber-500 text-zinc-950 font-bold text-[11px] disabled:opacity-50"
            >
              {isComposing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Production timeline */}
      <div className="absolute left-0 right-0 bottom-0 z-30 bg-[#1c1c1e]/98 border-t border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2 px-2 py-1 border-b border-[#1d1d1d] text-[11px] text-zinc-300 flex-wrap">
          <span className="font-semibold text-zinc-200">Timeline</span>
          <div className="flex items-center gap-0.5 ml-1">
            <button type="button" className="p-1 rounded hover:bg-white/10" onClick={() => { playRef.current.t = 0; setTimeSec(0); setPlaying(false); }} title="Jump to start">⏮</button>
            <button type="button" className="p-1 rounded hover:bg-white/10" onClick={() => jumpToAdjacentKey(-1)} title="Previous key">⏪</button>
            <button type="button" className="p-1 rounded hover:bg-white/10" onClick={() => setPlaying((p) => !p)} title={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button type="button" className="p-1 rounded hover:bg-white/10" onClick={() => jumpToAdjacentKey(1)} title="Next key">⏩</button>
            <button type="button" className="p-1 rounded hover:bg-white/10" onClick={() => { playRef.current.t = duration; setTimeSec(duration); setPlaying(false); }} title="Jump to end">⏭</button>
          </div>
          <label className="flex items-center gap-1 ml-1 text-[10px] text-zinc-400">
            Frame
            <input
              type="number"
              value={frame}
              min={1}
              max={endFrame}
              onChange={(e) => {
                const f = Math.max(1, Number(e.target.value) || 1);
                const t = (f - 1) / 24;
                playRef.current.t = Math.min(duration, t);
                setTimeSec(playRef.current.t);
                setPlaying(false);
              }}
              className="w-12 bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1 py-0.5 font-mono text-zinc-100 cursor-ew-resize"
            />
          </label>
          <span className="text-[10px] text-zinc-500">End {endFrame}</span>

          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#3d3d3d]">
            <button type="button" onClick={insertKeyframeAtPlayhead} className="px-1.5 py-0.5 rounded bg-[#4772b3]/30 hover:bg-[#4772b3]/50 text-sky-200 border border-[#6a9adf]/40 text-[10px] font-bold flex items-center gap-1" title="Insert key (I)">
              <Diamond className="w-3 h-3" /> Key
            </button>
            <button type="button" onClick={deleteKeyframeAtPlayhead} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 border border-[#3d3d3d] text-[10px] font-bold flex items-center gap-1" title="Delete key">
              <Trash2 className="w-3 h-3" /> Del
            </button>
            <button type="button" onClick={clearSelectedKeyframes} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 border border-[#3d3d3d] text-[10px]" title="Clear path">
              Clear path
            </button>
            <label className="flex items-center gap-1 text-[10px] text-zinc-400 ml-1 cursor-pointer" title="AutoKey on gizmo release">
              <input type="checkbox" checked={autoKey} onChange={(e) => setAutoKey(e.target.checked)} className="accent-[#4772b3]" />
              AutoKey
            </label>
            <button type="button" onClick={() => setShowCurves((v) => !v)} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${showCurves ? 'bg-violet-500/20 text-violet-100 border-violet-400/40' : 'bg-white/5 text-zinc-400 border-[#3d3d3d]'}`}>
              Curves
            </button>
            {showCurves && (
              <select value={curveChannel} onChange={(e) => setCurveChannel(e.target.value)} className="bg-[#1d1d1d] border border-[#3d3d3d] rounded px-1 py-0.5 text-[10px] text-zinc-200">
                <option value="posX">Loc X</option>
                <option value="posY">Loc Y</option>
                <option value="posZ">Loc Z</option>
                <option value="rotY">Rot Y°</option>
              </select>
            )}
            <span className="text-[10px] text-zinc-500">{selectedKey ? `${selectedKeyframes.length} keys` : 'Select a camera or mannequin…'}</span>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button type="button" onClick={downloadStillImage} className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold flex items-center gap-1">
              <Download className="w-3 h-3" /> PNG
            </button>
            <button type="button" onClick={downloadTimelineVideo} disabled={isExportingVideo} className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-400/30 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
              {isExportingVideo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              MP4
            </button>
            {!showChat && <button type="button" onClick={() => setShowChat(true)} className="text-[10px] text-cyan-300 px-1">Chat</button>}
            {!showLibrary && <button type="button" onClick={() => setShowLibrary(true)} className="text-[10px] text-cyan-300 px-1 flex items-center gap-0.5"><Plus className="w-3 h-3" />Add</button>}
            <span className="text-[10px] text-zinc-500 truncate max-w-[10rem]">{status}</span>
          </div>
        </div>

        {showCurves && (
          <div className="px-2 pt-1">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-14 rounded bg-[#161616] border border-[#2a2a2a]">
              <line x1="0" y1="50" x2="100" y2="50" stroke="#333" strokeWidth="0.4" />
              {curvePoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="1.2"
                  vectorEffect="non-scaling-stroke"
                  points={curvePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              )}
              {curvePoints.map((p) => (
                <circle key={`c-${p.t}`} cx={p.x} cy={p.y} r="1.6" fill="#fbbf24" vectorEffect="non-scaling-stroke" />
              ))}
              <line
                x1={duration > 0 ? (Math.min(timeSec, duration) / duration) * 100 : 0}
                y1="0"
                x2={duration > 0 ? (Math.min(timeSec, duration) / duration) * 100 : 0}
                y2="100"
                stroke="#38bdf8"
                strokeWidth="0.6"
              />
            </svg>
          </div>
        )}

        <div className="px-2 py-2 relative">
          <div className="relative h-7 rounded bg-[#1d1d1d] border border-[#3d3d3d] overflow-hidden">
            <div className="absolute inset-0 flex pointer-events-none">
              {Array.from({ length: Math.min(24, endFrame) }).map((_, i) => (
                <div key={i} className="flex-1 border-r border-white/5" />
              ))}
            </div>
            {selectedKeyframes.map((k) => {
              const pct = duration > 0 ? (k.t / duration) * 100 : 0;
              return (
                <button
                  key={`kf-${k.t}`}
                  type="button"
                  title={`Key @ ${k.t.toFixed(2)}s`}
                  onClick={() => { playRef.current.t = k.t; setTimeSec(k.t); setPlaying(false); }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 text-amber-300 hover:text-amber-100"
                  style={{ left: `${pct}%` }}
                >
                  <Diamond className="w-3.5 h-3.5 fill-amber-400/90" />
                </button>
              );
            })}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-20 pointer-events-none"
              style={{ left: `${duration > 0 ? (Math.min(timeSec, duration) / duration) * 100 : 0}%` }}
            />
          </div>
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
            className="w-full accent-[#4772b3] mt-1"
          />
        </div>
      </div>
    </div>
  );
}
