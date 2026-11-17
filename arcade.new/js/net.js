/* ARCADE — comptes joueurs, classement et jeu en ligne. Trois modes, choisis automatiquement :
   - Supabase (js/config.js rempli) : comptes e-mail, table « profiles », salons temps réel ;
   - page publiée sur claude.ai : base de données + salons de la plateforme ;
   - sinon (test local) : profil sur l'appareil + salons simulés entre onglets. */
(function () {
  const G = window.G;
  const cleanNick = (s) => String(s || '').normalize('NFD').replace(/[^A-Za-z0-9 _\-]/g, '').trim().slice(0, 12).toUpperCase();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const withTimeout = (p, ms, fb) => Promise.race([p, new Promise((r) => setTimeout(() => r(fb), ms))]);

  /* --- salons simulés (même navigateur) pour tester sans serveur --- */
  function mockRoom(name) {
    const me = Math.random().toString(36).slice(2, 10), peers = new Map(); let pres = {}, alive = true, bc = null, cache = null;
    try { bc = new BroadcastChannel('arcade-' + name); } catch (_) {}
    const send = (t) => { if (bc && alive) bc.postMessage({ t, peer: me, presence: pres }); };
    if (bc) bc.onmessage = (e) => { const d = e.data; if (!d || d.peer === me) return; if (d.t === 'bye') peers.delete(d.peer); else { const first = !peers.has(d.peer); peers.set(d.peer, { peer: d.peer, isMe: false, presence: d.presence, at: Date.now() }); if (first) send('p'); } cache = null; };
    const iv = setInterval(() => { send('p'); const now = Date.now(); for (const [k, v] of peers) if (now - v.at > 3500) { peers.delete(k); cache = null; } }, 900);
    send('p');
    return {
      name, presence(patch) { pres = Object.assign({}, pres, patch); for (const k in pres) if (pres[k] === null) delete pres[k]; send('p'); return Promise.resolve(); },
      peers() { return cache || (cache = [{ peer: me, isMe: true, presence: pres }].concat([...peers.values()])); },
      connected() { return !!bc; },
      leave() { send('bye'); alive = false; clearInterval(iv); if (bc) bc.close(); return Promise.resolve(); },
    };
  }

  /* --- salons Supabase : présence pour l'état lent, diffusion pour l'état de combat --- */
  function supaRoom(name) {
    const me = (N.uid ? N.uid.slice(0, 8) : 'g') + '-' + Math.random().toString(36).slice(2, 8);
    let pres = {}, lastS = {}, cache = null, sub = false, lastTrack = '';
    const low = () => { const o = {}; for (const k in pres) if (k !== 's') o[k] = pres[k]; return o; };
    const track = () => { const o = low(), j = JSON.stringify(o); if (!sub || j === lastTrack) return; lastTrack = j; ch.track(o).catch(() => {}); };
    const ch = N.sb.channel('arcade-' + name, { config: { presence: { key: me }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => { cache = null; })
      .on('broadcast', { event: 's' }, (m) => { const p = m && m.payload; if (p && typeof p.k === 'string') { lastS[p.k] = p.s || null; cache = null; } })
      .subscribe((st) => { if (st === 'SUBSCRIBED') { sub = true; track(); } else if (st === 'CLOSED' || st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') sub = false; });
    return {
      name,
      presence(patch) {
        pres = Object.assign({}, pres, patch); for (const k in pres) if (pres[k] === null) delete pres[k];
        if ('s' in patch && sub) ch.send({ type: 'broadcast', event: 's', payload: { k: me, s: patch.s } }).catch(() => {});
        track(); cache = null; return Promise.resolve();
      },
      peers() {
        if (cache) return cache;
        const st = ch.presenceState(), arr = [{ peer: me, isMe: true, presence: pres }];
        for (const k in st) { if (k === me || !st[k].length) continue; const p = Object.assign({}, st[k][st[k].length - 1]); if (lastS[k]) p.s = lastS[k]; arr.push({ peer: k, isMe: false, presence: p }); }
        return (cache = arr);
      },
      connected() { return sub; },
      leave() { return N.sb.removeChannel(ch); },
    };
  }
  /* --- journal d'activité : type d'appareil, sans donnée personnelle --- */
  function brandOf(os, model) {
    const m = String(model || '');
    if (os === 'iOS' || os === 'macOS') return 'Apple';
    const table = [[/^(SM-|GT-|Galaxy)/i, 'Samsung'], [/^Pixel/i, 'Google'], [/TECNO/i, 'Tecno'], [/Infinix/i, 'Infinix'], [/^itel/i, 'Itel'], [/(Redmi|POCO|Xiaomi|^Mi |^M2\d|^2\d{3}[0-9A-Z]{4,})/i, 'Xiaomi'], [/(HUAWEI|^(ANE|ELE|VOG|MAR|JNY|STK)-)/i, 'Huawei'], [/HONOR/i, 'Honor'], [/^RMX/i, 'Realme'], [/(OPPO|^CPH)/i, 'Oppo'], [/(vivo|^V\d{4})/i, 'Vivo'], [/OnePlus/i, 'OnePlus'], [/(moto|^XT\d)/i, 'Motorola'], [/Nokia/i, 'Nokia']];
    for (const [re, b] of table) if (re.test(m)) return b;
    return '';
  }
  async function deviceInfo() {
    const ua = navigator.userAgent || '', touch = (navigator.maxTouchPoints || 0) > 1;
    let os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? (touch ? 'iOS' : 'macOS') : /Linux/.test(ua) ? 'Linux' : 'Autre';
    const tablet = /iPad|Tablet/.test(ua) || (/Macintosh/.test(ua) && touch) || (/Android/.test(ua) && !/Mobi/.test(ua));
    const device = tablet ? 'tablet' : /Mobi|iPhone|Android/.test(ua) ? 'phone' : 'desktop';
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Autre';
    let model = '';
    try { if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) { const h = await navigator.userAgentData.getHighEntropyValues(['model']); model = h.model || ''; } } catch (_) {}
    if (!model) { const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\)|;)/); if (m && m[1].trim() !== 'K') model = m[1].trim(); }
    if (!model && os === 'iOS') model = /iPad/.test(ua) || tablet ? 'iPad' : 'iPhone';
    return { device, os, browser, brand: brandOf(os, model), model };
  }
  function visitorId() {
    try {
      let v = localStorage.getItem('arcade-visitor');
      if (!UUID.test(v || '')) { v = crypto.randomUUID(); localStorage.setItem('arcade-visitor', v); }
      return v;
    } catch (_) { return null; }
  }

  function loadScript(src) { return new Promise((res, rej) => { const e = document.createElement('script'); e.src = src; e.onload = res; e.onerror = rej; document.head.appendChild(e); }); }

  const N = (G.net = {
    sb: null, backend: 'local', netEvery: 2, local: { wins: 0, losses: 0 },
    db: null, user: null, room: null, uid: null, cloud: false, mock: false, lobby: null,
    profile: { nick: '', wins: 0, losses: 0, char: 'bakari' },
    async init() {
      let cl = null;
      for (let i = 0; i < 12 && !cl; i++) { if (window.claude && typeof window.claude.use === 'function') cl = window.claude; else await new Promise((r) => setTimeout(r, 150)); }
      if (cl) {
        try {
          const [db, user, room] = await withTimeout(Promise.all([cl.use('db'), cl.use('user'), cl.use('room')]), 11000, [null, null, null]);
          N.db = db; N.user = user; N.room = room;
          if (user) N.uid = await withTimeout(user.id(), 5000, null);
        } catch (_) {}
      }
      N.cloud = !!(N.db && N.uid);
      if (N.cloud || N.room) N.backend = 'claude';
      const cfg = window.ARCADE_CONFIG || {};
      if (N.backend === 'local' && cfg.supabaseUrl && cfg.supabaseKey) {
        try {
          if (!window.supabase) await withTimeout(loadScript('js/vendor/supabase.js'), 9000, null);
          N.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { realtime: { params: { eventsPerSecond: 20 } } });
          N.backend = 'supabase'; N.netEvery = 5;
          const r = await withTimeout(N.sb.auth.getSession(), 8000, null);
          if (r && r.data && r.data.session) N.uid = r.data.session.user.id;
        } catch (_) { N.sb = null; N.backend = 'local'; N.sbFailed = true; }
      }
      if (N.room) N.lobby = N.room; else if (N.sb) N.lobby = supaRoom('lobby'); else { N.mock = true; N.lobby = mockRoom('lobby'); }
      await N.loadProfile();
    },
    async loadProfile() {
      N.profile = { nick: '', wins: 0, losses: 0, char: 'bakari' };
      try { const l = JSON.parse(localStorage.getItem('arcade-local') || 'null'); if (l) N.local = { wins: +l.wins || 0, losses: +l.losses || 0 }; } catch (_) {}
      try {
        if (N.backend === 'claude' && N.cloud) { const s = await withTimeout(N.db.doc('players/' + N.uid).get(), 8000, null); if (s && s.exists) Object.assign(N.profile, s.data()); }
        else if (N.sb && N.uid) { N.cloud = true; const r = await withTimeout(N.sb.from('profiles').select('nick,wins,losses,char').eq('id', N.uid).maybeSingle(), 8000, null); if (r && r.data) Object.assign(N.profile, r.data); }
        else { N.cloud = false; const raw = localStorage.getItem('arcade-profile'); if (raw) Object.assign(N.profile, JSON.parse(raw)); }
      } catch (_) {}
      N.profile.nick = cleanNick(N.profile.nick); N.profile.wins = +N.profile.wins || 0; N.profile.losses = +N.profile.losses || 0;
    },
    /* Journal d'activité anonyme (visites, parties, tentatives de connexion). N'échoue jamais. */
    dev: null, visitor: null,
    async log(kind, data) {
      if (!N.sb) return;
      try {
        if (!N.visitor) N.visitor = visitorId();
        if (!N.visitor) return;
        if (!N.dev) N.dev = await deviceInfo();
        await N.sb.rpc('arcade_log_event', { p_visitor: N.visitor, p_kind: kind, p_device: N.dev, p_data: data || {} });
      } catch (_) {}
    },
    /* comptes (Supabase) : le mot de passe part directement chez Supabase, jamais ailleurs */
    async auth(mode, email, password) {
      if (!N.sb) return { ok: false, msg: 'La base de données n’est pas configurée.' };
      email = String(email || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, msg: 'Entre une adresse e-mail valide.' };
      if (String(password || '').length < 8) return { ok: false, msg: 'Le mot de passe doit faire au moins 8 caractères.' };
      try {
        const r = mode === 'up' ? await N.sb.auth.signUp({ email, password }) : await N.sb.auth.signInWithPassword({ email, password });
        if (r.error) { const m = String(r.error.message || ''); if (mode !== 'up') N.log('login_failed'); return { ok: false, msg: /invalid login/i.test(m) ? 'E-mail ou mot de passe inconnu. Première fois ici ? Clique sur « Créer un compte ».' : /already registered/i.test(m) ? 'Un compte existe déjà avec cet e-mail : connecte-toi.' : /not confirmed/i.test(m) ? 'Confirme d’abord ton adresse avec l’e-mail reçu.' : 'Connexion refusée : ' + m }; }
        if (mode === 'up' && r.data && r.data.user && Array.isArray(r.data.user.identities) && !r.data.user.identities.length) return { ok: false, msg: 'Un compte existe déjà avec cet e-mail : clique sur « J’ai déjà un compte : me connecter ».' };
        if (!r.data || !r.data.session) { N.log('signup'); return { ok: false, msg: 'Compte créé. Confirme ton adresse avec l’e-mail reçu, puis connecte-toi.' }; }
        N.uid = r.data.session.user.id; N.log(mode === 'up' ? 'signup' : 'login'); await N.loadProfile(); return { ok: true };
      } catch (_) { return { ok: false, msg: 'Le serveur est injoignable. Vérifie ta connexion et réessaie.' }; }
    },
    async signOut() { try { if (N.sb) await N.sb.auth.signOut(); } catch (_) {} N.uid = null; await N.loadProfile(); },
    saving: Promise.resolve(),
    /* Enregistre le profil. Avec Supabase, seuls le pseudo et le ninja partent au serveur :
       les victoires ne sont jamais écrites par le jeu, c'est le serveur qui les compte. */
    save() {
      const p = { nick: N.profile.nick, wins: N.profile.wins, losses: N.profile.losses, char: N.profile.char, at: Date.now() };
      if (N.sb && N.uid) {
        N.saving = N.saving.then(() => N.sb.rpc('arcade_set_profile', { p_nick: p.nick || 'NINJA', p_char: p.char })).then((r) => {
          const m = r && r.error ? String(r.error.message || 'x') : '';
          if (!m) return { ok: true };
          return { ok: false, msg: /nick_taken/.test(m) ? 'Ce pseudo est déjà pris : choisis-en un autre.' : /bad_nick/.test(m) ? 'Pseudo invalide : lettres sans accent, chiffres, espace ou tiret, 12 caractères au plus.' : 'Enregistrement impossible pour le moment.' };
        }).catch(() => ({ ok: false, msg: 'Le serveur est injoignable. Réessaie dans un instant.' }));
        return N.saving;
      }
      if (N.cloud) N.saving = N.saving.then(() => N.db.doc('players/' + N.uid).set(p)).catch(() => { N.saveFailed = true; });
      else try { localStorage.setItem('arcade-profile', JSON.stringify(p)); } catch (_) {}
      return N.saving.then(() => ({ ok: true }));
    },
    async setNick(n) {
      const prev = N.profile.nick; N.profile.nick = cleanNick(n) || 'NINJA';
      const r = await N.save(); if (!r.ok) N.profile.nick = prev; return r;
    },
    async refreshStats() {
      if (!(N.sb && N.uid)) return;
      try { const r = await withTimeout(N.sb.from('profiles').select('wins,losses').eq('id', N.uid).maybeSingle(), 8000, null); if (r && r.data) { N.profile.wins = +r.data.wins || 0; N.profile.losses = +r.data.losses || 0; } } catch (_) {}
    },
    /* Fin de combat. Renvoie 'local' (compté sur l'appareil) ou l'état du match classé :
       'done', 'playing' (en attente de l'adversaire), 'disputed', 'capped', 'expired', 'open', 'error'. */
    async record(win, mid, fair) {
      if (N.sb && N.uid) {
        if (!mid) { N.local[win ? 'wins' : 'losses']++; try { localStorage.setItem('arcade-local', JSON.stringify(N.local)); } catch (_) {} return 'local'; }
        let st = 'error';
        try { const r = await withTimeout(N.sb.rpc('arcade_report_match', { p_match: mid, p_i_won: !!win, p_fair: fair !== false }), 8000, null); if (r && !r.error && typeof r.data === 'string') st = r.data; } catch (_) {}
        await N.refreshStats(); return st;
      }
      if (win) N.profile.wins++; else N.profile.losses++;
      N.save(); return 'local';
    },
    /* Matchs classés : l'hôte ouvre le match côté serveur, l'invité le rejoint. */
    async createMatch() {
      if (!(N.sb && N.uid)) return null;
      try { const r = await withTimeout(N.sb.rpc('arcade_create_match'), 6000, null); return r && !r.error && UUID.test(r.data) ? r.data : null; } catch (_) { return null; }
    },
    async joinMatch(id) {
      if (!(N.sb && N.uid) || !UUID.test(String(id))) return false;
      try { const r = await withTimeout(N.sb.rpc('arcade_join_match', { p_match: id }), 6000, null); return !!(r && !r.error); } catch (_) { return false; }
    },
    async board() {
      if (N.sb) {
        try { const r = await withTimeout(N.sb.from('profiles').select('id,nick,wins,losses').order('wins', { ascending: false }).limit(10), 8000, null); if (r && r.data) return r.data.map((v) => ({ id: v.id, nick: cleanNick(v.nick) || 'NINJA', wins: +v.wins || 0, losses: +v.losses || 0, me: v.id === N.uid })); } catch (_) {}
        return null;
      }
      if (N.cloud) {
        try { const q = await withTimeout(N.db.collection('players').orderBy('wins', 'desc').limit(10).get(), 8000, null); if (q) return q.docs.map((d) => { const v = d.data() || {}; return { id: d.id, nick: cleanNick(v.nick) || 'NINJA', wins: +v.wins || 0, losses: +v.losses || 0, me: d.id === N.uid }; }); } catch (_) {}
        return null;
      }
      return [{ nick: N.profile.nick || 'NINJA', wins: N.profile.wins, losses: N.profile.losses, me: true }];
    },
    /* salons ouverts visibles dans le hall */
    openRooms() {
      const out = []; if (!N.lobby) return out;
      for (const p of N.lobby.peers()) { const pr = p.presence || {}; if (!p.isMe && typeof pr.open === 'string' && /^[a-z0-9]{4}$/.test(pr.open)) out.push({ code: pr.open, nick: cleanNick(pr.nick) || 'NINJA' }); }
      return out;
    },
    announce(code) { if (N.lobby) N.lobby.presence({ nick: N.profile.nick, open: code || null }).catch(() => {}); },
    async join(code) {
      const name = 'ark-' + code.toLowerCase();
      const nr = N.room ? await N.room.join(name) : N.sb ? supaRoom(name) : mockRoom(name);
      return new Session(nr);
    },
    newCode() { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[(Math.random() * A.length) | 0]; return s; },
  });

  class Session {
    constructor(nr) { this.nr = nr; this.mine = {}; }
    set(patch) { Object.assign(this.mine, patch); const p = this.nr.presence(patch); if (p && p.catch) p.catch(() => {}); }
    others() { return this.nr.peers().filter((p) => !p.isMe && p.presence && p.presence.nick); }
    opp() { const o = this.others()[0]; return o ? o.presence : null; }
    oppPeer() { const o = this.others()[0]; return o ? o.peer : null; }
    myPeer() { const m = this.nr.peers().find((p) => p.isMe); return m ? m.peer : ''; }
    leave() { try { const p = this.nr.leave(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
  }

  /* Synchronisation d'un match : chacun simule son combattant et publie son état ;
     les coups sont validés par celui qui les reçoit ; l'hôte arbitre les manches. */
  G.NetCtl = class {
    constructor(sess, host, me) { this.sess = sess; this.host = host; this.me = me; this.out = []; this.hid = 0; this.ack = 0; this.seq = 0; this.last = -1; this.snap = null; this.gone = 0; this.sfSeen = -1; this.taint = null; this.now = 0; this.hitTicks = []; }
    /* Incohérence détectée chez l'adversaire : le match ne sera pas classé. */
    flag(why) { if (!this.taint) this.taint = why; }
    sendHit(h, dir) {
      this.out.push({ at: this.now, i: ++this.hid, d: Math.round(h.dmg), hs: h.hs || 0, bs: h.bs || 0, kb: h.kb || 0, la: h.launch ? 1 : 0, ly: h.ly || 0, lk: h.lock || 0, g: h.guard || 0, fx: h.fix ? 1 : 0, dr: dir, sf: h.sfx === 'heavy' ? 1 : 0 });
      if (this.out.length > 10) this.out.shift();
    }
    pre(M) {
      if (this.taint && !M.done && M.o.onCheat) { M.done = true; M.o.onCheat(this.taint); return; }
      const o = this.sess.opp(), s = o && o.s;
      if (!s) { if (++this.gone > 300 && !M.done && M.o.onAbort) { M.done = true; M.o.onAbort(); } return; }
      this.gone = 0; this.snap = s; this.now = M.tick;
      const me = M.f[this.me], rem = M.f[1 - this.me];
      if (Array.isArray(s.h)) for (const h of s.h) {
        if (!h || !(h.i > this.ack)) continue; this.ack = h.i;
        this.hitTicks.push(M.tick); while (M.tick - this.hitTicks[0] > 60) this.hitTicks.shift();
        if (this.hitTicks.length > 18) { this.flag('rate'); continue; } // plus de coups que le jeu ne le permet
        const spec = { dmg: G.clamp(+h.d || 0, 0, 160), hs: G.clamp(+h.hs || 0, 0, 80), bs: G.clamp(+h.bs || 0, 0, 30), kb: G.clamp(+h.kb || 0, 0, 12), launch: !!h.la, ly: G.clamp(+h.ly || 0, 0, 13), lock: G.clamp(+h.lk || 0, 0, 80), guard: +h.g || 0, fix: !!h.fx, sfx: h.sf ? 'heavy' : 'hit' };
        const r = me.takeHit(spec, h.dr > 0 ? 1 : -1, M);
        if (r) M.hitFx(rem, me, spec, r, me.x - (h.dr > 0 ? 1 : -1) * 16, G.GROUND + me.y - 110);
      }
      if (typeof s.a === 'number') this.out = this.out.filter((h) => h.i > s.a);
      if (this.out.length && M.phase === 'fight' && M.tick - this.out[0].at > 420) this.flag('ignore'); // mes coups ne sont jamais pris en compte
      if (!this.host && s.m) {
        const m = s.m;
        if (m.ph === 'ko' && M.phase === 'fight' && m.wn === 1 - this.me) { // l'arbitre me déclare battu : je vérifie
          const lost = me.hp <= 0 || (m.tu && M.timer <= 2 && me.hp / me.ch.hp <= rem.hp / rem.ch.hp + 0.03);
          if (!lost) this.flag('ref');
        }
        if ((m.w[1 - this.me] | 0) > M.wins[1 - this.me] + 1) this.flag('score');
        if (m.ph !== M.phase || m.rd !== M.round) { M.round = m.rd | 0; M.wins = [m.w[0] | 0, m.w[1] | 0]; M.winner = m.wn; M.timeUp = !!m.tu; M.setPhase(m.ph); }
        M.timer = m.tm | 0; M.wins = [m.w[0] | 0, m.w[1] | 0];
      }
    }
    remoteStep(f, M) {
      const s = this.snap; if (!s) return;
      f.x += (s.x - f.x) * 0.5; f.y = s.y; f.vx = s.vx; f.vy = s.vy; f.face = s.f > 0 ? 1 : -1;
      if (s.q !== this.last) {
        this.last = s.q;
        const mv = s.mv && f.moves[s.mv] ? s.mv : null;
        if (s.st !== f.state || mv !== f.mv || s.t < f.t || s.t > f.t + 10) { f.state = s.st; f.mv = mv; f.mvo = mv ? f.moves[mv] : null; if (f.state === 'atk' && !mv) f.state = 'idle'; f.t = s.t | 0; }
        const nh = G.clamp(+s.hp || 0, 0, f.ch.hp);
        if (M.phase === 'fight' && M.pt > 40 && nh > f.hp + 2) this.flag('heal'); // la vie ne remonte jamais pendant une manche
        f.ph = s.ph | 0; f.hp = nh; f.en = +s.en || 0; f.sup = +s.sp || 0; f.combo = s.cb | 0; f.holdBack = !!s.hb; f.holdDown = !!s.hd; f.inv = s.iv | 0; f.hitPose = s.h2 | 0; f.dashF = !!s.df;
        if (f.state === 'atk' && f.mvo && f.mvo.sup && f.t < 12 && this.sfSeen !== s.mi) { this.sfSeen = s.mi; M.superFlash(f); }
        const mine = M.projs.filter((p) => !p.rem);
        const theirs = Array.isArray(s.pr) ? s.pr.slice(0, 3).map((p) => ({ o: f.idx, type: p[0], x: +p[1], y: +p[2], vx: +p[3], life: 99, r: +p[4] || 20, col: f.ch.col, col2: f.ch.col2, t: p[5] | 0, rem: true, h: {} })) : [];
        M.projs = mine.concat(theirs);
      } else f.t++;
      if (f.red > f.hp) f.red -= Math.max(1.5, (f.red - f.hp) * 0.04);
      if (f.flash > 0) f.flash--;
    }
    post(M) {
      if (M.tick % (G.net.netEvery || 2)) return;
      const f = M.f[this.me], r = Math.round;
      const s = { q: ++this.seq, x: r(f.x), y: r(f.y), vx: r(f.vx * 10) / 10, vy: r(f.vy * 10) / 10, f: f.face, st: f.state, mv: f.mv, t: f.t, ph: f.ph, hp: r(f.hp), en: r(f.en), sp: r(f.sup), cb: f.combo, hb: f.holdBack ? 1 : 0, hd: f.holdDown ? 1 : 0, iv: f.inv, mi: f.mi || 0, h2: f.hitPose, df: f.dashF ? 1 : 0,
        pr: M.projs.filter((p) => !p.rem && p.o === this.me).map((p) => [p.type, r(p.x), p.y, p.vx, p.r, p.t]), h: this.out, a: this.ack };
      if (this.host) s.m = { ph: M.phase, rd: M.round, w: M.wins, wn: M.winner, tm: M.timer, tu: M.timeUp ? 1 : 0 };
      this.sess.set({ s });
    }
  };
})();
