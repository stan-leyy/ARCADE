/* ARCADE — écrans, menus, déroulé du jeu, boucle principale */
(function () {
  const G = window.G, N = G.net, $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const cv = $('#cv'), ctx = cv.getContext('2d'), body = document.body;
  const DEMO = location.hash === '#demo';
  let RS = 1, match = null, attract = null, paused = false, screen = 'title', T = 0, ready = false, timers = [];
  const S = { stage: 0, level: 1, ch: 0, opp: -1, mode: 'cpu', sess: null, host: false, lastGo: null, oppCh: 0, myRdy: false, hintT: 0 };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  /* ---------- mise en page ---------- */
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight, portrait = vw / vh < 1;
    let w, h, x, y;
    if (!portrait) { w = Math.min(vw, vh * 16 / 9); h = w * 9 / 16; x = (vw - w) / 2; y = (vh - h) / 2; }
    else { w = vw; h = w * 9 / 16; x = 0; y = Math.max(0, Math.min(vh * 0.1, vh - h - 300)); }
    cv.style.left = x + 'px'; cv.style.top = y + 'px'; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(Math.min(1920, Math.max(640, w * dpr)));
    if (cv.width !== cw) { cv.width = cw; cv.height = Math.round(cw * 9 / 16); }
    RS = cv.width / G.W;
    const hb = $('#hudbtn'); hb.style.left = x + w / 2 - 20 + 'px'; hb.style.top = y + h - 38 + 'px';
    const hint = $('#hint'); hint.style.top = (portrait ? y + h + 8 : y + h * 0.8) + 'px';
    if (DEMO || !requestAnimationFrame) render();
  }
  window.addEventListener('resize', layout);

  function show(name) {
    screen = name;
    $$('.screen').forEach((s) => s.classList.toggle('on', s.dataset.s === name));
    body.classList.toggle('fight', name === 'fight');
  }

  /* ---------- fond animé (deux IA qui s'affrontent derrière les menus) ---------- */
  function newAttract() {
    const a = G.pick(G.CHARS); let b = G.pick(G.CHARS); if (b === a) b = G.CHARS[(G.CHARS.indexOf(a) + 3) % G.CHARS.length];
    attract = new G.Match({ stage: G.pick(G.STAGES), chars: [a, b], ctrl: ['cpu', 'cpu'], levels: [1, 1], attract: true, need: 1, onEnd() { later(newAttract, 400); } });
  }

  /* ---------- écrans de sélection ---------- */
  function buildSetup() {
    const box = $('#stageCards'); box.textContent = '';
    G.STAGES.forEach((def, i) => {
      const b = el('button', 'card' + (i === S.stage ? ' sel' : '')); const th = new G.Stage(def).thumb(288, 162);
      th.style.width = 'calc(var(--u)*25)'; th.style.height = 'calc(var(--u)*14.06)'; b.appendChild(th); b.appendChild(el('div', 'lbl', def.name));
      b.onclick = () => { S.stage = i; G.sfx('ui'); $$('#stageCards .card').forEach((c, k) => c.classList.toggle('sel', k === i)); };
      box.appendChild(b);
    });
    $$('#lvl button').forEach((b) => { b.onclick = () => { S.level = +b.dataset.l; G.sfx('ui'); $$('#lvl button').forEach((x) => x.classList.toggle('sel', x === b)); }; });
  }
  function buildChars() {
    const box = $('#charCards'); box.textContent = '';
    G.CHARS.forEach((ch, i) => {
      const b = el('button', 'card'); const p = G.portrait(ch, 120, 130, 1.3);
      p.style.width = 'calc(var(--u)*8.6)'; p.style.height = 'calc(var(--u)*9.3)'; b.style.background = 'linear-gradient(180deg,#3a2226,' + ch.col + '55)';
      b.appendChild(p); b.appendChild(el('div', 'tag', ch.role)); b.appendChild(el('div', 'lbl', ch.name));
      b.onclick = () => { selChar(i); G.sfx('ui'); };
      box.appendChild(b);
    });
  }
  function selChar(i) {
    S.ch = i; const ch = G.CHARS[i];
    $$('#charCards .card').forEach((c, k) => c.classList.toggle('sel', k === i));
    $('#cNm').textContent = ch.name; $('#cTt').textContent = ch.title;
    $('#sF').style.width = G.clamp((ch.power - 0.8) / 0.4, 0.15, 1) * 100 + '%';
    $('#sV').style.width = G.clamp((ch.speed - 0.8) / 0.36, 0.15, 1) * 100 + '%';
    $('#sH').style.width = G.clamp((ch.hp - 850) / 300, 0.15, 1) * 100 + '%';
    const t = $('#cTech'); t.textContent = '';
    const b1 = el('b', '', 'Spécial : '); t.append(b1, ch.spName, el('br')); t.append(el('b', '', 'Ultime : '), ch.suName.charAt(0) + ch.suName.slice(1).toLowerCase());
  }
  function openChar() {
    show('char'); selChar(S.ch);
    const row = $('#oppRow'); row.textContent = ''; $('#charOk').disabled = false;
    if (S.mode === 'cpu') {
      $('#charOk').textContent = 'Combattre'; $('#charNote').textContent = '';
      row.append('Adversaire : ');
      const mk = (lbl, v) => { const b = el('button', v === S.opp ? 'sel' : '', lbl); b.onclick = () => { S.opp = v; G.sfx('ui'); [...row.querySelectorAll('button')].forEach((x) => x.classList.toggle('sel', x === b)); }; row.appendChild(b); };
      mk('Aléatoire', -1); G.CHARS.forEach((c, i) => mk(c.name, i));
    } else { $('#charOk').textContent = 'Prêt'; S.myRdy = false; S.sess.set({ rdy: 0, go: null, s: null, ch: null }); onlinePoll(); }
  }
  function drawPrev() {
    const pc = $('#prev'), c = pc.getContext('2d'), ch = G.CHARS[S.ch];
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, pc.width, pc.height);
    const g = c.createRadialGradient(260, 560, 10, 260, 380, 330); g.addColorStop(0, ch.col + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 520, 600);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(260, 566, 130, 18, 0, 0, 7); c.fill();
    c.translate(250, 562); c.scale(2.35, 2.35);
    const p = G.poseClone(G.POSES[(ch.poses && ch.poses.idle) || 'idle']), br = Math.sin(T * 0.07);
    p.hy += br * 1.6 + 1.6; p.fh[1] += br * 1.2; p.bh[1] += br * 1.4;
    G.drawFighter(c, ch, p, T, {});
  }

  /* ---------- lancement d'un combat ---------- */
  function vsScreen(a, b, na, nb, then) {
    show('vs'); G.sfx('gong'); G.music(false);
    [['#vsL', a, na], ['#vsR', b, nb]].forEach((x, i) => {
      const box = $(x[0]); box.textContent = ''; const p = G.portrait(x[1], 300, 330, 1.42, true);
      p.style.width = 'calc(var(--u)*30)'; p.style.height = 'calc(var(--u)*33)'; if (i) p.style.transform = 'scaleX(-1)';
      box.appendChild(p); const n = el('div', 'jp nm', x[2]); n.style.color = x[1].col; box.appendChild(n); box.appendChild(el('div', 'sub', x[1].title));
    });
    S.vsThen = then; if (!DEMO) later(then, 2400);
  }
  function startCpu() {
    const me = G.CHARS[S.ch]; let o = S.opp;
    if (o < 0) { do { o = (Math.random() * G.CHARS.length) | 0; } while (o === S.ch); }
    S.oppCh = o; N.profile.char = me.id;
    vsScreen(me, G.CHARS[o], me.name, G.CHARS[o].name, () => fight({ stage: G.STAGES[S.stage], chars: [me, G.CHARS[o]], ctrl: ['human', 'cpu'], level: S.level }, 0));
  }
  function fight(opts, meIdx) {
    G.mute = false; paused = false;
    opts.onEnd = (w, M) => later(() => result(w === meIdx, M, meIdx), 500);
    match = new G.Match(opts); S.hintT = 60 * 14; show('fight'); G.music(true);
    return match;
  }
  function endMatch() { match = null; G.mute = true; G.music(false); if (!attract || attract.done) newAttract(); }
  function result(won, M, meIdx) {
    const a = M.f[meIdx].ch, b = M.f[1 - meIdx].ch, w = M.wins;
    endMatch(); G.mute = false; G.sfx(won ? 'ok' : 'gong');
    N.record(won);
    const big = $('#resBig'); big.textContent = won ? 'VICTOIRE' : 'DÉFAITE'; big.className = 'jp big ' + (won ? 'win' : 'lose');
    $('#resSub').textContent = (won ? a.name + ' bat ' + b.name : b.name + ' bat ' + a.name) + ' — ' + Math.max(w[0], w[1]) + ' manche' + (Math.max(w[0], w[1]) > 1 ? 's' : '') + ' à ' + Math.min(w[0], w[1]);
    $('#resStat').textContent = 'Ton bilan : ' + N.profile.wins + ' victoire' + (N.profile.wins > 1 ? 's' : '') + ' · ' + N.profile.losses + ' défaite' + (N.profile.losses > 1 ? 's' : '') + (N.cloud ? ' — enregistré dans le classement' : ' — enregistré sur cet appareil');
    $('#again').style.display = ''; $('#resChar').style.display = S.mode === 'cpu' ? '' : 'none';
    show('result');
  }

  /* ---------- en ligne ---------- */
  let pollId = null, roomsId = null;
  const stopPoll = () => { if (pollId) clearInterval(pollId); pollId = null; };
  function leaveSess() { stopPoll(); if (S.sess) { S.sess.leave(); S.sess = null; } N.announce(null); }
  function openOnline(msg) {
    leaveSess(); S.mode = 'online'; show('online'); $('#onHome').style.display = ''; $('#onWait').style.display = 'none';
    $('#onNote').textContent = msg || (N.mock
      ? 'Mode test : ici, le jeu en ligne relie deux onglets du même navigateur. Sur la page publiée, il relie les joueurs qui y ont accès.'
      : 'Crée un salon et donne le code à ton adversaire, ou rejoins un salon ouvert. Chaque joueur doit avoir accès à cette page.');
    N.announce(null); drawRooms(); if (roomsId) clearInterval(roomsId); roomsId = setInterval(() => { if (screen === 'online') drawRooms(); else { clearInterval(roomsId); roomsId = null; } }, 1000);
  }
  function drawRooms() {
    const box = $('#rooms'), rooms = N.openRooms(); box.textContent = '';
    if (!rooms.length) { box.appendChild(el('div', 'note', 'Aucun salon ouvert pour le moment.')); return; }
    rooms.slice(0, 5).forEach((r) => { const row = el('div', 'r'); row.appendChild(el('span', '', r.nick + ' · ' + r.code.toUpperCase())); const b = el('button', 'btn sm', 'Rejoindre'); b.onclick = () => joinRoom(r.code); row.appendChild(b); box.appendChild(row); });
  }
  async function makeRoom() {
    const code = N.newCode(); G.sfx('ok');
    try { S.sess = await N.join(code); } catch (_) { return openOnline('Impossible de créer un salon pour le moment. Réessaie dans un instant.'); }
    S.host = true; S.sess.set({ nick: N.profile.nick, host: 1, rdy: 0 }); N.announce(code);
    $('#onHome').style.display = 'none'; $('#onWait').style.display = ''; $('#codeOut').textContent = code.toUpperCase(); $('#waitNote').textContent = 'En attente d’un adversaire…';
    stopPoll(); pollId = setInterval(() => { if (S.sess && S.sess.opp()) { stopPoll(); N.announce(null); G.sfx('ok'); openChar(); } }, 300);
  }
  async function joinRoom(code) {
    code = String(code || '').trim().toLowerCase();
    if (!/^[a-z0-9]{4}$/.test(code)) { $('#onNote').textContent = 'Le code d’un salon fait 4 caractères.'; return; }
    leaveSess(); G.sfx('ui'); $('#onNote').textContent = 'Connexion au salon ' + code.toUpperCase() + '…';
    try { S.sess = await N.join(code); } catch (_) { return openOnline('Connexion impossible pour le moment. Réessaie dans un instant.'); }
    S.host = false; S.sess.set({ nick: N.profile.nick, host: 0, rdy: 0 });
    let n = 0; stopPoll();
    pollId = setInterval(() => {
      const o = S.sess && S.sess.opp();
      if (o && o.host) { stopPoll(); G.sfx('ok'); openChar(); }
      else if (++n > 22) { openOnline('Salon ' + code.toUpperCase() + ' introuvable. Vérifie le code avec ton adversaire.'); }
    }, 300);
  }
  function onlinePoll() {
    stopPoll();
    pollId = setInterval(() => {
      if (!S.sess || screen !== 'char') return stopPoll();
      const o = S.sess.opp();
      if (!o) { return openOnline('Ton adversaire a quitté le salon.'); }
      const nick = String(o.nick || 'NINJA').slice(0, 12);
      $('#charNote').textContent = 'Adversaire : ' + nick + ' — ' + (o.rdy ? 'prêt' : 'choisit son ninja…');
      const oc = G.CHARS.findIndex((c) => c.id === o.ch);
      if (S.host && S.myRdy && o.rdy && oc >= 0) { const go = Date.now(), st = (Math.random() * G.STAGES.length) | 0; S.sess.set({ go, stage: st }); stopPoll(); startOnline(st, oc, nick); }
      else if (!S.host && S.myRdy && o.go && o.go !== S.lastGo && oc >= 0) { S.lastGo = o.go; stopPoll(); startOnline(G.clamp(o.stage | 0, 0, G.STAGES.length - 1), oc, nick); }
    }, 250);
  }
  function startOnline(stage, oc, oppNick) {
    const mine = G.CHARS[S.ch], theirs = G.CHARS[oc], me = S.host ? 0 : 1, myNick = N.profile.nick || 'NINJA';
    const chars = S.host ? [mine, theirs] : [theirs, mine], names = S.host ? [myNick, oppNick] : [oppNick, myNick];
    N.profile.char = mine.id;
    vsScreen(chars[0], chars[1], names[0], names[1], () => {
      if (!S.sess) return;
      const m = fight({ stage: G.STAGES[stage], chars, names, ctrl: S.host ? ['human', 'remote'] : ['remote', 'human'], net: new G.NetCtl(S.sess, S.host, me) }, me);
      m.o.onAbort = () => { endMatch(); openOnline('Ton adversaire s’est déconnecté. Le combat est annulé.'); };
    });
  }

  /* ---------- classement ---------- */
  async function openBoard() {
    show('board'); const tb = $('#boardBody'); tb.textContent = ''; $('#boardNote').textContent = 'Chargement…';
    const rows = await N.board(); if (screen !== 'board') return;
    if (!rows) { $('#boardNote').textContent = 'Le classement est injoignable pour le moment.'; return; }
    rows.forEach((r, i) => { const tr = el('tr', r.me ? 'me' : ''); tr.append(el('td', '', i + 1), el('td', '', r.nick), el('td', 'n', r.wins), el('td', 'n', r.losses)); tb.appendChild(tr); });
    $('#boardNote').textContent = N.cloud ? (rows.length ? 'Les dix meilleurs ninjas de cette page.' : 'Aucun combat enregistré pour le moment.') : 'Hors connexion : seul ton profil apparaît ici. Le classement partagé fonctionne sur la page publiée.';
  }

  /* ---------- navigation ---------- */
  function goMenu() {
    leaveSess(); if (match) endMatch(); G.mute = true;
    const w = $('#who'); w.textContent = ''; w.append(el('b', '', N.profile.nick || 'NINJA'), el('br'), N.profile.wins + ' V · ' + N.profile.losses + ' D' + (N.cloud ? '' : ' · invité'));
    show('menu');
  }
  function openNick() {
    show('nick'); $('#nickIn').value = N.profile.nick || '';
    $('#nickNote').textContent = N.cloud ? 'Tu es connecté avec ton compte Claude : tes victoires seront enregistrées dans le classement.' : 'Mode invité : ton profil est enregistré sur cet appareil.';
    if (!body.classList.contains('touch')) $('#nickIn').focus();
  }
  function fromTitle() { if (!ready || screen !== 'title') return; G.startAudio(); G.sfx('ok'); if (N.profile.nick) goMenu(); else openNick(); }
  function togglePause() {
    if (screen === 'fight') { if (S.mode === 'cpu') paused = true; show('pause'); }
    else if (screen === 'pause') { paused = false; show('fight'); }
  }
  function bind() {
    $('[data-s=title]').addEventListener('pointerdown', fromTitle);
    G.input.anyKeyCb = (e) => { if (screen === 'title') fromTitle(); else if (e.code === 'Escape' || e.code === 'KeyP') togglePause(); else if (e.code === 'Enter' && screen === 'nick') $('#nickOk').click(); };
    $('#nickIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nickOk').click(); });
    $('#nickOk').onclick = () => { N.setNick($('#nickIn').value); G.sfx('ok'); goMenu(); };
    $('#nickBtn').onclick = openNick;
    $('#sndBtn').onclick = () => { G.audio.on = !G.audio.on; $('#sndBtn').textContent = 'Son : ' + (G.audio.on ? 'activé' : 'coupé'); G.sfx('ui'); };
    $$('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.go; G.startAudio(); G.sfx('ui');
      if (g === 'menu') goMenu(); else if (g === 'cpu') { S.mode = 'cpu'; show('setup'); } else if (g === 'online') openOnline(); else if (g === 'board') openBoard(); else if (g === 'help') show('help');
    }));
    $('#setupOk').onclick = () => { G.sfx('ok'); openChar(); };
    $('#charBack').onclick = () => { G.sfx('ui'); if (S.mode === 'cpu') show('setup'); else openOnline(); };
    $('#charOk').onclick = () => {
      G.sfx('ok');
      if (S.mode === 'cpu') startCpu();
      else if (S.sess) { S.myRdy = true; S.sess.set({ ch: G.CHARS[S.ch].id, rdy: 1 }); $('#charOk').disabled = true; $('#charOk').textContent = 'En attente…'; }
    };
    $('#again').onclick = () => { G.sfx('ok'); if (S.mode === 'cpu') vsScreen(G.CHARS[S.ch], G.CHARS[S.oppCh], G.CHARS[S.ch].name, G.CHARS[S.oppCh].name, () => fight({ stage: G.STAGES[S.stage], chars: [G.CHARS[S.ch], G.CHARS[S.oppCh]], ctrl: ['human', 'cpu'], level: S.level }, 0)); else if (S.sess && S.sess.opp()) openChar(); else openOnline('Ton adversaire a quitté le salon.'); };
    $('#resChar').onclick = () => { G.sfx('ui'); openChar(); };
    $('#mkRoom').onclick = makeRoom; $('#joinBtn').onclick = () => joinRoom($('#codeIn').value);
    $('#codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('#codeIn').value); });
    $('#onBack').onclick = () => { G.sfx('ui'); goMenu(); };
    $('#hudbtn').onclick = togglePause; $('#resume').onclick = togglePause;
    $('#quit').onclick = () => { paused = false; if (S.mode === 'online') { endMatch(); openOnline(); } else goMenu(); };
    const setTouch = () => { body.classList.add('touch'); body.classList.remove('kb'); };
    window.addEventListener('touchstart', setTouch, { once: true, passive: true });
    if (window.matchMedia && matchMedia('(pointer:coarse)').matches) setTouch();
    G.setupTouch($('#touch'));
    document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'fight' && S.mode === 'cpu') togglePause(); });
  }

  /* ---------- boucle ---------- */
  function tick() {
    T++;
    if (match) { if (!paused) match.step(); if (S.hintT > 0 && --S.hintT === 0) $('#hint').style.opacity = 0; }
    else if (attract && (screen === 'title' || screen === 'menu')) attract.step();
  }
  function render() {
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    const m = match || attract;
    if (m) m.draw(ctx); else { ctx.fillStyle = '#0b0709'; ctx.fillRect(0, 0, G.W, G.H); }
    if (screen === 'char') drawPrev();
  }
  let last = 0, acc = 0;
  function frame(ts) {
    if (!last) last = ts; acc += Math.min(100, ts - last); last = ts;
    let n = 0; while (acc >= 16.667 && n < 5) { tick(); acc -= 16.667; n++; }
    if (n) render();
    requestAnimationFrame(frame);
  }

  async function boot() {
    layout(); bind(); G.mute = true;
    try { await Promise.race([Promise.all([document.fonts.load('30px Shojumaru'), document.fonts.load('700 20px Oswald'), document.fonts.load('500 20px Oswald')]), new Promise((r) => setTimeout(r, 2500))]); } catch (_) {}
    buildSetup(); buildChars(); newAttract(); $('#hint').style.opacity = 1;
    if (!DEMO) requestAnimationFrame(frame);
    await N.init();
    ready = true; $('#press').textContent = body.classList.contains('touch') ? 'TOUCHE L’ÉCRAN POUR COMMENCER' : 'APPUIE SUR UNE TOUCHE POUR COMMENCER';
  }
  /* pilotage image par image (enregistrement de la démo, tests) */
  window.__arcade = {
    S, show, goMenu, openChar, selChar, vsScreen, fight, adv(n) { for (let i = 0; i < (n || 1); i++) tick(); render(); },
    get match() { return match; }, get screen() { return screen; }, get ready() { return ready; }, result, layout,
  };
  boot();
})();
