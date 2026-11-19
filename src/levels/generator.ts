// Seeded procedural level generator.
// Terrain is grown from a weighted section grammar, validated for a guaranteed flyable path (and carved where needed),
// then populated with spawns from a per-level enemy roster using a difficulty ("threat") budget.
// Same (index, seed) => byte-identical rows + spawns. Never uses Math.random().
import { LB } from './builder';
import { RNG, ramp, hashInts } from '../engine/gfx';
import { transposeTrack } from '../audio/music';
import { variantKey, rollToken } from '../game/enemies';
import { bossVariant, remixBoss } from '../game/bosses';
import type { LevelDef, SpawnDef, Theme, TexKind } from '../game/types';
import { COLS, TILE, H } from '../game/types';

export const MIN_GAP = 5; // narrowest flyable run of open tiles
const OVERLAP = 3; // consecutive rows' runs must overlap this much

// ---------------------------------------------------------------- themes
export interface GenTheme { name: string; theme: Theme; music: string; semis: number; bpm: number }
const T = (rock: string[], alt: string[], bg: [string, string, string], far: string[], wobble: number, tex: TexKind, ambient: Theme['ambient'], ambientColor: string): Theme =>
  ({ rock: ramp(rock, 8), alt: ramp(alt, 8), bg, far: ramp(far, 4), wobble, tex, ambient, ambientColor });

/** Official themes for levels 6–15 (in order). */
export const GEN_THEMES: GenTheme[] = [
  { name: 'ABYSSAL TRENCH', music: 'level1', semis: -3, bpm: 4, theme: T(['#02040c', '#0a1a30', '#14365a', '#2a6088', '#6aa8c8', '#d8f4ff'], ['#0a0418', '#2a1050', '#5a2a90', '#9a5ad0', '#e0b8ff'], ['#000208', '#001428', '#000208'], ['#000c18', '#04182c', '#08243c', '#0c2e4a'], 0.26, 'coral', 'bubbles', 'rgba(120,200,255,0.5)') },
  { name: 'CRYSTAL GROTTO', music: 'level3', semis: 2, bpm: 0, theme: T(['#060818', '#1a2a50', '#30508a', '#5a88c4', '#a8d8f4', '#ffffff'], ['#08202a', '#106070', '#20b0c0', '#70f0f0', '#e8ffff'], ['#04040e', '#10143a', '#04040e'], ['#0c0e2a', '#14183c', '#1c224e', '#262c60'], 0.1, 'crystal', 'stars', 'rgba(180,240,255,0.7)') },
  { name: 'OSSIFIED WASTES', music: 'level2', semis: -2, bpm: 6, theme: T(['#0a0a0a', '#2a2826', '#545048', '#868076', '#bcb6aa', '#f4f0e8'], ['#120a08', '#3a2218', '#6a4430', '#9a6a4a', '#d0a07a'], ['#080808', '#1a1816', '#080808'], ['#141210', '#201c18', '#2c2620', '#383028'], 0.22, 'bone', 'dust', 'rgba(200,200,200,0.4)') },
  { name: 'MAGMA VEINS', music: 'level4', semis: 1, bpm: 6, theme: T(['#060404', '#1c1414', '#3a2a28', '#5a4440', '#8a6a60', '#c8a090'], ['#300800', '#801800', '#e04400', '#ffa020', '#fff0a0'], ['#100200', '#2a0800', '#100200'], ['#1c0600', '#2a0c04', '#381208', '#46180c'], 0.18, 'lava', 'embers', 'rgba(255,140,60,0.6)') },
  { name: 'FUNGAL LABYRINTH', music: 'level3', semis: -4, bpm: -4, theme: T(['#08040c', '#24103a', '#46206a', '#6e3e9a', '#a876cc', '#ead0ff'], ['#022018', '#0a5444', '#18907a', '#5ad0b0', '#c8fff0'], ['#06020a', '#180a24', '#06020a'], ['#120818', '#1c0c24', '#261230', '#30183c'], 0.28, 'vine', 'spores', 'rgba(140,255,220,0.5)') },
  { name: 'HIVE FOUNDRY', music: 'level4', semis: 3, bpm: 4, theme: T(['#0c0802', '#30220a', '#5e4416', '#9a7428', '#d8b050', '#fff0b0'], ['#1a0408', '#501020', '#90283a', '#d06060', '#ffb8a8'], ['#0a0602', '#22160a', '#0a0602'], ['#1a1206', '#261a0a', '#32220e', '#3e2a12'], 0.1, 'biomech', 'embers', 'rgba(255,200,90,0.5)') },
  { name: 'FROZEN RELAY', music: 'level5', semis: -2, bpm: -6, theme: T(['#04080c', '#162636', '#2e4c66', '#5a86a6', '#a6cce4', '#ffffff'], ['#001018', '#003048', '#106890', '#50b0e0', '#d0f4ff'], ['#020610', '#0c1a2c', '#020610'], ['#0a1220', '#101c2e', '#16263c', '#1e304a'], 0, 'metal', 'stars', 'rgba(220,240,255,0.8)') },
  { name: 'SHATTERED MOON', music: 'level5', semis: 4, bpm: 0, theme: T(['#060606', '#1e1e24', '#3c3c48', '#666676', '#a0a0b0', '#eeeef8'], ['#001a1a', '#004848', '#108888', '#50d0d0', '#d0ffff'], ['#020204', '#0c0c16', '#020204'], ['#0e0e16', '#16161e', '#1e1e28', '#262632'], 0.12, 'crystal', 'stars', 'rgba(200,255,255,0.6)') },
  { name: 'CORE FURNACE', music: 'boss', semis: -5, bpm: -8, theme: T(['#080404', '#241010', '#462020', '#703430', '#a85a48', '#f0a888'], ['#401000', '#902800', '#f05800', '#ffb030', '#ffffc0'], ['#140200', '#3a0a00', '#140200'], ['#220800', '#300e04', '#3e1408', '#4c1a0c'], 0.14, 'lava', 'embers', 'rgba(255,170,60,0.7)') },
  { name: 'THE LAST GATE', music: 'level5', semis: 5, bpm: 8, theme: T(['#060408', '#20182a', '#40324e', '#6e5c80', '#b0a0c0', '#ffffff'], ['#200000', '#600000', '#c01010', '#ff5040', '#ffd0c0'], ['#0a0004', '#24000c', '#0a0004'], ['#180008', '#22020e', '#2c0614', '#360a1a'], 0, 'metal', 'stars', 'rgba(255,180,180,0.7)') },
];

// ---------------------------------------------------------------- rosters & spawn styles
interface Style { pats: string[]; n: [number, number]; gap: number; threat: number; kind: 'wave' | 'one' | 'wall' }
/** THREAT ≈ hp × fire rate × speed, normalised so a tadpole is 1. */
export const STYLE: Record<string, Style> = {
  tadpole: { pats: ['sine', 'swoop', 'side', 'zigzag'], n: [4, 7], gap: 16, threat: 0.35, kind: 'wave' },
  nautilus: { pats: ['dive'], n: [2, 4], gap: 25, threat: 1.0, kind: 'wave' },
  jelly: { pats: ['sine'], n: [2, 4], gap: 32, threat: 1.1, kind: 'wave' },
  trilo: { pats: ['down'], n: [1, 3], gap: 35, threat: 1.4, kind: 'wave' },
  crab: { pats: ['down'], n: [1, 1], gap: 1, threat: 2.2, kind: 'one' },
  skullfish: { pats: ['swoop', 'side', 'sine'], n: [4, 7], gap: 13, threat: 0.5, kind: 'wave' },
  worm: { pats: ['worm'], n: [1, 1], gap: 1, threat: 2.4, kind: 'one' },
  eye: { pats: ['hover'], n: [2, 3], gap: 28, threat: 1.6, kind: 'wave' },
  spore: { pats: ['chase'], n: [5, 8], gap: 14, threat: 0.25, kind: 'wave' },
  wasp: { pats: ['swoop', 'side', 'chase'], n: [6, 10], gap: 8, threat: 0.3, kind: 'wave' },
  mantis: { pats: ['dive'], n: [2, 4], gap: 22, threat: 1.2, kind: 'wave' },
  beetle: { pats: ['down'], n: [1, 1], gap: 1, threat: 2.4, kind: 'one' },
  fleshpod: { pats: ['circle', 'side'], n: [3, 6], gap: 24, threat: 0.9, kind: 'wave' },
  cyclops: { pats: ['down'], n: [1, 1], gap: 1, threat: 3.0, kind: 'one' },
  drone: { pats: ['side', 'circle', 'dive', 'sine'], n: [4, 6], gap: 16, threat: 0.8, kind: 'wave' },
  scout: { pats: ['swoop', 'sine', 'side'], n: [6, 10], gap: 8, threat: 0.45, kind: 'wave' },
  walker: { pats: ['down'], n: [1, 1], gap: 1, threat: 3.6, kind: 'one' },
  ray: { pats: ['side'], n: [2, 4], gap: 30, threat: 1.3, kind: 'wave' },
  minelayer: { pats: ['hover'], n: [1, 2], gap: 40, threat: 2.0, kind: 'wave' },
  splitter: { pats: ['sine', 'zigzag'], n: [3, 5], gap: 20, threat: 1.1, kind: 'wave' },
  orbiter: { pats: ['orbit'], n: [2, 3], gap: 30, threat: 1.3, kind: 'wave' },
  swarmqueen: { pats: ['hover'], n: [1, 1], gap: 1, threat: 3.4, kind: 'one' },
  // wall mounts
  anemone: { pats: ['static'], n: [1, 1], gap: 1, threat: 0.9, kind: 'wall' },
  sporepod: { pats: ['static'], n: [1, 1], gap: 1, threat: 0.8, kind: 'wall' },
  bonespine: { pats: ['static'], n: [1, 1], gap: 1, threat: 1.0, kind: 'wall' },
  eggsac: { pats: ['static'], n: [1, 1], gap: 1, threat: 1.3, kind: 'wall' },
  vinepod: { pats: ['static'], n: [1, 1], gap: 1, threat: 1.0, kind: 'wall' },
  mturret: { pats: ['static'], n: [1, 1], gap: 1, threat: 1.2, kind: 'wall' },
  sentry: { pats: ['static'], n: [1, 1], gap: 1, threat: 1.3, kind: 'wall' },
  sniper: { pats: ['static'], n: [1, 1], gap: 1, threat: 1.4, kind: 'wall' },
  gate: { pats: ['static'], n: [1, 1], gap: 1, threat: 1.2, kind: 'wall' },
};
const ROSTER: Record<TexKind, { fly: string[]; wall: string[] }> = {
  coral: { fly: ['tadpole', 'nautilus', 'jelly', 'trilo', 'crab', 'ray'], wall: ['anemone'] },
  bone: { fly: ['skullfish', 'worm', 'eye', 'spore', 'splitter'], wall: ['sporepod', 'bonespine'] },
  vine: { fly: ['wasp', 'mantis', 'beetle', 'jelly', 'swarmqueen'], wall: ['eggsac', 'vinepod'] },
  biomech: { fly: ['fleshpod', 'cyclops', 'eye', 'worm', 'orbiter'], wall: ['mturret'] },
  metal: { fly: ['drone', 'scout', 'walker', 'minelayer', 'orbiter'], wall: ['sentry', 'gate', 'sniper'] },
  crystal: { fly: ['scout', 'ray', 'splitter', 'jelly', 'orbiter'], wall: ['sniper', 'sentry'] },
  lava: { fly: ['fleshpod', 'minelayer', 'splitter', 'crab', 'skullfish'], wall: ['mturret', 'anemone'] },
};
const GUESTS = ['tadpole', 'skullfish', 'wasp', 'drone', 'scout', 'mantis', 'eye', 'jelly', 'orbiter', 'splitter', 'ray', 'fleshpod', 'cyclops', 'walker', 'beetle'];
const MID_BOSSES = ['ossuar', 'larva', 'pipeheart', 'sentinel'];
const END_BOSSES = ['carcinox', 'mothersp', 'vinemaw', 'fleshforge', 'overmind'];

// ---------------------------------------------------------------- fairness
/** Open runs [start, end) of a row. */
function runs(row: Uint8Array): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  for (let c = 0; c <= COLS; c++) {
    const open = c < COLS && !row[c];
    if (open && s < 0) s = c;
    if (!open && s >= 0) { out.push([s, c]); s = -1; }
  }
  return out;
}
/** Sweep from the start row upwards; returns indices of rows with no reachable run of MIN_GAP tiles. */
export function checkFair(rows: Uint8Array[]): number[] {
  const bad: number[] = [];
  let reach: [number, number][] = runs(rows[0]).filter(([a, b]) => b - a >= MIN_GAP);
  for (let r = 1; r < rows.length; r++) {
    const next = runs(rows[r]).filter(([a, b]) => b - a >= MIN_GAP && reach.some(([pa, pb]) => Math.min(b, pb) - Math.max(a, pa) >= OVERLAP));
    if (!next.length) { bad.push(r); reach = runs(rows[r]).filter(([a, b]) => b - a >= MIN_GAP); if (!reach.length) reach = [[0, COLS]]; }
    else reach = next;
  }
  return bad;
}
/** Single upward sweep: wherever no run is reachable, carve 6 tiles open centred on the widest reachable run below. */
function makeFair(rows: Uint8Array[]) {
  const wide = (rr: Uint8Array) => runs(rr).filter(([a, b]) => b - a >= MIN_GAP);
  const carve = (rr: Uint8Array, mid: number) => { const a = Math.max(1, Math.min(COLS - 7, mid - 3)); for (let c = a; c < a + 6; c++) rr[c] = 0; };
  let reach = wide(rows[0]);
  if (!reach.length) { carve(rows[0], 10); reach = wide(rows[0]); }
  for (let r = 1; r < rows.length; r++) {
    const ok = () => wide(rows[r]).filter(([a, b]) => reach.some(([pa, pb]) => Math.min(b, pb) - Math.max(a, pa) >= OVERLAP));
    let next = ok();
    if (!next.length) {
      const p = reach.slice().sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0];
      carve(rows[r], Math.round((p[0] + p[1]) / 2));
      next = ok();
    }
    reach = next;
  }
}

// ---------------------------------------------------------------- generator
interface Section { type: string; start: number; len: number; heavy: boolean }

export function generateLevel(index: number, seed: number, randomTheme: boolean): LevelDef {
  const rng = new RNG(hashInts(seed, index, 0x51ed) || 1);
  const r = () => rng.next();
  const pick = <V,>(a: V[]) => a[Math.floor(r() * a.length)];
  const tier = Math.max(0, index - 4); // 0 for level 5, 10 for level 15
  // ---- theme
  let gt: GenTheme;
  if (!randomTheme) gt = GEN_THEMES[Math.max(0, index - 5) % GEN_THEMES.length];
  else {
    // seeded shuffle of all 15 themes (same order for every level of a run) => each appears once
    const all = [...GEN_THEMES, ...CLASSIC_THEMES()];
    const sr = new RNG(hashInts(seed, 0xbeef) || 1);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(sr.next() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    gt = all[index % all.length];
  }
  const theme = gt.theme;
  // ---- roster: themed + guests + seeded variants
  const base = ROSTER[theme.tex];
  const fly = base.fly.slice();
  const guests = 1 + Math.floor(index / 5) + (randomTheme ? 1 : 0);
  for (let i = 0; i < guests; i++) { const g = pick(GUESTS); if (!fly.includes(g)) fly.push(g); }
  const vChance = Math.min(0.6, index * 0.045);
  const variant = (t: string) => (r() < vChance ? variantKey(t, r() < 0.5 ? 1 : 2) : t);

  // ---- terrain
  const b = new LB();
  const sections: Section[] = [];
  let L = 1, R = 1;
  const push = (type: string, start: number) => sections.push({ type, start, len: b.rows.length - start, heavy: false });
  const clampW = (l: number, rr: number): [number, number] => {
    l = Math.max(0, l); rr = Math.max(0, rr);
    while (COLS - l - rr < 7) { if (l > rr) l--; else rr--; }
    return [l, rr];
  };
  const SECTION_W: [string, number][] = [['open', 3], ['taper', 2], ['corridor', 3], ['zigzag', 2], ['islands', 2], ['pillars', 2], ['fork', 1.5], ['gauntlet', 1.5 + tier * 0.15]];
  const rollSection = () => {
    const tot = SECTION_W.reduce((s, [, w]) => s + w, 0);
    let v = r() * tot;
    for (const [n, w] of SECTION_W) { v -= w; if (v <= 0) return n; }
    return 'open';
  };
  let lastHeavy = false;
  const section = (type: string) => {
    const start = b.rows.length;
    const len = 10 + Math.floor(r() * 15);
    switch (type) {
      case 'open': case 'breather': {
        const [tl, tr] = [1 + (r() < 0.5 ? 1 : 0), 1 + (r() < 0.5 ? 1 : 0)];
        b.seg(len, L, R, tl, tr, 1); L = tl; R = tr; break;
      }
      case 'taper': {
        const [tl, tr] = clampW(Math.floor(r() * 6), Math.floor(r() * 6));
        b.seg(len, L, R, tl, tr, r() < 0.5 ? 1 : 0); L = tl; R = tr; break;
      }
      case 'corridor': case 'gauntlet': {
        const w = type === 'gauntlet' ? 8 + Math.floor(r() * 2) : 6 + Math.floor(r() * 4);
        const c = Math.floor(w / 2) + 2 + Math.floor(r() * (COLS - w - 4));
        const tl = c - Math.floor(w / 2), tr = COLS - tl - w;
        b.seg(5, L, R, tl, tr); b.seg(len - 5, tl, tr, tl, tr, type === 'corridor' && r() < 0.5 ? 1 : 0);
        L = tl; R = tr; break;
      }
      case 'zigzag': {
        const w = 7 + Math.floor(r() * 2);
        let tl = Math.max(2, Math.min(COLS - w - 2, L));
        b.seg(4, L, R, tl, COLS - tl - w);
        for (let k = 0; k < 4; k++) {
          const nl = Math.max(1, Math.min(COLS - w - 1, tl + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2))));
          b.seg(4 + Math.floor(r() * 3), tl, COLS - tl - w, nl, COLS - nl - w);
          tl = nl;
        }
        L = tl; R = COLS - tl - w; break;
      }
      case 'islands': {
        const [tl, tr] = [1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2)];
        b.seg(len, L, R, tl, tr, 1);
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const wb = 2 + Math.floor(r() * 3), hb = 2 + Math.floor(r() * 2);
          const col = tl + MIN_GAP + Math.floor(r() * Math.max(1, COLS - tl - tr - wb - MIN_GAP * 2 + 1));
          b.block(3 + Math.floor((k * (len - 6)) / n), col, wb, hb);
        }
        L = tl; R = tr; break;
      }
      case 'pillars': {
        b.seg(len, L, R, 1, 1); L = 1; R = 1;
        for (let off = 3; off < len - 3; off += 6 + Math.floor(r() * 3)) {
          const gap = 6 + Math.floor(r() * 2), gs = 2 + Math.floor(r() * (COLS - 4 - gap));
          b.block(off, 1, gs - 1, 2);
          b.block(off, gs + gap, COLS - 1 - (gs + gap), 2);
        }
        break;
      }
      case 'fork': {
        b.seg(len, L, R, 1, 1); L = 1; R = 1;
        const wb = 3 + Math.floor(r() * 2), col = Math.floor((COLS - wb) / 2) + (r() < 0.5 ? -1 : 0);
        b.block(4, col, wb, Math.max(4, len - 8));
        break;
      }
    }
    push(type, start);
  };
  // skeleton: intro, body, cp, body, mid, cp, body, cp, body, cp, body, end
  const bodyLen = () => 3 + Math.floor(r() * 2) + (index > 9 ? 1 : 0);
  const body = () => {
    for (let k = 0; k < bodyLen(); k++) {
      const t = lastHeavy ? 'breather' : rollSection();
      section(t);
      lastHeavy = t === 'gauntlet' || t === 'corridor' || t === 'zigzag';
    }
  };
  section('open');
  body(); b.cp();
  body();
  // close the walls before an arena so the boss has room
  b.seg(4, L, R, 1, 1); L = R = 1;
  b.mid('MID'); b.cp();
  push('arena', b.rows.length - 21);
  body(); b.cp();
  body(); b.cp();
  body(); b.cp();
  b.seg(4, L, R, 1, 1); L = R = 1;
  b.end('END');
  makeFair(b.rows);

  // ---- spawns
  const spawns: SpawnDef[] = [];
  const atRow = (row: number) => row * TILE - H + TILE;
  const open = (row: number) => {
    const rr = b.rows[Math.min(b.rows.length - 1, row)];
    const best = runs(rr).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0] ?? [1, COLS - 1];
    return [best[0] * TILE + 14, best[1] * TILE - 14] as [number, number];
  };
  const wallThick = (row: number, side: 'L' | 'R') => {
    const rr = b.rows[row]; let n = 0;
    if (side === 'L') while (n < COLS && rr[n]) n++; else while (n < COLS && rr[COLS - 1 - n]) n++;
    return n;
  };
  const addWall = (row: number, side: 'L' | 'R', type: string) => {
    const th = wallThick(row, side);
    if (th < 2 || th > 9) return false;
    const x = side === 'L' ? th * TILE + 6 : (COLS - th) * TILE - 6;
    spawns.push({ at: row * TILE - H - TILE, kind: 'wall', type: variant(type), x, row, pat: 'static' });
    return true;
  };
  const addGroup = (row: number, type: string): number => {
    const st = STYLE[type];
    const [x0, x1] = open(row);
    const pat = pick(st.pats);
    const n = st.n[0] + Math.floor(r() * (st.n[1] - st.n[0] + 1 + Math.floor(tier / 4)));
    const key = variant(type);
    const cx = Math.round(x0 + (x1 - x0) * (0.25 + r() * 0.5));
    const room = Math.max(10, (x1 - x0) / 2 - 10);
    const p: Record<string, number> = {};
    switch (pat) {
      case 'sine': p.a = Math.min(room, 20 + r() * 50); p.s = 0.7 + r() * 0.5; break;
      case 'swoop': p.dir = cx < 160 ? 1 : -1; p.s = 1.6 + r() * 0.8; if (r() < 0.4) p.alt = 1; break;
      case 'side': p.dir = r() < 0.5 ? 1 : -1; p.y = 30 + r() * 50; p.s = 1.3 + r() * 0.6; break;
      case 'zigzag': p.s = 0.9 + r() * 0.4; p.hs = 1.2 + r() * 0.6; break;
      case 'dive': p.stop = 40 + r() * 50; p.dx = n > 1 ? Math.min(60, (x1 - x0) / n) : 0; break;
      case 'hover': p.y = 40 + r() * 30; p.stay = 220 + r() * 120; p.dx = n > 1 ? Math.min(70, (x1 - x0) / n) : 0; break;
      case 'circle': p.cy = 70 + r() * 30; p.r = Math.min(room, 40 + r() * 30); p.dir = r() < 0.5 ? 1 : -1; break;
      case 'worm': p.a = Math.min(room, 30 + r() * 50); p.s = 0.6 + r() * 0.3; break;
      case 'down': p.s = 0.35 + r() * 0.15; break;
      case 'chase': p.s = 0.8 + r() * 0.6; p.life = 300; break;
      case 'orbit': p.dir = r() < 0.5 ? 1 : -1; break;
    }
    const startX = pat === 'dive' || pat === 'hover' ? Math.max(x0, cx - ((n - 1) * (p.dx ?? 0)) / 2) : cx;
    if (st.kind === 'one') spawns.push({ at: atRow(row), kind: 'one', type: key, x: cx, pat, p });
    else spawns.push({ at: atRow(row), kind: 'wave', type: key, n, x: Math.round(startX), pat, p, gap: st.gap });
    return st.threat * (st.kind === 'one' ? 1 : n);
  };
  const budgetBase = 1.6 + index * 0.32;
  let carry = 0;
  for (const s of sections) {
    if (s.type === 'arena') continue;
    if (s.type === 'breather') continue;
    let budget = budgetBase + r() * 1.2 - carry;
    carry = 0;
    // wall mounts first: gauntlets line both walls
    const wallTypes = base.wall;
    if (s.type === 'gauntlet' || (wallTypes.length && r() < 0.55)) {
      for (let off = 3; off < s.len - 2 && budget > 0.5; off += 6) {
        const wt = pick(wallTypes);
        if (wt === 'gate') { if (addWall(s.start + off, 'L', 'gate') && addWall(s.start + off, 'R', 'gate')) budget -= 2.4; }
        else for (const side of ['L', 'R'] as const) if ((s.type === 'gauntlet' || r() < 0.5) && addWall(s.start + off, side, wt)) budget -= STYLE[wt].threat;
      }
    }
    // flying groups, spaced at least 5 rows apart
    let off = 2;
    let groups = 0;
    while (budget > 0.6 && groups < 3 && off < s.len - 1) {
      const t = pick(fly);
      budget -= addGroup(s.start + off, t);
      groups++;
      off += 5 + Math.floor(r() * 4);
    }
    if (budget < -1) { s.heavy = true; carry = Math.min(2, -budget); } // overspent: next section is quieter
  }
  // capsules: 2–4, the first one before the mid boss is always a Power Up, Super Power at most once
  const midRow = (b.midBoss!.at / TILE) | 0;
  const pre = sections.filter((s) => s.start < midRow && s.type !== 'arena');
  const post = sections.filter((s) => s.start > midRow && s.type !== 'arena');
  let usedX = false;
  const nCaps = 2 + Math.floor(r() * 3);
  for (let i = 0; i < nCaps; i++) {
    const pool = i === 0 ? pre : r() < 0.5 ? pre : post;
    if (!pool.length) continue;
    const s = pick(pool);
    const row = s.start + Math.floor(s.len / 2);
    const [x0, x1] = open(row);
    let tok = i === 0 ? 'P' : rollToken(r, !usedX);
    if (tok === 'X') usedX = true;
    spawns.push({ at: atRow(row), kind: 'cap', type: 'capsule', x: Math.round((x0 + x1) / 2), token: tok });
  }

  // ---- bosses
  const hueIdx = Math.floor(r() * 4);
  // Classic: rotate through the designs so each appears about equally; Randomiser: free pick
  const midBase = randomTheme ? pick(MID_BOSSES) : MID_BOSSES[index % MID_BOSSES.length];
  const endBase = randomTheme ? pick(END_BOSSES) : END_BOSSES[index % END_BOSSES.length];
  const other = (a: string, pool: string[]) => pick(pool.filter((k) => k !== a));
  const remix = r() < (randomTheme ? 0.45 : 0.3);
  const midKey = remix
    ? remixBoss(midBase, other(midBase, MID_BOSSES), tier, hueIdx, false)
    : bossVariant(midBase, tier, hueIdx, Math.floor(r() * 4));
  let endKey: string;
  if (index === 14) endKey = bossVariant('overmind', 12, 3, 1, true); // the hardest: maxed modifiers + second phase
  else if (r() < (randomTheme ? 0.4 : 0.25)) endKey = remixBoss(endBase, other(endBase, [...END_BOSSES, ...MID_BOSSES]), tier, (hueIdx + 1) % 4, true);
  else endKey = bossVariant(endBase, tier, (hueIdx + 2) % 4, Math.floor(r() * 4));
  b.midBoss!.boss = midKey;
  b.endBoss!.boss = endKey;

  b.spawns = spawns;
  const music = transposeTrack(gt.music, gt.semis + (randomTheme ? Math.floor(r() * 5) - 2 : 0), gt.bpm);
  const name = randomTheme ? gt.name : gt.name;
  return b.build(index, name, theme, music, Math.min(0.7, 0.5 + index * 0.012));
}

// classic level themes, borrowed for Randomiser mode (filled lazily to avoid import cycles)
let classicThemes: GenTheme[] | null = null;
export function setClassicThemes(t: GenTheme[]) { classicThemes = t; }
function CLASSIC_THEMES(): GenTheme[] { return classicThemes ?? []; }
