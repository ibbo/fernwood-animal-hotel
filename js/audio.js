// All sound is made on the spot with Web Audio: gentle music that follows
// the time of day, the sea, birds, crickets, rain, and small effects.

const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 16]];   // C, Am, F, G
const hz = (semi) => 261.63 * Math.pow(2, semi / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true; this.musicOn = true;
    this.night = 0; this.rain = 0;
    try {
      const p = JSON.parse(localStorage.getItem('fernwood2.sound') || '{}');
      if (p.on === false) this.on = false;
      if (p.music === false) this.musicOn = false;
    } catch { /* ignore */ }
  }

  // Browsers only allow sound after a click or key press.
  wake() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.9 : 0;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = this.musicOn ? 0.5 : 0; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    // A soft echo for the music.
    const delay = c.createDelay(1); delay.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.36;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(this.music);
    this.echo = delay;
    // Noise for the sea and the rain.
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const loop = (freq, q, type) => {
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return g;
    };
    this.sea = loop(480, 0.4, 'lowpass');
    this.rainG = loop(5200, 0.3, 'highpass');
    this.step = 0;
    this.next = c.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  prefs() { try { localStorage.setItem('fernwood2.sound', JSON.stringify({ on: this.on, music: this.musicOn })); } catch { /* ignore */ } }
  setOn(v) { this.on = v; if (this.ctx) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05); this.prefs(); }
  setMusic(v) { this.musicOn = v; if (this.ctx) this.music.gain.setTargetAtTime(v ? 0.5 : 0, this.ctx.currentTime, 0.2); this.prefs(); }

  setScene(night, rain) {
    this.night = night; this.rain = rain;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sea.gain.setTargetAtTime(0.035 + 0.015 * Math.sin(t * 0.7), t, 0.4);
    this.rainG.gain.setTargetAtTime(rain * 0.06, t, 0.5);
  }

  tone(dest, freq, t, dur, vol, type = 'sine', attack = 0.01, slide = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return g;
  }

  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const beat = 0.42;
    while (this.next < c.currentTime + 0.35) {
      const t = this.next, s = this.step, bar = Math.floor(s / 8) % 4, chord = CHORDS[bar];
      const low = this.night > 0.5 ? -12 : 0, calm = this.night > 0.5 ? 0.45 : 1;
      if (s % 8 === 0) {
        // A slow warm chord.
        for (const n of chord.slice(0, 3)) {
          const g = this.tone(this.music, hz(n - 12 + low), t, beat * 8.4, 0.05, 'triangle', 1.2);
          g.connect(this.echo);
        }
        this.tone(this.music, hz(chord[0] - 24), t, beat * 7, 0.07, 'sine', 0.4);
      }
      if (Math.random() < 0.5 * calm || s % 4 === 0) {
        const pool = Math.random() < 0.6 ? chord : PENTA;
        const n = pool[Math.floor(Math.random() * pool.length)] + (Math.random() < 0.35 ? 12 : 0) + low;
        const g = this.tone(this.music, hz(n + 12), t, 1.4, 0.055, 'sine', 0.008);
        g.connect(this.echo);
        this.tone(this.music, hz(n + 24), t, 0.5, 0.012, 'triangle', 0.005);
      }
      // Birds by day, crickets by night.
      if (this.night < 0.4 && this.rain < 0.3 && Math.random() < 0.05) {
        const f = 2400 + Math.random() * 1600;
        for (let i = 0; i < 3; i++) this.tone(this.master, f * (1 + i * 0.06), t + i * 0.11, 0.09, 0.012, 'sine', 0.01, 1.25);
      } else if (this.night > 0.6 && Math.random() < 0.12) {
        for (let i = 0; i < 4; i++) this.tone(this.master, 4300, t + i * 0.07, 0.04, 0.006, 'sine', 0.005);
      }
      this.step++;
      this.next += beat;
    }
  }

  play(name) {
    const c = this.ctx;
    if (!c || !this.on || c.state !== 'running') return;
    const t = c.currentTime, d = this.sfx, T = (f, at, dur, vol, type, slide) => this.tone(d, f, t + at, dur, vol, type, 0.006, slide);
    switch (name) {
      case 'pop': T(520, 0, 0.12, 0.2, 'sine', 1.6); break;
      case 'click': T(900, 0, 0.05, 0.08, 'triangle', 0.8); break;
      case 'build': T(180, 0, 0.16, 0.3, 'triangle', 0.5); T(660, 0.06, 0.2, 0.14, 'sine', 1.5); T(990, 0.14, 0.25, 0.1, 'sine'); break;
      case 'no': T(220, 0, 0.14, 0.16, 'triangle', 0.8); T(180, 0.12, 0.2, 0.16, 'triangle', 0.8); break;
      case 'wish': T(880, 0, 0.18, 0.1, 'sine'); T(1174, 0.1, 0.3, 0.1, 'sine'); break;
      case 'happy': [523, 659, 784, 1047].forEach((f, i) => T(f, i * 0.07, 0.3, 0.11, 'sine')); break;
      case 'coin': T(1318, 0, 0.1, 0.12, 'square'); T(1760, 0.08, 0.35, 0.1, 'square'); break;
      case 'pick': T(700, 0, 0.09, 0.14, 'sine', 1.5); T(1050, 0.07, 0.14, 0.12, 'sine', 1.3); break;
      case 'bell': [784, 988, 1175].forEach((f, i) => { T(f, i * 0.22, 1.2, 0.12, 'sine'); T(f * 2.01, i * 0.22, 0.6, 0.04, 'sine'); }); break;
      case 'star': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { T(f, i * 0.11, 0.7, 0.13, 'triangle'); T(f * 2, i * 0.11, 0.5, 0.05, 'sine'); }); break;
      case 'sleep': [784, 659, 523, 392].forEach((f, i) => T(f, i * 0.28, 0.9, 0.1, 'sine')); break;
      case 'morning': [392, 523, 659, 784].forEach((f, i) => T(f, i * 0.16, 0.7, 0.1, 'triangle')); break;
      case 'chirp': T(1300, 0, 0.08, 0.1, 'sine', 1.4); T(1700, 0.09, 0.1, 0.1, 'sine', 1.2); break;
      case 'boom': {
        const src = c.createBufferSource(); src.buffer = this.noise;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.7);
        const g = c.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        src.connect(f); f.connect(g); g.connect(d); src.start(t); src.stop(t + 0.85);
        break;
      }
      default: break;
    }
  }
}
