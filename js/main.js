// Start-up, the camera, mouse and keyboard, and the frame loop.

import { THREE, Sky, Post, shared } from './gfx/core.js';
import { buildTerrain, buildWater, buildMist, buildClouds } from './gfx/terrain.js';
import { lodgeModel, pierModel } from './gfx/props.js';
import { buildTown } from './gfx/town.js';
import { portrait } from './gfx/critters.js';
import { Fx } from './gfx/fx.js';
import { World, WATER_Y } from './world.js';
import { Game } from './game.js';
import { NetGame, lastCode, forgetCode } from './net.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { BUILD, ASPECTS, REGIONS, cleanLook } from './data.js';
import { clamp, lerp } from './util.js';

const $ = (id) => document.getElementById(id);

function boot() {
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 900);
  const post = new Post(renderer, camera);
  const sky = new Sky(scene);
  const world = new World();
  const saved = Game.load();
  // A hotel saved on an older map keeps its builds: clear any wild plant now under one.
  if (saved) for (const b of saved.builds) { const t = world.get(b.q, b.r); if (t?.feat?.natural) t.feat = null; }

  buildTerrain(world, scene);
  const water = buildWater(world, scene);
  const mist = buildMist(world, scene, saved ? saved.stars : 0);
  const clouds = buildClouds(scene);
  const lodge = lodgeModel();
  lodge.position.set(world.lodge.x, world.lodge.y, world.lodge.z);
  scene.add(lodge);
  scene.add(pierModel(world));
  const fx = new Fx(scene, world);
  const town = buildTown(world, scene, fx);
  const sound = new Sound();

  // ---------------------------------------------------------------- camera
  const view = {
    target: new THREE.Vector3(world.lodge.x, 1, world.lodge.z), goal: { x: world.lodge.x, z: world.lodge.z },
    yaw: 0.5, pitch: 0.62, dist: 40, wantDist: 40, wantPitch: 0.62, follow: true, cine: 0,
    fp: false, look: -0.12, eyeY: 1, fpNow: false,       // first person: through the keeper's eyes
    lookAt(x, z) { if (this.fp) return; this.follow = false; this.goal = { x, z }; },
  };
  const v3 = new THREE.Vector3(), tint = new THREE.Color(), tint2 = new THREE.Color();
  let W = 1, H = 1;
  let quality = 1, slow = 0;      // drops the resolution if frames are slow
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * quality;
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    post.resize(Math.round(W * pr), Math.round(H * pr));
    fx.viewH = H * pr;
  }
  window.addEventListener('resize', resize);
  resize();
  const project = (x, y, z) => {
    if (view.fpNow && Math.hypot(x - camera.position.x, z - camera.position.z) > 26) return null;
    v3.set(x, y, z).project(camera);
    if (v3.z > 1 || v3.x < -1.15 || v3.x > 1.15 || v3.y < -1.15 || v3.y > 1.25) return null;
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
  };

  // ---------------------------------------------------------------- game and UI
  let ui = null;
  const hooks = {
    toast: (t, i) => ui.toast(t, i), tip: (t) => ui.tip(t), banner: (a, b, c) => ui.banner(a, b, c), changed: () => ui && ui.changed(),
    select: () => ui && ui.select(), float: (t, p) => ui.float(t, p), review: (g, n, p) => ui.review(g, n, p),
    openWild: (id) => ui.openWild(id), openLodge: () => ui.openLodge(), sound: (n) => sound.play(n),
    openShop: (id) => ui.openShop(id), openBoard: () => ui.openBoard(),
    starUp: (id) => {
      ui.newStar = true; setTimeout(() => { ui.newStar = false; }, 1500);
      if (view.fp) return;
      const tiles = world.list.filter((t) => !t.water && t.region === id);
      const cx = tiles.reduce((a, t) => a + t.x, 0) / tiles.length, cz = tiles.reduce((a, t) => a + t.z, 0) / tiles.length;
      view.lookAt(cx, cz); view.cine = 7; view.wantDist = 46;
    },
  };
  let game = new Game({ world, scene, fx, mist, hooks });
  const face = (species, look) => portrait(renderer, species, look);
  ui = new UI({ game, face, sound, view });
  ui.onReset = () => { Game.wipe(); location.reload(); };
  ui.onView = () => setFp(!view.fp);
  ui.onLeave = () => { forgetCode(); game.leave(); location.href = location.pathname; };
  let playing = false;

  // How this player's keeper looks, remembered between visits.
  let look = cleanLook(null);
  try { look = cleanLook(JSON.parse(localStorage.getItem('fernwood2.look'))); } catch { /* use the usual look */ }
  const drawLook = () => { $('lookpic').querySelector('img').src = face('keeper', look); };
  const keepLook = (l) => {
    look = cleanLook(l);
    try { localStorage.setItem('fernwood2.look', JSON.stringify(look)); } catch { /* storage may be off */ }
    drawLook();
  };
  ui.onLook = (l) => {
    keepLook(l);
    if (game.online) game.setLook(look);
    else if (game.me) { game.me.look = look; game.me.setLook(look); }
  };
  drawLook();
  $('lookpic').onclick = () => {
    const box = $('lookbox');
    box.hidden = !box.hidden;
    $('sharebox').hidden = true;
    if (!box.hidden) ui.lookPicker(box, { ...look }, (l) => keepLook({ ...l }));
  };
  const myName = () => $('name').value.trim() || 'Keeper';
  const say = (text) => { $('titlemsg').textContent = text || ''; };

  function enter(fresh) {
    sound.wake();
    if (document.activeElement) document.activeElement.blur();
    playing = true;
    $('title').classList.add('out');
    setTimeout(() => { $('title').hidden = true; }, 900);
    $('hud').hidden = false;
    view.wantDist = 27; view.wantPitch = 0.84; view.follow = true;
    sound.play('morning');
    if (fresh) {
      setTimeout(() => ui.tip('Click the ground to walk there, or use W A S D. Drag to slide the view, scroll to zoom, right-drag to turn. Press V to see through your keeper\'s eyes.'), 5200);
      setTimeout(() => ui.tip('There is always something to do: water your plants, pick up what you find, fish off the pier, or cross the bridge to Port Marlow.'), 40000);
    }
  }
  function begin(state, name) {
    game.start(state, name, look);
    enter(!state);
    if (!state) ui.banner('Welcome to Fernwood', `Good morning, ${game.state.name}! Your first guest is waiting by the pier.`, '🌿');
  }

  // A hotel shared with friends: the server runs it and this screen follows along.
  let opening = false;
  async function beginShared({ code, state }) {
    if (opening) return;
    opening = true;
    say(code ? `Opening hotel ${code}…` : 'Opening a shared hotel…');
    const g = new NetGame({ world, scene, fx, mist, hooks });
    try { await g.connect({ code, state, name: myName(), look }); } catch (err) {
      scene.remove(g.ferry);
      g.leave();
      opening = false;
      say(err.message);
      return;
    }
    scene.remove(game.ferry);
    game = g; ui.game = g; window.fernwood.game = g;
    g.onState = () => ui.stateChanged();
    g.onFatal = (text) => { playing = false; const f = $('fail'); f.hidden = false; f.textContent = text; };
    try { history.replaceState(null, '', '?w=' + g.code); } catch { /* not allowed here */ }
    say('');
    const fresh = !code;
    enter(fresh && !state);
    if (fresh) { ui.banner(`Your hotel code is ${g.code}`, 'Give the code to your friends so they can join you.', '👭'); setTimeout(() => ui.openShare(), 1400); }
    else ui.banner('Welcome back to the hotel', g.players.length > 1 ? `${g.players.length} keepers are here.` : 'You are the first one here today.', '👭');
  }
  if (saved) {
    $('btn-continue').hidden = false;
    $('btn-continue').textContent = `Continue · Day ${Math.floor(saved.clock / 24) + 1} · ${'⭐'.repeat(saved.stars) || 'no stars yet'}`;
    $('name').value = saved.name;
    $('btn-new').classList.remove('alt');
    $('btn-continue').classList.add('alt');
  }
  $('btn-continue').onclick = () => begin(saved);
  // Playing with friends.
  const linked = (new URLSearchParams(location.search).get('w') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  const known = linked.length === 5 ? linked : lastCode();
  $('btn-friends-open').onclick = () => { $('sharebox').hidden = !$('sharebox').hidden; $('lookbox').hidden = true; };
  if (known) {
    $('btn-rejoin').hidden = false;
    $('btn-rejoin').textContent = linked.length === 5 ? `Join hotel ${known}` : `Go back to hotel ${known}`;
    $('btn-rejoin').onclick = () => beginShared({ code: known });
    $('code').value = known;
    if (linked.length === 5) $('sharebox').hidden = false;
  }
  $('btn-join').onclick = () => {
    const code = $('code').value.toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length !== 5) { say('Type the five letters of your friend\'s hotel code.'); $('code').focus(); return; }
    beginShared({ code });
  };
  $('btn-share-new').onclick = () => beginShared({});
  if (saved) {
    $('btn-share-mine').hidden = false;
    $('btn-share-mine').textContent = `Share my hotel (Day ${Math.floor(saved.clock / 24) + 1})`;
    $('btn-share-mine').onclick = () => beginShared({ state: saved });
    $('btn-share-new').textContent = 'Start a fresh shared hotel';
  }
  $('btn-new').onclick = () => {
    const name = myName();
    if (saved) {
      if (!$('btn-new').dataset.sure) { $('btn-new').dataset.sure = 1; $('btn-new').textContent = 'Replace the saved hotel?'; return; }
      Game.wipe();
      sessionStorage.setItem('fernwood2.new', name);
      location.reload();
      return;
    }
    begin(null, name);
  };
  const auto = sessionStorage.getItem('fernwood2.new');
  if (auto) { sessionStorage.removeItem('fernwood2.new'); $('name').value = auto; }

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function tileAt(mx, my) {
    ndc.set((mx / W) * 2 - 1, -(my / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    if (d.y >= -0.01) return null;
    let s = Math.max(0, (5.2 - o.y) / d.y);
    const end = Math.min((-0.4 - o.y) / d.y, view.fpNow ? 34 : 1e9);
    let lastWater = null;
    for (; s < end; s += 0.06) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      const t = world.at(x, z);
      if (!t) continue;
      if (t.pier ? y <= t.walkY : t.water ? y <= WATER_Y : y <= t.y) return t;
      lastWater = t;
    }
    return lastWater && lastWater.water ? lastWater : null;
  }
  function actorAt(mx, my) {
    let best = null, bd = 1e9;
    const f = H / (2 * Math.tan((camera.fov * Math.PI) / 360));          // pixels for one unit, one unit away
    for (const a of game.actors()) {
      if (a.hidden) continue;
      const far = Math.hypot(a.x - camera.position.x, a.y + 0.6 - camera.position.y, a.z - camera.position.z);
      const ppu = clamp(f / far, 12, 260);
      for (const [dy, rad] of [[0.35, 0.62], [1.25 * a.root.scale.y * 0.8, 0.47]]) {
        const p = project(a.x, a.y + dy, a.z);
        if (!p) continue;
        const d = Math.hypot(p.x - mx, p.y - my) / (rad * ppu);
        if (d < 1 && d < bd) { bd = d; best = a; }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- hover preview
  let hover = null, mouse = { x: -1, y: -1, in: false };
  function updateHover() {
    const m = game.mode, rings = [];
    const at = pointer();
    hover = at.in && playing && !ui.modalOpen ? tileAt(at.x, at.y) : null;
    let cursor = null, color = '#ffffff', info = '';
    const overActor = at.in && playing && !ui.modalOpen && !m && actorAt(at.x, at.y);
    canvas.style.cursor = overActor ? 'pointer' : 'default';
    if (m?.type === 'place') {
      const def = BUILD[m.build];
      if (hover) {
        const ok = !game.canPlace(hover, m.build);
        cursor = hover; color = ok ? '#7dff9a' : '#ff6b5a';
        if (ok && (def.room || Object.keys(def.gives || {}).length)) {
          let helped = 0;
          for (const [t, d] of world.around(hover, 2)) {
            const isRoom = t.build && BUILD[t.build.type].room;
            if (!def.room && isRoom) { helped++; rings.push({ tile: t, color: '#ffd24a' }); } else if (!t.water) rings.push({ tile: t, color: d === 1 ? '#ffffff' : '#cfe0ea' });
          }
          if (def.room) {
            const a = world.comfort(hover, m.build);
            info = 'Here: ' + (Object.keys(ASPECTS).filter((k) => a[k] >= 0.5).map((k) => `${ASPECTS[k].icon}${Math.round(a[k] * 2) / 2}`).join(' ') || 'nothing nearby yet');
          } else info = helped ? `Makes ${helped} home${helped > 1 ? 's' : ''} cosier` : 'No homes in reach here';
        }
      }
    } else if (m?.type === 'remove') {
      if (hover?.build && !BUILD[hover.build.type].fixed) { cursor = hover; color = '#ff6b5a'; }
    } else if (m?.type === 'assign') {
      for (const b of game.freeRooms()) rings.push({ tile: game.tileOf(b), color: '#ffd24a' });
      if (hover?.build && BUILD[hover.build.type].room && !hover.build.occ) { cursor = hover; color = '#ffd24a'; }
    } else if (hover && !overActor) {
      const f = hover.feat?.type;
      if (hover.build || hover.find || f === 'lodge' || f === 'lodgeSide' || f === 'board' || f === 'lighthouse' || game.npcs.has(hover.feat?.shop)) { cursor = hover; color = '#ffe9a8'; canvas.style.cursor = 'pointer'; }
      else if (world.walkable(hover, game.state.stars)) cursor = hover;
    }
    const sel = game.selected;
    if (!m && sel?.kind === 'room') for (const [t] of world.around(game.tileOf(sel.ref), 2)) if (!t.water) rings.push({ tile: t, color: '#ffffff' });
    if (!m && sel && sel.kind !== 'guest') rings.push({ tile: game.tileOf(sel.ref), color: '#ffd24a', y: world.standY(game.tileOf(sel.ref)) });
    fx.setRings(rings);
    fx.setCursor(cursor, color, cursor ? world.standY(cursor) : 0);
    if (ui.hoverInfo !== info) { ui.hoverInfo = info; ui.changed(); }
  }

  // ---------------------------------------------------------------- input
  const keys = new Set();
  let drag = null;
  const locked = () => document.pointerLockElement === canvas;
  // Where the player is pointing: the mouse, or the middle of the screen when looking around in first person.
  const pointer = () => (locked() ? { x: W / 2, y: H / 2, in: true } : mouse);
  function setFp(on) {
    view.fp = on;
    $('btn-view').classList.toggle('on', on);
    if (!on && locked()) document.exitPointerLock();
    if (on) {
      view.follow = true; view.cine = 0; view.look = -0.12;
      if (game.mode?.type !== 'place') ui.toggleTray(false);
      if (!view.fpTold) { view.fpTold = true; ui.tip('You are seeing through your keeper\'s eyes. Click to look around with the mouse (Esc lets go of it). Click something to walk to it. Press V or scroll out to fly back up.'); }
    } else { view.wantDist = Math.max(view.wantDist, 16); view.dist = 12; }
  }
  const lookBy = (dx, dy) => { view.yaw -= dx * 0.0026; view.look = clamp(view.look - dy * 0.0026, -1.25, 1.25); };
  document.addEventListener('mousemove', (e) => { if (locked() && playing) lookBy(e.movementX, e.movementY); });
  document.addEventListener('pointerlockchange', () => { $('cross').classList.toggle('on', locked()); });
  function act(x, y) {
    if (game.hook()) return;
    const a = !game.mode && actorAt(x, y);
    if (a) { game.clickActor(a); view.follow = true; return; }
    const t = tileAt(x, y);
    if (t) { game.clickTile(t); if (!game.mode) view.follow = true; }
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    sound.wake();
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    mouse = { x: e.clientX, y: e.clientY, in: true };
    if (!drag || !playing) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    if (!drag.moved || locked()) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (view.fp) lookBy(dx * 1.6, dy * 1.6);
    else if (drag.button === 0) {
      const k = (view.dist * 0.56) / H;
      const c = Math.cos(view.yaw), s = Math.sin(view.yaw);
      view.follow = false; view.cine = 0;
      view.goal = { x: clamp(view.goal.x - (dx * c + dy * s * 1.35) * k, -34, 44), z: clamp(view.goal.z - (-dx * s + dy * c * 1.35) * k, -30, 44) };
      view.target.x = view.goal.x; view.target.z = view.goal.z;
    } else {
      view.yaw -= dx * 0.006;
      view.wantPitch = clamp(view.wantPitch + dy * 0.004, 0.17, 1.25);
    }
  });
  canvas.addEventListener('pointerleave', () => { mouse.in = false; });
  canvas.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d || d.moved || !playing) return;
    if (d.button === 2) { cancel(); return; }
    if (d.button !== 0) return;
    if (locked()) { act(W / 2, H / 2); return; }
    act(e.clientX, e.clientY);
    // In first person a click also takes hold of the mouse for looking around.
    if (view.fp && !ui.modalOpen && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed just now */ } }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!playing) return;
    // Scrolling right in drops into the keeper's eyes, and scrolling out lifts back up.
    // A short pause each way stops one long swipe from flipping the view twice.
    const now = performance.now(), rested = now - (view.flipAt || 0) > 900;
    if (view.fp) { if (e.deltaY > 0 && rested) { view.flipAt = now; setFp(false); } return; }
    if (e.deltaY < 0 && view.wantDist <= 11.2 && view.dist < 12.5 && rested && now - (view.closeAt || now) > 450) { view.flipAt = now; setFp(true); return; }
    view.wantDist = clamp(view.wantDist * Math.exp(e.deltaY * 0.0012), 11, 62);
    if (view.wantDist > 11.2) view.closeAt = 0; else if (!view.closeAt) view.closeAt = now;
  }, { passive: false });
  function cancel() {
    if (ui.modalOpen) { ui.closeModal(); return true; }
    if (game.mode) { game.setMode(null); return true; }
    if (ui.trayOpen) { ui.toggleTray(false); return true; }
    if (game.selected) { game.select(null); return true; }
    return false;
  }
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') {
      if (e.key === 'Enter') (e.target.id === 'code' ? $('btn-join') : linked.length === 5 ? $('btn-rejoin') : $('btn-continue').hidden ? $('btn-new') : $('btn-continue')).click();
      return;
    }
    if (!playing) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'escape') { if (!cancel()) ui.openMenu(); }
    else if (ui.modalOpen) return;
    else if (k === 'b') { ui.toggleTray(); if (ui.trayOpen && locked()) document.exitPointerLock(); }
    else if (k === 'f') ui.openFriends();
    else if (k === 'v') setFp(!view.fp);
    else if (k === 'h') game.wave();
    else if (k === ' ') { if (view.fp) act(pointer().x, pointer().y); else if (!game.hook()) view.follow = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('beforeunload', () => { if (playing) game.save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) game.save(); });

  // ---------------------------------------------------------------- frame loop
  let last = performance.now(), time = 0, titleHour = 17.4;
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw);
    last = now;
    if (!document.hidden && raw < 0.5) {
      if (raw > 0.034) slow += raw; else slow = Math.max(0, slow - raw * 0.5);
      if (slow > 2.5 && quality > 0.5) { quality = Math.max(0.5, quality - 0.25); slow = 0; resize(); }
    }
    time += dt;
    shared.time.value = time;

    if (playing) {
      if (!ui.modalOpen && !game.sleeping) {
        let mx = 0, mz = 0;
        if (keys.has('w') || keys.has('arrowup')) mz -= 1;
        if (keys.has('s') || keys.has('arrowdown')) mz += 1;
        if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
        if (keys.has('d') || keys.has('arrowright')) mx += 1;
        if (mx || mz) {
          const l = Math.hypot(mx, mz), c = Math.cos(view.yaw), s = Math.sin(view.yaw);
          game.move((mx * c + mz * s) / l, (-mx * s + mz * c) / l, dt);
          view.follow = true; view.cine = 0;
        }
        if (keys.has('q')) view.yaw += dt * 1.6;
        if (keys.has('e')) view.yaw -= dt * 1.6;
      }
      game.update(dt, time);
      if (view.cine > 0) { view.cine -= dt; if (view.cine <= 0) { view.follow = true; view.wantDist = 27; } }
      if (view.follow) view.goal = { x: game.me.x, z: game.me.z };
      if (game.sleeping) view.goal = { x: world.lodge.x, z: world.lodge.z };
    } else {
      view.yaw += dt * 0.045;
      titleHour += dt * 0.012;
    }
    const k = 1 - Math.exp(-dt * (view.cine > 0 ? 1.6 : 5));
    view.target.x = lerp(view.target.x, view.goal.x, k);
    view.target.z = lerp(view.target.z, view.goal.z, k);
    const under = world.at(view.target.x, view.target.z);
    view.target.y = lerp(view.target.y, under && !under.water ? under.y + 0.5 : 0.6, 1 - Math.exp(-dt * 3));
    view.dist = lerp(view.dist, view.wantDist + (playing && game.sleeping ? 14 : 0), 1 - Math.exp(-dt * 4));
    view.pitch = lerp(view.pitch, view.wantPitch, 1 - Math.exp(-dt * 6));
    const fp = playing && view.fp && !game.sleeping;
    if (fp !== view.fpNow) {
      view.fpNow = fp;
      camera.fov = fp ? 66 : 30; camera.near = fp ? 0.12 : 1;
      camera.updateProjectionMatrix();
      $('cross').hidden = !fp;
      if (fp) view.eyeY = game.me.y + 0.86;
    }
    if (playing && game.me) game.me.root.visible = !game.me.hidden && !fp;
    if (fp) {
      // Through the keeper's eyes.
      const k = game.me, cl = Math.cos(view.look);
      view.eyeY = lerp(view.eyeY, k.y + 0.86, 1 - Math.exp(-dt * 12));
      const ey = view.eyeY + (k.c.anim === 'walk' ? Math.sin(time * 11) * 0.022 : 0);
      camera.position.set(k.x, ey, k.z);
      camera.lookAt(k.x - Math.sin(view.yaw) * cl, ey + Math.sin(view.look), k.z - Math.cos(view.yaw) * cl);
      view.target.set(k.x, k.y + 0.5, k.z);
    } else {
      const cp = Math.cos(view.pitch);
      camera.position.set(view.target.x + Math.sin(view.yaw) * cp * view.dist, view.target.y + Math.sin(view.pitch) * view.dist, view.target.z + Math.cos(view.yaw) * cp * view.dist);
      camera.lookAt(view.target);
    }

    const hour = playing ? game.hour : titleHour % 24, rain = playing ? game.rain : 0;
    sky.update(hour, rain, view.target);
    shared.wind.value = 1 + rain * 1.6;
    water.update(sky, rain);
    clouds.update(time);
    town.update(time, hour, sky.night);
    mist.update(dt);
    tint.copy(sky.cur.amb).multiplyScalar(sky.cur.ai * 0.45).add(tint2.copy(sky.cur.sun).multiplyScalar(sky.cur.si * 0.16));
    fx.update(dt, view.target, rain, fp ? 0.8 : clamp(view.dist / 27, 0.6, 1.8), tint);
    mist.material.emissiveIntensity = 0.3 * (1 - sky.night * 0.8);
    sound.setScene(sky.night, rain);
    post.focus = fp ? 8 : view.dist;
    post.blurAmount = lerp(post.blurAmount, fp ? 0 : 1, 1 - Math.exp(-dt * 5));
    post.final.uniforms.fade.value = lerp(post.final.uniforms.fade.value, playing && game.sleeping ? 0.45 : 0, 1 - Math.exp(-dt * 3));
    if (playing) updateHover();
    post.render(scene);
    if (playing) ui.update(dt, project);
  }
  requestAnimationFrame(frame);
  if (auto) begin(null, auto);

  window.fernwood = { game, view, world, renderer, sky, post, ui, town };      // handy for testing in the console
}

try { boot(); } catch (err) {
  console.error(err);
  const f = $('fail');
  f.hidden = false;
  f.textContent = 'Fernwood could not start.\n\n' + (err && err.message ? err.message : err);
}
