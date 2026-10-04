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
    const s = this.widthRatio * W / uw;           // pixels per font unit
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
    ctx.lineWidth = Math.max(0.75, this.lineWidth * LINE_PX * H);
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
const CLIPS = ['bgm_slow', 'bgm_gameover', 'sfx_clear_1', 'sfx_clear_2', 'sfx_clear_3', 'sfx_clear_4',
  'sfx_lock', 'sfx_move', 'sfx_rotate', 'sfx_swap', 'sfx_fall'];

class SoundSystem {
  constructor() { this.mode = null; this.buffers = {}; this.html = {}; this.muted = false; }
  init() {
    if (this.mode) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && location.protocol !== 'file:') {
      this.mode = 'wa';
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
      for (const n of CLIPS) {
        fetch('audio/' + n + '.wav').then(r => r.arrayBuffer())
          .then(b => new Promise((ok, ng) => this.ctx.decodeAudioData(b, ok, ng)))
          .then(buf => { this.buffers[n] = buf; })
          .catch(() => {});
      }
    } else {
      // file:// fallback: HTMLAudioElement
      this.mode = 'html';
      for (const n of CLIPS) {
        const a = new Audio('audio/' + n + '.wav');
        a.preload = 'auto';
        this.html[n] = a;
      }
    }
  }
  oneShot(name, vol) {
    if (this.muted || !this.mode) return;
    if (this.mode === 'wa') {
      const b = this.buffers[name]; if (!b) return;
      const src = this.ctx.createBufferSource(); src.buffer = b;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(g); g.connect(this.out); src.start();
    } else {
      const a = this.html[name]; if (!a) return;
      const c = a.cloneNode(); c.volume = clamp01(vol); c.play().catch(() => {});
    }
  }
}

class LoopPlayer {
  constructor(snd) { this.snd = snd; this.playing = false; this.started = false; this.vol = 0; this.rate = 1; }
  play(clip) { this.stop(); this.clip = clip; this.playing = true; }
  stop() {
    this.playing = false; this.started = false;
    if (this.node) { try { this.node.stop(); } catch (e) {} this.node.disconnect(); this.node = null; }
    if (this.el) { this.el.pause(); this.el = null; }
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
      } else if (s.mode === 'html') {
        const src = s.html[this.clip]; if (!src) return;
        this.el = src.cloneNode(); this.el.loop = true;
        this.el.preservesPitch = this.el.mozPreservesPitch = this.el.webkitPreservesPitch = false;
        this.el.play().catch(() => {});
      } else return;
      this.started = true;
    }
    const v = s.muted ? 0 : this.vol;
    if (this.node) { this.gain.gain.value = v; this.node.playbackRate.value = this.rate; }
    if (this.el) { this.el.volume = clamp01(v); this.el.playbackRate = this.rate; }
  }
}

const Synth = {
  snd: new SoundSystem(),
  master: 1.0,
  level: 1,
  isPlayingBGM: false,
  isFastDropping: false,
  fade: null,
  init() { this.bgm = new LoopPlayer(this.snd); this.fall = new LoopPlayer(this.snd); },
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
  lock() { this.snd.oneShot('sfx_lock', this.master * 1.1); },
  move() { this.snd.oneShot('sfx_move', this.master); },
  rotate() { this.snd.oneShot('sfx_rotate', this.master * 0.3); },
  setFastDropping(b) { this.isFastDropping = b; },
  update(dt) {
    if (this.fade) {
      this.fade.t += dt;
      this.bgm.vol = lerp(this.fade.from, this.fade.to, clamp01(this.fade.t / this.fade.dur));
      if (this.fade.t >= this.fade.dur) this.fade = null;
    }
    let target = 0;
    if (this.isFastDropping && !this.snd.muted && this.isPlayingBGM) {
      if (!this.fall.playing) { this.fall.play('sfx_fall'); this.fall.vol = 0; }
      target = this.master * 0.45;
    }
    const d = dt * 6.0;
    this.fall.vol = Math.abs(target - this.fall.vol) <= d ? target : this.fall.vol + Math.sign(target - this.fall.vol) * d;
    if (this.fall.vol <= 0.001 && this.fall.playing) this.fall.stop();
    this.bgm.update(); this.fall.update();
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
  touches: new Map(),        // id -> {x, y}  (touch pointers currently held)
  init(el) {
    const keyName = e => (e.key === '+' ? 'Plus' : e.code);
    window.addEventListener('keydown', e => {
      Synth.snd.init();
      const k = keyName(e);
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.held.has(k)) this.down.add(k);
      this.held.add(k);
      if (e.code === 'NumpadAdd' && k !== 'NumpadAdd') { this.down.add('NumpadAdd'); this.held.add('NumpadAdd'); }
    });
    window.addEventListener('keyup', e => {
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
      if (e.pointerType === 'touch') this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      CameraCtl.pointerDown(e);
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      CameraCtl.pointerMove(e);
    });
    const end = e => { this.touches.delete(e.pointerId); CameraCtl.pointerUp(e); };
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
  endFrame() { this.down.clear(); this.up.clear(); this.pointerDowns.length = 0; },
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
// three.js setup
// ============================================================
const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const hud = hudCanvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight, DPR = Math.min(window.devicePixelRatio || 1, 2);

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
    const ltPressed = Input.kd('NumpadAdd', 'Plus', 'Tab', 'Numpad1', 'Digit1', 'KeyC', 'KeyE', 'J6', 'J8');
    let ltAxis = false;
    if (Input.btnVal(6) > 0.5) { if (!this.ltPrev) ltAxis = true; this.ltPrev = true; } else this.ltPrev = false;
    if ((ltPressed || ltAxis) && Game.canSwap()) { Game.swapWithNextBlock(); return true; }

    const md = this.slideInput();
    if (md && this.tryMove(md)) this.sync();

    let axis = null;
    if (Input.kd('KeyU', 'J4', 'Numpad7')) axis = AX.forward;
    else if (Input.kd('KeyO', 'J5', 'Numpad9')) axis = AX.back;
    else if (Input.kd('KeyI', 'J3', 'Numpad8')) axis = AX.right;
    else if (Input.kd('KeyK', 'J0', 'Numpad2')) axis = AX.left;
    else if (Input.kd('KeyJ', 'J2', 'Numpad4')) axis = AX.up;
    else if (Input.kd('KeyL', 'J1', 'Numpad6')) axis = AX.down;
    if (axis) { this.tryRotate(axis); this.sync(); }

    if (Input.kd('ShiftLeft', 'ShiftRight', 'Enter', 'NumpadEnter')) { this.hardDrop(); return true; }
    return false;
  }
  slideInput() {
    if (Input.kd('KeyA', 'ArrowLeft')) { this.neutralX = false; return { x: -1, y: 0, z: 0 }; }
    if (Input.kd('KeyD', 'ArrowRight')) { this.neutralX = false; return { x: 1, y: 0, z: 0 }; }
    if (Input.kd('KeyW', 'ArrowUp')) { this.neutralY = false; return { x: 0, y: 1, z: 0 }; }
    if (Input.kd('KeyS', 'ArrowDown')) { this.neutralY = false; return { x: 0, y: -1, z: 0 }; }
    let md = null;
    const h = Input.horizontal(), v = Input.vertical(), dx = Input.dpadX(), dy = Input.dpadY();
    const ch = Math.abs(h) > Math.abs(dx) ? h : dx;
    const cv = Math.abs(v) > Math.abs(dy) ? v : dy;
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
    const rt = Input.btnVal(7) > 0.3;
    const fast = Input.kh('Space', 'Numpad3', 'Digit3') || this.externalFastDrop || rt;
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
    if (this.drag === null && Game.isInDragZone(e.clientX, e.clientY)) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
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
  pressA: new WireText({ text: 'CLICK OR PRESS [A] TO START', pos: [0.5, 0.52], widthRatio: 0.55, lineWidth: 0.021, color: C(1, 0.9, 0) }),
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
  },

  startGame() {
    this.score = 0; this.lines = 0; this.level = 1;
    this.over = false; this.paused = false; this.started = true;
    T.pressA.active = false;
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
    T.title.active = true; T.pressA.active = true;
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
  updatePreviewTransform() {
    if (!this.preview) return;
    const halfH = 4 * TANH, halfW = halfH * (W / H);
    this.preview.group.position.set((2 * 0.86 - 1) * halfW, (1 - 2 * 0.08) * halfH - 0.38, -4);
  },

  addScore(p) {
    if (this.over || !this.started) return;
    this.score += p;
    setHUD(T.score, 'SCORE ' + this.score, 1.2, true);
  },

  onBlockLocked() {
    this.active = null;
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
    this.touchActive = {};
  },
  isInDragZone(x, y) {
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
  processTouch() {
    this.touchActive = {};
    if (!this.started || this.over || this.paused) return;
    const order = ['moveLeft', 'moveRight', 'moveUp', 'moveDown', 'rotUp', 'rotDown', 'rotLeft', 'rotRight', 'rollLeft', 'rollRight', 'swap'];
    for (const pd of Input.pointerDowns) {
      if (pd.type !== 'touch') continue;
      const p = { x: pd.x, y: pd.y };
      for (const n of order) if (this.rects[n].contains(p)) { this.touchAction(n); break; }
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

    if (!this.started) {
      T.pressA.active = Math.floor(this.time * 2.5) % 2 === 0;
      if (Input.kd('J0', 'J1', 'Enter', 'NumpadEnter', 'Space') || click) this.startGame();
      return;
    }

    if (Input.kd('Escape', 'J9') && !this.over) { this.togglePause(); return; }
    if (this.paused) { this.handlePauseInput(); return; }

    if (this.over) {
      this.handleOverInput();
      if (this.over && this.lastRank !== -1) rankTexts[this.lastRank].active = Math.floor(this.time * 5) % 2 === 0;
      return;
    }

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
// HUD drawing (2D overlay: wireframe text + OnGUI equivalents)
// ============================================================
const isMobile = (() => {
  try { return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches; }
  catch (e) { return false; }
})();

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawHUD() {
  const ctx = hud;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const time = Game.time;
  const floatOn = !Game.paused;

  // translucent black quads behind pause / game-over menus
  if (Game.paused || Game.over) { ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H); }

  const list = [T.title, T.next, T.start, T.over, T.pressA, T.score, T.planes, T.level, T.notif, T.levelUp, T.record];
  for (const t of list) t.draw(ctx, W, H, time, floatOn);
  if (Game.rankingVisible) { T.rankTitle.draw(ctx, W, H, time, floatOn); rankTexts.forEach(t => t.draw(ctx, W, H, time, floatOn)); }
  if (Game.paused) { T.pauseTitle.draw(ctx, W, H, time, floatOn); pauseItems.forEach(t => t.draw(ctx, W, H, time, floatOn)); }
  if (Game.over) overItems.forEach(t => t.draw(ctx, W, H, time, floatOn));

  // OnGUI
  if (!Game.started) {
    ctx.font = '26px VT323, monospace';
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Keyboard: Press [Enter] or [Space] to Start', W / 2, H * 0.81 + 45);
  }
  if (!Game.started || Game.paused) {
    const lines = ['CONTROLS', ' - AWSD / D-PAD : SLIDE MOVE', ' - I / K (Y / A) : PITCH ROTATE (U/D)', ' - J / L (X / B) : YAW ROTATE (L/R)',
      ' - U / O (LB / RB) : ROLL ROTATE (L/R)', ' - SPACE (RT) : FAST FALL', ' - SHIFT/ENTER (ZL) : HARD DROP', ' - LT / C / TAB / E : SWAP NEXT'];
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

function drawTouchControls(ctx) {
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
    roundRect(ctx, x + bw / 2, y + bw / 2, nw - bw, nh - bw, cr);
    if (Game.touchActive[n]) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = bw; ctx.stroke();
  }
}

// ============================================================
// Resize / main loop
// ============================================================
function resize() {
  W = window.innerWidth; H = window.innerHeight; DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  hudCanvas.width = Math.round(W * DPR); hudCanvas.height = Math.round(H * DPR);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  for (const m of lineMats.values()) updateLineMat(m);
  Stars.mat.uniforms.uScale.value = (H * DPR) / (2 * TANH);
  Game.recalcRects();
}
window.addEventListener('resize', resize);

Input.init(hudCanvas);
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

  Game.update(sdt);
  if (Game.active && !Game.paused && !Game.over && Game.started) Game.active.update(sdt);
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
