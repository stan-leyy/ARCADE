/* ARCADE — premier lancement : présentation animée du jeu, puis première partie guidée (consignes au ralenti) */
(function () {
  const G = window.G, W = G.W, H = G.H;
  const $ = (s) => document.querySelector(s);
  const ease = (t) => 1 - Math.pow(1 - G.clamp(t, 0, 1), 3);

  /* ---------- légendes en surimpression ---------- */
  let capTimer = null;
  function caption(title, sub, side) {
    const box = $('#cineCap'); if (!box) return;
    box.classList.remove('in'); void box.offsetWidth;
    box.querySelector('.ct').textContent = title || ''; box.querySelector('.cs').textContent = sub || '';
    box.dataset.side = side || 'left'; box.hidden = !title;
    if (title) box.classList.add('in');
    clearTimeout(capTimer);
  }

  /* ---------- outils de dessin ---------- */
  function bigText(c, txt, x, y, size, col, align, alpha) {
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    c.font = size + 'px Shojumaru, Oswald, sans-serif'; c.lineJoin = 'round'; c.lineWidth = size * 0.14; c.strokeStyle = '#120b0d'; c.strokeText(txt, x, y);
    if (col === 'fire') { const g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#ffb52e'); g.addColorStop(1, '#ff5a1f'); c.fillStyle = g; } else c.fillStyle = col;
    c.fillText(txt, x, y); c.restore();
  }
  function smallText(c, txt, x, y, size, col, align, alpha) {
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    c.font = '700 ' + size + 'px Oswald, sans-serif'; c.fillStyle = col; c.fillText(txt, x, y); c.restore();
  }
  function wrapText(c, txt, x, y, maxW, lh, size, col, alpha) {
    c.save(); c.font = '700 ' + size + 'px Oswald, sans-serif'; let line = '', yy = y;
    for (const word of String(txt || '').split(' ')) { const t = line ? line + ' ' + word : word; if (c.measureText(t).width > maxW && line) { smallText(c, line, x, yy, size, col, 'left', alpha); line = word; yy += lh; } else line = t; }
    if (line) smallText(c, line, x, yy, size, col, 'left', alpha); c.restore();
  }
  function vignette(c, a) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(6,3,6,' + a + ')'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  function pedestal(c, x, y, r, col) {
    const g = c.createRadialGradient(x, y, 4, x, y, r * 1.6); g.addColorStop(0, G.hexA(col, 0.6)); g.addColorStop(1, G.hexA(col, 0)); c.fillStyle = g; c.fillRect(x - r * 1.6, y - r, r * 3.2, r * 1.6);
    c.beginPath(); c.ellipse(x, y + 6, r, r * 0.16, 0, 0, 7); c.fillStyle = '#0d1424'; c.fill();
    c.beginPath(); c.ellipse(x, y, r, r * 0.16, 0, 0, 7); c.fillStyle = '#dfeaf4'; c.fill(); c.lineWidth = 3; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 16; c.stroke(); c.shadowBlur = 0;
  }
  function spring(state, key, target, k) { // pose fluide pour les personnages de la présentation
    if (!state[key]) state[key] = { p: G.poseClone(target), v: {} };
    G.poseSpring(state[key].p, state[key].v, target, k || 0.3, 0.6); return state[key].p;
  }

  /* ---------- Présentation (environ 1 min 45) ---------- */
  class Cine {
    constructor(api) {
      this.api = api; this.t = 0; this.i = 0; this.st = 0; this.mem = {}; this.done = false;
      this.stage = { lames: new G.Stage(G.STAGES[0]), canyon: new G.Stage(G.STAGES[1]), lune: new G.Stage(G.STAGES[2]) };
      const S = this;
      this.scenes = [
        { dur: 6, init() { caption(''); }, draw(c) {
          const st = S.stage.lune; st.update(); st.draw(c, (G.STAGE_W - W) / 2 + Math.sin(S.st * 0.004) * 60); st.drawFront(c, 0);
          c.fillStyle = 'rgba(8,4,8,.55)'; c.fillRect(0, 0, W, H); vignette(c, 0.9);
          const k = ease(S.st / 70), z = 1.6 - 0.6 * k;
          c.save(); c.translate(W / 2, H * 0.44); c.scale(z, z); bigText(c, 'ARCADE', 0, 0, 110, 'fire', 'center', k); c.restore();
          smallText(c, 'L A   V O I E   D U   N I N J A', W / 2, H * 0.62, 20, '#f3e6cf', 'center', ease((S.st - 60) / 40));
        } },
        { dur: 16, init() { caption('6 ninjas, 6 styles', 'Chacun a ses coups, sa technique spéciale et son attaque ultime', 'top'); }, draw(c) {
          const st = S.stage.lames; st.update(); st.draw(c, 260); c.fillStyle = 'rgba(10,6,10,.6)'; c.fillRect(0, 0, W, H); vignette(c, 0.8);
          const per = 16 * 60 / 6, idx = Math.min(5, (S.st / per) | 0), lt = S.st - idx * per, ch = G.CHARS[idx];
          const slide = ease(lt / 24), out = lt > per - 14 ? ease((lt - per + 14) / 14) : 0;
          const x = W * 0.62 + (1 - slide) * 300 - out * 300;
          pedestal(c, x, 470, 120, ch.col);
          const seq = ['idle', 'jabW', 'jab', 'idle', 'kickW', 'kick', 'hvW', 'hv', 'win'], si = Math.min(seq.length - 1, (lt / 18) | 0), key = (ch.poses && ch.poses[seq[si]]) || seq[si];
          const p = spring(S.mem, 'r' + idx, G.POSES[key], seq[si].endsWith('W') ? 0.2 : 0.4);
          c.save(); c.translate(x, 470); c.scale(1.7, 1.7); G.drawFighter(c, ch, p, S.t, { weapon: G.weaponById(ch.weapon) }); c.restore();
          bigText(c, ch.name, 70 - (1 - slide) * 200, 250, 64, ch.col, 'left', slide - out);
          smallText(c, ch.title.toUpperCase(), 74 - (1 - slide) * 200, 304, 20, '#f3e6cf', 'left', slide - out);
          smallText(c, 'SPÉCIAL : ' + ch.spName.toUpperCase(), 74, 350, 15, G.hexA(ch.col, 0.95), 'left', slide - out);
          smallText(c, 'ULTIME : ' + ch.suName, 74, 376, 15, G.hexA(ch.col, 0.95), 'left', slide - out);
        } },
        { dur: 34, init() {
          caption('Combats en 1 contre 1', 'Poing, pied, coup lourd : enchaîne-les pour faire des combos');
          S.m = new G.Match({ stage: G.STAGES[0], chars: [G.CHARS[0], G.CHARS[4]], weapons: ['ecarlate', 'brasier'], ctrl: ['cpu', 'cpu'], levels: [2, 2], need: 3, noTimer: true });
          S.m.f[0].sup = 40; S.ev = { last: 0, block: 0, sp: 0, su: 0, combo: 0 };
        }, step() {
          const m = S.m; m.step(); const f = m.f, ev = S.ev, can = S.st - ev.last > 260;
          if (S.st === 60 * 9) { f[1].en = 100; }
          if (S.st === 60 * 19) { f[0].sup = 100; }
          for (const x of f) if (x.hp < 260) x.hp = 260;
          if (can && !ev.combo && (f[0].cbShow > 60 && f[0].cbN >= 3 || f[1].cbShow > 60 && f[1].cbN >= 3)) { ev.combo = 1; ev.last = S.st; caption('Combos', 'Chaque coup qui touche ouvre la porte au suivant'); }
          if (can && !ev.block && (f[0].state === 'block' || f[1].state === 'block')) { ev.block = 1; ev.last = S.st; caption('Parade', 'Recule au bon moment pour encaisser sans dommage'); }
          if (!ev.sp && f.some((x) => x.state === 'atk' && x.mv === 's')) { ev.sp = 1; ev.last = S.st; caption('Techniques spéciales', 'Elles consomment ton énergie, la jauge bleue'); }
          if (!ev.su && m.sf) { ev.su = 1; ev.last = S.st; caption('Attaques ultimes', 'Remplis la jauge du bas, puis déchaîne-toi'); }
        }, draw(c) { S.m.draw(c); } },
        { dur: 12, init() { caption('3 arènes', 'Du champ de bataille au sanctuaire de la lune', 'bottom'); }, draw(c) {
          const per = 12 * 60 / 3, i = Math.min(2, (S.st / per) | 0), lt = S.st - i * per, def = G.STAGES[i], st = S.stage[def.id];
          st.update(); st.draw(c, 80 + (lt / per) * 300); st.drawFront(c, 0);
          for (const [k, ch, side] of [[0, G.CHARS[(i * 2 + 1) % 6], 1], [1, G.CHARS[(i * 2 + 2) % 6], -1]]) {
            const p = spring(S.mem, 'a' + i + k, G.POSES[(ch.poses && ch.poses.idle) || 'idle'], 0.2);
            c.save(); c.translate(W / 2 - side * 170, 456); c.scale(side * 1.12, 1.12); G.drawFighter(c, ch, p, S.t, {}); c.restore();
          }
          vignette(c, 0.55); const a = ease(lt / 20) * (1 - ease((lt - per + 16) / 16));
          bigText(c, def.name.toUpperCase(), W / 2, 110, 44, '#fff3c4', 'center', a); smallText(c, def.sub, W / 2, 150, 17, '#f3e6cf', 'center', a);
        } },
        { dur: 14, init() { caption('Des armes légendaires', 'Chacune donne un bonus : dégâts, portée, vitesse ou énergie', 'top'); }, draw(c) {
          c.fillStyle = '#0b0d16'; c.fillRect(0, 0, W, H);
          const list = G.WEAPONS.filter((w) => !w.hidden), per = 14 * 60 / list.length, i = Math.min(list.length - 1, (S.st / per) | 0), lt = S.st - i * per, w = list[i];
          const g = c.createRadialGradient(W * 0.38, H * 0.45, 10, W * 0.38, H * 0.45, 320); g.addColorStop(0, G.hexA(w.glow || '#9fe8ff', 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
          const a = ease(lt / 14), bob = Math.sin(S.t * 0.06) * 8;
          c.save(); c.globalAlpha = a; G.drawWeapon(c, w, w.kind === 'glove' ? W * 0.27 : W * 0.2, (w.kind === 'glove' ? H * 0.42 : H * 0.62) + bob, -40 + (1 - a) * 30, w.kind === 'glove' ? 2.4 : w.id === 'silence' ? 2.4 : 2.9, S.t); c.restore();
          bigText(c, w.name.toUpperCase(), W * 0.54, 200, w.name.length > 16 ? 26 : 32, w.glow || '#e8eef2', 'left', a);
          wrapText(c, w.desc, W * 0.54, 240, 380, 20, 15, '#cfd8e8', a);
          const b = w.bonus, rows = [['DÉGÂTS', '+' + Math.round(b.dmg * 100) + ' %'], ['PORTÉE', '+' + b.reach], ['VITESSE', (b.spd >= 0 ? '+' : '') + Math.round(b.spd * 100) + ' %'], ['ÉNERGIE', '+' + Math.round(b.en * 100) + ' %']];
          rows.forEach((r, k) => { smallText(c, r[0], W * 0.54, 300 + k * 30, 14, '#8fa3bf', 'left', a); smallText(c, r[1], W * 0.54 + 120, 300 + k * 30, 16, '#fff', 'left', a); });
          list.forEach((x, k) => { c.save(); c.globalAlpha = k === i ? 1 : 0.35; G.drawWeapon(c, x, 90 + k * 92, H - 40, -40, 0.42, S.t); c.restore(); });
        } },
        { dur: 12, init() { caption('Défie tes amis en ligne', 'Crée un salon, partage le code et combattez'); S.mem.board = 0; }, draw(c) {
          const st = S.stage.lune; st.update(); st.draw(c, 300); c.fillStyle = 'rgba(8,6,16,.72)'; c.fillRect(0, 0, W, H); vignette(c, 0.7);
          const t = S.st;
          if (t < 6 * 60) {
            const code = 'K7ZQ'.slice(0, Math.min(4, (t / 14) | 0));
            c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(W / 2 - 170, 120, 340, 130); c.strokeStyle = 'rgba(242,179,61,.6)'; c.strokeRect(W / 2 - 170, 120, 340, 130);
            smallText(c, 'CODE DU SALON', W / 2, 146, 14, '#8fa3bf'); bigText(c, code.split('').join(' '), W / 2, 200, 54, '#fff');
            const k = ease((t - 90) / 30);
            for (const [ch, x, f, nm] of [[G.CHARS[1], W / 2 - 220, 1, 'KOFFI'], [G.CHARS[3], W / 2 + 220, -1, 'STANLEY']]) {
              const p = spring(S.mem, 'o' + nm, G.POSES[(ch.poses && ch.poses.idle) || 'idle'], 0.2);
              c.save(); c.globalAlpha = k; c.translate(x, 470); c.scale(f * 1.1, 1.1); G.drawFighter(c, ch, p, S.t, { weapon: G.weaponById(ch.weapon) }); c.restore();
              smallText(c, nm, x, 492, 16, '#fff', 'center', k);
            }
            bigText(c, 'VS', W / 2, 380, 64, 'fire', 'center', k);
          } else {
            if (t === 6 * 60) caption('Grimpe au classement', 'Seules les victoires confirmées par les deux joueurs comptent');
            const rows = [['1', 'STANLEY', 42], ['2', 'KOFFI', 37], ['3', 'AMINA', 31], ['4', 'YAO', 24], ['5', 'IBRA', 19]];
            smallText(c, 'CLASSEMENT', W / 2, 110, 16, '#f2b33d');
            rows.forEach((r, k) => {
              const a = ease((t - 6 * 60 - k * 10) / 20), y = 150 + k * 56;
              c.save(); c.globalAlpha = a; c.fillStyle = k === 0 ? 'rgba(242,179,61,.18)' : 'rgba(255,255,255,.05)'; c.fillRect(W / 2 - 230 + (1 - a) * 80, y, 460, 46); c.restore();
              smallText(c, r[0], W / 2 - 200, y + 23, 20, k === 0 ? '#f2b33d' : '#cfd8e8', 'left', a);
              smallText(c, r[1], W / 2 - 160, y + 23, 20, '#fff', 'left', a);
              smallText(c, Math.round(r[2] * a) + ' V', W / 2 + 200, y + 23, 20, '#fff', 'right', a);
            });
          }
        } },
        { dur: 10, init() { caption('Gagne des pièces', 'Débloque de nouveaux ninjas et de nouvelles armes dans la boutique'); S.mem.coins = []; }, draw(c) {
          c.fillStyle = '#0b1020'; c.fillRect(0, 0, W, H);
          const t = S.st, ch = G.CHARS[5], unlock = ease((t - 300) / 40);
          pedestal(c, W * 0.66, 470, 130, ch.col);
          const p = spring(S.mem, 'shop', G.POSES[unlock > 0.5 ? 'win' : 'idle'], 0.14);
          c.save(); c.translate(W * 0.66, 470); c.scale(1.75, 1.75); G.drawFighter(c, ch, p, S.t, { mono: unlock < 0.5 ? 'rgba(14,20,36,.95)' : null }); c.restore();
          if (unlock > 0 && unlock < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = ch.col; c.lineWidth = 6 * (1 - unlock); c.beginPath(); c.arc(W * 0.66, 300, unlock * 420, 0, 7); c.stroke(); c.restore(); }
          if (S.mem.coins.length < 40 && t < 260) S.mem.coins.push({ x: 140 + Math.random() * 300, y: -20, v: 3 + Math.random() * 4, r: Math.random() * 6 });
          for (const k of S.mem.coins) { k.y += k.v; k.r += 0.12; c.save(); c.translate(k.x, Math.min(k.y, 430)); c.scale(Math.cos(k.r), 1); c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fillStyle = '#f2b33d'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#8a5a12'; c.stroke(); c.fillStyle = '#8a5a12'; c.fillRect(-3, -3, 6, 6); c.restore(); }
          const n = Math.min(1500, Math.round(ease(t / 250) * 1500));
          bigText(c, n + ' PIÈCES', 290, 210, 44, '#f2b33d'); smallText(c, unlock > 0.5 ? 'TEMBO DÉBLOQUÉ' : 'TEMBO · 1500 PIÈCES', 290, 260, 18, '#f3e6cf');
        } },
        { dur: 9999, init() { caption(''); S.done = true; S.api.onCta(); }, draw(c) {
          const st = S.stage.canyon; st.update(); st.draw(c, 270); st.drawFront(c, 0);
          for (const [ch, x, f] of [[G.CHARS[0], W / 2 - 180, 1], [G.CHARS[4], W / 2 + 180, -1]]) {
            const p = spring(S.mem, 'end' + ch.id, G.POSES.idle, 0.2);
            c.save(); c.translate(x, 456); c.scale(f * 1.15, 1.15); G.drawFighter(c, ch, p, S.t, {}); c.restore();
          }
          c.fillStyle = 'rgba(8,4,8,.45)'; c.fillRect(0, 0, W, H); vignette(c, 0.8);
          bigText(c, 'À TOI DE JOUER', W / 2, H * 0.3, 56, 'fire');
        } },
      ];
      this.enter(0);
    }
    enter(i) { this.i = i; this.st = 0; const s = this.scenes[i]; if (s.init) s.init.call(this); }
    step() { this.t++; this.st++; const s = this.scenes[this.i]; if (s.step) s.step.call(this); if (this.st >= s.dur * 60 && this.i < this.scenes.length - 1) this.enter(this.i + 1); }
    skip() { if (this.i < this.scenes.length - 1) this.enter(this.scenes.length - 1); }
    draw(c) {
      this.scenes[this.i].draw.call(this, c);
      const total = this.scenes.slice(0, -1).reduce((a, s) => a + s.dur * 60, 0), done = this.scenes.slice(0, this.i).reduce((a, s) => a + s.dur * 60, 0) + this.st;
      if (this.i < this.scenes.length - 1) { c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(0, H - 3, W, 3); c.fillStyle = '#ff8a1f'; c.fillRect(0, H - 3, W * G.clamp(done / total, 0, 1), 3); }
    }
  }
  G.Cine = Cine; G.caption = caption;

  /* ---------- Première partie guidée ---------- */
  const STEPS = [
    { t: 'Avance vers ton adversaire', keys: [['→', 'D']], pad: 'r', slow: 0.45, done: (me, op) => Math.abs(op.x - me.x) < 210 },
    { t: 'Coup de poing', keys: [['J']], btn: 'a', done: (me) => me.mv === 'a' && me.state === 'atk' },
    { t: 'Coup de pied', keys: [['K']], btn: 'b', done: (me) => me.mv === 'b' && me.state === 'atk' },
    { t: 'Coup lourd', keys: [['L']], btn: 'c', done: (me) => me.mv === 'c' && me.state === 'atk' },
    { t: 'Enchaîne : Poing, Poing, Pied', keys: [['J'], ['J'], ['K']], btn: 'a', slow: 1, near: 1, done: (me, op, tu) => op.combo >= 3 || tu.hits >= 4 },
    { t: 'Il attaque ! Recule pour parer', keys: [['←', 'Q']], pad: 'l', block: 1, slow: 1, done: (me) => me.state === 'block' },
    { t: 'Saute', keys: [['↑', 'Z']], pad: 'u', done: (me) => me.state === 'jump' },
    { t: 'Ruée : deux fois vers l’avant', keys: [['→'], ['→']], pad: 'r', done: (me) => me.state === 'dash' && me.dashF },
    { t: 'Technique spéciale', sub: 'Elle utilise ta jauge bleue', keys: [['U']], btn: 's', prep: (me) => { me.en = 100; }, done: (me) => me.mv === 's' && me.state === 'atk' },
    { t: 'Attaque ultime', sub: 'Ta jauge du bas est pleine', keys: [['I']], btn: 'x', prep: (me) => { me.sup = 100; }, done: (me) => me.mv === 'x' && me.state === 'atk' },
    { t: 'À toi de jouer : termine le combat !', free: 1 },
  ];
  class Tutorial {
    constructor(match) {
      this.m = match; this.i = -1; this.wait = 70; this.okT = 0; this.cool = 0; this.fails = 0;
      const me = match.f[0], op = match.f[1]; me.minHp = 1; op.minHp = 320;
      match.cpuOverride = (i, f, other) => this.cpu(f, other);
      this.card = $('#tut');
    }
    get step() { return STEPS[this.i]; }
    show(st) {
      const c = this.card; c.hidden = false; c.classList.remove('ok', 'in'); void c.offsetWidth; c.classList.add('in');
      c.querySelector('.tt').textContent = st.t; c.querySelector('.tsub').textContent = st.sub || '';
      const keys = c.querySelector('.tk'); keys.textContent = '';
      if (!document.body.classList.contains('touch')) for (const grp of st.keys || []) { const g = document.createElement('span'); for (const k of grp) { const b = document.createElement('kbd'); b.textContent = k; g.appendChild(b); } keys.appendChild(g); }
      document.querySelectorAll('#touch .pulse').forEach((e) => e.classList.remove('pulse'));
      if (st.btn) { const b = document.querySelector('#touch .tb[data-btn=' + st.btn + ']'); if (b) b.classList.add('pulse'); }
      if (st.pad) { const p = document.querySelector('#touch .pad'); if (p) { p.classList.add('pulse'); p.dataset.dir = st.pad; } }
    }
    ok() {
      const c = this.card; c.classList.add('ok'); c.querySelector('.tt').textContent = G.pick(['Parfait !', 'Bien joué !', 'Excellent !', 'Super !']); c.querySelector('.tsub').textContent = ''; c.querySelector('.tk').textContent = '';
      document.querySelectorAll('#touch .pulse').forEach((e) => e.classList.remove('pulse'));
      G.sfx('ok'); this.m.timeScale = 1; this.okT = 60; this.wait = 50;
    }
    next() {
      this.i++; this.fails = 0; this.hits = 0; const st = this.step, me = this.m.f[0], op = this.m.f[1];
      if (st.prep) st.prep(me);
      if (st.free) { op.minHp = 0; this.m.cpuOverride = null; this.card.classList.add('free'); }
      this.show(st);
    }
    /* adversaire scripté pendant les leçons */
    cpu(f, me) {
      const st = this.step, inp = G.input.empty(); if (!st) return inp;
      const d = Math.abs(me.x - f.x), to = me.x > f.x ? 'r' : 'l';
      if (st.block) { if (this.cool > 0) { this.cool--; return inp; } if (d > 115) inp[to] = true; else if (f.state !== 'atk' && f.neutral()) { inp.c = true; this.cool = 110; } return inp; }
      if ((st.near && d > 140) || d > 260) inp[to] = true;
      return inp;
    }
    update() {
      const m = this.m, me = m.f[0], op = m.f[1];
      if (this.okT > 0 && --this.okT === 0) this.card.classList.remove('ok');
      if (this.wait > 0) { if (--this.wait === 0) this.next(); return; }
      const st = this.step; if (!st || st.free) { if (st && st.free && this.card.classList.contains('in') && m.tick % 240 === 0) this.card.classList.add('fade'); return; }
      if (st.block) { // ralenti seulement quand il arme son coup
        const arming = op.state === 'atk' && op.mvo && op.t < op.mvo.su + 2;
        m.timeScale = arming ? 0.12 : 1;
        if (me.state === 'hit' && ++this.fails % 30 === 1) { this.card.querySelector('.tsub').textContent = 'Recule dès qu’il arme son coup'; }
        // reculer pendant son attaque et l'éviter compte aussi
        if (op.state === 'atk') { if (G.input.read().l || G.input.read().r && me.x > op.x) this.back = 1; if (me.state === 'hit') this.back = -1; this.seen = 1; }
        else if (this.seen) { if (this.back === 1) return this.ok(); this.seen = 0; this.back = 0; }
      } else m.timeScale = st.slow != null ? st.slow : 0.3;
      if (op.flash > (this.pf || 0)) this.hits = (this.hits || 0) + 1; this.pf = op.flash;
      if (st.done(me, op, this)) this.ok();
    }
    end() { this.card.hidden = true; this.card.className = 'tut'; document.querySelectorAll('#touch .pulse').forEach((e) => e.classList.remove('pulse')); }
  }
  G.Tutorial = Tutorial;
})();
