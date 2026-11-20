// 5x7 bitmap font, rasterised at art resolution with smoothed diagonals, a continuous metallic gradient, a top
// highlight and a soft drop shadow.
import { Ctx, hiCanvas, realSize, RES } from './gfx';

const G: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.', J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#..##|#.#.#|#.#.#|#.#.#|##..#|.###.', '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|..##.|.#...|#....|#####', '3': '####.|....#|....#|.###.|....#|....#|####.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.', '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.....|.....|.....|.....|.....|.##..|.##..', ',': '.....|.....|.....|.....|.##..|..#..|.#...',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..', '?': '.###.|#...#|....#|..##.|..#..|.....|..#..',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....', '-': '.....|.....|.....|.###.|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....', "'": '..#..|..#..|.#...|.....|.....|.....|.....',
  '"': '.#.#.|.#.#.|.....|.....|.....|.....|.....', '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.', ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '$': '..#..|.####|#.#..|.###.|..#.#|####.|..#..', '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....', '=': '.....|.....|#####|.....|#####|.....|.....',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.', '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '#': '.#.#.|#####|.#.#.|.#.#.|.#.#.|#####|.#.#.', '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
  '_': '.....|.....|.....|.....|.....|.....|#####', ' ': '.....|.....|.....|.....|.....|.....|.....',
  '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.', // used as heart/shield glyph
};

export type FontStyle = 'metal' | 'gold' | 'white' | 'red' | 'green' | 'cyan' | 'grey' | 'chrome' | 'purple' | 'dark';
const STYLES: Record<FontStyle, string[]> = {
  dark: ['#222233', '#1a1a2a', '#141422', '#101018', '#0c0c14', '#08080c', '#101018'],
  metal: ['#ffffff', '#ddeeff', '#bbccee', '#8899cc', '#667799', '#556688', '#99aacc'],
  chrome: ['#cceeff', '#88ccff', '#4488cc', '#223355', '#aa6633', '#ffcc88', '#ffffff'],
  gold: ['#ffffcc', '#ffee66', '#ffcc22', '#dd9900', '#bb7700', '#995500', '#ddaa33'],
  white: ['#ffffff', '#ffffff', '#eeeeee', '#dddddd', '#cccccc', '#bbbbbb', '#dddddd'],
  red: ['#ffddcc', '#ff9977', '#ff5533', '#dd2211', '#aa1100', '#881100', '#cc3322'],
  green: ['#eeffcc', '#bbff88', '#77ee55', '#44cc33', '#22aa22', '#118811', '#44bb44'],
  cyan: ['#eeffff', '#aaffff', '#66eeff', '#33ccee', '#2299cc', '#1177aa', '#44bbdd'],
  grey: ['#999999', '#888888', '#777777', '#666666', '#555555', '#444444', '#666666'],
  purple: ['#ffeeff', '#ffaaff', '#dd77ff', '#aa55dd', '#8833bb', '#662299', '#9955cc'],
};

const CHARS = Object.keys(G);
const atlases = new Map<string, HTMLCanvasElement>();
export const CW = 6; // cell width at scale 1
export const CH = 8;

const cellCache = new Map<string, Uint8Array>();
function cells(chr: string) {
  let c = cellCache.get(chr);
  if (c) return c;
  const rows = (G[chr] ?? G['?']).split('|');
  c = new Uint8Array(35);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) c[y * 5 + x] = rows[y][x] === '#' ? 1 : 0;
  cellCache.set(chr, c);
  return c;
}
/**
 * Smooth glyph field at glyph-cell coords (u, v) in [0,5)x[0,7): smoothstep-weighted interpolation of the lit cells,
 * so diagonal steps join up and corners round off, while straight strokes stay full width.
 */
function field(c: Uint8Array, u: number, v: number) {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x > 4 || y > 6 ? 0 : c[y * 5 + x]);
  const fx = u - 0.5, fy = v - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy);
  let tx = fx - x0, ty = fy - y0;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = at(x0, y0), b = at(x0 + 1, y0), cc = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
  const f = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
  // keep square stroke ends crisp: a cell fully inside a lit cell is always on
  return at(Math.floor(u), Math.floor(v)) && Math.abs(u - Math.floor(u) - 0.5) < 0.42 && Math.abs(v - Math.floor(v) - 0.5) < 0.42 ? Math.max(f, 0.75) : f;
}
const lerpHex = (cols: string[], t: number) => {
  const p = Math.max(0, Math.min(1, t)) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(p)), f = p - i;
  const A = parseInt(cols[i].slice(1), 16), B = parseInt(cols[i + 1].slice(1), 16);
  return [0, 8, 16].map((sh) => { const a = (A >> (16 - sh)) & 255, b = (B >> (16 - sh)) & 255; return a + (b - a) * f; }) as [number, number, number];
};

function atlas(style: FontStyle, scale: number) {
  const key = style + scale;
  let a = atlases.get(key);
  if (a) return a;
  const cw = CW * scale, ch = CH * scale;
  const [c, ctx] = hiCanvas(cw * CHARS.length, ch);
  const [RW, RH] = realSize(c);
  const img = ctx.createImageData(RW, RH);
  const d = img.data;
  const cols = STYLES[style];
  const k = RES * scale; // real pixels per glyph cell
  const gw = cw * RES;
  const sh = 0.75; // shadow offset in cells
  CHARS.forEach((chr, i) => {
    if (chr === ' ') return;
    const g = cells(chr);
    for (let Y = 0; Y < RH; Y++) for (let X = 0; X < gw; X++) {
      const u = (X + 0.5) / k, v = (Y + 0.5) / k;
      const f = field(g, u, v);
      const fa = Math.max(0, Math.min(1, (f - 0.42) / 0.12));
      const fs = field(g, u - sh, v - sh);
      const sa = Math.max(0, Math.min(1, (fs - 0.3) / 0.25)) * 0.85;
      if (fa <= 0 && sa <= 0) continue;
      const o = (Y * RW + i * gw + X) * 4;
      // vertical metal gradient, a bright lip along the top edge of each stroke, darker along the bottom edge
      let col = lerpHex(cols, v / 7);
      const up = field(g, u, v - 0.35), dn = field(g, u, v + 0.35);
      const lip = up < 0.42 ? 0.35 : dn < 0.42 ? -0.25 : 0;
      col = col.map((cv) => (lip > 0 ? cv + (255 - cv) * lip : cv * (1 + lip))) as [number, number, number];
      // composite glyph over shadow
      const A = fa + sa * (1 - fa);
      d[o] = (col[0] * fa) / Math.max(1e-3, A); d[o + 1] = (col[1] * fa) / Math.max(1e-3, A); d[o + 2] = (col[2] * fa) / Math.max(1e-3, A);
      d[o + 3] = Math.round(A * 255);
    }
  });
  ctx.putImageData(img, 0, 0);
  atlases.set(key, c);
  return c;
}

export function textWidth(s: string, scale = 1) { return s.length * CW * scale; }

/** Draw text. align: 0 left, 0.5 centre, 1 right. */
export function text(ctx: Ctx, s: string, x: number, y: number, style: FontStyle = 'metal', scale = 1, align = 0) {
  s = s.toUpperCase();
  const a = atlas(style, scale);
  const cw = CW * scale, ch = CH * scale;
  let px = Math.round(x - textWidth(s, scale) * align);
  y = Math.round(y);
  for (const chr of s) {
    let i = CHARS.indexOf(chr);
    if (i < 0) i = CHARS.indexOf('?');
    if (chr !== ' ') ctx.drawImage(a, i * cw, 0, cw, ch, px, y, cw, ch);
    px += cw;
  }
}

/** Word-wrap a string into lines of at most n characters. */
export function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; }
      else line += ' ' + w;
    }
    out.push(line.trim());
  }
  return out;
}

/**
 * Big chrome logo: smooth glyph shapes with a bevelled, embossed surface lit from the upper left, a chrome
 * sky/ground reflection gradient, a dark outline and a drop shadow. Returns a hi-res canvas.
 */
export function makeLogo(s: string, scale: number): HTMLCanvasElement {
  const pad = 4;
  const w = s.length * CW * scale + pad * 2, h = CH * scale + pad * 2;
  const [c, ctx] = hiCanvas(w, h);
  const [RW, RH] = realSize(c);
  const img = ctx.createImageData(RW, RH);
  const d = img.data;
  const k = RES * scale;
  const sky = ['#ffffff', '#e4f4ff', '#a8d4ff', '#5c9ae0', '#2a4c88'], ground = ['#2a1a10', '#8a4a1c', '#e0904a', '#ffd4a0', '#ffffff'];
  const gl = [...s].map((ch) => cells(ch));
  // the field over the whole logo, in cells
  const F = (u: number, v: number) => {
    const gi = Math.floor(u / CW);
    if (gi < 0 || gi >= gl.length) return 0;
    return field(gl[gi], u - gi * CW, v);
  };
  for (let Y = 0; Y < RH; Y++) for (let X = 0; X < RW; X++) {
    const u = ((X + 0.5) / RES - pad) / scale, v = ((Y + 0.5) / RES - pad) / scale;
    const f = F(u, v);
    const o = (Y * RW + X) * 4;
    const fa = Math.max(0, Math.min(1, (f - 0.42) / 0.1));
    // outline: a slightly fattened field; shadow: offset field
    const fo = Math.max(F(u - 0.18, v), F(u + 0.18, v), F(u, v - 0.18), F(u, v + 0.24));
    const oa = Math.max(0, Math.min(1, (fo - 0.3) / 0.1));
    const fs = F(u - 0.5, v - 0.6);
    const sa = Math.max(0, Math.min(1, (fs - 0.3) / 0.3)) * 0.7;
    if (fa <= 0 && oa <= 0 && sa <= 0) continue;
    let col: [number, number, number] = [0, 0, 16];
    if (fa > 0) {
      // bevel normal from the field gradient
      const e = 0.12, gx = F(u + e, v) - F(u - e, v), gy = F(u, v + e) - F(u, v - e);
      const nx = -gx * 2.2, ny = -gy * 2.2, nl = Math.hypot(nx, ny, 1);
      const lam = (nx * -0.55 + ny * -0.65 + 0.52) / nl; // light from upper left (normal points down-right of slope)
      const t = v / 7;
      col = t < 0.5 ? lerpHex(sky, t / 0.5) : lerpHex(ground, (t - 0.5) / 0.5);
      const shade = 0.6 + lam * 0.55;
      col = col.map((cv) => Math.min(255, cv * shade + Math.max(0, lam - 0.75) * 400)) as [number, number, number];
    }
    // composite: shadow < outline < face
    let A = sa, R = 0, G2 = 0, B = 8;
    A = oa + A * (1 - oa); // outline is dark too
    R = (col[0] * fa); G2 = (col[1] * fa); B = (col[2] * fa + 16 * (1 - fa));
    const tot = fa + (1 - fa) * A;
    d[o] = R / Math.max(1e-3, tot); d[o + 1] = G2 / Math.max(1e-3, tot); d[o + 2] = B / Math.max(1e-3, tot);
    d[o + 3] = Math.round(Math.min(1, tot) * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
