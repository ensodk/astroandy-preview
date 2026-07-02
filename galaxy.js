/* ==========================================================================
   GALAXY BACKGROUND ENGINE – variante "COSMOS NARANJA" (v5)
   Concepto: maximalismo de marca – el naranja #FF6825 ACENTUA el espacio
   violeta profundo (2 bolsillos de nebulosa naranja, meteoros calidos, 8% de
   estrellas medias naranjas y una corona solar respirando bajo el horizonte).
   Autonomo: crea/usa el canvas #galaxy y no depende del resto del marcado.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var M = 60; // margen de envoltura (px) para que los sprites no "salten" en los bordes

  // Recetas de capa: den = px2 por estrella; mAmp = parallax de raton (px);
  // sFac = factor de parallax de scroll; dx/dy = deriva ociosa (px/s).
  var RECIPE = [
    { den: 4200,   sMin: 0.7, sMax: 1.6, aMin: 0.16, aMax: 0.45, tMin: 0.04, tMax: 0.2,  spMin: 0.3, spMax: 1.1, mAmp: 4,  sFac: 0.02, dx: 1.1, dy: 0.25, kind: 0, milky: true },  // polvo fino
    { den: 15000,  sMin: 1.3, sMax: 2.4, aMin: 0.28, aMax: 0.6,  tMin: 0.08, tMax: 0.28, spMin: 0.4, spMax: 1.4, mAmp: 9,  sFac: 0.05, dx: 1.7, dy: -0.4, kind: 0 },               // lejanas
    { den: 26000,  sMin: 2.2, sMax: 3.6, aMin: 0.36, aMax: 0.7,  tMin: 0.1,  tMax: 0.32, spMin: 0.5, spMax: 1.6, mAmp: 15, sFac: 0.09, dx: 2.4, dy: 0.7,  kind: 0 },               // medias (~8% naranjas)
    { den: 140000, sMin: 13,  sMax: 26,  aMin: 0.5,  aMax: 0.85, tMin: 0.12, tMax: 0.28, spMin: 0.3, spMax: 0.9, mAmp: 22, sFac: 0.14, dx: 3.1, dy: 1.0,  kind: 1 }                // heroes con destello
  ];

  // Temperaturas de color: blanco, blanco azulado, calido raro y NARANJA de marca
  // (el indice 3 solo se asigna a ~8% de la capa media – acento, nunca dominante).
  var COLORS = [[255, 255, 255], [188, 209, 255], [255, 227, 191], [255, 150, 82]];

  // Nebulosas: 3 nubes violeta/indigo + 2 BOLSILLOS naranja de marca (#FF6825),
  // compactos, nucleo calido hacia transparente. Alphas bajas: bruma, no fuegos.
  // Ajuste "deep space" (2026-07-02): violetas mas profundos y silenciosos,
  // el espacio casi negro; el naranja queda como EL acento de color.
  var NEB_PALETTES = [
    [[84, 24, 134], [48, 30, 158]],    // violeta profundo -> indigo profundo
    [[48, 30, 158], [32, 20, 82]],     // indigo -> azul muy profundo
    [[62, 22, 116], [24, 30, 104]],    // purpura -> azul, apagado
    [[255, 104, 37], [255, 150, 70]],  // bolsillo naranja 1: marca -> naranja claro
    [[255, 120, 45], [205, 70, 25]]    // bolsillo naranja 2: calido -> rojizo
  ];

  var canvas, ctx, bg;
  var nebSprites = [], nebulae = [];
  var corona, coronaH = 0, coronaPhase = Math.random() * Math.PI * 2; // corona solar bajo el horizonte
  var CORONA_A = 0.055;                 // alpha pico (~0.05, siempre tenue)
  var CORONA_W = Math.PI * 2 / 30;      // respiracion de ~30 s
  var W = 0, H = 0, wrapW = 0, wrapH = 0;
  var layers = [];
  var dotSprites = [], heroSprites = [];
  var mTX = 0, mTY = 0, mX = 0, mY = 0;  // raton: objetivo / suavizado
  var scTX = 0, scX = 0;                 // scroll: objetivo / suavizado
  var rafId = 0, lastT = 0, resizeTimer = 0;
  var meteor = { on: false, x: 0, y: 0, vx: 0, vy: 0, ux: 0, uy: 0, age: 0, dur: 0, len: 0 };
  var nextMeteor = 0;

  function pickColor() {
    var r = Math.random();
    return r < 0.6 ? 0 : (r < 0.9 ? 1 : 2);
  }

  function gauss() { // aprox normal ~N(0, 0.5)
    return Math.random() + Math.random() + Math.random() - 1.5;
  }

  /* ---- sprites pre-renderizados (nunca gradientes por estrella por frame) ---- */

  function dotSprite(px, c) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = px;
    var g = cv.getContext('2d');
    var h = px / 2;
    var gr = g.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.9)');
    gr.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, px, px);
    return cv;
  }

  function heroSprite(px, c) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = px;
    var g = cv.getContext('2d');
    var h = px / 2;
    var rgb = c[0] + ',' + c[1] + ',' + c[2];
    // nucleo con halo
    var gr = g.createRadialGradient(h, h, 0, h, h, h * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(' + rgb + ',0.8)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, px, px);
    // destellos de difraccion en 4 puntas (sutiles)
    g.globalCompositeOperation = 'lighter';
    var sh = g.createLinearGradient(0, h, px, h);
    sh.addColorStop(0, 'rgba(' + rgb + ',0)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    sh.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = sh;
    g.fillRect(0, h - 0.6, px, 1.2);
    var sv = g.createLinearGradient(h, 0, h, px);
    sv.addColorStop(0, 'rgba(' + rgb + ',0)');
    sv.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    sv.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = sv;
    g.fillRect(h - 0.6, 0, 1.2, px);
    return cv;
  }

  function buildSprites() {
    for (var i = 0; i < COLORS.length; i++) {
      dotSprites[i] = dotSprite(32, COLORS[i]);
      heroSprites[i] = heroSprite(64, COLORS[i]);
    }
  }

  /* ---- nebulosas pre-renderizadas (cumulos de blobs suaves, borde desvanecido) ----
     warm=true -> bolsillo naranja: mas compacto, nucleo calido hacia transparente. */

  function nebSprite(palette, warm) {
    var S = 768;
    var cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var g = cv.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    var blobs = warm ? 12 : 24;
    var spX = warm ? 0.13 : 0.20, spY = warm ? 0.10 : 0.13; // bolsillos: dispersion menor
    for (var i = 0; i < blobs; i++) {
      var c = palette[Math.random() < 0.65 ? 0 : 1];
      var cx = S / 2 + gauss() * S * spX;
      var cy = S / 2 + gauss() * S * spY;            // nube alargada
      var r = S * (warm ? 0.07 + Math.random() * 0.10 : 0.09 + Math.random() * 0.15);
      var a = (warm ? 0.045 : 0.055) + Math.random() * (warm ? 0.045 : 0.055); // alpha baja-media
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
    // pliegues: vetas mas densas dentro de la nube
    for (var j = 0; j < 6; j++) {
      var c2 = palette[0];
      var vx = S / 2 + gauss() * S * (warm ? 0.10 : 0.16), vy = S / 2 + gauss() * S * (warm ? 0.07 : 0.10);
      var vr = S * (0.05 + Math.random() * 0.07);
      var gr2 = g.createRadialGradient(vx, vy, 0, vx, vy, vr);
      gr2.addColorStop(0, 'rgba(' + c2[0] + ',' + c2[1] + ',' + c2[2] + ',' + (warm ? 0.06 : 0.09) + ')');
      gr2.addColorStop(1, 'rgba(' + c2[0] + ',' + c2[1] + ',' + c2[2] + ',0)');
      g.fillStyle = gr2;
      g.fillRect(0, 0, S, S);
    }
    if (warm) {
      // nucleo calido: brasa blanco-naranja muy pequena en el corazon del bolsillo
      var hx = S / 2 + gauss() * S * 0.03, hy = S / 2 + gauss() * S * 0.03;
      var hr = S * 0.07;
      var gh = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
      gh.addColorStop(0, 'rgba(255,205,160,0.10)');
      gh.addColorStop(0.5, 'rgba(255,140,60,0.06)');
      gh.addColorStop(1, 'rgba(255,104,37,0)');
      g.fillStyle = gh;
      g.fillRect(0, 0, S, S);
    }
    // mascara radial: borde totalmente desvanecido, nunca cortes duros
    g.globalCompositeOperation = 'destination-in';
    var mk = g.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S * (warm ? 0.42 : 0.5));
    mk.addColorStop(0, 'rgba(0,0,0,1)');
    mk.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mk;
    g.fillRect(0, 0, S, S);
    // grano fino horneado: rompe el banding de los degradados (coste solo en init)
    var img = g.getImageData(0, 0, S, S);
    var px = img.data;
    for (var p = 3; p < px.length; p += 4) {
      if (px[p] > 0) {
        var nse = 0.92 + Math.random() * 0.16;
        px[p] = Math.min(255, px[p] * nse) | 0;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  function buildNebSprites() {
    for (var i = 0; i < NEB_PALETTES.length; i++) {
      nebSprites[i] = nebSprite(NEB_PALETTES[i], i >= 3); // 3 y 4 = bolsillos naranja
    }
  }

  function buildNebulae() {
    var small = W < 640;
    var base = Math.max(W, H);
    // posiciones compuestas: violetas siguen la banda; los bolsillos naranja viven
    // en las esquinas opuestas, lejos del texto central. Nada brillante al centro.
    var defs = [
      { sp: 0, fx: 0.16, fy: 0.24, sc: 0.95, rs: 0.006,  drx: 1.6,  dry: 0.5,  al: 0.42, bs: 0.055 },
      { sp: 1, fx: 0.86, fy: 0.72, sc: 1.15, rs: -0.005, drx: -1.2, dry: -0.4, al: 0.45, bs: 0.045 },
      { sp: 2, fx: 0.55, fy: 0.42, sc: 0.8,  rs: 0.004,  drx: 0.9,  dry: 0.7,  al: 0.28, bs: 0.07 },
      { sp: 3, fx: 0.80, fy: 0.20, sc: 0.42, rs: -0.007, drx: 1.3,  dry: -0.6, al: 0.55, bs: 0.06 },  // bolsillo naranja NE
      { sp: 4, fx: 0.20, fy: 0.82, sc: 0.38, rs: 0.008,  drx: -1.0, dry: 0.5,  al: 0.5,  bs: 0.05 }   // bolsillo naranja SO
    ];
    if (small) defs = [defs[0], defs[1], defs[3]]; // moviles: 2 violetas + 1 bolsillo
    nebulae.length = 0;
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      nebulae.push({
        spr: nebSprites[d.sp],
        x: W * d.fx, y: H * d.fy,
        size: base * d.sc * (small ? 0.85 : 1),
        rot: Math.random() * Math.PI * 2,
        rotSpeed: d.rs * 0.06,          // radianes/s (ciclos de minutos)
        drx: d.drx, dry: d.dry,          // deriva px/s (muy lenta)
        alpha: d.al, breathSpeed: d.bs,
        phase: Math.random() * Math.PI * 2,
        mAmp: 2.5 + i, sFac: 0.012 + i * 0.004
      });
    }
  }

  function drawNebulae(ts) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (var i = 0; i < nebulae.length; i++) {
      var nb = nebulae[i];
      var half = nb.size / 2;
      var span = W + nb.size;                      // envoltura holgada
      var x = nb.x + mX * nb.mAmp;
      var y = nb.y + mY * nb.mAmp * 0.6 - scX * nb.sFac;
      x = ((x + half) % span + span) % span - half;
      var spanY = H + nb.size;
      y = ((y + half) % spanY + spanY) % spanY - half;
      ctx.globalAlpha = nb.alpha * (0.82 + 0.18 * Math.sin(ts * nb.breathSpeed + nb.phase));
      ctx.translate(x, y);
      ctx.rotate(nb.rot + ts * nb.rotSpeed);
      ctx.drawImage(nb.spr, -half, -half, nb.size, nb.size);
      ctx.rotate(-(nb.rot + ts * nb.rotSpeed));
      ctx.translate(-x, -y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---- corona solar: resplandor naranja enorme y tenue bajo el borde inferior,
     como un sol bajo el horizonte. Pre-renderizada; solo drawImage por frame. ---- */

  function buildCorona() {
    coronaH = Math.round(H * 0.5);
    corona = document.createElement('canvas');
    corona.width = Math.max(1, Math.round(W * DPR));
    corona.height = Math.max(1, Math.round(coronaH * DPR));
    var g = corona.getContext('2d');
    g.scale(DPR, DPR);
    var cx = W * 0.5, cy = coronaH + H * 0.35;     // centro del "sol" bajo el horizonte
    var r = Math.max(W * 0.75, H * 0.9);
    var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, 'rgba(255,104,37,0.9)');    // #FF6825 en el nucleo oculto
    gr.addColorStop(0.45, 'rgba(255,104,37,0.34)');
    gr.addColorStop(0.75, 'rgba(180,60,30,0.10)');
    gr.addColorStop(1, 'rgba(255,104,37,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, coronaH);
  }

  function drawCorona(ts) {
    // respiracion de ~30 s; alpha pico ~0.055: siempre un acento, nunca un amanecer
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = CORONA_A * (0.72 + 0.28 * Math.sin(ts * CORONA_W + coronaPhase));
    ctx.drawImage(corona, 0, H - coronaH, W, coronaH);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---- fondo pre-renderizado: base indigo profundo + banda de via lactea ---- */

  function glow(g, x, y, r, rgb, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  function buildBg() {
    bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.round(W * DPR));
    bg.height = Math.max(1, Math.round(H * DPR));
    var g = bg.getContext('2d');
    g.scale(DPR, DPR);
    g.fillStyle = '#06060f';
    g.fillRect(0, 0, W, H);
    // insinuaciones enormes y sutiles de indigo/purpura/azul (nunca manchas brillantes)
    var R = Math.max(W, H);
    glow(g, W * 0.18, H * 0.1, R * 0.75, '9,9,28', 0.5);
    glow(g, W * 0.85, H * 0.85, R * 0.7, '12,8,26', 0.45);
    glow(g, W * 0.6, H * 0.35, R * 0.5, '7,11,30', 0.3);
    // banda de via lactea: bruma diagonal con nucleo galactico y flecos de color
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-0.32);
    var d = Math.sqrt(W * W + H * H);
    var band = g.createLinearGradient(0, -H * 0.3, 0, H * 0.3);
    band.addColorStop(0, 'rgba(180,195,235,0)');
    band.addColorStop(0.30, 'rgba(113,31,179,0.05)');   // fleco violeta
    band.addColorStop(0.42, 'rgba(185,200,240,0.06)');
    band.addColorStop(0.55, 'rgba(200,212,246,0.08)');
    band.addColorStop(0.72, 'rgba(66,40,214,0.05)');    // fleco indigo
    band.addColorStop(1, 'rgba(180,195,235,0)');
    g.fillStyle = band;
    g.fillRect(-d / 2, -H * 0.32, d, H * 0.64);
    // nucleo galactico: resplandor alargado y calido en el centro de la banda
    var core = g.createRadialGradient(0, 0, 0, 0, 0, d * 0.30);
    core.addColorStop(0, 'rgba(226,214,255,0.10)');
    core.addColorStop(0.35, 'rgba(190,170,240,0.05)');
    core.addColorStop(1, 'rgba(190,170,240,0)');
    g.fillStyle = core;
    g.save();
    g.scale(1.9, 0.55);                                  // elipse a lo largo de la banda
    g.fillRect(-d / 1.2, -d / 1.2, d * 1.7, d * 1.7);
    g.restore();
    g.restore();
  }

  /* ---- campo de estrellas: Float32Array plano, cero allocs en el frame ---- */
  // stride 8: x, y, size, alphaBase, twAmp, twSpeed, phase, spriteIdx

  function bandY(x) { // eje de la via lactea (coincide con la bruma del fondo)
    return H * 0.55 - (x - wrapW / 2) * 0.33;
  }

  function build() {
    var area = W * H;
    layers.length = 0;
    for (var L = 0; L < RECIPE.length; L++) {
      var r = RECIPE[L];
      var count = Math.round(area / r.den);
      if (r.kind === 1) count = Math.max(6, Math.min(12, count)); // pocas heroicas
      var extra = r.milky ? Math.round(area / 11000) : 0;         // densificacion de la banda
      var n = count + extra;
      var a = new Float32Array(n * 8);
      for (var i = 0; i < n; i++) {
        var o = i * 8, x, y;
        if (i >= count) { // miembro de la banda: gaussiana alrededor del eje diagonal
          x = Math.random() * wrapW;
          y = bandY(x) + gauss() * H * 0.17;
          y = ((y % wrapH) + wrapH) % wrapH;
        } else {
          x = Math.random() * wrapW;
          y = Math.random() * wrapH;
        }
        a[o] = x;
        a[o + 1] = y;
        a[o + 2] = r.sMin + Math.random() * (r.sMax - r.sMin);
        a[o + 3] = r.aMin + Math.random() * (r.aMax - r.aMin);
        a[o + 4] = r.tMin + Math.random() * (r.tMax - r.tMin);
        a[o + 5] = r.spMin + Math.random() * (r.spMax - r.spMin);
        a[o + 6] = Math.random() * Math.PI * 2;
        // ~8% de la capa media en naranja de marca; el resto, reparto clasico
        a[o + 7] = (L === 2 && Math.random() < 0.08) ? 3 : pickColor();
      }
      layers.push({ stars: a, cfg: r, dx: 0, dy: 0, sprites: r.kind === 1 ? heroSprites : dotSprites });
    }
  }

  /* ---- estrella fugaz ocasional (tinte naranja-blanco calido, cola mas larga) ---- */

  function spawnMeteor() {
    var goRight = Math.random() < 0.5;
    var ang = (0.35 + Math.random() * 0.6) * (goRight ? 1 : -1); // 20-55 grados
    var speed = 520 + Math.random() * 380;
    meteor.on = true;
    meteor.x = W * (goRight ? 0.05 + Math.random() * 0.45 : 0.5 + Math.random() * 0.45);
    meteor.y = H * (0.05 + Math.random() * 0.35);
    meteor.ux = Math.cos(ang) * (goRight ? 1 : -1);
    meteor.uy = Math.abs(Math.sin(ang));
    // normalizar por si acaso
    var m = Math.sqrt(meteor.ux * meteor.ux + meteor.uy * meteor.uy);
    meteor.ux /= m; meteor.uy /= m;
    meteor.vx = meteor.ux * speed;
    meteor.vy = meteor.uy * speed;
    meteor.len = 190 + Math.random() * 150;   // cola algo mas larga que la base
    meteor.dur = 0.7 + Math.random() * 0.5;
    meteor.age = 0;
  }

  function stepMeteor(t, dt) {
    if (!meteor.on) {
      if (!nextMeteor) nextMeteor = t + 3500 + Math.random() * 2500; // la primera llega pronto
      if (t >= nextMeteor) spawnMeteor();
      return;
    }
    meteor.age += dt;
    if (meteor.age >= meteor.dur) {
      meteor.on = false;
      nextMeteor = t + 6000 + Math.random() * 4000; // luego, cada 6-10 s
      return;
    }
    meteor.x += meteor.vx * dt;
    meteor.y += meteor.vy * dt;
    var fade = Math.sin(Math.PI * (meteor.age / meteor.dur));
    var tx = meteor.x - meteor.ux * meteor.len;
    var ty = meteor.y - meteor.uy * meteor.len;
    // cabeza blanco-calido, cola que muere en naranja de marca
    var gr = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
    gr.addColorStop(0, 'rgba(255,242,230,' + (0.85 * fade).toFixed(3) + ')');
    gr.addColorStop(0.3, 'rgba(255,180,120,' + (0.42 * fade).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,104,37,0)');
    ctx.strokeStyle = gr;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(meteor.x, meteor.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.globalAlpha = 0.9 * fade;
    ctx.drawImage(dotSprites[3], meteor.x - 4, meteor.y - 4, 8, 8); // halo naranja en la cabeza
    ctx.globalAlpha = 1;
  }

  /* ---- bucle principal (unico rAF, sin allocs en el camino caliente) ---- */

  function drawStars(ts) {
    for (var L = 0; L < layers.length; L++) {
      var lay = layers[L], c = lay.cfg;
      var ox = lay.dx + mX * c.mAmp;
      var oy = lay.dy + mY * c.mAmp * 0.6 - scX * c.sFac;
      var a = lay.stars, spr = lay.sprites, n = a.length;
      for (var i = 0; i < n; i += 8) {
        var sx = a[i] + ox;
        sx = sx - Math.floor(sx / wrapW) * wrapW - M;
        var sy = a[i + 1] + oy;
        sy = sy - Math.floor(sy / wrapH) * wrapH - M;
        var al = a[i + 3] + a[i + 4] * Math.sin(ts * a[i + 5] + a[i + 6]);
        ctx.globalAlpha = al < 0 ? 0 : (al > 1 ? 1 : al);
        var s = a[i + 2];
        ctx.drawImage(spr[a[i + 7] | 0], sx - s * 0.5, sy - s * 0.5, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(t) {
    rafId = requestAnimationFrame(frame);
    if (!lastT) { lastT = t; return; }
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    var ts = t / 1000;

    // suavizado de entradas (independiente del framerate)
    var k = 1 - Math.exp(-dt * 4);
    mX += (mTX - mX) * k;
    mY += (mTY - mY) * k;
    scX += (scTX - scX) * k;

    // deriva ociosa
    for (var L = 0; L < layers.length; L++) {
      layers[L].dx += layers[L].cfg.dx * dt;
      layers[L].dy += layers[L].cfg.dy * dt;
    }
    for (var N = 0; N < nebulae.length; N++) {
      nebulae[N].x += nebulae[N].drx * dt;
      nebulae[N].y += nebulae[N].dry * dt;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    drawCorona(ts);
    drawNebulae(ts);
    drawStars(ts);
    stepMeteor(t, dt);
  }

  function drawStatic() { // prefers-reduced-motion: un solo frame, quieto y bello
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = CORONA_A * 0.85;   // corona fija, sin respiracion
    ctx.drawImage(corona, 0, H - coronaH, W, coronaH);
    ctx.restore();
    ctx.globalAlpha = 1;
    drawNebulae(0);
    for (var L = 0; L < layers.length; L++) {
      var lay = layers[L];
      var a = lay.stars, spr = lay.sprites, n = a.length;
      for (var i = 0; i < n; i += 8) {
        var sx = a[i] - Math.floor(a[i] / wrapW) * wrapW - M;
        var sy = a[i + 1] - Math.floor(a[i + 1] / wrapH) * wrapH - M;
        ctx.globalAlpha = a[i + 3];
        var s = a[i + 2];
        ctx.drawImage(spr[a[i + 7] | 0], sx - s * 0.5, sy - s * 0.5, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- tamano y eventos ---- */

  function size() {
    W = window.innerWidth;
    H = window.innerHeight;
    wrapW = W + M * 2;
    wrapH = H + M * 2;
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      size();
      buildBg();
      buildCorona();
      build();
      buildNebulae();
      if (reduced) drawStatic();
    }, 200);
  }

  function init() {
    canvas = document.getElementById('galaxy');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'galaxy';
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block;';
    ctx = canvas.getContext('2d');
    buildSprites();
    buildNebSprites();
    size();
    buildBg();
    buildCorona();
    build();
    buildNebulae();
    window.addEventListener('resize', onResize);

    if (reduced) { drawStatic(); return; }

    window.addEventListener('mousemove', function (e) {
      mTX = (e.clientX / W) * 2 - 1;
      mTY = (e.clientY / H) * 2 - 1;
    }, { passive: true });

    window.addEventListener('scroll', function () {
      scTX = window.scrollY || window.pageYOffset || 0;
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!rafId) {
        lastT = 0;
        rafId = requestAnimationFrame(frame);
      }
    });

    rafId = requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
