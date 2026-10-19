/* Einmaleins – die Reihen 3 bis 9: lernen, üben, sicher werden.
   Eine Seite, kein Framework. Fortschritt bleibt auf dem Gerät (localStorage). */
(() => {
'use strict';

/* ================================================================== Reihen */
const ROWS = [3, 4, 5, 6, 7, 8, 9];
const ROW = {
  3: { name: 'Dreierreihe',   short: 'Dreier',   shape: 'Dreieck',   c: '#EC4A33' },
  4: { name: 'Viererreihe',   short: 'Vierer',   shape: 'Viereck',   c: '#F29A0B' },
  5: { name: 'Fünferreihe',   short: 'Fünfer',   shape: 'Fünfeck',   c: '#1E9E58' },
  6: { name: 'Sechserreihe',  short: 'Sechser',  shape: 'Sechseck',  c: '#0A98A2' },
  7: { name: 'Siebenerreihe', short: 'Siebener', shape: 'Siebeneck', c: '#2E63E6' },
  8: { name: 'Achterreihe',   short: 'Achter',   shape: 'Achteck',   c: '#7849DE' },
  9: { name: 'Neunerreihe',   short: 'Neuner',   shape: 'Neuneck',   c: '#DB3D89' },
};
const INK = '#1C1B2B';

function rgb(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(c1, c2, t) {
  const a = rgb(c1), b = rgb(c2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
ROWS.forEach(r => {
  const R = ROW[r];
  R.tint = mix(R.c, '#FFFFFF', 0.86);
  R.soft = mix(R.c, '#FFFFFF', 0.62);
  R.deep = mix(R.c, INK, r === 4 ? 0.55 : 0.32);
  R.on = r === 4 ? '#3A2300' : '#FFFFFF';
});
const rowVars = r => { const R = ROW[r]; return `--c:${R.c};--tint:${R.tint};--soft:${R.soft};--deep:${R.deep};--on:${R.on}`; };
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* ================================================================ Speicher */
const KEY = 'einmaleins.v1';
const DEFAULTS = { mal: true, geteilt: true, luecke: true, answer: 'tippen', length: 10, readTasks: true, voice: true, sounds: true };
let S = load();

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* privates Fenster o. Ä. */ }
  d = d && typeof d === 'object' ? d : {};
  return {
    facts: d.facts && typeof d.facts === 'object' ? d.facts : {},
    settings: Object.assign({}, DEFAULTS, d.settings || {}),
    best: d.best || {},
    mastered: d.mastered || {},
    mixRows: Array.isArray(d.mixRows) && d.mixRows.length ? d.mixRows.filter(r => ROWS.includes(r)) : ROWS.slice(),
    hintClosed: !!d.hintClosed,
    installed: !!d.installed,
  };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* egal */ } }

/* ================================================================ Lernstand
   Jede Aufgabe einer Reihe (r · k) hat eine Box 0–4: beim ersten Versuch richtig = eine Box höher,
   falsch = zwei Boxen tiefer. »Sicher« = Box 3 oder 4. Die Form einer Reihe füllt sich mit der Summe ihrer Boxen. */
const fkey = (r, k) => `${r}:${k}`;
const fact = (r, k) => S.facts[fkey(r, k)] || { box: 0, right: 0, wrong: 0 };
function rowLevel(r) { let s = 0; for (let k = 1; k <= 10; k++) s += Math.min(4, fact(r, k).box); return s / 40; }
function rowSafe(r) { let n = 0; for (let k = 1; k <= 10; k++) if (fact(r, k).box >= 3) n++; return n; }
function hardFacts() {
  const out = [];
  ROWS.forEach(r => range(1, 10).forEach(k => { const f = fact(r, k); if (f.wrong > 0 && f.box < 3) out.push({ r, k, f }); }));
  return out.sort((a, b) => a.f.box - b.f.box || b.f.wrong - a.f.wrong);
}
function record(r, k, ok) {
  const f = Object.assign({ box: 0, right: 0, wrong: 0 }, fact(r, k));
  if (ok) { f.right++; f.box = Math.min(4, f.box + 1); } else { f.wrong++; f.box = Math.max(0, f.box - 2); }
  f.t = Date.now();
  S.facts[fkey(r, k)] = f;
  save();
}

/* ================================================================== Formen
   Jede Reihe hat ihre Form mit genau so vielen Ecken: 3 = Dreieck … 9 = Neuneck.
   Unten immer eine gerade Kante, etwa gleich große Fläche, weiche Ecken. Koordinaten 0–100. */
const GEO = {};
function geom(n) {
  if (GEO[n]) return GEO[n];
  const a0 = Math.PI / 2 + Math.PI / n;
  let pts = range(0, n - 1).map(i => { const a = a0 + i * 2 * Math.PI / n; return [Math.cos(a), Math.sin(a)]; });
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minx = Math.min(...xs), miny = Math.min(...ys);
  const w = Math.max(...xs) - minx, h = Math.max(...ys) - miny;
  const s = Math.min(100 / Math.max(w, h), Math.sqrt(0.5 * 10000 / (n / 2 * Math.sin(2 * Math.PI / n))));
  const ox = (100 - w * s) / 2 - minx * s, oy = (100 - h * s) / 2 - miny * s;
  pts = pts.map(([x, y]) => [x * s + ox, y * s + oy]);
  const top = oy + miny * s;
  return (GEO[n] = { pts, cx: ox, cy: oy, top, bottom: top + h * s, d: roundPath(pts, n === 3 ? 9 : 7) });
}
function roundPath(pts, rad) {
  const n = pts.length, f = v => v.toFixed(2);
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const l1 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const rr = Math.min(rad, l1 / 2.3, l2 / 2.3);
    const a = [p1[0] + (p0[0] - p1[0]) / l1 * rr, p1[1] + (p0[1] - p1[1]) / l1 * rr];
    const b = [p1[0] + (p2[0] - p1[0]) / l2 * rr, p1[1] + (p2[1] - p1[1]) / l2 * rr];
    d += `${i ? 'L' : 'M'}${f(a[0])} ${f(a[1])}Q${f(p1[0])} ${f(p1[1])} ${f(b[0])} ${f(b[1])}`;
  }
  return d + 'Z';
}
const VB = '-6 -6 112 112';
let uid = 0;

/* Eine Reihen-Form mit Zahl. level (0–1) = wie voll sie ist; from = Startwert für die Füll-Animation. */
function shapeSVG(r, o = {}) {
  const g = geom(r), R = ROW[r], label = o.label == null ? String(r) : o.label;
  const fs = o.fs || (r === 3 ? 33 : 38), ty = g.cy + (r === 3 ? 5 : 1);
  const text = fill => label === '' ? '' :
    `<text x="${g.cx.toFixed(2)}" y="${ty.toFixed(2)}" class="shp-t" fill="${fill}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  if (o.level == null) {
    return `<svg class="shp" viewBox="${VB}" aria-hidden="true"><path d="${g.d}" fill="${R.c}"/>${text(R.on)}</svg>`;
  }
  const id = 'c' + (++uid), h = g.bottom - g.top;
  const yOf = l => (g.bottom - Math.max(0, Math.min(1, l)) * h).toFixed(2);
  const hOf = l => Math.max(0.01, Math.min(1, l) * h + 0.5).toFixed(2);
  const anim = o.from == null ? '' :
    `<animate attributeName="y" from="${yOf(o.from)}" to="${yOf(o.level)}" begin="${o.delay || 0.5}s" dur="1.3s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .2 1"/>` +
    `<animate attributeName="height" from="${hOf(o.from)}" to="${hOf(o.level)}" begin="${o.delay || 0.5}s" dur="1.3s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .2 1"/>`;
  const start = o.from == null ? o.level : o.from;
  const liquid = `<rect x="-6" y="${yOf(start)}" width="112" height="${hOf(start)}">${anim}</rect>`;
  return `<svg class="shp" viewBox="${VB}" aria-hidden="true">
    <defs><clipPath id="${id}a"><path d="${g.d}"/></clipPath><clipPath id="${id}b">${liquid}</clipPath></defs>
    <path d="${g.d}" fill="${R.tint}"/>
    <g clip-path="url(#${id}a)"><g fill="${R.c}">${liquid}</g></g>
    ${text(R.deep)}
    <g clip-path="url(#${id}b)">${text(R.on)}</g>
    <path d="${g.d}" fill="none" stroke="${R.c}" stroke-width="3.6" stroke-linejoin="round"/>
  </svg>`;
}
/* Kleine Form ohne Zahl (Muster, Chips, Ergebnis). kind: full | outline | half */
function mini(r, kind = 'full', cls = '') {
  const R = ROW[r];
  const inner = kind === 'tint' ? `<use href="#p${r}" fill="${R.tint}"/>` : kind === 'outline'
    ? `<use href="#p${r}" fill="${R.tint}" stroke="${R.c}" stroke-width="9" stroke-linejoin="round"/>`
    : kind === 'half'
      ? `<use href="#p${r}" fill="${R.soft}" stroke="${R.c}" stroke-width="9" stroke-linejoin="round"/>`
      : `<use href="#p${r}" fill="${R.c}"/>`;
  return `<svg class="mini ${cls}" viewBox="${VB}" aria-hidden="true">${inner}</svg>`;
}
function spriteSVG() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ROWS.map(r => `<path id="p${r}" d="${geom(r).d}"/>`).join('')}</defs></svg>`;
}
function logoSVG() {
  const t = geom(3).d, q = geom(4).d, h = geom(6).d;
  return `<svg class="logo" viewBox="0 0 120 100" aria-hidden="true">
    <g style="isolation:isolate">
      <path d="${q}" fill="${ROW[4].c}" transform="translate(30 6) scale(.62)"/>
      <path d="${t}" fill="${ROW[3].c}" transform="translate(-2 30) scale(.62)" style="mix-blend-mode:multiply"/>
      <path d="${h}" fill="${ROW[7].c}" transform="translate(52 31) scale(.62)" style="mix-blend-mode:multiply"/>
    </g></svg>`;
}

/* =================================================================== Icons */
const I = p => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  gear: I('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  play: I('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>'),
  speaker: I('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  del: I('<path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  spark: I('<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.2L12 20.5l-2.2-6.3L3.5 12l6.3-2.7z" fill="currentColor" stroke="none"/>'),
  shuffle: I('<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.5M13 10.5c.9-1.9 2-3.5 3.5-3.5H20"/><path d="M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"/>'),
  target: I('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>'),
  share: I('<path d="M12 15V4M8 7.5L12 3.5l4 4"/><path d="M6 11v8.5h12V11"/>'),
  install: I('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7.5v7M9 11.5l3 3 3-3"/>'),
};

/* ==================================================================== Ton
   Stimme: fertige MP3s in audio/ (ElevenLabs), eine Zeile nach der anderen.
   Geräusche: werden live erzeugt (Web Audio) – Marimba- und Glockentöne, die mit der Serie höher steigen.
   iOS: Ton erst nach dem ersten Tippen; »playback«, damit es auch im Stumm-Modus klingt; nach dem Hintergrund
   wird der AudioContext neu gemacht. */
const Sound = (() => {
  let ctx = null, out = null, sfxBus = null, voiceBus = null;
  const bytes = new Map();
  let bufs = new Map(), src = null, queue = [], playing = false, tok = 0;

  function make() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* alt */ }
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    bufs = new Map();
    out = ctx.createDynamicsCompressor();
    out.threshold.value = -12; out.knee.value = 10; out.ratio.value = 4; out.attack.value = 0.003; out.release.value = 0.25;
    out.connect(ctx.destination);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(out);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(out);
    const conv = ctx.createConvolver(), wet = ctx.createGain();
    conv.buffer = impulse(1.7); wet.gain.value = 0.2;
    sfxBus.connect(conv); conv.connect(wet); wet.connect(out);
    return ctx;
  }
  function impulse(sec) {
    const rate = ctx.sampleRate, len = Math.floor(rate * sec), b = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
    }
    return b;
  }
  function ready() {
    if (!ctx || ctx.state === 'closed') make();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  function drop() {
    stop();
    if (ctx) { try { ctx.close(); } catch (e) { /* schon zu */ } }
    ctx = null;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) drop(); });
  window.addEventListener('pagehide', drop);
  ['pointerup', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, ready, { capture: true, passive: true }));

  function fetchBytes(name) {
    if (!bytes.has(name)) {
      bytes.set(name, fetch(`audio/${name}.mp3`).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    }
    return bytes.get(name);
  }
  async function buffer(name) {
    const c = ctx;
    if (!c) return null;
    if (bufs.has(name)) return bufs.get(name);
    const ab = await fetchBytes(name);
    if (!ab || c !== ctx) return null;
    try {
      const b = await new Promise((res, rej) => c.decodeAudioData(ab.slice(0), res, rej));
      if (c === ctx) bufs.set(name, b);
      return b;
    } catch (e) { return null; }
  }
  const wait = ms => new Promise(res => setTimeout(res, ms));
  function playBuf(b) {
    return new Promise(res => {
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(voiceBus);
      let done = false;
      const end = () => { if (!done) { done = true; res(); } };
      s.onended = end; src = s;
      const t0 = ctx.currentTime, c = ctx;
      s.start();
      setTimeout(end, b.duration * 1000 + 500);
      // Wächter: läuft die Uhr nicht (iOS nach dem Hintergrund), wird der Kontext beim nächsten Tippen neu gemacht.
      setTimeout(() => { if (c === ctx && c.currentTime === t0) { drop(); } }, 800);
    });
  }
  function stop() {
    tok++; queue = []; playing = false;
    if (src) { try { src.stop(); } catch (e) { /* schon fertig */ } src = null; }
  }
  /* Spricht eine oder mehrere Zeilen. append = hinten anhängen (z. B. die nächste Aufgabe nach dem Lob). */
  function say(names, append = false) {
    if (!append) stop();
    queue.push(...[].concat(names).filter(Boolean));
    if (!playing) pump();
  }
  async function pump() {
    if (!ready()) { queue = []; return; }
    playing = true;
    const my = tok;
    while (queue.length && my === tok) {
      const b = await buffer(queue.shift());
      if (my !== tok) return;
      if (!b) continue;
      await playBuf(b);
      if (my !== tok) return;
      await wait(70);
    }
    if (my === tok) { playing = false; src = null; }
  }
  const preload = names => names.forEach(fetchBytes);

  /* ---- Geräusche ---- */
  const note = m => 440 * Math.pow(2, (m - 69) / 12);
  const PENTA = [0, 2, 4, 7, 9];
  const step = i => 72 + 12 * Math.floor(i / 5) + PENTA[i % 5];
  function env(g, t, a, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }
  function osc(type, f, t, dur, peak, dest, a = 0.004) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    env(g, t, a, peak, dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + a + dur + 0.05);
  }
  function marimba(f, t, v = 1) {
    osc('sine', f, t, 0.55, 0.3 * v, sfxBus);
    osc('sine', f * 3.93, t, 0.1, 0.06 * v, sfxBus, 0.002);
    osc('sine', f * 9.3, t, 0.03, 0.02 * v, sfxBus, 0.001);
  }
  function bell(f, t, v = 1) {
    osc('sine', f, t, 1.2, 0.14 * v, sfxBus);
    osc('sine', f * 2.76, t, 0.55, 0.05 * v, sfxBus);
    osc('sine', f * 5.4, t, 0.25, 0.025 * v, sfxBus);
  }
  const on = () => S.settings.sounds && ready();
  const sfx = {
    tap() {
      if (!on()) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(650, t + 0.045);
      env(g, t, 0.002, 0.11, 0.055);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12);
    },
    right(streak) {
      if (!on()) return;
      const t = ctx.currentTime + 0.01, i = Math.min(Math.max(streak - 1, 0), 9);
      marimba(note(step(i)), t); marimba(note(step(i + 2)), t + 0.085, 0.9);
    },
    wrong() {
      if (!on()) return;
      const t = ctx.currentTime + 0.01;
      [[55, 0], [52, 0.15]].forEach(([m, dt]) => {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = note(m);
        f.type = 'lowpass'; f.frequency.value = 900;
        env(g, t + dt, 0.012, 0.24, 0.34);
        o.connect(f); f.connect(g); g.connect(sfxBus);
        o.start(t + dt); o.stop(t + dt + 0.5);
      });
    },
    done(perfect) {
      if (!on()) return;
      const t = ctx.currentTime + 0.05, seq = perfect ? [72, 76, 79, 84, 88] : [72, 76, 79, 84];
      seq.forEach((m, i) => marimba(note(m), t + i * 0.11, 0.85));
      bell(note(seq[seq.length - 1] + 12), t + seq.length * 0.11, 0.8);
    },
    sparkle() {
      if (!on()) return;
      const t = ctx.currentTime + 0.02;
      [84, 88, 91, 96, 100].forEach((m, i) => bell(note(m), t + i * 0.065, 0.55));
    },
  };
  return { say, stop, preload, sfx, ready };
})();
const sfx = Sound.sfx;
const lines = {
  lob: n => `lob_${String(1 + Math.floor(Math.random() * n)).padStart(2, '0')}`,
};
const voiceOn = () => S.settings.voice;
function sayHelp(names, append) { if (voiceOn()) Sound.say(names, append); }

/* ================================================================ Aufgaben */
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function types() {
  const t = [];
  if (S.settings.mal) t.push('mal', 'mal');
  if (S.settings.geteilt) t.push('geteilt');
  if (S.settings.luecke) t.push('luecke');
  return t.length ? t : ['mal'];
}
/* Eine Aufgabe zu r · k. parts: Zahlen, Rechenzeichen und null = die Lücke.
   q = Datei der Frage, s = Datei des ganzen Satzes (»Sieben mal acht ist sechsundfünfzig.«). */
function makeTask(r, k, type) {
  const c = r * k;
  if (type === 'mal') {
    const sw = Math.random() < 0.5, a = sw ? r : k, b = sw ? k : r;
    return { r, k, type, parts: [a, '·', b, '=', null], answer: c, q: `m_${a}_${b}`, s: `ms_${a}_${b}`, solved: [a, '·', b, '=', c] };
  }
  if (type === 'geteilt') {
    return { r, k, type, parts: [c, ':', r, '=', null], answer: k, q: `d_${c}_${r}`, s: `ms_${k}_${r}`,
      solved: [c, ':', r, '=', k], because: [k, '·', r, '=', c] };
  }
  if (Math.random() < 0.5) {
    return { r, k, type, parts: [r, '·', null, '=', c], answer: k, q: `la_${r}_${c}`, s: `ms_${r}_${k}`, solved: [r, '·', k, '=', c] };
  }
  return { r, k, type, parts: [null, '·', r, '=', c], answer: k, q: `lb_${r}_${c}`, s: `ms_${k}_${r}`, solved: [k, '·', r, '=', c] };
}
function weightOf(f) { return [6, 4, 2.5, 1.2, 0.6][Math.min(4, fact(f.r, f.k).box)] * (f.k === 1 || f.k === 10 ? 0.55 : 1); }
function weightedOrder(pool, n) {
  const out = [];
  let p = pool.slice();
  while (out.length < n) {
    if (!p.length) p = pool.slice();
    const total = p.reduce((s, f) => s + weightOf(f), 0);
    let x = Math.random() * total, i = 0;
    for (; i < p.length - 1; i++) { x -= weightOf(p[i]); if (x <= 0) break; }
    out.push(p[i]); p.splice(i, 1);
  }
  return out;
}
function noNeighbours(list) {
  for (let i = 1; i < list.length; i++) {
    if (list[i].r === list[i - 1].r && list[i].k === list[i - 1].k) {
      const j = list.findIndex((f, x) => x > i + 1 && !(f.r === list[i].r && f.k === list[i].k));
      if (j > 0) [list[i], list[j]] = [list[j], list[i]];
    }
  }
  return list;
}
function buildRound(mode) {
  const N = S.settings.length;
  let facts = [];
  if (mode.kind === 'row') {
    const base = range(1, 10).map(k => ({ r: mode.rows[0], k }));
    while (facts.length < N) facts = facts.concat(weightedOrder(base, base.length));
    facts = facts.slice(0, N);
  } else if (mode.kind === 'mix') {
    const pool = [];
    mode.rows.forEach(r => range(1, 10).forEach(k => pool.push({ r, k })));
    facts = weightedOrder(pool, N);
  } else {
    const h = hardFacts().map(x => ({ r: x.r, k: x.k }));
    facts = shuffle(h.slice(0, N));
    const want = Math.min(N, Math.max(6, h.length));
    for (let i = 0; facts.length < want; i++) facts.push(h[i % h.length]);
  }
  facts = noNeighbours(facts);
  let last = '';
  return facts.map(f => {
    let t;
    for (let tries = 0; tries < 4; tries++) { t = makeTask(f.r, f.k, pick(types())); if (t.q !== last) break; }
    last = t.q;
    return t;
  });
}
function choicesFor(t) {
  const a = t.answer;
  let near;
  if (t.type === 'mal') {
    const x = t.parts[0], y = t.parts[2];
    const rev = Number(String(a).split('').reverse().join(''));
    const swap = rev >= 10 && rev !== a ? rev : null;
    near = [x * (y + 1), x * (y - 1), (x + 1) * y, (x - 1) * y, a + 1, a - 1, swap, a + 10, a - 10, a + 2];
  } else {
    near = [a + 1, a - 1, a + 2, a - 2, t.r !== a ? t.r : null, a + 3, a - 3];
  }
  const max = t.type === 'mal' ? 100 : 12;
  const ok = [...new Set(near)].filter(v => v != null && v > 0 && v !== a && v <= max);
  const top = shuffle(ok.slice(0, 5)), rest = shuffle(ok.slice(5));
  return [a, ...top.concat(rest).slice(0, 3)].sort((p, q) => p - q);
}

/* ================================================================ Oberfläche */
const app = document.getElementById('app');
const sheetRoot = document.getElementById('sheet-root');
const fxRoot = document.getElementById('fx');
document.body.insertAdjacentHTML('afterbegin', spriteSVG());
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let view = { name: 'home' };
let Q = null;          // laufendes Quiz
let reloadPending = false;

function nav(name, params = {}, push = true) {
  closeSheet(true);
  if (view.name === 'quiz' && name !== 'quiz' && name !== 'result') { Q = null; Sound.stop(); }
  view = Object.assign({ name }, params);
  if (push) { try { history.pushState({ name, row: params.row }, ''); } catch (e) { /* file:// */ } }
  render();
  window.scrollTo(0, 0);
  if (name === 'home' && reloadPending) location.reload();
}
window.addEventListener('popstate', e => {
  const st = e.state || { name: 'home' };
  if (view.name === 'quiz' || view.name === 'result') { Q = null; Sound.stop(); }
  view = st.name === 'row' && st.row ? { name: 'row', row: st.row } : { name: 'home' };
  closeSheet(true);
  render();
});

function render() {
  document.body.dataset.view = view.name;
  if (view.name === 'home') app.innerHTML = homeHTML();
  else if (view.name === 'row') app.innerHTML = rowHTML(view.row);
  else if (view.name === 'quiz') { app.innerHTML = quizHTML(); showTask(); }
  else if (view.name === 'result') app.innerHTML = resultHTML(view.res);
}

/* ---------------------------------------------------------------- Start */
function homeHTML() {
  const hard = hardFacts();
  return `<div class="screen home">
    <header class="bar">
      <button class="brand" data-act="hello" aria-label="Einmaleins – Hallo sagen">${logoSVG()}<span>Einmaleins</span></button>
      <button class="icon-btn" data-act="settings" aria-label="Einstellungen">${ICON.gear}</button>
    </header>
    <section class="intro">
      <h1>Welche Reihe übst du heute?</h1>
      <p>Jede Reihe hat ihre Form – mit genau so vielen Ecken. Je sicherer du wirst, desto voller wird sie.</p>
    </section>
    <section class="grid" aria-label="Die Reihen">
      ${ROWS.map(tileHTML).join('')}
      ${mixTileHTML()}
    </section>
    ${hard.length ? hardHTML(hard) : ''}
    <div id="install-home">${installHomeHTML()}</div>
    <footer class="foot">Mal-, Geteilt- und Lücken-Aufgaben · funktioniert auch ohne Internet</footer>
  </div>`;
}
function meter(n, total = 10) {
  return `<span class="meter" aria-hidden="true">${range(1, total).map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}
function tileHTML(r) {
  const R = ROW[r], safe = rowSafe(r);
  return `<button class="tile" style="${rowVars(r)}" data-act="row" data-row="${r}" aria-label="${R.name}: ${safe} von 10 Aufgaben sicher">
    <span class="tile-shape">${shapeSVG(r, { level: rowLevel(r) })}</span>
    <span class="tile-name">${R.name}</span>
    <span class="tile-meta">${meter(safe)}<span class="tile-count">${safe}/10</span></span>
    ${S.mastered[r] ? `<span class="tile-crown" aria-hidden="true">${ICON.check}</span>` : ''}
  </button>`;
}
function mixTileHTML() {
  const pos = ROWS.map((r, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 7;
    return `<span class="orbit" style="left:${(50 + 33 * Math.cos(a)).toFixed(1)}%;top:${(50 + 33 * Math.sin(a)).toFixed(1)}%">${mini(r)}</span>`;
  }).join('');
  const rows = S.mixRows.length === 7 ? 'Alle Reihen gemischt' : `Reihen ${S.mixRows.join(', ')}`;
  return `<button class="tile tile-mix" data-act="mix" aria-label="Zufalls-Mix: ${rows}">
    <span class="tile-shape mix-orbit">${pos}<span class="mix-icon">${ICON.shuffle}</span></span>
    <span class="tile-name">Zufalls-Mix</span>
    <span class="tile-meta"><span class="tile-count">${rows}</span></span>
  </button>`;
}
function hardHTML(hard) {
  const show = hard.slice(0, 4).map(h => `<span class="hard-chip" style="${rowVars(h.r)}">${h.k} · ${h.r}</span>`).join('');
  return `<section class="hard card">
    <div class="hard-text">
      <h2>${ICON.target} Meine kniffligen Aufgaben</h2>
      <p>${hard.length === 1 ? 'Eine Aufgabe' : `${hard.length} Aufgaben`} brauchen noch etwas Übung.</p>
      <div class="hard-chips">${show}${hard.length > 4 ? `<span class="hard-more">+${hard.length - 4}</span>` : ''}</div>
    </div>
    <button class="btn primary" data-act="start-hard">${ICON.play}<span>Üben</span></button>
  </section>`;
}
/* ---- Als App auf den Startbildschirm (2026-10-19) ----
   iPhone/iPad: Text-Tipp (Teilen → Zum Home-Bildschirm). Android: Chrome und Samsung Internet melden »beforeinstallprompt« –
   dann ein Knopf »App installieren«, der den Dialog von Android öffnet; bis dahin (Chrome erst nach einem Tippen und etwa
   30 s auf der Seite) und in Firefox ein Text-Tipp mit dem Menüweg des Browsers. PC: nichts. Als App geöffnet: nichts. */
const UA = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(UA);
const androidBrowser = /SamsungBrowser/i.test(UA) ? 'samsung' : /Firefox/i.test(UA) ? 'firefox' : 'chrome';
const standalone = () => !!navigator.standalone ||
  ['standalone', 'fullscreen', 'minimal-ui'].some(m => window.matchMedia(`(display-mode: ${m})`).matches);
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => {
  if (!isAndroid) return;                 // PC: der Browser zeigt sein eigenes Symbol in der Adressleiste
  e.preventDefault();                     // statt der kleinen Chrome-Leiste unser Knopf
  installEvent = e;
  refreshInstall();
});
window.addEventListener('appinstalled', () => { installEvent = null; S.installed = true; save(); refreshInstall(); });

const INSTALL_STEPS = {
  ios: 'Tippe auf <b>Teilen</b> (das Quadrat mit dem Pfeil) und dann auf <b>»Zum Home-Bildschirm«</b>.',
  chrome: 'Tippe oben rechts auf <b>⋮</b> und dann auf <b>»App installieren«</b> (oder »Zum Startbildschirm hinzufügen«).',
  samsung: 'Tippe unten auf <b>≡</b>, dann auf <b>»Seite hinzufügen zu«</b> und <b>»Startbildschirm«</b>.',
  firefox: 'Tippe auf <b>⋮</b> und dann auf <b>»Installieren«</b> (oder »Zum Startbildschirm hinzufügen«).',
};
const installable = () => (isIOS || isAndroid) && !standalone();
/* where = 'home' (Karte auf der Startseite, schließbar) | 'set' (Abschnitt in den Einstellungen) */
function installInner(where) {
  if (!installable()) return '';
  if (S.installed && !installEvent) {
    return where === 'set' ? `<p class="set-note">Einmaleins ist schon installiert – öffne es über das Symbol auf dem Startbildschirm.</p>` : '';
  }
  const close = where === 'home' ? `<button class="icon-btn small" data-act="hint-close" aria-label="Tipp schließen">${ICON.close}</button>` : '';
  if (isAndroid && installEvent) {
    return `<div class="hint ${where === 'home' ? 'card' : 'flat'}">
      <span class="hint-ic">${ICON.install}</span>
      <div class="hint-body"><p><b>Als App installieren:</b> Dann liegt Einmaleins auf dem Startbildschirm und funktioniert auch ohne Internet.</p>
        <button class="btn primary" data-act="install">${ICON.install}<span>App installieren</span></button></div>
      ${close}</div>`;
  }
  const steps = INSTALL_STEPS[isIOS ? 'ios' : androidBrowser];
  return `<div class="hint ${where === 'home' ? 'card' : 'flat'}">
    <span class="hint-ic">${isIOS ? ICON.share : ICON.install}</span>
    <div class="hint-body"><p><b>${where === 'home' ? 'Tipp' : 'So geht’s'}:</b> ${steps} Dann ist Einmaleins wie eine echte App da und funktioniert auch ohne Internet.</p></div>
    ${close}</div>`;
}
const installHomeHTML = () => (S.hintClosed ? '' : installInner('home'));
function installSetHTML() {
  const inner = installInner('set');
  return inner ? `<section class="set-group"><h3>Auf den ${isIOS ? 'Home-Bildschirm' : 'Startbildschirm'}</h3>${inner}</section>` : '';
}
function refreshInstall() {
  const home = document.getElementById('install-home');
  if (home) home.innerHTML = installHomeHTML();
  const set = document.getElementById('install-set');
  if (set) set.innerHTML = installSetHTML();
}

/* ---------------------------------------------------------------- Reihe */
function rowHTML(r) {
  const R = ROW[r], safe = rowSafe(r);
  return `<div class="screen rowview" style="${rowVars(r)}">
    <header class="bar">
      <button class="icon-btn" data-act="home" aria-label="Zurück zur Übersicht">${ICON.back}</button>
      <span class="bar-title">${R.name}</span>
      <button class="icon-btn" data-act="settings" aria-label="Einstellungen">${ICON.gear}</button>
    </header>
    <div class="row-layout">
      <section class="row-hero">
        <div class="hero-shape">${shapeSVG(r, { level: rowLevel(r) })}</div>
        <div class="hero-info">
          <p class="hero-kind">${R.shape} · ${r} Ecken</p>
          <p class="hero-safe"><b>${safe} von 10</b> Aufgaben sitzen sicher.</p>
          ${meter(safe)}
          <button class="btn primary big" data-act="start-row" data-row="${r}">${ICON.play}<span>Quiz starten</span></button>
        </div>
      </section>
      <section class="facts card" aria-label="Die ${R.name}">
        <p class="facts-hint">Tippe eine Aufgabe an: Du hörst sie und siehst sie als Muster.</p>
        ${range(1, 10).map(k => factHTML(r, k)).join('')}
      </section>
    </div>
  </div>`;
}
function factHTML(r, k) {
  const b = Math.min(4, fact(r, k).box);
  return `<div class="fact" data-k="${k}">
    <button class="fact-btn" data-act="fact" data-row="${r}" data-k="${k}" aria-expanded="false">
      <span class="eq"><b>${k}</b><i>·</i><b>${r}</b><i>=</i><b class="res">${k * r}</b></span>
      <span class="boxes" aria-label="Sicherheit ${b} von 4">${range(1, 4).map(i => `<i class="${i <= b ? 'on' : ''}"></i>`).join('')}</span>
    </button>
    <div class="fact-pane" hidden></div>
  </div>`;
}
function arrayHTML(r, k) {
  const rows = range(1, k).map(() => `<div class="arr-row">${range(1, r).map(() => `<span>${mini(r)}</span>`).join('')}</div>`).join('');
  return `<div class="arr" style="--n:${r}">${rows}</div>
    <p class="arr-cap">${k} ${k === 1 ? 'Reihe' : 'Reihen'} mit je ${r} ${ROW[r].shape.replace('eck', 'ecken')} – zusammen <b>${k * r}</b>.</p>`;
}
function toggleFact(btn) {
  const r = +btn.dataset.row, k = +btn.dataset.k;
  const box = btn.parentElement, pane = box.querySelector('.fact-pane');
  const open = btn.getAttribute('aria-expanded') === 'true';
  app.querySelectorAll('.fact-btn[aria-expanded="true"]').forEach(b => {
    if (b !== btn) { b.setAttribute('aria-expanded', 'false'); b.parentElement.querySelector('.fact-pane').hidden = true; b.parentElement.classList.remove('open'); }
  });
  if (open) { btn.setAttribute('aria-expanded', 'false'); pane.hidden = true; box.classList.remove('open'); return; }
  pane.innerHTML = arrayHTML(r, k);
  pane.hidden = false; box.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
  if (S.settings.readTasks || S.settings.voice) Sound.say(`ms_${k}_${r}`);
  const rect = box.getBoundingClientRect();
  if (rect.bottom > window.innerHeight - 20) box.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
}

/* ---------------------------------------------------------------- Quiz */
function startQuiz(mode) {
  Sound.ready();
  const list = buildRound(mode);
  if (!list.length) return;
  const rows = [...new Set(list.map(t => t.r))].sort();
  Q = {
    mode, list, i: 0, total: list.length, right: 0, streak: 0, best: 0, marks: list.map(() => ''),
    mistakes: [], input: '', locked: false, rows, before: Object.fromEntries(rows.map(r => [r, rowLevel(r)])),
    started: Date.now(),
  };
  list.forEach((t, i) => { t.slot = i; t.retry = 0; });
  Q.intro = mode.kind === 'row' ? 'los' : mode.kind === 'mix' ? 'mix' : 'knifflig';
  Sound.preload([Q.intro, ...new Set(list.flatMap(t => [t.q, t.s]))]);
  nav('quiz', {});
}
function quizHTML() {
  return `<div class="screen quiz" id="quiz">
    <header class="qbar">
      <button class="icon-btn" data-act="quit" aria-label="Quiz beenden">${ICON.close}</button>
      <div class="qprog" aria-hidden="true">${Q.marks.map((m, i) => `<i data-i="${i}"></i>`).join('')}</div>
      <div class="qstreak" aria-label="Richtig hintereinander">${ICON.spark}<b>0</b></div>
    </header>
    <main class="stage">
      <div class="stage-bg" aria-hidden="true"></div>
      <div class="qhead">
        <div class="qlabel"></div>
        <button class="replay icon-btn" data-act="replay" aria-label="Aufgabe noch einmal hören">${ICON.speaker}</button>
      </div>
      <div class="task" aria-live="polite"></div>
      <div class="qfeedback" aria-live="assertive"></div>
    </main>
    <section class="pad"></section>
  </div>`;
}
const TYPE_LABEL = { mal: 'Mal-Aufgabe', geteilt: 'Geteilt-Aufgabe', luecke: 'Welche Zahl fehlt?' };
const LEADS = ['Fast!', 'Nicht ganz.', 'Hoppla!'];             // = fast_01 … fast_03
const SERIES = { 3: 'serie_3', 5: 'serie_5', 10: 'serie_10', 15: 'serie_mehr', 20: 'serie_mehr' };
function partsHTML(parts, slot = '') {
  return parts.map(p => p === null ? slot : typeof p === 'number' ? `<span class="n">${p}</span>` : `<span class="o">${p}</span>`).join('');
}
function slotHTML(state = '') {
  const v = Q.input;
  return `<span class="slot ${state}${v ? ' filled' : ''}">${v ? `<span class="v">${v}</span>` : '<span class="ph">?</span>'}</span>`;
}
function showTask(appendVoice = true) {
  const el = document.getElementById('quiz');
  if (!el || !Q) return;
  const t = Q.list[Q.i];
  Q.input = ''; Q.locked = false;
  el.setAttribute('style', rowVars(t.r));
  el.querySelector('.stage-bg').innerHTML = mini(t.r, 'tint');
  el.querySelector('.qlabel').innerHTML = `${mini(t.r)}<span>${ROW[t.r].name}</span><span class="dot">·</span><span>${TYPE_LABEL[t.type]}</span>`;
  const task = el.querySelector('.task');
  task.className = 'task enter';
  task.innerHTML = partsHTML(t.parts, slotHTML());
  task.setAttribute('aria-label', spoken(t.parts));
  el.querySelector('.qfeedback').innerHTML = t.retry ? '<span class="again">Noch einmal – du schaffst das!</span>' : '';
  renderPad();
  updateProgress();
  const say = [];
  if (Q.intro && voiceOn()) say.push(Q.intro);
  if (S.settings.readTasks) say.push(t.q);
  if (say.length) Sound.say(say, appendVoice && !Q.intro);
  Q.intro = null;
}
function spoken(parts) {
  return parts.map(p => p === null ? 'wie viel' : p === '·' ? 'mal' : p === ':' ? 'geteilt durch' : p === '=' ? 'ist' : p).join(' ');
}
function renderPad(state = 'input') {
  const pad = document.querySelector('#quiz .pad');
  if (!pad) return;
  if (state === 'next') {
    pad.innerHTML = `<div class="pad-next"><button class="btn primary big" data-act="next">Weiter</button></div>`;
    pad.querySelector('button').focus({ preventScroll: true });
    return;
  }
  if (S.settings.answer === 'waehlen') {
    const t = Q.list[Q.i];
    pad.innerHTML = `<div class="choices">${choicesFor(t).map(v => `<button class="choice" data-act="choice" data-v="${v}">${v}</button>`).join('')}</div>`;
    return;
  }
  const k = v => `<button class="key" data-act="key" data-v="${v}">${v}</button>`;
  pad.innerHTML = `<div class="keys">
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k).join('')}
    <button class="key key-fn" data-act="del" aria-label="Löschen">${ICON.del}</button>
    ${k(0)}
    <button class="key key-ok" data-act="ok" aria-label="Fertig" disabled>${ICON.check}</button>
  </div>`;
}
function updateSlot(state = '') {
  const s = document.querySelector('#quiz .slot');
  if (!s) return;
  s.outerHTML = slotHTML(state);
  const ok = document.querySelector('#quiz .key-ok');
  if (ok) ok.disabled = !Q.input;
}
function updateProgress() {
  const el = document.getElementById('quiz');
  if (!el) return;
  el.querySelectorAll('.qprog i').forEach((s, i) => {
    s.className = `${Q.marks[i] || ''} ${i === Q.list[Q.i].slot ? 'cur' : ''}`.trim();
    const t = Q.list.find(x => x.slot === i && !x.retry);
    if (t) { s.style.setProperty('--c', ROW[t.r].c); s.style.setProperty('--soft', ROW[t.r].soft); }
  });
  const st = el.querySelector('.qstreak');
  st.querySelector('b').textContent = Q.streak;
  st.classList.toggle('show', Q.streak >= 2);
}
function typeDigit(v) {
  if (!Q || Q.locked) return;
  if (Q.input.length >= 2) return;
  Q.input = Q.input === '0' ? String(v) : Q.input + v;
  sfx.tap();
  updateSlot();
}
function deleteDigit() {
  if (!Q || Q.locked || !Q.input) return;
  Q.input = Q.input.slice(0, -1);
  sfx.tap();
  updateSlot();
}
function submit(val) {
  if (!Q || Q.locked) return;
  const t = Q.list[Q.i];
  if (val == null) { if (!Q.input) return; val = Number(Q.input); }
  Q.locked = true;
  const ok = val === t.answer;
  const first = !t.retry;
  if (first) record(t.r, t.k, ok);
  const el = document.getElementById('quiz');
  if (ok) {
    Q.streak++; Q.best = Math.max(Q.best, Q.streak);
    if (first) { Q.right++; Q.marks[t.slot] = 'ok'; } else { Q.marks[t.slot] = 'fixed'; }
    if (S.settings.answer === 'waehlen') Q.input = String(val);
    updateSlot('right');
    markChoice(val, t.answer);
    sfx.right(Q.streak);
    const slot = el.querySelector('.slot');
    if (slot) burst(slot, ROW[t.r].c, 9, t.r);
    const praise = SERIES[Q.streak] || (Math.random() < 0.3 ? lines.lob(10) : null);
    if (praise && voiceOn()) Sound.say(praise); else Sound.stop();
    updateProgress();
    const q = Q;
    setTimeout(() => { if (Q === q && Q.list[Q.i] === t) advance(true); }, 820);
  } else {
    Q.streak = 0;
    if (first) { Q.marks[t.slot] = 'bad'; Q.mistakes.push({ t, val }); }
    if (S.settings.answer === 'waehlen') Q.input = String(val);
    updateSlot('wrong');
    markChoice(val, t.answer);
    sfx.wrong();
    if (t.retry < 2) {
      const again = makeTask(t.r, t.k, t.type);
      again.slot = t.slot; again.retry = t.retry + 1;
      Q.list.splice(Math.min(Q.i + 3, Q.list.length), 0, again);
    }
    const lead = rnd(LEADS.length);
    el.querySelector('.qfeedback').innerHTML = `<div class="explain">
      <span class="lead">${LEADS[lead]} So ist es richtig:</span>
      <span class="eqx">${partsHTML(t.solved.map((p, i) => (t.parts[i] === null ? null : p)), `<span class="n good">${t.answer}</span>`)}</span>
      ${t.because ? `<span class="because">denn ${partsHTML(t.because)}</span>` : ''}
    </div>`;
    sayHelp([`fast_0${lead + 1}`, t.s]);
    updateProgress();
    setTimeout(() => { if (Q && Q.list[Q.i] === t) renderPad('next'); }, 350);
  }
}
function markChoice(val, answer) {
  document.querySelectorAll('#quiz .choice').forEach(b => {
    const v = +b.dataset.v;
    b.disabled = true;
    if (v === answer) b.classList.add('right');
    else if (v === val) b.classList.add('wrong');
  });
}
function advance(auto) {
  if (!Q) return;
  if (!auto) Sound.stop();
  Q.i++;
  if (Q.i >= Q.list.length) return finish();
  showTask(true);
}
function finish() {
  const q = Q;
  const newly = q.rows.filter(r => rowSafe(r) === 10 && !S.mastered[r]);
  newly.forEach(r => { S.mastered[r] = true; });
  const key = q.mode.kind === 'row' ? `row${q.mode.rows[0]}` : q.mode.kind;
  const prevBest = S.best[key] || 0;
  S.best[key] = Math.max(prevBest, q.right / q.total);
  save();
  const res = {
    mode: q.mode, right: q.right, total: q.total, best: q.best, marks: q.marks.slice(),
    slots: q.list.filter(t => !t.retry).map(t => t.r), mistakes: q.mistakes, newly,
    rows: q.rows.map(r => ({ r, from: q.before[r], to: rowLevel(r) })),
    secs: Math.round((Date.now() - q.started) / 1000),
  };
  nav('result', { res }, false);
  const perfect = res.right === res.total;
  sfx.done(perfect);
  sayHelp([perfect ? `perfekt_0${1 + rnd(2)}` : `fertig_0${1 + rnd(3)}`, ...newly.map(r => `sitzt_${r}`)]);
  setTimeout(() => { confetti(perfect ? 70 : 40, res.rows.map(x => x.r)); if (newly.length) sfx.sparkle(); }, 250);
}

/* ---------------------------------------------------------------- Ergebnis */
function resultHTML(res) {
  const p = res.right / res.total;
  const title = p === 1 ? 'Alles richtig!' : p >= 0.8 ? 'Super gemacht!' : p >= 0.5 ? 'Gut gemacht!' : 'Geschafft!';
  const sub = p === 1 ? 'Jede Aufgabe auf Anhieb – fantastisch.' : p >= 0.5 ? 'Die kniffligen Aufgaben kommen bald wieder.' : 'Jede Runde macht dich sicherer. Weiter so!';
  const shapes = res.rows.slice(0, 7).map((x, i) => `<div class="res-shape" style="${rowVars(x.r)}">${shapeSVG(x.r, { level: x.to, from: x.from, delay: 0.5 + i * 0.12 })}</div>`).join('');
  const marks = res.marks.map((m, i) => `<span style="animation-delay:${(0.5 + i * 0.045).toFixed(2)}s">${mini(res.slots[i], m === 'ok' ? 'full' : m === 'fixed' ? 'half' : 'outline')}</span>`).join('');
  const mins = Math.floor(res.secs / 60), secs = res.secs % 60;
  const time = mins ? `${mins} min ${secs} s` : `${secs} s`;
  const newly = res.newly.map(r => `<div class="badge" style="${rowVars(r)}">${mini(r)}<span><b>Die ${ROW[r].name} sitzt!</b> Alle zehn Aufgaben sind sicher.</span></div>`).join('');
  const mist = res.mistakes.length ? `<section class="mistakes">
      <h2>Das üben wir noch</h2>
      <ul>${res.mistakes.map(m => `<li style="${rowVars(m.t.r)}"><span class="eq-s">${partsHTML(m.t.solved)}</span><span class="yours">du: ${m.val}</span></li>`).join('')}</ul>
    </section>` : '';
  return `<div class="screen result" style="${res.mode.kind === 'row' ? rowVars(res.mode.rows[0]) : ''}">
    <div class="res-card card">
      <div class="res-shapes${res.rows.length > 3 ? ' many' : ''}">${shapes}</div>
      <h1>${title}</h1>
      <p class="res-sub">${sub}</p>
      <div class="res-stats">
        <div><b>${res.right}<small>/${res.total}</small></b><span>auf Anhieb richtig</span></div>
        <div><b>${res.best}</b><span>längste Serie</span></div>
        <div><b>${time}</b><span>Zeit</span></div>
      </div>
      <div class="res-marks" aria-hidden="true">${marks}</div>
      ${newly}
      ${mist}
      <div class="res-actions">
        <button class="btn primary big" data-act="again">${ICON.play}<span>Nochmal</span></button>
        <button class="btn ghost big" data-act="home">Zur Übersicht</button>
      </div>
    </div>
  </div>`;
}

/* ================================================================ Fenster (Sheets) */
let sheetOpen = null;
function openSheet(name, html) {
  sheetOpen = name;
  sheetRoot.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">${html}</div>`;
  requestAnimationFrame(() => sheetRoot.classList.add('open'));
  sheetRoot.querySelector('.sheet').focus({ preventScroll: true });
}
function closeSheet(now) {
  if (!sheetOpen) return;
  sheetOpen = null;
  sheetRoot.classList.remove('open');
  if (now) { sheetRoot.innerHTML = ''; return; }
  setTimeout(() => { if (!sheetOpen) sheetRoot.innerHTML = ''; }, 260);
}
const sw = (key, label, sub) => `<div class="set-row">
    <div><span class="set-label">${label}</span>${sub ? `<span class="set-sub">${sub}</span>` : ''}</div>
    <button class="switch" role="switch" aria-checked="${!!S.settings[key]}" data-act="toggle" data-key="${key}" aria-label="${label}"><i></i></button>
  </div>`;
const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) =>
  `<button role="radio" aria-checked="${S.settings[key] === v}" data-act="seg" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
function settingsHTML() {
  return `<header class="sheet-head"><h2 id="sheet-title">Einstellungen</h2>
      <button class="icon-btn" data-act="close-sheet" aria-label="Schließen" data-autofocus>${ICON.close}</button></header>
    <div class="sheet-body">
      <section class="set-group"><h3>Aufgaben im Quiz</h3>
        ${sw('mal', 'Mal-Aufgaben', '7 · 8 = ?')}
        ${sw('geteilt', 'Geteilt-Aufgaben', '56 : 8 = ?')}
        ${sw('luecke', 'Lücken-Aufgaben', '7 · ? = 56')}
      </section>
      <section class="set-group"><h3>Antworten</h3>
        ${seg('answer', [['tippen', 'Eintippen'], ['waehlen', 'Aus 4 wählen']])}
      </section>
      <section class="set-group"><h3>Aufgaben pro Runde</h3>
        ${seg('length', [[10, '10'], [20, '20']])}
      </section>
      <section class="set-group"><h3>Ton</h3>
        ${sw('readTasks', 'Aufgaben vorlesen')}
        ${sw('voice', 'Lob und Hilfe sprechen')}
        ${sw('sounds', 'Geräusche')}
        <button class="btn ghost" data-act="test-sound">${ICON.speaker}<span>Ton testen</span></button>
        <p class="set-note">Auf dem iPhone: Ist kein Ton zu hören, die Lautstärke-Tasten probieren oder den Stumm-Schalter ausschalten.</p>
      </section>
      <div id="install-set">${installSetHTML()}</div>
      <section class="set-group"><h3>Fortschritt</h3>
        <button class="btn danger" data-act="reset">Fortschritt löschen</button>
      </section>
      <p class="about">Einmaleins · Stand ${window.BUILD} · Schrift »Outfit« (SIL Open Font License) · Stimme von ElevenLabs</p>
    </div>`;
}
function mixHTML() {
  return `<header class="sheet-head"><h2 id="sheet-title">Zufalls-Mix</h2>
      <button class="icon-btn" data-act="close-sheet" aria-label="Schließen">${ICON.close}</button></header>
    <div class="sheet-body">
      <p class="sheet-lead">Welche Reihen sollen dabei sein?</p>
      <div class="chips">${ROWS.map(r => `<button class="chip" style="${rowVars(r)}" data-act="mix-row" data-row="${r}" aria-pressed="${S.mixRows.includes(r)}">${mini(r)}<b>${r}</b></button>`).join('')}</div>
      <div class="chip-tools"><button class="link" data-act="mix-all">Alle</button><span>·</span><button class="link" data-act="mix-none">Keine</button></div>
      <button class="btn primary big wide" data-act="start-mix" data-autofocus ${S.mixRows.length ? '' : 'disabled'}>${ICON.play}<span>Los geht’s</span></button>
    </div>`;
}
function confirmHTML(title, text, yes, act) {
  return `<header class="sheet-head"><h2 id="sheet-title">${title}</h2></header>
    <div class="sheet-body"><p class="sheet-lead">${text}</p>
      <div class="confirm-actions"><button class="btn ghost big" data-act="close-sheet" data-autofocus>Abbrechen</button>
      <button class="btn danger big" data-act="${act}">${yes}</button></div></div>`;
}

/* ================================================================ Effekte */
function burst(el, color, n, r) {
  if (reduced()) return;
  const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'pt';
    p.innerHTML = mini(r);
    fxRoot.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70, s = 0.5 + Math.random() * 0.6;
    const anim = p.animate([
      { transform: `translate(${x}px,${y}px) scale(${s}) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(a) * d}px,${y + Math.sin(a) * d}px) scale(${s * 0.4}) rotate(${rnd(360) - 180}deg)`, opacity: 0 },
    ], { duration: 650 + rnd(250), easing: 'cubic-bezier(.15,.7,.3,1)' });
    anim.onfinish = () => p.remove();
  }
}
function confetti(n, rows) {
  if (reduced()) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < n; i++) {
    const r = pick(rows.length ? rows : ROWS);
    const p = document.createElement('div');
    p.className = 'pt big';
    p.innerHTML = mini(r);
    fxRoot.appendChild(p);
    const x0 = w * (0.1 + Math.random() * 0.8), y0 = -40 - Math.random() * 120;
    const x1 = x0 + (Math.random() - 0.5) * 240, y1 = h + 60;
    const s = 0.6 + Math.random() * 0.9, rot = (Math.random() - 0.5) * 900;
    const anim = p.animate([
      { transform: `translate(${x0}px,${y0}px) scale(${s}) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x1}px,${y1}px) scale(${s}) rotate(${rot}deg)`, opacity: 0.9 },
    ], { duration: 1800 + rnd(1600), delay: rnd(500), easing: 'cubic-bezier(.3,.1,.6,1)' });
    anim.onfinish = () => p.remove();
  }
}
function nope(el) { if (!el || reduced()) return; el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }

/* ================================================================ Bedienung */
app.addEventListener('click', onClick);
sheetRoot.addEventListener('click', onClick);
function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act, r = +b.dataset.row;
  switch (act) {
    case 'hello': sfx.tap(); Sound.say('hallo'); break;
    case 'settings': sfx.tap(); openSheet('settings', settingsHTML()); break;
    case 'close-sheet': closeSheet(); break;
    case 'home': sfx.tap(); nav('home'); break;
    case 'row': sfx.tap(); nav('row', { row: r }); if (voiceOn()) Sound.say(`reihe_${r}`); break;
    case 'fact': sfx.tap(); toggleFact(b); break;
    case 'start-row': startQuiz({ kind: 'row', rows: [r] }); break;
    case 'start-hard': startQuiz({ kind: 'hard' }); break;
    case 'mix': sfx.tap(); openSheet('mix', mixHTML()); break;
    case 'mix-row': {
      const on = S.mixRows.includes(r);
      S.mixRows = on ? S.mixRows.filter(x => x !== r) : [...S.mixRows, r].sort();
      save(); sfx.tap();
      b.setAttribute('aria-pressed', String(!on));
      sheetRoot.querySelector('[data-act="start-mix"]').disabled = !S.mixRows.length;
      break;
    }
    case 'mix-all': case 'mix-none':
      S.mixRows = act === 'mix-all' ? ROWS.slice() : [];
      save(); sfx.tap();
      sheetRoot.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(S.mixRows.includes(+c.dataset.row))));
      sheetRoot.querySelector('[data-act="start-mix"]').disabled = !S.mixRows.length;
      break;
    case 'start-mix': if (S.mixRows.length) startQuiz({ kind: 'mix', rows: S.mixRows.slice() }); break;
    case 'key': typeDigit(+b.dataset.v); break;
    case 'del': deleteDigit(); break;
    case 'ok': submit(); break;
    case 'choice': submit(+b.dataset.v); break;
    case 'next': advance(false); break;
    case 'replay': if (Q) Sound.say(Q.list[Q.i].q); break;
    case 'quit':
      sfx.tap();
      openSheet('quit', confirmHTML('Runde beenden?', 'Was du schon gerechnet hast, bleibt gespeichert.', 'Beenden', 'quit-yes'));
      break;
    case 'quit-yes': {
      const m = Q && Q.mode;
      Q = null; Sound.stop();
      nav(m && m.kind === 'row' ? 'row' : 'home', m && m.kind === 'row' ? { row: m.rows[0] } : {});
      break;
    }
    case 'again': {
      const m = view.res.mode;
      if (m.kind === 'hard' && !hardFacts().length) { nav('home'); break; }
      startQuiz(m);
      break;
    }
    case 'toggle': {
      const key = b.dataset.key, val = !S.settings[key];
      if (!val && ['mal', 'geteilt', 'luecke'].includes(key) && ['mal', 'geteilt', 'luecke'].filter(k => S.settings[k]).length === 1) { nope(b); break; }
      S.settings[key] = val; save(); sfx.tap();
      b.setAttribute('aria-checked', String(val));
      if (!val && (key === 'voice' || key === 'readTasks')) Sound.stop();
      break;
    }
    case 'seg': {
      const key = b.dataset.key, v = key === 'length' ? +b.dataset.v : b.dataset.v;
      S.settings[key] = v; save(); sfx.tap();
      b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      break;
    }
    case 'test-sound': sfx.right(3); setTimeout(() => Sound.say('hallo'), 350); break;
    case 'reset': openSheet('reset', confirmHTML('Fortschritt löschen?', 'Alle Formen werden wieder leer und die kniffligen Aufgaben vergessen. Das lässt sich nicht rückgängig machen.', 'Löschen', 'reset-yes')); break;
    case 'reset-yes':
      S.facts = {}; S.best = {}; S.mastered = {}; save();
      closeSheet(true); nav('home', {}, false);
      break;
    case 'hint-close': S.hintClosed = true; save(); refreshInstall(); break;
    case 'install': {
      const ev = installEvent;
      if (!ev) break;
      installEvent = null;                // ein Ereignis darf nur einmal fragen; Android meldet später ein neues
      try {
        ev.prompt();
        ev.userChoice.then(c => { if (c && c.outcome === 'accepted') { S.installed = true; save(); } refreshInstall(); }).catch(refreshInstall);
      } catch (err) { refreshInstall(); }
      break;
    }
  }
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && sheetOpen) { closeSheet(); e.preventDefault(); return; }
  if (view.name !== 'quiz' || !Q || sheetOpen) return;
  if (/^[0-9]$/.test(e.key) && S.settings.answer === 'tippen') { typeDigit(+e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { deleteDigit(); e.preventDefault(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (document.querySelector('#quiz [data-act="next"]')) advance(false); else submit();
  } else if (e.key === 'Escape') { onClick({ target: document.querySelector('#quiz [data-act="quit"]') }); }
});

/* ================================================================ Start */
try { history.replaceState({ name: 'home' }, ''); } catch (e) { /* file:// */ }
render();


if ('serviceWorker' in navigator && window.BUILD !== 'dev' && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;          // erster Besuch: nichts neu laden
    if (view.name === 'quiz' || view.name === 'result') reloadPending = true; else location.reload();
  });
}
})();
