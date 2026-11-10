// Playing in a shared hotel. The rules run on the server; this keeps a copy
// of the world in step with it, shows what happens, and sends what you click.

import { Game, Actor } from './game.js';
import { VERSION, HOUR_SECONDS } from './data.js';
import { backOut } from './util.js';

const PID_KEY = 'fernwood2.pid', CODE_KEY = 'fernwood2.code';
const WHY = {
  version: 'This page is an older edition of Fernwood. Reload the page and try again.',
  nocode: 'There is no shared hotel with that code. Check the letters and try again.',
  full: 'That hotel already has eight keepers in it.',
  busy: 'The Fernwood server is full just now. Try again in a little while.',
  badsave: 'That hotel could not be shared. Try starting a fresh shared hotel instead.',
  bad: 'The server did not understand. Reload the page and try again.',
  elsewhere: 'This hotel is now open in another window on this computer. Carry on playing there.',
  offline: 'Could not reach the Fernwood server. Check your internet and try again.',
};

export function serverUrl() {
  try { const custom = localStorage.getItem('fernwood2.server'); if (custom) return custom; } catch { /* storage may be off */ }
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('tomibbotson.com')) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + location.pathname.replace(/[^/]*$/, '') + 'ws';
  return 'wss://games.tomibbotson.com/fernwood/ws';
}
export function playerId() {
  try {
    const temp = sessionStorage.getItem(PID_KEY);          // lets one computer hold two keepers, for testing
    if (temp && /^[a-z0-9]{8,24}$/.test(temp)) return temp;
    let id = localStorage.getItem(PID_KEY);
    if (!id || !/^[a-z0-9]{8,24}$/.test(id)) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
      localStorage.setItem(PID_KEY, id);
    }
    return id;
  } catch { return Array.from({ length: 12 }, () => Math.floor(Math.random() * 36).toString(36)).join(''); }
}
export const lastCode = () => { try { return localStorage.getItem(CODE_KEY); } catch { return null; } };
export const forgetCode = () => { try { localStorage.removeItem(CODE_KEY); } catch { /* ignore */ } };

const HOLD = { t: 1e9, done() {} };

export class NetGame extends Game {
  constructor(opts) {
    super(opts);
    this.online = true;
    this.pid = playerId();
    this.code = null;
    this.players = [];
    this.byKey = new Map();         // every animal and keeper the server has told us about
    this.buildTiles = new Map();
    this.findTiles = new Map();
    this.you = null;
    this.localUntil = 0;            // while this is in the future, our own keeper is walked here, not by the server
    this.holdUntil = 0;
    this.sentAt = 0;
    this.zz = 0;
    this.started = false;
    this.status = 'connecting';
  }

  // Join (or start) a shared hotel. Resolves once the world has arrived.
  connect({ code, name, look, state }) {
    this.join = { name, look };
    return new Promise((resolve, reject) => {
      this.dial({ code, state }, resolve, (why) => reject(new Error(WHY[why] || WHY.offline)));
    });
  }
  dial({ code, state }, ok, fail) {
    let ws;
    try { ws = new WebSocket(serverUrl()); } catch { if (fail) fail('offline'); return; }
    this.ws = ws;
    let greeted = false, failed = false;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', v: VERSION, pid: this.pid, name: this.join.name, look: this.join.look, code: code || undefined, state: state || undefined }));
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'error') { failed = true; if (fail && !greeted) fail(m.why); else this.fatal(WHY[m.why] || WHY.bad); return; }
      if (m.t === 'hello') {
        greeted = true;
        this.code = m.code;
        try { localStorage.setItem(CODE_KEY, m.code); } catch { /* ignore */ }
        this.players = m.players;
        this.applyState(m.state);
        this.frame(m.f);
        const back = this.started;
        this.started = true;
        this.status = 'on';
        if (back) this.h.toast('Back in touch with the hotel.', '📡');
        if (ok) ok(m);
        return;
      }
      if (greeted) this.receive(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.closed) return;
      if (!greeted) { if (!failed && fail) fail('offline'); if (!this.started) return; }
      if (failed) return;
      // Lost touch: keep trying to get back in.
      if (this.status === 'on') this.h.toast('Lost touch with the hotel. Trying to get back…', '📡');
      this.status = 'lost';
      setTimeout(() => { if (!this.closed) this.dial({ code: this.code }); }, 2000);
    };
  }
  receive(m) {
    if (m.t === 'f') this.frame(m);
    else if (m.t === 's') this.applyState(m.s);
    else if (m.t === 'p') this.roster(m.players);
  }
  fatal(text) { this.closed = true; if (this.onFatal) this.onFatal(text); }
  leave() { this.closed = true; try { this.ws.close(); } catch { /* ignore */ } }
  send(m, ...a) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'a', m, a })); }

  // ---------------------------------------------------------------- keeping the copy in step
  applyState(ns) {
    const s = this.state || (this.state = {}), first = !this.started;
    const clock = this.started ? s.clock : ns.clock;
    const was = new Map((s.builds || []).map((b) => [b.id, b.grow]));
    for (const k of Object.keys(s)) if (!(k in ns)) delete s[k];
    Object.assign(s, ns);
    s.clock = clock;
    // Things that were built or taken away.
    const ids = new Set();
    for (const b of s.builds) {
      ids.add(b.id);
      const t = this.tileOf(b);
      if (!t) continue;
      if (!this.models.has(b.id)) {
        if (t.feat?.natural) t.feat = null;
        this.addModel(b, first);
        this.buildTiles.set(b.id, t);
      } else {
        t.build = b;
        const m = this.models.get(b.id), before = was.get(b.id);
        if (m.userData.fruit) m.userData.fruit.visible = b.grow >= 1;
        if (before !== undefined && (before >= 1) !== (b.grow >= 1)) m.userData.pop = 0.55;
      }
    }
    for (const [id, m] of this.models) {
      if (ids.has(id)) continue;
      this.scene.remove(m);
      this.models.delete(id);
      const t = this.buildTiles.get(id);
      if (t && t.build && t.build.id === id) t.build = null;
      this.buildTiles.delete(id);
    }
    // Things lying about.
    const fids = new Set(s.finds.map((f) => f.id));
    for (const [id, m] of this.findModels) {
      if (fids.has(id)) continue;
      this.scene.remove(m);
      this.findModels.delete(id);
      const t = this.findTiles.get(id);
      if (t && t.find && t.find.id === id) t.find = null;
      this.findTiles.delete(id);
    }
    for (const f of s.finds) {
      const t = this.world.get(f.q, f.r);
      if (!t) continue;
      if (this.findModels.has(f.id)) { t.find = f; continue; }
      t.find = null;
      if (this.showFind(f)) this.findTiles.set(f.id, t);
    }
    if (first) this.mist.set(s.stars);
    for (const a of this.byKey.values()) this.bind(a);
    this.applyYou(true);
    this.h.changed();
    if (this.onState) this.onState();
  }

  // Tie an actor to the guest or visitor it stands for.
  bind(a) {
    const kind = a.key[0], id = a.key.slice(1);
    if (kind === 'g') a.g = this.guest(Number(id)) || a.g;
    else if (kind === 't') a.tourist = this.state.tourists.find((t) => t.id === Number(id)) || a.tourist;
  }

  roster(players) {
    this.players = players;
    for (const p of players) {
      const k = this.keepers.get(p.pid);
      if (!k) continue;
      k.name = p.name;
      if (JSON.stringify(k.look) !== JSON.stringify(p.look)) { k.look = p.look; k.setLook(p.look); }
    }
    this.h.changed();
    if (this.onState) this.onState();
  }

  frame(f) {
    const s = this.state;
    s.clock = f.c; this.rain = f.r; this.zz = f.z;
    if (f.full) {
      const keys = new Set(f.a.map((e) => e[0]));
      for (const [key, a] of this.byKey) if (!keys.has(key)) this.drop(key, a);
    }
    for (const e of f.a) this.actor(e);
    this.you = f.you;
    this.applyYou(false);
    for (const e of f.ev) this.event(e);
  }

  drop(key, a) {
    const kind = key[0], id = key.slice(1);
    this.byKey.delete(key);
    if (kind === 'k') { this.removeKeeper(id); return; }
    a.remove();
    if (kind === 'g') this.guestActors.delete(Number(id));
    else if (kind === 'w') this.wildActors.delete(id);
    else if (kind === 'n') this.npcs.delete(id);
    else if (kind === 't') this.touristActors.delete(Number(id));
    else if (kind === 'l') delete this.locals[Number(id)];
  }

  actor([key, x, z, q, r, anim, hidden, turn, extra, species]) {
    let a = this.byKey.get(key);
    const tile = this.world.get(q, r) || this.world.lodgeDoor;
    if (!a) {
      if (!species) return;                     // wait for the next full list
      const kind = key[0], id = key.slice(1);
      if (kind === 'k') {
        const p = this.players.find((o) => o.pid === id);
        a = this.addKeeper(id, p ? p.name : 'Keeper', p ? p.look : null, tile);
        if (id === this.pid) this.me = this.keeper = a;
      } else {
        a = new Actor(this, species, tile);
        if (kind === 'g') this.guestActors.set(Number(id), a);
        else if (kind === 'w') { this.wildActors.set(id, a); a.wild = id; }
        else if (kind === 'n') { this.npcs.set(id, a); a.npc = id; }
        else if (kind === 't') this.touristActors.set(Number(id), a);
        else if (kind === 'l') { this.locals[Number(id)] = a; a.local = Number(id); }
      }
      a.key = key; a.remote = true;
      a.x = x; a.z = z; a.heading = a.turn = turn;
      this.byKey.set(key, a);
      this.bind(a);
    }
    a.sx = x; a.sz = z; a.stile = tile; a.sturn = turn; a.sanim = anim;
    if (!!hidden !== a.hidden) a.show(!hidden);
    if (key[0] === 'k') a.waveT = extra ? 1 : 0;
  }

  applyYou(force) {
    const y = this.you, k = this.me;
    if (!y || !k) return;
    k.busy = y.busy ? HOLD : null;
    k.sleeping = !!y.sleep;
    if ((k.fishing ? k.fishing.phase : null) !== y.fish) { k.fishing = y.fish ? { phase: y.fish, t: 1 } : null; this.h.changed(); }
    if (performance.now() < this.holdUntil) {
      // Our own latest choice stands until the server has caught up; just keep its links fresh.
      if (force && k.selected) this.setSel(k.selected.kind, k.selected.ref.id);
      if (force && k.mode && k.mode.guest) k.mode.guest = this.guest(k.mode.guest.id) || k.mode.guest;
      return;
    }
    const m = y.mode, old = k.mode;
    let mode = null;
    if (m && m.type === 'assign') { const guest = this.guest(m.guest); mode = guest ? { type: 'assign', guest } : null; }
    else if (m) mode = { type: m.type, build: m.build };
    if ((old ? old.type + '|' + old.build + '|' + (old.guest ? old.guest.id : '') : '') !== (mode ? mode.type + '|' + mode.build + '|' + (mode.guest ? mode.guest.id : '') : '')) { k.mode = mode; this.h.changed(); }
    else if (mode && mode.guest) k.mode = mode;
    const sel = y.sel, cur = k.selected;
    if (!sel) { if (cur) { k.selected = null; this.h.select(null); } }
    else if (!cur || cur.kind !== sel.kind || cur.ref.id !== sel.id || force) this.setSel(sel.kind, sel.id, !cur || cur.ref.id !== sel.id);
  }
  setSel(kind, id, tell) {
    const ref = kind === 'guest' ? this.guest(id) : this.build(id);
    this.me.selected = ref ? { kind, ref } : null;
    if (tell || !ref) this.h.select(this.me.selected);
  }

  event([kind, ...a]) {
    const h = this.h;
    if (kind === 'burst') this.fx.burst(a[0], a[1], a[2], a[3], a[4], a[5] || {});
    else if (kind === 'firework') this.fx.firework(a[0], a[1], a[2]);
    else if (kind === 'toast') h.toast(a[0], a[1]);
    else if (kind === 'tip') h.tip(a[0]);
    else if (kind === 'banner') h.banner(a[0], a[1], a[2]);
    else if (kind === 'float') h.float(a[0], { x: a[1], y: a[2], z: a[3] });
    else if (kind === 'review') h.review(a[0], a[1], a[2]);
    else if (kind === 'sound') h.sound(a[0]);
    else if (kind === 'starUp') h.starUp(a[0]);
    else if (kind === 'mist') this.mist.open(a[0], { x: a[1], z: a[2] });
    else if (kind === 'open') {
      if (a[0] === 'wild') h.openWild(a[1]);
      else if (a[0] === 'shop') h.openShop(a[1]);
      else if (a[0] === 'board') h.openBoard();
      else h.openLodge();
    }
  }

  // ---------------------------------------------------------------- every frame
  update(dt, t) {
    const s = this.state;
    if (!s || !this.started) return;
    s.clock += (dt / HOUR_SECONDS) * (this.zz ? 55 : 1);
    const now = performance.now();
    for (const a of this.byKey.values()) {
      if (a === this.me && now < this.localUntil) a.c.set('walk');
      else {
        const dx = a.sx - a.x, dz = a.sz - a.z, d = Math.hypot(dx, dz);
        if (d > 5) { a.x = a.sx; a.z = a.sz; }
        else if (d > 0.0005) { const k = Math.min(1, dt * 14); a.x += dx * k; a.z += dz * k; }
        a.tile = a.stile; a.turn = a.sturn;
        a.c.set(a.sanim);
      }
      a.update(dt, t);
    }
    for (const b of s.builds) {
      const m = this.models.get(b.id);
      if (m && m.userData.pop < 1) {
        m.userData.pop = Math.min(1, m.userData.pop + dt * 2.6);
        m.scale.setScalar(Math.max(0.01, backOut(m.userData.pop)));
      }
    }
    for (const m of this.findModels.values()) m.position.y = m.userData.y + Math.sin(t * 2.4 + m.userData.seed) * 0.07;
    this.updateFerry(dt);
    if (this.walked && now - this.sentAt > 66 && this.ws && this.ws.readyState === 1) {
      this.walked = false; this.sentAt = now;
      const k = this.me;
      // Sent exactly: a rounded spot can fall just inside the tree or wall the keeper is pressed against.
      this.ws.send(JSON.stringify({ t: 'mv', p: [k.x, k.z, Math.round(k.turn * 100) / 100] }));
    }
  }

  // ---------------------------------------------------------------- what you can do
  move(dx, dz, dt) {
    const k = this.me;
    if (!k || k.busy || k.sleeping) return;
    this.keeper = k;
    const x = k.x, z = k.z;
    super.move(dx, dz, dt);
    this.localUntil = performance.now() + 400;
    if (x !== k.x || z !== k.z) this.walked = true;
  }
  clickTile(t) { this.send('clickTile', t.q, t.r); }
  clickActor(a) { if (a && a.key) this.send('clickActor', a.key); }
  hook() {
    if (this.fishing?.phase !== 'bite') return false;
    this.me.fishing = { phase: 'wait', t: 1 };
    this.send('hook');
    return true;
  }
  setMode(mode) {
    this.me.mode = mode;
    this.holdUntil = performance.now() + 500;
    this.send('setMode', mode ? { type: mode.type, build: mode.build, guest: mode.guest ? mode.guest.id : undefined } : null);
    this.h.changed();
  }
  select(sel) {
    this.me.selected = sel;
    this.holdUntil = performance.now() + 500;
    this.send('select', sel ? { kind: sel.kind, id: sel.ref.id } : null);
    this.h.select(sel);
  }
  remove(b) { this.send('remove', b.id); }
  tendAt(b) { this.send('tend', b.id); }
  castAt(b) { this.send('cast', b.id); }
  giveWild(id) { this.send('giveWild', id); }
  sell(item, n = 1) { this.send('sell', item, n); }
  buy(item) { this.send('buy', item); }
  handIn(j) { this.send('handIn', j.id); }
  skipJob(j) { this.send('skipJob', j.id); }
  takeParcel() { this.send('takeParcel'); }
  sleep() { this.send('sleep'); }
  getUp() { this.send('getUp'); }
  goHome() { this.localUntil = 0; this.send('goHome'); }
  wave() { this.send('wave'); }
  setLook(look) { this.join.look = look; this.send('look', look); }
  save() { /* the server keeps shared hotels safe */ }
  actors() { return super.actors().filter(Boolean); }
}
