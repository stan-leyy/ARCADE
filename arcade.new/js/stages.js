/* ARCADE — arènes : décors dessinés par code, en couches (parallaxe) + particules animées */
(function () {
  const G = window.G, SW = G.STAGE_W, H = G.H, GY = G.GROUND, Q = 1.5; // Q = qualité des couches pré-rendues

  function layer(w, draw) {
    const cv = document.createElement('canvas'); cv.width = w * Q; cv.height = H * Q;
    const c = cv.getContext('2d'); c.scale(Q, Q); draw(c, w); return cv;
  }
  function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s) => g.addColorStop(s[0], s[1])); return g; }
  function glow(c, x, y, r, col0, col1) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col0); g.addColorStop(1, col1); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }

  function torii(c, x, y, s, col) { // portail (silhouette)
    c.fillStyle = col;
    c.fillRect(x - 46 * s, y - 120 * s, 9 * s, 120 * s); c.fillRect(x + 37 * s, y - 120 * s, 9 * s, 120 * s);
    c.fillRect(x - 54 * s, y - 100 * s, 108 * s, 7 * s);
    c.beginPath(); c.moveTo(x - 70 * s, y - 132 * s); c.quadraticCurveTo(x, y - 120 * s, x + 70 * s, y - 132 * s);
    c.lineTo(x + 64 * s, y - 118 * s); c.quadraticCurveTo(x, y - 108 * s, x - 64 * s, y - 118 * s); c.closePath(); c.fill();
    c.fillRect(x - 5 * s, y - 116 * s, 10 * s, 18 * s);
  }
  function pagoda(c, x, y, s, col, ruined, r) { // maison à toit courbe, éventuellement en ruine
    c.fillStyle = col;
    c.fillRect(x - 50 * s, y - 46 * s, 100 * s, 46 * s);
    c.beginPath(); c.moveTo(x - 82 * s, y - 44 * s); c.quadraticCurveTo(x - 40 * s, y - 60 * s, x - 30 * s, y - 86 * s);
    c.lineTo(x + (ruined ? 6 : 30) * s, y - (ruined ? 80 : 86) * s);
    if (ruined) { c.lineTo(x + 14 * s, y - 66 * s); c.lineTo(x + 30 * s, y - 72 * s); }
    c.quadraticCurveTo(x + 40 * s, y - 60 * s, x + 82 * s, y - 44 * s); c.closePath(); c.fill();
    if (ruined) { for (let i = 0; i < 4; i++) c.fillRect(x + (-60 + r() * 120) * s, y - (90 + r() * 40) * s, 3 * s, (40 + r() * 30) * s); }
  }
  function sword(c, x, y, s, a, col) { // sabre planté
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col;
    c.fillRect(-2 * s, -70 * s, 4 * s, 70 * s); c.fillRect(-9 * s, -74 * s, 18 * s, 4 * s); c.fillRect(-2.5 * s, -96 * s, 5 * s, 22 * s);
    c.restore();
  }
  function spire(c, x, y, w, h, r, col) { // piton rocheux
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w / 2, y);
    let px = x - w / 2; const n = 7;
    for (let i = 1; i <= n; i++) { const t = i / n; px = x - w / 2 + w * t; const k = Math.sin(t * Math.PI); c.lineTo(px - w / n * (0.3 + r() * 0.5), y - h * Math.pow(k, 0.55) * (0.8 + r() * 0.25)); }
    c.lineTo(x + w / 2, y); c.closePath(); c.fill();
  }

  const STAGES = [
    {
      id: 'lames', name: 'Champ des Lames', sub: 'Crépuscule sur le champ de bataille', ground: '#8d2a1f', dust: '#e9a070',
      parts: { kind: 'ember', n: 46 },
      build() {
        const r = G.rng(7);
        const far = layer(1160, (c, w) => {
          c.fillStyle = grad(c, 0, 0, 0, H, [[0, '#f3a57c'], [0.38, '#f7b78a'], [0.62, '#f49a66'], [1, '#e2603c']]); c.fillRect(0, 0, w, H);
          glow(c, 600, 300, 420, 'rgba(255,240,214,.75)', 'rgba(255,220,180,0)');
          c.fillStyle = '#fff3df'; c.beginPath(); c.arc(600, 318, 96, 0, 7); c.fill();
          c.fillStyle = 'rgba(214,110,84,.45)';
          for (let i = 0; i < 9; i++) { const x = r() * w, y = 40 + r() * 170, ww = 160 + r() * 260; c.beginPath(); c.ellipse(x, y, ww, 7 + r() * 9, 0, 0, 7); c.fill(); }
          c.fillStyle = '#e98a63'; c.beginPath(); c.moveTo(0, 360);
          for (let x = 0; x <= w; x += 40) c.lineTo(x, 345 - Math.sin(x * 0.006 + 1) * 28 - r() * 14); c.lineTo(w, H); c.lineTo(0, H); c.fill();
          torii(c, 820, 392, 0.5, '#d9704f'); torii(c, 380, 388, 0.36, '#df7b58'); pagoda(c, 980, 392, 0.6, '#dd7755', 0, r); pagoda(c, 190, 390, 0.5, '#e07f5c', 1, r);
        });
        const mid = layer(1380, (c, w) => {
          torii(c, 690, 440, 1.5, '#a8402c');
          pagoda(c, 190, 438, 1.5, '#b5492f', 1, r); pagoda(c, 1220, 436, 1.7, '#ad4530', 1, r); pagoda(c, 1010, 430, 0.9, '#c2573a', 0, r);
          c.strokeStyle = '#8f3626'; c.lineWidth = 4;
          for (const p of [[330, 0.08], [470, -0.12], [900, 0.1], [1110, -0.05]]) {
            c.save(); c.translate(p[0], 440); c.rotate(p[1]); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -150); c.stroke();
            c.fillStyle = '#a23b2a'; c.beginPath(); c.moveTo(0, -150); c.lineTo(34, -140); c.lineTo(26, -118); c.lineTo(38, -96); c.lineTo(0, -104); c.fill(); c.restore();
          }
          c.fillStyle = 'rgba(255,214,170,.33)';
          for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(r() * w, 380 + r() * 60, 200 + r() * 200, 16 + r() * 14, 0, 0, 7); c.fill(); }
          for (const f of [[240, 360], [1180, 350], [1040, 380]]) glow(c, f[0], f[1], 60, 'rgba(255,170,60,.55)', 'rgba(255,120,40,0)');
        });
        const ground = layer(SW, (c, w) => {
          c.fillStyle = grad(c, 0, GY - 26, 0, H, [[0, '#d5562f'], [0.25, '#b93a26'], [1, '#6e1a1c']]);
          c.beginPath(); c.moveTo(0, GY - 20); for (let x = 0; x <= w; x += 30) c.lineTo(x, GY - 20 - Math.sin(x * 0.01) * 3 - r() * 3); c.lineTo(w, H); c.lineTo(0, H); c.fill();
          for (let i = 0; i < 1500; i++) {
            const x = r() * w, y = GY - 22 + r() * r() * 110, hh = 6 + r() * 14 + (y - GY) * 0.1;
            c.strokeStyle = r() < 0.5 ? 'rgba(239,120,70,.6)' : 'rgba(110,22,26,.55)'; c.lineWidth = 1 + r() * 1.4;
            c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 2, y - hh * 0.6, x + 5 + r() * 5, y - hh); c.stroke();
          }
          for (const s of [[90, 0.2, 1], [210, -0.3, 0.8], [640, 0.12, 0.7], [760, -0.2, 1], [1260, 0.25, 0.9], [1420, -0.1, 1.1], [1010, 0.3, 0.6]]) sword(c, s[0], GY - 10 + r() * 14, s[2], s[1], '#5c1c20');
          c.fillStyle = '#5a1a20';
          for (const k of [[320, 30], [980, 44], [1340, 34], [40, 38]]) { c.beginPath(); c.moveTo(k[0], H); c.quadraticCurveTo(k[0] + k[1], H - k[1] * 1.5, k[0] + k[1] * 2.6, H); c.fill(); }
        });
        return { far, mid, ground };
      },
    },
    {
      id: 'canyon', name: 'Canyon d’Ocre', sub: 'Les pitons rouges du désert', ground: '#b5532f', dust: '#f2c29a',
      parts: { kind: 'dust', n: 40 },
      build() {
        const r = G.rng(21);
        const far = layer(1160, (c, w) => {
          c.fillStyle = grad(c, 0, 0, 0, H, [[0, '#8f7fa6'], [0.3, '#d99aa0'], [0.62, '#f7c08a'], [1, '#f3a25e']]); c.fillRect(0, 0, w, H);
          glow(c, 170, 110, 430, 'rgba(255,244,210,.95)', 'rgba(255,214,150,0)');
          c.fillStyle = 'rgba(255,240,225,.28)';
          for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(r() * w, 30 + r() * 150, 150 + r() * 250, 10 + r() * 16, -0.08, 0, 7); c.fill(); }
          for (let i = 0; i < 9; i++) spire(c, 60 + i * 135 + r() * 50, 420, 90 + r() * 90, 120 + r() * 150, r, '#eba878');
          c.fillStyle = 'rgba(255,226,190,.4)'; c.fillRect(0, 330, w, 120);
        });
        const mid = layer(1380, (c, w) => {
          spire(c, 150, 446, 260, 400, r, '#b9532f'); spire(c, 1240, 446, 300, 330, r, '#b04a2b'); spire(c, 880, 446, 120, 250, r, '#c9653b'); spire(c, 1010, 446, 110, 190, r, '#c25c36');
          // arche
          c.fillStyle = '#c9653b'; c.beginPath(); c.moveTo(430, 446); c.lineTo(450, 300); c.quadraticCurveTo(560, 200, 700, 250); c.lineTo(730, 300); c.lineTo(716, 446); c.lineTo(668, 446);
          c.quadraticCurveTo(672, 310, 590, 296); c.quadraticCurveTo(510, 300, 500, 446); c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,190,130,.22)';
          for (let i = 0; i < 26; i++) { const x = r() * w, y = 160 + r() * 260; c.fillRect(x, y, 14 + r() * 40, 2 + r() * 3); }
          c.fillStyle = 'rgba(255,214,170,.28)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(r() * w, 400 + r() * 40, 240, 18, 0, 0, 7); c.fill(); }
        });
        const ground = layer(SW, (c, w) => {
          c.fillStyle = grad(c, 0, GY - 22, 0, H, [[0, '#e08a55'], [0.3, '#c5633a'], [1, '#7c3220']]); c.fillRect(0, GY - 20, w, H);
          c.strokeStyle = 'rgba(100,36,22,.45)'; c.lineWidth = 1.6;
          for (let i = 0; i < 46; i++) { let x = r() * w, y = GY - 8 + r() * 80; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += 14 + r() * 30; y += (r() - 0.5) * 12; c.lineTo(x, y); } c.stroke(); }
          for (let i = 0; i < 160; i++) { const x = r() * w, y = GY - 14 + r() * 96, s = 1.5 + r() * 5; c.fillStyle = r() < 0.5 ? '#8a3a24' : '#eaa06c'; c.beginPath(); c.ellipse(x, y, s * 1.5, s, 0, 0, 7); c.fill(); }
          c.fillStyle = '#6d2a1c'; for (const k of [[60, 50], [1380, 60], [700, 30]]) { c.beginPath(); c.moveTo(k[0] - k[1], H); c.lineTo(k[0] - k[1] * 0.4, H - k[1] * 1.3); c.lineTo(k[0] + k[1] * 0.5, H - k[1]); c.lineTo(k[0] + k[1] * 1.2, H); c.fill(); }
        });
        return { far, mid, ground };
      },
    },
    {
      id: 'lune', name: 'Sanctuaire de la Lune', sub: 'Nuit de pétales au vieux temple', ground: '#2a2740', dust: '#cfc8ff',
      parts: { kind: 'petal', n: 54 },
      build() {
        const r = G.rng(99);
        const far = layer(1160, (c, w) => {
          c.fillStyle = grad(c, 0, 0, 0, H, [[0, '#0f1030'], [0.5, '#2a2360'], [0.85, '#6a3f7c'], [1, '#a35a7a']]); c.fillRect(0, 0, w, H);
          c.fillStyle = '#fff'; for (let i = 0; i < 150; i++) { c.globalAlpha = 0.25 + r() * 0.7; c.fillRect(r() * w, r() * 300, 1.4, 1.4); } c.globalAlpha = 1;
          glow(c, 790, 150, 300, 'rgba(240,230,255,.5)', 'rgba(200,190,255,0)');
          c.fillStyle = '#f6efe2'; c.beginPath(); c.arc(790, 150, 78, 0, 7); c.fill();
          c.fillStyle = 'rgba(190,180,215,.5)'; for (const m of [[770, 130, 16], [816, 172, 11], [760, 176, 7]]) { c.beginPath(); c.arc(m[0], m[1], m[2], 0, 7); c.fill(); }
          c.fillStyle = '#3a2c66'; c.beginPath(); c.moveTo(0, 380); for (let x = 0; x <= w; x += 50) c.lineTo(x, 350 - Math.abs(Math.sin(x * 0.005)) * 90 - r() * 16); c.lineTo(w, H); c.lineTo(0, H); c.fill();
          c.fillStyle = 'rgba(160,120,190,.25)'; c.fillRect(0, 340, w, 110);
        });
        const mid = layer(1380, (c, w) => {
          // pagode à étages
          const px = 700, col = '#1b1638';
          c.fillStyle = col;
          for (let i = 0; i < 4; i++) { const y = 440 - i * 74, s = 1.5 - i * 0.26; c.fillRect(px - 62 * s, y - 60, 124 * s, 60); c.beginPath(); c.moveTo(px - 128 * s, y - 52); c.quadraticCurveTo(px - 70 * s, y - 66, px - 54 * s, y - 86); c.lineTo(px + 54 * s, y - 86); c.quadraticCurveTo(px + 70 * s, y - 66, px + 128 * s, y - 52); c.closePath(); c.fill(); }
          c.fillRect(px - 3, 110, 6, 50);
          c.fillStyle = '#ffcf7a'; for (const wn of [[-40, 400], [0, 400], [40, 400], [-22, 326], [22, 326], [0, 252]]) c.fillRect(px + wn[0] - 7, wn[1], 14, 20);
          torii(c, 250, 444, 1.25, '#3a1730'); torii(c, 1150, 444, 1.25, '#3a1730');
          // bambous
          for (let i = 0; i < 26; i++) { const x = (i < 13 ? 0 : 1250) + r() * 130, hh = 240 + r() * 200; c.strokeStyle = i % 2 ? '#15223a' : '#1c2d44'; c.lineWidth = 5 + r() * 4; c.beginPath(); c.moveTo(x, 446); c.quadraticCurveTo(x + 10, 446 - hh / 2, x + (r() - 0.5) * 60, 446 - hh); c.stroke(); }
          // lanternes de pierre
          for (const lx of [440, 960]) { c.fillStyle = '#2b2748'; c.fillRect(lx - 7, 396, 14, 50); c.fillRect(lx - 16, 372, 32, 26); c.beginPath(); c.moveTo(lx - 24, 374); c.lineTo(lx, 352); c.lineTo(lx + 24, 374); c.fill(); c.fillStyle = '#ffd98a'; c.fillRect(lx - 8, 378, 16, 14); glow(c, lx, 385, 70, 'rgba(255,200,110,.5)', 'rgba(255,160,80,0)'); }
          // cerisiers
          for (const t of [[100, 1], [1300, 1.1]]) { c.strokeStyle = '#20132c'; c.lineWidth = 14 * t[1]; c.lineCap = 'round'; c.beginPath(); c.moveTo(t[0], 446); c.quadraticCurveTo(t[0] + 20, 330, t[0] - 16, 250); c.moveTo(t[0] + 8, 340); c.quadraticCurveTo(t[0] + 60, 290, t[0] + 84, 240); c.stroke(); c.lineCap = 'butt'; for (let i = 0; i < 42; i++) { c.fillStyle = ['#f3a6c4', '#e77fae', '#ffd0e2'][i % 3]; c.globalAlpha = 0.85; c.beginPath(); c.arc(t[0] - 70 + r() * 190, 170 + r() * 120, 14 + r() * 20, 0, 7); c.fill(); } c.globalAlpha = 1; }
        });
        const ground = layer(SW, (c, w) => {
          c.fillStyle = grad(c, 0, GY - 22, 0, H, [[0, '#4a4470'], [0.3, '#34304f'], [1, '#14122a']]); c.fillRect(0, GY - 20, w, H);
          c.strokeStyle = 'rgba(12,10,30,.6)'; c.lineWidth = 2;
          for (let row = 0; row < 5; row++) { const y = GY - 20 + row * row * 7 + row * 8; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); const step = 90 + row * 22; for (let x = (row % 2) * step / 2; x < w; x += step) { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 8, y + 16 + row * 12); c.stroke(); } }
          c.fillStyle = 'rgba(255,214,150,.10)'; for (const lx of [470, 1050]) { c.beginPath(); c.ellipse(lx, GY + 10, 180, 26, 0, 0, 7); c.fill(); }
          for (let i = 0; i < 90; i++) { c.fillStyle = i % 2 ? '#f3a6c4' : '#e77fae'; c.globalAlpha = 0.7; c.beginPath(); c.ellipse(r() * w, GY - 12 + r() * 90, 4, 2, r() * 3, 0, 7); c.fill(); } c.globalAlpha = 1;
        });
        return { far, mid, ground };
      },
    },
  ];
  G.STAGES = STAGES;

  G.Stage = class {
    constructor(def) {
      this.def = def; this.l = def._l || (def._l = def.build()); this.t = 0; this.parts = [];
      for (let i = 0; i < def.parts.n; i++) this.parts.push(this.spawn(true));
    }
    spawn(init) {
      const k = this.def.parts.kind;
      const p = { x: Math.random() * (G.W + 200) - 100, y: Math.random() * H, s: 0.5 + Math.random(), a: Math.random() * 7, k };
      if (!init) { if (k === 'ember') p.y = H + 10; else if (k === 'petal') p.y = -10; else p.x = -60; }
      return p;
    }
    update() {
      this.t++;
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i]; p.a += 0.04;
        if (p.k === 'ember') { p.y -= 0.5 + p.s * 0.7; p.x += Math.sin(p.a) * 0.6 + 0.3; if (p.y < -10) this.parts[i] = this.spawn(); }
        else if (p.k === 'petal') { p.y += 0.6 + p.s * 0.7; p.x -= 0.6 + Math.sin(p.a) * 0.8; if (p.y > H + 10 || p.x < -110) { this.parts[i] = this.spawn(); this.parts[i].x = Math.random() * (G.W + 300); } }
        else { p.x += 1.4 + p.s * 2; p.y += Math.sin(p.a) * 0.4; if (p.x > G.W + 100) this.parts[i] = this.spawn(); }
      }
    }
    draw(c, cam) {
      const l = this.l;
      const fx = cam * (1160 - G.W) / (SW - G.W), mx = cam * (1380 - G.W) / (SW - G.W);
      c.drawImage(l.far, fx * Q, 0, G.W * Q, H * Q, 0, 0, G.W, H);
      c.drawImage(l.mid, mx * Q, 0, G.W * Q, H * Q, 0, 0, G.W, H);
      c.drawImage(l.ground, cam * Q, 0, G.W * Q, H * Q, 0, 0, G.W, H);
    }
    drawFront(c, cam) { // particules devant les combattants
      for (const p of this.parts) {
        const x = p.x - (cam * 0.25) % 60;
        if (p.k === 'ember') { c.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(p.a * 2)); c.fillStyle = p.s > 1 ? '#ffd27a' : '#ff8a3c'; c.fillRect(x, p.y, 1.6 + p.s * 1.6, 1.6 + p.s * 1.6); }
        else if (p.k === 'petal') { c.globalAlpha = 0.8; c.fillStyle = p.s > 1 ? '#ffc2da' : '#f08ab4'; c.beginPath(); c.ellipse(x, p.y, 3 + p.s * 2, 1.6 + p.s, p.a, 0, 7); c.fill(); }
        else { c.globalAlpha = 0.12 + p.s * 0.1; c.fillStyle = '#ffe2c0'; c.beginPath(); c.ellipse(x, p.y * 0.5 + 250, 26 + p.s * 30, 2 + p.s * 2, 0, 0, 7); c.fill(); }
      }
      c.globalAlpha = 1;
    }
    thumb(w, h) {
      const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const c = cv.getContext('2d');
      c.scale(cv.width / G.W, cv.height / H); this.draw(c, (SW - G.W) / 2); return cv;
    }
  };
})();
