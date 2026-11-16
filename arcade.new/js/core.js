/* ARCADE — noyau : constantes, utilitaires, entrées (clavier + tactile), son */
(function () {
  const G = (window.G = {});
  G.VERSION = '2.0.0'; // à augmenter à chaque mise en ligne (voir version.json)
  G.W = 960; G.H = 540; G.GROUND = 456; G.STAGE_W = 1500;
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rnd = (a, b) => a + Math.random() * (b - a);
  const vr = (function () { let s = 987654321; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; })();
  G.vrnd = (a, b) => a + vr() * (b - a); // hasard réservé à l'affichage
  G.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  G.rng = function (seed) { // générateur déterministe (décors)
    let s = seed >>> 0;
    return function () {
      s += 0x6d2b79f5; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- Entrées ---------- */
  const KEYMAP = {
    ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
    ArrowUp: 'u', KeyW: 'u', Space: 'u', ArrowDown: 'd', KeyS: 'd',
    KeyJ: 'a', KeyK: 'b', KeyL: 'c', KeyU: 's', KeyI: 'x',
  };
  const held = { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, c: 0, s: 0, x: 0 };
  const touch = { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, c: 0, s: 0, x: 0 };
  G.input = {
    anyKeyCb: null,
    read() {
      const o = {};
      for (const k in held) o[k] = !!(held[k] || touch[k]);
      if (o.l && o.r) o.l = o.r = false;
      return o;
    },
    empty() { return { l: false, r: false, u: false, d: false, a: false, b: false, c: false, s: false, x: false }; },
    touch,
  };
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = KEYMAP[e.code];
    if (k) { held[k] = 1; e.preventDefault(); }
    if (G.input.anyKeyCb && !e.repeat) G.input.anyKeyCb(e);
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) held[k] = 0; });
  window.addEventListener('blur', () => { for (const k in held) held[k] = 0; for (const k in touch) touch[k] = 0; });

  /* Manette tactile : croix directionnelle (glisser) + 5 boutons */
  G.setupTouch = function (root) {
    const pad = root.querySelector('.pad'), knob = root.querySelector('.knob');
    let padId = null;
    function padMove(e) {
      const r = pad.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (G.input.rotated) { const t = dx; dx = dy; dy = -t; } // jeu tourné d'un quart de tour
      const dead = r.width * 0.14, m = Math.hypot(dx, dy), max = r.width * 0.3;
      touch.l = dx < -dead ? 1 : 0; touch.r = dx > dead ? 1 : 0;
      touch.u = dy < -dead * 1.6 ? 1 : 0; touch.d = dy > dead * 1.6 ? 1 : 0;
      const k = m > max ? max / m : 1;
      knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    }
    function padEnd() { padId = null; touch.l = touch.r = touch.u = touch.d = 0; knob.style.transform = ''; }
    pad.addEventListener('pointerdown', (e) => { padId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (_) {} padMove(e); e.preventDefault(); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) padMove(e); });
    pad.addEventListener('pointerup', padEnd); pad.addEventListener('pointercancel', padEnd);
    root.querySelectorAll('[data-btn]').forEach((b) => {
      const k = b.dataset.btn;
      const on = (e) => { touch[k] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); };
      const off = () => { touch[k] = 0; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  /* ---------- Son (synthèse WebAudio, aucun fichier) ---------- */
  let ac = null, master = null, musicTimer = null, noiseBuf = null;
  G.audio = { on: true, started: false };
  function ctx() {
    if (ac) return ac;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (_) { ac = null; }
    return ac;
  }
  function tone(f0, f1, dur, type, vol, when) {
    const a = ctx(); if (!a || !G.audio.on) return; const t = a.currentTime + (when || 0);
    const o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, freq, q, vol, when, type) {
    const a = ctx(); if (!a || !G.audio.on) return; const t = a.currentTime + (when || 0);
    const s = a.createBufferSource(); s.buffer = noiseBuf; const f = a.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1; const g = a.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  const SFX = {
    hit() { if (playHit(false)) return; noise(0.05, 2600, 0.9, 0.55); noise(0.14, 700, 0.7, 0.9); tone(190, 52, 0.16, 'sine', 0.95); },
    heavy() { if (playHit(true)) return; noise(0.06, 2200, 0.9, 0.7); noise(0.24, 480, 0.6, 1.1); tone(140, 34, 0.32, 'sine', 1.1); tone(320, 80, 0.12, 'square', 0.18); },
    block() { noise(0.06, 2400, 3, 0.4); tone(520, 300, 0.06, 'triangle', 0.25); },
    whoosh() { noise(0.14, 1500, 1.2, 0.18, 0, 'highpass'); },
    jump() { tone(260, 520, 0.12, 'sine', 0.12); },
    land() { noise(0.08, 300, 1, 0.25, 0, 'lowpass'); },
    proj() { tone(240, 900, 0.25, 'sawtooth', 0.14); noise(0.3, 2000, 2, 0.15); },
    superc() { tone(110, 880, 0.7, 'sawtooth', 0.2); noise(0.8, 3000, 1, 0.2, 0, 'highpass'); tone(55, 55, 0.8, 'sine', 0.5); },
    beam() { noise(0.9, 500, 0.5, 0.6, 0, 'lowpass'); tone(90, 50, 0.9, 'sawtooth', 0.3); },
    ko() { tone(220, 40, 0.9, 'sine', 0.9); noise(0.7, 400, 0.6, 0.8, 0, 'lowpass'); },
    ui() { tone(660, 880, 0.07, 'triangle', 0.2); },
    ok() { tone(520, 1040, 0.12, 'triangle', 0.25); tone(780, 1560, 0.12, 'triangle', 0.15, 0.06); },
    gong() { tone(196, 190, 1.6, 'sine', 0.6); tone(294, 290, 1.2, 'sine', 0.3); tone(392, 388, 0.9, 'triangle', 0.15); noise(0.3, 800, 0.5, 0.3); },
    brk() { noise(0.35, 1800, 0.6, 0.7); tone(700, 120, 0.3, 'square', 0.2); },
  };
  G.sfx = function (n) { if (G.audio.started && !G.mute && SFX[n]) try { SFX[n](); } catch (_) {} };
  /* ---------- Musique et bruitages en fichiers (listes dans js/config.js) ----------
     menu : morceaux joués à tour de rôle, avec 3 secondes de silence entre deux ;
     fight : musique de fond douce pendant les combats ; hit : bruitages de coup. */
  const FILES = Object.assign({ menu: [], fight: [], hit: [] }, (window.ARCADE_CONFIG || {}).audio || {});
  let cur = null, curKind = null, gapTimer = null, menuIdx = 0;
  const hitBufs = [];
  function stopMusic() { clearTimeout(gapTimer); if (cur) { const a = cur; let v = a.volume; const iv = setInterval(() => { v -= 0.06; if (v <= 0) { clearInterval(iv); a.pause(); } else a.volume = v; }, 40); } cur = null; curKind = null; }
  function playTrack(src, vol, loop, onEnd) {
    const a = new Audio(src); a.volume = 0; a.loop = !!loop; a.preload = 'auto';
    a.addEventListener('ended', () => { if (cur === a && onEnd) onEnd(); });
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    let v = 0; const iv = setInterval(() => { if (cur !== a) return clearInterval(iv); v = Math.min(vol, v + 0.04); a.volume = v; if (v >= vol) clearInterval(iv); }, 50);
    cur = a; return a;
  }
  function nextMenu() {
    if (curKind !== 'menu' || !FILES.menu.length) return;
    const src = FILES.menu[menuIdx % FILES.menu.length]; menuIdx++;
    playTrack(src, 0.55, false, () => { gapTimer = setTimeout(nextMenu, 3000); });
    curKind = 'menu';
  }
  G.music = function (kind) {
    if (kind === curKind) return;
    stopMusic(); if (!kind || !G.audio.started || !G.audio.on) return;
    if (kind === 'menu' && FILES.menu.length) { curKind = 'menu'; nextMenu(); }
    else if (kind === 'fight' && FILES.fight.length) { playTrack(G.pick(FILES.fight), 0.22, true); curKind = 'fight'; }
  };
  G.musicKind = () => curKind;
  async function loadHits() {
    const a = ctx(); if (!a) return;
    for (const src of FILES.hit) { try { const r = await fetch(src); const b = await r.arrayBuffer(); hitBufs.push(await a.decodeAudioData(b)); } catch (_) {} }
  }
  function playHit(heavy) {
    const a = ctx(); if (!a || !hitBufs.length) return false;
    const s = a.createBufferSource(); s.buffer = G.pick(hitBufs); s.playbackRate.value = (heavy ? 0.86 : 1) * (0.94 + Math.random() * 0.12);
    const g = a.createGain(); g.gain.value = heavy ? 1.15 : 0.9; s.connect(g); g.connect(master); s.start();
    if (heavy) tone(70, 38, 0.28, 'sine', 0.55); // grave en plus pour les gros coups
    return true;
  }
  G.startAudio = function () {
    if (G.audio.started) return; const a = ctx(); if (!a) return;
    if (a.state === 'suspended') a.resume().catch(() => {});
    G.audio.started = true; loadHits();
  };
})();
