// Low-level graphics helpers: canvases, colour ramps, procedural pixel-art builder.
export type Ctx = CanvasRenderingContext2D;
export type RGB = [number, number, number];

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function hex(h: string): RGB {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

/** Build an n-step ramp by interpolating between hex stops (dark -> light). Quantised to Amiga 12-bit colour. */
export function ramp(stops: string[], n = 8): RGB[] {
  const s = stops.map(hex);
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (s.length - 1);
    const a = Math.floor(t), b = Math.min(s.length - 1, a + 1), f = t - a;
    const c: RGB = [0, 0, 0];
    for (let k = 0; k < 3; k++) c[k] = Math.round((s[a][k] * (1 - f) + s[b][k] * f) / 17) * 17;
    out.push(c);
  }
  return out;
}

export const RAMPS = {
  metal: ramp(['#101828', '#334466', '#6677aa', '#99aadd', '#ddeeff']),
  chrome: ramp(['#111122', '#445577', '#88aacc', '#eeffff', '#ffffff']),
  gold: ramp(['#221100', '#664400', '#bb8811', '#ffdd44', '#ffffcc']),
  flesh: ramp(['#220011', '#662233', '#bb5566', '#ff99aa', '#ffeedd']),
  green: ramp(['#001100', '#114422', '#338844', '#88dd66', '#eeffaa']),
  slime: ramp(['#002211', '#116644', '#22aa77', '#77eebb', '#eeffee']),
  purple: ramp(['#110022', '#442266', '#8844aa', '#cc88ee', '#ffeeff']),
  red: ramp(['#220000', '#661111', '#cc2222', '#ff7744', '#ffeeaa']),
  bone: ramp(['#221a11', '#665544', '#aa9977', '#ddccaa', '#ffffee']),
  cyan: ramp(['#001122', '#115577', '#22aacc', '#88eeff', '#ffffff']),
  orange: ramp(['#220800', '#773300', '#dd7711', '#ffbb44', '#ffffcc']),
  blue: ramp(['#000022', '#112266', '#2255cc', '#66aaff', '#eeffff']),
  shell: ramp(['#1a1000', '#554422', '#aa7744', '#eebb88', '#fff4dd']),
  dark: ramp(['#000000', '#111118', '#222233', '#444455', '#666677']),
  steel: ramp(['#0a0a10', '#2a2a38', '#555566', '#9999aa', '#ddddee']),
  eye: ramp(['#220000', '#aa1100', '#ff5500', '#ffcc00', '#ffffee']),
  yellow: ramp(['#221100', '#665500', '#bbaa00', '#ffee44', '#ffffdd']),
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
/** Draws shaded primitives into a pixel buffer, quantising lighting to a ramp with ordered dithering. */
export class SB {
  w: number; h: number; data: Uint32Array; z: Float32Array;
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.data = new Uint32Array(w * h);
    this.z = new Float32Array(w * h).fill(-1e9);
  }
  static pack(c: RGB, a = 255) { return ((a << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  px(x: number, y: number, c: RGB, z = 0) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (z < this.z[i]) return;
    this.z[i] = z;
    this.data[i] = SB.pack(c);
  }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.data[y * this.w + x]; }
  shadeCol(r: RGB[], l: number, x: number, y: number, dither = 0.8): RGB {
    const t = l * (r.length - 1) + bayer(x, y) * dither;
    return r[Math.max(0, Math.min(r.length - 1, Math.round(t)))];
  }
  /** Sphere-shaded ellipse. light: brightness bias. */
  ell(cx: number, cy: number, rx: number, ry: number, r: RGB[], o: { z?: number; bias?: number; spec?: boolean; flat?: boolean } = {}) {
    const z0 = o.z ?? 0, bias = o.bias ?? 0;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d);
        let l = o.flat ? 0.55 : 0.25 + 0.75 * Math.max(0, -nx * 0.5 - ny * 0.6 + nz * 0.62);
        if (o.spec && l > 0.92) l = 1;
        this.px(x, y, this.shadeCol(r, Math.min(1, l + bias), x, y), z0 + nz * Math.min(rx, ry));
      }
  }
  /** Bevelled box / panel. */
  box(x0: number, y0: number, w: number, h: number, r: RGB[], o: { z?: number; bevel?: number; bias?: number } = {}) {
    const bv = o.bevel ?? 2, z0 = o.z ?? 0, bias = o.bias ?? 0;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const dx = x - x0, dy = y - y0, ex = x0 + w - 1 - x, ey = y0 + h - 1 - y;
        let l = 0.55;
        if (dy < bv || dx < bv) l = 0.85;
        if (ey < bv || ex < bv) l = 0.25;
        if ((dy < bv && ex < bv) || (dx < bv && ey < bv)) l = 0.55;
        this.px(x, y, this.shadeCol(r, Math.min(1, l + bias), x, y, 0.3), z0 + 1);
      }
  }
  /** Cylinder shading (vertical tube if vert=true). */
  cyl(x0: number, y0: number, w: number, h: number, r: RGB[], vert = true, z0 = 0, bias = 0) {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const t = vert ? (x + 0.5 - x0) / w : (y + 0.5 - y0) / h;
        const n = t * 2 - 1;
        const l = 0.2 + 0.8 * Math.max(0, Math.cos((n + 0.35) * 1.4));
        this.px(x, y, this.shadeCol(r, Math.min(1, l + bias), x, y), z0 + Math.sqrt(Math.max(0, 1 - n * n)) * 2);
      }
  }
  /** Filled polygon with flat-ish shading based on facing (for spikes, fins). */
  poly(pts: number[], r: RGB[], l = 0.6, z0 = 0) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]); }
    const n = pts.length / 2;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++)
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        let inside = false;
        const px = x + 0.5, py = y + 0.5;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) {
          const g = 1 - (y - minY) / Math.max(1, maxY - minY);
          this.px(x, y, this.shadeCol(r, Math.min(1, l * (0.7 + 0.5 * g)), x, y), z0);
        }
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, z = 50) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, z);
  }
  /** An eyeball looking in direction (lx,ly). */
  eye(cx: number, cy: number, r: number, lx = 0, ly = 0.3, iris: RGB[] = RAMPS.eye, z = 20) {
    this.ell(cx, cy, r, r, RAMPS.bone, { z, bias: 0.15 });
    const ir = Math.max(1.5, r * 0.55);
    this.ell(cx + lx * r * 0.35, cy + ly * r * 0.35, ir, ir, iris, { z: z + r, flat: false });
    const pr = Math.max(1, ir * 0.45);
    this.ell(cx + lx * r * 0.45, cy + ly * r * 0.45, pr, pr, RAMPS.dark, { z: z + r + 2, flat: true, bias: -0.5 });
    this.px(cx - r * 0.3, cy - r * 0.35, [255, 255, 255], z + r + 5);
  }
  /** Add dark outline around opaque pixels. */
  outline(c: RGB = [8, 8, 16]) {
    const p = SB.pack(c);
    const src = this.data.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x]) continue;
        const n = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && src[yy * this.w + xx] !== 0 && src[yy * this.w + xx] !== p;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.data[y * this.w + x] = p;
      }
    return this;
  }
  /** Rim light: brighten pixels whose up/left neighbour is empty, shade those whose down/right neighbour is empty. */
  rim(lift = 0.45, shade = 0.3) {
    const src = this.data.slice(), w = this.w, h = this.h;
    const empty = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || src[y * w + x] === 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, p = src[i];
      if (!p) continue;
      let r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
      if (empty(x - 1, y - 1) || empty(x, y - 1)) { r += (255 - r) * lift; g += (255 - g) * lift; b += (255 - b) * lift; }
      else if (empty(x + 1, y + 1) || empty(x, y + 1) || empty(x + 1, y)) { r *= 1 - shade; g *= 1 - shade; b *= 1 - shade * 0.6; }
      this.data[i] = ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
    }
    return this;
  }
  mirrorX() {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w >> 1; x++) {
        const a = y * this.w + x, b = y * this.w + (this.w - 1 - x);
        this.data[b] = this.data[a];
      }
    return this;
  }
  canvas(): HTMLCanvasElement {
    const [c, ctx] = makeCanvas(this.w, this.h);
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

/** Produce a solid-colour silhouette (for hit flashes) of a sprite. */
export function tinted(src: HTMLCanvasElement, color: string, alpha = 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Charred / damaged variant: darkens and punches dithered holes. */
export function charred(src: HTMLCanvasElement, seed = 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (!d[i + 3]) continue;
      const n = fbm(x * 0.15, y * 0.15, seed);
      if (n > 0.66) { d[i + 3] = 0; continue; }
      const k = n > 0.58 ? 0.15 : 0.35;
      d[i] = (d[i] * k + 30 * n) | 0; d[i + 1] = (d[i + 1] * k * 0.8) | 0; d[i + 2] = (d[i + 2] * k * 0.7) | 0;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Cracked (half damage) variant. */
export function cracked(src: HTMLCanvasElement, seed = 3): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const r = new RNG(seed);
  ctx.strokeStyle = 'rgba(10,0,0,0.85)';
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

/** Palette swap: rotate hue (degrees), scale saturation/lightness, re-quantise to 12-bit colour. Cached per source+params. */
const recolorCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
export function recolor(src: HTMLCanvasElement, hue: number, sat = 1, lig = 1): HTMLCanvasElement {
  const key = `${hue}|${sat}|${lig}`;
  let m = recolorCache.get(src);
  if (!m) { m = new Map(); recolorCache.set(src, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
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
    for (let k = 0; k < 3; k++) d[i + k] = Math.round((out[k] * 255) / 17) * 17;
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
