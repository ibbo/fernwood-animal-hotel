// Start-up, the camera, mouse and keyboard, and the frame loop.

import { THREE, Sky, Post, shared } from './gfx/core.js';
import { buildTerrain, buildWater, buildMist, buildClouds } from './gfx/terrain.js';
import { lodgeModel, pierModel } from './gfx/props.js';
import { buildTown } from './gfx/town.js';
import { portrait } from './gfx/critters.js';
import { Fx } from './gfx/fx.js';
import { World, WATER_Y } from './world.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { BUILD, ASPECTS, REGIONS } from './data.js';
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
    lookAt(x, z) { this.follow = false; this.goal = { x, z }; },
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
      const tiles = world.list.filter((t) => !t.water && t.region === id);
      const cx = tiles.reduce((a, t) => a + t.x, 0) / tiles.length, cz = tiles.reduce((a, t) => a + t.z, 0) / tiles.length;
      view.lookAt(cx, cz); view.cine = 7; view.wantDist = 46;
    },
  };
  const game = new Game({ world, scene, fx, mist, hooks });
  const face = (species) => portrait(renderer, species);
  ui = new UI({ game, face, sound, view });
  ui.onReset = () => { Game.wipe(); location.reload(); };
  let playing = false;

  function begin(state, name) {
    sound.wake();
    if (document.activeElement) document.activeElement.blur();
    game.start(state, name);
    playing = true;
    $('title').classList.add('out');
    setTimeout(() => { $('title').hidden = true; }, 900);
    $('hud').hidden = false;
    view.wantDist = 27; view.wantPitch = 0.84; view.follow = true;
    sound.play('morning');
    if (!state) {
      ui.banner('Welcome to Fernwood', `Good morning, ${game.state.name}! Your first guest is waiting by the pier.`, '🌿');
      setTimeout(() => ui.tip('Click the ground to walk there, or use W A S D. Drag to slide the view, scroll to zoom, right-drag to turn.'), 5200);
      setTimeout(() => ui.tip('There is always something to do: water your plants, pick up what you find, fish off the pier, or cross the bridge to Port Marlow.'), 40000);
    }
  }
  if (saved) {
    $('btn-continue').hidden = false;
    $('btn-continue').textContent = `Continue · Day ${Math.floor(saved.clock / 24) + 1} · ${'⭐'.repeat(saved.stars) || 'no stars yet'}`;
    $('name').value = saved.name;
    $('btn-new').classList.remove('alt');
    $('btn-continue').classList.add('alt');
  }
  $('btn-continue').onclick = () => begin(saved);
  $('btn-new').onclick = () => {
    const name = $('name').value.trim() || 'Keeper';
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
    let s = (5.2 - o.y) / d.y;
    const end = (-0.4 - o.y) / d.y;
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
    const zoom = clamp(27 / view.dist, 0.5, 2);
    for (const a of game.actors()) {
      if (a.hidden) continue;
      for (const [dy, rad] of [[0.35, 34], [1.25, 26]]) {
        const p = project(a.x, a.y + dy, a.z);
        if (!p) continue;
        const d = Math.hypot(p.x - mx, p.y - my) / (rad * zoom);
        if (d < 1 && d < bd) { bd = d; best = a; }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- hover preview
  let hover = null, mouse = { x: -1, y: -1, in: false };
  function updateHover() {
    const m = game.mode, rings = [];
    hover = mouse.in && playing && !ui.modalOpen ? tileAt(mouse.x, mouse.y) : null;
    let cursor = null, color = '#ffffff', info = '';
    const overActor = hover && !m && actorAt(mouse.x, mouse.y);
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
    if (!drag.moved) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.button === 0) {
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
    if (game.hook()) return;
    const a = !game.mode && actorAt(e.clientX, e.clientY);
    if (a) { game.clickActor(a); view.follow = true; return; }
    const t = tileAt(e.clientX, e.clientY);
    if (t) { game.clickTile(t); if (!game.mode) view.follow = true; }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.wantDist = clamp(view.wantDist * Math.exp(e.deltaY * 0.0012), 11, 62);
  }, { passive: false });
  function cancel() {
    if (ui.modalOpen) { ui.closeModal(); return true; }
    if (game.mode) { game.setMode(null); return true; }
    if (ui.trayOpen) { ui.toggleTray(false); return true; }
    if (game.selected) { game.select(null); return true; }
    return false;
  }
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.key === 'Enter') ($('btn-continue').hidden ? $('btn-new') : $('btn-continue')).click(); return; }
    if (!playing) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'escape') { if (!cancel()) ui.openMenu(); }
    else if (ui.modalOpen) return;
    else if (k === 'b') ui.toggleTray();
    else if (k === 'f') ui.openFriends();
    else if (k === ' ') { if (!game.hook()) view.follow = true; e.preventDefault(); }
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
      if (view.follow) view.goal = { x: game.keeper.x, z: game.keeper.z };
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
    view.dist = lerp(view.dist, view.wantDist + (game.sleeping ? 14 : 0), 1 - Math.exp(-dt * 4));
    view.pitch = lerp(view.pitch, view.wantPitch, 1 - Math.exp(-dt * 6));
    const cp = Math.cos(view.pitch);
    camera.position.set(view.target.x + Math.sin(view.yaw) * cp * view.dist, view.target.y + Math.sin(view.pitch) * view.dist, view.target.z + Math.cos(view.yaw) * cp * view.dist);
    camera.lookAt(view.target);

    const hour = playing ? game.hour : titleHour % 24, rain = playing ? game.rain : 0;
    sky.update(hour, rain, view.target);
    shared.wind.value = 1 + rain * 1.6;
    water.update(sky, rain);
    clouds.update(time);
    town.update(time, hour, sky.night);
    mist.update(dt);
    tint.copy(sky.cur.amb).multiplyScalar(sky.cur.ai * 0.45).add(tint2.copy(sky.cur.sun).multiplyScalar(sky.cur.si * 0.16));
    fx.update(dt, view.target, rain, clamp(view.dist / 27, 0.6, 1.8), tint);
    mist.material.emissiveIntensity = 0.3 * (1 - sky.night * 0.8);
    sound.setScene(sky.night, rain);
    post.focus = view.dist;
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
