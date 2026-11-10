// The island itself: hex ground, sea bed, animated water, wild plants,
// and the mist that hides regions until they open.

import { THREE, Geo, Model, MAT, P, mat, shared } from './core.js';
import { addNatural } from './props.js';
import { hexCorners, hash2, DIRS, lerp, clamp, easeInOut } from '../util.js';
import { WATER_Y } from '../world.js';
import { REGIONS } from '../data.js';

const TOP = {
  grass: ['#86cc58', '#93d661', '#7cc452'], sand: ['#f3e0ad', '#f7e7ba', '#eed8a0'], meadow: ['#a6dc62', '#b4e46d', '#99d459'],
  forest: ['#5fae52', '#69b85a', '#57a44c'], marsh: ['#84be8e', '#8fc898', '#79b384'], rock: ['#aaa69d', '#b5b1a8', '#9f9b92'], snow: ['#f1f6fc', '#ffffff', '#e6eef8'],
  paved: ['#dccfb6', '#e4d8c1', '#d2c5ab'], quay: ['#bdb6aa', '#c6c0b4', '#b1aa9e'],
};
const SIDE = { grass: '#b98a5e', sand: '#dcc48e', meadow: '#b98a5e', forest: '#a57a52', marsh: '#8f7a5c', rock: '#8a867f', snow: '#9a968f', paved: '#a39887', quay: '#8f8a82' };
const col = new THREE.Color(), col2 = new THREE.Color();
const SPAN = 110;        // world units covered by the shore map

export function buildTerrain(world, scene) {
  const g = new Geo();
  const inner = hexCorners(0.9), outer = hexCorners(1.0);
  for (const t of world.list) {
    if (t.water) {
      const depth = world.seaDepth(t);
      if (depth > 3 && !t.pond) continue;
      col.set('#ecd9a2').lerp(col2.set('#3f9db0'), t.pond ? 0.35 : clamp((depth - 1) / 2.4));
      const c = '#' + col.getHexString();
      for (let i = 1; i < 5; i++) g.tri([t.x, t.y, t.z], [t.x + outer[i][0], t.y, t.z + outer[i][1]], [t.x + outer[i + 1][0], t.y, t.z + outer[i + 1][1]], c, [0, 1, 0]);
      g.tri([t.x, t.y, t.z], [t.x + outer[5][0], t.y, t.z + outer[5][1]], [t.x + outer[0][0], t.y, t.z + outer[0][1]], c, [0, 1, 0]);
      g.tri([t.x, t.y, t.z], [t.x + outer[0][0], t.y, t.z + outer[0][1]], [t.x + outer[1][0], t.y, t.z + outer[1][1]], c, [0, 1, 0]);
      continue;
    }
    const pal = TOP[t.biome];
    const top = pal[Math.floor(t.v * 3) % 3];
    col.set(top).multiplyScalar(1.07);
    const edge = '#' + col.getHexString();
    const y = t.y, yb = y - 0.07;
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const a = [t.x + inner[i][0], y, t.z + inner[i][1]], b = [t.x + inner[j][0], y, t.z + inner[j][1]];
      const ao = [t.x + outer[i][0], yb, t.z + outer[i][1]], bo = [t.x + outer[j][0], yb, t.z + outer[j][1]];
      g.tri([t.x, y, t.z], a, b, top, [0, 1, 0]);
      g.quad(a, b, bo, ao, edge, [0, 1, 0]);
      const n = world.get(t.q + DIRS[i][0], t.r + DIRS[i][1]);
      const ny = n && !n.water ? n.y - 0.07 : -1.6;
      if (ny < yb - 0.01) {
        const out = [outer[i][0] + outer[j][0], 0, outer[i][1] + outer[j][1]];
        // Earth near the top, darker further down.
        const mid = Math.max(ny, yb - 0.45);
        g.quad(ao, bo, [bo[0], mid, bo[2]], [ao[0], mid, ao[2]], SIDE[t.biome], out);
        if (mid > ny) {
          col.set(SIDE[t.biome]).multiplyScalar(0.72);
          g.quad([ao[0], mid, ao[2]], [bo[0], mid, bo[2]], [bo[0], ny, bo[2]], [ao[0], ny, ao[2]], '#' + col.getHexString(), out);
        }
      }
    }
  }
  const ground = new THREE.Mesh(g.build(), MAT.solid);
  ground.receiveShadow = true;
  ground.castShadow = true;
  scene.add(ground);

  // Wild plants and rocks, merged into one model.
  const wild = new Model();
  for (const t of world.list) {
    if (!t.feat || !t.feat.natural) continue;
    const one = new Model();
    addNatural(one, t.feat.type, t.feat.v, t.biome);
    const jx = (hash2(t.q, t.r, 11) - 0.5) * 0.3, jz = (hash2(t.q, t.r, 12) - 0.5) * 0.3;
    wild.merge(one, mat(t.x + jx, t.y, t.z + jz, 1, 0, t.feat.v * 6.28));
  }
  // Tufts of grass on bare tiles.
  for (const t of world.list) {
    if (t.water || t.feat || !['grass', 'meadow', 'forest', 'marsh'].includes(t.biome)) continue;
    const n = Math.floor(hash2(t.q, t.r, 21) * 3.4);
    const one = new Model();
    for (let i = 0; i < n; i++) {
      const a = hash2(t.q + i, t.r, 22) * 6.28, d = 0.2 + hash2(t.q, t.r + i, 23) * 0.5;
      one.leaf.add(P.cone(4), '#6cbd4f', mat(Math.cos(a) * d, 0.07, Math.sin(a) * d, [0.045, 0.16, 0.045]), { top: '#b4e874', sway: 2.5 });
    }
    if (n) wild.merge(one, mat(t.x, t.y, t.z));
  }
  const plants = wild.group();
  scene.add(plants);
  return { ground, plants };
}

// A map of how close each bit of sea is to land, for shallows and foam.
function shoreTexture(world) {
  const size = 512, c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighten';
  const k = size / SPAN;
  for (const t of world.list) {
    if (t.water) continue;
    const x = (t.x / SPAN + 0.5) * size, y = (t.z / SPAN + 0.5) * size;
    const gr = ctx.createRadialGradient(x, y, 0.8 * k, x, y, 5.2 * k);
    gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000');
    ctx.fillStyle = gr;
    ctx.fillRect(x - 6 * k, y - 6 * k, 12 * k, 12 * k);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function buildWater(world, scene) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uShore: { value: shoreTexture(world) }, uTime: shared.time, uLight: { value: new THREE.Color(1, 1, 1) },
      uDeep: { value: new THREE.Color('#1f7fc4') }, uShallow: { value: new THREE.Color('#62e0d8') },
      uFogCol: { value: new THREE.Color() }, uFogDen: { value: 0.005 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
      uRain: { value: 0 }, uSpan: { value: SPAN },
    },
    vertexShader: `varying vec3 vW; varying float vDist;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vW; varying float vDist;
      uniform sampler2D uShore; uniform float uTime, uFogDen, uRain, uSpan; uniform vec3 uLight, uDeep, uShallow, uFogCol, uSun, uSunCol;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
      void main(){
        vec2 uv = vW.xz / uSpan + 0.5;
        float s = texture2D(uShore, uv).r;
        float n = noise(vW.xz * 0.55 + uTime * 0.18) + noise(vW.xz * 1.3 - uTime * 0.25) * 0.5;
        float shallow = smoothstep(0.3, 0.92, s);
        vec3 c = mix(uDeep, uShallow, shallow * shallow);
        // Soft moving light and dark patches, like a painted sea.
        float wv = noise(vW.xz * vec2(0.35, 0.7) + vec2(uTime * 0.3, uTime * 0.12) + n * 0.6);
        c *= 0.88 + 0.26 * wv;
        float crest = smoothstep(0.72, 0.78, noise(vW.xz * vec2(0.5, 1.6) + vec2(uTime * 0.45, 0.0) + n * 0.35)) * (1.0 - shallow);
        c += crest * 0.1;
        // Foam: a bright edge at the shore, then rings drifting in.
        float edge = smoothstep(0.83, 0.86, s + (n - 0.75) * 0.02);
        float ring = smoothstep(0.55, 0.8, sin(s * 30.0 - uTime * 1.3 + n * 1.6)) * smoothstep(0.6, 0.8, s) * (1.0 - smoothstep(0.8, 0.84, s));
        float foam = clamp(edge * 0.85 + ring * 0.5, 0.0, 1.0);
        c = mix(c, vec3(1.0), foam);
        // Raindrop rings.
        if (uRain > 0.01) {
          vec2 cell = floor(vW.xz * 1.6), f = fract(vW.xz * 1.6) - 0.5;
          float ph = fract(uTime * 0.9 + hash(cell) * 7.0);
          float d = length(f + (vec2(hash(cell + 1.3), hash(cell + 2.7)) - 0.5) * 0.5);
          c += smoothstep(0.03, 0.0, abs(d - ph * 0.35)) * (1.0 - ph) * 0.5 * uRain;
        }
        c *= uLight;
        // Sun sparkles.
        float sp = step(0.985, noise(vW.xz * 5.0 + uTime * 0.6)) * step(0.5, noise(vW.xz * 0.8 - uTime * 0.2));
        c += uSunCol * sp * 0.6 * (1.0 - uRain);
        float alpha = max(mix(0.97, 0.6, shallow), foam);
        float fog = 1.0 - exp(-uFogDen * uFogDen * vDist * vDist);
        c = mix(c, uFogCol, fog);
        gl_FragColor = vec4(c, mix(alpha, 1.0, fog));
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), material);
  mesh.position.y = WATER_Y;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return {
    mesh,
    update(sky, rain) {
      const u = material.uniforms;
      u.uLight.value.copy(sky.cur.sun).multiplyScalar(sky.cur.si * 0.2).add(col.copy(sky.cur.amb).multiplyScalar(sky.cur.ai * 0.36));
      u.uFogCol.value.copy(sky.cur.fog);
      u.uFogDen.value = sky.scene.fog.density;
      u.uSunCol.value.copy(sky.cur.sun).multiplyScalar(sky.cur.si * 0.5);
      u.uRain.value = rain;
    },
  };
}

// Soft cloud banks over regions that aren't open yet.
export function buildMist(world, scene, stars) {
  const geom = new THREE.IcosahedronGeometry(1, 2);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#aebbd0', emissiveIntensity: 0.3 });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        transformed *= 1.0 + 0.06 * sin(uTime * 0.6 + ip.x * 0.8 + ip.z * 0.6);
        transformed.y += 0.12 * sin(uTime * 0.45 + ip.x * 0.5);`);
  };
  const regions = {};
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const id in REGIONS) {
    if (REGIONS[id].star === 0) continue;
    const tiles = world.list.filter((t) => !t.water && t.region === id);
    const puffs = [];
    for (const t of tiles) {
      const n = 1;
      for (let i = 0; i < n; i++) puffs.push({ x: t.x + (hash2(t.q, t.r, 31 + i) - 0.5) * 0.9, y: t.y + 0.7 + i * 0.9 + hash2(t.q, t.r, 32) * 0.35, z: t.z + (hash2(t.q, t.r, 33 + i) - 0.5) * 0.9, s: 1.2 + hash2(t.q, t.r, 34 + i) * 0.45, d: 0 });
    }
    const mesh = new THREE.InstancedMesh(geom, material, puffs.length);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const region = { mesh, puffs, open: REGIONS[id].star <= stars, t: 1 };
    regions[id] = region;
    setPuffs(region, region.open ? 1 : 0);
    mesh.visible = !region.open;
    scene.add(mesh);
  }
  function setPuffs(region, k) {
    region.puffs.forEach((u, i) => {
      const kk = clamp(k * 2.2 - u.d * 1.2);
      const sc = u.s * (1 - easeInOut(kk));
      p.set(u.x, u.y + kk * 2.5, u.z); s.set(sc, sc * 0.5, sc);
      region.mesh.setMatrixAt(i, m4.compose(p, q, s));
    });
    region.mesh.instanceMatrix.needsUpdate = true;
  }
  return {
    material,
    // Start clearing a region, spreading outward from a point.
    open(id, from) {
      const region = regions[id];
      if (!region || region.open) return;
      let max = 1;
      for (const u of region.puffs) { u.d = Math.hypot(u.x - from.x, u.z - from.z); max = Math.max(max, u.d); }
      for (const u of region.puffs) u.d /= max;
      region.open = true; region.t = 0;
    },
    update(dt) {
      for (const id in regions) {
        const region = regions[id];
        if (!region.open || region.t >= 1) continue;
        region.t = Math.min(1, region.t + dt / 4.5);
        setPuffs(region, region.t);
        if (region.t >= 1) region.mesh.visible = false;
      }
    },
  };
}

// Fluffy clouds drifting high over the sea.
export function buildClouds(scene) {
  const g = new Geo();
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * 6.283 + hash2(i, 1, 5), rad = 150 + hash2(i, 2, 5) * 90;
    const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad, cy = 14 + hash2(i, 3, 5) * 22, sc = 7 + hash2(i, 4, 5) * 8;
    for (let k = 0; k < 5; k++) {
      const s = sc * (k === 0 ? 1 : 0.5 + hash2(i, k, 6) * 0.4);
      g.add(P.blob(), '#ffffff', mat(cx + (k - 2) * sc * 0.75, cy + (k % 2) * sc * 0.2, cz + (hash2(i, k, 7) - 0.5) * sc, [s, s * 0.6, s * 0.85]), { top: '#ffffff' });
    }
  }
  const mesh = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, fog: false, emissive: '#8fa3c8', emissiveIntensity: 0.35 }));
  scene.add(mesh);
  return { mesh, update(t) { mesh.rotation.y = t * 0.004; } };
}

export { lerp };
