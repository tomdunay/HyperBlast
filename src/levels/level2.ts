// LEVEL 2 — FOSSIL CAVERNS: ribbed bone tunnels, worms and spore pods. Mid boss + end boss.
import { LB } from './builder';
import { ramp } from '../engine/gfx';
import type { LevelDef } from '../game/types';

export function level2(): LevelDef {
  const b = new LB();
  b.seg(14, 2, 2, 2, 2, 1)
    .wave(5, 'skullfish', 5, 100, 'swoop', { dir: 1 }, 14);
  b.seg(18, 2, 2, 4, 4, 1)
    .wall(4, 'sporepod', 'L').wall(8, 'sporepod', 'R')
    .wave(6, 'skullfish', 5, 220, 'swoop', { dir: -1 }, 14)
    .one(12, 'worm', 160, 'worm', { a: 60, s: 0.7 })
    .cap(15, 160);
  b.cp();
  b.seg(16, 4, 4, 6, 6, 1)
    .wall(3, 'bonespine', 'L').wall(9, 'bonespine', 'R')
    .wave(5, 'eye', 2, 120, 'hover', { y: 50, dx: 80, stay: 240 }, 30);
  b.seg(14, 6, 6, 3, 3)
    .wave(4, 'skullfish', 6, 0, 'side', { dir: 1, y: 40, s: 1.6 }, 12)
    .wall(10, 'sporepod', 'L');
  b.seg(18, 3, 3, 3, 3, 2)
    .block(6, 8, 4, 4)
    .one(3, 'worm', 100, 'worm', { a: 40, s: 0.8 })
    .one(10, 'worm', 220, 'worm', { a: 40, s: 0.8, f: 0.05 })
    .cap(14, 160, 'P');
  b.cp();
  b.seg(14, 3, 3, 2, 2)
    .wave(4, 'eye', 3, 70, 'hover', { y: 60, dx: 90, stay: 200 }, 25)
    .wall(8, 'bonespine', 'L').wall(8, 'bonespine', 'R');
  b.mid('ossuar');
  b.cp();
  b.seg(16, 2, 2, 5, 5, 1)
    .wave(3, 'skullfish', 8, 60, 'swoop', { dir: 1, alt: 1, dx: 25 }, 10)
    .wall(9, 'sporepod', 'L').wall(13, 'sporepod', 'R');
  b.seg(18, 5, 5, 6, 7, 2)
    .one(3, 'worm', 150, 'worm', { a: 30, s: 0.6 })
    .wall(8, 'bonespine', 'L').wall(12, 'bonespine', 'R')
    .cap(14, 150);
  b.seg(14, 6, 7, 2, 2)
    .wave(4, 'eye', 2, 100, 'hover', { y: 50, dx: 120, stay: 220 }, 30)
    .wave(9, 'spore', 8, 160, 'chase', { s: 0.8, dx: 0, life: 400 }, 15);
  b.cp();
  b.seg(22, 2, 2, 2, 2, 2)
    .block(5, 4, 3, 3).block(5, 13, 3, 3).block(14, 8, 4, 2)
    .wall(3, 'sporepod', 8 * 16 - 6).wall(3, 'sporepod', 12 * 16 + 6)
    .wave(8, 'skullfish', 6, 0, 'side', { dir: -1, y: 50, s: 1.6 }, 12)
    .one(12, 'worm', 160, 'worm', { a: 80, s: 0.7 })
    .cap(18, 160, 'Z');
  b.seg(16, 2, 2, 4, 4, 1)
    .wave(4, 'eye', 4, 60, 'hover', { y: 40, dx: 65, stay: 260 }, 20)
    .wall(12, 'bonespine', 'L').wall(12, 'bonespine', 'R');
  b.cp();
  b.seg(18, 4, 4, 6, 6, 1)
    .one(2, 'worm', 120, 'worm', { a: 30, s: 0.7 }).one(8, 'worm', 200, 'worm', { a: 30, s: 0.7 })
    .wave(13, 'skullfish', 8, 160, 'sine', { a: 60, s: 1.2 }, 10);
  b.seg(12, 6, 6, 1, 1)
    .wall(4, 'sporepod', 'L').wall(4, 'sporepod', 'R');
  b.end('mothersp');
  return b.build(1, 'FOSSIL CAVERNS', {
    rock: ramp(['#0e0a06', '#3a2c1e', '#6e5a40', '#a8926c', '#d8c8a4', '#fff8e4'], 8),
    alt: ramp(['#100808', '#3a2420', '#6a4a3a', '#9a7a5a', '#cab08a'], 8),
    bg: ['#0c0806', '#1e140c', '#0c0806'],
    far: ramp(['#18100a', '#261a10', '#342416', '#42301e'], 4),
    wobble: 0.2, tex: 'bone', ambient: 'dust', ambientColor: 'rgba(220,200,160,0.4)',
  }, 'level2', 0.55);
}
