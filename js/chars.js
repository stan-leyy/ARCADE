/* ARCADE — personnages : fiches, poses (squelette + cinématique inverse) et dessin vectoriel */
(function () {
  const G = window.G, DEG = Math.PI / 180;
  const INK = '#1b1210';
  const THIGH = 55, SHIN = 53, TORSO = 60, UARM = 34, FARM = 32, HIP = 105;

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  /* ---------- Poses ---------- */
  const P = (o) => Object.assign({ lean: 0, hx: 0, hy: 0, hd: 0, fh: [30, -4], bh: [18, 8], ff: [24, 0], bf: [-24, 0], rot: 0, oy: 0, ex: 0, sw: -65 }, o);
  const POSES = {
    idle: P({ lean: 7, hy: 4, fh: [32, -6], bh: [20, 6], ff: [22, 0], bf: [-22, 0] }),
    crouch: P({ lean: 16, hy: 44, hd: -6, fh: [30, 0], bh: [18, 10], ff: [30, 0], bf: [-26, 0] }),
    jumpUp: P({ lean: 4, fh: [22, -30], bh: [-14, -22], ff: [14, -34], bf: [-14, -22] }),
    jumpDn: P({ lean: 2, fh: [28, -16], bh: [-22, -26], ff: [20, -10], bf: [-18, -26] }),
    dash: P({ lean: 26, hx: 10, hy: 14, fh: [-18, 22], bh: [-30, 14], ff: [34, 0], bf: [-36, -6] }),
    back: P({ lean: -10, hx: -6, hy: 10, fh: [30, -4], bh: [18, 8], ff: [10, -10], bf: [-30, 0] }),
    block: P({ lean: -3, hx: -4, hy: 12, hd: -4, fh: [24, -16], bh: [28, -2], ff: [22, 0], bf: [-26, 0] }),
    cblock: P({ lean: 10, hx: -4, hy: 44, hd: -4, fh: [24, -14], bh: [28, 0], ff: [28, 0], bf: [-26, 0] }),
    hit1: P({ lean: -20, hx: -8, hy: 6, hd: -14, fh: [4, 10], bh: [-22, 16], ff: [20, 0], bf: [-30, 0] }),
    hit2: P({ lean: 24, hx: -6, hy: 14, hd: 10, fh: [14, 26], bh: [4, 28], ff: [18, 0], bf: [-28, 0] }),
    air: P({ lean: -30, hd: -16, fh: [-20, -20], bh: [-34, -6], ff: [30, -30], bf: [4, -36], rot: -35 }),
    down: P({ lean: 0, fh: [10, 30], bh: [-10, 30], ff: [10, 0], bf: [-12, 0], rot: -90, oy: -16 }),
    getup: P({ lean: 30, hy: 48, fh: [26, 36], bh: [10, 40], ff: [26, 0], bf: [-26, 0] }),
    win: P({ lean: -2, hy: 2, hd: -6, fh: [14, -62], bh: [-12, 26], ff: [18, 0], bf: [-20, 0], sw: -90 }),
    dizzy: P({ lean: 14, hy: 16, hd: 14, fh: [10, 36], bh: [-6, 38], ff: [20, 0], bf: [-22, 0], sw: 60 }),
    intro: P({ lean: 0, hy: 2, fh: [4, 16], bh: [14, 18], ff: [16, 0], bf: [-18, 0], sw: 70 }),
    jabW: P({ lean: 4, hy: 8, fh: [14, 2], bh: [20, 6] }),
    jab: P({ lean: 12, hx: 8, hy: 8, fh: [66, -4], bh: [14, 10], ff: [30, 0], ex: 1 }),
    hvW: P({ lean: -6, hx: -6, hy: 12, fh: [28, 0], bh: [-26, 6], ff: [22, 0], bf: [-28, 0] }),
    hv: P({ lean: 22, hx: 18, hy: 12, fh: [4, 14], bh: [70, -10], ff: [42, 0], bf: [-26, 0], ex: 1 }),
    kickW: P({ lean: -6, hx: -4, hy: 6, fh: [20, 0], bh: [-10, 8], ff: [14, -46], bf: [-16, 0] }),
    kick: P({ lean: -24, hx: -6, hy: 4, fh: [6, 8], bh: [-26, 2], ff: [92, -104], bf: [-14, 0] }),
    sweep: P({ lean: -22, hx: -8, hy: 50, fh: [-10, 30], bh: [-30, 26], ff: [96, -4], bf: [-20, 0] }),
    airK: P({ lean: 14, fh: [20, -10], bh: [-24, -20], ff: [72, -22], bf: [-22, -52] }),
    castW: P({ lean: -8, hx: -8, hy: 14, fh: [-10, 10], bh: [-20, 12], ff: [24, 0], bf: [-30, 0], sw: -150 }),
    cast: P({ lean: 16, hx: 12, hy: 14, fh: [62, -2], bh: [66, 6], ff: [40, 0], bf: [-30, 0], ex: 1, sw: 10 }),
    upW: P({ lean: 18, hy: 40, fh: [16, 30], bh: [10, 20], ff: [28, 0], bf: [-24, 0] }),
    upper: P({ lean: -8, fh: [20, -64], bh: [-10, 20], ff: [22, -30], bf: [-10, -4], ex: 1, sw: -90 }),
    rush: P({ lean: 30, hx: 16, hy: 16, fh: [64, -2], bh: [-30, 10], ff: [40, 0], bf: [-40, -4], ex: 1, sw: 0 }),
    flurB: P({ lean: 14, hx: 10, hy: 10, fh: [20, 4], bh: [70, -2], ff: [32, 0], ex: 1, sw: -30 }),
    stompW: P({ lean: -10, hy: 4, fh: [0, -50], bh: [-10, -50], ff: [20, -50], bf: [-20, 0] }),
    stomp: P({ lean: 20, hy: 30, fh: [30, 30], bh: [10, 34], ff: [36, 0], bf: [-30, 0] }),
    charge: P({ lean: -4, hy: 20, hd: -8, fh: [16, 26], bh: [-16, 26], ff: [30, 0], bf: [-30, 0], sw: -100 }),
    /* escrime (Sable) */
    sIdle: P({ lean: 7, hy: 5, fh: [26, 10], bh: [10, 14], ff: [22, 0], bf: [-22, 0], sw: -62 }),
    sJabW: P({ lean: 0, hy: 8, fh: [0, -30], bh: [10, 12], sw: -135 }),
    sJab: P({ lean: 14, hx: 8, hy: 10, fh: [56, 4], bh: [-10, 14], ff: [32, 0], sw: 18 }),
    sHvW: P({ lean: -8, hx: -6, hy: 8, fh: [-6, -56], bh: [-14, -40], sw: -115 }),
    sHv: P({ lean: 24, hx: 16, hy: 18, fh: [54, 24], bh: [34, 26], ff: [44, 0], sw: 48 }),
  };
  G.POSES = POSES;
  G.poseLerp = function (a, b, t) {
    for (const k in b) {
      const v = b[k];
      if (typeof v === 'number') a[k] += (v - a[k]) * t;
      else { a[k][0] += (v[0] - a[k][0]) * t; a[k][1] += (v[1] - a[k][1]) * t; }
    }
  };
  G.poseClone = (p) => { const o = {}; for (const k in p) o[k] = typeof p[k] === 'number' ? p[k] : [p[k][0], p[k][1]]; return o; };

  /* ---------- Fiches personnages (créations originales) ---------- */
  G.CHARS = [
    { id: 'bakari', name: 'BAKARI', title: 'Le Poing du Tonnerre', role: 'Héros', hp: 1000, speed: 1, power: 1, bulk: 1,
      col: '#ffd23f', col2: '#fff6c9', spName: 'Orbe Tonnerre', suName: 'TONNERRE CÉLESTE', sp: 'proj', su: 'beam',
      look: { skin: '#7a4a32', top: 'vest', topCol: '#f1ede4', pants: '#3a3a40', sash: '#6f7a45', hair: 'afro', hairCol: '#1e1a22', beard: 1, gold: 1, band: '#6f7a45', feet: 'sandal' } },
    { id: 'malik', name: 'MALIK', title: 'Le Vent Tranquille', role: 'Héros', hp: 950, speed: 1.12, power: 0.95, bulk: 0.96,
      col: '#ff9f1c', col2: '#ffe2a8', spName: 'Croc du Désert', suName: 'DANSE DU SIROCCO', sp: 'upper', su: 'rush',
      look: { skin: '#6b3f2a', top: 'tank', topCol: '#f4f1ea', pants: '#d6a53a', sash: '#4a3a2c', hair: 'short', hairCol: '#16131a', glasses: 1, stache: 1, feet: 'sandal' } },
    { id: 'devan', name: 'DEVAN', title: 'Les Quatre Paumes', role: 'Héros', hp: 980, speed: 1, power: 1, bulk: 1,
      col: '#35d0ba', col2: '#d6fff6', spName: 'Mille Paumes', suName: 'LOTUS AUX QUATRE BRAS', sp: 'flurry', su: 'rush',
      look: { skin: '#b9774f', top: 'wrap', topCol: '#f1cf7a', pants: '#f1cf7a', sash: '#e2562a', hair: 'long', hairCol: '#15151c', gold: 1, arms4: 1, feet: 'bare', cloth: '#2fae9b' } },
    { id: 'sable', name: 'SABLE', title: 'La Lame d’Émeraude', role: 'Rival', hp: 920, speed: 1.05, power: 1.08, bulk: 0.95,
      col: '#7dff3a', col2: '#e6ffd0', spName: 'Croissant Vert', suName: 'MILLE LAMES D’ÉMERAUDE', sp: 'slash', su: 'rush', sword: 1,
      poses: { idle: 'sIdle', jabW: 'sJabW', jab: 'sJab', hvW: 'sHvW', hv: 'sHv' },
      look: { skin: '#6a4630', top: 'coat', topCol: '#1c1a1c', pants: '#201d1f', sash: '#efe9dc', hair: 'buzz', hairCol: '#18151a', beard: 1, ring: 1, feet: 'boot' } },
    { id: 'braza', name: 'BRAZA', title: 'La Braise Écarlate', role: 'Rival', hp: 1000, speed: 1.06, power: 1.05, bulk: 1,
      col: '#ff4b2b', col2: '#ffd0a0', spName: 'Charge Écarlate', suName: 'BRASIER ÉCARLATE', sp: 'rush', su: 'beam',
      look: { skin: '#e9b99a', top: 'bare', topCol: '#e9b99a', pants: '#2c2f3d', sash: '#e39a2b', hair: 'spiky', hairCol: '#d81f26', scars: 1, wraps: 1, torn: 1, feet: 'sandal' } },
    { id: 'tembo', name: 'TEMBO', title: 'Le Vieux Maître', role: 'Boss', hp: 1120, speed: 0.88, power: 1.15, bulk: 1.14,
      col: '#ff7b54', col2: '#ffe0c2', spName: 'Séisme', suName: 'COLÈRE DE LA MONTAGNE', sp: 'quake', su: 'erupt',
      look: { skin: '#a8683f', top: 'bare', topCol: '#a8683f', pants: '#f3f0ea', sash: '#b3332b', hair: 'elder', hairCol: '#f4f4f0', feet: 'bare' } },
  ];
  G.charById = (id) => G.CHARS.find((c) => c.id === id) || G.CHARS[0];

  /* ---------- Géométrie ---------- */
  function ik(ax, ay, tx, ty, l1, l2, dir) {
    let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.001;
    const max = l1 + l2 - 0.5, min = Math.abs(l1 - l2) + 2;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    if (d < min) { dx *= min / d; dy *= min / d; d = min; }
    const a = Math.atan2(dy, dx), A = Math.acos(G.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const ja = a + dir * A;
    return [ax + Math.cos(ja) * l1, ay + Math.sin(ja) * l1, ax + dx, ay + dy];
  }
  let MONO = null; // couleur unique (flash blanc, images rémanentes)
  function limb(c, x1, y1, x2, y2, w1, w2, col, noShade) {
    const a = Math.atan2(y2 - y1, x2 - x1), nx = Math.sin(a), ny = -Math.cos(a), h1 = w1 / 2, h2 = w2 / 2;
    c.beginPath();
    c.moveTo(x1 + nx * h1, y1 + ny * h1); c.lineTo(x2 + nx * h2, y2 + ny * h2);
    c.arc(x2, y2, h2, a - Math.PI / 2, a + Math.PI / 2);
    c.lineTo(x1 - nx * h1, y1 - ny * h1); c.arc(x1, y1, h1, a + Math.PI / 2, a + Math.PI * 1.5);
    c.closePath();
    c.fillStyle = MONO || col; c.fill();
    if (!MONO) {
      c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke();
      if (!noShade) {
        const o1 = h1 * 0.5, o2 = h2 * 0.5;
        c.beginPath();
        c.moveTo(x1 - nx * o1 * 0.2, y1 - ny * o1 * 0.2); c.lineTo(x2 - nx * o2 * 0.2, y2 - ny * o2 * 0.2);
        c.lineTo(x2 - nx * (h2 - 1.6), y2 - ny * (h2 - 1.6)); c.lineTo(x1 - nx * (h1 - 1.6), y1 - ny * (h1 - 1.6));
        c.closePath(); c.fillStyle = 'rgba(20,8,12,0.22)'; c.fill();
      }
    }
  }
  function disc(c, x, y, r, col, lw) {
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = MONO || col; c.fill();
    if (!MONO && lw !== 0) { c.lineWidth = lw || 2.4; c.strokeStyle = INK; c.stroke(); }
  }
  function poly(c, pts, col, lw) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fillStyle = MONO || col; c.fill();
    if (!MONO && lw !== 0) { c.lineWidth = lw || 2.4; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); }
  }
  function ribbon(c, x, y, len, sway, w, col) { // bande de tissu qui flotte
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + sway * 0.5, y + len * 0.5, x + sway, y + len);
    c.lineCap = 'round';
    if (!MONO) { c.strokeStyle = INK; c.lineWidth = w + 4; c.stroke(); }
    c.strokeStyle = MONO || col; c.lineWidth = w; c.stroke(); c.lineCap = 'butt';
  }

  /* ---------- Dessin d'un combattant (origine = sol, regard vers +x) ---------- */
  G.drawFighter = function (c, ch, p, time, opt) {
    opt = opt || {};
    MONO = opt.mono || null;
    const L = ch.look, B = ch.bulk || 1, vx = opt.vx || 0;
    const sway = Math.sin(time * 0.09) * 3 - vx * 1.6;
    c.save();
    if (p.rot || p.oy) { c.translate(0, p.oy); c.rotate(p.rot * DEG); }
    const la = p.lean * DEG, hipX = p.hx, hipY = -(HIP - p.hy);
    const shX = hipX + Math.sin(la) * TORSO, shY = hipY - Math.cos(la) * TORSO;
    const ha = la * 0.6 + p.hd * DEG, hX = shX + Math.sin(ha) * 25, hY = shY - Math.cos(ha) * 25;
    const fS = [shX + 6, shY + 7], bS = [shX - 8, shY + 6];
    const fArm = ik(fS[0], fS[1], fS[0] + p.fh[0], fS[1] + p.fh[1], UARM, FARM, 1);
    const bArm = ik(bS[0], bS[1], bS[0] + p.bh[0], bS[1] + p.bh[1], UARM, FARM, 1);
    const fLeg = ik(hipX + 5, hipY, p.ff[0], p.ff[1] - 7, THIGH, SHIN, -1);
    const bLeg = ik(hipX - 6, hipY, p.bf[0], p.bf[1] - 7, THIGH, SHIN, -1);
    const skin = L.skin, skinD = shade(L.skin, 0.8);

    function arm(S, A, back, y2) {
      const sk = back ? skinD : skin, sleeve = L.top === 'coat';
      const sy = y2 || 0;
      limb(c, S[0], S[1] + sy, A[0], A[1], 19 * B, 16 * B, sleeve ? L.topCol : sk);
      limb(c, A[0], A[1], A[2], A[3], 16 * B, 12 * B, sleeve ? '#2b2a30' : sk);
      disc(c, S[0], S[1] + sy, 10.5 * B, sleeve ? L.topCol : sk);
      const wx = G.lerp(A[0], A[2], 0.78), wy = G.lerp(A[1], A[3], 0.78);
      if (L.gold) limb(c, wx, wy, G.lerp(A[0], A[2], 0.93), G.lerp(A[1], A[3], 0.93), 14 * B, 13 * B, '#e8b63c', 1);
      if (L.wraps) limb(c, G.lerp(A[0], A[2], 0.5), G.lerp(A[1], A[3], 0.5), A[2], A[3], 15 * B, 13 * B, '#ece3d2', 1);
      if (sleeve && !back && !MONO) { disc(c, G.lerp(S[0], A[0], 0.45), G.lerp(S[1], A[1], 0.45), 6, '#e8b63c', 1.6); }
      disc(c, A[2], A[3], 8.6 * B, L.wraps ? '#ece3d2' : sk);
    }
    function leg(K, back, hx) {
      const pc = back ? shade(L.pants, 0.78) : L.pants;
      const ang = Math.atan2(K[3] - K[1], K[2] - K[0]);
      const grounded = K[3] > -12 && !p.rot;
      const fa = grounded ? 0 : ang - Math.PI / 2;
      const fx = K[2] + Math.cos(fa) * 17, fy = K[3] + Math.sin(fa) * 17 + (grounded ? 3 : 0);
      // pied
      if (L.feet === 'boot') limb(c, K[2], K[3] + 2, fx, fy, 13, 10, '#3a3d44');
      else {
        limb(c, K[2], K[3] + 2, fx, fy, 12, 9, back ? skinD : skin);
        if (L.feet === 'sandal' && !MONO) { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(K[2] - 5, K[3] + 8.5); c.lineTo(fx + 4, fy + 5.5); c.stroke(); }
      }
      const cut = L.torn ? 0.62 : 1;
      if (cut < 1) { limb(c, K[0], K[1], K[2], K[3], 15 * B, 12 * B, back ? skinD : skin); limb(c, G.lerp(K[0], K[2], 0.6), G.lerp(K[1], K[3], 0.6), K[2], K[3], 14 * B, 12.5 * B, '#ece3d2', 1); }
      limb(c, K[0], K[1], G.lerp(K[0], K[2], cut), G.lerp(K[1], K[3], cut), 25 * B, (cut < 1 ? 23 : 17) * B, pc);
      limb(c, hx, hipY, K[0], K[1], 28 * B, 25 * B, pc);
      if (cut === 1 && L.feet !== 'boot') limb(c, G.lerp(K[0], K[2], 0.84), G.lerp(K[1], K[3], 0.84), K[2], K[3], 15 * B, 13 * B, L.id === 'x' ? pc : (L.gold && L.arms4 ? '#e8963c' : shade(L.pants, 0.55)), 1);
      if (L.feet === 'boot') limb(c, G.lerp(K[0], K[2], 0.7), G.lerp(K[1], K[3], 0.7), K[2], K[3], 17, 15, '#3a3d44', 1);
    }

    /* cheveux / tissu derrière */
    if (L.hair === 'long') {
      poly(c, [hX - 4, hY - 17, hX - 17, hY - 10, hX - 20 + sway * 0.6, hY + 34, hX - 28 + sway * 1.6, hY + 78, hX - 12 + sway * 1.2, hY + 80, hX - 4, hY + 30, hX + 2, hY - 6], L.hairCol);
    }
    if (L.hair === 'elder') {
      poly(c, [hX + 6, hY - 19, hX - 12, hY - 20, hX - 22, hY - 8, hX - 26 + sway * 0.5, hY + 18, hX - 20 + sway, hY + 34, hX - 8, hY + 22, hX - 2, hY], L.hairCol);
    }
    if (L.band) { ribbon(c, hX - 15, hY - 8, 30, -22 + sway * 2.2, 5, L.band); ribbon(c, hX - 15, hY - 6, 24, -14 + sway * 2.6, 5, shade(L.band, 0.8)); }
    if (L.top === 'coat') {
      poly(c, [hipX - 18, hipY - 30, hipX - 30 + sway * 1.2, hipY + 40, hipX - 22 + sway * 2, hipY + 74, hipX - 2 + sway, hipY + 62, hipX + 4, hipY], L.topCol);
    }
    /* bras arrière */
    if (L.arms4) {
      const t2 = [G.lerp(-10, p.bh[0] - 8, p.ex), G.lerp(-56, p.bh[1] + 22, p.ex)];
      arm([bS[0], bS[1] + 12], ik(bS[0], bS[1] + 12, bS[0] + t2[0], bS[1] + 12 + t2[1], UARM, FARM, p.ex > 0.5 ? 1 : -1), true);
    }
    arm(bS, bArm, true);
    leg(bLeg, true, hipX - 6);
    /* torse */
    const wA = 34 * B, wB = 49 * B;
    const tcol = L.top === 'bare' || L.top === 'tank' || L.top === 'coat' ? skin : L.topCol;
    limb(c, hipX, hipY + 3, shX, shY + 9, wA, wB, tcol);
    if (!MONO) {
      const ux = Math.sin(la), uy = -Math.cos(la), px = Math.cos(la), py = Math.sin(la); // u = le long du torse, p = vers l'avant
      const at = (u, f) => [hipX + ux * u + px * f, hipY + 3 + uy * u + py * f];
      if (L.top === 'bare' || L.top === 'coat') {
        c.strokeStyle = 'rgba(30,10,10,0.55)'; c.lineWidth = 2; c.beginPath();
        let a = at(40, -4), b = at(36, 12), d = at(44, 22); c.moveTo(a[0], a[1]); c.quadraticCurveTo(b[0], b[1], d[0], d[1]);
        for (const u of [12, 22, 31]) { a = at(u, 4); b = at(u, 17); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
        a = at(8, 10); b = at(38, 10); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        if (L.scars) { c.strokeStyle = '#b5423c'; c.lineWidth = 1.8; c.beginPath(); for (const s of [[44, 2, 36, 14], [26, -8, 18, 6], [34, 16, 28, 22], [14, 8, 10, 18]]) { a = at(s[0], s[1]); b = at(s[2], s[3]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); } c.stroke(); }
      }
      if (L.top === 'coat') { poly(c, [].concat(at(58, -24), at(60, -6), at(30, -8), at(0, -4), at(-2, -18)), L.topCol); const e = at(46, -14); disc(c, e[0], e[1], 5, '#e8b63c', 1.5); }
      if (L.top === 'tank') { poly(c, [].concat(at(-2, -17), at(-2, 17), at(40, 22), at(56, 14), at(46, 4), at(56, -8), at(42, -22)), L.topCol); }
      if (L.top === 'wrap') { poly(c, [].concat(at(58, 2), at(54, 14), at(22, 12)), skin, 2); }
      if (L.top === 'vest') {
        poly(c, [].concat(at(60, -12), at(74, -8), at(72, 6), at(58, 8)), L.topCol); // col montant
        c.strokeStyle = 'rgba(30,20,20,0.45)'; c.lineWidth = 2; c.beginPath(); let a = at(56, 8), b = at(2, 8); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        if (L.gold) { c.strokeStyle = '#e8b63c'; c.lineWidth = 3; c.beginPath(); a = at(56, 2); b = at(30, 22); const d = at(34, 4); c.moveTo(a[0], a[1]); c.quadraticCurveTo(d[0], d[1], b[0], b[1]); c.stroke(); disc(c, b[0], b[1], 5, '#e8b63c', 1.5); }
      }
    }
    /* jambe avant + ceinture */
    leg(fLeg, false, hipX + 5);
    const bx = Math.cos(la) * 17 * B, by = Math.sin(la) * 17 * B;
    limb(c, hipX - bx, hipY - 3 - by, hipX + bx, hipY - 3 + by, 13, 13, L.sash, 1);
    ribbon(c, hipX + bx * 0.5, hipY + 2, 44, sway * 2.2 - 4, 9, L.sash);
    ribbon(c, hipX + bx * 0.2, hipY + 2, 36, sway * 2.8 - 9, 8, shade(L.sash, 0.82));
    if (L.cloth) poly(c, [hipX + 2, hipY + 2, hipX + 18, hipY + 2, hipX + 20 + sway, hipY + 46, hipX + 4 + sway, hipY + 50], L.cloth);
    /* tête */
    limb(c, shX, shY + 4, hX, hY + 6, 14 * B, 13 * B, skin);
    if (L.hair === 'afro') {
      const blobs = [[-6, -16, 23], [9, -21, 17], [-21, -7, 15], [-15, -29, 15], [4, -33, 14], [19, -13, 9], [-26, -20, 10]];
      if (!MONO) { c.fillStyle = INK; for (const b of blobs) { c.beginPath(); c.arc(hX + b[0], hY + b[1], b[2] + 2.4, 0, 7); c.fill(); } }
      c.fillStyle = MONO || L.hairCol; for (const b of blobs) { c.beginPath(); c.arc(hX + b[0], hY + b[1], b[2], 0, 7); c.fill(); }
    }
    c.save(); c.translate(hX, hY); c.rotate(ha * 0.7);
    c.beginPath(); c.ellipse(0, 0, 15.5, 17.5, 0, 0, 7); c.fillStyle = MONO || skin; c.fill();
    if (!MONO) {
      c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke();
      if (L.beard) { c.beginPath(); c.arc(0, 1, 13, 0.1, 2.3); c.lineWidth = 6.5; c.strokeStyle = L.hairCol; c.stroke(); }
      // visage
      c.strokeStyle = INK; c.lineWidth = 2.6; c.beginPath(); c.moveTo(3, -8); c.lineTo(13, -5); c.stroke();
      c.fillStyle = L.hair === 'long' ? INK : '#fff'; c.beginPath(); c.ellipse(8.5, -2.5, 3.2, 1.9, 0.2, 0, 7); c.fill();
      c.fillStyle = INK; c.beginPath(); c.arc(9.5, -2.4, 1.5, 0, 7); c.fill();
      c.lineWidth = 1.8; c.beginPath(); c.moveTo(15, 0); c.lineTo(16.5, 4); c.moveTo(8, 9); c.lineTo(13.5, 8.4); c.stroke();
      disc(c, -3, 2, 4, skinD, 1.6);
      if (L.ring || L.gold) { c.strokeStyle = '#e8b63c'; c.lineWidth = 2; c.beginPath(); c.arc(-3, 8, 3, 0, 7); c.stroke(); }
      if (L.stache) { c.strokeStyle = L.hairCol; c.lineWidth = 2.6; c.beginPath(); c.moveTo(8, 6); c.lineTo(15, 6.5); c.moveTo(9, 12); c.lineTo(12, 14); c.stroke(); }
      if (L.glasses) { disc(c, 9, -2.5, 6, '#0d0d10', 0); c.strokeStyle = '#e8b63c'; c.lineWidth = 1.8; c.beginPath(); c.arc(9, -2.5, 6, 0, 7); c.moveTo(3, -3); c.lineTo(-10, -4); c.stroke(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(7, -4.5, 1.6, 0, 7); c.fill(); }
      // coiffures
      if (L.hair === 'afro') {
        c.fillStyle = L.hairCol; c.beginPath(); c.arc(-1, -4, 16, Math.PI * 1.02, Math.PI * 1.86); c.fill();
        poly(c, [-16, -12, 15, -11, 16, -3, -16, -4], L.band, 2);
        poly(c, [5, -12.5, 16, -12, 16.5, -2.5, 5, -3], '#b9c0c4', 1.6);
        poly(c, [10.7, -10.5, 13.6, -7.4, 10.7, -4.4, 7.8, -7.4], '#59636b', 0);
      } else if (L.hair === 'buzz') {
        c.fillStyle = L.hairCol; c.beginPath(); c.arc(-1, -3, 16.4, Math.PI * 0.98, Math.PI * 1.8); c.fill();
        poly(c, [-8, -17, -12, -30, -4, -24, -1, -34, 4, -23, 9, -27, 7, -16], L.hairCol, 2);
      } else if (L.hair === 'short') {
        c.fillStyle = L.hairCol; c.beginPath(); c.arc(-1, -3, 16.6, Math.PI * 0.95, Math.PI * 1.84); c.fill();
        for (const b of [[-9, -15, 6], [-1, -18, 6.5], [7, -16, 5.5], [-14, -9, 5]]) disc(c, b[0], b[1], b[2], L.hairCol, 0);
      } else if (L.hair === 'spiky') {
        poly(c, [-17, 2, -22, -10, -30, -14, -20, -19, -25, -31, -13, -25, -10, -39, -2, -26, 8, -36, 9, -23, 20, -27, 15, -15, 22, -9, 12, -9, 4, -13, -6, -11, -14, -6], L.hairCol, 2.2);
      } else if (L.hair === 'elder') {
        poly(c, [-14, -8, -17, -18, -6, -24, 8, -22, 15, -12, 8, -14, 2, -9, -6, -12], L.hairCol, 2);
        poly(c, [0, 8, 16, 6, 18, 14, 10, 34, 0, 24, -6, 12], L.hairCol, 2);
        c.strokeStyle = L.hairCol; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(7, 6); c.quadraticCurveTo(14, 4, 20, 9); c.stroke(); c.lineCap = 'butt';
      } else if (L.hair === 'long') {
        c.fillStyle = L.hairCol; c.beginPath(); c.arc(-1, -3, 16.8, Math.PI * 0.9, Math.PI * 1.9); c.fill();
        poly(c, [12, -14, 17, -4, 15, 14, 11, 2, 9, -8], L.hairCol, 0);
      }
    }
    c.restore();
    /* bras avant (+ arme, + 2e paire) */
    if (L.arms4) {
      const t1 = [G.lerp(16, p.fh[0] - 4, p.ex), G.lerp(-58, p.fh[1] + 24, p.ex)];
      arm([fS[0], fS[1] + 12], ik(fS[0], fS[1] + 12, fS[0] + t1[0], fS[1] + 12 + t1[1], UARM, FARM, p.ex > 0.5 ? 1 : -1), false);
    }
    if (ch.sword) {
      const a = p.sw * DEG, hx2 = fArm[2], hy2 = fArm[3], cx = Math.cos(a), sy = Math.sin(a);
      if (!MONO) {
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(125,255,58,0.28)'; c.lineWidth = 13; c.beginPath(); c.moveTo(hx2 + cx * 12, hy2 + sy * 12); c.lineTo(hx2 + cx * 92, hy2 + sy * 92); c.stroke();
        c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(hx2 - cx * 16, hy2 - sy * 16); c.lineTo(hx2 + cx * 92, hy2 + sy * 92); c.stroke();
        c.strokeStyle = '#8dff4a'; c.lineWidth = 4; c.beginPath(); c.moveTo(hx2 + cx * 10, hy2 + sy * 10); c.lineTo(hx2 + cx * 91, hy2 + sy * 91); c.stroke();
        c.strokeStyle = '#eaffd8'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hx2 + cx * 12, hy2 + sy * 12); c.lineTo(hx2 + cx * 88, hy2 + sy * 88); c.stroke();
        c.strokeStyle = '#2f6b2a'; c.lineWidth = 5; c.beginPath(); c.moveTo(hx2 - cx * 15, hy2 - sy * 15); c.lineTo(hx2 + cx * 8, hy2 + sy * 8); c.stroke();
        c.strokeStyle = '#e8b63c'; c.lineWidth = 4; c.beginPath(); c.moveTo(hx2 + cx * 9 - sy * 7, hy2 + sy * 9 + cx * 7); c.lineTo(hx2 + cx * 9 + sy * 7, hy2 + sy * 9 - cx * 7); c.stroke();
        c.lineCap = 'butt';
      } else { c.strokeStyle = MONO; c.lineWidth = 6; c.beginPath(); c.moveTo(hx2 - cx * 16, hy2 - sy * 16); c.lineTo(hx2 + cx * 92, hy2 + sy * 92); c.stroke(); }
    }
    arm(fS, fArm, false);
    c.restore();
    MONO = null;
    return { hand: [fArm[2], fArm[3]], bhand: [bArm[2], bArm[3]], foot: [fLeg[2], fLeg[3]], head: [hX, hY], chest: [shX, shY + 20] };
  };

  /* Vignette (portrait) d'un personnage sur un petit canvas */
  G.portrait = function (ch, w, h, zoom, full) {
    const cv = document.createElement('canvas'); const d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const c = cv.getContext('2d'); c.scale(d, d);
    const z = zoom || 1.5;
    if (full) c.translate(w / 2 - 4 * z, h - 8 * z); else c.translate(w / 2 - 6 * z, h + 118 * z);
    c.scale(z, z);
    const pose = G.poseClone(POSES[(ch.poses && ch.poses.idle) || 'idle']);
    G.drawFighter(c, ch, pose, 0, {});
    return cv;
  };
})();
