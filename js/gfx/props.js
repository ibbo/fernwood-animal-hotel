// Models made from simple coloured shapes: wild plants, everything the
// keeper can build, the lodge, the pier and the ferry.

import { THREE, Model, P, mat, MAT, canvasTexture } from './core.js';
import { rng, TAU } from '../util.js';

const BARK = '#8a5b3c', BARK2 = '#6f4630', STONE = '#b4aea3', STONE2 = '#8f8a82', WOOD = '#c0895a', WOOD2 = '#9a6842';
const CREAM = '#f6e9cd', ROOF = '#d9654a', WARM = '#ffc56a';
const PETALS = ['#ff7fa8', '#ffd24a', '#ffffff', '#b28cff', '#ff9a5a', '#7fc8ff'];

// ---------------------------------------------------------------- wild things
function oak(m, v, leafA = '#3f9b4a', leafB = '#93d95e') {
  const r = rng(v * 9999 + 1), h = 0.75 + r() * 0.35;
  m.solid.add(P.taper(7, 0.62), BARK, mat(0, h / 2, 0, [0.17, h, 0.17]), { top: BARK2 });
  const n = 3 + r.int(0, 1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.8, d = i === 0 ? 0 : 0.33 + r() * 0.12, s = i === 0 ? 0.72 : 0.46 + r() * 0.16;
    m.leaf.add(P.ball(), leafA, mat(Math.cos(a) * d, h + 0.42 + (i === 0 ? 0.28 : r() * 0.2), Math.sin(a) * d, [s, s * 0.86, s], 0, r() * 3), { top: leafB, flat: true, sway: 0.7 });
  }
}
function pine(m, v, snowy) {
  const r = rng(v * 9999 + 2), s = 0.85 + r() * 0.4;
  m.solid.add(P.cyl(6), BARK2, mat(0, 0.25 * s, 0, [0.1 * s, 0.5 * s, 0.1 * s]));
  for (let i = 0; i < 3; i++) {
    const w = (0.62 - i * 0.15) * s, y = (0.45 + i * 0.5) * s;
    m.leaf.add(P.cone(7), i === 2 && snowy ? '#e8f2f6' : '#2c7a58', mat(0, y + 0.35 * s, 0, [w, 0.8 * s, w], 0, i * 0.5), { top: snowy ? '#f6fbff' : '#57b074', flat: true, sway: 0.35 });
  }
}
function willow(m, v) {
  const r = rng(v * 9999 + 3);
  m.solid.add(P.taper(7, 0.55), '#8b6a4a', mat(0.05, 0.55, 0, [0.2, 1.1, 0.2], 0, 0, -0.08), { top: '#6d5038' });
  m.leaf.add(P.ball(), '#6fb352', mat(0, 1.5, 0, [0.95, 0.6, 0.95]), { top: '#c2e27a', flat: true, sway: 0.5 });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + r() * 0.3, d = 0.78 + r() * 0.1, len = 0.7 + r() * 0.45;
    m.leaf.add(P.box(), '#a6d566', mat(Math.cos(a) * d, 1.45 - len / 2, Math.sin(a) * d, [0.09, len, 0.09], 0, a), { top: '#7fbd55', sway: 1.5 });
  }
}
function palm(m, v) {
  const r = rng(v * 9999 + 4), lean = (r() - 0.5) * 0.5, dir = r() * TAU;
  let x = 0, z = 0, y = 0;
  for (let i = 0; i < 4; i++) {
    const t = lean * (i + 1) * 0.5;
    m.solid.add(P.taper(6, 0.85), i % 2 ? '#b08d62' : '#c29f72', mat(x, y + 0.22, z, [0.12 - i * 0.012, 0.46, 0.12 - i * 0.012], Math.sin(dir) * t, 0, Math.cos(dir) * -t));
    x += Math.cos(dir) * t * 0.42; z += Math.sin(dir) * t * 0.42; y += 0.42;
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + r() * 0.3;
    m.leaf.add(P.sphere(), '#3ea35c', mat(x + Math.cos(a) * 0.42, y - 0.02, z + Math.sin(a) * 0.42, [0.52, 0.045, 0.16], 0, -a, -0.42), { top: '#8fd86a', sway: 0.6 });
  }
  m.solid.add(P.sphere(), '#7a5334', mat(x + 0.1, y - 0.1, z, 0.085));
  m.solid.add(P.sphere(), '#7a5334', mat(x - 0.07, y - 0.12, z + 0.08, 0.08));
}
function rock(m, v, snowy) {
  const r = rng(v * 9999 + 5);
  const n = 2 + r.int(0, 1);
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? 0.5 + r() * 0.15 : 0.22 + r() * 0.16, a = r() * TAU, d = i === 0 ? 0 : 0.45;
    m.solid.add(P.ball(), i === 0 ? STONE2 : '#a09b92', mat(Math.cos(a) * d, s * 0.55, Math.sin(a) * d, [s, s * 0.8, s * 0.9], r(), r() * 6, r()), { top: snowy ? '#f3f8ff' : '#c9c4b6', flat: true });
  }
}
function flowers(m, v, dense) {
  const r = rng(v * 9999 + 6), n = dense ? 11 : 6;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * (dense ? 0.6 : 0.68), x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.16 + r() * 0.16;
    m.leaf.add(P.cyl(5), '#4f9e48', mat(x, h / 2, z, [0.018, h, 0.018]), { sway: 1.2 });
    const col = PETALS[r.int(0, PETALS.length - 1)];
    m.leaf.add(P.ball(), col, mat(x, h + 0.03, z, [0.075, 0.05, 0.075]), { sway: 1.2, flat: true });
    m.leaf.add(P.sphere(), '#ffe27a', mat(x, h + 0.065, z, 0.028), { sway: 1.2 });
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * TAU, d = r() * 0.7;
    m.leaf.add(P.cone(4), '#6cbd4f', mat(Math.cos(a) * d, 0.09, Math.sin(a) * d, [0.05, 0.2, 0.05]), { top: '#a9e06c', sway: 1.4 });
  }
}
function reeds(m, v) {
  const r = rng(v * 9999 + 7);
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, d = r() * 0.6, h = 0.55 + r() * 0.55, x = Math.cos(a) * d, z = Math.sin(a) * d;
    m.leaf.add(P.cyl(5), '#5f9f58', mat(x, h / 2, z, [0.022, h, 0.022], 0, 0, (r() - 0.5) * 0.2), { top: '#a8cf74', sway: 1 });
    if (i % 2 === 0) m.leaf.add(P.cyl(6), '#7a4f31', mat(x, h + 0.02, z, [0.045, 0.2, 0.045]), { sway: 1 });
  }
}
function shrooms(m, v, glowing) {
  const r = rng(v * 9999 + 8), n = glowing ? 7 : 3;
  for (let i = 0; i < n; i++) {
    const a = glowing ? (i / n) * TAU : r() * TAU, d = glowing ? 0.55 : 0.15 + r() * 0.35, s = glowing ? 0.75 + r() * 0.5 : 0.8 + r() * 0.8;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    m.solid.add(P.taper(6, 0.7), '#f5ecdc', mat(x, 0.09 * s, z, [0.05 * s, 0.18 * s, 0.05 * s]));
    (glowing ? m.glow : m.solid).add(P.dome(), glowing ? '#6fe6d2' : '#e2553f', mat(x, 0.17 * s, z, [0.15 * s, 0.11 * s, 0.15 * s]), glowing ? {} : { top: '#f08a5c' });
    if (!glowing) for (let k = 0; k < 3; k++) m.solid.add(P.sphere(), '#fff7ea', mat(x + Math.cos(k * 2.1) * 0.08 * s, 0.235 * s, z + Math.sin(k * 2.1) * 0.08 * s, 0.022 * s));
  }
}

export function addNatural(m, type, v, biome) {
  const snowy = biome === 'snow';
  if (type === 'oak') oak(m, v);
  else if (type === 'pine') pine(m, v, snowy || (biome === 'rock' && v > 0.5));
  else if (type === 'willow') willow(m, v);
  else if (type === 'palm') palm(m, v);
  else if (type === 'rock') rock(m, v, snowy);
  else if (type === 'flowers') flowers(m, v);
  else if (type === 'reeds') reeds(m, v);
  else if (type === 'shroom') shrooms(m, v);
}

// ---------------------------------------------------------------- shared bits
export function gable(g, cx, y0, cz, w, d, h, roofCol, endCol, over = 0.12) {
  // Ridge runs along x. w = length along x, d = depth along z, h = roof height.
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, yr = y0 + h;
  const ox0 = x0 - over, ox1 = x1 + over, oz0 = z0 - over * 1.4, oz1 = z1 + over * 1.4, ye = y0 - (over * 1.4 * h) / (d / 2);
  g.quad([ox0, ye, oz1], [ox1, ye, oz1], [ox1, yr, cz], [ox0, yr, cz], roofCol, [0, 1, 1]);
  g.quad([ox0, ye, oz0], [ox1, ye, oz0], [ox1, yr, cz], [ox0, yr, cz], roofCol, [0, 1, -1]);
  // The underside, so the overhang looks solid from below.
  g.quad([ox0, ye - 0.05, oz1], [ox1, ye - 0.05, oz1], [ox1, yr - 0.06, cz], [ox0, yr - 0.06, cz], endCol, [0, -1, -1]);
  g.quad([ox0, ye - 0.05, oz0], [ox1, ye - 0.05, oz0], [ox1, yr - 0.06, cz], [ox0, yr - 0.06, cz], endCol, [0, -1, 1]);
  g.tri([x0, y0, z0], [x0, y0, z1], [x0, yr - 0.03, cz], endCol, [-1, 0, 0]);
  g.tri([x1, y0, z0], [x1, y0, z1], [x1, yr - 0.03, cz], endCol, [1, 0, 0]);
}
// Same roof turned so the ridge runs along z (front-facing gable).
export function gableZ(g, cx, y0, cz, w, d, h, roofCol, endCol, over = 0.1) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, yr = y0 + h;
  const ox0 = x0 - over * 1.4, ox1 = x1 + over * 1.4, oz0 = z0 - over, oz1 = z1 + over, ye = y0 - (over * 1.4 * h) / (w / 2);
  g.quad([ox1, ye, oz0], [ox1, ye, oz1], [cx, yr, oz1], [cx, yr, oz0], roofCol, [1, 1, 0]);
  g.quad([ox0, ye, oz0], [ox0, ye, oz1], [cx, yr, oz1], [cx, yr, oz0], roofCol, [-1, 1, 0]);
  g.tri([x0, y0, z1], [x1, y0, z1], [cx, yr - 0.03, z1], endCol, [0, 0, 1]);
  g.tri([x0, y0, z0], [x1, y0, z0], [cx, yr - 0.03, z0], endCol, [0, 0, -1]);
}
function roundWindow(m, x, y, z, r = 0.12, frame = WOOD2) {
  m.solid.add(P.cyl(12), frame, mat(x, y, z - 0.012, [r * 1.25, 0.03, r * 1.25], Math.PI / 2));
  m.glow.add(P.cyl(12), WARM, mat(x, y, z, [r, 0.035, r], Math.PI / 2));
}
export function door(m, x, y, z, w = 0.26, h = 0.42, col = '#a8623c') {
  m.solid.add(P.box(), col, mat(x, y + h / 2, z, [w, h, 0.05]));
  m.solid.add(P.cyl(12), col, mat(x, y + h, z, [w / 2, 0.05, w / 2], Math.PI / 2));
  m.solid.add(P.sphere(), '#f2c14e', mat(x + w * 0.28, y + h * 0.5, z + 0.035, 0.025));
}

// ---------------------------------------------------------------- things to build
const MODELS = {
  burrow(m) {
    m.solid.add(P.dome(), '#6fb64f', mat(0, 0, 0, [0.82, 0.74, 0.8]), { top: '#a5dd66' });
    m.solid.add(P.cyl(14), '#e9d9b8', mat(0, 0.3, 0.6, [0.36, 0.3, 0.36], Math.PI / 2));
    door(m, 0, 0.02, 0.76, 0.3, 0.34);
    roundWindow(m, 0.42, 0.42, 0.56, 0.09);
    m.solid.add(P.cyl(8), STONE2, mat(-0.3, 0.72, -0.1, [0.07, 0.3, 0.07]));
    m.solid.add(P.cyl(8), '#6d6861', mat(-0.3, 0.88, -0.1, [0.1, 0.04, 0.1]));
    for (let i = 0; i < 5; i++) m.leaf.add(P.ball(), PETALS[i % 4], mat(Math.cos(i * 1.9) * 0.45, 0.6 - Math.abs(Math.cos(i * 1.9)) * 0.14, Math.sin(i * 1.9) * 0.35 - 0.1, 0.05), { flat: true });
    for (let i = 0; i < 6; i++) m.solid.add(P.ball(), STONE, mat(Math.cos(i * 0.5 + 0.35) * 0.5, 0.05, 0.6 + Math.sin(i * 0.5 + 0.35) * 0.32, 0.07), { flat: true });
  },
  nook(m) {
    m.solid.add(P.taper(8, 0.7), BARK, mat(0, 0.6, 0, [0.3, 1.2, 0.3]), { top: BARK2 });
    m.solid.add(P.cyl(10), WOOD2, mat(0, 1.02, 0.12, [0.62, 0.06, 0.62]));
    m.solid.add(P.box(), CREAM, mat(0, 1.32, 0.14, [0.72, 0.54, 0.62]));
    gableZ(m.solid, 0, 1.59, 0.14, 0.72, 0.62, 0.38, '#e0694a', CREAM, 0.1);
    door(m, -0.14, 1.06, 0.46, 0.18, 0.26, '#7c9a4e');
    roundWindow(m, 0.18, 1.36, 0.455, 0.085);
    for (let i = 0; i < 5; i++) m.solid.add(P.box(), WOOD, mat(-0.48, 0.14 + i * 0.2, 0.3, [0.22, 0.03, 0.04]));
    m.solid.add(P.box(), WOOD2, mat(-0.58, 0.55, 0.3, [0.03, 1.1, 0.03]));
    m.solid.add(P.box(), WOOD2, mat(-0.38, 0.55, 0.3, [0.03, 1.1, 0.03]));
    const pts = [[-0.55, 1.75, -0.3, 0.55], [0.55, 1.7, -0.25, 0.5], [0, 2.05, -0.35, 0.62], [-0.2, 1.6, -0.6, 0.45], [0.6, 1.3, -0.1, 0.3]];
    for (const [x, y, z, s] of pts) m.leaf.add(P.ball(), '#3f9b4a', mat(x, y, z, [s, s * 0.85, s], 0, x * 3), { top: '#93d95e', flat: true, sway: 0.4 });
  },
  den(m) {
    m.solid.add(P.ball(), '#d8b384', mat(0, 0, -0.05, [0.74, 0.72, 0.7], 0, 0.4), { top: '#f0d7a6', flat: true });
    m.solid.add(P.cyl(12), '#5a4636', mat(0, 0.2, 0.56, [0.24, 0.16, 0.26], Math.PI / 2));
    m.solid.add(P.torus(), '#c39a6b', mat(0, 0.2, 0.62, [0.27, 0.3, 0.3]));
    m.solid.add(P.cyl(8), '#e9c58e', mat(0.5, 0.05, 0.55, [0.34, 0.09, 0.26]), { flat: true });
    m.solid.add(P.cyl(6), WOOD2, mat(-0.5, 0.6, 0.2, [0.02, 1.2, 0.02]));
    m.solid.tri([-0.5, 1.2, 0.2], [-0.5, 0.98, 0.2], [-0.2, 1.09, 0.2], '#ff9a3c', [0, 0, 1]);
    m.solid.tri([-0.5, 1.2, 0.2], [-0.5, 0.98, 0.2], [-0.2, 1.09, 0.2], '#ff9a3c', [0, 0, -1]);
    roundWindow(m, 0.38, 0.45, 0.5, 0.07, '#c39a6b');
  },
  lodge(m) {
    m.solid.add(P.cyl(10), '#c79b68', mat(-0.12, 0.3, -0.1, [0.52, 0.6, 0.52]), { top: '#dab480' });
    m.solid.add(P.cone(10), '#d9b85c', mat(-0.12, 0.92, -0.1, [0.74, 0.7, 0.74]), { top: '#f3df8e', flat: true });
    door(m, -0.12, 0.02, 0.42, 0.22, 0.3, '#7a5a3e');
    roundWindow(m, 0.2, 0.36, 0.36, 0.075);
    m.solid.add(P.cyl(12), '#d9cdb7', mat(0.52, 0.04, 0.42, [0.38, 0.08, 0.3]));
    m.solid.add(P.cyl(12), '#63c6ea', mat(0.52, 0.065, 0.42, [0.32, 0.05, 0.25]));
    m.leaf.add(P.cyl(8), '#58b25a', mat(0.6, 0.095, 0.38, [0.09, 0.01, 0.09]));
  },
  cabin(m) {
    m.solid.add(P.box(), STONE, mat(0, 0.06, 0, [1.3, 0.12, 1.0]));
    for (let i = 0; i < 5; i++) m.solid.add(P.box(), i % 2 ? '#a8754a' : '#b88355', mat(0, 0.2 + i * 0.14, -0.05, [1.16, 0.14, 0.82]));
    gable(m.solid, 0, 0.83, -0.05, 1.16, 0.82, 0.52, '#3e8f8f', '#b88355', 0.12);
    door(m, -0.22, 0.12, 0.37, 0.22, 0.34, '#6f4630');
    roundWindow(m, 0.28, 0.48, 0.37, 0.1);
    roundWindow(m, 0, 1.05, 0.36, 0.07);
    m.solid.add(P.box(), STONE2, mat(0.38, 1.15, -0.2, [0.16, 0.5, 0.16]));
    m.solid.add(P.box(), WOOD, mat(0, 0.14, 0.52, [1.1, 0.05, 0.26]));
    m.solid.add(P.cyl(6), WOOD2, mat(-0.5, 0.4, 0.6, [0.03, 0.55, 0.03]));
    m.solid.add(P.cyl(6), WOOD2, mat(0.5, 0.4, 0.6, [0.03, 0.55, 0.03]));
    m.glow.add(P.sphere(), WARM, mat(0.5, 0.72, 0.6, 0.06));
    m.glow.add(P.sphere(), WARM, mat(-0.5, 0.72, 0.6, 0.06));
  },
  berrybush(m, f) {
    for (const [x, y, z, s] of [[0, 0.3, 0, 0.42], [-0.3, 0.22, 0.12, 0.3], [0.3, 0.24, -0.08, 0.32], [0.05, 0.2, 0.3, 0.26]]) m.leaf.add(P.ball(), '#3d9950', mat(x, y, z, [s, s * 0.82, s], 0, x * 5), { top: '#7fcf62', flat: true, sway: 0.4 });
    const r = rng(11);
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, e = r() * 1.1 + 0.2;
      f.add(P.sphere(), i % 3 ? '#5b5fd6' : '#8b6fe8', mat(Math.cos(a) * Math.sin(e) * 0.46, 0.27 + Math.cos(e) * 0.36, Math.sin(a) * Math.sin(e) * 0.46 + 0.05, 0.06));
    }
  },
  carrots(m, f) {
    m.solid.add(P.cyl(6), '#8a6143', mat(0, 0.04, 0, [0.78, 0.1, 0.78], 0, Math.PI / 6), { top: '#a57650', flat: true });
    let i = 0;
    for (const [x, z] of [[-0.35, -0.2], [0.05, -0.32], [0.38, -0.1], [-0.2, 0.22], [0.2, 0.28], [0.0, 0.0]]) {
      m.solid.add(P.box(), '#74513a', mat(x, 0.1, z, [0.22, 0.05, 0.22], 0, i));
      for (let k = 0; k < 3; k++) m.leaf.add(P.cone(4), '#4fa64c', mat(x + Math.cos(k * 2.1) * 0.04, 0.2, z + Math.sin(k * 2.1) * 0.04, [0.035, 0.2, 0.035], Math.sin(k * 2.1) * 0.35, 0, Math.cos(k * 2.1) * -0.35), { top: '#9fe068', sway: 0.8 });
      f.add(P.cone(7), '#ff8a2e', mat(x, 0.13, z, [0.07, 0.14, 0.07], Math.PI));
      f.add(P.cone(5), '#58b84f', mat(x, 0.3, z, [0.07, 0.24, 0.07]));
      i++;
    }
  },
  appletree(m, f) {
    oak(m, 0.37, '#4aa24c', '#a2e065');
    const r = rng(5);
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, e = 0.5 + r() * 1.3;
      f.add(P.sphere(), i % 4 ? '#e8463c' : '#f2a03a', mat(Math.cos(a) * Math.sin(e) * 0.66, 1.42 + Math.cos(e) * 0.5, Math.sin(a) * Math.sin(e) * 0.66, 0.085));
    }
  },
  hive(m, f) {
    m.solid.add(P.box(), WOOD, mat(0, 0.3, 0, [0.6, 0.05, 0.5]));
    for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) m.solid.add(P.box(), WOOD2, mat(x, 0.15, z, [0.05, 0.3, 0.05]));
    for (let i = 0; i < 4; i++) m.solid.add(P.sphere(), i % 2 ? '#f0b53a' : '#f7c94f', mat(0, 0.42 + i * 0.13, 0, [0.3 - i * 0.045, 0.1, 0.3 - i * 0.045]));
    m.solid.add(P.sphere(), '#5a3d22', mat(0, 0.45, 0.27, [0.07, 0.06, 0.04]));
    f.add(P.cyl(10), '#f2a81f', mat(0.5, 0.11, 0.3, [0.11, 0.2, 0.11]));
    f.add(P.cyl(10), '#f7e7c4', mat(0.5, 0.225, 0.3, [0.12, 0.035, 0.12]));
    f.add(P.sphere(), '#ffcf4a', mat(-0.42, 0.1, 0.34, [0.1, 0.07, 0.1]));
  },
  bamboo(m, f) {
    const r = rng(3);
    for (let i = 0; i < 8; i++) {
      const a = r() * TAU, d = r() * 0.5, h = 1.1 + r() * 0.9, x = Math.cos(a) * d, z = Math.sin(a) * d;
      for (let k = 0; k < 4; k++) m.leaf.add(P.cyl(6), k % 2 ? '#7cc45a' : '#8fd168', mat(x, (h / 4) * (k + 0.5), z, [0.045, h / 4 - 0.015, 0.045]), { sway: 0.35 });
      for (let k = 0; k < 3; k++) m.leaf.add(P.sphere(), '#5bb14e', mat(x + Math.cos(k * 2.3 + i) * 0.16, h * (0.6 + k * 0.17), z + Math.sin(k * 2.3 + i) * 0.16, [0.2, 0.025, 0.06], 0, -(k * 2.3 + i), -0.3), { top: '#a5e36e', sway: 0.5 });
    }
    for (let i = 0; i < 3; i++) f.add(P.cyl(6), '#b9e37a', mat(0.55, 0.06 + i * 0.01, 0.35 + i * 0.09, [0.04, 0.6, 0.04], Math.PI / 2, 0, 0.4));
  },
  fishspot(m, f) {
    m.solid.add(P.taper(10, 0.8), '#5f8fb0', mat(0.3, 0.14, 0.15, [0.17, 0.28, 0.17], Math.PI), { top: '#86b6d2' });
    m.solid.add(P.cyl(6), WOOD2, mat(-0.2, 0.3, 0.1, [0.035, 0.6, 0.035]));
    m.solid.add(P.cyl(5), '#d9b06c', mat(-0.2, 0.75, 0.55, [0.015, 1.25, 0.015], 0.95));
    m.solid.add(P.cyl(4), '#f4f4f4', mat(-0.2, 0.55, 1.07, [0.004, 1.15, 0.004]));
    m.solid.add(P.sphere(), '#e8463c', mat(-0.2, -0.02, 1.07, 0.05));
    f.add(P.sphere(), '#8fd0e6', mat(0.3, 0.3, 0.15, [0.05, 0.13, 0.09], 0.4));
    f.add(P.cone(4), '#6fb7d3', mat(0.3, 0.45, 0.19, [0.05, 0.08, 0.02]));
    f.add(P.sphere(), '#a6dbe9', mat(0.36, 0.28, 0.1, [0.045, 0.11, 0.08], -0.4, 1));
  },
  sapling(m) {
    m.solid.add(P.taper(7, 0.7), '#9a6a48', mat(0, 0.45, 0, [0.11, 0.9, 0.11]));
    m.leaf.add(P.blob(), '#5cba6a', mat(0, 1.35, 0, [0.68, 0.66, 0.68]), { top: '#b6ec78', flat: true, sway: 0.5 });
    m.leaf.add(P.ball(), '#ffb3cf', mat(0.42, 1.55, 0.3, 0.08), { flat: true, sway: 0.5 });
    m.leaf.add(P.ball(), '#ffb3cf', mat(-0.38, 1.3, 0.42, 0.07), { flat: true, sway: 0.5 });
    m.leaf.add(P.ball(), '#ffb3cf', mat(0.1, 1.85, 0.36, 0.07), { flat: true, sway: 0.5 });
  },
  flowerbed(m) {
    flowers(m, 0.61, true);
    flowers(m, 0.23, true);
    for (let i = 0; i < 10; i++) m.solid.add(P.ball(), i % 2 ? STONE : '#cfc8ba', mat(Math.cos((i / 10) * TAU) * 0.76, 0.04, Math.sin((i / 10) * TAU) * 0.76, [0.1, 0.07, 0.1]), { flat: true });
  },
  lantern(m) {
    m.solid.add(P.cyl(8), STONE2, mat(0, 0.05, 0, [0.14, 0.1, 0.14]));
    m.solid.add(P.cyl(6), '#5c4433', mat(0, 0.55, 0, [0.04, 1.0, 0.04]));
    m.solid.add(P.box(), '#5c4433', mat(0.14, 1.02, 0, [0.34, 0.04, 0.04]));
    m.solid.add(P.cone(6), '#c8493a', mat(0.28, 0.93, 0, [0.14, 0.1, 0.14]));
    m.glow.add(P.cyl(6), '#ffbe5c', mat(0.28, 0.78, 0, [0.095, 0.2, 0.095]));
    m.solid.add(P.cyl(6), '#5c4433', mat(0.28, 0.67, 0, [0.11, 0.03, 0.11]));
  },
  ball(m) {
    m.solid.add(P.sphere(), '#ff5d5d', mat(0, 0.3, 0, 0.3));
    m.solid.add(P.torus(), '#ffffff', mat(0, 0.3, 0, [0.285, 0.285, 0.2], Math.PI / 2, 0, 0.5));
    m.solid.add(P.sphere(), '#ffd24a', mat(0, 0.3, 0, [0.12, 0.305, 0.12], 0, 0, 0.5));
    m.solid.add(P.sphere(), '#4aa8ff', mat(0.45, 0.14, 0.3, 0.14));
    m.solid.add(P.sphere(), '#7fd858', mat(-0.4, 0.11, 0.38, 0.11));
  },
  pond(m) {
    m.solid.add(P.cyl(14), '#63c6ea', mat(0, 0.035, 0, [0.72, 0.05, 0.66]), { top: '#8fdcf4' });
    for (let i = 0; i < 13; i++) { const a = (i / 13) * TAU; m.solid.add(P.ball(), i % 3 ? STONE : '#d6d0c4', mat(Math.cos(a) * 0.76, 0.05, Math.sin(a) * 0.7, [0.13, 0.085, 0.11], 0, a), { flat: true }); }
    for (const [x, z, s] of [[0.2, 0.15, 0.17], [-0.28, -0.1, 0.14], [0.05, -0.35, 0.11]]) m.leaf.add(P.cyl(9), '#4fae52', mat(x, 0.068, z, [s, 0.012, s]));
    m.leaf.add(P.ball(), '#ffb1d0', mat(0.2, 0.11, 0.15, [0.07, 0.05, 0.07]), { flat: true });
    for (let i = 0; i < 4; i++) m.leaf.add(P.cyl(5), '#5f9f58', mat(-0.6 + i * 0.05, 0.3, 0.3 + i * 0.07, [0.018, 0.5 + i * 0.06, 0.018]), { sway: 1 });
  },
  sunstone(m) {
    m.solid.add(P.cyl(7), '#e2b06c', mat(0, 0.09, 0, [0.68, 0.18, 0.56], 0, 0.3), { top: '#f6d594', flat: true });
    m.solid.add(P.cyl(7), '#e9bd7c', mat(0.12, 0.25, -0.06, [0.44, 0.14, 0.38], 0, 1), { top: '#fbe0a6', flat: true });
    m.solid.add(P.ball(), '#d9a35e', mat(-0.55, 0.12, 0.35, [0.18, 0.13, 0.16]), { flat: true });
  },
  swing(m) {
    for (const s of [-1, 1]) {
      m.solid.add(P.cyl(6), WOOD2, mat(s * 0.62, 0.62, 0.2, [0.04, 1.3, 0.04], 0.3));
      m.solid.add(P.cyl(6), WOOD2, mat(s * 0.62, 0.62, -0.2, [0.04, 1.3, 0.04], -0.3));
    }
    m.solid.add(P.cyl(6), WOOD, mat(0, 1.22, 0, [0.045, 1.4, 0.045], 0, 0, Math.PI / 2));
    m.solid.add(P.cyl(4), '#e8dcc0', mat(-0.13, 0.82, 0, [0.012, 0.8, 0.012]));
    m.solid.add(P.cyl(4), '#e8dcc0', mat(0.13, 0.82, 0, [0.012, 0.8, 0.012]));
    m.solid.add(P.torus(), '#3d3b40', mat(0, 0.36, 0, [0.2, 0.2, 0.26], 0, Math.PI / 2));
  },
  fountain(m) {
    m.solid.add(P.cyl(12), STONE, mat(0, 0.11, 0, [0.76, 0.22, 0.76]), { top: '#d6d0c4' });
    m.solid.add(P.cyl(12), '#63c6ea', mat(0, 0.2, 0, [0.66, 0.06, 0.66]));
    m.solid.add(P.taper(8, 0.6), STONE, mat(0, 0.45, 0, [0.14, 0.6, 0.14]));
    m.solid.add(P.taper(12, 0.45), '#d6d0c4', mat(0, 0.76, 0, [0.36, 0.12, 0.36], Math.PI));
    m.solid.add(P.cyl(12), '#8fdcf4', mat(0, 0.815, 0, [0.31, 0.02, 0.31]));
    m.glow.add(P.sphere(), '#bfeeff', mat(0, 0.95, 0, [0.07, 0.16, 0.07]));
    for (let i = 0; i < 6; i++) m.glow.add(P.sphere(), '#bfeeff', mat(Math.cos(i * 1.05) * 0.34, 0.6, Math.sin(i * 1.05) * 0.34, [0.025, 0.2, 0.025]));
  },
  mushrooms(m) { shrooms(m, 0.4, true); },
  bench(m) {
    for (const x of [-0.42, 0.42]) {
      m.solid.add(P.box(), '#4a4f58', mat(x, 0.14, 0, [0.05, 0.28, 0.34]));
      m.solid.add(P.box(), '#4a4f58', mat(x, 0.42, -0.17, [0.05, 0.34, 0.05]));
    }
    for (let i = 0; i < 3; i++) m.solid.add(P.box(), i % 2 ? WOOD : '#d1a274', mat(0, 0.29, -0.12 + i * 0.12, [1.0, 0.04, 0.1]));
    for (let i = 0; i < 2; i++) m.solid.add(P.box(), WOOD, mat(0, 0.44 + i * 0.13, -0.19, [1.0, 0.09, 0.04]));
    m.leaf.add(P.ball(), '#3d9950', mat(0.72, 0.16, -0.1, [0.2, 0.18, 0.2]), { top: '#86d463', flat: true, sway: 0.3 });
  },
  gaslamp(m) {
    m.solid.add(P.cyl(8), '#4a4f58', mat(0, 0.07, 0, [0.13, 0.14, 0.13]));
    m.solid.add(P.cyl(6), '#4a4f58', mat(0, 0.85, 0, [0.04, 1.6, 0.04]));
    m.solid.add(P.box(), '#4a4f58', mat(0, 1.6, 0, [0.62, 0.04, 0.04]));
    for (const x of [-0.3, 0.3]) {
      m.glow.add(P.sphere(), '#ffd58a', mat(x, 1.48, 0, 0.11));
      m.solid.add(P.cone(6), '#4a4f58', mat(x, 1.62, 0, [0.14, 0.08, 0.14]));
    }
    m.solid.add(P.sphere(), '#4a4f58', mat(0, 1.68, 0, 0.05));
  },
  birdbath(m) {
    m.solid.add(P.cyl(10), STONE, mat(0, 0.05, 0, [0.3, 0.1, 0.3]));
    m.solid.add(P.taper(8, 0.6), STONE, mat(0, 0.34, 0, [0.12, 0.5, 0.12]));
    m.solid.add(P.taper(12, 0.5), '#d6d0c4', mat(0, 0.64, 0, [0.42, 0.12, 0.42], Math.PI));
    m.solid.add(P.cyl(12), '#8fdcf4', mat(0, 0.695, 0, [0.36, 0.02, 0.36]));
    m.solid.add(P.sphere(), '#7fc8ff', mat(0.2, 0.76, 0.05, [0.07, 0.06, 0.09]));
    m.solid.add(P.cone(4), '#f2a03a', mat(0.2, 0.77, 0.15, [0.02, 0.05, 0.02], Math.PI / 2));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      m.leaf.add(P.ball(), '#ffffff', mat(Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55, [0.07, 0.05, 0.07]), { flat: true, sway: 1 });
      m.leaf.add(P.sphere(), '#ffe27a', mat(Math.cos(a) * 0.55, 0.16, Math.sin(a) * 0.55, 0.028), { sway: 1 });
    }
  },
  kite(m) {
    m.solid.add(P.cyl(6), WOOD2, mat(0, 0.4, 0, [0.04, 0.8, 0.04]));
    m.leaf.add(P.cyl(4), '#fffaf0', mat(0.28, 1.25, 0, [0.006, 1.2, 0.006], 0, 0, -0.5), { sway: 0.5 });
    for (const hint of [[0, 0, 1], [0, 0, -1]]) {
      m.leaf.tri([0.6, 2.3, 0], [0.35, 1.95, 0], [0.6, 1.5, 0], '#e8553f', hint);
      m.leaf.tri([0.6, 2.3, 0], [0.85, 1.95, 0], [0.6, 1.5, 0], '#f2b632', hint);
    }
    for (let i = 0; i < 3; i++) m.leaf.add(P.ball(), ['#3f9ad6', '#4f9d5d', '#b28cff'][i], mat(0.6 + i * 0.07, 1.36 - i * 0.14, 0, 0.045), { flat: true, sway: 0.9 });
  },
  flowercart(m) {
    m.solid.add(P.box(), '#3e8f8f', mat(0, 0.36, 0, [1.0, 0.22, 0.56]));
    m.solid.add(P.box(), WOOD, mat(0, 0.49, 0, [0.94, 0.04, 0.5]));
    for (const z of [-0.31, 0.31]) m.solid.add(P.torus(), '#5c4433', mat(-0.22, 0.2, z, [0.19, 0.19, 0.12]));
    m.solid.add(P.box(), WOOD2, mat(0.72, 0.4, 0, [0.5, 0.04, 0.04]));
    m.solid.add(P.box(), WOOD2, mat(0.42, 0.18, 0, [0.05, 0.36, 0.05]));
    const r = rng(21);
    for (let i = 0; i < 16; i++) {
      const x = -0.4 + r() * 0.8, z = -0.2 + r() * 0.4, h = 0.56 + r() * 0.16;
      m.leaf.add(P.ball(), '#4f9e48', mat(x, h - 0.04, z, 0.07), { flat: true, sway: 0.3 });
      m.leaf.add(P.ball(), PETALS[i % PETALS.length], mat(x, h + 0.03, z, [0.075, 0.06, 0.075]), { flat: true, sway: 0.3 });
    }
    for (const x of [-0.46, 0.46]) m.solid.add(P.cyl(5), WOOD2, mat(x, 0.84, 0, [0.02, 0.72, 0.02]));
    for (let i = 0; i < 5; i++) m.solid.add(P.box(), i % 2 ? '#fff6e6' : '#ff9ab8', mat(-0.4 + i * 0.2, 1.2, 0, [0.2, 0.03, 0.66]));
  },
  bandstand(m) {
    m.solid.add(P.cyl(8), STONE, mat(0, 0.1, 0, [0.84, 0.2, 0.84]), { top: '#d6d0c4' });
    m.solid.add(P.cyl(8), WOOD, mat(0, 0.215, 0, [0.76, 0.03, 0.76]));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16, x = Math.cos(a) * 0.7, z = Math.sin(a) * 0.7;
      m.solid.add(P.cyl(6), '#fffaf0', mat(x, 0.72, z, [0.03, 1.0, 0.03]));
      m.glow.add(P.sphere(), i % 2 ? '#ffd58a' : '#ff9ab8', mat(x * 1.04, 1.16, z * 1.04, 0.045));
      if (i !== 1 && i !== 2) m.solid.add(P.box(), '#fffaf0', mat(Math.cos(a + TAU / 16) * 0.66, 0.42, Math.sin(a + TAU / 16) * 0.66, [0.5, 0.03, 0.03], 0, -(a + TAU / 16) + Math.PI / 2));
    }
    m.solid.add(P.cone(8), '#c9553c', mat(0, 1.5, 0, [0.95, 0.56, 0.95]), { top: '#e98a6a' });
    m.solid.add(P.sphere(), '#f2c14e', mat(0, 1.82, 0, 0.07));
    m.solid.add(P.box(), WOOD2, mat(0.1, 0.38, -0.1, [0.16, 0.3, 0.16]));
    m.solid.add(P.torus(), '#f2c14e', mat(0.1, 0.62, -0.1, [0.1, 0.1, 0.1], Math.PI / 2));
  },
};

// A build as a Group. Snack plants get `userData.fruit`, shown when ripe.
export function buildModel(type) {
  const m = new Model(), f = new Model();
  MODELS[type](m, f.solid);
  const g = m.group();
  if (!f.solid.empty) { g.userData.fruit = f.group(); g.add(g.userData.fruit); }
  return g;
}

// ---------------------------------------------------------------- the lodge
export function lodgeModel() {
  const m = new Model();
  const s = m.solid;
  s.add(P.box(), STONE, mat(0, 0.12, 0, [4.5, 0.24, 2.3]), { top: '#cfc8ba' });
  s.add(P.box(), CREAM, mat(0, 0.92, -0.1, [4.1, 1.4, 1.8]));
  for (const x of [-2.05, -0.72, 0.72, 2.05]) s.add(P.box(), WOOD2, mat(x, 0.92, 0.81, [0.1, 1.4, 0.06]));
  s.add(P.box(), WOOD2, mat(0, 0.95, 0.81, [4.2, 0.08, 0.06]));
  s.add(P.box(), WOOD2, mat(0, 1.6, 0.81, [4.2, 0.1, 0.06]));
  gable(s, 0, 1.6, -0.1, 4.1, 1.8, 1.05, ROOF, CREAM, 0.2);
  // The front porch tower with its own little roof.
  s.add(P.box(), CREAM, mat(0, 1.25, 0.75, [1.3, 2.05, 0.9]));
  gableZ(s, 0, 2.27, 0.75, 1.3, 0.9, 0.7, '#c9553c', CREAM, 0.14);
  door(m, 0, 0.24, 1.21, 0.46, 0.62, '#7c9a4e');
  roundWindow(m, 0, 1.75, 1.205, 0.2);
  s.add(P.box(), STONE, mat(0, 0.1, 1.5, [0.9, 0.2, 0.5]), { top: '#d6d0c4' });
  s.add(P.box(), STONE, mat(0, 0.05, 1.82, [1.1, 0.1, 0.3]), { top: '#d6d0c4' });
  for (const x of [-1.42, 1.42]) {
    m.glow.add(P.box(), WARM, mat(x, 0.62, 0.815, [0.5, 0.42, 0.04]));
    s.add(P.box(), WOOD2, mat(x, 0.62, 0.83, [0.04, 0.42, 0.03]));
    s.add(P.box(), WOOD2, mat(x, 0.62, 0.83, [0.5, 0.04, 0.03]));
    for (const d of [-0.34, 0.34]) s.add(P.box(), '#6f9a52', mat(x + d, 0.62, 0.83, [0.14, 0.46, 0.03]));
    s.add(P.box(), WOOD, mat(x, 0.36, 0.9, [0.62, 0.1, 0.16]));
    for (let i = 0; i < 5; i++) m.leaf.add(P.ball(), PETALS[(i + (x > 0 ? 1 : 0)) % 4], mat(x - 0.24 + i * 0.12, 0.45, 0.9, 0.065), { flat: true });
    m.glow.add(P.box(), WARM, mat(x, 1.28, 0.815, [0.36, 0.26, 0.04]));
    s.add(P.box(), WOOD2, mat(x, 1.28, 0.83, [0.04, 0.26, 0.03]));
  }
  for (const x of [-0.75, 0.75]) {
    s.add(P.box(), '#5c4433', mat(x, 1.0, 1.26, [0.04, 0.04, 0.2]));
    m.glow.add(P.cyl(6), '#ffbe5c', mat(x, 0.88, 1.34, [0.07, 0.16, 0.07]));
    s.add(P.cone(6), '#c8493a', mat(x, 1.0, 1.34, [0.1, 0.08, 0.1]));
  }
  s.add(P.box(), STONE2, mat(1.3, 2.35, -0.3, [0.34, 0.9, 0.34]), { top: STONE });
  s.add(P.box(), '#6d6861', mat(1.3, 2.83, -0.3, [0.42, 0.07, 0.42]));
  // Ivy and bushes.
  for (let i = 0; i < 7; i++) m.leaf.add(P.ball(), '#4a9d4c', mat(-2.1 + (i % 2) * 0.12, 0.35 + i * 0.2, 0.75 - i * 0.03, 0.16 - i * 0.012), { top: '#8fd65e', flat: true, sway: 0.2 });
  for (const [x, z, sc] of [[-2.5, 0.9, 0.36], [2.5, 0.8, 0.4], [2.3, 1.25, 0.26], [-1.0, 1.3, 0.24], [1.0, 1.3, 0.24]]) m.leaf.add(P.ball(), '#3d9950', mat(x, sc * 0.75, z, [sc, sc * 0.8, sc]), { top: '#86d463', flat: true, sway: 0.25 });
  const g = m.group();
  // A painted sign over the door.
  const tex = canvasTexture(512, (c) => {
    c.fillStyle = '#7a5334'; c.fillRect(0, 150, 512, 212);
    c.fillStyle = '#f7e9c6'; c.fillRect(10, 160, 492, 192);
    c.strokeStyle = '#7a5334'; c.lineWidth = 5; c.strokeRect(24, 174, 464, 164);
    c.fillStyle = '#3c6e45'; c.font = '700 68px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('FERNWOOD', 256, 262);
  });
  tex.anisotropy = 8;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.9 }));
  sign.position.set(0, 1.22, 1.215);
  g.add(sign);
  return g;
}

// ---------------------------------------------------------------- pier and ferry
export function pierModel(world) {
  const m = new Model(), s = m.solid;
  const a = world.shore, b = world.pier[1], [dx, dz] = world.pierDir;
  const len = Math.hypot(b.x - a.x, b.z - a.z) + 0.85, ang = Math.atan2(dx, dz);
  const base = mat(a.x + dx * 0.25, 0, a.z + dz * 0.25, 1, 0, ang);
  const local = new Model();
  const n = Math.floor(len / 0.26);
  for (let i = 0; i < n; i++) local.solid.add(P.box(), i % 3 === 0 ? '#c79665' : i % 3 === 1 ? '#b98755' : '#d1a274', mat(((i * 7) % 3 - 1) * 0.015, 0.62, i * 0.26, [1.25, 0.07, 0.23]));
  for (let z = 0.5; z < len; z += 1.45) for (const x of [-0.6, 0.6]) {
    local.solid.add(P.cyl(7), '#8a6143', mat(x, -0.05, z, [0.075, 1.6, 0.075]));
    local.solid.add(P.cyl(7), '#a57650', mat(x, 0.78, z, [0.095, 0.06, 0.095]));
  }
  for (const x of [-0.6, 0.6]) local.solid.add(P.box(), '#a57650', mat(x, 0.6, len / 2, [0.05, 0.05, len]));
  // A lamp post at the end.
  local.solid.add(P.cyl(6), '#5c4433', mat(0.6, 1.3, len - 0.25, [0.035, 1.1, 0.035]));
  local.glow.add(P.sphere(), '#ffd58a', mat(0.6, 1.9, len - 0.25, 0.1));
  local.solid.add(P.cone(6), '#c8493a', mat(0.6, 2.02, len - 0.25, [0.15, 0.1, 0.15]));
  m.merge(local, base);
  return m.group();
}

export function ferryModel() {
  const m = new Model(), s = m.solid;
  s.add(P.box(), '#fbf7ee', mat(0, 0.34, -0.1, [1.5, 0.52, 3.3]));
  s.add(P.box(), '#d9553f', mat(0, 0.1, -0.1, [1.53, 0.2, 3.33]));
  // The pointed bow.
  for (const [y0, y1, c, w] of [[0, 0.2, '#d9553f', 0.765], [0.2, 0.6, '#fbf7ee', 0.75]]) {
    s.quad([-w, y0, 1.55], [-w, y1, 1.55], [0, y1, 2.6], [0, y0, 2.6], c, [-1, 0, 1]);
    s.quad([w, y0, 1.55], [w, y1, 1.55], [0, y1, 2.6], [0, y0, 2.6], c, [1, 0, 1]);
  }
  s.tri([-0.75, 0.6, 1.55], [0.75, 0.6, 1.55], [0, 0.6, 2.6], '#b88355', [0, 1, 0]);
  s.add(P.box(), '#b88355', mat(0, 0.585, -0.1, [1.42, 0.04, 3.2]));
  s.add(P.box(), '#8fd0e6', mat(0, 0.98, -0.7, [1.1, 0.75, 1.3]), { top: '#bfe7f4' });
  s.add(P.box(), '#d9553f', mat(0, 1.4, -0.7, [1.3, 0.1, 1.5]));
  for (const x of [-0.56, 0.56]) for (const z of [-1.05, -0.35]) m.glow.add(P.box(), '#fff1c4', mat(x, 1.02, z, [0.03, 0.3, 0.4]));
  m.glow.add(P.box(), '#fff1c4', mat(0, 1.02, -0.04, [0.7, 0.3, 0.03]));
  s.add(P.cyl(10), '#f6f1e6', mat(0, 1.75, -1.0, [0.19, 0.6, 0.19]));
  s.add(P.cyl(10), '#d9553f', mat(0, 1.95, -1.0, [0.2, 0.16, 0.2]));
  s.add(P.torus(), '#ff8a5c', mat(0.76, 0.52, 0.5, [0.16, 0.16, 0.2], 0, Math.PI / 2));
  s.add(P.cyl(5), '#8a6143', mat(0, 1.0, 2.1, [0.02, 0.8, 0.02]));
  s.tri([0, 1.4, 2.1], [0, 1.15, 2.1], [0, 1.27, 1.75], '#ffd24a', [1, 0, 0]);
  s.tri([0, 1.4, 2.1], [0, 1.15, 2.1], [0, 1.27, 1.75], '#ffd24a', [-1, 0, 0]);
  for (let z = -1.5; z <= 1.5; z += 0.5) for (const x of [-0.7, 0.7]) s.add(P.cyl(5), '#f6f1e6', mat(x, 0.72, z, [0.018, 0.26, 0.018]));
  for (const x of [-0.7, 0.7]) s.add(P.box(), '#f6f1e6', mat(x, 0.85, 0, [0.03, 0.03, 3.05]));
  return m.group();
}

export const glowDiscTexture = () => canvasTexture(128, (c) => {
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,205,120,0.85)'); g.addColorStop(0.4, 'rgba(255,180,90,0.32)'); g.addColorStop(1, 'rgba(255,170,80,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
});
export { MAT };
