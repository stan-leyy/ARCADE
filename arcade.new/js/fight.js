/* ARCADE — combat : combattants, coups, projectiles, IA, effets, interface de combat, déroulé des manches */
(function () {
  const G = window.G, GY = G.GROUND, W = G.W, SW = G.STAGE_W, FS = 1.12, GRAV = 0.8;
  const FLASH = 46; // durée de l'arrêt sur image des attaques ultimes

  /* ---------- Table des coups ---------- */
  function movesFor(ch, wp) {
    const bon = (wp && wp.bonus) || { dmg: 0, reach: 0 };
    const pw = ch.power * (1 + (bon.dmg || 0)), sw = wp && wp.kind !== 'glove' ? 1 : 0, reach = bon.reach || 0, ps = ch.poses || {};
    const pk = (k) => ps[k] || k;
    const N = (o) => Object.assign({ kind: 'n', su: 5, ac: 3, re: 9, dmg: 40, hs: 17, bs: 11, kb: 3.2, box: [14, -140, 62, 40], lunge: 2, tier: 1, pw: pk('jabW'), p: pk('jab'), hit: 'hit' }, o);
    const m = {
      a: N({ dmg: 40 * pw, box: [14, -146, 64 + reach, 50], arc: sw }),
      b: N({ su: 8, ac: 4, re: 13, dmg: 62 * pw, hs: 20, bs: 13, kb: 5, box: [14, -132, 88, 52], tier: 2, pw: 'kickW', p: 'kick', lunge: 1, arc: 1 }),
      c: N({ su: 12, ac: 4, re: 20, dmg: 98 * pw, hs: 24, bs: 17, kb: 8, box: [14, -156, 80 + reach, 70], tier: 3, pw: pk('hvW'), p: pk('hv'), lunge: 6, launch: 1, ly: 9, hit: 'heavy', guard: 26, arc: 1 }),
      sweep: N({ su: 9, ac: 4, re: 19, dmg: 58 * pw, kb: 4, box: [14, -44, 100, 44], tier: 2, pw: 'crouch', p: 'sweep', launch: 1, ly: 6.5, low: 1, arc: 1 }),
      air: N({ kind: 'air', su: 5, ac: 40, re: 0, dmg: 60 * pw, hs: 21, kb: 5, box: [4, -76, 78, 70], tier: 2, pw: 'jumpDn', p: 'airK' }),
    };
    const S = { cost: 30, tier: 4, hs: 22, bs: 15 };
    if (ch.sp === 'proj') m.s = N(Object.assign({}, S, { kind: 'proj', su: 13, ac: 0, re: 24, pw: 'castW', p: 'cast', pr: { type: 'orb', v: 8.5, dmg: 78 * pw, hs: 22, bs: 15, kb: 5, life: 95, y: -122, r: 20 } }));
    if (ch.sp === 'slash') m.s = N(Object.assign({}, S, { kind: 'proj', su: 14, ac: 0, re: 25, pw: 'sHvW', p: 'sHv', pr: { type: 'crescent', v: 10.5, dmg: 72 * pw, hs: 22, bs: 15, kb: 5, life: 80, y: -112, r: 30 } }));
    if (ch.sp === 'quake') m.s = N(Object.assign({}, S, { kind: 'proj', su: 17, ac: 0, re: 24, pw: 'stompW', p: 'stomp', quake: 1, pr: { type: 'quake', v: 9, dmg: 84 * pw, hs: 22, bs: 16, kb: 4, life: 36, y: -34, r: 34, launch: 1, ly: 9, ground: 1 } }));
    if (ch.sp === 'upper') m.s = N(Object.assign({}, S, { kind: 'upper', su: 6, ac: 16, re: 16, dmg: 105 * pw, kb: 5, launch: 1, ly: 11.5, box: [4, -200, 66, 140], pw: 'upW', p: 'upper', hit: 'heavy' }));
    if (ch.sp === 'rush') m.s = N(Object.assign({}, S, { kind: 'rush', su: 11, ac: 15, re: 20, dmg: 92 * pw, kb: 9, launch: 1, ly: 8, box: [10, -140, 74, 76], pw: 'hvW', p: 'rush', hit: 'heavy', bs: 18, guard: 24 }));
    if (ch.sp === 'flurry') m.s = N(Object.assign({}, S, { kind: 'flurry', su: 8, ac: 27, re: 16, dmg: 23 * pw, hs: 15, bs: 9, kb: 1.4, box: [10, -156, 96, 86], pw: 'jabW', p: 'jab' }));
    const X = { tier: 5, su: FLASH + 8, hit: 'heavy', pw: 'charge', sup: 1 };
    if (ch.su === 'beam') m.x = N(Object.assign({}, X, { kind: 'beam', ac: 42, re: 26, dmg: 36, hs: 16, bs: 10, kb: 2.5, box: [30, -160, 660, 100], p: 'cast' }));
    if (ch.su === 'erupt') m.x = N(Object.assign({}, X, { kind: 'beam', erupt: 1, ac: 42, re: 26, dmg: 37, hs: 16, bs: 10, kb: 1.5, box: [40, -230, 600, 230], p: 'stomp' }));
    if (ch.su === 'rush') m.x = N(Object.assign({}, X, { kind: 'srush', ac: 22, re: 26, dmg: 20, hs: 30, bs: 20, kb: 0.5, box: [10, -156, 84, 110], p: 'rush' }));
    return m;
  }

  /* ---------- Combattant ---------- */
  class Fighter {
    constructor(ch, idx, weaponId) {
      this.ch = ch; this.idx = idx; this.sup = 0; this.remote = false;
      this.wp = G.weaponById(weaponId || ch.weapon) || null;
      const bon = (this.wp && this.wp.bonus) || {};
      this.spd = ch.speed * (1 + (bon.spd || 0)); this.enGain = 0.16 * (1 + (bon.en || 0));
      this.moves = movesFor(ch, this.wp);
      this.pose = G.poseClone(G.POSES.idle); this.pvel = {}; this.ghosts = []; this.reset();
    }
    reset() {
      this.x = this.idx === 0 ? SW / 2 - 170 : SW / 2 + 170; this.y = 0; this.vx = 0; this.vy = 0;
      this.face = this.idx === 0 ? 1 : -1; this.hp = this.ch.hp; this.en = 100; this.red = this.ch.hp;
      this.state = 'intro'; this.t = 0; this.mv = null; this.mvo = null; this.hitF = false; this.conf = false;
      this.buf = { a: 0, b: 0, c: 0, s: 0, x: 0 }; this.prev = G.input.empty(); this.combo = 0; this.stun = 0;
      this.inv = 0; this.flash = 0; this.walkT = 0; this.tapDir = null; this.tapT = 0; this.airUsed = false;
      this.holdBack = false; this.holdDown = false; this.ph = 0; this.hitPose = 0; this.cbShow = 0; this.cbN = 0;
      this.sq = 0; this.sqv = 0; this.vsm = 0; this.minHp = 0;
    }
    neutral() { return this.state === 'idle' || this.state === 'walk' || this.state === 'crouch'; }
    lying() { return this.state === 'down' || (this.state === 'ko' && this.y === 0 && this.t > 2); }
    hurt() {
      const w = 25 * this.ch.bulk, low = this.state === 'crouch' || (this.state === 'block' && this.holdDown) || this.mv === 'sweep';
      const h = low ? 108 : 170;
      return { x1: this.x - w, x2: this.x + w, y1: GY + this.y - h, y2: GY + this.y };
    }
    wouldBlock(h) {
      const air = this.y < 0 || this.state === 'air';
      return !h.ub && !air && (this.neutral() || this.state === 'block') && this.holdBack;
    }
    startMove(k, M) {
      const m = this.moves[k];
      this.state = 'atk'; this.mv = k; this.mvo = m; this.t = 0; this.hitF = false; this.conf = false; this.ph = 0; this.hitN = 0; this.mi = (this.mi || 0) + 1;
      this.buf[k === 'sweep' ? 'b' : k] = 0;
      if (m.cost) this.en = Math.max(0, this.en - m.cost);
      if (m.sup) { this.sup = 0; this.inv = FLASH + 10; M.superFlash(this); } else G.sfx('whoosh');
    }
    tryAttack(inp, M, minTier) {
      const b = this.buf, mt = minTier || 0;
      if (b.x && this.sup >= 100 && mt < 5) { this.startMove('x', M); return true; }
      if (b.s && this.en >= 30 && mt < 4 && !(this.moves.s.kind === 'proj' && M.hasProj(this.idx))) { this.startMove('s', M); return true; }
      if (b.c && mt < 3) { this.startMove('c', M); return true; }
      if (b.b && mt < 2) { this.startMove(inp.d && mt === 0 ? 'sweep' : 'b', M); return true; }
      if (b.a && mt < 1) { this.startMove('a', M); return true; }
      if (b.a && mt === 1 && this.mv === 'a' && this.hitN < 1) { const n = this.hitN + 1; this.startMove('a', M); this.hitN = n; return true; }
      return false;
    }
    update(inp, opp, M) {
      const p = this.prev; let dashReq = null;
      for (const k in this.buf) { if (inp[k] && !p[k]) this.buf[k] = 9; else if (this.buf[k] > 0) this.buf[k]--; }
      for (const d of ['l', 'r']) if (inp[d] && !p[d]) { if (this.tapDir === d && this.tapT > 0) dashReq = d; this.tapDir = d; this.tapT = 13; }
      if (this.tapT > 0) this.tapT--;
      this.prev = inp; if (this.flash > 0) this.flash--; if (this.inv > 0) this.inv--;
      if (this.cbShow > 0) this.cbShow--;
      this.t++;
      const sp = this.spd;
      if (this.neutral()) { this.face = opp.x >= this.x ? 1 : -1; this.combo = 0; }
      const fwd = this.face > 0 ? inp.r : inp.l, bk = this.face > 0 ? inp.l : inp.r;
      this.holdBack = bk; this.holdDown = inp.d;
      switch (this.state) {
        case 'intro': case 'win': this.vx = 0; break;
        case 'idle': case 'walk': case 'crouch': {
          this.en = Math.min(100, this.en + this.enGain);
          if (this.tryAttack(inp, M)) break;
          if (dashReq) { const dir = dashReq === 'r' ? 1 : -1; this.state = 'dash'; this.t = 0; this.vx = dir * 9.5 * sp; this.dashF = dir === this.face; G.sfx('whoosh'); M.dust(this.x, 0, 4); break; }
          if (inp.u) { this.state = 'jump'; this.t = 0; this.vy = -15.6; this.vx = (fwd ? 4.6 : bk ? -4.2 : 0) * this.face * sp; this.airUsed = false; this.sq = 0.09; G.sfx('jump'); M.dust(this.x, 0, 3); break; }
          if (inp.d) { this.state = 'crouch'; this.vx = 0; }
          else if (fwd) { this.state = 'walk'; this.vx = 3.7 * sp * this.face; this.walkT += 0.19; }
          else if (bk) { this.state = 'walk'; this.vx = -2.9 * sp * this.face; this.walkT -= 0.16; }
          else { this.state = 'idle'; this.vx = 0; }
          break;
        }
        case 'dash': {
          if (this.t % 3 === 0) this.ghost();
          if (this.t > 9) this.vx *= 0.7;
          if (this.t > 15) { this.state = 'idle'; this.vx = 0; }
          else if (this.t > 6 && this.dashF && this.tryAttack(inp, M)) { /* attaque depuis la ruée */ }
          break;
        }
        case 'jump': {
          if (!this.airUsed && (this.buf.a || this.buf.b || this.buf.c)) { this.buf.a = this.buf.b = this.buf.c = 0; this.airUsed = true; this.state = 'atk'; this.mv = 'air'; this.mvo = this.moves.air; this.t = 0; this.hitF = false; this.conf = false; G.sfx('whoosh'); }
          break;
        }
        case 'atk': this.updAttack(inp, opp, M); break;
        case 'hit': case 'block': case 'locked': case 'dizzy': {
          this.vx *= 0.84;
          if (this.t > this.stun) { if (this.state === 'dizzy') this.en = 55; this.state = 'idle'; this.vx = 0; }
          break;
        }
        case 'air': break;
        case 'down': this.vx *= 0.8; if (this.t > 30) { this.state = 'getup'; this.t = 0; this.inv = 22; } break;
        case 'getup': this.vx = 0; if (this.t > 15) { this.state = 'idle'; this.combo = 0; } break;
        case 'rec': this.vx *= 0.7; if (this.t > this.stun) this.state = 'idle'; break;
        case 'ko': this.vx *= 0.9; break;
      }
      /* physique */
      this.x += this.vx;
      if (this.y < 0 || this.vy < 0) {
        this.vy += (this.state === 'air' || this.state === 'ko') ? 0.62 : GRAV; this.y += this.vy;
        if (this.y >= 0) {
          this.sq = -Math.min(0.14, 0.04 + Math.abs(this.vy) * 0.006); this.y = 0; this.vy = 0; G.sfx('land'); M.dust(this.x, 0, 5);
          if (this.state === 'air') { this.state = 'down'; this.t = 0; this.vx *= 0.4; M.shake = Math.max(M.shake, 5); }
          else if (this.state === 'ko') { this.t = 0; this.vx *= 0.4; M.shake = Math.max(M.shake, 7); }
          else if (this.state === 'jump' || (this.state === 'atk' && this.mvo.kind === 'air')) { this.state = 'idle'; this.vx = 0; }
          else if (this.state === 'atk' && this.mvo.kind === 'upper') { this.state = 'rec'; this.t = 0; this.stun = this.mvo.re; }
        }
      }
      this.x = G.clamp(this.x, 46, SW - 46);
      if (this.red > this.hp) this.red -= Math.max(1.5, (this.red - this.hp) * 0.04);
    }
    updAttack(inp, opp, M) {
      const m = this.mvo, T = this.t, k = m.kind, grounded = this.y === 0 && this.vy === 0;
      const end = () => { this.state = 'idle'; this.mv = null; this.vx = 0; };
      const spec = (o) => Object.assign({ dmg: m.dmg, hs: m.hs, bs: m.bs, kb: m.kb, launch: m.launch, ly: m.ly, guard: m.guard, sfx: m.hit }, o);
      if (grounded && k !== 'rush' && k !== 'srush') this.vx *= 0.72;
      if (k === 'n') {
        if (T === m.su) { this.vx += this.face * m.lunge; if (m.arc) M.arc(this, m); }
        if (T > m.su && T <= m.su + m.ac && !this.hitF) M.strike(this, opp, m.box, spec());
        if (this.conf && T > m.su + 1 && this.tryAttack(inp, M, m.tier)) return;
        if (T > m.su + m.ac + m.re) end();
      } else if (k === 'air') {
        if (T > m.su && !this.hitF) M.strike(this, opp, m.box, spec());
      } else if (k === 'proj') {
        if (T === m.su) {
          const pr = m.pr;
          M.projs.push({ o: this.idx, type: pr.type, x: this.x + this.face * 60, y: GY + pr.y, vx: this.face * pr.v, life: pr.life, r: pr.r, col: this.ch.col, col2: this.ch.col2, h: { dmg: pr.dmg, hs: pr.hs, bs: pr.bs, kb: pr.kb, launch: pr.launch, ly: pr.ly, sfx: 'heavy' }, t: 0 });
          G.sfx('proj'); if (m.quake) { M.shake = 9; M.ring(this.x + this.face * 36, GY, this.ch.col, 60); M.dust(this.x + this.face * 36, 0, 8); }
          else M.burst(this.x + this.face * 60, GY + pr.y, this.ch.col, 8, 4);
        }
        if (T > m.su + m.re) end();
      } else if (k === 'upper') {
        if (T === 1) this.inv = 9;
        if (T === m.su) { this.vy = -13; this.vx = this.face * 3.4; G.sfx('jump'); M.dust(this.x, 0, 5); }
        if (T > m.su && T <= m.su + m.ac && !this.hitF) M.strike(this, opp, m.box, spec());
        if (T > m.su && T % 3 === 0 && this.vy < 0) this.ghost();
      } else if (k === 'rush') {
        if (T > m.su && T <= m.su + m.ac) { this.vx = this.face * 11.5; if (T % 3 === 0) this.ghost(); if (!this.hitF) M.strike(this, opp, m.box, spec()); M.trail(this.x - this.face * 20, GY - 90, this.ch.col); }
        else this.vx *= 0.7;
        if (T > m.su + m.ac + m.re) end();
      } else if (k === 'flurry') {
        if (T > m.su && T <= m.su + m.ac) {
          const n = ((T - m.su - 1) / 5) | 0, last = n >= 5;
          if ((T - m.su - 1) % 5 === 0) { this.hitF = false; G.sfx('whoosh'); this.vx += this.face * 1.6; }
          if (!this.hitF) M.strike(this, opp, m.box, last ? spec({ dmg: m.dmg * 1.8, launch: 1, ly: 8.5, kb: 7, sfx: 'heavy' }) : spec());
        }
        if (T > m.su + m.ac + m.re) end();
      } else if (k === 'beam') {
        if (T === m.su) { G.sfx('beam'); M.shake = 12; }
        if (T > m.su && T <= m.su + m.ac) {
          M.shake = Math.max(M.shake, 5);
          if ((T - m.su - 1) % 6 === 0) this.hitF = false;
          const last = T > m.su + m.ac - 6;
          if (!this.hitF) M.strike(this, opp, m.box, spec({ fix: 1, launch: last ? 1 : 0, ly: 10, kb: last ? 9 : m.kb }));
        }
        if (T > m.su + m.ac + m.re) end();
      } else if (k === 'srush') {
        if (this.ph === 0) { // ruée
          if (T > m.su) {
            this.vx = this.face * 17; if (T % 2 === 0) this.ghost();
            if (!this.hitF) {
              const r = M.strike(this, opp, m.box, spec({ fix: 1, lock: 70, hs: 70 }));
              if (r === 'hit') { this.ph = 1; this.t = 0; this.vx = 0; this.hitN = 0; }
              else if (r === 'block') { this.ph = 2; this.t = 0; }
            }
            if (this.ph === 0 && T > m.su + m.ac) { this.ph = 2; this.t = 0; }
          }
        } else if (this.ph === 1) { // enchaînement verrouillé
          this.vx = 0;
          if (T % 5 === 0 && this.hitN < 9) {
            this.hitN++; this.hitF = false;
            M.strike(this, opp, [-40, -220, 200, 230], spec({ fix: 1, lock: 30, hs: 30, kb: 0.3 }));
            M.slashFx(opp.x + G.rnd(-20, 20), GY + opp.y - G.rnd(60, 130), this.ch.col, G.rnd(0, 6.3));
          }
          if (T === 56) { this.hitF = false; M.strike(this, opp, [-40, -220, 220, 230], spec({ fix: 1, dmg: 84, launch: 1, ly: 12, kb: 10, sfx: 'heavy' })); M.shake = 14; M.ring(opp.x, GY + opp.y - 90, this.ch.col, 120); }
          if (T > 80) end();
        } else { this.vx *= 0.8; if (T > m.re) end(); }
      }
    }
    takeHit(h, dir, M) {
      if (this.inv > 0 || this.state === 'down' || this.state === 'getup' || this.state === 'ko' || this.state === 'win' || this.state === 'intro') return null;
      const air = this.y < 0 || this.state === 'air';
      if (this.wouldBlock(h)) {
        this.hp = Math.max(1, this.hp - h.dmg * 0.08); this.en -= h.guard || (5 + h.dmg * 0.13);
        this.state = 'block'; this.t = 0; this.stun = h.bs || 12; this.vx = dir * (h.kb || 3) * 0.9;
        if (this.en <= 0) { this.en = 0; this.state = 'dizzy'; this.stun = 80; G.sfx('brk'); M.ring(this.x, GY - 100, '#fff', 90); M.say('GARDE BRISÉE', 50, 0.7); }
        return 'block';
      }
      const scale = h.fix ? 1 : Math.max(0.4, 1 - 0.1 * this.combo);
      const dmg = Math.round(h.dmg * scale);
      this.combo++; this.hp -= dmg; this.sup = Math.min(100, this.sup + dmg * 0.055); this.flash = 6; this.hitPose ^= 1;
      this.mv = null; this.t = 0;
      if (this.minHp && this.hp < this.minHp) this.hp = this.minHp;
      if (this.hp <= 0) { this.hp = 0; this.state = 'ko'; this.vy = -9.5; this.vx = dir * 7; this.y = Math.min(this.y, -1); return 'ko'; }
      if (h.lock) { this.state = 'locked'; this.stun = h.lock; this.vx = dir * 0.3; }
      else if (h.launch || air) { this.state = 'air'; this.vy = -(h.launch ? h.ly || 9 : 6.5); this.vx = dir * (h.kb || 4) * 0.9; this.y = Math.min(this.y, -1); }
      else { this.state = 'hit'; this.stun = h.hs || 16; this.vx = dir * (h.kb || 3); }
      return 'hit';
    }
    ghost() { this.ghosts.push({ p: G.poseClone(this.pose), x: this.x, y: this.y, f: this.face, l: 12 }); if (this.ghosts.length > 8) this.ghosts.shift(); }
    /* pose cible selon l'état */
    target() {
      const PO = G.POSES, ps = this.ch.poses || {}, idle = PO[ps.idle || 'idle'];
      switch (this.state) {
        case 'intro': return [PO.intro, 0.2];
        case 'walk': return [idle, 0.3];
        case 'crouch': return [PO.crouch, 0.38];
        case 'jump': return [this.vy < 0 ? PO.jumpUp : PO.jumpDn, 0.3];
        case 'dash': return [this.dashF ? PO.dash : PO.back, 0.5];
        case 'block': return [this.holdDown ? PO.cblock : PO.block, 0.6];
        case 'hit': case 'locked': return [this.hitPose ? PO.hit1 : PO.hit2, 0.6];
        case 'air': return [PO.air, 0.35];
        case 'down': return [PO.down, 0.5];
        case 'ko': return [this.y < 0 ? PO.air : PO.down, 0.4];
        case 'getup': return [PO.getup, 0.3];
        case 'dizzy': return [PO.dizzy, 0.2];
        case 'win': return [PO.win, 0.14];
        case 'rec': return [PO.crouch, 0.3];
        case 'atk': {
          const m = this.mvo, T = this.t, k = m.kind;
          if (k === 'srush') {
            if (this.ph === 0) return T <= m.su ? [PO.charge, 0.3] : [PO.rush, 0.6];
            if (this.ph === 1) { const seq = this.ch.sword ? ['sJab', 'sHvW', 'sHv', 'sJabW'] : ['jab', 'hv', 'kick', 'flurB']; return T > 56 ? [PO[this.ch.sword ? 'sHv' : 'hv'], 0.7] : T > 48 ? [PO[this.ch.sword ? 'sHvW' : 'hvW'], 0.5] : [PO[seq[((T / 5) | 0) % 4]], 0.7]; }
            return [idle, 0.2];
          }
          if (k === 'flurry' && T > m.su && T <= m.su + m.ac) return [(((T - m.su) / 5) | 0) % 2 ? PO.flurB : PO.jab, 0.75];
          if (k === 'upper') return T <= m.su ? [PO.upW, 0.5] : [this.vy < 4 ? PO.upper : PO.jumpDn, 0.6];
          if (k === 'air') return T <= m.su ? [PO.jumpDn, 0.4] : [PO.airK, 0.6];
          if (m.sup && T < FLASH) return [PO.charge, 0.16];
          if (T <= m.su) return [PO[m.pw], 0.42];
          if (T <= m.su + m.ac + (k === 'proj' ? 12 : 3)) return [PO[m.p], 0.68];
          return [idle, 0.24];
        }
      }
      return [idle, 0.25];
    }
    animate() {
      const tg = this.target(), t = tg[1];
      G.poseSpring(this.pose, this.pvel, tg[0], 0.05 + t * t * 0.95, this.state === 'atk' ? 0.55 : 0.68);
      this.sqv += -this.sq * 0.32 - this.sqv * 0.38; this.sq += this.sqv; // écrasement / étirement
      this.vsm += (this.vx * this.face - this.vsm) * 0.08; // tissu en retard sur le corps
      for (const g of this.ghosts) g.l--; while (this.ghosts.length && this.ghosts[0].l <= 0) this.ghosts.shift();
    }
    draw(c, cam, time) {
      const sx = this.x - cam, sy = GY + this.y;
      // ombre
      c.fillStyle = 'rgba(10,4,8,.35)'; c.beginPath(); c.ellipse(sx, GY + 3, 46 * (1 + this.y / 500), 8, 0, 0, 7); c.fill();
      for (const g of this.ghosts) {
        c.save(); c.globalAlpha = g.l / 26; c.translate(g.x - cam, GY + g.y); c.scale(g.f * FS, FS);
        G.drawFighter(c, this.ch, g.p, time, { mono: this.ch.col, weapon: this.wp }); c.restore();
      }
      const p = this.pose; let dp = p;
      if (this.state === 'idle' || this.state === 'walk' || this.state === 'dizzy' || this.state === 'intro' || this.state === 'win') {
        dp = G.poseClone(p);
        const br = Math.sin(time * 0.07 + this.idx * 2);
        dp.hy += br * 1.6 + 1.6; dp.fh[1] += br * 1.2; dp.bh[1] += br * 1.4;
        if (this.state === 'walk') {
          const s = Math.sin(this.walkT), co = Math.cos(this.walkT);
          dp.ff[0] += s * 21; dp.ff[1] -= Math.max(0, co) * 15; dp.bf[0] -= s * 21; dp.bf[1] -= Math.max(0, -co) * 15; dp.hy += Math.abs(s) * 3.4;
          dp.fh[0] -= s * 5; dp.bh[0] += s * 6; dp.lean += Math.sign(this.vx * this.face) * 3 + co * 1.2; dp.hd -= co * 1.5;
        }
        if (this.state === 'dizzy') { dp.lean += Math.sin(time * 0.13) * 7; dp.hd += Math.sin(time * 0.17) * 9; }
      }
      const sq = G.clamp(this.sq, -0.18, 0.14);
      c.save(); c.translate(sx, sy); c.scale(this.face * FS * (1 - sq * 0.6), FS * (1 + sq));
      const mono = this.flash > 0 && this.flash % 2 === 0 ? '#fff' : null;
      const hurt = this.state === 'hit' || this.state === 'locked' || this.state === 'air' || this.state === 'ko' || this.state === 'dizzy' || this.state === 'down';
      G.drawFighter(c, this.ch, dp, time, { mono, vx: this.vx * this.face, lag: this.vsm - this.vx * this.face, weapon: this.wp, hurt });
      c.restore();
      if (this.state === 'dizzy') { for (let i = 0; i < 3; i++) { const a = time * 0.14 + i * 2.1; c.fillStyle = '#ffe36b'; star(c, sx + Math.cos(a) * 26, sy - 226 * FS * 0.9 + Math.sin(a) * 7, 6); } }
    }
  }
  function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }

  /* ---------- IA ---------- */
  class CPU {
    constructor(level) { this.lv = level; this.q = []; this.cool = 20; this.plan = null; this.dec = false; this.blk = false; }
    think(me, opp, M) {
      const inp = G.input.empty(), L = this.lv;
      const blockP = [0.22, 0.5, 0.82][L], aggr = [0.4, 0.62, 0.85][L];
      const dx = opp.x - me.x, d = Math.abs(dx), to = dx > 0 ? 'r' : 'l', away = dx > 0 ? 'l' : 'r';
      let proj = false;
      for (const p of M.projs) if (p.o !== me.idx && Math.abs(p.x - me.x) < 210 && (p.vx > 0) === (me.x > p.x)) proj = true;
      const threat = proj || (opp.state === 'atk' && d < (opp.mvo && opp.mvo.sup ? 700 : 190) && opp.t < 30);
      if (threat) {
        if (!this.dec) { this.dec = true; this.blk = Math.random() < blockP; this.jmp = proj && Math.random() < 0.3 * aggr; }
        if (this.jmp && me.neutral()) { inp.u = true; inp[to] = true; return inp; }
        if (this.blk && !this.q.length) { inp[away] = true; return inp; }
      } else this.dec = false;
      if (!me.neutral() && me.state !== 'atk' && me.state !== 'jump' && me.state !== 'dash') { this.q.length = 0; return inp; }
      if (this.q.length) {
        const q = this.q[0]; q.t--; if (q.d) inp.d = true; if (q.h) inp[q.h === 'to' ? to : away] = true;
        if (q.t <= 0) { if (q.k) inp[q.k] = true; this.q.shift(); }
        return inp;
      }
      if (this.plan && this.plan.t-- > 0) { if (this.plan.k) inp[this.plan.k === 'to' ? to : away] = true; return inp; }
      this.plan = null;
      if (--this.cool > 0) return inp;
      const r = Math.random(), ranged = me.moves.s.kind === 'proj', spOk = me.en >= 40 && !(ranged && M.hasProj(me.idx));
      this.cool = [26, 14, 6][L] + Math.random() * 14;
      if (me.sup >= 100 && d < (me.moves.x.kind === 'srush' ? 330 : 520) && r < 0.35 + aggr * 0.4) { this.q.push({ k: 'x', t: 2 }); return inp; }
      if (d > 330) {
        if (ranged && spOk && r < 0.5) this.q.push({ k: 's', t: 2 });
        else if (r < 0.85) this.plan = { k: 'to', t: 18 + Math.random() * 26 };
        else this.q.push({ k: null, t: 1, h: 'to' }, { k: null, t: 3 }, { k: null, t: 1, h: 'to' }); // ruée (double appui)
      } else if (d > 118) {
        if (r < aggr * 0.55) this.plan = { k: 'to', t: 10 + Math.random() * 16 };
        else if (r < aggr * 0.55 + 0.16 && spOk) this.q.push({ k: 's', t: 2 });
        else if (r < aggr * 0.55 + 0.3) { this.q.push({ k: 'u', t: 1, h: 'to' }, { k: 'b', t: 20 + Math.random() * 6, h: 'to' }); }
        else if (r < 0.9) this.plan = { k: null, t: 8 + Math.random() * 12 };
        else this.plan = { k: 'away', t: 12 + Math.random() * 14 };
      } else {
        if (r < aggr) {
          const combos = [['a', 'a', 'c'], ['a', 'b', 's'], ['b', 'c'], ['a', 'a', 'b', 's'], ['c'], ['a', 'b', 'c'], ['a', 'a', 'c', 's']];
          const cb = G.pick(L === 0 ? combos.slice(0, 5) : combos);
          cb.forEach((k, i) => this.q.push({ k, t: i === 0 ? 2 : 9 + ((Math.random() * 3) | 0) }));
          if (Math.random() < 0.15) { this.q.length = 0; this.q.push({ k: 'b', t: 3, d: 1 }); }
        } else if (r < aggr + 0.12) this.plan = { k: 'away', t: 14 + Math.random() * 16 };
        else this.plan = { k: 'away', t: 6 };
      }
      return inp;
    }
  }
  G.CPU = CPU;

  /* ---------- Match ---------- */
  class Match {
    constructor(o) {
      this.o = o; this.stage = new G.Stage(o.stage);
      this.f = [new Fighter(o.chars[0], 0, o.weapons && o.weapons[0]), new Fighter(o.chars[1], 1, o.weapons && o.weapons[1])];
      this.timeScale = 1; this.tacc = 0;
      this.ctrl = o.ctrl; this.cpu = [new CPU(o.levels ? o.levels[0] : o.level || 1), new CPU(o.levels ? o.levels[1] : o.level || 1)];
      this.net = o.net || null; this.names = o.names || [o.chars[0].name, o.chars[1].name];
      this.need = o.need || 2; this.wins = [0, 0]; this.round = 1; this.tick = 0; this.cam = (SW - W) / 2;
      this.projs = []; this.fx = []; this.parts = []; this.shake = 0; this.stop = 0; this.sf = null; this.msg = null;
      this.white = 0; this.done = false; this.winner = -1; this.final = -1;
      this.f.forEach((f, i) => { f.remote = this.ctrl[i] === 'remote'; });
      this.setPhase('intro');
    }
    hasProj(i) { return this.projs.some((p) => p.o === i); }
    say(text, life, scale, sub) { this.msg = { text, t: 0, life: life || 70, scale: scale || 1, sub }; }
    setPhase(ph) {
      this.phase = ph; this.pt = 0;
      if (ph === 'intro') {
        this.timer = 60; this.projs.length = 0; this.winner = -1;
        this.f.forEach((f) => { if (!f.remote || !this.net) f.reset(); else { f.reset(); } });
        this.say(this.need === 1 ? 'EN GARDE' : this.wins[0] === this.need - 1 && this.wins[1] === this.need - 1 ? 'MANCHE FINALE' : 'MANCHE ' + this.round, 66, 1); G.sfx('gong');
      } else if (ph === 'fight') { this.f.forEach((f) => { if (f.state === 'intro') f.state = 'idle'; }); this.say('COMBAT !', 46, 1.25); G.sfx('ok'); }
      else if (ph === 'ko') { this.white = 1; G.sfx('ko'); this.say(this.timeUp ? 'TEMPS ÉCOULÉ' : 'K.O.', 110, 1.6); this.shake = 16; }
      else if (ph === 'win') {
        const w = this.winner;
        if (w >= 0) { const f = this.f[w]; if (f.state !== 'ko') { f.state = 'win'; f.t = 0; } const perfect = f.hp >= f.ch.hp; this.say(this.names[w] + ' GAGNE', 150, 0.95, perfect ? 'PARFAIT' : ''); } else this.say('ÉGALITÉ', 150, 1);
        G.sfx('gong');
      }
    }
    superFlash(f) { this.sf = { t: 0, f }; G.sfx('superc'); }
    /* effets */
    dust(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ x: x + G.rnd(-14, 14), y: GY + y - 2, vx: G.rnd(-2.4, 2.4), vy: G.rnd(-1.6, -0.2), l: 22, L: 22, r: G.rnd(5, 11), col: this.stage.def.dust, k: 'puff' }); }
    burst(x, y, col, n, v) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.3, s = G.rnd(1, v || 6); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 18, L: 18, r: G.rnd(2, 4.5), col, k: 'sq', g: 0.15 }); } }
    trail(x, y, col) { this.parts.push({ x: x + G.rnd(-8, 8), y: y + G.rnd(-40, 40), vx: 0, vy: G.rnd(-1, 0), l: 14, L: 14, r: G.rnd(6, 14), col, k: 'glow' }); }
    ring(x, y, col, r) { this.fx.push({ k: 'ring', x, y, col, r, t: 0, life: 18 }); }
    spark(x, y, col, size, blocked) { this.fx.push({ k: blocked ? 'guard' : 'spark', x, y, col, r: size, t: 0, life: blocked ? 10 : 13, a: Math.random() * 6.3 }); }
    slashFx(x, y, col, a) { this.fx.push({ k: 'slash', x, y, col, a, t: 0, life: 9, r: 90 }); G.sfx('whoosh'); }
    arc(f, m) { const b = m.box; this.fx.push({ k: 'arc', x: f.x + f.face * (b[0] + b[2] * 0.45), y: GY + f.y + b[1] + b[3] * 0.5, f: f.face, r: b[2] * 0.62, col: f.wp && f.wp.glow ? f.wp.glow : f.wp && f.wp.kind !== 'glove' ? '#e8eef2' : f.ch.sword ? f.ch.col : '#fff', t: 0, life: 7, low: m.low, up: m.p === 'kick' }); }
    /* frappe : zone d'attaque contre zone vulnérable */
    strike(att, def, b, h) {
      const x1 = att.x + (att.face > 0 ? b[0] : -(b[0] + b[2])), x2 = x1 + b[2], y1 = GY + att.y + b[1], y2 = y1 + b[3];
      if (def.lying()) return null;
      const u = def.hurt();
      if (x2 < u.x1 || x1 > u.x2 || y2 < u.y1 || y1 > u.y2) return null;
      const px = (Math.max(x1, u.x1) + Math.min(x2, u.x2)) / 2, py = (Math.max(y1, u.y1) + Math.min(y2, u.y2)) / 2;
      return this.applyHit(att, def, h, px, py, att.face);
    }
    applyHit(att, def, h, px, py, dir) {
      let r;
      if (def.remote && this.net) { // en ligne : l'adversaire valide le coup chez lui
        if (def.inv > 0 || def.state === 'down' || def.state === 'getup' || def.state === 'ko') return null;
        r = def.wouldBlock(h) ? 'block' : 'hit'; this.net.sendHit(h, dir);
      } else r = def.takeHit(h, dir, this);
      if (!r) return null;
      if (att) { att.hitF = true; }
      this.hitFx(att, def, h, r, px, py);
      return r;
    }
    hitFx(att, def, h, r, px, py) {
      const col = att ? att.ch.col : '#fff';
      if (r === 'block') { this.spark(px, py, '#bfe6ff', 34, true); G.sfx('block'); this.stop = Math.max(this.stop, 3); if (att) att.vx -= att.face * 1.5; return; }
      const big = h.sfx === 'heavy' || r === 'ko';
      this.spark(px, py, col, big ? 78 : 50); this.burst(px, py, col, big ? 12 : 6, big ? 8 : 5);
      this.stop = Math.max(this.stop, big ? 8 : 5); this.shake = Math.max(this.shake, big ? 9 : 4); G.sfx(big ? 'heavy' : 'hit');
      if (att) { att.conf = true; att.sup = Math.min(100, att.sup + h.dmg * 0.11); att.cbN = def.combo; if (def.combo > 1) att.cbShow = 70; }
    }
    /* un pas de simulation (60 par seconde) */
    step() {
      this.tick++; this.stage.update(); this.pt++;
      this.updFx();
      if (this.msg && ++this.msg.t > this.msg.life) this.msg = null;
      if (this.white > 0) this.white -= 0.06;
      if (this.shake > 0) this.shake *= 0.86;
      const f = this.f;
      if (this.net) this.net.pre(this);
      if (this.sf) {
        this.sf.t++; f.forEach((x) => x.animate()); if (this.sf.f.t < FLASH) this.sf.f.t++;
        if (this.sf.t % 2 === 0) this.trail(this.sf.f.x + G.rnd(-40, 40), GY - 60, this.sf.f.ch.col);
        if (this.sf.t >= FLASH) this.sf = null;
        if (this.net) this.net.post(this); return;
      }
      if (this.stop > 0) { this.stop--; if (this.net) this.net.post(this); return; }
      if (this.phase === 'ko' && this.pt < 60 && this.tick % 3) { if (this.net) this.net.post(this); return; }
      const live = this.phase === 'fight';
      for (let i = 0; i < 2; i++) {
        const me = f[i], opp = f[1 - i];
        if (me.remote) { if (this.net) this.net.remoteStep(me, this); me.animate(); continue; }
        let inp = G.input.empty();
        if (live) inp = this.ctrl[i] === 'human' ? G.input.read() : (this.cpuOverride && this.cpuOverride(i, me, opp)) || this.cpu[i].think(me, opp, this);
        me.update(inp, opp, this); me.animate();
      }
      // collision des corps
      const a = f[0], b = f[1], dx = b.x - a.x, min = 50;
      if (Math.abs(dx) < min && Math.abs(a.y - b.y) < 80 && !a.lying() && !b.lying()) {
        const push = (min - Math.abs(dx)) / 2, s = dx >= 0 ? 1 : -1;
        if (!a.remote) a.x -= s * push; if (!b.remote) b.x += s * push;
      }
      for (const x of f) if (!x.remote) { const o = x === a ? b : a; if (Math.abs(x.x - o.x) > W - 150) x.x = o.x + Math.sign(x.x - o.x) * (W - 150); x.x = G.clamp(x.x, 46, SW - 46); }
      this.updProjs(live);
      const mid = (a.x + b.x) / 2 - W / 2; this.cam += (G.clamp(mid, 0, SW - W) - this.cam) * 0.12;
      this.flow();
      if (this.net) this.net.post(this);
    }
    flow() {
      const f = this.f, host = !this.net || this.net.host;
      if (this.phase === 'intro' && host && this.pt > 96) this.setPhase('fight');
      else if (this.phase === 'fight' && host) {
        if (this.tick % 60 === 0 && this.timer > 0 && !this.o.noTimer) this.timer--;
        const k0 = f[0].hp <= 0, k1 = f[1].hp <= 0;
        if (k0 || k1 || this.timer <= 0) {
          this.timeUp = !k0 && !k1;
          if (this.timeUp) { const r0 = f[0].hp / f[0].ch.hp, r1 = f[1].hp / f[1].ch.hp; this.winner = r0 === r1 ? -1 : r0 > r1 ? 0 : 1; }
          else this.winner = k0 && k1 ? -1 : k0 ? 1 : 0;
          this.setPhase('ko');
        }
      } else if (this.phase === 'ko' && host && this.pt > 130) {
        if (this.winner >= 0) this.wins[this.winner]++; else { this.wins[0] = Math.min(this.need - 1, this.wins[0] + 1); this.wins[1] = Math.min(this.need - 1, this.wins[1] + 1); }
        this.setPhase('win');
      } else if (this.phase === 'win' && this.pt > 170) {
        const w = this.wins[0] >= this.need ? 0 : this.wins[1] >= this.need ? 1 : -1;
        const tooLong = this.round >= this.need * 2 + 1; // égalités à répétition : match nul
        if (w >= 0 || tooLong) { if (!this.done) { this.done = true; this.final = w; if (this.o.onEnd) this.o.onEnd(w, this); } }
        else if (host) { this.round++; this.setPhase('intro'); }
      }
    }
    updProjs(live) {
      for (let i = this.projs.length - 1; i >= 0; i--) {
        const p = this.projs[i]; p.x += p.vx; p.t++; p.life--;
        if (p.type !== 'quake' && p.t % 2 === 0) this.parts.push({ x: p.x - p.vx, y: p.y + G.rnd(-10, 10), vx: -p.vx * 0.1, vy: G.rnd(-0.5, 0.5), l: 12, L: 12, r: G.rnd(4, 9), col: p.col, k: 'glow' });
        if (p.type === 'quake' && p.t % 3 === 0) { this.dust(p.x, 0, 2); this.shake = Math.max(this.shake, 3); }
        let dead = p.life <= 0 || p.x < 0 || p.x > SW;
        if (!dead && !p.rem) {
          const def = this.f[1 - p.o], u = def.hurt();
          if (!def.lying() && p.x + p.r > u.x1 && p.x - p.r < u.x2 && p.y + p.r > u.y1 && p.y - p.r < u.y2 && !(p.type === 'quake' && def.y < -30)) {
            const r = this.applyHit(null, def, p.h, p.x, G.clamp(p.y, u.y1 + 20, u.y2 - 20), Math.sign(p.vx));
            if (r) { dead = true; const o = this.f[p.o]; o.sup = Math.min(100, o.sup + (r === 'block' ? 2 : p.h.dmg * 0.11)); this.spark(p.x, p.y, p.col, 60, r === 'block'); if (r !== 'block') { o.cbN = def.combo; if (def.combo > 1) o.cbShow = 70; } }
          }
          for (const q of this.projs) if (q !== p && q.o !== p.o && Math.abs(q.x - p.x) < p.r + q.r && Math.abs(q.y - p.y) < 70 && q.life > 0) { q.life = 0; dead = true; this.spark((p.x + q.x) / 2, p.y, '#fff', 70); G.sfx('block'); }
        }
        if (dead) { this.burst(p.x, p.y, p.col, 8, 5); this.projs.splice(i, 1); }
      }
    }
    updFx() {
      for (let i = this.fx.length - 1; i >= 0; i--) if (++this.fx[i].t > this.fx[i].life) this.fx.splice(i, 1);
      for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.x += p.vx; p.y += p.vy; if (p.g) p.vy += p.g; if (--p.l <= 0) this.parts.splice(i, 1); }
      if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);
    }

    /* ---------- Rendu ---------- */
    draw(c) {
      const cam = this.cam, f = this.f, T = this.tick;
      c.save();
      if (this.shake > 0.5) c.translate(G.vrnd(-1, 1) * this.shake, G.vrnd(-1, 1) * this.shake * 0.6);
      this.stage.draw(c, cam);
      const sf = this.sf, beamer = f.find((x) => x.state === 'atk' && x.mvo && x.mvo.kind === 'beam' && x.t > x.mvo.su && x.t <= x.mvo.su + x.mvo.ac);
      const dark = sf ? Math.min(1, sf.t / 8) : beamer ? 0.6 : 0;
      if (dark > 0) {
        c.fillStyle = 'rgba(8,4,14,' + 0.72 * dark + ')'; c.fillRect(-20, -20, W + 40, G.H + 40);
        if (sf) { // lignes de vitesse
          const ox = sf.f.x - cam, oy = GY - 110; c.strokeStyle = sf.f.ch.col; c.globalAlpha = 0.5;
          for (let i = 0; i < 26; i++) { const a = i * 0.2417 + sf.t * 0.02, r1 = 120 + ((i * 53 + sf.t * 30) % 300), r2 = r1 + 160; c.lineWidth = 1 + (i % 3); c.beginPath(); c.moveTo(ox + Math.cos(a) * r1, oy + Math.sin(a) * r1 * 0.7); c.lineTo(ox + Math.cos(a) * r2, oy + Math.sin(a) * r2 * 0.7); c.stroke(); }
          c.globalAlpha = 1;
          const g = c.createRadialGradient(ox, oy, 0, ox, oy, 170); g.addColorStop(0, sf.f.ch.col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = 0.5 + 0.2 * Math.sin(sf.t * 0.6); c.fillStyle = g; c.fillRect(ox - 170, oy - 170, 340, 340); c.globalAlpha = 1;
        }
      }
      if (beamer) this.drawBeam(c, beamer, cam);
      const order = f[0].state === 'atk' ? [f[1], f[0]] : [f[0], f[1]];
      order.forEach((x) => x.draw(c, cam, T));
      this.drawProjs(c, cam); this.drawFx(c, cam);
      this.stage.drawFront(c, cam);
      c.restore();
      if (!this.o.attract) {
        if (sf) this.drawBanner(c, sf);
        this.drawHud(c);
        if (this.msg) this.drawMsg(c);
      }
      if (this.white > 0) { c.fillStyle = 'rgba(255,255,255,' + this.white * 0.8 + ')'; c.fillRect(0, 0, W, G.H); }
    }
    drawBeam(c, f, cam) {
      const m = f.mvo, k = (f.t - m.su) / m.ac, x0 = f.x - cam + f.face * 58, col = f.ch.col, col2 = f.ch.col2;
      c.save(); c.globalCompositeOperation = 'lighter';
      if (m.erupt) {
        for (let i = 0; i < 6; i++) {
          const px = x0 + f.face * (30 + i * 100), kk = G.clamp(k * 7 - i * 0.6, 0, 1), fade = G.clamp((1 - k) * 4, 0, 1), hh = 250 * Math.sin(kk * Math.PI * 0.5) * (0.85 + 0.15 * Math.sin(f.t + i));
          if (kk <= 0) continue;
          const g = c.createLinearGradient(0, GY, 0, GY - hh); g.addColorStop(0, col2); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(255,80,20,0)');
          c.globalAlpha = fade; c.fillStyle = g; c.beginPath(); c.moveTo(px - 42, GY + 6); c.quadraticCurveTo(px - 16, GY - hh * 0.6, px + G.vrnd(-6, 6), GY - hh); c.quadraticCurveTo(px + 16, GY - hh * 0.6, px + 42, GY + 6); c.fill();
          c.fillStyle = '#fff'; c.globalAlpha = fade * 0.7; c.beginPath(); c.moveTo(px - 14, GY + 6); c.quadraticCurveTo(px, GY - hh * 0.5, px, GY - hh * 0.8); c.quadraticCurveTo(px, GY - hh * 0.5, px + 14, GY + 6); c.fill();
        }
      } else {
        const y = GY + f.y - 120, w = 900, grow = Math.min(1, k * 6), fade = G.clamp((1 - k) * 5, 0, 1), th = (46 + Math.sin(f.t * 1.3) * 7) * grow * (0.4 + 0.6 * fade);
        const xa = f.face > 0 ? x0 : x0 - w;
        let g = c.createLinearGradient(0, y - th * 1.6, 0, y + th * 1.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(xa, y - th * 1.6, w, th * 3.2);
        g = c.createLinearGradient(0, y - th * 0.7, 0, y + th * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(xa, y - th * 0.7, w, th * 1.4);
        const rg = c.createRadialGradient(x0, y, 0, x0, y, th * 2.2); rg.addColorStop(0, '#fff'); rg.addColorStop(0.4, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(x0 - th * 2.2, y - th * 2.2, th * 4.4, th * 4.4);
        c.strokeStyle = col2; c.lineWidth = 2;
        for (let i = 0; i < 7; i++) { const yy = y + Math.sin(f.t * 0.9 + i * 1.7) * th, xs = xa + ((f.t * 40 + i * 140) % w); c.beginPath(); c.moveTo(xs, yy); c.lineTo(xs + 70, yy); c.stroke(); }
      }
      c.restore();
    }
    drawProjs(c, cam) {
      for (const p of this.projs) {
        const x = p.x - cam, y = p.y, d = Math.sign(p.vx);
        c.save();
        if (p.type === 'quake') {
          for (let i = 0; i < 3; i++) { const px = x - d * i * 24, hh = 64 - i * 16 + Math.sin(p.t + i) * 5; c.fillStyle = i ? '#6d3a26' : '#8a4a30'; c.strokeStyle = '#1b1210'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(px - 18, GY + 4); c.lineTo(px - 5 + d * 6, GY - hh); c.lineTo(px + 8 + d * 10, GY - hh * 0.55); c.lineTo(px + 18, GY + 4); c.closePath(); c.fill(); c.stroke(); }
          c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, GY, 0, x, GY, 60); g.addColorStop(0, p.col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = 0.6; c.fillStyle = g; c.fillRect(x - 60, GY - 60, 120, 70);
        } else {
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(x, y, 0, x, y, p.r * 2.4); g.addColorStop(0, p.col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.globalAlpha = 0.8; c.fillRect(x - p.r * 2.4, y - p.r * 2.4, p.r * 4.8, p.r * 4.8); c.globalAlpha = 1;
          if (p.type === 'crescent') {
            c.translate(x, y); c.scale(d, 1); c.fillStyle = p.col; c.beginPath(); c.arc(-14, 0, 48, -1.15, 1.15); c.arc(-40, 0, 58, 0.82, -0.82, true); c.closePath(); c.fill();
            c.fillStyle = '#fff'; c.beginPath(); c.arc(-14, 0, 44, -0.9, 0.9); c.arc(-30, 0, 52, 0.7, -0.7, true); c.closePath(); c.fill();
          } else {
            c.fillStyle = p.col; c.beginPath(); c.arc(x, y, p.r + Math.sin(p.t * 0.8) * 3, 0, 7); c.fill();
            c.fillStyle = '#fff'; c.beginPath(); c.arc(x + d * 3, y, p.r * 0.55, 0, 7); c.fill();
            c.strokeStyle = p.col2; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = p.t * 0.5 + i * 2.1; c.beginPath(); c.arc(x, y, p.r + 8, a, a + 1); c.stroke(); }
          }
        }
        c.restore();
      }
    }
    drawFx(c, cam) {
      c.save();
      for (const p of this.parts) {
        const k = p.l / p.L, x = p.x - cam;
        if (p.k === 'puff') { c.globalCompositeOperation = 'source-over'; c.globalAlpha = k * 0.5; c.fillStyle = p.col; c.beginPath(); c.arc(x, p.y, p.r * (1.6 - k), 0, 7); c.fill(); }
        else if (p.k === 'glow') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = k * 0.6; c.fillStyle = p.col; c.beginPath(); c.arc(x, p.y, p.r * k, 0, 7); c.fill(); }
        else { c.globalCompositeOperation = 'lighter'; c.globalAlpha = k; c.fillStyle = p.col; c.fillRect(x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
      }
      c.globalCompositeOperation = 'lighter';
      for (const e of this.fx) {
        const k = e.t / e.life, x = e.x - cam; c.globalAlpha = 1;
        if (e.k === 'spark') {
          c.strokeStyle = e.col; c.lineCap = 'round';
          for (let i = 0; i < 9; i++) { const a = e.a + i * 0.698, r1 = e.r * (0.25 + k * 0.6), r2 = e.r * (0.55 + k * 1.05) * (i % 2 ? 1 : 0.7); c.lineWidth = (1 - k) * 7 + 0.5; c.beginPath(); c.moveTo(x + Math.cos(a) * r1, e.y + Math.sin(a) * r1); c.lineTo(x + Math.cos(a) * r2, e.y + Math.sin(a) * r2); c.stroke(); }
          c.lineCap = 'butt';
          if (k < 0.5) { c.fillStyle = '#fff'; c.globalAlpha = 1 - k * 2; star(c, x, e.y, e.r * (0.5 + k)); }
          c.globalAlpha = (1 - k) * 0.8; c.strokeStyle = '#fff'; c.lineWidth = 3 * (1 - k); c.beginPath(); c.arc(x, e.y, e.r * (0.3 + k * 1.1), 0, 7); c.stroke();
        } else if (e.k === 'guard') {
          c.strokeStyle = e.col; c.lineWidth = 4 * (1 - k); c.beginPath(); c.arc(x, e.y, e.r * (0.4 + k * 0.8), 0, 7); c.stroke();
          c.fillStyle = '#fff'; c.globalAlpha = 1 - k; for (let i = 0; i < 4; i++) { const a = e.a + i * 1.57; c.fillRect(x + Math.cos(a) * e.r * k - 2, e.y + Math.sin(a) * e.r * k - 2, 4, 4); }
        } else if (e.k === 'ring') {
          c.globalAlpha = 1 - k; c.strokeStyle = e.col; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.ellipse(x, e.y, e.r * (0.2 + k), e.r * (0.2 + k) * 0.45, 0, 0, 7); c.stroke();
        } else if (e.k === 'slash') {
          c.save(); c.translate(x, e.y); c.rotate(e.a); c.globalAlpha = 1 - k; c.fillStyle = e.col; const L = e.r * (0.6 + k * 0.8);
          c.beginPath(); c.moveTo(-L, 0); c.quadraticCurveTo(0, -9 * (1 - k), L, 0); c.quadraticCurveTo(0, 9 * (1 - k), -L, 0); c.fill();
          c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-L * 0.8, 0); c.quadraticCurveTo(0, -3, L * 0.8, 0); c.quadraticCurveTo(0, 3, -L * 0.8, 0); c.fill(); c.restore();
        } else if (e.k === 'arc') {
          c.save(); c.translate(x, e.y); c.scale(e.f, e.low ? 0.35 : 1); c.globalAlpha = (1 - k) * 0.75; c.fillStyle = e.col;
          const a0 = e.up ? 0.9 - k : -1.25 + k * 0.5, a1 = e.up ? -1.1 : 1.0, ccw = !!e.up;
          c.beginPath(); c.arc(-e.r * 0.5, 0, e.r * 1.25, a0, a1, ccw); c.arc(-e.r * 0.72, 0, e.r * 1.18, a1, a0, !ccw); c.closePath(); c.fill(); c.restore();
        }
      }
      c.restore();
    }
    drawBanner(c, sf) {
      const k = Math.min(1, sf.t / 8), out = Math.max(0, (sf.t - (FLASH - 6)) / 6), f = sf.f, left = f.idx === 0;
      c.save(); c.globalAlpha = 1 - out;
      const y = 250, h = 62, w = 660 * k, x = left ? 0 : W - w;
      c.fillStyle = 'rgba(10,6,12,.86)'; c.beginPath();
      if (left) { c.moveTo(0, y); c.lineTo(w, y); c.lineTo(w - 40, y + h); c.lineTo(0, y + h); } else { c.moveTo(W, y); c.lineTo(x, y); c.lineTo(x + 40, y + h); c.lineTo(W, y + h); }
      c.fill(); c.fillStyle = f.ch.col; c.fillRect(left ? 0 : x + 40, y + h, w - 40, 5);
      c.font = '26px Shojumaru, Oswald, sans-serif'; c.textBaseline = 'middle'; c.textAlign = left ? 'left' : 'right';
      c.fillStyle = '#fff'; c.shadowColor = f.ch.col; c.shadowBlur = 16; c.fillText(f.ch.suName, left ? 28 - (1 - k) * 200 : W - 28 + (1 - k) * 200, y + h / 2 + 2); c.shadowBlur = 0;
      c.font = '700 13px Oswald, sans-serif'; c.fillStyle = f.ch.col; c.fillText('ATTAQUE ULTIME', left ? 30 : W - 30, y - 12);
      c.restore();
    }
    drawHud(c) {
      const f = this.f, T = this.tick;
      c.save(); c.textBaseline = 'middle';
      for (let i = 0; i < 2; i++) {
        const x = f[i], L = i === 0, bw = 372, bx = L ? 46 : W - 46 - bw, by = 30, bh = 22, sk = 10;
        const para = (x0, y0, w, h) => { c.beginPath(); c.moveTo(x0 + (L ? 0 : sk), y0); c.lineTo(x0 + w + (L ? 0 : sk) - 0, y0); c.lineTo(x0 + w - (L ? sk : 0), y0 + h); c.lineTo(x0 - (L ? sk : 0) + (L ? 0 : 0), y0 + h); c.closePath(); };
        // cadre
        c.fillStyle = 'rgba(12,6,10,.82)'; para(bx - 4, by - 4, bw + 8, bh + 8); c.fill();
        c.fillStyle = '#3b1c1c'; para(bx, by, bw, bh); c.fill();
        const rk = G.clamp(x.red / x.ch.hp, 0, 1), hk = G.clamp(x.hp / x.ch.hp, 0, 1);
        c.save(); para(bx, by, bw, bh); c.clip();
        c.fillStyle = '#e63b2e'; if (L) c.fillRect(bx + bw * (1 - rk) - sk, by, bw * rk + sk, bh); else c.fillRect(bx, by, bw * rk + sk, bh);
        const g = c.createLinearGradient(0, by, 0, by + bh); const lowHp = hk < 0.25 && T % 20 < 10;
        g.addColorStop(0, lowHp ? '#ffb199' : '#fff1a8'); g.addColorStop(0.45, lowHp ? '#ff6a3d' : '#ffc93c'); g.addColorStop(1, lowHp ? '#c9301c' : '#f08a1d');
        c.fillStyle = g; if (L) c.fillRect(bx + bw * (1 - hk) - sk, by, bw * hk + sk, bh); else c.fillRect(bx, by, bw * hk + sk, bh);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(bx - sk, by + 2, bw + sk * 2, 3);
        c.restore();
        // énergie (garde / coups spéciaux)
        const ew = 250, ex = L ? bx + bw - ew - 14 : bx + 14, ey = by + bh + 9, ek = x.en / 100;
        c.fillStyle = 'rgba(12,6,10,.82)'; para(ex - 3, ey - 3, ew + 6, 13); c.fill();
        c.fillStyle = x.state === 'dizzy' ? '#ff4b2b' : ek < 0.3 ? '#ff8f3c' : '#39d6ff';
        c.save(); para(ex, ey, ew, 7); c.clip(); if (L) c.fillRect(ex + ew * (1 - ek) - sk, ey, ew * ek + sk, 7); else c.fillRect(ex, ey, ew * ek + sk, 7); c.restore();
        // nom + manches gagnées
        c.font = '15px Shojumaru, Oswald, sans-serif'; c.textAlign = L ? 'left' : 'right'; c.lineWidth = 4; c.strokeStyle = '#140a0c'; c.fillStyle = '#fff';
        const nx = L ? bx - 4 : bx + bw + 4; c.strokeText(this.names[i], nx, by + bh + 16); c.fillText(this.names[i], nx, by + bh + 16);
        for (let r = 0; r < this.need; r++) { const px = L ? bx + bw - 10 - r * 20 : bx + 10 + r * 20, py = by - 13; c.save(); c.translate(px, py); c.rotate(Math.PI / 4); c.fillStyle = '#140a0c'; c.fillRect(-7, -7, 14, 14); c.fillStyle = r < this.wins[i] ? x.ch.col : '#4a3434'; c.fillRect(-5, -5, 10, 10); c.restore(); }
        // jauge ultime
        const sw = 210, sx = L ? 36 : W - 36 - sw, sy = G.H - 30, sk2 = x.sup / 100, full = x.sup >= 100;
        c.fillStyle = 'rgba(12,6,10,.82)'; c.fillRect(sx - 4, sy - 4, sw + 8, 18);
        c.fillStyle = '#2a1a22'; c.fillRect(sx, sy, sw, 10);
        c.fillStyle = full ? (T % 10 < 5 ? '#fff' : x.ch.col) : x.ch.col; if (L) c.fillRect(sx, sy, sw * sk2, 10); else c.fillRect(sx + sw * (1 - sk2), sy, sw * sk2, 10);
        c.font = '700 12px Oswald, sans-serif'; c.textAlign = L ? 'left' : 'right'; c.fillStyle = full ? '#fff' : 'rgba(255,255,255,.7)';
        c.strokeStyle = '#140a0c'; c.lineWidth = 3; c.strokeText(full ? 'ULTIME PRÊT !' : 'ULTIME', L ? sx : sx + sw, sy - 13); c.fillText(full ? 'ULTIME PRÊT !' : 'ULTIME', L ? sx : sx + sw, sy - 13);
        // compteur d'enchaînement
        if (x.cbShow > 0 && x.cbN > 1) {
          const a = Math.min(1, x.cbShow / 12), pop = 1 + Math.max(0, (x.cbShow - 62) / 20);
          c.save(); c.globalAlpha = a; c.translate(L ? 70 : W - 70, 150); c.scale(pop, pop); c.textAlign = L ? 'left' : 'right';
          c.font = '38px Shojumaru, Oswald, sans-serif'; c.lineWidth = 6; c.strokeStyle = '#140a0c'; c.fillStyle = x.ch.col; c.strokeText(x.cbN, 0, 0); c.fillText(x.cbN, 0, 0);
          c.font = '700 16px Oswald, sans-serif'; c.fillStyle = '#fff'; c.strokeText('COUPS', 0, 30); c.fillText('COUPS', 0, 30); c.restore();
        }
      }
      // chrono
      c.textAlign = 'center'; c.fillStyle = 'rgba(12,6,10,.86)'; c.beginPath(); c.moveTo(480, 12); c.lineTo(516, 42); c.lineTo(480, 72); c.lineTo(444, 42); c.closePath(); c.fill();
      c.strokeStyle = '#f2b33d'; c.lineWidth = 2; c.stroke();
      c.font = '700 30px Oswald, sans-serif'; c.fillStyle = this.timer <= 10 ? '#ff5a3c' : '#fff'; c.fillText(String(Math.max(0, this.timer)).padStart(2, '0'), 480, 44);
      c.restore();
    }
    drawMsg(c) {
      const m = this.msg, k = m.t / m.life, inn = Math.min(1, m.t / 7), out = k > 0.85 ? (1 - k) / 0.15 : 1;
      c.save(); c.translate(W / 2, 228); const s = m.scale * (2.2 - 1.2 * (1 - Math.pow(1 - inn, 3))); c.scale(s, s); c.globalAlpha = Math.min(inn, out);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(10,6,12,.55)'; c.beginPath(); c.moveTo(-340, -34); c.lineTo(340, -40); c.lineTo(320, 36); c.lineTo(-330, 42); c.closePath(); c.fill();
      c.font = '52px Shojumaru, Oswald, sans-serif'; c.lineWidth = 8; c.strokeStyle = '#140a0c'; c.lineJoin = 'round'; c.strokeText(m.text, 0, 0);
      const g = c.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#ffb52e'); g.addColorStop(1, '#ff5a1f'); c.fillStyle = g; c.fillText(m.text, 0, 0);
      if (m.sub) { c.font = '700 22px Oswald, sans-serif'; c.fillStyle = '#fff'; c.lineWidth = 5; c.strokeText(m.sub, 0, 58); c.fillText(m.sub, 0, 58); }
      c.restore();
    }
  }
  G.Match = Match; G.Fighter = Fighter;
})();
