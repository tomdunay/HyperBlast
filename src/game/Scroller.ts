// Pre-renders a level's solid scenery from its tile grid (smoothed + noise for organic edges), keeps a pixel-accurate
// collision mask, and draws: copper-bar sky → far silhouettes → near props → caustics → scenery shadow → foreground
// (with stamped decorations) → additive running lights.
import { makeCanvas, fbm, noise2, bayer, Ctx, RGB, RNG, hex } from '../engine/gfx';
import { renderShapes, Shape } from '../art/sprites';
import { glow } from '../engine/light';
import { LevelDef, Theme, W, H, TILE, COLS } from './types';

interface Light { x: number; y: number; color: string; phase: number; r: number }
interface Art { fg: HTMLCanvasElement; mask: Uint8Array; bg: HTMLCanvasElement; near: HTMLCanvasElement; shadow: HTMLCanvasElement; lights: Light[]; caustics: HTMLCanvasElement[] }

const foreCache = new WeakMap<Theme, HTMLCanvasElement>();
const BH = 480; // background tile height: a multiple of every pattern period so it wraps seamlessly

export class Scroller {
  lv: LevelDef;
  hpx: number;
  mask!: Uint8Array;
  fg!: HTMLCanvasElement;
  bg!: HTMLCanvasElement;
  near!: HTMLCanvasElement;
  shadow!: HTMLCanvasElement;
  lights: Light[] = [];
  caustics: HTMLCanvasElement[] = [];
  y = 0;
  oy = 0;
  maxY = 0;
  endY: number;
  static cache = new Map<LevelDef, Art>();

  constructor(lv: LevelDef) {
    this.lv = lv;
    this.hpx = lv.rows.length * TILE;
    this.endY = this.hpx - H;
    let art = Scroller.cache.get(lv);
    if (!art) {
      this.mask = new Uint8Array(W * this.hpx);
      this.lights = [];
      this.buildFg();
      art = {
        fg: this.fg, mask: this.mask, bg: buildBackground(lv.theme), near: buildNear(lv.theme), shadow: this.buildShadow(),
        lights: this.lights, caustics: lv.theme.ambient === 'bubbles' ? buildCaustics() : [],
      };
      Scroller.cache.set(lv, art);
    }
    Object.assign(this, art);
  }

  private buildFg() {
    const lv = this.lv, th = lv.theme, Hp = this.hpx, nRows = lv.rows.length;
    const tileAt = (c: number, rTop: number) => {
      c = Math.max(0, Math.min(COLS - 1, c));
      rTop = Math.max(0, Math.min(nRows - 1, rTop));
      return lv.rows[nRows - 1 - rTop][c];
    };
    const field = new Float32Array(W * Hp);
    for (let py = 0; py < Hp; py++) {
      const ty = py / TILE - 0.5, r0 = Math.floor(ty), fy = ty - r0;
      for (let px = 0; px < W; px++) {
        const tx = px / TILE - 0.5, c0 = Math.floor(tx), fx = tx - c0;
        const a = tileAt(c0, r0), b = tileAt(c0 + 1, r0), c = tileAt(c0, r0 + 1), d = tileAt(c0 + 1, r0 + 1);
        let v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
        if (th.wobble > 0 && v > 0.02 && v < 0.98) v += (fbm(px * 0.07, py * 0.07, 7, 2) - 0.5) * th.wobble * 2;
        field[py * W + px] = v;
      }
    }
    const [cv, ctx] = makeCanvas(W, Hp);
    const img = ctx.createImageData(W, Hp);
    const out = new Uint32Array(img.data.buffer);
    const hgt = (i: number) => Math.max(0, Math.min(1, (field[i] - 0.5) * 3.2));
    const pack = (c: RGB) => (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
    const metal = th.tex === 'metal' || th.tex === 'biomech';
    for (let py = 1; py < Hp - 1; py++) {
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        if (field[i] <= 0.5) continue;
        this.mask[i] = 1;
        const h = hgt(i);
        const dhx = hgt(i + (px < W - 1 ? 1 : 0)) - hgt(i - (px > 0 ? 1 : 0));
        const dhy = hgt(i + W) - hgt(i - W);
        let l = 0.42 + (dhx + dhy) * 2.2 * (1 - h * 0.5);
        const t = texture(th, px, py);
        l += t.l;
        // large-scale strata / plate variation
        l += (fbm(px * 0.011, py * 0.011, 21, 2) - 0.5) * 0.42;
        // deep interior is darker, like it recedes into shadow
        if (h >= 1) l -= Math.min(0.18, (fbm(px * 0.03, py * 0.03, 5, 2) - 0.3) * 0.3);
        // specular glint on metal faces
        if (metal && (dhx + dhy) > 0.25 && ((px + py) & 7) === 0) l += 0.35;
        const ramp = t.alt ? th.alt : th.rock;
        let idx = Math.round(l * (ramp.length - 1) + bayer(px, py) * 0.9);
        // rim highlight on edges facing the light, dark contact line on the far side
        const emptyUL = field[i - W - 1] <= 0.5 || field[i - W] <= 0.5 || (px > 0 && field[i - 1] <= 0.5);
        const emptyDR = field[i + W + 1] <= 0.5 || field[i + W] <= 0.5 || (px < W - 1 && field[i + 1] <= 0.5);
        if (h < 0.09) idx = 0;
        if (emptyUL && h < 0.25) idx = ramp.length - 1 - (((px + py) & 1) ? 1 : 0);
        else if (emptyDR && h < 0.25) idx = 0;
        out[i] = pack(ramp[Math.max(0, Math.min(ramp.length - 1, idx))]);
      }
    }
    ctx.putImageData(img, 0, 0);
    this.fg = cv;
    this.stampDecor(ctx);
  }

  /** Stamp theme decorations onto wall edges (and fossils into wall interiors), recording running lights. */
  private stampDecor(ctx: Ctx) {
    const th = this.lv.theme, set = DECOR[th.tex]!();
    const rng = new RNG(1234 + this.lv.idx * 77);
    const Hp = this.hpx;
    for (let py = 30; py < Hp - 30; py += rng.int(14, 30)) {
      const side = rng.next() < 0.5 ? 'L' : 'R';
      // find the wall edge on this row
      let ex = -1;
      if (side === 'L') { for (let x = 4; x < 200; x++) if (!this.mask[py * W + x]) { ex = x; break; } }
      else { for (let x = W - 5; x > 120; x--) if (!this.mask[py * W + x]) { ex = x; break; } }
      if (ex < 8 || ex > W - 8) continue;
      const d = rng.pick(set.edge);
      const s = d.spr;
      const cx = side === 'L' ? ex - d.inset : ex + d.inset;
      ctx.save();
      ctx.translate(Math.round(cx), py);
      if (side === 'R') ctx.scale(-1, 1);
      if (d.rot) ctx.rotate(side === 'L' ? Math.PI / 2 : Math.PI / 2);
      ctx.drawImage(s, -(s.width >> 1), -(s.height >> 1));
      ctx.restore();
      if (d.light) this.lights.push({ x: Math.round(cx), y: py, color: d.light, phase: rng.next() * 6, r: d.lightR ?? 6 });
    }
    // fossils / panels embedded deep inside walls
    if (set.inner.length) {
      for (let k = 0; k < Hp / 22; k++) {
        const x = rng.int(10, W - 10), y = rng.int(20, Hp - 20);
        let solid = true;
        for (let dy = -9; dy <= 9 && solid; dy += 3) for (let dx = -9; dx <= 9; dx += 3) if (!this.mask[(y + dy) * W + x + dx]) { solid = false; break; }
        if (!solid) continue;
        const d = rng.pick(set.inner);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(d.spr, x - (d.spr.width >> 1), y - (d.spr.height >> 1));
        ctx.globalAlpha = 1;
        if (d.light) this.lights.push({ x, y, color: d.light, phase: rng.next() * 6, r: d.lightR ?? 5 });
      }
    }
    this.lights.sort((a, b) => a.y - b.y);
  }

  /** Dithered drop shadow of the scenery cast down-right onto the background layers. */
  private buildShadow(): HTMLCanvasElement {
    const Hp = this.hpx, m = this.mask;
    const [c, ctx] = makeCanvas(W, Hp);
    const img = ctx.createImageData(W, Hp);
    const d = new Uint32Array(img.data.buffer);
    const dark = (0xb4 << 24) >>> 0 | 0x0a0004;
    const light = (0x70 << 24) >>> 0 | 0x0a0004;
    for (let y = 9; y < Hp; y++) for (let x = 7; x < W; x++) {
      const i = y * W + x;
      if (m[i] || !m[(y - 9) * W + x - 7]) continue;
      // softer outer band
      const inner = m[(y - 12) * W + Math.max(0, x - 10)];
      d[i] = inner ? dark : ((x + y) & 1 ? light : 0);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  private topRow(scroll: number) { return this.hpx - H - Math.round(scroll); }

  solid(sx: number, sy: number) {
    sx |= 0;
    if (sx < 0 || sx >= W) return true;
    const py = this.topRow(this.y) + (sy | 0);
    if (py < 0 || py >= this.hpx) return false;
    return this.mask[py * W + sx] === 1;
  }
  rectSolid(x: number, y: number, w: number, h: number) {
    for (let yy = y; yy <= y + h; yy += 3)
      for (let xx = x; xx <= x + w; xx += 3) if (this.solid(xx, yy)) return true;
    return this.solid(x + w, y + h);
  }
  wallEdge(row: number, side: 'L' | 'R') {
    const r = this.lv.rows[Math.max(0, Math.min(this.lv.rows.length - 1, row))];
    if (side === 'L') { let c = 0; while (c < COLS && r[c]) c++; return c * TILE; }
    let c = COLS - 1; while (c >= 0 && r[c]) c--; return (c + 1) * TILE;
  }

  scrollAt(alpha: number) { return this.oy + (this.y - this.oy) * alpha; }

  /** Copper-bar sky, far silhouettes (0.35x), near props (0.7x), caustics. */
  drawBg(ctx: Ctx, alpha: number, t: number) {
    const s = this.scrollAt(alpha);
    const th = this.lv.theme;
    const c0 = hex(th.bg[0]), c1 = hex(th.bg[1]);
    for (let y = 0; y < H; y += 2) {
      const k = Math.sin((y / H) * Math.PI);
      const bar = Math.pow(Math.max(0, Math.sin((y + s * 0.15) * 0.045 + t * 0.012)), 10) * 0.55;
      const r = c0[0] + (c1[0] - c0[0]) * k, g = c0[1] + (c1[1] - c0[1]) * k, b = c0[2] + (c1[2] - c0[2]) * k;
      const q = (v: number, add: number) => Math.min(255, Math.round((v + add) / 17) * 17);
      ctx.fillStyle = `rgb(${q(r, r * bar + 18 * bar)},${q(g, g * bar + 24 * bar)},${q(b, b * bar + 40 * bar)})`;
      ctx.fillRect(0, y, W, 2);
    }
    const tile = (img: HTMLCanvasElement, f: number) => {
      const off = Math.round((s * f) % BH);
      for (let y = off - BH; y < H; y += BH) ctx.drawImage(img, 0, y);
    };
    tile(this.bg, 0.35);
    tile(this.near, 0.7);
    if (this.caustics.length) {
      const f = this.caustics[Math.floor(t / 6) % this.caustics.length];
      ctx.globalCompositeOperation = 'lighter';
      const off = Math.round((s * 0.7) % 256);
      for (let y = off - 256; y < H; y += 256) ctx.drawImage(f, 0, y, W, 256);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  /** Foreground silhouettes rushing past at 1.45x — sells the sense of speed and depth. */
  drawFore(ctx: Ctx, alpha: number) {
    const th = this.lv.theme;
    let fore = foreCache.get(th);
    if (!fore) { fore = buildFore(th); foreCache.set(th, fore); }
    const off = Math.round((this.scrollAt(alpha) * 1.45) % BH);
    for (let y = off - BH; y < H; y += BH) ctx.drawImage(fore, 0, y);
  }
  drawShadow(ctx: Ctx, alpha: number) { this.blit(ctx, this.shadow, alpha); }
  drawFg(ctx: Ctx, alpha: number) { this.blit(ctx, this.fg, alpha); }
  private blit(ctx: Ctx, c: HTMLCanvasElement, alpha: number) {
    const top = this.topRow(this.scrollAt(alpha));
    const sy = Math.max(0, top), dy = sy - top;
    const h = Math.min(H - dy, this.hpx - sy);
    if (h > 0) ctx.drawImage(c, 0, sy, W, h, 0, dy, W, h);
  }
  /** Additive running lights embedded in the scenery, plus caustic shimmer over the walls. */
  drawLights(ctx: Ctx, alpha: number, t: number) {
    const top = this.topRow(this.scrollAt(alpha));
    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.lights) {
      const y = L.y - top;
      if (y < -20) continue;
      if (y > H + 20) break;
      const on = Math.sin(t * 0.08 + L.phase) > -0.3;
      if (!on) continue;
      const g = glow(L.r + (Math.sin(t * 0.2 + L.phase) > 0.6 ? 2 : 0), L.color);
      ctx.drawImage(g, L.x - (g.width >> 1), Math.round(y) - (g.height >> 1));
    }
    if (this.caustics.length) {
      ctx.globalAlpha = 0.45;
      const f = this.caustics[(Math.floor(t / 6) + 3) % this.caustics.length];
      const off = Math.round((this.scrollAt(alpha)) % 256);
      for (let y = off - 256; y < H; y += 256) ctx.drawImage(f, 0, y, W, 256);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function texture(th: Theme, x: number, y: number): { l: number; alt: boolean } {
  switch (th.tex) {
    case 'coral': {
      const n = fbm(x * 0.09, y * 0.09, 3, 2);
      const pore = noise2(x * 0.33, y * 0.33, 11) > 0.74 ? -0.28 : 0;
      return { l: (n - 0.5) * 0.45 + pore, alt: fbm(x * 0.02, y * 0.02, 5, 2) > 0.62 };
    }
    case 'bone': {
      const n = fbm(x * 0.05, y * 0.05, 4, 2);
      return { l: Math.sin(y * 0.45 + n * 5) * 0.16 + (n - 0.5) * 0.3, alt: n > 0.63 };
    }
    case 'vine': {
      const n = fbm(x * 0.04, y * 0.04, 8, 2);
      const v = Math.sin((x * 0.6 + y) * 0.22 + n * 8);
      return { l: v * 0.18 + (noise2(x * 0.5, y * 0.5, 2) - 0.5) * 0.2, alt: v > 0.55 };
    }
    case 'biomech': {
      const flesh = fbm(x * 0.018, y * 0.018, 9, 2) > 0.56;
      if (flesh) return { l: (fbm(x * 0.12, y * 0.12, 1, 2) - 0.5) * 0.5, alt: true };
      const gx = x % 32, gy = y % 24;
      let l = 0;
      if (gx === 0 || gy === 0) l = -0.3;
      else if (gx === 1 || gy === 1) l = 0.2;
      if ((gx === 4 || gx === 28) && (gy === 4 || gy === 20)) l = 0.4;
      if (gx > 10 && gx < 22 && gy > 8 && gy < 16) l += ((x >> 1) % 2 === 0 ? -0.15 : 0.05);
      return { l, alt: false };
    }
    case 'crystal': {
      // faceted cells: nearest/second-nearest jittered points give facet id and edge distance
      const c = cells(x, y, 15);
      const facet = (cellHash(c.id) - 0.5) * 0.6;
      const edge = c.d2 - c.d1 < 1.6;
      return { l: edge ? 0.4 : facet + (c.d1 / 15) * -0.2, alt: !edge && cellHash(c.id + 7) > 0.82 };
    }
    case 'lava': {
      const n = fbm(x * 0.06, y * 0.06, 13, 2);
      const f = Math.abs(fbm(x * 0.025, y * 0.025, 31, 3) - 0.5);
      if (f < 0.018) return { l: 0.95 - f * 20, alt: true }; // glowing fissure
      if (f < 0.03) return { l: 0.35, alt: true };
      return { l: (n - 0.5) * 0.5 + (((x * 3 + y) >> 3) % 5 === 0 ? -0.1 : 0), alt: false };
    }
    case 'metal': {
      const gx = x % 40, gy = y % 32;
      let l = (gy / 32 - 0.5) * -0.15;
      if (gx === 0 || gy === 0) l = -0.35;
      else if (gx === 1 || gy === 1) l = 0.25;
      if ((gx === 3 || gx === 37) && (gy === 3 || gy === 29)) l = 0.45;
      const stripe = gy > 24 && gy < 29 && ((x + y) >> 2) % 2 === 0;
      return { l, alt: stripe };
    }
  }
}

function cellHash(id: number) {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Worley-style cell lookup: distance to nearest (d1) and second-nearest (d2) jittered point. */
function cells(x: number, y: number, size: number) {
  const cx = Math.floor(x / size), cy = Math.floor(y / size);
  let d1 = 1e9, d2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const k = (cx + i) * 73856093 ^ (cy + j) * 19349663;
    const px = (cx + i + cellHash(k)) * size, py = (cy + j + cellHash(k + 1)) * size;
    const d = Math.hypot(x - px, y - py);
    if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
  }
  return { d1, d2, id };
}

// ---------------- decorations ----------------
interface Decor { spr: HTMLCanvasElement; inset: number; light?: string; lightR?: number; rot?: boolean }
const decorCache = new Map<string, { edge: Decor[]; inner: Decor[] }>();
const DECOR: Partial<Record<Theme['tex'], () => { edge: Decor[]; inner: Decor[] }>> & Record<'coral' | 'bone' | 'vine' | 'biomech' | 'metal', () => { edge: Decor[]; inner: Decor[] }> = {
  coral: () => cached('coral', () => ({
    edge: [
      { spr: renderShapes(20, 20, [{ t: 'spikes', x: 2, y: 0, rad: 3, n: 7, len: 6, r: 'flesh', a0: 0.3 }, { t: 'ell', x: 2, y: 0, rx: 4, ry: 4, r: 'orange', spec: true }]), inset: 3 },
      { spr: renderShapes(22, 16, [{ t: 'ell', x: -3, y: 2, rx: 6, ry: 5, r: 'shell' }, { t: 'ell', x: -2, y: 1, rx: 3, ry: 3, r: 'shell', z: 6, bias: 0.2 }, { t: 'ell', x: 5, y: 3, rx: 3, ry: 3, r: 'purple', z: 2 }]), inset: 4 },
      { spr: renderShapes(18, 24, [...[-6, -2, 2, 6].map((y, i) => ({ t: 'ell', x: 3 + (i % 2) * 2, y, rx: 3, ry: 2, r: 'red', z: i } as Shape))]), inset: 2 },
      { spr: renderShapes(16, 16, [{ t: 'ell', x: 2, y: 0, rx: 4, ry: 4, r: 'cyan', spec: true }, { t: 'spikes', x: 2, y: 0, rad: 3, n: 5, len: 3, r: 'slime' }]), inset: 2, light: '#33aaff', lightR: 7 },
    ],
    inner: [{ spr: renderShapes(14, 14, [{ t: 'ell', x: 0, y: 0, rx: 5, ry: 5, r: 'shell', bias: -0.15 }, { t: 'ell', x: 1, y: -1, rx: 2.5, ry: 2.5, r: 'shell', z: 5, bias: -0.05 }]), inset: 0 }],
  })),
  bone: () => cached('bone', () => {
    const skull = renderShapes(18, 18, [{ t: 'ell', x: 0, y: -1, rx: 7, ry: 6, r: 'bone' }, { t: 'ell', x: -2.5, y: -1, rx: 1.8, ry: 2, r: 'dark', z: 10, bias: -0.4 }, { t: 'ell', x: 2.5, y: -1, rx: 1.8, ry: 2, r: 'dark', z: 10, bias: -0.4 }, { t: 'box', x: 0, y: 5, w: 7, h: 3, r: 'bone', bevel: 1 }]);
    const ammo = renderShapes(18, 18, [{ t: 'ell', x: 0, y: 0, rx: 7, ry: 7, r: 'bone', bias: -0.1 }, { t: 'ell', x: 1, y: -1, rx: 4.5, ry: 4.5, r: 'bone', z: 5 }, { t: 'ell', x: 1.5, y: -1, rx: 2, ry: 2, r: 'bone', z: 9, bias: 0.2 }]);
    const vert = renderShapes(22, 12, [{ t: 'ribs', x: 0, y: 0, w: 18, h: 8, n: 3, r: 'bone' }, { t: 'spikes', x: 0, y: 0, rad: 2, n: 2, len: 4, r: 'bone' }]);
    return { edge: [{ spr: skull, inset: 4 }, { spr: ammo, inset: 5 }, { spr: vert, inset: 6 }, { spr: renderShapes(14, 14, [{ t: 'ell', x: 0, y: 0, rx: 3, ry: 3, r: 'eye', spec: true }]), inset: 3, light: '#ff6622', lightR: 5 }], inner: [{ spr: ammo, inset: 0 }, { spr: skull, inset: 0 }] };
  }),
  vine: () => cached('vine', () => ({
    edge: [
      { spr: renderShapes(20, 20, [{ t: 'spikes', x: 0, y: 0, rad: 3, n: 6, len: 5, r: 'purple' }, { t: 'ell', x: 0, y: 0, rx: 3, ry: 3, r: 'yellow', spec: true }]), inset: 2, light: '#ffcc44', lightR: 5 },
      { spr: renderShapes(18, 18, [{ t: 'poly', p: [-6, 4, 7, -2, -4, -2], r: 'green', l: 0.8 }, { t: 'poly', p: [-6, -4, 7, 3, -3, 3], r: 'green', l: 0.6 }]), inset: 2 },
      { spr: renderShapes(18, 18, [{ t: 'ell', x: -2, y: -2, rx: 3, ry: 3, r: 'yellow' }, { t: 'ell', x: 2, y: 1, rx: 3, ry: 3, r: 'yellow' }, { t: 'ell', x: -1, y: 3, rx: 2.5, ry: 2.5, r: 'yellow' }]), inset: 4 },
    ],
    inner: [],
  })),
  biomech: () => cached('biomech', () => ({
    edge: [
      { spr: renderShapes(16, 20, [{ t: 'box', x: 0, y: 0, w: 12, h: 16, r: 'steel', bevel: 2 }, { t: 'ribs', x: 0, y: 0, w: 8, h: 10, n: 3, r: 'dark' }]), inset: 5 },
      { spr: renderShapes(14, 14, [{ t: 'cyl', x: 0, y: 0, w: 12, h: 6, r: 'steel', vert: false }, { t: 'ell', x: 3, y: 0, rx: 2, ry: 2, r: 'red', z: 9, spec: true }]), inset: 4, light: '#ff3311', lightR: 6 },
      { spr: renderShapes(16, 16, [{ t: 'tex', x: 0, y: 0, rx: 6, ry: 6, r: 'flesh', seed: 4 }, { t: 'ell', x: 0, y: 0, rx: 6, ry: 6, r: 'flesh' }]), inset: 4 },
    ],
    inner: [{ spr: renderShapes(14, 14, [{ t: 'box', x: 0, y: 0, w: 10, h: 10, r: 'steel', bevel: 1 }, { t: 'ell', x: 0, y: 0, rx: 2, ry: 2, r: 'orange', z: 9 }]), inset: 0, light: '#ff8822', lightR: 4 }],
  })),
  metal: () => cached('metal', () => ({
    edge: [
      { spr: renderShapes(10, 18, [{ t: 'box', x: 0, y: 0, w: 6, h: 14, r: 'steel', bevel: 1 }, { t: 'box', x: 0, y: 0, w: 2, h: 10, r: 'cyan', bevel: 0, z: 5 }]), inset: 4, light: '#44ccff', lightR: 6 },
      { spr: renderShapes(14, 14, [{ t: 'box', x: 0, y: 0, w: 10, h: 10, r: 'steel', bevel: 2 }, { t: 'ell', x: 0, y: 0, rx: 2, ry: 2, r: 'red', z: 9, spec: true }]), inset: 5, light: '#ff2222', lightR: 5 },
      { spr: renderShapes(20, 10, [{ t: 'cyl', x: 0, y: 0, w: 16, h: 4, r: 'chrome', vert: false }]), inset: 7 },
    ],
    inner: [{ spr: renderShapes(12, 12, [{ t: 'box', x: 0, y: 0, w: 8, h: 4, r: 'yellow', bevel: 1 }]), inset: 0, light: '#ffcc33', lightR: 4 }],
  })),
};
DECOR.crystal = () => cached('crystal', () => {
  const gem = (r: 'cyan' | 'purple' | 'chrome') => renderShapes(16, 20, [
    { t: 'poly', p: [0, -9, 4, 0, 0, 8, -4, 0], r, l: 0.9 }, { t: 'poly', p: [5, -5, 7, 1, 4, 5, 2, 0], r, l: 0.6, z: -2 },
  ]);
  return {
    edge: [{ spr: gem('cyan'), inset: 3, light: '#55ffff', lightR: 6 }, { spr: gem('purple'), inset: 3, light: '#cc66ff', lightR: 5 }, { spr: gem('chrome'), inset: 4 }],
    inner: [{ spr: gem('cyan'), inset: 0, light: '#44ddff', lightR: 4 }],
  };
});
DECOR.lava = () => cached('lava', () => ({
  edge: [
    { spr: renderShapes(18, 16, [{ t: 'ell', x: 0, y: 1, rx: 7, ry: 5, r: 'dark', bias: 0.2 }, { t: 'ell', x: 0, y: -1, rx: 3, ry: 2, r: 'orange', z: 9, spec: true }]), inset: 4, light: '#ff6611', lightR: 7 },
    { spr: renderShapes(16, 16, [{ t: 'spikes', x: 0, y: 2, rad: 3, n: 5, len: 5, r: 'dark' }, { t: 'ell', x: 0, y: 2, rx: 3, ry: 3, r: 'red', spec: true }]), inset: 3, light: '#ff3300', lightR: 5 },
    { spr: renderShapes(14, 14, [{ t: 'ell', x: 0, y: 0, rx: 5, ry: 5, r: 'steel', bias: -0.2 }]), inset: 4 },
  ],
  inner: [{ spr: renderShapes(10, 10, [{ t: 'ell', x: 0, y: 0, rx: 3, ry: 3, r: 'orange', spec: true }]), inset: 0, light: '#ff8822', lightR: 4 }],
}));
function cached(k: string, f: () => { edge: Decor[]; inner: Decor[] }) {
  let v = decorCache.get(k);
  if (!v) { v = f(); decorCache.set(k, v); }
  return v;
}

/** Crisp (non-antialiased) alpha so path-drawn layers stay pixel art. */
function harden(ctx: Ctx, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
}

/** Near-FOREGROUND silhouettes (1.45x parallax) hugging the screen edges, drawn over everything but the HUD. */
export function buildFore(th: Theme): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(W, BH);
  const rng = new RNG(7 + th.tex.length * 3);
  const dark = `rgb(${th.far[0].map((v) => Math.round(v * 0.5)).join(',')})`;
  const rimC = th.rock[th.rock.length - 3];
  const rim = `rgb(${rimC.join(',')})`;
  for (let k = 0; k < 6; k++) {
    const side = k % 2, y0 = k * 80 + rng.int(0, 30), len = rng.range(50, 110), depth = rng.range(16, 34);
    const x0 = side ? W : 0, dir = side ? -1 : 1;
    const pts: [number, number][] = [[x0, y0]];
    const steps = 7;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      let inward = Math.sin(t * Math.PI) * depth;
      if (th.tex === 'metal' || th.tex === 'biomech') inward = t > 0.15 && t < 0.85 ? depth * 0.7 : depth * 0.2; // girders/plates
      if (th.tex === 'crystal') inward = (i % 2 ? depth : depth * 0.4) * Math.sin(t * Math.PI);
      if (th.tex === 'vine' || th.tex === 'coral') inward += rng.range(-5, 5);
      pts.push([x0 + dir * inward, y0 + t * len]);
    }
    pts.push([x0, y0 + len]);
    for (const off of [0, BH, -BH]) {
      ctx.fillStyle = rim;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dir, y + off - 1) : ctx.moveTo(x + dir, y + off - 1))); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + off) : ctx.moveTo(x, y + off))); ctx.fill();
    }
  }
  harden(ctx, W, BH);
  return c;
}

/** Near-background prop layer (0.7x parallax), transparent except for theme props. */
function buildNear(th: Theme): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(W, BH);
  const f = th.far, base = `rgb(${f[3].join(',')})`, hi = `rgb(${f[3].map((v) => Math.min(255, v + 34)).join(',')})`, lo = `rgb(${f[1].join(',')})`;
  const rng = new RNG(99 + th.tex.length);
  ctx.lineCap = 'round';
  const stroke = (w: number, col: string, path: () => void) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); path(); ctx.stroke(); };
  switch (th.tex) {
    case 'coral':
      for (let k = 0; k < 9; k++) {
        const x0 = rng.range(20, 300), amp = rng.range(6, 16), ph = rng.range(0, 6), w = rng.int(3, 5);
        const path = () => { for (let y = 0; y <= BH; y += 8) { const x = x0 + Math.sin((y / BH) * Math.PI * 4 + ph) * amp; y ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
        stroke(w + 2, lo, path); stroke(w, base, path); stroke(1, hi, path);
      }
      break;
    case 'bone':
      for (let y = 40; y < BH; y += 120) for (const side of [0, 1]) {
        const x0 = side ? W + 10 : -10, dir = side ? -1 : 1;
        const path = () => { ctx.moveTo(x0, y); ctx.quadraticCurveTo(x0 + dir * 130, y - 40, x0 + dir * 120, y + 60); };
        stroke(9, lo, path); stroke(7, base, path); stroke(2, hi, path);
      }
      break;
    case 'vine':
      for (let k = 0; k < 8; k++) {
        const x0 = rng.range(10, 310), ph = rng.range(0, 6);
        const path = () => { for (let y = 0; y <= BH; y += 6) { const x = x0 + Math.sin((y / BH) * Math.PI * 6 + ph) * 10; y ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
        stroke(4, lo, path); stroke(2, base, path);
        for (let y = 10; y < BH; y += 24) { const x = x0 + Math.sin((y / BH) * Math.PI * 6 + ph) * 10; ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(x + 4, y, 5, 2, 0.5, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    case 'biomech':
      for (const x of [36, 284]) { ctx.fillStyle = lo; ctx.fillRect(x - 8, 0, 16, BH); ctx.fillStyle = base; ctx.fillRect(x - 6, 0, 12, BH); ctx.fillStyle = hi; ctx.fillRect(x - 3, 0, 2, BH); for (let y = 0; y < BH; y += 60) { ctx.fillStyle = lo; ctx.fillRect(x - 10, y, 20, 8); ctx.fillStyle = hi; ctx.fillRect(x - 10, y, 20, 1); } }
      for (let y = 30; y < BH; y += 160) { ctx.fillStyle = lo; ctx.fillRect(0, y - 6, W, 12); ctx.fillStyle = base; ctx.fillRect(0, y - 4, W, 8); ctx.fillStyle = hi; ctx.fillRect(0, y - 3, W, 1); }
      break;
    case 'metal':
      for (const x of [24, 296]) {
        ctx.fillStyle = base; ctx.fillRect(x - 5, 0, 10, BH);
        ctx.fillStyle = hi; ctx.fillRect(x - 5, 0, 1, BH);
        for (let y = 0; y < BH; y += 40) stroke(2, lo, () => { ctx.moveTo(x - 5, y); ctx.lineTo(x + (x < 160 ? 40 : -40), y + 40); });
      }
      for (let y = 0; y < BH; y += 96) { ctx.fillStyle = lo; ctx.fillRect(0, y, W, 6); ctx.fillStyle = hi; ctx.fillRect(0, y, W, 1); }
      break;
    case 'crystal':
      // giant translucent shards leaning in from the sides
      for (let k = 0; k < 10; k++) {
        const side = k % 2, y = (k * 53 + rng.int(0, 30)) % BH, len = rng.range(50, 110), wd = rng.range(10, 22);
        const x0 = side ? W + 4 : -4, dir = side ? -1 : 1, tilt = rng.range(-0.5, 0.5);
        ctx.fillStyle = lo; ctx.beginPath(); ctx.moveTo(x0, y - wd); ctx.lineTo(x0 + dir * len, y + tilt * len); ctx.lineTo(x0, y + wd); ctx.fill();
        ctx.fillStyle = base; ctx.beginPath(); ctx.moveTo(x0, y - wd * 0.6); ctx.lineTo(x0 + dir * len * 0.95, y + tilt * len); ctx.lineTo(x0, y); ctx.fill();
        stroke(1, hi, () => { ctx.moveTo(x0, y - wd * 0.6); ctx.lineTo(x0 + dir * len * 0.95, y + tilt * len); });
      }
      break;
    case 'lava':
      // basalt columns with glowing seams
      for (const x of [18, 50, 270, 302]) {
        const w = 22;
        ctx.fillStyle = lo; ctx.fillRect(x - w / 2, 0, w, BH);
        ctx.fillStyle = base; ctx.fillRect(x - w / 2 + 2, 0, w - 6, BH);
        ctx.fillStyle = hi; ctx.fillRect(x - w / 2 + 2, 0, 1, BH);
        for (let y = rng.int(0, 40); y < BH; y += rng.int(30, 70)) { ctx.fillStyle = '#aa3300'; ctx.fillRect(x - w / 2, y, w, 2); ctx.fillStyle = '#ff7722'; ctx.fillRect(x - w / 2 + 3, y, w - 8, 1); }
      }
      break;
  }
  harden(ctx, W, BH);
  return c;
}

function buildBackground(th: Theme): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(W, BH);
  const img = ctx.createImageData(W, BH);
  const d = new Uint32Array(img.data.buffer);
  const far = th.far;
  // periodic noise: blend sample at y and y-BH
  const pn = (x: number, y: number, s: number, seed: number) => {
    const t = y / BH;
    return fbm(x * s, y * s, seed, 3) * (1 - t) + fbm(x * s, (y - BH) * s, seed, 3) * t;
  };
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < W; x++) {
      let v: number;
      switch (th.tex) {
        case 'metal': {
          const gx = (x + 8) % 64, gy = y % 48;
          v = gx < 3 || gy < 2 ? 0.75 : pn(x, y, 0.02, 3) > 0.6 ? 0.55 : -1;
          if (gx > 20 && gx < 44 && gy > 10 && gy < 38) v = (gy & 3) === 0 ? 0.5 : 0.3;
          break;
        }
        case 'biomech': {
          const n = pn(x, y, 0.025, 4);
          const pipe = Math.abs(((x + 40 + Math.sin((y * Math.PI * 6) / BH) * 20) % 80) - 40);
          v = pipe < 6 ? 0.8 - pipe * 0.08 : n > 0.55 ? (n - 0.55) * 4 : -1;
          break;
        }
        default: {
          const n = pn(x, y, 0.018, 5);
          const edge = Math.min(x, W - x) / W;
          v = n + (0.3 - edge) * 0.9 > 0.62 ? (n - 0.4) * 2 : -1;
        }
      }
      if (v < 0) continue;
      const idx = Math.max(0, Math.min(far.length - 1, Math.round(v * (far.length - 1) + bayer(x, y))));
      const col = far[idx];
      d[y * W + x] = (0xff000000 | (col[2] << 16) | (col[1] << 8) | col[0]) >>> 0;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Animated underwater caustic light pattern (8 frames, 160x128, drawn 2x). */
function buildCaustics(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < 8; f++) {
    const [c, ctx] = makeCanvas(160, 128);
    const img = ctx.createImageData(160, 128);
    const ph = (f / 8) * Math.PI * 2;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 160; x++) {
      // frequencies are whole cycles per tile so the pattern wraps seamlessly
      const T = Math.PI * 2, fx = T / 160, fy = T / 128;
      const a = Math.sin(x * fx * 3 + Math.sin(y * fy + ph) * 2.2 + ph);
      const b = Math.sin(y * fy * 3 + Math.sin(x * fx * 2 - ph) * 2.0 - ph);
      const v = 1 - Math.abs(a + b) * 0.5;
      const k = v > 0.9 ? 2 : v > 0.8 && ((x + y) & 1) ? 1 : 0;
      if (!k) continue;
      const i = (y * 160 + x) * 4;
      img.data[i] = 60; img.data[i + 1] = 150; img.data[i + 2] = 190; img.data[i + 3] = k === 2 ? 70 : 40;
    }
    ctx.putImageData(img, 0, 0);
    out.push(c);
  }
  return out;
}
