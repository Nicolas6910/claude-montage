/* =============================================================
   core.js — utilitaires deterministes, decor global, Clawd
   Tout est fonction du temps t (secondes). Aucun Math.random
   pendant le dessin : rendu identique image par image.
   ============================================================= */
(function (global) {
  'use strict';

  var W = 1920, H = 1080;

  /* ---------- math ---------- */
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function inv(a, b, x) { return b === a ? 0 : clamp((x - a) / (b - a), 0, 1); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function smoother(x) { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }
  function ease(a, b, x) { return smoother(inv(a, b, x)); }
  function easeOutCubic(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeOutBack(x) { x = clamp(x, 0, 1); var c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  // bruit deterministe 1D/2D (hash)
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function hash2(a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x) { var i = Math.floor(x), f = x - i; var a = hash(i), b = hash(i + 1); return lerp(a, b, smooth(f)); }
  function trackValue(track, key, t) {
    var i, a = track[0], b = track[track.length - 1];
    if (t <= a.t) return a[key];
    if (t >= b.t) return b[key];
    for (i = 0; i < track.length - 1; i++) {
      if (t >= track[i].t && t <= track[i + 1].t) {
        var k0 = track[i], k1 = track[i + 1];
        var v0 = (k0[key] === undefined ? 0 : k0[key]);
        var v1 = (k1[key] === undefined ? 0 : k1[key]);
        return lerp(v0, v1, smoother(inv(k0.t, k1.t, t)));
      }
    }
    return b[key];
  }

  /* ---------- palette ---------- */
  var P = {
    clawd: '#D97757', clawdLo: '#A34F32', clawdHi: '#F2AC8B', clawdDk: '#7A3A22',
    cream: '#F4ECE2', muted: '#9C9086', dim: '#574C44',
    cool: '#77A0C8', teal: '#6FC3B8', green: '#86C98C', red: '#D8574E',
    gold: '#EFC073', violet: '#A594D6', ink: '#0B0A09'
  };
  function rgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function mix(h1, h2, k) {
    var r1 = parseInt(h1.slice(1, 3), 16), g1 = parseInt(h1.slice(3, 5), 16), b1 = parseInt(h1.slice(5, 7), 16);
    var r2 = parseInt(h2.slice(1, 3), 16), g2 = parseInt(h2.slice(3, 5), 16), b2 = parseInt(h2.slice(5, 7), 16);
    var f = function (x) { x = Math.round(x); return (x < 16 ? '0' : '') + x.toString(16); };
    return '#' + f(lerp(r1, r2, k)) + f(lerp(g1, g2, k)) + f(lerp(b1, b2, k));
  }

  /* ---------- primitives ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  function glow(ctx, x, y, r, color, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.45, rgba(color, a * 0.35));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  function textC(ctx, str, x, y, font, color, a, spacing) {
    ctx.save();
    ctx.font = font; ctx.fillStyle = rgba(color, a);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (spacing) {
      ctx.letterSpacing = spacing + 'px';
    }
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  /* ---------- grain (tuile pre-calculee, deterministe) ---------- */
  var grainTile = null;
  function getGrain() {
    if (grainTile) return grainTile;
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    var img = g.createImageData(256, 256);
    for (var i = 0; i < 256 * 256; i++) {
      var v = 128 + (hash(i * 1.37) - 0.5) * 150;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTile = c; return c;
  }

  /* =============================================================
     DECOR GLOBAL — continu sur les 30 s, jamais de coupure
     ============================================================= */
  function drawBackdrop(ctx, t) {
    var warmth = smoother(inv(2, 27, t));            // froid -> chaud
    var top = mix('#0A0C12', '#1B1410', warmth);
    var bot = mix('#08090C', '#241813', warmth);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(0.62, mix(top, bot, 0.6)); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // halo central qui grandit avec le recit
    var hal = 0.04 + 0.115 * smoother(inv(8, 24.5, t));
    glow(ctx, 960, 540 - 120 * warmth, 520 + 620 * smoother(inv(5, 26, t)), mix(P.cool, P.clawd, warmth), hal);

    // poussiere / etoiles
    var count = 150;
    var bright = 0.10 + 0.5 * smoother(inv(3, 22, t));
    for (var i = 0; i < count; i++) {
      var sx = hash(i * 3.11), sy = hash(i * 7.77), sz = 0.25 + hash(i * 1.93) * 0.75;
      var x = ((sx * W + t * 9 * sz) % (W + 80)) - 40;
      var y = sy * 860 + Math.sin(t * 0.35 + i) * 6 * sz;
      var tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1.1 + hash(i * 5.1) * 2.2) + i * 2.3));
      var r = 0.7 + sz * 1.9;
      ctx.fillStyle = rgba(i % 7 === 0 ? P.clawdHi : P.cream, bright * tw * sz * 0.9);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }

    // sol en perspective
    var horizon = 704;
    var gridA = 0.05 + 0.16 * smoother(inv(1, 20, t));
    ctx.lineWidth = 1.2;
    var vx = 960;
    for (var k = -16; k <= 16; k++) {
      var bx = vx + k * 230;
      var a = gridA * (1 - Math.abs(k) / 19);
      ctx.strokeStyle = rgba(mix(P.cool, P.clawd, warmth), a);
      ctx.beginPath(); ctx.moveTo(vx + k * 22, horizon); ctx.lineTo(bx, H + 40); ctx.stroke();
    }
    var scroll = (t * 0.30) % 1;
    for (var z = 0; z < 16; z++) {
      var zz = z + scroll;
      var y2 = horizon + 376 * (1 - 1 / (1 + zz * 0.30));
      var aa = gridA * (1 - z / 17) * 1.25;
      ctx.strokeStyle = rgba(mix(P.cool, P.clawd, warmth), aa);
      ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke();
    }
    // ligne d'horizon lumineuse
    var hg = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 26);
    hg.addColorStop(0, rgba(P.clawd, 0));
    hg.addColorStop(0.7, rgba(mix(P.cool, P.clawdHi, warmth), 0.04 + 0.13 * warmth));
    hg.addColorStop(1, rgba(P.clawd, 0));
    ctx.fillStyle = hg; ctx.fillRect(0, horizon - 40, W, 66);
  }

  function drawVignetteGrain(ctx, t, frame) {
    var g = ctx.createRadialGradient(960, 520, 420, 960, 560, 1250);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.30)');
    g.addColorStop(1, 'rgba(0,0,0,0.80)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.035;
    var tile = getGrain();
    var ox = -(frame * 37) % 256, oy = -(frame * 61) % 256;
    var pat = ctx.createPattern(tile, 'repeat');
    ctx.translate(ox, oy);
    ctx.fillStyle = pat; ctx.fillRect(-ox, -oy, W + 256, H + 256);
    ctx.restore();
  }

  /* =============================================================
     CLAWD — mascotte pixel, dessinee cellule par cellule
     ============================================================= */
  // corps 16x13 : d = contour, b = corps
  var BODY = [
    '....dddddddd....',
    '..ddbbbbbbbbdd..',
    '.dbbbbbbbbbbbbd.',
    '.dbbbbbbbbbbbbd.',
    'dbbbbbbbbbbbbbbd',
    'dbbbbbbbbbbbbbbd',
    'dbbbbbbbbbbbbbbd',
    'dbbbbbbbbbbbbbbd',
    'dbbbbbbbbbbbbbbd',
    '.dbbbbbbbbbbbbd.',
    '.dbbbbbbbbbbbbd.',
    '..ddbbbbbbbbdd..',
    '....dddddddd....'
  ];

  // pose : objet de parametres numeriques (interpolables)
  function drawClawd(ctx, x, y, u, pose) {
    // x,y = centre des pieds ; u = taille d'un pixel
    var stage = pose.stage || 0;
    var bw = 16 * u, bh = 13 * u;
    var bx = x - bw / 2, by = y - bh - 2 * u;   // 2u de pattes
    var breathe = Math.sin(pose.t * 2.1) * 0.35 * u * (1 + stage * 0.15);
    by += breathe;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((pose.tilt || 0));
    ctx.translate(-x, -y);

    // lueur / aura
    var aur = 0.04 + 0.025 * stage + (pose.aura || 0) * 0.35;
    glow(ctx, x, by + bh * 0.45, bw * (1.5 + stage * 0.45), mix(P.clawd, P.clawdHi, 0.3), aur);

    // ombre au sol
    ctx.fillStyle = rgba('#000000', 0.34);
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5 * u, bw * 0.46, u * 1.25, 0, 0, 6.2832);
    ctx.fill();

    // cape de lumiere (stage >= 4) — derriere le corps, jamais sur le visage
    if (stage > 3.4) {
      var kc = clamp((stage - 3.4) / 1.6, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var ci = 0; ci < 3; ci++) {
        var cg = ctx.createLinearGradient(x, by + bh * 0.5, x, by + bh * 2.0);
        cg.addColorStop(0, rgba(P.clawdHi, 0.065 * kc));
        cg.addColorStop(1, rgba(P.clawd, 0));
        ctx.fillStyle = cg;
        var wob = Math.sin(pose.t * 1.6 + ci) * u * 1.2;
        ctx.beginPath();
        ctx.moveTo(x - bw * 0.34, by + bh * 0.5);
        ctx.quadraticCurveTo(x - bw * (0.62 + ci * 0.12) + wob, by + bh * 1.4, x - bw * 0.16, by + bh * 1.95);
        ctx.lineTo(x + bw * 0.16, by + bh * 1.95);
        ctx.quadraticCurveTo(x + bw * (0.62 + ci * 0.12) - wob, by + bh * 1.4, x + bw * 0.34, by + bh * 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // anneau de geometrie (stage >= 3)
    if (stage > 2.2) {
      var ra = clamp((stage - 2.2) / 1.2, 0, 1) * 0.5;
      ctx.save();
      ctx.strokeStyle = rgba(P.clawdHi, ra * 0.55);
      ctx.lineWidth = Math.max(1, u * 0.22);
      for (var ri = 0; ri < 3; ri++) {
        var rr2 = bw * (0.78 + ri * 0.20);
        var sq = Math.sin(pose.t * (0.7 + ri * 0.25) + ri);
        ctx.beginPath();
        ctx.ellipse(x, by + bh * 0.5, rr2, rr2 * (0.22 + 0.12 * sq), (ri * 1.1 + pose.t * 0.4), 0, 6.2832);
        ctx.stroke();
      }
      ctx.restore();
    }

    // pattes
    var legPhase = pose.t * 6;
    var footY = y - 2 * u;
    ctx.fillStyle = P.clawdLo;
    for (var lg = 0; lg < 2; lg++) {
      var lx = x + (lg ? 1 : -1) * 3.2 * u - 1.5 * u;
      var lift = (pose.step || 0) * Math.max(0, Math.sin(legPhase + lg * Math.PI)) * u * 1.2;
      ctx.fillRect(Math.round(lx), Math.round(footY - lift), Math.round(3 * u), Math.round(2.4 * u));
    }

    // corps pixelise
    for (var r = 0; r < BODY.length; r++) {
      for (var c = 0; c < BODY[r].length; c++) {
        var ch = BODY[r][c];
        if (ch === '.') continue;
        var col;
        if (ch === 'd') col = P.clawdDk;
        else {
          // degrade interne haut-gauche -> bas-droite
          var k = (r / 13) * 0.75 + (1 - c / 16) * 0.25;
          col = mix(P.clawdHi, P.clawdLo, clamp(0.18 + k * 0.72, 0, 1));
        }
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(bx + c * u), Math.round(by + r * u), Math.ceil(u), Math.ceil(u));
      }
    }
    // reflet doux
    var sg = ctx.createLinearGradient(bx, by, bx + bw * 0.6, by + bh * 0.7);
    sg.addColorStop(0, 'rgba(255,255,255,0.11)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(bx + u, by + u, bw - 2 * u, bh * 0.55);

    /* --- visage --- */
    var eyeY = by + 4.6 * u;
    var lookX = (pose.lookX || 0) * u * 0.55, lookY = (pose.lookY || 0) * u * 0.45;
    var blink = pose.blink || 0;     // 0 ouvert, 1 ferme
    var ew = 2.2 * u, eh = 2.6 * u * (1 - 0.92 * blink);
    for (var e = 0; e < 2; e++) {
      var ex = x + (e ? 1 : -1) * 3.5 * u;
      if (eh > 0.25 * u) {
        ctx.fillStyle = '#FDF8F2';
        ctx.fillRect(Math.round(ex - ew / 2), Math.round(eyeY - eh / 2), Math.round(ew), Math.round(eh));
        ctx.fillStyle = '#231712';
        var pw = Math.max(1, Math.round(u * 1.15));
        ctx.fillRect(Math.round(ex - pw / 2 + lookX), Math.round(eyeY - pw / 2 + lookY), pw, Math.round(Math.min(pw, eh)));
        // etincelle
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(Math.round(ex - ew / 2 + u * 0.15), Math.round(eyeY - eh / 2 + u * 0.15), Math.max(1, Math.round(u * 0.4)), Math.max(1, Math.round(u * 0.4)));
      } else {
        ctx.fillStyle = P.clawdDk;
        ctx.fillRect(Math.round(ex - ew / 2), Math.round(eyeY), Math.round(ew), Math.max(1, Math.round(u * 0.45)));
      }
    }
    // sourcils (concentration)
    var brow = pose.brow || 0;
    if (brow > 0.02) {
      ctx.fillStyle = P.clawdDk;
      for (var b2 = 0; b2 < 2; b2++) {
        var bx2 = x + (b2 ? 1 : -1) * 3.5 * u;
        ctx.save();
        ctx.translate(bx2, eyeY - 2.1 * u);
        ctx.rotate((b2 ? -1 : 1) * 0.30 * brow);
        ctx.fillRect(-1.3 * u, -0.3 * u, 2.6 * u, Math.max(1, 0.55 * u));
        ctx.restore();
      }
    }
    // bouche : smile 0..1, open 0..1
    var mY = by + 8.6 * u, sm = pose.smile === undefined ? 0.4 : pose.smile, op = pose.open || 0;
    ctx.strokeStyle = P.clawdDk; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, u * 0.5);
    if (op > 0.05) {
      ctx.fillStyle = '#4A2317';
      var ow = 2.6 * u * (0.6 + op * 0.7), oh = 2.4 * u * op;
      rr(ctx, x - ow / 2, mY - oh * 0.3, ow, oh, oh * 0.45); ctx.fill();
      ctx.fillStyle = rgba('#E27A63', 0.9);
      rr(ctx, x - ow * 0.25, mY + oh * 0.35, ow * 0.5, oh * 0.4, oh * 0.2); ctx.fill();
    } else {
      ctx.beginPath();
      var mw = 2.6 * u;
      ctx.moveTo(x - mw / 2, mY);
      ctx.quadraticCurveTo(x, mY + sm * 1.5 * u, x + mw / 2, mY);
      ctx.stroke();
    }

    /* --- bras --- */
    function arm(sx, sy, ang, len, thick) {
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(ang);
      ctx.fillStyle = P.clawdLo;
      ctx.fillRect(0, -thick / 2, len, thick);
      ctx.fillStyle = mix(P.clawd, P.clawdHi, 0.35);
      ctx.fillRect(len - thick * 0.9, -thick * 0.85, thick * 1.7, thick * 1.7);
      ctx.restore();
    }
    var shY = by + 6.4 * u, blur = pose.armBlur || 0;
    var aL = pose.armL === undefined ? 2.4 : pose.armL;
    var aR = pose.armR === undefined ? 0.7 : pose.armR;
    if (blur > 0.02) {
      ctx.save(); ctx.globalAlpha = 0.3;
      for (var bi = 1; bi <= 3; bi++) {
        var o = bi * 0.30 * blur;
        arm(bx + 0.6 * u, shY, aL + o, 4.4 * u, 1.5 * u);
        arm(bx + bw - 0.6 * u, shY, aR - o, 4.4 * u, 1.5 * u);
      }
      ctx.restore();
    }
    arm(bx + 0.8 * u, shY, aL, 4.4 * u, 1.6 * u);
    arm(bx + bw - 0.8 * u, shY, aR, 4.4 * u, 1.6 * u);

    /* --- accessoires par etape --- */
    // antenne (stage >= 1) : la connexion au monde
    if (stage > 0.5) {
      var ka = clamp(stage - 0.5, 0, 1);
      var antX = x + 2.5 * u, antTop = by - 3.4 * u * ka;
      ctx.strokeStyle = P.clawdLo; ctx.lineWidth = Math.max(1.2, u * 0.4);
      ctx.beginPath(); ctx.moveTo(antX, by + 0.5 * u);
      ctx.quadraticCurveTo(antX + u, antTop + u, antX + 0.4 * u, antTop); ctx.stroke();
      var pulse = (pose.t * 1.35) % 1;
      ctx.fillStyle = mix(P.gold, P.clawdHi, 0.4);
      ctx.beginPath(); ctx.arc(antX + 0.4 * u, antTop, u * 0.62, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = rgba(P.gold, (1 - pulse) * 0.6 * ka);
      ctx.lineWidth = Math.max(1, u * 0.22);
      ctx.beginPath(); ctx.arc(antX + 0.4 * u, antTop, u * (0.8 + pulse * 3.2), 0, 6.2832); ctx.stroke();
    }
    // visiere (stage >= 2) : il lit le code
    if (stage > 1.6) {
      var kv = clamp((stage - 1.6) / 0.8, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.55 * kv;
      ctx.fillStyle = rgba(P.cool, 0.55);
      rr(ctx, x - 6.4 * u, eyeY - 2.1 * u, 12.8 * u, 4.2 * u, u * 0.9); ctx.fill();
      ctx.strokeStyle = rgba(P.teal, 0.85); ctx.lineWidth = Math.max(1, u * 0.18);
      rr(ctx, x - 6.4 * u, eyeY - 2.1 * u, 12.8 * u, 4.2 * u, u * 0.9); ctx.stroke();
      // lignes de code qui defilent dans la visiere
      ctx.beginPath(); rr(ctx, x - 6.4 * u, eyeY - 2.1 * u, 12.8 * u, 4.2 * u, u * 0.9); ctx.clip();
      for (var sl = 0; sl < 4; sl++) {
        var sy2 = eyeY - 1.6 * u + sl * 1.1 * u;
        var off = ((pose.t * 60 + sl * 37) % (14 * u));
        ctx.fillStyle = rgba(P.teal, 0.7);
        ctx.fillRect(x - 6.2 * u + off - 14 * u, sy2, 3.2 * u, Math.max(1, u * 0.3));
        ctx.fillRect(x - 6.2 * u + off - 6 * u, sy2, 1.6 * u, Math.max(1, u * 0.3));
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- trajectoire de Clawd sur les 30 s ---------- */
  // y = ligne des pieds. Continu : le personnage ne "coupe" jamais.
  var TRACK = [
    { t: 0.0, x: 705, y: 806, u: 5.4, stage: 0.0, armL: 2.45, armR: 0.85, smile: 0.15, lookX: 0.5, lookY: 0.2, tilt: -0.02, brow: 0.0, open: 0, aura: 0, armBlur: 0, step: 0 },
    { t: 2.2, x: 690, y: 802, u: 5.5, stage: 0.05, armL: 1.15, armR: 0.80, smile: 0.25, lookX: 0.9, lookY: 0.1, tilt: 0.03, brow: 0.15, open: 0.1, aura: 0, armBlur: 0, step: 0 },
    { t: 4.3, x: 712, y: 804, u: 5.6, stage: 0.25, armL: 2.30, armR: 0.60, smile: 0.5, lookX: 0.6, lookY: -0.2, tilt: 0, brow: 0, open: 0.25, aura: 0.01, armBlur: 0, step: 0 },
    { t: 6.4, x: 470, y: 812, u: 6.1, stage: 1.0, armL: 2.05, armR: 0.35, smile: 0.55, lookX: 1.2, lookY: -0.5, tilt: 0.02, brow: 0.1, open: 0.15, aura: 0.02, armBlur: 0.15, step: 0.4 },
    { t: 9.0, x: 500, y: 808, u: 6.3, stage: 1.5, armL: 2.6, armR: 0.2, smile: 0.7, lookX: 1.4, lookY: -0.3, tilt: -0.02, brow: 0, open: 0.35, aura: 0.03, armBlur: 0.1, step: 0.2 },
    { t: 11.2, x: 1398, y: 902, u: 7.0, stage: 2.0, armL: 3.55, armR: -0.45, smile: 0.2, lookX: -1.0, lookY: 0.7, tilt: 0.03, brow: 0.8, open: 0, aura: 0.03, armBlur: 1.0, step: 0 },
    { t: 14.2, x: 1406, y: 900, u: 7.2, stage: 2.3, armL: 3.45, armR: -0.35, smile: 0.35, lookX: -0.9, lookY: 0.6, tilt: 0.01, brow: 0.6, open: 0.2, aura: 0.05, armBlur: 1.0, step: 0 },
    { t: 16.6, x: 520, y: 812, u: 7.4, stage: 3.0, armL: 2.15, armR: 1.05, smile: 0.5, lookX: 1.1, lookY: -0.6, tilt: -0.02, brow: 0.2, open: 0.3, aura: 0.07, armBlur: 0.25, step: 0.15 },
    { t: 19.6, x: 960, y: 800, u: 8.0, stage: 3.8, armL: 2.55, armR: 0.60, smile: 0.5, lookX: 0, lookY: -0.6, tilt: 0, brow: 0.35, open: 0.35, aura: 0.10, armBlur: 0.3, step: 0.1 },
    { t: 23.0, x: 960, y: 776, u: 9.0, stage: 4.4, armL: 3.65, armR: -0.50, smile: 0.7, lookX: 0, lookY: -0.8, tilt: 0, brow: 0.2, open: 0.5, aura: 0.16, armBlur: 0.2, step: 0 },
    { t: 24.3, x: 960, y: 762, u: 9.8, stage: 5.0, armL: 4.05, armR: -0.90, smile: 0.9, lookX: 0, lookY: -1.0, tilt: 0, brow: 0, open: 0.85, aura: 0.30, armBlur: 0, step: 0 },
    { t: 26.6, x: 960, y: 792, u: 8.0, stage: 4.6, armL: 3.05, armR: 0.10, smile: 0.9, lookX: 0, lookY: -0.9, tilt: 0, brow: 0, open: 0.35, aura: 0.16, armBlur: 0, step: 0 },
    { t: 28.6, x: 960, y: 800, u: 7.4, stage: 4.4, armL: 3.85, armR: -0.75, smile: 1.0, lookX: 0, lookY: -1.0, tilt: 0, brow: 0, open: 0.2, aura: 0.13, armBlur: 0, step: 0 },
    { t: 30.0, x: 960, y: 800, u: 7.4, stage: 4.4, armL: 3.95, armR: -0.85, smile: 1.0, lookX: 0, lookY: -1.0, tilt: 0, brow: 0, open: 0.15, aura: 0.12, armBlur: 0, step: 0 }
  ];
  var BLINKS = [1.1, 2.0, 3.6, 5.4, 7.1, 9.3, 12.4, 15.1, 17.9, 21.2, 27.4, 28.9];
  function blinkAt(t) {
    var v = 0;
    for (var i = 0; i < BLINKS.length; i++) {
      var d = Math.abs(t - BLINKS[i]);
      if (d < 0.09) v = Math.max(v, 1 - d / 0.09);
    }
    return v;
  }

  function clawdPose(t) {
    var keys = ['x', 'y', 'u', 'stage', 'armL', 'armR', 'smile', 'lookX', 'lookY', 'tilt', 'brow', 'open', 'aura', 'armBlur', 'step'];
    var p = { t: t };
    for (var i = 0; i < keys.length; i++) p[keys[i]] = trackValue(TRACK, keys[i], t);
    p.blink = blinkAt(t);
    // frappe frenetique scene 3 : les bras vibrent
    if (t > 10.2 && t < 15.2) {
      var f = Math.sin(t * 34) * 0.16, f2 = Math.cos(t * 31) * 0.16;
      p.armL += f; p.armR += f2;
    }
    // hesitation scene 1 : petit balancement
    if (t < 5.2) { p.tilt += Math.sin(t * 1.7) * 0.025; p.x += Math.sin(t * 0.9) * 5; }
    return p;
  }

  function drawClawdGlobal(ctx, t) {
    var p = clawdPose(t);
    drawClawd(ctx, p.x, p.y, p.u, p);
    return p;
  }

  global.C = {
    W: W, H: H, P: P,
    clamp: clamp, lerp: lerp, inv: inv, smooth: smooth, smoother: smoother, ease: ease,
    easeOutCubic: easeOutCubic, easeOutBack: easeOutBack,
    hash: hash, hash2: hash2, vnoise: vnoise, trackValue: trackValue,
    rgba: rgba, mix: mix, rr: rr, glow: glow, textC: textC,
    drawBackdrop: drawBackdrop, drawVignetteGrain: drawVignetteGrain,
    drawClawd: drawClawd, drawClawdGlobal: drawClawdGlobal, clawdPose: clawdPose
  };
})(window);
