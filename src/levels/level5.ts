// LEVEL 5 — METALLIC SPACEWAYS: chrome corridors, robot drones and laser gates.
import { LB } from './builder';
import { ramp } from '../engine/gfx';
import type { LevelDef } from '../game/types';

export function level5(): LevelDef {
  const b = new LB();
  b.seg(14, 1, 1)
    .wave(4, 'scout', 8, 80, 'swoop', { dir: 1, s: 2.4 }, 8)
    .wave(10, 'scout', 8, 240, 'swoop', { dir: -1, s: 2.4 }, 8);
  b.seg(18, 1, 1, 3, 3)
    .wall(4, 'gate', 'L').wall(4, 'gate', 'R')
    .wave(8, 'drone', 5, 0, 'side', { dir: 1, y: 40, s: 1.6 }, 14)
    .wall(13, 'sentry', 'L').wall(13, 'sentry', 'R')
    .cap(15, 160);
  b.cp();
  b.seg(16, 3, 3, 5, 5)
    .one(3, 'walker', 160, 'down', { s: 0.35 })
    .wall(9, 'gate', 'L').wall(9, 'gate', 'R')
    .wave(12, 'scout', 6, 160, 'dive', { stop: 50, dx: 0 }, 14);
  b.seg(16, 5, 5, 2, 2)
    .wave(3, 'drone', 6, 0, 'side', { dir: -1, y: 50, s: 1.6 }, 12)
    .wall(8, 'sentry', 'L').wall(12, 'sentry', 'R');
  b.seg(20, 2, 2, 2, 2)
    .block(5, 6, 8, 2)
    .wall(3, 'gate', 'L').wall(3, 'gate', 'R').wall(11, 'gate', 'L').wall(11, 'gate', 'R')
    .wave(14, 'drone', 6, 160, 'circle', { cy: 80, r: 60, dir: 1 }, 20)
    .cap(17, 160, 'P');
  b.cp();
  b.seg(12, 2, 2, 1, 1)
    .wall(5, 'sentry', 'L').wall(5, 'sentry', 'R');
  b.mid('sentinel');
  b.cp();
  b.seg(18, 1, 1, 4, 4)
    .wave(3, 'scout', 10, 160, 'sine', { a: 90, s: 1.8 }, 8)
    .wall(9, 'gate', 'L').wall(9, 'gate', 'R')
    .one(12, 'walker', 160, 'down', { s: 0.35 });
  b.seg(18, 4, 4, 6, 6)
    .wall(3, 'sentry', 'L').wall(8, 'sentry', 'R').wall(13, 'gate', 'L').wall(13, 'gate', 'R')
    .wave(6, 'drone', 5, 120, 'dive', { stop: 60, dx: 20 }, 20)
    .cap(15, 160);
  b.seg(14, 6, 6, 2, 2)
    .wave(4, 'scout', 8, 0, 'side', { dir: 1, y: 30, s: 2.2, a: 20 }, 8)
    .one(9, 'walker', 120, 'down', { s: 0.35 }).one(10, 'walker', 200, 'down', { s: 0.35 });
  b.cp();
  b.seg(22, 2, 2, 2, 2)
    .block(4, 4, 4, 2).block(4, 12, 4, 2).block(13, 8, 4, 2)
    .wall(8, 'gate', 'L').wall(8, 'gate', 'R').wall(17, 'gate', 'L').wall(17, 'gate', 'R')
    .wave(10, 'drone', 6, 160, 'circle', { cy: 70, r: 70, dir: -1 }, 18)
    .cap(19, 160, 'X');
  b.seg(16, 2, 2, 4, 4)
    .wall(4, 'sentry', 'L').wall(4, 'sentry', 'R')
    .wave(8, 'scout', 12, 160, 'swoop', { dir: 1, alt: 1, s: 2.4 }, 7);
  b.cp();
  b.seg(18, 4, 4, 5, 5)
    .one(3, 'walker', 160, 'down', { s: 0.35 })
    .wall(8, 'gate', 'L').wall(8, 'gate', 'R')
    .wave(12, 'drone', 8, 160, 'sine', { a: 70, s: 1.1 }, 12);
  b.seg(12, 5, 5, 1, 1)
    .wall(4, 'sentry', 'L').wall(4, 'sentry', 'R');
  b.end('overmind');
  return b.build(4, 'METALLIC SPACEWAYS', {
    rock: ramp(['#04060c', '#1a2236', '#3a4a6a', '#6a82a8', '#b4c8e4', '#ffffff'], 16),
    alt: ramp(['#100800', '#3a2a00', '#8a6a00', '#d4b020', '#ffee88'], 16),
    bg: ['#000008', '#050a1c', '#000008'],
    far: ramp(['#0a0e1c', '#121a2c', '#1a243c', '#24304c'], 4),
    wobble: 0, tex: 'metal', ambient: 'stars', ambientColor: 'rgba(200,220,255,0.7)',
  }, 'level5', 0.62);
}
