// Layered explosions (flash → fireball → smoke → embers), debris, material sparks, shockwaves, floating text.
import { Pool } from '../engine/pool';
import { SF } from '../art/sprites';
import { Ctx, rnd, snap, hiCanvas, realSize, fbm, RES } from '../engine/gfx';
import { text } from '../engine/font';
import { glow } from '../engine/light';

export interface Particle {
  alive: boolean; kind: 'exp' | 'debris' | 'spark' | 'text' | 'ring' | 'smoke' | 'flash' | 'ember' | 'trail';
  x: number; y: number; ox: number; oy: number; vx: number; vy: number;
  t: number; life: number; size: number; color: string; world: boolean; str: string; delay: number;
}

const puffs: HTMLCanvasElement[] = [];
/**
 * Soft volumetric smoke puffs at art resolution: billowy noise shape, lit from the upper left, feathered edges.
 * A few variants are cached at radius 8 and scaled when drawn.
 */
function puff(i: number) {
  if (!puffs.length) {
    for (let v = 0; v < 4; v++) {
      const R = 8, S = R * 2 + 2;
      const [c, ctx] = hiCanvas(S, S);
      const [W, Hh] = realSize(c);
      const img = ctx.createImageData(W, Hh);
      const d = img.data;
      for (let Y = 0; Y < Hh; Y++) for (let X = 0; X < W; X++) {
        const x = (X + 0.5) / RES - S / 2, y = (Y + 0.5) / RES - S / 2;
        const n = fbm(x * 0.28 + v * 9, y * 0.28, 50 + v, 4);
        const dd = Math.hypot(x, y) / R + (0.5 - n) * 0.55;
        if (dd >= 1) continue;
        const lit = 0.55 + (fbm((x + 1.2) * 0.28 + v * 9, (y + 1.2) * 0.28, 50 + v, 4) - n) * -3 - (x + y) / R * 0.18;
        const a = Math.min(1, (1 - dd) * 2.2);
        const L = Math.max(0.15, Math.min(1, lit));
        const o = (Y * W + X) * 4;
        d[o] = 90 * L + 20; d[o + 1] = 86 * L + 18; d[o + 2] = 96 * L + 24; d[o + 3] = Math.round(a * 235);
      }
      ctx.putImageData(img, 0, 0);
      puffs.push(c);
    }
  }
  return puffs[i & 3];
}

export class FX {
  pool = new Pool<Particle>(() => ({ alive: false, kind: 'exp', x: 0, y: 0, ox: 0, oy: 0, vx: 0, vy: 0, t: 0, life: 0, size: 0, color: '', world: false, str: '', delay: 0 }), 600);
  shake = 0;
  /** full-screen white flash level (0..1) */
  flash = 0;

  private add(kind: Particle['kind'], x: number, y: number, vx: number, vy: number, life: number, world: boolean) {
    const p = this.pool.get();
    p.kind = kind; p.x = p.ox = x; p.y = p.oy = y; p.vx = vx; p.vy = vy; p.t = 0; p.life = life; p.world = world; p.delay = 0; p.color = '';
    return p;
  }
  explode(x: number, y: number, size: 0 | 1 | 2, world = false, delay = 0) {
    const frames = size === 0 ? SF.expS : size === 1 ? SF.expM : SF.expL;
    const fl = this.add('flash', x, y, 0, 0, 5, world);
    fl.size = [14, 26, 46][size]; fl.delay = delay;
    const p = this.add('exp', x, y, 0, size === 0 ? 0 : -0.2, frames.length * 3, world);
    p.size = size; p.delay = delay;
    const nSmoke = [1, 4, 9][size];
    for (let i = 0; i < nSmoke; i++) {
      const s = this.add('smoke', x + rnd(-4, 4) * (size + 1), y + rnd(-4, 4) * (size + 1), rnd(-0.3, 0.3), rnd(-0.5, 0.1), rnd(40, 80), true);
      s.size = rnd(3, 5) + size * 2; s.delay = delay + 6 + i * 2;
    }
    const nEmber = [2, 8, 18][size];
    for (let i = 0; i < nEmber; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(0.8, 2.5 + size);
      const e = this.add('ember', x, y, Math.cos(a) * sp, Math.sin(a) * sp - 0.6, rnd(18, 40), world);
      e.delay = delay;
    }
    if (size >= 1) this.debris(x, y, size === 1 ? 8 : 16, world);
    if (size === 2) { this.shake = Math.max(this.shake, 8); this.ring(x, y, world); this.flash = Math.max(this.flash, 0.25); }
    if (size === 1) this.shake = Math.max(this.shake, 2);
  }
  debris(x: number, y: number, n: number, world = false, color = '') {
    const cols = ['#ffee88', '#ffaa33', '#cc5511', '#888899', '#555566'];
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(0.5, 3.5);
      const p = this.add('debris', x, y, Math.cos(a) * s, Math.sin(a) * s - 1, rnd(20, 50), world);
      p.color = color || cols[(Math.random() * cols.length) | 0];
      p.size = Math.random() < 0.3 ? 2 : 1;
    }
  }
  /** Impact spark; material: '' (energy), 'metal' (silver), 'flesh' (red splat). */
  spark(x: number, y: number, world = false, material: '' | 'metal' | 'flesh' = '') {
    const p = this.add('spark', x, y, rnd(-0.5, 0.5), rnd(-0.5, 0.5), 8, world);
    p.size = 0;
    if (material) {
      const col = material === 'metal' ? '#ddeeff' : '#cc2222';
      for (let i = 0; i < 3; i++) {
        const a = rnd(0, Math.PI * 2), s = rnd(1, 2.5);
        const d = this.add('debris', x, y, Math.cos(a) * s, Math.sin(a) * s - 0.5, rnd(8, 16), world);
        d.color = col; d.size = 1;
      }
    }
  }
  /** Engine exhaust pixel streaming behind the ship. */
  exhaust(x: number, y: number, hot: boolean) {
    const p = this.add('trail', x + rnd(-1, 1), y, rnd(-0.15, 0.15), rnd(1.4, 2.2), hot ? 16 : 11, false);
    p.size = hot ? 2 : 1;
  }
  /** Flames licking up from burning wreckage. */
  burn(x: number, y: number) {
    const e = this.add('ember', x + rnd(-6, 6), y + rnd(-4, 4), rnd(-0.3, 0.3), rnd(-1.4, -0.6), rnd(12, 24), false);
    e.size = 1;
  }
  ring(x: number, y: number, world = false) {
    const p = this.add('ring', x, y, 0, 0, 24, world);
    p.size = 4;
  }
  smoke(x: number, y: number) {
    const p = this.add('smoke', x, y, rnd(-0.2, 0.2), rnd(0.3, 0.8), 24, false);
    p.size = rnd(1.5, 3);
  }
  floatText(x: number, y: number, s: string, color = 'gold') {
    const p = this.add('text', x, y, 0, -0.6, 45, false);
    p.str = s; p.color = color;
  }

  update(scrollDelta: number) {
    if (this.shake > 0) this.shake *= 0.86;
    if (this.shake < 0.3) this.shake = 0;
    this.flash *= 0.85;
    if (this.flash < 0.02) this.flash = 0;
    for (const p of this.pool.list) {
      p.ox = p.x; p.oy = p.y;
      if (p.world) { p.y += scrollDelta; p.oy += scrollDelta; }
      if (p.delay > 0) { p.delay--; continue; }
      p.t++;
      if (p.t >= p.life) { p.alive = false; continue; }
      p.x += p.vx; p.y += p.vy;
      if (p.kind === 'debris') { p.vy += 0.08; p.vx *= 0.98; }
      if (p.kind === 'ember') { p.vy += 0.05; p.vx *= 0.97; }
      if (p.kind === 'smoke') { p.vx *= 0.95; p.vy *= 0.97; p.size += 0.12; }
    }
    this.pool.sweep();
  }

  /** Normal-blend pass. */
  draw(ctx: Ctx, a: number) {
    for (const p of this.pool.list) {
      if (p.delay > 0) continue;
      const x = p.ox + (p.x - p.ox) * a, y = p.oy + (p.y - p.oy) * a;
      switch (p.kind) {
        case 'smoke': {
          const k = p.t / p.life;
          const s = puff(p.life | 0), r = Math.max(1, p.size * (1 - k * 0.3)) * 1.25;
          ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * 0.85;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 1;
          break;
        }
        case 'exp': {
          const frames = p.size === 0 ? SF.expS : p.size === 1 ? SF.expM : SF.expL;
          const f = frames[Math.min(frames.length - 1, Math.floor(p.t / 3))];
          ctx.drawImage(f, snap(x - f.width / 2), snap(y - f.height / 2));
          break;
        }
        case 'debris': {
          // tumbling chip: a lit face and a dark edge
          const sz = p.size * 0.8, k = (p.t * 0.4) % 2 < 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(snap(x), snap(y), sz, k ? sz : sz * 0.5);
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(snap(x), snap(y) + (k ? sz : sz * 0.5) - 0.5, sz, 0.5);
          break;
        }
        case 'trail': {
          const k = p.t / p.life;
          ctx.fillStyle = k < 0.2 ? '#ffffcc' : k < 0.45 ? '#ffbb44' : k < 0.7 ? '#cc5522' : '#552233';
          const s = (k < 0.5 ? p.size : 1) * 0.75;
          ctx.fillRect(snap(x - s / 2), snap(y - s / 2), s, s);
          break;
        }
        case 'ember': {
          const k = p.t / p.life;
          // streak along the velocity: hot head, fading tail
          ctx.strokeStyle = k < 0.3 ? '#ffffaa' : k < 0.6 ? '#ffaa33' : '#cc4411';
          ctx.lineWidth = 0.75;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 1.6, y - p.vy * 1.6); ctx.stroke();
          ctx.fillStyle = '#ffffee';
          ctx.fillRect(snap(x) - 0.5, snap(y) - 0.5, 1, 1);
          ctx.lineWidth = 1;
          break;
        }
        case 'spark': {
          const f = SF.spark[Math.min(2, Math.floor(p.t / 3))];
          ctx.drawImage(f, snap(x - f.width / 2), snap(y - f.height / 2));
          break;
        }
        case 'ring': {
          const r = 4 + (p.t + a) * 3, k = p.t / p.life;
          ctx.strokeStyle = `rgba(255,${200 - p.t * 6},120,${(1 - k) * 0.9})`;
          ctx.lineWidth = 2.5 * (1 - k) + 0.5;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,230,${(1 - k) * 0.7})`;
          ctx.lineWidth = 0.75;
          ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 1;
          break;
        }
        case 'text':
          if (p.t < 30 || p.t % 4 < 2) text(ctx, p.str, x, y, p.color as any, 1, 0.5);
          break;
      }
    }
  }

  /** Shockwave refraction rings for the post pass (playfield coordinates), strongest first. */
  waves(a: number): { x: number; y: number; r: number; s: number }[] {
    const out: { x: number; y: number; r: number; s: number }[] = [];
    for (const p of this.pool.list) {
      if (p.delay > 0) continue;
      const k = p.t / p.life;
      const x = p.ox + (p.x - p.ox) * a, y = p.oy + (p.y - p.oy) * a;
      if (p.kind === 'ring') out.push({ x, y, r: 4 + (p.t + a) * 4.2, s: 5 * (1 - k) });
      else if (p.kind === 'exp' && p.size >= 1) out.push({ x, y, r: 5 + (p.t + a) * (p.size === 2 ? 3 : 2.2), s: (p.size === 2 ? 3.5 : 2) * (1 - k) });
    }
    return out.sort((u, v) => v.s - u.s).slice(0, 8);
  }

  /** Big soft light sources for lighting the scenery (explosions + flashes). */
  drawSceneLight(ctx: Ctx, a: number) {
    for (const p of this.pool.list) {
      if (p.delay > 0 || (p.kind !== 'exp' && p.kind !== 'flash')) continue;
      const x = p.ox + (p.x - p.ox) * a, y = p.oy + (p.y - p.oy) * a;
      const k = 1 - p.t / p.life;
      const r = p.kind === 'flash' ? p.size * 2.2 : [26, 46, 80][p.size] * (0.5 + k * 0.5);
      const g = glow(Math.round(r / 4) * 4, p.kind === 'flash' ? '#ffeecc' : '#ff8833', Math.max(0.25, Math.round(k * 4) / 4) * 1.05);
      ctx.drawImage(g, snap(x - g.width / 2), snap(y - g.height / 2));
    }
  }

  /** Additive light pass: flashes, fireball glow, embers, sparks. Call with 'lighter' composite. */
  drawGlow(ctx: Ctx, a: number) {
    for (const p of this.pool.list) {
      if (p.delay > 0) continue;
      const x = p.ox + (p.x - p.ox) * a, y = p.oy + (p.y - p.oy) * a;
      let g: HTMLCanvasElement | null = null;
      switch (p.kind) {
        case 'flash': g = glow(Math.round(p.size * (1 - p.t / p.life * 0.4)), '#ffffff', 1.6); break;
        case 'exp': { const k = 1 - p.t / p.life; if (k > 0.2) g = glow(Math.round([10, 18, 30][p.size] * k) + 2, '#ff8822', Math.round(k * 4) / 4); break; }
        case 'ember': g = glow(3, '#ff7722', 0.8); break;
        case 'trail': if (p.t < 5) g = glow(3, '#ff9933', 0.7); break;
        case 'spark': g = glow(4, '#ffee88'); break;
      }
      if (g) ctx.drawImage(g, snap(x - g.width / 2), snap(y - g.height / 2));
    }
  }
}
