// Everything drawn over the world: the top bar, goals, build tray, cards,
// bubbles above animals, pop-up messages and the books and menus.

import { BUILD, BUILD_CATS, SPECIES, WILD, ITEMS, ASPECTS, REGIONS, FULL, NPCS, LOCALS } from './data.js';
import { WISH_TEXT, WISH_ICON } from './game.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hearts = (n, max = 5) => '❤️'.repeat(n) + '<span style="opacity:.25;filter:grayscale(1)">❤️</span>'.repeat(max - n);
const pips = (v, color) => {
  let out = '';
  for (let i = 0; i < FULL; i++) out += `<i class="${v >= i + 1 ? 'f' : v >= i + 0.5 ? 'h' : ''}"></i>`;
  return `<div class="pips" style="--c:${color}">${out}</div>`;
};
const gives = (g) => Object.entries(g || {}).map(([k, n]) => ASPECTS[k].icon.repeat(Math.max(1, Math.round(n)))).join(' ');

export class UI {
  constructor({ game, face, sound, view }) {
    this.game = game; this.face = face; this.sound = sound; this.view = view;
    this.labels = new Map();
    this.floats = [];
    this.dirty = true;
    this.cat = 'home';
    this.trayOpen = false;
    this.selT = 0;
    this.lastLeaves = 0;
    this.modalKind = null;

    $('btn-build').onclick = () => { this.click(); this.toggleTray(); };
    $('btn-friends').onclick = () => { this.click(); this.openFriends(); };
    $('btn-home').onclick = () => { this.click(); view.follow = true; };
    $('btn-menu').onclick = () => { this.click(); this.openMenu(); };
    $('btn-sound').onclick = () => { sound.wake(); sound.setOn(!sound.on); $('btn-sound').textContent = sound.on ? '🔊' : '🔇'; };
    $('btn-sound').textContent = sound.on ? '🔊' : '🔇';
    $('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal')) this.closeModal(); });
  }

  click() { this.sound.wake(); this.sound.play('click'); }

  // ---------------------------------------------------------------- messages
  toast(text, icon, cls = '', img = null, secs = 4.5) {
    const box = $('toasts');
    const t = el('div', 'toast ' + cls, (img ? `<img src="${img}">` : icon ? `<span class="ic">${icon}</span>` : '') + `<span>${text}</span>`);
    box.prepend(t);
    while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, secs * 1000);
  }
  tip(text) { this.toast(text, '💡', 'tip', null, 11); }
  banner(title, sub, icon) {
    const b = $('banner');
    b.hidden = true; void b.offsetWidth;
    b.querySelector('.icon').textContent = icon || '';
    b.querySelector('h2').textContent = title;
    b.querySelector('p').textContent = sub || '';
    b.hidden = false;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.hidden = true; }, 5000);
  }
  review(g, n, pay) {
    const words = ['', 'It was all right.', 'Not bad at all.', 'A lovely stay.', 'I had a wonderful time!', 'The best holiday ever!'];
    this.toast(`<b>${esc(g.name)}</b> went home. ${hearts(n)}<br>“${words[n]}” <b>+${pay} 🍃</b>`, null, '', this.face(g.species), 7);
  }
  float(text, p) { this.floats.push({ text, x: p.x, y: (p.y ?? 0) + 1.2, z: p.z, t: 0, node: null }); }
  changed() { this.dirty = true; }

  // ---------------------------------------------------------------- top bar and goals
  refresh() {
    const g = this.game, s = g.state;
    this.dirty = false;
    const h = g.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
    $('day').textContent = 'Day ' + g.day;
    $('time').textContent = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
    const rainSoon = s.rainFrom > s.clock && s.rainFrom - s.clock < 6;
    $('weather').textContent = g.rain > 0.3 ? '🌧️' : g.night ? '🌙' : rainSoon ? '🌦️' : h < 7.5 ? '🌅' : h > 18.3 ? '🌇' : '☀️';
    $('clock').title = g.rain > 0.3 ? 'It is raining. Plants grow faster.' : rainSoon ? 'Rain is on the way today.' : 'A clear day.';
    let st = '';
    for (let i = 0; i < 5; i++) st += `<span class="${i < s.stars ? (i === s.stars - 1 && this.newStar ? 'new' : '') : 'off'}">⭐</span>`;
    $('stars').innerHTML = st;
    const lv = $('leaves');
    lv.querySelector('b').textContent = s.leaves;
    if (s.leaves !== this.lastLeaves) { lv.classList.remove('bump'); void lv.offsetWidth; lv.classList.add('bump'); this.lastLeaves = s.leaves; }
    $('bag').innerHTML = Object.keys(ITEMS).filter((k) => s.inv[k] > 0).map((k) => `<span title="${ITEMS[k].name}">${ITEMS[k].icon}${s.inv[k]}</span>`).join(' ') + (s.parcel ? '<span title="A parcel to deliver">📦</span>' : '');

    const gl = g.goals(), box = $('goals');
    if (!gl) box.innerHTML = '<h4><span>⭐ 5</span> Five-star sanctuary</h4><div class="reward">You did it! Fernwood is famous. Keep welcoming guests for as long as you like. There are fireworks every evening.</div>';
    else {
      let hinted = false;
      box.innerHTML = `<h4><span>⭐ ${s.stars + 1}</span> ${gl.title}<button id="goalmin">${box.classList.contains('min') ? '▸' : '▾'}</button></h4><ul>` + gl.goals.map((q) => {
        const hint = !q.done && !hinted ? (hinted = true, `<small>${q.hint}</small>`) : '';
        return `<li class="${q.done ? 'done' : ''}"><i>${q.done ? '✓' : ''}</i><span>${q.text}</span><em>${q.max > 1 ? q.now + '/' + q.max : ''}</em>${hint}</li>`;
      }).join('') + `</ul><div class="reward">Finish these to open <b>${gl.reward}</b>.</div>`;
    }
    // Jobs from Port Marlow sit under the goals, so there is always something to do.
    const ready = s.jobs.filter((j) => g.jobReady(j)).length;
    box.innerHTML += `<div class="jobs"><h5>📋 Town jobs${ready ? ` <b>${ready} ready!</b>` : ''}</h5>` + s.jobs.map((j) => `<div class="job ${g.jobReady(j) ? 'ok' : ''}"><span>${LOCALS[j.who].name}</span><span>${this.needs(j)}</span><em>🍃${j.pay}</em></div>`).join('')
      + (s.parcel ? `<div class="job ok"><span>📦 Parcel</span><span>for ${esc(s.parcel.name)}, ${s.parcel.where}</span><em>🍃${s.parcel.pay}</em></div>` : '')
      + (s.stats.town ? '' : '<div class="reward">Cross the bridge east of the cove to find Port Marlow.</div>') + '</div>';
    const gm = $('goalmin');
    if (gm) gm.onclick = () => { box.classList.toggle('min'); this.dirty = true; };
    // Nudge the Build button until the first home exists.
    $('btn-build').classList.toggle('nudge', !this.trayOpen && !g.rooms().length);
    $('btn-build').classList.toggle('on', this.trayOpen);

    const m = g.mode, mh = $('modehint');
    mh.hidden = !m;
    if (m?.type === 'place') mh.innerHTML = `${BUILD[m.build].icon} Click a tile to place the ${BUILD[m.build].name} <small>Esc to stop</small>`;
    else if (m?.type === 'remove') mh.innerHTML = '🧹 Click something you built to take it away <small>Esc to stop</small>';
    else if (m?.type === 'assign') mh.innerHTML = `🏡 Choose a home for ${esc(m.guest.name)} <small>Esc to cancel</small>`;
    if (this.trayOpen) this.drawTray();
    this.drawSel();
  }

  needs(j) { return Object.entries(j.needs).map(([k, n]) => `${ITEMS[k].icon}${Math.min(n, this.game.state.inv[k] || 0)}/${n}`).join(' '); }

  // ---------------------------------------------------------------- build tray
  toggleTray(open = !this.trayOpen) {
    this.trayOpen = open;
    $('tray').hidden = !open;
    if (!open && (this.game.mode?.type === 'place' || this.game.mode?.type === 'remove')) this.game.setMode(null);
    this.dirty = true;
  }
  drawTray() {
    const g = this.game, s = g.state, m = g.mode, tray = $('tray');
    const sig = [this.cat, s.leaves, s.stars, s.rep, m?.type, m?.build, this.hoverInfo].join('|');
    if (sig === this.traySig) return;
    this.traySig = sig;
    tray.innerHTML = '';
    const tabs = el('div', 'tabs');
    for (const c in BUILD_CATS) {
      const b = el('button', c === this.cat ? 'on' : '', BUILD_CATS[c]);
      b.onclick = () => { this.click(); this.cat = c; this.dirty = true; };
      tabs.append(b);
    }
    const rm = el('button', 'rm' + (m?.type === 'remove' ? ' on' : ''), '🧹 Take away');
    rm.onclick = () => { this.click(); g.setMode(m?.type === 'remove' ? null : { type: 'remove' }); };
    tabs.append(rm);
    const items = el('div', 'items');
    for (const id in BUILD) {
      const d = BUILD[id];
      if (d.cat !== this.cat) continue;
      const needRep = (d.rep || 0) > s.rep, locked = d.star > s.stars || needRep, poor = s.leaves < d.cost;
      const it = el('button', 'item' + (locked ? ' locked' : '') + (poor ? ' poor' : '') + (m?.build === id ? ' on' : ''),
        `<div class="ic">${d.icon}</div><div class="nm">${d.name}</div><div class="gv">${gives(d.room ? d.bonus : d.gives)}</div><div class="cost">${needRep ? '📋 ' + d.rep + ' job' + (d.rep > 1 ? 's' : '') : locked ? '⭐ ' + d.star + ' star' + (d.star > 1 ? 's' : '') : '🍃 ' + d.cost}</div>`);
      it.onclick = () => {
        if (needRep) { this.toast(`The ${d.name} comes from Port Marlow. Do ${d.rep - s.rep} more job${d.rep - s.rep > 1 ? 's' : ''} or deliveries for the town.`, '📋'); this.sound.play('no'); return; }
        if (locked) { this.toast(`The ${d.name} opens when you have ${d.star} star${d.star > 1 ? 's' : ''}.`, '⭐'); this.sound.play('no'); return; }
        this.click();
        g.setMode(m?.build === id ? null : { type: 'place', build: id });
      };
      items.append(it);
    }
    let desc = 'Pick something, then click a tile. Things near a home make it cosier.';
    if (m?.type === 'place') {
      const d = BUILD[m.build];
      desc = `<b>${d.name}</b> ${d.desc}` + (this.hoverInfo ? ` <span>${this.hoverInfo}</span>` : '');
    } else if (m?.type === 'remove') desc = 'You get half the leaves back.';
    tray.append(tabs, items, el('div', 'desc', desc));
  }

  // ---------------------------------------------------------------- selection card
  select() { this.dirty = true; this.selSig = null; }
  drawSel() {
    const g = this.game, sel = g.selected, box = $('sel'), s = g.state;
    if (!sel || (sel.kind === 'guest' && !s.guests.includes(sel.ref)) || (sel.kind !== 'guest' && !s.builds.includes(sel.ref))) { box.hidden = true; this.selSig = null; return; }
    let html = '', sig = '';
    const meters = (a, loves) => Object.keys(ASPECTS).map((k) => {
      const love = loves && loves.includes(k);
      return `<div class="meter ${love ? 'love' : loves ? 'dim' : ''}"><span>${ASPECTS[k].icon}</span><span>${ASPECTS[k].name}${love ? ' ♥' : ''}</span>${pips(a[k], ASPECTS[k].color)}</div>`;
    }).join('');
    if (sel.kind === 'guest') {
      const q = sel.ref, sp = SPECIES[q.species], b = q.room && g.build(q.room);
      const n = g.hearts(q);
      const sub = q.st === 'waiting' ? 'waiting for a home' : q.st === 'following' ? 'following you home' : q.st === 'leaving' ? 'heading for the ferry' : q.resident ? 'lives at Fernwood' : q.left <= 0 ? 'goes home on the next ferry' : `stays ${q.left} more day${q.left > 1 ? 's' : ''}`;
      html = `<div class="head"><img src="${this.face(q.species)}"><div><h4>${esc(q.name)}</h4><div class="sub">${sp.name} · ${sub}</div>${b ? `<div class="hearts">${hearts(n)}</div>` : ''}</div></div>`;
      if (q.wish) html += `<div class="wishline">${q.wish.kind === 'snack' ? ITEMS[q.wish.item].icon : WISH_ICON[q.wish.kind]} Wishes for ${q.wish.kind === 'snack' ? ITEMS[q.wish.item].name : WISH_TEXT[q.wish.kind]}</div>`;
      if (b) {
        const a = g.world.comfort(g.tileOf(b), b.type);
        html += sp.loves.map((k) => `<div class="meter love"><span>${ASPECTS[k].icon}</span><span>${ASPECTS[k].name}</span>${pips(a[k], ASPECTS[k].color)}</div>`).join('');
        html += `<div class="note">Fill both bars by building ${ASPECTS[sp.loves[0]].icon} and ${ASPECTS[sp.loves[1]].icon} things within two tiles of ${esc(q.name)}'s home. Favourite snacks: ${sp.foods.map((f) => ITEMS[f].icon).join(' ')}</div>`;
      } else {
        html += `<div class="note">Loves ${sp.loves.map((k) => ASPECTS[k].icon + ' ' + ASPECTS[k].name.toLowerCase()).join(' and ')} near home. Favourite snacks: ${sp.foods.map((f) => ITEMS[f].icon).join(' ')}</div>`;
        html += '<div class="acts"><button class="btn" data-act="assign">Choose a home</button></div>';
      }
      sig = [q.id, q.st, n, q.wish?.kind, q.wish?.item, q.left, html.length].join('|');
    } else {
      const b = sel.ref, d = BUILD[b.type], t = g.tileOf(b);
      html = `<div class="head"><div class="big">${d.icon}</div><div><h4>${d.name}</h4><div class="sub">`;
      if (d.room) {
        const occ = b.occ && g.guest(b.occ);
        html += occ ? `${esc(occ.name)} the ${SPECIES[occ.species].name} lives here` : 'Empty, ready for a guest';
        html += '</div></div></div>' + meters(g.world.comfort(t, b.type), occ ? SPECIES[occ.species].loves : null);
        html += '<div class="note">Things within two tiles count. Next door counts double.</div>';
        if (!occ) html += '<div class="acts"><button class="btn warn" data-act="remove">Take away</button></div>';
      } else {
        html += `${d.desc}</div></div></div>`;
        if (d.grows) {
          const stuck = d.needs && b._ok === false;
          html += `<div class="meter love"><span>${ITEMS[d.grows].icon}</span><span>${b.grow >= 1 ? 'Ripe!' : stuck ? 'Waiting' : 'Growing'}</span>${pips(b.grow * FULL, '#4f9d5d')}</div>`;
          if (stuck) html += '<div class="note">The bees need flowers within two tiles.</div>';
        }
        if (gives(d.gives)) html += `<div class="note">Gives nearby homes: ${gives(d.gives)}</div>`;
        const wet = d.grows && b.grow < 1 && !g.thirsty(b);
        html += `<div class="acts">${d.grows ? `<button class="btn" data-act="harvest" ${wet ? 'disabled' : ''}>${b.grow >= 1 ? 'Pick' : b.type === 'hive' ? '🎵 Hum to the bees' : '💧 Water'}</button>` : ''}${d.fish ? '<button class="btn" data-act="fish">🎣 Cast a line</button>' : ''}${d.fixed ? '' : '<button class="btn warn" data-act="remove">Take away</button>'}</div>`;
      }
      sig = [b.id, b.occ, Math.floor((b.grow || 0) * 10), b._ok, html.length, html].join('|');
    }
    box.hidden = false;
    if (sig === this.selSig) return;
    this.selSig = sig;
    box.innerHTML = '<button class="x">✕</button>' + html;
    box.querySelector('.x').onclick = () => g.select(null);
    box.querySelectorAll('[data-act]').forEach((bt) => {
      bt.onclick = () => {
        this.click();
        const act = bt.dataset.act;
        if (act === 'remove') g.remove(sel.ref);
        else if (act === 'harvest') g.goTo(g.tileOf(sel.ref), () => g.tend(sel.ref));
        else if (act === 'fish') g.goTo(g.tileOf(sel.ref), () => g.cast());
        else if (act === 'assign') g.clickActor(g.guestActors.get(sel.ref.id));
      };
    });
  }

  // ---------------------------------------------------------------- pop-up sheets
  sheet(kind, html) {
    this.modalKind = kind;
    const m = $('modal'), sh = m.querySelector('.sheet');
    sh.innerHTML = '<button class="x">✕</button>' + html;
    sh.querySelector('.x').onclick = () => this.closeModal();
    m.hidden = false;
    return sh;
  }
  closeModal() { $('modal').hidden = true; this.modalKind = null; }
  get modalOpen() { return !$('modal').hidden; }

  openWild(id) {
    const g = this.game, d = WILD[id];
    const draw = () => {
      const needs = g.wildNeeds(id), can = needs.some((n) => n.have > 0 && n.given < n.n);
      const sh = this.sheet('wild', `<div class="wildhead"><img class="face" src="${this.face(d.species)}"><div><h2>${d.name}</h2><p>${d.story}</p></div></div>
        <h5>${d.name} would love</h5>
        <div class="needs">${needs.map((n) => `<span class="${n.given >= n.n ? 'ok' : ''}">${ITEMS[n.item].icon} ${n.given}/${n.n} <small>${n.given >= n.n ? '✓' : 'you have ' + n.have}</small></span>`).join('')}</div>
        ${can ? '' : `<p style="color:var(--soft)">You don't have what ${d.name} wants yet. ${needs.filter((n) => n.given < n.n).map((n) => `Get ${ITEMS[n.item].name} from ${ITEMS[n.item].from}.`).join(' ')}</p>`}
        <div class="acts"><button class="btn" id="give" ${can ? '' : 'disabled'}>Give snacks</button><button class="btn ghost" id="later">Come back later</button></div>`);
      sh.querySelector('#later').onclick = () => this.closeModal();
      sh.querySelector('#give').onclick = () => {
        g.giveWild(id);
        if (g.state.wild[id]?.rescued) this.closeModal(); else draw();
      };
    };
    draw();
  }

  // Marigold's market, the post office and the lighthouse.
  openShop(id) {
    const g = this.game, s = g.state, d = NPCS[id];
    const head = (text) => `<div class="wildhead"><img class="face" src="${this.face(d.species)}"><div><h2>${d.title}</h2><p>${text}</p></div></div>`;
    if (id === 'market') {
      const draw = () => {
        const have = Object.keys(ITEMS).filter((k) => s.inv[k] > 0);
        const sh = this.sheet('shop', head(`“Morning, ${esc(s.name)}! I buy anything you grow, catch or find.” You have <b>🍃 ${s.leaves}</b>.`)
          + '<h5>Sell from your bag</h5>' + (have.length ? `<div class="shop">${have.map((k) => `<div class="row"><span class="ic">${ITEMS[k].icon}</span><span><b>${ITEMS[k].name}</b> ×${s.inv[k]}</span><button class="btn ghost" data-sell="${k}" data-n="1">Sell 1 · 🍃${ITEMS[k].sell}</button><button class="btn" data-sell="${k}" data-n="${s.inv[k]}">Sell all · 🍃${ITEMS[k].sell * s.inv[k]}</button></div>`).join('')}</div>` : '<p style="color:var(--soft)">Your bag is empty. Pick up shells on the beach, catch fish off the pier, or grow snacks.</p>')
          + `<h5>Buy</h5><div class="shop">${g.stock().map((k) => `<div class="row"><span class="ic">${ITEMS[k].icon}</span><span><b>${ITEMS[k].name}</b>${ITEMS[k].note ? `<br><small>${ITEMS[k].note}</small>` : ''}</span><button class="btn ghost" data-buy="${k}" ${s.leaves < g.buyPrice(k) ? 'disabled' : ''}>Buy 1 · 🍃${g.buyPrice(k)}</button></div>`).join('')}</div>`
          + '<div class="acts"><button class="btn ghost" id="bye">Goodbye</button></div>');
        sh.querySelectorAll('[data-sell]').forEach((b) => { b.onclick = () => { g.sell(b.dataset.sell, Number(b.dataset.n)); draw(); }; });
        sh.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => { g.buy(b.dataset.buy); draw(); }; });
        sh.querySelector('#bye').onclick = () => this.closeModal();
      };
      draw();
    } else if (id === 'post') {
      const p = s.parcel;
      const sh = this.sheet('shop', head(p ? `“That parcel is for <b>${esc(p.name)}</b>, ${p.where}. Off you go!”` : '“Hoo! There is always post to carry. Deliveries pay leaves, and the town will thank you.”')
        + `<div class="acts">${p ? '' : '<button class="btn" id="take">📦 Take a parcel</button>'}<button class="btn ghost" id="bye">Goodbye</button></div>`);
      sh.querySelector('#bye').onclick = () => this.closeModal();
      const take = sh.querySelector('#take');
      if (take) take.onclick = () => { g.takeParcel(); const q = s.parcel; this.closeModal(); this.toast(`A parcel for <b>${esc(q.name)}</b>, ${q.where}. Look for the 📦 bubble.`, '📦', '', null, 7); };
    } else {
      const soon = s.rainFrom > s.clock, hrs = Math.round(s.rainFrom - s.clock);
      const weather = g.rain > 0.3 ? 'It is raining now. Good for the gardens, and little Lily loves it.' : soon && hrs < 30 ? `Rain is coming in about ${hrs} hour${hrs === 1 ? '' : 's'}.` : `Clear skies for now. I reckon rain in ${Math.max(1, s.nextRain)} day${s.nextRain > 1 ? 's' : ''} or so.`;
      const sh = this.sheet('shop', head(`“Ahoy! I watch the sea and the sky from up top.”`) + `<h5>The weather</h5><p>${weather}</p><h5>Old sailor's tips</h5><p>Shells and driftwood wash up on the sand. Star shards fall on the island after dark and are gone by morning. The further you explore, the rarer the things you find.</p><div class="acts"><button class="btn ghost" id="bye">Goodbye</button></div>`);
      sh.querySelector('#bye').onclick = () => this.closeModal();
    }
  }

  openBoard() {
    const g = this.game, s = g.state;
    const draw = () => {
      const sh = this.sheet('board', `<h2>📋 Port Marlow notice board</h2><p>The townsfolk always need a hand. Bring what they ask for and they pay in leaves. You have helped the town <b>${s.rep}</b> time${s.rep === 1 ? '' : 's'}.</p>
        <div class="shop">${s.jobs.map((j, i) => { const l = LOCALS[j.who], first = Object.keys(j.needs)[0]; return `<div class="row"><img class="face small" src="${this.face(l.species)}"><span><b>${l.name}</b> ${ITEMS[first].why}.<br>Wants ${this.needs(j)}</span><button class="btn ghost" data-skip="${i}" title="Swap this job for another">↻</button><button class="btn" data-job="${i}" ${g.jobReady(j) ? '' : 'disabled'}>Hand over · 🍃${j.pay}</button></div>`; }).join('')}</div>
        ${this.nextGoods()}
        <div class="acts"><button class="btn ghost" id="bye">Goodbye</button></div>`);
      sh.querySelectorAll('[data-skip]').forEach((b) => { b.onclick = () => { g.skipJob(s.jobs[Number(b.dataset.skip)]); draw(); }; });
      sh.querySelectorAll('[data-job]').forEach((b) => { b.onclick = () => { g.handIn(s.jobs[Number(b.dataset.job)]); draw(); }; });
      sh.querySelector('#bye').onclick = () => this.closeModal();
    };
    draw();
  }
  nextGoods() {
    const s = this.game.state, next = Object.values(BUILD).filter((d) => d.rep > s.rep).sort((a, b) => a.rep - b.rep)[0];
    return next ? `<p style="color:var(--soft)">Help ${next.rep - s.rep} more time${next.rep - s.rep > 1 ? 's' : ''} and the town will send you a <b>${next.icon} ${next.name}</b> to build.</p>` : '<p style="color:var(--soft)">The town has sent you everything it makes. Thank you!</p>';
  }

  openLodge() {
    const g = this.game, h = g.hour, bed = h >= 19 || h < 5;
    const sh = this.sheet('lodge', `<h2>Fernwood Lodge</h2>
      <p>This is your home, ${esc(g.state.name)}. The kettle is on and your bed is made.</p>
      <p style="color:var(--soft)">${bed ? 'Sleep to skip the night. Some shy animals only come out after dark, though…' : 'It is too early for bed. Come back after 7 in the evening.'}</p>
      <div class="acts"><button class="btn" id="zz" ${bed ? '' : 'disabled'}>😴 Sleep until morning</button><button class="btn ghost" id="fr">📖 Friends book</button></div>`);
    sh.querySelector('#zz').onclick = () => { this.closeModal(); g.sleep(); };
    sh.querySelector('#fr').onclick = () => this.openFriends();
  }

  openFriends() {
    const g = this.game, s = g.state;
    const wild = Object.keys(WILD).map((id) => {
      const d = WILD[id], saved = s.wild[id]?.rescued, open = REGIONS[d.region].star <= s.stars;
      if (saved) {
        const q = s.guests.find((x) => x.resident === id);
        return `<div class="cell click" data-g="${q.id}"><img class="face" src="${this.face(d.species)}"><b>${d.name}</b><small>${q.room ? hearts(g.hearts(q)) : 'needs a home!'}</small></div>`;
      }
      return `<div class="cell unknown"><img class="face" src="${this.face(d.species)}"><b>???</b><small>${open ? d.hint : 'Hidden in ' + REGIONS[d.region].name}</small></div>`;
    }).join('');
    const guests = s.guests.filter((q) => !q.resident).map((q) => `<div class="cell click" data-g="${q.id}"><img class="face" src="${this.face(q.species)}"><b>${esc(q.name)}</b><small>${q.room ? hearts(g.hearts(q)) : 'waiting for a home'}${q.wish ? '<br>has a wish!' : ''}</small></div>`).join('');
    const notes = Object.keys(SPECIES).map((k) => {
      const sp = SPECIES[k];
      if (!s.seen[k]) return `<div class="cell unknown"><img class="face" src="${this.face(k)}"><b>???</b><small>${sp.star > s.stars ? 'Comes with star ' + sp.star : 'Not seen yet'}</small></div>`;
      return `<div class="cell"><img class="face" src="${this.face(k)}"><b style="text-transform:capitalize">${sp.name}</b><small>Loves ${sp.loves.map((a) => ASPECTS[a].icon).join(' ')}<br>Eats ${sp.foods.map((f) => ITEMS[f].icon).join(' ')}</small></div>`;
    }).join('');
    const sh = this.sheet('friends', `<h2>📖 Friends book</h2>
      <h5>Wild friends</h5><div class="grid">${wild}</div>
      <h5>Guests staying now</h5>${guests ? `<div class="grid">${guests}</div>` : '<p style="color:var(--soft)">No guests just now. The ferry comes at 8 each morning.</p>'}
      <h5>Animal notes</h5><div class="grid">${notes}</div>`);
    sh.querySelectorAll('[data-g]').forEach((c) => {
      c.onclick = () => {
        const q = g.guest(Number(c.dataset.g)), a = q && g.guestActors.get(q.id);
        if (!a) return;
        this.closeModal();
        g.select({ kind: 'guest', ref: q });
        this.view.lookAt(a.x, a.z);
      };
    });
  }

  openMenu() {
    const g = this.game, snd = this.sound;
    const sh = this.sheet('menu', `<h2>Fernwood Animal Hotel</h2>
      <div class="keys">
        <span>Click</span><span>Walk somewhere, or help an animal, water or pick a plant, pick something up, open a door</span>
        <span>W A S D</span><span>Walk around</span>
        <span>Drag</span><span>Slide the view. Right-drag or Q / E to turn it. Scroll to zoom.</span>
        <span>B · F · Space</span><span>Build · Friends book · Find your keeper</span>
      </div>
      <h5>How it works</h5>
      <p>Every animal <b>loves two things</b> near its home, like 🌸 flowers or 💧 water. Anything within two tiles of a home counts, and next door counts double. Cosy homes and granted wishes mean more ❤️, and more 🍃 when guests go home.</p>
      <h5>Never stuck waiting</h5>
      <p>💧 Water plants to make them grow now. 🎣 Fish off the pier any time. 🐚 Pick up what you find lying about. Cross the bridge to <b>Port Marlow</b> to sell things at the market, do jobs from the notice board, carry parcels, and invite visitors to stay.</p>
      <div class="acts">
        <button class="btn" id="resume">Keep playing</button>
        <button class="btn ghost" id="music">🎵 Music: ${snd.musicOn ? 'on' : 'off'}</button>
        <button class="btn ghost" id="home">🏠 Take me to the lodge</button>
        <button class="btn warn" id="reset">Start over</button>
      </div>`);
    sh.querySelector('#resume').onclick = () => this.closeModal();
    sh.querySelector('#music').onclick = (e) => { snd.wake(); snd.setMusic(!snd.musicOn); e.target.textContent = `🎵 Music: ${snd.musicOn ? 'on' : 'off'}`; };
    sh.querySelector('#home').onclick = () => { g.goHome(); this.view.follow = true; this.closeModal(); };
    sh.querySelector('#reset').onclick = (e) => {
      if (e.target.dataset.sure) { this.onReset(); return; }
      e.target.dataset.sure = 1;
      e.target.textContent = 'Really start over? Click again';
    };
  }

  // ---------------------------------------------------------------- bubbles over the world
  update(dt, project) {
    const g = this.game;
    this.selT -= dt;
    if (this.dirty || this.selT <= 0) { this.selT = 0.3; this.refresh(); }
    const box = $('labels'), seen = new Set();
    for (const l of g.labels()) {
      seen.add(l.key);
      let n = this.labels.get(l.key);
      if (!n) { n = el('div', 'lab', '<div></div>'); n.icon = null; box.append(n); this.labels.set(l.key, n); }
      if (n.icon !== l.icon) { n.firstChild.textContent = l.icon; n.icon = l.icon; }
      if (n.cls !== l.cls) { n.className = 'lab ' + l.cls; n.cls = l.cls; }
      const p = project(l.x, l.y, l.z);
      n.style.display = p ? '' : 'none';
      if (p) n.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }
    for (const [k, n] of this.labels) if (!seen.has(k)) { n.remove(); this.labels.delete(k); }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      if (!f.node) { f.node = el('div', 'lab float', `<div>${f.text}</div>`); box.append(f.node); }
      f.t += dt;
      const p = project(f.x, f.y, f.z);
      if (p) f.node.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      if (f.t > 1.5) { f.node.remove(); this.floats.splice(i, 1); }
    }
  }
}
