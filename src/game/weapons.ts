// All player weapons share one bullet pool; this module decides what each owned weapon fires.
import { S, SF, Spr } from '../art/sprites';
import { audio } from '../engine/audio';
import type { World } from './World';
import type { Player, Ctl } from './Player';
import type { Enemy } from './enemies';

export type PKind = 'bolt' | 'laser' | 'cannon' | 'homing' | 'flame' | 'mine' | 'plain';
export interface PBullet {
  alive: boolean; kind: PKind; x: number; y: number; ox: number; oy: number; vx: number; vy: number;
  dmg: number; hw: number; hh: number; pierce: number; life: number; spr: Spr; hits: unknown[]; ang: number; target: Enemy | null; t: number;
}

const D2R = Math.PI / 180;

function shot(w: World, kind: PKind, spr: Spr, x: number, y: number, ang: number, speed: number, dmg: number, o: Partial<PBullet> = {}) {
  const b = w.pb.get();
  b.kind = kind; b.spr = spr; b.x = b.ox = x; b.y = b.oy = y;
  b.vx = Math.sin(ang) * speed; b.vy = -Math.cos(ang) * speed; b.ang = ang;
  b.dmg = dmg; b.hw = Math.max(2, spr.width / 2 - 1); b.hh = Math.max(2, spr.height / 2 - 1);
  b.pierce = 0; b.life = 120; b.hits.length = 0; b.target = null; b.t = 0;
  Object.assign(b, o);
  return b;
}

/** A trigger pull: every forward/side/rear gun fires once. */
function volley(w: World, p: Player) {
  const L = (id: Parameters<Player['lv']>[0]) => p.lv(id);
  const x = p.x, y = p.y - 12;
  // base blaster
  const pw = L('power');
  const B1 = S.b1, B2 = S.b2;
  switch (pw) {
    case 1: shot(w, 'bolt', B1, x, y, 0, 6, 1); break;
    case 2: shot(w, 'bolt', B1, x - 3, y, 0, 6, 1); shot(w, 'bolt', B1, x + 3, y, 0, 6, 1); break;
    case 3: shot(w, 'bolt', B2, x, y - 2, 0, 6.5, 2); shot(w, 'bolt', B1, x - 5, y, 0, 6, 1); shot(w, 'bolt', B1, x + 5, y, 0, 6, 1); break;
    case 4: shot(w, 'bolt', B2, x - 4, y, 0, 6.5, 2); shot(w, 'bolt', B2, x + 4, y, 0, 6.5, 2); shot(w, 'bolt', B1, x, y - 3, 0, 6.5, 1); break;
    default: shot(w, 'bolt', S.b3, x, y - 3, 0, 7, 3); shot(w, 'bolt', B2, x - 6, y, -3 * D2R, 6.5, 2); shot(w, 'bolt', B2, x + 6, y, 3 * D2R, 6.5, 2); break;
  }
  const sp = L('spread');
  if (sp) {
    const angs = [12, 25, 40].slice(0, sp);
    for (const a of angs) { shot(w, 'bolt', S.spread, x - 7, y + 8, -a * D2R, 5, 1); shot(w, 'bolt', S.spread, x + 7, y + 8, a * D2R, 5, 1); }
  }
  const la = L('laser');
  if (la) {
    const spr = la >= 3 ? SF.laserW[2] : SF.laser[la - 1];
    const dmg = 0.8 + la * 0.35;
    shot(w, 'laser', spr, x - 4, y - 10, 0, 9, dmg, { pierce: 99 });
    if (la >= 2) shot(w, 'laser', spr, x + 4, y - 10, 0, 9, dmg, { pierce: 99 });
  }
  const sd = L('side');
  if (sd) {
    const offs = [0, -4, 4].slice(0, sd);
    for (const o of offs) { shot(w, 'bolt', S.side, x - 18, y + 14 + o, -90 * D2R, 5, 1.5); shot(w, 'bolt', S.side, x + 18, y + 14 + o, 90 * D2R, 5, 1.5); }
  }
  const rr = L('rear');
  if (rr) {
    const angs = rr === 1 ? [0] : rr === 2 ? [-6, 6] : [-15, 0, 15];
    for (const a of angs) shot(w, 'bolt', S.rear, x + a * 0.3, p.y + 16, (180 + a) * D2R, 5.5, 1.2);
  }
  const wg = L('wing');
  if (wg) {
    shot(w, 'bolt', S.wing, x - 13, y + 12, -30 * D2R, 5.5, 1.5); shot(w, 'bolt', S.wing, x + 13, y + 12, 30 * D2R, 5.5, 1.5);
    if (wg > 1) { shot(w, 'bolt', S.wing, x - 13, y + 18, -135 * D2R, 5, 1.5); shot(w, 'bolt', S.wing, x + 13, y + 18, 135 * D2R, 5, 1.5); }
  }
  const tw = L('twister');
  if (tw) {
    const n = tw === 1 ? 4 : 6;
    for (let i = 0; i < n; i++) shot(w, 'bolt', S.twist, x, p.y + 6, p.twistA + (i / n) * Math.PI * 2, 4, 1.2);
    p.twistA += 0.3;
  }
  p.muzzle = 3;
  audio.play(la ? 'laser' : 'shot');
}

export function updateWeapons(w: World, p: Player, c: Ctl) {
  if (p.dead) return;
  const rapid = p.lv('rapid');
  if (p.tapCd > 0) p.tapCd--;
  if (p.holdCd > 0) p.holdCd--;
  if (p.cannonCd > 0) p.cannonCd--;
  if (p.homingCd > 0) p.homingCd--;
  if (p.mineCd > 0) p.mineCd--;
  if (p.firing > 0) p.firing--;
  let fire = false;
  if (p.lv('autofire')) {
    if (c.fire && p.tapCd <= 0) { fire = true; p.tapCd = 6 - rapid; }
  } else {
    // like the classics: tapping fires faster than holding
    if (c.firePressed && p.tapCd <= 0) { fire = true; p.tapCd = 4 - Math.min(2, rapid); p.holdCd = 15; }
    else if (c.fire && !c.firePressed && p.holdCd <= 0) { fire = true; p.holdCd = 15 - rapid * 3; }
  }
  if (fire) volley(w, p);
  if (!c.fire) return;
  p.firing = 3;
  // cannon
  const cn = p.lv('cannon');
  if (cn && p.cannonCd <= 0) {
    shot(w, 'cannon', S.cannon, p.x, p.y - 14, 0, 4.2, 4 + cn * 2, { pierce: 3 });
    p.cannonCd = [0, 28, 22, 16][cn] - rapid * 2;
    audio.play('cannon');
  }
  // homing missiles
  const hm = p.lv('homing');
  if (hm && p.homingCd <= 0) {
    shot(w, 'homing', S.missile, p.x - 9, p.y + 4, -20 * D2R, 2.5, 3);
    if (hm > 1) shot(w, 'homing', S.missile, p.x + 9, p.y + 4, 20 * D2R, 2.5, 3);
    p.homingCd = [0, 34, 28, 18][hm];
    audio.play('missile');
  }
  // mines
  const mn = p.lv('mines');
  if (mn && p.mineCd <= 0) {
    shot(w, 'mine', S.mine, p.x, p.y + 16, Math.PI, 0.7, 10, { life: 260 });
    p.mineCd = mn === 1 ? 45 : 28;
  }
  // flamethrower
  const fm = p.lv('flamer');
  if (fm && (++p.flameCd % 2 === 0)) {
    const spread = fm === 1 ? 14 : 22;
    shot(w, 'flame', SF.fire[0], p.x + (Math.random() - 0.5) * 4, p.y - 20, (Math.random() - 0.5) * spread * D2R, 3.6 + fm * 0.4, 0.9, { pierce: 99, life: fm === 1 ? 13 : 18 });
    audio.play('flame');
  }
  // drones
  let di = 0;
  for (const s of p.sats) {
    if (s.kind !== 'drone') continue;
    if (--p.droneCd[di] <= 0) { shot(w, 'bolt', S.droneShot, s.x, s.y - 6, 0, 6, 1); p.droneCd[di] = 14; }
    di++;
  }
}

/** Per-tick motion of special bullets. */
export function moveBullet(w: World, b: PBullet) {
  b.t++;
  switch (b.kind) {
    case 'homing': {
      if (b.t % 6 === 1 && (!b.target || !b.target.alive)) b.target = w.nearestEnemy(b.x, b.y);
      let tx: number | null = null, ty = 0;
      if (b.target && b.target.alive) { tx = b.target.x; ty = b.target.y; }
      else { const bp = w.bossTarget(); if (bp) { tx = bp[0]; ty = bp[1]; } }
      if (tx !== null) {
        const want = Math.atan2(tx - b.x, -(ty - b.y));
        let d = want - b.ang;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        b.ang += Math.max(-0.12, Math.min(0.12, d));
      }
      const sp = Math.min(4.5, 2.5 + b.t * 0.08);
      b.vx = Math.sin(b.ang) * sp; b.vy = -Math.cos(b.ang) * sp;
      if (b.t % 3 === 0) w.fx.smoke(b.x, b.y + 4);
      break;
    }
    case 'flame': {
      b.spr = SF.fire[Math.min(5, Math.floor(b.t / 3))];
      b.hw = b.hh = b.spr.width / 2;
      b.vx *= 0.97; b.vy *= 0.97;
      break;
    }
    case 'mine': {
      b.vy *= 0.97;
      b.y += w.scrollDelta;
      if (b.life < 1) w.mineBlast(b);
      break;
    }
  }
  b.x += b.vx; b.y += b.vy;
}
