/**
 * Compose 3D Stage blocking + camera animation from Stage Production Studio
 * Master Cinema Compiler prompt (same frame as Prompt Compiler).
 */

import { compileMasterCinemaCompilerPrompt } from '../utils/compileMasterCinemaPrompt';
import { fetchGeminiContent } from './aiScriptParser';
import { resolveLlmApiKey } from '../utils/saasControl';
import {
  bakeCameraKeyframes,
  normalizePose,
  poseFromShot
} from '../utils/mannequinPose';
import { resolveStageCastForShot } from '../utils/stageCast';
import { inferStageEnvironment } from '../utils/stageEnvironment';
import { normalizeStageLighting } from '../utils/stageLighting';
import { parsePromptCamera } from '../utils/stagePromptParser';
import { parsePromptDirection, applyPlacementToHumans } from '../utils/stagePromptDirection';
import { focusDistanceFromLookAt } from '../utils/stageLens';
import { normalizeMoveType, applyCameraMoveType } from '../utils/stageCameraMove';
import { inferCharacterMove, bakeCharacterMove } from '../utils/stageCharacterMove';
import { inferEyeHead, normalizeGaze, applyGazeToHumanPose, applyGazeToKeyframes } from '../utils/stageEyeHead';
import { inferExpression, normalizeExpression, applyExpressionToPose, applyExpressionToKeyframes } from '../utils/stageExpression';
import { inferInteraction, normalizeInteraction, applyInteractionToPose, applyInteractionToKeyframes } from '../utils/stageInteraction';
import { inferDialogue } from '../utils/stageDialogue';

function getApiKey() {
  if (typeof window === 'undefined') return '';
  try {
    return String(resolveLlmApiKey('google_gemini') || localStorage.getItem('sps_api_key') || '').trim();
  } catch {
    return String(localStorage.getItem('sps_api_key') || '').trim();
  }
}

function extractGeminiText(data) {
  try {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((p) => p?.text || '').join('').trim();
  } catch {
    return '';
  }
}

function parseJsonObject(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

function normalizeKeyframes(keys) {
  if (!Array.isArray(keys) || !keys.length) return [];
  return keys
    .map((k) => ({
      t: clamp(k.t ?? 0, 0, 60),
      position: [
        clamp(k.position?.[0] ?? 0, -12, 12),
        clamp(k.position?.[1] ?? 0, -2, 8),
        clamp(k.position?.[2] ?? 0, -12, 12)
      ],
      rotation: [
        clamp(k.rotation?.[0] ?? 0, -Math.PI, Math.PI),
        clamp(k.rotation?.[1] ?? 0, -Math.PI * 2, Math.PI * 2),
        clamp(k.rotation?.[2] ?? 0, -Math.PI, Math.PI)
      ],
      lookAt: Array.isArray(k.lookAt)
        ? [
          clamp(k.lookAt[0], -8, 8),
          clamp(k.lookAt[1], 0.2, 4),
          clamp(k.lookAt[2], -8, 8)
        ]
        : undefined,
      pose: k.pose ? normalizePose(k.pose) : undefined
    }))
    .sort((a, b) => a.t - b.t);
}

export function normalizeStagePlan(plan, shot = {}) {
  const durationSec = clamp(plan?.durationSec ?? 5, 1, 30);
  const focalMm = clamp(plan?.focalMm ?? 35, 14, 200);
  const aperture = clamp(plan?.aperture ?? 2.8, 1.2, 22);

  const humansIn = Array.isArray(plan?.humans) ? plan.humans : [];
  const camerasIn = Array.isArray(plan?.cameras) ? plan.cameras : [];
  const cast = resolveStageCastForShot(shot);
  const fallbackHumans = (cast.length
    ? cast
    : [
        { id: 'Human 1', color: '#e8b84a', figureSource: 'mannequin', charAssetId: '' },
        { id: 'Human 2', color: '#e0a830', figureSource: 'mannequin', charAssetId: '' }
      ]
  ).slice(0, 6).map((c, i) => ({
    id: c.id,
    charAssetId: c.charAssetId || '',
    figureSource: c.figureSource || 'mannequin',
    glbUrl: c.glbUrl || '',
    position: [i === 0 ? -0.45 : 0.55 + (i - 1) * 0.5, 0, i === 0 ? 0 : 0.12 * ((i % 2) ? 1 : -1)],
    rotationY: i === 0 ? 0.25 : -0.35,
    color: c.color || '#e8b84a'
  }));

  const humans = (humansIn.length ? humansIn : fallbackHumans).slice(0, 6).map((h, i) => {
    const pose = poseFromShot(shot, i, h.pose);
    const genericId = !h.id || /^Human\s+\d+$/i.test(String(h.id));
    const fromCast = cast[i];
    const human = {
      id: genericId && fromCast?.id ? fromCast.id : (h.id || fromCast?.id || `Human ${i + 1}`),
      charAssetId: h.charAssetId || fromCast?.charAssetId || '',
      figureSource: h.figureSource || fromCast?.figureSource || 'mannequin',
      glbUrl: h.glbUrl || fromCast?.glbUrl || '',
      position: [
        clamp(h.position?.[0] ?? (i === 0 ? -0.5 : 0.7), -8, 8),
        clamp(h.position?.[1] ?? 0, 0, 2),
        clamp(h.position?.[2] ?? 0, -8, 8)
      ],
      rotationY: clamp(h.rotationY ?? 0, -Math.PI, Math.PI),
      rotation: Array.isArray(h.rotation)
        ? h.rotation.map((n, idx) => clamp(n, -Math.PI, Math.PI))
        : [0, clamp(h.rotationY ?? 0, -Math.PI, Math.PI), 0],
      color: h.color || fromCast?.color || (i === 0 ? '#e8b84a' : '#e0a830'),
      locked: !!h.locked,
      hidden: !!h.hidden,
      pose,
      poseName: h.poseName || undefined,
      movement: h.movement || inferCharacterMove(shot, i),
      gaze: h.gaze && h.gaze.eyeTarget ? normalizeGaze(h.gaze) : null,
      expression: h.expression && h.expression.id ? normalizeExpression(h.expression) : null,
      interaction: h.interaction && h.interaction.type ? normalizeInteraction(h.interaction) : null,
      keyframes: normalizeKeyframes(h.keyframes)
    };
    return human;
  });
  humans.forEach((human, i) => {
    if (!human.gaze) human.gaze = inferEyeHead(shot, i, humans);
    if (!human.expression) human.expression = inferExpression(shot);
    if (!human.interaction) human.interaction = inferInteraction(shot, human, humans);
  });

  const defaultCam = {
    id: 'Camera 1',
    position: [-2.2, 1.35, 3.2],
    lookAt: [0, 1.2, 0],
    focalMm,
    animation: { type: 'orbit', radius: 3.4, height: 1.4, revolutions: 0.35 }
  };

  const cameras = (camerasIn.length ? camerasIn : [defaultCam]).slice(0, 3).map((c, i) => {
    const animType = normalizeMoveType(c.animation?.type || 'orbit');
    const seeded = applyCameraMoveType(
      {
        position: c.position,
        lookAt: c.lookAt
      },
      animType,
      durationSec
    );
    const animation = {
      ...seeded,
      ...c.animation,
      type: animType,
      duration: clamp(c.animation?.duration ?? durationSec, 1, 30),
      speed: clamp(c.animation?.speed ?? 1, 0.25, 4),
      easing: c.animation?.easing || 'easeInOut',
      radius: clamp(c.animation?.radius ?? seeded.radius, 1.2, 12),
      height: clamp(c.animation?.height ?? seeded.height, 0.3, 6),
      revolutions: clamp(c.animation?.revolutions ?? seeded.revolutions, 0, 2),
      from: Array.isArray(c.animation?.from) ? c.animation.from : seeded.from,
      to: Array.isArray(c.animation?.to) ? c.animation.to : seeded.to,
      startLook: Array.isArray(c.animation?.startLook) ? c.animation.startLook : seeded.startLook,
      endLook: Array.isArray(c.animation?.endLook) ? c.animation.endLook : seeded.endLook,
      target: Array.isArray(c.animation?.target) ? c.animation.target : seeded.target
    };
    const cam = {
      id: c.id || `Camera ${i + 1}`,
      position: [
        clamp(c.position?.[0] ?? -2.2, -12, 12),
        clamp(c.position?.[1] ?? 1.35, 0.2, 8),
        clamp(c.position?.[2] ?? 3.2, -12, 12)
      ],
      lookAt: [
        clamp(c.lookAt?.[0] ?? 0, -8, 8),
        clamp(c.lookAt?.[1] ?? 1.2, 0.2, 4),
        clamp(c.lookAt?.[2] ?? 0, -8, 8)
      ],
      focalMm: clamp(c.focalMm ?? focalMm, 14, 200),
      sensorWidthMm: clamp(c.sensorWidthMm ?? 36, 12, 36.5),
      aperture: clamp(c.aperture ?? aperture, 1.2, 22),
      animation,
      keyframes: normalizeKeyframes(c.keyframes)
    };
    cam.focusDistance = clamp(
      c.focusDistance ?? focusDistanceFromLookAt(cam.position, cam.lookAt),
      0.3,
      80
    );
    if (!cam.keyframes.length && animation.type !== 'static') {
      cam.keyframes = bakeCameraKeyframes(cam, durationSec, 6);
    } else if (!cam.keyframes.length) {
      cam.keyframes = [
        {
          t: 0,
          position: [...cam.position],
          rotation: [0, 0, 0],
          lookAt: [...cam.lookAt]
        },
        {
          t: durationSec,
          position: [...cam.position],
          rotation: [0, 0, 0],
          lookAt: [...cam.lookAt]
        }
      ];
    }
    return cam;
  });

  const stageCtx = { humans, cameras, props: Array.isArray(plan?.props) ? plan.props : [] };
  humans.forEach((human) => {
    if (!human.keyframes.length) {
      human.keyframes = bakeCharacterMove(human, humans, durationSec, shot, stageCtx);
    } else {
      human.keyframes = applyInteractionToKeyframes(
        applyExpressionToKeyframes(
          applyGazeToKeyframes(human.keyframes, human, stageCtx),
          human
        ),
        human
      );
    }
    const aimed = applyGazeToHumanPose(human, stageCtx);
    human.pose = applyInteractionToPose(
      applyExpressionToPose(aimed.pose, human.expression),
      human.interaction
    );
    if (human.gaze?.bodyDirection && human.gaze.bodyDirection !== 'hold') {
      human.rotationY = aimed.rotationY;
      human.rotation = aimed.rotation;
    }
  });

  const dialogue = Array.isArray(plan?.dialogue) && plan.dialogue.length
    ? plan.dialogue
    : inferDialogue(shot, humans, durationSec);

  const environment = inferStageEnvironment(shot, plan?.environment);
  const lighting = normalizeStageLighting(plan?.lighting, shot, environment);

  return {
    focalMm,
    aperture,
    durationSec,
    humans,
    cameras,
    dialogue,
    environment,
    lighting,
    props: Array.isArray(plan?.props) ? plan.props : [],
    framingNote: plan?.framingNote || shot?.shotComposition || 'Medium Shot',
    motionNote: plan?.motionNote || String(shot?.cameraMotionTag || 'Orbit').replace(/\[|\]/g, ''),
    source: plan?.source || 'llm'
  };
}

/** Offline heuristic from Matrix craft tags — no API. */
export function heuristicStagePlanFromShot(shot = {}, shotIdx = 0) {
  const framing = String(shot.shotComposition || '').toLowerCase();
  const motion = String(shot.cameraMotionTag || '').toLowerCase();
  const parsedCam = parsePromptCamera([shot.stageVideoPrompt, shot.videoPrompt, motion, framing, shot.lensAndFocalLength].join(' '));
  const direction = parsePromptDirection(shot);
  let focalMm = parsedCam.focalMm || 35;
  if (!parsedCam.focalMm) {
    if (/extreme close|ecu|close[- ]?up|cu\b/.test(framing)) focalMm = 85;
    else if (/medium close|mcu/.test(framing)) focalMm = 50;
    else if (/wide|establishing|long shot|ls\b/.test(framing)) focalMm = 24;
    else if (/full shot|fs\b/.test(framing)) focalMm = 28;
  }

  let animType = parsedCam.move || 'static';
  if (!parsedCam.move) {
    if (/dolly in|push/.test(motion)) animType = 'push';
    else if (/dolly out|pull/.test(motion)) animType = 'pull';
    else if (/dolly|track/.test(motion)) animType = 'tracking';
    else if (/pan|whip/.test(motion)) animType = 'pan';
    else if (/crane|tilt up|boom/.test(motion)) animType = 'crane';
    else if (/orbit|arc/.test(motion)) animType = 'orbit';
    else if (/static|locked|tripod|hold/.test(motion)) animType = 'static';
  }

  const camZ = focalMm >= 70 ? 2.2 : focalMm <= 28 ? 5.2 : 3.4;
  let camY = animType === 'crane' ? 2.8 : 1.35;
  if (direction.highAngle) camY += 0.9;
  if (direction.lowAngle) camY = Math.min(camY, 0.62);

  const pose1 = poseFromShot(shot, 0);
  const pose2 = poseFromShot(shot, 1);
  const cast = resolveStageCastForShot(shot);
  const humans = applyPlacementToHumans((cast.length
    ? cast
    : [
        { id: 'Human 1', color: '#e8b84a', figureSource: 'mannequin', charAssetId: '' },
        { id: 'Human 2', color: '#e0a830', figureSource: 'mannequin', charAssetId: '' }
      ]
  ).slice(0, 6).map((c, i) => ({
    id: c.id,
    charAssetId: c.charAssetId || '',
    figureSource: c.figureSource || 'mannequin',
    glbUrl: c.glbUrl || '',
    position: [i === 0 ? -0.45 : 0.55 + (i - 1) * 0.5, 0, i === 0 ? 0 : 0.12],
    rotationY: i === 0 ? 0.25 : -0.35,
    color: c.color || '#e8b84a',
    pose: i === 0 ? pose1 : poseFromShot(shot, i, pose2)
  })), direction.placement);

  return normalizeStagePlan({
    focalMm,
    aperture: 2.8,
    durationSec: direction.durationSec || 5,
    humans,
    cameras: [{
      id: 'Camera 1',
      position: [-1.8, camY, camZ],
      lookAt: [0, 1.15, 0],
      focalMm,
      animation: {
        type: animType,
        radius: camZ,
        height: camY,
        revolutions: animType === 'orbit' ? 0.4 : 0,
        from: [-1.8, camY, camZ],
        to: animType === 'push' || animType === 'dolly'
          ? [-0.6, camY, Math.max(1.4, camZ - 1.8)]
          : animType === 'crane'
            ? [-1.2, 3.2, camZ * 0.85]
            : animType === 'pan'
              ? [1.8, camY, camZ]
              : [-1.8, camY, camZ]
      }
    }],
    framingNote: shot.shotComposition || 'Medium Shot',
    motionNote: String(shot.cameraMotionTag || animType).replace(/\[|\]/g, ''),
    source: 'heuristic',
    shotIdx
  }, shot);
}

/**
 * Build Master Cinema prompt + ask LLM for a 3D Stage JSON plan.
 */
export async function compose3DStageFromMasterCinema(shot = {}, shotIdx = 0, {
  projectTitle = 'Project',
  userInstruction = ''
} = {}) {
  const cinema = compileMasterCinemaCompilerPrompt(shot, shotIdx, { projectTitle });
  const masterCinemaPrompt = cinema.masterCinemaPrompt;

  const schemaHint = `{
  "focalMm": 35,
  "aperture": 2.8,
  "durationSec": 5,
  "framingNote": "Medium Shot",
  "motionNote": "Slow dolly in",
  "humans": [
    {
      "id": "Human 1",
      "position": [-0.5, 0, 0],
      "rotationY": 0.2,
      "color": "#e8b84a",
      "poseName": "talk",
      "pose": {
        "spine": 0.05,
        "chest": 0.08,
        "headY": 0.2,
        "upperArmLX": -0.4,
        "lowerArmL": 1.0,
        "upperArmRX": -0.2,
        "lowerArmR": 0.6,
        "thighLX": 0.05,
        "shinL": 0.1,
        "thighRX": 0.05,
        "shinR": 0.1
      },
      "gaze": { "eyeTarget": "costar", "headDirection": "follow_eyes", "bodyDirection": "hold" },
      "expression": { "id": "determined", "intensity": 1 },
      "interaction": { "type": "look_at", "targetId": "Human 2" },
      "keyframes": [
        { "t": 0, "position": [-0.5, 0, 0], "rotation": [0, 0.2, 0] },
        { "t": 5, "position": [-0.3, 0, 0.2], "rotation": [0, 0.1, 0] }
      ]
    }
  ],
  "dialogue": [
    { "speakerId": "Human 1", "listenerId": "Human 2", "text": "Stay with me.", "start": 0.4, "end": 3.2 }
  ],
  "cameras": [
    {
      "id": "Camera 1",
      "position": [-2.2, 1.4, 3.5],
      "lookAt": [0, 1.2, 0],
      "focalMm": 35,
      "animation": {
        "type": "dolly",
        "from": [-2.2, 1.4, 3.5],
        "to": [-0.8, 1.35, 2.0],
        "radius": 3.5,
        "height": 1.4,
        "revolutions": 0
      },
      "keyframes": [
        { "t": 0, "position": [-2.2, 1.4, 3.5], "lookAt": [0, 1.2, 0] },
        { "t": 5, "position": [-0.8, 1.35, 2.0], "lookAt": [0, 1.2, 0] }
      ]
    }
  ]
}`;

  const apiKey = getApiKey();
  if (!apiKey) {
    const plan = heuristicStagePlanFromShot(shot, shotIdx);
    return {
      ok: true,
      usedLlm: false,
      masterCinemaPrompt,
      plan,
      message: 'No API key — applied offline craft heuristic from Matrix tags.'
    };
  }

  const llmPrompt = `You are the Stage Work Studio 3D Stage Director.
Convert the MASTER CINEMA COMPILER prompt into a concrete 3D stage blocking plan for mannequins + cinema cameras.

Rules:
- Units are meters on a flat ground plane (y up). Humans stand on y=0.
- Prefer 1–2 humans and 1 camera unless the scene clearly needs more.
- animation.type must be one of: static, pan, tilt, push, pull, truck_left, truck_right, crane, crane_down, orbit, tracking, follow, handheld (dolly = push).
- Pose mannequins to match Action Performance / character movement / dialogue in the prompt (poseName: standing|talk|point|reach|sit|crouch|walk|look_left|look_right).
- Store gaze separately on each human: eyeTarget (hold|costar|camera|left|right|down|prop|custom), headDirection (follow_eyes|hold), bodyDirection (hold|camera|costar). Looking is not walking.
- Store expression (neutral|calm|determined|smiling|suspicious|angry|sad|shocked|frightened|crying) and interaction (none|look_at|point|touch|hold_prop|walk_toward) separately. Do not invent walks from looks or dialogue.
- Include dialogue array: speakerId, listenerId, text, start, end. Empty if the prompt has no spoken line.
- Include joint pose numbers (radians) and keyframes for BOTH humans and cameras so motion paths can be drawn.
- Camera keyframes must follow the stated camera move (dolly/orbit/pan/crane).
- Keep positions within roughly ±8m.
- Return ONLY valid JSON (no markdown, no commentary).

Optional director note from user:
${userInstruction || '(none — follow the Master Cinema Prompt)'}

MASTER CINEMA COMPILER PROMPT:
${masterCinemaPrompt}

JSON SCHEMA EXAMPLE:
${schemaHint}`;

  try {
    const response = await fetchGeminiContent(apiKey, llmPrompt, {
      temperature: 0.35,
      responseMimeType: 'application/json'
    }, { timeoutMs: 90000 });

    if (!response?.ok) {
      const plan = heuristicStagePlanFromShot(shot, shotIdx);
      return {
        ok: true,
        usedLlm: false,
        masterCinemaPrompt,
        plan,
        message: 'LLM request failed — applied offline heuristic.'
      };
    }

    const data = await response.json();
    const text = extractGeminiText(data);
    const parsed = parseJsonObject(text);
    if (!parsed) {
      const plan = heuristicStagePlanFromShot(shot, shotIdx);
      return {
        ok: true,
        usedLlm: false,
        masterCinemaPrompt,
        plan,
        message: 'LLM returned non-JSON — applied offline heuristic.'
      };
    }

    const plan = normalizeStagePlan({ ...parsed, source: 'llm' }, shot);
    return {
      ok: true,
      usedLlm: true,
      masterCinemaPrompt,
      plan,
      message: 'LLM composed poses + camera move + paths from Master Cinema Prompt.'
    };
  } catch (err) {
    const plan = heuristicStagePlanFromShot(shot, shotIdx);
    return {
      ok: true,
      usedLlm: false,
      masterCinemaPrompt,
      plan,
      message: `LLM error (${err?.message || 'unknown'}) — applied offline heuristic.`
    };
  }
}
