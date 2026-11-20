// Threat director: keeps the game challenging however much the ship is upgraded.
//
// Two inputs decide the current THREAT (about -1 to +2.4):
//  1. Power gap: a firepower rating of the loadout, compared with what a typical player has at this point in the game.
//     Out-buying the curve raises the threat; running behind it lowers it.
//  2. Form: a slow rubber band. Long stretches without taking a hit nudge the threat up; taking hits and dying ease
//     it back down, so a struggling player gets breathing room and a dominant player keeps getting pushed.
//
// Threat then drives several levers at once, so it reads as "the enemy got smarter and angrier" rather than just
// "bullet sponges": faster and denser enemy fire, quicker bullets, harder hits, more HP, flat armour that blunts
// chip-damage weapons (rewarding focused weapons over stacking every spray gun), elite enemies, and reinforcement
// spawns in waves. Bosses get more HP and fire faster too.
import type { Loadout } from './items';

/** Firepower contribution of each owned weapon level (rough damage per volley, weighted by how often it connects). */
const FIRE: Partial<Record<keyof Loadout, number[]>> = {
  power: [0, 1, 2, 4, 5, 7],
  spread: [0, 1, 2, 3],
  side: [0, 0.6, 1.2, 1.8],
  rear: [0, 0.4, 0.8, 1.2],
  wing: [0, 1.5, 2.5],
  twister: [0, 1.5, 2.5],
  laser: [0, 1.7, 3.9, 5.5],
  cannon: [0, 1.7, 2.9, 5],
  homing: [0, 1.1, 2.6, 4],
  mines: [0, 0.9, 1.4],
  flamer: [0, 2.2, 3],
  electro: [0, 0.6, 1.2],
  drone: [0, 0.8, 1.6],
};
/** Survivability contributions (they make the run easier too, just less directly). */
const GUARD: Partial<Record<keyof Loadout, number>> = { armour: 0.7, regen: 0.9, speed: 0.35 };

export function powerRating(l: Loadout): number {
  let fire = 0;
  for (const [id, tbl] of Object.entries(FIRE) as [keyof Loadout, number[]][]) fire += tbl[Math.min(tbl.length - 1, l[id] ?? 0)];
  fire *= 1 + 0.2 * (l.rapid ?? 0);
  if (l.autofire) fire *= 1.2;
  let guard = 0;
  for (const [id, w] of Object.entries(GUARD) as [keyof Loadout, number][]) guard += w * (l[id] ?? 0);
  return fire + guard;
}

/** What a player who spends sensibly tends to have when starting level idx (0-based). */
export function expectedPower(idx: number) { return 1.5 + idx * 1.9; }

export const THREAT_MAX = 2.4;

export class Director {
  /** ticks since the player last took damage */
  calm = 0;
  power = 0;
  threat = 0;
  /** displayed threat level 0..5 */
  level = 0;
  private lastLevel = -1;

  /** ps.form is the rubber-band term from recent form (-0.6..+0.6); it lives on the player so it survives deaths and levels */
  constructor(private idx: number, private ps: { load: Loadout; form: number }) {
    this.recompute();
  }
  get form() { return this.ps.form; }
  set form(v: number) { this.ps.form = v; }

  recompute() {
    this.power = powerRating(this.ps.load);
    const gap = Math.log2(Math.max(0.25, this.power / expectedPower(this.idx)));
    // the gap counts for more once you are clearly ahead: that's where runs used to get boring
    const fromGap = gap > 0 ? gap * 1.05 : gap * 0.6;
    this.threat = Math.max(-1, Math.min(THREAT_MAX, fromGap + this.form));
    this.level = Math.max(0, Math.min(5, Math.round((this.threat + 0.2) * 2.2)));
  }

  /** call every tick; returns true when the displayed threat level just went up */
  tick(): boolean {
    this.calm++;
    // ~25 s without a scratch: start leaning on the player, slowly
    if (this.calm > 1250 && this.calm % 50 === 0) this.form = Math.min(0.6, this.form + 0.02);
    if (this.calm % 25 === 0) this.recompute();
    const up = this.lastLevel >= 0 && this.level > this.lastLevel;
    this.lastLevel = this.level;
    return up;
  }
  onHurt(amount: number) {
    this.calm = 0;
    this.form = Math.max(-0.6, this.form - Math.min(0.06, amount * 0.004));
  }
  onDeath() { this.calm = 0; this.form = Math.max(-0.6, this.form - 0.35); this.recompute(); }

  private get up() { return Math.max(0, this.threat); }
  private get down() { return Math.min(0, this.threat); }
  /** multiplier on enemy HP */
  get hp() { return 1 + this.up * 0.42 + this.down * 0.3; }
  /** multiplier on enemy fire intervals (lower = fires more often) */
  get fire() { return 1 / (1 + this.up * 0.32) * (1 - this.down * 0.3); }
  /** multiplier on enemy bullet speed */
  get bullet() { return 1 + this.up * 0.11 + this.down * 0.12; }
  /** multiplier on damage the player takes */
  get dmg() { return 1 + this.up * 0.2 + this.down * 0.25; }
  /** flat damage soaked from each player hit on regular enemies (blunts spray weapons, barely dents heavy ones) */
  get armour() { return this.up * 0.28; }
  /** chance that a fresh enemy spawns as an elite */
  get elite() { return Math.min(0.4, this.up * 0.17); }
  /** chance that a wave member brings a mirrored wingman */
  get reinforce() { return Math.min(0.45, Math.max(0, this.threat - 0.3) * 0.25); }
  /** multiplier on boss HP */
  get bossHp() { return 1 + this.up * 0.35 + this.down * 0.25; }
}

const THREAT_UP = [
  "THEY'VE SEEN YOUR SHOPPING BILL. THEY'RE ARMING UP.",
  'ENEMY CHATTER JUST DOUBLED. YOU MADE AN IMPRESSION.',
  'THREAT RISING. GORBO SUGGESTS LESS SHOWING OFF.',
  'THE SWARM SENT ITS ELITES. FLATTERING, REALLY.',
  'YOU HIT HARD, THEY HIT BACK HARDER. THAT IS THE DEAL.',
  'ARMOURED HOSTILES INBOUND. SPRAY LESS, AIM MORE.',
  'BIG GUNS INVITE BIG TROUBLE. ENJOY.',
];
export function threatLine() { return THREAT_UP[Math.floor(Math.random() * THREAT_UP.length)]; }
