// LEVEL 3 — OVERGROWN HIVE: vines, insect swarms and pulsing egg sacs. Mid boss + end boss.
import { LB } from './builder';
import { ramp } from '../engine/gfx';
import type { LevelDef } from '../game/types';

export function level3(): LevelDef {
  const b = new LB();
  b.seg(14, 1, 1, 2, 2, 1)
    .wave(4, 'wasp', 8, 80, 'swoop', { dir: 1, s: 2 }, 8)
    .wave(10, 'wasp', 8, 240, 'swoop', { dir: -1, s: 2 }, 8);
  b.seg(18, 2, 2, 3, 3, 2)
    .wall(4, 'eggsac', 'L').wall(10, 'eggsac', 'R')
    .one(7, 'beetle', 160, 'down', { s: 0.45 })
    .cap(14, 160);
  b.cp();
  b.seg(16, 3, 3, 5, 5, 1)
    .wave(3, 'mantis', 3, 100, 'dive', { stop: 60, dx: 60 }, 25)
    .wall(8, 'vinepod', 'L').wall(12, 'vinepod', 'R');
  b.seg(14, 5, 5, 2, 2)
    .wave(3, 'wasp', 10, 0, 'side', { dir: 1, y: 40, s: 2, a: 20 }, 8)
    .wave(9, 'jelly', 3, 100, 'sine', { a: 30, s: 0.7, dx: 60 }, 30);
  b.seg(20, 2, 2, 2, 2, 2)
    .block(6, 6, 3, 3).block(6, 11, 3, 3)
    .wall(5, 'eggsac', 9 * 16 + 8)
    .wave(10, 'mantis', 4, 60, 'dive', { stop: 70, dx: 65 }, 20)
    .cap(16, 160, 'P');
  b.cp();
  b.seg(14, 2, 2, 4, 4, 1)
    .one(3, 'beetle', 110, 'down', { s: 0.4 }).one(6, 'beetle', 210, 'down', { s: 0.4 })
    .wall(10, 'vinepod', 'L').wall(10, 'vinepod', 'R');
  b.mid('larva');
  b.cp();
  b.seg(16, 2, 2, 5, 5, 2)
    .wave(2, 'wasp', 12, 160, 'chase', { s: 1.5, life: 220 }, 8)
    .wall(7, 'eggsac', 'L').wall(12, 'eggsac', 'R');
  b.seg(18, 5, 5, 7, 6, 1)
    .wall(4, 'vinepod', 'L').wall(9, 'vinepod', 'R').wall(14, 'vinepod', 'L')
    .wave(6, 'mantis', 3, 130, 'dive', { stop: 60, dx: 30 }, 25)
    .cap(12, 150);
  b.seg(14, 7, 6, 2, 2)
    .wave(4, 'wasp', 10, 0, 'side', { dir: -1, y: 50, s: 2, a: 20 }, 8)
    .one(9, 'beetle', 160, 'down', { s: 0.4 });
  b.cp();
  b.seg(22, 2, 2, 2, 2, 2)
    .block(4, 8, 4, 2).block(12, 3, 3, 3).block(12, 14, 3, 3)
    .wall(6, 'eggsac', 'L').wall(6, 'eggsac', 'R')
    .wave(10, 'jelly', 4, 80, 'sine', { a: 30, s: 0.6, dx: 55 }, 30)
    .wave(16, 'wasp', 10, 160, 'sine', { a: 90, s: 1.4 }, 8)
    .cap(18, 160, 'X');
  b.seg(16, 2, 2, 4, 4, 1)
    .wave(3, 'mantis', 5, 70, 'dive', { stop: 50, dx: 45 }, 18)
    .wall(12, 'vinepod', 'L').wall(12, 'vinepod', 'R');
  b.cp();
  b.seg(18, 4, 4, 6, 6, 2)
    .one(3, 'beetle', 120, 'down', { s: 0.4 }).one(7, 'beetle', 200, 'down', { s: 0.4 })
    .wave(12, 'wasp', 12, 160, 'swoop', { dir: 1, alt: 1, s: 2 }, 7);
  b.seg(12, 6, 6, 1, 1)
    .wall(3, 'eggsac', 'L').wall(3, 'eggsac', 'R');
  b.end('vinemaw');
  return b.build(2, 'OVERGROWN HIVE', {
    rock: ramp(['#040c04', '#123012', '#245a1c', '#4a8a2a', '#9ccc4a', '#eaffa8'], 8),
    alt: ramp(['#0c040e', '#2c1236', '#58246a', '#8a4a9c', '#c890d8'], 8),
    bg: ['#020a04', '#0a2010', '#020a04'],
    far: ramp(['#06180a', '#0c2610', '#123418', '#1a4220'], 4),
    wobble: 0.26, tex: 'vine', ambient: 'spores', ambientColor: 'rgba(220,255,120,0.5)',
  }, 'level3', 0.58);
}
