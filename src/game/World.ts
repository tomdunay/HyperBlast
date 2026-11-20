// The in-level game: scroll (forward/reverse), spawns by scroll position, collisions, bosses, HUD.
import { Pool } from '../engine/pool';
import { Ctx, rnd, makeCanvas, hiCanvas, RES, snap } from '../engine/gfx';
import { drawGlow, shadowOf, vignette, hazardStripes, glow, darkVignette, lightShafts, searchCone } from '../engine/light';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { text, wrap } from '../engine/font';
import { S, SF, Spr, flashOf, TokenType } from '../art/sprites';
import { Scroller } from './Scroller';
import { FX } from './particles';
import { Player, Ctl } from './Player';
import { PlayerState, ITEM } from './items';
import { ENEMIES, Enemy, PATTERNS, makeTrail, randomCapsuleToken } from './enemies';
import { Boss } from './bosses';
import { PBullet, updateWeapons, moveBullet } from './weapons';
import { LevelDef, SpawnDef, W, H } from './types';
import { VIEW, MARGIN, fillView } from '../engine/view';
import { postFx } from '../engine/post';
import {
  SAUCE_HEAT, SAUCE_MAX, SAUCE_SAVE_AT, bankTip, bossIntro, checkpointLine, comboBreakLine, comboLine, comboWord,
  deathBig, deathLine, defusedLine, diveLine, extraLifeLine, fillTip, grazeLine, grazePop, idleLine, lowShieldLine,
  midDeadLine, partLine, phaseLine, reverseLine, sauceOffLine, sauceOnLine, sauceSaveLine, superLine, zapLine,
} from './sauce';

export interface Host {
  demo: boolean; debug: boolean; diff: 0 | 1 | 2; twoPlayer: boolean;
  onDied(): void; onShop(): void; onLevelDone(): void; hiScore(): number;
  regen?(): void; seedLabel?(): string;
}
interface EBullet { alive: boolean; x: number; y: number; ox: number; oy: number; vx: number; vy: number; spr: Spr; dmg: number; r: number; graze: number } // graze: 0 = none, 1 = inside graze zone, 2 = done
interface Pickup { alive: boolean; kind: 'cash' | 'token'; val: number; tok: TokenType; x: number; y: number; ox: number; oy: number; vx: number; vy: number; t: number; life: number }

const BULLET_DMG: Record<string, number> = { eOrb: 9, eBig: 16, eNeedle: 8, eSpore: 8, ePlasma: 11 };
const TOKEN_GLOW: Record<string, string> = { P: '#ff4433', S: '#33ccff', H: '#44ff44', $: '#ffcc22', Z: '#cc55ff', D: '#3366ff', X: '#ffffff', '1': '#ff9922' };

const ambCache = new Map<string, HTMLCanvasElement>();
/** colour string (#rgb hex, rgb() or rgba()) with a new alpha */
function withA(color: string, a: number) {
  if (color[0] === '#') { const v = parseInt(color.slice(1), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`; }
  const n = color.replace(/rgba?\(|\)/g, '').split(',').slice(0, 3).join(',');
  return `rgba(${n},${a})`;
}
/** Ambient particle sprites at art resolution: glassy bubbles, soft dust, glowing spores and embers, twinkling stars. */
function ambientSprite(kind: string, color: string, size: number): HTMLCanvasElement {
  const key = kind + color + size;
  const hit = ambCache.get(key);
  if (hit) return hit;
  const r = [1, 2, 3.2][size];
  const s = Math.ceil(r * 2 + 6);
  const [c, x] = hiCanvas(s, s);
  const m = s / 2;
  if (kind === 'bubbles') {
    const g = x.createRadialGradient(m - r * 0.3, m - r * 0.3, 0, m, m, r);
    g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.75, withA(color, 0.2)); g.addColorStop(0.92, withA(color, 0.85)); g.addColorStop(1, withA(color, 0));
    x.fillStyle = g; x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(m - r * 0.4, m - r * 0.4, Math.max(0.35, r * 0.25), 0, Math.PI * 2); x.fill();
  } else {
    const glowR = kind === 'spores' || kind === 'embers' ? r * 2.6 : r * 1.3;
    const g = x.createRadialGradient(m, m, 0, m, m, glowR);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.2, withA(color, 0.8)); g.addColorStop(1, withA(color, 0));
    x.fillStyle = g; x.beginPath(); x.arc(m, m, glowR, 0, Math.PI * 2); x.fill();
  }
  ambCache.set(key, c);
  return c;
}

const hudPanels = new Map<number, HTMLCanvasElement>();
/** Bevelled, riveted metal HUD strip spanning the whole view (draw at x = -VIEW.ox). */
function panel(): HTMLCanvasElement {
  const VW = VIEW.w, ox = VIEW.ox;
  const hit = hudPanels.get(VW);
  if (hit) return hit;
  const [c, x] = hiCanvas(VW, 14);
  const g = x.createLinearGradient(0, 0, 0, 14);
  g.addColorStop(0, '#8a94b4'); g.addColorStop(0.15, '#5a6488'); g.addColorStop(0.6, '#2c3250'); g.addColorStop(1, '#12162a');
  x.fillStyle = g; x.fillRect(0, 0, VW, 14);
  x.fillStyle = '#c8d0ee'; x.fillRect(0, 0, VW, 1);
  x.fillStyle = '#05060c'; x.fillRect(0, 13, VW, 1);
  // out in the margins: ventilation grilles between end caps
  if (ox >= 24) for (const [a, b] of [[4, ox - 6], [ox + W + 6, VW - 4]]) {
    for (let gx = a + 4; gx < b - 4; gx += 3) { x.fillStyle = '#0a0c18'; x.fillRect(gx, 4, 1, 6); x.fillStyle = '#6a7298'; x.fillRect(gx + 1, 4, 1, 6); }
    for (const rx of [a, b - 2]) { x.fillStyle = '#0a0c18'; x.fillRect(rx, 6, 2, 2); x.fillStyle = '#c8d0ee'; x.fillRect(rx, 6, 1, 1); }
  }
  for (let px = 4; px < W; px += 52) { x.fillStyle = '#0a0c18'; x.fillRect(ox + px, 6, 2, 2); x.fillStyle = '#c8d0ee'; x.fillRect(ox + px, 6, 1, 1); }
  for (const sx of [86, 150, 222, 286, ...(ox >= 8 ? [-3, W + 2] : [])]) { x.fillStyle = '#0a0c18'; x.fillRect(ox + sx, 2, 1, 10); x.fillStyle = '#8890b0'; x.fillRect(ox + sx + 1, 2, 1, 10); }
  // recessed wells for the readouts
  for (const [wx, ww] of [[9, 75], [154, 66]]) { x.fillStyle = '#05060c'; x.fillRect(ox + wx, 3, ww, 9); x.fillStyle = '#6a7298'; x.fillRect(ox + wx, 12, ww, 1); }
  hudPanels.set(VW, c);
  return c;
}

export class World {
  lv: LevelDef; ps: PlayerState; host: Host;
  sc: Scroller; player: Player; fx = new FX();
  enemies = new Pool<Enemy>(() => ({ alive: false } as Enemy), 64);
  pb = new Pool<PBullet>(() => ({ alive: false, hits: [] } as unknown as PBullet), 300);
  eb = new Pool<EBullet>(() => ({ alive: false } as EBullet), 300);
  pickups = new Pool<Pickup>(() => ({ alive: false } as Pickup), 64);
  boss: Boss | null = null;
  bossKind: 'mid' | 'end' | null = null;
  spawnState: Uint8Array;
  waves: { sp: SpawnDef; left: number; timer: number; k: number }[] = [];
  state: 'play' | 'dying' | 'defused' | 'paused-shop' = 'play';
  stateT = 0;
  t = 0;
  scrollV = 0;
  scrollDelta = 0;
  lockY = Infinity;
  msg = ''; msgT = 0; msgStyle: 'gold' | 'red' | 'cyan' = 'gold';
  zapFlash = 0;
  hurtT = 0;
  dispCash = -1;
  fireMul: number; bulletMul: number; dmgMul: number;
  showHit = false; invincible = false; showMap = false;
  // combo system
  combo = 0;
  comboTimer = 0;
  /** 0..100. Grazes and chains fill it. A full meter runs hot. A banked meter can refuse a killing blow. */
  sauce = 0;
  sauceBurst = 0;
  sauceFlash = 0;
  shieldWarned = false;
  chatter = '';
  chatterT = 0;
  chatterCd = 0;
  bossQuip = '';
  defusedQuip = '';
  reverseHeckled = false;
  sauceSeen = false;
  // hit stop (freeze frames on boss kill)
  hitStop = 0;
  // stats tracking (lives on PlayerState so deaths don't reset it)
  get stats() { return this.ps.lvStats; }
  private mapCanvas: HTMLCanvasElement | null = null;
  ambient: { x: number; y: number; s: number; z: number }[] = [];
  shopPending = 0;
  ctl: Ctl = { up: false, down: false, left: false, right: false, fire: false, firePressed: false, zap: false, dive: false };
  demoFire = 0;

  constructor(lv: LevelDef, ps: PlayerState, host: Host) {
    this.lv = lv; this.ps = ps; this.host = host;
    this.sc = new Scroller(lv);
    this.player = new Player(ps);
    this.fireMul = [1.5, 1, 0.72][host.diff];
    this.bulletMul = [0.8, 1, 1.18][host.diff] * (1 + 0.015 * lv.idx);
    this.dmgMul = [0.6, 1, 1.35][host.diff];
    this.spawnState = new Uint8Array(lv.spawns.length);
    const start = lv.checkpoints[Math.min(ps.checkpoint, lv.checkpoints.length - 1)];
    this.sc.y = this.sc.oy = this.sc.maxY = start;
    this.scrollV = lv.speed;
    this.updateLock();
    // spawns before the checkpoint are spent; wall growths already in view appear immediately
    lv.spawns.forEach((sp, i) => {
      if (sp.at <= start) {
        if (sp.kind === 'wall' && sp.at > start - 280) this.trigger(i, sp);
        else this.spawnState[i] = 2;
      }
    });
    for (let i = 0; i < 70; i++) this.ambient.push({ x: rnd(-MARGIN, W + MARGIN), y: rnd(0, H), s: rnd(0.2, 0.6), z: Math.random() < 0.3 ? 2 : 1 });
    this.say(host.demo ? 'DEMO' : 'GET READY', 120, 'gold');
    audio.setBassIntensity(0);
    audio.playMusic(lv.music);
  }

  updateLock() {
    const lv = this.lv;
    if (lv.midBoss && !this.ps.midDone) this.lockY = lv.midBoss.at;
    else this.lockY = lv.endBoss.at;
  }

  say(s: string, t = 100, style: 'gold' | 'red' | 'cyan' = 'gold') { this.msg = s; this.msgT = t; this.msgStyle = style; }

  /** Gorbo, on the radio. Stays out of the big centre banner. */
  radio(s: string, force = false) {
    if (this.host.demo) return;
    if (!force && (this.chatterCd > 0 || this.bossIntroT > 40)) return;
    this.chatter = s;
    this.chatterT = Math.min(170, 70 + s.length);
    this.chatterCd = force ? 40 : 100;
  }
  heatDmg(n: number) { return this.sauceBurst > 0 ? n * SAUCE_HEAT : n; }
  addSauce(n: number) {
    if (this.host.demo || this.player.dead || this.state !== 'play' || this.sauceBurst > 0) return;
    if (this.boss?.state === 'dying') return;
    const prev = this.sauce;
    this.sauce = Math.min(SAUCE_MAX, this.sauce + n);
    if (prev < 40 && this.sauce >= 40) { const tip = fillTip(); if (tip) this.radio(tip, true); }
    if (prev < SAUCE_SAVE_AT && this.sauce >= SAUCE_SAVE_AT) { const tip = bankTip(); if (tip) this.radio(tip, true); }
    if (this.sauce >= SAUCE_MAX) this.startSauce();
  }
  startSauce() {
    this.sauce = SAUCE_MAX;
    this.sauceBurst = 250;
    const room = this.ps.maxShield() - this.ps.shield;
    if (room > 0) this.ps.shield += Math.min(16, room);
    this.sauceFlash = 10;
    this.fx.floatText(this.player.x, this.player.y - 28, 'SAUCE!', 'red');
    this.say('TOO HOT', 50, 'red');
    this.radio(sauceOnLine(), true);
    audio.play('token');
  }
  /** A banked meter spends itself to eat one lethal hit. */
  trySauceSave(): boolean {
    if (this.host.demo || this.sauceBurst > 0 || this.sauce < SAUCE_SAVE_AT) return false;
    this.sauce = 0;
    this.ps.shield = Math.max(32, Math.round(this.ps.maxShield() * 0.4));
    this.player.inv = Math.max(this.player.inv, 110);
    this.player.hitFlash = 10;
    this.sauceFlash = 18;
    this.say('SAUCE SAVE', 80, 'red');
    this.radio(sauceSaveLine(), true);
    this.fx.floatText(this.player.x, this.player.y - 26, 'SAVED', 'purple');
    this.fx.ring(this.player.x, this.player.y);
    audio.play('oneup');
    return true;
  }
  onBossBreak(core: boolean) {
    this.addSauce(core ? 20 : 14);
    if (!core) this.radio(partLine());
  }
  onPhase2() { this.radio(phaseLine(), true); }

  // ---------------------------------------------------------------- update
  update() {
    this.t++;
    this.stateT++;
    // hit stop: freeze simulation for dramatic pause (t still ticks for visual effects)
    if (this.hitStop > 0) { this.hitStop--; return; }
    // combo decay
    if (this.comboTimer > 0) this.comboTimer--;
    if (this.comboTimer === 0 && this.combo > 0) {
      if (this.combo >= 8) this.radio(comboBreakLine());
      this.combo = 0;
    }
    if (this.sauceBurst > 0 && --this.sauceBurst === 0) { this.sauce = 0; this.radio(sauceOffLine()); }
    if (this.sauceFlash > 0) this.sauceFlash--;
    if (this.chatterT > 0) this.chatterT--;
    if (this.chatterCd > 0) this.chatterCd--;
    if (this.host.debug) this.debugKeys();
    this.readControls();
    const p = this.player;
    // ---- scrolling (forward / reverse) ----
    const sc = this.sc;
    sc.oy = sc.y;
    let target = this.lv.speed;
    const locked = sc.y >= this.lockY - 0.01;
    if (this.boss || locked || this.state !== 'play') target = 0;
    else if (p.atBottom() && this.ctl.down && !p.dead) target = -1.1;
    this.scrollV += (target - this.scrollV) * 0.08;
    let ny = sc.y + this.scrollV;
    const minY = Math.max(0, sc.maxY - H * 1.5);
    if (ny < minY) { ny = minY; this.scrollV = Math.max(0, this.scrollV); }
    if (ny > this.lockY) ny = this.lockY;
    sc.y = ny;
    sc.maxY = Math.max(sc.maxY, ny);
    this.scrollDelta = sc.y - sc.oy;
    // world-attached things ride the scroll
    for (const e of this.enemies.list) if (e.world) e.y += this.scrollDelta;
    for (const k of this.pickups.list) if (k.kind === 'cash') k.y += this.scrollDelta;
    this.checkSpawns(sc.oy, sc.y);
    this.updateWaves();
    // ---- player ----
    if (this.state !== 'dying') {
      p.update(this, this.ctl);
      updateWeapons(this, p, this.ctl);
      if (this.ctl.zap && this.ps.load.zapper > 0 && !p.dead) this.zap();
      if (this.ctl.dive && this.ps.load.dive > 0 && p.dive === 0 && !p.dead) { this.ps.load.dive--; p.dive = 200; audio.play('dive'); this.radio(diveLine()); }
      if (this.ps.load.regen && this.t % (60 / this.ps.load.regen | 0) === 0) this.ps.shield = Math.min(this.ps.maxShield(), this.ps.shield + 1);
    }
    // ---- entities ----
    this.updatePlayerBullets();
    this.updateEnemies();
    this.updateEnemyBullets();
    this.updatePickups();
    if (this.boss) this.updateBoss();
    this.fx.update(this.scrollDelta);
    this.collidePlayer();
    // ---- triggers ----
    const cps = this.lv.checkpoints;
    for (let k = this.ps.checkpoint + 1; k < cps.length; k++) if (sc.maxY >= cps[k]) {
      this.ps.checkpoint = k;
      if (k > 0 && !this.host.demo) { this.say('CHECKPOINT', 60, 'cyan'); this.radio(checkpointLine(), true); }
    }
    if (!this.boss && sc.y >= this.lockY - 0.01 && this.state === 'play') this.startBoss();
    if (this.lv.idx === 0 && !this.ps.midDone && !this.lv.midBoss && sc.oy < this.lv.shopAt && sc.y >= this.lv.shopAt) this.shopPending = 40;
    if (this.shopPending > 0 && --this.shopPending === 0) { this.ps.midDone = true; this.updateLock(); this.goShop(); }
    if (this.state === 'dying' && this.stateT > 130) { this.state = 'paused-shop'; this.host.onDied(); }
    if (this.state === 'defused' && this.stateT === 91) { this.addScore((this.lv.idx + 1) * 5000); audio.play('buy'); }
    if (this.state === 'defused' && this.stateT > 260) { this.state = 'paused-shop'; this.host.onLevelDone(); }
    if (this.msgT > 0) this.msgT--;
    if (this.zapFlash > 0) this.zapFlash--;
    if (this.bossIntroT > 0) this.bossIntroT--;
    // engine exhaust trails (hotter and longer with speed-ups)
    if (!p.dead && p.dive === 0 && this.state !== 'dying') {
      const side = this.t & 1 ? 6 : -6;
      this.fx.exhaust(p.x + side + p.bank * 1.2, p.y + 18, p.lv('speed') > 0 || this.t % 3 === 0);
    }
    if (this.hurtT > 0) this.hurtT--;
    // dynamic music: boss fights get aggressive bass, low shield adds intensity
    if (this.boss && this.boss.state !== 'dead') {
      const shieldFrac = this.ps.shield / this.ps.maxShield();
      audio.setBassIntensity(shieldFrac < 0.25 ? 2 : 1);
    }
    if (this.dispCash < 0) this.dispCash = this.ps.cash;
    this.dispCash += Math.sign(this.ps.cash - this.dispCash) * Math.max(1, Math.ceil(Math.abs(this.ps.cash - this.dispCash) * 0.15));
    if (Math.abs(this.ps.cash - this.dispCash) < 1) this.dispCash = this.ps.cash;
    // score-based extra lives
    if (this.ps.score >= this.ps.extraLifeAt) { this.ps.extraLifeAt += 75000; this.ps.lives++; audio.play('oneup'); this.say('EXTRA LIFE', 80, 'cyan'); this.radio(extraLifeLine(), true); }
    if (!this.host.demo && this.state === 'play' && !p.dead && this.t === 160) this.radio('TRY TO COME BACK IN ONE PIECE. GORBO HATES THE PAPERWORK.');
    if (!this.host.demo && this.state === 'play' && !p.dead && this.t % 800 === 500 && this.combo === 0 && this.enemies.list.some((e) => e.alive && e.def.name !== 'capsule' && e.def.name !== 'gate')) this.radio(idleLine());
    if (this.scrollV < -0.5) { if (!this.reverseHeckled) { this.reverseHeckled = true; this.radio(reverseLine()); } }
    else if (this.scrollV > 0.2) this.reverseHeckled = false;
    if (this.ps.shield / this.ps.maxShield() > 0.55) this.shieldWarned = false;
    this.pb.sweep(); this.eb.sweep(); this.enemies.sweep(); this.pickups.sweep();
  }

  goShop() {
    if (this.host.demo) return;
    this.state = 'paused-shop';
    this.host.onShop();
  }
  resumeFromShop() {
    this.state = 'play';
    this.player.inv = Math.max(this.player.inv, 60);
    audio.playMusic(this.lv.music);
  }

  readControls() {
    const c = this.ctl;
    if (this.host.demo) {
      // simple attract-mode pilot: shadow the nearest target, sidestep bullets, keep tapping
      const p = this.player;
      let tx = 160, ty = 200;
      const tgt = this.nearestEnemy(p.x, p.y - 60);
      if (tgt) tx = tgt.x;
      if (this.boss && this.boss.state === 'fight') { const bt = this.bossTarget(); if (bt) tx = bt[0]; }
      for (const b of this.eb.list) if (Math.abs(b.x - p.x) < 18 && b.y < p.y && p.y - b.y < 60) tx = p.x + (b.x < p.x ? 40 : -40);
      if (this.sc.rectSolid(p.x - 8, p.y - 40, 16, 30)) tx = p.x < 160 ? p.x + 30 : p.x - 30;
      c.left = tx < p.x - 4; c.right = tx > p.x + 4; c.up = ty < p.y - 4; c.down = ty > p.y + 4;
      this.demoFire++;
      c.fire = true; c.firePressed = this.demoFire % 5 === 0; c.zap = false; c.dive = false;
      return;
    }
    c.up = input.h('up'); c.down = input.h('down'); c.left = input.h('left'); c.right = input.h('right');
    c.fire = input.h('fire'); c.firePressed = input.p('fire'); c.zap = input.p('zap'); c.dive = input.p('dive');
  }

  debugKeys() {
    for (const k of input.keyQueue) {
      if (k === 'KeyH') this.showHit = !this.showHit;
      if (k === 'KeyI') { this.invincible = !this.invincible; this.say(this.invincible ? 'INVINCIBLE' : 'MORTAL', 40); }
      if (k === 'KeyM') { this.ps.cash += 5000; this.say('+5000 CASH', 40); }
      if (k === 'KeyK') for (const e of this.enemies.list) this.damageEnemy(e, 999);
      if (k === 'KeyO') this.goShop();
      if (k === 'KeyL') { this.state = 'defused'; this.stateT = 200; }
      if (k === 'KeyB' && !this.boss) this.jumpTo(this.lockY - 2);
      if (k === 'KeyG' && this.host.regen) { this.state = 'paused-shop'; this.host.regen(); return; }
      if (k === 'KeyV') this.showMap = !this.showMap;
      if (k === 'KeyN') { const n = this.lv.checkpoints[this.ps.checkpoint + 1]; if (n !== undefined && n < this.lockY) this.jumpTo(n); }
    }
  }
  jumpTo(y: number) {
    this.lv.spawns.forEach((sp, i) => { if (sp.at <= y) this.spawnState[i] = 2; });
    this.enemies.clear(); this.eb.clear(); this.waves.length = 0;
    this.sc.y = this.sc.oy = this.sc.maxY = y;
  }

  // ---------------------------------------------------------------- spawning
  checkSpawns(prev: number, cur: number) {
    if (cur <= prev) return;
    const sp = this.lv.spawns;
    for (let i = 0; i < sp.length; i++) {
      if (this.spawnState[i] === 0 && sp[i].at > prev && sp[i].at <= cur) this.trigger(i, sp[i]);
    }
  }
  trigger(i: number, sp: SpawnDef) {
    switch (sp.kind) {
      case 'wave': this.waves.push({ sp, left: sp.n ?? 1, timer: 0, k: 0 }); this.spawnState[i] = 2; break;
      case 'one': this.spawnWaveMember(sp, 0); this.spawnState[i] = 2; break;
      case 'cap': {
        const e = this.spawnEnemy('capsule', sp.x, -12, 'down', { s: 0.5 }, false);
        e.token = sp.token ?? randomCapsuleToken();
        this.spawnState[i] = 2;
        break;
      }
      case 'wall': {
        const y = H - ((sp.row ?? 0) * 16 + 8 - this.sc.y);
        const e = this.spawnEnemy(sp.type, sp.x, y, sp.pat ?? 'static', sp.p ?? {}, true);
        e.spawnIdx = i;
        this.spawnState[i] = 1;
        break;
      }
    }
  }
  updateWaves() {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wv = this.waves[i];
      if (--wv.timer > 0) continue;
      this.spawnWaveMember(wv.sp, wv.k++);
      wv.timer = wv.sp.gap ?? 14;
      if (--wv.left <= 0) this.waves.splice(i, 1);
    }
  }
  spawnWaveMember(sp: SpawnDef, k: number) {
    const pat = sp.pat ?? 'down';
    const p = { ...(sp.p ?? {}) };
    let x = sp.x + (p.dx ?? 0) * k, y = -14;
    if (pat === 'side') { const dir = p.dir ?? 1; x = dir > 0 ? -14 : W + 14; y = (p.y ?? 60) + (p.dy ?? 0) * k; }
    if (pat === 'rise') y = H + 14;
    if (p.alt) p.dir = (k % 2 ? -1 : 1) * (p.dir ?? 1);
    this.spawnEnemy(sp.type, x, y, pat, p, false);
  }
  spawnEnemy(type: string, x: number, y: number, pat: string, p: Record<string, number>, world: boolean): Enemy {
    const def = ENEMIES[type];
    const e = this.enemies.get();
    e.def = def; e.x = e.ox = e.x0 = x; e.y = e.oy = e.y0 = y; e.vx = 0; e.vy = 0;
    e.hp = def.hp * (this.host.diff === 2 ? 1.25 : 1) * (1 + 0.04 * this.lv.idx); e.t = 0; e.world = world || !!def.world; e.flash = 0; e.pat = pat; e.p = p;
    e.spawnIdx = -1; e.fireT = Math.floor(Math.random() * 40); e.state = 0; e.dir = p.dir ?? 1; e.token = undefined;
    if (def.segs) makeTrail(e);
    return e;
  }

  // ---------------------------------------------------------------- shots
  enemyShot(x: number, y: number, vx: number, vy: number, kind = 'eOrb') {
    if (this.eb.list.length > 260) return;
    const b = this.eb.get();
    b.x = b.ox = x; b.y = b.oy = y; b.vx = vx; b.vy = vy; b.spr = S[kind] ?? S.eOrb;
    b.dmg = BULLET_DMG[kind] ?? 9; b.r = Math.max(2, b.spr.width / 2 - 1); b.graze = 0;
  }
  private enemyFire(e: Enemy) {
    const f = e.def.fire!;
    const sp = f.speed * this.bulletMul;
    const kind = f.bullet ?? 'eOrb';
    const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    const at = (a: number) => this.enemyShot(e.x, e.y + 4, Math.cos(a) * sp, Math.sin(a) * sp, kind);
    switch (f.kind) {
      case 'aim': at(aim); break;
      case 'aim3': at(aim - 0.25); at(aim); at(aim + 0.25); break;
      case 'down': at(Math.PI / 2); break;
      case 'spread3': for (const o of [-0.35, 0, 0.35]) at(Math.PI / 2 + o); break;
      case 'spread5': for (const o of [-0.6, -0.3, 0, 0.3, 0.6]) at(Math.PI / 2 + o); break;
      case 'ring': for (let i = 0; i < 8; i++) at((i / 8) * Math.PI * 2 + e.t * 0.1); break;
    }
    audio.play('ebullet');
  }

  // ---------------------------------------------------------------- updates
  updatePlayerBullets() {
    for (const b of this.pb.list) {
      b.ox = b.x; b.oy = b.y;
      moveBullet(this, b);
      if (!b.alive) continue;
      if (--b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -40 || b.y > H + 20) { if (b.kind === 'mine') this.mineBlast(b); b.alive = false; continue; }
      if (b.kind !== 'mine' && this.sc.solid(b.x, b.y)) {
        b.alive = false;
        this.fx.spark(b.x, b.y);
        continue;
      }
      // vs enemies
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        if (!this.overlapEnemy(e, b.x, b.y, b.hw, b.hh)) continue;
        if (b.kind === 'mine') { this.mineBlast(b); break; }
        if (b.pierce > 0 && b.hits.includes(e)) continue;
        if (b.kind !== 'flame' && b.kind !== 'laser') this.fx.spark(b.x, b.y, e.world, e.def.armored ? 'metal' : 'flesh');
        const killed = this.damageEnemy(e, this.heatDmg(b.dmg));
        if (b.pierce > 0) {
          b.hits.push(e);
          if (b.kind === 'cannon' && !killed) { b.alive = false; break; }
          if (b.kind === 'cannon') b.pierce--;
          if (b.pierce <= 0) { b.alive = false; break; }
          continue;
        }
        b.alive = false;
        break;
      }
      if (!b.alive || !this.boss) continue;
      const hit = this.boss.hitTest(b.x, b.y, b.hw, b.hh);
      if (!hit) continue;
      if (b.kind === 'mine') { this.mineBlast(b); continue; }
      if (hit === 'body') { b.alive = false; this.fx.spark(b.x, b.y); continue; }
      if (b.pierce > 0 && b.hits.includes(hit)) continue;
      this.fx.spark(b.x, b.y, false, this.boss.vulnerable(hit) ? 'flesh' : 'metal');
      this.boss.damage(this, hit, this.heatDmg(b.dmg));
      if (b.pierce > 0 && b.kind !== 'cannon') { b.hits.push(hit); continue; }
      b.alive = false;
    }
  }
  mineBlast(b: PBullet) {
    if (!b.alive) return;
    b.alive = false;
    this.fx.explode(b.x, b.y, 1);
    audio.play('expM', 0.7);
    for (const e of this.enemies.list) if (Math.hypot(e.x - b.x, e.y - b.y) < 32) this.damageEnemy(e, this.heatDmg(b.dmg));
    if (this.boss) for (const p of this.boss.parts) if (!p.dead && Math.hypot(this.boss.px(p) - b.x, this.boss.py(p) - b.y) < 36) this.boss.damage(this, p, this.heatDmg(b.dmg * 0.6));
  }

  overlapEnemy(e: Enemy, x: number, y: number, hw: number, hh: number) {
    const d = e.def;
    if (Math.abs(e.x - x) < d.w / 2 + hw && Math.abs(e.y - y) < d.h / 2 + hh) return true;
    if (d.segs) {
      for (let i = 1; i <= d.segs; i++) {
        const s = e.trail[i * 7];
        if (s && Math.abs(s.x - x) < 6 + hw && Math.abs(s.y - y) < 6 + hh) return true;
      }
    }
    return false;
  }

  updateEnemies() {
    const p = this.player;
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      e.ox = e.x; e.oy = e.y;
      if (e.world) e.oy -= this.scrollDelta; // so interpolation includes scroll
      e.t++;
      if (e.flash > 0) e.flash--;
      (PATTERNS[e.pat] ?? PATTERNS.down)(e, this);
      if (e.def.segs) { e.trail.unshift({ x: e.x, y: e.y }); e.trail.pop(); }
      // spawners (egg sacs, swarm queens) release minions
      const spn = e.def.spawner;
      if (spn && e.t % Math.round(spn.every * this.fireMul) === Math.round(spn.every / 2) && e.y > 0 && e.y < 200 && this.enemies.list.length < 30)
        this.spawnEnemy(spn.type, e.x, e.y, spn.pat, { s: 1.6, life: 200 }, false);
      // laser gates: emitters fire a beam across when paired
      if (e.def.fire && e.y > 4 && e.y < H - 50 && !p.dead) {
        e.fireT++;
        const every = e.def.fire.every * this.fireMul;
        if (e.fireT >= every && e.t > (e.def.fire.delay ?? 20)) { e.fireT = 0; this.enemyFire(e); }
      }
      // remove when off-screen
      if (e.world) {
        if (e.y > H + 40) { e.alive = false; if (e.spawnIdx >= 0) this.spawnState[e.spawnIdx] = 2; }
        else if (e.y < -60 && this.scrollDelta < 0) { e.alive = false; if (e.spawnIdx >= 0) this.spawnState[e.spawnIdx] = 0; }
      } else if (e.t > 40 && (e.y > H + 30 || e.y < -50 || e.x < -50 || e.x > W + 50)) e.alive = false;
    }
    this.updateGates();
  }
  /** Laser gates: pairs of 'gate' emitters on the same row connected by a pulsing beam. */
  gateBeams: { x0: number; x1: number; y: number; on: boolean }[] = [];
  updateGates() {
    this.gateBeams.length = 0;
    const gates = this.enemies.list.filter((e) => e.alive && e.def.name === 'gate');
    for (const a of gates) {
      if (a.x > 160) continue;
      const b = gates.find((g) => g !== a && g.x > 160 && Math.abs(g.y - a.y) < 4);
      if (!b) continue;
      const on = (this.t + a.spawnIdx * 37) % 150 < 80;
      this.gateBeams.push({ x0: a.x + 8, x1: b.x - 8, y: a.y, on });
      const p = this.player;
      if (on && p.dive === 0 && Math.abs(p.y - a.y) < 6 && p.x > a.x && p.x < b.x) this.hurtPlayer(1.5);
    }
  }

  damageEnemy(e: Enemy, dmg: number): boolean {
    if (!e.alive) return false;
    e.hp -= dmg;
    e.flash = 2;
    if (e.hp > 0) { audio.play(e.def.armored ? 'ping' : 'hit', 0.5); return false; }
    e.alive = false;
    const d = e.def;
    this.fx.explode(e.x, e.y, d.expl, e.world);
    audio.play(d.expl === 2 ? 'expL' : d.expl === 1 ? 'expM' : 'expS', d.expl ? 0.8 : 0.6);
    if (d.segs) for (let i = 1; i <= d.segs; i++) { const s = e.trail[i * 7]; this.fx.explode(s.x, s.y, 0, false, i * 3); }
    // combo system: kills within 60 ticks chain together
    this.comboTimer = 60;
    this.combo++;
    this.stats.kills++;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    const milestones = [5, 8, 12, 16, 20, 25, 30, 40];
    if (milestones.includes(this.combo)) {
      this.fx.floatText(e.x, e.y - 16, comboWord(this.combo), this.combo >= 12 ? 'purple' : 'gold');
      this.radio(comboLine(this.combo));
      this.addSauce(6 + Math.floor(this.combo / 4));
    }
    this.addSauce(1);
    this.addScore(d.score);
    if (!d.noCash) this.dropCash(e.x, e.y, d.cash, d.expl === 2 ? 6 : 4);
    if (e.token) this.dropToken(e.x, e.y, e.token as TokenType);
    if (d.name === 'sporepod') for (let i = 0; i < 4; i++) this.spawnEnemy('spore', e.x, e.y, 'chase', { s: 0.8, life: 300 }, false);
    if (d.splitInto) for (let i = 0; i < d.splitInto.n; i++) {
      const c = this.spawnEnemy(d.splitInto.type, e.x + (i - 1) * 8, e.y, 'chase', { s: 1.3, life: 260 }, false);
      c.vx = (i - 1) * 1.5; c.vy = -1;
    }
    if (e.spawnIdx >= 0) this.spawnState[e.spawnIdx] = 2;
    return true;
  }

  updateEnemyBullets() {
    const p = this.player;
    for (const b of this.eb.list) {
      b.ox = b.x; b.oy = b.y;
      b.x += b.vx; b.y += b.vy;
      if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) { b.alive = false; continue; }
      if (this.sc.solid(b.x, b.y)) { b.alive = false; continue; }
      for (const s of this.player.sats) {
        if (Math.abs(s.x - b.x) < 7 && Math.abs(s.y - b.y) < 7) { b.alive = false; this.fx.spark(b.x, b.y); break; }
      }
      // grazing: bullet passed close but didn't hit — reward aggressive dodging.
      // Awarded when the bullet leaves the graze zone still alive, so bullets that go on to hit don't count.
      if (b.alive && b.graze < 2 && !this.host.demo) {
        const dx = Math.abs(p.x - b.x), dy = Math.abs(p.y - b.y);
        const near = dx < b.r + 12 && dy < b.r + 14;
        if (near && b.graze === 0) b.graze = 1;
        else if (!near && b.graze === 1) {
          b.graze = 2;
          if (!p.dead && p.dive === 0 && p.inv <= 0 && this.state === 'play') {
            this.addScore(50);
            this.stats.grazes++;
            this.earn(5);
            this.addSauce(5);
            if (this.stats.grazes % 4 === 0) this.fx.floatText(p.x, p.y - 24, grazePop(this.stats.grazes), 'purple');
            if (this.stats.grazes % 8 === 0) this.radio(grazeLine());
          }
        }
      }
    }
  }

  updatePickups() {
    const p = this.player;
    const mag = this.player.lv('magnet');
    for (const k of this.pickups.list) {
      k.ox = k.x; k.oy = k.y;
      if (k.kind === 'cash') k.oy -= this.scrollDelta;
      k.t++;
      if (k.kind === 'cash') {
        k.vx *= 0.94; k.vy *= 0.94;
        k.x += k.vx + Math.sin(k.t * 0.07 + k.val) * 0.15; k.y += k.vy;
      } else {
        k.x += k.vx; k.y += 0.45;
        if (k.x < 12 || k.x > W - 12) k.vx = -k.vx;
      }
      if (mag && !p.dead) {
        const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
        if (d < (mag === 1 ? 70 : 140) && d > 1) { k.x += (dx / d) * 2.2; k.y += (dy / d) * 2.2; }
      }
      if (k.t > k.life || k.y > H + 20 || k.y < -60) { k.alive = false; continue; }
      if (!p.dead && Math.abs(p.x - k.x) < 14 && Math.abs(p.y - k.y) < 15) { k.alive = false; this.collect(k); }
    }
  }
  dropCash(x: number, y: number, amount: number, maxN = 4) {
    amount = Math.round((amount * (1 + 0.06 * this.lv.idx)) / 5) * 5; // later shops stay meaningful
    if (this.combo >= 5) amount = Math.round(amount * (this.combo >= 10 ? 1.5 : 1.25) / 5) * 5; // combo cash bonus
    const sizes = [100, 50, 25, 10, 5];
    let n = 0;
    while (amount >= 5 && n < maxN) {
      const v = n === maxN - 1 ? amount : sizes.find((s) => s <= amount)!;
      const k = this.pickups.get();
      k.kind = 'cash'; k.val = v; k.x = k.ox = x + rnd(-6, 6); k.y = k.oy = y + rnd(-6, 6);
      k.vx = rnd(-1.2, 1.2); k.vy = rnd(-1.2, 1.0); k.t = 0; k.life = 600;
      amount -= v; n++;
    }
  }
  dropToken(x: number, y: number, tok: TokenType) {
    const k = this.pickups.get();
    k.kind = 'token'; k.tok = tok; k.val = 0; k.x = k.ox = x; k.y = k.oy = y; k.vx = rnd(-0.6, 0.6) || 0.4; k.vy = 0; k.t = 0; k.life = 750;
  }
  /** add cash to the player and count it towards the level stats */
  earn(n: number) { this.ps.cash += n; if (!this.host.demo) this.stats.cashEarned += n; }
  collect(k: Pickup) {
    const ps = this.ps, p = this.player;
    if (k.kind === 'cash') {
      this.earn(k.val);
      audio.play('cash');
      this.fx.floatText(k.x, k.y - 8, '$' + k.val, 'green');
      return;
    }
    audio.play('token');
    const lbl = (s: string) => this.fx.floatText(p.x, p.y - 22, s, 'gold');
    switch (k.tok) {
      case 'P': if (ps.load.power < 5) { ps.load.power++; lbl('POWER UP'); } else { this.earn(300); lbl('$300'); } break;
      case 'S': if (ps.load.speed < 3) { ps.load.speed++; lbl('SPEED UP'); } else { this.addScore(2000); lbl('2000'); } break;
      case 'H': ps.shield = Math.min(ps.maxShield(), ps.shield + 40); lbl('SHIELD'); break;
      case '$': this.earn(250); lbl('$250'); break;
      case 'Z': ps.load.zapper = Math.min(5, ps.load.zapper + 1); lbl('ZAPPER'); break;
      case 'D': ps.load.dive = Math.min(5, ps.load.dive + 1); lbl('DIVE'); break;
      case 'X': p.superT = 500; lbl('SUPER POWER!'); this.say('SUPER POWER', 70, 'cyan'); this.radio(superLine(), true); break;
      case '1': ps.lives++; lbl('1 UP'); audio.play('oneup'); break;
    }
  }

  addScore(n: number) {
    if (this.host.demo) return;
    const mul = this.combo >= 10 ? 3 : this.combo >= 5 ? 2 : this.combo >= 3 ? 1.5 : 1;
    this.ps.score += Math.round(n * mul);
  }

  nearestEnemy(x: number, y: number): Enemy | null {
    let best: Enemy | null = null, bd = 1e9;
    for (const e of this.enemies.list) {
      if (!e.alive || e.y < -10 || e.y > H || e.def.name === 'capsule') continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  bossTarget(): [number, number] | null {
    const b = this.boss;
    if (!b || b.state !== 'fight') return null;
    const p = b.parts.find((pp) => b.vulnerable(pp));
    return p ? [b.px(p), b.py(p)] : null;
  }

  // ---------------------------------------------------------------- player damage
  playerVulnerable() {
    const p = this.player;
    return !p.dead && p.inv <= 0 && p.dive === 0 && !this.invincible && !this.host.demo && this.state === 'play';
  }
  hurtPlayer(amount: number) {
    if (!this.playerVulnerable()) return;
    const ps = this.ps;
    const hit = amount * this.dmgMul;
    if (ps.shield - hit <= 0) { if (!this.trySauceSave()) this.killPlayer(); return; }
    ps.shield -= hit;
    if (this.sauceBurst <= 0) this.sauce = Math.max(0, this.sauce - 16);
    if (!this.shieldWarned && ps.shield / ps.maxShield() < 0.28) { this.shieldWarned = true; this.radio(lowShieldLine(), true); }
    if (amount >= 3) this.hurtT = 16;
    if (amount >= 3 || this.player.hitFlash === 0) { this.player.hitFlash = 8; if (amount >= 3) audio.play('hurt'); }
  }
  crushPlayer() {
    if (!this.playerVulnerable()) return;
    this.ps.shield -= 1.2 * this.dmgMul;
    this.player.hitFlash = 4;
    this.hurtT = Math.max(this.hurtT, 8);
    if (this.t % 10 === 0) audio.play('hurt', 0.5);
    if (this.ps.shield <= 0) { if (!this.trySauceSave()) { this.ps.shield = 0; this.killPlayer(); } }
  }
  killPlayer() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    this.state = 'dying'; this.stateT = 0;
    this.sauceBurst = 0;
    this.say(deathBig(), 120, 'red');
    this.radio(deathLine(), true);
    this.fx.explode(p.x, p.y, 2);
    for (let i = 0; i < 5; i++) this.fx.explode(p.x + rnd(-14, 14), p.y + rnd(-14, 14), 1, false, 6 + i * 6);
    audio.play('die');
    // death chain reaction: nearby enemy bullets explode, clearing some space
    for (const b of this.eb.list) {
      if (!b.alive) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < 80) { b.alive = false; this.fx.explode(b.x, b.y, 0, false, Math.round(d / 8)); }
    }
  }

  collidePlayer() {
    const p = this.player;
    if (p.dead) return;
    // enemy bullets
    if (this.playerVulnerable()) {
      for (const b of this.eb.list) {
        if (!b.alive) continue;
        if (Math.abs(b.x - p.x) < b.r + 4 && Math.abs(b.y - p.y) < b.r + 6) {
          b.alive = false;
          this.fx.spark(b.x, b.y);
          this.hurtPlayer(b.dmg);
        }
      }
    }
    // body contact with enemies; satellites hurt enemies
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      for (const s of p.sats) if (s.kind === 'ball' && this.overlapEnemy(e, s.x, s.y, 6, 6) && this.t % 4 === 0) this.damageEnemy(e, this.heatDmg(0.8));
      if (!e.alive || e.def.name === 'capsule') continue;
      if (p.dive === 0 && this.overlapEnemy(e, p.x, p.y, 6, 7)) {
        if (p.contactCd <= 0) { this.hurtPlayer(e.def.touchDmg ?? 14); p.contactCd = 25; }
        if (!e.world) this.damageEnemy(e, 2);
      }
    }
    // boss hull pushes and hurts
    if (this.boss && this.boss.state === 'fight' && p.dive === 0) {
      const [bx, by, bw, bh] = this.boss.bodyRect();
      if (p.x > bx - 6 && p.x < bx + bw + 6 && p.y > by - 7 && p.y < by + bh + 7) {
        p.y = Math.min(246, by + bh + 8);
        if (p.contactCd <= 0) { this.hurtPlayer(10); p.contactCd = 25; }
      }
    }
  }

  zap() {
    this.ps.load.zapper--;
    this.zapFlash = 12;
    this.fx.shake = 10;
    audio.play('zap');
    for (const b of this.eb.list) { b.alive = false; this.fx.spark(b.x, b.y); }
    for (const e of this.enemies.list) if (e.y > -10 && e.y < H + 10) this.damageEnemy(e, this.heatDmg(25));
    if (this.boss && this.boss.state === 'fight') for (const p of this.boss.parts) if (this.boss.vulnerable(p)) this.boss.damage(this, p, this.heatDmg(14));
    this.radio(zapLine(), true);
  }

  // ---------------------------------------------------------------- bosses
  startBoss() {
    const lv = this.lv;
    const mid = !!(lv.midBoss && !this.ps.midDone);
    const key = mid ? lv.midBoss!.boss : lv.endBoss.boss;
    this.boss = new Boss(key, [0.7, 1, 1.35][this.host.diff]);
    this.bossKind = mid ? 'mid' : 'end';
    this.bossIntroT = 180;
    this.bossQuip = bossIntro(this.boss.def.name);
    audio.play('alarm');
    audio.playMusic('boss');
  }
  updateBoss() {
    const b = this.boss!;
    b.update(this);
    if (b.state === 'dead') {
      if (this.bossKind === 'mid') {
        this.hitStop = 5; // dramatic freeze on boss kill
        audio.setBassIntensity(0);
        this.ps.midDone = true;
        this.boss = null;
        this.updateLock();
        this.say('MID GUARDIAN DESTROYED', 100, 'cyan');
        this.radio(midDeadLine(), true);
        this.shopPending = 110;
      } else if (this.state === 'play') {
        this.hitStop = 5;
        audio.setBassIntensity(0);
        this.state = 'defused'; this.stateT = 0;
        this.defusedQuip = defusedLine();
        this.boss = null;
        audio.play('oneup');
        audio.playMusic('ending');
      }
    }
  }

  // ---------------------------------------------------------------- render
  render(ctx: Ctx, a: number) {
    const sh = this.fx.shake;
    ctx.save();
    if (sh > 0) ctx.translate(snap(rnd(-sh, sh)), snap(rnd(-sh, sh)));
    this.sc.drawBg(ctx, a, this.t);
    this.drawAmbient(ctx, a);
    // shadows fall on the background, under the scenery
    this.sc.drawShadow(ctx, a);
    this.drawShadows(ctx, a);
    if (this.player.dive > 0) this.player.draw(ctx, a, this);
    this.sc.drawFg(ctx, a);
    this.sc.drawLights(ctx, a, this.t);
    // laser gate beams
    for (const g of this.gateBeams) {
      if (g.on) { ctx.fillStyle = this.t % 4 < 2 ? '#88eeff' : '#ffffff'; ctx.fillRect(g.x0, g.y - 2, g.x1 - g.x0, 4); }
      else if (this.t % 6 < 2) { ctx.fillStyle = 'rgba(120,200,255,0.5)'; ctx.fillRect(g.x0, g.y, g.x1 - g.x0, 1); }
    }
    for (const k of this.pickups.list) this.drawPickup(ctx, k, a);
    for (const e of this.enemies.list) if (e.world) this.drawEnemy(ctx, e, a);
    if (this.boss) this.boss.draw(ctx, a, this);
    for (const e of this.enemies.list) if (!e.world) this.drawEnemy(ctx, e, a);
    for (const b of this.pb.list) {
      const x = b.ox + (b.x - b.ox) * a, y = b.oy + (b.y - b.oy) * a;
      if (b.kind === 'homing' || (b.kind === 'bolt' && b.ang !== 0 && b.spr !== S.side && b.spr.width < b.spr.height)) {
        ctx.save(); ctx.translate(snap(x), snap(y)); ctx.rotate(b.ang); ctx.drawImage(b.spr, -(b.spr.width >> 1), -(b.spr.height >> 1)); ctx.restore();
      } else ctx.drawImage(b.spr, snap(x - b.spr.width / 2), snap(y - b.spr.height / 2));
    }
    if (this.player.dive === 0) this.player.draw(ctx, a, this);
    for (const b of this.eb.list) {
      const x = b.ox + (b.x - b.ox) * a, y = b.oy + (b.y - b.oy) * a;
      ctx.drawImage(b.spr, snap(x - b.spr.width / 2), snap(y - b.spr.height / 2));
    }
    this.fx.draw(ctx, a);
    ctx.globalCompositeOperation = 'lighter';
    this.drawSceneLighting(ctx, a);
    this.drawAtmosphere(ctx, a);
    this.drawGlow(ctx, a);
    this.fx.drawGlow(ctx, a);
    ctx.globalCompositeOperation = 'source-over';
    this.sc.drawFore(ctx, a);
    if (this.showHit) this.drawHitboxes(ctx);
    ctx.restore();
    this.setPostFx(a);
    ctx.drawImage(darkVignette(), -VIEW.ox, 0);
    const wf = Math.max(this.zapFlash / 14, this.fx.flash);
    if (wf > 0) fillView(ctx, `rgba(255,255,255,${wf})`);
    if (this.bossIntroT > 0) this.drawBossIntro(ctx);
    if (this.hurtT > 0) { ctx.globalAlpha = Math.min(1, this.hurtT / 12); ctx.drawImage(vignette(), -VIEW.ox, 0); ctx.globalAlpha = 1; }
    if (this.sauceFlash > 0) fillView(ctx, `rgba(255,30,80,${Math.min(0.45, this.sauceFlash / 30)})`);
    if (this.sauceBurst > 0) {
      ctx.save();
      ctx.strokeStyle = this.t % 8 < 4 ? '#ff2266' : '#ffaa44';
      ctx.lineWidth = 2;
      ctx.strokeRect(2 - VIEW.ox, 2, VIEW.w - 4, H - 18);
      ctx.restore();
    }
    if (this.player.crushing && this.t % 10 < 6) {
      const st = hazardStripes(), o = -(this.t % 16) - VIEW.ox;
      ctx.drawImage(st, o, 0);
      text(ctx, 'CRUSH WARNING', 160, 12, 'red', 1, 0.5);
    }
    this.drawHud(ctx);
  }

  /**
   * Dynamic lighting: light sources (explosions, the ship's engines, heavy shots, enemy bullets, beams) are drawn
   * into an offscreen buffer, masked to the scenery pixels, and added on top — so walls light up around them.
   */
  /** Feed the WebGL post pass: shockwave refraction rings, chromatic aberration on damage, bloom surges. */
  setPostFx(a: number) {
    postFx.waves = this.fx.waves(a).map((w) => ({ ...w, x: w.x + VIEW.ox }));
    postFx.aberr = Math.max(this.hurtT > 0 ? this.hurtT * 0.35 : 0, this.fx.shake * 0.5, this.sauceBurst > 0 ? 1.2 : 0);
    postFx.bloomBoost = 1 + Math.min(0.8, this.fx.flash * 1.5 + this.zapFlash / 20);
  }

  private lightBuf: [HTMLCanvasElement, Ctx] | null = null;
  drawSceneLighting(ctx: Ctx, a: number) {
    if (!this.lightBuf || this.lightBuf[0].width !== VIEW.w) this.lightBuf = hiCanvas(VIEW.w, H);
    const [lc, lx] = this.lightBuf;
    lx.setTransform(RES, 0, 0, RES, 0, 0);
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, VIEW.w, H);
    lx.translate(VIEW.ox, 0);
    const L = (x: number, y: number, r: number, c: string, s = 1) => {
      const g = glow(Math.round(r / 4) * 4, c, s);
      lx.drawImage(g, snap(x - g.width / 2), snap(y - g.height / 2));
    };
    const p = this.player;
    if (!p.dead && p.dive === 0) {
      const x = p.ox + (p.x - p.ox) * a, y = p.oy + (p.y - p.oy) * a;
      L(x, y + 14, 44, '#ff9944', 0.9);
      if (p.muzzle > 0) L(x, y - 20, 40, '#ffeeaa', 1.2);
    }
    for (const b of this.pb.list) {
      if (b.kind === 'cannon' || b.kind === 'laser' || b.kind === 'flame') {
        L(b.x, b.y, b.kind === 'flame' ? 20 : 28, b.kind === 'laser' ? '#33bbff' : '#ff8833', 0.8);
      }
    }
    for (let i = 0; i < this.eb.list.length; i += 2) { const b = this.eb.list[i]; L(b.x, b.y, 20, b.spr === S.eSpore ? '#55ff33' : b.spr === S.ePlasma ? '#bb44ff' : '#ff4422', 0.7); }
    if (this.boss) for (const pp of this.boss.parts) {
      if (pp.beam > 0 && pp.beam < 50) for (let y = this.boss.py(pp); y < H; y += 30) L(this.boss.px(pp), y, 44, '#55ccff', 1.2);
      if (pp.dead && this.boss.state === 'fight') L(this.boss.px(pp), this.boss.py(pp), 28, '#ff6622', 0.6 + ((this.t >> 2) & 1) * 0.2);
    }
    for (const g of this.gateBeams) if (g.on) for (let x = g.x0; x < g.x1; x += 30) L(x, g.y, 36, '#44ccff', 1);
    this.fx.drawSceneLight(lx, a);
    // keep only the light that falls on scenery
    lx.globalCompositeOperation = 'destination-in';
    this.sc.drawFg(lx, a);
    ctx.drawImage(lc, -VIEW.ox, 0);
  }

  /** Per-theme atmosphere: light shafts from above, rising heat, or sweeping searchlights (additive). */
  drawAtmosphere(ctx: Ctx, a: number) {
    const th = this.lv.theme, t = this.t;
    switch (th.tex) {
      case 'coral': case 'vine': case 'crystal': case 'bone': {
        const col = th.tex === 'coral' ? '#66ccff' : th.tex === 'vine' ? '#ccff66' : th.tex === 'crystal' ? '#88ffff' : '#ffeecc';
        const s = lightShafts(col, th.tex.length);
        ctx.globalAlpha = 0.55 + Math.sin(t * 0.013) * 0.25;
        ctx.drawImage(s, snap(-40 - MARGIN + Math.sin(t * 0.004) * 30), 0);
        ctx.globalAlpha = 1;
        break;
      }
      case 'lava': {
        // heat glow rising from below, pulsing
        const k = 0.5 + Math.sin(t * 0.05) * 0.2;
        ctx.globalAlpha = k;
        for (let x = 20 - Math.ceil(VIEW.ox / 56) * 56; x < W + VIEW.ox; x += 56) {
          const g = glow(48, '#ff4400', 1);
          ctx.drawImage(g, x - 48 + snap(Math.sin(t * 0.02 + x) * 8), H - 40);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'metal': case 'biomech': {
        const cone = searchCone();
        const cones: [number, number][] = [[30, 0], [290, 2.4]];
        if (VIEW.ox > 60) cones.push([-VIEW.ox + 40, 1.3], [W + VIEW.ox - 40, 3.7]);
        for (const [ox, ph] of cones) {
          ctx.save();
          ctx.translate(ox, -6);
          ctx.rotate(Math.sin(t * 0.012 + ph) * 0.55);
          ctx.globalAlpha = th.tex === 'metal' ? 0.9 : 0.6;
          ctx.drawImage(cone, -60, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
    }
    void a;
  }

  /** Boss arrival: letterbox bars slide in with hazard stripes, WARNING, and the guardian's name. */
  bossIntroT = 0;
  drawBossIntro(ctx: Ctx) {
    const t = 180 - this.bossIntroT;
    const k = Math.min(1, t / 20, this.bossIntroT / 20);
    const bar = Math.round(20 * k);
    fillView(ctx, '#000', 0, bar); fillView(ctx, '#000', H - 14 - bar, bar);
    const st = hazardStripes(), o = -((t * 2) % 16) - VIEW.ox;
    if (bar > 8) { ctx.drawImage(st, o, bar - 8); ctx.drawImage(st, o - 8, H - 14 - bar); }
    if (k >= 1) {
      if (t % 24 < 16) text(ctx, 'WARNING', 160, 92, 'red', 3, 0.5);
      const name = this.boss?.def.name ?? '';
      const shown = name.slice(0, Math.max(0, Math.floor((t - 30) / 3)));
      text(ctx, shown, 160, 126, 'chrome', name.length > 13 ? 1 : 2, 0.5);
      text(ctx, this.bossKind === 'mid' ? 'MID GUARDIAN APPROACHING' : 'BOMB GUARDIAN APPROACHING', 160, 148, 'gold', 1, 0.5);
      if (t > 46 && this.bossQuip) wrap(this.bossQuip, 42).slice(0, 2).forEach((l, i) => text(ctx, l, 160, 162 + i * 9, 'purple', 1, 0.5));
    }
  }

  enemySprite(e: Enemy): Spr {
    const d = e.def;
    if (d.name === 'capsule') return S.capsule;
    return d.frames[d.anim ? Math.floor(e.t / d.anim) % d.frames.length : 0];
  }

  /** Drop shadows of flying objects onto the background (offset grows with "height"). */
  drawShadows(ctx: Ctx, a: number) {
    const put = (s: Spr, x: number, y: number) => { const sh = shadowOf(s); ctx.drawImage(sh, snap(x - s.width / 2), snap(y - s.height / 2)); };
    if (this.boss) {
      const b = this.boss, x = b.ox + (b.x - b.ox) * a, y = b.oy + (b.y - b.oy) * a;
      put(b.body, x + 14, y + 20);
    }
    for (const e of this.enemies.list) {
      if (e.world) continue;
      const x = e.ox + (e.x - e.ox) * a, y = e.oy + (e.y - e.oy) * a;
      if (e.def.segs && e.def.segSpr) for (let i = 1; i <= e.def.segs; i++) { const s = e.trail[i * 7]; put(e.def.segSpr, s.x + 7, s.y + 10); }
      put(this.enemySprite(e), x + 7, y + 10);
    }
    const p = this.player;
    if (!p.dead && p.dive === 0) {
      const x = p.ox + (p.x - p.ox) * a, y = p.oy + (p.y - p.oy) * a;
      put(p.frame(), x + 10, y + 14);
    }
  }

  /** Additive light pass: bullets, engines, satellites, tokens, boss cores, gate beams. */
  drawGlow(ctx: Ctx, a: number) {
    const g = (x: number, y: number, r: number, c: string, s = 1) => drawGlow(ctx, x, y, r, c, s);
    for (const b of this.pb.list) {
      const x = b.ox + (b.x - b.ox) * a, y = b.oy + (b.y - b.oy) * a;
      switch (b.kind) {
        case 'laser': g(x, y, 6, '#22aaff'); g(x, y - b.hh, 5, '#22aaff'); break;
        case 'cannon': g(x, y, 10, '#ff8822'); break;
        case 'homing': g(x - b.vx * 2, y - b.vy * 2, 4, '#ff5522'); break;
        case 'flame': g(x, y, b.hw + 3, '#ff6611', 0.75); break;
        case 'mine': if (b.t % 20 < 8) g(x, y, 5, '#ff2222'); break;
        default: {
          const c = this.sauceBurst > 0 ? '#ff3377' : b.spr === S.spread ? '#bb55ff' : b.spr === S.side || b.spr === S.rear ? '#44ff55' : b.spr === S.twist || b.spr === S.droneShot ? '#33ddff' : '#ffbb33';
          g(x, y, 5, c, 0.8); g(x - b.vx, y - b.vy, 3, c, 0.6);
        }
      }
    }
    const pulse = (this.t >> 2) & 1;
    for (const b of this.eb.list) {
      const x = b.ox + (b.x - b.ox) * a, y = b.oy + (b.y - b.oy) * a;
      const c = b.spr === S.eSpore ? '#55ff33' : b.spr === S.ePlasma ? '#cc44ff' : b.spr === S.eBig ? '#ffaa22' : '#ff3322';
      g(x, y, b.r + 4 + pulse, c);
    }
    const p = this.player;
    if (!p.dead && p.dive === 0 && (p.inv <= 0 || p.inv % 4 >= 2 || p.inv >= 60)) {
      const x = p.ox + (p.x - p.ox) * a, y = p.oy + (p.y - p.oy) * a, bo = p.bank * 1.2;
      const er = 6 + p.lv('speed') + ((this.t >> 1) & 1);
      const flame = this.sauceBurst > 0 ? '#ff2266' : '#ff7722';
      g(x - 6 + bo, y + 17, er + (this.sauceBurst > 0 ? 3 : 0), flame);
      g(x + 6 + bo, y + 17, er + (this.sauceBurst > 0 ? 3 : 0), flame);
      if (this.sauceBurst > 0) g(x, y - 4, 18, '#ff3377', 0.65);
      if (p.lv('flamer')) g(x, y - 23, p.firing ? 5 : 3, p.firing ? '#ffaa22' : '#3388ff');
    }
    for (const s of p.sats) g(s.x, s.y, s.kind === 'ball' ? 10 : 6, s.kind === 'ball' ? '#33ccff' : '#ff3333', 0.8);
    for (const k of this.pickups.list) {
      const x = k.ox + (k.x - k.ox) * a, y = k.oy + (k.y - k.oy) * a;
      if (k.kind === 'token') g(x, y, 12 + pulse, TOKEN_GLOW[k.tok] ?? '#ffffff', 0.9);
      else if (k.val >= 25) g(x, y, 6, '#88ff66', 0.5);
    }
    const bs = this.boss;
    if (bs && bs.state === 'fight') for (const pp of bs.parts) {
      if (pp.dead) continue;
      const x = bs.ox + (bs.x - bs.ox) * a + pp.def.x, y = bs.oy + (bs.y - bs.oy) * a + pp.def.y;
      if (pp.def.core && bs.vulnerable(pp)) g(x, y, 18 + Math.sin(this.t * 0.2) * 4, '#ff3322', 0.9);
      if (pp.beam > 0 && pp.beam < 50) for (let yy = y; yy < H; yy += 14) g(x, yy, 12, '#44bbff');
    }
    for (const gb of this.gateBeams) if (gb.on) for (let x = gb.x0; x < gb.x1; x += 14) g(x, gb.y, 8, '#44ccff', 0.7);
  }

  drawAmbient(ctx: Ctx, a: number) {
    const th = this.lv.theme, s = this.sc.scrollAt(a);
    ctx.fillStyle = th.ambientColor;
    for (const p of this.ambient) {
      let y: number;
      if (th.ambient === 'bubbles' || th.ambient === 'embers') y = p.y - this.t * p.s * 0.6 + s * p.s;
      else y = p.y + s * p.s * (p.z === 2 ? 1.2 : 0.7) + this.t * 0.05;
      y = ((y % H) + H) % H;
      const x = p.x + (th.ambient === 'spores' || th.ambient === 'bubbles' ? Math.sin(this.t * 0.02 + p.y) * 3 : 0);
      if (x < -VIEW.ox - 2 || x > W + VIEW.ox) continue;
      const spr = ambientSprite(th.ambient, th.ambientColor, p.z === 2 ? 1 + (p.s > 0.45 ? 1 : 0) : 0);
      const glowy = th.ambient === 'spores' || th.ambient === 'embers';
      if (glowy) ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(spr, snap(x - spr.width / 2), snap(y - spr.height / 2));
      if (glowy) ctx.globalCompositeOperation = 'source-over';
    }
  }

  drawEnemy(ctx: Ctx, e: Enemy, a: number) {
    const d = e.def;
    const x = snap(e.ox + (e.x - e.ox) * a), y = snap(e.oy + (e.y - e.oy) * a);
    if (d.name === 'capsule') {
      const s = e.flash ? flashOf(S.capsule) : S.capsule;
      ctx.save(); ctx.translate(x, y); ctx.rotate(e.t * 0.05); ctx.drawImage(s, -9, -9); ctx.restore();
      return;
    }
    if (d.segs && d.segSpr) {
      for (let i = d.segs; i >= 1; i--) {
        const s = e.trail[i * 7];
        const sp = e.flash ? flashOf(d.segSpr) : d.segSpr;
        ctx.drawImage(sp, snap(s.x - sp.width / 2), snap(s.y - sp.height / 2));
      }
    }
    let spr = d.frames[d.anim ? Math.floor(e.t / d.anim) % d.frames.length : 0];
    if (e.flash) spr = flashOf(spr);
    if (d.face) {
      const vx = e.x - e.ox, vy = (e.y - e.oy);
      const ang = Math.atan2(-vx, vy);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.abs(vx) + Math.abs(vy) > 0.1 ? ang : 0); ctx.drawImage(spr, -(spr.width >> 1), -(spr.height >> 1)); ctx.restore();
    } else ctx.drawImage(spr, x - (spr.width >> 1), y - (spr.height >> 1));
    const tg = d.fire?.telegraph;
    if (tg && e.fireT >= d.fire!.every * this.fireMul - tg && e.y > 4 && e.y < H - 50 && !this.player.dead && this.t % 4 < 3) {
      // sniper telegraph: a flickering sight line to the ship
      const px = this.player.x, py = this.player.y, n = Math.hypot(px - x, py - y);
      ctx.fillStyle = '#ff2222';
      for (let s = 10; s < n; s += 4) ctx.fillRect(snap(x + ((px - x) * s) / n), snap(y + ((py - y) * s) / n), 1, 1);
    }
    if (d.name === 'eye') {
      // iris tracks the player
      const ang = Math.atan2(this.player.y - y, this.player.x - x);
      ctx.fillStyle = '#ffeecc'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cc2200'; ctx.fillRect(snap(x + Math.cos(ang) * 2.5 - 2), snap(y + Math.sin(ang) * 2.5 - 2), 4, 4);
      ctx.fillStyle = '#000'; ctx.fillRect(snap(x + Math.cos(ang) * 3 - 1), snap(y + Math.sin(ang) * 3 - 1), 2, 2);
    }
  }

  drawPickup(ctx: Ctx, k: Pickup, a: number) {
    if (k.life - k.t < 100 && k.t % 6 < 3) return;
    const x = snap(k.ox + (k.x - k.ox) * a), y = snap(k.oy + (k.y - k.oy) * a);
    if (k.kind === 'cash') {
      const s = k.val >= 100 ? S.cash100 : k.val >= 50 ? S.cash50 : k.val >= 25 ? S.cash25 : k.val >= 10 ? S.cash10 : S.cash5;
      ctx.drawImage(s, x - (s.width >> 1), y - (s.height >> 1));
    } else {
      const fr = SF['tok' + k.tok][(k.t >> 3) % 4];
      ctx.drawImage(fr, x - 9, y - 9);
      if ((k.t >> 3) % 4 === 0 || (k.t >> 3) % 4 === 3) text(ctx, k.tok, x - 2, y - 3, 'white');
    }
  }

  drawHitboxes(ctx: Ctx) {
    ctx.strokeStyle = '#0f0';
    const p = this.player;
    ctx.strokeRect(p.x - 6, p.y - 7, 12, 14);
    ctx.strokeStyle = '#f0f';
    for (const e of this.enemies.list) ctx.strokeRect(e.x - e.def.w / 2, e.y - e.def.h / 2, e.def.w, e.def.h);
    if (this.boss) {
      ctx.strokeStyle = '#ff0';
      const [bx, by, bw, bh] = this.boss.bodyRect(); ctx.strokeRect(bx, by, bw, bh);
      for (const pp of this.boss.parts) {
        ctx.strokeStyle = pp.dead ? '#444' : this.boss.vulnerable(pp) ? '#f00' : '#08f';
        ctx.strokeRect(this.boss.px(pp) - pp.def.w / 2, this.boss.py(pp) - pp.def.h / 2, pp.def.w, pp.def.h);
      }
    }
    ctx.strokeStyle = '#0ff';
    for (const b of this.eb.list) ctx.strokeRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }

  drawHud(ctx: Ctx) {
    const ps = this.ps;
    const pre = this.host.twoPlayer ? ps.id + 'UP ' : '';
    text(ctx, pre + String(ps.score).padStart(7, '0'), 4, 3, 'gold');
    text(ctx, 'HI ' + String(Math.max(this.host.hiScore(), ps.score)).padStart(7, '0'), 316, 3, 'metal', 1, 1);
    // bottom panel
    ctx.drawImage(panel(), -VIEW.ox, H - 14);
    const max = ps.maxShield();
    const f = Math.max(0, ps.shield / max);
    text(ctx, '@', 2, H - 11, 'cyan');
    // segmented shield gauge: 18 segments across the well, gloss on top
    const segs = 18, lit = Math.ceil(f * segs - 0.001);
    for (let i = 0; i < segs; i++) {
      const sx = 11 + i * 4;
      if (i >= lit) { ctx.fillStyle = '#1a1e30'; ctx.fillRect(sx, H - 10, 3, 6); continue; }
      const k = i / segs;
      let col = k < 0.25 ? '#ff3322' : k < 0.5 ? '#ffaa22' : '#44ee44';
      if (f < 0.25 && this.t % 10 < 5) col = '#ffffff';
      ctx.fillStyle = col; ctx.fillRect(sx, H - 10, 3, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(sx, H - 10, 3, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(sx, H - 5, 3, 1);
    }
    if (max > 100) text(ctx, '+' + (max - 100) / 25, 83, H - 11, 'grey', 1, 1);
    let x = 91;
    for (let i = 0; i < Math.min(ps.lives, 5); i++) { ctx.drawImage(S.shipIcon, x, H - 13); x += 11; }
    if (ps.lives > 5) text(ctx, '+' + (ps.lives - 5), x, H - 11, 'white');
    text(ctx, '$' + Math.round(this.dispCash), 187, H - 11, this.dispCash !== ps.cash ? 'gold' : 'green', 1, 0.5);
    let ix = 226;
    if (ps.load.zapper) { text(ctx, 'Z' + ps.load.zapper, ix, H - 11, 'purple'); ix += 20; }
    if (ps.load.dive) { text(ctx, 'D' + ps.load.dive, ix, H - 11, 'cyan'); }
    text(ctx, `L${this.lv.idx + 1}-${ps.checkpoint + 1}`, 317, H - 11, 'metal', 1, 1);
    // boss core health
    if (this.boss && this.boss.state === 'fight') {
      const alive = this.boss.parts.filter((p) => !p.dead);
      const tot = this.boss.parts.reduce((s, p) => s + p.max, 0), cur = alive.reduce((s, p) => s + Math.max(0, p.hp), 0);
      ctx.fillStyle = '#300'; ctx.fillRect(110, 13, 100, 3);
      ctx.fillStyle = '#f42'; ctx.fillRect(110, 13, snap((cur / tot) * 100), 3);
    }
    if (this.player.superT > 0) text(ctx, 'SUPER ' + Math.ceil(this.player.superT / 50), 160, 14, 'cyan', 1, 0.5);
    this.drawSauce(ctx);
    this.drawChatter(ctx);
    if (this.player.dive > 0) text(ctx, 'DIVING', 160, H - 22, 'cyan', 1, 0.5);
    // combo counter
    if (this.combo >= 3) {
      const big = this.combo >= 10;
      text(ctx, 'x' + this.combo, 160, big ? 24 : 26, big ? 'cyan' : 'gold', big ? 2 : 1, 0.5);
    }
    // spawn warnings: chevrons at screen edges for incoming side-entry enemies
    this.drawSpawnWarnings(ctx);
    // messages
    if (this.msgT > 0 && (this.msgStyle !== 'red' || this.msgT % 20 < 14)) text(ctx, this.msg, 160, 100, this.msgStyle, 2, 0.5);
    if (this.state === 'defused') this.drawDefused(ctx);
    if (this.host.debug) text(ctx, `DEBUG ${this.invincible ? 'INV ' : ''}Y${Math.round(this.sc.y)} E${this.enemies.list.length} B${this.eb.list.length}`, 4, 24, 'grey');
    const sl = this.host.seedLabel?.();
    if (sl && !this.host.demo) text(ctx, sl, 160, 3, 'grey', 1, 0.5);
    if (this.showMap) this.drawMinimap(ctx);
  }

  /** Debug minimap: whole level tile grid with spawns, checkpoints, boss arenas and the current view. */
  drawMinimap(ctx: Ctx) {
    const lv = this.lv, n = lv.rows.length, cw = 2, ch = Math.min(1, 236 / n);
    if (!this.mapCanvas) {
      const [c, x] = makeCanvas(20 * cw, n);
      for (let r = 0; r < n; r++) for (let col = 0; col < 20; col++) if (lv.rows[r][col]) { x.fillStyle = '#556'; x.fillRect(col * cw, n - 1 - r, cw, 1); }
      const KC: Record<string, string> = { wave: '#ff4444', one: '#ff9933', wall: '#ffff44', cap: '#44ffff' };
      for (const s of lv.spawns) {
        const row = s.kind === 'wall' ? s.row! : Math.round((s.at + H - 16) / 16);
        x.fillStyle = KC[s.kind]; x.fillRect(Math.max(0, Math.min(38, snap((s.x / 320) * 40))), n - 1 - row, 2, 1);
      }
      x.fillStyle = '#44ff44'; for (const cp of lv.checkpoints) x.fillRect(0, n - 1 - cp / 16, 40, 1);
      x.fillStyle = '#ff44ff';
      if (lv.midBoss) x.fillRect(0, n - 1 - lv.midBoss.at / 16 - 16, 40, 16);
      x.fillRect(0, n - 1 - lv.endBoss.at / 16 - 16, 40, 16);
      this.mapCanvas = c;
    }
    const h = Math.round(n * ch), x0 = 276, y0 = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x0 - 2, y0 - 2, 44, h + 4);
    ctx.globalAlpha = 0.85; ctx.drawImage(this.mapCanvas, x0, y0, 40, h); ctx.globalAlpha = 1;
    const vy = y0 + h - ((this.sc.y + H) / 16) * ch;
    ctx.strokeStyle = '#ffffff'; ctx.strokeRect(x0 - 0.5, snap(vy) + 0.5, 41, Math.max(2, snap(16 * ch)));
  }

  /** Side-entry warning chevrons: flashing indicators at screen edges for incoming enemies. */
  drawSpawnWarnings(ctx: Ctx) {
    for (const e of this.enemies.list) {
      if (!e.alive || e.world) continue;
      const ey = Math.round(e.y);
      if (ey < 16 || ey > H - 20) continue;
      ctx.fillStyle = this.t % 8 < 4 ? '#ff4422' : '#ffaa22';
      const dx = e.x - e.ox;
      const L = -VIEW.ox, R = W + VIEW.ox;
      if (e.x < L - 5 && e.x > L - 50 && dx > 0) {
        ctx.beginPath(); ctx.moveTo(L + 3, ey - 5); ctx.lineTo(L + 9, ey); ctx.lineTo(L + 3, ey + 5); ctx.fill();
      }
      if (e.x > R + 5 && e.x < R + 50 && dx < 0) {
        ctx.beginPath(); ctx.moveTo(R - 3, ey - 5); ctx.lineTo(R - 9, ey); ctx.lineTo(R - 3, ey + 5); ctx.fill();
      }
    }
  }

  drawDefused(ctx: Ctx) {
    const t = this.stateT;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(40, 70, 240, 100);
    ctx.strokeStyle = '#8899cc'; ctx.strokeRect(40.5, 70.5, 239, 99);
    // the bomb
    const bx = 80, by = 120;
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(bx, by, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(bx - 6, by - 6, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(bx - 4, by - 26, 8, 8);
    const secs = t < 90 ? Math.max(1, 9 - Math.floor(t / 10)) : 1;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 12, by + 22, 24, 10);
    text(ctx, '00:0' + secs, bx, by + 23, t < 90 ? 'red' : (t % 20 < 10 ? 'green' : 'grey'), 1, 0.5);
    if (t > 90) {
      text(ctx, 'BOMB', 190, 92, 'gold', 2, 0.5);
      text(ctx, 'DEFUSED', 190, 112, 'gold', 2, 0.5);
      text(ctx, 'BONUS ' + (this.lv.idx + 1) * 5000, 190, 140, 'cyan', 1, 0.5);
    } else text(ctx, 'DEFUSING...', 190, 112, 'red', 1, 0.5);
    if (t > 100 && this.defusedQuip) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(12, 174, 296, 12);
      text(ctx, this.defusedQuip, 160, 176, 'purple', 1, 0.5);
    }
  }

  drawSauce(ctx: Ctx) {
    if (this.sauce > 0 || this.sauceBurst > 0) this.sauceSeen = true;
    if (!this.sauceSeen || this.host.demo) return;
    const hot = this.sauceBurst > 0;
    text(ctx, hot ? 'HOT' : 'SAUCE', 4, 14, hot && (this.t & 8) ? 'red' : 'purple');
    const x0 = 36, bw = 62;
    ctx.fillStyle = '#200810';
    ctx.fillRect(x0, 16, bw, 4);
    const amt = hot ? 1 : this.sauce / SAUCE_MAX;
    ctx.fillStyle = hot ? ((this.t & 4) ? '#ff2266' : '#ffaa33') : '#ff4488';
    ctx.fillRect(x0, 16, Math.max(hot ? bw : 0, snap(bw * amt)), 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x0 + snap(bw * SAUCE_SAVE_AT / SAUCE_MAX), 15, 1, 6);
  }

  drawChatter(ctx: Ctx) {
    if (this.chatterT <= 0 || !this.chatter) return;
    const lines = wrap(this.chatter, 46).slice(0, 2);
    const y0 = this.combo >= 3 ? 46 : 28;
    ctx.fillStyle = 'rgba(12,0,10,0.62)';
    ctx.fillRect(6, y0 - 1, 308, lines.length * 9 + 3);
    lines.forEach((l, i) => text(ctx, l, 160, y0 + i * 9, this.sauceBurst > 0 ? 'red' : 'gold', 1, 0.5));
  }
}

export { ITEM };
