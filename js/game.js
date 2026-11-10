// The rules of the game: time, weather, the ferry, guests and their wishes,
// building, snacks, wild friends, stars and saving.

import { THREE } from './gfx/core.js';
import { Critter } from './gfx/critters.js';
import { buildModel, ferryModel } from './gfx/props.js';
import { BUILD, SPECIES, WILD, STARS, REGIONS, ITEMS, ASPECTS, GUEST_NAMES, HOUR_SECONDS, FULL, FIND, FINDS, NPCS, LOCALS, LOCAL_CHAT, NEW_STATS, newState } from './data.js';
import { clamp, lerp, rand, pick, angDiff, backOut, easeInOut, hash2, hexDist } from './util.js';

const SAVE_KEY = 'fernwood2.save';
const WISH_ICON = { cuddle: '🤗', play: '🎾', wash: '🫧' };
const WISH_TEXT = { cuddle: 'a cuddle', play: 'to play', wash: 'a bubble bath' };

export class Actor {
  constructor(game, species, tile, look) {
    this.game = game;
    this.species = species;
    this.c = new Critter(species, look);
    this.root = this.c.root;
    game.scene.add(this.root);
    this.path = []; this.then = null;
    this.speed = 2.3; this.heading = 0; this.turn = 0;
    this.base = 'idle'; this.actT = 0; this.moving = false; this.hidden = false;
    this.place(tile);
  }
  place(tile) {
    this.tile = tile; this.x = tile.x; this.z = tile.z; this.y = this.game.world.standY(tile);
    this.path = []; this.then = null;
  }
  walk(path, then) { this.path = path.slice(); this.then = then || null; if (!this.path.length && then) { this.then = null; then(); } }
  face(x, z) { this.turn = Math.atan2(x - this.x, z - this.z); }
  act(anim, secs) { this.c.set(anim); this.actT = secs; }
  show(v) { this.hidden = !v; this.root.visible = v; }
  remove() { this.game.scene.remove(this.root); }
  // Swap the model for one with a different look (keepers only).
  setLook(look) {
    const old = this.root;
    this.c = new Critter(this.species, look);
    this.root = this.c.root;
    this.root.visible = old.visible;
    this.game.scene.remove(old);
    this.game.scene.add(this.root);
  }
  update(dt, t) {
    const w = this.game.world;
    if (this.path.length) {
      const n = this.path[0], dx = n.x - this.x, dz = n.z - this.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= step) {
        this.x = n.x; this.z = n.z; this.tile = n; this.path.shift();
        if (!this.path.length && this.then) { const f = this.then; this.then = null; f(); }
      } else { this.x += (dx / d) * step; this.z += (dz / d) * step; this.turn = Math.atan2(dx, dz); }
    }
    const walking = this.path.length > 0 || this.moving;
    this.moving = false;
    if (this.actT > 0) this.actT -= dt;
    if (this.remote) { /* the shared world says what this one is doing */ }
    else if (walking) { this.c.set('walk'); this.actT = 0; }
    else if (this.actT <= 0) this.c.set(this.base);
    const under = w.at(this.x, this.z) || this.tile;
    const ty = under.water && !under.pier ? this.y : w.standY(under);
    this.y += (ty - this.y) * Math.min(1, dt * 12);
    this.heading += angDiff(this.heading, this.turn) * Math.min(1, dt * 11);
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.heading;
    if (!this.hidden && !this.game.headless) this.c.update(dt, t);
  }
}

export class Game {
  // `shared` is a world several keepers play in at once (it runs on the
  // server); `headless` skips the drawing-only work.
  constructor({ world, scene, fx, mist, hooks, shared = false, headless = false }) {
    this.world = world; this.scene = scene; this.fx = fx; this.mist = mist; this.h = hooks;
    this.shared = shared; this.headless = headless;
    this.keepers = new Map();       // player id → keeper
    this.keeper = null;             // the keeper acting right now
    this.me = null;                 // the keeper this player controls (none on the server)
    this.state = null;
    this.models = new Map();        // build id → model
    this.guestActors = new Map();   // guest id → actor
    this.wildActors = new Map();    // wild id → actor
    this.rain = 0;
    this.tick = 0;
    this.party = 0;
    this.ferry = ferryModel();
    this.ferry.visible = false;
    scene.add(this.ferry);
    this.fishTile = world.pier[1];
    this.npcs = new Map();          // shop id → actor
    this.locals = [];               // townsfolk out for a walk
    this.touristActors = new Map(); // visitor id → actor
    this.findModels = new Map();    // find id → floating picture
    this.findT = 0;
  }

  // Each keeper has their own mode, selection, task, fishing line and bed.
  // The rules read and write them through whoever is acting.
  get mode() { return this.keeper ? this.keeper.mode : null; }                 // { type: 'place' | 'remove' | 'assign', ... }
  set mode(v) { if (this.keeper) this.keeper.mode = v; }
  get selected() { return this.keeper ? this.keeper.selected : null; }
  set selected(v) { if (this.keeper) this.keeper.selected = v; }
  get busy() { return this.keeper ? this.keeper.busy : null; }
  set busy(v) { if (this.keeper) this.keeper.busy = v; }
  get fishing() { return this.keeper ? this.keeper.fishing : null; }           // { phase: 'wait' | 'bite', t }
  set fishing(v) { if (this.keeper) this.keeper.fishing = v; }
  get sleeping() { return this.keeper ? this.keeper.sleeping : false; }
  set sleeping(v) { if (this.keeper) this.keeper.sleeping = v; }
  get allAsleep() { if (!this.keepers.size) return false; for (const k of this.keepers.values()) if (!k.sleeping) return false; return true; }
  // Do something as one keeper.
  as(k, f) {
    const prev = this.keeper;
    this.keeper = k;
    try { return f(); } finally { this.keeper = prev; }
  }
  addKeeper(pid, name, look, tile) {
    const k = new Actor(this, 'keeper', tile || this.world.lodgeDoor, look);
    Object.assign(k, { pid, name: name || 'Keeper', look, speed: 4.2, mode: null, selected: null, busy: null, fishing: null, sleeping: false, tips: null });
    k.heading = k.turn = 0;
    this.keepers.set(pid, k);
    return k;
  }
  removeKeeper(pid) {
    const k = this.keepers.get(pid);
    if (!k) return;
    k.remove();
    this.keepers.delete(pid);
    if (this.keeper === k) this.keeper = null;
  }
  // Who a homeless animal trots after: whoever befriended it, else whoever is closest.
  leader(g, a) {
    const own = this.keepers.get(g.owner);
    if (own && !own.sleeping) return own;
    let best = null, bd = 1e9;
    for (const k of this.keepers.values()) { const d = Math.hypot(k.x - a.x, k.z - a.z); if (d < bd) { bd = d; best = k; } }
    return best;
  }

  // ---------------------------------------------------------------- start, save, load
  static load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      return s && s.v === 1 ? s : null;
    } catch { return null; }
  }
  // Write where everyone is standing into the state, ready to be saved.
  sync() {
    const s = this.state;
    for (const g of s.guests) { const a = this.guestActors.get(g.id); if (a) { g.q = a.tile.q; g.r = a.tile.r; } }
    if (this.me) { s.kq = this.me.tile.q; s.kr = this.me.tile.r; }
    return s;
  }
  save() {
    if (!this.state || this.shared) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.sync())); } catch { /* storage may be off */ }
  }
  static wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

  start(saved, name, look) {
    const w = this.world;
    const s = this.state = saved || newState(name);
    // Hotels saved before Port Marlow existed get the new bits filled in.
    for (const k in NEW_STATS) if (s.stats[k] === undefined) s.stats[k] = 0;
    for (const [k, v] of [['finds', []], ['jobs', []], ['tourists', []], ['rep', 0], ['parcel', null], ['nextTourist', 0]]) if (s[k] === undefined) s[k] = v;
    if (!saved) s.builds.push({ id: s.nextId++, type: 'fishspot', q: this.fishTile.q, r: this.fishTile.r, grow: 0.6, fixed: true });
    for (const b of s.builds) this.addModel(b, true);
    if (!this.shared) {
      this.me = this.keeper = this.addKeeper('solo', s.name, look, (saved && w.get(s.kq, s.kr)) || w.lodgeDoor);
      this.me.tips = s.tips;
    }
    for (const g of [...s.guests]) {
      const a = this.spawnGuest(g, w.get(g.q, g.r) || w.shore);
      if (g.st === 'leaving') this.sendOff(g, a);
    }
    this.lastHour = Math.floor(s.clock);
    if (!saved) this.spawnArrivals(true);
    this.startTown();
    s.finds = s.finds.filter((f) => this.showFind(f));
    if (!s.finds.length) for (let i = 0; i < 12; i++) this.spawnFind();
    while (s.jobs.length < 3) s.jobs.push(this.newJob());
    this.refreshWild();
    this.updateFerry(0);
    this.h.changed();
  }

  get hour() { return this.state.clock % 24; }
  get day() { return Math.floor(this.state.clock / 24) + 1; }
  get night() { const h = this.hour; return h >= 21 || h < 6; }
  build(id) { return this.state.builds.find((b) => b.id === id); }
  tileOf(b) { return this.world.get(b.q, b.r); }
  rooms() { return this.state.builds.filter((b) => BUILD[b.type].room); }
  freeRooms() { return this.rooms().filter((b) => !b.occ); }
  guest(id) { return this.state.guests.find((g) => g.id === id); }

  // ---------------------------------------------------------------- comfort and joy
  comfortAt(species, tile, type) {
    const a = this.world.comfort(tile, type);
    const loves = SPECIES[species].loves;
    return { a, value: (clamp(a[loves[0]] / FULL) + clamp(a[loves[1]] / FULL)) / 2 };
  }
  comfort(g) {
    const b = g.room && this.build(g.room);
    return b ? this.comfortAt(g.species, this.tileOf(b), b.type).value : 0;
  }
  joy(g) { return clamp(0.3 + 0.4 * this.comfort(g) + g.wishJoy); }
  hearts(g) { return clamp(Math.round(this.joy(g) * 5), 1, 5); }

  // ---------------------------------------------------------------- models
  addModel(b, quiet) {
    const t = this.tileOf(b), def = BUILD[b.type];
    const g = buildModel(b.type);
    g.position.set(t.x, this.world.standY(t), t.z);
    if (!def.room && !def.fixed && b.type !== 'lantern') g.rotation.y = hash2(b.q, b.r, 5) * 6.28;
    if (b.type === 'fishspot') g.rotation.y = Math.atan2(this.world.pierDir[0], this.world.pierDir[1]);
    const gl = def.gives?.glow;
    if (gl || def.room) g.add(this.fx.lightPool(def.room ? 3.2 : 4.6));
    if (g.userData.fruit) g.userData.fruit.visible = b.grow >= 1;
    g.userData.pop = quiet ? 1 : 0;
    if (!quiet) g.scale.setScalar(0.01);
    this.scene.add(g);
    this.models.set(b.id, g);
    t.build = b;
  }

  // ---------------------------------------------------------------- building
  canPlace(tile, type) {
    const s = this.state, def = BUILD[type];
    if (!this.world.canBuild(tile, s.stars)) return 'Nothing can go there.';
    if (s.leaves < def.cost) return `You need ${def.cost} leaves for that.`;
    if (!def.walk) {
      for (const k of this.keepers.values()) if (k.tile === tile) return k === this.keeper ? 'You are standing there!' : `${k.name} is standing there.`;
      for (const a of [...this.guestActors.values(), ...this.wildActors.values()]) if (a.tile === tile && !a.hidden) return 'Someone is standing there.';
      if (this.world.wouldBlock(tile, s.stars)) return 'That would block the way. Leave a path to walk along.';
    }
    return null;
  }
  place(tile, type) {
    const why = this.canPlace(tile, type);
    if (why) { this.h.toast(why); this.h.sound('no'); return false; }
    const s = this.state, def = BUILD[type];
    const b = { id: s.nextId++, type, q: tile.q, r: tile.r, grow: 0, occ: null };
    s.builds.push(b);
    s.leaves -= def.cost;
    this.addModel(b);
    this.fx.burst('dust', tile.x, tile.y + 0.2, tile.z, 9, { speed: 1.6, up: 0.6, size: 0.7, life: 0.7, gravity: 0, grow: 1.5, stagger: 0 });
    this.h.sound('build');
    this.h.changed();
    return true;
  }
  remove(b) {
    const def = BUILD[b.type];
    if (def.fixed) return this.h.toast('That stays where it is.');
    if (b.occ) return this.h.toast('Someone lives there. Wait until they go home.');
    const t = this.tileOf(b), s = this.state;
    s.builds.splice(s.builds.indexOf(b), 1);
    t.build = null;
    this.scene.remove(this.models.get(b.id));
    this.models.delete(b.id);
    const back = Math.floor(def.cost / 2);
    s.leaves += back;
    this.fx.burst('dust', t.x, t.y + 0.2, t.z, 7, { speed: 1.4, up: 0.5, size: 0.6, life: 0.6, gravity: 0, grow: 1.5, stagger: 0 });
    this.h.float(`+${back} 🍃`, t);
    this.h.sound('pop');
    if (this.selected?.ref === b) this.select(null);
    this.h.changed();
  }

  // ---------------------------------------------------------------- guests
  spawnGuest(g, tile) {
    const a = new Actor(this, g.species, tile);
    a.speed = 1.9;
    a.g = g;
    a.heading = a.turn = rand(-1, 1);
    this.guestActors.set(g.id, a);
    if (g.st === 'home' && this.night) this.tuckIn(g, a);
    return a;
  }
  newGuest(species) {
    const s = this.state;
    const used = new Set(s.guests.map((g) => g.name));
    const names = GUEST_NAMES.filter((n) => !used.has(n));
    const g = { id: s.nextId++, species, name: pick(names.length ? names : GUEST_NAMES), st: 'waiting', room: null, wishJoy: 0, left: 2 + Math.floor(Math.random() * 2), wish: null, nextWish: 0, resident: null, q: 0, r: 0 };
    s.guests.push(g);
    s.seen[species] = true;
    return g;
  }
  spawnArrivals(first) {
    const s = this.state, w = this.world;
    const waiting = s.guests.filter((g) => g.st === 'waiting' || g.st === 'following').length;
    const free = this.freeRooms().length;
    const cap = 1 + (s.stars >= 1 ? 1 : 0) + (s.stars >= 3 ? 1 : 0);
    let n = Math.min(cap, Math.max(free - waiting, waiting === 0 ? 1 : 0), 3 - waiting);
    if (first) n = 1;
    const pool = Object.keys(SPECIES).filter((k) => SPECIES[k].star <= s.stars);
    const here = new Set(s.guests.map((g) => g.species));
    for (let i = 0; i < n; i++) {
      const fresh = pool.filter((k) => !here.has(k));
      const species = first ? 'rabbit' : pick(fresh.length ? fresh : pool);
      here.add(species);
      const g = this.newGuest(species);
      const a = this.spawnGuest(g, first ? w.waitSpots[0] : w.pier[1]);
      if (!first) {
        const spot = w.waitSpots[(waiting + i) % w.waitSpots.length];
        a.walk(w.path(a.tile, spot, 9) || [], () => a.face(a.x, a.z + 5));
        a.root.position.y = 0.6;
      }
    }
    if (n > 0 && !first) { this.h.toast(n === 1 ? 'A guest has arrived on the ferry!' : `${n} guests have arrived on the ferry!`, '⛴️'); this.h.sound('bell'); }
    this.h.changed();
  }

  // Send a guest (or a rescued friend) to a home.
  assign(g, b) {
    const a = this.guestActors.get(g.id), t = this.tileOf(b), s = this.state;
    b.occ = g.id; g.room = b.id; g.st = 'home';
    g.nextWish = s.clock + rand(0.8, 1.6);
    s.stats.welcomed++;
    this.mode = null;
    const done = () => {
      a.face(a.x, a.z + 3);
      a.act('happy', 1.6);
      const c = this.comfort(g);
      this.fx.burst('heart', a.x, a.y + 0.7, a.z, c > 0.75 ? 7 : c > 0.4 ? 4 : 2, { up: 1.5 });
      this.h.sound('happy');
      this.h.toast(c >= 0.999 ? `${g.name} loves this home!` : c > 0.6 ? `${g.name} really likes it here.` : c > 0.3 ? `${g.name} thinks it is nice.` : `${g.name} moves in. It could be cosier…`, c > 0.6 ? '💗' : '🏡');
      this.tip('cosy', `Click a home to see what is nearby. ${g.name} loves ${ASPECTS[SPECIES[g.species].loves[0]].icon} and ${ASPECTS[SPECIES[g.species].loves[1]].icon}: build those close to the home.`);
    };
    const p = this.world.path(a.tile, t, s.stars);
    if (p) a.walk(p, done); else { a.place(this.nearFree(t) || a.tile); done(); }
    this.select({ kind: 'guest', ref: g });
    this.h.changed();
  }
  nearFree(t) { return this.world.neighbors(t).find((n) => this.world.walkable(n, this.state.stars)); }

  tuckIn(g, a) { a.asleep = true; a.show(false); a.path = []; g.wish = null; }
  wake(g, a) {
    a.asleep = false;
    const t = this.nearFree(this.tileOf(this.build(g.room)));
    if (t) a.place(t);
    a.show(true);
    g.nextWish = this.state.clock + rand(0.4, 2.5);
  }

  makeWish(g) {
    const s = this.state;
    const foods = SPECIES[g.species].foods.filter((f) => Object.values(BUILD).some((d) => d.grows === f && d.star <= s.stars));
    const roll = Math.random();
    const kind = roll < 0.52 && foods.length ? 'snack' : roll < 0.7 ? 'cuddle' : roll < 0.86 ? 'play' : 'wash';
    g.wish = { kind, item: kind === 'snack' ? pick(foods) : null, until: s.clock + 5 };
    const a = this.guestActors.get(g.id);
    if (a) { a.path = []; a.c.pop(); }
    this.h.sound('wish');
  }

  grant(g) {
    const s = this.state, a = this.guestActors.get(g.id), k = this.keeper, wsh = g.wish;
    if (!a || g.st !== 'home') return;        // they left while the keeper was on the way
    k.face(a.x, a.z); a.face(k.x, k.z);
    if (!wsh) {
      // No wish: a friendly pat, good for a little joy once a day.
      a.act('happy', 1.1); k.act('wave', 1.0);
      this.fx.burst('heart', a.x, a.y + 0.6, a.z, 2);
      if (g.pet !== this.day) { g.pet = this.day; g.wishJoy = Math.min(0.45, g.wishJoy + 0.03); }
      this.h.sound('chirp');
      return;
    }
    if (wsh.kind === 'snack') {
      const give = s.inv[wsh.item] > 0 ? wsh.item : s.inv.cake > 0 ? 'cake' : null;
      if (!give) {
        this.h.toast(`${g.name} would like ${ITEMS[wsh.item].name}. Get some from ${ITEMS[wsh.item].from}, or buy some at the market.`, ITEMS[wsh.item].icon);
        this.h.sound('no');
        return;
      }
      s.inv[give]--;
    }
    const secs = wsh.kind === 'snack' ? 1.3 : 1.9;
    k.act('work', secs);
    a.act(wsh.kind === 'snack' ? 'eat' : wsh.kind === 'wash' ? 'wash' : 'happy', secs + 0.6);
    const fxKind = { snack: 'sparkle', cuddle: 'heart', play: 'note', wash: 'bubble' }[wsh.kind];
    this.fx.burst(fxKind, a.x, a.y + 0.5, a.z, wsh.kind === 'wash' ? 12 : 6, { stagger: 0.14, up: 1.3 });
    g.wish = null;
    this.busy = { t: secs, done: () => {
      g.wishJoy = Math.min(0.45, g.wishJoy + 0.1);
      g.nextWish = s.clock + rand(2.2, 4);
      s.stats.wishes++;
      s.leaves += 3; s.stats.earned += 3;
      a.act('happy', 1.2);
      this.fx.burst('heart', a.x, a.y + 0.7, a.z, 4);
      this.h.float('+3 🍃', a);
      this.h.sound('happy');
      this.h.changed();
    } };
    this.h.changed();
  }

  // A guest whose stay is over walks to the ferry.
  sendOff(g, a) {
    g.st = 'leaving'; g.wish = null;
    a.speed = 2.4;
    const p = this.world.path(a.tile, this.world.pier[1], 9);
    if (p && p.length) a.walk(p, () => this.checkout(g)); else this.checkout(g);
  }

  checkout(g) {
    const s = this.state, a = this.guestActors.get(g.id);
    const hearts = this.hearts(g), pay = 8 + hearts * 5 + SPECIES[g.species].pay * 4;
    s.leaves += pay; s.stats.earned += pay; s.stats.checkouts++;
    if (hearts >= 4) s.stats.happy++;
    if (hearts === 5) s.stats.five++;
    const b = this.build(g.room);
    if (b) b.occ = null;
    s.guests.splice(s.guests.indexOf(g), 1);
    if (s.parcel?.kind === 'guest' && s.parcel.id === g.id) { s.parcel = null; this.h.toast(`${g.name} has gone home, so Quill took the parcel back.`, '📦'); }
    if (a) {
      this.fx.burst('heart', a.x, a.y + 0.6, a.z, hearts, { up: 2 });
      this.fx.burst('leaf', a.x, a.y + 0.6, a.z, 5, { speed: 1.5 });
      a.remove();
      this.guestActors.delete(g.id);
    }
    if (this.selected?.ref === g) this.select(null);
    this.h.review(g, hearts, pay);
    this.h.sound('coin');
    this.h.changed();
  }

  // ---------------------------------------------------------------- wild friends
  wildVisible(id) {
    const d = WILD[id], s = this.state;
    if (s.wild[id]?.rescued || REGIONS[d.region].star > s.stars) return false;
    if (d.when === 'night') return this.hour >= 20 || this.hour < 5.5;
    if (d.when === 'rain') return this.rain > 0.3;
    return true;
  }
  refreshWild() {
    for (const id in WILD) {
      const vis = this.wildVisible(id);
      let a = this.wildActors.get(id);
      if (vis && !a) {
        a = new Actor(this, WILD[id].species, this.world.wildSpots[id]);
        a.base = 'sit'; a.wild = id; a.heading = a.turn = rand(-1, 1);
        this.wildActors.set(id, a);
        this.fx.burst('sparkle', a.x, a.y + 0.5, a.z, 3);
      } else if (!vis && a) { a.remove(); this.wildActors.delete(id); }
    }
  }
  wildNeeds(id) {
    const given = this.state.wild[id]?.given || {};
    return Object.entries(WILD[id].needs).map(([item, n]) => ({ item, n, given: given[item] || 0, have: this.state.inv[item] || 0 }));
  }
  giveWild(id) {
    const s = this.state, w = s.wild[id] || (s.wild[id] = { given: {}, rescued: false });
    const a = this.wildActors.get(id);
    let gave = 0, left = 0;
    for (const need of this.wildNeeds(id)) {
      const n = Math.min(need.n - need.given, need.have);
      if (n > 0) { s.inv[need.item] -= n; w.given[need.item] = need.given + n; gave += n; }
      left += need.n - need.given - Math.max(0, n);
    }
    if (!gave) { this.h.sound('no'); return false; }
    a.act('eat', 1.4); this.keeper.act('work', 1);
    this.fx.burst('heart', a.x, a.y + 0.6, a.z, 3 + gave);
    this.h.sound('happy');
    if (left <= 0) {
      // Friends now: the animal follows the keeper home.
      w.rescued = true;
      const d = WILD[id];
      const g = { id: s.nextId++, species: d.species, name: d.name, st: 'following', room: null, wishJoy: 0.1, left: 0, wish: null, nextWish: 0, resident: id, q: a.tile.q, r: a.tile.r, owner: this.keeper.pid };
      s.guests.push(g); s.seen[d.species] = true;
      this.wildActors.delete(id);
      a.wild = null; a.g = g; a.base = 'idle'; a.speed = 3.2;
      this.guestActors.set(g.id, a);
      this.fx.burst('star', a.x, a.y + 0.8, a.z, 8, { speed: 2, up: 2.4 });
      this.h.banner(`${d.name} is your friend!`, this.freeRooms().length ? `Click ${d.name}, then choose a home.` : `Build a home for ${d.name}, then click them.`, '🐾');
      this.h.sound('star');
    }
    this.h.changed();
    return true;
  }

  // ---------------------------------------------------------------- snacks
  // A plant can be watered when it is growing and the soil has dried out.
  thirsty(b) {
    const def = BUILD[b.type];
    return !!def.grows && b.grow < 1 && b._ok !== false && this.rain < 0.5 && this.state.clock >= (b.wet || 0);
  }
  ripen(b) {
    b.grow = 1;
    const m = this.models.get(b.id), t = this.tileOf(b);
    if (m.userData.fruit) m.userData.fruit.visible = true;
    m.userData.pop = 0.55;
    this.fx.burst('sparkle', t.x, this.world.standY(t) + 0.8, t.z, 3);
  }
  // Click a plant: pick it if it is ripe, water it if it is thirsty.
  tend(b) {
    if (b.grow >= 1 || !this.thirsty(b)) return this.harvest(b);
    const def = BUILD[b.type], s = this.state, t = this.tileOf(b), bees = b.type === 'hive';
    b.grow = Math.min(1, b.grow + 0.3);
    b.wet = s.clock + 0.45;
    s.stats.watered++;
    this.keeper.act('work', 0.7);
    this.fx.burst(bees ? 'note' : 'drop', t.x, this.world.standY(t) + 0.9, t.z, 6, { speed: 0.9, up: 0.5, gravity: 1.6, life: 0.8, size: 0.3 });
    this.h.sound('pop');
    if (b.grow >= 1) { this.ripen(b); this.h.float(`${ITEMS[def.grows].icon} ripe!`, t); }
    else this.h.float(bees ? '🎵 buzz!' : '💧 grows!', t);
    this.tip('water', 'Watering makes a plant grow straight away. It gets thirsty again a few moments later, so keep coming back.');
    this.h.changed();
  }
  harvest(b) {
    const def = BUILD[b.type], s = this.state, t = this.tileOf(b);
    if (!def.grows) return;
    if (b.grow < 1) {
      if (def.needs && this.world.comfort(t)[def.needs] < 2) this.h.toast('The bees need flowers close by to make honey.', '🌸');
      else if (this.rain >= 0.5) this.h.toast('The rain is watering it for you. Nearly there!', '🌧️');
      else this.h.toast('Just watered! It will be thirsty again in a moment.', '💧');
      return;
    }
    b.grow = 0;
    s.inv[def.grows] = (s.inv[def.grows] || 0) + def.yield;
    s.stats.harvested += def.yield;
    if (def.grows === 'honey') s.stats.honey++;
    const m = this.models.get(b.id);
    if (m.userData.fruit) m.userData.fruit.visible = false;
    m.userData.pop = 0.6;
    this.keeper.act('work', 0.7);
    this.fx.burst('sparkle', t.x, this.world.standY(t) + 0.7, t.z, 4);
    this.h.float(`+${def.yield} ${ITEMS[def.grows].icon}`, t);
    this.h.sound('pick');
    this.h.changed();
  }

  // ---------------------------------------------------------------- fishing
  get bobber() { const t = this.fishTile, [dx, dz] = this.world.pierDir; return { x: t.x + dx * 1.07, y: 0.5, z: t.z + dz * 1.07 }; }
  cast() {
    if (this.fishing) return;
    const k = this.keeper, [dx, dz] = this.world.pierDir;
    k.face(k.x + dx, k.z + dz);
    k.base = 'sit';
    this.fishing = { phase: 'wait', t: rand(1.2, 3) };
    this.h.sound('pop');
    this.tip('fish', 'Wait for the float to dip, then click anywhere to hook the fish. Click in time and you land two!');
    this.h.changed();
  }
  hook() {
    if (this.fishing?.phase !== 'bite') return false;
    this.land(2);
    return true;
  }
  land(n) {
    const s = this.state, b = this.bobber;
    s.inv.fish = (s.inv.fish || 0) + n;
    s.stats.harvested += n; s.stats.fished += n;
    this.fx.burst('drop', b.x, 0.4, b.z, 7, { speed: 1.4, up: 1.8, gravity: 3, life: 0.7, size: 0.28 });
    this.h.float(`+${n} 🐟`, this.keeper);
    this.h.sound(n > 1 ? 'happy' : 'pick');
    this.keeper.act(n > 1 ? 'happy' : 'work', 0.6);
    this.fishing = { phase: 'wait', t: rand(1.4, 3.2) };
    this.h.changed();
  }
  stopFishing() { if (this.fishing) { this.fishing = null; this.keeper.base = 'idle'; } }

  // ---------------------------------------------------------------- things to find
  showFind(f) {
    const t = this.world.get(f.q, f.r);
    if (!t || t.find || !FIND[f.kind]) return false;
    t.find = f;
    const m = this.fx.marker(FIND[f.kind].icon);
    m.position.set(t.x, this.world.standY(t) + 0.42, t.z);
    m.userData.y = m.position.y; m.userData.seed = t.v * 20;
    this.scene.add(m);
    this.findModels.set(f.id, m);
    return true;
  }
  spawnFind() {
    const s = this.state, w = this.world;
    const counts = {};
    for (const f of s.finds) { const r = w.get(f.q, f.r).region; counts[r] = (counts[r] || 0) + 1; }
    const short = Object.keys(FINDS).filter((id) => REGIONS[id].star <= s.stars && (counts[id] || 0) < FINDS[id].cap);
    if (!short.length) return null;
    const id = pick(short), kinds = FINDS[id].kinds;
    let roll = Math.random() * kinds.reduce((a, k) => a + k[1], 0), kind = kinds[0][0];
    for (const [k, wt] of kinds) { if (roll < wt) { kind = k; break; } roll -= wt; }
    if (this.night && id !== 'town' && Math.random() < 0.5) kind = 'star';
    const def = FIND[kind], seen = w.flood(w.lodgeDoor, s.stars);
    const here = new Set([...this.keepers.values()].map((k) => k.tile));
    const ok = (t) => t.region === id && seen.has(t) && !t.water && !t.feat && !t.build && !t.find && !t.reserved && t !== w.lodgeDoor && !here.has(t);
    let tiles = w.list.filter((t) => ok(t) && (!def.shore || t.coast === 1));
    if (!tiles.length) tiles = w.list.filter(ok);
    if (!tiles.length) return null;
    const t = pick(tiles), f = { id: s.nextId++, kind, q: t.q, r: t.r };
    s.finds.push(f);
    this.showFind(f);
    return f;
  }
  dropFind(f) {
    const t = this.world.get(f.q, f.r), m = this.findModels.get(f.id), s = this.state;
    if (t.find === f) t.find = null;
    if (m) { this.scene.remove(m); this.findModels.delete(f.id); }
    const i = s.finds.indexOf(f);
    if (i >= 0) s.finds.splice(i, 1);
  }
  pickFind(t) {
    const f = t.find, def = FIND[f.kind], s = this.state;
    this.dropFind(f);
    s.stats.found++;
    if (def.leaves) { s.leaves += def.leaves; s.stats.earned += def.leaves; this.h.float(`+${def.leaves} 🍃`, t); this.h.sound('coin'); }
    else {
      s.inv[def.item] = (s.inv[def.item] || 0) + 1;
      if (ITEMS[def.item].snack) s.stats.harvested++;
      this.h.float(`+1 ${def.icon}`, t);
      this.h.sound('pick');
    }
    this.fx.burst('sparkle', t.x, this.world.standY(t) + 0.5, t.z, 3);
    this.tip('find', 'Things you find go in your bag. Marigold at the market in Port Marlow buys them, and the notice board there asks for them.');
    this.h.changed();
  }

  // ---------------------------------------------------------------- Port Marlow
  startTown() {
    const w = this.world, c = w.town.centre, s = this.state;
    for (const id in NPCS) {
      const a = new Actor(this, NPCS[id].species, w.town.spots[id]);
      a.npc = id;
      a.heading = a.turn = Math.atan2(c.x - a.x, c.z - a.z);
      this.npcs.set(id, a);
    }
    LOCALS.forEach((l, i) => {
      const a = new Actor(this, l.species, w.town.streets[(i * 13 + 7) % w.town.streets.length]);
      a.local = i; a.speed = 1.3; a.heading = a.turn = i * 1.3;
      this.locals.push(a);
    });
    for (const t of s.tourists) this.spawnTourist(t);
  }
  spawnTourist(t) {
    const a = new Actor(this, t.species, pick(this.world.town.square));
    a.tourist = t; a.speed = 1.3; a.heading = a.turn = rand(-3, 3);
    this.touristActors.set(t.id, a);
    return a;
  }
  newTourist() {
    const s = this.state;
    const used = new Set([...s.guests.map((g) => g.name), ...s.tourists.map((t) => t.name)]);
    const names = GUEST_NAMES.filter((n) => !used.has(n));
    const t = { id: s.nextId++, species: pick(Object.keys(SPECIES).filter((k) => SPECIES[k].star <= s.stars)), name: pick(names.length ? names : GUEST_NAMES) };
    s.tourists.push(t);
    this.spawnTourist(t);
  }
  // Ask a visitor in the square to come and stay.
  invite(a) {
    const s = this.state, t = a.tourist;
    if (!t) return false;
    const homeless = s.guests.filter((g) => g.st === 'waiting' || g.st === 'following').length;
    if (this.freeRooms().length <= homeless) {
      this.h.toast(`${t.name} would love to stay, but every home is taken. Build another one first!`, '🏡');
      this.h.sound('no');
      return false;
    }
    s.tourists.splice(s.tourists.indexOf(t), 1);
    this.touristActors.delete(t.id);
    const g = this.newGuest(t.species);
    g.name = t.name; g.st = 'following'; g.owner = this.keeper.pid;
    a.tourist = null; a.g = g; a.speed = 3.4; a.path = [];
    this.guestActors.set(g.id, a);
    s.stats.invited++;
    s.nextTourist = s.clock + rand(0.6, 1.4);
    a.act('happy', 1.2);
    this.fx.burst('heart', a.x, a.y + 0.7, a.z, 4);
    this.h.sound('happy');
    this.h.toast(`${g.name} the ${SPECIES[g.species].name} is coming to stay! Walk home, then click ${g.name} to choose a home.`, '🧳');
    this.h.changed();
    return true;
  }
  // The roam of everyone who just wanders about town.
  stroll(a, dt, tiles) {
    if (a.hold > 0) { a.hold -= dt; return; }
    a.wander = (a.wander ?? rand(1, 7)) - dt;
    if (a.wander > 0 || a.path.length) return;
    a.wander = rand(3, 10);
    const p = this.world.path(a.tile, pick(tiles), 9);
    if (p && p.length <= 9) a.walk(p);
  }

  // Jobs on the notice board: bring some things, get leaves.
  newJob() {
    const s = this.state, pool = new Map();
    for (const id in FINDS) {
      if (REGIONS[id].star > s.stars) continue;
      for (const [k, wt] of FINDS[id].kinds) if (FIND[k].item) pool.set(FIND[k].item, (pool.get(FIND[k].item) || 0) + wt);
    }
    pool.set('fish', 3);
    for (const d of Object.values(BUILD)) if (d.grows && d.star <= s.stars) pool.set(d.grows, (pool.get(d.grows) || 0) + 2);
    if (s.stars >= 1) pool.set('star', 1);
    const asked = new Set(s.jobs.flatMap((j) => Object.keys(j.needs)));
    // One job on the board is always an easy one, from close to home.
    const EASY = ['shell', 'wood', 'feather', 'berries', 'carrot', 'fish'];
    const easy = (j) => Object.keys(j.needs).length && Object.keys(j.needs).every((k) => EASY.includes(k));
    const others = s.jobs.filter((j) => Object.keys(j.needs).length);
    if (others.length >= 2 && !others.some(easy)) for (const k of [...pool.keys()]) if (!EASY.includes(k)) pool.delete(k);
    const draw = () => {
      let opts = [...pool].filter(([k]) => !asked.has(k));
      if (!opts.length) opts = [...pool];
      let roll = Math.random() * opts.reduce((a, o) => a + o[1], 0);
      for (const [k, wt] of opts) { if (roll < wt) { asked.add(k); return k; } roll -= wt; }
      return opts[0][0];
    };
    const needs = {};
    const count = (k) => (ITEMS[k].sell >= 7 ? 1 : s.rep < 2 ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2));
    const first = draw();
    needs[first] = count(first);
    if (s.rep >= 3 && Math.random() < 0.4) { const k = draw(); if (!needs[k]) needs[k] = count(k); }
    const busy = new Set(s.jobs.map((j) => j.who));
    const free = LOCALS.map((_, i) => i).filter((i) => !busy.has(i));
    const worth = Object.entries(needs).reduce((a, [k, n]) => a + ITEMS[k].sell * n, 0);
    return { id: s.nextId++, who: pick(free.length ? free : [0]), needs, pay: Math.round(worth * 2.2 + 5) };
  }
  jobReady(j) { return Object.entries(j.needs).every(([k, n]) => (this.state.inv[k] || 0) >= n); }
  handIn(j) {
    const s = this.state, i = s.jobs.indexOf(j);
    if (i < 0 || !this.jobReady(j)) { this.h.sound('no'); return false; }
    for (const k in j.needs) s.inv[k] -= j.needs[k];
    s.leaves += j.pay; s.stats.earned += j.pay; s.stats.jobs++;
    s.jobs[i] = this.newJob();
    this.thanks(LOCALS[j.who].name, j.pay);
    return true;
  }
  // Take a job off the board and pin up a different one.
  skipJob(j) {
    const s = this.state, i = s.jobs.indexOf(j);
    if (i < 0) return;
    s.jobs[i] = { ...j, needs: {} };          // so the new one asks for something else
    s.jobs[i] = this.newJob();
    this.h.sound('pop');
    this.h.changed();
  }
  // Leaves, a cheer, and one more good turn for the town.
  thanks(name, pay) {
    const s = this.state, k = this.keeper;
    s.rep++;
    this.fx.burst('leaf', k.x, k.y + 0.8, k.z, 5, { speed: 1.5 });
    this.h.float(`+${pay} 🍃`, k);
    this.h.sound('coin');
    k.act('happy', 0.9);
    const fresh = Object.values(BUILD).filter((d) => d.rep === s.rep);
    this.h.toast(`${name} says thank you! +${pay} leaves` + (fresh.length ? `<br>New in Build, under Town goods: <b>${fresh.map((d) => d.icon + ' ' + d.name).join(', ')}</b>` : ''), fresh.length ? '🎁' : '💛');
    this.h.changed();
  }

  // Parcels from the post office.
  takeParcel() {
    const s = this.state;
    if (s.parcel) return false;
    const guests = s.guests.filter((g) => g.st === 'home').map((g) => ({ kind: 'guest', id: g.id, name: g.name, pay: 14, where: 'at Fernwood' }));
    const town = [...LOCALS.map((l, i) => ({ kind: 'local', id: i, name: l.name, pay: 7, where: 'out for a walk in town' })), { kind: 'npc', id: 'captain', name: NPCS.captain.name, pay: 9, where: 'at the lighthouse' }];
    s.parcel = guests.length && Math.random() < 0.5 ? pick(guests) : pick(town);
    this.h.toast(`A parcel for <b>${s.parcel.name}</b>, ${s.parcel.where}. Look for the 📦 bubble.`, '📦');
    this.h.sound('pick');
    this.h.changed();
    return true;
  }
  parcelActor() {
    const p = this.state.parcel;
    if (!p) return null;
    return p.kind === 'guest' ? this.guestActors.get(p.id) : p.kind === 'local' ? this.locals[p.id] : this.npcs.get(p.id);
  }
  deliver() {
    const s = this.state, p = s.parcel, a = this.parcelActor();
    if (!p || !a) return false;
    s.parcel = null;
    s.leaves += p.pay; s.stats.earned += p.pay; s.stats.parcels++;
    if (p.kind === 'guest') { const g = this.guest(p.id); if (g) g.wishJoy = Math.min(0.45, g.wishJoy + 0.05); }
    a.act('happy', 1.4);
    this.fx.burst('heart', a.x, a.y + 0.7, a.z, 3);
    this.thanks(p.name, p.pay);
    return true;
  }

  // The market.
  buyPrice(item) { return item === 'cake' ? 14 : ITEMS[item].sell * 3 + 2; }
  stock() {
    const s = this.state;
    return ['cake', 'fish', ...Object.values(BUILD).filter((d) => d.grows && d.star <= s.stars).map((d) => d.grows)];
  }
  sell(item, n = 1) {
    const s = this.state;
    n = Math.min(n, s.inv[item] || 0);
    if (n <= 0) return false;
    const pay = n * ITEMS[item].sell;
    s.inv[item] -= n;
    s.leaves += pay; s.stats.earned += pay; s.stats.sold += n;
    this.h.sound('coin');
    this.h.changed();
    return true;
  }
  buy(item) {
    const s = this.state, price = this.buyPrice(item);
    if (s.leaves < price) { this.h.sound('no'); return false; }
    s.leaves -= price;
    s.inv[item] = (s.inv[item] || 0) + 1;
    this.h.sound('pick');
    this.h.changed();
    return true;
  }

  // Everyone the player can click.
  actors() { return [...this.guestActors.values(), ...this.wildActors.values(), ...this.npcs.values(), ...this.locals, ...this.touristActors.values()]; }

  // ---------------------------------------------------------------- the keeper
  goTo(tile, then) {
    if (this.busy || this.sleeping) return;
    this.stopFishing();
    const k = this.keeper;
    const p = this.world.path(k.tile, tile, this.state.stars);
    if (!p) { this.h.toast('There is no way to walk there.'); return; }
    k.walk(p, () => { if (tile !== k.tile) k.face(tile.x, tile.z); if (then) then(); });
  }
  // Walk to a plant and look after it, or to the fishing spot and cast.
  tendAt(b) { this.goTo(this.tileOf(b), () => { if (this.state.builds.includes(b)) this.tend(b); }); }
  castAt(b) { this.goTo(this.tileOf(b), () => this.cast()); }
  goToActor(a, then) {
    if (this.busy || this.sleeping) return;
    this.stopFishing();
    const k = this.keeper;
    if (hexDist(k.tile.q, k.tile.r, a.tile.q, a.tile.r) <= 1) { then(); return; }
    const p = this.world.path(k.tile, a.tile, this.state.stars);
    if (!p) { this.h.toast('There is no way to walk there.'); return; }
    if (p.length && p[p.length - 1] === a.tile) p.pop();       // stop next to them
    a.path = []; a.hold = 6;
    k.walk(p, then);
  }
  move(dx, dz, dt) {
    if (this.busy || this.sleeping) return;
    const k = this.keeper, w = this.world, st = this.state.stars;
    this.stopFishing();
    k.path = []; k.then = null;
    const sp = k.speed * dt;
    const tryMove = (nx, nz) => {
      const t = w.at(nx, nz);
      if (!w.walkable(t, st)) return false;
      k.x = nx; k.z = nz; k.tile = t;
      return true;
    };
    if (!tryMove(k.x + dx * sp, k.z + dz * sp)) tryMove(k.x + dx * sp, k.z) || tryMove(k.x, k.z + dz * sp);
    k.turn = Math.atan2(dx, dz);
    k.moving = true;
  }
  // In a shared world a keeper's own screen walks them, then tells the world where they are.
  pushTo(x, z, turn) {
    const k = this.keeper, t = this.world.at(x, z);
    if (!k || k.busy || k.sleeping || !this.world.walkable(t, this.state.stars)) return false;
    this.stopFishing();
    k.path = []; k.then = null;
    k.x = x; k.z = z; k.tile = t; k.turn = turn; k.pushed = 0.25;
    return true;
  }
  goHome() { if (this.sleeping) return; this.stopFishing(); this.keeper.place(this.world.lodgeDoor); this.busy = null; }

  sleep() {
    this.stopFishing();
    this.sleeping = true;
    this.keeper.show(false);
    this.keeper.path = []; this.keeper.then = null;
    this.mode = null;
    this.h.sound('sleep');
    if (!this.allAsleep) this.h.toast('The night will fly by once every keeper is in bed. Click anywhere to get up again.', '😴');
  }
  getUp() {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.keeper.place(this.world.lodgeDoor);
    this.keeper.show(true);
  }
  // Say hello to the other keepers.
  wave() { if (!this.sleeping) { this.keeper.act('wave', 1.6); this.keeper.waveT = 2.2; this.h.sound('chirp'); } }

  select(sel) { this.selected = sel; this.h.select(sel); }
  setMode(mode) { this.mode = mode; this.h.changed(); }

  tip(key, text) {
    const tips = this.keeper?.tips || this.state.tips;
    if (tips[key]) return;
    tips[key] = 1;
    this.h.tip(text);
  }

  // The player clicked an animal.
  clickActor(a) {
    if (this.busy || this.sleeping) return;
    const meet = (f) => this.goToActor(a, () => { this.keeper.face(a.x, a.z); if (!a.npc) a.face(this.keeper.x, this.keeper.z); f(); });
    const mine = () => this.parcelActor() === a;
    if (a.npc) { meet(() => (mine() ? this.deliver() : this.h.openShop(a.npc))); return; }
    if (a.tourist) { meet(() => this.invite(a)); return; }
    if (a.local !== undefined) {
      meet(() => {
        if (mine()) { this.deliver(); return; }
        a.act('happy', 1); this.keeper.act('wave', 0.9);
        this.fx.burst('heart', a.x, a.y + 0.6, a.z, 1);
        this.h.sound('chirp');
        this.h.toast(`<b>${LOCALS[a.local].name}:</b> ${pick(LOCAL_CHAT)}`, '💬');
      });
      return;
    }
    if (a.wild) {
      this.goToActor(a, () => { this.keeper.face(a.x, a.z); a.face(this.keeper.x, this.keeper.z); this.h.openWild(a.wild); });
      return;
    }
    const g = a.g;
    if (!g) return;
    this.select({ kind: 'guest', ref: g });
    if (g.st === 'waiting' || g.st === 'following') {
      if (!this.freeRooms().length) { this.h.toast(`${g.name} needs a home. Build one first!`, '🏡'); this.h.sound('no'); return; }
      this.setMode({ type: 'assign', guest: g });
      this.h.sound('pop');
      return;
    }
    if (g.st === 'home' && !a.asleep) this.goToActor(a, () => (mine() ? this.deliver() : this.grant(g)));
  }

  // The player clicked a tile.
  clickTile(t) {
    if (this.sleeping) { if (!this.allAsleep) this.getUp(); return; }
    const m = this.mode, s = this.state;
    if (m?.type === 'place') { this.place(t, m.build); return; }
    if (m?.type === 'remove') { if (t.build) this.remove(t.build); return; }
    if (m?.type === 'assign') {
      if (t.build && BUILD[t.build.type].room && !t.build.occ) this.assign(m.guest, t.build);
      else this.h.toast('Pick a home with a glowing ring.');
      return;
    }
    if (t.build) {
      const def = BUILD[t.build.type];
      this.select({ kind: def.room ? 'room' : 'build', ref: t.build });
      const b = t.build;
      if (def.grows) this.tendAt(b);
      else if (def.fish) this.goTo(t, () => this.cast());
      return;
    }
    if (t.feat?.type === 'board') { this.select(null); this.goTo(t, () => this.h.openBoard()); return; }
    const keeperOf = t.feat?.shop ? this.npcs.get(t.feat.shop) : t.feat?.type === 'lighthouse' ? this.npcs.get('captain') : null;
    if (keeperOf) { this.clickActor(keeperOf); return; }
    if (t.feat?.type === 'lodge' || t.feat?.type === 'lodgeSide') { this.goTo(this.world.lodgeDoor, () => { this.keeper.face(this.world.lodge.x, this.world.lodge.z); this.h.openLodge(); }); return; }
    this.select(null);
    if (!t.water || t.pier) {
      if (!this.world.open(t, s.stars) && !t.water) { this.h.toast(`${REGIONS[t.region].name} is still hidden in the mist. Earn ${REGIONS[t.region].star === 1 ? 'your first star' : 'more stars'} to explore it.`, '☁️'); return; }
      this.goTo(t);
    }
  }

  // ---------------------------------------------------------------- time
  onHour(h) {
    const s = this.state;
    if (h === 6) {
      // A new day.
      let gifts = 0;
      for (const g of s.guests) {
        if (g.st !== 'home') continue;
        if (g.resident) { gifts += Math.round(3 + 6 * this.joy(g)); g.wishJoy = Math.max(0, g.wishJoy * 0.85 - 0.01); }
        else g.left--;
      }
      if (gifts) { s.leaves += gifts; s.stats.earned += gifts; this.h.toast(`Your friends left you thank-you gifts: +${gifts} leaves`, '🎁'); }
      s.nextRain--;
      if (s.nextRain <= 0) {
        const from = Math.floor(s.clock / 24) * 24 + rand(9.5, 13);
        s.rainFrom = from; s.rainTo = from + rand(3, 5);
        s.nextRain = 2 + Math.floor(Math.random() * 2);
      }
      for (const f of s.finds.filter((x) => x.kind === 'star')) this.dropFind(f);      // star shards fade at dawn
      this.save();
    }
    if (h === 8) this.spawnArrivals();
    if (h === 9) {
      for (const g of [...s.guests]) {
        if (g.resident || g.st !== 'home' || g.left > 0) continue;
        const a = this.guestActors.get(g.id);
        if (a.asleep) this.wake(g, a);
        this.sendOff(g, a);
      }
    }
    this.h.changed();
  }

  updateFerry(dt) {
    const h = this.hour, w = this.world, f = this.ferry;
    const [dx, dz] = w.pierDir, px = -dz, pz = dx;                  // sideways to the pier
    const s = w.ferrySpot;
    let k = -1, leaving = false;
    if (h >= 7 && h < 8) k = easeInOut(h - 7);
    else if (h >= 8 && h < 11.5) k = 1;
    else if (h >= 11.5 && h < 12.5) { k = 1 - easeInOut(h - 11.5); leaving = true; }
    f.visible = k >= 0;
    if (k < 0) return;
    const side = 1, u = 1 - k;       // it comes and goes by the south-west, clear of the bridge
    // A curve that ends side-on at the pier.
    const cx = s.x + px * 16 * side + dx * 1, cz = s.z + pz * 16 * side + dz * 1;
    const fx = s.x + px * 55 * side + dx * 16, fz = s.z + pz * 55 * side + dz * 16;
    const x = k * k * s.x + 2 * k * u * cx + u * u * fx, z = k * k * s.z + 2 * k * u * cz + u * u * fz;
    const tx = 2 * k * (s.x - cx) + 2 * u * (cx - fx), tz = 2 * k * (s.z - cz) + 2 * u * (cz - fz);
    const t = performance.now() / 1000;
    f.position.set(x, 0.14 + Math.sin(t * 1.6) * 0.04, z);
    f.rotation.set(Math.sin(t * 1.3) * 0.02, Math.atan2(tx * (leaving ? -1 : 1), tz * (leaving ? -1 : 1)), Math.sin(t * 1.1) * 0.03);
    if (k < 0.97 && Math.random() < dt * 9) this.fx.burst('smoke', x - Math.sin(f.rotation.y), 2.4, z - Math.cos(f.rotation.y), 1, { speed: 0.2, up: 1.1, gravity: -0.2, size: 0.55, grow: 1.6, life: 1.5, spread: 0.05 });
  }

  update(dt, t) {
    const s = this.state;
    if (!s) return;
    const w = this.world;
    // The clock.
    const speed = this.allAsleep ? 55 : this.timeScale || 1;
    const home = this.shared ? null : this.me;
    const before = Math.floor(s.clock);
    s.clock += (dt / HOUR_SECONDS) * speed;
    for (let h = before + 1; h <= Math.floor(s.clock); h++) this.onHour(h % 24);
    if (this.hour >= 6 && this.hour < 7) {
      for (const k of this.keepers.values()) {
        if (!k.sleeping) continue;
        this.as(k, () => {
          k.sleeping = false;
          k.place(w.lodgeDoor);
          k.show(true);
          k.act('happy', 1.2);
          this.h.banner(`Day ${this.day}`, 'Good morning, ' + k.name + '!', '🌅');
          this.h.sound('morning');
        });
      }
    }
    const raining = s.clock >= s.rainFrom && s.clock < s.rainTo;
    this.rain = clamp(this.rain + (raining ? dt : -dt) * 0.25);

    const dh = (dt / HOUR_SECONDS) * speed;
    const night = this.night;
    // Each keeper in turn.
    for (const k of [...this.keepers.values()]) {
      this.keeper = k;
      if (k.busy) {
        k.busy.t -= dt;
        if (k.busy.t <= 0) { const f = k.busy.done; k.busy = null; f(); }
      }
      if (k.waveT > 0) k.waveT -= dt;
      if (k.pushed > 0) { k.pushed -= dt; k.moving = true; }
      k.update(dt, t);
      if (k.c.anim === 'walk' && !k.hidden) {
        k.stepT = (k.stepT || 0) - dt;
        if (k.stepT <= 0) { k.stepT = 0.22; this.fx.burst('dust', k.x, k.y + 0.05, k.z, 1, { speed: 0.3, up: 0.25, gravity: 0, size: 0.28, grow: 1.4, life: 0.5, spread: 0.08 }); }
      }
      const kt = k.tile;
      if (kt.find && !k.sleeping) this.pickFind(kt);
      if (k.fishing) {
        const f = k.fishing;
        f.t -= dt;
        if (kt !== this.fishTile) this.stopFishing();
        else if (f.t <= 0 && f.phase === 'wait') { f.phase = 'bite'; f.t = 1.5; this.h.sound('wish'); const b = this.bobber; this.fx.burst('drop', b.x, 0.4, b.z, 3, { speed: 0.6, up: 0.9, gravity: 2.5, life: 0.5, size: 0.2 }); }
        else if (f.t <= 0) this.land(1);
      }
    }
    this.keeper = home;
    const keeperTiles = new Set([...this.keepers.values()].map((k) => k.tile));
    for (const m of this.findModels.values()) m.position.y = m.userData.y + Math.sin(t * 2.4 + m.userData.seed) * 0.07;
    this.findT += dh;
    if (this.findT > 0.2) { this.findT = 0; this.spawnFind(); }
    // Port Marlow goes about its day.
    const town = w.town;
    for (const a of this.npcs.values()) a.update(dt, t);
    for (const a of this.locals) { this.stroll(a, dt, town.streets); a.update(dt, t); }
    for (const a of this.touristActors.values()) { this.stroll(a, dt, town.square); a.update(dt, t); }

    // Guests.
    for (const g of [...s.guests]) {
      const a = this.guestActors.get(g.id);
      if (!a) continue;
      if (a.hold > 0) a.hold -= dt;
      if (g.st === 'following') {
        a.followT = (a.followT || 0) - dt;
        const k = this.leader(g, a);
        if (k && a.followT <= 0 && ![...this.keepers.values()].some((o) => o.mode?.guest === g)) {
          a.followT = 0.5;
          if (hexDist(a.tile.q, a.tile.r, k.tile.q, k.tile.r) > 1) {
            const p = w.path(a.tile, k.tile, s.stars);
            if (p) { if (p[p.length - 1] === k.tile) p.pop(); a.walk(p); } else a.place(this.nearFree(k.tile) || k.tile);
          }
        }
      } else if (g.st === 'home') {
        const b = this.build(g.room), home = this.tileOf(b);
        if (night && !a.asleep) {
          if (!a.path.length && !a.goingBed) {
            a.goingBed = true;
            const p = w.path(a.tile, home, s.stars);
            const bed = () => { a.goingBed = false; if (this.night) this.tuckIn(g, a); };
            if (p) a.walk(p, bed); else bed();
          }
        } else if (!night && a.asleep) this.wake(g, a);
        else if (!night && !a.asleep) {
          if (g.wish && s.clock > g.wish.until) { g.wish = null; g.wishJoy = Math.max(-0.2, g.wishJoy - 0.04); g.nextWish = s.clock + rand(1.5, 3); }
          if (!g.wish && s.clock >= g.nextWish && !a.path.length && a.actT <= 0) this.makeWish(g);
          // Potter about near home.
          a.wander = (a.wander ?? rand(2, 6)) - dt;
          if (a.wander <= 0 && !a.path.length && !(a.hold > 0) && !g.wish && a.actT <= 0) {
            a.wander = rand(4, 10);
            const opts = w.around(home, 2).map(([n]) => n).filter((n) => w.walkable(n, s.stars) && !keeperTiles.has(n));
            if (opts.length) {
              const p = w.path(a.tile, pick(opts), s.stars);
              if (p && p.length <= 5) { a.speed = 1.2; a.walk(p); }
            }
          }
        }
      }
      a.update(dt, t);
    }
    for (const a of this.wildActors.values()) a.update(dt, t);

    // Snack plants grow, a little faster in the rain.
    for (const b of s.builds) {
      const def = BUILD[b.type], m = this.models.get(b.id);
      if (m.userData.pop < 1) {
        m.userData.pop = Math.min(1, m.userData.pop + dt * 2.6);
        m.scale.setScalar(Math.max(0.01, backOut(m.userData.pop)));
      }
      if (!def.grows || b.grow >= 1) continue;
      if (def.needs && b._ok === false) continue;
      b.grow += (dh / def.hours) * (this.rain > 0.5 ? 1.7 : 1);
      if (b.grow >= 1) this.ripen(b);
    }

    this.updateFerry(dt);

    // Slower checks, a few times a second.
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.4;
      for (const b of s.builds) if (BUILD[b.type].needs) b._ok = w.comfort(this.tileOf(b))[BUILD[b.type].needs] >= 2;
      this.refreshWild();
      if (!s.stats.town && [...keeperTiles].some((kt) => kt.town)) {
        s.stats.town = 1;
        this.h.banner('Port Marlow', 'Jobs on the notice board, a market, a post office and visitors to invite.', '🏙️');
        this.h.sound('bell');
      }
      if (s.tourists.length < 2 && s.clock >= s.nextTourist && this.hour >= 6.5 && this.hour < 20.5) { this.newTourist(); s.nextTourist = s.clock + rand(1, 2); }
      const housed = s.guests.filter((g) => g.st === 'home');
      s.stats.fullNow = housed.length;
      s.stats.fiveNow = housed.filter((g) => this.hearts(g) === 5).length;
      if (housed.some((g) => this.comfort(g) >= 0.999)) s.stats.lovedRoom = 1;
      this.checkStar();
      // Sleepy sounds from homes at night.
      if (night && Math.random() < 0.25) {
        const g = pick(housed);
        if (g) { const tt = this.tileOf(this.build(g.room)); this.fx.burst('zzz', tt.x + 0.3, tt.y + 1.1, tt.z, 1, { speed: 0.2, up: 0.7, gravity: 0, life: 2.2, size: 0.4, grow: 0.6 }); }
      }
      // Smoke from the lodge chimney.
      const l = w.lodge;
      this.fx.burst('smoke', l.x + 1.3, l.y + 3.0, l.z - 0.3, 1, { speed: 0.15, up: 0.8, gravity: -0.1, size: 0.6, grow: 2, life: 2.6, spread: 0.05 });
    }
    // Fireworks: at the finale, and for a while each evening afterwards.
    if (this.party > 0 || (s.finale && this.hour >= 20.5 && this.hour < 21.3)) {
      this.party -= dt;
      if (Math.random() < dt * 2.2) {
        const l = w.lodge;
        this.fx.firework(l.x + rand(-9, 9), rand(6, 10), l.z + rand(-8, 2));
        this.h.sound('boom');
      }
    }
    this.autosave = (this.autosave || 0) + dt;
    if (this.autosave > 20 && !this.shared) { this.autosave = 0; this.save(); }
  }

  goals() {
    const s = this.state;
    if (s.stars >= STARS.length) return null;
    const def = STARS[s.stars];
    return { title: def.title, reward: def.reward, goals: def.goals.map((g) => { const [now, max] = g.n(s); return { text: g.text, hint: g.hint, now, max, done: now >= max }; }) };
  }

  checkStar() {
    const s = this.state, gl = this.goals();
    if (!gl || !gl.goals.every((g) => g.done) || this.allAsleep) return;
    s.stars++;
    const bonus = 40 + s.stars * 20;
    s.leaves += bonus;
    let k = this.world.lodgeDoor;
    for (k of this.keepers.values()) {
      if (k.sleeping) continue;
      this.fx.burst('star', k.x, k.y + 1.2, k.z, 14, { speed: 3, up: 3.2, life: 1.8, size: 0.55 });
      k.act('happy', 2.5);
    }
    this.h.sound('star');
    if (s.stars >= 5) {
      s.finale = true;
      this.party = 45;
      this.h.banner('Five-star sanctuary!', 'Fernwood is the happiest hotel on the sea. Enjoy the fireworks!', '🎆');
    } else {
      const id = Object.keys(REGIONS).find((r) => REGIONS[r].star === s.stars);
      this.mist.open(id, { x: k.x, z: k.z });
      this.h.banner(`Star ${s.stars}!`, `${REGIONS[id].name} is open to explore. +${bonus} leaves`, '⭐');
      this.h.starUp(id);
    }
    this.save();
    this.h.changed();
  }

  // Bubbles and markers to draw over the world.
  labels() {
    const out = [], s = this.state, m = this.mode;
    for (const g of s.guests) {
      const a = this.guestActors.get(g.id);
      if (!a || a.hidden) continue;
      let icon = null, cls = '';
      if (g.st === 'waiting') { icon = '🧳'; cls = 'wait'; }
      else if (g.st === 'following') { icon = '🏡'; cls = 'wait'; }
      else if (g.wish) { icon = g.wish.kind === 'snack' ? ITEMS[g.wish.item].icon : WISH_ICON[g.wish.kind]; cls = 'wish'; if (g.wish.until - s.clock < 1.2) cls += ' hurry'; }
      if (icon) out.push({ key: 'g' + g.id, x: a.x, y: a.y + 1.05 * a.root.scale.y + 0.25, z: a.z, icon, cls });
    }
    for (const [id, a] of this.wildActors) out.push({ key: 'w' + id, x: a.x, y: a.y + 1.2, z: a.z, icon: '🐾', cls: 'paw' });
    const top = (a) => a.y + 1.05 * a.root.scale.y + 0.25;
    for (const [pid, k] of this.keepers) if (k !== this.me && !k.hidden) out.push({ key: 'k' + pid, x: k.x, y: k.y + 1.42, z: k.z, icon: (k.waveT > 0 ? '👋 ' : '') + k.name, cls: 'name' });
    const pa = this.parcelActor();
    if (pa && !pa.hidden) out.push({ key: 'parcel', x: pa.x, y: top(pa) + (pa.g?.wish ? 0.55 : 0), z: pa.z, icon: '📦', cls: 'paw' });
    for (const [id, a] of this.npcs) if (a !== pa) out.push({ key: 'n' + id, x: a.x, y: top(a), z: a.z, icon: NPCS[id].icon, cls: 'shop' });
    for (const [id, a] of this.touristActors) out.push({ key: 't' + id, x: a.x, y: top(a), z: a.z, icon: '🧳', cls: 'wait' });
    const bd = this.world.town.board;
    out.push({ key: 'board', x: bd.x, y: bd.y + 1.5, z: bd.z, icon: s.jobs.some((j) => this.jobReady(j)) ? '📋✓' : '📋', cls: 'shop' });
    if (this.fishing) { const b = this.bobber; out.push({ key: 'bob', x: b.x, y: b.y + 0.2, z: b.z, icon: this.fishing.phase === 'bite' ? '❗' : '···', cls: this.fishing.phase === 'bite' ? 'wish hurry' : 'ripe' }); }
    else out.push({ key: 'rod', x: this.fishTile.x, y: this.fishTile.walkY + 1.3, z: this.fishTile.z, icon: '🎣', cls: 'ripe' });
    for (const b of s.builds) {
      const def = BUILD[b.type];
      const t = this.tileOf(b);
      if (this.thirsty(b)) out.push({ key: 'd' + b.id, x: t.x, y: this.world.standY(t) + (b.type === 'appletree' || b.type === 'bamboo' ? 2.3 : 1.15), z: t.z, icon: b.type === 'hive' ? '🎵' : '💧', cls: 'ripe thirst' });
      if (def.grows && b.grow >= 1) out.push({ key: 'b' + b.id, x: t.x, y: this.world.standY(t) + (b.type === 'appletree' || b.type === 'bamboo' ? 2.3 : 1.15), z: t.z, icon: ITEMS[def.grows].icon, cls: 'ripe' });
      if (m?.type === 'assign' && def.room && !b.occ) {
        const c = this.comfortAt(m.guest.species, t, b.type).value;
        const n = Math.round(c * 3);
        out.push({ key: 'r' + b.id, x: t.x, y: t.y + 1.9, z: t.z, icon: '💗'.repeat(n) + '🤍'.repeat(3 - n), cls: 'match' });
      }
    }
    return out;
  }
}

export { WISH_ICON, WISH_TEXT };
