// Procedurally generated pixel art: the Strikeblaster, its bolt-on weapons, bullets, pickups, explosions.
import { SB, RAMPS, makeCanvas, tinted, RGB, fbm, RampName } from '../engine/gfx';

export type Spr = HTMLCanvasElement;
export const S: Record<string, Spr> = {};
export const SF: Record<string, Spr[]> = {}; // animated frames
export const FLASH = new WeakMap<Spr, Spr>();
export function flashOf(s: Spr) {
  let f = FLASH.get(s);
  if (!f) { f = tinted(s, '#ffffff'); FLASH.set(s, f); }
  return f;
}

// ---------- shape description used by enemies & bosses ----------
export type Shape =
  | { t: 'ell'; x: number; y: number; rx: number; ry: number; r: RampName; bias?: number; z?: number; spec?: boolean }
  | { t: 'box'; x: number; y: number; w: number; h: number; r: RampName; bevel?: number; bias?: number; z?: number }
  | { t: 'cyl'; x: number; y: number; w: number; h: number; r: RampName; vert?: boolean; z?: number; bias?: number }
  | { t: 'poly'; p: number[]; r: RampName; l?: number; z?: number }
  | { t: 'eye'; x: number; y: number; rad: number; lx?: number; ly?: number; iris?: RampName; z?: number }
  | { t: 'ribs'; x: number; y: number; w: number; h: number; n: number; r: RampName; z?: number }
  | { t: 'spikes'; x: number; y: number; rad: number; n: number; len: number; r: RampName; z?: number; a0?: number }
  | { t: 'line'; x0: number; y0: number; x1: number; y1: number; c: string; z?: number }
  | { t: 'tex'; x: number; y: number; rx: number; ry: number; r: RampName; seed: number; z?: number };

/** Render shapes into a canvas of (w,h); shape coords are relative to the canvas centre. */
export function renderShapes(w: number, h: number, shapes: Shape[], sym = false): Spr {
  const b = new SB(w, h);
  const cx = w / 2, cy = h / 2;
  for (const s of shapes) {
    switch (s.t) {
      case 'ell': b.ell(cx + s.x, cy + s.y, s.rx, s.ry, RAMPS[s.r], { z: s.z ?? 0, bias: s.bias, spec: s.spec }); break;
      case 'box': b.box(Math.round(cx + s.x - s.w / 2), Math.round(cy + s.y - s.h / 2), s.w, s.h, RAMPS[s.r], { z: s.z ?? 0, bevel: s.bevel, bias: s.bias }); break;
      case 'cyl': b.cyl(Math.round(cx + s.x - s.w / 2), Math.round(cy + s.y - s.h / 2), s.w, s.h, RAMPS[s.r], s.vert ?? true, s.z ?? 0, s.bias ?? 0); break;
      case 'poly': b.poly(s.p.map((v, i) => v + (i % 2 ? cy : cx)), RAMPS[s.r], s.l ?? 0.6, s.z ?? 0); break;
      case 'eye': b.eye(cx + s.x, cy + s.y, s.rad, s.lx ?? 0, s.ly ?? 0.3, s.iris ? RAMPS[s.iris] : RAMPS.eye, s.z ?? 20); break;
      case 'ribs':
        for (let i = 0; i < s.n; i++) {
          const yy = cy + s.y - s.h / 2 + (i + 0.5) * (s.h / s.n);
          b.cyl(Math.round(cx + s.x - s.w / 2), Math.round(yy - 1.5), s.w, 3, RAMPS[s.r], false, (s.z ?? 0) + 3);
        }
        break;
      case 'spikes':
        for (let i = 0; i < s.n; i++) {
          const a = (s.a0 ?? 0) + (i / s.n) * Math.PI * 2;
          const bx = cx + s.x + Math.cos(a) * s.rad, by = cy + s.y + Math.sin(a) * s.rad;
          const tx = cx + s.x + Math.cos(a) * (s.rad + s.len), ty = cy + s.y + Math.sin(a) * (s.rad + s.len);
          const px = -Math.sin(a) * 2.5, py = Math.cos(a) * 2.5;
          b.poly([bx + px, by + py, tx, ty, bx - px, by - py], RAMPS[s.r], 0.7, s.z ?? -5);
        }
        break;
      case 'line': {
        const c = parseInt(s.c.slice(1), 16);
        b.line(cx + s.x0, cy + s.y0, cx + s.x1, cy + s.y1, [(c >> 16) & 255, (c >> 8) & 255, c & 255], s.z ?? 50);
        break;
      }
      case 'tex': {
        const r = RAMPS[s.r];
        for (let y = Math.floor(cy + s.y - s.ry); y <= cy + s.y + s.ry; y++)
          for (let x = Math.floor(cx + s.x - s.rx); x <= cx + s.x + s.rx; x++) {
            const nx = (x - cx - s.x) / s.rx, ny = (y - cy - s.y) / s.ry;
            const d = nx * nx + ny * ny;
            if (d > 1) continue;
            const n = fbm(x * 0.18, y * 0.18, s.seed);
            const l = 0.2 + 0.6 * Math.sqrt(1 - d) * (0.6 - nx * 0.3 - ny * 0.3) + (n - 0.5) * 0.7;
            // texture is an overlay: it paints over what is already there, later shapes still stack on top
            const zi = y * b.w + x;
            const under = x >= 0 && y >= 0 && x < b.w && y < b.h && b.z[zi] > -1e8 ? b.z[zi] + 0.5 : (s.z ?? 0);
            b.px(x, y, b.shadeCol(r, Math.max(0, Math.min(1, l)), x, y), under);
          }
        break;
      }
    }
  }
  if (sym) b.mirrorX();
  b.rim();
  b.outline();
  return b.canvas();
}

// ---------- ship ----------
/** Strikeblaster hull for a bank value b in -2..2 (negative = rolling left). */
function shipShapes(b: number): Shape[] {
  const lt = -14 + Math.max(0, b) * 3, rt = 14 - Math.max(0, -b) * 3; // wing tips foreshorten as the ship rolls
  const lb = 0.08 * b, rb = -0.08 * b;
  const ox = b * 0.6;
  return [
    // wings
    { t: 'poly', p: [ox, -5, lt, 8, lt, 12, ox - 3, 10], r: 'metal', l: 0.72 + lb, z: -2 },
    { t: 'poly', p: [ox, -5, rt, 8, rt, 12, ox + 3, 10], r: 'metal', l: 0.72 + rb, z: -2 },
    { t: 'poly', p: [lt, 8, lt - 1, 2, lt + 2, 4, lt + 2, 9], r: 'red', l: 0.85 + lb, z: -1 },
    { t: 'poly', p: [rt, 8, rt + 1, 2, rt - 2, 4, rt - 2, 9], r: 'red', l: 0.85 + rb, z: -1 },
    { t: 'line', x0: lt + 3, y0: 9, x1: ox - 4, y1: 3, c: '#334466', z: 0 },
    { t: 'line', x0: rt - 3, y0: 9, x1: ox + 4, y1: 3, c: '#334466', z: 0 },
    // engine nacelles
    { t: 'cyl', x: ox - 6, y: 9, w: 5, h: 11, r: 'steel', z: 3, bias: lb },
    { t: 'cyl', x: ox + 6, y: 9, w: 5, h: 11, r: 'steel', z: 3, bias: rb },
    { t: 'ell', x: ox - 6, y: 14, rx: 2, ry: 1.5, r: 'orange', z: 9, spec: true },
    { t: 'ell', x: ox + 6, y: 14, rx: 2, ry: 1.5, r: 'orange', z: 9, spec: true },
    // fuselage
    { t: 'ell', x: ox, y: 1, rx: 5.5, ry: 14, r: 'metal', bias: 0.04, z: 6 },
    { t: 'box', x: ox, y: 6, w: 3, h: 10, r: 'steel', z: 12, bevel: 1 },
    { t: 'line', x0: ox - 3, y0: -6, x1: ox - 3, y1: 9, c: '#223355', z: 30 },
    { t: 'line', x0: ox + 3, y0: -6, x1: ox + 3, y1: 9, c: '#223355', z: 30 },
    { t: 'line', x0: ox - 4, y0: 3, x1: ox + 4, y1: 3, c: '#223355', z: 30 },
    // canopy with reflection
    { t: 'ell', x: ox + b * 0.3, y: -5, rx: 2.8, ry: 5, r: 'cyan', spec: true, z: 18 },
    { t: 'line', x0: ox - 1, y0: -8, x1: ox - 1, y1: -5, c: '#ffffff', z: 40 },
    { t: 'cyl', x: ox, y: -14, w: 2, h: 5, r: 'steel', z: 8 },
  ];
}

function buildShip() {
  SF.ship = [-2, -1, 0, 1, 2].map((b) => renderShapes(30, 34, shipShapes(b)));
  S.ship = SF.ship[2];
  S.shipIcon = renderShapes(10, 12, [
    { t: 'poly', p: [0, -2, -5, 3, -5, 5, 0, 4], r: 'metal', l: 0.8 },
    { t: 'ell', x: 0, y: 0, rx: 2, ry: 5, r: 'metal', z: 3 },
    { t: 'ell', x: 0, y: -1, rx: 1, ry: 2, r: 'cyan', z: 6 },
  ], true);
  // attachments (drawn centred at given offsets)
  S.att_nose = renderShapes(8, 12, [{ t: 'cyl', x: 0, y: 0, w: 4, h: 9, r: 'gold' }, { t: 'box', x: 0, y: 4, w: 6, h: 3, r: 'steel', bevel: 1 }]);
  S.att_laser = renderShapes(6, 14, [{ t: 'cyl', x: 0, y: 1, w: 2, h: 10, r: 'cyan' }, { t: 'ell', x: 0, y: -4, rx: 1.5, ry: 1.5, r: 'cyan', spec: true, z: 5 }]);
  S.att_cannon = renderShapes(12, 16, [{ t: 'cyl', x: 0, y: 0, w: 6, h: 12, r: 'gold' }, { t: 'box', x: 0, y: 4, w: 10, h: 5, r: 'orange', bevel: 1, z: 2 }, { t: 'box', x: 0, y: -5, w: 8, h: 2, r: 'steel', bevel: 1, z: 3 }]);
  S.att_spread = renderShapes(10, 10, [{ t: 'poly', p: [-4, 3, 0, -4, 3, 3], r: 'purple', l: 0.8 }, { t: 'cyl', x: 0, y: -2, w: 2, h: 5, r: 'steel', z: 3 }]);
  S.att_side = renderShapes(14, 8, [{ t: 'cyl', x: 0, y: 0, w: 12, h: 5, r: 'steel', vert: false }, { t: 'ell', x: 0, y: 0, rx: 3.5, ry: 3.5, r: 'red', z: 4 }]);
  S.att_rear = renderShapes(6, 10, [{ t: 'cyl', x: 0, y: 1, w: 3, h: 8, r: 'steel' }, { t: 'box', x: 0, y: -2, w: 5, h: 3, r: 'gold', bevel: 1, z: 2 }]);
  S.att_wing = renderShapes(10, 14, [{ t: 'ell', x: 0, y: 2, rx: 4, ry: 6, r: 'gold' }, { t: 'cyl', x: 0, y: -4, w: 2, h: 6, r: 'steel', z: 4 }]);
  S.att_homing = renderShapes(10, 10, [
    { t: 'cyl', x: -3, y: 0, w: 2, h: 8, r: 'red' }, { t: 'cyl', x: 0, y: 0, w: 2, h: 8, r: 'red' }, { t: 'cyl', x: 3, y: 0, w: 2, h: 8, r: 'red' },
    { t: 'box', x: 0, y: 3, w: 9, h: 3, r: 'steel', bevel: 1, z: 4 },
  ]);
  S.att_flamer = renderShapes(8, 8, [{ t: 'cyl', x: 0, y: 0, w: 4, h: 6, r: 'orange' }, { t: 'box', x: 0, y: 2, w: 6, h: 2, r: 'steel', bevel: 1, z: 2 }]);
  S.att_mines = renderShapes(10, 8, [{ t: 'box', x: 0, y: 0, w: 9, h: 6, r: 'green', bevel: 1 }, { t: 'ell', x: 0, y: 1, rx: 2, ry: 2, r: 'yellow', z: 5 }]);
  S.att_twister = renderShapes(10, 10, [{ t: 'ell', x: 0, y: 0, rx: 4.5, ry: 4.5, r: 'purple' }, { t: 'spikes', x: 0, y: 0, rad: 3, n: 4, len: 2, r: 'cyan', z: 6 }]);
  S.att_armour = renderShapes(6, 14, [{ t: 'box', x: 0, y: 0, w: 4, h: 12, r: 'steel', bevel: 1 }]);
  S.att_engine = renderShapes(8, 8, [{ t: 'cyl', x: 0, y: 0, w: 6, h: 6, r: 'orange' }]);
  S.drone = renderShapes(14, 14, [{ t: 'ell', x: 0, y: 0, rx: 5, ry: 5, r: 'chrome', spec: true }, { t: 'spikes', x: 0, y: 0, rad: 4, n: 3, len: 3, r: 'steel', a0: -Math.PI / 2 }, { t: 'ell', x: 0, y: 0, rx: 2, ry: 2, r: 'red', z: 10 }]);
  SF.ball = [0, 1, 2, 3].map((k) => {
    const b = new SB(14, 14);
    b.ell(7, 7, 5.5, 5.5, RAMPS.cyan, { spec: true, bias: 0.1 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + k * 0.4;
      b.line(7, 7, 7 + Math.cos(a) * 7, 7 + Math.sin(a) * 7, [255, 255, 255], 30);
    }
    return b.canvas();
  });
  // engine flames
  SF.flame = [0, 1, 2].map((k) => {
    const b = new SB(6, 12);
    const len = 6 + k * 2;
    for (let y = 0; y < len; y++) for (let x = 0; x < 6; x++) {
      const w = 2.6 * (1 - y / len);
      if (Math.abs(x + 0.5 - 3) > w) continue;
      b.px(x, y, b.shadeCol(RAMPS.orange, 1 - y / len, x, y), 0);
    }
    return b.canvas();
  });
}

// ---------- bullets ----------
function glowBall(r: number, ramp: RGB[], core = true) {
  const s = Math.ceil(r * 2 + 2);
  const b = new SB(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.hypot(x + 0.5 - s / 2, y + 0.5 - s / 2) / r;
    if (d > 1) continue;
    b.px(x, y, b.shadeCol(ramp, core ? 1 - d * 0.9 : 0.8 - d * 0.5, x, y, 0.6));
  }
  return b.canvas();
}
function bolt(w: number, h: number, ramp: RGB[]) {
  const b = new SB(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.abs(x + 0.5 - w / 2) / (w / 2);
    const dy = y / h;
    const shape = 1 - dx * dx;
    if (shape < 0.05) continue;
    b.px(x, y, b.shadeCol(ramp, Math.min(1, shape * (1.1 - dy * 0.6)), x, y, 0.4));
  }
  return b.canvas();
}
function buildBullets() {
  S.b1 = bolt(3, 8, RAMPS.yellow);
  S.b2 = bolt(5, 11, RAMPS.yellow);
  S.b3 = bolt(7, 13, RAMPS.orange);
  S.spread = glowBall(2.5, RAMPS.purple);
  S.side = rot90(bolt(3, 8, RAMPS.green));
  S.rear = bolt(3, 8, RAMPS.green);
  S.wing = glowBall(2.5, RAMPS.gold);
  S.cannon = glowBall(5, RAMPS.orange);
  S.twist = glowBall(3, RAMPS.cyan);
  S.droneShot = bolt(3, 6, RAMPS.cyan);
  S.missile = renderShapes(6, 12, [{ t: 'cyl', x: 0, y: 0, w: 3, h: 8, r: 'steel' }, { t: 'ell', x: 0, y: -3, rx: 1.5, ry: 2, r: 'red', z: 5 }, { t: 'poly', p: [-2, 3, 0, 1, 2, 3, 0, 4], r: 'red' }]);
  S.mine = renderShapes(12, 12, [{ t: 'ell', x: 0, y: 0, rx: 4, ry: 4, r: 'green', spec: true }, { t: 'spikes', x: 0, y: 0, rad: 3, n: 6, len: 2, r: 'steel' }, { t: 'ell', x: 0, y: 0, rx: 1.4, ry: 1.4, r: 'red', z: 9 }]);
  SF.laser = [16, 24, 32].map((h) => { const b = new SB(3, h); for (let y = 0; y < h; y++) for (let x = 0; x < 3; x++) b.px(x, y, b.shadeCol(RAMPS.cyan, x === 1 ? 1 : 0.65, x, y, 0)); return b.canvas(); });
  SF.laserW = [16, 24, 32].map((h) => { const b = new SB(5, h); for (let y = 0; y < h; y++) for (let x = 0; x < 5; x++) b.px(x, y, b.shadeCol(RAMPS.cyan, 1 - Math.abs(x - 2) * 0.2, x, y, 0)); return b.canvas(); });
  SF.fire = [0, 1, 2, 3, 4, 5].map((k) => glowBall(2 + k, RAMPS.orange, k < 3));
  // enemy bullets
  S.eOrb = glowBall(3, RAMPS.red);
  S.eBig = glowBall(5, RAMPS.eye);
  S.eNeedle = bolt(3, 8, RAMPS.red);
  S.eSpore = glowBall(3.5, RAMPS.slime);
  S.ePlasma = glowBall(3, RAMPS.purple);
}
function rot90(src: Spr) {
  const [c, ctx] = makeCanvas(src.height, src.width);
  ctx.translate(c.width / 2, c.height / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

// ---------- pickups ----------
function buildPickups() {
  const bubble = (r: number, ramp: RGB[]) => {
    const s = Math.ceil(r * 2 + 3);
    const b = new SB(s, s);
    const c = s / 2;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / r;
      if (d > 1) continue;
      const rim = d > 0.75 ? 1 : 0.25 + 0.3 * d;
      b.px(x, y, b.shadeCol(ramp, rim, x, y, 0.7));
    }
    b.px(c - r * 0.4, c - r * 0.45, [255, 255, 255], 9); b.px(c - r * 0.4 + 1, c - r * 0.45, [255, 255, 255], 9);
    b.outline([0, 30, 10]);
    return b.canvas();
  };
  S.cash5 = bubble(3, RAMPS.green); S.cash10 = bubble(4, RAMPS.green); S.cash25 = bubble(5.5, RAMPS.gold); S.cash50 = bubble(7, RAMPS.gold); S.cash100 = bubble(9, RAMPS.cyan);
  S.capsule = renderShapes(18, 18, [
    { t: 'ell', x: 0, y: 0, rx: 7, ry: 7, r: 'chrome', spec: true },
    { t: 'box', x: 0, y: 0, w: 14, h: 4, r: 'red', bevel: 1, z: 8 },
    { t: 'spikes', x: 0, y: 0, rad: 6, n: 4, len: 2, r: 'steel', a0: Math.PI / 4 },
  ]);
}

// ---------- explosions ----------
function buildExplosions() {
  const mk = (size: number, frames: number, seed: number) => {
    const out: Spr[] = [];
    for (let f = 0; f < frames; f++) {
      const t = f / (frames - 1);
      const b = new SB(size, size);
      const c = size / 2;
      const outer = (0.35 + 0.65 * Math.sqrt(t)) * c;
      const inner = t > 0.45 ? (t - 0.45) * 1.6 * outer : 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - c, dy = y + 0.5 - c;
        const n = fbm(x * 0.25 + seed, y * 0.25, seed + f, 2);
        const d = Math.hypot(dx, dy) + (n - 0.5) * size * 0.35;
        if (d > outer || d < inner) continue;
        const heat = (1 - t) * (1 - (d - inner) / Math.max(1, outer - inner) * 0.6) + (n - 0.5) * 0.3;
        if (t > 0.7 && n < 0.45) continue;
        const ramp = heat < 0.2 ? RAMPS.dark : RAMPS.orange;
        b.px(x, y, b.shadeCol(ramp, Math.max(0, Math.min(1, heat < 0.2 ? 0.6 : heat * 1.15)), x, y, 0.8));
      }
      out.push(b.canvas());
    }
    return out;
  };
  SF.expS = mk(20, 8, 1);
  SF.expM = mk(36, 10, 4);
  SF.expL = mk(64, 12, 9);
  SF.spark = [0, 1, 2].map((k) => glowBall(3 - k, RAMPS.yellow));
}

// ---------- token icons ----------
export const TOKENS = ['P', 'S', 'H', '$', 'Z', 'D', 'X', '1'] as const;
export type TokenType = (typeof TOKENS)[number];
const TOKEN_RAMP: Record<TokenType, RampName> = { P: 'red', S: 'cyan', H: 'green', $: 'gold', Z: 'purple', D: 'blue', X: 'chrome', '1': 'orange' };
function buildTokens() {
  for (const tk of TOKENS) {
    SF['tok' + tk] = [0, 1, 2, 3].map((k) => {
      const w = [14, 10, 4, 10][k];
      return renderShapes(18, 18, [{ t: 'ell', x: 0, y: 0, rx: Math.max(1.5, w / 2), ry: 7, r: TOKEN_RAMP[tk], spec: true }]);
    });
  }
}

export function buildSprites() {
  buildShip();
  buildBullets();
  buildPickups();
  buildExplosions();
  buildTokens();
}
