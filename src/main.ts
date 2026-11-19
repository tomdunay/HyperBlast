// Boot: canvas + integer scaling, 50 Hz fixed-timestep loop with interpolated rendering.
import { input } from './engine/input';
import { audio } from './engine/audio';
import { buildSprites } from './art/sprites';
import { buildEnemies } from './game/enemies';
import { buildBossArt } from './game/bosses';
import { Game } from './game/Game';
import { text } from './engine/font';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
const wrapEl = document.getElementById('wrap')!;

/**
 * Screen scaling modes (Options → SCREEN):
 *  fill    – as large as possible while keeping the 5:4 shape (default; fills one axis edge to edge)
 *  stretch – fills the whole window edge to edge, ignoring aspect ratio
 *  integer – largest whole-number multiple (sharpest pixels, may leave borders)
 */
function resize() {
  const mode: string = (window as any).game?.settings?.screen ?? 'fill';
  const vw = window.innerWidth, vh = window.innerHeight;
  let w: number, h: number;
  if (mode === 'stretch') { w = vw; h = vh; }
  else {
    const s = Math.min(vw / 320, vh / 256);
    const k = mode === 'integer' && s >= 1 ? Math.floor(s) : s;
    w = Math.floor(320 * k); h = Math.floor(256 * k);
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  wrapEl.style.width = canvas.style.width;
  wrapEl.style.height = canvas.style.height;
  (document.getElementById('crt') as HTMLElement).style.backgroundSize = `100% ${Math.max(2, h / 256)}px`;
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

input.init(canvas);
input.onFirstGesture.push(() => audio.init());

ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 256);
text(ctx, 'LOADING...', 160, 124, 'metal', 1, 0.5);

/** ?gentest=1 — generate 200 seeds × 15 levels, check fairness + determinism, report timings. */
async function genTest() {
  const { generateLevel, checkFair } = await import('./levels/generator');
  const { buildLevel } = await import('./levels');
  buildLevel(0, 'random', 1); // registers classic themes for Randomiser mode
  const SEEDS = 200, LEVELS = 15;
  let fails = 0, nondet = 0, maxMs = 0, total = 0, n = 0;
  const failures: string[] = [];
  const out = (msg: string) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 256);
    msg.split('\n').forEach((l, i) => text(ctx, l, 4, 4 + i * 10, 'metal'));
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
  if (new URLSearchParams(location.search).get('gentest') === '1') { genTest(); return; }
  const game = new Game();
  (window as any).game = game;
  resize(); // apply the saved screen mode
  // test hook: advance the simulation synchronously (works even when the tab is hidden)
  (window as any).step = (n: number) => { for (let i = 0; i < n; i++) { input.poll(); game.update(); } game.render(ctx, 1); };
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
    ctx.imageSmoothingEnabled = false;
    game.render(ctx, acc / STEP);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}, 20);
