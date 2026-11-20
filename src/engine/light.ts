// Lighting toolkit: smooth additive glow sprites, cached drop-shadow silhouettes, vignettes, light shafts and fades.
// Everything here is rendered at the art resolution (RES) so light falloffs are smooth rather than banded.
import { makeCanvas, hiCanvas, likeCanvas, realSize, bayer, Ctx, RES } from './gfx';
import { VIEW, MARGIN } from './view';

const MAXW = 320 + MARGIN * 2;

/** Hi-res canvas filled per real pixel; f gets logical coords (pixel centres) and returns 0..1 alpha or a colour. */
function paint(w: number, h: number, f: (x: number, y: number) => number, rgb: [number, number, number], aMax = 255, r = RES) {
  const [c, ctx] = hiCanvas(w, h, r);
  const [W, H] = realSize(c);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const k = f((X + 0.5) / r, (Y + 0.5) / r);
    if (k <= 0) continue;
    const i = (Y * W + X) * 4;
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = Math.min(255, Math.round(k * aMax));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
const rgbOf = (color: string): [number, number, number] => { const v = parseInt(color.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

const glowCache = new Map<string, HTMLCanvasElement>();
/** Smooth radial glow with a white-hot core (drawn additively). */
export function glow(r: number, color: string, strength = 1): HTMLCanvasElement {
  const key = r + color + strength;
  let g = glowCache.get(key);
  if (g) return g;
  const s = Math.ceil(r * 2) + 2;
  const [R, G, B] = rgbOf(color);
  const [c, ctx] = hiCanvas(s, s);
  const [W, H] = realSize(c);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const dd = Math.hypot((X + 0.5) / RES - s / 2, (Y + 0.5) / RES - s / 2) / r;
    if (dd >= 1) continue;
    // inverse-square-ish falloff, windowed to zero at the edge
    const k = (1 - dd) * (1 - dd) * (0.35 + 0.65 / (1 + dd * dd * 18));
    const hot = Math.max(0, 1 - dd * 3.2) * 0.6; // core blends to white
    const i = (Y * W + X) * 4;
    d[i] = R + (255 - R) * hot; d[i + 1] = G + (255 - G) * hot; d[i + 2] = B + (255 - B) * hot;
    d[i + 3] = Math.min(255, Math.round(255 * k * 0.8 * strength));
  }
  ctx.putImageData(img, 0, 0);
  glowCache.set(key, c);
  return c;
}
export function drawGlow(ctx: Ctx, x: number, y: number, r: number, color: string, strength = 1) {
  const g = glow(Math.max(2, Math.round(r)), color, strength);
  ctx.drawImage(g, x - g.width / 2, y - g.height / 2);
}

const shadowCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/** Dark translucent silhouette of a sprite, slightly softened, cached. */
export function shadowOf(src: HTMLCanvasElement): HTMLCanvasElement {
  let s = shadowCache.get(src);
  if (s) return s;
  const [c, ctx] = likeCanvas(src);
  ctx.filter = `blur(${0.6}px)`;
  ctx.drawImage(src, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = 'rgba(0,0,10,0.5)';
  ctx.fillRect(0, 0, c.width, c.height);
  shadowCache.set(src, c);
  return c;
}

const vigs = new Map<number, HTMLCanvasElement>();
/** Red edge vignette for damage pulses, sized to the current view width (draw at x = -VIEW.ox). */
export function vignette(): HTMLCanvasElement {
  const W = VIEW.w;
  let vig = vigs.get(W);
  if (vig) return vig;
  vig = paint(W, 256, (x, y) => {
    const dx = Math.abs(x - W / 2) / (W / 2), dy = Math.abs(y - 128) / 128;
    const d = Math.pow(Math.pow(dx, 4) + Math.pow(dy, 4), 0.25);
    const k = (d - 0.7) / 0.3;
    return k > 0 ? k * k : 0;
  }, [255, 24, 12], 140, 1);
  vigs.set(W, vig);
  return vig;
}

const fades: HTMLCanvasElement[] = [];
/** 17 ordered-dither black overlays (0 = clear, 16 = black) for Amiga-style dissolves. */
export function ditherFade(level: number): HTMLCanvasElement | null {
  level = Math.max(0, Math.min(16, Math.round(level)));
  if (level === 0) return null;
  if (!fades.length) {
    for (let l = 0; l <= 16; l++) {
      const [c, ctx] = makeCanvas(MAXW, 256);
      const img = ctx.createImageData(MAXW, 256);
      for (let y = 0; y < 256; y++) for (let x = 0; x < MAXW; x++) {
        if (bayer(x, y) + 0.47 < l / 16) img.data[(y * MAXW + x) * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      fades.push(c);
    }
  }
  return fades[level];
}

const darkVigs = new Map<number, HTMLCanvasElement>();
/**
 * Soft dark corners, always on, to focus the eye on the play area. On wide views the extra scenery either side of
 * the playfield is dimmed a little more towards the outer edges. Draw at x = -VIEW.ox.
 */
export function darkVignette(): HTMLCanvasElement {
  const W = VIEW.w, ox = VIEW.ox;
  let c = darkVigs.get(W);
  if (c) return c;
  c = paint(W, 256, (x, y) => {
    const px = x - ox; // playfield x
    const dx = (px - 160) / 160, dy = (y - 128) / 128;
    const d = Math.sqrt(Math.min(1.2, dx * dx) * 0.8 + dy * dy * 0.9);
    let k = (d - 0.72) / 0.6;
    const out = px < 0 ? -px : px > 320 ? px - 320 : 0;
    if (out > 0) k = Math.max(k, 0.12 + Math.pow(out / Math.max(1, ox), 1.3) * 0.6);
    return Math.max(0, Math.min(1, k));
  }, [0, 0, 6], 150, 1);
  darkVigs.set(W, c);
  return c;
}

const shaftCache = new Map<string, HTMLCanvasElement>();
/** Volumetric light shafts slanting down from the top (additive), with soft edges and dust-like streaks. */
export function lightShafts(color: string, seed = 1): HTMLCanvasElement {
  const key = color + seed;
  let c = shaftCache.get(key);
  if (c) return c;
  const SW = 400 + MARGIN * 2;
  const shafts: [number, number][] = [];
  const nS = Math.round(6 * SW / 400);
  for (let i = 0; i < nS; i++) shafts.push([((i * 71 + seed * 37) % (SW - 40)) + 20, 8 + ((i * 13 + seed) % 4) * 6]);
  c = paint(SW, 256, (x, y) => {
    let k = 0;
    for (const [sx, w] of shafts) {
      const cx = sx - y * 0.45; // slant
      const d = Math.abs(x - cx) / (w + y * 0.06);
      if (d < 1) k += (1 - d * d) * (1 - d * d) * (1 - y / 300);
    }
    // fine streaks running along the slant
    const streak = 0.8 + 0.2 * Math.sin((x + y * 0.45) * 0.9 + seed);
    return Math.min(1, k * streak);
  }, rgbOf(color), 80, 1);
  shaftCache.set(key, c);
  return c;
}

let coneC: HTMLCanvasElement | null = null;
/** Searchlight cone pointing down (+y), apex at (60, 0). */
export function searchCone(): HTMLCanvasElement {
  if (coneC) return coneC;
  coneC = paint(120, 220, (x, y) => {
    const half = 3 + y * 0.24;
    const d = Math.abs(x - 60) / half;
    if (d > 1) return 0;
    return (1 - d * d) * (1 - d * d) * (1 - y / 240) * (0.85 + 0.15 * Math.cos(d * 9));
  }, [200, 230, 255], 100);
  return coneC;
}

let stripes: HTMLCanvasElement | null = null;
export function hazardStripes(): HTMLCanvasElement {
  if (stripes) return stripes;
  const [c, ctx] = hiCanvas(MAXW + 16, 8);
  for (let x = -8; x < MAXW + 16; x += 8) {
    ctx.fillStyle = (x / 8) % 2 === 0 ? '#ffcc00' : '#111111';
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 8, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 8, 8); ctx.fill();
  }
  // bevel: highlight top edge, shade bottom
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, MAXW + 16, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 7, MAXW + 16, 1);
  stripes = c;
  return c;
}
