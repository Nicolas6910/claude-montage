/* =============================================================
   main.js — compositeur : fond continu, fondus enchaines entre
   scenes, Clawd en couche globale, cartons, flash, grain.
   drawFrame(t) est pur : meme t => meme image (rendu MP4).
   ============================================================= */
(function (global) {
  'use strict';
  var c = global.C, P = c.P, W = c.W, H = c.H;
  var rgba = c.rgba, mix = c.mix, rr = c.rr, glow = c.glow;
  var lerp = c.lerp, inv = c.inv, ease = c.ease, smoother = c.smoother, clamp = c.clamp;
  var SCENES = global.SCENES, MONO = global.SFX.MONO, SANS = global.SFX.SANS;

  var DUR = 30.0;
  var BOUNDS = [5.3, 10.3, 15.3, 19.7, 26.3];
  var XF = 0.46;                       // demi-largeur du fondu enchaine

  var main = null, mctx = null;
  var offA = null, offB = null;

  function mkOff() {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    return { cv: cv, ctx: cv.getContext('2d') };
  }

  /* ---------- poids des scenes : somme = 1, transitions douces ---------- */
  function sceneWeights(t) {
    var idx = 0;
    while (idx < BOUNDS.length && t >= BOUNDS[idx]) idx++;
    var out = [{ i: idx, w: 1, k: 0, role: 'solo' }];
    // fondu sortant vers la scene suivante
    if (idx < BOUNDS.length && t > BOUNDS[idx] - XF) {
      var k = smoother(inv(BOUNDS[idx] - XF, BOUNDS[idx] + XF, t));
      out = [{ i: idx, w: 1 - k, k: k, role: 'out' }, { i: idx + 1, w: k, k: k, role: 'in' }];
    } else if (idx > 0 && t < BOUNDS[idx - 1] + XF) {
      var k2 = smoother(inv(BOUNDS[idx - 1] - XF, BOUNDS[idx - 1] + XF, t));
      out = [{ i: idx - 1, w: 1 - k2, k: k2, role: 'out' }, { i: idx, w: k2, k: k2, role: 'in' }];
    }
    return out;
  }

  /* ---------- cartons ---------- */
  var CAPTIONS = [
    { t0: 0.95, t1: 5.05, kick: 'v0.1', line: 'il savait juste dire bonjour' },
    { t0: 5.95, t1: 10.10, kick: 'v0.2', line: 'puis il est allé chercher' },
    { t0: 10.95, t1: 15.10, kick: 'v0.3', line: 'il a appris à écrire du code' },
    { t0: 15.90, t1: 19.50, kick: 'v0.4', line: 'puis à construire des mondes' },
    { t0: 20.15, t1: 23.70, kick: 'v1.0', line: 'et à s\'attaquer au plus dur' },
    { t0: 24.15, t1: 25.95, kick: '', line: 'santé · science · climat' },
    { t0: 26.85, t1: 28.55, kick: '', line: 'de « bonjour » à tout le reste' },
    { t0: 28.70, t1: 29.85, kick: '', line: 'et il continue d\'apprendre.' }
  ];

  function drawCaptions(ctx, t) {
    for (var i = 0; i < CAPTIONS.length; i++) {
      var cp = CAPTIONS[i];
      var ain = ease(cp.t0, cp.t0 + 0.55, t);
      var aout = 1 - ease(cp.t1 - 0.45, cp.t1, t);
      var a = ain * aout;
      if (a < 0.005) continue;
      var y = 968 + (1 - ain) * 16 - (1 - aout) * 10;
      var big = i >= 5;
      ctx.save();
      ctx.textAlign = 'center';
      if (cp.kick) {
        ctx.font = '600 17px ' + SANS;
        ctx.letterSpacing = '7px';
        ctx.fillStyle = rgba(P.clawd, 0.85 * a);
        ctx.fillText(cp.kick.toUpperCase(), 960, y - 74);
        ctx.letterSpacing = '0px';
        ctx.strokeStyle = rgba(P.clawd, 0.35 * a); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(960 - 26, y - 58); ctx.lineTo(960 + 26, y - 58); ctx.stroke();
      }
      ctx.font = (big ? '300 54px ' : '300 46px ') + SANS;
      ctx.letterSpacing = big ? '2.5px' : '1.5px';
      // ombre douce pour la lisibilite
      ctx.fillStyle = rgba('#000000', 0.45 * a);
      ctx.fillText(cp.line, 961.5, y + 2);
      ctx.fillStyle = rgba(P.cream, 0.94 * a);
      ctx.fillText(cp.line, 960, y);
      ctx.restore();
    }
    // signature finale, discrete
    var sa = ease(29.0, 29.5, t) * (1 - ease(29.7, 30.0, t));
    if (sa > 0.01) {
      ctx.save(); ctx.textAlign = 'center';
      ctx.font = '14px ' + MONO; ctx.letterSpacing = '3px';
      ctx.fillStyle = rgba(P.muted, 0.55 * sa);
      ctx.fillText('IMAGE ET MUSIQUE GENEREES EN CODE — CANVAS + WEB AUDIO', 960, 1032);
      ctx.restore();
    }
  }

  /* ---------- transitions : balayage lumineux ---------- */
  function drawSweep(ctx, t) {
    for (var i = 0; i < BOUNDS.length; i++) {
      var b = BOUNDS[i];
      var k = inv(b - XF - 0.1, b + XF + 0.1, t);
      if (k <= 0 || k >= 1) continue;
      var env = Math.sin(Math.PI * k);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // bande de lumiere qui traverse
      var x = lerp(-520, W + 520, smoother(k));
      var g = ctx.createLinearGradient(x - 420, 0, x + 420, 0);
      g.addColorStop(0, rgba(P.clawd, 0));
      g.addColorStop(0.42, rgba(mix(P.clawdHi, P.cream, 0.5), 0.085 * env));
      g.addColorStop(0.5, rgba(P.cream, 0.13 * env));
      g.addColorStop(0.58, rgba(mix(P.clawdHi, P.cream, 0.5), 0.085 * env));
      g.addColorStop(1, rgba(P.clawd, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // voile chaud global
      ctx.fillStyle = rgba(P.clawd, 0.035 * env);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // fines lignes horizontales (effet "cut" de montage)
      ctx.save();
      ctx.globalAlpha = env * 0.5;
      ctx.strokeStyle = rgba(P.clawdHi, 0.10);
      ctx.lineWidth = 1;
      for (var l = 0; l < 3; l++) {
        var yy = 300 + l * 240 + Math.sin(k * 6 + l) * 40;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------- flash du climax ---------- */
  function drawClimax(ctx, t) {
    var k = inv(24.0, 24.45, t);
    if (t >= 23.9 && k < 1) {
      var pre = ease(23.9, 24.0, t);
      var env = pre * (1 - smoother(k));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(mix(P.cream, P.clawdHi, 0.62), 0.20 * env);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // anneaux de choc
      for (var r = 0; r < 3; r++) {
        var rk = inv(24.0 + r * 0.09, 25.0 + r * 0.09, t);
        if (rk <= 0 || rk >= 1) continue;
        ctx.strokeStyle = rgba(P.clawdHi, 0.35 * (1 - rk));
        ctx.lineWidth = 3 * (1 - rk) + 0.6;
        ctx.beginPath();
        ctx.arc(960, 470, 120 + smoother(rk) * 980, 0, 6.2832);
        ctx.stroke();
      }
    }
  }

  /* ---------- barre de progression discrete ---------- */
  function drawProgress(ctx, t) {
    var a = ease(0.6, 1.6, t) * (1 - ease(28.9, 29.5, t));
    if (a < 0.01) return;
    ctx.fillStyle = rgba(P.cream, 0.07 * a);
    ctx.fillRect(160, 1058, W - 320, 2);
    var w = (W - 320) * clamp(t / DUR, 0, 1);
    var g = ctx.createLinearGradient(160, 0, 160 + w, 0);
    g.addColorStop(0, rgba(P.clawd, 0.25 * a));
    g.addColorStop(1, rgba(P.clawdHi, 0.75 * a));
    ctx.fillStyle = g;
    ctx.fillRect(160, 1058, w, 2);
    for (var i = 0; i < BOUNDS.length; i++) {
      var bx = 160 + (W - 320) * (BOUNDS[i] / DUR);
      ctx.fillStyle = rgba(P.cream, 0.22 * a);
      ctx.fillRect(bx - 1, 1055, 2, 8);
    }
  }

  /* ---------- image complete ---------- */
  function drawFrame(t) {
    t = Math.max(0, Math.min(DUR, t));
    var frame = Math.round(t * 60);
    if (!main) return;
    var ctx = mctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    // 1. decor continu
    c.drawBackdrop(ctx, t);

    // 2. scenes en fondu enchaine
    var ws = sceneWeights(t);
    for (var i = 0; i < ws.length; i++) {
      var s = SCENES[ws[i].i];
      if (!s) continue;
      var off = (i === 0 ? offA : offB);
      off.ctx.setTransform(1, 0, 0, 1, 0, 0);
      off.ctx.globalAlpha = 1;
      off.ctx.globalCompositeOperation = 'source-over';
      off.ctx.clearRect(0, 0, W, H);
      s.draw(off.ctx, t);

      var k = ws[i].k, role = ws[i].role;
      var sc = 1, dy = 0;
      if (role === 'out') { sc = 1 + 0.045 * smoother(k); dy = -14 * smoother(k); }
      else if (role === 'in') { sc = 1 - 0.038 * (1 - smoother(k)); dy = 18 * (1 - smoother(k)); }
      ctx.save();
      ctx.globalAlpha = clamp(ws[i].w, 0, 1);
      ctx.translate(W / 2, H / 2 + dy);
      ctx.scale(sc, sc);
      ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(off.cv, 0, 0);
      ctx.restore();
    }

    // 3. Clawd : couche globale, jamais coupee
    ctx.save();
    c.drawClawdGlobal(ctx, t);
    ctx.restore();

    // 4. habillage
    drawSweep(ctx, t);
    drawClimax(ctx, t);
    drawCaptions(ctx, t);
    drawProgress(ctx, t);
    c.drawVignetteGrain(ctx, t, frame);

    // 5. fondus d'ouverture / fermeture
    var fin = 1 - ease(0.0, 0.7, t);
    var fout = ease(29.15, 30.0, t);
    var blk = Math.max(fin, fout);
    if (blk > 0.001) {
      ctx.fillStyle = rgba('#000000', blk);
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- lecture ---------- */
  var state = { playing: false, actx: null, t0: 0, raf: 0 };

  function loop() {
    if (!state.playing) return;
    var t = state.actx.currentTime - state.t0;
    if (t >= DUR) {
      drawFrame(DUR);
      state.playing = false;
      document.getElementById('overlay').classList.remove('hidden');
      document.getElementById('playLabel').textContent = 'revoir';
      try { state.actx.close(); } catch (e) {}
      return;
    }
    try { drawFrame(Math.max(0, t)); }
    catch (err) { if (!state.warned) { state.warned = true; console.warn('image ignoree', t, err); } }
    state.raf = requestAnimationFrame(loop);
  }

  function play() {
    if (state.playing) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    state.actx = new AC({ sampleRate: 48000 });
    state.t0 = global.MUSIC.playLive(state.actx);
    state.playing = true;
    document.getElementById('overlay').classList.add('hidden');
    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(loop);
  }

  function init() {
    main = document.getElementById('stage');
    mctx = main.getContext('2d', { alpha: false });
    offA = mkOff(); offB = mkOff();
    drawFrame(0.0);
    var btn = document.getElementById('playBtn');
    if (btn) btn.addEventListener('click', play);
    global.addEventListener('keydown', function (e) { if (e.code === 'Space') { e.preventDefault(); play(); } });
  }

  global.VIZ = {
    DURATION: DUR,
    drawFrame: drawFrame,
    init: init,
    play: play,
    ready: false
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  function boot() {
    init();
    // le rendu offline attend que les polices soient pretes
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { drawFrame(0.0); global.VIZ.ready = true; });
    } else { global.VIZ.ready = true; }
  }
})(window);
