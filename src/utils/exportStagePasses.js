/**
 * Multi-pass Camera 1 exports — Depth, Normals, OpenPose stick, Canny edges, OBJ.
 * Local-only; used for drawing refs + AI ControlNet workflows (PoseMy-class + cinema).
 */
import * as THREE from 'three';
import { saveExportBlob } from './saveExportFile';

function hideHelpers(scene, hide) {
  const stash = [];
  scene.traverse((obj) => {
    if (
      obj.isTransformControls ||
      obj.type === 'GridHelper' ||
      obj.userData?.skipPick ||
      obj.userData?.isPath ||
      obj.userData?.kind === 'camera' ||
      obj.userData?.kind === 'aim' ||
      obj.type === 'CameraHelper' ||
      obj.type === 'Line' ||
      obj.type === 'LineSegments'
    ) {
      stash.push({ obj, visible: obj.visible });
      if (hide) obj.visible = false;
    }
  });
  return () => stash.forEach(({ obj, visible }) => { obj.visible = visible; });
}

export async function renderPassToBlob(renderer, scene, camera, mode = 'color') {
  const restore = hideHelpers(scene, true);
  const prevBg = scene.background;
  const prevOverride = scene.overrideMaterial;
  let blob;

  try {
    if (mode === 'depth') {
      scene.background = new THREE.Color(0x000000);
      scene.overrideMaterial = new THREE.MeshDepthMaterial();
    } else if (mode === 'normals') {
      scene.background = new THREE.Color(0x8080ff);
      scene.overrideMaterial = new THREE.MeshNormalMaterial();
    } else {
      scene.overrideMaterial = null;
    }

    renderer.clear();
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const res = await fetch(dataUrl);
    blob = await res.blob();

    if (mode === 'canny') {
      blob = await cannyFromBlob(blob);
    }
  } finally {
    scene.background = prevBg;
    scene.overrideMaterial = prevOverride;
    restore();
  }
  return blob;
}

/** Sobel-ish edge detect for ControlNet Canny-style refs. */
async function cannyFromBlob(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const { data, width, height } = img;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  const out = ctx.createImageData(width, height);
  const sx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      let k = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const v = gray[(y + j) * width + (x + i)];
          gx += v * sx[k];
          gy += v * sy[k];
          k++;
        }
      }
      const mag = Math.min(255, Math.hypot(gx, gy));
      const o = (y * width + x) * 4;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = mag;
      out.data[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return new Promise((resolve) => c.toBlob((b) => resolve(b || blob), 'image/png'));
}

/** Draw OpenPose-style stick figure from mannequin joint world positions. */
export function renderOpenPoseOverlay(renderer, scene, camera, humans) {
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const pairs = [
    ['hips', 'spine'], ['spine', 'chest'], ['chest', 'head'],
    ['chest', 'upperArmL'], ['upperArmL', 'lowerArmL'],
    ['chest', 'upperArmR'], ['upperArmR', 'lowerArmR'],
    ['hips', 'thighL'], ['thighL', 'shinL'],
    ['hips', 'thighR'], ['thighR', 'shinR']
  ];
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ffffff', '#ffa500', '#ff69b4', '#7cfc00', '#1e90ff'];

  const project = (obj3) => {
    if (!obj3) return null;
    const v = new THREE.Vector3();
    obj3.getWorldPosition(v);
    v.project(camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  };

  humans.forEach((group) => {
    const j = group.userData.joints || {};
    pairs.forEach(([a, b], i) => {
      const pa = project(j[a]);
      const pb = project(j[b]);
      if (!pa || !pb) return;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = Math.max(3, w / 280);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });
    Object.values(j).forEach((node) => {
      const p = project(node);
      if (!p) return;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(3, w / 400), 0, Math.PI * 2);
      ctx.fill();
    });
  });

  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

export async function exportPassBundle({
  renderer,
  scene,
  camera,
  humans = [],
  fileStem,
  modes = ['color', 'depth', 'normals', 'canny', 'openpose']
}) {
  const results = [];
  for (const mode of modes) {
    let blob;
    if (mode === 'openpose') {
      // still render color underlay hidden — stick only
      blob = await renderOpenPoseOverlay(renderer, scene, camera, humans);
    } else if (mode === 'color') {
      blob = await renderPassToBlob(renderer, scene, camera, 'color');
    } else {
      blob = await renderPassToBlob(renderer, scene, camera, mode);
    }
    if (!blob) continue;
    const name = `${fileStem}_${mode}.png`;
    const saved = await saveExportBlob(blob, name, { preferPicker: modes.length === 1 });
    results.push({ mode, saved, name });
  }
  return results;
}

/** Minimal OBJ of mannequin capsules / joints for sculpt base. */
export function exportMannequinsObj(humans = []) {
  let vCount = 0;
  const lines = ['# Stage Production Studio mannequin export', 'o SPS_Mannequins'];
  const pushBox = (cx, cy, cz, sx, sy, sz) => {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const verts = [
      [cx - hx, cy - hy, cz - hz],
      [cx + hx, cy - hy, cz - hz],
      [cx + hx, cy + hy, cz - hz],
      [cx - hx, cy + hy, cz - hz],
      [cx - hx, cy - hy, cz + hz],
      [cx + hx, cy - hy, cz + hz],
      [cx + hx, cy + hy, cz + hz],
      [cx - hx, cy + hy, cz + hz]
    ];
    verts.forEach((v) => lines.push(`v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`));
    const o = vCount;
    const faces = [
      [1, 2, 3, 4], [5, 8, 7, 6], [1, 5, 6, 2], [4, 3, 7, 8], [1, 4, 8, 5], [2, 6, 7, 3]
    ];
    faces.forEach((f) => lines.push(`f ${f.map((i) => i + o).join(' ')}`));
    vCount += 8;
  };

  humans.forEach((g, hi) => {
    lines.push(`g Human_${hi + 1}`);
    g.updateMatrixWorld(true);
    g.traverse((obj) => {
      if (!obj.isMesh) return;
      const p = new THREE.Vector3();
      obj.getWorldPosition(p);
      const s = new THREE.Vector3();
      obj.getWorldScale(s);
      pushBox(p.x, p.y, p.z, Math.max(0.04, s.x * 0.12), Math.max(0.04, s.y * 0.2), Math.max(0.04, s.z * 0.12));
    });
  });

  return new Blob([lines.join('\n')], { type: 'text/plain' });
}
