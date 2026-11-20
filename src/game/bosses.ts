// Boss framework: huge multi-part bosses destroyed piece by piece, plus nine boss designs.
import { renderShapes, Shape, Spr, flashOf } from '../art/sprites';
import { charred, cracked, Ctx, rnd, recolor, snap, RNG, RampName } from '../engine/gfx';
import { emissiveOf, shadowOf } from '../engine/light';
import { audio } from '../engine/audio';
import type { World } from './World';

export interface GunDef {
  kind: 'aim' | 'aim3' | 'spread' | 'ring' | 'spiral' | 'beam' | 'spawn';
  every: number; n?: number; speed?: number; arc?: number; enemy?: string; pat?: string; bullet?: string; offset?: number;
}
export interface PartDef {
  id: string; x: number; y: number; w: number; h: number; hp: number; shapes: Shape[];
  requires?: string[]; core?: boolean; guns?: GunDef[]; anim?: 'eye' | 'pulse'; under?: boolean; pad?: number;
}
export interface BossDef {
  name: string; w: number; h: number; body: Shape[]; sym?: boolean; bodyHit: [number, number, number, number];
  parts: PartDef[]; move: 'sway' | 'figure8' | 'charge' | 'track'; amp: number; ty: number; cash: number; score: number; bomb: boolean;
  /** extra hp multiplier for later-level variants */
  hpScale?: number;
  /** palette swap applied to all art (hue rotation in degrees) */
  hue?: number;
  /** when the core drops below half, two gun parts are rebuilt */
  phase2?: boolean;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const EXTRA_GUNS: GunDef[] = [
  { kind: 'aim3', every: 75, speed: 2.1 },
  { kind: 'ring', every: 140, n: 14, speed: 1.4, bullet: 'ePlasma' },
  { kind: 'spiral', every: 7, n: 2, speed: 1.4 },
  { kind: 'spawn', every: 210, enemy: 'orbiter', pat: 'orbit' },
];
const HUES = [0, 70, 160, 250];

/** Register a tougher, recoloured copy of a boss for a later level. Returns its key. */
export function bossVariant(base: string, tier: number, hueIdx: number, extra: number, phase2 = false): string {
  const key = `${base}~${tier}~${hueIdx}~${extra}~${phase2 ? 1 : 0}`;
  if (BOSSES[key]) return key;
  const d = clone(BOSSES[base]);
  d.hpScale = 1 + 0.12 * tier;
  d.hue = HUES[hueIdx % HUES.length];
  d.phase2 = phase2;
  const rate = Math.max(0.7, 1 - 0.03 * tier);
  for (const p of d.parts) for (const g of p.guns ?? []) if (g.kind !== 'spiral') g.every = Math.round(g.every * rate);
  const core = d.parts.find((p) => p.core)!;
  core.guns = [...(core.guns ?? []), clone(EXTRA_GUNS[extra % EXTRA_GUNS.length])];
  d.cash = Math.round(d.cash * (1 + 0.1 * tier));
  d.score = Math.round(d.score * (1 + 0.2 * tier));
  BOSSES[key] = d;
  return key;
}

/** Assemble a new boss: hull/movement from one design, destructible parts from another, re-anchored onto the hull. */
export function remixBoss(bodyKey: string, partsKey: string, tier: number, hueIdx: number, bomb: boolean): string {
  const key = `remix~${bodyKey}~${partsKey}~${tier}~${hueIdx}~${bomb ? 1 : 0}`;
  if (!BOSSES[key]) BOSSES[key] = buildRemix(bodyKey, partsKey, tier, bomb);
  // then apply the usual later-level modifiers on top
  return bossVariant(key, tier, hueIdx, tier % EXTRA_GUNS.length);
}

function buildRemix(bodyKey: string, partsKey: string, tier: number, bomb: boolean): BossDef {
  const A = BOSSES[bodyKey], B = BOSSES[partsKey];
  const sx = A.bodyHit[2] / B.bodyHit[2], sy = A.bodyHit[3] / B.bodyHit[3];
  const [, hy, , hh] = A.bodyHit;
  const parts = clone(B.parts).map((p) => ({
    ...p,
    // scale positions onto the new hull, keep them within reach of the ship and on the hull
    x: Math.max(-150, Math.min(150, Math.round(p.x * Math.min(1.4, sx)))),
    y: Math.max(hy + 6, Math.min(hy + hh + 10, Math.round(p.y * Math.min(1.3, sy)))),
  }));
  const firstWord = (s: string) => s.split(' ')[0];
  const d: BossDef = {
    ...clone(A), name: `${firstWord(A.name)}-${firstWord(B.name)}`, parts, bomb,
    cash: Math.max(A.cash, B.cash), score: Math.max(A.score, B.score),
    move: tier % 2 ? A.move : B.move === 'track' ? 'sway' : B.move,
  };
  if (d.move === 'track') d.move = 'sway';
  return d;
}

// ---------- helpers ----------
function mirrorShape(s: Shape): Shape {
  const c: any = { ...s };
  if ('x' in c) c.x = -c.x;
  if (c.t === 'poly') c.p = c.p.map((v: number, i: number) => (i % 2 ? v : -v));
  if (c.t === 'line') { c.x0 = -c.x0; c.x1 = -c.x1; }
  if (c.t === 'eye' && c.lx) c.lx = -c.lx;
  return c;
}
function mirrorPart(p: PartDef, id: string, extra: Partial<PartDef> = {}): PartDef {
  return { ...p, id, x: -p.x, shapes: p.shapes.map(mirrorShape), ...extra, guns: (extra.guns ?? p.guns)?.map((g) => ({ ...g, offset: (g.offset ?? 0) + Math.round(g.every / 2) })) };
}

export const BOSSES: Record<string, BossDef> = {};

function defineBosses() {
  // ===== Level 1 end: CARCINOX, the armoured crustacean =====
  const clawL: PartDef = {
    id: 'clawL', x: -92, y: 40, w: 40, h: 36, hp: 45, pad: 20,
    shapes: [
      // jointed forearm, armoured palm, serrated pincers
      { t: 'ell', x: 10, y: -16, rx: 8, ry: 7, r: 'red', z: -2 },
      { t: 'ell', x: 7, y: -12, rx: 4, ry: 4, r: 'dark', z: -1 },
      { t: 'poly', p: [-12, 2, -19, 26, -13, 31, -4, 9], r: 'red', l: 0.85 },
      { t: 'poly', p: [9, 3, 14, 24, 8, 28, 2, 9], r: 'red', l: 0.6 },
      ...[8, 14, 20].map((y) => ({ t: 'poly', p: [-6 - y * 0.3, y, -2 - y * 0.3, y + 2, -7 - y * 0.3, y + 4], r: 'bone', l: 0.9, z: 2 } as Shape)),
      ...[10, 16].map((y) => ({ t: 'poly', p: [3 + y * 0.2, y, 0 + y * 0.2, y + 2, 4 + y * 0.2, y + 4], r: 'bone', l: 0.9, z: 2 } as Shape)),
      { t: 'ell', x: 0, y: -4, rx: 17, ry: 13, r: 'red' },
      { t: 'ell', x: -4, y: -8, rx: 9, ry: 5, r: 'orange', z: 8, bias: 0.05 },
      { t: 'ell', x: -9, y: -2, rx: 2.4, ry: 2.4, r: 'orange', z: 14, spec: true },
      { t: 'ell', x: -2, y: 2, rx: 2, ry: 2, r: 'orange', z: 14, spec: true },
      { t: 'ell', x: 6, y: -6, rx: 2, ry: 2, r: 'orange', z: 14, spec: true },
    ],
    guns: [{ kind: 'spread', every: 100, n: 5, arc: 0.9, speed: 1.6 }],
  };
  const plateL: PartDef = { id: 'plateL', x: -42, y: -8, w: 30, h: 24, hp: 26, shapes: [{ t: 'ell', x: 0, y: 0, rx: 15, ry: 12, r: 'gold' }, { t: 'ribs', x: 0, y: 0, w: 22, h: 16, n: 3, r: 'gold' }], guns: [{ kind: 'aim', every: 130, speed: 1.8 }] };
  BOSSES.carcinox = {
    name: 'CARCINOX', w: 230, h: 130, sym: true, bodyHit: [-70, -42, 140, 82], move: 'sway', amp: 45, ty: 70, cash: 1500, score: 20000, bomb: true,
    body: [
      { t: 'poly', p: [-60, 10, -108, -32, -102, -36, -55, 0], r: 'shell', l: 0.6 },
      { t: 'poly', p: [-55, 22, -112, 8, -110, 2, -50, 12], r: 'shell', l: 0.5 },
      { t: 'poly', p: [-50, 32, -100, 52, -104, 46, -45, 24], r: 'shell', l: 0.45 },
      { t: 'ell', x: 0, y: 0, rx: 75, ry: 46, r: 'shell' },
      { t: 'tex', x: 0, y: -6, rx: 62, ry: 34, r: 'shell', seed: 3, z: 10 },
      { t: 'cyl', x: -16, y: -48, w: 5, h: 18, r: 'shell', z: 5 },
      { t: 'eye', x: -16, y: -56, rad: 4, ly: 0.6, z: 30 },
      { t: 'ell', x: 0, y: 36, rx: 26, ry: 13, r: 'flesh', z: 30 },
    ],
    parts: [
      clawL, mirrorPart(clawL, 'clawR'),
      plateL, mirrorPart(plateL, 'plateR'),
      { id: 'plateC', x: 0, y: -18, w: 34, h: 26, hp: 32, shapes: [{ t: 'ell', x: 0, y: 0, rx: 17, ry: 13, r: 'gold' }, { t: 'ribs', x: 0, y: 0, w: 26, h: 18, n: 3, r: 'gold' }], guns: [{ kind: 'ring', every: 190, n: 8, speed: 1.3 }] },
      { id: 'mouth', x: 0, y: 40, w: 32, h: 14, hp: 30, shapes: [{ t: 'ell', x: 0, y: 0, rx: 16, ry: 7, r: 'red' }, { t: 'poly', p: [-10, -3, -8, 5, -6, -3], r: 'bone', z: 9 }, { t: 'poly', p: [6, -3, 8, 5, 10, -3], r: 'bone', z: 9 }], guns: [{ kind: 'spawn', every: 170, enemy: 'tadpole', pat: 'sine' }] },
      { id: 'core', x: 0, y: 12, w: 22, h: 22, hp: 70, core: true, anim: 'eye', requires: ['plateL', 'plateR', 'plateC'], shapes: [{ t: 'ell', x: 0, y: 0, rx: 12, ry: 12, r: 'flesh' }, { t: 'eye', x: 0, y: 0, rad: 9 }], guns: [{ kind: 'aim3', every: 65, speed: 2 }, { kind: 'ring', every: 150, n: 12, speed: 1.4 }] },
    ],
  };

  // ===== Level 2 mid: OSSUAR, the fossil skull =====
  const eyeL: PartDef = { id: 'eyeL', x: -28, y: -6, w: 22, h: 20, hp: 32, anim: 'eye', shapes: [{ t: 'ell', x: 0, y: 0, rx: 12, ry: 10, r: 'dark', bias: 0.2 }, { t: 'eye', x: 0, y: 0, rad: 6.5, iris: 'slime' }], guns: [{ kind: 'aim', every: 70, speed: 2.2, bullet: 'eNeedle' }] };
  BOSSES.ossuar = {
    name: 'OSSUAR', w: 190, h: 140, sym: true, bodyHit: [-65, -55, 130, 100], move: 'charge', amp: 40, ty: 72, cash: 1000, score: 10000, bomb: false,
    body: [
      { t: 'poly', p: [-48, -40, -90, -84, -80, -86, -36, -52], r: 'bone', l: 0.8 },
      { t: 'ell', x: 0, y: -10, rx: 70, ry: 55, r: 'bone' },
      { t: 'tex', x: 0, y: -16, rx: 60, ry: 42, r: 'bone', seed: 5, z: 10 },
      { t: 'ell', x: 0, y: 38, rx: 45, ry: 18, r: 'bone', z: 5 },
      { t: 'ell', x: 0, y: 18, rx: 6, ry: 8, r: 'dark', z: 40, bias: -0.3 },
    ],
    parts: [
      eyeL, mirrorPart(eyeL, 'eyeR'),
      { id: 'jaw', x: 0, y: 48, w: 62, h: 18, hp: 40, shapes: [{ t: 'box', x: 0, y: 0, w: 60, h: 14, r: 'bone', bevel: 2 }, ...[-24, -12, 0, 12, 24].map((x) => ({ t: 'poly', p: [x - 4, 5, x, 13, x + 4, 5], r: 'bone', z: 5 } as Shape))], guns: [{ kind: 'spread', every: 110, n: 7, arc: 1.2, speed: 1.7 }] },
      { id: 'brain', x: 0, y: -44, w: 46, h: 26, hp: 60, core: true, anim: 'pulse', requires: ['eyeL', 'eyeR', 'jaw'], shapes: [{ t: 'tex', x: 0, y: 0, rx: 23, ry: 13, r: 'flesh', seed: 2 }], guns: [{ kind: 'ring', every: 100, n: 10, speed: 1.5 }, { kind: 'spawn', every: 200, enemy: 'skullfish', pat: 'swoop' }] },
    ],
  };

  // ===== Level 2 end: MOTHER SPORE =====
  const sacPos = [[-70, 0], [70, 0], [-40, -34], [40, -34], [-40, 34], [40, 34]];
  BOSSES.mothersp = {
    name: 'MOTHER SPORE', w: 240, h: 160, bodyHit: [-95, -58, 190, 116], move: 'figure8', amp: 45, ty: 78, cash: 2000, score: 30000, bomb: true,
    body: [
      { t: 'spikes', x: 0, y: 0, rad: 90, n: 14, len: 14, r: 'bone' },
      { t: 'ell', x: 0, y: 0, rx: 100, ry: 62, r: 'slime' },
      { t: 'tex', x: 0, y: 0, rx: 92, ry: 56, r: 'slime', seed: 8, z: 10 },
    ],
    parts: [
      ...sacPos.map(([x, y], i) => ({
        id: 'sac' + i, x, y, w: 22, h: 22, hp: 22, anim: 'pulse' as const,
        shapes: [{ t: 'ell', x: 0, y: 0, rx: 11, ry: 11, r: 'yellow' }, { t: 'ell', x: 0, y: 0, rx: 5, ry: 5, r: 'red', z: 10 }] as Shape[],
        guns: [{ kind: 'spawn', every: 190, enemy: 'spore', pat: 'chase', offset: i * 30 }, { kind: 'aim', every: 150, speed: 1.6, bullet: 'eSpore', offset: i * 25 }] as GunDef[],
      })),
      { id: 'core', x: 0, y: 0, w: 34, h: 34, hp: 90, core: true, anim: 'eye', requires: sacPos.map((_, i) => 'sac' + i), shapes: [{ t: 'ell', x: 0, y: 0, rx: 17, ry: 17, r: 'purple' }, { t: 'eye', x: 0, y: 0, rad: 10, iris: 'slime' }], guns: [{ kind: 'spiral', every: 6, n: 3, speed: 1.5 }, { kind: 'aim3', every: 80, speed: 2 }] },
    ],
  };

  // ===== Level 3 mid: LARVA QUEEN =====
  const wingL: PartDef = { id: 'wingL', x: -58, y: -14, w: 56, h: 66, hp: 36, under: true, shapes: [{ t: 'ell', x: 0, y: 0, rx: 28, ry: 34, r: 'cyan', bias: 0.25 }, ...[[-15, 20], [-22, -5], [-6, 30], [-26, 10], [-10, -28]].map(([x1, y1]) => ({ t: 'line', x0: 20, y0: -20, x1, y1, c: '#225566' } as Shape)), ...[[-4, 4, -14, 12], [6, -6, -10, -12], [-8, 18, -20, 22], [0, 14, 4, 26]].map(([x0, y0, x1, y1]) => ({ t: 'line', x0, y0, x1, y1, c: '#3a7a8a' } as Shape)), { t: 'ell', x: -12, y: 10, rx: 2.5, ry: 2.5, r: 'slime', z: 4, spec: true }], guns: [{ kind: 'spread', every: 90, n: 3, arc: 0.5, speed: 1.8 }] };
  BOSSES.larva = {
    name: 'LARVA QUEEN', w: 190, h: 150, sym: true, bodyHit: [-30, -62, 60, 104], move: 'track', amp: 0, ty: 72, cash: 1200, score: 12000, bomb: false,
    body: [
      { t: 'ell', x: 0, y: -22, rx: 30, ry: 42, r: 'yellow' },
      { t: 'ribs', x: 0, y: -22, w: 52, h: 66, n: 6, r: 'dark' },
      { t: 'ell', x: 0, y: 18, rx: 24, ry: 20, r: 'green', z: 30 },
      { t: 'eye', x: -10, y: 26, rad: 5, z: 50 },
      { t: 'poly', p: [-14, 30, -26, 52, -20, 54, -8, 36], r: 'green', z: 40 },
    ],
    parts: [
      wingL, mirrorPart(wingL, 'wingR'),
      { id: 'stinger', x: 0, y: 52, w: 18, h: 24, hp: 36, shapes: [{ t: 'poly', p: [-8, -10, 0, 14, 8, -10], r: 'yellow', l: 0.8 }, { t: 'ell', x: 0, y: -8, rx: 7, ry: 4, r: 'dark', z: 5, bias: 0.2 }], guns: [{ kind: 'beam', every: 230, offset: 60 }] },
      { id: 'brood', x: 0, y: -30, w: 32, h: 40, hp: 55, core: true, anim: 'pulse', requires: ['wingL', 'wingR', 'stinger'], shapes: [{ t: 'ell', x: 0, y: 0, rx: 16, ry: 20, r: 'flesh' }, { t: 'ell', x: 0, y: 0, rx: 8, ry: 10, r: 'yellow', z: 10, spec: true }], guns: [{ kind: 'aim3', every: 60, speed: 2 }, { kind: 'spawn', every: 120, enemy: 'wasp', pat: 'swoop' }] },
    ],
  };

  // ===== Level 3 end: VINEMAW =====
  const vine = (id: string, x: number, y: number, off: number): PartDef => ({ id, x, y, w: 16, h: 32, hp: 25, shapes: [{ t: 'cyl', x: 0, y: -2, w: 10, h: 28, r: 'green' }, { t: 'ell', x: 0, y: 12, rx: 7, ry: 7, r: 'purple', z: 10 }], guns: [{ kind: 'aim', every: 85, speed: 1.8, bullet: 'eSpore', offset: off }] });
  const petalL: PartDef = { id: 'petalL', x: -42, y: 22, w: 34, h: 30, hp: 42, shapes: [{ t: 'ell', x: 0, y: 0, rx: 17, ry: 15, r: 'red' }, { t: 'ell', x: 0, y: 0, rx: 8, ry: 7, r: 'yellow', z: 10 }], guns: [{ kind: 'spread', every: 110, n: 5, arc: 0.9, speed: 1.6 }] };
  BOSSES.vinemaw = {
    name: 'VINEMAW', w: 290, h: 150, sym: true, bodyHit: [-80, -55, 160, 98], move: 'sway', amp: 30, ty: 72, cash: 2500, score: 40000, bomb: true,
    body: [
      { t: 'poly', p: [-60, 0, -140, -34, -126, 12], r: 'green', l: 0.7 },
      { t: 'poly', p: [-50, -30, -110, -64, -112, -40], r: 'green', l: 0.6 },
      { t: 'ell', x: 0, y: -10, rx: 82, ry: 52, r: 'green' },
      { t: 'tex', x: 0, y: -12, rx: 76, ry: 44, r: 'green', seed: 4, z: 10 },
      { t: 'ell', x: 0, y: 34, rx: 52, ry: 16, r: 'purple', z: 20 },
    ],
    parts: [
      vine('vine1', -118, 40, 0), vine('vine2', -68, 56, 20), vine('vine3', 68, 56, 40), vine('vine4', 118, 40, 60),
      petalL, mirrorPart(petalL, 'petalR'),
      { id: 'maw', x: 0, y: 30, w: 34, h: 24, hp: 110, core: true, anim: 'eye', requires: ['petalL', 'petalR'], shapes: [{ t: 'ell', x: 0, y: 0, rx: 17, ry: 12, r: 'dark', bias: 0.1 }, { t: 'spikes', x: 0, y: 0, rad: 10, n: 10, len: 4, r: 'bone' }, { t: 'eye', x: 0, y: 0, rad: 7 }], guns: [{ kind: 'spiral', every: 7, n: 4, speed: 1.3 }, { kind: 'spawn', every: 150, enemy: 'wasp', pat: 'swoop' }] },
    ],
  };

  // ===== Level 4 mid: PIPE HEART =====
  const pipeGun = (id: string, x: number, y: number, off: number): PartDef => ({ id, x, y, w: 18, h: 18, hp: 26, shapes: [{ t: 'box', x: 0, y: 0, w: 16, h: 16, r: 'steel', bevel: 2 }, { t: 'cyl', x: 0, y: 7, w: 4, h: 10, r: 'gold', z: 5 }], guns: [{ kind: 'aim', every: 70, speed: 2.2, bullet: 'ePlasma', offset: off }] });
  const valveL: PartDef = { id: 'valveL', x: -45, y: 42, w: 20, h: 20, hp: 30, shapes: [{ t: 'ell', x: 0, y: 0, rx: 10, ry: 10, r: 'gold' }, { t: 'box', x: 0, y: 0, w: 14, h: 4, r: 'steel', bevel: 1, z: 12 }], guns: [{ kind: 'beam', every: 200 }] };
  BOSSES.pipeheart = {
    name: 'PIPE HEART', w: 200, h: 150, bodyHit: [-60, -52, 120, 104], move: 'track', amp: 0, ty: 68, cash: 1500, score: 15000, bomb: false,
    body: [
      { t: 'cyl', x: 0, y: -30, w: 190, h: 10, r: 'steel', vert: false },
      { t: 'cyl', x: 0, y: 25, w: 160, h: 8, r: 'steel', vert: false },
      { t: 'ell', x: -16, y: 0, rx: 44, ry: 50, r: 'flesh', z: 10 },
      { t: 'ell', x: 16, y: 0, rx: 44, ry: 50, r: 'flesh', z: 10 },
      { t: 'tex', x: 0, y: 0, rx: 50, ry: 44, r: 'flesh', seed: 6, z: 30 },
    ],
    parts: [
      pipeGun('pipe1', -88, -30, 0), pipeGun('pipe2', 88, -30, 35), pipeGun('pipe3', 0, -58, 18),
      valveL, mirrorPart(valveL, 'valveR'),
      { id: 'heart', x: 0, y: 2, w: 40, h: 40, hp: 80, core: true, anim: 'pulse', requires: ['pipe1', 'pipe2', 'pipe3'], shapes: [{ t: 'tex', x: 0, y: 0, rx: 20, ry: 20, r: 'red', seed: 3 }, { t: 'ell', x: 0, y: 0, rx: 8, ry: 8, r: 'eye', z: 30, spec: true }], guns: [{ kind: 'ring', every: 90, n: 12, speed: 1.6, bullet: 'ePlasma' }] },
    ],
  };

  // ===== Level 4 end: FLESHFORGE =====
  const turret = (id: string, x: number, every: number, kind: 'aim' | 'aim3', off: number): PartDef => ({ id, x, y: 42, w: 22, h: 22, hp: 30, shapes: [{ t: 'box', x: 0, y: 0, w: 20, h: 20, r: 'steel', bevel: 2 }, { t: 'ell', x: 0, y: 0, rx: 7, ry: 7, r: 'flesh', z: 6 }, { t: 'cyl', x: 0, y: 9, w: 4, h: 10, r: 'gold', z: 10 }], guns: [{ kind, every, speed: 2.1, bullet: 'ePlasma', offset: off }] });
  const cannonL: PartDef = { id: 'cannonL', x: -100, y: -18, w: 30, h: 30, hp: 42, shapes: [{ t: 'ell', x: 0, y: 0, rx: 15, ry: 15, r: 'gold' }, { t: 'cyl', x: 0, y: 12, w: 8, h: 16, r: 'steel', z: 12 }], guns: [{ kind: 'spread', every: 120, n: 5, arc: 0.8, speed: 1.5, bullet: 'eBig' }] };
  BOSSES.fleshforge = {
    name: 'FLESHFORGE', w: 310, h: 150, sym: true, bodyHit: [-140, -55, 280, 95], move: 'sway', amp: 18, ty: 70, cash: 3000, score: 50000, bomb: true,
    body: [
      { t: 'box', x: 0, y: -10, w: 280, h: 90, r: 'steel', bevel: 4 },
      { t: 'ribs', x: 0, y: -42, w: 260, h: 20, n: 3, r: 'steel', z: 5 },
      { t: 'ell', x: -95, y: 12, rx: 40, ry: 26, r: 'flesh', z: 10 },
      { t: 'tex', x: -95, y: 12, rx: 36, ry: 22, r: 'flesh', seed: 1, z: 20 },
      { t: 'box', x: 0, y: 36, w: 200, h: 22, r: 'steel', bevel: 3, z: 20 },
    ],
    parts: [
      turret('t1', -120, 90, 'aim3', 0), turret('t2', -60, 60, 'aim', 20), turret('t3', 60, 60, 'aim', 40), turret('t4', 120, 90, 'aim3', 45),
      cannonL, mirrorPart(cannonL, 'cannonR'),
      { id: 'reactor', x: 0, y: 0, w: 40, h: 40, hp: 140, core: true, anim: 'pulse', requires: ['t1', 't2', 't3', 't4', 'cannonL', 'cannonR'], shapes: [{ t: 'ell', x: 0, y: 0, rx: 20, ry: 20, r: 'cyan', spec: true }, { t: 'ell', x: 0, y: 0, rx: 10, ry: 10, r: 'chrome', z: 20 }], guns: [{ kind: 'beam', every: 160 }, { kind: 'ring', every: 130, n: 16, speed: 1.5, bullet: 'ePlasma' }, { kind: 'spiral', every: 9, n: 2, speed: 1.4 }] },
    ],
  };

  // ===== Level 5 mid: SENTINEL =====
  const pod = (id: string, x: number, y: number, g: GunDef): PartDef => ({ id, x, y, w: 22, h: 22, hp: 28, shapes: [{ t: 'ell', x: 0, y: 0, rx: 11, ry: 11, r: 'steel' }, { t: 'ell', x: 0, y: 0, rx: 5, ry: 5, r: 'red', z: 10, spec: true }], guns: [g] });
  BOSSES.sentinel = {
    name: 'SENTINEL', w: 170, h: 170, bodyHit: [-48, -48, 96, 96], move: 'figure8', amp: 70, ty: 85, cash: 2000, score: 20000, bomb: false,
    body: [{ t: 'spikes', x: 0, y: 0, rad: 46, n: 12, len: 10, r: 'steel' }, { t: 'ell', x: 0, y: 0, rx: 50, ry: 50, r: 'chrome', spec: true }, { t: 'ribs', x: 0, y: 0, w: 70, h: 60, n: 4, r: 'steel', z: 30 }],
    parts: [
      pod('podN', 0, -62, { kind: 'spawn', every: 180, enemy: 'drone', pat: 'swoop' }),
      pod('podE', 62, 0, { kind: 'aim3', every: 90, speed: 2.2, bullet: 'eNeedle' }),
      pod('podS', 0, 62, { kind: 'spread', every: 80, n: 5, arc: 0.9, speed: 1.8 }),
      pod('podW', -62, 0, { kind: 'aim3', every: 90, speed: 2.2, bullet: 'eNeedle', offset: 45 }),
      { id: 'core', x: 0, y: 0, w: 30, h: 30, hp: 80, core: true, anim: 'eye', requires: ['podN', 'podE', 'podS', 'podW'], shapes: [{ t: 'eye', x: 0, y: 0, rad: 13, iris: 'cyan' }], guns: [{ kind: 'spiral', every: 5, n: 4, speed: 1.6 }, { kind: 'beam', every: 240 }] },
    ],
  };

  // ===== Level 5 end: OVERMIND ENGINE (wider than the screen) =====
  const g = (id: string, x: number, i: number): PartDef => ({ id, x, y: 38, w: 18, h: 18, hp: 25, shapes: [{ t: 'box', x: 0, y: 0, w: 16, h: 16, r: 'steel', bevel: 2 }, { t: 'cyl', x: 0, y: 8, w: 4, h: 10, r: 'red', z: 10 }], guns: [{ kind: i % 2 ? 'aim3' : 'aim', every: i % 2 ? 100 : 70, speed: 2.2, bullet: 'eNeedle', offset: i * 15 }] });
  const emL: PartDef = { id: 'emL', x: -82, y: 2, w: 24, h: 24, hp: 42, shapes: [{ t: 'ell', x: 0, y: 0, rx: 12, ry: 12, r: 'cyan', spec: true }, { t: 'spikes', x: 0, y: 0, rad: 11, n: 6, len: 3, r: 'steel' }], guns: [{ kind: 'beam', every: 170 }] };
  const shL: PartDef = { id: 'shL', x: -28, y: 18, w: 24, h: 34, hp: 50, shapes: [{ t: 'box', x: 0, y: 0, w: 22, h: 32, r: 'blue', bevel: 3 }, { t: 'ribs', x: 0, y: 0, w: 16, h: 24, n: 3, r: 'steel' }] };
  BOSSES.overmind = {
    name: 'OVERMIND ENGINE', w: 390, h: 170, sym: true, bodyHit: [-185, -62, 370, 92], move: 'sway', amp: 34, ty: 74, cash: 5000, score: 100000, bomb: true,
    body: [
      { t: 'poly', p: [-150, -40, -195, -75, -190, 20, -150, 30], r: 'steel', l: 0.6 },
      { t: 'box', x: 0, y: -18, w: 370, h: 90, r: 'steel', bevel: 4 },
      { t: 'box', x: 0, y: -20, w: 330, h: 58, r: 'chrome', bevel: 2, z: 5 },
      { t: 'ribs', x: -120, y: -20, w: 70, h: 50, n: 5, r: 'steel', z: 10 },
      { t: 'box', x: 0, y: -50, w: 80, h: 18, r: 'blue', bevel: 2, z: 12 },
    ],
    parts: [
      g('g1', -160, 0), g('g2', -112, 1), g('g3', -64, 2), g('g4', 64, 3), g('g5', 112, 4), g('g6', 160, 5),
      emL, mirrorPart(emL, 'emR'), shL, mirrorPart(shL, 'shR'),
      { id: 'core', x: 0, y: 10, w: 30, h: 30, hp: 180, core: true, anim: 'eye', requires: ['emL', 'emR', 'shL', 'shR'], shapes: [{ t: 'ell', x: 0, y: 0, rx: 15, ry: 15, r: 'steel' }, { t: 'eye', x: 0, y: 0, rad: 12, iris: 'cyan' }], guns: [{ kind: 'spiral', every: 6, n: 3, speed: 1.5 }, { kind: 'ring', every: 120, n: 18, speed: 1.4, bullet: 'ePlasma' }, { kind: 'spawn', every: 200, enemy: 'drone', pat: 'swoop' }] },
    ],
  };
}

// ---------- surface detail ----------
// Hand-placed greebles layered over each base boss body: ridges, spikes, veins, rivets, vents and lamps. Symmetric
// bosses are mirrored after rendering, so their detail only needs placing on the left half (x <= 0).
const Z = 60; // above every body dome
const stud = (x: number, y: number, r: number, ramp: RampName, z = Z): Shape => ({ t: 'ell', x, y, rx: r, ry: r, r: ramp, z, spec: true });
const lamp = (x: number, y: number, r: number, ramp: 'eye' | 'cyan' | 'red' | 'yellow' | 'slime' = 'eye', z = Z + 4): Shape => ({ t: 'ell', x, y, rx: r, ry: r * 0.9, r: ramp, z, spec: true, bias: 0.25, glow: true });
const crack = (pts: number[], c = '#2a2018', z = Z + 2): Shape[] => {
  const out: Shape[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) out.push({ t: 'line', x0: pts[i], y0: pts[i + 1], x1: pts[i + 2], y1: pts[i + 3], c, z });
  return out;
};
/** thorn poking outwards from a point on an ellipse rim (angle a, radians) */
const thorn = (cx: number, cy: number, rx: number, ry: number, a: number, len: number, w: number, ramp: RampName): Shape => {
  const bx = cx + Math.cos(a) * rx * 0.96, by = cy + Math.sin(a) * ry * 0.96;
  const nx = Math.cos(a), ny = Math.sin(a), px = -ny * w, py = nx * w;
  return { t: 'poly', p: [bx + px, by + py, bx + nx * len, by + ny * len, bx - px, by - py], r: ramp, l: 0.75, z: -3 };
};
const rivetRow = (x0: number, x1: number, y: number, step: number, ramp: RampName = 'steel', z = Z): Shape[] => {
  const out: Shape[] = [];
  for (let x = x0; x <= x1; x += step) out.push(stud(x, y, 1.2, ramp, z));
  return out;
};
const vent = (x: number, y: number, w: number, h: number, glow: 'eye' | 'cyan' | 'red' = 'eye', z = Z): Shape[] => [
  { t: 'box', x, y, w, h, r: 'dark', bevel: 1, z },
  ...Array.from({ length: Math.max(1, Math.floor(w / 4)) }, (_, i) => ({ t: 'box', x: x - w / 2 + 2 + i * 4, y, w: 2, h: h - 2, r: glow, bevel: 0, z: z + 1 } as Shape)),
];

// ---- procedural armour / anatomy helpers ----
/** overlapping shingled plates covering an ellipse (lower rows overlap upper ones, like a carapace or scales) */
const scales = (cx: number, cy: number, rx: number, ry: number, rows: number, ramp: RampName, z = Z, size = 1, seed = 1, aspect = 1, jitter = 0.15): Shape[] => {
  const out: Shape[] = [], rng = new RNG(seed);
  for (let j = 0; j < rows; j++) {
    const v = -1 + (2 * (j + 0.5)) / rows, half = Math.sqrt(Math.max(0, 1 - v * v)) * rx;
    const pr = (ry / rows) * 1.25 * size;
    const n = Math.max(1, Math.round((half * 2) / (pr * 1.7)));
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : -1 + (2 * i) / (n - 1);
      const x = cx + u * (half - pr * 0.6) + (j % 2 ? pr * 0.4 : 0), y = cy + v * ry * 0.9;
      const k = 1 + rng.range(-jitter, jitter);
      out.push({ t: 'ell', x: x + rng.range(-jitter, jitter) * pr, y: y + rng.range(-jitter, jitter) * pr, rx: pr * 1.05 * aspect * k, ry: (pr * 0.85 / aspect) * k, r: ramp, z: z + j * 2, bias: rng.range(-0.08, 0.06) });
    }
  }
  return out;
};
/** segmented limb / tentacle: a chain of shrinking joints from (x, y) along angle a */
const limb = (x: number, y: number, a: number, len: number, segs: number, r0: number, ramp: RampName, z = -2, curl = 0.18): Shape[] => {
  const out: Shape[] = [];
  let px = x, py = y, ang = a;
  for (let i = 0; i < segs; i++) {
    const k = 1 - i / segs, r = Math.max(1.2, r0 * (0.45 + 0.55 * k));
    out.push({ t: 'ell', x: px, y: py, rx: r, ry: r, r: ramp, z: z - i * 0.1 });
    if (i % 2 === 1) out.push({ t: 'ell', x: px, y: py, rx: r * 0.55, ry: r * 0.55, r: 'dark', z: z + 0.5 });
    px += Math.cos(ang) * (len / segs); py += Math.sin(ang) * (len / segs);
    ang += curl;
  }
  out.push({ t: 'poly', p: [px - 1.5, py, px + Math.cos(ang) * 6, py + Math.sin(ang) * 6, px + 1.5, py], r: ramp, l: 0.8, z });
  return out;
};
/** grid of bevelled armour panels with dark seams */
const panels = (x: number, y: number, w: number, h: number, cols: number, rows: number, ramp: RampName, z = Z, seed = 2): Shape[] => {
  const out: Shape[] = [], rng = new RNG(seed);
  const cw = w / cols, ch = h / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (rng.next() < 0.12) continue; // a few missing panels expose the dark frame
    const wide = rng.next() < 0.2 && i < cols - 1 ? 2 : 1;
    out.push({ t: 'box', x: x - w / 2 + (i + wide / 2) * cw, y: y - h / 2 + (j + 0.5) * ch, w: cw * wide - 1.5, h: ch - 1.5, r: ramp, bevel: 1.5, z, bias: rng.range(-0.08, 0.06) });
    if (rng.next() < 0.3) out.push(stud(x - w / 2 + i * cw + 2, y - h / 2 + j * ch + 2, 0.8, 'steel', z + 2));
    if (wide === 2) i++;
  }
  return out;
};
/** stacked body segments (insect abdomen, spine) */
const segs = (x: number, y0: number, y1: number, n: number, rx: number, ramp: RampName, z = Z): Shape[] =>
  Array.from({ length: n }, (_, i) => {
    const t = i / Math.max(1, n - 1), y = y0 + (y1 - y0) * t, w = rx * (0.65 + 0.35 * Math.sin(t * Math.PI));
    return { t: 'ell', x, y, rx: w, ry: Math.abs(y1 - y0) / n * 0.75, r: ramp, z: z + i, bias: (i % 2) * 0.06 } as Shape;
  });

const DETAIL: Record<string, () => Shape[]> = {
  carcinox: () => [
    // shingled carapace plates, a crest of knobs, rim thorns and jointed legs
    ...scales(0, -6, 60, 32, 4, 'shell', Z, 1.1, 3, 1.6, 0.18),
    ...[-44, -30, -16, -2].map((x, i) => stud(x, -34 + i * 0.5, 2.6, 'orange', Z + 12)),
    ...[3.6, 3.85, 4.1, 4.35, 4.6].map((a) => thorn(0, 0, 75, 46, a, 12, 3.5, 'shell')),
    ...limb(-62, -18, Math.PI * 1.12, 46, 6, 4.2, 'shell', -4, -0.12),
    ...limb(-66, 8, Math.PI * 1.02, 50, 6, 4.4, 'shell', -4, 0.05),
    ...limb(-60, 28, Math.PI * 0.86, 46, 6, 4.2, 'shell', -4, 0.14),
    { t: 'poly', p: [-6, 30, -24, 50, -10, 44, -2, 36], r: 'red', l: 0.8, z: Z + 14 },
    lamp(-38, 22, 2.2), lamp(-48, 18, 1.8), lamp(-28, 26, 1.6),
  ],
  ossuar: () => [
    // cheekbones, temple ridges, deep sockets, a nasal cavity, cracks, teeth, a trailing spine and ringed horns
    ...segs(0, 60, 112, 6, 9, 'bone', -6),
    { t: 'ell', x: -48, y: 14, rx: 14, ry: 9, r: 'bone', z: Z, bias: 0.05 },
    { t: 'ell', x: -56, y: -30, rx: 9, ry: 16, r: 'bone', z: Z - 2, bias: -0.04 },
    { t: 'ell', x: -28, y: -6, rx: 16, ry: 14, r: 'dark', z: Z + 2, bias: 0.12 },
    { t: 'box', x: -28, y: -24, w: 34, h: 6, r: 'bone', bevel: 2, z: Z + 4 },
    { t: 'poly', p: [0, 10, -7, 26, 0, 22], r: 'dark', l: 0.3, z: Z + 6 },
    ...crack([-8, -64, -16, -50, -12, -38, -22, -30]),
    ...crack([-50, -40, -58, -28, -52, -18]),
    ...crack([-40, 12, -48, 22, -44, 30]),
    ...[-34, -26, -18, -10, -2].map((x) => ({ t: 'box', x, y: 30, w: 6, h: 9, r: 'bone', bevel: 1, z: Z + 6 } as Shape)),
    lamp(-12, -42, 2, 'cyan', Z + 8), lamp(-4, -54, 1.6, 'cyan', Z + 8),
    ...[0.15, 0.35, 0.55, 0.75].map((k) => ({ t: 'ell', x: -48 - k * 38, y: -44 - k * 40, rx: 4 - k * 2, ry: 2, r: 'bone', z: 2, bias: -0.1 } as Shape)),
  ],
  mothersp: () => {
    const rng = new RNG(77), out: Shape[] = [];
    // dangling tentacles, a cellular membrane, veins, pustules and glowing nodes
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.15 + (i / 7) * 0.7);
      out.push(...limb(Math.cos(a) * 92, Math.sin(a) * 52, a, 34, 7, 4, i % 2 ? 'slime' : 'purple', -6, (i < 4 ? -0.1 : 0.1)));
    }
    out.push(...scales(0, 0, 84, 48, 4, 'slime', Z - 8, 1.25, 11, 1.25, 0.45));
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng.range(-0.15, 0.15);
      let x = Math.cos(a) * 20, y = Math.sin(a) * 14;
      const pts = [x, y];
      for (let k = 0; k < 4; k++) { x += Math.cos(a) * 18 + rng.range(-6, 6); y += Math.sin(a) * 11 + rng.range(-4, 4); pts.push(x, y); }
      out.push(...crack(pts, '#0c3a22', Z + 6));
    }
    for (let i = 0; i < 18; i++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(0.3, 0.9);
      const x = Math.cos(a) * 92 * d, y = Math.sin(a) * 56 * d;
      out.push(i % 4 === 0 ? lamp(x, y, rng.range(1.6, 2.6), 'slime', Z + 10) : stud(x, y, rng.range(2, 4.5), i % 2 ? 'slime' : 'yellow', Z + 8));
    }
    return out;
  },
  larva: () => [
    // segmented abdomen, three pairs of jointed legs, antennae, mandibles, spiracles and a glowing egg tip
    ...segs(0, -60, 10, 7, 30, 'yellow', Z - 10),
    ...[-56, -44, -32, -20, -8].map((y) => stud(-24, y, 1.8, 'dark', Z + 2)),
    ...limb(-20, -6, Math.PI * 0.9, 34, 5, 3, 'dark', -4, -0.25),
    ...limb(-22, -24, Math.PI * 1.0, 38, 5, 3, 'dark', -4, -0.2),
    ...limb(-20, -42, Math.PI * 1.1, 34, 5, 3, 'dark', -4, -0.15),
    { t: 'poly', p: [-4, 34, -22, 70, -18, 71, -2, 38], r: 'dark', l: 0.6, z: Z + 20 },
    stud(-21, 70, 2.2, 'yellow', Z + 21),
    { t: 'poly', p: [-6, 36, -16, 52, -8, 48, -2, 40], r: 'red', l: 0.8, z: Z + 20 },
    lamp(-10, 24, 1.6, 'cyan', Z + 22),
    lamp(0, -66, 4, 'yellow', Z + 10),
  ],
  vinemaw: () => [
    // bark plates, thorny crown, creeping tendrils, glowing blossoms and teeth round the lip
    ...scales(0, -14, 72, 40, 4, 'green', Z - 6, 1.1, 5, 0.62, 0.3),
    ...[3.5, 3.8, 4.1, 4.4, 4.7].map((a, i) => thorn(0, -10, 82, 52, a, 10 + (i % 2) * 5, 3, 'green')),
    ...limb(-76, 20, Math.PI * 0.75, 40, 7, 3, 'green', -4, 0.2),
    ...limb(-60, 36, Math.PI * 0.62, 34, 6, 2.6, 'green', -4, 0.25),
    ...crack([-110, -50, -90, -42, -70, -34], '#0c3a12'),
    ...[[-46, -28], [-24, -44], [-62, -6], [-8, -50]].flatMap(([x, y]) => [
      ...[0, 1.26, 2.51, 3.77, 5.03].map((a) => ({ t: 'ell', x: x + Math.cos(a) * 3.4, y: y + Math.sin(a) * 3.4, rx: 2.6, ry: 2.6, r: 'red', z: Z + 14 } as Shape)),
      lamp(x, y, 2, 'yellow', Z + 16),
    ]),
    ...[-44, -34, -24, -14, -4].map((x) => ({ t: 'poly', p: [x - 3, 26, x, 36, x + 3, 26], r: 'bone', l: 0.9, z: Z + 16 } as Shape)),
  ],
  pipeheart: () => [
    // armoured backplate, rivets, brass couplings, arteries, veins and glowing valves
    ...panels(0, -2, 170, 40, 10, 2, 'steel', 1, 9),
    ...rivetRow(-92, 92, -30, 9, 'steel', 14),
    ...rivetRow(-78, 78, 25, 9, 'steel', 14),
    ...[-70, -40, 40, 70].map((x) => ({ t: 'box', x, y: -30, w: 5, h: 14, r: 'gold', bevel: 1, z: 16 } as Shape)),
    ...[-60, 60].map((x) => ({ t: 'box', x, y: 25, w: 5, h: 12, r: 'gold', bevel: 1, z: 16 } as Shape)),
    { t: 'cyl', x: -62, y: -48, w: 8, h: 30, r: 'steel', z: 12 }, { t: 'cyl', x: 62, y: -48, w: 8, h: 30, r: 'steel', z: 12 },
    ...crack([-30, -14, -44, -26, -58, -30], '#5a0a14', Z), ...crack([30, -14, 44, -26, 58, -30], '#5a0a14', Z),
    ...crack([-20, 30, -38, 22, -50, 25], '#5a0a14', Z),
    ...crack([-40, -10, -50, 6, -44, 20], '#7a1a24', Z), ...crack([40, -10, 50, 6, 44, 20], '#7a1a24', Z),
    lamp(-82, -30, 2, 'cyan', 18), lamp(82, -30, 2, 'cyan', 18), lamp(-20, 25, 1.8, 'cyan', 18), lamp(20, 25, 1.8, 'cyan', 18),
  ],
  fleshforge: () => [
    // plated hull, rivet rows, glowing vents, a brass pipe, hazard chevrons, flesh pods and warning lamps
    ...panels(-70, -14, 140, 62, 7, 3, 'steel', 8, 4),
    ...rivetRow(-134, -6, -52, 10, 'steel', 30),
    ...rivetRow(-134, -6, 31, 10, 'steel', 30),
    ...vent(-40, -26, 26, 8, 'eye', 32), ...vent(-136, 0, 12, 18, 'eye', 32),
    { t: 'cyl', x: -80, y: -30, w: 100, h: 4, r: 'gold', vert: false, z: 34 },
    ...[-92, -78, -64, -50, -36, -22, -8].map((x, i) => ({ t: 'poly', p: [x, 42, x + 6, 42, x + 2, 50, x - 4, 50], r: i % 2 ? 'dark' : 'yellow', l: 0.85, z: 34 } as Shape)),
    ...scales(-95, 12, 34, 20, 3, 'flesh', 24, 1.1, 7, 1.2, 0.4),
    lamp(-132, -48, 2.2, 'red', 36), lamp(-60, -48, 1.8, 'red', 36),
  ],
  sentinel: () => [
    // radial armour petals, a ring of running lights and an equatorial band
    ...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return { t: 'poly', p: [Math.cos(a - 0.2) * 30, Math.sin(a - 0.2) * 30, Math.cos(a) * 49, Math.sin(a) * 49, Math.cos(a + 0.2) * 30, Math.sin(a + 0.2) * 30], r: i % 2 ? 'steel' : 'chrome', l: 0.75, z: Z } as Shape; }),
    ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return { t: 'box', x: Math.cos(a) * 38, y: Math.sin(a) * 38, w: 8, h: 8, r: 'steel', bevel: 2, z: Z + 4 } as Shape; }),
    ...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return lamp(Math.cos(a) * 26, Math.sin(a) * 26, 1.6, 'cyan', Z + 6); }),
  ],
  overmind: () => [
    // plated superstructure, light strips, glowing vents, rivets, antenna towers and exhaust ports
    ...panels(-95, -18, 180, 56, 9, 3, 'steel', 8, 6),
    { t: 'box', x: -100, y: -44, w: 120, h: 2, r: 'cyan', bevel: 0, z: 20 },
    { t: 'box', x: -100, y: 4, w: 120, h: 2, r: 'cyan', bevel: 0, z: 20 },
    ...vent(-60, -30, 22, 8, 'eye', 18), ...vent(-150, -16, 14, 20, 'cyan', 18),
    ...rivetRow(-180, -10, -60, 10, 'steel', 22),
    ...rivetRow(-180, -10, 24, 10, 'steel', 22),
    { t: 'poly', p: [-104, -62, -100, -84, -96, -62], r: 'steel', l: 0.8, z: 6 }, lamp(-100, -85, 2, 'red', 8),
    { t: 'poly', p: [-144, -62, -141, -78, -138, -62], r: 'steel', l: 0.8, z: 6 }, lamp(-141, -79, 1.6, 'red', 8),
    { t: 'ell', x: -140, y: 27, rx: 7, ry: 4, r: 'dark', z: 22 }, lamp(-140, 27, 3.5, 'eye', 23),
    { t: 'ell', x: -100, y: 27, rx: 7, ry: 4, r: 'dark', z: 22 }, lamp(-100, 27, 3.5, 'eye', 23),
  ],
};

// ---------- runtime ----------
interface PartRT {
  def: PartDef; hp: number; max: number; dead: boolean; flash: number;
  spr: Spr[]; crack: Spr; char: Spr; pad: number; gunT: number[]; beam: number; spiralA: number;
}
const SPR_CACHE = new Map<string, { body: Spr; parts: Map<string, { spr: Spr[]; crack: Spr; char: Spr }> }>();

export function buildBossArt() {
  defineBosses();
  for (const [k, f] of Object.entries(DETAIL)) if (BOSSES[k]) BOSSES[k].body.push(...f());
  // room for limbs, spines and towers that reach past the original canvas (art stays centred)
  for (const [k, g] of Object.entries({ ossuar: 90, mothersp: 44, overmind: 24, larva: 10 })) if (BOSSES[k]) BOSSES[k].h += g;
  for (const key of Object.keys(BOSSES)) ensureBossArt(key);
}

/** Render (once) the art for a boss key, applying its palette swap. */
export function ensureBossArt(key: string) {
  const hit = SPR_CACHE.get(key);
  if (hit) return hit;
  const d = BOSSES[key];
  const hue = d.hue ?? 0;
  const rc = (c: Spr) => (hue ? recolor(c, hue, 1.1, 1) : c);
  const body = rc(renderShapes(d.w, d.h, d.body, d.sym, true));
  emissiveOf(body);
  const parts = new Map<string, { spr: Spr[]; crack: Spr; char: Spr }>();
  for (const p of d.parts) {
    const pad = p.pad ?? 12;
    const cw = p.w + pad * 2, ch = p.h + pad * 2;
    let spr: Spr[];
    if (p.anim === 'eye') spr = [-0.7, 0, 0.7].map((lx) => rc(renderShapes(cw, ch, p.shapes.map((s) => (s.t === 'eye' ? { ...s, lx, ly: 0.6 } : s)), false, true)));
    else spr = [rc(renderShapes(cw, ch, p.shapes, false, true))];
    for (const s of spr) emissiveOf(s);
    parts.set(p.id, { spr, crack: cracked(spr[spr.length > 1 ? 1 : 0], p.x + 7), char: charred(spr[spr.length > 1 ? 1 : 0], p.y + 3) });
  }
  const art = { body, parts };
  SPR_CACHE.set(key, art);
  return art;
}

export class Boss {
  def: BossDef; key: string;
  x = 160; y: number; ox = 160; oy: number; t = 0;
  state: 'enter' | 'fight' | 'dying' | 'dead' = 'enter';
  parts: PartRT[] = [];
  dieT = 0;
  phase2Done = false;
  body: Spr;
  cx = 160;
  constructor(key: string, hpMul: number) {
    this.key = key;
    this.def = BOSSES[key];
    const art = ensureBossArt(key);
    this.body = art.body;
    this.y = this.oy = -this.def.h / 2 - 10;
    for (const p of this.def.parts) {
      const a = art.parts.get(p.id)!;
      const hp = Math.round(p.hp * hpMul * (this.def.hpScale ?? 1));
      this.parts.push({ def: p, hp, max: hp, dead: false, flash: 0, spr: a.spr, crack: a.crack, char: a.char, pad: p.pad ?? 12, gunT: (p.guns ?? []).map((g) => g.every * 0.6 + (g.offset ?? 0)), beam: 0, spiralA: rnd(0, 6) });
    }
  }
  part(id: string) { return this.parts.find((p) => p.def.id === id)!; }
  vulnerable(p: PartRT) { return !p.dead && (!p.def.requires || p.def.requires.every((r) => this.part(r).dead)); }
  px(p: PartRT) { return this.x + p.def.x; }
  py(p: PartRT) { return this.y + p.def.y; }
  get deadParts() { return this.parts.filter((p) => p.dead).length; }

  update(w: World) {
    this.ox = this.x; this.oy = this.y;
    this.t++;
    const d = this.def;
    for (const p of this.parts) if (p.flash > 0) p.flash--;
    if (this.state === 'enter') {
      this.y += 0.8;
      if (this.y >= d.ty) { this.y = d.ty; this.state = 'fight'; this.t = 0; }
      return;
    }
    if (this.state === 'dying') {
      this.dieT++;
      if (this.dieT % 4 === 0) {
        const [bx, by, bw, bh] = d.bodyHit;
        w.fx.explode(this.x + bx + Math.random() * bw, this.y + by + Math.random() * bh, Math.random() < 0.3 ? 2 : 1);
        if (this.dieT % 12 === 0) audio.play('expM');
      }
      this.y += 0.25;
      if (this.dieT === 150) {
        for (let i = 0; i < 6; i++) w.fx.explode(this.x + rnd(-60, 60), this.y + rnd(-30, 30), 2, false, i * 5);
        audio.play('expL');
        w.fx.shake = 14;
        w.dropCash(this.x, this.y, d.cash, 14);
        this.state = 'dead';
      }
      return;
    }
    if (this.state !== 'fight') return;
    // movement
    const t = this.t, rage = 1 + this.deadParts * 0.04;
    switch (d.move) {
      case 'sway': this.x = this.cx + Math.sin(t * 0.012 * rage) * d.amp; this.y = d.ty + Math.sin(t * 0.027) * 6; break;
      case 'figure8': this.x = this.cx + Math.sin(t * 0.011 * rage) * d.amp; this.y = d.ty + Math.sin(t * 0.022 * rage) * 18; break;
      case 'track':
        this.x += Math.max(-0.5, Math.min(0.5, (w.player.x - this.x) * 0.02));
        this.x = Math.max(this.cx - 50, Math.min(this.cx + 50, this.x));
        this.y = d.ty + Math.sin(t * 0.03) * 5;
        break;
      case 'charge': {
        const ph = t % 420;
        this.x = this.cx + Math.sin(t * 0.013) * d.amp;
        if (ph > 330) { const k = Math.sin(((ph - 330) / 90) * Math.PI); this.y = d.ty + k * 70; if (ph === 331) audio.play('warn'); }
        else this.y = d.ty + Math.sin(t * 0.03) * 5;
        break;
      }
    }
    // destroyed parts keep burning
    for (const p of this.parts) {
      if (!p.dead) continue;
      if ((this.t + p.def.x) % 4 === 0) w.fx.burn(this.px(p), this.py(p));
      if ((this.t + p.def.y) % 11 === 0) w.fx.smoke(this.px(p) + rnd(-5, 5), this.py(p) - 4);
    }
    // guns
    const rate = w.fireMul / (1 + this.deadParts * 0.05);
    for (const p of this.parts) {
      if (p.dead) continue;
      const guns = p.def.guns ?? [];
      guns.forEach((g, i) => {
        p.gunT[i]--;
        if (p.gunT[i] > 0) return;
        p.gunT[i] = g.every * (g.kind === 'spiral' ? 1 : rate);
        if (g.kind === 'spiral' && (t % 300) > 160) return; // spirals come in bursts
        this.fire(w, p, g);
      });
      if (p.beam > 0) {
        p.beam--;
        if (p.beam < 50) {
          const bx = this.px(p);
          if (Math.abs(w.player.x - bx) < 9 && w.player.y > this.py(p)) w.hurtPlayer(1.6);
          if (p.beam % 8 === 0) w.fx.spark(bx + rnd(-3, 3), rnd(this.py(p), 256));
        }
      }
    }
  }

  private fire(w: World, p: PartRT, g: GunDef) {
    const x = this.px(p), y = this.py(p) + p.def.h / 3;
    const sp = (g.speed ?? 1.8) * w.bulletMul;
    const b = g.bullet ?? 'eOrb';
    const aim = Math.atan2(w.player.y - y, w.player.x - x);
    switch (g.kind) {
      case 'aim': w.enemyShot(x, y, Math.cos(aim) * sp, Math.sin(aim) * sp, b); break;
      case 'aim3': for (const o of [-0.22, 0, 0.22]) w.enemyShot(x, y, Math.cos(aim + o) * sp, Math.sin(aim + o) * sp, b); break;
      case 'spread': {
        const n = g.n ?? 5, arc = g.arc ?? 1;
        for (let i = 0; i < n; i++) { const a = Math.PI / 2 - arc / 2 + (arc * i) / (n - 1); w.enemyShot(x, y, Math.cos(a) * sp, Math.sin(a) * sp, b); }
        break;
      }
      case 'ring': {
        const n = g.n ?? 10, o = rnd(0, 1);
        for (let i = 0; i < n; i++) { const a = o + (i / n) * Math.PI * 2; w.enemyShot(x, this.py(p), Math.cos(a) * sp, Math.sin(a) * sp, b); }
        break;
      }
      case 'spiral': {
        const n = g.n ?? 3;
        p.spiralA += 0.23;
        for (let i = 0; i < n; i++) { const a = p.spiralA + (i / n) * Math.PI * 2; w.enemyShot(x, this.py(p), Math.cos(a) * sp, Math.sin(a) * sp, b); }
        break;
      }
      case 'beam': p.beam = 90; audio.play('beam'); break;
      case 'spawn':
        if (w.enemies.list.length < 24) w.spawnEnemy(g.enemy ?? 'spore', x, y, g.pat ?? 'chase', { s: 1.2, dir: x < 160 ? 1 : -1 }, false);
        break;
    }
    if (g.kind !== 'beam' && g.kind !== 'spawn' && g.kind !== 'spiral') audio.play('ebullet');
  }

  /** Test a player shot against the boss. Returns the part hit, 'body' if absorbed by the hull, or null. */
  hitTest(x: number, y: number, hw: number, hh: number): PartRT | 'body' | null {
    if (this.state !== 'fight') return this.state === 'enter' ? null : null;
    let best: PartRT | null = null;
    for (const p of this.parts) {
      if (p.dead) continue;
      const px = this.px(p), py = this.py(p);
      if (Math.abs(x - px) < p.def.w / 2 + hw && Math.abs(y - py) < p.def.h / 2 + hh) {
        if (!best || (this.vulnerable(p) && !this.vulnerable(best))) best = p;
      }
    }
    if (best && !this.vulnerable(best)) {
      // an armoured part only blocks the shot if nothing it should reach lies behind it
      for (const p of this.parts) if (p !== best && this.vulnerable(p) && Math.abs(x - this.px(p)) < p.def.w / 2 + hw && this.py(p) < y) return null;
    }
    if (best) return best;
    const [bx, by, bw, bh] = this.def.bodyHit;
    if (x + hw > this.x + bx && x - hw < this.x + bx + bw && y + hh > this.y + by && y - hh < this.y + by + bh) {
      // let the shot travel on if a live part lies further along its path (parts sit on top of the hull)
      for (const p of this.parts) if (!p.dead && Math.abs(x - this.px(p)) < p.def.w / 2 + hw && this.py(p) < y) return null;
      return 'body';
    }
    return null;
  }

  damage(w: World, p: PartRT, dmg: number) {
    if (!this.vulnerable(p)) { if (Math.random() < 0.3) audio.play('ping'); return false; }
    p.hp -= dmg;
    p.flash = 2;
    audio.play('hit', 0.6);
    if (p.def.core && this.def.phase2 && !this.phase2Done && p.hp > 0 && p.hp < p.max / 2) {
      // second phase: rebuild two gun emplacements that aren't part of the core's shield chain
      this.phase2Done = true;
      const req = new Set(p.def.requires ?? []);
      const revive = this.parts.filter((q) => q.dead && !q.def.core && !req.has(q.def.id) && (q.def.guns?.length ?? 0) > 0).slice(0, 2);
      for (const q of revive) { q.dead = false; q.hp = q.max; q.flash = 10; w.fx.explode(this.px(q), this.py(q), 1); }
      w.say('PHASE 2', 100, 'red');
      w.onPhase2();
      audio.play('alarm');
    }
    if (p.hp <= 0) {
      p.dead = true; p.beam = 0;
      const x = this.px(p), y = this.py(p);
      w.fx.explode(x, y, 2);
      w.fx.debris(x, y, 20);
      audio.play('expM');
      w.addScore(1000);
      w.dropCash(x, y, 120, 4);
      w.onBossBreak(!!p.def.core);
      if (p.def.core) {
        this.state = 'dying';
        this.dieT = 0;
        w.eb.clear();
        audio.play('expL');
      }
      return true;
    }
    return false;
  }

  bodyRect(): [number, number, number, number] {
    const [bx, by, bw, bh] = this.def.bodyHit;
    return [this.x + bx, this.y + by, bw, bh];
  }

  draw(ctx: Ctx, a: number, w: World) {
    const x = this.ox + (this.x - this.ox) * a, y = this.oy + (this.y - this.oy) * a;
    const d = this.def;
    const shakeX = this.state === 'dying' ? rnd(-2, 2) : 0;
    const glows: [Spr, number, number, number, number][] = [];
    const drawPart = (p: PartRT) => {
      const px = snap(x + p.def.x + shakeX), py = snap(y + p.def.y);
      let s: Spr;
      if (p.dead) s = p.char;
      else if (p.spr.length > 1) {
        const dx = w.player.x - (x + p.def.x);
        s = p.spr[dx < -30 ? 0 : dx > 30 ? 2 : 1];
      } else s = p.spr[0];
      if (!p.dead && p.hp < p.max * 0.45 && p.spr.length === 1) s = p.crack;
      if (p.flash > 0 && !p.dead) s = flashOf(s);
      let sw = s.width, sh = s.height;
      if (p.def.anim === 'pulse' && !p.dead) { const k = 1 + Math.sin(this.t * 0.15) * 0.05; sw = Math.round(sw * k); sh = Math.round(sh * k); }
      // parts sit on the hull: soft contact shadow down-right
      if (!p.def.under) ctx.drawImage(shadowOf(s), px - (sw >> 1) + 2.5, py - (sh >> 1) + 3.5, sw, sh);
      ctx.drawImage(s, px - (sw >> 1), py - (sh >> 1), sw, sh);
      if (!p.dead) glows.push([s, px - (sw >> 1), py - (sh >> 1), sw, sh]);
      // vulnerable cores glint
      if (p.def.core && !p.dead && this.vulnerable(p) && this.t % 30 < 4) {
        ctx.drawImage(flashOf(s), px - (sw >> 1), py - (sh >> 1), sw, sh);
      }
      if (!p.dead && p.hp < p.max * 0.45 && this.t % 6 === 0) w.fx.smoke(px + rnd(-6, 6), py);
    };
    for (const p of this.parts) if (p.def.under) drawPart(p);
    ctx.drawImage(this.body, snap(x - d.w / 2 + shakeX), snap(y - d.h / 2));
    glows.push([this.body, snap(x - d.w / 2 + shakeX), snap(y - d.h / 2), d.w, d.h]);
    for (const p of this.parts) if (!p.def.under) drawPart(p);
    // lamps, eyes, cores and vents glow and breathe
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (this.state === 'dying' ? 0.4 : 0.55) + Math.sin(this.t * 0.09) * 0.25;
    for (const [s, gx, gy, gw, gh] of glows) {
      const e = emissiveOf(s);
      if (!e) continue;
      const kx = gw / s.width, ky = gh / s.height;
      ctx.drawImage(e.c, gx - e.pad * kx, gy - e.pad * ky, e.c.width * kx, e.c.height * ky);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // beams
    for (const p of this.parts) {
      if (p.dead || p.beam <= 0) continue;
      const bx = snap(x + p.def.x), by = snap(y + p.def.y + p.def.h / 2);
      if (p.beam >= 50) {
        if (p.beam % 4 < 2) { ctx.fillStyle = 'rgba(255,60,60,0.8)'; ctx.fillRect(bx, by, 1, 256 - by); }
      } else {
        const wdt = 6 + (p.beam % 3);
        ctx.fillStyle = 'rgba(120,220,255,0.55)'; ctx.fillRect(bx - wdt, by, wdt * 2, 256 - by);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 3, by, 6, 256 - by);
      }
    }
  }
}
