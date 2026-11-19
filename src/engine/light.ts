// Lighting toolkit: quantised additive glow sprites, cached drop-shadow silhouettes, vignettes and dither fades.
import { makeCanvas, bayer, Ctx } from './gfx';
import { VIEW, MARGIN } from './view';

const MAXW = 320 + MARGIN * 2;

const glowCache = new Map<string, HTMLCanvasElement>();
/** Radial glow quantised to 4 bands with ordered dithering (reads as Amiga-style neon, not a blur). */
export function glow(r: number, color: string, strength = 1): HTMLCanvasElement {
  const key = r + color + strength;
  let g = glowCache.get(key);
  if (g) return g;
  const s = Math.ceil(r * 2) + 2;
  const [c, ctx] = makeCanvas(s, s);
  const img = ctx.createImageData(s, s);
  const v = parseInt(color.slice(1), 16);
  const R = (v >> 16) & 255, G = (v >> 8) & 255, B = v & 255;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.hypot(x + 0.5 - s / 2, y + 0.5 - s / 2) / r;
    if (d >= 1) continue;
    let k = (1 - d) * (1 - d) * 4 + bayer(x, y) * 0.9;
    k = Math.max(0, Math.min(4, Math.round(k))) / 4;
    if (!k) continue;
    const i = (y * s + x) * 4;
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = Math.round(255 * k * 0.55 * strength);
  }
  ctx.putImageData(img, 0, 0);
  glowCache.set(key, c);
  return c;
}
export function drawGlow(ctx: Ctx, x: number, y: number, r: number, color: string, strength = 1) {
  const g = glow(Math.max(2, Math.round(r)), color, strength);
  ctx.drawImage(g, Math.round(x - g.width / 2), Math.round(y - g.height / 2));
}

const shadowCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/** Dark translucent silhouette of a sprite, cached. */
export function shadowOf(src: HTMLCanvasElement): HTMLCanvasElement {
  let s = shadowCache.get(src);
  if (s) return s;
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = 'rgba(0,0,8,0.42)';
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
  const [c, ctx] = makeCanvas(W, 256);
  const img = ctx.createImageData(W, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < W; x++) {
    const dx = Math.abs(x - W / 2) / (W / 2), dy = Math.abs(y - 128) / 128;
    const d = Math.max(dx, dy);
    let k = (d - 0.72) / 0.28 + bayer(x, y) * 0.3;
    if (k <= 0) continue;
    k = Math.min(1, Math.round(k * 3) / 3);
    const i = (y * W + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 20; img.data[i + 2] = 10; img.data[i + 3] = Math.round(k * 170);
  }
  ctx.putImageData(img, 0, 0);
  vigs.set(W, c);
  return c;
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
 * Subtle dithered dark corners, always on, to focus the eye on the play area. On wide views the extra scenery
 * either side of the playfield is dimmed a little more towards the outer edges. Draw at x = -VIEW.ox.
 */
export function darkVignette(): HTMLCanvasElement {
  const W = VIEW.w, ox = VIEW.ox;
  let c = darkVigs.get(W);
  if (c) return c;
  const [cv, ctx] = makeCanvas(W, 256);
  const img = ctx.createImageData(W, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < W; x++) {
    const px = x - ox; // playfield x
    const dx = (px - 160) / 160, dy = (y - 128) / 128;
    const d = Math.sqrt(Math.min(1.2, dx * dx) * 0.8 + dy * dy * 0.9);
    let k = (d - 0.78) / 0.5;
    // outside the playfield: ramp the dimming up with distance
    const out = px < 0 ? -px : px > 320 ? px - 320 : 0;
    if (out > 0) k = Math.max(k, 0.15 + (out / Math.max(1, ox)) * 0.55);
    k += bayer(x, y) * 0.25;
    if (k <= 0) continue;
    k = Math.min(1, Math.round(k * 4) / 4);
    img.data[(y * W + x) * 4 + 3] = Math.round(k * 120);
  }
  ctx.putImageData(img, 0, 0);
  darkVigs.set(W, cv);
  return cv;
}

const shaftCache = new Map<string, HTMLCanvasElement>();
/** Volumetric light shafts slanting down from the top, quantised + dithered (additive). */
export function lightShafts(color: string, seed = 1): HTMLCanvasElement {
  const key = color + seed;
  let c = shaftCache.get(key);
  if (c) return c;
  const SW = 400 + MARGIN * 2;
  const [cv, ctx] = makeCanvas(SW, 256);
  const img = ctx.createImageData(SW, 256);
  const v = parseInt(color.slice(1), 16);
  const R = (v >> 16) & 255, G = (v >> 8) & 255, B = v & 255;
  const shafts: [number, number][] = [];
  const nS = Math.round(6 * SW / 400);
  for (let i = 0; i < nS; i++) shafts.push([((i * 71 + seed * 37) % (SW - 40)) + 20, 8 + ((i * 13 + seed) % 4) * 6]);
  for (let y = 0; y < 256; y++) for (let x = 0; x < SW; x++) {
    let k = 0;
    for (const [sx, w] of shafts) {
      const cx = sx - y * 0.45; // slant
      const d = Math.abs(x - cx) / (w + y * 0.06);
      if (d < 1) k = Math.max(k, (1 - d) * (1 - y / 300));
    }
    if (k <= 0) continue;
    const q = Math.round(k * 3 + bayer(x, y) * 0.9);
    if (q <= 0) continue;
    const i = (y * SW + x) * 4;
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = q * 24;
  }
  ctx.putImageData(img, 0, 0);
  shaftCache.set(key, cv);
  return cv;
}

let coneC: HTMLCanvasElement | null = null;
/** Searchlight cone pointing down (+y), apex at (60, 0). */
export function searchCone(): HTMLCanvasElement {
  if (coneC) return coneC;
  const [c, ctx] = makeCanvas(120, 220);
  const img = ctx.createImageData(120, 220);
  for (let y = 0; y < 220; y++) for (let x = 0; x < 120; x++) {
    const half = 3 + y * 0.24;
    const d = Math.abs(x - 60) / half;
    if (d > 1) continue;
    const k = (1 - d * d) * (1 - y / 240);
    const q = Math.round(k * 3 + bayer(x, y) * 0.9);
    if (q <= 0) continue;
    const i = (y * 120 + x) * 4;
    img.data[i] = 200; img.data[i + 1] = 230; img.data[i + 2] = 255; img.data[i + 3] = q * 30;
  }
  ctx.putImageData(img, 0, 0);
  coneC = c;
  return c;
}

let stripes: HTMLCanvasElement | null = null;
export function hazardStripes(): HTMLCanvasElement {
  if (stripes) return stripes;
  const [c, ctx] = makeCanvas(MAXW + 16, 8);
  for (let x = -8; x < MAXW + 16; x += 8) {
    ctx.fillStyle = (x / 8) % 2 === 0 ? '#ffcc00' : '#111111';
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 8, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 8, 8); ctx.fill();
  }
  stripes = c;
  return c;
}
