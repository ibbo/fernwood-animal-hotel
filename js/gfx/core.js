// Rendering core: a geometry builder that merges coloured shapes, the shared
// materials (with wind and night glow), the sky and day-night light, and a
// small post-processing chain (bloom, miniature-style depth blur, grading).

import * as THREE from 'three';
import { clamp, lerp, smooth } from '../util.js';

export { THREE };

// ---------------------------------------------------------------- geometry builder
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
const _c1 = new THREE.Color(), _c2 = new THREE.Color();

// Position / scale / rotation → matrix. Scale may be a number or [x, y, z].
export function mat(x = 0, y = 0, z = 0, s = 1, rx = 0, ry = 0, rz = 0) {
  _p.set(x, y, z);
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  _q.setFromEuler(_e.set(rx, ry, rz));
  return new THREE.Matrix4().compose(_p, _q, _s);
}

const prim = {};
const cached = (key, make) => prim[key] || (prim[key] = ((g) => (g.index ? g.toNonIndexed() : g))(make()));
export const P = {
  sphere: () => cached('sph', () => new THREE.SphereGeometry(1, 14, 10)),
  ball: () => cached('ball', () => new THREE.IcosahedronGeometry(1, 1)),          // chunky low-poly blob
  blob: () => cached('blob', () => new THREE.IcosahedronGeometry(1, 2)),
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (n = 8) => cached('cyl' + n, () => new THREE.CylinderGeometry(1, 1, 1, n)),
  cone: (n = 8) => cached('cone' + n, () => new THREE.ConeGeometry(1, 1, n)),
  taper: (n = 8, top = 0.6) => cached('tap' + n + top, () => new THREE.CylinderGeometry(top, 1, 1, n)),
  dome: () => cached('dome', () => new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2)),
  torus: () => cached('tor', () => new THREE.TorusGeometry(1, 0.28, 8, 16)),
  disc: (n = 12) => cached('disc' + n, () => new THREE.CircleGeometry(1, n).rotateX(-Math.PI / 2)),
};

export class Geo {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.sway = []; }

  // Add a shape. opts: flat (faceted shading), top (second colour blended in
  // toward the top of the shape), sway (how much the wind moves it).
  add(geom, color, matrix, opts = {}) {
    const gp = geom.attributes.position, gn = geom.attributes.normal;
    _c1.set(color);
    if (opts.top !== undefined) _c2.set(opts.top);
    if (!geom.boundingBox) geom.computeBoundingBox();
    const y0 = geom.boundingBox.min.y, yh = geom.boundingBox.max.y - y0 || 1;
    _nm.getNormalMatrix(matrix);
    const start = this.pos.length;
    for (let i = 0; i < gp.count; i++) {
      _p.fromBufferAttribute(gp, i);
      const k = (_p.y - y0) / yh;
      _p.applyMatrix4(matrix);
      this.pos.push(_p.x, _p.y, _p.z);
      _n.fromBufferAttribute(gn, i).applyMatrix3(_nm).normalize();
      this.nor.push(_n.x, _n.y, _n.z);
      if (opts.top !== undefined) this.col.push(lerp(_c1.r, _c2.r, k), lerp(_c1.g, _c2.g, k), lerp(_c1.b, _c2.b, k));
      else this.col.push(_c1.r, _c1.g, _c1.b);
      this.sway.push(opts.sway ? Math.max(0, _p.y) * opts.sway : 0);
    }
    if (opts.flat) this.facet(start);
    return this;
  }

  // Recompute normals per triangle from `start` to the end.
  facet(start) {
    const p = this.pos, n = this.nor;
    for (let i = start; i < p.length; i += 9) {
      const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
      const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 9; k += 3) { n[i + k] = nx; n[i + k + 1] = ny; n[i + k + 2] = nz; }
    }
  }

  // A raw triangle. `hint` is the rough direction it should face.
  tri(a, b, c, color, hint) {
    _c1.set(color);
    if (hint) {
      const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = c[0] - a[0], by = c[1] - a[1], bz = c[2] - a[2];
      if ((ay * bz - az * by) * hint[0] + (az * bx - ax * bz) * hint[1] + (ax * by - ay * bx) * hint[2] < 0) { const t = b; b = c; c = t; }
    }
    const start = this.pos.length;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    for (let i = 0; i < 3; i++) { this.col.push(_c1.r, _c1.g, _c1.b); this.sway.push(0); }
    this.facet(start);
  }

  quad(a, b, c, d, color, hint) { this.tri(a, b, c, color, hint); this.tri(a, c, d, color, hint); }

  // Copy another Geo in, moved by a matrix.
  merge(g, matrix) {
    _nm.getNormalMatrix(matrix);
    for (let i = 0; i < g.pos.length; i += 3) {
      _p.set(g.pos[i], g.pos[i + 1], g.pos[i + 2]).applyMatrix4(matrix);
      this.pos.push(_p.x, _p.y, _p.z);
      _n.set(g.nor[i], g.nor[i + 1], g.nor[i + 2]).applyMatrix3(_nm).normalize();
      this.nor.push(_n.x, _n.y, _n.z);
      this.col.push(g.col[i], g.col[i + 1], g.col[i + 2]);
      this.sway.push(g.sway[i / 3]);
    }
  }

  get empty() { return this.pos.length === 0; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    return g;
  }
}

// ---------------------------------------------------------------- materials
export const shared = { time: { value: 0 }, wind: { value: 1 }, night: { value: 0 } };

function withWind(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.uWind = shared.wind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSway;\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          float g = sin(uTime * 1.3 + wp.x * 0.35 + wp.z * 0.27) * 0.6 + sin(uTime * 2.9 + wp.x * 1.3 - wp.z * 0.9) * 0.4;
          transformed.x += g * aSway * 0.07 * uWind;
          transformed.z += cos(uTime * 1.7 + wp.z * 0.5) * aSway * 0.04 * uWind;
        }`);
  };
  return m;
}

export const MAT = {
  solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
  leaf: withWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })),
  glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 }),
};
MAT.glow.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor.rgb;');
};

// A model made of up to three merged parts: solid, leafy (moves in the wind)
// and glowing (lights up at night).
export class Model {
  constructor() { this.solid = new Geo(); this.leaf = new Geo(); this.glow = new Geo(); }
  merge(m, matrix) { this.solid.merge(m.solid, matrix); this.leaf.merge(m.leaf, matrix); this.glow.merge(m.glow, matrix); }
  group() {
    const g = new THREE.Group();
    for (const k of ['solid', 'leaf', 'glow']) {
      if (this[k].empty) continue;
      const mesh = new THREE.Mesh(this[k].build(), MAT[k]);
      mesh.castShadow = k !== 'glow';
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }
}

// ---------------------------------------------------------------- day and night
const K = (h, top, hor, sun, si, amb, ai, fog) => ({ h, top: new THREE.Color(top), hor: new THREE.Color(hor), sun: new THREE.Color(sun), si, amb: new THREE.Color(amb), ai, fog: new THREE.Color(fog) });
const KEYS = [
  K(0, '#070b24', '#1a2a5c', '#9db4ff', 1.15, '#4c62b0', 1.05, '#18224c'),
  K(4.8, '#0a1030', '#22336a', '#9db4ff', 1.15, '#4c62b0', 1.05, '#1b2652'),
  K(6.1, '#35579c', '#ffae84', '#ffa868', 1.3, '#a898b8', 1.1, '#e2a990'),
  K(7.6, '#3c86d8', '#ffe2c2', '#ffe0b8', 2.4, '#b7cdf2', 1.1, '#d9dfe6'),
  K(10, '#2f84e4', '#cfeaff', '#fff6e6', 3.0, '#c2dcff', 1.2, '#cfe7f7'),
  K(15, '#3187e2', '#d3ecff', '#fff3df', 3.0, '#c2dcff', 1.2, '#cfe7f7'),
  K(17.8, '#4b7ccb', '#ffd39a', '#ffc27e', 2.6, '#d0c2cc', 1.2, '#ecc9a4'),
  K(19.3, '#3f4690', '#ff8f62', '#ff8c52', 1.9, '#c79aa6', 1.35, '#dd9a84'),
  K(20.3, '#1a2258', '#5a4680', '#b79acb', 0.9, '#6a62a8', 1.15, '#3a3468'),
  K(21.3, '#070b24', '#1a2a5c', '#9db4ff', 1.15, '#4c62b0', 1.05, '#18224c'),
  K(24, '#070b24', '#1a2a5c', '#9db4ff', 1.15, '#4c62b0', 1.05, '#18224c'),
];
const GREY = new THREE.Color('#8794a3');

export class Sky {
  constructor(scene) {
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x7a6a50, 1);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xcfe7f7, 0.0052);
    this.scene = scene;
    this.dir = new THREE.Vector3(0.4, 0.8, 0.4);
    this.cur = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), amb: new THREE.Color(), fog: new THREE.Color(), si: 1, ai: 1 };
    this.night = 0;

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: this.cur.top }, uHor: { value: this.cur.hor }, uSun: { value: this.dir }, uSunCol: { value: this.cur.sun }, uNight: { value: 0 }, uTime: shared.time, uDisc: { value: 1 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 vDir; uniform vec3 uTop, uHor, uSun, uSunCol; uniform float uNight, uTime, uDisc;
        float hash(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          vec3 c = mix(uHor, uTop, pow(smoothstep(-0.02, 0.75, h), 0.6));
          float sd = max(dot(d, uSun), 0.0);
          c += uSunCol * (pow(sd, 900.0) * 14.0 + pow(sd, 24.0) * 0.28) * uDisc;
          vec3 cell = floor(d * 170.0);
          float st = step(0.9965, hash(cell)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 3.0) * 40.0));
          c += vec3(0.9, 0.95, 1.0) * st * uNight * smoothstep(0.02, 0.3, d.y) * 2.2;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);
  }

  // hour 0..24, rain 0..1, focus = point the shadows should centre on.
  update(hour, rain, focus) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = clamp((hour - a.h) / (b.h - a.h));
    const c = this.cur;
    for (const k of ['top', 'hor', 'sun', 'amb', 'fog']) c[k].copy(a[k]).lerp(b[k], t);
    c.si = lerp(a.si, b.si, t); c.ai = lerp(a.ai, b.ai, t);
    if (rain > 0) {
      c.top.lerp(GREY, rain * 0.75); c.hor.lerp(GREY, rain * 0.6); c.fog.lerp(GREY, rain * 0.6);
      c.si *= 1 - rain * 0.55; c.sun.lerp(GREY, rain * 0.5);
    }
    const day = hour > 6 && hour < 20.2;
    if (day) {
      const ang = ((hour - 6) / 14.2) * Math.PI;
      this.dir.set(Math.cos(ang) * 0.85, Math.sin(ang) * 0.8 + 0.28, 0.5).normalize();
    } else this.dir.set(-0.45, 0.75, 0.42).normalize();
    this.night = 1 - smooth(5.6, 7, hour) + smooth(19.2, 20.6, hour);
    this.night = clamp(this.night);
    this.sun.color.copy(c.sun); this.sun.intensity = c.si;
    this.hemi.color.copy(c.amb); this.hemi.intensity = c.ai;
    this.scene.fog.color.copy(c.fog);
    this.scene.fog.density = 0.0052 + rain * 0.006;
    this.dome.material.uniforms.uNight.value = this.night * (1 - rain);
    this.dome.material.uniforms.uDisc.value = 1 - rain;
    // Snap the shadow box to whole texels so shadows don't shimmer as it moves.
    const step = 68 / 4096 * 4;
    const fx = Math.round(focus.x / step) * step, fz = Math.round(focus.z / step) * step;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + this.dir.x * 70, this.dir.y * 70, fz + this.dir.z * 70);
    this.dome.position.set(focus.x, 0, focus.z);
    shared.night.value = this.night;
    MAT.glow.emissiveIntensity = this.night * 3.2 + 0.15;
  }
}

// ---------------------------------------------------------------- post-processing
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class Post {
  constructor(renderer, camera) {
    this.r = renderer; this.camera = camera;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene();
    this.qscene.add(this.quad);
    this.focus = 30;
    this.blurAmount = 1;

    this.bright = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, px: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS, depthTest: false,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 px;
        void main(){
          vec3 c = texture2D(tex, vUv + px * vec2(-1., -1.)).rgb + texture2D(tex, vUv + px * vec2(1., -1.)).rgb
                 + texture2D(tex, vUv + px * vec2(-1., 1.)).rgb + texture2D(tex, vUv + px * vec2(1., 1.)).rgb;
          c *= 0.25;
          float l = max(c.r, max(c.g, c.b));
          gl_FragColor = vec4(c * smoothstep(0.85, 1.7, l), 1.0);
        }`,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS, depthTest: false,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir;
        void main(){
          vec3 c = texture2D(tex, vUv).rgb * 0.227;
          c += (texture2D(tex, vUv + dir * 1.385).rgb + texture2D(tex, vUv - dir * 1.385).rgb) * 0.316;
          c += (texture2D(tex, vUv + dir * 3.231).rgb + texture2D(tex, vUv - dir * 3.231).rgb) * 0.0703;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.final = new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: null }, depth: { value: null }, b2: { value: null }, b4: { value: null }, b8: { value: null },
        px: { value: new THREE.Vector2() }, near: { value: 1 }, far: { value: 100 }, focus: { value: 30 }, amount: { value: 1 },
        tint: { value: new THREE.Color(0.8, 0.8, 0.8) }, fade: { value: 0 },
      },
      vertexShader: QUAD_VS, depthTest: false,
      fragmentShader: `varying vec2 vUv;
        uniform sampler2D tex, depth, b2, b4, b8; uniform vec2 px; uniform float near, far, focus, amount, fade; uniform vec3 tint;
        float viewZ(vec2 uv){ float d = texture2D(depth, uv).x; return (near * far) / (far - d * (far - near)); }
        void main(){
          float z = viewZ(vUv);
          float coc = clamp((abs(z - focus) - focus * 0.1) / (focus * 0.55), 0.0, 1.0);
          coc = coc * coc * 7.0 * amount;
          vec3 c = texture2D(tex, vUv).rgb;
          if (coc > 0.6) {
            float a = 0.0; vec3 acc = c; float wsum = 1.0;
            for (int i = 1; i <= 14; i++) {
              a += 2.39996;
              float rr = sqrt(float(i) / 14.0) * coc;
              acc += texture2D(tex, vUv + vec2(cos(a), sin(a)) * rr * px).rgb; wsum += 1.0;
            }
            c = acc / wsum;
          }
          c += texture2D(b2, vUv).rgb * 0.35 + texture2D(b4, vUv).rgb * 0.5 + texture2D(b8, vUv).rgb * 0.65;
          c *= tint;
          c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);       // filmic curve
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 1.12);                                          // a little extra colour
          vec2 v = vUv - 0.5;
          c *= 1.0 - dot(v, v) * 0.55;                                        // soft dark corners
          c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
          c = mix(c, vec3(0.04, 0.05, 0.1), fade);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.resize(2, 2);
  }

  resize(w, h) {
    const mk = (ww, hh, depth) => {
      const rt = new THREE.WebGLRenderTarget(Math.max(1, ww | 0), Math.max(1, hh | 0), { type: THREE.HalfFloatType, depthBuffer: !!depth, samples: depth ? 4 : 0 });
      if (depth) { rt.depthTexture = new THREE.DepthTexture(ww | 0, hh | 0); rt.depthTexture.type = THREE.UnsignedIntType; }
      return rt;
    };
    for (const k of ['scene', 'a2', 'c2', 'a4', 'c4', 'a8', 'c8']) if (this[k]) { this[k].depthTexture?.dispose(); this[k].dispose(); }
    this.scene = mk(w, h, true);
    this.a2 = mk(w / 2, h / 2); this.c2 = mk(w / 2, h / 2);
    this.a4 = mk(w / 4, h / 4); this.c4 = mk(w / 4, h / 4);
    this.a8 = mk(w / 8, h / 8); this.c8 = mk(w / 8, h / 8);
    this.w = w; this.h = h;
  }

  pass(material, target) {
    this.quad.material = material;
    this.r.setRenderTarget(target);
    this.r.render(this.qscene, this.cam);
  }

  render(scene) {
    const r = this.r;
    r.setRenderTarget(this.scene);
    r.render(scene, this.camera);
    this.bright.uniforms.tex.value = this.scene.texture;
    this.bright.uniforms.px.value.set(0.5 / this.w, 0.5 / this.h);
    this.pass(this.bright, this.a2);
    const blur = (src, dst, x, y) => { this.blur.uniforms.tex.value = src.texture; this.blur.uniforms.dir.value.set(x, y); this.pass(this.blur, dst); };
    blur(this.a2, this.c2, 2 / this.w, 0); blur(this.c2, this.a2, 0, 2 / this.h);
    blur(this.a2, this.c4, 4 / this.w, 0); blur(this.c4, this.a4, 0, 4 / this.h);
    blur(this.a4, this.c8, 8 / this.w, 0); blur(this.c8, this.a8, 0, 8 / this.h);
    const u = this.final.uniforms;
    u.tex.value = this.scene.texture; u.depth.value = this.scene.depthTexture;
    u.b2.value = this.a2.texture; u.b4.value = this.a4.texture; u.b8.value = this.a8.texture;
    u.px.value.set(1 / this.w, 1 / this.h);
    u.near.value = this.camera.near; u.far.value = this.camera.far;
    u.focus.value = this.focus; u.amount.value = this.blurAmount * (this.h / 900);
    this.pass(this.final, null);
  }
}

// Draw onto a small canvas and use it as a texture.
export function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
