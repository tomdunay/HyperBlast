// Top-level state machine: Title (+attract demo, hi-scores, credits) → Intro → Play ⇄ Shop → … → GameOver / Ending → Name entry.
import { Ctx, likeCanvas, hiCanvas, realSize, RES, rnd, fbm } from '../engine/gfx';
import { input, REMAPPABLE, DEFAULT_BINDINGS, Action } from '../engine/input';
import { audio } from '../engine/audio';
import { text, makeLogo, wrap, FontStyle } from '../engine/font';
import { S, SF } from '../art/sprites';
import { drawGlow } from '../engine/light';
import { buildLevel, LEVEL_COUNT, hexSeed, LevelMode } from '../levels';
import { ensureBossArt } from './bosses';
import { LevelDef, W, H } from './types';
import { VIEW, MARGIN, fillView } from '../engine/view';
import { postFx } from '../engine/post';
import { World, Host } from './World';
import { Scroller } from './Scroller';
import { Shop } from './Shop';
import { PlayerState } from './items';
import { comboRank, gameOverLine, levelQuip, pauseLine, statsLine, titleTag } from './sauce';
import { Settings, loadSettings, saveSettings, loadHi, qualifies, insertHi, saveRun, loadRun, clearRun, RunSave } from './save';

interface Scene { update(): void; render(ctx: Ctx, a: number): void }

const levelCache = new Map<string, LevelDef>();
/** Build (and cache) a level, pre-rendering its boss art so the fight starts without a hitch. */
export function getLevelFor(i: number, mode: LevelMode, seed: number): LevelDef {
  const key = `${mode}:${mode === 'random' ? seed : 0}:${i}`;
  let lv = levelCache.get(key);
  if (!lv) {
    lv = buildLevel(i, mode, seed);
    levelCache.set(key, lv);
    if (lv.midBoss) ensureBossArt(lv.midBoss.boss);
    ensureBossArt(lv.endBoss.boss);
  }
  return lv;
}

const CREDITS = 'HYPERBLAST  ***  AN ORIGINAL VERTICAL SHOOT-EM-UP  ***  EVERY PIXEL AND NOTE GENERATED IN YOUR BROWSER  ***  ' +
  'ARROWS OR WASD TO MOVE  -  SPACE OR Z TO FIRE (TAP FOR SPEED)  -  X ZAPPER  -  C DIVE  -  P PAUSE  ***  ' +
  'HOLD DOWN AT THE BOTTOM OF THE SCREEN TO REVERSE THE SCROLL  ***  SPEND YOUR HARD CASH AT GORBO\'S TRADE HUT  ***  ' +
  'FIFTEEN BOMBS. THIRTY GUARDIANS. ONE STRIKEBLASTER.  ***  TRY RANDOMISER MODE IN OPTIONS AND SHARE YOUR SEED  ***  ' +
  'GREETINGS TO EVERYONE WHO EVER WORE OUT A JOYSTICK  ***  FLY CLOSE TO FILL THE SAUCE  ***  GORBO IS WATCHING, AND CHARGING  ***       ';

export class Game {
  settings: Settings = loadSettings();
  private _scene!: Scene;
  /** ticks left in the dither dissolve-in after a scene change */
  fadeT = 0;
  get scene() { return this._scene; }
  set scene(s: Scene) {
    this._scene = s;
    this.fadeT = 16;
  }
  world: World | null = null;
  /** level whose scenery is being pre-built in the background */
  prefetch: LevelDef | null = null;
  players: PlayerState[] = [];
  cur = 0;
  debug: boolean;
  startLevel: number;
  logo: HTMLCanvasElement;
  logoFx: [HTMLCanvasElement, Ctx];
  t = 0;

  constructor() {
    const q = new URLSearchParams(location.search);
    this.debug = q.get('debug') === '1';
    this.startLevel = Math.max(0, Math.min(LEVEL_COUNT - 1, (parseInt(q.get('level') || '1', 10) || 1) - 1));
    const qs = q.get('seed');
    if (qs && /^[0-9a-fA-F]{1,8}$/.test(qs)) { this.settings.levelMode = 'random'; this.settings.seed = parseInt(qs, 16) >>> 0; }
    this.logo = makeLogo('HYPERBLAST', 4);
    this.logoFx = likeCanvas(this.logo);
    this.applySettings();
    if (q.get('level') || qs) this.startGame();
    else this.toTitle();
  }

  /** debug: offset added to the seed of generated levels (key G) */
  regenOffset = 0;
  getLevel(i: number) {
    const s = this.settings;
    if (this.regenOffset) return buildLevel(i, 'random', (s.seed + this.regenOffset) >>> 0);
    return getLevelFor(i, s.levelMode, s.seed);
  }
  seedLabel() { return this.settings.levelMode === 'random' ? '#' + hexSeed(this.settings.seed + this.regenOffset) : ''; }
  regenLevel() {
    this.regenOffset++;
    const ps = this.ps; ps.checkpoint = 0; ps.midDone = false;
    ps.lvStats = { kills: 0, cashEarned: 0, grazes: 0, maxCombo: 0 };
    this.beginLevel();
  }

  applySettings() {
    audio.setVolumes(this.settings.music / 10, this.settings.sfx / 10);
    document.getElementById('crt')?.classList.toggle('on', this.settings.crt && !(window as any).postOk);
    input.bindings = this.settings.bindings;
    saveSettings(this.settings);
    (window as any).resizeGame?.();
  }
  hiScore() { return loadHi()[0]?.score ?? 0; }
  get ps() { return this.players[this.cur]; }

  update() {
    this.t++;
    if (this.fadeT > 0) this.fadeT--;
    this.scene.update();
    this.autosave();
    // build the next level's scenery a slice at a time while menus, cards and the shop are on screen
    if (this.prefetch && !(this.scene instanceof PlayScene) && Scroller.prepare(this.prefetch, this.scene instanceof IntroScene ? 15 : 10)) {
      this.prefetch = null;
      // on the title, once the attract level is ready, get the first level ready too so START is quick
      if (this.scene instanceof TitleScene) { const lv = this.getLevel(this.startLevel); if (!Scroller.cache.has(lv)) this.prefetch = lv; }
    }
  }
  render(ctx: Ctx, a: number) {
    postFx.waves = []; postFx.aberr = 0; postFx.bloomBoost = 1;
    ctx.save();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW.w, H);
    // scenes draw in playfield coordinates; the wider view extends either side of x = 0..320
    ctx.translate(VIEW.ox, 0);
    this.scene.render(ctx, a);
    ctx.restore();
    if (this.fadeT > 0) { ctx.fillStyle = `rgba(0,0,0,${(this.fadeT / 16) ** 1.5})`; ctx.fillRect(0, 0, VIEW.w, H); }
  }

  // ------------------------------------------------------------ flow
  toTitle() { this.world = null; this.scene = new TitleScene(this); }

  startGame() {
    clearRun();
    const n = this.settings.players;
    this.players = [];
    for (let i = 0; i < n; i++) {
      const ps = new PlayerState(i + 1);
      ps.level = this.startLevel;
      if (this.debug) ps.cash = 20000;
      this.players.push(ps);
    }
    this.cur = 0;
    this.intro(true);
  }

  intro(card: boolean) {
    if (card) this.scene = new IntroScene(this, this.ps, () => this.beginLevel());
    else this.beginLevel();
  }

  makeHost(demo: boolean): Host {
    return {
      demo, debug: this.debug && !demo, diff: this.settings.difficulty, twoPlayer: this.players.length > 1,
      onDied: () => this.onDied(), onShop: () => this.onShop(), onLevelDone: () => this.onLevelDone(), hiScore: () => this.hiScore(),
      regen: () => this.regenLevel(), seedLabel: () => this.seedLabel(),
    };
  }

  beginLevel() {
    const ps = this.ps;
    ps.shield = Math.max(ps.shield, 1);
    this.saveRun();
    this.world = new World(this.getLevel(ps.level), ps, this.makeHost(false));
    this.scene = new PlayScene(this, this.world);
  }

  onDied() {
    const ps = this.ps;
    ps.lives--;
    ps.shield = ps.maxShield();
    ps.load.power = Math.max(1, ps.load.power - 1); // death rule: lose one blaster power level, keep everything bought
    const alive = this.players.filter((p) => p.lives > 0);
    if (!alive.length) { this.gameOver(); return; }
    if (this.players.length > 1) {
      let n = this.cur;
      do { n = (n + 1) % this.players.length; } while (this.players[n].lives <= 0);
      const switched = n !== this.cur;
      this.cur = n;
      this.intro(switched);
    } else this.intro(false);
  }

  onShop() {
    const w = this.world!;
    const ps = this.ps;
    this.scene = new ShopScene(new Shop(ps, ps.level * 2, false, () => { this.saveRun(); w.resumeFromShop(); this.scene = new PlayScene(this, w); }));
  }

  onLevelDone() {
    const ps = this.ps;
    if (ps.level >= LEVEL_COUNT - 1) { this.scene = new EndingScene(this); return; }
    const w = this.world!;
    this.prefetch = this.getLevel(ps.level + 1);
    this.scene = new StatsScene(this, w, () => {
      this.scene = new ShopScene(new Shop(ps, ps.level * 2 + 1, true, () => {
        ps.level++; ps.checkpoint = 0; ps.midDone = false;
        ps.lvStats = { kills: 0, cashEarned: 0, grazes: 0, maxCombo: 0 };
        this.saveRun();
        this.intro(true);
      }));
    });
  }

  gameOver() {
    clearRun();
    this.world = null;
    this.scene = new GameOverScene(this);
  }

  // ------------------------------------------------------------ save / continue
  /** key of the last saved progress point, so checkpoints only write once */
  private savedAt = '';
  /** Save the run so it can be continued from the start of the current checkpoint. */
  saveRun() {
    if (!this.players.length || this.regenOffset) return;
    const s = this.settings;
    const r: RunSave = {
      v: 1, at: Date.now(), cur: this.cur, difficulty: s.difficulty, levelMode: s.levelMode, seed: s.seed, regenOffset: 0,
      players: this.players.map((p) => ({ ...p, load: { ...p.load }, lvStats: { ...p.lvStats } })),
    };
    saveRun(r);
    this.savedAt = this.players.map((p) => p.level + ':' + p.checkpoint).join(',');
  }
  /** Resume a saved run: same levels (mode + seed), same loadouts, from the saved checkpoint. */
  continueRun() {
    const r = loadRun();
    if (!r) return;
    const s = this.settings;
    s.difficulty = r.difficulty; s.levelMode = r.levelMode; s.seed = r.seed; s.players = r.players.length === 2 ? 2 : 1;
    this.applySettings();
    this.regenOffset = 0;
    this.players = r.players.map((d, i) => {
      const ps = new PlayerState(i + 1);
      Object.assign(ps, d, { load: { ...ps.load, ...(d.load as object) }, lvStats: { ...ps.lvStats, ...(d.lvStats as object) } });
      return ps;
    });
    this.cur = Math.min(r.cur, this.players.length - 1);
    this.intro(true);
  }
  /** called when the page is closed or hidden: keep the run if one is in progress */
  saveIfPlaying() {
    if (this.scene instanceof PlayScene || this.scene instanceof ShopScene || this.scene instanceof IntroScene) this.saveRun();
  }
  /** autosave when a new checkpoint is reached */
  autosave() {
    if (!(this.scene instanceof PlayScene) || !this.world || this.world.state !== 'play') return;
    const key = this.players.map((p) => p.level + ':' + p.checkpoint).join(',');
    if (key !== this.savedAt) this.saveRun();
  }

  /** run name entry for every player that qualifies, then go to title */
  hiScoreEntries(list = this.players.slice()) {
    const next = list.shift();
    if (!next) { this.toTitle(); return; }
    if (!qualifies(next.score)) { this.hiScoreEntries(list); return; }
    this.scene = new NameEntryScene(this, next, () => this.hiScoreEntries(list));
  }
}

// =================================================================== scenes
const STAR_COLS = ['#ffffff', '#ccddff', '#8899cc', '#556688', '#334455'];
let spaceC: HTMLCanvasElement | null = null;
/** Deep-space backdrop: dark gradient with smooth, layered nebula clouds and dust lanes (wraps every 64 px sideways). */
function spaceBackdrop() {
  if (spaceC) return spaceC;
  const w = 320 + MARGIN * 2 + 64;
  const [c, x] = hiCanvas(w, H);
  const [RW, RH] = realSize(c);
  const img = x.createImageData(RW, RH);
  const d = img.data;
  const P = 512; // horizontal period of the cloud noise so the drift wraps
  const per = (u: number, y: number, sx: number, sy: number, seed: number, oct: number) =>
    fbm(u * sx, y * sy, seed, oct) * (1 - u / P) + fbm((u - P) * sx, y * sy, seed, oct) * (u / P);
  for (let Y = 0; Y < RH; Y++) for (let X = 0; X < RW; X++) {
    const px = (X + 0.5) / RES, y = (Y + 0.5) / RES;
    const u = px % P;
    const n = per(u, y, 0.012, 0.016, 41, 5);
    const m = per(u, y, 0.03, 0.03, 77, 3);
    const lane = per(u, y, 0.05, 0.02, 13, 4); // dark dust lanes cutting through the glow
    let k = Math.max(0, n - 0.4) * 2.4;
    k *= 1 - Math.max(0, lane - 0.55) * 1.8;
    const hot = Math.max(0, n - 0.62) * 4; // bright cores
    const g = y / H;
    let r = 2 + g * 16, gg = 1 + g * 4, b = 10 + g * 26;
    r += k * (90 * m + 40) + hot * 120; gg += k * 30 * (1 - m) + hot * 60; b += k * (140 - 60 * m) + hot * 90;
    const i = (Y * RW + X) * 4;
    d[i] = Math.min(255, r); d[i + 1] = Math.min(255, gg); d[i + 2] = Math.min(255, b); d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  spaceC = c;
  return c;
}
/** Perspective (3D) starfield flying towards the viewer. */
function drawStars(ctx: Ctx, t: number) {
  ctx.drawImage(spaceBackdrop(), -VIEW.ox - Math.round((t * 0.15) % 64), 0);
  const n = Math.round(160 * VIEW.w / 320), sw = VIEW.w / 320;
  for (let i = 0; i < n; i++) {
    const sx = (((i * 7919) % 1000) / 500 - 1) * sw, sy = ((i * 104729) % 1000) / 500 - 1;
    const z = Math.max(0.03, 1 - ((((i * 37) % 100) / 100 + t * 0.0035) % 1));
    const px = 160 + (sx / z) * 70, py = 128 + (sy / z) * 70;
    if (px < -VIEW.ox || py < 0 || px >= W + VIEW.ox || py >= H) continue;
    ctx.fillStyle = STAR_COLS[Math.min(4, Math.floor(z * 5))];
    const s = z < 0.15 ? 1.5 : z < 0.45 ? 1 : 0.5;
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
    if (z < 0.3) {
      // near stars: a soft glow and a short motion streak away from the centre
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, px, py, 3 + (0.3 - z) * 10, '#88aaff', 0.6);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#aabbff'; ctx.lineWidth = s * 0.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - (px - 160) * 0.06, py - (py - 128) * 0.06); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

const COPPER = [
  ['#220000', '#661100', '#bb3300', '#ff7722', '#ffdd88', '#ff7722', '#bb3300', '#661100'],
  ['#000022', '#112266', '#2255bb', '#55aaff', '#ddffff', '#55aaff', '#2255bb', '#112266'],
  ['#002200', '#115511', '#22aa33', '#77ee66', '#eeffcc', '#77ee66', '#22aa33', '#115511'],
];
/** Amiga copper raster bars: smooth tubes of light with a hot core and an additive halo. */
function copperBars(ctx: Ctx, t: number, y0: number, span: number) {
  COPPER.forEach((bar, i) => {
    const y = y0 + Math.sin(t * 0.035 + i * 2.1) * span;
    const g = ctx.createLinearGradient(0, y, 0, y + 16);
    bar.forEach((c, k) => g.addColorStop(k / 8 + 1 / 16, c));
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-VIEW.ox, y, VIEW.w, 16);
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createLinearGradient(0, y - 10, 0, y + 26);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.5, bar[3] + '55'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(-VIEW.ox, y - 10, VIEW.w, 36);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-VIEW.ox, y + 7.5, VIEW.w, 0.5);
    ctx.globalCompositeOperation = 'source-over';
  });
}

export function drawHiTable(ctx: Ctx, y0: number, highlight = -1) {
  const h = loadHi();
  text(ctx, 'HALL OF FAME', 160, y0, 'gold', 2, 0.5);
  h.forEach((e, i) => {
    const st: FontStyle = i === highlight ? 'cyan' : i === 0 ? 'gold' : 'metal';
    const y = y0 + 26 + i * 12;
    text(ctx, String(i + 1).padStart(2, ' ') + '.', 20, y, st);
    text(ctx, e.name, 46, y, st);
    text(ctx, String(e.score).padStart(8, '0'), 76, y, st);
    text(ctx, 'L' + e.level, 132, y, st);
    text(ctx, e.seed ? '#' + e.seed : 'CLASSIC', 160, y, e.seed ? 'cyan' : 'grey');
  });
}

class TitleScene implements Scene {
  g: Game; t = 0; sel = 0; idle = 0; phase: 'menu' | 'scores' | 'demo' = 'menu';
  demo: World | null = null;
  items: string[];
  save: RunSave | null;
  demoLv: { lv: LevelDef; idx: number };
  constructor(g: Game) {
    this.g = g; audio.playMusic('title');
    this.save = loadRun();
    this.items = this.save ? ['CONTINUE', 'NEW GAME', 'OPTIONS', 'HALL OF FAME'] : ['START GAME', 'OPTIONS', 'HALL OF FAME'];
    this.demoLv = this.pickDemo();
  }
  /** every attract loop shows a freshly generated level from a random seed; pre-build it while the menu idles */
  pickDemo() {
    const idx = Math.floor(Math.random() * 15);
    const d = { idx, lv: getLevelFor(idx, 'random', (Math.random() * 2 ** 32) >>> 0) };
    this.g.prefetch = d.lv;
    return d;
  }
  update() {
    this.t++; this.idle++;
    if (this.phase === 'demo') {
      this.demo!.update();
      if (input.anyPressed || this.demo!.t > 1800 || this.demo!.state !== 'play') { this.demo = null; this.phase = 'menu'; this.idle = 0; audio.playMusic('title'); this.demoLv = this.pickDemo(); }
      return;
    }
    if (input.anyPressed) this.idle = 0;
    if (this.phase === 'scores') {
      if (input.anyPressed || this.idle > 450) { this.phase = this.idle > 450 ? 'demo' : 'menu'; this.idle = 0; if (this.phase === 'demo') this.startDemo(); }
      return;
    }
    if (input.p('up')) { this.sel = (this.sel + this.items.length - 1) % this.items.length; audio.play('menu'); }
    if (input.p('down')) { this.sel = (this.sel + 1) % this.items.length; audio.play('menu'); }
    for (const c of input.clicks) { const i = Math.floor((c.y - 143) / 12); if (i >= 0 && i < this.items.length) { this.sel = i; this.choose(); return; } }
    if (input.p('confirm') || input.p('fire')) this.choose();
    if (this.idle > 500) { this.phase = 'scores'; this.idle = 0; }
  }
  startDemo() {
    const ps = new PlayerState(1);
    ps.load.power = 3; ps.load.side = 1; ps.load.homing = 1; ps.load.spread = 1;
    ps.level = this.demoLv.idx;
    this.demo = new World(this.demoLv.lv, ps, this.g.makeHost(true));
  }
  choose() {
    audio.play('select');
    switch (this.items[this.sel]) {
      case 'CONTINUE': this.g.continueRun(); break;
      case 'START GAME': case 'NEW GAME': this.g.startGame(); break;
      case 'OPTIONS': this.g.scene = new OptionsScene(this.g); break;
      case 'HALL OF FAME': this.phase = 'scores'; this.idle = 0; break;
    }
  }
  render(ctx: Ctx, a: number) {
    if (this.phase === 'demo' && this.demo) {
      this.demo.render(ctx, a);
      ctx.drawImage(this.g.logo, 160 - this.g.logo.width / 2, 30);
      if (this.t % 60 < 40) text(ctx, 'PRESS FIRE', 160, 200, 'gold', 1, 0.5);
      return;
    }
    drawStars(ctx, this.t);
    if (this.phase === 'scores') { drawHiTable(ctx, 40); return; }
    // logo with chrome shine sweep
    const [fc, fx] = this.g.logoFx;
    fx.clearRect(0, 0, fc.width, fc.height);
    fx.globalCompositeOperation = 'source-over';
    fx.drawImage(this.g.logo, 0, 0);
    fx.globalCompositeOperation = 'source-atop';
    const sx = (this.t * 3) % 520 - 120;
    fx.fillStyle = 'rgba(255,255,255,0.75)';
    fx.beginPath(); fx.moveTo(sx, 0); fx.lineTo(sx + 14, 0); fx.lineTo(sx - 6, fc.height); fx.lineTo(sx - 20, fc.height); fx.fill();
    const ly = 34 + Math.round(Math.sin(this.t * 0.04) * 3);
    copperBars(ctx, this.t, 46, 22);
    const lx = Math.round(160 - fc.width / 2);
    ctx.drawImage(fc, lx, ly);
    // squashed mirror reflection of the logo
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.translate(lx, ly + fc.height + 10);
    ctx.scale(1, -0.3);
    ctx.drawImage(fc, 0, 0);
    ctx.restore();
    text(ctx, titleTag(this.t), 160, 88, 'cyan', 1, 0.5);
    // ship sways and banks
    const shx = 160 + Math.sin(this.t * 0.025) * 50, vx = Math.cos(this.t * 0.025);
    const fr = SF.ship[Math.max(0, Math.min(4, Math.round(vx * 2) + 2))];
    const shy = 104 + Math.round(Math.sin(this.t * 0.05) * 3);
    ctx.drawImage(fr, Math.round(shx - 15), shy);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, shx - 6, shy + 33, 6 + ((this.t >> 1) & 1), '#ff7722');
    drawGlow(ctx, shx + 6, shy + 33, 6 + ((this.t >> 1) & 1), '#ff7722');
    ctx.globalCompositeOperation = 'source-over';
    this.items.forEach((it, i) => {
      const s = i === this.sel;
      text(ctx, (s ? '> ' : '  ') + it + (s ? ' <' : '  '), 160, 143 + i * 12, s ? 'gold' : 'metal', 1, 0.5);
    });
    if (this.save && this.items[this.sel] === 'CONTINUE') {
      const p = this.save.players[this.save.cur] as { level: number; checkpoint: number; score: number; lives: number; cash: number };
      const mode = this.save.levelMode === 'random' ? '  RANDOMISER' : '';
      text(ctx, `LEVEL ${p.level + 1}-${p.checkpoint + 1}  LIVES ${p.lives}  $${p.cash}${mode}`, 160, 190, 'cyan', 1, 0.5);
    } else text(ctx, 'HI ' + String(this.g.hiScore()).padStart(7, '0'), 160, 190, 'metal', 1, 0.5);
    const diff = ['EASY', 'NORMAL', 'HARD'][this.g.settings.difficulty];
    const mode = this.g.settings.levelMode === 'random' ? 'RANDOMISER ' + this.g.seedLabel() : 'CLASSIC';
    text(ctx, `${this.g.settings.players}P  ${diff}  ${mode}`, 160, 202, 'grey', 1, 0.5);
    // scrolling credits
    const cw = CREDITS.length * 6;
    const x = W + VIEW.ox - ((this.t * 1.5) % (cw + VIEW.w));
    fillView(ctx, '#000', 226, 14);
    text(ctx, CREDITS, x, 229, 'chrome');
    text(ctx, '(C) 2026 HYPERBLAST - ORIGINAL GAME', 160, 245, 'grey', 1, 0.5);
  }
}

class OptionsScene implements Scene {
  g: Game; sel = 0; t = 0;
  /** seed editor: -1 = not editing, else the selected hex digit (0..7) */
  digit = -1;
  constructor(g: Game) { this.g = g; }
  rows(): [string, string][] {
    const s = this.g.settings;
    return [
      ['DIFFICULTY', ['EASY', 'NORMAL', 'HARD'][s.difficulty]],
      ['PLAYERS', s.players === 1 ? '1 PLAYER' : '2 ALTERNATING'],
      ['MUSIC VOLUME', '#'.repeat(s.music) + '.'.repeat(10 - s.music)],
      ['SFX VOLUME', '#'.repeat(s.sfx) + '.'.repeat(10 - s.sfx)],
      ['CRT FILTER', s.crt ? 'ON' : 'OFF'],
      ['BLOOM GLOW', (window as any).postOk ? (s.bloom ? 'ON' : 'OFF') : 'N/A'],
      ['SCREEN', { fill: 'WIDE FILL', classic: 'CLASSIC 5:4', integer: 'PIXEL PERFECT' }[s.screen]],
      ['LEVELS', s.levelMode === 'classic' ? 'CLASSIC' : 'RANDOMISER'],
      ['SEED', hexSeed(s.seed)],
      ['REROLL SEED', '>'],
      ['CONTROLS', 'REMAP >'],
      ['BACK', ''],
    ];
  }
  editSeed() {
    const s = this.g.settings;
    const shift = (7 - this.digit) * 4;
    const cur = (s.seed >>> shift) & 15;
    const set = (v: number) => { s.seed = ((s.seed & ~(15 << shift)) | ((v & 15) << shift)) >>> 0; this.g.applySettings(); };
    if (input.p('up')) { set(cur + 1); audio.play('menu'); }
    if (input.p('down')) { set(cur + 15); audio.play('menu'); }
    if (input.p('left')) this.digit = Math.max(0, this.digit - 1);
    if (input.p('right')) this.digit = Math.min(7, this.digit + 1);
    for (const ch of input.charQueue) if (/^[0-9A-F]$/.test(ch)) { set(parseInt(ch, 16)); this.digit = Math.min(7, this.digit + 1); }
    if (input.p('confirm') || input.p('fire') || input.p('back')) { this.digit = -1; audio.play('select'); }
  }
  update() {
    this.t++;
    if (this.digit >= 0) { this.editSeed(); return; }
    const n = this.rows().length;
    if (input.p('up')) { this.sel = (this.sel + n - 1) % n; audio.play('menu'); }
    if (input.p('down')) { this.sel = (this.sel + 1) % n; audio.play('menu'); }
    const d = (input.p('right') ? 1 : 0) - (input.p('left') ? 1 : 0);
    const go = input.p('confirm') || input.p('fire');
    for (const c of input.clicks) { const i = Math.floor((c.y - 36) / 14); if (i >= 0 && i < n) { this.sel = i; this.change(1, true); return; } }
    if (d || go) this.change(d || 1, go);
    if (input.p('back')) { this.g.applySettings(); this.g.toTitle(); }
  }
  change(d: number, go: boolean) {
    const s = this.g.settings;
    switch (this.sel) {
      case 0: s.difficulty = ((s.difficulty + d + 3) % 3) as 0 | 1 | 2; break;
      case 1: s.players = s.players === 1 ? 2 : 1; break;
      case 2: s.music = Math.max(0, Math.min(10, s.music + d)); break;
      case 3: s.sfx = Math.max(0, Math.min(10, s.sfx + d)); break;
      case 4: s.crt = !s.crt; break;
      case 5: s.bloom = !s.bloom; break;
      case 6: { const m = ['fill', 'classic', 'integer'] as const; s.screen = m[(m.indexOf(s.screen) + d + 3) % 3]; s.screenChosen = true; break; }
      case 7: s.levelMode = s.levelMode === 'classic' ? 'random' : 'classic'; break;
      case 8: if (go) { this.digit = 0; input.charQueue.length = 0; } break;
      case 9: s.seed = (Math.random() * 2 ** 32) >>> 0; s.levelMode = 'random'; break;
      case 10: if (go) { this.g.scene = new ControlsScene(this.g); return; } break;
      case 11: if (go) { this.g.applySettings(); this.g.toTitle(); return; } break;
    }
    audio.play('select');
    this.g.applySettings();
  }
  render(ctx: Ctx) {
    drawStars(ctx, this.t);
    text(ctx, 'OPTIONS', 160, 14, 'gold', 2, 0.5);
    this.rows().forEach(([k, v], i) => {
      const s = i === this.sel;
      const y = 36 + i * 14;
      text(ctx, k, 40, y, s ? 'gold' : 'metal');
      text(ctx, v, 280, y, s ? 'cyan' : 'grey', 1, 1);
      if (i === 8 && this.digit >= 0 && this.t % 20 < 14) { ctx.fillStyle = '#ffcc22'; ctx.fillRect(280 - 48 + this.digit * 6, y + 8, 5, 1); }
    });
    const help = this.digit >= 0 ? 'UP/DOWN OR TYPE 0-F  -  ENTER DONE' : this.sel === 8 ? 'ENTER TO EDIT THE SEED' : this.sel === 6 ? 'F KEY TOGGLES FULLSCREEN' : this.sel === 5 ? 'NEON LIGHT BLEED AND SHOCKWAVES' : 'LEFT/RIGHT CHANGE  -  ESC BACK';
    text(ctx, help, 160, 214, 'grey', 1, 0.5);
    if (this.g.settings.levelMode === 'random') text(ctx, 'ALL 15 LEVELS ARE GENERATED FROM THE SEED', 160, 228, 'cyan', 1, 0.5);
    else text(ctx, 'LEVELS 1-5 HAND MADE, 6-15 OFFICIAL GENERATED', 160, 228, 'grey', 1, 0.5);
  }
}

const ACTION_LABEL: Record<string, string> = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', fire: 'FIRE', zap: 'ZAPPER', dive: 'DIVE', pause: 'PAUSE' };
class ControlsScene implements Scene {
  g: Game; sel = 0; waiting = false; t = 0;
  constructor(g: Game) { this.g = g; }
  update() {
    this.t++;
    const b = this.g.settings.bindings;
    if (this.waiting) {
      const k = input.keyQueue.find((c) => !c.startsWith('Touch'));
      if (k) {
        const a = REMAPPABLE[this.sel] as Action;
        if (k !== 'Escape' || a === 'pause') {
          for (const other of REMAPPABLE) b[other] = b[other].filter((c) => c !== k);
          b[a] = [k, ...b[a].filter((c) => c !== k)].slice(0, 2);
        }
        this.waiting = false; audio.play('select'); this.g.applySettings();
      }
      return;
    }
    const n = REMAPPABLE.length + 2;
    if (input.p('up')) { this.sel = (this.sel + n - 1) % n; audio.play('menu'); }
    if (input.p('down')) { this.sel = (this.sel + 1) % n; audio.play('menu'); }
    if (input.keyQueue.includes('Enter') || input.keyQueue.includes('Space')) {
      if (this.sel < REMAPPABLE.length) { this.waiting = true; input.keyQueue.length = 0; }
      else if (this.sel === REMAPPABLE.length) { this.g.settings.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS)); this.g.applySettings(); audio.play('select'); }
      else this.g.scene = new OptionsScene(this.g);
    }
    if (input.keyQueue.includes('Escape')) this.g.scene = new OptionsScene(this.g);
  }
  render(ctx: Ctx) {
    drawStars(ctx, this.t);
    text(ctx, 'CONTROLS', 160, 20, 'gold', 2, 0.5);
    const b = this.g.settings.bindings;
    REMAPPABLE.forEach((a, i) => {
      const s = i === this.sel;
      text(ctx, ACTION_LABEL[a], 40, 52 + i * 14, s ? 'gold' : 'metal');
      const v = s && this.waiting ? (this.t % 30 < 20 ? 'PRESS A KEY' : '') : b[a].map((k) => k.replace('Key', '').replace('Arrow', '')).join(' / ');
      text(ctx, v, 280, 52 + i * 14, s ? 'cyan' : 'grey', 1, 1);
    });
    const y = 52 + REMAPPABLE.length * 14 + 8;
    text(ctx, 'RESET DEFAULTS', 160, y, this.sel === REMAPPABLE.length ? 'gold' : 'metal', 1, 0.5);
    text(ctx, 'BACK', 160, y + 14, this.sel === REMAPPABLE.length + 1 ? 'gold' : 'metal', 1, 0.5);
    text(ctx, 'ENTER TO REBIND  -  GAMEPAD: STICK/DPAD, A FIRE, B ZAP, X DIVE', 160, 236, 'grey', 1, 0.5);
  }
}

class IntroScene implements Scene {
  t = 0;
  name: string;
  quip: string;
  constructor(private g: Game, private ps: PlayerState, private done: () => void) {
    audio.stopMusic();
    const lv = g.getLevel(ps.level); // build (and cache) the level during the card
    this.name = lv.name;
    g.prefetch = lv;
    this.quip = levelQuip(this.name);
  }
  update() {
    // the card stays up until the level's scenery has finished building in the background (fire skips the wait)
    if ((++this.t > 190 && this.g.prefetch === null) || this.t > 600 || (this.t > 30 && (input.p('fire') || input.p('confirm')))) this.done();
  }
  render(ctx: Ctx) {
    drawStars(ctx, this.t * 3);
    const lv = this.ps.level;
    if (this.g.players.length > 1) text(ctx, 'PLAYER ' + this.ps.id, 160, 44, 'cyan', 2, 0.5);
    text(ctx, `LEVEL ${lv + 1}/${LEVEL_COUNT}`, 160, 78, 'gold', 3, 0.5);
    text(ctx, this.name, 160, 118, 'chrome', this.name.length > 26 ? 1 : 2, 0.5);
    const sl = this.g.seedLabel();
    if (sl) text(ctx, 'RANDOMISER SEED ' + sl, 160, 142, 'cyan', 1, 0.5);
    wrap(this.quip, 48).slice(0, 2).forEach((l, i) => text(ctx, l, 160, (sl ? 160 : 150) + i * 10, 'purple', 1, 0.5));
    if (this.t > 60 && this.t % 30 < 20) text(ctx, 'GET READY', 160, 188, 'metal', 1, 0.5);
    text(ctx, `LIVES ${this.ps.lives}   CASH $${this.ps.cash}   SCORE ${this.ps.score}`, 160, 220, 'grey', 1, 0.5);
  }
}

class PlayScene implements Scene {
  paused = false; psel = 0; quip = '';
  constructor(private g: Game, private w: World) {}
  update() {
    if (input.p('pause') && !this.paused) { this.paused = true; this.psel = 0; this.quip = pauseLine(); audio.play('menu'); return; }
    if (this.paused) {
      if (input.p('up')) { this.psel = (this.psel + 2) % 3; audio.play('menu'); }
      if (input.p('down')) { this.psel = (this.psel + 1) % 3; audio.play('menu'); }
      if (input.p('pause') || input.p('back')) this.paused = false;
      else if (input.p('confirm') || input.p('fire')) {
        if (this.psel === 0) this.paused = false;
        else if (this.psel === 1) { audio.stopMusic(); this.g.saveRun(); this.g.toTitle(); }
        else { audio.stopMusic(); clearRun(); this.g.hiScoreEntries(); }
      }
      return;
    }
    this.w.update();
  }
  render(ctx: Ctx, a: number) {
    this.w.render(ctx, this.paused ? 1 : a);
    if (this.paused) {
      fillView(ctx, 'rgba(0,0,0,0.6)');
      text(ctx, 'PAUSED', 160, 90, 'gold', 2, 0.5);
      text(ctx, (this.psel === 0 ? '> ' : '  ') + 'RESUME', 160, 124, this.psel === 0 ? 'gold' : 'metal', 1, 0.5);
      text(ctx, (this.psel === 1 ? '> ' : '  ') + 'SAVE AND QUIT', 160, 138, this.psel === 1 ? 'gold' : 'metal', 1, 0.5);
      text(ctx, (this.psel === 2 ? '> ' : '  ') + 'END GAME', 160, 152, this.psel === 2 ? 'gold' : 'metal', 1, 0.5);
      if (this.psel === 1) text(ctx, 'CONTINUE FROM THE LAST CHECKPOINT ON THE TITLE SCREEN', 160, 108, 'cyan', 1, 0.5);
      wrap(this.quip, 40).forEach((l, i) => text(ctx, l, 160, 176 + i * 10, 'purple', 1, 0.5));
    }
  }
}

class ShopScene implements Scene {
  constructor(private shop: Shop) {}
  update() { this.shop.update(); }
  render(ctx: Ctx) { this.shop.render(ctx); }
}

class GameOverScene implements Scene {
  t = 0;
  line: string;
  constructor(private g: Game) { this.line = gameOverLine(); audio.playMusic('gameover'); }
  update() { if (++this.t > 300 || (this.t > 60 && (input.p('fire') || input.p('confirm')))) this.g.hiScoreEntries(); }
  render(ctx: Ctx) {
    drawStars(ctx, this.t * 0.3);
    const k = Math.min(1, this.t / 60);
    text(ctx, 'GAME', 160, 64 + (1 - k) * -80, 'red', 4, 0.5);
    text(ctx, 'OVER', 160, 104 + (1 - k) * 160, 'red', 4, 0.5);
    if (k >= 1) text(ctx, this.line, 160, 148, 'purple', 1, 0.5);
    this.g.players.forEach((p, i) => text(ctx, (this.g.players.length > 1 ? 'PLAYER ' + p.id + '  ' : 'SCORE ') + p.score, 160, 174 + i * 12, 'gold', 1, 0.5));
  }
}

const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-! ';
class NameEntryScene implements Scene {
  t = 0; name = ['A', 'A', 'A']; pos = 0;
  constructor(private g: Game, private ps: PlayerState, private done: () => void) { audio.playMusic('title'); }
  update() {
    this.t++;
    const ci = NAME_CHARS.indexOf(this.name[this.pos]);
    if (input.p('up')) { this.name[this.pos] = NAME_CHARS[(ci + 1) % NAME_CHARS.length]; audio.play('menu'); }
    if (input.p('down')) { this.name[this.pos] = NAME_CHARS[(ci + NAME_CHARS.length - 1) % NAME_CHARS.length]; audio.play('menu'); }
    if (input.p('left') && this.pos > 0) this.pos--;
    for (const ch of input.charQueue) if (/[A-Z0-9]/.test(ch)) { this.name[this.pos] = ch; this.advance(); return; }
    if (input.p('right') || input.p('fire') || input.p('confirm')) this.advance();
  }
  advance() {
    audio.play('select');
    if (this.pos < 2) { this.pos++; return; }
    const sl = this.g.seedLabel();
    insertHi({ name: this.name.join(''), score: this.ps.score, level: this.ps.level + 1, seed: sl ? sl.slice(1) : undefined });
    this.done();
  }
  render(ctx: Ctx) {
    drawStars(ctx, this.t);
    text(ctx, 'NEW HIGH SCORE!', 160, 40, 'gold', 2, 0.5);
    if (this.g.players.length > 1) text(ctx, 'PLAYER ' + this.ps.id, 160, 66, 'cyan', 1, 0.5);
    text(ctx, String(this.ps.score), 160, 80, 'metal', 2, 0.5);
    text(ctx, 'ENTER YOUR NAME', 160, 120, 'metal', 1, 0.5);
    this.name.forEach((c, i) => {
      const x = 130 + i * 22;
      text(ctx, c, x, 140, i === this.pos ? 'gold' : 'metal', 3);
      if (i === this.pos && this.t % 20 < 12) { ctx.fillStyle = '#ffcc22'; ctx.fillRect(x, 166, 15, 2); }
    });
    text(ctx, 'SIGN THE BOOK. GORBO IS WATCHING.', 160, 196, 'purple', 1, 0.5);
    text(ctx, 'UP/DOWN OR TYPE  -  FIRE TO CONFIRM', 160, 220, 'grey', 1, 0.5);
  }
}

const ENDING = "WELL WELL. ALL FIFTEEN BOMBS DEFUSED. GORBO IS... MILDLY AROUSED. PROFESSIONALLY. GORBO WOULD GIVE YOU A MEDAL BUT MEDALS COST MONEY AND YOU ALREADY GOT THE LOOK. " +
  'THERE IS NO SECRET LEVEL. THERE IS NO PARADE. THERE IS A BACK ROOM, AND IT IS CLOSED. TURN OUT THE LIGHTS ON YOUR WAY OUT, TROUBLEMAKER.';

class StatsScene implements Scene {
  t = 0;
  quip: string;
  stats: { kills: number; cashEarned: number; grazes: number; maxCombo: number; levelBonus: number };
  constructor(private g: Game, w: World, private done: () => void) {
    this.stats = { kills: w.stats.kills, cashEarned: w.stats.cashEarned, grazes: w.stats.grazes, maxCombo: w.stats.maxCombo, levelBonus: (w.lv.idx + 1) * 5000 };
    this.quip = statsLine(this.stats.kills, this.stats.grazes, this.stats.maxCombo);
  }
  update() {
    this.t++;
    if (this.t > 350 || (this.t > 60 && (input.p('fire') || input.p('confirm')))) this.done();
  }
  render(ctx: Ctx) {
    drawStars(ctx, this.t);
    copperBars(ctx, this.t, 46, 20);
    text(ctx, 'LEVEL COMPLETE', 160, 36, 'gold', 2, 0.5);
    const s = this.stats;
    const rows: [string, string][] = [
      ['ENEMIES DESTROYED', String(s.kills)],
      ['CASH EARNED', '$' + s.cashEarned],
      ['BEST COMBO', s.maxCombo >= 3 ? 'x' + s.maxCombo + '  ' + comboRank(s.maxCombo) : '-'],
      ['GRAZES', String(s.grazes)],
      ['LEVEL BONUS', String(s.levelBonus)],
    ];
    rows.forEach(([k, v], i) => {
      const show = Math.max(0, this.t - 30 - i * 12);
      if (show <= 0) return;
      const y = 76 + i * 22;
      text(ctx, k, 56, y, 'metal');
      text(ctx, v, 268, y, i === 4 ? 'gold' : 'cyan', 1, 1);
    });
    if (this.t > 100) wrap(this.quip, 46).forEach((l, i) => text(ctx, l, 160, 192 + i * 10, 'purple', 1, 0.5));
    if (this.t > 110 && this.t % 30 < 20) text(ctx, 'PRESS FIRE', 160, 222, 'gold', 1, 0.5);
  }
}
class EndingScene implements Scene {
  t = 0; shop: Shop;
  constructor(private g: Game) {
    clearRun();
    this.shop = new Shop(g.ps, 99, true, () => {});
    audio.playMusic('ending');
  }
  update() {
    this.t++;
    this.shop.t++;
    this.shop.talk = this.t < 600 ? 10 : 0;
    if (this.t > 200 && (input.p('fire') || input.p('confirm'))) this.g.hiScoreEntries();
  }
  render(ctx: Ctx) {
    fillView(ctx, '#0a0614');
    // lights dim over time
    this.shop.drawGorbo(ctx, 160, 70);
    ctx.fillStyle = '#aa7744'; ctx.fillRect(60, 102, 200, 12);
    const shown = Math.min(ENDING.length, Math.floor(this.t / 2));
    wrap(ENDING.slice(0, shown), 46).forEach((l, i) => text(ctx, l, 22, 130 + i * 10, 'metal'));
    const dim = Math.max(0, Math.min(0.85, (this.t - 700) / 300));
    if (dim > 0) fillView(ctx, `rgba(0,0,0,${dim})`);
    if (this.t > 200 && this.t % 40 < 28) text(ctx, 'FINAL SCORE ' + this.g.ps.score + '  -  PRESS FIRE', 160, 238, 'gold', 1, 0.5);
    if (this.t > 1000) text(ctx, 'CLICK.', 160, 120, 'grey', 1, 0.5);
  }
}

export { rnd };
