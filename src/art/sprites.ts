// Procedurally generated pixel art: the Strikeblaster, its bolt-on weapons, bullets, pickups, explosions.
import { SB, RAMPS, tinted, RGB, fbm, RampName, hiCanvas, resOf, realSize, RES } from '../engine/gfx';

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

const ROUGH: Partial<Record<RampName, number>> = { flesh: 0.07, slime: 0.06, green: 0.06, shell: 0.07, bone: 0.06, purple: 0.04 };
const CHROME = new Set<RampName>(['chrome', 'metal']);

/** Render shapes into a canvas of (w,h); shape coords are relative to the canvas centre. */
export function renderShapes(w: number, h: number, shapes: Shape[], sym = false): Spr {
  const b = new SB(w, h);
  const cx = w / 2, cy = h / 2;
  for (const s of shapes) {
    switch (s.t) {
      case 'ell': b.ell(cx + s.x, cy + s.y, s.rx, s.ry, RAMPS[s.r], { z: s.z ?? 0, bias: s.bias, spec: s.spec, rough: ROUGH[s.r] ?? 0, chrome: CHROME.has(s.r) && Math.min(s.rx, s.ry) >= 2.5 }); break;
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
        b.each((x, y, X, Y) => {
          const nx = (x - cx - s.x) / s.rx, ny = (y - cy - s.y) / s.ry;
          const d = nx * nx + ny * ny;
          if (d > 1) return;
          const n = fbm(x * 0.18, y * 0.18, s.seed, 4);
          const l = 0.2 + 0.6 * Math.sqrt(1 - d) * (0.6 - nx * 0.3 - ny * 0.3) + (n - 0.5) * 0.7;
          // texture is an overlay: it paints over what is already there, later shapes still stack on top
          const zi = Y * b.W + X;
          const under = b.z[zi] > -1e8 ? b.z[zi] + 0.5 : (s.z ?? 0);
          b.pxR(X, Y, b.shadeCol(r, Math.max(0, Math.min(1, l)), X, Y), under);
        }, cx + s.x - s.rx - 1, cy + s.y - s.ry - 1, cx + s.x + s.rx + 1, cy + s.y + s.ry + 1);
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
    // wings: main plate, darker trailing edge, panel lines
    { t: 'poly', p: [ox, -5, lt, 8, lt, 12, ox - 3, 10], r: 'metal', l: 0.74 + lb, z: -2 },
    { t: 'poly', p: [ox, -5, rt, 8, rt, 12, ox + 3, 10], r: 'metal', l: 0.74 + rb, z: -2 },
    { t: 'poly', p: [lt, 10.5, lt, 12, ox - 3, 10, ox - 3, 8.8], r: 'steel', l: 0.45 + lb, z: -1.5 },
    { t: 'poly', p: [rt, 10.5, rt, 12, ox + 3, 10, ox + 3, 8.8], r: 'steel', l: 0.45 + rb, z: -1.5 },
    { t: 'poly', p: [lt, 8, lt - 1, 2, lt + 2, 4, lt + 2, 9], r: 'red', l: 0.85 + lb, z: -1 },
    { t: 'poly', p: [rt, 8, rt + 1, 2, rt - 2, 4, rt - 2, 9], r: 'red', l: 0.85 + rb, z: -1 },
    { t: 'poly', p: [lt + 3, 6.2, ox - 4, 1.2, ox - 4, 2.2, lt + 3, 7.2], r: 'red', l: 0.7 + lb, z: -1 },
    { t: 'poly', p: [rt - 3, 6.2, ox + 4, 1.2, ox + 4, 2.2, rt - 3, 7.2], r: 'red', l: 0.7 + rb, z: -1 },
    { t: 'line', x0: lt + 3, y0: 9, x1: ox - 4, y1: 3, c: '#334466', z: 0 },
    { t: 'line', x0: rt - 3, y0: 9, x1: ox + 4, y1: 3, c: '#334466', z: 0 },
    { t: 'line', x0: lt + 6, y0: 10, x1: lt + 6, y1: 6.5, c: '#2a3858', z: 0 },
    { t: 'line', x0: rt - 6, y0: 10, x1: rt - 6, y1: 6.5, c: '#2a3858', z: 0 },
    // engine nacelles with intake rings and hot nozzles
    { t: 'cyl', x: ox - 6, y: 9, w: 5, h: 11, r: 'steel', z: 3, bias: lb },
    { t: 'cyl', x: ox + 6, y: 9, w: 5, h: 11, r: 'steel', z: 3, bias: rb },
    { t: 'box', x: ox - 6, y: 5, w: 5.5, h: 1.2, r: 'dark', z: 4, bevel: 0 },
    { t: 'box', x: ox + 6, y: 5, w: 5.5, h: 1.2, r: 'dark', z: 4, bevel: 0 },
    { t: 'box', x: ox - 6, y: 11, w: 5.5, h: 0.8, r: 'gold', z: 4, bevel: 0 },
    { t: 'box', x: ox + 6, y: 11, w: 5.5, h: 0.8, r: 'gold', z: 4, bevel: 0 },
    { t: 'ell', x: ox - 6, y: 14.2, rx: 2.3, ry: 1.6, r: 'dark', z: 8 },
    { t: 'ell', x: ox + 6, y: 14.2, rx: 2.3, ry: 1.6, r: 'dark', z: 8 },
    { t: 'ell', x: ox - 6, y: 14.4, rx: 1.6, ry: 1.1, r: 'orange', z: 9, spec: true },
    { t: 'ell', x: ox + 6, y: 14.4, rx: 1.6, ry: 1.1, r: 'orange', z: 9, spec: true },
    // fuselage: chrome hull, dorsal spine, racing stripe, panel lines
    { t: 'ell', x: ox, y: 1, rx: 5.5, ry: 14, r: 'metal', bias: 0.04, z: 6 },
    { t: 'box', x: ox, y: 6, w: 3, h: 10, r: 'steel', z: 12, bevel: 1 },
    { t: 'box', x: ox, y: 6, w: 1, h: 9, r: 'red', z: 13, bevel: 0 },
    { t: 'line', x0: ox - 3, y0: -6, x1: ox - 3, y1: 9, c: '#223355', z: 30 },
    { t: 'line', x0: ox + 3, y0: -6, x1: ox + 3, y1: 9, c: '#223355', z: 30 },
    { t: 'line', x0: ox - 4, y0: 3, x1: ox + 4, y1: 3, c: '#223355', z: 30 },
    { t: 'line', x0: ox - 3.5, y0: 9.5, x1: ox + 3.5, y1: 9.5, c: '#223355', z: 30 },
    { t: 'ell', x: ox - 4.2, y: 6, rx: 0.5, ry: 0.5, r: 'steel', z: 31 },
    { t: 'ell', x: ox + 4.2, y: 6, rx: 0.5, ry: 0.5, r: 'steel', z: 31 },
    // canopy: dark frame, glass with reflection streaks
    { t: 'ell', x: ox + b * 0.3, y: -5, rx: 3.3, ry: 5.6, r: 'steel', z: 17 },
    { t: 'ell', x: ox + b * 0.3, y: -5, rx: 2.6, ry: 4.8, r: 'cyan', spec: true, z: 18 },
    { t: 'line', x0: ox - 1 + b * 0.3, y0: -8.5, x1: ox - 1.2 + b * 0.3, y1: -4.5, c: '#ffffff', z: 40 },
    { t: 'line', x0: ox + 0.6 + b * 0.3, y0: -8, x1: ox + 0.6 + b * 0.3, y1: -7, c: '#ccffff', z: 40 },
    { t: 'line', x0: ox - 2.6 + b * 0.3, y0: -2.2, x1: ox + 2.6 + b * 0.3, y1: -2.2, c: '#1a2238', z: 41 },
    // nose probe with a gold tip
    { t: 'cyl', x: ox, y: -14, w: 2, h: 5, r: 'steel', z: 8 },
    { t: 'ell', x: ox, y: -16.2, rx: 0.9, ry: 0.9, r: 'gold', z: 9, spec: true },
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
    b.each((x, y, X, Y) => {
      const t = (y + 0.5) / len;
      if (t > 1) return;
      const w = 2.6 * (1 - t);
      const dx = Math.abs(x + 0.5 - 3) / Math.max(0.01, w);
      if (dx > 1) return;
      b.pxR(X, Y, b.shadeCol(RAMPS.orange, (1 - t) * (1 - dx * 0.35), X, Y), 0);
    });
    return b.canvas();
  });
}

// ---------- bullets ----------
function glowBall(r: number, ramp: RGB[], core = true) {
  const s = Math.ceil(r * 2 + 2);
  const b = new SB(s, s);
  b.each((x, y, X, Y) => {
    const d = Math.hypot(x + 0.5 - s / 2, y + 0.5 - s / 2) / r;
    if (d > 1) return;
    b.pxR(X, Y, b.shadeCol(ramp, core ? 1 - d * d * 0.9 : 0.8 - d * 0.5, X, Y, 0.5));
  });
  return b.canvas();
}
function bolt(w: number, h: number, ramp: RGB[]) {
  const b = new SB(w, h);
  b.each((x, y, X, Y) => {
    const dx = Math.abs(x + 0.5 - w / 2) / (w / 2);
    const dy = (y + 0.5) / h;
    // rounded tip, tapered tail
    const tip = Math.min(1, (y + 0.5) / (w * 0.6));
    const shape = 1 - dx * dx / Math.max(0.05, tip * (1 - dy * 0.35));
    if (shape < 0.05) return;
    b.pxR(X, Y, b.shadeCol(ramp, Math.min(1, shape * (1.15 - dy * 0.6)), X, Y, 0.4));
  });
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
  const beam = (w: number, h: number) => { const b = new SB(w, h); b.each((x, y, X, Y) => { const d = Math.abs(x + 0.5 - w / 2) / (w / 2); b.pxR(X, Y, b.shadeCol(RAMPS.cyan, 1 - d * d * 0.55, X, Y, 0.3)); }); return b.canvas(); };
  SF.laser = [16, 24, 32].map((h) => beam(3, h));
  SF.laserW = [16, 24, 32].map((h) => beam(5, h));
  SF.fire = [0, 1, 2, 3, 4, 5].map((k) => glowBall(2 + k, RAMPS.orange, k < 3));
  // enemy bullets
  S.eOrb = glowBall(3, RAMPS.red);
  S.eBig = glowBall(5, RAMPS.eye);
  S.eNeedle = bolt(3, 8, RAMPS.red);
  S.eSpore = glowBall(3.5, RAMPS.slime);
  S.ePlasma = glowBall(3, RAMPS.purple);
}
function rot90(src: Spr) {
  const [c, ctx] = hiCanvas(src.height, src.width, resOf(src));
  ctx.translate(c.width / 2, c.height / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

// ---------- pickups ----------
function buildPickups() {
  const bubble = (r: number, ramp: RGB[]) => {
    const s = Math.ceil(r * 2 + 3);
    const b = new SB(s, s);
    const c = s / 2;
    b.each((x, y, X, Y) => {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / r;
      if (d > 1) return;
      const rim = d > 0.72 ? 1 - (d - 0.72) * 0.8 : 0.22 + 0.4 * d * d;
      b.pxR(X, Y, b.shadeCol(ramp, rim, X, Y, 0.6));
    });
    b.ell(c - r * 0.35, c - r * 0.4, Math.max(0.6, r * 0.22), Math.max(0.5, r * 0.15), [[255, 255, 255]], { z: 9, flat: true });
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
  // heat → colour: cold soot, embers, flame, white-hot core
  const HEAT: [number, number, number, number][] = [
    [0, 22, 16, 18], [0.18, 70, 34, 22], [0.32, 150, 50, 14], [0.5, 235, 110, 24], [0.68, 255, 176, 60], [0.84, 255, 228, 140], [1, 255, 252, 236],
  ];
  const heatCol = (h: number) => {
    h = Math.max(0, Math.min(1, h));
    let i = 0;
    while (i < HEAT.length - 2 && HEAT[i + 1][0] < h) i++;
    const [a, ar, ag, ab] = HEAT[i], [b, br, bg, bb] = HEAT[i + 1], f = (h - a) / (b - a);
    return [ar + (br - ar) * f, ag + (bg - ag) * f, ab + (bb - ab) * f];
  };
  const sm = (e0: number, e1: number, v: number) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const mk = (size: number, frames: number, seed: number) => {
    const out: Spr[] = [];
    for (let f = 0; f < frames; f++) {
      const t = f / (frames - 1);
      const [cv, ctx] = hiCanvas(size, size);
      const [W, Hh] = realSize(cv);
      const img = ctx.createImageData(W, Hh);
      const d = img.data;
      const c = size / 2;
      const outer = (0.35 + 0.65 * Math.sqrt(t)) * c;
      const inner = t > 0.45 ? (t - 0.45) * 1.6 * outer : 0;
      const sc = 5 / size; // noise scale follows the explosion size so big blasts get big billows
      for (let Y = 0; Y < Hh; Y++) for (let X = 0; X < W; X++) {
        const x = (X + 0.5) / RES, y = (Y + 0.5) / RES;
        const dx = x - c, dy = y - c;
        const n = fbm(x * sc * 1.6 + seed, y * sc * 1.6, seed + f, 5);
        const dd = Math.hypot(dx, dy) + (n - 0.5) * size * 0.35;
        // feathered outer edge and expanding hole
        let a = sm(outer, outer - 1.6, dd) * sm(inner - 1, inner + 1.5, dd);
        if (t > 0.6) a *= sm(0.38, 0.5, n + (1 - t) * 0.2);
        if (a <= 0.01) continue;
        const heat = (1 - t) * (1 - ((dd - inner) / Math.max(1, outer - inner)) * 0.6) + (n - 0.5) * 0.3;
        // billowing: light the upper-left of each puff of noise
        const lit = (fbm((x - 0.6) * sc * 1.6 + seed, (y - 0.6) * sc * 1.6, seed + f, 5) - n) * 3;
        let col = heatCol(heat * 1.1 + lit * 0.25);
        if (heat < 0.25) { const g = 0.7 + lit * 1.4; col = col.map((v) => Math.max(0, v * g)); }
        const o = (Y * W + X) * 4;
        d[o] = Math.min(255, col[0]); d[o + 1] = Math.min(255, col[1]); d[o + 2] = Math.min(255, col[2]); d[o + 3] = Math.round(a * 255);
      }
      ctx.putImageData(img, 0, 0);
      out.push(cv);
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
