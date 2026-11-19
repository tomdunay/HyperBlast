// Level authoring DSL: terrain segments are laid bottom-to-top; spawns are placed relative to the
// current segment so they always line up with the scenery. Spawns trigger by scroll position.
import { LevelDef, SpawnDef, Theme, COLS, TILE, H } from '../game/types';

export class LB {
  rows: Uint8Array[] = [];
  L: number[] = [];
  R: number[] = [];
  spawns: SpawnDef[] = [];
  cps: number[] = [0];
  base = 0;
  midBoss?: { at: number; boss: string };
  endBoss?: { at: number; boss: string };
  shopAt = 0;

  /** Append `len` rows. Walls taper linearly from (l0,r0) to (l1,r1) tiles; wig adds a wavy edge. */
  seg(len: number, l0: number, r0: number, l1 = l0, r1 = r0, wig = 0) {
    this.base = this.rows.length;
    for (let i = 0; i < len; i++) {
      const t = len > 1 ? i / (len - 1) : 0;
      let l = Math.round(l0 + (l1 - l0) * t), r = Math.round(r0 + (r1 - r0) * t);
      if (wig) { const w = Math.round(Math.sin((this.rows.length + i) * 0.45) * wig); l = Math.max(0, l + w); r = Math.max(0, r - w); }
      const row = new Uint8Array(COLS);
      for (let c = 0; c < COLS; c++) row[c] = c < l || c >= COLS - r ? 1 : 0;
      this.rows.push(row); this.L.push(l); this.R.push(r);
    }
    return this;
  }
  /** Solid block relative to the current segment (row offset from its start, column, size in tiles). */
  block(off: number, col: number, w: number, h: number) {
    for (let y = 0; y < h; y++) {
      const r = this.rows[this.base + off + y];
      if (!r) continue;
      for (let x = col; x < col + w; x++) if (x >= 0 && x < COLS) r[x] = 1;
    }
    return this;
  }
  private atRow(off: number) { return (this.base + off) * TILE - H + TILE; }
  wave(off: number, type: string, n: number, x: number, pat: string, p: Record<string, number> = {}, gap = 16) {
    this.spawns.push({ at: this.atRow(off), kind: 'wave', type, n, x, pat, p, gap });
    return this;
  }
  one(off: number, type: string, x: number, pat = 'down', p: Record<string, number> = {}) {
    this.spawns.push({ at: this.atRow(off), kind: 'one', type, x, pat, p });
    return this;
  }
  /** Wall-mounted (world-attached) enemy on the left/right wall edge or at an explicit x. */
  wall(off: number, type: string, side: 'L' | 'R' | number, pat = 'static') {
    const row = this.base + off;
    const x = typeof side === 'number' ? side : side === 'L' ? this.L[row] * TILE + 6 : (COLS - this.R[row]) * TILE - 6;
    this.spawns.push({ at: row * TILE - H - TILE, kind: 'wall', type, x, row, pat });
    return this;
  }
  cap(off: number, x: number, token?: string) {
    this.spawns.push({ at: this.atRow(off), kind: 'cap', type: 'capsule', x, token });
    return this;
  }
  cp() { this.cps.push(this.rows.length * TILE); return this; }
  shop() { this.shopAt = this.rows.length * TILE; return this; }
  mid(boss: string) {
    this.seg(4, 1, 1);
    this.midBoss = { at: this.rows.length * TILE, boss };
    this.seg(17, 1, 1);
    this.shopAt = this.midBoss.at;
    return this;
  }
  end(boss: string) {
    this.seg(4, 1, 1);
    this.endBoss = { at: this.rows.length * TILE, boss };
    this.seg(18, 1, 1);
    return this;
  }
  build(idx: number, name: string, theme: Theme, music: string, speed: number): LevelDef {
    this.spawns.sort((a, b) => a.at - b.at);
    const cps = this.cps.slice(0, 6);
    while (cps.length < 6) cps.push(cps[cps.length - 1]);
    return {
      idx, name, theme, rows: this.rows, spawns: this.spawns, checkpoints: cps,
      midBoss: this.midBoss, endBoss: this.endBoss!, shopAt: this.shopAt, speed, music,
    };
  }
}
