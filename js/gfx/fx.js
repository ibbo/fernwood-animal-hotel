// Small effects: floating hearts and sparkles, rain, fireflies, fireworks,
// tile highlights and the warm pools of light under lanterns.

import { THREE, shared, canvasTexture } from './core.js';
import { glowDiscTexture } from './props.js';
import { rand, TAU, hexCorners } from '../util.js';

const emoji = (ch) => canvasTexture(96, (c, s) => {
  c.font = `${s * 0.72}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ch, s / 2, s / 2 + s * 0.04);
});
const soft = (inner, outer) => canvasTexture(64, (c) => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
});

export class Fx {
  constructor(scene, world) {
    this.scene = scene;
    const mk = (map, opts = {}) => new THREE.SpriteMaterial({ map, depthWrite: false, transparent: true, ...opts });
    this.kinds = {
      heart: mk(emoji('💗')), star: mk(emoji('⭐')), leaf: mk(emoji('🍃')), note: mk(emoji('🎵')), zzz: mk(emoji('💤')),
      bubble: mk(emoji('🫧')), drop: mk(emoji('💧')), sparkle: mk(emoji('✨')),
      dust: mk(soft('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)')),
      smoke: mk(soft('rgba(235,235,240,0.55)', 'rgba(235,235,240,0)')),
    };
    const sparkTex = soft('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    for (const [k, c] of Object.entries({ spark0: '#ff6b8a', spark1: '#ffd24a', spark2: '#6fe6d2', spark3: '#b28cff', spark4: '#ffffff' })) {
      this.kinds[k] = mk(sparkTex, { blending: THREE.AdditiveBlending, color: new THREE.Color(c).multiplyScalar(2.4) });
    }
    this.live = [];
    this.pool = [];

    // Rain: streaks that wrap around a box that follows the camera.
    const N = 1500, pos = new Float32Array(N * 6), end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      pos.set([x, y, z, x, y, z], i * 6);
      end[i * 2 + 1] = 1;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: shared.time, uFocus: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uCol: { value: new THREE.Color(1.3, 1.45, 1.6) } },
      vertexShader: `attribute float aEnd; uniform float uTime; uniform vec3 uFocus; varying float vA;
        void main(){
          vec3 box = vec3(56.0, 26.0, 56.0);
          vec3 p = position * box;
          p.y = mod(p.y - uTime * 21.0 * (0.8 + position.x * 0.4), box.y);
          p.x = mod(p.x + uTime * 2.5 + uFocus.x * -1.0, box.x);
          p.z = mod(p.z - uFocus.z, box.z);
          p += vec3(uFocus.x - box.x * 0.5, 0.0, uFocus.z - box.z * 0.5);
          p.y += aEnd * 0.8; p.x -= aEnd * 0.09;
          vA = 0.5 + aEnd * 0.4;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'uniform float uAmount; uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA * uAmount); }',
    }));
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 5;
    scene.add(this.rain);

    // Fireflies near plants on land.
    const spots = world.list.filter((t) => !t.water && !t.town && (t.feat || t.biome === 'meadow' || t.biome === 'marsh'));
    const F = 170, fp = new Float32Array(F * 3), fs = new Float32Array(F);
    for (let i = 0; i < F; i++) {
      const t = spots[Math.floor(Math.random() * spots.length)];
      fp.set([t.x + rand(-0.8, 0.8), t.y + rand(0.3, 1.5), t.z + rand(-0.8, 0.8)], i * 3);
      fs[i] = Math.random() * 100;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
    this.flies = new THREE.Points(fg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.time, uNight: shared.night, uScale: { value: 600 } },
      vertexShader: `attribute float aSeed; uniform float uTime, uScale; varying float vB;
        void main(){
          vec3 p = position + vec3(sin(uTime * 0.6 + aSeed) * 0.7, sin(uTime * 0.9 + aSeed * 1.7) * 0.3, cos(uTime * 0.5 + aSeed * 2.3) * 0.7);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vB = 0.5 + 0.5 * sin(uTime * 2.2 + aSeed * 5.0);
          gl_PointSize = uScale * 0.3 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uNight; varying float vB;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(2.6, 2.4, 0.9) * a * a * vB * uNight, 1.0); }`,
    }));
    this.flies.frustumCulled = false;
    scene.add(this.flies);

    // Hex outlines for hover, range and choices.
    const ring = new THREE.RingGeometry(0.76, 0.9, 6, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 6);
    this.rings = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }), 80);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 3;
    scene.add(this.rings);
    const shape = new THREE.Shape(hexCorners(0.9).map(([x, z]) => new THREE.Vector2(x, z)));
    this.cursor = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false, color: '#ffffff' }));
    this.cursor.visible = false;
    this.cursor.renderOrder = 3;
    scene.add(this.cursor);

    this.poolMat = new THREE.MeshBasicMaterial({ map: glowDiscTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this._m = new THREE.Matrix4(); this._c = new THREE.Color();
  }

  // A little floating picture for something lying on the ground.
  marker(icon) {
    this.icons = this.icons || {};
    const mt = this.icons[icon] || (this.icons[icon] = new THREE.SpriteMaterial({ map: emoji(icon), transparent: true, depthWrite: false }));
    const s = new THREE.Sprite(mt);
    s.scale.setScalar(0.62);
    s.renderOrder = 4;
    return s;
  }

  // A warm circle of light on the ground, shown at night.
  lightPool(size = 4.2) {
    const m = new THREE.Mesh(this.poolGeo, this.poolMat);
    m.scale.setScalar(size);
    m.position.y = 0.06;
    m.renderOrder = 2;
    return m;
  }

  setRings(list) {
    let i = 0;
    for (const { tile, color, y } of list) {
      if (i >= 80) break;
      this.rings.setMatrixAt(i, this._m.makeTranslation(tile.x, (y ?? tile.y) + 0.04, tile.z));
      this.rings.setColorAt(i, this._c.set(color));
      i++;
    }
    this.rings.count = i;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }
  setCursor(tile, color, y) {
    this.cursor.visible = !!tile;
    if (tile) { this.cursor.position.set(tile.x, (y ?? tile.y) + 0.05, tile.z); this.cursor.material.color.set(color || '#ffffff'); }
  }

  // Throw out some particles. `o` can set speed, spread, life, size, gravity.
  burst(kind, x, y, z, n = 6, o = {}) {
    for (let i = 0; i < n; i++) {
      const s = this.pool.pop() || new THREE.Sprite();
      s.material = this.kinds[kind];
      const a = Math.random() * TAU, sp = (o.speed ?? 1) * rand(0.5, 1), up = o.up ?? 1.6;
      s.position.set(x + rand(-1, 1) * (o.spread ?? 0.25), y + rand(0, 0.2), z + rand(-1, 1) * (o.spread ?? 0.25));
      s.userData = { vx: Math.cos(a) * sp, vy: up * rand(0.7, 1.2), vz: Math.sin(a) * sp, g: o.gravity ?? 0.6, life: 0, max: (o.life ?? 1.3) * rand(0.8, 1.2), size: (o.size ?? 0.42) * rand(0.8, 1.2), grow: o.grow ?? 0, delay: i * (o.stagger ?? 0.05) };
      s.scale.setScalar(0.001);
      s.renderOrder = 6;
      this.scene.add(s);
      this.live.push(s);
    }
  }

  firework(x, y, z) {
    const kind = 'spark' + Math.floor(Math.random() * 5);
    for (let i = 0; i < 64; i++) {
      const s = this.pool.pop() || new THREE.Sprite();
      s.material = this.kinds[kind];
      const a = Math.random() * TAU, e = Math.acos(rand(-1, 1)), sp = rand(7, 9.5);
      s.position.set(x, y, z);
      s.userData = { vx: Math.sin(e) * Math.cos(a) * sp, vy: Math.cos(e) * sp, vz: Math.sin(e) * Math.sin(a) * sp, g: 2.6, drag: 2.4, life: 0, max: rand(1.2, 1.8), size: 0.34, grow: 0, delay: 0 };
      s.scale.setScalar(0.001);
      s.renderOrder = 6;
      this.scene.add(s);
      this.live.push(s);
    }
  }

  update(dt, focus, rain, zoom, light) {
    if (light) { this.kinds.smoke.color.copy(light); this.kinds.dust.color.copy(light); }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i], u = s.userData;
      if (u.delay > 0) { u.delay -= dt; continue; }
      u.life += dt;
      const k = u.life / u.max;
      if (k >= 1) { this.scene.remove(s); this.live.splice(i, 1); this.pool.push(s); continue; }
      u.vy -= u.g * dt;
      if (u.drag) { const d = Math.exp(-u.drag * dt); u.vx *= d; u.vy *= d; u.vz *= d; }
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      const sc = u.size * (1 + u.grow * k) * Math.min(1, k * 8) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
      s.scale.setScalar(Math.max(0.001, sc * zoom));
    }
    this.flies.material.uniforms.uScale.value = this.viewH || 900;
    this.rain.visible = rain > 0.01;
    this.rain.material.uniforms.uAmount.value = rain;
    this.rain.material.uniforms.uFocus.value.copy(focus);
    this.poolMat.opacity = shared.night.value * 0.8;
    this.cursor.material.opacity = 0.24 + Math.sin(shared.time.value * 5) * 0.08;
  }
}
