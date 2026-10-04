// OKUDESU - procedural audio
// All BGM / SFX are synthesized in the browser from note data (ported from the Unity
// project's Python generators: gen_bgm.py, generate_sfx_all.py). No .wav files needed.
// Gritty parts (naive square/saw waves, hard clipping) are replaced by band-limited or
// smooth equivalents; the game-over BGM uses a new soft sine-based voice.
'use strict';
window.OkudesuAudio = (() => {
  const SR = 44100;
  const TAU = Math.PI * 2;

  // ---------------- helpers ----------------
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const ALIAS = { Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B' };
  function freq(note) {
    if (!note) return 0;
    let n = note.slice(0, -1); const oct = +note.slice(-1);
    n = ALIAS[n] || n;
    return 440 * Math.pow(2, (NAMES.indexOf(n) + (oct + 1) * 12 - 69) / 12);
  }
  // PolyBLEP residual (removes aliasing from waveform discontinuities)
  function blep(t, dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1; }
    if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
    return 0;
  }
  function blSquare(ph, dt, duty) {
    let v = ph < duty ? 1 : -1;
    v += blep(ph, dt);
    v -= blep(((ph - duty) % 1 + 1) % 1, dt);
    return v;
  }
  function blSaw(ph, dt) { return 2 * ph - 1 - blep(ph, dt); }
  function tri(ph) { const p = ph % 1; return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; }

  // Feedback delay processed over two passes so the loop point has no seam
  function loopDelay(x, delaySec, feedback, mix) {
    const d = Math.floor(delaySec * SR);
    if (d <= 0) return x;
    const buf = new Float32Array(d);
    const out = new Float32Array(x.length);
    let p = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < x.length; i++) {
        const delayed = buf[p];
        buf[p] = x[i] + delayed * feedback;
        p = (p + 1) % d;
        if (pass === 1) out[i] = x[i] + delayed * mix;
      }
    }
    return out;
  }
  function normalize(x, peak) {
    let m = 0;
    for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
    if (m > 0) { const s = peak / m; for (let i = 0; i < x.length; i++) x[i] *= s; }
    return x;
  }
  function onePoleLP(x, cutoff) {
    const a = Math.exp(-TAU * cutoff / SR);
    // warm-up pass so the filter state at the loop start matches the end
    let y = 0;
    for (let i = 0; i < x.length; i++) y = (1 - a) * x[i] + a * y;
    for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; x[i] = y; }
    return x;
  }
  // Same LCG as the Python scripts (state starts at 0.5, float arithmetic)
  function makeNoise() {
    let s = 0.5;
    return () => { s = (s * 196314165 + 907633389) % 2147483647; return (s / 2147483647) * 2 - 1; };
  }

  // ---------------- BGM: "Neon Boulevard" (gen_bgm.py make_bgm_slow) ----------------
  function smoothEnv(t, dur, gate) {
    const att = 0.010, rel = 0.008, sus = 0.85;
    const gEnd = dur * gate;
    if (t >= gEnd + rel) return 0;
    if (t < att) return 0.5 * (1 - Math.cos(Math.PI * t / att));
    if (t < gEnd) {
      const dd = gEnd - att;
      return dd > 0 ? 1 - (1 - sus) * (t - att) / dd : sus;
    }
    return sus * 0.5 * (1 + Math.cos(Math.PI * (t - gEnd) / rel));
  }
  function bgmSlow() {
    const bpm = 92, bars = 16, beat = 60 / bpm;
    const seq = [];
    for (const [lo, hi] of [['A1', 'A2'], ['F1', 'F2'], ['C2', 'C3'], ['G1', 'G2']])
      for (let i = 0; i < 16; i++) seq.push([lo, 0.5], [hi, 0.5]);
    const total = bars * 4 * beat, n = Math.floor(total * SR);
    const out = new Float32Array(n);
    const vol = 0.14, gate = 0.35;
    let tAbs = 0, idx = 0, ph = 0;
    while (tAbs < total) {
      const [name, beats] = seq[idx % seq.length];
      const dur = beats * beat, ns = Math.floor(dur * SR), start = Math.floor(tAbs * SR);
      const f = freq(name), dt = f / SR;
      for (let j = 0; j < ns; j++) {
        const s = start + j; if (s >= n) break;
        const e = f > 0 ? smoothEnv(j / SR, dur, gate) : 0;
        out[s] += tri(ph) * e * vol;
        ph = (ph + dt) % 1;
      }
      tAbs += dur; idx++;
    }
    return normalize(loopDelay(out, beat * 0.75, 0.45, 0.4), 0.92);
  }

  // ---------------- BGM: game over (8-bit chiptune, band-limited = no grit) ----------------
  function bgmGameOver() {
    const bpm = 72, beat = 60 / bpm, total = 32 * beat, n = Math.floor(total * SR);
    const melody = [['D5', 2], ['C5', 1], ['Bb4', 1], ['A4', 2], ['G4', 1], ['F4', 1], ['E4', 1.5], ['F4', 0.5], ['G4', 1], ['A4', 1],
      ['D4', 3], [null, 1], ['F4', 1.5], ['E4', 0.5], ['D4', 1], ['C4', 1], ['Bb3', 2], ['A3', 2], ['G3', 1], ['A3', 1], ['Bb3', 1], ['C4', 1], ['D4', 3.5], [null, 0.5]];
    const bass = [['D2', 2], ['C2', 2], ['Bb1', 2], ['A1', 2], ['G1', 2], ['F1', 2], ['D1', 4], ['Bb1', 2], ['A1', 2], ['G1', 2], ['F1', 2], ['E1', 2], ['A1', 2], ['D1', 4]];
    const chord = [['D3', 2], ['C3', 2], ['Bb2', 2], ['A2', 2], ['G2', 2], ['F2', 2], ['D2', 4], ['Bb2', 2], ['A2', 2], ['G2', 2], ['F2', 2], ['E2', 2], ['A2', 2], ['D2', 4]];
    const out = new Float32Array(n);
    // classic chip ADSR (same as gen_gameover.py)
    function env(t, dur, a = 0.01, d = 0.08, s = 0.55, r = 0.15) {
      if (t < a) return t / a;
      if (t < a + d) return 1 - (1 - s) * (t - a) / d;
      if (t < dur - r) return s;
      if (t < dur) return s * (1 - (t - (dur - r)) / r);
      return 0;
    }
    function render(seq, wave, duty, vol) {
      let tAbs = 0, idx = 0, ph = 0;
      while (tAbs < total - 1e-9) {
        const [name, beats] = seq[idx % seq.length];
        const dur = beats * beat, ns = Math.floor(dur * SR), start = Math.floor(tAbs * SR);
        const f = freq(name), dt = f / SR;
        for (let j = 0; j < ns; j++) {
          const s = start + j; if (s >= n) break;
          if (f) out[s] += (wave === 'sq' ? blSquare(ph, dt, duty) : tri(ph)) * env(j / SR, dur) * vol;
          ph = (ph + dt) % 1;
        }
        tAbs += dur; idx++;
      }
    }
    render(melody, 'sq', 0.25, 0.20);  // lead: 25% pulse
    render(bass, 'tri', 0, 0.30);      // bass: NES-style triangle
    render(chord, 'sq', 0.5, 0.06);    // harmony: soft 50% square
    return normalize(onePoleLP(out, 7000), 0.37);
  }

  // ---------------- SFX (generate_sfx_all.py) ----------------
  function buf(dur) { return new Float32Array(Math.floor(dur * SR)); }
  const envDecay = (t, total, a = 0.003) => t < a ? t / a : Math.max(0, 1 - (t - a) / (total - a));

  function sfxMove() {
    const o = buf(0.08);
    for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] = Math.sin(TAU * 320 * t) * Math.exp(-t * 45) * 0.95; }
    return o;
  }
  function sfxRotate() {
    const dur = 0.10, o = buf(dur);
    for (let i = 0; i < o.length; i++) {
      const t = i / SR, f = 250 + 120 * (t / dur);
      o[i] = Math.sin(TAU * f * t) * envDecay(t, dur, 0.005) * 0.6;
    }
    return o;
  }
  function sfxSwap() {
    const freqs = [523, 659, 784], step = 0.07, o = buf(step * freqs.length + 0.03);
    freqs.forEach((f, k) => {
      const start = Math.floor(k * step * SR), len = Math.floor(0.08 * SR), dt = f / SR;
      for (let j = 0; j < len; j++) {
        const idx = start + j; if (idx >= o.length) break;
        const t = j / SR;
        o[idx] += blSquare((t * f) % 1, dt, 0.3) * envDecay(t, 0.08) * 0.35;
      }
    });
    return o;
  }
  function sfxClear(c) {
    const dur = 0.25 + c * 0.12, o = buf(dur);
    const fs = 200 + c * 150, fe = 1200 + c * 400;
    let phase = 0, arpPh = 0;
    for (let i = 0; i < o.length; i++) {
      const t = i / SR, pr = t / dur;
      let f = fs + (fe - fs) * pr;
      if (c >= 2) f = fs + (fe - fs) * (Math.floor(pr * 12) / 12);
      phase += TAU * f / SR;
      let w = (Math.sin(phase) + Math.sin(phase * 2) * 0.35) / 1.35;
      if (c >= 3) w = 0.4 * Math.tanh(w * 6) * Math.sin(phase * 1.5); // soft instead of hard sign()
      if (c >= 4) {
        const f1 = f, f2 = f * 1.1892, f3 = f * 1.4983, f4 = f * 1.8877;
        const a = (t * 24) % 4;
        const cf = a < 1 ? f1 : a < 2 ? f2 : a < 3 ? f3 : f4;
        const dt = cf / SR;
        arpPh = (arpPh + dt) % 1;
        const sawA = blSaw(arpPh, dt);
        const sqrA = 0.3 * blSquare(arpPh, dt, 0.5);
        const arp = (sawA * 0.4 + sqrA * 0.6) * 0.5;
        const pad = (Math.sin(TAU * f1 * t) + Math.sin(TAU * f2 * t) + Math.sin(TAU * f3 * t) + Math.sin(TAU * f4 * t)) * 0.15;
        const fm = Math.sin(TAU * 12 * t) * 0.15;
        const wfm = Math.sin(TAU * arpPh + fm) * 0.2;
        w = arp + pad + wfm;
      }
      o[i] = w * (1 - pr) * 0.95;
    }
    return o;
  }
  // Landing: based on the original (generate_lock_sfx), pitched lower and louder
  function sfxLock() {
    const dur = 0.24, o = buf(dur), noise = makeNoise();
    const rc = 1 / (TAU * 60), dt = 1 / SR, alpha = dt / (rc + dt);
    let last = 0, ph = 0;
    for (let i = 0; i < o.length; i++) {
      const t = i / SR;
      const f = 30 + 40 * Math.exp(-t * 22);            // original 85->40Hz, now 70->30Hz
      ph += TAU * f / SR;
      const sine = Math.sin(ph);
      const cf = 150 * Math.exp(-t * 160);
      const click = Math.sin(TAU * cf * t) * Math.exp(-t * 140) * 0.30;
      last = alpha * noise() + (1 - alpha) * last;
      const atk = last * Math.exp(-t * 90) * 0.15;
      const raw = sine * 0.82 + click * 0.15 + atk * 0.03;
      o[i] = Math.tanh(raw * Math.exp(-t * 11) * 4.0);  // strong soft-saturation: ~3x louder within the 0dB ceiling
    }
    const fl = Math.floor(0.02 * SR);
    for (let i = 0; i < fl; i++) o[o.length - 1 - i] *= i / fl;
    return normalize(o, 0.97);
  }
  // Fast-drop whoosh (generate_fall_sfx), now a one-shot with fade in/out instead of a loop
  function sfxFall() {
    const dur = 1.0, o = buf(dur), noise = makeNoise();
    const rc = 1 / (TAU * 120), dt = 1 / SR, alpha = dt / (rc + dt);
    let last = 0;
    for (let i = 0; i < o.length; i++) {
      const t = i / SR;
      const cutoff = 400 + 100 * Math.sin(t * TAU);
      last = alpha * noise() + (1 - alpha) * last;
      const whistle = Math.sin(TAU * cutoff * t) * 0.65;
      const env = Math.min(1, t / 0.03) * (t > 0.6 ? 0.5 * (1 + Math.cos(Math.PI * (t - 0.6) / 0.4)) : 1);
      o[i] = (last * 0.08 + whistle * 0.92) * 0.25 * env;
    }
    return o;
  }

  // name -> generator; ordered so the first-needed sounds are generated first
  const GENERATORS = {
    bgm_slow: bgmSlow,
    sfx_move: sfxMove, sfx_rotate: sfxRotate, sfx_lock: sfxLock, sfx_fall: sfxFall,
    sfx_clear_1: () => sfxClear(1), sfx_clear_2: () => sfxClear(2),
    sfx_clear_3: () => sfxClear(3), sfx_clear_4: () => sfxClear(4),
    sfx_swap: sfxSwap,
    bgm_gameover: bgmGameOver,
  };

  return { SR, GENERATORS };
})();
