/* =============================================================
   music.js — partition + synthese 100% code (Web Audio API)
   Aucun sample, aucun fichier audio : tout est genere par
   oscillateurs, bruit deterministe et une reverb a IR synthetique.
   Fonctionne a l'identique sur AudioContext (lecture) et
   OfflineAudioContext (rendu WAV).
   ============================================================= */
(function (global) {
  'use strict';

  var DURATION = 30.0;       // duree video
  var TAIL = 2.2;            // queue de reverb pour le rendu offline

  /* ---------- helpers ---------- */
  var NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function hz(name) {
    var m = /^([A-G]#?)(-?\d)$/.exec(name);
    var midi = NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  // PRNG deterministe : le bruit est identique en live et en offline
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
  }
  function noiseBuffer(ctx, dur, seed) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = b.getChannelData(c), r = rng(seed + c * 7919);
      for (var i = 0; i < len; i++) d[i] = r();
    }
    return b;
  }
  function impulse(ctx, dur, decay, seed) {
    var len = Math.floor(ctx.sampleRate * dur);
    var b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = b.getChannelData(c), r = rng(seed + c * 104729);
      for (var i = 0; i < len; i++) {
        var e = Math.pow(1 - i / len, decay);
        // petite pre-attenuation pour une queue plus douce
        d[i] = r() * e * (i < ctx.sampleRate * 0.006 ? i / (ctx.sampleRate * 0.006) : 1);
      }
    }
    return b;
  }

  /* ---------- bus ---------- */
  function makeBus(ctx) {
    var master = ctx.createGain();
    master.gain.value = 0.72;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value 
      = 26; comp.ratio.value = 3.2; comp.attack.value = 0.008; comp.release.value = 0.28;

    var dry = ctx.createGain(); dry.gain.value = 0.82;
    var wetSend = ctx.createGain(); wetSend.gain.value = 1.0;
    var wet = ctx.createGain(); wet.gain.value = 0.46;
    var conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, 3.0, 2.6, 20260924);
    var wetLP = ctx.createBiquadFilter(); wetLP.type = 'lowpass'; wetLP.frequency.value = 5200;

    // limiteur doux : une tanh normalisee, le signal ne peut plus depasser 0 dBFS
    var shaper = ctx.createWaveShaper();
    var n = 2048, curve = new Float32Array(n), k = 1.5, nk = Math.tanh(k);
    for (var ci = 0; ci < n; ci++) {
      var xx = (ci / (n - 1)) * 2 - 1;
      curve[ci] = Math.tanh(xx * k) / nk;
    }
    shaper.curve = curve; shaper.oversample = '4x';

    wetSend.connect(conv); conv.connect(wetLP); wetLP.connect(wet); wet.connect(comp);
    dry.connect(comp);
    comp.connect(shaper);
    shaper.connect(master);
    master.connect(ctx.destination);

    return { ctx: ctx, dry: dry, send: wetSend, master: master };
  }

  /* ---------- instruments ---------- */

  // piano : fondamentale sinus + partiels + petit clic de marteau
  function piano(bus, t, f, dur, vel, wet) {
    var ctx = bus.ctx;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel), t + 0.012);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vel * 0.22), t + Math.min(dur, 0.55));
    g.gain.exponentialRampToValueAtTime(0.00008, t + dur);

    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1500, t + dur);
    g.connect(lp);

    var parts = [[1, 1.0, 'sine'], [2, 0.30, 'sine'], [3, 0.11, 'triangle'], [4.02, 0.05, 'sine']];
    for (var i = 0; i < parts.length; i++) {
      var o = ctx.createOscillator(), og = ctx.createGain();
      o.type = parts[i][2];
      o.frequency.value = f * parts[i][0];
      o.detune.value = (i % 2 ? 4 : -3);
      og.gain.value = parts[i][1];
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    }
    // marteau
    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.05, (f * 1000) | 0);
    var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = Math.min(6000, f * 6); nf.Q.value = 1.1;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.16, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    n.connect(nf); nf.connect(ng); ng.connect(lp);
    n.start(t); n.stop(t + 0.06);

    lp.connect(bus.dry);
    var s = ctx.createGain(); s.gain.value = (wet === undefined ? 0.5 : wet);
    lp.connect(s); s.connect(bus.send);
  }

  // cordes : sawtooths desaccordes, attaque lente, vibrato doux
  function strings(bus, t, f, dur, vel, bright) {
    var ctx = bus.ctx;
    var g = ctx.createGain();
    var atk = Math.min(0.9, dur * 0.35), rel = Math.min(1.6, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + atk);
    g.gain.setValueAtTime(vel, t + Math.max(atk, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);

    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    var fc = (bright || 1) * (900 + f * 2.2);
    lp.frequency.setValueAtTime(fc * 0.55, t);
    lp.frequency.linearRampToValueAtTime(fc, t + atk * 1.4);
    lp.frequency.linearRampToValueAtTime(fc * 0.7, t + dur);

    var vib = ctx.createOscillator(); vib.frequency.value = 4.6 + (f % 7) * 0.12;
    var vibg = ctx.createGain(); vibg.gain.setValueAtTime(0, t);
    vibg.gain.linearRampToValueAtTime(5.5, t + atk * 1.8);
    vib.connect(vibg); vib.start(t); vib.stop(t + dur + 0.3);

    var det = [-7, 6, 0];
    for (var i = 0; i < det.length; i++) {
      var o = ctx.createOscillator(); o.type = (i === 2 ? 'triangle' : 'sawtooth');
      o.frequency.value = f; o.detune.value = det[i];
      var og = ctx.createGain(); og.gain.value = (i === 2 ? 0.5 : 0.36);
      vibg.connect(o.detune);
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur + 0.3);
    }
    g.connect(lp); lp.connect(bus.dry);
    var s = ctx.createGain(); s.gain.value = 0.85; lp.connect(s); s.connect(bus.send);
  }

  // basse sinus
  function sub(bus, t, f, dur, vel) {
    var ctx = bus.ctx;
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
    var g2 = ctx.createGain(); g2.gain.value = 0.12;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.25);
    g.gain.setValueAtTime(vel, t + Math.max(0.3, dur - 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus.dry);
    var s = ctx.createGain(); s.gain.value = 0.18; g.connect(s); s.connect(bus.send);
    o.start(t); o.stop(t + dur + 0.2); o2.start(t); o2.stop(t + dur + 0.2);
  }

  // taiko : sinus qui plonge + corps de bruit filtre
  function taiko(bus, t, vel, pitch) {
    var ctx = bus.ctx; pitch = pitch || 78;
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(pitch * 2.1, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.62, t + 0.19);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    o.connect(g); g.connect(bus.dry);
    var s = ctx.createGain(); s.gain.value = 0.55; g.connect(s); s.connect(bus.send);
    o.start(t); o.stop(t + 0.7);

    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.22, (t * 1000) | 0);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 220; bp.Q.value = 0.8;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.55, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    n.connect(bp); bp.connect(ng); ng.connect(bus.dry);
    var s2 = ctx.createGain(); s2.gain.value = 0.4; ng.connect(s2); s2.connect(bus.send);
    n.start(t); n.stop(t + 0.25);
  }

  // pluck cristallin (shimmer "data")
  function pluck(bus, t, f, vel) {
    var ctx = bus.ctx;
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    o.connect(g); g.connect(hp); hp.connect(bus.dry);
    var s = ctx.createGain(); s.gain.value = 1.1; hp.connect(s); s.connect(bus.send);
    o.start(t); o.stop(t + 0.45);
  }

  // cloche : marque les transitions de scene
  function bell(bus, t, f, vel) {
    var ctx = bus.ctx;
    var parts = [[1, 1], [2.76, 0.5], [5.4, 0.22]];
    for (var i = 0; i < parts.length; i++) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * parts[i][0];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * parts[i][1], t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / (i + 1));
      o.connect(g); g.connect(bus.dry);
      var s = ctx.createGain(); s.gain.value = 1.3; g.connect(s); s.connect(bus.send);
      o.start(t); o.stop(t + 1.8);
    }
  }

  // nappe de bruit : riser / cymbale
  function swell(bus, t, dur, vel, f0, f1) {
    var ctx = bus.ctx;
    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, dur + 0.3, 4242 + ((t * 100) | 0));
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass';
    hp.frequency.setValueAtTime(f0, t); hp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    n.connect(hp); hp.connect(g); g.connect(bus.dry);
    var s = ctx.createGain(); s.gain.value = 0.9; g.connect(s); s.connect(bus.send);
    n.start(t); n.stop(t + dur + 0.3);
  }

  function crash(bus, t, vel) {
    var ctx = bus.ctx;
    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 2.6, 777);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    var pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 6500; pk.gain.value = 5;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    n.connect(hp); hp.connect(pk); pk.connect(g); g.connect(bus.dry);
    var s = ctx.createGain(); s.gain.value = 1.0; g.connect(s); s.connect(bus.send);
    n.start(t); n.stop(t + 2.6);
  }

  /* ---------- partition ---------- */
  // Progression vi-IV-I-V (Am F C G) en do majeur, calee sur les scenes.
  var CHORDS = [
    { t: 0.00, d: 2.50, n: ['A3', 'C4', 'E4'], v: 0.045, b: 0.8, bass: 'A2' },
    { t: 2.50, d: 2.50, n: ['F3', 'A3', 'C4'], v: 0.050, b: 0.8, bass: 'F2' },
    { t: 5.00, d: 2.50, n: ['C4', 'E4', 'G4'], v: 0.058, b: 0.9, bass: 'C3' },
    { t: 7.50, d: 2.50, n: ['G3', 'B3', 'D4'], v: 0.058, b: 0.9, bass: 'G2' },
    { t: 10.00, d: 2.50, n: ['A3', 'C4', 'E4', 'A4'], v: 0.060, b: 1.0, bass: 'A2' },
    { t: 12.50, d: 2.50, n: ['F3', 'A3', 'C4', 'F4'], v: 0.062, b: 1.0, bass: 'F2' },
    { t: 15.00, d: 2.25, n: ['C4', 'E4', 'G4', 'C5'], v: 0.066, b: 1.1, bass: 'C3' },
    { t: 17.25, d: 2.25, n: ['G3', 'B3', 'D4', 'G4'], v: 0.068, b: 1.1, bass: 'G2' },
    { t: 19.50, d: 2.00, n: ['A2', 'A3', 'C4', 'E4', 'A4'], v: 0.070, b: 1.2, bass: 'A2' },
    { t: 21.50, d: 1.50, n: ['F2', 'F3', 'A3', 'C4', 'F4'], v: 0.074, b: 1.25, bass: 'F2' },
    { t: 23.00, d: 1.00, n: ['G2', 'G3', 'B3', 'D4', 'G4'], v: 0.078, b: 1.3, bass: 'G2' },
    { t: 24.00, d: 2.00, n: ['C3', 'C4', 'E4', 'G4', 'C5', 'E5'], v: 0.084, b: 1.35, bass: 'C2' },
    { t: 26.00, d: 2.00, n: ['F2', 'F3', 'A3', 'C4', 'F4'], v: 0.070, b: 1.0, bass: 'F2' },
    { t: 28.00, d: 3.40, n: ['C3', 'G3', 'C4', 'E4', 'G4'], v: 0.066, b: 0.85, bass: 'C2' }
  ];

  // melodie piano : [temps, note, duree, velocite]
  var MELODY = [
    // 1. debuts hesitants
    [0.70, 'E5', 1.30, 0.20], [2.05, 'G5', 1.10, 0.17], [3.30, 'A5', 1.40, 0.21], [4.40, 'G5', 0.70, 0.15],
    // 2. recherche
    [5.05, 'C6', 0.65, 0.24], [5.72, 'B5', 0.62, 0.20], [6.40, 'A5', 1.05, 0.26],
    [7.55, 'G5', 0.62, 0.21], [8.20, 'A5', 0.62, 0.23], [8.90, 'C6', 1.10, 0.26],
    // 3. code
    [10.05, 'E5', 0.62, 0.26], [10.05, 'E4', 0.62, 0.14], [10.72, 'A5', 0.62, 0.24],
    [11.40, 'C6', 0.62, 0.27], [12.08, 'B5', 0.62, 0.23], [12.75, 'A5', 0.70, 0.26],
    [13.50, 'G5', 0.62, 0.22], [14.20, 'E5', 0.80, 0.24],
    // 4. mondes 3D
    [15.05, 'C6', 0.62, 0.30], [15.05, 'C5', 0.62, 0.15], [15.72, 'E6', 0.62, 0.27],
    [16.40, 'D6', 0.68, 0.28], [17.10, 'C6', 0.62, 0.26], [17.80, 'A5', 0.62, 0.27],
    [18.50, 'B5', 0.62, 0.28], [19.15, 'C6', 0.45, 0.26],
    // 5. les problemes durs
    [19.55, 'A5', 0.68, 0.34], [19.55, 'A4', 0.68, 0.18], [20.25, 'C6', 0.62, 0.32],
    [20.95, 'E6', 0.68, 0.34], [21.65, 'D6', 0.62, 0.32], [22.30, 'C6', 0.62, 0.33],
    [23.00, 'B5', 0.45, 0.32], [23.45, 'C6', 0.28, 0.30], [23.72, 'D6', 0.28, 0.33],
    // climax
    [24.00, 'E6', 1.90, 0.40], [24.00, 'E5', 1.90, 0.22], [24.00, 'A4', 1.90, 0.16],
    [25.10, 'D6', 0.80, 0.30], [25.90, 'C6', 1.20, 0.34],
    // 6. final
    [26.40, 'A5', 0.80, 0.24], [27.20, 'G5', 0.80, 0.22], [28.00, 'E5', 1.40, 0.26],
    [28.00, 'C4', 1.60, 0.14], [29.10, 'C5', 1.60, 0.20], [29.10, 'G5', 1.60, 0.13]
  ];

  function chordAt(t) {
    for (var i = CHORDS.length - 1; i >= 0; i--) if (t >= CHORDS[i].t - 1e-6) return CHORDS[i];
    return CHORDS[0];
  }

  /* ---------- ordonnancement complet ---------- */
  function schedule(bus, t0) {
    var i, j, t;

    // nappes de cordes + basse
    for (i = 0; i < CHORDS.length; i++) {
      var c = CHORDS[i];
      for (j = 0; j < c.n.length; j++) {
        strings(bus, t0 + c.t, hz(c.n[j]), c.d + 0.45, c.v, c.b);
      }
      sub(bus, t0 + c.t, hz(c.bass), c.d + 0.2, (c.t >= 19.5 ? 0.13 : 0.075));
    }

    // piano
    for (i = 0; i < MELODY.length; i++) {
      var m = MELODY[i];
      piano(bus, t0 + m[0], hz(m[1]), m[2] + 0.8, m[3], 0.55);
    }

    // shimmer arpege : scenes 2 a 5 (les "donnees")
    for (t = 5.0; t < 24.0; t += 0.3125) {
      var ch = chordAt(t);
      var idx = Math.round((t - 5.0) / 0.3125);
      var note = ch.n[idx % ch.n.length];
      var oct = (idx % 4 === 0) ? 2 : 1;
      var amp = t < 10 ? 0.035 : (t < 19.5 ? 0.045 : 0.055);
      if (idx % 8 === 7) continue; // respiration
      pluck(bus, t0 + t, hz(note) * oct, amp);
    }

    // taiko : entre a 10 s, se densifie, explose a 24 s
    for (t = 10.0; t < 19.5; t += 2.5) {
      taiko(bus, t0 + t, 0.42, 74);
      taiko(bus, t0 + t + 0.75, 0.22, 88);
      taiko(bus, t0 + t + 1.50, 0.34, 74);
      taiko(bus, t0 + t + 2.00, 0.18, 96);
    }
    for (t = 19.5; t < 23.4; t += 0.5) {
      taiko(bus, t0 + t, 0.46, 72);
      taiko(bus, t0 + t + 0.25, 0.20, 92);
    }
    // roulement accelerant vers le climax
    var rt = 23.40, step = 0.115;
    while (rt < 23.99) { taiko(bus, t0 + rt, 0.22 + (rt - 23.4) * 0.5, 90); rt += step; step *= 0.9; }
    taiko(bus, t0 + 24.00, 0.95, 62);
    taiko(bus, t0 + 24.14, 0.42, 80);
    taiko(bus, t0 + 24.30, 0.55, 70);
    taiko(bus, t0 + 25.00, 0.30, 74);
    taiko(bus, t0 + 26.00, 0.22, 68);
    taiko(bus, t0 + 28.00, 0.16, 64);

    // cloches de transition
    var marks = [[5.0, 'C6', 0.10], [10.0, 'E6', 0.10], [15.0, 'G6', 0.11], [19.5, 'A6', 0.12], [26.0, 'C6', 0.09]];
    for (i = 0; i < marks.length; i++) bell(bus, t0 + marks[i][0], hz(marks[i][1]), marks[i][2]);

    // risers & cymbale
    swell(bus, t0 + 8.6, 1.4, 0.035, 500, 5200);
    swell(bus, t0 + 13.6, 1.4, 0.040, 500, 6000);
    swell(bus, t0 + 18.1, 1.4, 0.045, 600, 7000);
    swell(bus, t0 + 21.9, 2.05, 0.075, 500, 9000);
    crash(bus, t0 + 24.0, 0.13);
    crash(bus, t0 + 26.0, 0.05);

    // fondu final
    bus.master.gain.setValueAtTime(0.72, t0 + 28.9);
    bus.master.gain.linearRampToValueAtTime(0.0, t0 + DURATION + 1.6);
    return bus;
  }

  /* ---------- API ---------- */
  function playLive(ctx) {
    var bus = makeBus(ctx);
    var t0 = ctx.currentTime + 0.12;
    schedule(bus, t0);
    return t0;
  }

  function renderOffline(sampleRate) {
    var len = Math.ceil((DURATION + TAIL) * sampleRate);
    var octx = new OfflineAudioContext(2, len, sampleRate);
    var bus = makeBus(octx);
    schedule(bus, 0);
    return octx.startRendering();
  }

  function wavFromBuffer(buf) {
    var nch = buf.numberOfChannels, len = buf.length, rate = buf.sampleRate;
    var bytes = 44 + len * nch * 2;
    var ab = new ArrayBuffer(bytes), v = new DataView(ab), off = 0;
    function s(str) { for (var i = 0; i < str.length; i++) v.setUint8(off++, str.charCodeAt(i)); }
    function u32(x) { v.setUint32(off, x, true); off += 4; }
    function u16(x) { v.setUint16(off, x, true); off += 2; }
    s('RIFF'); u32(bytes - 8); s('WAVE'); s('fmt '); u32(16); u16(1); u16(nch);
    u32(rate); u32(rate * nch * 2); u16(nch * 2); u16(16); s('data'); u32(len * nch * 2);
    var chans = [];
    for (var c = 0; c < nch; c++) chans.push(buf.getChannelData(c));
    for (var i = 0; i < len; i++) {
      for (var c2 = 0; c2 < nch; c2++) {
        var x = Math.max(-1, Math.min(1, chans[c2][i]));
        v.setInt16(off, x < 0 ? x * 0x8000 : x * 0x7FFF, true); off += 2;
      }
    }
    return new Uint8Array(ab);
  }

  global.MUSIC = {
    DURATION: DURATION,
    playLive: playLive,
    renderOffline: renderOffline,
    wavFromBuffer: wavFromBuffer,
    hz: hz
  };
})(window);
