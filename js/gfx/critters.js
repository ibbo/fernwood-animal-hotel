// Animals and the keeper, each built from soft round shapes and brought to
// life with a few simple motions: breathing, blinking, hopping, sleeping.

import { THREE } from './core.js';
import { TAU, lerp, clamp, rand } from '../util.js';
import { LOOK, cleanLook } from '../data.js';

const SPH = new THREE.SphereGeometry(1, 20, 14);
const CONE = new THREE.ConeGeometry(1, 1, 12);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const TOR = new THREE.TorusGeometry(1, 0.3, 8, 18);

const mats = new Map();
function fur(color) {
  if (mats.has(color)) return mats.get(color);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 });
  // A soft bright rim, so the animals look fuzzy and stand out.
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6) * 0.38;');
  };
  mats.set(color, m);
  return m;
}
const EYE = new THREE.MeshStandardMaterial({ color: '#1d1a22', roughness: 0.25 });
const SHINE = new THREE.MeshBasicMaterial({ color: '#ffffff' });

function part(parent, geom, color, x, y, z, s = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geom, typeof color === 'string' ? fur(color) : color);
  m.position.set(x, y, z);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function group(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function eye(parent, x, y, z, r, iris) {
  const g = group(parent, x, y, z);
  if (iris) part(g, SPH, iris, 0, 0, -r * 0.25, [r * 1.7, r * 1.7, r * 0.9]);
  part(g, SPH, EYE, 0, 0, 0, [r, r * 1.12, r * 0.8]).castShadow = false;
  const s = part(g, SPH, SHINE, r * 0.32, r * 0.4, r * 0.62, r * 0.36);
  s.castShadow = false;
  return g;
}

// ---------------------------------------------------------------- body plans
function quadruped(S) {
  const root = new THREE.Group(), rig = group(root, 0, 0, 0);
  const [bw, bh, bl] = S.body, legH = S.legH ?? 0.13, hr = S.head ?? 0.24;
  const by = legH + bh * 0.85;
  const P = { root, rig, legs: [], ears: [], eyes: [], wings: [], by, hr, legH, bw, bh, bl };
  P.body = part(rig, SPH, S.col, 0, by, 0, [bw, bh, bl]);
  if (S.belly) part(rig, SPH, S.belly, 0, by - bh * 0.16, bl * 0.08, [bw * 0.88, bh * 0.9, bl * 0.9]);
  const hy = S.headY ?? by + bh * 0.42 + hr * 0.32, hz = S.headZ ?? bl * 0.62;
  if (S.neck) part(rig, SPH, S.col, 0, (by + hy) / 2, hz * 0.8, [hr * 0.5, (hy - by) * 0.75, hr * 0.5], 0.3);
  const head = P.head = group(rig, 0, hy, hz);
  part(head, SPH, S.headCol || S.col, 0, 0, 0, [hr, hr * 0.92, hr * 0.94]);
  const er = S.eye ?? hr * 0.15;
  for (const sx of [-1, 1]) P.eyes.push(eye(head, sx * hr * (S.eyeX ?? 0.44), hr * (S.eyeY ?? 0.08), hr * (S.eyeZ ?? 0.82), er));
  if (S.snout) {
    const [sw, sh, sl] = S.snout;
    part(head, SPH, S.snoutCol || S.belly || S.col, 0, -hr * 0.26, hr * 0.72, [sw, sh, sl]);
    part(head, SPH, S.nose || '#3a2a2a', 0, -hr * 0.2 + sh * 0.35, hr * 0.72 + sl * 0.92, [0.034 * (S.noseS || 1), 0.026 * (S.noseS || 1), 0.022]);
  }
  for (const sx of [-1, 1]) part(head, SPH, '#ff9aa8', sx * hr * 0.66, -hr * 0.22, hr * 0.6, [hr * 0.17, hr * 0.1, hr * 0.06]).castShadow = false;
  // Ears.
  const E = S.ears || {};
  for (const sx of [-1, 1]) {
    const g = group(head, sx * hr * (E.x ?? 0.62), hr * (E.y ?? 0.7), E.z ?? 0);
    const s = E.s ?? 0.09;
    if (E.type === 'long') {
      part(g, SPH, E.col || S.col, 0, s * 3.2, 0, [s * 0.95, s * 3.6, s * 0.6]);
      part(g, SPH, E.inner || '#ffb6c9', 0, s * 3.2, s * 0.32, [s * 0.55, s * 2.9, s * 0.4]);
      g.rotation.z = -sx * 0.16;
    } else if (E.type === 'point') {
      part(g, CONE, E.col || S.col, 0, s * 1.0, 0, [s * 1.1, s * 2.6, s * 0.7]);
      part(g, CONE, E.inner || '#3a2a2a', 0, s * 1.0, s * 0.3, [s * 0.6, s * 1.7, s * 0.45]);
      g.rotation.z = -sx * 0.25;
    } else if (E.type === 'leaf') {
      part(g, SPH, E.col || S.col, sx * s * 1.2, 0, 0, [s * 1.7, s * 0.8, s * 0.45], 0, 0, sx * 0.5);
      part(g, SPH, E.inner || '#ffcfc0', sx * s * 1.2, 0, s * 0.2, [s * 1.2, s * 0.5, s * 0.35], 0, 0, sx * 0.5);
    } else if (E.type !== 'none') {
      part(g, SPH, E.col || S.col, 0, 0, 0, [s, s, s * 0.6]);
      part(g, SPH, E.inner || S.belly || '#ffcfc0', 0, 0, s * 0.3, [s * 0.6, s * 0.6, s * 0.4]);
    }
    P.ears.push(g);
  }
  // Legs, each on a hip so it can swing.
  const lr = S.legR ?? 0.075;
  for (const sz of [1, -1]) for (const sx of [-1, 1]) {
    const hip = group(rig, sx * bw * 0.56, legH + 0.04, sz * bl * 0.5);
    part(hip, SPH, S.legCol || S.col, 0, -legH * 0.45, 0, [lr, legH * 0.62 + 0.03, lr * 1.08]);
    if (S.paw) part(hip, SPH, S.paw, 0, -legH - 0.01, lr * 0.25, [lr * 1.02, 0.035, lr * 1.25]);
    P.legs.push(hip);
  }
  // Tail.
  const T = S.tail || {};
  const tail = P.tail = group(rig, 0, by + bh * 0.1, -bl * 0.88);
  if (T.type === 'puff') part(tail, SPH, T.col || S.col, 0, 0.02, -0.03, T.s ?? 0.09);
  else if (T.type === 'bushy') {
    part(tail, SPH, T.col || S.col, 0, 0.12, -0.14, [0.11, 0.12, 0.24], -0.9);
    part(tail, SPH, T.tip || '#ffffff', 0, 0.24, -0.26, [0.085, 0.09, 0.12], -0.9);
  } else if (T.type === 'flat') {
    part(tail, SPH, T.col || S.col, 0, -0.04, -0.2, [0.085, 0.06, 0.3], 0.25);
  } else if (T.type === 'stub') part(tail, SPH, T.col || S.col, 0, 0, 0, 0.055);
  root.scale.setScalar(S.size ?? 1);
  return P;
}

function bird(S) {
  const root = new THREE.Group(), rig = group(root, 0, 0, 0);
  const [bw, bh, bl] = S.body, legH = S.legH ?? 0.06, hr = S.head ?? bw;
  const by = legH + bh * 0.95;
  const P = { root, rig, legs: [], ears: [], eyes: [], wings: [], by, hr, legH, bw, bh, bl, biped: true };
  P.body = part(rig, SPH, S.col, 0, by, 0, [bw, bh, bl]);
  if (S.belly) part(rig, SPH, S.belly, 0, by - bh * 0.08, bl * 0.2, [bw * 0.8, bh * 0.82, bl * 0.86]);
  const head = P.head = group(rig, 0, S.headY ?? by + bh * 0.72, S.headZ ?? bl * 0.12);
  if (!S.merged) part(head, SPH, S.headCol || S.col, 0, 0, 0, hr);
  const er = S.eye ?? hr * 0.15;
  for (const sx of [-1, 1]) P.eyes.push(eye(head, sx * hr * (S.eyeX ?? 0.42), hr * (S.eyeY ?? 0.1), S.eyeZabs ?? hr * (S.eyeZ ?? 0.84), er, S.iris));
  for (const sx of [-1, 1]) part(head, SPH, '#ff9aa8', sx * hr * 0.68, -hr * 0.22, (S.eyeZabs ?? hr * 0.84) * 0.78, [hr * 0.16, hr * 0.09, hr * 0.06]).castShadow = false;
  for (const sx of [-1, 1]) {
    const w = group(rig, sx * bw * 0.92, by + bh * 0.25, 0);
    part(w, SPH, S.wing || S.col, sx * 0.02, -bh * 0.38, 0, [0.05, bh * 0.5, bl * 0.55], 0, 0, sx * 0.12);
    P.wings.push(w);
  }
  for (const sx of [-1, 1]) {
    const hip = group(rig, sx * bw * 0.45, legH + 0.02, 0.02);
    part(hip, SPH, S.foot || '#ff9a3c', 0, -legH + 0.01, 0.05, [0.07, 0.03, 0.1]);
    P.legs.push(hip);
  }
  P.tail = group(rig, 0, by - bh * 0.3, -bl * 0.85);
  root.scale.setScalar(S.size ?? 1);
  return P;
}

// ---------------------------------------------------------------- the animals
const MAKE = {
  rabbit: () => quadruped({ col: '#fbf3e8', belly: '#ffffff', body: [0.24, 0.22, 0.28], head: 0.235, legH: 0.1, snout: [0.085, 0.06, 0.07], nose: '#ff8fae',
    ears: { type: 'long', s: 0.075, x: 0.42, y: 0.72, inner: '#ffb6c9' }, tail: { type: 'puff', col: '#ffffff', s: 0.095 }, size: 0.95 }),
  hedgehog: () => {
    const P = quadruped({ col: '#f0d5ad', body: [0.25, 0.2, 0.29], head: 0.19, legH: 0.07, legR: 0.06, headZ: 0.25, snout: [0.075, 0.06, 0.12], nose: '#2f2428', noseS: 1.3,
      ears: { s: 0.055, x: 0.7, y: 0.66, inner: '#e7b79a' }, size: 0.85 });
    part(P.rig, SPH, '#8f6443', 0, P.by + 0.05, -0.06, [0.3, 0.26, 0.32]);
    for (let i = 0; i < 46; i++) {
      const a = (i * 2.399) % TAU, e = 0.2 + ((i * 0.618) % 1) * 1.25;
      const x = Math.sin(e) * Math.cos(a), y = Math.cos(e), z = Math.sin(e) * Math.sin(a);
      if (z > 0.55 && y < 0.7) continue;
      const c = part(P.rig, CONE, i % 3 ? '#6f4a30' : '#a57a52', x * 0.3, P.by + 0.05 + y * 0.26, -0.06 + z * 0.32, [0.035, 0.13, 0.035]);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y + 0.25, z - 0.3).normalize());
    }
    return P;
  },
  fox: () => {
    const P = quadruped({ col: '#f28b3a', belly: '#fff2de', body: [0.22, 0.21, 0.32], head: 0.235, legH: 0.16, legR: 0.062, legCol: '#5b3a2b', snout: [0.1, 0.075, 0.13], snoutCol: '#fff2de', nose: '#2b2226', noseS: 1.2,
      ears: { type: 'point', s: 0.085, x: 0.55, y: 0.66, inner: '#5b3a2b' }, tail: { type: 'bushy', tip: '#fff2de' }, size: 1 });
    for (const sx of [-1, 1]) part(P.head, SPH, '#fff2de', sx * 0.15, -0.09, 0.1, [0.1, 0.08, 0.1]);
    return P;
  },
  deer: () => {
    const P = quadruped({ col: '#cf9058', belly: '#f6e4c6', body: [0.2, 0.2, 0.33], head: 0.2, legH: 0.27, legR: 0.045, paw: '#5b3a2b', neck: true, headY: 0.8, headZ: 0.33, snout: [0.085, 0.07, 0.11], snoutCol: '#f6e4c6', nose: '#3a2a2a', noseS: 1.2,
      ears: { type: 'leaf', s: 0.075, x: 0.8, y: 0.45 }, tail: { type: 'stub', col: '#ffffff' }, size: 1 });
    for (let i = 0; i < 7; i++) part(P.rig, SPH, '#fbeeda', Math.cos(i * 2.4) * 0.11, P.by + 0.165 - Math.abs(Math.cos(i * 2.4)) * 0.03, -0.2 + i * 0.055, [0.03, 0.012, 0.03]).castShadow = false;
    for (const sx of [-1, 1]) {
      part(P.head, CYL, '#ead9b8', sx * 0.08, 0.26, -0.03, [0.018, 0.17, 0.018], 0, 0, -sx * 0.25);
      part(P.head, CYL, '#ead9b8', sx * 0.135, 0.31, -0.03, [0.014, 0.08, 0.014], 0, 0, -sx * 1.0);
    }
    return P;
  },
  bear: () => quadruped({ col: '#8f5e3e', belly: '#b98c64', body: [0.31, 0.28, 0.36], head: 0.275, legH: 0.13, legR: 0.1, snout: [0.12, 0.09, 0.1], snoutCol: '#e2c198', nose: '#2b2226', noseS: 1.5,
    ears: { s: 0.09, x: 0.68, y: 0.7, inner: '#e2c198' }, tail: { type: 'stub' }, size: 1.12 }),
  tortoise: () => {
    const P = quadruped({ col: '#a4cc72', body: [0.24, 0.13, 0.28], head: 0.16, legH: 0.07, legR: 0.085, headY: 0.26, headZ: 0.38, ears: { type: 'none' }, tail: { type: 'stub' }, size: 1 });
    part(P.rig, SPH, '#6f9347', 0, P.by + 0.02, -0.02, [0.33, 0.27, 0.37]);
    part(P.rig, TOR, '#59783a', 0, P.by - 0.01, -0.02, [0.3, 0.34, 0.2], Math.PI / 2);
    const spots = [[0, 0.265, 0], [0.16, 0.2, 0.12], [-0.16, 0.2, 0.12], [0.16, 0.2, -0.16], [-0.16, 0.2, -0.16], [0, 0.21, 0.24], [0, 0.21, -0.27]];
    for (const [x, y, z] of spots) part(P.rig, SPH, '#b9d67f', x, P.by + y - 0.02, z - 0.02, [0.085, 0.03, 0.085]).castShadow = false;
    return P;
  },
  otter: () => {
    const P = quadruped({ col: '#8a5d3d', belly: '#ecd3ad', body: [0.2, 0.19, 0.38], head: 0.215, legH: 0.08, legR: 0.07, snout: [0.12, 0.08, 0.09], snoutCol: '#ecd3ad', nose: '#2b2226', noseS: 1.6,
      ears: { s: 0.045, x: 0.82, y: 0.5, inner: '#6f4a30' }, tail: { type: 'flat' }, size: 1 });
    part(P.head, SPH, '#ecd3ad', 0, -0.07, 0.06, [0.19, 0.13, 0.17]);
    return P;
  },
  panda: () => {
    const P = quadruped({ col: '#ffffff', body: [0.3, 0.27, 0.34], head: 0.275, legH: 0.13, legR: 0.1, legCol: '#2c2c35', snout: [0.095, 0.07, 0.08], snoutCol: '#ffffff', nose: '#2b2226', noseS: 1.3,
      ears: { s: 0.09, x: 0.68, y: 0.7, col: '#2c2c35', inner: '#2c2c35' }, tail: { type: 'stub', col: '#ffffff' }, eyeX: 0.4, size: 1.12 });
    part(P.rig, SPH, '#2c2c35', 0, P.by + 0.01, 0.15, [0.312, 0.265, 0.15]);
    for (const sx of [-1, 1]) part(P.head, SPH, '#2c2c35', sx * 0.115, 0.01, 0.205, [0.07, 0.085, 0.04], 0, 0, sx * 0.5).castShadow = false;
    return P;
  },
  frog: () => {
    const P = quadruped({ col: '#6cc24a', belly: '#dcf3a4', body: [0.27, 0.17, 0.25], head: 0.2, legH: 0.05, legR: 0.06, headY: 0.26, headZ: 0.08, ears: { type: 'none' }, eyeX: 0.62, eyeY: 0.75, eyeZ: 0.62, eye: 0.045, size: 0.85 });
    for (const sx of [-1, 1]) {
      part(P.head, SPH, '#6cc24a', sx * 0.124, 0.13, 0.08, 0.085);
      part(P.head, SPH, '#ffffff', sx * 0.124, 0.145, 0.105, 0.07);
      part(P.rig, SPH, '#58ad3e', sx * 0.25, 0.1, -0.1, [0.09, 0.09, 0.17]);
    }
    part(P.head, SPH, '#4a8f34', 0, -0.04, 0.2, [0.12, 0.012, 0.03]).castShadow = false;
    return P;
  },
  duck: () => {
    const P = bird({ col: '#ffdb5c', body: [0.2, 0.2, 0.25], head: 0.175, wing: '#f6c640', size: 0.9, headY: 0.52, headZ: 0.1 });
    part(P.head, SPH, '#ff9a3c', 0, -0.045, 0.17, [0.085, 0.034, 0.085]);
    part(P.tail, CONE, '#ffdb5c', 0, 0.09, 0, [0.07, 0.16, 0.07], -0.7);
    part(P.head, CONE, '#ffdb5c', 0, 0.19, -0.02, [0.03, 0.08, 0.03], -0.4);
    return P;
  },
  owl: () => {
    const P = bird({ col: '#9c6c46', belly: '#f1dfbd', body: [0.24, 0.27, 0.22], merged: true, wing: '#7a5235', size: 0.95, headY: 0.44, headZ: 0, eyeX: 0.4, eyeY: 0, eyeZabs: 0.215, eye: 0.04, iris: '#ffc83d' });
    for (const sx of [-1, 1]) {
      part(P.head, SPH, '#f1dfbd', sx * 0.095, 0, 0.14, [0.105, 0.105, 0.07]);
      part(P.head, CONE, '#7a5235', sx * 0.15, 0.2, 0, [0.05, 0.14, 0.04], 0, 0, -sx * 0.4);
    }
    part(P.head, CONE, '#ff9a3c', 0, -0.065, 0.215, [0.03, 0.07, 0.03], 2.4);
    for (let i = 0; i < 5; i++) part(P.rig, SPH, '#c79a6b', (i % 3 - 1) * 0.08, 0.2 + (i % 2) * 0.07, 0.205, [0.025, 0.018, 0.012]).castShadow = false;
    return P;
  },
  penguin: () => {
    const P = bird({ col: '#333a4a', belly: '#ffffff', body: [0.23, 0.3, 0.21], merged: true, size: 0.95, headY: 0.5, headZ: 0, eyeX: 0.38, eyeY: 0, eyeZabs: 0.165, eye: 0.03 });
    part(P.head, CONE, '#ff9a3c', 0, -0.045, 0.21, [0.04, 0.1, 0.035], Math.PI / 2);
    return P;
  },
};

// The keeper: a small child. `look` picks the skin, hair, hat and clothes.
function keeper(look) {
  const L = cleanLook(look);
  const skin = LOOK.skin[L.skin], hair = LOOK.hair[L.hair], o = L.outfit;
  const root = new THREE.Group(), rig = group(root, 0, 0, 0);
  const P = { root, rig, legs: [], ears: [], eyes: [], wings: [], by: 0.5, hr: 0.24, biped: true, human: true };
  const C = {
    rainbow: { leg: '#a98be0', shoe: '#ffffff', top: '#fdfbf5', sleeve: '#fdfbf5' },
    dungarees: { leg: '#3d5a80', shoe: '#8a5b3c', top: '#f4f1e8', sleeve: '#f4f1e8' },
    stripes: { leg: '#e0584c', shoe: '#ffffff', top: '#fdfbf5', sleeve: '#33508f' },
    dress: { leg: skin, shoe: '#d9477a', top: '#ff8fb8', sleeve: '#ff8fb8' },
    jumper: { leg: '#5874a8', shoe: '#6b4a34', top: '#5fae62', sleeve: '#5fae62' },
    explorer: { leg: '#8a6a45', shoe: '#5b4030', top: '#d9c38e', sleeve: '#d9c38e' },
  }[o];
  for (const sx of [-1, 1]) {
    const hip = group(rig, sx * 0.085, 0.3, 0);
    part(hip, SPH, C.leg, 0, -0.12, 0, [0.07, 0.16, 0.075]);
    if (o === 'rainbow') {                                        // bright splashy leggings
      part(hip, SPH, '#ff8ac4', sx * 0.03, -0.07, 0.045, [0.04, 0.05, 0.03]).castShadow = false;
      part(hip, SPH, '#6ec8f2', -sx * 0.025, -0.16, 0.05, [0.035, 0.045, 0.03]).castShadow = false;
      part(hip, SPH, '#ff8ac4', sx * 0.01, -0.2, -0.05, [0.04, 0.045, 0.03]).castShadow = false;
      part(hip, SPH, '#ffe27a', sx * 0.045, -0.14, -0.02, [0.03, 0.04, 0.03]).castShadow = false;
    }
    if (o === 'dress') part(hip, SPH, '#ffffff', 0, -0.2, 0, [0.072, 0.06, 0.077]);
    part(hip, SPH, C.shoe, 0, -0.265, 0.025, [0.08, 0.05, 0.115]);
    P.legs.push(hip);
  }
  P.body = part(rig, SPH, C.top, 0, 0.5, 0, [0.185, 0.22, 0.15]);
  const band = (col, y, k = 1) => part(rig, SPH, col, 0, y, 0, [0.19 * k, 0.042, 0.155 * k]);
  if (o === 'rainbow') {                                          // a tie-dye hoodie
    band('#63cfd6', 0.61, 0.9); band('#ffe27a', 0.535, 1.0); band('#ff9ccb', 0.46, 1.02); band('#63cfd6', 0.385, 0.95); band('#ffe27a', 0.325, 0.8);
    part(rig, SPH, '#fdfbf5', 0, 0.69, -0.1, [0.15, 0.085, 0.1]);                 // hood
    part(rig, SPH, '#63cfd6', 0, 0.665, -0.13, [0.13, 0.05, 0.085]);
  } else if (o === 'dungarees') {
    part(rig, SPH, '#3fae9e', 0, 0.45, 0.005, [0.192, 0.185, 0.157]);
    part(rig, SPH, '#3fae9e', 0, 0.56, 0.1, [0.1, 0.1, 0.05]);
    part(rig, SPH, '#6f9a52', 0, 0.52, -0.16, [0.14, 0.17, 0.09]);               // backpack
    part(rig, TOR, '#e8553f', 0, 0.69, 0, [0.12, 0.12, 0.16], Math.PI / 2);      // scarf
  } else if (o === 'stripes') {
    band('#33508f', 0.6, 0.92); band('#33508f', 0.51, 1.01); band('#33508f', 0.42, 1.01);
  } else if (o === 'dress') {
    part(rig, CONE, '#ff8fb8', 0, 0.36, 0, [0.27, 0.3, 0.23]);
    part(rig, TOR, '#ffffff', 0, 0.68, 0, [0.11, 0.11, 0.12], Math.PI / 2);
  } else if (o === 'jumper') {
    part(rig, SPH, '#ffd24a', 0, 0.52, 0.135, [0.06, 0.06, 0.025]).castShadow = false;
    part(rig, TOR, '#4b9450', 0, 0.68, 0, [0.115, 0.115, 0.14], Math.PI / 2);
  } else {
    part(rig, SPH, '#7a5a3a', 0, 0.52, -0.16, [0.14, 0.17, 0.09]);               // backpack
    part(rig, TOR, '#4f9d5d', 0, 0.69, 0, [0.12, 0.12, 0.16], Math.PI / 2);
    part(rig, SPH, '#8a6a45', 0, 0.37, 0, [0.19, 0.06, 0.156]);                  // belt
  }
  for (const sx of [-1, 1]) {
    const sh = group(rig, sx * 0.19, 0.62, 0);
    part(sh, SPH, C.sleeve, 0, -0.1, 0, [0.055, 0.13, 0.055]);
    if (o === 'rainbow') { part(sh, SPH, '#63cfd6', 0, -0.07, 0, [0.058, 0.035, 0.058]); part(sh, SPH, '#ff9ccb', 0, -0.15, 0, [0.057, 0.03, 0.057]); }
    part(sh, SPH, skin, 0, -0.235, 0, 0.05);
    P.wings.push(sh);
  }
  const head = P.head = group(rig, 0, 0.92, 0);
  part(head, SPH, skin, 0, 0, 0, [0.235, 0.22, 0.22]);
  part(head, SPH, hair, 0, 0.035, -0.045, [0.245, 0.225, 0.215]);
  const st = L.style;
  if (st === 'ponytail') {                                        // pulled back, with loose strands at the front
    part(head, SPH, '#ff8ac4', 0, 0.04, -0.245, 0.05);
    part(head, SPH, hair, 0, -0.07, -0.3, [0.075, 0.17, 0.075], 0.35);
    for (const sx of [-1, 1]) part(head, SPH, hair, sx * 0.212, -0.07, 0.075, [0.03, 0.15, 0.045], 0, 0, sx * 0.08);
    part(head, SPH, hair, 0.05, 0.15, 0.13, [0.15, 0.055, 0.09], 0, 0, -0.25);
  } else if (st === 'bunches') {
    for (const sx of [-1, 1]) part(head, SPH, hair, sx * 0.2, -0.1, -0.02, [0.07, 0.13, 0.09]);
  } else if (st === 'short') {
    part(head, SPH, hair, 0, 0.14, 0.12, [0.2, 0.07, 0.1]);
  } else if (st === 'long') {
    part(head, SPH, hair, 0, -0.14, -0.1, [0.24, 0.26, 0.14]);
    for (const sx of [-1, 1]) part(head, SPH, hair, sx * 0.2, -0.12, 0.0, [0.06, 0.2, 0.1]);
    part(head, SPH, hair, 0, 0.14, 0.12, [0.2, 0.07, 0.1]);
  } else {
    for (let i = 0; i < 16; i++) {
      const a = i * 2.399, e = 0.25 + ((i * 0.618) % 1) * 1.5;
      const x = Math.sin(e) * Math.cos(a), y = Math.cos(e), z = Math.sin(e) * Math.sin(a);
      if (z > 0.45 && y < 0.55) continue;
      part(head, SPH, hair, x * 0.24, 0.03 + y * 0.22, -0.03 + z * 0.22, 0.075);
    }
  }
  for (const sx of [-1, 1]) {
    P.eyes.push(eye(head, sx * 0.095, -0.005, 0.2, 0.032));
    part(head, SPH, '#ff9aa8', sx * 0.15, -0.07, 0.165, [0.04, 0.024, 0.02]).castShadow = false;
  }
  part(head, SPH, '#c9795a', 0, -0.085, 0.208, [0.03, 0.012, 0.01]).castShadow = false;
  if (L.hat === 'straw') {
    part(head, CYL, '#f0d48a', 0, 0.165, 0, [0.37, 0.025, 0.37]);
    part(head, SPH, '#f0d48a', 0, 0.18, 0, [0.2, 0.15, 0.2]);
    part(head, CYL, '#e8553f', 0, 0.2, 0, [0.205, 0.045, 0.205]);
  } else if (L.hat === 'bow') {
    for (const sx of [-1, 1]) part(head, SPH, '#ff5f8f', 0.1 + sx * 0.055, 0.215, 0.07, [0.06, 0.045, 0.03], 0, 0, sx * 0.5);
    part(head, SPH, '#ffd1df', 0.1, 0.215, 0.08, 0.025);
  } else if (L.hat === 'cap') {
    part(head, SPH, '#3f7fd6', 0, 0.12, -0.01, [0.245, 0.16, 0.235]);
    part(head, CYL, '#3f7fd6', 0, 0.13, 0.2, [0.16, 0.018, 0.14]);
  }
  root.scale.setScalar(0.95);
  return P;
}

// ---------------------------------------------------------------- animation
export class Critter {
  constructor(species, look) {
    const P = species === 'keeper' ? keeper(look) : MAKE[species]();
    Object.assign(this, P);
    this.species = species;
    this.anim = 'idle';
    this.phase = Math.random() * 10;
    this.blink = rand(1, 4);
    this.mix = 0;               // 0 idle … 1 walking, eased
    this.pulse = 0;             // a quick squash when something nice happens
    this.speed = 1;
    this.root.traverse((o) => { o.frustumCulled = true; });
  }

  set(anim) { this.anim = anim; }
  pop() { this.pulse = 1; }

  update(dt, t) {
    const a = this.anim, moving = a === 'walk';
    this.mix = lerp(this.mix, moving ? 1 : 0, 1 - Math.exp(-dt * 10));
    this.phase += dt * (moving ? 11 * this.speed : 2);
    const ph = this.phase, rig = this.rig, m = this.mix;
    this.pulse = Math.max(0, this.pulse - dt * 3.2);
    const squash = Math.sin(this.pulse * Math.PI) * 0.22;

    let y = 0, sy = 1 + Math.sin(t * 2.2 + ph * 0.1) * 0.015, tilt = 0, roll = 0, headX = 0, headY = Math.sin(t * 0.5 + ph) * 0.25 * (1 - m), headZ = Math.sin(t * 0.8 + ph) * 0.05;
    let eyes = 1;
    // Walking: a springy hop, or a waddle for two-legged animals.
    const hop = Math.abs(Math.sin(ph));
    y += hop * (this.human ? 0.045 : this.biped ? 0.05 : 0.09) * m;
    tilt += Math.sin(ph * 2) * 0.05 * m;
    if (this.biped) roll += Math.sin(ph) * (this.human ? 0.05 : 0.16) * m;
    if (a === 'happy') { y += Math.abs(Math.sin(t * 8)) * 0.22; headX = -0.25; eyes = 0.35; }
    else if (a === 'eat') { headX = 0.45 + Math.sin(t * 16) * 0.12; }
    else if (a === 'sleep') { sy = 0.86 + Math.sin(t * 1.4) * 0.03; y = -(this.legH || 0.1) * 0.5; headX = 0.35; headY = 0.5; eyes = 0.08; }
    else if (a === 'sit') { y = -(this.legH || 0.1) * 0.4; }
    else if (a === 'work') { tilt = 0.3 + Math.sin(t * 9) * 0.08; headX = 0.2; }
    else if (a === 'wash') { roll = Math.sin(t * 12) * 0.12; eyes = 0.12; }
    rig.position.y = y;
    rig.scale.set(1 + squash * 0.5, sy * (1 - squash), 1 + squash * 0.5);
    rig.rotation.x = tilt; rig.rotation.z = roll;
    this.head.rotation.set(headX, headY, headZ);

    // Legs and arms.
    const sw = (this.human ? 0.75 : 0.6) * m;
    this.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * sw; });
    if (this.human) {
      const up = a === 'happy' ? -2.6 : a === 'work' ? -1.1 + Math.sin(t * 9) * 0.35 : a === 'wave' ? 0 : 0;
      this.wings[0].rotation.x = up + Math.sin(ph + Math.PI) * sw; this.wings[1].rotation.x = up + Math.sin(ph) * sw;
      this.wings[1].rotation.z = a === 'wave' ? 2.4 + Math.sin(t * 10) * 0.4 : 0.08;
      this.wings[0].rotation.z = -0.08;
    } else {
      const flap = a === 'happy' ? 0.9 + Math.sin(t * 20) * 0.5 : m * (0.25 + Math.sin(ph * 2) * 0.2);
      this.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * flap; });
    }
    if (this.ears.length) {
      const tw = Math.max(0, Math.sin(t * 1.3 + ph * 0.3) - 0.9) * 4;
      this.ears[0].rotation.x = tw - hop * 0.2 * m; this.ears[1].rotation.x = -hop * 0.2 * m;
    }
    if (this.tail) this.tail.rotation.y = Math.sin(t * (a === 'happy' ? 16 : 3) + ph) * (a === 'happy' ? 0.6 : 0.2);

    // Blinking.
    this.blink -= dt;
    if (this.blink < 0) this.blink = rand(1.8, 5);
    const lid = this.blink < 0.12 ? 0.1 : eyes;
    for (const e of this.eyes) e.scale.y = lerp(e.scale.y, lid, 0.5);
  }
}

// A small picture of an animal's face for cards and lists.
const portraits = {};
export function portrait(renderer, species, look) {
  const key = species + (look ? JSON.stringify(look) : '');
  if (portraits[key]) return portraits[key];
  const size = 192;
  const scene = new THREE.Scene();
  const c = new Critter(species, look);
  c.update(0.016, 0); c.update(0.016, 0.1);
  for (const e of c.eyes) e.scale.y = 1;
  c.head.rotation.set(0, 0, 0);
  c.root.rotation.y = 0.45;
  scene.add(c.root);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9b79a', 2.2));
  const d = new THREE.DirectionalLight('#fff4e0', 2.4);
  d.position.set(2, 3, 4);
  scene.add(d);
  const box = new THREE.Box3().setFromObject(c.root);
  const mid = box.getCenter(new THREE.Vector3()), ext = box.getSize(new THREE.Vector3());
  const half = Math.max(ext.x, ext.y) * 0.56;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
  cam.position.set(mid.x, mid.y + 0.25, 5);
  cam.lookAt(mid.x, mid.y, 0);
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  const prevColor = new THREE.Color();
  renderer.getClearColor(prevColor);
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  renderer.setRenderTarget(null);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = ((size - 1 - y) * size + x) * 4, o = (y * size + x) * 4;
    for (let k = 0; k < 3; k++) img.data[o + k] = Math.pow(clamp(px[s + k] / 255), 1 / 2.2) * 255;
    img.data[o + 3] = px[s + 3];
  }
  ctx.putImageData(img, 0, 0);
  return (portraits[key] = canvas.toDataURL());
}
