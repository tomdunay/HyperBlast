// Chunky 5x7 bitmap font, rendered with a metallic vertical gradient and drop shadow.
import { makeCanvas, Ctx } from './gfx';

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

function atlas(style: FontStyle, scale: number) {
  const key = style + scale;
  let a = atlases.get(key);
  if (a) return a;
  const cw = CW * scale, ch = CH * scale;
  const [c, ctx] = makeCanvas(cw * CHARS.length, ch);
  const cols = STYLES[style];
  CHARS.forEach((chr, i) => {
    const rows = G[chr].split('|');
    // shadow
    ctx.fillStyle = '#000';
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++)
      if (rows[y][x] === '#') ctx.fillRect(i * cw + (x + 1) * scale, (y + 1) * scale, scale, scale);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++)
      if (rows[y][x] === '#') {
        for (let sy = 0; sy < scale; sy++) {
          const t = (y * scale + sy) / (7 * scale);
          ctx.fillStyle = cols[Math.min(6, Math.floor(t * 7))];
          ctx.fillRect(i * cw + x * scale, y * scale + sy, scale, 1);
        }
      }
  });
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

/** Big chrome logo with outline; returns a canvas. */
export function makeLogo(s: string, scale: number): HTMLCanvasElement {
  const w = s.length * CW * scale + 8, h = CH * scale + 8;
  const [c, ctx] = makeCanvas(w, h);
  const grad = ['#ffffff', '#cceeff', '#99ccff', '#5599dd', '#335588', '#112244', '#ffffff', '#ffcc88', '#dd8844', '#aa5522', '#ffddaa', '#ffffff'];
  // outline pass
  for (let pass = 0; pass < 2; pass++) {
    [...s].forEach((chr, i) => {
      const rows = (G[chr] ?? G['?']).split('|');
      for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
        if (rows[y][x] !== '#') continue;
        const X = 4 + i * CW * scale + x * scale, Y = 4 + y * scale;
        if (pass === 0) { ctx.fillStyle = '#000010'; ctx.fillRect(X - 2, Y - 2, scale + 4, scale + 5); }
        else for (let sy = 0; sy < scale; sy++) {
          const t = (Y - 4 + sy) / (7 * scale);
          ctx.fillStyle = grad[Math.min(grad.length - 1, Math.floor(t * grad.length))];
          ctx.fillRect(X, Y + sy, scale, 1);
        }
      }
    });
  }
  return c;
}
