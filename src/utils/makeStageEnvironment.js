import * as THREE from 'three';
import { bounceCardColorRgb, bounceCardFeatherRange, bounceCardFeatherEmissive, bounceCardSpillIntensity } from './stagePracticals.js';

function mat(hex, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.82,
    metalness: 0.04,
    ...extra
  });
}

function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.skipPick = true;
  return m;
}

function buildPiece(piece) {
  const kind = piece.kind || 'wall';
  const g = new THREE.Group();
  g.name = piece.id || kind;
  g.userData.kind = 'set';
  g.userData.skipPick = true;
  if (kind === 'lantern') {
    const post = mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.05, 8), mat(0x4a3422));
    post.position.y = 0.52;
    const lamp = mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      mat(0xffc078, { emissive: new THREE.Color(0xff9944), emissiveIntensity: 1.4, roughness: 0.35 })
    );
    lamp.position.y = 1.08;
    lamp.userData.practicalKind = 'lantern';
    const light = new THREE.PointLight(0xffb060, 1.35, 7, 2);
    light.position.y = 1.1;
    light.castShadow = true;
    light.userData.skipPick = true;
    light.userData.practicalKind = 'lantern';
    g.userData.practicalKind = 'lantern';
    g.add(post, lamp, light);
  } else if (kind === 'torch') {
    const stick = mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.85, 8), mat(0x5c3a22));
    stick.position.y = 0.42;
    const flame = mesh(
      new THREE.ConeGeometry(0.09, 0.22, 8),
      mat(0xff6a22, { emissive: new THREE.Color(0xff5511), emissiveIntensity: 1.6, roughness: 0.5 })
    );
    flame.position.y = 0.95;
    flame.userData.practicalKind = 'torch';
    const light = new THREE.PointLight(0xff7a30, 1.6, 8, 2);
    light.position.y = 0.98;
    light.castShadow = true;
    light.userData.skipPick = true;
    light.userData.practicalKind = 'torch';
    g.userData.practicalKind = 'torch';
    g.add(stick, flame, light);
  } else if (kind === 'neon') {
    const tube = mesh(
      new THREE.BoxGeometry(0.9, 0.08, 0.06),
      mat(0x66ddff, { emissive: new THREE.Color(0x44c8ff), emissiveIntensity: 1.8, roughness: 0.25, metalness: 0.2 })
    );
    tube.position.y = 1.55;
    tube.userData.practicalKind = 'neon';
    const light = new THREE.PointLight(0x66ddff, 1.1, 9, 2);
    light.position.y = 1.55;
    light.userData.skipPick = true;
    light.userData.practicalKind = 'neon';
    g.userData.practicalKind = 'neon';
    g.add(tube, light);
  } else if (kind === 'bulb') {
    const stem = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), mat(0x888888));
    stem.position.y = 1.55;
    const globe = mesh(
      new THREE.SphereGeometry(0.07, 12, 10),
      mat(0xfff4d0, { emissive: new THREE.Color(0xffe8a8), emissiveIntensity: 1.3, roughness: 0.2 })
    );
    globe.position.y = 1.38;
    globe.userData.practicalKind = 'bulb';
    const light = new THREE.PointLight(0xfff0c8, 1.2, 6, 2);
    light.position.y = 1.38;
    light.userData.skipPick = true;
    light.userData.practicalKind = 'bulb';
    g.userData.practicalKind = 'bulb';
    g.add(stem, globe, light);
  } else if (kind === 'bounce_card') {
    const rgb = bounceCardColorRgb(piece.bounceColor);
    const col = new THREE.Color(rgb[0], rgb[1], rgb[2]);
    const card = mesh(
      new THREE.BoxGeometry(1, 1, 1),
      mat(col.getHex(), { roughness: 0.92, metalness: 0.02, emissive: col.clone(), emissiveIntensity: bounceCardFeatherEmissive(piece.bounceFeather) })
    );
    const fill = new THREE.PointLight(col, piece.bounce === 'mix' ? 0.5 : piece.bounce === 'fill' ? 0.42 : 0.26, bounceCardFeatherRange(piece.bounceFeather), 2);
    fill.position.set(0, 0.15, 0.2);
    fill.userData.skipPick = true;
    fill.userData.bounceCard = true;
    const spillI = bounceCardSpillIntensity(piece.bounceSpill, piece.bounce);
    if (spillI > 0) {
      const spill = new THREE.PointLight(col, spillI, 3.2, 2);
      spill.position.set(0, -0.35, 0.1);
      spill.userData.skipPick = true;
      spill.userData.bounceSpill = true;
      g.add(spill);
    }
    g.userData.bounceCard = true;
    g.userData.bounceColor = piece.bounceColor || '';
    g.userData.bounceAngle = piece.bounceAngle;
    g.userData.bounceDistance = piece.bounceDistance;
    g.userData.bounceHeight = piece.bounceHeight;
    g.userData.bounceTilt = piece.bounceTilt;
    g.userData.bounceSpread = piece.bounceSpread;
    g.userData.bounceFeather = piece.bounceFeather;
    g.userData.bounceSpill = piece.bounceSpill;
    g.add(card, fill);
  } else if (kind === 'tree') {
    const trunk = mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.1, 8), mat(0x4a3422));
    trunk.position.y = 0.55;
    const crown = mesh(new THREE.ConeGeometry(0.55, 1.4, 8), mat(0x3d5c3a));
    crown.position.y = 1.45;
    g.add(trunk, crown);
  } else if (kind === 'rock') {
    g.add(mesh(new THREE.DodecahedronGeometry(0.35, 0), mat(0x6b6560)));
  } else if (kind === 'road') {
    const road = mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x3a3a3e));
    road.receiveShadow = true;
    road.castShadow = false;
    g.add(road);
  } else if (kind === 'furniture') {
    g.add(mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x6b4423)));
  } else if (kind === 'building') {
    g.add(mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x5c5348)));
  } else {
    g.add(mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x6a6560)));
  }
  if (/^(lantern|torch|neon|bulb)$/.test(kind)) {
    const meta = {
      practicalKind: kind,
      practicalOn: piece.on,
      practicalOff: piece.off,
      practicalKeys: piece.keys || piece.keyframes,
      practicalIntensity: piece.intensity,
      practicalKelvin: piece.kelvin,
      practicalGel: piece.gel,
      practicalGobo: piece.gobo,
      practicalBarn: piece.barn,
      practicalShutter: piece.shutter,
      practicalBounce: piece.bounce
    };
    Object.assign(g.userData, meta);
    g.traverse((o) => {
      if (o === g) return;
      if (o.isLight || o.material?.emissiveIntensity != null) Object.assign(o.userData, meta);
    });
  }
  const p = piece.position || [0, 0, 0];
  const s = piece.scale || [1, 1, 1];
  g.position.set(p[0], p[1], p[2]);
  g.rotation.y = piece.rotationY || 0;
  g.rotation.x = piece.rotationX || 0;
  g.scale.set(s[0] || 1, s[1] || 1, s[2] || 1);
  return g;
}

export function makeStageEnvironmentGroup(environment = {}) {
  const root = new THREE.Group();
  root.name = 'stageEnvironment';
  root.userData.skipPick = true;
  (environment.pieces || []).forEach((piece) => root.add(buildPiece(piece)));
  return root;
}

export function applyStageAtmosphere(scene, environment = {}, { ground, keyLight } = {}) {
  if (!scene || !environment) return;
  if (environment.skyColor != null) scene.background = new THREE.Color(environment.skyColor);
  if (environment.fogColor != null) {
    scene.fog = new THREE.FogExp2(environment.fogColor, environment.fogDensity || 0.02);
  }
  if (ground?.material?.color && environment.groundColor != null) {
    ground.material.color.setHex(environment.groundColor);
  }
  if (keyLight?.color && environment.keyTint != null) {
    keyLight.color.setHex(environment.keyTint);
  }
}

export function makeStagePropMesh(prop, THREELib = THREE) {
  const T = THREELib;
  const geoKind = prop.geo || 'box';
  const size = prop.size || [0.6, 0.6, 0.6];
  let geo;
  if (geoKind === 'cylinder') geo = new T.CylinderGeometry(size[0], size[0], size[1] || 1, 16);
  else if (geoKind === 'sphere') geo = new T.SphereGeometry(size[0] || 0.3, 16, 12);
  else if (geoKind === 'plane') geo = new T.BoxGeometry(size[0] || 2, size[1] || 2, 0.08);
  else geo = new T.BoxGeometry(size[0] || 0.6, size[1] || 0.6, size[2] || 0.6);
  const meshObj = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({
      color: new T.Color(prop.color || '#8b7355'),
      roughness: 0.7,
      metalness: 0.05
    })
  );
  meshObj.castShadow = true;
  meshObj.receiveShadow = true;
  const pos = prop.position || [0, (size[1] || 0.6) / 2, -0.6];
  meshObj.position.set(pos[0], pos[1], pos[2]);
  if (prop.rotation) meshObj.rotation.set(prop.rotation[0] || 0, prop.rotation[1] || 0, prop.rotation[2] || 0);
  meshObj.userData.kind = 'prop';
  meshObj.userData.label = prop.label || prop.presetId || 'Prop';
  meshObj.userData.presetId = prop.presetId;
  meshObj.userData.planIndex = prop.planIndex ?? 0;
  return meshObj;
}
