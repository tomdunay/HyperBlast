// LEVEL 1 — PRIMORDIAL SEA: coral reefs, tadpoles, shellfish and crustaceans. One end boss.
import { LB } from './builder';
import { ramp } from '../engine/gfx';
import type { LevelDef } from '../game/types';

export function level1(): LevelDef {
  const b = new LB();
  b.seg(14, 1, 1)
    .wave(6, 'tadpole', 5, 100, 'sine', { a: 30 }, 18);
  b.seg(16, 1, 1, 2, 2, 1)
    .wave(2, 'tadpole', 5, 220, 'sine', { a: 30, ph: 2 }, 18)
    .cap(8, 160)
    .wave(12, 'nautilus', 3, 80, 'dive', { stop: 60, dx: 80 }, 25);
  b.seg(18, 2, 2, 4, 3, 1)
    .wall(4, 'anemone', 'L').wall(10, 'anemone', 'R')
    .wave(6, 'jelly', 3, 160, 'sine', { a: 50, s: 0.6 }, 40)
    .wave(14, 'tadpole', 6, 110, 'swoop', { dir: 1 }, 12);
  b.cp();
  b.seg(14, 4, 3, 6, 6)
    .wall(5, 'anemone', 'L').wall(9, 'anemone', 'R')
    .wave(3, 'tadpole', 4, 160, 'down', { s: 1.3 }, 16);
  b.seg(16, 6, 6, 5, 7, 1)
    .one(4, 'trilo', 160, 'down', { s: 0.6 })
    .cap(10, 150)
    .wall(12, 'anemone', 'L');
  b.seg(12, 5, 7, 2, 2)
    .wave(4, 'jelly', 4, 70, 'sine', { a: 20, s: 0.6, dx: 55 }, 30);
  b.cp();
  b.seg(22, 1, 1, 1, 1, 2)
    .block(7, 8, 4, 3)
    .wave(2, 'tadpole', 6, 70, 'swoop', { dir: 1 }, 12)
    .wave(8, 'tadpole', 6, 250, 'swoop', { dir: -1 }, 12)
    .wave(14, 'nautilus', 4, 60, 'dive', { stop: 80, dx: 65 }, 20)
    .cap(19, 160, 'P');
  b.seg(16, 1, 1, 3, 3)
    .one(3, 'crab', 160, 'down', { s: 0.45 })
    .wall(10, 'anemone', 'L').wall(10, 'anemone', 'R');
  b.shop();
  b.cp();
  b.seg(18, 3, 3, 5, 5, 2)
    .wave(3, 'tadpole', 7, 0, 'side', { dir: 1, y: 40, s: 1.5 }, 14)
    .wave(10, 'jelly', 3, 110, 'sine', { a: 30, s: 0.7, dx: 50 }, 35)
    .wall(14, 'anemone', 'L');
  b.seg(14, 5, 5, 7, 7)
    .wave(4, 'trilo', 2, 140, 'down', { s: 0.5, dx: 40 }, 40)
    .wall(11, 'anemone', 'R');
  b.seg(16, 7, 7, 7, 7, 1)
    .wave(2, 'tadpole', 6, 160, 'sine', { a: 25, s: 1.1 }, 14)
    .cap(9, 160)
    .wave(12, 'nautilus', 2, 140, 'dive', { stop: 50, dx: 40 }, 30);
  b.cp();
  b.seg(14, 7, 7, 2, 2)
    .wave(6, 'tadpole', 7, 0, 'side', { dir: -1, y: 50, s: 1.6 }, 12)
    .one(10, 'crab', 100, 'down', { s: 0.4 }).one(12, 'crab', 220, 'down', { s: 0.4 });
  b.seg(22, 2, 2, 2, 2, 2)
    .block(4, 4, 3, 2).block(12, 13, 3, 2)
    .wall(3, 'anemone', 'L').wall(9, 'anemone', 'R').wall(15, 'anemone', 'L')
    .wave(6, 'jelly', 4, 90, 'sine', { a: 40, s: 0.6, dx: 45 }, 30)
    .wave(16, 'tadpole', 8, 60, 'swoop', { dir: 1, alt: 1, dx: 25 }, 10)
    .cap(18, 200, 'H');
  b.cp();
  b.seg(18, 2, 2, 4, 4, 1)
    .wave(3, 'nautilus', 5, 50, 'dive', { stop: 70, dx: 55 }, 18)
    .wave(10, 'trilo', 3, 100, 'down', { s: 0.5, dx: 60 }, 30)
    .wall(14, 'anemone', 'L').wall(14, 'anemone', 'R');
  b.seg(10, 4, 4, 1, 1)
    .wave(4, 'tadpole', 10, 160, 'sine', { a: 70, s: 1.0 }, 10);
  b.end('carcinox');
  return b.build(0, 'PRIMORDIAL SEA', {
    rock: ramp(['#060818', '#123040', '#1f5a55', '#3f8f6e', '#8fcf99', '#e8ffd8'], 8),
    alt: ramp(['#1a0610', '#4a1a2a', '#94394a', '#d9736a', '#ffd2bd'], 8),
    bg: ['#00101f', '#002a48', '#00101f'],
    far: ramp(['#001c30', '#002c48', '#083c5c', '#104c6a'], 4),
    wobble: 0.24, tex: 'coral', ambient: 'bubbles', ambientColor: 'rgba(170,230,255,0.55)',
  }, 'level1', 0.5);
}
