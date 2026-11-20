// Boot: offscreen game canvas + WebGL presenter, 50 Hz fixed-timestep loop with interpolated rendering.
import { input } from './engine/input';
import { audio } from './engine/audio';
import { buildSprites, S, SF } from './art/sprites';
import { buildEnemies, ENEMIES } from './game/enemies';
import { buildBossArt, Boss } from './game/bosses';
import { Game } from './game/Game';
import { text } from './engine/font';
import { Presenter } from './engine/post';
import { VIEW, setViewWidth } from './engine/view';
import { RES } from './engine/gfx';

const display = document.getElementById('screen') as HTMLCanvasElement;
/**
 * The game draws into this canvas in logical coordinates (VIEW.w × 256); its bitmap is RES× finer, and the presenter
 * scales it up to the window.
 */
const canvas = document.createElement('canvas');
canvas.width = 320 * RES; canvas.height = 256 * RES;
let ctx = canvas.getContext('2d')!;
const prep = () => { ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.imageSmoothingEnabled = false; };
prep();
const presenter = new Presenter(display);
(window as any).postOk = presenter.ok;
const wrapEl = document.getElementById('wrap')!;

/**
 * Screen modes (Options → SCREEN). None of them stretch the image:
 *  fill    – fills the window; on wide screens the view widens to show more of the world either side (default)
 *  classic – the original 5:4 frame, as large as fits
 *  integer – like fill, but at a whole-number scale (sharpest pixels, may leave thin borders)
 */
function resize() {
  const mode: string = (window as any).game?.settings?.screen ?? 'fill';
  const vw = window.innerWidth, vh = window.innerHeight;
  let s: number;
  if (mode === 'classic') { setViewWidth(320); s = Math.min(vw / 320, vh / 256); }
  else {
    s = Math.min(vh / 256, vw / 320);
    if (mode === 'integer' && s >= 1) s = Math.floor(s);
    setViewWidth(Math.floor(vw / s));
  }
  if (canvas.width !== VIEW.w * RES) {
    canvas.width = VIEW.w * RES;
    ctx = canvas.getContext('2d')!;
  }
  prep();
  const w = Math.min(vw, Math.round(VIEW.w * s)), h = Math.min(vh, Math.round(256 * s));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  display.width = Math.round(w * dpr); display.height = Math.round(h * dpr);
  display.style.width = `${w}px`;
  display.style.height = `${h}px`;
  wrapEl.style.width = display.style.width;
  wrapEl.style.height = display.style.height;
  (document.getElementById('crt') as HTMLElement).style.backgroundSize = `100% ${Math.max(2, h / 256)}px`;
  const g = (window as any).game as Game | undefined;
  if (g) { prep(); g.render(ctx, 1); present(); }
}
function present() {
  const st = (window as any).game?.settings;
  presenter.present(canvas, { bloom: st?.bloom ?? true, crt: !!st?.crt });
}
window.addEventListener('resize', resize);
(window as any).resizeGame = resize;
resize();

/** F toggles browser fullscreen (ignored while typing a name or a seed). */
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyF' || e.repeat) return;
  const sc = (window as any).game?.scene;
  if (sc && (sc.constructor.name === 'NameEntryScene' || sc.digit >= 0)) return;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', resize);

input.init(display);
input.onFirstGesture.push(() => audio.init());

ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW.w, 256);
text(ctx, 'LOADING...', VIEW.w / 2, 124, 'metal', 1, 0.5);
present();

/** ?gentest=1 — generate 200 seeds × 15 levels, check fairness + determinism, report timings. */
async function genTest() {
  const { generateLevel, checkFair } = await import('./levels/generator');
  const { buildLevel } = await import('./levels');
  buildLevel(0, 'random', 1); // registers classic themes for Randomiser mode
  const SEEDS = 200, LEVELS = 15;
  let fails = 0, nondet = 0, maxMs = 0, total = 0, n = 0;
  const failures: string[] = [];
  const out = (msg: string) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW.w, 256);
    msg.split('\n').forEach((l, i) => text(ctx, l, 4, 4 + i * 10, 'metal'));
    present();
  };
  for (let s = 0; s < SEEDS; s++) {
    const seed = (s * 2654435761 + 12345) >>> 0;
    for (let i = 0; i < LEVELS; i++) {
      const random = s % 2 === 1;
      const t0 = performance.now();
      const lv = generateLevel(i, seed, random);
      const dt = performance.now() - t0;
      maxMs = Math.max(maxMs, dt); total += dt; n++;
      const bad = checkFair(lv.rows);
      if (bad.length) { fails++; failures.push(`seed ${seed.toString(16)} L${i + 1} rows ${bad.slice(0, 3).join(',')}`); }
      if (s < 20) {
        const again = generateLevel(i, seed, random);
        const sig = (l: typeof lv) => JSON.stringify([l.rows.map((r) => Array.from(r).join('')), l.spawns, l.midBoss, l.endBoss, l.checkpoints]);
        if (sig(lv) !== sig(again)) nondet++;
      }
    }
    if (s % 10 === 0) { out(`GENTEST ${s}/${SEEDS} SEEDS...`); await new Promise((r) => setTimeout(r, 0)); }
  }
  const report = `GENTEST DONE\n${n} LEVELS GENERATED\nFAIRNESS FAILURES: ${fails}\nNON-DETERMINISTIC: ${nondet}\nAVG ${(total / n).toFixed(2)} MS  MAX ${maxMs.toFixed(1)} MS`;
  console.log(report.replace(/\n/g, ' | '), failures.slice(0, 20));
  (window as any).gentest = { fails, nondet, avgMs: total / n, maxMs, failures };
  out(report);
}

setTimeout(() => {
  buildSprites();
  buildEnemies();
  buildBossArt();
  (window as any).__art = { S, SF, ENEMIES, Boss, game: () => game, canvas: () => canvas }; // debug: inspect generated art
  if (new URLSearchParams(location.search).get('gentest') === '1') { genTest(); return; }
  const game = new Game();
  (window as any).game = game;
  // closing the tab mid-run keeps your progress for CONTINUE
  window.addEventListener('pagehide', () => game.saveIfPlaying());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.saveIfPlaying(); });
  resize(); // apply the saved screen mode
  // test hook: advance the simulation synchronously (works even when the tab is hidden)
  (window as any).step = (n: number) => { for (let i = 0; i < n; i++) { input.poll(); game.update(); } prep(); game.render(ctx, 1); present(); };
  const STEP = 1000 / 50;
  let last = performance.now(), acc = 0;
  const frame = (now: number) => {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) {
      input.poll();
      game.update();
      acc -= STEP;
    }
    prep();
    game.render(ctx, acc / STEP);
    present();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}, 20);
