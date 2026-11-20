// LEVEL 4 — BIOMECHANICAL FORTRESS: flesh fused with pipes and plating, mechanical turrets.
import { LB } from './builder';
import { ramp } from '../engine/gfx';
import type { LevelDef } from '../game/types';

export function level4(): LevelDef {
  const b = new LB();
  b.seg(14, 2, 2, 2, 2)
    .wave(5, 'fleshpod', 4, 160, 'circle', { cy: 80, r: 50, dir: 1, dx: 0 }, 30);
  b.seg(18, 2, 2, 4, 4)
    .wall(3, 'mturret', 'L').wall(9, 'mturret', 'R')
    .one(6, 'cyclops', 160, 'down', { s: 0.4 })
    .cap(14, 160);
  b.cp();
  b.seg(16, 4, 4, 6, 6)
    .wave(3, 'skullfish', 6, 0, 'side', { dir: 1, y: 40, s: 1.8 }, 12)
    .wall(8, 'mturret', 'L').wall(12, 'mturret', 'R')
    .one(10, 'worm', 160, 'worm', { a: 40, s: 0.7 });
  b.seg(16, 6, 6, 3, 3)
    .wave(4, 'eye', 3, 90, 'hover', { y: 50, dx: 70, stay: 220 }, 25)
    .wave(10, 'fleshpod', 5, 100, 'circle', { cy: 90, r: 40, dir: -1, dx: 20 }, 25);
  b.seg(20, 3, 3, 3, 3)
    .block(5, 7, 6, 2).block(13, 3, 2, 3).block(13, 15, 2, 3)
    .wall(4, 'mturret', 7 * 16 + 8).wall(4, 'mturret', 12 * 16 + 8)
    .one(9, 'cyclops', 100, 'down', { s: 0.35 }).one(11, 'cyclops', 220, 'down', { s: 0.35 })
    .cap(17, 160, 'P');
  b.cp();
  b.seg(12, 3, 3, 2, 2)
    .wall(4, 'mturret', 'L').wall(4, 'mturret', 'R');
  b.mid('pipeheart');
  b.cp();
  b.seg(18, 2, 2, 5, 5)
    .wave(3, 'fleshpod', 6, 160, 'circle', { cy: 80, r: 60, dir: 1 }, 20)
    .wall(9, 'mturret', 'L').wall(13, 'mturret', 'R');
  b.seg(18, 5, 5, 7, 7)
    .one(3, 'worm', 140, 'worm', { a: 30, s: 0.7 }).one(9, 'worm', 180, 'worm', { a: 30, s: 0.7, f: 0.05 })
    .wall(6, 'mturret', 'L').wall(12, 'mturret', 'R')
    .cap(15, 160);
  b.seg(14, 7, 7, 2, 2)
    .wave(4, 'skullfish', 7, 0, 'side', { dir: -1, y: 50, s: 1.8 }, 10)
    .one(9, 'cyclops', 160, 'down', { s: 0.4 });
  b.cp();
  b.seg(22, 2, 2, 2, 2)
    .block(4, 5, 3, 2).block(4, 12, 3, 2).block(12, 8, 4, 3)
    .wall(6, 'mturret', 'L').wall(6, 'mturret', 'R')
    .wave(9, 'eye', 4, 60, 'hover', { y: 40, dx: 65, stay: 240 }, 20)
    .wave(16, 'fleshpod', 6, 160, 'circle', { cy: 90, r: 70, dir: -1 }, 18)
    .cap(19, 160, 'H');
  b.seg(16, 2, 2, 4, 4)
    .one(3, 'cyclops', 110, 'down', { s: 0.4 }).one(6, 'cyclops', 210, 'down', { s: 0.4 })
    .wall(12, 'mturret', 'L').wall(12, 'mturret', 'R');
  b.cp();
  b.seg(18, 4, 4, 6, 6)
    .wave(3, 'skullfish', 10, 160, 'sine', { a: 70, s: 1.3 }, 9)
    .wall(9, 'mturret', 'L').wall(13, 'mturret', 'R');
  b.seg(12, 6, 6, 1, 1)
    .wave(4, 'fleshpod', 4, 160, 'circle', { cy: 70, r: 50 }, 25);
  b.end('fleshforge');
  return b.build(3, 'BIOMECH FORTRESS', {
    rock: ramp(['#08080c', '#22222e', '#44465a', '#70748c', '#a4aac0', '#e4e8f4'], 16),
    alt: ramp(['#180408', '#4a1420', '#8a2a3a', '#c85a62', '#f4a8a0'], 16),
    bg: ['#08040a', '#1a0c14', '#08040a'],
    far: ramp(['#140a10', '#22121a', '#301a24', '#40222e'], 4),
    wobble: 0.08, tex: 'biomech', ambient: 'embers', ambientColor: 'rgba(255,140,90,0.5)',
  }, 'level4', 0.6);
}
