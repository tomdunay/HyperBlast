// Enemy archetypes: procedural sprites, movement scripts and firing behaviour.
import { renderShapes, Spr, Shape } from '../art/sprites';
import type { World } from './World';
import { rnd, recolor } from '../engine/gfx';

export interface Enemy {
  alive: boolean; def: EnemyDef; x: number; y: number; ox: number; oy: number; vx: number; vy: number;
  hp: number; t: number; world: boolean; flash: number; pat: string; p: Record<string, number>;
  spawnIdx: number; fireT: number; x0: number; y0: number; trail: { x: number; y: number }[]; token?: string;
  state: number; dir: number; segHp?: number;
  /** threat director: tougher, faster-firing, better-paying variant */
  elite?: boolean;
  /** flat damage soaked per hit */
  armor?: number;
}

export interface FireDef { every: number; kind: 'aim' | 'down' | 'spread3' | 'spread5' | 'ring' | 'aim3'; speed: number; bullet?: string; delay?: number; telegraph?: number }
export interface EnemyDef {
  name: string; hp: number; cash: number; score: number; w: number; h: number;
  frames: Spr[]; anim: number; expl: 0 | 1 | 2; fire?: FireDef; world?: boolean;
  /** rotate sprite to face velocity */
  face?: boolean;
  segs?: number; // worm segments
  segSpr?: Spr;
  update?: (e: Enemy, w: World) => void;
  armored?: boolean; // ping instead of flash on low-dmg hits
  touchDmg?: number;
  noCash?: boolean;
  /** spawns this many children of the given type on death */
  splitInto?: { type: string; n: number };
  /** periodically releases minions while on screen */
  spawner?: { type: string; every: number; pat: string };
}

export const ENEMIES: Record<string, EnemyDef> = {};

const sh = renderShapes;
function frames(w: number, h: number, n: number, f: (k: number) => Shape[], sym = true) {
  return Array.from({ length: n }, (_, k) => sh(w, h, f(k), sym));
}

export function buildEnemies() {
  const E = ENEMIES;
  // ---------- Level 1: primordial sea ----------
  E.tadpole = {
    name: 'tadpole', hp: 1, cash: 5, score: 100, w: 12, h: 12, anim: 6, expl: 0, face: true,
    frames: frames(16, 20, 3, (k) => [
      { t: 'poly', p: [0, 2, -2 + (k - 1) * 2, 9, 0 + (k - 1) * 3, 9, 2 + (k - 1) * 2, 9], r: 'green', l: 0.7 },
      { t: 'ell', x: 0, y: -2, rx: 5, ry: 6, r: 'green', bias: 0.05 },
      { t: 'eye', x: -2, y: -4, rad: 1.6, ly: -1, z: 20 },
      { t: 'eye', x: 2, y: -4, rad: 1.6, ly: -1, z: 20 },
    ], false),
  };
  E.nautilus = {
    name: 'nautilus', hp: 3, cash: 10, score: 200, w: 16, h: 16, anim: 0, expl: 0,
    fire: { every: 110, kind: 'aim', speed: 1.6 },
    frames: [sh(22, 22, [
      { t: 'ell', x: 0, y: 0, rx: 9, ry: 9, r: 'shell' }, { t: 'ell', x: 2, y: -1, rx: 5.5, ry: 5.5, r: 'shell', z: 6, bias: 0.15 },
      { t: 'ell', x: 3, y: -1, rx: 2.5, ry: 2.5, r: 'shell', z: 10, bias: 0.25 },
      { t: 'poly', p: [-8, 3, -10, 10, -6, 6, -4, 11, -3, 5], r: 'flesh', z: 12 }, { t: 'eye', x: -5, y: 2, rad: 2, z: 15 },
    ])],
  };
  E.jelly = {
    name: 'jelly', hp: 3, cash: 15, score: 250, w: 16, h: 16, anim: 8, expl: 0,
    fire: { every: 130, kind: 'spread3', speed: 1.4, bullet: 'eSpore' },
    frames: frames(20, 26, 2, (k) => [
      { t: 'ell', x: 0, y: -5, rx: 8, ry: 6, r: 'purple', bias: 0.1 },
      { t: 'ell', x: 0, y: -6, rx: 4, ry: 3, r: 'flesh', z: 8, bias: 0.2 },
      ...[-6, -2, 2, 6].map((x, i) => ({ t: 'cyl', x: x + ((i + k) % 2 ? 1 : -1), y: 5, w: 2, h: 10 - ((i + k) % 2) * 3, r: 'purple' } as Shape)),
    ], false),
  };
  E.trilo = {
    name: 'trilo', hp: 5, cash: 15, score: 300, w: 20, h: 18, anim: 10, expl: 1, armored: true,
    fire: { every: 120, kind: 'aim', speed: 1.5, delay: 40 },
    frames: frames(26, 26, 2, (k) => [
      ...[-6, -1, 4].map((y) => ({ t: 'poly', p: [0, y, -12, y - 2 + k * 2, -11, y + 2 + k * 2], r: 'shell', l: 0.5 } as Shape)),
      { t: 'ell', x: 0, y: 0, rx: 9, ry: 11, r: 'shell' },
      { t: 'ribs', x: 0, y: 2, w: 14, h: 14, n: 4, r: 'shell' },
      { t: 'ell', x: 0, y: -8, rx: 6, ry: 4, r: 'bone', z: 8 },
      { t: 'eye', x: -3, y: -8, rad: 1.6, z: 20 },
    ]),
  };
  E.anemone = {
    name: 'anemone', hp: 6, cash: 20, score: 400, w: 16, h: 16, anim: 12, expl: 1, world: true,
    fire: { every: 95, kind: 'aim', speed: 1.8 },
    frames: frames(24, 24, 2, (k) => [
      { t: 'spikes', x: 0, y: 0, rad: 6, n: 9, len: 5 + k, r: 'flesh', a0: k * 0.2 },
      { t: 'ell', x: 0, y: 0, rx: 7, ry: 7, r: 'red' },
      { t: 'ell', x: 0, y: 0, rx: 3, ry: 3, r: 'eye', z: 10, spec: true },
    ]),
  };
  E.crab = {
    name: 'crab', hp: 10, cash: 30, score: 500, w: 26, h: 18, anim: 10, expl: 1, armored: true,
    fire: { every: 90, kind: 'spread3', speed: 1.6 },
    frames: frames(34, 26, 2, (k) => [
      { t: 'poly', p: [-6, 2, -15, -8 - k, -12, -10 - k, -9, -5, -12, -2], r: 'red', l: 0.7 },
      { t: 'ell', x: -13, y: -10 - k, rx: 3.5, ry: 4, r: 'red', z: 4 },
      ...[2, 5, 8].map((y) => ({ t: 'poly', p: [-6, y, -16, y + 3 + (k ? 1 : -1), -15, y + 5], r: 'red', l: 0.45 } as Shape)),
      { t: 'ell', x: 0, y: 2, rx: 11, ry: 8, r: 'red' },
      { t: 'eye', x: -3, y: -3, rad: 2, ly: 1, z: 15 },
    ]),
  };
  // ---------- Level 2: fossil caverns ----------
  E.worm = {
    name: 'worm', hp: 12, cash: 40, score: 800, w: 14, h: 14, anim: 0, expl: 1, segs: 7,
    frames: [sh(18, 18, [{ t: 'ell', x: 0, y: 0, rx: 7, ry: 7, r: 'flesh' }, { t: 'spikes', x: 0, y: 2, rad: 5, n: 3, len: 3, r: 'bone', a0: 0.6 }, { t: 'eye', x: 0, y: 1, rad: 2.5, z: 20 }])],
    segSpr: sh(14, 14, [{ t: 'ell', x: 0, y: 0, rx: 5.5, ry: 5.5, r: 'flesh', bias: -0.05 }, { t: 'ribs', x: 0, y: 0, w: 9, h: 8, n: 2, r: 'bone' }]),
  };
  E.sporepod = {
    name: 'sporepod', hp: 5, cash: 20, score: 300, w: 16, h: 16, anim: 15, expl: 1, world: true,
    fire: { every: 150, kind: 'ring', speed: 1.1, bullet: 'eSpore' },
    frames: frames(22, 22, 2, (k) => [
      { t: 'ell', x: 0, y: 0, rx: 8 + k * 0.6, ry: 8 + k * 0.6, r: 'slime' },
      ...[0, 1, 2, 3, 4].map((i) => ({ t: 'ell', x: Math.cos(i * 1.3) * 4, y: Math.sin(i * 1.3) * 4, rx: 2, ry: 2, r: 'yellow', z: 10 } as Shape)),
    ]),
  };
  E.spore = {
    name: 'spore', hp: 1, cash: 0, score: 50, w: 8, h: 8, anim: 5, expl: 0, noCash: true,
    frames: frames(12, 12, 2, (k) => [{ t: 'spikes', x: 0, y: 0, rad: 3, n: 5, len: 2, r: 'slime', a0: k * 0.6 }, { t: 'ell', x: 0, y: 0, rx: 3.5, ry: 3.5, r: 'yellow' }]),
  };
  E.skullfish = {
    name: 'skullfish', hp: 3, cash: 10, score: 200, w: 14, h: 14, anim: 6, expl: 0, face: true,
    fire: { every: 140, kind: 'aim', speed: 2, bullet: 'eNeedle' },
    frames: frames(18, 22, 2, (k) => [
      { t: 'poly', p: [0, 4, -4 + k * 2, 11, 4 + k * 2, 11], r: 'bone', l: 0.6 },
      { t: 'ribs', x: 0, y: 3, w: 8, h: 6, n: 2, r: 'bone' },
      { t: 'ell', x: 0, y: -4, rx: 6, ry: 5, r: 'bone' },
      { t: 'ell', x: -2.5, y: -4, rx: 1.6, ry: 1.8, r: 'dark', z: 10, bias: -0.5 }, { t: 'ell', x: 2.5, y: -4, rx: 1.6, ry: 1.8, r: 'dark', z: 10, bias: -0.5 },
    ], false),
  };
  E.eye = {
    name: 'eye', hp: 6, cash: 20, score: 400, w: 16, h: 16, anim: 0, expl: 1,
    fire: { every: 80, kind: 'aim', speed: 2.1, bullet: 'eBig' },
    frames: [sh(22, 22, [{ t: 'spikes', x: 0, y: 0, rad: 7, n: 8, len: 3, r: 'flesh' }, { t: 'ell', x: 0, y: 0, rx: 8, ry: 8, r: 'flesh' }])],
  };
  E.bonespine = {
    name: 'bonespine', hp: 7, cash: 25, score: 400, w: 16, h: 16, anim: 0, expl: 1, world: true, armored: true,
    fire: { every: 75, kind: 'aim', speed: 1.9, bullet: 'eNeedle' },
    frames: [sh(24, 24, [{ t: 'spikes', x: 0, y: 0, rad: 5, n: 6, len: 6, r: 'bone' }, { t: 'ell', x: 0, y: 0, rx: 7, ry: 7, r: 'bone' }, { t: 'ell', x: 0, y: 0, rx: 3, ry: 3, r: 'red', z: 9 }])],
  };
  // ---------- Level 3: jungle hive ----------
  E.wasp = {
    name: 'wasp', hp: 1, cash: 5, score: 120, w: 12, h: 12, anim: 2, expl: 0, face: true,
    frames: frames(18, 18, 2, (k) => [
      { t: 'ell', x: -5, y: -2 + k, rx: 4, ry: 2 + k, r: 'cyan', bias: 0.3, z: -3 }, { t: 'ell', x: 5, y: -2 + k, rx: 4, ry: 2 + k, r: 'cyan', bias: 0.3, z: -3 },
      { t: 'ell', x: 0, y: 3, rx: 3, ry: 5, r: 'yellow' }, { t: 'ribs', x: 0, y: 4, w: 5, h: 6, n: 2, r: 'dark' },
      { t: 'ell', x: 0, y: -3, rx: 3, ry: 3, r: 'green', z: 5 },
    ], false),
  };
  E.eggsac = {
    name: 'eggsac', hp: 10, cash: 40, score: 600, w: 20, h: 20, anim: 12, expl: 1, world: true,
    frames: frames(28, 28, 2, (k) => [
      { t: 'ell', x: 0, y: 0, rx: 11 + k, ry: 10 + k, r: 'flesh', bias: -0.05 },
      ...[[-4, -3], [3, -4], [0, 3], [5, 3], [-5, 4]].map(([x, y]) => ({ t: 'ell', x, y, rx: 2.5, ry: 2.5, r: 'yellow', z: 10, spec: true } as Shape)),
    ]),
  };
  E.beetle = {
    name: 'beetle', hp: 12, cash: 35, score: 600, w: 22, h: 22, anim: 8, expl: 1, armored: true,
    fire: { every: 100, kind: 'spread5', speed: 1.5 },
    frames: frames(30, 30, 2, (k) => [
      ...[-5, 0, 5].map((y) => ({ t: 'poly', p: [-6, y, -14, y + (k ? 3 : -3), -13, y + 2], r: 'dark', l: 0.8 } as Shape)),
      { t: 'ell', x: 0, y: 2, rx: 10, ry: 11, r: 'green' }, { t: 'line', x0: 0, y0: -6, x1: 0, y1: 13, c: '#002200' },
      { t: 'ell', x: 0, y: -9, rx: 6, ry: 4, r: 'dark', z: 10, bias: 0.2 },
      { t: 'poly', p: [-3, -12, -5, -15, -1, -12], r: 'bone', z: 12 },
    ]),
  };
  E.mantis = {
    name: 'mantis', hp: 6, cash: 25, score: 450, w: 16, h: 18, anim: 6, expl: 1, face: true,
    frames: frames(24, 26, 2, (k) => [
      { t: 'poly', p: [-3, -2, -10, -11 + k * 2, -7, -12 + k * 2, -2, -5], r: 'green', l: 0.9 },
      { t: 'ell', x: 0, y: 3, rx: 4, ry: 9, r: 'green' }, { t: 'ell', x: 0, y: -7, rx: 4, ry: 3, r: 'slime', z: 6 },
      { t: 'eye', x: -3, y: -8, rad: 1.5, ly: -1, z: 20 },
    ]),
  };
  E.vinepod = {
    name: 'vinepod', hp: 7, cash: 25, score: 400, w: 16, h: 16, anim: 10, expl: 1, world: true,
    fire: { every: 70, kind: 'aim3', speed: 1.6, bullet: 'eSpore' },
    frames: frames(22, 22, 2, (k) => [
      { t: 'spikes', x: 0, y: 0, rad: 6, n: 5, len: 4 + k, r: 'green', a0: 0.3 },
      { t: 'ell', x: 0, y: 0, rx: 7, ry: 7, r: 'purple' }, { t: 'ell', x: 0, y: 1, rx: 3, ry: 2 + k, r: 'red', z: 10 },
    ]),
  };
  // ---------- Level 4: biomech fortress ----------
  E.mturret = {
    name: 'mturret', hp: 9, cash: 30, score: 500, w: 18, h: 18, anim: 0, expl: 1, world: true, armored: true,
    fire: { every: 60, kind: 'aim', speed: 2.2, bullet: 'ePlasma' },
    frames: [sh(24, 24, [{ t: 'box', x: 0, y: 0, w: 20, h: 20, r: 'steel', bevel: 2 }, { t: 'ell', x: 0, y: 0, rx: 6, ry: 6, r: 'flesh', z: 6 }, { t: 'ell', x: 0, y: 0, rx: 2.5, ry: 2.5, r: 'eye', z: 12 }])],
  };
  E.fleshpod = {
    name: 'fleshpod', hp: 4, cash: 15, score: 300, w: 16, h: 16, anim: 8, expl: 0,
    fire: { every: 100, kind: 'aim', speed: 1.8, bullet: 'ePlasma' },
    frames: frames(20, 20, 2, (k) => [
      { t: 'ell', x: 0, y: 0, rx: 8, ry: 7 + k, r: 'flesh' },
      { t: 'box', x: 0, y: 0, w: 16, h: 4, r: 'steel', bevel: 1, z: 9 },
      { t: 'ell', x: 0, y: 0, rx: 2, ry: 2, r: 'cyan', z: 14 },
    ]),
  };
  E.cyclops = {
    name: 'cyclops', hp: 16, cash: 50, score: 900, w: 26, h: 24, anim: 10, expl: 1, armored: true,
    fire: { every: 70, kind: 'aim3', speed: 2, bullet: 'ePlasma' },
    frames: frames(34, 32, 2, (k) => [
      { t: 'cyl', x: -12, y: 4, w: 6, h: 14 + k, r: 'steel' },
      { t: 'ell', x: 0, y: 0, rx: 12, ry: 12, r: 'flesh' }, { t: 'box', x: 0, y: -8, w: 18, h: 6, r: 'steel', z: 12, bevel: 1 },
      { t: 'eye', x: 0, y: 2, rad: 5, z: 20 },
    ]),
  };
  // ---------- Level 5: metallic spaceways ----------
  E.drone = {
    name: 'drone', hp: 3, cash: 15, score: 250, w: 16, h: 14, anim: 4, expl: 0,
    fire: { every: 90, kind: 'aim', speed: 2.4, bullet: 'eNeedle' },
    frames: frames(22, 18, 2, (k) => [
      { t: 'poly', p: [0, -6, -10, 4, -10, 7, 0, 3], r: 'chrome', l: 0.8 },
      { t: 'ell', x: 0, y: 0, rx: 5, ry: 6, r: 'steel' }, { t: 'ell', x: 0, y: 1, rx: 2, ry: 2, r: k ? 'red' : 'eye', z: 10, spec: true },
    ]),
  };
  E.scout = {
    name: 'scout', hp: 2, cash: 10, score: 200, w: 12, h: 12, anim: 0, expl: 0, face: true,
    frames: [sh(16, 18, [{ t: 'poly', p: [0, 8, -6, -6, 0, -3], r: 'chrome', l: 0.9 }, { t: 'ell', x: 0, y: 0, rx: 2.5, ry: 6, r: 'blue', z: 5 }])],
  };
  E.walker = {
    name: 'walker', hp: 24, cash: 70, score: 1200, w: 30, h: 26, anim: 12, expl: 2, armored: true,
    fire: { every: 110, kind: 'ring', speed: 1.6, bullet: 'ePlasma' },
    frames: frames(40, 36, 2, (k) => [
      { t: 'cyl', x: -13, y: 8 + k * 2, w: 5, h: 14, r: 'steel' },
      { t: 'box', x: 0, y: 0, w: 30, h: 20, r: 'chrome', bevel: 3 },
      { t: 'box', x: 0, y: -2, w: 14, h: 8, r: 'blue', bevel: 1, z: 10 },
      { t: 'cyl', x: -9, y: -12, w: 3, h: 8, r: 'steel', z: 4 },
    ]),
  };
  E.sentry = {
    name: 'sentry', hp: 9, cash: 30, score: 500, w: 18, h: 18, anim: 0, expl: 1, world: true, armored: true,
    fire: { every: 55, kind: 'aim3', speed: 2.2, bullet: 'eNeedle' },
    frames: [sh(24, 24, [{ t: 'ell', x: 0, y: 0, rx: 10, ry: 10, r: 'chrome' }, { t: 'box', x: 0, y: 0, w: 12, h: 12, r: 'steel', z: 10, bevel: 2 }, { t: 'ell', x: 0, y: 0, rx: 3, ry: 3, r: 'red', z: 20, spec: true }])],
  };
  E.gate = {
    name: 'gate', hp: 14, cash: 40, score: 700, w: 16, h: 16, anim: 0, expl: 1, world: true, armored: true,
    frames: [sh(20, 20, [{ t: 'box', x: 0, y: 0, w: 16, h: 16, r: 'steel', bevel: 2 }, { t: 'ell', x: 0, y: 0, rx: 5, ry: 5, r: 'cyan', z: 10, spec: true }])],
  };
  // ---------- new archetypes (levels 6+) ----------
  E.ray = {
    name: 'ray', hp: 5, cash: 20, score: 350, w: 28, h: 12, anim: 8, expl: 1,
    fire: { every: 120, kind: 'aim3', speed: 1.8, bullet: 'eNeedle' },
    frames: frames(34, 20, 2, (k) => [
      { t: 'poly', p: [0, -6, -16, 2 + k * 2, -12, 5, 0, 3], r: 'blue', l: 0.75 },
      { t: 'poly', p: [0, 3, -2, 9, 0, 9], r: 'blue', l: 0.5 },
      { t: 'ell', x: 0, y: -1, rx: 4, ry: 6, r: 'blue', bias: 0.1, z: 5 },
      { t: 'eye', x: -2, y: -3, rad: 1.5, z: 20 },
    ]),
  };
  E.minelayer = {
    name: 'minelayer', hp: 9, cash: 35, score: 600, w: 20, h: 18, anim: 10, expl: 1, armored: true,
    fire: { every: 75, kind: 'down', speed: 0.7, bullet: 'eBig' },
    frames: frames(26, 24, 2, (k) => [
      { t: 'ell', x: 0, y: -2, rx: 10, ry: 8, r: 'steel' },
      { t: 'box', x: 0, y: 6, w: 10, h: 6, r: 'dark', bevel: 1, z: 8 },
      { t: 'ell', x: 0, y: -3, rx: 3, ry: 3, r: k ? 'red' : 'orange', z: 12, spec: true },
    ]),
  };
  E.splitter = {
    name: 'splitter', hp: 4, cash: 15, score: 300, w: 16, h: 16, anim: 6, expl: 0, splitInto: { type: 'splitling', n: 3 },
    frames: frames(20, 20, 2, (k) => [
      { t: 'ell', x: -3 + k, y: 0, rx: 6, ry: 7, r: 'purple' }, { t: 'ell', x: 3 - k, y: 0, rx: 6, ry: 7, r: 'purple', z: 2 },
      { t: 'ell', x: 0, y: 0, rx: 2.5, ry: 2.5, r: 'yellow', z: 12, spec: true },
    ]),
  };
  E.splitling = {
    name: 'splitling', hp: 1, cash: 5, score: 80, w: 9, h: 9, anim: 4, expl: 0,
    frames: frames(12, 12, 2, (k) => [{ t: 'ell', x: 0, y: 0, rx: 4 - k * 0.5, ry: 4, r: 'purple' }, { t: 'ell', x: 0, y: 0, rx: 1.5, ry: 1.5, r: 'yellow', z: 8 }]),
  };
  E.orbiter = {
    name: 'orbiter', hp: 4, cash: 20, score: 350, w: 14, h: 14, anim: 3, expl: 0,
    fire: { every: 100, kind: 'aim', speed: 2, bullet: 'ePlasma' },
    frames: frames(20, 20, 2, (k) => [
      { t: 'spikes', x: 0, y: 0, rad: 5, n: 3, len: 4, r: 'cyan', a0: k * 0.5 },
      { t: 'ell', x: 0, y: 0, rx: 5, ry: 5, r: 'chrome', spec: true },
      { t: 'ell', x: 0, y: 0, rx: 2, ry: 2, r: 'purple', z: 10 },
    ]),
  };
  E.sniper = {
    name: 'sniper', hp: 8, cash: 30, score: 500, w: 16, h: 16, anim: 0, expl: 1, world: true, armored: true,
    fire: { every: 140, kind: 'aim', speed: 4.6, bullet: 'eNeedle', telegraph: 40 },
    frames: [sh(22, 22, [{ t: 'ell', x: 0, y: 0, rx: 8, ry: 8, r: 'steel' }, { t: 'cyl', x: 0, y: 5, w: 3, h: 10, r: 'chrome', z: 6 }, { t: 'ell', x: 0, y: -1, rx: 2.5, ry: 2.5, r: 'red', z: 12, spec: true }])],
  };
  E.swarmqueen = {
    name: 'swarmqueen', hp: 18, cash: 60, score: 1200, w: 26, h: 22, anim: 4, expl: 2,
    spawner: { type: 'wasp', every: 90, pat: 'chase' },
    fire: { every: 110, kind: 'spread3', speed: 1.5, bullet: 'eSpore' },
    frames: frames(36, 30, 2, (k) => [
      { t: 'ell', x: -10, y: -4 + k, rx: 8, ry: 4 + k, r: 'cyan', bias: 0.3, z: -3 }, { t: 'ell', x: 10, y: -4 + k, rx: 8, ry: 4 + k, r: 'cyan', bias: 0.3, z: -3 },
      { t: 'ell', x: 0, y: 4, rx: 7, ry: 10, r: 'yellow' }, { t: 'ribs', x: 0, y: 6, w: 10, h: 12, n: 3, r: 'dark' },
      { t: 'ell', x: 0, y: -7, rx: 5, ry: 4, r: 'purple', z: 8 }, { t: 'eye', x: -2, y: -8, rad: 1.6, z: 20 },
    ], false),
  };
  E.eggsac.spawner = { type: 'wasp', every: 160, pat: 'chase' };
  // ---------- shared ----------
  E.capsule ={ name: 'capsule', hp: 3, cash: 0, score: 100, w: 16, h: 16, anim: 0, expl: 0, frames: [], noCash: true, touchDmg: 0 };
}

// ---------- movement scripts (screen space; world-attached ones also get scroll delta applied) ----------
export const PATTERNS: Record<string, (e: Enemy, w: World) => void> = {
  down(e) { e.y += e.p.s ?? 1; e.x += e.p.vx ?? 0; },
  sine(e) {
    e.y += e.p.s ?? 0.9;
    e.x = e.x0 + Math.sin(e.t * (e.p.f ?? 0.04) + (e.p.ph ?? 0)) * (e.p.a ?? 40);
  },
  swoop(e) {
    // dive down, then curve towards dir and leave
    const s = e.p.s ?? 1.6;
    if (e.t < (e.p.turn ?? 50)) { e.vy = s; e.vx = 0; }
    else { e.vx += (e.p.dir ?? 1) * 0.06; e.vy -= 0.025; if (e.vy < -s) e.vy = -s; }
    e.x += e.vx; e.y += e.vy;
  },
  dive(e, w) {
    if (e.state === 0) { e.y += (e.p.stop ?? 70) > e.y ? 1.5 : 0; if (e.y >= (e.p.stop ?? 70)) { e.state = 1; e.fireT = 0; e.t = 0; } }
    else if (e.state === 1) { if (e.t > 40) { const a = Math.atan2(w.player.y - e.y, w.player.x - e.x); e.vx = Math.cos(a) * 0.4; e.vy = Math.sin(a) * 0.4; e.state = 2; } }
    else { e.vx *= 1.06; e.vy *= 1.06; const sp = Math.hypot(e.vx, e.vy); if (sp > 4) { e.vx *= 4 / sp; e.vy *= 4 / sp; } e.x += e.vx; e.y += e.vy; }
  },
  chase(e, w) {
    const s = e.p.s ?? 0.9;
    const a = Math.atan2(w.player.y - e.y, w.player.x - e.x);
    e.vx += Math.cos(a) * 0.06; e.vy += Math.sin(a) * 0.06;
    const sp = Math.hypot(e.vx, e.vy); if (sp > s) { e.vx *= s / sp; e.vy *= s / sp; }
    if (e.t > (e.p.life ?? 500)) e.vy += 0.1;
    e.x += e.vx; e.y += e.vy;
  },
  circle(e) {
    const cy = e.p.cy ?? 80, r = e.p.r ?? 40;
    if (e.state === 0) { e.y += 1.4; if (e.y >= cy - r) { e.state = 1; e.t = 0; } }
    else if (e.state === 1) {
      e.x = e.x0 + Math.sin(e.t * 0.035) * r * (e.p.dir ?? 1);
      e.y = cy - Math.cos(e.t * 0.035) * r;
      if (e.t > 260) e.state = 2;
    } else e.y += 1.6;
  },
  side(e) {
    // enters from x side (dir = +1 from left), crosses with sine bob
    e.x += (e.p.dir ?? 1) * (e.p.s ?? 1.3);
    e.y = e.y0 + Math.sin(e.t * 0.05) * (e.p.a ?? 12) + e.t * (e.p.drift ?? 0.15);
  },
  rise(e) {
    e.y -= e.p.s ?? 1.2;
    e.x = e.x0 + Math.sin(e.t * 0.05) * (e.p.a ?? 20);
  },
  zigzag(e) {
    e.y += e.p.s ?? 1;
    if (e.t % (e.p.n ?? 40) === 0) e.dir = -(e.dir || 1);
    e.x += e.dir * (e.p.hs ?? 1.5);
  },
  hover(e, w) {
    const ty = e.p.y ?? 60;
    if (e.state === 0) { e.y += (ty - e.y) * 0.04 + 0.2; if (e.y >= ty) e.state = 1; }
    else if (e.state === 1) { e.x += (w.player.x - e.x) * 0.012; e.y = ty + Math.sin(e.t * 0.05) * 4; if (e.t > (e.p.stay ?? 360)) e.state = 2; }
    else e.y += 1.5;
  },
  static() {},
  crawl(e) {
    // crawls along the wall (world-attached), small vertical motion
    e.y += Math.sin(e.t * 0.02) * 0.4;
  },
  worm(e) {
    e.y += e.p.s ?? 0.8;
    e.x = e.x0 + Math.sin(e.t * (e.p.f ?? 0.035)) * (e.p.a ?? 70);
  },
  /** swoops in, circles the player for a while, then leaves */
  orbit(e, w) {
    if (e.state === 0) { e.y += 1.6; if (e.y > 40) { e.state = 1; e.t = 0; } }
    else if (e.state === 1) {
      const a = e.t * 0.035 * (e.dir || 1);
      const tx = w.player.x + Math.cos(a) * 70, ty = Math.min(200, w.player.y - 40) + Math.sin(a) * 45;
      e.x += (tx - e.x) * 0.05; e.y += (ty - e.y) * 0.05;
      if (e.t > (e.p.stay ?? 340)) e.state = 2;
    } else e.y += 2;
  },
};

// ---------- seeded variants (palette swap + stat tweaks, no new code paths) ----------
const VARIANT_RECIPES = [
  { tag: 'red', hue: 150, sat: 1.2, lig: 1, hp: 1.3, rate: 0.75, bullet: 'eNeedle', cash: 1.3 },
  { tag: 'void', hue: 230, sat: 0.9, lig: 0.85, hp: 1.7, rate: 0.9, bullet: 'ePlasma', cash: 1.6 },
];
/** Register (once) and return the enemy key for variant k (1 or 2) of a base type. */
export function variantKey(base: string, k: number): string {
  const key = `${base}#${k}`;
  if (ENEMIES[key]) return key;
  const b = ENEMIES[base], r = VARIANT_RECIPES[(k - 1) % VARIANT_RECIPES.length];
  ENEMIES[key] = {
    ...b,
    hp: Math.ceil(b.hp * r.hp),
    cash: Math.round(b.cash * r.cash),
    score: Math.round(b.score * 1.4),
    frames: b.frames.map((f) => recolor(f, r.hue, r.sat, r.lig)),
    segSpr: b.segSpr ? recolor(b.segSpr, r.hue, r.sat, r.lig) : undefined,
    fire: b.fire ? { ...b.fire, every: Math.round(b.fire.every * r.rate), bullet: b.fire.telegraph ? b.fire.bullet : r.bullet } : undefined,
  };
  return key;
}

/** Deterministic capsule token roll. */
export function rollToken(r: () => number, allowX: boolean): string {
  const v = r();
  if (v < 0.32) return 'P';
  if (v < 0.48) return '$';
  if (v < 0.62) return 'H';
  if (v < 0.72) return 'S';
  if (v < 0.82) return 'Z';
  if (v < 0.92) return 'D';
  if (v < 0.98 && allowX) return 'X';
  return v < 0.98 ? 'H' : '1';
}

export function makeTrail(e: Enemy) {
  e.trail = [];
  for (let i = 0; i < 64; i++) e.trail.push({ x: e.x, y: e.y });
}

export function randomCapsuleToken(): string {
  const r = Math.random();
  if (r < 0.32) return 'P';
  if (r < 0.48) return '$';
  if (r < 0.62) return 'H';
  if (r < 0.72) return 'S';
  if (r < 0.82) return 'Z';
  if (r < 0.92) return 'D';
  if (r < 0.98) return 'X';
  return '1';
}
export { rnd };
