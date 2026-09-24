/* =============================================================
   scenes.js — les 6 sequences. Chaque scene est une fonction pure
   du temps global t : draw(ctx, t). L'opacite et le leger zoom des
   transitions sont geres par le compositeur (main.js).
   ============================================================= */
(function (global) {
  'use strict';
  var c = global.C, P = c.P, W = c.W, H = c.H;
  var rgba = c.rgba, mix = c.mix, rr = c.rr, glow = c.glow;
  var lerp = c.lerp, inv = c.inv, ease = c.ease, smoother = c.smoother, clamp = c.clamp, hash = c.hash;

  var MONO = '"DejaVu Sans Mono", "Noto Sans Mono", monospace';
  var SANS = 'Inter, "Inter Display", "DejaVu Sans", sans-serif';

  /* ---------- machine a ecrire (\b = retour arriere, \u0001 = pause) ---------- */
  function typed(script, t, t0, cps) {
    if (t < t0) return { s: '', done: false, active: false };
    var n = Math.floor((t - t0) * cps), out = '';
    for (var i = 0; i < script.length && i < n; i++) {
      var ch = script[i];
      if (ch === '\b') out = out.slice(0, -1);
      else if (ch === '\u0001') continue;
      else out += ch;
    }
    return { s: out, done: n >= script.length, active: true };
  }
  function caret(ctx, x, y, size, t, a) {
    var on = (t * 2.2) % 1 < 0.55;
    if (!on) return;
    ctx.fillStyle = rgba(P.cream, 0.8 * a);
    ctx.fillRect(x, y - size * 0.78, size * 0.55, size * 0.95);
  }
  function panel(ctx, x, y, w, h, a, title, accent) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    ctx.fillStyle = rgba('#0D0B0A', 0.90 * a);
    rr(ctx, x, y, w, h, 14); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(accent || P.clawd, 0.30 * a); ctx.lineWidth = 1.5;
    rr(ctx, x, y, w, h, 14); ctx.stroke();
    // barre de titre
    ctx.fillStyle = rgba('#191412', 0.95 * a);
    rr(ctx, x, y, w, 40, 14); ctx.fill();
    ctx.fillStyle = rgba('#191412', 0.95 * a); ctx.fillRect(x, y + 26, w, 14);
    ctx.strokeStyle = rgba(accent || P.clawd, 0.18 * a);
    ctx.beginPath(); ctx.moveTo(x, y + 40); ctx.lineTo(x + w, y + 40); ctx.stroke();
    var dots = [P.red, P.gold, P.green];
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = rgba(dots[i], 0.75 * a);
      ctx.beginPath(); ctx.arc(x + 22 + i * 20, y + 20, 5.5, 0, 6.2832); ctx.fill();
    }
    if (title) {
      ctx.font = '15px ' + MONO; ctx.fillStyle = rgba(P.muted, 0.75 * a);
      ctx.textAlign = 'left'; ctx.fillText(title, x + 92, y + 25);
    }
  }

  /* ---------- coloration syntaxique ---------- */
  var TOKEN = /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|(\b(?:async|await|fn|let|mut|for|in|if|else|return|Ok|Err|impl|struct|match|def|class|import|from|assert|with|as|not|and|or|None|True|False|self|pub|use|type|const|while|yield)\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_])/g;
  function drawCode(ctx, str, x, y, size, a, charW) {
    ctx.font = size + 'px ' + MONO; ctx.textAlign = 'left';
    TOKEN.lastIndex = 0;
    var m, cx = x;
    while ((m = TOKEN.exec(str)) !== null) {
      var col = P.cream, al = 0.88;
      if (m[1]) { col = P.dim; al = 0.9; }
      else if (m[2]) { col = P.green; }
      else if (m[3]) { col = P.teal; }
      else if (m[4]) { col = P.violet; }
      else if (m[5]) { col = P.cream; al = 0.82; }
      else if (m[6]) { cx += m[0].length * charW; continue; }
      else { col = P.muted; }
      ctx.fillStyle = rgba(col, al * a);
      ctx.fillText(m[0], cx, y);
      cx += m[0].length * charW;
    }
    return cx;
  }

  /* =============================================================
     SCENE 1 — les debuts maladroits (chat)
     ============================================================= */
  var S1_USER = 'salut clawd, tu sais faire quoi ?';
  var S1_BOT = 'je... je sais dire bonjuor\b\b\b\bjour.\u0001\u0001\u0001 c\'est deja ca.';
  function scene1(ctx, t) {
    var px = 985, py = 300, pw = 740, ph = 372;
    var a = 1;
    panel(ctx, px, py, pw, ph, a, 'clawd v0.1 — chat', P.clawd);

    var fs = 23, charW = 13.85;
    ctx.textAlign = 'left';

    // prompt utilisateur
    var u = typed(S1_USER, t, 0.75, 17);
    if (u.active) {
      ctx.font = fs + 'px ' + MONO;
      ctx.fillStyle = rgba(P.clawd, 0.95);
      ctx.fillText('>', px + 34, py + 104);
      ctx.fillStyle = rgba(P.cream, 0.92);
      ctx.fillText(u.s, px + 34 + charW * 2, py + 104);
      if (!u.done) caret(ctx, px + 34 + charW * (2 + u.s.length) + 2, py + 104, fs, t, 1);
    }

    // "il reflechit" : trois points hesitants
    if (t > 2.35 && t < 3.05) {
      var nd = Math.floor((t - 2.35) / 0.22) + 1;
      ctx.font = fs + 'px ' + MONO; ctx.fillStyle = rgba(P.muted, 0.7);
      ctx.fillText('.'.repeat(Math.min(3, nd)), px + 34, py + 168);
    }

    // reponse maladroite, avec faute corrigee en direct
    var b = typed(S1_BOT, t, 3.05, 15);
    if (b.active) {
      ctx.font = fs + 'px ' + MONO;
      // avatar minuscule devant la reponse
      ctx.fillStyle = rgba(P.clawd, 0.9);
      ctx.fillRect(px + 34, py + 152, 16, 16);
      ctx.fillStyle = rgba(P.cream, 0.88);
      var lines = [], src = b.s;
      while (src.length > 40) { lines.push(src.slice(0, 40)); src = src.slice(40); }
      lines.push(src);
      for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], px + 64, py + 168 + i * 34);
      var last = lines[lines.length - 1];
      if (!b.done) caret(ctx, px + 64 + charW * last.length + 2, py + 168 + (lines.length - 1) * 34, fs, t, 1);
    }

    // barre de capacites : une seule case allumee
    var caps = ['chat', 'web', 'code', '3d', 'science'];
    ctx.font = '14px ' + MONO;
    for (var k = 0; k < caps.length; k++) {
      var cx2 = px + 34 + k * 132, cy2 = py + ph - 58;
      var on = k === 0 ? clamp((t - 4.2) * 2, 0, 1) : 0;
      ctx.fillStyle = rgba(on ? P.clawd : '#2A2320', 0.25 + 0.6 * on);
      rr(ctx, cx2, cy2, 116, 28, 8); ctx.fill();
      ctx.fillStyle = rgba(on ? P.cream : P.dim, 0.5 + 0.45 * on);
      ctx.textAlign = 'center'; ctx.fillText(caps[k], cx2 + 58, cy2 + 19);
    }
    ctx.textAlign = 'left';

    // goutte de sueur sur Clawd (il a a peine reussi)
    var sw = ease(2.5, 3.1, t) * (1 - ease(4.6, 5.2, t));
    if (sw > 0.01) {
      var p = c.clawdPose(t);
      var dx = p.x + 6.6 * p.u, dy = p.y - 12.4 * p.u + ease(2.5, 4.6, t) * 46;
      ctx.fillStyle = rgba(P.cool, 0.75 * sw);
      ctx.beginPath(); ctx.ellipse(dx, dy, 5, 8, 0, 0, 6.2832); ctx.fill();
    }
    // projecteur unique : il est seul dans le noir
    var sp = ctx.createRadialGradient(705, 700, 40, 705, 780, 460);
    sp.addColorStop(0, rgba(P.cream, 0.055));
    sp.addColorStop(1, rgba(P.cream, 0));
    ctx.fillStyle = sp; ctx.fillRect(160, 300, 1100, 780);
  }

  /* =============================================================
     SCENE 2 — la recherche sur internet
     ============================================================= */
  var NODES = (function () {
    var out = [], n = 54, ga = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = ga * i;
      out.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    return out;
  })();
  var LINKS = (function () {
    var out = [];
    for (var i = 0; i < 26; i++) out.push([Math.floor(hash(i * 2.3) * 54), Math.floor(hash(i * 5.7) * 54)]);
    return out;
  })();
  var CHIPS = ['docs.rs', 'arxiv:2503.14', 'RFC 9110', 'stackoverflow', 'changelog.md', 'wikipedia', 'pubmed', 'src/lib.rs', 'openapi.json', 'ISO 8601'];

  function scene2(ctx, t) {
    var lt = t - 5.3;
    var gx = 1330, gy = 486, R = 212;
    var rot = lt * 0.42;
    var app = ease(5.0, 6.6, t);

    // globe : meridiens / paralleles
    ctx.save();
    ctx.lineWidth = 1.2;
    for (var la = -3; la <= 3; la++) {
      var yy = Math.sin(la * 0.38) * R, rr2 = Math.cos(la * 0.38) * R;
      ctx.strokeStyle = rgba(P.cool, 0.20 * app);
      ctx.beginPath(); ctx.ellipse(gx, gy + yy, rr2, rr2 * 0.20, 0, 0, 6.2832); ctx.stroke();
    }
    for (var me = 0; me < 6; me++) {
      var ph = rot + me * Math.PI / 6;
      var w2 = Math.abs(Math.cos(ph)) * R;
      ctx.strokeStyle = rgba(P.cool, 0.13 * app + 0.10 * app * Math.abs(Math.cos(ph)));
      ctx.beginPath(); ctx.ellipse(gx, gy, w2, R, 0, 0, 6.2832); ctx.stroke();
    }
    glow(ctx, gx, gy, R * 1.5, P.cool, 0.10 * app);

    // noeuds
    var pts = [];
    for (var i = 0; i < NODES.length; i++) {
      var p = NODES[i];
      var cs = Math.cos(rot), sn = Math.sin(rot);
      var x3 = p[0] * cs - p[2] * sn, z3 = p[0] * sn + p[2] * cs;
      var sx = gx + x3 * R, sy = gy + p[1] * R * 0.98;
      var front = (z3 + 1) / 2;
      pts.push([sx, sy, front]);
      var lit = 0.5 + 0.5 * Math.sin(lt * 2.4 + i * 1.7);
      var rr3 = (1.6 + front * 2.6) * (0.8 + lit * 0.5);
      ctx.fillStyle = rgba(i % 5 === 0 ? P.clawdHi : P.cream, (0.18 + 0.62 * front) * app * (0.55 + lit * 0.45));
      ctx.beginPath(); ctx.arc(sx, sy, rr3, 0, 6.2832); ctx.fill();
    }
    // liens qui s'allument
    for (var l = 0; l < LINKS.length; l++) {
      var A = pts[LINKS[l][0]], B = pts[LINKS[l][1]];
      if (!A || !B) continue;
      var ph2 = (lt * 0.55 + l * 0.17) % 1;
      var alive = Math.sin(Math.PI * ph2);
      var fr = (A[2] + B[2]) / 2;
      ctx.strokeStyle = rgba(P.teal, 0.42 * alive * fr * app);
      ctx.lineWidth = 1 + alive * 1.4;
      var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]);
      ctx.quadraticCurveTo(mx + (mx - gx) * 0.22, my + (my - gy) * 0.22, B[0], B[1]); ctx.stroke();
    }
    ctx.restore();

    // barre de recherche
    var bx = 830, by = 214, bw = 620;
    var ba = ease(5.2, 6.0, t);
    ctx.fillStyle = rgba('#100D0C', 0.88 * ba);
    rr(ctx, bx, by, bw, 56, 28); ctx.fill();
    ctx.strokeStyle = rgba(P.teal, 0.35 * ba); ctx.lineWidth = 1.4;
    rr(ctx, bx, by, bw, 56, 28); ctx.stroke();
    ctx.strokeStyle = rgba(P.muted, 0.7 * ba); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(bx + 34, by + 26, 9, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 41, by + 33); ctx.lineTo(bx + 49, by + 41); ctx.stroke();
    var q = typed('comment le monde fonctionne ?', t, 5.75, 19);
    ctx.font = '22px ' + MONO; ctx.textAlign = 'left';
    ctx.fillStyle = rgba(P.cream, 0.9 * ba);
    ctx.fillText(q.s, bx + 62, by + 35);
    if (!q.done) caret(ctx, bx + 62 + q.s.length * 13.25, by + 35, 22, t, ba);

    // resultats qui defilent
    var res = ['— 1 284 sources lues', '— 37 contradictions reperees', '— 6 papiers retenus'];
    ctx.font = '17px ' + MONO;
    for (var r2 = 0; r2 < res.length; r2++) {
      var ra = ease(7.3 + r2 * 0.55, 7.9 + r2 * 0.55, t) * (1 - ease(10.1, 10.6, t));
      if (ra < 0.01) continue;
      ctx.fillStyle = rgba(P.muted, 0.8 * ra);
      ctx.fillText(res[r2], bx + 24 + (1 - ra) * 14, by + 96 + r2 * 30);
    }

    // pastilles de donnees qui volent vers Clawd
    var pose = c.clawdPose(t);
    var tx = pose.x + 3 * pose.u, ty = pose.y - 11 * pose.u;
    ctx.font = '16px ' + MONO;
    for (var ch = 0; ch < CHIPS.length; ch++) {
      var t0 = 6.1 + ch * 0.38;
      var k = inv(t0, t0 + 2.5, t);
      if (k <= 0 || k >= 1) continue;
      var e = smoother(k);
      var sa = Math.sin(Math.PI * k);
      var a0 = gx + Math.cos(ch * 2.1) * R * 0.8, b0 = gy + Math.sin(ch * 1.7) * R * 0.7;
      var cx3 = lerp(a0, tx, e) + Math.sin(k * 3.1 + ch) * 60 * (1 - e);
      var cy3 = lerp(b0, ty, e) - 150 * Math.sin(Math.PI * e) ;
      var txt = CHIPS[ch], wch = txt.length * 9.6 + 26;
      var sc = lerp(1, 0.25, e);
      ctx.save();
      ctx.translate(cx3, cy3); ctx.scale(sc, sc); ctx.globalAlpha = sa;
      ctx.fillStyle = rgba('#141010', 0.9);
      rr(ctx, -wch / 2, -16, wch, 32, 16); ctx.fill();
      ctx.strokeStyle = rgba(P.teal, 0.5); ctx.lineWidth = 1.4;
      rr(ctx, -wch / 2, -16, wch, 32, 16); ctx.stroke();
      ctx.fillStyle = rgba(P.cream, 0.92); ctx.textAlign = 'center';
      ctx.fillText(txt, 0, 6);
      ctx.restore();
      // trainee
      ctx.strokeStyle = rgba(P.teal, 0.20 * sa);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx3, cy3);
      ctx.lineTo(lerp(a0, tx, Math.max(0, e - 0.09)), lerp(b0, ty, Math.max(0, e - 0.09)) - 150 * Math.sin(Math.PI * Math.max(0, e - 0.09)));
      ctx.stroke();
    }
    // onde d'absorption sur Clawd
    for (var wv = 0; wv < 3; wv++) {
      var wk = ((lt * 0.8 + wv / 3) % 1);
      ctx.strokeStyle = rgba(P.teal, 0.22 * (1 - wk) * ease(6.2, 7.0, t));
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(tx, ty, 40 + wk * 150, 0, 6.2832); ctx.stroke();
    }
  }

  /* =============================================================
     SCENE 3 — il ecrit du code
     ============================================================= */
  var CODE_L = [
    'async fn solve(task: &Task) -> Result<Patch> {',
    '    let ctx = index.retrieve(&task.query, 32)?;',
    '    let plan = model.plan(&ctx).await?;',
    '    for step in plan.steps() {',
    '        let patch = step.apply(&repo)?;',
    '        if tests.run(&patch)?.all_green() {',
    '            return Ok(patch);   // premiere fois !',
    '        }',
    '    }',
    '    Err(Error::NoSolution)',
    '}'
  ];
  var CODE_R = [
    'def test_solve():',
    '    p = solve(Task("fix flaky test"))',
    '    assert p.diff_lines > 0',
    '    assert p.tests_green is True',
    '',
    '# 248 passed in 3.41s'
  ];
  function scene3(ctx, t) {
    var lt = t - 10.3;
    var a = 1;
    // pane gauche
    var px = 130, py = 214, pw = 800, ph = 470;
    panel(ctx, px, py, pw, ph, a, 'engine/solver.rs', P.clawd);
    var fs = 20, cw = 12.04;
    var startX = px + 74, startY = py + 84;
    var perLine = 0.30;
    for (var i = 0; i < CODE_L.length; i++) {
      var t0 = 10.75 + i * perLine;
      var full = CODE_L[i];
      var cps = 42;
      var r = typed(full, t, t0, cps);
      if (!r.active) continue;
      var la = clamp((t - t0) * 3, 0, 1);
      // numero de ligne + marque de diff
      ctx.font = fs + 'px ' + MONO; ctx.textAlign = 'right';
      ctx.fillStyle = rgba(P.dim, 0.85 * la);
      ctx.fillText(String(i + 1), px + 52, startY + i * 33);
      ctx.textAlign = 'left';
      ctx.fillStyle = rgba(P.green, 0.55 * la);
      ctx.fillText('+', px + 60, startY + i * 33);
      drawCode(ctx, r.s, startX, startY + i * 33, fs, la, cw);
      if (!r.done) caret(ctx, startX + r.s.length * cw + 1, startY + i * 33, fs, t, 1);
    }
    // pane droite : les tests
    var qx = 968, qy = 214, qw = 560, qh = 300;
    var qa = ease(12.0, 12.7, t);
    if (qa > 0.01) {
      panel(ctx, qx, qy, qw, qh, qa, 'tests/test_solver.py', P.green);
      for (var j = 0; j < CODE_R.length; j++) {
        var rt0 = 12.4 + j * 0.26;
        var rr4 = typed(CODE_R[j], t, rt0, 46);
        if (!rr4.active) continue;
        var ja = clamp((t - rt0) * 3, 0, 1) * qa;
        ctx.textAlign = 'right'; ctx.font = '18px ' + MONO;
        ctx.fillStyle = rgba(P.dim, 0.8 * ja);
        ctx.fillText(String(j + 1), qx + 46, qy + 80 + j * 30);
        ctx.textAlign = 'left';
        drawCode(ctx, rr4.s, qx + 62, qy + 80 + j * 30, 18, ja, 10.84);
      }
    }
    // bandeau CI
    var ca = ease(13.1, 13.8, t);
    if (ca > 0.01) {
      var sx = 968, sy = 546, sw = 560, sh = 138;
      panel(ctx, sx, sy, sw, sh, ca, 'ci — pipeline', P.teal);
      var steps = ['lint', 'types', 'tests', 'build'];
      for (var s2 = 0; s2 < steps.length; s2++) {
        var ok = ease(13.5 + s2 * 0.32, 13.9 + s2 * 0.32, t);
        var bx2 = sx + 28 + s2 * 132;
        ctx.fillStyle = rgba(ok > 0.5 ? P.green : '#241D1A', (0.18 + 0.35 * ok) * ca);
        rr(ctx, bx2, sy + 62, 112, 40, 10); ctx.fill();
        ctx.strokeStyle = rgba(ok > 0.5 ? P.green : P.dim, 0.6 * ca); ctx.lineWidth = 1.2;
        rr(ctx, bx2, sy + 62, 112, 40, 10); ctx.stroke();
        ctx.font = '16px ' + MONO; ctx.textAlign = 'center';
        ctx.fillStyle = rgba(ok > 0.5 ? P.cream : P.dim, (0.5 + 0.5 * ok) * ca);
        ctx.fillText(steps[s2], bx2 + 48, sy + 87);
        if (ok > 0.5) {
          ctx.strokeStyle = rgba(P.green, ca); ctx.lineWidth = 2.6; ctx.lineCap = 'round';
          var kx = bx2 + 96, ky = sy + 80;
          var kk = clamp((ok - 0.5) * 2, 0, 1);
          ctx.beginPath(); ctx.moveTo(kx - 8, ky + 2);
          ctx.lineTo(kx - 8 + 5 * Math.min(1, kk * 2), ky + 2 + 5 * Math.min(1, kk * 2));
          if (kk > 0.5) ctx.lineTo(kx - 3 + 9 * (kk - 0.5) * 2, ky + 7 - 10 * (kk - 0.5) * 2);
          ctx.stroke();
        }
      }
      // compteur de tests
      var n = Math.floor(ease(13.2, 14.9, t) * 248);
      ctx.font = '15px ' + MONO; ctx.textAlign = 'left';
      ctx.fillStyle = rgba(P.muted, 0.85 * ca);
      ctx.fillText(n + ' tests verts   ·   0 echec   ·   couverture ' + (60 + Math.floor(ease(13.2, 14.9, t) * 34)) + '%', sx + 28, sy + 128);
    }
    // symboles en orbite autour de Clawd
    var pose = c.clawdPose(t);
    var ox = pose.x, oy = pose.y - 11 * pose.u;
    var syms = ['{', '}', '[', ']', '=>', ';', '()', '&&', '::', '?'];
    ctx.font = '26px ' + MONO; ctx.textAlign = 'center';
    for (var s3 = 0; s3 < syms.length; s3++) {
      var ang = lt * 0.9 + s3 * 6.2832 / syms.length;
      var rad = 118 + Math.sin(lt * 1.3 + s3) * 20;
      var oa = ease(11.0, 12.0, t) * (0.35 + 0.5 * (0.5 + 0.5 * Math.sin(ang)));
      ctx.fillStyle = rgba(s3 % 3 === 0 ? P.gold : P.teal, oa * (1 - ease(15.0, 15.7, t)));
      ctx.fillText(syms[s3], ox + Math.cos(ang) * rad, oy + Math.sin(ang) * rad * 0.42);
    }
  }

  /* =============================================================
     SCENE 4 — il construit des modeles 3D
     ============================================================= */
  function proj(p, ry, rx, cz, cx, cy, f) {
    var cs = Math.cos(ry), sn = Math.sin(ry);
    var x = p[0] * cs - p[2] * sn, z = p[0] * sn + p[2] * cs, y = p[1];
    var c2 = Math.cos(rx), s2 = Math.sin(rx);
    var y2 = y * c2 - z * s2, z2 = y * s2 + z * c2;
    var d = cz + z2; if (d < 0.2) d = 0.2;
    var k = f / d;
    return [cx + x * k, cy + y2 * k, d];
  }
  var ICO = (function () {
    var g = (1 + Math.sqrt(5)) / 2;
    var v = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g],
      [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]];
    var n = Math.sqrt(1 + g * g);
    for (var i = 0; i < v.length; i++) { v[i][0] /= n; v[i][1] /= n; v[i][2] /= n; }
    var e = [];
    for (var a = 0; a < 12; a++) for (var b = a + 1; b < 12; b++) {
      var dx = v[a][0] - v[b][0], dy = v[a][1] - v[b][1], dz = v[a][2] - v[b][2];
      var d2 = dx * dx + dy * dy + dz * dz;
      if (Math.abs(d2 - 4 / (1 + g * g)) < 0.02) e.push([a, b]);
    }
    return { v: v, e: e };
  })();

  function scene4(ctx, t) {
    var lt = t - 15.3;
    var app = ease(15.0, 16.2, t);

    /* --- icosaedre : la premiere forme --- */
    var cx = 1300, cy = 400, S = 190;
    var ry = lt * 0.62, rx = 0.42 + Math.sin(lt * 0.5) * 0.16;
    var build = ease(15.4, 17.4, t);
    var vp = [];
    for (var i = 0; i < ICO.v.length; i++) {
      var p = ICO.v[i];
      vp.push(proj([p[0] * S, p[1] * S, p[2] * S], ry, rx, 760, cx, cy, 760));
    }
    // faces translucides
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var e2 = 0; e2 < ICO.e.length; e2++) {
      var k = clamp(build * ICO.e.length - e2, 0, 1);
      if (k <= 0) continue;
      var A = vp[ICO.e[e2][0]], B = vp[ICO.e[e2][1]];
      var dep = clamp((1200 - (A[2] + B[2]) / 2) / 420, 0, 1);
      ctx.strokeStyle = rgba(mix(P.teal, P.clawdHi, dep), (0.20 + 0.55 * dep) * k * app);
      ctx.lineWidth = 1 + dep * 1.8;
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(lerp(A[0], B[0], k), lerp(A[1], B[1], k));
      ctx.stroke();
    }
    ctx.restore();
    for (var v2 = 0; v2 < vp.length; v2++) {
      var kv = clamp(build * 14 - v2, 0, 1);
      if (kv <= 0) continue;
      var dep2 = clamp((1200 - vp[v2][2]) / 420, 0, 1);
      ctx.fillStyle = rgba(P.cream, (0.3 + 0.6 * dep2) * kv * app);
      ctx.beginPath(); ctx.arc(vp[v2][0], vp[v2][1], 2 + dep2 * 2.6, 0, 6.2832); ctx.fill();
    }
    glow(ctx, cx, cy, 320, P.teal, 0.07 * app * build);

    /* --- tore parametrique --- */
    var tk = ease(16.9, 18.6, t);
    if (tk > 0.01) {
      var tcx = 700, tcy = 380, Rt = 132, rt = 46;
      var tr = lt * 0.5 + 0.8;
      ctx.lineWidth = 1.2;
      for (var u = 0; u < 22; u++) {
        var uu = u / 22 * 6.2832;
        if (u / 22 > tk) break;
        ctx.beginPath();
        for (var v3 = 0; v3 <= 16; v3++) {
          var vv = v3 / 16 * 6.2832;
          var px2 = (Rt + rt * Math.cos(vv)) * Math.cos(uu);
          var py2 = rt * Math.sin(vv);
          var pz2 = (Rt + rt * Math.cos(vv)) * Math.sin(uu);
          var sp = proj([px2, py2, pz2], tr, 0.62, 620, tcx, tcy, 620);
          if (v3 === 0) ctx.moveTo(sp[0], sp[1]); else ctx.lineTo(sp[0], sp[1]);
        }
        ctx.strokeStyle = rgba(P.violet, 0.30 * app);
        ctx.stroke();
      }
      for (var v4 = 0; v4 < 10; v4++) {
        var vv2 = v4 / 10 * 6.2832;
        ctx.beginPath();
        for (var u2 = 0; u2 <= 34; u2++) {
          var uu2 = u2 / 34 * 6.2832 * tk;
          var px3 = (Rt + rt * Math.cos(vv2)) * Math.cos(uu2);
          var py3 = rt * Math.sin(vv2);
          var pz3 = (Rt + rt * Math.cos(vv2)) * Math.sin(uu2);
          var sp2 = proj([px3, py3, pz3], tr, 0.62, 620, tcx, tcy, 620);
          if (u2 === 0) ctx.moveTo(sp2[0], sp2[1]); else ctx.lineTo(sp2[0], sp2[1]);
        }
        ctx.strokeStyle = rgba(mix(P.violet, P.cream, 0.3), 0.22 * app);
        ctx.stroke();
      }
    }

    /* --- lignes de code qui deviennent des aretes --- */
    var frag = ['mesh.subdivide(3)', 'normals()', 'uv.unwrap()', 'bake(light)'];
    ctx.font = '17px ' + MONO; ctx.textAlign = 'center';
    for (var f2 = 0; f2 < frag.length; f2++) {
      var ft0 = 15.6 + f2 * 0.62;
      var fk = inv(ft0, ft0 + 1.5, t);
      if (fk <= 0 || fk >= 1) continue;
      var fe = smoother(fk);
      var fx = lerp(330, cx, fe), fy = lerp(760 - f2 * 40, cy, fe);
      ctx.globalAlpha = Math.sin(Math.PI * fk) * 0.85;
      ctx.fillStyle = rgba(P.gold, 0.9);
      ctx.fillText(frag[f2], fx, fy);
      ctx.globalAlpha = 1;
    }

    /* --- petit HUD de modeleur --- */
    var ha = ease(16.4, 17.2, t);
    if (ha > 0.01) {
      ctx.textAlign = 'left'; ctx.font = '15px ' + MONO;
      var info = ['vertices   12 → 642', 'edges      30 → 1 920', 'faces      20 → 1 280', 'solver     stable'];
      for (var h2 = 0; h2 < info.length; h2++) {
        ctx.fillStyle = rgba(P.muted, 0.7 * ha);
        ctx.fillText(info[h2], 1560, 700 + h2 * 26);
      }
      // gizmo d'axes
      var g0 = proj([0, 0, 0], ry, rx, 760, 1620, 250, 760);
      var axes = [[[70, 0, 0], P.red, 'x'], [[0, -70, 0], P.green, 'y'], [[0, 0, 70], P.cool, 'z']];
      for (var ax = 0; ax < 3; ax++) {
        var ep = proj(axes[ax][0], ry, rx, 760, 1620, 250, 760);
        ctx.strokeStyle = rgba(axes[ax][1], 0.8 * ha); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(ep[0], ep[1]); ctx.stroke();
      }
    }
  }

  /* =============================================================
     SCENE 5 — les problemes les plus durs
     ============================================================= */
  var COIL = (function () {
    var pts = [], x = 0, y = 0, z = 0;
    for (var i = 0; i < 46; i++) {
      x += (hash(i * 1.7) - 0.5) * 60; y += (hash(i * 3.3) - 0.5) * 60; z += (hash(i * 5.9) - 0.5) * 60;
      pts.push([x, y, z]);
    }
    return pts;
  })();
  var FOLD = (function () {
    var pts = [];
    for (var i = 0; i < 46; i++) {
      var a = i * 0.72, r = 52 + Math.sin(i * 0.3) * 16;
      pts.push([Math.cos(a) * r, (i - 23) * 5.4, Math.sin(a) * r]);
    }
    return pts;
  })();

  function scene5(ctx, t) {
    var lt = t - 19.7;
    var app = ease(19.5, 20.6, t);
    var conv = ease(23.3, 24.4, t);   // les trois chantiers convergent
    var after = ease(24.0, 25.2, t);

    /* --- 1. medecine : double helice --- */
    var dx0 = 360, dy0 = 470;
    var dx = lerp(dx0, 960 - 420 * Math.cos(0.6), conv), dy = lerp(dy0, 430, conv);
    var dsc = lerp(1, 0.78, conv);
    ctx.save(); ctx.translate(dx, dy); ctx.scale(dsc, dsc);
    var N = 30, amp = 86, step = 13.5;
    var repair = inv(21.0, 23.2, t);
    for (var i = 0; i < N; i++) {
      var ang = i * 0.44 - lt * 1.25;
      var y = (i - N / 2) * step;
      var x1 = Math.sin(ang) * amp, z1 = Math.cos(ang);
      var x2 = Math.sin(ang + Math.PI) * amp, z2 = Math.cos(ang + Math.PI);
      var f1 = (z1 + 1) / 2, f2 = (z2 + 1) / 2;
      var broken = (i > 12 && i < 17);
      var fixed = broken && (i - 12) / 5 < repair * 1.2;
      var col = broken ? (fixed ? P.green : P.red) : P.cool;
      ctx.strokeStyle = rgba(col, (0.18 + 0.5 * ((f1 + f2) / 2)) * app);
      ctx.lineWidth = 1.6 + 1.6 * ((f1 + f2) / 2);
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      ctx.fillStyle = rgba(broken ? (fixed ? P.green : P.red) : P.cream, (0.25 + 0.65 * f1) * app);
      ctx.beginPath(); ctx.arc(x1, y, 2.2 + f1 * 3.4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = rgba(broken ? (fixed ? P.green : P.red) : P.clawdHi, (0.25 + 0.65 * f2) * app);
      ctx.beginPath(); ctx.arc(x2, y, 2.2 + f2 * 3.4, 0, 6.2832); ctx.fill();
    }
    // impulsion de reparation qui descend la chaine
    if (repair > 0 && repair < 1) {
      var ry2 = lerp(-N / 2 * step, N / 2 * step, repair);
      glow(ctx, 0, ry2, 120, P.green, 0.30);
    }
    ctx.restore();
    var la1 = app * (1 - conv * 0.7);
    ctx.font = '16px ' + MONO; ctx.textAlign = 'center';
    ctx.fillStyle = rgba(P.muted, 0.75 * la1);
    ctx.fillText('MÉDECINE', dx, dy + 250 * dsc);
    ctx.fillStyle = rgba(P.green, 0.8 * la1 * ease(22.6, 23.2, t));
    ctx.fillText('sequence reparee', dx, dy + 278 * dsc);

    /* --- 2. science : repliement de proteine --- */
    var px0 = 960, py0 = 292;
    var pxc = lerp(px0, 960, conv), pyc = lerp(py0, 250, conv);
    var fold = ease(20.2, 23.4, t);
    ctx.save(); ctx.translate(pxc, pyc);
    var prev = null;
    for (var j = 0; j < COIL.length; j++) {
      var p3 = [lerp(COIL[j][0] * 0.55, FOLD[j][0], smoother(fold)),
        lerp(COIL[j][1] * 0.35, FOLD[j][1], smoother(fold)),
        lerp(COIL[j][2] * 0.55, FOLD[j][2], smoother(fold))];
      var sp3 = proj(p3, lt * 0.55, 0.22, 520, 0, 0, 520);
      var dep = clamp((760 - sp3[2]) / 300, 0, 1);
      if (prev) {
        ctx.strokeStyle = rgba(mix(P.violet, P.gold, j / 46), (0.25 + 0.5 * dep) * app);
        ctx.lineWidth = 1.4 + dep * 2.2;
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(sp3[0], sp3[1]); ctx.stroke();
      }
      ctx.fillStyle = rgba(mix(P.violet, P.cream, dep), (0.2 + 0.55 * dep) * app);
      ctx.beginPath(); ctx.arc(sp3[0], sp3[1], 1.8 + dep * 2.6, 0, 6.2832); ctx.fill();
      prev = sp3;
    }
    ctx.restore();
    ctx.font = '16px ' + MONO; ctx.textAlign = 'center';
    ctx.fillStyle = rgba(P.muted, 0.75 * app * (1 - conv * 0.7));
    ctx.fillText('SCIENCE', pxc, pyc - 150);
    ctx.font = '14px ' + MONO;
    ctx.fillStyle = rgba(P.violet, 0.7 * app * (1 - conv * 0.6));
    ctx.fillText('repliement  ' + Math.floor(fold * 100) + '%   ·   RMSD ' + (2.8 - fold * 2.3).toFixed(2), pxc, pyc + 168);

    /* --- 3. climat : courbe qui se plie --- */
    var cx0 = 1540, cy0 = 470;
    var ccx = lerp(cx0, 960 + 420 * Math.cos(0.6), conv), ccy = lerp(cy0, 430, conv);
    var csc = lerp(1, 0.78, conv);
    ctx.save(); ctx.translate(ccx, ccy); ctx.scale(csc, csc);
    // terre
    var er = 96;
    var eg = ctx.createRadialGradient(-30, -34, 10, 0, 0, er);
    eg.addColorStop(0, rgba(P.cool, 0.55 * app));
    eg.addColorStop(0.65, rgba(mix(P.cool, P.teal, 0.5), 0.30 * app));
    eg.addColorStop(1, rgba('#0B1A22', 0.55 * app));
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(0, -34, er, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = rgba(P.teal, 0.35 * app); ctx.lineWidth = 1.1;
    for (var g2 = -2; g2 <= 2; g2++) {
      var yy2 = g2 * er * 0.34, rr5 = Math.sqrt(Math.max(0, er * er - yy2 * yy2));
      ctx.beginPath(); ctx.ellipse(0, -34 + yy2, rr5, rr5 * 0.2, 0, 0, 6.2832); ctx.stroke();
    }
    for (var m2 = 0; m2 < 4; m2++) {
      var mw = Math.abs(Math.cos(lt * 0.35 + m2 * 0.785)) * er;
      ctx.strokeStyle = rgba(P.teal, 0.18 * app);
      ctx.beginPath(); ctx.ellipse(0, -34, mw, er, 0, 0, 6.2832); ctx.stroke();
    }
    // atmosphere : chaude puis apaisee
    var heat = 1 - ease(22.2, 24.6, t);
    glow(ctx, 0, -34, er * 2.1, mix(P.teal, P.red, heat), (0.09 + 0.14 * heat) * app);
    // courbe de temperature
    var gw = 290, gh = 112, gx0 = -gw / 2, gy0 = 224;
    ctx.strokeStyle = rgba(P.dim, 0.7 * app); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx0 + gw, gy0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx0, gy0 - gh); ctx.stroke();
    var prog = ease(20.4, 25.0, t), turn = 0.58;
    function tempY(u3) {
      var yv = u3 < turn ? Math.pow(u3 / turn, 1.7) : 1 - 0.62 * Math.pow((u3 - turn) / (1 - turn), 1.5);
      return gy0 - yv * gh;
    }
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var lastX = gx0, lastY = gy0;
    // segment subi (rouge)
    ctx.beginPath();
    for (var s5 = 0; s5 <= 100; s5++) {
      var u3 = s5 / 100;
      if (u3 > Math.min(prog, turn)) break;
      var X = gx0 + u3 * gw, Y = tempY(u3);
      if (s5 === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      lastX = X; lastY = Y;
    }
    ctx.strokeStyle = rgba(P.red, 0.9 * app); ctx.stroke();
    // segment infléchi (vert)
    if (prog > turn) {
      ctx.beginPath();
      for (var s6 = 0; s6 <= 100; s6++) {
        var u4 = turn + (s6 / 100) * (1 - turn);
        if (u4 > prog) break;
        var X2 = gx0 + u4 * gw, Y2 = tempY(u4);
        if (s6 === 0) ctx.moveTo(X2, Y2); else ctx.lineTo(X2, Y2);
        lastX = X2; lastY = Y2;
      }
      ctx.strokeStyle = rgba(P.green, 0.92 * app); ctx.stroke();
    }
    var bend = prog > turn;
    if (prog > 0.01) glow(ctx, lastX, lastY, 42, bend ? P.green : P.red, 0.45 * app);
    // particules de carbone capturees
    for (var q2 = 0; q2 < 22; q2++) {
      var qk = ((lt * 0.4 + hash(q2 * 3.1)) % 1);
      var qa2 = Math.sin(Math.PI * qk) * app * ease(21.4, 22.4, t);
      var ang2 = hash(q2 * 7.3) * 6.2832;
      var rad2 = lerp(230, er * 0.9, smoother(qk));
      ctx.fillStyle = rgba(mix(P.red, P.green, smoother(qk)), 0.55 * qa2);
      ctx.beginPath();
      ctx.arc(Math.cos(ang2) * rad2 * 1.05, Math.sin(ang2) * rad2 * 0.55 - 34, 2.6, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
    ctx.font = '16px ' + MONO; ctx.textAlign = 'center';
    ctx.fillStyle = rgba(P.muted, 0.75 * app * (1 - conv * 0.7));
    ctx.fillText('CLIMAT', ccx, ccy + 250 * csc);
    ctx.fillStyle = rgba(P.green, 0.8 * app * ease(23.4, 24.2, t));
    ctx.fillText('trajectoire infléchie', ccx, ccy + 278 * csc);

    /* --- fils de lumiere entre Clawd et les trois chantiers --- */
    var pose = c.clawdPose(t);
    var hx = pose.x, hy = pose.y - 12 * pose.u;
    var targets = [[dx, dy], [pxc, pyc + 60], [ccx, ccy]];
    for (var th = 0; th < targets.length; th++) {
      var ta = ease(20.6 + th * 0.4, 21.4 + th * 0.4, t) * app;
      if (ta < 0.01) continue;
      var T = targets[th];
      var segs = 30;
      ctx.beginPath();
      for (var sg = 0; sg <= segs; sg++) {
        var kk2 = sg / segs;
        var X2 = lerp(hx, T[0], kk2);
        var Y2 = lerp(hy, T[1], kk2) - Math.sin(Math.PI * kk2) * 120;
        Y2 += Math.sin(kk2 * 9 + lt * 4 + th) * 6 * Math.sin(Math.PI * kk2);
        if (sg === 0) ctx.moveTo(X2, Y2); else ctx.lineTo(X2, Y2);
      }
      ctx.strokeStyle = rgba(mix(P.clawdHi, P.gold, 0.4), 0.30 * ta);
      ctx.lineWidth = 1.6; ctx.stroke();
      // impulsions qui circulent
      for (var im = 0; im < 3; im++) {
        var ik = ((lt * 0.7 + im / 3 + th * 0.2) % 1);
        var X3 = lerp(hx, T[0], ik), Y3 = lerp(hy, T[1], ik) - Math.sin(Math.PI * ik) * 120;
        ctx.fillStyle = rgba(P.gold, 0.7 * ta * Math.sin(Math.PI * ik));
        ctx.beginPath(); ctx.arc(X3, Y3, 3.4, 0, 6.2832); ctx.fill();
      }
    }

    /* --- mandala de convergence au climax --- */
    if (conv > 0.01) {
      ctx.save();
      ctx.translate(960, 430);
      for (var ring = 0; ring < 3; ring++) {
        var rr6 = (260 + ring * 90) * (0.7 + 0.3 * conv);
        ctx.strokeStyle = rgba(mix(P.clawdHi, P.cream, ring / 3), 0.22 * conv);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, rr6, 0, 6.2832); ctx.stroke();
        var ticks = 24 + ring * 12;
        for (var tk2 = 0; tk2 < ticks; tk2++) {
          var a2 = tk2 / ticks * 6.2832 + lt * (0.2 + ring * 0.12) * (ring % 2 ? -1 : 1);
          var len = 8 + 14 * (0.5 + 0.5 * Math.sin(a2 * 3 + lt * 2));
          ctx.strokeStyle = rgba(P.clawdHi, 0.30 * conv);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a2) * rr6, Math.sin(a2) * rr6 * 0.9);
          ctx.lineTo(Math.cos(a2) * (rr6 + len), Math.sin(a2) * (rr6 + len) * 0.9);
          ctx.stroke();
        }
      }
      ctx.restore();
      glow(ctx, 960, 430, 520, P.clawdHi, 0.10 * conv + 0.10 * after * (1 - ease(25.4, 26.4, t)));
    }
  }

  /* =============================================================
     SCENE 6 — final : la constellation
     ============================================================= */
  // etincelle facon "spark" : 12 rayons alternes
  function sparkTargets(n, cx, cy, R) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var ray = i % 12;
      var ang = ray / 12 * 6.2832 - Math.PI / 2;
      var len = (ray % 2 === 0 ? 1 : 0.58) * R;
      var k = 0.12 + 0.88 * hash(i * 2.7);
      out.push([cx + Math.cos(ang) * len * k, cy + Math.sin(ang) * len * k, ang, k]);
    }
    return out;
  }
  function scene6(ctx, t) {
    var lt = t - 26.3;
    var app = ease(26.0, 27.0, t);
    var cx = 960, cy = 372, R = 268;
    var gather = ease(26.2, 28.4, t);
    var N = 168;
    var targets = sparkTargets(N, cx, cy, R);

    // rayons de l'etincelle
    var ra = ease(27.6, 29.0, t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var r = 0; r < 12; r++) {
      var ang = r / 12 * 6.2832 - Math.PI / 2 + Math.sin(lt * 0.2) * 0.02;
      var len = (r % 2 === 0 ? 1 : 0.58) * R * (0.9 + 0.1 * Math.sin(lt * 1.4 + r));
      var wd = (r % 2 === 0 ? 20 : 12) * ra;
      var g = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      g.addColorStop(0, rgba(P.clawdHi, 0.55 * ra));
      g.addColorStop(0.55, rgba(P.clawd, 0.26 * ra));
      g.addColorStop(1, rgba(P.clawd, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang + 1.5708) * wd, cy + Math.sin(ang + 1.5708) * wd);
      ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      ctx.lineTo(cx + Math.cos(ang - 1.5708) * wd, cy + Math.sin(ang - 1.5708) * wd);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    glow(ctx, cx, cy, 240 + 220 * ra, P.clawd, 0.10 + 0.18 * ra);

    // particules : tout ce qu'il a appris se rassemble
    for (var i = 0; i < N; i++) {
      var T = targets[i];
      var seed = hash(i * 1.13);
      var sx = 120 + hash(i * 3.7) * 1680;
      var sy = 180 + hash(i * 5.3) * 720;
      var d = 0.05 + seed * 0.45;
      var k = clamp((gather - d) / (1 - d), 0, 1);
      var e = smoother(k);
      var x = lerp(sx, T[0], e), y = lerp(sy, T[1], e);
      // petite orbite residuelle une fois arrive
      x += Math.cos(lt * 1.1 + i) * 3.5 * e;
      y += Math.sin(lt * 1.3 + i) * 3.5 * e;
      var col = i % 6 === 0 ? P.teal : (i % 5 === 0 ? P.gold : (i % 3 === 0 ? P.clawdHi : P.cream));
      var a = app * (0.25 + 0.7 * e);
      ctx.fillStyle = rgba(col, a);
      var rad = 1.3 + 2.1 * e;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
      if (e > 0.4) {
        ctx.strokeStyle = rgba(col, 0.10 * a);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke();
      }
    }

    // nappe de lumiere chaude sur le sol
    var fa = ease(27.4, 29.4, t);
    var lg = ctx.createLinearGradient(0, 640, 0, 1080);
    lg.addColorStop(0, rgba(P.clawd, 0.16 * fa));
    lg.addColorStop(0.5, rgba(P.clawd, 0.06 * fa));
    lg.addColorStop(1, rgba(P.clawd, 0));
    ctx.fillStyle = lg; ctx.fillRect(0, 640, W, 440);
  }

  global.SCENES = [
    { draw: scene1, end: 5.3 },
    { draw: scene2, end: 10.3 },
    { draw: scene3, end: 15.3 },
    { draw: scene4, end: 19.7 },
    { draw: scene5, end: 26.3 },
    { draw: scene6, end: 99 }
  ];
  global.SFX = { MONO: MONO, SANS: SANS, typed: typed, panel: panel, drawCode: drawCode, proj: proj };
})(window);
