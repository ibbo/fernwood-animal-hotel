// Port Marlow: the harbour town across the bridge, with its clock tower,
// shops, tall houses, lighthouse and boats, and the big city far out to sea.

import { THREE, Model, P, mat, MAT } from './core.js';
import { gable, gableZ, door } from './props.js';
import { rng, hash2, TAU } from '../util.js';

const STONE = '#b4aea3', STONE2 = '#8f8a82', WOOD = '#c0895a', WOOD2 = '#9a6842', WARM = '#ffc56a', GLASS = '#5d7d99';
const WALLS = ['#f2d6b3', '#e9b7a0', '#bcd9e6', '#f4e3a1', '#cfe3c1', '#e6c7e0', '#f6f0e4', '#d98f76', '#f0c9a8', '#a9cbd6'];
const ROOFS = ['#d9654a', '#c9553c', '#3e8f8f', '#7c6a9a', '#56708f', '#b5563f'];
const AWNING = [['#e8553f', '#fff6e6'], ['#3f9ad6', '#fff6e6'], ['#4f9d5d', '#fff6e6'], ['#f2b632', '#fff6e6']];

function windows(m, r, w, d, floors, fh, y0, skipDoor, lit = 0.62) {
  const cols = w > 1.25 ? 3 : 2;
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * fh + fh * 0.56;
    for (let i = 0; i < cols; i++) {
      const x = (i - (cols - 1) / 2) * (w / cols) * 0.92;
      for (const side of [1, -1]) {
        if (side === 1 && f === 0 && skipDoor) continue;
        const on = r() < lit;
        (on ? m.glow : m.solid).add(P.box(), on ? WARM : GLASS, mat(x, y, side * (d / 2 + 0.004), [0.19, 0.25, 0.03]));
        m.solid.add(P.box(), '#fffaf0', mat(x, y - 0.145, side * (d / 2 + 0.02), [0.25, 0.035, 0.05]));
      }
    }
    for (const side of [1, -1]) {
      const on = r() < lit;
      (on ? m.glow : m.solid).add(P.box(), on ? WARM : GLASS, mat(side * (w / 2 + 0.004), y, 0, [0.03, 0.25, 0.2]));
    }
  }
}
function awning(m, y, z, w, pal, depth = 0.34) {
  const n = 6;
  for (let i = 0; i < n; i++) m.solid.add(P.box(), pal[i % 2], mat((i - (n - 1) / 2) * (w / n), y, z + depth / 2, [w / n, 0.035, depth], 0.32));
}

// An ordinary town house: a painted box with windows, a door and a roof.
function house(m, r, floors, opt = {}) {
  const s = m.solid;
  const w = opt.w || 1.3 + r() * 0.22, d = opt.d || 1.16, fh = 0.56, y0 = 0.1, h = floors * fh + y0;
  const zc = opt.z || 0;
  const wall = opt.wall || r.pick(WALLS), roof = opt.roof || r.pick(ROOFS);
  const part = new Model();
  part.solid.add(P.box(), STONE2, mat(0, 0.05, 0, [w + 0.07, 0.1, d + 0.07]));
  part.solid.add(P.box(), wall, mat(0, y0 + (h - y0) / 2, 0, [w, h - y0, d]));
  windows(part, r, w, d, floors, fh, y0, true, opt.lit);
  door(part, opt.doorX ?? (r() < 0.5 ? -w * 0.22 : w * 0.22), y0, d / 2 + 0.012, 0.2, 0.3, r.pick(['#7c9a4e', '#a8623c', '#3f6f8f', '#c8493a']));
  if (opt.flat ?? (floors >= 4 && r() < 0.65)) {
    part.solid.add(P.box(), STONE, mat(0, h + 0.04, 0, [w + 0.1, 0.1, d + 0.1]));
    const kind = r();
    if (kind < 0.4) {
      part.solid.add(P.cyl(8), WOOD2, mat(w * 0.2, h + 0.36, -d * 0.15, [0.2, 0.34, 0.2]));
      part.solid.add(P.cone(8), '#6d6861', mat(w * 0.2, h + 0.6, -d * 0.15, [0.23, 0.14, 0.23]));
    } else if (kind < 0.75) {
      for (let i = 0; i < 3; i++) part.leaf.add(P.ball(), '#3d9950', mat((i - 1) * 0.36, h + 0.2, d * 0.12, 0.17), { top: '#8fd65e', flat: true, sway: 0.2 });
    } else part.solid.add(P.box(), wall, mat(-w * 0.2, h + 0.24, 0, [0.4, 0.34, 0.4]));
  } else {
    gable(part.solid, 0, h, 0, w, d, 0.42 + r() * 0.16, roof, wall, 0.07);
    part.solid.add(P.box(), '#a0705a', mat(w * 0.28, h + 0.36, -0.1, [0.14, 0.4, 0.14]));
  }
  if (opt.awning) awning(part, y0 + fh * 0.98, d / 2, w * 0.96, opt.awning);
  m.merge(part, mat(0, 0, zc));
  return { w, d, h, s };
}

const SHOP = {
  market(m, r) {
    house(m, r, 3, { wall: '#f6f0e4', roof: '#4f9d5d', z: -0.3, d: 0.74, w: 1.5, doorX: 0 });
    awning(m, 0.84, 0.1, 1.56, AWNING[0], 0.62);
    for (const x of [-0.72, 0.72]) m.solid.add(P.cyl(6), WOOD2, mat(x, 0.4, 0.66, [0.03, 0.8, 0.03]));
    m.solid.add(P.box(), WOOD, mat(0, 0.2, 0.5, [1.4, 0.3, 0.36]), { top: '#d9a773' });
    const fruit = ['#e8463c', '#ff8a2e', '#5b5fd6', '#f2c14e', '#7fd858'];
    for (let i = 0; i < 5; i++) {
      m.solid.add(P.box(), WOOD2, mat(-0.56 + i * 0.28, 0.38, 0.5, [0.24, 0.07, 0.3]));
      for (let k = 0; k < 4; k++) m.solid.add(P.sphere(), fruit[i], mat(-0.62 + i * 0.28 + (k % 2) * 0.11, 0.44, 0.44 + Math.floor(k / 2) * 0.12, 0.055));
    }
  },
  post(m, r) {
    house(m, r, 4, { wall: '#c8604a', roof: '#56708f', w: 1.42, doorX: 0, flat: false });
    m.solid.add(P.box(), '#fff6e6', mat(0, 0.62, 0.6, [0.7, 0.16, 0.03]));
    m.solid.add(P.box(), '#e8553f', mat(0, 0.62, 0.615, [0.24, 0.1, 0.02]));
    m.solid.add(P.cyl(10), '#e8553f', mat(0.56, 0.24, 0.74, [0.1, 0.4, 0.1]));
    m.solid.add(P.dome(), '#c8493a', mat(0.56, 0.44, 0.74, [0.115, 0.08, 0.115]));
    m.solid.add(P.box(), '#3d302a', mat(0.56, 0.36, 0.835, [0.1, 0.02, 0.02]));
  },
  cafe(m, r) {
    house(m, r, 3, { wall: '#f4e3a1', roof: '#d9654a', w: 1.46, awning: AWNING[1], flat: false });
    for (const x of [-0.45, 0.45]) {
      m.solid.add(P.cyl(10), '#fffaf0', mat(x, 0.24, 0.84, [0.15, 0.02, 0.15]));
      m.solid.add(P.cyl(6), STONE2, mat(x, 0.12, 0.84, [0.02, 0.24, 0.02]));
      m.solid.add(P.sphere(), '#ff9ab8', mat(x, 0.28, 0.84, 0.035));
    }
  },
  hotel(m, r) {
    const b = house(m, r, 7, { wall: '#bcd9e6', w: 1.42, d: 1.24, flat: true, doorX: 0, lit: 0.8 });
    awning(m, 0.6, 0.62, 0.7, AWNING[3], 0.3);
    for (let i = 0; i < 5; i++) m.glow.add(P.box(), '#ff8a9c', mat(0.78, b.h - 0.5 - i * 0.34, 0.35, [0.06, 0.24, 0.2]));
    m.solid.add(P.cyl(5), STONE2, mat(0, b.h + 0.5, 0, [0.02, 0.8, 0.02]));
    m.solid.tri([0, b.h + 0.9, 0], [0, b.h + 0.68, 0], [0.32, b.h + 0.79, 0], '#e8553f', [0, 0, 1]);
    m.solid.tri([0, b.h + 0.9, 0], [0, b.h + 0.68, 0], [0.32, b.h + 0.79, 0], '#e8553f', [0, 0, -1]);
  },
  hall(m, r) {
    const s = m.solid;
    s.add(P.box(), STONE, mat(0, 0.1, 0, [1.56, 0.2, 1.3]));
    s.add(P.box(), '#f6f0e4', mat(0, 1.05, -0.12, [1.44, 1.7, 0.96]));
    windows(m, r, 1.44, 0.96, 3, 0.55, 0.22, true, 0.75);
    for (let i = 0; i < 4; i++) s.add(P.cyl(8), '#fffaf0', mat(-0.54 + i * 0.36, 0.86, 0.5, [0.06, 1.32, 0.06]));
    s.add(P.box(), '#fffaf0', mat(0, 1.56, 0.44, [1.36, 0.1, 0.3]));
    gableZ(s, 0, 1.6, 0.34, 1.36, 0.46, 0.34, STONE, '#fffaf0', 0.02);
    door(m, 0, 0.2, 0.37, 0.26, 0.42, '#7a5334');
    s.add(P.cyl(12), '#f6f0e4', mat(0, 2.02, -0.12, [0.42, 0.26, 0.42]));
    s.add(P.dome(), '#3e8f8f', mat(0, 2.15, -0.12, [0.46, 0.42, 0.46]), { top: '#6fc0b8' });
    s.add(P.cyl(5), '#f2c14e', mat(0, 2.72, -0.12, [0.015, 0.34, 0.015]));
    s.add(P.sphere(), '#f2c14e', mat(0, 2.9, -0.12, 0.045));
  },
  toys(m, r) {
    const b = house(m, r, 4, { wall: '#e6c7e0', roof: '#f2b632', w: 1.4, awning: AWNING[2], flat: false });
    const cols = ['#ff5d5d', '#4aa8ff', '#ffd24a', '#7fd858', '#b28cff'];
    for (let i = 0; i < 5; i++) {
      const x = -0.74 + (i % 3) * 0.09, y = 0.86 + i * 0.1;
      m.solid.add(P.sphere(), cols[i], mat(x, y, 0.72 + (i % 2) * 0.07, [0.075, 0.09, 0.075]));
    }
    m.solid.add(P.cyl(4), '#fffaf0', mat(-0.68, 0.45, 0.74, [0.006, 0.8, 0.006]));
    void b;
  },
};

function lamp(m, x, y, z, ry = 0) {
  const one = new Model();
  one.solid.add(P.cyl(8), '#4a4f58', mat(0, 0.05, 0, [0.09, 0.1, 0.09]));
  one.solid.add(P.cyl(6), '#4a4f58', mat(0, 0.75, 0, [0.03, 1.4, 0.03]));
  one.solid.add(P.box(), '#4a4f58', mat(0, 1.45, 0.12, [0.03, 0.03, 0.26]));
  one.glow.add(P.sphere(), '#ffd58a', mat(0, 1.37, 0.24, 0.085));
  one.solid.add(P.cone(6), '#4a4f58', mat(0, 1.47, 0.24, [0.12, 0.07, 0.12]));
  m.merge(one, mat(x, y, z, 1, 0, ry));
}

function boat(v) {
  const m = new Model(), r = rng(v * 9999 + 77), s = m.solid;
  const col = r.pick(['#e8553f', '#3f9ad6', '#f2b632', '#4f9d5d', '#fff6e6']);
  s.add(P.sphere(), col, mat(0, 0.06, 0, [0.3, 0.2, 0.74]));
  s.add(P.box(), '#fff6e6', mat(0, 0.2, 0, [0.5, 0.04, 1.2]));
  s.add(P.box(), WOOD, mat(0, 0.215, 0, [0.42, 0.03, 1.08]));
  s.add(P.box(), WOOD2, mat(0, 0.25, -0.1, [0.42, 0.04, 0.12]));
  if (r() < 0.6) {
    s.add(P.cyl(5), WOOD2, mat(0, 0.9, 0.12, [0.02, 1.4, 0.02]));
    s.tri([0, 1.55, 0.1], [0, 0.4, 0.1], [0, 0.4, -0.55], '#fffaf0', [1, 0, 0]);
    s.tri([0, 1.55, 0.1], [0, 0.4, 0.1], [0, 0.4, -0.55], '#fffaf0', [-1, 0, 0]);
  } else {
    s.add(P.box(), '#fffaf0', mat(0, 0.36, -0.2, [0.3, 0.26, 0.36]));
    s.add(P.box(), col, mat(0, 0.51, -0.2, [0.36, 0.04, 0.42]));
  }
  return m.group();
}

export function buildTown(world, scene, fx) {
  const town = world.town, c = town.centre;
  const m = new Model();
  const inward = (t) => Math.atan2(c.x - t.x, c.z - t.z);

  // Houses and shops.
  for (const t of town.tiles) {
    if (t.feat?.type !== 'house') continue;
    const one = new Model(), r = rng(Math.floor(t.feat.v * 1e6) + 3);
    if (t.feat.shop) SHOP[t.feat.shop](one, r); else house(one, r, t.feat.floors, { awning: r() < 0.22 ? r.pick(AWNING) : null });
    m.merge(one, mat(t.x, t.y, t.z, 1, 0, inward(t) + (t.feat.out ? Math.PI : 0)));
  }

  // Street lamps round the ring road, and crates and bollards on the quay.
  const pools = [];
  for (const t of town.tiles) {
    const a = Math.atan2(t.z - c.z, t.x - c.x), h = hash2(t.q, t.r, 51);
    if (t.town.d === 3 && !t.town.spoke && (t.q + t.r * 2) % 2 === 0) {
      const x = t.x + Math.cos(a) * 0.62, z = t.z + Math.sin(a) * 0.62;
      lamp(m, x, t.y, z, inward(t));
      pools.push([x - Math.cos(a) * 0.24, t.y, z - Math.sin(a) * 0.24]);
    }
    if (t.town.d === 6 && !t.feat && !world.bridge.includes(t)) {
      const x = t.x + Math.cos(a) * 0.68, z = t.z + Math.sin(a) * 0.68;
      if (h < 0.3) {
        m.solid.add(P.box(), WOOD, mat(x, t.y + 0.14, z, [0.28, 0.28, 0.28], 0, h * 9));
        m.solid.add(P.box(), WOOD2, mat(x + 0.2, t.y + 0.1, z + 0.12, [0.2, 0.2, 0.2], 0, h * 5));
      } else if (h < 0.5) {
        m.solid.add(P.cyl(10), '#9a6842', mat(x, t.y + 0.17, z, [0.14, 0.34, 0.14]));
        m.solid.add(P.torus(), '#5c4433', mat(x, t.y + 0.2, z, [0.14, 0.14, 0.1], Math.PI / 2));
      } else if (h < 0.85) {
        m.solid.add(P.cyl(8), '#4a4f58', mat(x, t.y + 0.1, z, [0.07, 0.2, 0.07]));
        m.solid.add(P.sphere(), '#4a4f58', mat(x, t.y + 0.21, z, 0.09));
      }
    }
  }

  // The clock tower in the middle of the square.
  const s = m.solid, cy = c.y;
  s.add(P.box(), STONE, mat(c.x, cy + 0.4, c.z, [1.34, 0.8, 1.34]), { top: '#cfc8ba' });
  s.add(P.box(), '#f6e9cd', mat(c.x, cy + 2.5, c.z, [1.0, 3.4, 1.0]));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.add(P.box(), STONE, mat(c.x + dx * 0.5, cy + 2.5, c.z + dz * 0.5, [0.12, 3.4, 0.12]));
  s.add(P.box(), STONE, mat(c.x, cy + 4.25, c.z, [1.16, 0.12, 1.16]));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, x = c.x + Math.sin(a) * 0.505, z = c.z + Math.cos(a) * 0.505;
    m.glow.add(P.box(), WARM, mat(x, cy + 4.6, z, [0.3, 0.4, 0.03], 0, a));
    door(m, c.x + Math.sin(a) * 0.675, cy, c.z + Math.cos(a) * 0.675, 0.3, 0.44, '#7a5334');
  }
  s.add(P.box(), '#f6e9cd', mat(c.x, cy + 4.62, c.z, [0.9, 0.62, 0.9]));
  s.add(P.cone(4), '#3e8f8f', mat(c.x, cy + 5.55, c.z, [0.86, 1.3, 0.86], 0, Math.PI / 4), { top: '#6fc0b8' });
  s.add(P.sphere(), '#f2c14e', mat(c.x, cy + 6.25, c.z, 0.08));
  const hands = [];
  const faceGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20).rotateX(Math.PI / 2);
  const handGeo = (w, l) => new THREE.BoxGeometry(w, l, 0.02).translate(0, l / 2 - 0.03, 0);
  const faceMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.6, emissive: '#ffe9b0', emissiveIntensity: 0 });
  const handMat = new THREE.MeshStandardMaterial({ color: '#3d302a', roughness: 0.7 });
  const clock = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    g.rotation.y = (i * Math.PI) / 2;
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = 0.52;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 20), handMat);
    rim.position.z = 0.53;
    const hr = new THREE.Mesh(handGeo(0.05, 0.2), handMat), mn = new THREE.Mesh(handGeo(0.035, 0.3), handMat);
    hr.position.z = 0.55; mn.position.z = 0.565;
    g.add(face, rim, hr, mn);
    hands.push([hr, mn]);
    clock.add(g);
  }
  clock.position.set(c.x, cy + 3.75, c.z);
  scene.add(clock);

  // Bunting from the tower to the shops.
  const FLAGS = ['#e8553f', '#f2b632', '#4f9d5d', '#3f9ad6', '#b28cff', '#fff6e6'];
  for (const id in town.shops) {
    const t = town.shops[id], n = 9;
    for (let i = 1; i < n; i++) {
      const k = i / n, x = c.x + (t.x - c.x) * (0.18 + k * 0.6), z = c.z + (t.z - c.z) * (0.18 + k * 0.6);
      const y = cy + 2.5 - k * 0.7 - Math.sin(k * Math.PI) * 0.45;
      const ax = (t.x - c.x) * 0.045, az = (t.z - c.z) * 0.045;
      for (const hint of [[az, 0, -ax], [-az, 0, ax]]) s.tri([x - ax, y, z - az], [x + ax, y, z + az], [x, y - 0.17, z], FLAGS[i % FLAGS.length], hint);
    }
  }

  // The notice board.
  {
    const t = town.board, a = inward(t), one = new Model();
    for (const x of [-0.36, 0.36]) one.solid.add(P.box(), WOOD2, mat(x, 0.5, 0, [0.06, 1.0, 0.06]));
    one.solid.add(P.box(), WOOD, mat(0, 0.66, 0, [0.84, 0.56, 0.05]));
    gable(one.solid, 0, 0.96, 0, 0.9, 0.16, 0.12, '#d9654a', WOOD, 0.04);
    const paper = ['#fffaf0', '#ffe9a8', '#dff2ff', '#ffd0dc', '#fffaf0'];
    for (let i = 0; i < 5; i++) one.solid.add(P.box(), paper[i], mat(-0.26 + (i % 3) * 0.26, 0.76 - Math.floor(i / 3) * 0.24, -0.03, [0.18, 0.2, 0.012], 0, 0, (i % 2 ? 0.08 : -0.06)));
    m.merge(one, mat(t.x + Math.sin(a) * 0.5, t.y, t.z + Math.cos(a) * 0.5, 1, 0, a));
  }

  // The lighthouse.
  const L = town.lighthouse, ly = L.y;
  s.add(P.cyl(12), STONE, mat(L.x, ly + 0.25, L.z, [0.82, 0.5, 0.82]), { top: '#cfc8ba' });
  for (let i = 0; i < 6; i++) {
    const r0 = 0.6 - i * 0.045;
    s.add(P.taper(14, (r0 - 0.045) / r0), i % 2 ? '#e8553f' : '#fffaf0', mat(L.x, ly + 0.5 + i * 0.75 + 0.375, L.z, [r0, 0.75, r0]));
  }
  s.add(P.cyl(14), '#4a4f58', mat(L.x, ly + 5.04, L.z, [0.52, 0.08, 0.52]));
  m.glow.add(P.cyl(10), '#fff1c4', mat(L.x, ly + 5.34, L.z, [0.26, 0.52, 0.26]));
  s.add(P.cone(10), '#e8553f', mat(L.x, ly + 5.85, L.z, [0.4, 0.5, 0.4]));
  s.add(P.sphere(), '#f2c14e', mat(L.x, ly + 6.13, L.z, 0.06));
  door(m, L.x + Math.sin(inward(L)) * 0.62, ly + 0.5, L.z + Math.cos(inward(L)) * 0.62, 0.22, 0.34, '#3f6f8f');
  const beamGeo = new THREE.ConeGeometry(1.5, 11, 18, 1, true).translate(0, -5.5, 0).rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe9b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Group();
  for (const a of [0, Math.PI]) { const b = new THREE.Mesh(beamGeo, beamMat); b.rotation.y = a; b.rotation.x = 0.06; beam.add(b); }
  beam.position.set(L.x, ly + 5.34, L.z);
  beam.renderOrder = 4;
  scene.add(beam);

  // The bridge: a stone deck on piers, with a lamp on every pier.
  const br = world.bridge, deckY = (t) => (t.water ? t.walkY : t.y + 0.02);
  for (let i = 0; i < br.length - 1; i++) {
    const a = br[i], b = br[i + 1], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz), nx = (-dz / l) * 0.68, nz = (dx / l) * 0.68;
    const ya = deckY(a), yb = deckY(b);
    const A1 = [a.x + nx, ya, a.z + nz], A2 = [a.x - nx, ya, a.z - nz], B1 = [b.x + nx, yb, b.z + nz], B2 = [b.x - nx, yb, b.z - nz];
    s.quad(A1, B1, B2, A2, i % 2 ? '#d6ccb8' : '#cdc3ae', [0, 1, 0]);
    for (const [p, q, hint] of [[A1, B1, [nx, 0, nz]], [A2, B2, [-nx, 0, -nz]]]) {
      s.quad([p[0], p[1] + 0.2, p[2]], [q[0], q[1] + 0.2, q[2]], [q[0], q[1] - 0.22, q[2]], [p[0], p[1] - 0.22, p[2]], STONE, hint);
      s.quad([p[0], p[1] + 0.2, p[2]], [q[0], q[1] + 0.2, q[2]], [q[0] - hint[0] * 0.14, q[1] + 0.2, q[2] - hint[2] * 0.14], [p[0] - hint[0] * 0.14, p[1] + 0.2, p[2] - hint[2] * 0.14], '#cfc8ba', [0, 1, 0]);
      s.quad([p[0] - hint[0] * 0.14, p[1] + 0.2, p[2] - hint[2] * 0.14], [q[0] - hint[0] * 0.14, q[1] + 0.2, q[2] - hint[2] * 0.14], [q[0] - hint[0] * 0.14, q[1], q[2] - hint[2] * 0.14], [p[0] - hint[0] * 0.14, p[1], p[2] - hint[2] * 0.14], STONE, [-hint[0], 0, -hint[2]]);
    }
    if (a.water) {
      s.add(P.cyl(8), STONE2, mat(a.x, -0.45, a.z, [0.36, 2.0, 0.36]), { top: STONE });
      s.add(P.box(), STONE, mat(a.x, ya - 0.16, a.z, [1.5, 0.2, 0.7], 0, Math.atan2(dx, dz) + Math.PI / 2));
      const side = i % 2 ? 1 : -1;
      lamp(m, a.x + nx * side * 0.9, ya + 0.2, a.z + nz * side * 0.9, Math.atan2(-nx * side, -nz * side));
    }
  }

  const group = m.group();
  scene.add(group);
  for (const [x, y, z] of pools) { const p = fx.lightPool(4.4); p.position.set(x, y + 0.05, z); scene.add(p); }

  // Boats moored round the quay.
  const boats = [];
  for (const t of world.list) {
    if (!t.water || t.pier || hash2(t.q, t.r, 61) > 0.42) continue;
    const quay = world.neighbors(t).find((n) => n.town && n.town.d === 6 && !n.feat);
    if (!quay || world.neighbors(t).some((n) => n.bridge)) continue;
    const b = boat(hash2(t.q, t.r, 62));
    b.position.set(t.x + (quay.x - t.x) * 0.12, 0.2, t.z + (quay.z - t.z) * 0.12);
    b.rotation.y = Math.atan2(quay.x - t.x, quay.z - t.z) + Math.PI / 2;
    b.userData.seed = hash2(t.q, t.r, 63) * 9;
    scene.add(b);
    boats.push(b);
  }

  // The big city, far away across the water.
  const far = new Model(), fr = rng(99);
  const mid = Math.atan2(c.z, c.x);
  for (let i = 0; i < 54; i++) {
    const k = i / 53 - 0.5, a = mid + k * 1.5 + fr() * 0.02, rad = 205 + fr() * 50;
    const w = 6 + fr() * 9, h = (16 + fr() * 46) * (1 - Math.abs(k) * 1.1) + 8;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad, ry = -a + Math.PI / 2;
    far.solid.add(P.box(), fr.pick(['#8ea2c2', '#7f93b5', '#9bb0cc', '#a8b9d2']), mat(x, h / 2, z, [w, h, w * 0.8], 0, ry));
    if (fr() < 0.4) far.solid.add(P.box(), '#7f93b5', mat(x, h + 3, z, [w * 0.35, 6, w * 0.3], 0, ry));
    if (fr() < 0.25) far.solid.add(P.cyl(5), '#9bb0cc', mat(x, h + 7, z, [0.3, 14, 0.3]));
    for (let y = 5; y < h - 2; y += 5.5) {
      if (fr() < 0.25) continue;
      const ww = w * (0.35 + fr() * 0.5), off = (fr() - 0.5) * (w - ww);
      far.glow.add(P.box(), fr() < 0.75 ? '#ffd58a' : '#bfe7ff', mat(x - Math.cos(a) * w * 0.41 + Math.sin(a) * off, y, z - Math.sin(a) * w * 0.41 - Math.cos(a) * off, [ww, 1.3, 0.4], 0, ry));
    }
  }
  const city = far.group();
  city.traverse((o) => { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; });
  scene.add(city);

  return {
    group, city,
    update(time, hour, night) {
      const hr = ((hour % 12) / 12) * TAU, mn = (hour % 1) * TAU;
      for (const [h, mm] of hands) { h.rotation.z = -hr; mm.rotation.z = -mn; }
      faceMat.emissiveIntensity = night * 0.9;
      beam.rotation.y = time * 0.7;
      beamMat.opacity = night * 0.13;
      beam.visible = night > 0.02;
      for (const b of boats) {
        b.position.y = 0.2 + Math.sin(time * 1.4 + b.userData.seed) * 0.035;
        b.rotation.z = Math.sin(time * 1.1 + b.userData.seed) * 0.05;
      }
    },
  };
}
