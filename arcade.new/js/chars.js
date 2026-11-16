/* ARCADE — personnages : fiches, poses (squelette + cinématique inverse), armes et dessin détaillé */
(function () {
  const G = window.G, DEG = Math.PI / 180, PI = Math.PI;
  const INK = '#170e0c';
  const THIGH = 55, SHIN = 53, TORSO = 60, UARM = 34, FARM = 32, HIP = 105;
  const LX = 0.42, LY = -0.91; // lumière : en haut, vers l'avant

  /* ---------- Couleurs ---------- */
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function shade(hex, f) {
    let [r, g, b] = rgb(hex);
    if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function tint(hex, to, k) { const a = rgb(hex), b = rgb(to); return 'rgb(' + ((a[0] + (b[0] - a[0]) * k) | 0) + ',' + ((a[1] + (b[1] - a[1]) * k) | 0) + ',' + ((a[2] + (b[2] - a[2]) * k) | 0) + ')'; }
  const PAL = new Map();
  function pal(hex) {
    let p = PAL.get(hex);
    if (!p) { p = { base: hex, hi: shade(hex, 1.28), lo: tint(hex, '#3a1626', 0.34), deep: tint(hex, '#1c0a16', 0.58), rim: shade(hex, 1.12) }; PAL.set(hex, p); }
    return p;
  }

  /* ---------- Poses ---------- */
  const P = (o) => Object.assign({ lean: 0, hx: 0, hy: 0, hd: 0, fh: [30, -4], bh: [18, 8], ff: [24, 0], bf: [-24, 0], rot: 0, oy: 0, ex: 0, sw: -62 }, o);
  const POSES = {
    idle: P({ lean: 7, hy: 4, fh: [32, -6], bh: [20, 6], ff: [22, 0], bf: [-22, 0] }),
    crouch: P({ lean: 16, hy: 44, hd: -6, fh: [30, 0], bh: [18, 10], ff: [30, 0], bf: [-26, 0], sw: -40 }),
    jumpUp: P({ lean: 4, fh: [22, -30], bh: [-14, -22], ff: [14, -34], bf: [-14, -22], sw: -80 }),
    jumpDn: P({ lean: 2, fh: [28, -16], bh: [-22, -26], ff: [20, -10], bf: [-18, -26], sw: -40 }),
    dash: P({ lean: 26, hx: 10, hy: 14, fh: [-18, 22], bh: [-30, 14], ff: [34, 0], bf: [-36, -6], sw: 165 }),
    back: P({ lean: -10, hx: -6, hy: 10, fh: [30, -4], bh: [18, 8], ff: [10, -10], bf: [-30, 0], sw: -60 }),
    block: P({ lean: -3, hx: -4, hy: 12, hd: -4, fh: [24, -16], bh: [28, -2], ff: [22, 0], bf: [-26, 0], sw: -96 }),
    cblock: P({ lean: 10, hx: -4, hy: 44, hd: -4, fh: [24, -14], bh: [28, 0], ff: [28, 0], bf: [-26, 0], sw: -95 }),
    hit1: P({ lean: -20, hx: -8, hy: 6, hd: -14, fh: [4, 10], bh: [-22, 16], ff: [20, 0], bf: [-30, 0], sw: -30 }),
    hit2: P({ lean: 24, hx: -6, hy: 14, hd: 10, fh: [14, 26], bh: [4, 28], ff: [18, 0], bf: [-28, 0], sw: 50 }),
    air: P({ lean: -30, hd: -16, fh: [-20, -20], bh: [-34, -6], ff: [30, -30], bf: [4, -36], rot: -35, sw: -20 }),
    down: P({ lean: 0, fh: [10, 30], bh: [-10, 30], ff: [10, 0], bf: [-12, 0], rot: -90, oy: -16, sw: 10 }),
    getup: P({ lean: 30, hy: 48, fh: [26, 36], bh: [10, 40], ff: [26, 0], bf: [-26, 0], sw: 60 }),
    win: P({ lean: -2, hy: 2, hd: -6, fh: [14, -62], bh: [-12, 26], ff: [18, 0], bf: [-20, 0], sw: -90 }),
    dizzy: P({ lean: 14, hy: 16, hd: 14, fh: [10, 36], bh: [-6, 38], ff: [20, 0], bf: [-22, 0], sw: 60 }),
    intro: P({ lean: 0, hy: 2, fh: [4, 16], bh: [14, 18], ff: [16, 0], bf: [-18, 0], sw: 70 }),
    jabW: P({ lean: 4, hy: 8, fh: [14, 2], bh: [20, 6], sw: -120 }),
    jab: P({ lean: 12, hx: 8, hy: 8, fh: [66, -4], bh: [14, 10], ff: [30, 0], ex: 1, sw: 6 }),
    hvW: P({ lean: -6, hx: -6, hy: 12, fh: [28, 0], bh: [-26, 6], ff: [22, 0], bf: [-28, 0], sw: -128 }),
    hv: P({ lean: 22, hx: 18, hy: 12, fh: [4, 14], bh: [70, -10], ff: [42, 0], bf: [-26, 0], ex: 1, sw: 44 }),
    kickW: P({ lean: -6, hx: -4, hy: 6, fh: [20, 0], bh: [-10, 8], ff: [14, -46], bf: [-16, 0], sw: -70 }),
    kick: P({ lean: -24, hx: -6, hy: 4, fh: [6, 8], bh: [-26, 2], ff: [92, -104], bf: [-14, 0], sw: -110 }),
    sweep: P({ lean: -22, hx: -8, hy: 50, fh: [-10, 30], bh: [-30, 26], ff: [96, -4], bf: [-20, 0], sw: 170 }),
    airK: P({ lean: 14, fh: [20, -10], bh: [-24, -20], ff: [72, -22], bf: [-22, -52], sw: 30 }),
    castW: P({ lean: -8, hx: -8, hy: 14, fh: [-10, 10], bh: [-20, 12], ff: [24, 0], bf: [-30, 0], sw: -150 }),
    cast: P({ lean: 16, hx: 12, hy: 14, fh: [62, -2], bh: [66, 6], ff: [40, 0], bf: [-30, 0], ex: 1, sw: 10 }),
    upW: P({ lean: 18, hy: 40, fh: [16, 30], bh: [10, 20], ff: [28, 0], bf: [-24, 0], sw: 70 }),
    upper: P({ lean: -8, fh: [20, -64], bh: [-10, 20], ff: [22, -30], bf: [-10, -4], ex: 1, sw: -90 }),
    rush: P({ lean: 30, hx: 16, hy: 16, fh: [64, -2], bh: [-30, 10], ff: [40, 0], bf: [-40, -4], ex: 1, sw: 0 }),
    flurB: P({ lean: 14, hx: 10, hy: 10, fh: [20, 4], bh: [70, -2], ff: [32, 0], ex: 1, sw: -30 }),
    stompW: P({ lean: -10, hy: 4, fh: [0, -50], bh: [-10, -50], ff: [20, -50], bf: [-20, 0], sw: -100 }),
    stomp: P({ lean: 20, hy: 30, fh: [30, 30], bh: [10, 34], ff: [36, 0], bf: [-30, 0], sw: 60 }),
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
  /* Animation par ressorts : le corps arrive avec un léger dépassement, comme un vrai mouvement. */
  G.poseSpring = function (a, vel, b, stiff, zeta) {
    const k = stiff, d = 2 * (zeta || 0.62) * Math.sqrt(k);
    for (const key in b) {
      const v = b[key];
      if (typeof v === 'number') {
        if (key === 'sw') { // angle : chemin le plus court
          let diff = v - a.sw; while (diff > 180) diff -= 360; while (diff < -180) diff += 360;
          vel.sw = (vel.sw || 0) + diff * k - (vel.sw || 0) * d; a.sw += vel.sw;
        } else { vel[key] = (vel[key] || 0) + (v - a[key]) * k - (vel[key] || 0) * d; a[key] += vel[key]; }
      } else {
        const vv = vel[key] || (vel[key] = [0, 0]);
        for (let i = 0; i < 2; i++) { vv[i] += (v[i] - a[key][i]) * k - vv[i] * d; a[key][i] += vv[i]; }
      }
    }
  };
  G.poseClone = (p) => { const o = {}; for (const k in p) o[k] = typeof p[k] === 'number' ? p[k] : [p[k][0], p[k][1]]; return o; };

  /* ---------- Fiches personnages (créations originales) ---------- */
  G.CHARS = [
    { id: 'bakari', name: 'BAKARI', title: 'Le Poing du Tonnerre', role: 'Héros', hp: 1000, speed: 1, power: 1, bulk: 1, price: 0,
      col: '#ffd23f', col2: '#fff6c9', spName: 'Orbe Tonnerre', suName: 'TONNERRE CÉLESTE', sp: 'proj', su: 'beam',
      bio: 'Gardien du village des orages. Ses poings chargés de foudre frappent avant le grondement.',
      look: { skin: '#7a4a32', eye: '#5a3418', top: 'vest', topCol: '#f1ede4', pants: '#3a3a40', sash: '#6f7a45', hair: 'afro', hairCol: '#1e1a22', beard: 1, gold: 1, band: '#6f7a45', feet: 'sandal', chain: 1 } },
    { id: 'malik', name: 'MALIK', title: 'Le Vent Tranquille', role: 'Héros', hp: 950, speed: 1.12, power: 0.95, bulk: 0.96, price: 0,
      col: '#ff9f1c', col2: '#ffe2a8', spName: 'Croc du Désert', suName: 'DANSE DU SIROCCO', sp: 'upper', su: 'rush',
      bio: 'Il marche lentement et frappe vite. Personne n’a jamais vu ses yeux derrière ses verres noirs.',
      look: { skin: '#6b3f2a', eye: '#3a2214', top: 'tank', topCol: '#f4f1ea', pants: '#d6a53a', sash: '#4a3a2c', hair: 'short', hairCol: '#16131a', glasses: 1, stache: 1, feet: 'flip' } },
    { id: 'devan', name: 'DEVAN', title: 'Les Quatre Paumes', role: 'Héros', hp: 980, speed: 1, power: 1, bulk: 1, price: 700,
      col: '#35d0ba', col2: '#d6fff6', spName: 'Mille Paumes', suName: 'LOTUS AUX QUATRE BRAS', sp: 'flurry', su: 'rush',
      bio: 'Moine danseur aux quatre bras. Chaque paume suit son propre rythme, et toutes frappent juste.',
      look: { skin: '#b9774f', eye: '#2a1810', top: 'wrap', topCol: '#f1cf7a', pants: '#f1cf7a', sash: '#e2562a', hair: 'long', hairCol: '#15151c', gold: 1, arms4: 1, feet: 'bare', cloth: '#2fae9b', anklets: 1 } },
    { id: 'sable', name: 'SABLE', title: 'La Lame d’Émeraude', role: 'Rival', hp: 920, speed: 1.05, power: 1.08, bulk: 0.95, price: 900,
      col: '#7dff3a', col2: '#e6ffd0', spName: 'Croissant Vert', suName: 'MILLE LAMES D’ÉMERAUDE', sp: 'slash', su: 'rush', sword: 1, weapon: 'sabre',
      poses: { idle: 'sIdle', jabW: 'sJabW', jab: 'sJab', hvW: 'sHvW', hv: 'sHv' },
      bio: 'Mercenaire au sabre de jade. Ses yeux d’or voient la faille avant que l’adversaire ne bouge.',
      look: { skin: '#6a4630', eye: '#f2b33d', top: 'coat', topCol: '#1c1a1c', pants: '#201d1f', sash: '#efe9dc', hair: 'buzz', hairCol: '#18151a', beard: 1, ring: 1, feet: 'boot', neck: 1 } },
    { id: 'braza', name: 'BRAZA', title: 'La Braise Écarlate', role: 'Rival', hp: 1000, speed: 1.06, power: 1.05, bulk: 1, price: 1000,
      col: '#ff4b2b', col2: '#ffd0a0', spName: 'Charge Écarlate', suName: 'BRASIER ÉCARLATE', sp: 'rush', su: 'beam',
      bio: 'Combattant de rue couvert de cicatrices. Plus on le frappe, plus il brûle.',
      look: { skin: '#e9b99a', eye: '#2b1a12', top: 'bare', topCol: '#e9b99a', pants: '#2c2f3d', sash: '#e39a2b', hair: 'spiky', hairCol: '#d81f26', scars: 1, wraps: 1, torn: 1, feet: 'wrap' } },
    { id: 'tembo', name: 'TEMBO', title: 'Le Vieux Maître', role: 'Boss', hp: 1120, speed: 0.88, power: 1.15, bulk: 1.14, price: 1500,
      col: '#ff7b54', col2: '#ffe0c2', spName: 'Séisme', suName: 'COLÈRE DE LA MONTAGNE', sp: 'quake', su: 'erupt',
      bio: 'Maître de la montagne, plus vieux que le dojo. Quand il pose le pied, la terre l’écoute.',
      look: { skin: '#a8683f', eye: '#2a1a10', top: 'bare', topCol: '#a8683f', pants: '#f3f0ea', sash: '#b3332b', hair: 'elder', hairCol: '#f4f4f0', feet: 'bare', huge: 1 } },
  ];
  G.charById = (id) => G.CHARS.find((c) => c.id === id) || G.CHARS[0];

  /* ---------- Armes (créations originales) ----------
     kind : blade (une lame), twin (deux lames), kama (faucille + chaîne), glove (protège-poings)
     bonus : dmg (dégâts), spd (vitesse), en (énergie), reach (portée, en pixels) */
  G.WEAPONS = [
    { id: 'sabre', name: 'Sabre de Jade', kind: 'blade', price: 0, hidden: 1, glow: '#7dff3a', bonus: { dmg: 0, spd: 0, en: 0, reach: 34 }, desc: 'La lame de Sable.' },
    { id: 'lames', name: 'Lames Jumelles', kind: 'twin', price: 400, glow: null, bonus: { dmg: 0.06, spd: 0.04, en: 0, reach: 22 }, desc: 'Deux couperets d’acier reliés par une chaîne noire.' },
    { id: 'silence', name: 'Lame du Silence', kind: 'blade', price: 500, glow: null, bonus: { dmg: 0.07, spd: 0, en: 0, reach: 40 }, desc: 'Longue lame droite, fendue près de la garde. Elle ne fait aucun bruit.' },
    { id: 'ecarlate', name: 'Katana Écarlate', kind: 'blade', price: 800, glow: '#ff3b3b', bonus: { dmg: 0.1, spd: 0.04, en: 0, reach: 34 }, desc: 'Lame rouge sang, garde dorée et pompon porte-bonheur.' },
    { id: 'faucille', name: 'Faucille du Soleil', kind: 'kama', price: 700, glow: null, bonus: { dmg: 0.05, spd: 0, en: 0.1, reach: 48 }, desc: 'Faucille dorée et chaîne lestée d’un anneau à pointes.' },
    { id: 'dore', name: 'Grand Sabre Doré', kind: 'blade', heavy: 1, price: 1200, glow: '#ffd36b', bonus: { dmg: 0.15, spd: -0.06, en: 0, reach: 44 }, desc: 'Une lame large comme un bouclier, forgée dans l’or du temple.' },
    { id: 'sceaux', name: 'Couperets des Sceaux', kind: 'twin', price: 1000, glow: '#7dff6a', bonus: { dmg: 0.08, spd: 0, en: 0.25, reach: 26 }, desc: 'Deux lames couvertes de sceaux, liées par une chaîne spectrale.' },
    { id: 'brasier', name: 'Gantelets du Brasier', kind: 'glove', price: 900, glow: '#ff6a2a', bonus: { dmg: 0.12, spd: 0, en: 0, reach: 6 }, desc: 'Protège-poings écarlates gravés de runes qui brûlent à chaque coup.' },
    { id: 'jade', name: 'Bandes de Jade', kind: 'glove', price: 600, glow: '#2fffc0', bonus: { dmg: 0.03, spd: 0.08, en: 0.2, reach: 4 }, desc: 'Bandes de soie verte cerclées d’or et de pierres de jade.' },
    { id: 'emeraude', name: 'Hache d’Émeraude', kind: 'blade', axe: 1, price: 1100, glow: '#3dffa0', bonus: { dmg: 0.12, spd: 0, en: 0, reach: 30 }, desc: 'Hache de cristal vert montée sur un manche gainé de cuir.' },
  ];
  G.weaponById = (id) => G.WEAPONS.find((w) => w.id === id) || null;

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
  const ink = (c, w) => { c.lineWidth = w || 2.4; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };

  /* Volume cylindrique éclairé : dégradé perpendiculaire au membre */
  function cylFill(c, x1, y1, x2, y2, half, hex) {
    if (MONO) return MONO;
    const P = pal(hex), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L; if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny; }
    const g = c.createLinearGradient(mx + nx * half, my + ny * half, mx - nx * half, my - ny * half);
    g.addColorStop(0, P.hi); g.addColorStop(0.28, P.base); g.addColorStop(0.62, P.lo); g.addColorStop(0.9, P.deep); g.addColorStop(1, P.lo);
    return g;
  }
  /* Membre musclé : fuseau avec renflement (biceps, mollet…) */
  function muscle(c, ax, ay, bx, by, w1, w2, hex, o) {
    o = o || {};
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 0.01, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const h1 = w1 / 2, h2 = w2 / 2, hm = (h1 + h2) / 2, b1 = 1 + (o.b1 == null ? 0.16 : o.b1), b2 = 1 + (o.b2 == null ? 0.1 : o.b2), at = o.at || 0.4, au = Math.atan2(uy, ux);
    c.beginPath();
    c.moveTo(ax + nx * h1, ay + ny * h1);
    c.quadraticCurveTo(ax + ux * len * at + nx * hm * b1 * 1.18, ay + uy * len * at + ny * hm * b1 * 1.18, bx + nx * h2, by + ny * h2);
    c.arc(bx, by, h2, au + PI / 2, au - PI / 2, true);
    c.quadraticCurveTo(ax + ux * len * (at + 0.05) - nx * hm * b2 * 1.18, ay + uy * len * (at + 0.05) - ny * hm * b2 * 1.18, ax - nx * h1, ay - ny * h1);
    c.arc(ax, ay, h1, au - PI / 2, au + PI / 2, true);
    c.closePath();
    c.fillStyle = cylFill(c, ax, ay, bx, by, Math.max(h1, h2) * 1.15, hex); c.fill();
    if (!MONO) ink(c, o.lw || 2.4);
  }
  function disc(c, x, y, r, hex, lw, flat) {
    c.beginPath(); c.arc(x, y, r, 0, 7);
    if (MONO) { c.fillStyle = MONO; c.fill(); return; }
    if (flat) c.fillStyle = hex; else { const P = pal(hex), g = c.createRadialGradient(x + LX * r * 0.45, y + LY * r * 0.45, r * 0.1, x, y, r * 1.05); g.addColorStop(0, P.hi); g.addColorStop(0.5, P.base); g.addColorStop(1, P.lo); c.fillStyle = g; }
    c.fill(); if (lw !== 0) ink(c, lw || 2.2);
  }
  function poly(c, pts, col, lw, smooth) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    if (smooth) { for (let i = 2; i < pts.length - 2; i += 2) { const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2; c.quadraticCurveTo(pts[i], pts[i + 1], mx, my); } c.lineTo(pts[pts.length - 2], pts[pts.length - 1]); }
    else for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fillStyle = MONO || col; c.fill();
    if (!MONO && lw !== 0) ink(c, lw || 2.2);
  }
  function line(c, pts, col, w, smooth) {
    if (MONO) return;
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    if (smooth && pts.length >= 6) { for (let i = 2; i < pts.length - 2; i += 2) { const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2; c.quadraticCurveTo(pts[i], pts[i + 1], mx, my); } c.lineTo(pts[pts.length - 2], pts[pts.length - 1]); }
    else for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  /* Bande de tissu qui flotte, avec ondulation */
  function ribbon(c, x, y, len, sway, w, hex, t) {
    const wob = Math.sin((t || 0) * 0.16) * 4;
    const pts = [x, y, x + sway * 0.35 + wob * 0.4, y + len * 0.35, x + sway * 0.7 - wob, y + len * 0.7, x + sway + wob * 0.6, y + len];
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (!MONO) { line(c, pts, INK, w + 4.2, true); }
    if (MONO) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = MONO; c.lineWidth = w; c.stroke(); return; }
    line(c, pts, hex, w, true);
    line(c, [pts[0] + 1, pts[1], pts[2] + 1.2, pts[3], pts[4] + 1, pts[5]], 'rgba(255,255,255,.22)', Math.max(1, w * 0.3), true);
  }
  function chainPath(c, x1, y1, x2, y2, sag, col, glow, t) { // chaîne aux maillons
    const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + sag, n = Math.max(6, (Math.hypot(x2 - x1, y2 - y1) + sag) / 6.5 | 0);
    const pt = (k) => { const a = 1 - k; return [a * a * x1 + 2 * a * k * mx + k * k * x2, a * a * y1 + 2 * a * k * my + k * k * y2]; };
    if (glow && !MONO) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = glow; c.globalAlpha = 0.35 + 0.15 * Math.sin((t || 0) * 0.2); c.lineWidth = 9; c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(mx, my, x2, y2); c.stroke(); c.restore(); }
    for (let i = 0; i <= n; i++) {
      const k = i / n, p = pt(k), q = pt(Math.min(1, k + 0.02)), a = Math.atan2(q[1] - p[1], q[0] - p[0]);
      c.save(); c.translate(p[0], p[1]); c.rotate(a);
      c.beginPath(); c.ellipse(0, 0, 4.2, i % 2 ? 1.6 : 2.6, 0, 0, 7);
      if (MONO) { c.fillStyle = MONO; c.fill(); } else { c.lineWidth = 1.8; c.strokeStyle = col; c.stroke(); c.lineWidth = 0.7; c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(0, -0.6, 2.6, PI * 1.1, PI * 1.6); c.stroke(); }
      c.restore();
    }
  }
  function glyphs(c, x, y, w, h, col, seed) { // inscriptions décoratives (motifs inventés)
    if (MONO) return;
    const r = G.rng(seed); c.strokeStyle = col; c.lineWidth = 1; c.lineCap = 'round';
    for (let yy = y; yy < y + h; yy += 5) {
      c.beginPath(); let xx = x + r() * 2;
      while (xx < x + w - 3) { const s = 2 + r() * 3; if (r() < 0.6) { c.moveTo(xx, yy); c.quadraticCurveTo(xx + s / 2, yy - 2 - r() * 2, xx + s, yy); } xx += s + 1.5; }
      c.stroke();
    }
  }

  /* ---------- Dessin des armes (repère : poignée à l'origine, lame vers +x) ---------- */
  function drawBlade(c, w, ang, x, y, t, side) {
    c.save(); c.translate(x, y); c.rotate(ang * DEG);
    const M = MONO;
    const glowStroke = (len, col, wd) => { if (M || !col) return; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.28 + 0.1 * Math.sin(t * 0.18); c.strokeStyle = col; c.lineWidth = wd; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, 0); c.lineTo(len, 0); c.stroke(); c.restore(); };
    const steel = (x0, len, hw, tip) => { // lame d'acier
      if (!M) { const g = c.createLinearGradient(0, -hw, 0, hw); g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.45, '#b9c1c7'); g.addColorStop(0.55, '#8a949c'); g.addColorStop(1, '#d6dde2'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.moveTo(x0, -hw); c.lineTo(len - tip, -hw); c.lineTo(len, hw * 0.2); c.lineTo(len - 2, hw); c.lineTo(x0, hw); c.closePath(); c.fill(); if (!M) ink(c, 1.8);
    };
    const grip = (len, col, wrapCol) => { // poignée gainée
      c.beginPath(); c.rect(-len, -3.4, len, 6.8);
      c.fillStyle = M || col; c.fill(); if (M) return; ink(c, 1.6);
      c.strokeStyle = wrapCol; c.lineWidth = 1.4; c.beginPath(); for (let i = -len + 2; i < -1; i += 4) { c.moveTo(i, -3.2); c.lineTo(i + 3, 3.2); } c.stroke();
    };
    if (w.id === 'sabre') {
      glowStroke(96, '#7dff3a', 14);
      grip(17, '#2f6b2a', '#1b3a18');
      poly(c, [4, -8, 7, -8, 7, 8, 4, 8], '#e8b63c', 1.4);
      if (!M) { const g = c.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#eaffd8'); g.addColorStop(0.5, '#8dff4a'); g.addColorStop(1, '#3fae22'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.moveTo(8, -3); c.quadraticCurveTo(60, -5, 96, -1); c.lineTo(92, 3); c.quadraticCurveTo(55, 3, 8, 3); c.closePath(); c.fill(); if (!M) ink(c, 1.6);
    } else if (w.id === 'lames') {
      grip(14, '#141416', '#3a3a40'); disc(c, 2, 0, 5.2, '#1b1b1f', 1.4, 1);
      steel(6, side ? 62 : 70, 5.2, 9);
      if (!M) { c.fillStyle = '#2a2d31'; c.fillRect(22, -2.2, 6, 2.2); c.fillRect(31, -2.2, 6, 2.2); }
    } else if (w.id === 'silence') {
      grip(26, '#151517', '#2e2e33'); poly(c, [2, -6, 6, -6, 6, 6, 2, 6], '#4a4d52', 1.4);
      steel(6, 104, 4.6, 14);
      if (!M) { c.fillStyle = '#1a1c1f'; c.fillRect(12, -1.4, 22, 2.8); }
    } else if (w.id === 'ecarlate') {
      glowStroke(92, '#ff3b3b', 10);
      grip(20, '#3b2b5a', '#d9c7ff'); poly(c, [-22, -4, -19, -4, -19, 4, -22, 4], '#d9a23a', 1.2);
      poly(c, [3, -9, 7, -6, 7, 6, 3, 9, 1, 0], '#d9a23a', 1.4);
      if (!M) { const g = c.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#ff8a8a'); g.addColorStop(0.5, '#e01b24'); g.addColorStop(1, '#7a0c12'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.moveTo(8, -3.6); c.quadraticCurveTo(60, -9, 94, -10); c.quadraticCurveTo(70, -2, 8, 3.6); c.closePath(); c.fill(); if (!M) ink(c, 1.6);
      if (!M) { line(c, [-22, 3, -26, 12, -24, 22], '#d9a23a', 1.6, true); poly(c, [-28, 20, -21, 20, -22, 34, -27, 34], '#d81f3a', 1.2); }
    } else if (w.id === 'faucille') {
      if (!M) { const g = c.createLinearGradient(-30, 0, 4, 0); g.addColorStop(0, '#5a0e14'); g.addColorStop(0.5, '#c0222e'); g.addColorStop(1, '#6a1018'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.moveTo(-30, -3); c.quadraticCurveTo(-12, -6, 4, -4); c.lineTo(4, 4); c.quadraticCurveTo(-12, 5, -30, 3); c.closePath(); c.fill(); if (!M) ink(c, 1.6);
      if (!M) { const g = c.createLinearGradient(0, -30, 0, 10); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#e2b23c'); g.addColorStop(1, '#9a6a14'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.moveTo(2, -4); c.quadraticCurveTo(28, -36, 58, -26); c.quadraticCurveTo(30, -24, 10, 4); c.closePath(); c.fill(); if (!M) { ink(c, 1.6); c.fillStyle = '#c0222e'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(12 + i * 6, -10 - i * 2.2, 1.5, 0, 7); c.fill(); } }
    } else if (w.id === 'dore') {
      glowStroke(84, '#ffd36b', 22);
      grip(16, '#5a3a1e', '#2a1a0c'); poly(c, [-4, -12, 2, -12, 4, 12, -6, 14, -8, 8, -2, 8], '#a87a2a', 1.4);
      if (!M) { const g = c.createLinearGradient(0, -14, 0, 8); g.addColorStop(0, '#fff7c9'); g.addColorStop(0.4, '#e9c14a'); g.addColorStop(1, '#9a7420'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.moveTo(4, -6); c.lineTo(70, -12); c.quadraticCurveTo(90, -16, 92, -6); c.quadraticCurveTo(86, 8, 62, 10); c.lineTo(4, 6); c.closePath(); c.fill(); if (!M) ink(c, 1.8);
      if (!M) { c.fillStyle = '#7a5418'; c.beginPath(); c.moveTo(4, -6); c.lineTo(68, -12); c.lineTo(66, -7); c.lineTo(4, -2); c.closePath(); c.fill(); for (let i = 10; i < 64; i += 7) disc(c, i, -5.5, 1.6, '#c0902e', 0, 1); disc(c, 8, -4, 2, '#d22', 0, 1); }
      if (!M) poly(c, [-18, 2, -14, 2, -15, 18, -19, 18], '#a3182a', 1);
    } else if (w.id === 'sceaux') {
      glowStroke(0, null, 0);
      grip(18, '#8a4a22', '#5a2e14'); poly(c, [2, -9, 6, -9, 6, 9, 2, 9], '#2a2a2e', 1.4);
      if (!M) { const g = c.createLinearGradient(0, -14, 0, 10); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#e6cf54'); g.addColorStop(1, '#a8902c'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.moveTo(6, -8); c.lineTo(48, -16); c.quadraticCurveTo(60, -12, 62, 0); c.lineTo(58, 9); c.lineTo(6, 8); c.closePath(); c.fill(); if (!M) { ink(c, 1.6); glyphs(c, 12, -10, 42, 16, 'rgba(150,60,20,.75)', side ? 11 : 7); c.strokeStyle = 'rgba(150,60,20,.6)'; c.lineWidth = 1; c.beginPath(); c.arc(32, -1, 6, 0, 7); c.stroke(); }
    } else if (w.id === 'emeraude') {
      glowStroke(52, '#3dffa0', 14);
      if (!M) { const g = c.createLinearGradient(-20, 0, 60, 0); g.addColorStop(0, '#4a2a16'); g.addColorStop(1, '#7a4a26'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.rect(-20, -3.4, 74, 6.8); c.fill(); if (!M) { ink(c, 1.6); c.strokeStyle = '#2a170c'; c.lineWidth = 1.3; c.beginPath(); for (let i = -18; i < 52; i += 5) { c.moveTo(i, -3); c.lineTo(i + 3, 3); } c.stroke(); }
      poly(c, [44, -6, 56, -6, 56, 6, 44, 6], '#d8b24a', 1.4);
      if (!M) { const g = c.createLinearGradient(40, -30, 70, 10); g.addColorStop(0, '#d8fff0'); g.addColorStop(0.45, '#2fe39a'); g.addColorStop(1, '#0a7a4a'); c.fillStyle = g; } else c.fillStyle = M;
      c.beginPath(); c.moveTo(50, -6); c.quadraticCurveTo(54, -26, 70, -32); c.quadraticCurveTo(64, -14, 72, 4); c.quadraticCurveTo(60, 2, 52, 6); c.closePath(); c.fill(); if (!M) { ink(c, 1.6); disc(c, 56, -2, 2.4, '#2fe39a', 1, 1); }
    }
    c.restore();
  }
  function bladeTip(w, ang, x, y) { // bout de la lame (pour la chaîne et les effets)
    const len = w.id === 'silence' ? 104 : w.id === 'dore' ? 90 : w.id === 'sabre' ? 96 : w.id === 'ecarlate' ? 92 : 64;
    return [x + Math.cos(ang * DEG) * len, y + Math.sin(ang * DEG) * len];
  }
  function pommel(w, ang, x, y) { const l = w.id === 'silence' ? 26 : w.id === 'faucille' ? 30 : 18; return [x - Math.cos(ang * DEG) * l, y - Math.sin(ang * DEG) * l]; }

  /* ---------- Dessin d'un combattant (origine = sol, regard vers +x) ---------- */
  G.drawFighter = function (c, ch, p, time, opt) {
    opt = opt || {};
    MONO = opt.mono || null;
    const L = ch.look, B = ch.bulk || 1, vx = opt.vx || 0, T = time || 0;
    const wp = opt.weapon === undefined ? G.weaponById(ch.weapon) : opt.weapon;
    const lag = opt.lag || 0; // retard du tissu (mouvement secondaire)
    const sway = Math.sin(T * 0.09) * 3 - vx * 1.6 - lag * 2.2;
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
    const skin = L.skin, skinB = shade(L.skin, 0.84), MB = L.huge ? 1.12 : 1;
    const ux = Math.sin(la), uy = -Math.cos(la), fx = Math.cos(la), fy = Math.sin(la); // repère du torse
    const at = (u, f) => [hipX + ux * u + fx * f, hipY + 3 + uy * u + fy * f];
    const flat = (arr) => [].concat.apply([], arr);
    const glove = wp && wp.kind === 'glove' ? wp : null;

    /* --- poing détaillé --- */
    function fist(A, back) {
      const a = Math.atan2(A[3] - A[1], A[2] - A[0]), r = 8.6 * B * MB;
      c.save(); c.translate(A[2], A[3]); c.rotate(a);
      const col = glove ? (glove.id === 'brasier' ? '#b3242a' : '#1fae86') : L.wraps ? '#ece3d2' : back ? skinB : skin;
      c.beginPath(); c.moveTo(-4, -r * 0.82); c.quadraticCurveTo(r * 1.15, -r * 1.05, r * 1.18, 0); c.quadraticCurveTo(r * 1.15, r * 1.02, -4, r * 0.86); c.quadraticCurveTo(-r * 0.7, 0, -4, -r * 0.82); c.closePath();
      if (MONO) { c.fillStyle = MONO; c.fill(); c.restore(); return; }
      const P = pal(col), g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, P.hi); g.addColorStop(0.45, P.base); g.addColorStop(1, P.deep); c.fillStyle = g; c.fill(); ink(c, 2.2);
      c.strokeStyle = 'rgba(25,10,8,.55)'; c.lineWidth = 1.2; c.beginPath();
      for (const k of [-0.45, 0, 0.45]) { c.moveTo(r * 0.55, k * r); c.lineTo(r * 1.05, k * r * 1.05); }
      c.stroke();
      line(c, [-1, r * 0.7, r * 0.55, r * 0.55, r * 0.9, r * 0.2], 'rgba(25,10,8,.6)', 1.4, true); // pouce
      if (glove && glove.id === 'brasier') { disc(c, r * 0.85, -r * 0.45, 2, '#e9c14a', 0.8, 0); disc(c, r * 0.95, 0, 2, '#e9c14a', 0.8, 0); disc(c, r * 0.85, r * 0.45, 2, '#e9c14a', 0.8, 0); }
      if (glove && glove.id === 'jade') { disc(c, r * 0.3, -r * 0.2, 2.6, '#3dffc0', 0.8, 0); }
      c.restore();
    }
    /* --- avant-bras habillé par l'arme-gant --- */
    function gloveArm(A) {
      if (!glove || MONO) return;
      const x1 = G.lerp(A[0], A[2], 0.22), y1 = G.lerp(A[1], A[3], 0.22);
      if (glove.id === 'brasier') {
        muscle(c, x1, y1, A[2], A[3], 18 * B, 15 * B, '#a81f26', { b1: 0.05, b2: 0.05, lw: 2 });
        const mx = G.lerp(x1, A[2], 0.5), my = G.lerp(y1, A[3], 0.5), a = Math.atan2(A[3] - A[1], A[2] - A[0]);
        c.save(); c.translate(mx, my); c.rotate(a);
        c.strokeStyle = '#d9a23a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-10, -8); c.lineTo(-10, 8); c.moveTo(9, -7); c.lineTo(9, 7); c.stroke();
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.75 + 0.25 * Math.sin(T * 0.2); c.strokeStyle = '#ffb04a'; c.lineWidth = 1.7;
        c.beginPath(); c.moveTo(-5, -4); c.lineTo(0, -5); c.lineTo(-2, 0); c.lineTo(4, 1); c.moveTo(-4, 3); c.lineTo(3, 4); c.moveTo(1, -2); c.lineTo(1, 5); c.stroke(); c.restore();
        c.restore();
        line(c, [x1, y1, x1 - 6, y1 + 10 + Math.sin(T * 0.2) * 3, x1 - 4, y1 + 18], '#a81f26', 2.4, true);
      } else if (glove.id === 'jade') {
        muscle(c, x1, y1, A[2], A[3], 17 * B, 14 * B, '#1fae86', { b1: 0.04, b2: 0.04, lw: 2 });
        const n = 5; c.strokeStyle = '#d9b24a'; c.lineWidth = 1.4; c.beginPath();
        for (let i = 1; i < n; i++) { const k = i / n, x = G.lerp(x1, A[2], k), y = G.lerp(y1, A[3], k); c.moveTo(x - 6, y - 5); c.quadraticCurveTo(x + 2, y, x - 4, y + 6); } c.stroke();
        disc(c, G.lerp(x1, A[2], 0.55), G.lerp(y1, A[3], 0.55), 2.8, '#3dffc0', 0.8, 0);
        ribbon(c, x1, y1, 30, -16 + sway * 2, 4, '#2fd8a8', T + 20);
      }
    }
    /* --- bras complet (deltoïde, biceps, avant-bras, poing) --- */
    function arm(S, A, back, y2) {
      const sk = back ? skinB : skin, sleeve = L.top === 'coat', sy = y2 || 0;
      const up = sleeve ? L.topCol : sk;
      muscle(c, S[0], S[1] + sy, A[0], A[1], 21.5 * B * MB, 15 * B * MB, up, { b1: 0.3, b2: 0.14, at: 0.36 });
      muscle(c, A[0], A[1], A[2], A[3], 16.5 * B * MB, 11.5 * B * MB, sleeve ? '#26252b' : sk, { b1: 0.22, b2: 0.12, at: 0.28 });
      if (sleeve && !MONO) { line(c, [G.lerp(S[0], A[0], 0.3), G.lerp(S[1], A[1], 0.3) + 3, G.lerp(S[0], A[0], 0.6), G.lerp(S[1], A[1], 0.6) - 2], 'rgba(255,255,255,.12)', 2); disc(c, G.lerp(S[0], A[0], 0.45), G.lerp(S[1], A[1], 0.45) - 2, 5.4, '#e8b63c', 1.4); }
      if (!MONO) { // deltoïde
        const a = Math.atan2(A[1] - S[1] - sy, A[0] - S[0]), r = 10.5 * B * MB;
        c.beginPath(); c.arc(S[0], S[1] + sy, r, a + 0.5, a + PI * 0.95); c.strokeStyle = 'rgba(40,15,10,.4)'; c.lineWidth = 1.4; c.stroke();
        c.beginPath(); c.arc(S[0], S[1] + sy, r * 0.62, a - PI * 0.85, a - PI * 0.35); c.strokeStyle = 'rgba(255,240,220,.28)'; c.lineWidth = 2; c.stroke();
      }
      if (!sleeve && !MONO) { // ligne du biceps
        const mx = G.lerp(S[0], A[0], 0.55), my = G.lerp(S[1], A[1], 0.55), a = Math.atan2(A[1] - S[1], A[0] - S[0]);
        line(c, [mx - Math.cos(a) * 7 + Math.sin(a) * 2, my - Math.sin(a) * 7 - Math.cos(a) * 2, mx + Math.cos(a) * 5 + Math.sin(a) * 3.5, my + Math.sin(a) * 5 - Math.cos(a) * 3.5], 'rgba(40,15,10,.35)', 1.3);
      }
      if (L.gold && !glove) muscle(c, G.lerp(A[0], A[2], 0.8), G.lerp(A[1], A[3], 0.8), G.lerp(A[0], A[2], 0.93), G.lerp(A[1], A[3], 0.93), 14 * B, 13 * B, '#e8b63c', { b1: 0, b2: 0, lw: 1.6 });
      if (L.wraps && !glove) { muscle(c, G.lerp(A[0], A[2], 0.45), G.lerp(A[1], A[3], 0.45), A[2], A[3], 15 * B, 13 * B, '#ece3d2', { b1: 0, b2: 0, lw: 1.8 }); if (!MONO) { c.strokeStyle = 'rgba(120,100,80,.6)'; c.lineWidth = 1; c.beginPath(); for (const k of [0.55, 0.68, 0.81]) { const x = G.lerp(A[0], A[2], k), y = G.lerp(A[1], A[3], k); c.moveTo(x - 5, y - 6); c.lineTo(x + 4, y + 6); } c.stroke(); } }
      gloveArm(A);
      fist(A, back);
    }
    /* --- jambe (pantalon ample à plis, pied détaillé) --- */
    function leg(K, back, hx) {
      const pc = back ? shade(L.pants, 0.8) : L.pants, sk = back ? skinB : skin;
      const grounded = K[3] > -12 && !p.rot;
      const sa = Math.atan2(K[3] - K[1], K[2] - K[0]), fa = grounded ? 0 : sa - PI / 2;
      const fx2 = K[2] + Math.cos(fa) * 18, fy2 = K[3] + Math.sin(fa) * 18 + (grounded ? 3 : 0);
      // pied
      const footCol = L.feet === 'boot' ? '#34373e' : sk;
      c.save(); c.translate(K[2], K[3] + 2); c.rotate(fa);
      c.beginPath(); c.moveTo(-6, -5); c.quadraticCurveTo(10, -7, 19, 0); c.quadraticCurveTo(21, 5, 15, 6.5); c.lineTo(-7, 6.5); c.quadraticCurveTo(-9, 0, -6, -5); c.closePath();
      if (MONO) { c.fillStyle = MONO; c.fill(); }
      else {
        const P = pal(footCol), g = c.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, P.hi); g.addColorStop(0.5, P.base); g.addColorStop(1, P.deep); c.fillStyle = g; c.fill(); ink(c, 2.2);
        if (L.feet === 'sandal' || L.feet === 'flip') { c.fillStyle = L.feet === 'flip' ? '#3f7a2a' : '#3a2a20'; c.fillRect(-8, 5.5, 29, 2.4); line(c, L.feet === 'flip' ? [4, -4, 10, 4] : [-4, -4, 12, 5, 4, -5, 14, -1], L.feet === 'flip' ? '#6fbf3a' : '#3a2a20', 2.4); }
        if (L.feet === 'bare' || L.feet === 'wrap') line(c, [14, 1, 17, 3], 'rgba(40,15,10,.5)', 1);
        if (L.feet === 'boot') { c.fillStyle = '#4c5058'; c.fillRect(-7, 4, 26, 3); line(c, [0, -4, 6, 3], '#22242a', 1.4); }
        if (L.feet === 'wrap') { c.strokeStyle = '#ece3d2'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-5, -4); c.lineTo(6, 5); c.moveTo(1, -6); c.lineTo(10, 4); c.stroke(); }
      }
      c.restore();
      if (L.anklets && !MONO) { const x = G.lerp(K[0], K[2], 0.9), y = G.lerp(K[1], K[3], 0.9); c.strokeStyle = '#e8963c'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 8, 3, sa + PI / 2, 0, 7); c.stroke(); }
      // tibia / pantalon
      const cut = L.torn ? 0.6 : 1;
      if (cut < 1) {
        muscle(c, K[0], K[1], K[2], K[3], 15 * B, 11 * B, sk, { b1: 0.3, b2: 0.05, at: 0.3 });
        muscle(c, G.lerp(K[0], K[2], 0.68), G.lerp(K[1], K[3], 0.68), K[2], K[3], 14 * B, 12.5 * B, '#ece3d2', { b1: 0, b2: 0, lw: 1.8 });
      }
      const kx = G.lerp(K[0], K[2], cut), ky = G.lerp(K[1], K[3], cut);
      muscle(c, K[0], K[1], kx, ky, 27 * B * MB, (cut < 1 ? 25 : 15) * B, pc, { b1: 0.28, b2: 0.2, at: 0.45 });
      if (cut < 1 && !MONO) { // bord déchiré
        const a = sa, nx = -Math.sin(a), ny = Math.cos(a), w = 12.5 * B; c.fillStyle = pc; c.beginPath();
        c.moveTo(kx + nx * w, ky + ny * w); for (let i = 0; i <= 6; i++) { const k = i / 6, s = w - 2 * w * k; c.lineTo(kx + nx * s + Math.cos(a) * (i % 2 ? 8 : 1), ky + ny * s + Math.sin(a) * (i % 2 ? 8 : 1)); } c.closePath(); c.fill(); ink(c, 1.6);
      }
      // cuisse
      muscle(c, hx, hipY, K[0], K[1], 30 * B * MB, 25 * B * MB, pc, { b1: 0.22, b2: 0.14, at: 0.45 });
      if (!MONO) { // plis du tissu
        const a = Math.atan2(K[1] - hipY, K[0] - hx), ca = Math.cos(a), sa2 = Math.sin(a);
        const fold = (k, off, len) => { const x = G.lerp(hx, K[0], k), y = G.lerp(hipY, K[1], k); line(c, [x - sa2 * off, y + ca * off, x - sa2 * off + ca * len, y + ca * off + sa2 * len], 'rgba(10,6,12,.35)', 1.4); };
        fold(0.55, -4, 9); fold(0.78, 5, 8); fold(0.35, 2, 7);
        const kk = Math.atan2(ky - K[1], kx - K[0]);
        for (const k of [0.25, 0.5]) { const x = G.lerp(K[0], kx, k), y = G.lerp(K[1], ky, k); line(c, [x + Math.sin(kk) * 6, y - Math.cos(kk) * 6, x - Math.sin(kk) * 2 + Math.cos(kk) * 6, y + Math.cos(kk) * 2 + Math.sin(kk) * 6], 'rgba(10,6,12,.3)', 1.3); }
      }
      if (cut === 1 && L.feet !== 'boot') { // revers resserré à la cheville
        const cc = L.arms4 ? '#e8963c' : shade(L.pants, 0.62);
        muscle(c, G.lerp(K[0], K[2], 0.84), G.lerp(K[1], K[3], 0.84), K[2], K[3], 15.5 * B, 13.5 * B, cc, { b1: 0, b2: 0, lw: 1.8 });
      }
      if (L.feet === 'boot') muscle(c, G.lerp(K[0], K[2], 0.62), G.lerp(K[1], K[3], 0.62), K[2], K[3], 18, 15, '#3a3d44', { b1: 0.04, b2: 0, lw: 2 });
    }
    /* --- arme dans la main avant (et arrière pour les paires) --- */
    const bAng = Math.atan2(bArm[3] - bArm[1], bArm[2] - bArm[0]) / DEG - 64;
    function weaponBack() {
      if (!wp || wp.kind === 'glove') return;
      if (wp.kind === 'twin') drawBlade(c, wp, bAng, bArm[2], bArm[3], T, 1);
    }
    function weaponFront() {
      if (!wp || wp.kind === 'glove') return;
      drawBlade(c, wp, p.sw, fArm[2], fArm[3], T, 0);
      if (wp.kind === 'twin') {
        const a = pommel(wp, p.sw, fArm[2], fArm[3]), b = pommel(wp, bAng, bArm[2], bArm[3]);
        chainPath(c, a[0], a[1], b[0], b[1], 26, wp.id === 'sceaux' ? '#6dff5a' : '#1b1b20', wp.id === 'sceaux' ? '#5dff4a' : null, T);
      }
      if (wp.kind === 'kama') {
        const a = pommel(wp, p.sw, fArm[2], fArm[3]), wx = bArm[2] - 6 + Math.sin(T * 0.08) * 8, wy = bArm[3] + 34;
        chainPath(c, a[0], a[1], wx, wy, 20, '#c9a23a', null, T);
        if (!MONO) { c.save(); c.translate(wx, wy); c.rotate(T * 0.05); for (let i = 0; i < 6; i++) { c.rotate(PI / 3); poly(c, [7, -2, 15, 0, 7, 2], '#e2b23c', 1); } c.restore(); }
        disc(c, wx, wy, 7.5, '#6a2a1a', 2); disc(c, wx, wy, 3.5, '#2a1410', 0, 1);
      }
    }

    /* === ARRIÈRE-PLAN DU PERSONNAGE === */
    if (L.hair === 'long') { // longue chevelure qui flotte
      const hc = L.hairCol;
      poly(c, [hX - 3, hY - 18, hX - 18, hY - 10, hX - 22 + sway * 0.6, hY + 30, hX - 30 + sway * 1.5, hY + 70, hX - 36 + sway * 2, hY + 92, hX - 14 + sway * 1.2, hY + 84, hX - 6, hY + 32, hX + 3, hY - 6], hc, 2.2, true);
      line(c, [hX - 12, hY, hX - 18 + sway, hY + 40, hX - 26 + sway * 1.6, hY + 80], 'rgba(120,130,170,.35)', 2, true);
      line(c, [hX - 8, hY + 4, hX - 12 + sway, hY + 44, hX - 18 + sway * 1.4, hY + 76], 'rgba(255,255,255,.14)', 1.4, true);
    }
    if (L.hair === 'elder') poly(c, [hX + 6, hY - 19, hX - 12, hY - 21, hX - 24, hY - 8, hX - 28 + sway * 0.5, hY + 20, hX - 22 + sway, hY + 40, hX - 8, hY + 26, hX - 2, hY], L.hairCol, 2.2, true);
    if (L.band) { ribbon(c, hX - 15, hY - 9, 34, -24 + sway * 2.2, 5.5, L.band, T); ribbon(c, hX - 15, hY - 7, 27, -14 + sway * 2.6, 5, shade(L.band, 0.8), T + 9); }
    if (L.top === 'coat') { // pans du manteau
      const cP = [hipX - 16, hipY - 34, hipX - 30 + sway * 1.2, hipY + 34, hipX - 34 + sway * 2.2, hipY + 78, hipX - 12 + sway * 1.4, hipY + 70, hipX - 2 + sway * 0.6, hipY + 50, hipX + 6, hipY];
      poly(c, cP, '#141315', 2.2, true);
      line(c, [hipX - 22 + sway, hipY + 20, hipX - 26 + sway * 1.8, hipY + 64], 'rgba(255,255,255,.08)', 2, true);
    }
    weaponBack();
    if (L.arms4) {
      const t2 = [G.lerp(-10, p.bh[0] - 8, p.ex), G.lerp(-56, p.bh[1] + 22, p.ex)];
      arm([bS[0], bS[1] + 12], ik(bS[0], bS[1] + 12, bS[0] + t2[0], bS[1] + 12 + t2[1], UARM, FARM, p.ex > 0.5 ? 1 : -1), true);
    }
    arm(bS, bArm, true);
    leg(bLeg, true, hipX - 6);

    /* === TORSE === */
    const TB = B * MB;
    const torso = flat([at(-6, -15 * TB), at(18, -17 * TB), at(38, -22 * TB), at(54, -25 * TB), at(63, -18 * TB), at(66, -3), at(65, 8), at(60, 19 * TB), at(48, 23 * TB), at(38, 18 * TB), at(22, 15 * TB), at(-6, 15 * TB)]);
    const tcol = L.top === 'vest' || L.top === 'wrap' ? L.topCol : skin;
    c.beginPath(); c.moveTo(torso[0], torso[1]);
    for (let i = 2; i < torso.length - 2; i += 2) { const mx = (torso[i] + torso[i + 2]) / 2, my = (torso[i + 1] + torso[i + 3]) / 2; c.quadraticCurveTo(torso[i], torso[i + 1], mx, my); }
    c.lineTo(torso[torso.length - 2], torso[torso.length - 1]); c.closePath();
    if (MONO) { c.fillStyle = MONO; c.fill(); }
    else {
      const P = pal(tcol), a0 = at(34, 26 * TB), a1 = at(34, -26 * TB), g = c.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
      g.addColorStop(0, P.rim); g.addColorStop(0.18, P.hi); g.addColorStop(0.45, P.base); g.addColorStop(0.8, P.lo); g.addColorStop(1, P.deep);
      c.fillStyle = g; c.fill(); ink(c, 2.6);
      const SD = 'rgba(40,14,10,.42)', SL = 'rgba(40,14,10,.3)', HL = 'rgba(255,240,220,.22)';
      if (L.top === 'bare' || L.top === 'coat' || L.top === 'tank') { // anatomie
        const clav = flat([at(62, -6), at(63, 6), at(60, 15 * TB)]); line(c, clav, SL, 1.4, true);
        line(c, flat([at(42, 3), at(36, 12 * TB), at(40, 21 * TB)]), SD, 2, true); // bas des pectoraux
        line(c, flat([at(57, 4), at(45, 4)]), SL, 1.3);
        // grand pectoral : ombre
        c.save(); c.globalAlpha = 0.18; poly(c, flat([at(42, 3), at(36, 12 * TB), at(40, 21 * TB), at(33, 17 * TB), at(34, 4)]), '#3a1010', 0); c.restore();
        if (L.top !== 'tank') {
          line(c, flat([at(33, 9), at(5, 8)]), SL, 1.3); // ligne blanche
          for (const u of [29, 21, 13]) line(c, flat([at(u, 6), at(u + 1, 12 * TB), at(u, 16 * TB)]), SL, 1.3, true);
          line(c, flat([at(34, 17 * TB), at(16, 15 * TB), at(2, 12 * TB)]), SD, 1.6, true); // oblique
          line(c, flat([at(46, -18 * TB), at(30, -12 * TB), at(18, -14 * TB)]), SL, 1.3, true); // dorsal
          for (const u of [44, 38]) line(c, flat([at(u, 19 * TB), at(u - 3, 14 * TB)]), SL, 1); // dentelé
          disc(c, at(10, 11)[0], at(10, 11)[1], 1.3, '#4a1a12', 0, 1);
          line(c, flat([at(52, 10), at(46, 16 * TB)]), HL, 2.2, true); // reflet
        }
        if (L.scars) { for (const s of [[50, 2, 40, 16], [30, -10, 20, 4], [36, 14, 28, 20], [16, 6, 10, 16], [54, -10, 47, 0]]) { const a = at(s[0], s[1]), b = at(s[2], s[3]); line(c, [a[0], a[1], b[0], b[1]], '#a3352e', 2); line(c, [a[0] + 0.6, a[1] - 0.6, b[0] + 0.6, b[1] - 0.6], 'rgba(255,200,180,.4)', 0.8); } }
      }
      if (L.top === 'tank') {
        poly(c, flat([at(-4, -16 * TB), at(-4, 16 * TB), at(40, 20 * TB), at(55, 13), at(48, 4), at(57, -6), at(46, -22 * TB), at(20, -18 * TB)]), L.topCol, 2.2, true);
        line(c, flat([at(30, 12), at(16, 14 * TB), at(4, 12 * TB)]), 'rgba(60,40,30,.28)', 1.4, true);
        line(c, flat([at(40, -4), at(26, 2), at(12, -2)]), 'rgba(60,40,30,.22)', 1.4, true);
        line(c, flat([at(46, 16 * TB), at(28, 18 * TB)]), 'rgba(255,255,255,.5)', 2, true);
      }
      if (L.top === 'wrap') { // tunique croisée
        poly(c, flat([at(64, 2), at(60, 15), at(26, 12)]), skin, 1.8);
        line(c, flat([at(63, -14), at(36, 6), at(4, 14 * TB)]), 'rgba(110,70,20,.55)', 2, true);
        line(c, flat([at(50, -16), at(26, -4), at(8, 2)]), 'rgba(110,70,20,.3)', 1.4, true);
        line(c, flat([at(44, 15 * TB), at(20, 14 * TB)]), 'rgba(255,255,255,.35)', 2, true);
      }
      if (L.top === 'vest') { // gilet blanc à col montant
        line(c, flat([at(58, 9), at(30, 10), at(2, 8)]), 'rgba(60,50,40,.5)', 2, true);
        line(c, flat([at(50, -16), at(30, -10), at(10, -14)]), 'rgba(60,50,40,.25)', 1.4, true);
        line(c, flat([at(46, 16 * TB), at(24, 15 * TB)]), 'rgba(255,255,255,.55)', 2.2, true);
        poly(c, flat([at(60, -14), at(76, -11), at(77, 2), at(70, 9), at(59, 9)]), L.topCol, 2.2, true);
        line(c, flat([at(72, -9), at(73, 1)]), 'rgba(60,50,40,.35)', 1.2);
      }
      if (L.top === 'coat') { // revers du manteau ouvert
        poly(c, flat([at(64, -22 * TB), at(66, -6), at(36, -9), at(-2, -6), at(-4, -20 * TB)]), L.topCol, 2.2, true);
        line(c, flat([at(60, -10), at(34, -11), at(4, -10)]), 'rgba(255,255,255,.1)', 2, true);
        const e = at(50, -16); disc(c, e[0], e[1], 6.5, '#e8b63c', 1.6); disc(c, e[0], e[1], 3, '#7a5418', 0, 1);
      }
      if (L.chain) { // chaîne d'or et anneau
        c.strokeStyle = '#d9a23a'; c.lineWidth = 2.6; c.setLineDash([3, 1.6]); c.beginPath(); const a = at(64, 2), b = at(36, 16 * TB), m = at(44, 4); c.moveTo(a[0], a[1]); c.quadraticCurveTo(m[0], m[1], b[0], b[1]); c.stroke(); c.setLineDash([]);
        c.beginPath(); c.arc(b[0], b[1] + 3, 4.6, 0, 7); c.strokeStyle = INK; c.lineWidth = 4.4; c.stroke(); c.strokeStyle = '#e8b63c'; c.lineWidth = 2.6; c.stroke();
      }
      if (L.neck) { const n = at(64, 4); disc(c, n[0], n[1], 7, '#e8b63c', 1.6); disc(c, n[0], n[1], 3.4, '#f7e08a', 0, 1); }
    }

    /* === JAMBE AVANT + CEINTURE === */
    leg(fLeg, false, hipX + 5);
    const bx = fx * 18 * B, by = fy * 18 * B;
    muscle(c, hipX - bx, hipY - 3 - by, hipX + bx, hipY - 3 + by, 14, 14, L.sash, { b1: 0.05, b2: 0.05, lw: 2 });
    if (!MONO) line(c, [hipX - bx * 0.7, hipY - 6 - by * 0.7, hipX + bx * 0.8, hipY - 6 + by * 0.8], 'rgba(255,255,255,.22)', 1.6);
    poly(c, [hipX + bx * 0.45 - 4, hipY - 8, hipX + bx * 0.45 + 5, hipY - 8, hipX + bx * 0.45 + 6, hipY + 3, hipX + bx * 0.45 - 5, hipY + 3], shade(L.sash, 0.86), 1.8); // nœud
    ribbon(c, hipX + bx * 0.5, hipY + 2, 46, sway * 2.2 - 4, 9, L.sash, T);
    ribbon(c, hipX + bx * 0.2, hipY + 2, 38, sway * 2.8 - 10, 8, shade(L.sash, 0.82), T + 13);
    if (L.cloth) { poly(c, [hipX + 2, hipY + 2, hipX + 19, hipY + 2, hipX + 22 + sway, hipY + 50, hipX + 3 + sway, hipY + 54], L.cloth, 2, true); if (!MONO) { for (let i = 0; i < 3; i++) line(c, [hipX + 6 + i * 4, hipY + 10, hipX + 7 + i * 4 + sway * 0.6, hipY + 44], 'rgba(255,230,120,.5)', 1.2); } }

    /* === TÊTE === */
    const nk = 15 * B * MB;
    muscle(c, shX, shY + 6, hX - 1, hY + 8, nk, nk * 0.88, skin, { b1: 0.04, b2: 0.04, lw: 2.2 });
    if (!MONO) line(c, [shX + 6, shY + 4, hX + 2, hY + 12], 'rgba(40,14,10,.3)', 1.3);
    if (L.hair === 'afro') { // grand afro en nuage
      const blobs = [[-6, -18, 24], [10, -22, 17], [-22, -8, 16], [-16, -31, 16], [4, -36, 15], [20, -14, 10], [-28, -21, 11], [-8, -42, 10], [16, -32, 11]];
      if (!MONO) { c.fillStyle = INK; for (const b of blobs) { c.beginPath(); c.arc(hX + b[0], hY + b[1], b[2] + 2.6, 0, 7); c.fill(); } }
      for (const b of blobs) disc(c, hX + b[0], hY + b[1], b[2], L.hairCol, 0);
      if (!MONO) { c.strokeStyle = 'rgba(160,150,190,.22)'; c.lineWidth = 1.4; for (const b of blobs) { c.beginPath(); c.arc(hX + b[0], hY + b[1], b[2] * 0.66, PI * 1.05, PI * 1.55); c.stroke(); } c.fillStyle = 'rgba(0,0,0,.25)'; const r = G.rng(3); for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(hX - 24 + r() * 46, hY - 46 + r() * 42, 1 + r(), 0, 7); c.fill(); } }
    }
    c.save(); c.translate(hX, hY); c.rotate(ha * 0.7);
    // contour de la tête de trois quarts (crâne, front, nez, lèvres, menton, mâchoire)
    c.beginPath();
    c.moveTo(-14, 8); c.bezierCurveTo(-19, -4, -16, -18, -3, -20); c.bezierCurveTo(8, -21, 14, -15, 15, -7);
    c.lineTo(16.4, -3.5); c.lineTo(19.6, 2.6); c.quadraticCurveTo(19, 4.4, 16.2, 4.6); c.quadraticCurveTo(17.4, 6.6, 16.2, 8); c.quadraticCurveTo(17, 9.4, 15.2, 10.6);
    c.quadraticCurveTo(15.4, 15, 11, 16.6); c.quadraticCurveTo(4, 17.4, -2, 13); c.quadraticCurveTo(-8, 11, -14, 8); c.closePath();
    if (MONO) { c.fillStyle = MONO; c.fill(); }
    else {
      const P = pal(skin), g = c.createLinearGradient(16, -10, -14, 10); g.addColorStop(0, P.hi); g.addColorStop(0.4, P.base); g.addColorStop(0.85, P.lo); g.addColorStop(1, P.deep);
      c.fillStyle = g; c.fill(); ink(c, 2.4);
      // modelé du visage
      c.save(); c.globalAlpha = 0.22; poly(c, [4, 2, 11, 4, 13, 12, 4, 14, -2, 9], '#3a1410', 0, true); c.restore();
      line(c, [15.2, -2, 17.5, 2.4, 15.6, 3.6], 'rgba(40,14,10,.55)', 1.3); // narine
      line(c, [3, 10, 8, 9.5], 'rgba(255,240,220,.25)', 1.4);
      // oreille
      c.beginPath(); c.ellipse(-4, 1, 3.6, 5.6, -0.15, 0, 7); c.fillStyle = shade(skin, 0.9); c.fill(); ink(c, 1.8); line(c, [-4.6, -2, -2.6, 1, -4.4, 4], 'rgba(40,14,10,.55)', 1.2);
      if (L.ring || L.gold) { c.beginPath(); c.arc(-4, 8, 2.8, 0, 7); c.strokeStyle = '#e8b63c'; c.lineWidth = 1.8; c.stroke(); }
      const hurt = opt.hurt;
      // sourcil épais et œil
      if (L.hair === 'elder') poly(c, [2, -9, 9, -12, 16, -9, 14, -6, 8, -8, 3, -6], L.hairCol, 1.4);
      else poly(c, [3, -8.6, 10, -10, 15.5, -7.2, 14.6, -5.6, 9, -7.4, 3.4, -6.4], hurt ? INK : shade(L.hairCol, 0.9), 1.2);
      if (!L.glasses) {
        if (hurt) line(c, [6.5, -2.6, 13, -3.6], INK, 2);
        else {
          c.beginPath(); c.moveTo(6, -2.6); c.quadraticCurveTo(10, -6, 14, -3.4); c.quadraticCurveTo(10, -0.6, 6, -2.6); c.closePath(); c.fillStyle = '#f6efe6'; c.fill();
          c.beginPath(); c.arc(11, -3, 2.1, 0, 7); c.fillStyle = L.eye || '#3a2214'; c.fill();
          c.beginPath(); c.arc(11.2, -3, 1, 0, 7); c.fillStyle = INK; c.fill();
          c.beginPath(); c.arc(10.4, -3.8, 0.7, 0, 7); c.fillStyle = '#fff'; c.fill();
          line(c, [5.6, -2.8, 9, -5.8, 14.4, -3.6], INK, 1.8, true); // paupière
          line(c, [7, -1.2, 12, -1.4], 'rgba(40,14,10,.4)', 0.9);
        }
      }
      // bouche
      if (hurt) { poly(c, [10.5, 9, 15, 7.6, 14.4, 11.6, 11, 11.4], '#3a0c0c', 1.2); }
      else { line(c, [10, 9.2, 15.4, 8.4], INK, 1.8); line(c, [11, 11.2, 14.6, 10.6], 'rgba(40,14,10,.35)', 1.3); }
      if (L.beard) { // barbe taillée
        poly(c, [-6, 10, -1, 13.5, 5, 16.8, 11, 17.2, 15.6, 14.6, 16.4, 11, 13, 13, 8, 13.2, 3, 11, -2, 7.4], L.hairCol, 1.4, true);
        line(c, [9.6, 7.4, 16, 6.6], L.hairCol, 2.2);
        c.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(-3 + i * 1.8, 2 + (i % 3) * 1.6, 0.5, 0, 7); c.fill(); }
      }
      if (L.stache) { line(c, [9, 6.6, 12, 6, 16, 7], L.hairCol, 2.6); line(c, [10, 12, 12.6, 14.6], L.hairCol, 2.2); }
      if (L.hair === 'elder') { // barbe et moustache blanches
        poly(c, [-2, 8, 6, 13, 12, 13, 17, 9, 19, 16, 14, 28, 6, 40, 2, 30, -3, 18], L.hairCol, 1.8, true);
        line(c, [8, 6.8, 13, 6, 19, 9, 22, 13], L.hairCol, 3.6, true);
        line(c, [4, 18, 7, 30], 'rgba(150,150,170,.5)', 1); line(c, [10, 17, 11, 28], 'rgba(150,150,170,.5)', 1);
      }
      if (L.glasses) { // lunettes rondes
        disc(c, 10.5, -3, 6.2, '#0d0d12', 0, 1); c.beginPath(); c.arc(10.5, -3, 6.2, 0, 7); c.strokeStyle = '#d9a23a'; c.lineWidth = 1.8; c.stroke();
        line(c, [4.4, -3.4, -5, -4], '#d9a23a', 1.6);
        c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(8.6, -5, 2, 1.1, -0.5, 0, 7); c.fill();
      }
      // coiffures (dessus de tête)
      if (L.hair === 'afro') {
        c.fillStyle = L.hairCol; c.beginPath(); c.arc(-1, -5, 16, PI * 1.02, PI * 1.84); c.fill();
        poly(c, [-17, -13, 16, -12, 17, -3.4, -17, -4.6], L.band, 2);
        line(c, [-15, -10, 14, -9.4], 'rgba(255,255,255,.2)', 1.4);
        poly(c, [5, -13.4, 16.6, -12.8, 17, -3, 5, -3.6], '#b9c0c4', 1.6);
        if (!MONO) { line(c, [8, -11.4, 15, -11.2], 'rgba(255,255,255,.7)', 1.2); poly(c, [11.8, -11.6, 9.2, -8, 11.6, -8, 9.8, -5], 'rgba(0,0,0,0)', 0); line(c, [12.4, -11.6, 9.4, -8.2, 12, -8, 9.4, -4.6], '#4a5560', 1.4); }
      } else if (L.hair === 'buzz') { // côtés rasés, crête nouée
        c.save(); c.globalAlpha = 0.85; c.fillStyle = shade(L.hairCol, 1.25); c.beginPath(); c.arc(-1, -4, 16.2, PI * 1.02, PI * 1.78); c.fill(); c.restore();
        c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 30; i++) { const a = PI * (1.05 + (i % 10) * 0.07), r = 12 + ((i / 10) | 0) * 1.6; c.fillRect(-1 + Math.cos(a) * r, -4 + Math.sin(a) * r, 1, 1); }
        poly(c, [-10, -16, -14, -28, -6, -24, -3, -36, 3, -25, 8, -31, 9, -22, 13, -26, 10, -15], L.hairCol, 2, true);
        line(c, [-4, -24, -2, -32], 'rgba(255,255,255,.18)', 1.4);
      } else if (L.hair === 'short') { // boucles courtes
        c.fillStyle = L.hairCol; c.beginPath(); c.arc(-1, -4, 16.8, PI * 0.95, PI * 1.84); c.fill();
        for (const b of [[-10, -16, 5.6], [-3, -19, 6], [5, -18, 5.4], [11, -14, 4.2], [-15, -10, 5], [-15, -2, 3.6]]) disc(c, b[0], b[1], b[2], L.hairCol, 0, 1);
        c.strokeStyle = 'rgba(150,150,190,.3)'; c.lineWidth = 1; for (const b of [[-10, -16], [-3, -19], [5, -18]]) { c.beginPath(); c.arc(b[0], b[1], 3, PI * 1.1, PI * 1.7); c.stroke(); }
        c.beginPath(); c.arc(-1, -4, 16.8, PI * 0.95, PI * 1.84); ink(c, 2);
      } else if (L.hair === 'spiky') { // mèches rouges en pointes
        poly(c, [-18, 3, -24, -9, -33, -14, -22, -19, -28, -33, -14, -26, -11, -42, -2, -28, 8, -39, 10, -25, 22, -30, 16, -17, 24, -9, 14, -9.6, 16, -2, 8, -11, 2, -6, -4, -12, -12, -5], L.hairCol, 2.2);
        if (!MONO) { line(c, [-8, -26, -2, -14], 'rgba(255,180,160,.5)', 1.6); line(c, [4, -30, 6, -16], 'rgba(255,180,160,.45)', 1.4); line(c, [-20, -16, -12, -8], 'rgba(120,0,10,.5)', 1.4); }
      } else if (L.hair === 'elder') {
        poly(c, [-15, -8, -18, -18, -6, -25, 9, -23, 16, -12, 9, -15, 2, -10, -6, -13], L.hairCol, 2, true);
        line(c, [-12, -16, 2, -22], 'rgba(150,150,170,.6)', 1.2);
      } else if (L.hair === 'long') {
        c.fillStyle = L.hairCol; c.beginPath(); c.arc(-1, -4, 17, PI * 0.9, PI * 1.9); c.fill();
        poly(c, [12, -15, 18, -4, 15.6, 16, 11, 2, 9, -9], L.hairCol, 0);
        if (!MONO) { line(c, [-8, -18, 4, -20, 12, -14], 'rgba(150,160,200,.4)', 1.6, true); c.beginPath(); c.arc(-1, -4, 17, PI * 0.9, PI * 1.9); ink(c, 2); }
      }
    }
    c.restore();

    /* === BRAS AVANT (+ arme, + deuxième paire) === */
    if (L.arms4) {
      const t1 = [G.lerp(16, p.fh[0] - 4, p.ex), G.lerp(-58, p.fh[1] + 24, p.ex)];
      arm([fS[0], fS[1] + 12], ik(fS[0], fS[1] + 12, fS[0] + t1[0], fS[1] + 12 + t1[1], UARM, FARM, p.ex > 0.5 ? 1 : -1), false);
    }
    weaponFront();
    arm(fS, fArm, false);
    c.restore();
    MONO = null;
    const tip = wp && wp.kind !== 'glove' ? bladeTip(wp, p.sw, fArm[2], fArm[3]) : [fArm[2], fArm[3]];
    return { hand: [fArm[2], fArm[3]], bhand: [bArm[2], bArm[3]], foot: [fLeg[2], fLeg[3]], head: [hX, hY], chest: [shX, shY + 20], tip };
  };

  /* Arme seule, pour la boutique */
  G.drawWeapon = function (c, w, x, y, ang, scale, t) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    MONO = null;
    if (w.kind === 'glove') { // gantelet de présentation : poing fermé, plaques, manchette
      const fire = w.id === 'brasier', base = fire ? '#a51e25' : '#178f6e', hi = fire ? '#e0473d' : '#3fd3a4', dk = fire ? '#5a0d12' : '#0b4d3b', trim = '#d9b24a';
      c.rotate(-0.35);
      // aura
      const g0 = c.createRadialGradient(10, 0, 4, 10, 0, 70); g0.addColorStop(0, fire ? 'rgba(255,120,40,.45)' : 'rgba(60,255,190,.35)'); g0.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g0; c.fillRect(-80, -70, 160, 140);
      // manchette (avant-bras)
      c.beginPath(); c.moveTo(-58, -15); c.lineTo(-6, -19); c.quadraticCurveTo(2, 0, -6, 19); c.lineTo(-58, 15); c.quadraticCurveTo(-64, 0, -58, -15); c.closePath();
      let g = c.createLinearGradient(0, -19, 0, 19); g.addColorStop(0, hi); g.addColorStop(0.45, base); g.addColorStop(1, dk); c.fillStyle = g; c.fill(); ink(c, 2.4);
      c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) { const x = -52 + i * 10; c.beginPath(); c.moveTo(x, -20); c.quadraticCurveTo(x + 5, 0, x, 20); c.stroke(); }
      c.restore();
      c.beginPath(); c.moveTo(-14, -19); c.quadraticCurveTo(-6, 0, -14, 19); c.lineWidth = 4; c.strokeStyle = trim; c.stroke(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke();
      // poing
      c.beginPath(); c.moveTo(-8, -20); c.quadraticCurveTo(10, -26, 28, -20); c.quadraticCurveTo(38, -16, 38, -4); c.lineTo(38, 10); c.quadraticCurveTo(37, 22, 24, 23); c.lineTo(-4, 22); c.quadraticCurveTo(-12, 0, -8, -20); c.closePath();
      g = c.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, hi); g.addColorStop(0.5, base); g.addColorStop(1, dk); c.fillStyle = g; c.fill(); ink(c, 2.6);
      // jointures (plaques)
      for (let i = 0; i < 4; i++) { const y = -15 + i * 9.5; c.beginPath(); c.moveTo(26, y - 3.6); c.quadraticCurveTo(41, y, 26, y + 3.6); c.closePath(); c.fillStyle = fire ? '#d8d2c8' : trim; c.fill(); ink(c, 1.4); }
      // pouce replié
      c.beginPath(); c.moveTo(2, 10); c.quadraticCurveTo(14, 6, 22, 12); c.quadraticCurveTo(24, 18, 16, 19); c.quadraticCurveTo(6, 19, 2, 16); c.closePath(); c.fillStyle = dk; c.fill(); ink(c, 1.6);
      // reflet
      c.beginPath(); c.moveTo(-2, -15); c.quadraticCurveTo(12, -20, 26, -15); c.lineWidth = 2.4; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
      if (fire) { // runes qui brûlent
        c.save(); c.globalCompositeOperation = 'lighter'; c.shadowColor = '#ff8a1f'; c.shadowBlur = 8; c.strokeStyle = '#ffb04a'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(4, -8); c.lineTo(14, -10); c.lineTo(10, -2); c.lineTo(19, -3); c.moveTo(-44, -6); c.lineTo(-36, 0); c.lineTo(-44, 6); c.moveTo(-30, -7); c.lineTo(-24, 7); c.stroke(); c.restore();
        for (let i = 0; i < 5; i++) { const k = ((t || 0) * 0.02 + i * 0.21) % 1; c.fillStyle = 'rgba(255,' + (140 + i * 20) + ',40,' + (1 - k) * 0.8 + ')'; c.beginPath(); c.arc(30 + Math.sin(i * 3) * 8, -24 - k * 40, 3 * (1 - k) + 1, 0, 7); c.fill(); }
      } else { // bandes de jade et ruban
        ribbon(c, -40, -12, 46, -24, 5, '#2fd8a8', t);
        c.strokeStyle = trim; c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i < 3; i++) { const x = -46 + i * 12; c.moveTo(x, -16); c.lineTo(x + 6, 16); } c.stroke();
        disc(c, 12, -4, 4, '#3dffc0', 1.4);
      }
    } else {
      drawBlade(c, w, ang, 0, 0, t, 0);
      if (w.kind === 'twin') { drawBlade(c, w, ang + 18, 16, 14, t, 1); const a = pommel(w, ang, 0, 0), b = pommel(w, ang + 18, 16, 14); chainPath(c, a[0], a[1], b[0], b[1], 30, w.id === 'sceaux' ? '#6dff5a' : '#1b1b20', w.id === 'sceaux' ? '#5dff4a' : null, t); }
      if (w.kind === 'kama') { const a = pommel(w, ang, 0, 0); chainPath(c, a[0], a[1], a[0] + 10, a[1] + 40, 24, '#c9a23a', null, t); disc(c, a[0] + 10, a[1] + 40, 7, '#6a2a1a', 2); }
    }
    c.restore();
  };

  /* Vignette (portrait) d'un personnage sur un petit canvas */
  G.portrait = function (ch, w, h, zoom, full, weapon) {
    const cv = document.createElement('canvas'); const d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const c = cv.getContext('2d'); c.scale(d, d);
    const z = zoom || 1.5;
    if (full) c.translate(w / 2 - 4 * z, h - 8 * z); else c.translate(w / 2 - 6 * z, h + 118 * z);
    c.scale(z, z);
    const pose = G.poseClone(POSES[(ch.poses && ch.poses.idle) || 'idle']);
    G.drawFighter(c, ch, pose, 0, { weapon: weapon === undefined ? undefined : weapon });
    return cv;
  };
})();
