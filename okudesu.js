// OKUDESU - HTML5 port of the Unity project (okudesu_unity)
// Coordinates follow Unity (left-handed, +z = away from camera); converted to three.js by flipping z.
'use strict';
(() => {

// ============================================================
// Constants / helpers
// ============================================================
const GW = 4, GH = 4, GD = 15;
const FOV = 43.2;
const TANH = Math.tan(FOV / 2 * Math.PI / 180);
// Unity lines whose width is scaled by distance/11 have constant pixel width: w * H / (22 * tan(fov/2))
const LINE_PX = 1 / (22 * TANH);
// Screen-height of world units at the HUD text distance (4)
const HUD_WORLD_H = 2 * 4 * TANH;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b));

function C(r, g, b, a = 1) { return { r, g, b, a }; }
const COL = {
  cyan: C(0, 1, 1), yellow: C(1, 0.92, 0.016), red: C(1, 0, 0), green: C(0, 1, 0),
  magenta: C(1, 0, 1), blue: C(0, 0, 1), white: C(1, 1, 1),
};
function css(c) {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
}
function hsv(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0: return C(v, t, p); case 1: return C(q, v, p); case 2: return C(p, v, t);
    case 3: return C(p, q, v); case 4: return C(t, p, v); default: return C(v, p, q);
  }
}
const toThree = c => new THREE.Color(c.r, c.g, c.b);
const V3 = (x, y, z) => new THREE.Vector3(x, y, -z); // Unity -> three

function lockedColorForZ(z) {
  let s = 0.95, v = 0.85, h = 0;
  switch (z) {
    case 14: h = 240; break; case 13: h = 180; break; case 12: h = 275; break;
    case 11: h = 120; v = 0.45; break; case 10: h = 90; v = 0.95; break;
    case 9: h = 315; break; case 8: h = 60; break; case 7: h = 30; break; case 6: h = 0; break;
    case 5: h = 150; v = 0.50; break; case 4: h = 205; break; case 3: h = 285; break;
    case 2: return hsv(0, 0, 0.95);
    case 1: return hsv(200 / 360, 0.45, 0.90);
    case 0: return hsv(40 / 360, 0.45, 0.90);
  }
  return hsv(h / 360, s, v);
}

// ============================================================
// Tetromino data (BlockSpawner)
// ============================================================
const SHAPES = [
  { name: 'I-Block', color: COL.cyan, rel: [[0, 0, -1], [0, 0, 0], [0, 0, 1], [0, 0, 2]] },
  { name: 'O-Block', color: COL.yellow, rel: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]] },
  { name: 'T-Block', color: COL.red, rel: [[0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, 0, 1]] },
  { name: 'J-Block', color: COL.green, rel: [[0, 0, -1], [0, 0, 0], [0, 0, 1], [-1, 0, -1]] },
  { name: 'Z-Block', color: COL.magenta, rel: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 1]] },
  { name: 'Corner-Block', color: COL.blue, rel: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]] },
  { name: 'Hook3D-A-Block', color: C(0.4, 0.8, 1.0), rel: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 1]] },
];
function isShapeAvailable(i, lines) {
  const n = SHAPES[i].name;
  if (n === 'Corner-Block') return lines >= 20;
  if (n === 'Hook3D-A-Block') return false;
  return true;
}
function randomShape(lines) {
  const a = [];
  for (let i = 0; i < SHAPES.length; i++) if (isShapeAvailable(i, lines)) a.push(i);
  return a.length ? a[randInt(0, a.length)] : 0;
}

// ============================================================
// Wireframe font (WireframeTextRenderer)
// ============================================================
const FONT_LINES = [
  "A 30507050 301030804090609070807010",
  "B 301060107020 308560857075 70606050 704060503050 30853010 70207040 70607075",
  "C 658080658060 804080356520 3520203520653580 35806580 35206520",
  "D 3090301050107535757050903090",
  "E 309030107010 30907090 30536553",
  "F 30903005 30907590 30556055",
  "G 20352065358065808065 203535206520803580455045",
  "H 20902010 20508050 80908010",
  "I 50905010 45105510 45905590",
  "J 709070255510351020252035",
  "K 25102590 25457090 35558010",
  "L 309030157515",
  "M 20202080505080808020",
  "N 2020208080208080",
  "O 358065808065803565203520203520653580",
  "P 3510359065907580756565553555",
  "Q 358055807065703555203520203520653580 3145454570208020",
  "R 3015308560857075706060503050 40507515",
  "S 257525654050605075357525 7525651535152525 7575658535852575 25252530 75757570",
  "T 20858085 50855015",
  "U 257525303520652075307575",
  "V 20702050502080508070",
  "W 2075203535205035652080358075 50355045",
  "X 2585257575257515 2515252575757585",
  "Y 218550558085 50555015",
  "Z 2080808020208020",
  "0 25257575 358565857575752565153515252525753585",
  "1 30157015 52155285 52803580",
  "2 70153015 3015302070607074608545853070",
  "3 55506050 6050706070756085 6050704070256015 601545153030 30303035 6085458530703065",
  "4 55855515 5585205020407540",
  "5 708530853060606070497125601540153025 30253030",
  "6 70746085408530753025401560157025704060503050 70707074",
  "7 25752585758575603015",
  "8 40503040302540156015702570406050 405060507060707560854085307530604050",
  "9 40856085707570404515 40853075306040507050",
  "[ 659039904010 40106510",
  "] 3590609060103510",
  ": 49714969516951714971 49314929512951314931",
  ". 49184916511651184918",
  "! 50905030 49164914511451164916",
  "+ 25557555 50805030",
  "- 25557555",
  ", 5116491649185118 511851154913",
  ") 4090607060304010",
  "( 6090407040306010",
];
const FONT = {};
(function parseFont() {
  const eq = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
  for (let line of FONT_LINES) {
    line = line.trim();
    const key = line[0];
    const tokens = line.substring(1).trim().split(/\s+/);
    const strokes = [];
    let minX = Infinity, maxX = -Infinity;
    for (const tk of tokens) {
      if (tk.length < 4 || tk.length % 4 !== 0) continue;
      const pts = [];
      for (let i = 0; i < tk.length / 4; i++) {
        const x = parseInt(tk.substr(i * 4, 2), 10), y = parseInt(tk.substr(i * 4 + 2, 2), 10);
        pts.push([x, y]);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      }
      strokes.push(pts);
    }
    if (!strokes.length) continue;
    // merge strokes that share endpoints (nicer joins)
    const pending = strokes.map(s => s.slice());
    const merged = [];
    while (pending.length) {
      let cur = pending.shift();
      let did = true;
      while (did) {
        did = false;
        for (let i = 0; i < pending.length; i++) {
          const o = pending[i];
          if (eq(cur[cur.length - 1], o[0])) { cur = cur.concat(o.slice(1)); }
          else if (eq(cur[cur.length - 1], o[o.length - 1])) { cur = cur.concat(o.slice(0, -1).reverse()); }
          else if (eq(cur[0], o[o.length - 1])) { cur = o.concat(cur.slice(1)); }
          else if (eq(cur[0], o[0])) { cur = o.slice().reverse().concat(cur.slice(1)); }
          else continue;
          pending.splice(i, 1); did = true; break;
        }
      }
      merged.push(cur);
    }
    let width = maxX - minX;
    if (width <= 0) width = 30;
    FONT[key] = { strokes: merged, minX, width };
  }
})();
const SPACE_W = 35, CHAR_SPACING = 0.18;

function unscaledWidth(text) {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const g = c === ' ' ? null : FONT[c.toUpperCase()];
    w += g ? g.width : SPACE_W;
    if (i < text.length - 1) w += CHAR_SPACING * 100;
  }
  return w;
}

// A screen-aligned wireframe text object (alignToScreen = true in Unity)
class WireText {
  constructor(o) {
    Object.assign(this, {
      text: '', pos: [0.5, 0.5], widthRatio: 0.5, lineWidth: 0.03, color: COL.green,
      autoCenter: true, float: true, active: true,
    }, o);
  }
  draw(ctx, W, H, time, floatEnabled) {
    if (!this.active || !this.text) return;
    const uw = unscaledWidth(this.text);
    if (uw <= 0) return;
    const s = Math.min(this.widthRatio * TW, W * 0.92) / uw;   // pixels per font unit (TW: text width basis, larger in portrait); never wider than the screen
    const spacing = CHAR_SPACING * 100 * s;
    let ax = this.pos[0] * W, ay = this.pos[1] * H, sx = 1;
    if (this.float && floatEnabled) {
      ay -= Math.sin(time * 2.0) * 0.08 / HUD_WORLD_H * H;
      sx = Math.cos(Math.sin(time * 1.5) * 5.0 * Math.PI / 180);
    }
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(sx, 1);
    ctx.strokeStyle = css(this.color);
    // letters scale with the width, so on tall (portrait) screens the line must not keep growing with the height
    ctx.lineWidth = Math.max(0.75, this.lineWidth * LINE_PX * Math.min(H, TW * 0.75));
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    let x = this.autoCenter ? -(uw * s) / 2 : 0;
    ctx.beginPath();
    for (let i = 0; i < this.text.length; i++) {
      const c = this.text[i];
      const g = c === ' ' ? null : FONT[c.toUpperCase()];
      if (g) {
        for (const st of g.strokes) {
          if (st.length < 2) continue;
          for (let p = 0; p < st.length; p++) {
            const px = x + (st[p][0] - g.minX) * s, py = -(st[p][1] - 50) * s;
            if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        }
        x += g.width * s + spacing;
      } else {
        x += SPACE_W * s + spacing;
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// Audio (CyberSynthManager)
// ============================================================
// All clips are synthesized in-browser (okudesu_audio.js); no audio files are loaded.
class SoundSystem {
  constructor() { this.mode = null; this.buffers = {}; this.muted = false; }
  init() {
    if (this.mode) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !window.OkudesuAudio) { this.mode = 'none'; return; }
    this.mode = 'wa';
    this.ctx = new AC();
    this.out = this.ctx.createGain();
    this.out.connect(this.ctx.destination);
    // generate one clip per task so the first frames aren't blocked
    const { SR, GENERATORS } = window.OkudesuAudio;
    const names = Object.keys(GENERATORS);
    const next = () => {
      const n = names.shift(); if (!n) return;
      const data = GENERATORS[n]();
      const b = this.ctx.createBuffer(1, data.length, SR);
      b.getChannelData(0).set(data);
      this.buffers[n] = b;
      setTimeout(next, 0);
    };
    next();
  }
  oneShot(name, vol) {
    if (this.muted || this.mode !== 'wa') return;
    const b = this.buffers[name]; if (!b) return;
    const src = this.ctx.createBufferSource(); src.buffer = b;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.out); src.start();
  }
}

class LoopPlayer {
  constructor(snd) { this.snd = snd; this.playing = false; this.started = false; this.vol = 0; this.rate = 1; }
  play(clip) { this.stop(); this.clip = clip; this.playing = true; }
  stop() {
    this.playing = false; this.started = false;
    if (this.node) { try { this.node.stop(); } catch (e) {} this.node.disconnect(); this.node = null; }
  }
  update() {
    if (!this.playing) return;
    const s = this.snd;
    if (!this.started) {
      if (s.mode === 'wa') {
        const b = s.buffers[this.clip]; if (!b) return;
        this.gain = s.ctx.createGain(); this.gain.connect(s.out);
        this.node = s.ctx.createBufferSource(); this.node.buffer = b; this.node.loop = true;
        this.node.connect(this.gain); this.node.start();
      } else return;
      this.started = true;
    }
    const v = s.muted ? 0 : this.vol;
    if (this.node) { this.gain.gain.value = v; this.node.playbackRate.value = this.rate; }
  }
}

const Synth = {
  snd: new SoundSystem(),
  master: 1.0,
  level: 1,
  isPlayingBGM: false,
  isFastDropping: false,
  fade: null,
  init() { this.bgm = new LoopPlayer(this.snd); },
  unlock() { this.snd.init(); this.playBGM(); },
  setMute(m) { this.snd.muted = m; },
  playBGM() { this.isPlayingBGM = true; this.updateBGMClip(true); },
  updateBGMClip(force) {
    const step = Math.min(7, this.level);
    this.fade = null;
    this.bgm.vol = this.master * 0.85;
    this.bgm.rate = 1.0 + (step - 1) * 0.05;
    if (force || this.bgm.clip !== 'bgm_slow' || !this.bgm.playing) {
      if (this.isPlayingBGM) this.bgm.play('bgm_slow');
    }
  },
  setLevel(l) { this.level = l; if (this.isPlayingBGM) { this.bgm.rate = 1.0 + (Math.min(7, l) - 1) * 0.05; } },
  pauseBGM() { this.fade = { from: this.bgm.vol, to: 0, dur: 0.15, t: 0 }; this.isPlayingBGM = false; },
  resumeBGM() { this.bgm.vol = 0; this.fade = { from: 0, to: this.master * 0.85, dur: 0.25, t: 0 }; this.isPlayingBGM = true; },
  stopBGM() { this.bgm.stop(); this.isPlayingBGM = false; },
  playGameOverBGM() {
    this.fade = null;
    this.bgm.play('bgm_gameover'); this.bgm.vol = this.master * 0.25; this.bgm.rate = 1.0;
    this.isPlayingBGM = false;
  },
  clear(n) { this.snd.oneShot(n >= 4 ? 'sfx_clear_4' : n === 3 ? 'sfx_clear_3' : n === 2 ? 'sfx_clear_2' : 'sfx_clear_1', this.master); },
  lock() { this.snd.oneShot('sfx_lock', this.master * 1.0); },
  move() { this.snd.oneShot('sfx_move', this.master * 0.3); },
  rotate() { this.snd.oneShot('sfx_rotate', this.master * 0.3); },
  setFastDropping(b) {
    // one-shot whoosh when fast drop starts (no loop)
    if (b && !this.isFastDropping && this.isPlayingBGM) this.snd.oneShot('sfx_fall', this.master * 0.45);
    this.isFastDropping = b;
  },
  update(dt) {
    if (this.fade) {
      this.fade.t += dt;
      this.bgm.vol = lerp(this.fade.from, this.fade.to, clamp01(this.fade.t / this.fade.dur));
      if (this.fade.t >= this.fade.dur) this.fade = null;
    }
    this.bgm.update();
  },
};
Synth.init();

// ============================================================
// Input (keyboard / gamepad / pointer)
// ============================================================
const Input = {
  held: new Set(), down: new Set(), up: new Set(),
  padPrev: [], pad: null,
  pointerDowns: [],          // {x, y, type, id}
  touches: new Map(),        // id -> {x, y, sx, sy, t0, flicked}  (touch pointers currently held)
  flicks: [],                // {sx, sy, dx, dy}  flick gestures recognized this frame
  touchEnds: [],             // {sx, sy, flicked}  touches released this frame
  FLICK_DIST: 30, FLICK_TIME: 300,   // px, ms
  init(el) {
    const keyName = e => (e.key === '+' ? 'Plus' : e.code);
    window.addEventListener('keydown', e => {
      if (AppNav.handleKey(e)) return;
      if (ScoreUI.handleKey(e)) return;
      if (Menu.captureKey(e)) return;
      Synth.snd.init();
      const k = keyName(e);
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.held.has(k)) this.down.add(k);
      this.held.add(k);
      if (e.code === 'NumpadAdd' && k !== 'NumpadAdd') { this.down.add('NumpadAdd'); this.held.add('NumpadAdd'); }
    });
    window.addEventListener('keyup', e => {
      if (AppNav.open || ScoreUI.open) return;
      const k = keyName(e);
      this.held.delete(k); this.up.add(k);
      this.held.delete(e.code); this.up.add(e.code);
    });
    window.addEventListener('blur', () => this.held.clear());
    el.addEventListener('pointerdown', e => {
      Synth.snd.init();
      el.focus();
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      this.pointerDowns.push({ x: e.clientX, y: e.clientY, type: e.pointerType, id: e.pointerId });
      if (e.pointerType === 'touch') {
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), flicked: false });
      }
      CameraCtl.pointerDown(e);
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      const t = this.touches.get(e.pointerId);
      if (t) {
        t.x = e.clientX; t.y = e.clientY;
        const dx = t.x - t.sx, dy = t.y - t.sy;
        // touches that start in the centre (camera drag zone) never become flicks
        if (!t.flicked && Game.flickEnabled() && !Game.isInDragZone(t.sx, t.sy) &&
            performance.now() - t.t0 <= this.FLICK_TIME && Math.hypot(dx, dy) >= this.FLICK_DIST) {
          t.flicked = true;
          this.flicks.push({ sx: t.sx, sy: t.sy, dx, dy });
          CameraCtl.cancelDrag(e.pointerId);   // a flick must not orbit the camera
          return;
        }
      }
      CameraCtl.pointerMove(e);
    });
    const end = e => {
      const t = this.touches.get(e.pointerId);
      if (t) this.touchEnds.push({ sx: t.sx, sy: t.sy, flicked: t.flicked });
      this.touches.delete(e.pointerId);
      CameraCtl.pointerUp(e);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', e => e.preventDefault());
  },
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    if (this.pad) {
      const b = this.pad.buttons;
      for (let i = 0; i < b.length; i++) {
        const pr = b[i].pressed, k = 'J' + i;
        if (pr) { if (!this.padPrev[i]) { this.down.add(k); Synth.snd.init(); } this.held.add(k); }
        else if (this.padPrev[i]) { this.held.delete(k); this.up.add(k); }
        this.padPrev[i] = pr;
      }
    }
  },
  endFrame() { this.down.clear(); this.up.clear(); this.pointerDowns.length = 0; this.flicks.length = 0; this.touchEnds.length = 0; },
  kd(...ks) { return ks.some(k => this.down.has(k)); },
  kh(...ks) { return ks.some(k => this.held.has(k)); },
  ku(...ks) { return ks.some(k => this.up.has(k)); },
  axis(i) { return this.pad && this.pad.axes.length > i ? this.pad.axes[i] : 0; },
  btnVal(i) { return this.pad && this.pad.buttons[i] ? this.pad.buttons[i].value : 0; },
  btn(i) { return this.pad && this.pad.buttons[i] ? this.pad.buttons[i].pressed : false; },
  horizontal() {
    let k = (this.kh('KeyD', 'ArrowRight') ? 1 : 0) - (this.kh('KeyA', 'ArrowLeft') ? 1 : 0);
    const s = this.axis(0);
    return Math.abs(s) > Math.abs(k) ? s : k;
  },
  vertical() {
    let k = (this.kh('KeyW', 'ArrowUp') ? 1 : 0) - (this.kh('KeyS', 'ArrowDown') ? 1 : 0);
    const s = -this.axis(1);
    return Math.abs(s) > Math.abs(k) ? s : k;
  },
  dpadX() { return (this.btn(15) ? 1 : 0) - (this.btn(14) ? 1 : 0); },
  dpadY() { return (this.btn(12) ? 1 : 0) - (this.btn(13) ? 1 : 0); },
};

// ============================================================
// Controls: rebindable keyboard (2 slots) / gamepad (1 button) per action
// ============================================================
const ACTIONS = [
  ['moveLeft', 'MOVE LEFT'], ['moveRight', 'MOVE RIGHT'], ['moveUp', 'MOVE UP'], ['moveDown', 'MOVE DOWN'],
  ['pitchUp', 'PITCH UP'], ['pitchDown', 'PITCH DOWN'], ['yawLeft', 'YAW LEFT'], ['yawRight', 'YAW RIGHT'],
  ['rollLeft', 'ROLL LEFT'], ['rollRight', 'ROLL RIGHT'], ['fastFall', 'FAST FALL'], ['hardDrop', 'HARD DROP'],
  ['swap', 'SWAP NEXT'], ['pause', 'PAUSE'],
];
const DEFAULT_KEYS = {
  moveLeft: ['KeyA', 'ArrowLeft'], moveRight: ['KeyD', 'ArrowRight'], moveUp: ['KeyW', 'ArrowUp'], moveDown: ['KeyS', 'ArrowDown'],
  pitchUp: ['KeyI', 'Numpad8'], pitchDown: ['KeyK', 'Numpad2'], yawLeft: ['KeyJ', 'Numpad4'], yawRight: ['KeyL', 'Numpad6'],
  rollLeft: ['KeyU', 'Numpad7'], rollRight: ['KeyO', 'Numpad9'], fastFall: ['Space', 'Numpad3'], hardDrop: ['ShiftLeft', 'Enter'],
  swap: ['Tab', 'KeyC'], pause: ['Escape', null],
};
// W3C standard gamepad indices: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 BACK, 9 START, 12-15 D-pad
const DEFAULT_PAD = {
  moveLeft: 14, moveRight: 15, moveUp: 12, moveDown: 13, pitchUp: 3, pitchDown: 0, yawLeft: 2, yawRight: 1,
  rollLeft: 4, rollRight: 5, fastFall: 7, hardDrop: null, swap: 6, pause: 9,
};
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'LS', 'RS', 'UP', 'DOWN', 'LEFT', 'RIGHT'];
const KEYS_STORE = 'OKUDESU_Keys', PAD_STORE = 'OKUDESU_Pad';
const Controls = {
  keys: {}, pad: {},
  load() {
    this.resetKeys(); this.resetPad();
    try {
      const k = JSON.parse(localStorage.getItem(KEYS_STORE) || 'null');
      if (k) for (const a in DEFAULT_KEYS) if (Array.isArray(k[a])) this.keys[a] = [k[a][0] || null, k[a][1] || null];
      const p = JSON.parse(localStorage.getItem(PAD_STORE) || 'null');
      if (p) for (const a in DEFAULT_PAD) if (a in p) this.pad[a] = typeof p[a] === 'number' ? p[a] : null;
    } catch (e) {}
  },
  save() {
    try { localStorage.setItem(KEYS_STORE, JSON.stringify(this.keys)); localStorage.setItem(PAD_STORE, JSON.stringify(this.pad)); } catch (e) {}
  },
  resetKeys() { for (const a in DEFAULT_KEYS) this.keys[a] = DEFAULT_KEYS[a].slice(); },
  resetPad() { Object.assign(this.pad, DEFAULT_PAD); },
  bindKey(action, slot, code) {
    for (const a in this.keys) this.keys[a] = this.keys[a].map(c => (c === code ? null : c));  // no duplicates
    this.keys[action][slot] = code;
    this.save();
  },
  bindPad(action, idx) {
    for (const a in this.pad) if (this.pad[a] === idx) this.pad[a] = null;
    this.pad[action] = idx;
    this.save();
  },
  down(a) {
    const p = this.pad[a];
    return Input.kd(...this.keys[a].filter(Boolean)) || (p != null && Input.kd('J' + p));
  },
  held(a) {
    const p = this.pad[a];
    return Input.kh(...this.keys[a].filter(Boolean)) || (p != null && Input.btnVal(p) > 0.3);
  },
  keyLabel(code) {
    if (!code) return '-';
    const M = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN', Escape: 'ESC', Space: 'SPACE',
      ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'LCTRL', ControlRight: 'RCTRL', AltLeft: 'LALT', AltRight: 'RALT',
      Enter: 'ENTER', NumpadEnter: 'NUMENTER', Tab: 'TAB', Backspace: 'BKSP', Comma: ',', Period: '.', Minus: '-', Plus: '+' };
    if (M[code]) return M[code];
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM').toUpperCase();
  },
  padLabel(i) { return i == null ? '-' : (PAD_NAMES[i] || 'B' + i); },
  // human-readable summary of an action for help / controls panel
  keysText(a) { return this.keys[a].filter(Boolean).map(c => this.keyLabel(c)).join(' / ') || '-'; },
};
Controls.load();

// ============================================================
// three.js setup
// ============================================================
const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const hud = hudCanvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight, DPR = Math.min(window.devicePixelRatio || 1, 2);
// text width basis: letters are sized from this; on tall portrait screens they get up to 1.6x larger
let TW = W;
const textBasis = () => W * (H > W ? Math.min(1.6, Math.max(1, (H / W) * 0.75)) : 1);

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
renderer.setClearColor(new THREE.Color(0.02, 0.03, 0.07), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.3, 1000);
scene.add(camera);

// Lighting (Directional light Euler(45,-40,10), intensity 1.05) + ambient
const dirLight = new THREE.DirectionalLight(new THREE.Color(0.96, 0.98, 1.0), 1.05);
dirLight.position.copy(V3(0.4545, 0.7071, -0.5417).multiplyScalar(10));
scene.add(dirLight);
scene.add(new THREE.HemisphereLight(0x9aa8c4, 0x2a2a30, 0.55));

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cubeEdgeGeo = (() => {
  const v = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) v.push([x, y, z]);
  const pos = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    let diff = 0;
    for (let k = 0; k < 3; k++) if (v[i][k] !== v[j][k]) diff++;
    if (diff === 1) pos.push(...v[i], ...v[j]);
  }
  const g = new THREE.LineSegmentsGeometry(); g.setPositions(pos); return g;
})();

const lineMats = new Map();
function lineMat(color, opacity, worldWidth) {
  const key = `${color.r},${color.g},${color.b},${opacity},${worldWidth}`;
  let m = lineMats.get(key);
  if (!m) {
    m = new THREE.LineMaterial({ color: toThree(color), linewidth: 1, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    m.userData.w = worldWidth;
    updateLineMat(m);
    lineMats.set(key, m);
  }
  return m;
}
function updateLineMat(m) { m.resolution.set(W, H); m.linewidth = Math.max(1, m.userData.w * LINE_PX * H); }

// Field boundary (green frame)
(function createBoundary() {
  const x0 = -0.5, x1 = GW - 0.5, y0 = -0.5, y1 = GH - 0.5, z0 = -0.5, z1 = GD - 0.5;
  const segs = [];
  const P = (x, y, z) => [x, y, -z];
  for (const z of [z0, z1]) {
    const c = [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
    for (let i = 0; i < 4; i++) segs.push(...c[i], ...c[(i + 1) % 4]);
  }
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) segs.push(...P(x, y, z0), ...P(x, y, z1));
  const g = new THREE.LineSegmentsGeometry(); g.setPositions(segs);
  scene.add(new THREE.LineSegments2(g, lineMat(C(0, 0.95, 0.15), 1, 0.057)));
})();

// ============================================================
// Block units (BlockUnit)
// ============================================================
const animUnits = new Set();
class Unit {
  constructor(color, { ghost = false, wireWidth = 0.05, parent = scene } = {}) {
    this.color = color; this.orig = color; this.ghost = ghost; this.locked = false;
    this.group = new THREE.Group();
    if (!ghost) {
      this.mat = new THREE.MeshStandardMaterial({ color: toThree(color), roughness: 0.4, metalness: 0.0 });
      this.mat.emissive = toThree(color).multiplyScalar(0.15);
      this.mesh = new THREE.Mesh(boxGeo, this.mat);
      this.mesh.visible = false;
      this.group.add(this.mesh);
    }
    this.wire = new THREE.LineSegments2(cubeEdgeGeo, lineMat(color, ghost ? 0.35 : 1, ghost ? 0.06 : wireWidth));
    this.wire.renderOrder = ghost ? 2 : 1;
    this.group.add(this.wire);
    this.gp = { x: 0, y: 0, z: 0 };
    parent.add(this.group);
  }
  setPos(x, y, z) { this.gp = { x, y, z }; this.group.position.copy(V3(x, y, z)); }
  setMatColor(c, e) { this.mat.color.setRGB(c.r, c.g, c.b); this.mat.emissive.setRGB(e.r, e.g, e.b); }
  lock() {
    this.locked = true;
    this.mesh.visible = true; this.wire.visible = false;
    this.updateLockedColor();
    this.flash = 0; animUnits.add(this);
  }
  updateLockedColor() {
    const c = lockedColorForZ(clamp(Math.round(this.gp.z), 0, 14));
    this.orig = c;
    this.setMatColor(c, C(c.r * 0.12, c.g * 0.12, c.b * 0.12));
  }
  explode() {
    this.flash = undefined;
    this.exploding = 0;
    this.spin = new THREE.Vector3(rand(-250, 250), rand(-250, 250), rand(-250, 250)).multiplyScalar(Math.PI / 180);
    animUnits.add(this);
  }
  animate(dt) {
    const o = this.orig;
    if (this.exploding !== undefined) {
      this.exploding += dt;
      const t = clamp01(this.exploding / 0.35);
      this.group.rotation.x += this.spin.x * dt; this.group.rotation.y += this.spin.y * dt; this.group.rotation.z += this.spin.z * dt;
      this.group.scale.setScalar(1 - t);
      const c = C(lerp(o.r, 1, t), lerp(o.g, 1, t), lerp(o.b, 1, t));
      this.setMatColor(c, C(lerp(o.r * 0.15, 2.5, t), lerp(o.g * 0.15, 2.5, t), lerp(o.b * 0.15, 2.5, t)));
      if (this.exploding >= 0.35) { this.destroy(); }
      return;
    }
    if (this.flash !== undefined) {
      this.flash += dt;
      const t = clamp01(this.flash / 0.25);
      this.setMatColor(C(lerp(0.9, o.r, t), lerp(0.9, o.g, t), lerp(0.9, o.b, t)),
        C(lerp(0.6, o.r * 0.15, t), lerp(0.6, o.g * 0.15, t), lerp(0.6, o.b * 0.15, t)));
      if (this.flash >= 0.25) { this.flash = undefined; animUnits.delete(this); }
    }
  }
  destroy() {
    animUnits.delete(this);
    if (this.group.parent) this.group.parent.remove(this.group);
    if (this.mat) this.mat.dispose();
    this.dead = true;
  }
}

// ============================================================
// Particles (ParticleEmitter / ShardBehavior)
// ============================================================
const shards = [];
function emitParticles(p, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: toThree(color) });
    const m = new THREE.Mesh(boxGeo, mat);
    const size = rand(0.12, 0.22);
    m.scale.setScalar(size);
    scene.add(m);
    shards.push({
      m, mat, size, p: { ...p },
      v: { x: rand(-4.5, 4.5), y: rand(-4.5, 4.5), z: rand(-3, 5) },
      r: new THREE.Vector3(rand(-300, 300), rand(-300, 300), rand(-300, 300)).multiplyScalar(Math.PI / 180),
      life: 0, max: rand(0.6, 1.0),
    });
    m.position.copy(V3(p.x, p.y, p.z));
  }
}
function updateShards(dt) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.life += dt;
    if (s.life >= s.max) { scene.remove(s.m); s.mat.dispose(); shards.splice(i, 1); continue; }
    s.p.x += s.v.x * dt; s.p.y += s.v.y * dt; s.p.z += s.v.z * dt;
    s.v.y += -9.81 * 0.6 * dt;
    s.m.position.copy(V3(s.p.x, s.p.y, s.p.z));
    s.m.rotation.x += s.r.x * dt; s.m.rotation.y += s.r.y * dt; s.m.rotation.z += s.r.z * dt;
    s.m.scale.setScalar(s.size * (1 - s.life / s.max));
  }
}

// ============================================================
// Grid (GridManager)
// ============================================================
const Grid = {
  cells: new Array(GW * GH * GD).fill(null),
  timers: [],
  idx(x, y, z) { return x + GW * (y + GH * z); },
  inside(p) { return p.x >= 0 && p.x < GW && p.y >= 0 && p.y < GH && p.z >= 0 && p.z < GD; },
  has(p) { return this.inside(p) && this.cells[this.idx(p.x, p.y, p.z)] !== null; },
  valid(ps) { return ps.every(p => this.inside(p) && !this.cells[this.idx(p.x, p.y, p.z)]); },
  register(units) {
    for (const u of units) {
      const p = u.gp;
      if (this.inside(p)) { this.cells[this.idx(p.x, p.y, p.z)] = u; u.lock(); }
      else u.destroy();
    }
  },
  planeFull(z) {
    for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) if (!this.cells[this.idx(x, y, z)]) return false;
    return true;
  },
  isEmpty() { return this.cells.every(c => !c); },
  processLineClear(done) {
    const full = [];
    for (let z = GD - 1; z >= 0; z--) if (this.planeFull(z)) full.push(z);
    if (!full.length) { done(full); return; }
    if (full.length === 3) CameraCtl.shake(0.08, 0.22);
    else if (full.length >= 4) CameraCtl.shake(0.24, 0.45);
    Synth.clear(full.length);
    for (const z of full) for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) {
      const i = this.idx(x, y, z), u = this.cells[i];
      if (u) {
        const col = u.color;
        u.explode();
        emitParticles(u.gp, col, 6);
        this.cells[i] = null;
      }
    }
    Sched.add(0.35, () => {
      const cleared = new Set(full);
      const next = new Array(GW * GH * GD).fill(null);
      let nz = GD - 1;
      for (let oz = GD - 1; oz >= 0; oz--) {
        if (cleared.has(oz)) continue;
        for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) {
          const u = this.cells[this.idx(x, y, oz)];
          next[this.idx(x, y, nz)] = u;
          if (u) {
            if (nz > oz) u.setPos(x, y, nz);
            u.updateLockedColor();
          }
        }
        nz--;
      }
      this.cells = next;
      Sched.add(0.08, () => done(full), 'grid');
    }, 'grid');
  },
  clearAll() {
    Sched.cancel('grid');
    for (const u of this.cells) if (u) u.destroy();
    for (const u of [...animUnits]) if (u.exploding !== undefined) u.destroy();
    this.cells.fill(null);
  },
};

// Coroutine-ish scheduler running on scaled game time
const Sched = {
  list: [],
  add(delay, fn, tag) { this.list.push({ t: delay, fn, tag }); },
  cancel(tag) { this.list = this.list.filter(e => e.tag !== tag); },
  update(dt) {
    if (dt <= 0) return;
    const due = [];
    for (const e of this.list) { e.t -= dt; if (e.t <= 0) due.push(e); }
    if (!due.length) return;
    this.list = this.list.filter(e => e.t > 0);
    for (const e of due) e.fn();
  },
};

// ============================================================
// Active block (BlockController)
// ============================================================
function rot90(v, a) {
  // AngleAxis(90, a) * v  ==  a x v + a (a.v)
  const d = a.x * v.x + a.y * v.y + a.z * v.z;
  return {
    x: Math.round(a.y * v.z - a.z * v.y + a.x * d),
    y: Math.round(a.z * v.x - a.x * v.z + a.y * d),
    z: Math.round(a.x * v.y - a.y * v.x + a.z * d),
  };
}
const AX = {
  forward: { x: 0, y: 0, z: 1 }, back: { x: 0, y: 0, z: -1 },
  right: { x: 1, y: 0, z: 0 }, left: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 }, down: { x: 0, y: -1, z: 0 },
};

function spawnPos(shape) {
  const rel = SHAPES[shape].rel;
  const ax = rel.reduce((s, r) => s + r[0], 0) / rel.length;
  const ay = rel.reduce((s, r) => s + r[1], 0) / rel.length;
  return { x: Math.floor((GW - 1) / 2 - ax + 0.5), y: Math.floor((GH - 1) / 2 - ay + 0.5), z: 1 };
}

class Block {
  constructor(shape) {
    const d = SHAPES[shape];
    this.shape = shape;
    this.pos = spawnPos(shape);
    this.offs = d.rel.map(r => ({ x: r[0], y: r[1], z: r[2] }));
    this.units = this.offs.map(() => new Unit(d.color));
    this.ghost = this.offs.map(() => new Unit(d.color, { ghost: true }));
    this.fallInterval = 1.0; this.fallTimer = 0;
    this.locked = false; this.lockTimer = 0; this.touchingBottom = false; this.playedLockSFX = false;
    this.neutralX = true; this.neutralY = true; this.ltPrev = false; this.externalFastDrop = false;
    this.sync();
  }
  cells(dz = 0) { return this.offs.map(o => ({ x: this.pos.x + o.x, y: this.pos.y + o.y, z: this.pos.z + o.z + dz })); }
  sync() {
    const c = this.cells();
    this.units.forEach((u, i) => u.setPos(c[i].x, c[i].y, c[i].z));
    this.updateGhost();
  }
  updateGhost() {
    let dz = 0;
    while (Grid.valid(this.cells(dz + 1))) dz++;
    const c = this.cells(dz);
    this.ghost.forEach((u, i) => u.setPos(c[i].x, c[i].y, c[i].z));
  }
  destroyGhost() { for (const g of this.ghost) g.destroy(); this.ghost = []; }
  destroy() { Synth.setFastDropping(false); for (const u of this.units) u.destroy(); this.destroyGhost(); }

  update(dt) {
    if (this.locked) return;
    if (this.handleInput()) return;
    if (!this.locked) this.handleFall(dt);
  }
  handleInput() {
    if (Controls.down('swap') && Game.canSwap()) { Game.swapWithNextBlock(); return true; }

    const md = this.slideInput();
    if (md && this.tryMove(md)) this.sync();

    let axis = null;
    if (Controls.down('rollLeft')) axis = AX.forward;
    else if (Controls.down('rollRight')) axis = AX.back;
    else if (Controls.down('pitchUp')) axis = AX.right;
    else if (Controls.down('pitchDown')) axis = AX.left;
    else if (Controls.down('yawLeft')) axis = AX.up;
    else if (Controls.down('yawRight')) axis = AX.down;
    if (axis) { this.tryRotate(axis); this.sync(); }

    if (Controls.down('hardDrop')) { this.hardDrop(); return true; }
    return false;
  }
  slideInput() {
    if (Controls.down('moveLeft')) { this.neutralX = false; return { x: -1, y: 0, z: 0 }; }
    if (Controls.down('moveRight')) { this.neutralX = false; return { x: 1, y: 0, z: 0 }; }
    if (Controls.down('moveUp')) { this.neutralY = false; return { x: 0, y: 1, z: 0 }; }
    if (Controls.down('moveDown')) { this.neutralY = false; return { x: 0, y: -1, z: 0 }; }
    let md = null;
    // left stick (with neutral return); bound keys/buttons only count toward neutral tracking
    const kx = (Controls.held('moveRight') ? 1 : 0) - (Controls.held('moveLeft') ? 1 : 0);
    const ky = (Controls.held('moveUp') ? 1 : 0) - (Controls.held('moveDown') ? 1 : 0);
    const sx = Input.axis(0), sy = -Input.axis(1);
    const ch = Math.abs(sx) > Math.abs(kx) ? sx : kx;
    const cv = Math.abs(sy) > Math.abs(ky) ? sy : ky;
    if (Math.abs(ch) < 0.2) this.neutralX = true;
    else if (this.neutralX) {
      if (ch > 0.6) { md = { x: 1, y: 0, z: 0 }; this.neutralX = false; }
      else if (ch < -0.6) { md = { x: -1, y: 0, z: 0 }; this.neutralX = false; }
    }
    if (Math.abs(cv) < 0.2) this.neutralY = true;
    else if (this.neutralY) {
      if (cv > 0.6) { md = { x: 0, y: 1, z: 0 }; this.neutralY = false; }
      else if (cv < -0.6) { md = { x: 0, y: -1, z: 0 }; this.neutralY = false; }
    }
    return md;
  }
  handleFall(dt) {
    const fast = Controls.held('fastFall') || this.externalFastDrop;
    Synth.setFastDropping(fast && !this.locked);
    const interval = fast ? 0.04 : this.fallInterval;
    this.fallTimer += dt;
    if (this.fallTimer >= interval) {
      this.fallTimer = 0;
      if (!this.tryMove({ x: 0, y: 0, z: 1 })) {
        if (!this.playedLockSFX) { Synth.lock(); this.playedLockSFX = true; }
        this.touchingBottom = true;
      } else {
        this.playedLockSFX = false;
        if (fast) Game.addScore(1);
        this.touchingBottom = false;
        this.lockTimer = 0;
        this.sync();
      }
    }
    if (this.touchingBottom) {
      this.lockTimer += dt;
      if (this.lockTimer >= 0.5) this.lockBlock();
    }
  }
  tryMove(d) {
    this.pos.x += d.x; this.pos.y += d.y; this.pos.z += d.z;
    if (Grid.valid(this.cells())) {
      const isFall = d.z === 1 && d.x === 0 && d.y === 0;
      if (!isFall && this.touchingBottom) this.lockTimer = Math.max(0, this.lockTimer - 0.15);
      if (!isFall) Synth.move();
      return true;
    }
    this.pos.x -= d.x; this.pos.y -= d.y; this.pos.z -= d.z;
    return false;
  }
  tryRotate(axis) {
    const prev = this.offs;
    this.offs = prev.map(o => rot90(o, axis));
    const rp = this.cells();
    let hit = false, minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;
    for (const p of rp) {
      if (Grid.inside(p) && Grid.has(p)) { hit = true; break; }
      if (p.x < 0) minX = Math.max(minX, -p.x); else if (p.x >= GW) maxX = Math.min(maxX, GW - 1 - p.x);
      if (p.y < 0) minY = Math.max(minY, -p.y); else if (p.y >= GH) maxY = Math.min(maxY, GH - 1 - p.y);
      if (p.z < 0) minZ = Math.max(minZ, -p.z); else if (p.z >= GD) maxZ = Math.min(maxZ, GD - 1 - p.z);
    }
    let ok = false;
    if (!hit) {
      const s = { x: minX + maxX, y: minY + maxY, z: minZ + maxZ };
      if (Grid.valid(rp.map(p => ({ x: p.x + s.x, y: p.y + s.y, z: p.z + s.z })))) {
        this.pos.x += s.x; this.pos.y += s.y; this.pos.z += s.z;
        ok = true;
      }
    }
    if (!ok) this.offs = prev;
    else {
      if (this.touchingBottom) this.lockTimer = 0;
      Synth.rotate();
    }
  }
  hardDrop() {
    let n = 0;
    while (this.tryMove({ x: 0, y: 0, z: 1 })) n++;
    if (n > 0) Game.addScore(n);
    this.sync();
    this.lockBlock();
  }
  lockBlock() {
    this.locked = true;
    Synth.setFastDropping(false);
    this.destroyGhost();
    if (!this.playedLockSFX) { Synth.lock(); this.playedLockSFX = true; }
    this.sync();
    Grid.register(this.units);
    this.units = [];
    Game.onBlockLocked();
  }
  triggerMove(d) { if (!this.locked && this.tryMove(d)) this.sync(); }
  triggerRotate(a) { if (!this.locked) { this.tryRotate(a); this.sync(); } }
}

// ============================================================
// Camera (CameraController) + Starfield
// ============================================================
const CameraCtl = {
  center: { x: (GW - 1) / 2, y: (GH - 1) / 2, z: 3.5 },
  def: { x: (GW - 1) / 2, y: (GH - 1) / 2, z: -5.8 },
  yaw: 0, pitch: 0, drag: null, shakeI: 0, shakeD: 0, shakeT: 0,
  shake(i, d) { this.shakeI = i; this.shakeD = d; this.shakeT = d; },
  pointerDown(e) {
    if (this.drag === null && Game.isInDragZone(e.clientX, e.clientY)) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
  },
  cancelDrag(id) {
    if (this.drag && this.drag.id === id) { this.yaw = this.drag.yaw; this.pitch = this.drag.pitch; this.drag = null; }
  },
  pointerMove(e) {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.yaw = clamp(this.yaw + dx * 2.5 * 0.12, -170, 170);
    this.pitch = clamp(this.pitch + dy * 2.5 * 0.12, -170, 170);
    this.drag.x = e.clientX; this.drag.y = e.clientY;
  },
  pointerUp(e) { if (this.drag && this.drag.id === e.pointerId) this.drag = null; },
  update(dt) {
    let sx = Input.axis(2), sy = Input.axis(3);
    if (Input.kh('KeyM', 'Numpad1')) sx = -1; else if (Input.kh('Period', 'Numpad3')) sx = 1;
    if (Input.kh('Numpad5')) sy = 1; else if (Input.kh('Comma', 'Numpad0')) sy = -1;
    const stick = Math.abs(sx) > 0.15 || Math.abs(sy) > 0.15;
    if (stick || this.drag) {
      if (stick) {
        this.yaw = clamp(this.yaw + sx * 2.5 * 120 * dt, -170, 170);
        this.pitch = clamp(this.pitch + sy * 2.5 * 120 * dt, -170, 170);
      }
    } else {
      this.yaw = lerp(this.yaw, 0, Math.min(1, dt * 0.4));
      this.pitch = lerp(this.pitch, 0, Math.min(1, dt * 0.4));
    }
    let sh = { x: 0, y: 0, z: 0 };
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const pw = this.shakeI * Math.max(0, this.shakeT / this.shakeD);
      let x, y, z;
      do { x = rand(-1, 1); y = rand(-1, 1); z = rand(-1, 1); } while (x * x + y * y + z * z > 1);
      sh = { x: x * pw, y: y * pw, z: z * pw };
    }
    // offset = Ry(yaw) * Rx(pitch) * (def - center)
    const o = { x: this.def.x - this.center.x, y: this.def.y - this.center.y, z: this.def.z - this.center.z };
    const p = this.pitch * Math.PI / 180, yw = this.yaw * Math.PI / 180;
    const a = { x: o.x, y: o.y * Math.cos(p) - o.z * Math.sin(p), z: o.y * Math.sin(p) + o.z * Math.cos(p) };
    const b = { x: a.x * Math.cos(yw) + a.z * Math.sin(yw), y: a.y, z: -a.x * Math.sin(yw) + a.z * Math.cos(yw) };
    camera.position.copy(V3(this.center.x + b.x + sh.x, this.center.y + b.y + sh.y, this.center.z + b.z + sh.z));
    camera.up.set(0, 1, 0);
    camera.lookAt(V3(this.center.x, this.center.y, this.center.z));
  },
};

const Stars = (() => {
  const N = 160, MAXD = 26, MIND = 0.2, BASE = 4.5;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  const st = [];
  const randCol = () => Math.random() < 0.8 ? [0.85, 0.85, 0.88] : [0.92, 0.90, 0.75];
  function reset(s, randomZ) {
    s.z = randomZ ? rand(MIND, MAXD) : MAXD;
    const sp = s.z * 0.38;
    s.x = rand(-4.5, 4.5) * sp; s.y = rand(-3.5, 3.5) * sp;
    s.speed = BASE * rand(0.85, 1.25);
    s.c = randCol();
  }
  for (let i = 0; i < N; i++) { const s = {}; reset(s, true); st.push(s); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float uScale;
      void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=max(1.0,aSize*uScale/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ gl_FragColor=vec4(vC,0.9); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  camera.add(pts);
  function update(dt, level) {
    const mul = 1 + (level - 1) * 0.16;
    for (let i = 0; i < N; i++) {
      const s = st[i];
      s.z -= s.speed * mul * dt;
      if (s.z <= MIND) reset(s, false);
      pos[i * 3] = s.x; pos[i * 3 + 1] = s.y; pos[i * 3 + 2] = -s.z;
      col[i * 3] = s.c[0]; col[i * 3 + 1] = s.c[1]; col[i * 3 + 2] = s.c[2];
      size[i] = clamp(0.025 + (MAXD - s.z) * 0.0035, 0.02, 0.14);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }
  return { update, mat };
})();

// ============================================================
// Ranking
// ============================================================
const RANK_KEY = 'OKUDESU_Ranking_Score_', RANK_N = 10;
const MUTE_KEY = 'OKUDESU_Muted';
function loadRanking() {
  const r = [];
  for (let i = 0; i < RANK_N; i++) {
    let v = (RANK_N - i) * 1000;
    try { const s = localStorage.getItem(RANK_KEY + i); if (s !== null && !isNaN(+s)) v = +s; } catch (e) {}
    r.push(v);
  }
  return r;
}
function saveRanking(r) { try { r.forEach((v, i) => localStorage.setItem(RANK_KEY + i, String(v))); } catch (e) {} }
function rankLine(i, score) {
  const sfx = i === 0 ? 'ST' : i === 1 ? 'ND' : i === 2 ? 'RD' : 'TH';
  return ((i + 1) + sfx).padEnd(4) + '  ' + String(score).padStart(7);
}

// ============================================================
// Game (GameManager)
// ============================================================
const GREEN = C(0, 1, 0.2);
const MENU_BLUE = C(0, 0.8, 1);
const CHAR_W = 0.01375;
const MEGA_DUR = 4.76;

const T = {
  title: new WireText({ text: 'OKUDESU', pos: [0.5, 0.25], widthRatio: 0.58, lineWidth: 0.09, color: GREEN }),
  next: new WireText({ text: 'NEXT BLOCK', pos: [0.86, 0.08], widthRatio: 10 * CHAR_W * 1.2, lineWidth: 0.021 * 1.2, color: GREEN, float: false, active: false }),
  start: new WireText({ text: 'GAME START', pos: [0.5, 0.56], widthRatio: 0.57, lineWidth: 0.06, color: GREEN, active: false }),
  over: new WireText({ text: 'GAME OVER', pos: [0.5, 0.35], widthRatio: 0.46, lineWidth: 0.05, color: C(1, 0.1, 0.1), active: false }),
  notif: new WireText({ text: ' ', pos: [0.5, 0.65], widthRatio: CHAR_W * 1.35, lineWidth: 0.021 * 1.35, color: COL.magenta, active: false }),
  levelUp: new WireText({ text: ' ', pos: [0.5, 0.52], widthRatio: CHAR_W * 2.025, lineWidth: 0.021 * 2.025, color: COL.yellow, active: false }),
  record: new WireText({ text: ' ', pos: [0.5, 0.425], widthRatio: CHAR_W * 2.025, lineWidth: 0.021 * 2.025, color: COL.yellow, active: false }),
  score: new WireText({ text: 'SCORE 0', pos: [0.04, 0.08], widthRatio: 7 * CHAR_W * 1.2, lineWidth: 0.021 * 1.2, color: C(0, 0.95, 1), autoCenter: false, float: false, active: false }),
  planes: new WireText({ text: 'PLANES 0', pos: [0.04, 0.14], widthRatio: 8 * CHAR_W, lineWidth: 0.021, color: C(1, 0, 1), autoCenter: false, float: false, active: false }),
  level: new WireText({ text: 'LEVEL 1', pos: [0.04, 0.20], widthRatio: 7 * CHAR_W, lineWidth: 0.021, color: C(1, 1, 0), autoCenter: false, float: false, active: false }),
  rankTitle: new WireText({ text: 'HIGH SCORES', pos: [0.04, 0.30], widthRatio: 0.16, lineWidth: 0.016, color: COL.yellow, autoCenter: false, float: false }),
  pauseTitle: new WireText({ text: 'PAUSED', pos: [0.5, 0.20], widthRatio: 0.149, lineWidth: 0.025, color: COL.yellow }),
};
const RANK_COLORS = [C(1, 0.85, 0), C(0.75, 0.75, 0.75), C(0.8, 0.5, 0.2)];
const rankTexts = [];
for (let i = 0; i < RANK_N; i++) {
  rankTexts.push(new WireText({ text: '', pos: [0.04, 0.35 + i * 0.032], widthRatio: 0.128, lineWidth: 0.008, color: RANK_COLORS[i] || C(0, 0.9, 1), autoCenter: false, float: false }));
}
const pauseItems = [0, 1, 2, 3].map(i => new WireText({ pos: [0.5, 0.36 + i * 0.08], color: MENU_BLUE, float: false }));
const overItems = [0, 1].map(i => new WireText({ pos: [0.5, 0.72 + i * 0.12], color: MENU_BLUE, float: false }));

function setHUD(t, text, sizeScale = 1, setLW = false) {
  t.text = text;
  t.widthRatio = text.length * CHAR_W * sizeScale;
  if (setLW) t.lineWidth = 0.021 * sizeScale;
}

const Game = {
  started: false, over: false, paused: false,
  score: 0, lines: 0, level: 1,
  active: null, nextShape: -1, preview: null,
  baseFall: 2.0, speedMul: 0.85, fallInterval: 2.0,
  swapped: false,
  notifTimer: 0, levelUpTimer: 0, recordTimer: 0,
  mega: false, megaTimer: 0,
  muted: false, pauseSel: 0, overSel: 0, pauseNeutral: true,
  rankingVisible: false, lastRank: -1,
  time: 0,
  rects: {},

  init() {
    this.rebuildRanking();
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
    Synth.setMute(this.muted);
  },

  startGame() {
    this.score = 0; this.lines = 0; this.level = 1;
    this.blocks = 0; this.playMs = 0;   // sent with the score to the online ranking
    this.skipBlockFrame = true;         // the key that chose PLAY/RETRY must not also act on the first block
    this.over = false; this.paused = false; this.started = true;
    T.notif.active = T.levelUp.active = T.record.active = false;
    this.notifTimer = this.levelUpTimer = this.recordTimer = 0;
    this.mega = false;
    this.swapped = false;
    this.rankingVisible = false;
    this.lastRank = -1;
    T.rankTitle.active = true; rankTexts.forEach(t => t.active = true);
    this.fallInterval = this.baseFall;
    Grid.clearAll();
    if (this.active) { this.active.destroy(); this.active = null; }
    this.destroyPreview();
    T.title.active = false;
    T.next.active = true;
    T.score.active = true; setHUD(T.score, 'SCORE 0', 1.2, true);
    T.planes.active = true; setHUD(T.planes, 'PLANES 0');
    T.level.active = true; setHUD(T.level, 'LEVEL 1');
    T.over.active = false;
    T.start.active = true;
    Sched.add(1.5, () => { T.start.active = false; });
    Synth.level = 1;
    Synth.unlock();
    this.nextShape = randomShape(0);
    this.spawnNext();
  },

  quitToTitle() {
    Grid.clearAll();
    if (this.active) { this.active.destroy(); this.active = null; }
    this.destroyPreview();
    this.started = false; this.over = false; this.paused = false;
    for (const k of ['next', 'start', 'over', 'notif', 'levelUp', 'record', 'score', 'planes', 'level']) T[k].active = false;
    T.title.active = true; Menu.open('title');
    this.rankingVisible = false; this.mega = false;
    Synth.stopBGM(); Synth.setFastDropping(false);
  },

  spawnNext() {
    if (this.over) return;
    this.swapped = false;
    const cur = this.nextShape;
    this.nextShape = randomShape(this.lines);
    this.active = new Block(cur);
    this.active.fallInterval = this.fallInterval;
    this.updatePreview();
    if (!Grid.valid(this.active.cells())) this.gameOver();
  },

  canSwap() { return !this.swapped && !this.over && this.started && !this.paused; },

  swapWithNextBlock() {
    if (!this.canSwap() || !this.active) return;
    this.notify('SWAP NEXT', COL.yellow, 0.8);
    Synth.clear(2);
    const cur = this.active.shape;
    this.active.destroy();
    const tmp = this.nextShape;
    this.nextShape = cur;
    this.swapped = true;
    this.active = new Block(tmp);
    this.active.fallInterval = this.fallInterval;
    this.updatePreview();
  },

  destroyPreview() {
    if (this.preview) { camera.remove(this.preview.group); this.preview.units.forEach(u => u.destroy()); this.preview = null; }
  },
  updatePreview() {
    this.destroyPreview();
    if (this.nextShape < 0) return;
    const d = SHAPES[this.nextShape];
    const group = new THREE.Group();
    const rel = d.rel;
    const mn = [0, 1, 2].map(k => Math.min(...rel.map(r => r[k])));
    const mx = [0, 1, 2].map(k => Math.max(...rel.map(r => r[k])));
    const ctr = [0, 1, 2].map(k => (mn[k] + mx[k]) / 2);
    const units = rel.map(r => {
      const u = new Unit(d.color, { wireWidth: 0.01, parent: group });
      u.mesh.visible = true;
      u.group.position.copy(V3(r[0] - ctr[0], r[1] - ctr[1], r[2] - ctr[2]));
      return u;
    });
    group.scale.setScalar(0.135);
    camera.add(group);
    this.preview = { group, units };
  },
  // x centre (ratio of W) of the NEXT BLOCK label and preview; kept inside the screen when the text is enlarged (portrait)
  nextX() {
    const half = Math.min(T.next.widthRatio * TW, W * 0.92) / 2 / W;
    return Math.min(0.86, 0.98 - half);
  },
  updatePreviewTransform() {
    if (!this.preview) return;
    const halfH = 4 * TANH, halfW = halfH * (W / H);
    const shiftY = (this.viewShift || 0) / H * 2 * halfH;   // portrait: the view is shifted up, keep the preview on screen
    this.preview.group.scale.setScalar(0.135 * Math.min(1, (W / H) / 0.75));   // narrower screens: smaller preview
    this.preview.group.position.set((2 * this.nextX() - 1) * halfW, (1 - 2 * 0.08) * halfH - 0.38 - shiftY, -4);
  },

  addScore(p) {
    if (this.over || !this.started) return;
    this.score += p;
    setHUD(T.score, 'SCORE ' + this.score, 1.2, true);
  },

  onBlockLocked() {
    this.active = null;
    this.blocks++;
    Grid.processLineClear(full => this.onLineClearComplete(full));
  },

  onLineClearComplete(full) {
    const n = full.length;
    if (n > 0) {
      const old = this.lines;
      this.lines += n;
      setHUD(T.planes, 'PLANES ' + this.lines);
      if (old < 20 && this.lines >= 20) { this.notify('CORNER BLOCK UNLOCKED!!!', COL.red, 3.5); Synth.clear(4); }
      else if (old < 40 && this.lines >= 40) { this.notify('HOOK3D-A UNLOCKED!!!', C(0.4, 0.8, 1.0), 3.5); Synth.clear(4); }
      const base = n * n * 100;
      this.score += base;
      let hb = 0;
      for (const z of full) hb += (GD - z) * 100;
      this.score += hb;
      const allClear = Grid.isEmpty();
      if (allClear) this.score += 1000;
      setHUD(T.score, 'SCORE ' + this.score, 1.2, true);

      let msg = '', def = true;
      if (n === 1) msg = 'SINGLE CLEAR!';
      else if (n === 2) msg = 'DOUBLE CLEAR!!';
      else if (n === 3) msg = 'TRIPLE CLEAR!!!';
      else { msg = 'OKUDESU'; def = false; this.startMega(); }
      const turn = base + hb + (allClear ? 1000 : 0);
      if (turn > 0 && n < 4) msg += '+' + turn;
      if (def) this.notify(msg, COL.magenta, 1.8);

      const nl = 1 + Math.floor(this.lines / 3);
      if (nl > this.level) {
        this.level = nl;
        setHUD(T.level, 'LEVEL ' + this.level);
        this.fallInterval = Math.max(0.18, this.baseFall * Math.pow(this.speedMul, this.level - 1));
        Synth.setLevel(this.level);
        this.levelUpNotify('LEVEL UP!', COL.yellow, 2.0);
      }
    }
    this.spawnNext();
  },

  notify(text, color, dur) {
    this.mega = false;
    this.notifTimer = dur;
    Object.assign(T.notif, { text, color, float: true, pos: [0.5, 0.65], lineWidth: 0.021 * 1.35, widthRatio: text.length * CHAR_W * 1.35, active: true });
  },
  megaWidth() { return 0.49 * (unscaledWidth(T.notif.text) / 80) / (W / H); },
  startMega() {
    this.mega = true; this.megaTimer = MEGA_DUR;
    Object.assign(T.notif, { text: 'OKUDESU!!!', color: C(1, 0.9, 0, 0.45), float: false, lineWidth: 0.021 * 1.35 * 6, active: true });
    T.notif.widthRatio = this.megaWidth();
    T.notif.pos = [1 + T.notif.widthRatio / 2 - 0.05, 0.55];
  },
  updateMega() {
    T.notif.widthRatio = this.megaWidth();
    let t = clamp01((MEGA_DUR - this.megaTimer) / MEGA_DUR);
    t = t * t * (3 - 2 * t);
    const half = T.notif.widthRatio / 2;
    T.notif.pos = [lerp(1 + half - 0.05, -half - 0.1, t), 0.55];
  },
  levelUpNotify(text, color, dur) {
    this.levelUpTimer = dur;
    Object.assign(T.levelUp, { text, color, widthRatio: text.length * CHAR_W * 2.025, lineWidth: 0.021 * 2.025, active: true });
  },
  recordNotify(text, color, dur) {
    this.recordTimer = dur;
    Object.assign(T.record, { text, color, widthRatio: text.length * CHAR_W * 2.025, lineWidth: 0.021 * 2.025, active: true });
  },

  gameOver() {
    this.over = true;
    Synth.playGameOverBGM();
    T.over.active = true;
    const r = loadRanking();
    let idx = -1;
    for (let i = 0; i < RANK_N; i++) if (this.score > r[i]) { idx = i; break; }
    if (idx !== -1) {
      for (let i = RANK_N - 1; i > idx; i--) r[i] = r[i - 1];
      r[idx] = this.score;
      saveRanking(r);
      this.recordNotify('NEW RECORD!!!', COL.yellow, 4);
    }
    this.lastRank = idx;
    this.rebuildRanking();
    this.rankingVisible = true;
    this.overSel = 0;
    this.updateOverMenu();
    ScoreUI.openFor({ score: this.score, planes: this.lines, level: this.level, blocks: this.blocks, duration: Math.round(this.playMs) });
  },
  rebuildRanking() {
    const r = loadRanking();
    rankTexts.forEach((t, i) => t.text = rankLine(i, r[i]));
  },

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      this.pauseSel = 0; this.pauseNeutral = true;
      Synth.pauseBGM();
      this.updatePauseMenu();
    } else {
      Synth.resumeBGM();
      }
  },
  updatePauseMenu() {
    const names = ['RESUME', this.muted ? 'SOUND: OFF' : 'SOUND: ON', 'RETRY', 'QUIT'];
    pauseItems.forEach((t, i) => this.styleMenuItem(t, names[i], i === this.pauseSel));
  },
  updateOverMenu() {
    ['RETRY', 'EXIT'].forEach((n, i) => this.styleMenuItem(overItems[i], n, i === this.overSel));
  },
  styleMenuItem(t, name, sel) {
    t.text = sel ? `[ ${name} ]` : ` ${name} `;
    t.color = sel ? COL.yellow : MENU_BLUE;
    t.lineWidth = sel ? 0.035 : 0.021;
    t.widthRatio = t.text.length * CHAR_W * 1.5 * (sel ? 1.2 : 1.0);
  },
  executePause() {
    if (this.pauseSel === 0) this.togglePause();
    else if (this.pauseSel === 1) this.toggleSound();
    else if (this.pauseSel === 2) this.startGame();
    else this.quitToTitle();
  },
  toggleSound() {
    this.muted = !this.muted;
    Synth.setMute(this.muted);
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch (e) {}
    if (this.paused) this.updatePauseMenu();
  },

  // Menu navigation shared by pause and game over (keyboard on key-up, stick with neutral)
  menuNav() {
    let v = Input.vertical(); const dy = Input.dpadY();
    let cv = Math.abs(v) > Math.abs(dy) ? v : dy;
    if (Input.kh('ArrowUp', 'KeyW', 'ArrowDown', 'KeyS') || Input.ku('ArrowUp', 'KeyW', 'ArrowDown', 'KeyS')) cv = 0;
    if (Input.ku('ArrowUp', 'KeyW')) return -1;
    if (Input.ku('ArrowDown', 'KeyS')) return 1;
    if (Math.abs(cv) < 0.2) this.pauseNeutral = true;
    else if (this.pauseNeutral) {
      if (cv > 0.6) { this.pauseNeutral = false; return -1; }
      if (cv < -0.6) { this.pauseNeutral = false; return 1; }
    }
    return 0;
  },
  handlePauseInput() {
    const d = this.menuNav();
    if (d) { this.pauseSel = (this.pauseSel + d + 4) % 4; this.updatePauseMenu(); Synth.lock(); }
    if (Input.kd('J0', 'Enter', 'NumpadEnter', 'Space')) this.executePause();
  },
  handleOverInput() {
    const d = this.menuNav();
    if (d) { this.overSel = (this.overSel + d + 2) % 2; this.updateOverMenu(); Synth.lock(); }
    if (Input.kd('KeyR')) { this.startGame(); return; }
    if (Input.kd('Enter', 'NumpadEnter', 'Space', 'J0')) {
      if (this.overSel === 0) this.startGame(); else this.quitToTitle();
    }
  },

  // ---------------- touch layout (422x226 reference) ----------------
  recalcRects() {
    const R = (x, y, w, h) => ({ x, y, w, h, contains(p) { return p.x >= x && p.x < x + w && p.y >= y && p.y < y + h; } });
    const lx0 = 0, lx1 = W * 54 / 422, lx2 = W * 105 / 422, lx3 = W * 156 / 422;
    const rx0 = W * 265 / 422, rx1 = W * 316 / 422, rx2 = W * 368 / 422, rx3 = W;
    const y0 = H * 17 / 226, y1 = H * 70 / 226, y2 = H * 120 / 226, y3 = H * 171 / 226, y4 = H;
    this.rects = {
      menu: R(lx0, y0, lx3 - lx0, y1 - y0),
      swap: R(rx2, y0, rx3 - rx2, y1 - y0),
      moveUp: R(lx1, y1, lx2 - lx1, y2 - y1),
      moveLeft: R(lx0, y2, lx1 - lx0, y3 - y2),
      moveRight: R(lx2, y2, lx3 - lx2, y3 - y2),
      moveDown: R(lx1, y3, lx2 - lx1, y4 - y3),
      rollLeft: R(rx0, y1, rx1 - rx0, y2 - y1),
      rotUp: R(rx1, y1, rx2 - rx1, y2 - y1),
      rollRight: R(rx2, y1, rx3 - rx2, y2 - y1),
      rotLeft: R(rx0, y2, rx1 - rx0, y3 - y2),
      rotRight: R(rx2, y2, rx3 - rx2, y3 - y2),
      rotDown: R(rx1, y3, rx2 - rx1, y4 - y3),
      space: R(lx2, y3, rx1 - lx2, y4 - y3),
    };
    this.portrait = H > W;
    this.viewShift = 0;
    if (this.portrait) this.layoutPortrait(R);
    this.touchActive = {};
  },
  // Portrait: two square pads split by an X (left = move, right = pitch/yaw rotate),
  // below them DROP (fast fall while held) and the two roll buttons. Menu / swap stay in the top corners.
  layoutPortrait(R) {
    const m = W * 0.04, gx = W * 0.04;
    const pad = Math.min((W - 2 * m - gx) / 2, H * 0.26);
    const bh = Math.min(pad * 0.42, H * 0.09);
    const rowY = H - Math.max(12, H * 0.025) - bh;
    const padY = rowY - gx - pad;
    const lx = W / 2 - gx / 2 - pad, rx = W / 2 + gx / 2;
    // a triangle of a pad: the quarter of the square on the side `dir`
    const Tri = (x, y, size, dir) => {
      const cx = x + size / 2, cy = y + size / 2, half = size / 2;
      return { tri: true, cx, cy, half, dir, x, y, w: size, h: size, contains(p) {
        const dx = p.x - cx, dy = p.y - cy;
        if (Math.abs(dx) > half || Math.abs(dy) > half) return false;
        if (dir === 'up') return dy < 0 && -dy >= Math.abs(dx);
        if (dir === 'down') return dy >= 0 && dy >= Math.abs(dx);
        if (dir === 'left') return dx < 0 && -dx > Math.abs(dy);
        return dx >= 0 && dx > Math.abs(dy);
      } };
    };
    Object.assign(this.rects, {
      moveUp: Tri(lx, padY, pad, 'up'), moveDown: Tri(lx, padY, pad, 'down'),
      moveLeft: Tri(lx, padY, pad, 'left'), moveRight: Tri(lx, padY, pad, 'right'),
      rotUp: Tri(rx, padY, pad, 'up'), rotDown: Tri(rx, padY, pad, 'down'),
      rotLeft: Tri(rx, padY, pad, 'left'), rotRight: Tri(rx, padY, pad, 'right'),
      space: R(lx, rowY, pad, bh),
      rollLeft: R(rx, rowY, (pad - gx) / 2, bh),
      rollRight: R(rx + (pad + gx) / 2, rowY, (pad - gx) / 2, bh),
    });
    this.padTop = padY;
    // move the 3D view up so the field sits in the space above the pads
    this.viewShift = Math.max(0, (H - padY) / 2 - H * 0.04);
  },
  isInDragZone(x, y) {
    if (this.portrait) {
      const p = { x, y };
      return y < this.padTop - 8 && !this.rects.menu.contains(p) && !this.rects.swap.contains(p);
    }
    return x >= W * 156 / 422 && x <= W * 265 / 422 && y >= 0 && y <= H * 171 / 226;
  },
  touchAction(name) {
    const b = this.active;
    const M = { moveLeft: [-1, 0, 0], moveRight: [1, 0, 0], moveUp: [0, 1, 0], moveDown: [0, -1, 0] };
    const Rt = { rotUp: AX.right, rotDown: AX.left, rotLeft: AX.up, rotRight: AX.down, rollLeft: AX.forward, rollRight: AX.back };
    if (M[name]) { if (b) b.triggerMove({ x: M[name][0], y: M[name][1], z: M[name][2] }); }
    else if (Rt[name]) { if (b) b.triggerRotate(Rt[name]); }
    else if (name === 'swap') { if (this.canSwap()) this.swapWithNextBlock(); }
  },
  // Flick controls: landscape touch screens during play.
  // Left half = slide move, right half = pitch/yaw rotate (no roll by flick).
  flickEnabled() { return W > H && this.started && !this.over && !this.paused; },
  flickAction(f) {
    const b = this.active; if (!b) return;
    const horiz = Math.abs(f.dx) >= Math.abs(f.dy);
    if (f.sx < W / 2) {
      if (horiz) b.triggerMove({ x: f.dx > 0 ? 1 : -1, y: 0, z: 0 });
      else b.triggerMove({ x: 0, y: f.dy < 0 ? 1 : -1, z: 0 });
    } else {
      // same axes as the rotate buttons: up = rotUp, down = rotDown, left = rotLeft, right = rotRight
      if (horiz) b.triggerRotate(f.dx < 0 ? AX.up : AX.down);
      else b.triggerRotate(f.dy < 0 ? AX.right : AX.left);
    }
  },
  processTouch() {
    this.touchActive = {};
    if (!this.started || this.over || this.paused) return;
    const order = ['moveLeft', 'moveRight', 'moveUp', 'moveDown', 'rotUp', 'rotDown', 'rotLeft', 'rotRight', 'rollLeft', 'rollRight', 'swap'];
    const buttonAt = p => order.find(n => this.rects[n].contains(p));
    // With flicks enabled, move/rotate buttons act on release (tap) so a flick starting on a button doesn't also press it
    const flick = this.flickEnabled();
    const deferred = n => flick && n !== 'swap';
    for (const pd of Input.pointerDowns) {
      if (pd.type !== 'touch') continue;
      const n = buttonAt({ x: pd.x, y: pd.y });
      if (n && !deferred(n)) this.touchAction(n);
    }
    for (const f of Input.flicks) if (flick) this.flickAction(f);
    for (const te of Input.touchEnds) {
      if (te.flicked) continue;
      const n = buttonAt({ x: te.sx, y: te.sy });
      if (n && deferred(n)) this.touchAction(n);
    }
    for (const p of Input.touches.values()) {
      for (const n of [...order, 'space']) if (this.rects[n].contains(p)) this.touchActive[n] = true;
    }
    if (this.active) this.active.externalFastDrop = !!this.touchActive.space;
  },

  // ---------------- per-frame update ----------------
  update(dt) {
    this.processTouch();
    const click = Input.pointerDowns[0];
    if (click) {
      const p = { x: click.x, y: click.y };
      if (this.rects.menu.contains(p) && this.started && !this.over) { this.togglePause(); return; }
      const hitItem = (items, i) => {
        const t = items[i];
        const bw = 2.5 / HUD_WORLD_H * H, bh = 0.35 / HUD_WORLD_H * H;
        return Math.abs(p.x - t.pos[0] * W) <= bw / 2 && Math.abs(p.y - t.pos[1] * H) <= bh / 2;
      };
      const pick = items => {
        let best = -1, bd = Infinity;
        items.forEach((t, i) => { if (hitItem(items, i)) { const d = Math.abs(p.y - t.pos[1] * H); if (d < bd) { bd = d; best = i; } } });
        return best;
      };
      if (this.paused) {
        const i = pick(pauseItems);
        if (i >= 0) { this.pauseSel = i; this.updatePauseMenu(); this.executePause(); return; }
      } else if (this.over) {
        const i = pick(overItems);
        if (i >= 0) { this.overSel = i; this.updateOverMenu(); if (i === 0) this.startGame(); else this.quitToTitle(); return; }
      }
    }

    if (!this.started) { Menu.update(click); return; }

    if (Controls.down('pause') && !this.over) { this.togglePause(); return; }
    if (this.paused) { this.handlePauseInput(); return; }

    if (this.over) {
      this.handleOverInput();
      if (this.over && this.lastRank !== -1) rankTexts[this.lastRank].active = Math.floor(this.time * 5) % 2 === 0;
      return;
    }

    this.playMs += dt * 1000;
    if (this.notifTimer > 0) { this.notifTimer -= dt; if (this.notifTimer <= 0) T.notif.active = false; }
    if (this.mega) {
      this.megaTimer -= dt;
      if (this.megaTimer <= 0) {
        this.mega = false;
        Object.assign(T.notif, { active: false, float: true, pos: [0.5, 0.65], lineWidth: 0.021 * 1.35 });
      } else this.updateMega();
    }
    if (this.levelUpTimer > 0) { this.levelUpTimer -= dt; if (this.levelUpTimer <= 0) T.levelUp.active = false; }
    if (this.recordTimer > 0) { this.recordTimer -= dt; if (this.recordTimer <= 0) T.record.active = false; }

    if (this.preview) this.preview.group.rotateOnAxis(new THREE.Vector3(0.3, 1, -0.2).normalize(), 25 * Math.PI / 180 * dt);
  },
};

// ============================================================
// Help text (the only localized screen: ja / ko / zh / en)
// ============================================================
const LANG_STORE = 'OKUDESU_Lang';
const LANG_ORDER = ['auto', 'en', 'ja', 'ko', 'zh'];
const LANG_NAMES = { en: 'ENGLISH', ja: 'JAPANESE', ko: 'KOREAN', zh: 'CHINESE' };
function detectLang() {
  const l = (navigator.language || '').toLowerCase();
  return l.startsWith('ja') ? 'ja' : l.startsWith('ko') ? 'ko' : l.startsWith('zh') ? 'zh' : 'en';
}
// Lines starting with '#' are headings.
function helpLines(lang, mobile) {
  const K = a => Controls.keysText(a);
  const P = a => Controls.padLabel(Controls.pad[a]);
  const L = {
    ja: {
      pc: [
        '#操作方法（キーボード / コントローラー）',
        `移動：${K('moveLeft')}・${K('moveRight')}・${K('moveUp')}・${K('moveDown')}（十字キー / 左スティック）`,
        `縦回転：${K('pitchUp')}・${K('pitchDown')}（${P('pitchUp')}・${P('pitchDown')}）`,
        `横回転：${K('yawLeft')}・${K('yawRight')}（${P('yawLeft')}・${P('yawRight')}）`,
        `ひねり回転：${K('rollLeft')}・${K('rollRight')}（${P('rollLeft')}・${P('rollRight')}）`,
        `高速落下：${K('fastFall')}（${P('fastFall')}）押している間`,
        `即落下：${K('hardDrop')}（${P('hardDrop')}）`,
        `ネクストと交換：${K('swap')}（${P('swap')}）1ブロックにつき1回`,
        `ポーズ：${K('pause')}（${P('pause')}）`,
        '視点の回転：画面中央をマウスでドラッグ / 右スティック',
        'キー配置は SETTING で変更できます。',
      ],
      mobile: [
        '#操作方法（横画面がおすすめ）',
        '左側のボタン：ブロックの移動（上下左右）',
        '右側のボタン：上下で縦回転、左右で横回転、上の段の左右でひねり回転',
        '下の中央：押している間、高速落下',
        '右上：ネクストと交換（1ブロックにつき1回）　左上：メニュー',
        '#フリック操作（横画面）',
        '左半分をフリック：その方向へ移動',
        '右半分をフリック：その方向へ回転（縦・横回転のみ）',
        '画面中央をゆっくりドラッグ：視点の回転',
      ],
      rules: [
        '#ルール',
        'ブロックは画面の奥に向かって落ちていきます。',
        '4×4の面をすべて埋めると、その面が消えて得点になります。',
        '一度に多く消すほど、奥の面ほど高得点。全部消すとボーナス。',
        '3面消すごとにレベルが上がり、落下が速くなります。',
        'ブロックが手前まで積み上がるとゲームオーバーです。',
      ],
    },
    ko: {
      pc: [
        '#조작 방법 (키보드 / 컨트롤러)',
        `이동: ${K('moveLeft')}, ${K('moveRight')}, ${K('moveUp')}, ${K('moveDown')} (방향 패드 / 왼쪽 스틱)`,
        `세로 회전: ${K('pitchUp')}, ${K('pitchDown')} (${P('pitchUp')}, ${P('pitchDown')})`,
        `가로 회전: ${K('yawLeft')}, ${K('yawRight')} (${P('yawLeft')}, ${P('yawRight')})`,
        `비틀기 회전: ${K('rollLeft')}, ${K('rollRight')} (${P('rollLeft')}, ${P('rollRight')})`,
        `빠른 낙하: ${K('fastFall')} (${P('fastFall')}) 누르고 있는 동안`,
        `즉시 낙하: ${K('hardDrop')} (${P('hardDrop')})`,
        `다음 블록과 교환: ${K('swap')} (${P('swap')}) 블록당 1회`,
        `일시 정지: ${K('pause')} (${P('pause')})`,
        '시점 회전: 화면 중앙을 마우스로 드래그 / 오른쪽 스틱',
        '키 설정은 SETTING에서 바꿀 수 있습니다.',
      ],
      mobile: [
        '#조작 방법 (가로 화면 권장)',
        '왼쪽 버튼: 블록 이동 (상하좌우)',
        '오른쪽 버튼: 위아래는 세로 회전, 좌우는 가로 회전, 윗줄 좌우는 비틀기 회전',
        '아래 중앙: 누르고 있는 동안 빠른 낙하',
        '오른쪽 위: 다음 블록과 교환 (블록당 1회)   왼쪽 위: 메뉴',
        '#플릭 조작 (가로 화면)',
        '왼쪽 절반을 플릭: 그 방향으로 이동',
        '오른쪽 절반을 플릭: 그 방향으로 회전 (세로·가로 회전만)',
        '화면 중앙을 천천히 드래그: 시점 회전',
      ],
      rules: [
        '#규칙',
        '블록은 화면 안쪽을 향해 떨어집니다.',
        '4×4 면을 모두 채우면 그 면이 사라지고 점수를 얻습니다.',
        '한 번에 많이 지울수록, 안쪽 면일수록 고득점. 전부 지우면 보너스.',
        '3면을 지울 때마다 레벨이 오르고 낙하가 빨라집니다.',
        '블록이 앞쪽까지 쌓이면 게임 오버입니다.',
      ],
    },
    zh: {
      pc: [
        '#操作方法（键盘 / 手柄）',
        `移动：${K('moveLeft')}、${K('moveRight')}、${K('moveUp')}、${K('moveDown')}（十字键 / 左摇杆）`,
        `纵向旋转：${K('pitchUp')}、${K('pitchDown')}（${P('pitchUp')}、${P('pitchDown')}）`,
        `横向旋转：${K('yawLeft')}、${K('yawRight')}（${P('yawLeft')}、${P('yawRight')}）`,
        `扭转旋转：${K('rollLeft')}、${K('rollRight')}（${P('rollLeft')}、${P('rollRight')}）`,
        `快速下落：${K('fastFall')}（${P('fastFall')}）按住期间`,
        `立即下落：${K('hardDrop')}（${P('hardDrop')}）`,
        `与下一个方块交换：${K('swap')}（${P('swap')}）每个方块限1次`,
        `暂停：${K('pause')}（${P('pause')}）`,
        '旋转视角：用鼠标拖动画面中央 / 右摇杆',
        '按键可在 SETTING 中更改。',
      ],
      mobile: [
        '#操作方法（推荐横屏）',
        '左侧按钮：移动方块（上下左右）',
        '右侧按钮：上下为纵向旋转，左右为横向旋转，上排左右为扭转旋转',
        '下方中央：按住期间快速下落',
        '右上：与下一个方块交换（每个方块限1次）　左上：菜单',
        '#滑动操作（横屏）',
        '在左半边滑动：向该方向移动',
        '在右半边滑动：向该方向旋转（仅纵向、横向旋转）',
        '在画面中央慢慢拖动：旋转视角',
      ],
      rules: [
        '#规则',
        '方块会朝画面深处落下。',
        '填满一整个4×4的面，该面就会消除并得分。',
        '一次消除越多、越深处的面得分越高。全部消除有奖励。',
        '每消除3个面等级提升，下落速度变快。',
        '方块堆到最前面时游戏结束。',
      ],
    },
    en: {
      pc: [
        '#Controls (keyboard / controller)',
        `Move: ${K('moveLeft')}, ${K('moveRight')}, ${K('moveUp')}, ${K('moveDown')} (D-pad / left stick)`,
        `Pitch rotate: ${K('pitchUp')}, ${K('pitchDown')} (${P('pitchUp')}, ${P('pitchDown')})`,
        `Yaw rotate: ${K('yawLeft')}, ${K('yawRight')} (${P('yawLeft')}, ${P('yawRight')})`,
        `Roll rotate: ${K('rollLeft')}, ${K('rollRight')} (${P('rollLeft')}, ${P('rollRight')})`,
        `Fast fall: ${K('fastFall')} (${P('fastFall')}) while held`,
        `Hard drop: ${K('hardDrop')} (${P('hardDrop')})`,
        `Swap with next: ${K('swap')} (${P('swap')}) once per block`,
        `Pause: ${K('pause')} (${P('pause')})`,
        'Rotate view: drag the middle of the screen / right stick',
        'You can change the key layout in SETTING.',
      ],
      mobile: [
        '#Controls (landscape recommended)',
        'Left buttons: move the block (up, down, left, right)',
        'Right buttons: up/down to pitch, left/right to yaw, top-row left/right to roll',
        'Bottom center: fast fall while held',
        'Top right: swap with next (once per block)   Top left: menu',
        '#Flick controls (landscape)',
        'Flick on the left half: move in that direction',
        'Flick on the right half: rotate in that direction (pitch and yaw only)',
        'Slowly drag the middle of the screen: rotate the view',
      ],
      rules: [
        '#Rules',
        'Blocks fall away from you, into the screen.',
        'Fill a whole 4x4 layer to clear it and score points.',
        'Clearing more layers at once, and deeper layers, scores more. Clearing everything gives a bonus.',
        'Every 3 layers cleared, the level goes up and blocks fall faster.',
        'The game is over when blocks pile up to the front.',
      ],
    },
  }[lang];
  return [...(mobile ? L.mobile : L.pc), '', ...L.rules];
}

// ============================================================
// Online ranking (Cloudflare Workers + D1, same scheme as PartlyRainy)
//   Top 100, one entry (best) per name. Names: letters, digits and spaces, up to 12.
//   To cut requests, the list / 100th-place score / own best are cached in localStorage.
// ============================================================
const SCORE_API = 'https://okudesu-scores.haradadaisuke.workers.dev';
const NAME_STORE = 'OKUDESU_Name', RK_STORE = 'OKUDESU_Rk';
// Names: any ordinary characters (letters of any script, digits, punctuation, spaces), up to 12.
// Control/invisible characters, < >, and emoji are removed. Same rule as the server.
const cleanPlayerName = v => [...String(v || '').normalize('NFKC')
  .replace(/[\u0000-\u001f\u007f-\u009f<>\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '')
  .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u20E3]/gu, '')
  .replace(/\s+/g, ' ')].slice(0, 12).join('');
// true when every character can be drawn with the wireframe font
const wireDrawable = t => [...String(t)].every(c => c === ' ' || FONT[c.toUpperCase()]);
const Online = {
  api: (() => { try { return (new URLSearchParams(location.search).get('api') || SCORE_API).replace(/\/+$/, ''); } catch (e) { return SCORE_API; } })(),
  LIST_MS: 60000, CUT_MS: 30 * 60000, BEST_MS: 6 * 3600000, ROWS: 10,
  state: 'idle', list: [], scroll: 0, mem_: null,
  mem() {
    if (!this.mem_) { try { this.mem_ = JSON.parse(localStorage.getItem(RK_STORE) || '{}') || {}; } catch (e) { this.mem_ = {}; } }
    return this.mem_;
  },
  set(patch) { Object.assign(this.mem(), patch); try { localStorage.setItem(RK_STORE, JSON.stringify(this.mem_)); } catch (e) {} },
  cutoff() { const m = this.mem(); return m.ct && Date.now() - m.ct < this.CUT_MS ? (m.cutoff || 0) : 0; },
  best() { const m = this.mem(); return m.bt && Date.now() - m.bt < this.BEST_MS ? (m.best || 0) : 0; },
  playerName() { try { return localStorage.getItem(NAME_STORE) || ''; } catch (e) { return ''; } },
  async fetchTop(force) {
    const m = this.mem();
    if (!force && m.list && m.lt && Date.now() - m.lt < this.LIST_MS) return m.list;
    const r = await fetch(this.api + '/scores', { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    const d = await r.json();
    this.set({ list: d.scores || [], lt: Date.now(), cutoff: d.cutoff || 0, ct: Date.now() });
    return d.scores || [];
  },
  async submit(name, data) {
    const r = await fetch(this.api + '/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, ...data }) });
    const d = await r.json().catch(() => ({}));
    if (d.error === 'below_cutoff') this.set({ cutoff: d.cutoff || 0, ct: Date.now() });
    else if (r.ok) this.set({ cutoff: d.cutoff || 0, ct: Date.now(), best: d.best, bt: Date.now(), ...(d.updated ? { lt: 0 } : {}) });
    return { ok: r.ok, ...d };
  },
  openList(force = false, focusRank = 0) {
    this.state = 'loading'; this.scroll = 0;
    this.fetchTop(force).then(list => {
      this.list = list; this.state = 'ok';
      if (focusRank) this.scroll = clamp(focusRank - 5, 0, Math.max(0, list.length - this.ROWS));
    }).catch(() => { this.state = 'error'; });
  },
  scrollBy(d) { this.scroll = clamp(this.scroll + d, 0, Math.max(0, this.list.length - this.ROWS)); },
  drawList(ctx) {
    const say = (text, color) => new WireText({ text, pos: [0.5, 0.45], widthRatio: Math.min(0.8, text.length * CHAR_W * 1.3), lineWidth: 0.016, color, float: false })
      .draw(ctx, W, H, 0, false);
    if (this.state === 'loading') return say('LOADING...', MENU_BLUE);
    if (this.state === 'error') return say('COULD NOT REACH THE SERVER', COL.red);
    if (!this.list.length) return say('NO SCORES YET', MENU_BLUE);
    // rows fit between the heading and BACK; letters are as large as the row pitch allows (0.3 char gap)
    const top = 0.17, bottom = 0.83, n = this.ROWS;
    const step = (bottom - top) / (n - 1);
    const rows = this.list.slice(this.scroll, this.scroll + n);
    const sample = '100  ' + 'M'.repeat(12) + '  9999999';
    const unit = Math.min(step * H / (1.3 * 80), 0.9 * W / unscaledWidth(sample), 10 * CHAR_W * 1.2 * TW / unscaledWidth('MOVE RIGHT'));
    const wOf = t => unscaledWidth(t) * unit / W;
    const gap = wOf('AA');
    const glyphH = 80 * unit;   // letter height in px
    const plainFont = `${Math.round(glyphH * 1.05)}px "Hiragino Sans","Noto Sans JP","Malgun Gothic","Microsoft YaHei",system-ui,sans-serif`;
    const nameWOf = t => { if (wireDrawable(t)) return wOf(t); ctx.font = plainFont; return ctx.measureText(t).width / W; };
    const rankW = wOf('100'), nameW = Math.max(wOf('NAME'), ...rows.map(r => nameWOf(String(r.name)))), scoreW = Math.max(...rows.map(r => wOf(String(r.score))));
    const total = rankW + gap + nameW + gap + scoreW, x0 = 0.5 - total / 2;
    const me = this.playerName().toLowerCase();
    const put = (text, x, y, color) => new WireText({ text, pos: [x, y], widthRatio: wOf(text) * W / TW, lineWidth: 0.014, color, autoCenter: false, float: false })
      .draw(ctx, W, H, 0, false);
    rows.forEach((r, i) => {
      const rank = this.scroll + i + 1, y = top + i * step;
      const color = String(r.name).toLowerCase() === me && me ? COL.yellow : (RANK_COLORS[rank - 1] || C(0, 0.9, 1));
      const rs = String(rank), ss = String(r.score);
      put(rs, x0 + rankW - wOf(rs), y, color);                       // rank: right-aligned
      const nm = String(r.name);
      if (wireDrawable(nm)) put(nm, x0 + rankW + gap, y, color);
      else {   // characters the wire font lacks (e.g. Japanese): normal font
        ctx.font = plainFont; ctx.fillStyle = css(color); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(nm, (x0 + rankW + gap) * W, y * H);
      }
      put(ss, x0 + total - wOf(ss), y, color);                       // score: right-aligned
    });
    ctx.font = `${Math.round(clamp(H * 0.028, 12, 20))}px VT323, monospace`;
    ctx.fillStyle = 'rgb(150,160,170)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const last = Math.min(this.list.length, this.scroll + n);
    ctx.fillText(`${this.scroll + 1}-${last} / ${this.list.length}` + (this.list.length > n ? '   UP/DOWN: SCROLL   LEFT/RIGHT: PAGE' : ''), W / 2, H - 6);
  },
};

// Name entry shown on game over (DOM panel). All text in English.
const ScoreUI = {
  open: false, data: null, state: '', neutral: true,
  init() {
    const $ = id => document.getElementById(id);
    this.modal = $('scoreModal'); this.title = $('scoreTitle'); this.input = $('scoreName'); this.msg = $('scoreMsg');
    this.b1 = $('scoreB1'); this.b2 = $('scoreB2');
    if (!this.modal || !this.input || !this.b1 || !this.b2) { this.modal = null; return; }   // old cached index.html: no name entry
    const tidy = () => {
      const v = cleanPlayerName(this.input.value);
      if (v !== this.input.value) this.input.value = v;
      try { if (v.trim()) localStorage.setItem(NAME_STORE, v.trim()); } catch (e) {}
    };
    this.input.addEventListener('input', e => { if (!e.isComposing) tidy(); });   // leave IME (kana-kanji) input alone until it is committed
    this.input.addEventListener('compositionend', tidy);
    this.b1.addEventListener('click', () => this.act(1));
    this.b2.addEventListener('click', () => this.act(2));
  },
  openFor(data) {
    if (!this.modal || !Online.api || data.score <= 0) return;
    this.data = data;
    const cut = Online.cutoff();
    if (data.score <= Online.best()) return this.show('info', 'GAME OVER', 'NOT HIGHER THAN YOUR BEST SCORE');
    if (cut > 0 && data.score <= cut) return this.show('info', 'GAME OVER', `DID NOT REACH 100TH PLACE (${cut})`);
    this.show('entry', 'ENTER YOUR NAME', '');
  },
  show(state, title, msg) {
    this.state = state; this.open = true; this.neutral = false;
    Input.held.clear();
    this.title.textContent = title; this.msg.textContent = msg;
    const entry = state === 'entry';
    this.input.hidden = !entry;
    if (entry && !this.input.value) this.input.value = cleanPlayerName(Online.playerName());
    const labels = { entry: ['SEND', 'SKIP'], sending: ['SEND', 'SKIP'], result: ['RANKING', 'OK'], info: ['OK', ''] }[state];
    this.b1.textContent = labels[0]; this.b2.textContent = labels[1]; this.b2.hidden = !labels[1];
    this.b1.disabled = this.b2.disabled = state === 'sending';
    this.modal.hidden = false;
    if (entry && !isMobile) this.input.focus();
    else if (state !== 'sending') this.b1.focus();
  },
  close() { this.open = false; this.modal.hidden = true; this.state = ''; hudCanvas.focus(); },
  async act(btn) {
    if (this.state === 'entry') {
      if (btn === 2) return this.close();
      const name = cleanPlayerName(this.input.value).trim();
      if (!name) { this.msg.textContent = 'ENTER A NAME'; return; }
      try { localStorage.setItem(NAME_STORE, name); } catch (e) {}
      this.show('sending', 'ENTER YOUR NAME', 'SENDING...');
      this.input.hidden = false;
      let res;
      try { res = await Online.submit(name, this.data); } catch (e) { res = { ok: false, error: 'network' }; }
      if (!this.open) return;
      if (res.error === 'below_cutoff') return this.show('info', 'GAME OVER', `DID NOT REACH 100TH PLACE (${res.cutoff || 0})`);
      if (!res.ok) {
        const E = { too_many: 'TOO MANY NAMES FROM THIS CONNECTION', too_fast: 'PLEASE WAIT A MOMENT AND TRY AGAIN',
          bad_name: 'THIS NAME CANNOT BE USED', network: 'COULD NOT REACH THE SERVER' };
        this.show('entry', 'ENTER YOUR NAME', E[res.error] || 'COULD NOT SEND THE SCORE');
        return;
      }
      this.rank = res.rank;
      this.show('result', `YOU ARE #${res.rank}!`, res.updated ? '' : `YOUR BEST IS ${res.best}`);
    } else if (this.state === 'result') {
      this.close();
      if (btn === 1) { Game.quitToTitle(); Menu.open('ranking'); Online.openList(true, this.rank); }
    } else if (this.state === 'info') this.close();
  },
  // keyboard: returns true when the key must not reach the game
  handleKey(e) {
    if (!this.open) return false;
    const c = e.code;
    if (c === 'Escape') { e.preventDefault(); if (this.state !== 'sending') this.close(); }
    else if ((c === 'Enter' || c === 'NumpadEnter') && document.activeElement === this.input) { if (!e.isComposing && e.keyCode !== 229) { e.preventDefault(); this.act(1); } }
    else if ((c === 'ArrowLeft' || c === 'ArrowRight') && document.activeElement !== this.input && !this.b2.hidden) {
      e.preventDefault(); (document.activeElement === this.b1 ? this.b2 : this.b1).focus();
    }
    return true;
  },
  pollPad() {
    if (this.state === 'sending') return;
    const x = Input.axis(0);
    if (Math.abs(x) < 0.2) this.neutral = true;
    const toggle = Input.kd('J14', 'J15') || (this.neutral && Math.abs(x) > 0.6 && !(this.neutral = false));
    if (toggle && !this.b2.hidden) (document.activeElement === this.b1 ? this.b2 : this.b1).focus();
    if (Input.kd('J0')) (document.activeElement === this.b2 ? this.b2 : this.b1).click();
    else if (Input.kd('J1')) this.close();
  },
};

// ============================================================
// Title menu and sub screens (PLAY / SETTING / RANKING / HELP) — English except HELP
// ============================================================
const Menu = {
  screen: 'title', sel: 0, slot: 0, capture: null, neutralV: true, neutralH: true, langSetting: 'auto',
  init() {
    try { const l = localStorage.getItem(LANG_STORE); if (LANG_ORDER.includes(l)) this.langSetting = l; } catch (e) {}
  },
  helpLang() { return this.langSetting === 'auto' ? detectLang() : this.langSetting; },
  langLabel() { return LANG_NAMES[this.helpLang()]; },
  // starts from the OS language; once changed, the choice is saved
  cycleLang(d) {
    const order = ['en', 'ja', 'ko', 'zh'];
    const i = order.indexOf(this.helpLang());
    this.langSetting = order[(i + d + order.length) % order.length];
    try { localStorage.setItem(LANG_STORE, this.langSetting); } catch (e) {}
  },
  open(screen, sel = 0) {
    this.screen = screen; this.sel = sel; this.slot = 0; this.capture = null;
    if (screen === 'ranking') Online.openList();
  },
  back() {
    const from = this.screen;
    if (from === 'keys' || from === 'pad') this.open('settings', from === 'keys' ? 2 : 3);
    else if (from !== 'title') this.open('title', { settings: 1, ranking: 2, help: 3 }[from] || 0);
  },
  isConfig() { return this.screen === 'keys' || this.screen === 'pad'; },
  // [label, onConfirm, onLeftRight?]
  items() {
    switch (this.screen) {
      case 'title':
        return [['PLAY', () => Game.startGame()], ['SETTING', () => this.open('settings')],
          ['RANKING', () => this.open('ranking')], ['HELP', () => this.open('help')]];
      case 'settings': {
        const it = [[`SOUND: ${Game.muted ? 'OFF' : 'ON'}`, () => Game.toggleSound(), () => Game.toggleSound()],
          [`LANGUAGE: ${this.langLabel()}`, () => this.cycleLang(1), d => this.cycleLang(d)]];
        if (!isMobile) it.push(['KEY CONFIG', () => this.open('keys')], ['CONTROLLER CONFIG', () => this.open('pad')]);
        it.push(['BACK', () => this.back()]);
        return it;
      }
      case 'keys':
      case 'pad': {
        const kind = this.screen === 'keys' ? 'key' : 'pad';
        const it = ACTIONS.map(([a, label]) => [label, () => { this.capture = { kind, action: a, slot: this.slot }; }]);
        it.push(['RESET DEFAULT', () => { kind === 'key' ? Controls.resetKeys() : Controls.resetPad(); Controls.save(); }]);
        it.push(['BACK', () => this.back()]);
        return it;
      }
      default:
        return [['BACK', () => this.back()]];
    }
  },
  // layout: centre position of each item (ratios) and row height
  layout(n) {
    switch (this.screen) {
      case 'title': return { y0: 0.50, step: 0.09 };
      case 'settings': return { y0: 0.30, step: Math.min(this.rowStep('[ CONTROLLER CONFIG ]', 21 * CHAR_W * 1.5 * 1.2 * 0.85), 0.6 / (n - 1)) };
      case 'keys': case 'pad': return { y0: 0.16, step: 80 * this.configUnit() * 1.3 / H };
      default: return { y0: 0.92, step: 0.08 };
    }
  },
  // row pitch (ratio of H) = glyph height x 1.3, i.e. 0.3 character of space between rows
  rowStep(sample, widthRatio) {
    const pxPerUnit = widthRatio * TW / unscaledWidth(sample);
    return 80 * pxPerUnit * 1.3 / H;
  },
  // key capture from the keyboard listener; returns true when the key was consumed
  captureKey(e) {
    if (!this.capture) return false;
    e.preventDefault();
    const c = this.capture;
    if (c.kind === 'key') {
      if (e.code === 'Escape' && c.action !== 'pause') this.capture = null;
      else { Controls.bindKey(c.action, c.slot, e.code); this.capture = null; }
    } else if (e.code === 'Escape') this.capture = null;
    return true;
  },
  update(click) {
    T.title.active = this.screen === 'title';
    const it = this.items();
    if (this.sel >= it.length) this.sel = it.length - 1;
    if (this.capture) {
      if (this.capture.kind === 'pad') {
        for (let i = 0; i < 18; i++) if (Input.down.has('J' + i)) { Controls.bindPad(this.capture.action, i); this.capture = null; break; }
      }
      if (click) this.capture = null;
      return;
    }
    let dv = 0, dh = 0;
    if (Input.kd('ArrowUp', 'KeyW', 'J12')) dv = -1; else if (Input.kd('ArrowDown', 'KeyS', 'J13')) dv = 1;
    if (Input.kd('ArrowLeft', 'KeyA', 'J14')) dh = -1; else if (Input.kd('ArrowRight', 'KeyD', 'J15')) dh = 1;
    const sx = Input.axis(0), sy = Input.axis(1);
    if (Math.abs(sy) < 0.2) this.neutralV = true; else if (this.neutralV && Math.abs(sy) > 0.6) { this.neutralV = false; dv = sy > 0 ? 1 : -1; }
    if (Math.abs(sx) < 0.2) this.neutralH = true; else if (this.neutralH && Math.abs(sx) > 0.6) { this.neutralH = false; dh = sx > 0 ? 1 : -1; }
    if (this.screen === 'ranking' && (dv || dh)) { Online.scrollBy(dv + dh * Online.ROWS); dv = dh = 0; }
    if (dv) { this.sel = (this.sel + dv + it.length) % it.length; Synth.move(); }
    if (dh) {
      if (this.screen === 'keys' && this.sel < ACTIONS.length) { this.slot = 1 - this.slot; Synth.move(); }
      else if (it[this.sel][2]) { it[this.sel][2](dh); Synth.move(); }
    }
    if (Input.kd('Enter', 'NumpadEnter', 'Space', 'J0')) it[this.sel][1]();
    else if (Input.kd('Escape', 'J1')) this.back();
    else if (this.screen === 'keys' && this.sel < ACTIONS.length && Input.kd('Delete', 'Backspace')) {
      Controls.keys[ACTIONS[this.sel][0]][this.slot] = null; Controls.save();
    }
    if (click) this.click(click, it);
  },
  click(p, it) {
    const { y0, step } = this.layout(it.length);
    for (let i = 0; i < it.length; i++) {
      const cy = (y0 + i * step) * H;
      if (Math.abs(p.y - cy) > step * H / 2) continue;
      if (this.isConfig() && i < ACTIONS.length) {
        const c = this.cols();
        if (p.x < c.x0 * W || p.x > c.end * W) return;
        this.sel = i;
        this.slot = this.screen === 'keys' && p.x >= c.split * W ? 1 : 0;
      } else {
        const tw = Math.max(0.3, it[i][0].length * CHAR_W * 1.8) * W;
        if (Math.abs(p.x - W / 2) > tw / 2) return;
        this.sel = i;
      }
      it[i][1]();
      return;
    }
  },
  // ---------------- drawing ----------------
  // maxStep: row pitch (ratio of H); letters are shrunk so they keep 0.3 char of space within it
  item(ctx, text, x, y, sel, scale = 1, maxStep = 0) {
    const t = new WireText({ pos: [x, y], float: false });
    Game.styleMenuItem(t, text, sel);
    t.widthRatio *= scale;
    this.fitHeight(t, maxStep ? maxStep / 1.3 : 0);
    t.draw(ctx, W, H, 0, false);
  },
  // shrink a WireText so its glyph height is at most maxH (ratio of H)
  fitHeight(t, maxH) {
    if (!maxH) return;
    const h = 80 * t.widthRatio * TW / unscaledWidth(t.text) / H;
    if (h > maxH) { const k = maxH / h; t.widthRatio *= k; t.lineWidth *= k; }
  },
  heading(ctx, text, y) {
    const t = new WireText({ text, pos: [0.5, y], widthRatio: text.length * CHAR_W * 2.2, lineWidth: 0.03, color: COL.yellow, float: false });
    this.fitHeight(t, 0.09);
    t.draw(ctx, W, H, 0, false);
  },
  draw(ctx, time) {
    const it = this.items();
    const { y0, step } = this.layout(it.length);
    if (this.screen === 'title') {
      it.forEach((m, i) => this.item(ctx, m[0], 0.5, y0 + i * step, i === this.sel, 1, step));
      return;
    }
    ctx.fillStyle = this.screen === 'help' ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    if (this.screen === 'settings') {
      this.heading(ctx, 'SETTING', 0.15);
      it.forEach((m, i) => this.item(ctx, m[0], 0.5, y0 + i * step, i === this.sel, 0.85, step));
    } else if (this.isConfig()) {
      this.heading(ctx, this.screen === 'keys' ? 'KEY CONFIG' : 'CONTROLLER CONFIG', 0.07);
      const blink = Math.floor(performance.now() / 300) % 2 === 0;
      it.forEach((m, i) => {
        const y = y0 + i * step, sel = i === this.sel;
        if (i >= ACTIONS.length) {
          const t = sel ? `[ ${m[0]} ]` : m[0];
          new WireText({ text: t, pos: [0.5, y], widthRatio: unscaledWidth(t) * this.configUnit() / TW, lineWidth: sel ? 0.022 : 0.016,
            color: sel ? COL.yellow : MENU_BLUE, float: false }).draw(ctx, W, H, 0, false);
          return;
        }
        const a = ACTIONS[i][0];
        const c = this.cols();
        this.label(ctx, m[0], c.x0, y, sel ? COL.yellow : MENU_BLUE);
        const slots = this.screen === 'keys' ? [0, 1] : [0];
        slots.forEach(s => {
          const capturing = this.capture && this.capture.action === a && this.capture.slot === s;
          let v = this.screen === 'keys' ? Controls.keyLabel(Controls.keys[a][s]) : Controls.padLabel(Controls.pad[a]);
          if (capturing) v = blink ? (this.screen === 'keys' ? 'PRESS KEY' : 'PRESS BUTTON') : '';
          const on = sel && s === this.slot;
          this.label(ctx, on ? `[${v}]` : ` ${v} `, s === 0 ? c.c1 : c.c2, y, on ? COL.yellow : C(0.85, 0.92, 1));
        });
      });
      ctx.font = `${Math.round(clamp(H * 0.028, 12, 20))}px VT323, monospace`;
      ctx.fillStyle = 'rgb(150,160,170)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(this.screen === 'keys'
        ? 'UP/DOWN: SELECT   LEFT/RIGHT: SLOT   ENTER: SET   DEL: CLEAR   ESC: BACK'
        : 'UP/DOWN: SELECT   A: SET (THEN PRESS A BUTTON)   B: BACK   ESC: CANCEL', W / 2, H - 6);
    } else if (this.screen === 'ranking') {
      this.heading(ctx, 'RANKING', 0.07);
      Online.drawList(ctx);
      this.item(ctx, 'BACK', 0.5, y0, true, 0.8, 0.1);
    } else if (this.screen === 'help') {
      this.heading(ctx, 'HELP', 0.07);
      this.drawHelp(ctx);
      this.item(ctx, 'BACK', 0.5, y0, true, 0.8, 0.1);
    }
  },
  // config table columns (ratios of W): label, gap of 3 chars, slot 1, gap, slot 2 — centred as a block
  // config table: every string is drawn at the same letter size (unit = pixels per font unit),
  // columns are as wide as their widest entry and separated by about 3 characters
  configUnit() {
    const base = 10 * CHAR_W * 0.95 * TW / unscaledWidth('MOVE RIGHT');
    const rows = ACTIONS.length + 2;                         // + RESET DEFAULT, BACK
    return Math.min(base, 0.76 * H / ((rows - 1) * 80 * 1.3)); // shrink to fit the screen height
  },
  cols() {
    const unit = this.configUnit();
    const wOf = t => unscaledWidth(t) * unit / W;            // ratio of W
    const gap = wOf('AAA');
    const keys = this.screen === 'keys';
    const labelW = Math.max(...ACTIONS.map(a => wOf(a[1])));
    const colW = s => Math.max(...ACTIONS.map(([a]) => {
      if (this.capture && this.capture.action === a && this.capture.slot === s) return wOf(keys ? '[PRESS KEY]' : '[PRESS BUTTON]');
      return wOf('[' + (keys ? Controls.keyLabel(Controls.keys[a][s]) : Controls.padLabel(Controls.pad[a])) + ']');
    }));
    const w1 = colW(0), w2 = keys ? colW(1) : 0;
    const total = labelW + gap + w1 + (keys ? gap + w2 : 0);
    const x0 = 0.5 - total / 2;
    const c1 = x0 + labelW + gap;
    const c2 = c1 + w1 + gap;
    return { x0, c1, c2, split: c2 - gap / 2, end: x0 + total };
  },
  label(ctx, text, x, y, color) {
    const unit = this.configUnit();
    new WireText({ text, pos: [x, y], widthRatio: unscaledWidth(text) * unit / TW, lineWidth: 0.016, color, autoCenter: false, float: false })
      .draw(ctx, W, H, 0, false);
  },

  drawHelp(ctx) {
    const lang = this.helpLang();
    const lines = helpLines(lang, isMobile);
    const top = 0.14 * H, bottom = 0.86 * H, maxW = Math.min(W * 0.88, 900), x0 = (W - maxW) / 2;
    const spaced = lang === 'en' || lang === 'ko';
    const wrap = (text, fs) => {
      ctx.font = `${fs}px "Hiragino Sans","Noto Sans JP","Malgun Gothic","Noto Sans KR","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif`;
      const parts = spaced ? text.split(/(\s+)/) : Array.from(text);
      const out = []; let cur = '';
      for (const p of parts) {
        if (ctx.measureText(cur + p).width > maxW && cur.trim()) { out.push(cur.trimEnd()); cur = p.trimStart(); }
        else cur += p;
      }
      out.push(cur);
      return out;
    };
    let fs = Math.round(clamp(H * 0.032, 11, 20)), rows;
    for (;;) {
      rows = [];
      for (const l of lines) {
        const head = l.startsWith('#');
        for (const w of wrap(head ? l.slice(1) : l, fs)) rows.push({ t: w, head });
      }
      if (rows.length * fs * 1.45 <= bottom - top || fs <= 9) break;
      fs--;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    rows.forEach((r, i) => {
      ctx.font = `${r.head ? 'bold ' : ''}${fs}px "Hiragino Sans","Noto Sans JP","Malgun Gothic","Noto Sans KR","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif`;
      ctx.fillStyle = r.head ? '#00ff33' : '#d9ebff';
      ctx.fillText(r.t, x0, top + i * fs * 1.45);
    });
  },
};
Menu.init();

// ============================================================
// HUD drawing (2D overlay: wireframe text + OnGUI equivalents)
// ============================================================
const isMobile = (() => {
  try { return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches; }
  catch (e) { return false; }
})();

// rectangle with chamfered (45 degree) corners = octagon
function octRect(ctx, x, y, w, h, c) {
  c = Math.min(c, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c);
  ctx.closePath();
}

function drawHUD() {
  const ctx = hud;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const time = Game.time;
  const floatOn = !Game.paused;

  // translucent black quads behind pause / game-over menus
  if (Game.paused || Game.over) { ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H); }

  if (!Game.started) T.title.active = Menu.screen === 'title';
  T.next.pos[0] = Game.nextX();
  const list = [T.title, T.next, T.start, T.over, T.score, T.planes, T.level, T.notif, T.levelUp, T.record];
  for (const t of list) t.draw(ctx, W, H, time, floatOn);
  if (Game.rankingVisible) { T.rankTitle.draw(ctx, W, H, time, floatOn); rankTexts.forEach(t => t.draw(ctx, W, H, time, floatOn)); }
  if (Game.paused) { T.pauseTitle.draw(ctx, W, H, time, floatOn); pauseItems.forEach(t => t.draw(ctx, W, H, time, floatOn)); }
  if (Game.over) overItems.forEach(t => t.draw(ctx, W, H, time, floatOn));

  if (!Game.started) Menu.draw(ctx, time);
  // controls panel while paused (PC only), generated from the current bindings
  if (Game.paused && !isMobile) {
    const P = a => Controls.padLabel(Controls.pad[a]);
    const K = a => Controls.keysText(a);
    const lines = ['CONTROLS',
      ` - ${K('moveLeft')} ${K('moveRight')} ${K('moveUp')} ${K('moveDown')} : SLIDE MOVE`,
      ` - ${K('pitchUp')}, ${K('pitchDown')} (${P('pitchUp')}, ${P('pitchDown')}) : PITCH ROTATE`,
      ` - ${K('yawLeft')}, ${K('yawRight')} (${P('yawLeft')}, ${P('yawRight')}) : YAW ROTATE`,
      ` - ${K('rollLeft')}, ${K('rollRight')} (${P('rollLeft')}, ${P('rollRight')}) : ROLL ROTATE`,
      ` - ${K('fastFall')} (${P('fastFall')}) : FAST FALL`,
      ` - ${K('hardDrop')} (${P('hardDrop')}) : HARD DROP`,
      ` - ${K('swap')} (${P('swap')}) : SWAP NEXT`];
    ctx.font = '15px VT323, monospace';
    ctx.fillStyle = 'rgb(217,235,255)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const y0 = H - 220 - 15 + 10;
    lines.forEach((l, i) => ctx.fillText(l, 25 + 3, y0 + 3 + i * 22));
  }
  if (Game.started) {
    ctx.font = '12px VT323, monospace';
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('HTML5', W - 13, H - 13);
  }
  if (isMobile && Game.started && !Game.over && !Game.paused) drawTouchControls(ctx);
}

function drawPortraitControls(ctx) {
  const R = Game.rects;
  const bw = Math.max(2, Math.round(Math.min(W, H) * 0.006));
  const col = 'rgba(153,191,217,0.45)', fill = 'rgba(153,191,217,0.12)';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = bw; ctx.strokeStyle = col;
  // triangles of the two pads (inset toward their centroid so the X shows as a gap)
  for (const n of ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'rotUp', 'rotDown', 'rotLeft', 'rotRight']) {
    const t = R[n], h = t.half, x0 = t.cx - h, x1 = t.cx + h, y0 = t.cy - h, y1 = t.cy + h;
    const pts = { up: [[x0, y0], [x1, y0], [t.cx, t.cy]], down: [[x0, y1], [x1, y1], [t.cx, t.cy]],
      left: [[x0, y0], [x0, y1], [t.cx, t.cy]], right: [[x1, y0], [x1, y1], [t.cx, t.cy]] }[t.dir];
    const gx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, gy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    ctx.beginPath();
    pts.forEach(([px, py], i) => { const x = gx + (px - gx) * 0.84, y = gy + (py - gy) * 0.84; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
    if (Game.touchActive[n]) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.stroke();
  }
  const box = (n, r) => {
    const inset = bw;
    octRect(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, Math.min(r.h * 0.25, 14));
    if (Game.touchActive[n]) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.stroke();
  };
  // DROP
  box('space', R.space);
  new WireText({ text: 'DROP', pos: [(R.space.x + R.space.w / 2) / W, (R.space.y + R.space.h / 2) / H],
    widthRatio: Math.min(R.space.w * 0.5, R.space.h * 1.9) / TW, lineWidth: 0.02, color: C(0.6, 0.75, 0.85, 0.8), float: false })
    .draw(ctx, W, H, 0, false);
  // roll buttons: counter-clockwise (rollLeft) and clockwise (rollRight) arrows
  for (const [n, cw] of [['rollLeft', false], ['rollRight', true]]) {
    const r = R[n];
    box(n, r);
    // arrow drawn along an octagon: 6 of its 8 sides, starting just past the top, arrowhead at the end
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.min(r.w, r.h) * 0.28;
    const dir = cw ? 1 : -1, step = dir * Math.PI / 4;
    const a0 = -Math.PI / 2 + dir * Math.PI / 8;              // octagon vertex next to the top
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = a0 + i * step; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    const [ex, ey] = pts[6], [px, py] = pts[5];
    const len = Math.hypot(ex - px, ey - py), tx = (ex - px) / len, ty = (ey - py) / len;   // direction of travel at the end
    const ah = rad * 0.55, nx = -ty, ny = tx;
    ctx.beginPath();
    ctx.moveTo(ex - tx * ah + nx * ah * 0.6, ey - ty * ah + ny * ah * 0.6);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - tx * ah - nx * ah * 0.6, ey - ty * ah - ny * ah * 0.6);
    ctx.stroke();
  }
}

function drawTouchControls(ctx) {
  if (Game.portrait) return drawPortraitControls(ctx);
  const btnSize = (W / 3) * 0.28;
  const bw = Math.max(2, Math.floor(btnSize * 0.025));
  const cr = Math.max(15, Math.floor(btnSize * 0.20));
  const col = 'rgba(153,191,217,0.25)';
  const fill = 'rgba(153,191,217,0.0375)';
  const names = ['moveUp', 'moveLeft', 'moveRight', 'moveDown', 'rollLeft', 'rotUp', 'rollRight', 'rotLeft', 'rotRight', 'rotDown', 'space'];
  for (const n of names) {
    const r = Game.rects[n];
    const nh = r.h * 0.8, dh = r.h - nh;
    const nw = n === 'space' ? r.w - dh : r.w * 0.8;
    const x = r.x + (r.w - nw) / 2, y = r.y + (r.h - nh) / 2;
    octRect(ctx, x + bw / 2, y + bw / 2, nw - bw, nh - bw, cr * 0.7);
    if (Game.touchActive[n]) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = bw; ctx.stroke();
  }
}

// ============================================================
// App list button (title screen, top-right) + confirm dialog
// ==============================================================
const APPS_ICON = [
  '......###...###.',
  '.....#...#.#...#',
  '.....#...#.#...#',
  '.....#..#..#..#.',
  '.....#..#..#..#.',
  '....##..####..#.',
  '..##.......#..#.',
  '.#............#.',
  '#.............#.',
  '#..............#',
  '############...#',
  '............#..#',
  '.###########...#',
  '.#............#.',
  '..##........##..',
  '....########....'
];
const APPS_URL = 'https://daisuqe.github.io/';
const AppNav = {
  open: false, neutral: true,
  init() {
    this.screen = document.getElementById('startScreen');
    this.btn = document.getElementById('appsBtn');
    this.modal = document.getElementById('appsModal');
    this.yes = document.getElementById('appsYes');
    this.no = document.getElementById('appsNo');
    // icon drawn from text data in the UI green
    const ctx = document.getElementById('appsIcon').getContext('2d');
    ctx.fillStyle = css(GREEN);
    APPS_ICON.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') ctx.fillRect(x, y, 1, 1); });
    // ?lang=ja / ?lang=en overrides the browser language (for checking)
    const lang = new URLSearchParams(location.search).get('lang') || navigator.language || '';
    const ja = /^ja\b/i.test(lang);
    document.getElementById('appsMsg').textContent = ja
      ? 'アプリ一覧に移動します。\nこのゲームを離れますがよろしいですか？'
      : 'This will take you to the app list.\nDo you want to leave this game?';
    this.btn.addEventListener('click', () => this.show());
    this.yes.addEventListener('click', () => { location.href = APPS_URL; });
    this.no.addEventListener('click', () => this.hide());
    this.modal.addEventListener('pointerdown', e => { if (e.target === this.modal) { e.preventDefault(); this.hide(); } });
    this.modal.addEventListener('mousedown', e => { if (e.target === this.modal) e.preventDefault(); });
    for (const b of [this.yes, this.no]) {
      b.addEventListener('focus', () => { this.yes.classList.toggle('sel', b === this.yes); this.no.classList.toggle('sel', b === this.no); });
    }
  },
  show() {
    this.open = true;
    this.neutral = false;
    Input.held.clear();
    this.modal.hidden = false;
    this.no.focus();
  },
  hide() {
    this.open = false;
    this.modal.hidden = true;
    this.btn.focus();
  },
  toggleSel() { (document.activeElement === this.yes ? this.no : this.yes).focus(); },
  // keyboard: returns true when the key must not reach the game
  handleKey(e) {
    if (this.open) {
      const c = e.code;
      if (c === 'Escape') { e.preventDefault(); this.hide(); }
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(c)) { e.preventDefault(); this.toggleSel(); }
      else if (c === 'Tab') { e.preventDefault(); this.toggleSel(); }
      // Enter / Space fall through to the focused button's native activation
      return true;
    }
    if (document.activeElement === this.btn && ['Enter', 'NumpadEnter', 'Space'].includes(e.code)) return true;
    return false;
  },
  // gamepad, same scheme as the game's menus (up/down or left/right moves, A = decide, B = No)
  pollPad() {
    if (Input.kd('J12', 'J13', 'J14', 'J15')) this.toggleSel();
    const x = Input.axis(0), y = Input.axis(1);
    const m = Math.max(Math.abs(x), Math.abs(y));
    if (m < 0.2) this.neutral = true;
    else if (m > 0.6 && this.neutral) { this.neutral = false; this.toggleSel(); }
    if (Input.kd('J0')) document.activeElement === this.yes ? this.yes.click() : this.hide();
    else if (Input.kd('J1')) this.hide();
  },
  update() {
    const hide = Game.started || Menu.screen !== 'title';
    if (this.screen.hidden !== hide) {
      if (hide && document.activeElement === this.btn) hudCanvas.focus();
      this.screen.hidden = hide;
    }
  },
};

// ============================================================
// Resize / main loop
// ============================================================
function resize() {
  W = window.innerWidth; H = window.innerHeight; DPR = Math.min(window.devicePixelRatio || 1, 2);
  TW = textBasis();
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  hudCanvas.width = Math.round(W * DPR); hudCanvas.height = Math.round(H * DPR);
  camera.aspect = W / H;
  Game.recalcRects();
  if (Game.viewShift) camera.setViewOffset(W, H, 0, Game.viewShift, W, H); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  for (const m of lineMats.values()) updateLineMat(m);
  Stars.mat.uniforms.uScale.value = (H * DPR) / (2 * TANH);
}
window.addEventListener('resize', resize);

Input.init(hudCanvas);
hudCanvas.addEventListener('wheel', e => {
  if (!Game.started && Menu.screen === 'ranking') { e.preventDefault(); Online.scrollBy(Math.sign(e.deltaY) * 3); }
}, { passive: false });
{
  let dragY = null;
  hudCanvas.addEventListener('pointerdown', e => { dragY = !Game.started && Menu.screen === 'ranking' ? e.clientY : null; });
  hudCanvas.addEventListener('pointermove', e => {
    if (dragY === null) return;
    const rowPx = H * 0.66 / (Online.ROWS - 1);
    const d = Math.trunc((dragY - e.clientY) / rowPx);
    if (d) { Online.scrollBy(d); dragY -= d * rowPx; }
  });
  const end = () => { dragY = null; };
  hudCanvas.addEventListener('pointerup', end); hudCanvas.addEventListener('pointercancel', end);
}
AppNav.init();
ScoreUI.init();
resize();
Game.init();
hudCanvas.focus();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  Input.poll();

  const sdt = Game.paused ? 0 : dt;   // Time.timeScale
  Game.time += sdt;

  if (AppNav.open) AppNav.pollPad();
  else if (ScoreUI.open) ScoreUI.pollPad();
  else {
    Game.update(sdt);
    if (Game.skipBlockFrame) Game.skipBlockFrame = false;
    else if (Game.active && !Game.paused && !Game.over && Game.started) Game.active.update(sdt);
  }
  AppNav.update();
  Sched.update(sdt);

  for (const u of [...animUnits]) u.animate(sdt);
  updateShards(sdt);
  Stars.update(sdt, Game.level);
  CameraCtl.update(sdt);
  Game.updatePreviewTransform();
  Synth.update(dt);

  renderer.render(scene, camera);
  drawHUD();
  Input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

})();
