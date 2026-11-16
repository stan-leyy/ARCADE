/* ARCADE — boutique : pièces, ninjas et armes débloqués, écran de présentation (grille, socle lumineux, fiche)
   Les pièces sont gardées sur l'appareil tant que la version serveur (supabase/shop.sql) n'est pas activée
   dans js/config.js (shopServer: true). */
(function () {
  const G = window.G, N = G.net;
  const START = { coins: 300, chars: ['bakari', 'malik'], weapons: [], equip: {}, fav: 'bakari' };
  const REWARD = { tutorial: 250, cpuWin: [30, 45, 60], cpuLoss: 10, onlineWin: 100, onlineLoss: 30 };
  const MASTERY = { bakari: 0.35, malik: 0.55, devan: 0.7, sable: 0.8, braza: 0.5, tembo: 0.9 };
  const server = () => !!((window.ARCADE_CONFIG || {}).shopServer && N.sb && N.uid);
  const key = () => 'arcade-shop-' + (N.uid || 'local');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const known = (kind, id) => (kind === 'char' ? G.CHARS.some((c) => c.id === id) : G.WEAPONS.some((w) => w.id === id && !w.hidden));

  const shop = (G.shop = {
    st: clone(START),
    async load() {
      let st = null;
      if (server()) {
        try { const r = await N.sb.rpc('arcade_shop_state'); if (r && !r.error && r.data) st = r.data; } catch (_) {}
      } else {
        try { st = JSON.parse(localStorage.getItem(key()) || 'null'); } catch (_) {}
      }
      const s = Object.assign(clone(START), st || {});
      s.coins = Math.max(0, s.coins | 0);
      s.chars = (Array.isArray(s.chars) ? s.chars : []).filter((id) => known('char', id));
      for (const id of START.chars) if (!s.chars.includes(id)) s.chars.push(id);
      s.weapons = (Array.isArray(s.weapons) ? s.weapons : []).filter((id) => known('weapon', id));
      if (!s.equip || typeof s.equip !== 'object') s.equip = {};
      if (!s.chars.includes(s.fav)) s.fav = 'bakari';
      shop.st = s; return s;
    },
    save() { if (!server()) try { localStorage.setItem(key(), JSON.stringify(shop.st)); } catch (_) {} },
    coins() { return shop.st.coins; },
    hasChar(id) { return shop.st.chars.includes(id); },
    hasWeapon(id) { return shop.st.weapons.includes(id); },
    /* arme portée par un ninja : celle qu'il a équipée, sinon la sienne (Sable), sinon aucune */
    weaponOf(charId) { const w = shop.st.equip[charId]; if (w && shop.hasWeapon(w)) return w; return G.charById(charId).weapon || null; },
    async buy(kind, id) {
      const item = kind === 'char' ? G.charById(id) : G.weaponById(id);
      if (!item || !known(kind, id)) return { ok: false, msg: 'Objet inconnu.' };
      if (kind === 'char' ? shop.hasChar(id) : shop.hasWeapon(id)) return { ok: true };
      if (shop.st.coins < item.price) return { ok: false, msg: 'Il te manque ' + (item.price - shop.st.coins) + ' pièces. Gagne des combats pour en obtenir.' };
      if (server()) {
        try {
          const r = await N.sb.rpc('arcade_shop_buy', { p_kind: kind, p_id: id });
          if (!r || r.error) return { ok: false, msg: 'Achat impossible pour le moment.' };
          await shop.load(); return { ok: true };
        } catch (_) { return { ok: false, msg: 'Le serveur est injoignable.' }; }
      }
      shop.st.coins -= item.price; (kind === 'char' ? shop.st.chars : shop.st.weapons).push(id); shop.save();
      return { ok: true };
    },
    async equip(charId, weaponId) {
      if (weaponId && !shop.hasWeapon(weaponId)) return;
      if (server()) { try { await N.sb.rpc('arcade_shop_equip', { p_char: charId, p_weapon: weaponId || null }); } catch (_) {} }
      if (weaponId) shop.st.equip[charId] = weaponId; else delete shop.st.equip[charId];
      shop.save();
    },
    setFav(id) { if (shop.hasChar(id)) { shop.st.fav = id; shop.save(); } },
    /* pièces gagnées : renvoie le montant crédité */
    async reward(kind, won, level) {
      let n = 0;
      if (kind === 'tutorial') { if (shop.st.tutorial) return 0; n = REWARD.tutorial; shop.st.tutorial = 1; }
      else if (kind === 'cpu') n = won ? REWARD.cpuWin[G.clamp(level | 0, 0, 2)] : REWARD.cpuLoss;
      else if (kind === 'online') n = won ? REWARD.onlineWin : REWARD.onlineLoss;
      if (server()) {
        if (kind === 'online') { await shop.load(); return n; } // crédité par le serveur avec le résultat du match
        try { const r = await N.sb.rpc('arcade_shop_reward', { p_kind: kind, p_won: !!won, p_level: level | 0 }); if (r && !r.error) { await shop.load(); return r.data | 0; } } catch (_) {}
        return 0;
      }
      shop.st.coins += n; shop.save(); return n;
    },
  });

  /* ---------- Emblèmes (dessinés) ---------- */
  function emblem(c, id, col, s) {
    c.save(); c.scale(s, s); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.6; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, 38, 0, 7); c.globalAlpha = 0.35; c.stroke(); c.globalAlpha = 1;
    c.beginPath();
    if (id === 'bakari') { c.moveTo(6, -30); c.lineTo(-12, 2); c.lineTo(2, 2); c.lineTo(-6, 30); c.lineTo(14, -6); c.lineTo(0, -6); c.closePath(); c.stroke(); }
    else if (id === 'malik') { for (let i = 0; i < 3; i++) { c.moveTo(-26, -12 + i * 12); c.bezierCurveTo(-6, -22 + i * 12, 8, -2 + i * 12, 26, -12 + i * 12); } c.stroke(); }
    else if (id === 'devan') { for (let i = -2; i <= 2; i++) { c.save(); c.rotate(i * 0.42); c.moveTo(0, 18); c.quadraticCurveTo(-10, -4, 0, -26); c.quadraticCurveTo(10, -4, 0, 18); c.restore(); } c.stroke(); }
    else if (id === 'sable') { c.moveTo(-24, 22); c.lineTo(22, -24); c.moveTo(-22, -10); c.quadraticCurveTo(-4, 14, 20, 18); c.stroke(); c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill(); }
    else if (id === 'braza') { c.moveTo(0, 28); c.bezierCurveTo(-24, 20, -18, -6, -4, -28); c.bezierCurveTo(-2, -8, 10, -10, 8, -20); c.bezierCurveTo(24, -2, 22, 22, 0, 28); c.stroke(); }
    else if (id === 'tembo') { c.moveTo(-30, 20); c.lineTo(-10, -16); c.lineTo(0, -2); c.lineTo(10, -24); c.lineTo(30, 20); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(4, -14); c.lineTo(10, -24); c.lineTo(16, -12); c.stroke(); }
    else { c.arc(0, 0, 14, 0, 7); c.stroke(); }
    c.restore();
  }
  G.emblem = emblem;

  /* ---------- Écran de présentation ---------- */
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const SEQ = [['idle', 70], ['jabW', 6], ['jab', 16], ['idle', 30], ['kickW', 8], ['kick', 20], ['idle', 34], ['hvW', 10], ['hv', 22], ['idle', 60], ['win', 50]];
  const V = (G.view = {
    mode: 'shop', tab: 'chars', sel: 'bakari', wsel: 'lames', onAction: null, pose: null, vel: {}, t: 0, seqI: 0, seqT: 0, parts: [],
    open(mode, opts) {
      V.mode = mode; opts = opts || {};
      V.tab = mode === 'select' ? 'chars' : V.tab;
      V.sel = opts.sel || shop.st.fav || 'bakari';
      V.onAction = opts.onAction || null; V.onBack = opts.onBack || null; V.extra = opts.extra || null;
      $('#scTitle').textContent = mode === 'select' ? (opts.title || 'Choisis ton ninja') : 'Boutique';
      document.querySelectorAll('#show .sc-tabs button').forEach((b) => { b.hidden = mode === 'select'; b.classList.toggle('sel', b.dataset.tab === V.tab); });
      $('#scExtra').textContent = ''; if (V.extra) V.extra($('#scExtra'));
      V.grid(); V.info();
    },
    item() { return V.tab === 'chars' ? G.charById(V.sel) : G.weaponById(V.wsel); },
    grid() {
      const box = $('#scGrid'); box.textContent = ''; box.classList.toggle('w', V.tab === 'weapons');
      const list = V.tab === 'chars' ? G.CHARS : G.WEAPONS.filter((w) => !w.hidden);
      list.forEach((it) => {
        const own = V.tab === 'chars' ? shop.hasChar(it.id) : shop.hasWeapon(it.id);
        const b = el('button', 'tile' + (own ? '' : ' locked'));
        b.dataset.id = it.id; b.setAttribute('aria-label', it.name + (own ? '' : ', ' + it.price + ' pièces'));
        let cv;
        if (V.tab === 'chars') { cv = G.portrait(it, 120, 120, 1.55); b.style.setProperty('--tc', it.col); }
        else { cv = document.createElement('canvas'); cv.width = 240; cv.height = 240; const c = cv.getContext('2d'); c.scale(2, 2); G.drawWeapon(c, it, it.kind === 'glove' ? 58 : 34, it.kind === 'glove' ? 54 : 92, -48, it.id === 'silence' ? 0.68 : 0.82, 0); b.style.setProperty('--tc', it.glow || '#c9d4dc'); }
        b.appendChild(cv);
        if (!own) { const lk = el('span', 'lock'); lk.append(el('i', 'coin'), document.createTextNode(String(it.price))); b.appendChild(lk); }
        if (V.tab === 'weapons' && shop.weaponOf(V.sel) === it.id) b.appendChild(el('span', 'eq', 'Équipée'));
        b.onclick = () => { if (V.tab === 'chars') V.sel = it.id; else V.wsel = it.id; G.sfx('ui'); V.mark(); V.info(); V.seqI = 0; V.seqT = 0; };
        box.appendChild(b);
      });
      V.mark();
    },
    mark() { const id = V.tab === 'chars' ? V.sel : V.wsel; document.querySelectorAll('#scGrid .tile').forEach((t) => t.classList.toggle('sel', t.dataset.id === id)); },
    bars(rows) {
      const box = $('#scStats'); box.textContent = '';
      for (const [lbl, k, txt] of rows) { const r = el('div', 'bar'); r.append(el('span', '', lbl)); const tr = el('i'); const f = el('b'); tr.appendChild(f); r.appendChild(tr); if (txt) r.appendChild(el('em', '', txt)); box.appendChild(r); requestAnimationFrame(() => { f.style.width = G.clamp(k, 0.04, 1) * 100 + '%'; }); }
    },
    info() {
      const it = V.item(); if (!it) return;
      const act = $('#scAct'); $('#scMsg').textContent = ''; act.disabled = false;
      $('#coinN').textContent = shop.coins();
      const cv = $('#scEmb'), c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      if (V.tab === 'chars') {
        c.translate(60, 60); emblem(c, it.id, it.col, 1.25);
        $('#scName').textContent = it.name; $('#scSub').textContent = it.title + ' · ' + it.role; $('#scName').style.setProperty('--tc', it.col);
        V.bars([['Dégâts', (it.power - 0.85) / 0.35], ['Vitesse', (it.speed - 0.82) / 0.34], ['Vie', (it.hp - 880) / 260], ['Maîtrise', MASTERY[it.id] || 0.5]]);
        $('#scBio').textContent = it.bio || '';
        const tech = $('#scTech'); tech.textContent = ''; tech.append(el('b', '', 'Spécial '), it.spName, el('br'), el('b', '', 'Ultime '), it.suName.charAt(0) + it.suName.slice(1).toLowerCase());
        const wid = shop.weaponOf(it.id), w = G.weaponById(wid); if (w) tech.append(el('br'), el('b', '', 'Arme '), w.name);
        if (!shop.hasChar(it.id)) { act.textContent = 'Débloquer · ' + it.price + ' pièces'; act.dataset.do = 'buy'; }
        else if (V.mode === 'select') { act.textContent = V.actLabel || 'Combattre'; act.dataset.do = 'pick'; }
        else { act.textContent = shop.st.fav === it.id ? 'Ninja favori' : 'Choisir comme favori'; act.dataset.do = 'fav'; act.disabled = shop.st.fav === it.id; }
      } else {
        c.translate(60, 60); c.save(); c.strokeStyle = it.glow || '#c9d4dc'; c.globalAlpha = 0.35; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 46, 0, 7); c.stroke(); c.restore();
        G.drawWeapon(c, it, it.kind === 'glove' ? -4 : -22, it.kind === 'glove' ? -6 : 26, -50, 0.5, 0);
        $('#scName').textContent = it.name; $('#scSub').textContent = it.kind === 'glove' ? 'Protège-poings' : it.kind === 'twin' ? 'Lames doubles' : it.kind === 'kama' ? 'Faucille à chaîne' : 'Lame'; $('#scName').style.setProperty('--tc', it.glow || '#e8eef2');
        const bo = it.bonus, pct = (x) => (x > 0 ? '+' : '') + Math.round(x * 100) + ' %';
        V.bars([['Dégâts', bo.dmg / 0.15, pct(bo.dmg)], ['Portée', bo.reach / 48, '+' + bo.reach], ['Vitesse', (bo.spd + 0.06) / 0.14, pct(bo.spd)], ['Énergie', bo.en / 0.25, pct(bo.en)]]);
        $('#scBio').textContent = it.desc;
        const ch = G.charById(V.sel), tech = $('#scTech'); tech.textContent = ''; tech.append(el('b', '', 'Porté par '), ch.name);
        if (!shop.hasWeapon(it.id)) { act.textContent = 'Acheter · ' + it.price + ' pièces'; act.dataset.do = 'buy'; }
        else if (shop.weaponOf(V.sel) === it.id) { act.textContent = 'Retirer de ' + ch.name; act.dataset.do = 'unequip'; }
        else { act.textContent = 'Équiper sur ' + ch.name; act.dataset.do = 'equip'; }
      }
    },
    async act() {
      const it = V.item(), act = $('#scAct'), d = act.dataset.do; if (!it) return;
      if (d === 'buy') {
        act.disabled = true; const r = await shop.buy(V.tab === 'chars' ? 'char' : 'weapon', it.id); act.disabled = false;
        if (r.ok) { G.sfx('ok'); V.burst = 50; $('#scMsg').textContent = it.name + ' débloqué !'; if (V.tab === 'weapons' && shop.hasChar(V.sel)) await shop.equip(V.sel, it.id); V.grid(); V.info(); $('#scMsg').textContent = it.name + ' débloqué !'; }
        else { G.sfx('brk'); $('#scMsg').textContent = r.msg; }
      } else if (d === 'fav') { shop.setFav(it.id); G.sfx('ok'); V.info(); }
      else if (d === 'equip') { await shop.equip(V.sel, it.id); G.sfx('ok'); V.grid(); V.info(); }
      else if (d === 'unequip') { await shop.equip(V.sel, null); G.sfx('ui'); V.grid(); V.info(); }
      else if (d === 'pick' && V.onAction) { shop.setFav(it.id); V.onAction(it.id); }
    },
    tabTo(t) { V.tab = t; if (t === 'weapons' && !shop.hasChar(V.sel)) V.sel = shop.st.fav; document.querySelectorAll('#show .sc-tabs button').forEach((b) => b.classList.toggle('sel', b.dataset.tab === t)); G.sfx('ui'); V.grid(); V.info(); },
    /* socle lumineux + ninja animé, dessiné à chaque image */
    draw() {
      const cv = $('#scCv'); if (!cv) return; const c = cv.getContext('2d'), W = cv.width, H = cv.height;
      V.t++;
      const ch = G.charById(V.sel), wp = V.tab === 'weapons' ? G.weaponById(V.wsel) : G.weaponById(shop.weaponOf(ch.id));
      const col = V.tab === 'weapons' ? (wp && wp.glow) || '#9fe8ff' : ch.col;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
      // faisceau et halo
      const beam = c.createLinearGradient(0, 0, 0, H); beam.addColorStop(0, 'rgba(255,255,255,0)'); beam.addColorStop(0.75, hexA(col, 0.16)); beam.addColorStop(1, hexA(col, 0.02));
      c.fillStyle = beam; c.beginPath(); c.moveTo(W * 0.32, 0); c.lineTo(W * 0.68, 0); c.lineTo(W * 0.86, H * 0.86); c.lineTo(W * 0.14, H * 0.86); c.closePath(); c.fill();
      const cx = W / 2, cy = H * 0.86;
      let g = c.createRadialGradient(cx, cy, 10, cx, cy, W * 0.45); g.addColorStop(0, hexA(col, 0.55)); g.addColorStop(1, hexA(col, 0)); c.fillStyle = g; c.fillRect(0, cy - W * 0.3, W, W * 0.5);
      // socle
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.ellipse(0, 14, W * 0.33, 34, 0, 0, 7); c.fillStyle = '#0d1424'; c.fill();
      c.beginPath(); c.ellipse(0, 0, W * 0.33, 34, 0, 0, 7); g = c.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, '#e9f6ff'); g.addColorStop(1, '#9fb4c8'); c.fillStyle = g; c.fill();
      c.lineWidth = 6; c.strokeStyle = hexA(col, 0.9); c.shadowColor = col; c.shadowBlur = 24; c.stroke(); c.shadowBlur = 0;
      c.beginPath(); c.ellipse(0, 0, W * 0.22, 22, 0, 0, 7); c.lineWidth = 2; c.strokeStyle = hexA(col, 0.45); c.stroke();
      c.restore();
      // particules
      if (V.parts.length < 26) V.parts.push({ x: cx + (Math.random() - 0.5) * W * 0.6, y: cy, v: 0.4 + Math.random() * 1.2, l: 0 });
      for (const p of V.parts) { p.y -= p.v; p.l++; c.fillStyle = hexA(col, Math.max(0, 0.7 - p.l / 260)); c.fillRect(p.x, p.y, 2.4, 2.4); }
      V.parts = V.parts.filter((p) => p.l < 200);
      if (V.burst > 0) { V.burst--; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = col; c.lineWidth = 4 * (V.burst / 50); c.beginPath(); c.arc(cx, cy - 200, (50 - V.burst) * 7, 0, 7); c.stroke(); c.restore(); }
      // ninja (ou arme) qui enchaîne quelques mouvements
      const ps = ch.poses || {};
      if (++V.seqT > SEQ[V.seqI][1]) { V.seqT = 0; V.seqI = (V.seqI + 1) % SEQ.length; }
      const tgt = G.POSES[ps[SEQ[V.seqI][0]] || SEQ[V.seqI][0]];
      if (!V.pose || V.pch !== ch.id) { V.pose = G.poseClone(G.POSES[ps.idle || 'idle']); V.vel = {}; V.pch = ch.id; }
      G.poseSpring(V.pose, V.vel, tgt, SEQ[V.seqI][0].endsWith('W') ? 0.2 : SEQ[V.seqI][0] === 'idle' ? 0.08 : 0.42, 0.6);
      const p = G.poseClone(V.pose), br = Math.sin(V.t * 0.07); p.hy += br * 1.5; p.fh[1] += br; p.bh[1] += br * 1.2;
      const sc = H / 300;
      if (V.tab === 'weapons' && wp) { // arme en lévitation
        c.save(); c.globalAlpha = 0.95; const bob = Math.sin(V.t * 0.05) * 8;
        G.drawWeapon(c, wp, wp.kind === 'glove' ? W * 0.22 : W * 0.16, (wp.kind === 'glove' ? H * 0.2 : H * 0.36) + bob, -38, sc * (wp.id === 'silence' ? 0.95 : 1.15), V.t); c.restore();
      }
      c.save(); c.translate(cx + (V.tab === 'weapons' ? W * 0.12 : 0), cy - 4); const z = V.tab === 'weapons' ? sc * 0.78 : sc; c.scale(z, z);
      const locked = V.tab === 'chars' && !shop.hasChar(ch.id);
      G.drawFighter(c, ch, p, V.t, { weapon: wp || null, mono: locked ? 'rgba(10,14,26,.92)' : null });
      c.restore();
      if (locked) { c.save(); c.translate(cx, cy - 140 * sc); c.fillStyle = 'rgba(255,255,255,.85)'; c.font = (20 * sc) + 'px Oswald, sans-serif'; c.textAlign = 'center'; c.fillText('?', 0, 0); c.restore(); }
    },
  });
  function hexA(hex, a) { if (!/^#[0-9a-f]{6}$/i.test(hex)) return 'rgba(160,220,255,' + a + ')'; const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  G.hexA = hexA;

  document.addEventListener('DOMContentLoaded', () => {});
  G.bindShop = function () {
    $('#scAct').onclick = () => V.act();
    document.querySelectorAll('#show .sc-tabs button').forEach((b) => (b.onclick = () => V.tabTo(b.dataset.tab)));
    $('#scBack').onclick = () => { G.sfx('ui'); if (V.onBack) V.onBack(); };
  };
})();
