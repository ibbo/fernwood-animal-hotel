// Small maths helpers: random numbers, noise, easing and hex-grid geometry.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t) => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const TAU = Math.PI * 2;

// Shortest signed difference between two angles.
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Seeded random number generator.
export function rng(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const rand = (a, b) => a + (b - a) * Math.random();

// Repeatable hash of two integers, 0..1.
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth value noise, 0..1.
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, seed = 0, oct = 4) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise2(x, y, seed + i * 17);
    norm += amp;
    x *= 2.03; y *= 2.03; amp *= 0.5;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- hex grid
// Pointy-top hexes in axial coordinates (q, r). One hex is 1 unit from the
// centre to a corner.
export const SQ3 = Math.sqrt(3);
export const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
export const hexKey = (q, r) => q + ',' + r;
export const hexX = (q, r) => SQ3 * (q + r / 2);
export const hexZ = (q, r) => 1.5 * r;
export function hexDist(q1, r1, q2, r2) {
  const dq = q1 - q2, dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
export function worldToHex(x, z) {
  const r = z / 1.5;
  const q = x / SQ3 - r / 2;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}
// The six corners of a hex of the given radius, as [x, z] offsets.
export function hexCorners(radius = 1) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    out.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return out;
}
