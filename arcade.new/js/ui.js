/* ARCADE — écrans, menus, déroulé du jeu, boucle principale */
(function () {
  const G = window.G, N = G.net, SH = G.shop, V = G.view, $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const app = $('#app'), cv = $('#cv'), ctx = cv.getContext('2d'), body = document.body;
  const DEMO = location.hash === '#demo';
  const LS = { onboarded: 'arcade-onboarded', bonus: 'arcade-tuto-bonus' };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} };
  let RS = 1, match = null, attract = null, cine = null, tut = null, paused = false, screen = 'title', T = 0, ready = false, timers = [];
  const S = { stage: 0, level: 1, ch: 0, opp: -1, mode: 'cpu', sess: null, host: false, lastGo: null, oppCh: 0, myRdy: false, hintT: 0 };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const isTouch = () => !!(window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
  const needAccount = () => N.backend === 'supabase' && !N.uid;

  /* ---------- mise en page : toujours en paysage ----------
     Sur téléphone tenu en portrait, tout le jeu (#app) pivote d'un quart de tour :
     il suffit de tourner le téléphone. Sur Android, on demande en plus le plein écran
     verrouillé en paysage dès le premier appui. */
  function layout() {
    let vw = window.innerWidth, vh = window.innerHeight;
    const rot = isTouch() && vh > vw;
    if (rot) { app.style.width = vh + 'px'; app.style.height = vw + 'px'; app.style.transform = 'translateX(' + vw + 'px) rotate(90deg)'; const t = vw; vw = vh; vh = t; }
    else { app.style.width = vw + 'px'; app.style.height = vh + 'px'; app.style.transform = ''; }
    G.input.rotated = rot; body.classList.toggle('rot', rot); body.classList.toggle('short', vh < 520);
    app.style.setProperty('--u', Math.min(vw / 100, (vh * 1.78) / 100) + 'px');
    const w = Math.min(vw, (vh * 16) / 9), h = (w * 9) / 16, x = (vw - w) / 2, y = (vh - h) / 2;
    cv.style.left = x + 'px'; cv.style.top = y + 'px'; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(Math.min(1920, Math.max(640, w * dpr)));
    if (cv.width !== cw) { cv.width = cw; cv.height = Math.round((cw * 9) / 16); }
    RS = cv.width / G.W;
    const hb = $('#hudbtn'); hb.style.left = x + w / 2 - 20 + 'px'; hb.style.top = y + h - 38 + 'px';
    $('#hint').style.top = y + h * 0.8 + 'px';
    if (DEMO) render();
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  function goLandscape() { // Android / Chrome : plein écran + verrouillage paysage (ignoré ailleurs)
    if (!isTouch() || document.fullscreenElement) return;
    try {
      const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).then(() => setTimeout(layout, 150)).catch(() => {});
    } catch (_) {}
  }

  function show(name) {
    screen = name;
    $$('.screen').forEach((s) => s.classList.toggle('on', s.dataset.s === name));
    body.classList.toggle('fight', name === 'fight');
    body.classList.toggle('cine', name === 'cine');
  }
  function menuMusic() { if (G.audio.started) G.music('menu'); }

  /* ---------- fond animé (deux IA qui s'affrontent derrière les menus) ---------- */
  function newAttract() {
    const a = G.pick(G.CHARS); let b = G.pick(G.CHARS); if (b === a) b = G.CHARS[(G.CHARS.indexOf(a) + 3) % G.CHARS.length];
    attract = new G.Match({ stage: G.pick(G.STAGES), chars: [a, b], weapons: [a.weapon, b.weapon], ctrl: ['cpu', 'cpu'], levels: [1, 1], attract: true, need: 1, onEnd() { later(newAttract, 400); } });
  }

  /* ---------- choix de l'arène ---------- */
  function buildSetup() {
    const box = $('#stageCards'); box.textContent = '';
    G.STAGES.forEach((def, i) => {
      const b = el('button', 'card' + (i === S.stage ? ' sel' : '')); const th = new G.Stage(def).thumb(288, 162);
      th.style.width = 'calc(var(--u)*22)'; th.style.height = 'calc(var(--u)*12.4)'; b.appendChild(th); b.appendChild(el('div', 'lbl', def.name));
      b.onclick = () => { S.stage = i; G.sfx('ui'); $$('#stageCards .card').forEach((c, k) => c.classList.toggle('sel', k === i)); };
      box.appendChild(b);
    });
    $$('#lvl button').forEach((b) => { b.onclick = () => { S.level = +b.dataset.l; G.sfx('ui'); $$('#lvl button').forEach((x) => x.classList.toggle('sel', x === b)); }; });
  }

  /* ---------- boutique et choix du ninja (même présentation) ---------- */
  function openShop() { show('show'); V.actLabel = null; V.open('shop', { onBack: goMenu }); }
  function openChar() {
    show('show'); S.myRdy = false;
    if (S.mode === 'cpu') {
      V.actLabel = 'Combattre';
      V.open('select', {
        title: 'Choisis ton ninja', sel: G.CHARS[S.ch].id,
        onBack: () => show('setup'),
        onAction: (id) => { S.ch = G.CHARS.findIndex((c) => c.id === id); G.sfx('ok'); startCpu(); },
        extra(box) {
          const row = el('div', 'chips'); row.append('Adversaire');
          const mk = (lbl, v) => { const b = el('button', v === S.opp ? 'sel' : '', lbl); b.onclick = () => { S.opp = v; G.sfx('ui'); [...row.querySelectorAll('button')].forEach((x) => x.classList.toggle('sel', x === b)); }; row.appendChild(b); };
          mk('Aléatoire', -1); G.CHARS.forEach((c, i) => mk(c.name, i)); box.appendChild(row);
        },
      });
    } else {
      V.actLabel = 'Prêt';
      V.open('select', {
        title: 'Choisis ton ninja', sel: G.CHARS[S.ch].id,
        onBack: () => openOnline(),
        onAction: (id) => {
          if (!S.sess) return; G.sfx('ok'); S.ch = G.CHARS.findIndex((c) => c.id === id); S.myRdy = true;
          S.sess.set({ ch: id, wp: SH.weaponOf(id), rdy: 1 }); const b = $('#scAct'); b.disabled = true; b.textContent = 'En attente de l’adversaire…';
        },
        extra(box) { box.appendChild(el('p', 'note', '')).id = 'oppNote'; },
      });
      S.sess.set({ rdy: 0, go: null, s: null, ch: null, wp: null, mid: null }); onlinePoll();
    }
  }

  /* ---------- lancement d'un combat ---------- */
  function vsScreen(a, b, na, nb, then, wa, wb) {
    show('vs'); G.sfx('gong');
    [['#vsL', a, na, wa], ['#vsR', b, nb, wb]].forEach((x, i) => {
      const box = $(x[0]); box.textContent = ''; const p = G.portrait(x[1], 300, 330, 1.42, true, G.weaponById(x[3]));
      p.style.width = 'calc(var(--u)*30)'; p.style.height = 'calc(var(--u)*33)'; if (i) p.style.transform = 'scaleX(-1)';
      box.appendChild(p); const n = el('div', 'jp nm', x[2]); n.style.color = x[1].col; box.appendChild(n); box.appendChild(el('div', 'sub', x[1].title));
    });
    S.vsThen = then; if (!DEMO) later(then, 2400);
  }
  function cpuFight() {
    const me = G.CHARS[S.ch], op = G.CHARS[S.oppCh], wa = SH.weaponOf(me.id), wb = op.weapon || null;
    vsScreen(me, op, me.name, op.name, () => fight({ stage: G.STAGES[S.stage], chars: [me, op], weapons: [wa, wb], ctrl: ['human', 'cpu'], level: S.level }, 0), wa, wb);
  }
  function startCpu() {
    let o = S.opp;
    if (o < 0) { do { o = (Math.random() * G.CHARS.length) | 0; } while (o === S.ch); }
    S.oppCh = o; N.profile.char = G.CHARS[S.ch].id; cpuFight();
  }
  function fight(opts, meIdx) {
    G.mute = false; paused = false;
    opts.onEnd = (w, M) => later(() => result(w === meIdx, M, meIdx), 500);
    match = new G.Match(opts); S.hintT = 60 * 14; $('#hint').style.opacity = 1; show('fight'); G.music('fight');
    return match;
  }
  function endMatch() {
    match = null; G.mute = true;
    if (tut) { tut.end(); tut = null; } body.classList.remove('tuto');
    if (!attract || attract.done) newAttract();
  }
  const pl = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
  function showGain(n, txt) { const g = $('#resGain'); if (!n) { g.hidden = true; return; } g.hidden = false; g.querySelector('span').textContent = txt || '+' + n + ' pièces'; }
  function resultButtons(mode) {
    const tutoMode = mode === 'tuto';
    $('#again').hidden = tutoMode; $('#resChar').hidden = tutoMode || mode !== 'cpu'; $('#resMenu').hidden = tutoMode; $('#resAccount').hidden = !tutoMode;
    $('#resAccount').textContent = needAccount() ? 'Créer mon compte pour continuer' : 'Continuer';
  }
  function result(won, M, meIdx) {
    const a = M.f[meIdx].ch, b = M.f[1 - meIdx].ch, w = M.wins, mode = S.mode;
    endMatch(); G.mute = false; G.sfx(won ? 'ok' : 'gong'); menuMusic();
    resultButtons(mode); showGain(0);
    const big = $('#resBig'), stat = $('#resStat'), draw = M.final < 0, secs = Math.min(9999, Math.round(M.tick / 60));
    if (mode === 'tuto') { // fin de la première partie guidée
      lsSet(LS.onboarded, '1'); N.log('tuto_end', { won: !!won, secs });
      big.textContent = won ? 'VICTOIRE' : 'BIEN ESSAYÉ'; big.className = 'jp big ' + (won ? 'win' : 'lose');
      $('#resSub').textContent = 'Ta première partie est terminée';
      if (needAccount()) { lsSet(LS.bonus, '1'); showGain(250, '250 pièces de bienvenue t’attendent'); stat.textContent = 'Crée ton compte pour les recevoir, débloquer des ninjas et des armes, et jouer en ligne.'; }
      else { SH.reward('tutorial').then((n) => showGain(n)); stat.textContent = 'Tes pièces de bienvenue sont dans ta bourse.'; }
      show('result'); return;
    }
    const mid = mode === 'online' ? S.mid : null, fair = !(M.net && M.net.taint);
    if (mode === 'cpu') N.log('cpu_end', { char: a.id, opp: b.id, stage: M.stage.def.id, level: S.level, won: !!won && M.final >= 0, secs });
    $('#again').hidden = false;
    if (draw) { // aucun vainqueur : rien n'est enregistré
      big.textContent = 'ÉGALITÉ'; big.className = 'jp big lose'; $('#resSub').textContent = a.name + ' et ' + b.name + ' se neutralisent';
      stat.textContent = 'Match nul : il ne compte pas.'; show('result'); return;
    }
    big.textContent = won ? 'VICTOIRE' : 'DÉFAITE'; big.className = 'jp big ' + (won ? 'win' : 'lose');
    $('#resSub').textContent = (won ? a.name + ' bat ' + b.name : b.name + ' bat ' + a.name) + ' — ' + Math.max(w[0], w[1]) + ' manche' + (Math.max(w[0], w[1]) > 1 ? 's' : '') + ' à ' + Math.min(w[0], w[1]);
    if (fair) SH.reward(mode === 'online' ? 'online' : 'cpu', won, S.level).then((n) => { if (screen === 'result') showGain(n); });
    const bilan = () => pl(N.profile.wins, 'victoire') + ' · ' + pl(N.profile.losses, 'défaite');
    if (N.sb && N.uid) {
      stat.textContent = mid ? 'Envoi du résultat au serveur…' : '';
      N.record(won, mid, fair).then((st) => {
        if (mid || mode === 'online') N.log('online_end', { char: a.id, opp: b.id, stage: M.stage.def.id, won: !!won, secs, status: st });
        if (screen !== 'result') return;
        stat.textContent = st === 'local' ? 'Contre l’ordinateur : ' + pl(N.local.wins, 'victoire') + ' · ' + pl(N.local.losses, 'défaite') + ' sur cet appareil. Seuls les matchs en ligne comptent au classement.'
          : st === 'done' ? 'Match classé. Ton bilan : ' + bilan() + '.'
          : st === 'playing' ? 'Résultat envoyé : il comptera dès que ton adversaire l’aura confirmé.'
          : st === 'disputed' ? (fair ? 'Match non classé : les deux résultats ne concordent pas.' : 'Match non classé : une incohérence a été détectée pendant le combat.')
          : st === 'capped' ? 'Match non classé : la limite est de 10 matchs classés par jour contre le même adversaire.'
          : 'Match amical : il ne compte pas au classement.';
      });
    } else { N.record(won); stat.textContent = 'Ton bilan : ' + bilan() + (N.cloud ? ' — enregistré dans le classement' : ' — enregistré sur cet appareil'); }
    show('result');
  }

  /* ---------- premier lancement : présentation puis partie guidée ---------- */
  function startCine(replay) {
    leaveSess(); if (match) endMatch();
    show('cine'); G.mute = false; G.music('fight');
    $('#cta').hidden = true; $('#skip').hidden = false; $('#cta').textContent = replay ? 'Retour au menu' : 'Lancer ta première partie';
    cine = new G.Cine({ onCta() { $('#skip').hidden = true; $('#cta').hidden = false; } });
    cine.replay = !!replay; N.log(replay ? 'cine_replay' : 'cine_start');
  }
  function endCine() { cine = null; G.caption(''); $('#cineCap').hidden = true; $('#cta').hidden = true; }
  function startTutorial() {
    endCine(); S.mode = 'tuto'; N.log('tuto_start');
    const a = G.charById('bakari'), b = G.charById('malik');
    const m = fight({ stage: G.STAGES[1], chars: [a, b], weapons: [null, null], ctrl: ['human', 'cpu'], level: 0, need: 1, noTimer: true }, 0);
    tut = new G.Tutorial(m); body.classList.add('tuto');
  }
  function afterOnboarding() { if (needAccount()) openAuth(true); else enter(); }

  /* ---------- en ligne ---------- */
  let pollId = null, roomsId = null;
  const stopPoll = () => { if (pollId) clearInterval(pollId); pollId = null; };
  function leaveSess() { stopPoll(); if (S.sess) { S.sess.leave(); S.sess = null; } N.announce(null); }
  function openOnline(msg) {
    leaveSess(); S.mode = 'online'; show('online'); $('#onHome').style.display = ''; $('#onWait').style.display = 'none';
    $('#onNote').textContent = msg || (N.mock
      ? 'Mode test : ici, le jeu en ligne relie deux onglets du même navigateur. Sur la page publiée, il relie les joueurs qui y ont accès.'
      : 'Crée un salon et donne le code à ton adversaire, ou rejoins un salon ouvert.');
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
    S.host = true; S.sess.set({ nick: N.profile.nick, host: 1, rdy: 0 }); N.announce(code); N.log('room_create');
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
  const safeWeapon = (id) => (typeof id === 'string' && G.WEAPONS.some((w) => w.id === id) ? id : null);
  function onlinePoll() {
    stopPoll();
    pollId = setInterval(() => {
      if (!S.sess || screen !== 'show') return stopPoll();
      const o = S.sess.opp();
      if (!o) { return openOnline('Ton adversaire a quitté le salon.'); }
      const nick = String(o.nick || 'NINJA').slice(0, 12), note = $('#oppNote');
      if (note) note.textContent = 'Adversaire : ' + nick + ' — ' + (o.rdy ? 'prêt' : 'choisit son ninja…');
      const oc = G.CHARS.findIndex((c) => c.id === o.ch), owp = safeWeapon(o.wp);
      if (S.host && S.myRdy && o.rdy && oc >= 0) {
        stopPoll(); const sess = S.sess, st = (Math.random() * G.STAGES.length) | 0; S.mid = null;
        N.createMatch().then((mid) => { if (S.sess !== sess) return; S.mid = mid; sess.set({ go: Date.now(), stage: st, mid: mid || null }); startOnline(st, oc, nick, owp); });
      } else if (!S.host && S.myRdy && o.go && o.go !== S.lastGo && oc >= 0) {
        S.lastGo = o.go; stopPoll(); S.mid = null;
        if (typeof o.mid === 'string') { const mid = o.mid; N.joinMatch(mid).then((ok) => { if (ok) S.mid = mid; }); }
        startOnline(G.clamp(o.stage | 0, 0, G.STAGES.length - 1), oc, nick, owp);
      }
    }, 250);
  }
  function startOnline(stage, oc, oppNick, oppWp) {
    const mine = G.CHARS[S.ch], theirs = G.CHARS[oc], me = S.host ? 0 : 1, myNick = N.profile.nick || 'NINJA', myWp = SH.weaponOf(mine.id);
    const chars = S.host ? [mine, theirs] : [theirs, mine], names = S.host ? [myNick, oppNick] : [oppNick, myNick], weapons = S.host ? [myWp, oppWp] : [oppWp, myWp];
    N.profile.char = mine.id;
    vsScreen(chars[0], chars[1], names[0], names[1], () => {
      if (!S.sess) return;
      const m = fight({ stage: G.STAGES[stage], chars, names, weapons, ctrl: S.host ? ['human', 'remote'] : ['remote', 'human'], net: new G.NetCtl(S.sess, S.host, me) }, me);
      m.o.onAbort = () => { endMatch(); openOnline('Ton adversaire s’est déconnecté. Le combat est annulé.'); };
      m.o.onCheat = () => { const mid = S.mid; endMatch(); if (mid) N.record(false, mid, false); openOnline('Une incohérence a été détectée chez ton adversaire : le match est annulé et ne compte pas.'); };
    }, weapons[0], weapons[1]);
  }

  /* ---------- classement ---------- */
  async function openBoard() {
    show('board'); const tb = $('#boardBody'); tb.textContent = ''; $('#boardNote').textContent = 'Chargement…';
    const rows = await N.board(); if (screen !== 'board') return;
    if (!rows) { $('#boardNote').textContent = 'Le classement est injoignable pour le moment.'; return; }
    rows.forEach((r, i) => { const tr = el('tr', r.me ? 'me' : ''); tr.append(el('td', '', i + 1), el('td', '', r.nick), el('td', 'n', r.wins), el('td', 'n', r.losses)); tb.appendChild(tr); });
    $('#boardNote').textContent = (N.cloud || N.sb) ? (rows.length ? (N.sb ? 'Les dix meilleurs ninjas. Seuls les matchs en ligne confirmés par les deux joueurs comptent.' : 'Les dix meilleurs ninjas.') : 'Aucun combat enregistré pour le moment.') : 'Hors connexion : seul ton profil apparaît ici.';
  }

  /* ---------- navigation ---------- */
  function goMenu() {
    if (needAccount()) return openAuth(true); // un compte est obligatoire après la première partie
    leaveSess(); if (match) endMatch(); G.mute = true; menuMusic();
    const w = $('#who'); w.textContent = '';
    const coins = el('span', 'coinline'); coins.append(el('i', 'coin'), document.createTextNode(String(SH.coins())));
    w.append(el('b', '', N.profile.nick || 'NINJA'), el('br'), coins, el('br'), el('span', '', (N.sb && N.uid ? 'Classé : ' : '') + N.profile.wins + ' V · ' + N.profile.losses + ' D'));
    if (N.sb && N.uid) N.refreshStats().then(() => { if (screen === 'menu' && w.lastChild) w.lastChild.textContent = 'Classé : ' + N.profile.wins + ' V · ' + N.profile.losses + ' D'; });
    const ab = $('#authBtn'); ab.style.display = N.backend === 'supabase' && N.uid ? '' : 'none'; ab.textContent = 'Se déconnecter';
    show('menu');
  }
  function openNick() {
    show('nick'); $('#nickIn').value = N.profile.nick || '';
    $('#nickNote').textContent = N.uid ? 'Ce nom apparaîtra dans le classement et en ligne.' : 'Ton profil est enregistré sur cet appareil.';
    if (!body.classList.contains('touch')) $('#nickIn').focus();
  }
  function enter() { if (N.profile.nick) goMenu(); else openNick(); }
  function openAuth(required) {
    show('auth'); $('#authMsg').textContent = ''; $('#authPw').value = '';
    $('#authTitle').textContent = required ? 'Crée ton compte ninja' : 'Ton compte ninja';
  }
  async function afterLogin() {
    await SH.load();
    if (lsGet(LS.bonus)) { const n = await SH.reward('tutorial'); lsSet(LS.bonus, null); if (n) G.sfx('ok'); }
    lsSet(LS.onboarded, '1');
  }
  async function doAuth(mode) {
    const btns = [$('#authIn'), $('#authUp')]; btns.forEach((b) => (b.disabled = true)); $('#authMsg').textContent = 'Connexion…';
    const r = await N.auth(mode, $('#authMail').value, $('#authPw').value);
    btns.forEach((b) => (b.disabled = false)); $('#authPw').value = '';
    if (r.ok) { G.sfx('ok'); await afterLogin(); enter(); } else $('#authMsg').textContent = r.msg;
  }
  function fromTitle() {
    if (!ready || screen !== 'title') return;
    G.startAudio(); goLandscape(); G.sfx('ok');
    if (!lsGet(LS.onboarded) && !N.uid) startCine(false);
    else if (needAccount()) { openAuth(true); menuMusic(); }
    else enter();
  }
  function togglePause() {
    if (screen === 'fight') { if (S.mode !== 'online') paused = true; show('pause'); }
    else if (screen === 'pause') { paused = false; show('fight'); if (tut) body.classList.add('tuto'); }
  }

  /* ---------- mise à jour disponible ---------- */
  const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  async function checkUpdate() {
    if (DEMO || location.protocol === 'file:') return;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      const v = await r.json();
      if (v && newer(v.version, G.VERSION)) $('#upd').hidden = false;
    } catch (_) {}
  }

  function bind() {
    G.bindShop();
    $('[data-s=title]').addEventListener('pointerdown', fromTitle);
    G.input.anyKeyCb = (e) => {
      if (screen === 'title') fromTitle();
      else if (screen === 'cine' && e.code === 'Escape' && cine) cine.skip();
      else if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
      else if (e.code === 'Enter' && screen === 'nick') $('#nickOk').click();
    };
    $('#nickIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nickOk').click(); });
    $('#nickOk').onclick = async () => { const b = $('#nickOk'); b.disabled = true; const r = await N.setNick($('#nickIn').value); b.disabled = false; if (r.ok) { G.sfx('ok'); goMenu(); } else $('#nickNote').textContent = r.msg; };
    $('#nickBtn').onclick = openNick;
    $('#authForm').addEventListener('submit', (e) => { e.preventDefault(); doAuth('in'); }); $('#authUp').onclick = () => doAuth('up');
    $('#authBtn').onclick = async () => { G.sfx('ui'); await N.signOut(); await SH.load(); openAuth(true); };
    $('#sndBtn').onclick = () => { G.audio.on = !G.audio.on; $('#sndBtn').textContent = 'Son : ' + (G.audio.on ? 'activé' : 'coupé'); if (G.audio.on) { G.sfx('ui'); menuMusic(); } else G.music(false); };
    $('#demoBtn').onclick = () => { G.sfx('ui'); startCine(true); };
    $$('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.go; G.startAudio(); G.sfx('ui');
      if (g === 'menu') goMenu(); else if (g === 'cpu') { S.mode = 'cpu'; show('setup'); } else if (g === 'online') openOnline(); else if (g === 'board') openBoard(); else if (g === 'help') show('help'); else if (g === 'shop') openShop();
    }));
    $('#setupOk').onclick = () => { G.sfx('ok'); openChar(); };
    $('#again').onclick = () => { G.sfx('ok'); if (S.mode === 'cpu') cpuFight(); else if (S.sess && S.sess.opp()) openChar(); else openOnline('Ton adversaire a quitté le salon.'); };
    $('#resChar').onclick = () => { G.sfx('ui'); openChar(); };
    $('#resAccount').onclick = () => { G.sfx('ok'); afterOnboarding(); };
    $('#mkRoom').onclick = makeRoom; $('#joinBtn').onclick = () => joinRoom($('#codeIn').value);
    $('#codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('#codeIn').value); });
    $('#onBack').onclick = () => { G.sfx('ui'); goMenu(); };
    $('#hudbtn').onclick = togglePause; $('#resume').onclick = togglePause;
    $('#quit').onclick = () => {
      paused = false;
      if (S.mode === 'online') { endMatch(); openOnline(); }
      else if (S.mode === 'tuto') { endMatch(); lsSet(LS.onboarded, '1'); if (needAccount()) lsSet(LS.bonus, '1'); afterOnboarding(); }
      else goMenu();
    };
    $('#skip').onclick = () => { G.sfx('ui'); if (cine) cine.skip(); };
    $('#cta').onclick = () => { G.sfx('ok'); const replay = cine && cine.replay; if (replay) { endCine(); goMenu(); } else startTutorial(); };
    $('#updBtn').onclick = () => location.reload();
    const setTouch = () => { body.classList.add('touch'); body.classList.remove('kb'); layout(); };
    window.addEventListener('touchstart', setTouch, { once: true, passive: true });
    if (isTouch()) setTouch();
    G.setupTouch($('#touch'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (screen === 'fight' && S.mode !== 'online') togglePause(); G.music(false); }
      else { checkUpdate(); if (/^(menu|title|auth|nick|setup|show|board|help|online|result)$/.test(screen)) menuMusic(); else if (screen === 'fight' || screen === 'cine') G.music('fight'); }
    });
  }

  /* ---------- boucle ---------- */
  function tick() {
    T++;
    if (match) {
      if (!paused) {
        match.tacc += match.timeScale; // ralenti du tutoriel
        let n = 0; while (match && match.tacc >= 1 && n < 3) { match.step(); if (match) match.tacc -= 1; n++; }
        if (tut) tut.update();
      }
      if (S.hintT > 0 && --S.hintT === 0) $('#hint').style.opacity = 0;
    } else if (cine && screen === 'cine') cine.step();
    else if (attract && /^(title|menu|auth|nick)$/.test(screen)) attract.step();
  }
  function render() {
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    if (cine && screen === 'cine') cine.draw(ctx);
    else { const m = match || attract; if (m) m.draw(ctx); else { ctx.fillStyle = '#0b0709'; ctx.fillRect(0, 0, G.W, G.H); } }
    if (screen === 'show') V.draw();
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
    buildSetup(); newAttract(); $('#hint').style.opacity = 1;
    if (!DEMO) requestAnimationFrame(frame);
    await N.init(); await SH.load();
    if (N.uid) lsSet(LS.onboarded, '1');
    N.log('visit');
    ready = true; $('#press').textContent = body.classList.contains('touch') ? 'TOUCHE L’ÉCRAN POUR COMMENCER' : 'APPUIE SUR UNE TOUCHE POUR COMMENCER';
    checkUpdate(); setInterval(checkUpdate, 10 * 60 * 1000);
  }
  /* pilotage image par image (enregistrement de la démo, tests) */
  window.__arcade = {
    S, show, goMenu, openChar, openShop, vsScreen, fight, startCine, startTutorial, fromTitle, layout, result,
    adv(n) { for (let i = 0; i < (n || 1); i++) tick(); render(); },
    get match() { return match; }, get screen() { return screen; }, get ready() { return ready; }, get cine() { return cine; }, get tut() { return tut; },
  };
  boot();
})();
