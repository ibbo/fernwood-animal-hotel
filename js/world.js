// The island: a hex map made the same way every time, with five regions,
// the lodge, the pier and a hiding place for every wild friend.

import { rng, fbm, hash2, hexKey, hexX, hexZ, hexDist, DIRS, worldToHex } from './util.js';
import { BUILD, NATURAL, TILE_GIVES, WILD, REGIONS } from './data.js';

export const R = 16;
export const WATER_Y = 0.3;
export const levelY = (l) => 0.12 + l * 0.38 + Math.max(0, l - 3) * 0.28;
const SEED = 7;

const CENTERS = {
  cove: [0, 11, 1.12], woods: [-17, 3, 1], meadow: [17, 3, 1], lagoon: [-10, -12, 1.05], highrock: [11, -12, 1.05],
};
const BLOCKING = { oak: 1, pine: 1, willow: 1, palm: 1, rock: 1, lodge: 1, lodgeSide: 1, house: 1, clock: 1, lighthouse: 1 };
// Port Marlow sits on its own little island, south-east of the cove.
export const TOWN = { q: 5, r: 17, R: 6 };
const SHOPS = ['market', 'post', 'cafe', 'hotel', 'hall', 'toys'];

const clampN = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class World {
  constructor() {
    this.tiles = new Map();
    this.list = [];
    this.generate();
  }

  get(q, r) { return this.tiles.get(hexKey(q, r)); }
  at(x, z) { const [q, r] = worldToHex(x, z); return this.get(q, r); }
  neighbors(t) {
    const out = [];
    for (const [dq, dr] of DIRS) { const n = this.get(t.q + dq, t.r + dr); if (n) out.push(n); }
    return out;
  }
  // Tiles within `radius` steps (not the tile itself), each with its distance.
  around(t, radius = 2) {
    const out = [];
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
        if (!dq && !dr) continue;
        const n = this.get(t.q + dq, t.r + dr);
        if (n) out.push([n, hexDist(0, 0, dq, dr)]);
      }
    }
    return out;
  }

  generate() {
    const rand = rng(SEED);
    // 1. Land or sea, and which region.
    for (let q = -R - 3; q <= TOWN.q + TOWN.R + 3; q++) {
      for (let r = -R - 3; r <= TOWN.r + TOWN.R + 3; r++) {
        const dTown = hexDist(TOWN.q, TOWN.r, q, r);
        if (hexDist(0, 0, q, r) > R + 3 && dTown > TOWN.R + 3 && !this.nearBridgeLine(q, r)) continue;
        const x = hexX(q, r), z = hexZ(q, r);
        const d = Math.hypot(x / 28, z / 23);
        const n = fbm(x * 0.085 + 40, z * 0.085 + 40, SEED);
        let land = d + (n - 0.5) * 0.6 < 0.8 && hexDist(0, 0, q, r) <= R;
        if (Math.hypot(x - 0.5, (z - 20) * 0.8) < 3.6) land = false;     // the bay
        let region = 'cove', best = 1e9;
        for (const id in CENTERS) {
          const [cx, cz, w] = CENTERS[id];
          const dd = Math.hypot(x - cx, z - cz) / w + (fbm(x * 0.2, z * 0.2, SEED + id.length * 31, 2) - 0.5) * 3;
          if (dd < best) { best = dd; region = id; }
        }
        const t = { q, r, x, z, water: !land, region, level: 0, y: -0.6, biome: 'sea', feat: null, build: null, coast: 0, v: hash2(q, r, 3) };
        const dq = q - TOWN.q, dr = r - TOWN.r, spoke = dq === 0 || dr === 0 || dq + dr === 0;
        // The town is a six-sided island; five of its corners are cut off.
        if (dTown <= TOWN.R && !(dTown === TOWN.R && spoke && !(dq === TOWN.R && dr === 0))) {
          t.water = false; t.region = 'town'; t.town = { d: dTown, spoke }; t.clear = true;
        }
        this.tiles.set(hexKey(q, r), t);
        this.list.push(t);
      }
    }
    // 2. Distance from the sea.
    let frontier = this.list.filter((t) => t.water);
    for (const t of this.list) t.coast = t.water ? 0 : -1;
    for (let d = 1; frontier.length; d++) {
      const next = [];
      for (const t of frontier) for (const n of this.neighbors(t)) if (n.coast < 0) { n.coast = d; next.push(n); }
      frontier = next;
    }
    // 3. Heights and ground types.
    for (const t of this.list) {
      if (t.water) { t.y = -0.25 - Math.min(3, this.seaDepth(t)) * 0.22; continue; }
      const n = fbm(t.x * 0.16, t.z * 0.16, SEED + 5, 3);
      const c = t.coast;
      if (t.region === 'town') { t.level = t.town.d === TOWN.R ? 1 : 2; t.biome = t.town.d === TOWN.R ? 'quay' : 'paved'; }
      else if (t.region === 'cove') { t.level = c === 1 ? 1 : 2; t.biome = c === 1 ? 'sand' : 'grass'; }
      else if (t.region === 'meadow') { t.level = c === 1 ? 1 : n > 0.6 && c > 2 ? 3 : 2; t.biome = c === 1 ? 'sand' : 'meadow'; }
      else if (t.region === 'woods') { t.level = c === 1 ? 2 : n > 0.55 ? 3 : 2; t.biome = 'forest'; }
      else if (t.region === 'lagoon') {
        t.level = c === 1 || n < 0.48 ? 1 : 2; t.biome = 'marsh';
        if (c >= 2 && fbm(t.x * 0.33, t.z * 0.33, SEED + 9, 2) > 0.64) { t.water = true; t.pond = true; t.y = -0.05; t.biome = 'sea'; }
      } else {
        t.level = Math.min(7, 2 + Math.floor((c - 1) * 0.95 + n * 1.7));
        t.biome = t.level >= 6 ? 'snow' : t.level >= 4 ? 'rock' : 'forest';
      }
      if (!t.water) t.y = levelY(t.level);
    }
    // 4. The lodge and the pier.
    const cove = this.list.filter((t) => !t.water && t.region === 'cove');
    const nearest = (arr, x, z) => arr.reduce((a, b) => (Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b));
    this.lodge = nearest(cove.filter((t) => t.coast >= 3), 0, 9.5);
    this.lodgeTiles = [this.lodge, this.get(this.lodge.q - 1, this.lodge.r), this.get(this.lodge.q + 1, this.lodge.r)];
    for (const [t] of this.around(this.lodge, 2)) if (!t.water) { t.level = 2; t.y = levelY(2); t.biome = 'grass'; t.clear = true; }
    this.lodge.feat = { type: 'lodge' };
    this.lodgeTiles[1].feat = { type: 'lodgeSide' };
    this.lodgeTiles[2].feat = { type: 'lodgeSide' };
    this.lodgeDoor = this.get(this.lodge.q, this.lodge.r + 1);     // just south of the door

    let shore = null, dir = null, bestZ = -1e9;
    for (const t of cove) {
      if (t.coast !== 1 || Math.abs(t.x) > 4) continue;
      for (const d of [DIRS[1], DIRS[2]]) {
        const a = this.get(t.q + d[0], t.r + d[1]), b = this.get(t.q + d[0] * 2, t.r + d[1] * 2), c = this.get(t.q + d[0] * 3, t.r + d[1] * 3);
        if (a && b && c && a.water && b.water && c.water && t.z - Math.abs(t.x) * 0.5 > bestZ) { bestZ = t.z - Math.abs(t.x) * 0.5; shore = t; dir = d; }
      }
    }
    this.shore = shore;
    this.pier = [1, 2].map((i) => this.get(shore.q + dir[0] * i, shore.r + dir[1] * i));
    for (const p of this.pier) { p.pier = true; p.walkY = 0.66; }
    const end = this.pier[1];
    const dx = hexX(dir[0], dir[1]), dz = hexZ(dir[0], dir[1]), dl = Math.hypot(dx, dz);
    this.pierDir = [dx / dl, dz / dl];
    this.ferrySpot = { x: end.x + (dx / dl) * 2.3, z: end.z + (dz / dl) * 2.3 };
    shore.clear = true;
    this.waitSpots = [shore, ...this.neighbors(shore).filter((t) => !t.water)];
    for (const t of this.waitSpots) t.clear = true;
    // Keep a path from the pier to the lodge free of trees.
    for (let i = 0; i <= 12; i++) {
      const t = this.at(shore.x + (this.lodgeDoor.x - shore.x) * (i / 12), shore.z + (this.lodgeDoor.z - shore.z) * (i / 12));
      if (t) t.clear = true;
    }

    this.layTown(cove, nearest);

    // 5. Wild plants and rocks.
    const table = {
      grass: [['oak', 0.09], ['flowers', 0.08], ['rock', 0.025]],
      sand: [['palm', 0.1], ['rock', 0.05]],
      meadow: [['flowers', 0.3], ['oak', 0.05], ['rock', 0.03]],
      forest: [['oak', 0.26], ['pine', 0.2], ['shroom', 0.06], ['rock', 0.04], ['flowers', 0.04]],
      marsh: [['reeds', 0.24], ['willow', 0.13], ['rock', 0.03], ['flowers', 0.05]],
      rock: [['rock', 0.2], ['pine', 0.14]],
      snow: [['rock', 0.14], ['pine', 0.08]],
    };
    for (const t of this.list) {
      if (t.water || t.feat || t.clear || t.town) continue;
      let roll = rand();
      for (const [type, p] of table[t.biome]) {
        if (roll < p) { t.feat = { type, v: rand(), natural: true }; break; }
        roll -= p;
      }
    }
    // 6. Hiding places for wild friends.
    this.wildSpots = {};
    const taken = new Set();
    for (const id in WILD) {
      const w = WILD[id];
      let c = this.list.filter((t) => !t.water && t.region === w.region && !t.clear && !taken.has(t) && !BLOCKING[t.feat?.type]);
      if (id === 'bramble') c = c.filter((t) => { const d = hexDist(t.q, t.r, this.lodge.q, this.lodge.r); return d >= 4 && d <= 5 && t.biome === 'grass'; });
      else if (id === 'ripple') c = c.filter((t) => this.neighbors(t).some((n) => n.pond));
      else if (id === 'bao') c = c.filter((t) => t.level >= 5);
      else if (id === 'honeypaw') c = c.filter((t) => t.x > 19);
      else c = c.filter((t) => t.coast >= 2 && hexDist(t.q, t.r, this.lodge.q, this.lodge.r) >= 6);
      const spot = c[Math.floor(rand() * c.length)];
      spot.feat = null; spot.reserved = true;
      taken.add(spot);
      for (const n of this.neighbors(spot)) taken.add(n);
      this.wildSpots[id] = spot;
    }
    // 7. Make sure every open tile can be reached on foot.
    for (let pass = 0; pass < 40; pass++) {
      const seen = this.flood(this.lodgeDoor);
      const lost = this.list.find((t) => !t.water && !seen.has(t) && !BLOCKING[t.feat?.type]);
      if (!lost) break;
      // Clear a straight line from the lost tile back toward the lodge.
      const n = Math.ceil(Math.hypot(lost.x - this.lodgeDoor.x, lost.z - this.lodgeDoor.z));
      for (let i = 1; i <= n; i++) {
        const t = this.at(lost.x + (this.lodgeDoor.x - lost.x) * (i / n), lost.z + (this.lodgeDoor.z - lost.z) * (i / n));
        if (!t || t.water) continue;
        if (seen.has(t)) break;
        if (t.feat && t.feat.natural) t.feat = null;
      }
    }
  }

  // Tiles close to the straight line from the cove to the town, so the sea
  // under the bridge exists.
  nearBridgeLine(q, r) {
    const x = hexX(q, r), z = hexZ(q, r), ax = 10, az = 13, bx = hexX(TOWN.q, TOWN.r), bz = hexZ(TOWN.q, TOWN.r);
    const k = clampN(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2));
    return Math.hypot(x - (ax + (bx - ax) * k), z - (az + (bz - az) * k)) < 7;
  }

  // Streets, buildings, the bridge and where everyone stands in Port Marlow.
  layTown(cove, nearest) {
    const c = this.get(TOWN.q, TOWN.r), town = this.list.filter((t) => t.town);
    this.town = { centre: c, tiles: town, spots: {}, shops: {} };
    c.feat = { type: 'clock' };
    let shop = 0;
    for (const t of town) {
      const { d, spoke } = t.town;
      if (d === TOWN.R && spoke) { t.feat = { type: 'lighthouse' }; this.town.lighthouse = t; continue; }
      if (t === c || spoke || d === 1 || d === 3 || d === TOWN.R) continue;       // streets, the square and the quay
      const v = hash2(t.q, t.r, 41);
      t.feat = { type: 'house', v, floors: d === 2 ? 4 + Math.floor(v * 3) : d === 4 ? 2 + Math.floor(v * 3) : 2 + Math.floor(v * 2), out: d === 5 };
    }
    // The six buildings on the square are the shops, in order round the clock.
    const ring2 = town.filter((t) => t.town.d === 2 && !t.town.spoke).sort((a, b) => Math.atan2(a.z - c.z, a.x - c.x) - Math.atan2(b.z - c.z, b.x - c.x));
    for (const t of ring2) { t.feat.shop = SHOPS[shop++]; this.town.shops[t.feat.shop] = t; }
    const front = (t) => this.neighbors(t).find((n) => n.town && n.town.d === 1);
    this.town.spots.market = front(this.town.shops.market);
    this.town.spots.post = front(this.town.shops.post);
    this.town.spots.captain = this.neighbors(this.town.lighthouse).find((n) => n.town && n.town.spoke);
    // The bridge runs dead straight along the grid, from the cove to the quay:
    // the shortest such crossing wins.
    let line = null;
    for (const from of cove.filter((t) => t.coast === 1 && t.x > 4)) {
      for (const [dq, dr] of DIRS) {
        const run = [from];
        for (let i = 1; i <= 9; i++) {
          const t = this.get(from.q + dq * i, from.r + dr * i);
          if (!t) break;
          run.push(t);
          if (!t.water) { if (t.town && !t.feat && i > 1 && (!line || run.length < line.length)) line = run; break; }
        }
      }
    }
    const a = line[0], b = line[line.length - 1];
    for (const t of line) if (t.water) { t.pier = true; t.bridge = true; t.walkY = 0.74; }
    this.bridge = line;
    a.clear = true;
    for (const t of this.neighbors(a)) t.clear = true;
    for (let i = 0; i <= 14; i++) {
      const t = this.at(a.x + (this.lodgeDoor.x - a.x) * (i / 14), a.z + (this.lodgeDoor.z - a.z) * (i / 14));
      if (t) t.clear = true;
    }
    // The notice board stands in the square on the side nearest the bridge.
    this.town.board = nearest(town.filter((t) => t.town.d === 1 && t !== this.town.spots.market && t !== this.town.spots.post), b.x, b.z);
    this.town.board.feat = { type: 'board' };
    this.town.square = town.filter((t) => t.town.d === 1 || (t.town.d === 3 && !t.feat));
    this.town.streets = town.filter((t) => !BLOCKING[t.feat?.type]);
  }

  seaDepth(t) {
    let d = 9;
    for (const [n, dist] of this.around(t, 3)) if (!n.water) d = Math.min(d, dist);
    return d;
  }

  flood(start, stars = 9) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const t = queue.pop();
      for (const n of this.neighbors(t)) if (!seen.has(n) && this.walkable(n, stars)) { seen.add(n); queue.push(n); }
    }
    return seen;
  }

  // How well connected the island is: how many open tiles can be walked to
  // from the lodge, and how many builds have no free tile beside them.
  reach(stars) {
    const seen = this.flood(this.lodgeDoor, stars);
    let stranded = 0;
    for (const t of this.list) {
      if (!(t.build || t.feat?.type === 'lodge') || !this.blocked(t)) continue;
      if (!this.neighbors(t).some((n) => seen.has(n))) stranded++;
    }
    return { open: seen.size, stranded };
  }

  // Would putting something solid on this tile cut anything off? Nothing
  // that can be reached now may become unreachable, and every build must
  // keep a free tile beside it.
  wouldBlock(tile, stars) {
    const before = tile.build;
    let bad = false;
    for (const st of stars >= 4 ? [9] : [stars, 9]) {
      tile.build = before;
      const was = this.reach(st), lose = this.flood(this.lodgeDoor, st).has(tile) ? 1 : 0;
      tile.build = { type: 'burrow' };
      const now = this.reach(st);
      if (now.open < was.open - lose || now.stranded > was.stranded) { bad = true; break; }
    }
    tile.build = before;
    return bad;
  }

  open(t, stars) { return REGIONS[t.region].star <= stars; }
  blocked(t) { return !!(BLOCKING[t.feat?.type] || (t.build && !BUILD[t.build.type].walk)); }
  walkable(t, stars) {
    if (!t) return false;
    if (t.water) return !!t.pier;
    return this.open(t, stars) && !this.blocked(t);
  }
  canBuild(t, stars) {
    return !!t && !t.water && !t.town && !t.feat && !t.build && !t.reserved && this.open(t, stars) && t !== this.shore && t !== this.lodgeDoor && t !== this.bridge[0];
  }
  standY(t) { return t.pier ? t.walkY : t.y; }

  // Shortest walk between two tiles. If the goal can't be stood on, the walk
  // ends next to it. Returns the tiles to step through, or null.
  path(from, to, stars) {
    if (from === to) return [];
    const goalOk = this.walkable(to, stars);
    const prev = new Map([[from, null]]);
    const queue = [from];
    let found = null;
    for (let i = 0; i < queue.length && !found; i++) {
      const t = queue[i];
      for (const n of this.neighbors(t)) {
        if (prev.has(n)) continue;
        if (n === to) { prev.set(n, t); found = goalOk ? n : t; break; }
        if (!this.walkable(n, stars)) continue;
        prev.set(n, t);
        queue.push(n);
      }
    }
    if (!found) return null;
    const out = [];
    for (let t = found; t && t !== from; t = prev.get(t)) out.push(t);
    return out.reverse();
  }

  // Comfort points around a home.
  comfort(tile, type) {
    const a = { shade: 0, water: 0, bloom: 0, sun: 0, glow: 0, play: 0 };
    const add = (gives, w) => { for (const k in gives) a[k] += gives[k] * w; };
    if (type) add(BUILD[type].bonus || {}, 1);
    for (const [t, d] of this.around(tile, 2)) {
      const w = d === 1 ? 1 : 0.5;
      if (t.water) add(TILE_GIVES.water, w);
      else if (TILE_GIVES[t.biome]) add(TILE_GIVES[t.biome], w);
      if (t.feat && NATURAL[t.feat.type]) add(NATURAL[t.feat.type], w);
      if (t.build && BUILD[t.build.type].gives) add(BUILD[t.build.type].gives, w);
    }
    return a;
  }
}
