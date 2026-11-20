// Low-level graphics helpers: canvases, colour ramps, procedural pixel-art builder.
//
// Resolution: game code works in logical 320×256 pixels, but art is rendered at RES× that. A "hi-res" canvas carries
// its logical size in .width/.height (the real bitmap size is ._rw × ._rh) and a ._r scale factor; drawImage is
// patched so drawing one at (x, y) places it at its logical size. Canvases without ._r are plain 1× images.
export type Ctx = CanvasRenderingContext2D;
export type RGB = [number, number, number];

/** Art resolution multiplier (real pixels per logical pixel). */
export const RES = 2;

export type HiCanvas = HTMLCanvasElement & { _r?: number; _rw?: number; _rh?: number };

// --- drawImage patch: hi-res canvases draw at their logical size; 9-arg source rects are in logical pixels ---
{
  const P = CanvasRenderingContext2D.prototype as any;
  if (!P.__hiPatched) {
    const od = P.drawImage;
    P.drawImage = function (this: Ctx, img: any, a: number, b: number, c?: number, d?: number, e?: number, f?: number, g?: number, h?: number) {
      const r = img && img._r;
      if (r) {
        if (arguments.length === 3) return od.call(this, img, a, b, img._rw / r, img._rh / r);
        if (arguments.length === 9) return od.call(this, img, a * r, b * r, c! * r, d! * r, e, f, g, h);
      }
      return od.apply(this, arguments as any);
    };
    P.__hiPatched = true;
  }
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Mark a canvas whose bitmap is r× its logical size (call after any getContext). */
export function markHi(c: HTMLCanvasElement, r: number): HiCanvas {
  const hc = c as HiCanvas;
  const W = c.width, H = c.height;
  hc._r = r; hc._rw = W; hc._rh = H;
  Object.defineProperty(c, 'width', { get: () => W / r, configurable: true });
  Object.defineProperty(c, 'height', { get: () => H / r, configurable: true });
  return hc;
}

/**
 * A canvas of logical size w×h rendered at r× resolution. Its context is pre-scaled, so drawing code can use logical
 * coordinates. Use ._rw/._rh (or realSize) for raw pixel access.
 */
export function hiCanvas(w: number, h: number, r = RES): [HiCanvas, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * r));
  c.height = Math.max(1, Math.ceil(h * r));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(r, 0, 0, r, 0, 0);
  return [markHi(c, r), ctx];
}
export const resOf = (c: HTMLCanvasElement) => (c as HiCanvas)._r ?? 1;
export const realSize = (c: HTMLCanvasElement): [number, number] => [(c as HiCanvas)._rw ?? c.width, (c as HiCanvas)._rh ?? c.height];
/** Same logical size and resolution as src. */
export const likeCanvas = (src: HTMLCanvasElement) => hiCanvas(src.width, src.height, resOf(src));

export function hex(h: string): RGB {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

/** Build an n-step ramp by interpolating between hex stops (dark -> light). */
export function ramp(stops: string[], n = 16): RGB[] {
  const s = stops.map(hex);
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (s.length - 1);
    const a = Math.floor(t), b = Math.min(s.length - 1, a + 1), f = t - a;
    // smoothstep between stops keeps the ramp from banding at the joins
    const g = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
    const c: RGB = [0, 0, 0];
    for (let k = 0; k < 3; k++) c[k] = Math.round(s[a][k] * (1 - g) + s[b][k] * g);
    out.push(c);
  }
  return out;
}

export const RAMPS = {
  metal: ramp(['#0a0f1c', '#22304e', '#4a5c8a', '#7f92c4', '#b9c8ee', '#f0f6ff']),
  chrome: ramp(['#0a0a18', '#2c3a5a', '#6a88b0', '#b4d4ee', '#f4ffff', '#ffffff']),
  gold: ramp(['#1a0c00', '#4e3000', '#9a6a0a', '#e0aa22', '#ffe066', '#fffbe0']),
  flesh: ramp(['#1a000c', '#4c1626', '#963e52', '#e07888', '#ffb4c0', '#fff0ea']),
  green: ramp(['#000c00', '#0c3418', '#226a34', '#4caa48', '#a2e070', '#f2ffc0']),
  slime: ramp(['#001a0e', '#0a4a32', '#16865e', '#3ccc96', '#9cf4cc', '#f2fff4']),
  purple: ramp(['#0c001a', '#33184e', '#663490', '#a464d4', '#dca8f4', '#fff2ff']),
  red: ramp(['#1a0000', '#4e0a0a', '#a01818', '#e8442a', '#ff9a60', '#fff2c0']),
  bone: ramp(['#1a140c', '#4a3e30', '#86745a', '#bcab88', '#e4d8b8', '#fffff2']),
  cyan: ramp(['#000c1a', '#0a3e5c', '#1886aa', '#4cd0f0', '#a8f4ff', '#ffffff']),
  orange: ramp(['#1a0600', '#5a2400', '#b05a0a', '#f0962a', '#ffcc66', '#fffbe0']),
  blue: ramp(['#00001a', '#0c1a50', '#1a42a8', '#3c80f0', '#90c4ff', '#f0f8ff']),
  shell: ramp(['#140c00', '#40321a', '#86603a', '#cc9a68', '#f4d0a4', '#fff8ea']),
  dark: ramp(['#000000', '#0a0a10', '#18182a', '#30303e', '#4c4c5e', '#6a6a7c']),
  steel: ramp(['#06060c', '#1e1e2a', '#40404e', '#70707e', '#ababba', '#e8e8f4']),
  eye: ramp(['#1a0000', '#7a0a00', '#e03a00', '#ff9a00', '#ffe060', '#fffff0']),
  yellow: ramp(['#1a0c00', '#4e4000', '#9a8a00', '#e8d020', '#fff480', '#ffffe8']),
};
export type RampName = keyof typeof RAMPS;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47;

// ---------- noise ----------
function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x: number, y: number, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, seed = 0, oct = 3) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * noise2(x * f, y * f, seed + i * 17); amp *= 0.5; f *= 2; }
  return s / (1 - Math.pow(0.5, oct));
}

// ---------- seeded RNG ----------
export class RNG {
  s: number;
  constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next() { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}
export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const rndi = (a: number, b: number) => Math.floor(rnd(a, b + 1));

// ---------- Pixel-art sprite builder ----------
/**
 * Draws shaded primitives into a pixel buffer, quantising lighting to a ramp with fine ordered dithering.
 * Primitive coordinates are logical pixels; the buffer is r× finer (W×H real pixels).
 */
export class SB {
  /** logical size */
  w: number; h: number;
  /** real (buffer) size and scale */
  W: number; H: number; r: number;
  data: Uint32Array; z: Float32Array;
  constructor(w: number, h: number, r = RES) {
    this.w = w; this.h = h; this.r = r;
    this.W = Math.ceil(w * r); this.H = Math.ceil(h * r);
    this.data = new Uint32Array(this.W * this.H);
    this.z = new Float32Array(this.W * this.H).fill(-1e9);
  }
  static pack(c: RGB, a = 255) { return ((a << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  /** write one real pixel */
  pxR(X: number, Y: number, c: RGB, z = 0) {
    X |= 0; Y |= 0;
    if (X < 0 || Y < 0 || X >= this.W || Y >= this.H) return;
    const i = Y * this.W + X;
    if (z < this.z[i]) return;
    this.z[i] = z;
    this.data[i] = SB.pack(c);
  }
  /** write one logical pixel (an r×r block) */
  px(x: number, y: number, c: RGB, z = 0) {
    const X0 = Math.floor(x) * this.r, Y0 = Math.floor(y) * this.r;
    for (let j = 0; j < this.r; j++) for (let i = 0; i < this.r; i++) this.pxR(X0 + i, Y0 + j, c, z);
  }
  get(x: number, y: number) {
    const X = Math.floor(x * this.r), Y = Math.floor(y * this.r);
    return X < 0 || Y < 0 || X >= this.W || Y >= this.H ? 0 : this.data[Y * this.W + X];
  }
  /** Iterate every real pixel; x, y are logical coordinates of the pixel centre minus 0.5 (so x + 0.5 is the centre). */
  each(f: (x: number, y: number, X: number, Y: number) => void, x0 = 0, y0 = 0, x1 = this.w, y1 = this.h) {
    const r = this.r;
    const X0 = Math.max(0, Math.floor(x0 * r)), X1 = Math.min(this.W, Math.ceil(x1 * r));
    const Y0 = Math.max(0, Math.floor(y0 * r)), Y1 = Math.min(this.H, Math.ceil(y1 * r));
    for (let Y = Y0; Y < Y1; Y++) for (let X = X0; X < X1; X++) f((X + 0.5) / r - 0.5, (Y + 0.5) / r - 0.5, X, Y);
  }
  /** Ramp colour for light level l, dithered on the real pixel grid (X, Y are real pixel coords). */
  shadeCol(r: RGB[], l: number, X: number, Y: number, dither = 0.8): RGB {
    const t = l * (r.length - 1) + bayer(X, Y) * dither;
    return r[Math.max(0, Math.min(r.length - 1, Math.round(t)))];
  }
  /** Sphere-shaded ellipse. light: brightness bias. */
  ell(cx: number, cy: number, rx: number, ry: number, r: RGB[], o: { z?: number; bias?: number; spec?: boolean; flat?: boolean; rough?: number; chrome?: boolean } = {}) {
    const z0 = o.z ?? 0, bias = o.bias ?? 0, rough = o.rough ?? 0, seed = (cx * 7.3 + cy * 3.1) | 0;
    this.each((x, y, X, Y) => {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) return;
      const nz = Math.sqrt(1 - d);
      // diffuse from the upper left + a tight specular highlight + soft bounce light from below
      const diff = Math.max(0, -nx * 0.5 - ny * 0.6 + nz * 0.62);
      let l = o.flat ? 0.55 : 0.16 + 0.72 * diff + Math.max(0, ny * 0.5 + nz * 0.1) * 0.12 * (1 - nz);
      const sp = Math.max(0, -nx * 0.38 - ny * 0.48 + nz * 0.79);
      if (!o.flat) l += Math.pow(sp, o.spec ? 18 : 36) * (o.spec ? 0.6 : 0.3);
      // chrome: mirror a bright sky above a dark ground, with a crisp horizon just below the middle
      if (o.chrome && !o.flat) { const env = ny < 0.12 ? 0.62 + Math.min(0.38, -ny * 0.5 + 0.05) : 0.12 + (ny - 0.12) * 0.5; l = l * 0.45 + env * 0.6; }
      // organic surfaces: bumpy, mottled
      if (rough) l += (fbm(x * 0.9, y * 0.9, seed, 2) - 0.5) * rough * 2 + (noise2(x * 2.2, y * 2.2, seed + 5) - 0.5) * rough;
      this.pxR(X, Y, this.shadeCol(r, Math.min(1, l + bias), X, Y, 0.6), z0 + nz * Math.min(rx, ry));
    }, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1);
  }
  /** Bevelled box / panel. */
  box(x0: number, y0: number, w: number, h: number, r: RGB[], o: { z?: number; bevel?: number; bias?: number } = {}) {
    const bv = (o.bevel ?? 2) * 0.75, z0 = o.z ?? 0, bias = o.bias ?? 0;
    this.each((x, y, X, Y) => {
      const px = x + 0.5, py = y + 0.5;
      const dx = px - x0, dy = py - y0, ex = x0 + w - px, ey = y0 + h - py;
      // soft bevel: light falls off across the bevel width instead of a hard step
      let l = 0.52 - (dy / h) * 0.08;
      const tl = Math.min(dx, dy), br = Math.min(ex, ey);
      if (bv > 0) {
        if (tl < bv && tl <= br) l = 0.86 - (tl / bv) * 0.25;
        else if (br < bv) l = 0.22 + (br / bv) * 0.2;
      }
      this.pxR(X, Y, this.shadeCol(r, Math.min(1, l + bias), X, Y, 0.35), z0 + 1);
    }, x0, y0, x0 + w, y0 + h);
  }
  /** Cylinder shading (vertical tube if vert=true). */
  cyl(x0: number, y0: number, w: number, h: number, r: RGB[], vert = true, z0 = 0, bias = 0) {
    this.each((x, y, X, Y) => {
      const t = vert ? (x + 0.5 - x0) / w : (y + 0.5 - y0) / h;
      const n = t * 2 - 1;
      let l = 0.16 + 0.78 * Math.max(0, Math.cos((n + 0.35) * 1.4));
      l += Math.pow(Math.max(0, 1 - Math.abs(n + 0.42) * 5), 2) * 0.3; // specular streak
      this.pxR(X, Y, this.shadeCol(r, Math.min(1, l + bias), X, Y, 0.6), z0 + Math.sqrt(Math.max(0, 1 - n * n)) * 2);
    }, x0, y0, x0 + w, y0 + h);
  }
  /** Filled polygon with flat-ish shading based on facing (for spikes, fins). */
  poly(pts: number[], r: RGB[], l = 0.6, z0 = 0) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]); }
    const n = pts.length / 2;
    this.each((x, y, X, Y) => {
      let inside = false;
      const px = x + 0.5, py = y + 0.5;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) return;
      const g = 1 - (py - minY) / Math.max(1, maxY - minY);
      const gx = (px - minX) / Math.max(1, maxX - minX);
      this.pxR(X, Y, this.shadeCol(r, Math.min(1, l * (0.68 + 0.5 * g) - gx * 0.06), X, Y, 0.6), z0);
    }, minX - 1, minY - 1, maxX + 1, maxY + 1);
  }
  /** One real pixel wide line. */
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, z = 50) {
    const r = this.r;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * r;
    for (let i = 0; i <= n; i++) this.pxR((x0 + ((x1 - x0) * i) / n) * r, (y0 + ((y1 - y0) * i) / n) * r, c, z);
  }
  /** An eyeball looking in direction (lx,ly). */
  eye(cx: number, cy: number, r: number, lx = 0, ly = 0.3, iris: RGB[] = RAMPS.eye, z = 20) {
    this.ell(cx, cy, r, r, RAMPS.bone, { z, bias: 0.15 });
    const ir = Math.max(1.5, r * 0.55);
    this.ell(cx + lx * r * 0.35, cy + ly * r * 0.35, ir, ir, iris, { z: z + r, flat: false });
    const pr = Math.max(1, ir * 0.45);
    this.ell(cx + lx * r * 0.45, cy + ly * r * 0.45, pr, pr, RAMPS.dark, { z: z + r + 2, flat: true, bias: -0.5 });
    this.ell(cx - r * 0.3, cy - r * 0.35, Math.max(0.5, r * 0.16), Math.max(0.5, r * 0.16), [[255, 255, 255]], { z: z + r + 5, flat: true });
  }
  /** Add dark outline around opaque pixels (thickness in real pixels). */
  outline(c: RGB = [8, 8, 16], thick = Math.max(1, Math.round(this.r * 0.75))) {
    const p = SB.pack(c);
    const W = this.W, H = this.H;
    for (let k = 0; k < thick; k++) {
      const src = this.data.slice();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (src[y * W + x]) continue;
          const n = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H && src[yy * W + xx] !== 0 && (k > 0 || src[yy * W + xx] !== p);
          if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.data[y * W + x] = p;
        }
    }
    return this;
  }
  /**
   * Rim light: brighten pixels near an empty up/left neighbour, shade those near an empty down/right one.
   * Works over a band of about one logical pixel, fading across it.
   */
  rim(lift = 0.45, shade = 0.3) {
    const src = this.data.slice(), W = this.W, H = this.H, band = Math.max(1, this.r);
    const empty = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || src[y * W + x] === 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = src[i];
      if (!p) continue;
      let r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
      let lit = 0, dark = 0;
      for (let k = 1; k <= band && !lit; k++) if (empty(x - k, y - k) || empty(x, y - k)) lit = 1 - (k - 1) / band;
      if (!lit) for (let k = 1; k <= band && !dark; k++) if (empty(x + k, y + k) || empty(x, y + k) || empty(x + k, y)) dark = 1 - (k - 1) / band;
      if (lit) { const L = lift * lit; r += (255 - r) * L; g += (255 - g) * L; b += (255 - b) * L; }
      else if (dark) { const D = shade * dark; r *= 1 - D; g *= 1 - D; b *= 1 - D * 0.6; }
      this.data[i] = ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
    }
    return this;
  }
  mirrorX() {
    for (let y = 0; y < this.H; y++)
      for (let x = 0; x < this.W >> 1; x++) {
        const a = y * this.W + x, b = y * this.W + (this.W - 1 - x);
        this.data[b] = this.data[a];
      }
    return this;
  }
  canvas(): HiCanvas {
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.W, this.H);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return markHi(c, this.r);
  }
}

/** Produce a solid-colour silhouette (for hit flashes) of a sprite. */
export function tinted(src: HTMLCanvasElement, color: string, alpha = 1): HTMLCanvasElement {
  const [c, ctx] = likeCanvas(src);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Charred / damaged variant: darkens and punches dithered holes. */
export function charred(src: HTMLCanvasElement, seed = 1): HTMLCanvasElement {
  const [c, ctx] = likeCanvas(src);
  ctx.drawImage(src, 0, 0);
  const [W, H] = realSize(c), r = resOf(c);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!d[i + 3]) continue;
      const n = fbm((x / r) * 0.15, (y / r) * 0.15, seed);
      if (n > 0.66) { d[i + 3] = 0; continue; }
      const k = n > 0.58 ? 0.15 : 0.35;
      d[i] = (d[i] * k + 30 * n) | 0; d[i + 1] = (d[i + 1] * k * 0.8) | 0; d[i + 2] = (d[i + 2] * k * 0.7) | 0;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Cracked (half damage) variant. */
export function cracked(src: HTMLCanvasElement, seed = 3): HTMLCanvasElement {
  const [c, ctx] = likeCanvas(src);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const r = new RNG(seed);
  ctx.strokeStyle = 'rgba(10,0,0,0.85)';
  ctx.lineWidth = 0.75;
  for (let k = 0; k < 4; k++) {
    let x = r.range(0, c.width), y = r.range(0, c.height);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i < 6; i++) { x += r.range(-5, 5); y += r.range(-5, 5); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,0,0,0.25)';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Palette swap: rotate hue (degrees), scale saturation/lightness. Cached per source+params. */
const recolorCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
export function recolor(src: HTMLCanvasElement, hue: number, sat = 1, lig = 1): HTMLCanvasElement {
  const key = `${hue}|${sat}|${lig}`;
  let m = recolorCache.get(src);
  if (!m) { m = new Map(); recolorCache.set(src, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const [c, ctx] = likeCanvas(src);
  ctx.drawImage(src, 0, 0);
  const [W, H] = realSize(c);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
      const dd = mx - mn;
      s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
      h /= 6;
    }
    h = (h + hue / 360 + 1) % 1;
    s = Math.min(1, s * sat);
    const L = Math.min(1, l * lig);
    const q = L < 0.5 ? L * (1 + s) : L + s - L * s, p = 2 * L - q;
    const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    const out = s === 0 ? [L, L, L] : [f(h + 1 / 3), f(h), f(h - 1 / 3)];
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(out[k] * 255);
  }
  ctx.putImageData(img, 0, 0);
  m.set(key, c);
  return c;
}

/** Deterministic 32-bit hash of integers (for seeding per-level RNGs). */
export function hashInts(...v: number[]): number {
  let h = 0x811c9dc5;
  for (const x of v) { h ^= x | 0; h = Math.imul(h, 0x01000193); h ^= h >>> 15; }
  return h >>> 0;
}

export const clamp =(v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Snap a logical coordinate to the art-resolution pixel grid (smooth sub-pixel motion, still crisp). */
export const snap = (v: number) => Math.round(v * RES) / RES;
