/* ARCADE — comptes joueurs, classement et jeu en ligne.
   Sur claude.ai : base de données + salons temps réel de la plateforme.
   Ailleurs (test local) : profil sur l'appareil + salons simulés entre onglets. */
(function () {
  const G = window.G;
  const cleanNick = (s) => String(s || '').replace(/[^\p{L}\p{N} _\-]/gu, '').trim().slice(0, 12).toUpperCase();
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

  const N = (G.net = {
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
      if (N.room) N.lobby = N.room; else { N.mock = true; N.lobby = mockRoom('lobby'); }
      try {
        if (N.cloud) { const s = await withTimeout(N.db.doc('players/' + N.uid).get(), 8000, null); if (s && s.exists) Object.assign(N.profile, s.data()); }
        else { const raw = localStorage.getItem('arcade-profile'); if (raw) Object.assign(N.profile, JSON.parse(raw)); }
      } catch (_) {}
      N.profile.nick = cleanNick(N.profile.nick); N.profile.wins = +N.profile.wins || 0; N.profile.losses = +N.profile.losses || 0;
    },
    saving: Promise.resolve(),
    save() {
      const p = { nick: N.profile.nick, wins: N.profile.wins, losses: N.profile.losses, char: N.profile.char, at: Date.now() };
      if (N.cloud) N.saving = N.saving.then(() => N.db.doc('players/' + N.uid).set(p)).catch(() => { N.saveFailed = true; });
      else try { localStorage.setItem('arcade-profile', JSON.stringify(p)); } catch (_) {}
      return N.saving;
    },
    setNick(n) { N.profile.nick = cleanNick(n) || 'NINJA'; return N.save(); },
    record(win) { if (win) N.profile.wins++; else N.profile.losses++; return N.save(); },
    async board() {
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
      const nr = N.room ? await N.room.join(name) : mockRoom(name);
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
    constructor(sess, host, me) { this.sess = sess; this.host = host; this.me = me; this.out = []; this.hid = 0; this.ack = 0; this.seq = 0; this.last = -1; this.snap = null; this.gone = 0; this.sfSeen = -1; }
    sendHit(h, dir) {
      this.out.push({ i: ++this.hid, d: Math.round(h.dmg), hs: h.hs || 0, bs: h.bs || 0, kb: h.kb || 0, la: h.launch ? 1 : 0, ly: h.ly || 0, lk: h.lock || 0, g: h.guard || 0, fx: h.fix ? 1 : 0, dr: dir, sf: h.sfx === 'heavy' ? 1 : 0 });
      if (this.out.length > 10) this.out.shift();
    }
    pre(M) {
      const o = this.sess.opp(), s = o && o.s;
      if (!s) { if (++this.gone > 300 && !M.done && M.o.onAbort) { M.done = true; M.o.onAbort(); } return; }
      this.gone = 0; this.snap = s;
      const me = M.f[this.me], rem = M.f[1 - this.me];
      if (Array.isArray(s.h)) for (const h of s.h) {
        if (!h || !(h.i > this.ack)) continue; this.ack = h.i;
        const spec = { dmg: G.clamp(+h.d || 0, 0, 160), hs: G.clamp(+h.hs || 0, 0, 80), bs: G.clamp(+h.bs || 0, 0, 30), kb: G.clamp(+h.kb || 0, 0, 12), launch: !!h.la, ly: G.clamp(+h.ly || 0, 0, 13), lock: G.clamp(+h.lk || 0, 0, 80), guard: +h.g || 0, fix: !!h.fx, sfx: h.sf ? 'heavy' : 'hit' };
        const r = me.takeHit(spec, h.dr > 0 ? 1 : -1, M);
        if (r) M.hitFx(rem, me, spec, r, me.x - (h.dr > 0 ? 1 : -1) * 16, G.GROUND + me.y - 110);
      }
      if (typeof s.a === 'number') this.out = this.out.filter((h) => h.i > s.a);
      if (!this.host && s.m) {
        const m = s.m;
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
        if (s.st !== f.state || mv !== f.mv || s.t < f.t || s.t > f.t + 8) { f.state = s.st; f.mv = mv; f.mvo = mv ? f.moves[mv] : null; if (f.state === 'atk' && !mv) f.state = 'idle'; f.t = s.t | 0; }
        f.ph = s.ph | 0; f.hp = G.clamp(+s.hp || 0, 0, f.ch.hp); f.en = +s.en || 0; f.sup = +s.sp || 0; f.combo = s.cb | 0; f.holdBack = !!s.hb; f.holdDown = !!s.hd; f.inv = s.iv | 0; f.hitPose = s.h2 | 0; f.dashF = !!s.df;
        if (f.state === 'atk' && f.mvo && f.mvo.sup && f.t < 12 && this.sfSeen !== s.mi) { this.sfSeen = s.mi; M.superFlash(f); }
        const mine = M.projs.filter((p) => !p.rem);
        const theirs = Array.isArray(s.pr) ? s.pr.slice(0, 3).map((p) => ({ o: f.idx, type: p[0], x: +p[1], y: +p[2], vx: +p[3], life: 99, r: +p[4] || 20, col: f.ch.col, col2: f.ch.col2, t: p[5] | 0, rem: true, h: {} })) : [];
        M.projs = mine.concat(theirs);
      } else f.t++;
      if (f.red > f.hp) f.red -= Math.max(1.5, (f.red - f.hp) * 0.04);
      if (f.flash > 0) f.flash--;
    }
    post(M) {
      if (M.tick % 2) return;
      const f = M.f[this.me], r = Math.round;
      const s = { q: ++this.seq, x: r(f.x), y: r(f.y), vx: r(f.vx * 10) / 10, vy: r(f.vy * 10) / 10, f: f.face, st: f.state, mv: f.mv, t: f.t, ph: f.ph, hp: r(f.hp), en: r(f.en), sp: r(f.sup), cb: f.combo, hb: f.holdBack ? 1 : 0, hd: f.holdDown ? 1 : 0, iv: f.inv, mi: f.mi || 0, h2: f.hitPose, df: f.dashF ? 1 : 0,
        pr: M.projs.filter((p) => !p.rem && p.o === this.me).map((p) => [p.type, r(p.x), p.y, p.vx, p.r, p.t]), h: this.out, a: this.ack };
      if (this.host) s.m = { ph: M.phase, rd: M.round, w: M.wins, wn: M.winner, tm: M.timer, tu: M.timeUp ? 1 : 0 };
      this.sess.set({ s });
    }
  };
})();
