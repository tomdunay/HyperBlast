// Pre-renders a level's solid scenery from its tile grid (smoothed + noise for organic edges), keeps a pixel-accurate
// collision mask, and draws: copper-bar sky → far silhouettes → near props → caustics → scenery shadow → foreground
// (with stamped decorations) → additive running lights.
import { makeCanvas, hiCanvas, RES, realSize, snap, fbm, noise2, bayer, Ctx, RGB, RNG, hex } from '../engine/gfx';
import { renderShapes, Shape } from '../art/sprites';
import { glow } from '../engine/light';
import { LevelDef, Theme, W, H, TILE, COLS } from './types';
import { VIEW, MARGIN } from '../engine/view';

/** Scenery is pre-rendered MARGIN px wider than the playfield on each side, for wide views. */
const MW = MARGIN, FW = W + MARGIN * 2;

interface Light { x: number; y: number; color: string; phase: number; r: number }
interface Art { fg: HTMLCanvasElement; mask: Uint8Array; bg: HTMLCanvasElement; shadow: HTMLCanvasElement; lights: Light[]; caustics: HTMLCanvasElement[] }

const foreCache = new Map<string, HTMLCanvasElement>();
const nearCache = new Map<string, HTMLCanvasElement>();
const themeIds = new WeakMap<Theme, number>();
let themeN = 0;
/** cache key for view-width dependent layers */
const themeKey = (th: Theme) => { let id = themeIds.get(th); if (id === undefined) { id = ++themeN; themeIds.set(th, id); } return id + '|' + VIEW.w; };
const BH = 480; // background tile height: a multiple of every pattern period so it wraps seamlessly

export class Scroller {
  lv: LevelDef;
  hpx: number;
  mask!: Uint8Array;
  fg!: HTMLCanvasElement;
  bg!: HTMLCanvasElement;
  shadow!: HTMLCanvasElement;
  /** solid mask across the full pre-rendered width (playfield + both margins), build time only */
  private wide = new Uint8Array(0);
  lights: Light[] = [];
  caustics: HTMLCanvasElement[] = [];
  y = 0;
  oy = 0;
  maxY = 0;
  endY: number;
  static cache = new Map<LevelDef, Art>();

  constructor(lv: LevelDef, bare = false) {
    this.lv = lv;
    this.hpx = lv.rows.length * TILE;
    this.endY = this.hpx - H;
    if (bare) return;
    let art = Scroller.cache.get(lv);
    if (!art) {
      // finish (or run) the level's art build now
      const j = Scroller.job(lv);
      let r = j.next();
      while (!r.done) r = j.next();
      art = r.value;
      Scroller.jobs.delete(lv);
    } else { Scroller.cache.delete(lv); Scroller.cache.set(lv, art); }
    Object.assign(this, art);
  }

  /** In-progress incremental art builds (at most one at a time). */
  private static jobs = new Map<LevelDef, Generator<undefined, Art>>();
  private static job(lv: LevelDef) {
    let j = Scroller.jobs.get(lv);
    if (!j) {
      Scroller.jobs.clear(); // drop any abandoned build: they hold large buffers
      j = new Scroller(lv, true).gen();
      Scroller.jobs.set(lv, j);
    }
    return j;
  }
  /**
   * Advance a level's art build for up to `ms` milliseconds (call every tick from a loading-friendly scene, such as
   * the level intro card or the title). Returns true once the art is ready, so constructing the Scroller is instant.
   */
  static prepare(lv: LevelDef, ms: number) {
    if (Scroller.cache.has(lv)) return true;
    const j = Scroller.job(lv);
    const t0 = performance.now();
    while (performance.now() - t0 < ms) if (j.next().done) { Scroller.jobs.delete(lv); return true; }
    return false;
  }

  /** The full art build as a resumable generator: yields every few milliseconds of work. */
  private *gen(): Generator<undefined, Art> {
    const lv = this.lv;
    this.mask = new Uint8Array(W * this.hpx);
    this.wide = new Uint8Array(FW * this.hpx);
    this.lights = [];
    yield* this.buildFg();
    const bg = yield* buildBackground(lv.theme);
    yield;
    const shadow = yield* this.buildShadow();
    yield;
    const caustics = lv.theme.ambient === 'bubbles' ? yield* buildCaustics() : [];
    const art: Art = { fg: this.fg, mask: this.mask, bg, shadow, lights: this.lights, caustics };
    this.wide = new Uint8Array(0);
    // wide scenery canvases are big: keep only the two most recently used levels
    while (Scroller.cache.size >= 2) Scroller.cache.delete(Scroller.cache.keys().next().value!);
    Scroller.cache.set(lv, art);
    return art;
  }

  private *buildFg(): Generator<undefined, void> {
    const lv = this.lv, th = lv.theme, Hp = this.hpx, nRows = lv.rows.length;
    const tileAt = (c: number, rTop: number) => {
      c = Math.max(0, Math.min(COLS - 1, c));
      rTop = Math.max(0, Math.min(nRows - 1, rTop));
      return lv.rows[nRows - 1 - rTop][c];
    };
    // low-frequency noise terms are sampled on a coarse grid and interpolated (identical look, a fraction of the cost)
    const coarse = (step: number, f: (px: number, py: number) => number) => {
      const gw = Math.ceil(FW / step) + 2, gh = Math.ceil(Hp / step) + 2;
      const g = new Float32Array(gw * gh);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) g[j * gw + i] = f(i * step - MW, j * step);
      return (fxp: number, py: number) => {
        const u = fxp / step, v = py / step, i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, k = j * gw + i;
        return (g[k] * (1 - a) + g[k + 1] * a) * (1 - b) + (g[k + gw] * (1 - a) + g[k + gw + 1] * a) * b;
      };
    };
    const wingN = coarse(4, (x, y) => fbm(x * 0.018, y * 0.018, 57, 3));
    const lumpN = coarse(2, (x, y) => fbm(x * 0.045, y * 0.045, 33, 3));
    const strataN = coarse(6, (x, y) => fbm(x * 0.011, y * 0.011, 21, 2));
    const aoN = coarse(3, (x, y) => fbm(x * 0.03, y * 0.03, 5, 2));
    yield;
    // the field covers the playfield plus a margin either side; the margins continue the edge tiles and close up
    // into organic cave walls further out (purely visual: collision only uses the playfield part)
    const field = new Float32Array(FW * Hp);
    for (let py = 0; py < Hp; py++) {
      if ((py & 31) === 31) yield;
      const ty = py / TILE - 0.5, r0 = Math.floor(ty), fy = ty - r0;
      for (let fxp = 0; fxp < FW; fxp++) {
        const px = fxp - MW;
        const tx = px / TILE - 0.5, c0 = Math.floor(tx), fx = tx - c0;
        const a = tileAt(c0, r0), b = tileAt(c0 + 1, r0), c = tileAt(c0, r0 + 1), d = tileAt(c0 + 1, r0 + 1);
        let v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
        if (px < 0 || px >= W) {
          const out = (px < 0 ? -px : px - W + 1) / MW;
          const n = wingN(fxp, py);
          v = Math.max(v, Math.min(1, out * 1.5 + (n - 0.5) * 1.6 - 0.18));
        }
        if (th.wobble > 0 && v > 0.02 && v < 0.98) v += (fbm(px * 0.07, py * 0.07, 7, 2) - 0.5) * th.wobble * 2;
        field[py * FW + fxp] = v;
      }
    }
    const N = FW * Hp;
    // 1) solid masks
    for (let py = 1; py < Hp - 1; py++) for (let fxp = 0; fxp < FW; fxp++) {
      const i = py * FW + fxp;
      if (field[i] <= 0.5) continue;
      this.wide[i] = 1;
      const px = fxp - MW;
      if (px >= 0 && px < W) this.mask[py * W + px] = 1;
    }
    // 2) chamfer (3-4) distance to the nearest open pixel, capped: the basis of the rock relief
    const R = th.tex === 'metal' || th.tex === 'biomech' ? 9 : 20; // bevel radius in px (machined vs organic)
    const CAP = R * 3;
    const dist = new Uint16Array(N);
    const wide = this.wide;
    for (let i = 0; i < N; i++) dist[i] = wide[i] ? CAP : 0;
    for (let y = 1; y < Hp; y++) for (let x = 0; x < FW; x++) {
      if (x === 0 && (y & 127) === 127) yield;
      const i = y * FW + x;
      if (!dist[i]) continue;
      let v = dist[i];
      if (x > 0) { v = Math.min(v, dist[i - 1] + 3, dist[i - FW - 1] + 4); }
      v = Math.min(v, dist[i - FW] + 3);
      if (x < FW - 1) v = Math.min(v, dist[i - FW + 1] + 4);
      dist[i] = v;
    }
    for (let y = Hp - 2; y >= 0; y--) for (let x = FW - 1; x >= 0; x--) {
      if (x === 0 && (y & 127) === 0) yield;
      const i = y * FW + x;
      if (!dist[i]) continue;
      let v = dist[i];
      if (x < FW - 1) { v = Math.min(v, dist[i + 1] + 3, dist[i + FW + 1] + 4); }
      v = Math.min(v, dist[i + FW] + 3);
      if (x > 0) v = Math.min(v, dist[i + FW - 1] + 4);
      dist[i] = v;
    }
    // 3) height map: rounded bevel from the distance + embossed surface texture
    const hmap = new Float32Array(N), texL = new Float32Array(N), texA = new Uint8Array(N), lowL = new Float32Array(N);
    const metal = th.tex === 'metal' || th.tex === 'biomech';
    for (let py = 0; py < Hp; py++) for (let fxp = 0; fxp < FW; fxp++) {
      if (fxp === 0 && (py & 31) === 31) yield;
      const i = py * FW + fxp;
      if (!wide[i]) continue;
      const px = fxp - MW;
      const t = texture(th, px, py);
      texL[i] = t.l; texA[i] = t.alt ? 1 : 0;
      const d = Math.min(1, dist[i] / CAP);
      const dome = metal ? Math.min(1, d * 1.6) : 1 - (1 - d) * (1 - d);
      const lump = metal ? 0 : (lumpN(fxp, py) - 0.5) * 0.55 * Math.min(1, d * 2);
      hmap[i] = dome + lump + t.l * (metal ? 0.3 : 0.22);
      // low-frequency light terms: large-scale strata / plates, and the deep interior receding into shadow
      let low = (strataN(fxp, py) - 0.5) * 0.34;
      if (d >= 1) low -= Math.min(0.2, Math.max(0, aoN(fxp, py) - 0.3) * 0.35);
      lowL[i] = low;
    }
    void texA;
    // 4) light it at full art resolution: the 1× maps are sampled bilinearly (smooth contours and bevels), surface
    //    texture and micro relief are evaluated per real pixel. Lambert from the upper left, specular highlights,
    //    a soft rim light on edges facing the light and a contact shadow on the far side.
    const r = RES, W2 = FW * r, H2 = Hp * r;
    const [cv, ctx] = hiCanvas(FW, Hp);
    const pack = (c: RGB) => (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
    const LL = Math.hypot(0.55, 0.7, 0.62), Lx = -0.55 / LL, Ly = -0.7 / LL, Lz = 0.62 / LL;
    const K = (metal ? 9 : 7) * r;
    const fine = metal ? 0.006 : 0.035;
    const gridTex = th.tex === 'metal';
    // tileable micro-relief noise (128×128 real px), looked up instead of evaluated per pixel
    const micro = new Float32Array(128 * 128);
    {
      const rng = new RNG(4242), raw = new Float32Array(128 * 128).map(() => rng.next() - 0.5);
      // wrapped 3×3 blur: smooth, periodic high-frequency grain
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += raw[(((y + dy) & 127) << 7) | ((x + dx) & 127)];
        micro[(y << 7) | x] = sum / 9 * 2.4;
      }
    }
    // bilinear sampling tables (real pixel -> 1× index + weight)
    const xi = new Int32Array(W2), xw = new Float32Array(W2);
    for (let X = 0; X < W2; X++) { const f = (X + 0.5) / r - 0.5; const i0 = Math.max(0, Math.min(FW - 2, Math.floor(f))); xi[X] = i0; xw[X] = Math.max(0, Math.min(1, f - i0)); }
    const bil = (a: ArrayLike<number>, X: number, j0: number, wy: number) => {
      const i = j0 * FW + xi[X], wx = xw[X];
      const top = a[i] + (a[i + 1] - a[i]) * wx, bot = a[i + FW] + (a[i + FW + 1] - a[i + FW]) * wx;
      return top + (bot - top) * wy;
    };
    const rowJ = (Y: number): [number, number] => { const f = (Y + 0.5) / r - 0.5; const j0 = Math.max(0, Math.min(Hp - 2, Math.floor(f))); return [j0, Math.max(0, Math.min(1, f - j0))]; };
    // rolling 5-row window of field + height at real resolution
    const RW = 5;
    const fR = Array.from({ length: RW }, () => new Float32Array(W2)), hR = Array.from({ length: RW }, () => new Float32Array(W2));
    const fillRow = (Y: number, f: Float32Array, h: Float32Array) => {
      if (Y < 0 || Y >= H2) { f.fill(1); h.fill(1); return; }
      const [j0, wy] = rowJ(Y);
      for (let X = 0; X < W2; X++) {
        const fv = bil(field, X, j0, wy);
        f[X] = fv;
        h[X] = fv > 0.45 ? bil(hmap, X, j0, wy) + micro[((Y & 127) << 7) | (X & 127)] * fine : 0;
      }
    };
    for (let k = 0; k < RW; k++) fillRow(k - 2, fR[k], hR[k]);
    const STRIP = 128;
    const img = ctx.createImageData(W2, STRIP);
    const out = new Uint32Array(img.data.buffer);
    for (let Y = 0; Y < H2; Y++) {
      if ((Y & 15) === 15) yield;
      if (Y > 0) { // advance the window: rows Y-2..Y+2
        const f0 = fR.shift()!, h0 = hR.shift()!;
        fillRow(Y + 2, f0, h0);
        fR.push(f0); hR.push(h0);
      }
      const sy = Y % STRIP;
      if (sy === 0) out.fill(0);
      const [fU2, fU, fC, fD, fD2] = fR, [, hU, hC, hD] = hR;
      const [j0, wy] = rowJ(Y);
      const ly = (Y + 0.5) / r - 0.5;
      for (let X = 1; X < W2 - 1; X++) {
        if (fC[X] <= 0.5) continue;
        const lx = (X + 0.5) / r - 0.5 - MW;
        const hx = (hC[X + 1] - hC[X - 1]) * K, hy = (hD[X] - hU[X]) * K;
        const nl = Math.sqrt(hx * hx + hy * hy + 1);
        const lam = (-hx * Lx - hy * Ly + Lz) / nl;
        // machined themes evaluate their (cheap, crisp) texture per real pixel; noise themes reuse the 1× texture
        const t = gridTex ? texture(th, Math.floor(lx), Math.floor(ly))
          : { l: bil(texL, X, j0, wy), alt: texA[Math.min(Hp - 1, Math.round(ly)) * FW + Math.min(FW - 1, Math.round(lx + MW))] === 1 };
        let l = 0.06 + Math.max(0, lam) * 0.82 + t.l * 0.55 + bil(lowL, X, j0, wy);
        // specular: half-vector towards a viewer straight above
        const hz = (-hx * Lx * 0.5 - hy * Ly * 0.5 + (Lz + 1) * 0.5) / nl;
        if (metal) { const q = Math.max(0, hz - 0.82) / 0.18; l += q * q * 0.45; }
        else { const q = Math.max(0, hz - 0.92) / 0.08; l += q * q * 0.24; }
        const ramp = t.alt ? th.alt : th.rock, n = ramp.length - 1;
        let idx = l * n + bayer(X, Y) * 0.5;
        // rim highlight on edges facing the light, dark contact line on the far side (2 real px, fading)
        if (fU[X] <= 0.5 || fC[X - 1] <= 0.5 || fU[X - 1] <= 0.5) idx = Math.max(idx, n - 2);
        else if (fU2[X] <= 0.5 || fC[X - 2] <= 0.5 || fU[X - 2] <= 0.5) idx = Math.max(idx, n - 4.5);
        else if (fD[X] <= 0.5 || fC[X + 1] <= 0.5 || fD[X + 1] <= 0.5) idx = 0;
        else if (fD2[X] <= 0.5 || fC[X + 2] <= 0.5) idx = Math.min(idx, idx * 0.4);
        out[sy * W2 + X] = pack(ramp[Math.max(0, Math.min(n, Math.round(idx)))]);
      }
      if (sy === STRIP - 1 || Y === H2 - 1) ctx.putImageData(img, 0, Y - sy, 0, 0, W2, sy + 1);
    }
    this.fg = cv;
    yield;
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
      ctx.translate(Math.round(cx) + MW, py);
      if (side === 'R') ctx.scale(-1, 1);
      if (d.rot) ctx.rotate(side === 'L' ? Math.PI / 2 : Math.PI / 2);
      ctx.drawImage(s, -(s.width >> 1), -(s.height >> 1));
      ctx.restore();
      if (d.light) this.lights.push({ x: Math.round(cx), y: py, color: d.light, phase: rng.next() * 6, r: d.lightR ?? 6 });
    }
    // decorations on the cave walls out in the margins (inward-facing edges only)
    for (let py = 40; py < Hp - 40; py += rng.int(18, 34)) {
      const side = rng.next() < 0.5 ? 'L' : 'R';
      let ex = -9999;
      if (side === 'L') { for (let fx = 2; fx < MW - 4; fx++) if (this.wide[py * FW + fx] && !this.wide[py * FW + fx + 1]) { ex = fx - MW; break; } }
      else { for (let fx = FW - 3; fx > FW - MW + 4; fx--) if (this.wide[py * FW + fx] && !this.wide[py * FW + fx - 1]) { ex = fx - MW; break; } }
      if (ex === -9999) continue;
      const d = rng.pick(set.edge), sp = d.spr;
      const cx = side === 'L' ? ex - d.inset : ex + d.inset;
      ctx.save();
      ctx.translate(Math.round(cx) + MW, py);
      if (side === 'R') ctx.scale(-1, 1);
      ctx.drawImage(sp, -(sp.width >> 1), -(sp.height >> 1));
      ctx.restore();
      if (d.light) this.lights.push({ x: Math.round(cx), y: py, color: d.light, phase: rng.next() * 6, r: d.lightR ?? 6 });
    }
    // fossils / panels embedded deep inside walls
    if (set.inner.length) {
      for (let k = 0; k < (Hp * FW) / W / 22; k++) {
        const x = rng.int(10 - MW, W + MW - 10), y = rng.int(20, Hp - 20);
        let solid = true;
        for (let dy = -9; dy <= 9 && solid; dy += 3) for (let dx = -9; dx <= 9; dx += 3) if (!this.wide[(y + dy) * FW + x + dx + MW]) { solid = false; break; }
        if (!solid) continue;
        const d = rng.pick(set.inner);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(d.spr, x + MW - (d.spr.width >> 1), y - (d.spr.height >> 1));
        ctx.globalAlpha = 1;
        if (d.light) this.lights.push({ x, y, color: d.light, phase: rng.next() * 6, r: d.lightR ?? 5 });
      }
    }
    this.lights.sort((a, b) => a.y - b.y);
  }

  /** Soft drop shadow of the scenery cast down-right onto the background layers (penumbra widens with distance). */
  private *buildShadow(): Generator<undefined, HTMLCanvasElement> {
    const Hp = this.hpx, m = this.wide;
    const [c, ctx] = makeCanvas(FW, Hp);
    const img = ctx.createImageData(FW, Hp);
    const d = img.data;
    // summed-area table of the solid mask for fast box averages
    const SW = FW + 1;
    const sat = new Uint32Array(SW * (Hp + 1));
    yield;
    for (let y = 0; y < Hp; y++) { let row = 0; for (let x = 0; x < FW; x++) { row += m[y * FW + x]; sat[(y + 1) * SW + x + 1] = sat[y * SW + x + 1] + row; } }
    const box = (x0: number, y0: number, x1: number, y1: number) => {
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(FW, x1); y1 = Math.min(Hp, y1);
      if (x1 <= x0 || y1 <= y0) return 0;
      return (sat[y1 * SW + x1] - sat[y0 * SW + x1] - sat[y1 * SW + x0] + sat[y0 * SW + x0]) / ((x1 - x0) * (y1 - y0));
    };
    for (let y = 0; y < Hp; y++) for (let x = 0; x < FW; x++) {
      if (x === 0 && (y & 63) === 63) yield;
      const i = y * FW + x;
      if (m[i]) continue;
      // tight contact shadow + wide soft shadow
      const a = box(x - 9, y - 11, x - 4, y - 6) * 0.55 + box(x - 15, y - 18, x - 3, y - 4) * 0.4;
      if (a <= 0.01) continue;
      d[i * 4] = 6; d[i * 4 + 1] = 0; d[i * 4 + 2] = 14; d[i * 4 + 3] = Math.round(Math.min(1, a) * 215);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  private topRow(scroll: number) { return this.hpx - H - Math.round(scroll); }
  /** render-time top row: snapped to the art-resolution grid so the scenery scrolls smoothly */
  private drawTop(scroll: number) { return this.hpx - H - snap(scroll); }

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
    for (let y = 0; y < H; y += 1) {
      const k = Math.sin((y / H) * Math.PI);
      const bar = Math.pow(Math.max(0, Math.sin((y + s * 0.15) * 0.045 + t * 0.012)), 10) * 0.55;
      const r = c0[0] + (c1[0] - c0[0]) * k, g = c0[1] + (c1[1] - c0[1]) * k, b = c0[2] + (c1[2] - c0[2]) * k;
      const q = (v: number, add: number) => Math.min(255, Math.round(v + add));
      ctx.fillStyle = `rgb(${q(r, r * bar + 18 * bar)},${q(g, g * bar + 24 * bar)},${q(b, b * bar + 40 * bar)})`;
      ctx.fillRect(-VIEW.ox, y, VIEW.w, 1);
    }
    const tile = (img: HTMLCanvasElement, f: number) => {
      const off = snap((s * f) % BH);
      for (let y = off - BH; y < H; y += BH) ctx.drawImage(img, -MW, y);
    };
    tile(this.bg, 0.35);
    const nk = themeKey(th);
    let near = nearCache.get(nk);
    if (!near) { near = buildNear(th); nearCache.set(nk, near); }
    tile(near, 0.7);
    if (this.caustics.length) {
      const f = this.caustics[Math.floor(t / 4) % this.caustics.length];
      ctx.globalCompositeOperation = 'lighter';
      this.tileCaustics(ctx, f, snap((s * 0.7) % 256));
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  /** Caustic frames (160×128, drawn at 2×) tiled across the whole view. */
  private tileCaustics(ctx: Ctx, f: HTMLCanvasElement, off: number) {
    const x0 = -Math.ceil(VIEW.ox / 320) * 320;
    for (let y = off - 256; y < H; y += 256) for (let x = x0; x < W + VIEW.ox; x += 320) ctx.drawImage(f, x, y, 320, 256);
  }
  /** Foreground silhouettes rushing past at 1.45x, hugging the view edges — sells the sense of speed and depth. */
  drawFore(ctx: Ctx, alpha: number) {
    const th = this.lv.theme;
    const k = themeKey(th);
    let fore = foreCache.get(k);
    if (!fore) { fore = buildFore(th); foreCache.set(k, fore); }
    const off = snap((this.scrollAt(alpha) * 1.45) % BH);
    for (let y = off - BH; y < H; y += BH) ctx.drawImage(fore, -VIEW.ox, y);
  }
  drawShadow(ctx: Ctx, alpha: number) {
    ctx.imageSmoothingEnabled = true;
    this.blit(ctx, this.shadow, alpha);
    ctx.imageSmoothingEnabled = false;
  }
  drawFg(ctx: Ctx, alpha: number) { this.blit(ctx, this.fg, alpha); }
  private blit(ctx: Ctx, c: HTMLCanvasElement, alpha: number) {
    const top = this.drawTop(this.scrollAt(alpha));
    const sy = Math.max(0, top), dy = sy - top;
    const h = Math.min(H - dy, this.hpx - sy);
    if (h > 0) ctx.drawImage(c, MW - VIEW.ox, sy, VIEW.w, h, -VIEW.ox, dy, VIEW.w, h);
  }
  /** Additive running lights embedded in the scenery, plus caustic shimmer over the walls. */
  drawLights(ctx: Ctx, alpha: number, t: number) {
    const top = this.drawTop(this.scrollAt(alpha));
    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.lights) {
      const y = L.y - top;
      if (y < -20) continue;
      if (y > H + 20) break;
      if (L.x < -VIEW.ox - 20 || L.x > W + VIEW.ox + 20) continue;
      const on = Math.sin(t * 0.08 + L.phase) > -0.3;
      if (!on) continue;
      const g = glow(L.r + (Math.sin(t * 0.2 + L.phase) > 0.6 ? 2 : 0), L.color);
      ctx.drawImage(g, L.x - (g.width >> 1), Math.round(y) - (g.height >> 1));
    }
    if (this.caustics.length) {
      ctx.globalAlpha = 0.45;
      const f = this.caustics[(Math.floor(t / 4) + 5) % this.caustics.length];
      this.tileCaustics(ctx, f, snap(this.scrollAt(alpha) % 256));
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

/** Near-FOREGROUND silhouettes (1.45x parallax) hugging the screen edges, drawn over everything but the HUD. */
export function buildFore(th: Theme): HTMLCanvasElement {
  const W = VIEW.w; // built per view width so the silhouettes always hug the visible edges
  const [c, ctx] = hiCanvas(W, BH);
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
      // dark body with a gentle gradient towards the screen edge
      const g = ctx.createLinearGradient(x0, 0, x0 + dir * depth, 0);
      g.addColorStop(0, `rgb(${th.far[0].map((v) => Math.round(v * 0.3)).join(',')})`); g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + off) : ctx.moveTo(x, y + off))); ctx.fill();
    }
  }
  // depth of field: these shapes are right in front of the camera, so they are out of focus
  const [c2, ctx2] = hiCanvas(W, BH);
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.filter = `blur(${RES * 1.2}px)`;
  ctx2.drawImage(c, 0, 0, ...realSize(c));
  return c2;
}

/** Near-background prop layer (0.7x parallax), transparent except for theme props. */
function buildNear(th: Theme): HTMLCanvasElement {
  const [c, ctx] = hiCanvas(FW, BH);
  ctx.translate(MW, 0);
  // props hug the view edges; wide views also get extra props out in the margins
  const L = -VIEW.ox, R = W + VIEW.ox, extra = Math.round(VIEW.ox / 40);
  const f = th.far, base = `rgb(${f[3].join(',')})`, hi = `rgb(${f[3].map((v) => Math.min(255, v + 34)).join(',')})`, lo = `rgb(${f[1].join(',')})`;
  const rng = new RNG(99 + th.tex.length);
  ctx.lineCap = 'round';
  const stroke = (w: number, col: string, path: () => void) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); path(); ctx.stroke(); };
  switch (th.tex) {
    case 'coral':
      for (let k = 0; k < 9 + extra; k++) {
        const x0 = rng.range(L + 20, R - 20), amp = rng.range(6, 16), ph = rng.range(0, 6), w = rng.int(3, 5);
        const path = () => { for (let y = 0; y <= BH; y += 8) { const x = x0 + Math.sin((y / BH) * Math.PI * 4 + ph) * amp; y ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
        stroke(w + 2, lo, path); stroke(w, base, path); stroke(1, hi, path);
      }
      break;
    case 'bone':
      for (let y = 40; y < BH; y += 120) for (const side of [0, 1]) {
        const x0 = side ? R + 10 : L - 10, dir = side ? -1 : 1;
        const path = () => { ctx.moveTo(x0, y); ctx.quadraticCurveTo(x0 + dir * 130, y - 40, x0 + dir * 120, y + 60); };
        stroke(9, lo, path); stroke(7, base, path); stroke(2, hi, path);
      }
      break;
    case 'vine':
      for (let k = 0; k < 8 + extra; k++) {
        const x0 = rng.range(L + 10, R - 10), ph = rng.range(0, 6);
        const path = () => { for (let y = 0; y <= BH; y += 6) { const x = x0 + Math.sin((y / BH) * Math.PI * 6 + ph) * 10; y ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
        stroke(4, lo, path); stroke(2, base, path);
        for (let y = 10; y < BH; y += 24) { const x = x0 + Math.sin((y / BH) * Math.PI * 6 + ph) * 10; ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(x + 4, y, 5, 2, 0.5, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    case 'biomech':
      for (const x of [36, 284, ...(VIEW.ox > 50 ? [L + 30, R - 30] : [])]) { ctx.fillStyle = lo; ctx.fillRect(x - 8, 0, 16, BH); ctx.fillStyle = base; ctx.fillRect(x - 6, 0, 12, BH); ctx.fillStyle = hi; ctx.fillRect(x - 3, 0, 2, BH); for (let y = 0; y < BH; y += 60) { ctx.fillStyle = lo; ctx.fillRect(x - 10, y, 20, 8); ctx.fillStyle = hi; ctx.fillRect(x - 10, y, 20, 1); } }
      for (let y = 30; y < BH; y += 160) { ctx.fillStyle = lo; ctx.fillRect(L, y - 6, R - L, 12); ctx.fillStyle = base; ctx.fillRect(L, y - 4, R - L, 8); ctx.fillStyle = hi; ctx.fillRect(L, y - 3, R - L, 1); }
      break;
    case 'metal':
      for (const x of [24, 296, ...(VIEW.ox > 50 ? [L + 26, R - 26] : [])]) {
        ctx.fillStyle = base; ctx.fillRect(x - 5, 0, 10, BH);
        ctx.fillStyle = hi; ctx.fillRect(x - 5, 0, 1, BH);
        for (let y = 0; y < BH; y += 40) stroke(2, lo, () => { ctx.moveTo(x - 5, y); ctx.lineTo(x + (x < 160 ? 40 : -40), y + 40); });
      }
      for (let y = 0; y < BH; y += 96) { ctx.fillStyle = lo; ctx.fillRect(L, y, R - L, 6); ctx.fillStyle = hi; ctx.fillRect(L, y, R - L, 1); }
      break;
    case 'crystal':
      // giant translucent shards leaning in from the sides
      for (let k = 0; k < 10; k++) {
        const side = k % 2, y = (k * 53 + rng.int(0, 30)) % BH, len = rng.range(50, 110), wd = rng.range(10, 22);
        const x0 = side ? R + 4 : L - 4, dir = side ? -1 : 1, tilt = rng.range(-0.5, 0.5);
        ctx.fillStyle = lo; ctx.beginPath(); ctx.moveTo(x0, y - wd); ctx.lineTo(x0 + dir * len, y + tilt * len); ctx.lineTo(x0, y + wd); ctx.fill();
        ctx.fillStyle = base; ctx.beginPath(); ctx.moveTo(x0, y - wd * 0.6); ctx.lineTo(x0 + dir * len * 0.95, y + tilt * len); ctx.lineTo(x0, y); ctx.fill();
        stroke(1, hi, () => { ctx.moveTo(x0, y - wd * 0.6); ctx.lineTo(x0 + dir * len * 0.95, y + tilt * len); });
      }
      break;
    case 'lava':
      // basalt columns with glowing seams
      for (const x of [18, 50, 270, 302, ...(VIEW.ox > 40 ? [L + 14, R - 14] : [])]) {
        const w = 22;
        ctx.fillStyle = lo; ctx.fillRect(x - w / 2, 0, w, BH);
        ctx.fillStyle = base; ctx.fillRect(x - w / 2 + 2, 0, w - 6, BH);
        ctx.fillStyle = hi; ctx.fillRect(x - w / 2 + 2, 0, 1, BH);
        for (let y = rng.int(0, 40); y < BH; y += rng.int(30, 70)) { ctx.fillStyle = '#aa3300'; ctx.fillRect(x - w / 2, y, w, 2); ctx.fillStyle = '#ff7722'; ctx.fillRect(x - w / 2 + 3, y, w - 8, 1); }
      }
      break;
  }
  return c;
}

function* buildBackground(th: Theme): Generator<undefined, HTMLCanvasElement> {
  const r = RES;
  const [c, ctx] = hiCanvas(FW, BH);
  const [RW, RH] = realSize(c);
  const img = ctx.createImageData(RW, RH);
  const d = img.data;
  const far = th.far;
  const farAt = (v: number): RGB => {
    const t = Math.max(0, Math.min(1, v)) * (far.length - 1), i = Math.min(far.length - 2, Math.floor(t)), f = t - i;
    return [0, 1, 2].map((k) => far[i][k] + (far[i + 1][k] - far[i][k]) * f) as RGB;
  };
  // periodic noise: blend sample at y and y-BH
  const pn = (x: number, y: number, s: number, seed: number) => {
    const t = y / BH;
    return fbm(x * s, y * s, seed, 3) * (1 - t) + fbm(x * s, (y - BH) * s, seed, 3) * t;
  };
  for (let Y = 0; Y < RH; Y++)
    for (let X = 0; X < RW; X++) {
      if (X === 0 && (Y & 15) === 15) yield;
      const y = (Y + 0.5) / r, x = (X + 0.5) / r - MW;
      let v: number, a = 1;
      switch (th.tex) {
        case 'metal': {
          const gx = (((x + 8) % 64) + 64) % 64, gy = y % 48;
          v = gx < 3 || gy < 2 ? 0.75 - (gx < 1 || gy < 0.5 ? 0 : 0.2) : pn(x, y, 0.02, 3) > 0.6 ? 0.5 : -1;
          if (gx > 20 && gx < 44 && gy > 10 && gy < 38) v = (gy % 4) < 1 ? 0.55 : 0.3 + (gx - 20) / 24 * 0.1;
          break;
        }
        case 'biomech': {
          const n = pn(x, y, 0.025, 4);
          const pipe = Math.abs((((x + 40 + Math.sin((y * Math.PI * 6) / BH) * 20) % 80) + 80) % 80 - 40);
          if (pipe < 6) v = 0.85 - pipe * 0.1 + (pipe < 2 ? 0.1 : 0);
          else { v = (n - 0.55) * 4; a = Math.max(0, Math.min(1, (n - 0.55) / 0.02)); }
          break;
        }
        default: {
          const n = pn(x, y, 0.018, 5);
          const edge = Math.max(-0.25, Math.min(x, W - x) / W);
          const sdf = n + (0.3 - edge) * 0.9 - 0.62;
          v = (n - 0.4) * 2 + Math.max(0, 0.04 - sdf) * 4; // brighter rim at the silhouette edge
          a = Math.max(0, Math.min(1, sdf / 0.015 + 0.5));
        }
      }
      if (v < 0 || a <= 0) continue;
      const col = farAt(v);
      const i = (Y * RW + X) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  // slight defocus: it is far away
  const [c2, ctx2] = hiCanvas(FW, BH);
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.filter = 'blur(0.8px)';
  ctx2.drawImage(c, 0, 0, RW, RH);
  return c2;
}

/** Animated underwater caustic light pattern (12 frames, 320x256 logical, art resolution). */
function* buildCaustics(): Generator<undefined, HTMLCanvasElement[]> {
  const out: HTMLCanvasElement[] = [];
  const NF = 12;
  for (let f = 0; f < NF; f++) {
    const [c, ctx] = hiCanvas(320, 256);
    const [RW, RH] = realSize(c);
    const img = ctx.createImageData(RW, RH);
    const ph = (f / NF) * Math.PI * 2;
    for (let Y = 0; Y < RH; Y++) for (let X = 0; X < RW; X++) {
      // tile is 160x128 logical cells; frequencies are whole cycles per tile so the pattern wraps seamlessly
      const x = (X + 0.5) / RES / 2, y = (Y + 0.5) / RES / 2;
      const T = Math.PI * 2, fx = T / 160, fy = T / 128;
      const a = Math.sin(x * fx * 3 + Math.sin(y * fy + ph) * 2.2 + ph);
      const b = Math.sin(y * fy * 3 + Math.sin(x * fx * 2 - ph) * 2.0 - ph);
      const v = 1 - Math.abs(a + b) * 0.5;
      const k = Math.max(0, (v - 0.72) / 0.28);
      if (k <= 0) continue;
      const i = (Y * RW + X) * 4;
      img.data[i] = 70; img.data[i + 1] = 170; img.data[i + 2] = 210; img.data[i + 3] = Math.round(k * k * 70);
    }
    ctx.putImageData(img, 0, 0);
    out.push(c);
    yield;
  }
  return out;
}
