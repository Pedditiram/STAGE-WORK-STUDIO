/**
 * Compose 3D Stage blocking + camera animation from Stage Production Studio
 * Master Cinema Compiler prompt (same frame as Prompt Compiler).
 */

import { compileMasterCinemaCompilerPrompt } from '../utils/compileMasterCinemaPrompt';
import { fetchGeminiContent } from './aiScriptParser';
import {
  bakeCameraKeyframes,
  bakeHumanKeyframes,
  normalizePose,
  poseFromShot
} from '../utils/mannequinPose';

function getApiKey() {
  if (typeof window === 'undefined') return '';
  return String(localStorage.getItem('sps_api_key') || '').trim();
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

  const humans = (humansIn.length ? humansIn : [
    { id: 'Human 1', position: [-0.5, 0, 0], rotationY: 0.2, color: '#e8b84a' },
    { id: 'Human 2', position: [0.7, 0, 0.15], rotationY: -0.35, color: '#e0a830' }
  ]).slice(0, 6).map((h, i) => {
    const pose = poseFromShot(shot, i, h.pose);
    const human = {
      id: h.id || `Human ${i + 1}`,
      position: [
        clamp(h.position?.[0] ?? (i === 0 ? -0.5 : 0.7), -8, 8),
        clamp(h.position?.[1] ?? 0, 0, 2),
        clamp(h.position?.[2] ?? 0, -8, 8)
      ],
      rotationY: clamp(h.rotationY ?? 0, -Math.PI, Math.PI),
      rotation: Array.isArray(h.rotation)
        ? h.rotation.map((n, idx) => clamp(n, -Math.PI, Math.PI))
        : [0, clamp(h.rotationY ?? 0, -Math.PI, Math.PI), 0],
      color: h.color || (i === 0 ? '#e8b84a' : '#e0a830'),
      pose,
      poseName: h.poseName || undefined,
      keyframes: normalizeKeyframes(h.keyframes)
    };
    if (!human.keyframes.length) {
      human.keyframes = bakeHumanKeyframes(human, durationSec, shot);
    }
    return human;
  });

  const defaultCam = {
    id: 'Camera 1',
    position: [-2.2, 1.35, 3.2],
    lookAt: [0, 1.2, 0],
    focalMm,
    animation: { type: 'orbit', radius: 3.4, height: 1.4, revolutions: 0.35 }
  };

  const cameras = (camerasIn.length ? camerasIn : [defaultCam]).slice(0, 3).map((c, i) => {
    const animType = String(c.animation?.type || 'orbit').toLowerCase();
    const animation = {
      type: ['orbit', 'dolly', 'pan', 'static', 'crane'].includes(animType) ? animType : 'orbit',
      radius: clamp(c.animation?.radius ?? 3.4, 1.2, 12),
      height: clamp(c.animation?.height ?? 1.4, 0.3, 6),
      revolutions: clamp(c.animation?.revolutions ?? 0.35, 0, 2),
      from: Array.isArray(c.animation?.from) ? c.animation.from.map((n) => clamp(n, -12, 12)) : null,
      to: Array.isArray(c.animation?.to) ? c.animation.to.map((n) => clamp(n, -12, 12)) : null
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
      animation,
      keyframes: normalizeKeyframes(c.keyframes)
    };
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

  return {
    focalMm,
    aperture,
    durationSec,
    humans,
    cameras,
    framingNote: plan?.framingNote || shot?.shotComposition || 'Medium Shot',
    motionNote: plan?.motionNote || String(shot?.cameraMotionTag || 'Orbit').replace(/\[|\]/g, ''),
    source: plan?.source || 'llm'
  };
}

/** Offline heuristic from Matrix craft tags — no API. */
export function heuristicStagePlanFromShot(shot = {}, shotIdx = 0) {
  const framing = String(shot.shotComposition || '').toLowerCase();
  const motion = String(shot.cameraMotionTag || '').toLowerCase();
  let focalMm = 35;
  if (/extreme close|ecu|close[- ]?up|cu\b/.test(framing)) focalMm = 85;
  else if (/medium close|mcu/.test(framing)) focalMm = 50;
  else if (/wide|establishing|long shot|ls\b/.test(framing)) focalMm = 24;
  else if (/full shot|fs\b/.test(framing)) focalMm = 28;

  let animType = 'orbit';
  if (/dolly|push|track/.test(motion)) animType = 'dolly';
  else if (/pan|whip/.test(motion)) animType = 'pan';
  else if (/crane|tilt up|boom/.test(motion)) animType = 'crane';
  else if (/static|locked|tripod/.test(motion)) animType = 'static';

  const camZ = focalMm >= 70 ? 2.2 : focalMm <= 28 ? 5.2 : 3.4;
  const camY = animType === 'crane' ? 2.8 : 1.35;

  const pose1 = poseFromShot(shot, 0);
  const pose2 = poseFromShot(shot, 1);

  return normalizeStagePlan({
    focalMm,
    aperture: 2.8,
    durationSec: 5,
    humans: [
      {
        id: 'Human 1',
        position: [-0.45, 0, 0],
        rotationY: 0.25,
        color: '#e8b84a',
        pose: pose1
      },
      {
        id: 'Human 2',
        position: [0.75, 0, 0.2],
        rotationY: -0.4,
        color: '#e0a830',
        pose: pose2
      }
    ],
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
        to: animType === 'dolly'
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
      "keyframes": [
        { "t": 0, "position": [-0.5, 0, 0], "rotation": [0, 0.2, 0] },
        { "t": 5, "position": [-0.3, 0, 0.2], "rotation": [0, 0.1, 0] }
      ]
    }
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

  const llmPrompt = `You are the Stage Production Studio 3D Stage Director (Pedditi Labs).
Convert the MASTER CINEMA COMPILER prompt into a concrete 3D stage blocking plan for mannequins + cinema cameras.

Rules:
- Units are meters on a flat ground plane (y up). Humans stand on y=0.
- Prefer 1–2 humans and 1 camera unless the scene clearly needs more.
- animation.type must be one of: orbit, dolly, pan, crane, static — match the prompt's camera move.
- Pose mannequins to match Action Performance / character movement / dialogue in the prompt (poseName: standing|talk|point|reach|sit|crouch|walk|look_left|look_right).
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
